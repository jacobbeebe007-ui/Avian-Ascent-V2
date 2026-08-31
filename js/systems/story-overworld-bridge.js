/* Avian Ascent — overworld return bridge (Step 7 Phase 6). */
/** True whenever the current run was launched via the overworld map. */
function _isOverworldRun() {
  if(G.endlessMode) return false;
  try { return !!localStorage.getItem(_OW_STATE_KEY); } catch(_) { return false; }
}

/** Map overworld node enemy labels to roster ids or resolvable birdKeys. */
function normalizeOwEnemyListForBattle(enemies, stage){
  if(!Array.isArray(enemies)||!enemies.length) return [];
  const st=Math.max(1,Math.floor(Number(stage)||G?.stage||1));
  const aliases={
    wardenrook:'crow',wardenrooks:'crow',rookwarden:'crow',
    dukblakiston:'dukeBlakiston',dukeblakiston:'dukeBlakiston',
  };
  return enemies.map(raw=>{
    const s=String(raw||'').trim();
    if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(s)) return s;
    const compact=s.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9_]/g,'');
    if(aliases[compact]) return typeof resolveOwStageToken==='function'?resolveOwStageToken(aliases[compact],st):aliases[compact];
    if(BIRDS&&BIRDS[compact]) return typeof resolveOwStageToken==='function'?resolveOwStageToken(compact,st):compact;
    const nk=normalizeEnemyNameKey(raw);
    const fromEnemy=ENEMIES.find(e=>normalizeEnemyNameKey(e.name)===nk);
    if(fromEnemy){
      if(fromEnemy.birdKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(fromEnemy.birdKey,st):fromEnemy.birdKey;
      if(fromEnemy.portraitKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(fromEnemy.portraitKey,st):fromEnemy.portraitKey;
    }
    if(BIRDS){
      const flat=String(raw||'').toLowerCase().replace(/[^a-z]/g,'');
      const birdKey=Object.keys(BIRDS).find(k=>k.toLowerCase().replace(/[^a-z]/g,'')===flat);
      if(birdKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(birdKey,st):birdKey;
    }
    return typeof resolveOwStageToken==='function'?resolveOwStageToken(compact,st):compact;
  });
}

/**
 * Called on index.html startup. If the player navigated here from the overworld
 * (entering a stage or shop node), restore the run and route correctly.
 * Returns true if it handled the intent so initSelectionSafe can bail out early.
 */

function handleOverworldReturn() {
  let intent = null;
  try { intent = JSON.parse(localStorage.getItem(_OW_NAV_KEY) || 'null'); } catch(_) {}
  if (!intent?.action) return false;
  const save = loadSaveData();
  if (!save?.player) return false;
  if (save?.endlessMode) {
    try {
      localStorage.removeItem(_OW_NAV_KEY);
      localStorage.removeItem(_OW_STATE_KEY);
    } catch(_) {}
    return false;
  }
  if (intent.action === 'battle' || intent.action === 'shop') {
    Avian.storyRun?.enterNode(intent.nodeId, intent.mapId || 'story-blackstone', intent.action === 'shop' ? 'shop' : 'combat');
  }

  try { localStorage.removeItem(_OW_NAV_KEY); } catch(_) {}

  if (intent.action === 'forgeTest') {
    G._owForgeReturnToForge = true;
    G._owForgeNavMeta = {
      mapId: intent.mapId || 'main',
      encounter: intent.encounter || null,
      clearRewards: Array.isArray(intent.clearRewards) ? intent.clearRewards : null,
      isForgeTest: true,
      forgeNodeIsBoss: !!intent.isBoss,
    };
    G._owForgeEncounter = intent.encounter || null;
    G._owForgePowerTier = 0;
    G._owPendingBattleStage = Math.max(1, Math.floor(Number(intent.stage) || save.stage || 1));
    G._owPendingNodeId = Number.isFinite(Number(intent.nodeId)) ? Math.floor(Number(intent.nodeId)) : null;
    G._battleTerrain = (typeof intent.terrain === 'string' && intent.terrain.trim()) ? intent.terrain.trim() : null;
    G._owSequenceShiny = 0;
    resetStageBattleStats();
    const stageNum = G._owPendingBattleStage;
    const pbk = save?.player?.birdKey;
    const resolveFn = typeof globalThis.resolveForgeEncounterBirdKeys === 'function'
      ? globalThis.resolveForgeEncounterBirdKeys : null;
    const rolled = resolveFn && intent.encounter
      ? resolveFn(intent.encounter, pbk, stageNum)
      : (pbk ? [pbk] : ['sparrow']);
    G._owStageEnemies = normalizeOwEnemyListForBattle(rolled, stageNum);
    G._owEnemyIndex = 0;
    G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
    G._owEncounterRollStage = stageNum;
    const s0 = intent.encounter?.slots?.[0];
    if (s0) {
      let mirrorBirdKey = null;
      if (s0.birdKey && s0.birdKey !== 'random' && BIRDS?.[s0.birdKey]) {
        mirrorBirdKey = s0.birdKey;
      } else {
        const resolved0 = String(G._owStageEnemies?.[0] || '').trim();
        if (resolved0 && BIRDS?.[resolved0] && !(typeof isRosterEnemyId === 'function' && isRosterEnemyId(resolved0))) {
          mirrorBirdKey = resolved0;
        }
      }
      if (mirrorBirdKey) {
        const tier = typeof normalizeBirdCardTier === 'function'
          ? normalizeBirdCardTier(s0.enemyTier || 'grey')
          : String(s0.enemyTier || 'grey').toLowerCase();
        const stars = typeof clampBirdCardStars === 'function'
          ? clampBirdCardStars(s0.enemyStars != null ? s0.enemyStars : 0)
          : Math.max(0, Math.min(5, Math.floor(Number(s0.enemyStars) || 0)));
        G._forgeMirrorTarget = { birdKey: mirrorBirdKey, tier, stars };
      }
    }
    try {
      continueRun();
    } catch (err) {
      console.error('handleOverworldReturn forgeTest failed', err);
      G._owForgeReturnToForge = false;
      return false;
    }
    return true;
  }

  if (intent.action === 'battle') {
    // #region agent log
    fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:battle',message:'OW battle intent',data:{stage:intent.stage,nodeId:intent.nodeId,hasEncounter:!!intent.encounter,hasSave:!!save?.player},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    G._owForgeNavMeta = {
      mapId: intent.mapId || 'main',
      nodeKey: intent.nodeKey || null,
      encounter: intent.encounter || null,
      bonusConfig: intent.bonus || null,
      clearRewards: Array.isArray(intent.clearRewards) ? intent.clearRewards : null,
      powerTier: Math.max(0, Math.floor(Number(intent.powerTier) || 0)),
      isBonus: !!intent.isBonus,
      isWorldInterior: !!intent.isWorldInterior,
      worldId: intent.worldId || null,
      worldIndex: intent.worldIndex != null ? Number(intent.worldIndex) : null,
      subStage: intent.subStage != null ? Number(intent.subStage) : null,
      skipMainStageAdvance: !!(intent.isBonus || intent.isWorldInterior),
    };
    G._owForgeEncounter = intent.encounter || null;
    G._owForgePowerTier = G._owForgeNavMeta.powerTier;
    G._owPendingBattleStage = Math.max(1, Math.floor(Number(intent.stage) || save.stage || 1));
    G._owPendingNodeId = Number.isFinite(Number(intent.nodeId)) ? Math.floor(Number(intent.nodeId)) : null;
    G._battleTerrain = (typeof intent.terrain === 'string' && intent.terrain.trim()) ? intent.terrain.trim() : null;
    G._owSequenceShiny = 0;
    resetStageBattleStats();
    const stageNum=G._owPendingBattleStage;
    const pbk=save?.player?.birdKey;
    if(!G.endlessMode && !STORY_BOSS_STAGES.has(stageNum) && intent.encounter){
      const resolveFn = typeof globalThis.resolveForgeEncounterBirdKeys === 'function'
        ? globalThis.resolveForgeEncounterBirdKeys : null;
      const rolled = resolveFn
        ? resolveFn(intent.encounter, pbk, stageNum)
        : generateStoryStageEnemyKeys(stageNum, pbk);
      let enemies = normalizeOwEnemyListForBattle(rolled, stageNum);
      const customOw = typeof isCustomOverworldActive==='function' && isCustomOverworldActive();
      if(!customOw) enemies = enemies.slice(0,1);
      G._owStageEnemies = enemies;
      G._owEnemyIndex   = 0;
      G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
      G._owEncounterRollStage = stageNum;
      commitStoryEncounterMeta(stageNum, pbk, G._owStageEnemies);
    } else if(!G.endlessMode && !STORY_BOSS_STAGES.has(stageNum)){
      const rolled=generateStoryStageEnemyKeys(stageNum, pbk);
      let enemies = normalizeOwEnemyListForBattle(rolled, stageNum);
      const customOw = typeof isCustomOverworldActive==='function' && isCustomOverworldActive();
      if(!customOw) enemies = enemies.slice(0,1);
      G._owStageEnemies = enemies;
      G._owEnemyIndex   = 0;
      G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
      G._owEncounterRollStage = stageNum;
      commitStoryEncounterMeta(stageNum, pbk, G._owStageEnemies);
    } else {
      G._owStageEnemies = null;
      G._owEnemyIndex   = 0;
      G._owEnemyCount = 1;
      commitStoryEncounterMeta(stageNum, pbk, null);
    }
    try{
      // #region agent log
      fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:preContinueRun',message:'Before continueRun',data:{pendingStage:G._owPendingBattleStage,owEnemies:G._owStageEnemies,owCount:G._owEnemyCount,encounterRollStage:G._owEncounterRollStage},timestamp:Date.now(),hypothesisId:'H1,H4'})}).catch(()=>{});
      // #endregion
      continueRun(); // restores state; continueRun ends with loadStage()
    }catch(err){
      // #region agent log
      fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:battleCatch',message:'continueRun failed',data:{err:String(err&&err.message||err),stack:String(err&&err.stack||'').slice(0,500)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('handleOverworldReturn battle failed', err);
      try{ localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); }catch(_){ }
      return false;
    }
    return true;
  }
  if (intent.action === 'shop') {
    G._currentShopNodeId = intent.nodeId ?? null; // persist shop snapshot by node
    G._currentShopMapId = intent.mapId || 'main';
    setOverworldCurrentNode(intent.nodeId);
    G._pendingOverworldShop = true; // loadStage() will detect this and open shop instead
    try{
      continueRun();
      return true;
    }catch(err){
      console.error('handleOverworldReturn shop failed', err);
      G._pendingOverworldShop = false;
      G._currentShopNodeId = null;
      G._currentShopMapId = null;
      try{ localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); }catch(_){}
      return false;
    }
  }
  if (intent.action === 'nest') {
    const nestSave = loadSaveData();
    if (!nestSave?.player) return false;
    G._continueRunOpenNestOnly = true;
    try {
      continueRun();
    } catch (err) {
      console.error('Overworld nest: continueRun failed', err);
      G._continueRunOpenNestOnly = false;
      try { localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); } catch (_) {}
      return false;
    }
    return true;
  }
  return false;
}
globalThis.handleOverworldReturn = handleOverworldReturn;
