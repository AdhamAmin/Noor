const CACHE_NAME = 'noor-cache-v1';
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
    // Try network first, then cache (good for APIs that might change, but standard offline support)
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
