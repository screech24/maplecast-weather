import React, { useState, useEffect } from 'react';
import { isDevelopment, isDebugMode } from '../utils/devMode';
import './DevTools.css';

/**
 * DevTools Component
 * 
 * This component provides development tools and debugging information.
 * It will only be rendered in development mode.
 */
const DevTools = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [logs, setLogs] = useState([]);
  const [networkRequests, setNetworkRequests] = useState([]);
  const [appState, setAppState] = useState({});

  // Capture console logs
  useEffect(() => {
    if (!isDevelopment || !isDebugMode) return;

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // Override console methods to capture logs
    console.log = (...args) => {
      setLogs(prev => [...prev, { type: 'log', message: args.join(' '), timestamp: new Date() }]);
      originalConsoleLog(...args);
    };

    console.error = (...args) => {
      setLogs(prev => [...prev, { type: 'error', message: args.join(' '), timestamp: new Date() }]);
      originalConsoleError(...args);
    };

    console.warn = (...args) => {
      setLogs(prev => [...prev, { type: 'warn', message: args.join(' '), timestamp: new Date() }]);
      originalConsoleWarn(...args);
    };

    // Restore original console methods on cleanup
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);

  // Monitor network requests
  useEffect(() => {
    if (!isDevelopment || !isDebugMode) return;

    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    // Override fetch
    window.fetch = async (...args) => {
      const url = args[0];
      const options = args[1] || {};
      const startTime = performance.now();
      
      const requestId = Date.now().toString();
      setNetworkRequests(prev => [...prev, {
        id: requestId,
        url,
        method: options.method || 'GET',
        status: 'pending',
        startTime
      }]);

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        setNetworkRequests(prev => prev.map(req =>
          req.id === requestId
            ? {
                ...req,
                status: response.ok ? 'success' : 'error',
                statusCode: response.status,
                duration: endTime - startTime,
                endTime
              }
            : req
        ));
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        
        setNetworkRequests(prev => prev.map(req =>
          req.id === requestId
            ? {
                ...req,
                status: 'error',
                error: error.message,
                duration: endTime - startTime,
                endTime
              }
            : req
        ));
        
        throw error;
      }
    };

    // Override XMLHttpRequest
    XMLHttpRequest.prototype.open = function(...args) {
      this._requestId = Date.now().toString();
      this._method = args[0];
      this._url = args[1];
      this._startTime = performance.now();
      
      setNetworkRequests(prev => [...prev, {
        id: this._requestId,
        url: this._url,
        method: this._method,
        status: 'pending',
        startTime: this._startTime
      }]);
      
      return originalXHROpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('load', () => {
        const endTime = performance.now();
        
        setNetworkRequests(prev => prev.map(req =>
          req.id === this._requestId
            ? {
                ...req,
                status: this.status >= 200 && this.status < 300 ? 'success' : 'error',
                statusCode: this.status,
                duration: endTime - this._startTime,
                endTime
              }
            : req
        ));
      });
      
      this.addEventListener('error', () => {
        const endTime = performance.now();
        
        setNetworkRequests(prev => prev.map(req =>
          req.id === this._requestId
            ? {
                ...req,
                status: 'error',
                duration: endTime - this._startTime,
                endTime
              }
            : req
        ));
      });
      
      return originalXHRSend.apply(this, args);
    };

    // Restore original methods on cleanup
    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
    };
  }, []);

  // Collect app state information
  useEffect(() => {
    if (!isDevelopment) return;
    
    const interval = setInterval(() => {
      setAppState({
        memory: performance.memory ? {
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)),
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / (1024 * 1024)),
          jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024))
        } : null,
        timestamp: new Date().toISOString(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent,
        env: {
          isDevelopment,
          isDebugMode,
          version: process.env.REACT_APP_VERSION
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
  // Only render in development mode
  if (!isDevelopment) return null;

  const toggleDevTools = () => {
    setIsOpen(!isOpen);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const clearNetworkRequests = () => {
    setNetworkRequests([]);
  };

  return (
    <div className="dev-tools-container">
      <button 
        className={`dev-tools-toggle ${isOpen ? 'open' : ''} ${isDebugMode ? 'debug-mode' : ''}`}
        onClick={toggleDevTools}
      >
        {isOpen ? 'Close DevTools' : 'DevTools'}
      </button>
      
      {isOpen && (
        <div className="dev-tools-panel">
          <div className="dev-tools-header">
            <h3>Development Tools {isDebugMode && <span className="debug-badge">Debug Mode</span>}</h3>
            <div className="dev-tools-tabs">
              <button 
                className={activeTab === 'info' ? 'active' : ''} 
                onClick={() => setActiveTab('info')}
              >
                Info
              </button>
              <button 
                className={activeTab === 'logs' ? 'active' : ''} 
                onClick={() => setActiveTab('logs')}
              >
                Logs
              </button>
              <button 
                className={activeTab === 'network' ? 'active' : ''} 
                onClick={() => setActiveTab('network')}
              >
                Network
              </button>
            </div>
          </div>
          
          <div className="dev-tools-content">
            {activeTab === 'info' && (
              <div className="dev-tools-info">
                <h4>Application Info</h4>
                <div className="info-grid">
                  <div>
                    <strong>Version:</strong> {process.env.REACT_APP_VERSION}
                  </div>
                  <div>
                    <strong>Environment:</strong> {process.env.REACT_APP_ENV || 'production'}
                  </div>
                  <div>
                    <strong>Debug Mode:</strong> {isDebugMode ? 'Enabled' : 'Disabled'}
                  </div>
                  <div>
                    <strong>Viewport:</strong> {appState.viewport?.width}x{appState.viewport?.height}
                  </div>
                  {appState.memory && (
                    <>
                      <div>
                        <strong>Memory Usage:</strong> {appState.memory.usedJSHeapSize}MB / {appState.memory.totalJSHeapSize}MB
                      </div>
                      <div>
                        <strong>Memory Limit:</strong> {appState.memory.jsHeapSizeLimit}MB
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'logs' && (
              <div className="dev-tools-logs">
                <div className="logs-header">
                  <h4>Console Logs</h4>
                  <button onClick={clearLogs}>Clear Logs</button>
                </div>
                <div className="logs-container">
                  {logs.length === 0 ? (
                    <p className="no-data">No logs captured yet.</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className={`log-entry ${log.type}`}>
                        <span className="log-time">
                          {log.timestamp.toTimeString().split(' ')[0]}
                        </span>
                        <span className="log-type">{log.type.toUpperCase()}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'network' && (
              <div className="dev-tools-network">
                <div className="network-header">
                  <h4>Network Requests</h4>
                  <button onClick={clearNetworkRequests}>Clear Requests</button>
                </div>
                <div className="network-container">
                  {networkRequests.length === 0 ? (
                    <p className="no-data">No network requests captured yet.</p>
                  ) : (
                    <table className="network-table">
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th>URL</th>
                          <th>Status</th>
                          <th>Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {networkRequests.map((request) => (
                          <tr key={request.id} className={`request-row ${request.status}`}>
                            <td>{request.method}</td>
                            <td className="url-cell">{request.url}</td>
                            <td>
                              {request.status === 'pending' ? 
                                'Pending' : 
                                request.statusCode || (request.status === 'error' ? 'Error' : 'Success')}
                            </td>
                            <td>
                              {request.duration ? 
                                `${request.duration.toFixed(2)}ms` : 
                                '...'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevTools;