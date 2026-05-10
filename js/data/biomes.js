/* Avian Ascent — biome table.
 *
 * Stage-banded biome modifiers consumed by `getBiomeForStage` and
 * `applyBiomeModifiers` in game.js. Read-only — never mutated at runtime.
 */
(function () {
  'use strict';
  /** @type {import('./types.js').Biome[]} */
  var biomes = [
    { id: 'wetlands',   name: 'Black Marsh Wetlands', stageMin: 1,  stageMax: 10,   mod: { enemyPoisonPlus: 1 } },
    { id: 'cliffs',     name: 'Razor Cliffline',      stageMin: 11, stageMax: 20,   mod: { enemyCritPlus: 0.05 } },
    { id: 'stormcoast', name: 'Storm Coast',          stageMin: 21, stageMax: 30,   mod: { lightningBonus: 0.15 } },
    { id: 'court',      name: "Blakiston's Court",    stageMin: 31, stageMax: 9999, mod: { dread: 1 } },
  ];
  globalThis.BIOMES = biomes;
})();
