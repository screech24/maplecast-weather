import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ZoomControl, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './RadarMap.css';

// Component to update the map when coordinates change
const MapUpdater = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  
  return null;
};

const RadarMap = ({ coordinates, isDarkMode }) => {
  const [mapCenter, setMapCenter] = useState([45.4, -75.7]); // Default to Ottawa
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Update map center when coordinates change
  useEffect(() => {
    if (coordinates && coordinates.lat && coordinates.lon) {
      setMapCenter([coordinates.lat, coordinates.lon]);
    }
  }, [coordinates]);
  
  // Set map as ready after a short delay to ensure proper rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Environment Canada radar layer parameters
  const radarLayerParams = {
    layers: 'RADAR_1KM_RSNO',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    opacity: 0.7,
    attribution: 'Radar data © Environment Canada'
  };
  
  // Choose map tile style based on dark mode
  const mapTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  const mapAttribution = isDarkMode
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className={`radar-map-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <h2><i className="fa-solid fa-satellite-dish"></i> Live Radar Map</h2>
      <p className="radar-description">Interactive radar showing real-time precipitation across Canada. Zoom and pan to explore weather patterns.</p>
      <div className="radar-map">
        <MapContainer
          center={mapCenter}
          zoom={7}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <ZoomControl position="topright" />
          <TileLayer
            url={mapTileUrl}
            attribution={mapAttribution}
          />
          {isMapReady && (
            <WMSTileLayer
              url="https://geo.weather.gc.ca/geomet"
              params={radarLayerParams}
            />
          )}
          <MapUpdater center={mapCenter} />
        </MapContainer>
      </div>
      <div className="radar-legend">
        <p>
          <small>Radar data provided by Environment Canada</small>
        </p>
      </div>
    </div>
  );
};

export default RadarMap;