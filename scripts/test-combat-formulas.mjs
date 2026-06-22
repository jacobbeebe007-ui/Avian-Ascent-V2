/** Unit tests for combat-formulas.js primitives (master damage system).
 *
 * Loads the real js/systems/combat-formulas.js so these assertions track the
 * shipped constants/helpers. Legacy EN power-tier scaling (0.80/1.25/1.75) and
 * the 1/3/5 EN minimum-damage floors have been removed from the engine, so the
 * tests below validate the current curved-defence helpers, hit/crit clamps, and
 * the master EN base / stat-modifier behaviour instead.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const formulasSrc = readFileSync(path.resolve('js/systems/combat-formulas.js'), 'utf8');
const sandbox = { console, Math, Number, Object, Array, String, JSON, globalThis: null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(formulasSrc, sandbox, { filename: 'combat-formulas.js', timeout: 5000 });
const c = sandbox;
const combat = c.Avian.combat;

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('OK:', msg);
}
function near(a, b, eps = 0.001) { return Math.abs(Number(a) - Number(b)) <= eps; }

// Curved defence helper (legacy fallback path) still behaves smoothly.
assert(near(c.curvedDefenceMultiplier(0), 1), 'curved defence at 0 DEF = 1.0');
assert(c.curvedDefenceMultiplier(25) < 1 && c.curvedDefenceMultiplier(25) > 0, 'curved defence diminishes with DEF');

// Armour penetration: 50% pen vs 10 DEF -> effective 5
const eff5 = c.effectiveDefence(10, 0.5);
assert(eff5 === 5, `50% pen vs 10 DEF -> effective 5 (got ${eff5})`);
assert(c.effectiveDefence(10, 5) === Math.floor(10 * (1 - combat.PIERCE_CAP)), 'pierce is capped at PIERCE_CAP');

// Hit chance clamps
assert(c.calculateAbilityHitChancePct(200, 0, 0) === 95, 'hit clamp max 95%');
assert(c.calculateAbilityHitChancePct(10, 80, 0) === 15, 'hit clamp min 15%');
assert(c.calculateAbilityHitChancePct(82, 20, 12) === 50, 'heavy hit example 50%');

// Crit clamps — master spec: base 1.35, ceiling 1.50
assert(c.clampCritChancePct(20) === 20, 'crit chance 20%');
assert(c.clampCritChancePct(60) === 50, 'crit chance cap 50%');
assert(c.MASTER_BASE_CRIT_MULT === 1.35, 'base crit multiplier 1.35');
assert(c.MASTER_MAX_CRIT_MULT === 1.5, 'max crit multiplier 1.50');
assert(c.clampCritDamageMult(1.35) === 1.35, 'crit dmg base 1.35 passes through');
assert(c.clampCritDamageMult(2.5) === 1.5, 'crit dmg clamps to 1.50 ceiling');

// Master EN base damage budget
assert(c.getENBaseDamage(1) === 5, '1 EN base = 5');
assert(c.getENBaseDamage(2) === 11, '2 EN base = 11');
assert(c.getENBaseDamage(3) === 17, '3 EN base = 17');

// Stat modifier clamps to 0.90–1.15 around the class baseline
assert(near(c.getStatModifier(13, 13), 1.0), 'stat at baseline -> 1.00');
assert(c.getStatModifier(200, 13) === 1.15, 'high stat clamps to 1.15');
assert(c.getStatModifier(0, 50) === 0.90, 'low stat clamps to 0.90');

// Minimum damage floor is a flat 1 across all EN costs (no 1/3/5 tiers)
assert(combat.minimumDamageForEnCost(1) === 1 && combat.minimumDamageForEnCost(2) === 1 && combat.minimumDamageForEnCost(3) === 1, 'minimum damage floor is 1 for all EN costs');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log(`\nAll combat formula tests passed.`);
