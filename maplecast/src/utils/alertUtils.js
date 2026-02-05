/**
 * Weather Alerts Utility
 * Fetches and manages weather alerts from Environment Canada
 */

import { fetchWeatherAlerts as fetchECAlerts } from './environmentCanadaApi';

// Map of Canadian province names to region codes
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

// Cache for storing alerts
let alertsCache = {
  data: null,
  timestamp: null,
  lastRequestTime: null,
  locationKey: null,
  alertHashes: new Set() // Track alert IDs to detect changes
};

// Cache duration: 1 minute (refresh alerts frequently)
const ALERT_CACHE_DURATION = 1 * 60 * 1000;

// Request interval: 30 seconds minimum between requests (more responsive)
const REQUEST_INTERVAL = 30 * 1000;

/**
 * Clear the alerts cache
 */
export const clearAlertsCache = () => {
  const oldCache = { ...alertsCache };
  alertsCache = {
    data: null,
    timestamp: null,
    lastRequestTime: null,
    locationKey: null,
    alertHashes: new Set()
  };
  console.log('🗑️ ALERTS CACHE CLEARED. Previous cache:', oldCache);
};

/**
 * Get region code from province name
 * @param {string} province - Province name or abbreviation
 * @returns {string} Region code
 */
export function getRegionCodeForProvince(province) {
  if (!province) return 'ca'; // Default to all of Canada

  // Normalize the province name
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

  return 'ca'; // Default to all of Canada
}

/**
 * Check if we should make a new API request based on rate limiting
 * @returns {boolean}
 */
const shouldMakeRequest = () => {
  if (!alertsCache.lastRequestTime) return true;
  const timeSinceLastRequest = Date.now() - alertsCache.lastRequestTime;
  const shouldRequest = timeSinceLastRequest >= REQUEST_INTERVAL;
  console.log(`Rate limiting check: time since last request ${Math.round(timeSinceLastRequest/1000)}s, should request: ${shouldRequest}`);
  return shouldRequest;
};

/**
 * Check if cached data is still valid
 * @param {Object} locationInfo - Location information
 * @returns {boolean}
 */
const isCacheValid = (locationInfo) => {
  if (!alertsCache.data || !alertsCache.timestamp || !alertsCache.locationKey) {
    return false;
  }

  // Check if location has changed (use consistent key format)
  const locationKey = locationInfo.lat && locationInfo.lon
    ? `${locationInfo.lat},${locationInfo.lon}`
    : 'unknown';

  console.log(`🔍 Cache check - current key: ${locationKey}, cached key: ${alertsCache.locationKey}`);

  if (locationKey !== alertsCache.locationKey) {
    console.log('📍 Location changed, cache invalid');
    return false;
  }

  // Check cache age
  const cacheAge = Date.now() - alertsCache.timestamp;
  const isValid = cacheAge < ALERT_CACHE_DURATION;

  if (!isValid) {
    console.log(`Cache expired (age: ${Math.round(cacheAge / 1000)}s)`);
  }

  return isValid;
};

/**
 * Generate a hash for an alert to detect changes
 */
function generateAlertHash(alert) {
  return `${alert.title}_${alert.sent}_${alert.severity}`;
}

/**
 * Fetch weather alerts from Environment Canada
 * @param {Object} locationInfo - Location info with lat/lon and region/province
 * @returns {Promise<Array>} Array of alert objects
 */
export async function fetchWeatherAlerts(locationInfo) {
  if (!locationInfo) {
    console.warn('No location info provided for fetching alerts');
    return [];
  }

  // Determine location key for caching
  const locationKey = locationInfo.lat && locationInfo.lon
    ? `${locationInfo.lat},${locationInfo.lon}`
    : 'unknown';

  console.log(`🚨 FETCHING ALERTS for location: ${locationKey}`, locationInfo);

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
    let allAlerts = [];

    // Get province code
    const provinceCode = locationInfo.state || locationInfo.region
      ? getRegionCodeForProvince(locationInfo.state || locationInfo.region)
      : 'ca';

    // Get location name for filtering
    const locationName = locationInfo.name || locationInfo.city || null;

    console.log(`Fetching EC alerts for province: ${provinceCode}, location: ${locationName}`);

    // Fetch alerts from Environment Canada
    if (locationInfo.lat && locationInfo.lon && provinceCode !== 'ca') {
      try {
        const weatherAlerts = await fetchECAlerts(
          provinceCode,
          locationInfo.lat,
          locationInfo.lon,
          locationName  // Pass location name for area filtering
        );
        allAlerts = allAlerts.concat(weatherAlerts);
        console.log(`EC API returned ${weatherAlerts.length} alerts for ${locationName}`);
      } catch (error) {
        console.log('Weather alerts failed:', error.message);
      }
    } else if (provinceCode === 'ca') {
      console.log('Province not detected, skipping alert fetch');
    }

    // No fallback alerts - only show real Environment Canada alerts
    if (allAlerts.length === 0) {
      console.log('No active weather alerts for this area');
    }

    // Remove duplicates based on title
    const uniqueAlerts = allAlerts.filter((alert, index, self) =>
      index === self.findIndex((a) => a.title === alert.title)
    );

    // Filter out expired alerts
    const activeAlerts = uniqueAlerts.filter(alert => {
      if (!alert.expires) return true;
      return new Date(alert.expires) > new Date();
    });

    // Sort by severity (Severe first)
    const severityOrder = { 'Severe': 0, 'Moderate': 1, 'Minor': 2 };
    activeAlerts.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

    console.log(`Returning ${activeAlerts.length} active alerts for ${locationKey}`);

    // Update cache
    alertsCache.data = activeAlerts;
    alertsCache.timestamp = Date.now();
    alertsCache.lastRequestTime = Date.now();
    alertsCache.locationKey = locationKey;

    // Update alert hashes
    alertsCache.alertHashes = new Set(activeAlerts.map(generateAlertHash));

    console.log(`✅ ALERTS CACHED: ${activeAlerts.length} alerts for ${locationKey}`);

    return activeAlerts;

  } catch (error) {
    console.error('Error fetching weather alerts from all sources:', error);

    // Return cached data if available, otherwise empty array
    if (alertsCache.data && alertsCache.data.length > 0) {
      console.log('Returning cached alerts due to error');
      return alertsCache.data;
    }

    return [];
  }
}

/**
 * Check for new alerts and return only new or updated ones
 * @param {Object} locationInfo - Location information
 * @returns {Promise<Object>} Object with newAlerts and updatedAlerts arrays
 */
export async function checkForNewAlerts(locationInfo) {
  // Only check if the app is active (document is visible)
  if (document.hidden) {
    console.log('App is not active, skipping alert check');
    return { newAlerts: [], updatedAlerts: [], removedAlerts: [] };
  }

  try {
    if (!locationInfo) {
      console.log('No location info available');
      return { newAlerts: [], updatedAlerts: [], removedAlerts: [] };
    }

    // Store previous alert hashes
    const previousHashes = new Set(alertsCache.alertHashes);
    const previousAlerts = alertsCache.data || [];

    // Force a fresh fetch
    alertsCache.timestamp = null;

    const freshAlerts = await fetchWeatherAlerts(locationInfo);

    const newAlerts = [];
    const updatedAlerts = [];
    const removedAlerts = [];

    // Check for new alerts
    for (const alert of freshAlerts) {
      const hash = generateAlertHash(alert);
      if (!previousHashes.has(hash)) {
        // Check if there was an alert with the same title (updated)
        const existingAlert = previousAlerts.find(a => a.title === alert.title);
        if (existingAlert) {
          updatedAlerts.push(alert);
        } else {
          newAlerts.push(alert);
        }
      }
    }

    // Check for removed alerts
    const currentTitles = new Set(freshAlerts.map(a => a.title));
    for (const prevAlert of previousAlerts) {
      if (!currentTitles.has(prevAlert.title)) {
        removedAlerts.push(prevAlert);
      }
    }

    if (newAlerts.length > 0) {
      console.log(`Found ${newAlerts.length} new alerts`);
    }
    if (updatedAlerts.length > 0) {
      console.log(`Found ${updatedAlerts.length} updated alerts`);
    }
    if (removedAlerts.length > 0) {
      console.log(`Found ${removedAlerts.length} removed alerts`);
    }

    return { newAlerts, updatedAlerts, removedAlerts };
  } catch (error) {
    console.error('Error checking for new alerts:', error);
    return { newAlerts: [], updatedAlerts: [], removedAlerts: [] };
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
          // Register for periodic sync every 5 minutes
          await registration.periodicSync.register('weather-alerts-periodic', {
            minInterval: 5 * 60 * 1000,
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
 * Get region codes to try based on location
 * @param {Object} locationInfo - Location information
 * @returns {string[]} Array of region codes to try
 */
export function getRegionCodes(locationInfo) {
  if (!locationInfo || !locationInfo.region) {
    return ['ca']; // Default to all of Canada
  }

  const regionCode = getRegionCodeForProvince(locationInfo.region);
  return [regionCode, 'ca']; // Try specific region first, then all of Canada
}

const alertUtils = {
  fetchWeatherAlerts,
  checkForNewAlerts,
  registerAlertBackgroundSync,
  getRegionCodeForProvince,
  getRegionCodes,
  clearAlertsCache
};

export default alertUtils;
