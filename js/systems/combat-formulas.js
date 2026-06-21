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
  /** @deprecated EN-cost accuracy penalties removed; use power-tier penalty via calculateAbilityAccuracyPenalty. */
  var ACCURACY_PENALTY_1_EN = 0;
  var ACCURACY_PENALTY_2_EN = 0;
  var ACCURACY_PENALTY_3_EN = 0;
  var MIN_HIT_CHANCE = 15;
  var MAX_HIT_CHANCE = 95;
  var MIN_CRIT_CHANCE = 0;
  var MAX_CRIT_CHANCE = 50;
  var MIN_CRIT_DAMAGE_MULT = 1.25;
  var BASE_CRIT_DAMAGE = 1.5;
  var MAX_CRIT_DAMAGE_MULT = 2.0;
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

  /** @deprecated Always returns 0 — accuracy penalties use power-tier only. */
  function getAccuracyPenaltyForEnCost(_enCost) {
    return 0;
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

  function applyBurningDefModifier(rawDef, burningState) {
    var d = Math.max(0, Number(rawDef) || 0);
    if (!burningState) return d;
    var mult = 1;
    if (typeof globalThis.getBurningDefMult === 'function') {
      if (typeof burningState === 'object' && burningState !== null) {
        if (burningState.scorched) mult = globalThis.getBurningDefMult(0, true);
        else if (burningState.stacks || burningState.burning) mult = globalThis.getBurningDefMult(burningState.stacks || 1, false);
      } else if (burningState === true) {
        mult = globalThis.getBurningDefMult(1, false);
      }
    } else if (burningState) {
      mult = BURNING_DEF_MULT;
    }
    return Math.floor(d * mult);
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

  function clampCritChancePct(pct) {
    return Math.max(MIN_CRIT_CHANCE, Math.min(MAX_CRIT_CHANCE, Number(pct) || 0));
  }

  function clampCritDamageMult(mult) {
    return Math.max(MIN_CRIT_DAMAGE_MULT, Math.min(MAX_CRIT_DAMAGE_MULT, Number(mult) || BASE_CRIT_DAMAGE));
  }

  function calculateAbilityHitChancePct(attackerAcc, targetDodge, accuracyPenalty) {
    var acc = Math.max(0, Number(attackerAcc) || 0);
    var dodge = Math.max(0, Number(targetDodge) || 0);
    var penalty = Math.max(0, Number(accuracyPenalty) || 0);
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

  // ===== Master Damage System =================================================
  var EN_BASE_DAMAGE = { 1: 5, 2: 11, 3: 17 };
  var CLASS_BASELINES = {
    knight: 13, rogue: 10, mage: 22, siren: 15, inquisitor: 11, bard: 10, brute: 14, duke: 24,
  };
  var BONUS_CAP_NORMAL = 0.30;
  var BONUS_CAP_MUT_EQ = 0.45;
  var BONUS_CAP_BOSS = 0.50;
  var MASTER_BASE_CRIT_MULT = BASE_CRIT_DAMAGE;
  var MASTER_MAX_CRIT_MULT = MAX_CRIT_DAMAGE_MULT;
  var STAT_MOD_MIN = 0.90;
  var STAT_MOD_MAX = 1.15;
  var HYBRID_DEF_WEIGHTS = { def: 0.6, mdef: 0.4 };
  var ASPECT_IDS = ['terra', 'aeris', 'tempest', 'solis', 'lunae', 'maris'];

  function normalizeAspectId(value) {
    var s = String(value || '').trim().toLowerCase();
    return ASPECT_IDS.indexOf(s) >= 0 ? s : '';
  }

  function getAspectChart() {
    return (globalThis.Avian && Avian.data && Avian.data.aspects) || null;
  }

  function getEntityAspect(entity) {
    if (!entity) return '';
    var direct = normalizeAspectId(entity.aspect || entity.primaryAspect);
    if (direct) return direct;
    var bk = entity.birdKey || entity.portraitKey || '';
    if (bk && globalThis.BIRDS && globalThis.BIRDS[bk]) {
      return normalizeAspectId(globalThis.BIRDS[bk].aspect);
    }
    return '';
  }

  function getTypeModifier(attackerAspect, targetAspect, abilityRow) {
    var chart = getAspectChart();
    if (!chart || !chart.chart) return 1;
    var atkAsp = normalizeAspectId(attackerAspect);
    var tgtAsp = normalizeAspectId(targetAspect);
    if (!atkAsp || !tgtAsp) return chart.neutralMod || 1;
    var affinity = abilityRow && abilityRow.aspectAffinity ? String(abilityRow.aspectAffinity) : '';
    if (affinity && !/none|class-neutral|neutral/i.test(affinity)) {
      var affToken = affinity.split(/[\s/]+/).filter(Boolean)[0];
      var affAsp = normalizeAspectId(affToken);
      if (affAsp) atkAsp = affAsp;
    }
    var relRow = chart.chart[atkAsp];
    if (!relRow || !relRow[tgtAsp]) return chart.neutralMod || 1;
    var rel = relRow[tgtAsp];
    if (rel === 'dominant') return chart.dominantMod || 1.2;
    if (rel === 'resisted') return chart.resistedMod || 0.8;
    return chart.neutralMod || 1;
  }

  function isBloodiedTarget(target) {
    if (!target || !target.stats) return false;
    var hp = Number(target.stats.hp) || 0;
    var maxHp = Number(target.stats.maxHp) || 1;
    return hp > 0 && hp <= Math.floor(maxHp * 0.5);
  }

  function clampNum(n, min, max) {
    return Math.max(min, Math.min(max, Number(n) || 0));
  }

  function normalizeClassKey(className) {
    var raw = String(className || 'rogue').toLowerCase().replace(/[^a-z]/g, '');
    if (raw === 'dukeblakiston') return 'duke';
    return CLASS_BASELINES[raw] != null ? raw : 'rogue';
  }

  function getENBaseDamage(enCost) {
    var cost = Math.max(1, Math.min(3, Math.floor(Number(enCost) || 1)));
    return EN_BASE_DAMAGE[cost] || EN_BASE_DAMAGE[1];
  }

  function getClassBaseline(className) {
    return CLASS_BASELINES[normalizeClassKey(className)] || CLASS_BASELINES.rogue;
  }

  function statFromEntity(entity, key) {
    var stats = entity && entity.stats ? entity.stats : entity || {};
    var k = String(key || 'ATK').toUpperCase();
    if (k === 'HP' || k === 'MAXHP') return Math.max(0, Number(stats.maxHp || stats.hp) || 0);
    if (k === 'MATK' || k === 'MATT') return Math.max(0, Number(stats.matk) || 0);
    if (k === 'SPD') return Math.max(0, Number(stats.spd) || 0);
    if (k === 'DEF') return Math.max(0, Number(stats.def) || 0);
    if (k === 'MDEF') return Math.max(0, Number(stats.mdef) || 0);
    if (k === 'ACC') return Math.max(0, Number(stats.acc) || 0);
    if (k === 'DODGE') return Math.max(0, Number(stats.dodge) || 0);
    return Math.max(0, Number(stats.atk) || 0);
  }

  function inferDamageType(row) {
    if (!row) return 'Physical';
    if (row.damageType) return String(row.damageType);
    if (/true/i.test(String(row.category || '')) || (row.tags || []).some(function (t) { return /true/i.test(t); })) return 'True';
    if (/magic|song|spell/i.test(String(row.category || ''))) return 'Magic';
    if (String(row.damageStat || row.scaleStat || '').toUpperCase() === 'HYBRID') return 'Hybrid';
    if (row.secondaryScaleStat && (row.secondaryScalePct || 0) > 0) return 'Hybrid';
    if ((row.pierceDef || 0) > 0 && (row.pierceMdef || 0) > 0) return 'Hybrid';
    if ((row.pierceMdef || 0) > 0 && !(row.pierceDef || 0)) return 'Magic';
    return 'Physical';
  }

  function inferDamageStat(row) {
    if (!row) return 'ATK';
    if (row.damageStat) return String(row.damageStat).toUpperCase();
    if (row.secondaryScaleStat && (row.secondaryScalePct || 0) > 0) return 'HYBRID';
    return String(row.scaleStat || 'ATK').toUpperCase();
  }

  function buildHybridScaling(row) {
    if (row && row.hybridScaling && typeof row.hybridScaling === 'object') return row.hybridScaling;
    var primary = String(row.scaleStat || 'ATK').toUpperCase();
    var secondary = String(row.secondaryScaleStat || '').toUpperCase();
    var pPct = Math.max(0, Number(row.scalePct) || 0);
    var sPct = Math.max(0, Number(row.secondaryScalePct) || 0);
    var total = pPct + sPct;
    if (!secondary || total <= 0) return null;
    var out = {};
    out[primary] = pPct / total;
    out[secondary] = sPct / total;
    return out;
  }

  function inferAbilityPower(row) {
    if (!row || row.noDamage) return 0;
    if (row.abilityPower != null && Number.isFinite(Number(row.abilityPower))) return Number(row.abilityPower);
    var power = 1.0;
    var en = Math.max(1, Number(row.enCost || row.apCost) || 1);
    if (en <= 1) power = 0.95;
    else if (en === 2) power = 1.0;
    else power = 1.15;
    var ail = Number(row.ailmentChance) || 0;
    if (ail >= 30) power -= 0.20;
    else if (ail >= 15) power -= 0.12;
    else if (ail >= 5) power -= 0.05;
    if ((Number(row.lifestealPct) || 0) > 0) power -= 0.10;
    if ((row.pierceDef || 0) >= 25 || (row.pierceMdef || 0) >= 25) power -= 0.15;
    else if ((row.pierceDef || 0) > 0 || (row.pierceMdef || 0) > 0) power -= 0.08;
    if (row.riderText && row.riderText !== 'None') power -= 0.08;
    if ((row.hits || 1) > 1) power -= 0.05;
    var budget = (Number(row.baseFlat) || 0) + (Number(row.scalePct) || 0) * 0.01 + (Number(row.secondaryScalePct) || 0) * 0.01;
    if (budget >= 80) power += 0.10;
    else if (budget >= 55) power += 0.05;
    else if (budget <= 25) power -= 0.08;
    return clampNum(power, 0.65, 1.50);
  }

  function inferHeavyAccuracyPenalty(row) {
    if (row && row.heavyAccuracyPenalty != null) return Number(row.heavyAccuracyPenalty) || 0;
    var power = inferAbilityPower(row);
    if (power < 1.0) return 0;
    if (power >= 1.31) return 15;
    if (power >= 1.21) return 12;
    if (power >= 1.11) return 8;
    return 5;
  }

  function inferRecoilPercent(row) {
    if (row && row.recoilPercent != null) return Number(row.recoilPercent) || 0;
    var power = inferAbilityPower(row);
    if (power >= 1.31) return 0.20;
    if (power >= 1.21) return 0.15;
    return 0;
  }

  function mapLegacyRowToMasterDamage(row) {
    if (!row || typeof row !== 'object') return row;
    var damageType = inferDamageType(row);
    var damageStat = inferDamageStat(row);
    var hybridScaling = buildHybridScaling(row);
    var hybridDefenceScaling = row.hybridDefenceScaling || (damageType === 'Hybrid' ? HYBRID_DEF_WEIGHTS : null);
    var abilityPower = inferAbilityPower(row);
    var conditionalAbilityPower = row.conditionalAbilityPower != null ? Number(row.conditionalAbilityPower) : null;
    var condition = row.condition || null;
    if (!condition && row.riders && row.riders.length) {
      for (var i = 0; i < row.riders.length; i++) {
        var r = row.riders[i];
        if (r.kind === 'bonusVsAilment' && r.ailment === 'bleed') {
          condition = 'targetBleeding';
          conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
        } else if (r.kind === 'bonusVsLowHp') {
          condition = 'targetLowHp';
          conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
        }
      }
    }
    return Object.assign({}, row, {
      enCost: row.enCost != null ? row.enCost : (row.apCost || 1),
      damageType: damageType,
      damageStat: damageStat,
      hybridScaling: hybridScaling,
      hybridDefenceScaling: hybridDefenceScaling,
      abilityPower: abilityPower,
      conditionalAbilityPower: conditionalAbilityPower,
      condition: condition,
      heavyAccuracyPenalty: inferHeavyAccuracyPenalty(row),
      recoilPercent: inferRecoilPercent(row),
      piercePercent: row.piercePercent != null ? row.piercePercent : Math.max(Number(row.pierceDef) || 0, Number(row.pierceMdef) || 0) / 100,
      hitCount: row.hitCount != null ? row.hitCount : (row.hits || 1),
      canCrit: row.canCrit != null ? !!row.canCrit : !row.noDamage,
    });
  }

  function enrichCombatRow(row) {
    if (!row || row._masterDamageEnriched) return row;
    var mapped = mapLegacyRowToMasterDamage(row);
    Object.keys(mapped).forEach(function (k) { row[k] = mapped[k]; });
    row._masterDamageEnriched = true;
    return row;
  }

  function getRelevantAttackStat(attacker, ability) {
    var row = ability || {};
    enrichCombatRow(row);
    var statKey = String(row.damageStat || 'ATK').toUpperCase();
    if (statKey === 'TRUE') return 1;
    if (statKey === 'HYBRID' && row.hybridScaling) {
      var total = 0;
      for (var k in row.hybridScaling) {
        if (!Object.prototype.hasOwnProperty.call(row.hybridScaling, k)) continue;
        total += statFromEntity(attacker, k) * (Number(row.hybridScaling[k]) || 0);
      }
      return total;
    }
    return statFromEntity(attacker, statKey);
  }

  function getStatModifier(relevantStat, classBaseline) {
    var stat = Number(relevantStat) || 0;
    var base = Number(classBaseline) || CLASS_BASELINES.rogue;
    return clampNum(1 + (stat - base) / 100, STAT_MOD_MIN, STAT_MOD_MAX);
  }

  function getRelevantDefenceStat(target, ability) {
    var row = ability || {};
    enrichCombatRow(row);
    var damageType = String(row.damageType || 'Physical');
    if (damageType === 'True') return 0;
    if (damageType === 'Magic') return statFromEntity(target, 'MDEF');
    if (damageType === 'Hybrid') {
      var weights = row.hybridDefenceScaling || HYBRID_DEF_WEIGHTS;
      return (statFromEntity(target, 'DEF') * (Number(weights.def) || 0.6))
        + (statFromEntity(target, 'MDEF') * (Number(weights.mdef) || 0.4));
    }
    return statFromEntity(target, 'DEF');
  }

  function getDefenceModifier(relevantDefence, damageType, piercePercent, opts) {
    opts = opts || {};
    if (String(damageType || 'Physical') === 'True') return 1;
    var def = Math.max(0, Number(relevantDefence) || 0);
    if (opts.burning) def = applyBurningDefModifier(def, opts.burning);
    var pierce = clampPen(piercePercent);
    def = Math.max(0, def * (1 - pierce));
    return 100 / (100 + def * 3);
  }

  function getBonusCap(attacker, battleState) {
    battleState = battleState || {};
    if (attacker && (attacker.isBoss || attacker.enemyTier === 'boss')) return BONUS_CAP_BOSS;
    if (battleState.hasMutationEquipmentBonus) return BONUS_CAP_MUT_EQ;
    return BONUS_CAP_NORMAL;
  }

  function getTotalDamageBonus(bonusFractions, cap) {
    var total = 0;
    if (Array.isArray(bonusFractions)) {
      for (var i = 0; i < bonusFractions.length; i++) total += Number(bonusFractions[i]) || 0;
    }
    return Math.min(Math.max(0, cap), Math.max(0, total));
  }

  function conditionMet(condition, attacker, target, battleState) {
    if (!condition) return false;
    battleState = battleState || {};
    var es = battleState.enemyStatus || (target && target.status) || {};
    if (condition === 'targetBleeding') return (es.bleed && (es.bleed.stacks || 0) > 0);
    if (condition === 'targetBurning') {
      return !!(es.burning && ((typeof es.burning === 'number' && es.burning > 0)
        || (typeof es.burning === 'object' && (es.burning.turns || 0) > 0)));
    }
    if (condition === 'targetLowHp') {
      var hp = target && target.stats ? target.stats.hp : 0;
      var maxHp = target && target.stats ? target.stats.maxHp : 1;
      return hp > 0 && hp <= Math.floor(maxHp * 0.35);
    }
    if (condition === 'targetBloodied' || condition === 'bloodied') {
      return isBloodiedTarget(target);
    }
    if (condition === 'targetMarked') {
      var esMarked = battleState.enemyStatus || (target && target.status) || {};
      return !!(esMarked.marked && ((typeof esMarked.marked === 'number' && esMarked.marked > 0)
        || (typeof esMarked.marked === 'object' && (esMarked.marked.turns || 0) > 0)));
    }
    return false;
  }

  function getAbilityPower(ability, attacker, target, battleState) {
    var row = ability || {};
    enrichCombatRow(row);
    var power = Number(row.abilityPower) || 0;
    if (row.condition && row.conditionalAbilityPower != null && conditionMet(row.condition, attacker, target, battleState)) {
      power *= Number(row.conditionalAbilityPower) || 1;
    }
    return Math.max(0, power);
  }

  function calculateHeavyAccuracyPenalty(ability) {
    enrichCombatRow(ability || {});
    return Number(ability.heavyAccuracyPenalty) || 0;
  }

  function calculateAbilityAccuracyPenalty(ability) {
    return calculateHeavyAccuracyPenalty(ability);
  }

  function calculateRecoilDamage(finalDamage, ability) {
    enrichCombatRow(ability || {});
    var pct = Number(ability.recoilPercent) || 0;
    if (pct <= 0) return 0;
    return Math.max(1, Math.round(Math.max(0, Number(finalDamage) || 0) * pct));
  }

  function calculateMultiHitDamage(totalDamage, hitCount) {
    var total = Math.max(0, Math.round(Number(totalDamage) || 0));
    var hits = Math.max(1, Math.floor(Number(hitCount) || 1));
    var per = Math.floor(total / hits);
    var rem = total - per * hits;
    var out = [];
    for (var i = 0; i < hits; i++) out.push(per + (i < rem ? 1 : 0));
    return out;
  }

  function resolvePierceFraction(ability, isMagic) {
    enrichCombatRow(ability || {});
    if (ability.piercePercent != null) return clampPen(ability.piercePercent);
    if (isMagic) return clampPen((Number(ability.pierceMdef) || 0) / 100);
    return clampPen((Number(ability.pierceDef) || 0) / 100);
  }

  function calculateDamage(params) {
    params = params || {};
    if (params.hitSucceeded === false) return { damage: 0, preMitigation: 0, components: {} };
    var attacker = params.attacker || {};
    var target = params.target || {};
    var ability = params.ability || {};
    var battleState = params.battleState || {};
    enrichCombatRow(ability);
    if (ability.noDamage || getAbilityPower(ability, attacker, target, battleState) <= 0) {
      return { damage: 0, preMitigation: 0, components: {} };
    }
    var enCost = ability.enCost != null ? ability.enCost : (ability.apCost || 1);
    var enBase = getENBaseDamage(enCost);
    var abilityPower = getAbilityPower(ability, attacker, target, battleState);
    var relevantStat = getRelevantAttackStat(attacker, ability);
    var className = attacker.class || attacker.enemyClass || attacker.birdClass || 'rogue';
    var statMod = getStatModifier(relevantStat, getClassBaseline(className));
    var defStat = getRelevantDefenceStat(target, ability);
    var pierce = resolvePierceFraction(ability, String(ability.damageType) === 'Magic');
    var defMod = getDefenceModifier(defStat, ability.damageType, pierce, {
      burning: (function () {
        if (battleState.enemyHasBurning && typeof battleState.enemyHasBurning === 'object') return battleState.enemyHasBurning;
        if (params.targetBurning && typeof globalThis.enemyHasBurningStacks === 'function') return globalThis.enemyHasBurningStacks();
        return !!(battleState.enemyHasBurning || params.targetBurning);
      })(),
    });
    var bonusCap = getBonusCap(attacker, params);
    var bonusFrac = getTotalDamageBonus(params.bonusFractions, bonusCap);
    var bonusMod = 1 + bonusFrac;
    var attackerAspect = getEntityAspect(attacker);
    var targetAspect = getEntityAspect(target);
    var typeMod = getTypeModifier(attackerAspect, targetAspect, ability);
    var preCrit = enBase * abilityPower * statMod * defMod * typeMod * bonusMod;
    var damage = preCrit;
    if (params.isCriticalHit) {
      var critAdd = Number(params.critDamageAdd) || 0;
      var critMult = clampCritDamageMult((Number(params.critMultiplier) || MASTER_BASE_CRIT_MULT) + critAdd);
      damage *= critMult;
    }
    damage = Math.max(1, Math.round(damage));
    return {
      damage: damage,
      preMitigation: enBase * abilityPower * statMod,
      effectiveDef: defStat,
      components: {
        enBase: enBase,
        abilityPower: abilityPower,
        statMod: statMod,
        defMod: defMod,
        typeMod: typeMod,
        bonusMod: bonusMod,
        relevantStat: relevantStat,
        defStat: defStat,
      },
    };
  }

  function usesMasterDamage(row) {
    if (!row) return false;
    enrichCombatRow(row);
    return !row.noDamage && (row.abilityPower != null || row.damageStat != null);
  }

  function describeMasterAbility(row) {
    enrichCombatRow(row || {});
    if (!row || row.noDamage) return 'Utility ability.';
    var en = row.enCost || row.apCost || 1;
    var weight = en === 1 ? 'Light' : (en === 2 ? 'Medium' : 'Heavy');
    var dtype = String(row.damageType || 'Physical');
    var stat = String(row.damageStat || 'ATK');
    var bits = [
      'Deals ' + weight + ' ' + dtype + ' damage.',
      'Uses ' + stat + '.',
      'Ability Power: ' + (Number(row.abilityPower) || 0).toFixed(2) + '.',
    ];
    if ((row.heavyAccuracyPenalty || 0) > 0) bits.push('Heavy accuracy penalty: -' + row.heavyAccuracyPenalty + '.');
    if ((row.recoilPercent || 0) > 0) bits.push('Recoil: ' + Math.round(row.recoilPercent * 100) + '% of damage dealt.');
    if (row.ailment) {
      var aid = Array.isArray(row.ailment) ? row.ailment.join('/') : row.ailment;
      bits.push(String(aid) + ' ' + (row.ailmentChance || 0) + '%');
    }
    return bits.join(' ');
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
    MIN_CRIT_CHANCE: MIN_CRIT_CHANCE,
    MAX_CRIT_CHANCE: MAX_CRIT_CHANCE,
    MIN_CRIT_DAMAGE_MULT: MIN_CRIT_DAMAGE_MULT,
    MAX_CRIT_DAMAGE_MULT: MAX_CRIT_DAMAGE_MULT,
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
    clampCritChancePct: clampCritChancePct,
    clampCritDamageMult: clampCritDamageMult,
    calculateAbilityHitChancePct: calculateAbilityHitChancePct,
    calculateAbilityAccuracyPenalty: calculateAbilityAccuracyPenalty,
    applyMinimumDamage: applyMinimumDamage,
    roundCurvedDamage: roundCurvedDamage,
    applyBurningDefModifier: applyBurningDefModifier,
    runDamageFormulaSelfTest: runDamageFormulaSelfTest,
    runBowerLureSelfTest: runBowerLureSelfTest,
    EN_BASE_DAMAGE: EN_BASE_DAMAGE,
    CLASS_BASELINES: CLASS_BASELINES,
    BONUS_CAP_NORMAL: BONUS_CAP_NORMAL,
    BONUS_CAP_MUT_EQ: BONUS_CAP_MUT_EQ,
    BONUS_CAP_BOSS: BONUS_CAP_BOSS,
    MASTER_BASE_CRIT_MULT: MASTER_BASE_CRIT_MULT,
    MASTER_MAX_CRIT_MULT: MASTER_MAX_CRIT_MULT,
    getENBaseDamage: getENBaseDamage,
    getClassBaseline: getClassBaseline,
    getRelevantAttackStat: getRelevantAttackStat,
    getStatModifier: getStatModifier,
    getRelevantDefenceStat: getRelevantDefenceStat,
    getDefenceModifier: getDefenceModifier,
    getTotalDamageBonus: getTotalDamageBonus,
    getBonusCap: getBonusCap,
    getAbilityPower: getAbilityPower,
    calculateHeavyAccuracyPenalty: calculateHeavyAccuracyPenalty,
    calculateRecoilDamage: calculateRecoilDamage,
    calculateMultiHitDamage: calculateMultiHitDamage,
    calculateDamage: calculateDamage,
    mapLegacyRowToMasterDamage: mapLegacyRowToMasterDamage,
    enrichCombatRow: enrichCombatRow,
    usesMasterDamage: usesMasterDamage,
    describeMasterAbility: describeMasterAbility,
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
  globalThis.MIN_CRIT_CHANCE = MIN_CRIT_CHANCE;
  globalThis.MAX_CRIT_CHANCE = MAX_CRIT_CHANCE;
  globalThis.MIN_CRIT_DAMAGE_MULT = MIN_CRIT_DAMAGE_MULT;
  globalThis.MAX_CRIT_DAMAGE_MULT = MAX_CRIT_DAMAGE_MULT;
  globalThis.BASE_CRIT_DAMAGE = BASE_CRIT_DAMAGE;
  globalThis.clampCritChancePct = clampCritChancePct;
  globalThis.clampCritDamageMult = clampCritDamageMult;
  globalThis.calculateAbilityAccuracyPenalty = calculateAbilityAccuracyPenalty;
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
  globalThis.getENBaseDamage = getENBaseDamage;
  globalThis.getClassBaseline = getClassBaseline;
  globalThis.getRelevantAttackStat = getRelevantAttackStat;
  globalThis.getStatModifier = getStatModifier;
  globalThis.getRelevantDefenceStat = getRelevantDefenceStat;
  globalThis.getDefenceModifier = getDefenceModifier;
  globalThis.getTotalDamageBonus = getTotalDamageBonus;
  globalThis.getBonusCap = getBonusCap;
  globalThis.getAbilityPower = getAbilityPower;
  globalThis.calculateHeavyAccuracyPenalty = calculateHeavyAccuracyPenalty;
  globalThis.calculateRecoilDamage = calculateRecoilDamage;
  globalThis.calculateMultiHitDamage = calculateMultiHitDamage;
  globalThis.calculateDamage = calculateDamage;
  globalThis.mapLegacyRowToMasterDamage = mapLegacyRowToMasterDamage;
  globalThis.enrichCombatRow = enrichCombatRow;
  globalThis.usesMasterDamage = usesMasterDamage;
  globalThis.describeMasterAbility = describeMasterAbility;
  globalThis.getTypeModifier = getTypeModifier;
  globalThis.getEntityAspect = getEntityAspect;
  globalThis.isBloodiedTarget = isBloodiedTarget;
  globalThis.MASTER_BASE_CRIT_MULT = MASTER_BASE_CRIT_MULT;
  globalThis.MASTER_MAX_CRIT_MULT = MASTER_MAX_CRIT_MULT;
})();
