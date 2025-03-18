import React from 'react';
import './Header.css';
import DarkModeToggle from './DarkModeToggle';
import mapleLeaf from '../assets/icons/maple-leaf.svg';

const Header = ({ cityName, isDarkMode, toggleDarkMode, notificationsEnabled }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-container">
          <img src={mapleLeaf} alt="Maple Leaf" className="maple-leaf-icon" />
          <h1>MapleCast</h1>
        </div>
        <div className="header-right">
          {notificationsEnabled && (
            <div className="notification-status" title="Weather notifications enabled">
              <i className="fa-solid fa-bell"></i>
            </div>
          )}
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