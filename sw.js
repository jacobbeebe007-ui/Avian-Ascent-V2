/* Avian Ascent — offline shell. Bump CACHE_VERSION when shipped assets change.
 * Precaches the prebuilt classic bundle at ./js/avian-game.bundle.js
 * (regenerate with `node scripts/build-bundle.js` or `npm run dev` / `npm run build`). */
const CACHE_VERSION = 'avian-ascent-4ba4753a98f2';
const PRECACHE = [
  './',
  './index.html',
  './css/main.css',
  './css/sprites.css',
  './css/shop.css',
  './css/ui.css',
  './js/avian-game.bundle.js',
  './site.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
