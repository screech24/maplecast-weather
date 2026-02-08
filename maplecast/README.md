# MapleCast Weather App v2.3.1

A modern, free weather application for Canadian users featuring real-time weather data, forecasts, interactive radar, and Environment Canada weather alerts. **No API key required!**

[![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)](https://github.com/screech24/maplecast-weather/releases)
[![Demo](https://img.shields.io/badge/demo-live-green.svg)](https://screech24.github.io/maplecast-weather/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)](https://reactjs.org/)
[![PWA](https://img.shields.io/badge/PWA-enabled-5A0FC8.svg)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Latest Updates (February 2026)

**Version 2.3.1** - Alert Formatting & Safety Tips!
- **Safety Tips Display** - Now shows EC safety recommendations (dress warmly, frostbite warnings, pet safety, etc.)
- **Fixed Alert Description Layout** - Paragraphs now properly separated instead of merged into one block
- **Full Section Content** - Multi-line What/When/Where sections no longer truncated after the first line
- **Better Section Headers** - What/When/Where labels styled with bold uppercase formatting
- **Dark Mode Support** - Updated styles for safety tips and section headers

**Version 2.3.0** - Cloudflare Proxy & Alert Improvements!
- **Cloudflare Worker CORS Proxy** for reliable production alert fetching
- **Alert Update/Cancel Handling** - Properly processes CAP Update and Cancel messages
- **Matched Area Display** - Shows your specific matched area in alert banners

**Version 2.2.0** - Location & Alert System Overhaul!
- **New Location Search** - Switched to Open-Meteo Geocoding API (free, no rate limits, works reliably)
- **Improved Reverse Geocoding** - Now uses Photon API to get city names from coordinates
- **Fixed Alert Filtering** - Alerts now correctly filter by your specific city, not just province

## Features

- **Free Weather Data**: Uses Open-Meteo API - no API key or account required
- **Current Weather Conditions**: Temperature, humidity, wind speed, and more
- **7-Day Forecast**: Daily forecasts with high/low temperatures and precipitation chances
- **Hourly Forecast**: Detailed hourly predictions for the next 24 hours
- **Interactive Radar**: Precipitation radar with wind layer overlay
- **Environment Canada Weather Alerts**: Real-time alerts with push notifications
- **Dynamic Weather Backgrounds**: Background images that change based on weather conditions and time of day
- **Day/Night Visualization**: Different backgrounds for day and night across all weather conditions
- **Mobile Swipe Navigation**: Swipe between pages on mobile devices
- **Mobile-Optimized Views**: List view layout for forecasts on mobile for better readability
- **Location-based**: Uses your location to show relevant weather information
- **Canada-specific**: Optimized for Canadian locations with appropriate units (°C, km/h)
- **Progressive Web App**: Install on your device and use offline
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for all device sizes

## Weather Alerts Features

The weather alerts system provides:

- **CAP-Based Alerts**: Uses modern Common Alerting Protocol format from Environment Canada MSC Datamart
- **Real-time Environment Canada Alerts**: Official weather warnings, watches, and advisories
- **Dropdown Alert Banner**: Easily visible at the top of the app
- **Multiple Alert Support**: View all active alerts for your location
- **EC Color Coding**: Proper Environment Canada color scheme (RED/YELLOW/ORANGE/GREY)
- **Detailed Information**: Expand alerts to view complete details with What/When/Where
- **Safety Tips**: Displays Environment Canada safety recommendations from CAP instruction data
- **Push Notifications**: Receive alerts even when the app is closed
- **Background Checking**: Automatic periodic checking for new alerts
- **Robust Fallbacks**: Multiple fallback mechanisms for reliable alert delivery
- **Direct Links**: Access the full alert on Environment Canada's website

## Radar Map Features

The radar map page provides:

- **RainViewer Precipitation Radar**: Animated precipitation data with 6-frame history
- **Wind Layer Overlay**: Real-time wind speed and direction arrows from Open-Meteo
- **Layer Toggle Controls**: Enable/disable precipitation and wind layers independently
- **Interactive Controls**: Play/pause animation, step through frames, zoom and pan
- **Wind Information Popups**: Click wind arrows to see speed and direction details
- **Color-Coded Intensity**: Legend shows precipitation and wind speed intensity levels
- **Dark Mode Support**: Radar map adapts to the app's dark mode setting
- **Responsive Design**: Optimized for both desktop and mobile viewing
- **Location Synchronization**: Automatically centers on your selected location

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm 8.0.0 or later

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/screech24/maplecast-weather.git
   cd maplecast-weather/maplecast
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The app will open in your browser at [http://localhost:3000](http://localhost:3000).

**That's it!** No API keys or environment variables needed.

## Usage

- Allow location access when prompted to see weather data for your current location
- View current conditions at the top of the page
- Scroll down to see the 7-day forecast
- Swipe left/right on mobile to navigate between pages
- Enable notifications when prompted to receive weather alerts
- Install as a PWA by clicking "Add to Home Screen" in your browser's menu

## PWA Features

This application is a Progressive Web App, which means you can:

- Install it on your home screen
- Use it offline with cached data
- Receive push notifications for weather alerts
- Get updates automatically

### Notification Setup

1. When first using the app, you'll be prompted to allow notifications
2. You can customize which types of alerts you want to receive
3. Weather alerts will be sent even when the app is not open

## Data Sources

- **Weather Data**: [Open-Meteo API](https://open-meteo.com/) - Free, no API key required
- **Radar Data**: [RainViewer](https://www.rainviewer.com/) - Free precipitation radar
- **Wind Data**: [Open-Meteo API](https://open-meteo.com/) - Free wind velocity data
- **Weather Alerts**: [Environment Canada MSC Datamart](https://dd.weather.gc.ca/) - CAP format alerts
- **Location Search**: [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) - Free, no rate limits
- **Reverse Geocoding**: [Photon](https://photon.komoot.io/) - Free OpenStreetMap-based geocoding

## Technologies Used

- React.js 18
- Open-Meteo API (weather data, wind layer, and location search)
- RainViewer (precipitation radar)
- Leaflet (interactive maps)
- Environment Canada MSC Datamart (CAP weather alerts)
- Photon API (reverse geocoding)
- react-swipeable (mobile navigation)
- Axios (API requests)
- Service Workers (PWA functionality)
- Web Push API (notifications)
- GitHub Pages (deployment)

## Versioning and Deployment

### Version Tracking

The app uses semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR version for incompatible API changes
- MINOR version for new functionality in a backward compatible manner
- PATCH version for backward compatible bug fixes

Current version is displayed in the footer of the application.

### Changelog

All notable changes to this project are documented in the [CHANGELOG.md](./CHANGELOG.md) file.

### Deployment

The app is deployed to GitHub Pages. To deploy a new version:

1. Make your changes and update the version number in `package.json`
2. Update the `CHANGELOG.md` with your changes
3. Run the deployment script:

```bash
./deploy.sh
```

Additional deployment options:

```bash
# Install dependencies and deploy
./deploy.sh --install

# Deploy with a custom commit message
./deploy.sh "Your custom commit message"

# Install dependencies and deploy with a custom commit message
./deploy.sh --install "Your custom commit message"
```

This will build the app and deploy it to GitHub Pages at: https://screech24.github.io/maplecast-weather/

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Weather data provided by [Open-Meteo](https://open-meteo.com/)
- Precipitation radar by [RainViewer](https://www.rainviewer.com/)
- Weather alerts from [Environment Canada MSC Datamart](https://dd.weather.gc.ca/)
- Geocoding by [OpenStreetMap](https://www.openstreetmap.org/)
