# Changelog

All notable changes to the MapleCast Weather App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.9.4] - 2025-03-15

### Fixed
- Fixed alert system to properly fetch and display real alerts from Environment Canada
- Removed fallback to mock alerts to ensure only real active alerts are displayed
- Improved proxy implementation for fetching alerts from Environment Canada
- Enhanced alert filtering logic with better location matching
- Increased buffer zones for alert polygons and circles from 20km to 30km for better coverage
- Added cache-busting parameters to ensure fresh alert data is fetched
- Improved error handling and user feedback for alert system
- Enhanced the alert display UI for better readability and navigation

## [1.9.3] - 2025-03-14

### Added
- Added mock alert data for development environments to ensure alerts are displayed even when no real alerts are available
- Created comprehensive mock alerts for all major Canadian regions for testing purposes

### Fixed
- Fixed critical issue with alert system using wrong coordinates for saved locations
- Ensured alert system consistently uses the last used location coordinates instead of browser geolocation
- Improved logging to better track coordinate usage in alert system
- Reduced unnecessary API calls by limiting date range for alert checks

## [1.9.1] - 2025-03-13

### Fixed
- Fixed alerts not showing for Canadian locations with active alerts
- Enhanced region matching system to work for all Canadian provinces and territories
- Added comprehensive province and region variations for more accurate alert matching
- Improved alert detection for all Canadian locations, not just specific regions
- Increased buffer zones for alert polygons and circles from 10km to 20km for better coverage

## [1.9.0] - 2025-03-13

### Fixed
- Improved weather alerts functionality for Canadian locations with active alerts
- Enhanced geospatial calculations to better detect if a user's location is affected by an alert
- Added 10km buffer to alert polygons and circles to include nearby areas
- Improved region matching for alert areas
- Added better error handling and fallbacks for alert detection

## [1.8.9] - 2023-11-15

### Fixed
- Fixed CSS issues in the LocationSearch component by correcting class names
- Implemented fallback mechanism for Environment Canada API failures
- Added hardcoded Canadian cities and weather stations data as fallback when API is unavailable
- Added timeout to API requests to prevent long loading times
- Improved error handling in location search functionality

## [1.8.8] - 2025-03-13

### Fixed
- Fixed critical app loading error: "Cannot access 'fetchAlertsForLocation' before initialization"
- Reordered function declarations to ensure proper initialization sequence
- Improved code structure to prevent dependency reference errors

## [1.8.7] - 2025-03-13

### Fixed
- Fixed ESLint errors related to undefined 'isDevelopment' variable in LocationSearch component
- Properly imported isDevelopment from devMode utility

## [1.8.6] - 2025-03-13

### Added
- Integrated Environment Canada's MSC GeoMet service for improved Canadian location search
- Added direct access to Canadian cities and weather stations data
- Implemented location caching to improve performance and reduce API calls
- Enhanced reverse geocoding using Environment Canada data

### Changed
- Switched from OpenWeatherMap geocoding API to Environment Canada data for Canadian locations
- Improved location search UI with clearer results display
- Enhanced "Use My Location" functionality to use Environment Canada data for location identification

### Fixed
- Fixed issues with location search for Canadian locations that weren't properly recognized
- Improved search accuracy for smaller Canadian communities and remote locations
- Reduced dependency on OpenWeatherMap API for geocoding (now used only as fallback)

## [1.8.5] - 2025-03-12

### Added
- Enhanced support for searching national parks and other geographical features
- Added special location type detection for parks, mountains, lakes, and other landmarks
- Improved search algorithm with dedicated handling for special location types
- Added more specific error messages and suggestions for special location searches

### Fixed
- Fixed search functionality for smaller locations like national parks and provincial parks
- Improved search results for locations without explicit province references
- Enhanced alternative search suggestions with more relevant options
- Added special handling for different types of parks and geographical features

## [1.8.4] - 2025-03-12

### Fixed
- Fixed ESLint warnings related to conflicting environment variable definitions
- Resolved webpack configuration issues with process.env.REACT_APP_VERSION
- Improved location search functionality for Canadian locations
- Enhanced search box clearing behavior when starting a new search
- Fixed search input to properly clear previous search terms when clicked
- Improved province detection in search terms for better Canadian location results

## [1.8.3] - 2025-03-12

### Added
- Development mode for easier local testing and debugging
- DevTools panel with application info, console logs, and network monitoring
- Enhanced logging utilities for development and debugging
- New npm scripts: `npm run dev` and `npm run debug`

### Fixed
- Significantly improved location search functionality to work properly across all Canadian locations
- Enhanced search algorithm with multi-stage approach for more reliable results
- Improved province detection with partial matching for better search accuracy
- Added more robust location name extraction for better search results
- Expanded provincial search terms generation with more variations
- Enhanced result filtering and prioritization for Canadian locations
- Added detailed logging throughout the search process for better diagnostics

## [1.8.2] - 2025-03-21

### Fixed
- Fixed version number inconsistency across environment files
- Improved weather alerts functionality to better detect and display relevant alerts
- Enhanced location search to work properly across all Canadian locations
- Fixed issue with alerts not being fetched for searched locations
- Improved service worker alert syncing for more reliable notifications
- Added fallback methods for alert fetching when primary methods fail

## [1.8.1] - 2025-03-20

### Fixed
- Fixed issue with location search results not being clickable
- Improved error handling in location selection process
- Enhanced search results UI with better visual indicators for selection
- Added keyboard accessibility for search results navigation

## [1.8.0] - 2025-03-19

### Added
- Enhanced location search functionality with multi-stage search approach
- Added support for Canadian postal code detection in search
- Implemented provincial search suggestions when locations aren't found
- Added intelligent location name extraction for better search results

### Changed
- Improved search algorithm to try multiple variations of search terms
- Enhanced user interface with clickable alternative search suggestions
- Improved error messages with specific suggestions for better searches
- Optimized province detection with more flexible matching

## [1.7.0] - 2025-03-18

### Added
- Implemented a comprehensive weather alert system based on Environment Canada's CAP alerts
- Added robust geospatial calculations to determine if a user's location is affected by alerts
- Created a caching system for successful alert paths to improve performance
- Added detailed error handling and logging for alert fetching
- Enhanced alert deduplication to show only the most relevant and recent alerts

### Changed
- Improved alert fetching mechanism with fallback strategies for different date formats
- Enhanced the alert display UI with severity indicators and navigation between multiple alerts
- Optimized network requests with timeout handling and proper error suppression
- Updated alert parsing to handle different alert formats more effectively

### Fixed
- Resolved issues with alert fetching in production environments
- Fixed geospatial calculations for polygon and circle-based alerts
- Improved error handling for malformed XML and network failures
- Enhanced reliability of the alert system across all Canadian regions

## [1.6.0] - 2025-03-15

### Added
- Expanded support for weather alerts across all Canadian regions
- Added comprehensive region mapping for major Canadian cities including Toronto, Vancouver, Calgary, Edmonton, Winnipeg, Ottawa, Halifax, and Victoria
- Added nearby regions for all major Canadian cities to improve alert relevance

### Changed
- Removed Quebec-specific hardcoded elements from the alerts system
- Generalized the location matching algorithm to work for all Canadian locations
- Made the version number in the footer clickable, linking to the GitHub repository

### Fixed
- Fixed issues with alert detection for locations outside Quebec
- Improved geospatial calculations for more accurate alert matching
- Enhanced error handling for 404 responses when fetching alerts

## [1.5.1] - 2025-03-12

### Changed
- Migrated deployment from GitHub Pages to Netlify for complete functionality
- Updated documentation to reflect Netlify as the primary hosting platform
- Removed GitHub Pages deployment scripts from package.json
- Updated application homepage URL to point to Netlify

## [1.5.0] - 2025-03-12

### Added
- Implemented server-side proxy using Netlify Functions to resolve CORS issues
- Added robust error handling for weather alert fetching
- Improved alert detection algorithm for Canadian locations
- Enhanced location-based alert filtering for more accurate notifications

### Changed
- Migrated from client-side API calls to server-side proxy for Environment Canada data
- Optimized alert fetching to reduce API calls and improve performance
- Updated notification interval from 15 minutes to 1 minute for more timely alerts
- Removed hardcoded test dates from alert fetching logic

### Fixed
- Resolved CORS issues that prevented the app from working properly on GitHub Pages
- Fixed alert fetching mechanism to work reliably in production environments
- Improved error handling for network failures when fetching alerts

## [1.4.0] - 2025-03-11

### Added
- Enhanced weather background images with more accurate day/night variants
- Improved clear sky daytime image to show a pure blue sky without clouds
- Added dynamic snow falling images to replace static snow scene
- Optimized image loading and rendering for better performance
- Enhanced location search with Canadian province recognition
- Added fallback search mechanism when no results are found
- Increased search results limit from 5 to 10 for more comprehensive options

### Changed
- Improved visual experience with more accurate weather condition representations
- Enhanced user experience with time-appropriate background images
- Updated documentation to reflect recent changes
- Improved location search UI with better error handling and feedback
- Prioritized Canadian locations in search results

### Fixed
- Fixed issues with location search not recognizing some Canadian cities
- Improved search algorithm to better handle province abbreviations and names

## [1.3.0] - 2025-03-11

### Added
- Enhanced weather background images with day/night variants for all weather conditions
- Added dynamic background images that change based on time of day (day/night)
- Replaced static snow scene with dynamic snow falling images
- Updated clear sky daytime image to show a pure blue sky without clouds
- Fixed broken image URL for nighttime cloudy conditions

### Changed
- Improved visual experience with more accurate weather condition representations
- Enhanced user experience with time-appropriate background images

## [1.2.0] - 2025-03-10

### Fixed
- Fixed issue with radar data not displaying on the map while alerts layer was functioning correctly
- Removed time parameter from radar layer parameters as Environment Canada WMS doesn't support it for these layers
- Optimized radar layer rendering for better performance

### Added
- Added version tracking system to display current version in the footer
- Created CHANGELOG.md to document project changes
- Updated GitHub Pages deployment URL to https://screech24.github.io/maplecast-weather/
- Created enhanced deployment script with automatic git operations, remote URL management, and pull-rebase functionality

### Changed
- Improved code organization in EnhancedRadarMap component
- Removed unused imports and debugging code
- Removed unused imports and debugging code

## [1.1.0] - 2025-02-15

### Added
- Enhanced Radar Visualization with animation controls
- Multiple precipitation layers (rain, snow, mixed)
- Weather alerts integration
- Timeline slider for historical radar data viewing
- Opacity controls for radar and alert layers
- Playback speed control for animations

### Changed
- Improved map rendering performance
- Updated UI for better user experience
- Enhanced mobile responsiveness

## [1.0.0] - 2025-01-20

### Added
- Initial release of MapleCast Weather App
- Current weather conditions display
- 5-day forecast
- Hourly forecast
- Location search functionality
- Geolocation support
- Dark mode toggle
- Basic radar map
- Weather alerts for Canadian locations
- Responsive design for all device sizes