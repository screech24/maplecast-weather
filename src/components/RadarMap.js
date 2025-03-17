import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, ZoomControl, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './RadarMap.css';

// Custom component to update map when props change
const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

// Custom component to add legend to map
const RadarLegend = () => {
  const map = useMap();
  
  useEffect(() => {
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'radar-legend');
      div.innerHTML = `
        <h4>Radar Intensity</h4>
        <div class="legend-item"><span class="color-box" style="background: #00FF00"></span> Light</div>
        <div class="legend-item"><span class="color-box" style="background: #FFFF00"></span> Moderate</div>
        <div class="legend-item"><span class="color-box" style="background: #FF9900"></span> Heavy</div>
        <div class="legend-item"><span class="color-box" style="background: #FF0000"></span> Intense</div>
      `;
      return div;
    };
    
    legend.addTo(map);
    
    return () => {
      legend.remove();
    };
  }, [map]);
  
  return null;
};

const RadarMap = ({ coordinates, isDarkMode }) => {
  const [selectedLayer, setSelectedLayer] = useState('RADAR_1KM_RRAI');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [timestamps, setTimestamps] = useState([]);
  const [animationSpeed, setAnimationSpeed] = useState(500); // ms between frames
  const [showAlerts, setShowAlerts] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [mapCenter, setMapCenter] = useState(coordinates ? [coordinates.lat, coordinates.lon] : [56.130366, -106.346771]); // Default to center of Canada
  const [mapZoom] = useState(5);
  const animationRef = useRef(null);
  const wmsUrl = 'https://geo.weather.gc.ca/geomet';
  
  // Layer options
  const radarLayers = [
    { name: 'Precipitation (Rain)', value: 'RADAR_1KM_RRAI', label: 'Rain' },
    { name: 'Precipitation (Snow)', value: 'RADAR_1KM_RSNO', label: 'Snow' },
    { name: 'Surface Precipitation Type', value: 'Radar_1km_SfcPrecipType', label: 'Type' }
  ];
  
  // Fetch radar timestamps for animation
  const fetchRadarTimestamps = async () => {
    try {
      console.log('Fetching radar timestamps for layer:', selectedLayer);
      // Get available timestamps from WMS GetCapabilities
      const response = await axios.get(
        `${wmsUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`
      );
      
      // Parse the XML response to extract timestamps
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, 'text/xml');
      
      // Find the selected layer
      const layers = xmlDoc.getElementsByTagName('Layer');
      let dimensionNode = null;
      
      console.log(`Searching for layer: ${selectedLayer} in ${layers.length} layers`);
      
      // More robust layer search
      for (let i = 0; i < layers.length; i++) {
        const nameNodes = layers[i].getElementsByTagName('Name');
        if (nameNodes.length > 0) {
          const layerName = nameNodes[0].textContent.trim();
          if (layerName === selectedLayer) {
            console.log(`Found layer: ${selectedLayer}`);
            const dimensions = layers[i].getElementsByTagName('Dimension');
            for (let j = 0; j < dimensions.length; j++) {
              if (dimensions[j].getAttribute('name') === 'time') {
                dimensionNode = dimensions[j];
                break;
              }
            }
            
            // If we found the dimension, no need to continue searching
            if (dimensionNode) break;
            
            // If we found the layer but no time dimension, check for Extent elements
            // (some WMS services use Extent instead of Dimension for time)
            const extents = layers[i].getElementsByTagName('Extent');
            for (let j = 0; j < extents.length; j++) {
              if (extents[j].getAttribute('name') === 'time') {
                dimensionNode = extents[j];
                break;
              }
            }
            
            break;
          }
        }
      }
      
      if (dimensionNode) {
        // Extract timestamps from the dimension node
        const timeContent = dimensionNode.textContent.trim();
        let timeValues = [];
        
        // Handle different time formats (comma-separated list or range)
        if (timeContent.includes(',')) {
          timeValues = timeContent.split(',');
        } else if (timeContent.includes('/')) {
          // Handle time ranges in format "start/end/interval"
          const [start, end, interval] = timeContent.split('/');
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Parse interval (e.g., "PT10M" for 10 minutes)
          let intervalMinutes = 10; // Default to 10 minutes
          if (interval.includes('PT') && interval.includes('M')) {
            intervalMinutes = parseInt(interval.replace('PT', '').replace('M', ''), 10);
          }
          
          // Generate timestamps at the specified interval
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            timeValues.push(currentDate.toISOString());
            currentDate.setMinutes(currentDate.getMinutes() + intervalMinutes);
          }
        } else {
          // Single timestamp
          timeValues = [timeContent];
        }
        
        console.log(`Found ${timeValues.length} timestamps`);
        
        if (timeValues.length > 0) {
          // Sort timestamps in ascending order
          const sortedTimestamps = timeValues.sort();
          setTimestamps(sortedTimestamps);
          // Set current frame to the latest timestamp
          setCurrentFrameIndex(sortedTimestamps.length - 1);
          console.log('Timestamps loaded successfully');
          return;
        }
      }
      
      console.error('No valid time dimension found for layer:', selectedLayer);
      // Fallback: Generate timestamps for the last 24 hours
      const fallbackTimestamps = generateFallbackTimestamps();
      console.log(`Using ${fallbackTimestamps.length} fallback timestamps`);
      setTimestamps(fallbackTimestamps);
      setCurrentFrameIndex(fallbackTimestamps.length - 1);
    } catch (error) {
      console.error('Error fetching radar timestamps:', error);
      // Fallback: Generate timestamps for the last 24 hours
      const fallbackTimestamps = generateFallbackTimestamps();
      console.log(`Using ${fallbackTimestamps.length} fallback timestamps due to error`);
      setTimestamps(fallbackTimestamps);
      setCurrentFrameIndex(fallbackTimestamps.length - 1);
    }
  };
  
  // Generate fallback timestamps for the last 24 hours
  const generateFallbackTimestamps = () => {
    const timestamps = [];
    // Use the device's system time
    const now = new Date();
    console.log('Generating fallback timestamps from current time:', now.toISOString());
    
    // Generate timestamps for the last 24 hours at 10-minute intervals
    for (let i = 0; i < 144; i++) {
      const timestamp = new Date(now);
      timestamp.setMinutes(now.getMinutes() - i * 10);
      // Format timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
      timestamps.push(timestamp.toISOString());
    }
    
    return timestamps.reverse(); // Oldest to newest
  };
  
  // Start animation
  const startAnimation = () => {
    if (timestamps.length === 0) {
      console.log('Cannot start animation: No timestamps available');
      return;
    }
    
    console.log('Starting animation');
    setIsPlaying(true);
    
    const animate = () => {
      setCurrentFrameIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % timestamps.length;
        return nextIndex;
      });
      
      animationRef.current = setTimeout(animate, animationSpeed);
    };
    
    animationRef.current = setTimeout(animate, animationSpeed);
  };
  
  // Stop animation
  const stopAnimation = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  };
  
  // Toggle animation
  const toggleAnimation = () => {
    console.log('Toggle animation, current state:', isPlaying);
    if (isPlaying) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      // Use the device's system time zone for display
      const date = new Date(timestamp);
      return date.toLocaleString('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use device's time zone
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return timestamp;
    }
  };
  
  // Change radar layer
  const handleLayerChange = (e) => {
    const newLayer = e.target.value;
    setSelectedLayer(newLayer);
    // Stop animation when changing layers
    stopAnimation();
    // Reset timestamps
    setTimestamps([]);
  };
  
  // Change animation speed
  const handleSpeedChange = (e) => {
    const newSpeed = parseInt(e.target.value, 10);
    setAnimationSpeed(newSpeed);
    
    // Restart animation if it's playing
    if (isPlaying) {
      stopAnimation();
      startAnimation();
    }
  };
  
  // Fetch timestamps when selected layer changes
  useEffect(() => {
    fetchRadarTimestamps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer]);
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);
  
  // Update map center when coordinates change
  useEffect(() => {
    if (coordinates) {
      setMapCenter([coordinates.lat, coordinates.lon]);
    }
  }, [coordinates]);
  
  // Get current timestamp
  const currentTimestamp = timestamps[currentFrameIndex];
  
  // Dark mode tile layer URL
  const tileLayerUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  
  // Tile layer attribution
  const tileLayerAttribution = isDarkMode
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  
  return (
    <div className="radar-map-container">
      <div className={`radar-controls ${isDarkMode ? 'dark-mode' : ''}`}>
        <div className="radar-layer-controls">
          <label htmlFor="radar-layer">Radar Type:</label>
          <select 
            id="radar-layer" 
            value={selectedLayer} 
            onChange={handleLayerChange}
            className={isDarkMode ? 'dark-mode' : ''}
          >
            {radarLayers.map(layer => (
              <option key={layer.value} value={layer.value}>{layer.name}</option>
            ))}
          </select>
          
          <div className="toggle-controls">
            <label>
              <input 
                type="checkbox" 
                checked={showAlerts} 
                onChange={() => setShowAlerts(!showAlerts)} 
              />
              Alerts
            </label>
            
            <label>
              <input 
                type="checkbox" 
                checked={showCities} 
                onChange={() => setShowCities(!showCities)} 
              />
              Cities
            </label>
            
            <label>
              <input 
                type="checkbox" 
                checked={showLegend} 
                onChange={() => setShowLegend(!showLegend)} 
              />
              Legend
            </label>
          </div>
        </div>
        
        <div className="animation-controls">
          <button 
            onClick={toggleAnimation}
            className={`animation-button ${isDarkMode ? 'dark-mode' : ''}`}
            aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? (
              <i className="fa-solid fa-pause"></i>
            ) : (
              <i className="fa-solid fa-play"></i>
            )}
          </button>
          
          <div className="timestamp-display">
            {formatTimestamp(currentTimestamp)}
          </div>
          
          <div className="speed-control">
            <label htmlFor="animation-speed">Speed:</label>
            <select 
              id="animation-speed" 
              value={animationSpeed} 
              onChange={handleSpeedChange}
              className={isDarkMode ? 'dark-mode' : ''}
            >
              <option value="2000">Slow</option>
              <option value="1000">Medium</option>
              <option value="500">Fast</option>
              <option value="250">Very Fast</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          zoomControl={false}
          attributionControl={true}
          className={`radar-map ${isDarkMode ? 'dark-mode' : ''}`}
        >
          <MapUpdater center={mapCenter} zoom={mapZoom} />
          
          <TileLayer
            attribution={tileLayerAttribution}
            url={tileLayerUrl}
          />
          
          {/* Radar Layer */}
          <WMSTileLayer
            url={wmsUrl}
            layers={selectedLayer}
            format="image/png"
            transparent={true}
            version="1.3.0"
            time={currentTimestamp}
            opacity={0.8}
          />
          
          {/* Weather Alerts Layer */}
          {showAlerts && (
            <WMSTileLayer
              url={wmsUrl}
              layers="ALERTS"
              format="image/png"
              transparent={true}
              version="1.3.0"
              opacity={0.7}
            />
          )}
          
          {/* Cities Layer */}
          {showCities && (
            <WMSTileLayer
              url={wmsUrl}
              layers="CITIES"
              format="image/png"
              transparent={true}
              version="1.3.0"
              opacity={1}
            />
          )}
          
          <ZoomControl position="topright" />
          <ScaleControl position="bottomleft" imperial={false} />
          
          {showLegend && <RadarLegend />}
        </MapContainer>
      </div>
      
      <div className="radar-info">
        <p>Radar data provided by Environment Canada MSC GeoMet service.</p>
        <p>Last updated: {formatTimestamp(currentTimestamp)}</p>
      </div>
    </div>
  );
};

export default RadarMap; 