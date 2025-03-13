import * as turf from '@turf/turf';
import axios from 'axios';

// Enable or disable debug logging
const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Debug logging function that only logs in development mode
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
const debugLog = (message, data) => {
  if (DEBUG) {
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

/**
 * Fetches data from the Netlify Function proxy
 * @param {string} path - The path to fetch from Environment Canada
 * @param {boolean} suppressErrors - Whether to suppress error logging (default: false)
 * @returns {Promise<string>} A promise that resolves to the response data
 */
const fetchFromProxy = async (path, suppressErrors = false) => {
  try {
    // Use the Netlify Function proxy
    const proxyUrl = `/api/cap/${path}`;
    
    debugLog(`Fetching from proxy: ${proxyUrl}`);
    
    // Use AbortController to cancel the request after a timeout for 404s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        // For 404 errors, just return null without logging when suppressErrors is true
        if (response.status === 404 && suppressErrors) {
          return null;
        }
        
        const errorText = await response.text().catch(() => 'No error text available');
        
        // Only log errors if not suppressed
        if (!suppressErrors) {
          console.error(`Proxy returned status: ${response.status}`, errorText.substring(0, 200));
        }
        
        throw new Error(`Proxy returned status: ${response.status}`);
      }
      
      const data = await response.text();
      debugLog('Successfully fetched data from proxy');
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // If it's an abort error or 404 and suppressErrors is true, just return null silently
      if ((fetchError.name === 'AbortError' || 
          (fetchError.message && fetchError.message.includes('404'))) && 
          suppressErrors) {
        return null;
      }
      
      throw fetchError;
    }
  } catch (error) {
    // Only log errors if not suppressed and not a 404
    if (!suppressErrors && !(error.message && error.message.includes('404'))) {
      console.error(`Proxy fetch failed: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Retrieves the user's current location using the browser's Geolocation API
 * @returns {Promise<{latitude: number, longitude: number}>} A promise that resolves to the user's coordinates
 */
export const getUserLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => {
        console.error('Error retrieving location:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
};

/**
 * Fetches the latest CAP alerts from Environment Canada
 * @returns {Promise<Array>} A promise that resolves to an array of alert XML files
 */
export const fetchLatestAlerts = async () => {
  try {
    // Generate date strings for today and the past few days
    const dateStrings = generateDateStrings();
    debugLog(`Generated date strings: ${dateStrings.join(', ')}`);
    
    let latestFolder = null;
    let directoryHtml = null;
    
    // Try each date string until we find a valid one
    for (const dateString of dateStrings) {
      try {
        const folderToTry = dateString + '/';
        debugLog(`Trying date folder: ${folderToTry}`);
        
        // Try to access the directory with this date - suppress errors for 404s
        directoryHtml = await fetchFromProxy(folderToTry, true);
        
        // If we get here without an error, we found a valid date folder
        if (directoryHtml) {
          latestFolder = folderToTry;
          debugLog(`Successfully accessed directory for date: ${dateString}`);
          break;
        }
      } catch (error) {
        debugLog(`Could not access directory for date: ${dateString}, trying next date...`);
      }
    }
    
    // If we couldn't find a valid date folder, try directory listing approach
    if (!latestFolder) {
      debugLog('No valid date folders found, trying directory listing approach...');
      
      try {
        directoryHtml = await fetchFromProxy('', true);
        if (directoryHtml) {
          latestFolder = parseLatestFolder(directoryHtml);
        }
        
        if (!latestFolder) {
          debugLog('Could not find the latest alerts folder from directory listing');
          // Fall back to today's date
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          latestFolder = `${year}${month}${day}/`;
          debugLog(`Falling back to today's date: ${latestFolder}`);
        }
      } catch (listingError) {
        debugLog('Error fetching directory listing:', listingError.message);
        // Fall back to today's date
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        latestFolder = `${year}${month}${day}/`;
        debugLog(`Falling back to today's date after error: ${latestFolder}`);
      }
    }
    
    debugLog(`Using alerts folder: ${latestFolder}`);
    
    let allXmlFiles = [];
    
    // Try cached paths first for faster results
    debugLog('Trying cached paths first...');
    const cachedFiles = await tryCachedPaths(latestFolder);
    allXmlFiles = allXmlFiles.concat(cachedFiles);
    
    // If we don't have enough files from cached paths, try directory navigation
    if (allXmlFiles.length < 10) {
      debugLog('Not enough XML files from cached paths. Trying directory navigation...');
      
      try {
        // Get subdirectories (office codes) - suppress errors for 404s
        const subdirectoriesHtml = await fetchFromProxy(latestFolder, true);
        
        if (subdirectoriesHtml) {
          const subdirectories = parseSubdirectories(subdirectoriesHtml);
          
          debugLog(`Found ${subdirectories.length} subdirectories in ${latestFolder}`);
          
          // For each subdirectory, try to get XML files
          for (const subdir of subdirectories) {
            try {
              const subdirPath = `${latestFolder}${subdir}/`;
              const subdirHtml = await fetchFromProxy(subdirPath, true);
              
              if (subdirHtml) {
                // Look for hour directories
                const hourDirs = parseSubdirectories(subdirHtml);
                
                for (const hourDir of hourDirs) {
                  try {
                    const hourPath = `${subdirPath}${hourDir}/`;
                    const hourHtml = await fetchFromProxy(hourPath, true);
                    
                    if (hourHtml) {
                      // Get XML files in this hour directory
                      const xmlFiles = parseXmlFilesList(hourHtml, hourPath);
                      
                      // Try to fetch and parse a sample file to verify it's valid
                      if (xmlFiles.length > 0) {
                        const sampleFile = xmlFiles[0];
                        const path = sampleFile.replace('https://dd.weather.gc.ca/alerts/cap/', '');
                        const xmlData = await fetchFromProxy(path, true);
                        
                        if (xmlData) {
                          const alert = parseCAP(xmlData, path);
                          
                          if (alert) {
                            // Cache this path for future use
                            cacheSuccessfulPath(path);
                            debugLog(`Cached successful path from directory navigation: ${path}`);
                          }
                        }
                      }
                      
                      allXmlFiles = allXmlFiles.concat(xmlFiles);
                      
                      // If we found enough files, stop searching
                      if (allXmlFiles.length >= 20) {
                        debugLog('Found enough XML files, stopping search');
                        break;
                      }
                    }
                  } catch (hourError) {
                    debugLog(`Error accessing hour directory ${hourDir}:`, hourError.message);
                  }
                }
              }
            } catch (subdirError) {
              debugLog(`Error accessing subdirectory ${subdir}:`, subdirError.message);
            }
          }
        }
      } catch (error) {
        debugLog('Error navigating directories:', error.message);
      }
    }
    
    // If we still don't have any XML files, try the fallback approach
    if (allXmlFiles.length === 0) {
      debugLog('No XML files found through directory navigation. Trying fallback approach...');
      
      try {
        // Try to fetch alerts from the battleboard RSS feed as a fallback
        const regionCodes = ['on', 'bc', 'ab', 'sk', 'mb', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];
        
        for (const regionCode of regionCodes) {
          try {
            const alertsUrl = `/api/cap/battleboard/${regionCode}_e.xml`;
            const rssData = await fetch(alertsUrl).then(res => res.text());
            
            if (rssData) {
              // Parse the RSS data to extract alert information
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(rssData, 'text/xml');
              const items = xmlDoc.querySelectorAll('item');
              
              if (items.length > 0) {
                debugLog(`Found ${items.length} alerts in RSS feed for region ${regionCode}`);
                
                // Convert RSS items to our alert format
                const rssAlerts = Array.from(items).map(item => {
                  const title = item.querySelector('title')?.textContent || '';
                  const description = item.querySelector('description')?.textContent || '';
                  const link = item.querySelector('link')?.textContent || '';
                  const pubDate = item.querySelector('pubDate')?.textContent || '';
                  
                  return {
                    id: `rss-${regionCode}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
                    title,
                    description,
                    link,
                    sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                    areas: [
                      {
                        description: regionCode.toUpperCase(),
                        // Use a large polygon that covers the entire region
                        polygon: getRegionPolygon(regionCode)
                      }
                    ],
                    sourceUrl: link
                  };
                });
                
                allXmlFiles = allXmlFiles.concat(rssAlerts);
              }
            }
          } catch (regionError) {
            debugLog(`Error fetching RSS feed for region ${regionCode}:`, regionError.message);
          }
        }
      } catch (fallbackError) {
        debugLog('Error using fallback approach:', fallbackError.message);
      }
    }
    
    debugLog(`Total XML files found: ${allXmlFiles.length}`);
    
    // Process the XML files to get alert data
    const alerts = [];
    
    for (const xmlFile of allXmlFiles) {
      try {
        // If this is already a parsed alert from the RSS feed, just add it
        if (xmlFile.id && xmlFile.title) {
          alerts.push(xmlFile);
          continue;
        }
        
        // Otherwise, fetch and parse the XML file
        const path = xmlFile.replace('https://dd.weather.gc.ca/alerts/cap/', '');
        const xmlData = await fetchFromProxy(path, true);
        
        if (xmlData) {
          const alert = parseCAP(xmlData, path);
          
          if (alert) {
            alerts.push(alert);
            // Cache this path for future use
            cacheSuccessfulPath(path);
          }
        }
      } catch (error) {
        debugLog(`Error processing XML file ${xmlFile}:`, error.message);
      }
    }
    
    debugLog(`Successfully parsed ${alerts.length} alerts`);
    
    // Return the alerts
    return alerts;
  } catch (error) {
    console.error('Error fetching latest alerts:', error);
    return [];
  }
};

/**
 * Generates date strings for the past few days to try finding alert data
 * @returns {Array<string>} Array of date strings in YYYYMMDD format
 */
const generateDateStrings = () => {
  const dates = [];
  const now = new Date();
  
  // Add today and the past 5 days (increased from 3 to 5 for more options)
  for (let i = 0; i < 6; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    dates.push(`${year}${month}${day}`);
  }
  
  // Also try tomorrow's date in case of timezone differences
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tYear = tomorrow.getFullYear();
  const tMonth = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const tDay = String(tomorrow.getDate()).padStart(2, '0');
  dates.unshift(`${tYear}${tMonth}${tDay}`); // Add to the beginning of the array
  
  debugLog('Generated date strings:', dates);
  return dates;
};

/**
 * Try cached paths from previous successful requests
 * @param {string} latestFolder - The latest date folder
 * @returns {Promise<Array>} A promise that resolves to an array of XML file URLs
 */
const tryCachedPaths = async (latestFolder) => {
  const allXmlFiles = [];
  
  // Check if we have cached successful paths from previous sessions
  const cachedPaths = getCachedSuccessfulPaths();
  
  // If we have cached paths, try them first
  if (cachedPaths && cachedPaths.length > 0) {
    debugLog(`Trying ${cachedPaths.length} cached paths first`);
    
    // Try each cached path
    for (const cachedPath of cachedPaths) {
      try {
        // Update the date in the cached path to use the latest folder
        const pathParts = cachedPath.split('/');
        if (pathParts.length >= 2) {
          pathParts[0] = latestFolder.replace('/', ''); // Remove trailing slash
          const updatedPath = pathParts.join('/');
          
          debugLog(`Trying cached path with updated date: ${updatedPath}`);
          
          // Use suppressErrors=true to avoid console spam for 404s
          const xmlData = await fetchFromProxy(updatedPath, true);
          
          if (xmlData) {
            const alert = parseCAP(xmlData, updatedPath);
            
            if (alert) {
              debugLog(`Successfully parsed alert from cached path: ${alert.title}`);
              allXmlFiles.push(`https://dd.weather.gc.ca/alerts/cap/${updatedPath}`);
              
              // If we found enough files, stop searching
              if (allXmlFiles.length >= 10) {
                debugLog('Found enough XML files from cached paths, stopping search');
                return allXmlFiles;
              }
            }
          }
        }
      } catch (error) {
        // Silently continue if a cached path fails
        debugLog(`Error with cached path: ${error.message}`);
      }
    }
  }
  
  return allXmlFiles;
};

/**
 * Cache a successful path for future use
 * @param {string} path - The successful path to cache
 */
const cacheSuccessfulPath = (path) => {
  try {
    // Get existing cached paths
    const existingPaths = getCachedSuccessfulPaths();
    
    // Add the new path if it doesn't already exist
    if (!existingPaths.includes(path)) {
      existingPaths.push(path);
      
      // Keep only the 10 most recent paths
      const recentPaths = existingPaths.slice(-10);
      
      // Save to localStorage
      localStorage.setItem('cap_successful_paths', JSON.stringify(recentPaths));
      debugLog(`Cached successful path: ${path}`);
    }
  } catch (error) {
    // Silently fail if localStorage is not available
    debugLog(`Error caching successful path: ${error.message}`);
  }
};

/**
 * Get cached successful paths from previous sessions
 * @returns {Array<string>} Array of cached paths
 */
const getCachedSuccessfulPaths = () => {
  try {
    const cachedPaths = localStorage.getItem('cap_successful_paths');
    return cachedPaths ? JSON.parse(cachedPaths) : [];
  } catch (error) {
    // Silently fail if localStorage is not available
    debugLog(`Error getting cached paths: ${error.message}`);
    return [];
  }
};

/**
 * Parses the directory listing to find the latest folder
 * @param {string} html - The HTML content of the directory listing
 * @returns {string|null} The name of the latest folder or null if not found
 */
const parseLatestFolder = (html) => {
  // Use regex to extract folder names (they typically look like YYYYMMDD/)
  const folderRegex = /href="(\d{8}\/)/g;
  const matches = [...html.matchAll(folderRegex)];
  
  if (matches.length === 0) {
    return null;
  }
  
  // Sort folders in descending order to get the latest one
  const folders = matches.map(match => match[1]);
  folders.sort((a, b) => b.localeCompare(a));
  
  return folders[0];
};

/**
 * Parses subdirectories from an HTML directory listing
 * @param {string} html - The HTML content of the directory listing
 * @returns {Array<string>} An array of subdirectory names
 */
const parseSubdirectories = (html) => {
  // Use regex to extract directory names (they end with /)
  // This regex looks for href attributes that point to directories (ending with /)
  // and excludes parent directory links (../)
  const dirRegex = /href="([^"]+\/)"(?!.*Parent Directory)/g;
  const matches = [...html.matchAll(dirRegex)];
  
  // Filter out any matches that contain ".." (parent directory)
  return matches
    .map(match => match[1])
    .filter(dir => !dir.includes('..'));
};

/**
 * Parses the list of XML files from the directory listing
 * @param {string} html - The HTML content of the directory listing
 * @param {string} folderPath - The folder path to prepend to file names
 * @returns {Array<string>} An array of XML file URLs
 */
const parseXmlFilesList = (html, folderPath) => {
  // Use regex to extract XML file names
  const fileRegex = /href="([^"]+\.cap)"/g;
  const matches = [...html.matchAll(fileRegex)];
  
  // Make sure we're not duplicating path segments
  return matches.map(match => {
    const fileName = match[1];
    // Remove any leading slashes from the filename to avoid double slashes
    const cleanFileName = fileName.startsWith('/') ? fileName.substring(1) : fileName;
    return `https://dd.weather.gc.ca/alerts/cap/${folderPath}${cleanFileName}`;
  });
};

/**
 * Fetches a sample of alert XML files
 * @param {Array<string>} xmlFiles - Array of XML file URLs
 * @param {number} sampleSize - Number of files to fetch
 * @returns {Promise<Array>} A promise that resolves to an array of parsed alerts
 */
const fetchSampleAlerts = async (xmlFiles, sampleSize) => {
  // Take a random sample of files to avoid overwhelming the browser
  const sampleFiles = xmlFiles.length <= sampleSize 
    ? xmlFiles 
    : getRandomSample(xmlFiles, sampleSize);
  
  console.log(`Attempting to fetch ${sampleFiles.length} alert files`);
  
  // Use Promise.allSettled instead of Promise.all to handle individual failures
  const alertPromises = sampleFiles.map(async (fileUrl) => {
    try {
      // Extract the path from the URL
      const path = fileUrl.replace('https://dd.weather.gc.ca/alerts/cap/', '');
      // Use suppressErrors=true to avoid console spam for 404s
      const xmlData = await fetchFromProxy(path, true);
      const alert = parseCAP(xmlData, fileUrl);
      
      if (!alert) {
        debugLog(`Failed to parse alert from ${fileUrl}`);
        return null;
      }
      
      return alert;
    } catch (error) {
      debugLog(`Error fetching alert file ${fileUrl}: ${error.message}`);
      return null;
    }
  });
  
  const results = await Promise.allSettled(alertPromises);
  
  // Filter out rejected promises and null results
  const successfulAlerts = results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => result.value);
  
  console.log(`Successfully fetched and parsed ${successfulAlerts.length} out of ${sampleFiles.length} alert files`);
  
  return successfulAlerts;
};

/**
 * Gets a random sample of items from an array
 * @param {Array} array - The array to sample from
 * @param {number} size - The size of the sample
 * @returns {Array} A random sample of the array
 */
const getRandomSample = (array, size) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, size);
};

/**
 * Parses a CAP XML file to extract alert information
 * @param {string} xmlString - The XML content of the alert
 * @param {string} sourceUrl - The source URL of the XML file
 * @returns {Object|null} The parsed alert object or null if parsing failed
 */
export const parseCAP = (xmlString, sourceUrl) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parsing error:', parseError.textContent);
      return null;
    }
    
    // Extract basic alert info
    const alertInfo = doc.querySelector('info');
    if (!alertInfo) {
      console.error('No info element found in CAP alert');
      return null;
    }
    
    // Extract alert details
    const title = alertInfo.querySelector('headline')?.textContent || 'Weather Alert';
    const description = alertInfo.querySelector('description')?.textContent || '';
    const severity = alertInfo.querySelector('severity')?.textContent || 'Unknown';
    const urgency = alertInfo.querySelector('urgency')?.textContent || 'Unknown';
    const certainty = alertInfo.querySelector('certainty')?.textContent || 'Unknown';
    const effective = alertInfo.querySelector('effective')?.textContent || '';
    const expires = alertInfo.querySelector('expires')?.textContent || '';
    
    // Extract sent date from the alert element
    const sent = doc.querySelector('sent')?.textContent || '';
    
    // Extract area information
    const areas = Array.from(alertInfo.querySelectorAll('area')).map(area => {
      const areaDesc = area.querySelector('areaDesc')?.textContent || '';
      const polygon = area.querySelector('polygon')?.textContent || '';
      const circle = area.querySelector('circle')?.textContent || '';
      
      return {
        description: areaDesc,
        polygon: polygon ? parsePolygon(polygon) : null,
        circle: circle ? parseCircle(circle) : null
      };
    });
    
    return {
      id: doc.querySelector('identifier')?.textContent || `alert-${Date.now()}`,
      title,
      description,
      severity,
      urgency,
      certainty,
      effective: effective ? new Date(effective).toISOString() : null,
      expires: expires ? new Date(expires).toISOString() : null,
      sent: sent ? new Date(sent).toISOString() : null,
      areas,
      sourceUrl
    };
  } catch (error) {
    console.error('Error parsing CAP alert:', error);
    return null;
  }
};

/**
 * Parses a polygon string from CAP format to GeoJSON format
 * @param {string} polygonString - The polygon string in CAP format (space-separated lat,lon pairs)
 * @returns {Array} An array of coordinates in GeoJSON format [lon, lat]
 */
const parsePolygon = (polygonString) => {
  try {
    // CAP format: "lat1,lon1 lat2,lon2 lat3,lon3 lat1,lon1"
    const coordinates = polygonString.split(' ').map(pair => {
      const [lat, lon] = pair.split(',').map(Number);
      return [lon, lat]; // GeoJSON uses [lon, lat] order
    });
    
    return coordinates;
  } catch (error) {
    console.error('Error parsing polygon:', error);
    return null;
  }
};

/**
 * Parses a circle string from CAP format
 * @param {string} circleString - The circle string in CAP format ("lat,lon radius")
 * @returns {Object} An object with center coordinates and radius
 */
const parseCircle = (circleString) => {
  try {
    // CAP format: "lat,lon radius"
    const parts = circleString.split(' ');
    const [lat, lon] = parts[0].split(',').map(Number);
    const radius = parseFloat(parts[1]);
    
    return {
      center: [lon, lat], // GeoJSON uses [lon, lat] order
      radius
    };
  } catch (error) {
    console.error('Error parsing circle:', error);
    return null;
  }
};

/**
 * Checks if a user's location is affected by an alert
 * @param {Object} userLocation - The user's location {latitude, longitude}
 * @param {Object} alert - The alert object
 * @returns {boolean} True if the user's location is affected by the alert
 */
export const isLocationAffected = (userLocation, alert) => {
  if (!userLocation || !alert) {
    debugLog('Missing user location or alert data');
    return false;
  }
  
  // If the alert doesn't have areas, we can't determine if the location is affected
  if (!alert.areas || alert.areas.length === 0) {
    // For development/testing, return true to show all alerts
    if (isDevelopmentMode()) {
      debugLog('No areas in alert, but returning true for development mode');
      return true;
    }
    debugLog('Alert has no areas defined');
    return false;
  }
  
  debugLog(`Checking if location (${userLocation.latitude}, ${userLocation.longitude}) is affected by alert: ${alert.title}`);
  
  try {
    const userPoint = turf.point([userLocation.longitude, userLocation.latitude]);
    
    // Get the user's region based on coordinates
    const userRegion = getRegionFromCoordinates(userLocation);
    debugLog(`User region: ${userRegion || 'unknown'}`);
    
    // Get nearby regions
    const nearbyRegions = getNearbyRegions(userLocation);
    debugLog(`Nearby regions: ${nearbyRegions.join(', ')}`);
    
    // Check each area in the alert
    return alert.areas.some(area => {
      // Check if area description matches user's region or nearby regions
      if (area.description) {
        const areaDescription = area.description.toLowerCase();
        
        // Check if the area description contains the user's region
        if (userRegion && areaDescription.includes(userRegion.toLowerCase())) {
          debugLog(`Region match found: ${userRegion} in ${area.description}`);
          return true;
        }
        
        // Check if the area description contains any nearby regions
        for (const region of nearbyRegions) {
          if (region && areaDescription.includes(region.toLowerCase())) {
            debugLog(`Nearby region match found: ${region} in ${area.description}`);
            return true;
          }
        }
      }
      
      // Check polygon with improved validation and buffering
      if (area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3) {
        try {
          // Make sure the polygon is closed (first and last points are the same)
          let polygonCoords = [...area.polygon];
          if (JSON.stringify(polygonCoords[0]) !== JSON.stringify(polygonCoords[polygonCoords.length - 1])) {
            polygonCoords.push(polygonCoords[0]); // Close the polygon
          }
          
          // Create the polygon
          const alertPolygon = turf.polygon([polygonCoords]);
          
          // Check if the user is in the polygon
          const isInPolygon = turf.booleanPointInPolygon(userPoint, alertPolygon);
          
          if (isInPolygon) {
            debugLog(`User is inside polygon for area: ${area.description}`);
            return true;
          }
          
          // If not in the polygon, check with a buffer (10km)
          try {
            const bufferedPolygon = turf.buffer(alertPolygon, 10, { units: 'kilometers' });
            const isInBufferedPolygon = turf.booleanPointInPolygon(userPoint, bufferedPolygon);
            
            if (isInBufferedPolygon) {
              debugLog(`User is within 10km of polygon for area: ${area.description}`);
              return true;
            }
          } catch (bufferError) {
            console.error('Error creating buffered polygon:', bufferError);
          }
        } catch (error) {
          console.error('Error checking polygon:', error);
          debugLog('Polygon data that caused the error:', area.polygon);
          
          // Try the bounding box approach as a fallback
          try {
            const coords = area.polygon.map(coord => ({ lng: coord[0], lat: coord[1] }));
            const bounds = getBoundingBox(coords);
            
            // Add a small buffer to the bounds (0.1 degrees ~ 11km)
            const bufferedBounds = {
              north: bounds.north + 0.1,
              south: bounds.south - 0.1,
              east: bounds.east + 0.1,
              west: bounds.west - 0.1
            };
            
            const isInBufferedBounds = userLocation.latitude >= bufferedBounds.south && 
                                      userLocation.latitude <= bufferedBounds.north && 
                                      userLocation.longitude >= bufferedBounds.west && 
                                      userLocation.longitude <= bufferedBounds.east;
            
            if (isInBufferedBounds) {
              debugLog(`User is within buffered bounding box for area: ${area.description}`);
              return true;
            }
          } catch (fallbackError) {
            console.error('Error in fallback bounding box check:', fallbackError);
          }
        }
      }
      
      // Check circle with improved validation and buffering
      if (area.circle && area.circle.center && typeof area.circle.radius === 'number') {
        try {
          const centerPoint = turf.point(area.circle.center);
          const distance = turf.distance(userPoint, centerPoint, { units: 'kilometers' });
          
          // Add a 10km buffer to the radius
          const bufferedRadius = area.circle.radius + 10;
          const isInBufferedCircle = distance <= bufferedRadius;
          
          if (isInBufferedCircle) {
            debugLog(`User is within ${distance}km of circle center (radius: ${area.circle.radius}km, buffered: ${bufferedRadius}km)`);
            return true;
          }
        } catch (error) {
          console.error('Error checking circle:', error);
          debugLog('Circle data that caused the error:', area.circle);
        }
      }
      
      return false;
    });
  } catch (error) {
    console.error('Error in isLocationAffected:', error);
    return false;
  }
};

// Helper function to get a bounding box from a set of coordinates
const getBoundingBox = (coords) => {
  let bounds = {
    north: -90,
    south: 90,
    east: -180,
    west: 180
  };
  
  for (const coord of coords) {
    bounds.north = Math.max(bounds.north, coord.lat);
    bounds.south = Math.min(bounds.south, coord.lat);
    bounds.east = Math.max(bounds.east, coord.lng);
    bounds.west = Math.min(bounds.west, coord.lng);
  }
  
  return bounds;
};

/**
 * Gets the region name from coordinates
 * @param {Object} location - The location {latitude, longitude}
 * @returns {string|null} The region name or null if unknown
 */
const getRegionFromCoordinates = (location) => {
  // Quebec regions
  if (location.latitude >= 46.7 && location.latitude <= 46.9 && 
      location.longitude >= -71.3 && location.longitude <= -71.0) {
    
    // Lévis area
    if (location.longitude >= -71.2) {
      return 'Lévis';
    }
    // Quebec City area
    else {
      return 'Québec';
    }
  }
  
  // Montreal area
  if (location.latitude >= 45.4 && location.latitude <= 45.7 && 
      location.longitude >= -73.7 && location.longitude <= -73.4) {
    return 'Montréal';
  }
  
  // Toronto area
  if (location.latitude >= 43.6 && location.latitude <= 43.9 && 
      location.longitude >= -79.5 && location.longitude <= -79.2) {
    return 'Toronto';
  }
  
  // Vancouver area
  if (location.latitude >= 49.2 && location.latitude <= 49.3 && 
      location.longitude >= -123.2 && location.longitude <= -123.0) {
    return 'Vancouver';
  }
  
  // Calgary area
  if (location.latitude >= 51.0 && location.latitude <= 51.2 && 
      location.longitude >= -114.2 && location.longitude <= -113.9) {
    return 'Calgary';
  }
  
  // Edmonton area
  if (location.latitude >= 53.5 && location.latitude <= 53.6 && 
      location.longitude >= -113.6 && location.longitude <= -113.4) {
    return 'Edmonton';
  }
  
  // Winnipeg area
  if (location.latitude >= 49.8 && location.latitude <= 50.0 && 
      location.longitude >= -97.2 && location.longitude <= -97.0) {
    return 'Winnipeg';
  }
  
  // Ottawa area
  if (location.latitude >= 45.3 && location.latitude <= 45.5 && 
      location.longitude >= -75.8 && location.longitude <= -75.6) {
    return 'Ottawa';
  }
  
  // Halifax area
  if (location.latitude >= 44.6 && location.latitude <= 44.7 && 
      location.longitude >= -63.7 && location.longitude <= -63.5) {
    return 'Halifax';
  }
  
  // Victoria area
  if (location.latitude >= 48.4 && location.latitude <= 48.5 && 
      location.longitude >= -123.4 && location.longitude <= -123.3) {
    return 'Victoria';
  }
  
  return null;
};

/**
 * Gets nearby regions that might affect the user's location
 * @param {Object} location - The location {latitude, longitude}
 * @returns {Array<string>} Array of nearby region names
 */
const getNearbyRegions = (location) => {
  // Quebec City and Lévis area
  if (location.latitude >= 46.7 && location.latitude <= 46.9 && 
      location.longitude >= -71.3 && location.longitude <= -71.0) {
    
    return ['Québec', 'Lévis', 'Chaudière-Appalaches', 'Beauce', 'Etchemin', 'Montmagny', 'Bellechasse'];
  }
  
  // Montreal area
  if (location.latitude >= 45.4 && location.latitude <= 45.7 && 
      location.longitude >= -73.7 && location.longitude <= -73.4) {
    return ['Montréal', 'Laval', 'Montérégie', 'Laurentides', 'Lanaudière'];
  }
  
  // Toronto area
  if (location.latitude >= 43.6 && location.latitude <= 43.9 && 
      location.longitude >= -79.5 && location.longitude <= -79.2) {
    return ['Toronto', 'Peel', 'York', 'Durham', 'Halton', 'Hamilton', 'Niagara'];
  }
  
  // Vancouver area
  if (location.latitude >= 49.2 && location.latitude <= 49.3 && 
      location.longitude >= -123.2 && location.longitude <= -123.0) {
    return ['Vancouver', 'Burnaby', 'Richmond', 'Surrey', 'North Vancouver', 'West Vancouver', 'Coquitlam', 'Fraser Valley'];
  }
  
  // Calgary area
  if (location.latitude >= 51.0 && location.latitude <= 51.2 && 
      location.longitude >= -114.2 && location.longitude <= -113.9) {
    return ['Calgary', 'Airdrie', 'Rocky View County', 'Foothills'];
  }
  
  // Edmonton area
  if (location.latitude >= 53.5 && location.latitude <= 53.6 && 
      location.longitude >= -113.6 && location.longitude <= -113.4) {
    return ['Edmonton', 'St. Albert', 'Sherwood Park', 'Strathcona County', 'Leduc'];
  }
  
  // Winnipeg area
  if (location.latitude >= 49.8 && location.latitude <= 50.0 && 
      location.longitude >= -97.2 && location.longitude <= -97.0) {
    return ['Winnipeg', 'St. Boniface', 'Headingley', 'East St. Paul', 'West St. Paul'];
  }
  
  // Ottawa area
  if (location.latitude >= 45.3 && location.latitude <= 45.5 && 
      location.longitude >= -75.8 && location.longitude <= -75.6) {
    return ['Ottawa', 'Gatineau', 'Nepean', 'Kanata', 'Orleans', 'Gloucester'];
  }
  
  // Halifax area
  if (location.latitude >= 44.6 && location.latitude <= 44.7 && 
      location.longitude >= -63.7 && location.longitude <= -63.5) {
    return ['Halifax', 'Dartmouth', 'Bedford', 'Sackville', 'Cole Harbour'];
  }
  
  // Victoria area
  if (location.latitude >= 48.4 && location.latitude <= 48.5 && 
      location.longitude >= -123.4 && location.longitude <= -123.3) {
    return ['Victoria', 'Saanich', 'Esquimalt', 'Oak Bay', 'Colwood', 'Langford'];
  }
  
  return [];
};

/**
 * Filters alerts to only include those affecting the user's location
 * @param {Array} alerts - Array of alert objects
 * @param {Object} userLocation - The user's location {latitude, longitude}
 * @returns {Array} Filtered array of alerts affecting the user's location
 */
export const filterAlertsByLocation = (alerts, userLocation) => {
  if (!alerts || !userLocation) {
    return [];
  }
  
  debugLog(`Filtering ${alerts.length} alerts for location: ${JSON.stringify(userLocation)}`);
  
  const relevantAlerts = alerts.filter(alert => isLocationAffected(userLocation, alert));
  debugLog(`Found ${relevantAlerts.length} alerts relevant to user location`);
  
  return relevantAlerts;
};

/**
 * Checks if the app is running in development mode
 * @returns {boolean} True if the app is running in development mode
 */
const isDevelopmentMode = () => {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
};

/**
 * Deduplicates alerts to only keep the most recent version of each alert
 * @param {Array} alerts - Array of alert objects
 * @returns {Array} Deduplicated array of alerts
 */
const deduplicateAlerts = (alerts) => {
  if (!alerts || alerts.length === 0) {
    return [];
  }
  
  console.log(`Deduplicating ${alerts.length} alerts`);
  
  // Group alerts by their base title (removing status indicators)
  const alertGroups = {};
  
  alerts.forEach(alert => {
    if (!alert || !alert.title) return;
    
    // Extract the base title by removing status indicators
    const baseTitle = getBaseTitle(alert.title);
    
    // If we don't have this group yet, create it
    if (!alertGroups[baseTitle]) {
      alertGroups[baseTitle] = [];
    }
    
    // Add this alert to its group
    alertGroups[baseTitle].push(alert);
  });
  
  // For each group, keep only the most recent alert
  const deduplicated = [];
  
  Object.keys(alertGroups).forEach(baseTitle => {
    const group = alertGroups[baseTitle];
    
    // Skip cancelled alerts if there are active ones
    const activeAlerts = group.filter(alert => 
      !alert.title.toLowerCase().includes('annulé') && 
      !alert.title.toLowerCase().includes('terminé'));
    
    if (activeAlerts.length > 0) {
      // Sort by sent date (most recent first)
      activeAlerts.sort((a, b) => {
        const dateA = a.sent ? new Date(a.sent) : new Date(a.effective || 0);
        const dateB = b.sent ? new Date(b.sent) : new Date(b.effective || 0);
        return dateB - dateA;
      });
      
      // Keep only the most recent active alert
      deduplicated.push(activeAlerts[0]);
      console.log(`Keeping most recent active alert for "${baseTitle}": ${activeAlerts[0].title}`);
    } else {
      // If all alerts are cancelled, keep the most recent cancelled one
      group.sort((a, b) => {
        const dateA = a.sent ? new Date(a.sent) : new Date(a.effective || 0);
        const dateB = b.sent ? new Date(b.sent) : new Date(b.effective || 0);
        return dateB - dateA;
      });
      
      // Keep only the most recent cancelled alert
      deduplicated.push(group[0]);
      console.log(`Keeping most recent cancelled alert for "${baseTitle}": ${group[0].title}`);
    }
  });
  
  return deduplicated;
};

/**
 * Extracts the base title from an alert title by removing status indicators
 * @param {string} title - The alert title
 * @returns {string} The base title
 */
const getBaseTitle = (title) => {
  if (!title) return '';
  
  // Convert to lowercase for consistent matching
  const lowerTitle = title.toLowerCase();
  
  // Remove status indicators
  return lowerTitle
    .replace(/en vigueur|annulé|terminé|émis|mis à jour|ended|in effect|issued|updated/g, '')
    .replace(/avertissement de |veille de |bulletin de |alerte de |warning|watch|statement|advisory/g, '')
    .trim();
};

/**
 * Formats an alert for display in the UI
 * @param {Object} alert - The raw alert object
 * @returns {Object} A formatted alert object ready for display
 */
export const formatAlertForDisplay = (alert) => {
  if (!alert) return null;
  
  // Determine alert type based on severity
  let alertType = 'info';
  if (alert.severity === 'Extreme') alertType = 'extreme';
  else if (alert.severity === 'Severe') alertType = 'severe';
  else if (alert.severity === 'Moderate') alertType = 'moderate';
  
  // Format the description for HTML display
  const formattedDescription = alert.description
    .replace(/\n/g, '<br>')
    .replace(/\s{2,}/g, ' ');
  
  return {
    id: alert.id,
    title: alert.title,
    summary: formattedDescription,
    published: alert.effective || new Date().toISOString(),
    expires: alert.expires,
    severity: alert.severity,
    urgency: alert.urgency,
    certainty: alert.certainty,
    type: alertType,
    link: alert.sourceUrl,
    areas: alert.areas.map(area => area.description).join(', ')
  };
};

// Helper function to get a polygon that covers a region
const getRegionPolygon = (regionCode) => {
  // These are very rough approximations of region boundaries
  const regionBounds = {
    'on': [[-95, 56], [-95, 42], [-74, 42], [-74, 56], [-95, 56]], // Ontario
    'bc': [[-139, 60], [-139, 48], [-114, 48], [-114, 60], [-139, 60]], // British Columbia
    'ab': [[-120, 60], [-120, 49], [-110, 49], [-110, 60], [-120, 60]], // Alberta
    'sk': [[-110, 60], [-110, 49], [-101, 49], [-101, 60], [-110, 60]], // Saskatchewan
    'mb': [[-102, 60], [-102, 49], [-89, 49], [-89, 60], [-102, 60]], // Manitoba
    'qc': [[-79, 62], [-79, 45], [-57, 45], [-57, 62], [-79, 62]], // Quebec
    'nb': [[-69, 48], [-69, 45], [-64, 45], [-64, 48], [-69, 48]], // New Brunswick
    'ns': [[-66, 47], [-66, 43], [-60, 43], [-60, 47], [-66, 47]], // Nova Scotia
    'pe': [[-64, 47], [-64, 46], [-62, 46], [-62, 47], [-64, 47]], // Prince Edward Island
    'nl': [[-67, 60], [-67, 46], [-52, 46], [-52, 60], [-67, 60]], // Newfoundland and Labrador
    'yt': [[-141, 70], [-141, 60], [-124, 60], [-124, 70], [-141, 70]], // Yukon
    'nt': [[-136, 70], [-136, 60], [-102, 60], [-102, 70], [-136, 70]], // Northwest Territories
    'nu': [[-120, 83], [-120, 60], [-60, 60], [-60, 83], [-120, 83]]  // Nunavut
  };
  
  return regionBounds[regionCode] || null;
}; 