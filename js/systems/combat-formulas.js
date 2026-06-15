/* Avian Ascent — Curved defence combat formulas.
 *
 * Abilities already encode EN-based scaling through Base Damage + ATK%/MATK%
 * in the combat-pack skill tree rows. The engine must NOT apply an extra
 * Light/Medium/Heavy or EN-cost damage multiplier (no 1 EN = 0.80x, etc.).
 *
 * Why curved defence instead of subtraction (raw - DEF)?
 * Linear subtraction creates hard breakpoints: low-DEF targets melt instantly
 * while high-DEF targets become nearly immune. The curve
 *   mitigated = raw × K / (K + effectiveDef)
 * gives smooth diminishing returns — every point of DEF still matters, but
 * never zeroes out damage entirely. K (DEFENCE_CURVE_VALUE) tunes how quickly
 * defence softens hits without rebalance cliff edges.
 */
(function () {
  'use strict';

  var DEFENCE_CURVE_VALUE = 25;
  var MIN_DAMAGE_1_EN = 1;
  var MIN_DAMAGE_2_EN = 3;
  var MIN_DAMAGE_3_EN = 5;
  var ACCURACY_PENALTY_1_EN = 0;
  var ACCURACY_PENALTY_2_EN = 5;
  var ACCURACY_PENALTY_3_EN = 10;
  var MIN_HIT_CHANCE = 40;
  var MAX_HIT_CHANCE = 95;
  var BASE_CRIT_DAMAGE = 1.5;
  var PIERCE_CAP = 0.95;
  var BURNING_DEF_MULT = 0.8;

  /** @deprecated Legacy EN power tiers — not used for ability damage. Kept for migration references only. */
  var LIGHT_ATTACK_POWER = 0.80;
  var MEDIUM_ATTACK_POWER = 1.25;
  var HEAVY_ATTACK_POWER = 1.75;
  var LIGHT_ACCURACY_PENALTY = ACCURACY_PENALTY_1_EN;
  var MEDIUM_ACCURACY_PENALTY = ACCURACY_PENALTY_2_EN;
  var HEAVY_ACCURACY_PENALTY = ACCURACY_PENALTY_3_EN;

  function clampPen(pen) {
    return Math.min(PIERCE_CAP, Math.max(0, Number(pen) || 0));
  }

  function scaleStatKey(scaleStat) {
    var key = String(scaleStat || 'ATK').toUpperCase();
    if (key === 'MATK' || key === 'MATT') return 'matk';
    if (key === 'SPD') return 'spd';
    if (key === 'DEF') return 'def';
    if (key === 'MDEF') return 'mdef';
    if (key === 'ACC') return 'acc';
    if (key === 'DODGE') return 'dodge';
    return 'atk';
  }

  function statValueForScale(stats, scaleStat) {
    if (!stats) return 0;
    var k = scaleStatKey(scaleStat);
    return Math.max(0, Number(stats[k]) || 0);
  }

  /** Raw damage from ability row: Base + primary stat% + secondary stat%. Percentages are decimals (/100). */
  function computeAbilityRawDamage(row, stats) {
    if (!row) return 0;
    var base = Number(row.baseFlat) || 0;
    var primary = 0;
    var secondary = 0;
    var pct1 = Number(row.scalePct) || 0;
    if (pct1 > 0) {
      primary = statValueForScale(stats, row.scaleStat) * (pct1 / 100);
    }
    var pct2 = Number(row.secondaryScalePct) || 0;
    if (pct2 > 0 && row.secondaryScaleStat) {
      secondary = statValueForScale(stats, row.secondaryScaleStat) * (pct2 / 100);
    }
    return base + primary + secondary;
  }

  function getAccuracyPenaltyForEnCost(enCost) {
    var cost = Math.floor(Number(enCost) || 0);
    if (cost === 1) return ACCURACY_PENALTY_1_EN;
    if (cost === 2) return ACCURACY_PENALTY_2_EN;
    if (cost === 3) return ACCURACY_PENALTY_3_EN;
    if (cost >= 4) return ACCURACY_PENALTY_3_EN;
    return ACCURACY_PENALTY_1_EN;
  }

  /** @deprecated Not used for pack ability damage. */
  function getAbilityPowerForEnCost(enCost) {
    var cost = Math.floor(Number(enCost) || 0);
    if (cost === 1) return LIGHT_ATTACK_POWER;
    if (cost === 2) return MEDIUM_ATTACK_POWER;
    if (cost === 3) return HEAVY_ATTACK_POWER;
    if (cost >= 4) return HEAVY_ATTACK_POWER;
    return LIGHT_ATTACK_POWER;
  }

  /** @deprecated Not used for pack ability damage. */
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

  /** Apply curved defence to a pre-computed raw damage value. */
  function mitigatedDamage(rawDamage, effectiveDef) {
    var raw = Math.max(0, Number(rawDamage) || 0);
    return raw * curvedDefenceMultiplier(effectiveDef);
  }

  /** @deprecated Use mitigatedDamage(raw, effDef) instead of stat × power. */
  function calculateCurvedDamage(attackingStat, abilityPower, effectiveDef) {
    var stat = Math.max(0, Number(attackingStat) || 0);
    var power = Math.max(0, Number(abilityPower) || 0);
    return stat * power * curvedDefenceMultiplier(effectiveDef);
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

  function minimumDamageForEnCost(enCost) {
    var cost = Math.floor(Number(enCost) || 0);
    if (cost <= 1) return MIN_DAMAGE_1_EN;
    if (cost === 2) return MIN_DAMAGE_2_EN;
    if (cost === 3) return MIN_DAMAGE_3_EN;
    return MIN_DAMAGE_3_EN;
  }

  function applyMinimumDamage(damage, enCost) {
    var dmg = Math.max(0, Number(damage) || 0);
    return Math.max(minimumDamageForEnCost(enCost), dmg);
  }

  /** Sum normal damage bonuses additively: 1 + 0.10 + 0.15 = 1.25 */
  function sumAdditiveDamageBonus(fractions) {
    var total = 1;
    if (!Array.isArray(fractions)) return total;
    for (var i = 0; i < fractions.length; i++) {
      var f = Number(fractions[i]) || 0;
      if (f) total += f;
    }
    return total;
  }

  function roundCurvedDamage(damage) {
    var n = Number(damage) || 0;
    if (n <= 0) return 0;
    return Math.max(0.01, Math.round(n * 100) / 100);
  }

  /** Self-test: Treasure Ambush — base 5 + 68% ATK + 22% MATK vs DEF 6 → ~14.22 */
  function runDamageFormulaSelfTest() {
    var treasureRow = {
      baseFlat: 5,
      scaleStat: 'ATK',
      scalePct: 68,
      secondaryScaleStat: 'MATK',
      secondaryScalePct: 22,
      apCost: 2,
    };
    var stats = { atk: 16, matk: 8 };
    var raw = computeAbilityRawDamage(treasureRow, stats);
    var mitigated = mitigatedDamage(raw, 6);
    var final = roundCurvedDamage(mitigated);
    var okRaw = Math.abs(raw - 17.64) < 0.01;
    var okFinal = Math.abs(final - 14.22) < 0.01;
    return {
      ok: okRaw && okFinal,
      raw: raw,
      mitigated: mitigated,
      final: final,
      treasureAmbush: { okRaw: okRaw, okFinal: okFinal },
    };
  }

  /** Self-test: Bower Lure spell — uses MDEF not DEF */
  function runBowerLureSelfTest() {
    var row = {
      baseFlat: 2,
      scaleStat: 'MATK',
      scalePct: 38,
      secondaryScaleStat: 'ATK',
      secondaryScalePct: 28,
      apCost: 1,
    };
    var stats = { atk: 16, matk: 8 };
    var raw = computeAbilityRawDamage(row, stats);
    var mitigatedDef = mitigatedDamage(raw, 6);
    var mitigatedMdef = mitigatedDamage(raw, 4);
    return {
      ok: raw > 0 && mitigatedMdef !== mitigatedDef,
      raw: raw,
      vsDef6: mitigatedDef,
      vsMdef4: mitigatedMdef,
    };
  }

  var combat = {
    DEFENCE_CURVE_VALUE: DEFENCE_CURVE_VALUE,
    MIN_DAMAGE_1_EN: MIN_DAMAGE_1_EN,
    MIN_DAMAGE_2_EN: MIN_DAMAGE_2_EN,
    MIN_DAMAGE_3_EN: MIN_DAMAGE_3_EN,
    ACCURACY_PENALTY_1_EN: ACCURACY_PENALTY_1_EN,
    ACCURACY_PENALTY_2_EN: ACCURACY_PENALTY_2_EN,
    ACCURACY_PENALTY_3_EN: ACCURACY_PENALTY_3_EN,
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
    scaleStatKey: scaleStatKey,
    statValueForScale: statValueForScale,
    computeAbilityRawDamage: computeAbilityRawDamage,
    mitigatedDamage: mitigatedDamage,
    sumAdditiveDamageBonus: sumAdditiveDamageBonus,
    minimumDamageForEnCost: minimumDamageForEnCost,
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
    runDamageFormulaSelfTest: runDamageFormulaSelfTest,
    runBowerLureSelfTest: runBowerLureSelfTest,
  };

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.combat = combat;

  globalThis.DEFENCE_CURVE_VALUE = DEFENCE_CURVE_VALUE;
  globalThis.MIN_DAMAGE_1_EN = MIN_DAMAGE_1_EN;
  globalThis.MIN_DAMAGE_2_EN = MIN_DAMAGE_2_EN;
  globalThis.MIN_DAMAGE_3_EN = MIN_DAMAGE_3_EN;
  globalThis.ACCURACY_PENALTY_1_EN = ACCURACY_PENALTY_1_EN;
  globalThis.ACCURACY_PENALTY_2_EN = ACCURACY_PENALTY_2_EN;
  globalThis.ACCURACY_PENALTY_3_EN = ACCURACY_PENALTY_3_EN;
  globalThis.LIGHT_ATTACK_POWER = LIGHT_ATTACK_POWER;
  globalThis.MEDIUM_ATTACK_POWER = MEDIUM_ATTACK_POWER;
  globalThis.HEAVY_ATTACK_POWER = HEAVY_ATTACK_POWER;
  globalThis.LIGHT_ACCURACY_PENALTY = LIGHT_ACCURACY_PENALTY;
  globalThis.MEDIUM_ACCURACY_PENALTY = MEDIUM_ACCURACY_PENALTY;
  globalThis.HEAVY_ACCURACY_PENALTY = HEAVY_ACCURACY_PENALTY;
  globalThis.MIN_HIT_CHANCE = MIN_HIT_CHANCE;
  globalThis.MAX_HIT_CHANCE = MAX_HIT_CHANCE;
  globalThis.BASE_CRIT_DAMAGE = BASE_CRIT_DAMAGE;
  globalThis.computeAbilityRawDamage = computeAbilityRawDamage;
  globalThis.mitigatedDamage = mitigatedDamage;
  globalThis.sumAdditiveDamageBonus = sumAdditiveDamageBonus;
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
})();
