#!/usr/bin/env node
/**
 * Verify equipment skill rider kinds have dispatcher handlers and ability-display segments.
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
  'js/systems/ability-rider-parser.js',
  'js/systems/ability-display.js',
]) {
  vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const dispatcherSrc = readFileSync(path.join(ROOT, 'js/systems/ability-dispatcher.js'), 'utf8');
const statBlock = dispatcherSrc.match(/makeStatRiderHandlers[\s\S]*?return \{([\s\S]*?)\};\s*\}/);
const riderBlock = dispatcherSrc.match(/var riderHandlers = \{([\s\S]*?)\};/);
const handlerKeys = new Set();
if (statBlock) for (const m of statBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);
if (riderBlock) for (const m of riderBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);

const SKIP_EXEC_KINDS = new Set(['refundApOnCrit', 'gainApNextTurn', 'bonusVsAilment', 'bonusVsLowHp', 'tagFlag', 'raw', 'tierStat']);
const DEFERRED_KINDS = new Set(['gainAccNextHit']);

const skillsSandbox = vm.createContext({ globalThis: {} });
skillsSandbox.globalThis = skillsSandbox;
vm.runInContext(readFileSync(path.join(ROOT, 'js/data/equipment/skills.js'), 'utf8'), skillsSandbox, { filename: 'skills.js' });
const trees = skillsSandbox.Avian?.data?.equipment?.skills || {};

const emittedKinds = Object.create(null);
for (const row of Object.values(trees)) {
  const structured = row.riders || row.protectionRiders || [];
  const copy = {
    riderText: row.riderText || '',
    riders: structured.map((r) => Object.assign({}, r)),
  };
  sandbox.applyAbilityTextEnrichment(copy);
  for (const r of copy.riders || []) {
    if (!r || !r.kind || r.kind === 'raw') continue;
    emittedKinds[r.kind] = (emittedKinds[r.kind] || 0) + 1;
  }
}

const missingHandlers = [];
const missingDisplay = [];
const displayApi = sandbox.Avian?.systems?.abilityDisplay;
const riderSegment = displayApi?.riderSegment;

for (const kind of Object.keys(emittedKinds)) {
  if (!handlerKeys.has(kind) && !SKIP_EXEC_KINDS.has(kind) && !DEFERRED_KINDS.has(kind)) missingHandlers.push(kind);
  if (riderSegment && kind !== 'tierStat') {
    const seg = riderSegment({ kind, value: 8, when: null, armour: 5, magicArmour: 7 });
    if (!seg) missingDisplay.push(kind);
  }
}

console.log(`audit-rider-handlers: ${Object.keys(emittedKinds).length} rider kinds from equipment skills`);
if (missingHandlers.length) console.log('missing handlers:', missingHandlers);
if (missingDisplay.length) console.log('missing display:', missingDisplay);
if (STRICT && (missingHandlers.length || missingDisplay.length)) process.exit(1);
process.exit(0);
