import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWeatherAlerts, checkForNewAlerts, clearAlertsCache } from '../utils/alertUtils';
import { EC_ALERT_COLORS } from '../utils/environmentCanadaApi';
import { getProvinceFromCoordinates } from '../utils/canadaLocations';
import './WeatherAlerts.css';

// Polling interval: 1 minute for more responsive updates
const POLLING_INTERVAL = 1 * 60 * 1000;

const WeatherAlerts = ({ locationInfo, currentPage, isSearching }) => {
  const [alerts, setAlerts] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading=true
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [error, setError] = useState(null);
  const [prevLocationKey, setPrevLocationKey] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const pollingRef = useRef(null);
  const fetchInProgressRef = useRef(false);
  const regionTimeoutRef = useRef(null);

  // Function to filter out expired alerts
  const filterExpiredAlerts = useCallback((alertsList) => {
    const now = new Date();
    return alertsList.filter(alert => {
      if (!alert.expires) return true;
      const expiryDate = new Date(alert.expires);
      return expiryDate > now;
    });
  }, []);

  // Function to fetch alerts
  const fetchAlerts = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }

    // Skip if we're in the middle of a search or don't have coordinates
    const hasCoordinates = locationInfo && locationInfo.lat && locationInfo.lon;

    if (isSearching || !hasCoordinates) {
      console.log('Skipping alert fetch: searching or missing coordinates');
      return;
    }

    // Must have a city name to filter alerts properly - without it, all province alerts show
    const cityName = locationInfo.name || locationInfo.city;
    if (!cityName) {
      console.log('⚠️ No city name yet - waiting for location data before fetching alerts...');
      return;
    }

    // Must have a region/province
    const currentRegion = locationInfo.region || locationInfo.state;
    if (!currentRegion) {
      console.log('⚠️ No region yet - waiting for location data before fetching alerts...');
      return;
    }

    // Clear cache on force refresh to get truly fresh data
    if (forceRefresh) {
      console.log('🔄 Force refresh - clearing alerts cache');
      clearAlertsCache();
    }

    fetchInProgressRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log('🚨 Fetching alerts for:', locationInfo?.name, locationInfo?.lat, locationInfo?.lon);
      const fetchedAlerts = await fetchWeatherAlerts(locationInfo);
      console.log('🚨 Fetched alerts:', fetchedAlerts);

      const activeAlerts = filterExpiredAlerts(fetchedAlerts);
      console.log('Active alerts after filtering:', activeAlerts.length);

      setAlerts(activeAlerts);
      setInitialFetchDone(true);
      setLastUpdate(new Date());

      // Auto-expand if there are alerts and we're on the first page
      if (activeAlerts.length > 0 && currentPage === 0) {
        setIsExpanded(true);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to fetch weather alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [locationInfo, currentPage, isSearching, filterExpiredAlerts]);

  // Function to check for new/updated alerts
  const pollForAlerts = useCallback(async () => {
    if (isSearching || !locationInfo || !locationInfo.lat || !locationInfo.lon) {
      return;
    }
    if (fetchInProgressRef.current) {
      return;
    }

    console.log('🔄 Polling for alert updates...');

    try {
      const { newAlerts, updatedAlerts, removedAlerts } = await checkForNewAlerts(locationInfo);

      if (newAlerts.length > 0 || updatedAlerts.length > 0 || removedAlerts.length > 0) {
        console.log(`📢 Alert changes: ${newAlerts.length} new, ${updatedAlerts.length} updated, ${removedAlerts.length} removed`);

        setAlerts(prevAlerts => {
          const removedTitles = new Set(removedAlerts.map(a => a.title));
          const updatedTitles = new Set(updatedAlerts.map(a => a.title));

          let newAlertList = prevAlerts.filter(a =>
            !removedTitles.has(a.title) && !updatedTitles.has(a.title)
          );

          newAlertList = [...newAlerts, ...updatedAlerts, ...newAlertList];

          const activeAlerts = filterExpiredAlerts(newAlertList);
          const severityOrder = { 'Severe': 0, 'Moderate': 1, 'Minor': 2 };
          activeAlerts.sort((a, b) => (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2));

          return activeAlerts;
        });

        setLastUpdate(new Date());

        if (newAlerts.length > 0 && currentPage === 0) {
          setIsExpanded(true);
        }
      }
    } catch (err) {
      console.error('Error polling for alerts:', err);
    }
  }, [locationInfo, currentPage, isSearching, filterExpiredAlerts]);

  // Handle location changes
  useEffect(() => {
    // Create location key from coordinates
    const locationKey = locationInfo?.lat && locationInfo?.lon
      ? `${locationInfo.lat},${locationInfo.lon}`
      : null;

    // Check if we have coordinates
    const hasCoordinates = locationInfo && locationInfo.lat && locationInfo.lon;

    // Check if we have region data
    const hasRegion = locationInfo && (locationInfo.region || locationInfo.state);

    if (locationKey !== prevLocationKey) {
      // Coordinates changed - clear old alerts immediately
      console.log('📍 Coordinates changed, clearing old alerts');
      clearAlertsCache();
      setAlerts([]);
      setIsExpanded(false);
      setExpandedAlertId(null);
      setInitialFetchDone(false);
      setLoading(true);
      setPrevLocationKey(locationKey);

      // Clear any existing timeout
      if (regionTimeoutRef.current) {
        clearTimeout(regionTimeoutRef.current);
        regionTimeoutRef.current = null;
      }

      if (hasCoordinates) {
        if (hasRegion) {
          // Have everything - fetch immediately
          console.log('📍 Complete location available, fetching alerts');
          fetchAlerts(true);
        } else {
          // Have coordinates but no region - wait briefly then fetch anyway
          console.log('📍 Waiting for region data (will fetch in 2s anyway)...');
          regionTimeoutRef.current = setTimeout(() => {
            console.log('📍 Timeout - fetching alerts without region data');
            if (!fetchInProgressRef.current) {
              fetchAlerts(true);
            }
          }, 2000);
        }
      }
    } else if (hasCoordinates && hasRegion && !initialFetchDone && !fetchInProgressRef.current) {
      // Region just became available - cancel timeout and fetch now
      console.log('📍 Region now available, fetching alerts');
      if (regionTimeoutRef.current) {
        clearTimeout(regionTimeoutRef.current);
        regionTimeoutRef.current = null;
      }
      fetchAlerts(true);
    } else if (!locationKey && prevLocationKey !== null) {
      // No location - clear everything
      setAlerts([]);
      setIsExpanded(false);
      setExpandedAlertId(null);
      setInitialFetchDone(false);
      setPrevLocationKey(null);
    }

    // Cleanup timeout on unmount
    return () => {
      if (regionTimeoutRef.current) {
        clearTimeout(regionTimeoutRef.current);
      }
    };
  }, [locationInfo, prevLocationKey, initialFetchDone, fetchAlerts]);

  // Handle page changes
  useEffect(() => {
    if (currentPage !== 0) {
      setIsExpanded(false);
    }
  }, [currentPage]);

  // Set up polling
  useEffect(() => {
    if (locationInfo && locationInfo.lat && locationInfo.lon && !isSearching && initialFetchDone) {
      console.log('🔄 Starting alert polling');

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      pollingRef.current = setInterval(pollForAlerts, POLLING_INTERVAL);

      const handleVisibilityChange = () => {
        if (!document.hidden) {
          pollForAlerts();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [locationInfo, isSearching, initialFetchDone, pollForAlerts]);

  // Regularly filter expired alerts
  useEffect(() => {
    const expiryCheckInterval = setInterval(() => {
      setAlerts(prevAlerts => {
        const activeAlerts = filterExpiredAlerts(prevAlerts);
        if (activeAlerts.length !== prevAlerts.length) {
          console.log('Removing expired alerts, remaining:', activeAlerts.length);
          return activeAlerts;
        }
        return prevAlerts;
      });
    }, 60 * 1000);

    return () => clearInterval(expiryCheckInterval);
  }, [filterExpiredAlerts]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleAlertExpanded = (alertId) => {
    setExpandedAlertId(expandedAlertId === alertId ? null : alertId);
  };

  // Get alert color style based on EC color code
  const getAlertColorStyle = (alert) => {
    const ecColor = alert.ecColor || 'GREY';
    const colors = EC_ALERT_COLORS[ecColor] || EC_ALERT_COLORS.GREY;
    return {
      backgroundColor: colors.bg,
      color: colors.text,
      borderColor: colors.border
    };
  };

  // Get EC color class for border
  const getECColorClass = (alert) => {
    const ecColor = alert.ecColor || 'GREY';
    return `alert-ec-${ecColor.toLowerCase()}`;
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-CA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (err) {
      return dateString;
    }
  };

  // If no coordinates, don't render anything
  if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
    return null;
  }

  // Show loading spinner during initial fetch
  if (loading && !initialFetchDone) {
    return (
      <div className="weather-alerts-container">
        <div className="alerts-header alerts-loading-header">
          <div className="alerts-header-content">
            <i className="fa-solid fa-spinner fa-spin"></i>
            <span>Checking for weather alerts...</span>
          </div>
        </div>
      </div>
    );
  }

  // If no alerts after fetch, show green "No active alerts" banner
  if (alerts.length === 0 && initialFetchDone) {
    return (
      <div className="weather-alerts-container">
        <div className="alerts-header no-alerts">
          <div className="alerts-header-content">
            <i className="fa-solid fa-check-circle"></i>
            <span>No active weather alerts</span>
          </div>
        </div>
      </div>
    );
  }

  // Get the header color based on the most severe alert
  const mostSevereAlert = alerts[0];
  const headerColors = mostSevereAlert?.colors || EC_ALERT_COLORS[mostSevereAlert?.ecColor] || EC_ALERT_COLORS.GREY;

  return (
    <div className="weather-alerts-container">
      <div
        className={`alerts-header ${isExpanded ? 'expanded' : ''}`}
        style={{ backgroundColor: headerColors.bg, color: headerColors.text }}
        onClick={toggleExpanded}
      >
        <div className="alerts-header-content">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>{alerts.length} Weather Alert{alerts.length !== 1 ? 's' : ''}</span>
          <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
        </div>
      </div>

      {isExpanded && (
        <div className="alerts-content">
          {error && <div className="alerts-error">{error}</div>}

          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-item ${getECColorClass(alert)}`}
            >
              <div
                className="alert-header"
                onClick={() => toggleAlertExpanded(alert.id)}
              >
                <div className="alert-title">
                  <span
                    className="alert-type-badge"
                    style={getAlertColorStyle(alert)}
                  >
                    {alert.alertType || 'ALERT'}
                  </span>
                  <span className="alert-title-text">{alert.title}</span>
                </div>
                {/* Show user's matched area in collapsed view */}
                {expandedAlertId !== alert.id && (
                  <div className="alert-areas-preview">
                    <i className="fa-solid fa-map"></i>
                    <span>{alert.matchedArea || alert.coverage || 'Your area'}</span>
                  </div>
                )}
                <div className="alert-actions">
                  <i className={`fa-solid ${expandedAlertId === alert.id ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </div>
              </div>

              {expandedAlertId === alert.id && (
                <div className="alert-details">
                  {/* Issued Time - formatted nicely */}
                  <div className="alert-issued-time">
                    <i className="fa-solid fa-clock"></i>
                    <span>{formatDate(alert.sent)}</span>
                  </div>

                  {/* Impact Level and Confidence */}
                  <div className="alert-meta-grid">
                    <div className="alert-meta-box">
                      <span className="meta-label">Impact Level:</span>
                      <span className={`meta-value impact-${(alert.details?.impactLevel || alert.severity || 'moderate').toLowerCase()}`}>
                        {alert.details?.impactLevel || alert.severity || 'Moderate'}
                      </span>
                    </div>
                    <div className="alert-meta-box">
                      <span className="meta-label">Forecast Confidence:</span>
                      <span className="meta-value">
                        {alert.details?.forecastConfidence || alert.certainty || 'Observed'}
                      </span>
                    </div>
                  </div>

                  {/* Full alert description with proper formatting */}
                  {alert.description && (
                    <div className="alert-description">
                      {alert.description
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => {
                          // Filter out boilerplate footer text
                          const lower = line.toLowerCase();
                          return line &&
                            !lower.startsWith('please continue to monitor') &&
                            !lower.startsWith('for more information') &&
                            !lower.includes('colour-coded weather alerts') &&
                            !lower.includes('color-coded weather alerts') &&
                            !lower.startsWith('to report severe weather') &&
                            !lower.includes('@ec.gc.ca') &&
                            !lower.includes('#onstorm') &&
                            line !== '###';
                        })
                        .map((line, index) => {
                          // Style section headers differently
                          const lower = line.toLowerCase();
                          if (lower === 'what:' || lower === 'when:' || lower === 'where:') {
                            return <p key={index} className="alert-section-header">{line}</p>;
                          }
                          return <p key={index}>{line}</p>;
                        })
                      }
                    </div>
                  )}

                  {/* In Effect For */}
                  <div className="alert-section alert-in-effect">
                    <div className="alert-section-label">
                      <i className="fa-solid fa-map"></i>
                      <span>In Effect For</span>
                    </div>
                    <div className="alert-section-content">{alert.matchedArea || alert.details?.inEffectFor || alert.coverage || 'Your area'}</div>
                  </div>

                  {/* Alert footer metadata */}
                  <div className="alert-footer">
                    {alert.expires && (
                      <div className="alert-expires">
                        <i className="fa-solid fa-hourglass-end"></i>
                        <span>Expires: {formatDate(alert.expires)}</span>
                      </div>
                    )}
                    <div className="alert-source">
                      Source: {alert.provider}
                    </div>
                  </div>

                  {alert.detailsUrl && (
                    <div className="alert-link">
                      <a
                        href={alert.detailsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Full Details on Environment Canada <i className="fa-solid fa-external-link"></i>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="alerts-footer">
            <button className="refresh-alerts-btn" onClick={() => fetchAlerts(true)} disabled={loading}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
              {loading ? 'Refreshing...' : 'Refresh Alerts'}
            </button>
            {lastUpdate && (
              <span className="last-update">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherAlerts;
