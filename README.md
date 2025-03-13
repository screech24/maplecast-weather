# MapleCast Weather App

A React-based weather application that displays local weather data with enhanced radar visualization. This app uses OpenWeatherMap for weather information and Environment Canada for radar data and location search. It functions as a Progressive Web App (PWA) with push notifications.

[![Version](https://img.shields.io/badge/version-1.9.1-blue.svg)](https://github.com/screech24/maplecast-weather/releases)
[![Demo](https://img.shields.io/badge/demo-live-green.svg)](https://maplecast.netlify.app)

## Features

- **Current Weather Conditions**: Temperature, humidity, wind speed, and more
- **7-Day Forecast**: Daily forecasts with high/low temperatures and precipitation chances
- **Hourly Forecast**: Detailed hourly predictions for the next 24 hours
- **Enhanced Radar Visualization**: Interactive radar map with animation controls
- **Dynamic Weather Backgrounds**: Background images that change based on weather conditions and time of day
- **Day/Night Visualization**: Different background images for day and night for all weather conditions
- **Multiple Precipitation Layers**: Toggle between rain, snow, and mixed precipitation
- **Weather Alerts**: Real-time alerts from Environment Canada's CAP system with geospatial filtering
- **Canadian Location Database**: Direct integration with Environment Canada's MSC GeoMet service for accurate Canadian location search
- **Advanced Location Search**: Intelligent search for Canadian locations with postal code support and provincial suggestions
- **Location-based**: Uses your location to show relevant weather information
- **Canada-specific**: Optimized for Canadian locations with appropriate units (°C, km/h)
- **Progressive Web App**: Install on your device and use offline
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for all device sizes

## Getting Started

### Prerequisites

- Node.js 14.0.0 or later
- npm 6.0.0 or later
- An OpenWeatherMap API key

### Development Modes

The app supports different development modes for easier testing and debugging:

- **Standard Mode**: `npm start` - Runs the app in standard development mode
- **Development Mode**: `npm run dev` - Runs with development environment variables for testing
- **Debug Mode**: `npm run debug` - Runs with enhanced logging and debugging tools

When running in development or debug mode, a DevTools panel will be available in the bottom right corner of the app, providing:

- Application information
- Console logs
- Network request monitoring
- Performance metrics

This makes it easier to test changes locally without having to deploy to Netlify.

### Setting up the API Key

1. Sign up for a free account at [OpenWeatherMap](https://home.openweathermap.org/users/sign_up)
2. After signing in, go to your [API keys](https://home.openweathermap.org/api_keys) tab
3. Generate a new API key or use your existing one
4. Copy your API key

### Installation

1. Clone this repository
2. Navigate to the project directory
3. Install dependencies:
   ```
   npm install
   ```
4. Create a `.env` file in the root directory and add your API key:
   ```
   REACT_APP_OPENWEATHERMAP_API_KEY=your_api_key_here
   ```
   Replace `your_api_key_here` with your actual OpenWeatherMap API key

### Running the App

To start the development server:

```
npm start
```

The app will open in your browser at [http://localhost:3000](http://localhost:3000).

## Usage

- Allow location access when prompted to see weather data for your current location
- View current conditions at the top of the page
- Scroll down to see the 7-day forecast
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

- **Weather Data**: [OpenWeatherMap API](https://openweathermap.org/api)
- **Radar Data**: [Environment Canada GeoMet-Weather](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/)
- **Weather Alerts**: [Environment Canada CAP Alerts](http://dd.weather.gc.ca/alerts/cap/)

## Weather Alert System

The app features a comprehensive weather alert system that:

- Fetches real-time CAP (Common Alerting Protocol) alerts from Environment Canada
- Uses geospatial calculations to determine if alerts affect your location
- Displays alerts with appropriate severity indicators (extreme, severe, moderate)
- Provides detailed information about each alert including affected areas and expiry times
- Implements smart caching to improve performance and reduce API calls
- Handles multiple concurrent alerts with an intuitive navigation interface
- Deduplicates alerts to show only the most relevant and recent information

The alert system is designed to work across all Canadian regions and provides critical weather information to help users stay safe during severe weather events.

## Technologies Used

- React.js
- Axios (for API requests)
- OpenWeatherMap API (for weather data)
- Environment Canada (for radar and weather alerts)
- Netlify Functions (for server-side proxy to resolve CORS issues)
- Netlify (for application hosting)
- Leaflet & React-Leaflet (for interactive maps)
- Service Workers (for PWA functionality)
- Web Push API (for notifications)

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

The app is deployed to Netlify. To deploy a new version:

1. Make your changes and update the version number in `package.json`
2. Update the `CHANGELOG.md` with your changes
3. Run the deployment script from the weather-app directory:

```bash
cd weather-app
npm run netlify:deploy
```

Or from the project root:

```bash
cd weather-app && npm run netlify:deploy
```

Additional deployment options:

```bash
# Install dependencies and deploy
npm install && npm run netlify:deploy
```

This will build the app and deploy it to Netlify at: https://maplecast.netlify.app

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Weather data provided by OpenWeatherMap
- Icons and design inspiration from various weather services
