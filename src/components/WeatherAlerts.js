import React, { useState, useEffect } from 'react';
import './WeatherAlerts.css';

const WeatherAlerts = ({ alerts, isLoading, error, notificationsEnabled, onCheckAlerts }) => {
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [showAlertDetails, setShowAlertDetails] = useState(false);
  
  // Reset current alert index when alerts change
  useEffect(() => {
    setCurrentAlertIndex(0);
    // Auto-show details if there's only one alert
    setShowAlertDetails(alerts.length === 1);
  }, [alerts]);
  
  // Format alert date for display
  const formatAlertDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };
  
  // Handle clicking the "Check for Alerts" button
  const handleCheckAlerts = () => {
    if (onCheckAlerts) {
      onCheckAlerts();
    }
  };
  
  // Handle clicking on an alert to show details
  const handleAlertClick = (index) => {
    setCurrentAlertIndex(index);
    setShowAlertDetails(true);
  };
  
  // Handle closing the alert details
  const handleCloseDetails = (e) => {
    e.stopPropagation();
    setShowAlertDetails(false);
  };
  
  // Handle navigating to the next alert
  const handleNextAlert = (e) => {
    e.stopPropagation();
    setCurrentAlertIndex((prev) => (prev + 1) % alerts.length);
  };
  
  // Handle navigating to the previous alert
  const handlePrevAlert = (e) => {
    e.stopPropagation();
    setCurrentAlertIndex((prev) => (prev - 1 + alerts.length) % alerts.length);
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
  
  return (
    <div className="weather-alerts-container">
      <div className="weather-alerts-header">
        <h2>
          <i className="fa-solid fa-triangle-exclamation"></i> Weather Alerts
          {alerts.length > 0 && <span className="alert-count">{alerts.length}</span>}
        </h2>
        <button 
          className="refresh-alerts-button" 
          onClick={handleCheckAlerts}
          disabled={isLoading}
          title="Check for new alerts"
        >
          <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
        </button>
      </div>
      
      {isLoading ? (
        <div className="alerts-loading">
          <div className="loading-spinner"></div>
          <p>Checking for weather alerts...</p>
        </div>
      ) : error ? (
        <div className="alerts-error">
          <p>{error}</p>
          <button className="retry-button" onClick={handleCheckAlerts}>
            Try Again
          </button>
        </div>
      ) : alerts.length === 0 ? (
        <div className="no-alerts">
          <p>No active weather alerts for your location.</p>
          <p className="alerts-note">
            <i className="fa-solid fa-info-circle"></i> Alerts are provided by Environment Canada.
          </p>
        </div>
      ) : (
        <div className="alerts-list">
          {!showAlertDetails ? (
            <div className="alerts-summary">
              {alerts.map((alert, index) => (
                <div 
                  key={alert.id || index} 
                  className={`alert-item ${alert.severity?.toLowerCase() || ''}`}
                  onClick={() => handleAlertClick(index)}
                >
                  <div className="alert-icon">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <div className="alert-summary-content">
                    <h3>{alert.title}</h3>
                    <p className="alert-meta">
                      <span className="alert-time">
                        <i className="fa-regular fa-clock"></i> {formatAlertDate(alert.published)}
                      </span>
                      {alert.severity && (
                        <span className="alert-severity">
                          <i className="fa-solid fa-exclamation-circle"></i> {alert.severity}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="alert-arrow">
                    <i className="fa-solid fa-chevron-right"></i>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert-details">
              <div className="alert-details-header">
                <button 
                  className="close-details-button" 
                  onClick={handleCloseDetails}
                  aria-label="Close alert details"
                >
                  <i className="fa-solid fa-arrow-left"></i> Back
                </button>
                
                {alerts.length > 1 && (
                  <div className="alert-navigation">
                    <button 
                      onClick={handlePrevAlert}
                      disabled={alerts.length <= 1}
                      aria-label="Previous alert"
                    >
                      <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <span>{currentAlertIndex + 1} of {alerts.length}</span>
                    <button 
                      onClick={handleNextAlert}
                      disabled={alerts.length <= 1}
                      aria-label="Next alert"
                    >
                      <i className="fa-solid fa-chevron-right"></i>
                    </button>
                  </div>
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