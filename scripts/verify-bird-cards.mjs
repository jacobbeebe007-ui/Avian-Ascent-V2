#!/usr/bin/env node
/* Verify bird card collection + Mother Goose meta/hatch logic. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadScript(relPath) {
  const code = readFileSync(path.join(ROOT, relPath), 'utf8');
  vm.runInContext(code, sandbox, { filename: relPath });
}

const storage = new Map();
const sandbox = {
  console,
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  globalThis: null,
  Avian: { data: {}, meta: {}, systems: {} },
  BIRDS: {
    sparrow: { name: 'Sparrow', stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 10, acc: 90 }, unlockRequires: null },
    crow: { name: 'Crow', stats: { hp: 110, maxHp: 110, atk: 11, def: 6, spd: 9, acc: 88 }, unlockRequires: 'juvenileWin' },
    dukeBlakiston: { name: 'Duke', stats: { hp: 200, maxHp: 200, atk: 20, def: 10, spd: 5, acc: 80 }, unlockRequires: 'unlock_duke_blakiston' },
    robin: { name: 'Robin', stats: { hp: 95, maxHp: 95, atk: 9, def: 5, spd: 11, acc: 91 }, unlockRequires: null, class: 'rogue' },
    blackbird: { name: 'Blackbird', stats: { hp: 100, maxHp: 100, atk: 10, def: 5, spd: 10, acc: 90 }, unlockRequires: null },
    macaw: { name: 'Macaw', stats: { hp: 105, maxHp: 105, atk: 10, def: 5, spd: 9, acc: 89 }, unlockRequires: null },
    goose: { name: 'Goose', stats: { hp: 120, maxHp: 120, atk: 9, def: 7, spd: 8, acc: 85 }, unlockRequires: null },
    hummingbird: { name: 'Hummingbird', stats: { hp: 80, maxHp: 80, atk: 12, def: 4, spd: 14, acc: 92 }, unlockRequires: 'unlock_hummingbird', class: 'rogue' },
    baldEagle: { name: 'Bald Eagle', stats: { hp: 150, maxHp: 150, atk: 15, def: 8, spd: 8, acc: 88 }, unlockRequires: 'juvenileWin', class: 'knight' },
  },
  getUnlocks: () => ({ juvenileWin: true }),
  isUnlocked: (id) => id === 'juvenileWin',
  grantUnlock: (id) => {
    sandbox._unlocks = sandbox._unlocks || {};
    sandbox._unlocks[id] = true;
  },
  classToRoleId: (c) => String(c || 'rogue').toLowerCase(),
};
sandbox.globalThis = sandbox;
sandbox._unlocks = { juvenileWin: true };
sandbox.isUnlocked = (id) => !!sandbox._unlocks[id];
vm.createContext(sandbox);

const scripts = [
  'js/data/bird-card-tiers.js',
  'js/data/bird-card-passive-scaling.js',
  'js/data/mother-goose-species-tiers.js',
  'js/data/mother-goose-catalog.js',
  'js/meta/fortune-meta.js',
  'js/meta/bird-cards.js',
  'js/meta/mother-goose.js',
];

for (const s of scripts) loadScript(s);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

const species = sandbox.Avian.data.motherGooseSpeciesTiers;
const cat = sandbox.Avian.data.motherGooseCatalog;

console.log('[verify-bird-cards] species tiers data');
assert(species && Object.keys(species.byBirdKey).length === 44, '44 birds in species tiers');
assert(species.starterBirdKeys.length === 5, '5 starter birds from sheet');

console.log('[verify-bird-cards] meta normalize / migration');
const meta = sandbox.getFortuneMeta();
assert(meta.metaSchemaVersion === 2, 'metaSchemaVersion is 2');
assert(meta.birdCards && meta.birdCards.owned.sparrow, 'starter sparrow grey card');
assert(meta.birdCards.owned.crow, 'unlocked crow grey card from migration');
assert(!meta.birdCards.owned.robin, 'robin not auto-migrated (not a starter)');

console.log('[verify-bird-cards] pools');
const cracked = cat.buildCrackedPool();
const feathered = cat.buildFeatheredPool();

assert(cracked.includes('sparrow') && cracked.includes('robin'), 'cracked includes sparrow and robin');
assert(!cracked.includes('hummingbird'), 'cracked excludes green-tier hummingbird');
assert(!cracked.includes('dukeBlakiston'), 'cracked excludes duke');
assert(
  cracked.every((k) => species.byBirdKey[k] && species.byBirdKey[k].eggPools.includes('cracked')),
  'cracked pool matches sheet eggPools',
);
assert(feathered.includes('crow') && !feathered.includes('dukeBlakiston'), 'feathered excludes orange duke');
sandbox._unlocks.unlock_hummingbird = true;
const gleamingUnlocked = cat.buildGleamingPool();
assert(gleamingUnlocked.includes('hummingbird') && !gleamingUnlocked.includes('sparrow'), 'gleaming has green birds not grey sparrow');
assert(
  species.gleamingWeightBySpeciesTier.gold > species.gleamingWeightBySpeciesTier.green,
  'gold species tier weight > green',
);

sandbox._unlocks.unlock_duke_blakiston = true;
sandbox.isUnlocked = (id) => !!sandbox._unlocks[id];
assert(cat.buildAncestralPool().join(',') === 'dukeBlakiston', 'ancestral pool is duke only when unlocked');

console.log('[verify-bird-cards] hatch duplicate + feathers');
sandbox.saveFortuneMeta({ ...sandbox.getFortuneMeta(), goldenGooseEggs: 100 });
const hatch1 = sandbox.hatchEgg('cracked');
assert(hatch1.ok, 'hatch succeeds');
if (hatch1.isNew) {
  const dup = sandbox.hatchEgg('cracked');
  assert(dup.ok && !dup.isNew && dup.feathersGained === 8, 'duplicate yields 8 feathers');
} else {
  assert(hatch1.feathersGained === 0 || hatch1.feathersGained === 8, 'hatch result shape ok');
}

console.log('[verify-bird-cards] mutation costs');
sandbox.addSpeciesFeathers('sparrow', 12);
const mut = sandbox.mutateBirdCard('sparrow');
assert(mut.ok && mut.tier === 'green' && mut.cost === 12, 'grey→green costs 12 feathers');

console.log('[verify-bird-cards] pity counter');
const pity = sandbox.getPityState();
assert(typeof pity.eggsUntilNext === 'number', 'pity progress exposed');
assert(pity.totalHatches >= 1, 'hatch increments totalHatches');

console.log('\n[verify-bird-cards] ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
