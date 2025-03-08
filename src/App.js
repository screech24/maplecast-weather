import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import CurrentWeather from './components/CurrentWeather';
import Forecast from './components/Forecast';
import HourlyForecast from './components/HourlyForecast';
import RadarMap from './components/RadarMap';
import LocationInfo from './components/LocationInfo';
import LocationSearch from './components/LocationSearch';
import { getCurrentPosition, fetchWeatherData, isLocationInCanada } from './utils/api';
import axios from 'axios';

// Temporarily hardcode the API key for testing
const API_KEY = '5028d96732231e41c0f46dcc16db8c29';
console.log('App.js - API Key (hardcoded):', API_KEY);

function App() {
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

  const getLocationAndWeatherData = useCallback(async (position) => {
    try {
      setIsLoading(true);
      setError(null);
      setCoordinates(position);
      
      // Check if location is in Canada
      const inCanada = await isLocationInCanada(position.lat, position.lon);
      setIsInCanada(inCanada);
      
      // Get location name
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/geo/1.0/reverse?lat=${position.lat}&lon=${position.lon}&limit=1&appid=${API_KEY}`
        );
        if (response.data && response.data.length > 0) {
          setLocationInfo({
            city: response.data[0].name,
            region: response.data[0].state || ''
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
      const data = await fetchWeatherData(position.lat, position.lon);
      setWeatherData(data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch weather data. Please try again later.');
      setIsLoading(false);
      console.error('Error:', err);
    }
  }, [setIsLoading, setError, setCoordinates, setIsInCanada, setLocationInfo, setWeatherData]);

  const handleUseMyLocation = useCallback(async () => {
    try {
      setError(null);
      setUsingFallbackLocation(false);
      setIsLoading(true);
      
      // Get user's location with fallback mechanisms
      const position = await getCurrentPosition();
      await getLocationAndWeatherData(position);
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
  }, [getLocationAndWeatherData]);

  const handleLocationSelect = async (location) => {
    await getLocationAndWeatherData({
      lat: location.lat,
      lon: location.lon
    });
    
    setLocationInfo({
      city: location.name,
      region: location.state || ''
    });
  };

  useEffect(() => {
    handleUseMyLocation();
  }, [handleUseMyLocation]);

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
      />
      
      <LocationSearch 
        apiKey={API_KEY} 
        onLocationSelect={handleLocationSelect} 
        onUseMyLocation={handleUseMyLocation} 
      />
      
      {usingFallbackLocation && (
        <div className="warning-banner">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <p>{error || "Using estimated location. For precise location, try accessing via HTTPS or use the location search."}</p>
        </div>
      )}
      
      <div className="app-container">
        {isLoading ? (
          <div className="loading-container card">
            <div className="loading-spinner"></div>
            <p>Loading weather data...</p>
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
              
              <div className="map-section">
                <RadarMap coordinates={coordinates} />
              </div>
            </div>
          </>
        )}
      </div>
      
      <footer className="footer">
        <p><i className="fa-solid fa-cloud"></i> Data provided by OpenWeatherMap and Environment Canada</p>
        <p>&copy; {new Date().getFullYear()} Canada Weather Radar</p>
      </footer>
    </div>
  );
}

export default App;
