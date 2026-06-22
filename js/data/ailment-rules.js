/* Master Ailment List — canonical rules and pure math helpers.
 * Loaded before ailments.js so metadata can reference rule constants. */
(function () {
  'use strict';

  var RULES = {
    MIN_AILMENT_CHANCE: 5,
    AILMENT_DAMAGE_BONUS_CAP: 0.25,

    poison: { maxStacks: 5, duration: 3, dmgPerStack: 1 },
    toxic: { duration: 2, maxHpPct: 0.08, capNormal: 12, capBoss: 8 },
    bleed: { maxStacks: 3, duration: 3, maxHpPctPerStack: 0.02, healReductionPerStack: 0.15, capNormal: 8, capBoss: 6 },
    burning: { maxStacks: 3, duration: 3, flatPerStack: 3, defReductionPerStack: 0.04 },
    scorched: { duration: 2, flatDmg: 8, defReduction: 0.12 },
    chilled: { maxStacks: 5, duration: 3, spdReductionPerStack: 0.06 },
    frozen: { skipAction: true },
    weaken: { maxStacks: 3, duration: 3, dmgReductionPerStack: 0.08, dodgePenaltyPerStack: 4 },
    paralyzed: { duration: 2, skipChance: 20 },
    blinded: { duration: 2, accPenalty: 12 },
    delayed: { storagePct: { light: 0.25, medium: 0.35, heavy: 0.45, special: 0.50 } },
    decreed: { baseBonus: 0.12, afflictedBonus: 0.18 },

    guardDuration: 1,
    guards: ['frostGuard', 'emberGuard', 'toxicResistance'],

    resistanceByTier: {
      common: 0,
      strong: 8,
      elite: 12,
      boss: 20,
      duke: 30,
    },

    tickOrder: ['poison', 'toxic', 'bleed', 'burning', 'scorched', 'delayed'],
  };

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
      return Math.max(0, Number(g.player?.ailmentResistance) || 0);
    }
    if (Number.isFinite(g.enemy?.ailmentResistance)) {
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

  function capAilmentDamage(dmg, g, side) {
    return roundAilmentDmg(Math.max(0.01, Number(dmg) || 0));
  }

  function calcPoisonTickDmg(stacks, bonusMult) {
    bonusMult = bonusMult || 1;
    return roundAilmentDmg(Math.max(0.01, (RULES.poison.dmgPerStack * Math.max(0, stacks || 0)) * bonusMult));
  }

  function calcToxicTickDmg(maxHp, g, side) {
    var raw = roundAilmentDmg(Math.max(0.01, maxHp || 1) * RULES.toxic.maxHpPct);
    var cap = isBossTarget(g, side) ? RULES.toxic.capBoss : RULES.toxic.capNormal;
    return roundAilmentDmg(Math.max(0.01, Math.min(cap, raw)));
  }

  function calcBleedTickDmg(maxHp, stacks, g, side) {
    var raw = roundAilmentDmg(Math.max(0.01, maxHp || 1) * RULES.bleed.maxHpPctPerStack * Math.max(0, stacks || 0));
    var cap = isBossTarget(g, side) ? RULES.bleed.capBoss : RULES.bleed.capNormal;
    return roundAilmentDmg(Math.max(0.01, Math.min(cap, raw)));
  }

  function calcBurningTickDmg(stacks, bonusMult) {
    bonusMult = bonusMult || 1;
    return roundAilmentDmg(Math.max(0.01, RULES.burning.flatPerStack * Math.max(0, stacks || 0) * bonusMult));
  }

  function calcScorchedTickDmg(bonusMult) {
    bonusMult = bonusMult || 1;
    return roundAilmentDmg(Math.max(0.01, RULES.scorched.flatDmg * bonusMult));
  }

  function getBleedHealMult(stacks) {
    var s = Math.max(0, Math.min(RULES.bleed.maxStacks, Number(stacks) || 0));
    return Math.max(0.01, 1 - RULES.bleed.healReductionPerStack * s);
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

  function getBurningDefMult(stacks, hasScorched) {
    if (hasScorched) return 1 - RULES.scorched.defReduction;
    var n = Math.max(0, Math.min(RULES.burning.maxStacks, Number(stacks) || 0));
    return Math.max(0.01, 1 - RULES.burning.defReductionPerStack * n);
  }

  function getDelayedStoragePct(weight, enCost) {
    var map = RULES.delayed.storagePct;
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
  globalThis.calcScorchedTickDmg = calcScorchedTickDmg;
  globalThis.getBleedHealMult = getBleedHealMult;
  globalThis.getWeakenDamageMultFromRules = getWeakenDamageMult;
  globalThis.getWeakenDodgePenaltyFromRules = getWeakenDodgePenalty;
  globalThis.getChilledSpdMult = getChilledSpdMult;
  globalThis.getBurningDefMult = getBurningDefMult;
  globalThis.getDelayedStoragePct = getDelayedStoragePct;
  globalThis.hasAilmentGuard = hasGuard;
  globalThis.applyAilmentDamageBonus = applyAilmentDamageBonus;
})();
