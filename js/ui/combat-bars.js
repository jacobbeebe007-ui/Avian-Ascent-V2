/* Avian Ascent — combat HP/EN/protection bars (Step 7 Phase 3). */
function setHpBar(who,hp,max) {
  const maxHp=Math.max(1, Number(max)||1);
  const pct=Math.max(0,hp/maxHp*100);
  const bar=document.getElementById(`${who}-hp-bar`);
  if(!bar) return;
  bar.style.width=pct+'%';
  bar.className='hp-bar-fill'+(pct<25?' low':pct<50?' mid':'');

  const key=`${who}Hp`;
  G._uiLastHp = G._uiLastHp || {};
  const prevHp = Number.isFinite(G._uiLastHp[key]) ? G._uiLastHp[key] : hp;
  const delta = hp - prevHp;
  G._uiLastHp[key] = hp;

  const hpTextEl=document.getElementById(`${who}-hp-text`);
  if(hpTextEl){
    hpTextEl.textContent=`${formatCombatNumber(Math.max(0,hp))}/${formatCombatNumber(maxHp)}`;
    hpTextEl.classList.remove('hp-delta-up','hp-delta-down');
    if(delta<0){ hpTextEl.classList.add('hp-delta-down'); }
    else if(delta>0){ hpTextEl.classList.add('hp-delta-up'); }
  }

  bar.classList.remove('recent-hit','recent-heal');
  if(delta<0) bar.classList.add('recent-hit');
  else if(delta>0) bar.classList.add('recent-heal');

  if(who==='player') {
    const panel=document.getElementById('player-panel');
    if(pct<25) panel.classList.add('player-danger');
    else panel.classList.remove('player-danger');
  }

  if(who==='enemy'&&G.enemy&&G.enemy.isBoss) {
    const ep=document.getElementById('enemy-panel');
    const banner=document.getElementById('boss-phase-banner');
    if(pct<50&&pct>0) {
      ep.classList.add('boss-phase-two');
      if(banner){banner.textContent='⚡ ENRAGED — PHASE TWO ⚡';banner.classList.add('visible');}
    } else {
      ep.classList.remove('boss-phase-two');
      if(banner){banner.textContent='';banner.classList.remove('visible');}
    }
  }
  setProtectionBars(who);
}

function setEnergyBar(side,cur,max){
  const fill=document.getElementById(`${side}-en-bar`);
  const txt=document.getElementById(`${side}-en-text`);
  const c=Math.max(0, Number(cur)||0);
  const m=Math.max(1, Number(max)||1);
  if(fill) fill.style.width = `${Math.max(0,Math.min(100,(c/m)*100))}%`;
  if(txt) txt.textContent = `${c}/${m}`;
}

function setProtectionBars(side){
  const stats=side==='player'?G?.player?.stats:G?.enemy?.stats;
  const status=side==='player'?G?.playerStatus:G?.enemyStatus;
  const arm=Math.max(0, Number(stats?.armour)||0);
  const armNormal=Math.max(0, Number(stats?.normalMaxArmour)!=null?stats.normalMaxArmour:(stats?.armourFlat||0));
  const armMax=Math.max(0, Number(stats?.maxArmour)!=null?stats.maxArmour:armNormal);
  const marm=Math.max(0, Number(stats?.magicArmour)||0);
  const marmNormal=Math.max(0, Number(stats?.normalMaxMagicArmour)!=null?stats.normalMaxMagicArmour:(stats?.magicArmourFlat||0));
  const marmMax=Math.max(0, Number(stats?.maxMagicArmour)!=null?stats.maxMagicArmour:marmNormal);
  const fortifyBonus=Math.max(0, Number(stats?._fortifyBonus)||Number(status?.fortify?.amount)||0);
  const wardBonus=Math.max(0, Number(stats?._wardBonus)||Number(status?.ward?.amount)||0);
  const fortifyTurns=Math.max(0, Math.floor(Number(status?.fortify?.turns)||0));
  const wardTurns=Math.max(0, Math.floor(Number(status?.ward?.turns)||0));
  const armFill=document.getElementById(`${side}-arm-bar`);
  const armTxt=document.getElementById(`${side}-arm-text`);
  const armTemp=document.getElementById(`${side}-arm-temp`);
  const marmFill=document.getElementById(`${side}-marm-bar`);
  const marmTxt=document.getElementById(`${side}-marm-text`);
  const marmTemp=document.getElementById(`${side}-marm-temp`);
  const armDenom=Math.max(1, armMax);
  const marmDenom=Math.max(1, marmMax);
  const armPct=Math.max(0, Math.min(100, (arm/armDenom)*100));
  const marmPct=Math.max(0, Math.min(100, (marm/marmDenom)*100));

  G._uiLastArm = G._uiLastArm || {};
  G._uiLastMarm = G._uiLastMarm || {};
  const armKey=`${side}Arm`;
  const marmKey=`${side}Marm`;
  const prevArm=Number.isFinite(G._uiLastArm[armKey]) ? G._uiLastArm[armKey] : arm;
  const prevMarm=Number.isFinite(G._uiLastMarm[marmKey]) ? G._uiLastMarm[marmKey] : marm;
  const armDelta=arm - prevArm;
  const marmDelta=marm - prevMarm;
  G._uiLastArm[armKey]=arm;
  G._uiLastMarm[marmKey]=marm;

  if(armFill){
    armFill.style.width=`${armPct}%`;
    armFill.classList.remove('recent-hit','recent-heal');
    if(armDelta<0) armFill.classList.add('recent-hit');
    else if(armDelta>0) armFill.classList.add('recent-heal');
  }
  if(armTemp){
    const overflow=Math.max(0, Math.min(arm, armMax) - armNormal);
    const leftPct=Math.max(0, Math.min(100, (armNormal/armDenom)*100));
    const widthPct=Math.max(0, Math.min(100-leftPct, (overflow/armDenom)*100));
    armTemp.style.left=`${leftPct}%`;
    armTemp.style.width=`${widthPct}%`;
    armTemp.classList.toggle('active', overflow>0 || fortifyBonus>0);
  }
  if(armTxt){
    let note='';
    if(fortifyBonus>0){
      note=` · Fortify +${formatCombatNumber(fortifyBonus)}${fortifyTurns>0?` (${fortifyTurns}t)`:''}`;
    }
    armTxt.textContent=`${formatCombatNumber(arm)}/${formatCombatNumber(armMax)}${note}`;
    armTxt.classList.remove('hp-delta-up','hp-delta-down');
    if(armDelta<0) armTxt.classList.add('hp-delta-down');
    else if(armDelta>0) armTxt.classList.add('hp-delta-up');
  }
  if(marmFill){
    marmFill.style.width=`${marmPct}%`;
    marmFill.classList.remove('recent-hit','recent-heal');
    if(marmDelta<0) marmFill.classList.add('recent-hit');
    else if(marmDelta>0) marmFill.classList.add('recent-heal');
  }
  if(marmTemp){
    const overflow=Math.max(0, Math.min(marm, marmMax) - marmNormal);
    const leftPct=Math.max(0, Math.min(100, (marmNormal/marmDenom)*100));
    const widthPct=Math.max(0, Math.min(100-leftPct, (overflow/marmDenom)*100));
    marmTemp.style.left=`${leftPct}%`;
    marmTemp.style.width=`${widthPct}%`;
    marmTemp.classList.toggle('active', overflow>0 || wardBonus>0);
  }
  if(marmTxt){
    let note='';
    if(wardBonus>0){
      note=` · Ward +${formatCombatNumber(wardBonus)}${wardTurns>0?` (${wardTurns}t)`:''}`;
    }
    marmTxt.textContent=`${formatCombatNumber(marm)}/${formatCombatNumber(marmMax)}${note}`;
    marmTxt.classList.remove('hp-delta-up','hp-delta-down');
    if(marmDelta<0) marmTxt.classList.add('hp-delta-down');
    else if(marmDelta>0) marmTxt.classList.add('hp-delta-up');
  }
}

globalThis.setHpBar = setHpBar;
globalThis.setEnergyBar = setEnergyBar;
globalThis.setProtectionBars = setProtectionBars;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatBars = { setHpBar, setEnergyBar, setProtectionBars };
