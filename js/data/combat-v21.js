/* Avian Ascent — Combat Foundation v2.1 locked decisions.
 *
 * Hand-authored from the merged master workbook
 * Avian_Ascent_Current_Master_v2.1.xlsx. Runtime still uses the v1.6
 * weapon-first damage and +3 Vitality Health path until Phase 1 lands.
 * These values are the adopted design and are consumed by hybrid overflow,
 * Ultimate Meter, affinity, sequential carry, and ordinary-cooldown policy.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  Avian.data.combatV21 = Object.freeze({
    packVersion: '2026.09-combat-v2.1-master',
    sourceWorkbook: 'Avian_Ascent_Current_Master_v2.1.xlsx',
    attackPower: Object.freeze({
      formula: 'weaponRoll + 2 * scalingStat',
      statPerPoint: 2,
      runtimeActive: false,
    }),
    health: Object.freeze({
      sizeBase: Object.freeze({
        Tiny: 125, Small: 128, Medium: 131, Large: 134,
        'Very Large': 137, Giant: 140, 'Boss Override': 150,
      }),
      vitalityPerPoint: 5,
      perLevel: 5,
      runtimeActive: false,
    }),
    ap: Object.freeze({
      start: 4,
      regen: 3,
      max: 6,
      carryoverCap: 6,
    }),
    coefficients: Object.freeze({
      1: 0.45,
      2: 1.00,
      3: 1.50,
      4: 2.10,
      5: 2.70,
      6: 3.30,
    }),
    ordinaryCooldowns: false,
    ultimate: Object.freeze({
      apCost: 6,
      meterMax: 100,
      meterPerAp: 6,
      utilityAwards: 0,
      oncePerLandedAction: true,
      multiHitOnce: true,
      perTurnCap: 24,
    }),
    affinity: Object.freeze({
      dominant: 1.10,
      neutral: 1.00,
      resisted: 0.90,
    }),
    hit: Object.freeze({
      minPct: 60,
      maxPct: 95,
    }),
    hybrid: Object.freeze({
      rule: 'meanPoolHealthGate',
      healthGate: 'totalPostMit - mean(startArmour, startMagicArmour)',
      portionsResolveSeparately: true,
    }),
    sequentialCarry: Object.freeze({
      health: 'persist',
      protection: 'refillNormalMax',
      ap: 'persistCap6',
      buffs: 'persistRemaining',
      playerAilments: 'persist',
      enemyAilments: 'discard',
      ultimateMeter: 'persist',
      fortifyWardOverflow: 'expire',
      oncePerBattle: 'persistThroughSequence',
    }),
    rarity: Object.freeze({
      birdDamageMultiplier: false,
      greyAndOrangeEquallyViable: true,
      powerLadder: 'equipmentMilestone',
    }),
    effectTiers: Object.freeze({
      minor: 1,
      major: 2,
      grand: 4,
      standardDuration: 3,
      grandDuration: 2,
    }),
    telemetry: Object.freeze({
      minRunsPerMatchup: 200,
      requiredFields: Object.freeze([
        'playerWin', 'rounds', 'unusedAP', 'actionChosen',
        'fortify', 'ward', 'ailmentAttempt', 'ailmentOk', 'ailmentGated',
        'damageSource', 'effectiveDurability', 'firstActorWin',
      ]),
    }),
  });
})();
