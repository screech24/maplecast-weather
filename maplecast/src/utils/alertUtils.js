import axios from 'axios';
import {
  WEATHERBIT_API_KEY,
  WEATHERBIT_BASE_URL,
  SEVERITY_MAPPINGS,
  ALERT_CACHE_DURATION,
  REQUEST_INTERVAL
} from '../config/weatherbit';

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

// Cache for storing alerts
let alertsCache = {
  data: null,
  timestamp: null,
  lastRequestTime: null,
  locationKey: null // Add location key to track location changes
};

// Function to clear alerts cache
export const clearAlertsCache = () => {
  alertsCache = {
    data: null,
    timestamp: null,
    lastRequestTime: null,
    locationKey: null
  };
};

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
 * Get severity level from alert title
 * @param {string} title - Alert title
 * @returns {string} Severity level
 */
const getSeverityLevel = (title = '') => {
  for (const [key, value] of Object.entries(SEVERITY_MAPPINGS)) {
    if (title.includes(key)) {
      return value;
    }
  }
  return 'Minor';
};

/**
 * Format alert data from Weatherbit API
 * @param {Object} alert - Raw alert data from Weatherbit
 * @returns {Object} Formatted alert data
 */
const formatAlertData = (alert) => {
  // Skip French alerts (they usually contain "en vigueur", "vigilance", or "avertissement")
  if (alert.title.toLowerCase().includes('en vigueur') || 
      alert.title.toLowerCase().includes('vigilance') || 
      alert.title.toLowerCase().includes('avertissement')) {
    return null;
  }

  return {
    id: alert.alertid || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: alert.title,
    description: alert.description,
    summary: alert.description.substring(0, 200) + (alert.description.length > 200 ? '...' : ''),
    link: `https://weather.gc.ca/warnings/index_e.html`,
    sent: new Date(alert.effective_local).toISOString(),
    expires: new Date(alert.expires_local).toISOString(),
    severity: getSeverityLevel(alert.title),
    urgency: alert.urgency || 'Expected',
    certainty: alert.certainty || 'Likely',
    sourceUrl: `https://weather.gc.ca/warnings/index_e.html`
  };
};

/**
 * Check if we should make a new API request based on rate limiting
 * @returns {boolean}
 */
const shouldMakeRequest = () => {
  if (!alertsCache.lastRequestTime) return true;
  const timeSinceLastRequest = Date.now() - alertsCache.lastRequestTime;
  return timeSinceLastRequest >= REQUEST_INTERVAL;
};

/**
 * Check if cached data is still valid
 * @returns {boolean}
 */
const isCacheValid = (locationInfo) => {
  if (!alertsCache.data || !alertsCache.timestamp || !alertsCache.locationKey) return false;
  
  // Check if location has changed
  const locationKey = `${locationInfo.lat},${locationInfo.lon}`;
  if (locationKey !== alertsCache.locationKey) return false;
  
  const cacheAge = Date.now() - alertsCache.timestamp;
  return cacheAge < ALERT_CACHE_DURATION;
};

/**
 * Fetch weather alerts from Weatherbit API
 * @param {Object} locationInfo - Object containing lat and lon
 * @returns {Promise<Array>} Array of alert objects
 */
export async function fetchWeatherAlerts(locationInfo) {
  if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
    console.warn('No location coordinates provided for fetching alerts');
    return [];
  }

  const locationKey = `${locationInfo.lat},${locationInfo.lon}`;

  // Check cache first
  if (isCacheValid(locationInfo)) {
    console.log('Returning cached alerts');
    return alertsCache.data;
  }

  // Check rate limiting
  if (!shouldMakeRequest()) {
    console.log('Rate limit reached, returning cached data or empty array');
    return alertsCache.data || [];
  }

  try {
    const url = `${WEATHERBIT_BASE_URL}/alerts?lat=${locationInfo.lat}&lon=${locationInfo.lon}&key=${WEATHERBIT_API_KEY}`;
    const response = await axios.get(url);
    
    if (response.data && Array.isArray(response.data.alerts)) {
      // Filter out null values (French alerts) and format the alerts
      const formattedAlerts = response.data.alerts
        .map(alert => formatAlertData(alert))
        .filter(alert => alert !== null);
      
      // Update cache with new location key
      alertsCache.data = formattedAlerts;
      alertsCache.timestamp = Date.now();
      alertsCache.lastRequestTime = Date.now();
      alertsCache.locationKey = locationKey;
      
      return formattedAlerts;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching weather alerts:', error);
    return [];
  }
}

/**
 * Check for new alerts
 * @param {Object} locationInfo - Object containing lat and lon coordinates
 * @returns {Promise<Array>} Array of new alert objects
 */
export async function checkForNewAlerts(locationInfo) {
  // Only check if the app is active (document is visible)
  if (document.hidden) {
    console.log('App is not active, skipping alert check');
    return [];
  }

  try {
    if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
      console.log('No location coordinates available');
      return [];
    }

    const newAlerts = await fetchWeatherAlerts(locationInfo);
    const currentAlerts = alertsCache.data || [];

    // Find alerts that aren't in the current set
    const brandNewAlerts = newAlerts.filter(newAlert => 
      !currentAlerts.some(currentAlert => currentAlert.id === newAlert.id)
    );

    if (brandNewAlerts.length > 0) {
      console.log(`Found ${brandNewAlerts.length} new alerts`);
    }

    return brandNewAlerts;
  } catch (error) {
    console.error('Error checking for new alerts:', error);
    return [];
  }
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