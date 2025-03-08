import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ZoomControl } from 'react-leaflet';
import './RadarMap.css';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet icon issues in webpack
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const RadarMap = ({ coordinates }) => {
  // Move all hooks to the top level - never conditionally
  const mapRef = useRef(null);
  const [radarTime, setRadarTime] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.7);
  
  // Environment Canada WMS URL and parameters
  const wmsUrl = 'https://geo.weather.gc.ca/geomet';
  const wmsParams = {
    layers: 'RADAR_1KM_RSNO',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    time: new Date(radarTime).toISOString(),
  };

  // Function to center map on coordinates
  useEffect(() => {
    if (mapRef.current && coordinates) {
      mapRef.current.setView([coordinates.lat, coordinates.lon], 7);
    }
  }, [coordinates]);

  // Create radar loop animation
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        // Get the last 10 minutes in 2-minute steps (5 frames)
        const now = Date.now();
        const twoMinutes = 2 * 60 * 1000;
        const nextTime = radarTime - twoMinutes;
        
        // If we've gone back 10 minutes, reset to current time
        if (now - nextTime > 10 * 60 * 1000) {
          setRadarTime(now);
        } else {
          setRadarTime(nextTime);
        }
      }, 1000); // Update every second for smoother animation
    }
    
    return () => clearInterval(interval);
  }, [isPlaying, radarTime]);

  // Early return with loading indicator if coordinates are missing
  if (!coordinates) {
    return <div className="loading">Loading map...</div>;
  }

  const { lat, lon } = coordinates;

  return (
    <div className="radar-map-container card">
      <div className="section-title">
        <i className="fa-solid fa-satellite"></i>
        <h2>Live Radar</h2>
      </div>
      
      <div className="radar-controls">
        <button 
          className="radar-control-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          aria-label={isPlaying ? "Pause radar" : "Play radar"}
        >
          <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
        </button>
        
        <div className="radar-opacity-control">
          <span>Opacity:</span>
          <input 
            type="range" 
            min="0.1" 
            max="1" 
            step="0.1" 
            value={radarOpacity}
            onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
          />
        </div>
      </div>
      
      <div className="radar-map">
        <MapContainer 
          center={[lat, lon]} 
          zoom={7} 
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ height: '550px', width: '100%' }}
          ref={mapRef}
        >
          {/* Base map layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Radar layer */}
          <WMSTileLayer
            url={wmsUrl}
            params={wmsParams}
            opacity={radarOpacity}
          />
          
          {/* Add zoom controls */}
          <ZoomControl position="bottomright" />
        </MapContainer>
      </div>
      
      <div className="radar-legend">
        <p>Radar data provided by Environment Canada • Last updated: {new Date(radarTime).toLocaleTimeString()}</p>
        <div className="legend-colors">
          <div className="legend-item">
            <span className="color-box light"></span>
            <span>Light</span>
          </div>
          <div className="legend-item">
            <span className="color-box moderate"></span>
            <span>Moderate</span>
          </div>
          <div className="legend-item">
            <span className="color-box heavy"></span>
            <span>Heavy</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RadarMap; 