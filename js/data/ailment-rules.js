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
    /* Shock: Magic DoT matching Burn per-stack %; at 5 stacks (0 Magic Armour) → Paralysed. */
    shock: {
      maxStacks: 5,
      duration: 3,
      maxHpPctPerStack: 0.01,
      channel: 'magic',
      upgrade: 'paralysed',
      requiresZeroMagicArmour: true,
    },
    /* Paralysed: +1 EN per skill for 1 turn, then Control Resistance for 2 turns. */
    paralyzed: {
      duration: 1,
      extraEnCost: 1,
      grants: 'controlResistance',
      controlResistanceTurns: 2,
    },
    paralysed: {
      duration: 1,
      extraEnCost: 1,
      grants: 'controlResistance',
      controlResistanceTurns: 2,
    },
    controlResistance: {
      blocks: ['chilled', 'shock', 'paralyzed', 'paralysed'],
      until: 'endOfCompletedTurns',
    },
    weaken: { maxStacks: 3, duration: 3, dmgReductionPerStack: 0.08, dodgePenaltyPerStack: 4 },
    weakened: { duration: 1, mightDownTier: 'moderate', focusDownTier: 'moderate' },
    blinded: { duration: 2, accPenalty: 12 },
    delayed: { storagePct: { light: 0.25, medium: 0.35, heavy: 0.45, special: 0.5, echo: 0.25 } },
    decreed: { baseBonus: 0.12, afflictedBonus: 0.18 },
    fear: { damageDownTiers: 'major' },
    confused: { precisionDownPointsTier: 'major', precisionDown: 8 },

    /* Physical stacking ailments — Current Master v1.5. */
    fracture: {
      maxStacks: 5,
      duration: 3,
      guardPerStack: -2,
      armourRestorePctPerStack: -0.04,
      upgrade: 'shattered',
      requiresZeroArmour: true,
    },
    shattered: {
      duration: 2,
      guardFlat: -10,
      armourRestorePct: -0.25,
      fortifyHealPct: -0.25,
      attackerPenetrationFlat: 3,
      refreshable: false,
    },
    crippled: {
      maxStacks: 5,
      duration: 3,
      agilityPerStack: -2,
      dodgePointsPerStack: -2,
      upgrade: 'immobilised',
      requiresZeroArmour: true,
    },
    immobilised: {
      duration: 1,
      dodgeZero: true,
      blockMobility: true,
      refreshable: false,
    },
    dazed: {
      maxStacks: 5,
      duration: 3,
      precisionPerStack: -4,
      skillPowerPerStack: -2,
      upgrade: 'concussed',
      requiresZeroArmour: true,
    },
    concussed: {
      duration: 1,
      precisionFlat: -20,
      skillPowerFlat: -15,
      nextOffensiveExtraEn: 1,
      basicAttackExempt: true,
      endsAfterOffensive: true,
      refreshable: false,
    },

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

    tickOrder: ['poison', 'toxic', 'bleed', 'burning', 'incinerating', 'scorched', 'shock', 'delayed'],
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
    if (a.shockPerStackMaxHpPct != null) RULES.shock.maxHpPctPerStack = a.shockPerStackMaxHpPct;
    else if (a.burnPerStackMaxHpPct != null && RULES.shock.maxHpPctPerStack == null) {
      RULES.shock.maxHpPctPerStack = a.burnPerStackMaxHpPct;
    }
    /* Legacy precision field ignored — Shock is a Magic DoT matching Burn. */
    if (a.incineratingMaxHpPct != null) RULES.incinerating.maxHpPct = a.incineratingMaxHpPct;
    if (a.toxicMaxHpPct != null) RULES.toxic.maxHpPct = a.toxicMaxHpPct;
    if (a.toxicDurationTurns != null) RULES.toxic.duration = a.toxicDurationTurns;
    if (a.paralysedExtraEnCost != null) {
      RULES.paralyzed.extraEnCost = a.paralysedExtraEnCost;
      RULES.paralysed.extraEnCost = a.paralysedExtraEnCost;
    }
    if (a.paralysedDurationTurns != null) {
      RULES.paralyzed.duration = a.paralysedDurationTurns;
      RULES.paralysed.duration = a.paralysedDurationTurns;
    }
    if (a.paralysedControlResistanceTurns != null) {
      RULES.paralyzed.controlResistanceTurns = a.paralysedControlResistanceTurns;
      RULES.paralysed.controlResistanceTurns = a.paralysedControlResistanceTurns;
    }
    if (a.controlResistanceTurns != null) {
      RULES.paralyzed.controlResistanceTurns = a.controlResistanceTurns;
      RULES.paralysed.controlResistanceTurns = a.controlResistanceTurns;
    }
    if (a.stacksPerActionCap != null) RULES.application.perActionCap = a.stacksPerActionCap;
    if (a.stacksPerTurnCap != null) RULES.application.perTurnCap = a.stacksPerTurnCap;
    if (a.sharedDurationTurns != null) RULES.application.sharedDurationTurns = a.sharedDurationTurns;
    if (a.fractureMaxStacks != null) RULES.fracture.maxStacks = a.fractureMaxStacks;
    if (a.fractureGuardPerStack != null) RULES.fracture.guardPerStack = a.fractureGuardPerStack;
    if (a.fractureArmourRestorePctPerStack != null) {
      RULES.fracture.armourRestorePctPerStack = a.fractureArmourRestorePctPerStack;
    }
    if (a.shatteredDurationTurns != null) RULES.shattered.duration = a.shatteredDurationTurns;
    if (a.shatteredGuardFlat != null) RULES.shattered.guardFlat = a.shatteredGuardFlat;
    if (a.shatteredArmourRestorePct != null) RULES.shattered.armourRestorePct = a.shatteredArmourRestorePct;
    if (a.shatteredFortifyHealPct != null) RULES.shattered.fortifyHealPct = a.shatteredFortifyHealPct;
    if (a.shatteredAttackerPenetrationFlat != null) {
      RULES.shattered.attackerPenetrationFlat = a.shatteredAttackerPenetrationFlat;
    }
    if (a.crippledMaxStacks != null) RULES.crippled.maxStacks = a.crippledMaxStacks;
    if (a.crippledAgilityPerStack != null) RULES.crippled.agilityPerStack = a.crippledAgilityPerStack;
    if (a.crippledDodgePointsPerStack != null) {
      RULES.crippled.dodgePointsPerStack = a.crippledDodgePointsPerStack;
    }
    if (a.immobilisedDurationTurns != null) RULES.immobilised.duration = a.immobilisedDurationTurns;
    if (a.dazedMaxStacks != null) RULES.dazed.maxStacks = a.dazedMaxStacks;
    if (a.dazedPrecisionPerStack != null) RULES.dazed.precisionPerStack = a.dazedPrecisionPerStack;
    if (a.dazedSkillPowerPerStack != null) RULES.dazed.skillPowerPerStack = a.dazedSkillPowerPerStack;
    if (a.concussedPrecisionFlat != null) RULES.concussed.precisionFlat = a.concussedPrecisionFlat;
    if (a.concussedSkillPowerFlat != null) RULES.concussed.skillPowerFlat = a.concussedSkillPowerFlat;
    if (a.concussedNextOffensiveExtraEn != null) {
      RULES.concussed.nextOffensiveExtraEn = a.concussedNextOffensiveExtraEn;
    }
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
    /* Authored 100% on-land applications skip tier resist (deterministicOnLand). */
    if (opts.skipResist || isDeterministicOnLandChance(adjusted, opts)) {
      return Math.max(0, adjusted);
    }
    var resist = getTargetAilmentResistance(targetSide, g);
    return Math.max(RULES.MIN_AILMENT_CHANCE, adjusted - resist);
  }

  function isDeterministicOnLandChance(basePct, opts) {
    opts = opts || {};
    if (opts.deterministicOnLand === false) return false;
    var app = RULES.application || {};
    if (app.deterministicOnLand === false) return false;
    return Math.max(0, Number(basePct) || 0) >= 100;
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

  /** Shock tick damage — same MaxHP% Magic formula as Burn. */
  function calcShockTickDmg(stacks, maxHp, bonusMult) {
    bonusMult = bonusMult || 1;
    var pct = RULES.shock.maxHpPctPerStack;
    if (pct == null) pct = RULES.burning.maxHpPctPerStack || 0.01;
    var hp = Math.max(0.01, Number(maxHp) || 1);
    return roundAilmentDmg(Math.max(0.01, hp * pct * Math.max(0, stacks || 0) * bonusMult));
  }

  function getParalysisExtraEnCost(status) {
    if (!isParalyzedActive(status)) return 0;
    var rule = RULES.paralyzed || RULES.paralysed || {};
    return Math.max(0, Number(rule.extraEnCost) || 1);
  }

  function isParalyzedActive(status) {
    if (!status) return false;
    var p = status.paralyzed || status.paralysed;
    if (!p) return false;
    if (typeof p === 'number') return p > 0;
    if (typeof p === 'object') {
      if (p.pending) return true;
      return (Number(p.turns) || 0) > 0;
    }
    return !!p;
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
    /* Scorched uses flat Minor Guard/Resolve Down via status, not a % DEF mult. */
    if (hasScorched) return 1;
    /* Burn no longer softens DEF per stack in v0.6 — MaxHP% Magic DoT only. */
    return 1;
  }

  function flatTierAmount(tier, dir) {
    var tiers = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers;
    var bucket = dir === 'down' ? 'debuff' : 'buff';
    var t = String(tier || 'minor').toLowerCase();
    if (tiers && tiers[bucket] && tiers[bucket][t] != null) return Number(tiers[bucket][t]);
    if (t === 'major') return 20;
    if (t === 'moderate') return 10;
    return 4;
  }

  function pointTierAmount(tier) {
    var tiers = globalThis.Avian && globalThis.Avian.data && globalThis.Avian.data.effectTiers;
    var t = String(tier || 'minor').toLowerCase();
    if (tiers && tiers.points && tiers.points[t] != null) return Number(tiers.points[t]);
    if (t === 'major') return 20;
    if (t === 'moderate') return 10;
    return 4;
  }

  function scorchedFrom(statusOrScorched) {
    if (!statusOrScorched) return null;
    if (statusOrScorched.scorched) return statusOrScorched.scorched;
    if (statusOrScorched.guardDown != null || statusOrScorched.resolveDown != null || statusOrScorched.turns != null) {
      return statusOrScorched;
    }
    return null;
  }

  function getScorchedGuardPenalty(status) {
    var sc = scorchedFrom(status);
    if (!sc) return 0;
    if ((sc.turns || 0) <= 0 && sc.guardDown == null) return 0;
    if (sc.guardDown != null) return -Math.abs(Number(sc.guardDown) || 0);
    return -flatTierAmount(RULES.scorched.guardDownTier || 'minor', 'down');
  }

  function getScorchedResolvePenalty(status) {
    var sc = scorchedFrom(status);
    if (!sc) return 0;
    if ((sc.turns || 0) <= 0 && sc.resolveDown == null) return 0;
    if (sc.resolveDown != null) return -Math.abs(Number(sc.resolveDown) || 0);
    return -flatTierAmount(RULES.scorched.resolveDownTier || 'minor', 'down');
  }

  function getWeakenedMightPenalty(status) {
    if (!status || !status.weakened) return 0;
    if ((status.weakened.turns || 0) <= 0) return 0;
    if (status.weakened.mightDown != null) return -Math.abs(Number(status.weakened.mightDown) || 0);
    return -flatTierAmount(RULES.weakened.mightDownTier || 'moderate', 'down');
  }

  function getWeakenedFocusPenalty(status) {
    if (!status || !status.weakened) return 0;
    if ((status.weakened.turns || 0) <= 0) return 0;
    if (status.weakened.focusDown != null) return -Math.abs(Number(status.weakened.focusDown) || 0);
    return -flatTierAmount(RULES.weakened.focusDownTier || 'moderate', 'down');
  }

  function getFearDamageMult(status) {
    if (!status) return 1;
    var feared = status.feared;
    var active = (typeof feared === 'number' && feared > 0)
      || (feared && typeof feared === 'object' && ((feared.turns || 0) > 0 || feared.pending));
    if (!active) return 1;
    /* Authored Major Damage Down is −12%, independent of core-stat flat tiers. */
    return 0.88;
  }

  function getConfusedPrecisionPenalty(status) {
    if (!status || !status.confused) return 0;
    var c = status.confused;
    var pts = RULES.confused && RULES.confused.precisionDown != null
      ? Number(RULES.confused.precisionDown)
      : 8;
    if (typeof c === 'number') return c > 0 ? -pts : 0;
    if ((c.turns || 0) <= 0 && !c.pending) return 0;
    if (c.precisionDown != null) return -Math.abs(Number(c.precisionDown) || 0);
    return -pts;
  }

  function makeScorchedStatus(turns) {
    var dur = turns != null ? Number(turns) : ((RULES.scorched && RULES.scorched.duration) || 1);
    var guard = flatTierAmount(RULES.scorched.guardDownTier || 'minor', 'down');
    var resolve = flatTierAmount(RULES.scorched.resolveDownTier || 'minor', 'down');
    return { turns: dur, guardDown: guard, resolveDown: resolve };
  }

  function makeWeakenedStatus(turns) {
    var dur = turns != null ? Number(turns) : ((RULES.weakened && RULES.weakened.duration) || 1);
    return {
      turns: dur,
      mightDown: flatTierAmount(RULES.weakened.mightDownTier || 'moderate', 'down'),
      focusDown: flatTierAmount(RULES.weakened.focusDownTier || 'moderate', 'down'),
    };
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

  function getArmourRestoreReceivedMult(status) {
    if (!status) return 1;
    var mult = 1;
    var fr = status.fracture;
    if (fr && (fr.stacks || 0) > 0) {
      mult += (RULES.fracture.armourRestorePctPerStack || -0.04) * (fr.stacks || 0);
    }
    if (status.shattered) {
      mult += (RULES.shattered.armourRestorePct || -0.25);
    }
    return Math.max(0, Math.min(1, mult));
  }

  function getFortifyHealReceivedMult(status) {
    if (!status) return 1;
    if (status.shattered) {
      return Math.max(0, 1 + (RULES.shattered.fortifyHealPct || -0.25));
    }
    return 1;
  }

  function getFractureGuardPenalty(status) {
    if (!status) return 0;
    var pen = 0;
    var fr = status.fracture;
    if (fr && (fr.stacks || 0) > 0) {
      pen += (RULES.fracture.guardPerStack || -2) * (fr.stacks || 0);
    }
    if (status.shattered) pen += (RULES.shattered.guardFlat || -10);
    return pen;
  }

  function getCrippledAgilityPenalty(status) {
    var cr = status && status.crippled;
    if (!cr || !(cr.stacks > 0)) return 0;
    return (RULES.crippled.agilityPerStack || -2) * (cr.stacks || 0);
  }

  function getCrippledDodgePenalty(status) {
    var cr = status && status.crippled;
    if (!cr || !(cr.stacks > 0)) return 0;
    return (RULES.crippled.dodgePointsPerStack || -2) * (cr.stacks || 0);
  }

  function getDazedPrecisionPenalty(status) {
    if (!status) return 0;
    var pen = 0;
    var dz = status.dazed;
    if (dz && (dz.stacks || 0) > 0) {
      pen += (RULES.dazed.precisionPerStack || -4) * (dz.stacks || 0);
    }
    if (status.concussed) pen += (RULES.concussed.precisionFlat || -20);
    return pen;
  }

  function getDazedSkillPowerPenalty(status) {
    if (!status) return 0;
    var pen = 0;
    var dz = status.dazed;
    if (dz && (dz.stacks || 0) > 0) {
      pen += (RULES.dazed.skillPowerPerStack || -2) * (dz.stacks || 0);
    }
    if (status.concussed) pen += (RULES.concussed.skillPowerFlat || -15);
    return pen;
  }

  function getShatteredAttackerPenetration(status) {
    if (!status || !status.shattered) return 0;
    return Math.max(0, Number(RULES.shattered.attackerPenetrationFlat) || 3);
  }

  function isImmobilisedActive(status) {
    if (!status || !status.immobilised) return false;
    var im = status.immobilised;
    if (typeof im === 'number') return im > 0;
    return (Number(im.turns) || 0) > 0 || !!im.active;
  }

  function isConcussedActive(status) {
    if (!status || !status.concussed) return false;
    var c = status.concussed;
    if (typeof c === 'number') return c > 0;
    return (Number(c.turns) || 0) > 0 || !!c.pendingExtraEn;
  }

  function getConcussedExtraEnCost(status, ability) {
    if (!isConcussedActive(status)) return 0;
    var rule = RULES.concussed || {};
    if (ability) {
      if (rule.basicAttackExempt) {
        var isBasic = !!(ability.isBasicAttack || ability.skillType === 'Basic'
          || /basic attack/i.test(String(ability.name || ''))
          || ability.id === 'BASIC_PHYSICAL' || ability.id === 'BASIC_MAGIC'
          || ability.equipmentSkillId === 'BASIC_PHYSICAL' || ability.equipmentSkillId === 'BASIC_MAGIC'
          || ability.barSlot === 'Basic Attack');
        if (isBasic) return 0;
      }
      var target = String(ability.target || 'enemy').toLowerCase();
      if (ability.noDamage || target === 'self') return 0;
    }
    return Math.max(0, Number(rule.nextOffensiveExtraEn) || 1);
  }

  function isMobilitySkillBlocked(ability) {
    if (!ability) return false;
    var blob = [
      ability.name, ability.id, ability.equipmentSkillId,
      Array.isArray(ability.tags) ? ability.tags.join(' ') : '',
      ability.riderText, ability.skillType, ability.barSlot,
    ].join(' ');
    return /evade|evasive|retreat|withdraw|dodge|hop|dash|charge|mobility|slip|skitter|flee|escape|disengage/i.test(blob);
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
  globalThis.isDeterministicOnLandChance = isDeterministicOnLandChance;
  globalThis.calcPoisonTickDmg = calcPoisonTickDmg;
  globalThis.calcToxicTickDmg = calcToxicTickDmg;
  globalThis.calcBleedTickDmg = calcBleedTickDmg;
  globalThis.calcBurningTickDmg = calcBurningTickDmg;
  globalThis.calcShockTickDmg = calcShockTickDmg;
  globalThis.calcIncineratingTickDmg = calcIncineratingTickDmg;
  globalThis.calcScorchedTickDmg = calcScorchedTickDmg;
  globalThis.getBleedHealMult = getBleedHealMult;
  globalThis.getWeakenDamageMultFromRules = getWeakenDamageMult;
  globalThis.getWeakenDodgePenaltyFromRules = getWeakenDodgePenalty;
  globalThis.getChilledSpdMult = getChilledSpdMult;
  globalThis.getShockPrecisionPenalty = getShockPrecisionPenalty;
  globalThis.getBurningDefMult = getBurningDefMult;
  globalThis.getScorchedGuardPenalty = getScorchedGuardPenalty;
  globalThis.getScorchedResolvePenalty = getScorchedResolvePenalty;
  globalThis.getWeakenedMightPenalty = getWeakenedMightPenalty;
  globalThis.getWeakenedFocusPenalty = getWeakenedFocusPenalty;
  globalThis.getFearDamageMult = getFearDamageMult;
  globalThis.getConfusedPrecisionPenalty = getConfusedPrecisionPenalty;
  globalThis.makeScorchedStatus = makeScorchedStatus;
  globalThis.makeWeakenedStatus = makeWeakenedStatus;
  globalThis.getDelayedStoragePct = getDelayedStoragePct;
  globalThis.hasAilmentGuard = hasGuard;
  globalThis.isParalyzedActive = isParalyzedActive;
  globalThis.getParalysisExtraEnCost = getParalysisExtraEnCost;
  globalThis.applyAilmentDamageBonus = applyAilmentDamageBonus;
  globalThis.capAilmentDamage = capAilmentDamage;
  globalThis.isBossTargetForAilment = isBossTarget;
  globalThis.syncAilmentRulesFromCombatConfig = syncFromCombatConfig;
  globalThis.getArmourRestoreReceivedMult = getArmourRestoreReceivedMult;
  globalThis.getFortifyHealReceivedMult = getFortifyHealReceivedMult;
  globalThis.getFractureGuardPenalty = getFractureGuardPenalty;
  globalThis.getCrippledAgilityPenalty = getCrippledAgilityPenalty;
  globalThis.getCrippledDodgePenalty = getCrippledDodgePenalty;
  globalThis.getDazedPrecisionPenalty = getDazedPrecisionPenalty;
  globalThis.getDazedSkillPowerPenalty = getDazedSkillPowerPenalty;
  globalThis.getShatteredAttackerPenetration = getShatteredAttackerPenetration;
  globalThis.isImmobilisedActive = isImmobilisedActive;
  globalThis.isConcussedActive = isConcussedActive;
  globalThis.getConcussedExtraEnCost = getConcussedExtraEnCost;
  globalThis.isMobilitySkillBlocked = isMobilitySkillBlocked;
})();
