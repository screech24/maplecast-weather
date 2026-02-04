# Changelog

All notable changes to the MapleCast Weather App will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-04

### Added
- Wind velocity layer on radar map using Open-Meteo data
- Layer toggle controls for precipitation and wind
- Full Environment Canada alert details with intro summary display
- Alert intro summary extraction showing headline content (e.g., "Rain, at times heavy, continues.")
- Improved "In Effect For" regions parsing as proper lists
- Wind speed color coding (light, moderate, strong, very strong, extreme)
- Click-to-view wind popups showing speed and direction details

### Changed
- Replaced Windy.com radar with RainViewer (free, no API key required)
- Enhanced alert HTML parsing with 8 different extraction patterns
- Improved alert page parsing for Impact Level and Forecast Confidence
- Updated radar legend to show active layer information
- README updated with RainViewer and wind layer documentation

### Removed
- Unused DevTools and DiagnosticTest components
- Unused utility files (cityCodeMapper.js, radarSiteMapper.js)
- Orphaned WindyRadarMap.css file
- Dead code from App.js (enableNotifications, retryFetchWeather, updateServiceWorkerData, dismissNotificationPrompt, showBrowserNotification)
- Unused functions from devMode.js (measurePerformance, addDevUI)
- Duplicate getRegionCodeForProvince function from api.js
- test-location-search.js test file

### Fixed
- Weather alerts now show complete EC content including intro summary
- Proper extraction of What/When/Where/Additional Info sections with multiple HTML format support

## [1.12.1] - 2024-03-28

### Fixed
- Fixed issue where expired weather alerts were still being displayed in the alerts panel
- Added filtering for expired alerts in multiple places to ensure only active alerts are shown
- Implemented a regular check that runs every minute to remove any alerts that have expired while the app is open

## [1.12.0] - 2024-03-20

### Fixed
- Fixed ESLint warnings in multiple files
- Fixed missing dependency 'handleLocationSelect' in useEffect hook in App.js
- Fixed missing dependency 'prevLocationKey' in useEffect hook in WeatherAlerts.js
- Added eslint-disable comment for unused CORS_PROXIES variable in alertUtils.js
- Removed unused axios import from canadaLocations.js

### Changed
- Improved code maintainability and stability
- Updated version numbers across all files

## [1.11.9] - 2024-03-20

### Changed
- Reverted codebase to commit 072ccc7f55d3d009b98198a3c5299b3638da5889
- Rolled back changes related to weather alerts that were causing issues
- Restored stable Windy radar map implementation without location markers

## [1.11.8] - 2024-03-18

### Fixed
- Fixed alert system making unnecessary API calls during location search
- Added isSearching state to prevent alert fetching while typing in search box
- Updated footer to include Weatherbit attribution for weather alerts
- Added credits for Cursor AI, Claude Sonnet 3.7, and Grok 3 beta

## [1.11.7] - 2024-03-18

### Fixed
- Fixed alert system making unnecessary API calls during location search
- Added isSearching state to prevent alert fetching while typing in search box
- Updated footer to include Weatherbit attribution for weather alerts
- Added credits for Cursor AI, Claude Sonnet 3.7, and Grok 3 beta

## [1.11.6] - 2024-03-18

### Fixed
- Fixed alert data not updating when changing locations
- Fixed refresh alert button not working properly
- Fixed alert bar opening when changing pages
- Added automatic location update when app comes from background state
- Added location change detection with 1km threshold
- Improved alert caching system with location tracking
- Fixed alerts persisting after location change

## [1.11.5] - 2024-03-18

### Fixed
- Removed French weather alerts to show only English alerts
- Fixed search dropdown being hidden behind the alert bar by increasing its z-index
- Removed Environment Canada API calls and switched to using only OpenWeatherMap and Weatherbit for data
- Improved location search reliability by using local fallback data

## [1.11.4] - 2024-03-18

### Fixed
- Fixed weather alerts functionality by updating CORS proxies and improving reliability
- Improved region code mapping for more accurate alert fetching
- Enhanced XML parsing to handle different response formats
- Added better location-based alert filtering
- Added User-Agent header to prevent blocking
- Increased request timeout for better reliability

### Changed
- Reordered CORS proxies by reliability
- Improved error handling and logging
- Removed redundant local development proxy code

## [1.11.3] - 2025-05-22

### Fixed
- Updated CORS proxies for more reliable weather alert fetching
- Added new reliable CORS proxies including cors.x2u.in and api.codetabs.com
- Reorganized proxy priority to use most reliable services first
- Enhanced error handling and logging for better troubleshooting
- Increased request timeouts for better reliability with slower proxy services
- Added dedicated battleboard proxy endpoint for local development
- Improved setupProxy.js with better error reporting and headers

## [1.11.2] - 2025-05-21

### Fixed
- Updated CORS proxies for weather alerts to use more reliable services
- Added multiple active CORS proxies to improve alert fetching reliability
- Replaced outdated crossorigin.me with corsproxy.io, thingproxy.freeboard.io, and other active proxies
- Switched to HTTPS for all CORS proxies to enhance security

## [1.11.1] - 2025-05-20

### Fixed
- Fixed weather alerts not showing for Canadian locations with active alerts
- Added thingproxy.freeboard.io as a CORS proxy for more reliable alert fetching
- Updated CORS proxy list with more reliable options
- Fixed search selection box not disappearing after location selection
- Added "No active alerts" banner when there are no weather alerts for the user's location

## [1.11.0] - 2025-05-19

### Added
- Implemented Environment Canada weather alerts system
- Added dropdown alert banner at the top of the page
- Added support for displaying multiple alerts simultaneously
- Implemented background checking for new alerts
- Added push notifications for new weather alerts on both mobile and desktop
- Added detailed alert information with severity indicators
- Added ability to view full alert details and link to Environment Canada
- Implemented automatic alert fetching based on user's location

## [1.10.0] - 2025-05-18

### Changed
- Replaced Environment Canada radar with Windy.com interactive radar widget
- Enhanced radar visualization with more detailed and interactive features from Windy.com
- Improved radar responsiveness on both desktop and mobile devices
- Simplified radar implementation for better performance and reliability
- Removed dependency on Environment Canada's WMS service for radar data

## [1.9.6] - 2025-05-17

### Fixed
- Fixed radar data not displaying by adding time buffer to prevent requesting future or too-recent data
- Added 30-minute buffer to ensure timestamps are within valid range for Environment Canada's radar data
- Improved error handling for cases where radar data is not available for specific timestamps
- Added fallback mechanism with larger buffer (60 minutes) when initial timestamps fail
- Enhanced timestamp validation to filter out future timestamps from API responses
- Added more detailed logging for radar data availability troubleshooting

## [1.9.5] - 2025-05-17

### Fixed
- Fixed radar data not displaying by updating react-leaflet to version 5.0.0-rc.1 to resolve compatibility issues with React 19
- Improved map rendering stability for radar layers
- Enhanced compatibility with latest browser versions

## [1.9.4] - 2025-05-04

### Fixed
- Fixed radar data not showing on the map by using correct layer names and intervals
- Renamed "Surface Precipitation Type" layer to "Precipitation (Mixed)" for clarity
- Added verification of radar data availability for timestamps
- Implemented proper 6-minute intervals for short animation (1h, 11 frames)
- Added option to toggle between 1-hour and 3-hour radar views
- Added forced refresh keys to WMS layers to ensure proper rendering
- Improved timestamp rounding to align with Environment Canada's 6-minute update intervals

## [1.9.3] - 2025-05-03

### Fixed
- Fixed radar data not showing by updating the radar layer names to match Environment Canada's current API
- Replaced outdated RADAR_1KM_RDPR layer with valid layers from Environment Canada
- Updated default radar layer to RADAR_1KM_RRAI (Rain)
- Added Surface Precipitation Type layer option

## [1.9.2] - 2025-05-02

### Fixed
- Fixed radar data not showing by improving timestamp handling
- Enhanced XML parsing for Environment Canada radar data
- Added support for different time formats in WMS capabilities
- Improved fallback timestamp generation using device's system time
- Ensured timestamps are displayed in the user's local time zone

## [1.9.1] - 2025-05-01

### Fixed
- Fixed radar animation not playing when clicking the play button
- Fixed radar bin data not showing properly
- Added fallback timestamps generation when API doesn't return valid timestamps
- Improved error handling in radar data fetching
- Fixed ESLint warnings in RadarMap component
- Updated version numbers across the application

## [1.9.0] - 2025-04-30

### Added
- Added Environment Canada radar map as a new page after the 7-day forecast
- Implemented radar animation with playback controls
- Added support for different radar types (mixed precipitation, rain, snow)
- Added weather alerts layer overlay
- Added cities layer for better location context
- Added radar legend for intensity interpretation
- Implemented dark mode support for the radar map

## [1.8.7] - 2025-04-29

### Fixed
- Fixed 7-day forecast showing duplicate "Today" entries and missing Friday
- Updated formatDate function to use Math.floor instead of Math.round for more accurate day calculations
- Enhanced formatForecastToDaily function to ensure consistent noon timestamps for each day
- Added additional logging for better debugging of forecast date generation
- Ensured each forecast day has a unique date to prevent duplicates

## [1.8.6] - 2025-04-28

### Fixed
- Fixed 7-day forecast display issue with improved date handling
- Enhanced formatDate function to properly identify Today, Tomorrow, and future days
- Completely rewrote formatForecastToDaily function to ensure 7 consecutive days starting from today
- Improved timestamp handling to ensure consistent day representation across the forecast
- Added noon timestamp generation for more accurate day representation

## [1.8.5] - 2025-04-27

### Fixed
- Fixed 7-day forecast showing two "Today" entries and missing Saturday
- Improved forecast data generation to ensure all 7 days are displayed in the correct order
- Removed day of week tracking logic that was causing days to be skipped

## [1.8.4] - 2025-04-26

### Fixed
- Fixed 7-day forecast showing Sunday twice instead of showing "Today" for the current day
- Updated date formatting to display "Today" for the current day instead of the day name
- Improved user experience by making it clearer which forecast day is the current day

## [1.8.3] - 2025-04-25

### Fixed
- Fixed issue with 7-day forecast showing duplicate days of the week
- Improved day of week tracking when generating forecast data
- Enhanced date handling to ensure each day of the week appears only once in the forecast

## [1.8.2] - 2025-04-24

### Fixed
- Fixed issue with 7-day forecast showing duplicate days (two Sundays) and missing Saturday
- Improved date handling when extrapolating additional forecast days
- Enhanced forecast data sorting to ensure chronological order

## [1.8.1] - 2025-04-23

### Changed
- Modified 7-day forecast to show actual day names for all days instead of showing "Today" for the first day
- Improved forecast accuracy by displaying consistent day names throughout the forecast

## [1.8.0] - 2025-04-22

### Added
- Made the version number in the app footer clickable, linking to the GitHub changelog
- Added hover effects to the version number to indicate it's clickable

## [1.7.1] - 2025-04-21

### Fixed
- Fixed mobile layout issue where hourly forecast dynamic icons were overlapping with temperature display

## [1.7.0] - 2025-04-20

### Changed
- Improved mobile layouts for Hourly Forecast and 7-Day Forecast pages
- Changed mobile view to use a vertical list layout for better readability on smaller screens
- Optimized space usage in mobile view by rearranging elements horizontally within each list item
- Desktop layouts remain unchanged

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