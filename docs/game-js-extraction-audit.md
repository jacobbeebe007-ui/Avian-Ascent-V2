# game.js Extraction Audit (Step 7)

Generated: 2026-08-31  
Source: `js/core/game.js`  
**Before Step 7:** 21734 lines  
**Functions:** 969 top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
| Bootstrap/Orchestration | 237 | 🔁 Retain in game.js |
| Enemy setup/AI | 113 | ⬜ Phase 7 |
| Combat | 108 | ⬜ Phase 8 |
| Story/Overworld | 87 | ⬜ Phase 6 |
| Combat UI | 77 | ⬜ Phase 3 |
| Rewards | 56 | ⬜ Phase 5 |
| Audio | 56 | ⬜ Not started |
| Shop | 52 | ⬜ Phase 5B |
| Bird selection | 46 | ⬜ Not started |
| Nest | 31 | ⬜ Not started |
| Utilities | 26 | ✅ Phase 1 (game-helpers.js) |
| Equipment | 24 | ⬜ Not started |
| Save/load | 22 | ⬜ Not started |
| Class/Passive | 19 | ⬜ Not started |
| Endless/Meta | 9 | ⬜ Not started |
| Build Nest | 6 | ⬜ Phase 4 (partially in map-forge.js) |

## Extraction rules (summary)

1. Extract by system boundary, not line count.
2. Preserve `window` / `Avian.actions` / `data-action` compatibility.
3. Update `js/bootstrap/load-order.json` for every new module.
4. Run `npm test` after each phase.

## Function inventory

| Name | Line | Category | Global | Risk | Suggested destination |
|------|-----:|----------|--------|------|----------------------|
| `runPassiveIntegrityAudit` | 98 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `inferAIPersonalityFromStyle` | 125 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `inferEnemyClassFromStyle` | 142 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `makeEnemy` | 152 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDukeAbilityEnCost` | 187 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildDukeStoryBossEnemy` | 190 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeDukeBlakiston` | 215 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBiomeForStage` | 285 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyBiomeModifiers` | 292 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollRarity` | 305 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatStat` | 313 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatMaxHp` | 317 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgGoldenFeather` | 323 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countUpgradeAcquisitionsThisRun` | 339 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isUpgradeBlockedByRunAcquisitionCap` | 342 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `upgradeEligibleForRewardPick` | 351 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getUpgradePool` | 359 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ledgerStatLabel` | 363 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `cloneStatLedgerSlice` | 418 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `ensureStatLedger` | 427 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `reapplyPlayerGearStats` | 448 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `initStatLedgerForNewRun` | 454 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `syncBirdBaselineFromCatalog` | 468 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStatLedgerAfterLoad` | 493 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `mergeStatDeltaIntoBucket` | 516 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `recordUpgradeApplyInLedger` | 532 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildStatBreakdownTitle` | 548 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `equipmentPctLedgerKey` | 562 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquippedStatSources` | 566 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatModifierLines` | 580 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `richTooltipCloseBtn` | 596 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdPassiveInfo` | 600 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdAuthoredClassPerk` | 610 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildPassiveTooltipHTML` | 631 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getMutationDescHtml` | 641 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildMutationTooltipHTML` | 642 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEquipmentItem` | 643 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquipmentSkill` | 646 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `itemHasDisplayableWeaponDamage` | 650 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `formatEquipmentStatsHtml` | 659 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatAnyStatLabel` | 687 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `formatEquipmentSkillsHtml` | 711 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEquipmentTooltipHTML` | 725 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildRichStatTooltipHtml` | 762 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyMutationStatSources` | 812 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEntityAspectTooltipHtml` | 836 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getPlayerEquippedMutationIds` | 859 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildPlayerBirdTooltipHtml` | 861 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildClassLabelTooltipHtml` | 878 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyMutationsTooltipHtml` | 893 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyRichStatTooltipHtml` | 921 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `tooltipsEnabled` | 944 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showRichTooltipHtml` | 948 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltipNearEl` | 957 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindHoldRepeat` | 976 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindRichTooltip` | 1011 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireNestMutationTooltips` | 1051 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestEquipmentTooltips` | 1059 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestAbilityTooltips` | 1068 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireCombatStatTooltips` | 1087 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatClassLabelTooltips` | 1099 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatEnemyStatTooltips` | 1117 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyMutationTooltips` | 1128 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wirePlayerAvatarInteractionOnce` | 1133 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getDerivedMechanicalBonusLines` | 1148 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isEndlessRunActive` | 1244 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getPassiveEvolutionDefinition` | 1257 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `ensurePassiveEvolutionState` | 1274 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveEvolutionBonuses` | 1284 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveDefMdefBonuses` | 1296 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `rollEndlessReward` | 1306 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyEndlessProgressionMilestones` | 1313 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `rollUpgradeCard` | 1317 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ensureClassPerkState` | 1331 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `normalizeClassPerkIdList` | 1338 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getBirdClassRoleByKey` | 1342 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdClassPerks` | 1346 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `hasClassPerk` | 1352 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkGrantCountForMode` | 1356 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkCapForMode` | 1366 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getAvailableClassPerksForBird` | 1370 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyClassPerksToStats` | 1377 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyClassPerksToCombatContext` | 1390 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `recomputeClassPerkEffects` | 1418 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkBuffDurationBonus` | 1424 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkSongHealFlat` | 1429 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `grantClassPerk` | 1434 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `makeAbilityLevelData` | 1473 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `makeEvolutionAbilityTemplate` | 1482 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enforceAbilityBalanceSpec` | 1600 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeAbilityEnergy` | 1640 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAllAbilityEnergy` | 1655 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAbilityTemplates` | 1739 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `removeMimicEverywhere` | 1783 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getUnlocks` | 1817 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `grantUnlock` | 1820 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isUnlocked` | 1823 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getPlayableStarterBirdKeys` | 1824 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `collectAllBirdUnlockIds` | 1833 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `isBirdUnlockedForSelect` | 1841 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getActiveOwNodesForProgress` | 1848 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryMaxStage` | 1853 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `queueUnlockBanner` | 1890 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `handleBossClearUnlocks` | 1895 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderUnlockPopupsOnGameover` | 1918 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkSecretUnlockChar` | 1941 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `expForLevel` | 1971 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `threatTierExpMultiplierForEnemy` | 1992 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `baseExpForEnemyLevel` | 1996 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `relativeLevelExpMultiplier` | 2005 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `stageExpMultiplier` | 2018 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeNormalEnemyExpGain` | 2027 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeBossExpGain` | 2043 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getGrowthStageForLevel` | 2081 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeBirdSizeForEnergy` | 2110 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getEnergyProfile` | 2121 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getEnemyEnergyProfile` | 2125 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computePlayerEffectiveMaxEnergy` | 2131 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerMaxEnergy` | 2141 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerStartEnergy` | 2145 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegen` | 2151 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegenThisTurn` | 2156 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerGameModule` | 2199 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `runModuleHook` | 2203 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `initDataPacks` | 2214 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `ensureUIState` | 2322 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerHit` | 2351 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerMiss` | 2352 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `triggerPassive` | 2357 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `renderPassiveBadge` | 2362 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatAbilityLevelPathway` | 2379 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `isStoryBattleNestEquipLocked` | 2389 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `notifyStoryBattleNestEquipLocked` | 2393 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `getEquipmentNestSlotLabel` | 2404 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `equipmentHandBadgeHtml` | 2408 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentStatChipLabel` | 2416 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentCompactStatsHtml` | 2432 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `needsUltimateSourcePick` | 2461 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setPlayerUltimateSourceItemId` | 2467 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildNestUltimateBankHtml` | 2482 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `buildNestUltimatePickerHtml` | 2512 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `equipmentSlotIconForItem` | 2516 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `grantPlayerEquipmentItem` | 2525 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_nestInvCompareHtml` | 2544 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_shopCompareDeltaClass` | 2562 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareFmt` | 2566 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareStatRow` | 2571 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareRows` | 2580 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareCandidateSlots` | 2605 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareResolve` | 2617 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopCompareTooltipHtml` | 2634 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopSuppressHoldClick` | 2667 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `bindShopItemCompareTooltips` | 2682 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_nestEquipmentItemHtml` | 2704 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSectionV2` | 2726 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `handleNestEquipmentClick` | 2806 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `selectNestTab` | 2848 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `organizeNestSections` | 2867 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestAbilitySection` | 2895 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `resetNestChrome` | 2943 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildEnemyNestEquipmentSection` | 2950 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyNestAbilitySection` | 2997 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyNestProfileHtml` | 3066 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyNestAbilityTooltips` | 3119 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `fillEnemyNestHeader` | 3128 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openEnemyNest` | 3152 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openNest` | 3173 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `notifyOwUiEmbedClose` | 3348 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `closeNest` | 3355 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `getNestSlotIcons` | 3368 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `readNestMutCompareMode` | 3371 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `setNestMutCompareMode` | 3380 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestInventoryMutStatsHtml` | 3384 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestMutationItemHtml` | 3386 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `handleNestEquipClick` | 3388 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSection` | 3415 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `bootstrapOwNestEmbed` | 3426 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `bootstrapOwSettingsEmbed` | 3449 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwReferenceEmbed` | 3461 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwUiEmbed` | 3473 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `codexMark` | 3482 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCardTierSlotCount` | 3502 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyPlayerSkillsFromCardTier` | 3514 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isSkillSlotUnlocked` | 3525 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `clampLockedSkillSlots` | 3532 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildFamilySkillAbilityLookup` | 3541 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getFamilyEvolutionBirdDataStore` | 3558 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getBirdFamilyEvolutionData` | 3564 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdSkillFamilyCatalog` | 3567 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `usesFamilySkillEvolution` | 3570 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `createSkillSlotState` | 3573 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBaseSkillSlotsForBird` | 3580 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getFamilyEvolutionAbilityStateFromId` | 3592 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getSkillSlotFamilyDef` | 3604 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillSlotDisplayLabel` | 3612 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeSkillSlotState` | 3618 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getSkillSlots` | 3629 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getSkillSlotByIndex` | 3632 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilitySkillSlot` | 3635 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureAbilityObjectFromTemplate` | 3641 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncPlayerAbilitiesFromSkillSlots` | 3663 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `consumePendingEquipmentV2MigrationCompensation` | 3709 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `stashEquipmentV2MigrationNotice` | 3729 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `applyEquipmentLoadoutSanitizationOnLoad` | 3736 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `finalizeEquipmentV2PreReleaseReset` | 3753 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `ensureFamilyEvolutionState` | 3764 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `_isValidOverworldEnemySeedPack` | 3786 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `saveRun` | 3789 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `loadSaveData` | 3867 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `deleteSave` | 3887 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearDevCodeAccess` | 3892 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `reloadShellHttpCache` | 3910 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `cacheBustReload` | 3929 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearGameCache` | 3939 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearAllProgress` | 3971 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openEraseProgressModal` | 4007 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeEraseProgressModal` | 4010 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `openClearCacheModal` | 4013 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeClearCacheModal` | 4016 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmClearCache` | 4019 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmEraseProgress` | 4034 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `continueRun` | 4047 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `goMainMenu` | 4244 | Enemy setup/AI | Yes (data-action in index.html) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isOwUiEmbedMode` | 4254 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOwTransientKeys` | 4258 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `navigateTopToMainMenu` | 4267 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `flyAgain` | 4291 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEncounterStage` | 4325 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStageEncounterChainLength` | 4331 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `hasMultiEnemyChainPending` | 4338 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetStageBattleStats` | 4346 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `accumulateStageBattleStats` | 4351 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `continueToNextEncounterBird` | 4374 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeOverworldProgress` | 4387 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `ensureOverworldProgress` | 4407 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setOverworldCurrentNode` | 4412 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `finalizeOverworldStageClear` | 4419 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOverworldPendingBattle` | 4441 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `ensureOwEncounterDrafts` | 4459 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDukeEncounterToken` | 4478 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rerollNonDukeStageEnemy` | 4484 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildOwEnemyDraftFromBirdKey` | 4492 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionProfileId` | 4538 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `shiftEnemyProgressionTier` | 4549 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveStoryLevelFromStage` | 4557 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionTier` | 4575 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveEnemyWorkbookLevel` | 4610 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTotalStars` | 4638 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyStatsFromPlayerProgression` | 4652 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `mergeScaledStatsIntoEnemy` | 4833 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterMaterialized` | 4965 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyKitAbilityIds` | 4982 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEquipmentActionSources` | 4994 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `isEnemyUltimateMeterReady` | 4999 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEnemyEquipmentActionAvailable` | 5008 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEnemyAbilityDisplayLabel` | 5015 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillNames` | 5025 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillKeys` | 5055 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevel` | 5070 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevelLine` | 5078 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyInfoPopupAbilitiesHtml` | 5083 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeEnemyInfoPopup` | 5138 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openEnemyInfoPopup` | 5146 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatEquipmentEffectSummaryHtml` | 5151 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyInfoPopupMutationsHtml` | 5167 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyInfoEquipmentTooltips` | 5202 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `wireEnemyInfoPopupOnce` | 5212 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCurrentStageEncounterPreviewData` | 5227 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyAbilityTooltipHtml` | 5243 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEncounterPreviewTooltipHtml` | 5293 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `ensureEnemyPreviewEquipmentState` | 5334 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `buildEncounterPreviewEquipmentHtml` | 5385 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_initEncounterPreviewCollapse` | 5411 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderEncounterPreview` | 5431 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `terrainStringToArenaId` | 5491 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveBattleArenaId` | 5515 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `battleArenaImagePaths` | 5522 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `updateBattleArena` | 5532 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncBattleLogDrawerCollapse` | 5566 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `initBattleLogDrawer` | 5579 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `_isOverworldRun` | 5594 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeOwEnemyListForBattle` | 5600 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEnemyLevelBand` | 5635 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEvolvedSlotCount` | 5647 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getOwEnemySkillDepthFromTierBand` | 5652 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `materializeEnemyFamilySkillSlots` | 5661 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollInt` | 5675 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `pickRandom` | 5676 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `weightedPick` | 5677 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classGrowthWeightsForStory` | 5684 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `buildStoryEnemyFromBirdKey` | 5693 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateStoryStageEnemyKeys` | 5820 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `commitStoryEncounterMeta` | 5850 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyEnemyFeatherFromPlayerMirror` | 5869 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyStoryEnemyGrowth` | 5907 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncStoryEncounterBirdQueue` | 5942 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `handleOverworldReturn` | 5997 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showNextStagePreview` | 6184 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `initSelection` | 6217 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `buildRosterFilterSelect` | 6250 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `syncRosterFilterSelect` | 6267 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `onRosterFilterChange` | 6280 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildSelectionViewButtons` | 6294 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildLockFilterButtons` | 6295 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setRosterMode` | 6297 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setLockFilter` | 6306 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGameModeToggle` | 6314 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setGameMode` | 6332 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classToRoleId` | 6340 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `migrateLegacySelectionView` | 6343 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `idToClassLabel` | 6353 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireRefGuideClicks` | 6357 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderStarterFallbackGrid` | 6371 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `initSelectionSafe` | 6400 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `formatDifficultyMult` | 6454 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `buildDifficultyPicker` | 6460 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectDifficulty` | 6505 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `setSelView` | 6511 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildBirdGrid` | 6520 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderBirdCardStarsHtml` | 6684 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdSpeciesRarityMeta` | 6693 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildBirdCard` | 6703 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `setCharacterSelectView` | 6754 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `backToCharacterSelectBirds` | 6780 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `selectBird` | 6797 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `mutateBirdCardSelect` | 6811 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `__normSpriteKey` | 6838 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `__hasSpriteKey` | 6839 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rosterCanonBirdKey` | 6845 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `runtimeSizeFromProfileToken` | 6861 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `profileSizeTokenForEntity` | 6886 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `rosterSizeForEntity` | 6897 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getUISizeClass` | 6901 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `normalizeSpriteBirdKey` | 6912 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `neutralBirdFallbackHTML` | 6923 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wrapSpriteFaceLeft` | 6926 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `wrapEnemySpriteIfNeeded` | 6929 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureBattleEnemyFacing` | 6935 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderBirdIconHTML` | 6943 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderEntityAvatarHTML` | 6958 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getFlightSettingsSummary` | 6963 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncFlightSettingsBriefing` | 6981 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSfselRunSummary` | 6996 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSelectTakeFlightButton` | 7006 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `escapeHtmlRoster` | 7019 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `rosterAbilityBlurb` | 7026 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityBlurbForTemplate` | 7038 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRosterPreviewStubForBirdKey` | 7049 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `rosterPreviewSlotTag` | 7067 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKit` | 7075 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKitForCardProgress` | 7101 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `birdUpgradeTierMeta` | 7124 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStarsHtml` | 7132 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildBirdUpgradePreviewModel` | 7137 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeReasonText` | 7216 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `formatBirdUpgradeStatValue` | 7224 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStatRowsHtml` | 7230 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilityLabel` | 7239 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilitiesHtml` | 7245 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `renderBirdUpgradePreviewModal` | 7263 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openBirdUpgradePreview` | 7315 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `closeBirdUpgradePreview` | 7323 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmBirdUpgradePreview` | 7334 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openRosterChampionModal` | 7384 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRosterChampionModal` | 7385 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `_setSfselEmptyState` | 7389 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAscentPanel` | 7395 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startSelectedBird` | 7575 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `beginRun` | 7580 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCombatItemMaxHold` | 7588 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerIsKnightClass` | 7596 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `createDefaultCombatItems` | 7601 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureCombatItems` | 7605 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatItemCount` | 7615 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canAddCombatItem` | 7620 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `addCombatItem` | 7626 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatItemShopOffer` | 7637 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `launchStoryOverworld` | 7660 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startGame` | 7704 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `makeEndlessEnemy` | 7825 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEndlessMapActive` | 7851 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `showEndlessMap` | 7856 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `endlessMapSelectNode` | 7891 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `grantEndlessMapTreasure` | 7957 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `finishEndlessMapAfterCombat` | 7977 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `returnToEndlessMapFromSideRoom` | 8015 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `captureBattleTempPlayerStats` | 8032 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `restoreBattleTempPlayerStats` | 8054 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `prepareEnemyCombatLoadout` | 8067 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `preparePlayerCombatLoadout` | 8106 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `normalizeBattleTurnState` | 8128 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetForNewBattle` | 8152 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeEnemyNameKey` | 8244 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `storyTierFromStage` | 8249 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildEdFromBirdEnemyTemplate` | 8259 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraftForStage` | 8272 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraft` | 8279 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `bossTitleForStageMilestone` | 8287 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `scheduleOpeningEnemyTurn` | 8295 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `loadStage` | 8321 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setSuppliesSubView` | 8506 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncMissionMapVariantTabs` | 8542 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapPickerVisibility` | 8563 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapLabel` | 8568 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshMissionTestMapSelect` | 8592 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openSelectHubPanel` | 8658 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRunSettings` | 8714 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmRunSettings` | 8717 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `closeSelectHubPanel` | 8722 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `takeFlightToSelect` | 8742 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `scrollToSelectRoster` | 8751 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `showScreen` | 8756 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `lockActionUI` | 8805 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `canPlayerAct` | 8811 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncCombatTurnFlags` | 8815 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enqueueAction` | 8825 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `runActionQueue` | 8831 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isActiveBattleContext` | 8872 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `failsafeAdvance` | 8878 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `installLegacyErrorHUD` | 8927 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `installErrorHUD` | 9078 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDisplayTags` | 9107 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityTypeChipLabel` | 9111 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isPlayerAbilityUsable` | 9117 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerHasAffordableAbility` | 9128 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseCombatItem` | 9137 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `useCombatItem` | 9146 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityTemplateForUI` | 9178 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectiveAbilityBtnType` | 9243 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `estimateMultiplierFromSkillDescription` | 9257 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerAtkForDamagePreview` | 9284 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectivePlayerOffensiveAtkForPreview` | 9293 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerOffensiveMatkForPreview` | 9296 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPackRowScaleStatRaw` | 9300 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `packRowScaleContribution` | 9313 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `registerStrikePreviewForBird` | 9322 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getStrikePreviewMultiplierForAbility` | 9337 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getHybridPreviewSpec` | 9348 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateHybridSplitBands` | 9376 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateSkillDamageRange` | 9440 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `snowyOwlEyeStatPreviewLines` | 9653 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `snowyOwlGlideStatPreviewLines` | 9668 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `_previewPickArrayFromSource` | 9849 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGenericUtilityStatPreviewFromAction` | 9860 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillStatPreviewLines` | 9922 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildActionTooltipHTML` | 9939 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showActionTooltip` | 10023 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltip` | 10033 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `moveTooltip` | 10046 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showTooltip` | 10082 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideTooltip` | 10093 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbDesc` | 10101 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityCooldown` | 10113 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getClassCooldownAdjustment` | 10117 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDirectHealingAbility` | 10139 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getTemplateCooldown` | 10155 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setAbilityCooldown` | 10170 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `reduceOtherSpellCooldownsOnCast` | 10175 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeAbilityCooldownsForPlayer` | 10196 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getPlayerPiercePctForAbility` | 10207 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerClassRole` | 10218 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getClassPerkTriggerForCurrentStage` | 10222 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `resumeAfterGrove` | 10236 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `continueStageTransitionAfterRewards` | 10246 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openClassPerkChoice` | 10341 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `maybeOfferClassPerkChoice` | 10377 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyPassiveEvolutionChoice` | 10386 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `maybeOfferPassiveEvolutionChoice` | 10404 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyOpeningStrikePassiveOnTurnStart` | 10443 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCrowDefendCooldown` | 10449 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `logAspectMatchupFeedback` | 10455 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getAspectDefinition` | 10465 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `formatAspectDisplayName` | 10472 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildAspectTooltipHTML` | 10480 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resolveAbilityAspectForDisplay` | 10495 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildAspectChartSvg` | 10504 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `logMsg` | 10551 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playAvatarAnim` | 10564 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spawnFloat` | 10580 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `flashPanel` | 10620 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doAttack` | 10629 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doMiss` | 10682 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doShield` | 10691 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doSpell` | 10698 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doHeal` | 10699 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `delay` | 10710 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `roll` | 10718 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerBaseAcc` | 10731 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeaponPrecisionModifier` | 10744 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillPrecisionModifier` | 10762 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getFinalAttackPrecision` | 10780 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccMod` | 10824 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerEffectiveAcc` | 10833 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveActionPrecisionPct` | 10840 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `clamp01` | 10850 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getPostBattleHealPct` | 10857 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `shouldApplyPostBattleHealNow` | 10861 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPostBattleHealIfDue` | 10868 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `softenMainStatForCombat` | 10890 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `effectiveDodgePercentForCombat` | 10898 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `damageMitigationMultiplierFromGuard` | 10905 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `physicalGuardValueFromEnemyDef` | 10909 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `magicalGuardValueFromEnemyMdef` | 10916 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `physicalGuardValueFromPlayerDef` | 10923 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `magicalGuardValueFromPlayerMdef` | 10929 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerArmorPenPct` | 10935 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPlayerMagicPenPct` | 10941 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPhysicalPierceFractionForDamage` | 10951 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getMagicalPierceFractionForDamage` | 10961 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPhysicalPierceFractionForPreview` | 10974 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getMagicalPierceFractionForPreview` | 10986 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcHitChance` | 10995 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcDefenseMultiplier` | 11004 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGrowthStageTransition` | 11009 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkGrowthStage` | 11045 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyBaseStats` | 11076 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTier` | 11099 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getEndlessEffectiveBattleNumber` | 11127 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEndlessDifficultyLevelOffset` | 11132 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getEndlessNormalFightTier` | 11157 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollRandomAnyMutationTiers` | 11165 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getStoryMutationRewardTiers` | 11174 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveMutationRewardTiers` | 11198 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeMutationDataTier` | 11221 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `pickUniqueMutationReward` | 11226 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildMutationRewardPool` | 11244 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `computeEnemyEffectiveLevel` | 11252 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStoryEnemyPowerMultiplier` | 11266 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `combatResolveEnemyTier` | 11275 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildScaledEnemy` | 11288 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildScaledBoss` | 11370 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyScaleFactor` | 11375 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEffectiveDodge` | 11389 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `chance` | 11410 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `addStatus` | 11413 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setStatusMax` | 11414 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshStatus` | 11416 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGuardedPhysReducPct` | 11418 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGuardedBuff` | 11426 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getTierBuffPct` | 11450 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveShieldAmountFromOpts` | 11456 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyShieldHp` | 11468 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applyDamageThroughShield` | 11491 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `notifyProtectionHitHooks` | 11544 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickShieldHpStatus` | 11563 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickGuardedStatus` | 11588 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playerIsGuarding` | 11594 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveGuardedReductionPct` | 11600 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshDerivedStatsAfterLoan` | 11613 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applySourceStatLoan` | 11623 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `decaySourceStatLoans` | 11640 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applySourceStatLoanPct` | 11657 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `clamp` | 11668 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `clampSkipChance` | 11669 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getWeakenStacks` | 11674 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeakenDamageMult` | 11681 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getWeakenDodgePenalty` | 11686 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyWeakenStack` | 11690 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectiveEnemyDodgeForPlayerHit` | 11700 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `scaleHealForBleed` | 11709 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeBurningTurns` | 11722 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `enemyHasBurning` | 11728 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHasBurning` | 11735 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToTarget` | 11742 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToEnemy` | 11767 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalStackAilment` | 11771 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalResolvedState` | 11803 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollStunChance` | 11839 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyEnemySlow` | 11840 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPendingStrikeBuff` | 11863 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerTimedBuff` | 11879 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `promotePendingStrikeBuffToActive` | 11892 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerSlow` | 11905 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshEnemyStrikerDodgeMark` | 11919 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAbilityLifestealPct` | 11931 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolveAbilityCombatRow` | 11949 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `detectEquipmentDamageBonus` | 11960 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `computeMasterOutgoingDamage` | 11968 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `computeOutgoingDamageBase` | 12064 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `collectDispatcherConditionalBonusFractions` | 12113 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `collectOutgoingDamageBonusFractions` | 12143 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLifestealFromDamage` | 12259 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyAbilityAuthoredEnCost` | 12270 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeEntityAbilityRawDamage` | 12276 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCurvedMitigationToPlayer` | 12336 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerCritDamageAdd` | 12362 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `dealDamage` | 12404 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmg` | 12802 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countEnemyCombatDebuffCategories` | 12830 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `countAilmentCategoriesOnEnemy` | 12849 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHasAfflictionForCardBonuses` | 12869 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `selfDodgeBuffActive` | 12872 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeSecondaryStatFlatForPhysical` | 12876 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyConditionalPhysicalDamageMultipliers` | 12889 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmgWithAlternateScaling` | 12908 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDamageScalingHintForUI` | 12919 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `calcEnemyAbilityDamage` | 12925 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyBossBurstBuffer` | 12934 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `edmg` | 12945 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollEnemyCritDamage` | 12961 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerMissChance` | 12975 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitPercentForAttack` | 13018 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccuracy` | 13036 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolvePlayerAttackHit` | 13046 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAttackMisses` | 13064 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doPlayerAttackMiss` | 13067 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerDmgMult` | 13077 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAilChance` | 13083 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `tryApplyAilment` | 13106 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDelayedDmgBoostPct` | 13124 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDelayedDamage` | 13131 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `tryMutationOnHitAilments` | 13159 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `notifyAilmentApplied` | 13178 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyAilment` | 13192 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerCritChance` | 13451 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitBonus` | 13484 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickDelayedForTarget` | 13496 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickStatuses` | 13513 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveAbilityAliasSourceId` | 13559 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerAbilityAlias` | 13565 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerStrikePreviewForBird` | 13566 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStarterKitEnergySmoothing` | 13569 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `checkBlackbirdOmenChorusAfterAbility` | 13572 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAction` | 13585 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startPlayerTurn` | 13838 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyEnergyForBattleDisplay` | 13934 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `startEnemyTurn` | 13941 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isSpellAbilityId` | 13959 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isMultiHitAbility` | 13964 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAuthoredEnergyCost` | 13976 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAttackWeight` | 14006 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityEnergyCost` | 14014 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnergyCost` | 14052 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncAbilityEnergyCost` | 14056 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseAbility` | 14060 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `spendEnergy` | 14075 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `enforceAbilityCosts` | 14087 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `gainEnergy` | 14095 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `spellMissChance` | 14115 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellMisses` | 14123 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `summonHitLands` | 14128 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellAilmentRoll` | 14132 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `matk` | 14140 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickTimedBuffsAfterEnemyPhase` | 14387 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `endPlayerTurn` | 14570 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyActionEnergyCost` | 14624 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAIPersonalityProfile` | 14651 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyAIMemory` | 14660 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyKitAbilityForEnemyAI` | 14667 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitOffersSetupDebuffs` | 14682 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyMode` | 14688 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyEnemyActionCategory` | 14697 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyActionPool` | 14711 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `projectedEnemyActionDamage` | 14756 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `canEnemyProjectLethal` | 14799 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getBossIntentCycle` | 14823 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEnemyArchetype` | 14828 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getArchetypeIntentWeights` | 14839 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypePriorityOrder` | 14842 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypeCategoryBonus` | 14850 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectEnemyIntent` | 14857 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `filterEnemyActionsByIntent` | 14893 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEnergySpendCap` | 14903 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyOpeningBias` | 14916 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyActionComboBonus` | 14926 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHpPct` | 14939 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHpPct` | 14940 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `mapAiStyleToType` | 14941 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `planEnemyAction` | 14949 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isBossEnrageAllowed` | 14964 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeNightfall` | 14965 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRiverGrip` | 14971 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTrackDecree` | 14977 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeApplyDecreePunish` | 14982 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRoyalDecree` | 14989 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeOwlsVerdict` | 14994 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeSummonCourt` | 15000 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTurnAI` | 15010 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitAbilityIsHardCC` | 15061 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollEnemyCombatRowAilment` | 15069 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refundEnemyActionEnergy` | 15105 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyAttackRiders` | 15112 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `executeEnemyKitTemplateAbility` | 15127 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTurn` | 15251 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `afterEnemyTurn` | 15388 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `showBattleCaption` | 15465 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDeath` | 15476 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isGreyShopStage` | 15504 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `isShopDueAfterBattle` | 15514 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getBattleStatsSafe` | 15525 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `postCombat` | 15534 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `rollTier` | 15708 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isMutationReward` | 15717 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isEquipmentReward` | 15721 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applySingleReward` | 15725 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `finishRewardScreenFlow` | 15768 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantRewardPool` | 15822 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `drainPendingRewardQueue` | 15837 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildNestRewardCardHtml` | 15844 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `spawnNestShakeSparks` | 15867 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestRewardTrayTooltips` | 15895 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `renderNestRewardCollectedTray` | 15914 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `finishNestRewardReveal` | 15934 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealNestDropsStaggered` | 15957 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealAllNestDrops` | 16018 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showStoryEquipmentPick` | 16022 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `handleNestShake` | 16073 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `showRewardScreen` | 16100 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmReward` | 16193 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyUpgradeWithMaxHpHealing` | 16291 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGoldReplaceUI` | 16311 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateNormalRewards` | 16340 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `generateBossRewards` | 16344 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollWeighted` | 16348 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardCount` | 16356 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardLimit` | 16357 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpBaseHealthGrowth` | 16367 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `levelUpChoiceLabel` | 16390 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpVitalityGain` | 16397 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyLevelUpAgilityGain` | 16427 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isMainAttackAbility` | 16455 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getMainAttackAutoLevel` | 16466 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyMainAttackAutoLevel` | 16473 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollLuFeatherPanelOptions` | 16497 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeatherDraftTotal` | 16506 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeathersUnallocated` | 16510 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `captureLuStatBaseline` | 16514 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `simulateLuDraftStats` | 16531 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `formatLuPreviewDelta` | 16572 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `renderLuFeatherIcons` | 16579 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuFeatherStatline` | 16587 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuStatPreview` | 16604 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshLuFeatherPanelUI` | 16637 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildFeatherStatPanel` | 16688 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLevelUpStatEffectDesc` | 16741 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEquippedWeaponAvgDamage` | 16758 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getOffencePctPerStat` | 16779 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateMitigationPct` | 16784 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateWeaponSkillDamagePerStat` | 16790 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpPerPointBreakdown` | 16796 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getLevelUpCombatImpactLine` | 16870 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpGlossaryBlurb` | 16875 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luStatKeyForOption` | 16884 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLuFeatherStatValue` | 16891 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildLevelUpStatTooltipHtml` | 16897 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireLevelUpTooltips` | 16942 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resetLuFeatherDraft` | 16970 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `ensureMainAttackAndLoadoutRules` | 16977 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setLevelUpPanelTitle` | 17049 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpConfirm` | 17053 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpSecondary` | 17060 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetLevelUpFlowState` | 17067 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLevelUpScreen` | 17072 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLUPanel` | 17098 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `countLevelAilments` | 17105 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ailmentSlotsForLevel` | 17108 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `deriveAbilityAilments` | 17112 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openAbilityModificationChoice` | 17133 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbilityModModal` | 17159 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshPlayerAbilityAilments` | 17167 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `confirmSkillUpgrade` | 17174 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `onExitLevelUpRequested` | 17217 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `afterLevelUp` | 17241 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `advanceStage` | 17252 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBossStage` | 17275 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollGroveMutationTier` | 17282 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveGearReward` | 17292 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyGroveGearReward` | 17298 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGroveRewardCard` | 17317 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveNestReward` | 17331 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `startGroveAmbushBattle` | 17335 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `showGroveEvent` | 17384 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `enterGrove` | 17422 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `resolveGrove` | 17435 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `groveFinish` | 17548 | Endless/Meta | Yes (data-action in index.html) | Medium | js/systems/endless-map.js |
| `pickRandom` | 17557 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `showVictory` | 17559 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showDefeat` | 17623 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `flightRescuedNestCount` | 17655 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showRunStats` | 17660 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideStoryCinematic` | 17685 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startStoryCinematic` | 17690 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getAudioCtx` | 17736 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeAudioIfNeeded` | 17741 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundButtonLabel` | 17747 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundStateFromSettings` | 17756 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `toggleSound` | 17761 | Audio | Yes (data-action in index.html) | Medium | js/audio/bgm-shared.js |
| `playTone` | 17777 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doScreenShake` | 17819 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetBattleStats` | 17832 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getBattleSummaryStats` | 17833 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderBattleSummary` | 17847 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `updateStageProgress` | 17861 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveRunHistory` | 17977 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderRunHistory` | 17990 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refAbilityEnergyCost` | 18030 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityCodexType` | 18039 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityPassesEnFilter` | 18045 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRefFilterBarHtml` | 18055 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireRefFilterSelects` | 18087 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRefGuideModal` | 18118 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRefGuideModal` | 18126 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `toggleRefGuide` | 18134 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectRefTab` | 18141 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `skillCard` | 18147 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refSkillScalingLabel` | 18166 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildRefGuide` | 18173 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderReferenceGuide` | 18369 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkRunUnlocks` | 18379 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `showUnlockToast` | 18386 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeUtilityOffer` | 18403 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `assignShopItems` | 18409 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopItemsToGlobal` | 18413 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `showStorkShop` | 18423 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `enterStorkShopScreen` | 18428 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopMutationTierKey` | 18465 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `ensureShopMutationTierOpenState` | 18471 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopMutationTierSections` | 18476 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `resolveShopItemCategory` | 18510 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopGearCategoryTitle` | 18519 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopItemMatchesCategory` | 18523 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopCategoryLogText` | 18536 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `clearShopSelection` | 18550 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBaseCost` | 18557 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBuyCost` | 18563 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedBuyTotal` | 18567 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopMarginalBuyCost` | 18582 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRemainingBudget` | 18590 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedSellTotal` | 18594 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopDock` | 18603 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopBuyButtonState` | 18631 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopSellButtonState` | 18641 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopSectionHeading` | 18651 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopBuyCard` | 18658 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `setShopTab` | 18693 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getEquipmentSellPrice` | 18742 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getMutationSellPrice` | 18749 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderShopSellItems` | 18756 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSellSelected` | 18802 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSlotIsStarterLocked` | 18834 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopEquipped` | 18838 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopUnequipSlot` | 18885 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `rollShopTier` | 18908 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `pickUniqueRewardByTier` | 18913 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `_findShopItemById` | 18923 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `generateShopItems` | 18943 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopResetVisitState` | 19019 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopLockVisitState` | 19029 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRefreshCost` | 19033 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopItems` | 19038 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `purchaseShopItemAtIndex` | 19110 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopBuySelected` | 19155 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopRefresh` | 19210 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `exitStorkShop` | 19225 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `openAbandonModal` | 19272 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbandonModal` | 19275 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmAbandon` | 19282 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `unlockAllCodexEntries` | 19308 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isCreatorCodesEnabled` | 19358 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeSwitches` | 19359 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isDevCodeEnabled` | 19362 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveDevCodeSwitches` | 19363 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setDevCodeSwitch` | 19366 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeCatalogRow` | 19372 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyBirdwatchingUnlock` | 19376 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyHeadingHomeLock` | 19382 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `setGoldenGooseInfiniteState` | 19393 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `toggleDevCode` | 19399 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshAfterDevCode` | 19404 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `activateDevCode` | 19411 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `deactivateDevCode` | 19485 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDevCodeSwitches` | 19519 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `renderSuppliesCodeTools` | 19550 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderSuppliesActivityLog` | 19565 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setOwnedBirdTier` | 19571 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isKnownDevCodePrefix` | 19575 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDevCode` | 19580 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBgmApi` | 19637 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmAudio` | 19638 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMenuPreviewBgmAudio` | 19639 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmTargetVolume` | 19640 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopBattleBgmImmediate` | 19644 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeOut` | 19652 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeIn` | 19673 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryStartBattleBgmIfNeeded` | 19693 | Audio | No (internal) | High | js/audio/bgm-shared.js |
| `stopMenuPreviewBgmImmediate` | 19714 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuPreviewActive` | 19720 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuScreen` | 19724 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `setAudioElTrack` | 19728 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `resolvedMusicTrackIdForRole` | 19744 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuNowPlaying` | 19751 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMusicMenuAssignmentChips` | 19762 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuControls` | 19782 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyMusicPanelVolumeState` | 19799 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelVolume` | 19821 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelMuted` | 19825 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicRoleChoice` | 19830 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMenuThemeForPreview` | 19850 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playMusicMenuPreview` | 19855 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMusicMenuPreview` | 19879 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `openMusicMenu` | 19896 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `closeMusicMenu` | 19905 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `cancelThemeBgmFade` | 19914 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginThemeBgmFadeOutForRunStart` | 19923 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMusicSettings` | 19947 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `saveMusicSettings` | 19961 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `getThemeBgmAudio` | 19969 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBattleBgmAudio` | 19972 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `cancelDukeBgmFade` | 19975 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBgmTargetVolume` | 19983 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeDukeBattleBgmAudio` | 19988 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgmImmediate` | 19994 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgm` | 20001 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `duckThemeBgmForBattle` | 20004 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeIn` | 20011 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeOut` | 20040 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isDukeStoryBossFight` | 20073 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `tryStartDukeBattleBgmIfNeeded` | 20082 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeThemeBgmAudio` | 20103 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryPlayThemeBgmForCurrentMenuScreen` | 20109 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyDukeBattleBgmToAudioEl` | 20122 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyThemeMusicToAudioEl` | 20130 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopAllGameAudio` | 20155 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncThemeMusicButtonLabels` | 20168 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncThemeBgmPlaybackForScreen` | 20181 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `toggleThemeMusicMuted` | 20195 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 20212 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `wireThemeBgmAutoplayUnlock` | 20232 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `detectPreferredUIMode` | 20270 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveUiMode` | 20276 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeCombatCustomLayout` | 20300 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetCombatCustomDraft` | 20321 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatCustomDraft` | 20324 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeCombatArrangement` | 20331 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeCombatLayout` | 20337 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAccessibilitySettings` | 20348 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getAccessibilitySettings` | 20374 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `bootstrapAccessibilityDefaults` | 20382 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireUiAutoDetectResize` | 20406 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAudioVolumeMultipliers` | 20424 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `selectSettingsTab` | 20432 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyUIStateToDOM` | 20446 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAutoCombatDensityReduction` | 20457 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyEffectiveCombatScales` | 20464 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyCombatLayoutSettings` | 20483 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `clearCombatCustomPanelStyles` | 20487 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatCustomPanels` | 20495 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatCustomEditRow` | 20507 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderCombatCustomPanelEditor` | 20516 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatCustomLayoutModal` | 20570 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatCustomLayoutModal` | 20576 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `saveCombatCustomLayoutFromModal` | 20581 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `resetCombatCustomLayoutDraft` | 20592 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `toggleCombatCustomPanelVisible` | 20596 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `moveCombatCustomPanel` | 20603 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatArrangement` | 20622 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatLayoutLabels` | 20636 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncAudioSettingLabels` | 20646 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncUiModeControls` | 20658 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyAccessibilitySettings` | 20673 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openSettingsModal` | 20695 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeSettingsModal` | 20747 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `returnToWarRoomFromSettings` | 20751 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openAbandonFromSettings` | 20757 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `goMainMenuFromSettings` | 20762 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetCombatLayoutSettings` | 20773 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `updateAccessibilitySettings` | 20785 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAudioSettingsFromControls` | 20831 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 20857 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |

## Major inline data still in game.js

| Block | Notes | Status |
|-------|-------|--------|
| `ABILITY_TEMPLATES` | ~5300 lines; boot-populated | ⬜ Deferred (high coupling) |
| `G` game state | Central mutable state | 🔁 Partial — classify owners per field |
| `registerGameModule` | Module hook registry | 🔁 Retain until all consumers migrated |
| Dove sprite patch IIFE | Legacy enemy portrait | ✅ Isolated at file top |

## Recommended extraction order

1. ✅ Pure helpers → `js/core/game-helpers.js`
2. 🟡 Debug/telemetry → `js/debug/`
3. ⬜ Combat UI rendering
4. ⬜ Build Nest (extend `map-forge.js`)
5. ⬜ Rewards/shop
6. ⬜ Story orchestration
7. ⬜ Encounter/combatant setup
8. ⬜ Combat controller
9. ⬜ Legacy compatibility cleanup

Regenerate this file: `node scripts/generate-game-js-audit.mjs`
