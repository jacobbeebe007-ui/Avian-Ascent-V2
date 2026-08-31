/* Avian Ascent — combat action queue and failsafe recovery (Step 7 Phase 8). */
// ============================================================
//  UI (combat rendering → js/ui/combat-*.js)
// ============================================================

function lockActionUI(locked){
  const grid=document.getElementById('actions-grid');
  if(!grid) return;
  grid.querySelectorAll('button').forEach(b=>b.disabled=!!locked);
}

function canPlayerAct(){
  return !G.battleOver&&G.turn==='player'&&G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER&&!G.actionBusy&&!G.animLock;
}

function syncCombatTurnFlags(){
  if(G.battleOver||!G.player||!G.enemy) return;
  if(G.turnPhase===TURN.RESOLVING) return;
  if(G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER){
    G.turn='player';
  }else if(G.phase==='ENEMY'&&G.turnPhase===TURN.ENEMY){
    G.turn='enemy';
  }
}

function enqueueAction(fn){
  G.actionQueue=G.actionQueue||[];
  G.actionQueue.push(fn);
  runActionQueue();
}

async function runActionQueue(){
  if(G.actionBusy) return;
  G.actionBusy=true;
  lockActionUI(true);

  try{
    while((G.actionQueue||[]).length){
      const fn=G.actionQueue.shift();
      try{
        await fn();
      }catch(err){
        console.error('Action failed:', err);

        G.animLock=false;
        G.actionQueue.length=0;

        if(G.player?.stats?.hp>0 && G.enemy?.stats?.hp>0 && !G.battleOver){
          G.phase='PLAYER';
          G.turnPhase=TURN.PLAYER;
          G.turn='player';
        }

        logMsg('⚠ Action failed (recovered). Check console.', 'miss');
      }

      if(!G.player||!G.enemy||G.battleOver) break;
      renderAllCombatUI();
    }
  } finally {
    G.actionBusy=false;
    if(G.phase==='PLAYER' && G.turnPhase===TURN.PLAYER){
      G.animLock=false;
      lockActionUI(false);
    }
    renderActions();
  }
}

// ============================================================
// FAILSAFE — prevents "stuck UI / no one's turn / dead clicks"
// ============================================================
function isActiveBattleContext(){
  const onBattle=!!document.getElementById('screen-battle')?.classList.contains('active');
  return !!(onBattle && G.player && G.enemy && !G.battleOver);
}
globalThis.isActiveBattleContext=isActiveBattleContext;

function failsafeAdvance(reason='') {
  try {
    G.animLock = false;

    if (G.actionBusy) {
      G.actionBusy = false;
      G.actionQueue = [];
    }

    if (typeof lockActionUI === 'function') lockActionUI(false);

    if (G.player && G.enemy && !G.battleOver) {
      if (typeof TURN !== 'undefined') G.turnPhase = TURN.PLAYER;
      G.turn = 'player';
      G.phase = 'PLAYER';
    }

    if(isActiveBattleContext()){
      if (typeof renderAllCombatUI === 'function') renderAllCombatUI();
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      if (typeof renderActions === 'function') renderActions();
      if (typeof renderEnergyOrbs === 'function') renderEnergyOrbs();
    }

    // console.warn('[failsafeAdvance]', reason);
  } catch (e) {
    console.error('failsafeAdvance failed:', e);
  }
}

window.addEventListener('error', (ev) => {
  // #region agent log
  _agentDbgLog('game.js:window.error', 'uncaught error', { msg: String(ev.message || ''), file: String(ev.filename || ''), line: ev.lineno || null, col: ev.colno || null, stack: String(ev.error?.stack || '').slice(0, 800) }, 'H5');
  // #endregion
  try { console.error('[game] uncaught error:', ev.message, ev.error || ev); } catch(_) {}
  if(isActiveBattleContext()){
    try { failsafeAdvance('window.onerror'); } catch(_) {}
  }
});
window.addEventListener('unhandledrejection', (ev) => {
  try { console.error('[game] unhandled rejection:', ev.reason); } catch(_) {}
  if(isActiveBattleContext()){
    try { failsafeAdvance('unhandledrejection'); } catch(_) {}
  }
});
globalThis.failsafeAdvance = failsafeAdvance;
globalThis.enqueueAction = enqueueAction;
