#!/usr/bin/env node
/* Verify mutation gear v4 import and ailment chance rollup. */
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

if (!index.includes("m.version='2026.06-mutations-v5'")) fail('mutations index version not v5');
else ok('mutations pack version v5');

const ailmentChances = (blue.match(/"ailmentChances"/g) || []).length;
if (ailmentChances < 1) fail('expected ailmentChances entries in blue tier');
else ok(`blue tier has ${ailmentChances} ailmentChances blocks`);

if (!orange.includes('"tier":"orange"')) fail('orange tier file missing orange items');
else ok('orange tier catalog present');

const bundle = readFileSync(path.join(ROOT, 'js', 'avian-game.bundle.js'), 'utf8');
for (const sym of ['applyDelayedDamage', 'tryMutationOnHitAilments', 'getDelayedDmgBoostPct', 'mutationEffects', 'itemAllowedForPlayer']) {
  if (!bundle.includes(sym)) fail(`bundle missing ${sym}`);
  else ok(`bundle exports ${sym}`);
}

const bleedIdx = blue.indexOf('"id":"bleed"');
let delayedId = 'MT0001';
let delayedChance = 6;
if (bleedIdx >= 0) {
  const chunk = blue.slice(Math.max(0, bleedIdx - 400), bleedIdx);
  const idMatches = [...chunk.matchAll(/"(MT\d+)":\{/g)];
  if (idMatches.length) delayedId = idMatches[idMatches.length - 1][1];
  const chM = blue.slice(bleedIdx - 40, bleedIdx + 40).match(/"chance":(\d+)/);
  if (chM) delayedChance = Number(chM[1]);
}
ok(`parsed sample item ${delayedId} with ailment chance ${delayedChance}%`);

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
  slot: 'leftFoot',
  stats: {},
  mechanics: { ailmentChances: [{ id: 'bleed', chance: delayedChance, school: 'physical' }] },
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
equipped.leftFoot = [sampleItem.id];

const player = {
  birdKey: 'sparrow',
  stats: { hp: 50, maxHp: 50, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5 },
  mutationInventory: [{ itemId: sampleItem.id }],
  equippedMutations: equipped,
};
mutations.ensurePlayerMutationState(player);
mutations.reapplyPlayerStatsFromSources(player);
const mech = mutations.getMechanicsRollup(player);
const bleedEntry = (mech.physicalAilments || []).find((e) => e.id === 'bleed');
if (!bleedEntry || bleedEntry.chance <= 0) fail('rollup missing physicalAilments bleed entry');
else ok(`rollup physical bleed chance ${bleedEntry.chance}%`);

if (failed) process.exit(1);
console.log('[delayed-verify] all checks passed');
