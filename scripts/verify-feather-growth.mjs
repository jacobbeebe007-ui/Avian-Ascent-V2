#!/usr/bin/env node
/* Verify major/minor/trace feather growth profiles and stat formula. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[feather-growth] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[feather-growth] ok  ', msg);
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
    sparrow: { class: 'rogue', stats: { maxHp: 37, atk: 8, spd: 24, def: 6 } },
    goose: { class: 'brute', stats: { maxHp: 76, atk: 14, def: 17, spd: 5 } },
    cassowary: { class: 'brute', stats: { maxHp: 73, atk: 17, spd: 15, def: 10 } },
    peregrine: { class: 'rogue', stats: { maxHp: 40, atk: 12, spd: 22, dodge: 14 } },
  },
};
ctx.globalThis = ctx;

function load(rel) {
  vm.runInNewContext(readFileSync(path.join(ROOT, rel), 'utf8'), ctx);
}

load('js/bootstrap/_namespace.js');
load('js/data/bird-card-tiers.js');
load('js/data/feather-growth-profiles.js');

const gp = ctx.Avian.data.featherGrowthProfiles;
const tiers = ctx.Avian.data.birdCardTiers;

ok('growth profiles loaded');

if (gp.getTotalFeatherStars('grey', 0) !== 0) fail('grey 0★ = 0 total stars');
else ok('grey 0★ = 0 total stars');

if (gp.getTotalFeatherStars('grey', 5) !== 5) fail('grey 5★ = 5 total stars');
else ok('grey 5★ = 5 total stars');

if (gp.getTotalFeatherStars('green', 0) !== 5) fail('green 0★ = 5 total stars');
else ok('green 0★ = 5 total stars');

if (gp.getTotalFeatherStars('orange', 5) !== 30) fail('orange 5★ = 30 total stars');
else ok('orange 5★ = 30 total stars');

const rogueProfile = gp.getGrowthProfileForBird('sparrow');
if (!rogueProfile.major.includes('spd') || !rogueProfile.minor.includes('atk')) {
  fail('sparrow uses rogue class profile');
} else {
  ok('sparrow rogue class profile');
}

const gooseProfile = gp.getGrowthProfileForBird('goose');
if (!gooseProfile.minor.includes('mdef') || gooseProfile.minor.includes('spd')) {
  fail('goose uses defensive brute override');
} else {
  ok('goose defensive brute override');
}

const cassProfile = gp.getGrowthProfileForBird('cassowary');
if (!cassProfile.minor.includes('spd') || cassProfile.minor.includes('mdef')) {
  fail('cassowary uses runner brute override');
} else {
  ok('cassowary runner brute override');
}

const peregrineProfile = gp.getGrowthProfileForBird('peregrine');
if (!peregrineProfile.major.includes('atk') || !peregrineProfile.major.includes('spd')) {
  fail('peregrine uses power rogue override');
} else {
  ok('peregrine power rogue override');
}

const majorBonus30 = gp.getGrowthBonusForStat('atk', { major: ['atk'], minor: [], trace: [], locked: [] }, 30);
if (Math.abs(majorBonus30 - 0.30) > 0.0001) fail(`30★ major bonus expected 0.30, got ${majorBonus30}`);
else ok('30★ major bonus = +30%');

const minorBonus30 = gp.getGrowthBonusForStat('def', { major: [], minor: ['def'], trace: [], locked: [] }, 30);
if (Math.abs(minorBonus30 - 0.18) > 0.0001) fail(`30★ minor bonus expected 0.18, got ${minorBonus30}`);
else ok('30★ minor bonus = +18%');

const traceBonus30 = gp.getGrowthBonusForStat('spd', { major: [], minor: [], trace: ['spd'], locked: [] }, 30);
if (Math.abs(traceBonus30 - 0.09) > 0.0001) fail(`30★ trace bonus expected 0.09, got ${traceBonus30}`);
else ok('30★ trace bonus = +9%');

const lockedBonus = gp.getGrowthBonusForStat('acc', rogueProfile, 30);
if (lockedBonus !== 0) fail('ACC locked at 30 stars');
else ok('ACC locked at 30 stars');

const scaledMajor = gp.applyFeatherGrowthToStat(10, 'atk', { major: ['atk'], minor: [], trace: [], locked: [] }, 30);
if (scaledMajor !== 13) fail(`major 30★ on ATK 10 expected 13, got ${scaledMajor}`);
else ok('applyFeatherGrowthToStat major 30★');

const scaledLocked = gp.applyFeatherGrowthToStat(90, 'acc', rogueProfile, 30);
if (scaledLocked !== 90) fail(`locked ACC should stay 90, got ${scaledLocked}`);
else ok('locked stat unchanged');

const tierMajorRatio = tiers.getEffectiveStatMultiplier('orange', 0);
if (Math.abs(tierMajorRatio - 1.25) > 0.0001) fail(`deprecated major ratio orange 0★ expected 1.25, got ${tierMajorRatio}`);
else ok('bird-card-tiers major-band compatibility ratio');

if (failed) process.exit(1);
console.log('[feather-growth] OK');
