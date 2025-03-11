import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LocationSearch.css';

// Canadian provinces mapping for search enhancement
const CANADIAN_PROVINCES = {
  'ON': 'Ontario',
  'QC': 'Quebec',
  'BC': 'British Columbia',
  'AB': 'Alberta',
  'MB': 'Manitoba',
  'SK': 'Saskatchewan',
  'NS': 'Nova Scotia',
  'NB': 'New Brunswick',
  'NL': 'Newfoundland and Labrador',
  'PE': 'Prince Edward Island',
  'YT': 'Yukon',
  'NT': 'Northwest Territories',
  'NU': 'Nunavut'
};

// Helper function to enhance search terms for Canadian locations
const enhanceCanadianSearch = (term) => {
  // If already contains Canada, return as is
  if (term.toLowerCase().includes('canada')) {
    return term;
  }
  
  // Check if it contains a province name or abbreviation
  const termUpper = term.toUpperCase();
  let containsProvince = false;
  
  // Check for province abbreviations (exact match with word boundaries)
  for (const abbr of Object.keys(CANADIAN_PROVINCES)) {
    // Check if the term contains the abbreviation as a whole word
    if (new RegExp(`\\b${abbr}\\b`).test(termUpper)) {
      containsProvince = true;
      break;
    }
  }
  
  // Check for province full names
  if (!containsProvince) {
    for (const province of Object.values(CANADIAN_PROVINCES)) {
      if (term.toLowerCase().includes(province.toLowerCase())) {
        containsProvince = true;
        break;
      }
    }
  }
  
  // If it contains a province reference, it's likely Canadian
  if (containsProvince) {
    return term;
  }
  
  // Otherwise, append Canada to improve search results
  return `${term}, Canada`;
};

const LocationSearch = ({ apiKey, onLocationSelect, onUseMyLocation, onSearchTermChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [searchAttempts, setSearchAttempts] = useState(0);

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
    setSearchAttempts(0);
    
    try {
      // Enhanced search for Canadian locations
      const enhancedTerm = enhanceCanadianSearch(searchTerm);
      console.log(`Searching for location: ${enhancedTerm} (original: ${searchTerm})`);
      
      // Increased limit from 5 to 10 for more comprehensive results
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(enhancedTerm)}&limit=10&appid=${apiKey}`
      );
      
      if (response.data.length === 0) {
        console.log('No locations found for search term:', enhancedTerm);
        
        // Try a fallback search without the enhancement if this was the first attempt
        if (searchAttempts === 0 && enhancedTerm !== searchTerm) {
          setSearchAttempts(1);
          console.log('Trying fallback search with original term:', searchTerm);
          
          const fallbackResponse = await axios.get(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(searchTerm)}&limit=10&appid=${apiKey}`
          );
          
          if (fallbackResponse.data.length === 0) {
            setError('No locations found. Try a different search term or add a province name.');
          } else {
            console.log(`Found ${fallbackResponse.data.length} locations in fallback search`);
            // Sort results to prioritize Canadian locations
            const sortedResults = prioritizeCanadianResults(fallbackResponse.data);
            setSearchResults(sortedResults);
          }
        } else {
          setError('No locations found. Try a different search term or add a province name.');
        }
      } else {
        console.log(`Found ${response.data.length} locations for search term:`, enhancedTerm);
        // Sort results to prioritize Canadian locations
        const sortedResults = prioritizeCanadianResults(response.data);
        setSearchResults(sortedResults);
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(`Error searching for locations: ${err.message}. Please try again.`);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to prioritize Canadian results
  const prioritizeCanadianResults = (results) => {
    return results.sort((a, b) => {
      // Prioritize Canadian locations
      if (a.country === 'CA' && b.country !== 'CA') return -1;
      if (a.country !== 'CA' && b.country === 'CA') return 1;
      
      // For Canadian locations, sort by name
      if (a.country === 'CA' && b.country === 'CA') {
        return a.name.localeCompare(b.name);
      }
      
      // For non-Canadian locations, keep original order
      return 0;
    });
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

  // Helper function to format location display
  const formatLocationDisplay = (result) => {
    let display = result.name;
    
    // Add province/state if available
    if (result.state) {
      display += `, ${result.state}`;
    }
    
    // Add country with special formatting for Canada
    if (result.country) {
      const countryDisplay = result.country === 'CA' ? 'Canada' : result.country;
      display += ` (${countryDisplay})`;
    }
    
    return display;
  };

  return (
    <div className="location-search">
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchTermChange}
            placeholder={initialized ? "Search for a Canadian location..." : "Initializing search..."}
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
            <li 
              key={index} 
              onClick={() => handleLocationSelect(result)}
              className={result.country === 'CA' ? 'canadian-location' : ''}
            >
              {formatLocationDisplay(result)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch; 