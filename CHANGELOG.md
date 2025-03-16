# Changelog

All notable changes to the MapleCast Weather App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2025-04-19

### Changed
- Deployed application to GitHub Pages
- Updated version numbers across the application

## [1.6.0] - 2025-04-18

### Added
- Implemented page navigation system with three separate pages: Current Conditions, Hourly Forecast, and 7-Day Forecast
- Added swipe functionality for mobile devices to navigate between pages
- Added button navigation for desktop users
- Created new components: WeatherPages and PageNavigation

### Changed
- Reordered weather pages to show Current Conditions, Hourly Forecast, then 7-Day Forecast
- Improved page transitions with fade effect

## [1.5.1] - 2025-04-17

### Changed
- Temporarily removed radar functionality for future reimplementation
- Removed RadarMap and EnhancedRadarMap components and related CSS
- Removed radar proxy functionality from setupProxy.js
- Removed radar-proxy.js Netlify function

## [1.5.0] - 2025-04-16

### Changed
- Temporarily removed weather alert functionality for future reimplementation
- Removed WeatherAlerts component and related CSS
- Removed alert utility functions from the codebase (capAlerts.js, mockAlerts.js)
- Removed alert documentation (alerts.md)

## [1.4.20] - 2025-04-03

### Changed
- Removed Netlify serverless functions for weather alerts as they're not required
- Simplified API fetching logic to use CORS proxies for all production environments
- Improved environment detection for better compatibility across hosting platforms

## [1.4.19] - 2025-04-02

### Fixed
- Fixed weather alerts not working on GitHub Pages deployment and local development
- Added explicit GitHub Pages detection to improve API handling strategy
- Updated CORS proxy list with more reliable proxy options
- Enhanced error messages with hosting-specific troubleshooting guidance
- Improved logging to better identify environment-specific issues
- Fixed error handling in alert fetching process with more descriptive messages

## [1.4.18] - 2025-04-01

### Fixed
- Fixed weather alerts not working in both development and production environments
- Added Netlify serverless function for reliable weather alerts fetching in production
- Improved local proxy implementation for development environment
- Enhanced CORS proxy handling with better error reporting
- Fixed syntax error in alerts processing code
- Added multiple fallback mechanisms for alerts fetching
- Improved logging for better debugging of alert fetching issues

## [1.4.17] - 2025-03-31

### Fixed
- Fixed radar layers not displaying on GitHub Pages and in development environment
- Updated WMS version from 1.4.0 to 1.3.0 for better compatibility with Environment Canada GeoMet API
- Improved CORS proxy handling for radar layers with multiple fallback options
- Enhanced weather alerts fetching with optimized CORS proxy order
- Added direct access attempt before trying CORS proxies for better performance
- Improved error handling and user feedback for both radar and alerts

## [1.4.16] - 2025-03-30

### Fixed
- Fixed CORS proxy issues with radar layers and weather alerts on GitHub Pages
- Implemented proxied WMS URLs for radar layers to work around CORS restrictions
- Prioritized more reliable CORS proxies for weather alerts
- Added direct fetch attempt for GitHub Pages domain
- Added new CORS proxy option (thingproxy.freeboard.io) for better reliability
- Improved error handling for both radar and alert data fetching

## [1.4.15] - 2025-03-29

### Fixed
- Fixed CORS proxy issues with weather alerts by adding more reliable proxy options
- Added local development proxy for testing weather alerts on localhost
- Improved error handling and fallback mechanisms for alert fetching
- Added informative error message about HTTPS deployment resolving the proxy issue
- Updated version number in app footer

## [1.4.14] - 2025-03-28

### Fixed
- Fixed weather alert system not displaying alerts for user's location
- Improved alert fetching mechanism with multiple CORS proxies and fallback options
- Enhanced alert notification system to properly send notifications when new alerts are detected
- Fixed XML parsing to handle both ATOM and RSS feed formats from Environment Canada
- Added better error handling and logging for alert-related operations
- Improved service worker implementation for background alert checking

## [1.4.13] - 2025-03-27

### Fixed
- Fixed layer ordering so radar layers always appear on top of the alerts layer
- Improved visibility of radar data when both radar and alert layers are at maximum opacity
- Reordered WMS layers to ensure proper z-index stacking

## [1.4.12] - 2025-03-26

### Fixed
- Fixed opacity sliders not controlling the opacity of radar and alert layers
- Moved opacity values from WMS parameters to direct props on WMSTileLayer components
- Improved layer rendering with proper opacity controls

## [1.4.11] - 2025-03-25

### Fixed
- Fixed missing opacity slider controls for radar and alert layers
- Improved timeline slider with larger, more visible blue position indicator
- Adjusted timeline labels to prevent overlap and improve readability
- Enhanced slider controls with better styling and improved usability
- Fixed timeline track alignment and improved visual appearance

## [1.4.10] - 2025-03-24

### Fixed
- Fixed "Invalid time value" error when generating radar frames by adding robust date validation
- Added error handling for invalid dates in formatWMSTime and formatTime functions
- Implemented fallback to current time when invalid radar timestamps are detected
- Enhanced error logging for better debugging of timestamp-related issues

## [1.4.9] - 2025-03-23

### Added
- Added direct integration with Environment Canada's WMS GetCapabilities API to fetch the exact latest radar timestamp
- Implemented fallback mechanism to use estimated time when API request fails
- Added detailed logging of radar timestamp sources and calculations

### Fixed
- Fixed discrepancy between Environment Canada's radar time (12:42) and app timeline (12:30)
- Adjusted radar time delay calculation from 15 minutes to 6 minutes based on observed data
- Improved accuracy of radar frame timestamps to match Environment Canada's actual data
- Enhanced auto-refresh mechanism to use the most accurate timestamp source available

## [1.4.8] - 2025-03-22

### Fixed
- Fixed issue with radar not showing the most current data available from Environment Canada
- Added adjustment for Environment Canada's radar data processing delay (typically 10-15 minutes)
- Implemented a new utility function to calculate the most recent available radar frame time
- Improved frame generation logic to ensure proper alignment with available radar data
- Enhanced logging to better track radar frame timestamps and current frame selection
- Fixed discrepancy between timeline slider display and actual radar frame times

## [1.4.7] - 2025-03-21

### Fixed
- Fixed issue with the app not loading with the current radar frame being displayed
- Added state tracking to ensure radar layers are only rendered when both the map is ready and frames have been generated
- Improved initialization of radar frames with proper timestamp formatting
- Enhanced default frame handling to use properly rounded timestamps that align with Environment Canada's data
- Moved formatTime function to be available during frame generation

## [1.4.6] - 2025-03-20

### Fixed
- Fixed issue with radar not showing during animation playback
- Improved cross-fade between frames using a step function to ensure at least one layer is always fully visible
- Removed redundant timeline indicators to eliminate multiple dots on the timeline
- Ensured radar always shows the most current frame when data loads
- Made the default range input thumb completely invisible for a cleaner UI

## [1.4.5] - 2025-03-19

### Fixed
- Eliminated radar and alert layer flickering during animation playback
- Implemented cross-fading between radar frames for smooth transitions
- Added custom timeline slider with smooth movement
- Improved time display to transition smoothly between frames
- Enhanced animation loop for more fluid playback experience

## [1.4.4] - 2025-03-18

### Fixed
- Fixed flashing alert layer issue during radar animation playback by using a static key
- Improved radar animation smoothness by replacing setTimeout with requestAnimationFrame
- Added smooth timeline indicator that moves continuously between frames
- Added CSS transitions for smoother visual elements during animation
- Implemented interpolation for timeline position to create a more fluid animation experience

## [1.4.3] - 2025-03-17

### Fixed
- Fixed radar data not displaying by aligning timestamps with Environment Canada's 6-minute data intervals
- Changed 3-hour view from 12-minute to 6-minute intervals to match radar data availability
- Added timestamp rounding to ensure alignment with available radar data
- Added error handling for WMS layer requests
- Updated layer keys to include timestamps for proper refreshing
- Improved logging for radar frame timestamps to aid in debugging

## [1.4.2] - 2025-03-16

### Fixed
- Fixed issue with radar bin data not showing on the map by removing time parameters from radar layer requests
- Updated WMSTileLayer key props to use Date.now() for proper refreshing of radar layers
- Ensured consistent implementation across both RadarMap and EnhancedRadarMap components

## [1.4.1] - 2025-03-15

### Fixed
- Fixed issue with radar bin data not showing on the map
- Fixed weather alerts layer not displaying properly
- Updated WMS version from 1.4.0 to 1.3.0 for better compatibility with Environment Canada GeoMet API
- Added key props to WMS layers to force re-rendering and ensure data updates
- Added time parameter to radar layers for proper temporal data display
- Improved logging for coordinate changes to aid in debugging

## [1.4.0] - 2025-03-11

### Added
- Enhanced weather background images with more accurate day/night variants
- Improved clear sky daytime image to show a pure blue sky without clouds
- Added dynamic snow falling images to replace static snow scene
- Optimized image loading and rendering for better performance

### Changed
- Improved visual experience with more accurate weather condition representations
- Enhanced user experience with time-appropriate background images
- Updated documentation to reflect recent changes

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