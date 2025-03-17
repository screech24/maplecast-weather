# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-05-14

### Fixed
- Fixed radar data not displaying due to timestamp issues with Environment Canada WMS service
- Improved timestamp handling to use valid timestamps from the past 3 hours
- Enhanced error detection and recovery for radar layer loading
- Added more detailed logging for radar timestamp processing
- Implemented better fallback mechanisms when timestamps are invalid

## [1.2.1] - 2024-05-14

### Fixed
- Fixed radar data not displaying due to timestamp issues with Environment Canada WMS service
- Added fallback mechanism to get valid timestamps directly from the WMS service
- Improved error handling for radar layer loading

## [1.2.0] - 2024-05-10

### Added
- Implemented radar animation controls
- Added support for different radar types (rain, snow, mixed precipitation)
- Added radar legend
- Added ability to toggle weather alerts and cities on the map

### Changed
- Improved radar data loading and error handling
- Enhanced UI for radar controls

## [1.1.0] - 2024-05-05

### Added
- Integrated Environment Canada radar data
- Added map component with OpenStreetMap base layer
- Implemented geolocation to center map on user's location

### Changed
- Improved weather data display
- Enhanced UI for better user experience

## [1.0.0] - 2024-05-01

### Added
- Initial release
- Weather data from OpenWeatherMap API
- Current conditions display
- 7-day forecast
- Location search functionality
- Responsive design for mobile and desktop
- Dark mode support