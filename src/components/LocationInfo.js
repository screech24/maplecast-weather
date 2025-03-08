import React from 'react';
import './LocationInfo.css';

const LocationInfo = ({ isInCanada, cityName, regionName }) => {
  return (
    <div className="location-info">
      <div className="location-details">
        <i className="location-icon"></i>
        <span>{cityName}{regionName ? `, ${regionName}` : ''}</span>
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