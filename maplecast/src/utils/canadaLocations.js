import { devLog, debugLog } from './devMode';
import axios from 'axios';

// Canadian provinces mapping
export const CANADIAN_PROVINCES = {
  'ON': 'Ontario',
  'QC': 'Quebec',
  'BC': 'British Columbia',
  'AB': 'Alberta',
  'MB': 'Manitoba',
  'SK': 'Saskatchewan',
  'NS': 'Nova Scotia',
  'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador',
  'PE': 'Prince Edward Island',
  'YT': 'Yukon',
  'NT': 'Northwest Territories',
  'NU': 'Nunavut'
};

// Province bounding boxes (approximate) for coordinate-based detection
// Format: { minLat, maxLat, minLon, maxLon }
const PROVINCE_BOUNDS = [
  { code: 'BC', name: 'British Columbia', minLat: 48.3, maxLat: 60, minLon: -139, maxLon: -114.05 },
  { code: 'AB', name: 'Alberta', minLat: 49, maxLat: 60, minLon: -120, maxLon: -110 },
  { code: 'SK', name: 'Saskatchewan', minLat: 49, maxLat: 60, minLon: -110, maxLon: -101.5 },
  { code: 'MB', name: 'Manitoba', minLat: 49, maxLat: 60, minLon: -102, maxLon: -89 },
  { code: 'ON', name: 'Ontario', minLat: 41.7, maxLat: 56.9, minLon: -95.2, maxLon: -74.3 },
  { code: 'QC', name: 'Quebec', minLat: 45, maxLat: 62.6, minLon: -79.8, maxLon: -57 },
  { code: 'NB', name: 'New Brunswick', minLat: 44.6, maxLat: 48, minLon: -69, maxLon: -63.8 },
  { code: 'NS', name: 'Nova Scotia', minLat: 43.4, maxLat: 47.1, minLon: -66.4, maxLon: -59.7 },
  { code: 'PE', name: 'Prince Edward Island', minLat: 45.9, maxLat: 47.1, minLon: -64.5, maxLon: -62 },
  { code: 'NL', name: 'Newfoundland and Labrador', minLat: 46.6, maxLat: 60.4, minLon: -67.8, maxLon: -52.6 },
  { code: 'YT', name: 'Yukon', minLat: 60, maxLat: 69.7, minLon: -141, maxLon: -124 },
  { code: 'NT', name: 'Northwest Territories', minLat: 60, maxLat: 78.8, minLon: -136.5, maxLon: -102 },
  { code: 'NU', name: 'Nunavut', minLat: 51.7, maxLat: 83.1, minLon: -120.7, maxLon: -61.2 }
];

/**
 * Estimate province from coordinates (no API needed)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object|null} Province info { code, name } or null if not in Canada
 */
export function getProvinceFromCoordinates(lat, lon) {
  // Check if coordinates are roughly in Canada
  if (lat < 41.5 || lat > 84 || lon < -141 || lon > -52) {
    return null;
  }

  // Find matching province - check more specific regions first
  // Order matters: smaller provinces should be checked before larger overlapping ones
  const orderedBounds = [
    ...PROVINCE_BOUNDS.filter(p => ['PE', 'NS', 'NB'].includes(p.code)), // Small Atlantic provinces first
    ...PROVINCE_BOUNDS.filter(p => !['PE', 'NS', 'NB', 'NU'].includes(p.code)), // Regular provinces
    ...PROVINCE_BOUNDS.filter(p => p.code === 'NU') // Nunavut last (very large, overlaps with others)
  ];

  for (const province of orderedBounds) {
    if (lat >= province.minLat && lat <= province.maxLat &&
        lon >= province.minLon && lon <= province.maxLon) {
      return { code: province.code, name: province.name };
    }
  }

  // Default fallback for coordinates that might be in Canada but don't match bounds exactly
  if (lat >= 41.5 && lat <= 84 && lon >= -141 && lon <= -52) {
    // Make a best guess based on longitude for mainland
    if (lon < -120) return { code: 'BC', name: 'British Columbia' };
    if (lon < -110) return { code: 'AB', name: 'Alberta' };
    if (lon < -102) return { code: 'SK', name: 'Saskatchewan' };
    if (lon < -89) return { code: 'MB', name: 'Manitoba' };
    if (lon < -74) return { code: 'ON', name: 'Ontario' };
    return { code: 'QC', name: 'Quebec' };
  }

  return null;
}

// Cache for location data
const locationCache = new Map();

// Fallback data for major Canadian cities
const FALLBACK_CANADIAN_CITIES = [
  { name: 'Toronto', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 43.6532, lon: -79.3832, type: 'city', source: 'fallback' },
  { name: 'Montreal', province: 'Quebec', provinceCode: 'QC', country: 'Canada', countryCode: 'CA', lat: 45.5017, lon: -73.5673, type: 'city', source: 'fallback' },
  { name: 'Vancouver', province: 'British Columbia', provinceCode: 'BC', country: 'Canada', countryCode: 'CA', lat: 49.2827, lon: -123.1207, type: 'city', source: 'fallback' },
  { name: 'Calgary', province: 'Alberta', provinceCode: 'AB', country: 'Canada', countryCode: 'CA', lat: 51.0447, lon: -114.0719, type: 'city', source: 'fallback' },
  { name: 'Edmonton', province: 'Alberta', provinceCode: 'AB', country: 'Canada', countryCode: 'CA', lat: 53.5461, lon: -113.4938, type: 'city', source: 'fallback' },
  { name: 'Ottawa', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 45.4215, lon: -75.6972, type: 'city', source: 'fallback' },
  { name: 'Winnipeg', province: 'Manitoba', provinceCode: 'MB', country: 'Canada', countryCode: 'CA', lat: 49.8951, lon: -97.1384, type: 'city', source: 'fallback' },
  { name: 'Quebec City', province: 'Quebec', provinceCode: 'QC', country: 'Canada', countryCode: 'CA', lat: 46.8139, lon: -71.2080, type: 'city', source: 'fallback' },
  { name: 'Hamilton', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 43.2557, lon: -79.8711, type: 'city', source: 'fallback' },
  { name: 'Halifax', province: 'Nova Scotia', provinceCode: 'NS', country: 'Canada', countryCode: 'CA', lat: 44.6488, lon: -63.5752, type: 'city', source: 'fallback' },
  { name: 'Victoria', province: 'British Columbia', provinceCode: 'BC', country: 'Canada', countryCode: 'CA', lat: 48.4284, lon: -123.3656, type: 'city', source: 'fallback' },
  { name: 'London', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 42.9849, lon: -81.2453, type: 'city', source: 'fallback' },
  { name: 'St. John\'s', province: 'Newfoundland and Labrador', provinceCode: 'NL', country: 'Canada', countryCode: 'CA', lat: 47.5615, lon: -52.7126, type: 'city', source: 'fallback' },
  { name: 'Saskatoon', province: 'Saskatchewan', provinceCode: 'SK', country: 'Canada', countryCode: 'CA', lat: 52.1332, lon: -106.6700, type: 'city', source: 'fallback' },
  { name: 'Regina', province: 'Saskatchewan', provinceCode: 'SK', country: 'Canada', countryCode: 'CA', lat: 50.4452, lon: -104.6189, type: 'city', source: 'fallback' },
  { name: 'Charlottetown', province: 'Prince Edward Island', provinceCode: 'PE', country: 'Canada', countryCode: 'CA', lat: 46.2382, lon: -63.1311, type: 'city', source: 'fallback' },
  { name: 'Fredericton', province: 'New Brunswick', provinceCode: 'NB', country: 'Canada', countryCode: 'CA', lat: 45.9636, lon: -66.6431, type: 'city', source: 'fallback' },
  { name: 'Yellowknife', province: 'Northwest Territories', provinceCode: 'NT', country: 'Canada', countryCode: 'CA', lat: 62.4540, lon: -114.3718, type: 'city', source: 'fallback' },
  { name: 'Whitehorse', province: 'Yukon', provinceCode: 'YT', country: 'Canada', countryCode: 'CA', lat: 60.7212, lon: -135.0568, type: 'city', source: 'fallback' },
  { name: 'Iqaluit', province: 'Nunavut', provinceCode: 'NU', country: 'Canada', countryCode: 'CA', lat: 63.7467, lon: -68.5170, type: 'city', source: 'fallback' }
];

// Fallback data for major Canadian weather stations
const FALLBACK_WEATHER_STATIONS = [
  { name: 'Toronto Pearson Int\'l Airport', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 43.6777, lon: -79.6248, type: 'weather_station', stationId: 'YYZ', source: 'fallback' },
  { name: 'Vancouver Int\'l Airport', province: 'British Columbia', provinceCode: 'BC', country: 'Canada', countryCode: 'CA', lat: 49.1967, lon: -123.1815, type: 'weather_station', stationId: 'YVR', source: 'fallback' },
  { name: 'Montreal-Trudeau Int\'l Airport', province: 'Quebec', provinceCode: 'QC', country: 'Canada', countryCode: 'CA', lat: 45.4706, lon: -73.7408, type: 'weather_station', stationId: 'YUL', source: 'fallback' },
  { name: 'Calgary Int\'l Airport', province: 'Alberta', provinceCode: 'AB', country: 'Canada', countryCode: 'CA', lat: 51.1215, lon: -114.0076, type: 'weather_station', stationId: 'YYC', source: 'fallback' },
  { name: 'Ottawa Int\'l Airport', province: 'Ontario', provinceCode: 'ON', country: 'Canada', countryCode: 'CA', lat: 45.3225, lon: -75.6692, type: 'weather_station', stationId: 'YOW', source: 'fallback' }
];

/**
 * Get Canadian cities
 * @returns {Promise<Array>} Array of Canadian cities with coordinates
 */
export const fetchCanadianCities = async () => {
  // Check if we have cached data
  if (locationCache.has('cities')) {
    debugLog('CanadaLocations', 'Using cached cities data');
    return locationCache.get('cities');
  }

  // Cache and return the fallback data
  locationCache.set('cities', FALLBACK_CANADIAN_CITIES);
  return FALLBACK_CANADIAN_CITIES;
};

/**
 * Get Canadian weather stations
 * @returns {Promise<Array>} Array of Canadian weather stations with coordinates
 */
export const fetchCanadianWeatherStations = async () => {
  // Check if we have cached data
  if (locationCache.has('stations')) {
    debugLog('CanadaLocations', 'Using cached weather stations data');
    return locationCache.get('stations');
  }

  // Cache and return the fallback data
  locationCache.set('stations', FALLBACK_WEATHER_STATIONS);
  return FALLBACK_WEATHER_STATIONS;
};

/**
 * Search for Canadian locations by name using Nominatim API
 * @param {string} query - The search query
 * @returns {Promise<Array>} Array of matching locations
 */
export const searchCanadianLocations = async (query) => {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim();
  devLog('CanadaLocations', `Searching for locations: "${normalizedQuery}"`);

  try {
    // Use Open-Meteo Geocoding API - free, no API key, no rate limits
    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: {
        name: normalizedQuery,
        count: 20,
        language: 'en',
        format: 'json'
      },
      timeout: 8000
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      // Filter for Canadian results only
      const canadianResults = response.data.results.filter(item =>
        item.country_code === 'CA' || item.country === 'Canada'
      );

      if (canadianResults.length > 0) {
        const results = canadianResults.map(item => {
          // Map admin1 (province) to proper names
          const provinceMap = {
            'Ontario': 'ON',
            'Quebec': 'QC',
            'British Columbia': 'BC',
            'Alberta': 'AB',
            'Manitoba': 'MB',
            'Saskatchewan': 'SK',
            'Nova Scotia': 'NS',
            'New Brunswick': 'NB',
            'Newfoundland and Labrador': 'NL',
            'Prince Edward Island': 'PE',
            'Yukon': 'YT',
            'Northwest Territories': 'NT',
            'Nunavut': 'NU'
          };

          const province = item.admin1 || '';
          const provinceCode = provinceMap[province] || '';

          return {
            name: item.name,
            province: province,
            provinceCode: provinceCode,
            country: 'Canada',
            countryCode: 'CA',
            lat: item.latitude,
            lon: item.longitude,
            type: item.feature_code === 'PPL' ? 'city' : 'place',
            source: 'open-meteo',
            population: item.population || 0
          };
        });

        // Sort: exact matches first, then by population
        results.sort((a, b) => {
          const aLower = a.name.toLowerCase();
          const bLower = b.name.toLowerCase();
          const queryLower = normalizedQuery.toLowerCase();

          // Exact match first
          if (aLower === queryLower && bLower !== queryLower) return -1;
          if (bLower === queryLower && aLower !== queryLower) return 1;

          // Starts with query
          if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) return -1;
          if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower)) return 1;

          // Sort by population (larger cities first)
          return (b.population || 0) - (a.population || 0);
        });

        devLog('CanadaLocations', `Found ${results.length} Canadian locations from Open-Meteo`);
        return results.slice(0, 10); // Return top 10
      }
    }

    devLog('CanadaLocations', 'No Canadian results from Open-Meteo');
    return [];
  } catch (error) {
    console.error('Error fetching from Open-Meteo Geocoding:', error);
    devLog('CanadaLocations', 'Open-Meteo Geocoding failed');
    return [];
  }
};

/**
 * Get location by coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object|null>} Location object or null if not found
 */
export const getLocationByCoordinates = async (lat, lon) => {
  // Get all locations
  const cities = await fetchCanadianCities();
  const stations = await fetchCanadianWeatherStations();
  const allLocations = [...cities, ...stations];
  
  // Find the closest location
  let closestLocation = null;
  let minDistance = Infinity;
  
  for (const location of allLocations) {
    const distance = calculateDistance(lat, lon, location.lat, location.lon);
    if (distance < minDistance) {
      minDistance = distance;
      closestLocation = location;
    }
  }
  
  return closestLocation;
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
           Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

/**
 * Clear the location cache
 */
export const clearLocationCache = () => {
  locationCache.clear();
  devLog('CanadaLocations', 'Location cache cleared');
}; 