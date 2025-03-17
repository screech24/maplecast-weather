import React, { useEffect, useState } from 'react';
import './WindyRadarMap.css';

const WindyRadarMap = ({ coordinates, isDarkMode }) => {
  const [mapCenter, setMapCenter] = useState(coordinates ? [coordinates.lat, coordinates.lon] : [56.130366, -106.346771]); // Default to center of Canada
  
  // Update map center when coordinates change
  useEffect(() => {
    if (coordinates) {
      setMapCenter([coordinates.lat, coordinates.lon]);
    }
  }, [coordinates]);
  
  // Build the iframe src URL with the current coordinates
  const iframeSrc = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=km/h&zoom=7&overlay=radar&product=radar&level=surface&lat=${mapCenter[0]}&lon=${mapCenter[1]}&message=true`;
  
  return (
    <div className={`windy-radar-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="windy-radar-info">
        <h3>Weather Radar</h3>
        <p>Powered by Windy.com</p>
      </div>
      
      <div className="windy-map-container">
        <iframe 
          title="Windy.com Weather Radar"
          src={iframeSrc}
          frameBorder="0"
          allowFullScreen
          className="windy-iframe"
        ></iframe>
      </div>
      
      <div className="windy-radar-footer">
        <p>Interactive weather radar data provided by Windy.com</p>
      </div>
    </div>
  );
};

export default WindyRadarMap; 