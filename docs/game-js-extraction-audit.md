# game.js Extraction Audit (Step 7)

Generated: 2026-08-31  
Source: `js/core/game.js`  
**Before Step 7:** 23102 lines  
**Functions:** 1018 top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
| Bootstrap/Orchestration | 243 | 🔁 Retain in game.js |
| Enemy setup/AI | 121 | ⬜ Phase 7 |
| Combat | 117 | ⬜ Phase 8 |
| Combat UI | 93 | ⬜ Phase 3 |
| Story/Overworld | 88 | ⬜ Phase 6 |
| Rewards | 58 | ⬜ Phase 5 |
| Audio | 56 | ⬜ Not started |
| Shop | 52 | ⬜ Phase 5B |
| Bird selection | 46 | ⬜ Not started |
| Nest | 31 | ⬜ Not started |
| Utilities | 26 | ✅ Phase 1 (game-helpers.js) |
| Equipment | 24 | ⬜ Not started |
| Save/load | 22 | ⬜ Not started |
| Class/Passive | 21 | ⬜ Not started |
| Build Nest | 11 | ⬜ Phase 4 (partially in map-forge.js) |
| Endless/Meta | 9 | ⬜ Not started |

## Extraction rules (summary)

1. Extract by system boundary, not line count.
2. Preserve `window` / `Avian.actions` / `data-action` compatibility.
3. Update `js/bootstrap/load-order.json` for every new module.
4. Run `npm test` after each phase.

## Function inventory

| Name | Line | Category | Global | Risk | Suggested destination |
|------|-----:|----------|--------|------|----------------------|
| `runPassiveIntegrityAudit` | 97 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `inferAIPersonalityFromStyle` | 124 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `inferEnemyClassFromStyle` | 141 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `makeEnemy` | 151 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDukeAbilityEnCost` | 186 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildDukeStoryBossEnemy` | 189 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeDukeBlakiston` | 214 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBiomeForStage` | 284 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyBiomeModifiers` | 291 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollRarity` | 304 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatStat` | 312 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatMaxHp` | 316 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgGoldenFeather` | 322 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countUpgradeAcquisitionsThisRun` | 338 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isUpgradeBlockedByRunAcquisitionCap` | 341 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `upgradeEligibleForRewardPick` | 350 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getUpgradePool` | 358 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ledgerStatLabel` | 362 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `cloneStatLedgerSlice` | 417 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `ensureStatLedger` | 426 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `reapplyPlayerGearStats` | 447 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `initStatLedgerForNewRun` | 453 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `syncBirdBaselineFromCatalog` | 467 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStatLedgerAfterLoad` | 492 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `mergeStatDeltaIntoBucket` | 515 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `recordUpgradeApplyInLedger` | 531 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildStatBreakdownTitle` | 547 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `equipmentPctLedgerKey` | 561 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquippedStatSources` | 565 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatModifierLines` | 579 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `richTooltipCloseBtn` | 595 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdPassiveInfo` | 599 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdAuthoredClassPerk` | 609 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildPassiveTooltipHTML` | 630 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getMutationDescHtml` | 640 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildMutationTooltipHTML` | 641 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEquipmentItem` | 642 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquipmentSkill` | 645 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `itemHasDisplayableWeaponDamage` | 649 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `formatEquipmentStatsHtml` | 658 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatAnyStatLabel` | 686 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `formatEquipmentSkillsHtml` | 710 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEquipmentTooltipHTML` | 724 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildRichStatTooltipHtml` | 761 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyMutationStatSources` | 811 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEntityAspectTooltipHtml` | 835 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getPlayerEquippedMutationIds` | 858 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildPlayerBirdTooltipHtml` | 860 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildClassLabelTooltipHtml` | 877 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyMutationsTooltipHtml` | 892 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyRichStatTooltipHtml` | 920 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `tooltipsEnabled` | 943 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showRichTooltipHtml` | 947 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltipNearEl` | 956 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindHoldRepeat` | 975 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindRichTooltip` | 1010 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireNestMutationTooltips` | 1050 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestEquipmentTooltips` | 1058 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestAbilityTooltips` | 1067 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireCombatStatTooltips` | 1086 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatClassLabelTooltips` | 1098 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatEnemyStatTooltips` | 1116 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyMutationTooltips` | 1127 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wirePlayerAvatarInteractionOnce` | 1132 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getDerivedMechanicalBonusLines` | 1147 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isEndlessRunActive` | 1243 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getPassiveEvolutionDefinition` | 1256 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `ensurePassiveEvolutionState` | 1273 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveEvolutionBonuses` | 1283 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveDefMdefBonuses` | 1295 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `rollEndlessReward` | 1305 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyEndlessProgressionMilestones` | 1312 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `rollUpgradeCard` | 1316 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ensureClassPerkState` | 1330 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `normalizeClassPerkIdList` | 1337 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getBirdClassRoleByKey` | 1341 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdClassPerks` | 1345 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `hasClassPerk` | 1351 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkGrantCountForMode` | 1355 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkCapForMode` | 1365 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getAvailableClassPerksForBird` | 1369 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyClassPerksToStats` | 1376 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyClassPerksToCombatContext` | 1389 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `recomputeClassPerkEffects` | 1417 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkBuffDurationBonus` | 1423 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkSongHealFlat` | 1428 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `grantClassPerk` | 1433 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `makeAbilityLevelData` | 1472 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `makeEvolutionAbilityTemplate` | 1481 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enforceAbilityBalanceSpec` | 1599 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeAbilityEnergy` | 1639 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAllAbilityEnergy` | 1654 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAbilityTemplates` | 1738 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `removeMimicEverywhere` | 1782 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getUnlocks` | 1816 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `grantUnlock` | 1819 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isUnlocked` | 1822 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getPlayableStarterBirdKeys` | 1823 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `collectAllBirdUnlockIds` | 1832 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `isBirdUnlockedForSelect` | 1840 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `isBuildNestUnlocked` | 1847 | Build Nest | Yes (explicit global/Avian.actions) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `syncBuildNestUnlockUI` | 1850 | Build Nest | Yes (explicit global/Avian.actions) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `getActiveOwNodesForProgress` | 1856 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryMaxStage` | 1861 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `queueUnlockBanner` | 1898 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `handleBossClearUnlocks` | 1903 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderUnlockPopupsOnGameover` | 1926 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkSecretUnlockChar` | 1949 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `expForLevel` | 1979 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `threatTierExpMultiplierForEnemy` | 2000 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `baseExpForEnemyLevel` | 2004 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `relativeLevelExpMultiplier` | 2013 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `stageExpMultiplier` | 2026 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeNormalEnemyExpGain` | 2035 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeBossExpGain` | 2051 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getGrowthStageForLevel` | 2089 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeBirdSizeForEnergy` | 2118 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getEnergyProfile` | 2129 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getEnemyEnergyProfile` | 2133 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computePlayerEffectiveMaxEnergy` | 2139 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerMaxEnergy` | 2149 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerStartEnergy` | 2153 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegen` | 2159 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegenThisTurn` | 2164 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerGameModule` | 2207 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `runModuleHook` | 2211 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `initDataPacks` | 2222 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `ensureUIState` | 2330 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerHit` | 2359 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerMiss` | 2360 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `triggerPassive` | 2365 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `renderPassiveBadge` | 2370 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatAbilityLevelPathway` | 2387 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `isStoryBattleNestEquipLocked` | 2397 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `notifyStoryBattleNestEquipLocked` | 2401 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `getEquipmentNestSlotLabel` | 2412 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `equipmentHandBadgeHtml` | 2416 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentStatChipLabel` | 2424 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentCompactStatsHtml` | 2440 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `needsUltimateSourcePick` | 2469 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setPlayerUltimateSourceItemId` | 2475 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildNestUltimateBankHtml` | 2490 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `buildNestUltimatePickerHtml` | 2520 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `equipmentSlotIconForItem` | 2524 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `grantPlayerEquipmentItem` | 2533 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_nestInvCompareHtml` | 2552 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_shopCompareDeltaClass` | 2570 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareFmt` | 2574 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareStatRow` | 2579 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareRows` | 2588 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareCandidateSlots` | 2613 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopCompareResolve` | 2625 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopCompareTooltipHtml` | 2642 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_shopSuppressHoldClick` | 2675 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `bindShopItemCompareTooltips` | 2690 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `_nestEquipmentItemHtml` | 2712 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSectionV2` | 2734 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `handleNestEquipmentClick` | 2814 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `selectNestTab` | 2856 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `organizeNestSections` | 2875 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestAbilitySection` | 2903 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `resetNestChrome` | 2951 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildEnemyNestEquipmentSection` | 2958 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyNestAbilitySection` | 3005 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyNestProfileHtml` | 3074 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyNestAbilityTooltips` | 3127 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `fillEnemyNestHeader` | 3136 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openEnemyNest` | 3160 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openNest` | 3181 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `notifyOwUiEmbedClose` | 3356 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `closeNest` | 3363 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `getNestSlotIcons` | 3376 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `readNestMutCompareMode` | 3379 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `setNestMutCompareMode` | 3388 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestInventoryMutStatsHtml` | 3392 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestMutationItemHtml` | 3394 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `handleNestEquipClick` | 3396 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSection` | 3423 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `bootstrapOwNestEmbed` | 3434 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `bootstrapOwSettingsEmbed` | 3457 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwReferenceEmbed` | 3469 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwUiEmbed` | 3481 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `codexMark` | 3490 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCardTierSlotCount` | 3510 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyPlayerSkillsFromCardTier` | 3522 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isSkillSlotUnlocked` | 3533 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `clampLockedSkillSlots` | 3540 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildFamilySkillAbilityLookup` | 3549 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getFamilyEvolutionBirdDataStore` | 3566 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getBirdFamilyEvolutionData` | 3572 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdSkillFamilyCatalog` | 3575 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `usesFamilySkillEvolution` | 3578 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `createSkillSlotState` | 3581 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBaseSkillSlotsForBird` | 3588 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getFamilyEvolutionAbilityStateFromId` | 3600 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getSkillSlotFamilyDef` | 3612 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillSlotDisplayLabel` | 3620 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeSkillSlotState` | 3626 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getSkillSlots` | 3637 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getSkillSlotByIndex` | 3640 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilitySkillSlot` | 3643 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureAbilityObjectFromTemplate` | 3649 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncPlayerAbilitiesFromSkillSlots` | 3671 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `consumePendingEquipmentV2MigrationCompensation` | 3717 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `stashEquipmentV2MigrationNotice` | 3737 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `applyEquipmentLoadoutSanitizationOnLoad` | 3744 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `finalizeEquipmentV2PreReleaseReset` | 3761 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `ensureFamilyEvolutionState` | 3772 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `_isValidOverworldEnemySeedPack` | 3794 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `saveRun` | 3797 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `loadSaveData` | 3875 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `deleteSave` | 3895 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearDevCodeAccess` | 3900 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `reloadShellHttpCache` | 3918 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `cacheBustReload` | 3937 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearGameCache` | 3947 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearAllProgress` | 3979 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openEraseProgressModal` | 4015 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeEraseProgressModal` | 4018 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `openClearCacheModal` | 4021 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeClearCacheModal` | 4024 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmClearCache` | 4027 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmEraseProgress` | 4042 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `continueRun` | 4055 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `goMainMenu` | 4252 | Enemy setup/AI | Yes (data-action in index.html) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isOwUiEmbedMode` | 4262 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOwTransientKeys` | 4266 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `navigateTopToMainMenu` | 4275 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `flyAgain` | 4299 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEncounterStage` | 4333 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStageEncounterChainLength` | 4339 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `hasMultiEnemyChainPending` | 4346 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetStageBattleStats` | 4354 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `accumulateStageBattleStats` | 4359 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `continueToNextEncounterBird` | 4382 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeOverworldProgress` | 4395 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `ensureOverworldProgress` | 4415 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setOverworldCurrentNode` | 4420 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `finalizeOverworldStageClear` | 4427 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOverworldPendingBattle` | 4449 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `ensureOwEncounterDrafts` | 4467 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDukeEncounterToken` | 4486 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rerollNonDukeStageEnemy` | 4492 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildOwEnemyDraftFromBirdKey` | 4500 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionProfileId` | 4546 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `shiftEnemyProgressionTier` | 4557 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveStoryLevelFromStage` | 4565 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionTier` | 4583 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveEnemyWorkbookLevel` | 4618 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTotalStars` | 4646 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyStatsFromPlayerProgression` | 4660 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `mergeScaledStatsIntoEnemy` | 4841 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterMaterialized` | 4973 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyKitAbilityIds` | 4990 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEquipmentActionSources` | 5002 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `isEnemyUltimateMeterReady` | 5007 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEnemyEquipmentActionAvailable` | 5016 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEnemyAbilityDisplayLabel` | 5023 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillNames` | 5033 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillKeys` | 5063 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevel` | 5078 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevelLine` | 5086 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyInfoPopupAbilitiesHtml` | 5091 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeEnemyInfoPopup` | 5146 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openEnemyInfoPopup` | 5154 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatEquipmentEffectSummaryHtml` | 5159 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyInfoPopupMutationsHtml` | 5175 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyInfoEquipmentTooltips` | 5210 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `wireEnemyInfoPopupOnce` | 5220 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCurrentStageEncounterPreviewData` | 5235 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyAbilityTooltipHtml` | 5251 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEncounterPreviewTooltipHtml` | 5301 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `ensureEnemyPreviewEquipmentState` | 5342 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `buildEncounterPreviewEquipmentHtml` | 5393 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_initEncounterPreviewCollapse` | 5419 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderEncounterPreview` | 5439 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `terrainStringToArenaId` | 5499 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveBattleArenaId` | 5523 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `battleArenaImagePaths` | 5530 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `updateBattleArena` | 5540 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncBattleLogDrawerCollapse` | 5574 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `initBattleLogDrawer` | 5587 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `_isOverworldRun` | 5602 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeOwEnemyListForBattle` | 5608 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEnemyLevelBand` | 5642 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEvolvedSlotCount` | 5654 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getOwEnemySkillDepthFromTierBand` | 5659 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `materializeEnemyFamilySkillSlots` | 5668 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollInt` | 5682 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `pickRandom` | 5683 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `weightedPick` | 5684 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classGrowthWeightsForStory` | 5691 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `storyLevelFromTierStar` | 5700 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeForgeSlotTierStar` | 5708 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `getForgeEncounterSlot` | 5713 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `shouldBuildForgeTierStarEnemy` | 5717 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `buildTierStarEnemyFromBirdKey` | 5723 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildStoryEnemyFromBirdKey` | 5817 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateStoryStageEnemyKeys` | 5944 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `commitStoryEncounterMeta` | 5974 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyEnemyFeatherFromPlayerMirror` | 5993 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyStoryEnemyGrowth` | 6031 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncStoryEncounterBirdQueue` | 6066 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `handleOverworldReturn` | 6121 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showNextStagePreview` | 6308 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `initSelection` | 6341 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `buildRosterFilterSelect` | 6374 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `syncRosterFilterSelect` | 6391 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `onRosterFilterChange` | 6404 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildSelectionViewButtons` | 6418 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildLockFilterButtons` | 6419 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setRosterMode` | 6421 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setLockFilter` | 6430 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGameModeToggle` | 6438 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setGameMode` | 6456 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classToRoleId` | 6464 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `migrateLegacySelectionView` | 6467 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `idToClassLabel` | 6477 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireRefGuideClicks` | 6481 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderStarterFallbackGrid` | 6495 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `initSelectionSafe` | 6524 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `formatDifficultyMult` | 6578 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `buildDifficultyPicker` | 6584 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectDifficulty` | 6629 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `setSelView` | 6635 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildBirdGrid` | 6644 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderBirdCardStarsHtml` | 6808 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdSpeciesRarityMeta` | 6817 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildBirdCard` | 6827 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `setCharacterSelectView` | 6878 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `backToCharacterSelectBirds` | 6904 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `selectBird` | 6921 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `mutateBirdCardSelect` | 6935 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `__normSpriteKey` | 6962 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `__hasSpriteKey` | 6963 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rosterCanonBirdKey` | 6969 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `runtimeSizeFromProfileToken` | 6985 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `profileSizeTokenForEntity` | 7010 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `rosterSizeForEntity` | 7021 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getUISizeClass` | 7025 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `normalizeSpriteBirdKey` | 7036 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `neutralBirdFallbackHTML` | 7047 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wrapSpriteFaceLeft` | 7050 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `wrapEnemySpriteIfNeeded` | 7053 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureBattleEnemyFacing` | 7059 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderBirdIconHTML` | 7067 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderEntityAvatarHTML` | 7082 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getFlightSettingsSummary` | 7087 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncFlightSettingsBriefing` | 7105 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSfselRunSummary` | 7120 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSelectTakeFlightButton` | 7130 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `escapeHtmlRoster` | 7143 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `rosterAbilityBlurb` | 7150 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityBlurbForTemplate` | 7162 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRosterPreviewStubForBirdKey` | 7173 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `rosterPreviewSlotTag` | 7191 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKit` | 7199 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKitForCardProgress` | 7225 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `birdUpgradeTierMeta` | 7248 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStarsHtml` | 7256 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildBirdUpgradePreviewModel` | 7261 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeReasonText` | 7340 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `formatBirdUpgradeStatValue` | 7348 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStatRowsHtml` | 7354 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilityLabel` | 7363 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilitiesHtml` | 7369 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `renderBirdUpgradePreviewModal` | 7387 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openBirdUpgradePreview` | 7439 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `closeBirdUpgradePreview` | 7447 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmBirdUpgradePreview` | 7458 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openRosterChampionModal` | 7508 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRosterChampionModal` | 7509 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `_setSfselEmptyState` | 7513 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAscentPanel` | 7519 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startSelectedBird` | 7699 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `beginRun` | 7704 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCombatItemMaxHold` | 7712 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerIsKnightClass` | 7720 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `createDefaultCombatItems` | 7725 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureCombatItems` | 7729 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatItemCount` | 7739 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canAddCombatItem` | 7744 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `addCombatItem` | 7750 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatItemShopOffer` | 7761 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `launchStoryOverworld` | 7784 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startGame` | 7828 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `makeEndlessEnemy` | 7949 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEndlessMapActive` | 7975 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `showEndlessMap` | 7980 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `endlessMapSelectNode` | 8015 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `grantEndlessMapTreasure` | 8081 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `finishEndlessMapAfterCombat` | 8101 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `returnToEndlessMapFromSideRoom` | 8139 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `captureBattleTempPlayerStats` | 8156 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `restoreBattleTempPlayerStats` | 8178 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `prepareEnemyCombatLoadout` | 8191 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `preparePlayerCombatLoadout` | 8230 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `normalizeBattleTurnState` | 8252 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetForNewBattle` | 8276 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeEnemyNameKey` | 8368 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `storyTierFromStage` | 8373 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildEdFromBirdEnemyTemplate` | 8383 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraftForStage` | 8396 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraft` | 8403 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `bossTitleForStageMilestone` | 8411 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `scheduleOpeningEnemyTurn` | 8419 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `loadStage` | 8445 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setSuppliesSubView` | 8630 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncMissionMapVariantTabs` | 8666 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapPickerVisibility` | 8687 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapLabel` | 8692 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshMissionTestMapSelect` | 8716 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openSelectHubPanel` | 8782 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRunSettings` | 8838 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmRunSettings` | 8841 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `closeSelectHubPanel` | 8846 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `takeFlightToSelect` | 8866 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `scrollToSelectRoster` | 8875 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `showScreen` | 8880 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `buildPlayerCombatStatHint` | 8928 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildEnemyCombatStatHint` | 8944 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `combatEscAttr` | 8959 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `combatTrendTag` | 8960 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolvePassiveSourceLabel` | 8966 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassivePerkModifierLines` | 8980 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getActiveDamageModifierLines` | 9004 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildPlayerStatsGridHtml` | 9038 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyStatsGridHtml` | 9084 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildCombatStatBreakdownSection` | 9115 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `buildCombatPerkSection` | 9149 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatStatusDetailsSection` | 9179 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildCombatDetailsModalHtml` | 9216 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `collectCombatantStatusChips` | 9234 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatantHoverTooltipHtml` | 9248 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatStatsModal` | 9314 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatStatsModal` | 9321 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshCombatStatsModalIfOpen` | 9333 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatStatsModalOnce` | 9341 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAvatar` | 9349 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAvatarWrap` | 9350 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPanel` | 9351 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshBattleUI` | 9353 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `setHpBar` | 9471 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBattleAilmentSymbolActive` | 9526 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderBattleAilmentSymbols` | 9535 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `ensureCombatStatusSections` | 9558 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyIdentityStatusBadges` | 9584 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderStatuses` | 9591 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setEnergyBar` | 9647 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setProtectionBars` | 9656 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderEnergyOrbs` | 9741 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `lockActionUI` | 9830 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `canPlayerAct` | 9836 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncCombatTurnFlags` | 9840 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isEnemyIntentVisible` | 9850 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyIntentVisibility` | 9858 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTelegraphActionLabel` | 9864 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTelegraphActionCost` | 9869 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTelegraphTooltipHtml` | 9875 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderEnemyPlan` | 9888 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderAllCombatUI` | 9928 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `enqueueAction` | 9941 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `runActionQueue` | 9947 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isActiveBattleContext` | 9989 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `failsafeAdvance` | 9995 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `installLegacyErrorHUD` | 10045 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `installErrorHUD` | 10196 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDisplayTags` | 10225 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityTypeChipLabel` | 10229 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isPlayerAbilityUsable` | 10235 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerHasAffordableAbility` | 10246 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseCombatItem` | 10255 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `useCombatItem` | 10264 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderCombatItems` | 10294 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `compactCombatAbilityDescription` | 10322 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderActions` | 10329 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbilityTemplateForUI` | 10546 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectiveAbilityBtnType` | 10611 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `estimateMultiplierFromSkillDescription` | 10625 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerAtkForDamagePreview` | 10652 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectivePlayerOffensiveAtkForPreview` | 10661 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerOffensiveMatkForPreview` | 10664 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPackRowScaleStatRaw` | 10668 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `packRowScaleContribution` | 10681 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `registerStrikePreviewForBird` | 10690 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getStrikePreviewMultiplierForAbility` | 10705 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getHybridPreviewSpec` | 10716 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateHybridSplitBands` | 10744 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateSkillDamageRange` | 10808 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `snowyOwlEyeStatPreviewLines` | 11021 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `snowyOwlGlideStatPreviewLines` | 11036 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `_previewPickArrayFromSource` | 11217 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGenericUtilityStatPreviewFromAction` | 11228 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillStatPreviewLines` | 11290 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildActionTooltipHTML` | 11307 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showActionTooltip` | 11391 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltip` | 11401 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `moveTooltip` | 11414 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showTooltip` | 11450 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideTooltip` | 11461 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbDesc` | 11469 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityCooldown` | 11481 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getClassCooldownAdjustment` | 11485 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDirectHealingAbility` | 11507 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getTemplateCooldown` | 11523 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setAbilityCooldown` | 11538 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `reduceOtherSpellCooldownsOnCast` | 11543 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeAbilityCooldownsForPlayer` | 11564 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getPlayerPiercePctForAbility` | 11575 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerClassRole` | 11586 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getClassPerkTriggerForCurrentStage` | 11590 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `resumeAfterGrove` | 11604 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `continueStageTransitionAfterRewards` | 11614 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openClassPerkChoice` | 11709 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `maybeOfferClassPerkChoice` | 11745 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyPassiveEvolutionChoice` | 11754 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `maybeOfferPassiveEvolutionChoice` | 11772 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyOpeningStrikePassiveOnTurnStart` | 11811 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCrowDefendCooldown` | 11817 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `logAspectMatchupFeedback` | 11823 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getAspectDefinition` | 11833 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `formatAspectDisplayName` | 11840 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildAspectTooltipHTML` | 11848 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resolveAbilityAspectForDisplay` | 11863 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildAspectChartSvg` | 11872 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `logMsg` | 11919 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playAvatarAnim` | 11932 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spawnFloat` | 11948 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `flashPanel` | 11988 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doAttack` | 11997 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doMiss` | 12050 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doShield` | 12059 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doSpell` | 12066 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doHeal` | 12067 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `delay` | 12078 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `roll` | 12086 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerBaseAcc` | 12099 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeaponPrecisionModifier` | 12112 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillPrecisionModifier` | 12130 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getFinalAttackPrecision` | 12148 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccMod` | 12192 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerEffectiveAcc` | 12201 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveActionPrecisionPct` | 12208 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `clamp01` | 12218 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getPostBattleHealPct` | 12225 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `shouldApplyPostBattleHealNow` | 12229 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPostBattleHealIfDue` | 12236 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `softenMainStatForCombat` | 12258 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `effectiveDodgePercentForCombat` | 12266 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `damageMitigationMultiplierFromGuard` | 12273 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `physicalGuardValueFromEnemyDef` | 12277 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `magicalGuardValueFromEnemyMdef` | 12284 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `physicalGuardValueFromPlayerDef` | 12291 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `magicalGuardValueFromPlayerMdef` | 12297 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerArmorPenPct` | 12303 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPlayerMagicPenPct` | 12309 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPhysicalPierceFractionForDamage` | 12319 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getMagicalPierceFractionForDamage` | 12329 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPhysicalPierceFractionForPreview` | 12342 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getMagicalPierceFractionForPreview` | 12354 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcHitChance` | 12363 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcDefenseMultiplier` | 12372 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGrowthStageTransition` | 12377 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkGrowthStage` | 12413 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyBaseStats` | 12444 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTier` | 12467 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getEndlessEffectiveBattleNumber` | 12495 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEndlessDifficultyLevelOffset` | 12500 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getEndlessNormalFightTier` | 12525 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollRandomAnyMutationTiers` | 12533 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getStoryMutationRewardTiers` | 12542 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveMutationRewardTiers` | 12566 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeMutationDataTier` | 12589 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `pickUniqueMutationReward` | 12594 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildMutationRewardPool` | 12612 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `computeEnemyEffectiveLevel` | 12620 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStoryEnemyPowerMultiplier` | 12634 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `combatResolveEnemyTier` | 12643 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildScaledEnemy` | 12656 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildScaledBoss` | 12738 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyScaleFactor` | 12743 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEffectiveDodge` | 12757 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `chance` | 12778 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `addStatus` | 12781 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setStatusMax` | 12782 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshStatus` | 12784 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGuardedPhysReducPct` | 12786 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGuardedBuff` | 12794 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getTierBuffPct` | 12818 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveShieldAmountFromOpts` | 12824 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyShieldHp` | 12836 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applyDamageThroughShield` | 12859 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `notifyProtectionHitHooks` | 12912 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickShieldHpStatus` | 12931 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickGuardedStatus` | 12956 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playerIsGuarding` | 12962 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveGuardedReductionPct` | 12968 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshDerivedStatsAfterLoan` | 12981 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applySourceStatLoan` | 12991 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `decaySourceStatLoans` | 13008 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applySourceStatLoanPct` | 13025 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `clamp` | 13036 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `clampSkipChance` | 13037 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getWeakenStacks` | 13042 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeakenDamageMult` | 13049 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getWeakenDodgePenalty` | 13054 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyWeakenStack` | 13058 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectiveEnemyDodgeForPlayerHit` | 13068 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `scaleHealForBleed` | 13077 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeBurningTurns` | 13090 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `enemyHasBurning` | 13096 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHasBurning` | 13103 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToTarget` | 13110 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToEnemy` | 13135 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalStackAilment` | 13139 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalResolvedState` | 13171 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollStunChance` | 13207 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyEnemySlow` | 13208 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPendingStrikeBuff` | 13231 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerTimedBuff` | 13247 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `promotePendingStrikeBuffToActive` | 13260 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerSlow` | 13273 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshEnemyStrikerDodgeMark` | 13287 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAbilityLifestealPct` | 13299 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolveAbilityCombatRow` | 13317 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `detectEquipmentDamageBonus` | 13328 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `computeMasterOutgoingDamage` | 13336 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `computeOutgoingDamageBase` | 13432 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `collectDispatcherConditionalBonusFractions` | 13481 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `collectOutgoingDamageBonusFractions` | 13511 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLifestealFromDamage` | 13627 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyAbilityAuthoredEnCost` | 13638 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeEntityAbilityRawDamage` | 13644 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCurvedMitigationToPlayer` | 13704 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerCritDamageAdd` | 13730 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `dealDamage` | 13772 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmg` | 14170 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countEnemyCombatDebuffCategories` | 14198 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `countAilmentCategoriesOnEnemy` | 14217 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHasAfflictionForCardBonuses` | 14237 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `selfDodgeBuffActive` | 14240 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeSecondaryStatFlatForPhysical` | 14244 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyConditionalPhysicalDamageMultipliers` | 14257 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmgWithAlternateScaling` | 14276 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDamageScalingHintForUI` | 14287 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `calcEnemyAbilityDamage` | 14293 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyBossBurstBuffer` | 14302 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `edmg` | 14313 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollEnemyCritDamage` | 14329 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerMissChance` | 14343 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitPercentForAttack` | 14386 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccuracy` | 14404 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolvePlayerAttackHit` | 14414 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAttackMisses` | 14432 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doPlayerAttackMiss` | 14435 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerDmgMult` | 14445 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAilChance` | 14451 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `tryApplyAilment` | 14474 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDelayedDmgBoostPct` | 14492 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDelayedDamage` | 14499 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `tryMutationOnHitAilments` | 14527 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `notifyAilmentApplied` | 14546 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyAilment` | 14560 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerCritChance` | 14819 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitBonus` | 14852 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickDelayedForTarget` | 14864 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickStatuses` | 14881 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveAbilityAliasSourceId` | 14927 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerAbilityAlias` | 14933 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerStrikePreviewForBird` | 14934 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStarterKitEnergySmoothing` | 14937 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `checkBlackbirdOmenChorusAfterAbility` | 14940 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAction` | 14953 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startPlayerTurn` | 15206 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyEnergyForBattleDisplay` | 15302 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `startEnemyTurn` | 15309 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isSpellAbilityId` | 15327 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isMultiHitAbility` | 15332 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAuthoredEnergyCost` | 15344 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAttackWeight` | 15374 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityEnergyCost` | 15382 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnergyCost` | 15420 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncAbilityEnergyCost` | 15424 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseAbility` | 15428 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `spendEnergy` | 15443 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `enforceAbilityCosts` | 15455 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `gainEnergy` | 15463 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `spellMissChance` | 15483 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellMisses` | 15491 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `summonHitLands` | 15496 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellAilmentRoll` | 15500 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `matk` | 15508 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickTimedBuffsAfterEnemyPhase` | 15755 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `endPlayerTurn` | 15938 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyActionEnergyCost` | 15992 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAIPersonalityProfile` | 16019 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyAIMemory` | 16028 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyKitAbilityForEnemyAI` | 16035 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitOffersSetupDebuffs` | 16050 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyMode` | 16056 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyEnemyActionCategory` | 16065 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyActionPool` | 16079 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `projectedEnemyActionDamage` | 16124 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `canEnemyProjectLethal` | 16167 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getBossIntentCycle` | 16191 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEnemyArchetype` | 16196 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getArchetypeIntentWeights` | 16207 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypePriorityOrder` | 16210 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypeCategoryBonus` | 16218 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectEnemyIntent` | 16225 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `filterEnemyActionsByIntent` | 16261 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEnergySpendCap` | 16271 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyOpeningBias` | 16284 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyActionComboBonus` | 16294 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHpPct` | 16307 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHpPct` | 16308 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `mapAiStyleToType` | 16309 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `planEnemyAction` | 16317 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isBossEnrageAllowed` | 16332 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeNightfall` | 16333 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRiverGrip` | 16339 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTrackDecree` | 16345 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeApplyDecreePunish` | 16350 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRoyalDecree` | 16357 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeOwlsVerdict` | 16362 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeSummonCourt` | 16368 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTurnAI` | 16378 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitAbilityIsHardCC` | 16429 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollEnemyCombatRowAilment` | 16437 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refundEnemyActionEnergy` | 16473 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyAttackRiders` | 16480 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `executeEnemyKitTemplateAbility` | 16495 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTurn` | 16619 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `afterEnemyTurn` | 16756 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `showBattleCaption` | 16833 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDeath` | 16844 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isGreyShopStage` | 16872 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `isShopDueAfterBattle` | 16882 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getBattleStatsSafe` | 16893 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `postCombat` | 16902 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `rollTier` | 17076 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isMutationReward` | 17085 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isEquipmentReward` | 17089 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applySingleReward` | 17093 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `finishRewardScreenFlow` | 17136 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantRewardPool` | 17190 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `drainPendingRewardQueue` | 17205 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildNestRewardCardHtml` | 17212 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `spawnNestShakeSparks` | 17235 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestRewardTrayTooltips` | 17263 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `renderNestRewardCollectedTray` | 17282 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `finishNestRewardReveal` | 17302 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealNestDropsStaggered` | 17325 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealAllNestDrops` | 17386 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showStoryEquipmentPick` | 17390 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `handleNestShake` | 17441 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `showRewardScreen` | 17468 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmReward` | 17561 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyUpgradeWithMaxHpHealing` | 17659 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGoldReplaceUI` | 17679 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateNormalRewards` | 17708 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `generateBossRewards` | 17712 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollWeighted` | 17716 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardCount` | 17724 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardLimit` | 17725 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpBaseHealthGrowth` | 17735 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `levelUpChoiceLabel` | 17758 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpVitalityGain` | 17765 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyLevelUpAgilityGain` | 17795 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isMainAttackAbility` | 17823 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getMainAttackAutoLevel` | 17834 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyMainAttackAutoLevel` | 17841 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollLuFeatherPanelOptions` | 17865 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeatherDraftTotal` | 17874 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeathersUnallocated` | 17878 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `captureLuStatBaseline` | 17882 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `simulateLuDraftStats` | 17899 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `formatLuPreviewDelta` | 17940 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `renderLuFeatherIcons` | 17947 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuFeatherStatline` | 17955 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuStatPreview` | 17972 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshLuFeatherPanelUI` | 18005 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildFeatherStatPanel` | 18056 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLevelUpStatEffectDesc` | 18109 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEquippedWeaponAvgDamage` | 18126 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getOffencePctPerStat` | 18147 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateMitigationPct` | 18152 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateWeaponSkillDamagePerStat` | 18158 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpPerPointBreakdown` | 18164 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getLevelUpCombatImpactLine` | 18238 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpGlossaryBlurb` | 18243 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luStatKeyForOption` | 18252 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLuFeatherStatValue` | 18259 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildLevelUpStatTooltipHtml` | 18265 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireLevelUpTooltips` | 18310 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resetLuFeatherDraft` | 18338 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `ensureMainAttackAndLoadoutRules` | 18345 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setLevelUpPanelTitle` | 18417 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpConfirm` | 18421 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpSecondary` | 18428 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetLevelUpFlowState` | 18435 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLevelUpScreen` | 18440 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLUPanel` | 18466 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `countLevelAilments` | 18473 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ailmentSlotsForLevel` | 18476 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `deriveAbilityAilments` | 18480 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openAbilityModificationChoice` | 18501 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbilityModModal` | 18527 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshPlayerAbilityAilments` | 18535 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `confirmSkillUpgrade` | 18542 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `onExitLevelUpRequested` | 18585 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `afterLevelUp` | 18609 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `advanceStage` | 18620 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBossStage` | 18643 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollGroveMutationTier` | 18650 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveGearReward` | 18660 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyGroveGearReward` | 18666 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGroveRewardCard` | 18685 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveNestReward` | 18699 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `startGroveAmbushBattle` | 18703 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `showGroveEvent` | 18752 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `enterGrove` | 18790 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `resolveGrove` | 18803 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `groveFinish` | 18916 | Endless/Meta | Yes (data-action in index.html) | Medium | js/systems/endless-map.js |
| `pickRandom` | 18925 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `showVictory` | 18927 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showDefeat` | 18991 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `flightRescuedNestCount` | 19023 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showRunStats` | 19028 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideStoryCinematic` | 19053 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startStoryCinematic` | 19058 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getAudioCtx` | 19104 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeAudioIfNeeded` | 19109 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundButtonLabel` | 19115 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundStateFromSettings` | 19124 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `toggleSound` | 19129 | Audio | Yes (data-action in index.html) | Medium | js/audio/bgm-shared.js |
| `playTone` | 19145 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doScreenShake` | 19187 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetBattleStats` | 19200 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getBattleSummaryStats` | 19201 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderBattleSummary` | 19215 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `updateStageProgress` | 19229 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveRunHistory` | 19345 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderRunHistory` | 19358 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refAbilityEnergyCost` | 19398 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityCodexType` | 19407 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityPassesEnFilter` | 19413 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRefFilterBarHtml` | 19423 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireRefFilterSelects` | 19455 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRefGuideModal` | 19486 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRefGuideModal` | 19494 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `toggleRefGuide` | 19502 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectRefTab` | 19509 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `skillCard` | 19515 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refSkillScalingLabel` | 19534 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildRefGuide` | 19541 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderReferenceGuide` | 19737 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkRunUnlocks` | 19747 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `showUnlockToast` | 19754 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeUtilityOffer` | 19771 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `assignShopItems` | 19777 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopItemsToGlobal` | 19781 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `showStorkShop` | 19791 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `enterStorkShopScreen` | 19796 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopMutationTierKey` | 19833 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `ensureShopMutationTierOpenState` | 19839 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopMutationTierSections` | 19844 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `resolveShopItemCategory` | 19878 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopGearCategoryTitle` | 19887 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopItemMatchesCategory` | 19891 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopCategoryLogText` | 19904 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `clearShopSelection` | 19918 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBaseCost` | 19925 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBuyCost` | 19931 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedBuyTotal` | 19935 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopMarginalBuyCost` | 19950 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRemainingBudget` | 19958 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedSellTotal` | 19962 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopDock` | 19971 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopBuyButtonState` | 19999 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopSellButtonState` | 20009 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopSectionHeading` | 20019 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopBuyCard` | 20026 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `setShopTab` | 20061 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getEquipmentSellPrice` | 20110 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getMutationSellPrice` | 20117 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderShopSellItems` | 20124 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSellSelected` | 20170 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSlotIsStarterLocked` | 20202 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopEquipped` | 20206 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopUnequipSlot` | 20253 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `rollShopTier` | 20276 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `pickUniqueRewardByTier` | 20281 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `_findShopItemById` | 20291 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `generateShopItems` | 20311 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopResetVisitState` | 20387 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopLockVisitState` | 20397 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRefreshCost` | 20401 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopItems` | 20406 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `purchaseShopItemAtIndex` | 20478 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopBuySelected` | 20523 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopRefresh` | 20578 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `exitStorkShop` | 20593 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `openAbandonModal` | 20640 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbandonModal` | 20643 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmAbandon` | 20650 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `unlockAllCodexEntries` | 20676 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isCreatorCodesEnabled` | 20726 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeSwitches` | 20727 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isDevCodeEnabled` | 20730 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveDevCodeSwitches` | 20731 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setDevCodeSwitch` | 20734 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeCatalogRow` | 20740 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyBirdwatchingUnlock` | 20744 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyHeadingHomeLock` | 20750 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `setGoldenGooseInfiniteState` | 20761 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `toggleDevCode` | 20767 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshAfterDevCode` | 20772 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `activateDevCode` | 20779 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `deactivateDevCode` | 20853 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDevCodeSwitches` | 20887 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `renderSuppliesCodeTools` | 20918 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderSuppliesActivityLog` | 20933 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setOwnedBirdTier` | 20939 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isKnownDevCodePrefix` | 20943 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDevCode` | 20948 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBgmApi` | 21005 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmAudio` | 21006 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMenuPreviewBgmAudio` | 21007 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmTargetVolume` | 21008 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopBattleBgmImmediate` | 21012 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeOut` | 21020 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeIn` | 21041 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryStartBattleBgmIfNeeded` | 21061 | Audio | No (internal) | High | js/audio/bgm-shared.js |
| `stopMenuPreviewBgmImmediate` | 21082 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuPreviewActive` | 21088 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuScreen` | 21092 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `setAudioElTrack` | 21096 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `resolvedMusicTrackIdForRole` | 21112 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuNowPlaying` | 21119 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMusicMenuAssignmentChips` | 21130 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuControls` | 21150 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyMusicPanelVolumeState` | 21167 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelVolume` | 21189 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelMuted` | 21193 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicRoleChoice` | 21198 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMenuThemeForPreview` | 21218 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playMusicMenuPreview` | 21223 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMusicMenuPreview` | 21247 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `openMusicMenu` | 21264 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `closeMusicMenu` | 21273 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `cancelThemeBgmFade` | 21282 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginThemeBgmFadeOutForRunStart` | 21291 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMusicSettings` | 21315 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `saveMusicSettings` | 21329 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `getThemeBgmAudio` | 21337 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBattleBgmAudio` | 21340 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `cancelDukeBgmFade` | 21343 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBgmTargetVolume` | 21351 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeDukeBattleBgmAudio` | 21356 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgmImmediate` | 21362 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgm` | 21369 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `duckThemeBgmForBattle` | 21372 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeIn` | 21379 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeOut` | 21408 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isDukeStoryBossFight` | 21441 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `tryStartDukeBattleBgmIfNeeded` | 21450 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeThemeBgmAudio` | 21471 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryPlayThemeBgmForCurrentMenuScreen` | 21477 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyDukeBattleBgmToAudioEl` | 21490 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyThemeMusicToAudioEl` | 21498 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopAllGameAudio` | 21523 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncThemeMusicButtonLabels` | 21536 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncThemeBgmPlaybackForScreen` | 21549 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `toggleThemeMusicMuted` | 21563 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 21580 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `wireThemeBgmAutoplayUnlock` | 21600 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `detectPreferredUIMode` | 21638 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveUiMode` | 21644 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeCombatCustomLayout` | 21668 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetCombatCustomDraft` | 21689 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatCustomDraft` | 21692 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeCombatArrangement` | 21699 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeCombatLayout` | 21705 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAccessibilitySettings` | 21716 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getAccessibilitySettings` | 21742 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `bootstrapAccessibilityDefaults` | 21750 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireUiAutoDetectResize` | 21774 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAudioVolumeMultipliers` | 21792 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `selectSettingsTab` | 21800 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyUIStateToDOM` | 21814 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAutoCombatDensityReduction` | 21825 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyEffectiveCombatScales` | 21832 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyCombatLayoutSettings` | 21851 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `clearCombatCustomPanelStyles` | 21855 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatCustomPanels` | 21863 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatCustomEditRow` | 21875 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderCombatCustomPanelEditor` | 21884 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatCustomLayoutModal` | 21938 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatCustomLayoutModal` | 21944 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `saveCombatCustomLayoutFromModal` | 21949 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `resetCombatCustomLayoutDraft` | 21960 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `toggleCombatCustomPanelVisible` | 21964 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `moveCombatCustomPanel` | 21971 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatArrangement` | 21990 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatLayoutLabels` | 22004 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncAudioSettingLabels` | 22014 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncUiModeControls` | 22026 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyAccessibilitySettings` | 22041 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openSettingsModal` | 22063 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeSettingsModal` | 22115 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `returnToWarRoomFromSettings` | 22119 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openAbandonFromSettings` | 22125 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `goMainMenuFromSettings` | 22130 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetCombatLayoutSettings` | 22141 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `updateAccessibilitySettings` | 22153 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAudioSettingsFromControls` | 22199 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 22225 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |

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
