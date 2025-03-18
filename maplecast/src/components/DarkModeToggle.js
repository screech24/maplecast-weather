import React from 'react';
import './DarkModeToggle.css';

const DarkModeToggle = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <div className="dark-mode-toggle">
      <input
        type="checkbox"
        id="dark-mode-toggle"
        className="toggle-checkbox"
        checked={isDarkMode}
        onChange={toggleDarkMode}
      />
      <label htmlFor="dark-mode-toggle" className="toggle-label">
        <span className="toggle-inner">
          <i className={`toggle-icon ${isDarkMode ? 'fa-solid fa-moon' : 'fa-solid fa-sun'}`}></i>
        </span>
        <span className="toggle-switch"></span>
      </label>
    </div>
  );
};

export default DarkModeToggle; 