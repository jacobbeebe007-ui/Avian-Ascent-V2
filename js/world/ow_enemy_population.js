/**
 * Deterministic per-pack overworld enemy population (stages 1–9, 11–19).
 * Tier pools mirror BIRD_ENEMIES + pickBirdEnemyPoolForTier in js/core/game.js — keep in sync when editing tiers.
 */
(function (global) {
  'use strict';

  /** @returns {() => number} RNG in [0, 1) */
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Ten fixed run seeds (uint32). */
  var OW_PACK_SEEDS = [
    0x9e3779b1, 0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344,
    0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89, 0x452821e6,
  ];

  var OW_PACK_COUNT = OW_PACK_SEEDS.length;

  /** Same banding as storyTierFromStage in game.js */
  function storyTierFromStage(stage) {
    var s = Math.max(1, Math.floor(Number(stage)) || 1);
    if (s <= 4) return 1;
    if (s <= 9) return 2;
    if (s <= 14) return 3;
    if (s <= 19) return 4;
    return 5;
  }

  /**
   * Static snapshot: birdKey lists per tier band (1–4), same membership as
   * BIRD_ENEMIES.filter(e => e.tier.includes(band)).
   */
  var OW_POOL_BY_BAND = {
    1: ['sparrow', 'blackbird', 'magpie'],
    2: ['sparrow', 'blackbird', 'magpie', 'crow', 'kookaburra', 'flamingo', 'snowyOwl'],
    3: ['crow', 'kookaburra', 'flamingo', 'snowyOwl', 'toucan', 'goose', 'raven', 'macaw', 'lyrebird', 'penguin'],
    4: ['toucan', 'goose', 'raven', 'macaw', 'lyrebird', 'penguin', 'peregrine', 'swan', 'shoebill', 'emu', 'harpy'],
  };

  /** Display labels aligned with blackstone_overworld_new BIRDS / resolveOwEnemySpriteKey. */
  var OW_BIRD_KEY_TO_LABEL = {
    sparrow: 'Sparrow',
    blackbird: 'Blackbird',
    magpie: 'Magpie',
    crow: 'Crow',
    kookaburra: 'Kookaburra',
    flamingo: 'Flamingo',
    snowyOwl: 'Snowy Owl',
    toucan: 'Toucan',
    goose: 'Goose',
    raven: 'Raven',
    macaw: 'Macaw',
    lyrebird: 'Lyrebird',
    penguin: 'Emperor Penguin',
    peregrine: 'Peregrine',
    swan: 'Swan',
    shoebill: 'Shoebill',
    emu: 'Emu',
    harpy: 'Harpy Eagle',
  };

  /** Sprite / P-object keys used for node portraitBird on the overworld map. */
  function portraitSpriteKeyFromBirdKey(bk) {
    if (bk === 'harpy') return 'harpyEagle';
    return bk;
  }

  function poolKeysForStage(stage) {
    var tier = storyTierFromStage(stage);
    var band = Math.min(Math.max(Math.floor(Number(tier)) || 1, 1), 4);
    var pool = OW_POOL_BY_BAND[band];
    return pool && pool.length ? pool.slice() : OW_POOL_BY_BAND[1].slice();
  }

  function pickTwoDistinct(pool, rng) {
    if (!pool || pool.length === 0) return ['sparrow', 'sparrow'];
    if (pool.length === 1) return [pool[0], pool[0]];
    var a = Math.floor(rng() * pool.length);
    var b = Math.floor(rng() * pool.length);
    var guard = 0;
    while (b === a && guard++ < 64) b = Math.floor(rng() * pool.length);
    if (b === a) b = (a + 1) % pool.length;
    return [pool[a], pool[b]];
  }

  var OW_POPULATION_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  /**
   * @param {number} packIndex 0..OW_PACK_COUNT-1
   * @returns {{ byStage: Record<number, string[]>, portraitByStage: Record<number, string> }}
   */
  function buildOwEnemyPopulation(packIndex) {
    var idx = Math.floor(Number(packIndex)) || 0;
    idx = ((idx % OW_PACK_COUNT) + OW_PACK_COUNT) % OW_PACK_COUNT;
    var seed = OW_PACK_SEEDS[idx] >>> 0;
    var rng = mulberry32(seed);
    var byStage = {};
    var portraitByStage = {};
    for (var i = 0; i < OW_POPULATION_STAGES.length; i++) {
      var st = OW_POPULATION_STAGES[i];
      var pool = poolKeysForStage(st);
      var pair = pickTwoDistinct(pool, rng);
      byStage[st] = pair.map(function (bk) {
        return OW_BIRD_KEY_TO_LABEL[bk] || bk;
      });
      portraitByStage[st] = portraitSpriteKeyFromBirdKey(pair[0]);
    }
    return { byStage: byStage, portraitByStage: portraitByStage };
  }

  function applyOwPopulationToNodes(nodes, population) {
    if (!Array.isArray(nodes) || !population || !population.byStage) return;
    var byStage = population.byStage;
    var portraitByStage = population.portraitByStage || {};
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || n.type !== 'stage') continue;
      var st = Math.floor(Number(n.stage));
      if (!(st >= 1 && st <= 9) && !(st >= 11 && st <= 19)) continue;
      var en = byStage[st];
      if (Array.isArray(en) && en.length) n.enemies = en.slice();
      var pb = portraitByStage[st];
      if (pb) n.portraitBird = pb;
    }
  }

  function isValidOverworldEnemySeedPack(p) {
    return (
      p &&
      p.v === 1 &&
      Number.isInteger(p.packIndex) &&
      p.packIndex >= 0 &&
      p.packIndex < OW_PACK_COUNT
    );
  }

  global.mulberry32 = mulberry32;
  global.OW_PACK_SEEDS = OW_PACK_SEEDS;
  global.OW_PACK_SEED_COUNT = OW_PACK_COUNT;
  global.buildOwEnemyPopulation = buildOwEnemyPopulation;
  global.applyOwPopulationToNodes = applyOwPopulationToNodes;
  global.isValidOverworldEnemySeedPack = isValidOverworldEnemySeedPack;
  global.storyTierFromStageOw = storyTierFromStage;
})(typeof window !== 'undefined' ? window : globalThis);
