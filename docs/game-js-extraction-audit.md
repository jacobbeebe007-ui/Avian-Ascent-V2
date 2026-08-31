# game.js Extraction Audit (Step 7)

Generated: 2026-08-31  
Source: `js/core/game.js`  
**Before Step 7:** 19896 lines  
**Functions:** 900 top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
| Bootstrap/Orchestration | 227 | 🔁 Retain in game.js |
| Enemy setup/AI | 109 | ⬜ Phase 7 |
| Combat | 103 | ⬜ Phase 8 |
| Story/Overworld | 77 | ⬜ Phase 6 |
| Combat UI | 76 | ⬜ Phase 3 |
| Audio | 56 | ⬜ Not started |
| Bird selection | 46 | ⬜ Not started |
| Rewards | 42 | ⬜ Phase 5 |
| Shop | 41 | ⬜ Phase 5B |
| Utilities | 24 | ✅ Phase 1 (game-helpers.js) |
| Nest | 24 | ⬜ Not started |
| Equipment | 24 | ⬜ Not started |
| Class/Passive | 19 | ⬜ Not started |
| Save/load | 19 | ⬜ Not started |
| Endless/Meta | 8 | ⬜ Not started |
| Build Nest | 5 | ⬜ Phase 4 (partially in map-forge.js) |

## Extraction rules (summary)

1. Extract by system boundary, not line count.
2. Preserve `window` / `Avian.actions` / `data-action` compatibility.
3. Update `js/bootstrap/load-order.json` for every new module.
4. Run `npm test` after each phase.

## Function inventory

| Name | Line | Category | Global | Risk | Suggested destination |
|------|-----:|----------|--------|------|----------------------|
| `runPassiveIntegrityAudit` | 101 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `inferAIPersonalityFromStyle` | 128 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `inferEnemyClassFromStyle` | 145 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `makeEnemy` | 155 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDukeAbilityEnCost` | 190 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildDukeStoryBossEnemy` | 193 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeDukeBlakiston` | 218 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBiomeForStage` | 288 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyBiomeModifiers` | 295 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollRarity` | 308 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatStat` | 316 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatMaxHp` | 320 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgGoldenFeather` | 326 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countUpgradeAcquisitionsThisRun` | 342 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isUpgradeBlockedByRunAcquisitionCap` | 345 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `upgradeEligibleForRewardPick` | 354 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getUpgradePool` | 362 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ledgerStatLabel` | 366 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `cloneStatLedgerSlice` | 421 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `ensureStatLedger` | 430 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `reapplyPlayerGearStats` | 451 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `initStatLedgerForNewRun` | 457 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `syncBirdBaselineFromCatalog` | 471 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStatLedgerAfterLoad` | 496 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `mergeStatDeltaIntoBucket` | 519 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `recordUpgradeApplyInLedger` | 535 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildStatBreakdownTitle` | 551 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `equipmentPctLedgerKey` | 565 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquippedStatSources` | 569 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatModifierLines` | 583 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `richTooltipCloseBtn` | 599 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdPassiveInfo` | 603 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdAuthoredClassPerk` | 613 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildPassiveTooltipHTML` | 634 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getMutationDescHtml` | 644 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildMutationTooltipHTML` | 645 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEquipmentItem` | 646 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquipmentSkill` | 649 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `itemHasDisplayableWeaponDamage` | 653 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `formatEquipmentStatsHtml` | 662 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatAnyStatLabel` | 690 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `formatEquipmentSkillsHtml` | 714 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEquipmentTooltipHTML` | 728 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildRichStatTooltipHtml` | 765 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyMutationStatSources` | 815 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEntityAspectTooltipHtml` | 839 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getPlayerEquippedMutationIds` | 862 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildPlayerBirdTooltipHtml` | 864 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildClassLabelTooltipHtml` | 881 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyMutationsTooltipHtml` | 896 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyRichStatTooltipHtml` | 924 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `tooltipsEnabled` | 947 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showRichTooltipHtml` | 951 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltipNearEl` | 960 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindHoldRepeat` | 979 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindRichTooltip` | 1014 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireNestMutationTooltips` | 1054 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestEquipmentTooltips` | 1062 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestAbilityTooltips` | 1071 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireCombatStatTooltips` | 1090 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatClassLabelTooltips` | 1102 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatEnemyStatTooltips` | 1120 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyMutationTooltips` | 1131 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wirePlayerAvatarInteractionOnce` | 1136 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getDerivedMechanicalBonusLines` | 1151 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isEndlessRunActive` | 1247 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getPassiveEvolutionDefinition` | 1260 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `ensurePassiveEvolutionState` | 1277 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveEvolutionBonuses` | 1287 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveDefMdefBonuses` | 1299 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `rollEndlessReward` | 1309 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyEndlessProgressionMilestones` | 1316 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `rollUpgradeCard` | 1320 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ensureClassPerkState` | 1334 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `normalizeClassPerkIdList` | 1341 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getBirdClassRoleByKey` | 1345 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdClassPerks` | 1349 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `hasClassPerk` | 1355 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkGrantCountForMode` | 1359 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkCapForMode` | 1369 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getAvailableClassPerksForBird` | 1373 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyClassPerksToStats` | 1380 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyClassPerksToCombatContext` | 1393 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `recomputeClassPerkEffects` | 1421 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkBuffDurationBonus` | 1427 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkSongHealFlat` | 1432 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `grantClassPerk` | 1437 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `makeAbilityLevelData` | 1476 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `makeEvolutionAbilityTemplate` | 1485 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enforceAbilityBalanceSpec` | 1603 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeAbilityEnergy` | 1643 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAllAbilityEnergy` | 1658 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAbilityTemplates` | 1742 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `removeMimicEverywhere` | 1786 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getUnlocks` | 1820 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `grantUnlock` | 1823 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isUnlocked` | 1826 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getPlayableStarterBirdKeys` | 1827 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `collectAllBirdUnlockIds` | 1836 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `isBirdUnlockedForSelect` | 1844 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getActiveOwNodesForProgress` | 1851 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryMaxStage` | 1856 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `queueUnlockBanner` | 1893 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `handleBossClearUnlocks` | 1898 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderUnlockPopupsOnGameover` | 1921 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkSecretUnlockChar` | 1944 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `expForLevel` | 1974 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `threatTierExpMultiplierForEnemy` | 1995 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `baseExpForEnemyLevel` | 1999 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `relativeLevelExpMultiplier` | 2008 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `stageExpMultiplier` | 2021 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeNormalEnemyExpGain` | 2030 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeBossExpGain` | 2046 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getGrowthStageForLevel` | 2084 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeBirdSizeForEnergy` | 2113 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getEnergyProfile` | 2124 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getEnemyEnergyProfile` | 2128 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computePlayerEffectiveMaxEnergy` | 2134 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerMaxEnergy` | 2144 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerStartEnergy` | 2148 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegen` | 2154 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegenThisTurn` | 2159 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerGameModule` | 2202 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `runModuleHook` | 2206 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `initDataPacks` | 2217 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `ensureUIState` | 2325 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerHit` | 2354 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerMiss` | 2355 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `triggerPassive` | 2360 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `renderPassiveBadge` | 2365 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatAbilityLevelPathway` | 2382 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `isStoryBattleNestEquipLocked` | 2392 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `notifyStoryBattleNestEquipLocked` | 2396 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `getEquipmentNestSlotLabel` | 2407 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `equipmentHandBadgeHtml` | 2411 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentStatChipLabel` | 2419 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentCompactStatsHtml` | 2435 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `needsUltimateSourcePick` | 2464 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setPlayerUltimateSourceItemId` | 2470 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildNestUltimateBankHtml` | 2485 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `buildNestUltimatePickerHtml` | 2515 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `equipmentSlotIconForItem` | 2519 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `grantPlayerEquipmentItem` | 2528 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_nestInvCompareHtml` | 2547 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestEquipmentItemHtml` | 2566 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSectionV2` | 2588 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `handleNestEquipmentClick` | 2668 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `selectNestTab` | 2710 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `organizeNestSections` | 2729 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestAbilitySection` | 2757 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `resetNestChrome` | 2805 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildEnemyNestEquipmentSection` | 2812 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyNestAbilitySection` | 2859 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyNestProfileHtml` | 2928 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyNestAbilityTooltips` | 2981 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `fillEnemyNestHeader` | 2990 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openEnemyNest` | 3014 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openNest` | 3035 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `notifyOwUiEmbedClose` | 3210 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `closeNest` | 3217 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `getNestSlotIcons` | 3230 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `readNestMutCompareMode` | 3233 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `setNestMutCompareMode` | 3242 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestInventoryMutStatsHtml` | 3246 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestMutationItemHtml` | 3248 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `handleNestEquipClick` | 3250 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSection` | 3277 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `bootstrapOwNestEmbed` | 3288 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `bootstrapOwSettingsEmbed` | 3311 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwReferenceEmbed` | 3323 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwUiEmbed` | 3335 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `codexMark` | 3344 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCardTierSlotCount` | 3364 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyPlayerSkillsFromCardTier` | 3376 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isSkillSlotUnlocked` | 3387 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `clampLockedSkillSlots` | 3394 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildFamilySkillAbilityLookup` | 3403 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getFamilyEvolutionBirdDataStore` | 3420 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getBirdFamilyEvolutionData` | 3426 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdSkillFamilyCatalog` | 3429 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `usesFamilySkillEvolution` | 3432 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `createSkillSlotState` | 3435 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBaseSkillSlotsForBird` | 3442 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getFamilyEvolutionAbilityStateFromId` | 3454 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getSkillSlotFamilyDef` | 3466 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillSlotDisplayLabel` | 3474 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeSkillSlotState` | 3480 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getSkillSlots` | 3491 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getSkillSlotByIndex` | 3494 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilitySkillSlot` | 3497 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureAbilityObjectFromTemplate` | 3503 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncPlayerAbilitiesFromSkillSlots` | 3525 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `consumePendingEquipmentV2MigrationCompensation` | 3571 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `stashEquipmentV2MigrationNotice` | 3591 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `applyEquipmentLoadoutSanitizationOnLoad` | 3598 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `finalizeEquipmentV2PreReleaseReset` | 3615 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `ensureFamilyEvolutionState` | 3626 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `_isValidOverworldEnemySeedPack` | 3648 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `saveRun` | 3651 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `loadSaveData` | 3729 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `deleteSave` | 3749 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearDevCodeAccess` | 3754 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `reloadShellHttpCache` | 3772 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `cacheBustReload` | 3791 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearGameCache` | 3801 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearAllProgress` | 3833 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openEraseProgressModal` | 3869 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeEraseProgressModal` | 3872 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `openClearCacheModal` | 3875 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeClearCacheModal` | 3878 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmClearCache` | 3881 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmEraseProgress` | 3896 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `continueRun` | 3909 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `goMainMenu` | 4106 | Enemy setup/AI | Yes (data-action in index.html) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isOwUiEmbedMode` | 4116 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOwTransientKeys` | 4120 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `navigateTopToMainMenu` | 4129 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `flyAgain` | 4153 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEncounterStage` | 4187 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStageEncounterChainLength` | 4193 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `hasMultiEnemyChainPending` | 4200 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetStageBattleStats` | 4208 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `accumulateStageBattleStats` | 4213 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `continueToNextEncounterBird` | 4236 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterDrafts` | 4251 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDukeEncounterToken` | 4270 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rerollNonDukeStageEnemy` | 4276 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildOwEnemyDraftFromBirdKey` | 4284 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionProfileId` | 4330 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `shiftEnemyProgressionTier` | 4341 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveStoryLevelFromStage` | 4349 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionTier` | 4367 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveEnemyWorkbookLevel` | 4402 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTotalStars` | 4430 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyStatsFromPlayerProgression` | 4444 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `mergeScaledStatsIntoEnemy` | 4625 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterMaterialized` | 4757 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyKitAbilityIds` | 4774 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEquipmentActionSources` | 4786 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `isEnemyUltimateMeterReady` | 4791 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEnemyEquipmentActionAvailable` | 4800 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEnemyAbilityDisplayLabel` | 4807 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillNames` | 4817 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillKeys` | 4847 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevel` | 4862 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevelLine` | 4870 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyInfoPopupAbilitiesHtml` | 4875 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeEnemyInfoPopup` | 4930 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openEnemyInfoPopup` | 4938 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatEquipmentEffectSummaryHtml` | 4943 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyInfoPopupMutationsHtml` | 4959 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyInfoEquipmentTooltips` | 4994 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `wireEnemyInfoPopupOnce` | 5004 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCurrentStageEncounterPreviewData` | 5019 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyAbilityTooltipHtml` | 5035 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEncounterPreviewTooltipHtml` | 5085 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `ensureEnemyPreviewEquipmentState` | 5126 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `buildEncounterPreviewEquipmentHtml` | 5177 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_initEncounterPreviewCollapse` | 5203 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderEncounterPreview` | 5223 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `terrainStringToArenaId` | 5283 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveBattleArenaId` | 5307 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `battleArenaImagePaths` | 5314 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `updateBattleArena` | 5324 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncBattleLogDrawerCollapse` | 5358 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `initBattleLogDrawer` | 5371 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getStoryEnemyLevelBand` | 5393 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEvolvedSlotCount` | 5405 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getOwEnemySkillDepthFromTierBand` | 5410 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `materializeEnemyFamilySkillSlots` | 5419 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollInt` | 5433 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `pickRandom` | 5434 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `weightedPick` | 5435 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classGrowthWeightsForStory` | 5442 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `buildStoryEnemyFromBirdKey` | 5451 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateStoryStageEnemyKeys` | 5578 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `commitStoryEncounterMeta` | 5608 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyEnemyFeatherFromPlayerMirror` | 5627 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyStoryEnemyGrowth` | 5665 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncStoryEncounterBirdQueue` | 5700 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showNextStagePreview` | 5753 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `initSelection` | 5786 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `buildRosterFilterSelect` | 5819 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `syncRosterFilterSelect` | 5836 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `onRosterFilterChange` | 5849 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildSelectionViewButtons` | 5863 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildLockFilterButtons` | 5864 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setRosterMode` | 5866 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setLockFilter` | 5875 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGameModeToggle` | 5883 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setGameMode` | 5901 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classToRoleId` | 5909 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `migrateLegacySelectionView` | 5912 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `idToClassLabel` | 5922 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireRefGuideClicks` | 5926 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderStarterFallbackGrid` | 5940 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `initSelectionSafe` | 5969 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `formatDifficultyMult` | 6023 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `buildDifficultyPicker` | 6029 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectDifficulty` | 6074 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `setSelView` | 6080 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildBirdGrid` | 6089 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderBirdCardStarsHtml` | 6253 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdSpeciesRarityMeta` | 6262 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildBirdCard` | 6272 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `setCharacterSelectView` | 6323 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `backToCharacterSelectBirds` | 6349 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `selectBird` | 6366 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `mutateBirdCardSelect` | 6380 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `__normSpriteKey` | 6407 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `__hasSpriteKey` | 6408 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rosterCanonBirdKey` | 6414 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `runtimeSizeFromProfileToken` | 6430 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `profileSizeTokenForEntity` | 6455 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `rosterSizeForEntity` | 6466 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getUISizeClass` | 6470 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `normalizeSpriteBirdKey` | 6481 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `neutralBirdFallbackHTML` | 6492 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wrapSpriteFaceLeft` | 6495 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `wrapEnemySpriteIfNeeded` | 6498 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureBattleEnemyFacing` | 6504 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderBirdIconHTML` | 6512 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderEntityAvatarHTML` | 6527 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getFlightSettingsSummary` | 6532 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncFlightSettingsBriefing` | 6550 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSfselRunSummary` | 6565 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSelectTakeFlightButton` | 6575 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `escapeHtmlRoster` | 6588 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `rosterAbilityBlurb` | 6595 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityBlurbForTemplate` | 6607 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRosterPreviewStubForBirdKey` | 6618 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `rosterPreviewSlotTag` | 6636 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKit` | 6644 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKitForCardProgress` | 6670 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `birdUpgradeTierMeta` | 6693 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStarsHtml` | 6701 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildBirdUpgradePreviewModel` | 6706 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeReasonText` | 6785 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `formatBirdUpgradeStatValue` | 6793 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStatRowsHtml` | 6799 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilityLabel` | 6808 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilitiesHtml` | 6814 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `renderBirdUpgradePreviewModal` | 6832 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openBirdUpgradePreview` | 6884 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `closeBirdUpgradePreview` | 6892 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmBirdUpgradePreview` | 6903 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openRosterChampionModal` | 6953 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRosterChampionModal` | 6954 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `_setSfselEmptyState` | 6958 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAscentPanel` | 6964 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startSelectedBird` | 7144 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `beginRun` | 7149 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCombatItemMaxHold` | 7157 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerIsKnightClass` | 7165 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `createDefaultCombatItems` | 7170 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureCombatItems` | 7174 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatItemCount` | 7184 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canAddCombatItem` | 7189 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `addCombatItem` | 7195 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatItemShopOffer` | 7206 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `launchStoryOverworld` | 7229 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startGame` | 7273 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `makeEndlessEnemy` | 7394 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEndlessMapActive` | 7420 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `showEndlessMap` | 7425 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `endlessMapSelectNode` | 7460 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `grantEndlessMapTreasure` | 7526 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `finishEndlessMapAfterCombat` | 7546 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `returnToEndlessMapFromSideRoom` | 7584 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `setSuppliesSubView` | 7599 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncMissionMapVariantTabs` | 7635 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapPickerVisibility` | 7656 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapLabel` | 7661 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshMissionTestMapSelect` | 7685 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openSelectHubPanel` | 7751 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRunSettings` | 7807 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmRunSettings` | 7810 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `closeSelectHubPanel` | 7815 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `takeFlightToSelect` | 7835 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `scrollToSelectRoster` | 7844 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `showScreen` | 7849 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `installLegacyErrorHUD` | 7898 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `installErrorHUD` | 8049 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDisplayTags` | 8078 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityTypeChipLabel` | 8082 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isPlayerAbilityUsable` | 8088 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerHasAffordableAbility` | 8099 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseCombatItem` | 8108 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `useCombatItem` | 8117 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityTemplateForUI` | 8149 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectiveAbilityBtnType` | 8214 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `estimateMultiplierFromSkillDescription` | 8228 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerAtkForDamagePreview` | 8255 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectivePlayerOffensiveAtkForPreview` | 8264 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerOffensiveMatkForPreview` | 8267 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPackRowScaleStatRaw` | 8271 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `packRowScaleContribution` | 8284 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `registerStrikePreviewForBird` | 8293 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getStrikePreviewMultiplierForAbility` | 8308 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getHybridPreviewSpec` | 8319 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateHybridSplitBands` | 8347 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateSkillDamageRange` | 8411 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `snowyOwlEyeStatPreviewLines` | 8624 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `snowyOwlGlideStatPreviewLines` | 8639 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `_previewPickArrayFromSource` | 8820 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGenericUtilityStatPreviewFromAction` | 8831 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillStatPreviewLines` | 8893 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildActionTooltipHTML` | 8910 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showActionTooltip` | 8994 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltip` | 9004 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `moveTooltip` | 9017 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showTooltip` | 9053 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideTooltip` | 9064 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbDesc` | 9072 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityCooldown` | 9084 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getClassCooldownAdjustment` | 9088 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDirectHealingAbility` | 9110 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getTemplateCooldown` | 9126 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setAbilityCooldown` | 9141 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `reduceOtherSpellCooldownsOnCast` | 9146 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeAbilityCooldownsForPlayer` | 9167 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getPlayerPiercePctForAbility` | 9178 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerClassRole` | 9189 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getClassPerkTriggerForCurrentStage` | 9193 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `openClassPerkChoice` | 9208 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `maybeOfferClassPerkChoice` | 9244 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyPassiveEvolutionChoice` | 9253 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `maybeOfferPassiveEvolutionChoice` | 9271 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyOpeningStrikePassiveOnTurnStart` | 9310 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCrowDefendCooldown` | 9316 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `logAspectMatchupFeedback` | 9322 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getAspectDefinition` | 9332 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `formatAspectDisplayName` | 9339 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildAspectTooltipHTML` | 9347 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resolveAbilityAspectForDisplay` | 9362 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildAspectChartSvg` | 9371 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `logMsg` | 9418 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playAvatarAnim` | 9431 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spawnFloat` | 9447 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `flashPanel` | 9487 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doAttack` | 9496 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doMiss` | 9549 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doShield` | 9558 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doSpell` | 9565 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doHeal` | 9566 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `delay` | 9577 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `roll` | 9585 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerBaseAcc` | 9598 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeaponPrecisionModifier` | 9611 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillPrecisionModifier` | 9629 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getFinalAttackPrecision` | 9647 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccMod` | 9691 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerEffectiveAcc` | 9700 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveActionPrecisionPct` | 9707 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `clamp01` | 9717 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getPostBattleHealPct` | 9724 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `shouldApplyPostBattleHealNow` | 9728 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPostBattleHealIfDue` | 9735 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `softenMainStatForCombat` | 9757 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `effectiveDodgePercentForCombat` | 9765 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `damageMitigationMultiplierFromGuard` | 9772 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `physicalGuardValueFromEnemyDef` | 9776 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `magicalGuardValueFromEnemyMdef` | 9783 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `physicalGuardValueFromPlayerDef` | 9790 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `magicalGuardValueFromPlayerMdef` | 9796 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerArmorPenPct` | 9802 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPlayerMagicPenPct` | 9808 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPhysicalPierceFractionForDamage` | 9818 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getMagicalPierceFractionForDamage` | 9828 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPhysicalPierceFractionForPreview` | 9841 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getMagicalPierceFractionForPreview` | 9853 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcHitChance` | 9862 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcDefenseMultiplier` | 9871 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGrowthStageTransition` | 9876 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkGrowthStage` | 9912 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyBaseStats` | 9943 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTier` | 9966 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getEndlessEffectiveBattleNumber` | 9994 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEndlessDifficultyLevelOffset` | 9999 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getEndlessNormalFightTier` | 10024 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollRandomAnyMutationTiers` | 10032 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getStoryMutationRewardTiers` | 10041 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveMutationRewardTiers` | 10065 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeMutationDataTier` | 10088 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `pickUniqueMutationReward` | 10093 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildMutationRewardPool` | 10111 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `computeEnemyEffectiveLevel` | 10119 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStoryEnemyPowerMultiplier` | 10133 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `combatResolveEnemyTier` | 10142 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildScaledEnemy` | 10155 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildScaledBoss` | 10237 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyScaleFactor` | 10242 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEffectiveDodge` | 10256 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `chance` | 10277 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `addStatus` | 10280 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setStatusMax` | 10281 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshStatus` | 10283 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGuardedPhysReducPct` | 10285 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGuardedBuff` | 10293 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getTierBuffPct` | 10317 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveShieldAmountFromOpts` | 10323 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyShieldHp` | 10335 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applyDamageThroughShield` | 10358 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `notifyProtectionHitHooks` | 10411 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickShieldHpStatus` | 10430 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickGuardedStatus` | 10455 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playerIsGuarding` | 10461 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveGuardedReductionPct` | 10467 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshDerivedStatsAfterLoan` | 10480 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applySourceStatLoan` | 10490 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `decaySourceStatLoans` | 10507 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applySourceStatLoanPct` | 10524 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `clamp` | 10535 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `clampSkipChance` | 10536 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getWeakenStacks` | 10541 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeakenDamageMult` | 10548 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getWeakenDodgePenalty` | 10553 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyWeakenStack` | 10557 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectiveEnemyDodgeForPlayerHit` | 10567 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `scaleHealForBleed` | 10576 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeBurningTurns` | 10589 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `enemyHasBurning` | 10595 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHasBurning` | 10602 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToTarget` | 10609 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToEnemy` | 10634 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalStackAilment` | 10638 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalResolvedState` | 10670 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollStunChance` | 10706 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyEnemySlow` | 10707 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPendingStrikeBuff` | 10730 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerTimedBuff` | 10746 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `promotePendingStrikeBuffToActive` | 10759 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerSlow` | 10772 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshEnemyStrikerDodgeMark` | 10786 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAbilityLifestealPct` | 10798 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolveAbilityCombatRow` | 10816 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `detectEquipmentDamageBonus` | 10827 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `computeMasterOutgoingDamage` | 10835 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `computeOutgoingDamageBase` | 10931 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `collectDispatcherConditionalBonusFractions` | 10980 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `collectOutgoingDamageBonusFractions` | 11010 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLifestealFromDamage` | 11126 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyAbilityAuthoredEnCost` | 11137 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeEntityAbilityRawDamage` | 11143 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCurvedMitigationToPlayer` | 11203 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerCritDamageAdd` | 11229 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `dealDamage` | 11271 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmg` | 11669 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countEnemyCombatDebuffCategories` | 11697 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `countAilmentCategoriesOnEnemy` | 11716 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHasAfflictionForCardBonuses` | 11736 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `selfDodgeBuffActive` | 11739 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeSecondaryStatFlatForPhysical` | 11743 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyConditionalPhysicalDamageMultipliers` | 11756 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmgWithAlternateScaling` | 11775 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDamageScalingHintForUI` | 11786 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `calcEnemyAbilityDamage` | 11792 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyBossBurstBuffer` | 11801 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `edmg` | 11812 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollEnemyCritDamage` | 11828 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerMissChance` | 11842 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitPercentForAttack` | 11885 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccuracy` | 11903 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolvePlayerAttackHit` | 11913 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAttackMisses` | 11931 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doPlayerAttackMiss` | 11934 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerDmgMult` | 11944 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAilChance` | 11950 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `tryApplyAilment` | 11973 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDelayedDmgBoostPct` | 11991 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDelayedDamage` | 11998 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `tryMutationOnHitAilments` | 12026 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `notifyAilmentApplied` | 12045 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyAilment` | 12059 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerCritChance` | 12318 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitBonus` | 12351 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickDelayedForTarget` | 12363 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickStatuses` | 12380 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveAbilityAliasSourceId` | 12426 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerAbilityAlias` | 12432 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerStrikePreviewForBird` | 12433 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStarterKitEnergySmoothing` | 12436 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `checkBlackbirdOmenChorusAfterAbility` | 12439 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAction` | 12452 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startPlayerTurn` | 12705 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyEnergyForBattleDisplay` | 12801 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `startEnemyTurn` | 12808 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isSpellAbilityId` | 12826 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isMultiHitAbility` | 12831 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAuthoredEnergyCost` | 12843 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAttackWeight` | 12873 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityEnergyCost` | 12881 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnergyCost` | 12919 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncAbilityEnergyCost` | 12923 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseAbility` | 12927 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `spendEnergy` | 12942 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `enforceAbilityCosts` | 12954 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `gainEnergy` | 12962 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `spellMissChance` | 12982 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellMisses` | 12990 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `summonHitLands` | 12995 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellAilmentRoll` | 12999 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `matk` | 13007 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickTimedBuffsAfterEnemyPhase` | 13254 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `endPlayerTurn` | 13437 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyActionEnergyCost` | 13491 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAIPersonalityProfile` | 13518 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyAIMemory` | 13527 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyKitAbilityForEnemyAI` | 13534 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitOffersSetupDebuffs` | 13549 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyMode` | 13555 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyEnemyActionCategory` | 13564 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyActionPool` | 13578 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `projectedEnemyActionDamage` | 13623 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `canEnemyProjectLethal` | 13666 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getBossIntentCycle` | 13690 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEnemyArchetype` | 13695 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getArchetypeIntentWeights` | 13706 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypePriorityOrder` | 13709 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypeCategoryBonus` | 13717 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectEnemyIntent` | 13724 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `filterEnemyActionsByIntent` | 13760 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEnergySpendCap` | 13770 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyOpeningBias` | 13783 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyActionComboBonus` | 13793 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHpPct` | 13806 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHpPct` | 13807 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `mapAiStyleToType` | 13808 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `planEnemyAction` | 13816 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isBossEnrageAllowed` | 13831 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeNightfall` | 13832 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRiverGrip` | 13838 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTrackDecree` | 13844 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeApplyDecreePunish` | 13849 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRoyalDecree` | 13856 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeOwlsVerdict` | 13861 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeSummonCourt` | 13867 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTurnAI` | 13877 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitAbilityIsHardCC` | 13928 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollEnemyCombatRowAilment` | 13936 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refundEnemyActionEnergy` | 13972 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyAttackRiders` | 13979 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `executeEnemyKitTemplateAbility` | 13994 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTurn` | 14118 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `afterEnemyTurn` | 14255 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `showBattleCaption` | 14332 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDeath` | 14343 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatsSafe` | 14373 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `postCombat` | 14382 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLevelUpBaseHealthGrowth` | 14559 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `levelUpChoiceLabel` | 14582 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpVitalityGain` | 14589 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyLevelUpAgilityGain` | 14619 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isMainAttackAbility` | 14647 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getMainAttackAutoLevel` | 14658 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyMainAttackAutoLevel` | 14665 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollLuFeatherPanelOptions` | 14689 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeatherDraftTotal` | 14698 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeathersUnallocated` | 14702 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `captureLuStatBaseline` | 14706 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `simulateLuDraftStats` | 14723 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `formatLuPreviewDelta` | 14764 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `renderLuFeatherIcons` | 14771 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuFeatherStatline` | 14779 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuStatPreview` | 14796 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshLuFeatherPanelUI` | 14829 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildFeatherStatPanel` | 14880 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLevelUpStatEffectDesc` | 14933 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEquippedWeaponAvgDamage` | 14950 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getOffencePctPerStat` | 14971 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateMitigationPct` | 14976 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateWeaponSkillDamagePerStat` | 14982 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpPerPointBreakdown` | 14988 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getLevelUpCombatImpactLine` | 15062 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpGlossaryBlurb` | 15067 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luStatKeyForOption` | 15076 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLuFeatherStatValue` | 15083 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildLevelUpStatTooltipHtml` | 15089 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireLevelUpTooltips` | 15134 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resetLuFeatherDraft` | 15162 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `ensureMainAttackAndLoadoutRules` | 15169 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setLevelUpPanelTitle` | 15241 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpConfirm` | 15245 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpSecondary` | 15252 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetLevelUpFlowState` | 15259 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLevelUpScreen` | 15264 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLUPanel` | 15290 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `countLevelAilments` | 15297 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ailmentSlotsForLevel` | 15300 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `deriveAbilityAilments` | 15304 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openAbilityModificationChoice` | 15325 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbilityModModal` | 15351 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshPlayerAbilityAilments` | 15359 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `confirmSkillUpgrade` | 15366 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `onExitLevelUpRequested` | 15409 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBossStage` | 15437 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollGroveMutationTier` | 15444 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveGearReward` | 15454 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyGroveGearReward` | 15460 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGroveRewardCard` | 15479 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveNestReward` | 15493 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `startGroveAmbushBattle` | 15497 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `showGroveEvent` | 15546 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `enterGrove` | 15584 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `resolveGrove` | 15597 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `groveFinish` | 15710 | Endless/Meta | Yes (data-action in index.html) | Medium | js/systems/endless-map.js |
| `pickRandom` | 15719 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `showVictory` | 15721 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showDefeat` | 15785 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `flightRescuedNestCount` | 15817 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showRunStats` | 15822 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideStoryCinematic` | 15847 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startStoryCinematic` | 15852 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getAudioCtx` | 15898 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeAudioIfNeeded` | 15903 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundButtonLabel` | 15909 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundStateFromSettings` | 15918 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `toggleSound` | 15923 | Audio | Yes (data-action in index.html) | Medium | js/audio/bgm-shared.js |
| `playTone` | 15939 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doScreenShake` | 15981 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetBattleStats` | 15994 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getBattleSummaryStats` | 15995 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderBattleSummary` | 16009 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `updateStageProgress` | 16023 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveRunHistory` | 16139 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderRunHistory` | 16152 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refAbilityEnergyCost` | 16192 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityCodexType` | 16201 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityPassesEnFilter` | 16207 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRefFilterBarHtml` | 16217 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireRefFilterSelects` | 16249 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRefGuideModal` | 16280 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRefGuideModal` | 16288 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `toggleRefGuide` | 16296 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectRefTab` | 16303 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `skillCard` | 16309 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refSkillScalingLabel` | 16328 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildRefGuide` | 16335 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderReferenceGuide` | 16531 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkRunUnlocks` | 16541 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `showUnlockToast` | 16548 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeUtilityOffer` | 16565 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `assignShopItems` | 16571 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopItemsToGlobal` | 16575 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `showStorkShop` | 16585 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `enterStorkShopScreen` | 16590 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopMutationTierKey` | 16627 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `ensureShopMutationTierOpenState` | 16633 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopMutationTierSections` | 16638 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `resolveShopItemCategory` | 16672 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopGearCategoryTitle` | 16681 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopItemMatchesCategory` | 16685 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopCategoryLogText` | 16698 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `clearShopSelection` | 16712 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBaseCost` | 16719 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBuyCost` | 16725 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedBuyTotal` | 16729 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopMarginalBuyCost` | 16744 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRemainingBudget` | 16752 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedSellTotal` | 16756 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopDock` | 16765 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopBuyButtonState` | 16793 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopSellButtonState` | 16803 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopSectionHeading` | 16813 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopBuyCard` | 16820 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `setShopTab` | 16855 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getEquipmentSellPrice` | 16904 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getMutationSellPrice` | 16911 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderShopSellItems` | 16918 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSellSelected` | 16964 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSlotIsStarterLocked` | 16996 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopEquipped` | 17000 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopUnequipSlot` | 17047 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `rollShopTier` | 17070 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `pickUniqueRewardByTier` | 17075 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `_findShopItemById` | 17085 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `generateShopItems` | 17105 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopResetVisitState` | 17181 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopLockVisitState` | 17191 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRefreshCost` | 17195 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopItems` | 17200 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `purchaseShopItemAtIndex` | 17272 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopBuySelected` | 17317 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopRefresh` | 17372 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `exitStorkShop` | 17387 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `openAbandonModal` | 17434 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbandonModal` | 17437 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmAbandon` | 17444 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `unlockAllCodexEntries` | 17470 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isCreatorCodesEnabled` | 17520 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeSwitches` | 17521 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isDevCodeEnabled` | 17524 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveDevCodeSwitches` | 17525 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setDevCodeSwitch` | 17528 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeCatalogRow` | 17534 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyBirdwatchingUnlock` | 17538 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyHeadingHomeLock` | 17544 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `setGoldenGooseInfiniteState` | 17555 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `toggleDevCode` | 17561 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshAfterDevCode` | 17566 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `activateDevCode` | 17573 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `deactivateDevCode` | 17647 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDevCodeSwitches` | 17681 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `renderSuppliesCodeTools` | 17712 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderSuppliesActivityLog` | 17727 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setOwnedBirdTier` | 17733 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isKnownDevCodePrefix` | 17737 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDevCode` | 17742 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBgmApi` | 17799 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmAudio` | 17800 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMenuPreviewBgmAudio` | 17801 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmTargetVolume` | 17802 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopBattleBgmImmediate` | 17806 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeOut` | 17814 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeIn` | 17835 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryStartBattleBgmIfNeeded` | 17855 | Audio | No (internal) | High | js/audio/bgm-shared.js |
| `stopMenuPreviewBgmImmediate` | 17876 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuPreviewActive` | 17882 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuScreen` | 17886 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `setAudioElTrack` | 17890 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `resolvedMusicTrackIdForRole` | 17906 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuNowPlaying` | 17913 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMusicMenuAssignmentChips` | 17924 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuControls` | 17944 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyMusicPanelVolumeState` | 17961 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelVolume` | 17983 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelMuted` | 17987 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicRoleChoice` | 17992 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMenuThemeForPreview` | 18012 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playMusicMenuPreview` | 18017 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMusicMenuPreview` | 18041 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `openMusicMenu` | 18058 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `closeMusicMenu` | 18067 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `cancelThemeBgmFade` | 18076 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginThemeBgmFadeOutForRunStart` | 18085 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMusicSettings` | 18109 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `saveMusicSettings` | 18123 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `getThemeBgmAudio` | 18131 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBattleBgmAudio` | 18134 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `cancelDukeBgmFade` | 18137 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBgmTargetVolume` | 18145 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeDukeBattleBgmAudio` | 18150 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgmImmediate` | 18156 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgm` | 18163 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `duckThemeBgmForBattle` | 18166 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeIn` | 18173 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeOut` | 18202 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isDukeStoryBossFight` | 18235 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `tryStartDukeBattleBgmIfNeeded` | 18244 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeThemeBgmAudio` | 18265 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryPlayThemeBgmForCurrentMenuScreen` | 18271 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyDukeBattleBgmToAudioEl` | 18284 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyThemeMusicToAudioEl` | 18292 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopAllGameAudio` | 18317 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncThemeMusicButtonLabels` | 18330 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncThemeBgmPlaybackForScreen` | 18343 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `toggleThemeMusicMuted` | 18357 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 18374 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `wireThemeBgmAutoplayUnlock` | 18394 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `detectPreferredUIMode` | 18432 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveUiMode` | 18438 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeCombatCustomLayout` | 18462 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetCombatCustomDraft` | 18483 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatCustomDraft` | 18486 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeCombatArrangement` | 18493 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeCombatLayout` | 18499 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAccessibilitySettings` | 18510 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getAccessibilitySettings` | 18536 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `bootstrapAccessibilityDefaults` | 18544 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireUiAutoDetectResize` | 18568 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAudioVolumeMultipliers` | 18586 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `selectSettingsTab` | 18594 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyUIStateToDOM` | 18608 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAutoCombatDensityReduction` | 18619 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyEffectiveCombatScales` | 18626 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyCombatLayoutSettings` | 18645 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `clearCombatCustomPanelStyles` | 18649 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatCustomPanels` | 18657 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatCustomEditRow` | 18669 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderCombatCustomPanelEditor` | 18678 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatCustomLayoutModal` | 18732 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatCustomLayoutModal` | 18738 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `saveCombatCustomLayoutFromModal` | 18743 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `resetCombatCustomLayoutDraft` | 18754 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `toggleCombatCustomPanelVisible` | 18758 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `moveCombatCustomPanel` | 18765 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatArrangement` | 18784 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatLayoutLabels` | 18798 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncAudioSettingLabels` | 18808 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncUiModeControls` | 18820 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyAccessibilitySettings` | 18835 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openSettingsModal` | 18857 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeSettingsModal` | 18909 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `returnToWarRoomFromSettings` | 18913 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openAbandonFromSettings` | 18919 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `goMainMenuFromSettings` | 18924 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetCombatLayoutSettings` | 18935 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `updateAccessibilitySettings` | 18947 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAudioSettingsFromControls` | 18993 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 19019 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |

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
