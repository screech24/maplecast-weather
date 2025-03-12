# Changelog

All notable changes to the MapleCast Weather App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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