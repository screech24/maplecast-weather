/**
 * Mock CAP alerts for development and testing
 * These alerts will be used when no real alerts are found from Environment Canada
 */

/**
 * Generate a mock alert for a specific region
 * @param {string} region - The region name (e.g., "Edmonton")
 * @param {string} province - The province name (e.g., "Alberta")
 * @param {string} type - The alert type (e.g., "warning", "watch", "statement")
 * @param {string} event - The event type (e.g., "snowfall", "thunderstorm", "wind")
 * @param {Object} coordinates - The coordinates {lat, lon} for the center of the alert
 * @returns {Object} A mock alert object
 */
const generateMockAlert = (region, province, type, event, coordinates) => {
  const now = new Date();
  const id = `mock-${region}-${type}-${now.getTime()}`;
  const title = `${event.charAt(0).toUpperCase() + event.slice(1)} ${type} in effect for ${region}`;
  
  // Create a polygon around the coordinates (roughly 50km square)
  const lat = coordinates.lat;
  const lon = coordinates.lon;
  const offset = 0.45; // Roughly 50km
  
  const polygon = [
    [lon - offset, lat - offset],
    [lon + offset, lat - offset],
    [lon + offset, lat + offset],
    [lon - offset, lat + offset],
    [lon - offset, lat - offset] // Close the polygon
  ];
  
  return {
    id,
    title,
    description: `Environment Canada has issued a ${event} ${type} for ${region}, ${province}. This is a mock alert for development purposes.`,
    sent: now.toISOString(),
    effective: now.toISOString(),
    expires: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
    status: 'Actual',
    msgType: 'Alert',
    category: 'Met',
    severity: type === 'warning' ? 'Moderate' : (type === 'watch' ? 'Minor' : 'Unknown'),
    certainty: 'Likely',
    urgency: 'Expected',
    areas: [
      {
        description: `${region}, ${province}`,
        polygon: polygon,
        circle: {
          center: [lon, lat],
          radius: 50 // 50km radius
        }
      }
    ],
    sourceUrl: 'https://weather.gc.ca/warnings/index_e.html',
    web: 'https://weather.gc.ca/warnings/index_e.html',
    references: [],
    isMock: true // Flag to indicate this is a mock alert
  };
};

/**
 * Mock alerts for different regions of Canada
 * These will be used when no real alerts are found
 */
export const mockAlerts = [
  // Edmonton, Alberta - Snowfall Warning
  generateMockAlert('Edmonton', 'Alberta', 'warning', 'snowfall', { lat: 53.5461, lon: -113.4938 }),
  
  // Calgary, Alberta - Wind Warning
  generateMockAlert('Calgary', 'Alberta', 'warning', 'wind', { lat: 51.0447, lon: -114.0719 }),
  
  // Vancouver, British Columbia - Rainfall Warning
  generateMockAlert('Vancouver', 'British Columbia', 'warning', 'rainfall', { lat: 49.2827, lon: -123.1207 }),
  
  // Toronto, Ontario - Thunderstorm Watch
  generateMockAlert('Toronto', 'Ontario', 'watch', 'thunderstorm', { lat: 43.6532, lon: -79.3832 }),
  
  // Montreal, Quebec - Freezing Rain Warning
  generateMockAlert('Montreal', 'Quebec', 'warning', 'freezing rain', { lat: 45.5017, lon: -73.5673 }),
  
  // Halifax, Nova Scotia - Storm Surge Warning
  generateMockAlert('Halifax', 'Nova Scotia', 'warning', 'storm surge', { lat: 44.6488, lon: -63.5752 }),
  
  // Winnipeg, Manitoba - Extreme Cold Warning
  generateMockAlert('Winnipeg', 'Manitoba', 'warning', 'extreme cold', { lat: 49.8951, lon: -97.1384 }),
  
  // Saskatoon, Saskatchewan - Blizzard Warning
  generateMockAlert('Saskatoon', 'Saskatchewan', 'warning', 'blizzard', { lat: 52.1332, lon: -106.6700 })
];

/**
 * Get mock alerts for a specific region
 * @param {string} region - The region name to filter by (optional)
 * @returns {Array} Array of mock alerts, filtered by region if specified
 */
export const getMockAlerts = (region = null) => {
  if (!region) {
    return mockAlerts;
  }
  
  return mockAlerts.filter(alert => {
    return alert.areas.some(area => 
      area.description.toLowerCase().includes(region.toLowerCase())
    );
  });
}; 