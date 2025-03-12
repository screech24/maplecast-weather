import React, { useState, useEffect } from 'react';
import './WeatherAlerts.css';

const WeatherAlerts = ({ alerts, isLoading, error, notificationsEnabled, onCheckAlerts }) => {
  const [expandedAlertIndex, setExpandedAlertIndex] = useState(null);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  
  // Reset expanded state when alerts change
  useEffect(() => {
    setExpandedAlertIndex(null);
    setCurrentAlertIndex(0);
  }, [alerts]);
  
  // Handle alert click
  const toggleAlert = (index) => {
    if (expandedAlertIndex === index) {
      setExpandedAlertIndex(null);
    } else {
      setExpandedAlertIndex(index);
      setCurrentAlertIndex(index);
    }
  };
  
  // Navigate between alerts
  const changeAlert = (newIndex) => {
    const index = (newIndex + alerts.length) % alerts.length;
    setCurrentAlertIndex(index);
    setExpandedAlertIndex(index);
  };
  
  // Format the date
  const formatAlertDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

  // Get severity class based on alert severity
  const getSeverityClass = (alert) => {
    if (!alert || !alert.severity) return '';
    
    switch (alert.severity.toLowerCase()) {
      case 'extreme':
        return 'alert-extreme';
      case 'severe':
        return 'alert-severe';
      case 'moderate':
        return 'alert-moderate';
      default:
        return '';
    }
  };
  
  // If there's an error, show error message
  if (error) {
    return (
      <div className="weather-alerts error">
        <div className="alert-indicator">
          <i className="fa-solid fa-circle-exclamation"></i> {error}
        </div>
      </div>
    );
  }
  
  // If no alerts, show no alerts message
  if (!alerts || alerts.length === 0) {
    return (
      <div className="weather-alerts no-alerts">
        <div className="alert-indicator">
          <i className="fa-solid fa-circle-check"></i> No active weather alerts
          {onCheckAlerts && (
            <button 
              className="check-alerts-button" 
              onClick={onCheckAlerts}
              title="Check for new alerts"
            >
              <i className="fa-solid fa-rotate"></i>
            </button>
          )}
          {notificationsEnabled && (
            <span className="notification-status-indicator" title="Notifications enabled">
              <i className="fa-solid fa-bell-on"></i>
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // If loading, show loading state
  if (isLoading) {
    return (
      <div className="weather-alerts loading">
        <div className="alert-indicator">
          <i className="fa-solid fa-circle-notch fa-spin"></i> Loading alerts...
        </div>
      </div>
    );
  }
  
  // Render alerts
  return (
    <div className="weather-alerts">
      {alerts.length > 0 && (
        <div className="alerts-container">
          <div 
            className={`alert-header ${expandedAlertIndex !== null ? 'expanded' : ''} ${getSeverityClass(alerts[currentAlertIndex])}`}
            onClick={() => toggleAlert(currentAlertIndex)}
          >
            <div className="alert-indicator">
              <i className="fa-solid fa-triangle-exclamation"></i> 
              {alerts.length > 1 
                ? `${alerts.length} Active Weather Alerts` 
                : 'Weather Alert'
              }
            </div>
            <div className="alert-title">
              {alerts[currentAlertIndex].title}
            </div>
            <div className="alert-toggle">
              <i className={`fa-solid ${expandedAlertIndex !== null ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
            </div>
          </div>
          
          {expandedAlertIndex !== null && (
            <div className="alert-details">
              <div className="alert-navigation">
                {alerts.length > 1 && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        changeAlert(currentAlertIndex - 1);
                      }}
                      className="alert-nav-button"
                    >
                      <i className="fa-solid fa-chevron-left"></i> Previous
                    </button>
                    <span className="alert-counter">
                      {currentAlertIndex + 1} of {alerts.length}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        changeAlert(currentAlertIndex + 1);
                      }}
                      className="alert-nav-button"
                    >
                      Next <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </>
                )}
              </div>
              
              <div className="alert-content">
                <h3>{alerts[currentAlertIndex].title}</h3>
                <div className="alert-meta">
                  <p>
                    <i className="fa-regular fa-clock"></i> 
                    {formatAlertDate(alerts[currentAlertIndex].published)}
                  </p>
                  {alerts[currentAlertIndex].expires && (
                    <p>
                      <i className="fa-regular fa-calendar-xmark"></i> 
                      Expires: {formatAlertDate(alerts[currentAlertIndex].expires)}
                    </p>
                  )}
                  {alerts[currentAlertIndex].severity && (
                    <p>
                      <i className="fa-solid fa-exclamation-circle"></i> 
                      Severity: {alerts[currentAlertIndex].severity}
                    </p>
                  )}
                  {alerts[currentAlertIndex].areas && (
                    <p>
                      <i className="fa-solid fa-map-marker-alt"></i> 
                      Areas: {alerts[currentAlertIndex].areas}
                    </p>
                  )}
                  <a 
                    href={alerts[currentAlertIndex].link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on Environment Canada <i className="fa-solid fa-external-link"></i>
                  </a>
                </div>
                <div 
                  className="alert-summary"
                  dangerouslySetInnerHTML={{ __html: alerts[currentAlertIndex].summary }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherAlerts; 