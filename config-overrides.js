const webpack = require('webpack');

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

  return config;
}; 