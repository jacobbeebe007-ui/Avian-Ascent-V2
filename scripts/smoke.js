#!/usr/bin/env node
/* Avian Ascent smoke check.
 *
 * Static-only — no jsdom required, runs on a clean clone with just Node.
 * Verifies the prebuilt bundle contains the symbols the splash screen,
 * battle loop, and namespace bootstrap rely on. Catches the regression
 * class that broke the splash earlier (missing takeFlightToSelect) in
 * milliseconds rather than after a manual playtest.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'js', 'avian-game.bundle.js');

function fail(msg) {
  console.error('[smoke] FAIL ' + msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('[smoke] ok   ' + msg);
}

if (!fs.existsSync(BUNDLE)) {
  console.error('[smoke] missing js/avian-game.bundle.js — run `node scripts/build-bundle.js` first.');
  process.exit(1);
}

const src = fs.readFileSync(BUNDLE, 'utf8');
let failed = 0;

// Keep this check ahead of the symbol assertions. A conflicted generated bundle
// can still contain every expected symbol while failing before the event router
// wires the main-menu buttons in the browser.
if (/^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(src)) {
  fail('bundle contains unresolved merge-conflict markers');
  failed++;
} else {
  ok('bundle has no merge-conflict markers');
}

try {
  new vm.Script(src, { filename: 'js/avian-game.bundle.js' });
  ok('bundle parses as JavaScript');
} catch (err) {
  fail(`bundle JavaScript parse: ${err.message}`);
  failed++;
}

const checks = [
  { label: 'Avian namespace bootstrap', re: /globalThis\.Avian\s*=\s*Avian/ },
  { label: 'Avian.debug.safe defined',  re: /Avian\.debug\.safe\s*=\s*function/ },
  { label: 'Avian.actions.register',    re: /Avian\.actions\.register\s*=/ },
  { label: 'Avian.statuses.register',   re: /Avian\.statuses\.register\s*=/ },
  { label: 'AILMENTS table assigned',   re: /globalThis\.AILMENTS\s*=/ },
  { label: 'ABILITY_TEMPLATES table',   re: /\bABILITY_TEMPLATES\s*=/ },
  { label: 'BIRDS table',               re: /globalThis\.BIRDS\s*=\s*birds\b/ },
  { label: 'ENEMIES table',             re: /globalThis\.ENEMIES\s*=\s*enemies\b/ },
  { label: 'Equipment skills data', re: /Avian\.data\.equipment\.skills\s*=\s*Object\.freeze/ },
  { label: 'Ability dispatcher', re: /Avian\.dispatcher\s*=\s*dispatcher/ },
  { label: 'Combat pack boot',   re: /combat-pack-boot\.js/ },
  { label: 'ACTIONS handler map',       re: /Object\.assign\(\s*ACTIONS\s*,/ },
  { label: 'takeFlightToSelect global', re: /globalThis\.takeFlightToSelect\s*=/ },
  { label: 'showScreen function',       re: /\bfunction\s+showScreen\b/ },
  { label: 'handleOverworldReturn global', re: /globalThis\.handleOverworldReturn\s*=/ },
  { label: 'OW bootstrap defer',        re: /queueMicrotask\s*\(\s*_avianBootstrapInit\s*\)/ },
  { label: 'resolveForgeEncounterBirdKeys', re: /global\.resolveForgeEncounterBirdKeys\s*=\s*function/ },
  { label: 'installErrorHUD global', re: /global\.installErrorHUD\s*=\s*installErrorHUD/ },
  { label: 'pushErrorHUD global', re: /global\.pushErrorHUD\s*=\s*pushErrorHUD/ },
  { label: 'bundle hash injected',      re: /globalThis\.__AVIAN_BUNDLE_HASH__\s*=/ },
  { label: 'Nest equipment bag/worn layout', re: /nest-eq-layout/ },
  { label: 'Nest compact bag cards', re: /nest-inv-item--compact/ },
  { label: 'Nest item stats chips', re: /nest-item-stats/ },
  { label: 'Nest profile columns', re: /nest-profile-columns/ },
  { label: 'Enemy nest inspect opener', re: /function openEnemyNest\b/ },
  { label: 'Enemy nest inspect tabs', re: /nest-tabs--3/ },
  { label: 'Combat hover card', re: /combat-hover-card/ },
  { label: 'Combat empty skill reason', re: /btn-empty-reason/ },
  { label: 'grantEquipment auto-equip', re: /function grantEquipment\b/ },
  { label: 'clearGameCache reloads HTTP shell', re: /function reloadShellHttpCache\b/ },
  { label: 'confirmClearCache cache-bust reload', re: /function cacheBustReload\b/ },
  { label: 'setHatcherySubView global', re: /globalThis\.setHatcherySubView\s*=/ },
  { label: 'openInventorySavedNests global', re: /globalThis\.openInventorySavedNests\s*=/ },
  { label: 'syncWarRoomBank updates splash bank', re: /function syncWarRoomBank\b/ },
  { label: 'hatch reveal New ribbon', re: /mother-goose-hatch-ribbon--new">New</ },
  { label: 'hatch reveal Duplicate ribbon', re: /mother-goose-hatch-ribbon--dupe">Duplicate</ },
  { label: 'rescued nest hatch source', re: /source:\s*'nest'/ },
  { label: 'Flight settings briefing', re: /function syncFlightSettingsBriefing\b/ },
  { label: 'Flight settings choice cards', re: /flight-choice-card/ },
  { label: 'Settings audio labels', re: /function syncAudioSettingLabels\b/ },
  { label: 'Music assignment chips', re: /function syncMusicMenuAssignmentChips\b/ },
  { label: 'Enemy telegraph render', re: /function renderEnemyPlan\b/ },
  { label: 'Shop equipped tab', re: /function renderShopEquipped\b/ },
];

for (const c of checks) {
  if (c.re.test(src)) ok(c.label);
  else { fail(c.label); failed++; }
}

const expectMinKB = 800;
const sizeKB = src.length / 1024;
if (sizeKB < expectMinKB) {
  fail(`bundle size only ${sizeKB.toFixed(1)} KiB (expected >= ${expectMinKB} KiB)`);
  failed++;
} else {
  ok(`bundle size ${sizeKB.toFixed(1)} KiB`);
}

const hashFile = path.join(ROOT, 'js', 'avian-game.bundle.hash');
let bundleHash = '';
if (fs.existsSync(hashFile)) {
  bundleHash = fs.readFileSync(hashFile, 'utf8').trim();
  if (/^[0-9a-f]{12}$/.test(bundleHash)) ok(`hash file ${bundleHash}`);
  else { fail(`hash file malformed: "${bundleHash}"`); failed++; }
} else {
  fail('hash file missing (js/avian-game.bundle.hash)');
  failed++;
}

const headerHash = (src.match(/globalThis\.__AVIAN_BUNDLE_HASH__\s*=\s*"([0-9a-f]{12})"/) || [])[1] || '';
if (bundleHash && headerHash && headerHash === bundleHash) {
  ok('bundle header hash matches hash file');
} else if (bundleHash) {
  fail(`bundle header hash "${headerHash || 'missing'}" does not match hash file ${bundleHash}`);
  failed++;
}

const sw = path.join(ROOT, 'sw.js');
if (fs.existsSync(sw)) {
  const swSrc = fs.readFileSync(sw, 'utf8');
  const swHash = (swSrc.match(/CACHE_VERSION = 'avian-ascent-([0-9a-f]{12})'/) || [])[1] || '';
  if (bundleHash && swHash === bundleHash) {
    ok(`sw.js CACHE_VERSION pinned to bundle hash ${bundleHash}`);
  } else {
    fail(`sw.js CACHE_VERSION '${swHash || 'missing'}' does not match hash file ${bundleHash || 'missing'}`);
    failed++;
  }
}

const htmlPath = path.join(ROOT, 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const htmlChecks = [
    { label: 'Inventory Eggs tab', re: /data-action="setInventorySubView:eggs">Eggs</ },
    { label: 'Inventory Artifacts tab', re: /data-action="setInventorySubView:artifacts">Artifacts</ },
    { label: 'Inventory Vault tab', re: /data-action="setInventorySubView:vault">Vault</ },
    { label: 'War room banked eggs', re: /id="splash-bank-eggs"/ },
    { label: 'War room saved nests shortcut', re: /data-action="openInventorySavedNests"/ },
    { label: 'Emporium Trade tab', re: /data-action="setFortuneSubView:trade">Trade</ },
    { label: 'Emporium Relics tab', re: /data-action="setFortuneSubView:relics">Relics</ },
    { label: 'Hatchery Mother Goose tab', re: /data-action="setHatcherySubView:mother">Mother Goose</ },
    { label: 'Hatchery Eggs tab', re: /data-action="setHatcherySubView:eggs">Eggs</ },
    { label: 'Hatchery reveal legend', re: /class="hatchery-reveal-legend"/ },
    { label: 'Hatch reveal subtitle', re: /id="mother-goose-hatch-subtitle"/ },
  ];
  for (const c of htmlChecks) {
    if (c.re.test(html)) ok(c.label);
    else { fail(c.label); failed++; }
  }
} else {
  fail('index.html missing');
  failed++;
}

if (failed > 0) {
  console.error(`[smoke] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[smoke] OK');
