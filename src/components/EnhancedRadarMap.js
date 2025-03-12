import React, { useEffect, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  ZoomControl,
  useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './EnhancedRadarMap.css';

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

const EnhancedRadarMap = ({ coordinates, isDarkMode }) => {
  const [mapCenter, setMapCenter] = useState([45.4, -75.7]); // Default to Ottawa
  const [isMapReady, setIsMapReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [timeRange, setTimeRange] = useState('1hour'); // '1hour' or '3hour'
  const [frames, setFrames] = useState([]);
  const [opacity, setOpacity] = useState(70); // 0-100
  const [alertOpacity, setAlertOpacity] = useState(70); // 0-100
  const [playbackSpeed, setPlaybackSpeed] = useState(500); // ms between frames
  const [activeLayers, setActiveLayers] = useState({
    rain: true,
    snow: false,
    mixed: false,
    alerts: true
  });
  
  const animationRef = useRef(null);
  const mapRef = useRef(null);
  
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

  // Generate radar frames based on selected time range
  useEffect(() => {
    const now = new Date();
    const frames = [];
    
    if (timeRange === '1hour') {
      // 1-hour view: 11 frames at 6-minute intervals
      for (let i = 0; i < 11; i++) {
        const frameTime = new Date(now.getTime() - (10 - i) * 6 * 60 * 1000);
        frames.push({
          time: frameTime,
          timestamp: frameTime.toISOString(),
          formattedTime: formatTime(frameTime)
        });
      }
    } else {
      // 3-hour view: 16 frames at 12-minute intervals
      for (let i = 0; i < 16; i++) {
        const frameTime = new Date(now.getTime() - (15 - i) * 12 * 60 * 1000);
        frames.push({
          time: frameTime,
          timestamp: frameTime.toISOString(),
          formattedTime: formatTime(frameTime)
        });
      }
    }
    
    setFrames(frames);
    setCurrentFrameIndex(frames.length - 1); // Set to most recent frame
  }, [timeRange]);

  // Auto-refresh frames every 10 minutes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      // Regenerate frames with updated times
      const now = new Date();
      const updatedFrames = [...frames].map((frame, index) => {
        let newTime;
        if (timeRange === '1hour') {
          newTime = new Date(now.getTime() - (10 - index) * 6 * 60 * 1000);
        } else {
          newTime = new Date(now.getTime() - (15 - index) * 12 * 60 * 1000);
        }
        
        return {
          time: newTime,
          timestamp: newTime.toISOString(),
          formattedTime: formatTime(newTime)
        };
      });
      
      setFrames(updatedFrames);
      
      // If we're on the last frame, update to the new last frame
      if (currentFrameIndex === frames.length - 1) {
        setCurrentFrameIndex(updatedFrames.length - 1);
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(refreshInterval);
  }, [frames, currentFrameIndex, timeRange]);

  // Animation control
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
      animationRef.current = setTimeout(() => {
        setCurrentFrameIndex((prevIndex) => {
          if (prevIndex >= frames.length - 1) {
            return 0; // Loop back to start
          }
          return prevIndex + 1;
        });
      }, playbackSpeed);
      
      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      };
    }
  }, [isPlaying, currentFrameIndex, frames, playbackSpeed]);

  // Format time for display
  const formatTime = (date) => {
    return date.toLocaleTimeString('en-CA', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Play/pause toggle
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Next frame
  const nextFrame = () => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    
    setCurrentFrameIndex((prevIndex) => {
      if (prevIndex >= frames.length - 1) {
        return 0; // Loop back to start
      }
      return prevIndex + 1;
    });
  };

  // Previous frame
  const prevFrame = () => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    
    setCurrentFrameIndex((prevIndex) => {
      if (prevIndex <= 0) {
        return frames.length - 1; // Loop to end
      }
      return prevIndex - 1;
    });
  };

  // Handle timeline slider change
  const handleTimelineChange = (e) => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    setCurrentFrameIndex(parseInt(e.target.value, 10));
  };

  // Handle opacity slider change
  const handleOpacityChange = (e) => {
    setOpacity(parseInt(e.target.value, 10));
  };

  // Handle alert opacity slider change
  const handleAlertOpacityChange = (e) => {
    setAlertOpacity(parseInt(e.target.value, 10));
  };

  // Handle playback speed change
  const handleSpeedChange = (e) => {
    setPlaybackSpeed(parseInt(e.target.value, 10));
  };

  // Handle layer toggle
  const handleLayerToggle = (layer) => {
    setActiveLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    setIsPlaying(false);
  };

  // Choose map tile style based on dark mode
  const mapTileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  const mapAttribution = isDarkMode
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  // Get current frame timestamp for display
  const currentFrameTimestamp = frames[currentFrameIndex]?.timestamp || new Date().toISOString();
  // This timestamp is used in the timeline display and current time indicator

  // Rain layer parameters
  // Note: Environment Canada WMS doesn't support time parameter for these radar layers
  const rainLayerParams = {
    layers: 'RADAR_1KM_RRAI',
    format: 'image/png',
    transparent: true,
    version: '1.4.0',
    opacity: opacity / 100,
    attribution: 'Radar data © Environment Canada'
  };

  // Snow layer parameters
  const snowLayerParams = {
    layers: 'RADAR_1KM_RSNO',
    format: 'image/png',
    transparent: true,
    version: '1.4.0',
    opacity: opacity / 100,
    attribution: 'Radar data © Environment Canada'
  };

  // Mixed precipitation layer parameters
  const mixedLayerParams = {
    layers: 'RADAR_1KM_RDPR',
    format: 'image/png',
    transparent: true,
    version: '1.4.0',
    opacity: opacity / 100,
    attribution: 'Radar data © Environment Canada'
  };

  // Weather alerts layer parameters
  const alertsLayerParams = {
    layers: 'ALERTS',
    format: 'image/png',
    transparent: true,
    version: '1.4.0',
    opacity: alertOpacity / 100,
    attribution: 'Weather Alerts © Environment Canada'
  };

  return (
    <div className={`enhanced-radar-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <h2><i className="fa-solid fa-satellite-dish"></i> Enhanced Radar Visualization</h2>
      <p className="radar-description">
        Interactive meteorological radar with animation controls, multiple precipitation layers, and weather alerts.
      </p>
      
      {/* Time range selector */}
      <div className="time-range-selector">
        <button 
          className={`time-range-btn ${timeRange === '1hour' ? 'active' : ''}`}
          onClick={() => handleTimeRangeChange('1hour')}
        >
          1 Hour (6-min intervals)
        </button>
        <button 
          className={`time-range-btn ${timeRange === '3hour' ? 'active' : ''}`}
          onClick={() => handleTimeRangeChange('3hour')}
        >
          3 Hours (12-min intervals)
        </button>
      </div>
      
      {/* Layer toggles */}
      <div className="layer-toggles">
        <div className="layer-toggle">
          <input 
            type="checkbox" 
            id="rain-layer" 
            checked={activeLayers.rain} 
            onChange={() => handleLayerToggle('rain')}
          />
          <label htmlFor="rain-layer">Rain</label>
        </div>
        <div className="layer-toggle">
          <input 
            type="checkbox" 
            id="snow-layer" 
            checked={activeLayers.snow} 
            onChange={() => handleLayerToggle('snow')}
          />
          <label htmlFor="snow-layer">Snow</label>
        </div>
        <div className="layer-toggle">
          <input 
            type="checkbox" 
            id="mixed-layer" 
            checked={activeLayers.mixed} 
            onChange={() => handleLayerToggle('mixed')}
          />
          <label htmlFor="mixed-layer">Mixed Precipitation</label>
        </div>
        <div className="layer-toggle">
          <input 
            type="checkbox" 
            id="alerts-layer" 
            checked={activeLayers.alerts} 
            onChange={() => handleLayerToggle('alerts')}
          />
          <label htmlFor="alerts-layer">Weather Alerts</label>
        </div>
      </div>
      
      {/* Opacity controls */}
      <div className="opacity-controls">
        <div className="opacity-control">
          <label htmlFor="radar-opacity">Radar Opacity: {opacity}%</label>
          <input 
            type="range" 
            id="radar-opacity" 
            min="0" 
            max="100" 
            value={opacity} 
            onChange={handleOpacityChange}
          />
        </div>
        <div className="opacity-control">
          <label htmlFor="alert-opacity">Alert Opacity: {alertOpacity}%</label>
          <input 
            type="range" 
            id="alert-opacity" 
            min="0" 
            max="100" 
            value={alertOpacity} 
            onChange={handleAlertOpacityChange}
          />
        </div>
      </div>
      
      {/* Playback speed control */}
      <div className="playback-speed-control">
        <label htmlFor="playback-speed">Animation Speed: {playbackSpeed}ms</label>
        <input 
          type="range" 
          id="playback-speed" 
          min="100" 
          max="1000" 
          step="100" 
          value={playbackSpeed} 
          onChange={handleSpeedChange}
        />
      </div>
      
      {/* Map container */}
      <div className="enhanced-radar-map" ref={mapRef}>
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
            <>
              {activeLayers.rain && (
                <WMSTileLayer
                  url="https://geo.weather.gc.ca/geomet"
                  params={rainLayerParams}
                />
              )}
              {activeLayers.snow && (
                <WMSTileLayer
                  url="https://geo.weather.gc.ca/geomet"
                  params={snowLayerParams}
                />
              )}
              {activeLayers.mixed && (
                <WMSTileLayer
                  url="https://geo.weather.gc.ca/geomet"
                  params={mixedLayerParams}
                />
              )}
              {activeLayers.alerts && (
                <WMSTileLayer
                  url="https://geo.weather.gc.ca/geomet"
                  params={alertsLayerParams}
                />
              )}
            </>
          )}
          <MapUpdater center={mapCenter} />
        </MapContainer>
      </div>
      
      {/* Animation controls */}
      <div className="animation-controls">
        <button className="control-btn" onClick={prevFrame}>
          <i className="fa-solid fa-backward-step"></i>
        </button>
        <button className="control-btn play-pause" onClick={togglePlayPause}>
          {isPlaying ? (
            <i className="fa-solid fa-pause"></i>
          ) : (
            <i className="fa-solid fa-play"></i>
          )}
        </button>
        <button className="control-btn" onClick={nextFrame}>
          <i className="fa-solid fa-forward-step"></i>
        </button>
      </div>
      
      {/* Timeline slider */}
      <div className="timeline-slider">
        <div className="timeline-labels">
          {frames.map((frame, index) => (
            <div 
              key={index} 
              className={`timeline-label ${index === currentFrameIndex ? 'active' : ''}`}
              style={{ left: `${(index / (frames.length - 1)) * 100}%` }}
            >
              {index % Math.ceil(frames.length / 6) === 0 ? frame.formattedTime : ''}
            </div>
          ))}
        </div>
        <input 
          type="range" 
          min="0" 
          max={frames.length - 1} 
          value={currentFrameIndex} 
          onChange={handleTimelineChange}
        />
        <div className="current-time">
          {frames[currentFrameIndex]?.formattedTime || ''}
        </div>
      </div>
      
      {/* Radar legend */}
      <div className="radar-legend">
        <h3>Precipitation Intensity</h3>
        <div className="legend-scale">
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#02FDFF' }}></div>
            <div className="legend-label">Light (0-15 dBZ)</div>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#00C800' }}></div>
            <div className="legend-label">Moderate (15-30 dBZ)</div>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FFFF00' }}></div>
            <div className="legend-label">Heavy (30-40 dBZ)</div>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FF9600' }}></div>
            <div className="legend-label">Very Heavy (40-50 dBZ)</div>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#FF0000' }}></div>
            <div className="legend-label">Intense (50+ dBZ)</div>
          </div>
        </div>
        
        <div className="legend-rates">
          <div className="legend-column">
            <h4>Rain Rate</h4>
            <ul>
              <li>Light: &lt;2.5 mm/h</li>
              <li>Moderate: 2.5-7.5 mm/h</li>
              <li>Heavy: 7.5-25 mm/h</li>
              <li>Very Heavy: 25-50 mm/h</li>
              <li>Intense: &gt;50 mm/h</li>
            </ul>
          </div>
          <div className="legend-column">
            <h4>Snow Rate</h4>
            <ul>
              <li>Light: &lt;1 cm/h</li>
              <li>Moderate: 1-3 cm/h</li>
              <li>Heavy: 3-8 cm/h</li>
              <li>Very Heavy: 8-15 cm/h</li>
              <li>Intense: &gt;15 cm/h</li>
            </ul>
          </div>
        </div>
        
        <div className="alert-legend">
          <h4>Weather Alerts</h4>
          <div className="alert-items">
            <div className="alert-item">
              <div className="alert-color" style={{ backgroundColor: '#FFFF00' }}></div>
              <div className="alert-label">Special Weather Statement</div>
            </div>
            <div className="alert-item">
              <div className="alert-color" style={{ backgroundColor: '#FFA500' }}></div>
              <div className="alert-label">Watch</div>
            </div>
            <div className="alert-item">
              <div className="alert-color" style={{ backgroundColor: '#FF0000' }}></div>
              <div className="alert-label">Warning</div>
            </div>
          </div>
        </div>
        
        <p className="data-source">
          <small>Radar data provided by Environment Canada</small>
        </p>
      </div>
    </div>
  );
};

export default EnhancedRadarMap;