import React, { useState, useEffect, useCallback } from 'react';
import { fetchWeatherAlerts, checkForNewAlerts } from '../utils/alertUtils';
import './WeatherAlerts.css';

const WeatherAlerts = ({ locationInfo, isInCanada }) => {
  const [alerts, setAlerts] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch alerts when location changes
  useEffect(() => {
    if (locationInfo && locationInfo.lat && locationInfo.lon) {
      fetchAlerts();
    } else {
      setAlerts([]);
    }
  }, [locationInfo]);

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
        
        // Auto-expand if there are new alerts
        if (event.data.alerts.length > 0) {
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
  }, [locationInfo, checkForNewAlertsFromServiceWorker]);

  // Function to fetch alerts
  const fetchAlerts = async () => {
    if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
      console.log('Missing coordinates:', locationInfo);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedAlerts = await fetchWeatherAlerts(locationInfo);
      console.log('Fetched alerts:', fetchedAlerts);
      setAlerts(fetchedAlerts);
      
      // Auto-expand if there are alerts
      if (fetchedAlerts.length > 0) {
        setIsExpanded(true);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to fetch weather alerts');
    } finally {
      setLoading(false);
    }
  };

  // Function to check for new alerts from service worker
  const checkForNewAlertsFromServiceWorker = useCallback(async () => {
    if (!locationInfo || !locationInfo.lat || !locationInfo.lon) {
      console.log('Missing coordinates for alert check:', locationInfo);
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
        
        // Auto-expand if there are new alerts
        if (newAlerts.length > 0) {
          setIsExpanded(true);
        }
      }
    } catch (err) {
      console.error('Error checking for new alerts:', err);
    }
  }, [locationInfo]);

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
                        View on Environment Canada <i className="fa-solid fa-external-link"></i>
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