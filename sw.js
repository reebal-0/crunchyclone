// Service Worker for Crunchyroll Clone PWA
const CACHE_NAME = 'crunchyclone-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through network requests with offline fallback
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

