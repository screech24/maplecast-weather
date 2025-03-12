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
import { getCurrentPosition, fetchWeatherData, isLocationInCanada } from './utils/api';
import { fetchLatestAlerts, getUserLocation, filterAlertsByLocation, formatAlertForDisplay } from './utils/capAlerts';
import axios from 'axios';

// Import API key from utils/api.js to maintain consistency
import { API_KEY } from './utils/api';

// Get package version from environment variable
const APP_VERSION = process.env.REACT_APP_VERSION || '1.8.3';

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
  // Add state for last used location
  const [lastUsedLocation, setLastUsedLocation] = useState(null);

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
        
        // Register for periodic background sync if supported
        if ('periodicSync' in registration) {
          try {
            // Check if we have permission
            const status = await navigator.permissions.query({
              name: 'periodic-background-sync',
            });
            
            if (status.state === 'granted') {
              // Register for periodic sync
              await registration.periodicSync.register('weather-alerts-sync', {
                minInterval: 60 * 60 * 1000, // Once per hour
              });
              console.log('Registered for periodic background sync');
            } else {
              console.log('Periodic background sync permission not granted');
            }
          } catch (syncError) {
            console.error('Error registering for periodic background sync:', syncError);
          }
        }
        
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
      console.log('Notifications not supported in this browser');
      return;
    }
    
    const permission = Notification.permission;
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      // If notification is granted, make sure we're subscribed to push
      subscribeToPushNotifications().then(success => {
        if (success) {
          console.log('Successfully subscribed to push notifications');
          
          // Register the service worker for background sync
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
              // Request a background sync
              if ('sync' in registration) {
                registration.sync.register('weather-alerts-sync')
                  .then(() => console.log('Registered for background sync'))
                  .catch(error => console.error('Error registering for background sync:', error));
              }
              
              // Set up periodic checking for alerts
              if (locationInfo && locationInfo.city && locationInfo.region) {
                // Tell the service worker to check for alerts
                if (navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'CHECK_ALERTS'
                  });
                }
              }
            });
          }
        }
      });
    } else if (permission === 'default' && !localStorage.getItem('notificationPromptShown')) {
      // Only show the prompt if we haven't shown it before (stored in localStorage)
      setShowNotificationPrompt(true);
    }
  }, [subscribeToPushNotifications, locationInfo]);

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
  const getWeatherAlerts = useCallback(async (city, region, coordinates = null) => {
    if (!city || !region) return;
    
    try {
      setIsLoadingAlerts(true);
      setAlertsError(null);
      
      console.log('Fetching CAP alerts from Environment Canada');
      
      // Get user location if not provided
      let userLocation;
      
      userLocation = coordinates ? 
        { latitude: coordinates.lat, longitude: coordinates.lon } : 
        await getUserLocation();
      
      console.log(`Using location: ${JSON.stringify(userLocation)}`);
      
      // Fetch all CAP alerts
      const allAlerts = await fetchLatestAlerts();
      console.log(`Fetched ${allAlerts.length} CAP alerts`);
      
      // Filter alerts by user location
      const relevantAlerts = filterAlertsByLocation(allAlerts, userLocation);
      console.log(`Found ${relevantAlerts.length} alerts relevant to user location`);
      
      // Format alerts for display
      const formattedAlerts = relevantAlerts.map(formatAlertForDisplay).filter(alert => alert !== null);
      
      setAlerts(formattedAlerts);
      
      // Update service worker with the alerts and location
      updateServiceWorkerData(formattedAlerts, { city, region });
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
      
      // Save the position to lastUsedLocation state and localStorage
      setLastUsedLocation(position);
      localStorage.setItem('lastUsedLocation', JSON.stringify(position));
      
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
          
          // Save location info to localStorage
          localStorage.setItem('lastUsedLocationInfo', JSON.stringify(locationData));
          
          // Fetch weather alerts if in Canada
          if (inCanada) {
            await getWeatherAlerts(locationData.city, locationData.region, position);
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

  // Function to fetch alerts for a specific location
  const fetchAlertsForLocation = useCallback(async (coords, city, region) => {
    if (!coords || !city) return;
    
    console.log(`Fetching alerts for location: ${city}, ${region || 'Unknown Region'}`);
    try {
      setIsLoadingAlerts(true);
      setAlertsError(null);
      
      // Use the existing getWeatherAlerts function with the provided coordinates
      await getWeatherAlerts(city, region, coords);
      
      console.log('Successfully fetched alerts for location');
    } catch (error) {
      console.error('Error fetching alerts for location:', error);
      setAlertsError('Failed to fetch weather alerts for this location.');
      setAlerts([]);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [getWeatherAlerts]);

  const handleLocationSelect = async (location) => {
    console.log('Location selected in App component:', location);
    
    // Validate location data
    if (!location || typeof location !== 'object') {
      console.error('Invalid location data received:', location);
      setError('Invalid location data. Please try selecting a different location.');
      return;
    }
    
    // Ensure we have latitude and longitude
    if (!location.lat || !location.lon) {
      console.error('Missing coordinates in location data:', location);
      setError('Location data is missing coordinates. Please try selecting a different location.');
      return;
    }
    
    try {
      setAlerts([]);
      setIsLoading(true); // Show loading state while fetching weather data
      setError(null); // Clear any previous errors
      
      const position = {
        lat: location.lat,
        lon: location.lon
      };
      
      // Save the selected location to state for potential reuse
      setLastUsedLocation(position);
      
      // Save location to localStorage immediately
      localStorage.setItem('lastUsedLocation', JSON.stringify(position));
      
      const success = await getLocationAndWeatherData(position);
      
      if (success) {
        const locationData = {
          city: location.name || '',
          region: location.state || location.country || ''
        };
        
        console.log('Setting location info after successful data fetch:', locationData);
        setLocationInfo(locationData);
        
        // Save location info to localStorage
        localStorage.setItem('lastUsedLocationInfo', JSON.stringify(locationData));
        
        // Fetch alerts for the new location
        if (coordinates) {
          fetchAlertsForLocation(coordinates, locationData.city, locationData.region);
        }
      } else {
        console.warn('Failed to get weather data for location');
        setError('Unable to fetch weather data for the selected location. Please try again or select a different location.');
      }
    } catch (error) {
      console.error('Error handling location selection:', error);
      setError('Failed to load weather data for the selected location. Please try again.');
      setIsLoading(false);
    }
  };

  // Add a useEffect to load the last used location from localStorage
  useEffect(() => {
    const loadLastUsedLocation = async () => {
      const savedLocation = localStorage.getItem('lastUsedLocation');
      const savedLocationInfo = localStorage.getItem('lastUsedLocationInfo');
      
      if (savedLocation) {
        try {
          const position = JSON.parse(savedLocation);
          setLastUsedLocation(position);
          
          // Only load weather data if we have a valid position
          if (position && position.lat && position.lon) {
            console.log('Loading weather data for last used location:', position);
            await getLocationAndWeatherData(position);
          }
        } catch (error) {
          console.error('Error parsing saved location:', error);
        }
      } else {
        // If no saved location, set loading to false
        setIsLoading(false);
      }
      
      if (savedLocationInfo) {
        try {
          const locationData = JSON.parse(savedLocationInfo);
          setLocationInfo(locationData);
        } catch (error) {
          console.error('Error parsing saved location info:', error);
        }
      }
    };
    
    loadLastUsedLocation();
  }, [getLocationAndWeatherData]);

  // Add a useEffect to update weather data when the app is resumed
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && lastUsedLocation) {
        console.log('App resumed, updating weather data');
        await getLocationAndWeatherData(lastUsedLocation);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastUsedLocation, getLocationAndWeatherData]);

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
    
    // Set up periodic checking for new alerts (every 1 minute)
    const alertCheckInterval = setInterval(() => {
      if (locationInfo && locationInfo.city && locationInfo.region) {
        console.log('Performing periodic alert check');
        checkForNewAlerts();
      }
    }, 1 * 60 * 1000); // 1 minute
    
    // When new alerts are found and the page is open, show a browser notification
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'NEW_ALERTS') {
        const newAlerts = event.data.alerts;
        
        if (newAlerts && newAlerts.length > 0) {
          console.log(`Received ${newAlerts.length} new alerts from service worker`);
          
          // Update the state with new alerts
          setAlerts(prevAlerts => {
            // Merge the alerts, avoiding duplicates
            const allAlerts = [...prevAlerts];
            const existingAlertIds = new Set(prevAlerts.map(alert => alert.id));
            
            for (const alert of newAlerts) {
              if (!existingAlertIds.has(alert.id)) {
                allAlerts.push(alert);
              }
            }
            
            return allAlerts;
          });
          
          // Show a browser notification for each new alert
          // This works when the page is visible
          if (notificationsEnabled) {
            for (const alert of newAlerts) {
              showBrowserNotification('Weather Alert', {
                body: `${alert.title} - ${alert.summary ? alert.summary.substring(0, 100) : alert.description ? alert.description.substring(0, 100) : alert.title}...`,
                icon: '/android-chrome-192x192.png',
                badge: '/favicon-32x32.png',
                tag: `alert-${alert.id}`,
                requireInteraction: true,
                data: {
                  url: alert.link || '/',
                  alertId: alert.id,
                  timestamp: Date.now()
                },
                actions: [
                  {
                    action: 'view',
                    title: 'View Details'
                  },
                  {
                    action: 'close',
                    title: 'Dismiss'
                  }
                ]
              });
            }
          }
        }
      } else if (event.data && event.data.type === 'NO_NEW_ALERTS') {
        console.log('No new alerts found during check');
      }
    };
    
    // Listen for messages from the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      // If we have a service worker controller, register for background sync
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
          // Register for background sync if supported
          if ('sync' in registration) {
            registration.sync.register('weather-alerts-sync')
              .then(() => console.log('Registered for background sync'))
              .catch(error => console.error('Error registering for background sync:', error));
          }
        });
      }
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
        <div className="container">
          <p><i className="fa-solid fa-cloud"></i> Weather data provided by OpenWeatherMap | Enhanced Radar Visualization powered by Environment Canada</p>
          <p>&copy; {new Date().getFullYear()} MapleCast | Written with Cursor AI | <a href="https://github.com/screech24/maplecast-weather" target="_blank" rel="noopener noreferrer" className="version">v{APP_VERSION}</a></p>
        </div>
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
