const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy for CAP alert directory listings (dd.weather.gc.ca)
  app.use(
    '/proxy-api/cap-dirs',
    createProxyMiddleware({
      target: 'https://dd.weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: function(path, req) {
        // Extract the path after /proxy-api/cap-dirs
        const cleanPath = req.url.replace('/proxy-api/cap-dirs', '');
        console.log(`[Proxy] CAP directory: /today/alerts/cap${cleanPath}`);
        return `/today/alerts/cap${cleanPath}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Accept', 'text/html, application/xml, */*');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      },
      onError: (err, req, res) => {
        console.error('[Proxy] CAP directory error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end(`Proxy error: ${err.message}`);
      }
    })
  );

  // Proxy for CAP XML files (individual alerts)
  app.use(
    '/proxy-api/cap-file',
    createProxyMiddleware({
      target: 'https://dd.weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: function(path, req) {
        // Extract the full path after /proxy-api/cap-file
        const cleanPath = req.url.replace('/proxy-api/cap-file', '');
        console.log(`[Proxy] CAP file: /today/alerts/cap${cleanPath}`);
        return `/today/alerts/cap${cleanPath}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Accept', 'application/xml, text/xml, */*');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      },
      onError: (err, req, res) => {
        console.error('[Proxy] CAP file error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end(`Proxy error: ${err.message}`);
      }
    })
  );

  // Proxy for EC warnings page (fallback)
  app.use(
    '/proxy-api/warnings',
    createProxyMiddleware({
      target: 'https://weather.gc.ca',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/proxy-api/warnings': '/warnings'
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Accept', 'text/html, */*');
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      },
      onError: (err, req, res) => {
        console.error('[Proxy] Warnings error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end(`Proxy error: ${err.message}`);
      }
    })
  );

  // Proxy for Nominatim reverse geocoding (to add proper User-Agent header)
  app.use(
    '/proxy-api/geocode',
    createProxyMiddleware({
      target: 'https://nominatim.openstreetmap.org',
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        '^/proxy-api/geocode': ''
      },
      onProxyReq: (proxyReq) => {
        // Nominatim requires a proper User-Agent
        proxyReq.setHeader('User-Agent', 'MapleCast-Weather-App/2.0 (https://github.com/maplecast; contact@maplecast.app)');
        proxyReq.setHeader('Accept', 'application/json');
      },
      onProxyRes: (proxyRes) => {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
      },
      onError: (err, req, res) => {
        console.error('[Proxy] Geocode error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
        res.end(`Proxy error: ${err.message}`);
      }
    })
  );
};
