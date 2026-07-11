#!/usr/bin/env node
/**
 * Per-bird ability wiring verification.
 *   node scripts/verify-bird-abilities.mjs [--strict]
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STRICT = !process.argv.includes('--no-strict');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('verify-bird-abilities: missing js/avian-game.bundle.js — run npm run bundle');
  process.exit(1);
}

function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus: noop, blur: noop, click: noop, contains: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: { setProperty: noop, getPropertyValue: () => '', removeProperty: noop },
    dataset: {}, children: [], childNodes: [], parentNode: null, innerHTML: '', textContent: '', value: '',
  };
  function makeEl(tagName = 'div') {
    return Object.assign({}, elementProto, { tagName: String(tagName).toUpperCase(), nodeName: String(tagName).toUpperCase() });
  }
  const cache = Object.create(null);
  return {
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    createElement: (t) => makeEl(t), createElementNS: (_ns, t) => makeEl(t),
    createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }),
    getElementById: (id) => (cache[id] ||= makeEl('div')),
    querySelector: () => makeEl('div'), querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true, readyState: 'complete',
  };
}

const localStorageStub = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: () => null, get length() { return Object.keys(store).length; },
  };
})();

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Promise, JSON, Math, Date, Map, Set, Object, Array, Number, String, Boolean, Error,
  document: makeDomStub(),
  location: { hash: '', pathname: '/', href: 'http://localhost/' },
  navigator: { userAgent: 'node-verify', platform: 'node' },
  localStorage: localStorageStub, sessionStorage: localStorageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  fetch: () => Promise.reject(new Error('fetch unavailable')),
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'avian-game.bundle.js', timeout: 20000 });

const parserSandbox = vm.createContext({ console, Math, Number, Object, Array, String, JSON, globalThis: null });
parserSandbox.globalThis = parserSandbox;
for (const rel of [
  'js/data/effect-tiers.js',
  'js/data/combat-stat-magnitudes.js',
  'js/systems/ability-rider-parser.js',
  'js/systems/combat-formulas.js',
]) {
  vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), parserSandbox, { filename: rel });
}

const dispatcherSrc = readFileSync(path.join(ROOT, 'js/systems/ability-dispatcher.js'), 'utf8');
const handlerKeys = new Set();
const statBlock = dispatcherSrc.match(/makeStatRiderHandlers[\s\S]*?return \{([\s\S]*?)\};\s*\}/);
const riderBlock = dispatcherSrc.match(/var riderHandlers = \{([\s\S]*?)\};/);
if (statBlock) for (const m of statBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);
if (riderBlock) for (const m of riderBlock[1].matchAll(/(\w+):\s*function/g)) handlerKeys.add(m[1]);

const SKIP_KINDS = new Set(['refundApOnCrit', 'gainApNextTurn', 'bonusVsAilment', 'bonusVsLowHp', 'tagFlag', 'raw']);
const KNOWN_WHEN = new Set([
  null, undefined, 'onHit', 'actingFirst', 'afterMagicThisTurn', 'allHitsLanded',
  'targetHasAilment', 'targetWeakened', 'targetDelayed', 'onAilmentFail', 'onEnemyMissBeforeTurn',
  'alternatingAttackType', 'guardActive', 'guardInactive', 'shieldActive', 'shieldInactive',
]);
const KNOWN_CONDITIONS = new Set([
  'targetBleeding', 'targetBurning', 'targetWeakened', 'targetLowHp', 'targetBloodied', 'targetChilled', 'targetMarked', 'bloodied',
]);

const TAG_UTILITY = new Set(['Cleanse', 'Purge', 'Marked', 'Bloodied']);
const IGNORE_RIDER_LABELS = new Set(['None', '']);

function hasExecutableEffect(row) {
  const riders = (row.riders || []).filter((r) => r.kind !== 'raw');
  if (riders.length > 0) return true;
  if ((Number(row.lifestealPct) || 0) > 0) return true;
  if (row.ailment && (Number(row.ailmentChance) || 0) > 0) return true;
  for (const t of row.tags || []) if (TAG_UTILITY.has(t)) return true;
  return false;
}

const FED = sandbox.FAMILY_EVOLUTION_BIRD_DATA || sandbox.globalThis?.FAMILY_EVOLUTION_BIRD_DATA || {};
const trees = sandbox.Avian?.data?.combatPack?.skillTrees || {};
const templates = sandbox.ABILITY_TEMPLATES || {};
const actions = sandbox.ACTIONS || {};
const enrich = parserSandbox.applyAbilityTextEnrichment;
const enrichCombat = parserSandbox.enrichCombatRow;

const failures = [];
const birdReports = [];

for (const [birdKey, data] of Object.entries(FED)) {
  if (!data || !Array.isArray(data.slotLayout)) {
    failures.push(`${birdKey}: missing slotLayout`);
    continue;
  }
  const slots = data.slotLayout.filter((s) => s && s.abilityId);
  if (slots.length < 4) failures.push(`${birdKey}: expected 4 ability slots, got ${slots.length}`);
  let birdIssues = 0;
  for (const slot of slots) {
    const id = slot.abilityId;
    if (!trees[id]) { failures.push(`${birdKey}/${id}: missing skill-trees row`); birdIssues++; continue; }
    if (!templates[id]) { failures.push(`${birdKey}/${id}: missing ABILITY_TEMPLATES entry`); birdIssues++; continue; }
    if (typeof actions[id] !== 'function') { failures.push(`${birdKey}/${id}: ACTIONS not registered`); birdIssues++; continue; }
    const copy = JSON.parse(JSON.stringify(trees[id]));
    try {
      enrich(copy);
      enrichCombat(copy);
    } catch (e) {
      failures.push(`${birdKey}/${id}: enrich failed — ${e.message}`);
      birdIssues++;
      continue;
    }
    const rt = String(copy.riderText || '').trim();
    if (rt && !IGNORE_RIDER_LABELS.has(rt) && !hasExecutableEffect(copy)) {
      failures.push(`${birdKey}/${id}: unhooked riderText "${rt.slice(0, 60)}"`);
      birdIssues++;
    }
    for (const r of copy.riders || []) {
      if (!r || r.kind === 'raw') continue;
      if (!handlerKeys.has(r.kind) && !SKIP_KINDS.has(r.kind)) {
        failures.push(`${birdKey}/${id}: rider kind "${r.kind}" has no handler`);
        birdIssues++;
      }
      const when = r.when || null;
      if (when && !KNOWN_WHEN.has(when) && !String(when).startsWith('onAilment:')) {
        failures.push(`${birdKey}/${id}: unknown rider.when "${when}"`);
        birdIssues++;
      }
    }
    if (copy.condition && !KNOWN_CONDITIONS.has(copy.condition)) {
      failures.push(`${birdKey}/${id}: unknown condition "${copy.condition}"`);
      birdIssues++;
    }
  }
  birdReports.push({ birdKey, slots: slots.length, issues: birdIssues });
}

console.log(`verify-bird-abilities: ${Object.keys(FED).length} birds, ${failures.length} issue(s)`);
for (const r of birdReports.sort((a, b) => b.issues - a.issues).slice(0, 12)) {
  if (r.issues > 0) console.log(`  ${r.birdKey}: ${r.issues} issue(s) across ${r.slots} slots`);
}
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
}

if (STRICT && failures.length > 0) process.exit(1);
process.exit(0);
