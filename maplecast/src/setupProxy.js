const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for weather alerts
  app.use(
    '/proxy-api/weather-alerts',
    createProxyMiddleware({
      target: 'https://weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: function(path, req) {
        // Extract the URL from the query parameter
        const targetUrl = new URL(req.query.url);
        console.log(`Proxying request to: ${targetUrl.pathname}`);
        // Return just the path portion of the URL
        return targetUrl.pathname;
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add headers that might help with CORS issues
        proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
        proxyReq.setHeader('Cache-Control', 'no-cache');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('Proxy request headers:', proxyReq.getHeaders());
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log the response status
        console.log(`Proxy response status: ${proxyRes.statusCode}`);
        console.log(`Proxy response headers:`, proxyRes.headers);
        
        // Add CORS headers to the response
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control';
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        console.error('Proxy error details:', {
          url: req.url,
          method: req.method,
          headers: req.headers,
          error: err.message
        });
        
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control'
        });
        res.end(`Proxy error: ${err.message}. Check server logs for details.`);
      },
      logLevel: 'debug'
    })
  );
  
  // Add a direct proxy for RSS feeds
  app.use(
    '/proxy-api/rss',
    createProxyMiddleware({
      target: 'https://weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/proxy-api/rss': '/rss'
      },
      onProxyReq: (proxyReq, req, res) => {
        // Add headers that might help with CORS issues
        proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
        proxyReq.setHeader('Cache-Control', 'no-cache');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        console.log('RSS proxy request headers:', proxyReq.getHeaders());
      },
      onProxyRes: (proxyRes, req, res) => {
        // Log the response status
        console.log(`RSS proxy response status: ${proxyRes.statusCode}`);
        console.log(`RSS proxy response headers:`, proxyRes.headers);
        
        // Add CORS headers to the response
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control';
      },
      onError: (err, req, res) => {
        console.error('RSS proxy error:', err);
        console.error('RSS proxy error details:', {
          url: req.url,
          method: req.method,
          headers: req.headers,
          error: err.message
        });
        
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control'
        });
        res.end(`RSS proxy error: ${err.message}. Check server logs for details.`);
      },
      logLevel: 'debug'
    })
  );
  
  // Add a specific battleboard proxy to handle some edge cases
  app.use(
    '/proxy-api/battleboard',
    createProxyMiddleware({
      target: 'https://weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: function(path, req) {
        const province = req.query.province || 'on';
        return `/rss/battleboard/${province}_e.xml`;
      },
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
        proxyReq.setHeader('Cache-Control', 'no-cache');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`Battleboard proxy response status: ${proxyRes.statusCode}`);
        
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control';
      },
      onError: (err, req, res) => {
        console.error('Battleboard proxy error:', err);
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Cache-Control'
        });
        res.end(`Battleboard proxy error: ${err.message}`);
      },
      logLevel: 'debug'
    })
  );
}; 