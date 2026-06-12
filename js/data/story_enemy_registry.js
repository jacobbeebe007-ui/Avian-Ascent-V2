/**
 * Story-mode encounter metadata (boss stages, chain length, level bands).
 * Random bird picking lives in js/systems/encounter-generator.js.
 */
(function initStoryEnemyRegistry(global) {
  'use strict';

  const STORY_BOSS_STAGES = new Set([10, 20]);

  function isBossStage(stageNumber) {
    return STORY_BOSS_STAGES.has(Number(stageNumber));
  }

  /** Battles per non-boss story stage (boss stages use chain length 1). Keep in sync with blackstone getNodeBattleCount. */
  function getStoryEncounterChainCount(stageNumber) {
    const st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (STORY_BOSS_STAGES.has(st)) return 1;
    return 3;
  }

  function getEnemyLevelBandForStage(stageNumber) {
    if (typeof global.getStoryEnemyLevelBand === 'function') {
      return global.getStoryEnemyLevelBand(stageNumber);
    }
    const s = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (s <= 4) return { min: 1, max: 2 };
    if (s <= 9) return { min: 3, max: 5 };
    if (s === 10) return { boss: true, level: 6 };
    if (s <= 14) return { min: 6, max: 8 };
    if (s <= 19) return { min: 9, max: 10 };
    if (s === 20) return { duke: true, level: 10 };
    return { min: 9, max: 10 };
  }

  function getEvolvedSlotCountForLevel(level) {
    const lv = Math.floor(Number(level)) || 0;
    if (lv <= 2) return 0;
    if (lv <= 5) return 1;
    if (lv <= 8) return 2;
    return 3;
  }

  function normalizeBirdKey(key) {
    return String(key || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase();
  }

  function generateStoryEncounter(stageNumber, playerBirdKey, _playerLevel) {
    const st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (isBossStage(st)) {
      const dukeId = typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : global.STORY_DUKE_ROSTER_ID;
      return {
        stageNumber: st,
        isBoss: true,
        birdKeys: st === 20 ? ['dukeBlakiston'] : [],
        enemyIds: st === 20 ? [dukeId || 'BO-DUKEB-STORY-L10'] : [],
        enemies: [],
      };
    }
    const pickFn = global.pickStoryEncounterEnemyIds || global.pickStoryEncounterBirdKeys;
    const enemyIds = typeof pickFn === 'function'
      ? pickFn(st, playerBirdKey)
      : [];
    return {
      stageNumber: st,
      isBoss: false,
      birdKeys: enemyIds.map((id) => {
        const row = global.getEnemyRosterRow && global.getEnemyRosterRow(id);
        return row && row.birdKey ? row.birdKey : id;
      }),
      enemyIds,
      enemies: [],
    };
  }

  global.STORY_BOSS_STAGES_REGISTRY = STORY_BOSS_STAGES;
  global.isBossStageStory = isBossStage;
  global.getEnemyLevelBandForStage = getEnemyLevelBandForStage;
  global.getEvolvedSlotCountForLevel = getEvolvedSlotCountForLevel;
  global.normalizeBirdKey = normalizeBirdKey;
  global.getStoryEncounterChainCount = getStoryEncounterChainCount;
  global.generateStoryEncounter = generateStoryEncounter;
})(typeof window !== 'undefined' ? window : globalThis);
