import React, { useState } from 'react';
import axios from 'axios';
import './LocationSearch.css';

const LocationSearch = ({ apiKey, onLocationSelect, onUseMyLocation }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${searchTerm}&limit=5&appid=${apiKey}`
      );
      
      if (response.data.length === 0) {
        setError('No locations found. Try a different search term.');
      } else {
        setSearchResults(response.data);
      }
    } catch (err) {
      setError('Error searching for locations. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location) => {
    onLocationSelect({
      lat: location.lat,
      lon: location.lon,
      name: location.name,
      state: location.state,
      country: location.country
    });
    setSearchResults([]);
    setSearchTerm('');
  };

  return (
    <div className="location-search">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for a location..."
            className="search-input"
          />
          <button type="submit" className="search-button" disabled={isSearching}>
            {isSearching ? <span className="loading-dot"></span> : <span className="search-icon"></span>}
          </button>
        </div>
        
        <button 
          type="button" 
          className="location-button"
          onClick={onUseMyLocation}
        >
          <span className="location-dot"></span> Use my location
        </button>
      </form>
      
      {error && <div className="search-error">{error}</div>}
      
      {searchResults.length > 0 && (
        <ul className="search-results">
          {searchResults.map((result, index) => (
            <li key={index} onClick={() => handleLocationSelect(result)}>
              {result.name}
              {result.state ? `, ${result.state}` : ''} 
              {result.country ? ` (${result.country})` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch; 