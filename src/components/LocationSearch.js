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

// Canadian postal code regex pattern (A1A 1A1 format)
const POSTAL_CODE_REGEX = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/;

// Helper function to check if a string contains a Canadian postal code
const containsCanadianPostalCode = (term) => {
  return POSTAL_CODE_REGEX.test(term);
};

// Helper function to check if a string contains a province reference
const containsProvinceReference = (term) => {
  const termLower = term.toLowerCase();
  
  // Check for province abbreviations (case insensitive with word boundaries)
  for (const abbr of Object.keys(CANADIAN_PROVINCES)) {
    if (new RegExp(`\\b${abbr}\\b`, 'i').test(term)) {
      return true;
    }
  }
  
  // Check for province full names (partial matches allowed)
  for (const province of Object.values(CANADIAN_PROVINCES)) {
    if (termLower.includes(province.toLowerCase())) {
      return true;
    }
  }
  
  return false;
};

// Helper function to enhance search terms for Canadian locations
const enhanceCanadianSearch = (term) => {
  // If already contains Canada, return as is
  if (term.toLowerCase().includes('canada')) {
    return term;
  }
  
  // If it contains a Canadian postal code, it's definitely Canadian
  if (containsCanadianPostalCode(term)) {
    return `${term}, Canada`;
  }
  
  // If it contains a province reference, it's likely Canadian
  if (containsProvinceReference(term)) {
    return term;
  }
  
  // Otherwise, append Canada to improve search results
  return `${term}, Canada`;
};

// Helper function to extract the main location name from a search term
const extractLocationName = (term) => {
  // Remove postal codes
  let cleanTerm = term.replace(POSTAL_CODE_REGEX, '').trim();
  
  // Remove province abbreviations
  for (const abbr of Object.keys(CANADIAN_PROVINCES)) {
    cleanTerm = cleanTerm.replace(new RegExp(`\\b${abbr}\\b`, 'i'), '').trim();
  }
  
  // Remove province names
  for (const province of Object.values(CANADIAN_PROVINCES)) {
    cleanTerm = cleanTerm.replace(new RegExp(province, 'i'), '').trim();
  }
  
  // Remove "Canada" and common separators
  cleanTerm = cleanTerm.replace(/\bcanada\b/i, '')
                       .replace(/,|;|\|/g, '')
                       .trim();
  
  return cleanTerm;
};

// Generate search terms with different province combinations
const generateProvincialSearchTerms = (locationName) => {
  const terms = [];
  
  // Add terms with each province
  for (const [abbr, province] of Object.entries(CANADIAN_PROVINCES)) {
    terms.push(`${locationName}, ${abbr}, Canada`);
    terms.push(`${locationName}, ${province}, Canada`);
  }
  
  return terms;
};

const LocationSearch = ({ apiKey, onLocationSelect, onUseMyLocation, onSearchTermChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [searchAttempts, setSearchAttempts] = useState(0);
  const [searchStage, setSearchStage] = useState(0);
  const [alternativeSearchTerms, setAlternativeSearchTerms] = useState([]);

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

  // Function to perform a search with a specific term
  const performSearch = async (term) => {
    console.log(`Searching for location: ${term}`);
    
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(term)}&limit=10&appid=${apiKey}`
      );
      
      if (response.data.length > 0) {
        console.log(`Found ${response.data.length} locations for search term:`, term);
        // Sort results to prioritize Canadian locations
        const sortedResults = prioritizeCanadianResults(response.data);
        setSearchResults(sortedResults);
        return true;
      }
      
      console.log('No locations found for search term:', term);
      return false;
    } catch (err) {
      console.error('Search error:', err);
      throw err;
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
    setSearchStage(0);
    setAlternativeSearchTerms([]);
    
    try {
      // Stage 1: Try with enhanced Canadian search term
      const enhancedTerm = enhanceCanadianSearch(searchTerm);
      let searchSuccess = await performSearch(enhancedTerm);
      
      // If first attempt failed and the enhanced term is different from original
      if (!searchSuccess && enhancedTerm !== searchTerm) {
        // Stage 2: Try with original search term
        setSearchStage(1);
        searchSuccess = await performSearch(searchTerm);
      }
      
      // If still no results, try with just the location name + Canada
      if (!searchSuccess) {
        // Stage 3: Try with just the location name + Canada
        setSearchStage(2);
        const locationName = extractLocationName(searchTerm);
        if (locationName && locationName !== searchTerm) {
          searchSuccess = await performSearch(`${locationName}, Canada`);
        }
      }
      
      // If still no results, try with provincial variations
      if (!searchSuccess) {
        // Stage 4: Try with provincial variations
        setSearchStage(3);
        const locationName = extractLocationName(searchTerm);
        if (locationName) {
          // Generate provincial search terms
          const provincialTerms = generateProvincialSearchTerms(locationName);
          setAlternativeSearchTerms(provincialTerms);
          
          // Try each provincial term until we find results or exhaust options
          for (const term of provincialTerms.slice(0, 5)) { // Limit to first 5 to avoid too many requests
            searchSuccess = await performSearch(term);
            if (searchSuccess) break;
          }
        }
      }
      
      // If all attempts failed, show helpful error message
      if (!searchSuccess) {
        const suggestions = [];
        
        // Add suggestions based on the search term
        if (!searchTerm.toLowerCase().includes('canada')) {
          suggestions.push('Add "Canada" to your search');
        }
        
        if (!containsProvinceReference(searchTerm)) {
          suggestions.push('Include a province name or abbreviation (e.g., ON, BC)');
        }
        
        if (searchTerm.length < 3) {
          suggestions.push('Use a more specific search term');
        }
        
        // Format error message with suggestions
        let errorMsg = 'No locations found.';
        if (suggestions.length > 0) {
          errorMsg += ' Try: ' + suggestions.join(', ') + '.';
        }
        
        // If we have alternative terms, suggest them
        if (alternativeSearchTerms.length > 0) {
          errorMsg += ' You can also try searching for specific provinces.';
        }
        
        setError(errorMsg);
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

  // Handle alternative search term click
  const handleAlternativeTermClick = (term) => {
    setSearchTerm(term);
    // Trigger search with the new term
    const fakeEvent = { preventDefault: () => {} };
    setTimeout(() => handleSearch(fakeEvent), 0);
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
      
      {/* Show alternative search suggestions if available and no results found */}
      {error && alternativeSearchTerms.length > 0 && (
        <div className="alternative-terms">
          <p>Try searching with a specific province:</p>
          <ul>
            {alternativeSearchTerms.slice(0, 5).map((term, index) => (
              <li key={index} onClick={() => handleAlternativeTermClick(term)}>
                {term}
              </li>
            ))}
          </ul>
        </div>
      )}
      
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