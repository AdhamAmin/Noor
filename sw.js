const CACHE_NAME = 'noor-cache-v4';
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

// Hosts whose responses should be served cache-first (fast, semi-static data)
const CACHE_FIRST_HOSTS = [
    'api.alquran.cloud',
    'raw.githubusercontent.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

// Hosts that should always be network-first (live data like prayer times)
const NETWORK_FIRST_HOSTS = [
    'api.aladhan.com',
    'api.bigdatacloud.net'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache).catch(err => console.log('Cache addAll failed', err)))
    );
});

self.addEventListener('activate', event => {
    // Delete old cache versions
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Cache-first strategy for Quran text, Azkar, fonts
    if (CACHE_FIRST_HOSTS.includes(url.hostname)) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // Network-first strategy for prayer times (live data)
    if (NETWORK_FIRST_HOSTS.includes(url.hostname)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Default: network-first, fallback to cache for app shell files
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200 &&
                    (response.type === 'basic' || response.type === 'cors')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
