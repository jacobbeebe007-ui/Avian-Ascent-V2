// ===== 27_oai-bugfix-bowedwing-shop-unlocks.js =====

(function(){
  // ---------- Bowed Wing reliability ----------
  if(typeof globalThis.applySlowToEnemy !== 'function'){
    globalThis.applySlowToEnemy = function(percentLike, turnsLike, weakenChanceLike){
      try{
        const spdPenalty = Math.max(1, Math.round((turnsLike || 2))); // keeps old authored values meaningful
        const dodgePenalty = Math.max(5, Math.round(percentLike || 10));
        if(typeof globalThis.applyEnemySlow === 'function'){
          globalThis.applyEnemySlow(spdPenalty, dodgePenalty, 2 + (weakenChanceLike ? 1 : 0));
        }else{
          const st = globalThis.G.enemyStatus || (globalThis.G.enemyStatus = {});
          const en = globalThis.G.enemy && globalThis.G.enemy.stats ? globalThis.G.enemy.stats : null;
          if(en){
            if(!st.slow){
              const spdDrop = Math.min(spdPenalty, Math.max(0, (en.spd || 1) - 1));
              en.spd = Math.max(1, (en.spd || 1) - spdDrop);
              en.dodge = Math.max(0, (en.dodge || 0) - dodgePenalty);
              st.slow = {turns: 2 + (weakenChanceLike ? 1 : 0), spdPenalty: spdDrop, dodgePenalty: dodgePenalty};
            }else{
              st.slow.turns = Math.max(st.slow.turns || 0, 2 + (weakenChanceLike ? 1 : 0));
              st.slow.spdPenalty = Math.max(st.slow.spdPenalty || 0, spdPenalty);
              st.slow.dodgePenalty = Math.max(st.slow.dodgePenalty || 0, dodgePenalty);
            }
          }
        }
        if(weakenChanceLike && typeof globalThis.chance === 'function' && chance(weakenChanceLike)){
          if(typeof globalThis.applyAilment === 'function') applyAilment('enemy', 'weaken', 1);
          if(typeof globalThis.spawnFloat === 'function') spawnFloat('enemy','🐔 Weaken!','fn-status');
        }
        if(typeof globalThis.renderStatuses === 'function') renderStatuses('enemy-status', globalThis.G.enemyStatus);
        return true;
      }catch(err){
        console.error('applySlowToEnemy failed:', err);
        return false;
      }
    };
  }

  // Hard patch Bowed Wing so it can never silently do nothing on its effect line.
  if(globalThis.ACTIONS && typeof globalThis.ACTIONS.bowedWing === 'function'){
    globalThis.ACTIONS.bowedWing = async function(ab){
      const lv = Math.max(1, Math.min(ab?.level || 1, 4));
      if(typeof globalThis.playerAttackMisses === 'function' && playerAttackMisses(ab)){
        if(typeof globalThis.doMiss === 'function') await doMiss('player');
        if(typeof globalThis.logMsg === 'function') logMsg('Bowed Wing missed!','miss');
        return;
      }
      const dmg = (typeof globalThis.dealDamage === 'function')
        ? dealDamage('enemy', pdmg([0.95,1.10,1.25,1.40][lv-1], ab), chance(getPlayerCritChance(ab)))
        : {dmgDealt:0};
      if(typeof globalThis.doAttack === 'function') await doAttack('player','enemy',dmg);
      if(typeof globalThis.setHpBar === 'function' && globalThis.G?.enemy?.stats){
        setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
      }
      applySlowToEnemy([15,20,20,25][lv-1], [2,3,3,5][lv-1], lv >= 3 ? 10 : 0);
      if(typeof globalThis.logMsg === 'function') logMsg(`🏹 Bowed Wing hits for ${dmg.dmgDealt||0}. Slow applied.`, 'player-action');
    };
  }

  // ---------- Unlock popup rendering + selection refresh ----------
  const oldRenderUnlockPopupsOnGameover = globalThis.renderUnlockPopupsOnGameover;
  if(typeof oldRenderUnlockPopupsOnGameover === 'function'){
    globalThis.renderUnlockPopupsOnGameover = function(){
      const out = oldRenderUnlockPopupsOnGameover.apply(this, arguments);
      try{
        const wrap = document.getElementById('run-unlocks');
        if(!wrap) return out;
        [...wrap.querySelectorAll('.unlock-card')].forEach(card=>{
          const portrait = card.querySelector('.bird-portrait');
          const title = card.closest('.unlock-popup')?.querySelector('.unlock-title')?.textContent || '';
          if(!portrait) return;
          let key = '';
          if(/hummingbird/i.test(title)) key = 'hummingbird';
          else if(/shoebill/i.test(title)) key = 'shoebill';
          else if(/secretary/i.test(title)) key = 'secretarybird';
          else if(/magpie/i.test(title)) key = 'magpie';
          else if(/kookaburra/i.test(title)) key = 'kookaburra';
          else if(/peregrine/i.test(title)) key = 'peregrine';
          else if(/snowy/i.test(title)) key = 'snowyowl';
          else if(/toucan/i.test(title)) key = 'toucan';
          else if(/harpy/i.test(title)) key = 'harpyeagle';
          else if(/bald eagle/i.test(title)) key = 'baldeagle';
          else if(/cockatoo/i.test(title)) key = 'blackcockatoo';
          else if(/ostrich/i.test(title)) key = 'ostrich';
          else if(/cassowary/i.test(title)) key = 'cassowary';
          if(key && typeof globalThis.renderBirdPortrait === 'function'){
            globalThis.renderBirdPortrait(portrait, key);
          }
        });
      }catch(_){}
      return out;
    };
  }
})();


// ===== 18_oai-shop-glow-colors.css =====
(function(){
  function applyShopTierClasses(){
    document.querySelectorAll('#shop-items-grid .shop-item, #shop-items-grid .reward-card').forEach(el=>{
      const tier=(el.className.match(/tier-(grey|green|blue|purple|gold)/)||[])[1];
      if(tier) el.dataset.tier=tier;
    });
  }
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(applyShopTierClasses, 0));
})();


// ===== 30_oai-final-shop-bindings.js =====

(function(){
  function bindShopButtons(){
    const buy = document.getElementById('shop-buy-btn');
    const sell = document.getElementById('shop-sell-btn');
    const refresh = document.getElementById('shop-refresh-btn');
    const exit = document.getElementById('shop-exit-btn') || document.querySelector('[data-shop-action="exit"]');
    if(buy && buy.dataset.bound !== '1'){
      buy.dataset.bound = '1';
      buy.addEventListener('click', function(e){ e.preventDefault(); shopBuySelected(); });
    }
    if(sell && sell.dataset.bound !== '1'){
      sell.dataset.bound = '1';
      sell.addEventListener('click', function(e){ e.preventDefault(); if(typeof shopSellSelected==='function') shopSellSelected(); });
    }
    if(refresh && refresh.dataset.bound !== '1'){
      refresh.dataset.bound = '1';
      refresh.addEventListener('click', function(e){ e.preventDefault(); shopRefresh(); });
    }
    if(exit && exit.dataset.bound !== '1'){
      exit.dataset.bound = '1';
      exit.addEventListener('click', function(e){ e.preventDefault(); exitStorkShop(); });
    }
  }

  function bindShopDelegation(){
    const screen = document.getElementById('screen-stork-shop');
    if(!screen || screen.dataset.shopDelegated === '1') return;
    screen.dataset.shopDelegated = '1';
    screen.addEventListener('click', function(e){
      const tab = e.target.closest('[data-shop-tab]');
      if(tab){
        e.preventDefault();
        if(typeof setShopTab === 'function') setShopTab(tab.dataset.shopTab);
      }
    });
  }

  function wrapShopRenderer(name){
    const oldFn = globalThis[name];
    if(typeof oldFn !== 'function') return;
    globalThis[name] = function(){
      const out = oldFn.apply(this, arguments);
      bindShopButtons();
      bindShopDelegation();
      return out;
    };
  }

  wrapShopRenderer('renderShopItems');
  wrapShopRenderer('renderShopSellItems');
  document.addEventListener('DOMContentLoaded', function(){
    bindShopButtons();
    bindShopDelegation();
  });
})();
