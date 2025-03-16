import React, { useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import CurrentWeather from './CurrentWeather';
import Forecast from './Forecast';
import HourlyForecast from './HourlyForecast';
import RadarMap from './RadarMap';
import './WeatherPages.css';

const WeatherPages = ({ weatherData, currentPage, setCurrentPage, coordinates, isDarkMode }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayedPage, setDisplayedPage] = useState(0);
  const [showSwipeIndicator, setShowSwipeIndicator] = useState(true);
  const TOTAL_PAGES = 4;

  // Handle page changes with transition
  const changePage = (newPage) => {
    if (newPage !== currentPage && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentPage(newPage);
      setShowSwipeIndicator(false);
    }
  };

  // Update displayed page after transition
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setDisplayedPage(currentPage);
        setIsTransitioning(false);
      }, 300); // Match this with the CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, currentPage]);

  // Update displayed page when currentPage prop changes
  useEffect(() => {
    setDisplayedPage(currentPage);
  }, [currentPage]);

  // Hide swipe indicator after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSwipeIndicator(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Handle swipe gestures
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentPage < TOTAL_PAGES - 1) {
        changePage(currentPage + 1);
      }
    },
    onSwipedRight: () => {
      if (currentPage > 0) {
        changePage(currentPage - 1);
      }
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });

  // Render the current page content
  const renderPageContent = () => {
    // Use displayedPage for rendering to ensure smooth transitions
    switch (displayedPage) {
      case 0:
        return <CurrentWeather data={weatherData} />;
      case 1:
        return <HourlyForecast data={weatherData} />;
      case 2:
        return <Forecast data={weatherData} />;
      case 3:
        return <RadarMap coordinates={coordinates} isDarkMode={isDarkMode} />;
      default:
        return <CurrentWeather data={weatherData} />;
    }
  };

  return (
    <div className="weather-pages-container">
      <div 
        {...handlers} 
        className={`weather-pages-content ${isTransitioning ? 'transitioning' : ''}`}
      >
        {renderPageContent()}
        
        {showSwipeIndicator && window.innerWidth <= 768 && (
          <div className="swipe-indicator">
            <i className="fa-solid fa-chevron-left"></i>
            Swipe to navigate
            <i className="fa-solid fa-chevron-right"></i>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPages; 