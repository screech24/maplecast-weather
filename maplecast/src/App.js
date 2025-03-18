import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import WeatherPages from './components/WeatherPages';
import LocationInfo from './components/LocationInfo';
import LocationSearch from './components/LocationSearch';
import PageNavigation from './components/PageNavigation';
import WeatherAlerts from './components/WeatherAlerts';
import { getCurrentPosition, fetchWeatherData, isLocationInCanada } from './utils/api';
import { registerAlertBackgroundSync } from './utils/alertUtils';
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
  // Add state to track if weather data has been loaded initially
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Add state for last used location
  const [lastUsedLocation, setLastUsedLocation] = useState(null);
  // Add state for current page
  const [currentPage, setCurrentPage] = useState(0);

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

  const toggleNotifications = () => {
    if (notificationsEnabled) {
      // Disable notifications
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false');
    } else {
      // Show prompt to enable notifications
      setShowNotificationPrompt(true);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const enableNotifications = () => {
    // Enable notifications
    setNotificationsEnabled(true);
    localStorage.setItem('notificationsEnabled', 'true');
    setShowNotificationPrompt(false);
    
    // Here you would typically request notification permissions
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  };

  // eslint-disable-next-line no-unused-vars
  const retryFetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (coordinates) {
        const data = await fetchWeatherData(coordinates.lat, coordinates.lon);
        setWeatherData(data);
        setIsLoading(false);
      } else {
        // If no coordinates, try to get current position again
        await handleUseMyLocation();
      }
    } catch (err) {
      setError('Failed to fetch weather data. Please try again.');
      setIsLoading(false);
      console.error('Error retrying weather fetch:', err);
    }
  };

  // Update service worker data
  // eslint-disable-next-line no-unused-vars
  const updateServiceWorkerData = useCallback((data, locationData) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      console.log('Service worker not available or not controlling the page');
      return;
    }
    
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'UPDATE_DATA',
        data: data,
        location: locationData
      });
      console.log('Sent data update to service worker');
    } catch (error) {
      console.error('Error sending message to service worker:', error);
    }
  }, []);

  // Browser notifications
  // eslint-disable-next-line no-unused-vars
  const checkNotificationPermission = useCallback(() => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      setNotificationsEnabled(false);
      return;
    }
    
    if (Notification.permission === 'granted') {
      console.log('Notification permission already granted');
      setNotificationsEnabled(true);
    } else if (Notification.permission !== 'denied') {
      // We need to ask for permission
      setShowNotificationPrompt(true);
    }
  }, []);
  
  // eslint-disable-next-line no-unused-vars
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted');
        setNotificationsEnabled(true);
      } else {
        console.log('Notification permission denied');
        setNotificationsEnabled(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
    
    setShowNotificationPrompt(false);
  }, []);
  
  // eslint-disable-next-line no-unused-vars
  const dismissNotificationPrompt = useCallback(() => {
    setShowNotificationPrompt(false);
  }, []);
  
  // eslint-disable-next-line no-unused-vars
  const showBrowserNotification = useCallback((title, options) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    try {
      const notification = new Notification(title, options);
      console.log('Browser notification shown:', title);
      
      notification.onclick = () => {
        console.log('Notification clicked');
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, []);

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
            // Weather alerts functionality removed and will be reimplemented later
          } else {
            // Weather alerts functionality removed and will be reimplemented later
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
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    try {
      setError(null);
      setUsingFallbackLocation(false);
      setIsLoading(true);
      
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
      setIsLoading(true); // Show loading state while fetching weather data
      
      const position = {
        lat: location.lat,
        lon: location.lon
      };
      
      const success = await getLocationAndWeatherData(position);
      
      if (success) {
        const locationData = {
          city: location.name,
          region: location.state || ''
        };
        
        console.log('Setting location info after successful data fetch:', locationData);
        setLocationInfo(locationData);
        
        // Save location info to localStorage
        localStorage.setItem('lastUsedLocationInfo', JSON.stringify(locationData));
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

  // Handle visibility change (app coming from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App became visible, checking location...');
        // Get current position and update if needed
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const newPosition = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
              };
              
              // Check if location has changed significantly (more than 1km)
              const hasLocationChanged = coordinates ? 
                calculateDistance(
                  coordinates.lat, 
                  coordinates.lon, 
                  newPosition.lat, 
                  newPosition.lon
                ) > 1 : true;
              
              if (hasLocationChanged) {
                console.log('Location has changed, updating...');
                handleLocationSelect(newPosition);
              }
            },
            (error) => {
              console.warn('Error getting current position:', error);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [coordinates]);

  // Helper function to calculate distance between two points using Haversine formula
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

  // Add a useEffect to check notification permission on mount
  useEffect(() => {
    checkNotificationPermission();
    
    // Register for background sync for weather alerts
    if (notificationsEnabled) {
      registerAlertBackgroundSync().then(success => {
        console.log('Background sync registration:', success ? 'successful' : 'failed');
      });
    }
    
    // Clean up
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', () => {});
      }
    };
  }, [checkNotificationPermission, notificationsEnabled]);

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
    <div className="app">
      <Header 
        toggleDarkMode={toggleDarkMode} 
        isDarkMode={isDarkMode} 
        toggleNotifications={toggleNotifications}
        notificationsEnabled={notificationsEnabled}
      />
      
      <div className="app-container">
        <div className="search-location-container">
          {initialLoadComplete && !isLoading && (
            <LocationInfo 
              isInCanada={isInCanada} 
              cityName={locationInfo.city} 
              regionName={locationInfo.region} 
            />
          )}
          
          <LocationSearch 
            apiKey={API_KEY} 
            onLocationSelect={handleLocationSelect} 
            onUseMyLocation={handleUseMyLocation} 
            onSearchTermChange={setSearchTerm}
          />
        </div>
        
        {usingFallbackLocation && (
          <div className="warning-banner">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <p>{error || "Using estimated location. For precise location, try accessing via HTTPS or use the location search."}</p>
          </div>
        )}
        
        {/* Add WeatherAlerts component here */}
        {initialLoadComplete && !isLoading && (
          <WeatherAlerts 
            locationInfo={{
              ...locationInfo,
              lat: coordinates?.lat,
              lon: coordinates?.lon
            }}
            isInCanada={isInCanada}
            currentPage={currentPage}
            isSearching={!!searchTerm}
          />
        )}
        
        {/* Add PageNavigation component here, only show when weather data is loaded */}
        {initialLoadComplete && !isLoading && (
          <PageNavigation 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage} 
            totalPages={4}
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
                <h2>Welcome to MapleCast Weather</h2>
                <p>Click "Use my location" or search for a location to get started.</p>
                <p className="search-hint">You can search directly for any location using the search bar above.</p>
              </div>
            ) : (
              <>
                <WeatherPages 
                  weatherData={weatherData} 
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
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
          <p>
            <i className="fa-solid fa-cloud"></i> Weather data provided by OpenWeatherMap | 
            <i className="fa-solid fa-triangle-exclamation"></i> Weather alerts powered by Weatherbit
          </p>
          <p className="footer-text">
            © 2024 MapleCast Weather | 
            <a href="https://github.com/screech24/maplecast-weather/blob/main/CHANGELOG.md" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="version">v1.11.7</a> |
            Written with Cursor AI using Claude Sonnet 3.7 and Grok 3 beta
          </p>
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
