// ===== 17_script_17.js =====

/* ===== Aviant polish systems patch =====
 * Script load order (js/bootstrap/load-order.json, served as one classic script in dev/prod via Vite):
 * ability_passive_upgrade_pack.js -> ability_family_tree.js -> story_enemy_registry.js -> overworld_bridge.js ->
 * game.js -> content.js -> systems.js -> shop.js -> ui.js -> sprites.js. Later files wrap globals registered earlier.
 * Consolidated here (vs content.js): dealDamage, edmg, afterEnemyTurn.
 * getUpgradePool: ui.js wraps game.js (normalize upgrade apply + audit in one place).
 * refreshBattleUI / renderEnemyPlan: stacked in sprites.js, ui.js, systems.js, content.js (Duke), game.js.
 */
(function(){
  const STATUS_INFO = {
    poison: 'Poison: deals damage each turn and stacks up to your poison cap.',
    bleed: 'Bleed: physical damage over time.',
    burning: 'Burn: deals damage over time based on max HP.',
    weaken: 'Weaken: lowers outgoing damage.',
    paralyzed: 'Paralysed: skills cost +1 EN for 1 turn, then Control Resistance for 2 turns.',
    shock: 'Shock: Magic DoT (same as Burn). Stacks to 5 while Magic Armour is 0, then Paralysis.',
    controlResistance: 'Control Resistance: cannot gain Chilled, Shock, or Paralysis.',
    feared: 'Feared: next damaging action deals 12% less damage.',
    confused: 'Confused: next hostile action suffers −8 Precision.',
    slow: 'Slow: reduces Speed and Dodge.',
    mud: 'Mud: a dirty slowdown effect that impairs movement.',
    dustDevil: 'Blind: lowers Accuracy for a short time.',
    featherRuffle: 'Ruffled: enemy offense is reduced.',
    defending: 'Shield: enemy damage reduction while blocking.',
    evading: 'Evade: higher chance to dodge attacks.',
    lullabied: 'Lulled: reduced offense while drowsy.',
    delayed: 'Resonance: delayed damage will detonate soon.',
    marked: 'Marked: the next Finisher or Marked payoff ability consumes this for bonus effect.',
    frozen: 'Frozen: cannot act while frozen.',
    chilled: 'Chilled: reduced Speed; may escalate to Frozen.',
    scorched: 'Scorched: burning damage over time based on max HP.',
    toxic: 'Toxic: stronger poison damage over time.',
    blinded: 'Blinded: reduced Accuracy.',
    decreed: 'Decreed: marked for amplified magic damage.',
    guarded: 'Guarded: physical attack damage reduction for a short time.',
    shield: 'Fortify/Ward: temporary Armour or Magic Armour that absorbs matching damage before Health.',
    shieldHp: 'Fortify/Ward: temporary Armour or Magic Armour that absorbs matching damage before Health.',
    fortify: 'Fortify: temporary Armour bonus shown on the ARM bar.',
    ward: 'Ward: temporary Magic Armour bonus shown on the MARM bar.',
    accDebuff: 'Accuracy reduced — attacks are harder to land.',
    rageBuff: 'Rage: increased outgoing damage.',
  };

  function showRichTooltip(ev, html){
    const tt=document.getElementById('action-tooltip');
    if(!tt) return;
    tt.innerHTML=html;
    tt.style.display='block';
    if(window._isTouchDevice){
      tt.style.left='50%'; tt.style.top='50%'; tt.style.transform='translate(-50%,-50%)'; tt.style.position='fixed';
    } else if(typeof moveTooltip === 'function'){
      tt.style.position='fixed';
      moveTooltip(ev);
    }
  }

  // Status badge tooltips
  function statusTooltipHtml(badge){
    const cls = badge?.dataset?.statusId || [...badge.classList].find(c => STATUS_INFO[c]) || [...badge.classList][1];
    const ailDef = globalThis.AILMENTS && globalThis.AILMENTS[cls];
    const detail = badge?.dataset?.statusDetail
      || (ailDef && ailDef.desc)
      || STATUS_INFO[cls]
      || 'Status effect.';
    const name = ailDef?.name || badge.textContent;
    return `<div class="tt-name">${name}</div><div class="tt-desc" style="margin-top:6px">${detail}</div>`;
  }

  document.addEventListener('mouseover', (ev)=>{
    const badge = ev.target?.closest?.('.status-badge');
    if(!badge || window._isTouchDevice) return;
    showRichTooltip(ev, statusTooltipHtml(badge));
  });
  document.addEventListener('mousemove', (ev)=>{
    if(window._isTouchDevice) return;
    if(ev.target?.closest?.('.status-badge') && typeof moveTooltip === 'function') moveTooltip(ev);
  });
  document.addEventListener('mouseout', (ev)=>{
    if(ev.target?.closest?.('.status-badge') && !window._isTouchDevice && typeof hideTooltip === 'function') hideTooltip();
  });
  document.addEventListener('click', (ev)=>{
    const badge = ev.target?.closest?.('.status-badge');
    if(!badge) return;
    showRichTooltip(ev, statusTooltipHtml(badge));
    ev.preventDefault();
    ev.stopPropagation();
  });

  // Action button cooldown suffix on label only — skill tooltips come from game.js showActionTooltip / buildActionTooltipHTML (avoid competing rich HTML on hover).
  const _oldRenderActions = globalThis.renderActions;
  if(typeof _oldRenderActions === 'function'){
    globalThis.renderActions = function(){
      const out = _oldRenderActions.apply(this, arguments);
      try{
        document.querySelectorAll('#actions-grid .action-btn').forEach((btn, idx)=>{
          const ab = G?.player?.abilities?.[idx];
          if(!ab) return;
          const cd = (typeof getAbilityCooldown === 'function') ? (getAbilityCooldown(ab.id)||0) : 0;
          const nm = btn.querySelector('.btn-name');
          if(nm && cd>0 && !/\(\d+\)$/.test(nm.textContent||'')) nm.textContent = `${nm.textContent} (${cd})`;
        });
      }catch(err){ console.error(err); }
      return out;
    };
  }

  // Player outgoing damage soft-cap (was content.js) + crit/magic floats.
  const _innerDealDamage = globalThis.dealDamage;
  if(typeof _innerDealDamage === 'function'){
    /* ----------------------------------------------------------
     * Phase 8 / B.3 synergy consume hook. Flag-gated so today's
     * balance is byte-equivalent unless `Avian.flags.synergyShopEnabled`
     * is true. When on, certain `*ConsumeBonusPct` player fields cause
     * statuses to be consumed off the target for a damage boost.
     * The consume itself is delegated to `Avian.statuses.consume` so
     * registered onConsume hooks fire.
     * ---------------------------------------------------------- */
    function applySynergyConsume(target, isCrit, isMagic, baseAmount){
      const Avian = globalThis.Avian;
      if(!Avian || !Avian.flags || !Avian.flags.synergyShopEnabled) return baseAmount;
      if(target !== 'enemy') return baseAmount;
      const G = globalThis.G;
      const p = G && G.player;
      if(!p) return baseAmount;
      const consume = Avian.statuses && Avian.statuses.consume;
      if(typeof consume !== 'function') return baseAmount;

      let mult = 1;

      /* Bleed Drinker: physical attacks consume Bleed for +50%. */
      if(!isMagic && p.bleedConsumeBonusPct && Avian.statuses.peek('enemy','bleed')){
        consume('enemy','bleed', { from: 'syn_bleeddrinker' });
        mult *= 1 + Number(p.bleedConsumeBonusPct);
      }
      /* Plague Eater: spells consume Poison for +50%. */
      if(isMagic && p.poisonConsumeBonusPct && Avian.statuses.peek('enemy','poison')){
        consume('enemy','poison', { from: 'syn_plague_eater' });
        mult *= 1 + Number(p.poisonConsumeBonusPct);
      }
      /* Frost Shatter: first strike each turn consumes Chill for +75%. */
      if(p.chillConsumeBonusPct && !p._frostShatterUsedThisTurn && Avian.statuses.peek('enemy','chilled')){
        consume('enemy','chilled', { from: 'syn_frost_shatter' });
        p._frostShatterUsedThisTurn = true;
        mult *= 1 + Number(p.chillConsumeBonusPct);
      }
      /* Weakness Finisher: crits consume Weaken for +40%. */
      if(isCrit && p.weakenConsumeBonusPct && Avian.statuses.peek('enemy','weaken')){
        consume('enemy','weaken', { from: 'syn_weakness_finisher' });
        mult *= 1 + Number(p.weakenConsumeBonusPct);
      }
      if(mult === 1) return baseAmount;
      try { Avian.debug = Avian.debug || {}; Avian.debug.lastSynergyMult = mult; } catch(_){}
      const roundDmg = (typeof globalThis.roundCombatDamage === 'function')
        ? globalThis.roundCombatDamage
        : (n) => Math.max(0.01, Math.round(Number(n) * 100) / 100);
      return roundDmg(Math.max(0.01, (Number(baseAmount)||1) * mult));
    }

    globalThis.avianApplySynergyConsumeDamage = applySynergyConsume;
    try {
      if (typeof globalThis.Avian?.combat?.logCrowSanityCheck === 'function') {
        globalThis.Avian.combat.logCrowSanityCheck();
      }
    } catch (_) {}

    globalThis.dealDamage = function(target, amount, isCrit=false, isMagic=false, srcAbility=null, opts=null){
      const out = _innerDealDamage.call(this, target, amount, isCrit, isMagic, srcAbility, opts);
      /* Phase 5: damage breakdown plumbing (B.6 partial). UI tooltips read
       * from Avian.debug.lastDamage to show curved formula breakdown. */
      try{
        const Avian = globalThis.Avian;
        const G = globalThis.G;
        if(Avian && Avian.debug){
          const curved = G && G._lastCurvedDamageMeta;
          Avian.debug.lastDamage = {
            target,
            base: amount,
            applied: out && out.dmgDealt != null ? out.dmgDealt : amount,
            attackingStat: curved ? curved.attackingStat : null,
            abilityPower: curved ? curved.abilityPower : null,
            effectiveDef: curved ? curved.effectiveDef : null,
            curvedBase: curved ? curved.dmg : null,
            enCost: curved ? curved.enCost : null,
            minDamageFloor: curved
              ? ((curved.weaponFirst || (curved.components && curved.components.weaponFirst))
                ? 1
                : (curved.enCost || 0) * 2)
              : null,
            isCrit: !!(out && out.isCrit),
            isMagic: !!isMagic,
            ability: srcAbility ? (srcAbility.id || srcAbility.name || null) : null,
            at: Date.now(),
          };
        }
      }catch(_){}
      try{
        if(out && out.isCrit) spawnFloat(target, '✦ Crit', 'damage-tag-float');
      }catch(_){}
      return out;
    };
  }

  /* Reset Frost Shatter "first strike each turn" flag at end-of-turn.
   * Hook lives outside the dealDamage wrapper because end-of-turn
   * boundaries flow through tickStatuses('player'). */
  (function attachFrostShatterTurnReset(){
    const _origTickStatuses = globalThis.tickStatuses;
    if(typeof _origTickStatuses !== 'function' || _origTickStatuses.__avianFrostReset) return;
    const wrapped = function tickStatusesWithFrostReset(who){
      const out = _origTickStatuses.apply(this, arguments);
      try {
        if(who === 'player' && globalThis.G && globalThis.G.player){
          globalThis.G.player._frostShatterUsedThisTurn = false;
        }
      } catch(_){}
      return out;
    };
    wrapped.__avianFrostReset = true;
    globalThis.tickStatuses = wrapped;
  })();

  /* ============================================================
   * Phase 10 — class-perk deck trigger (B.4).
   * Wraps the existing `startGame` so the deck appears once at run
   * start. Default UI handler is a no-op skip; UI overrides plug in via
   * Avian.systems.classPerks.onPickRequested.
   * ========================================================== */
  (function attachClassPerkDeckTrigger(){
    const Avian = globalThis.Avian;
    if(!Avian || !Avian.systems || !Avian.systems.classPerks) return;
    const orig = globalThis.startGame;
    if(typeof orig !== 'function') return;
    if(orig.__avianClassPerks) return;
    const wrapped = function startGameClassPerks(){
      const out = orig.apply(this, arguments);
      try { Avian.systems.classPerks.maybeOpen(); }
      catch(err) { try { console.warn('[Avian] classPerks startGame hook', err); } catch(_e){} }
      try {
        if(typeof Avian.systems._qolStartGameHook === 'function') Avian.systems._qolStartGameHook();
      } catch(err) { try { console.warn('[Avian] qol startGame hook', err); } catch(_e){} }
      return out;
    };
    wrapped.__avianClassPerks = true;
    globalThis.startGame = wrapped;
  })();

  /* ============================================================
   * Phase 7 — status verb dispatcher (B.2).
   *
   * Purely additive: legacy flag-style ailment math in game.js is
   * unchanged. After the existing tryApplyAilment / tickStatuses run,
   * we dispatch onApply / onTick to anything registered via
   * Avian.statuses.register(id, hooks). consumeStatus(target, id, source)
   * is the entry point for abilities that "eat" a status for bonus
   * effects. Migration plan: move one ailment per commit (see
   * docs/status-verbs.md) and run smoke + run-balance after each.
   * ========================================================== */
  (function attachStatusVerbDispatcher(){
    const Avian = globalThis.Avian;
    if(!Avian || !Avian.statuses) return;

    const _origApply = globalThis.applyAilment;
    if(typeof _origApply === 'function'){
      globalThis.applyAilment = function(target, ailId, stacks){
        const applied = _origApply.apply(this, arguments);
        if(applied){
          const status = Avian.statuses[ailId];
          if(status && typeof status.onApply === 'function'){
            try { status.onApply(target, { id: ailId, stacks: stacks }); }
            catch(err){ try { console.warn('[Avian] status.onApply ' + ailId, err); } catch(_e){} }
          }
        }
        return applied;
      };
    }

    const _origTryApply = globalThis.tryApplyAilment;
    if(typeof _origTryApply === 'function'){
      globalThis.tryApplyAilment = function(target, ailId, ab){
        const applied = _origTryApply.apply(this, arguments);
        if(applied){
          const status = Avian.statuses[ailId];
          if(status && typeof status.onApply === 'function'){
            try { status.onApply(target, { ability: ab, id: ailId }); }
            catch(err){ try { console.warn('[Avian] status.onApply ' + ailId, err); } catch(_e){} }
          }
        }
        return applied;
      };
    }

    const _origTick = globalThis.tickStatuses;
    if(typeof _origTick === 'function'){
      globalThis.tickStatuses = function(who){
        const out = _origTick.apply(this, arguments);
        try {
          const bag = who === 'player' ? globalThis.G?.playerStatus : globalThis.G?.enemyStatus;
          if(bag && typeof bag === 'object'){
            for(const id of Object.keys(bag)){
              const status = Avian.statuses[id];
              if(status && typeof status.onTick === 'function'){
                try { status.onTick(who, bag[id]); }
                catch(err){ try { console.warn('[Avian] status.onTick ' + id, err); } catch(_e){} }
              }
            }
          }
        } catch(_e){ /* defensive — never break tick */ }
        return out;
      };
    }

    /**
     * Consume a status from a target. If the status is registered with an
     * onConsume hook the hook gets a chance to mutate the source / return
     * a payload (e.g. damage multiplier). Either way the status is removed
     * after consumption. Returns the onConsume payload, or null.
     */
    Avian.statuses.consume = function consumeStatus(target, id, source){
      const bag = target === 'player' ? globalThis.G?.playerStatus : globalThis.G?.enemyStatus;
      if(!bag || !(id in bag)) return null;
      const status = Avian.statuses[id];
      const stacks = bag[id];
      let payload = null;
      if(status && typeof status.onConsume === 'function'){
        try { payload = status.onConsume(target, stacks, source) || null; }
        catch(err){ try { console.warn('[Avian] status.onConsume ' + id, err); } catch(_e){} }
      }
      delete bag[id];
      return payload;
    };

    /** Read-only inspect helper for tests / debug tooltips. */
    Avian.statuses.peek = function peekStatus(target, id){
      const bag = target === 'player' ? globalThis.G?.playerStatus : globalThis.G?.enemyStatus;
      if(!bag) return null;
      return id in bag ? bag[id] : null;
    };

    /* ----------------------------------------------------------
     * First migration: `delayed` (Resonance).
     * Detonation lives in `tickDelayedForTarget` (boundary tick).
     * We register the verb as an OBSERVER + future extension point
     * (no behavior change today). Wrappers below call hooks at the
     * three lifecycle points so abilities and tooling can react.
     * ---------------------------------------------------------- */
    if(typeof Avian.statuses.register === 'function'){
      Avian.statuses.register('delayed', {
        /** Fires when `tryApplyAilment(target,'delayed',...)` succeeds. */
        onApply: function(target, ctx){
          if(globalThis.Avian?.debug?.enabled){
            try { console.info('[Avian] delayed.onApply', target, ctx); } catch(_e){}
          }
        },
        /** Fires when the boundary detonation fires (set by the wrapper below). */
        onTick: function(side, value){
          if(globalThis.Avian?.debug?.enabled){
            try { console.info('[Avian] delayed.onTick', side, value); } catch(_e){}
          }
        },
        /** Lets abilities consume the stored damage early. Returning the
         *  payload tells the ability how much damage was banked. */
        onConsume: function(target, value/*, source */){
          if(!value || typeof value !== 'object') return null;
          return { dmg: Math.max(0, Number(value.dmg) || 0) };
        },
      });
    }

    /* Wrap `tickDelayedForTarget` so the verb's onTick fires after the
     * existing detonation. Pre-existing behavior is unchanged. */
    const _origTickDelayed = globalThis.tickDelayedForTarget;
    if(typeof _origTickDelayed === 'function' && !_origTickDelayed.__avianDelayedVerb){
      const wrapped = function tickDelayedForTargetVerb(side){
        const status = side === 'player' ? globalThis.G?.playerStatus : globalThis.G?.enemyStatus;
        const before = status && status.delayed ? Object.assign({}, status.delayed) : null;
        const out = _origTickDelayed.apply(this, arguments);
        try {
          if(before && before.dmg && Avian.statuses.delayed && typeof Avian.statuses.delayed.onTick === 'function'){
            Avian.statuses.delayed.onTick(side, before);
          }
        } catch(err){ try { console.warn('[Avian] delayed verb onTick wrap', err); } catch(_e){} }
        return out;
      };
      wrapped.__avianDelayedVerb = true;
      globalThis.tickDelayedForTarget = wrapped;
    }
  })();

  // Enemy trait system
  function enemyTraitFor(e){
    const key = String(e?.id || e?.name || e?.birdKey || '').toLowerCase();
    if(key.includes('harpy')) return {id:'predator', name:'Predator', desc:'+25% damage vs Weakened targets.'};
    if(key.includes('secretary')) return {id:'duelist', name:'Duelist', desc:'First attack each battle always crits.'};
    if(key.includes('barn_owl') || key.includes('barn owl') || key.includes('barnowl')) return {id:'nightHunter', name:'Night Hunter', desc:'+20% dodge during the first 2 turns.'};
    return null;
  }
  globalThis.enemyTraitFor = enemyTraitFor;

  const _oldRefreshBattleUIPolish = globalThis.refreshBattleUI;
  if(typeof _oldRefreshBattleUIPolish === 'function'){
    globalThis.refreshBattleUI = function(){
      try{
        if(G?.enemy && !G.enemy._traitInit){
          G.enemy._traitInit = true;
          G.enemy._trait = enemyTraitFor(G.enemy);
          if(G.enemy._trait?.id === 'nightHunter'){
            G.enemy._traitTurns = 2;
            G.enemy.stats.dodge = Math.min(100, (G.enemy.stats.dodge||0) + 20);
          }
          if(!G.enemy.isBoss && !G.enemy._eliteChecked) G.enemy._eliteChecked = true;
        }
      }catch(err){ console.error(err); }
      const out = _oldRefreshBattleUIPolish.apply(this, arguments);
      try{
        const host = document.getElementById('enemy-status') || document.getElementById('enemy-panel') || document.getElementById('enemy-avatar');
        if(host && G?.enemy?._trait && !document.getElementById('enemy-trait-badge')){
          const badge = document.createElement('div');
          badge.id='enemy-trait-badge';
          badge.className='enemy-trait-badge';
          badge.textContent = `${G.enemy._trait.name}`;
          badge.title = G.enemy._trait.desc;
          host.appendChild(badge);
        }
      }catch(err){ console.error(err); }
      return out;
    };
  }

  const _innerEdmg = globalThis.edmg;
  if(typeof _innerEdmg === 'function'){
    const roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : (n) => Math.max(0.01, Math.round(Number(n) * 100) / 100);
    globalThis.edmg = function(mult=1){
      let out = _innerEdmg.apply(this, arguments);
      try{
        if((G.enemyStatus?.rageBuff||0) > 0){
          out = roundDmg(Math.max(0.01, out * 1.25));
        }
        if(G?.enemy?._trait?.id === 'predator' && (G.playerStatus?.weaken||0) > 0){
          out = roundDmg(out * 1.25);
        }
        if(G?.enemy?._trait?.id === 'duelist' && !G.enemy._duelistUsed){
          G.enemy._duelistUsed = true;
          out = roundDmg(out * 1.5);
        }
      }catch(_){}
      return out;
    };
  }

  const _innerAfterEnemyTurn = globalThis.afterEnemyTurn;
  if(typeof _innerAfterEnemyTurn === 'function'){
    globalThis.afterEnemyTurn = async function(){
      const out = await _innerAfterEnemyTurn.apply(this, arguments);
      try{
        if((G.enemyStatus.rageBuff||0) > 0) G.enemyStatus.rageBuff--;
        if((G.enemyStatus.defending||0) > 0) G.enemyStatus.defending = Math.max(0, G.enemyStatus.defending - 1);
        if((G.enemyStatus.feared||0) > 2) G.enemyStatus.feared = 2;
        if((G.playerStatus.feared||0) > 2) G.playerStatus.feared = 2;
        if((G.playerStatus.weaken||0) > 3) G.playerStatus.weaken = 3;
        if(G.playerStatus.dustDevil?.turns > 2) G.playerStatus.dustDevil.turns = 2;
        if(G?.enemy?._trait?.id === 'nightHunter' && G.enemy._traitTurns > 0){
          G.enemy._traitTurns--;
          if(G.enemy._traitTurns === 0){
            G.enemy.stats.dodge = Math.max(0, (G.enemy.stats.dodge||0) - 20);
          }
        }
      }catch(_){}
      return out;
    };
  }

  // Corrupted biome zones
  function assignCorruptedBiome(){
    if(!G) return;
    const stage = G.stage || 1;
    if(stage % 5 !== 0) return;
    const zones = [
      {id:'toxicMarsh', name:'Toxic Marsh', desc:'Poison effects are stronger.', apply(){ G.biomeMod = {...(G.biomeMod||{}), enemyPoisonPlus:1}; }},
      {id:'stormPeak', name:'Storm Peak', desc:'Lightning users strike harder.', apply(){ G.biomeMod = {...(G.biomeMod||{}), lightningBonus:0.15}; }},
      {id:'dreadCanopy', name:'Dread Canopy', desc:'Fear and weaken linger longer.', apply(){ G.biomeMod = {...(G.biomeMod||{}), dread:1}; }}
    ];
    if(G._lastBiomeStage === stage) return;
    G._lastBiomeStage = stage;
    const z = zones[Math.floor(Math.random()*zones.length)];
    G._corruptZone = z;
    z.apply();
    logMsg(`🌲 ${z.name}: ${z.desc}`, 'system');
  }
  const _oldAdvanceStagePolish = globalThis.advanceStage;
  if(typeof _oldAdvanceStagePolish === 'function'){
    globalThis.advanceStage = function(){
      const out = _oldAdvanceStagePolish.apply(this, arguments);
      try{ assignCorruptedBiome(); }catch(err){ console.error(err); }
      return out;
    };
  }

  // Murmuration event
  function ensureMurmurationModal(){
    const modal = document.getElementById('murmuration-modal');
    if(!modal || modal._wired) return;
    modal._wired = true;
    modal.addEventListener('click', e => { if(e.target === modal) modal.classList.remove('open'); });
  }
  ensureMurmurationModal();

  function murmurationChoices(){
    return [
      {icon:'', name:'Crow Flock', desc:'Bleed and Poison damage +2 this battle.', apply(){ G._murmurationBleedBonus = 2; }},
      {icon:'🦢', name:'Swan Flock', desc:'Gain +8 max HP and heal 10%.', apply(){ G.player.stats.maxHp += 8; G.player.stats.hp = Math.min(G.player.stats.maxHp, G.player.stats.hp + Math.floor(G.player.stats.maxHp*0.10)); }},
      {icon:'🦅', name:'Hawk Flock', desc:'First attack each battle gains +25% damage.', apply(){ G.firstAttackBonus = (G.firstAttackBonus||0) + 0.25; }}
    ];
  }

  function openMurmuration(){
    ensureMurmurationModal();
    const modal = document.getElementById('murmuration-modal');
    const row = document.getElementById('mur-row');
    if(!modal || !row) return;
    row.innerHTML = '';
    murmurationChoices().forEach(choice => {
      const div = document.createElement('div');
      div.className = 'murmuration-opt';
      div.innerHTML = `<span class="m-icon">${choice.icon}</span><div class="m-name">${choice.name}</div><div class="m-desc">${choice.desc}</div>`;
      div.onclick = () => {
        try{ choice.apply(); saveRun && saveRun(); }catch(err){ console.error(err); }
        modal.classList.remove('open');
        logMsg(`🕊 ${choice.name} blesses your run.`, 'exp-gain');
      };
      row.appendChild(div);
    });
    modal.classList.add('open');
  }

  const _oldConfirmRewardPolish = globalThis.confirmReward;
  if(typeof _oldConfirmRewardPolish === 'function'){
    globalThis.confirmReward = function(){
      const out = _oldConfirmRewardPolish.apply(this, arguments);
      try{
        if(Math.random() < 0.12) openMurmuration();
      }catch(err){ console.error(err); }
      return out;
    };
  }

  // Shop 3x4 + artifact row (single source: fortune catalog)
  const ARTIFACTS = (globalThis.FORTUNE_ARTIFACT_STUBS || []).map(function (art) {
    return {
      id: art.id,
      tier: art.tier,
      icon: art.icon,
      name: art.name,
      desc: art.desc,
      apply: art.apply,
    };
  });

  const _oldGenerateShopItemsPolish = globalThis.generateShopItems;
  if(typeof _oldGenerateShopItemsPolish === 'function'){
    globalThis.generateShopItems = function(){
      return _oldGenerateShopItemsPolish.apply(this, arguments);
    };
  }

  const _oldRenderShopItemsPolish2 = globalThis.renderShopItems;
  if(typeof _oldRenderShopItemsPolish2 === 'function'){
    globalThis.renderShopItems = function(){
      const out = _oldRenderShopItemsPolish2.apply(this, arguments);
      try{
        const grid=document.getElementById('shop-items-grid');
        if(!grid) return out;
        const cards=[...grid.querySelectorAll('.shop-item')];
        cards.forEach((card)=>{
          const idx=Number(card.dataset.shopIdx);
          const item=(globalThis._shopItems||[])[idx];
          if(item?.id?.startsWith('art_')) card.classList.add('artifact-card');
        });
      }catch(err){ console.error(err); }
      return out;
    };
  }
})();


// ===== 18_script_18.js =====

/* ===== Magic scaling + upgrade sync fix ===== */
(function(){
  // Replace magic damage scaling so MATK matters directly and does not piggyback on ATK.
  globalThis.matk = function(mult=1){
    const roundDmg = (typeof globalThis.roundCombatDamage === 'function')
      ? globalThis.roundCombatDamage
      : (n) => Math.max(0.01, Math.round(Number(n) * 100) / 100);
    const base = Math.max(0, Number(G?.player?.stats?.matk) || 0);
    const enemyMdef = Math.max(0, G?.enemy?.stats?.mdef || 0);
    const low = base * 0.85;
    const high = base * 1.15;
    const rolled = (typeof rollCombatSpread === 'function')
      ? rollCombatSpread(low, high)
      : roundDmg((low + high) / 2);
    const statDelta = base - enemyMdef;
    const scaling = 1 + (statDelta * 0.02); // stronger feeling MATK scaling
    return roundDmg(Math.max(0.01, rolled * mult * Math.max(0.55, scaling)));
  };

  // Make spell ailment rolls respect MATK more clearly as well.
  globalThis.spellAilmentRoll = function(baseChance, isMultiHit=false){
    const matk = Math.max(0, Number(G?.player?.stats?.matk) || 0);
    const mdef = Math.max(0, Number(G?.enemy?.stats?.mdef) || 0);
    const statShift = (matk - mdef) * 2.5;
    const multiAdj = isMultiHit ? -0.45 : 0.2;
    const final = Math.max(3, Math.min(92, Math.floor((baseChance + statShift) * (1 + multiAdj))));
    return chance(final);
  };

  // Ensure upgrade purchases refresh visible stats immediately.
  const _oldShopBuySelectedScaleFix = globalThis.shopBuySelected;
  if(typeof _oldShopBuySelectedScaleFix === 'function'){
    globalThis.shopBuySelected = function(){
      const out = _oldShopBuySelectedScaleFix.apply(this, arguments);
      try{
        if(typeof renderShopItems === 'function') renderShopItems();
        if(typeof refreshBattleUI === 'function' && G?.enemy && G?.player) refreshBattleUI();
        if(typeof renderAllCombatUI === 'function' && G?.player) renderAllCombatUI();
        if(typeof renderEnergyOrbs === 'function' && G?.player) renderEnergyOrbs();
        if(typeof openNest === 'function'){
          // no-op; just ensure stats in nest use latest live values next time it opens
        }
      }catch(err){ console.error(err); }
      return out;
    };
  }
})();


// ===== 19_script_19.js =====

/* ===== Upgrade multiplier bug fix ===== */
(function(){
  function syncPlayerViews(){
    try{
      if(typeof renderEnergyOrbs === 'function') renderEnergyOrbs();
      if(typeof renderAllCombatUI === 'function' && G?.player) renderAllCombatUI();
      if(typeof refreshBattleUI === 'function' && G?.player && G?.enemy) refreshBattleUI();
    }catch(err){ console.error(err); }
  }

  function sanitizePlayerStats(p){
    if(!p?.stats) return;
    const s = p.stats;
    const caps = {
      atk: 300,
      matk: 300,
      def: 200,
      mdef: 200,
      spd: 100,
      acc: 200,
      dodge: 95,
      maxHp: 9999,
      hp: 9999
    };
    for(const [k, cap] of Object.entries(caps)){
      if(typeof s[k] === 'number'){
        if(!Number.isFinite(s[k])) s[k] = 1;
        s[k] = Math.max(0, Math.min(cap, s[k]));
      }
    }
    if(typeof s.hp === 'number' && typeof s.maxHp === 'number'){
      s.hp = Math.min(s.hp, s.maxHp);
    }
  }

  function normalizeUpgradeItem(item){
    if(!item || typeof item.apply !== 'function') return item;

    // Preserve the original base apply exactly once.
    if(!item.__baseApply){
      item.__baseApply = item.apply;
    }

    // Replace any stacked/nested wrapper chain with one clean wrapper.
    item.apply = function(p){
      if(item.__applying) return;
      item.__applying = true;
      try{
        item.__baseApply && item.__baseApply(p);
        if(typeof enforceAbilityCosts === 'function') enforceAbilityCosts(p);
        if(typeof computePlayerMaxEnergy === 'function' && p){
          p.energyMax = computePlayerMaxEnergy();
          if(typeof p.energy !== 'number') p.energy = p.energyMax;
          p.energy = Math.min(p.energy, p.energyMax);
        }
        sanitizePlayerStats(p);
        syncPlayerViews();
      } finally {
        item.__applying = false;
      }
    };

    item.__normalizedApply = true;
    return item;
  }

  // Used by js/ui/ui.js getUpgradePool wrapper (single outer chain: audit + normalize).
  globalThis._normalizeStorkUpgradeApply = normalizeUpgradeItem;

  // Also sanitize after level-up screens / reward flow so runaway values can't persist.
  const _oldShowLevelUpScreenFix = globalThis.showLevelUpScreen;
  if(typeof _oldShowLevelUpScreenFix === 'function'){
    globalThis.showLevelUpScreen = function(){
      try{ if(G?.player) sanitizePlayerStats(G.player); }catch(err){ console.error(err); }
      return _oldShowLevelUpScreenFix.apply(this, arguments);
    };
  }

  const _oldShowRewardScreenFix = globalThis.showRewardScreen;
  if(typeof _oldShowRewardScreenFix === 'function'){
    globalThis.showRewardScreen = function(){
      try{ if(G?.player) sanitizePlayerStats(G.player); }catch(err){ console.error(err); }
      return _oldShowRewardScreenFix.apply(this, arguments);
    };
  }

  // If a save already contains runaway values, clamp them when opening / continuing play.
  try{
    if(globalThis.G?.player) sanitizePlayerStats(G.player);
  }catch(err){ console.error(err); }
})();


// ===== 20_script_20.js =====

/* Combat rewrite: legacy cooldown('flyby'/'chargeUp') tweaks removed — data pack governs cooldowns. */


// ===== 21_script_21.js =====

// ===== 22_script_22.js =====

// ===== 23_script_23.js =====

/* ===== Trickster identity + ability scaling pass =====
 * Combat rewrite: legacy `setLevels('dart', …)` etc patches are removed; the data
 * pack is the only source of ability tuning. */


// ===== 24_script_24.js =====

/* ===== Global class scaling pass =====
 * Combat rewrite: the legacy `setLevels('rapidPeck', …)` patch table is removed.
 * Ability levels/descs are now data-pack-driven (js/data/combat-pack/skill-trees.js)
 * and read directly by the dispatcher. Every setLevels() call here used to be a no-op
 * after combat-pack-boot wipes ABILITY_TEMPLATES, so the entire IIFE is now gone. */

/* =================================================================
 * Run-summary QoL: replay-seed share button + personal-best diff.
 * Wraps showVictory / showDefeat to inject the additional UI block
 * inside #screen-gameover. Pure DOM augmentation — does not touch
 * the existing stats/unlock rendering or balance logic.
 * ============================================================== */
(function attachRunSummaryQolUi(){
  function safeNumber(n){ return Number.isFinite(n) ? n : 0; }
  function injectQolBlock(won){
    try {
      const root = document.getElementById('screen-gameover');
      if(!root) return;
      const inner = document.getElementById('gameover-inner') || root;
      const Avian = globalThis.Avian || {};
      const systems = Avian.systems || {};
      const seedApi = systems.replaySeed;
      const pbApi   = systems.personalBest;
      const G = globalThis.G || {};
      const birdKey = (G.player && G.player.birdKey) || '';
      const stagesCleared = won
        ? safeNumber(G.stage)
        : Math.max(0, safeNumber(G.stage) - 1);
      const durationSec = (pbApi && typeof pbApi.runDurationSec === 'function')
        ? safeNumber(pbApi.runDurationSec())
        : 0;

      let pbDiff = null;
      if(pbApi && typeof pbApi.record === 'function' && birdKey){
        try { pbDiff = pbApi.record(birdKey, stagesCleared, durationSec); }
        catch(err){ try { console.warn('[Avian] pb.record', err); } catch(_e){} }
      }
      Avian.debug = Avian.debug || {};
      Avian.debug.lastRunPb = pbDiff;

      let host = document.getElementById('run-qol-summary');
      if(!host){
        host = document.createElement('div');
        host.id = 'run-qol-summary';
        host.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;margin:8px 0 6px;font-size:.78rem;color:var(--text-dim);';
        const stats = document.getElementById('run-stats');
        if(stats && stats.parentNode === inner){
          inner.insertBefore(host, stats.nextSibling);
        } else {
          inner.appendChild(host);
        }
      }
      host.innerHTML = '';

      if(pbDiff){
        const badge = document.createElement('div');
        const fmt = (pbApi && typeof pbApi.formatDuration === 'function')
          ? pbApi.formatDuration
          : function(s){ return s + 's'; };
        const lines = [];
        lines.push('Stage: <strong style="color:var(--text)">' + stagesCleared + '</strong>');
        lines.push('Time: <strong style="color:var(--text)">' + fmt(durationSec) + '</strong>');
        if(pbDiff.isPersonalBest){
          lines.unshift('<span style="color:var(--gold-light)">★ Personal Best</span>');
        } else if(pbDiff.previous){
          lines.unshift('<span style="color:#9aa">PB: stage ' + safeNumber(pbDiff.previous.stages) + ' · ' + fmt(safeNumber(pbDiff.previous.durationSec)) + '</span>');
        }
        badge.innerHTML = lines.join(' &nbsp;·&nbsp; ');
        badge.style.cssText = 'padding:6px 10px;border:1px solid rgba(201,168,76,.3);border-radius:8px;background:rgba(20,15,5,.4);';
        host.appendChild(badge);
      }

      if(seedApi && typeof seedApi.shareString === 'function' && seedApi.shareString()){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'nest-btn';
        btn.setAttribute('data-action', 'copyReplaySeed');
        btn.textContent = '🔗 Copy Replay Seed';
        btn.style.cssText = 'background:rgba(40,35,25,.7);border:1px solid rgba(201,168,76,.4);color:var(--gold-light);padding:5px 12px;border-radius:6px;font-size:.78rem;cursor:pointer;';
        host.appendChild(btn);
      }
    } catch(err){ try { console.warn('[Avian] runSummaryQolUi', err); } catch(_e){} }
  }

  const _origVictory = globalThis.showVictory;
  if(typeof _origVictory === 'function'){
    globalThis.showVictory = function(){
      const out = _origVictory.apply(this, arguments);
      injectQolBlock(true);
      return out;
    };
  }
  const _origDefeat = globalThis.showDefeat;
  if(typeof _origDefeat === 'function'){
    globalThis.showDefeat = function(){
      const out = _origDefeat.apply(this, arguments);
      injectQolBlock(false);
      return out;
    };
  }
})();

/* =================================================================
 * Endless counter-tag bands — feed the suggested counter-tag into the
 * enemy spawn path. Wraps `loadStage`; reads
 * `Avian.systems.endlessBands.suggest(stage)` (which itself enforces
 * the enable flag and cadence), stashes the result on G.enemy and
 * emits an event for any UI/debug tooling that wants to render a
 * "danger band" badge. We intentionally do NOT mutate the enemy's
 * stats / abilities — that's a larger balance pass once the simulator
 * harness can verify it. This commit is a wiring + observability
 * commit, fully gated by Avian.flags.endlessBandsEnabled (default off).
 * ============================================================== */
(function attachEndlessBandsLoadStageHook(){
  const _orig = globalThis.loadStage;
  if(typeof _orig !== 'function') return;
  if(_orig.__avianEndlessBands) return;
  const wrapped = function loadStageEndlessBands(){
    const out = _orig.apply(this, arguments);
    try {
      const Avian = globalThis.Avian;
      const G = globalThis.G;
      const bands = Avian && Avian.systems && Avian.systems.endlessBands;
      if(bands && typeof bands.suggest === 'function' && G && G.enemy){
        const stage = typeof G.stage === 'number' ? G.stage : 0;
        const counter = bands.suggest(stage);
        if(counter){
          G.enemy.endlessBandTag = counter;
          try {
            if(typeof globalThis.AvianEvents !== 'undefined' && AvianEvents && typeof AvianEvents.emit === 'function'){
              AvianEvents.emit('endless:band', { stage: stage, counter: counter, enemyId: G.enemy.id || G.enemy.name });
            }
          } catch(_e){ /* event bus optional */ }
          try {
            if(typeof globalThis.logMsg === 'function'){
              globalThis.logMsg('⚠ Counter-band: ' + counter + ' approaches.', 'system');
            }
          } catch(_e){}
        }
      }
    } catch(err){ try { console.warn('[Avian] endlessBands.loadStage', err); } catch(_e){} }
    return out;
  };
  wrapped.__avianEndlessBands = true;
  globalThis.loadStage = wrapped;
})();

/* =================================================================
 * Endless counter-tag bands — record tags acquired via the shop /
 * post-combat reward apply path. The recordTagPick call is gated by
 * `Avian.flags.endlessBandsEnabled` indirectly (suggest() only fires
 * when enabled), so leaving recording always-on is harmless and lets
 * the dominant-tag history exist for tooling / debug HUDs even when
 * counter bands are off.
 * ============================================================== */
(function attachEndlessBandsTagFeed(){
  const _orig = globalThis.applyUpgradeWithMaxHpHealing;
  if(typeof _orig !== 'function') return;
  globalThis.applyUpgradeWithMaxHpHealing = function(player, applyFn, sourceLabel, meta){
    const out = _orig.apply(this, arguments);
    try {
      const Avian = globalThis.Avian;
      const recordTagPick = Avian && Avian.systems && Avian.systems.endlessBands &&
        Avian.systems.endlessBands.recordTagPick;
      if(typeof recordTagPick === 'function'){
        let tags = null;
        if(meta && Array.isArray(meta.tags)) tags = meta.tags;
        else if(meta && meta.id && Array.isArray(globalThis.UPGRADE_CARDS_REWORK)){
          const found = globalThis.UPGRADE_CARDS_REWORK.find(c => c && c.id === meta.id);
          if(found && Array.isArray(found.tags)) tags = found.tags;
        }
        if(tags && tags.length) recordTagPick(tags);
      }
    } catch(err){ try { console.warn('[Avian] endlessBands.recordTagPick', err); } catch(_e){} }
    return out;
  };
})();
