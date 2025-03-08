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

  return (
    <div className="current-weather card">
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
  );
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