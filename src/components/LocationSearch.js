import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LocationSearch.css';
import { devLog, debugLog, isDevelopment } from '../utils/devMode';
import { searchCanadianLocations, CANADIAN_PROVINCES } from '../utils/canadaLocations';

// Canadian provinces mapping for search enhancement
// Now imported from canadaLocations.js

// Special location types for enhanced search
// eslint-disable-next-line no-unused-vars
const SPECIAL_LOCATION_TYPES = [
  'national park',
  'provincial park',
  'park',
  'reserve',
  'conservation area',
  'wilderness',
  'mountain',
  'lake',
  'river',
  'falls',
  'bay',
  'island',
  'peninsula',
  'glacier',
  'forest',
  'beach',
  'valley',
  'canyon',
  'trail',
  'historic site',
  'monument'
];

// Canadian postal code regex pattern (A1A 1A1 format)
const POSTAL_CODE_REGEX = /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/;

// Helper function to check if a string contains a Canadian postal code
const containsCanadianPostalCode = (term) => {
  return POSTAL_CODE_REGEX.test(term);
};

// Helper function to check if a string contains a special location type
const containsSpecialLocationType = (term) => {
  const termLower = term.toLowerCase();
  
  for (const locationType of SPECIAL_LOCATION_TYPES) {
    if (termLower.includes(locationType)) {
      debugLog('LocationSearch', `Found special location type in term: ${locationType} in "${term}"`);
      return locationType;
    }
  }
  
  return null;
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
  
  // Check for special location types like parks, mountains, etc.
  const specialLocationType = containsSpecialLocationType(term);
  if (specialLocationType) {
    debugLog('LocationSearch', `Term contains special location type: ${specialLocationType} in "${term}"`);
    
    // For national parks and other special locations, try different formats
    if (specialLocationType === 'national park') {
      return `${term}, Canada`;
    }
    
    // For other special location types, ensure proper formatting
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

// Known parks and their provinces - this helps with disambiguation
const KNOWN_PARKS = {
  'banff': 'AB',
  'jasper': 'AB',
  'yoho': 'BC',
  'kootenay': 'BC',
  'waterton lakes': 'AB',
  'glacier': 'BC',
  'mount revelstoke': 'BC',
  'pacific rim': 'BC',
  'gwaii haanas': 'BC',
  'wood buffalo': 'AB',
  'elk island': 'AB',
  'riding mountain': 'MB',
  'prince albert': 'SK',
  'grasslands': 'SK',
  'bruce peninsula': 'ON',
  'point pelee': 'ON',
  'thousand islands': 'ON',
  'georgian bay islands': 'ON',
  'pukaskwa': 'ON',
  'la mauricie': 'QC',
  'forillon': 'QC',
  'fundy': 'NB',
  'kouchibouguac': 'NB',
  'cape breton highlands': 'NS',
  'kejimkujik': 'NS',
  'prince edward island': 'PE',
  'terra nova': 'NL',
  'gros morne': 'NL',
  'auyuittuq': 'NU',
  'quttinirpaaq': 'NU',
  'sirmilik': 'NU',
  'ukkusiksalik': 'NU',
  'tuktut nogait': 'NT',
  'nahanni': 'NT',
  'aulavik': 'NT',
  'ivvavik': 'YT',
  'kluane': 'YT',
  'vuntut': 'YT',
  'monkman': 'BC',  // Monkman Park is in BC
  'wells gray': 'BC',
  'garibaldi': 'BC',
  'strathcona': 'BC',
  'algonquin': 'ON',
  'killarney': 'ON',
  'quetico': 'ON',
  'la verendrye': 'QC',
  'gaspesie': 'QC'
};

// Helper function to find the province for a known park
const findKnownParkProvince = (parkName) => {
  // Try exact match first
  if (KNOWN_PARKS[parkName]) {
    debugLog('LocationSearch', `Found exact match for known park: ${parkName} in province ${KNOWN_PARKS[parkName]}`);
    return KNOWN_PARKS[parkName];
  }
  
  // Try partial matches
  for (const [knownPark, province] of Object.entries(KNOWN_PARKS)) {
    if (parkName.includes(knownPark) || knownPark.includes(parkName)) {
      debugLog('LocationSearch', `Found partial match for known park: ${parkName} matches ${knownPark} in province ${province}`);
      return province;
    }
  }
  
  return null;
};

// Generate search terms for special location types like national parks
// eslint-disable-next-line no-unused-vars
const generateSpecialLocationSearchTerms = (locationName) => {
  const terms = [];
  
  // Clean the location name to ensure it's usable
  const cleanName = locationName.trim().replace(/\s+/g, ' ');
  if (!cleanName) return terms;
  
  debugLog('LocationSearch', `Generating special location search terms for: "${cleanName}"`);
  
  // Check if it's a special location type
  const specialLocationType = containsSpecialLocationType(cleanName);
  if (specialLocationType) {
    // For national parks
    if (specialLocationType === 'national park') {
      // Try different variations of the name
      const baseName = cleanName.replace(/\bnational park\b/i, '').trim();
      
      // Check if this is a known park with a specific province
      const lowerBaseName = baseName.toLowerCase();
      const knownProvince = findKnownParkProvince(lowerBaseName);
      
      if (knownProvince) {
        // If it's a known park, prioritize the correct province
        const provinceName = CANADIAN_PROVINCES[knownProvince];
        terms.push(`${baseName} National Park, ${provinceName}, Canada`);
        terms.push(`${baseName}, ${provinceName}, Canada`);
        terms.push(`${baseName} National Park, Canada`);
      } else {
        // Add with explicit "National Park" designation
        terms.push(`${baseName} National Park, Canada`);
        
        // Try with each province, prioritizing western provinces for parks
        const priorityProvinces = ['BC', 'AB', 'YT', 'NT'];
        
        // First try priority provinces
        for (const abbr of priorityProvinces) {
          const province = CANADIAN_PROVINCES[abbr];
          terms.push(`${baseName} National Park, ${province}, Canada`);
        }
        
        // Then try other provinces
        for (const [abbr, province] of Object.entries(CANADIAN_PROVINCES)) {
          if (!priorityProvinces.includes(abbr)) {
            terms.push(`${baseName} National Park, ${province}, Canada`);
          }
        }
      }
      
      // Try without "National Park" designation
      terms.push(`${baseName}, Canada`);
    }
    // For provincial parks
    else if (specialLocationType === 'provincial park') {
      const baseName = cleanName.replace(/\bprovincial park\b/i, '').trim();
      
      // Check if this is a known park with a specific province
      const lowerBaseName = baseName.toLowerCase();
      const knownProvince = findKnownParkProvince(lowerBaseName);
      
      if (knownProvince) {
        // If it's a known park, prioritize the correct province
        const provinceName = CANADIAN_PROVINCES[knownProvince];
        terms.push(`${baseName} Provincial Park, ${provinceName}, Canada`);
        terms.push(`${baseName}, ${provinceName}, Canada`);
        terms.push(`${baseName} Provincial Park, Canada`);
      } else {
        // Add with explicit "Provincial Park" designation
        terms.push(`${baseName} Provincial Park, Canada`);
        
        // Try with each province
        for (const [, province] of Object.entries(CANADIAN_PROVINCES)) {
          terms.push(`${baseName} Provincial Park, ${province}, Canada`);
        }
      }
      
      // Try without "Provincial Park" designation
      terms.push(`${baseName}, Canada`);
    }
    // For other parks
    else if (specialLocationType === 'park') {
      const baseName = cleanName.replace(/\bpark\b/i, '').trim();
      
      // Check if this is a known park with a specific province
      const lowerBaseName = baseName.toLowerCase();
      const knownProvince = findKnownParkProvince(lowerBaseName);
      
      if (knownProvince) {
        // If it's a known park, prioritize the correct province
        const provinceName = CANADIAN_PROVINCES[knownProvince];
        terms.push(`${baseName} Park, ${provinceName}, Canada`);
        terms.push(`${baseName}, ${provinceName}, Canada`);
        terms.push(`${baseName} Park, Canada`);
      } else {
        // Add with explicit "Park" designation
        terms.push(`${baseName} Park, Canada`);
        
        // Try with each province
        for (const [, province] of Object.entries(CANADIAN_PROVINCES)) {
          terms.push(`${baseName} Park, ${province}, Canada`);
        }
      }
      
      // Try without "Park" designation
      terms.push(`${baseName}, Canada`);
    }
    // For other special location types
    else {
      // Try with the special location type
      terms.push(`${cleanName}, Canada`);
      
      // Check if this is a known location with a specific province
      const lowerName = cleanName.toLowerCase();
      const knownProvince = findKnownParkProvince(lowerName);
      
      if (knownProvince) {
        // If it's a known location, prioritize the correct province
        const provinceName = CANADIAN_PROVINCES[knownProvince];
        terms.push(`${cleanName}, ${provinceName}, Canada`);
      } else {
        // Try with each province
        for (const province of Object.values(CANADIAN_PROVINCES)) {
          terms.push(`${cleanName}, ${province}, Canada`);
        }
      }
      
      // Try without the special location type
      const baseNameParts = cleanName.split(' ');
      if (baseNameParts.length > 1) {
        const baseName = baseNameParts.slice(0, -1).join(' ');
        terms.push(`${baseName}, Canada`);
      }
    }
  } else {
    // If not a special location type, just add the basic term
    terms.push(`${cleanName}, Canada`);
  }
  
  return terms;
};

// Generate search terms with different province combinations

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
    // We don't strictly need the API key for Environment Canada search, but keep it for OpenWeatherMap fallback
    setInitialized(true);
    setError(null);
    devLog('LocationSearch', 'Initialized with Environment Canada location search');
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
      setIsSearching(true);
      setSearchStage(1);
      
      // First, try to search using Environment Canada's data
      const canadianResults = await searchCanadianLocations(term);
      
      if (canadianResults.length > 0) {
        devLog('LocationSearch', `Found ${canadianResults.length} Canadian locations for search term: ${term}`);
        setSearchResults(canadianResults);
        setSearchStage(2);
        return;
      }
      
      // If no results from Environment Canada, try enhancing the search term
      const enhancedTerm = enhanceCanadianSearch(term);
      if (enhancedTerm !== term) {
        devLog('LocationSearch', `Trying enhanced search term: ${enhancedTerm}`);
        setSearchStage(3);
        
        const enhancedResults = await searchCanadianLocations(enhancedTerm);
        
        if (enhancedResults.length > 0) {
          devLog('LocationSearch', `Found ${enhancedResults.length} locations with enhanced term: ${enhancedTerm}`);
          setSearchResults(enhancedResults);
          setSearchStage(4);
          return;
        }
      }
      
      // If still no results, fall back to OpenWeatherMap API as a last resort
      if (apiKey) {
        devLog('LocationSearch', `Falling back to OpenWeatherMap API for: ${enhancedTerm}`);
        setSearchStage(5);
        
        // Log the exact URL being called for debugging
        const searchUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(enhancedTerm)}&limit=10&appid=${apiKey}`;
        debugLog('LocationSearch', `Fallback search URL: ${searchUrl}`);
        
        const response = await axios.get(searchUrl);
        
        if (response.data.length > 0) {
          devLog('LocationSearch', `Found ${response.data.length} locations from OpenWeatherMap for: ${enhancedTerm}`);
          
          // Format OpenWeatherMap results to match our structure
          const formattedResults = response.data.map(result => ({
            name: result.name,
            province: result.state || '',
            provinceCode: result.state || '',
            country: result.country,
            countryCode: result.country,
            lat: result.lat,
            lon: result.lon,
            type: 'city',
            source: 'openweathermap'
          }));
          
          // Filter to only Canadian results if possible
          const canadianResults = formattedResults.filter(result => result.country === 'CA');
          
          if (canadianResults.length > 0) {
            setSearchResults(canadianResults);
          } else {
            // If no Canadian results, use all results
            setSearchResults(formattedResults);
          }
          
          setSearchStage(6);
          return;
        }
      }
      
      // If we get here, no results were found
      devLog('LocationSearch', `No results found for: ${term}`);
      setSearchResults([]);
      setError(`No locations found for "${term}". Try a different search term.`);
      setSearchStage(7);
      
      // Generate alternative search terms
      const alternatives = generateAlternativeSearchTerms(term);
      setAlternativeSearchTerms(alternatives);
      
    } catch (error) {
      console.error('Error searching for location:', error);
      setError(`Error searching for location: ${error.message}`);
      setSearchResults([]);
      setSearchStage(-1);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to generate alternative search terms
  const generateAlternativeSearchTerms = (term) => {
    const alternatives = [];
    const cleanTerm = extractLocationName(term);
    
    // Add with province codes
    for (const [code, name] of Object.entries(CANADIAN_PROVINCES)) {
      alternatives.push(`${cleanTerm}, ${code}`);
      alternatives.push(`${cleanTerm}, ${name}`);
    }
    
    // Add with "Canada" explicitly
    alternatives.push(`${cleanTerm}, Canada`);
    
    // Return unique alternatives that are different from the original term
    return [...new Set(alternatives)]
      .filter(alt => alt.toLowerCase() !== term.toLowerCase())
      .slice(0, 5); // Limit to 5 alternatives
  };

  const handleLocationSelect = (location) => {
    devLog('LocationSearch', 'Location selected:', location);
    
    // Ensure we have all required properties before calling the callback
    const locationData = {
      lat: location.lat,
      lon: location.lon,
      name: location.name || '',
      state: location.province || location.state || '',
      country: location.country || 'Canada',
      source: location.source || 'environment-canada'
    };
    
    // Call the parent component's callback with the location data
    if (onLocationSelect && typeof onLocationSelect === 'function') {
      onLocationSelect(locationData);
    } else {
      devLog('LocationSearch', 'onLocationSelect is not a function or not provided', { error: true });
    }
  };

  // Format location display for the search results
  const formatLocationDisplay = (result) => {
    if (!result) return '';
    
    let display = result.name || '';
    
    // Add province/state if available
    if (result.province) {
      display += `, ${result.province}`;
    } else if (result.state) {
      display += `, ${result.state}`;
    }
    
    // Add country if available and not Canada (since we're focusing on Canadian locations)
    if (result.country && result.country !== 'CA' && result.country !== 'Canada') {
      display += `, ${result.country}`;
    }
    
    // Add source indicator for debugging
    if (isDevelopment && result.source) {
      display += ` (${result.source})`;
    }
    
    return display;
  };

  // Handle clicking on an alternative search term
  const handleAlternativeTermClick = (term) => {
    setSearchTerm(term);
    performSearch(term);
  };

  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setAlternativeSearchTerms([]);
    
    devLog('LocationSearch', `Starting search for: ${trimmedSearchTerm}`);
    
    try {
      await performSearch(trimmedSearchTerm);
    } catch (error) {
      console.error('Error in handleSearch:', error);
      setError(`Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
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
            placeholder={initialized ? "Search location..." : "Initializing..."}
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
          <p>
            {containsSpecialLocationType(searchTerm)
              ? `Try searching for this ${containsSpecialLocationType(searchTerm)} with a specific province:`
              : 'Try searching with a specific province:'}
          </p>
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