// Service Worker for Weather App with Alerts Notification Support
const CACHE_NAME = 'weather-app-cache-v1';
const ALERTS_CACHE_NAME = 'weather-alerts-cache-v1';
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
  self.skipWaiting();
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
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME && cacheName !== ALERTS_CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
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
  } else {
    // For non-API requests, try cache first, then network
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
  if (event.tag === ALERTS_SYNC_KEY) {
    console.log('[Service Worker] Syncing weather alerts');
    event.waitUntil(syncWeatherAlerts());
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

// Function to sync weather alerts in the background
async function syncWeatherAlerts() {
  console.log('[Service Worker] Starting weather alerts sync');
  try {
    // Get cached location info
    const locationInfoCache = await caches.open(ALERTS_CACHE_NAME);
    const locationResponse = await locationInfoCache.match('location-info');
    
    if (!locationResponse) {
      console.log('[Service Worker] No cached location info available for alert sync');
      return;
    }
    
    const locationInfo = await locationResponse.json();
    
    if (!locationInfo || !locationInfo.city || !locationInfo.region) {
      console.log('[Service Worker] Invalid location info for alert sync');
      return;
    }
    
    console.log(`[Service Worker] Syncing alerts for ${locationInfo.city}, ${locationInfo.region}`);
    
    // Get cached alerts to compare later
    const alertsResponse = await locationInfoCache.match('alerts-data');
    let cachedAlerts = [];
    if (alertsResponse) {
      try {
        cachedAlerts = await alertsResponse.json();
        console.log(`[Service Worker] Found ${cachedAlerts.length} cached alerts`);
      } catch (e) {
        console.error('[Service Worker] Error parsing cached alerts', e);
        cachedAlerts = [];
      }
    }
    
    // Try multiple CORS proxies
    const corsProxies = [
      'https://corsproxy.io/?',
      'https://cors-anywhere.herokuapp.com/',
      'https://api.allorigins.win/raw?url='
    ];
    
    // Try to determine region code
    const regionCodes = getRegionCodesForProvince(locationInfo.region);
    
    let newAlerts = [];
    let fetchSucceeded = false;
    
    // Add timestamp to track when alerts were last checked
    const lastChecked = Date.now();
    await locationInfoCache.put('alerts-last-checked', new Response(JSON.stringify({ timestamp: lastChecked })));
    
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
            console.log(`[Service Worker] Failed to fetch from ${proxy} with status: ${response.status}`);
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
          console.error(`[Service Worker] Error fetching alerts with proxy ${proxy}:`, error);
        }
      }
    }
    
    // If all fetch attempts failed
    if (!fetchSucceeded) {
      console.log('[Service Worker] All fetch attempts failed, setting retry timer');
      // Schedule a retry in 15 minutes
      setTimeout(() => {
        syncWeatherAlerts();
      }, 15 * 60 * 1000);
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
    return ['onrm96', 'onrm97', 'on31', 'on33', 'on39', 'on48'];
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

// Register for periodic background sync if supported
if ('periodicSync' in self.registration) {
  // Try to register for periodic sync
  const tryRegisterPeriodicSync = async () => {
    try {
      await self.registration.periodicSync.register(ALERTS_SYNC_KEY, {
        minInterval: 60 * 60 * 1000 // Once per hour
      });
      console.log('Registered periodic sync for weather alerts');
    } catch (error) {
      console.error('Error registering periodic sync:', error);
    }
  };
  
  tryRegisterPeriodicSync();
} 