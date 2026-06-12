/**
 * Story mode enemy level bands (roster Level column).
 * Stages 1–4 → L1–2, 5–9 → L3–5, 10 → boss L6, 11–14 → L6–8, 15–19 → L9–10, 20 → Duke L10.
 */
(function initStoryEnemyLevels(global) {
  'use strict';

  var STORY_DUKE_ROSTER_ID = 'BO-DUKEB-STORY-L10';

  function getStoryEnemyLevelBand(stage) {
    var s = Math.max(1, Math.floor(Number(stage)) || 1);
    if (s <= 4) return { min: 1, max: 2 };
    if (s <= 9) return { min: 3, max: 5 };
    if (s === 10) return { boss: true, level: 6 };
    if (s <= 14) return { min: 6, max: 8 };
    if (s <= 19) return { min: 9, max: 10 };
    if (s === 20) return { duke: true, level: 10 };
    return { min: 9, max: 10 };
  }

  function getStoryDukeRosterId() {
    return STORY_DUKE_ROSTER_ID;
  }

  global.getStoryEnemyLevelBand = getStoryEnemyLevelBand;
  global.getStoryDukeRosterId = getStoryDukeRosterId;
  global.STORY_DUKE_ROSTER_ID = STORY_DUKE_ROSTER_ID;
})(typeof window !== 'undefined' ? window : globalThis);
