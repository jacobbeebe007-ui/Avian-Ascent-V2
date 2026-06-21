/** Unit tests for curved defence combat formulas (mirrors combat-formulas.js). */

const DEFENCE_CURVE_VALUE = 25;
const LIGHT_ATTACK_POWER = 0.80;
const MEDIUM_ATTACK_POWER = 1.25;
const HEAVY_ATTACK_POWER = 1.75;
const LIGHT_ACCURACY_PENALTY = 0;
const MEDIUM_ACCURACY_PENALTY = 5;
const HEAVY_ACCURACY_PENALTY = 10;
const MIN_HIT_CHANCE = 15;
const MAX_HIT_CHANCE = 95;
const MIN_CRIT_CHANCE = 0;
const MAX_CRIT_CHANCE = 50;
const MIN_CRIT_DAMAGE_MULT = 1.25;
const BASE_CRIT_DAMAGE = 1.5;
const MAX_CRIT_DAMAGE_MULT = 2.0;
const PIERCE_CAP = 0.95;

function getAbilityPowerForEnCost(enCost) {
  const cost = Math.floor(Number(enCost) || 0);
  if (cost === 1) return LIGHT_ATTACK_POWER;
  if (cost === 2) return MEDIUM_ATTACK_POWER;
  if (cost === 3) return HEAVY_ATTACK_POWER;
  if (cost >= 4) return HEAVY_ATTACK_POWER;
  return LIGHT_ATTACK_POWER;
}

function effectiveDefence(rawDef, penFraction) {
  const d = Math.max(0, Number(rawDef) || 0);
  const pen = Math.min(PIERCE_CAP, Math.max(0, Number(penFraction) || 0));
  return Math.max(0, Math.floor(d * (1 - pen)));
}

function curvedDefenceMultiplier(effectiveDef) {
  const def = Math.max(0, Number(effectiveDef) || 0);
  return DEFENCE_CURVE_VALUE / (DEFENCE_CURVE_VALUE + def);
}

function calculateCurvedDamage(attackingStat, abilityPower, effectiveDef) {
  const stat = Math.max(0, Number(attackingStat) || 0);
  const power = Math.max(0, Number(abilityPower) || 0);
  const effDef = Math.max(0, Number(effectiveDef) || 0);
  return stat * power * curvedDefenceMultiplier(effDef);
}

function clampHitChancePct(pct) {
  return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, Number(pct) || 0));
}

function clampCritChancePct(pct) {
  return Math.max(MIN_CRIT_CHANCE, Math.min(MAX_CRIT_CHANCE, Number(pct) || 0));
}

function clampCritDamageMult(mult) {
  return Math.max(MIN_CRIT_DAMAGE_MULT, Math.min(MAX_CRIT_DAMAGE_MULT, Number(mult) || BASE_CRIT_DAMAGE));
}

function calculateAbilityHitChancePct(attackerAcc, targetDodge, accuracyPenalty) {
  const acc = Math.max(0, Number(attackerAcc) || 0);
  const dodge = Math.max(0, Number(targetDodge) || 0);
  const penalty = Math.max(0, Number(accuracyPenalty) || 0);
  return clampHitChancePct(acc - dodge - penalty);
}

function applyMinimumDamage(damage, enCost) {
  const floor = Math.max(0, Math.floor(Number(enCost) || 0)) * 2;
  return Math.max(floor, Number(damage) || 0);
}

function roundCurvedDamage(damage) {
  const n = Number(damage) || 0;
  if (n <= 0) return 0;
  return Math.max(0.01, Math.round(n * 100) / 100);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('OK:', msg);
}

// Crow example: 16 ATK, 2 EN (1.25x), 6 DEF → ~16.13 damage (2dp)
const crowDmg = roundCurvedDamage(calculateCurvedDamage(16, MEDIUM_ATTACK_POWER, 6));
assert(Math.abs(crowDmg - 16.13) < 0.01, `Crow 16 ATK 2 EN vs 6 DEF ≈ 16.13 (got ${crowDmg})`);

// Minimum damage floors
const min1 = applyMinimumDamage(roundCurvedDamage(calculateCurvedDamage(1, LIGHT_ATTACK_POWER, 0)), 1);
assert(min1 >= 2, `1 EN min floor >= 2 (got ${min1})`);
const min3 = applyMinimumDamage(roundCurvedDamage(calculateCurvedDamage(1, HEAVY_ATTACK_POWER, 50)), 3);
assert(min3 >= 6, `3 EN min floor >= 6 (got ${min3})`);

// Hit chance clamps
assert(calculateAbilityHitChancePct(200, 0, 0) === 95, 'hit clamp max 95%');
assert(calculateAbilityHitChancePct(10, 80, 0) === 15, 'hit clamp min 15%');
assert(calculateAbilityHitChancePct(82, 20, 12) === 50, 'heavy hit example 50%');

// Crit clamps
assert(clampCritChancePct(20) === 20, 'crit 20%');
assert(clampCritChancePct(60) === 50, 'crit cap 50%');
assert(clampCritDamageMult(1.5) === 1.5, 'crit dmg base 1.5');
assert(clampCritDamageMult(2.5) === 2, 'crit dmg cap 2.0');

// Armour penetration: 50% pen vs 10 DEF → effective 5
const eff5 = effectiveDefence(10, 0.5);
assert(eff5 === 5, `50% pen vs 10 DEF → effective 5 (got ${eff5})`);
const penDmg = roundCurvedDamage(calculateCurvedDamage(16, MEDIUM_ATTACK_POWER, eff5));
const expectedPen = roundCurvedDamage(16 * 1.25 * 25 / (25 + 5));
assert(penDmg === expectedPen, `penetration curve damage matches (got ${penDmg}, expected ${expectedPen})`);

// Ability power mapping
assert(getAbilityPowerForEnCost(1) === 0.80, '1 EN → 0.80');
assert(getAbilityPowerForEnCost(2) === 1.25, '2 EN → 1.25');
assert(getAbilityPowerForEnCost(3) === 1.75, '3 EN → 1.75');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log(`\nAll combat formula tests passed.`);
