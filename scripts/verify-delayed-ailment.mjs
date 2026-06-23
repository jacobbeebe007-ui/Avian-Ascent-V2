#!/usr/bin/env node
/* Verify mutation gear v6 import and ailment chance rollup. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[delayed-verify] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[delayed-verify] ok  ', msg);
}

const mutationsDir = path.join(ROOT, 'js', 'data', 'mutations');
const blue = readFileSync(path.join(mutationsDir, 'items-blue.js'), 'utf8');
const orange = readFileSync(path.join(mutationsDir, 'items-orange.js'), 'utf8');
const index = readFileSync(path.join(mutationsDir, 'index.js'), 'utf8');

if (!index.includes("m.version='2026.06-mutations-v6'")) fail('mutations index version not v6');
else ok('mutations pack version v6');

const ailmentChances = (blue.match(/"ailmentChances"/g) || []).length;
if (ailmentChances < 1) fail('expected ailmentChances entries in blue tier');
else ok(`blue tier has ${ailmentChances} ailmentChances blocks`);

if (!orange.includes('MUT-LW-028')) fail('orange tier missing workbook orange items');
else ok('workbook orange tier catalog present');

if (orange.includes('MT0011')) fail('legacy MT orange ids should be removed');
else ok('no legacy MT orange ids');

const bundle = readFileSync(path.join(ROOT, 'js', 'avian-game.bundle.js'), 'utf8');
for (const sym of ['applyDelayedDamage', 'tryMutationOnHitAilments', 'getDelayedDmgBoostPct', 'mutationEffects', 'itemAllowedForPlayer']) {
  if (!bundle.includes(sym)) fail(`bundle missing ${sym}`);
  else ok(`bundle exports ${sym}`);
}

const delayedId = 'MUT-RF-013';
let delayedChance = 10;
const itemChunk = blue.match(new RegExp(`"${delayedId}"[^}]+`));
if (!itemChunk) fail(`sample item ${delayedId} not found in blue tier`);
else {
  const chM = itemChunk[0].match(/"id":"delayed"[^}]*"chance":(\d+)/);
  if (chM) delayedChance = Number(chM[1]);
  ok(`parsed sample item ${delayedId} with delayed chance ${delayedChance}%`);
}

const SLOT_ORDER = [
  'leftWing', 'rightWing', 'leftFoot', 'rightFoot', 'beak', 'syrinx',
  'chest', 'plumage', 'eyes', 'head', 'tail',
];
const slotLimits = Object.fromEntries(SLOT_ORDER.map((s) => [s, 1]));

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String, BIRDS: { sparrow: { stats: {}, class: 'rogue' } } };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutations.js'), 'utf8'), ctx);

const sampleItem = {
  id: delayedId,
  slot: 'rightFoot',
  stats: {},
  mechanics: { ailmentChances: [{ id: 'delayed', chance: delayedChance, school: 'physical' }] },
};
ctx.globalThis.Avian = ctx.globalThis.Avian || {};
ctx.globalThis.Avian.data = {
  mutations: {
    byId: { [sampleItem.id]: sampleItem },
    slots: { limits: slotLimits, order: SLOT_ORDER },
  },
};
ctx.Avian = ctx.globalThis.Avian;

const mutations = ctx.globalThis.Avian.mutations;
const equipped = {};
for (const s of SLOT_ORDER) equipped[s] = [null];
equipped.rightFoot = [sampleItem.id];

const player = {
  birdKey: 'sparrow',
  stats: { hp: 50, maxHp: 50, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5 },
  mutationInventory: [{ itemId: sampleItem.id }],
  equippedMutations: equipped,
};
mutations.ensurePlayerMutationState(player);
mutations.reapplyPlayerStatsFromSources(player);
const mech = mutations.getMechanicsRollup(player);
const delayedEntry = (mech.physicalAilments || []).find((e) => e.id === 'delayed');
if (!delayedEntry || delayedEntry.chance <= 0) fail('rollup missing physicalAilments delayed entry');
else ok(`rollup physical delayed chance ${delayedEntry.chance}%`);

if (failed) process.exit(1);
console.log('[delayed-verify] all checks passed');
