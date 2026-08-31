/* Avian Ascent — combat HUD refresh orchestration (Step 7 Phase 3). */
function getAvatar(who)     { return document.getElementById(`${who}-avatar`); }
function getAvatarWrap(who) { return document.getElementById(`${who}-avatar-wrap`); }
function getPanel(who)      { return document.getElementById(`${who}-panel`); }

function refreshBattleUI() {
  const p = G.player.stats;
  document.getElementById('player-name').textContent = G.player.name;
  document.getElementById('player-avatar').innerHTML = renderEntityAvatarHTML(G.player, 'battle');
  setHpBar('player', p.hp, p.maxHp);
  setEnergyBar('player', G.player.energy, G.player.energyMax);
  setProtectionBars('player');
  const pclsEl=document.getElementById('player-class-label');
  if(pclsEl){
    const pcls=idToClassLabel(resolveFinalClass(G.player.class||BIRDS[G.player.birdKey]?.class||'striker',G.player.birdKey));
    pclsEl.textContent=`${pcls}`;
  }

  document.getElementById('enemy-name').innerHTML = G.enemy.name + (G.enemy.isBoss?`<span class="boss-crown">👑</span>`:'');
  const ep = getPanel('enemy');
  ep.className = 'combatant-panel enemy' + (G.enemy.isBoss?' boss-panel':'');
  const en = document.getElementById('enemy-name');
  en.className = 'combatant-name' + (G.enemy.isBoss?' boss-name':'');
  const enemyAvatarEl=document.getElementById('enemy-avatar');
  if(enemyAvatarEl){
    if(G.enemy.birdKey&&BIRDS[G.enemy.birdKey]){
      const enemyBird = Object.assign({}, BIRDS[G.enemy.birdKey], G.enemy, { portraitKey: G.enemy.portraitKey || BIRDS[G.enemy.birdKey].portraitKey });
      enemyAvatarEl.innerHTML = renderEntityAvatarHTML(enemyBird, 'battle', false, true);
      enemyAvatarEl.style.fontSize='';
    }else if(G.enemy.portraitKey){
      enemyAvatarEl.innerHTML = renderEntityAvatarHTML(G.enemy, 'battle', false, true);
      enemyAvatarEl.style.fontSize='';
    }else{
      enemyAvatarEl.textContent = G.enemy.emoji;
      enemyAvatarEl.style.fontSize='3.8rem';
    }
    ensureBattleEnemyFacing(enemyAvatarEl);
  }
  setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
  setEnergyBar('enemy', G.enemy.energy, G.enemy.energyMax||3);
  setProtectionBars('enemy');
  const eclsEl=document.getElementById('enemy-class-label');
  if(eclsEl){
    const ecls=idToClassLabel(resolveFinalClass(G.enemy.class||inferEnemyClassFromStyle(G.enemy)||'predator',G.enemy.birdKey||''));
    eclsEl.textContent = `${G.enemy.isBoss?'Boss · ':''}${ecls}`;
  }

  document.getElementById('level-label').textContent = (() => {
    const stageNum = getEncounterStage();
    if (G.endlessMode && stageNum > 20) return `ENDLESS ${G.endlessBattle}`;
    const title = typeof globalThis.getStoryStageNodeTitle === 'function'
      ? globalThis.getStoryStageNodeTitle(stageNum)
      : '';
    return title ? `STAGE ${stageNum} · ${title}` : `STAGE ${stageNum}`;
  })();
  document.getElementById('bird-lv-label').textContent = `Lv.${G.player.birdLevel}`;
  const shinyEl=document.getElementById('battle-shiny-count'); if(shinyEl) shinyEl.textContent=String(G.shinyObjects||0);

  // EXP bar (combat copy removed — EXP now lives in the Nest)
  const _expBar=document.getElementById('exp-bar');
  if(_expBar){
    const needed = expForLevel(G.player.birdLevel+1);
    const pct = Math.min(G.player.exp/needed*100,100);
    _expBar.style.width = pct+'%';
    const _expTxt=document.getElementById('exp-txt');
    if(_expTxt) _expTxt.textContent = `${G.player.exp} / ${needed}`;
  }

  // Stats rendered in combat stats modal (Stats & Details button)
  wireCombatClassLabelTooltips();
  refreshCombatStatsModalIfOpen();

  const eal=document.getElementById('enemy-abilities-list');
  wireEnemyMutationTooltips();
  wirePlayerAvatarInteractionOnce();
  if(eal){
    eal.innerHTML='';
    (G.enemy.abilities||[]).forEach(entry=>{
      if(typeof entry==='string'){
        const eab=ENEMY_ABILITY_POOL[entry];
        if(!eab) return;
        const t=document.createElement('span');t.className='enemy-ab-tag';t.textContent=eab.name;
        bindRichTooltip(t, () => buildEnemyAbilityTooltipHtml(entry, G.enemy.stats) + richTooltipCloseBtn(), { category: 'abilities' });
        eal.appendChild(t);
        return;
      }
      if(!entry||typeof entry!=='object'||!entry.id) return;
      const tmpl=getAbilityTemplateForUI(entry);
      const t=document.createElement('span');t.className='enemy-ab-tag';t.textContent=tmpl?.name||entry.name||entry.id;
      const ctx={level:entry.level,storyLevel:G.enemy.storyLevel};
      bindRichTooltip(t, () => buildEnemyAbilityTooltipHtml(entry.id, G.enemy.stats, ctx) + richTooltipCloseBtn(), { category: 'abilities' });
      eal.appendChild(t);
    });
  }

  renderStatuses('player-status', G.playerStatus);
  renderStatuses('enemy-status', G.enemyStatus);
  renderPassiveBadge();
  // Boss rage indicator
  const enp=document.getElementById('enemy-panel');
  if(G.enemy.isBoss&&G.enemyRageActive){
    if(!document.getElementById('boss-rage-bar')){
      const rb=document.createElement('div');rb.id='boss-rage-bar';rb.className='boss-rage-bar';
      enp.insertBefore(rb,enp.firstChild);
    }
    if(!document.getElementById('boss-rage-badge')){
      const badgeEl=document.getElementById('enemy-name');
      const rb2=document.createElement('span');rb2.id='boss-rage-badge';rb2.className='rage-badge';rb2.style.marginLeft='8px';rb2.textContent='RAGE';
      badgeEl.appendChild(rb2);
    }
  }

  const pArm=(G.player?.stats?.armour||0)+(G.player?.stats?.magicArmour||0);
  const eArm=(G.enemy?.stats?.armour||0)+(G.enemy?.stats?.magicArmour||0);
  document.getElementById('player-shield-overlay').className='shield-overlay'+((G.playerStatus?.defending>0||getGuardedPhysReducPct(G.playerStatus)>0||pArm>0||(G.playerStatus?.fortify)||(G.playerStatus?.ward))?' active':'');
  document.getElementById('enemy-shield-overlay').className='shield-overlay'+(G.enemyStatus.defending>0||getGuardedPhysReducPct(G.enemyStatus)>0||eArm>0||(G.enemyStatus?.fortify)||(G.enemyStatus?.ward)?' active':'');

  renderEnemyPlan();
  applyUIStateToDOM();
  renderActions();
  wireEnemyInfoPopupOnce();
}

function renderEnergyOrbs(){
  const el=document.getElementById('energy-orbs');
  if(!el||!G?.player) return;
  el.innerHTML='';

  const total = Math.max(0, G.player.energyMax||0);
  const cur = Math.max(0, Math.min(total, G.player.energy||0));
  const bonus = Math.max(0, G.player.energyBonus||0);
  const base = Math.max(0, total - bonus);
  const gainedNow = Math.max(0, G.player._newBonusEnergyFlash||0);
  const p = G.player;

  el.classList.add('energy-summary');
  el.title = `Energy ${cur}/${total} — ${base} base max + ${bonus} bonus max (from upgrades). Blue orbs: base pool. Green: bonus pool.`;

  for(let i=0;i<total;i++){
    const orb=document.createElement('span');
    const isBonus = i>=base;
    const bonusIdx = isBonus ? (i-base) : -1;
    const isSpent = i>=cur;
    const slotLabel = isBonus
      ? `Bonus max energy (upgrade) — slot ${bonusIdx+1} of ${bonus}. ${isSpent ? 'Empty this turn.' : 'Available.'}`
      : `Base max energy — slot ${i+1} of ${base}. ${isSpent ? 'Empty this turn.' : 'Available.'}`;
    orb.className='energy-orb'
      +(isBonus?' bonus':'')
      +((isBonus && bonusIdx >= Math.max(0, bonus-gainedNow))?' new-bonus':'')
      +(isSpent?' spent':'');
    orb.setAttribute('role','img');
    orb.tabIndex = 0;
    orb.title = slotLabel;
    orb.addEventListener('click', function(ev){
      ev.preventDefault();
      if(typeof logMsg === 'function') logMsg(slotLabel, 'system');
    });
    el.appendChild(orb);
  }

  const showFreeRow = (G.phase==='PLAYER' || G.phase==='ENEMY');
  if(showFreeRow && (p.firstAttackFree || p.firstSpellFree)){
    const sep = document.createElement('span');
    sep.className = 'energy-free-sep';
    sep.setAttribute('aria-hidden','true');
    el.appendChild(sep);
    if(p.firstAttackFree){
      const atkFree = !G._firstAttackUsed;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'energy-free-chip'+(atkFree?' is-ready':' is-spent');
      chip.title = atkFree
        ? 'First Attack Free — Your first Attack or Ranged ability this battle costs 0 EN (upgrade: e.g. War Rhythm).'
        : 'First Attack Free — Already used this battle.';
      chip.setAttribute('aria-label', chip.title);
      chip.addEventListener('click', (ev)=>{
        ev.preventDefault();
        if(typeof logMsg === 'function') logMsg(chip.title, 'system');
      });
      el.appendChild(chip);
    }
    if(p.firstSpellFree){
      const spFree = !G._firstSpellUsed;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'energy-free-chip'+(spFree?' is-ready':' is-spent');
      chip.title = spFree
        ? 'First Spell Free — Your first Spell this battle costs 0 EN (upgrade: e.g. Spell Rhythm, Battle Meditation).'
        : 'First Spell Free — Already used this battle.';
      chip.setAttribute('aria-label', chip.title);
      chip.addEventListener('click', (ev)=>{
        ev.preventDefault();
        if(typeof logMsg === 'function') logMsg(chip.title, 'system');
      });
      el.appendChild(chip);
    }
  }

  if(gainedNow>0){
    clearTimeout(G.player._bonusEnergyFlashTimer);
    G.player._bonusEnergyFlashTimer = setTimeout(()=>{
      if(G?.player){
        G.player._newBonusEnergyFlash = 0;
        renderEnergyOrbs();
      }
    }, 2600);
  }

  const txt=document.getElementById('energy-text');
  if(txt) txt.textContent=`Energy ${cur}/${total}`;
}

function renderAllCombatUI(){
  if(!G.player || !G.enemy) return;
  renderEnergyOrbs();
  renderEnemyPlan();
  renderEnergyOrbs();
  renderEnemyPlan();
  renderActions();
  renderStatuses('player-status', G.playerStatus);
  renderStatuses('enemy-status', G.enemyStatus);
  setHpBar('player', G.player.stats.hp, G.player.stats.maxHp);
  setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
}

globalThis.refreshBattleUI = refreshBattleUI;
globalThis.renderAllCombatUI = renderAllCombatUI;
globalThis.renderEnergyOrbs = renderEnergyOrbs;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatHud = { refreshBattleUI, renderAllCombatUI, renderEnergyOrbs };
