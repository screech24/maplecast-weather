import React from 'react';
import './PageNavigation.css';

const PageNavigation = ({ currentPage, setCurrentPage, totalPages }) => {
  return (
    <div className="page-navigation">
      <div className="nav-buttons">
        <button 
          className={`nav-button ${currentPage === 0 ? 'active' : ''}`} 
          onClick={() => setCurrentPage(0)}
          aria-label="Current Weather"
        >
          <i className="fa-solid fa-sun"></i>
          <span>Current</span>
        </button>
        <button 
          className={`nav-button ${currentPage === 1 ? 'active' : ''}`} 
          onClick={() => setCurrentPage(1)}
          aria-label="Hourly Forecast"
        >
          <i className="fa-solid fa-clock"></i>
          <span>Hourly</span>
        </button>
        <button 
          className={`nav-button ${currentPage === 2 ? 'active' : ''}`} 
          onClick={() => setCurrentPage(2)}
          aria-label="Daily Forecast"
        >
          <i className="fa-solid fa-calendar-days"></i>
          <span>7-Day</span>
        </button>
      </div>
      <div className="page-indicators">
        {Array.from({ length: totalPages }).map((_, index) => (
          <div 
            key={index} 
            className={`page-indicator ${currentPage === index ? 'active' : ''}`}
            onClick={() => setCurrentPage(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default PageNavigation; 