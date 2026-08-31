# Global UI API (Step 7)

Required browser-callable actions resolved by `js/ui/event-router.js` via `Avian.actions[name]` with fallback to `globalThis[name]`.

## data-action handlers (96)

- `activateMapForNextRun`
- `addWorldTemplate`
- `afterLevelUp`
- `applyDevCodeSwitches`
- `backToCharacterSelectBirds`
- `bulkApplyEncounter`
- `bulkApplyRewards`
- `bulkSelectAllStages`
- `cancelMapForgeDiscard`
- `closeAbandonModal`
- `closeAbilityModModal`
- `closeBirdUpgradePreview`
- `closeClearCacheModal`
- `closeCombatBreakdown`
- `closeCombatCustomLayoutModal`
- `closeCombatHistory`
- `closeCombatStatsModal`
- `closeEraseProgressModal`
- `closeMapForge`
- `closeMotherGooseHatchModal`
- `closeMusicMenu`
- `closeNest`
- `closeRefGuideModal`
- `closeSelectHubPanel`
- `closeSettingsModal`
- `closeWarRoomTutorial`
- `confirmAbandon`
- `confirmBirdUpgradePreview`
- `confirmClearCache`
- `confirmEraseProgress`
- `confirmMapForgeDiscard`
- `confirmReward`
- `confirmRunSettings`
- `confirmSkillUpgrade`
- `continueRun`
- `copyMapForgeConfig`
- `deleteMapForgeNode`
- `deselectMapForgeNode`
- `duplicateMapForgeNode`
- `editStartMap`
- `editWorldMap`
- `exitWorldEditor`
- `exportCombatTelemetry`
- `exportMapForge`
- `fightMapForgeNode`
- `flyAgain`
- `goMainMenu`
- `goMainMenuFromSettings`
- `groveFinish`
- `hatchMotherGooseNow`
- `loadCurrentStoryMapIntoForge`
- `mapForgeZoom100`
- `mapForgeZoom200`
- `mapForgeZoomFit`
- `newMapForge`
- `openAbandonFromSettings`
- `openClearCacheModal`
- `openCombatCustomLayoutModal`
- `openCombatHistory`
- `openCombatScenarioTest`
- `openConsoleHud`
- `openEraseProgressModal`
- `openInventorySavedNests`
- `openMapForge`
- `openMapForgeLibrary`
- `openMusicMenu`
- `openNest`
- `openRunSettings`
- `openSelectHubPanel`
- `openSettingsModal`
- `openWarRoomTutorial`
- `pasteMapForgeConfig`
- `playMusicMenuPreview`
- `playtestFromSelectedNode`
- `playtestMapForge`
- `redoMapForge`
- `resetCombatCustomLayoutDraft`
- `resetCombatLayoutSettings`
- `resetLuFeatherDraft`
- `saveCombatCustomLayoutFromModal`
- `saveMapForgeDraft`
- `selectSettingsTab`
- `selectWarRoomTutorialTab`
- `setCharacterSelectView`
- `setFortuneSubView`
- `setHatcherySubView`
- `setInventorySubView`
- `setMissionMapVariant`
- `setSuppliesSubView`
- `startGame`
- `stopMusicMenuPreview`
- `takeFlightToSelect`
- `toggleMapForgeHelp`
- `toggleSound`
- `toggleThemeMusicMuted`
- `undoMapForge`

## data-change handlers (6)

- `onMissionTestMapChange`
- `onRosterFilterChange`
- `updateAccessibilitySettings`
- `updateAudioSettingsFromControls`
- `updateMusicPanelMuted`
- `updateMusicRoleChoice`

## data-input handlers (4)

- `checkDevCode`
- `updateAccessibilitySettings`
- `updateAudioSettingsFromControls`
- `updateMusicPanelVolume`

## data-submit handlers (0)



## Legacy inline onclick (game.js generated HTML)

- `hideTooltip()` — combat tooltip close button in rich tooltips

## Explicit globalThis exports

See `scripts/verify-architecture.mjs` for the authoritative required-global list maintained in CI.

Regenerate: `node scripts/generate-global-ui-api.mjs`
