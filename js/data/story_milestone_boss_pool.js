/**
 * Tier-band 4 templates used by pickBirdEnemyPoolForTier(4) in js/core/game.js for the
 * stage-10 milestone boss (pickRandomBirdEnemyDraft). Must stay synced when BIRD_ENEMIES
 * tier arrays change — same rows where tier includes 4.
 */
(function (global) {
  'use strict';

  var STORY_MILESTONE_BOSS_POOL_KEYS = [
    'toucan',
    'goose',
    'raven',
    'macaw',
    'lyrebird',
    'penguin',
    'peregrine',
    'swan',
    'shoebill',
    'emu',
    'harpy',
  ];

  global.getStoryMilestoneBossCandidateBirdKeys = function () {
    return STORY_MILESTONE_BOSS_POOL_KEYS.slice();
  };
})(typeof window !== 'undefined' ? window : globalThis);
