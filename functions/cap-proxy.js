const axios = require('axios');

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Get the path from the request
    const path = event.path.replace('/api/cap/', '');
    
    // Construct the URL to Environment Canada
    const url = `https://dd.weather.gc.ca/alerts/cap/${path}`;
    
    console.log(`Proxying request to: ${url}`);
    
    // Fetch the data from Environment Canada
    const response = await axios.get(url, {
      headers: {
        'Accept': 'application/xml, text/xml, */*'
      },
      // Add a timeout to prevent hanging requests
      timeout: 10000
    });
    
    // Return the data
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': response.headers['content-type'] || 'text/plain'
      },
      body: typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data)
    };
  } catch (error) {
    console.log('Error:', error.message);
    
    // Return error details
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        status: error.response?.status,
        path: event.path
      })
    };
  }
}; 