const CACHE_NAME = 'attendance-v25';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr'
];

// Install Event - Pre-cache App Shell & Critical Static Assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Gracefully handle caching so one failed network request doesn't ruin SW installation
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url))
      );
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Intercept Requests
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Skip non-GET requests, Google Apps Script API calls, and Time API checks
  if (
    event.request.method !== 'GET' || 
    requestUrl.hostname.includes('script.google.com') ||
    requestUrl.hostname.includes('worldtimeapi.org') ||
    requestUrl.hostname.includes('tile.openstreetmap.org') // OpenStreetMap tiles are optional to cache dynamically
  ) {
    return;
  }

  // 2. Cache-First Strategy with Network Fallback & Auto-Cache Update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache freshness if online
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network errors while offline */});

        return cachedResponse;
      }

      // If not cached, fetch from network and add to cache
      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse || 
          (networkResponse.status !== 200 && networkResponse.type !== 'opaque')
        ) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
