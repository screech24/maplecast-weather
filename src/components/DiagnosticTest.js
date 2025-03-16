import React, { useState, useEffect } from 'react';
import './DiagnosticTest.css';

const DiagnosticTest = () => {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [testComplete, setTestComplete] = useState(false);

  // Add a log entry to the results
  const addLog = (message, type = 'info') => {
    setResults(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  // Test WMS service with different proxies and versions
  const testWmsService = async () => {
    addLog('Starting WMS service tests...', 'header');
    
    // Define WMS URLs to test
    const wmsBaseUrl = 'https://geo.weather.gc.ca/geomet';
    
    // Define proxies to test
    const proxies = [
      { name: 'Direct (no proxy)', url: '' },
      { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
      { name: 'allorigins.win', url: 'https://api.allorigins.win/raw?url=' },
      { name: 'cors.sh', url: 'https://proxy.cors.sh/' },
      { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' }
    ];
    
    // Define WMS versions to test
    const versions = ['1.1.1', '1.3.0', '1.4.0'];
    
    // Define layers to test
    const layers = [
      { name: 'Rain', layer: 'RADAR_1KM_RRAI' },
      { name: 'Snow', layer: 'RADAR_1KM_RSNO' },
      { name: 'Mixed', layer: 'RADAR_1KM_RDPR' },
      { name: 'Alerts', layer: 'ALERTS' }
    ];
    
    // Test each combination
    for (const proxy of proxies) {
      addLog(`Testing with ${proxy.name}`, 'subheader');
      
      for (const version of versions) {
        addLog(`Testing WMS version ${version}`, 'section');
        
        for (const layer of layers) {
          try {
            // Construct the WMS GetMap URL
            const wmsUrl = `${proxy.url}${encodeURIComponent(wmsBaseUrl)}?SERVICE=WMS&VERSION=${version}&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${layer.layer}&WIDTH=256&HEIGHT=256&BBOX=-180,-90,180,90&SRS=EPSG:4326`;
            
            addLog(`Testing ${layer.name} layer with version ${version}...`);
            
            const startTime = performance.now();
            const response = await fetch(wmsUrl, {
              method: 'GET',
              headers: {
                'Accept': 'image/png',
                'Cache-Control': 'no-cache'
              }
            });
            const endTime = performance.now();
            
            if (response.ok) {
              // Check if we got an image
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('image/png')) {
                addLog(`✅ Success: ${layer.name} layer with ${proxy.name} and version ${version} (${Math.round(endTime - startTime)}ms)`, 'success');
              } else {
                addLog(`⚠️ Warning: ${layer.name} layer with ${proxy.name} and version ${version} returned ${contentType} instead of image/png`, 'warning');
              }
            } else {
              addLog(`❌ Error: ${layer.name} layer with ${proxy.name} and version ${version} failed with status ${response.status}`, 'error');
            }
          } catch (error) {
            addLog(`❌ Error: ${layer.name} layer with ${proxy.name} and version ${version} threw exception: ${error.message}`, 'error');
          }
        }
      }
    }
    
    addLog('WMS service tests complete', 'header');
  };

  // Test weather alerts with different proxies
  const testWeatherAlerts = async () => {
    addLog('Starting weather alerts tests...', 'header');
    
    // Define alert URLs to test
    const alertUrls = [
      { name: 'Ontario Battleboard', url: 'https://weather.gc.ca/rss/battleboard/on_e.xml' },
      { name: 'Ontario Warnings', url: 'https://weather.gc.ca/rss/warning/on_e.xml' }
    ];
    
    // Define proxies to test
    const proxies = [
      { name: 'Direct (no proxy)', url: '' },
      { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
      { name: 'allorigins.win', url: 'https://api.allorigins.win/raw?url=' },
      { name: 'cors.sh', url: 'https://proxy.cors.sh/' },
      { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' }
    ];
    
    // Test each combination
    for (const alertUrl of alertUrls) {
      addLog(`Testing ${alertUrl.name}`, 'subheader');
      
      for (const proxy of proxies) {
        try {
          // Construct the full URL
          const fullUrl = `${proxy.url}${encodeURIComponent(alertUrl.url)}`;
          
          addLog(`Testing with ${proxy.name}...`);
          
          const startTime = performance.now();
          const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'Cache-Control': 'no-cache'
            }
          });
          const endTime = performance.now();
          
          if (response.ok) {
            const text = await response.text();
            
            if (text && text.trim() !== '') {
              // Check if it's valid XML
              try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                
                if (xmlDoc.querySelector('parsererror')) {
                  addLog(`⚠️ Warning: ${alertUrl.name} with ${proxy.name} returned invalid XML (${Math.round(endTime - startTime)}ms)`, 'warning');
                } else {
                  // Check if it contains entries/items
                  const entries = xmlDoc.querySelectorAll('entry');
                  const items = xmlDoc.querySelectorAll('item');
                  
                  if (entries.length > 0 || items.length > 0) {
                    addLog(`✅ Success: ${alertUrl.name} with ${proxy.name} returned valid XML with ${entries.length || items.length} alerts (${Math.round(endTime - startTime)}ms)`, 'success');
                  } else {
                    addLog(`⚠️ Warning: ${alertUrl.name} with ${proxy.name} returned valid XML but no alerts found (${Math.round(endTime - startTime)}ms)`, 'warning');
                  }
                }
              } catch (parseError) {
                addLog(`❌ Error: ${alertUrl.name} with ${proxy.name} XML parsing failed: ${parseError.message}`, 'error');
              }
            } else {
              addLog(`❌ Error: ${alertUrl.name} with ${proxy.name} returned empty response`, 'error');
            }
          } else {
            addLog(`❌ Error: ${alertUrl.name} with ${proxy.name} failed with status ${response.status}`, 'error');
          }
        } catch (error) {
          addLog(`❌ Error: ${alertUrl.name} with ${proxy.name} threw exception: ${error.message}`, 'error');
        }
      }
    }
    
    addLog('Weather alerts tests complete', 'header');
  };

  // Run all tests
  const runTests = async () => {
    setIsRunning(true);
    setTestComplete(false);
    setResults([]);
    
    addLog('Starting diagnostic tests...', 'header');
    
    try {
      // Test WMS service
      await testWmsService();
      
      // Test weather alerts
      await testWeatherAlerts();
      
      addLog('All tests completed successfully', 'header');
    } catch (error) {
      addLog(`Test execution error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
      setTestComplete(true);
    }
  };

  return (
    <div className="diagnostic-test-container">
      <h2>Radar and Alerts Diagnostic Test</h2>
      <p className="test-description">
        This tool tests the radar and weather alerts functionality to identify CORS and API issues.
      </p>
      
      <div className="test-controls">
        <button 
          className="run-test-button" 
          onClick={runTests} 
          disabled={isRunning}
        >
          {isRunning ? 'Running Tests...' : 'Run Diagnostic Tests'}
        </button>
      </div>
      
      <div className="test-results">
        <h3>Test Results</h3>
        {results.length === 0 && !isRunning && (
          <p className="no-results">No tests have been run yet.</p>
        )}
        
        {isRunning && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Running tests, please wait...</p>
          </div>
        )}
        
        <div className="results-log">
          {results.map((result, index) => (
            <div key={index} className={`log-entry ${result.type}`}>
              {result.message}
            </div>
          ))}
        </div>
        
        {testComplete && (
          <div className="test-summary">
            <h3>Test Summary</h3>
            <p>
              Success: {results.filter(r => r.type === 'success').length} tests passed
            </p>
            <p>
              Warnings: {results.filter(r => r.type === 'warning').length} tests with warnings
            </p>
            <p>
              Errors: {results.filter(r => r.type === 'error').length} tests failed
            </p>
            
            <div className="recommendations">
              <h4>Recommendations</h4>
              <ul>
                {results.filter(r => r.type === 'success').length === 0 && (
                  <li>All tests failed. Check your internet connection and try again.</li>
                )}
                {results.some(r => r.message.includes('corsproxy.io') && r.type === 'success') && (
                  <li>corsproxy.io is working well. Consider using this as your primary CORS proxy.</li>
                )}
                {results.some(r => r.message.includes('version 1.3.0') && r.type === 'success') && (
                  <li>WMS version 1.3.0 is working. Update your WMS version from 1.4.0 to 1.3.0.</li>
                )}
                {results.some(r => r.message.includes('thingproxy') && r.type === 'success') && (
                  <li>thingproxy is working well for alerts. Consider adding this to your CORS proxy options.</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiagnosticTest; 