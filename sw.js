const CACHE_NAME = 'messmate-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './platform.html',
  './member_dashboard.html',
  './owner_dashboard.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => console.log('Caching skipped for some files.', err));
      })
  );
  self.skipWaiting(); // Force new service worker to activate
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  event.waitUntil(self.clients.claim()); // Take control immediately
});

self.addEventListener('fetch', event => {
  // Network-First Strategy
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network successful: clone the response and cache it for future offline use
        if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
            });
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline): try serving from cache
        return caches.match(event.request);
      })
  );
});
