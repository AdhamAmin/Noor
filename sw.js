const CACHE_NAME = 'noor-cache-v2';
const urlsToCache = [
    './',
    './index.html',
    './css/styles.css',
    './js/engine.js',
    './js/api.js',
    './js/particles.js',
    './js/settings.js',
    './js/main.js',
    './assets/icon.png',
    './assets/icon.svg',
    './manifest.json',
    'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700&family=Outfit:wght@300;400;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache).catch(err => console.log('Cache addAll failed', err));
            })
    );
});

self.addEventListener('fetch', event => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // If we get a valid response, clone it and put it in the cache
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic' || networkResponse.type === 'cors') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (Offline), try to serve from cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If we don't have it in cache, we can't do much (could return an offline page here if we had one)
                    console.warn('Offline and resource not in cache:', event.request.url);
                });
            })
    );
});
