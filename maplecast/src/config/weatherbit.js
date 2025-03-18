// Weatherbit API configuration
export const WEATHERBIT_API_KEY = process.env.REACT_APP_WEATHERBIT_API_KEY;
export const WEATHERBIT_BASE_URL = 'https://api.weatherbit.io/v2.0';

// Alert severity mappings
export const SEVERITY_MAPPINGS = {
  'Warning': 'Severe',
  'Watch': 'Moderate',
  'Advisory': 'Minor',
  'Statement': 'Minor',
  'Special': 'Minor'
};

// Cache duration in milliseconds (15 minutes)
export const ALERT_CACHE_DURATION = 15 * 60 * 1000;

// Request interval in milliseconds (30 minutes to stay within 50 requests/day limit)
export const REQUEST_INTERVAL = 30 * 60 * 1000; 