# MapleCast Weather App

A React-based weather application that displays local weather data with enhanced radar visualization. This app uses OpenWeatherMap for weather information and Environment Canada for radar data. It functions as a Progressive Web App (PWA) with push notifications.

[![Version](https://img.shields.io/badge/version-1.9.1-blue.svg)](https://github.com/screech24/maplecast-weather/releases)
[![Demo](https://img.shields.io/badge/demo-live-green.svg)](https://screech24.github.io/maplecast-weather/)

## Features

- **Current Weather Conditions**: Temperature, humidity, wind speed, and more
- **7-Day Forecast**: Daily forecasts with high/low temperatures and precipitation chances
- **Hourly Forecast**: Detailed hourly predictions for the next 24 hours
- **Environment Canada Radar**: Live radar data with animation controls and multiple layer options
- **Mobile-Optimized Views**: List view layout for forecasts on mobile devices for better readability
- **Page Navigation**: Swipe between pages on mobile or use button navigation on desktop
- **Enhanced Radar Visualization**: Interactive radar map with animation controls
- **Dynamic Weather Backgrounds**: Background images that change based on weather conditions and time of day
- **Day/Night Visualization**: Different background images for day and night for all weather conditions
- **Multiple Precipitation Layers**: Toggle between rain, snow, and mixed precipitation
- **Weather Alerts**: Real-time alerts for severe weather conditions with push notifications
- **Location-based**: Uses your location to show relevant weather information
- **Canada-specific**: Optimized for Canadian locations with appropriate units (°C, km/h)
- **Progressive Web App**: Install on your device and use offline
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for all device sizes

## Radar Map Features

The radar map page provides:

- **Live Environment Canada Radar**: High-resolution radar data for precipitation across Canada
- **Animation Controls**: Play/pause and speed controls for radar animation
- **Multiple Radar Types**: Switch between mixed precipitation, rain, and snow layers
- **Weather Alerts Overlay**: View active weather alerts on the map
- **City Labels**: Toggle city names for better location context
- **Dark Mode Support**: Radar map adapts to the app's dark mode setting
- **Interactive Map**: Pan and zoom to explore different regions
- **Timestamp Display**: Shows the current radar frame's timestamp

## Getting Started

### Prerequisites

- Node.js 14.0.0 or later
- npm 6.0.0 or later
- An OpenWeatherMap API key

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
- **Weather Alerts**: [Environment Canada Weather Alerts](https://weather.gc.ca/warnings/index_e.html)

## Technologies Used

- React.js
- Axios (for API requests)
- OpenWeatherMap API (for weather data)
- Environment Canada (for radar and weather alerts)
- Leaflet & React-Leaflet (for interactive maps)
- Service Workers (for PWA functionality)
- Web Push API (for notifications)
- GitHub Pages (for deployment)

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
3. Run the deployment script from the weather-app directory:

```bash
cd weather-app
./deploy.sh
```

Or from the project root:

```bash
./weather-app/deploy.sh
```
The script will:
- Automatically navigate to the correct directory
- Check and update the git remote URL if needed
- Commit your source code changes
- Pull latest changes from the remote repository with rebase
- Push your changes to the repository
- Build the application
- Deploy to GitHub Pages
- Deploy to GitHub Pages

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

- Weather data provided by OpenWeatherMap
- Icons and design inspiration from various weather services
