#!/usr/bin/env node
/**
 * Static checks for the Flight Settings hub panel (course / difficulty / mode).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function fail(msg) {
  console.error('[flight-settings-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[flight-settings-ui] ok  ', msg);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');

const htmlChecks = [
  ['flight settings panel class', /id="select-hub-map"[\s\S]*?select-hub-panel-inner--flight/],
  ['course heading', /id="flight-course-heading">Course</],
  ['difficulty heading', /id="flight-diff-heading">Difficulty</],
  ['mode heading', /id="flight-mode-heading">Flight Mode</],
  ['live briefing region', /id="flight-briefing"/],
  ['demo course card id', /id="mission-map-nav-demo"/],
  ['test course card id', /id="mission-map-nav-test"/],
  ['diff picker id', /id="diff-picker"/],
  ['game mode host id', /id="game-mode-toggle"/],
  ['character select settings label', />⚙ Flight Settings</],
];

const cssChecks = [
  ['choice card class', /\.flight-choice-card\{/],
  ['diff picker grid', /\.flight-diff-picker\{/],
  ['briefing bar', /\.flight-briefing\{/],
  ['mobile stack', /@media \(max-width:560px\)\{[\s\S]*?flight-diff-picker/],
];

const jsChecks = [
  ['syncFlightSettingsBriefing', /function syncFlightSettingsBriefing\b/],
  ['getFlightSettingsSummary', /function getFlightSettingsSummary\b/],
  ['mode cards use data-action', /data-action="setGameMode:story"/],
  ['no inline setGameMode onclick', /function buildGameModeToggle\(\)\{[\s\S]*?function setGameMode/],
  ['diff cards use data-action', /btn\.dataset\.action = 'selectDifficulty:' \+ d\.id/],
  ['rebuild pickers on open', /which === 'map'[\s\S]*?buildDifficultyPicker[\s\S]*?buildGameModeToggle/],
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

const modeToggleFn = game.match(/function buildGameModeToggle\(\)\{[\s\S]*?\nfunction setGameMode/);
if (modeToggleFn && /onclick=/.test(modeToggleFn[0])) {
  fail('js: buildGameModeToggle still uses inline onclick');
} else if (modeToggleFn) {
  ok('js: buildGameModeToggle has no inline onclick');
} else {
  fail('js: could not isolate buildGameModeToggle');
}

if (failed > 0) {
  console.error(`[flight-settings-ui] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[flight-settings-ui] OK');
