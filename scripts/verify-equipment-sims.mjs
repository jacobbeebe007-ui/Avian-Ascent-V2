#!/usr/bin/env node
/**
 * Phase 11 — deterministic equipmentV2 duel sim snapshot.
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('[equipment-sims] missing js/avian-game.bundle.js — run npm run bundle');
  process.exit(1);
}

let failed = 0;

function fail(msg) {
  console.error('[equipment-sims] FAIL', msg);
  failed++;
}

function ok(msg) {
  console.log('[equipment-sims] ok  ', msg);
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
vm.runInContext(readFileSync(bundlePath, 'utf8'), sandbox, { filename: 'avian-game.bundle.js', timeout: 30000 });

const Avian = sandbox.Avian;

if (!Avian?.flags?.equipmentV2) fail('equipmentV2 flag should be on');
if (typeof Avian?.debug?.simulateDuel !== 'function') fail('Avian.debug.simulateDuel missing');
if (typeof Avian?.debug?.simulateRun !== 'function') fail('Avian.debug.simulateRun missing');
if (typeof Avian?.systems?.combatTelemetry?.exportJson !== 'function') fail('combatTelemetry.exportJson missing');
if (typeof Avian?.actions?.exportCombatTelemetry !== 'function') fail('exportCombatTelemetry action missing');

const SEED = 424242;
const opts = {
  attackerBirdKey: 'sparrow',
  defenderBirdKey: 'crow',
  rarity: 'grey',
  seed: SEED,
  maxTurns: 30,
};

const first = Avian.debug.simulateDuel(opts);
const second = Avian.debug.simulateDuel(opts);

if (!first || typeof first.turns !== 'number') fail('simulateDuel returned invalid result');
if (JSON.stringify(first) !== JSON.stringify(second)) {
  fail('seeded duel not deterministic');
  console.error('first ', JSON.stringify(first));
  console.error('second', JSON.stringify(second));
} else {
  ok('seeded duel deterministic (seed=' + SEED + ')');
}

const SNAPSHOT = Object.freeze({
  turns: 4,
  winner: 'attacker',
  damageDealt: 86.88,
  damageTaken: 29.16,
  seed: SEED,
});
function near(a, b, eps = 0.05) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}
if (first.turns !== SNAPSHOT.turns || first.winner !== SNAPSHOT.winner || !near(first.damageDealt, SNAPSHOT.damageDealt) || !near(first.damageTaken, SNAPSHOT.damageTaken)) {
  fail('seeded duel snapshot drift — update SNAPSHOT if intentional');
  console.error('got     ', JSON.stringify({ turns: first.turns, winner: first.winner, damageDealt: first.damageDealt, damageTaken: first.damageTaken }));
  console.error('expected', JSON.stringify(SNAPSHOT));
} else {
  ok('seeded duel snapshot matches fixture');
}

ok('turns=' + first.turns + ' winner=' + first.winner + ' dmg=' + first.damageDealt + '/' + first.damageTaken);

const run = Avian.debug.simulateRun({ bird: 'sparrow', seed: 7, duels: 2, maxTurns: 20 });
if (!run || typeof run.winRate !== 'number') fail('simulateRun invalid');
else ok('simulateRun winRate=' + run.winRate.toFixed(2));

const tel = Avian.systems.combatTelemetry.snapshot();
if (typeof tel.hits !== 'number' || typeof tel.misses !== 'number') fail('telemetry snapshot incomplete');
else ok('telemetry hits=' + tel.hits + ' misses=' + tel.misses);

if (failed) {
  console.error('[equipment-sims] ' + failed + ' failure(s)');
  process.exit(1);
}
console.log('[equipment-sims] all checks passed');
