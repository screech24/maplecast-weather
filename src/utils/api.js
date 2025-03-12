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