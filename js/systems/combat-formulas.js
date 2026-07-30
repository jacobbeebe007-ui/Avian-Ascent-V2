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
  // Master damage spec: a successful, non-immune hit always deals at least 1 (no EN-tiered floor).
  var MIN_DAMAGE_1_EN = 1;
  var MIN_DAMAGE_2_EN = 1;
  var MIN_DAMAGE_3_EN = 1;
  /** @deprecated EN-cost accuracy penalties removed; use power-tier penalty via calculateAbilityAccuracyPenalty. */
  var ACCURACY_PENALTY_1_EN = 0;
  var ACCURACY_PENALTY_2_EN = 0;
  var ACCURACY_PENALTY_3_EN = 0;
  var MIN_HIT_CHANCE = 15;
  var MAX_HIT_CHANCE = 95;
  var MIN_CRIT_CHANCE = 0;
  var MAX_CRIT_CHANCE = 50;
  var MIN_CRIT_DAMAGE_MULT = 1.35;
  var BASE_CRIT_DAMAGE = 1.35;
  var MAX_CRIT_DAMAGE_MULT = 1.50;
  var PIERCE_CAP = 0.95;
  var BURNING_DEF_MULT = 0.8;

  function isEquipmentV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function getCombatConfig() {
    return (Avian.data && Avian.data.combatConfig) || null;
  }

  function getPierceCap() {
    if (isEquipmentV2()) {
      var cfg = getCombatConfig();
      if (cfg && cfg.penetration) return Number(cfg.penetration.cap) || 0.4;
    }
    return PIERCE_CAP;
  }

  function clampPen(pen) {
    return Math.min(getPierceCap(), Math.max(0, Number(pen) || 0));
  }

  function scaleStatKey(scaleStat) {
    var key = String(scaleStat || 'ATK').toUpperCase();
    if (key === 'MATK' || key === 'MATT' || key === 'FOCUS') return 'matk';
    if (key === 'DEX' || key === 'DEXTERITY') return 'dex';
    if (key === 'SPD' || key === 'AGILITY') return 'spd';
    if (key === 'DEF' || key === 'GUARD') return 'def';
    if (key === 'MDEF' || key === 'RESOLVE') return 'mdef';
    if (key === 'ACC') return 'acc';
    if (key === 'DODGE') return 'dodge';
    if (key === 'HP' || key === 'VITALITY') return 'vitality';
    if (key === 'MIGHT' || key === 'ATK') return 'atk';
    return 'atk';
  }

  function statValueForScale(stats, scaleStat) {
    if (!stats) return 0;
    var k = scaleStatKey(scaleStat);
    return Math.max(0, Number(stats[k]) || 0);
  }

  /** Raw damage from ability row: Base + primary stat% + secondary stat%. Percentages are decimals (/100).
   *  Weapon-first rows must use calculateDamage — this path is a legacy fallback only. */
  function computeAbilityRawDamage(row, stats) {
    if (!row) return 0;
    if (weaponFirstEnabled() && (usesWeaponFirst(row) || row.skillPowerPct != null || row.minDamage != null)) {
      return 0;
    }
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

  function clampHitChancePct(pct) {
    return Math.max(MIN_HIT_CHANCE, Math.min(MAX_HIT_CHANCE, Number(pct) || 0));
  }

  function clampCritChancePct(pct) {
    return Math.max(MIN_CRIT_CHANCE, Math.min(MAX_CRIT_CHANCE, Number(pct) || 0));
  }

  function getCritDamageCaps() {
    if (isEquipmentV2()) {
      var cfg = getCombatConfig();
      if (cfg && cfg.crit) {
        return {
          min: Number(cfg.crit.damageFloorMult) || MIN_CRIT_DAMAGE_MULT,
          max: Number(cfg.crit.damageCapMult) || 2.0,
          base: Number(cfg.crit.damageFloorMult) || BASE_CRIT_DAMAGE,
        };
      }
    }
    return { min: MIN_CRIT_DAMAGE_MULT, max: MAX_CRIT_DAMAGE_MULT, base: BASE_CRIT_DAMAGE };
  }

  function clampCritDamageMult(mult) {
    var caps = getCritDamageCaps();
    return Math.max(caps.min, Math.min(caps.max, Number(mult) || caps.base));
  }

  /**
   * Bird Precision System: Hit% = clamp(Final Attack Precision − Dodge − skillPenalty, 15, 95).
   * Final Attack Precision starts from bird Base Precision (stats.acc) plus weapon/skill/temp mods.
   * Legacy callers may still pass baseHit=100 for tests.
   */
  function calculateAbilityHitChancePct(baseHitOrAcc, targetDodge, accuracyPenalty) {
    var base = Number(baseHitOrAcc);
    if (!Number.isFinite(base)) base = 100;
    var dodge = Math.max(0, Number(targetDodge) || 0);
    var penalty = Math.max(0, Number(accuracyPenalty) || 0);
    return clampHitChancePct(base - dodge - penalty);
  }

  function skillEnCost(row) {
    if (!row) return 0;
    var en = row.enCost != null ? row.enCost : (row.en != null ? row.en : row.apCost);
    return Math.max(0, Math.floor(Number(en) || 0));
  }

  /** Accuracy penalty only for EN ≥ 3 skills. Prefer Skill Library Base Precision. */
  function resolveSkillAccuracyPenalty(row) {
    if (!row) return 0;
    if (row.id === 'BASIC_PHYSICAL' || row.id === 'BASIC_MAGIC' || row.naturalStrikeFlat) return 0;
    var en = skillEnCost(row);
    if (en < 3) return 0;
    var prec = row.basePrecision != null ? Number(row.basePrecision)
      : (row.precision != null ? Number(row.precision) : null);
    if (prec != null && Number.isFinite(prec) && prec > 0) {
      var asPct = prec <= 1.5 ? prec * 100 : prec;
      return Math.max(0, Math.round((100 - asPct) * 100) / 100);
    }
    if (row.heavyAccuracyPenalty != null) return Math.max(0, Number(row.heavyAccuracyPenalty) || 0);
    return inferHeavyAccuracyPenalty(row);
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

  function resolveAttackAspect(attackerAspect, abilityRow) {
    var row = abilityRow || {};
    var asp = normalizeAspectId(row.aspect);
    if (asp) return asp;
    var affinity = row.aspectAffinity ? String(row.aspectAffinity) : '';
    if (affinity && !/none|class-neutral|neutral/i.test(affinity)) {
      var affToken = affinity.split(/[\s/]+/).filter(Boolean)[0];
      var affAsp = normalizeAspectId(affToken);
      if (affAsp) return affAsp;
    }
    return normalizeAspectId(attackerAspect);
  }

  function getAspectRelationship(attackAspect, defenderAspect, abilityRow) {
    var chart = getAspectChart();
    if (!chart || !chart.chart) return 'Invalid';
    var atkAsp = resolveAttackAspect(attackAspect, abilityRow);
    var defAsp = normalizeAspectId(defenderAspect);
    if (!atkAsp || !defAsp) return 'Invalid';
    if (atkAsp === defAsp) return 'Same';
    var relRow = chart.chart[atkAsp];
    if (!relRow || !relRow[defAsp]) return 'Neutral';
    var rel = String(relRow[defAsp]).toLowerCase();
    if (rel === 'dominant') return 'Strong';
    if (rel === 'resisted') return 'Weak';
    return 'Neutral';
  }

  function getAspectMultiplier(attackAspect, defenderAspect, abilityRow) {
    var chart = getAspectChart();
    if (!chart || !chart.chart) return 1;
    var rel = getAspectRelationship(attackAspect, defenderAspect, abilityRow);
    if (rel === 'Strong') return Number(chart.dominantMod) || 1.2;
    if (rel === 'Weak') return Number(chart.resistedMod) || 0.8;
    return Number(chart.neutralMod) || 1;
  }

  function getTypeModifier(attackerAspect, targetAspect, abilityRow) {
    return getAspectMultiplier(attackerAspect, targetAspect, abilityRow);
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
    var cost = Math.floor(Number(enCost) || 1);
    if (isEquipmentV2()) {
      var cfg = getCombatConfig();
      var map = (cfg && cfg.enBaseDamage) || null;
      if (map) {
        if (map[cost] != null) return map[cost];
        if (cost >= 6 && map[6] != null) return map[6];
        if (cost >= 4 && map[4] != null) return map[4];
      }
      cost = Math.max(1, Math.min(3, cost));
      return (map && map[cost] != null) ? map[cost] : (EN_BASE_DAMAGE[cost] || EN_BASE_DAMAGE[1]);
    }
    cost = Math.max(1, Math.min(3, cost));
    return EN_BASE_DAMAGE[cost] || EN_BASE_DAMAGE[1];
  }

  function getClassBaseline(className, scaleStat) {
    var key = normalizeClassKey(className);
    if (isEquipmentV2()) {
      var statKey = scaleStatKey(scaleStat || 'ATK');
      var classes = Avian.data && Avian.data.combatPack && Avian.data.combatPack.classes;
      if (classes && classes[key] && classes[key].reference
        && classes[key].reference[statKey] != null) {
        return classes[key].reference[statKey];
      }
      var cfg = getCombatConfig();
      if (cfg && cfg.statMod && cfg.statMod.classReferences
        && cfg.statMod.classReferences[key] != null) {
        return cfg.statMod.classReferences[key];
      }
    }
    return CLASS_BASELINES[key] || CLASS_BASELINES.rogue;
  }

  function entityCombatStatus(entity) {
    if (!entity) return null;
    if (entity.status) return entity.status;
    var g = globalThis.G;
    if (!g) return null;
    if (entity === g.player) return g.playerStatus || null;
    if (entity === g.enemy) return g.enemyStatus || null;
    if (entity.stats && g.player && g.player.stats === entity.stats) return g.playerStatus || null;
    if (entity.stats && g.enemy && g.enemy.stats === entity.stats) return g.enemyStatus || null;
    return null;
  }

  function statFromEntity(entity, key) {
    var stats = entity && entity.stats ? entity.stats : entity || {};
    var status = entityCombatStatus(entity);
    var k = String(key || 'ATK').toUpperCase();
    if (k === 'HP' || k === 'MAXHP') return Math.max(0, Number(stats.maxHp || stats.hp) || 0);
    if (k === 'VITALITY') return Math.max(0, Number(stats.vitality) || 0);
    if (k === 'MATK' || k === 'MATT' || k === 'FOCUS') return Math.max(0, Number(stats.matk) || 0);
    if (k === 'DEX' || k === 'DEXTERITY') return Math.max(0, Number(stats.dex) || 0);
    if (k === 'SPD' || k === 'AGILITY') {
      var spd = Math.max(0, Number(stats.spd) || 0);
      if (typeof globalThis.getCrippledAgilityPenalty === 'function') {
        spd = Math.max(0, spd + globalThis.getCrippledAgilityPenalty(status));
      }
      return spd;
    }
    if (k === 'DEF' || k === 'GUARD') {
      var def = Math.max(0, Number(stats.def) || 0);
      if (typeof globalThis.getFractureGuardPenalty === 'function') {
        def = Math.max(0, def + globalThis.getFractureGuardPenalty(status));
      }
      return def;
    }
    if (k === 'MDEF' || k === 'RESOLVE') return Math.max(0, Number(stats.mdef) || 0);
    if (k === 'ACC') {
      var acc = Math.max(0, Number(stats.acc) || 0);
      if (typeof globalThis.getDazedPrecisionPenalty === 'function') {
        acc = Math.max(0, acc + globalThis.getDazedPrecisionPenalty(status));
      }
      return acc;
    }
    if (k === 'DODGE') {
      if (typeof globalThis.isImmobilisedActive === 'function' && globalThis.isImmobilisedActive(status)) {
        return 0;
      }
      var dodge = Math.max(0, Number(stats.dodge) || 0);
      if (typeof globalThis.getCrippledDodgePenalty === 'function') {
        dodge = Math.max(0, dodge + globalThis.getCrippledDodgePenalty(status));
      }
      return dodge;
    }
    if (k === 'MIGHT') return Math.max(0, Number(stats.atk) || 0);
    return Math.max(0, Number(stats.atk) || 0);
  }

  function weaponFirstEnabled() {
    var cfg = getCombatConfig();
    return !!(cfg && cfg.weaponFirst && cfg.weaponFirst.enabled !== false && cfg.weaponFirstV09 !== false);
  }

  function getOffencePctPerStat() {
    var cfg = getCombatConfig();
    var v = cfg && cfg.weaponFirst && cfg.weaponFirst.offencePctPerStat;
    return v != null ? Number(v) : 2.5;
  }

  function resolveMainHandWeaponItem(attacker) {
    if (!attacker) return null;
    var loadout = attacker.equipment || attacker.equipped || attacker.loadout;
    var id = null;
    if (loadout && typeof loadout === 'object') {
      id = loadout.mainHand || loadout.mainWeapon || null;
    }
    if (!id && attacker.mainHandItem) return attacker.mainHandItem;
    if (!id) return null;
    var cat = Avian.data && Avian.data.equipment && Avian.data.equipment.items;
    return (cat && cat[id]) || null;
  }

  function resolveWeaponDamageValue(params, ability, attacker) {
    params = params || {};
    ability = ability || {};
    if (params.weaponDamage != null && Number.isFinite(Number(params.weaponDamage))) {
      return Number(params.weaponDamage);
    }
    if (ability.weaponDamage != null && Number.isFinite(Number(ability.weaponDamage))) {
      return Number(ability.weaponDamage);
    }
    var min = ability.minDamage != null ? Number(ability.minDamage) : null;
    var max = ability.maxDamage != null ? Number(ability.maxDamage) : null;
    if (min == null || max == null) {
      var wpn = resolveMainHandWeaponItem(attacker);
      if (wpn) {
        if (min == null) min = Number(wpn.minDamage);
        if (max == null) max = Number(wpn.maxDamage);
      }
    }
    if (!Number.isFinite(min)) min = 0;
    if (!Number.isFinite(max)) max = min;
    if (max < min) max = min;
    if (params.rollWeapon === true) {
      return min + Math.floor(Math.random() * (Math.floor(max) - Math.floor(min) + 1));
    }
    return (min + max) / 2;
  }

  function isNaturalBasicAbility(ability) {
    var row = ability || {};
    /* UI / runtime abilities may wrap the equipped combat row on _dispatcherRow. */
    if (row._dispatcherRow && typeof row._dispatcherRow === 'object') {
      row = row._dispatcherRow;
    }
    /* Equipped Basic Attack carries weapon min/max and Skill Power — not a flat Natural Strike. */
    if (row.minDamage != null && row.maxDamage != null && Number(row.skillPowerPct) > 0 && !row.naturalStrikeFlat) {
      return false;
    }
    if (row.naturalStrikeFlat) return true;
    if (row.id === 'BASIC_PHYSICAL' || row.id === 'BASIC_MAGIC') {
      return !(row.minDamage != null && row.maxDamage != null && Number(row.skillPowerPct) > 0);
    }
    var name = String(row.name || '');
    return /natural.?strike|beak.?jab/i.test(name) && !/basic attack/i.test(name);
  }

  function resolveNaturalStrikeFlat(params, ability) {
    params = params || {};
    ability = ability || {};
    if (params.naturalStrikeFlat != null) return Number(params.naturalStrikeFlat) || 0;
    var flat = ability.naturalStrikeFlat;
    var cfg = getCombatConfig();
    var fmin = flat && flat.min != null ? Number(flat.min)
      : (cfg && cfg.weaponFirst && cfg.weaponFirst.naturalStrike && cfg.weaponFirst.naturalStrike.flatMin != null
        ? Number(cfg.weaponFirst.naturalStrike.flatMin) : 1);
    var fmax = flat && flat.max != null ? Number(flat.max)
      : (cfg && cfg.weaponFirst && cfg.weaponFirst.naturalStrike && cfg.weaponFirst.naturalStrike.flatMax != null
        ? Number(cfg.weaponFirst.naturalStrike.flatMax) : 2);
    if (!Number.isFinite(fmin)) fmin = 1;
    if (!Number.isFinite(fmax)) fmax = 2;
    if (fmax < fmin) fmax = fmin;
    if (!(flat || isNaturalBasicAbility(ability))) {
      return 0;
    }
    if (params.rollWeapon === true) {
      return fmin + Math.floor(Math.random() * (Math.floor(fmax) - Math.floor(fmin) + 1));
    }
    return (fmin + fmax) / 2;
  }

  function getSkillPowerPct(ability) {
    var row = ability || {};
    if (row.skillPowerPct != null) return Number(row.skillPowerPct) || 0;
    if (row.skillPower != null) {
      var sp = Number(row.skillPower) || 0;
      return sp <= 10 ? Math.round(sp * 100) : sp;
    }
    if (row.fixedCoefficient != null) {
      var fc = Number(row.fixedCoefficient) || 0;
      return fc <= 10 ? Math.round(fc * 100) : fc;
    }
    return 0;
  }

  function applyFlatThenPercentPen(rawDef, piercePercent, flatPen) {
    var def = Math.max(0, Number(rawDef) || 0);
    def = Math.max(0, def - Math.max(0, Number(flatPen) || 0));
    var pierce = clampPen(piercePercent);
    return Math.max(0, def * (1 - pierce));
  }

  function getMitigationFraction(effectiveDef) {
    var cfg = getCombatConfig();
    var scale = (cfg && cfg.defence && cfg.defence.ratingScale != null)
      ? Number(cfg.defence.ratingScale) : 2.5;
    var base = (cfg && cfg.defence && cfg.defence.mitigationBase != null)
      ? Number(cfg.defence.mitigationBase) : 100;
    var cap = (cfg && cfg.defence && cfg.defence.mitigationCap != null)
      ? Number(cfg.defence.mitigationCap) : 0.75;
    var rating = Math.max(0, Number(effectiveDef) || 0) * scale;
    if (rating <= 0) return 0;
    return Math.min(cap, rating / (base + rating));
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

  function mergeAbilityTextForHybrid(row) {
    if (!row) return '';
    return [row.riderText, row.shortDesc, row.displayText].filter(function (s) {
      return s && String(s).trim() && !/^none$/i.test(String(s).trim());
    }).join('\n');
  }

  function parseHybridScalingFromText(text) {
    var t = String(text || '');
    var m = t.match(/Uses\s+(\d+(?:\.\d+)?)\s*%\s*ATK\s+and\s+(\d+(?:\.\d+)?)\s*%\s*MATK/i);
    if (!m) return null;
    return { ATK: Number(m[1]) / 100, MATK: Number(m[2]) / 100 };
  }

  function buildHybridScaling(row) {
    if (row && row.hybridScaling && typeof row.hybridScaling === 'object') return row.hybridScaling;
    var textScaling = parseHybridScalingFromText(mergeAbilityTextForHybrid(row));
    if (textScaling) return textScaling;
    var primary = String(row.scaleStat || 'ATK').toUpperCase();
    var secondary = String(row.secondaryScaleStat || '').toUpperCase();
    var pPct = Math.max(0, Number(row.scalePct) || 0);
    var sPct = Math.max(0, Number(row.secondaryScalePct) || 0);
    var total = pPct + sPct;
    if (!secondary || total <= 0) {
      // Hybrid abilities in the live data carry no secondary scale split, so
      // default them to an even ATK/MATK blend instead of silently scaling off
      // ATK alone. Non-hybrid rows keep their single-stat behaviour (null).
      var isHybrid = String(row.damageStat || '').toUpperCase() === 'HYBRID'
        || primary === 'HYBRID'
        || String(row.damageType || '').toUpperCase() === 'HYBRID';
      if (isHybrid) return { ATK: 0.5, MATK: 0.5 };
      return null;
    }
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
    var en = skillEnCost(row);
    if (en < 3) return 0;
    if (row && (row.id === 'BASIC_PHYSICAL' || row.id === 'BASIC_MAGIC' || row.naturalStrikeFlat)) return 0;
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
    var conditionalAbilityPowerMode = row.conditionalAbilityPowerMode || null;
    var condition = row.condition || null;
    if (!condition && row.riders && row.riders.length) {
      for (var i = 0; i < row.riders.length; i++) {
        var r = row.riders[i];
        if (r.kind === 'bonusVsAilment' && r.ailment === 'bleed') {
          condition = 'targetBleeding';
          conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
          conditionalAbilityPowerMode = conditionalAbilityPowerMode || 'multiply';
        } else if (r.kind === 'bonusVsAilment' && r.ailment === 'burning') {
          condition = 'targetBurning';
          conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
          conditionalAbilityPowerMode = conditionalAbilityPowerMode || 'multiply';
        } else if (r.kind === 'bonusVsLowHp') {
          condition = 'targetLowHp';
          conditionalAbilityPower = 1 + (Number(r.value) || 0) / 100;
          conditionalAbilityPowerMode = conditionalAbilityPowerMode || 'multiply';
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
      conditionalAbilityPowerMode: conditionalAbilityPowerMode,
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
    if (typeof globalThis.applyAbilityTextEnrichment === 'function') {
      globalThis.applyAbilityTextEnrichment(row);
    }
    var mapped = mapLegacyRowToMasterDamage(row);
    Object.keys(mapped).forEach(function (k) { row[k] = mapped[k]; });
    row._masterDamageEnriched = true;
    return row;
  }

  function getRelevantAttackStat(attacker, ability, opts) {
    opts = opts || {};
    var row = ability || {};
    enrichCombatRow(row);
    var hitStat = opts.hybridHitStat || row._hybridHitStat;
    if (hitStat) return statFromEntity(attacker, String(hitStat).toUpperCase());
    var scale = row.scalingStat || row.damageStat || row.scaleStat || 'ATK';
    var statKey = String(scale).toUpperCase();
    if (statKey === 'TRUE') return 1;
    if (statKey === 'HYBRID' && row.hybridScaling) {
      var total = 0;
      for (var k in row.hybridScaling) {
        if (!Object.prototype.hasOwnProperty.call(row.hybridScaling, k)) continue;
        total += statFromEntity(attacker, k) * (Number(row.hybridScaling[k]) || 0);
      }
      return total;
    }
    /* Natural Strike / basic attacks inherit the equipped weapon scaling stat. */
    if ((row.id === 'BASIC_PHYSICAL' || row.id === 'BASIC_MAGIC' || row.naturalStrikeFlat)
      && !opts.hybridHitStat) {
      /* Basics keep their authored scaling (Might / Focus); they do not inherit weapon scaling. */
    }
    return statFromEntity(attacker, statKey);
  }

  function getStatModParams() {
    if (isEquipmentV2()) {
      var cfg = getCombatConfig();
      if (cfg && cfg.statMod) {
        return {
          divisor: Number(cfg.statMod.divisor) || 50,
          min: Number(cfg.statMod.min) || 0.8,
          max: Number(cfg.statMod.max) || 1.6,
        };
      }
      return { divisor: 50, min: 0.8, max: 1.6 };
    }
    return { divisor: 100, min: STAT_MOD_MIN, max: STAT_MOD_MAX };
  }

  function getStatModifier(relevantStat, classBaseline) {
    var params = getStatModParams();
    var stat = Number(relevantStat) || 0;
    var base = Number(classBaseline);
    if (!Number.isFinite(base)) base = CLASS_BASELINES.rogue;
    return clampNum(1 + (stat - base) / params.divisor, params.min, params.max);
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

  function getDefenceConstant() {
    var cfg = getCombatConfig();
    if (cfg && cfg.defence && cfg.defence.constant != null) return Number(cfg.defence.constant) || 150;
    return 150;
  }

  function usesDirectScaling(ability) {
    if (weaponFirstEnabled()) return false;
    var cfg = getCombatConfig();
    if (!(cfg && cfg.directScaling && cfg.directScaling.enabled !== false && cfg.affinityArsenalV06)) {
      return false;
    }
    var row = ability || {};
    if (row.baseDamage != null || (Array.isArray(row.scaling) && row.scaling.length) || row.useDirectScaling) {
      return true;
    }
    if (row.coefficientFixed && row.fixedCoefficient != null && row.abilityPower == null) return true;
    return false;
  }

  function usesWeaponFirst(ability) {
    if (!weaponFirstEnabled()) return false;
    var row = ability || {};
    if (row.noDamage) return false;
    if (row.useWeaponFirst === false) return false;
    if (row.skillPowerPct != null || row.skillPower != null || row.naturalStrikeFlat) return true;
    if (row.minDamage != null || row.weaponDamage != null) return true;
    if (row.coefficientFixed && row.fixedCoefficient != null) return true;
    if (Array.isArray(row.scaling) && row.scaling.length) return true;
    return !!row.useWeaponFirst;
  }

  function getDefenceModifier(relevantDefence, damageType, piercePercent, opts) {
    opts = opts || {};
    if (String(damageType || 'Physical') === 'True') return 1;
    var def = Math.max(0, Number(relevantDefence) || 0);
    if (opts.burning) def = applyBurningDefModifier(def, opts.burning);
    if (opts.scorched) def = applyBurningDefModifier(def, { scorched: true });
    def = applyFlatThenPercentPen(def, piercePercent, opts.flatPen);
    if (weaponFirstEnabled() || opts.useRatingMitigation
      || (opts.ability && usesWeaponFirst(opts.ability))) {
      return 1 - getMitigationFraction(def);
    }
    if (opts.useConstantDefence || (opts.ability && usesDirectScaling(opts.ability))) {
      var C = getDefenceConstant();
      return C / (C + def);
    }
    var k = 3;
    var cfg = getCombatConfig();
    if (cfg && cfg.defence && cfg.defence.curveK != null) k = Number(cfg.defence.curveK) || 3;
    return 100 / (100 + def * k);
  }

  function getDirectBaseDamage(enCost) {
    var cfg = getCombatConfig();
    var per = (cfg && cfg.directScaling && cfg.directScaling.baseDamagePerEn != null)
      ? Number(cfg.directScaling.baseDamagePerEn) : 2;
    return per * Math.max(1, Math.floor(Number(enCost) || 1));
  }

  function getFixedTechniqueCoefficient(ability, enCost) {
    var row = ability || {};
    if (row.fixedCoefficient != null) return Number(row.fixedCoefficient);
    if (row.abilityPower != null) return Number(row.abilityPower);
    if (Array.isArray(row.scaling) && row.scaling.length) return null;
    var cfg = getCombatConfig();
    var bands = cfg && cfg.directScaling && cfg.directScaling.enAttackBands;
    var cost = Math.floor(Number(enCost) || 1);
    if (bands && bands[cost] && bands[cost].coeff != null) return Number(bands[cost].coeff);
    return 1;
  }

  function getDirectStatContributionScale() {
    var cfg = getCombatConfig();
    var scale = cfg && cfg.directScaling && cfg.directScaling.statContributionScale;
    if (scale == null || !Number.isFinite(Number(scale))) return 1;
    return Math.max(0, Number(scale));
  }

  function sumDirectStatCoefficients(attacker, ability) {
    var row = ability || {};
    var scale = getDirectStatContributionScale();
    if (Array.isArray(row.scaling) && row.scaling.length) {
      var total = 0;
      for (var i = 0; i < row.scaling.length; i++) {
        var s = row.scaling[i];
        if (!s) continue;
        var key = s.ledgerKey || s.stat;
        total += statFromEntity(attacker, key) * (Number(s.coeff) || 0);
      }
      return total * scale;
    }
    var coeff = getFixedTechniqueCoefficient(row, row.enCost != null ? row.enCost : row.apCost);
    var relevant = getRelevantAttackStat(attacker, row, {});
    return relevant * (Number(coeff) || 0) * scale;
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
    if (condition === 'targetWeakened') {
      return typeof globalThis.getWeakenStacks === 'function'
        ? globalThis.getWeakenStacks(es) > 0
        : (es.weaken || 0) > 0;
    }
    if (condition === 'targetChilled') {
      return !!(es.chilled && ((es.chilled.stacks || 0) > 0 || (es.chilled.turns || 0) > 0));
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
      if (row.conditionalAbilityPowerMode === 'replace') {
        power = Number(row.conditionalAbilityPower) || power;
      } else {
        power *= Number(row.conditionalAbilityPower) || 1;
      }
    }
    return Math.max(0, power);
  }

  function calculateHeavyAccuracyPenalty(ability) {
    enrichCombatRow(ability || {});
    return resolveSkillAccuracyPenalty(ability);
  }

  function calculateAbilityAccuracyPenalty(ability) {
    enrichCombatRow(ability || {});
    return resolveSkillAccuracyPenalty(ability);
  }

  function calculateRecoilDamage(finalDamage, ability) {
    enrichCombatRow(ability || {});
    var pct = Number(ability.recoilPercent) || 0;
    if (pct <= 0) return 0;
    return applyMinimumDamage(roundCurvedDamage(Math.max(0, Number(finalDamage) || 0) * pct), 1);
  }

  function calculateMultiHitDamage(totalDamage, hitCount) {
    var total = roundCurvedDamage(Math.max(0, Number(totalDamage) || 0));
    var hits = Math.max(1, Math.floor(Number(hitCount) || 1));
    var cents = Math.round(total * 100);
    var perCents = Math.floor(cents / hits);
    var rem = cents - perCents * hits;
    var out = [];
    for (var i = 0; i < hits; i++) out.push((perCents + (i < rem ? 1 : 0)) / 100);
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
    if (ability.noDamage) {
      return { damage: 0, preMitigation: 0, components: {} };
    }
    var enCost = ability.enCost != null ? ability.enCost : (ability.apCost || 1);
    /* Equipped Basic Attack inherits weapon damage; unarmed flat Natural Strike does not. */
    var defStat = getRelevantDefenceStat(target, ability);
    var pierce = resolvePierceFraction(ability, String(ability.damageType) === 'Magic');
    var flatPen = Number(params.flatPen) || Number(ability.flatPen) || 0;
    var targetStatus = entityCombatStatus(target) || params.targetStatus || null;
    if (String(ability.damageType || 'Physical') !== 'Magic'
      && typeof globalThis.getShatteredAttackerPenetration === 'function') {
      flatPen += globalThis.getShatteredAttackerPenetration(targetStatus);
    }
    var attackerStatus = entityCombatStatus(attacker) || params.attackerStatus || null;
    var skillPowerPenalty = typeof globalThis.getDazedSkillPowerPenalty === 'function'
      ? globalThis.getDazedSkillPowerPenalty(attackerStatus)
      : 0;
    var burnState = (function () {
      if (battleState.enemyHasBurning && typeof battleState.enemyHasBurning === 'object') return battleState.enemyHasBurning;
      if (params.targetBurning && typeof globalThis.enemyHasBurningStacks === 'function') return globalThis.enemyHasBurningStacks();
      return !!(battleState.enemyHasBurning || params.targetBurning);
    })();
    var scorched = !!(battleState.targetScorched || params.targetScorched
      || (target && target.status && target.status.scorched));
    var defMod = getDefenceModifier(defStat, ability.damageType, pierce, {
      burning: burnState,
      scorched: scorched,
      ability: ability,
      flatPen: flatPen,
      useConstantDefence: usesDirectScaling(ability),
      useRatingMitigation: usesWeaponFirst(ability),
    });
    var bonusCap = getBonusCap(attacker, params);
    var bonusFrac = getTotalDamageBonus(params.bonusFractions, bonusCap);
    var bonusMod = 1 + bonusFrac;
    var attackerAspect = getEntityAspect(attacker);
    var targetAspect = getEntityAspect(target);
    if (typeof Avian.affinity !== 'undefined' && typeof Avian.affinity.normalize === 'function') {
      attackerAspect = Avian.affinity.normalize(attackerAspect) || attackerAspect;
      targetAspect = Avian.affinity.normalize(targetAspect) || targetAspect;
    }
    var aspectRelationship = getAspectRelationship(attackerAspect, targetAspect, ability);
    var aspectMod = getAspectMultiplier(attackerAspect, targetAspect, ability);
    var typeMod = aspectMod;
    var braceMult = 1;
    if (params.bracePct != null) braceMult = Math.max(0, 1 - Math.min(0.12, Number(params.bracePct) || 0));
    else if (target && target.status && target.status.brace && target.status.brace.pct != null) {
      braceMult = Math.max(0, 1 - Math.min(0.12, Number(target.status.brace.pct) || 0));
    }

    var enBase;
    var abilityPower;
    var relevantStat;
    var statMod;
    var preCrit;
    var preMitigation;
    var weaponDamage = 0;
    var skillPowerPct = 0;
    var naturalFlat = 0;
    var weaponFirst = false;

    if (usesWeaponFirst(ability)) {
      weaponFirst = true;
      relevantStat = getRelevantAttackStat(attacker, ability, {
        hybridHitStat: params.hybridHitStat || (ability && ability._hybridHitStat),
      });
      /* Unarmed Natural Strike: flat 1–2. Equipped Basic Attack uses weapon formula below. */
      if (isNaturalBasicAbility(ability)) {
        naturalFlat = resolveNaturalStrikeFlat(params, ability);
        weaponDamage = 0;
        skillPowerPct = 0;
        preMitigation = naturalFlat;
        abilityPower = 0;
        enBase = naturalFlat;
        statMod = 1;
      } else {
        weaponDamage = resolveWeaponDamageValue(params, ability, attacker);
        skillPowerPct = getSkillPowerPct(ability) + (Number(params.skillPowerBonus) || 0) + skillPowerPenalty;
        /* Hybrid COMBO rows: sum weapon×((sharePct + stat×2.5)/100) per component. */
        if (Array.isArray(ability.scaling) && ability.scaling.length) {
          preMitigation = 0;
          for (var si = 0; si < ability.scaling.length; si++) {
            var sc = ability.scaling[si];
            if (!sc) continue;
            var sharePct = sc.skillPowerPct != null ? Number(sc.skillPowerPct)
              : Math.round((Number(sc.coeff) || 0) * (Number(sc.coeff) <= 10 ? 100 : 1));
            var st = statFromEntity(attacker, sc.ledgerKey || sc.stat);
            preMitigation += weaponDamage * ((sharePct + st * getOffencePctPerStat()) / 100);
          }
        } else {
          naturalFlat = resolveNaturalStrikeFlat(params, ability);
          preMitigation = naturalFlat
            + weaponDamage * ((skillPowerPct + relevantStat * getOffencePctPerStat()) / 100);
        }
        abilityPower = skillPowerPct / 100;
        enBase = weaponDamage;
        statMod = 1;
      }
      /* Affinity → crit → mitigation → round once. */
      var afterAffinity = preMitigation * typeMod * bonusMod;
      if (params.isCriticalHit) {
        var critAddWf = Number(params.critDamageAdd) || 0;
        var critMultWf = clampCritDamageMult((Number(params.critMultiplier) || MASTER_BASE_CRIT_MULT) + critAddWf);
        afterAffinity *= critMultWf;
      }
      preCrit = afterAffinity * defMod * braceMult;
      var damageWf = applyMinimumDamage(Math.round(preCrit), enCost);
      return {
        damage: damageWf,
        preMitigation: preMitigation,
        effectiveDef: applyFlatThenPercentPen(
          burnState || scorched
            ? applyBurningDefModifier(defStat, scorched ? { scorched: true } : burnState)
            : defStat,
          pierce,
          flatPen,
        ),
        components: {
          enBase: enBase,
          weaponDamage: weaponDamage,
          skillPowerPct: skillPowerPct,
          naturalStrikeFlat: naturalFlat,
          abilityPower: abilityPower,
          statMod: statMod,
          defMod: defMod,
          typeMod: typeMod,
          aspectMod: aspectMod,
          aspectRelationship: aspectRelationship,
          attackAspect: resolveAttackAspect(attackerAspect, ability),
          defenderAspect: targetAspect,
          bonusMod: bonusMod,
          braceMult: braceMult,
          relevantStat: relevantStat,
          defStat: defStat,
          directScaling: false,
          weaponFirst: true,
        },
      };
    }

    if (usesDirectScaling(ability)) {
      enBase = ability.baseDamage != null ? Number(ability.baseDamage) : getDirectBaseDamage(enCost);
      abilityPower = 1;
      relevantStat = getRelevantAttackStat(attacker, ability, {
        hybridHitStat: params.hybridHitStat || (ability && ability._hybridHitStat),
      });
      statMod = 1;
      var statTerm = sumDirectStatCoefficients(attacker, ability);
      preMitigation = enBase + statTerm;
      preCrit = preMitigation * defMod * typeMod * bonusMod * braceMult;
    } else {
      if (getAbilityPower(ability, attacker, target, battleState) <= 0) {
        return { damage: 0, preMitigation: 0, components: {} };
      }
      enBase = getENBaseDamage(enCost);
      abilityPower = getAbilityPower(ability, attacker, target, battleState);
      relevantStat = getRelevantAttackStat(attacker, ability, {
        hybridHitStat: params.hybridHitStat || (ability && ability._hybridHitStat),
      });
      var className = attacker.class || attacker.enemyClass || attacker.birdClass || 'rogue';
      statMod = getStatModifier(relevantStat, getClassBaseline(className, ability.damageStat || ability.scaleStat));
      preMitigation = enBase * abilityPower * statMod;
      preCrit = preMitigation * defMod * typeMod * bonusMod * braceMult;
    }

    var damage = preCrit;
    if (params.isCriticalHit) {
      var critAdd = Number(params.critDamageAdd) || 0;
      var critMult = clampCritDamageMult((Number(params.critMultiplier) || MASTER_BASE_CRIT_MULT) + critAdd);
      damage *= critMult;
    }
    damage = applyMinimumDamage(roundCurvedDamage(damage), enCost);
    return {
      damage: damage,
      preMitigation: preMitigation,
      effectiveDef: defStat,
      components: {
        enBase: enBase,
        abilityPower: abilityPower,
        statMod: statMod,
        defMod: defMod,
        typeMod: typeMod,
        aspectMod: aspectMod,
        aspectRelationship: aspectRelationship,
        attackAspect: resolveAttackAspect(attackerAspect, ability),
        defenderAspect: targetAspect,
        bonusMod: bonusMod,
        braceMult: braceMult,
        relevantStat: relevantStat,
        defStat: defStat,
        directScaling: usesDirectScaling(ability),
        weaponFirst: weaponFirst,
      },
    };
  }

  function usesMasterDamage(row) {
    if (!row) return false;
    enrichCombatRow(row);
    if (row.noDamage) return false;
    if (usesWeaponFirst(row)) return true;
    return row.abilityPower != null || row.damageStat != null || row.scalingStat != null
      || row.skillPowerPct != null || row.fixedCoefficient != null;
  }

  function isHybridDamage(row) {
    if (!row) return false;
    enrichCombatRow(row);
    return String(row.damageType) === 'Hybrid'
      || String(row.category || '').toLowerCase() === 'hybrid'
      || String(row.damageStat || row.scaleStat || '').toUpperCase() === 'HYBRID';
  }

  /** Split blended hybrid total into red (ATK) / purple (MATK) display portions. */
  function calculateHybridDisplaySplit(totalOrParams, rowOpt) {
    var total = 0;
    var row = rowOpt || {};
    var hitIndex = rowOpt && rowOpt.hitIndex != null ? Number(rowOpt.hitIndex) : null;
    if (typeof totalOrParams === 'number') {
      total = roundCurvedDamage(Math.max(0, Number(totalOrParams) || 0));
      row = rowOpt || {};
      hitIndex = rowOpt && rowOpt.hitIndex != null ? Number(rowOpt.hitIndex) : hitIndex;
    } else if (totalOrParams && typeof totalOrParams === 'object') {
      row = totalOrParams.ability || totalOrParams.row || rowOpt || {};
      hitIndex = totalOrParams.hitIndex != null ? Number(totalOrParams.hitIndex) : hitIndex;
      enrichCombatRow(row);
      if (typeof calculateDamage === 'function') {
        total = roundCurvedDamage(Math.max(0, (calculateDamage(totalOrParams).damage) || 0));
      }
    }
    enrichCombatRow(row);
    if (row.hybridPerHit && hitIndex != null && !isNaN(hitIndex)) {
      if (total <= 0) return { total: 0, physical: 0, magic: 0, weights: { ATK: hitIndex === 0 ? 1 : 0, MATK: hitIndex === 0 ? 0 : 1 } };
      if (hitIndex === 0) return { total: total, physical: total, magic: 0, weights: { ATK: 1, MATK: 0 } };
      return { total: total, physical: 0, magic: total, weights: { ATK: 0, MATK: 1 } };
    }
    var scaling = row.hybridScaling || buildHybridScaling(row) || { ATK: 0.5, MATK: 0.5 };
    var wAtk = Number(scaling.ATK) || 0;
    var wMatk = Number(scaling.MATK) || 0;
    var wSum = wAtk + wMatk;
    if (wSum <= 0) { wAtk = 0.5; wMatk = 0.5; wSum = 1; }
    wAtk /= wSum;
    wMatk /= wSum;
    if (total <= 0) {
      return { total: 0, physical: 0, magic: 0, weights: { ATK: wAtk, MATK: wMatk } };
    }
    var physical = roundCurvedDamage(Math.max(0, total * wAtk));
    var magic = roundCurvedDamage(Math.max(0, total - physical));
    return { total: total, physical: physical, magic: magic, weights: { ATK: wAtk, MATK: wMatk } };
  }

  function formatAilmentChanceLine(row) {
    if (!row || !row.ailment) return '';
    var ids = Array.isArray(row.ailment) ? row.ailment : [row.ailment];
    var chance = row.ailmentChance || 0;
    var names = ids.filter(Boolean).map(function (id) {
      var key = String(id || '').toLowerCase();
      var A = globalThis.AILMENTS;
      if (A && A[key] && A[key].name) return A[key].name;
      return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
    }).filter(Boolean);
    if (!names.length) return '';
    return 'Has a ' + chance + '% chance to apply ' + names.join('/') + '.';
  }

  function describeMasterAbility(row) {
    enrichCombatRow(row || {});
    if (!row || row.noDamage) return 'Utility ability.';
    var en = row.enCost || row.apCost || 1;
    var weight = en === 1 ? 'Light' : (en === 2 ? 'Medium' : 'Heavy');
    var dtype = String(row.damageType || 'Physical');
    var bits = [
      'Deals ' + weight + ' ' + dtype + ' damage.',
    ];
    if (isNaturalBasicAbility(row)) {
      var cfgNs = getCombatConfig();
      var fmin = (row.naturalStrikeFlat && row.naturalStrikeFlat.min != null)
        ? Number(row.naturalStrikeFlat.min)
        : (cfgNs && cfgNs.weaponFirst && cfgNs.weaponFirst.naturalStrike
          ? Number(cfgNs.weaponFirst.naturalStrike.flatMin) : 1);
      var fmax = (row.naturalStrikeFlat && row.naturalStrikeFlat.max != null)
        ? Number(row.naturalStrikeFlat.max)
        : (cfgNs && cfgNs.weaponFirst && cfgNs.weaponFirst.naturalStrike
          ? Number(cfgNs.weaponFirst.naturalStrike.flatMax) : 2);
      if (!Number.isFinite(fmin)) fmin = 1;
      if (!Number.isFinite(fmax)) fmax = 2;
      bits.push('Damage: ' + fmin + '–' + fmax + ' (does not scale with weapon).');
    } else if (weaponFirstEnabled()) {
      var stat = String(row.damageStat || row.scalingStat || row.scaleStat || 'ATK');
      bits.push('Uses ' + stat + '.');
      bits.push('Skill Power: ' + (getSkillPowerPct(row) || 0) + '%.');
      var wMin = row.minDamage != null ? Number(row.minDamage) : null;
      var wMax = row.maxDamage != null ? Number(row.maxDamage) : null;
      if (Number.isFinite(wMin) || Number.isFinite(wMax)) {
        if (!Number.isFinite(wMin)) wMin = wMax;
        if (!Number.isFinite(wMax)) wMax = wMin;
        if (wMin > 0 || wMax > 0) bits.push('Weapon: ' + wMin + '–' + wMax + '.');
      }
    } else {
      var statLegacy = String(row.damageStat || row.scalingStat || row.scaleStat || 'ATK');
      bits.push('Uses ' + statLegacy + '.');
      bits.push('Ability Power: ' + (Number(row.abilityPower) || 0).toFixed(2) + '.');
    }
    if ((row.heavyAccuracyPenalty || 0) > 0) bits.push('Heavy accuracy penalty: -' + row.heavyAccuracyPenalty + '.');
    if ((row.recoilPercent || 0) > 0) bits.push('Recoil: ' + Math.round(row.recoilPercent * 100) + '% of damage dealt.');
    var ailmentLine = formatAilmentChanceLine(row);
    if (ailmentLine) bits.push(ailmentLine);
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
    getAccuracyPenaltyForEnCost: getAccuracyPenaltyForEnCost,
    effectiveDefence: effectiveDefence,
    curvedDefenceMultiplier: curvedDefenceMultiplier,
    clampHitChancePct: clampHitChancePct,
    clampCritChancePct: clampCritChancePct,
    clampCritDamageMult: clampCritDamageMult,
    calculateAbilityHitChancePct: calculateAbilityHitChancePct,
    calculateAbilityAccuracyPenalty: calculateAbilityAccuracyPenalty,
    resolveSkillAccuracyPenalty: resolveSkillAccuracyPenalty,
    applyMinimumDamage: applyMinimumDamage,
    roundCurvedDamage: roundCurvedDamage,
    applyBurningDefModifier: applyBurningDefModifier,
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
    usesWeaponFirst: usesWeaponFirst,
    usesDirectScaling: usesDirectScaling,
    isNaturalBasicAbility: isNaturalBasicAbility,
    getSkillPowerPct: getSkillPowerPct,
    weaponFirstEnabled: weaponFirstEnabled,
    getMitigationFraction: getMitigationFraction,
    isHybridDamage: isHybridDamage,
    calculateHybridDisplaySplit: calculateHybridDisplaySplit,
    describeMasterAbility: describeMasterAbility,
    clampPen: clampPen,
    getPierceCap: getPierceCap,
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
  globalThis.getAccuracyPenaltyForEnCost = getAccuracyPenaltyForEnCost;
  globalThis.effectiveDefence = effectiveDefence;
  globalThis.curvedDefenceMultiplier = curvedDefenceMultiplier;
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
  globalThis.usesWeaponFirst = usesWeaponFirst;
  globalThis.usesDirectScaling = usesDirectScaling;
  globalThis.isNaturalBasicAbility = isNaturalBasicAbility;
  globalThis.getSkillPowerPct = getSkillPowerPct;
  globalThis.weaponFirstEnabled = weaponFirstEnabled;
  globalThis.getMitigationFraction = getMitigationFraction;
  globalThis.isHybridDamage = isHybridDamage;
  globalThis.calculateHybridDisplaySplit = calculateHybridDisplaySplit;
  globalThis.describeMasterAbility = describeMasterAbility;
  globalThis.getTypeModifier = getTypeModifier;
  globalThis.getAspectMultiplier = getAspectMultiplier;
  globalThis.getAspectRelationship = getAspectRelationship;
  globalThis.resolveAttackAspect = resolveAttackAspect;
  globalThis.getEntityAspect = getEntityAspect;
  globalThis.isBloodiedTarget = isBloodiedTarget;
  globalThis.MASTER_BASE_CRIT_MULT = MASTER_BASE_CRIT_MULT;
  globalThis.MASTER_MAX_CRIT_MULT = MASTER_MAX_CRIT_MULT;
})();
