import React from 'react';
import './LocationInfo.css';

const LocationInfo = ({ isInCanada, cityName, regionName }) => {
  // Build display string - handle missing city name
  let displayLocation = '';
  if (cityName && cityName !== regionName) {
    displayLocation = regionName ? `${cityName}, ${regionName}` : cityName;
  } else if (regionName) {
    displayLocation = regionName;
  } else {
    displayLocation = 'Loading location...';
  }

  return (
    <div className="location-info">
      <div className="location-details">
        <i className="location-icon"></i>
        <span>{displayLocation}</span>
      </div>
      
      {!isInCanada && (
        <div className="canada-alert">
          <p>
            <i className="alert-icon"></i>
            You are viewing weather outside of Canada. For best results, this app is optimized for Canadian locations.
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationInfo; 