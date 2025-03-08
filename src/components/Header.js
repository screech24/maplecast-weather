import React from 'react';
import './Header.css';
import DarkModeToggle from './DarkModeToggle';

const Header = ({ cityName, isDarkMode, toggleDarkMode }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-container">
          <div className="maple-leaf"></div>
          <h1>Canada Weather Radar</h1>
        </div>
        <div className="header-right">
          <DarkModeToggle 
            isDarkMode={isDarkMode} 
            toggleDarkMode={toggleDarkMode} 
          />
        </div>
      </div>
    </header>
  );
};

export default Header; 