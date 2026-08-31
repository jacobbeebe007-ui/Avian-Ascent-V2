/* Avian Ascent — combat Stats & Details modal (Step 7 Phase 3). */
function buildPlayerCombatStatHint(){
  const s=G.playerStatus||{};
  const parts=[];
  if(getWeakenStacks(s)>0){
    const st=getWeakenStacks(s);
    const turns=typeof s.weaken==='number'?s.weaken:(s.weaken?.turns||0);
    parts.push(`Weaken ×${st} (${turns}t, −${Math.round((1-getWeakenDamageMult(st))*100)}% dmg, −${getWeakenDodgePenalty(st)} dodge)`);
  }
  if((s.feared||0)>0) parts.push(`Fear ${s.feared}t (−12% dmg)`);
  if(s.humDodge?.bonus) parts.push(`Dodge buff +${s.humDodge.bonus}% (${s.humDodge.turns||0}t)`);
  if(s.peregrineCritLens?.bonus) parts.push(`Crit lens +${s.peregrineCritLens.bonus}% (${s.peregrineCritLens.turns||0}t)`);
  if(Number(s.huntersMarkBonusPct)>0) parts.push(`Next hit +${Math.round(s.huntersMarkBonusPct*100)}% dmg`);
  if((s.accDebuff||0)>0) parts.push(`Your ACC −${s.accDebuff}%`);
  if(s.burning) parts.push('Burning (−20% DEF/MDEF, 7 dmg end enemy turn)');
  return parts.join(' · ');
}
function buildEnemyCombatStatHint(){
  const s=G.enemyStatus||{};
  const parts=[];
  if((s.accDebuff||0)>0) parts.push(`ACC −${s.accDebuff}%`);
  if(getWeakenStacks(s)>0) parts.push(`Weaken ×${getWeakenStacks(s)}`);
  if((s.feared||0)>0) parts.push(`Feared ${s.feared}t`);
  if(s.slow) parts.push('Slow');
  if((s.poison?.stacks||0)>0) parts.push(`Poison ×${s.poison.stacks}`);
  if((s.bleed?.turns||0)>0||(s.bleed?.stacks||0)>0) parts.push(`Bleed ${s.bleed.turns||0}t (heal −50%)`);
  if((s.chilled?.stacks||0)>0) parts.push(`Chill ×${s.chilled.stacks}`);
  if(s.peregrineDefBreak?.defLost) parts.push('DEF break');
  if((s.exposedGuard?.pct||0)>0) parts.push('Guard exposed');
  return parts.join(' · ');
}

function combatEscAttr(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function combatTrendTag(effective, baseline){
  const diff = effective - (Number(baseline)||0);
  if(diff>0) return '<small class="stat-trend up beneficial">▲</small>';
  if(diff<0) return '<small class="stat-trend down harmful">▼</small>';
  return '';
}
function resolvePassiveSourceLabel(sourceId){
  const raw=String(sourceId||'');
  const pasMatch=raw.match(/(PAS-[A-Za-z0-9_-]+)/);
  if(pasMatch){
    const row=Avian?.data?.combatPack?.birdPassives?.[pasMatch[1]];
    if(row?.name) return row.name;
  }
  const passiveId=BIRDS[G.player?.birdKey]?.passive?.id;
  if(passiveId && raw.includes(passiveId)){
    const info=getBirdPassiveInfo(G.player?.birdKey);
    if(info?.name) return info.name;
  }
  return raw.split(':')[0] || 'Passive';
}
function getPassivePerkModifierLines(statKey){
  const lines=[];
  if(statKey==='dodge' && (G.playerStatus?.passiveDodge||0)>0) lines.push(`Passive: +${G.playerStatus.passiveDodge}% dodge`);
  if(statKey==='critChance' && (G.playerStatus?.passiveCrit||0)>0) lines.push(`Passive: +${G.playerStatus.passiveCrit}% crit chance`);
  if(statKey==='acc' && (G.playerStatus?.passiveAcc||0)>0) lines.push(`Passive: +${G.playerStatus.passiveAcc}% ACC`);
  if(statKey==='critMult' && (G.playerStatus?.passiveCritDmg||0)>0) lines.push(`Passive: +${G.playerStatus.passiveCritDmg}% crit damage`);
  const bag=G.playerStatus?._passiveStatLoans;
  if(bag){
    for(const k in bag){
      const entry=bag[k];
      if(!entry || entry.statKey!==statKey) continue;
      lines.push(`Passive (${resolvePassiveSourceLabel(entry.sourceId||k)}): +${formatCombatNumber(entry.amt)} (${entry.turns||1}t)`);
    }
  }
  if(statKey==='magicPen'){
    if((G.player?._classPerkMdefPen||0)>0){
      const perk=Avian?.classPerks?.getClassPerkForBird?.(G.player?.birdKey);
      lines.push(`${perk?.name||'Class perk'}: +${Math.round(G.player._classPerkMdefPen*100)}% MDEF pen`);
    }
    if((G.player?._workbookMdefPenPct||0)>0) lines.push(`Passive: +${G.player._workbookMdefPenPct}% MDEF pen`);
  }
  if(statKey==='armorPen' && (G._workbookPassiveDefPen||0)>0) lines.push(`Passive: +${G._workbookPassiveDefPen}% DEF ignore (pending hit)`);
  return lines;
}
function getActiveDamageModifierLines(side){
  const lines=[];
  if(side==='enemy'){
    const es=G.enemyStatus||{};
    if(getWeakenStacks(es)>0) lines.push(`Weaken ×${getWeakenStacks(es)}: reduced damage output`);
    if((es.exposedGuard?.pct||0)>0) lines.push(`Guard exposed: +${Math.round(es.exposedGuard.pct*100)}% damage taken`);
    return lines;
  }
  const ps=G.playerStatus||{};
  const cpState=ps._classPerkState||{};
  if(G.warcryActive) lines.push(`Warcry: +${G.warcryATK||0}% ATK`);
  if(G.sitAndWaitActive) lines.push('Sit and Wait: +25% ATK');
  if(getWeakenStacks(ps)>0) lines.push(`Weaken ×${getWeakenStacks(ps)}: −${Math.round((1-getWeakenDamageMult(getWeakenStacks(ps)))*100)}% damage`);
  if(Number(ps.huntersMarkBonusPct)>0) lines.push(`Hunter's Mark: +${Math.round(ps.huntersMarkBonusPct*100)}% next hit`);
  if((G.player?._classPerkDukeStacks||0)>0) lines.push(`Duke Ascension: +${G.player._classPerkDukeStacks*5}% all damage`);
  const perk=Avian?.classPerks?.getClassPerkForBird?.(G.player?.birdKey);
  if(perk){
    if(perk.def?.id==='rogueTempo' && !cpState.rogueTempoUsed) lines.push(`${perk.name}: +10 Precision on first Weapon Skill 1 (pending)`);
    if(perk.def?.id==='verseAndChorus' && !cpState.verseChorusUsed) lines.push(`${perk.name}: alternate Martial/Magic to restore protection`);
    if(perk.def?.id==='retaliatingHide' && cpState.retaliatingHidePending) lines.push(`${perk.name}: +10% next physical hit`);
    if(perk.def?.id==='bulwarkOath' && !cpState.bulwarkOathUsed) lines.push(`${perk.name}: +4 Guard after Fortify / Armour Restoration`);
    if(perk.def?.id==='arcanePressure' && !cpState.arcanePressureUsed) lines.push(`${perk.name}: +10% Magic Armour damage on first Magic weapon skill`);
    if(perk.def?.id==='cursedCall' && !cpState.cursedCallUsed) lines.push(`${perk.name}: after Magic Armour break, next ailment +10% app / +1 turn`);
    if(perk.def?.id==='crushingMomentum' && cpState.crushingMomentumPending) lines.push(`${perk.name}: +10 Skill Power on next Strength weapon skill`);
    if(perk.def?.id==='judgementLeech' && !cpState.judgementLeechUsed) lines.push(`${perk.name}: restore lower protection pool on Health hit vs marked/ailmented`);
  }
  const evo=getPassiveEvolutionBonuses(G.player);
  if(evo.damagePct) lines.push(`Passive evolution: +${Math.round(evo.damagePct*100)}% damage`);
  if((ps.passiveAilmentBonus||0)>0) lines.push(`Passive: +${ps.passiveAilmentBonus}% ailment chance`);
  if((G.player?._workbookPermanentDmgBonus||0)>0) lines.push(`Passive: +${Math.round(G.player._workbookPermanentDmgBonus*100)}% permanent damage`);
  if((ps.tensionCoil?.turns||0)>0) lines.push(`Tension Coil: +${Math.round((ps.tensionCoil.pct||0)*100)}% damage`);
  if((ps.postDefAtkPct||0)>0) lines.push(`Post-defend: +${Math.round(ps.postDefAtkPct*100)}% next attack`);
  return lines;
}
function buildPlayerStatsGridHtml(){
  const p=G.player.stats;
  const _pBase=G.player._battleStatBase||{};
  const _defBoostAmt=(G.playerStatus?.defBoost?.turns>0)?(G.playerStatus.defBoost.amt||0):0;
  const _effDef=Math.floor((p.def+_defBoostAmt+(G.battleHymnActive?G.battleHymnDEF:0))*(playerHasBurning()?0.8:1));
  const _effAcc=Math.min(100, typeof getPlayerEffectiveAcc==='function'?getPlayerEffectiveAcc():(Number(p.acc)||0));
  const _effDodge=getEffectiveDodge(G.player);
  const _effSpd=(p.spd||0)+((G.playerStatus?.slow?.spdPenalty)?-(G.playerStatus.slow.spdPenalty||0):0);
  const _effMatk=(Number(p.matk)||0);
  const _effMdef=Math.floor((Number(p.mdef)||0)*(playerHasBurning()?0.8:1));
  const _eqMechCombat=typeof Avian?.equipment?.getMechanicsRollup==='function'?Avian.equipment.getMechanicsRollup(G.player):null;
  const _effAtk=G.warcryActive?(p.atk||0)*(1+G.warcryATK/100):p.atk;
  let _critChance=Math.min(100,(p.critChance||5));
  if(typeof Avian?.dispatcher?.modifyCritChance==='function') _critChance=Math.min(100, Avian.dispatcher.modifyCritChance(_critChance));
  const _critBaseStore=Number(_pBase.critChance??p.critChance??5);
  const _critBase=G.player.goldCritMult||1.5;
  const _critBonusPct=(G.player.critDamageBonusPct||0)+(_eqMechCombat?.critDamageBonusPct||0);
  const _critMultHtml=_critBonusPct>0?`${formatCombatNumber(_critBase)}×<small class="stat-cd-bonus">+${formatCombatNumber(_critBonusPct)}</small>`:`${formatCombatNumber(_critBase)}×`;
  const _statNote=(label,diff,srcUp='',srcDown='')=>`${label} ${diff>=0?'+':''}${diff}. ${diff>0?srcUp:(diff<0?srcDown:'No active modifier.')}`;
  const _atkNote=(G.warcryActive?`Warcry +${G.warcryATK}% Might.`:'')+(getWeakenStacks(G.playerStatus)>0?' Weaken reducing output.':'');
  const _accCardBonus=(G.player.firstAttackAccBonus||0)>0?` Shop/card hit bonus +${G.player.firstAttackAccBonus}% (applies to all attacks).`:'';
  const statCell=(klass,label,val,{suffix='',title='',trend='',statKey='',statRaw=null}={})=>{
    const dataAttr=statKey?` data-stat-key="${statKey}" data-stat-raw="${Number(statRaw??val)}"`:'';
    return `<div class="stat-mini ${klass}"${dataAttr} title="${combatEscAttr(title)}"><span class="stat-k">${label}</span><span class="stat-v">${formatCombatNumber(val)}${suffix}${trend}</span></div>`;
  };
  const _bt=(key,raw,extra='')=>{ const b=buildStatBreakdownTitle(key,raw,G.player); return [b,extra].filter(Boolean).join(' | '); };
  const _pCombatHint=buildPlayerCombatStatHint();
  const _pHintRow=_pCombatHint?`<div class="stat-status-hint" style="grid-column:1/-1">${combatEscAttr(_pCombatHint)}</div>`:'';
  const _effArmorPen=getPlayerArmorPenPct(G.player);
  const _effMagicPen=getPlayerMagicPenPct(G.player);
  const _penCells=`${(_effArmorPen>0)?statCell('stat-armor-pen',ledgerStatLabel('armorPen',{short:true}),_effArmorPen,{suffix:'%',title:_bt('armorPen',p.armorPen||0,'Ignores enemy Guard on martial hits.'),statKey:'armorPen',statRaw:p.armorPen||0}):''}${(_effMagicPen>0)?statCell('stat-magic-pen',ledgerStatLabel('magicPen',{short:true}),_effMagicPen,{suffix:'%',title:_bt('magicPen',p.magicPen||0,'Ignores enemy Resolve on magical hits.'),statKey:'magicPen',statRaw:p.magicPen||0}):''}`;
  return `${statCell('stat-vitality','VIG',Number(p.vitality)||0,{title:_bt('vitality',_pBase.vitality??p.vitality,'Vigour contributes to maximum Health.'),trend:combatTrendTag(Number(p.vitality)||0,_pBase.vitality),statKey:'vitality',statRaw:_pBase.vitality??p.vitality??0})}
     ${statCell('stat-atk',ledgerStatLabel('atk',{short:true}),_effAtk,{title:_bt('atk',_pBase.atk??p.atk,_statNote('Battle Might',_effAtk-(_pBase.atk||0),_atkNote,'Debuffs reducing Might effect.')),trend:combatTrendTag(_effAtk,_pBase.atk),statKey:'atk',statRaw:_pBase.atk??p.atk})}
     ${statCell('stat-matk',ledgerStatLabel('matk',{short:true}),_effMatk,{title:_bt('matk',(_pBase.matk??p.matk)||0,'Focus — improves spell/ailment potency'),trend:combatTrendTag(_effMatk,_pBase.matk??0),statKey:'matk',statRaw:(_pBase.matk??p.matk)||0})}
     ${statCell('stat-def',ledgerStatLabel('def',{short:true}),_effDef,{title:_bt('def',_pBase.def??p.def,_statNote('Battle Guard',_effDef-(_pBase.def||0),'Battle Hymn increased Guard.','Debuffs reducing Guard.')),trend:combatTrendTag(_effDef,_pBase.def),statKey:'def',statRaw:_pBase.def??p.def})}
     ${statCell('stat-mdef',ledgerStatLabel('mdef',{short:true}),_effMdef,{title:_bt('mdef',(_pBase.mdef??p.mdef)||0,'Resolve — resists enemy spells and ailments'),trend:combatTrendTag(_effMdef,_pBase.mdef??0),statKey:'mdef',statRaw:(_pBase.mdef??p.mdef)||0})}
     ${statCell('stat-dodge',ledgerStatLabel('dodge',{short:true}),_effDodge,{suffix:'%',title:_bt('dodge',_pBase.dodge??p.dodge,`Evasion chance. ${_statNote('Display',_effDodge-(_pBase.dodge||0),'Evasion buffs active.','Debuffs reduced Evasion.')}`),trend:combatTrendTag(_effDodge,_pBase.dodge),statKey:'dodge',statRaw:_pBase.dodge??p.dodge})}
     ${statCell('stat-acc',ledgerStatLabel('acc',{short:true}),_effAcc,{suffix:'%',title:_bt('acc',_pBase.acc??p.acc,_statNote('Battle Precision',_effAcc-(_pBase.acc||0),'Battle Hymn / buffs increased Precision.','Blind/ruffle reduced Precision.')+' Precision determines how reliably attacks and hostile skills connect. Class, size, species, weapons, skills, equipment and temporary effects can modify Precision.'+_accCardBonus),trend:combatTrendTag(_effAcc,_pBase.acc),statKey:'acc',statRaw:_pBase.acc??p.acc})}
     ${statCell('stat-spd',ledgerStatLabel('spd',{short:true}),_effSpd,{title:_bt('spd',_pBase.spd??p.spd,_statNote('Battle Agility',_effSpd-(_pBase.spd||0),'Buff increased Agility.','Slow/clip effects reduced Agility.')),trend:combatTrendTag(_effSpd,_pBase.spd),statKey:'spd',statRaw:_pBase.spd??p.spd})}
     ${statCell('stat-cc',ledgerStatLabel('critChance',{short:true}),_critChance,{suffix:'%',title:_bt('critChance',_critBaseStore,`Shown value includes battle modifiers (e.g. burn). ${_statNote('vs battle start',_critChance-_critBaseStore,'Temporary buffs.','Debuffs reduced Critical.')}`),trend:combatTrendTag(_critChance,_critBaseStore),statKey:'critChance',statRaw:_critBaseStore})}
     <div class="stat-mini stat-cd" data-stat-key="critMult" data-stat-raw="${_critBase}" title="${combatEscAttr(`Base Ferocity ${formatCombatNumber(_critBase)}×. On critical hits, +${formatCombatNumber(_critBonusPct)} is added to the multiplier.`)}"><span class="stat-k">${ledgerStatLabel('critMult',{short:true})}</span><span class="stat-v">${_critMultHtml}</span></div>
     <div class="stat-mini stat-arm" data-stat-key="armour" data-stat-raw="${Math.max(0,Number(p.armour)||0)}" title="${combatEscAttr(_bt('armour',(_pBase.armour??p.armour)||0,`Current ${formatCombatNumber(Math.max(0,Number(p.armour)||0))} / max ${formatCombatNumber(Math.max(0,Number(p.maxArmour)||0))} (normal ${formatCombatNumber(Math.max(0,Number(p.normalMaxArmour)||0))}). Absorbs martial damage before Health.`))}"><span class="stat-k">${ledgerStatLabel('armour',{short:true})}</span><span class="stat-v">${formatCombatNumber(Math.max(0,Number(p.armour)||0))}/${formatCombatNumber(Math.max(0,Number(p.maxArmour)||0))}</span></div>
     <div class="stat-mini stat-marm" data-stat-key="magicArmour" data-stat-raw="${Math.max(0,Number(p.magicArmour)||0)}" title="${combatEscAttr(_bt('magicArmour',(_pBase.magicArmour??p.magicArmour)||0,`Current ${formatCombatNumber(Math.max(0,Number(p.magicArmour)||0))} / max ${formatCombatNumber(Math.max(0,Number(p.maxMagicArmour)||0))} (normal ${formatCombatNumber(Math.max(0,Number(p.normalMaxMagicArmour)||0))}). Absorbs magical damage before Health.`))}"><span class="stat-k">${ledgerStatLabel('magicArmour',{short:true})}</span><span class="stat-v">${formatCombatNumber(Math.max(0,Number(p.magicArmour)||0))}/${formatCombatNumber(Math.max(0,Number(p.maxMagicArmour)||0))}</span></div>
     ${_penCells}
     ${_pHintRow}`;
}
function buildEnemyStatsGridHtml(){
  const ep2=G.enemy.stats;
  const eCritChance=Math.max(0,Math.min(100,(ep2.cc??((ep2.critChance||5)/100))*100));
  const eCritMult=(ep2.cd??ep2.critMult??1.5);
  const _eBase=G.enemy._battleStatBase||{};
  const enemyCell=(klass,label,val,{suffix='',title='',trend='',baseKey='',statKey='',statRaw=null}={})=>{
    const dataAttr=statKey?` data-stat-key="${statKey}" data-stat-raw="${Number(statRaw??val)}"`:'';
    const baseVal=baseKey?(Number(_eBase[baseKey])||Number(statRaw??val)):null;
    const autoTrend=trend||(baseVal!=null?combatTrendTag(val,baseVal):'');
    return `<div class="est ${klass}"${dataAttr} title="${combatEscAttr(title)}"><span class="stat-k">${label}</span><span class="stat-v">${formatCombatNumber(val)}${suffix}${autoTrend}</span></div>`;
  };
  const _eCombatHint=buildEnemyCombatStatHint();
  const _eHintRow=_eCombatHint?`<div class="stat-status-hint est-hint" style="grid-column:1/-1">${combatEscAttr(_eCombatHint)}</div>`:'';
  const _effEnemyDef=Math.floor((ep2.def||0)*(enemyHasBurning()?0.8:1));
  const _effEnemyMdef=Math.floor((Number(ep2.mdef)||0)*(enemyHasBurning()?0.8:1));
  const _effEnemyDodge=(ep2.dodge||0);
  const _enemyDodgeSpdNote=enemyHasBurning()?' — Burning: −20% Guard/Resolve':'';
  return `${enemyCell('stat-vitality','VIG',Number(ep2.vitality)||0,{title:'Vigour contributes to maximum Health',baseKey:'vitality',statKey:'vitality',statRaw:Number(ep2.vitality)||0})}
     ${enemyCell('stat-atk',ledgerStatLabel('atk',{short:true}),ep2.atk,{title:'Martial attack',baseKey:'atk',statKey:'atk',statRaw:ep2.atk})}
     ${enemyCell('stat-matk',ledgerStatLabel('matk',{short:true}),Number(ep2.matk)||0,{title:'Focus (magic attack)',baseKey:'matk',statKey:'matk',statRaw:Number(ep2.matk)||0})}
     ${enemyCell('stat-def',ledgerStatLabel('def',{short:true}),_effEnemyDef,{title:'Guard (martial defence)'+_enemyDodgeSpdNote,baseKey:'def',statKey:'def',statRaw:ep2.def,trend:combatTrendTag(_effEnemyDef,_eBase.def??ep2.def)})}
     ${enemyCell('stat-mdef',ledgerStatLabel('mdef',{short:true}),_effEnemyMdef,{title:'Resolve (magic defence)'+_enemyDodgeSpdNote,baseKey:'mdef',statKey:'mdef',statRaw:Number(ep2.mdef)||0,trend:combatTrendTag(_effEnemyMdef,(_eBase.mdef??ep2.mdef)||0)})}
     ${enemyCell('stat-dodge',ledgerStatLabel('dodge',{short:true}),_effEnemyDodge,{suffix:'%',title:`Evasion${_enemyDodgeSpdNote}`,baseKey:'dodge',statKey:'dodge',statRaw:ep2.dodge||0})}
     ${enemyCell('stat-acc',ledgerStatLabel('acc',{short:true}),Number(ep2.acc)||0,{suffix:'%',title:'Precision — how reliably this bird’s attacks connect (same Base Precision rules as player species).',baseKey:'acc',statKey:'acc',statRaw:Number(ep2.acc)||0})}
     ${enemyCell('stat-spd',ledgerStatLabel('spd',{short:true}),ep2.spd||0,{title:'Agility',baseKey:'spd',statKey:'spd',statRaw:ep2.spd||0})}
     ${enemyCell('stat-cc',ledgerStatLabel('critChance',{short:true}),eCritChance,{suffix:'%',title:'Critical chance',statKey:'critChance',statRaw:eCritChance})}
     ${enemyCell('stat-cd',ledgerStatLabel('critMult',{short:true}),Number(eCritMult),{suffix:'×',title:'Ferocity'})}
     <div class="est stat-arm" data-stat-key="armour" data-stat-raw="${Math.max(0,Number(ep2.armour)||0)}" title="${combatEscAttr(`Armour ${formatCombatNumber(Math.max(0,Number(ep2.armour)||0))} / ${formatCombatNumber(Math.max(0,Number(ep2.maxArmour)||0))} — absorbs martial damage before Health`)}"><span class="stat-k">${ledgerStatLabel('armour',{short:true})}</span><span class="stat-v">${formatCombatNumber(Math.max(0,Number(ep2.armour)||0))}/${formatCombatNumber(Math.max(0,Number(ep2.maxArmour)||0))}</span></div>
     <div class="est stat-marm" data-stat-key="magicArmour" data-stat-raw="${Math.max(0,Number(ep2.magicArmour)||0)}" title="${combatEscAttr(`Magic Armour ${formatCombatNumber(Math.max(0,Number(ep2.magicArmour)||0))} / ${formatCombatNumber(Math.max(0,Number(ep2.maxMagicArmour)||0))} — absorbs magical damage before Health`)}"><span class="stat-k">${ledgerStatLabel('magicArmour',{short:true})}</span><span class="stat-v">${formatCombatNumber(Math.max(0,Number(ep2.magicArmour)||0))}/${formatCombatNumber(Math.max(0,Number(ep2.maxMagicArmour)||0))}</span></div>
     ${_eHintRow}`;
}
function buildCombatStatBreakdownSection(side){
  const statKeys=side==='player'
    ? ['atk','matk','def','mdef','dodge','acc','spd','critChance','critMult','armour','magicArmour','armorPen','magicPen']
    : ['maxHp','atk','matk','def','mdef','dodge','acc','spd','critChance','armour','magicArmour'];
  const player=side==='player'?G.player:null;
  const enemy=side==='enemy'?G.enemy:null;
  let html='';
  for(const key of statKeys){
    const lines=[];
    if(side==='player'){
      for(const line of getPassivePerkModifierLines(key)) lines.push(line);
      for(const line of getBattleStatModifierLines(key)) lines.push(line);
      for(const line of getDerivedMechanicalBonusLines(player)){
        const showAtk=key==='atk'&&/attack damage|pierce/i.test(line);
        const showCrit=key==='critChance'&&/crit/i.test(line);
        if(showAtk||showCrit) lines.push(line);
      }
      const L=player?._statLedger;
      if(L?.birdBaseline && Object.keys(L.birdBaseline).length){
        for(const src of getEquippedStatSources(player,key)){
          lines.push(src.isPct?`${src.name}: +${formatCombatNumber(src.value)}%`:`${src.name}: +${formatCombatNumber(src.value)}`);
        }
      }
    } else if(enemy){
      for(const src of getEnemyMutationStatSources(enemy,key)){
        lines.push(src.isPct?`${src.name}: +${formatCombatNumber(src.value)}%`:`${src.name}: +${formatCombatNumber(src.value)}`);
      }
    }
    if(!lines.length) continue;
    const label=(STAT_LEDGER_LABELS[key]||key).toUpperCase();
    html+=`<div class="combat-details-stat-block"><div class="combat-details-stat-name">${combatEscAttr(label)}</div><ul class="combat-details-mod-list">${lines.map(l=>`<li>${combatEscAttr(l)}</li>`).join('')}</ul></div>`;
  }
  return html||'<p class="combat-details-empty">No active stat modifiers.</p>';
}
function buildCombatPerkSection(side){
  if(side==='player'){
    const passive=getBirdPassiveInfo(G.player?.birdKey);
    const classPerk=getBirdAuthoredClassPerk(G.player?.birdKey);
    let html='';
    if(passive){
      html+=`<div class="combat-details-perk"><div class="combat-details-perk-name">★ ${combatEscAttr(passive.name)} <span class="combat-details-perk-type">Passive</span></div>`;
      if(passive.trigger) html+=`<div class="combat-details-perk-trigger">${combatEscAttr(passive.trigger)}</div>`;
      html+=`<div class="combat-details-perk-desc">${combatEscAttr(passive.desc||passive.effect||'')}</div></div>`;
    } else html+='<p class="combat-details-empty">No passive.</p>';
    if(classPerk){
      html+=`<div class="combat-details-perk"><div class="combat-details-perk-name">${combatEscAttr(classPerk.name)} <span class="combat-details-perk-type">Class Perk</span></div>`;
      html+=`<div class="combat-details-perk-desc">${combatEscAttr(classPerk.effect||'')}</div></div>`;
    }
    return html;
  }
  const bk=G.enemy?.birdKey||G.enemy?.templateKey;
  const bird=bk&&BIRDS[bk]?BIRDS[bk]:null;
  const passive=bird?.passive;
  const classPerk=typeof Avian?.classPerks?.getClassPerkForEntity==='function'
    ? Avian.classPerks.getClassPerkForEntity(G.enemy)
    : getBirdAuthoredClassPerk(bk);
  let html='';
  if(passive) html+=`<div class="combat-details-perk"><div class="combat-details-perk-name">★ ${combatEscAttr(passive.name)} <span class="combat-details-perk-type">Passive</span></div><div class="combat-details-perk-desc">${combatEscAttr(passive.desc||passive.effect||'')}</div></div>`;
  if(classPerk){
    html+=`<div class="combat-details-perk"><div class="combat-details-perk-name">${combatEscAttr(classPerk.name)} <span class="combat-details-perk-type">Class Perk</span></div>`;
    html+=`<div class="combat-details-perk-desc">${combatEscAttr(classPerk.effect||'')}</div></div>`;
  }
  return html||'<p class="combat-details-empty">No passive.</p>';
}
function buildCombatStatusDetailsSection(side){
  const statuses=side==='player'?G.playerStatus:G.enemyStatus;
  const ownerStats=side==='player'?G?.player?.stats:G?.enemy?.stats;
  const poisonCap=G?.player?(G.player.poisonCap||5):5;
  const poisonBoundaryDamage=stacks=>{
    if(typeof calcPoisonTickDmg==='function'){
      const mult=side==='enemy'?(G?.player?.poisonTickMult||1):1;
      const base=calcPoisonTickDmg(stacks, ownerStats?.maxHp || 1, mult);
      const flat=side==='enemy'?((G?.player?.poisonFlatBonus||0)+(G?.player?.perkPoisonTickBonus||0)+(G?.player?.relVenomLedger?1:0)):0;
      return Math.max(1, base+flat);
    }
    return Math.max(1,(stacks||0));
  };
  const ctx={owner:side,statuses,poisonCap,poisonBoundaryDamage,getWeakenStacks,getWeakenDamageMult,getWeakenDodgePenalty,confusedSelfPct:STATUS_CONFUSED_SELF_PCT};
  const collectFn=typeof collectCombatStatusEntries==='function'?collectCombatStatusEntries:Avian?.statusDefs?.collectCombatStatusEntries;
  const resolveFn=typeof resolveCombatStatusBadge==='function'?resolveCombatStatusBadge:Avian?.statusDefs?.resolveStatusBadge;
  const detailFn=Avian?.statusDefs?.buildStatusDetail;
  if(!collectFn||!resolveFn) return '<p class="combat-details-empty">No status data.</p>';
  const entries=collectFn(statuses,ownerStats);
  const groups={ailment:[],buff:[],debuff:[]};
  entries.forEach(entry=>{
    const badge=resolveFn(entry,ctx);
    if(!badge||!badge.text) return;
    const cat=badge.category||'system';
    const bucket=cat==='ailment'?'ailment':cat==='buff'?'buff':'debuff';
    const detailParts=[badge.summary||''];
    if(badge.source) detailParts.push('Source: '+badge.source+'.');
    if(typeof detailFn==='function') detailParts.push(detailFn(entry.id,entry.value,badge.summary,ctx));
    groups[bucket].push({text:badge.text,detail:detailParts.filter(Boolean).join(' ')});
  });
  const renderGroup=(title,items)=>{
    if(!items.length) return '';
    return `<div class="combat-details-status-group"><div class="combat-details-status-cat">${combatEscAttr(title)}</div><ul class="combat-details-status-list">${items.map(it=>`<li><span class="combat-details-status-name">${combatEscAttr(it.text)}</span><span class="combat-details-status-detail">${combatEscAttr(it.detail)}</span></li>`).join('')}</ul></div>`;
  };
  const html=renderGroup('Ailments',groups.ailment)+renderGroup('Buffs',groups.buff)+renderGroup('Debuffs',groups.debuff);
  return html||'<p class="combat-details-empty">No active status effects.</p>';
}
function buildCombatDetailsModalHtml(side){
  const isPlayer=side==='player';
  const name=isPlayer?G.player?.name:G.enemy?.name;
  const gridClass=isPlayer?'stats-mini':'enemy-stats-mini stats-mini';
  const gridHtml=isPlayer?buildPlayerStatsGridHtml():buildEnemyStatsGridHtml();
  const dmgLines=getActiveDamageModifierLines(side);
  const dmgHtml=dmgLines.length
    ? `<ul class="combat-details-mod-list">${dmgLines.map(l=>`<li>${combatEscAttr(l)}</li>`).join('')}</ul>`
    : '<p class="combat-details-empty">No active damage modifiers.</p>';
  return `<div class="combat-stats-modal-content">
    <h3 class="combat-stats-modal-title">${combatEscAttr(name||'Combatant')} — Stats &amp; Details</h3>
    <section class="combat-details-section"><h4 class="combat-details-section-h">Stats</h4><div class="${gridClass}">${gridHtml}</div></section>
    <section class="combat-details-section"><h4 class="combat-details-section-h">Stat Breakdown</h4>${buildCombatStatBreakdownSection(side)}</section>
    <section class="combat-details-section"><h4 class="combat-details-section-h">Passive &amp; Class Perk</h4>${buildCombatPerkSection(side)}</section>
    <section class="combat-details-section"><h4 class="combat-details-section-h">Damage Modifiers</h4>${dmgHtml}</section>
    <section class="combat-details-section"><h4 class="combat-details-section-h">Status Effects</h4>${buildCombatStatusDetailsSection(side)}</section>
  </div>`;
}
function collectCombatantStatusChips(side){
  try{
    const statuses=side==='player'?G.playerStatus:G.enemyStatus;
    const ownerStats=side==='player'?G?.player?.stats:G?.enemy?.stats;
    const collectFn=typeof collectCombatStatusEntries==='function'?collectCombatStatusEntries:Avian?.statusDefs?.collectCombatStatusEntries;
    const resolveFn=typeof resolveCombatStatusBadge==='function'?resolveCombatStatusBadge:Avian?.statusDefs?.resolveStatusBadge;
    if(!collectFn||!resolveFn) return [];
    const ctx={owner:side,statuses,poisonCap:G?.player?(G.player.poisonCap||5):5};
    return collectFn(statuses||{},ownerStats).map(entry=>{
      const badge=resolveFn(entry,ctx);
      return badge&&badge.text?{text:badge.text,category:badge.category||'system'}:null;
    }).filter(Boolean);
  }catch(_){ return []; }
}
function buildCombatantHoverTooltipHtml(side){
  const isPlayer=side==='player';
  const entity=isPlayer?G.player:G.enemy;
  if(!entity) return '';
  const s=entity.stats||{};
  const birdKey=entity.birdKey||'';
  const cls=idToClassLabel(resolveFinalClass(
    isPlayer
      ? (entity.class||BIRDS[birdKey]?.class||'striker')
      : (entity.class||entity.enemyClass||inferEnemyClassFromStyle(entity)||'predator'),
    birdKey
  ));
  const szRaw=entity.size||BIRDS[birdKey]?.size||'medium';
  const sz=SIZE_LABELS[String(szRaw).toLowerCase()]||'';
  const asp=typeof getEntityAspect==='function'?getEntityAspect(entity):(entity.aspect||'');
  const lv=isPlayer
    ? (entity.birdLevel||1)
    : (Number.isFinite(entity.storyLevel)?entity.storyLevel:(Number.isFinite(entity.effectiveLevel)?entity.effectiveLevel:(typeof getEnemyPreviewLevel==='function'?getEnemyPreviewLevel(entity):1)));
  const hp=formatCombatNumber(s.hp||0);
  const maxHp=formatCombatNumber(s.maxHp||0);
  const arm=formatCombatNumber(Math.max(0,Number(s.armour)||0));
  const armMax=formatCombatNumber(Math.max(0,Number(s.maxArmour)||0));
  const marm=formatCombatNumber(Math.max(0,Number(s.magicArmour)||0));
  const marmMax=formatCombatNumber(Math.max(0,Number(s.maxMagicArmour)||0));
  const atk=formatCombatNumber(s.atk||0);
  const matk=formatCombatNumber(s.matk||0);
  const def=formatCombatNumber(s.def||0);
  const mdef=formatCombatNumber(s.mdef||0);
  const acc=formatCombatNumber(s.acc||0);
  const dodge=formatCombatNumber(s.dodge||0);
  const passive=isPlayer
    ? (typeof getBirdPassiveInfo==='function'?getBirdPassiveInfo(birdKey):null)
    : ((BIRDS[birdKey]&&BIRDS[birdKey].passive)||(typeof getBirdPassiveInfo==='function'?getBirdPassiveInfo(birdKey):null));
  const chips=collectCombatantStatusChips(side);
  const chipHtml=chips.length
    ? chips.slice(0,6).map(c=>`<span class="combat-hover-chip combat-hover-chip--${combatEscAttr(c.category)}">${combatEscAttr(c.text)}</span>`).join('')
    : '<span class="combat-hover-chip combat-hover-chip--empty">No ailments</span>';
  const meta=[cls, sz, asp?formatAspectDisplayName(asp):''].filter(Boolean).join(' · ');
  return `<div class="combat-hover-card">
    <div class="combat-hover-head">
      <div class="tt-name">${combatEscAttr(entity.name||(isPlayer?'Your bird':'Enemy'))}${!isPlayer&&entity.isBoss?' 👑':''}</div>
      <div class="tt-type">${combatEscAttr(meta)}</div>
      <div class="combat-hover-lv">Lv.${lv}</div>
    </div>
    <div class="combat-hover-vitals">
      <div class="combat-hover-vital"><span>HP</span><b>${hp}/${maxHp}</b></div>
      <div class="combat-hover-vital"><span>ARM</span><b>${arm}/${armMax}</b></div>
      <div class="combat-hover-vital"><span>MARM</span><b>${marm}/${marmMax}</b></div>
    </div>
    <div class="combat-hover-stats">
      <span><em>ATK</em>${atk}</span>
      <span><em>MATK</em>${matk}</span>
      <span><em>DEF</em>${def}</span>
      <span><em>MDEF</em>${mdef}</span>
      <span><em>PREC</em>${acc}%</span>
      <span><em>EVA</em>${dodge}%</span>
    </div>
    ${passive?.name?`<div class="combat-hover-passive">★ ${combatEscAttr(passive.name)}</div>`:''}
    <div class="combat-hover-ailments">${chipHtml}</div>
    <div class="tt-note">${window._isTouchDevice
      ? (isPlayer?'Hold for this card · Tap to open your Nest':'Hold for this card · Tap to open Enemy Nest')
      : (isPlayer?'Click to open your Nest':'Click to open Enemy Nest')}</div>
    ${richTooltipCloseBtn()}
  </div>`;
}
let _combatStatsModalSide=null;
function closeCombatStatsModal(){
  _combatStatsModalSide=null;
  const modal=document.getElementById('combat-stats-modal');
  if(!modal) return;
  modal.style.display='none';
  modal.classList.remove('combat-stats-modal--open');
}
function openCombatStatsModal(side){
  _combatStatsModalSide=side==='enemy'?'enemy':'player';
  const modal=document.getElementById('combat-stats-modal');
  const body=document.getElementById('combat-stats-modal-body');
  if(!modal||!body) return;
  wireCombatStatsModalOnce();
  body.innerHTML=buildCombatDetailsModalHtml(_combatStatsModalSide);
  modal.style.display='flex';
  modal.classList.add('combat-stats-modal--open');
  wireCombatStatTooltips(body);
  wireCombatEnemyStatTooltips(body);
}
function refreshCombatStatsModalIfOpen(){
  if(!_combatStatsModalSide) return;
  const body=document.getElementById('combat-stats-modal-body');
  if(!body) return;
  body.innerHTML=buildCombatDetailsModalHtml(_combatStatsModalSide);
  wireCombatStatTooltips(body);
  wireCombatEnemyStatTooltips(body);
}
function wireCombatStatsModalOnce(){
  const root=document.getElementById('combat-stats-modal');
  if(!root||root.dataset.wired==='1') return;
  root.dataset.wired='1';
}
globalThis.openCombatStatsModal=openCombatStatsModal;
globalThis.closeCombatStatsModal=closeCombatStatsModal;

Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatStatsModal = {
  open: openCombatStatsModal,
  close: closeCombatStatsModal,
  refreshIfOpen: refreshCombatStatsModalIfOpen,
  buildDetailsHtml: buildCombatDetailsModalHtml,
};
