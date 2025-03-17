# MapleCast Weather App

## Version 1.2.2

A modern weather application built with React, providing accurate weather data for Canadian locations. The app features current conditions, hourly forecasts, 7-day forecasts, and interactive radar maps using Environment Canada data.

## Features

- **Current Weather Conditions**: Temperature, feels like, humidity, wind speed, and more
- **7-Day Forecast**: Extended forecast with high/low temperatures and weather conditions
- **Hourly Forecast**: Detailed hourly predictions for the next 48 hours
- **Interactive Radar Map**: Live radar data from Environment Canada with animation controls
- **Multiple Radar Types**: View rain, snow, or mixed precipitation radar data
- **Weather Alerts**: Display active weather alerts for your location
- **Location Search**: Find weather for any location in Canada
- **Geolocation**: Automatically detect your current location
- **Dark Mode**: Toggle between light and dark themes
- **Responsive Design**: Optimized for both desktop and mobile devices

## Recent Updates

### Version 1.2.2 (2025-05-14)
- Fixed radar data not displaying due to timestamp issues with Environment Canada WMS service
- Improved timestamp handling to use valid timestamps from the past 3 hours
- Enhanced error detection and recovery for radar layer loading
- Added more detailed logging for radar timestamp processing
- Implemented better fallback mechanisms when timestamps are invalid

### Version 1.2.1 (2024-05-14)
- Fixed radar data not displaying due to timestamp issues with Environment Canada WMS service
- Added fallback mechanism to get valid timestamps directly from the WMS service
- Improved error handling for radar layer loading

### Version 1.2.0 (2024-05-10)
- Added radar animation controls
- Added support for different radar types (rain, snow, mixed precipitation)
- Added radar legend and ability to toggle weather alerts and cities on the map
- Improved radar data loading and error handling

### Version 1.1.0 (2024-05-05)
- Integrated Environment Canada radar data
- Added map component with OpenStreetMap base layer
- Implemented geolocation to center map on user's location

## Technologies Used

- React
- OpenWeatherMap API
- Environment Canada MSC GeoMet API
- React Leaflet (for maps)
- Axios
- CSS Modules

## Installation and Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/maplecast-weather.git
   ```

2. Install dependencies:
   ```
   cd maplecast-weather
   npm install
   ```

3. Create a `.env` file in the root directory and add your OpenWeatherMap API key:
   ```
   REACT_APP_OPENWEATHERMAP_API_KEY=your_api_key_here
   ```

4. Start the development server:
   ```
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

## Deployment

The app is deployed on GitHub Pages at [https://yourusername.github.io/maplecast-weather/](https://yourusername.github.io/maplecast-weather/)

To deploy your own version:

1. Update the `homepage` field in `package.json` to your GitHub Pages URL
2. Run the deployment script:
   ```
   npm run deploy
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Weather data provided by [OpenWeatherMap](https://openweathermap.org/)
- Radar data provided by [Environment Canada MSC GeoMet](https://geo.weather.gc.ca/geomet/)
