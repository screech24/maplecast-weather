import axios from 'axios';

// Map of Canadian province names to Environment Canada region codes
const PROVINCE_TO_REGION_CODE = {
  'Alberta': 'ab',
  'British Columbia': 'bc',
  'Manitoba': 'mb',
  'New Brunswick': 'nb',
  'Newfoundland and Labrador': 'nl',
  'Northwest Territories': 'nt',
  'Nova Scotia': 'ns',
  'Nunavut': 'nu',
  'Ontario': 'on',
  'Prince Edward Island': 'pe',
  'Quebec': 'qc',
  'Saskatchewan': 'sk',
  'Yukon': 'yt'
};

// CORS proxies to try when fetching alerts
const CORS_PROXIES = [
  '', // Try direct access first
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/'
];

/**
 * Get the Environment Canada region code for a province
 * @param {string} province - The province name
 * @returns {string} The region code or a default
 */
export function getRegionCodeForProvince(province) {
  if (!province) return 'on'; // Default to Ontario if no province provided
  
  // Normalize the province name by removing case sensitivity and extra spaces
  const normalizedProvince = province.trim().toLowerCase();
  
  // Check for exact matches
  for (const [key, value] of Object.entries(PROVINCE_TO_REGION_CODE)) {
    if (key.toLowerCase() === normalizedProvince) {
      return value;
    }
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(PROVINCE_TO_REGION_CODE)) {
    if (normalizedProvince.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedProvince)) {
      return value;
    }
  }
  
  // Check for abbreviations
  const abbr = normalizedProvince.substring(0, 2);
  if (Object.values(PROVINCE_TO_REGION_CODE).includes(abbr)) {
    return abbr;
  }
  
  return 'on'; // Default to Ontario if no match found
}

/**
 * Get an array of region codes to try based on the user's location
 * @param {string} province - The province name
 * @returns {string[]} Array of region codes to try
 */
export function getRegionCodes(province) {
  const primaryCode = getRegionCodeForProvince(province);
  const codes = [primaryCode];
  
  // Add 'ca' (all of Canada) as a fallback
  if (primaryCode !== 'ca') {
    codes.push('ca');
  }
  
  return codes;
}

/**
 * Extract severity from alert title
 * @param {string} title - The alert title
 * @returns {string} The severity level
 */
export function getSeverityFromTitle(title) {
  if (!title) return 'Unknown';
  
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('warning')) return 'Severe';
  if (lowerTitle.includes('watch')) return 'Moderate';
  if (lowerTitle.includes('statement')) return 'Minor';
  if (lowerTitle.includes('advisory')) return 'Minor';
  if (lowerTitle.includes('ended')) return 'Past';
  
  return 'Unknown';
}

/**
 * Extract urgency from alert title
 * @param {string} title - The alert title
 * @returns {string} The urgency level
 */
export function getUrgencyFromTitle(title) {
  if (!title) return 'Unknown';
  
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('warning')) return 'Immediate';
  if (lowerTitle.includes('watch')) return 'Expected';
  if (lowerTitle.includes('statement')) return 'Future';
  if (lowerTitle.includes('advisory')) return 'Expected';
  if (lowerTitle.includes('ended')) return 'Past';
  
  return 'Unknown';
}

/**
 * Fetch weather alerts from Environment Canada
 * @param {Object} locationInfo - Object containing city and region
 * @returns {Promise<Array>} Array of alert objects
 */
export async function fetchWeatherAlerts(locationInfo) {
  if (!locationInfo || !locationInfo.region) {
    console.warn('No location info provided for fetching alerts');
    return [];
  }
  
  console.log(`Fetching weather alerts for ${locationInfo.city}, ${locationInfo.region}`);
  
  // Get region codes to try
  const regionCodes = getRegionCodes(locationInfo.region);
  let alerts = [];
  let fetchSucceeded = false;
  
  // Try each region code with each proxy
  for (const regionCode of regionCodes) {
    if (fetchSucceeded) break;
    
    const alertsUrl = `https://weather.gc.ca/rss/battleboard/${regionCode}_e.xml`;
    console.log(`Trying to fetch alerts from: ${alertsUrl}`);
    
    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = proxy ? `${proxy}${encodeURIComponent(alertsUrl)}` : alertsUrl;
        console.log(`Trying proxy: ${proxy ? proxy : 'direct access'}`);
        
        const response = await axios.get(proxyUrl, {
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'Cache-Control': 'no-cache'
          },
          timeout: 5000 // 5 second timeout
        });
        
        if (!response.data || response.data.trim() === '') {
          console.log(`Empty response from ${proxy}`);
          continue;
        }
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.data, 'text/xml');
        
        // Check if it's a valid XML document
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          console.log(`XML parsing error from ${proxy}`);
          continue;
        }
        
        // Extract alerts from the XML
        const items = xmlDoc.getElementsByTagName('item');
        
        if (items.length === 0) {
          console.log(`No alert items found in XML from ${proxy}`);
          continue;
        }
        
        console.log(`Found ${items.length} alert items from ${proxy}`);
        
        // Process each alert item
        const fetchedAlerts = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          const title = item.getElementsByTagName('title')[0]?.textContent || '';
          const description = item.getElementsByTagName('description')[0]?.textContent || '';
          const link = item.getElementsByTagName('link')[0]?.textContent || '';
          const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
          const guid = item.getElementsByTagName('guid')[0]?.textContent || '';
          
          // Skip if no title or description
          if (!title || !description) {
            continue;
          }
          
          // Create an alert object
          const alert = {
            id: guid || `${regionCode}-${Date.now()}-${i}`,
            title,
            description,
            summary: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
            link,
            sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            expires: null, // Not available in RSS
            severity: getSeverityFromTitle(title),
            urgency: getUrgencyFromTitle(title),
            certainty: 'Observed', // Default value
            sourceUrl: link
          };
          
          fetchedAlerts.push(alert);
        }
        
        if (fetchedAlerts.length > 0) {
          alerts = fetchedAlerts;
          fetchSucceeded = true;
          console.log(`Successfully fetched ${alerts.length} alerts from ${proxy}`);
          break;
        }
      } catch (error) {
        console.log(`Error fetching from ${proxy}:`, error.message);
      }
    }
  }
  
  // Try the local development proxy if other methods failed
  if (!fetchSucceeded && window.location.hostname === 'localhost') {
    try {
      console.log('Trying local development proxy for alerts');
      
      for (const regionCode of regionCodes) {
        const proxyUrl = `/proxy-api/weather-alerts?url=${encodeURIComponent(`https://weather.gc.ca/rss/battleboard/${regionCode}_e.xml`)}`;
        
        const response = await axios.get(proxyUrl, {
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'Cache-Control': 'no-cache'
          },
          timeout: 5000
        });
        
        if (!response.data || response.data.trim() === '') {
          continue;
        }
        
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(response.data, 'text/xml');
        
        // Check if it's a valid XML document
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          continue;
        }
        
        // Extract alerts from the XML
        const items = xmlDoc.getElementsByTagName('item');
        
        if (items.length === 0) {
          continue;
        }
        
        console.log(`Found ${items.length} alert items from local proxy`);
        
        // Process each alert item
        const fetchedAlerts = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          const title = item.getElementsByTagName('title')[0]?.textContent || '';
          const description = item.getElementsByTagName('description')[0]?.textContent || '';
          const link = item.getElementsByTagName('link')[0]?.textContent || '';
          const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
          const guid = item.getElementsByTagName('guid')[0]?.textContent || '';
          
          // Skip if no title or description
          if (!title || !description) {
            continue;
          }
          
          // Create an alert object
          const alert = {
            id: guid || `${regionCode}-${Date.now()}-${i}`,
            title,
            description,
            summary: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
            link,
            sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
            expires: null, // Not available in RSS
            severity: getSeverityFromTitle(title),
            urgency: getUrgencyFromTitle(title),
            certainty: 'Observed', // Default value
            sourceUrl: link
          };
          
          fetchedAlerts.push(alert);
        }
        
        if (fetchedAlerts.length > 0) {
          alerts = fetchedAlerts;
          fetchSucceeded = true;
          console.log(`Successfully fetched ${alerts.length} alerts from local proxy`);
          break;
        }
      }
    } catch (error) {
      console.log('Error fetching from local proxy:', error.message);
    }
  }
  
  // Filter alerts by relevance to the user's location
  return filterAlertsByLocation(alerts, locationInfo);
}

/**
 * Filter alerts by relevance to the user's location
 * @param {Array} alerts - Array of alert objects
 * @param {Object} locationInfo - Object containing city and region
 * @returns {Array} Filtered array of alert objects
 */
function filterAlertsByLocation(alerts, locationInfo) {
  if (!alerts || !locationInfo) {
    return [];
  }
  
  // For now, return all alerts since we don't have precise location filtering
  // In a real implementation, you would use geospatial calculations to filter alerts
  return alerts;
}

/**
 * Register for background sync to check for alerts periodically
 * @returns {Promise<boolean>} Whether registration was successful
 */
export async function registerAlertBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.log('Background sync not supported');
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Register for background sync
    await registration.sync.register('weather-alerts-sync');
    console.log('Registered for background sync');
    
    // Register for periodic sync if supported
    if ('periodicSync' in registration) {
      try {
        // Check for permission
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync',
        });
        
        if (status.state === 'granted') {
          // Register for periodic sync every 15 minutes (minimum allowed is usually 15 minutes)
          await registration.periodicSync.register('weather-alerts-periodic', {
            minInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
          });
          console.log('Registered for periodic background sync');
        } else {
          console.log('Periodic background sync permission not granted');
        }
      } catch (error) {
        console.error('Error registering for periodic background sync:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error registering for background sync:', error);
    return false;
  }
}

/**
 * Manually trigger a check for new alerts
 * @returns {Promise<Array>} Array of new alerts
 */
export async function checkForNewAlerts() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service worker not supported');
    return [];
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Create a promise that will resolve when we get a message from the service worker
    const messagePromise = new Promise((resolve) => {
      const messageHandler = (event) => {
        if (event.data && event.data.type === 'NEW_ALERTS') {
          navigator.serviceWorker.removeEventListener('message', messageHandler);
          resolve(event.data.alerts);
        }
      };
      
      navigator.serviceWorker.addEventListener('message', messageHandler);
      
      // Set a timeout to remove the listener if we don't get a response
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        resolve([]);
      }, 10000); // 10 second timeout
    });
    
    // Send a message to the service worker to check for alerts
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_ALERTS'
      });
    }
    
    // Wait for the response
    return await messagePromise;
  } catch (error) {
    console.error('Error checking for new alerts:', error);
    return [];
  }
} 