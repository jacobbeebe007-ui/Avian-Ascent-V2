/* Avian Ascent — post-battle reward screen orchestration (Step 7 Phase 5). */
// ============================================================
//  REWARD SCREEN — select then confirm
// ============================================================
function rollTier(isBoss) {
  const weights=isBoss?BOSS_WEIGHTS:NORMAL_WEIGHTS;
  const tiers=['grey','green','blue','purple','gold'];
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<tiers.length;i++){r-=weights[i];if(r<=0)return tiers[i];}
  return 'grey';
}

function isMutationReward(rw) {
  return !!(rw && (rw.type === 'mutation' || rw.mutationItemId));
}

function isEquipmentReward(rw) {
  return !!(rw && (rw.type === 'equipment' || rw.equipmentItemId));
}

function applySingleReward(rw) {
  if (!rw || rw.id === '_reward_skip') return;
  if (!G.endlessMode) Avian.storyRun?.collectReward(rw);
  if (rw.type === 'equipment') {
    const itemId = rw.equipmentItemId || rw.id;
    if (typeof grantPlayerEquipmentItem === 'function') grantPlayerEquipmentItem(itemId);
    else if (typeof Avian?.equipment?.addToInventory === 'function') Avian.equipment.addToInventory(G.player, itemId);
    if (typeof Avian?.equipmentLoot?.registerOrangeAcquired === 'function') {
      Avian.equipmentLoot.registerOrangeAcquired(Avian.equipmentLoot.getItem(itemId));
    }
    if (typeof Avian?.equipmentLoot?.markRunUnlockedEquipmentRarity === 'function') {
      const it = Avian.equipmentLoot.getItem(itemId);
      Avian.equipmentLoot.markRunUnlockedEquipmentRarity(G, (it && it.rarity) || rw.tier);
    }
    reapplyPlayerGearStats(G.player);
  } else if (rw.type === 'mutation') {
    const itemId = rw.mutationItemId || rw.id;
    
    reapplyPlayerGearStats(G.player);
    codexMark('mutations', itemId, 'seen');
  } else {
    applyUpgradeWithMaxHpHealing(G.player, () => rw.apply(G.player), rw.name || 'Upgrade', { id: rw.id, desc: rw.desc });
  }
  if (rw.endlessOnly) logMsg('♾ Endless-only reward acquired (not available in Story Mode).', 'system');
  const rewardEvt = { tier: rw.tier, id: rw.id || rw.name };
  AvianEvents.emit('reward:confirmed', rewardEvt);
  runModuleHook('onRewardConfirmed', rewardEvt);
  codexMark('artifacts', rw.id || rw.name, 'seen');
  logMsg(`✦ Gained: ${rw.name}!`, 'system');
  if (!G.collectedRewards) G.collectedRewards = [];
  G.collectedRewards.push({
    id: rw.id || rw.name,
    icon: rw.icon,
    tier: rw.tier,
    name: rw.name,
    desc: rw.desc,
  });
  if (rw.stackable === false) {
    if (!(G.runUpgradesPurchased instanceof Set)) G.runUpgradesPurchased = new Set();
    G.runUpgradesPurchased.add(rw.id);
  }
}

function finishRewardScreenFlow() {
  G._pendingReward = null;
  G._pendingRewardQueue = null;
  G._rewardsAlreadyGranted = false;
  G._goldReplaceMode = false;
  document.getElementById('reward-confirm-btn').className = 'confirm-btn';
  const gru = document.getElementById('gold-replace-ui');
  if (gru) gru.remove();

  saveRun();

  const failsafeAdvance = () => {
    setTimeout(() => {
      if (!G.turnPhase && !document.querySelector('.screen.active')) {
        if(isEndlessMapActive()) showEndlessMap();
        else advanceStage();
      }
    }, 50);
  };

  const lastEnemyWasBoss = !!(G.enemy && G.enemy.isBoss);
  G.phase = 'REWARD';
  const multiEnemyChainPending = hasMultiEnemyChainPending();
  const shopDue = isShopDueAfterBattle({
    stage: G.stage,
    endlessMode: !!G.endlessMode,
    endlessBattle: G.endlessBattle,
    lastEnemyWasBoss,
  }) && !multiEnemyChainPending && !_isOverworldRun();
  let shopMode = 'grey';
  if (G.endlessMode && lastEnemyWasBoss) shopMode = 'endless-boss';
  else if (!G.endlessMode && lastEnemyWasBoss) shopMode = 'boss';

  if (G._pendingLevelUp) {
    if (shopDue) {
      G._pendingStorkShop = true;
      G._pendingShopMode = shopMode;
    }
    G.phase = 'LEVELUP';
    showLevelUpScreen();
    if (G._pendingLevelUpChoices > 0) {
      failsafeAdvance('confirmReward after showLevelUpScreen');
      return;
    }
    G._pendingLevelUp = false;
  }

  if (shopDue) showStorkShop(shopMode);
  else if (_isOverworldRun() || isEndlessMapActive()) continueStageTransitionAfterRewards();
  else advanceStage();

  failsafeAdvance('confirmReward after shop/advance');
}

function grantRewardPool(pool) {
  if (!pool || !pool.length) return true;
  for (let i = 0; i < pool.length; i++) {
    const rw = pool[i];
    if (rw.tier === 'gold' && getGoldCardCount() >= getGoldCardLimit()) {
      G._pendingReward = rw;
      G._pendingRewardQueue = pool.slice(i + 1);
      showGoldReplaceUI(rw);
      return false;
    }
    applySingleReward(rw);
  }
  return true;
}

function drainPendingRewardQueue() {
  const queue = G._pendingRewardQueue;
  G._pendingRewardQueue = null;
  if (!queue || !queue.length) return true;
  return grantRewardPool(queue);
}

function buildNestRewardCardHtml(drop, animDelayMs=0, opts={}){
  const tierCss=normalizeRewardTier(drop.tier||'white');
  const tierMeta=rewardTierMeta(drop.tier);
  const desc=drop.type==='mutation'
    ?(getMutationDescHtml(drop.mutationItemId||drop.id,{compact:true})||escapeHtmlRoster(drop.desc||''))
    :escapeHtmlRoster(drop.desc||'');
  const extraCls=[opts.falling?'is-falling':'', opts.landed?'is-landed':''].filter(Boolean).join(' ');
  const styleParts=[];
  if(animDelayMs>0) styleParts.push(`animation-delay:${animDelayMs}ms`);
  if(opts.falling && Number.isFinite(opts.fallingIndex)){
    const spread=(opts.fallingIndex%3-1)*18;
    styleParts.push(`--fall-spread:${spread}px`);
  }
  const style=styleParts.length?` style="${styleParts.join(';')}"`:'';
  const idxAttr=Number.isFinite(opts.dropIndex)?` data-drop-index="${opts.dropIndex}"`:'';
  return `<div class="nest-reward-card tier-${tierCss}${extraCls?' '+extraCls:''}"${idxAttr} data-tier="${tierCss}"${style}>
    <div class="reward-tier-label">${tierMeta.label}</div>
    <span class="reward-icon">${drop.icon||'🎁'}</span>
    <div class="reward-name">${escapeHtmlRoster(drop.name||'Reward')}</div>
    <div class="reward-desc">${desc}</div>
  </div>`;
}

function buildRewardFlipCardBackHtml(drop, opts={}){
  const tierCss=normalizeRewardTier(drop.tier||'white');
  const tierMeta=rewardTierMeta(drop.tier);
  const compact=opts.compact!==false;
  const desc=drop.type==='mutation'
    ?(getMutationDescHtml(drop.mutationItemId||drop.id,{compact:true})||escapeHtmlRoster(drop.desc||''))
    :escapeHtmlRoster(drop.desc||'');
  return `<div class="reward-reveal-card tier-${tierCss}" data-tier="${tierCss}">
    <div class="reward-tier-label">${tierMeta.label||drop.tierLabel||''}</div>
    <span class="reward-icon">${drop.icon||'🎁'}</span>
    <div class="reward-name">${escapeHtmlRoster(drop.name||'Reward')}</div>
    ${compact?'':`<div class="reward-desc">${desc}</div>`}
  </div>`;
}

function buildRewardFlipCardHtml(drop, opts={}){
  const tierCss=normalizeRewardTier(drop.tier||'white');
  const idxAttr=Number.isFinite(opts.dropIndex)?` data-drop-index="${opts.dropIndex}"`:'';
  const flipped=opts.revealed?' is-flipped':'';
  const selectable=opts.selectable?' reward-hatch-flip--selectable':'';
  const equipCls=opts.equipmentPick?' reward-hatch-flip--equipment':'';
  const ariaBack=opts.revealed?'false':'true';
  const ariaFront=opts.revealed?'true':'false';
  return `<div class="mother-goose-hatch-slot reward-hatch-slot"${idxAttr}>
    <div class="mother-goose-hatch-flip mother-goose-hatch-flip--nest tier-${tierCss}${flipped}${selectable}${equipCls}" data-tier="${tierCss}">
      <div class="mother-goose-hatch-flip-front mother-goose-hatch-flip-front--nest tier-${tierCss}" aria-hidden="${ariaFront}">
        <span class="mother-goose-hatch-egg" aria-hidden="true">🪺</span>
      </div>
      <div class="mother-goose-hatch-flip-back" aria-hidden="${ariaBack}">
        ${buildRewardFlipCardBackHtml(drop, opts)}
      </div>
    </div>
  </div>`;
}

function rewardFlipRevealDelayMs(){
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?0:520;
}

function rewardFlipStaggerMs(drop, isHighTier){
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return 120;
  return isHighTier?220:180;
}

function revealRewardFlipCard(slotOrFlip){
  const flip=slotOrFlip?.classList?.contains('mother-goose-hatch-flip')
    ?slotOrFlip
    :slotOrFlip?.querySelector?.('.mother-goose-hatch-flip');
  if(!flip || flip.classList.contains('is-flipped')) return;
  flip.classList.remove('is-shaking');
  void flip.offsetWidth;
  flip.classList.add('is-flipped');
  const back=flip.querySelector('.mother-goose-hatch-flip-back');
  const front=flip.querySelector('.mother-goose-hatch-flip-front');
  if(back) back.setAttribute('aria-hidden','false');
  if(front) front.setAttribute('aria-hidden','true');
}

function preSizeNestRewardTray(dropCount){
  const tray=document.getElementById('nest-reward-tray');
  if(!tray || dropCount<=0) return;
  const rows=Math.ceil(dropCount/3);
  tray.style.setProperty('--tray-rows', String(rows));
  tray.classList.add('is-pre-sized');
}

function spawnNestShakeSparks(scene, nest, dropCount=1){
  const fx=document.getElementById('nest-shake-fx');
  if(!fx || !nest) return;
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  fx.innerHTML='';
  const rect=nest.getBoundingClientRect();
  const sceneRect=scene?.getBoundingClientRect();
  if(!sceneRect) return;
  const cx=rect.left+rect.width/2-sceneRect.left;
  const cy=rect.top+rect.height/2-sceneRect.top;
  const sparkCount=Math.min(8, 3+dropCount);
  for(let i=0;i<sparkCount;i++){
    const s=document.createElement('span');
    s.className='nest-shake-spark'+(dropCount>2?' is-gold':'');
    const angle=(Math.PI*2*i)/sparkCount + Math.random()*0.4;
    const dist=18+Math.random()*22;
    s.style.left=(cx-3)+'px';
    s.style.top=(cy-3)+'px';
    s.style.setProperty('--sx', `${Math.cos(angle)*6}px`);
    s.style.setProperty('--sy', `${Math.sin(angle)*6-8}px`);
    s.style.setProperty('--ex', `${Math.cos(angle)*dist}px`);
    s.style.setProperty('--ey', `${Math.sin(angle)*dist+16}px`);
    s.style.animationDelay=(i*40)+'ms';
    fx.appendChild(s);
  }
  setTimeout(()=>{ if(fx) fx.innerHTML=''; }, 800);
}

function wireNestRewardTrayTooltips(tray){
  if(!tray || typeof bindRichTooltip!=='function') return;
  const collected=G._nestRewardsCollected||[];
  collected.forEach((drop,i)=>{
    const card=tray.querySelector(`[data-drop-index="${i}"]`)||tray.children[i];
    if(!card) return;
    const target=card.querySelector('.reward-reveal-card')||card.querySelector('.mother-goose-hatch-flip-back')||card;
    target._richTooltipBound=false;
    if(drop.type==='mutation'){
      const mutId=drop.mutationItemId||drop.id;
      if(mutId) bindRichTooltip(target, ()=>buildMutationTooltipHTML(mutId), {category:'mutations'});
      return;
    }
    if(drop.type==='equipment' || drop.equipmentItemId){
      const eqId=drop.equipmentItemId||drop.id;
      if(eqId) bindRichTooltip(target, ()=>buildEquipmentTooltipHTML(eqId), {category:'items'});
      return;
    }
    if(drop.desc && (drop.type==='combat_item' || drop.type==='shiny' || drop.type==='rescuedNest')){
      bindRichTooltip(target, ()=>`<div class="tt-name">${escapeHtmlRoster(drop.name||'Reward')}</div><div class="tt-desc">${escapeHtmlRoster(drop.desc||'')}</div>`);
    }
  });
}

function renderNestRewardCollectedTray(opts={}){
  const tray=document.getElementById('nest-reward-tray');
  if(!tray) return;
  const collected=G._nestRewardsCollected||[];
  const onlyIndex=Number.isFinite(opts.onlyIndex)?opts.onlyIndex:null;
  const revealed=opts.revealed!==false;
  if(onlyIndex!=null){
    const drop=collected[onlyIndex];
    if(!drop) return;
    const wrap=document.createElement('div');
    wrap.innerHTML=buildRewardFlipCardHtml(drop, {dropIndex:onlyIndex, revealed, compact:true});
    const card=wrap.firstElementChild;
    if(card) tray.appendChild(card);
    wireNestRewardTrayTooltips(tray);
    return;
  }
  tray.innerHTML=collected.map((drop,i)=>buildRewardFlipCardHtml(drop, {dropIndex:i, revealed, compact:true})).join('');
  wireNestRewardTrayTooltips(tray);
}

function finishNestRewardReveal(){
  const hint=document.getElementById('nest-shake-hint');
  if(hint) hint.textContent='Rewards collected!';
  const footnote=document.getElementById('nest-reward-footnote');
  if(footnote) footnote.style.display='block';
  const nest=document.getElementById('reward-nest');
  if(nest){
    nest.classList.remove('nest-shakeable','nest-shake-intense');
    nest.onclick=null;
  }
  const dropLayer=document.getElementById('nest-drop-layer');
  if(dropLayer) dropLayer.innerHTML='';
  const scene=document.getElementById('nest-reward-scene');
  if(scene) scene.classList.remove('is-shaking','is-compact');
  const confirmBtn=document.getElementById('reward-confirm-btn');
  if(confirmBtn){
    confirmBtn.textContent='Continue →';
    confirmBtn.className='confirm-btn visible';
  }
  G._rewardsAlreadyGranted=true;
  G._nestShaken=true;
}

function revealNestDropsStaggered(){
  const drops=G._nestRewardDrops||[];
  if(!G._nestRewardsCollected) G._nestRewardsCollected=[];
  const start=G._nestRewardDropIndex||0;
  const tray=document.getElementById('nest-reward-tray');
  const scene=document.getElementById('nest-reward-scene');
  let index=start;

  if(start===0 && drops.length){
    preSizeNestRewardTray(drops.length);
    if(scene) scene.classList.add('is-compact');
  }

  function finishRevealSequence(){
    G._nestRewardDropIndex=drops.length;
    const pickPool=G._storyEquipmentPickPool || G._equipmentPickPool;
    if(Array.isArray(pickPool) && pickPool.length){
      setTimeout(()=>showStoryEquipmentPick(pickPool), 240);
      return;
    }
    finishNestRewardReveal();
  }

  function revealNext(){
    if(index>=drops.length){
      finishRevealSequence();
      return;
    }
    const drop=drops[index];
    const dropIndex=index;
    index++;
    G._nestRewardDropIndex=index;

    const tierCss=normalizeRewardTier(drop.tier||'white');
    const isHighTier=tierCss==='gold'||tierCss==='orange'||tierCss==='purple';
    const stagger=rewardFlipStaggerMs(drop, isHighTier);

    if(tray){
      const wrap=document.createElement('div');
      wrap.innerHTML=buildRewardFlipCardHtml(drop, {dropIndex, revealed:false, compact:true});
      const card=wrap.firstElementChild;
      if(card){
        tray.appendChild(card);
        if(isHighTier) spawnNestShakeSparks(scene, document.getElementById('reward-nest'), 1);
        requestAnimationFrame(()=>{
          revealRewardFlipCard(card);
          if(typeof grantNestDrop==='function') grantNestDrop(drop);
          G._nestRewardsCollected.push(drop);
          wireNestRewardTrayTooltips(tray);
        });
      }
    }else{
      if(typeof grantNestDrop==='function') grantNestDrop(drop);
      G._nestRewardsCollected.push(drop);
    }

    setTimeout(revealNext, rewardFlipRevealDelayMs()+stagger);
  }

  revealNext();
}

function revealAllNestDrops(){
  revealNestDropsStaggered();
}

function showStoryEquipmentPick(pool){
  const offers=Array.isArray(pool)?pool.filter(Boolean):[];
  if(!offers.length){
    finishNestRewardReveal();
    return;
  }
  G._rewardScreenMode='story-equipment-pick';
  G._pendingReward=null;
  G._rewardsAlreadyGranted=false;
  G._nestShaken=true;

  const nest=document.getElementById('reward-nest');
  if(nest){
    nest.classList.remove('nest-shakeable');
    nest.onclick=null;
  }
  const scene=document.getElementById('nest-reward-scene');
  if(scene) scene.classList.add('is-compact');
  const hint=document.getElementById('nest-shake-hint');
  if(hint) hint.textContent='Choose 1 equipment';
  const footnote=document.getElementById('nest-reward-footnote');
  if(footnote) footnote.style.display='none';
  document.getElementById('reward-sub').textContent=G._forgeEquipmentChoicePending
    ?'Pick one piece of equipment for clearing this stage.'
    :'Pick one piece of equipment from the nest.';

  const confirmBtn=document.getElementById('reward-confirm-btn');
  confirmBtn.textContent='✓ Take This Equipment';
  confirmBtn.className='confirm-btn';

  const grid=document.getElementById('reward-grid');
  if(!grid) return;
  grid.style.display='';
  grid.setAttribute('aria-hidden','false');
  grid.innerHTML='';
  offers.forEach((rw, idx)=>{
    const wrap=document.createElement('div');
    wrap.innerHTML=buildRewardFlipCardHtml(rw, {
      dropIndex:idx,
      revealed:false,
      selectable:true,
      equipmentPick:true,
      compact:false,
    });
    const card=wrap.firstElementChild;
    if(!card) return;
    const selectCard=()=>{
      const flip=card.querySelector('.mother-goose-hatch-flip');
      if(!flip?.classList.contains('is-flipped')) return;
      document.querySelectorAll('#reward-grid .mother-goose-hatch-flip').forEach(x=>x.classList.remove('selected'));
      flip.classList.add('selected');
      G._pendingReward=rw;
      confirmBtn.className='confirm-btn visible';
    };
    card.onclick=selectCard;
    grid.appendChild(card);
    setTimeout(()=>{
      revealRewardFlipCard(card);
      if(typeof bindRichTooltip==='function'){
        const back=card.querySelector('.reward-reveal-card');
        const eqId=rw.equipmentItemId||rw.id;
        if(back && eqId) bindRichTooltip(back, ()=>buildEquipmentTooltipHTML(eqId), {category:'items'});
      }
    }, 80+idx*120);
  });
}

function showForgeEquipmentChoiceReward(pool){
  G._forgeEquipmentChoicePending=true;
  showScreen('screen-reward');
  document.getElementById('reward-title').textContent='✦ Stage Cleared! ✦';
  const nest=document.getElementById('reward-nest');
  if(nest) nest.style.display='none';
  const scene=document.getElementById('nest-reward-scene');
  if(scene) scene.classList.add('forge-equipment-choice');
  showStoryEquipmentPick(pool);
}
globalThis.showForgeEquipmentChoiceReward=showForgeEquipmentChoiceReward;

function handleNestShake(){
  const nest=document.getElementById('reward-nest');
  const scene=document.getElementById('nest-reward-scene');
  if(!nest||!nest.classList.contains('nest-shakeable')||G._nestShakeStarted) return;
  G._nestShakeStarted=true;
  nest.classList.remove('nest-shakeable');
  nest.onclick=null;
  void nest.offsetWidth;
  const dropCount=(G._nestRewardDrops||[]).length;
  const hasHighTier=(G._nestRewardDrops||[]).some(d=>{
    const t=normalizeRewardTier(d.tier||'grey');
    return t==='gold'||t==='orange'||t==='purple';
  });
  if(dropCount>1 || hasHighTier) nest.classList.add('nest-shake-intense');
  nest.classList.add('nest-shaking');
  if(scene) scene.classList.add('is-shaking');
  spawnNestShakeSparks(scene, nest, dropCount);
  const hint=document.getElementById('nest-shake-hint');
  if(hint) hint.textContent='Revealing rewards…';
  setTimeout(()=>{
    nest.classList.remove('nest-shaking','nest-shake-intense');
    if(scene) scene.classList.remove('is-shaking');
    revealNestDropsStaggered();
  },550);
}

function showRewardScreen(hasLevelUp) {
  if (!G.endlessMode) Avian.storyRun?.winEncounter(!!G.enemy?.isBoss);
  G.animLock=false;
  if(typeof lockActionUI==='function') lockActionUI(false);
  showScreen('screen-reward');
  G._rewardScreenMode='nest';
  G._pendingLevelUp=hasLevelUp;
  G._pendingReward=null;
  G._pendingRewardQueue=null;
  G._pendingEndlessMutationPick=null;
  G._storyEquipmentPickPool=null;
  G._equipmentPickPool=null;
  G._rewardsAlreadyGranted=false;
  G._nestRewardDropIndex=0;
  G._nestRewardsCollected=[];
  G._nestShaken=false;
  G._nestShakeStarted=false;
  const dropLayer=document.getElementById('nest-drop-layer');
  if(dropLayer){ dropLayer.innerHTML=''; dropLayer.setAttribute('aria-hidden','true'); }
  const shakeFx=document.getElementById('nest-shake-fx');
  if(shakeFx) shakeFx.innerHTML='';

  const defeated=typeof getDefeatedBirdsForReward==='function'?getDefeatedBirdsForReward():[];
  const isBoss=defeated.some(b=>b.isBoss)||!!G.enemy?.isBoss;
  const endlessActive=!!G.endlessMode || (typeof isEndlessRunActive==='function' && isEndlessRunActive());
  const drops=endlessActive&&typeof buildEndlessClearRewardDrops==='function'
    ? buildEndlessClearRewardDrops(defeated,{difficulty:G.difficulty,stage:getEncounterStage(),isBoss})
    :(typeof buildNestRewardDrops==='function'
      ? buildNestRewardDrops(defeated,{difficulty:G.difficulty,stage:getEncounterStage(),isBoss,storyMode:!endlessActive})
      : []);

  if(!G._owForgeReturnToForge){
    const nestDrop=typeof buildRescuedNestDrop==='function'?buildRescuedNestDrop(defeated):null;
    if(nestDrop) drops.push(nestDrop);
  }

  G._nestRewardDrops=drops;
  G._defeatedEncounterBirds=[];

  let equipmentPickPool=[];
  if(typeof buildMutationRewardPool==='function'){
    equipmentPickPool=buildMutationRewardPool();
  }
  G._storyEquipmentPickPool=equipmentPickPool;
  G._equipmentPickPool=equipmentPickPool;

  const grid=document.getElementById('reward-grid');
  if(grid){
    grid.innerHTML='';
    grid.style.display='none';
    grid.setAttribute('aria-hidden','true');
  }

  document.getElementById('reward-title').textContent=isBoss?'👑 Boss Defeated!':'✦ Victory! ✦';
  const dropCount=drops.length;
  const pickCount=equipmentPickPool.length;
  if(pickCount>0){
    document.getElementById('reward-sub').textContent=dropCount
      ?`Tap the nest — then choose 1 of ${pickCount} equipment offers!`
      :`Tap the nest — choose 1 of ${pickCount} equipment offers!`;
  }else{
    document.getElementById('reward-sub').textContent=dropCount>1
      ?`Tap the nest once — ${dropCount} rewards will flip out!`
      :(dropCount===1?'Tap the nest once for your reward!':'No nest rewards — continue onward.');
  }

  const footnote=document.getElementById('nest-reward-footnote');
  if(footnote) footnote.style.display='none';
  const tray=document.getElementById('nest-reward-tray');
  if(tray){
    tray.innerHTML='';
    tray.classList.remove('is-pre-sized');
    tray.style.removeProperty('--tray-rows');
  }
  const scene=document.getElementById('nest-reward-scene');
  if(scene) scene.classList.remove('is-compact');
  renderNestRewardCollectedTray();
  renderBattleSummary();

  const nest=document.getElementById('reward-nest');
  const confirmBtn=document.getElementById('reward-confirm-btn');
  confirmBtn.textContent='Continue →';
  confirmBtn.className='confirm-btn';

  if(!dropCount && !pickCount){
    const hint=document.getElementById('nest-shake-hint');
    if(hint) hint.textContent='No rewards this time.';
    if(nest) nest.classList.remove('nest-shakeable');
    confirmBtn.className='confirm-btn visible';
    G._rewardsAlreadyGranted=true;
    return;
  }

  if(nest){
    nest.classList.add('nest-shakeable');
    nest.onclick=handleNestShake;
  }
  const hint=document.getElementById('nest-shake-hint');
  if(hint) hint.textContent='Tap the nest to shake';
}

function confirmReward() {
  if(G._rewardScreenMode==='class-perk'){
    if(!G._pendingReward) return;
    const source=String(G._pendingClassPerkChoice?.source||'');
    const perkDef=G._pendingReward;
    const birdKey=G.player?.birdKey;
    G._pendingReward=null;
    G._rewardScreenMode='normal';
    G._pendingClassPerkChoice=null;
    document.getElementById('reward-confirm-btn').className='confirm-btn';
    document.getElementById('reward-confirm-btn').textContent='✓ Take This Reward';
    if(grantClassPerk(birdKey, perkDef, source)){
      continueStageTransitionAfterRewards();
    }else{
      continueStageTransitionAfterRewards();
    }
    return;
  }
  if(document.getElementById('gold-replace-ui')) return;

  if(G._rewardScreenMode==='nest' && !G._rewardsAlreadyGranted && !G._nestShaken){
    logMsg('Shake the nest to collect your rewards first.','miss');
    return;
  }

  if(G._rewardScreenMode==='story-equipment-pick'){
    if(!G._pendingReward){
      logMsg('Choose an equipment first.','miss');
      return;
    }
    const rw=G._pendingReward;
    if(rw.tier==='gold'&&getGoldCardCount()>=getGoldCardLimit()&&!G._goldReplaceMode){
      showGoldReplaceUI(rw);
      return;
    }
    applySingleReward(rw);
    G._pendingReward=null;
    G._storyEquipmentPickPool=null;
    G._equipmentPickPool=null;
    if(G._forgeEquipmentChoicePending){
      G._forgeEquipmentChoicePending=false;
      G._rewardScreenMode='normal';
      G._rewardsAlreadyGranted=true;
      const grid=document.getElementById('reward-grid');
      if(grid){
        grid.style.display='none';
        grid.setAttribute('aria-hidden','true');
      }
      const nest=document.getElementById('reward-nest');
      if(nest) nest.style.display='';
      const scene=document.getElementById('nest-reward-scene');
      if(scene) scene.classList.remove('forge-equipment-choice');
      saveRun();
      if(G._owForgeReturnToForge){
        G._owForgeReturnToForge=false;
        G._owForgeNavMeta=null;
        G._owForgeEncounter=null;
        G._owForgePowerTier=0;
        clearOverworldPendingBattle();
        if(typeof showScreen==='function') showScreen('screen-map-forge');
        if(typeof globalThis.openMapForge==='function') globalThis.openMapForge({ skipReload:true });
        return;
      }
    }
    G._rewardScreenMode='nest';
    G._rewardsAlreadyGranted=true;
    const grid=document.getElementById('reward-grid');
    if(grid){
      grid.style.display='none';
      grid.setAttribute('aria-hidden','true');
    }
    const footnote=document.getElementById('nest-reward-footnote');
    if(footnote) footnote.style.display='block';
    document.getElementById('reward-confirm-btn').textContent='Continue →';
    document.getElementById('reward-confirm-btn').className='confirm-btn visible';
    return;
  }

  if(G._rewardScreenMode==='endless-mutation-pick'){
    if(!G._pendingReward){
      logMsg('Choose a mutation first.','miss');
      return;
    }
    const rw=G._pendingReward;
    if(rw.tier==='gold'&&getGoldCardCount()>=getGoldCardLimit()&&!G._goldReplaceMode){
      showGoldReplaceUI(rw);
      return;
    }
    applySingleReward(rw);
    G._pendingReward=null;
    G._pendingEndlessMutationPick=null;
    G._rewardScreenMode='normal';
    G._rewardsAlreadyGranted=true;
    document.getElementById('reward-confirm-btn').textContent='Continue →';
    document.getElementById('reward-confirm-btn').className='confirm-btn visible';
    return;
  }

  if (G._rewardsAlreadyGranted) {
    finishRewardScreenFlow();
    return;
  }

  if(!G._pendingReward) return;

  if(G._pendingReward.tier==='gold'&&getGoldCardCount()>=getGoldCardLimit()&&!G._goldReplaceMode){
    showGoldReplaceUI(G._pendingReward);
    return;
  }

  applySingleReward(G._pendingReward);
  G._pendingReward=null;

  if (G._pendingRewardQueue?.length) {
    if (!drainPendingRewardQueue()) return;
  }

  G._goldReplaceMode = false;
  G._rewardsAlreadyGranted = true;
  document.getElementById('reward-confirm-btn').textContent = 'Continue →';
  document.getElementById('reward-confirm-btn').className = 'confirm-btn visible';
}

function applyUpgradeWithMaxHpHealing(player, applyFn, sourceLabel='Upgrade', meta=null){
  if(!player || typeof applyFn!=='function') return;
  const beforeStatsSnap = player.stats ? {...player.stats} : {};
  const beforeMax=Math.max(1, Number(player.stats?.maxHp||1));
  const beforeHp=Math.max(0, Number(player.stats?.hp||0));
  applyFn();
  if(player.stats) normalizeCombatStats(player.stats);
  if(player.stats) recordUpgradeApplyInLedger(player, beforeStatsSnap, player.stats, meta);
  const afterMax=Math.max(1, Number(player.stats?.maxHp||beforeMax));
  const gained=Math.max(0, afterMax-beforeMax);
  if(gained<=0) return;
  const minExpectedHeal=Math.floor(gained*0.5);
  const actualHeal=Math.max(0, Number(player.stats?.hp||0)-beforeHp);
  const missing=Math.max(0, minExpectedHeal-actualHeal);
  if(missing>0){
    player.stats.hp=Math.min(afterMax,(player.stats.hp||0)+missing);
    spawnFloat('player',`+${missing} 🩹`,'fn-heal');
  }
}

function showGoldReplaceUI(newReward){
  const existing=document.getElementById('gold-replace-ui');if(existing)existing.remove();
  const goldCards=(G.collectedRewards||[]).filter(r=>r.tier==='gold');
  const ui=document.createElement('div');
  ui.id='gold-replace-ui';
  ui.style.cssText='background:rgba(20,15,5,.97);border:1px solid var(--gold);border-radius:12px;padding:16px;margin-top:12px;text-align:center;';
  const cap=getGoldCardLimit();
  ui.innerHTML=`<div style="font-family:Cinzel,serif;color:var(--gold);margin-bottom:8px;font-size:.85rem;letter-spacing:.08em">⚠ LEGENDARY LIMIT — Replace a Gold Card</div>
    <div style="color:var(--text-dim);font-size:.78rem;margin-bottom:12px">You hold ${cap} Legendary cards. Choose one to replace with <strong style="color:var(--gold)">${newReward.name}</strong>:</div>
    <div id="gold-replace-list" style="display:flex;flex-direction:column;gap:6px;"></div>
    <button onclick="document.getElementById('gold-replace-ui').remove();G._goldReplaceMode=false;" style="margin-top:10px;background:rgba(40,35,25,.8);border:1px solid var(--border);color:var(--text-dim);padding:5px 14px;border-radius:6px;cursor:pointer;font-size:.8rem;">✕ Cancel</button>`;
  const list=ui.querySelector('#gold-replace-list');
  goldCards.forEach(gc=>{
    const btn=document.createElement('button');
    btn.style.cssText='background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.4);border-radius:8px;padding:8px 12px;cursor:pointer;color:var(--gold);width:100%;text-align:left;font-size:.82rem;display:flex;align-items:center;gap:8px;';
    btn.innerHTML=`<span style="font-size:1.1rem">${gc.icon}</span><span><strong>${gc.name}</strong><br><span style="color:var(--text-dim);font-size:.75rem">${gc.desc}</span></span>`;
    btn.onclick=()=>{
      const idx=(G.collectedRewards||[]).findIndex(r=>r.name===gc.name&&r.tier==='gold');
      if(idx>=0) G.collectedRewards.splice(idx,1);
      G._goldReplaceMode=true;
      document.getElementById('gold-replace-ui').remove();
      confirmReward();
    };
    list.appendChild(btn);
  });
  const rewardInner=document.querySelector('.reward-screen-inner');
  if(rewardInner) rewardInner.appendChild(ui);
}

function generateNormalRewards() {
  return buildMutationRewardPool();
}

function generateBossRewards() {
  return buildMutationRewardPool();
}

function rollWeighted(tiers,weights){
  const total=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<tiers.length;i++){r-=weights[i];if(r<=0)return tiers[i];}
  return tiers[tiers.length-1];
}

// Gold card limit: max 3, prompt replacement if at limit
function getGoldCardCount(){return(G.collectedRewards||[]).filter(r=>r.tier==='gold').length;}
function getGoldCardLimit(){
  if((G.ui?.gameMode||'story')==='story' && (G.stage||1)<20) return 1;
  return 3;
}
globalThis.showRewardScreen = showRewardScreen;
globalThis.confirmReward = confirmReward;
globalThis.applySingleReward = applySingleReward;
globalThis.handleNestShake = handleNestShake;
