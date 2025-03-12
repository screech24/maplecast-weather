// Service Worker for Weather App with Alerts Notification Support
const APP_VERSION = '1.6.0'; // Match this with package.json version
const CACHE_NAME = `weather-app-cache-v${APP_VERSION}`;
const ALERTS_CACHE_NAME = `weather-alerts-cache-v${APP_VERSION}`;
const ALERTS_SYNC_KEY = 'weather-alerts-sync';

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
    if (!locationInfo || !locationInfo.region) {
      console.log('[Service Worker] No location info available, skipping alerts sync');
      return false;
    }
    
    console.log(`[Service Worker] Syncing alerts for ${locationInfo.city}, ${locationInfo.region}`);
    
    // Determine which region codes to try based on the location
    const regionCodes = getRegionCodes(locationInfo.region);
    
    // Define CORS proxies to try
    const corsProxies = [
      'https://corsproxy.io/?',
      'https://api.allorigins.win/raw?url=',
      'https://cors-anywhere.herokuapp.com/'
    ];
    
    let newAlerts = [];
    let fetchSucceeded = false;
    
    // Try each region code with each proxy
    for (const regionCode of regionCodes) {
      if (fetchSucceeded) break;
      
      const alertsUrl = `https://weather.gc.ca/rss/battleboard/${regionCode}_e.xml`;
      console.log(`[Service Worker] Trying to fetch alerts from: ${alertsUrl}`);
      
      for (const proxy of corsProxies) {
        try {
          const response = await fetch(`${proxy}${encodeURIComponent(alertsUrl)}`, {
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
          
          const text = await response.text();
          if (!text) {
            console.log(`[Service Worker] Empty response from ${proxy}`);
            continue;
          }
          
          // Parse XML
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          
          // Check for parser errors
          if (xmlDoc.querySelector('parsererror')) continue;
          
          // Extract entries
          const entries = xmlDoc.querySelectorAll('entry');
          if (!entries || entries.length === 0) continue;
          
          // Process entries to get alerts
          newAlerts = Array.from(entries)
            .filter(entry => {
              const categoryElement = entry.querySelector('category');
              const category = categoryElement ? categoryElement.getAttribute('term') : '';
              
              const titleElement = entry.querySelector('title');
              const title = titleElement ? titleElement.textContent : '';
              
              return (
                category && category.toLowerCase().includes('warnings and watches') &&
                !(title && title.toLowerCase().includes('no watches or warnings in effect'))
              );
            })
            .map(entry => {
              const id = entry.querySelector('id')?.textContent || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const title = entry.querySelector('title')?.textContent || 'Weather Alert';
              const summary = entry.querySelector('summary')?.textContent || 'No details available';
              
              const linkElement = entry.querySelector('link');
              const link = linkElement ? linkElement.getAttribute('href') : 'https://weather.gc.ca/warnings/index_e.html';
              
              const published = entry.querySelector('published')?.textContent || new Date().toISOString();
              const updated = entry.querySelector('updated')?.textContent || new Date().toISOString();
              
              return {
                id,
                title,
                summary,
                published,
                link,
                updated
              };
            });
          
          fetchSucceeded = true;
          break;
        } catch (error) {
          // Use conditional logging for errors
          logErrorConditionally(`[Service Worker] Error fetching alerts with proxy ${proxy}:`, error);
        }
      }
    }
    
    // If all region codes fail, try the national alerts feed as a last resort
    if (!fetchSucceeded) {
      console.log('[Service Worker] All region codes failed, trying national alerts feed');
      const nationalAlertsUrl = 'https://weather.gc.ca/rss/warning/canada_e.xml';
      
      for (const proxy of corsProxies) {
        try {
          console.log(`[Service Worker] Trying national alerts feed with proxy: ${proxy}`);
          const response = await fetch(`${proxy}${encodeURIComponent(nationalAlertsUrl)}`, {
            cache: 'no-store',
            headers: {
              'Accept': 'application/xml, text/xml, */*',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (!response.ok) {
            // Log 404s at a lower level
            if (response.status === 404) {
              console.log(`[Service Worker] No national alerts found with status: ${response.status}`);
            } else {
              console.log(`[Service Worker] Failed to fetch national feed with status: ${response.status}`);
            }
            continue;
          }
          
          const text = await response.text();
          if (!text) {
            console.log(`[Service Worker] Empty response from national feed`);
            continue;
          }
          
          // Parse XML
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          
          // Check for parser errors
          if (xmlDoc.querySelector('parsererror')) {
            console.log('[Service Worker] XML parsing error for national feed');
            continue;
          }
          
          // Extract entries - check both ATOM and RSS formats
          let entries = xmlDoc.querySelectorAll('entry');
          if (!entries || entries.length === 0) {
            // Try RSS format (item elements)
            entries = xmlDoc.querySelectorAll('item');
          }
          
          if (!entries || entries.length === 0) {
            console.log('[Service Worker] No alerts found in national feed');
            continue;
          }
          
          // Process entries to get alerts (similar to above)
          newAlerts = Array.from(entries)
            .filter(entry => {
              // For RSS format
              if (entry.tagName === 'item') {
                const category = entry.querySelector('category')?.textContent || '';
                const title = entry.querySelector('title')?.textContent || '';
                
                return (
                  category.toLowerCase().includes('warning') &&
                  !(title.toLowerCase().includes('no watches or warnings in effect'))
                );
              }
              
              // For ATOM format
              const categoryElement = entry.querySelector('category');
              const category = categoryElement ? categoryElement.getAttribute('term') : '';
              
              const titleElement = entry.querySelector('title');
              const title = titleElement ? titleElement.textContent : '';
              
              return (
                category && category.toLowerCase().includes('warnings and watches') &&
                !(title && title.toLowerCase().includes('no watches or warnings in effect'))
              );
            })
            .map(entry => {
              // For RSS format
              if (entry.tagName === 'item') {
                const id = entry.querySelector('guid')?.textContent || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const title = entry.querySelector('title')?.textContent || 'Weather Alert';
                const summary = entry.querySelector('description')?.textContent || 'No details available';
                const link = entry.querySelector('link')?.textContent || 'https://weather.gc.ca/warnings/index_e.html';
                const pubDate = entry.querySelector('pubDate')?.textContent || new Date().toISOString();
                
                return {
                  id,
                  title,
                  summary,
                  published: pubDate,
                  link,
                  updated: pubDate
                };
              }
              
              // For ATOM format
              const id = entry.querySelector('id')?.textContent || `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const title = entry.querySelector('title')?.textContent || 'Weather Alert';
              const summary = entry.querySelector('summary')?.textContent || 'No details available';
              
              const linkElement = entry.querySelector('link');
              const link = linkElement ? linkElement.getAttribute('href') : 'https://weather.gc.ca/warnings/index_e.html';
              
              const published = entry.querySelector('published')?.textContent || new Date().toISOString();
              const updated = entry.querySelector('updated')?.textContent || new Date().toISOString();
              
              return {
                id,
                title,
                summary,
                published,
                link,
                updated
              };
            });
          
          fetchSucceeded = true;
          break;
        } catch (error) {
          // Use conditional logging for errors
          logErrorConditionally(`[Service Worker] Error fetching national alerts with proxy ${proxy}:`, error);
        }
      }
    }
    
    // Update the cache with new alerts
    await cacheAlerts(newAlerts, locationInfo);
    
    // Check for new alerts that weren't in the cached alerts
    const newAlertIds = new Set(newAlerts.map(alert => alert.id));
    const cachedAlertIds = new Set(cachedAlerts.map(alert => alert.id));
    
    const brandNewAlerts = newAlerts.filter(alert => !cachedAlertIds.has(alert.id));
    
    return brandNewAlerts;
  } catch (error) {
    console.error('[Service Worker] Error in syncWeatherAlerts:', error);
    return false;
  }
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
function getRegionCodesForProvince(province) {
  if (!province) return ['onrm96', 'bcrm30', 'abrm32', 'qcrm1', 'mbrm9'];
  
  const provinceUpper = province.toUpperCase();
  
  if (provinceUpper === 'ON' || provinceUpper === 'ONTARIO') {
    return ['onrm119', 'onrm96', 'onrm97', 'on31', 'on33', 'on39', 'on48'];
  } else if (provinceUpper === 'BC' || provinceUpper === 'BRITISH COLUMBIA') {
    return ['bcrm30', 'bcrm31', 'bcrm3', 'bcrm4'];
  } else if (provinceUpper === 'AB' || provinceUpper === 'ALBERTA') {
    return ['abrm32', 'abrm1', 'abrm2'];
  } else if (provinceUpper === 'QC' || provinceUpper === 'QUEBEC') {
    return ['qcrm1', 'qc1', 'qc10', 'qc19'];
  } else {
    return ['mbrm9', 'skrm2', 'ns1', 'nb2', 'nl3', 'pei2', 'yt10', 'nt1', 'nu1'];
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