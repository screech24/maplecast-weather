import * as turf from '@turf/turf';
import axios from 'axios';
import { mockAlerts } from './mockAlerts';

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
 * @param {string} cacheParam - Optional cache-busting parameter
 * @returns {Promise<string>} A promise that resolves to the response data
 */
const fetchFromProxy = async (path, suppressErrors = false, cacheParam = '') => {
  try {
    // Use the Netlify Function proxy
    const proxyUrl = `/api/cap/${path}${cacheParam}`;
    
    console.log(`[DEBUG] Fetching from proxy: ${proxyUrl}`);
    debugLog(`Fetching from proxy: ${proxyUrl}`);
    
    // Use AbortController to cancel the request after a timeout for 404s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      console.log(`[DEBUG] Starting fetch request to: ${proxyUrl}`);
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, */*',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`[DEBUG] Fetch response status: ${response.status}`);
      
      if (!response.ok) {
        // For 404 errors, just return null without logging when suppressErrors is true
        if (response.status === 404 && suppressErrors) {
          console.log(`[DEBUG] 404 response for ${proxyUrl} (suppressed)`);
          return null;
        }
        
        const errorText = await response.text().catch(() => 'No error text available');
        console.log(`[DEBUG] Error response text: ${errorText.substring(0, 200)}`);
        
        // Only log errors if not suppressed
        if (!suppressErrors) {
          console.error(`Proxy returned status: ${response.status}`, errorText.substring(0, 200));
        }
        
        throw new Error(`Proxy returned status: ${response.status}`);
      }
      
      const data = await response.text();
      console.log(`[DEBUG] Successfully fetched data from proxy (${data.length} bytes)`);
      debugLog('Successfully fetched data from proxy');
      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log(`[DEBUG] Fetch error: ${fetchError.message}`);
      
      // If it's an abort error or 404 and suppressErrors is true, just return null silently
      if ((fetchError.name === 'AbortError' || 
          (fetchError.message && fetchError.message.includes('404'))) && 
          suppressErrors) {
        console.log(`[DEBUG] Suppressed error: ${fetchError.message}`);
        return null;
      }
      
      // Try using a direct CORS proxy as a fallback
      try {
        console.log(`[DEBUG] Trying direct CORS proxy as fallback for: ${path}`);
        const directUrl = `https://dd.weather.gc.ca/alerts/cap/${path}`;
        const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
        
        const directResponse = await fetch(corsProxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!directResponse.ok) {
          console.log(`[DEBUG] Direct CORS proxy fallback failed with status: ${directResponse.status}`);
          throw new Error(`Direct CORS proxy returned status: ${directResponse.status}`);
        }
        
        const directData = await directResponse.text();
        console.log(`[DEBUG] Successfully fetched data from direct CORS proxy (${directData.length} bytes)`);
        return directData;
      } catch (directError) {
        console.log(`[DEBUG] Direct CORS proxy fallback failed: ${directError.message}`);
        throw fetchError; // Throw the original error
      }
    }
  } catch (error) {
    console.log(`[DEBUG] Error in fetchFromProxy: ${error.message}`);
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
  console.warn('getUserLocation called - this should only happen when no saved location is available');
  
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
 * @param {string} cacheParam - Optional cache-busting parameter
 * @returns {Promise<Array>} A promise that resolves to an array of alert XML files
 */
export const fetchLatestAlerts = async (cacheParam = '') => {
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
        directoryHtml = await fetchFromProxy(folderToTry, true, cacheParam);
        
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
        directoryHtml = await fetchFromProxy('', true, cacheParam);
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
    const cachedFiles = await tryCachedPaths(latestFolder, cacheParam);
    allXmlFiles = allXmlFiles.concat(cachedFiles);
    
    // If we don't have enough files from cached paths, try directory navigation
    if (allXmlFiles.length < 10) {
      debugLog('Not enough XML files from cached paths. Trying directory navigation...');
      
      try {
        // Get subdirectories (office codes) - suppress errors for 404s
        const subdirectoriesHtml = await fetchFromProxy(latestFolder, true, cacheParam);
        
        if (subdirectoriesHtml) {
          const subdirectories = parseSubdirectories(subdirectoriesHtml);
          
          debugLog(`Found ${subdirectories.length} subdirectories in ${latestFolder}`);
          
          // For each subdirectory, try to get XML files
          for (const subdir of subdirectories) {
            try {
              const subdirPath = `${latestFolder}${subdir}/`;
              const subdirHtml = await fetchFromProxy(subdirPath, true, cacheParam);
              
              if (subdirHtml) {
                // Look for hour directories
                const hourDirs = parseSubdirectories(subdirHtml);
                
                for (const hourDir of hourDirs) {
                  try {
                    const hourPath = `${subdirPath}${hourDir}/`;
                    const hourHtml = await fetchFromProxy(hourPath, true, cacheParam);
                    
                    if (hourHtml) {
                      // Get XML files in this hour directory
                      const xmlFiles = parseXmlFilesList(hourHtml, hourPath);
                      
                      // Try to fetch and parse a sample file to verify it's valid
                      if (xmlFiles.length > 0) {
                        const sampleFile = xmlFiles[0];
                        const path = sampleFile.replace('https://dd.weather.gc.ca/alerts/cap/', '');
                        const xmlData = await fetchFromProxy(path, true, cacheParam);
                        
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
                      if (allXmlFiles.length >= 50) {
                        debugLog(`Found ${allXmlFiles.length} XML files, stopping search`);
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
    
    // If we still don't have any XML files, try the fallback approach with direct CORS proxy
    if (allXmlFiles.length === 0) {
      debugLog('No XML files found through directory navigation. Trying fallback approach with direct CORS proxy...');
      
      try {
        // Try to fetch alerts from the battleboard RSS feed as a fallback
        const regionCodes = ['on', 'bc', 'ab', 'sk', 'mb', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];
        
        for (const regionCode of regionCodes) {
          try {
            // Use a direct CORS proxy for the battleboard RSS feed
            const battleboardUrl = `https://weather.gc.ca/warnings/rss/${regionCode}_e.xml`;
            const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(battleboardUrl)}`;
            
            console.log(`[DEBUG] Trying direct CORS proxy for battleboard RSS feed: ${corsProxyUrl}`);
            
            const rssResponse = await fetch(corsProxyUrl);
            
            if (!rssResponse.ok) {
              console.log(`[DEBUG] Direct CORS proxy for battleboard RSS feed failed with status: ${rssResponse.status}`);
              continue;
            }
            
            const rssData = await rssResponse.text();
            
            if (rssData && rssData.includes('<entry>')) {
              debugLog(`Successfully fetched RSS feed for ${regionCode} using direct CORS proxy`);
              
              // Parse the RSS feed to get alerts
              const parser = new DOMParser();
              const doc = parser.parseFromString(rssData, 'text/xml');
              const entries = doc.querySelectorAll('entry');
              
              for (const entry of entries) {
                try {
                  const id = entry.querySelector('id')?.textContent;
                  const title = entry.querySelector('title')?.textContent;
                  const updated = entry.querySelector('updated')?.textContent;
                  const summary = entry.querySelector('summary')?.textContent;
                  const link = entry.querySelector('link')?.getAttribute('href');
                  
                  if (id && title) {
                    // Create a simplified alert object from the RSS entry
                    const alert = {
                      id,
                      title,
                      sent: updated,
                      effective: updated,
                      expires: null, // Not available in RSS
                      status: 'Actual',
                      msgType: 'Alert',
                      category: 'Met',
                      severity: title.toLowerCase().includes('warning') ? 'Moderate' : 'Minor',
                      certainty: 'Observed',
                      urgency: 'Expected',
                      areas: [
                        {
                          description: title.split(' - ')[1] || regionCode.toUpperCase(),
                          polygon: getRegionPolygon(regionCode),
                          circle: null
                        }
                      ],
                      sourceUrl: link,
                      web: link,
                      summary,
                      references: []
                    };
                    
                    allXmlFiles.push(alert);
                  }
                } catch (entryError) {
                  debugLog(`Error parsing RSS entry:`, entryError.message);
                }
              }
            }
          } catch (rssError) {
            debugLog(`Error fetching RSS feed for ${regionCode} using direct CORS proxy:`, rssError.message);
          }
        }
      } catch (fallbackError) {
        debugLog('Error in fallback approach with direct CORS proxy:', fallbackError.message);
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
        const xmlData = await fetchFromProxy(path, true, cacheParam);
        
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
    
    // Return the alerts - no fallback to mock alerts
    return alerts;
  } catch (error) {
    console.error('Error fetching latest alerts:', error);
    // Return an empty array instead of mock alerts
    return [];
  }
};

/**
 * Generates date strings for the current and previous day to try finding alert data
 * @returns {Array<string>} Array of date strings in YYYYMMDD format
 */
const generateDateStrings = () => {
  const dates = [];
  const now = new Date();
  
  // Add today and yesterday only (reduced from 6 days to 2 for efficiency)
  for (let i = 0; i < 2; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    dates.push(`${year}${month}${day}`);
  }
  
  // Removed the code that tries tomorrow's date to avoid unnecessary API calls
  
  debugLog('Generated date strings:', dates);
  return dates;
};

/**
 * Tries to fetch alerts from cached paths
 * @param {string} latestFolder - The latest folder to check
 * @param {string} cacheParam - Optional cache-busting parameter
 * @returns {Promise<Array>} A promise that resolves to an array of XML files
 */
const tryCachedPaths = async (latestFolder, cacheParam = '') => {
  const cachedPaths = getCachedSuccessfulPaths();
  
  if (cachedPaths.length === 0) {
    debugLog('No cached paths available');
    return [];
  }
  
  debugLog(`Trying ${cachedPaths.length} cached paths`);
  
  const xmlFiles = [];
  
  // Try each cached path
  for (const path of cachedPaths) {
    try {
      // Update the path to use the latest folder
      const updatedPath = path.replace(/^\d{8}\//, latestFolder);
      
      // Try to fetch the XML file
      const xmlData = await fetchFromProxy(updatedPath, true, cacheParam);
      
      if (xmlData) {
        // Add the full URL to the list
        xmlFiles.push(`https://dd.weather.gc.ca/alerts/cap/${updatedPath}`);
        debugLog(`Successfully fetched cached path: ${updatedPath}`);
      }
    } catch (error) {
      debugLog(`Error fetching cached path: ${path}`, error.message);
    }
  }
  
  debugLog(`Found ${xmlFiles.length} XML files from cached paths`);
  return xmlFiles;
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
    
    // Get the user's province
    const userProvince = getUserProvince(userLocation);
    debugLog(`User province: ${userProvince || 'unknown'}`);
    
    // Get province variations
    const provinceVariations = userProvince ? getProvinceVariations(userProvince) : [];
    
    // Check each area in the alert
    return alert.areas.some(area => {
      // Check if area description matches user's region, nearby regions, or province
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
        
        // Check if the area description contains the user's province
        if (userProvince) {
          if (areaDescription.includes(userProvince.toLowerCase())) {
            debugLog(`Province match found: ${userProvince} in ${area.description}`);
            return true;
          }
          
          // Check province variations
          for (const variation of provinceVariations) {
            if (areaDescription.includes(variation.toLowerCase())) {
              debugLog(`Province variation match found: ${variation} in ${area.description}`);
              return true;
            }
          }
        }
        
        // Check for common variations of region names
        if (userRegion) {
          const regionVariations = getRegionVariations(userRegion);
          for (const variation of regionVariations) {
            if (areaDescription.includes(variation.toLowerCase())) {
              debugLog(`Region variation match found: ${variation} in ${area.description}`);
              return true;
            }
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
          
          // If not in the polygon, check with a buffer (30km)
          try {
            const bufferedPolygon = turf.buffer(alertPolygon, 30, { units: 'kilometers' });
            const isInBufferedPolygon = turf.booleanPointInPolygon(userPoint, bufferedPolygon);
            
            if (isInBufferedPolygon) {
              debugLog(`User is within 30km of polygon for area: ${area.description}`);
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
            
            // Add a larger buffer to the bounds (0.3 degrees ~ 33km)
            const bufferedBounds = {
              north: bounds.north + 0.3,
              south: bounds.south - 0.3,
              east: bounds.east + 0.3,
              west: bounds.west - 0.3
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
          
          // Add a 30km buffer to the radius
          const bufferedRadius = area.circle.radius + 30;
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

/**
 * Gets the user's province based on coordinates
 * @param {Object} location - The location {latitude, longitude}
 * @returns {string|null} The province name or null if unknown
 */
const getUserProvince = (location) => {
  if (!location) return null;
  
  // First try to get the region, which might be a city or smaller area
  const region = getRegionFromCoordinates(location);
  
  if (!region) return null;
  
  // Map of provinces and their major cities/regions
  const provinceMap = {
    'Alberta': ['Edmonton', 'Calgary', 'Red Deer', 'Lethbridge', 'Fort McMurray', 'Grande Prairie', 'Medicine Hat', 'Banff'],
    'British Columbia': ['Vancouver', 'Victoria', 'Kelowna', 'Kamloops', 'Nanaimo', 'Prince George', 'Whistler', 'Tofino'],
    'Manitoba': ['Winnipeg', 'Brandon', 'Thompson', 'Portage la Prairie', 'Steinbach', 'Dauphin'],
    'New Brunswick': ['Fredericton', 'Moncton', 'Saint John', 'Bathurst', 'Edmundston', 'Miramichi'],
    'Newfoundland and Labrador': ['St. John\'s', 'Corner Brook', 'Gander', 'Grand Falls-Windsor', 'Labrador City'],
    'Northwest Territories': ['Yellowknife', 'Inuvik', 'Hay River', 'Fort Smith'],
    'Nova Scotia': ['Halifax', 'Sydney', 'Truro', 'Dartmouth', 'Yarmouth', 'New Glasgow'],
    'Nunavut': ['Iqaluit', 'Rankin Inlet', 'Arviat', 'Baker Lake', 'Cambridge Bay'],
    'Ontario': ['Toronto', 'Ottawa', 'Hamilton', 'London', 'Windsor', 'Sudbury', 'Thunder Bay', 'Kingston', 'Niagara Falls'],
    'Prince Edward Island': ['Charlottetown', 'Summerside', 'Stratford', 'Cornwall', 'Montague'],
    'Quebec': ['Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Sherbrooke', 'Trois-Rivieres', 'Saguenay'],
    'Saskatchewan': ['Regina', 'Saskatoon', 'Prince Albert', 'Moose Jaw', 'Swift Current', 'Yorkton'],
    'Yukon': ['Whitehorse', 'Dawson City', 'Watson Lake', 'Haines Junction']
  };
  
  // Check if the region is in any of the provinces
  for (const [province, cities] of Object.entries(provinceMap)) {
    if (cities.some(city => region.includes(city))) {
      return province;
    }
  }
  
  // If we couldn't determine the province from the region, return null
  return null;
};

/**
 * Gets variations of a region name for more flexible matching
 * @param {string} region - The region name
 * @returns {Array} Array of region name variations
 */
const getRegionVariations = (region) => {
  if (!region) return [];
  
  const variations = [region];
  
  // Add common variations
  variations.push(`${region} area`);
  variations.push(`${region} region`);
  variations.push(`${region} and vicinity`);
  variations.push(`${region} and surrounding areas`);
  
  // For cities, add "City of" variation
  variations.push(`City of ${region}`);
  
  // Add variations with hyphens and without spaces
  variations.push(region.replace(/\s+/g, '-'));
  variations.push(region.replace(/\s+/g, ''));
  
  return variations;
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
 * Gets nearby regions based on the user's location
 * @param {Object} location - The user's location {latitude, longitude}
 * @returns {Array} Array of nearby region names
 */
const getNearbyRegions = (location) => {
  if (!location) return [];
  
  // Get the user's region
  const userRegion = getRegionFromCoordinates(location);
  
  if (!userRegion) return [];
  
  // Map of regions and their nearby regions
  const regionMap = {
    // Alberta
    'Edmonton': ['St. Albert', 'Sherwood Park', 'Leduc', 'Spruce Grove', 'Fort Saskatchewan', 'Beaumont', 'Devon', 'Stony Plain', 'Alberta', 'Central Alberta', 'Northern Alberta'],
    'Calgary': ['Airdrie', 'Cochrane', 'Chestermere', 'Okotoks', 'Strathmore', 'Canmore', 'Banff', 'Alberta', 'Southern Alberta'],
    'Red Deer': ['Sylvan Lake', 'Lacombe', 'Blackfalds', 'Innisfail', 'Penhold', 'Alberta', 'Central Alberta'],
    'Lethbridge': ['Coaldale', 'Coalhurst', 'Taber', 'Raymond', 'Alberta', 'Southern Alberta'],
    'Fort McMurray': ['Wood Buffalo', 'Alberta', 'Northern Alberta'],
    'Grande Prairie': ['Wembley', 'Beaverlodge', 'Sexsmith', 'Alberta', 'Northern Alberta'],
    'Medicine Hat': ['Redcliff', 'Dunmore', 'Alberta', 'Southern Alberta'],
    
    // British Columbia
    'Vancouver': ['Burnaby', 'Richmond', 'Surrey', 'North Vancouver', 'West Vancouver', 'Coquitlam', 'New Westminster', 'Delta', 'Langley', 'White Rock', 'British Columbia', 'Lower Mainland', 'BC', 'B.C.'],
    'Victoria': ['Saanich', 'Oak Bay', 'Esquimalt', 'Colwood', 'Langford', 'Sidney', 'British Columbia', 'Vancouver Island', 'BC', 'B.C.'],
    'Kelowna': ['West Kelowna', 'Lake Country', 'Peachland', 'Vernon', 'Penticton', 'British Columbia', 'Interior BC', 'BC', 'B.C.'],
    'Kamloops': ['Chase', 'Barriere', 'British Columbia', 'Interior BC', 'BC', 'B.C.'],
    'Nanaimo': ['Parksville', 'Qualicum Beach', 'Ladysmith', 'British Columbia', 'Vancouver Island', 'BC', 'B.C.'],
    'Prince George': ['Vanderhoof', 'British Columbia', 'Northern BC', 'BC', 'B.C.'],
    'Whistler': ['Squamish', 'Pemberton', 'British Columbia', 'BC', 'B.C.'],
    'Tofino': ['Ucluelet', 'Port Alberni', 'British Columbia', 'Vancouver Island', 'BC', 'B.C.'],
    
    // Manitoba
    'Winnipeg': ['Headingley', 'East St. Paul', 'West St. Paul', 'Stonewall', 'Selkirk', 'Niverville', 'Manitoba', 'Southern Manitoba', 'MB'],
    'Brandon': ['Shilo', 'Carberry', 'Manitoba', 'Western Manitoba', 'MB'],
    'Thompson': ['Flin Flon', 'The Pas', 'Manitoba', 'Northern Manitoba', 'MB'],
    'Portage la Prairie': ['MacGregor', 'Manitoba', 'Southern Manitoba', 'MB'],
    'Steinbach': ['Niverville', 'Manitoba', 'Southern Manitoba', 'MB'],
    'Dauphin': ['Swan River', 'Manitoba', 'Western Manitoba', 'MB'],
    
    // New Brunswick
    'Fredericton': ['Oromocto', 'New Maryland', 'Hanwell', 'New Brunswick', 'NB', 'N.B.'],
    'Moncton': ['Dieppe', 'Riverview', 'Shediac', 'New Brunswick', 'NB', 'N.B.'],
    'Saint John': ['Rothesay', 'Quispamsis', 'Grand Bay-Westfield', 'New Brunswick', 'NB', 'N.B.'],
    'Bathurst': ['Beresford', 'Petit-Rocher', 'New Brunswick', 'NB', 'N.B.'],
    'Edmundston': ['Saint-Basile', 'New Brunswick', 'NB', 'N.B.'],
    'Miramichi': ['Chatham', 'Newcastle', 'New Brunswick', 'NB', 'N.B.'],
    
    // Newfoundland and Labrador
    'St. John\'s': ['Mount Pearl', 'Paradise', 'Conception Bay South', 'Portugal Cove-St. Philip\'s', 'Torbay', 'Newfoundland and Labrador', 'Newfoundland', 'NL', 'N.L.'],
    'Corner Brook': ['Deer Lake', 'Pasadena', 'Newfoundland and Labrador', 'Newfoundland', 'NL', 'N.L.'],
    'Gander': ['Appleton', 'Glenwood', 'Newfoundland and Labrador', 'Newfoundland', 'NL', 'N.L.'],
    'Grand Falls-Windsor': ['Bishop\'s Falls', 'Botwood', 'Newfoundland and Labrador', 'Newfoundland', 'NL', 'N.L.'],
    'Labrador City': ['Wabush', 'Churchill Falls', 'Newfoundland and Labrador', 'Labrador', 'NL', 'N.L.'],
    
    // Northwest Territories
    'Yellowknife': ['Behchoko', 'Dettah', 'Northwest Territories', 'NT', 'N.W.T.', 'NWT'],
    'Inuvik': ['Aklavik', 'Tuktoyaktuk', 'Northwest Territories', 'NT', 'N.W.T.', 'NWT'],
    'Hay River': ['Fort Smith', 'Enterprise', 'Northwest Territories', 'NT', 'N.W.T.', 'NWT'],
    'Fort Smith': ['Hay River', 'Northwest Territories', 'NT', 'N.W.T.', 'NWT'],
    
    // Nova Scotia
    'Halifax': ['Dartmouth', 'Bedford', 'Sackville', 'Cole Harbour', 'Eastern Passage', 'Timberlea', 'Waverley', 'Nova Scotia', 'NS', 'N.S.'],
    'Sydney': ['Glace Bay', 'North Sydney', 'Sydney Mines', 'New Waterford', 'Nova Scotia', 'NS', 'N.S.'],
    'Truro': ['Bible Hill', 'Salmon River', 'Valley', 'Nova Scotia', 'NS', 'N.S.'],
    'Dartmouth': ['Halifax', 'Cole Harbour', 'Eastern Passage', 'Nova Scotia', 'NS', 'N.S.'],
    'Yarmouth': ['Hebron', 'Arcadia', 'Nova Scotia', 'NS', 'N.S.'],
    'New Glasgow': ['Stellarton', 'Westville', 'Trenton', 'Pictou', 'Nova Scotia', 'NS', 'N.S.'],
    
    // Nunavut
    'Iqaluit': ['Apex', 'Nunavut', 'NU'],
    'Rankin Inlet': ['Chesterfield Inlet', 'Baker Lake', 'Nunavut', 'NU'],
    'Arviat': ['Whale Cove', 'Nunavut', 'NU'],
    'Baker Lake': ['Rankin Inlet', 'Chesterfield Inlet', 'Nunavut', 'NU'],
    'Cambridge Bay': ['Kugluktuk', 'Nunavut', 'NU'],
    
    // Ontario
    'Toronto': ['Mississauga', 'Brampton', 'Markham', 'Vaughan', 'Richmond Hill', 'Pickering', 'Ajax', 'Whitby', 'Oshawa', 'Oakville', 'Burlington', 'Hamilton', 'Ontario', 'Southern Ontario', 'Greater Toronto Area', 'GTA', 'ON'],
    'Ottawa': ['Gatineau', 'Kanata', 'Orleans', 'Nepean', 'Barrhaven', 'Gloucester', 'Ontario', 'Eastern Ontario', 'ON'],
    'Hamilton': ['Burlington', 'Stoney Creek', 'Ancaster', 'Dundas', 'Grimsby', 'Ontario', 'Southern Ontario', 'ON'],
    'London': ['St. Thomas', 'Strathroy', 'Dorchester', 'Ontario', 'Southwestern Ontario', 'ON'],
    'Windsor': ['LaSalle', 'Tecumseh', 'Lakeshore', 'Amherstburg', 'Ontario', 'Southwestern Ontario', 'ON'],
    'Sudbury': ['Lively', 'Azilda', 'Chelmsford', 'Val Caron', 'Ontario', 'Northern Ontario', 'ON'],
    'Thunder Bay': ['Shuniah', 'Oliver Paipoonge', 'Ontario', 'Northern Ontario', 'ON'],
    'Kingston': ['Gananoque', 'Napanee', 'Ontario', 'Eastern Ontario', 'ON'],
    'Niagara Falls': ['St. Catharines', 'Welland', 'Fort Erie', 'Niagara-on-the-Lake', 'Ontario', 'Southern Ontario', 'ON'],
    
    // Prince Edward Island
    'Charlottetown': ['Stratford', 'Cornwall', 'Summerside', 'Prince Edward Island', 'PEI', 'P.E.I.'],
    'Summerside': ['Kensington', 'Borden-Carleton', 'Prince Edward Island', 'PEI', 'P.E.I.'],
    'Stratford': ['Charlottetown', 'Prince Edward Island', 'PEI', 'P.E.I.'],
    'Cornwall': ['Charlottetown', 'Prince Edward Island', 'PEI', 'P.E.I.'],
    'Montague': ['Georgetown', 'Prince Edward Island', 'PEI', 'P.E.I.'],
    
    // Quebec
    'Montréal': ['Laval', 'Longueuil', 'Brossard', 'Saint-Lambert', 'Boucherville', 'Repentigny', 'Terrebonne', 'Blainville', 'Mirabel', 'Saint-Jerome', 'Quebec', 'Québec', 'Southern Quebec', 'QC'],
    'Montreal': ['Laval', 'Longueuil', 'Brossard', 'Saint-Lambert', 'Boucherville', 'Repentigny', 'Terrebonne', 'Blainville', 'Mirabel', 'Saint-Jerome', 'Quebec', 'Québec', 'Southern Quebec', 'QC'],
    'Québec': ['Levis', 'Ancienne-Lorette', 'Saint-Augustin-de-Desmaures', 'Beauport', 'Charlesbourg', 'Quebec', 'Québec', 'QC'],
    'Quebec City': ['Levis', 'Ancienne-Lorette', 'Saint-Augustin-de-Desmaures', 'Beauport', 'Charlesbourg', 'Quebec', 'Québec', 'QC'],
    'Laval': ['Montreal', 'Montréal', 'Terrebonne', 'Blainville', 'Boisbriand', 'Quebec', 'Québec', 'QC'],
    'Gatineau': ['Ottawa', 'Hull', 'Aylmer', 'Quebec', 'Québec', 'QC'],
    'Sherbrooke': ['Magog', 'Coaticook', 'Quebec', 'Québec', 'QC'],
    'Trois-Rivieres': ['Becancour', 'Shawinigan', 'Quebec', 'Québec', 'QC'],
    'Saguenay': ['Alma', 'Jonquiere', 'Chicoutimi', 'Quebec', 'Québec', 'QC'],
    'Lévis': ['Quebec City', 'Québec', 'Quebec', 'QC'],
    
    // Saskatchewan
    'Regina': ['Moose Jaw', 'Lumsden', 'White City', 'Pilot Butte', 'Balgonie', 'Saskatchewan', 'Southern Saskatchewan', 'SK'],
    'Saskatoon': ['Martensville', 'Warman', 'Osler', 'Saskatchewan', 'Central Saskatchewan', 'SK'],
    'Prince Albert': ['Shellbrook', 'Saskatchewan', 'Northern Saskatchewan', 'SK'],
    'Moose Jaw': ['Regina', 'Saskatchewan', 'Southern Saskatchewan', 'SK'],
    'Swift Current': ['Herbert', 'Saskatchewan', 'Southern Saskatchewan', 'SK'],
    'Yorkton': ['Melville', 'Saskatchewan', 'Eastern Saskatchewan', 'SK'],
    
    // Yukon
    'Whitehorse': ['Marsh Lake', 'Carcross', 'Yukon', 'Yukon Territory', 'YT'],
    'Dawson City': ['Mayo', 'Yukon', 'Yukon Territory', 'YT'],
    'Watson Lake': ['Upper Liard', 'Yukon', 'Yukon Territory', 'YT'],
    'Haines Junction': ['Destruction Bay', 'Yukon', 'Yukon Territory', 'YT']
  };
  
  // Get nearby regions for the user's region
  const nearbyRegions = regionMap[userRegion] || [];
  
  // Add the user's region to the list if not already included
  if (userRegion && !nearbyRegions.includes(userRegion)) {
    nearbyRegions.unshift(userRegion);
  }
  
  // Add province-level regions
  const provinces = [
    'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 
    'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 
    'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Québec',
    'Saskatchewan', 'Yukon'
  ];
  
  // Add province abbreviations
  const provinceAbbreviations = {
    'Alberta': ['AB'],
    'British Columbia': ['BC', 'B.C.'],
    'Manitoba': ['MB'],
    'New Brunswick': ['NB', 'N.B.'],
    'Newfoundland and Labrador': ['NL', 'N.L.'],
    'Northwest Territories': ['NT', 'N.W.T.', 'NWT'],
    'Nova Scotia': ['NS', 'N.S.'],
    'Nunavut': ['NU'],
    'Ontario': ['ON'],
    'Prince Edward Island': ['PEI', 'P.E.I.'],
    'Quebec': ['QC', 'Québec'],
    'Québec': ['QC', 'Quebec'],
    'Saskatchewan': ['SK'],
    'Yukon': ['YT', 'Yukon Territory']
  };
  
  // Add regional variations
  const regionalVariations = {
    'Alberta': ['Northern Alberta', 'Southern Alberta', 'Central Alberta', 'Eastern Alberta', 'Western Alberta'],
    'British Columbia': ['Northern BC', 'Southern BC', 'Central BC', 'Eastern BC', 'Western BC', 'Vancouver Island', 'Lower Mainland', 'Interior BC'],
    'Manitoba': ['Northern Manitoba', 'Southern Manitoba', 'Eastern Manitoba', 'Western Manitoba'],
    'Ontario': ['Northern Ontario', 'Southern Ontario', 'Eastern Ontario', 'Western Ontario', 'Central Ontario', 'Southwestern Ontario', 'Southeastern Ontario', 'Northwestern Ontario', 'Northeastern Ontario', 'Greater Toronto Area', 'GTA'],
    'Quebec': ['Northern Quebec', 'Southern Quebec', 'Eastern Quebec', 'Western Quebec', 'Central Quebec'],
    'Québec': ['Northern Quebec', 'Southern Quebec', 'Eastern Quebec', 'Western Quebec', 'Central Quebec'],
    'Saskatchewan': ['Northern Saskatchewan', 'Southern Saskatchewan', 'Eastern Saskatchewan', 'Western Saskatchewan']
  };
  
  // Add all relevant province variations
  for (const province of provinces) {
    if (nearbyRegions.includes(province)) {
      // Add abbreviations
      const abbrs = provinceAbbreviations[province] || [];
      for (const abbr of abbrs) {
        if (!nearbyRegions.includes(abbr)) {
          nearbyRegions.push(abbr);
        }
      }
      
      // Add regional variations
      const variations = regionalVariations[province] || [];
      for (const variation of variations) {
        if (!nearbyRegions.includes(variation)) {
          nearbyRegions.push(variation);
        }
      }
    }
  }
  
  return nearbyRegions;
};

/**
 * Gets variations of a province name for more flexible matching
 * @param {string} province - The province name
 * @returns {Array} Array of province name variations
 */
const getProvinceVariations = (province) => {
  if (!province) return [];
  
  const variations = [province];
  
  // Add common variations
  variations.push(`${province} Province`);
  
  // Add specific variations for each province
  switch (province) {
    case 'Alberta':
      variations.push('AB');
      variations.push('Northern Alberta');
      variations.push('Southern Alberta');
      variations.push('Central Alberta');
      variations.push('Eastern Alberta');
      variations.push('Western Alberta');
      break;
    case 'British Columbia':
      variations.push('BC');
      variations.push('B.C.');
      variations.push('Northern BC');
      variations.push('Southern BC');
      variations.push('Central BC');
      variations.push('Eastern BC');
      variations.push('Western BC');
      variations.push('Vancouver Island');
      variations.push('Lower Mainland');
      variations.push('Interior BC');
      break;
    case 'Manitoba':
      variations.push('MB');
      variations.push('Northern Manitoba');
      variations.push('Southern Manitoba');
      variations.push('Eastern Manitoba');
      variations.push('Western Manitoba');
      break;
    case 'New Brunswick':
      variations.push('NB');
      variations.push('N.B.');
      break;
    case 'Newfoundland and Labrador':
      variations.push('NL');
      variations.push('N.L.');
      variations.push('Newfoundland');
      variations.push('Labrador');
      break;
    case 'Northwest Territories':
      variations.push('NT');
      variations.push('N.W.T.');
      variations.push('NWT');
      break;
    case 'Nova Scotia':
      variations.push('NS');
      variations.push('N.S.');
      break;
    case 'Nunavut':
      variations.push('NU');
      break;
    case 'Ontario':
      variations.push('ON');
      variations.push('Northern Ontario');
      variations.push('Southern Ontario');
      variations.push('Eastern Ontario');
      variations.push('Western Ontario');
      variations.push('Central Ontario');
      variations.push('Southwestern Ontario');
      variations.push('Southeastern Ontario');
      variations.push('Northwestern Ontario');
      variations.push('Northeastern Ontario');
      variations.push('Greater Toronto Area');
      variations.push('GTA');
      break;
    case 'Prince Edward Island':
      variations.push('PEI');
      variations.push('P.E.I.');
      break;
    case 'Quebec':
      variations.push('QC');
      variations.push('Québec');
      variations.push('Northern Quebec');
      variations.push('Southern Quebec');
      variations.push('Eastern Quebec');
      variations.push('Western Quebec');
      variations.push('Central Quebec');
      break;
    case 'Saskatchewan':
      variations.push('SK');
      variations.push('Northern Saskatchewan');
      variations.push('Southern Saskatchewan');
      variations.push('Eastern Saskatchewan');
      variations.push('Western Saskatchewan');
      break;
    case 'Yukon':
      variations.push('YT');
      variations.push('Yukon Territory');
      break;
    default:
      break;
  }
  
  return variations;
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
 * Gets a base title from an alert title by removing status indicators
 * @param {string} title - The alert title
 * @returns {string} The base title without status indicators
 */
const getBaseTitle = (title) => {
  // Remove status indicators from the title
  return title.replace(/[\s-]+/g, ' ').trim();
};