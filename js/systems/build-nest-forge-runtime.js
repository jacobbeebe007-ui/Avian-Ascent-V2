/* Avian Ascent — Build Nest forge encounter runtime (Step 7 Phase 4). */
function storyLevelFromTierStar(tier, stars){
  const order=BIRD_CARD_TIER_ORDER||['grey','green','blue','purple','gold','orange'];
  const norm=typeof normalizeBirdCardTier==='function'?normalizeBirdCardTier(tier):String(tier||'grey').toLowerCase();
  const idx=order.indexOf(norm);
  const ti=idx>=0?idx:0;
  const s=typeof clampBirdCardStars==='function'?clampBirdCardStars(stars):Math.max(0,Math.min(5,Math.floor(Number(stars)||0)));
  return Math.max(1, ti*5+s+1);
}
function normalizeForgeSlotTierStar(slot){
  const tier=typeof normalizeBirdCardTier==='function'?normalizeBirdCardTier(slot?.enemyTier||'grey'):String(slot?.enemyTier||'grey').toLowerCase();
  const stars=typeof clampBirdCardStars==='function'?clampBirdCardStars(slot?.enemyStars??0):Math.max(0,Math.min(5,Math.floor(Number(slot?.enemyStars)||0)));
  return{tier,stars};
}
function getForgeEncounterSlot(slotIdx){
  const idx=Number.isFinite(Number(slotIdx))?Math.floor(Number(slotIdx)):Math.max(0,G._owEnemyIndex||0);
  return G._owForgeEncounter?.slots?.[idx]||null;
}
function shouldBuildForgeTierStarEnemy(slot, tok){
  if(!G._owForgeEncounter||!slot) return false;
  if(slot.enemyId&&typeof isRosterEnemyId==='function'&&isRosterEnemyId(String(slot.enemyId))) return false;
  if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(String(tok||''))) return false;
  return true;
}
function buildTierStarEnemyFromBirdKey(birdKey, opts={}){
  const bd=BIRDS?.[birdKey];
  if(!bd) return null;
  const {tier,stars}=normalizeForgeSlotTierStar({enemyTier:opts.tier,enemyStars:opts.stars});
  const mult=typeof getEffectiveBirdCardStatMultiplier==='function'?getEffectiveBirdCardStatMultiplier(tier,stars):1;
  const tierPack=Avian?.data?.birdCardTiers;
  const scaledKeys=tierPack?.SCALED_STAT_KEYS||['maxHp','hp','atk','def','spd','dodge','mdef','matk'];
  const stats={
    hp:roundCombatStat(bd.stats?.hp||bd.stats?.maxHp||30, 0.01),
    maxHp:roundCombatStat(bd.stats?.maxHp||bd.stats?.hp||30, 0.01),
    atk:roundCombatStat(bd.stats?.atk||6, 0.01),
    def:roundCombatStat(bd.stats?.def||2, 0),
    matk:roundCombatStat(Number(bd.stats?.matk)||0, 0.01),
    mdef:roundCombatStat(Number(bd.stats?.mdef)||0, 0),
    spd:roundCombatStat(bd.stats?.spd||6, 0.01),
    acc:roundCombatStat(Number(bd.stats?.acc)||0, 0),
    dodge:roundCombatStat(bd.stats?.dodge||10, 0),
    critChance:roundCombatStat(bd.stats?.critChance||5, 0),
    critMult:Math.max(1.1,Number(bd.stats?.critMult||1.5)),
  };
  scaledKeys.forEach(key=>{
    if(stats[key]==null) return;
    const floor=(key==='dodge'||key==='def'||key==='mdef'||key==='matk'||key==='acc')?0:0.01;
    stats[key]=roundCombatStat(Math.max(floor, stats[key]*mult), floor);
  });
  if(stats.maxHp!=null&&bd.stats?.maxHp>0){
    const hpRatio=(Number(bd.stats.hp??bd.stats.maxHp)||stats.maxHp)/Number(bd.stats.maxHp||stats.maxHp);
    stats.hp=Math.max(1, Math.round(stats.maxHp*hpRatio));
  }
  const cls=String(bd.class||'striker').toLowerCase();
  const storyLevel=storyLevelFromTierStar(tier,stars);
  const unlockSlots=typeof getEnemyUnlockedSlotCountForTier==='function'?getEnemyUnlockedSlotCountForTier(tier):2;
  const enemyStub={birdKey, abilities:[], familyEvolutionState:{}};
  /* equipmentV2: combat abilities come from class starting kit / reference loadout, not workbook kits. */
  if(!(Avian?.flags?.equipmentV2)){
    if(typeof materializeEnemySkillsFromWorkbookKit==='function'){
      materializeEnemySkillsFromWorkbookKit(enemyStub,birdKey,storyLevel,cls,null,{unlockSlots});
    }else if(typeof materializeEnemySkillsFromPlayerMirror==='function'){
      materializeEnemySkillsFromPlayerMirror(enemyStub,birdKey,storyLevel,null,cls);
    }
  }
  const diffMult=DIFFICULTIES[G.difficulty||'juvenile']?.mult||1;
  const bossMult=globalThis.STORY_BOSS_STAT_MULT||{hp:1.0,atk:1.15,matk:1.15};
  stats.maxHp=roundCombatStat(Math.max(0.01, stats.maxHp*diffMult), 0.01);
  stats.hp=stats.maxHp;
  stats.atk=roundCombatStat(Math.max(0.01, stats.atk*diffMult), 0.01);
  stats.matk=roundCombatStat(Math.max(0.01, stats.matk*diffMult), 0.01);
  if(opts.isBoss){
    stats.maxHp=roundCombatStat(Math.max(0.01, stats.maxHp*bossMult.hp), 0.01);
    stats.hp=stats.maxHp;
    stats.atk=roundCombatStat(Math.max(0.01, stats.atk*bossMult.atk), 0.01);
    stats.matk=roundCombatStat(Math.max(0.01, stats.matk*bossMult.matk), 0.01);
  }
  normalizeCombatStats(stats);
  const size=bd.size||'medium';
  const enProf=getEnemyEnergyProfile();
  const aiStyle=(['predator','striker'].includes(cls)?'aggressive':(cls==='tank'?'defensive':(cls==='trickster'?'trickster':'cautious')));
  const aiPersonality=typeof inferAIPersonalityFromClass==='function'?inferAIPersonalityFromClass(cls):inferAIPersonalityFromStyle(aiStyle,bd.name);
  const stage=Math.max(1,Math.floor(Number(opts.stage)||1));
  const v2=(typeof Avian?.getBirdV2==='function'?Avian.getBirdV2(birdKey):null)
    ||(Avian?.data?.birdsV2?Avian.data.birdsV2[birdKey]:null);
  const speciesBh=Number(v2?.baseHealth??bd?.baseHealth)||0;
  const speciesVit=Number(v2?.vitality??bd?.vitality??bd?.stats?.vitality)||0;
  if(speciesBh>0){
    stats.baseHealth=speciesBh;
    stats.vitality=speciesVit;
  }
  return{
    id:`forge_${birdKey}_${tier}_${stars}_${stage}_${Math.floor(Math.random()*1e6)}`,
    name:bd.name,
    birdKey,
    portraitKey:bd.portraitKey||birdKey,
    size,
    enemyClass:cls,
    class:cls,
    aiStyle,
    aiPersonality,
    abilities:JSON.parse(JSON.stringify(enemyStub.abilities||[])),
    stats:{...stats,en:enProf.maxEN},
    hp:stats.hp,maxHp:stats.maxHp,atk:stats.atk,def:stats.def,spd:stats.spd,acc:stats.acc,dodge:stats.dodge,mdef:stats.mdef,matk:stats.matk,
    cc:Math.max(0.05,Math.min(0.95,(stats.critChance||5)/100)), cd:stats.critMult||1.5,
    energyMax:enProf.maxEN,energy:enProf.startEN,energyRegen:enProf.regenEN,
    isBoss:!!opts.isBoss,
    bossTitle:opts.bossTitle||'',
    storyLevel,
    birdLevel:storyLevel,
    workbookLevel:Math.max(1, Math.min(30, storyLevel)),
    baseHealth:speciesBh>0?speciesBh:undefined,
    enemyTier:tier,
    enemyStars:stars,
    storyEvolvedSlots:unlockSlots,
    _storyDirectStats:true,
    ai: typeof defaultEnemyAI==='function'?defaultEnemyAI():{profile:'default',behaviour:'automatic'},
  };
}
globalThis.normalizeForgeSlotTierStar = normalizeForgeSlotTierStar;
globalThis.getForgeEncounterSlot = getForgeEncounterSlot;
globalThis.shouldBuildForgeTierStarEnemy = shouldBuildForgeTierStarEnemy;
globalThis.buildTierStarEnemyFromBirdKey = buildTierStarEnemyFromBirdKey;
