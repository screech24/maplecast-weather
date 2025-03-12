import * as turf from '@turf/turf';
import axios from 'axios';

// List of CORS proxies to try in order
const corsProxies = [
  {
    url: 'https://api.allorigins.win/raw?url=',
    needsEncoding: true,
    extraHeaders: {}
  },
  {
    url: 'https://corsproxy.io/?',
    needsEncoding: true,
    extraHeaders: {}
  },
  {
    url: 'https://cors-anywhere.herokuapp.com/',
    needsEncoding: false,
    extraHeaders: {
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://weather.gc.ca'
    }
  }
];

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
 * Attempts to fetch a URL using multiple CORS proxies
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} A promise that resolves to the response data
 */
const fetchWithCorsProxy = async (url) => {
  let lastError = null;
  let attemptCount = 0;
  
  // Try direct fetch first with no-cors mode (might work in some browsers)
  try {
    debugLog(`Trying direct fetch with no-cors mode: ${url}`);
    const response = await fetch(url, {
      mode: 'no-cors',
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    // If we get here, the request didn't throw, but we can't read the response in no-cors mode
    debugLog('Direct fetch succeeded, but response cannot be read in no-cors mode');
  } catch (error) {
    debugLog(`Direct fetch failed: ${error.message}`);
  }
  
  // Try each proxy
  for (const proxy of corsProxies) {
    // Try each proxy up to 2 times with exponential backoff
    for (let attempt = 0; attempt < 2; attempt++) {
      attemptCount++;
      
      try {
        // Add a small delay between attempts to avoid overwhelming the proxies
        if (attemptCount > 1) {
          await new Promise(resolve => setTimeout(resolve, 500 * attemptCount));
        }
        
        // Construct the proxied URL
        const proxyUrl = proxy.needsEncoding 
          ? `${proxy.url}${encodeURIComponent(url)}`
          : `${proxy.url}${url}`;
        
        debugLog(`Trying CORS proxy: ${proxy.url} with URL: ${url} (attempt ${attempt + 1})`);
        
        // Try both axios and fetch to maximize chances of success
        try {
          // Try with axios first
          const response = await axios.get(proxyUrl, {
            timeout: 15000, // Increased timeout
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'X-Requested-With': 'XMLHttpRequest',
              ...proxy.extraHeaders
            }
          });
          
          if (response.data) {
            debugLog(`Successfully fetched data using proxy: ${proxy.url} with axios`);
            return response.data;
          }
        } catch (axiosError) {
          // If axios fails, try with fetch
          debugLog(`Axios failed, trying fetch: ${axiosError.message}`);
          
          const fetchResponse = await fetch(proxyUrl, {
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'X-Requested-With': 'XMLHttpRequest',
              ...proxy.extraHeaders
            }
          });
          
          if (fetchResponse.ok) {
            const data = await fetchResponse.text();
            debugLog(`Successfully fetched data using proxy: ${proxy.url} with fetch`);
            return data;
          } else {
            throw new Error(`Fetch failed with status: ${fetchResponse.status}`);
          }
        }
      } catch (error) {
        const errorMessage = error.response 
          ? `Status: ${error.response.status} - ${error.message}`
          : error.message;
          
        debugLog(`Proxy ${proxy.url} failed (attempt ${attempt + 1}): ${errorMessage}`);
        lastError = error;
        
        // If it's not a network error or timeout, don't retry this proxy
        if (error.response || error.code !== 'ECONNABORTED') {
          break;
        }
      }
    }
  }
  
  console.error('All CORS proxies failed after multiple attempts');
  throw lastError || new Error('All CORS proxies failed');
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
    // Since we know the correct date is 20250312, use it directly
    const knownDate = '20250312';
    debugLog(`Using known date: ${knownDate}`);
    
    let latestFolder = knownDate + '/';
    let directoryHtml = null;
    
    try {
      // Try to access the directory directly with the known date
      const url = `https://dd.weather.gc.ca/alerts/cap/${latestFolder}`;
      debugLog(`Trying to access directory: ${url}`);
      directoryHtml = await fetchWithCorsProxy(url);
      debugLog(`Successfully accessed directory for date: ${knownDate}`);
    } catch (error) {
      debugLog(`Could not access directory for date: ${knownDate}, trying directory listing approach...`);
      
      try {
        directoryHtml = await fetchWithCorsProxy('https://dd.weather.gc.ca/alerts/cap/');
        latestFolder = parseLatestFolder(directoryHtml);
        
        if (!latestFolder) {
          console.error('Could not find the latest alerts folder from directory listing');
          latestFolder = knownDate + '/'; // Fall back to known date
        }
      } catch (listingError) {
        console.error('Error fetching directory listing:', listingError.message);
      }
    }
    
    debugLog(`Using alerts folder: ${latestFolder}`);
    
    // Try direct approach first for faster results
    debugLog('Trying direct approach with known office codes first...');
    let allXmlFiles = await tryDirectOfficeApproach(latestFolder);
    
    // If direct approach didn't find any files, try directory navigation
    if (allXmlFiles.length === 0) {
      debugLog('No XML files found using direct approach. Trying directory navigation...');
      
      // Fetch the list of responsible office subdirectories
      const dateFolderUrl = `https://dd.weather.gc.ca/alerts/cap/${latestFolder}`;
      const officeFoldersHtml = await fetchWithCorsProxy(dateFolderUrl);
      
      // Extract office subdirectories
      const officeSubdirs = parseSubdirectories(officeFoldersHtml);
      debugLog(`Found ${officeSubdirs.length} office subdirectories:`, officeSubdirs);
      
      // For each office subdirectory, fetch the hour subdirectories
      allXmlFiles = [];
      
      // Limit the number of office subdirectories to process to avoid overwhelming the browser
      // We'll process up to 5 office subdirectories
      const officeSubdirsToProcess = officeSubdirs.slice(0, 5);
      
      for (const officeDir of officeSubdirsToProcess) {
        try {
          // Make sure we're using the correct path format
          const officeDirClean = officeDir.endsWith('/') ? officeDir : `${officeDir}/`;
          const officeFolderUrl = `${dateFolderUrl}/${officeDirClean}`;
          debugLog(`Fetching hour subdirectories from: ${officeFolderUrl}`);
          
          const hourFoldersHtml = await fetchWithCorsProxy(officeFolderUrl);
          const hourSubdirs = parseSubdirectories(hourFoldersHtml);
          
          debugLog(`Found ${hourSubdirs.length} hour subdirectories for office ${officeDirClean}:`, hourSubdirs);
          
          // For each hour subdirectory, fetch the XML files
          // We'll process up to 3 hour subdirectories per office to avoid overwhelming the browser
          const hourSubdirsToProcess = hourSubdirs.slice(0, 3);
          
          for (const hourDir of hourSubdirsToProcess) {
            try {
              // Make sure we're using the correct path format
              const hourDirClean = hourDir.endsWith('/') ? hourDir : `${hourDir}/`;
              const hourFolderUrl = `${officeFolderUrl}${hourDirClean}`;
              debugLog(`Fetching XML files from: ${hourFolderUrl}`);
              
              const xmlFilesHtml = await fetchWithCorsProxy(hourFolderUrl);
              const xmlFiles = parseXmlFilesList(xmlFilesHtml, `${latestFolder}${officeDirClean}${hourDirClean}`);
              
              debugLog(`Found ${xmlFiles.length} XML files in ${hourFolderUrl}`);
              allXmlFiles = allXmlFiles.concat(xmlFiles);
            } catch (error) {
              console.error(`Error fetching hour subdirectory ${hourDir}:`, error.message);
            }
          }
        } catch (error) {
          console.error(`Error fetching office subdirectory ${officeDir}:`, error.message);
        }
      }
    }
    
    debugLog(`Found a total of ${allXmlFiles.length} XML files`);
    
    // If we didn't find any XML files, fall back to test alerts
    if (allXmlFiles.length === 0) {
      debugLog('No XML files found. Falling back to test alerts.');
      return generateTestAlerts();
    }
    
    // Fetch and parse a sample of the XML files (limit to avoid overwhelming the browser)
    // Increase sample size to catch more alerts
    const alertsData = await fetchSampleAlerts(allXmlFiles, 30);
    
    // If we didn't get any valid alerts, fall back to test alerts
    if (alertsData.length === 0) {
      debugLog('No valid alerts parsed. Falling back to test alerts.');
      return generateTestAlerts();
    }
    
    // Deduplicate alerts to only keep the most recent version of each alert
    const deduplicatedAlerts = deduplicateAlerts(alertsData);
    debugLog(`Deduplicated alerts from ${alertsData.length} to ${deduplicatedAlerts.length}`);
    
    // If we're in development mode and still have no alerts, add test alerts
    if (isDevelopmentMode() && deduplicatedAlerts.length === 0) {
      debugLog('No alerts found. Adding test alerts for development mode.');
      return generateTestAlerts();
    }
    
    return deduplicatedAlerts;
  } catch (error) {
    console.error('Error fetching alerts:', error);
    
    // If we're in development mode, return test alerts
    if (isDevelopmentMode()) {
      debugLog('Error fetching alerts. Adding test alerts for development mode.');
      return generateTestAlerts();
    }
    
    return [];
  }
};

/**
 * Generates date strings for today and the past few days in YYYYMMDD format
 * @returns {Array<string>} Array of date strings
 */
const generateDateStrings = () => {
  const dates = [];
  const now = new Date();
  
  // Add today and the past 3 days
  for (let i = 0; i < 4; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    dates.push(`${year}${month}${day}`);
  }
  
  return dates;
};

/**
 * Try a direct approach with known office codes
 * @param {string} latestFolder - The latest date folder
 * @returns {Promise<Array>} A promise that resolves to an array of XML file URLs
 */
const tryDirectOfficeApproach = async (latestFolder) => {
  // List of known office codes based on Environment Canada documentation
  // CWUL is Quebec Storm Prediction Centre, prioritize this for Quebec locations
  const officeCodes = ['CWUL', 'CWAO', 'CWTO', 'CWEG', 'CWNT', 'CWWG', 'CWVR', 'CYQX', 'CWIS', 'CWHX', 'LAND', 'WATR'];
  
  // Get current hour in UTC (Environment Canada uses UTC)
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  // Create an array of hours to try, starting with the current hour and going backwards
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hour = (currentHour - i + 24) % 24; // Ensure we wrap around properly
    hours.push(hour.toString().padStart(2, '0'));
  }
  
  let allXmlFiles = [];
  
  // Try each office code with a few hours
  for (const officeCode of officeCodes) {
    // For Quebec office (CWUL), try more hours since we're focusing on Quebec
    const hoursToTry = officeCode === 'CWUL' ? hours.slice(0, 12) : hours.slice(0, 4);
    
    for (const hour of hoursToTry) {
      try {
        const url = `https://dd.weather.gc.ca/alerts/cap/${latestFolder}${officeCode}/${hour}/`;
        debugLog(`Trying direct URL: ${url}`);
        
        const xmlFilesHtml = await fetchWithCorsProxy(url);
        const xmlFiles = parseXmlFilesList(xmlFilesHtml, `${latestFolder}${officeCode}/${hour}/`);
        
        debugLog(`Found ${xmlFiles.length} XML files in ${url}`);
        allXmlFiles = allXmlFiles.concat(xmlFiles);
        
        // If we found files for Quebec office, prioritize these
        if (xmlFiles.length > 0 && officeCode === 'CWUL') {
          debugLog('Found alerts from Quebec Storm Prediction Centre, prioritizing these');
          // Don't return immediately, collect more files from CWUL
          if (allXmlFiles.length >= 30) {
            debugLog('Found enough alerts from CWUL, stopping search');
            return allXmlFiles;
          }
        }
        
        // If we found files for other offices, continue but check a few more
        if (xmlFiles.length > 0 && allXmlFiles.length >= 40) {
          debugLog('Found enough alerts, stopping search');
          return allXmlFiles;
        }
      } catch (error) {
        // Silently continue, as many combinations might not exist
      }
    }
  }
  
  // If we couldn't find any files using the directory approach, try direct file access
  if (allXmlFiles.length === 0) {
    debugLog('No files found using directory approach. Trying direct file access...');
    
    // Try some known file patterns for Quebec alerts
    const knownPatterns = [
      // CWUL (Quebec Storm Prediction Centre) patterns
      `${latestFolder}CWUL/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/00/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/00/LAND-WXO-LAND_WX-FW-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/06/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/12/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWUL/18/LAND-WXO-LAND_WX-WW-12.0.1.0.1.0.cap`,
      
      // CWAO (Montreal) patterns
      `${latestFolder}CWAO/00/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWAO/06/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWAO/12/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`,
      `${latestFolder}CWAO/18/LAND-WXO-LAND_WX-WA-12.0.1.0.1.0.cap`
    ];
    
    for (const pattern of knownPatterns) {
      try {
        const url = `https://dd.weather.gc.ca/alerts/cap/${pattern}`;
        debugLog(`Trying direct file access: ${url}`);
        
        const xmlData = await fetchWithCorsProxy(url);
        const alert = parseCAP(xmlData, url);
        
        if (alert) {
          debugLog(`Successfully parsed alert from direct file access: ${alert.title}`);
          allXmlFiles.push(url);
        }
      } catch (error) {
        // Silently continue, as many files might not exist
      }
    }
  }
  
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
      const xmlData = await fetchWithCorsProxy(fileUrl);
      const alert = parseCAP(xmlData, fileUrl);
      
      if (!alert) {
        console.error(`Failed to parse alert from ${fileUrl}`);
        return null;
      }
      
      return alert;
    } catch (error) {
      console.error(`Error fetching alert file ${fileUrl}:`, error.message);
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
      // This is a more generic approach that works for any location, not just Lévis
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
  // Quebec City and Lévis area
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
  
  // Add more regions as needed
  
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
  
  // Add more regions as needed
  
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
  
  // If we're in development mode and no alerts were found, add test alerts
  if (isDevelopmentMode() && relevantAlerts.length === 0) {
    debugLog('No real alerts found. Adding test alerts for development mode.');
    return generateTestAlerts();
  }
  
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
 * Generates test alerts for development mode
 * @returns {Array} An array of test alert objects
 */
const generateTestAlerts = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Create more realistic test alerts with current dates
  return [
    {
      id: 'test-alert-1-' + Date.now(),
      title: 'Avertissement de gel éclair en vigueur',
      description: 'Un avertissement de gel éclair est en vigueur pour la région de Lévis et Québec. Les températures chuteront rapidement ce soir, créant des conditions de gel sur les routes.\n\nSoyez prudent lors de vos déplacements car les surfaces mouillées pourraient geler et devenir glissantes.',
      severity: 'Moderate',
      urgency: 'Expected',
      certainty: 'Likely',
      effective: now.toISOString(),
      expires: tomorrow.toISOString(),
      sent: now.toISOString(),
      areas: [
        {
          description: 'Ville de Lévis',
          polygon: [
            [-71.3, 46.7],
            [-71.1, 46.7],
            [-71.1, 46.9],
            [-71.3, 46.9],
            [-71.3, 46.7]
          ],
          circle: null
        }
      ],
      sourceUrl: 'http://dd.weather.gc.ca/alerts/cap/test_alert_1.cap'
    },
    {
      id: 'test-alert-2-' + Date.now(),
      title: 'Veille de tempête hivernale',
      description: 'Une veille de tempête hivernale est en vigueur pour la région de Québec, incluant Lévis. Une accumulation de 15 à 25 cm de neige est prévue à partir de demain matin.\n\nPréparez-vous à des conditions de déplacement difficiles. Envisagez de reporter les déplacements non essentiels.',
      severity: 'Severe',
      urgency: 'Expected',
      certainty: 'Possible',
      effective: now.toISOString(),
      expires: tomorrow.toISOString(),
      sent: now.toISOString(),
      areas: [
        {
          description: 'Région de Québec et Lévis',
          polygon: null,
          circle: {
            center: [-71.2, 46.8],
            radius: 30
          }
        }
      ],
      sourceUrl: 'http://dd.weather.gc.ca/alerts/cap/test_alert_2.cap'
    },
    {
      id: 'test-alert-3-' + Date.now(),
      title: 'Avertissement de pluie verglaçante',
      description: 'Un avertissement de pluie verglaçante est en vigueur pour la région de Chaudière-Appalaches, incluant Lévis. On prévoit de 2 à 5 mm de pluie verglaçante ce soir.\n\nLes surfaces comme les routes, les rues, les trottoirs et les terrains de stationnement deviendront glacées, glissantes et extrêmement dangereuses.',
      severity: 'Severe',
      urgency: 'Immediate',
      certainty: 'Observed',
      effective: now.toISOString(),
      expires: tomorrow.toISOString(),
      sent: now.toISOString(),
      areas: [
        {
          description: 'Chaudière-Appalaches',
          polygon: null,
          circle: {
            center: [-71.0, 46.8],
            radius: 50
          }
        }
      ],
      sourceUrl: 'http://dd.weather.gc.ca/alerts/cap/test_alert_3.cap'
    }
  ];
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