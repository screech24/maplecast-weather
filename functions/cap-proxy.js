const axios = require('axios');

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Extract the path after the function name in the Netlify Functions URL
    let path = '';
    
    if (event.path.includes('/.netlify/functions/cap-proxy/')) {
      // Extract everything after cap-proxy/
      path = event.path.split('/.netlify/functions/cap-proxy/')[1] || '';
    } else if (event.path.includes('/api/cap/')) {
      // Fallback for direct API calls
      path = event.path.replace('/api/cap/', '');
    } else if (event.rawUrl) {
      // Try to extract from the raw URL if available
      const url = new URL(event.rawUrl);
      const pathParts = url.pathname.split('/');
      const capProxyIndex = pathParts.findIndex(part => part === 'cap-proxy');
      
      if (capProxyIndex !== -1 && capProxyIndex < pathParts.length - 1) {
        path = pathParts.slice(capProxyIndex + 1).join('/');
      }
    }
    
    console.log(`Extracted path: ${path}`);
    
    // Check for battleboard RSS feed requests
    if (path.startsWith('battleboard/')) {
      const regionCode = path.replace('battleboard/', '').replace('_e.xml', '');
      const battleboardUrl = `https://weather.gc.ca/warnings/rss/${regionCode}_e.xml`;
      
      console.log(`Fetching battleboard RSS feed: ${battleboardUrl}`);
      
      try {
        // Use a CORS proxy for development
        const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(battleboardUrl)}`;
        console.log(`Using CORS proxy: ${corsProxyUrl}`);
        
        const response = await axios.get(corsProxyUrl, {
          headers: {
            'Accept': 'application/xml, text/xml, */*',
            'User-Agent': 'MapleCast-Weather-App/1.0',
            'Cache-Control': 'no-cache'
          },
          timeout: 10000
        });
        
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/xml'
          },
          body: response.data
        };
      } catch (rssError) {
        console.error(`Error fetching RSS feed: ${rssError.message}`);
        return {
          statusCode: 502,
          headers,
          body: `Error fetching RSS feed: ${rssError.message}`
        };
      }
    }
    
    // Construct the URL to Environment Canada
    const url = `https://dd.weather.gc.ca/alerts/cap/${path}`;
    
    console.log(`Proxying request to: ${url}`);
    
    // Use a CORS proxy for development
    const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    console.log(`Using CORS proxy: ${corsProxyUrl}`);
    
    // Fetch the data from Environment Canada via CORS proxy
    const response = await axios.get(corsProxyUrl, {
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'User-Agent': 'MapleCast-Weather-App/1.0',
        'Cache-Control': 'no-cache'
      },
      // Add a timeout to prevent hanging requests
      timeout: 15000,
      // Add validation to handle redirects
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept all responses except server errors
      }
    });
    
    // If we get a 404, return it without logging an error
    if (response.status === 404) {
      return {
        statusCode: 404,
        headers,
        body: 'Not Found'
      };
    }
    
    // For other non-200 responses, log them
    if (response.status !== 200) {
      console.log(`Received non-200 status: ${response.status} for URL: ${url}`);
    }
    
    // Return the data from Environment Canada
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers['content-type'] || 'application/xml'
      },
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } catch (error) {
    console.error('Error in cap-proxy:', error.message);
    
    // Return a more specific error message
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      statusCode = error.response.status;
      errorMessage = `Error ${statusCode}: ${error.response.statusText || 'Unknown Error'}`;
      
      // For 404s, don't treat as an error
      if (statusCode === 404) {
        return {
          statusCode: 404,
          headers,
          body: 'Not Found'
        };
      }
    } else if (error.request) {
      // The request was made but no response was received
      statusCode = 503;
      errorMessage = 'Service Unavailable: No response received';
    } else {
      // Something happened in setting up the request that triggered an Error
      statusCode = 400;
      errorMessage = `Bad Request: ${error.message}`;
    }
    
    return {
      statusCode,
      headers,
      body: errorMessage
    };
  }
}; 