const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

// Get package version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const packageVersion = packageJson.version;

module.exports = function override(config, env) {
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
      'process.env.REACT_APP_VERSION': JSON.stringify(packageVersion),
      'process.version': JSON.stringify(process.version)
    })
  ];
  
  // Ensure publicPath is set correctly
  if (env === 'production') {
    // Get the homepage from package.json
    const packageJson = require(path.resolve('./package.json'));
    const homepage = packageJson.homepage;
    
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