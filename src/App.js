import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import HourlyForecast from './components/HourlyForecast';
import LocationInfo from './components/LocationInfo';
import LocationSearch from './components/LocationSearch';
import WeatherAlerts from './components/WeatherAlerts';
import EnhancedRadarMap from './components/EnhancedRadarMap';
import { getCurrentPosition, fetchWeatherData, fetchWeatherAlerts, isLocationInCanada } from './utils/api';
import axios from 'axios';

// Import API key from utils/api.js to maintain consistency
import { API_KEY } from './utils/api';

function App() {
  // eslint-disable-next-line no-unused-vars
  const [coordinates, setCoordinates] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInCanada, setIsInCanada] = useState(true);
  const [locationInfo, setLocationInfo] = useState({
    city: '',
    region: ''
  });
  const [usingFallbackLocation, setUsingFallbackLocation] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [alerts, setAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [alertsError, setAlertsError] = useState(null);
  // Add state to track if weather data has been loaded initially
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Update body class and localStorage when dark mode changes
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Add this function to request notification permissions
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      
      // If already granted, subscribe to push notifications
      await subscribeToPushNotifications();
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        setNotificationsEnabled(granted);
        
        // If permission granted, register for background sync and push
        if (granted) {
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            
            // Register for background sync if available
            if ('SyncManager' in window) {
              try {
                await registration.sync.register('weather-alerts-sync');
                console.log('Registered background sync for weather alerts');
              } catch (syncError) {
                console.error('Error registering background sync:', syncError);
              }
            }
            
            // Subscribe to push notifications
            await subscribeToPushNotifications();
          }
        }
        
        return granted;
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    } else {
      console.log('Notification permission denied');
      return false;
    }
  }, []);

  // Function to subscribe to push notifications
  const subscribeToPushNotifications = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push notifications not supported by the browser');
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if we already have a subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Already subscribed to push notifications');
        return true;
      }
      
      // Get the server's public key
      // This is where you would normally fetch your VAPID public key from your server
      // For this example, we'll use a placeholder
      const publicKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
      
      // Convert the public key to a Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      try {
        // Subscribe the user
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
        
        console.log('Subscribed to push notifications:', subscription);
        
        // Here you would normally send the subscription to your server
        // sendSubscriptionToServer(subscription);
        
        return true;
      } catch (subscribeError) {
        console.error('Failed to subscribe to push notifications:', subscribeError);
        if (Notification.permission === 'denied') {
          console.log('Permission for notifications was denied');
        }
        return false;
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }, []);

  // Helper function to convert base64 string to Uint8Array
  // (required for the applicationServerKey)
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Function to check notification permission status on component mount
  const checkNotificationPermission = useCallback(() => {
    if (!('Notification' in window)) {
      return;
    }
    
    const permission = Notification.permission;
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      // If notification is granted, make sure we're subscribed to push
      subscribeToPushNotifications();
    } else if (permission === 'default' && !localStorage.getItem('notificationPromptShown')) {
      // Only show the prompt if we haven't shown it before (stored in localStorage)
      setShowNotificationPrompt(true);
    }
  }, [subscribeToPushNotifications]);

  // Function to display a browser notification (for when the page is open)
  const showBrowserNotification = useCallback((title, options) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    try {
      new Notification(title, options);
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  }, []);

  // Send alerts and location info to the service worker
  const updateServiceWorkerData = useCallback((alerts, locationData) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('Updating service worker with new alerts and location data');
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_ALERTS',
        alerts,
        locationInfo: locationData
      });
    }
  }, []);

  // Fetch weather alerts based on location
  const getWeatherAlerts = useCallback(async (city, region) => {
    if (!city || !region) return;
    
    try {
      setIsLoadingAlerts(true);
      setAlertsError(null);
      
      const { alerts: alertsData, error: alertsErrorData } = await fetchWeatherAlerts(city, region);
      
      if (alertsErrorData) {
        setAlertsError(alertsErrorData);
        setAlerts([]);
      } else {
        setAlerts(alertsData);
        
        // Update service worker with the alerts and location
        updateServiceWorkerData(alertsData, { city, region });
      }
    } catch (err) {
      console.error('Error fetching weather alerts:', err);
      setAlertsError('Failed to fetch weather alerts. Please try again later.');
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [updateServiceWorkerData]);

  // Function to get location and weather data based on coordinates
  const getLocationAndWeatherData = useCallback(async (position) => {
    console.log('Getting weather data for position:', position);
    try {
      setIsLoading(true);
      setError(null);
      setCoordinates(position);
      
      // Check if location is in Canada
      const inCanada = await isLocationInCanada(position.lat, position.lon);
      console.log('Is location in Canada:', inCanada);
      setIsInCanada(inCanada);
      
      // Get location name
      console.log('Getting location name...');
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${position.lat}&lon=${position.lon}&limit=1&appid=${API_KEY}`
        );
        
        if (response.data && response.data.length > 0) {
          const locationData = {
            city: response.data[0].name,
            region: response.data[0].state || ''
          };
          console.log('Location data retrieved:', locationData);
          setLocationInfo(locationData);
          
          // Fetch weather alerts if in Canada
          if (inCanada) {
            await getWeatherAlerts(locationData.city, locationData.region);
          } else {
            setAlerts([]);
            setIsLoadingAlerts(false);
          }
        } else {
          console.warn('No location data found in reverse geocoding response');
          setLocationInfo({
            city: 'Unknown Location',
            region: ''
          });
        }
      } catch (locationError) {
        console.error('Error getting location name:', locationError);
        setLocationInfo({
          city: 'Unknown Location',
          region: ''
        });
      }
      
      // Get weather data
      console.log('Fetching weather data...');
      const data = await fetchWeatherData(position.lat, position.lon);
      console.log('Weather data received successfully');
      setWeatherData(data);
      
      // Set initialLoadComplete to true since we've loaded weather data
      console.log('Setting initialLoadComplete to true');
      setInitialLoadComplete(true);
      
      // Finally, set loading to false
      setIsLoading(false);
      return true; // Success
    } catch (err) {
      // Check if there's an issue with the API key
      const isApiKeyIssue = err.message && 
        (err.message.includes('401') || 
         err.message.includes('unauthorized') || 
         err.message.includes('Unauthorized'));
      
      if (isApiKeyIssue) {
        console.error('API Key issue detected:', err.message);
        setError('Weather data unavailable. Please check the API key configuration or try again later.');
      } else {
        console.error('Error fetching weather data:', err.message);
        setError('Failed to fetch weather data. Please try again later.');
      }
      
      // Ensure loading state is set to false even on error
      setIsLoading(false);
      return false; // Failed
    }
  }, [getWeatherAlerts]);

  // Function to manually check for new alerts
  const checkForNewAlerts = useCallback(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      console.log('Checking for new alerts via service worker');
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_ALERTS'
      });
    } else {
      console.log('Service worker not available for alert check');
      // If service worker is not controlling the page, we'll check directly
      if (locationInfo && locationInfo.city && locationInfo.region) {
        getWeatherAlerts(locationInfo.city, locationInfo.region);
      }
    }
  }, [locationInfo, getWeatherAlerts]);

  const handleUseMyLocation = useCallback(async () => {
    try {
      setError(null);
      setUsingFallbackLocation(false);
      setIsLoading(true);
      setAlerts([]);
      
      // Get user's location with fallback mechanisms
      console.log('Getting current position...');
      const position = await getCurrentPosition();
      console.log('Current position retrieved:', position);
      
      const success = await getLocationAndWeatherData(position);
      
      // Only explicitly set initialLoadComplete if not already set in getLocationAndWeatherData
      if (success && !initialLoadComplete) {
        console.log('Setting initialLoadComplete to true in handleUseMyLocation');
        setInitialLoadComplete(true);
      }
    } catch (locationError) {
      console.error('Location error:', locationError);
      
      // Special handling for secure origin errors
      if (locationError.code === 'INSECURE_ORIGIN') {
        setError(locationError.message);
      } else {
        setError('Unable to determine your location. Please try searching for a location instead.');
      }
      
      setUsingFallbackLocation(true);
      setIsLoading(false);
    }
  }, [getLocationAndWeatherData, initialLoadComplete]);

  const handleLocationSelect = async (location) => {
    console.log('Location selected in App component:', location);
    try {
      setAlerts([]);
      setIsLoading(true); // Show loading state while fetching weather data
      
      const success = await getLocationAndWeatherData({
        lat: location.lat,
        lon: location.lon
      });
      
      if (success) {
        const locationData = {
          city: location.name,
          region: location.state || ''
        };
        
        console.log('Setting location info after successful data fetch:', locationData);
        setLocationInfo(locationData);
      } else {
        console.warn('Failed to get weather data for location');
      }
      
      // No need to set initialLoadComplete here anymore, as it's handled in getLocationAndWeatherData
    } catch (error) {
      console.error('Error handling location selection:', error);
      setError('Failed to load weather data for the selected location. Please try again.');
      setIsLoading(false);
    }
  };

  // Add a useEffect to initialize API key and mark core functionality as available
  useEffect(() => {
    // Log the API key being used (first 4 chars for debugging)
    console.log('Weather App initializing with API key: ' + 
      (API_KEY ? API_KEY.substring(0, 4) + '...' : 'missing!'));
    
    // Initialize API key and mark search functionality as available even before location is selected
    if (API_KEY) {
      // We don't need to change initialLoadComplete here, but we ensure
      // the app is ready to search for locations even before getting current location
      setIsLoading(false);
    } else {
      setError('API key not available. Please check your configuration.');
    }
  }, []);

  // IMPORTANT: Add a useEffect to mark initial loading state as complete and turn off loader
  useEffect(() => {
    // Set initial state to not loading if we haven't loaded weather yet
    if (!initialLoadComplete) {
      setIsLoading(false);
    }
  }, [initialLoadComplete]);

  // Add a useEffect to check notification permission on mount and set up periodic alert checking
  useEffect(() => {
    checkNotificationPermission();
    
    // Set up the initial fetch of weather alerts if we have location
    if (locationInfo && locationInfo.city && locationInfo.region) {
      getWeatherAlerts(locationInfo.city, locationInfo.region);
    }
    
    // Set up periodic checking for new alerts (every 15 minutes)
    const alertCheckInterval = setInterval(() => {
      if (locationInfo && locationInfo.city && locationInfo.region) {
        console.log('Performing periodic alert check');
        checkForNewAlerts();
      }
    }, 15 * 60 * 1000); // 15 minutes
    
    // When new alerts are found and the page is open, show a browser notification
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NEW_ALERTS') {
        const newAlerts = event.data.alerts;
        
        if (newAlerts && newAlerts.length > 0) {
          // Update the state with new alerts
          setAlerts(prevAlerts => {
            // Merge the alerts, avoiding duplicates
            const allAlerts = [...prevAlerts];
            const newAlertIds = new Set(newAlerts.map(alert => alert.id));
            
            for (const alert of newAlerts) {
              if (!prevAlerts.some(a => a.id === alert.id)) {
                allAlerts.push(alert);
              }
            }
            
            return allAlerts;
          });
          
          // If the page is visible, show a browser notification for each new alert
          if (document.visibilityState === 'visible' && notificationsEnabled) {
            for (const alert of newAlerts) {
              showBrowserNotification('Weather Alert', {
                body: `${alert.title} - ${alert.summary ? alert.summary.substring(0, 100) : alert.description ? alert.description.substring(0, 100) : alert.title}...`,
                icon: '/android-chrome-192x192.png',
                badge: '/favicon-32x32.png',
                tag: `alert-${alert.id}`,
                requireInteraction: true
              });
            }
          }
        }
      }
    };
    
    // Listen for messages from the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
    }
    
    // Clean up
    return () => {
      clearInterval(alertCheckInterval);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [checkNotificationPermission, getWeatherAlerts, checkForNewAlerts, locationInfo, notificationsEnabled, showBrowserNotification]);

  if (error && !usingFallbackLocation) {
    return (
      <div className={`app error-container ${isDarkMode ? 'dark-mode' : ''}`}>
        <Header 
          isDarkMode={isDarkMode} 
          toggleDarkMode={toggleDarkMode} 
        />
        <div className="error-message card">
          <h2><i className="fa-solid fa-triangle-exclamation"></i> Oops! Something went wrong</h2>
          <p>{error}</p>
          <button onClick={handleUseMyLocation}>
            <i className="fa-solid fa-rotate"></i> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : ''}`}>
      <Header 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode} 
        notificationsEnabled={notificationsEnabled}
      />
      
      <div className="app-container">
        <LocationSearch 
          apiKey={API_KEY} 
          onLocationSelect={handleLocationSelect} 
          onUseMyLocation={handleUseMyLocation} 
          onSearchTermChange={setSearchTerm}
        />
        
        {usingFallbackLocation && (
          <div className="warning-banner">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p>{error || "Using estimated location. For precise location, try accessing via HTTPS or use the location search."}</p>
          </div>
        )}
        
        {isInCanada && (
          <WeatherAlerts 
            alerts={alerts} 
            isLoading={isLoadingAlerts} 
            error={alertsError}
            notificationsEnabled={notificationsEnabled}
            onCheckAlerts={() => checkForNewAlerts()}
          />
        )}
        
        {isLoading ? (
          <div className="loading-container card">
            <div className="loading-spinner"></div>
            <p>Loading weather data...</p>
            {searchTerm && <p className="loading-subtext">Searching for "{searchTerm}"</p>}
            {!searchTerm && coordinates && <p className="loading-subtext">Getting data for coordinates: {coordinates.lat.toFixed(2)}, {coordinates.lon.toFixed(2)}</p>}
          </div>
        ) : (
          <>
            {!initialLoadComplete ? (
              <div className="welcome-container card">
                <h2>Welcome to MapleCast weather</h2>
                <p>Click "Use my location" or search for a location to get started.</p>
                <p className="search-hint">You can search directly for any location using the search bar above.</p>
              </div>
            ) : (
              <>
                <LocationInfo 
                  isInCanada={isInCanada} 
                  cityName={locationInfo.city} 
                  regionName={locationInfo.region} 
                />
                <div className="weather-container">
                  <div className="main-weather">
                    <CurrentWeather data={weatherData} />
                    <HourlyForecast data={weatherData} />
                    <Forecast data={weatherData} />
                  </div>
                </div>
                
                {/* Enhanced Radar Visualization */}
                <EnhancedRadarMap
                  coordinates={coordinates}
                  isDarkMode={isDarkMode}
                />
              </>
            )}
          </>
        )}
      </div>
      
      <footer className="footer">
        <p><i className="fa-solid fa-cloud"></i> Weather data provided by OpenWeatherMap | Enhanced Radar Visualization powered by Environment Canada</p>
        <p>&copy; {new Date().getFullYear()} MapleCast | Written with Cursor AI | <span className="version">v1.2.0</span></p>
      </footer>

      {showNotificationPrompt && (
        <div className="notification-prompt">
          <div className="notification-prompt-content">
            <h3>Stay Updated on Weather Alerts</h3>
            <p>
              Enable notifications to receive alerts about severe weather conditions in your area, 
              even when the app is closed.
            </p>
            <div className="notification-prompt-buttons">
              <button 
                onClick={() => {
                  requestNotificationPermission();
                  setShowNotificationPrompt(false);
                  localStorage.setItem('notificationPromptShown', 'true');
                }}
                className="primary-button"
              >
                Enable Notifications
              </button>
              <button 
                onClick={() => {
                  setShowNotificationPrompt(false);
                  localStorage.setItem('notificationPromptShown', 'true');
                }}
                className="secondary-button"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
