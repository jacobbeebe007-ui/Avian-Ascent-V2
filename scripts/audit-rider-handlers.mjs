#!/usr/bin/env node
/**
 * Verify every parsed rider kind has a dispatcher handler and ability-display segment.
 *   node scripts/audit-rider-handlers.mjs [--strict]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const sandbox = vm.createContext({ console, Math, Number, Object, Array, String, JSON, globalThis: null });
sandbox.globalThis = sandbox;

for (const rel of [
  'js/data/effect-tiers.js',
  'js/data/combat-stat-magnitudes.js',
  'js/systems/ability-rider-parser.js',
  'js/systems/ability-display.js',
]) {
  vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const dispatcherSrc = readFileSync(path.join(ROOT, 'js/systems/ability-dispatcher.js'), 'utf8');
const statBlock = dispatcherSrc.match(/makeStatRiderHandlers[\s\S]*?return \{([\s\S]*?)\};\s*\}/);
const riderBlock = dispatcherSrc.match(/var riderHandlers = \{([\s\S]*?)\};/);
const handlerKeys = new Set();
if (statBlock) {
  for (const m of statBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);
}
if (riderBlock) {
  for (const m of riderBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);
}

const SKIP_EXEC_KINDS = new Set([
  'refundApOnCrit', // runPostRiders
  'gainApNextTurn', // runPostRiders
  'bonusVsAilment', // damage formula
  'bonusVsLowHp', // damage formula
  'tagFlag', // tag system
  'raw', // unresolved text
]);

const DEFERRED_KINDS = new Set([
  'gainAccNextHit', // onEnemyMissedPlayer + modifyAcc
]);

const treesSrc = readFileSync(path.join(ROOT, 'js/data/combat-pack/skill-trees.js'), 'utf8');
const treesMatch = treesSrc.match(/skillTrees = Object\.freeze\(([\s\S]+)\);\s*\n?\s*\}\)\(\);/);
if (!treesMatch) {
  console.error('audit-rider-handlers: could not parse skill-trees.js');
  process.exit(1);
}
const trees = JSON.parse(treesMatch[1]);

const emittedKinds = Object.create(null);
for (const row of Object.values(trees)) {
  const copy = JSON.parse(JSON.stringify(row));
  sandbox.applyAbilityTextEnrichment(copy);
  for (const r of copy.riders || []) {
    if (r.kind === 'raw') continue;
    emittedKinds[r.kind] = (emittedKinds[r.kind] || 0) + 1;
  }
}

const missingHandlers = [];
const missingDisplay = [];
const displayApi = sandbox.Avian?.systems?.abilityDisplay;
const riderSegment = displayApi?.riderSegment;

for (const kind of Object.keys(emittedKinds)) {
  if (!handlerKeys.has(kind) && !SKIP_EXEC_KINDS.has(kind)) {
    missingHandlers.push(kind);
  }
  if (riderSegment) {
    const seg = riderSegment({ kind, value: 8, when: null });
    if (!seg) missingDisplay.push(kind);
  }
}

console.log(`audit-rider-handlers: ${Object.keys(emittedKinds).length} rider kinds emitted`);
console.log(`  dispatcher handlers registered: ${handlerKeys.size}`);

if (missingHandlers.length) {
  console.error('\nMissing dispatcher handlers:');
  for (const k of missingHandlers.sort()) console.error(`  ${k} (${emittedKinds[k]}x)`);
}

if (missingDisplay.length) {
  console.error('\nMissing ability-display segments:');
  for (const k of missingDisplay.sort()) console.error(`  ${k} (${emittedKinds[k]}x)`);
}

const deferredUndocumented = [...DEFERRED_KINDS].filter((k) => emittedKinds[k] && !handlerKeys.has(k));
if (deferredUndocumented.length) {
  console.warn('\nDeferred kinds (expected alternate hook):', deferredUndocumented.join(', '));
}

const failed = missingHandlers.length + (STRICT ? missingDisplay.length : 0);
if (failed > 0) {
  console.error(`\naudit-rider-handlers: ${failed} issue(s)${STRICT ? ' (strict)' : ''}`);
  process.exit(STRICT ? 1 : 0);
}

console.log('audit-rider-handlers: OK');
process.exit(0);
