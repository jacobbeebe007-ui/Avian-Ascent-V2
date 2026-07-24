/* Master Ailment List — Affinity Arsenal v0.6 canonical rules and pure math helpers.
 * Loaded before ailments.js so metadata can reference rule constants.
 * Numerical stack values are Working Draft; structure is confirmed.
 */
(function () {
  'use strict';

  function cfgAilments() {
    var cfg = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.combatConfig;
    return (cfg && cfg.ailments) || {};
  }

  var RULES = {
    MIN_AILMENT_CHANCE: 5,
    AILMENT_DAMAGE_BONUS_CAP: 0.25,

    /* Stacking families (ledger keys). burning kept as burn alias. */
    poison: { maxStacks: 5, duration: 3, maxHpPctPerStack: 0.0075, ignoreDefence: true },
    toxic: { duration: 2, maxHpPct: 0.05, ignoreDefence: true, refreshable: false },
    bleed: { maxStacks: 3, duration: 3, maxHpPctPerStack: 0.01, healReductionPerStack: 0.1 },
    burning: { maxStacks: 5, duration: 3, maxHpPctPerStack: 0.01, channel: 'magic', upgrade: 'incinerating' },
    incinerating: { duration: 1, maxHpPct: 0.06, channel: 'magic', then: 'scorched', refreshable: false },
    scorched: { duration: 1, guardDownTier: 'minor', resolveDownTier: 'minor', refreshable: true },
    chilled: { maxStacks: 5, duration: 3, spdReductionPerStack: 0.03, upgrade: 'frozen' },
    frozen: { skipAction: true, grants: 'controlResistance' },
    shock: { maxStacks: 5, duration: 3, precisionPointsPerStack: -2, upgrade: 'paralysed' },
    /* Legacy key + British spelling alias for Paralysed. */
    paralyzed: { enCapAfterRecovery: 2, grants: 'controlResistance' },
    paralysed: { enCapAfterRecovery: 2, grants: 'controlResistance' },
    controlResistance: { blocks: ['chilled', 'shock'], until: 'endOfNextCompletedTurn' },
    weaken: { maxStacks: 3, duration: 3, dmgReductionPerStack: 0.08, dodgePenaltyPerStack: 4 },
    weakened: { duration: 1, mightDownTier: 'moderate', focusDownTier: 'moderate' },
    blinded: { duration: 2, accPenalty: 12 },
    delayed: { storagePct: { light: 0.25, medium: 0.35, heavy: 0.45, special: 0.5, echo: 0.25 } },
    decreed: { baseBonus: 0.12, afflictedBonus: 0.18 },
    fear: { damageDownTiers: 'major' },
    confused: { precisionDownPointsTier: 'major' },

    application: {
      perActionCap: 2,
      perTurnCap: 4,
      multiHitRiderOnce: true,
      deterministicOnLand: true,
      sharedDurationTurns: 3,
    },

    guardDuration: 1,
    guards: ['controlResistance'],

    resistanceByTier: {
      common: 0,
      strong: 8,
      elite: 12,
      boss: 20,
      duke: 30,
    },

    tickOrder: ['poison', 'toxic', 'bleed', 'burning', 'incinerating', 'scorched', 'delayed'],
  };

  function syncFromCombatConfig() {
    var a = cfgAilments();
    if (!a || typeof a !== 'object') return;
    if (a.burnMaxStacks != null) RULES.burning.maxStacks = a.burnMaxStacks;
    if (a.burnPerStackMaxHpPct != null) RULES.burning.maxHpPctPerStack = a.burnPerStackMaxHpPct;
    if (a.poisonPerStackMaxHpPct != null) RULES.poison.maxHpPctPerStack = a.poisonPerStackMaxHpPct;
    if (a.poisonToToxicStacks != null) RULES.poison.maxStacks = a.poisonToToxicStacks;
    if (a.bleedMaxStacks != null) RULES.bleed.maxStacks = a.bleedMaxStacks;
    if (a.bleedPerStackMaxHpPct != null) RULES.bleed.maxHpPctPerStack = a.bleedPerStackMaxHpPct;
    if (a.bleedHealingDownPerStack != null) RULES.bleed.healReductionPerStack = a.bleedHealingDownPerStack;
    if (a.chilledToFrozenStacks != null) RULES.chilled.maxStacks = a.chilledToFrozenStacks;
    if (a.chilledAgilityPerStack != null) RULES.chilled.spdReductionPerStack = Math.abs(a.chilledAgilityPerStack);
    if (a.shockToParalysedStacks != null) RULES.shock.maxStacks = a.shockToParalysedStacks;
    if (a.shockPrecisionPointsPerStack != null) RULES.shock.precisionPointsPerStack = a.shockPrecisionPointsPerStack;
    if (a.incineratingMaxHpPct != null) RULES.incinerating.maxHpPct = a.incineratingMaxHpPct;
    if (a.toxicMaxHpPct != null) RULES.toxic.maxHpPct = a.toxicMaxHpPct;
    if (a.toxicDurationTurns != null) RULES.toxic.duration = a.toxicDurationTurns;
    if (a.paralysedEnCapAfterRecovery != null) {
      RULES.paralyzed.enCapAfterRecovery = a.paralysedEnCapAfterRecovery;
      RULES.paralysed.enCapAfterRecovery = a.paralysedEnCapAfterRecovery;
    }
    if (a.stacksPerActionCap != null) RULES.application.perActionCap = a.stacksPerActionCap;
    if (a.stacksPerTurnCap != null) RULES.application.perTurnCap = a.stacksPerTurnCap;
    if (a.sharedDurationTurns != null) RULES.application.sharedDurationTurns = a.sharedDurationTurns;
  }
  syncFromCombatConfig();

  function isBossTarget(g, side) {
    if (side === 'enemy') return !!(g && g.enemy && g.enemy.isBoss);
    return false;
  }

  function getEnemyTier(g) {
    if (!g || !g.enemy) return 'common';
    if (g.enemy.id === 'duke_blakiston' || g.enemy.duke) return 'duke';
    if (g.enemy.isBoss || g.enemy.enemyTier === 'boss') return 'boss';
    if (g.enemy.enemyTier === 'elite' || g.enemy._eliteChecked) return 'elite';
    if (g.enemy.enemyTier === 'strong') return 'strong';
    if (Number.isFinite(g.enemy.ailmentResistance)) return null;
    return 'common';
  }

  function getTargetAilmentResistance(targetSide, g) {
    if (!g) return 0;
    if (targetSide === 'player') {
      return Math.max(0, Number(g.player && g.player.ailmentResistance) || 0);
    }
    if (Number.isFinite(g.enemy && g.enemy.ailmentResistance)) {
      return Math.max(0, Number(g.enemy.ailmentResistance));
    }
    var tier = getEnemyTier(g);
    if (tier === null) return Math.max(0, Number(g.enemy.ailmentResistance) || 0);
    return RULES.resistanceByTier[tier] || 0;
  }

  function resolveAilmentChance(basePct, targetSide, g, opts) {
    opts = opts || {};
    var base = Math.max(0, Number(basePct) || 0);
    if (opts.immune) return 0;
    var bonus = Math.max(0, Number(opts.bonusPct) || 0);
    var adjusted = base + bonus;
    var resist = getTargetAilmentResistance(targetSide, g);
    return Math.max(RULES.MIN_AILMENT_CHANCE, adjusted - resist);
  }

  function roundAilmentDmg(n) {
    if (typeof globalThis.roundCombatDamage === 'function') return globalThis.roundCombatDamage(n);
    return Math.max(0.01, Math.round(Number(n) * 100) / 100);
  }

  function capAilmentDamage(dmg) {
    return roundAilmentDmg(Math.max(0.01, Number(dmg) || 0));
  }

  function calcPoisonTickDmg(stacks, maxHp, bonusMult) {
    bonusMult = bonusMult || 1;
    var pct = RULES.poison.maxHpPctPerStack || 0.0075;
    var hp = Math.max(0.01, Number(maxHp) || 1);
    return roundAilmentDmg(Math.max(0.01, hp * pct * Math.max(0, stacks || 0) * bonusMult));
  }

  function calcToxicTickDmg(maxHp) {
    return roundAilmentDmg(Math.max(0.01, Math.max(0.01, maxHp || 1) * (RULES.toxic.maxHpPct || 0.05)));
  }

  function calcBleedTickDmg(maxHp, stacks) {
    var raw = Math.max(0.01, maxHp || 1) * (RULES.bleed.maxHpPctPerStack || 0.01) * Math.max(0, stacks || 0);
    return roundAilmentDmg(Math.max(0.01, raw));
  }

  function calcBurningTickDmg(stacks, maxHp, bonusMult) {
    bonusMult = bonusMult || 1;
    var pct = RULES.burning.maxHpPctPerStack || 0.01;
    var hp = Math.max(0.01, Number(maxHp) || 1);
    return roundAilmentDmg(Math.max(0.01, hp * pct * Math.max(0, stacks || 0) * bonusMult));
  }

  function calcIncineratingTickDmg(maxHp) {
    return roundAilmentDmg(Math.max(0.01, Math.max(0.01, maxHp || 1) * (RULES.incinerating.maxHpPct || 0.06)));
  }

  function calcScorchedTickDmg() {
    /* Scorched is Minor Guard/Resolve Down — no DoT in v0.6. */
    return 0;
  }

  function getBleedHealMult(stacks) {
    var s = Math.max(0, Math.min(RULES.bleed.maxStacks, Number(stacks) || 0));
    return Math.max(0, 1 - (RULES.bleed.healReductionPerStack || 0.1) * s);
  }

  function getWeakenDamageMult(stacks) {
    var n = Math.max(0, Math.min(RULES.weaken.maxStacks, Number(stacks) || 0));
    return Math.max(0.01, 1 - RULES.weaken.dmgReductionPerStack * n);
  }

  function getWeakenDodgePenalty(stacks) {
    var n = Math.max(0, Math.min(RULES.weaken.maxStacks, Number(stacks) || 0));
    return RULES.weaken.dodgePenaltyPerStack * n;
  }

  function getChilledSpdMult(stacks) {
    var n = Math.max(0, Math.min(RULES.chilled.maxStacks, Number(stacks) || 0));
    return Math.max(0.1, 1 - RULES.chilled.spdReductionPerStack * n);
  }

  function getShockPrecisionPenalty(stacks) {
    var n = Math.max(0, Math.min(RULES.shock.maxStacks, Number(stacks) || 0));
    return (RULES.shock.precisionPointsPerStack || -2) * n;
  }

  function getBurningDefMult(stacks, hasScorched) {
    if (hasScorched) {
      /* Minor Guard/Resolve Down = 6% from effect tiers when available. */
      var tiers = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers;
      var minor = (tiers && tiers.debuff && tiers.debuff.minor) || 6;
      return 1 - minor / 100;
    }
    /* Burn no longer softens DEF per stack in v0.6 — MaxHP% Magic DoT only. */
    return 1;
  }

  function getDelayedStoragePct(weight, enCost) {
    var map = RULES.delayed.storagePct;
    if (weight === 'echo') return map.echo;
    if (weight === 'light') return map.light;
    if (weight === 'medium') return map.medium;
    if (weight === 'heavy') return map.heavy;
    if (weight === 'special' || (Number(enCost) || 0) >= 4) return map.special;
    if ((Number(enCost) || 0) === 1) return map.light;
    if ((Number(enCost) || 0) === 2) return map.medium;
    if ((Number(enCost) || 0) === 3) return map.heavy;
    return map.medium;
  }

  function hasGuard(status, guardId) {
    if (!status || !guardId) return false;
    var g = status[guardId];
    if (!g) return false;
    if (typeof g === 'number') return g > 0;
    if (typeof g === 'object') return (g.turns || 0) > 0;
    return !!g;
  }

  function applyAilmentDamageBonus(baseDmg, bonusFraction) {
    var frac = Math.min(RULES.AILMENT_DAMAGE_BONUS_CAP, Math.max(0, Number(bonusFraction) || 0));
    return roundAilmentDmg(baseDmg * (1 + frac));
  }

  globalThis.AILMENT_RULES = RULES;
  globalThis.getTargetAilmentResistance = getTargetAilmentResistance;
  globalThis.resolveAilmentChance = resolveAilmentChance;
  globalThis.calcPoisonTickDmg = calcPoisonTickDmg;
  globalThis.calcToxicTickDmg = calcToxicTickDmg;
  globalThis.calcBleedTickDmg = calcBleedTickDmg;
  globalThis.calcBurningTickDmg = calcBurningTickDmg;
  globalThis.calcIncineratingTickDmg = calcIncineratingTickDmg;
  globalThis.calcScorchedTickDmg = calcScorchedTickDmg;
  globalThis.getBleedHealMult = getBleedHealMult;
  globalThis.getWeakenDamageMultFromRules = getWeakenDamageMult;
  globalThis.getWeakenDodgePenaltyFromRules = getWeakenDodgePenalty;
  globalThis.getChilledSpdMult = getChilledSpdMult;
  globalThis.getShockPrecisionPenalty = getShockPrecisionPenalty;
  globalThis.getBurningDefMult = getBurningDefMult;
  globalThis.getDelayedStoragePct = getDelayedStoragePct;
  globalThis.hasAilmentGuard = hasGuard;
  globalThis.applyAilmentDamageBonus = applyAilmentDamageBonus;
  globalThis.capAilmentDamage = capAilmentDamage;
  globalThis.isBossTargetForAilment = isBossTarget;
  globalThis.syncAilmentRulesFromCombatConfig = syncFromCombatConfig;
})();
