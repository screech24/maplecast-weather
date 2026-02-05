import React, { useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import './PageNavigation.css';

const PageNavigation = ({ currentPage, setCurrentPage, totalPages }) => {
  const navContainerRef = useRef(null);

  // Trigger haptic feedback if available
  const triggerHaptic = (type = 'light') => {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate([30, 10, 30]);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  };

  // Handle page change with haptic feedback
  const handlePageChange = (newPage) => {
    if (newPage !== currentPage && newPage >= 0 && newPage < totalPages) {
      triggerHaptic('medium');
      setCurrentPage(newPage);
    }
  };

  // Swipe handlers for mobile navigation
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentPage < totalPages - 1) {
        handlePageChange(currentPage + 1);
      }
    },
    onSwipedRight: () => {
      if (currentPage > 0) {
        handlePageChange(currentPage - 1);
      }
    },
    onSwiping: (eventData) => {
      // Add visual feedback during swipe
      if (navContainerRef.current) {
        const progress = eventData.absX / 100;
        const transform = `translateX(${eventData.dir === 'Left' ? -progress * 20 : progress * 20}px)`;
        navContainerRef.current.style.transform = transform;
      }
    },
    onSwipeEnd: () => {
      // Reset transform after swipe ends
      if (navContainerRef.current) {
        navContainerRef.current.style.transform = 'translateX(0)';
      }
    },
    delta: 30, // Minimum swipe distance
    preventDefaultTouchmoveEvent: true,
    trackMouse: false, // Only track touch events
    trackTouch: true,
  });

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event) => {
      switch (event.key) {
        case 'ArrowLeft':
          if (currentPage > 0) {
            handlePageChange(currentPage - 1);
          }
          break;
        case 'ArrowRight':
          if (currentPage < totalPages - 1) {
            handlePageChange(currentPage + 1);
          }
          break;
        case 'Home':
          handlePageChange(0);
          break;
        case 'End':
          handlePageChange(totalPages - 1);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  return (
    <div className="page-navigation" {...swipeHandlers}>
      <div className="nav-buttons" ref={navContainerRef}>
        <button 
          className={`nav-button ${currentPage === 0 ? 'active' : ''}`} 
          onClick={() => handlePageChange(0)}
          aria-label="Current Weather"
          aria-current={currentPage === 0 ? 'page' : undefined}
        >
          <i className="fa-solid fa-sun"></i>
          <span>Current</span>
        </button>
        <button 
          className={`nav-button ${currentPage === 1 ? 'active' : ''}`} 
          onClick={() => handlePageChange(1)}
          aria-label="Hourly Forecast"
          aria-current={currentPage === 1 ? 'page' : undefined}
        >
          <i className="fa-solid fa-clock"></i>
          <span>Hourly</span>
        </button>
        <button 
          className={`nav-button ${currentPage === 2 ? 'active' : ''}`} 
          onClick={() => handlePageChange(2)}
          aria-label="Daily Forecast"
          aria-current={currentPage === 2 ? 'page' : undefined}
        >
          <i className="fa-solid fa-calendar-days"></i>
          <span>7-Day</span>
        </button>
        <button 
          className={`nav-button ${currentPage === 3 ? 'active' : ''}`} 
          onClick={() => handlePageChange(3)}
          aria-label="Radar Map"
          aria-current={currentPage === 3 ? 'page' : undefined}
        >
          <i className="fa-solid fa-satellite-dish"></i>
          <span>Radar</span>
        </button>
      </div>
      
      {/* Swipe hint for mobile users */}
      <div className="swipe-hint">
        <i className="fa-solid fa-hand-point-left"></i>
        <span>Swipe to navigate</span>
        <i className="fa-solid fa-hand-point-right"></i>
      </div>
    </div>
  );
};

export default PageNavigation; 