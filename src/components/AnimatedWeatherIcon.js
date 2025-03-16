import React from 'react';
import './AnimatedWeatherIcons.css';

const AnimatedWeatherIcon = ({ weatherId, isDay }) => {
  // Function to render the appropriate weather icon based on weather ID and day/night
  const renderWeatherIcon = () => {
    // Thunderstorm: 200-299
    if (weatherId >= 200 && weatherId < 300) {
      return (
        <div className="animated-weather-icon thunderstorm">
          <div className="cloud"></div>
          <div className="lightning"></div>
        </div>
      );
    }
    
    // Drizzle: 300-399
    else if (weatherId >= 300 && weatherId < 400) {
      return (
        <div className="animated-weather-icon drizzle">
          <div className="cloud"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
        </div>
      );
    }
    
    // Rain: 500-599
    else if (weatherId >= 500 && weatherId < 600) {
      return (
        <div className="animated-weather-icon rain">
          <div className="cloud"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
          <div className="drop"></div>
        </div>
      );
    }
    
    // Snow: 600-699
    else if (weatherId >= 600 && weatherId < 700) {
      return (
        <div className="animated-weather-icon snow">
          <div className="cloud"></div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
          <div className="snowflake">❄</div>
        </div>
      );
    }
    
    // Atmosphere (fog, mist, etc.): 700-799
    else if (weatherId >= 700 && weatherId < 800) {
      return (
        <div className="animated-weather-icon mist">
          <div className="fog-layer"></div>
          <div className="fog-layer"></div>
          <div className="fog-layer"></div>
        </div>
      );
    }
    
    // Clear sky: 800
    else if (weatherId === 800) {
      return isDay ? (
        <div className="animated-weather-icon">
          <div className="sun"></div>
        </div>
      ) : (
        <div className="animated-weather-icon">
          <div className="moon"></div>
        </div>
      );
    }
    
    // Few clouds: 801
    else if (weatherId === 801) {
      return isDay ? (
        <div className="animated-weather-icon few-clouds">
          <div className="sun"></div>
          <div className="cloud"></div>
        </div>
      ) : (
        <div className="animated-weather-icon few-clouds">
          <div className="moon"></div>
          <div className="cloud"></div>
        </div>
      );
    }
    
    // Clouds: 802-899
    else if (weatherId >= 802 && weatherId < 900) {
      return (
        <div className="animated-weather-icon cloudy">
          <div className="cloud"></div>
          <div className="cloud"></div>
        </div>
      );
    }
    
    // Default (fallback to clear sky)
    else {
      return isDay ? (
        <div className="animated-weather-icon">
          <div className="sun"></div>
        </div>
      ) : (
        <div className="animated-weather-icon">
          <div className="moon"></div>
        </div>
      );
    }
  };

  return renderWeatherIcon();
};

export default AnimatedWeatherIcon; 