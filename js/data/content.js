// ===== 09_script_09.js =====

/* ===== Duke Blakiston sprite + plan fix ===== */
(function(){
  const _origRenderBirdIconHTML = globalThis.renderBirdIconHTML;
  if(typeof _origRenderBirdIconHTML === 'function'){
    globalThis.renderBirdIconHTML = function(birdKey, sizeClass, locked){
      const k = String(birdKey||'').toLowerCase().replace(/[^a-z]/g,'');
      if(k === 'dukeblakiston'){
        return `<div class="sprite4 ${sizeClass||'boss'} sprite-dukeblakiston frame-0 ${locked?'locked':''}"></div>`;
      }
      return _origRenderBirdIconHTML.apply(this, arguments);
    };
  }

  const _origMakeDuke = globalThis.makeDukeBlakiston;
  if(typeof _origMakeDuke === 'function'){
    globalThis.makeDukeBlakiston = function(){
      const e = _origMakeDuke.apply(this, arguments);
      e.portraitKey = 'duke_blakiston';
      e.id = e.id || 'duke_blakiston';
      return e;
    };
  }

  function setBlakistonFrame(frameClass){
    try{
      const el = document.querySelector('#enemy-avatar .sprite-dukeblakiston');
      if(!el) return;
      el.classList.remove('frame-0','frame-1','frame-2','frame-3','boss-power');
      el.classList.add(frameClass);
    }catch(_){}
  }

  function animateBlakistonFromIntent(){
    try{
      const el = document.querySelector('#enemy-avatar .sprite-dukeblakiston');
      if(!el) return;
      el.classList.add('boss-hover');

      const label = String(globalThis.G?.enemyNextAction?.label || '').toLowerCase();
      if(label.includes('nightfall') || label.includes('verdict') || label.includes('ultimate') || label.includes('power')){
        setBlakistonFrame('frame-3');
        el.classList.add('boss-power');
      }else if(label.includes('river') || label.includes('dash') || label.includes('talon') || label.includes('rending')){
        setBlakistonFrame('frame-2');
      }else if(label.includes('summon') || label.includes('call') || label.includes('court')){
        setBlakistonFrame('frame-1');
      }else{
        setBlakistonFrame('frame-0');
      }
    }catch(_){}
  }

  const _origRenderEnemyPlan = globalThis.renderEnemyPlan;
  if(typeof _origRenderEnemyPlan === 'function'){
    globalThis.renderEnemyPlan = function(){
      const G = globalThis.G;
      if(G?.enemy?.aiType === 'boss_duke'){
        if(!G.enemyNextAction || !Array.isArray(G.enemyNextAction.actions) || !G.enemyNextAction.actions.length){
          let label = '🦉 Talons';
          const d = G.enemy.duke || {};
          const enraged = !!(globalThis.isBossEnrageAllowed?.() && G.enemy.stats?.hp <= Math.floor((G.enemy.stats?.maxHp||1)*0.35));
          if((d.phase||1) === 1 && G.enemy.stats?.hp <= Math.floor((G.enemy.stats?.maxHp||1)*0.75)) label = '🌑 Nightfall';
          else if((d.verdictCd||0)===0 && ((G.player?.stats?.hp||0) <= Math.floor((G.player?.stats?.maxHp||1)*0.40) || enraged)) label = "🦉 Owl's Verdict";
          else if((d.summonCd||0)===0 && !(G.enemyStatus?.wardens>0) && (((d.phase||1) >= 3) || ((G.enemy.stats?.hp||1) <= Math.floor((G.enemy.stats?.maxHp||1)*0.55)))) label = '🛡️ Summon Court';
          else if((d.riverCd||0)===0 && !(G.playerStatus?.rooted>0) && !(G.playerStatus?.slow>0) && (d.phase||1)>=2) label = '🌊 River Grip';
          G.enemyNextAction = {
            label,
            type:'plan',
            actions:[{type:'plan', label:label.replace(/^.[ ]?/,''), icon:label.split(' ')[0] || '🦉', energyCost:1}]
          };
        }
      }
      const out = _origRenderEnemyPlan.apply(this, arguments);
      animateBlakistonFromIntent();
      return out;
    };
  }

  const _origRefreshBattleUI = globalThis.refreshBattleUI;
  if(typeof _origRefreshBattleUI === 'function'){
    globalThis.refreshBattleUI = function(){
      const out = _origRefreshBattleUI.apply(this, arguments);
      animateBlakistonFromIntent();
      return out;
    };
  }

  const _origStartBlakistonDebugBattle = globalThis.startBlakistonDebugBattle;
  if(typeof _origStartBlakistonDebugBattle === 'function'){
    globalThis.startBlakistonDebugBattle = function(){
      const out = _origStartBlakistonDebugBattle.apply(this, arguments);
      try{
        if(globalThis.G?.enemy){
          globalThis.G.enemy.portraitKey = 'duke_blakiston';
        }
        animateBlakistonFromIntent();
      }catch(_){}
      return out;
    };
  }
})();


// ===== 12_script_12.js =====

/* ===== Enemy balance pass ===== */
(function(){
  // Enemy ability implementations live in js/core/game.js (ENEMY_ABILITY_POOL).
  // Legacy enemyActionFromPool / buildEnemyActionPool overlays removed — planEnemyTurn in game.js is canonical.
})();


// ===== 13_script_13.js =====

/* ===== Damage scaling + tank ATK tune + Stork Shop ability details ===== */
(function(){
  // Interpreting "Tank Base art" as "Tank base ATK".
  const TANK_ATK_PATCH = {
    goose: 8,
    shoebill: 9,
    harpy: 12,
    penguin: 8,
    ostrich: 11,
    cassowary: 12,
    emu: 13
  };

  function patchTankAttackStats(){
    if(!globalThis.BIRDS) return;
    for(const [key, atk] of Object.entries(TANK_ATK_PATCH)){
      const b = BIRDS[key];
      if(!b || b.__tankAtkPatched) continue;
      if(b.class === 'tank' && b.stats){
        b.stats.atk = atk;
        if(b.statBars && typeof b.statBars.ATK === 'number') b.statBars.ATK = atk/15;
        b.__tankAtkPatched = true;
      }
    }
  }
  patchTankAttackStats();

  // dealDamage soft-cap vs enemies: merged into js/systems/systems.js

})();


// ===== Shop: energy sync + bonus pulse + combat UI orbs =====
(function(){
  function syncPlayerEnergyState(p){
    if(!p) return;
    try{
      if(typeof computePlayerMaxEnergy === 'function'){
        p.energyMax = computePlayerMaxEnergy();
      } else {
        p.energyMax = Math.max(1, (p.energyMax||0) + (p.energyBonus||0));
      }
      if(typeof p.energy !== 'number') p.energy = p.energyMax;
      p.energy = Math.min(p.energy, p.energyMax);
      if(typeof renderEnergyOrbs === 'function') renderEnergyOrbs();
      if(typeof renderAllCombatUI === 'function' && G?.player===p) renderAllCombatUI();
    }catch(err){ console.error(err); }
  }

  function flashBonusEnergy(beforeMax, afterMax){
    try{
      if(!G?.player) return;
      const diff = Math.max(0, (afterMax||0) - (beforeMax||0));
      if(diff > 0){
        G.player._newBonusEnergyFlash = diff;
        if(typeof renderEnergyOrbs === 'function') renderEnergyOrbs();
      }
    }catch(err){ console.error(err); }
  }

  const _origShopBuySelected = globalThis.shopBuySelected;
  if(typeof _origShopBuySelected === 'function'){
    globalThis.shopBuySelected = function(){
      const beforeMax = G?.player?.energyMax || 0;
      const out = _origShopBuySelected.apply(this, arguments);
      try{
        syncPlayerEnergyState(G.player);
        const afterEnergy = G?.player?.energyMax;
        if(typeof renderShopItems === 'function') renderShopItems();
        if(afterEnergy != null && beforeMax != null && afterEnergy > beforeMax){
          logMsg(`⚡ Max Energy increased to ${afterEnergy}!`, 'exp-gain');
        }
        flashBonusEnergy(beforeMax, afterEnergy || 0);
      }catch(err){ console.error(err); }
      return out;
    };
  }

  const _origRenderAllCombatUIEnergy = globalThis.renderAllCombatUI;
  if(typeof _origRenderAllCombatUIEnergy === 'function'){
    globalThis.renderAllCombatUI = function(){
      const out = _origRenderAllCombatUIEnergy.apply(this, arguments);
      try{ if(typeof renderEnergyOrbs === 'function') renderEnergyOrbs(); }catch(err){ console.error(err); }
      return out;
    };
  }
})();
