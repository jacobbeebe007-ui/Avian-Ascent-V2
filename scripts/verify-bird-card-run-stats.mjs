#!/usr/bin/env node
/* Verify bird card tier bonuses survive reapplyPlayerStatsFromSources (combat prep). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[bird-card-run-stats] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[bird-card-run-stats] ok  ', msg);
}

const STAT_LEDGER_TRACKED_KEYS = [
  'maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance', 'armorPen', 'magicPen',
];

function cloneStatLedgerSlice(stats) {
  const s = stats || {};
  const out = {};
  for (const k of STAT_LEDGER_TRACKED_KEYS) {
    const n = Number(s[k]);
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function ensureStatLedger(player) {
  if (!player) return null;
  if (!player._statLedger || typeof player._statLedger !== 'object') {
    player._statLedger = {
      birdBaseline: {},
      fromLevel: {},
      fromUpgrades: {},
      fromCardTier: {},
      fromEquipment: {},
      mechanicalLines: [],
    };
  }
  const L = player._statLedger;
  if (!L.fromCardTier || typeof L.fromCardTier !== 'object') L.fromCardTier = {};
  return L;
}

function initStatLedgerForNewRun(player) {
  const L = ensureStatLedger(player);
  if (!L || !player?.stats) return;
  const catalogStats = player.birdKey && ctx.BIRDS[player.birdKey]?.stats;
  L.birdBaseline = catalogStats ? cloneStatLedgerSlice(catalogStats) : cloneStatLedgerSlice(player.stats);
  L.fromLevel = {};
  L.fromUpgrades = {};
  L.fromEquipment = {};
  L.fromCardTier = {};
  L.mechanicalLines = [];
}

const ctx = {
  globalThis: {},
  console,
  Math,
  Number,
  Object,
  Array,
  String,
  BIRDS: {
    sparrow: {
      size: 'small',
      stats: { hp: 20, maxHp: 20, atk: 5, def: 3, spd: 8, acc: 90, dodge: 5, matk: 8, mdef: 5, critChance: 5 },
    },
  },
  STAT_LEDGER_TRACKED_KEYS,
  ensureStatLedger,
  cloneStatLedgerSlice,
};
ctx.globalThis = ctx;

function load(rel) {
  vm.runInNewContext(readFileSync(path.join(ROOT, rel), 'utf8'), ctx);
}

load('js/bootstrap/_namespace.js');
load('js/data/bird-card-tiers.js');
load('js/meta/bird-card-runtime.js');
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutations.js'), 'utf8'), ctx);

ctx.globalThis.getBirdCardTier = () => 'orange';
ctx.globalThis.getBirdCardStars = () => 0;

const baseAtk = ctx.BIRDS.sparrow.stats.atk;
const baseAcc = ctx.BIRDS.sparrow.stats.acc;
const baseCrit = ctx.BIRDS.sparrow.stats.critChance;
const player = {
  birdKey: 'sparrow',
  size: 'small',
  stats: { ...ctx.BIRDS.sparrow.stats },
  equippedMutations: null,
  mutationInventory: [],
};

initStatLedgerForNewRun(player);
ctx.globalThis.applyBirdCardProgression(player);

const atkAfterCard = player.stats.atk;
if (atkAfterCard <= baseAtk) {
  fail(`expected atk > base after card progression (${baseAtk}), got ${atkAfterCard}`);
} else {
  ok(`card progression raised atk from ${baseAtk} to ${atkAfterCard}`);
}

const fromCardAtk = Number(player._statLedger?.fromCardTier?.atk) || 0;
if (fromCardAtk <= 0) fail(`expected fromCardTier.atk > 0, got ${fromCardAtk}`);
else ok(`fromCardTier.atk = ${fromCardAtk}`);

if (player.stats.acc !== baseAcc) {
  fail(`expected acc unchanged by star scaling (${baseAcc}), got ${player.stats.acc}`);
} else {
  ok(`acc unchanged at ${baseAcc}`);
}

if (player.stats.critChance !== baseCrit) {
  fail(`expected critChance unchanged by star scaling (${baseCrit}), got ${player.stats.critChance}`);
} else {
  ok(`critChance unchanged at ${baseCrit}`);
}

ctx.globalThis.Avian.mutations.reapplyPlayerStatsFromSources(player);

if (player.stats.atk !== atkAfterCard) {
  fail(`reapply wiped card atk: expected ${atkAfterCard}, got ${player.stats.atk}`);
} else {
  ok('reapplyPlayerStatsFromSources preserves card tier atk bonus');
}

if (failed) process.exit(1);
console.log('[bird-card-run-stats] OK');
