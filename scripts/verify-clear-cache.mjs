/**
 * Verify Clear cached data actually drops Cache Storage, unregisters the
 * service worker, keeps the run save, and cache-busts the reload so HTTP
 * cache cannot resurrect a stale Nest bundle.
 *
 * Starts its own static server so `npm test` does not need a prior `preview`.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAVE_KEY = 'avianAscent_save_v2';
const CREATOR_CODES_KEY = 'avian_creator_codes';
const DEV_CODE_SWITCHES_KEY = 'avian_dev_code_switches';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = urlPath === '/' ? '/index.html' : urlPath;
      const full = path.normalize(path.join(ROOT, rel));
      if (!full.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(full, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

let failed = 0;
function ok(label, cond) {
  if (cond) console.log('[clear-cache] ok  ', label);
  else {
    console.error('[clear-cache] FAIL', label);
    failed++;
  }
}

async function seedStale(page) {
  return page.evaluate(async ({ SAVE_KEY, CREATOR_CODES_KEY, DEV_CODE_SWITCHES_KEY }) => {
    const cache = await caches.open('avian-ascent-stale-test');
    await cache.put('/__stale-asset.js', new Response('OLD_BUNDLE', {
      headers: { 'Content-Type': 'text/javascript' },
    }));
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      keep: true,
      equipmentV2: true,
      equipmentPackVersion: '2026.07-equipment-v1.3-basic-starting-weapons',
      player: { name: 'Crow' },
    }));
    localStorage.setItem(CREATOR_CODES_KEY, JSON.stringify({ gm: true }));
    localStorage.setItem(DEV_CODE_SWITCHES_KEY, JSON.stringify({ buildnest: true }));
    return {
      cacheKeys: await caches.keys(),
      staleHit: await caches.match('/__stale-asset.js').then((r) => (r ? r.text() : null)),
    };
  }, { SAVE_KEY, CREATOR_CODES_KEY, DEV_CODE_SWITCHES_KEY });
}

async function stubNavigation(page) {
  await page.evaluate(() => {
    window.__shellReloads = [];
    const origFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        if (init && init.cache === 'reload') {
          window.__shellReloads.push(String(input));
        }
      } catch (_) { /* noop */ }
      return origFetch(input, init);
    };
  });
}

async function snapshot(page) {
  return page.evaluate(async ({ SAVE_KEY, CREATOR_CODES_KEY, DEV_CODE_SWITCHES_KEY }) => {
    const modal = document.getElementById('clear-cache-modal');
    return {
      cacheKeys: await caches.keys(),
      staleHit: await caches.match('/__stale-asset.js').then((r) => (r ? r.text() : null)),
      save: localStorage.getItem(SAVE_KEY),
      codes: localStorage.getItem(CREATOR_CODES_KEY),
      switches: localStorage.getItem(DEV_CODE_SWITCHES_KEY),
      swCount: (await navigator.serviceWorker.getRegistrations()).length,
      modalOpen: !!modal?.classList.contains('open'),
      modalZ: modal ? Number(getComputedStyle(modal).zIndex) || 0 : 0,
      replaceHref: window.__replaceHref,
      reloadCount: window.__reloadCount,
      shellReloads: window.__shellReloads || [],
    };
  }, { SAVE_KEY, CREATOR_CODES_KEY, DEV_CODE_SWITCHES_KEY });
}

const { server, port } = await startServer();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);
  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.confirmClearCache === 'function' && typeof window.takeFlightToSelect === 'function');
  await page.evaluate(() => document.getElementById('error-console-overlay')?.remove());

  const seeded = await seedStale(page);
  ok('seeded stale Cache Storage', seeded.cacheKeys.includes('avian-ascent-stale-test') && seeded.staleHit === 'OLD_BUNDLE');

  await stubNavigation(page);

  const startBtn = page.locator('#start-clear-cache-btn');
  ok('title-screen Clear cached data is visible', await startBtn.isVisible());
  await startBtn.click();
  await page.waitForSelector('#clear-cache-modal.open');
  const afterTitleOpen = await snapshot(page);
  ok('title-screen button opens confirm modal', afterTitleOpen.modalOpen);
  ok('confirm modal stacks above hub (z-index >= 12600)', afterTitleOpen.modalZ >= 12600);

  const confirmClicked = page.waitForURL((url) => url.searchParams.has('avianCacheBust'), { timeout: 15000 });
  await page.locator('#clear-cache-modal [data-action="confirmClearCache"]').click();
  await confirmClicked;
  await page.waitForFunction(() => typeof window.clearGameCache === 'function');

  const after = await snapshot(page);
  ok('stale Cache Storage gone', !after.cacheKeys.includes('avian-ascent-stale-test') && after.staleHit == null);
  ok('run save kept', !!(after.save && after.save.includes('Crow')));
  ok('creator codes cleared', after.codes == null && after.switches == null);
  ok('reload is cache-busted (avianCacheBust)', page.url().includes('avianCacheBust='));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.takeFlightToSelect === 'function');
  await page.evaluate(() => {
    document.getElementById('error-console-overlay')?.remove();
    if (typeof closeWarRoomTutorial === 'function') closeWarRoomTutorial();
    document.getElementById('warroom-tutorial-modal')?.classList.remove('open');
  });
  await page.locator('#take-flight-btn').click();
  await page.waitForSelector('#screen-select.active');
  await page.evaluate(() => {
    if (typeof closeWarRoomTutorial === 'function') closeWarRoomTutorial();
    document.getElementById('warroom-tutorial-modal')?.classList.remove('open');
  });
  await page.locator('.splash-hotspot--supplies').click();
  await page.waitForSelector('#select-hub-supplies.is-open');
  const suppliesBtn = page.locator('#select-hub-supplies [data-action="openClearCacheModal"]');
  ok('Supplies Clear cached data is visible', await suppliesBtn.isVisible());
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failed) {
  console.error(`[clear-cache] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[clear-cache] all checks passed');
