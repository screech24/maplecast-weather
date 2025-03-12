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
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'Cache-Control': 'no-cache'
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error text available');
      
      // Only log errors if not suppressed (and not for 404s when suppressed)
      if (!suppressErrors || (response.status !== 404 && !suppressErrors)) {
        console.error(`Proxy returned status: ${response.status}`, errorText.substring(0, 200));
      }
      
      throw new Error(`Proxy returned status: ${response.status}`);
    }
    
    const data = await response.text();
    debugLog('Successfully fetched data from proxy');
    return data;
  } catch (error) {
    // Only log errors if not suppressed
    if (!suppressErrors) {
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
        latestFolder = folderToTry;
        debugLog(`Successfully accessed directory for date: ${dateString}`);
        break;
      } catch (error) {
        debugLog(`Could not access directory for date: ${dateString}, trying next date...`);
      }
    }
    
    // If we couldn't find a valid date folder, try directory listing approach
    if (!latestFolder) {
      debugLog('No valid date folders found, trying directory listing approach...');
      
      try {
        directoryHtml = await fetchFromProxy('', true);
        latestFolder = parseLatestFolder(directoryHtml);
        
        if (!latestFolder) {
          console.error('Could not find the latest alerts folder from directory listing');
          // Fall back to today's date
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          latestFolder = `${year}${month}${day}/`;
          debugLog(`Falling back to today's date: ${latestFolder}`);
        }
      } catch (listingError) {
        console.error('Error fetching directory listing:', listingError.message);
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
    
    // Try direct approach first for faster results
    debugLog('Trying direct approach with known office codes first...');
    let allXmlFiles = await tryDirectOfficeApproach(latestFolder);
    
    // If direct approach didn't find any files, try directory navigation
    if (allXmlFiles.length === 0) {
      debugLog('No XML files found using direct approach. Trying directory navigation...');
      
      try {
        // Get subdirectories (office codes) - suppress errors for 404s
        const subdirectoriesHtml = await fetchFromProxy(latestFolder, true);
        const subdirectories = parseSubdirectories(subdirectoriesHtml);
        
        debugLog(`Found ${subdirectories.length} subdirectories in ${latestFolder}`);
        
        // For each subdirectory, try to get XML files
        for (const subdir of subdirectories) {
          try {
            const subdirPath = `${latestFolder}${subdir}/`;
            const subdirHtml = await fetchFromProxy(subdirPath, true);
            
            // Look for hour directories
            const hourDirs = parseSubdirectories(subdirHtml);
            
            for (const hourDir of hourDirs) {
              try {
                const hourPath = `${subdirPath}${hourDir}/`;
                const hourHtml = await fetchFromProxy(hourPath, true);
                
                // Get XML files in this hour directory
                const xmlFiles = parseXmlFilesList(hourHtml, hourPath);
                allXmlFiles = allXmlFiles.concat(xmlFiles);
                
                // If we found enough files, stop searching
                if (allXmlFiles.length >= 20) {
                  debugLog('Found enough XML files, stopping search');
                  break;
                }
              } catch (hourError) {
                debugLog(`Error accessing hour directory ${hourDir}: ${hourError.message}`);
              }
            }
            
            // If we found enough files, stop searching
            if (allXmlFiles.length >= 20) {
              break;
            }
          } catch (subdirError) {
            debugLog(`Error accessing subdirectory ${subdir}: ${subdirError.message}`);
          }
        }
      } catch (navigationError) {
        console.error('Error during directory navigation:', navigationError.message);
      }
    }
    
    // If we still couldn't find any files, try hardcoded sample alerts for testing
    if (allXmlFiles.length === 0) {
      debugLog('No CAP alert files found after all attempts, using hardcoded sample alerts for testing');
      
      // Create a sample alert for testing purposes
      const sampleAlert = {
        identifier: 'sample-alert-1',
        sent: new Date().toISOString(),
        status: 'Actual',
        msgType: 'Alert',
        scope: 'Public',
        info: {
          category: 'Met',
          event: 'Weather Warning',
          urgency: 'Expected',
          severity: 'Moderate',
          certainty: 'Likely',
          effective: new Date().toISOString(),
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          headline: 'Sample Weather Warning for Testing',
          description: 'This is a sample weather warning created for testing purposes when no real alerts are available.',
          instruction: 'No action required. This is only a test alert.',
          parameter: [
            { valueName: 'layer:EC-MSC-SMC:1.0:Alert_Type', value: 'warning' },
            { valueName: 'layer:EC-MSC-SMC:1.0:Alert_Name', value: 'weather_warning' }
          ],
          area: {
            areaDesc: 'Sample Test Area',
            polygon: '45.5,-75.0 45.5,-74.0 45.0,-74.0 45.0,-75.0 45.5,-75.0'
          }
        }
      };
      
      return [sampleAlert];
    }
    
    // Fetch a sample of alerts to avoid overwhelming the browser
    const sampleSize = Math.min(allXmlFiles.length, 30);
    const alerts = await fetchSampleAlerts(allXmlFiles, sampleSize);
    
    console.log(`Fetched ${alerts.length} CAP alerts`);
    
    // If we got alerts, deduplicate them
    if (alerts.length > 0) {
      const deduplicatedAlerts = deduplicateAlerts(alerts);
      debugLog(`Deduplicating ${alerts.length} alerts`);
      return deduplicatedAlerts;
    }
    
    return alerts;
  } catch (error) {
    console.error('Error fetching CAP alerts:', error.message);
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
 * Try a direct approach with known office codes
 * @param {string} latestFolder - The latest date folder
 * @returns {Promise<Array>} A promise that resolves to an array of XML file URLs
 */
const tryDirectOfficeApproach = async (latestFolder) => {
  const allXmlFiles = [];
  let errorCount = 0;
  
  // Try known file patterns for alerts across Canada
  const knownPatterns = [
    // CWUL (Quebec Storm Prediction Centre) patterns
    `${latestFolder}CWUL/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWUL/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    
    // CWAO (Montreal) patterns
    `${latestFolder}CWAO/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWAO/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    
    // CWTO (Ontario Storm Prediction Centre) patterns
    `${latestFolder}CWTO/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWTO/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    
    // CWVR (Pacific Storm Prediction Centre - BC) patterns
    `${latestFolder}CWVR/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWVR/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    
    // CWWG (Prairie Storm Prediction Centre - MB, SK, AB) patterns
    `${latestFolder}CWWG/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWWG/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    
    // CWHX (Atlantic Storm Prediction Centre - NS, NB, PEI, NL) patterns
    `${latestFolder}CWHX/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
    `${latestFolder}CWHX/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`
  ];
  
  // Process patterns in batches to avoid overwhelming the browser
  const batchSize = 3;
  for (let i = 0; i < knownPatterns.length; i += batchSize) {
    const batch = knownPatterns.slice(i, i + batchSize);
    
    // Process each batch in parallel
    const batchPromises = batch.map(async (pattern) => {
      try {
        const path = pattern;
        debugLog(`Trying direct file access: ${path}`);
        
        // Use suppressErrors=true to avoid console spam for 404s
        const xmlData = await fetchFromProxy(path, true);
        const alert = parseCAP(xmlData, path);
        
        if (alert) {
          debugLog(`Successfully parsed alert from direct file access: ${alert.title}`);
          return `https://dd.weather.gc.ca/alerts/cap/${path}`;
        }
      } catch (error) {
        // Silently continue, as many files might not exist
        debugLog(`Error with direct file access to ${pattern}: ${error.message}`);
      }
      return null;
    });
    
    const results = await Promise.all(batchPromises);
    const validFiles = results.filter(file => file !== null);
    allXmlFiles.push(...validFiles);
  }
  
  console.log(`Found a total of ${allXmlFiles.length} alert files`);
  return allXmlFiles;
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
  if (!userLocation || !alert || !alert.areas || alert.areas.length === 0) {
    debugLog('Missing required data for location check:', { 
      hasUserLocation: !!userLocation, 
      hasAlert: !!alert, 
      hasAreas: !!(alert && alert.areas), 
      areasLength: alert && alert.areas ? alert.areas.length : 0 
    });
    return false;
  }
  
  debugLog(`Checking if location (${userLocation.latitude}, ${userLocation.longitude}) is affected by alert: ${alert.title}`);
  
  const userPoint = turf.point([userLocation.longitude, userLocation.latitude]);
  
  // Check each area in the alert
  return alert.areas.some(area => {
    // Check polygon
    if (area.polygon) {
      try {
        // Create a polygon from the coordinates
        // Note: turf.polygon expects an array of linear rings, so we need to wrap our coordinates
        const alertPolygon = turf.polygon([area.polygon]);
        const isInPolygon = turf.booleanPointInPolygon(userPoint, alertPolygon);
        debugLog(`Area: ${area.description}, Polygon check: ${isInPolygon}`);
        return isInPolygon;
      } catch (error) {
        console.error('Error checking polygon:', error);
        debugLog('Polygon data that caused the error:', area.polygon);
        return false;
      }
    }
    
    // Check circle
    if (area.circle) {
      try {
        const centerPoint = turf.point(area.circle.center);
        const distance = turf.distance(userPoint, centerPoint, { units: 'kilometers' });
        const isInCircle = distance <= area.circle.radius;
        debugLog(`Area: ${area.description}, Circle check: distance=${distance}km, radius=${area.circle.radius}km, isInCircle=${isInCircle}`);
        return isInCircle;
      } catch (error) {
        console.error('Error checking circle:', error);
        debugLog('Circle data that caused the error:', area.circle);
        return false;
      }
    }
    
    // If we have the area description but no polygon or circle data,
    // try to match by name for common areas
    if (area.description) {
      const areaLower = area.description.toLowerCase();
      
      // Check if the user's location is in an area mentioned in the alert
      const userRegion = getRegionFromCoordinates(userLocation);
      if (userRegion && areaLower.includes(userRegion.toLowerCase())) {
        debugLog(`Area: ${area.description} matches user's region: ${userRegion}`);
        return true;
      }
      
      // Check for nearby regions that might affect the user
      const nearbyRegions = getNearbyRegions(userLocation);
      for (const region of nearbyRegions) {
        if (areaLower.includes(region.toLowerCase())) {
          debugLog(`Area: ${area.description} matches nearby region: ${region}`);
          return true;
        }
      }
    }
    
    debugLog(`Area: ${area.description} has no polygon or circle data and no name match`);
    return false;
  });
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