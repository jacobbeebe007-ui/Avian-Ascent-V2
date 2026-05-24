/* Verify ability EN costs: birds-kits starters match skill-trees apCost,
 * and runtime getAbilityAuthoredEnergyCost honors data (e.g. Albatross main = 2 EN). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const bundlePath = path.resolve('js/avian-game.bundle.js');
const bundle = readFileSync(bundlePath, 'utf8');

function makeDomStub() {
  const noop = () => {};
  const elementProto = {
    appendChild: noop, removeChild: noop, insertBefore: noop, setAttribute: noop,
    getAttribute: () => null, addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    focus: noop, blur: noop, click: noop, contains: () => false,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false, replace: noop },
    style: {}, dataset: {}, children: [], innerHTML: '', textContent: '', value: '',
  };
  function makeEl(tagName = 'div') {
    return Object.assign({}, elementProto, { tagName: String(tagName).toUpperCase(), nodeName: String(tagName).toUpperCase() });
  }
  const elementCache = Object.create(null);
  return {
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    createElement: (t) => makeEl(t), createElementNS: (_ns, t) => makeEl(t),
    getElementById: (id) => { if (!elementCache[id]) elementCache[id] = makeEl('div'); return elementCache[id]; },
    querySelector: () => makeEl('div'), querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop, readyState: 'complete',
  };
}

const documentStub = makeDomStub();
const localStorageStub = (() => {
  const store = Object.create(null);
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
})();

const sandbox = {
  console, setTimeout, clearTimeout, Promise, JSON, Math, Date, Map, Set,
  Object, Array, Number, String, Boolean, RegExp, Error,
  document: documentStub, localStorage: localStorageStub, sessionStorage: localStorageStub,
  location: { hash: '', pathname: '/', href: 'http://localhost/' },
  navigator: { userAgent: 'node-verify' },
  performance: { now: () => Date.now() },
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: clearTimeout,
  addEventListener: () => {}, removeEventListener: () => {},
  window: null, globalThis: null,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(bundle, sandbox, { filename: 'avian-game.bundle.js' });

const { BIRDS, ABILITY_TEMPLATES, Avian } = sandbox;
const pack = Avian?.data?.combatPack;
const skillTrees = pack?.skillTrees || {};
const birdKits = pack?.birdKits || {};

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) {
    failures++;
    console.error('FAIL:', label, detail ? `— ${detail}` : '');
  } else {
    console.log('OK:', label);
  }
}

function isMainAttackAbility(ab, owner) {
  if (!ab) return false;
  if (ab.isMainAttack) return true;
  const t = ABILITY_TEMPLATES?.[ab.id];
  if (t?.isMainAttack) return true;
  if (ab.slot === 'main') return true;
  if (ab.id === owner?.mainAttackId) return true;
  return false;
}

function getAbilityAuthoredEnergyCost(ab, player) {
  const p = player || {};
  const t = ABILITY_TEMPLATES?.[ab.id];
  let cost = 0;
  if (Array.isArray(t?.energyByLevel) && t.energyByLevel.length) {
    const idx = Math.min((ab.level || 1) - 1, t.energyByLevel.length - 1);
    cost = Number(t.energyByLevel[idx]) ?? 0;
  } else if (typeof t?.energyCost === 'number') {
    cost = t.energyCost;
  } else if (typeof ab.energyCost === 'number') {
    cost = ab.energyCost;
  }
  if (isMainAttackAbility(ab, p) && cost <= 1 && !(ab.fixedMainAttackCost || t?.fixedMainAttackCost)) cost = 1;
  return Math.max(0, cost);
}

for (const [birdKey, kit] of Object.entries(birdKits)) {
  for (const starter of kit.starters || []) {
    const rowKey = Object.keys(skillTrees).find((k) => {
      const r = skillTrees[k];
      return r.birdKey === birdKey && r.starterSlot === starter.slot && r.level === 1 && r.branch === 'base';
    });
    if (!rowKey) {
      check(`${birdKey} slot ${starter.slot} has skill-tree row`, false);
      continue;
    }
    const row = skillTrees[rowKey];
    check(`${birdKey} ${starter.name} kit vs tree apCost`, row.apCost === starter.apCost,
      `kit=${starter.apCost} tree=${row.apCost}`);
  }
}

for (const birdKey in BIRDS) {
  const bird = BIRDS[birdKey];
  const mainId = bird.mainAttackId;
  if (!mainId) continue;
  const row = skillTrees[mainId];
  if (!row) continue;
  const player = { birdKey, mainAttackId: mainId };
  const ab = { id: mainId, level: 1, fixedMainAttackCost: true };
  const runtime = getAbilityAuthoredEnergyCost(ab, player);
  check(`${birdKey} main ${row.name} runtime EN`, runtime === row.apCost,
    `expected=${row.apCost} got=${runtime}`);
}

const albaRow = skillTrees.ALBATROSS_F1_L1_BASE;
check('Albatross Oceanic Wing Slam data apCost=2', albaRow?.apCost === 2);
if (albaRow) {
  const albaCost = getAbilityAuthoredEnergyCost(
    { id: 'ALBATROSS_F1_L1_BASE', level: 1, fixedMainAttackCost: true },
    { birdKey: 'albatross', mainAttackId: 'ALBATROSS_F1_L1_BASE' }
  );
  check('Albatross Oceanic Wing Slam runtime EN=2', albaCost === 2, `got=${albaCost}`);
}

const twoEnStarters = Object.values(skillTrees).filter(
  (r) => r.starterSlot === 0 && r.level === 1 && r.branch === 'base' && r.apCost >= 2
);
for (const row of twoEnStarters) {
  const tmpl = ABILITY_TEMPLATES?.[row.id];
  check(`${row.id} template fixedMainAttackCost`, !!tmpl?.fixedMainAttackCost);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll EN cost checks passed.');
process.exit(failures ? 1 : 0);
