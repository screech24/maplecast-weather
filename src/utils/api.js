import axios from 'axios';

// Get API key from environment variables with fallback to maintain compatibility
export const API_KEY = process.env.REACT_APP_OPENWEATHERMAP_API_KEY || '5028d96732231e41c0f46dcc16db8c29';
// Log a masked version of the key for debugging (only showing first 8 chars)
console.log('API Key being used:', API_KEY.substring(0, 8) + '...');

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

// Fetch weather data from OpenWeatherMap API using free endpoints
export const fetchWeatherData = async (lat, lon) => {
  try {
    // Get current weather from free Weather API endpoint
    const currentWeatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );
    
    // Get forecast data (5 day / 3 hour forecast) from free endpoint
    const forecastResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
    );
    
    // Note: We're using separate API calls instead of OneCall API 3.0 
    // since the latter requires a paid subscription
    // Format the data to match the structure expected by the components
    const currentWeather = currentWeatherResponse.data;
    const forecast = forecastResponse.data;
    
    // Create a structure similar to OneCall API response
    return {
      current: {
        temp: currentWeather.main.temp,
        feels_like: currentWeather.main.feels_like,
        humidity: currentWeather.main.humidity,
        pressure: currentWeather.main.pressure,
        visibility: currentWeather.visibility,
        wind_speed: currentWeather.wind.speed,
        wind_gust: currentWeather.wind.gust,
        weather: currentWeather.weather,
        uvi: 0, // Default since we can't get from OneCall
        dt: currentWeather.dt
      },
      hourly: formatForecastToHourly(forecast),
      daily: formatForecastToDaily(forecast)
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    
    // Check for API key issues (401 error)
    if (error.response && error.response.status === 401) {
      console.error('API Key issue detected:', error.message);
      throw new Error(`API key issue: ${error.message}. Please verify your OpenWeatherMap API key is valid and activated.`);
    }
    
    // Check for rate limit issues (429 error)
    if (error.response && error.response.status === 429) {
      console.error('Rate limit exceeded:', error.message);
      throw new Error('Rate limit exceeded. The free tier of OpenWeatherMap has limited calls per minute/day.');
    }
    
    throw error;
  }
};

// Helper function to convert 5-day/3-hour forecast to daily forecast
const formatForecastToDaily = (forecastData) => {
  const dailyData = [];
  const dailyMap = new Map();
  
  // Group forecast by day
  forecastData.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const day = date.toISOString().split('T')[0];
    
    if (!dailyMap.has(day)) {
      dailyMap.set(day, {
        dt: item.dt,
        temp: {
          min: item.main.temp_min,
          max: item.main.temp_max
        },
        weather: item.weather,
        pop: item.pop || 0
      });
    } else {
      const existing = dailyMap.get(day);
      // Update min/max temps
      existing.temp.min = Math.min(existing.temp.min, item.main.temp_min);
      existing.temp.max = Math.max(existing.temp.max, item.main.temp_max);
      // Use highest probability of precipitation
      existing.pop = Math.max(existing.pop, item.pop || 0);
    }
  });
  
  // Convert map to array
  dailyMap.forEach(value => {
    dailyData.push(value);
  });
  
  return dailyData;
};

// Format forecast data to hourly structure
const formatForecastToHourly = (forecastData) => {
  if (!forecastData || !forecastData.list || !Array.isArray(forecastData.list)) {
    return [];
  }
  
  // Take the first 24 entries from the 3-hour forecast (covers about 3 days)
  return forecastData.list.slice(0, 24).map(item => {
    return {
      dt: item.dt,
      temp: item.main.temp,
      feels_like: item.main.feels_like,
      pressure: item.main.pressure,
      humidity: item.main.humidity,
      dew_point: 0, // Not available in standard API
      clouds: item.clouds.all,
      visibility: item.visibility,
      wind_speed: item.wind.speed,
      wind_deg: item.wind.deg,
      weather: item.weather,
      pop: item.pop || 0
    };
  });
};

// Check if location is in Canada (simplified version)
export const isLocationInCanada = async (lat, lon) => {
  try {
    const response = await axios.get(
      `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`
    );
    return response.data[0]?.country === 'CA';
  } catch (error) {
    console.error('Error checking location:', error);
    
    // If we get a 401, don't fail the whole app, just assume not in Canada
    if (error.response && error.response.status === 401) {
      console.error('API Key issue while checking location:', error.message);
      // Return true to allow the app to continue (we'll assume it might be Canada)
      return true;
    }
    
    return false; // Default to false if there's another error
  }
};

// Format date from Unix timestamp
export const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
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

// Update the fetchWeatherAlerts function to use more reliable CORS proxies and API endpoints
export const fetchWeatherAlerts = async (cityName, province) => {
  console.log(`Fetching weather alerts for ${cityName}, ${province}`);
  
  if (!cityName || !province) {
    console.error('City name or province is missing');
    return { alerts: [], error: 'Location information is incomplete' };
  }
  
  // Normalize province name
  const normalizedProvince = province.toLowerCase().trim();
  
  // Get region code based on province
  const regionCode = getRegionCodeForProvince(normalizedProvince);
  if (!regionCode) {
    console.error(`No region code found for province: ${province}`);
    return { alerts: [], error: 'Could not determine region code for your location' };
  }
  
  // Try multiple CORS proxies - updated with more reliable options
  const corsProxies = [
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?',
    'https://proxy.cors.sh/',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
  ];
  
  // Try both battleboard and city-specific feeds
  const alertUrls = [
    `https://weather.gc.ca/rss/battleboard/${regionCode}_e.xml`,
    `https://weather.gc.ca/rss/warning/${regionCode}_e.xml`
  ];
  
  let fetchSucceeded = false;
  let xmlData = null;
  
  // Check if we're in development mode and can use the local proxy
  const isLocalDevelopment = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1';
  
  // If in development, try using the local proxy first
  if (isLocalDevelopment) {
    try {
      console.log('Using local development proxy');
      
      // In development, we can use the proxy set up in package.json
      for (const alertUrl of alertUrls) {
        if (fetchSucceeded) break;
        
        try {
          // Use relative URL to leverage the proxy set in package.json
          const proxyUrl = `/proxy-api/weather-alerts?url=${encodeURIComponent(alertUrl)}`;
          console.log(`Using local proxy: ${proxyUrl}`);
          
          const response = await fetch(proxyUrl, {
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            console.log(`Failed to fetch from local proxy with status: ${response.status}`);
            continue;
          }
          
          const text = await response.text();
          if (!text || text.trim() === '') {
            console.log('Empty response from local proxy');
            continue;
          }
          
          xmlData = text;
          fetchSucceeded = true;
          break;
        } catch (error) {
          console.error('Error fetching alerts with local proxy:', error);
        }
      }
    } catch (localProxyError) {
      console.error('Local proxy attempt failed:', localProxyError);
    }
  }
  
  // If local proxy failed or we're not in development, try the CORS proxies
  if (!fetchSucceeded) {
    // Try each URL with each proxy
    for (const alertUrl of alertUrls) {
      if (fetchSucceeded) break;
      
      console.log(`Trying to fetch alerts from: ${alertUrl}`);
      
      for (const proxy of corsProxies) {
        try {
          const proxyUrl = `${proxy}${encodeURIComponent(alertUrl)}`;
          console.log(`Using proxy: ${proxyUrl}`);
          
          const response = await fetch(proxyUrl, {
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            console.log(`Failed to fetch from ${proxy} with status: ${response.status}`);
            continue;
          }
          
          const text = await response.text();
          if (!text || text.trim() === '') {
            console.log(`Empty response from ${proxy}`);
            continue;
          }
          
          xmlData = text;
          fetchSucceeded = true;
          break;
        } catch (error) {
          console.error(`Error fetching alerts with proxy ${proxy}:`, error);
        }
      }
    }
  }
  
  // If all fetch attempts failed, try a fallback approach
  if (!fetchSucceeded) {
    console.log('All fetch attempts failed, trying fallback approach');
    try {
      // Try using a JSONP approach via YQL (may work in some cases)
      const yqlUrl = `https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20xml%20where%20url%3D'${encodeURIComponent(`https://weather.gc.ca/rss/warning/${regionCode}_e.xml`)}'&format=json&callback=`;
      console.log(`Trying YQL fallback: ${yqlUrl}`);
      
      const response = await fetch(yqlUrl);
      
      if (response.ok) {
        const jsonData = await response.json();
        if (jsonData && jsonData.query && jsonData.query.results) {
          // Convert JSON back to XML
          const serializer = new XMLSerializer();
          xmlData = serializer.serializeToString(jsonData.query.results);
          fetchSucceeded = true;
        } else {
          console.error('YQL response did not contain expected data');
        }
      } else {
        console.error('YQL fallback fetch failed with status:', response.status);
      }
    } catch (yqlError) {
      console.error('YQL fallback attempt failed:', yqlError);
    }
  }
  
  // If we still don't have data, try a direct fetch (may not work due to CORS)
  if (!fetchSucceeded) {
    try {
      const fallbackUrl = `https://weather.gc.ca/rss/warning/${regionCode}_e.xml`;
      console.log(`Trying direct fetch: ${fallbackUrl}`);
      
      const response = await fetch(fallbackUrl, {
        mode: 'no-cors' // This will make the response opaque but might work in some browsers
      });
      
      // With mode: 'no-cors', we can't actually read the response
      // But we can check if we got a response object at all
      if (response) {
        console.log('Got a response with no-cors mode, but cannot read its contents');
        // We can't actually use this response due to CORS restrictions
        // This is just a last-ditch effort
      }
    } catch (directFetchError) {
      console.error('Direct fetch attempt also failed:', directFetchError);
    }
    
    // If we've tried everything and still failed, return an error
    if (!fetchSucceeded) {
      return { 
        alerts: [], 
        error: 'Could not fetch weather alerts. Please try again later. This issue will be resolved when the app is deployed to HTTPS.'
      };
    }
  }
  
  // If we have XML data, parse it
  if (xmlData) {
    try {
      console.log('Successfully fetched XML data, parsing...');
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      // Check for parser errors
      if (xmlDoc.querySelector('parsererror')) {
        console.error('XML parsing error');
        return { alerts: [], error: 'Error parsing weather alerts data' };
      }
      
      // Try different XML formats (ATOM or RSS)
      let entries = xmlDoc.querySelectorAll('entry');
      
      if (!entries || entries.length === 0) {
        // Try RSS format (item elements)
        entries = xmlDoc.querySelectorAll('item');
      }
      
      if (!entries || entries.length === 0) {
        console.log('No alerts found in the feed');
        return { alerts: [], error: null };
      }
      
      // Process entries to get alerts
      const alerts = Array.from(entries)
        .filter(entry => {
          // Different XML structures for different feeds
          let category = '';
          let title = '';
          
          // For ATOM feeds
          if (entry.querySelector('category')) {
            const categoryElement = entry.querySelector('category');
            category = categoryElement ? categoryElement.getAttribute('term') || categoryElement.textContent : '';
          } 
          // For RSS feeds
          else if (entry.querySelector('category')) {
            const categoryElement = entry.querySelector('category');
            category = categoryElement ? categoryElement.textContent : '';
          }
          
          // Get title from either format
          const titleElement = entry.querySelector('title');
          title = titleElement ? titleElement.textContent : '';
          
          // Check if this is a valid alert (warnings or watches that are active)
          return (
            // Include if it's a warning/watch
            ((category && category.toLowerCase().includes('warnings')) || 
             (title && (title.toLowerCase().includes('warning') || title.toLowerCase().includes('watch')))) &&
            // Exclude "no warnings or watches" entries
            !(title && title.toLowerCase().includes('no watches or warnings in effect'))
          );
        })
        .map(entry => {
          // Extract data from entry
          const id = entry.querySelector('id')?.textContent || 
                    entry.querySelector('guid')?.textContent || 
                    `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const title = entry.querySelector('title')?.textContent || 'Weather Alert';
          
          // Get summary from either format
          const summary = entry.querySelector('summary')?.textContent || 
                         entry.querySelector('description')?.textContent || 
                         'No details available';
          
          // Get link from either format
          let link;
          const linkElement = entry.querySelector('link');
          if (linkElement) {
            link = linkElement.getAttribute('href') || linkElement.textContent;
          } else {
            link = 'https://weather.gc.ca/warnings/index_e.html';
          }
          
          // Get published date from either format
          const published = entry.querySelector('published')?.textContent || 
                           entry.querySelector('pubDate')?.textContent || 
                           new Date().toISOString();
          
          // Get updated date from either format
          const updated = entry.querySelector('updated')?.textContent || 
                         entry.querySelector('lastBuildDate')?.textContent || 
                         new Date().toISOString();
          
          return {
            id,
            title,
            summary,
            published,
            link,
            updated
          };
        });
      
      console.log(`Found ${alerts.length} alerts after filtering`);
      return { alerts, error: null };
    } catch (parseError) {
      console.error('Error parsing XML:', parseError);
      return { alerts: [], error: 'Error processing weather alerts data' };
    }
  }
  
  return { alerts: [], error: 'Could not fetch weather alerts. Please try again later.' };
};

// Helper function to get region code for a province
function getRegionCodeForProvince(province) {
  const regionCodes = {
    'alberta': 'ab',
    'british columbia': 'bc',
    'manitoba': 'mb',
    'new brunswick': 'nb',
    'newfoundland and labrador': 'nl',
    'northwest territories': 'nt',
    'nova scotia': 'ns',
    'nunavut': 'nu',
    'ontario': 'on',
    'prince edward island': 'pe',
    'quebec': 'qc',
    'saskatchewan': 'sk',
    'yukon': 'yt'
  };
  
  // Check for exact match
  if (regionCodes[province]) {
    return regionCodes[province];
  }
  
  // Check for partial match
  for (const [key, value] of Object.entries(regionCodes)) {
    if (province.includes(key) || key.includes(province)) {
      return value;
    }
  }
  
  // Handle common abbreviations
  const abbreviations = {
    'ab': 'ab',
    'bc': 'bc',
    'mb': 'mb',
    'nb': 'nb',
    'nl': 'nl',
    'nt': 'nt',
    'ns': 'ns',
    'nu': 'nu',
    'on': 'on',
    'pe': 'pe',
    'qc': 'qc',
    'sk': 'sk',
    'yt': 'yt'
  };
  
  if (abbreviations[province]) {
    return abbreviations[province];
  }
  
  // Default to Ontario if no match found
  console.warn(`No region code found for province: ${province}, defaulting to Ontario`);
  return 'on';
} 