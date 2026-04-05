// Enemy damage helpers (legacy 76ac60f)
function calcEnemyAbilityDamage(enemy,{stat='atk',base=0,scaling=1,variance=0.15}={}){
  const s=Math.max(1,Math.floor(enemy?.stats?.[stat]||enemy?.[stat]||1));
  const core=base+(s*scaling);
  const lo=Math.max(1,Math.floor(core*(1-variance)));
  const hi=Math.max(lo,Math.floor(core*(1+variance)));
  return roll(lo,hi);
}

function applyBossBurstBuffer(rawDamage){
  const dmg=Math.max(0,Math.floor(rawDamage||0));
  const e=G.enemy;
  if(!e?.isBoss) return dmg;
  const maxHp=Math.max(1,Math.floor(e?.stats?.maxHp||e?.maxHp||1));
  const cap=Math.floor(maxHp*0.40);
  if(dmg<=cap) return dmg;
  const excess=dmg-cap;
  return cap+Math.floor(excess*0.70);
}

function edmg(mult=1) {
  const b=G.enemy.stats.atk;
  const lull=G.enemyStatus.lullabied>0?.5:1;
  const weak=G.enemyStatus.weaken&&G.enemyStatus.weaken>0?.75:1;
  const ruffleReduct=G.enemyStatus.featherRuffle&&G.enemyStatus.featherRuffle.turns>0
    ?(1-(G.enemyStatus.featherRuffle.atkReduction||0)/100):1;
  let out=Math.floor(roll(Math.floor(b*.8),Math.floor(b*1.2))*mult*lull*weak*ruffleReduct);
  if((G.biomeMod?.lightningBonus||0)>0 && getEnemyKitAbilityIds(G.enemy).includes('eStun')){
    out=Math.floor(out*(1+G.biomeMod.lightningBonus));
  }
  if((G.biomeMod?.enemyCritPlus||0)>0 && chance(Math.floor(G.biomeMod.enemyCritPlus*100))){
    out=Math.floor(out*1.4);
  }
  return out;
}

function rollEnemyCritDamage(baseDamage){
  const raw=Math.max(1,Math.floor(baseDamage||1));
  const cc=Math.max(0,Math.min(0.95,G.enemy?.stats?.cc??((G.enemy?.stats?.critChance||5)/100)));
  const cd=Math.max(1.1,Number(G.enemy?.stats?.cd??G.enemy?.stats?.critMult??1.5));
  const isCrit=chance(Math.round(cc*100));
  return {amount:isCrit?Math.max(1,Math.floor(raw*cd)):raw,isCrit};
}

globalThis.calcEnemyAbilityDamage = calcEnemyAbilityDamage;
globalThis.applyBossBurstBuffer = applyBossBurstBuffer;
globalThis.edmg = edmg;
globalThis.rollEnemyCritDamage = rollEnemyCritDamage;
