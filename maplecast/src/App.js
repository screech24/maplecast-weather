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
import { getProvinceFromCoordinates } from './utils/canadaLocations';
import axios from 'axios';

// PWA Install Detection and Enhancement
let deferredPrompt = null;
let installButtonShown = false;

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

  // Add state for current page
  const [currentPage, setCurrentPage] = useState(0);
  
  // PWA Enhancement States
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

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

  // PWA Install Handler
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      // Trigger haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Clear the deferred prompt
    deferredPrompt = null;
    setShowInstallPrompt(false);
  };

  // App Update Handler
  const handleUpdateClick = () => {
    // Reload the page to get the new version
    window.location.reload();
  };

  // Dismiss Install Prompt
  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    // Don't show again for 24 hours
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };

  // Dismiss Update Prompt
  const dismissUpdatePrompt = () => {
    setShowUpdatePrompt(false);
  };


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
  

  // Function to get location and weather data based on coordinates
  const getLocationAndWeatherData = useCallback(async (position, cachedLocationInfo = null) => {
    console.log('Getting weather data for position:', position);
    try {
      setIsLoading(true);
      setError(null);
      setCoordinates(position);

      // Save position to localStorage
      localStorage.setItem('lastUsedLocation', JSON.stringify(position));

      // Check if location is in Canada
      const inCanada = await isLocationInCanada(position.lat, position.lon);
      console.log('Is location in Canada:', inCanada);
      setIsInCanada(inCanada);

      // Use cached location info only if city is a real city name (not province name)
      const hasValidCache = cachedLocationInfo &&
        cachedLocationInfo.city &&
        cachedLocationInfo.region &&
        cachedLocationInfo.city !== 'Unknown Location' &&
        cachedLocationInfo.city !== cachedLocationInfo.region &&
        !cachedLocationInfo.city.includes('Unknown') &&
        !['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan',
          'Nova Scotia', 'New Brunswick', 'Newfoundland', 'Prince Edward Island',
          'Yukon', 'Northwest Territories', 'Nunavut'].includes(cachedLocationInfo.city);

      if (hasValidCache) {
        console.log('Using cached location info, skipping reverse geocoding');
        setLocationInfo(cachedLocationInfo);
      } else {
        // Clear bad cache
        localStorage.removeItem('lastUsedLocationInfo');
        // Get province from coordinates as fallback
        const provinceInfo = getProvinceFromCoordinates(position.lat, position.lon);
        let locationData = {
          city: '',
          region: provinceInfo ? provinceInfo.name : ''
        };

        // Use Photon reverse geocoding (free, no API key, no rate limits)
        console.log('Getting city name from Photon...');
        try {
          const response = await axios.get(
            `https://photon.komoot.io/reverse?lon=${position.lon}&lat=${position.lat}&limit=1`,
            { timeout: 8000 }
          );

          if (response.data?.features?.length > 0) {
            const props = response.data.features[0].properties;
            locationData = {
              city: props.city || props.town || props.village || props.name || props.county || '',
              region: props.state || (provinceInfo ? provinceInfo.name : '')
            };
            console.log('Location from Photon:', locationData);
          }
        } catch (error) {
          console.log('Photon reverse geocoding failed:', error.message);
        }

        setLocationInfo(locationData);
        if (locationData.city) {
          localStorage.setItem('lastUsedLocationInfo', JSON.stringify(locationData));
        }
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

      // Set location info with province from coordinates FIRST
      // This ensures alerts use the correct province while we fetch the city name
      const provinceInfo = getProvinceFromCoordinates(position.lat, position.lon);
      const tempLocationData = {
        city: '', // Will be filled by Photon
        region: provinceInfo ? provinceInfo.name : ''
      };
      console.log('Setting temporary location info from coordinates:', tempLocationData);
      setLocationInfo(tempLocationData);

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

  const handleLocationSelect = useCallback(async (location) => {
    console.log('Location selected in App component:', location);
    try {
      setIsLoading(true); // Show loading state while fetching weather data

      // Set location info FIRST so alerts use correct region
      const locationData = {
        city: location.name,
        region: location.state || location.province || ''
      };
      console.log('Setting location info BEFORE weather fetch:', locationData);
      setLocationInfo(locationData);
      localStorage.setItem('lastUsedLocationInfo', JSON.stringify(locationData));

      const position = {
        lat: location.lat,
        lon: location.lon
      };

      // Pass the location data so getLocationAndWeatherData doesn't overwrite it
      const success = await getLocationAndWeatherData(position, locationData);

      if (!success) {
        console.warn('Failed to get weather data for location');
      }

      // No need to set initialLoadComplete here anymore, as it's handled in getLocationAndWeatherData
    } catch (error) {
      console.error('Error handling location selection:', error);
      setError('Failed to load weather data for the selected location. Please try again.');
      setIsLoading(false);
    }
  }, [getLocationAndWeatherData]);

  // Add a useEffect to load the last used location from localStorage
  useEffect(() => {
    const loadLastUsedLocation = async () => {
      const savedLocation = localStorage.getItem('lastUsedLocation');
      const savedLocationInfo = localStorage.getItem('lastUsedLocationInfo');

      // Load cached location info FIRST (before making API calls)
      let cachedLocationInfo = null;
      if (savedLocationInfo) {
        try {
          const parsed = JSON.parse(savedLocationInfo);
          // Only use cached info if it has both city and region
          if (parsed && parsed.city && parsed.region) {
            cachedLocationInfo = parsed;
            console.log('Using cached location info:', cachedLocationInfo);
            setLocationInfo(cachedLocationInfo);
          } else {
            console.log('Cached location info incomplete, will fetch fresh:', parsed);
          }
        } catch (error) {
          console.error('Error parsing saved location info:', error);
        }
      }

      if (savedLocation) {
        try {
          const position = JSON.parse(savedLocation);

          // Only load weather data if we have a valid position
          if (position && position.lat && position.lon) {
            console.log('Loading weather data for last used location:', position);
            // Pass cached location info to avoid unnecessary reverse geocoding
            await getLocationAndWeatherData(position, cachedLocationInfo);
          }
        } catch (error) {
          console.error('Error parsing saved location:', error);
        }
      } else {
        // If no saved location, set loading to false
        setIsLoading(false);
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
  }, [coordinates, handleLocationSelect]);

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

  // Enhanced PWA Install Experience
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      // Show install banner if not already shown
      if (!installButtonShown) {
        setShowInstallPrompt(true);
        installButtonShown = true;
      }
    };

    const handleAppInstalled = () => {
      console.log('PWA installed successfully');
      setShowInstallPrompt(false);
      deferredPrompt = null;
      // Trigger haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    };

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Service Worker Update Handler
  useEffect(() => {
    const handleSWUpdate = (event) => {
      if (event.data.type === 'SW_UPDATED') {
        console.log('Service Worker updated:', event.data.version);
        setShowUpdatePrompt(true);
        // Trigger haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([50, 30, 50]);
        }
      }
    };

    const handleNewAlerts = (event) => {
      if (event.data.type === 'NEW_ALERTS') {
        console.log('New alerts received:', event.data.alerts);
        // Trigger haptic feedback for alerts
        if ('vibrate' in navigator) {
          navigator.vibrate([200, 100, 200]);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWUpdate);
      navigator.serviceWorker.addEventListener('message', handleNewAlerts);
    }

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWUpdate);
        navigator.serviceWorker.removeEventListener('message', handleNewAlerts);
      }
    };
  }, []);

  // Pull-to-Refresh functionality
  const [pullToRefresh, setPullToRefresh] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  const handleTouchStart = (e) => {
    // Only enable pull-to-refresh at the top of the page
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPullToRefresh(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!pullToRefresh) return;
    
    const y = e.touches[0].clientY;
    setCurrentY(y);
    
    // Add visual feedback for pull distance
    const pullDistance = y - startY;
    if (pullDistance > 0 && pullDistance < 150 && e.currentTarget && e.currentTarget.style) {
      e.currentTarget.style.transform = `translateY(${pullDistance * 0.5}px)`;
    }
  };

  const handleTouchEnd = async (e) => {
    if (!pullToRefresh) return;
    
    const pullDistance = currentY - startY;
    
    // Safely reset transform if currentTarget exists
    if (e.currentTarget && e.currentTarget.style) {
      e.currentTarget.style.transform = 'translateY(0)';
    }
    
    if (pullDistance > 80) {
      // Trigger refresh
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      setPullToRefresh(false);
      setCurrentY(0);
      setStartY(0);
      
      // Refresh weather data
      if (coordinates) {
        await getLocationAndWeatherData(coordinates);
      }
    } else {
      // Reset position without refresh
      setPullToRefresh(false);
      setCurrentY(0);
      setStartY(0);
    }
  };

  // Initialize the app (no API key needed for Environment Canada!)
  useEffect(() => {
    console.log('MapleCast Weather 3.0 initializing with enhanced PWA features...');
    // App is ready to search for locations even before getting current location
    setIsLoading(false);
    
    // Add pull-to-refresh listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [coordinates, getLocationAndWeatherData]);

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
              lon: coordinates?.lon,
              name: locationInfo.city
            }}
            isInCanada={isInCanada}
            currentPage={currentPage}
            isSearching={isLoading || (!!searchTerm && !coordinates)}
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
            <i className="fa-solid fa-cloud"></i> Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          </p>
          <p className="footer-text">
            © 2026 MapleCast Weather |
            <a href="https://github.com/screech24/maplecast-weather/blob/main/CHANGELOG.md"
               target="_blank"
               rel="noopener noreferrer"
               className="version">v2.3.1</a> |
            Written with Claude Code Opus 4.5 - February 8, 2026
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

      {/* PWA Install Prompt */}
      {showInstallPrompt && (
        <div className="pwa-install-prompt">
          <div className="pwa-install-content">
            <div className="pwa-install-icon">
              <i className="fa-solid fa-download"></i>
            </div>
            <div className="pwa-install-text">
              <h3>Install MapleCast</h3>
              <p>Get quick access to weather on your home screen</p>
            </div>
            <div className="pwa-install-actions">
              <button 
                onClick={handleInstallClick}
                className="install-button primary-button"
              >
                <i className="fa-solid fa-plus"></i>
                Install
              </button>
              <button 
                onClick={dismissInstallPrompt}
                className="dismiss-button secondary-button"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App Update Prompt */}
      {showUpdatePrompt && (
        <div className="app-update-prompt">
          <div className="update-content">
            <div className="update-icon">
              <i className="fa-solid fa-arrow-rotate"></i>
            </div>
            <div className="update-text">
              <h3>Update Available</h3>
              <p>A new version of MapleCast is ready to install</p>
            </div>
            <div className="update-actions">
              <button 
                onClick={handleUpdateClick}
                className="update-button primary-button"
              >
                <i className="fa-solid fa-download"></i>
                Update Now
              </button>
              <button 
                onClick={dismissUpdatePrompt}
                className="dismiss-button secondary-button"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull-to-Refresh Indicator */}
      {pullToRefresh && (
        <div className="pull-to-refresh-indicator">
          <div className="refresh-icon">
            <i className="fa-solid fa-arrow-down"></i>
          </div>
          <div className="refresh-text">
            {currentY - startY > 80 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
