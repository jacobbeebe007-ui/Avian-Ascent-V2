#!/usr/bin/env node
/**
 * Static checks for Settings, Music, and Supplies menu chrome.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function fail(msg) {
  console.error('[hub-menus-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[hub-menus-ui] ok  ', msg);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');
const shop = readFileSync(path.join(ROOT, 'js/meta/fortune-shop.js'), 'utf8');
const inventory = readFileSync(path.join(ROOT, 'js/meta/fortune-inventory.js'), 'utf8');

const htmlChecks = [
  ['settings dialog labelled', /id="settings-modal"[^>]*aria-labelledby="settings-modal-title"/],
  ['settings kicker', /class="settings-kicker"/],
  ['settings close control', /data-action="closeSettingsModal" aria-label="Close settings"/],
  ['settings screen heading', /id="settings-screen-heading">Screen</],
  ['settings combat heading', /id="settings-combat-heading">Combat layout</],
  ['settings enemy intent toggle', /id="setting-show-enemy-intent"/],
  ['settings help diagnostics', /id="settings-debug-heading">Diagnostics</],
  ['settings volume percents', /id="setting-master-volume-val"/],
  ['settings session footer', /class="settings-modal-foot"/],
  ['music kicker', /class="music-menu-kicker"/],
  ['music assignment cards', /class="music-role-card"/],
  ['music now playing', /id="music-menu-now-playing"/],
  ['music preview track ids', /data-track-id="last_thermal"/],
  ['supplies kicker', /class="supplies-kicker"/],
  ['supplies codex tab', /id="supplies-nav-reference"[^>]*>Codex</],
  ['supplies records tab', /id="supplies-nav-records"[^>]*>Records</],
  ['supplies device section', /id="supplies-device-heading">This device</],
  ['supplies clear cache action', /id="select-hub-supplies"[\s\S]*?data-action="openClearCacheModal"/],
  ['unlock input kept', /id="dev-code-input"/],
  ['war room banked eggs chip', /id="splash-bank-eggs"/],
  ['war room saved nests shortcut', /data-action="openInventorySavedNests"/],
];

const cssChecks = [
  ['settings section cards', /\.settings-section\{/],
  ['settings tab grid', /\.settings-tabs\{[\s\S]*?grid-template-columns:repeat\(5/,],
  ['music role cards', /\.music-role-card,/],
  ['music now playing live', /\.music-now-playing\.is-live\{/],
  ['supplies section cards', /\.supplies-section\{/],
  ['supplies device danger', /\.supplies-section--device\{/],
  ['war room bank chip', /\.splash-bank-chip\{/],
  ['war room nests shortcut', /\.splash-bank-chip--nests\{/],
];

const jsChecks = [
  ['settings tab aria', /t\.setAttribute\('aria-selected', String\(on\)\)/],
  ['audio volume labels', /function syncAudioSettingLabels\b/],
  ['music assignment chips', /function syncMusicMenuAssignmentChips\b/],
  ['music now playing sync', /function syncMusicMenuNowPlaying\b/],
  ['supplies 3-col when codes', /subnav\.classList\.toggle\('hub-subnav--3'/],
];

for (const [label, re] of htmlChecks) {
  if (re.test(html)) ok(label);
  else fail('html: ' + label);
}
for (const [label, re] of cssChecks) {
  if (re.test(css)) ok(label);
  else fail('css: ' + label);
}
for (const [label, re] of jsChecks) {
  if (re.test(game)) ok(label);
  else fail('js: ' + label);
}

if (/id="fortune-egg-badge"/.test(html)) fail('html: fortune-egg-badge should be removed from Cuckoo\'s Emporium');
else ok('emporium gold badge removed');
if (/function syncWarRoomBank\b/.test(shop)) ok('sync war room bank');
else fail('fortune-shop: syncWarRoomBank');
if (/function openInventorySavedNests\b/.test(inventory)) ok('open inventory saved nests');
else fail('fortune-inventory: openInventorySavedNests');
if (/nestBtn\.hidden = !\(nests > 0\)/.test(shop)) ok('hide nests shortcut when empty');
else fail('fortune-shop: hide empty nests shortcut');

if (failed > 0) {
  console.error(`[hub-menus-ui] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[hub-menus-ui] OK');
