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

const checks = [
  { label: 'Avian namespace bootstrap', re: /globalThis\.Avian\s*=\s*Avian/ },
  { label: 'Avian.debug.safe defined',  re: /Avian\.debug\.safe\s*=\s*function/ },
  { label: 'Avian.actions.register',    re: /Avian\.actions\.register\s*=/ },
  { label: 'Avian.statuses.register',   re: /Avian\.statuses\.register\s*=/ },
  { label: 'AILMENTS table assigned',   re: /globalThis\.AILMENTS\s*=/ },
  { label: 'ABILITY_TEMPLATES table',   re: /\bABILITY_TEMPLATES\s*=/ },
  { label: 'BIRDS table',               re: /globalThis\.BIRDS\s*=\s*birds\b/ },
  { label: 'ENEMIES table',             re: /globalThis\.ENEMIES\s*=\s*enemies\b/ },
  { label: 'UPGRADE_CARDS_REWORK pool', re: /globalThis\.UPGRADE_CARDS_REWORK\s*=\s*cards\b/ },
  { label: 'ACTIONS handler map',       re: /Object\.assign\(\s*ACTIONS\s*,/ },
  { label: 'takeFlightToSelect global', re: /globalThis\.takeFlightToSelect\s*=/ },
  { label: 'showScreen function',       re: /\bfunction\s+showScreen\b/ },
  { label: 'bundle hash injected',      re: /globalThis\.__AVIAN_BUNDLE_HASH__\s*=/ },
];

let failed = 0;
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
if (fs.existsSync(hashFile)) {
  const hash = fs.readFileSync(hashFile, 'utf8').trim();
  if (/^[0-9a-f]{12}$/.test(hash)) ok(`hash file ${hash}`);
  else { fail(`hash file malformed: "${hash}"`); failed++; }
} else {
  fail('hash file missing (js/avian-game.bundle.hash)');
  failed++;
}

const sw = path.join(ROOT, 'sw.js');
if (fs.existsSync(sw)) {
  const swSrc = fs.readFileSync(sw, 'utf8');
  if (/CACHE_VERSION = 'avian-ascent-[0-9a-f]{12}'/.test(swSrc)) {
    ok('sw.js CACHE_VERSION pinned to bundle hash');
  } else {
    fail('sw.js CACHE_VERSION not pinned to bundle hash');
    failed++;
  }
}

if (failed > 0) {
  console.error(`[smoke] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[smoke] OK');
