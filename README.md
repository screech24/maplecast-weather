# Weather App

A React-based weather application that displays local weather data. This app uses OpenWeatherMap for weather information and functions as a Progressive Web App (PWA) with push notifications.

## Features

- **Current Weather Conditions**: Temperature, humidity, wind speed, and more
- **7-Day Forecast**: Daily forecasts with high/low temperatures and precipitation chances
- **Location-based**: Uses your location to show relevant weather information
- **Canada-specific**: Optimized for Canadian locations with appropriate units (°C, km/h)
- **Progressive Web App**: Install on your device and use offline
- **Weather Alerts**: Push notifications for severe weather conditions
- **Customizable Notifications**: Set up alerts for specific weather conditions

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

## Technologies Used

- React.js
- Axios (for API requests)
- OpenWeatherMap API (for weather data)
- Service Workers (for PWA functionality)
- Web Push API (for notifications)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Weather data provided by OpenWeatherMap
- Icons and design inspiration from various weather services
