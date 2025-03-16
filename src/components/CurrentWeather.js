import React from 'react';
import { formatTemp } from '../utils/api';
import './CurrentWeather.css';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

const CurrentWeather = ({ data }) => {
  if (!data) return <div className="loading">Loading current weather...</div>;

  const {
    temp,
    feels_like,
    humidity,
    wind_speed,
    wind_gust,
    pressure,
    visibility,
    weather,
    uvi
  } = data.current;

  const weatherId = weather[0].id;
  const weatherCode = weather[0].icon;
  const description = weather[0].description;
  const isDay = weatherCode.includes('d');

  // Get background image based on weather condition
  const backgroundStyle = {
    backgroundImage: `url(${getWeatherBackground(weatherId, isDay)})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
  };

  // Format visibility from meters to kilometers
  const formatVisibility = (visibility) => {
    if (!visibility) return 'N/A';
    return (visibility / 1000).toFixed(1) + ' km';
  };

  // Get color theme based on weather condition
  const getColorTheme = () => {
    if (weatherId >= 200 && weatherId < 300) {
      return { primary: '#5a5a5a', secondary: '#ffeb3b' }; // Thunderstorm: dark gray and yellow
    } else if (weatherId >= 300 && weatherId < 400) {
      return { primary: '#c8c8c8', secondary: '#a8d8ff' }; // Drizzle: light gray and light blue
    } else if (weatherId >= 500 && weatherId < 600) {
      return { primary: '#b8b8b8', secondary: '#6eb6ff' }; // Rain: gray and blue
    } else if (weatherId >= 600 && weatherId < 700) {
      return { primary: '#d8d8d8', secondary: '#ffffff' }; // Snow: light gray and white
    } else if (weatherId >= 700 && weatherId < 800) {
      return { primary: '#c0c0c0', secondary: '#e0e0e0' }; // Atmosphere: silver and light silver
    } else if (weatherId === 800) {
      return isDay 
        ? { primary: '#ffde59', secondary: '#ff914d' } // Clear day: yellow and orange
        : { primary: '#2c3e50', secondary: '#d4d4d4' }; // Clear night: dark blue and silver
    } else if (weatherId === 801) {
      return isDay 
        ? { primary: '#ffde59', secondary: '#f0f0f0' } // Few clouds day: yellow and white
        : { primary: '#2c3e50', secondary: '#f0f0f0' }; // Few clouds night: dark blue and white
    } else if (weatherId >= 802 && weatherId < 900) {
      return { primary: '#7f8c8d', secondary: '#f0f0f0' }; // Clouds: gray and white
    } else {
      return { primary: '#3498db', secondary: '#f0f0f0' }; // Default: blue and white
    }
  };

  const colorTheme = getColorTheme();

  return (
    <div className="current-weather card" style={backgroundStyle}>
      <div className="weather-overlay"></div>
      <div className="weather-content">
        <div className="section-title">
          <i className="fa-solid fa-sun" style={{ color: colorTheme.primary }}></i>
          <h2>Current Weather</h2>
        </div>
        
        <div className="current-weather-main">
          <AnimatedWeatherIcon weatherId={weatherId} isDay={isDay} />
          <div className="current-temp">
            <h1>{formatTemp(temp)}°C</h1>
            <p>Feels like {formatTemp(feels_like)}°C</p>
          </div>
        </div>
        
        <div className="weather-description">
          <h3 style={{ color: colorTheme.secondary }}>
            {description.charAt(0).toUpperCase() + description.slice(1)}
          </h3>
        </div>
        
        <div className="weather-details">
          <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
            <i className="fa-solid fa-droplet" style={{ color: '#6eb6ff' }}></i>
            <div className="detail-info">
              <span className="detail-label">Humidity</span>
              <span className="detail-value">{humidity}%</span>
            </div>
          </div>
          <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
            <i className="fa-solid fa-wind" style={{ color: '#b8e0ff' }}></i>
            <div className="detail-info">
              <span className="detail-label">Wind</span>
              <span className="detail-value">{Math.round(wind_speed * 3.6)} km/h</span>
            </div>
          </div>
          <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
            <i className="fa-solid fa-sun" style={{ color: '#ffde59' }}></i>
            <div className="detail-info">
              <span className="detail-label">UV Index</span>
              <span className="detail-value">{Math.round(uvi)}</span>
            </div>
          </div>
          <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
            <i className="fa-solid fa-gauge-high" style={{ color: '#ff914d' }}></i>
            <div className="detail-info">
              <span className="detail-label">Pressure</span>
              <span className="detail-value">{pressure} hPa</span>
            </div>
          </div>
          <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
            <i className="fa-solid fa-eye" style={{ color: '#d4d4d4' }}></i>
            <div className="detail-info">
              <span className="detail-label">Visibility</span>
              <span className="detail-value">{formatVisibility(visibility)}</span>
            </div>
          </div>
          {wind_gust && (
            <div className="weather-detail" style={{ borderLeft: `3px solid ${colorTheme.primary}` }}>
              <i className="fa-solid fa-wind" style={{ color: '#a8d8ff' }}></i>
              <div className="detail-info">
                <span className="detail-label">Wind Gusts</span>
                <span className="detail-value">{Math.round(wind_gust * 3.6)} km/h</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Function to get the appropriate weather background image based on weather ID and day/night
const getWeatherBackground = (weatherId, isDay) => {
  // Background image mapping based on weather ID
  // Using direct URLs to weather-related images from Unsplash
  if (weatherId >= 200 && weatherId < 300) {
    // Thunderstorm
    return isDay
      ? 'https://images.unsplash.com/photo-1594760467013-64ac2b80b7d3?q=80&w=1000&auto=format&fit=crop' // Daytime thunderstorm
      : 'https://images.unsplash.com/photo-1472145246862-b24cf25c4a36?q=80&w=1000&auto=format&fit=crop'; // Night thunderstorm
  } else if (weatherId >= 300 && weatherId < 400) {
    // Drizzle
    return isDay
      ? 'https://images.unsplash.com/photo-1541919329513-35f7af297129?q=80&w=1000&auto=format&fit=crop' // Daytime drizzle
      : 'https://images.unsplash.com/photo-1501999635878-71cb5379c2d8?q=80&w=1000&auto=format&fit=crop'; // Night drizzle
  } else if (weatherId >= 500 && weatherId < 600) {
    // Rain
    return isDay
      ? 'https://images.unsplash.com/photo-1438449805896-28a666819a20?q=80&w=1000&auto=format&fit=crop' // Daytime rain
      : 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?q=80&w=1000&auto=format&fit=crop'; // Night rain
  } else if (weatherId >= 600 && weatherId < 700) {
    // Snow
    return isDay
      ? 'https://images.unsplash.com/photo-1548777123-e216912df7d8?q=80&w=1000&auto=format&fit=crop' // Daytime snow falling
      : 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?q=80&w=1000&auto=format&fit=crop'; // Night snow falling
  } else if (weatherId >= 700 && weatherId < 800) {
    // Atmosphere (fog, mist, etc.)
    return isDay
      ? 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?q=80&w=1000&auto=format&fit=crop' // Daytime fog
      : 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?q=80&w=1000&auto=format&fit=crop'; // Night fog
  } else if (weatherId === 800) {
    // Clear sky
    return isDay 
      ? 'https://images.unsplash.com/photo-1528872042734-8f50f9d3c59b?q=80&w=1000&auto=format&fit=crop' // Pure blue sky, absolutely no clouds
      : 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?q=80&w=1000&auto=format&fit=crop'; // Clear night sky with stars
  } else if (weatherId === 801) {
    // Few clouds
    return isDay 
      ? 'https://images.unsplash.com/photo-1601297183305-6df142704ea2?q=80&w=1000&auto=format&fit=crop' // Few clouds in blue sky
      : 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=1000&auto=format&fit=crop'; // Few clouds at night
  } else if (weatherId >= 802 && weatherId < 900) {
    // Clouds
    return isDay
      ? 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?q=80&w=1000&auto=format&fit=crop' // Daytime clouds
      : 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?q=80&w=1000&auto=format&fit=crop'; // Night clouds - replacing broken URL with a working one
  } else {
    // Default
    return isDay
      ? 'https://images.unsplash.com/photo-1528872042734-8f50f9d3c59b?q=80&w=1000&auto=format&fit=crop' // Default pure blue sky
      : 'https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?q=80&w=1000&auto=format&fit=crop'; // Default night sky
  }
};

// Function to get the appropriate weather icon based on the weather ID and day/night
// eslint-disable-next-line no-unused-vars
const getWeatherIcon = (weatherId, isDay) => {
  // Icon mapping based on weather ID
  if (weatherId >= 200 && weatherId < 300) {
    return 'wi wi-thunderstorm';
  } else if (weatherId >= 300 && weatherId < 400) {
    return 'wi wi-sprinkle';
  } else if (weatherId >= 500 && weatherId < 600) {
    return 'wi wi-rain';
  } else if (weatherId >= 600 && weatherId < 700) {
    return 'wi wi-snow';
  } else if (weatherId >= 700 && weatherId < 800) {
    return 'wi wi-fog';
  } else if (weatherId === 800) {
    return isDay ? 'wi wi-day-sunny' : 'wi wi-night-clear';
  } else if (weatherId === 801) {
    return isDay ? 'wi wi-day-cloudy' : 'wi wi-night-alt-cloudy';
  } else if (weatherId >= 802 && weatherId < 900) {
    return 'wi wi-cloudy';
  } else {
    return 'wi wi-day-sunny';
  }
};

export default CurrentWeather; 