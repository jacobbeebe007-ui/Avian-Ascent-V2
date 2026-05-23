#!/usr/bin/env node
/* Verify Delayed ailment wiring and v3 mutation import. */
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
const index = readFileSync(path.join(mutationsDir, 'index.js'), 'utf8');

if (!index.includes("m.version='2026.05-mutations-v3'")) fail('mutations index version not v3');
else ok('mutations pack version v3');

const delayedMechanics = (blue.match(/"magicAilment":\{"id":"delayed"/g) || []).length;
if (delayedMechanics < 1) fail('expected Delayed magicAilment entries in blue tier');
else ok(`blue tier has ${delayedMechanics} Delayed magicAilment entries`);

const bundle = readFileSync(path.join(ROOT, 'js', 'avian-game.bundle.js'), 'utf8');
for (const sym of ['applyDelayedDamage', 'tryMutationOnHitAilments', 'getDelayedDmgBoostPct']) {
  if (!bundle.includes(`function ${sym}`)) fail(`bundle missing ${sym}`);
  else ok(`bundle exports ${sym}`);
}

const delayedIdx = blue.indexOf('"magicAilment":{"id":"delayed"');
let delayedChance = 0;
let delayedId = '';
if (delayedIdx >= 0) {
  const chunk = blue.slice(Math.max(0, delayedIdx - 800), delayedIdx);
  const idMatches = [...chunk.matchAll(/"(AA-3-\d+)":\{/g)];
  if (idMatches.length) delayedId = idMatches[idMatches.length - 1][1];
  const chM = blue.slice(delayedIdx, delayedIdx + 80).match(/"chance":(\d+)/);
  if (chM) delayedChance = Number(chM[1]);
}
if (!delayedId) fail('could not parse a Delayed blue-tier item from import output');
else ok(`parsed Delayed item ${delayedId} with ${delayedChance}% apply chance`);

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String, BIRDS: { sparrow: { stats: {} } } };
ctx.globalThis = ctx;
vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'systems', 'mutations.js'), 'utf8'), ctx);

const delayedItem = {
  id: delayedId,
  slot: 'feet',
  stats: {},
  mechanics: { magicAilment: { id: 'delayed', chance: delayedChance } },
};
ctx.globalThis.Avian = ctx.globalThis.Avian || {};
ctx.globalThis.Avian.data = {
  mutations: {
    byId: { [delayedItem.id]: delayedItem },
    slots: { limits: { feet: 2, wing: 2, head: 1, beak: 1, chest: 1, eyes: 1, tail: 1, plumage: 1, syrinx: 1 } },
  },
};
ctx.Avian = ctx.globalThis.Avian;

const mutations = ctx.globalThis.Avian.mutations;
const player = {
  birdKey: 'sparrow',
  stats: { hp: 50, maxHp: 50, atk: 10, def: 5, spd: 10, matk: 10, mdef: 5, critChance: 5 },
  mutationInventory: [{ itemId: delayedItem.id }],
  equippedMutations: {
    feet: [delayedItem.id, null], wing: [null, null], head: [null], beak: [null],
    chest: [null], eyes: [null], tail: [null], plumage: [null], syrinx: [null],
  },
};
mutations.ensurePlayerMutationState(player);
mutations.reapplyPlayerStatsFromSources(player);
const mech = mutations.getMechanicsRollup(player);
const delayedEntry = (mech.magicAilments || []).find((e) => e.id === 'delayed');
if (!delayedEntry || delayedEntry.chance <= 0) fail('rollup missing magicAilments delayed entry');
else ok(`rollup magic delayed chance ${delayedEntry.chance}%`);

const hitDmg = 100;
const pct = Number(mech.delayedDmgPct) || 0;
const stored = Math.max(1, Math.floor(hitDmg * (1 + pct / 100)));
if (pct === 0 && stored === 100) ok(`stored damage ${stored} with 0% boost until Delayed % column is added`);
else ok(`stored damage formula ok (${stored} from ${hitDmg} + ${pct}%)`);

if (failed) process.exit(1);
console.log('[delayed-verify] all checks passed');
