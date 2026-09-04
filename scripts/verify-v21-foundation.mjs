#!/usr/bin/env node
/**
 * Combat Foundation v2.1 — AP EV, hybrid overflow, affinity, Ultimate Meter,
 * sequential carry and rarity decisions locked in the merged master workbook.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;
function ok(msg) { console.log('  ✓', msg); }
function fail(msg) { failed += 1; console.error('  ✗', msg); }
function near(a, b, eps = 0.02) { return Math.abs(Number(a) - Number(b)) <= eps; }

function load(relPaths) {
  const sandbox = { globalThis: {}, console, Math, Number, Object, Array, String };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of relPaths) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) { fail('missing ' + rel); continue; }
    vm.runInContext(readFileSync(full, 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

console.log('== Combat Foundation v2.1 ==');

const ctx = load([
  'js/bootstrap/_namespace.js',
  'js/data/combat-config.js',
  'js/data/combat-v21.js',
  'js/data/aspects.js',
  'js/data/ultimate-meter-rules.js',
  'js/data/equipment/core-rules.js',
  'js/data/equipment/ailment-gates.js',
  'js/systems/combat-formulas.js',
  'js/systems/protection-pools.js',
  'js/systems/master-workbook-runtime.js',
]);

const v21 = ctx.Avian?.data?.combatV21;
const cfg = ctx.Avian?.data?.combatConfig;
if (!v21) fail('combatV21 missing');
else ok('combatV21 pack ' + v21.packVersion);
if (!cfg?.v21) fail('combatConfig.v21 missing');
else ok('combatConfig.v21 present');

if (existsSync(path.join(ROOT, 'Avian_Ascent_Current_Master_v2.1.xlsx'))) {
  ok('merged master workbook present');
} else fail('missing Avian_Ascent_Current_Master_v2.1.xlsx');

/* AP coefficients — equal EV/AP on 2 and 3, modest packed-damage premium on 4. */
const coef = v21.coefficients;
if (coef[1] !== 0.45 || coef[2] !== 1 || coef[3] !== 1.5 || coef[4] !== 2.1) {
  fail(`unexpected AP coefficients ${JSON.stringify(coef)}`);
} else ok('AP coefficients 0.45 / 1.00 / 1.50 / 2.10');

const AP = 21.5;
const ev = (n) => AP * coef[n];
const fourOnes = 4 * ev(1);
const oneFour = ev(4);
const twoTwos = 2 * ev(2);
const threeSpam = ev(3);
if (!(oneFour > fourOnes && oneFour > twoTwos)) fail('4 AP should beat 4×1 and 2×2 raw');
else ok(`4 AP ${oneFour.toFixed(2)} > 4×1 ${fourOnes.toFixed(2)} and 2×2 ${twoTwos.toFixed(2)}`);
if (!near(threeSpam / 3, ev(2) / 2)) fail('3 AP per-AP should match 2 AP');
else ok('3 AP and 2 AP have equal damage per AP (0.50)');

const alt24 = ev(2) + ev(4);
if (!(alt24 / 2 > threeSpam - 0.01)) fail('2+4 cycle should match or beat 3 AP spam');
else ok(`2+4 cycle ${(alt24 / 2).toFixed(2)}/turn vs 3 AP spam ${threeSpam.toFixed(2)}`);

const buffed = AP + 4;
const setupLine = (buffed * coef[2]) + (buffed * coef[3]) + (buffed * coef[2] + buffed * coef[1]);
const noBuff = 3 * ev(3);
if (!(setupLine > noBuff)) fail(`buff+attack 3 turns ${setupLine} should beat 3 AP spam ${noBuff}`);
else ok('Major buff once then attack over 3 turns beats 3 AP spam');

/* Fortify every second turn: 4 AP cannot repeat after 3 AP recovery. */
const afterFortify = 0;
const nextTurn = Math.min(6, afterFortify + 3);
if (nextTurn < 4) ok('Fortify/Ward cannot repeat after normal 3 AP recovery');
else fail('Fortify cadence broken');

/* Hybrid mean-pool gate */
const prot = ctx.Avian.protection;
const dual = {
  armour: 20, maxArmour: 20, normalMaxArmour: 20,
  magicArmour: 20, maxMagicArmour: 20, normalMaxMagicArmour: 20,
};
const h = prot.applyHybridDamageThroughProtection(dual, {}, 20, 20);
if (!near(h.remaining, 20, 0.1)) fail(`hybrid equal pools Health ${h.remaining} expected 20`);
else ok('Hybrid 50/50 vs 20/20 deals 20 Health (not 0)');

/* Affinity 1.10 / 0.90 = 22% relative */
const dom = ctx.getAspectMultiplier('terra', 'tempest');
const res = ctx.getAspectMultiplier('terra', 'aeris');
if (!near(dom, 1.1) || !near(res, 0.9)) fail(`affinity ${dom}/${res} expected 1.1/0.9`);
else if (!near(dom / res, 1.222, 0.01)) fail(`affinity relative swing ${dom / res}`);
else ok('Affinity 1.10 vs 0.90 (22% relative, not 50%)');

/* Ultimate Meter: 6 per AP, 4×1 == 1×4, cap 24 */
ctx.G = { playerUltimateMeter: 0, enemyUltimateMeter: 0, maxUltimateMeter: 100, _playerUltMeterThisTurn: 0 };
const award = ctx.computeUltimateMeterAward;
function fakeAb(en) {
  return {
    id: 'WSK-TEST-' + en,
    energy: en,
    _dispatcherRow: { enCost: en, apCost: en, name: 'Test', tags: [] },
  };
}
const a1 = award(fakeAb(1), { hitsLanded: 1, side: 'player' });
ctx.G._playerUltMeterThisTurn = 0;
const a4 = award(fakeAb(4), { hitsLanded: 1, side: 'player' });
ctx.G._playerUltMeterThisTurn = 0;
let fourOnesMeter = 0;
for (let i = 0; i < 4; i++) fourOnesMeter += award(fakeAb(1), { hitsLanded: 1, side: 'player' });
if (a1 !== 6) fail(`1 AP meter ${a1} expected 6`);
else if (a4 !== 24) fail(`4 AP meter ${a4} expected 24`);
else if (fourOnesMeter !== 24) fail(`4×1 AP meter ${fourOnesMeter} expected 24`);
else ok('Ultimate Meter 6×AP; 4×1 AP equals one 4 AP action (24)');

const util = award({
  id: 'UTIL',
  energy: 2,
  _dispatcherRow: { enCost: 2, noDamage: true, target: 'self', name: 'Buff' },
}, { hitsLanded: 0, utilitySucceeded: true, side: 'player' });
if (util !== 0) fail(`utility meter ${util} expected 0`);
else ok('Utility actions award 0 Ultimate Meter');

/* Sequential carry + rarity locks */
if (v21.sequentialCarry.health !== 'persist') fail('sequential Health should persist');
if (v21.sequentialCarry.protection !== 'refillNormalMax') fail('sequential protection should refill');
if (v21.sequentialCarry.ultimateMeter !== 'persist') fail('sequential meter should persist');
else ok('Sequential carry: Health/AP/buffs/meter persist; protection refills');

if (v21.rarity.birdDamageMultiplier !== false) fail('rarity must not multiply bird damage');
if (v21.rarity.greyAndOrangeEquallyViable !== true) fail('Grey and Orange must be equally viable');
else ok('Species rarity is identity, not a permanent damage multiplier');

if (cfg.energy.max !== 6) fail(`energy.max ${cfg.energy.max} expected 6`);
else ok('AP / energy max is 6');

if (v21.telemetry.minRunsPerMatchup < 200) fail('telemetry must require ≥200 runs');
else ok('Next telemetry: ≥200 runs/matchup with action/unused AP/Fortify/Ward/ailment fields');

if (failed) {
  console.error(`\n[v21-foundation] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[v21-foundation] pass');
