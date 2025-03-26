// Service Worker for Weather App with Alerts Notification Support
const APP_VERSION = '1.13.6'; // Match this with package.json version
const CACHE_NAME = `weather-app-cache-v${APP_VERSION}`;
const ALERTS_CACHE_NAME = `weather-alerts-cache-v${APP_VERSION}`;
const ALERTS_SYNC_KEY = 'weather-alerts-periodic';

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/static/js/bundle.js',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Install event - cache critical assets
self.addEventListener('install', event => {
  console.log(`[Service Worker] Installing new version ${APP_VERSION}`);
  self.skipWaiting(); // Force activation
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Activating new version ${APP_VERSION}`);
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            // Delete any old caches that don't match the current version
            return (cacheName.startsWith('weather-app-cache-') && cacheName !== CACHE_NAME) || 
                   (cacheName.startsWith('weather-alerts-cache-') && cacheName !== ALERTS_CACHE_NAME);
          }).map(cacheName => {
            console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
      // Register for periodic sync if supported
      (async () => {
        if ('periodicSync' in self.registration) {
          try {
            await self.registration.periodicSync.register(ALERTS_SYNC_KEY, {
              minInterval: 60 * 60 * 1000 // Once per hour
            });
            console.log('Registered periodic sync for weather alerts');
          } catch (error) {
            console.error('Error registering periodic sync:', error);
          }
        }
      })()
    ])
  );
  
  // Notify all clients that the service worker has been updated
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_UPDATED',
        version: APP_VERSION
      });
    });
  });
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('/api/') && 
      !event.request.url.includes('corsproxy.io') && 
      !event.request.url.includes('weather.gc.ca')) {
    return;
  }
  
  // For API calls, go to network first, then cache
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('corsproxy.io') || 
      event.request.url.includes('weather.gc.ca')) {
    event.respondWith(
      fetch(event.request).then(response => {
        // Cache a copy of the response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request);
      })
    );
  } 
  // For HTML, JS, and CSS files, use stale-while-revalidate strategy
  else if (event.request.url.endsWith('.html') || 
           event.request.url.endsWith('.js') || 
           event.request.url.endsWith('.css') ||
           event.request.url.endsWith('/')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        // Create a promise that resolves with the cached response
        // or fetches from the network if not in cache
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Update the cache with the new response
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            // If fetch fails and we have a cached response, return it
            if (cachedResponse) {
              return cachedResponse;
            }
            // Otherwise, the error will be propagated
            throw error;
          });
        
        // Return the cached response immediately if available, 
        // otherwise wait for the network response
        return cachedResponse || fetchPromise;
      })
    );
  }
  // For other assets, use cache-first strategy
  else {
    event.respondWith(
      caches.match(event.request).then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          // Cache the fetched response
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        });
      })
    );
  }
});

// Background sync event
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background Sync event received', event.tag);
  if (event.tag === 'weather-alerts-sync' || event.tag === ALERTS_SYNC_KEY) {
    console.log('[Service Worker] Syncing weather alerts');
    event.waitUntil(syncWeatherAlerts().then(async (brandNewAlerts) => {
      if (brandNewAlerts && brandNewAlerts.length > 0) {
        console.log(`[Service Worker] Found ${brandNewAlerts.length} new alerts during background sync`);
        
        // Notify all clients about the new alerts
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_ALERTS',
            alerts: brandNewAlerts
          });
        });
        
        // Send push notification for each new alert
        for (const alert of brandNewAlerts) {
          try {
            await self.registration.showNotification('Weather Alert', {
              body: `${alert.title}\n${alert.summary ? alert.summary.substring(0, 100) : alert.description ? alert.description.substring(0, 100) : alert.title}...`,
              icon: '/android-chrome-192x192.png',
              badge: '/favicon-32x32.png',
              tag: `alert-${alert.id || Date.now()}`,
              vibrate: [200, 100, 200],
              renotify: true,
              requireInteraction: true,
              data: {
                url: alert.link || '/',
                alertId: alert.id,
                timestamp: Date.now()
              },
              actions: [
                {
                  action: 'view',
                  title: 'View Details'
                },
                {
                  action: 'close',
                  title: 'Dismiss'
                }
              ]
            });
          } catch (error) {
            console.error('[Service Worker] Error showing notification for alert', error);
          }
        }
      } else {
        console.log('[Service Worker] No new alerts found during background sync');
      }
    }));
  }
});

// Push event - handle incoming push notifications
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');
  
  let data = {};
  if (event.data) {
    try {
      // Try to parse the push message as JSON
      data = event.data.json();
    } catch (e) {
      console.log('[Service Worker] Failed to parse push message as JSON', e);
      try {
        // If JSON parse fails, try to get the text
        const text = event.data.text();
        data = {
          title: 'Weather Alert',
          body: text
        };
      } catch (e2) {
        console.log('[Service Worker] Failed to get push message content', e2);
        data = {
          title: 'Weather Alert',
          body: 'New weather information is available.'
        };
      }
    }
  }

  const title = data.title || 'Weather Alert';
  const options = {
    body: data.body || 'New weather alert in your area.',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'weather-alert-' + (data.id || Date.now()), // Unique tag to avoid duplicate notifications
    vibrate: [200, 100, 200, 100, 200],
    renotify: data.renotify || false, // Allow renotification if true
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
      alertId: data.id || `alert-${Date.now()}`,
      alertType: data.type || 'general'
    },
    actions: [
      {
        action: 'view',
        title: 'View Details'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    // Store the notification data in cache to avoid duplicates
    caches.open(ALERTS_CACHE_NAME)
      .then(cache => {
        return cache.match('last-notification')
          .then(response => {
            let lastNotification = null;
            if (response) {
              return response.json().then(data => {
                lastNotification = data;
                // If this is a duplicate notification within 30 minutes, don't show it
                if (lastNotification && 
                    lastNotification.body === options.body && 
                    (Date.now() - lastNotification.timestamp) < 30 * 60 * 1000) {
                  console.log('[Service Worker] Skipping duplicate notification');
                  return null;
                }
                return showNotificationAndCache(title, options, cache);
              });
            } else {
              return showNotificationAndCache(title, options, cache);
            }
          });
      })
  );
});

function showNotificationAndCache(title, options, cache) {
  // Cache the notification data
  return cache.put('last-notification', new Response(JSON.stringify({
    title: title,
    body: options.body,
    timestamp: Date.now()
  })))
  .then(() => {
    return self.registration.showNotification(title, options);
  });
}

// Notification click event
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click received.', event);
  
  event.notification.close();

  // Track which action was clicked
  const actionClicked = event.action;
  
  // Handle different actions
  if (actionClicked === 'close') {
    console.log('[Service Worker] User dismissed notification');
    return;
  }
  
  // For view action or default click (no action specified)
  if (actionClicked === 'view' || !actionClicked) {
    const urlToOpen = event.notification.data && event.notification.data.url ? 
      new URL(event.notification.data.url, self.location.origin).href : 
      self.location.origin;

    const alertId = event.notification.data && event.notification.data.alertId;
    
    // Construct URL with alert highlight parameter if we have an alert ID
    const targetUrl = alertId ? 
      `${urlToOpen}${urlToOpen.includes('?') ? '&' : '?'}highlight=${alertId}` : 
      urlToOpen;

    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(windowClients => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          // If we have an exact URL match
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
          
          // If we have a window open to the same origin
          if (new URL(client.url).origin === new URL(targetUrl).origin && 'focus' in client) {
            return client.focus().then(focusedClient => {
              // Navigate the focused client to the specific alert
              return focusedClient.navigate(targetUrl);
            });
          }
        }
        
        // If no matching window, open a new one
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
    );
  }
});

// Message event - handle messages from clients
self.addEventListener('message', event => {
  console.log('[Service Worker] Message received:', event.data);
  
  // Check for alerts message
  if (event.data && event.data.type === 'CHECK_ALERTS') {
    console.log('[Service Worker] Received CHECK_ALERTS message');
    event.waitUntil(syncWeatherAlerts().then(async (brandNewAlerts) => {
      if (brandNewAlerts && brandNewAlerts.length > 0) {
        console.log(`[Service Worker] Found ${brandNewAlerts.length} new alerts, notifying clients`);
        
        // Notify all clients about the new alerts
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_ALERTS',
            alerts: brandNewAlerts
          });
        });
        
        // Send push notification for each new alert
        for (const alert of brandNewAlerts) {
          try {
            await self.registration.showNotification('Weather Alert', {
              body: `${alert.title}\n${alert.summary ? alert.summary.substring(0, 100) : alert.description ? alert.description.substring(0, 100) : alert.title}...`,
              icon: '/android-chrome-192x192.png',
              badge: '/favicon-32x32.png',
              tag: `alert-${alert.id || Date.now()}`,
              vibrate: [200, 100, 200],
              renotify: true,
              requireInteraction: true,
              data: {
                url: alert.link || '/',
                alertId: alert.id,
                timestamp: Date.now()
              },
              actions: [
                {
                  action: 'view',
                  title: 'View Details'
                },
                {
                  action: 'close',
                  title: 'Dismiss'
                }
              ]
            });
          } catch (error) {
            console.error('[Service Worker] Error showing notification for alert', error);
          }
        }
      } else {
        console.log('[Service Worker] No new alerts found');
        
        // Notify all clients that no new alerts were found
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'NO_NEW_ALERTS',
            timestamp: Date.now()
          });
        });
      }
    }));
  }
  
  // Cache alerts message
  if (event.data && event.data.type === 'CACHE_ALERTS') {
    console.log('[Service Worker] Received CACHE_ALERTS message');
    if (event.data.alerts && Array.isArray(event.data.alerts)) {
      event.waitUntil(cacheAlerts(event.data.alerts, event.data.locationInfo).then(() => {
        console.log('[Service Worker] Alerts cached successfully');
      }).catch(error => {
        console.error('[Service Worker] Error caching alerts:', error);
      }));
    }
  }
});

// Utility function to log errors only when necessary
const logErrorConditionally = (message, error, isImportant = false) => {
  // Always log important errors
  if (isImportant) {
    console.error(message, error);
    return;
  }
  
  // For 404 errors, only log in debug mode
  if (error && error.message && error.message.includes('404')) {
    console.log(message); // Use log instead of error for 404s
    return;
  }
  
  // For other errors, log as errors
  console.error(message, error);
};

// Function to sync weather alerts in the background
async function syncWeatherAlerts() {
  console.log('[Service Worker] Starting weather alerts sync');
  
  try {
    // Get the cached alerts and location info
    const { alerts: cachedAlerts, locationInfo } = await getCachedAlertsAndLocation();
    
    // If we don't have location info, we can't fetch relevant alerts
    if (!locationInfo || !locationInfo.city) {
      console.log('[Service Worker] No location info available, skipping alerts sync');
      return [];
    }
    
    console.log(`[Service Worker] Syncing alerts for ${locationInfo.city}, ${locationInfo.region || 'Unknown Region'}`);
    
    // Determine which region codes to try based on the location
    const regionCodes = getRegionCodes(locationInfo.region);
    
    // Define CORS proxies to try
    const corsProxies = [
      '', // Try direct access first
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/'
    ];
    
    let newAlerts = [];
    let fetchSucceeded = false;
    
    // Try each region code with each proxy
    for (const regionCode of regionCodes) {
      if (fetchSucceeded) break;
      
      const alertsUrl = `https://weather.gc.ca/rss/warning/${regionCode}_e.xml`;
      console.log(`[Service Worker] Trying to fetch alerts from: ${alertsUrl}`);
      
      for (const proxy of corsProxies) {
        try {
          const proxyUrl = proxy ? `${proxy}${encodeURIComponent(alertsUrl)}` : alertsUrl;
          console.log(`[Service Worker] Trying proxy: ${proxy ? proxy : 'direct access'}`);
          
          const response = await fetch(proxyUrl, {
            cache: 'no-store', // Ensure we're getting fresh data
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            // Log 404s at a lower level
            if (response.status === 404) {
              console.log(`[Service Worker] No alerts found at ${proxy} with status: ${response.status}`);
            } else {
              console.log(`[Service Worker] Failed to fetch from ${proxy} with status: ${response.status}`);
            }
            continue;
          }
          
          const xmlText = await response.text();
          
          if (!xmlText || xmlText.trim() === '') {
            console.log(`[Service Worker] Empty response from ${proxy}`);
            continue;
          }
          
          // Parse the XML
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
          
          // Check if it's a valid XML document
          if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            console.log(`[Service Worker] XML parsing error from ${proxy}`);
            continue;
          }
          
          // Extract alerts from the XML
          const items = xmlDoc.getElementsByTagName('item');
          
          if (items.length === 0) {
            console.log(`[Service Worker] No alert items found in XML from ${proxy}`);
            continue;
          }
          
          console.log(`[Service Worker] Found ${items.length} alert items from ${proxy}`);
          
          // Process each alert item
          const alerts = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            const title = item.getElementsByTagName('title')[0]?.textContent || '';
            const description = item.getElementsByTagName('description')[0]?.textContent || '';
            const link = item.getElementsByTagName('link')[0]?.textContent || '';
            const pubDate = item.getElementsByTagName('pubDate')[0]?.textContent || '';
            const guid = item.getElementsByTagName('guid')[0]?.textContent || '';
            
            // Skip if no title or description
            if (!title || !description) {
              continue;
            }
            
            // Create an alert object
            const alert = {
              id: guid || `${regionCode}-${Date.now()}-${i}`,
              title,
              description,
              summary: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
              link,
              sent: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
              expires: null, // Not available in RSS
              severity: getSeverityFromTitle(title),
              urgency: getUrgencyFromTitle(title),
              certainty: 'Observed', // Default value
              sourceUrl: link
            };
            
            alerts.push(alert);
          }
          
          if (alerts.length > 0) {
            newAlerts = alerts;
            fetchSucceeded = true;
            console.log(`[Service Worker] Successfully fetched ${alerts.length} alerts from ${proxy}`);
            break;
          }
        } catch (error) {
          console.log(`[Service Worker] Error fetching from ${proxy}:`, error.message);
        }
      }
    }
    
    // If we couldn't fetch any alerts, try the Netlify function
    if (!fetchSucceeded) {
      try {
        console.log('[Service Worker] Trying Netlify function for alerts');
        
        const response = await fetch('/api/cap/battleboard/latest', {
          cache: 'no-store',
          headers: {
            'Accept': 'application/json, */*',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && Array.isArray(data.alerts) && data.alerts.length > 0) {
            newAlerts = data.alerts;
            fetchSucceeded = true;
            console.log(`[Service Worker] Successfully fetched ${newAlerts.length} alerts from Netlify function`);
          }
        }
      } catch (error) {
        console.log('[Service Worker] Error fetching from Netlify function:', error.message);
      }
    }
    
    // If we have new alerts, filter them by location and compare with cached alerts
    if (newAlerts.length > 0) {
      console.log(`[Service Worker] Processing ${newAlerts.length} new alerts`);
      
      // Filter alerts by location
      const relevantAlerts = filterAlertsByLocation(newAlerts, locationInfo);
      console.log(`[Service Worker] ${relevantAlerts.length} alerts are relevant to the user's location`);
      
      // Compare with cached alerts to find brand new ones
      const brandNewAlerts = findNewAlerts(relevantAlerts, cachedAlerts);
      console.log(`[Service Worker] Found ${brandNewAlerts.length} brand new alerts`);
      
      // Cache the new alerts
      await cacheAlerts(relevantAlerts);
      
      return brandNewAlerts;
    }
    
    console.log('[Service Worker] No new alerts found');
    return [];
  } catch (error) {
    console.error('[Service Worker] Error in syncWeatherAlerts:', error);
    return [];
  }
}

// Helper function to get severity from alert title
function getSeverityFromTitle(title) {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('warning')) {
    return 'Severe';
  } else if (lowerTitle.includes('watch')) {
    return 'Moderate';
  } else if (lowerTitle.includes('statement')) {
    return 'Minor';
  } else {
    return 'Unknown';
  }
}

// Helper function to get urgency from alert title
function getUrgencyFromTitle(title) {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('warning')) {
    return 'Immediate';
  } else if (lowerTitle.includes('watch')) {
    return 'Expected';
  } else {
    return 'Future';
  }
}

// Helper function to filter alerts by location
function filterAlertsByLocation(alerts, locationInfo) {
  if (!alerts || !locationInfo) {
    return [];
  }
  
  // For now, just return all alerts since we don't have precise location filtering in the service worker
  // In a real implementation, you would use geospatial calculations to filter alerts
  return alerts;
}

// Helper function to find new alerts that aren't in the cached alerts
function findNewAlerts(newAlerts, cachedAlerts) {
  if (!cachedAlerts || cachedAlerts.length === 0) {
    return newAlerts;
  }
  
  const cachedAlertIds = new Set(cachedAlerts.map(alert => alert.id));
  
  return newAlerts.filter(alert => !cachedAlertIds.has(alert.id));
}

// Function to cache alerts and location info
async function cacheAlerts(alerts, locationInfo) {
  try {
    const cache = await caches.open(ALERTS_CACHE_NAME);
    await cache.put('alerts-data', new Response(JSON.stringify(alerts)));
    await cache.put('location-info', new Response(JSON.stringify(locationInfo)));
    console.log('Cached alerts and location info');
  } catch (error) {
    console.error('Error caching alerts:', error);
  }
}

// Helper function to get region codes for a province
function getRegionCodes(province) {
  if (!province) return ['ca'];
  
  // Normalize the province name by removing case sensitivity and extra spaces
  const normalizedProvince = province.trim().toLowerCase();
  
  // Map of Canadian province names to Environment Canada region codes
  const PROVINCE_TO_REGION_CODE = {
    'alberta': 'ab',
    'british columbia': 'bc',
    'manitoba': 'mb',
    'new brunswick': 'nb',
    'newfoundland and labrador': 'nl',
    'northwest territories': 'nt',
    'nova scotia': 'ns',
    'nunavut': 'nu',
    'ontario': 'on',
    'prince edward island': 'pe',
    'quebec': 'qc',
    'saskatchewan': 'sk',
    'yukon': 'yt'
  };
  
  // Check for exact matches
  for (const [key, value] of Object.entries(PROVINCE_TO_REGION_CODE)) {
    if (key === normalizedProvince) {
      return [value, 'ca']; // Return the province code and 'ca' as fallback
    }
  }
  
  // Check for partial matches
  for (const [key, value] of Object.entries(PROVINCE_TO_REGION_CODE)) {
    if (normalizedProvince.includes(key) || key.includes(normalizedProvince)) {
      return [value, 'ca']; // Return the province code and 'ca' as fallback
    }
  }
  
  // Check for abbreviations
  const abbr = normalizedProvince.substring(0, 2);
  if (Object.values(PROVINCE_TO_REGION_CODE).includes(abbr)) {
    return [abbr, 'ca']; // Return the province code and 'ca' as fallback
  }
  
  return ['on', 'ca']; // Default to Ontario if no match found, with 'ca' as fallback
}

// Helper function to get cached alerts and location info
async function getCachedAlertsAndLocation() {
  try {
    const cache = await caches.open(ALERTS_CACHE_NAME);
    
    // Get cached alerts
    const alertsResponse = await cache.match('alerts-data');
    const alerts = alertsResponse ? await alertsResponse.json() : [];
    
    // Get cached location info
    const locationResponse = await cache.match('location-info');
    const locationInfo = locationResponse ? await locationResponse.json() : null;
    
    return { alerts, locationInfo };
  } catch (error) {
    console.error('[Service Worker] Error getting cached alerts:', error);
    return { alerts: [], locationInfo: null };
  }
}

// Add an event listener for the 'periodicsync' event
self.addEventListener('periodicsync', event => {
  if (event.tag === ALERTS_SYNC_KEY) {
    console.log('[Service Worker] Periodic sync for weather alerts triggered');
    event.waitUntil(syncWeatherAlerts().then(async (brandNewAlerts) => {
      if (brandNewAlerts && brandNewAlerts.length > 0) {
        console.log(`[Service Worker] Found ${brandNewAlerts.length} new alerts during periodic sync`);
        
        // Notify all clients about the new alerts
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_ALERTS',
            alerts: brandNewAlerts
          });
        });
        
        // Send push notification for each new alert
        for (const alert of brandNewAlerts) {
          try {
            await self.registration.showNotification('Weather Alert', {
              body: `${alert.title}\n${alert.summary ? alert.summary.substring(0, 100) : alert.description ? alert.description.substring(0, 100) : alert.title}...`,
              icon: '/android-chrome-192x192.png',
              badge: '/favicon-32x32.png',
              tag: `alert-${alert.id || Date.now()}`,
              vibrate: [200, 100, 200],
              renotify: true,
              requireInteraction: true,
              data: {
                url: alert.link || '/',
                alertId: alert.id,
                timestamp: Date.now()
              },
              actions: [
                {
                  action: 'view',
                  title: 'View Details'
                },
                {
                  action: 'close',
                  title: 'Dismiss'
                }
              ]
            });
          } catch (error) {
            console.error('[Service Worker] Error showing notification for alert', error);
          }
        }
      } else {
        console.log('[Service Worker] No new alerts found during periodic sync');
      }
    }));
  }
});