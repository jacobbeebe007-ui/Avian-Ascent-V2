#!/usr/bin/env node
/**
 * Static checks for Stork Emporium shop chrome, multi-select, and Equipped tab.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function fail(msg) {
  console.error('[stork-shop-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[stork-shop-ui] ok  ', msg);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');

const htmlChecks = [
  ['shop screen id', /id="screen-stork-shop"/],
  ['shop hides combat header', /id="shop-tab-equipped"/],
  ['buy all tab', /id="shop-tab-all"[^>]*data-shop-tab="all"/],
  ['sell tab', /id="shop-tab-sell"[^>]*data-shop-tab="sell"/],
  ['equipped tab', /id="shop-tab-equipped"[^>]*data-shop-tab="equipped"/],
  ['shop dock', /id="shop-dock"/],
  ['shop dock summary', /id="shop-dock-summary"/],
  ['buy button', /id="shop-buy-btn"/],
  ['sell button', /id="shop-sell-btn"/],
  ['no leftover combatants in shop', /id="screen-stork-shop"[\s\S]*?<\/div>\s*<!-- ENDLESS NODE MAP -->/],
];

const cssChecks = [
  ['shop covers viewport', /#screen-stork-shop\.active\{[\s\S]*?position:fixed/,],
  ['shop hides global header', /#app:has\(#screen-stork-shop\.active\) > header\{display:none/,],
  ['shop z-index above reward', /#screen-stork-shop\.active\{[\s\S]*?z-index:28/,],
  ['equipped grid', /\.shop-equipped-grid\{/,],
  ['equipped slot', /\.shop-equipped-slot\{/,],
];

const jsChecks = [
  ['setShopTab equipped branch', /function setShopTab\(tab\)\{[\s\S]*?isEquipped=\(tab==='equipped'\)/],
  ['renderShopEquipped', /function renderShopEquipped\b/],
  ['shopUnequipSlot', /function shopUnequipSlot\b/],
  ['multi-select buy set', /selectedBuyIndices:new Set\(\)/],
  ['multi-select sell set', /selectedSellIndices:new Set\(\)/],
  ['shop dock sync', /function syncShopDock\b/],
  ['battle class stripped on enter', /enterStorkShopScreen[\s\S]*?screen-battle[\s\S]*?classList\.remove\('active'\)/],
];

if (/id="screen-stork-shop"[\s\S]*?class="combatants"/.test(html)) {
  fail('html: shop screen contains combatants layout');
} else {
  ok('html: shop screen has no combatants layout');
}

for (const [label, re] of htmlChecks) {
  if (re.test(html)) ok('html: ' + label);
  else fail('html: ' + label);
}
for (const [label, re] of cssChecks) {
  if (re.test(css)) ok('css: ' + label);
  else fail('css: ' + label);
}
for (const [label, re] of jsChecks) {
  if (re.test(game)) ok('js: ' + label);
  else fail('js: ' + label);
}

if (failed > 0) {
  console.error(`[stork-shop-ui] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[stork-shop-ui] OK');
