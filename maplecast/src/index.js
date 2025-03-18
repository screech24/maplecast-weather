import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'leaflet/dist/leaflet.css';

// Function to show update notification
const showUpdateNotification = () => {
  // Check if we already have a notification showing
  if (document.querySelector('.update-notification')) {
    return;
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-notification-content">
      <p>A new version of the app is available!</p>
      <button id="update-refresh-button">Refresh to update</button>
      <button id="update-dismiss-button">Dismiss</button>
    </div>
  `;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Add event listeners
  document.getElementById('update-refresh-button').addEventListener('click', () => {
    window.location.reload();
  });
  
  document.getElementById('update-dismiss-button').addEventListener('click', () => {
    notification.remove();
  });
};

// Register service worker for PWA functionality
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    // Only register service worker in production environment
    // This prevents the MIME type error in development
    if (process.env.NODE_ENV === 'production') {
      try {
        // Use the PUBLIC_URL environment variable to get the correct base path
        const publicUrl = process.env.PUBLIC_URL || '';
        const swUrl = `${publicUrl}/service-worker.js`;
        
        console.log('Registering service worker from:', swUrl);
        const registration = await navigator.serviceWorker.register(swUrl);
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Check for updates to the Service Worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Service Worker update found!');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New Service Worker installed, ready to take over');
              // Notify the user about the update
              showUpdateNotification();
            }
          });
        });
        
        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Received message from service worker:', event.data);
          
          if (event.data && event.data.type === 'SW_UPDATED') {
            console.log(`Service worker updated to version ${event.data.version}`);
            showUpdateNotification();
          }
        });
        
        // Handle controller change (when a new service worker takes over)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service Worker controller changed');
          // We don't reload here to avoid disrupting the user experience
          // Instead, we show a notification that allows the user to refresh
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    } else {
      console.log('Service Worker not registered in development mode to prevent MIME type errors');
    }
  }
};

// Register the service worker
registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
