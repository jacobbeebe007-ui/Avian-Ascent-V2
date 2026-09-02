/* Avian Ascent — battle loadout and loadStage (Step 7 Phase 7). */
/** Stats that may be temporarily modified during combat — snapshotted at battle start and restored when combat ends. */
const BATTLE_TEMP_PLAYER_STAT_KEYS = ['atk','dex','def','spd','dodge','mdef','matk','critChance'];

function captureBattleTempPlayerStats(){
  if(!G.player?.stats) return;
  const snap = {};
  for(const k of BATTLE_TEMP_PLAYER_STAT_KEYS){
    const v = G.player.stats[k];
    snap[k] = (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  }
  G._battleTempPlayerStatsSnapshot = snap;
  const p = G.player.stats;
  G.player._battleStatBase = {
    atk: Number(p.atk) || 0,
    dex: Number(p.dex) || 0,
    matk: Number(p.matk) || 0,
    def: Number(p.def) || 0,
    mdef: Number(p.mdef) || 0,
    dodge: Number(p.dodge) || 0,
    /* v0.6+: Precision is character-stored Base Precision (class + size + species). */
    acc: Number.isFinite(Number(p.acc)) ? Number(p.acc) : 0,
    spd: Number(p.spd) || 0,
    critChance: Number(p.critChance) || 5,
  };
}

function restoreBattleTempPlayerStats(){
  const snap = G._battleTempPlayerStatsSnapshot;
  if(!snap || !G.player?.stats){
    G._battleTempPlayerStatsSnapshot = null;
    return;
  }
  for(const k of BATTLE_TEMP_PLAYER_STAT_KEYS){
    if(Object.prototype.hasOwnProperty.call(snap, k)) G.player.stats[k] = snap[k];
  }
  G._battleTempPlayerStatsSnapshot = null;
  reapplyPlayerGearStats(G.player);
}

function prepareEnemyCombatLoadout(enemy){
  if(!enemy) return;
  if(typeof Avian?.equipment?.assignEnemyEquipmentLoadout==='function'){
    if(!enemy._equipmentApplied){
      const stage=Math.max(1, Math.floor(Number(G && G.stage) || 1));
      const endless=!!(G && G.endlessMode);
      const useStoryRecipe=!endless && stage<=20;
      const tier=enemy.combatTier || enemy.enemyTier || (enemy.isBoss ? 'boss' : (enemy.isElite ? 'elite' : 'normal'));
      Avian.equipment.assignEnemyEquipmentLoadout(enemy, {
        tier,
        stage: useStoryRecipe ? stage : undefined,
        mirrorPlayerEquipment: !!endless,
        player: G && G.player,
        difficulty: G && G.difficulty,
      });
    }else if(typeof Avian?.equipmentActions?.syncEntityAbilities==='function'){
      Avian.equipmentActions.syncEntityAbilities(enemy);
    }
    if(enemy.stats) normalizeCombatStats(enemy.stats);
    if(!(enemy.abilities||[]).some(a=>a&&!a.empty)){
      console.warn('[combat] empty enemy equipment abilities after sync', enemy.birdKey||enemy.name, enemy.id);
    }
    return;
  }
  if(typeof ensureFamilyEvolutionState==='function') ensureFamilyEvolutionState(enemy);
  if(typeof syncPlayerAbilitiesFromSkillSlots==='function') syncPlayerAbilitiesFromSkillSlots(enemy);
  if(enemy.stats) normalizeCombatStats(enemy.stats);
  const abs=enemy.abilities||[];
  if(abs.length<1 && enemy.birdKey && typeof materializeEnemySkillsFromWorkbookKit==='function'){
    const lv=Math.max(1, Number(enemy.storyLevel||enemy.effectiveLevel)||1);
    const cls=enemy.enemyClass||inferEnemyClassFromStyle(enemy.aiStyle)||'predator';
    materializeEnemySkillsFromWorkbookKit(enemy, enemy.birdKey, lv, cls);
  }
  if(!(enemy.abilities||[]).length){
    console.warn('[combat] empty enemy abilities after loadout sync', enemy.birdKey||enemy.name, enemy.id);
  }
}

function preparePlayerCombatLoadout(player){
  if(!player) return;
  if(typeof applyOwnedFortuneArtifacts==='function') applyOwnedFortuneArtifacts(player);
  if(typeof applyBirdCardProgression==='function') applyBirdCardProgression(player);
  reapplyPlayerGearStats(player);
  applyPlayerSkillsFromCardTier(player);
  ensureFamilyEvolutionState(player);
  if(typeof Avian?.equipmentActions?.syncEntityAbilities==='function'){
    Avian.equipmentActions.syncEntityAbilities(player);
  }else{
    syncPlayerAbilitiesFromSkillSlots(player);
  }
  ensureMainAttackAndLoadoutRules();
  enforceAbilityCosts(player);
  const abs=player.abilities||[];
  if(abs.length<1){
    console.warn('[combat] empty abilities after loadout sync', player.birdKey);
    if(typeof logMsg==='function') logMsg('⚠ No abilities equipped — recovering turn.','system');
    if(typeof failsafeAdvance==='function') failsafeAdvance('empty abilities');
  }
}

function normalizeBattleTurnState(){
  G.animLock=false;
  G.actionBusy=false;
  G.actionQueue=[];
  if(G.turnPhase===TURN.RESOLVING){
    G.turnPhase=G.turn==='enemy'?TURN.ENEMY:TURN.PLAYER;
    G.phase=G.turn==='enemy'?'ENEMY':'PLAYER';
  }
  if(G.player&&G.enemy&&!G.battleOver){
    if(G.turn==='player'){
      G.phase='PLAYER';
      G.turnPhase=TURN.PLAYER;
    }else if(G.turn==='enemy'){
      G.phase='ENEMY';
      G.turnPhase=TURN.ENEMY;
    }else if(G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER){
      G.turn='player';
    }else if(G.phase==='ENEMY'&&G.turnPhase===TURN.ENEMY){
      G.turn='enemy';
    }
  }
  syncCombatTurnFlags();
}

function resetForNewBattle(){
  if(Avian?.systems?.combatBreakdown?.reset){
    Avian.systems.combatBreakdown.reset({
      battleId:`battle-${Date.now()}`,
      bird:G?.player?.birdKey||G?.player?.name||null,
      enemy:G?.enemy?.id||G?.enemy?.name||null,
      equipment:G?.player?.equipment||null,
    });
  }
  G.playerStatus={};
  G.enemyStatus={};
  if(G.player?.stats){
    G.player.stats.shieldHp=0; G.player.stats.maxShieldHp=0;
    if(Avian.protection&&typeof Avian.protection.resetCombatPools==='function'){
      Avian.protection.resetCombatPools(G.player);
    } else {
      G.player.stats.armour=Number(G.player.stats.normalMaxArmour||G.player.stats.maxArmour||0);
      G.player.stats.magicArmour=Number(G.player.stats.normalMaxMagicArmour||G.player.stats.maxMagicArmour||0);
      G.player.stats.maxArmour=G.player.stats.armour;
      G.player.stats.maxMagicArmour=G.player.stats.magicArmour;
    }
  }
  if(G.enemy?.stats){
    G.enemy.stats.shieldHp=0; G.enemy.stats.maxShieldHp=0;
    if(Avian.protection&&typeof Avian.protection.resetCombatPools==='function'){
      Avian.protection.resetCombatPools(G.enemy);
    } else {
      G.enemy.stats.armour=Number(G.enemy.stats.normalMaxArmour||G.enemy.stats.maxArmour||0);
      G.enemy.stats.magicArmour=Number(G.enemy.stats.normalMaxMagicArmour||G.enemy.stats.maxMagicArmour||0);
      G.enemy.stats.maxArmour=G.enemy.stats.armour;
      G.enemy.stats.maxMagicArmour=G.enemy.stats.magicArmour;
    }
  }
  G.crowDefendCooldown=0; G.blackbirdAttackCount=0;
  G.swoopCooldown=0; G.hummingbirdDashCooldown=0; G.peregrineDiveCooldown=0; G.snowyOwlDiveCooldown=0; G.robinDartCooldown=0; G.bowerbirdLureCooldown=0; G.intimidateCooldown=0; G.fruitCooldown=0;
  G.stickLanceStage=0; G.flybyCharged=false; G.flybyUsed=false;
  G.rockDropPending=false; G.humTurns=0; G.humMissBonus=0;
  G.chargeUpActive=false; G.warcryActive=false; G.warcryATK=0;
  G.battleHymnActive=false; G.battleHymnDEF=0; G.battleHymnACC=0;
  G.enemyRageActive=false; G.enemyTurnCount=0;
  G.serratedStacks=0; G.sitAndWaitActive=false;
  G.tookieActive=false; G.tookieMiss=0;
  G.tauntActive=false; G.regenTurns=0; G.regenPct=0;
  G.activeDodgeBuffs={}; G.activeAccBuffs={};
  G._roostData=null;
  G.animLock=false; G.battleOver=false;
  G.actionQueue=[]; G.actionBusy=false;
  G._goldReplaceMode=false;
  G._perkIronCoreUsed=false;
  G._perkFirstVsFullUsed=false;
  G._perkUtilityRefundUsed=false;
  G.turnCount=0;
  G._playerEnergyTurnIndex=0;
  G._enemyEnergyTurnIndex=0;
  G._incomingAttackKind=null;
  delete G._pendingStrikeActionMods;
  G._firstAttackUsed=false;
  G._firstSpellUsed=false;
  G._spellCastCount=0;
  if(G.player){
    G.player._mimicStored=null;
    G.player._firstHitReducedUsed=false;
    G._mutationBloodiedSelfFired=false;
    G.player._lowHpSpdApplied=false;
    G.player._lowHpDefApplied=false;
    G.player._survivorMoltUsed=false;
    G.player._mimicUsed=false;
    G.player._mimicAbility=null;
    G.player._blueJayHitLastTurn=false;
    G.player._blueJayRecentHit=false;
    G.player._shoebillHadUtilityPriorTurn=false;
    G.player._crowMurderMindUsed=false;
    G.player._sheetNextCrit=0;
    G.player._hbUtilityFirst=true;
    G.player._macawLastTurnFam='';
    G.player._emuDustUsed=false;
    G.player.energyMax=computePlayerMaxEnergy();
    G.player.energy=computePlayerStartEnergy(G.player);
    G.player.energyRegen=computePlayerEnergyRegen(G.player);
    delete G.player._magpieSpdLoan;
    delete G.player._ostrichSpdLoan;
    delete G.player._albatrossSpdLoan;
    delete G.player._ravenGrimSpdLoan;
  }
  if(G.enemy){
    const enProf=getEnemyEnergyProfile();
    G.enemy.energyMax=enProf.maxEN;
    G.enemy.energy=enProf.startEN;
    G.enemy.energyRegen=enProf.regenEN;
  }
}

function normalizeEnemyNameKey(name){
  return String(name||'').toLowerCase().replace(/[^a-z]/g,'');
}

/** Story / endless tier band 1–5 from stage depth (matches loadStage). */
function storyTierFromStage(stage){
  const s=Math.max(1,Number(stage)||1);
  if(s<=5) return 1;
  if(s<=10) return 2;
  if(s<=15) return 3;
  if(s<=19) return 4;
  return 5;
}

/** Legacy shim: build draft from roster id or birdKey token. */
function buildEdFromBirdEnemyTemplate(src, opts={}){
  if(!src) return null;
  if(typeof src==='string'){
    if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(src)&&typeof buildEnemyFromRosterId==='function'){
      return buildEnemyFromRosterId(src,opts);
    }
    return buildOwEnemyDraftFromBirdKey(src, G.stage||1);
  }
  if(src.id&&typeof buildEnemyFromRosterId==='function') return buildEnemyFromRosterId(src.id,opts);
  if(src.birdKey) return buildOwEnemyDraftFromBirdKey(src.birdKey, G.stage||1);
  return null;
}

function pickRandomBirdEnemyDraftForStage(stageNumber, opts={}){
  const ids=typeof pickStoryEncounterEnemyIds==='function'
    ? pickStoryEncounterEnemyIds(stageNumber, G.player?.birdKey||'', 1)
    : ['EN-SPARR-HESQ-L01'];
  return buildEdFromBirdEnemyTemplate(ids[0], opts);
}

function pickRandomBirdEnemyDraft(tier, opts={}){
  void tier;
  const rosterId=typeof pickEndlessRosterEnemyId==='function'
    ? pickEndlessRosterEnemyId(G.stage||1, !!opts.isBoss, Math.max(1, Math.floor(G.player?.birdLevel||1)))
    : 'EN-SPARR-HESQ-L01';
  return buildEdFromBirdEnemyTemplate(rosterId, opts);
}

function bossTitleForStageMilestone(stage){
  const idx=Math.max(0,Math.floor(Number(stage)/10)-1);
  const titles=['⚡ Stage Boss','🌩 Stage Boss','🌀 Stage Boss','👑 Stage Boss'];
  return titles[Math.min(idx,titles.length-1)];
}

/** After battle DOM is shown, wait for layout then run the first enemy turn (speed initiative). */
const OPENING_ENEMY_DELAY_MS = 920;
function scheduleOpeningEnemyTurn(){
  const tick=()=>{
    try{
      primeAudioIfNeeded();
      const scr=document.getElementById('screen-battle');
      if(scr&&typeof scr.scrollIntoView==='function'){
        try{ scr.scrollIntoView({block:'nearest',behavior:'smooth',inline:'nearest'}); }
        catch(_){ try{ scr.scrollIntoView(false); }catch(__){} }
      }
    }catch(_){}
    const nm=G.enemy?.name?String(G.enemy.name):'';
    showBattleCaption(nm?`${nm} strikes first!`:'Enemy strikes first!',780);
    setTimeout(()=>{
      enemyTurn().catch(err=>{
        console.error('[combat] opening enemyTurn failed', err);
        G.animLock=false;
        if(typeof lockActionUI==='function') lockActionUI(false);
        if(typeof normalizeBattleTurnState==='function') normalizeBattleTurnState();
        if(G.player?.stats?.hp>0 && G.enemy?.stats?.hp>0 && typeof afterEnemyTurn==='function') afterEnemyTurn();
      });
    },OPENING_ENEMY_DELAY_MS);
  };
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>requestAnimationFrame(tick));
  else setTimeout(tick,0);
}

function loadStage() {
  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:loadStage:entry',message:'loadStage start',data:{encounterStage:typeof getEncounterStage==='function'?getEncounterStage():null,owEnemies:G._owStageEnemies,owIdx:G._owEnemyIndex},timestamp:Date.now(),hypothesisId:'H2,H3'})}).catch(()=>{});
  // #endregion
  // Overworld shop: open the shop instead of a battle.
  if (G._pendingOverworldShop) {
    G._pendingOverworldShop = false;
    showStorkShop('grey');
    return;
  }
  G.autoQueuedAbilityId=null;
  G._breakClampStreak=0;
  G.abilityCooldowns=G.abilityCooldowns||{};
  const encounterStage = getEncounterStage();
  syncStoryEncounterBirdQueue(encounterStage);
  const stageSequenceLabel = (!G.endlessMode && (G._owEnemyCount||0) > 1)
    ? ` · Battle ${Math.min((G._owEnemyIndex||0)+1, G._owEnemyCount)} of ${G._owEnemyCount}`
    : '';
  ensureOwEncounterMaterialized(encounterStage);
  let ed;
  let skipEnemyScalarMerge = false;
  // Overworld stage: use pre-materialized snapshot so preview matches battle rolls
  if (!G.endlessMode && G._owStageEnemies?.length > 0) {
    const idx = G._owEnemyIndex || 0;
    const mat = G._owEncounterMaterialized?.[idx];
    if(mat){
      ed = JSON.parse(JSON.stringify(mat));
      skipEnemyScalarMerge = true;
    } else {
      const bk = G._owStageEnemies[idx];
      ed = buildOwEnemyDraftFromBirdKey(bk, encounterStage, idx);
    }
  }
  const diffMult = DIFFICULTIES[G.difficulty||'juvenile'].mult;

  if (G.endlessMode && (isEndlessMapActive() || encounterStage > ENDLESS_STORY_END_STAGE)) {
    if (isEndlessMapActive()) {
      G.endlessBattle = Math.max(0, Math.floor(Number(G.endlessBattle) || 0));
    } else {
      G.endlessBattle = getEndlessEffectiveBattleNumber(encounterStage);
    }
    ed = makeEndlessEnemy(encounterStage);
  } else if (!ed) {
    const stage = encounterStage;
    if (stage === STORY_DUKE_STAGE && !G.endlessMode) {
      ed = makeDukeBlakiston();
    } else if (stage === STORY_MILESTONE_BOSS_STAGE && !G.endlessMode) {
      const bossTok = G._owStageEnemies?.[0]
        || (typeof pickStoryEncounterEnemyIds === 'function'
          ? pickStoryEncounterEnemyIds(stage, G.player?.birdKey||'', 1)[0]
          : null);
      ed = buildOwEnemyDraftFromBirdKey(bossTok||'harpy', stage);
      if(ed){
        ed.isBoss=true;
        ed.bossTitle=bossTitleForStageMilestone(stage);
      }
    } else if (!G.endlessMode) {
      const bk = G._owStageEnemies?.[G._owEnemyIndex || 0];
      if (bk) ed = buildOwEnemyDraftFromBirdKey(bk, stage, G._owEnemyIndex || 0);
    } else {
      ed = pickRandomBirdEnemyDraftForStage(stage, { isBoss: false });
    }
  }
  if(ed && !skipEnemyScalarMerge){
    mergeScaledStatsIntoEnemy(ed, encounterStage);
  }
  G.enemy = ed;
  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:loadStage:enemySet',message:'G.enemy assigned',data:{hasEnemy:!!G.enemy,enemyId:G.enemy?.id||G.enemy?.name||null,hasStats:!!G.enemy?.stats,birdKey:G._owStageEnemies?.[G._owEnemyIndex||0]||null},timestamp:Date.now(),hypothesisId:'H2,H5'})}).catch(()=>{});
  // #endregion
  if (G.enemy && G.enemy.stats) {
    const base = G.enemy._statBaseBeforeMutations || G.enemy.stats;
    G.enemy._battleStatBase = {
      atk: Number(base.atk) || 0,
      dex: Number(base.dex) || 0,
      matk: Number(base.matk) || 0,
      def: Number(base.def) || 0,
      mdef: Number(base.mdef) || 0,
      dodge: Number(base.dodge) || 0,
      acc: Number(base.acc) || 0,
      spd: Number(base.spd) || 0,
    };
  }
  const stageEvt = {stage:encounterStage, enemyId:G.enemy.id||G.enemy.name, isBoss:!!G.enemy.isBoss};
  AvianEvents.emit('stage:loaded', stageEvt);
  runModuleHook('onStageLoaded', stageEvt);
  if(!G.enemy.aiType) G.enemy.aiType=mapAiStyleToType(G.enemy.aiStyle);
  if(!G.enemy.aiPersonality) G.enemy.aiPersonality=inferAIPersonalityFromStyle(G.enemy.aiStyle,G.enemy.name);
  codexMark('enemies', G.enemy.id||G.enemy.name, 'seen');
  enforceAbilityCosts(G.player);
  applyBiomeModifiers();
  // Remove stat bonuses before resetting flags (avoid accumulating across battles)
  resetForNewBattle();
  if(isEndlessMapActive() && G.endlessMap?.pendingRestShieldPct > 0){
    const pct = Number(G.endlessMap.pendingRestShieldPct) || 0;
    if(pct > 0 && typeof applyShieldHp === 'function'){
      applyShieldHp('player', {
        maxHpPct: Math.round(pct * 100),
        turns: 99,
        sourceId: 'endless-rest',
        sourceKind: 'rest',
      });
      if(typeof spawnFloat === 'function'){
        spawnFloat('player', `🛡 ${Math.round(pct * 100)}%`, 'fn-heal');
      }
      logMsg(`Rest Fortify armed (${Math.round(pct * 100)}% Max Health → Armour).`, 'system');
    }
    G.endlessMap.pendingRestShieldPct = 0;
  }
  recomputeClassPerkEffects();
  // Reset Goose bruise accumulator per battle
  if(G.player._bruiseAcc!==undefined) G.player._bruiseAcc=0;
  // Reset battle stats
  resetBattleStats();
  // Clear any visual carry-overs from last battle
  document.getElementById('player-panel')?.classList.remove('player-danger');
  document.getElementById('enemy-panel')?.classList.remove('boss-phase-two');
  const pb=document.getElementById('boss-phase-banner');if(pb){pb.textContent='';pb.classList.remove('visible');}
  preparePlayerCombatLoadout(G.player);
  if(needsUltimateSourcePick(G.player)){
    logMsg('⚡ Multiple ultimates equipped — open Nest (Esc) to choose your Ultimate source.','system');
  }
  prepareEnemyCombatLoadout(G.enemy);
  // Bird passive hooks (onBattleStart) — after loadout so mutation/equipment stats are applied first
  const bd2=BIRDS[G.player.birdKey||'sparrow'];
  if(bd2&&bd2.passive&&bd2.passive.onBattleStart) bd2.passive.onBattleStart(G.player);
  if(typeof Avian?.passives?.onBattleStart==='function') Avian.passives.onBattleStart();
  if(typeof Avian?.equipmentEffects?.onBattleStart==='function') Avian.equipmentEffects.onBattleStart(G.player);
  if((G.player?.openingEnemyFear||0)>0){
    G.enemyStatus.feared=Math.max(G.enemyStatus.feared||0, G.player.openingEnemyFear);
  }
  if(G.player?.relTensionCoil && G.player.stats.hp<=Math.floor((G.player.stats.maxHp||1)*0.5)){
    G.playerStatus.tensionCoil={turns:1,pct:0.15};
  }
  captureBattleTempPlayerStats();
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterPrepareLoadout', 'after preparePlayerCombatLoadout', { abilityCount: G.player?.abilities?.length || 0, mainAttackId: G.player?.mainAttackId || null }, 'H5');
  // #endregion
  normalizeBattleTurnState();
  // Speed determines first turn
  const pSpd=G.player.stats.spd, eSpd=G.enemy.stats.spd;
  G.turn = pSpd >= eSpd ? 'player' : 'enemy';
  G.turnPhase = G.turn==='player'?TURN.PLAYER:TURN.ENEMY;
  G.phase = G.turn==='player' ? 'PLAYER' : 'ENEMY';
  if(G.turn==='player') startPlayerTurn(G.player);
  else if(G.enemy) syncEnemyEnergyForBattleDisplay(G.enemy);
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterStartPlayerTurn', 'after turn init', { turn: G.turn, playerEnergy: G.player?.energy, enemyHp: G.enemy?.stats?.hp }, 'H5');
  // #endregion
  G.enemyNextAction = planEnemyAction();
  showScreen('screen-battle');
  const _battleAccCfg=getAccessibilitySettings();
  applyCombatLayoutSettings(_battleAccCfg);
  applyCombatArrangement(_battleAccCfg);
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterShowScreen', 'battle screen shown', { activeScreen: document.querySelector('.screen.active')?.id || null }, 'H5');
  // #endregion
  const _battleLogEl=document.getElementById('battle-log'); if(_battleLogEl) _battleLogEl.innerHTML='';
  updateBattleArena();
  initBattleLogDrawer();
  updateStageProgress();
  if(G.player) ensureMainAttackAndLoadoutRules();
  refreshBattleUI();
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterRefreshBattleUI', 'refreshBattleUI done', { actionsGrid: !!document.getElementById('actions-grid') }, 'H5');
  // #endregion
  if (G.enemy.isBoss) {
    const stageLabel = G.endlessMode && encounterStage > 20
      ? `Endless Battle ${G.endlessBattle}` : `Stage ${encounterStage}`;
    logMsg(`👑 ${G.enemy.bossTitle}: ${G.enemy.name} descends! [${stageLabel}${stageSequenceLabel}]`,'boss');
    logMsg(`Defeat them for a guaranteed Epic reward!`,'system');
    SFX.boss(); doScreenShake(true);
  } else {
    logMsg(`⚔ Stage ${encounterStage}${stageSequenceLabel}: ${G.enemy.name} appears!`,'system');
  }
  if (G.turn==='enemy') {
    logMsg(`⚡ ${G.enemy.name} (SPD ${G.enemy.stats.spd}) is faster — they strike first!`,'miss');
    scheduleOpeningEnemyTurn();
  }
  tryStartDukeBattleBgmIfNeeded();
  tryStartBattleBgmIfNeeded();
  // #region agent log
  _agentDbgLog('game.js:loadStage:complete', 'loadStage complete', { turn: G.turn, battleOver: !!G.battleOver }, 'H5');
  // #endregion
}
globalThis.prepareEnemyCombatLoadout = prepareEnemyCombatLoadout;
globalThis.loadStage = loadStage;
