#!/usr/bin/env node
/* Avian Ascent — run-balance harness (scaffold).
 *
 * Loads the prebuilt bundle into a Node `vm` context with a Proxy-based
 * DOM stub so all `document.*` and `window.*` calls become no-ops, then
 * invokes `Avian.debug.simulateRun` (if registered) N times to produce
 * a per-bird win-rate / median-length report.
 *
 * Status:
 *   - The DOM stub + bundle loader is functional today.
 *   - A real `Avian.debug.simulateRun(bird, opts)` implementation is
 *     scoped for the dedicated balance work after Phase 7 (status verbs)
 *     since simulating combat requires the verb registry to be live.
 *   - Until then, this script reports which symbols ARE wired up after
 *     loading the bundle, which is itself a useful smoke test.
 *
 * Usage:
 *   node scripts/run-balance.js                 # 1000 runs, all birds
 *   node scripts/run-balance.js --runs 200      # 200 runs/bird
 *   node scripts/run-balance.js --bird sparrow  # one bird only
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
const RUNS = parseInt(flag('--runs', '1000'), 10);
const BIRD = flag('--bird', null);

function makeDomStub() {
  const noopFn = () => undefined;
  const handler = {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === 'then') return undefined;
      if (typeof target[prop] !== 'undefined') return target[prop];
      const child = new Proxy(Object.assign(noopFn, { children: [] }), handler);
      target[prop] = child;
      return child;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
    apply() {
      return new Proxy(Object.assign(noopFn, { children: [] }), handler);
    },
  };
  const make = () =>
    new Proxy(
      Object.assign(function () {}, {
        addEventListener: noopFn,
        removeEventListener: noopFn,
        appendChild: noopFn,
        removeChild: noopFn,
        cloneNode: () => make(),
        querySelectorAll: () => [],
        querySelector: () => make(),
        getElementById: () => make(),
        getElementsByClassName: () => [],
        getElementsByTagName: () => [],
        createElement: () => make(),
        createTextNode: () => make(),
        getContext: () => make(),
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
        children: [],
        classList: { add: noopFn, remove: noopFn, toggle: noopFn, contains: () => false },
        style: {},
        dataset: {},
        parentNode: null,
      }),
      handler,
    );
  return make();
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
    location: { search: '', href: 'http://localhost/' },
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
    vm.runInContext(src, sandbox, { filename: 'avian-game.bundle.js', timeout: 15000 });
  } catch (err) {
    console.error('[run-balance] bundle threw at load:', err && err.message);
    process.exit(1);
  }
  return sandbox;
}

const sandbox = loadBundle();
const Avian = sandbox.Avian;

console.log('[run-balance] bundle loaded OK');
console.log('  BIRDS keys:    ' + (sandbox.BIRDS ? Object.keys(sandbox.BIRDS).length : 'n/a'));
console.log('  ENEMIES count: ' + (Array.isArray(sandbox.ENEMIES) ? sandbox.ENEMIES.length : 'n/a'));
console.log('  AILMENTS keys: ' + (sandbox.AILMENTS ? Object.keys(sandbox.AILMENTS).length : 'n/a'));
console.log('  Avian present: ' + !!Avian);

if (!Avian || typeof Avian.debug.simulateRun !== 'function') {
  console.log('');
  console.log('[run-balance] Avian.debug.simulateRun is not registered yet.');
  console.log('  This script is a scaffold; balance simulation will be wired up');
  console.log('  in the dedicated phase that follows status verbs (B.2).');
  console.log('  Bundle load itself is healthy.');
  process.exit(0);
}

const birds = BIRD ? [BIRD] : Object.keys(sandbox.BIRDS || {});
const results = {};
for (const b of birds) {
  let wins = 0;
  let stagesTotal = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = Avian.debug.simulateRun({ bird: b, seed: i });
    if (r && r.win) wins++;
    if (r && typeof r.stages === 'number') stagesTotal += r.stages;
  }
  results[b] = { runs: RUNS, winRate: (wins / RUNS).toFixed(3), avgStages: (stagesTotal / RUNS).toFixed(2) };
}
console.log(JSON.stringify(results, null, 2));
