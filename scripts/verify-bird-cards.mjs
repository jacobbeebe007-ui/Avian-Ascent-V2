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
    pelican: { name: 'Australian Pelican', stats: { hp: 74, maxHp: 74, atk: 14, def: 20, spd: 6, acc: 77 }, unlockRequires: 'unlock_pelican', class: 'knight' },
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
  'js/data/feather-growth-profiles.js',
  'js/data/mother-goose-species-tiers.js',
  'js/data/mother-goose-catalog.js',
  'js/meta/fortune-meta.js',
  'js/meta/bird-cards.js',
  'js/meta/mother-goose.js',
];

for (const s of scripts) loadScript(s);

const tiers = sandbox.Avian.data.birdCardTiers;

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
const birdKeys = Object.keys(species.byBirdKey || {}).filter((k) => !k.startsWith('tier_'));
const starterCount = birdKeys.filter((k) => species.byBirdKey[k]?.starterBird).length;
assert(species && birdKeys.length >= 52, 'species tiers has bird entries');
assert(starterCount === 5, '5 starter birds from sheet');

console.log('[verify-bird-cards] meta normalize / migration');
const meta = sandbox.getFortuneMeta();
assert(meta.metaSchemaVersion === 3, 'metaSchemaVersion is 3');
assert(meta.birdCards && meta.birdCards.owned.sparrow, 'starter sparrow grey card');
assert(meta.birdCards.owned.sparrow.stars === 0, 'starter sparrow starts at 0 stars');
assert(meta.birdCards.owned.crow, 'unlocked crow grey card from migration');
assert(!meta.birdCards.owned.robin, 'robin not auto-migrated (not a starter)');

console.log('[verify-bird-cards] species rarity labels');
assert(tiers.SPECIES_RARITY_LABELS.grey === 'Common', 'Common label for grey species');
assert(tiers.SPECIES_RARITY_LABELS.orange === 'Ancestral', 'Ancestral label for orange species');

console.log('[verify-bird-cards] egg descriptions');
const crackedDesc = cat.formatEggDescription('cracked');
const royalDesc = cat.formatEggDescription('royal');
assert(crackedDesc.includes('100%') && crackedDesc.includes('Common'), 'cracked desc shows Common odds');
assert(royalDesc.includes('75%') && royalDesc.includes('25%') && royalDesc.includes('Legendary'), 'royal desc shows tier odds');

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
assert(
  feathered.every((k) => {
    const st = species.byBirdKey[k] && species.byBirdKey[k].speciesTier;
    return st === 'grey' || st === 'green';
  }),
  'feathered pool only grey/green species',
);
sandbox._unlocks.unlock_hummingbird = true;
const gleamingUnlocked = cat.buildGleamingPool();
assert(gleamingUnlocked.includes('hummingbird') && !gleamingUnlocked.includes('sparrow'), 'gleaming has green birds not grey sparrow');
if (species.gleamingWeightBySpeciesTier) {
  assert(
    species.gleamingWeightBySpeciesTier.gold > species.gleamingWeightBySpeciesTier.green,
    'gold species tier weight > green',
  );
}

sandbox._unlocks.unlock_duke_blakiston = true;
sandbox.isUnlocked = (id) => !!sandbox._unlocks[id];
assert(cat.buildAncestralPool().join(',') === 'dukeBlakiston', 'ancestral pool is duke only when unlocked');

console.log('[verify-bird-cards] gleaming + royal pools (no prior unlock)');
const gleamingFresh = cat.buildGleamingPool();
assert(gleamingFresh.length > 0, 'gleaming pool non-empty without unlocks');
assert(gleamingFresh.includes('hummingbird'), 'gleaming includes hummingbird from sheet');
assert(
  gleamingFresh.every((k) => {
    const st = species.byBirdKey[k] && species.byBirdKey[k].speciesTier;
    return st === 'blue' || st === 'green';
  }),
  'gleaming pool only blue/green species',
);
const royalKnight = cat.buildRoyalPool('knight');
assert(royalKnight.length > 0, 'royal knight pool non-empty');
assert(
  royalKnight.every((k) => {
    const st = species.byBirdKey[k] && species.byBirdKey[k].speciesTier;
    return st === 'purple';
  }),
  'royal pool only purple species',
);
const royalBlueKnight = cat.buildRoyalBluePool('knight');
assert(Array.isArray(royalBlueKnight), 'royal blue pool helper exists');
const ancestralFallback = cat.buildAncestralFallbackPool();
assert(ancestralFallback.length > 0, 'ancestral fallback pool non-empty');
assert(!ancestralFallback.includes('dukeBlakiston'), 'ancestral fallback excludes duke');

console.log('[verify-bird-cards] hatch duplicate + feathers');
sandbox.saveFortuneMeta({ ...sandbox.getFortuneMeta(), goldenGooseEggs: 100 });
const hatch1 = sandbox.hatchEgg('cracked');
assert(hatch1.ok, 'hatch succeeds');
if (hatch1.isNew) {
  const dup = sandbox.hatchEgg('cracked');
  assert(dup.ok && !dup.isNew && dup.feathersGained === 4, 'duplicate yields 4 feathers');
} else {
  assert(hatch1.feathersGained === 0 || hatch1.feathersGained === 4, 'hatch result shape ok');
}

console.log('[verify-bird-cards] star growth formula');
assert(
  Math.abs(tiers.getEffectiveStatMultiplier('grey', 0) - 1) < 0.0001,
  'grey 0 stars = 1x major-band multiplier',
);
assert(
  Math.abs(tiers.getEffectiveStatMultiplier('grey', 1) - 1.01) < 0.0001,
  'grey 1 star = 1.01x major-band multiplier',
);
assert(
  Math.abs(tiers.getEffectiveStatMultiplier('orange', 0) - 1.25) < 0.0001,
  'orange 0 stars = 25 stars = 1.25x major-band multiplier',
);
console.log('[verify-bird-cards] star mutation costs');
assert(tiers.getDuplicateFeatherYield('cracked') === 4, 'duplicate feather default is 4');
const mut1 = sandbox.mutateBirdCard('sparrow');
assert(mut1.ok && mut1.tier === 'grey' && mut1.stars === 1 && mut1.cost === 20, 'grey 0★→1★ costs 20 feathers');
sandbox.addSpeciesFeathers('sparrow', 100);
for (let i = 0; i < 4; i++) {
  const m = sandbox.mutateBirdCard('sparrow');
  assert(m.ok, 'additional grey star upgrades succeed');
}
const tierUp = sandbox.mutateBirdCard('sparrow');
assert(
  tierUp.ok && tierUp.tier === 'green' && tierUp.stars === 0 && tierUp.isTierUp,
  'grey 5★→green 0★ tier-up at cost 20',
);

console.log('[verify-bird-cards] max tier');
const orangeCard = {
  tier: 'orange',
  stars: 5,
  acquiredAt: Date.now(),
};
const mMax = sandbox.getFortuneMeta();
mMax.birdCards.owned.sparrow = orangeCard;
sandbox.saveFortuneMeta(mMax);
assert(!sandbox.mutateBirdCard('sparrow').ok, 'orange 5★ cannot upgrade further');

console.log('[verify-bird-cards] pity counter');
const pity = sandbox.getPityState();
assert(typeof pity.eggsUntilNext === 'number', 'pity progress exposed');
assert(pity.totalHatches >= 1, 'hatch increments totalHatches');

console.log('[verify-bird-cards] batch hatch');
const mBatch = sandbox.getFortuneMeta();
mBatch.goldenGooseEggs = 200;
sandbox.saveFortuneMeta(mBatch);
const batch = sandbox.hatchEggsBatch('cracked', 10, {});
assert(batch.ok && batch.results.length === 10, 'batch hatch returns 10 results');
assert(batch.totalCost === 100, 'batch hatch spends cost * 10');
const afterGoose = sandbox.getFortuneMeta().goldenGooseEggs;
assert(afterGoose === 100, 'batch hatch deducts golden goose eggs');

console.log('\n[verify-bird-cards] ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
