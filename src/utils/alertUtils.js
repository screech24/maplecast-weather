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
  'https://thingproxy.freeboard.io/fetch/', // Most reliable based on logs
  'https://corsproxy.io/?', // Good reliability
  'https://api.codetabs.com/v1/proxy?quest=', // Decent reliability
  'https://api.allorigins.win/raw?url=', // Backup option
  'https://cors.x2u.in/', // Last resort
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
 * @param {Object} locationInfo - Object containing city and region information
 * @returns {string[]} Array of region codes to try
 */
export function getRegionCodes(locationInfo) {
  if (!locationInfo || !locationInfo.region) {
    return ['ca']; // Default to all of Canada if no location info
  }

  const province = locationInfo.region.trim().toLowerCase();
  const city = locationInfo.city ? locationInfo.city.trim().toLowerCase() : '';

  // Map of provinces to their primary region codes
  const PROVINCE_TO_REGION_CODE = {
    'alberta': ['abrm'],
    'british columbia': ['bcrm'],
    'manitoba': ['mbrm'],
    'new brunswick': ['nb'],
    'newfoundland and labrador': ['nl'],
    'northwest territories': ['nt'],
    'nova scotia': ['ns'],
    'nunavut': ['nu'],
    'ontario': ['onrm'],
    'prince edward island': ['pei'],
    'quebec': ['qc'],
    'saskatchewan': ['skrm'],
    'yukon': ['yt']
  };

  // City-specific region codes
  const CITY_REGION_CODES = {
    'toronto': ['onrm96'],
    'ottawa': ['onrm97'],
    'hamilton': ['onrm96'],
    'london': ['onrm96'],
    'kingston': ['onrm95'],
    'windsor': ['onrm96'],
    'sudbury': ['onrm94'],
    'thunder bay': ['onrm93'],
    'montreal': ['qcrm1'],
    'quebec city': ['qcrm2'],
    'gatineau': ['qcrm3'],
    'vancouver': ['bcrm30'],
    'victoria': ['bcrm32'],
    'kelowna': ['bcrm3'],
    'calgary': ['abrm32'],
    'edmonton': ['abrm31'],
    'red deer': ['abrm33'],
    'lethbridge': ['abrm34'],
    'regina': ['skrm2'],
    'saskatoon': ['skrm1'],
    'winnipeg': ['mbrm9'],
    'halifax': ['ns1'],
    'fredericton': ['nb2'],
    'moncton': ['nb3'],
    "st. john's": ['nl3'],
    'charlottetown': ['pei2'],
    'yellowknife': ['nt1'],
    'whitehorse': ['yt10'],
    'iqaluit': ['nu1']
  };

  let codes = [];

  // Add city-specific code if available
  if (city) {
    for (const [cityName, cityCodes] of Object.entries(CITY_REGION_CODES)) {
      if (city.includes(cityName) || cityName.includes(city)) {
        codes.push(...cityCodes);
        break;
      }
    }
  }

  // Add province codes
  for (const [provinceName, provinceCodes] of Object.entries(PROVINCE_TO_REGION_CODE)) {
    if (province.includes(provinceName) || provinceName.includes(province)) {
      codes.push(...provinceCodes);
      break;
    }
  }

  // Add general codes
  if (!codes.includes('ca')) {
    codes.push('ca'); // Add Canada-wide alerts as fallback
  }

  // If no specific codes found, use defaults
  if (codes.length === 1 && codes[0] === 'ca') {
    codes.unshift('onrm96'); // Default to Southern Ontario
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
 * Parse XML response from Environment Canada
 * @param {string} xmlText - The XML text to parse
 * @param {string} regionCode - The region code being used
 * @returns {Array} Array of parsed alert objects
 */
function parseAlertXml(xmlText, regionCode) {
  if (!xmlText || xmlText.trim() === '') {
    console.log('Empty XML response');
    return [];
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      console.log('XML parsing error:', parseError.textContent);
      return [];
    }

    // Try to get items from both RSS and Atom formats
    let items = xmlDoc.getElementsByTagName('item'); // RSS format
    if (items.length === 0) {
      items = xmlDoc.getElementsByTagName('entry'); // Atom format
    }

    if (items.length === 0) {
      console.log('No alert items found in XML');
      return [];
    }

    console.log(`Found ${items.length} alert items`);

    const alerts = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        // Try both RSS and Atom tag names
        const title = item.getElementsByTagName('title')[0]?.textContent ||
                     item.querySelector('title')?.textContent || '';
                     
        const description = item.getElementsByTagName('description')[0]?.textContent ||
                          item.querySelector('content')?.textContent ||
                          item.querySelector('summary')?.textContent || '';
                          
        const link = item.getElementsByTagName('link')[0]?.textContent ||
                    item.querySelector('link')?.getAttribute('href') || '';
                    
        const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent ||
                       item.getElementsByTagName('published')[0]?.textContent ||
                       item.getElementsByTagName('updated')[0]?.textContent || '';
                       
        const guid = item.getElementsByTagName('guid')[0]?.textContent ||
                    item.getElementsByTagName('id')[0]?.textContent || '';

        // Skip if no title or description
        if (!title || !description) {
          console.log(`Skipping item ${i} due to missing title or description`);
          continue;
        }

        // Create an alert object
        const alert = {
          id: guid || `${regionCode}-${Date.now()}-${i}`,
          title: title.trim(),
          description: description.trim(),
          summary: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
          link: link.trim(),
          sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          expires: null, // Not available in RSS/Atom
          severity: getSeverityFromTitle(title),
          urgency: getUrgencyFromTitle(title),
          certainty: 'Observed', // Default value
          sourceUrl: link.trim()
        };

        alerts.push(alert);
      } catch (itemError) {
        console.log(`Error processing alert item ${i}:`, itemError);
        continue;
      }
    }

    return alerts;
  } catch (error) {
    console.log('Error parsing XML:', error);
    return [];
  }
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
  const regionCodes = getRegionCodes(locationInfo);
  let alerts = [];
  let fetchSucceeded = false;
  let allProxyErrors = []; // Track all proxy errors for better diagnostics

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
            'Cache-Control': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
          },
          timeout: 10000 // Increase timeout to 10 seconds
        });

        if (!response.data) {
          console.log(`Empty response from ${proxy}`);
          continue;
        }

        // Parse the XML response
        const fetchedAlerts = parseAlertXml(response.data, regionCode);

        if (fetchedAlerts.length > 0) {
          alerts = fetchedAlerts;
          fetchSucceeded = true;
          console.log(`Successfully fetched ${alerts.length} alerts from ${proxy}`);
          break;
        }
      } catch (error) {
        const errorMsg = `Error fetching from ${proxy}: ${error.message}`;
        console.log(errorMsg);
        allProxyErrors.push(errorMsg);
      }
    }
  }

  // Log all errors if no proxy succeeded
  if (!fetchSucceeded && allProxyErrors.length > 0) {
    console.error('All proxies failed with the following errors:', allProxyErrors);
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

  const city = locationInfo.city?.toLowerCase() || '';
  const region = locationInfo.region?.toLowerCase() || '';
  const lat = locationInfo.lat;
  const lon = locationInfo.lon;

  // Helper function to check if a location string contains a place name
  const containsPlace = (text, place) => {
    if (!text || !place) return false;
    const words = text.toLowerCase().split(/[\s,-]+/);
    return words.some(word => 
      place.includes(word) || 
      word.includes(place) ||
      // Check for common variations
      (word.endsWith('s') && place.includes(word.slice(0, -1))) ||
      (place.endsWith('s') && word.includes(place.slice(0, -1)))
    );
  };

  // Helper function to calculate distance between two points
  const getDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  return alerts.filter(alert => {
    const title = alert.title?.toLowerCase() || '';
    const description = alert.description?.toLowerCase() || '';
    const combinedText = `${title} ${description}`;

    // Check for exact city match
    if (city && containsPlace(combinedText, city)) {
      return true;
    }

    // Check for region/province match
    if (region && containsPlace(combinedText, region)) {
      return true;
    }

    // Check for nearby locations if coordinates are available
    if (lat && lon && alert.coordinates) {
      const distance = getDistance(lat, lon, alert.coordinates.lat, alert.coordinates.lon);
      // Consider alerts within 100km radius
      if (distance <= 100) {
        return true;
      }
    }

    // Include alerts that don't specify a location (likely region-wide)
    const hasLocationMention = /\b(in|at|near|around|area|region|vicinity)\b/i.test(combinedText);
    if (!hasLocationMention) {
      return true;
    }

    return false;
  });
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