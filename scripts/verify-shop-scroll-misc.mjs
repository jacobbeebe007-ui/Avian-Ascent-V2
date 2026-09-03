#!/usr/bin/env node
/**
 * Runtime check: shop scroll region exists and misc shiny bonus sells at the shop.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function fail(msg) {
  console.error('[shop-scroll-misc] FAIL', msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('[shop-scroll-misc] ok  ', msg);
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname === '/') filePath = path.join(ROOT, 'index.html');
  try {
    const data = readFileSync(filePath);
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`${base}/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof globalThis.enterStorkShopScreen === 'function', null, { timeout: 30000 });

const setup = await page.evaluate(() => {
  G.selected = 'sparrow';
  G.player = {
    name: 'Test Sparrow',
    birdKey: 'sparrow',
    portraitKey: 'sparrow',
    stats: { hp: 20, maxHp: 20, atk: 5, def: 3, matk: 2, mdef: 2, spd: 3, acc: 80, critChance: 5 },
    equipmentInventory: [],
    miscItems: [{
      kind: 'bonus_shines',
      amount: 10,
      tier: 'gold',
      name: 'Shiny Objects',
      icon: '✨',
      desc: 'Bonus shines (+10). Sell at the Stork Shop.',
    }],
    combatItems: {},
    abilities: [],
    exp: 0,
    birdLevel: 1,
  };
  if (typeof Avian?.equipment?.ensurePlayerEquipmentState === 'function') {
    Avian.equipment.ensurePlayerEquipmentState(G.player);
  }
  G.shinyObjects = 25;
  assignShopItems([
    ...(globalThis.SHOP_COMBAT_ITEMS || []).map((it) => ({ ...it })),
    ...(globalThis.SHOP_COMBAT_ITEMS || []).map((it, i) => ({ ...it, id: it.id + '_dup' + i })),
    ...(globalThis.SHOP_COMBAT_ITEMS || []).map((it, i) => ({ ...it, id: it.id + '_dup2_' + i })),
  ]);
  enterStorkShopScreen();
  setShopTab('all');
  const scroll = document.getElementById('shop-items-scroll');
  const grid = document.getElementById('shop-items-grid');
  return {
    scrollExists: !!scroll,
    gridCount: grid ? grid.querySelectorAll('.shop-item').length : 0,
    scrollClient: scroll?.clientHeight || 0,
    scrollHeight: scroll?.scrollHeight || 0,
  };
});

if (!setup.scrollExists) fail('shop-items-scroll wrapper missing');
else ok('shop-items-scroll wrapper present');

if (setup.gridCount < 6) fail(`expected many shop cards, got ${setup.gridCount}`);
else ok(`buy tab renders ${setup.gridCount} cards`);

if (setup.scrollHeight <= setup.scrollClient) fail(`scroll region not overflowed (${setup.scrollHeight} <= ${setup.scrollClient})`);
else ok(`scroll region overflows (${setup.scrollHeight}px > ${setup.scrollClient}px)`);

const scrolled = await page.evaluate(() => {
  const scroll = document.getElementById('shop-items-scroll');
  scroll.scrollTop = scroll.scrollHeight;
  return scroll.scrollTop > 0;
});
if (!scrolled) fail('could not scroll shop items region');
else ok('shop items region scrolls on mobile viewport');

await page.evaluate(() => setShopTab('sell'));
const sell = await page.evaluate(() => {
  const grid = document.getElementById('shop-items-grid');
  const headings = [...grid.querySelectorAll('.shop-section-heading')].map((el) => el.textContent.trim());
  const miscCards = grid.querySelectorAll('.shop-sell-misc');
  return { headings, miscCount: miscCards.length, text: grid.textContent };
});

if (!sell.headings.includes('Miscellaneous')) fail('Miscellaneous sell section missing');
else ok('Miscellaneous sell section rendered');

if (sell.miscCount < 1) fail('no misc sell cards');
else ok('misc shiny bonus card visible');

await page.evaluate(() => {
  const card = document.querySelector('.shop-sell-misc');
  card?.click();
});
await page.click('#shop-sell-btn');
const after = await page.evaluate(() => ({
  shinies: G.shinyObjects,
  miscLeft: (G.player.miscItems || []).length,
}));
if (after.miscLeft !== 0) fail(`misc item not removed (${after.miscLeft} left)`);
else ok('selling misc item removes it from inventory');
if (after.shinies !== 35) fail(`expected 35 shinies after sell, got ${after.shinies}`);
else ok('selling misc item grants +10 shinies');

await browser.close();
server.close();

if (process.exitCode) {
  console.error('[shop-scroll-misc] checks failed');
  process.exit(process.exitCode);
}
console.log('[shop-scroll-misc] OK');
