/* Avian Ascent — legacy global compatibility shims (Step 7 Phase 9).
 *
 * Central place for deprecated aliases and late-bound global re-exports.
 * New code should use Avian.* namespaces. Loads last in the bundle.
 */
(function () {
  'use strict';

  const global = globalThis;
  const Avian = global.Avian || (global.Avian = {});
  Avian.legacy = Avian.legacy || Object.create(null);

  /** Step 7 extracted modules — re-export if a load-order gap omitted globalThis. */
  const STEP7_LEGACY_FUNCTIONS = [
    /* Phase 1–2 helpers / debug / telemetry */
    'formatCombatNumber', 'roundCombatDamage', 'roundCombatStat', 'rollCombatSpread',
    'applyFractionalHp', 'dodgeBonusFromSpeed', 'normalizeRewardTier', 'resolveFinalClass',
    '_agentDbgLog', 'getTelemetrySummary',
    /* Phase 3 combat UI */
    'openCombatStatsModal', 'closeCombatStatsModal', 'setHpBar', 'setEnergyBar', 'setProtectionBars',
    'renderStatuses', 'renderBattleAilmentSymbols', 'renderEnemyPlan', 'applyEnemyIntentVisibility',
    'refreshBattleUI', 'renderAllCombatUI', 'renderEnergyOrbs', 'renderActions', 'renderCombatItems',
    /* Phase 4 Build Nest */
    'isBuildNestUnlocked', 'syncBuildNestUnlockUI',
    'normalizeForgeSlotTierStar', 'getForgeEncounterSlot', 'shouldBuildForgeTierStarEnemy', 'buildTierStarEnemyFromBirdKey',
    /* Phase 5 rewards / shop */
    'showRewardScreen', 'confirmReward', 'applySingleReward', 'handleNestShake',
    'bindShopItemCompareTooltips', 'isGreyShopStage', 'isShopDueAfterBattle',
    /* Phase 6 story */
    'handleOverworldReturn', 'continueStageTransitionAfterRewards', 'advanceStage',
    /* Phase 7–8 combat */
    'loadStage', 'prepareEnemyCombatLoadout', 'enqueueAction', 'failsafeAdvance', 'isActiveBattleContext',
  ];

  function aliasGlobalFn(name) {
    if (typeof global[name] === 'function') return;
    const src = typeof window !== 'undefined' ? window[name] : undefined;
    if (typeof src === 'function') global[name] = src;
  }

  function exposeLegacyGlobals() {
    const helpers = Avian.helpers;
    if (helpers) {
      if (typeof helpers.formatCombatNumber === 'function' && !global.formatCombatNumber) {
        global.formatCombatNumber = helpers.formatCombatNumber;
      }
      if (typeof helpers.normalizeRewardTier === 'function' && !global.normalizeRewardTier) {
        global.normalizeRewardTier = helpers.normalizeRewardTier;
      }
      if (typeof helpers.roundCombatDamage === 'function' && !global.roundCombatDamage) {
        global.roundCombatDamage = helpers.roundCombatDamage;
      }
      if (typeof helpers.roundCombatStat === 'function' && !global.roundCombatStat) {
        global.roundCombatStat = helpers.roundCombatStat;
      }
      if (typeof helpers.resolveFinalClass === 'function' && !global.resolveFinalClass) {
        global.resolveFinalClass = helpers.resolveFinalClass;
      }
    }
    if (Avian.debug && Avian.debug.telemetry && typeof Avian.debug.telemetry.summary === 'function') {
      if (!global.getTelemetrySummary) global.getTelemetrySummary = Avian.debug.telemetry.summary;
    }
    if (Avian.debug && Avian.debug.agentLog && typeof Avian.debug.agentLog === 'function') {
      if (!global._agentDbgLog) global._agentDbgLog = Avian.debug.agentLog;
    }
    for (const name of STEP7_LEGACY_FUNCTIONS) aliasGlobalFn(name);
  }

  Avian.legacy.STEP7_LEGACY_FUNCTIONS = STEP7_LEGACY_FUNCTIONS;
  Avian.legacy.exposeLegacyGlobals = exposeLegacyGlobals;
  exposeLegacyGlobals();
})();
