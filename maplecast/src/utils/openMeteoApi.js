/**
 * Open-Meteo API Integration
 * Free weather API with no API key required
 * https://open-meteo.com/
 */

import axios from 'axios';

const BASE_URL = 'https://api.open-meteo.com/v1';

/**
 * Fetch all weather data from Open-Meteo
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Complete weather data
 */
export async function fetchOpenMeteoWeather(lat, lon) {
  try {
    console.log(`Fetching weather from Open-Meteo for ${lat}, ${lon}`);

    const params = {
      latitude: lat,
      longitude: lon,
      // Current weather parameters
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m'
      ].join(','),
      // Hourly forecast parameters
      hourly: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'weather_code',
        'pressure_msl',
        'visibility',
        'wind_speed_10m',
        'wind_direction_10m',
        'uv_index'
      ].join(','),
      // Daily forecast parameters
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'uv_index_max'
      ].join(','),
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm'
    };

    const response = await axios.get(`${BASE_URL}/forecast`, { params });

    console.log('Open-Meteo data fetched successfully');
    return response.data;

  } catch (error) {
    console.error('Error fetching Open-Meteo data:', error);
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

/**
 * Transform Open-Meteo current weather to app format
 * @param {Object} data - Open-Meteo response
 * @returns {Object} Transformed current weather
 */
export function transformCurrentWeather(data) {
  const current = data.current;
  const hourly = data.hourly;

  // Get current hour index to fetch additional data - fix the time matching
  const currentTime = new Date(current.time);
  const currentHourStr = currentTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH
  const hourIndex = hourly.time.findIndex(t => t.substring(0, 13) === currentHourStr);

  const visibility = hourIndex >= 0 ? hourly.visibility[hourIndex] : 10000;

  return {
    temp: current.temperature_2m,
    feels_like: current.apparent_temperature,
    humidity: current.relative_humidity_2m,
    pressure: current.pressure_msl,
    visibility: visibility, // in meters
    wind_speed: current.wind_speed_10m / 3.6, // Convert km/h to m/s for compatibility
    wind_gust: current.wind_gusts_10m ? current.wind_gusts_10m / 3.6 : undefined,
    weather: [{
      id: mapWeatherCode(current.weather_code),
      main: getWeatherMain(current.weather_code),
      description: getWeatherDescription(current.weather_code),
      icon: getWeatherIcon(current.weather_code, isCurrentlyDay(current.time))
    }],
    uvi: hourIndex >= 0 ? hourly.uv_index[hourIndex] : 0,
    dt: Math.floor(new Date(current.time).getTime() / 1000)
  };
}

/**
 * Transform Open-Meteo hourly forecast to app format
 * @param {Object} data - Open-Meteo response
 * @returns {Array} Transformed hourly forecast (24 hours)
 */
export function transformHourlyForecast(data) {
  const hourly = data.hourly;

  // Get next 24 hours
  return hourly.time.slice(0, 24).map((time, index) => {
    const isDay = isCurrentlyDay(time);

    return {
      dt: Math.floor(new Date(time).getTime() / 1000),
      temp: hourly.temperature_2m[index],
      feels_like: hourly.apparent_temperature[index],
      pressure: hourly.pressure_msl[index],
      humidity: hourly.relative_humidity_2m[index],
      dew_point: calculateDewPoint(hourly.temperature_2m[index], hourly.relative_humidity_2m[index]),
      clouds: 0, // Not provided by Open-Meteo in basic plan
      visibility: hourly.visibility[index],
      wind_speed: hourly.wind_speed_10m[index] / 3.6, // Convert to m/s
      wind_deg: hourly.wind_direction_10m[index],
      weather: [{
        id: mapWeatherCode(hourly.weather_code[index]),
        main: getWeatherMain(hourly.weather_code[index]),
        description: getWeatherDescription(hourly.weather_code[index]),
        icon: getWeatherIcon(hourly.weather_code[index], isDay)
      }],
      pop: hourly.precipitation_probability[index] / 100, // Convert % to 0-1
      uvi: hourly.uv_index[index] || 0
    };
  });
}

/**
 * Transform Open-Meteo daily forecast to app format
 * @param {Object} data - Open-Meteo response
 * @returns {Array} Transformed daily forecast (7 days)
 */
export function transformDailyForecast(data) {
  const daily = data.daily;

  return daily.time.slice(0, 7).map((time, index) => {
    return {
      dt: Math.floor(new Date(time).getTime() / 1000),
      temp: {
        min: daily.temperature_2m_min[index],
        max: daily.temperature_2m_max[index]
      },
      weather: [{
        id: mapWeatherCode(daily.weather_code[index]),
        main: getWeatherMain(daily.weather_code[index]),
        description: getWeatherDescription(daily.weather_code[index]),
        icon: getWeatherIcon(daily.weather_code[index], true)
      }],
      pop: daily.precipitation_probability_max[index] / 100 // Convert % to 0-1
    };
  });
}

/**
 * Map Open-Meteo weather codes to standard weather IDs
 * https://open-meteo.com/en/docs
 */
function mapWeatherCode(code) {
  const mapping = {
    0: 800,   // Clear sky
    1: 801,   // Mainly clear
    2: 802,   // Partly cloudy
    3: 803,   // Overcast
    45: 741,  // Fog
    48: 741,  // Depositing rime fog
    51: 300,  // Light drizzle
    53: 301,  // Moderate drizzle
    55: 302,  // Dense drizzle
    56: 311,  // Light freezing drizzle
    57: 313,  // Dense freezing drizzle
    61: 500,  // Slight rain
    63: 501,  // Moderate rain
    65: 502,  // Heavy rain
    66: 511,  // Light freezing rain
    67: 511,  // Heavy freezing rain
    71: 600,  // Slight snow
    73: 601,  // Moderate snow
    75: 602,  // Heavy snow
    77: 600,  // Snow grains
    80: 520,  // Slight rain showers
    81: 521,  // Moderate rain showers
    82: 522,  // Violent rain showers
    85: 620,  // Slight snow showers
    86: 621,  // Heavy snow showers
    95: 200,  // Thunderstorm
    96: 201,  // Thunderstorm with slight hail
    99: 202   // Thunderstorm with heavy hail
  };

  return mapping[code] || 800;
}

/**
 * Get weather main category from code
 */
function getWeatherMain(code) {
  if (code === 0) return 'Clear';
  if (code >= 1 && code <= 3) return 'Clouds';
  if (code >= 45 && code <= 48) return 'Mist';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain';
  if (code >= 85 && code <= 86) return 'Snow';
  if (code >= 95) return 'Thunderstorm';
  return 'Clear';
}

/**
 * Get weather description from code
 */
function getWeatherDescription(code) {
  const descriptions = {
    0: 'clear sky',
    1: 'mainly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'depositing rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    56: 'light freezing drizzle',
    57: 'dense freezing drizzle',
    61: 'slight rain',
    63: 'moderate rain',
    65: 'heavy rain',
    66: 'light freezing rain',
    67: 'heavy freezing rain',
    71: 'slight snow fall',
    73: 'moderate snow fall',
    75: 'heavy snow fall',
    77: 'snow grains',
    80: 'slight rain showers',
    81: 'moderate rain showers',
    82: 'violent rain showers',
    85: 'slight snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with slight hail',
    99: 'thunderstorm with heavy hail'
  };

  return descriptions[code] || 'clear sky';
}

/**
 * Get weather icon code
 */
function getWeatherIcon(code, isDay) {
  const suffix = isDay ? 'd' : 'n';
  const id = mapWeatherCode(code);

  if (id >= 200 && id < 300) return `11${suffix}`;
  if (id >= 300 && id < 400) return `09${suffix}`;
  if (id >= 500 && id < 600) return `10${suffix}`;
  if (id >= 600 && id < 700) return `13${suffix}`;
  if (id >= 700 && id < 800) return `50${suffix}`;
  if (id === 800) return `01${suffix}`;
  if (id === 801) return `02${suffix}`;
  if (id === 802) return `03${suffix}`;
  if (id >= 803) return `04${suffix}`;

  return `01${suffix}`;
}

/**
 * Check if current time is day
 */
function isCurrentlyDay(timeString) {
  const date = new Date(timeString);
  const hour = date.getHours();
  return hour >= 6 && hour < 20;
}

/**
 * Calculate dew point from temperature and humidity
 */
function calculateDewPoint(temp, humidity) {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

const openMeteoAPI = {
  fetchOpenMeteoWeather,
  transformCurrentWeather,
  transformHourlyForecast,
  transformDailyForecast
};

export default openMeteoAPI;
