#!/usr/bin/env node
/* Avian Ascent — equipmentV2 balance matrix (Phase 11).
 *
 * Loads the prebuilt bundle into a Node `vm` context with a Proxy-based
 * DOM stub, forces equipmentV2 on, and runs a small class × rarity duel matrix
 * via `Avian.debug.simulateDuel`.
 *
 * Usage:
 *   node scripts/run-balance.js
 *   node scripts/run-balance.js --mode duels --seed 100
 *   node scripts/run-balance.js --mode runs --bird sparrow --runs 50
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BUNDLE = path.join(ROOT, 'js', 'avian-game.bundle.js');

if (!fs.existsSync(BUNDLE)) {
  console.error('[run-balance] bundle missing — run `node scripts/build-bundle.js` first.');
  process.exit(1);
}

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const MODE = flag('--mode', 'matrix');
const RUNS = parseInt(flag('--runs', '50'), 10);
const BIRD = flag('--bird', null);
const SEED = parseInt(flag('--seed', '9001'), 10);

/** One starter/representative bird per v0.3 class. */
const CLASS_BIRDS = Object.freeze({
  knight: 'crow',
  rogue: 'sparrow',
  mage: 'blackbird',
  bard: 'macaw',
  siren: 'bowerbird',
  inquisitor: 'bluejay',
  brute: 'goose',
});

const MATRIX_RARITIES = ['grey', 'purple'];

function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    remove: noop,
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

function loadBundle() {
  const src = fs.readFileSync(BUNDLE, 'utf8');
  const noop = () => undefined;
  const sandbox = {
    console: console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    document: makeDomStub(),
    window: undefined,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: clearTimeout,
    location: { search: '?equipmentV2=1', href: 'http://localhost/?equipmentV2=1' },
    localStorage: {
      _data: Object.create(null),
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = Object.create(null); },
    },
    navigator: { userAgent: 'Node-Balance-Sim' },
    fetch: () => Promise.reject(new Error('fetch unavailable in sim')),
    URL,
    URLSearchParams,
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  try {
    vm.runInContext(src, sandbox, { filename: 'avian-game.bundle.js', timeout: 30000 });
  } catch (err) {
    console.error('[run-balance] bundle threw at load:', err && err.message);
    process.exit(1);
  }
  return sandbox;
}

const sandbox = loadBundle();
const Avian = sandbox.Avian;

console.log('[run-balance] bundle loaded OK (equipmentV2=' + !!(Avian && Avian.flags && Avian.flags.equipmentV2) + ')');

if (!Avian || typeof Avian.debug.simulateDuel !== 'function') {
  console.error('[run-balance] Avian.debug.simulateDuel is not registered.');
  process.exit(1);
}

Avian.flags.equipmentV2 = true;

if (MODE === 'runs') {
  if (typeof Avian.debug.simulateRun !== 'function') {
    console.error('[run-balance] Avian.debug.simulateRun is not registered.');
    process.exit(1);
  }
  const birds = BIRD ? [BIRD] : Object.keys(sandbox.BIRDS || {});
  const results = {};
  for (const b of birds) {
    let wins = 0;
    let stagesTotal = 0;
    for (let i = 0; i < RUNS; i++) {
      const r = Avian.debug.simulateRun({ bird: b, seed: SEED + i, duels: 1, maxTurns: 30 });
      if (r && r.win) wins++;
      if (r && typeof r.avgTurns === 'number') stagesTotal += r.avgTurns;
    }
    results[b] = { runs: RUNS, winRate: (wins / RUNS).toFixed(3), avgTurns: (stagesTotal / RUNS).toFixed(2) };
  }
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

/** Default: class bird × grey/purple mirror duels (attacker grey vs defender purple). */
const summary = [];
let pacingWarnings = 0;

for (const [cls, bird] of Object.entries(CLASS_BIRDS)) {
  for (const rarity of MATRIX_RARITIES) {
    const duelSeed = SEED + summary.length;
    const attackerRarity = rarity;
    const defenderRarity = rarity === 'grey' ? 'purple' : 'grey';
    const r = Avian.debug.simulateDuel({
      attackerBirdKey: bird,
      defenderBirdKey: bird,
      attackerRarity,
      defenderRarity,
      seed: duelSeed,
      maxTurns: 30,
    });
    if (r && r.pacingWarning) pacingWarnings++;
    summary.push({
      class: cls,
      bird,
      attackerRarity,
      defenderRarity,
      seed: duelSeed,
      turns: r.turns,
      winner: r.winner,
      damageDealt: r.damageDealt,
      damageTaken: r.damageTaken,
      actionsUsed: r.actionsUsed,
      pacingWarning: r.pacingWarning || null,
    });
  }
}

const avgTurns = summary.reduce((s, r) => s + r.turns, 0) / Math.max(1, summary.length);
console.log('[run-balance] matrix duels=' + summary.length + ' avgTurns=' + avgTurns.toFixed(2) + ' pacingWarnings=' + pacingWarnings);
console.log(JSON.stringify({ avgTurns: +avgTurns.toFixed(2), pacingWarnings, rows: summary }, null, 2));
