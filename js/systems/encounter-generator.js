/**
 * Story-mode random encounter generator (enemy roster).
 * Picks authored roster rows by stage level band; excludes player bird.
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

  function normalizeBirdKey(key) {
    return String(key || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase();
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

  function getEnemyLevelForDifficulty(playerLevel, difficultyId) {
    var plv = Math.max(1, Math.floor(Number(playerLevel)) || 1);
    var diff = String(difficultyId || 'juvenile').toLowerCase();
    var offset = Object.prototype.hasOwnProperty.call(DIFFICULTY_LEVEL_OFFSET, diff)
      ? DIFFICULTY_LEVEL_OFFSET[diff]
      : 0;
    return Math.max(1, plv + offset);
  }

  function getRosterRow(id) {
    if (typeof global.getEnemyRosterRow === 'function') return global.getEnemyRosterRow(id);
    var r = Avian.data && Avian.data.enemyRoster;
    return r && r.byId ? r.byId[id] : null;
  }

  /** Candidate enemy roster ids for overworld preview (same pool as picker). */
  function getStoryStageEnemyCandidateIds(stageNumber, playerBirdKey) {
    var pickFn = global.pickStoryEncounterEnemyIds;
    if (typeof pickFn !== 'function') return [];
    var st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (isBossStage(st)) return pickFn(st, playerBirdKey, 1);
    var bandFn = global.getStoryEnemyLevelBand;
    var band = typeof bandFn === 'function' ? bandFn(st) : { min: 1, max: 2 };
    if (band.boss || band.duke) return pickFn(st, playerBirdKey, 1);
    var roster = Avian.data && Avian.data.enemyRoster;
    if (!roster || !roster.normalByLevel) return [];
    var playerNorm = normalizeBirdKey(playerBirdKey);
    var out = [];
    var min = Math.max(1, band.min || 1);
    var max = Math.max(min, band.max || min);
    for (var lv = min; lv <= max; lv++) {
      var ids = roster.normalByLevel[lv] || [];
      for (var i = 0; i < ids.length; i++) {
        var row = getRosterRow(ids[i]);
        if (!row || row.isBoss) continue;
        if (playerNorm && normalizeBirdKey(row.birdKey) === playerNorm) continue;
        if (out.indexOf(ids[i]) < 0) out.push(ids[i]);
      }
    }
    return out.sort();
  }

  /** Candidate birdKeys derived from roster pool (portrait preview). */
  function getStoryStageEnemyCandidateBirdKeys(stageNumber, playerBirdKey) {
    return getStoryStageEnemyCandidateIds(stageNumber, playerBirdKey).map(function (id) {
      var row = getRosterRow(id);
      return row && row.birdKey ? row.birdKey : id;
    });
  }

  function pickStoryEncounterEnemyIds(stageNumber, playerBirdKey) {
    var st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    var chainCount = getStoryEncounterChainCount(st);
    var rosterNs = Avian.systems.enemyRoster;
    if (rosterNs && typeof rosterNs.pickStoryEncounterEnemyIds === 'function') {
      return rosterNs.pickStoryEncounterEnemyIds(st, playerBirdKey, chainCount);
    }
    return ['EN-SPARR-HESQ-L01'];
  }

  /** Legacy alias: returns birdKeys for callers not yet migrated to roster ids. */
  function pickStoryEncounterBirdKeys(stageNumber, playerBirdKey) {
    return pickStoryEncounterEnemyIds(stageNumber, playerBirdKey).map(function (id) {
      var row = getRosterRow(id);
      if (row && row.birdKey) return row.birdKey;
      if (id === global.STORY_DUKE_ROSTER_ID || String(id).indexOf('DUKEB') >= 0) return 'dukeBlakiston';
      return id;
    });
  }

  function pickRandomMilestoneBossKey() {
    var st = STORY_MILESTONE_BOSS_STAGE;
    var ids = pickStoryEncounterEnemyIds(st, '', 1);
    var row = ids.length ? getRosterRow(ids[0]) : null;
    return row && row.birdKey ? row.birdKey : 'harpy';
  }

  ns.getEnemyLevelForDifficulty = getEnemyLevelForDifficulty;
  ns.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  ns.pickStoryEncounterBirdKeys = pickStoryEncounterBirdKeys;
  ns.getStoryStageEnemyCandidateIds = getStoryStageEnemyCandidateIds;
  ns.getStoryStageEnemyCandidateBirdKeys = getStoryStageEnemyCandidateBirdKeys;
  ns.pickRandomMilestoneBossKey = pickRandomMilestoneBossKey;
  ns.isBossStage = isBossStage;
  ns.STORY_BOSS_STAGES = STORY_BOSS_STAGES;

  global.getEnemyLevelForDifficulty = getEnemyLevelForDifficulty;
  global.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  global.pickStoryEncounterBirdKeys = pickStoryEncounterBirdKeys;
  global.pickEnemyPair = pickStoryEncounterEnemyIds;
  global.pickRandomMilestoneBossKey = pickRandomMilestoneBossKey;
  global.getStoryStageEnemyCandidateBirdKeys = function (stageNumber) {
    var playerBirdKey = (global.G && global.G.player && global.G.player.birdKey) || '';
    return getStoryStageEnemyCandidateBirdKeys(stageNumber, playerBirdKey);
  };
  global.getStoryStageEnemyCandidateIds = function (stageNumber, playerBirdKey) {
    var pbk = playerBirdKey != null ? playerBirdKey : ((global.G && global.G.player && global.G.player.birdKey) || '');
    return getStoryStageEnemyCandidateIds(stageNumber, pbk);
  };
})(typeof window !== 'undefined' ? window : globalThis);
