# game.js Extraction Audit (Step 7)

Generated: 2026-08-31  
Source: `js/core/game.js`  
**Before Step 7:** 21858 lines  
**Functions:** 976 top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
| Bootstrap/Orchestration | 237 | 🔁 Retain in game.js |
| Enemy setup/AI | 113 | ⬜ Phase 7 |
| Combat | 108 | ⬜ Phase 8 |
| Story/Overworld | 87 | ⬜ Phase 6 |
| Combat UI | 77 | ⬜ Phase 3 |
| Rewards | 58 | ⬜ Phase 5 |
| Audio | 56 | ⬜ Not started |
| Shop | 52 | ⬜ Phase 5B |
| Bird selection | 46 | ⬜ Not started |
| Nest | 31 | ⬜ Not started |
| Utilities | 26 | ✅ Phase 1 (game-helpers.js) |
| Equipment | 24 | ⬜ Not started |
| Save/load | 22 | ⬜ Not started |
| Class/Passive | 19 | ⬜ Not started |
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
| `lockActionUI` | 8929 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `canPlayerAct` | 8935 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncCombatTurnFlags` | 8939 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enqueueAction` | 8949 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `runActionQueue` | 8955 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isActiveBattleContext` | 8996 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `failsafeAdvance` | 9002 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `installLegacyErrorHUD` | 9051 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `installErrorHUD` | 9202 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDisplayTags` | 9231 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityTypeChipLabel` | 9235 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isPlayerAbilityUsable` | 9241 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerHasAffordableAbility` | 9252 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseCombatItem` | 9261 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `useCombatItem` | 9270 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityTemplateForUI` | 9302 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectiveAbilityBtnType` | 9367 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `estimateMultiplierFromSkillDescription` | 9381 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerAtkForDamagePreview` | 9408 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectivePlayerOffensiveAtkForPreview` | 9417 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerOffensiveMatkForPreview` | 9420 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPackRowScaleStatRaw` | 9424 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `packRowScaleContribution` | 9437 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `registerStrikePreviewForBird` | 9446 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getStrikePreviewMultiplierForAbility` | 9461 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getHybridPreviewSpec` | 9472 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateHybridSplitBands` | 9500 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateSkillDamageRange` | 9564 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `snowyOwlEyeStatPreviewLines` | 9777 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `snowyOwlGlideStatPreviewLines` | 9792 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `_previewPickArrayFromSource` | 9973 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGenericUtilityStatPreviewFromAction` | 9984 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillStatPreviewLines` | 10046 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildActionTooltipHTML` | 10063 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showActionTooltip` | 10147 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltip` | 10157 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `moveTooltip` | 10170 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showTooltip` | 10206 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideTooltip` | 10217 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbDesc` | 10225 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityCooldown` | 10237 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getClassCooldownAdjustment` | 10241 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDirectHealingAbility` | 10263 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getTemplateCooldown` | 10279 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setAbilityCooldown` | 10294 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `reduceOtherSpellCooldownsOnCast` | 10299 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeAbilityCooldownsForPlayer` | 10320 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getPlayerPiercePctForAbility` | 10331 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerClassRole` | 10342 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getClassPerkTriggerForCurrentStage` | 10346 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `resumeAfterGrove` | 10360 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `continueStageTransitionAfterRewards` | 10370 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openClassPerkChoice` | 10465 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `maybeOfferClassPerkChoice` | 10501 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyPassiveEvolutionChoice` | 10510 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `maybeOfferPassiveEvolutionChoice` | 10528 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyOpeningStrikePassiveOnTurnStart` | 10567 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCrowDefendCooldown` | 10573 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `logAspectMatchupFeedback` | 10579 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getAspectDefinition` | 10589 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `formatAspectDisplayName` | 10596 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildAspectTooltipHTML` | 10604 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resolveAbilityAspectForDisplay` | 10619 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildAspectChartSvg` | 10628 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `logMsg` | 10675 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playAvatarAnim` | 10688 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spawnFloat` | 10704 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `flashPanel` | 10744 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doAttack` | 10753 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doMiss` | 10806 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doShield` | 10815 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doSpell` | 10822 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doHeal` | 10823 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `delay` | 10834 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `roll` | 10842 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerBaseAcc` | 10855 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeaponPrecisionModifier` | 10868 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillPrecisionModifier` | 10886 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getFinalAttackPrecision` | 10904 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccMod` | 10948 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerEffectiveAcc` | 10957 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveActionPrecisionPct` | 10964 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `clamp01` | 10974 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getPostBattleHealPct` | 10981 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `shouldApplyPostBattleHealNow` | 10985 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPostBattleHealIfDue` | 10992 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `softenMainStatForCombat` | 11014 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `effectiveDodgePercentForCombat` | 11022 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `damageMitigationMultiplierFromGuard` | 11029 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `physicalGuardValueFromEnemyDef` | 11033 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `magicalGuardValueFromEnemyMdef` | 11040 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `physicalGuardValueFromPlayerDef` | 11047 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `magicalGuardValueFromPlayerMdef` | 11053 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerArmorPenPct` | 11059 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPlayerMagicPenPct` | 11065 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPhysicalPierceFractionForDamage` | 11075 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getMagicalPierceFractionForDamage` | 11085 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPhysicalPierceFractionForPreview` | 11098 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getMagicalPierceFractionForPreview` | 11110 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcHitChance` | 11119 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcDefenseMultiplier` | 11128 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGrowthStageTransition` | 11133 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkGrowthStage` | 11169 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyBaseStats` | 11200 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTier` | 11223 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getEndlessEffectiveBattleNumber` | 11251 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEndlessDifficultyLevelOffset` | 11256 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getEndlessNormalFightTier` | 11281 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollRandomAnyMutationTiers` | 11289 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getStoryMutationRewardTiers` | 11298 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveMutationRewardTiers` | 11322 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeMutationDataTier` | 11345 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `pickUniqueMutationReward` | 11350 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildMutationRewardPool` | 11368 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `computeEnemyEffectiveLevel` | 11376 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStoryEnemyPowerMultiplier` | 11390 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `combatResolveEnemyTier` | 11399 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildScaledEnemy` | 11412 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildScaledBoss` | 11494 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyScaleFactor` | 11499 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEffectiveDodge` | 11513 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `chance` | 11534 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `addStatus` | 11537 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setStatusMax` | 11538 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshStatus` | 11540 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGuardedPhysReducPct` | 11542 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGuardedBuff` | 11550 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getTierBuffPct` | 11574 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveShieldAmountFromOpts` | 11580 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyShieldHp` | 11592 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applyDamageThroughShield` | 11615 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `notifyProtectionHitHooks` | 11668 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickShieldHpStatus` | 11687 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickGuardedStatus` | 11712 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playerIsGuarding` | 11718 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveGuardedReductionPct` | 11724 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshDerivedStatsAfterLoan` | 11737 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applySourceStatLoan` | 11747 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `decaySourceStatLoans` | 11764 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applySourceStatLoanPct` | 11781 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `clamp` | 11792 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `clampSkipChance` | 11793 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getWeakenStacks` | 11798 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeakenDamageMult` | 11805 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getWeakenDodgePenalty` | 11810 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyWeakenStack` | 11814 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectiveEnemyDodgeForPlayerHit` | 11824 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `scaleHealForBleed` | 11833 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeBurningTurns` | 11846 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `enemyHasBurning` | 11852 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHasBurning` | 11859 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToTarget` | 11866 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToEnemy` | 11891 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalStackAilment` | 11895 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalResolvedState` | 11927 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollStunChance` | 11963 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyEnemySlow` | 11964 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPendingStrikeBuff` | 11987 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerTimedBuff` | 12003 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `promotePendingStrikeBuffToActive` | 12016 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerSlow` | 12029 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshEnemyStrikerDodgeMark` | 12043 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAbilityLifestealPct` | 12055 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolveAbilityCombatRow` | 12073 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `detectEquipmentDamageBonus` | 12084 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `computeMasterOutgoingDamage` | 12092 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `computeOutgoingDamageBase` | 12188 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `collectDispatcherConditionalBonusFractions` | 12237 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `collectOutgoingDamageBonusFractions` | 12267 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLifestealFromDamage` | 12383 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyAbilityAuthoredEnCost` | 12394 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeEntityAbilityRawDamage` | 12400 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCurvedMitigationToPlayer` | 12460 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerCritDamageAdd` | 12486 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `dealDamage` | 12528 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmg` | 12926 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countEnemyCombatDebuffCategories` | 12954 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `countAilmentCategoriesOnEnemy` | 12973 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHasAfflictionForCardBonuses` | 12993 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `selfDodgeBuffActive` | 12996 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeSecondaryStatFlatForPhysical` | 13000 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyConditionalPhysicalDamageMultipliers` | 13013 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmgWithAlternateScaling` | 13032 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDamageScalingHintForUI` | 13043 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `calcEnemyAbilityDamage` | 13049 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyBossBurstBuffer` | 13058 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `edmg` | 13069 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollEnemyCritDamage` | 13085 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerMissChance` | 13099 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitPercentForAttack` | 13142 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccuracy` | 13160 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolvePlayerAttackHit` | 13170 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAttackMisses` | 13188 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doPlayerAttackMiss` | 13191 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerDmgMult` | 13201 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAilChance` | 13207 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `tryApplyAilment` | 13230 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDelayedDmgBoostPct` | 13248 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDelayedDamage` | 13255 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `tryMutationOnHitAilments` | 13283 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `notifyAilmentApplied` | 13302 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyAilment` | 13316 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerCritChance` | 13575 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitBonus` | 13608 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickDelayedForTarget` | 13620 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickStatuses` | 13637 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveAbilityAliasSourceId` | 13683 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerAbilityAlias` | 13689 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerStrikePreviewForBird` | 13690 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStarterKitEnergySmoothing` | 13693 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `checkBlackbirdOmenChorusAfterAbility` | 13696 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAction` | 13709 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startPlayerTurn` | 13962 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyEnergyForBattleDisplay` | 14058 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `startEnemyTurn` | 14065 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isSpellAbilityId` | 14083 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isMultiHitAbility` | 14088 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAuthoredEnergyCost` | 14100 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAttackWeight` | 14130 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityEnergyCost` | 14138 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnergyCost` | 14176 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncAbilityEnergyCost` | 14180 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseAbility` | 14184 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `spendEnergy` | 14199 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `enforceAbilityCosts` | 14211 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `gainEnergy` | 14219 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `spellMissChance` | 14239 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellMisses` | 14247 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `summonHitLands` | 14252 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellAilmentRoll` | 14256 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `matk` | 14264 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickTimedBuffsAfterEnemyPhase` | 14511 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `endPlayerTurn` | 14694 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyActionEnergyCost` | 14748 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAIPersonalityProfile` | 14775 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyAIMemory` | 14784 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyKitAbilityForEnemyAI` | 14791 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitOffersSetupDebuffs` | 14806 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyMode` | 14812 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyEnemyActionCategory` | 14821 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyActionPool` | 14835 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `projectedEnemyActionDamage` | 14880 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `canEnemyProjectLethal` | 14923 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getBossIntentCycle` | 14947 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEnemyArchetype` | 14952 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getArchetypeIntentWeights` | 14963 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypePriorityOrder` | 14966 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypeCategoryBonus` | 14974 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectEnemyIntent` | 14981 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `filterEnemyActionsByIntent` | 15017 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEnergySpendCap` | 15027 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyOpeningBias` | 15040 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyActionComboBonus` | 15050 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHpPct` | 15063 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHpPct` | 15064 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `mapAiStyleToType` | 15065 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `planEnemyAction` | 15073 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isBossEnrageAllowed` | 15088 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeNightfall` | 15089 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRiverGrip` | 15095 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTrackDecree` | 15101 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeApplyDecreePunish` | 15106 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRoyalDecree` | 15113 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeOwlsVerdict` | 15118 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeSummonCourt` | 15124 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTurnAI` | 15134 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitAbilityIsHardCC` | 15185 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollEnemyCombatRowAilment` | 15193 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refundEnemyActionEnergy` | 15229 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyAttackRiders` | 15236 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `executeEnemyKitTemplateAbility` | 15251 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTurn` | 15375 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `afterEnemyTurn` | 15512 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `showBattleCaption` | 15589 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDeath` | 15600 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isGreyShopStage` | 15628 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `isShopDueAfterBattle` | 15638 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getBattleStatsSafe` | 15649 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `postCombat` | 15658 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `rollTier` | 15832 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isMutationReward` | 15841 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isEquipmentReward` | 15845 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applySingleReward` | 15849 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `finishRewardScreenFlow` | 15892 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantRewardPool` | 15946 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `drainPendingRewardQueue` | 15961 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildNestRewardCardHtml` | 15968 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `spawnNestShakeSparks` | 15991 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestRewardTrayTooltips` | 16019 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `renderNestRewardCollectedTray` | 16038 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `finishNestRewardReveal` | 16058 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealNestDropsStaggered` | 16081 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `revealAllNestDrops` | 16142 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showStoryEquipmentPick` | 16146 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `handleNestShake` | 16197 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `showRewardScreen` | 16224 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmReward` | 16317 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyUpgradeWithMaxHpHealing` | 16415 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGoldReplaceUI` | 16435 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateNormalRewards` | 16464 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `generateBossRewards` | 16468 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollWeighted` | 16472 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardCount` | 16480 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGoldCardLimit` | 16481 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpBaseHealthGrowth` | 16491 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `levelUpChoiceLabel` | 16514 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpVitalityGain` | 16521 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyLevelUpAgilityGain` | 16551 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isMainAttackAbility` | 16579 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getMainAttackAutoLevel` | 16590 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyMainAttackAutoLevel` | 16597 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollLuFeatherPanelOptions` | 16621 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeatherDraftTotal` | 16630 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeathersUnallocated` | 16634 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `captureLuStatBaseline` | 16638 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `simulateLuDraftStats` | 16655 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `formatLuPreviewDelta` | 16696 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `renderLuFeatherIcons` | 16703 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuFeatherStatline` | 16711 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuStatPreview` | 16728 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshLuFeatherPanelUI` | 16761 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildFeatherStatPanel` | 16812 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLevelUpStatEffectDesc` | 16865 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEquippedWeaponAvgDamage` | 16882 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getOffencePctPerStat` | 16903 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateMitigationPct` | 16908 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateWeaponSkillDamagePerStat` | 16914 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpPerPointBreakdown` | 16920 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getLevelUpCombatImpactLine` | 16994 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpGlossaryBlurb` | 16999 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luStatKeyForOption` | 17008 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLuFeatherStatValue` | 17015 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildLevelUpStatTooltipHtml` | 17021 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireLevelUpTooltips` | 17066 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resetLuFeatherDraft` | 17094 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `ensureMainAttackAndLoadoutRules` | 17101 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setLevelUpPanelTitle` | 17173 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpConfirm` | 17177 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpSecondary` | 17184 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetLevelUpFlowState` | 17191 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLevelUpScreen` | 17196 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLUPanel` | 17222 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `countLevelAilments` | 17229 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ailmentSlotsForLevel` | 17232 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `deriveAbilityAilments` | 17236 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openAbilityModificationChoice` | 17257 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbilityModModal` | 17283 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshPlayerAbilityAilments` | 17291 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `confirmSkillUpgrade` | 17298 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `onExitLevelUpRequested` | 17341 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `afterLevelUp` | 17365 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `advanceStage` | 17376 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBossStage` | 17399 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollGroveMutationTier` | 17406 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveGearReward` | 17416 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyGroveGearReward` | 17422 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGroveRewardCard` | 17441 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveNestReward` | 17455 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `startGroveAmbushBattle` | 17459 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `showGroveEvent` | 17508 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `enterGrove` | 17546 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `resolveGrove` | 17559 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `groveFinish` | 17672 | Endless/Meta | Yes (data-action in index.html) | Medium | js/systems/endless-map.js |
| `pickRandom` | 17681 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `showVictory` | 17683 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showDefeat` | 17747 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `flightRescuedNestCount` | 17779 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showRunStats` | 17784 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideStoryCinematic` | 17809 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startStoryCinematic` | 17814 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getAudioCtx` | 17860 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeAudioIfNeeded` | 17865 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundButtonLabel` | 17871 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundStateFromSettings` | 17880 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `toggleSound` | 17885 | Audio | Yes (data-action in index.html) | Medium | js/audio/bgm-shared.js |
| `playTone` | 17901 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doScreenShake` | 17943 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetBattleStats` | 17956 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getBattleSummaryStats` | 17957 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderBattleSummary` | 17971 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `updateStageProgress` | 17985 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveRunHistory` | 18101 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderRunHistory` | 18114 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refAbilityEnergyCost` | 18154 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityCodexType` | 18163 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityPassesEnFilter` | 18169 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRefFilterBarHtml` | 18179 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireRefFilterSelects` | 18211 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRefGuideModal` | 18242 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRefGuideModal` | 18250 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `toggleRefGuide` | 18258 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectRefTab` | 18265 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `skillCard` | 18271 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refSkillScalingLabel` | 18290 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildRefGuide` | 18297 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderReferenceGuide` | 18493 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkRunUnlocks` | 18503 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `showUnlockToast` | 18510 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeUtilityOffer` | 18527 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `assignShopItems` | 18533 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopItemsToGlobal` | 18537 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `showStorkShop` | 18547 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `enterStorkShopScreen` | 18552 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopMutationTierKey` | 18589 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `ensureShopMutationTierOpenState` | 18595 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopMutationTierSections` | 18600 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `resolveShopItemCategory` | 18634 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopGearCategoryTitle` | 18643 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopItemMatchesCategory` | 18647 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopCategoryLogText` | 18660 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `clearShopSelection` | 18674 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBaseCost` | 18681 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBuyCost` | 18687 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedBuyTotal` | 18691 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopMarginalBuyCost` | 18706 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRemainingBudget` | 18714 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedSellTotal` | 18718 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopDock` | 18727 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopBuyButtonState` | 18755 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopSellButtonState` | 18765 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopSectionHeading` | 18775 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopBuyCard` | 18782 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `setShopTab` | 18817 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getEquipmentSellPrice` | 18866 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getMutationSellPrice` | 18873 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderShopSellItems` | 18880 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSellSelected` | 18926 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSlotIsStarterLocked` | 18958 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopEquipped` | 18962 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopUnequipSlot` | 19009 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `rollShopTier` | 19032 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `pickUniqueRewardByTier` | 19037 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `_findShopItemById` | 19047 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `generateShopItems` | 19067 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopResetVisitState` | 19143 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopLockVisitState` | 19153 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRefreshCost` | 19157 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopItems` | 19162 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `purchaseShopItemAtIndex` | 19234 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopBuySelected` | 19279 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopRefresh` | 19334 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `exitStorkShop` | 19349 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `openAbandonModal` | 19396 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbandonModal` | 19399 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmAbandon` | 19406 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `unlockAllCodexEntries` | 19432 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isCreatorCodesEnabled` | 19482 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeSwitches` | 19483 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isDevCodeEnabled` | 19486 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveDevCodeSwitches` | 19487 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setDevCodeSwitch` | 19490 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeCatalogRow` | 19496 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyBirdwatchingUnlock` | 19500 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyHeadingHomeLock` | 19506 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `setGoldenGooseInfiniteState` | 19517 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `toggleDevCode` | 19523 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshAfterDevCode` | 19528 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `activateDevCode` | 19535 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `deactivateDevCode` | 19609 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDevCodeSwitches` | 19643 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `renderSuppliesCodeTools` | 19674 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderSuppliesActivityLog` | 19689 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setOwnedBirdTier` | 19695 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isKnownDevCodePrefix` | 19699 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDevCode` | 19704 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBgmApi` | 19761 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmAudio` | 19762 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMenuPreviewBgmAudio` | 19763 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmTargetVolume` | 19764 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopBattleBgmImmediate` | 19768 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeOut` | 19776 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeIn` | 19797 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryStartBattleBgmIfNeeded` | 19817 | Audio | No (internal) | High | js/audio/bgm-shared.js |
| `stopMenuPreviewBgmImmediate` | 19838 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuPreviewActive` | 19844 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuScreen` | 19848 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `setAudioElTrack` | 19852 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `resolvedMusicTrackIdForRole` | 19868 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuNowPlaying` | 19875 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMusicMenuAssignmentChips` | 19886 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuControls` | 19906 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyMusicPanelVolumeState` | 19923 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelVolume` | 19945 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelMuted` | 19949 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicRoleChoice` | 19954 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMenuThemeForPreview` | 19974 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playMusicMenuPreview` | 19979 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMusicMenuPreview` | 20003 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `openMusicMenu` | 20020 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `closeMusicMenu` | 20029 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `cancelThemeBgmFade` | 20038 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginThemeBgmFadeOutForRunStart` | 20047 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMusicSettings` | 20071 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `saveMusicSettings` | 20085 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `getThemeBgmAudio` | 20093 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBattleBgmAudio` | 20096 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `cancelDukeBgmFade` | 20099 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBgmTargetVolume` | 20107 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeDukeBattleBgmAudio` | 20112 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgmImmediate` | 20118 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgm` | 20125 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `duckThemeBgmForBattle` | 20128 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeIn` | 20135 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeOut` | 20164 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isDukeStoryBossFight` | 20197 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `tryStartDukeBattleBgmIfNeeded` | 20206 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeThemeBgmAudio` | 20227 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryPlayThemeBgmForCurrentMenuScreen` | 20233 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyDukeBattleBgmToAudioEl` | 20246 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyThemeMusicToAudioEl` | 20254 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopAllGameAudio` | 20279 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncThemeMusicButtonLabels` | 20292 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncThemeBgmPlaybackForScreen` | 20305 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `toggleThemeMusicMuted` | 20319 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 20336 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `wireThemeBgmAutoplayUnlock` | 20356 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `detectPreferredUIMode` | 20394 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveUiMode` | 20400 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeCombatCustomLayout` | 20424 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetCombatCustomDraft` | 20445 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatCustomDraft` | 20448 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeCombatArrangement` | 20455 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeCombatLayout` | 20461 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAccessibilitySettings` | 20472 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getAccessibilitySettings` | 20498 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `bootstrapAccessibilityDefaults` | 20506 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireUiAutoDetectResize` | 20530 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAudioVolumeMultipliers` | 20548 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `selectSettingsTab` | 20556 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyUIStateToDOM` | 20570 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAutoCombatDensityReduction` | 20581 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyEffectiveCombatScales` | 20588 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyCombatLayoutSettings` | 20607 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `clearCombatCustomPanelStyles` | 20611 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatCustomPanels` | 20619 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatCustomEditRow` | 20631 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderCombatCustomPanelEditor` | 20640 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatCustomLayoutModal` | 20694 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatCustomLayoutModal` | 20700 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `saveCombatCustomLayoutFromModal` | 20705 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `resetCombatCustomLayoutDraft` | 20716 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `toggleCombatCustomPanelVisible` | 20720 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `moveCombatCustomPanel` | 20727 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatArrangement` | 20746 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatLayoutLabels` | 20760 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncAudioSettingLabels` | 20770 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncUiModeControls` | 20782 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyAccessibilitySettings` | 20797 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openSettingsModal` | 20819 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeSettingsModal` | 20871 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `returnToWarRoomFromSettings` | 20875 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openAbandonFromSettings` | 20881 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `goMainMenuFromSettings` | 20886 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetCombatLayoutSettings` | 20897 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `updateAccessibilitySettings` | 20909 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAudioSettingsFromControls` | 20955 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 20981 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |

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
