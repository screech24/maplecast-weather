import axios from 'axios';
import {
  fetchOpenMeteoWeather,
  transformCurrentWeather,
  transformHourlyForecast,
  transformDailyForecast
} from './openMeteoApi';

// No API key needed for Open-Meteo!
console.log('MapleCast Weather 2.0 - Using Open-Meteo (free, no API key required)');

// Get user's current position using browser geolocation with fallback
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.log('Geolocation not supported, using IP-based fallback');
      // Fallback to IP-based geolocation
      getLocationByIP().then(resolve).catch(reject);
    } else {
      const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error.message);
          
          // Check specifically for secure origin errors
          if (error.message.includes('Only secure origins are allowed')) {
            reject({
              code: 'INSECURE_ORIGIN',
              message: 'Geolocation requires HTTPS. Please use the search function or run the app via HTTPS.'
            });
          }
          // If error is due to permission denied, use IP-based fallback
          else if (error.code === 1) {
            console.log('Using IP-based fallback due to geolocation permission issue');
            getLocationByIP().then(resolve).catch(reject);
          } else {
            reject(error);
          }
        },
        geoOptions
      );
    }
  });
};

// IP-based geolocation fallback
const getLocationByIP = async () => {
  try {
    // Using ipinfo.io for IP-based geolocation (free tier, no API key needed for basic use)
    const response = await axios.get('https://ipinfo.io/json');
    if (response.data && response.data.loc) {
      const [lat, lon] = response.data.loc.split(',');
      console.log('IP-based location:', response.data.city, response.data.region, lat, lon);
      return {
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      };
    } else {
      // Default location (Toronto, Canada) as ultimate fallback
      console.log('No location from IP, using default location (Toronto)');
      return getDefaultLocation();
    }
  } catch (error) {
    console.error('IP geolocation failed:', error);
    // Default location as ultimate fallback
    console.log('IP geolocation failed, using default location (Toronto)');
    return getDefaultLocation();
  }
};

// Default location function (Toronto)
const getDefaultLocation = () => {
  return {
    lat: 43.6532,
    lon: -79.3832
  };
};

// Fetch weather data from Open-Meteo
export const fetchWeatherData = async (lat, lon) => {
  try {
    console.log(`Fetching weather data from Open-Meteo for ${lat}, ${lon}`);

    // Fetch all data from Open-Meteo
    const openMeteoData = await fetchOpenMeteoWeather(lat, lon);

    // Transform to app format
    const current = transformCurrentWeather(openMeteoData);
    const daily = transformDailyForecast(openMeteoData);
    const hourly = transformHourlyForecast(openMeteoData);

    console.log('Weather data fetched and transformed successfully');

    return {
      current,
      daily,
      hourly
    };
  } catch (error) {
    console.error('Error fetching weather data from Open-Meteo:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
};

// Helper functions removed - now using EC transformers

// Check if location is in Canada using simple coordinate bounds
export const isLocationInCanada = async (lat, lon) => {
  // Approximate Canada bounding box
  // Latitude: 41.7° N to 83.1° N
  // Longitude: -141° W to -52.6° W
  const isInCanada = (
    lat >= 41.7 && lat <= 83.1 &&
    lon >= -141 && lon <= -52.6
  );

  console.log(`Location ${lat}, ${lon} is ${isInCanada ? 'in' : 'outside'} Canada`);
  return isInCanada;
};

// Format date from Unix timestamp
export const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const today = new Date();
  
  // Reset hours to compare just the dates
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const forecastDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Calculate the difference in days
  const diffTime = forecastDate.getTime() - todayDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Check if the date is today, tomorrow, or another day
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  } else {
    // For other days, return the weekday name
    return date.toLocaleDateString('en-CA', { weekday: 'long' });
  }
};

// Format temperature to nearest whole number
export const formatTemp = (temp) => {
  return Math.round(temp);
};

// Export for testing purposes
export const getRegionCode = (cityName, province) => {
  if (!cityName || !province) return null;
  
  // Parse input to handle various formats
  // Extract city and province if input is in format "Banff, Alberta" or "Banff Alberta"
  let city = cityName;
  let provinceParsed = province;
  
  // If cityName contains both city and province (like "Banff, Alberta")
  if (cityName.includes(',') && !province) {
    const parts = cityName.split(',');
    city = parts[0].trim();
    provinceParsed = parts[1].trim();
  } else if (cityName.includes(' ') && !province && cityName.split(' ').length > 1) {
    // Try to extract province if it's in the cityName (like "Banff Alberta")
    const parts = cityName.split(' ');
    const possibleProvince = parts[parts.length - 1].trim().toUpperCase();
    // Check if the last word is a known province code or name
    const knownProvinces = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU',
                           'ONTARIO', 'QUEBEC', 'BRITISH COLUMBIA', 'ALBERTA', 'MANITOBA', 'SASKATCHEWAN',
                           'NOVA SCOTIA', 'NEW BRUNSWICK', 'NEWFOUNDLAND AND LABRADOR', 'PRINCE EDWARD ISLAND',
                           'YUKON', 'NORTHWEST TERRITORIES', 'NUNAVUT'];
    
    if (knownProvinces.includes(possibleProvince)) {
      city = cityName.substring(0, cityName.lastIndexOf(' ')).trim();
      provinceParsed = possibleProvince;
    }
  }
  
  // Convert province to uppercase for consistency
  const provinceUpper = provinceParsed.toUpperCase();
  
  // Updated mapping of provinces to region code prefixes
  const provinceToRegionPrefix = {
    'ONTARIO': 'onrm',
    'ON': 'onrm',
    'QUEBEC': 'qc',
    'QC': 'qc',
    'BRITISH COLUMBIA': 'bcrm',
    'BC': 'bcrm',
    'ALBERTA': 'abrm',
    'AB': 'abrm',
    'MANITOBA': 'mbrm',
    'MB': 'mbrm',
    'SASKATCHEWAN': 'skrm',
    'SK': 'skrm',
    'NOVA SCOTIA': 'ns',
    'NS': 'ns',
    'NEW BRUNSWICK': 'nb',
    'NB': 'nb',
    'NEWFOUNDLAND AND LABRADOR': 'nl',
    'NL': 'nl',
    'PRINCE EDWARD ISLAND': 'pei',
    'PE': 'pei',
    'YUKON': 'yt',
    'YT': 'yt',
    'NORTHWEST TERRITORIES': 'nt',
    'NT': 'nt',
    'NUNAVUT': 'nu',
    'NU': 'nu'
  };
  
  // Get the province prefix
  const provincePrefix = provinceToRegionPrefix[provinceUpper];
  if (!provincePrefix) return null;
  
  // Default region codes by province (updated for the new format)
  const defaultRegionsByProvince = {
    'ON': 'onrm96', // Using Brantford code as default for Ontario
    'QC': 'qcrm1',  // Using Montreal region
    'BC': 'bcrm30', // Using Metro Vancouver
    'AB': 'abrm32', // Using Calgary
    'MB': 'mbrm9',  // Using Winnipeg
    'SK': 'skrm2',  // Using Regina
    'NS': 'ns1',    // Using Halifax
    'NB': 'nb2',    // Using Moncton
    'NL': 'nl3',    // Using Bonavista North
    'PE': 'pei2',   // Using Queens County
    'YT': 'yt10',   // Using Whitehorse
    'NT': 'nt1',    // Using Yellowknife
    'NU': 'nu1'     // Using Iqaluit
  };
  
  // Try to use city-specific regions first
  const cityLower = city.toLowerCase();
  
  if (provinceUpper === 'ON' || provinceUpper === 'ONTARIO') {
    if (cityLower.includes('toronto')) return 'onrm96';
    if (cityLower.includes('ottawa')) return 'onrm97';
    if (cityLower.includes('hamilton')) return 'onrm96';
    if (cityLower.includes('london')) return 'onrm96';
    return defaultRegionsByProvince['ON']; // Default for Ontario
  }
  
  if (provinceUpper === 'AB' || provinceUpper === 'ALBERTA') {
    if (cityLower.includes('calgary')) return 'abrm32';
    if (cityLower.includes('edmonton')) return 'abrm31';
    if (cityLower.includes('banff')) return 'abrm1';  // Add Banff
    if (cityLower.includes('jasper')) return 'abrm2'; // Add Jasper
    if (cityLower.includes('lethbridge')) return 'abrm34';
    if (cityLower.includes('red deer')) return 'abrm33';
    return defaultRegionsByProvince['AB']; // Default for Alberta
  }
  
  if (provinceUpper === 'BC' || provinceUpper === 'BRITISH COLUMBIA') {
    if (cityLower.includes('vancouver')) return 'bcrm30';
    if (cityLower.includes('victoria')) return 'bcrm32';
    if (cityLower.includes('whistler')) return 'bcrm2';
    if (cityLower.includes('kelowna')) return 'bcrm3';
    return defaultRegionsByProvince['BC']; // Default for BC
  }
  
  if (provinceUpper === 'QC' || provinceUpper === 'QUEBEC') {
    if (cityLower.includes('montreal')) return 'qcrm1';
    if (cityLower.includes('quebec')) return 'qcrm2';
    if (cityLower.includes('gatineau')) return 'qcrm3';
    return defaultRegionsByProvince['QC']; // Default for Quebec
  }
  
  // Return the default region code for the province if we can't match the city
  return defaultRegionsByProvince[provinceUpper] || null;
};

