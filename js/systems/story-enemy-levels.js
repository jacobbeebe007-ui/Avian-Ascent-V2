/**
 * Story mode enemy level bands (roster Level column), species-tier spawn rules,
 * and equipment (EQ) piece recipes by stage.
 * Level bands: 1–4 → L1–2, 5–9 → L3–5, 10 → boss L6, 11–14 → L6–8, 15–19 → L9–10, 20 → Duke L10.
 * Species tiers: 1–4 grey (Common), 5–9 green (Uncommon), 10–14 blue (Rare), 15–19 purple (Legendary), 20 none.
 * Equipment pieces: 1–3 none; 4–6 ×4 grey; 7–9 ×4 grey/green; 10 ×1 blue + ×5 grey/green;
 * 11–13 ×5 green/blue; 14–16 ×7 blue; 17–19 ×3 purple + ×4 blue;
 * 20 Duke ×4 gold (Legendary) + ×2 orange (weapon + armour) + ×1 purple (Epic).
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

  /**
   * Story enemy equipment recipe for a stage.
   * Returns null for non-story / endless stages (caller falls back to tier bands).
   * @returns {{ count: number, bag?: string[], fixed?: Object.<string, number>, mix?: string[] }|null}
   */
  function getStoryEnemyEquipmentRecipe(stage) {
    var s = Math.max(1, Math.floor(Number(stage)) || 1);
    if (s > 20) return null;
    /* v2.1 Story starter: visibly incomplete worn kit (~75–85%), not empty. */
    if (s <= 3) return { count: 3, bag: ['grey', 'grey', 'grey'], worn: true, completeness: 0.8 };
    if (s <= 6) return { count: 4, bag: ['grey', 'grey', 'grey', 'grey'], worn: true, completeness: 0.85 };
    if (s <= 9) return { count: 4, mix: ['grey', 'green'] };
    if (s === 10) return { count: 6, fixed: { blue: 1 }, mix: ['grey', 'green'] };
    if (s <= 13) return { count: 5, mix: ['green', 'blue'] };
    if (s <= 16) return { count: 7, bag: ['blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue'] };
    if (s <= 19) {
      return {
        count: 7,
        bag: ['purple', 'purple', 'purple', 'blue', 'blue', 'blue', 'blue'],
      };
    }
    /* Duke: 4 gold + 2 orange (weapon + armour skills) + 1 purple. */
    return {
      count: 7,
      bag: ['gold', 'gold', 'gold', 'gold', 'orange', 'orange', 'purple'],
    };
  }

  function getStoryDukeRosterId() {
    return STORY_DUKE_ROSTER_ID;
  }

  global.getStoryEnemyLevelBand = getStoryEnemyLevelBand;
  global.getStorySpeciesTierForStage = getStorySpeciesTierForStage;
  global.getStoryEnemyEquipmentRecipe = getStoryEnemyEquipmentRecipe;
  global.getStoryDukeRosterId = getStoryDukeRosterId;
  global.STORY_DUKE_ROSTER_ID = STORY_DUKE_ROSTER_ID;
})(typeof window !== 'undefined' ? window : globalThis);
