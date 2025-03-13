const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

// Get package version from package.json
const packageData = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const packageVersion = packageData.version;

// Determine if we're in development or debug mode
const isDevelopment = process.env.REACT_APP_ENV === 'development';
const isDebugMode = process.env.REACT_APP_DEBUG === 'true';

module.exports = function override(config, env) {
  // Log environment information in development mode
  if (isDevelopment) {
    console.log('Running in DEVELOPMENT mode');
    if (isDebugMode) {
      console.log('DEBUG mode enabled - verbose logging will be active');
    }
  }
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "util": require.resolve("util"),
    "assert": require.resolve("assert"),
    "process": require.resolve("process"),
    "events": require.resolve("events"),
    "timers": require.resolve("timers-browserify")
  };
  
  // Add plugins to provide global variables
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process'
    }),
    new webpack.DefinePlugin({
      // Use a unique name to avoid conflicts with CRA's built-in DefinePlugin
      'process.env.APP_VERSION': JSON.stringify(packageVersion),
      'process.env.REACT_APP_ENV': JSON.stringify(process.env.REACT_APP_ENV || 'production'),
      'process.env.REACT_APP_DEBUG': JSON.stringify(process.env.REACT_APP_DEBUG || 'false'),
      'process.version': JSON.stringify(process.version)
    })
  ];
  
  // Ensure publicPath is set correctly
  if (env === 'production') {
    // Get the homepage from package.json
    const pkgJson = require(path.resolve('./package.json'));
    const homepage = pkgJson.homepage;
    
    if (homepage) {
      // Handle relative paths like "/"
      if (homepage === '/') {
        console.log('Setting public path to: /');
        config.output.publicPath = '/';
      } else if (homepage.startsWith('http')) {
        // Extract the path part from the homepage URL
        try {
          const url = new URL(homepage);
          const publicPath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
          
          console.log(`Setting public path to: ${publicPath}`);
          config.output.publicPath = publicPath;
        } catch (error) {
          console.error('Error parsing homepage URL:', error.message);
          // Default to root path if URL parsing fails
          config.output.publicPath = '/';
        }
      } else {
        // Handle other relative paths
        const publicPath = homepage.endsWith('/') ? homepage : `${homepage}/`;
        console.log(`Setting public path to: ${publicPath}`);
        config.output.publicPath = publicPath;
      }
    }
  }

  return config;
}; 