/* Avian Ascent — combat / equipment Working Draft config.
 *
 * Hand-authored (not generated). Weapon-first v0.9 numerics live here so
 * tuning never requires system-code edits.
 *
 * See docs/weapon-first-v09-migration.md.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  Avian.data.combatConfig = Object.freeze({
    packVersion: '2026.07-weapon-first-v0.9',
    affinityArsenalV06: true,
    equipmentLootV07: false,
    weaponFirstV09: true,

    /* R-EN-001 — equipment never changes these. Carryover cap is WD (OD-025). */
    energy: Object.freeze({
      start: 4,
      regen: 3,
      max: 10,
      carryoverCap: 6,
    }),

    /* Legacy EN×AP path retained for older fixtures; disabled when weaponFirst is on. */
    enBaseDamage: Object.freeze({
      1: 5,
      2: 11,
      3: 17,
      4: 23,
      6: 35,
    }),

    /* v0.9 weapon-first: Weapon × ((SkillPowerPct + Stat×2.5) ÷ 100). */
    weaponFirst: Object.freeze({
      enabled: true,
      offencePctPerStat: 2.5,
      vitalityBaseHealthPct: 0.05,
      agilityDodgePctPerPoint: 0.5,
      dodgeCapPct: 50,
      /* Natural Strike: flat 1–2 + 100% Skill Power of equipped weapon. */
      naturalStrike: Object.freeze({
        skillPowerPct: 100,
        flatMin: 1,
        flatMax: 2,
      }),
    }),

    /* Legacy directScaling kept disabled; verify scripts may still read bands. */
    directScaling: Object.freeze({
      enabled: false,
      baseDamagePerEn: 2,
      statContributionScale: 0.75,
      enAttackBands: Object.freeze({
        1: Object.freeze({ coeff: 0.8, precision: 1.0, min: 0.70, max: 0.90 }),
        2: Object.freeze({ coeff: 1.1, precision: 0.98, min: 1.00, max: 1.20 }),
        3: Object.freeze({ coeff: 1.4, precision: 0.94, min: 1.30, max: 1.50 }),
        4: Object.freeze({ coeff: 1.75, precision: 0.89, min: 1.60, max: 1.90 }),
        5: Object.freeze({ coeff: 2.1, precision: 0.9, min: 2.00, max: 2.35 }),
        6: Object.freeze({ coeff: 2.55, precision: 0.92, min: 2.45, max: 2.90 }),
      }),
      enCooldown: Object.freeze({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0 }),
    }),

    /* Skill Power bands by EN (weapon % multipliers). */
    skillPowerBands: Object.freeze({
      1: Object.freeze({ min: 70, max: 90 }),
      2: Object.freeze({ min: 100, max: 120 }),
      3: Object.freeze({ min: 130, max: 150 }),
      4: Object.freeze({ min: 160, max: 190 }),
      5: Object.freeze({ min: 200, max: 235 }),
      6: Object.freeze({ min: 245, max: 290 }),
    }),

    /* Legacy StatMod unused when weaponFirst.enabled. */
    statMod: Object.freeze({
      divisor: 50,
      min: 0.8,
      max: 1.6,
      classReferences: Object.freeze({
        knight: 12,
        rogue: 8,
        mage: 21,
        siren: 14,
        inquisitor: 10,
        bard: 9,
        brute: 15,
        duke: 21,
      }),
    }),

    /* R-PEN-001 — % pen after flat; shared 40% cap on percentage pen. */
    penetration: Object.freeze({
      cap: 0.4,
      bands: Object.freeze({ light: 0.15, medium: 0.25, heavy: 0.4 }),
    }),

    crit: Object.freeze({
      chanceCapPct: 50,
      damageCapMult: 2.0,
      damageFloorMult: 1.35,
    }),

    hit: Object.freeze({
      minPct: 15,
      maxPct: 95,
    }),
    bonusCaps: Object.freeze({
      normal: 0.3,
      equipped: 0.45,
      boss: 0.5,
    }),

    /* Mitigation: rating = EffDef × 2.5; mit% = rating/(100+rating), cap 75%. */
    defence: Object.freeze({
      formula: 'ratingOverSum',
      ratingScale: 2.5,
      mitigationBase: 100,
      mitigationCap: 0.75,
      /* Legacy C=150 path disabled. */
      constant: 150,
      curveK: 3,
      minLandedDamage: 1,
    }),

    ultimateMeter: Object.freeze({
      max: 100,
      damageAwards: Object.freeze({ 1: 8, 2: 12, 3: 16, 4: 22, 6: 0 }),
      utilityAwards: Object.freeze({ 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 }),
      ultimateEnCost: 0,
      requireFullMeter: true,
      oncePerLandedAction: true,
    }),

    /* R-EFF-001 — flat tiers ±4 / ±10 / ±20. */
    effectTiers: Object.freeze({
      minor: 4,
      moderate: 10,
      major: 20,
      core: Object.freeze({ minor: 4, moderate: 10, major: 20 }),
      points: Object.freeze({ minor: 4, moderate: 10, major: 20 }),
      flatStat: true,
      coreTempCapPct: 20,
      precisionTempCapPoints: 12,
    }),

    /* Dodge is derived from Agility; permanent separate Evasion core removed. */
    evasion: Object.freeze({
      permanentCapPct: 50,
      totalCapPct: 50,
      derivedFromAgility: true,
    }),

    orangeUniqueness: 'perRun',

    loot: Object.freeze({
      source: 'js/data/equipment/loot-tables.js',
    }),

    classRestrictionMode: 'hard',

    guard: Object.freeze({
      mode: 'BRACE_V06',
      useLegacyGuarded: false,
      braceIsDamageReduction: true,
    }),

    brace: Object.freeze({
      minor: 4,
      moderate: 10,
      major: 20,
      capPct: 12,
    }),

    recovery: Object.freeze({
      barrierCapMaxHpPct: 0.35,
      lifestealTriggerCapMaxHpPct: 0.1,
      directHealMaxPerCastMaxHpPct: 0.35,
      healingPowerAppliesToLifesteal: false,
      braceCapPct: 0.12,
    }),

    /* Universal +20 Health removed; Max HP from Base Health × (1 + Vit × 0.05). */
    vitalityRebase: 0,
    levelCap: 30,

    equipmentCaps: Object.freeze({
      vitalityPct: 0,
      corePct: 0,
      agilityPct: 0,
    }),

    progressionTier: Object.freeze({
      grey: 1.0,
      green: 1.04,
      blue: 1.08,
      purple: 1.12,
      gold: 1.16,
      orange: 1.2,
    }),

    postUpgradeWindows: Object.freeze({
      frostGuard: false,
      emberGuard: false,
      toxicResistance: false,
      controlResistance: true,
    }),

    chilled: Object.freeze({
      removeEnRegenPenalty: true,
      stacksToFrozen: 5,
    }),

    ailments: Object.freeze({
      burnMaxStacks: 5,
      burnToIncineratingStacks: 5,
      poisonToToxicStacks: 5,
      chilledToFrozenStacks: 5,
      shockToParalysedStacks: 5,
      bleedMaxStacks: 3,
      sharedDurationTurns: 3,
      stacksPerActionCap: 2,
      stacksPerTurnCap: 4,
      multiHitRiderOnce: true,
      deterministicOnLand: true,
      paralysedEnCapAfterRecovery: 2,
      incineratingMaxHpPct: 0.06,
      scorchedUsesMinorDefenceDown: true,
      toxicMaxHpPct: 0.05,
      toxicDurationTurns: 2,
      burnPerStackMaxHpPct: 0.01,
      poisonPerStackMaxHpPct: 0.0075,
      bleedPerStackMaxHpPct: 0.01,
      bleedHealingDownPerStack: 0.1,
      chilledAgilityPerStack: -0.03,
      shockPrecisionPointsPerStack: -2,
    }),

    enRoles: Object.freeze({
      basicEn: 1,
      utilityEn: 1,
      equipmentMinEn: 2,
      heavyEn: 4,
      combinationEn: 3,
      focusPulseEn: 2,
      oncePerTurnActionUse: true,
      basicExemptFromOncePerTurn: true,
    }),

    ultimateSelection: Object.freeze({
      autoWhenUnique: true,
      allowPreCombatPicker: true,
    }),

    chooseAtUse: Object.freeze({
      openingVerse: 'higherStat',
      convergenceOfSix: 'mainHandAspect',
    }),

    pacing: Object.freeze({
      targetTurnsMin: 2,
      targetTurnsMax: 4,
    }),

    budgets: Object.freeze({
      passiveMaxScore: 1.5,
      utilityByEn: Object.freeze({ 1: 2, 2: 4, 3: 2.5 }),
    }),

    basicAttack: Object.freeze({
      physicalId: 'BASIC_PHYSICAL',
      magicId: 'BASIC_MAGIC',
      beakJabName: 'Beak Jab',
      tailWandName: 'Tail Wand',
      /** @deprecated use beakJabName */
      naturalStrikeName: 'Beak Jab',
      tailWandClasses: Object.freeze(['mage', 'siren']),
      enCost: 1,
      skillPowerPct: 100,
      flatMin: 1,
      flatMax: 2,
    }),

    actionSources: Object.freeze([
      'basic',
      'utility',
      'weaponA',
      'weaponB',
      'armour',
      'ultimate',
    ]),

    equipmentSlots: Object.freeze([
      'helmet',
      'armour',
      'mainHand',
      'offHand',
      'ankletL',
      'ankletR',
      'necklace',
    ]),
  });

  if (typeof globalThis.syncAilmentRulesFromCombatConfig === 'function') {
    globalThis.syncAilmentRulesFromCombatConfig();
  }
})();
