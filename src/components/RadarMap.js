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
  const [isLongAnimation, setIsLongAnimation] = useState(false); // Toggle between short (1h) and long (3h) animation
  const animationRef = useRef(null);
  const wmsUrl = 'https://geo.weather.gc.ca/geomet';
  
  // Layer options
  const radarLayers = [
    { name: 'Precipitation (Rain)', value: 'RADAR_1KM_RRAI', label: 'Rain' },
    { name: 'Precipitation (Snow)', value: 'RADAR_1KM_RSNO', label: 'Snow' },
    { name: 'Precipitation (Mixed)', value: 'Radar_1km_SfcPrecipType', label: 'Mixed' }
  ];
  
  // Fetch radar timestamps for animation
  const fetchRadarTimestamps = async () => {
    try {
      console.log('Fetching radar timestamps for layer:', selectedLayer);
      // Get available timestamps from WMS GetCapabilities
      const response = await axios.get(
        `${wmsUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&layer=${selectedLayer}`
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
          console.log(`Extracted ${timeValues.length} comma-separated timestamps`);
        } else if (timeContent.includes('/')) {
          // Handle time ranges in format "start/end/interval"
          const [start, end, interval] = timeContent.split('/');
          console.log(`Found time range: ${start} to ${end} with interval ${interval}`);
          
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Parse interval (e.g., "PT6M" for 6 minutes)
          let intervalMinutes = 6; // Default to 6 minutes
          if (interval && interval.includes('PT') && interval.includes('M')) {
            intervalMinutes = parseInt(interval.replace('PT', '').replace('M', ''), 10);
          }
          console.log(`Using interval of ${intervalMinutes} minutes`);
          
          // Generate timestamps at the specified interval
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            timeValues.push(currentDate.toISOString());
            currentDate.setMinutes(currentDate.getMinutes() + intervalMinutes);
          }
          console.log(`Generated ${timeValues.length} timestamps from range`);
        } else {
          // Single timestamp
          timeValues = [timeContent];
          console.log('Found single timestamp:', timeContent);
        }
        
        console.log(`Found ${timeValues.length} timestamps`);
        
        if (timeValues.length > 0) {
          // Sort timestamps in ascending order
          const sortedTimestamps = timeValues.sort();
          console.log(`Sorted ${sortedTimestamps.length} timestamps`);
          
          // Limit to the most recent timestamps based on animation type
          // Short animation (1h): 11 frames at 6-minute intervals
          // Long animation (3h): 16 frames at 12-minute intervals
          const numFrames = isLongAnimation ? 16 : 11;
          const limitedTimestamps = sortedTimestamps.slice(-numFrames);
          
          setTimestamps(limitedTimestamps);
          // Set current frame to the latest timestamp
          setCurrentFrameIndex(limitedTimestamps.length - 1);
          console.log('Timestamps loaded successfully');
          
          // Verify if the radar data is actually available for the latest timestamp
          try {
            await verifyRadarData(limitedTimestamps[limitedTimestamps.length - 1]);
          } catch (error) {
            console.error('Error verifying radar data:', error);
            // If verification fails, try with the second-to-last timestamp
            if (limitedTimestamps.length > 1) {
              console.log('Trying with second-to-last timestamp');
              setCurrentFrameIndex(limitedTimestamps.length - 2);
            }
          }
          
          return;
        }
      }
      
      console.error('No valid time dimension found for layer:', selectedLayer);
      // Try to get valid timestamps directly from the WMS service
      const validTimestamps = await getValidTimestampsFromWMS();
      if (validTimestamps.length > 0) {
        console.log(`Using ${validTimestamps.length} valid timestamps from WMS service`);
        setTimestamps(validTimestamps);
        setCurrentFrameIndex(validTimestamps.length - 1);
        return;
      }
      
      // Fallback: Generate timestamps for the last 3 hours
      const fallbackTimestamps = generateFallbackTimestamps();
      console.log(`Using ${fallbackTimestamps.length} fallback timestamps`);
      setTimestamps(fallbackTimestamps);
      setCurrentFrameIndex(fallbackTimestamps.length - 1);
    } catch (error) {
      console.error('Error fetching radar timestamps:', error);
      // Try to get valid timestamps directly from the WMS service
      try {
        const validTimestamps = await getValidTimestampsFromWMS();
        if (validTimestamps.length > 0) {
          console.log(`Using ${validTimestamps.length} valid timestamps from WMS service after error`);
          setTimestamps(validTimestamps);
          setCurrentFrameIndex(validTimestamps.length - 1);
          return;
        }
      } catch (wmsError) {
        console.error('Error getting valid timestamps from WMS:', wmsError);
      }
      
      // Fallback: Generate timestamps for the last 3 hours
      const fallbackTimestamps = generateFallbackTimestamps();
      console.log(`Using ${fallbackTimestamps.length} fallback timestamps due to error`);
      setTimestamps(fallbackTimestamps);
      setCurrentFrameIndex(fallbackTimestamps.length - 1);
    }
  };
  
  // Generate fallback timestamps
  const generateFallbackTimestamps = () => {
    const timestamps = [];
    // Use the current year (2025) but generate timestamps for the past 3 hours
    const now = new Date();
    // Set the time to 3 hours ago to ensure we're within the valid time range
    now.setHours(now.getHours() - 3);
    console.log('Generating fallback timestamps starting from 3 hours ago:', now.toISOString());
    
    // Round down to the nearest 6 minutes to align with Environment Canada's update interval
    const roundedMinutes = Math.floor(now.getMinutes() / 6) * 6;
    now.setMinutes(roundedMinutes);
    now.setSeconds(0);
    now.setMilliseconds(0);
    
    // Determine number of frames and interval based on animation type
    const numFrames = isLongAnimation ? 16 : 11;
    const intervalMinutes = isLongAnimation ? 12 : 6;
    
    // Generate timestamps at the specified interval, moving forward in time
    for (let i = 0; i < numFrames; i++) {
      const timestamp = new Date(now);
      timestamp.setMinutes(now.getMinutes() + i * intervalMinutes);
      // Format timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
      timestamps.push(timestamp.toISOString());
    }
    
    return timestamps; // Already in chronological order (oldest to newest)
  };
  
  // Get valid timestamps directly from the WMS service
  const getValidTimestampsFromWMS = async () => {
    try {
      console.log('Attempting to get valid timestamps directly from WMS service');
      // Make a request to the WMS service specifically for the selected layer to get time dimensions
      const response = await axios.get(
        `${wmsUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities&layer=${selectedLayer}`
      );
      
      // Parse the XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response.data, 'text/xml');
      
      // Find the selected layer
      const layers = xmlDoc.getElementsByTagName('Layer');
      let dimensionNode = null;
      
      // Search for the layer and its time dimension
      for (let i = 0; i < layers.length; i++) {
        const nameNodes = layers[i].getElementsByTagName('Name');
        if (nameNodes.length > 0) {
          const layerName = nameNodes[0].textContent.trim();
          if (layerName === selectedLayer) {
            console.log(`Found layer: ${selectedLayer} in GetCapabilities response`);
            // Look for Dimension elements with name="time"
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
        console.log('Found time dimension content:', timeContent);
        let timeValues = [];
        
        // Handle different time formats (comma-separated list or range)
        if (timeContent.includes(',')) {
          timeValues = timeContent.split(',');
          console.log(`Extracted ${timeValues.length} comma-separated timestamps`);
        } else if (timeContent.includes('/')) {
          // Handle time ranges in format "start/end/interval"
          const [start, end, interval] = timeContent.split('/');
          console.log(`Found time range: ${start} to ${end} with interval ${interval}`);
          
          const startDate = new Date(start);
          const endDate = new Date(end);
          
          // Parse interval (e.g., "PT6M" for 6 minutes)
          let intervalMinutes = 6; // Default to 6 minutes
          if (interval && interval.includes('PT') && interval.includes('M')) {
            intervalMinutes = parseInt(interval.replace('PT', '').replace('M', ''), 10);
          }
          console.log(`Using interval of ${intervalMinutes} minutes`);
          
          // Generate timestamps at the specified interval
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            timeValues.push(currentDate.toISOString());
            currentDate.setMinutes(currentDate.getMinutes() + intervalMinutes);
          }
          console.log(`Generated ${timeValues.length} timestamps from range`);
        } else {
          // Single timestamp
          timeValues = [timeContent];
          console.log('Found single timestamp:', timeContent);
        }
        
        if (timeValues.length > 0) {
          // Sort timestamps in ascending order
          const sortedTimestamps = timeValues.sort();
          console.log(`Sorted ${sortedTimestamps.length} timestamps`);
          
          // Limit to the most recent timestamps based on animation type
          const numFrames = isLongAnimation ? 16 : 11;
          const limitedTimestamps = sortedTimestamps.slice(-numFrames);
          console.log(`Limited to ${limitedTimestamps.length} most recent timestamps`);
          
          return limitedTimestamps;
        }
      } else {
        console.log('No time dimension found for layer:', selectedLayer);
      }
      
      // If we couldn't extract timestamps from the time dimension, try using the updateSequence
      const capabilities = xmlDoc.getElementsByTagName('WMS_Capabilities')[0];
      if (capabilities && capabilities.hasAttribute('updateSequence')) {
        const updateSequence = capabilities.getAttribute('updateSequence');
        console.log('WMS service update sequence:', updateSequence);
        
        // Extract the date from the update sequence (format: YYYY-MM-DDTHH:MM:SSZ)
        if (updateSequence && updateSequence.includes('T')) {
          const currentWmsTime = new Date(updateSequence);
          console.log('Current WMS time from updateSequence:', currentWmsTime.toISOString());
          
          // Set the time to 3 hours ago to ensure we're within the valid time range
          currentWmsTime.setHours(currentWmsTime.getHours() - 3);
          console.log('Adjusted to 3 hours ago:', currentWmsTime.toISOString());
          
          // Generate timestamps based on the adjusted WMS time
          const timestamps = [];
          
          // Round down to the nearest 6 minutes
          const roundedMinutes = Math.floor(currentWmsTime.getMinutes() / 6) * 6;
          currentWmsTime.setMinutes(roundedMinutes);
          currentWmsTime.setSeconds(0);
          currentWmsTime.setMilliseconds(0);
          
          // Determine number of frames and interval based on animation type
          const numFrames = isLongAnimation ? 16 : 11;
          const intervalMinutes = isLongAnimation ? 12 : 6;
          
          // Generate timestamps at the specified interval, moving forward in time
          for (let i = 0; i < numFrames; i++) {
            const timestamp = new Date(currentWmsTime);
            timestamp.setMinutes(currentWmsTime.getMinutes() + i * intervalMinutes);
            timestamps.push(timestamp.toISOString());
          }
          
          console.log(`Generated ${timestamps.length} timestamps from updateSequence`);
          return timestamps;
        }
      }
      
      throw new Error('Could not extract valid time from WMS service');
    } catch (error) {
      console.error('Error getting valid timestamps from WMS:', error);
      return [];
    }
  };
  
  // Verify if radar data is available for a timestamp
  const verifyRadarData = async (timestamp) => {
    try {
      console.log('Verifying radar data availability for timestamp:', timestamp);
      // Make a test request to check if the radar data is available
      const testUrl = `${wmsUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=45,-75,46,-74&CRS=EPSG:4326&WIDTH=10&HEIGHT=10&LAYERS=${selectedLayer}&FORMAT=image/png&TIME=${timestamp}`;
      const response = await axios.get(testUrl);
      
      // Check if the response is an error (XML containing ServiceExceptionReport)
      if (response.data && typeof response.data === 'string' && 
          (response.data.includes('ServiceExceptionReport') || 
           response.data.includes('temps en dehors des heures valides') || 
           response.data.includes('time outside valid hours'))) {
        console.error('Radar data is not available for timestamp:', timestamp);
        console.error('Error response:', response.data);
        throw new Error('Invalid timestamp: ' + response.data);
      }
      
      console.log('Radar data is available for timestamp:', timestamp);
      return true;
    } catch (error) {
      console.error('Radar data is not available for timestamp:', timestamp, error.message);
      // If the latest timestamp doesn't work, try the previous one
      if (timestamps.length > 1 && currentFrameIndex > 0) {
        const previousIndex = currentFrameIndex - 1;
        const previousTimestamp = timestamps[previousIndex];
        console.log('Trying previous timestamp:', previousTimestamp);
        setCurrentFrameIndex(previousIndex);
        return await verifyRadarData(previousTimestamp);
      }
      return false;
    }
  };
  
  // Toggle between short (1h) and long (3h) animation
  const toggleAnimationLength = () => {
    setIsLongAnimation(!isLongAnimation);
    // Stop animation when changing animation length
    stopAnimation();
    // Reset timestamps
    setTimestamps([]);
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
  
  // Fetch timestamps when selected layer or animation length changes
  useEffect(() => {
    fetchRadarTimestamps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer, isLongAnimation]);
  
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
            
            <label>
              <input 
                type="checkbox" 
                checked={isLongAnimation} 
                onChange={toggleAnimationLength} 
              />
              3h View
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
          {currentTimestamp && (
            <WMSTileLayer
              url={wmsUrl}
              layers={selectedLayer}
              format="image/png"
              transparent={true}
              version="1.3.0"
              time={currentTimestamp}
              opacity={0.8}
              key={`radar-${selectedLayer}-${currentTimestamp}-${Date.now()}`} // Force refresh
              eventHandlers={{
                loading: () => console.log(`Loading radar layer: ${selectedLayer} for time: ${currentTimestamp}`),
                load: () => console.log(`Loaded radar layer: ${selectedLayer} for time: ${currentTimestamp}`),
                error: (e) => {
                  console.error(`Error loading radar layer: ${selectedLayer} for time: ${currentTimestamp}`, e);
                  // If there's an error, try to use the previous timestamp
                  if (currentFrameIndex > 0) {
                    console.log(`Trying previous frame index: ${currentFrameIndex - 1}`);
                    setCurrentFrameIndex(currentFrameIndex - 1);
                  } else {
                    // If we're already at the first frame, try to fetch new timestamps
                    console.log('Already at first frame, fetching new timestamps');
                    fetchRadarTimestamps();
                  }
                }
              }}
            />
          )}
          
          {/* Weather Alerts Layer */}
          {showAlerts && (
            <WMSTileLayer
              url={wmsUrl}
              layers="ALERTS"
              format="image/png"
              transparent={true}
              version="1.3.0"
              opacity={0.7}
              key={`alerts-${Date.now()}`} // Force refresh
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
              key={`cities-${Date.now()}`} // Force refresh
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
        <p>View: {isLongAnimation ? '3-hour (16 frames, 12-min intervals)' : '1-hour (11 frames, 6-min intervals)'}</p>
      </div>
    </div>
  );
};

export default RadarMap; 