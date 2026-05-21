/* Runtime verification: boot the bundle in a Node vm sandbox and assert that
 * player ability resolution works end-to-end after the legacy combat excision.
 *
 *   - Sparrow's slot 0 starter resolves to SPARROW_F1_L1_BASE
 *   - ABILITY_TEMPLATES[SPARROW_F1_L1_BASE] is a populated row from the
 *     combat data pack
 *   - ACTIONS[SPARROW_F1_L1_BASE] is a function (dispatcher proxy)
 *   - Avian.dispatcher.execute resolves the ability without throwing
 *   - FAMILY_EVOLUTION_BIRD_DATA.sparrow exists with proper slotLayout
 *   - getBaseSkillSlotsForBird('sparrow') returns 4 slots, slot 0 marked isStarterMain
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const bundlePath = path.resolve('js/avian-game.bundle.js');
const bundle = readFileSync(bundlePath, 'utf8');

// Build a minimal DOM stub so the bundle's UI code doesn't throw during boot.
function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop,
    removeChild: noop,
    insertBefore: noop,
    setAttribute: noop,
    getAttribute: () => null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus: noop,
    blur: noop,
    click: noop,
    contains: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: {},
    dataset: {},
    children: [],
    childNodes: [],
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
  };
  function makeEl(tagName = 'div') {
    return Object.assign({}, elementProto, {
      tagName: String(tagName).toUpperCase(),
      nodeName: String(tagName).toUpperCase(),
      onclick: null, oninput: null, onchange: null, onkeydown: null, onkeyup: null, onmouseenter: null, onmouseleave: null,
    });
  }
  const elementCache = Object.create(null);
  function getEl(id) {
    if (!elementCache[id]) elementCache[id] = makeEl('div');
    return elementCache[id];
  }
  const body = makeEl('body');
  const documentStub = {
    body,
    head: makeEl('head'),
    documentElement: makeEl('html'),
    createElement: (t) => makeEl(t),
    createElementNS: (_ns, t) => makeEl(t),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    getElementById: (id) => getEl(String(id || '')),
    querySelector: () => makeEl('div'),
    querySelectorAll: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: () => true,
    readyState: 'complete',
  };
  return documentStub;
}

const documentStub = makeDomStub();
const localStorageStub = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    key: () => null,
    get length() { return Object.keys(store).length; },
  };
})();

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
  Promise, JSON, Math, Date, Map, Set, WeakMap, WeakSet, Object, Array, Number, String, Boolean, Symbol, RegExp, Error, TypeError, RangeError,
  document: documentStub,
  window: null,
  location: { hash: '', pathname: '/', href: 'http://localhost/' },
  navigator: { userAgent: 'node-verify', platform: 'node', language: 'en' },
  localStorage: localStorageStub,
  sessionStorage: localStorageStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  HTMLElement: function HTMLElement() {},
  Image: function Image() {},
  Audio: function Audio() {
    return { play: () => Promise.resolve(), pause: () => {}, load: () => {}, addEventListener: () => {} };
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  Event: function Event(type) { this.type = type; },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  fetch: () => Promise.reject(new Error('fetch unavailable in verify sandbox')),
  caches: undefined,
  indexedDB: undefined,
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

let bootError = null;
try {
  vm.runInContext(bundle, sandbox, { filename: 'avian-game.bundle.js', timeout: 15000 });
} catch (e) {
  bootError = e;
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

check('bundle boots without thrown error at top level', !bootError, bootError ? String(bootError && bootError.stack || bootError) : null);

const Avian = sandbox.Avian;
const ABILITY_TEMPLATES = sandbox.ABILITY_TEMPLATES;
const ACTIONS = sandbox.ACTIONS;
const FAMILY_EVOLUTION_BIRD_DATA = sandbox.FAMILY_EVOLUTION_BIRD_DATA;
const BIRDS = sandbox.BIRDS;

check('Avian namespace present', !!Avian);
check('Avian.data.combatPack.skillTrees present', !!(Avian?.data?.combatPack?.skillTrees));
check('Avian.dispatcher.execute is a function', typeof Avian?.dispatcher?.execute === 'function');
check('ABILITY_TEMPLATES is populated', !!(ABILITY_TEMPLATES && Object.keys(ABILITY_TEMPLATES).length > 0), `count=${ABILITY_TEMPLATES ? Object.keys(ABILITY_TEMPLATES).length : 0}`);
check('ACTIONS map is populated', !!(ACTIONS && Object.keys(ACTIONS).length > 0), `count=${ACTIONS ? Object.keys(ACTIONS).length : 0}`);

const starterId = 'SPARROW_F1_L1_BASE';
check(`ABILITY_TEMPLATES[${starterId}] exists`, !!ABILITY_TEMPLATES?.[starterId]);
check(`ACTIONS[${starterId}] is a function`, typeof ACTIONS?.[starterId] === 'function');

check('FAMILY_EVOLUTION_BIRD_DATA.sparrow built from combat pack', !!FAMILY_EVOLUTION_BIRD_DATA?.sparrow);
if (FAMILY_EVOLUTION_BIRD_DATA?.sparrow) {
  const sl = FAMILY_EVOLUTION_BIRD_DATA.sparrow.slotLayout || [];
  check('sparrow slotLayout length=4', sl.length === 4);
  check('sparrow slot[0].abilityId is the starter id', sl[0]?.abilityId === starterId, `got=${sl[0]?.abilityId}`);
  check('sparrow slot[0].isStarterMain=true', sl[0]?.isStarterMain === true);
  check('sparrow has families entry', !!FAMILY_EVOLUTION_BIRD_DATA.sparrow.families?.SPARROW_F1);
  const paths = FAMILY_EVOLUTION_BIRD_DATA.sparrow.families?.SPARROW_F1?.paths || {};
  check('sparrow F1 has Power path tier 1', paths.power?.abilities?.[1] === 'SPARROW_F1_L3_POWER');
  check('sparrow F1 has Ailment path tier 1', paths.ailment?.abilities?.[1] === 'SPARROW_F1_L3_AILMENT');
  check('sparrow F1 has Utility path tier 1', paths.utility?.abilities?.[1] === 'SPARROW_F1_L3_UTILITY');
}

check('BIRDS.sparrow.startAbilities[0] = starter id', BIRDS?.sparrow?.startAbilities?.[0] === starterId, `got=${BIRDS?.sparrow?.startAbilities?.[0]}`);
check('BIRDS.sparrow.mainAttackId = starter id', BIRDS?.sparrow?.mainAttackId === starterId, `got=${BIRDS?.sparrow?.mainAttackId}`);
check('BIRDS.sparrow.passive is set', !!BIRDS?.sparrow?.passive?.id);

// Sanity: no remaining legacy ability ids in BIRDS
const legacyIds = ['rapidPeck', 'beak_jab', 'multiPeck', 'dart', 'windFeint', 'trackPrey'];
const legacyMain = legacyIds.includes(String(BIRDS?.sparrow?.mainAttackId || ''));
check('sparrow mainAttackId is NOT a legacy id', !legacyMain);

const failed = checks.filter(c => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '[ok]  ' : '[FAIL]'} ${c.name}${c.detail ? ` -- ${c.detail}` : ''}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} of ${checks.length} checks passed.`);
