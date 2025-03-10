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
        wind_speed: currentWeather.wind.speed,
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
  try {
    // Determine the region code for Environment Canada's RSS feed
    const regionCode = getRegionCode(cityName, province);
    if (!regionCode) {
      console.log('Could not determine region code for:', cityName, province);
      return { alerts: [], error: null };
    }
    
    // Build the URL for the weather alerts RSS feed
    // Try both formats of Environment Canada URLs to be safe
    const alertsUrls = [
      `https://weather.gc.ca/rss/battleboard/${regionCode}_e.xml`,
      `https://weather.gc.ca/rss/warning/${regionCode}_e.xml` // Alternative format
    ];
    
    console.log('Fetching weather alerts from:', alertsUrls[0]);
    
    // List of CORS proxies to try in order
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',   // This one worked in testing
      'https://corsproxy.io/?',                // This one failed with 404
      'https://cors-anywhere.herokuapp.com/',  // This one failed with 403
      'https://thingproxy.freeboard.io/fetch/' // Another option to try
    ];
    
    let response;
    // proxyUsed is kept for debugging purposes even though not directly referenced later
    let proxyUsed;
    let proxyError;
    let urlUsed;
    
    // Try each URL with each proxy until one works
    for (const alertsUrl of alertsUrls) {
      let urlSucceeded = false;
      
      for (const proxy of corsProxies) {
        try {
          console.log(`Trying CORS proxy: ${proxy} with URL: ${alertsUrl}`);
          response = await axios.get(`${proxy}${encodeURIComponent(alertsUrl)}`, {
            timeout: 10000,
            headers: {
              'Accept': 'application/xml, text/xml, */*'
            }
          });
          
          proxyUsed = proxy;
          urlUsed = alertsUrl;
          
          if (response.data && typeof response.data === 'string') {
            console.log(`Successfully fetched alerts using proxy: ${proxy}`);
            urlSucceeded = true;
            break;
          }
        } catch (err) {
          console.log(`Proxy ${proxy} failed with error:`, err.message);
          proxyError = err;
          continue;
        }
      }
      
      if (urlSucceeded) break;
    }
    
    // If all proxies failed with all URLs, try a direct fetch with JSONP approach
    if (!response) {
      try {
        console.log('Trying alternative approach: Environment Canada ATOM feed');
        // Some regions have ATOM feeds available at a different URL format
        const atomUrl = `https://weather.gc.ca/rss/city/${regionCode}_e.xml`;
        
        for (const proxy of corsProxies) {
          try {
            response = await axios.get(`${proxy}${encodeURIComponent(atomUrl)}`, {
              timeout: 10000,
              headers: {
                'Accept': 'application/xml, text/xml, */*'
              }
            });
            
            if (response.data && typeof response.data === 'string') {
              console.log(`Successfully fetched ATOM feed using proxy: ${proxy}`);
              urlUsed = atomUrl;
              break;
            }
          } catch (atomErr) {
            continue;
          }
        }
      } catch (directError) {
        console.log('Alternative approach also failed:', directError.message);
        throw proxyError || directError; // Throw the last error we encountered
      }
    }
    
    if (!response || !response.data || typeof response.data !== 'string') {
      console.warn('Invalid XML response:', response ? response.data : 'No response');
      return { alerts: [], error: 'Invalid response format from Environment Canada' };
    }
    
    // Parse XML using the browser's built-in DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
    
    // Handle parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      throw new Error('Failed to parse XML response');
    }
    
    // Extract entries from the feed - handle both formats (RSS and ATOM)
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
        // Extract alert data
        const id = entry.querySelector('id') ? 
          entry.querySelector('id').textContent : 
          entry.querySelector('guid') ? 
            entry.querySelector('guid').textContent : 
            `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
        const title = entry.querySelector('title')?.textContent || 'Weather Alert';
        
        // Get the summary/content
        const summary = entry.querySelector('summary') ? 
          entry.querySelector('summary').textContent : 
          entry.querySelector('description') ? 
            entry.querySelector('description').textContent : 
            'No details available';
        
        // Get link, published and updated dates
        const linkElement = entry.querySelector('link');
        const link = linkElement ? 
          (linkElement.getAttribute('href') || linkElement.textContent) : 
          'https://weather.gc.ca/warnings/index_e.html';
        
        const published = entry.querySelector('published') ? 
          entry.querySelector('published').textContent : 
          entry.querySelector('pubDate') ? 
            entry.querySelector('pubDate').textContent : 
            new Date().toISOString();
            
        const updated = entry.querySelector('updated') ? 
          entry.querySelector('updated').textContent : 
          published;
        
        return {
          id,
          title,
          summary,
          published,
          link,
          updated,
          source: urlUsed
        };
      });
    
    console.log(`Found ${alerts.length} weather alerts`);
    return { alerts, error: null };
  } catch (fetchError) {
    console.error('Error fetching or parsing the alert feed:', fetchError);
    
    // Try an alternative approach with updated region codes for 2024
    try {
      console.log('Trying fallback region code...');
      
      // Use province-specific fallbacks with updated region codes based on Environment Canada's current URLs
      if (province) {
        const provinceUpper = province.toUpperCase();
        if (provinceUpper === 'ON' || provinceUpper === 'ONTARIO') {
          // Try multiple Ontario regions in sequence
          const ontarioRegions = ['onrm96', 'onrm97', 'on31', 'on33', 'on39', 'on48', 's0000458'];
          return await tryMultipleRegionCodes(ontarioRegions, province);
        } else if (provinceUpper === 'BC' || provinceUpper === 'BRITISH COLUMBIA') {
          const bcRegions = ['bcrm30', 'bcrm31', 'bcrm3', 'bcrm4', 's0000141'];
          return await tryMultipleRegionCodes(bcRegions, province);
        } else if (provinceUpper === 'AB' || provinceUpper === 'ALBERTA') {
          const abRegions = ['abrm32', 'abrm1', 'abrm2', 's0000045'];
          return await tryMultipleRegionCodes(abRegions, province);
        } else if (provinceUpper === 'QC' || provinceUpper === 'QUEBEC') {
          const qcRegions = ['qcrm1', 'qc1', 'qc10', 'qc19', 's0000635'];
          return await tryMultipleRegionCodes(qcRegions, province);
        } else {
          // For other provinces, use a list of likely region codes
          const generalRegions = ['mbrm9', 'skrm2', 'ns1', 'nb2', 'nl3', 'pei2', 'yt10', 'nt1', 'nu1'];
          return await tryMultipleRegionCodes(generalRegions, province);
        }
      } else {
        // If no province, try a variety of common regions and city codes
        const commonRegions = ['onrm96', 'bcrm30', 'abrm32', 'qcrm1', 'mbrm9', 's0000458', 's0000141', 's0000045'];
        return await tryMultipleRegionCodes(commonRegions, null);
      }
    } catch (fallbackError) {
      console.error('Fallback attempt also failed:', fallbackError);
      return { alerts: [], error: 'Could not fetch weather alerts. Please try again later.' };
    }
  }
};

// Helper function to try multiple region codes
async function tryMultipleRegionCodes(regionCodes, province) {
  for (const code of regionCodes) {
    try {
      console.log(`Trying region code: ${code}`);
      
      // Try different URL formats for each region code
      const alertsUrls = [
        `https://weather.gc.ca/rss/battleboard/${code}_e.xml`,
        `https://weather.gc.ca/rss/warning/${code}_e.xml`,
        `https://weather.gc.ca/rss/city/${code}_e.xml` // City format URLs often used for alerts too
      ];
      
      // List of CORS proxies to try
      const corsProxies = [
        'https://api.allorigins.win/raw?url=',   // This one worked in testing
        'https://corsproxy.io/?',
        'https://cors-anywhere.herokuapp.com/',
        'https://thingproxy.freeboard.io/fetch/'
      ];
      
      let response;
      let urlUsed;
      
      // Try each URL with each proxy
      for (const alertsUrl of alertsUrls) {
        let urlSucceeded = false;
        
        for (const proxy of corsProxies) {
          try {
            console.log(`Trying fallback CORS proxy: ${proxy} with URL: ${alertsUrl}`);
            response = await axios.get(`${proxy}${encodeURIComponent(alertsUrl)}`, {
              timeout: 10000,
              headers: {
                'Accept': 'application/xml, text/xml, */*'
              }
            });
            
            if (response.data && typeof response.data === 'string') {
              console.log(`Successfully fetched fallback using proxy: ${proxy}`);
              urlUsed = alertsUrl;
              urlSucceeded = true;
              break;
            }
          } catch (err) {
            continue;
          }
        }
        
        if (urlSucceeded) break;
      }
      
      if (!response || !response.data) continue;
      
      // Parse XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, 'text/xml');
      
      // Check for parser errors
      if (xmlDoc.querySelector('parsererror')) continue;
      
      // Extract entries - check both ATOM and RSS formats
      let entries = xmlDoc.querySelectorAll('entry');
      if (!entries || entries.length === 0) {
        // Try RSS format (item elements)
        entries = xmlDoc.querySelectorAll('item');
      }
      
      if (!entries || entries.length === 0) {
        console.log(`No alerts found for region code: ${code}`);
        continue;
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
          const id = entry.querySelector('id') ? 
            entry.querySelector('id').textContent : 
            entry.querySelector('guid') ? 
              entry.querySelector('guid').textContent : 
              `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
          const title = entry.querySelector('title')?.textContent || 'Weather Alert';
          
          const summary = entry.querySelector('summary') ? 
            entry.querySelector('summary').textContent : 
            entry.querySelector('description') ? 
              entry.querySelector('description').textContent : 
              'No details available';
          
          const linkElement = entry.querySelector('link');
          const link = linkElement ? 
            (linkElement.getAttribute('href') || linkElement.textContent) : 
            'https://weather.gc.ca/warnings/index_e.html';
          
          const published = entry.querySelector('published') ? 
            entry.querySelector('published').textContent : 
            entry.querySelector('pubDate') ? 
              entry.querySelector('pubDate').textContent : 
              new Date().toISOString();
              
          const updated = entry.querySelector('updated') ? 
            entry.querySelector('updated').textContent : 
            published;
          
          return {
            id,
            title,
            summary,
            published,
            link,
            updated,
            source: urlUsed
          };
        });
      
      console.log(`Found ${alerts.length} weather alerts using fallback region code: ${code}`);
      if (alerts.length > 0) {
        return { alerts, error: null };
      }
    } catch (error) {
      console.log(`Failed with region code ${code}:`, error.message);
      continue;
    }
  }
  
  // If all region codes fail, return empty alerts array
  return { alerts: [], error: 'Could not fetch weather alerts for your location.' };
} 