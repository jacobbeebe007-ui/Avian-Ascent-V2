/* Avian Ascent — combat status badges and ailment symbols (Step 7 Phase 3). */
const BATTLE_AILMENT_SYMBOLS={
  poison:{symbol:'☣︎',label:'Toxic poison',className:'toxic'},
  burning:{symbol:'🔥',label:'Burn',className:'burning'},
  weaken:{symbol:'🌀',label:'Weakness',className:'weakness'},
  chilled:{symbol:'❄︎',label:'Chilled',className:'chilled'},
};

function isBattleAilmentSymbolActive(key, value){
  if(!value && value!==0) return false;
  if(key==='poison') return (value?.stacks||0)>0 && (value?.turns||0)>0;
  if(key==='burning') return typeof value==='number' ? value>0 : (value?.turns||0)>0;
  if(key==='weaken') return getWeakenStacks({weaken:value})>0 && (typeof value==='number' ? value>0 : (value?.turns||0)>0);
  if(key==='chilled') return (value?.stacks||0)>0 && (value?.turns||0)>0;
  return false;
}

function renderBattleAilmentSymbols(owner, statuses){
  const wrap=getAvatarWrap(owner);
  if(!wrap) return;
  let layer=wrap.querySelector('.battle-ailment-symbol-layer');
  if(!layer){
    layer=document.createElement('div');
    layer.className='battle-ailment-symbol-layer';
    layer.setAttribute('aria-hidden','true');
    wrap.insertBefore(layer, wrap.firstChild);
  }
  const active=Object.keys(BATTLE_AILMENT_SYMBOLS).filter(key=>isBattleAilmentSymbolActive(key, statuses?.[key]));
  if(!active.length){
    layer.innerHTML='';
    layer.hidden=true;
    return;
  }
  layer.hidden=false;
  layer.innerHTML=active.map((key,idx)=>{
    const meta=BATTLE_AILMENT_SYMBOLS[key];
    return `<span class="battle-ailment-symbol battle-ailment-symbol--${meta.className} battle-ailment-symbol--slot-${idx}" title="${meta.label}">${meta.symbol}</span>`;
  }).join('');
}

function ensureCombatStatusSections(id){
  const root=document.getElementById(id);
  if(!root) return null;
  let ailments=root.querySelector('.combat-status-ailments')||document.getElementById(`${id}-ailments`);
  let modifiers=root.querySelector('.combat-status-modifiers')||document.getElementById(`${id}-modifiers`);
  if(!ailments||!modifiers){
    root.innerHTML='';
    root.classList.add('combat-status-stack');
    ailments=document.createElement('div');
    ailments.className='combat-status-section combat-status-ailments';
    ailments.id=`${id}-ailments`;
    ailments.setAttribute('aria-label','Ailments');
    modifiers=document.createElement('div');
    modifiers.className='combat-status-section combat-status-modifiers';
    modifiers.id=`${id}-modifiers`;
    modifiers.setAttribute('aria-label','Buffs and debuffs');
    root.appendChild(ailments);
    root.appendChild(modifiers);
  }
  ailments.innerHTML='';
  modifiers.innerHTML='';
  return { root, ailments, modifiers };
}

/** Clear identity perk/passive/trait badges from the battle status strip.
 *  Those belong in Stats & Details / bird select, not as combat status tags. */
function syncEnemyIdentityStatusBadges(){
  if(!G?.enemyStatus) return;
  delete G.enemyStatus.identityPassive;
  delete G.enemyStatus.identityClassPerk;
  delete G.enemyStatus.identityTrait;
}

function renderStatuses(id, statuses) {
  if(id==='enemy-status') syncEnemyIdentityStatusBadges();
  const sections=ensureCombatStatusSections(id);
  if(!sections) return;
  const { ailments, modifiers }=sections;
  const owner = id === 'player-status' ? 'player' : 'enemy';
  const ownerStats = owner === 'player' ? G?.player?.stats : G?.enemy?.stats;
  const poisonCap = G?.player ? (G.player.poisonCap||5) : 5;
  const poisonBoundaryDamage = stacks=>{
    if(typeof calcPoisonTickDmg==='function'){
      const mult=owner==='enemy'?(G?.player?.poisonTickMult||1):1;
      const base=calcPoisonTickDmg(stacks, ownerStats?.maxHp || 1, mult);
      const flat=owner==='enemy'?((G?.player?.poisonFlatBonus||0)+(G?.player?.perkPoisonTickBonus||0)+(G?.player?.relVenomLedger?1:0)):0;
      return Math.max(1, base+flat);
    }
    return Math.max(1,(stacks||0));
  };
  const ctx={
    owner,
    statuses,
    poisonCap,
    poisonBoundaryDamage,
    getWeakenStacks,
    getWeakenDamageMult,
    getWeakenDodgePenalty,
    confusedSelfPct: STATUS_CONFUSED_SELF_PCT,
  };
  const collectFn=typeof collectCombatStatusEntries==='function'?collectCombatStatusEntries:Avian?.statusDefs?.collectCombatStatusEntries;
  const resolveFn=typeof resolveCombatStatusBadge==='function'?resolveCombatStatusBadge:Avian?.statusDefs?.resolveStatusBadge;
  const detailFn=Avian?.statusDefs?.buildStatusDetail;
  if(!collectFn||!resolveFn) return;
  const entries=collectFn(statuses, ownerStats);
  entries.forEach(entry=>{
    const badge=resolveFn(entry, ctx);
    if(!badge||!badge.text) return;
    const cat=badge.category||'system';
    const host=cat==='ailment'?ailments:modifiers;
    const b=document.createElement('span');
    const catClass=cat==='ailment'?'status-badge--ailment':cat==='buff'?'status-badge--buff':cat==='debuff'?'status-badge--debuff':'';
    b.className=[badge.className||('status-badge '+entry.id), catClass].filter(Boolean).join(' ');
    b.textContent=badge.text;
    b.title=badge.text.replace(/\s+/g,' ').trim();
    b.dataset.statusId = entry.id.split(':')[0];
    const detailParts=[badge.summary||''];
    if(badge.source) detailParts.push('Source: '+badge.source+'.');
    if(typeof detailFn==='function') detailParts.push(detailFn(entry.id, entry.value, badge.summary, ctx));
    b.dataset.statusDetail = detailParts.filter(Boolean).join(' ');
    b.dataset.statusCategory = cat;
    b.addEventListener('mouseenter',e=>showTooltip(e,`${b.title}\n${b.dataset.statusDetail||''}`,e.clientX+12,e.clientY+12));
    b.addEventListener('mousemove',e=>moveTooltip(e.clientX+12,e.clientY+12));
    b.addEventListener('mouseleave',hideTooltip);
    host.appendChild(b);
  });
  renderBattleAilmentSymbols(owner, statuses);
}

globalThis.renderStatuses = renderStatuses;
globalThis.renderBattleAilmentSymbols = renderBattleAilmentSymbols;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatStatus = { renderStatuses, renderBattleAilmentSymbols };
