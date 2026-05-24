/**
 * Story-mode random encounter generator.
 * Picks from all playable birds (minus Duke + milestone boss pool on normal stages).
 */
(function initEncounterGenerator(global) {
  'use strict';

  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.encounterGenerator = Avian.systems.encounterGenerator || {};

  var STORY_DUKE_STAGE = 20;
  var STORY_MILESTONE_BOSS_STAGE = 10;
  var STORY_BOSS_STAGES = new Set([STORY_MILESTONE_BOSS_STAGE, STORY_DUKE_STAGE]);

  var DIFFICULTY_LEVEL_OFFSET = {
    fletchling: -1,
    juvenile: 0,
    predator: 1,
    murder: 2,
  };

  var EXCLUDED_BIRD_KEYS = new Set(['dukeBlakiston', 'duke_blakiston']);

  function normalizeBirdKey(key) {
    return String(key || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase();
  }

  function isExcludedBirdKey(birdKey) {
    var n = normalizeBirdKey(birdKey);
    if (EXCLUDED_BIRD_KEYS.has(birdKey)) return true;
    if (n === 'dukeblakiston' || n === 'duke_blakiston') return true;
    return false;
  }

  function getMilestoneBossKeys() {
    if (typeof global.getStoryMilestoneBossCandidateBirdKeys === 'function') {
      return global.getStoryMilestoneBossCandidateBirdKeys();
    }
    return [];
  }

  function getBirdsCatalog() {
    return global.BIRDS || {};
  }

  function getStoryEncounterChainCount(stageNumber) {
    if (typeof global.getStoryEncounterChainCount === 'function') {
      return Math.max(1, global.getStoryEncounterChainCount(stageNumber));
    }
    var st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    return STORY_BOSS_STAGES.has(st) ? 1 : 3;
  }

  function isBossStage(stageNumber) {
    if (typeof global.isBossStageStory === 'function') {
      return global.isBossStageStory(stageNumber);
    }
    return STORY_BOSS_STAGES.has(Number(stageNumber));
  }

  /**
   * Enemy level from player level + difficulty offset (min 1).
   */
  function getEnemyLevelForDifficulty(playerLevel, difficultyId) {
    var plv = Math.max(1, Math.floor(Number(playerLevel)) || 1);
    var diff = String(difficultyId || 'juvenile').toLowerCase();
    var offset = Object.prototype.hasOwnProperty.call(DIFFICULTY_LEVEL_OFFSET, diff)
      ? DIFFICULTY_LEVEL_OFFSET[diff]
      : 0;
    return Math.max(1, plv + offset);
  }

  /**
   * All birds eligible for random normal-stage encounters.
   */
  function getStoryRandomBirdPool(stageNumber, playerBirdKey) {
    void stageNumber;
    var birds = getBirdsCatalog();
    var milestone = new Set(getMilestoneBossKeys().map(function (k) { return normalizeBirdKey(k); }));
    var playerNorm = normalizeBirdKey(playerBirdKey);
    var out = [];

    Object.keys(birds).forEach(function (key) {
      if (isExcludedBirdKey(key)) return;
      if (milestone.has(normalizeBirdKey(key))) return;
      if (playerNorm && normalizeBirdKey(key) === playerNorm) return;
      out.push(key);
    });

    return out.sort(function (a, b) {
      return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
    });
  }

  function shuffle(arr) {
    var clone = arr.slice();
    for (var i = clone.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = clone[i];
      clone[i] = clone[j];
      clone[j] = t;
    }
    return clone;
  }

  function pickRandomMilestoneBossKey() {
    var pool = getMilestoneBossKeys();
    if (!pool.length) return 'harpy';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Pick ordered birdKeys for a stage combat chain.
   * Boss stage 20 → Duke; stage 10 → [] (boss rolled in loadStage); normal → unique shuffle sample.
   */
  function pickStoryEncounterBirdKeys(stageNumber, playerBirdKey) {
    var st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (st === STORY_DUKE_STAGE) return ['dukeBlakiston'];
    if (isBossStage(st)) return [];

    var chainCount = getStoryEncounterChainCount(st);
    var pool = getStoryRandomBirdPool(st, playerBirdKey);
    if (!pool.length) {
      console.warn('[EncounterGenerator] Empty pool for stage', st);
      return Array.from({ length: chainCount }, function () { return 'sparrow'; });
    }

    var shuffled = shuffle(pool);
    var out = [];
    for (var i = 0; i < chainCount; i++) {
      out.push(shuffled[i % shuffled.length]);
    }
    return out;
  }

  /** Stable candidate list for overworld preview (same pool as picker, sorted). */
  function getStoryStageEnemyCandidateBirdKeys(stageNumber, playerBirdKey) {
    return getStoryRandomBirdPool(stageNumber, playerBirdKey);
  }

  ns.getEnemyLevelForDifficulty = getEnemyLevelForDifficulty;
  ns.getStoryRandomBirdPool = getStoryRandomBirdPool;
  ns.pickStoryEncounterBirdKeys = pickStoryEncounterBirdKeys;
  ns.getStoryStageEnemyCandidateBirdKeys = getStoryStageEnemyCandidateBirdKeys;
  ns.pickRandomMilestoneBossKey = pickRandomMilestoneBossKey;
  ns.isBossStage = isBossStage;
  ns.STORY_BOSS_STAGES = STORY_BOSS_STAGES;

  global.getEnemyLevelForDifficulty = getEnemyLevelForDifficulty;
  global.pickStoryEncounterBirdKeys = pickStoryEncounterBirdKeys;
  global.pickEnemyPair = pickStoryEncounterBirdKeys;
  global.pickRandomMilestoneBossKey = pickRandomMilestoneBossKey;
  global.getStoryStageEnemyCandidateBirdKeys = function (stageNumber) {
    var playerBirdKey = (global.G && global.G.player && global.G.player.birdKey) || '';
    return getStoryStageEnemyCandidateBirdKeys(stageNumber, playerBirdKey);
  };
})(typeof window !== 'undefined' ? window : globalThis);
