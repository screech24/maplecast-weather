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
    }
  }, [coordinates]);
  
  // Build the iframe src URL with the current coordinates and additional parameters
  const iframeSrc = `https://embed.windy.com/embed.html?lat=${mapCenter[0]}&lon=${mapCenter[1]}&zoom=7&level=surface&overlay=radar&menu=&message=false&marker=false&calendar=false&pressure=false&type=map&location=coordinates&detail=false&metricWind=km/h&metricTemp=°C&radarRange=-1&timestamp=${Date.now()}&detailLat=false&detailLon=false&geolocation=off&width=800&height=600&fullscreen=true&showmenu=false&search=false&widget=false&showdata=false&forecast=false`;
  
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
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
          importance="high"
        ></iframe>
      </div>
      
      <div className="windy-radar-footer">
        <p>Interactive weather radar data provided by Windy.com</p>
      </div>
    </div>
  );
};

export default WindyRadarMap; 