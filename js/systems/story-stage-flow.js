/* Avian Ascent — story stage transition flow (Step 7 Phase 6). */
function resumeAfterGrove(){
  if(isEndlessMapActive() && G.endlessMap?.fromMapGrove){
    returnToEndlessMapFromSideRoom();
    return;
  }
  G._skipGroveRoll = true;
  continueStageTransitionAfterRewards();
  G._skipGroveRoll = false;
}

function continueStageTransitionAfterRewards(){
  if (isEndlessMapActive()) {
    finishEndlessMapAfterCombat();
    return;
  }
  if(!hasMultiEnemyChainPending() && maybeOfferPassiveEvolutionChoice()) return;
  if(!hasMultiEnemyChainPending() && maybeOfferClassPerkChoice()) return;

  const lastEnemyWasBoss = G.enemy && G.enemy.isBoss;
  const safeHP = G.player.stats.hp > G.player.stats.maxHp * 0.2;
  const multiEnemyChainPending = hasMultiEnemyChainPending();
  // Random Grove is Story / non-map Endless only — map Unknown rooms open Grove intentionally.
  if(!G._skipGroveRoll && !lastEnemyWasBoss && safeHP && Math.random() < 0.1 && !multiEnemyChainPending){
    setTimeout(()=>showGroveEvent(), 350);
    return;
  }

  G.phase='PLAYER';
  if (multiEnemyChainPending) {
    G._owEnemyIndex++;
    saveRun();
    loadStage();
    return;
  }
  resetStageBattleStats();
  if (G._owForgeReturnToForge) {
    G._owForgeReturnToForge = false;
    G._owForgeNavMeta = null;
    G._owForgeEncounter = null;
    G._owForgePowerTier = 0;
    clearOverworldPendingBattle();
    saveRun();
    if (typeof showScreen === 'function') showScreen('screen-map-forge');
    if (typeof globalThis.openMapForge === 'function') globalThis.openMapForge({ skipReload: true });
    return;
  }
  if (!G.endlessMode && _isOverworldRun()) {
    const forgeMeta = G._owForgeNavMeta || null;
    if (forgeMeta && typeof globalThis.markOwNodeCleared === 'function' && forgeMeta.mapId != null && G._owPendingNodeId != null) {
      globalThis.markOwNodeCleared(forgeMeta.mapId, G._owPendingNodeId);
      if (forgeMeta.isBonus && typeof globalThis.incrementBonusRepeatCount === 'function') {
        globalThis.incrementBonusRepeatCount(forgeMeta.mapId, G._owPendingNodeId);
      }
      const rewardList = forgeMeta.clearRewards?.length
        ? forgeMeta.clearRewards
        : (forgeMeta.isBonus && forgeMeta.bonusConfig?.rewards ? forgeMeta.bonusConfig.rewards : null);
      if (rewardList?.length && typeof globalThis.grantForgeClearRewards === 'function') {
        const granted = globalThis.grantForgeClearRewards(G.player, rewardList, G);
        if (granted.shinies > 0) {
          logMsg('Clear reward: +' + granted.shinies + ' shinies!', 'boss');
        }
        if (granted.mutations?.length) {
          logMsg('Clear reward: mutation added to nest inventory!', 'boss');
        }
        if (granted.equipment?.length) {
          logMsg('Clear reward: equipment added to nest inventory!', 'boss');
        }
        const pendingChoice = granted.pendingEquipmentChoice?.[0];
        if (pendingChoice && typeof globalThis.buildForgeEquipmentChoicePool === 'function') {
          const pool = globalThis.buildForgeEquipmentChoicePool(pendingChoice, G.player);
          if (pool.length && typeof globalThis.showForgeEquipmentChoiceReward === 'function') {
            G._owForgeReturnToForge = true;
            globalThis.showForgeEquipmentChoiceReward(pool);
            return;
          }
        }
      }
      if (forgeMeta.isWorldInterior && G.enemy?.isBoss && forgeMeta.worldId && typeof globalThis.markOwWorldCompleted === 'function') {
        globalThis.markOwWorldCompleted(forgeMeta.worldId);
        const stack = typeof globalThis.readOwMapStack === 'function' ? globalThis.readOwMapStack() : [];
        const entry = stack[stack.length - 1];
        if (entry && typeof globalThis.markOwNodeCleared === 'function') {
          globalThis.markOwNodeCleared(entry.parentMapId || 'main', entry.returnNodeId);
        }
      }
    }
    if (!forgeMeta?.skipMainStageAdvance) {
      finalizeOverworldStageClear(G._owPendingBattleStage || G.stage, G._owPendingNodeId, {
        shinyGain: G._owSequenceShiny || 0,
        enemiesDefeated: G._owEnemyCount || G._owStageEnemies?.length || 1,
      });
    }
    G._owForgeNavMeta = null;
    G._owForgeEncounter = null;
    G._owForgePowerTier = 0;
    clearOverworldPendingBattle();
    saveRun();
    try{
      const owp=G._overworldProgress;
      const nid=owp && Number.isFinite(Number(owp.currentNodeId)) ? Math.floor(Number(owp.currentNodeId)) : 0;
      if(typeof globalThis.persistOwMapSnapshot==='function')
        globalThis.persistOwMapSnapshot(nid, G.player?.birdKey||null);
    }catch(_){}
    try { window.location.href = 'blackstone_overworld_new.html'; return; } catch(_) {}
  } else if (G._owStageEnemies?.length) {
    G._owStageEnemies = null;
    G._owEnemyIndex = 0;
    G._owEnemyCount = 1;
    G._owEncounterRollStage = null;
    G._owEncounterDrafts = null;
    G._owEncounterDraftsSig = null;
    G._owEncounterMaterialized = null;
    G._owEncounterMaterializedSig = null;
  }
  loadStage();
}

function afterLevelUp() {
  // After level-up: go to Stork shop if it was a boss (non-overworld only), otherwise advance
  if(G._pendingStorkShop && !_isOverworldRun() && !isEndlessMapActive()){
    const m=G._pendingShopMode||'boss'; G._pendingStorkShop=false; G._pendingShopMode=null; showStorkShop(m);
  } else {
    G._pendingStorkShop=false; G._pendingShopMode=null;
    if(isEndlessMapActive()) continueStageTransitionAfterRewards();
    else advanceStage();
  }
}

function advanceStage() {
  if (!G.endlessMode) Avian.storyRun?.winEncounter(!!G.enemy?.isBoss);
  G.stage++;
  if(isEndlessRunActive()) applyEndlessProgressionMilestones();
  // Story run ends after final story stage (20 for default Blackstone map)
  if(!G.endlessMode && G.stage > getStoryMaxStage()){
    try { localStorage.removeItem(_OW_STATE_KEY); localStorage.removeItem(_OW_NAV_KEY); } catch(_) {}
    deleteSave();
    showVictory();
    return;
  }
  // Stage 40 = endless battle 20 — grant unlock
  if(G.endlessMode&&G.endlessBattle>=20&&!isUnlocked('stage40')){
    grantUnlock('stage40');
    logMsg('🔓 Legendary birds unlocked: Shoebill Stork & Harpy Eagle!','boss');
  }
  saveRun();
  continueStageTransitionAfterRewards();
}
globalThis.continueStageTransitionAfterRewards = continueStageTransitionAfterRewards;
globalThis.advanceStage = advanceStage;
