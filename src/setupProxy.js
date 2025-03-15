const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for weather alerts
  app.use(
    '/proxy-api/weather-alerts',
    createProxyMiddleware({
      target: 'https://weather.gc.ca',
      changeOrigin: true,
      pathRewrite: function(path, req) {
        // Extract the URL from the query parameter
        const targetUrl = new URL(req.query.url);
        // Return just the path portion of the URL
        return targetUrl.pathname;
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add headers that might help with CORS issues
        proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
        proxyReq.setHeader('Cache-Control', 'no-cache');
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain',
        });
        res.end('Proxy error: ' + err.message);
      },
      logLevel: 'debug'
    })
  );
}; 