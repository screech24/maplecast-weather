/**
 * Development Mode Utilities
 * 
 * This file contains utilities for development and debugging.
 * These functions will only be active in development mode.
 */

// Check if we're in development mode
export const isDevelopment = process.env.REACT_APP_ENV === 'development';

// Check if debug mode is enabled
export const isDebugMode = process.env.REACT_APP_DEBUG === 'true';

/**
 * Enhanced console logging that only runs in development mode
 * @param {string} component - The component name
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
export const devLog = (component, message, data = null) => {
  if (isDevelopment) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}][${component}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

/**
 * Debug logging that only runs when debug mode is enabled
 * @param {string} component - The component name
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
export const debugLog = (component, message, data = null) => {
  if (isDevelopment && isDebugMode) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[DEBUG][${timestamp}][${component}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
};

/**
 * Performance measurement utility
 * @param {string} label - The label for the performance measurement
 * @returns {Function} - Function to call when the operation is complete
 */
export const measurePerformance = (label) => {
  if (!isDevelopment) return () => {};
  
  const start = performance.now();
  return () => {
    const end = performance.now();
    const duration = end - start;
    devLog('Performance', `${label}: ${duration.toFixed(2)}ms`);
  };
};

/**
 * Add development-only UI elements to the DOM
 * @param {string} id - The ID for the debug element
 * @param {Function} renderFn - Function that returns JSX to render
 * @returns {boolean} - Whether the debug element was added
 */
export const addDevUI = (id, renderFn) => {
  if (!isDevelopment) return false;
  
  // This function would be used with React's useEffect to add development-only UI elements
  return true;
};