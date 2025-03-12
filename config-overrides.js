const webpack = require('webpack');
const path = require('path');

module.exports = function override(config, env) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "timers": require.resolve("timers-browserify"),
    "util": require.resolve("util/"),
    "events": require.resolve("events/"),
    "assert": require.resolve("assert/"),
    "process": false  // Tell webpack to use a fake empty process module
  };

  // Add global variables
  config.plugins = [
    ...(config.plugins || []),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    // This creates an empty process shim with a few necessary properties
    new webpack.DefinePlugin({
      'process.browser': JSON.stringify(true),
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