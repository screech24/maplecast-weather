import React, { useState, useEffect, useCallback } from 'react';
import { fetchWeatherAlerts, checkForNewAlerts, clearAlertsCache } from '../utils/alertUtils';
import './WeatherAlerts.css';

const WeatherAlerts = ({ locationInfo, currentPage, isSearching }) => {
  const [alerts, setAlerts] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [prevLocationKey, setPrevLocationKey] = useState(null);

  // Function to fetch alerts
  const fetchAlerts = useCallback(async () => {
    // Don't fetch alerts if we're in the middle of a search
    if (isSearching || !locationInfo || !locationInfo.lat || !locationInfo.lon) {
      console.log('Skipping alert fetch during search or missing coordinates');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedAlerts = await fetchWeatherAlerts(locationInfo);
      console.log('Fetched alerts:', fetchedAlerts);
      setAlerts(fetchedAlerts);
      
      // Auto-expand only if there are alerts and we're on the first page
      if (fetchedAlerts.length > 0 && currentPage === 0) {
        setIsExpanded(true);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to fetch weather alerts');
      setAlerts([]); // Clear alerts on error
    } finally {
      setLoading(false);
    }
  }, [locationInfo, currentPage, isSearching]);

  // Function to check for new alerts from service worker
  const checkForNewAlertsFromServiceWorker = useCallback(async () => {
    // Don't check for alerts if we're in the middle of a search
    if (isSearching || !locationInfo || !locationInfo.lat || !locationInfo.lon) {
      console.log('Skipping alert check during search');
      return;
    }

    try {
      const newAlerts = await checkForNewAlerts(locationInfo);
      if (newAlerts && newAlerts.length > 0) {
        console.log('Found new alerts:', newAlerts);
        setAlerts(prevAlerts => {
          // Merge new alerts with existing ones, avoiding duplicates
          const filteredNewAlerts = newAlerts.filter(
            newAlert => !prevAlerts.some(existingAlert => existingAlert.id === newAlert.id)
          );
          return [...filteredNewAlerts, ...prevAlerts];
        });
        
        // Auto-expand only if we're on the first page
        if (newAlerts.length > 0 && currentPage === 0) {
          setIsExpanded(true);
        }
      }
    } catch (err) {
      console.error('Error checking for new alerts:', err);
    }
  }, [locationInfo, currentPage, isSearching]);

  // Handle location changes
  useEffect(() => {
    if (locationInfo && locationInfo.lat && locationInfo.lon) {
      const locationKey = `${locationInfo.lat},${locationInfo.lon}`;
      
      // Check if location has changed
      if (locationKey !== prevLocationKey) {
        console.log('Location changed, clearing cache and fetching new alerts');
        clearAlertsCache(); // Clear the cache when location changes
        setAlerts([]); // Clear current alerts
        setIsExpanded(false); // Collapse the alert panel
        setExpandedAlertId(null); // Clear expanded alert
        setPrevLocationKey(locationKey); // Update previous location key
        fetchAlerts(); // Fetch new alerts
      }
    } else {
      setAlerts([]); // Clear alerts when no location info
      setIsExpanded(false);
      setExpandedAlertId(null);
    }
  }, [locationInfo, prevLocationKey, fetchAlerts]);

  // Handle page changes
  useEffect(() => {
    // Collapse alerts when changing pages
    if (currentPage !== 0) {
      setIsExpanded(false);
    }
  }, [currentPage]);

  // Set up service worker message listener for new alerts
  useEffect(() => {
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'NEW_ALERTS' && event.data.alerts) {
        console.log('Received new alerts from service worker:', event.data.alerts);
        setAlerts(prevAlerts => {
          // Merge new alerts with existing ones, avoiding duplicates
          const newAlerts = event.data.alerts.filter(
            newAlert => !prevAlerts.some(existingAlert => existingAlert.id === newAlert.id)
          );
          return [...newAlerts, ...prevAlerts];
        });
        
        // Auto-expand only if we're on the first page
        if (event.data.alerts.length > 0 && currentPage === 0) {
          setIsExpanded(true);
        }
      }
    };

    // Add event listener for service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    // Set up periodic check for new alerts (every 5 minutes)
    const checkInterval = setInterval(() => {
      if (locationInfo && locationInfo.lat && locationInfo.lon) {
        checkForNewAlertsFromServiceWorker();
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Clean up
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
      clearInterval(checkInterval);
    };
  }, [locationInfo, checkForNewAlertsFromServiceWorker, currentPage]);

  // Toggle expanded state for the entire alerts container
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Toggle expanded state for a specific alert
  const toggleAlertExpanded = (alertId) => {
    setExpandedAlertId(expandedAlertId === alertId ? null : alertId);
  };

  // Get severity class for styling
  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'Severe':
        return 'alert-severe';
      case 'Moderate':
        return 'alert-moderate';
      case 'Minor':
        return 'alert-minor';
      case 'Past':
        return 'alert-past';
      default:
        return 'alert-unknown';
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  // If no coordinates, don't render anything
  if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
    return null;
  }

  // If no alerts, show a "No active alerts" banner
  if (alerts.length === 0) {
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

  return (
    <div className="weather-alerts-container">
      <div 
        className={`alerts-header ${isExpanded ? 'expanded' : ''}`} 
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
          {loading && <div className="alerts-loading">Loading alerts...</div>}
          
          {error && <div className="alerts-error">{error}</div>}
          
          {!loading && !error && alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`alert-item ${getSeverityClass(alert.severity)}`}
            >
              <div 
                className="alert-header" 
                onClick={() => toggleAlertExpanded(alert.id)}
              >
                <div className="alert-title">
                  <span className="alert-severity-badge">{alert.severity}</span>
                  {alert.title}
                </div>
                <div className="alert-actions">
                  <span className="alert-time">{formatDate(alert.sent)}</span>
                  <i className={`fa-solid ${expandedAlertId === alert.id ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </div>
              </div>
              
              {expandedAlertId === alert.id && (
                <div className="alert-details">
                  <div className="alert-description" dangerouslySetInnerHTML={{ __html: alert.description }}></div>
                  
                  <div className="alert-meta">
                    <div className="alert-meta-item">
                      <strong>Issued:</strong> {formatDate(alert.sent)}
                    </div>
                    {alert.expires && (
                      <div className="alert-meta-item">
                        <strong>Expires:</strong> {formatDate(alert.expires)}
                      </div>
                    )}
                    <div className="alert-meta-item">
                      <strong>Urgency:</strong> {alert.urgency}
                    </div>
                    <div className="alert-meta-item">
                      <strong>Certainty:</strong> {alert.certainty}
                    </div>
                  </div>
                  
                  {alert.link && (
                    <div className="alert-link">
                      <a 
                        href={alert.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Details <i className="fa-solid fa-external-link"></i>
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          <div className="alerts-footer">
            <button className="refresh-alerts-btn" onClick={fetchAlerts} disabled={loading}>
              <i className="fa-solid fa-rotate"></i> Refresh Alerts
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherAlerts; 