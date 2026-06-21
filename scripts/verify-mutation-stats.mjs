#!/usr/bin/env node
/* Verify mutation flat stats vs mechanical stats routing through reapplyPlayerStatsFromSources. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[mutation-stats] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[mutation-stats] ok  ', msg);
}

const SLOT_ORDER = [
  'leftWing', 'rightWing', 'leftFoot', 'rightFoot', 'beak', 'syrinx',
  'chest', 'plumage', 'eyes', 'head', 'tail',
];

const ctx = {
  globalThis: {},
  console,
  Math,
  Number,
  Object,
  Array,
  String,
  BIRDS: { sparrow: { stats: { maxHp: 20, atk: 5, def: 3, spd: 8, acc: 90, dodge: 5, matk: 8, mdef: 5, critChance: 5 }, class: 'rogue' } },
  STAT_LEDGER_TRACKED_KEYS: ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance'],
  STAT_LEDGER_LABELS: { maxHp: 'HP (max)', atk: 'ATT', def: 'DEF', spd: 'SPD', acc: 'ACC', dodge: 'DODGE', matk: 'MATK', mdef: 'MDEF', critChance: 'CRIT %' },
};
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutations.js'), 'utf8'), ctx);

const sampleItem = {
  id: 'TEST-STAT-1',
  tier: 'green',
  slot: 'leftWing',
  stats: { dodge: 3, spd: 2 },
  mechanics: { lightAttackDmgPct: 7 },
  statLine: 'Light Attack +7%; Dodge +3%; Speed +2',
};

const slotLimits = Object.fromEntries(SLOT_ORDER.map((s) => [s, 1]));

ctx.globalThis.Avian = ctx.globalThis.Avian || {};
ctx.globalThis.Avian.data = {
  mutations: {
    byId: { [sampleItem.id]: sampleItem },
    slots: { limits: slotLimits, order: SLOT_ORDER },
  },
};
ctx.Avian = ctx.globalThis.Avian;

function emptyEquipped() {
  const out = {};
  for (const s of SLOT_ORDER) out[s] = [null];
  return out;
}

const mutations = ctx.globalThis.Avian.mutations;
const player = {
  birdKey: 'sparrow',
  stats: { hp: 20, maxHp: 20, atk: 5, def: 3, spd: 8, acc: 90, dodge: 5, matk: 8, mdef: 5, critChance: 5 },
  mutationInventory: [{ itemId: sampleItem.id }],
  equippedMutations: emptyEquipped(),
  _statLedger: {
    birdBaseline: { maxHp: 20, atk: 5, def: 3, spd: 8, acc: 90, dodge: 5, matk: 8, mdef: 5, critChance: 5 },
    fromLevel: {},
    fromUpgrades: {},
    fromEquipment: {},
    mechanicalLines: [],
  },
};

mutations.ensurePlayerMutationState(player);
mutations.equipAuto(player, sampleItem.id);
mutations.reapplyPlayerStatsFromSources(player);

if (player.stats.dodge !== 8) fail(`expected dodge 8 after equip, got ${player.stats.dodge}`);
else ok('flat stat dodge applied to player.stats');

if (player.stats.spd !== 10) fail(`expected spd 10 after equip, got ${player.stats.spd}`);
else ok('flat stat spd applied to player.stats');

const mech = mutations.getMechanicsRollup(player);
if ((mech.lightAttackDmgPct || 0) !== 7) fail(`expected lightAttackDmgPct 7, got ${mech.lightAttackDmgPct}`);
else ok('mechanical lightAttackDmgPct routed to rollup');

const classItem = { id: 'TEST-CLASS-1', tier: 'green', slot: 'beak', classRequired: 'mage', stats: { atk: 5 } };
ctx.globalThis.Avian.data.mutations.byId[classItem.id] = classItem;
player.mutationInventory.push({ itemId: classItem.id });
if (mutations.canPlayerEquipItem(player, classItem.id)) fail('class-only item should not equip on rogue sparrow');
else ok('class-only equip gate blocks wrong class');

const summary = mutations.getEquippedSummary(player);
const hasDodge = summary.lines.some((l) => l.key === 'dodge' && l.value === 3);
const hasLight = summary.lines.some((l) => l.key === 'lightDmg');
if (!hasDodge) fail('getEquippedSummary missing dodge line');
else ok('getEquippedSummary includes flat dodge');
if (!hasLight) fail('getEquippedSummary missing light attack line');
else ok('getEquippedSummary includes mechanical light attack');

const index = readFileSync(path.join(ROOT, 'js', 'data', 'mutations', 'index.js'), 'utf8');
if (!index.includes("m.version='2026.06-mutations-v4'")) fail('mutations index version not v4');
else ok('mutations pack version v4');

const bundle = readFileSync(path.join(ROOT, 'js', 'avian-game.bundle.js'), 'utf8');
for (const sym of ['buildFamilyEntryFromPackId', 'UNIVERSAL_FAMILY_ABILITY_LOOKUP', 'nest-slot-filter', 'mutation-effects', 'leftWing']) {
  if (!bundle.includes(sym)) fail(`bundle missing ${sym}`);
  else ok(`bundle contains ${sym}`);
}

if (failed) process.exit(1);
console.log('[mutation-stats] OK');
