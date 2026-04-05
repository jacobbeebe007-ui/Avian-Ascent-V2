/* Avian Ascent — offline shell. Bump CACHE_VERSION when shipped assets change. */
const CACHE_VERSION = 'avian-ascent-v5';
const PRECACHE = [
  './',
  './index.html',
  './css/main.css',
  './css/sprites.css',
  './css/shop.css',
  './css/ui.css',
  './js/data/skill_passive_upgrade_pack.js',
  './js/data/story_enemy_registry.js',
  './js/data/skills.js',
  './js/data/biomes.js',
  './js/data/birds.js',
  './js/data/enemies.js',
  './js/data/skill-families.js',
  './js/data/rewards-upgrades.js',
  './js/combat/damage-math.js',
  './js/core/game.js',
  './js/combat/enemy-damage.js',
  './js/combat/status.js',
  './js/combat/turn-loop.js',
  './js/combat/ai-enemy.js',
  './js/data/content.js',
  './js/systems/systems.js',
  './js/systems/shop.js',
  './js/systems/fixes.js',
  './js/ui/ui.js',
  './js/ui/sprites.js',
  './site.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
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
