import React from 'react';
import { formatTemp } from '../utils/api';
import './CurrentWeather.css';

const CurrentWeather = ({ data }) => {
  if (!data) return <div className="loading">Loading current weather...</div>;

  const {
    temp,
    feels_like,
    humidity,
    wind_speed,
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

  return (
    <div className="current-weather card" style={backgroundStyle}>
      <div className="weather-overlay"></div>
      <div className="weather-content">
        <div className="section-title">
          <i className="fa-solid fa-sun"></i>
          <h2>Current Weather</h2>
        </div>
        
        <div className="current-weather-main">
          <div className="weather-icon">
            <i className={getWeatherIcon(weatherId, isDay)}></i>
          </div>
          <div className="current-temp">
            <h1>{formatTemp(temp)}°C</h1>
            <p>Feels like {formatTemp(feels_like)}°C</p>
          </div>
        </div>
        
        <div className="weather-description">
          <h3>{description.charAt(0).toUpperCase() + description.slice(1)}</h3>
        </div>
        
        <div className="weather-details">
          <div className="weather-detail">
            <i className="fa-solid fa-droplet"></i>
            <span className="detail-label">Humidity</span>
            <span className="detail-value">{humidity}%</span>
          </div>
          <div className="weather-detail">
            <i className="fa-solid fa-wind"></i>
            <span className="detail-label">Wind</span>
            <span className="detail-value">{Math.round(wind_speed * 3.6)} km/h</span>
          </div>
          <div className="weather-detail">
            <i className="fa-solid fa-sun"></i>
            <span className="detail-label">UV Index</span>
            <span className="detail-value">{Math.round(uvi)}</span>
          </div>
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