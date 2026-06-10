const CACHE_NAME = 'news-reader-v2';
const API_CACHE = 'api-cache-v1';

// Install event: Pre-cache static assets if needed, though Next.js handles this mostly
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API Requests: Stale-While-Revalidate
    if (url.pathname.startsWith('/api/feeds')) {
        event.respondWith(
            caches.open(API_CACHE).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        })
                        .catch(() => cachedResponse); // Fallback to cache if network fails

                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }
});
