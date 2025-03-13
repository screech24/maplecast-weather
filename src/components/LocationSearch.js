import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LocationSearch.css';
import { devLog, debugLog } from '../utils/devMode';

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
    // Check for exact abbreviation match (case insensitive)
    if (new RegExp(`\\b${abbr}\\b`, 'i').test(term)) {
      debugLog('LocationSearch', `Found province abbreviation in term: ${abbr} in "${term}"`);
      return true;
    }
    
    // Also check for abbreviation without word boundaries (e.g., "ON" in "TORONTO")
    if (termLower.includes(abbr.toLowerCase())) {
      debugLog('LocationSearch', `Found province abbreviation substring in term: ${abbr} in "${term}"`);
      return true;
    }
  }
  
  // Check for province full names (partial matches allowed)
  for (const province of Object.values(CANADIAN_PROVINCES)) {
    const provinceLower = province.toLowerCase();
    
    // Check for exact province name match
    if (termLower.includes(provinceLower)) {
      debugLog('LocationSearch', `Found province name in term: ${province} in "${term}"`);
      return true;
    }
    
    // Also check for partial matches of longer province names (at least 3 chars)
    if (province.length > 3) {
      // Check for first 3+ characters of province names
      const provinceStart = provinceLower.substring(0, 3);
      if (termLower.includes(provinceStart)) {
        debugLog('LocationSearch', `Found partial province match: ${provinceStart} in "${term}"`);
        return true;
      }
      
      // For multi-word provinces, check each word
      const provinceWords = provinceLower.split(' ');
      for (const word of provinceWords) {
        if (word.length > 3 && termLower.includes(word)) {
          debugLog('LocationSearch', `Found province word match: ${word} in "${term}"`);
          return true;
        }
      }
    }
  }
  
  return false;
};

// Helper function to enhance search terms for Canadian locations
const enhanceCanadianSearch = (term) => {
  const termLower = term.toLowerCase().trim();
  
  // If already contains Canada, return as is
  if (termLower.includes('canada')) {
    debugLog('LocationSearch', `Term already contains 'Canada': ${term}`);
    return term;
  }
  
  // If it contains a Canadian postal code, it's definitely Canadian
  if (containsCanadianPostalCode(term)) {
    debugLog('LocationSearch', `Term contains Canadian postal code: ${term}`);
    return `${term}, Canada`;
  }
  
  // If it contains a province reference, it's likely Canadian
  if (containsProvinceReference(term)) {
    debugLog('LocationSearch', `Term contains province reference: ${term}`);
    
    // Check if it already ends with a province abbreviation or name
    let hasProvinceAtEnd = false;
    
    // Check for province abbreviations at the end
    for (const abbr of Object.keys(CANADIAN_PROVINCES)) {
      if (new RegExp(`\\b${abbr}\\b$`, 'i').test(term.trim())) {
        hasProvinceAtEnd = true;
        break;
      }
    }
    
    // Check for province names at the end
    if (!hasProvinceAtEnd) {
      for (const province of Object.values(CANADIAN_PROVINCES)) {
        if (new RegExp(`\\b${province}\\b$`, 'i').test(term.trim())) {
          hasProvinceAtEnd = true;
          break;
        }
      }
    }
    
    // Add Canada explicitly to improve search results
    if (hasProvinceAtEnd) {
      return `${term}, Canada`;
    } else {
      // If province reference is in the middle, ensure proper formatting
      return `${term}, Canada`;
    }
  }
  
  // Otherwise, append Canada to improve search results
  debugLog('LocationSearch', `Adding 'Canada' to term: ${term}`);
  return `${term}, Canada`;
};

// Helper function to extract the main location name from a search term
const extractLocationName = (term) => {
  debugLog('LocationSearch', `Extracting location name from: "${term}"`);
  
  // Remove postal codes
  let cleanTerm = term.replace(POSTAL_CODE_REGEX, '').trim();
  debugLog('LocationSearch', `After removing postal codes: "${cleanTerm}"`);
  
  // Remove province abbreviations
  for (const abbr of Object.keys(CANADIAN_PROVINCES)) {
    const beforeClean = cleanTerm;
    cleanTerm = cleanTerm.replace(new RegExp(`\\b${abbr}\\b`, 'i'), '').trim();
    if (beforeClean !== cleanTerm) {
      debugLog('LocationSearch', `Removed province abbreviation ${abbr}: "${cleanTerm}"`);
    }
  }
  
  // Remove province names
  for (const province of Object.values(CANADIAN_PROVINCES)) {
    const beforeClean = cleanTerm;
    cleanTerm = cleanTerm.replace(new RegExp(`\\b${province}\\b`, 'i'), '').trim();
    if (beforeClean !== cleanTerm) {
      debugLog('LocationSearch', `Removed province name ${province}: "${cleanTerm}"`);
    }
  }
  
  // Remove "Canada" and common separators
  const beforeFinalClean = cleanTerm;
  cleanTerm = cleanTerm.replace(/\bcanada\b/i, '')
                       .replace(/,|;|\|/g, '')
                       .trim();
  
  if (beforeFinalClean !== cleanTerm) {
    debugLog('LocationSearch', `After removing Canada and separators: "${cleanTerm}"`);
  }
  
  // If we've removed too much, return original term
  if (!cleanTerm || cleanTerm.length < 2) {
    debugLog('LocationSearch', `Extracted name too short, using original: "${term}"`);
    return term.replace(/,|;|\|/g, '').trim();
  }
  
  debugLog('LocationSearch', `Final extracted location name: "${cleanTerm}"`);
  return cleanTerm;
};

// Generate search terms with different province combinations
const generateProvincialSearchTerms = (locationName) => {
  const terms = [];
  
  // Clean the location name to ensure it's usable
  const cleanName = locationName.trim().replace(/\s+/g, ' ');
  if (!cleanName) return terms;
  
  debugLog('LocationSearch', `Generating provincial search terms for: "${cleanName}"`);
  
  // Add terms with each province
  for (const [abbr, province] of Object.entries(CANADIAN_PROVINCES)) {
    // Add with abbreviation
    terms.push(`${cleanName}, ${abbr}, Canada`);
    
    // Add with full province name
    terms.push(`${cleanName}, ${province}, Canada`);
    
    // For major cities, try without comma
    if (cleanName.length > 3) {
      terms.push(`${cleanName} ${province} Canada`);
    }
  }
  
  // Add some variations for major cities
  if (cleanName.length > 3) {
    // Try with just Canada
    terms.push(`${cleanName}, Canada`);
    
    // Try with "City" appended for common place names
    if (!cleanName.toLowerCase().includes('city')) {
      terms.push(`${cleanName} City, Canada`);
    }
  }
  
  return terms;
};

const LocationSearch = ({ apiKey, onLocationSelect, onUseMyLocation, onSearchTermChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  // This state is used for tracking search progress and providing feedback
  const [searchStage, setSearchStage] = useState(0); // Used to track the current search stage for debugging
  const [alternativeSearchTerms, setAlternativeSearchTerms] = useState([]);

  useEffect(() => {
    if (apiKey) {
      devLog('LocationSearch', 'Initialized with API key');
      setInitialized(true);
      setError(null);
    } else {
      setInitialized(false);
      setError('API key is not available. Search functionality is limited.');
      devLog('LocationSearch', 'Missing API key', { error: true });
    }
  }, [apiKey]);

  const handleSearchTermChange = (e) => {
    const newTerm = e.target.value;
    setSearchTerm(newTerm);
    // Clear search results when user starts typing a new search
    if (searchResults.length > 0) {
      setSearchResults([]);
    }
    if (onSearchTermChange) {
      onSearchTermChange(newTerm);
    }
  };

  // Function to clear the search box
  // eslint-disable-next-line no-unused-vars
  const clearSearchBox = () => {
    setSearchTerm('');
    setSearchResults([]);
    if (onSearchTermChange) {
      onSearchTermChange('');
    }
  };

  // Function to perform a search with a specific term
  const performSearch = async (term) => {
    devLog('LocationSearch', `Searching for location: ${term}`);
    
    try {
      // Log the exact URL being called for debugging
      const searchUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(term)}&limit=10&appid=${apiKey}`;
      debugLog('LocationSearch', `Search URL: ${searchUrl}`);
      
      const response = await axios.get(searchUrl);
      
      if (response.data.length > 0) {
        devLog('LocationSearch', `Found ${response.data.length} locations for search term: ${term}`);
        debugLog('LocationSearch', 'Raw search results:', response.data);
        
        // Sort results to prioritize Canadian locations
        const sortedResults = prioritizeCanadianResults(response.data);
        setSearchResults(sortedResults);
        return true;
      }
      
      devLog('LocationSearch', `No locations found for search term: ${term}`);
      return false;
    } catch (err) {
      devLog('LocationSearch', `Search error: ${err.message}`, { error: true });
      debugLog('LocationSearch', 'Error details:', err.response ? err.response.data : 'No response data');
      throw err;
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return;
    
    if (!initialized || !apiKey) {
      setError('Search functionality is not available yet. Please wait or try again.');
      devLog('LocationSearch', 'Search attempted before initialization', { error: true });
      return;
    }
    
    setIsSearching(true);
    setError(null);
    setSearchStage(0);
    setAlternativeSearchTerms([]);
    
    devLog('LocationSearch', `Starting search for: ${trimmedSearchTerm}`);
    
    try {
      // Stage 1: Try with enhanced Canadian search term
      const enhancedTerm = enhanceCanadianSearch(trimmedSearchTerm);
      devLog('LocationSearch', `Stage 1: Using enhanced term: "${enhancedTerm}"`);
      let searchSuccess = await performSearch(enhancedTerm);
      
      // If first attempt failed and the enhanced term is different from original
      if (!searchSuccess && enhancedTerm !== trimmedSearchTerm) {
        // Stage 2: Try with original search term
        setSearchStage(1);
        devLog('LocationSearch', `Stage 2: Using original term: "${trimmedSearchTerm}"`);
        searchSuccess = await performSearch(trimmedSearchTerm);
      }
      
      // If still no results, try with just the location name + Canada
      if (!searchSuccess) {
        // Stage 3: Try with just the location name + Canada
        setSearchStage(2);
        const locationName = extractLocationName(trimmedSearchTerm);
        devLog('LocationSearch', `Stage 3: Extracted location name: "${locationName}"`);
        
        if (locationName && locationName !== trimmedSearchTerm) {
          const cleanTerm = `${locationName}, Canada`;
          devLog('LocationSearch', `Stage 3: Using clean term: "${cleanTerm}"`);
          searchSuccess = await performSearch(cleanTerm);
        }
      }
      
      // If still no results, try with direct geocoding API
      if (!searchSuccess) {
        // Stage 4: Try direct geocoding with Canada filter
        setSearchStage(3);
        devLog('LocationSearch', `Stage 4: Trying direct geocoding with Canada filter`);
        
        try {
          // Try a more direct approach with the geocoding API
          const directTerm = trimmedSearchTerm.toLowerCase().includes('canada') ?
            trimmedSearchTerm : `${trimmedSearchTerm}, Canada`;
            
          devLog('LocationSearch', `Stage 4: Using direct term: "${directTerm}"`);
          searchSuccess = await performSearch(directTerm);
        } catch (directError) {
          devLog('LocationSearch', `Direct geocoding error: ${directError.message}`, { error: true });
        }
      }
      
      // If still no results, try with provincial variations
      if (!searchSuccess) {
        // Stage 5: Try with provincial variations
        setSearchStage(4);
        const locationName = extractLocationName(trimmedSearchTerm);
        devLog('LocationSearch', `Stage 5: Using provincial variations for: "${locationName}"`);
        
        if (locationName) {
          // Generate provincial search terms
          const provincialTerms = generateProvincialSearchTerms(locationName);
          setAlternativeSearchTerms(provincialTerms);
          debugLog('LocationSearch', `Generated ${provincialTerms.length} provincial terms:`, provincialTerms);
          
          // Try each provincial term until we find results or exhaust options
          let foundResults = false;
          
          // First try with the most common provinces (ON, BC, AB, QC)
          const priorityProvinces = ['ON', 'BC', 'AB', 'QC'];
          const priorityTerms = provincialTerms.filter(term =>
            priorityProvinces.some(province =>
              term.includes(`, ${province},`) || term.includes(` ${CANADIAN_PROVINCES[province]},`)
            )
          );
          
          // Try priority provinces first
          for (const term of priorityTerms) {
            devLog('LocationSearch', `Stage 5: Trying priority provincial term: "${term}"`);
            searchSuccess = await performSearch(term);
            if (searchSuccess) {
              devLog('LocationSearch', `Found results with priority provincial term: "${term}"`);
              foundResults = true;
              break;
            }
          }
          
          // If still no results, try the remaining provinces
          if (!foundResults) {
            const remainingTerms = provincialTerms.filter(term => !priorityTerms.includes(term));
            for (const term of remainingTerms) {
              devLog('LocationSearch', `Stage 5: Trying provincial term: "${term}"`);
              searchSuccess = await performSearch(term);
              if (searchSuccess) {
                devLog('LocationSearch', `Found results with provincial term: "${term}"`);
                break;
              }
            }
          }
        }
      }
      
      // If all attempts failed, show helpful error message
      if (!searchSuccess) {
        devLog('LocationSearch', 'All search attempts failed');
        const suggestions = [];
        
        // Add suggestions based on the search term
        if (!trimmedSearchTerm.toLowerCase().includes('canada')) {
          suggestions.push('Add "Canada" to your search');
        }
        
        if (!containsProvinceReference(trimmedSearchTerm)) {
          suggestions.push('Include a province name or abbreviation (e.g., ON, BC)');
        }
        
        if (trimmedSearchTerm.length < 3) {
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
      devLog('LocationSearch', `Search error: ${err.message}`, { error: true });
      setError(`Error searching for locations: ${err.message}. Please try again.`);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to prioritize Canadian results
  const prioritizeCanadianResults = (results) => {
    debugLog('LocationSearch', 'Prioritizing results:', results);
    
    // Filter out any results without required properties
    const validResults = results.filter(result => {
      const hasRequiredProps = result && result.lat && result.lon && result.name;
      if (!hasRequiredProps) {
        debugLog('LocationSearch', 'Filtering out invalid result:', result);
      }
      return hasRequiredProps;
    });
    
    // Sort the results
    const sortedResults = validResults.sort((a, b) => {
      // Prioritize Canadian locations
      if (a.country === 'CA' && b.country !== 'CA') return -1;
      if (a.country !== 'CA' && b.country === 'CA') return 1;
      
      // For Canadian locations, sort by name
      if (a.country === 'CA' && b.country === 'CA') {
        return a.name.localeCompare(b.name);
      }
      
      // For non-Canadian locations, prioritize those with state/province info
      if (a.state && !b.state) return -1;
      if (!a.state && b.state) return 1;
      
      // For locations with same country and state status, sort by name
      return a.name.localeCompare(b.name);
    });
    
    debugLog('LocationSearch', 'Sorted results:', sortedResults);
    return sortedResults;
  };

  const handleLocationSelect = (location) => {
    devLog('LocationSearch', 'Location selected:', location);
    
    // Ensure we have all required properties before calling the callback
    const locationData = {
      lat: location.lat,
      lon: location.lon,
      name: location.name || '',
      state: location.state || '',
      country: location.country || ''
    };
    
    // Call the parent component's callback with the location data
    if (onLocationSelect && typeof onLocationSelect === 'function') {
      onLocationSelect(locationData);
    } else {
      devLog('LocationSearch', 'onLocationSelect is not a function or not provided', { error: true });
    }
    
    // Clear search results and search term
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
            onClick={() => {
              // Clear the search box when clicking on it if it already has content
              if (searchTerm) {
                clearSearchBox();
              }
            }}
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
      
      {/* Display error message with search stage info for debugging */}
      {error && <div className="search-error" data-search-stage={searchStage}>{error}</div>}
      
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
              className={`search-result-item ${result.country === 'CA' ? 'canadian-location' : ''}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleLocationSelect(result);
                }
              }}
            >
              <span className="location-name">{formatLocationDisplay(result)}</span>
              <span className="select-indicator">Select</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationSearch; 