/* Avian Ascent — combat / equipment Working Draft config.
 *
 * Hand-authored (not generated). Every Working Draft / Open Decision numeric
 * from the v0.3 workbook lives here so tuning never requires system-code edits.
 * Consumed only when Avian.flags.equipmentV2 is on (Phases 2–12); Phase 13
 * deletes the flag and this becomes the sole source of truth.
 *
 * See docs/equipment-v2-migration.md Decision Log for D1–D13 status.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  Avian.data.combatConfig = Object.freeze({
    packVersion: '2026.07-equipment-v0.3',

    /* R-EN-001 — equipment never changes these. */
    energy: Object.freeze({
      start: 4,
      regen: 3,
      max: 10,
    }),

    /* R-DMG-001 Scaling Model EN Base bands (includes 4 EN and 6 EN Ultimate). */
    enBaseDamage: Object.freeze({
      1: 5,
      2: 11,
      3: 17,
      4: 23,
      6: 35,
    }),

    /* D13 — /50 StatMod curve (Working Draft). Flag-off keeps /100 + 0.90–1.15. */
    statMod: Object.freeze({
      divisor: 50,
      min: 0.8,
      max: 1.6,
      /* Class reference stats for StatMod (primary scaling stat). */
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

    /* R-DMG-001 crit caps; per-bird critDamage comes from birds-v2. */
    crit: Object.freeze({
      chanceCapPct: 50,
      damageCapMult: 2.0,
      damageFloorMult: 1.35,
    }),

    /* R-DMG-001 hit clamp + bonus caps. */
    hit: Object.freeze({
      minPct: 15,
      maxPct: 95,
    }),
    bonusCaps: Object.freeze({
      normal: 0.3,
      equipped: 0.45,
      boss: 0.5,
    }),

    defence: Object.freeze({
      /* Defence Mod = 100 / (100 + k × EffDef). */
      curveK: 3,
      minLandedDamage: 1,
    }),

    /* R-ULT-001 — damaging hits only. Utilities award 0 when equipmentV2 on (D8). */
    ultimateMeter: Object.freeze({
      max: 100,
      damageAwards: Object.freeze({ 1: 8, 2: 12, 3: 16, 4: 22, 6: 0 }),
      utilityAwards: Object.freeze({ 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 }),
      /* Ultimate costs 0 EN in code today; workbook allows optional 6 EN gate. */
      ultimateEnCost: 0,
      requireFullMeter: true,
    }),

    /* R-EFF-001 */
    effectTiers: Object.freeze({
      minor: 10,
      moderate: 25,
      major: 50,
    }),

    /* D11 */
    orangeUniqueness: 'perRun', /* 'none' | 'perRun' | 'perInventory' */

    /* Phase 7 — equipment loot tables live in js/data/equipment/loot-tables.js */
    loot: Object.freeze({
      source: 'js/data/equipment/loot-tables.js',
    }),

    /* D12 */
    classRestrictionMode: 'hard', /* 'hard' | 'soft' | 'off' */

    /* D5 — Guard PLAYTEST placeholder until workbook signs off. */
    guard: Object.freeze({
      mode: 'PLAYTEST',
      /* Keep current gainGuarded semantics; magnitude is status-driven. */
      useLegacyGuarded: true,
    }),

    /* D6 — keep frost/ember/toxic post-upgrade windows until playtest. */
    postUpgradeWindows: Object.freeze({
      frostGuard: true,
      emberGuard: true,
      toxicResistance: true,
    }),

    /* D7 — Chilled reduces SPD only when equipmentV2 on (no EN-regen cut). */
    chilled: Object.freeze({
      removeEnRegenPenalty: true,
      stacksToFrozen: 5,
    }),

    ailments: Object.freeze({
      burnToScorchedStacks: 5,
      poisonToToxicStacks: 5,
      chilledToFrozenStacks: 5,
    }),

    /* D2 — ultimate source selection. */
    ultimateSelection: Object.freeze({
      autoWhenUnique: true,
      allowPreCombatPicker: true,
    }),

    /* D4 — choose-at-use auto-rules until choice UI ships. */
    chooseAtUse: Object.freeze({
      openingVerse: 'higherStat', /* ATK vs MATK */
      convergenceOfSix: 'mainHandAspect',
    }),

    /* Target combat pacing (warn-only in sims). */
    pacing: Object.freeze({
      targetTurnsMin: 2,
      targetTurnsMax: 4,
    }),

    /* Passive / utility power budgets (importer also validates). */
    budgets: Object.freeze({
      passiveMaxScore: 1.5,
      utilityByEn: Object.freeze({ 1: 2, 2: 4, 3: 2.5 }),
    }),

    /* Basic Attack inheritance. */
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
      'shield',
      'ankletL',
      'ankletR',
      'necklace',
    ]),
  });
})();
