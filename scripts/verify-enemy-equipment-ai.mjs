#!/usr/bin/env node
/**
 * Phase 8 — enemy reference loadouts + equipment AI action selection (equipmentV2 on).
 */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const bundlePath = path.join(ROOT, 'js/avian-game.bundle.js');

if (!existsSync(bundlePath)) {
  console.error('[enemy-equipment-ai] missing js/avian-game.bundle.js — run npm run bundle');
  process.exit(1);
}

let failed = 0;

function fail(msg) {
  console.error('[enemy-equipment-ai] FAIL', msg);
  failed++;
}

function ok(msg) {
  console.log('[enemy-equipment-ai] ok  ', msg);
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
const equipment = Avian?.equipment;
const skills = Avian?.data?.equipment?.skills || {};
const BASIC_IDS = new Set(['BASIC_PHYSICAL', 'BASIC_MAGIC']);

if (!Avian?.flags?.equipmentV2) fail('equipmentV2 flag should be on');
if (typeof equipment?.assignEnemyEquipmentLoadout !== 'function') fail('missing assignEnemyEquipmentLoadout');
if (typeof sandbox.buildEnemyActionPool !== 'function') fail('missing buildEnemyActionPool');
if (typeof sandbox.planEnemyTurn !== 'function') fail('missing planEnemyTurn');

function makeEnemy(classId, rarity, extra = {}) {
  return {
    id: `test-${classId}-${rarity}`,
    name: `Test ${classId}`,
    enemyClass: classId,
    class: classId,
    birdKey: 'sparrow',
    stats: {
      hp: 80, maxHp: 80, atk: 14, def: 10, matk: 8, mdef: 8, spd: 10, acc: 80, dodge: 5, critChance: 5,
    },
    hp: 80,
    maxHp: 80,
    energy: 6,
    energyMax: 6,
    ...extra,
  };
}

function abilityResolves(ab) {
  if (!ab || ab.empty) return { ok: true, reason: 'empty slot' };
  const id = String(ab.id || '');
  if (!id || id.startsWith('__empty_')) return { ok: false, reason: 'placeholder id' };
  if (BASIC_IDS.has(id)) return { ok: true, reason: 'basic attack' };
  if (id.startsWith('innate_')) return { ok: true, reason: 'innate utility' };
  if (skills[id]) return { ok: true, reason: 'equipment skill' };
  return { ok: false, reason: 'missing skill catalog entry' };
}

const classes = ['knight', 'rogue', 'mage', 'siren', 'inquisitor', 'bard', 'brute'];
const rarities = ['grey', 'blue', 'gold'];

for (const cls of classes) {
  for (const rarity of rarities) {
    const enemy = makeEnemy(cls, rarity);
    equipment.assignEnemyEquipmentLoadout(enemy, { rarity, variance: false, seed: 9001 });
    const abs = enemy.abilities || [];
    if (abs.length !== 6) fail(`${cls}/${rarity}: expected 6 action sources, got ${abs.length}`);
    for (const ab of abs) {
      if (ab?.empty) continue;
      const res = abilityResolves(ab);
      if (!res.ok) fail(`${cls}/${rarity}: action ${ab.id} unresolved (${res.reason})`);
    }
    ok(`${cls}/${rarity}: non-empty actions resolve`);
  }
}

const knightGreyExpected = {
  helmet: 'EQ-HP-GRY',
  armour: 'EQ-AM-GRY',
  mainHand: 'EQ-LN-GRY',
  offHand: null,
  shield: 'EQ-SM-GRY',
  ankletL: 'EQ-AI-GRY',
  ankletR: 'EQ-AI-GRY',
  necklace: 'EQ-NH-GRY',
};

const knightEnemy = makeEnemy('knight', 'grey', { id: 'snapshot-knight-grey', birdKey: 'crow' });
equipment.assignEnemyEquipmentLoadout(knightEnemy, { rarity: 'grey', variance: false, seed: 4242 });
const eq = knightEnemy.equipment || {};
for (const slot of Object.keys(knightGreyExpected)) {
  if (eq[slot] !== knightGreyExpected[slot]) {
    fail(`knight grey snapshot slot ${slot}: expected ${knightGreyExpected[slot]}, got ${eq[slot]}`);
  }
}
if (!failed) ok('knight grey deterministic loadout snapshot');

sandbox.G = {
  stage: 10,
  difficulty: 'juvenile',
  turn: 'enemy',
  enemyTurnCount: 1,
  playerStatus: {},
  enemyStatus: {},
  abilityCooldowns: {},
};

const lethalEnemy = makeEnemy('rogue', 'blue');
equipment.assignEnemyEquipmentLoadout(lethalEnemy, { rarity: 'blue', variance: false, seed: 77 });
lethalEnemy.energy = lethalEnemy.energyMax || 6;
sandbox.G.enemy = lethalEnemy;

const player = {
  stats: { hp: 1, maxHp: 100, def: 0, mdef: 0, dodge: 0, acc: 80 },
};
const mode = sandbox.getEnemyMode(lethalEnemy, player);
if (mode !== 'EXECUTE') fail(`expected EXECUTE mode for low-HP player, got ${mode}`);
else ok('EXECUTE mode when player HP is low');

const pool = sandbox.buildEnemyActionPool(lethalEnemy, mode);
const emptyPicked = pool.some((a) => {
  const ab = (lethalEnemy.abilities || []).find((x) => x && x.id === a.abilityId);
  return ab?.empty || String(a.abilityId || '').startsWith('__empty_');
});
if (emptyPicked) fail('buildEnemyActionPool included an empty slot action');
else ok('empty slots never enter action pool');

const hasDamage = pool.some((a) => sandbox.classifyEnemyActionCategory(a, lethalEnemy) === 'damage');
if (!hasDamage) fail('EXECUTE pool has no damaging actions for rogue/blue loadout');
else ok('EXECUTE pool includes damaging actions');

const plan = sandbox.planEnemyTurn(lethalEnemy, player);
const pickedEmpty = (plan.actions || []).some((a) => {
  const ab = (lethalEnemy.abilities || []).find((x) => x && x.id === a.abilityId);
  return ab?.empty || String(a.abilityId || '').startsWith('__empty_');
});
if (pickedEmpty) fail('planEnemyTurn selected an empty slot');
else ok('planEnemyTurn never selects empty slots');

const pickedDamage = (plan.actions || []).some((a) => sandbox.classifyEnemyActionCategory(a, lethalEnemy) === 'damage');
if (!pickedDamage) fail('planEnemyTurn did not pick a damaging action against lethal target');
else ok('planEnemyTurn picks damaging action when target is lethal');

function countFilled(eq) {
  return Object.values(eq || {}).filter(Boolean).length;
}

function raritiesOf(eq) {
  const cat = sandbox.Avian.data.equipment.items;
  return Object.values(eq || {}).filter(Boolean).map((id) => String(cat[id]?.rarity || '').toLowerCase());
}

function assertStoryStage(stage, expect) {
  const enemy = makeEnemy('rogue', 'grey', { id: `story-stage-${stage}`, birdKey: 'sparrow' });
  equipment.assignEnemyEquipmentLoadout(enemy, { stage, variance: false, seed: 1000 + stage });
  const filled = countFilled(enemy.equipment);
  const rares = raritiesOf(enemy.equipment);
  if (expect.count === 0) {
    if (filled !== 0) fail(`stage ${stage}: expected empty kit, got ${filled}`);
    else ok(`stage ${stage}: empty kit`);
    return;
  }
  if (filled !== expect.count && !(expect.minCount != null && filled >= expect.minCount && filled <= expect.count)) {
    fail(`stage ${stage}: expected ${expect.count} pieces, got ${filled} [${rares.join(',')}]`);
    return;
  }
  if (expect.only) {
    if (!rares.every((r) => expect.only.includes(r))) {
      fail(`stage ${stage}: expected only ${expect.only}, got ${rares.join(',')}`);
      return;
    }
  }
  if (expect.require) {
    for (const rar of expect.require) {
      if (!rares.includes(rar)) {
        fail(`stage ${stage}: missing required rarity ${rar} in ${rares.join(',')}`);
        return;
      }
    }
  }
  if (expect.minOf) {
    for (const [rar, n] of Object.entries(expect.minOf)) {
      const got = rares.filter((r) => r === rar).length;
      if (got < n) {
        fail(`stage ${stage}: expected >=${n} ${rar}, got ${got}`);
        return;
      }
    }
  }
  ok(`stage ${stage}: ${filled} pieces (${[...new Set(rares)].join('+') || 'none'})`);
}

assertStoryStage(2, { count: 0 });
assertStoryStage(5, { count: 4, only: ['grey'] });
assertStoryStage(8, { count: 4, only: ['grey', 'green'], require: ['grey', 'green'] });
assertStoryStage(10, { count: 6, only: ['grey', 'green', 'blue'], minOf: { blue: 1 } });
assertStoryStage(12, { count: 5, only: ['green', 'blue'], require: ['green', 'blue'] });
assertStoryStage(15, { count: 7, only: ['blue'] });
assertStoryStage(18, { count: 8, only: ['purple', 'blue'], minOf: { purple: 3, blue: 5 } });
assertStoryStage(20, { count: 8, only: ['purple'] });

const explicitRarity = makeEnemy('rogue', 'blue', { id: 'explicit-rarity-no-stage' });
equipment.assignEnemyEquipmentLoadout(explicitRarity, { rarity: 'blue', variance: false, seed: 55 });
if (countFilled(explicitRarity.equipment) < 7) {
  fail('explicit rarity path should still roll full reference kit');
} else ok('explicit rarity path ignores story recipe when stage omitted');

if (failed) {
  console.error(`\n[enemy-equipment-ai] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[enemy-equipment-ai] all checks passed');
