/**
 * Verify Erase saved progress actually drops the run save, unlocks, highscores,
 * and fortune meta, keeps accessibility/music settings, and does not throw
 * (HIGHSCORE_KEY / TELEMETRY_KEY used to be out of scope).
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
const UNLOCK_KEY = 'avianAscent_unlocks_v1';
const HIGHSCORE_KEY = 'avian_highscores_v1';
const TELEMETRY_KEY = 'avianAscent_telemetry_v1';
const ACCESS_KEY = 'avian_accessibility_v1';
const MUSIC_KEY = 'avian_music_v1';
const META_KEY = 'avianAscent_meta_v1';

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
  if (cond) console.log('[erase-progress] ok  ', label);
  else {
    console.error('[erase-progress] FAIL', label);
    failed++;
  }
}

const { server, port } = await startServer();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const pageErrors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (/HIGHSCORE_KEY|TELEMETRY_KEY|confirmEraseProgress|clearAllProgress/i.test(text)) {
        pageErrors.push(text);
      }
    }
  });
  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.confirmEraseProgress === 'function' && typeof window.takeFlightToSelect === 'function');
  await page.evaluate(() => {
    document.getElementById('error-console-overlay')?.remove();
    if (typeof closeWarRoomTutorial === 'function') closeWarRoomTutorial();
    document.getElementById('warroom-tutorial-modal')?.classList.remove('open');
  });

  const seeded = await page.evaluate(({ SAVE_KEY, UNLOCK_KEY, HIGHSCORE_KEY, TELEMETRY_KEY, ACCESS_KEY, MUSIC_KEY, META_KEY }) => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ player: { name: 'Crow', birdKey: 'crow' }, stage: 4 }));
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ unlock_hummingbird: true }));
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify([{ birdName: 'Crow', stage: 'Stage 4', stageNumber: 4 }]));
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify({ runs: [{ bird: 'crow' }], meta: {} }));
    localStorage.setItem(ACCESS_KEY, JSON.stringify({ fontSize: 110 }));
    localStorage.setItem(MUSIC_KEY, JSON.stringify({ muted: true, volume: 40 }));
    localStorage.setItem(META_KEY, JSON.stringify({ goldenGooseEggs: 12 }));
    return {
      save: localStorage.getItem(SAVE_KEY),
      highscoreKeyOnWindow: typeof window.HIGHSCORE_KEY,
      telemetryKeyOnWindow: typeof window.TELEMETRY_KEY,
      avianConfirm: typeof Avian?.actions?.confirmEraseProgress,
    };
  }, { SAVE_KEY, UNLOCK_KEY, HIGHSCORE_KEY, TELEMETRY_KEY, ACCESS_KEY, MUSIC_KEY, META_KEY });
  ok('seeded a run save', !!(seeded.save && seeded.save.includes('Crow')));
  ok('HIGHSCORE_KEY is on window', seeded.highscoreKeyOnWindow === 'string');
  ok('TELEMETRY_KEY is on window', seeded.telemetryKeyOnWindow === 'string');
  ok('confirmEraseProgress is registered', seeded.avianConfirm === 'function');

  await page.locator('#take-flight-btn').click();
  await page.waitForSelector('#screen-select.active');
  await page.evaluate(() => {
    if (typeof closeWarRoomTutorial === 'function') closeWarRoomTutorial();
    document.getElementById('warroom-tutorial-modal')?.classList.remove('open');
  });
  await page.locator('.splash-hotspot--supplies').click();
  await page.waitForSelector('#select-hub-supplies.is-open');
  const eraseBtn = page.locator('#select-hub-supplies [data-action="openEraseProgressModal"]');
  ok('Supplies Erase saved progress is visible', await eraseBtn.isVisible());
  await eraseBtn.click();
  await page.waitForSelector('#erase-progress-modal.open');
  const modalZ = await page.evaluate(() => {
    const m = document.getElementById('erase-progress-modal');
    return m ? Number(getComputedStyle(m).zIndex) || 0 : 0;
  });
  ok('erase confirm modal stacks above hub (z-index >= 12600)', modalZ >= 12600);

  await page.locator('#erase-progress-modal [data-action="confirmEraseProgress"]').click();
  await page.waitForFunction(() => !document.getElementById('erase-progress-modal')?.classList.contains('open'));

  const after = await page.evaluate(({ SAVE_KEY, UNLOCK_KEY, HIGHSCORE_KEY, TELEMETRY_KEY, ACCESS_KEY, MUSIC_KEY, META_KEY }) => {
    return {
      save: localStorage.getItem(SAVE_KEY),
      unlocks: localStorage.getItem(UNLOCK_KEY),
      highscores: localStorage.getItem(HIGHSCORE_KEY),
      telemetry: localStorage.getItem(TELEMETRY_KEY),
      access: localStorage.getItem(ACCESS_KEY),
      music: localStorage.getItem(MUSIC_KEY),
      meta: localStorage.getItem(META_KEY),
      player: globalThis.G?.player ?? null,
      modalOpen: !!document.getElementById('erase-progress-modal')?.classList.contains('open'),
      msg: document.getElementById('dev-code-msg')?.textContent || '',
      hud: document.getElementById('eh-list')?.innerText || '',
    };
  }, { SAVE_KEY, UNLOCK_KEY, HIGHSCORE_KEY, TELEMETRY_KEY, ACCESS_KEY, MUSIC_KEY, META_KEY });

  ok('run save erased', after.save == null);
  ok('unlocks erased', after.unlocks == null);
  ok('highscores erased', after.highscores == null);
  ok('telemetry erased', after.telemetry == null);
  ok('fortune meta erased', after.meta == null);
  ok('accessibility settings kept', !!(after.access && after.access.includes('110')));
  ok('music settings kept', !!(after.music && after.music.includes('muted')));
  ok('player runtime cleared', after.player == null);
  ok('confirm modal closed', after.modalOpen === false);
  ok('success message shown', /erased/i.test(after.msg));
  ok('no HIGHSCORE_KEY / confirmEraseProgress errors', pageErrors.length === 0 && !/HIGHSCORE_KEY/.test(after.hud));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

if (failed) {
  console.error(`[erase-progress] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[erase-progress] all checks passed');
