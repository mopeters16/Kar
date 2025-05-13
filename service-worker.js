const CACHE_NAME = 'kar-rideshare-v1.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './_styles.css',
  './app.js',
  './manifest.json',
  
  // Core assets
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css',
  'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

  // App assets
  '/assets/icons/icon-72.png',
  '/assets/icons/icon-96.png',
  '/assets/icons/icon-144.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/illustrations/ride-sharing.svg',
  '/assets/screenshots/screenshot1.png',
  '/assets/screenshots/screenshot2.png'
];

const CACHEABLE_RESPONSE_TYPES = [
  'basic',
  'cors',
  'default',
  'error',
  'opaque',
  'opaqueredirect'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean old caches
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Handle API requests differently
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful API responses
          if (response && CACHEABLE_RESPONSE_TYPES.includes(response.type)) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  } else {
    // For non-API requests: cache first with network fallback
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          return cachedResponse || fetch(event.request)
            .then((response) => {
              // Cache the response if it's valid
              if (response && CACHEABLE_RESPONSE_TYPES.includes(response.type)) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, responseToCache));
              }
              return response;
            });
        })
    );
  }
});

// Background sync (for failed requests when offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'syncRideRequests') {
    console.log('[ServiceWorker] Background sync for ride requests');
    // Implement your background sync logic here
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'Kar RideShare';
  
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'You have a new notification',
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-72.png',
      data: payload.url || '/',
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data);
        }
      })
  );
});