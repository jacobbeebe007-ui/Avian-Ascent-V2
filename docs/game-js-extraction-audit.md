# game.js Extraction Audit (Step 7)

Generated: 2026-08-31  
Source: `js/core/game.js`  
**Before Step 7:** 20493 lines  
**Functions:** 921 top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
| Bootstrap/Orchestration | 232 | 🔁 Retain in game.js |
| Enemy setup/AI | 113 | ⬜ Phase 7 |
| Combat | 108 | ⬜ Phase 8 |
| Story/Overworld | 77 | ⬜ Phase 6 |
| Combat UI | 77 | ⬜ Phase 3 |
| Audio | 56 | ⬜ Not started |
| Bird selection | 46 | ⬜ Not started |
| Rewards | 43 | ⬜ Phase 5 |
| Shop | 41 | ⬜ Phase 5B |
| Utilities | 26 | ✅ Phase 1 (game-helpers.js) |
| Nest | 24 | ⬜ Not started |
| Equipment | 24 | ⬜ Not started |
| Save/load | 22 | ⬜ Not started |
| Class/Passive | 19 | ⬜ Not started |
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
| `runPassiveIntegrityAudit` | 100 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `inferAIPersonalityFromStyle` | 127 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `inferEnemyClassFromStyle` | 144 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `makeEnemy` | 154 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDukeAbilityEnCost` | 189 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildDukeStoryBossEnemy` | 192 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeDukeBlakiston` | 217 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBiomeForStage` | 287 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyBiomeModifiers` | 294 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollRarity` | 307 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatStat` | 315 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgFlatMaxHp` | 319 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `_upgGoldenFeather` | 325 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countUpgradeAcquisitionsThisRun` | 341 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isUpgradeBlockedByRunAcquisitionCap` | 344 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `upgradeEligibleForRewardPick` | 353 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getUpgradePool` | 361 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ledgerStatLabel` | 365 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `cloneStatLedgerSlice` | 420 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `ensureStatLedger` | 429 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `reapplyPlayerGearStats` | 450 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `initStatLedgerForNewRun` | 456 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `syncBirdBaselineFromCatalog` | 470 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStatLedgerAfterLoad` | 495 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `mergeStatDeltaIntoBucket` | 518 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `recordUpgradeApplyInLedger` | 534 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildStatBreakdownTitle` | 550 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `equipmentPctLedgerKey` | 564 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquippedStatSources` | 568 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatModifierLines` | 582 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `richTooltipCloseBtn` | 598 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdPassiveInfo` | 602 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdAuthoredClassPerk` | 612 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildPassiveTooltipHTML` | 633 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getMutationDescHtml` | 643 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildMutationTooltipHTML` | 644 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEquipmentItem` | 645 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEquipmentSkill` | 648 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `itemHasDisplayableWeaponDamage` | 652 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `formatEquipmentStatsHtml` | 661 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatAnyStatLabel` | 689 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `formatEquipmentSkillsHtml` | 713 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEquipmentTooltipHTML` | 727 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildRichStatTooltipHtml` | 764 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyMutationStatSources` | 814 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEntityAspectTooltipHtml` | 838 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getPlayerEquippedMutationIds` | 861 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildPlayerBirdTooltipHtml` | 863 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildClassLabelTooltipHtml` | 880 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyMutationsTooltipHtml` | 895 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEnemyRichStatTooltipHtml` | 923 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `tooltipsEnabled` | 946 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showRichTooltipHtml` | 950 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltipNearEl` | 959 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindHoldRepeat` | 978 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `bindRichTooltip` | 1013 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireNestMutationTooltips` | 1053 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestEquipmentTooltips` | 1061 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireNestAbilityTooltips` | 1070 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `wireCombatStatTooltips` | 1089 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatClassLabelTooltips` | 1101 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireCombatEnemyStatTooltips` | 1119 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyMutationTooltips` | 1130 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wirePlayerAvatarInteractionOnce` | 1135 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getDerivedMechanicalBonusLines` | 1150 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isEndlessRunActive` | 1246 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getPassiveEvolutionDefinition` | 1259 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `ensurePassiveEvolutionState` | 1276 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveEvolutionBonuses` | 1286 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPassiveDefMdefBonuses` | 1298 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `rollEndlessReward` | 1308 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyEndlessProgressionMilestones` | 1315 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `rollUpgradeCard` | 1319 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `ensureClassPerkState` | 1333 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `normalizeClassPerkIdList` | 1340 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getBirdClassRoleByKey` | 1344 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdClassPerks` | 1348 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `hasClassPerk` | 1354 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkGrantCountForMode` | 1358 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getClassPerkCapForMode` | 1368 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getAvailableClassPerksForBird` | 1372 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyClassPerksToStats` | 1379 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyClassPerksToCombatContext` | 1392 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `recomputeClassPerkEffects` | 1420 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkBuffDurationBonus` | 1426 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `getPlayerClassPerkSongHealFlat` | 1431 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `grantClassPerk` | 1436 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `makeAbilityLevelData` | 1475 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `makeEvolutionAbilityTemplate` | 1484 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enforceAbilityBalanceSpec` | 1602 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeAbilityEnergy` | 1642 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAllAbilityEnergy` | 1657 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAbilityTemplates` | 1741 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `removeMimicEverywhere` | 1785 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getUnlocks` | 1819 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `grantUnlock` | 1822 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isUnlocked` | 1825 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getPlayableStarterBirdKeys` | 1826 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `collectAllBirdUnlockIds` | 1835 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `isBirdUnlockedForSelect` | 1843 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getActiveOwNodesForProgress` | 1850 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryMaxStage` | 1855 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `queueUnlockBanner` | 1892 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `handleBossClearUnlocks` | 1897 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderUnlockPopupsOnGameover` | 1920 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkSecretUnlockChar` | 1943 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `expForLevel` | 1973 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `threatTierExpMultiplierForEnemy` | 1994 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `baseExpForEnemyLevel` | 1998 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `relativeLevelExpMultiplier` | 2007 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `stageExpMultiplier` | 2020 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeNormalEnemyExpGain` | 2029 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeBossExpGain` | 2045 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getGrowthStageForLevel` | 2083 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeBirdSizeForEnergy` | 2112 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getEnergyProfile` | 2123 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getEnemyEnergyProfile` | 2127 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computePlayerEffectiveMaxEnergy` | 2133 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerMaxEnergy` | 2143 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerStartEnergy` | 2147 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegen` | 2153 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerEnergyRegenThisTurn` | 2158 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerGameModule` | 2201 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `runModuleHook` | 2205 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `initDataPacks` | 2216 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `ensureUIState` | 2324 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerHit` | 2353 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `registerMiss` | 2354 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `triggerPassive` | 2359 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `renderPassiveBadge` | 2364 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatAbilityLevelPathway` | 2381 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `isStoryBattleNestEquipLocked` | 2391 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `notifyStoryBattleNestEquipLocked` | 2395 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `getEquipmentNestSlotLabel` | 2406 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `equipmentHandBadgeHtml` | 2410 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentStatChipLabel` | 2418 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `formatEquipmentCompactStatsHtml` | 2434 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `needsUltimateSourcePick` | 2463 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setPlayerUltimateSourceItemId` | 2469 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildNestUltimateBankHtml` | 2484 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `buildNestUltimatePickerHtml` | 2514 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `equipmentSlotIconForItem` | 2518 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `grantPlayerEquipmentItem` | 2527 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_nestInvCompareHtml` | 2546 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestEquipmentItemHtml` | 2565 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSectionV2` | 2587 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `handleNestEquipmentClick` | 2667 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `selectNestTab` | 2709 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `organizeNestSections` | 2728 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestAbilitySection` | 2756 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `resetNestChrome` | 2804 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildEnemyNestEquipmentSection` | 2811 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyNestAbilitySection` | 2858 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyNestProfileHtml` | 2927 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyNestAbilityTooltips` | 2980 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `fillEnemyNestHeader` | 2989 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openEnemyNest` | 3013 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openNest` | 3034 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `notifyOwUiEmbedClose` | 3209 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `closeNest` | 3216 | Nest | Yes (data-action in index.html) | Medium | js/ui/nest-ui.js |
| `getNestSlotIcons` | 3229 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `readNestMutCompareMode` | 3232 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `setNestMutCompareMode` | 3241 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestInventoryMutStatsHtml` | 3245 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `_nestMutationItemHtml` | 3247 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `handleNestEquipClick` | 3249 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `buildNestEquipmentSection` | 3276 | Build Nest | No (internal) | Medium | js/world/map-forge.js (existing) / js/ui/build-nest.js |
| `bootstrapOwNestEmbed` | 3287 | Nest | Yes (explicit global/Avian.actions) | Medium | js/ui/nest-ui.js |
| `bootstrapOwSettingsEmbed` | 3310 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwReferenceEmbed` | 3322 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `bootstrapOwUiEmbed` | 3334 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `codexMark` | 3343 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCardTierSlotCount` | 3363 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyPlayerSkillsFromCardTier` | 3375 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isSkillSlotUnlocked` | 3386 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `clampLockedSkillSlots` | 3393 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildFamilySkillAbilityLookup` | 3402 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getFamilyEvolutionBirdDataStore` | 3419 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getBirdFamilyEvolutionData` | 3425 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getBirdSkillFamilyCatalog` | 3428 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `usesFamilySkillEvolution` | 3431 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `createSkillSlotState` | 3434 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBaseSkillSlotsForBird` | 3441 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `getFamilyEvolutionAbilityStateFromId` | 3453 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getSkillSlotFamilyDef` | 3465 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillSlotDisplayLabel` | 3473 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeSkillSlotState` | 3479 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getSkillSlots` | 3490 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getSkillSlotByIndex` | 3493 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilitySkillSlot` | 3496 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureAbilityObjectFromTemplate` | 3502 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncPlayerAbilitiesFromSkillSlots` | 3524 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `consumePendingEquipmentV2MigrationCompensation` | 3570 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `stashEquipmentV2MigrationNotice` | 3590 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `applyEquipmentLoadoutSanitizationOnLoad` | 3597 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `finalizeEquipmentV2PreReleaseReset` | 3614 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `ensureFamilyEvolutionState` | 3625 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `_isValidOverworldEnemySeedPack` | 3647 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `saveRun` | 3650 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `loadSaveData` | 3728 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `deleteSave` | 3748 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearDevCodeAccess` | 3753 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `reloadShellHttpCache` | 3771 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `cacheBustReload` | 3790 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearGameCache` | 3800 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `clearAllProgress` | 3832 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openEraseProgressModal` | 3868 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeEraseProgressModal` | 3871 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `openClearCacheModal` | 3874 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `closeClearCacheModal` | 3877 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmClearCache` | 3880 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `confirmEraseProgress` | 3895 | Save/load | Yes (data-action in index.html) | High | js/systems/save-migrations.js |
| `continueRun` | 3908 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `goMainMenu` | 4105 | Enemy setup/AI | Yes (data-action in index.html) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isOwUiEmbedMode` | 4115 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `clearOwTransientKeys` | 4119 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `navigateTopToMainMenu` | 4128 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `flyAgain` | 4152 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEncounterStage` | 4186 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStageEncounterChainLength` | 4192 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `hasMultiEnemyChainPending` | 4199 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetStageBattleStats` | 4207 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `accumulateStageBattleStats` | 4212 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `continueToNextEncounterBird` | 4235 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterDrafts` | 4250 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDukeEncounterToken` | 4269 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rerollNonDukeStageEnemy` | 4275 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildOwEnemyDraftFromBirdKey` | 4283 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionProfileId` | 4329 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `shiftEnemyProgressionTier` | 4340 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveStoryLevelFromStage` | 4348 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `resolveEnemyProgressionTier` | 4366 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveEnemyWorkbookLevel` | 4401 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTotalStars` | 4429 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyStatsFromPlayerProgression` | 4443 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `mergeScaledStatsIntoEnemy` | 4624 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureOwEncounterMaterialized` | 4756 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyKitAbilityIds` | 4773 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEquipmentActionSources` | 4785 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `isEnemyUltimateMeterReady` | 4790 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEnemyEquipmentActionAvailable` | 4799 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getEnemyAbilityDisplayLabel` | 4806 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillNames` | 4816 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewSkillKeys` | 4846 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevel` | 4861 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyPreviewLevelLine` | 4869 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyInfoPopupAbilitiesHtml` | 4874 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeEnemyInfoPopup` | 4929 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openEnemyInfoPopup` | 4937 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `formatEquipmentEffectSummaryHtml` | 4942 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `buildEnemyInfoPopupMutationsHtml` | 4958 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireEnemyInfoEquipmentTooltips` | 4993 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `wireEnemyInfoPopupOnce` | 5003 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCurrentStageEncounterPreviewData` | 5018 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyAbilityTooltipHtml` | 5034 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `buildEncounterPreviewTooltipHtml` | 5084 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `ensureEnemyPreviewEquipmentState` | 5125 | Equipment | Yes (explicit global/Avian.actions) | Medium | js/systems/equipment*.js |
| `buildEncounterPreviewEquipmentHtml` | 5176 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `_initEncounterPreviewCollapse` | 5202 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderEncounterPreview` | 5222 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `terrainStringToArenaId` | 5282 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveBattleArenaId` | 5306 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `battleArenaImagePaths` | 5313 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `updateBattleArena` | 5323 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncBattleLogDrawerCollapse` | 5357 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `initBattleLogDrawer` | 5370 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getStoryEnemyLevelBand` | 5392 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getStoryEvolvedSlotCount` | 5404 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getOwEnemySkillDepthFromTierBand` | 5409 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `materializeEnemyFamilySkillSlots` | 5418 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollInt` | 5432 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `pickRandom` | 5433 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `weightedPick` | 5434 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classGrowthWeightsForStory` | 5441 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `buildStoryEnemyFromBirdKey` | 5450 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `generateStoryStageEnemyKeys` | 5577 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `commitStoryEncounterMeta` | 5607 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyEnemyFeatherFromPlayerMirror` | 5626 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyStoryEnemyGrowth` | 5664 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncStoryEncounterBirdQueue` | 5699 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showNextStagePreview` | 5752 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `initSelection` | 5785 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `buildRosterFilterSelect` | 5818 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `syncRosterFilterSelect` | 5835 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `onRosterFilterChange` | 5848 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `buildSelectionViewButtons` | 5862 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildLockFilterButtons` | 5863 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setRosterMode` | 5865 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setLockFilter` | 5874 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGameModeToggle` | 5882 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setGameMode` | 5900 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `classToRoleId` | 5908 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `migrateLegacySelectionView` | 5911 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `idToClassLabel` | 5921 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireRefGuideClicks` | 5925 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderStarterFallbackGrid` | 5939 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `initSelectionSafe` | 5968 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `formatDifficultyMult` | 6022 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `buildDifficultyPicker` | 6028 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectDifficulty` | 6073 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `setSelView` | 6079 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildBirdGrid` | 6088 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `renderBirdCardStarsHtml` | 6252 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getBirdSpeciesRarityMeta` | 6261 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `buildBirdCard` | 6271 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `setCharacterSelectView` | 6322 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `backToCharacterSelectBirds` | 6348 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `selectBird` | 6365 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `mutateBirdCardSelect` | 6379 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `__normSpriteKey` | 6406 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `__hasSpriteKey` | 6407 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rosterCanonBirdKey` | 6413 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `runtimeSizeFromProfileToken` | 6429 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `profileSizeTokenForEntity` | 6454 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `rosterSizeForEntity` | 6465 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getUISizeClass` | 6469 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `normalizeSpriteBirdKey` | 6480 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `neutralBirdFallbackHTML` | 6491 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wrapSpriteFaceLeft` | 6494 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `wrapEnemySpriteIfNeeded` | 6497 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ensureBattleEnemyFacing` | 6503 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `renderBirdIconHTML` | 6511 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderEntityAvatarHTML` | 6526 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getFlightSettingsSummary` | 6531 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncFlightSettingsBriefing` | 6549 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSfselRunSummary` | 6564 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncSelectTakeFlightButton` | 6574 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `escapeHtmlRoster` | 6587 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `rosterAbilityBlurb` | 6594 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityBlurbForTemplate` | 6606 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRosterPreviewStubForBirdKey` | 6617 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `rosterPreviewSlotTag` | 6635 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKit` | 6643 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `materializeRosterPreviewKitForCardProgress` | 6669 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `birdUpgradeTierMeta` | 6692 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStarsHtml` | 6700 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildBirdUpgradePreviewModel` | 6705 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeReasonText` | 6784 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `formatBirdUpgradeStatValue` | 6792 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeStatRowsHtml` | 6798 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilityLabel` | 6807 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `birdUpgradeAbilitiesHtml` | 6813 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `renderBirdUpgradePreviewModal` | 6831 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openBirdUpgradePreview` | 6883 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `closeBirdUpgradePreview` | 6891 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `confirmBirdUpgradePreview` | 6902 | Rewards | Yes (explicit global/Avian.actions) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `openRosterChampionModal` | 6952 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRosterChampionModal` | 6953 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `_setSfselEmptyState` | 6957 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAscentPanel` | 6963 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startSelectedBird` | 7143 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `beginRun` | 7148 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getCombatItemMaxHold` | 7156 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerIsKnightClass` | 7164 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `createDefaultCombatItems` | 7169 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `ensureCombatItems` | 7173 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatItemCount` | 7183 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canAddCombatItem` | 7188 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `addCombatItem` | 7194 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildCombatItemShopOffer` | 7205 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `launchStoryOverworld` | 7228 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startGame` | 7272 | Bootstrap/Orchestration | Yes (data-action in index.html) | Medium | js/core/game.js (retain) |
| `makeEndlessEnemy` | 7393 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isEndlessMapActive` | 7419 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `showEndlessMap` | 7424 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `endlessMapSelectNode` | 7459 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `grantEndlessMapTreasure` | 7525 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `finishEndlessMapAfterCombat` | 7545 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `returnToEndlessMapFromSideRoom` | 7583 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `captureBattleTempPlayerStats` | 7600 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `restoreBattleTempPlayerStats` | 7622 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `prepareEnemyCombatLoadout` | 7635 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `preparePlayerCombatLoadout` | 7674 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `normalizeBattleTurnState` | 7696 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetForNewBattle` | 7720 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeEnemyNameKey` | 7812 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `storyTierFromStage` | 7817 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildEdFromBirdEnemyTemplate` | 7827 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraftForStage` | 7840 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `pickRandomBirdEnemyDraft` | 7847 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `bossTitleForStageMilestone` | 7855 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `scheduleOpeningEnemyTurn` | 7863 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `loadStage` | 7889 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setSuppliesSubView` | 8074 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `syncMissionMapVariantTabs` | 8110 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapPickerVisibility` | 8131 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMissionTestMapLabel` | 8136 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshMissionTestMapSelect` | 8160 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openSelectHubPanel` | 8226 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRunSettings` | 8282 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmRunSettings` | 8285 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `closeSelectHubPanel` | 8290 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `takeFlightToSelect` | 8310 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `scrollToSelectRoster` | 8319 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `showScreen` | 8324 | Story/Overworld | Yes (explicit global/Avian.actions) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `lockActionUI` | 8373 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `canPlayerAct` | 8379 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncCombatTurnFlags` | 8383 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `enqueueAction` | 8393 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `runActionQueue` | 8399 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isActiveBattleContext` | 8440 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `failsafeAdvance` | 8446 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `installLegacyErrorHUD` | 8495 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `installErrorHUD` | 8646 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDisplayTags` | 8675 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `abilityTypeChipLabel` | 8679 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isPlayerAbilityUsable` | 8685 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerHasAffordableAbility` | 8696 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseCombatItem` | 8705 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `useCombatItem` | 8714 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityTemplateForUI` | 8746 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectiveAbilityBtnType` | 8811 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `estimateMultiplierFromSkillDescription` | 8825 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerAtkForDamagePreview` | 8852 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEffectivePlayerOffensiveAtkForPreview` | 8861 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectivePlayerOffensiveMatkForPreview` | 8864 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPackRowScaleStatRaw` | 8868 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `packRowScaleContribution` | 8881 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `registerStrikePreviewForBird` | 8890 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `getStrikePreviewMultiplierForAbility` | 8905 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getHybridPreviewSpec` | 8916 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateHybridSplitBands` | 8944 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateSkillDamageRange` | 9008 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `snowyOwlEyeStatPreviewLines` | 9221 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `snowyOwlGlideStatPreviewLines` | 9236 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `_previewPickArrayFromSource` | 9417 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildGenericUtilityStatPreviewFromAction` | 9428 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillStatPreviewLines` | 9490 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildActionTooltipHTML` | 9507 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showActionTooltip` | 9591 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `positionTooltip` | 9601 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `moveTooltip` | 9614 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `showTooltip` | 9650 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideTooltip` | 9661 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAbDesc` | 9669 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityCooldown` | 9681 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getClassCooldownAdjustment` | 9685 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `isDirectHealingAbility` | 9707 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getTemplateCooldown` | 9723 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `setAbilityCooldown` | 9738 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `reduceOtherSpellCooldownsOnCast` | 9743 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `normalizeAbilityCooldownsForPlayer` | 9764 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getPlayerPiercePctForAbility` | 9775 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerClassRole` | 9786 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getClassPerkTriggerForCurrentStage` | 9790 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `openClassPerkChoice` | 9805 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `maybeOfferClassPerkChoice` | 9841 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyPassiveEvolutionChoice` | 9850 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `maybeOfferPassiveEvolutionChoice` | 9868 | Class/Passive | No (internal) | Medium | js/systems/class-perk-runtime.js |
| `applyOpeningStrikePassiveOnTurnStart` | 9907 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getCrowDefendCooldown` | 9913 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `logAspectMatchupFeedback` | 9919 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getAspectDefinition` | 9929 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `formatAspectDisplayName` | 9936 | Utilities | Yes (explicit global/Avian.actions) | Low | js/core/game-helpers.js |
| `buildAspectTooltipHTML` | 9944 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resolveAbilityAspectForDisplay` | 9959 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildAspectChartSvg` | 9968 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `logMsg` | 10015 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playAvatarAnim` | 10028 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spawnFloat` | 10044 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `flashPanel` | 10084 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doAttack` | 10093 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doMiss` | 10146 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doShield` | 10155 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doSpell` | 10162 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doHeal` | 10163 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `delay` | 10174 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `roll` | 10182 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerBaseAcc` | 10195 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeaponPrecisionModifier` | 10208 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getSkillPrecisionModifier` | 10226 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getFinalAttackPrecision` | 10244 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccMod` | 10288 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerEffectiveAcc` | 10297 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveActionPrecisionPct` | 10304 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `clamp01` | 10314 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getPostBattleHealPct` | 10321 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `shouldApplyPostBattleHealNow` | 10325 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPostBattleHealIfDue` | 10332 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `softenMainStatForCombat` | 10354 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `effectiveDodgePercentForCombat` | 10362 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `damageMitigationMultiplierFromGuard` | 10369 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `physicalGuardValueFromEnemyDef` | 10373 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `magicalGuardValueFromEnemyMdef` | 10380 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `physicalGuardValueFromPlayerDef` | 10387 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `magicalGuardValueFromPlayerMdef` | 10393 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerArmorPenPct` | 10399 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPlayerMagicPenPct` | 10405 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getPhysicalPierceFractionForDamage` | 10415 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getMagicalPierceFractionForDamage` | 10425 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPhysicalPierceFractionForPreview` | 10438 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getMagicalPierceFractionForPreview` | 10450 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcHitChance` | 10459 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `calcDefenseMultiplier` | 10468 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGrowthStageTransition` | 10473 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkGrowthStage` | 10509 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getEnemyBaseStats` | 10540 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resolveEnemyTier` | 10563 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getEndlessEffectiveBattleNumber` | 10591 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEndlessDifficultyLevelOffset` | 10596 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `getEndlessNormalFightTier` | 10621 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `rollRandomAnyMutationTiers` | 10629 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `getStoryMutationRewardTiers` | 10638 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveMutationRewardTiers` | 10662 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `normalizeMutationDataTier` | 10685 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `pickUniqueMutationReward` | 10690 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildMutationRewardPool` | 10708 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `computeEnemyEffectiveLevel` | 10716 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getStoryEnemyPowerMultiplier` | 10730 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `combatResolveEnemyTier` | 10739 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `buildScaledEnemy` | 10752 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildScaledBoss` | 10834 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyScaleFactor` | 10839 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEffectiveDodge` | 10853 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `chance` | 10874 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `addStatus` | 10877 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `setStatusMax` | 10878 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refreshStatus` | 10880 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getGuardedPhysReducPct` | 10882 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyGuardedBuff` | 10890 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getTierBuffPct` | 10914 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `resolveShieldAmountFromOpts` | 10920 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyShieldHp` | 10932 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applyDamageThroughShield` | 10955 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `notifyProtectionHitHooks` | 11008 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickShieldHpStatus` | 11027 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickGuardedStatus` | 11052 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playerIsGuarding` | 11058 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveGuardedReductionPct` | 11064 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshDerivedStatsAfterLoan` | 11077 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applySourceStatLoan` | 11087 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `decaySourceStatLoans` | 11104 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `applySourceStatLoanPct` | 11121 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `clamp` | 11132 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `clampSkipChance` | 11133 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getWeakenStacks` | 11138 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getWeakenDamageMult` | 11145 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getWeakenDodgePenalty` | 11150 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyWeakenStack` | 11154 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEffectiveEnemyDodgeForPlayerHit` | 11164 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `scaleHealForBleed` | 11173 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `normalizeBurningTurns` | 11186 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `enemyHasBurning` | 11192 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHasBurning` | 11199 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToTarget` | 11206 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyChilledStacksToEnemy` | 11231 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalStackAilment` | 11235 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyPhysicalResolvedState` | 11267 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollStunChance` | 11303 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyEnemySlow` | 11304 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyPendingStrikeBuff` | 11327 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerTimedBuff` | 11343 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `promotePendingStrikeBuffToActive` | 11356 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyPlayerSlow` | 11369 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refreshEnemyStrikerDodgeMark` | 11383 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAbilityLifestealPct` | 11395 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `resolveAbilityCombatRow` | 11413 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `detectEquipmentDamageBonus` | 11424 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `computeMasterOutgoingDamage` | 11432 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `computeOutgoingDamageBase` | 11528 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `collectDispatcherConditionalBonusFractions` | 11577 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `collectOutgoingDamageBonusFractions` | 11607 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLifestealFromDamage` | 11723 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyAbilityAuthoredEnCost` | 11734 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `computeEntityAbilityRawDamage` | 11740 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCurvedMitigationToPlayer` | 11800 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computePlayerCritDamageAdd` | 11826 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `dealDamage` | 11868 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmg` | 12266 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `countEnemyCombatDebuffCategories` | 12294 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `countAilmentCategoriesOnEnemy` | 12313 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHasAfflictionForCardBonuses` | 12333 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `selfDodgeBuffActive` | 12336 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `computeSecondaryStatFlatForPhysical` | 12340 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyConditionalPhysicalDamageMultipliers` | 12353 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `pdmgWithAlternateScaling` | 12372 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAbilityDamageScalingHintForUI` | 12383 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `calcEnemyAbilityDamage` | 12389 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyBossBurstBuffer` | 12398 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `edmg` | 12409 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollEnemyCritDamage` | 12425 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerMissChance` | 12439 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitPercentForAttack` | 12482 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerAccuracy` | 12500 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolvePlayerAttackHit` | 12510 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAttackMisses` | 12528 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `doPlayerAttackMiss` | 12531 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getPlayerDmgMult` | 12541 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAilChance` | 12547 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `tryApplyAilment` | 12570 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getDelayedDmgBoostPct` | 12588 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDelayedDamage` | 12595 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `tryMutationOnHitAilments` | 12623 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `notifyAilmentApplied` | 12642 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyAilment` | 12656 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getPlayerCritChance` | 12915 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getPlayerHitBonus` | 12948 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickDelayedForTarget` | 12960 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickStatuses` | 12977 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveAbilityAliasSourceId` | 13023 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerAbilityAlias` | 13029 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `registerStrikePreviewForBird` | 13030 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `ensureStarterKitEnergySmoothing` | 13033 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `checkBlackbirdOmenChorusAfterAbility` | 13036 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `playerAction` | 13049 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `startPlayerTurn` | 13302 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncEnemyEnergyForBattleDisplay` | 13398 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `startEnemyTurn` | 13405 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isSpellAbilityId` | 13423 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `isMultiHitAbility` | 13428 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAuthoredEnergyCost` | 13440 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityAttackWeight` | 13470 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getAbilityEnergyCost` | 13478 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnergyCost` | 13516 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `syncAbilityEnergyCost` | 13520 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `canUseAbility` | 13524 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `spendEnergy` | 13539 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `enforceAbilityCosts` | 13551 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `gainEnergy` | 13559 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `spellMissChance` | 13579 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellMisses` | 13587 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `summonHitLands` | 13592 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `spellAilmentRoll` | 13596 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `matk` | 13604 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `tickTimedBuffsAfterEnemyPhase` | 13851 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `endPlayerTurn` | 14034 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getEnemyActionEnergyCost` | 14088 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getAIPersonalityProfile` | 14115 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyAIMemory` | 14124 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyKitAbilityForEnemyAI` | 14131 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitOffersSetupDebuffs` | 14146 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyMode` | 14152 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `classifyEnemyActionCategory` | 14161 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `buildEnemyActionPool` | 14175 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `projectedEnemyActionDamage` | 14220 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `canEnemyProjectLethal` | 14263 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getBossIntentCycle` | 14287 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEnemyArchetype` | 14292 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getArchetypeIntentWeights` | 14303 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypePriorityOrder` | 14306 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getArchetypeCategoryBonus` | 14314 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectEnemyIntent` | 14321 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `filterEnemyActionsByIntent` | 14357 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyEnergySpendCap` | 14367 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getEnemyOpeningBias` | 14380 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getEnemyActionComboBonus` | 14390 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyHpPct` | 14403 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `playerHpPct` | 14404 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `mapAiStyleToType` | 14405 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `planEnemyAction` | 14413 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isBossEnrageAllowed` | 14428 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeNightfall` | 14429 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRiverGrip` | 14435 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTrackDecree` | 14441 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeApplyDecreePunish` | 14446 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeRoyalDecree` | 14453 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeOwlsVerdict` | 14458 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `dukeSummonCourt` | 14464 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `dukeTurnAI` | 14474 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyKitAbilityIsHardCC` | 14525 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollEnemyCombatRowAilment` | 14533 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refundEnemyActionEnergy` | 14569 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyEnemyAttackRiders` | 14576 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `executeEnemyKitTemplateAbility` | 14591 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `enemyTurn` | 14715 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `afterEnemyTurn` | 14852 | Enemy setup/AI | No (internal) | High | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `showBattleCaption` | 14929 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDeath` | 14940 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getBattleStatsSafe` | 14970 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `postCombat` | 14979 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyLevelUpBaseHealthGrowth` | 15156 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `levelUpChoiceLabel` | 15179 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyLevelUpVitalityGain` | 15186 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyLevelUpAgilityGain` | 15216 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `isMainAttackAbility` | 15244 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `getMainAttackAutoLevel` | 15255 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyMainAttackAutoLevel` | 15262 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `rollLuFeatherPanelOptions` | 15286 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeatherDraftTotal` | 15295 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luFeathersUnallocated` | 15299 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `captureLuStatBaseline` | 15303 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `simulateLuDraftStats` | 15320 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `formatLuPreviewDelta` | 15361 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `renderLuFeatherIcons` | 15368 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuFeatherStatline` | 15376 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderLuStatPreview` | 15393 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshLuFeatherPanelUI` | 15426 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildFeatherStatPanel` | 15477 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLevelUpStatEffectDesc` | 15530 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getEquippedWeaponAvgDamage` | 15547 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getOffencePctPerStat` | 15568 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateMitigationPct` | 15573 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `estimateWeaponSkillDamagePerStat` | 15579 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpPerPointBreakdown` | 15585 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getLevelUpCombatImpactLine` | 15659 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getLevelUpGlossaryBlurb` | 15664 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `luStatKeyForOption` | 15673 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getLuFeatherStatValue` | 15680 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildLevelUpStatTooltipHtml` | 15686 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireLevelUpTooltips` | 15731 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `resetLuFeatherDraft` | 15759 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `ensureMainAttackAndLoadoutRules` | 15766 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setLevelUpPanelTitle` | 15838 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpConfirm` | 15842 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `configureLevelUpSecondary` | 15849 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetLevelUpFlowState` | 15856 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLevelUpScreen` | 15861 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showLUPanel` | 15887 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `countLevelAilments` | 15894 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `ailmentSlotsForLevel` | 15897 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `deriveAbilityAilments` | 15901 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `openAbilityModificationChoice` | 15922 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbilityModModal` | 15948 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `refreshPlayerAbilityAilments` | 15956 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `confirmSkillUpgrade` | 15963 | Rewards | Yes (data-action in index.html) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `onExitLevelUpRequested` | 16006 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isBossStage` | 16034 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `rollGroveMutationTier` | 16041 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveGearReward` | 16051 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `applyGroveGearReward` | 16057 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `showGroveRewardCard` | 16076 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `grantGroveNestReward` | 16090 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `startGroveAmbushBattle` | 16094 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `showGroveEvent` | 16143 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `enterGrove` | 16181 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `resolveGrove` | 16194 | Endless/Meta | No (internal) | Medium | js/systems/endless-map.js |
| `groveFinish` | 16307 | Endless/Meta | Yes (data-action in index.html) | Medium | js/systems/endless-map.js |
| `pickRandom` | 16316 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `showVictory` | 16318 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `showDefeat` | 16382 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `flightRescuedNestCount` | 16414 | Nest | No (internal) | Medium | js/ui/nest-ui.js |
| `showRunStats` | 16419 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `hideStoryCinematic` | 16444 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `startStoryCinematic` | 16449 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `getAudioCtx` | 16495 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeAudioIfNeeded` | 16500 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundButtonLabel` | 16506 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncSoundStateFromSettings` | 16515 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `toggleSound` | 16520 | Audio | Yes (data-action in index.html) | Medium | js/audio/bgm-shared.js |
| `playTone` | 16536 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `doScreenShake` | 16578 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resetBattleStats` | 16591 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getBattleSummaryStats` | 16592 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `renderBattleSummary` | 16606 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `updateStageProgress` | 16620 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveRunHistory` | 16736 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderRunHistory` | 16749 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `refAbilityEnergyCost` | 16789 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityCodexType` | 16798 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `refAbilityPassesEnFilter` | 16804 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `buildRefFilterBarHtml` | 16814 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `wireRefFilterSelects` | 16846 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openRefGuideModal` | 16877 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeRefGuideModal` | 16885 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `toggleRefGuide` | 16893 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `selectRefTab` | 16900 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `skillCard` | 16906 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `refSkillScalingLabel` | 16925 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `buildRefGuide` | 16932 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderReferenceGuide` | 17128 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `checkRunUnlocks` | 17138 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `showUnlockToast` | 17145 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `makeUtilityOffer` | 17162 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `assignShopItems` | 17168 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopItemsToGlobal` | 17172 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `showStorkShop` | 17182 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `enterStorkShopScreen` | 17187 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopMutationTierKey` | 17224 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `ensureShopMutationTierOpenState` | 17230 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopMutationTierSections` | 17235 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `resolveShopItemCategory` | 17269 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopGearCategoryTitle` | 17278 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopItemMatchesCategory` | 17282 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopCategoryLogText` | 17295 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `clearShopSelection` | 17309 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBaseCost` | 17316 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopItemBuyCost` | 17322 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedBuyTotal` | 17326 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopMarginalBuyCost` | 17341 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRemainingBudget` | 17349 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopSelectedSellTotal` | 17353 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `syncShopDock` | 17362 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopBuyButtonState` | 17390 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `updateShopSellButtonState` | 17400 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `appendShopSectionHeading` | 17410 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `buildShopBuyCard` | 17417 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `setShopTab` | 17452 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getEquipmentSellPrice` | 17501 | Equipment | No (internal) | Medium | js/systems/equipment*.js |
| `getMutationSellPrice` | 17508 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `renderShopSellItems` | 17515 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSellSelected` | 17561 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopSlotIsStarterLocked` | 17593 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopEquipped` | 17597 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopUnequipSlot` | 17644 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `rollShopTier` | 17667 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `pickUniqueRewardByTier` | 17672 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `_findShopItemById` | 17682 | Shop | Yes (explicit global/Avian.actions) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `generateShopItems` | 17702 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopResetVisitState` | 17778 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopLockVisitState` | 17788 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `getShopRefreshCost` | 17792 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `renderShopItems` | 17797 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `purchaseShopItemAtIndex` | 17869 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopBuySelected` | 17914 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `shopRefresh` | 17969 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `exitStorkShop` | 17984 | Shop | No (internal) | Medium | js/systems/shop-v2.js / js/ui/shop-ui.js |
| `openAbandonModal` | 18031 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeAbandonModal` | 18034 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `confirmAbandon` | 18041 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `unlockAllCodexEntries` | 18067 | Bird selection | No (internal) | Medium | js/ui/ui.js |
| `isCreatorCodesEnabled` | 18117 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeSwitches` | 18118 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `isDevCodeEnabled` | 18121 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `saveDevCodeSwitches` | 18122 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `setDevCodeSwitch` | 18125 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getDevCodeCatalogRow` | 18131 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `applyBirdwatchingUnlock` | 18135 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyHeadingHomeLock` | 18141 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `setGoldenGooseInfiniteState` | 18152 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `toggleDevCode` | 18158 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `refreshAfterDevCode` | 18163 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `activateDevCode` | 18170 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `deactivateDevCode` | 18244 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyDevCodeSwitches` | 18278 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `renderSuppliesCodeTools` | 18309 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `renderSuppliesActivityLog` | 18324 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `setOwnedBirdTier` | 18330 | Rewards | No (internal) | Medium | js/systems/nest-rewards.js / js/ui/reward-screen.js |
| `isKnownDevCodePrefix` | 18334 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `checkDevCode` | 18339 | Bootstrap/Orchestration | Yes (explicit global/Avian.actions) | Medium | js/core/game.js (retain) |
| `getBgmApi` | 18396 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmAudio` | 18397 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMenuPreviewBgmAudio` | 18398 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getBattleBgmTargetVolume` | 18399 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopBattleBgmImmediate` | 18403 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeOut` | 18411 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginBattleBgmFadeIn` | 18432 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryStartBattleBgmIfNeeded` | 18452 | Audio | No (internal) | High | js/audio/bgm-shared.js |
| `stopMenuPreviewBgmImmediate` | 18473 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuPreviewActive` | 18479 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isMusicMenuScreen` | 18483 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `setAudioElTrack` | 18487 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `resolvedMusicTrackIdForRole` | 18503 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuNowPlaying` | 18510 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `syncMusicMenuAssignmentChips` | 18521 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncMusicMenuControls` | 18541 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyMusicPanelVolumeState` | 18558 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelVolume` | 18580 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicPanelMuted` | 18584 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicRoleChoice` | 18589 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMenuThemeForPreview` | 18609 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `playMusicMenuPreview` | 18614 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `stopMusicMenuPreview` | 18638 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `openMusicMenu` | 18655 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `closeMusicMenu` | 18664 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `cancelThemeBgmFade` | 18673 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginThemeBgmFadeOutForRunStart` | 18682 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getMusicSettings` | 18706 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `saveMusicSettings` | 18720 | Save/load | No (internal) | High | js/systems/save-migrations.js |
| `getThemeBgmAudio` | 18728 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBattleBgmAudio` | 18731 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `cancelDukeBgmFade` | 18734 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `getDukeBgmTargetVolume` | 18742 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeDukeBattleBgmAudio` | 18747 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgmImmediate` | 18753 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopDukeBattleBgm` | 18760 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `duckThemeBgmForBattle` | 18763 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeIn` | 18770 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `beginDukeBattleBgmFadeOut` | 18799 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `isDukeStoryBossFight` | 18832 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `tryStartDukeBattleBgmIfNeeded` | 18841 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `primeThemeBgmAudio` | 18862 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `tryPlayThemeBgmForCurrentMenuScreen` | 18868 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyDukeBattleBgmToAudioEl` | 18881 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `applyThemeMusicToAudioEl` | 18889 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `stopAllGameAudio` | 18914 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `syncThemeMusicButtonLabels` | 18927 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncThemeBgmPlaybackForScreen` | 18940 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `toggleThemeMusicMuted` | 18954 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 18971 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `wireThemeBgmAutoplayUnlock` | 18991 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `detectPreferredUIMode` | 19029 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `resolveUiMode` | 19035 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `normalizeCombatCustomLayout` | 19059 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `resetCombatCustomDraft` | 19080 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `getCombatCustomDraft` | 19083 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `normalizeCombatArrangement` | 19090 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeCombatLayout` | 19096 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `normalizeAccessibilitySettings` | 19107 | Utilities | No (internal) | Low | js/core/game-helpers.js |
| `getAccessibilitySettings` | 19133 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `bootstrapAccessibilityDefaults` | 19141 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `wireUiAutoDetectResize` | 19165 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `getAudioVolumeMultipliers` | 19183 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `selectSettingsTab` | 19191 | Bird selection | Yes (explicit global/Avian.actions) | Medium | js/ui/ui.js |
| `applyUIStateToDOM` | 19205 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `getAutoCombatDensityReduction` | 19216 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyEffectiveCombatScales` | 19223 | Enemy setup/AI | No (internal) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `applyCombatLayoutSettings` | 19242 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `clearCombatCustomPanelStyles` | 19246 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatCustomPanels` | 19254 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatCustomEditRow` | 19266 | Story/Overworld | No (internal) | Medium | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `renderCombatCustomPanelEditor` | 19275 | Combat UI | No (internal) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `openCombatCustomLayoutModal` | 19329 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeCombatCustomLayoutModal` | 19335 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `saveCombatCustomLayoutFromModal` | 19340 | Save/load | Yes (explicit global/Avian.actions) | High | js/systems/save-migrations.js |
| `resetCombatCustomLayoutDraft` | 19351 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `toggleCombatCustomPanelVisible` | 19355 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `moveCombatCustomPanel` | 19362 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `applyCombatArrangement` | 19381 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncCombatLayoutLabels` | 19395 | Combat | No (internal) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `syncAudioSettingLabels` | 19405 | Audio | No (internal) | Medium | js/audio/bgm-shared.js |
| `syncUiModeControls` | 19417 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `applyAccessibilitySettings` | 19432 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `openSettingsModal` | 19454 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `closeSettingsModal` | 19506 | Combat UI | Yes (data-action in index.html) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `returnToWarRoomFromSettings` | 19510 | Story/Overworld | Yes (explicit global/Avian.actions) | High | js/systems/story-run-state.js / js/world/overworld_bridge.js |
| `openAbandonFromSettings` | 19516 | Combat UI | Yes (explicit global/Avian.actions) | Medium | js/ui/combat-hud.js / js/ui/combat-log.js |
| `goMainMenuFromSettings` | 19521 | Enemy setup/AI | Yes (explicit global/Avian.actions) | Medium | js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js |
| `resetCombatLayoutSettings` | 19532 | Combat | Yes (explicit global/Avian.actions) | High | js/systems/combat-controller.js / js/systems/ability-dispatcher.js |
| `updateAccessibilitySettings` | 19544 | Bootstrap/Orchestration | No (internal) | Medium | js/core/game.js (retain) |
| `updateAudioSettingsFromControls` | 19590 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |
| `updateMusicSettingsFromControls` | 19616 | Audio | Yes (explicit global/Avian.actions) | Medium | js/audio/bgm-shared.js |

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
