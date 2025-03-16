import React, { useState } from 'react';
import { formatTemp } from '../utils/api';
import './HourlyForecast.css';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

const HourlyForecast = ({ data }) => {
  const [activePage, setActivePage] = useState(0);
  
  if (!data || !data.hourly) return <div className="loading">Loading hourly forecast...</div>;

  // Format the hour
  const formatHour = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get current hour
  const currentTime = new Date();
  // eslint-disable-next-line no-unused-vars
  const currentHour = currentTime.getHours();
  
  // Create hourly forecast data by interpolating the 3-hour data
  const createHourlyData = () => {
    // Get only the next 24 entries from the API data
    const apiHourlyData = data.hourly.slice(0, 24);
    
    // Create an array for 24 consecutive hours starting from current hour
    const hourlyData = [];
    let currentTimestamp = Math.floor(Date.now() / 1000); // Current time in seconds
    
    for (let i = 0; i < 24; i++) {
      // Calculate timestamp for this hour
      const hourTimestamp = currentTimestamp + (i * 3600); // Add i hours in seconds
      
      // Find the closest forecast entries before and after this hour
      const beforeEntry = findClosestBefore(apiHourlyData, hourTimestamp);
      const afterEntry = findClosestAfter(apiHourlyData, hourTimestamp);
      
      // If we have both before and after entries, interpolate the data
      // Otherwise, use the closest entry
      let hourData;
      if (beforeEntry && afterEntry && beforeEntry !== afterEntry) {
        hourData = interpolateData(beforeEntry, afterEntry, hourTimestamp);
      } else {
        hourData = beforeEntry || afterEntry || apiHourlyData[0];
      }
      
      // Override the timestamp to show the correct hour
      hourData = {
        ...hourData,
        dt: hourTimestamp
      };
      
      hourlyData.push(hourData);
    }
    
    return hourlyData;
  };
  
  // Find the closest forecast entry before the given timestamp
  const findClosestBefore = (data, timestamp) => {
    return data.reduce((closest, entry) => {
      if (entry.dt <= timestamp && (!closest || entry.dt > closest.dt)) {
        return entry;
      }
      return closest;
    }, null);
  };
  
  // Find the closest forecast entry after the given timestamp
  const findClosestAfter = (data, timestamp) => {
    return data.reduce((closest, entry) => {
      if (entry.dt >= timestamp && (!closest || entry.dt < closest.dt)) {
        return entry;
      }
      return closest;
    }, null);
  };
  
  // Interpolate data between two forecast entries
  const interpolateData = (before, after, timestamp) => {
    // Calculate how far between the two entries this timestamp is (0-1)
    const ratio = (timestamp - before.dt) / (after.dt - before.dt);
    
    // Interpolate numeric values
    const interpolate = (a, b) => a + (b - a) * ratio;
    
    return {
      dt: timestamp,
      temp: interpolate(before.temp, after.temp),
      feels_like: interpolate(before.feels_like, after.feels_like),
      pressure: interpolate(before.pressure, after.pressure),
      humidity: interpolate(before.humidity, after.humidity),
      dew_point: interpolate(before.dew_point, after.dew_point),
      clouds: interpolate(before.clouds, after.clouds),
      visibility: interpolate(before.visibility, after.visibility),
      wind_speed: interpolate(before.wind_speed, after.wind_speed),
      wind_deg: interpolate(before.wind_deg, after.wind_deg),
      pop: interpolate(before.pop, after.pop),
      weather: before.weather // Use the weather from the before entry
    };
  };
  
  // Generate hourly data
  const hourlyForecast = createHourlyData();
  
  // Group hours in pages (8 hours per page, 3 pages)
  const HOURS_PER_PAGE = 8;
  const TOTAL_PAGES = 3;
  
  // Create pages
  const pages = [];
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const start = i * HOURS_PER_PAGE;
    pages.push(hourlyForecast.slice(start, start + HOURS_PER_PAGE));
  }
  
  // Get current page
  const currentPage = pages[activePage];

  // Get color theme based on time of day
  const getColorTheme = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return { primary: '#3498db', secondary: '#ffde59' }; // Morning: blue and yellow
    } else if (hour >= 12 && hour < 18) {
      return { primary: '#2980b9', secondary: '#f39c12' }; // Afternoon: darker blue and orange
    } else if (hour >= 18 && hour < 21) {
      return { primary: '#8e44ad', secondary: '#e74c3c' }; // Evening: purple and red
    } else {
      return { primary: '#2c3e50', secondary: '#7f8c8d' }; // Night: dark blue and gray
    }
  };

  const colorTheme = getColorTheme();

  return (
    <div className="hourly-forecast card">
      <div className="section-title">
        <i className="fa-solid fa-clock" style={{ color: colorTheme.secondary }}></i>
        <h2>Hourly Forecast</h2>
      </div>
      
      <div className="hourly-container">
        {currentPage.map((hour, index) => {
          const time = formatHour(hour.dt);
          const weatherCode = hour.weather[0].icon;
          const weatherId = hour.weather[0].id;
          const temp = formatTemp(hour.temp);
          const feelsLike = formatTemp(hour.feels_like);
          const pop = Math.round(hour.pop * 100); // Probability of precipitation
          const windSpeed = Math.round(hour.wind_speed);
          
          // Determine if it's day or night for better icon selection
          const isDay = weatherCode.includes('d');

          return (
            <div key={index} className={`hourly-item ${index === 0 && activePage === 0 ? 'current-hour' : ''}`}>
              <div className="hourly-time">{index === 0 && activePage === 0 ? 'Now' : time}</div>
              <div className="hourly-icon">
                <AnimatedWeatherIcon weatherId={weatherId} isDay={isDay} />
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

export default HourlyForecast; 