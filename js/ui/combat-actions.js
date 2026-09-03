/* Avian Ascent — combat action tray rendering (Step 7 Phase 3). */
function renderCombatItems(){
  const row=document.getElementById('combat-items-row');
  if(!row || !G.player) return;
  ensureCombatItems(G.player);
  row.innerHTML='';
  const locked=!canPlayerAct();
  const healUsed=!!G._combatHealUsedThisTurn;
  Object.keys(COMBAT_ITEM_CATALOG).forEach(itemKey=>{
    const def=COMBAT_ITEM_CATALOG[itemKey];
    const count=getCombatItemCount(G.player, itemKey);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='combat-item-btn';
    const pct=Math.round((def.healPct||0)*100);
    btn.innerHTML=`<span class="combat-item-icon" aria-hidden="true">${def.icon}</span><span class="combat-item-copy"><span class="combat-item-label">${escapeHtmlRoster(def.name)}</span><span class="combat-item-meta">${pct}% · ${def.energyCost} EN · ×${count}</span></span>`;
    const usable=!locked && !healUsed && count>0 && (G.player.energy||0)>=def.energyCost;
    btn.disabled=!usable;
    btn.title=def.combatHint||`${def.name}: heal ${pct}% max HP for ${def.energyCost} EN (one heal item per turn)`;
    if(typeof bindRichTooltip==='function' && tooltipsEnabled('items')){
      bindRichTooltip(btn, ()=>`<div class="tt-name">${escapeHtmlRoster(def.name)}</div><div class="tt-type">Battle heal item</div><div class="tt-body">${escapeHtmlRoster(def.combatHint||'')}</div>${richTooltipCloseBtn()}`, {category:'items'});
    }
    btn.onclick=()=>useCombatItem(itemKey);
    row.appendChild(btn);
  });
}

function compactCombatAbilityDescription(value){
  return String(value||'')
    .replace(/\b(?:energy\s+)?costs?\s*:?\s*\d+\s*EN\b\s*[.,;·-]?\s*/gi,'')
    .replace(/\s{2,}/g,' ')
    .trim();
}

function renderActions() {
  const grid=document.getElementById('actions-grid');
  if(!grid) return;
  if(!G.player) return;
  const eqV2=true;
  const battleScreen=document.getElementById('screen-battle');
  if(battleScreen) battleScreen.classList.toggle('equipment-v2-mode', eqV2);
  grid.classList.toggle('actions-grid--equipment-v2', eqV2);
  if(eqV2 && typeof Avian?.equipmentActions?.syncEntityAbilities==='function'){
    Avian.equipmentActions.syncEntityAbilities(G.player);
    ensureMainAttackAndLoadoutRules();
  }else if(usesFamilySkillEvolution(G.player)){
    syncPlayerAbilitiesFromSkillSlots(G.player);
    ensureMainAttackAndLoadoutRules();
  }
  grid.innerHTML='';
  renderEnergyOrbs();
  renderCombatItems();
  if(G.player.abilities?.length) enforceAbilityCosts(G.player);
  const locked=!canPlayerAct();
  const endTurnBlocked=!!(G.actionBusy||G.turnPhase===TURN.RESOLVING);
  let allAbilities=eqV2 ? (G.player.abilities||[]).slice(0, 6) : [...(G.player.abilities||[])];
  if(!eqV2){
    const order={physical:0,ranged:1,spell:2,utility:3};
    allAbilities=allAbilities.sort((a,b)=>(order[a.btnType]??9)-(order[b.btnType]??9));
  }
  let autoQueued=G.autoQueuedAbilityId||null;
  if(autoQueued){
    const aq=G.player.abilities.find(x=>x.id===autoQueued);
    if(!aq||!canUseAbility(G.player,aq)){G.autoQueuedAbilityId=null;autoQueued=null;}
  }
  allAbilities.forEach((ab,idx)=>{
    const btn=document.createElement('button');
    btn.setAttribute('data-ab-idx',idx);
    btn.setAttribute('data-ab-id',ab.id||'');
    const sourceKey=ab.actionSource||null;
    const sourceLbl=(eqV2 && typeof Avian?.equipmentActions?.getActionSourceLabel==='function')
      ? Avian.equipmentActions.getActionSourceLabel(sourceKey)
      : '';
    const isEmptySlot=!!ab.empty;
    const energyCost=isEmptySlot?0:syncAbilityEnergyCost(ab);
    let btnCostText=isEmptySlot?(ab.reason||'Empty'):`${energyCost} EN`;
    let cdisabled=isEmptySlot;
    if(!isEmptySlot && ab.id==='flyby') {
      btnCostText=G.flybyCharged?'Momentum ready!':'Build momentum';
    }
    if(!isEmptySlot && ab.id==='rockDrop') {
      btnCostText=G.rockDropPending?'Drop armed!':btnCostText;
    }
    if(!isEmptySlot){
      const genericCd=getAbilityCooldown(ab.id);
      if(genericCd>0){btnCostText=`Cooldown:${genericCd}t`;cdisabled=true;}
      const _packRow=typeof packRowForAbility==='function'?packRowForAbility(ab):null;
      if(typeof isUltimateAbility==='function' && isUltimateAbility(ab,_packRow)){
        const _meter=typeof getUltimateMeter==='function'?getUltimateMeter('player'):0;
        const _maxMeter=typeof maxUltimateMeter==='function'?maxUltimateMeter():100;
        if(_meter<_maxMeter){btnCostText=`Ult ${_meter}/${_maxMeter}`;cdisabled=true;}
        else btnCostText='Ult Ready · 0 EN';
      }
      if (ab.id==='sitAndWait' && G.sitAndWaitUsedThisTurn) { btnCostText='Used this turn'; cdisabled=true; }
      if (ab.id==='stickLance') {
        if (G.stickLanceStage===1) btnCostText='⚔ Strike now!';
        else if (G.stickLanceStage===-1) btnCostText='No stick found';
      }
      if(autoQueued&&ab.id!==autoQueued){cdisabled=true;btnCostText='Auto queued';}
      if(autoQueued&&ab.id===autoQueued){btnCostText='Auto queued';}
      if(!cdisabled && G.turnPhase===TURN.PLAYER && !canUseAbility(G.player,ab)){cdisabled=true;btnCostText=`${energyCost} EN (insufficient)`;}
      if(!cdisabled && G.turnPhase===TURN.PLAYER){
        const _tmplUsed=getAbilityTemplateForUI(ab);
        const _effUsed=getEffectiveAbilityBtnType(ab,_tmplUsed);
        if(_effUsed==='utility' && G.utilityUsedThisTurn?.[ab.id]){
          cdisabled=true;btnCostText='Used this turn';
        }else{
          const _enRoles=Avian?.data?.combatConfig?.enRoles;
          const _isBasic=ab?.actionSource==='basic'||ab?.isMainAttack||ab?.id==='BASIC_PHYSICAL'||ab?.id==='BASIC_MAGIC'
            ||(typeof isMainAttackAbility==='function'&&isMainAttackAbility(ab,G.player));
          const _actionKey=ab.actionSource||ab.id;
          if(_enRoles?.oncePerTurnActionUse && !_isBasic && _actionKey && G.actionUsedThisTurn?.[_actionKey]){
            cdisabled=true;btnCostText='Used this turn';
          }
        }
      }
    }
    btn.disabled=locked||cdisabled||isEmptySlot;
    btn.title=isEmptySlot?(ab.reason||sourceLbl||ab.name):`${ab.name}\nEnergy: ${energyCost}${sourceLbl?`\n${sourceLbl}`:''}`;
    const ailDots=(ab.ailmentIds||[]).map(a=>`<div class="ail-dot ${a}"></div>`).join('');
    const dmgTypes=['physical','ranged','spell'];
    const _tmplUI=isEmptySlot?null:getAbilityTemplateForUI(ab);
    const effBtn=isEmptySlot?'utility':getEffectiveAbilityBtnType(ab,_tmplUI);
    btn.className=`action-btn ${effBtn}${isEmptySlot?' action-btn--empty':''}${eqV2?' action-btn--eq-source':''}`;
    let modTxt='';
    if(!isEmptySlot && dmgTypes.includes(effBtn)){
      const mods=[];
      if(G.warcryActive) mods.push('⬆ Might buff');
      if(getWeakenStacks(G.playerStatus)>0) mods.push('⬇ Weakened');
      if(G.playerStatus?.feared) mods.push('⬇ Fear hit penalty');
      if(G.playerStatus?.battleHymn) mods.push('⬆ Hymn buff');
      if(mods.length) modTxt=`<span class=\"btn-mod\" title=\"${mods.join(' | ')}\">${mods.join(' · ')}</span>`;
    }
    const _packRowUI=(!isEmptySlot && typeof packRowForAbility==='function')?packRowForAbility(ab):null;
    const briefHtml=compactCombatAbilityDescription((!isEmptySlot && typeof formatAbilityBlurbHtml==='function'
      ? formatAbilityBlurbHtml(ab, _tmplUI, _packRowUI)
      : '')
      ||(!isEmptySlot && typeof buildAbilityCombatBriefHtml==='function'?buildAbilityCombatBriefHtml(ab, _packRowUI||_tmplUI):'')
      ||(!isEmptySlot && typeof formatTemplateCombatBriefHtml==='function'?formatTemplateCombatBriefHtml(_tmplUI):''));
    let _rawFallback=isEmptySlot?'':(getAbDesc(ab)||_tmplUI?.desc||ab.desc||_packRowUI?.riderText||'');
    if(/reliable fallback|no automatic rider/i.test(String(_rawFallback))) _rawFallback='';
    const fallbackDesc=isEmptySlot?'':compactCombatAbilityDescription((_rawFallback+getAbilityDamageScalingHintForUI(ab)).replace(/<[^>]+>/g,''));
    const _dmgEst=(!isEmptySlot?estimateSkillDamageRange(ab,_tmplUI,G.player,{isPlayerCombatPreview:true}):{isDamaging:false});
    let dmgRow='';
    if(_dmgEst.isDamaging&&_dmgEst.dmgLow!=null){
      if(_dmgEst.hybridSplit){
        const h=_dmgEst.hybridSplit;
        dmgRow=`<div class="btn-dmg-row"><span class="btn-dmg-hybrid" title="Hybrid: Might-scaling half (red) and Focus-scaling half (purple); combat averages the two after Guard/Resolve.">
          <span class="btn-dmg-atk">Might ~${h.atkLow}–${h.atkHigh}</span>
          <span class="btn-dmg-matk">Focus ~${h.matkLow}–${h.matkHigh}</span>
        </span></div>`;
      }else dmgRow=`<div class="btn-dmg-row"><span class="btn-dmg-est" title="Estimated damage after enemy Guard/Resolve (approx.; your buffs included)">Dmg ~${_dmgEst.dmgLow}–${_dmgEst.dmgHigh}</span></div>`;
    }
    const _escMini=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const _statPrev=(!isEmptySlot?getSkillStatPreviewLines(ab,_tmplUI):[]);
    const statPrevChip=_statPrev.length?`<span class="btn-stat-preview">${_statPrev.map(l=>_escMini(l)).join(' · ')}</span>`:'';
    const typeLbl=abilityTypeChipLabel(effBtn);
    const displayName=isEmptySlot?(sourceLbl||'—'):ab.name;
    const sourceChip=(!isEmptySlot && eqV2 && sourceLbl)?`<span class="btn-source-chip">${_escMini(sourceLbl)}</span>`:'';
    const emptyReasonRow=isEmptySlot?`<div class="btn-empty-reason">${_escMini(ab.reason||'Empty')}</div>`:'';
    const filledMeta=isEmptySlot?'':`<span class="btn-type-chip btn-type-chip--${effBtn}">${typeLbl}</span>
          <span class="btn-en-chip">${_escMini(btnCostText)}</span>`;
    btn.innerHTML=`
      <div class="btn-head">
        <span class="btn-name">${_escMini(displayName)}</span>
        <span class="btn-meta">
          ${sourceChip}
          ${filledMeta}
        </span>
      </div>
      ${emptyReasonRow}
      ${dmgRow}
      ${(briefHtml||fallbackDesc)?`<div class="btn-desc-lines btn-desc-full">${briefHtml||`<p>${_escMini(fallbackDesc)}</p>`}</div>`:''}
      ${statPrevChip}
      ${modTxt}
      ${!isEmptySlot&&ab.level>1?`<span class="ab-lv-badge">Lv${ab.level}</span>`:''}
      ${ailDots?`<div class="ailment-icons">${ailDots}</div>`:''}
      <span class="kb-hint">[${idx+1}]</span>`;
    const currentAb = ()=> (G?.player?.abilities||[]).find(x=>x.id===ab.id) || ab;
    if(!isEmptySlot){
      btn.onclick=()=>enqueueAction(()=>{
        const act=globalThis.playerAction||playerAction;
        return act(currentAb(),true);
      });
      btn.addEventListener('mouseenter',e=>{if(!window._isTouchDevice)showActionTooltip(e,currentAb());});
      btn.addEventListener('mousemove',e=>{if(!window._isTouchDevice)moveTooltip(e);});
      btn.addEventListener('mouseleave',()=>{if(!window._isTouchDevice)hideTooltip();});
      let _longPressTimer=null;
      btn.addEventListener('touchstart',e=>{
        window._isTouchDevice=true;
        _longPressTimer=setTimeout(()=>{
          _longPressTimer=null;
          const touch=e.touches[0];
          const cur=currentAb();
          showActionTooltip({clientX:touch.clientX,clientY:touch.clientY},cur);
          document.getElementById('action-tooltip')._currentAbId=cur.id;
        },500);
      },{passive:true});
      btn.addEventListener('touchend',()=>{
        if(_longPressTimer){clearTimeout(_longPressTimer);_longPressTimer=null;}
      },{passive:true});
      btn.addEventListener('touchmove',()=>{
        if(_longPressTimer){clearTimeout(_longPressTimer);_longPressTimer=null;}
      },{passive:true});
    }
    grid.appendChild(btn);
  });

  const _passOnlyActionIds=new Set(['skipTurn','sittingDuck','endTurn']);
  const hasPlayableAction=[...grid.querySelectorAll('.action-btn[data-ab-id]')].some(b=>{
    if(b.disabled) return false;
    const id=b.getAttribute('data-ab-id')||'';
    if(_passOnlyActionIds.has(id)) return false;
    return true;
  });
  const endWrap=document.createElement('div');
  endWrap.className='actions-grid-footer';
  const endBtn=document.createElement('button');
  endBtn.className='action-btn endturn-mini end-turn-bar__btn';
  endBtn.textContent='End Turn';
  endBtn.disabled=endTurnBlocked;
  endBtn.onclick=()=>endPlayerTurn();
  endWrap.appendChild(endBtn);
  grid.appendChild(endWrap);

  applyEffectiveCombatScales(getAccessibilitySettings(), eqV2 ? 6 : allAbilities.length);

  if(!G.battleOver&&G.turn==='player'&&G.turnPhase===TURN.PLAYER&&G.phase==='PLAYER'&&!G.actionBusy
    &&!hasPlayableAction&&canPlayerAct()
    &&G._noEnAutoPassScheduledSerial!==(G._playerTurnSerial|0)){
    G._noEnAutoPassScheduledSerial=G._playerTurnSerial|0;
    queueMicrotask(()=>{
      if(G.battleOver||G.turn!=='player'||G.turnPhase!==TURN.PLAYER||G.phase!=='PLAYER') return;
      if(G._noEnAutoPassScheduledSerial!==(G._playerTurnSerial|0)) return;
      try{ endPlayerTurn(true); }catch(_){}
    });
  }
}

if(typeof Avian?.actions?.register==='function'){
  Avian.actions.register('fireAbilitySlot', function(slotIdx){
    const idx=Number(slotIdx);
    if(!Number.isFinite(idx)||idx<0) return;
    const btns=[...document.querySelectorAll('#actions-grid .action-btn[data-ab-idx]')].filter(b=>!b.classList.contains('endturn-mini'));
    const btn=btns[idx];
    if(btn&&!btn.disabled) btn.click();
  });
}

globalThis.renderActions = renderActions;
globalThis.renderCombatItems = renderCombatItems;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatActions = { renderActions, renderCombatItems };
