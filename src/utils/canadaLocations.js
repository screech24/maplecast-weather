import axios from 'axios';
import { devLog, debugLog } from './devMode';

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

// Environment Canada MSC GeoMet API endpoints
const MSC_GEOMET_BASE_URL = 'https://geo.weather.gc.ca/geomet';
const MSC_GEOMET_WFS_URL = `${MSC_GEOMET_BASE_URL}?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json`;

// Cache for location data to reduce API calls
const locationCache = new Map();

/**
 * Fetch Canadian cities from Environment Canada's MSC GeoMet service
 * @returns {Promise<Array>} Array of Canadian cities with coordinates
 */
export const fetchCanadianCities = async () => {
  try {
    // Check if we have cached data
    if (locationCache.has('cities')) {
      debugLog('CanadaLocations', 'Using cached cities data');
      return locationCache.get('cities');
    }

    // Fetch cities from MSC GeoMet WFS service
    // Using the CITIES layer which contains major Canadian cities
    const response = await axios.get(`${MSC_GEOMET_WFS_URL}&typeName=CITIES&srsName=EPSG:4326`);
    
    if (!response.data || !response.data.features) {
      throw new Error('Invalid response from Environment Canada API');
    }

    // Format the cities data
    const cities = response.data.features.map(feature => {
      const { properties, geometry } = feature;
      // Extract coordinates (WFS returns [longitude, latitude])
      const [lon, lat] = geometry.coordinates;
      
      return {
        name: properties.NAME_E || properties.NAME, // English name or fallback to default
        province: properties.PROV_TERR_STATE_LOC,
        provinceCode: properties.PROV_TERR_STATE_LOC,
        country: 'Canada',
        countryCode: 'CA',
        lat,
        lon,
        type: 'city',
        source: 'environment-canada'
      };
    });

    // Cache the results
    locationCache.set('cities', cities);
    devLog('CanadaLocations', `Fetched ${cities.length} Canadian cities`);
    
    return cities;
  } catch (error) {
    console.error('Error fetching Canadian cities:', error);
    return [];
  }
};

/**
 * Fetch Canadian weather stations from Environment Canada's MSC GeoMet service
 * @returns {Promise<Array>} Array of Canadian weather stations with coordinates
 */
export const fetchCanadianWeatherStations = async () => {
  try {
    // Check if we have cached data
    if (locationCache.has('stations')) {
      debugLog('CanadaLocations', 'Using cached weather stations data');
      return locationCache.get('stations');
    }

    // Fetch weather stations from MSC GeoMet WFS service
    const response = await axios.get(`${MSC_GEOMET_WFS_URL}&typeName=CURRENT_CONDITIONS&srsName=EPSG:4326`);
    
    if (!response.data || !response.data.features) {
      throw new Error('Invalid response from Environment Canada API');
    }

    // Format the weather stations data
    const stations = response.data.features.map(feature => {
      const { properties, geometry } = feature;
      // Extract coordinates (WFS returns [longitude, latitude])
      const [lon, lat] = geometry.coordinates;
      
      // Get province code from station ID (first two characters)
      const provinceCode = properties.PROV_TERR_STATE_LOC || '';
      
      return {
        name: properties.STATION_NAME_EN || properties.STATION_NAME, // English name or fallback
        province: CANADIAN_PROVINCES[provinceCode] || provinceCode,
        provinceCode,
        country: 'Canada',
        countryCode: 'CA',
        lat,
        lon,
        type: 'weather_station',
        stationId: properties.STATION_ID,
        source: 'environment-canada'
      };
    });

    // Cache the results
    locationCache.set('stations', stations);
    devLog('CanadaLocations', `Fetched ${stations.length} Canadian weather stations`);
    
    return stations;
  } catch (error) {
    console.error('Error fetching Canadian weather stations:', error);
    return [];
  }
};

/**
 * Search for Canadian locations by name
 * @param {string} query - The search query
 * @returns {Promise<Array>} Array of matching locations
 */
export const searchCanadianLocations = async (query) => {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    
    // Fetch cities and weather stations if not already cached
    const [cities, stations] = await Promise.all([
      fetchCanadianCities(),
      fetchCanadianWeatherStations()
    ]);

    // Combine all locations
    const allLocations = [...cities, ...stations];
    
    // Filter locations based on the query
    const results = allLocations.filter(location => {
      const locationName = location.name.toLowerCase();
      const provinceName = location.province ? location.province.toLowerCase() : '';
      
      return locationName.includes(normalizedQuery) || 
             provinceName.includes(normalizedQuery) ||
             (location.provinceCode && location.provinceCode.toLowerCase().includes(normalizedQuery));
    });

    // Sort results by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      const aNameLower = a.name.toLowerCase();
      const bNameLower = b.name.toLowerCase();
      
      // Exact matches first
      if (aNameLower === normalizedQuery && bNameLower !== normalizedQuery) return -1;
      if (bNameLower === normalizedQuery && aNameLower !== normalizedQuery) return 1;
      
      // Then starts with query
      if (aNameLower.startsWith(normalizedQuery) && !bNameLower.startsWith(normalizedQuery)) return -1;
      if (bNameLower.startsWith(normalizedQuery) && !aNameLower.startsWith(normalizedQuery)) return 1;
      
      // Then alphabetical
      return aNameLower.localeCompare(bNameLower);
    });

    devLog('CanadaLocations', `Found ${results.length} matches for query "${query}"`);
    return results;
  } catch (error) {
    console.error('Error searching Canadian locations:', error);
    return [];
  }
};

/**
 * Get location details by coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object|null>} Location details or null if not found
 */
export const getLocationByCoordinates = async (lat, lon) => {
  try {
    // Fetch cities and weather stations if not already cached
    const [cities, stations] = await Promise.all([
      fetchCanadianCities(),
      fetchCanadianWeatherStations()
    ]);

    // Combine all locations
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
    
    // If the closest location is too far (more than 50km), return null
    if (minDistance > 50) {
      return null;
    }
    
    return closestLocation;
  } catch (error) {
    console.error('Error getting location by coordinates:', error);
    return null;
  }
};

/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

/**
 * Clear the location cache
 */
export const clearLocationCache = () => {
  locationCache.clear();
  devLog('CanadaLocations', 'Location cache cleared');
}; 