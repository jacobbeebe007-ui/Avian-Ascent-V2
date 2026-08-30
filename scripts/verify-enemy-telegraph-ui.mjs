#!/usr/bin/env node
/**
 * Static checks for the combat enemy telegraph and Settings toggle.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function fail(msg) {
  console.error('[enemy-telegraph-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[enemy-telegraph-ui] ok  ', msg);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const game = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');

const htmlChecks = [
  ['telegraph dock', /id="enemy-telegraph"/],
  ['telegraph actions', /id="enemy-telegraph-actions"/],
  ['settings checkbox', /id="setting-show-enemy-intent"/],
];
const cssChecks = [
  ['telegraph absolute center', /#enemy-telegraph\{[\s\S]*?position:absolute/,],
  ['hide class', /body\.combat-hide-enemy-intent #enemy-telegraph/,],
];
const jsChecks = [
  ['showEnemyIntent default on', /showEnemyIntent:raw\.showEnemyIntent!==false/],
  ['applyEnemyIntentVisibility', /function applyEnemyIntentVisibility\b/],
  ['renderEnemyPlan chips', /function renderEnemyPlan\(\)\{[\s\S]*?enemy-telegraph-chip/],
  ['settings persist', /showEnemyIntent:document\.getElementById\('setting-show-enemy-intent'\)/],
];

if (/id="enemy-intent-panel"/.test(html)) {
  fail('html: old enemy-intent-panel is still in the combat extras');
} else {
  ok('html: old intent pill removed from extras');
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
  console.error(`[enemy-telegraph-ui] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[enemy-telegraph-ui] OK');
