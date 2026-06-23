#!/usr/bin/env node
/* Verify workbook mutation effect routing (stats, mechanics, bonuses, sets). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[mutation-effects] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[mutation-effects] ok  ', msg);
}

const mutationsDir = path.join(ROOT, 'js', 'data', 'mutations');
const index = readFileSync(path.join(mutationsDir, 'index.js'), 'utf8');
const blue = readFileSync(path.join(mutationsDir, 'items-blue.js'), 'utf8');
const orange = readFileSync(path.join(mutationsDir, 'items-orange.js'), 'utf8');
const sets = readFileSync(path.join(mutationsDir, 'sets.js'), 'utf8');

if (!index.includes("m.version='2026.06-mutations-v6'")) fail('mutations index version not v6');
else ok('mutations pack version v6');

if (!blue.includes('MUT-LW-015')) fail('expected MUT-LW-015 in blue tier');
else ok('slot-coded IDs present');

if (!blue.includes('"minor_shield"')) fail('expected minor_shield bonus in blue tier');
else ok('minor_shield bonus present');

if (!blue.includes('"apply_minor_dodge_down"')) fail('expected apply_minor_dodge_down bonus');
else ok('self dodge down bonus present');

if (!blue.includes('"id":"delayed"')) fail('expected delayed ailment in catalog');
else ok('delayed ailment present');

if (!orange.includes('MUT-LW-028')) fail('expected orange MUT-LW-028');
else ok('workbook orange tier present');

if (orange.includes('MT0011')) fail('legacy MT orange ids should be removed');
else ok('no legacy MT orange ids');

for (const setId of ['thornbound_aerie', 'embermarked_choir', 'dragonbone_guard', 'phoenix_oath']) {
  if (!sets.includes(setId)) fail(`missing set ${setId}`);
  else ok(`set catalog includes ${setId}`);
}

const SLOT_ORDER = [
  'leftWing', 'rightWing', 'leftFoot', 'rightFoot', 'beak', 'syrinx',
  'chest', 'plumage', 'eyes', 'head', 'tail',
];
const slotLimits = Object.fromEntries(SLOT_ORDER.map((s) => [s, 1]));

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String, BIRDS: { sparrow: { stats: { maxHp: 100, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5, dodge: 5 }, class: 'rogue' } } };
ctx.globalThis = ctx;

for (const file of ['items-blue.js', 'index.js']) {
  vm.runInNewContext(readFileSync(path.join(mutationsDir, file), 'utf8'), ctx);
}
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutations.js'), 'utf8'), ctx);
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutation-effects.js'), 'utf8'), ctx);

ctx.Avian = ctx.globalThis.Avian;
const byId = ctx.Avian.data.mutations.byId;
const shieldItem = byId['MUT-LW-015'];
const dodgeDownItem = byId['MUT-LW-013'];
const delayedItem = byId['MUT-RF-013'];

if (!shieldItem?.bonuses?.some((b) => b.id === 'minor_shield')) fail('MUT-LW-015 missing minor_shield bonus');
else ok('MUT-LW-015 has minor_shield bonus');

if (!dodgeDownItem?.bonuses?.some((b) => b.id === 'apply_minor_dodge_down')) fail('MUT-LW-013 missing dodge down bonus');
else ok('MUT-LW-013 has apply_minor_dodge_down bonus');

if (!delayedItem?.mechanics?.ailmentChances?.some((a) => a.id === 'delayed')) fail('MUT-RF-013 missing delayed ailment');
else ok('MUT-RF-013 has delayed ailment chance');

const mutations = ctx.Avian.mutations;
function emptyEquipped() {
  const out = {};
  for (const s of SLOT_ORDER) out[s] = [null];
  return out;
}

const player = {
  birdKey: 'sparrow',
  stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5, dodge: 10 },
  mutationInventory: [{ itemId: 'MUT-LW-015' }],
  equippedMutations: emptyEquipped(),
  _statLedger: {
    birdBaseline: { maxHp: 100, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5, dodge: 5 },
    fromLevel: {}, fromUpgrades: {}, fromEquipment: {}, mechanicalLines: [],
  },
};
player.equippedMutations.leftWing = ['MUT-LW-015'];
mutations.ensurePlayerMutationState(player);
mutations.reapplyPlayerStatsFromSources(player);
const mech = mutations.getMechanicsRollup(player);
const bonusIds = (mech.itemBonuses || []).map((b) => b.id);
if (!bonusIds.includes('minor_shield')) fail('rollup missing minor_shield in itemBonuses');
else ok('rollup collects minor_shield bonus');

if (typeof ctx.Avian.mutationEffects.onBattleStart !== 'function') fail('mutationEffects.onBattleStart missing');
else ok('mutationEffects.onBattleStart exported');

if (typeof ctx.Avian.mutationEffects.onBloodiedSelf !== 'function') fail('mutationEffects.onBloodiedSelf missing');
else ok('mutationEffects.onBloodiedSelf exported');

if (failed) process.exit(1);
console.log('[mutation-effects] all checks passed');
