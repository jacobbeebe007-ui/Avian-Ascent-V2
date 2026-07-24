/* Equipment v0.3 loot tunables — rarity weights, shop costs, band maps.
 * Hand-authored; tune here without touching roll logic in equipment-loot.js.
 */
(function () {
  'use strict';

  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.equipment = Avian.data.equipment || Object.create(null);

  Avian.data.equipment.loot = Object.freeze({
    shopCosts: Object.freeze({
      grey: 15,
      green: 28,
      blue: 44,
      purple: 64,
      gold: 96,
      orange: 200,
    }),

    slotIcons: Object.freeze({
      Weapon: '\u2694\uFE0F',
      Armour: '\uD83D\uDEE1\uFE0F',
      Shield: '\uD83D\uDD30',
      Helmet: '\uD83D\uDC51',
      Anklet: '\u26D3\uFE0F',
      Necklace: '\uD83D\uDCFF',
    }),

    tierLabels: Object.freeze({
      grey: 'Common',
      green: 'Uncommon',
      blue: 'Rare',
      purple: 'Epic',
      gold: 'Legendary',
      orange: 'Ancestral',
    }),

    /* Band id → rarity weight map (each band sums to 1.0). Mirrors OW band keys. */
    rarityWeightsByBand: Object.freeze({
      grey: Object.freeze({ grey: 1 }),
      green: Object.freeze({ green: 1 }),
      blue: Object.freeze({ blue: 1 }),
      purple: Object.freeze({ purple: 1 }),
      gold: Object.freeze({ gold: 1 }),
      orange: Object.freeze({ orange: 1 }),
      grey_green: Object.freeze({ grey: 0.55, green: 0.45 }),
      green_blue: Object.freeze({ green: 0.5, blue: 0.5 }),
      blue_purple: Object.freeze({ blue: 0.45, purple: 0.55 }),
      purple_gold: Object.freeze({ purple: 0.55, gold: 0.45 }),
    }),

    /* Stage ceiling → shop/nest context weights (last matching row wins). */
    rarityWeightsByStage: Object.freeze([
      Object.freeze({ maxStage: 3, weights: Object.freeze({ grey: 0.5, green: 0.5 }) }),
      Object.freeze({ maxStage: 7, weights: Object.freeze({ grey: 0.3, green: 0.4, blue: 0.3 }) }),
      Object.freeze({ maxStage: 11, weights: Object.freeze({ green: 0.25, blue: 0.35, purple: 0.4 }) }),
      Object.freeze({ maxStage: 14, weights: Object.freeze({ blue: 0.2, purple: 0.45, gold: 0.35 }) }),
      Object.freeze({ maxStage: 17, weights: Object.freeze({ blue: 0.15, purple: 0.3, gold: 0.4, orange: 0.15 }) }),
      Object.freeze({ maxStage: 999, weights: Object.freeze({ green: 0.1, blue: 0.15, purple: 0.25, gold: 0.35, orange: 0.15 }) }),
    ]),

    /* Story nest choose-1-of-3: fixed rarity per stage band. Stage 20+ → no equipment. */
    storyNestRarityByStage: Object.freeze([
      Object.freeze({ maxStage: 5, rarity: 'grey' }),
      Object.freeze({ maxStage: 9, rarity: 'green' }),
      Object.freeze({ maxStage: 15, rarity: 'blue' }),
      Object.freeze({ maxStage: 19, rarity: 'purple' }),
    ]),

    /* Grove outcome overrides (outcomeType → weights). */
    groveWeights: Object.freeze({
      nest: Object.freeze({ green: 0.35, blue: 0.4, purple: 0.25 }),
      egg: Object.freeze({ green: 0.4, blue: 0.45, purple: 0.15 }),
      goldenGoose: Object.freeze({ purple: 0.35, gold: 0.45, orange: 0.2 }),
    }),
  });
})();
