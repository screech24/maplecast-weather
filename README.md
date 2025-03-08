# Canada Weather Radar App

A React-based weather application that displays local weather data and live radar specifically for Canada. This app uses OpenWeatherMap for weather information and Environment Canada's free radar API.

## Features

- **Current Weather Conditions**: Temperature, humidity, wind speed, and more
- **7-Day Forecast**: Daily forecasts with high/low temperatures and precipitation chances
- **Live Radar Map**: Integrated radar data from Environment Canada
- **Location-based**: Uses your location to show relevant weather information
- **Canada-specific**: Optimized for Canadian locations with appropriate units (°C, km/h)

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
- Explore the radar map to see precipitation patterns
- The map can be zoomed and panned for more detailed viewing

## Data Sources

- **Weather Data**: [OpenWeatherMap API](https://openweathermap.org/api)
- **Radar Data**: [Environment Canada GeoMet](https://eccc-msc.github.io/open-data/msc-geomet/readme_en/) (WMS layer)

## Technologies Used

- React.js
- Leaflet (for mapping)
- Axios (for API requests)
- Environment Canada GeoMet WMS (for radar data)
- OpenWeatherMap API (for weather data)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Weather data provided by OpenWeatherMap
- Radar data provided by Environment Canada
- Icons and design inspiration from various weather services
