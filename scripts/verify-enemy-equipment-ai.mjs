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
  helmet: 'HLM-001',
  armour: 'ARM-001',
  mainHand: 'WPN-073',
  offHand: null, /* 2H Greatblade clears offHand (including Shields) */
  ankletL: 'ACC-001',
  ankletR: 'ACC-001',
  necklace: 'ACC-025',
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
    /* v1.3: empty story recipes still receive the class Basic starting weapon. */
    if (filled !== 1 || enemy.equipment.mainHand !== 'WPN-B04') {
      fail(`stage ${stage}: expected Basic starter only, got ${filled} main=${enemy.equipment.mainHand}`);
    } else ok(`stage ${stage}: Basic starting weapon only`);
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
assertStoryStage(18, { count: 7, only: ['purple', 'blue'], minOf: { purple: 3, blue: 4 } });
assertStoryStage(20, { count: 7, only: ['gold', 'orange', 'purple'], minOf: { gold: 4, orange: 2, purple: 1 } });

/* Class starter + basic attack must match player counterparts. */
{
  const starters = Avian.data?.equipment?.startingWeapons?.byClass || {};
  const items = Avian.data?.equipment?.items || {};
  const actions = Avian.equipmentActions;
  for (const cls of classes) {
    const expectedId = starters[cls];
    if (!expectedId) {
      fail(`missing starting weapon map for ${cls}`);
      continue;
    }
    const expectedName = items[expectedId]?.name;
    const player = {
      birdKey: 'sparrow',
      class: cls,
      equipment: equipment.createEmptyLoadout(),
      equipmentInventory: [],
      stats: { hp: 40, maxHp: 40, atk: 8, def: 6, matk: 6, mdef: 6, spd: 10, acc: 80, dodge: 5 },
    };
    equipment.ensurePlayerEquipmentState(player);
    actions.syncEntityAbilities(player);
    const enemy = makeEnemy(cls, 'grey', { id: `parity-${cls}`, birdKey: undefined });
    delete enemy.birdKey;
    equipment.assignEnemyEquipmentLoadout(enemy, { stage: 1, variance: false, seed: 7 });
    if (enemy.equipment.mainHand !== expectedId || player.equipment.mainHand !== expectedId) {
      fail(`${cls}: starter mismatch player=${player.equipment.mainHand} enemy=${enemy.equipment.mainHand} expected=${expectedId}`);
    } else if ((player.abilities?.[0]?.name || '') !== expectedName || (enemy.abilities?.[0]?.name || '') !== expectedName) {
      fail(`${cls}: basic name mismatch player=${player.abilities?.[0]?.name} enemy=${enemy.abilities?.[0]?.name} expected=${expectedName}`);
    } else {
      ok(`${cls}: enemy starter + basic matches player (${expectedId} / ${expectedName})`);
    }
  }
}

/* Encounter preview must surface the class Basic starter (stages 1–3 empty bag). */
{
  sandbox.G = { stage: 2, endlessMode: false, player: { birdKey: 'sparrow', class: 'rogue' } };
  const previewEnemy = makeEnemy('mage', 'grey', {
    id: 'preview-mage',
    birdKey: 'barnowl',
    class: 'mage',
    enemyClass: 'mage',
    abilities: [],
  });
  delete previewEnemy.equipment;
  const state = typeof sandbox.ensureEnemyPreviewEquipmentState === 'function'
    ? sandbox.ensureEnemyPreviewEquipmentState(previewEnemy)
    : null;
  if (!state || state.equipment?.mainHand !== 'WPN-B01') {
    fail(`preview mage starter expected WPN-B01, got ${state?.equipment?.mainHand}`);
  } else if (!state.abilities?.some((a) => a && !a.empty && String(a.name).includes('Tail Wand'))) {
    fail(`preview mage basic expected Tail Wand, got ${(state.abilities || []).map((a) => a?.name).join(',')}`);
  } else {
    ok('preview loadout grants Tail Wand starter + basic for mage');
  }
  const html = typeof sandbox.buildEncounterPreviewEquipmentHtml === 'function'
    ? sandbox.buildEncounterPreviewEquipmentHtml(previewEnemy)
    : '';
  if (!/Tail Wand/.test(html)) fail('preview equipment HTML missing Tail Wand');
  else ok('preview equipment HTML lists Tail Wand');
  const names = typeof sandbox.getEnemyPreviewSkillNames === 'function'
    ? sandbox.getEnemyPreviewSkillNames(previewEnemy)
    : [];
  if (!names.some((n) => /Tail Wand/i.test(String(n)))) fail(`preview skill names missing Tail Wand: ${names.join(',')}`);
  else ok('preview skill names include Tail Wand');
}

const explicitRarity = makeEnemy('rogue', 'blue', { id: 'explicit-rarity-no-stage' });
equipment.assignEnemyEquipmentLoadout(explicitRarity, { rarity: 'blue', variance: false, seed: 55 });
if (countFilled(explicitRarity.equipment) < 7) {
  fail('explicit rarity path should still roll full reference kit');
} else ok('explicit rarity path ignores story recipe when stage omitted');

/* Endless mirror: piece count matches player; elite +1 / boss +2 rarity upgrades. */
function assertMirror(label, opts, expect) {
  const enemy = makeEnemy('rogue', 'grey', {
    id: `mirror-${label}`,
    isElite: opts.tier === 'elite',
    isBoss: opts.tier === 'boss',
  });
  const rolled = equipment.rollMirroredPieceLoadout(enemy, {
    pieceCount: opts.pieceCount,
    baseRarity: opts.baseRarity || 'grey',
    tier: opts.tier || 'normal',
    seed: opts.seed || 4242,
  });
  const filled = rolled.filledCount ?? countFilled(rolled.equipment);
  const rares = raritiesOf(rolled.equipment);
  if (filled !== expect.count && !(expect.minCount != null && filled >= expect.minCount)) {
    fail(`${label}: expected ${expect.count} pieces, got ${filled} [${rares.join(',')}]`);
    return;
  }
  if (expect.baseOnly && rares.length && !rares.every((r) => r === expect.baseOnly || r === expect.upgraded)) {
    fail(`${label}: unexpected rarities ${rares.join(',')}`);
    return;
  }
  if (expect.upgradedCount != null) {
    const up = rares.filter((r) => r === expect.upgraded).length;
    if (up !== expect.upgradedCount) {
      fail(`${label}: expected ${expect.upgradedCount} ${expect.upgraded}, got ${up} in ${rares.join(',')}`);
      return;
    }
  }
  ok(`${label}: ${filled} pieces (${rares.join('+') || 'none'})`);
}

assertMirror('empty', { pieceCount: 0, tier: 'boss' }, { count: 0, upgradedCount: 0, upgraded: 'green' });
assertMirror('normal-3', { pieceCount: 3, baseRarity: 'grey', tier: 'normal' }, {
  count: 3, baseOnly: 'grey', upgraded: 'green', upgradedCount: 0,
});
assertMirror('elite-3', { pieceCount: 3, baseRarity: 'grey', tier: 'elite' }, {
  count: 3, upgraded: 'green', upgradedCount: 1,
});
assertMirror('boss-4', { pieceCount: 4, baseRarity: 'grey', tier: 'boss' }, {
  count: 4, upgraded: 'green', upgradedCount: 2,
});
assertMirror('elite-1', { pieceCount: 1, baseRarity: 'blue', tier: 'elite' }, {
  count: 1, upgraded: 'purple', upgradedCount: 1,
});

/* Endless difficulty grows every battle rather than jumping at 3/5-battle boundaries. */
if (typeof sandbox.getEndlessExtraEffectiveLevels !== 'function'
    || typeof sandbox.getEndlessStatRampMultiplier !== 'function') {
  fail('smooth endless scaling helpers are exported');
} else {
  const levelGrowth = Array.from({ length: 12 }, (_, i) => sandbox.getEndlessExtraEffectiveLevels(i));
  const statGrowth = Array.from({ length: 12 }, (_, i) => sandbox.getEndlessStatRampMultiplier(i));
  const levelSteps = levelGrowth.slice(1).map((value, i) => value - levelGrowth[i]);
  const statSteps = statGrowth.slice(1).map((value, i) => value - statGrowth[i]);
  const nearlyEqual = (values) => values.every((value) => Math.abs(value - values[0]) < 1e-10);
  if (!nearlyEqual(levelSteps) || !levelSteps.every((value) => value > 0)) {
    fail(`endless effective levels are not smooth: ${levelSteps.join(',')}`);
  } else ok(`endless effective level grows evenly (+${levelSteps[0].toFixed(3)}/battle)`);
  if (!nearlyEqual(statSteps) || !statSteps.every((value) => value > 0)) {
    fail(`endless stat ramp is not smooth: ${statSteps.join(',')}`);
  } else ok(`endless stat ramp grows evenly (+${(statSteps[0] * 100).toFixed(3)}%/battle)`);
  if (Math.abs(sandbox.getEndlessExtraEffectiveLevels(15) - 14) > 1e-10
      || Math.abs(sandbox.getEndlessStatRampMultiplier(3) - 1.05) > 1e-10) {
    fail('smooth endless curve changed the intended long-run growth rate');
  } else ok('smooth endless curve preserves the prior long-run growth rate');
}

if (typeof equipment.countEquippedPieces === 'function') {
  const p = {
    equipment: equipment.createEmptyLoadout(),
  };
  const order = equipment.getSlotOrder();
  const greyItem = Object.values(Avian.data.equipment.items).find((it) => it && it.rarity === 'grey' && it.slot === 'Weapon');
  if (greyItem && order.includes('mainHand')) {
    p.equipment.mainHand = greyItem.id;
    p.equipment.armour = Object.values(Avian.data.equipment.items).find((it) => it && it.rarity === 'grey' && it.slot === 'Armour')?.id || null;
    p.equipment.helmet = Object.values(Avian.data.equipment.items).find((it) => it && it.rarity === 'grey' && it.slot === 'Helmet')?.id || null;
    const n = equipment.countEquippedPieces(p);
    const enemy = makeEnemy('rogue', 'grey', { id: 'mirror-from-player' });
    equipment.assignEnemyEquipmentLoadout(enemy, {
      mirrorPlayerEquipment: true,
      player: p,
      tier: 'normal',
      seed: 99,
    });
    const filled = countFilled(enemy.equipment);
    if (filled !== n) fail(`player mirror count: expected ${n}, got ${filled}`);
    else ok(`player mirror count matches equipped (${n})`);

    const mixedPlayer = { equipment: equipment.createEmptyLoadout() };
    const mixedRarities = ['grey', 'green', 'orange'];
    mixedRarities.forEach((rarity, index) => {
      const slotKey = ['mainHand', 'armour', 'helmet'][index];
      const slotName = { mainHand: 'Weapon', armour: 'Armour', helmet: 'Helmet' }[slotKey];
      const item = Object.values(Avian.data.equipment.items).find((it) =>
        it && it.rarity === rarity && it.slot === slotName
      );
      if (item) mixedPlayer.equipment[slotKey] = item.id;
    });
    const mixedEnemy = makeEnemy('rogue', 'grey', { id: 'mirror-mixed-player' });
    const mixedRoll = equipment.rollMirroredPieceLoadout(mixedEnemy, {
      player: mixedPlayer,
      tier: 'normal',
      seed: 101,
    });
    const playerRarities = raritiesOf(mixedPlayer.equipment).sort();
    const enemyRarities = raritiesOf(mixedRoll.equipment).sort();
    if (playerRarities.join(',') !== enemyRarities.join(',')) {
      fail(`mixed player mirror rarities: expected ${playerRarities.join(',')}, got ${enemyRarities.join(',')}`);
    } else ok(`mixed player mirror preserves rarity mix (${enemyRarities.join('+')})`);
  } else {
    ok('player mirror count skipped (no grey sample items)');
  }
} else {
  fail('countEquippedPieces not exported');
}

/* LEG-022 hit + full EN spend at 6. */
{
  const hitPct = sandbox.calculateAbilityHitChancePct
    ? sandbox.calculateAbilityHitChancePct(100, 10, 0)
    : null;
  if (hitPct === 90) ok('enemy/player hit formula 100−10 dodge = 90');
  else if (typeof sandbox.calculateAbilityHitChancePct !== 'function') {
    ok('hit formula check skipped (not on sandbox)');
  } else fail(`hit formula expected 90, got ${hitPct}`);

  const enEnemy = makeEnemy('rogue', 'grey', { id: 'en-spend-6' });
  equipment.assignEnemyEquipmentLoadout(enEnemy, { rarity: 'grey', variance: false, seed: 11 });
  enEnemy.energy = 6;
  sandbox.G.enemy = enEnemy;
  sandbox.G.stage = 10;
  sandbox.G.difficulty = 'juvenile';
  const plan6 = sandbox.planEnemyTurn(enEnemy, {
    stats: { hp: 40, maxHp: 100, def: 4, mdef: 4, dodge: 5, acc: 0 },
  });
  const cap = plan6 && plan6.energySpendCap;
  if (cap >= 6) ok(`EN spend cap at 6 energy = ${cap}`);
  else fail(`expected EN spend cap ≥6 at full meter, got ${cap}`);
}

/* Equipment flats must land on enemy combat stats (hpFlat → vitality → maxHp under weaponFirst). */
{
  const crowRow = Avian.data?.birdsV2?.crow || {};
  const baseHealth = Number(crowRow.baseHealth) || Number(crowRow.stats?.baseHealth) || 1;
  const gearEnemy = makeEnemy('knight', 'gold', {
    id: 'gear-stat-parity',
    birdKey: 'crow',
    baseHealth,
    stats: {
      hp: 80, maxHp: 80, atk: 14, def: 10, matk: 8, mdef: 8, spd: 10, acc: 80, dodge: 5, critChance: 5,
      vitality: 0, baseHealth,
    },
  });
  const before = { ...gearEnemy.stats };
  equipment.assignEnemyEquipmentLoadout(gearEnemy, { rarity: 'gold', variance: false, seed: 4242 });
  const roll = equipment.sumEquippedEquipment(gearEnemy);
  const vitFlat = Number(roll.stats?.vitality) || Number(roll.stats?.hp) || 0;
  const atkFlat = Number(roll.stats?.atk) || 0;
  if (vitFlat <= 0) fail('gold knight loadout expected positive vitality/hpFlat rollup');
  else if ((Number(gearEnemy.stats.vitality) || 0) < (Number(before.vitality) || 0) + vitFlat
    && (Number(gearEnemy.stats.maxHp) || 0) <= (Number(before.maxHp) || 0)) {
    fail(`enemy vitality/maxHp missing equipment flat: beforeVit=${before.vitality} +vit=${vitFlat} afterVit=${gearEnemy.stats.vitality} maxHp=${gearEnemy.stats.maxHp}`);
  } else {
    ok(`enemy stats include equipment vitality (+${vitFlat} → vit ${gearEnemy.stats.vitality}, maxHp ${gearEnemy.stats.maxHp})`);
  }
  if (atkFlat > 0 && (Number(gearEnemy.stats.atk) || 0) <= (Number(before.atk) || 0)) {
    fail(`enemy atk missing equipment flat: before=${before.atk} +atkFlat=${atkFlat} after=${gearEnemy.stats.atk}`);
  } else if (atkFlat > 0) {
    ok(`enemy atk includes equipment bonuses (${before.atk} → ${gearEnemy.stats.atk})`);
  }
}

if (failed) {
  console.error(`\n[enemy-equipment-ai] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[enemy-equipment-ai] all checks passed');
