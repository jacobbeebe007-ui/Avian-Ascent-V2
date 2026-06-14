/**
 * Story mode enemy level bands (roster Level column) and species-tier spawn rules.
 * Level bands: 1–4 → L1–2, 5–9 → L3–5, 10 → boss L6, 11–14 → L6–8, 15–19 → L9–10, 20 → Duke L10.
 * Species tiers: 1–4 grey (Common), 5–9 green (Uncommon), 10–14 blue (Rare), 15–19 purple (Legendary), 20 none.
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

  /** Mother Goose species tier allowed for story random spawns; null = no filter (Duke). */
  function getStorySpeciesTierForStage(stage) {
    var s = Math.max(1, Math.floor(Number(stage)) || 1);
    if (s === 20) return null;
    if (s <= 4) return 'grey';
    if (s <= 9) return 'green';
    if (s <= 14) return 'blue';
    if (s <= 19) return 'purple';
    return null;
  }

  function getStoryDukeRosterId() {
    return STORY_DUKE_ROSTER_ID;
  }

  global.getStoryEnemyLevelBand = getStoryEnemyLevelBand;
  global.getStorySpeciesTierForStage = getStorySpeciesTierForStage;
  global.getStoryDukeRosterId = getStoryDukeRosterId;
  global.STORY_DUKE_ROSTER_ID = STORY_DUKE_ROSTER_ID;
})(typeof window !== 'undefined' ? window : globalThis);
