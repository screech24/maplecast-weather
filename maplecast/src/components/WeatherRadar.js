import React, { useEffect, useState, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './WeatherRadar.css';

const WeatherRadar = ({ coordinates, isDarkMode }) => {
  const [mapCenter, setMapCenter] = useState(coordinates ? [coordinates.lat, coordinates.lon] : [43.6532, -79.3832]);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const radarLayersRef = useRef([]); // Array of all radar layers for animation
  const windMarkersRef = useRef([]);
  const [isPlaying, setIsPlaying] = useState(false); // Start paused to avoid rate limiting
  const [radarLoading, setRadarLoading] = useState(true);
  const [radarError, setRadarError] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [radarFrames, setRadarFrames] = useState([]);
  const animationIntervalRef = useRef(null);

  // Layer visibility state
  const [layers, setLayers] = useState({
    precipitation: true,
    wind: false
  });
  const [windData, setWindData] = useState(null);
  const [windLoading, setWindLoading] = useState(false);

  // Fetch wind data from Open-Meteo
  const fetchWindData = useCallback(async () => {
    if (!coordinates || !coordinates.lat || !coordinates.lon) return;

    setWindLoading(true);
    try {
      console.log('Fetching wind data from Open-Meteo...');

      // Create a grid of points around the user's location
      const gridSize = 5; // 5x5 grid
      const gridSpacing = 0.5; // degrees (~50km at mid-latitudes)
      const centerLat = coordinates.lat;
      const centerLon = coordinates.lon;

      const points = [];
      for (let i = -Math.floor(gridSize / 2); i <= Math.floor(gridSize / 2); i++) {
        for (let j = -Math.floor(gridSize / 2); j <= Math.floor(gridSize / 2); j++) {
          points.push({
            lat: centerLat + i * gridSpacing,
            lon: centerLon + j * gridSpacing
          });
        }
      }

      // Fetch wind data for all points using Open-Meteo
      const windResults = await Promise.all(
        points.map(async (point) => {
          try {
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`
            );
            if (response.ok) {
              const data = await response.json();
              return {
                lat: point.lat,
                lon: point.lon,
                speed: data.current.wind_speed_10m,
                direction: data.current.wind_direction_10m
              };
            }
          } catch (e) {
            console.log(`Failed to fetch wind for ${point.lat}, ${point.lon}`);
          }
          return null;
        })
      );

      const validResults = windResults.filter(r => r !== null);
      console.log(`Loaded wind data for ${validResults.length} points`);
      setWindData(validResults);
    } catch (error) {
      console.error('Error fetching wind data:', error);
    } finally {
      setWindLoading(false);
    }
  }, [coordinates]);

  // Toggle layer visibility
  const toggleLayer = (layerName) => {
    setLayers(prev => ({
      ...prev,
      [layerName]: !prev[layerName]
    }));
  };

  // Update map center when coordinates change
  useEffect(() => {
    if (coordinates && coordinates.lat && coordinates.lon) {
      const newCenter = [coordinates.lat, coordinates.lon];
      setMapCenter(newCenter);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView(newCenter, 8);
      }
    }
  }, [coordinates]);

  // Fetch wind data when wind layer is enabled
  useEffect(() => {
    if (layers.wind && !windData && !windLoading) {
      fetchWindData();
    }
  }, [layers.wind, windData, windLoading, fetchWindData]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      const map = L.map(mapRef.current, {
        center: mapCenter,
        zoom: 8,
        zoomControl: true,
        attributionControl: true
      });

      mapInstanceRef.current = map;

      // Add base tile layer
      const tileLayer = isDarkMode
        ? L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
          })
        : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
          });

      tileLayer.addTo(map);

      // Add marker for current location
      if (coordinates) {
        const marker = L.marker([coordinates.lat, coordinates.lon]).addTo(map);
        marker.bindPopup('Your Location').openPopup();
      }

      // Fetch radar data
      fetchRadarData();

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setRadarError('Failed to initialize map');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch radar data using multiple sources
  const fetchRadarData = async () => {
    setRadarLoading(true);
    setRadarError(null);
    
    try {
      console.log('Initializing precipitation radar...');
      
      // Try RainViewer first (best for Canada)
      try {
        const rainViewerResponse = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (rainViewerResponse.ok) {
          const data = await rainViewerResponse.json();
          
          if (data.radar && data.radar.past && data.radar.past.length > 0) {
            // Get last 6 frames
            const frames = data.radar.past.slice(-6).map(frame => ({
              url: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2.png`,
              time: frame.time * 1000,
              opacity: 0.7,
              source: 'RainViewer'
            }));
            
            setRadarFrames(frames);
            setCurrentFrame(frames.length - 1); // Start with most recent
            console.log(`Loaded ${frames.length} RainViewer frames`);
            setRadarLoading(false);
            return;
          }
        }
      } catch (rainViewerError) {
        console.log('RainViewer failed, trying OpenWeatherMap...');
      }
      
      // Fallback to OpenWeatherMap precipitation tiles
      const frames = [
        {
          url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png',
          time: Date.now() - 15 * 60 * 1000, // 15 minutes ago
          opacity: 0.4,
          source: 'OpenWeatherMap'
        },
        {
          url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png',
          time: Date.now() - 10 * 60 * 1000, // 10 minutes ago
          opacity: 0.5,
          source: 'OpenWeatherMap'
        },
        {
          url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png',
          time: Date.now() - 5 * 60 * 1000, // 5 minutes ago
          opacity: 0.6,
          source: 'OpenWeatherMap'
        },
        {
          url: 'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png',
          time: Date.now(), // Current
          opacity: 0.7,
          source: 'OpenWeatherMap'
        }
      ];
      
      setRadarFrames(frames);
      setCurrentFrame(frames.length - 1); // Start with current
      console.log(`Loaded ${frames.length} OpenWeatherMap frames`);
      
    } catch (error) {
      console.error('Error initializing radar:', error);
      setRadarError('Unable to load precipitation data. Please try again later.');
      setRadarFrames([]);
    } finally {
      setRadarLoading(false);
    }
  };

  // Initialize all radar layers once when frames are loaded
  useEffect(() => {
    if (!mapInstanceRef.current || radarFrames.length === 0) return;

    // Clear existing radar layers
    radarLayersRef.current.forEach(layer => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    radarLayersRef.current = [];

    // Don't create layers if precipitation is toggled off
    if (!layers.precipitation) return;

    console.log(`Creating ${radarFrames.length} radar layers...`);

    // Create all layers at once (all hidden except current)
    radarFrames.forEach((frame, index) => {
      try {
        const radarLayer = L.tileLayer(frame.url, {
          opacity: index === currentFrame ? 0.7 : 0,
          zIndex: 10,
          tileSize: 256,
          attribution: `Precipitation: ${frame.source || 'RainViewer'}`,
          maxZoom: 18,
          errorTileUrl: '' // Hide broken tiles
        });

        radarLayer.addTo(mapInstanceRef.current);
        radarLayersRef.current.push(radarLayer);
      } catch (error) {
        console.error(`Error creating radar layer ${index}:`, error);
      }
    });

    console.log(`Created ${radarLayersRef.current.length} radar layers`);
  // Only recreate layers when frames change or precipitation toggle changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radarFrames, layers.precipitation]);

  // Update layer opacity when frame changes (without recreating layers)
  useEffect(() => {
    if (radarLayersRef.current.length === 0 || !layers.precipitation) return;

    // Update opacity of all layers
    radarLayersRef.current.forEach((layer, index) => {
      layer.setOpacity(index === currentFrame ? 0.7 : 0);
    });

    if (radarFrames[currentFrame]) {
      console.log(`Showing frame ${currentFrame + 1}/${radarFrames.length}: ${new Date(radarFrames[currentFrame].time).toLocaleString()}`);
    }
  }, [currentFrame, radarFrames, layers.precipitation]);

  // Animation - slower to avoid rate limiting
  useEffect(() => {
    if (!isPlaying || radarFrames.length === 0) {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
      return;
    }

    // Use 2 seconds between frames to avoid rate limiting from RainViewer
    animationIntervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % radarFrames.length);
    }, 2000);

    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
      }
    };
  }, [isPlaying, radarFrames.length]);

  // Render wind arrows on map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing wind markers
    windMarkersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    windMarkersRef.current = [];

    // Don't render if wind layer is off or no data
    if (!layers.wind || !windData || windData.length === 0) return;

    console.log('Rendering wind arrows...');

    // Create wind arrow markers
    windData.forEach(point => {
      // Create a custom icon for wind arrow
      const arrowIcon = L.divIcon({
        className: 'wind-arrow-icon',
        html: `
          <div class="wind-arrow" style="transform: rotate(${point.direction}deg);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L8 10H11V22H13V10H16L12 2Z" fill="${getWindColor(point.speed)}" stroke="#000" stroke-width="0.5"/>
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([point.lat, point.lon], { icon: arrowIcon });
      marker.bindPopup(`
        <div class="wind-popup">
          <strong>Wind</strong><br/>
          Speed: ${point.speed.toFixed(1)} km/h<br/>
          Direction: ${getWindDirection(point.direction)} (${point.direction}°)
        </div>
      `);
      marker.addTo(mapInstanceRef.current);
      windMarkersRef.current.push(marker);
    });

    console.log(`Added ${windMarkersRef.current.length} wind markers`);
  }, [layers.wind, windData]);

  // Helper function to get wind color based on speed
  const getWindColor = (speed) => {
    if (speed < 10) return '#3498db';      // Light - blue
    if (speed < 20) return '#2ecc71';      // Moderate - green
    if (speed < 40) return '#f1c40f';      // Strong - yellow
    if (speed < 60) return '#e67e22';      // Very strong - orange
    return '#e74c3c';                       // Extreme - red
  };

  // Helper function to get wind direction name
  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  // Controls
  const toggleAnimation = () => {
    setIsPlaying(!isPlaying);
  };

  const refreshRadar = () => {
    fetchRadarData();
    setCurrentFrame(0);
  };

  const nextFrame = () => {
    setCurrentFrame((prev) => (prev + 1) % radarFrames.length);
  };

  const prevFrame = () => {
    setCurrentFrame((prev) => (prev - 1 + radarFrames.length) % radarFrames.length);
  };

  return (
    <div className={`weather-radar-container ${isDarkMode ? 'dark-mode' : ''}`}>
      <div className="radar-header">
        <h3>Live Weather Radar</h3>
        <p>Precipitation and wind data for your area</p>
      </div>

      {/* Layer Toggle Controls */}
      <div className="layer-toggles">
        <button
          className={`layer-toggle ${layers.precipitation ? 'active' : ''}`}
          onClick={() => toggleLayer('precipitation')}
        >
          <i className="fa-solid fa-cloud-rain"></i>
          <span>Precipitation</span>
        </button>
        <button
          className={`layer-toggle ${layers.wind ? 'active' : ''}`}
          onClick={() => toggleLayer('wind')}
          disabled={windLoading}
        >
          <i className="fa-solid fa-wind"></i>
          <span>{windLoading ? 'Loading...' : 'Wind'}</span>
        </button>
      </div>

      <div className="radar-status">
        {radarLoading && (
          <div className="radar-loading">
            <div className="loading-spinner"></div>
            <p>Loading radar data...</p>
          </div>
        )}

        {radarError && (
          <div className="radar-error">
            <p>⚠️ {radarError}</p>
            <button onClick={refreshRadar} className="retry-btn">🔄 Retry</button>
          </div>
        )}

        {!radarLoading && !radarError && radarFrames.length > 0 && (
          <div className="radar-controls">
            <button onClick={toggleAnimation} className="radar-btn">
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button onClick={refreshRadar} className="radar-btn">
              🔄 Refresh
            </button>
            <div className="frame-controls">
              <button onClick={prevFrame} className="frame-btn">◀</button>
              <span className="frame-indicator">
                {currentFrame + 1} / {radarFrames.length}
              </span>
              <button onClick={nextFrame} className="frame-btn">▶</button>
            </div>
          </div>
        )}
      </div>

      <div className="map-container">
        <div 
          ref={mapRef} 
          className="radar-map" 
          style={{ 
            width: '100%', 
            height: '500px',
            opacity: radarLoading ? 0.5 : 1
          }}
        ></div>
        
        {!radarLoading && !radarError && radarFrames.length > 0 && (
          <div className="radar-timestamp">
            Frame: {new Date(radarFrames[currentFrame]?.time).toLocaleString()}
          </div>
        )}
      </div>

      <div className="radar-legend">
        {layers.precipitation && (
          <div className="legend-section">
            <h4>Precipitation Intensity</h4>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color light-rain"></div>
                <span>Light Rain</span>
              </div>
              <div className="legend-item">
                <div className="legend-color moderate-rain"></div>
                <span>Moderate Rain</span>
              </div>
              <div className="legend-item">
                <div className="legend-color heavy-rain"></div>
                <span>Heavy Rain</span>
              </div>
            </div>
          </div>
        )}

        {layers.wind && (
          <div className="legend-section">
            <h4>Wind Speed</h4>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color wind-light"></div>
                <span>&lt; 10 km/h (Light)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color wind-moderate"></div>
                <span>10-20 km/h (Moderate)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color wind-strong"></div>
                <span>20-40 km/h (Strong)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color wind-very-strong"></div>
                <span>40-60 km/h (Very Strong)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color wind-extreme"></div>
                <span>&gt; 60 km/h (Extreme)</span>
              </div>
            </div>
          </div>
        )}

        <p className="radar-disclaimer">
          {layers.precipitation && 'Precipitation data from RainViewer. '}
          {layers.wind && 'Wind data from Open-Meteo. '}
          Click arrows for wind details.
        </p>
      </div>
    </div>
  );
};

export default WeatherRadar;