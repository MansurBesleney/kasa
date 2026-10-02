// Bump VERSION on every deploy, otherwise installed phones keep the old files.
const VERSION = 'kasa-v1';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'logic.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'vendor/pdfmake.min.js', 'vendor/vfs_fonts.js'];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's HTTP cache, so a fresh deploy is never cached stale
  event.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request, { ignoreSearch: true })
    .then(hit => hit || fetch(event.request)));
});
