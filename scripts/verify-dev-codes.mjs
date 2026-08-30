#!/usr/bin/env node
/**
 * Verify GM / unlock codes: typed codes fire without GMbirdwatching,
 * Apply activates or turns off switches immediately, birdwatching unlocks
 * the full 52-bird roster, headinghome relocks non-starters, and Robin
 * is not a starter.
 */
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

let failed = 0;
function ok(label, cond = true) {
  if (cond) console.log('[dev-codes] ok  ', label);
  else {
    console.error('[dev-codes] FAIL', label);
    failed++;
  }
}

const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');
const birds = readFileSync(path.join(ROOT, 'js/data/birds.js'), 'utf8');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

ok('robin has unlock_robin', /robin:\{[\s\S]*?unlockRequires:"unlock_robin"/.test(birds));
ok('robin is not in hardcoded starter lists', !/\['sparrow','goose','blackbird','crow','macaw','robin'\]/.test(game));
ok('typed codes no longer require a switch', !/This code is currently turned off/.test(game));
ok('Apply runs activateDevCode', /function applyDevCodeSwitches\(\)\{[\s\S]*activateDevCode\(code/.test(game));
ok('Apply can deactivate reversible codes', /function applyDevCodeSwitches\(\)\{[\s\S]*deactivateDevCode\(code/.test(game));
ok('birdwatching grants every bird unlock id', /function applyBirdwatchingUnlock\(\)\{[\s\S]*collectAllBirdUnlockIds\(\)/.test(game));
ok('headinghome locks non-starter unlocks', /function applyHeadingHomeLock\(\)\{[\s\S]*getPlayableStarterBirdKeys\(\)/.test(game));
ok('Apply hint says codes turn on immediately', /Tick codes and press Apply to turn them on immediately/.test(html));

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
      readFileSafe(full, (err, data, ext) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });
}

function readFileSafe(full, cb) {
  try {
    const data = readFileSync(full);
    cb(null, data, path.extname(full));
  } catch (err) {
    cb(err);
  }
}

function rosterExpr() {
  return () => {
    const birdsMap = globalThis.BIRDS || {};
    const keys = Object.keys(birdsMap);
    const starters = typeof globalThis.getPlayableStarterBirdKeys === 'function'
      ? globalThis.getPlayableStarterBirdKeys()
      : [];
    const unlocked = keys.filter((k) => {
      if (typeof globalThis.isBirdUnlockedForSelect === 'function') {
        return globalThis.isBirdUnlockedForSelect(k, birdsMap[k]);
      }
      const bird = birdsMap[k];
      return !(bird?.unlockRequires && typeof globalThis.isUnlocked === 'function' && !globalThis.isUnlocked(bird.unlockRequires));
    });
    return {
      total: keys.length,
      unlocked: unlocked.length,
      starters,
      robinIsStarter: starters.includes('robin'),
      robinUnlocked: unlocked.includes('robin'),
      creator: localStorage.getItem('avian_creator_codes'),
      birdwatchingSwitch: !!(JSON.parse(localStorage.getItem('avian_dev_code_switches') || '{}').birdwatching),
      turnedOffMsg: document.getElementById('dev-code-msg')?.textContent || '',
    };
  };
}

const { server, port } = await startServer();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(20000);
  await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.checkDevCode === 'function' && typeof window.applyDevCodeSwitches === 'function' && window.BIRDS && Object.keys(window.BIRDS).length >= 52);

  const baseline = await page.evaluate(rosterExpr());
  ok(`roster has 52 birds (got ${baseline.total})`, baseline.total === 52);
  ok('Robin is not a starter key', baseline.robinIsStarter === false);
  ok(`fresh roster does not unlock Robin (unlocked ${baseline.unlocked})`, baseline.robinUnlocked === false);
  ok(`fresh unlock count is starter-only (got ${baseline.unlocked} starters ${baseline.starters.length})`, baseline.unlocked === baseline.starters.length);

  const typed = await page.evaluate(() => {
    localStorage.removeItem('avian_creator_codes');
    localStorage.removeItem('avian_dev_code_switches');
    window.checkDevCode('birdwatching');
    return document.getElementById('dev-code-msg')?.textContent || '';
  });
  ok('typed birdwatching does not say turned off', !/turned off/i.test(typed));
  ok('typed birdwatching confirms unlock', /all birds unlocked/i.test(typed));

  const afterType = await page.evaluate(rosterExpr());
  ok(`typed birdwatching unlocks all 52 (got ${afterType.unlocked})`, afterType.unlocked === 52);
  ok('typed birdwatching unlocks Robin', afterType.robinUnlocked === true);
  ok('typed birdwatching works without GMbirdwatching', afterType.creator == null);

  await page.evaluate(() => window.checkDevCode('headinghome'));
  const afterHome = await page.evaluate(rosterExpr());
  ok(`headinghome relocks to starters (got ${afterHome.unlocked})`, afterHome.unlocked === afterHome.starters.length);
  ok('headinghome locks Robin', afterHome.robinUnlocked === false);
  ok('headinghome leaves starter keys only', afterHome.starters.every((k) => k !== 'robin'));

  await page.evaluate(() => {
    window.checkDevCode('gmbirdwatching');
    const box = document.querySelector('#supplies-code-toggle-list input[data-code="birdwatching"]');
    if (box) box.checked = true;
    window.applyDevCodeSwitches();
  });
  const afterApplyOn = await page.evaluate(rosterExpr());
  ok(`Apply birdwatching unlocks all 52 (got ${afterApplyOn.unlocked})`, afterApplyOn.unlocked === 52);
  ok('Apply birdwatching marks switch on', afterApplyOn.birdwatchingSwitch === true);

  await page.evaluate(() => {
    const box = document.querySelector('#supplies-code-toggle-list input[data-code="birdwatching"]');
    if (box) box.checked = false;
    window.applyDevCodeSwitches();
  });
  const afterApplyOff = await page.evaluate(rosterExpr());
  ok(`untick + Apply relocks to starters (got ${afterApplyOff.unlocked})`, afterApplyOff.unlocked === afterApplyOff.starters.length);
  ok('untick + Apply locks Robin', afterApplyOff.robinUnlocked === false);
  ok('untick + Apply clears birdwatching switch', afterApplyOff.birdwatchingSwitch === false);
} finally {
  await browser.close();
  server.close();
}

if (failed > 0) {
  console.error(`[dev-codes] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[dev-codes] all checks passed');
