import React from 'react';
import { formatDate, formatTemp } from '../utils/api';
import './Forecast.css';
import AnimatedWeatherIcon from './AnimatedWeatherIcon';

const Forecast = ({ data }) => {
  if (!data) return <div className="loading">Loading forecast...</div>;

  // Take only 7 days of forecast (today + 6 days)
  const dailyForecast = data.daily.slice(0, 7);

  // Get color theme for the forecast
  const getColorTheme = () => {
    return { primary: '#38a169', secondary: '#9ae6b4' }; // Green theme for 7-day forecast
  };

  const colorTheme = getColorTheme();

  return (
    <div className="forecast card">
      <div className="section-title">
        <i className="fa-solid fa-calendar-days" style={{ color: colorTheme.secondary }}></i>
        <h2>7-Day Forecast</h2>
      </div>
      
      <div className="forecast-container">
        {dailyForecast.map((day, index) => {
          const date = formatDate(day.dt);
          const weatherId = day.weather[0].id;
          const description = day.weather[0].description;
          const maxTemp = formatTemp(day.temp.max);
          const minTemp = formatTemp(day.temp.min);
          const pop = Math.round(day.pop * 100); // Probability of precipitation
          
          // Determine if it's generally a day icon (for consistent look in forecast)
          const isDay = true;

          return (
            <div key={index} className="forecast-day">
              <p className="forecast-date">{index === 0 ? 'Today' : date}</p>
              <div className="forecast-icon">
                <AnimatedWeatherIcon weatherId={weatherId} isDay={isDay} />
              </div>
              <div className="forecast-temps">
                <span className="max-temp">{maxTemp}°</span>
                <span className="min-temp">{minTemp}°</span>
              </div>
              <p className="forecast-description">
                {description.charAt(0).toUpperCase() + description.slice(1)}
              </p>
              <div className="forecast-pop">
                {pop > 0 && (
                  <>
                    <i className="fa-solid fa-droplet"></i>
                    <span>{pop}%</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

export default Forecast; 