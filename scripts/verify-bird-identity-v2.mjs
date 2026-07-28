#!/usr/bin/env node
/**
 * v0.3 bird identity verification (equipmentV2 on).
 *   node scripts/verify-bird-identity-v2.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('verify-bird-identity-v2: missing js/avian-game.bundle.js — run npm run bundle');
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
  URLSearchParams,
  document: makeDomStub(),
  location: { hash: '', pathname: '/', href: 'http://localhost/?equipmentV2=1', search: '?equipmentV2=1' },
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

const Avian = sandbox.Avian;
const birdsV2 = Avian?.data?.birdsV2 || {};
const passivesV2 = Avian?.data?.combatPack?.birdPassives || {};
const utilities = Avian?.data?.combatPack?.innateUtilities || {};
const classes = Avian?.data?.combatPack?.classes || {};
const BIRDS = sandbox.BIRDS || {};

const failures = [];
const keys = Object.keys(birdsV2);

if (keys.length !== 52) failures.push(`expected 52 birds in birdsV2, got ${keys.length}`);
if (!Avian?.flags?.equipmentV2) failures.push('equipmentV2 flag should be on when loaded with ?equipmentV2=1');

for (const key of keys) {
  const bird = birdsV2[key];
  const passive = passivesV2[key];
  const utility = utilities[key];
  const cls = classes[String(bird?.class || '').toLowerCase()];

  if (!passive) failures.push(`${key}: missing birdPassives entry`);
  if (!utility) failures.push(`${key}: missing innateUtilities entry`);
  if (!cls?.classPerk) failures.push(`${key}: class ${bird?.class} missing classPerk in classes`);

  const minAcc = Number(cls?.minAcc) || 0;
  const acc = Number(bird?.stats?.acc) || 0;
  if (minAcc > 0 && acc < minAcc) failures.push(`${key}: acc ${acc} below class minAcc ${minAcc}`);

  const patched = BIRDS[key];
  if (patched && bird?.stats) {
    for (const statKey of ['hp', 'maxHp', 'atk', 'def', 'matk', 'mdef', 'spd', 'dodge', 'acc', 'critChance']) {
      const expected = bird.stats[statKey];
      const actual = patched.stats?.[statKey];
      if (expected != null && actual != null && Math.abs(Number(expected) - Number(actual)) > 0.001) {
        failures.push(`${key}: BIRDS.stats.${statKey}=${actual} != birdsV2 ${expected}`);
      }
    }
  }
}

const duke = birdsV2.dukeBlakiston;
if (!duke?.bossOverride) failures.push('dukeBlakiston: bossOverride missing');
if (duke) {
  /* v0.9: baseHealth 20 × (1 + vitality 5 × 0.05) → maxHp 25; Agility 2 → Dodge 1.
   * Bird Precision System: Duke Base Precision 86 (Boss Override, not 0). */
  const expected = {
    hp: 25, maxHp: 25, atk: 4, dex: 2, def: 4, matk: 12, mdef: 5, spd: 2, dodge: 1, acc: 86, critChance: 10,
  };
  if (Number(duke.baseHealth) !== 20) failures.push(`dukeBlakiston: baseHealth=${duke.baseHealth} expected 20`);
  if (Number(duke.vitality) !== 5) failures.push(`dukeBlakiston: vitality=${duke.vitality} expected 5`);
  for (const [k, v] of Object.entries(expected)) {
    if (Number(duke.stats?.[k]) !== v) failures.push(`dukeBlakiston: stats.${k}=${duke.stats?.[k]} expected ${v}`);
  }
  const dukePassive = passivesV2.dukeBlakiston;
  const dukeClass = classes.duke;
  if (dukePassive?.name !== 'Nightfall Sovereignty') failures.push('dukeBlakiston passive should be Nightfall Sovereignty');
  if (dukeClass?.classPerk !== 'Duke Ascension') failures.push('duke class perk should be Duke Ascension');
  if (BIRDS.dukeBlakiston?.passive?.name === 'Duke Ascension') failures.push('duke passive must not duplicate Duke Ascension class perk');
}

for (const helper of ['getBirdV2', 'getClassV2', 'getBirdPassiveV2', 'getInnateUtility', 'getBirdDef']) {
  if (typeof Avian?.[helper] !== 'function') failures.push(`missing Avian.${helper} helper`);
}

console.log(`verify-bird-identity-v2: ${keys.length} birds, ${failures.length} issue(s)`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
  process.exit(1);
}
process.exit(0);
