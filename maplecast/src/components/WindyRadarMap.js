import React, { useEffect, useState, useRef } from 'react';
import './WindyRadarMap.css';

const WindyRadarMap = ({ coordinates, isDarkMode }) => {
  const [mapCenter, setMapCenter] = useState(coordinates ? [coordinates.lat, coordinates.lon] : [56.130366, -106.346771]); // Default to center of Canada
  const iframeRef = useRef(null);
  
  // Update map center when coordinates change
  useEffect(() => {
    if (coordinates && coordinates.lat && coordinates.lon) {
      const newCenter = [coordinates.lat, coordinates.lon];
      setMapCenter(newCenter);
      
      // If the iframe exists, send a message to update the location
      if (iframeRef.current) {
        try {
          const message = {
            type: 'updateLocation',
            lat: coordinates.lat,
            lon: coordinates.lon
          };
          iframeRef.current.contentWindow.postMessage(message, 'https://embed.windy.com');
        } catch (error) {
          console.error('Error sending message to Windy iframe:', error);
        }
      }
    }
  }, [coordinates]);
  
  // Build the iframe src URL with the current coordinates and additional parameters
  const iframeSrc = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=km/h&zoom=7&overlay=radar&product=radar&level=surface&lat=${mapCenter[0]}&lon=${mapCenter[1]}&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=true&detailLat=${mapCenter[0]}&detailLon=${mapCenter[1]}&geolocation=off&width=800&height=600`;
  
  return (
    <div className={`windy-radar-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="windy-radar-info">
        <h3>Weather Radar</h3>
        <p>Powered by Windy.com</p>
      </div>
      
      <div className="windy-map-container">
        <iframe 
          ref={iframeRef}
          title="Windy.com Weather Radar"
          src={iframeSrc}
          frameBorder="0"
          allowFullScreen
          className="windy-iframe"
          allow="fullscreen"
          loading="lazy"
        ></iframe>
      </div>
      
      <div className="windy-radar-footer">
        <p>Interactive weather radar data provided by Windy.com</p>
      </div>
    </div>
  );
};

export default WindyRadarMap; 