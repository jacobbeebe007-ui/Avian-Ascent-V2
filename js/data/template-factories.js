/* Avian Ascent — Phase 13 ability template factories (A.6).
 *
 * These factories produce ABILITY_TEMPLATES-shaped objects with sensible
 * defaults. Use them for new abilities to avoid the 30-line boilerplate
 * tax in `js/core/game.js`. Each factory is a small, pure function so
 * the emitted object stays byte-comparable to a hand-authored template
 * (run `node scripts/diff-templates.js HEAD~1 HEAD` to verify).
 *
 * NOT YET REWRITING legacy templates: the bulk extraction of
 * ABILITY_TEMPLATES out of game.js is part of Phase 3's deferred follow
 * up. Once those land, we can rewrite the boilerplate-heavy basic
 * strikers / simple casters in 2-3 lines apiece on top of these.
 *
 * Lives on the namespace at `Avian.data.factories` so the eventual
 * `js/data/ability-templates.js` (post-Phase-3) can pull from here
 * without an import.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = { data: {} });
  Avian.data = Avian.data || Object.create(null);

  /**
   * Striker = single-target physical hit. Produces an ABILITY_TEMPLATES
   * entry with a 4-level damage curve, 1-frame cooldown, and standard
   * miss chance. Override any field via `overrides`.
   *
   * @example
   *   const beakSlam = striker({ id: 'beakSlam', name: 'Beak Slam', baseDmgMult: 1.1 });
   *
   * @param {Partial<import('./types.js').AbilityTemplate>} overrides
   * @returns {import('./types.js').AbilityTemplate}
   */
  function striker(overrides) {
    var defaults = {
      type: 'physical',
      btnType: 'attack',
      isBasic: false,
      baseMissChance: 8,
      baseDmgMult: 1.0,
      pierceDef: 0,
      energyByLevel: [0, 0, 0, 0],
      cooldownByLevel: [1, 1, 1, 1],
      ailments: [],
      levels: [
        { lv: 1, desc: 'Strike one foe.' },
        { lv: 2, desc: 'Stronger strike.' },
        { lv: 3, desc: 'Heavy strike.' },
        { lv: 4, desc: 'Crushing strike.' },
      ],
    };
    return Object.assign({}, defaults, overrides);
  }

  /**
   * Caster = single-target spell with mana cost + magic damage. Produces
   * an ABILITY_TEMPLATES entry tuned for magical attackers.
   */
  function caster(overrides) {
    var defaults = {
      type: 'magic',
      btnType: 'spell',
      isBasic: false,
      baseMissChance: 12,
      baseDmgMult: 1.0,
      pierceDef: 0,
      energyByLevel: [1, 1, 2, 2],
      cooldownByLevel: [2, 2, 3, 3],
      ailments: [],
      levels: [
        { lv: 1, desc: 'Cast a spell on the target.' },
        { lv: 2, desc: 'Stronger cast.' },
        { lv: 3, desc: 'Spell pierces a fraction of MDEF.' },
        { lv: 4, desc: 'Apex cast.' },
      ],
    };
    return Object.assign({}, defaults, overrides);
  }

  /** Multi-hit physical striker — 2-4 hits, lighter damage per hit. */
  function flurry(overrides) {
    var defaults = {
      type: 'physical',
      btnType: 'attack',
      isBasic: false,
      baseMissChance: 10,
      baseDmgMult: 0.55,
      hitsByLevel: [2, 3, 3, 4],
      energyByLevel: [0, 0, 1, 1],
      cooldownByLevel: [1, 2, 2, 3],
      ailments: [],
      levels: [
        { lv: 1, desc: '2 hits.' },
        { lv: 2, desc: '3 hits.' },
        { lv: 3, desc: '3 hits, light pierce.' },
        { lv: 4, desc: '4 hits.' },
      ],
    };
    return Object.assign({}, defaults, overrides);
  }

  /** Status applier — low base damage, high ailment proc chance. */
  function applier(ailmentId, overrides) {
    var defaults = {
      type: 'physical',
      btnType: 'attack',
      isBasic: false,
      baseMissChance: 10,
      baseDmgMult: 0.4,
      ailments: [ailmentId],
      ailmentChance: [40, 55, 70, 85],
      energyByLevel: [0, 0, 1, 1],
      cooldownByLevel: [2, 2, 3, 3],
      levels: [
        { lv: 1, desc: 'Light hit. Apply ' + ailmentId + '.' },
        { lv: 2, desc: 'Higher proc chance.' },
        { lv: 3, desc: 'Higher proc chance + bonus stack.' },
        { lv: 4, desc: 'Max proc + lasting.' },
      ],
    };
    return Object.assign({}, defaults, overrides);
  }

  /** Defensive — buffs DEF / blocks for a window. */
  function guard(overrides) {
    var defaults = {
      type: 'support',
      btnType: 'defend',
      isBasic: false,
      baseMissChance: 0,
      baseDmgMult: 0,
      energyByLevel: [0, 0, 0, 0],
      cooldownByLevel: [1, 1, 2, 2],
      ailments: [],
      levels: [
        { lv: 1, desc: 'Brace for incoming damage.' },
        { lv: 2, desc: 'Brace + light heal.' },
        { lv: 3, desc: 'Brace + heal + thorns.' },
        { lv: 4, desc: 'Iron brace.' },
      ],
    };
    return Object.assign({}, defaults, overrides);
  }

  Avian.data.factories = {
    striker: striker,
    caster: caster,
    flurry: flurry,
    applier: applier,
    guard: guard,
  };
})();
