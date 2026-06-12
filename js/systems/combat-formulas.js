/* Avian Ascent — Curved defence combat formulas.
 *
 * Why curved defence instead of subtraction (ATK - DEF)?
 * Linear subtraction creates hard breakpoints: low-DEF targets melt instantly
 * while high-DEF targets become nearly immune. The curve
 *   damage = stat × power × K / (K + effectiveDef)
 * gives smooth diminishing returns — every point of DEF still matters, but
 * never zeroes out damage entirely. K (DEFENCE_CURVE_VALUE) tunes how quickly
 * defence softens hits without rebalance cliff edges.
 */
(function () {
  'use strict';

  var DEFENCE_CURVE_VALUE = 25;
  var LIGHT_ATTACK_POWER = 0.80;
  var MEDIUM_ATTACK_POWER = 1.25;
  var HEAVY_ATTACK_POWER = 1.75;
  var LIGHT_ACCURACY_PENALTY = 0;
  var MEDIUM_ACCURACY_PENALTY = 5;
  var HEAVY_ACCURACY_PENALTY = 10;
  var MIN_HIT_CHANCE = 40;
  var MAX_HIT_CHANCE = 95;
  var BASE_CRIT_DAMAGE = 1.5;
  var PIERCE_CAP = 0.95;
  var BURNING_DEF_MULT = 0.8;

  function clampPen(pen) {
    return Math.min(PIERCE_CAP, Math.max(0, Number(pen) || 0));
  }

  function getAbilityPowerForEnCost(enCost) {
    var cost = Math.floor(Number(enCost) || 0);
    if (cost === 1) return LIGHT_ATTACK_POWER;
    if (cost === 2) return MEDIUM_ATTACK_POWER;
    if (cost === 3) return HEAVY_ATTACK_POWER;
    if (cost >= 4) return HEAVY_ATTACK_POWER;
    return LIGHT_ATTACK_POWER;
  }

  function getAccuracyPenaltyForEnCost(enCost) {
    var cost = Math.floor(Number(enCost) || 0);
    if (cost === 1) return LIGHT_ACCURACY_PENALTY;
    if (cost === 2) return MEDIUM_ACCURACY_PENALTY;
    if (cost === 3) return HEAVY_ACCURACY_PENALTY;
    if (cost >= 4) return HEAVY_ACCURACY_PENALTY;
    return LIGHT_ACCURACY_PENALTY;
  }

  /** Map legacy edmg mult to ability power tier. */
  function getAbilityPowerForLegacyMult(mult) {
    var m = Number(mult) || 1;
    if (m <= 0.85) return LIGHT_ATTACK_POWER;
    if (m <= 1.2) return MEDIUM_ATTACK_POWER;
    return HEAVY_ATTACK_POWER;
  }

  function applyBurningDefModifier(rawDef, burning) {
    var d = Math.max(0, Number(rawDef) || 0);
    if (burning) d = Math.floor(d * BURNING_DEF_MULT);
    return d;
  }

  function effectiveDefence(rawDef, penFraction, opts) {
    opts = opts || {};
    var d = applyBurningDefModifier(rawDef, opts.burning);
    var pen = clampPen(penFraction);
    return Math.max(0, Math.floor(d * (1 - pen)));
  }

  function curvedDefenceMultiplier(effectiveDef) {
    var def = Math.max(0, Number(effectiveDef) || 0);
    return DEFENCE_CURVE_VALUE / (DEFENCE_CURVE_VALUE + def);
  }

  function calculateCurvedDamage(attackingStat, abilityPower, effectiveDef) {
    var stat = Math.max(0, Number(attackingStat) || 0);
    var power = Math.max(0, Number(abilityPower) || 0);
    var effDef = Math.max(0, Number(effectiveDef) || 0);
    return stat * power * curvedDefenceMultiplier(effDef);
  }

  function clampHitChancePct(pct) {
    return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, Number(pct) || 0));
  }

  function calculateAbilityHitChancePct(attackerAcc, targetDodge, enCost) {
    var acc = Math.max(0, Number(attackerAcc) || 0);
    var dodge = Math.max(0, Number(targetDodge) || 0);
    var penalty = getAccuracyPenaltyForEnCost(enCost);
    return clampHitChancePct(acc - dodge - penalty);
  }

  function applyMinimumDamage(damage, enCost) {
    var dmg = Math.max(0, Number(damage) || 0);
    var floor = Math.max(0, Math.floor(Number(enCost) || 0)) * 2;
    return Math.max(floor, dmg);
  }

  function roundCurvedDamage(damage) {
    return Math.max(0, Math.round(Number(damage) || 0));
  }

  var combat = {
    DEFENCE_CURVE_VALUE: DEFENCE_CURVE_VALUE,
    LIGHT_ATTACK_POWER: LIGHT_ATTACK_POWER,
    MEDIUM_ATTACK_POWER: MEDIUM_ATTACK_POWER,
    HEAVY_ATTACK_POWER: HEAVY_ATTACK_POWER,
    LIGHT_ACCURACY_PENALTY: LIGHT_ACCURACY_PENALTY,
    MEDIUM_ACCURACY_PENALTY: MEDIUM_ACCURACY_PENALTY,
    HEAVY_ACCURACY_PENALTY: HEAVY_ACCURACY_PENALTY,
    MIN_HIT_CHANCE: MIN_HIT_CHANCE,
    MAX_HIT_CHANCE: MAX_HIT_CHANCE,
    BASE_CRIT_DAMAGE: BASE_CRIT_DAMAGE,
    PIERCE_CAP: PIERCE_CAP,
    BURNING_DEF_MULT: BURNING_DEF_MULT,
    getAbilityPowerForEnCost: getAbilityPowerForEnCost,
    getAccuracyPenaltyForEnCost: getAccuracyPenaltyForEnCost,
    getAbilityPowerForLegacyMult: getAbilityPowerForLegacyMult,
    effectiveDefence: effectiveDefence,
    curvedDefenceMultiplier: curvedDefenceMultiplier,
    calculateCurvedDamage: calculateCurvedDamage,
    clampHitChancePct: clampHitChancePct,
    calculateAbilityHitChancePct: calculateAbilityHitChancePct,
    applyMinimumDamage: applyMinimumDamage,
    roundCurvedDamage: roundCurvedDamage,
    applyBurningDefModifier: applyBurningDefModifier,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.combat = combat;

  globalThis.DEFENCE_CURVE_VALUE = DEFENCE_CURVE_VALUE;
  globalThis.LIGHT_ATTACK_POWER = LIGHT_ATTACK_POWER;
  globalThis.MEDIUM_ATTACK_POWER = MEDIUM_ATTACK_POWER;
  globalThis.HEAVY_ATTACK_POWER = HEAVY_ATTACK_POWER;
  globalThis.LIGHT_ACCURACY_PENALTY = LIGHT_ACCURACY_PENALTY;
  globalThis.MEDIUM_ACCURACY_PENALTY = MEDIUM_ACCURACY_PENALTY;
  globalThis.HEAVY_ACCURACY_PENALTY = HEAVY_ACCURACY_PENALTY;
  globalThis.MIN_HIT_CHANCE = MIN_HIT_CHANCE;
  globalThis.MAX_HIT_CHANCE = MAX_HIT_CHANCE;
  globalThis.BASE_CRIT_DAMAGE = BASE_CRIT_DAMAGE;
  globalThis.getAbilityPowerForEnCost = getAbilityPowerForEnCost;
  globalThis.getAccuracyPenaltyForEnCost = getAccuracyPenaltyForEnCost;
  globalThis.getAbilityPowerForLegacyMult = getAbilityPowerForLegacyMult;
  globalThis.effectiveDefence = effectiveDefence;
  globalThis.curvedDefenceMultiplier = curvedDefenceMultiplier;
  globalThis.calculateCurvedDamage = calculateCurvedDamage;
  globalThis.clampHitChancePct = clampHitChancePct;
  globalThis.calculateAbilityHitChancePct = calculateAbilityHitChancePct;
  globalThis.applyMinimumDamage = applyMinimumDamage;
  globalThis.roundCurvedDamage = roundCurvedDamage;

  function logCrowSanityCheck() {
    try {
      var AvianRef = globalThis.Avian;
      if (!AvianRef || !AvianRef.debug || !AvianRef.debug.enabled) return;
      var dmg = roundCurvedDamage(calculateCurvedDamage(16, MEDIUM_ATTACK_POWER, 6));
      console.log('[combat-formula] Crow check: ATK=16 EN=2 DEF=6 → ' + dmg);
    } catch (_) {}
  }
  combat.logCrowSanityCheck = logCrowSanityCheck;
})();
