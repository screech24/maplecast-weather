import React, { useState } from 'react';
import { formatTemp } from '../utils/api';
import './HourlyForecast.css';

const HourlyForecast = ({ data }) => {
  const [activePage, setActivePage] = useState(0);
  
  if (!data || !data.hourly) return <div className="loading">Loading hourly forecast...</div>;

  // Format the hour
  const formatHour = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group hours in pages (6 hours per page, 4 pages)
  const HOURS_PER_PAGE = 8;
  const TOTAL_PAGES = 3;
  
  // Get only the next 24 hours
  const hourlyForecast = data.hourly.slice(0, 24);
  
  // Create pages
  const pages = [];
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const start = i * HOURS_PER_PAGE;
    pages.push(hourlyForecast.slice(start, start + HOURS_PER_PAGE));
  }
  
  // Get current page
  const currentPage = pages[activePage];

  return (
    <div className="hourly-forecast card">
      <div className="section-title">
        <i className="fa-solid fa-clock"></i>
        <h2>Hourly Forecast</h2>
      </div>
      
      <div className="hourly-container">
        {currentPage.map((hour, index) => {
          const time = formatHour(hour.dt);
          const weatherCode = hour.weather[0].icon;
          const temp = formatTemp(hour.temp);
          const feelsLike = formatTemp(hour.feels_like);
          const pop = Math.round(hour.pop * 100); // Probability of precipitation
          const windSpeed = Math.round(hour.wind_speed);
          
          // Determine if it's day or night for better icon selection
          const isDay = weatherCode.includes('d');

          return (
            <div key={index} className={`hourly-item ${index === 0 ? 'current-hour' : ''}`}>
              <div className="hourly-time">{index === 0 ? 'Now' : time}</div>
              <div className="hourly-icon">
                <i className={getWeatherIcon(hour.weather[0].id, isDay)}></i>
              </div>
              <div className="hourly-temp">{temp}°</div>
              <div className="hourly-details">
                <div className="hourly-detail">
                  <i className="fa-solid fa-temperature-half"></i>
                  <span>Feels: {feelsLike}°</span>
                </div>
                {pop > 0 && (
                  <div className="hourly-detail">
                    <i className="fa-solid fa-droplet"></i>
                    <span>{pop}%</span>
                  </div>
                )}
                <div className="hourly-detail">
                  <i className="fa-solid fa-wind"></i>
                  <span>{windSpeed} km/h</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="hourly-pagination">
        {pages.map((_, index) => (
          <button 
            key={index} 
            className={`pagination-btn ${activePage === index ? 'active' : ''}`}
            onClick={() => setActivePage(index)}
            aria-label={`Page ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
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

export default HourlyForecast; 