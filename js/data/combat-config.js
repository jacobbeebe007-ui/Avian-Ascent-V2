/* Avian Ascent — combat / equipment Working Draft config.
 *
 * Hand-authored (not generated). Working Draft / Open Decision numerics from
 * Equipment Loot v0.7 live here so tuning never requires system-code edits.
 * Confirmed structure rules may also appear for a single source of truth.
 *
 * See docs/equipment-loot-v07-migration.md.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  Avian.data.combatConfig = Object.freeze({
    packVersion: '2026.07-equipment-loot-v0.7',
    affinityArsenalV06: true,
    equipmentLootV07: true,

    /* R-EN-001 — equipment never changes these. Carryover cap is WD (OD-025). */
    energy: Object.freeze({
      start: 4,
      regen: 3,
      max: 10,
      carryoverCap: 6,
    }),

    /* Legacy EN×AP path retained for fixtures; v0.6 damage uses directScaling. */
    enBaseDamage: Object.freeze({
      1: 5,
      2: 11,
      3: 17,
      4: 23,
      6: 35,
    }),

    /* v0.7 direct damage: BaseDamage + FinalStat × coefficient × scale (R-EN-005 bands).
     * Scaling Model: Base Damage = 2 × EN; Defence Mod = 150/(150+EffDef);
     * Affinity 1.20/1.00/0.80; Bonus cap +45%; Crit chance 50% / Ferocity ×2. */
    directScaling: Object.freeze({
      enabled: true,
      baseDamagePerEn: 2,
      /* Softens gear+level linear contribution for early 2–4 turn pacing. */
      statContributionScale: 0.75,
      /* EN → reference coefficient mid-band / Precision (R-EN-005). */
      enAttackBands: Object.freeze({
        1: Object.freeze({ coeff: 0.8, precision: 1.0, min: 0.70, max: 0.90 }),
        2: Object.freeze({ coeff: 1.1, precision: 0.98, min: 1.00, max: 1.20 }),
        3: Object.freeze({ coeff: 1.4, precision: 0.94, min: 1.30, max: 1.50 }),
        4: Object.freeze({ coeff: 1.75, precision: 0.89, min: 1.60, max: 1.90 }),
        5: Object.freeze({ coeff: 2.1, precision: 0.9, min: 1.95, max: 2.25 }),
        6: Object.freeze({ coeff: 2.55, precision: 0.92, min: 2.35, max: 2.80 }),
      }),
      /* R-CD-001 */
      enCooldown: Object.freeze({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0 }),
    }),

    /* Legacy StatMod kept for non-v0.6 fallbacks; unused when directScaling.enabled. */
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

    /* R-PEN-001 */
    penetration: Object.freeze({
      cap: 0.4,
      bands: Object.freeze({ light: 0.15, medium: 0.25, heavy: 0.4 }),
    }),

    /* Crit / Ferocity */
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

    /* Defence Mod = C / (C + EffDef). Combat retune: C=150. */
    defence: Object.freeze({
      constant: 150,
      curveK: 3,
      formula: 'constantOverSum',
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

    /* R-EFF-001 — core % and point tiers. */
    effectTiers: Object.freeze({
      minor: 6,
      moderate: 8,
      major: 12,
      core: Object.freeze({ minor: 6, moderate: 8, major: 12 }),
      points: Object.freeze({ minor: 3, moderate: 5, major: 8 }),
      coreTempCapPct: 20,
      precisionTempCapPoints: 12,
    }),

    evasion: Object.freeze({
      permanentCapPct: 20,
      totalCapPct: 35,
    }),

    orangeUniqueness: 'perRun',

    loot: Object.freeze({
      source: 'js/data/equipment/loot-tables.js',
    }),

    classRestrictionMode: 'hard',

    /* Guard = Martial DEF; Brace = temporary DR. */
    guard: Object.freeze({
      mode: 'BRACE_V06',
      useLegacyGuarded: false,
      braceIsDamageReduction: true,
    }),

    brace: Object.freeze({
      minor: 6,
      moderate: 8,
      major: 12,
      capPct: 12,
    }),

    recovery: Object.freeze({
      barrierCapMaxHpPct: 0.35,
      lifestealTriggerCapMaxHpPct: 0.1,
      directHealMaxPerCastMaxHpPct: 0.35,
      healingPowerAppliesToLifesteal: false,
      braceCapPct: 0.12,
    }),

    vitalityRebase: 20,
    levelCap: 30,

    equipmentCaps: Object.freeze({
      vitalityPct: 0.6,
      corePct: 0.5,
      agilityPct: 0.3,
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
      /* Basic / Natural Strike is exempt and may be used every action. */
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
      naturalStrikeName: 'Natural Strike',
      enCost: 1,
      ap: 0.8,
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
