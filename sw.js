/* Avian Ascent - offline shell. Bump CACHE_VERSION when shipped assets change.
 * Precaches the prebuilt classic bundle at ./js/avian-game.bundle.js
 * (regenerate with `node scripts/build-bundle.js` or `npm run dev` / `npm run build`). */
const CACHE_VERSION = 'avian-ascent-2ace3755093e';
const PRECACHE = [
  './',
  './index.html',
  './css/main.css',
  './css/sprites.css',
  './css/shop.css',
  './css/ui.css',
  './js/ui/error-hud.js',
  './js/audio/bgm-shared.js',
  './js/avian-game.bundle.js',

  './assets/audio/Blakiston_Theme.mp3',
  './assets/audio/Duke_Blakiston_Battle.mp3',
  './assets/audio/Sharp_Beak_Quick_Wing.mp3',
  './assets/audio/The_Brittle_Waltz.mp3',
  './assets/audio/The_Pigeon_s_Desperate_Jig.mp3',
  './assets/audio/The_Last_Thermal-Overworld.mp3',
  './assets/arenas/arena-finch-burrow-mobile.png',
  './assets/arenas/arena-finch-burrow-desktop.png',
  './site.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* Reject responses whose Content-Type doesn't match the resource kind
 * (e.g. Vite dev serving CSS as a JS module) so they never enter the cache. */
function isCacheableResponse(pathname, res) {
  if (!res || !res.ok || (res.type !== 'basic' && res.type !== 'default')) return false;
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!ct) return true; // some static servers omit it; trust same-origin
  const p = pathname.split('?')[0];
  if (p.endsWith('.css')) return ct.includes('text/css');
  if (p.endsWith('.html') || p.endsWith('/')) return ct.includes('text/html');
  if (p.endsWith('.js') || p.endsWith('.mjs')) return ct.includes('javascript');
  return true;
}

/* Ask for the raw file (Accept header) and bypass the HTTP cache so the
 * precache always holds the freshly deployed copy. */
function precacheRequest(url) {
  let accept = '*/*';
  if (url.endsWith('.css')) accept = 'text/css,*/*;q=0.1';
  else if (url.endsWith('.html') || url.endsWith('/')) accept = 'text/html,*/*;q=0.1';
  return new Request(url, { headers: { Accept: accept }, cache: 'reload' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        // Tolerant precache: a single failed asset (flaky mobile network)
        // shouldn't abort the whole install — runtime fetches cover the gaps.
        Promise.all(
          PRECACHE.map(async (url) => {
            try {
              const res = await fetch(precacheRequest(url));
              if (isCacheableResponse(url, res)) await cache.put(url, res);
            } catch (_) {
              /* skip — served from network at runtime */
            }
          })
        )
      )
      .then(() => self.skipWaiting())
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

function cachePut(req, res) {
  const copy = res.clone();
  caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isShell =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    req.destination === 'style' ||
    req.destination === 'script';

  if (isShell) {
    // Network-first: always render the latest deployed HTML/CSS/JS when
    // online; fall back to the cached shell offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isCacheableResponse(url.pathname, res)) cachePut(req, res);
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return Response.error();
          })
        )
    );
    return;
  }

  // Media & other static assets: cache-first for speed and offline play.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (isCacheableResponse(url.pathname, res)) cachePut(req, res);
        return res;
      });
    })
  );
});
