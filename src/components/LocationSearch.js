import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LocationSearch.css';

const LocationSearch = ({ apiKey, onLocationSelect, onUseMyLocation, onSearchTermChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (apiKey) {
      console.log('LocationSearch initialized with API key');
      setInitialized(true);
      setError(null);
    } else {
      setInitialized(false);
      setError('API key is not available. Search functionality is limited.');
      console.error('LocationSearch missing API key');
    }
  }, [apiKey]);

  const handleSearchTermChange = (e) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    if (onSearchTermChange) {
      onSearchTermChange(newTerm);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    if (!initialized || !apiKey) {
      setError('Search functionality is not available yet. Please wait or try again.');
      console.error('Search attempted before initialization');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      console.log(`Searching for location: ${searchTerm}`);
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${searchTerm}&limit=5&appid=${apiKey}`
      );
      
      if (response.data.length === 0) {
        console.log('No locations found for search term:', searchTerm);
        setError('No locations found. Try a different search term.');
      } else {
        console.log(`Found ${response.data.length} locations for search term:`, searchTerm);
        setSearchResults(response.data);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`Error searching for locations: ${err.message}. Please try again.`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLocationSelect = (location) => {
    console.log('Location selected:', location.name);
    onLocationSelect({
      lat: location.lat,
      lon: location.lon,
      name: location.name,
      state: location.state,
      country: location.country
    });
    setSearchResults([]);
    setSearchTerm('');
    if (onSearchTermChange) {
      onSearchTermChange('');
    }
  };

  return (
    <div className="location-search">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchTermChange}
            placeholder={initialized ? "Search for a location..." : "Initializing search..."}
            className={`search-input ${!initialized ? 'disabled' : ''}`}
            disabled={!initialized || isSearching}
          />
          <button 
            type="submit" 
            className="search-button" 
            disabled={!initialized || isSearching || !searchTerm.trim()}
          >
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