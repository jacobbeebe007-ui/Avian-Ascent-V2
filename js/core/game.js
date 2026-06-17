// ===== 01_script_01.js =====

/* ===== Dove enemy + Stage 20 Blakiston boss ===== */
(function(){
  // Extend sprite renderer with Dove support.
  const _oldRenderBirdIconHTML = globalThis.renderBirdIconHTML;
  if (typeof _oldRenderBirdIconHTML === 'function') {
    globalThis.renderBirdIconHTML = function(birdKey, sizeClass, locked) {
      const k = String(birdKey || '').toLowerCase().replace(/[^a-z]/g, '');
      if (k === 'dove') {
        return `<div class="sprite4 ${sizeClass||''} sprite-dove frame-0 ${locked?'locked':''}"></div>`;
      }
      return _oldRenderBirdIconHTML.apply(this, arguments);
    };
  }

  // Make the normal Dove enemy use the Dove sprite instead of Swan.
  // Deferred so that ENEMIES (extracted to js/data/enemies.js, which loads
  // AFTER game.js per js/bootstrap/load-order.json) is populated before we
  // try to patch the Dove entry.
  function patchDoveEnemy() {
    try {
      if (Array.isArray(globalThis.ENEMIES)) {
        const dove = globalThis.ENEMIES.find(e => String(e?.name||'').toLowerCase() === 'dove');
        if (dove) {
          dove.portraitKey = 'dove';
          dove.emoji = '🕊️';
          if (dove.stats) dove.stats.dodge = dove.stats.dodge || 10;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }
  if (typeof queueMicrotask === 'function') queueMicrotask(patchDoveEnemy);
  else if (typeof Promise !== 'undefined' && typeof Promise.resolve === 'function') Promise.resolve().then(patchDoveEnemy);
  else setTimeout(patchDoveEnemy, 0);

})();


// ===== 04_script_04.js =====

// ============================================================
//  Extracted data tables (see js/bootstrap/load-order.json for order):
//    BEFORE game.js → PORTRAITS, AILMENTS, BIOMES
//    AFTER  game.js → ENEMIES (uses makeEnemy), UPGRADE_CARDS_REWORK
//                     (uses _upgFlatStat / _upgFlatMaxHp / _upgGoldenFeather / BIRDS)
//  Bare references below resolve via globalThis (no const shadowing here).
//
//  Still inline in this file (deferred):
//    BIRDS                — ~470 lines, line ~612 below.
//                          Blocked by `runPassiveIntegrityAudit()` running at
//                          top-level here; extracting requires also moving
//                          the audit into a deferred startup hook.
//    ABILITY_TEMPLATES    — ~5300 lines, line ~60 below. Do last and in chunks.
//                          See `js/data/template-factories.js` for the
//                          factory shape new entries will use.
//  Pattern: IIFE assigns `globalThis.<NAME> = <literal>;`; place AFTER game.js
//  in the manifest if the table calls top-level helpers from this file
//  (factory/data files loaded BEFORE game.js cannot reference its functions).
//  Run `node scripts/build-bundle.js && node scripts/smoke.js` after each
//  move; revert if smoke fails.
// ============================================================

// ============================================================
//  BASE ABILITY TEMPLATES
// ============================================================
// Each ability has a levels array describing what each level adds.
// fn = function name called on use.
// ailments = list of ailment ids the ability can apply (for display)
const ABILITY_TEMPLATES = Object.create(null); /* Combat rewrite: populated at boot from combat-pack skillTrees. */

// ============================================================
//  BIRD DEFINITIONS
// ============================================================
// BIRDS catalog lives in js/data/birds.js (assigns globalThis.BIRDS,
// loaded BEFORE game.js so runPassiveIntegrityAudit() at top-level can see it).

BIRDS.blackbird.extraAbilities = (BIRDS.blackbird.extraAbilities||[]).filter(x=>x!=='mimic');


function runPassiveIntegrityAudit(){
  const IMM_MAP=[
    {needle:/immune\s+to\s+poison|poison\s+immune/i, key:'immunePoison'},
    {needle:/immune\s+to\s+fear|fear\s+immune/i, key:'immuneFear'},
    {needle:/immune\s+to\s+stun|stun\s+immune/i, key:'immuneStun'},
    {needle:/immune\s+to\s+paraly/i, key:'immuneParalyze'},
    {needle:/immune\s+to\s+weaken|weaken\s+immune/i, key:'immuneWeaken'},
    {needle:/immune\s+to\s+confus/i, key:'immuneConfused'},
    {needle:/immune\s+to\s+slow|slow\s+immune/i, key:'immuneSlow'},
  ];
  Object.entries(BIRDS||{}).forEach(([id,b])=>{
    const p=b?.passive;
    if(!p||!p.desc) return;
    IMM_MAP.forEach(m=>{
      if(m.needle.test(p.desc) && !p[m.key]){
        p[m.key]=true;
        try{ console.warn(`[passive-audit] ${id}.${p.id||'passive'} missing ${m.key}; auto-enabled to match description.`); }catch(_){ }
      }
    });
  });
}

runPassiveIntegrityAudit();

// ============================================================
//  ENEMIES — 20 stages (boss every 10)
// ============================================================
function inferAIPersonalityFromStyle(style='tactical', name=''){
  const n=String(name||'').toLowerCase();
  if(/duke blakiston/.test(n)) return 'predator';
  if(/seraph/.test(n)) return 'duelist';
  if(/khar/.test(n)) return 'executioner';
  if(/marshal stride/.test(n)) return 'tank';
  if(/mistmother koro/.test(n)) return 'seer';
  if(/gravecaller skarn/.test(n)) return 'reaper';
  if(/ashwing pyre/.test(n)) return 'scavenger';
  const s=String(style||'').toLowerCase();
  if(['berserker','aggressive'].includes(s)) return 'aggressive';
  if(['cautious','defensive'].includes(s)) return 'tank';
  if(['trickster'].includes(s)) return 'control';
  if(['predator'].includes(s)) return 'executioner';
  return 'tactical';
}

function inferEnemyClassFromStyle(style='tactical'){
  const s=String(style||'').toLowerCase();
  if(['berserker'].includes(s)) return 'inquisitor';
  if(['aggressive'].includes(s)) return 'rogue';
  if(['cautious','defensive'].includes(s)) return 'knight';
  if(['trickster'].includes(s)) return 'bard';
  if(['predator'].includes(s)) return 'inquisitor';
  return 'mage';
}

function makeEnemy(name, emoji, hp, atk, def, spd, style, isBoss=false, bossTitle='', opts={}) {
  const acc = opts.acc||72;
  const dodge = opts.dodge||5;
  const size = opts.size||'medium';
  const abilities = opts.abilities||[];
  const mdef = opts.mdef||8;
  const matk = opts.matk||6;
  const _enProf=getEnergyProfile(normalizeBirdSizeForEnergy(size));
  const baseEn = Number.isFinite(opts.baseEn) ? opts.baseEn : _enProf.maxEN;
  const enemyClass = opts.enemyClass || inferEnemyClassFromStyle(style);
  const cc = Number.isFinite(opts.cc) ? opts.cc : (Number.isFinite(opts.critChance) ? (opts.critChance/100) : 0.05);
  const cd = Number.isFinite(opts.cd) ? opts.cd : (Number.isFinite(opts.critMult) ? opts.critMult : 1.5);
  const portraitKey = opts.portraitKey||null;
  const enemyTier = opts.enemyTier || (isBoss ? (/final boss/i.test(String(bossTitle||'')) ? 'boss' : 'lieutenant') : 'normal');
  return {name, emoji, portraitKey, hp, maxHp:hp, atk, def, spd, acc, dodge, size, enemyClass, aiStyle:style, aiPersonality:(opts.aiPersonality||inferAIPersonalityFromStyle(style,name)), isBoss, bossTitle, enemyTier, abilities,
    stats:{hp,maxHp:hp,atk,def,spd,acc,dodge,mdef,matk,en:baseEn,cc,cd,critChance:Math.round(cc*100),critMult:cd}};
}

/** Stage-20 story boss: stats from roster L10 row + Duke command kit. */
function buildDukeStoryBossEnemy(){
  const rosterId=typeof getStoryDukeRosterId==='function'?getStoryDukeRosterId():'BO-DUKEB-STORY-L10';
  const base=typeof buildEnemyFromRosterId==='function'
    ? buildEnemyFromRosterId(rosterId,{isBoss:true,bossTitle:'🌩 Stage Boss'})
    : null;
  const dukeAbilities=['dukeRiverGrip','dukeDecree','dukeWardens','dukeOwlsVerdict'].map(id=>({id,level:4}));
  if(!base){
    return {
      id:'duke_blakiston', name:'Duke Blakiston', portraitKey:'duke_blakiston', birdKey:'dukeBlakiston',
      isBoss:true, size:'xl', aiType:'boss_duke', aiPersonality:'inquisitor', enemyClass:'inquisitor',
      bossTitle:'🌩 Stage Boss', storyLevel:10, abilities:dukeAbilities, _storyDirectStats:true,
      duke:{phase:1,nightfallTurns:0,decreeKey:null,decreeStacks:0,riverCd:0,summonCd:0,verdictCd:0},
    };
  }
  base.id='duke_blakiston';
  base.name='Duke Blakiston';
  base.portraitKey='duke_blakiston';
  base.birdKey='dukeBlakiston';
  base.aiType='boss_duke';
  base.aiPersonality='inquisitor';
  base.enemyClass='inquisitor';
  base.class='inquisitor';
  base.enemyTier='boss';
  base.abilities=dukeAbilities;
  base.duke={phase:1,nightfallTurns:0,decreeKey:null,decreeStacks:0,riverCd:0,summonCd:0,verdictCd:0};
  return base;
}
function makeDukeBlakiston(){
  return buildDukeStoryBossEnemy();
}
const ENEMY_ABILITY_POOL = {
  eVenom:   {name:'Venom Peck', desc:'Deal light physical damage and apply 2 Poison stacks.', dmg:'~80% ATK + poison', dodgeable:true, fn(e,p,G){
    const r=dealDamage('player',edmg(0.8));
    spawnFloat('player',`-${r.dmgDealt}`,'fn-dmg');
    applyAilment('player','poison',2);
    logMsg(`☣ ${e.name} pecks with venom!`,'enemy-action');
  }},
  eWeaken:  {name:'Screech', desc:'Apply Weaken for 3 turns.', dmg:'0 direct', dodgeable:true, fn(e,p,G){
    const _bd=BIRDS[G.player.birdKey];const ps=_bd&&_bd.passive;
    if(ps&&ps.immuneWeaken){spawnFloat('player','🛡 Immune!','fn-status');return;}
    applyWeakenStack('player', 1);
    logMsg(`🐔 ${e.name} weakens you!`,'enemy-action');
  }},
  eStun:    {name:'Body Slam', desc:'Deal 80% ATK and 25% chance to stun.', dmg:'~80% ATK + stun', fn(e,p,G){
    const r=dealDamage('player',edmg(0.8));
    spawnFloat('player',`-${r.dmgDealt}`,'fn-dmg');
    if(chance(25))applyAilment('player','paralyzed',1);
    logMsg(`💥 ${e.name} slams into you!`,'enemy-action');
  }},
  eFear:    {name:'Shriek', desc:'Apply Fear. 1 turn normally, 2 for bosses.', dmg:'0 direct', dodgeable:true, fn(e,p,G){
    const turns=e.isBoss?2:1;
    const _bd=BIRDS[G.player.birdKey];const ps=_bd&&_bd.passive;
    if((ps&&ps.immuneFear)||G.player.stats?.immuneFear){spawnFloat('player','🛡 Fear Immune!','fn-status');return;}
    G.playerStatus.feared=Math.min(2,Math.max(G.playerStatus.feared||0,turns));
    logMsg(`😨 ${e.name} terrifies you!`,'enemy-action');
  }},
  eBurn:    {name:'Fire Feathers', desc:'Apply Burn for 3 turns.', dmg:'0 direct', dodgeable:true, fn(e,p,G){
    applyAilment('player','burning',3);
    logMsg(`🔥 ${e.name} scorches you!`,'enemy-action');
  }},
  eHeal:    {name:'Preen', desc:'Heal 15% max HP.', dmg:'healing', fn(e,p,G){
    const heal=scaleHealForBleed('enemy',roundCombatDamage(Math.max(0.01,(e.stats.maxHp||1)*0.15)));
    e.stats.hp=Math.min(e.stats.maxHp,e.stats.hp+heal);
    spawnFloat('enemy',`+${heal}`,'fn-heal');
    setHpBar('enemy',e.stats.hp,e.stats.maxHp);
    logMsg(`💚 ${e.name} recovers ${heal} HP!`,'enemy-action');
  }},
  eRage:    {name:'Fury', desc:'Gain +25% ATK for 3 turns.', dmg:'buff', fn(e,p,G){
    if((G.enemyStatus.rageBuff||0)>0){
      const r=dealDamage('player',edmg(1.0));
      spawnFloat('player',`-${r.dmgDealt}`,'fn-dmg');
      logMsg(`💢 ${e.name} lashes out instead of raging again!`,'enemy-action');
      return;
    }
    G.enemyStatus.rageBuff=3;
    logMsg(`💢 ${e.name} enters a fury for 3 turns!`,'enemy-action');
  }},
  eBlind:   {name:'Wing Dust', desc:'Apply Blind for 2 turns.', dmg:'0 direct', dodgeable:true, fn(e,p,G){
    const cur=G.playerStatus.dustDevil||{turns:0,accDrop:0};
    G.playerStatus.dustDevil={turns:Math.max(cur.turns||0,2),accDrop:Math.max(cur.accDrop||0,15)};
    logMsg(`🌪 ${e.name} blinds you!`,'enemy-action');
  }},
  ePoison:  {name:'Plague Bite', desc:'Apply 3 Poison stacks.', dmg:'0 direct', dodgeable:true, fn(e,p,G){
    applyAilment('player','poison',3);
    logMsg(`☣ ${e.name} infects you with plague!`,'enemy-action');
  }},
  eShield:  {name:'Iron Feathers', desc:'Gain Block for 2 turns.', dmg:'0 direct', fn(e,p,G){
    if((G.enemyStatus.defending||0)>0){
      const r=dealDamage('player',edmg(0.9));
      spawnFloat('player',`-${r.dmgDealt}`,'fn-dmg');
      logMsg(`🛡 ${e.name} is already guarded and strikes instead!`,'enemy-action');
      return;
    }
    G.enemyStatus.defending=2;
    doShield('enemy');
    logMsg(`🛡 ${e.name} hardens its feathers for 2 turns!`,'enemy-action');
  }},
};

// ENEMIES table lives in js/data/enemies.js (assigns globalThis.ENEMIES,
// loaded AFTER game.js so it can reuse this file's `makeEnemy` factory).

// Enemy combatants: js/data/enemy-roster.js (~2,625 authored rows). Use buildEnemyFromRosterId().
const BIRD_ENEMIES = [];

// ===================== BIOMES =====================
// BIOMES table lives in js/data/biomes.js (assigns globalThis.BIOMES).

function getBiomeForStage(stage){
  for(const b of BIOMES){
    if(stage>=b.stageMin && stage<=b.stageMax) return b;
  }
  return BIOMES[BIOMES.length-1];
}

function applyBiomeModifiers(){
  const b=getBiomeForStage(G.stage);
  if(!b) return;
  G.biome=b.id;
  G.biomeMod=b.mod||{};
  if(typeof logMsg==='function') logMsg(`🗺️ ${b.name}`,'system');
}


// ============================================================
//  REWARD POOLS — tiered
// ============================================================
const REWARD_WEIGHTS = { grey:50, green:28, blue:14, purple:6, gold:2 };
function rollRarity(){
  const total=Object.values(REWARD_WEIGHTS).reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(const [tier,w] of Object.entries(REWARD_WEIGHTS)){ r-=w; if(r<=0) return tier; }
  return 'grey';
}

/** Run upgrade helpers — flat stat cards (UPGRADE_CARDS_REWORK) */
function _upgFlatStat(p, stat, amount){
  if(!p.stats) p.stats = {};
  p.stats[stat] = (p.stats[stat] || 0) + amount;
}
function _upgFlatMaxHp(p, amount){
  if(!p.stats) p.stats = {};
  const mh = Math.max(1, Number(p.stats.maxHp)||1);
  p.stats.maxHp = mh + amount;
  p.stats.hp = Math.min((p.stats.hp||0) + amount, p.stats.maxHp);
}
function _upgGoldenFeather(p){
  const sz = normalizeBirdSizeForEnergy(p.size || BIRDS[p.birdKey]?.size || 'medium');
  const cap = ENERGY_STACK_CAP_BY_SIZE[sz] ?? 3;
  p.energyBonus = Math.min(cap, (p.energyBonus||0) + 1);
  p.energyMax = computePlayerMaxEnergy();
  p.energy = Math.min((p.energy||0) + 1, p.energyMax);
}

// Combat rewrite: legacy stat-card reward pool is retired. Post-combat reward
// flow keeps using `getUpgradePool` but the pool is permanently empty — the new
// ability shop in js/systems/shop-v2.js (rolled by js/systems/combat-pack-boot.js)
// is the only source of new player content. Variable retained so legacy callers
// that touch UPGRADE_CARDS_REWORK directly (audits, codex) still resolve.
if (typeof globalThis.UPGRADE_CARDS_REWORK === 'undefined') globalThis.UPGRADE_CARDS_REWORK = [];
var UPGRADE_CARDS_REWORK = globalThis.UPGRADE_CARDS_REWORK;

function countUpgradeAcquisitionsThisRun(upgradeId){
  return (G.collectedRewards||[]).filter(r=>r.id===upgradeId).length;
}
function isUpgradeBlockedByRunAcquisitionCap(card){
  if(!card) return false;
  const lims=[];
  if(Number.isFinite(card.maxStacks)&&card.maxStacks>0) lims.push(card.maxStacks);
  if(Number.isFinite(card.runSpawnCap)&&card.runSpawnCap>0) lims.push(card.runSpawnCap);
  if(!lims.length) return false;
  const lim=Math.min(...lims);
  return countUpgradeAcquisitionsThisRun(card.id)>=lim;
}
function upgradeEligibleForRewardPick(card, usedIds){
  if(!card) return false;
  if(usedIds&&usedIds.has(card.id)) return false;
  if(card.stackable===false && G.runUpgradesPurchased?.has(card.id)) return false;
  if(isUpgradeBlockedByRunAcquisitionCap(card)) return false;
  return true;
}

function getUpgradePool(){ return UPGRADE_CARDS_REWORK.slice(); }

// ---- Stat ledger: bird baseline vs level-up feathers vs card upgrades (Nest + combat tooltips) ----
const STAT_LEDGER_TRACKED_KEYS = ['maxHp','atk','def','spd','acc','dodge','matk','mdef','critChance','armorPen','magicPen'];
const STAT_LEDGER_LABELS = {maxHp:'HP (max)',atk:'ATT',def:'DEF',spd:'SPD',acc:'ACC',dodge:'DODGE',matk:'MATK',mdef:'MDEF',critChance:'CRIT %',armorPen:'ARMOUR PEN %',magicPen:'MAGIC PEN %'};
function cloneStatLedgerSlice(stats){
  const s = stats || {};
  const out = {};
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const n = Number(s[k]);
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}
function ensureStatLedger(player){
  if(!player) return null;
  if(!player._statLedger || typeof player._statLedger !== 'object'){
    player._statLedger = {
      birdBaseline:{},
      fromLevel:{},
      fromUpgrades:{},
      fromCardTier:{},
      fromEquipment:{},
      mechanicalLines:[],
    };
  }
  const L = player._statLedger;
  if(!L.fromLevel || typeof L.fromLevel !== 'object') L.fromLevel = {};
  if(!L.fromUpgrades || typeof L.fromUpgrades !== 'object') L.fromUpgrades = {};
  if(!L.fromCardTier || typeof L.fromCardTier !== 'object') L.fromCardTier = {};
  if(!L.fromEquipment || typeof L.fromEquipment !== 'object') L.fromEquipment = {};
  if(!Array.isArray(L.mechanicalLines)) L.mechanicalLines = [];
  return L;
}
function initStatLedgerForNewRun(player){
  const L = ensureStatLedger(player);
  if(!L || !player?.stats) return;
  const catalogStats = player.birdKey && BIRDS[player.birdKey]?.stats;
  L.birdBaseline = catalogStats ? cloneStatLedgerSlice(catalogStats) : cloneStatLedgerSlice(player.stats);
  L.fromLevel = {};
  L.fromUpgrades = {};
  L.fromEquipment = {};
  L.fromCardTier = {};
  L.mechanicalLines = [];
}
globalThis.ensureStatLedger=ensureStatLedger;
globalThis.cloneStatLedgerSlice=cloneStatLedgerSlice;
function syncBirdBaselineFromCatalog(player){
  if(!player?.stats || !player.birdKey) return;
  const bd=BIRDS[player.birdKey];
  if(!bd?.stats) return;
  const L=ensureStatLedger(player);
  if(!L) return;
  const newBase=cloneStatLedgerSlice(bd.stats);
  const oldBase=(L.birdBaseline && Object.keys(L.birdBaseline).length) ? L.birdBaseline : null;
  if(!oldBase){
    L.birdBaseline=newBase;
    return;
  }
  let drift=false;
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    if(Math.abs((Number(oldBase[k])||0)-(Number(newBase[k])||0))>0.0001){ drift=true; break; }
  }
  if(!drift) return;
  if(!L.fromUpgrades || typeof L.fromUpgrades!=='object') L.fromUpgrades={};
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const delta=(Number(newBase[k])||0)-(Number(oldBase[k])||0);
    if(Math.abs(delta)<0.0001) continue;
    L.fromUpgrades[k]=(Number(L.fromUpgrades[k])||0)-delta;
  }
  L.birdBaseline=newBase;
}
function ensureStatLedgerAfterLoad(player){
  if(!player?.stats) return;
  syncBirdBaselineFromCatalog(player);
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function'){
    Avian.mutations.reapplyPlayerStatsFromSources(player);
  }
  const L = ensureStatLedger(player);
  if(L.birdBaseline && typeof L.birdBaseline === 'object' && Object.keys(L.birdBaseline).length > 0){
    return;
  }
  const bd = BIRDS[player.birdKey] || {};
  const base = cloneStatLedgerSlice(bd.stats);
  L.birdBaseline = base;
  const hasSplits = Object.keys(L.fromLevel).length > 0 || Object.keys(L.fromUpgrades).length > 0;
  if(!hasSplits){
    L.fromLevel = {};
    L.fromUpgrades = {};
    if(!Array.isArray(L.mechanicalLines)) L.mechanicalLines = [];
    const cur = cloneStatLedgerSlice(player.stats);
    for(const k of STAT_LEDGER_TRACKED_KEYS){
      const d = (Number(cur[k])||0) - (Number(base[k])||0);
      if(Math.abs(d) > 0.0001) L.fromUpgrades[k] = d;
    }
  }
}
function mergeStatDeltaIntoBucket(bucket, beforeStats, afterStats){
  const before = cloneStatLedgerSlice(beforeStats);
  const after = cloneStatLedgerSlice(afterStats);
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const d = (Number(after[k])||0) - (Number(before[k])||0);
    if(Math.abs(d) > 0.0001) bucket[k] = (bucket[k]||0) + d;
  }
}
function recordUpgradeApplyInLedger(player, beforeStats, afterStats, meta){
  const L = ensureStatLedger(player);
  if(!L) return;
  mergeStatDeltaIntoBucket(L.fromUpgrades, beforeStats, afterStats);
  let hasStatDelta = false;
  const b = cloneStatLedgerSlice(beforeStats);
  const a = cloneStatLedgerSlice(afterStats);
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    if(Math.abs((Number(a[k])||0)-(Number(b[k])||0)) > 0.0001){ hasStatDelta = true; break; }
  }
  if(!hasStatDelta && meta && meta.desc){
    const line = String(meta.desc).trim();
    if(line) L.mechanicalLines.push(line);
  }
}
function formatCombatNumber(n) {
  return (Number(n) || 0).toFixed(2);
}
function roundCombatDamage(n) {
  return Math.max(0.01, Math.round(Number(n) * 100) / 100);
}
globalThis.roundCombatDamage = roundCombatDamage;
function roundCombatStat(n, floor=0) {
  return Math.max(floor, Math.round(Number(n) * 100) / 100);
}
globalThis.roundCombatStat = roundCombatStat;
function rollCombatSpread(lo, hi) {
  const a = Number(lo) || 0;
  const b = Number(hi) || a;
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const rolled = low + Math.random() * (high - low);
  return roundCombatDamage(Math.max(0.01, rolled));
}
globalThis.rollCombatSpread = rollCombatSpread;
function applyFractionalHp(stats, delta) {
  stats.hp = Math.max(0, Math.round((Number(stats.hp) + delta) * 100) / 100);
}
function normalizeCombatStats(stats) {
  if (!stats) return;
  for (const k of ['hp', 'maxHp', 'atk', 'def', 'matk', 'mdef', 'spd', 'acc', 'dodge', 'critChance', 'armorPen', 'magicPen']) {
    if (stats[k] != null) stats[k] = Math.round(Number(stats[k]) * 100) / 100;
  }
}
function capPctStatValue(statKey, value) {
  const v = Number(value) || 0;
  if (statKey === 'critChance') return Math.max(0, Math.min(100, v));
  if (statKey === 'armorPen' || statKey === 'magicPen') return Math.max(0, Math.min(95, v));
  return Math.max(0, v);
}
function dodgeBonusFromSpeed(_spd) {
  return 0;
}
globalThis.dodgeBonusFromSpeed = dodgeBonusFromSpeed;
function dodgeSpdAttributionNote(_player) {
  return '';
}
function formatLedgerDelta(n){
  return formatCombatNumber(n);
}
function buildStatBreakdownTitle(statKey, rawVal, player){
  const L = player?._statLedger;
  if(!L || !L.birdBaseline || !Object.keys(L.birdBaseline).length) return '';
  const b = Number(L.birdBaseline[statKey]||0);
  const lv = Number(L.fromLevel?.[statKey]||0);
  const u = Number(L.fromUpgrades?.[statKey]||0);
  const eq = Number(L.fromEquipment?.[statKey]||0);
  const cur = Number(rawVal)||0;
  const rem = cur - b - lv - u - eq;
  let t = `${(STAT_LEDGER_LABELS[statKey]||statKey).toUpperCase()}: ${formatCombatNumber(cur)} — base ${formatCombatNumber(b)} + level ${formatLedgerDelta(lv)} + upgrades ${formatLedgerDelta(u)} + equipment ${formatLedgerDelta(eq)}`;
  if(Math.abs(rem) > 0.05) t += ` + other ${rem >= 0 ? '+' : ''}${formatLedgerDelta(rem)}`;
  if(statKey === 'dodge') t += dodgeSpdAttributionNote(player);
  return t;
}
function getEquippedStatSources(player, statKey){
  const lines = [];
  if(!player?.equippedMutations) return lines;
  for(const slot in player.equippedMutations){
    const arr = player.equippedMutations[slot];
    if(!Array.isArray(arr)) continue;
    for(const id of arr){
      if(!id) continue;
      const item = typeof Avian?.mutations?.getItem==='function' ? Avian.mutations.getItem(id) : null;
      const val = Number(item?.stats?.[statKey]) || 0;
      if(!item || Math.abs(val) < 0.0001) continue;
      lines.push({ name: item.name, value: val });
    }
  }
  return lines;
}
function getBattleStatModifierLines(statKey){
  const lines = [];
  if(statKey==='atk' && G?.warcryActive) lines.push(`Warcry: +${G.warcryATK||0}% ATK`);
  if(statKey==='atk' && G?.sitAndWaitActive) lines.push('Sit and Wait: +25% ATK');
  if(statKey==='atk' && G?.playerStatus?.tookie?.turns>0) lines.push(`Tookie Tookie: +${G.playerStatus.tookie.atkBonus||0}% ATK`);
  if(statKey==='def' && G?.battleHymnActive) lines.push('Battle Hymn: +DEF');
  if(statKey==='acc' && G?.battleHymnActive) lines.push('Battle Hymn: +ACC');
  if(statKey==='atk' && getWeakenStacks(G?.playerStatus)>0) lines.push('Weaken: reduced output');
  if(statKey==='def' && getWeakenStacks(G?.playerStatus)>0) lines.push('Weaken: reduced DEF');
  if(statKey==='dodge' && G?.playerStatus?.slow) lines.push('Slow: reduced dodge');
  if(statKey==='spd' && G?.playerStatus?.slow) lines.push('Slow: reduced SPD');
  if(statKey==='acc' && (G?.playerStatus?.blind||G?.playerStatus?.dustDevil)) lines.push('Blind: reduced ACC');
  if(statKey==='critChance' && playerHasBurning()) lines.push('Burning: crit penalty');
  if((statKey==='def' || statKey==='mdef') && playerHasBurning()) lines.push('Burning: −20% DEF/MDEF');
  return lines;
}
function richTooltipCloseBtn(){
  if(!window._isTouchDevice) return '';
  return `<div style="text-align:right;margin-top:8px"><button type="button" onclick="hideTooltip()" style="background:rgba(201,168,76,.2);border:1px solid var(--gold);border-radius:4px;color:var(--gold);padding:2px 10px;cursor:pointer;font-size:.75rem;">✕ Close</button></div>`;
}
function getBirdPassiveInfo(birdKey){
  if(typeof Avian?.passives?.describeFor==='function'){
    const info=Avian.passives.describeFor(birdKey);
    if(info) return info;
  }
  const bd=birdKey&&BIRDS[birdKey];
  if(!bd?.passive) return null;
  return { name: bd.passive.name, desc: bd.passive.desc||'', trigger: bd.passive.trigger||'' };
}

function getBirdAuthoredClassPerk(birdKey){
  const bd=birdKey&&BIRDS[birdKey];
  if(!bd) return null;
  let effect=bd.classPerkEffect||'';
  const pid=bd.passive?.id;
  const packPassive=pid&&Avian?.data?.combatPack?.birdPassives?.[pid];
  if(!effect&&packPassive) effect=packPassive.classPerkEffect||'';
  const role=classToRoleId(bd.class);
  const clsPack=Avian?.data?.combatPack?.classes?.[role];
  const perkName=bd.classPerk||packPassive?.classPerk||clsPack?.classPerk||'';
  if(!effect&&clsPack&&(!bd.classPerk||clsPack.classPerk===bd.classPerk)) effect=clsPack.classPerkEffect||'';
  if(!perkName&&!effect) return null;
  return { name: perkName, effect };
}

function buildPassiveTooltipHTML(birdKey){
  const p = getBirdPassiveInfo(birdKey);
  if(!p) return '';
  let html = `<div class="tt-name">★ ${escapeHtmlRoster(p.name)}</div><div class="tt-type">Passive</div>`;
  if(p.trigger) html += `<div class="tt-row"><span class="tt-lbl">Trigger</span><span class="tt-val" style="font-size:.88em">${escapeHtmlRoster(p.trigger)}</span></div>`;
  html += `<div class="tt-desc">${escapeHtmlRoster(p.desc||p.effect||'')}</div>`;
  if(p.balance) html += `<div class="tt-note" style="opacity:.75;margin-top:6px;font-size:.78em">${escapeHtmlRoster(p.balance)}</div>`;
  html += richTooltipCloseBtn();
  return html;
}
function getMutationDescHtml(itemOrId, opts={}){
  const item = typeof itemOrId==='string'
    ? (typeof Avian?.mutations?.getItem==='function' ? Avian.mutations.getItem(itemOrId) : null)
    : itemOrId;
  if(!item) return '';
  const compact=!!opts.compact;
  if(compact && typeof Avian?.mutations?.formatMutationStatCompactHtml==='function'){
    const html=Avian.mutations.formatMutationStatCompactHtml(item);
    return html?`<div class="mut-stat-compact">${html}</div>`:'';
  }
  return typeof Avian?.mutations?.formatMutationDescHtml==='function'
    ? Avian.mutations.formatMutationDescHtml(item)
    : escapeHtmlRoster(typeof Avian?.mutations?.formatMutationDesc==='function' ? Avian.mutations.formatMutationDesc(item) : (item.statLine||item.name));
}
function buildMutationTooltipHTML(itemId){
  const item = typeof Avian?.mutations?.getItem==='function' ? Avian.mutations.getItem(itemId) : null;
  if(!item) return '';
  const slotLbl = typeof Avian?.mutations?.SLOT_LABELS?.[item.slot]==='string'
    ? Avian.mutations.SLOT_LABELS[item.slot] : (item.slot||'');
  let html = `<div class="tt-name">${escapeHtmlRoster(item.name)}</div>`;
  html += `<div class="tt-type">${escapeHtmlRoster(item.tier||'mutation')} · ${escapeHtmlRoster(slotLbl)}</div>`;
  const statHtml = getMutationDescHtml(item);
  if(statHtml) html += `<div class="tt-mut-stats">${statHtml}</div>`;
  html += richTooltipCloseBtn();
  return html;
}
function buildRichStatTooltipHtml(statKey, rawVal, player){
  const label = (STAT_LEDGER_LABELS[statKey]||statKey).toUpperCase();
  let html = `<div class="tt-name">${label}</div>`;
  html += `<div class="tt-row"><span class="tt-lbl">Total</span><span class="tt-val">${formatCombatNumber(rawVal)}</span></div>`;
  const L = player?._statLedger;
  if(L?.birdBaseline && Object.keys(L.birdBaseline).length){
    const rows = [
      ['Base', Number(L.birdBaseline[statKey]||0)],
      ['Card', Number(L.fromCardTier?.[statKey]||0)],
      ['Level', Number(L.fromLevel?.[statKey]||0)],
      ['Upgrades', Number(L.fromUpgrades?.[statKey]||0)],
      ['Equipment (total)', Number(L.fromEquipment?.[statKey]||0)],
    ];
    for(const [lbl, val] of rows){
      if(Math.abs(val) < 0.0001 && lbl !== 'Base') continue;
      html += `<div class="tt-row"><span class="tt-lbl">${lbl}</span><span class="tt-val">${val >= 0 && lbl !== 'Base' ? '+' : ''}${formatCombatNumber(val)}</span></div>`;
    }
    for(const src of getEquippedStatSources(player, statKey)){
      html += `<div class="tt-row"><span class="tt-lbl">${escapeHtmlRoster(src.name)}</span><span class="tt-val">+${formatCombatNumber(src.value)}</span></div>`;
    }
    const cur = Number(rawVal)||0;
    const rem = cur - Number(L.birdBaseline[statKey]||0) - Number(L.fromCardTier?.[statKey]||0) - Number(L.fromLevel?.[statKey]||0) - Number(L.fromUpgrades?.[statKey]||0) - Number(L.fromEquipment?.[statKey]||0);
    if(Math.abs(rem) > 0.05) html += `<div class="tt-row"><span class="tt-lbl">Other</span><span class="tt-val">${rem >= 0 ? '+' : ''}${formatCombatNumber(rem)}</span></div>`;
  }
  for(const line of getDerivedMechanicalBonusLines(player)){
    const showAtk = statKey==='atk' && /attack damage|pierce/i.test(line);
    const showCrit = statKey==='critChance' && /crit/i.test(line);
    if(showAtk || showCrit) html += `<div class="tt-row"><span class="tt-val" style="font-size:.88em">${escapeHtmlRoster(line)}</span></div>`;
  }
  for(const line of getBattleStatModifierLines(statKey)){
    html += `<div class="tt-row"><span class="tt-lbl">Battle</span><span class="tt-val" style="font-size:.88em">${escapeHtmlRoster(line)}</span></div>`;
  }
  html += richTooltipCloseBtn();
  return html;
}
function getEnemyMutationStatSources(enemy, statKey){
  const lines = [];
  const ids = enemy?.mutationIds || [];
  for (const id of ids) {
    const item = typeof Avian?.mutations?.getItem === 'function' ? Avian.mutations.getItem(id) : null;
    const val = Number(item?.stats?.[statKey]) || 0;
    if (!item || Math.abs(val) < 0.0001) continue;
    lines.push({ name: item.name, value: val });
  }
  return lines;
}
function buildEnemyMutationsTooltipHtml(enemy){
  if (!enemy) return '';
  const ids = enemy.mutationIds || [];
  if (!ids.length) return '';
  let html = `<div class="tt-name">${escapeHtmlRoster(enemy.name || 'Enemy')}</div>`;
  html += `<div class="tt-type">Mutations</div>`;
  for (const id of ids) {
    const item = typeof Avian?.mutations?.getItem === 'function' ? Avian.mutations.getItem(id) : null;
    if (!item) continue;
    html += `<div class="tt-row"><span class="tt-lbl">${escapeHtmlRoster(item.name)}</span></div>`;
    const statHtml = getMutationDescHtml(item);
    if(statHtml) html += `<div class="tt-mut-stats" style="margin-bottom:6px">${statHtml}</div>`;
  }
  html += richTooltipCloseBtn();
  return html;
}
function buildEnemyRichStatTooltipHtml(statKey, rawVal, enemy){
  const label = (STAT_LEDGER_LABELS[statKey] || statKey).toUpperCase();
  let html = `<div class="tt-name">${label}</div>`;
  html += `<div class="tt-row"><span class="tt-lbl">Total</span><span class="tt-val">${formatCombatNumber(rawVal)}</span></div>`;
  const base = enemy?._statBaseBeforeMutations;
  if (base && Object.keys(base).length) {
    const bVal = Number(base[statKey]) || 0;
    html += `<div class="tt-row"><span class="tt-lbl">Scaled base</span><span class="tt-val">${formatCombatNumber(bVal)}</span></div>`;
    for (const src of getEnemyMutationStatSources(enemy, statKey)) {
      html += `<div class="tt-row"><span class="tt-lbl">${escapeHtmlRoster(src.name)}</span><span class="tt-val">+${formatCombatNumber(src.value)}</span></div>`;
    }
  }
  if (statKey === 'critChance' && (enemy?._mutationMechanics?.critDamageBonusPct || 0) > 0) {
    html += `<div class="tt-row"><span class="tt-val" style="font-size:.88em">+${enemy._mutationMechanics.critDamageBonusPct}% crit damage on crits</span></div>`;
  }
  html += richTooltipCloseBtn();
  return html;
}
const RICH_TOOLTIP_LONG_PRESS_MS = 500;
const DEFAULT_TOOLTIP_SETTINGS = { abilities: true, mutations: true, items: true, passives: true };
function tooltipsEnabled(category){
  const t = getAccessibilitySettings().tooltips || DEFAULT_TOOLTIP_SETTINGS;
  return t[category] !== false;
}
function showRichTooltipHtml(html, pointerEvt){
  const tt = document.getElementById('action-tooltip');
  if(!tt || !html) return;
  tt.innerHTML = html;
  tt.style.display = 'block';
  tt.classList.toggle('is-touch-open', !!window._isTouchDevice);
  positionTooltip(pointerEvt);
}
function bindRichTooltip(el, getHtml, opts={}){
  if(!el || typeof getHtml!=='function' || el._richTooltipBound) return;
  el._richTooltipBound = true;
  const longPressMs = opts.longPressMs ?? RICH_TOOLTIP_LONG_PRESS_MS;
  let timer = null;
  const category = opts.category;
  const show = (e) => {
    if(category && !tooltipsEnabled(category)) return;
    const html = getHtml();
    if(!html) return;
    showRichTooltipHtml(html, e);
  };
  el.addEventListener('mouseenter', (e) => { if(!window._isTouchDevice) show(e); });
  el.addEventListener('mousemove', (e) => { if(!window._isTouchDevice) moveTooltip(e); });
  el.addEventListener('mouseleave', () => { if(!window._isTouchDevice) hideTooltip(); });
  el.addEventListener('touchstart', (e) => {
    window._isTouchDevice = true;
    timer = setTimeout(() => {
      timer = null;
      const touch = e.touches[0];
      show({ clientX: touch.clientX, clientY: touch.clientY });
    }, longPressMs);
  }, { passive: true });
  el.addEventListener('touchend', () => { if(timer){ clearTimeout(timer); timer = null; } }, { passive: true });
  el.addEventListener('touchmove', () => { if(timer){ clearTimeout(timer); timer = null; } }, { passive: true });
}
function wireNestMutationTooltips(root){
  if(!root) return;
  root.querySelectorAll('[data-nest-item],[data-nest-inv]').forEach(el=>{
    const id = el.dataset.nestItem || el.dataset.nestInv;
    if(!id) return;
    bindRichTooltip(el, () => buildMutationTooltipHTML(id), { category: 'mutations' });
  });
}
function wireCombatStatTooltips(){
  const grid = document.getElementById('player-stats-mini');
  if(!grid) return;
  grid.querySelectorAll('[data-stat-key]').forEach(el=>{
    const key = el.dataset.statKey;
    const raw = Number(el.dataset.statRaw);
    bindRichTooltip(el, () => buildRichStatTooltipHtml(key, raw, G.player));
  });
}
function wireCombatEnemyStatTooltips(){
  const grid = document.getElementById('enemy-stats-mini');
  if(!grid) return;
  grid.querySelectorAll('[data-stat-key]').forEach(el=>{
    const key = el.dataset.statKey;
    const raw = Number(el.dataset.statRaw);
    bindRichTooltip(el, () => buildEnemyRichStatTooltipHtml(key, raw, G.enemy));
  });
}
function wireEnemyMutationTooltips(){
  const wrap = document.getElementById('enemy-avatar-wrap');
  if(!wrap) return;
  bindRichTooltip(wrap, () => buildEnemyMutationsTooltipHtml(G.enemy), { category: 'mutations' });
}
function getDerivedMechanicalBonusLines(player){
  if(!player) return [];
  const lines = [];
  const p = player;
  const pct = v=>Math.round((Number(v)||0)*100);
  if((p.firstAttackEachBattleBonusPct||0)>0) lines.push(`+${pct(p.firstAttackEachBattleBonusPct)}% first attack damage (battle)`);
  if((p.firstAttackEachTurnBonusPct||0)>0) lines.push(`+${pct(p.firstAttackEachTurnBonusPct)}% first physical hit per turn`);
  if((p.poisonExtraTurns||0)>0) lines.push(`+${p.poisonExtraTurns} poison duration (turns)`);
  if((p.poisonTickMult||1)>1.0001) lines.push(`+${pct((p.poisonTickMult||1)-1)}% poison tick damage`);
  if((p.poisonFlatBonus||0)>0) lines.push(`+${p.poisonFlatBonus} poison tick damage (flat)`);
  if((p.critDamageBonusPct||0)>0) lines.push(`+${pct(p.critDamageBonusPct)} added to crit multiplier on crits`);
  if((p.firstAttackAccBonus||0)>0) lines.push(`+${p.firstAttackAccBonus}% hit chance (first attack only)`);
  if((p.hitChanceBonus||0)>0) lines.push(`+${p.hitChanceBonus}% hit chance (skills)`);
  if((p.chillOnSpellChance||0)>0) lines.push(`${p.chillOnSpellChance}% chill on spell hit`);
  if((p.chillExtraTurns||0)>0) lines.push(`+${p.chillExtraTurns} chill duration`);
  if((p.vsPoisonPctBonus||0)>0) lines.push(`+${pct(p.vsPoisonPctBonus)}% damage vs poisoned`);
  if((p.vsChillPctBonus||0)>0) lines.push(`+${pct(p.vsChillPctBonus)}% damage vs chilled`);
  if((p.vsChillSpellPctBonus||0)>0) lines.push(`+${pct(p.vsChillSpellPctBonus)}% spell damage vs chilled`);
  if((p.vsAfflictedPctBonus||0)>0) lines.push(`+${pct(p.vsAfflictedPctBonus)}% damage vs afflicted`);
  if((p.vsMultiAfflictedPctBonus||0)>0) lines.push(`+${pct(p.vsMultiAfflictedPctBonus)}% vs ${Math.max(2,Number(p.vsMultiAfflictedMinAilments)||2)}+ ailments`);
  if((p.critVsAfflictedBonusPct||0)>0) lines.push(`+${pct(p.critVsAfflictedBonusPct)} crit damage vs afflicted`);
  if((p.damagePerAilmentPct||0)>0 && (p.damagePerAilmentPctCap||0)>0) lines.push(`+${pct(p.damagePerAilmentPct)}%/ailment (cap +${pct(p.damagePerAilmentPctCap)})`);
  if((p.augAttackDmgPct||0)>0) lines.push(`+${pct(p.augAttackDmgPct)}% attack-skill damage`);
  if((p.augSpellAcc||0)>0) lines.push(`+${p.augSpellAcc}% spell hit chance (Endless augment)`);
  if((p.augAttackAcc||0)>0) lines.push(`+${p.augAttackAcc}% attack-skill hit chance (Endless augment)`);
  if(p.firstAttackFree) lines.push('First attack each battle costs 0 EN');
  if(p.firstSpellFree) lines.push('First spell each battle costs 0 EN');
  if((p.augFirstSpellCostDown||0)>0) lines.push(`First spell each battle costs ${p.augFirstSpellCostDown} less EN`);
  if((p.augSpellDmgPct||0)>0) lines.push(`+${pct(p.augSpellDmgPct)}% spell damage`);
  if((p.firstHitReduce||0)>0) lines.push(`First hit each battle: −${pct(p.firstHitReduce)}% damage taken`);
  if((p.vsBleedPctBonus||0)>0) lines.push(`+${pct(p.vsBleedPctBonus)}% damage vs bleeding`);
  if((p.openingEnemyFear||0)>0) lines.push(`Enemies start with Fear(${p.openingEnemyFear})`);
  const mRoll = typeof Avian?.mutations?.getMechanicsRollup==='function' ? Avian.mutations.getMechanicsRollup(p) : null;
  if(mRoll){
    if((mRoll.lightAttackDmgPct||0)>0) lines.push(`+${mRoll.lightAttackDmgPct}% light attack damage (mutations)`);
    if((mRoll.mediumAttackDmgPct||0)>0) lines.push(`+${mRoll.mediumAttackDmgPct}% medium attack damage (mutations)`);
    if((mRoll.heavyAttackDmgPct||0)>0) lines.push(`+${mRoll.heavyAttackDmgPct}% heavy attack damage (mutations)`);
    if((mRoll.multiHitDmgPct||0)>0) lines.push(`+${mRoll.multiHitDmgPct}% multi-hit damage (mutations)`);
    if((mRoll.critDamageBonusPct||0)>0) lines.push(`+${mRoll.critDamageBonusPct}% crit damage (mutations)`);
  }
  if((p.stats?.armorPen||0)>0) lines.push(`+${p.stats.armorPen}% armour penetration`);
  if((p.stats?.magicPen||0)>0) lines.push(`+${p.stats.magicPen}% magic penetration`);
  return lines;
}


const ENDLESS_SKILL_AUGMENTS = [
  {id:'aug_razor_edge',name:'Razor Edge',tier:'blue',type:'augment',desc:'Endless only — Attack skills deal +20% damage to Bleeding enemies.',apply:p=>{p.augAttackVsBleedPct=(p.augAttackVsBleedPct||0)+0.20;}},
  {id:'aug_pinpoint_strike',name:'Pinpoint Strike',tier:'green',type:'augment',desc:'Endless only — Attack skills gain +12% hit chance.',apply:p=>{p.augAttackAcc=(p.augAttackAcc||0)+12;}},
  {id:'aug_blood_trigger',name:'Blood Trigger',tier:'green',type:'augment',desc:'Endless only — Attack-skill crits apply Bleed(1).',apply:p=>{p.augCritBleed=(p.augCritBleed||0)+1;}},
  {id:'aug_piercing_talon',name:'Piercing Talon',tier:'blue',type:'augment',desc:'Endless only — Attack skills ignore 15% DEF.',apply:p=>{p.augAttackPiercePct=(p.augAttackPiercePct||0)+0.15;}},
  {id:'aug_ambush_claw',name:'Ambush Claw',tier:'blue',type:'augment',desc:'Endless only — First attack skill each battle deals +35% damage.',apply:p=>{p.augFirstAttackBattlePct=(p.augFirstAttackBattlePct||0)+0.35;}},
  {id:'aug_execution_line',name:'Execution Line',tier:'blue',type:'augment',desc:'Endless only — Attack skills deal +25% damage to enemies below 50% HP.',apply:p=>{p.augAttackExecutePct=(p.augAttackExecutePct||0)+0.25;}},
  {id:'aug_hunters_mark',name:"Hunter's Mark",tier:'green',type:'augment',desc:'Endless only — Attack skills that hit grant next attack +10% damage this battle.',apply:p=>{p.augHuntersMarkPct=(p.augHuntersMarkPct||0)+0.10;}},
  {id:'aug_serrated_finish',name:'Serrated Finish',tier:'green',type:'augment',desc:'Endless only — Attack skills have 20% chance to apply Bleed(1).',apply:p=>{p.augAttackBleedChance=(p.augAttackBleedChance||0)+20;}},
  {id:'aug_fatal_rhythm',name:'Fatal Rhythm',tier:'purple',type:'augment',desc:'Endless only — Every third attack skill use deals +40% damage.',apply:p=>{p.augThirdAttackPct=0.40;}},
  {id:'aug_sky_lunge',name:'Sky Lunge',tier:'green',type:'augment',desc:'Endless only — Attack skills gain +10% crit chance.',apply:p=>{p.augAttackCrit=(p.augAttackCrit||0)+10;}},
  {id:'aug_runic_burst',name:'Runic Burst',tier:'blue',type:'augment',desc:'Endless only — Spell skills deal +18% damage.',apply:p=>{p.augSpellDmgPct=(p.augSpellDmgPct||0)+0.18;}},
  {id:'aug_venom_verse',name:'Venom Verse',tier:'green',type:'augment',desc:'Endless only — Spell skills apply Poison(1) on hit.',apply:p=>{p.augSpellPoison=true;}},
  {id:'aug_dread_verse',name:'Dread Verse',tier:'blue',type:'augment',desc:'Endless only — First spell each battle applies Fear(1).',apply:p=>{p.augFirstSpellFear=true;}},
  {id:'aug_arcane_accuracy',name:'Arcane Accuracy',tier:'green',type:'augment',desc:'Endless only — Spell skills gain +14% hit chance.',apply:p=>{p.augSpellAcc=(p.augSpellAcc||0)+14;}},
  {id:'aug_mana_rend',name:'Mana Rend',tier:'blue',type:'augment',desc:'Endless only — Spell skills ignore 15% MDEF.',apply:p=>{p.augSpellPiercePct=(p.augSpellPiercePct||0)+0.15;}},
  {id:'aug_echo_rune',name:'Echo Rune',tier:'purple',type:'augment',desc:'Endless only — Every fourth spell repeats at 40% power.',apply:p=>{p.augFourthSpellEcho=0.40;}},
  {id:'aug_withering_chant',name:'Withering Chant',tier:'blue',type:'augment',desc:'Endless only — Spells deal +25% damage to Poisoned enemies.',apply:p=>{p.augSpellVsPoisonPct=(p.augSpellVsPoisonPct||0)+0.25;}},
  {id:'aug_soul_pressure',name:'Soul Pressure',tier:'blue',type:'augment',desc:'Endless only — Spells deal +20% damage to Feared enemies.',apply:p=>{p.augSpellVsFearPct=(p.augSpellVsFearPct||0)+0.20;}},
  {id:'aug_arc_surge',name:'Arc Surge',tier:'green',type:'augment',desc:'Endless only — First spell each battle costs 1 less Energy.',apply:p=>{p.augFirstSpellCostDown=1;}},
  {id:'aug_hex_bloom',name:'Hex Bloom',tier:'green',type:'augment',desc:'Endless only — Spell crits apply Poison(1).',apply:p=>{p.augSpellCritPoison=true;}},
  {id:'aug_guard_timing',name:'Guard Timing',tier:'green',type:'augment',desc:'Endless only — Defensive skills grant +1 DEF this turn.',apply:p=>{p.augDefSkillDef=(p.augDefSkillDef||0)+1;}},
  {id:'aug_spell_shell',name:'Spell Shell',tier:'green',type:'augment',desc:'Endless only — Defensive skills grant +1 MDEF this turn.',apply:p=>{p.augDefSkillMdef=(p.augDefSkillMdef||0)+1;}},
  {id:'aug_recovery_feather',name:'Recovery Feather',tier:'green',type:'augment',desc:'Endless only — Using a defensive skill heals 3 HP.',apply:p=>{p.augDefSkillHeal=(p.augDefSkillHeal||0)+3;}},
  {id:'aug_evasive_drift',name:'Evasive Drift',tier:'green',type:'augment',desc:'Endless only — Defensive skills grant +6% Dodge this turn.',apply:p=>{p.augDefSkillDodge=(p.augDefSkillDodge||0)+6;}},
  {id:'aug_clear_mind',name:'Clear Mind',tier:'green',type:'augment',desc:'Endless only — Defensive skills remove Fear from you.',apply:p=>{p.augDefSkillClearFear=true;}},
  {id:'aug_rebound_plumage',name:'Rebound Plumage',tier:'blue',type:'augment',desc:'Endless only — After defensive skill, next attack +15% damage.',apply:p=>{p.augPostDefAtkPct=(p.augPostDefAtkPct||0)+0.15;}},
  {id:'aug_patient_hunter',name:'Patient Hunter',tier:'blue',type:'augment',desc:'Endless only — After defensive skill, next attack +10% hit chance.',apply:p=>{p.augPostDefAcc=(p.augPostDefAcc||0)+10;}},
  {id:'aug_iron_resolve',name:'Iron Resolve',tier:'purple',type:'augment',desc:'Endless only — First defensive skill each battle grants -20% damage taken for 1 turn.',apply:p=>{p.augIronResolve=true;}},
  {id:'aug_feather_reserve',name:'Feather Reserve',tier:'blue',type:'augment',desc:'Endless only — Defensive skill has 25% chance to refund 1 Energy.',apply:p=>{p.augDefSkillRefund=25;}},
  {id:'aug_counter_instinct',name:'Counter Instinct',tier:'purple',type:'augment',desc:'Endless only — After defensive skill, if enemy attacks next turn they gain Bleed(1).',apply:p=>{p.augCounterInstinct=true;}},
];

const ENDLESS_RELICS = [
  {id:'rel_endless_talon',name:'Endless Talon',tier:'grey',type:'relic',desc:'Endless only — Every 5 endless battles, gain +1 ATK.',apply:p=>{p.relEndlessTalon=true;}},
  {id:'rel_endless_plumage',name:'Endless Plumage',tier:'grey',type:'relic',desc:'Endless only — Every 5 endless battles, gain +1 DEF.',apply:p=>{p.relEndlessPlumage=true;}},
  {id:'rel_endless_verse',name:'Endless Verse',tier:'grey',type:'relic',desc:'Endless only — Every 5 endless battles, gain +1 MATK.',apply:p=>{p.relEndlessVerse=true;}},
  {id:'rel_endless_ward',name:'Endless Ward',tier:'grey',type:'relic',desc:'Endless only — Every 5 endless battles, gain +1 MDEF.',apply:p=>{p.relEndlessWard=true;}},
  {id:'rel_long_hunt',name:'Long Hunt',tier:'green',type:'relic',desc:'Endless only — Every 6 endless battles, gain +1 SPD.',apply:p=>{p.relLongHunt=true;}},
  {id:'rel_predatory_memory',name:'Predatory Memory',tier:'green',type:'relic',desc:'Endless only — Start boss battles with +1 Energy.',apply:p=>{p.relPredatoryMemory=true;}},
  {id:'rel_battle_carcass',name:'Battle Carcass',tier:'green',type:'relic',desc:'Endless only — Heal 4 HP after each boss battle.',apply:p=>{p.relBattleCarcass=true;}},
  {id:'rel_tension_coil',name:'Tension Coil',tier:'green',type:'relic',desc:'Endless only — If battle starts below 50% HP, gain +15% damage.',apply:p=>{p.relTensionCoil=true;}},
  {id:'rel_carrion_ledger',name:'Carrion Ledger',tier:'blue',type:'relic',desc:'Endless only — Bleeding enemies take +1 attack damage.',apply:p=>{p.relCarrionLedger=true;}},
  {id:'rel_venom_ledger',name:'Venom Ledger',tier:'blue',type:'relic',desc:'Endless only — Poison you apply deals +1 extra damage.',apply:p=>{p.relVenomLedger=true;}},
  {id:'rel_terror_ledger',name:'Terror Ledger',tier:'blue',type:'relic',desc:'Endless only — Feared enemies deal -10% damage.',apply:p=>{p.relTerrorLedger=true;}},
  {id:'rel_duel_record',name:'Duel Record',tier:'blue',type:'relic',desc:'Endless only — Every 3 endless wins, gain +1% crit chance.',apply:p=>{p.relDuelRecord=true;}},
  {id:'rel_wind_ledger',name:'Wind Ledger',tier:'blue',type:'relic',desc:'Endless only — Every 4 battles, first attack +10% dmg (stacks to +50% until boss).',apply:p=>{p.relWindLedger=true;}},
  {id:'rel_hawk_ledger',name:'Hawk Ledger',tier:'blue',type:'relic',desc:'Endless only — Gain +8% hit chance at endless milestone thresholds.',apply:p=>{p.relHawkLedger=true;}},
  {id:'rel_iron_ledger',name:'Iron Ledger',tier:'blue',type:'relic',desc:'Endless only — First hit taken each battle deals -12% damage.',apply:p=>{p.relIronLedger=true;}},
  {id:'rel_predators_archive',name:"Predator's Archive",tier:'purple',type:'relic',desc:'Endless only — After every boss kill, gain +1 ATK and +1 MATK.',apply:p=>{p.relPredatorsArchive=true;}},
  {id:'rel_molting_doctrine',name:'Molting Doctrine',tier:'purple',type:'relic',desc:'Endless only — Every 8 endless battles, gain +5 Max HP.',apply:p=>{p.relMoltingDoctrine=true;}},
  {id:'rel_feathered_clock',name:'Feathered Clock',tier:'purple',type:'relic',desc:'Endless only — Every third battle, start with +1 Energy.',apply:p=>{p.relFeatheredClock=true;}},
  {id:'rel_endless_thesis',name:'Endless Thesis',tier:'purple',type:'relic',desc:'Endless only — Endless reward choices guarantee one Blue+ option.',apply:p=>{p.relEndlessThesis=true;}},
  {id:'rel_crown_long_hunt',name:'Crown of the Long Hunt',tier:'gold',type:'relic',desc:'Endless only — After each boss kill, gain a random crown stat boon.',apply:p=>{p.relCrownLongHunt=true;}},
];

const ENDLESS_MUTATIONS = [
  {id:'mut_blood_moon',name:'Blood Moon',tier:'purple',type:'mutation',desc:'Endless only — Bleed you apply deals double damage, but enemies gain +10% ATK.',apply:p=>{p.mutBloodMoon=true;}},
  {id:'mut_venom_season',name:'Venom Season',tier:'purple',type:'mutation',desc:'Endless only — Poison lasts +1 turn, but Max HP -10%.',apply:p=>{p.mutVenomSeason=true;p.stats.maxHp=Math.max(1,Math.floor(p.stats.maxHp*0.9));p.stats.hp=Math.min(p.stats.hp,p.stats.maxHp);}},
  {id:'mut_gale_tempo',name:'Gale Exchange',tier:'purple',type:'mutation',desc:'Endless only — SPD bonuses doubled, Dodge bonuses halved.',apply:p=>{p.mutGaleTempo=true;}},
  {id:'mut_arc_overload',name:'Arc Overload',tier:'purple',type:'mutation',desc:'Endless only — Spells deal +30% damage, but cost +1 Energy.',apply:p=>{p.mutArcOverload=true;}},
  {id:'mut_hunters_cruelty',name:"Hunter's Cruelty",tier:'purple',type:'mutation',desc:'Endless only — +20% execute damage (<50% HP), but post-battle healing halved.',apply:p=>{p.mutHuntersCruelty=true;}},
  {id:'mut_iron_sky',name:'Iron Sky',tier:'purple',type:'mutation',desc:'Endless only — +2 DEF and +2 MDEF, but -2 SPD.',apply:p=>{p.mutIronSky=true;p.stats.def+=2;p.stats.mdef=(p.stats.mdef||0)+2;p.stats.spd=Math.max(1,(p.stats.spd||1)-2);}},
  {id:'mut_sudden_flight',name:'Sudden Flight',tier:'purple',type:'mutation',desc:'Endless only — First action each battle +25% effectiveness.',apply:p=>{p.mutSuddenFlight=true;}},
  {id:'mut_dark_chorus',name:'Dark Chorus',tier:'purple',type:'mutation',desc:'Endless only — Fear lasts +1 turn, but Crit Chance -8%.',apply:p=>{p.mutDarkChorus=true;p.stats.critChance=Math.max(0,(p.stats.critChance||0)-8);}},
  {id:'mut_razor_instinct',name:'Razor Instinct',tier:'purple',type:'mutation',desc:'Endless only — Crit damage +40%, but non-crits deal -10%.',apply:p=>{p.mutRazorInstinct=true;}},
  {id:'mut_long_war',name:'Long War',tier:'gold',type:'mutation',desc:'Endless only — Every 5 endless battles gain +1 random stat, but shop costs +15%.',apply:p=>{p.mutLongWar=true;}},
];

function isEndlessRunActive(){ return !!(G.endlessMode && (G.stage||0)>20); }
const PASSIVE_EVOLUTION_MILESTONES = Object.freeze({ evo1:10, evo2:25 });
const PASSIVE_EVOLUTION_TEMPLATE = Object.freeze({
  stage1: {
    offensive:{ name:'Swift Instinct', effect:'Offense Path: Your passive gains +15% damage output.' },
    utility:{ name:'Relentless Instinct', effect:'Utility Path: +1 SPD and 8% damage reduction from passive evolution.' },
  },
  stage2: {
    offensive:{ name:'Predator Instinct', effect:'Offense Path: +25% damage, +10% crit chance, +12% pierce from passive evolution.' },
    utility:{ name:'Storm Instinct', effect:'Utility Path: +2 SPD total, 15% damage reduction, +10% control chance from passive evolution.' },
  }
});
const PASSIVE_EVOLUTION_DEFS = Object.create(null); /* Combat rewrite: populated at boot from combat-pack endless passives. */
function getPassiveEvolutionDefinition(passive){
  const id=String(passive?.id||'').trim();
  const base=passive?.name||'Unknown Passive';
  const specific=PASSIVE_EVOLUTION_DEFS[id];
  if(specific) return specific;
  return {
    base,
    stage1:[
      {name:PASSIVE_EVOLUTION_TEMPLATE.stage1.offensive.name,effect:PASSIVE_EVOLUTION_TEMPLATE.stage1.offensive.effect,path:'offensive'},
      {name:PASSIVE_EVOLUTION_TEMPLATE.stage1.utility.name,effect:PASSIVE_EVOLUTION_TEMPLATE.stage1.utility.effect,path:'utility'},
    ],
    stage2:[
      {name:PASSIVE_EVOLUTION_TEMPLATE.stage2.offensive.name,effect:PASSIVE_EVOLUTION_TEMPLATE.stage2.offensive.effect,path:'offensive'},
      {name:PASSIVE_EVOLUTION_TEMPLATE.stage2.utility.name,effect:PASSIVE_EVOLUTION_TEMPLATE.stage2.utility.effect,path:'utility'},
    ],
  };
}
function ensurePassiveEvolutionState(player=G.player){
  if(!player) return null;
  if(!player.passiveEvolution || typeof player.passiveEvolution!=='object'){
    player.passiveEvolution={tier:0,choices:{},pathHistory:[]};
  }
  if(!player.passiveEvolution.choices || typeof player.passiveEvolution.choices!=='object') player.passiveEvolution.choices={};
  if(!Array.isArray(player.passiveEvolution.pathHistory)) player.passiveEvolution.pathHistory=[];
  player.passiveEvolution.tier=Math.max(0,Math.min(2,Number(player.passiveEvolution.tier||0)));
  return player.passiveEvolution;
}
function getPassiveEvolutionBonuses(player=G.player){
  const pe=ensurePassiveEvolutionState(player);
  const out={damagePct:0,critFlat:0,piercePct:0,spdFlat:0,drPct:0,controlPct:0};
  if(!pe) return out;
  const c1=pe.choices?.[1];
  const c2=pe.choices?.[2];
  if(c1==='offensive'){ out.damagePct+=0.15; }
  if(c1==='utility'){ out.spdFlat+=1; out.drPct+=0.08; }
  if(c2==='offensive'){ out.damagePct+=0.25; out.critFlat+=10; out.piercePct+=12; }
  if(c2==='utility'){ out.spdFlat+=1; out.drPct+=0.15; out.controlPct+=0.10; }
  return out;
}
function getPassiveDefMdefBonuses(){
  let def=0,mdef=0;
  const p=G.player, bd=BIRDS[p?.birdKey], id=bd?.passive?.id;
  if(!p?.stats) return {def,mdef};
  const hp=p.stats.hp||0, mx=Math.max(1,p.stats.maxHp||1);
  if(id==='passive_swan_regal_bearing' && hp>mx*0.7){ def+=4; mdef+=4; }
  if(id==='passive_penguin_icebound_plating' && hp>mx*0.5) mdef+=4;
  if(id==='passive_bushturkey_scrapper' && hp<=mx*0.5) def+=4;
  return {def,mdef};
}
function getEndlessRewardPool(type){
  if(type==='augment') return ENDLESS_SKILL_AUGMENTS;
  if(type==='mutation') return ENDLESS_MUTATIONS;
  return ENDLESS_RELICS;
}
function hasEndlessReward(id){
  const seen=(G.player?.endlessRewards||[]).map(x=>x.id);
  return seen.includes(id);
}
function buildEndlessRewardCard(entry){
  return {
    id:entry.id,
    tier:entry.tier||'blue',
    icon:entry.type==='mutation'?'🧬':entry.type==='augment'?'🪶':'🗿',
    name:entry.name,
    desc:entry.desc,
    endlessOnly:true,
    apply:p=>{
      if(!isEndlessRunActive()) return;
      if(!p.endlessRewards) p.endlessRewards=[];
      if(p.endlessRewards.some(x=>x.id===entry.id)) return;
      p.endlessRewards.push({id:entry.id,type:entry.type,name:entry.name});
      entry.apply?.(p);
    }
  };
}
function rollEndlessReward(kind='relic'){
  if(typeof Avian?.mutations?.rollMutationReward!=='function') return null;
  const tier = kind==='mutation' ? 'purple' : (kind==='augment' ? 'blue' : 'green');
  return Avian.mutations.rollMutationReward({ tier, stage: G.stage, isBoss: !!(G.enemy && G.enemy.isBoss) });
}
function applyEndlessProgressionMilestones(){
  // Mutation milestones removed — rewards come from buildMutationRewardPool() after each battle.
}

function rollUpgradeCard(){
  if(typeof Avian?.mutations?.rollMutationReward==='function'){
    return Avian.mutations.rollMutationReward({ stage: G.stage, isBoss: !!(G.enemy && G.enemy.isBoss) });
  }
  return null;
}

const REWARD_TIERS = {
  grey:{label:'Common', color:'grey'},
  white:{label:'Common', color:'grey'},
  green:{label:'Uncommon', color:'green'},
  blue:{label:'Rare', color:'blue'},
  purple:{label:'Epic', color:'purple'},
  gold:{label:'Legendary', color:'gold'},
};
function normalizeRewardTier(tier){
  const t=String(tier||'grey').toLowerCase();
  if(t==='white') return 'grey';
  return REWARD_TIERS[t]?t:'grey';
}
function rewardTierMeta(tier){
  const key=normalizeRewardTier(tier);
  return REWARD_TIERS[key]||REWARD_TIERS.grey;
}

const CLASS_ROLE_BY_CLASS = {
  knight:'knight', rogue:'rogue', mage:'mage', siren:'siren', inquisitor:'inquisitor', bard:'bard',
  striker:'rogue', bruiser:'knight', tank:'knight', trickster:'bard', predator:'inquisitor', singer:'mage',
};

const FINAL_BIRD_CLASS_BY_KEY = Object.freeze({});

function normalizeBirdClassKey(birdKey=''){
  return String(birdKey||'').toLowerCase().replace(/[^a-z_]/g,'');
}

function getFinalBirdClass(birdKey='', fallback=''){
  const normalizedKey = normalizeBirdClassKey(birdKey);
  if(normalizedKey && FINAL_BIRD_CLASS_BY_KEY[normalizedKey]) return FINAL_BIRD_CLASS_BY_KEY[normalizedKey];
  const rawFallback = String(fallback||'').toLowerCase();
  return CLASS_ROLE_BY_CLASS[rawFallback] || '';
}

function normalizeAllowedClassList(list=[]){
  if(!Array.isArray(list)) return [];
  const out=[];
  list.forEach(cls=>{
    const normalized = resolveFinalClass(cls);
    if(normalized && !out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function sanitizeAbilityClassRouting(store){
  if(!store || typeof store!=='object') return;
  Object.values(store).forEach(tmpl=>{
    if(Array.isArray(tmpl?.allowedClasses)){
      tmpl.allowedClasses = normalizeAllowedClassList(tmpl.allowedClasses);
    }
  });
}


const LEGACY_CLASS_FALLBACK = {
  support:'mage', summoner:'bard', defender:'knight', vanguard:'knight',
  skirmisher:'rogue', assassin:'rogue', ranger:'bard', tyrant:'inquisitor',
};

function resolveFinalClass(rawClass='', birdKey=''){
  const cls=String(rawClass||'').toLowerCase().split(/\s+/)[0];
  const key=String(birdKey||'');
  const birdCls=BIRDS?.[key]?.class;
  if(birdCls) return CLASS_ROLE_BY_CLASS[String(birdCls).toLowerCase().split(/\s+/)[0]] || birdCls;
  const mappedBirdClass=getFinalBirdClass(key, cls);
  if(mappedBirdClass) return mappedBirdClass;
  return CLASS_ROLE_BY_CLASS[cls] || LEGACY_CLASS_FALLBACK[cls] || 'rogue';
}


/* Combat rewrite: legacy CLASS_PERK_DEFS / CLASS_PERK_BY_CLASS / CLASS_PERK_SOURCE_RULES tables removed. Bird passives (combat-pack/bird-passives.js) drive class-style behaviour through js/systems/passive-hooks.js. */
const CLASS_PERK_DEFS         = Object.create(null);
const CLASS_PERK_BY_CLASS     = CLASS_PERK_DEFS;
const CLASS_PERK_SOURCE_RULES = Object.create(null);

function ensureClassPerkState(target=G){
  if(!target || typeof target!=='object') return {classPerks:{}, runClassPerks:[]};
  if(!target.classPerks || typeof target.classPerks!=='object') target.classPerks={};
  if(!Array.isArray(target.runClassPerks)) target.runClassPerks=[];
  return target;
}

function normalizeClassPerkIdList(list=[]){
  return [...new Set((Array.isArray(list)?list:[]).map(id=>String(id||'').trim()).filter(Boolean))];
}

function getBirdClassRoleByKey(birdKey=''){
  return resolveFinalClass(BIRDS?.[birdKey]?.class || '', birdKey);
}

function getBirdClassPerks(birdKey){
  const state=ensureClassPerkState(G);
  const normalizedKey=String(birdKey || G.player?.birdKey || '').trim();
  return normalizeClassPerkIdList(state.classPerks[normalizedKey]||[]);
}

function hasClassPerk(birdKey, perkId){
  return getBirdClassPerks(birdKey).includes(String(perkId||''));
}

function getClassPerkGrantCountForMode(mode){
  const key=(mode==='endless') ? 'endless' : 'story';
  const granted=(G.runClassPerks||[]).filter(entry=>{
    const source=String(entry?.source||'');
    const cfg=CLASS_PERK_SOURCE_RULES[source];
    return cfg ? cfg.mode===key : key==='story';
  }).length;
  return granted;
}

function getClassPerkCapForMode(mode){
  return mode==='endless' ? 2 : 1;
}

function getAvailableClassPerksForBird(birdKey){
  const normalizedBirdKey=String(birdKey || G.player?.birdKey || '').trim();
  const role=getBirdClassRoleByKey(normalizedBirdKey);
  const owned=new Set(getBirdClassPerks(normalizedBirdKey));
  return (CLASS_PERK_BY_CLASS[role]||[]).filter(perk=>perk && perk.id && !owned.has(perk.id));
}

function applyClassPerksToStats(birdKey, player=G.player){
  if(!player || !birdKey) return player;
  const owned=new Set(getBirdClassPerks(birdKey));
  if(!player._appliedClassPerkIds || typeof player._appliedClassPerkIds!=='object') player._appliedClassPerkIds={};
  const applied=player._appliedClassPerkIds;
  (CLASS_PERK_BY_CLASS[getBirdClassRoleByKey(birdKey)]||[]).forEach(perk=>{
    if(!owned.has(perk.id) || applied[perk.id]) return;
    perk.apply?.(player);
    applied[perk.id]=true;
  });
  return player;
}

function applyClassPerksToCombatContext(birdKey, context={}){
  const owned=new Set(getBirdClassPerks(birdKey));
  const out={...context};
  out.piercingTempo = owned.has('piercingTempo');
  out.openingRush = owned.has('openingRush');
  out.predatorRhythm = owned.has('predatorRhythm');
  out.crushingForce = owned.has('crushingForce');
  out.warBody = owned.has('warBody');
  out.ironMomentum = owned.has('ironMomentum');
  out.ironCore = owned.has('ironCore');
  out.holdTheLine = owned.has('holdTheLine');
  out.slipstream = owned.has('slipstream');
  out.falseOpening = owned.has('falseOpening');
  out.quickTheft = owned.has('quickTheft');
  out.markedForDeath = owned.has('markedForDeath');
  out.patientHunter = owned.has('patientHunter');
  out.executionLine = owned.has('executionLine');
  out.arcFocus = owned.has('arcFocus');
  out.songline = owned.has('songline');
  out.restorativeRhythm = owned.has('restorativeRhythm');
  out.buffDurationBonus = (out.songline ? 1 : 0);
  out.songHealFlat = (out.restorativeRhythm ? 3 : 0);
  return out;
}

function recomputeClassPerkEffects(){
  ensureClassPerkState(G);
  if(!G.player?.birdKey) return;
  applyClassPerksToStats(G.player.birdKey, G.player);
}

function getPlayerClassPerkBuffDurationBonus(){
  const ctx=applyClassPerksToCombatContext(G.player?.birdKey,{});
  return ctx.buffDurationBonus||0;
}

function getPlayerClassPerkSongHealFlat(){
  const ctx=applyClassPerksToCombatContext(G.player?.birdKey,{});
  return ctx.songHealFlat||0;
}

function grantClassPerk(birdKey, perkDef, source=''){
  const normalizedBirdKey=String(birdKey || G.player?.birdKey || '').trim();
  const perkId=String(perkDef?.id || '').trim();
  if(!normalizedBirdKey || !perkId || hasClassPerk(normalizedBirdKey, perkId)) return false;
  const state=ensureClassPerkState(G);
  if(!Array.isArray(state.classPerks[normalizedBirdKey])) state.classPerks[normalizedBirdKey]=[];
  state.classPerks[normalizedBirdKey].push(perkId);
  state.classPerks[normalizedBirdKey]=normalizeClassPerkIdList(state.classPerks[normalizedBirdKey]);
  state.runClassPerks.push({birdKey:normalizedBirdKey,classPerkId:perkId,source:String(source||'manual-class-perk')});
  if(source && CLASS_PERK_SOURCE_RULES[source]){
    G._classPerkChoicesGranted=Math.max(G._classPerkChoicesGranted||0,getClassPerkGrantCountForMode(CLASS_PERK_SOURCE_RULES[source].mode));
  }
  recomputeClassPerkEffects();
  logMsg(`🧬 Class Perk acquired: ${perkDef?.name||perkId}.`,'exp-gain');
  saveRun();
  return true;
}

// Drop rate weights (non-boss) — [grey,green,blue,purple,gold]
const NORMAL_WEIGHTS = [42,34,17,7,0];

// Boss drop weights (fallback; boss rewards are mostly handled by generateBossRewards)
const BOSS_WEIGHTS   = [2,4,42,52,0];

// Post-combat reward picks use UPGRADE_CARDS_REWORK via rollUpgradeCard / generateBossRewards.

// ============================================================
//  LEARNABLE ABILITIES — universal abilities gained at level-up
// ============================================================
/* Combat rewrite: ABILITY_TEMPLATES_LEARNABLE + skipTurn + sittingDuck removed. The combat-pack is the only source of ability data. */

// 20 NEW LEARNABLE ABILITIES
/* Combat rewrite: ABILITY_TEMPLATES_EXTRA removed. */

// ============================================================
//  MAGIC ABILITIES (from CSV) — for songbird/corvid builds
// ============================================================
/* Combat rewrite: ABILITY_TEMPLATES_MAGIC + LEARNABLE merge removed. */

function makeAbilityLevelData(entries=[]){
  const items = Array.isArray(entries) ? entries.slice(0,4) : [];
  if(!items.length) items.push({desc:'No effect.'});
  while(items.length<4){
    items.push({...items[items.length-1]});
  }
  return items.slice(0,4).map((entry, idx)=>({lv:idx+1, ...entry, lv:idx+1}));
}

function makeEvolutionAbilityTemplate(id, name, desc, options={}){
  const energy = Number.isFinite(options.energy) ? options.energy : 1;
  const type = options.type || 'physical';
  const btnType = options.btnType || type;
  const tpl = {
    id,
    name,
    desc,
    type,
    btnType,
    energyCost: energy,
    energyByLevel: [energy, energy, energy, energy],
    cooldownByLevel: Array.isArray(options.cooldownByLevel) ? options.cooldownByLevel.slice(0,4) : [0,0,0,0],
    fixedMainAttackCost: !!options.fixedMainAttackCost,
    role: Array.isArray(options.role) ? options.role.slice() : [],
    levels: makeAbilityLevelData(options.levels || [{desc}]),
  };
  if(options.damageScaling && typeof options.damageScaling==='object') tpl.damageScaling = options.damageScaling;
  return tpl;
}

Object.assign(ABILITY_TEMPLATES.multiPeck||{}, {
  desc:'Multi Peck-line base. Two-armor pecks before branching.',
  energyCost:2,
  energyByLevel:[2,2,2,2],
  fixedMainAttackCost:true,
  role:['multiHit'],
  levels:makeAbilityLevelData([
    {desc:'2 hits; each Base 2 + 45% ATK; 15% pierce.'},
    {desc:'2 hits; tuned rhythm.'},
    {desc:'2 hits; tuned rhythm.'},
    {desc:'2 hits; peak opener.'},
  ]),
});
Object.assign(ABILITY_TEMPLATES.rapidPeck||{}, {
  desc:'Rapid-line burst. Three precise pecks with pierce focus.',
  energyCost:2,
  energyByLevel:[2,2,2,2],
  fixedMainAttackCost:true,
  role:['multiHit'],
  levels:makeAbilityLevelData([
    {desc:'3 hits at 45% dmg each. Pierce 10% DEF.'},
    {desc:'3 hits at 52% dmg each. Pierce 12% DEF.'},
    {desc:'3 hits at 58% dmg each. Pierce 14% DEF.'},
    {desc:'4 hits at 58% dmg each. Pierce 16% DEF.'},
  ]),
});
Object.assign(ABILITY_TEMPLATES.trackPrey||{}, {
  desc:'Trail Sense base. SPD + accuracy tempo before branching.',
  energyCost:2,
  energyByLevel:[2,2,2,2],
  cooldownByLevel:[1,1,1,1],
  levels:makeAbilityLevelData([
    {desc:'+12 SPD and +12% accuracy for 2t (refresh).'},
    {desc:'Stronger tempo.'},
    {desc:'Stronger tempo.'},
    {desc:'Peak tempo read.'},
  ]),
});
Object.assign(ABILITY_TEMPLATES.dart||{}, {
  desc:'Sparrow filler strike. Cheap precision poke with crit bias.',
  energyCost:1,
  energyByLevel:[1,1,1,1],
  levels:makeAbilityLevelData([
    {desc:'Base 4 + 80% ATK; 15% pierce; +12% crit chance.'},
    {desc:'Sharper dart.'},
    {desc:'Sharper dart.'},
    {desc:'Peak dart.'},
  ]),
});

const SPARROW_EVOLUTION_TEMPLATES = {
  markPrey: makeEvolutionAbilityTemplate('markPrey','Mark Prey','Sparrow setup opener that prepares a focused follow-up.', {
    type:'utility', btnType:'utility', energy:1,
    levels:[
      {desc:'Mark the enemy. Your next attack deals +18% damage.'},
      {desc:'Mark the enemy. Your next attack deals +22% damage.'},
      {desc:'Mark the enemy. Your next attack deals +26% damage.'},
      {desc:'Mark the enemy. Your next attack deals +30% damage.'},
    ],
  }),
  bodkinStrike: makeEvolutionAbilityTemplate('bodkinStrike','Bodkin Strike','Rapid-line pierce evolution. Heavy puncture flurry.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'3 hits at 52% dmg each. Pierce 18% DEF.'},{desc:'3 hits at 58% dmg each. Pierce 20% DEF.'},{desc:'4 hits at 58% dmg each. Pierce 22% DEF.'},{desc:'4 hits at 64% dmg each. Pierce 24% DEF.'}] }),
  bodkinBarrage: makeEvolutionAbilityTemplate('bodkinBarrage','Bodkin Barrage','Rapid-line final pierce evolution. Relentless armor-punching barrage.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'4 hits at 60% dmg each. Pierce 24% DEF.'},{desc:'4 hits at 66% dmg each. Pierce 26% DEF.'},{desc:'5 hits at 66% dmg each. Pierce 28% DEF.'},{desc:'5 hits at 72% dmg each. Pierce 30% DEF.'}] }),
  rapidFlap: makeEvolutionAbilityTemplate('rapidFlap','Rapid Flap','Rapid-line confuse branch. Disorienting wing-burst.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'3 hits at 42% dmg each. Confuse 15%.'},{desc:'3 hits at 48% dmg each. Confuse 18%.'},{desc:'4 hits at 48% dmg each. Confuse 20%.'},{desc:'4 hits at 54% dmg each. Confuse 24%.'}] }),
  disruptiveRush: makeEvolutionAbilityTemplate('disruptiveRush','Disruptive Rush','Rapid-line confuse evolution. Shakes enemy focus.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'3 hits at 50% dmg each. Confuse 22%.'},{desc:'3 hits at 56% dmg each. Confuse 25%.'},{desc:'4 hits at 56% dmg each. Confuse 28%.'},{desc:'4 hits at 62% dmg each. Confuse 32%.'}] }),
  chaosTempest: makeEvolutionAbilityTemplate('chaosTempest','Chaos Tempest','Rapid-line final confuse evolution. Burst with heavy confusion pressure.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'4 hits at 58% dmg each. Confuse 30%.'},{desc:'4 hits at 64% dmg each. Confuse 34%.'},{desc:'5 hits at 64% dmg each. Confuse 36%.'},{desc:'5 hits at 70% dmg each. Confuse 40%.'}] }),
  rapidTalon: makeEvolutionAbilityTemplate('rapidTalon','Rapid Talon','Rapid-line poison branch. Quick venom cuts.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'3 hits at 42% dmg each. Poison 15%.'},{desc:'3 hits at 48% dmg each. Poison 18%.'},{desc:'4 hits at 48% dmg each. Poison 22%.'},{desc:'4 hits at 54% dmg each. Poison 24%.'}] }),
  venomFlurry: makeEvolutionAbilityTemplate('venomFlurry','Venom Flurry','Rapid-line poison evolution. Venom stacks in rapid bursts.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'3 hits at 50% dmg each. Poison 24%.'},{desc:'3 hits at 56% dmg each. Poison 28%.'},{desc:'4 hits at 56% dmg each. Poison 30%.'},{desc:'4 hits at 62% dmg each. Poison 34%.'}] }),
  venomStorm: makeEvolutionAbilityTemplate('venomStorm','Venom Storm','Rapid-line final poison evolution. Saturates targets with toxins.', {type:'physical', btnType:'physical', energy:2, fixedMainAttackCost:true, role:['multiHit'], levels:[{desc:'4 hits at 56% dmg each. Poison 34%.'},{desc:'4 hits at 62% dmg each. Poison 38%.'},{desc:'5 hits at 62% dmg each. Poison 40%.'},{desc:'5 hits at 68% dmg each. Poison 45%.'}] }),
  searingDart: makeEvolutionAbilityTemplate('searingDart','Searing Dart','Dart-line burn branch. A fast ember shot.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'105% dmg, 8% miss. Burn 30%.'},{desc:'115% dmg, 7% miss. Burn 35%.'},{desc:'125% dmg, 6% miss. Burn 40%.'},{desc:'135% dmg, 5% miss. Burn 45%.'}] }),
  searingArrow: makeEvolutionAbilityTemplate('searingArrow','Searing Arrow','Dart-line burn evolution. Sharper burn pressure.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'118% dmg, 7% miss. Burn 40%.'},{desc:'128% dmg, 6% miss. Burn 45%.'},{desc:'138% dmg, 5% miss. Burn 50%.'},{desc:'148% dmg, 4% miss. Burn 55%.'}] }),
  searingJavelin: makeEvolutionAbilityTemplate('searingJavelin','Searing Javelin','Dart-line final burn evolution. Precision burn finisher.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'132% dmg, 6% miss. Burn 50%.'},{desc:'142% dmg, 5% miss. Burn 55%.'},{desc:'152% dmg, 4% miss. Burn 60%.'},{desc:'162% dmg, 3% miss. Burn 65%.'}] }),
  broadDart: makeEvolutionAbilityTemplate('broadDart','Broad Dart','Dart-line bleed branch. Wide cut for lingering damage.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'102% dmg, 9% miss. Bleed 30%.'},{desc:'112% dmg, 8% miss. Bleed 35%.'},{desc:'122% dmg, 7% miss. Bleed 40%.'},{desc:'132% dmg, 6% miss. Bleed 45%.'}] }),
  broadArrow: makeEvolutionAbilityTemplate('broadArrow','Broad Arrow','Dart-line bleed evolution. Deeper slicing pressure.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'116% dmg, 8% miss. Bleed 40%.'},{desc:'126% dmg, 7% miss. Bleed 45%.'},{desc:'136% dmg, 6% miss. Bleed 50%.'},{desc:'146% dmg, 5% miss. Bleed 55%.'}] }),
  broadJavelin: makeEvolutionAbilityTemplate('broadJavelin','Broad Javelin','Dart-line final bleed evolution. Precise bleeding finisher.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'130% dmg, 7% miss. Bleed 50%.'},{desc:'140% dmg, 6% miss. Bleed 55%.'},{desc:'150% dmg, 5% miss. Bleed 60%.'},{desc:'160% dmg, 4% miss. Bleed 65%.'}] }),
  bodkinDart: makeEvolutionAbilityTemplate('bodkinDart','Bodkin Dart','Dart-line pierce branch. Needle-thin precision shot.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'106% dmg, 8% miss. Pierce 18% DEF.'},{desc:'116% dmg, 7% miss. Pierce 20% DEF.'},{desc:'126% dmg, 6% miss. Pierce 22% DEF.'},{desc:'136% dmg, 5% miss. Pierce 24% DEF.'}] }),
  bodkinArrow: makeEvolutionAbilityTemplate('bodkinArrow','Bodkin Arrow','Dart-line pierce evolution. Deeper armor puncture.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'120% dmg, 7% miss. Pierce 24% DEF.'},{desc:'130% dmg, 6% miss. Pierce 26% DEF.'},{desc:'140% dmg, 5% miss. Pierce 28% DEF.'},{desc:'150% dmg, 4% miss. Pierce 30% DEF.'}] }),
  bodkinJavelin: makeEvolutionAbilityTemplate('bodkinJavelin','Bodkin Javelin','Dart-line final pierce evolution. Armor-breaking precision finish.', {type:'physical', btnType:'physical', energy:1, levels:[{desc:'134% dmg, 6% miss. Pierce 30% DEF.'},{desc:'144% dmg, 5% miss. Pierce 32% DEF.'},{desc:'154% dmg, 4% miss. Pierce 34% DEF.'},{desc:'164% dmg, 3% miss. Pierce 36% DEF.'}] }),
  windSlip: makeEvolutionAbilityTemplate('windSlip','Wind Slip','Wind-line dodge branch. Slip free of danger.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +25% dodge for 2 turns.'},{desc:'Gain +30% dodge for 2 turns.'},{desc:'Gain +35% dodge for 2 turns.'},{desc:'Gain +40% dodge for 3 turns.'}] }),
  slipVeil: makeEvolutionAbilityTemplate('slipVeil','Slip Veil','Wind-line dodge evolution. Veil yourself in evasive currents.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +35% dodge for 2 turns and cleanse Weaken.'},{desc:'Gain +40% dodge for 2 turns and cleanse Weaken.'},{desc:'Gain +45% dodge for 2 turns and cleanse Weaken.'},{desc:'Gain +50% dodge for 3 turns and cleanse Weaken.'}] }),
  phantomGale: makeEvolutionAbilityTemplate('phantomGale','Phantom Gale','Wind-line final dodge evolution. Become almost untouchable.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +45% dodge for 3 turns. Cleanse Weaken/Fear.'},{desc:'Gain +50% dodge for 3 turns. Cleanse Weaken/Fear.'},{desc:'Gain +55% dodge for 3 turns. Cleanse Weaken/Fear.'},{desc:'Gain +60% dodge for 3 turns. Cleanse Weaken/Fear.'}] }),
  tailwindFeint: makeEvolutionAbilityTemplate('tailwindFeint','Tailwind Feint','Wind-line speed branch. Quickens your SPD.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +2 SPD for 2 turns.'},{desc:'Gain +3 SPD for 2 turns.'},{desc:'Gain +4 SPD for 2 turns.'},{desc:'Gain +5 SPD for 2 turns.'}] }),
  tailwindGust: makeEvolutionAbilityTemplate('tailwindGust','Tailwind Gust','Wind-line speed evolution. Stronger haste current.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +4 SPD for 2 turns and +10% dodge.'},{desc:'Gain +5 SPD for 2 turns and +10% dodge.'},{desc:'Gain +6 SPD for 2 turns and +10% dodge.'},{desc:'Gain +7 SPD for 2 turns and +15% dodge.'}] }),
  hyperCurrent: makeEvolutionAbilityTemplate('hyperCurrent','Hyper Current','Wind-line final speed evolution. Hyper SPD spike.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Gain +6 SPD for 3 turns and +15% dodge.'},{desc:'Gain +7 SPD for 3 turns and +15% dodge.'},{desc:'Gain +8 SPD for 3 turns and +20% dodge.'},{desc:'Gain +9 SPD for 3 turns and +20% dodge.'}] }),
  featherDrift: makeEvolutionAbilityTemplate('featherDrift','Feather Drift','Wind-line disruption branch. Sand the enemy\'s aim.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Enemy ACC -15% for 2 turns.'},{desc:'Enemy ACC -18% for 2 turns.'},{desc:'Enemy ACC -20% for 2 turns.'},{desc:'Enemy ACC -22% for 2 turns.'}] }),
  blindingVeil: makeEvolutionAbilityTemplate('blindingVeil','Blinding Veil','Wind-line disruption evolution. Fog their vision.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Enemy ACC -22% for 2 turns and Slow 2 turns.'},{desc:'Enemy ACC -25% for 2 turns and Slow 2 turns.'},{desc:'Enemy ACC -28% for 2 turns and Slow 2 turns.'},{desc:'Enemy ACC -30% for 2 turns and Slow 2 turns.'}] }),
  stormShroud: makeEvolutionAbilityTemplate('stormShroud','Storm Shroud','Wind-line final disruption evolution. Smother enemy accuracy.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Enemy ACC -30% for 3 turns and Slow 2 turns.'},{desc:'Enemy ACC -33% for 3 turns and Slow 2 turns.'},{desc:'Enemy ACC -36% for 3 turns and Slow 3 turns.'},{desc:'Enemy ACC -40% for 3 turns and Slow 3 turns.'}] }),
  brandPrey: makeEvolutionAbilityTemplate('brandPrey','Brand Prey','Mark-line damage amp evolution. Sharper focus mark.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Mark the enemy. Your next attack deals +26% damage.'},{desc:'Mark the enemy. Your next attack deals +30% damage.'},{desc:'Mark the enemy. Your next attack deals +34% damage.'},{desc:'Mark the enemy. Your next attack deals +38% damage.'}] }),
  huntersMark: makeEvolutionAbilityTemplate('huntersMark','Hunter\'s Mark','Mark-line final damage amp evolution. Potent target amplification.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Mark the enemy. Your next attack deals +34% damage.'},{desc:'Mark the enemy. Your next attack deals +38% damage.'},{desc:'Mark the enemy. Your next attack deals +42% damage.'},{desc:'Mark the enemy. Your next attack deals +46% damage.'}] }),
  exposeWeakness: makeEvolutionAbilityTemplate('exposeWeakness','Expose Weakness','Mark-line defense break branch. Open weak points.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Expose the enemy. They take +12% damage for 2 turns.'},{desc:'Expose the enemy. They take +14% damage for 2 turns.'},{desc:'Expose the enemy. They take +16% damage for 2 turns.'},{desc:'Expose the enemy. They take +18% damage for 2 turns.'}] }),
  exposeGuard: makeEvolutionAbilityTemplate('exposeGuard','Expose Guard','Mark-line defense break evolution. Crack defenses further.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Expose the enemy. They take +18% damage for 2 turns.'},{desc:'Expose the enemy. They take +20% damage for 2 turns.'},{desc:'Expose the enemy. They take +22% damage for 2 turns.'},{desc:'Expose the enemy. They take +24% damage for 2 turns.'}] }),
  quarryBreak: makeEvolutionAbilityTemplate('quarryBreak','Quarry Break','Mark-line final defense break evolution. Full opening for burst.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Expose the enemy. They take +24% damage for 3 turns.'},{desc:'Expose the enemy. They take +26% damage for 3 turns.'},{desc:'Expose the enemy. They take +28% damage for 3 turns.'},{desc:'Expose the enemy. They take +30% damage for 3 turns.'}] }),
  predatorBrand: makeEvolutionAbilityTemplate('predatorBrand','Predator Brand','Mark-line execute evolution. Prepares lethal follow-ups.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Mark prey. Next attack gains +22% damage, +16% more below 50% HP.'},{desc:'Mark prey. Next attack gains +26% damage, +18% more below 50% HP.'},{desc:'Mark prey. Next attack gains +30% damage, +20% more below 50% HP.'},{desc:'Mark prey. Next attack gains +34% damage, +22% more below 50% HP.'}] }),
  finalHunt: makeEvolutionAbilityTemplate('finalHunt','Final Hunt','Mark-line final execute evolution. Deadliest low-HP setup.', {type:'utility', btnType:'utility', energy:1, levels:[{desc:'Mark prey. Next attack gains +28% damage, +24% more below 50% HP.'},{desc:'Mark prey. Next attack gains +32% damage, +26% more below 50% HP.'},{desc:'Mark prey. Next attack gains +36% damage, +28% more below 50% HP.'},{desc:'Mark prey. Next attack gains +40% damage, +30% more below 50% HP.'}] }),
};
Object.assign(ABILITY_TEMPLATES, SPARROW_EVOLUTION_TEMPLATES);

/** Balance caps: max one major rider evolution per tier beyond baseline; hard CC heavily gated (see inner logic). */
function enforceAbilityBalanceSpec(){
  const HARD_CC=new Set(['paralyzed','stunned','confused']);
  const MAJOR_AIL=new Set(['paralyzed','confused','burning','poison','weaken','delayed','feared','slow','mud','chilled','frozen']);
  for(const tmpl of Object.values(ABILITY_TEMPLATES)){
    if(!tmpl||!Array.isArray(tmpl.levels)) continue;
    if(!tmpl.balanceSpec){
      tmpl.balanceSpec={primary:tmpl.type||'utility',secondary:[],ailment:null,subaction:null};
    }
    const baseAilCount=Math.max(0,[tmpl.levels[0]?.newAilment,tmpl.levels[0]?.newAilment2,tmpl.levels[0]?.newAilment3].filter(Boolean).length);
    tmpl.levels.forEach((lv,idx)=>{
      if(!lv||typeof lv!=='object') return;
      delete lv.raisePoisonCap; // remove infinite cap growth loops
      const ails=[lv.newAilment,lv.newAilment2,lv.newAilment3].filter(Boolean);
      const maxAllowed=baseAilCount + (idx>=3?1:0);
      let kept=[];
      let hardUsed=false;
      for(const a of ails){
        if(kept.length>=maxAllowed) break;
        if(HARD_CC.has(a)){
          if(hardUsed) continue;
          hardUsed=true;
        }
        if(MAJOR_AIL.has(a)||kept.length===0) kept.push(a);
      }
      lv.newAilment=kept[0];
      lv.newAilment2=kept[1];
      delete lv.newAilment3;
      if(lv.newAilment==='paralyzed') lv.ailChance=Math.min(35, Math.max(0, lv.ailChance||0));
      if(lv.newAilment2==='paralyzed') lv.ailChance2=Math.min(35, Math.max(0, lv.ailChance2||0));
    });
  }
}
enforceAbilityBalanceSpec();

const DEFAULT_ABILITY_FIELDS = {
  energyCost: 1,
  skillType: 'attack',
  role: [],
};

function normalizeAbilityEnergy(ability){
  if(!ability||typeof ability!=='object') return ability;
  if(ability.energyCost==null){
    ability.energyCost = Number.isFinite(ability.cost) ? ability.cost : DEFAULT_ABILITY_FIELDS.energyCost;
  }
  if(!ability.skillType){
    ability.skillType = DEFAULT_ABILITY_FIELDS.skillType;
  }
  if(!Array.isArray(ability.role)){
    ability.role = Array.isArray(DEFAULT_ABILITY_FIELDS.role) ? [...DEFAULT_ABILITY_FIELDS.role] : [];
  }
  if('cost' in ability) delete ability.cost;
  return ability;
}

function normalizeAllAbilityEnergy(){
  for(const tmpl of Object.values(ABILITY_TEMPLATES)) normalizeAbilityEnergy(tmpl);
}


const ABILITY_ENERGY_PATCH = {
  mainAttack:{energyCost:1,skillType:'attack',role:['basic']},
  swoop:{energyCost:2,skillType:'attack',role:['burst']},
  diveBomb:{energyCost:2,skillType:'attack',role:['burst']},
  cannonball:{energyCost:2,skillType:'attack',role:['burst']},
  flurry:{energyCost:2,skillType:'attack',role:['multiHit']},
  retribution:{energyCost:2,skillType:'attack',role:['counter']},
  deathDive:{energyCost:3,skillType:'attack',role:['finisher']},
  eyeGouge:{energyCost:1,skillType:'attack',role:['debuff']},
  supersonic:{energyCost:2,skillType:'attack',role:['speed']},
  curvedTalons:{energyCost:2,skillType:'attack',role:['pierce']},
  curvedBeak:{energyCost:2,skillType:'attack',role:['pierce']},
  toxicSpit:{energyCost:1,skillType:'attack',role:['poison']},
  plagueBlast:{energyCost:2,skillType:'attack',role:['dot']},
  incendiaryFeathers:{energyCost:2,skillType:'attack',role:['burn']},
  counter:{energyCost:1,skillType:'utility',role:['reactive']},
  parry:{energyCost:1,skillType:'utility',role:['defense']},
  chargeUp:{energyCost:1,skillType:'utility',role:['setup']},
  rockDrop:{energyCost:2,skillType:'attack',role:['setupBurst']},
  stickLance:{energyCost:1,skillType:'attack',role:['poke']},
  mudshot:{energyCost:1,skillType:'attack',role:['slow']},
  cactiSpine:{energyCost:1,skillType:'attack',role:['chip']},
  aerialPoop:{energyCost:1,skillType:'attack',role:['debuff']},
  thornBarrage:{energyCost:2,skillType:'attack',role:['multiHit']},
  bowedWing:{energyCost:1,skillType:'attack',role:['poke']},
  hum:{energyCost:1,skillType:'buff',role:[]},
  flyby:{energyCost:2,skillType:'buff',role:['setup']},
  guardianCry:{energyCost:2,skillType:'utility',role:['defense']},
  bulwarkRoar:{energyCost:2,skillType:'utility',role:['tank']},
  warcry:{energyCost:1,skillType:'buff',role:[]},
  battleHymn:{energyCost:2,skillType:'buff',role:[]},
  reveille:{energyCost:2,skillType:'utility',role:['cleanse']},
  victoryChant:{energyCost:2,skillType:'buff',role:[]},
  preen:{energyCost:2,skillType:'utility',role:['heal']},
  molt:{energyCost:2,skillType:'utility',role:['cleanse']},
  featherRuffle:{energyCost:1,skillType:'debuff',role:[]},
  wingClip:{energyCost:1,skillType:'debuff',role:[]},
  tailPull:{energyCost:1,skillType:'debuff',role:[]},
  taunt:{energyCost:1,skillType:'utility',role:['control']},
  dustDevil:{energyCost:2,skillType:'debuff',role:[]},
  spellLance:{energyCost:2,skillType:'spell',role:[]},
  shriekwave:{energyCost:2,skillType:'spell',role:[]},
  thunderScreech:{energyCost:3,skillType:'spell',role:['hardControl']},
  stormChorus:{energyCost:3,skillType:'spell',role:['hardControl']},
  mobSwarm:{energyCost:3,skillType:'spell',role:['multiHit']},
  wingStorm:{energyCost:3,skillType:'spell',role:[]},
  murderMurmuration:{energyCost:3,skillType:'spell',role:[]},
  astralRefrain:{energyCost:2,skillType:'spell',role:['utility']},
};
Object.entries(ABILITY_ENERGY_PATCH).forEach(([id, patch])=>{
  if(ABILITY_TEMPLATES[id]) Object.assign(ABILITY_TEMPLATES[id], patch);
});

/** Prefer mild curves on fillers; keep heavy finishers explicit in ABILITY_ENERGY_PATCH. */
const ENERGY_BY_LEVEL_PATCH={
  rapidPeck:[1,1,1,1], dart:[1,1,1,1], evade:[1,1,2,2], blackPeck:[1,1,1,1],
  dirge:[3,3,3,3], lullaby:[2,2,2,3], crowStrike:[1,1,1,1], talonRake:[1,1,1,2],
  beakSlam:[3,3,3,3], crowDefend:[1,1,2,2], mudLash:[1,1,1,2], serpentCrusher:[3,3,3,3],
  fleshRipper:[1,1,1,1], serratedSlash:[1,1,1,1], diveGouge:[3,3,3,3],
  fishSnatcher:[1,1,1,2], honkAttack:[3,3,3,3], gooseHonk:[3,3,3,3], penguinHonk:[3,3,3,3],
  headWhip:[2,2,2,3], intimidate:[1,1,2,2], probeStrike:[2,2,2,2], bashUp:[2,2,2,3],
  sitAndWait:[1,1,1,1], breakClamp:[2,2,3,3], serratedBill:[1,1,1,2], silentPierce:[2,2,2,3],
theJoker:[2,2,3,3], tookieTookie:[2,2,2,3], fruitSweetener:[1,1,2,2],
  nectarJab:[2,3,3,3], swoop:[1,1,1,1], diveBomb:[2,2,3,3], shadowFeint:[1,1,1,2],
  flyby:[1,1,2,2], dustDevil:[1,1,2,2], rockDrop:[2,2,3,3], mudshot:[2,2,3,3], hum:[1,1,2,2],
  bowedWing:[1,1,2,2], spellLance:[2,2,2,3], guardianCry:[2,2,2,2], wormRiot:[1,1,2,2],
  curvedTalons:[3,3,3,3], curvedBeak:[2,2,3,3], wingStorm:[2,2,2,3], supersonic:[2,2,3,3],
  stickLance:[1,1,2,2]
};
Object.entries(ENERGY_BY_LEVEL_PATCH).forEach(([id,arr])=>{
  if(ABILITY_TEMPLATES[id]) ABILITY_TEMPLATES[id].energyByLevel=[...arr];
  if(typeof ABILITY_TEMPLATES_EXTRA!=='undefined'&&ABILITY_TEMPLATES_EXTRA[id]) ABILITY_TEMPLATES_EXTRA[id].energyByLevel=[...arr];
});

normalizeAllAbilityEnergy();

const ABILITY_TYPES = new Set(['attack','spell','song','utility']);
const ABILITY_RARITIES = new Set(['common','rare','epic','legendary']);

function normalizeAbilityTemplates(){
  for(const [id,t] of Object.entries(ABILITY_TEMPLATES||{})){
    if(!t) continue;
    const rawType=String(t.type||t.btnType||'').toLowerCase();
    const mapped=(rawType==='physical'||rawType==='ranged')?'attack':rawType;
    const fallback=(String(t.btnType||'').toLowerCase()==='spell')?'spell':(String(t.btnType||'').toLowerCase()==='utility'?'utility':'attack');
    t.codexType = ABILITY_TYPES.has(mapped) ? mapped : fallback;

    if(!t.rarity) t.rarity='common';
    t.rarity=String(t.rarity).toLowerCase();
    if(!ABILITY_RARITIES.has(t.rarity)) t.rarity='common';

    if(!Array.isArray(t.tags)) t.tags=[];
    if(t.codexType==='spell' && !t.tags.includes('magic')) t.tags.push('magic');
    if(t.codexType==='song' && !t.tags.includes('singer')) t.tags.push('singer');
    if(!t.shortDesc) t.shortDesc=t.desc||'No description yet.';
  }
}
normalizeAbilityTemplates();

sanitizeAbilityClassRouting(ABILITY_TEMPLATES);
if(typeof ABILITY_TEMPLATES_EXTRA!=='undefined') sanitizeAbilityClassRouting(ABILITY_TEMPLATES_EXTRA);

Object.values(ABILITY_TEMPLATES).forEach(t=>{
  if(!t) return;
  if(!t.description) t.description=t.desc||`${t.name} ability.`;
  if(!t.effect) t.effect=(t.levels&&t.levels[0]&&t.levels[0].desc)?t.levels[0].desc:'Use this ability to gain an advantage.';
});

// Ensure every ability has a baseline miss rate for accuracy rebuild tuning.
Object.values(ABILITY_TEMPLATES).forEach(t=>{ if(t.baseMissChance===undefined) t.baseMissChance=15; });

// Combat rewrite: legacy ABILITY_POOL_* hand-curated category lists are gone.
// Category filtering is now derived dynamically from Avian.data.combatPack.skillTrees
// when needed by the shop / dispatcher. These remain as empty stubs only to keep
// any stray references resolvable.
const ABILITY_POOL_PHYSICAL = [];
const ABILITY_POOL_RANGED = [];
const ABILITY_POOL_BUFF = [];
const ABILITY_POOL_DEBUFF = [];
const ABILITY_POOL_MAGIC = [];
const ABILITY_POOL_UTILITY = [];


function removeMimicEverywhere(){
  const GG = globalThis.G;
  if(typeof ABILITY_TEMPLATES!=='undefined') delete ABILITY_TEMPLATES.mimic;
  if('ACTIONS' in globalThis && globalThis.ACTIONS) delete globalThis.ACTIONS.mimic;
  if(GG?.player?.abilities) GG.player.abilities=GG.player.abilities.filter(a=>a.id!=='mimic');
  if(typeof BIRDS!=='undefined') Object.values(BIRDS).forEach(b=>{ if(Array.isArray(b.extraAbilities)) b.extraAbilities=b.extraAbilities.filter(id=>id!=='mimic'); });
}


const MAGIC_CLASSES = new Set(['singer','trickster']);
// removeMimicEverywhere(); // moved to after G init
const ABILITY_MAIN_ATTACK = {
  id:'mainAttack',
  name:'Main Attack',
  type:'physical',
  btnType:'physical',
  desc:'Reliable strike. For magic birds this is Peck (always 20% miss). Peck: An average physical attack using a Beak.',
  levels:[{lv:1,desc:'100% ATK damage. Magic birds use Peck (20% fixed miss chance).'}],
};
ABILITY_TEMPLATES.mainAttack = ABILITY_MAIN_ATTACK;

// Unlock system
const UNLOCK_KEY = 'avianAscent_unlocks_v1';

// ============================================================
//  DIFFICULTY SYSTEM
// ============================================================
// `mult` scales all enemy combat stats (see buildScaledEnemy). It is the main difficulty knob vs the player.
const DIFFICULTIES = {
  fletchling:{ id:'fletchling', label:'Fletchling', emoji:'🥚', mult:0.80, color:'#6ab89a', desc:'Gentler fights — good for learning.',   scalingTip:'Enemy combat stats: ×0.8 (easier than Normal).' },
  juvenile:  { id:'juvenile',   label:'Juvenile',   emoji:'🕊️', mult:1.00, color:'#e8c96a', desc:'Standard challenge — recommended default.', scalingTip:'Enemy combat stats: ×1.0 (baseline).' },
  predator:  { id:'predator',   label:'Predator',   emoji:'🦅', mult:1.20, color:'#e87070', desc:'Harder enemies and sharper pressure.', scalingTip:'Enemy combat stats: ×1.2.' },
  murder:    { id:'murder',     label:'Murder',     emoji:'‍⬛', mult:1.40, color:'#c040e0', desc:'Very hard — for experts.', unlockRequires:'predatorWin', scalingTip:'Enemy combat stats: ×1.4.' },
};
function getUnlocks() {
  try { return JSON.parse(localStorage.getItem(UNLOCK_KEY)||'{}'); } catch(e){ return {}; }
}
function grantUnlock(id) {
  const u=getUnlocks(); u[id]=true; localStorage.setItem(UNLOCK_KEY,JSON.stringify(u));
}
function isUnlocked(id) { return !!getUnlocks()[id]; }

function isBuildNestUnlocked() {
  try { return localStorage.getItem('avian_buildnest_unlocked') === '1'; } catch(_) { return false; }
}
function syncBuildNestUnlockUI() {
  document.body.classList.toggle('build-nest-unlocked', isBuildNestUnlocked());
}
globalThis.isBuildNestUnlocked = isBuildNestUnlocked;
globalThis.syncBuildNestUnlockUI = syncBuildNestUnlockUI;

function getActiveOwNodesForProgress() {
  if (typeof globalThis.isCustomOverworldActive !== 'function' || !globalThis.isCustomOverworldActive()) return null;
  const map = typeof globalThis.loadCustomOverworldMap === 'function' ? globalThis.loadCustomOverworldMap() : null;
  return map?.nodes || null;
}
function getStoryMaxStage() {
  const custom = typeof globalThis.getActiveCustomOverworldMaxStage === 'function'
    ? globalThis.getActiveCustomOverworldMaxStage() : null;
  return custom != null ? custom : 20;
}
globalThis.getStoryMaxStage = getStoryMaxStage;


// ============================================================
//  UNLOCK PROGRESSION (Stage 10/20 + special endless)
// ============================================================
const STAGE_CLEAR_UNLOCKS = {
  10: {
    sparrow: 'hummingbird',
    goose: 'shoebill',
    crow: 'secretary',
    robin: 'magpie',
    macaw: 'kookaburra',
  },
  20: {
    hummingbird: 'harpy',
    shoebill: 'ostrich',
    secretary: 'peregrine',
    magpie: '',
    kookaburra: 'lyrebird',
  }
};

const SPECIAL_UNLOCKS = [
  { id:'unlock_penguin', test:()=> G.endlessMode && (G.endlessBattle||0) >= 30 && (BIRDS[G.player?.birdKey]?.class==='tank'), bird:'penguin', label:'Emperor Penguin' },
  { id:'unlock_emu', test:()=> G.endlessMode && (G.endlessBattle||0) >= 40 && (BIRDS[G.player?.birdKey]?.class==='tank'), bird:'emu', label:'Emu' },
  { id:'unlock_swan', test:()=> G.endlessMode && (G.endlessBattle||0) >= 30 && (BIRDS[G.player?.birdKey]?.class==='tank'), bird:'swan', label:'Swan' },
  { id:'unlock_flamingo', test:()=> G.endlessMode && (G.endlessBattle||0) >= 30 && (BIRDS[G.player?.birdKey]?.class==='striker'), bird:'flamingo', label:'Flamingo' },
  { id:'unlock_seagull', test:()=> G.endlessMode && (G.player?.birdLevel||1) >= 21 && (BIRDS[G.player?.birdKey]?.class==='trickster'), bird:'seagull', label:'Seagull' },
  { id:'unlock_albatross', test:()=> G.endlessMode && (G.endlessBattle||0) >= 50, bird:'albatross', label:'Albatross' },
];

function queueUnlockBanner(birdKey, titleText){
  if(!G._unlockPopups) G._unlockPopups=[];
  G._unlockPopups.push({birdKey,titleText});
}

function handleBossClearUnlocks(){
  if(!G.enemy||!G.enemy.isBoss||!G.player) return;
  const stage=G.stage;
  const birdKey=G.player.birdKey;
  const map=STAGE_CLEAR_UNLOCKS[stage];
  if(map&&map[birdKey]){
    const unlockBirdKey=map[birdKey];
    const unlockId=`unlock_${unlockBirdKey}`;
    if(!isUnlocked(unlockId)){
      grantUnlock(unlockId);
      queueUnlockBanner(unlockBirdKey,`Congratulations on defeating Stage ${stage}!`);
    }
  }
  SPECIAL_UNLOCKS.forEach(u=>{
    if(u.test&&u.test()&&!isUnlocked(u.id)){
      grantUnlock(u.id);
      const birdUnlockId=`unlock_${u.bird}`;
      if(!isUnlocked(birdUnlockId)) grantUnlock(birdUnlockId);
      queueUnlockBanner(u.bird,'Endless milestone reached!');
    }
  });
}

function renderUnlockPopupsOnGameover(){
  const wrap=document.getElementById('run-unlocks');
  if(!wrap) return;
  wrap.innerHTML='';
  const pops=G._unlockPopups||[];
  if(!pops.length) return;
  pops.forEach(p=>{
    const b=BIRDS[p.birdKey];
    if(!b) return;
    const portrait=renderBirdIconHTML(b.portraitKey||b.birdKey||p.birdKey,'small',false);
    const div=document.createElement('div');
    div.className='unlock-popup';
    div.innerHTML=`<div class="unlock-title">${p.titleText} You have unlocked "<strong>${b.name}</strong>".</div><div class="unlock-card"><div class="bird-portrait" style="width:56px;height:56px;">${portrait}</div><div class="unlock-statline">HP ${b.stats.maxHp} · ATK ${b.stats.atk} · DEF ${b.stats.def} · SPD ${b.stats.spd}</div></div>`;
    wrap.appendChild(div);
  });
  G._unlockPopups=[];
}

// ============================================================
// SECRET CODE UNLOCK — Toucan
// ============================================================
const TOUCAN_CODE = 'ahh ahh eee eee tookie tookie';
let _secretBuffer = '';
function checkSecretUnlockChar(ch){
  _secretBuffer += String(ch).toLowerCase();
  if(_secretBuffer.length>80) _secretBuffer=_secretBuffer.slice(-80);
  if(_secretBuffer.includes(TOUCAN_CODE)){
    const unlockId='unlock_toucan';
    if(!isUnlocked(unlockId)){
      grantUnlock(unlockId);
      queueUnlockBanner('toucan','Secret Code Entered!');
      logMsg('🦜 Secret unlocked: Toucan!','system');
    }
    _secretBuffer='';
  }
}

// ============================================================
//  EXP SYSTEM
// ============================================================
// --- Shiny economy (tuned vs SHOP_COSTS / healing shelf 10–28, abilities 50–150 by EN) ---
/** Normal story kill: early / mid / late stage bands. */
const SHINY_NORMAL_STORY = Object.freeze({ early: [6, 10], mid: [8, 13], late: [10, 16] });
/** Boss story kill by stage band. */
const SHINY_BOSS_STORY = Object.freeze({ early: [16, 24], mid: [22, 32], late: [30, 44] });
/** Endless mode per-kill ranges (+ battle-index inflation cap). */
const SHINY_NORMAL_ENDLESS = [5, 9];
const SHINY_BOSS_ENDLESS = [24, 36];
const SHINY_ENDLESS_INFLATION_CAP = 6;
const SHINY_BONUS_PERFECT = 1;
const SHINY_BONUS_FAST = 1;
const SHINY_BONUS_MAGPIE = 2;

function expForLevel(lv) {
  if(lv<=15) return Math.floor(70 * Math.pow(1.34, lv - 1));
  if(lv<=25) return Math.floor(70 * Math.pow(1.34, 14) * Math.pow(1.16, lv - 15));
  return Math.floor(70 * Math.pow(1.34, 14) * Math.pow(1.16, 10) * Math.pow(1.07, lv - 25));
}

// --- EXP balancing tunables (tune story + endless pacing here) ---
/** Base EXP by enemy level (Lv 0–10); Lv 10+ uses BASE_EXP_POST10_* additive + log2 curve (no exponential chaining). */
const BASE_EXP_BY_ENEMY_LEVEL = [14, 18, 25, 35, 49, 67, 92, 127, 176, 244, 336];
const BASE_EXP_POST10_LINEAR_PER_LEVEL = 28;
const BASE_EXP_POST10_LOG_SCALE = 14;
/** Story/endless: extra EXP from encounter depth (applied in compute*ExpGain). */
const STORY_STAGE_EXP_BONUS_PER_STAGE = 0.05;
const STORY_STAGE_EXP_BONUS_CAP = 1.0;
const ENDLESS_BATTLE_EXP_BONUS_PER_BATTLE = 0.03;
const ENDLESS_BATTLE_EXP_BONUS_CAP = 1.2;
/** Endless (stage 21+): normal kills cannot exceed this fraction of expForLevel(plv + 1). */
const ENDLESS_EXP_NORMAL_CAP_PCT = 0.30;
/** Endless (stage 21+): boss kills cannot exceed this fraction of expForLevel(plv + 1). */
const ENDLESS_EXP_BOSS_CAP_PCT = 0.85;
/** Threat tier EXP multipliers removed — level-relative scaling only. */
function threatTierExpMultiplierForEnemy(_enemy) {
  return 1;
}

function baseExpForEnemyLevel(lv) {
  const L = Math.max(0, Math.floor(Number(lv) || 0));
  if (L <= 10) return BASE_EXP_BY_ENEMY_LEVEL[L];
  const over = L - 10;
  const linear = BASE_EXP_POST10_LINEAR_PER_LEVEL * over;
  const softLog = BASE_EXP_POST10_LOG_SCALE * Math.log2(over + 1);
  return Math.max(BASE_EXP_BY_ENEMY_LEVEL[10], Math.round(BASE_EXP_BY_ENEMY_LEVEL[10] + linear + softLog));
}

function relativeLevelExpMultiplier(enemyLv, playerLv) {
  const e = Math.floor(Number(enemyLv) || 0);
  const p = Math.max(1, Math.floor(Number(playerLv) || 1));
  const d = e - p;
  if (d <= -3) return 0.70;
  if (d === -2) return 0.82;
  if (d === -1) return 0.92;
  if (d === 0) return 1.00;
  if (d === 1) return 1.12;
  if (d === 2) return 1.25;
  return 1.40;
}

function stageExpMultiplier() {
  if (isEndlessRunActive()) {
    const eb = Math.max(0, Math.floor(Number(G.endlessBattle) || 0));
    return 1 + Math.min(ENDLESS_BATTLE_EXP_BONUS_CAP, eb * ENDLESS_BATTLE_EXP_BONUS_PER_BATTLE);
  }
  const stage = Math.max(1, getEncounterStage());
  return 1 + Math.min(STORY_STAGE_EXP_BONUS_CAP, (stage - 1) * STORY_STAGE_EXP_BONUS_PER_STAGE);
}

function computeNormalEnemyExpGain(enemy) {
  if (!enemy) return 0;
  const plv = Math.max(1, Math.floor(G.player?.birdLevel || 1));
  const elv = getEnemyPreviewLevel(enemy);
  const base = baseExpForEnemyLevel(elv);
  const tMult = threatTierExpMultiplierForEnemy(enemy);
  const rMult = relativeLevelExpMultiplier(elv, plv);
  let exp = Math.max(1, Math.round(base * tMult * rMult * stageExpMultiplier()));
  if (isEndlessRunActive()) {
    const nextLevelExp = expForLevel(plv + 1);
    const normalCap = Math.max(1, Math.round(nextLevelExp * ENDLESS_EXP_NORMAL_CAP_PCT));
    exp = Math.min(exp, normalCap);
  }
  return exp;
}

function computeBossExpGain(enemy) {
  const plv = Math.max(1, Math.floor(G.player?.birdLevel || 1));
  let exp = Math.round(expForLevel(plv + 1) * 0.72 * stageExpMultiplier());
  if (enemy) {
    const elv = getEnemyPreviewLevel(enemy);
    if (elv > plv) exp = Math.round(exp * (1 + 0.03 * Math.min(elv - plv, 5)));
  }
  if (isEndlessRunActive()) {
    const nextLevelExp = expForLevel(plv + 1);
    const bossCap = Math.max(1, Math.round(nextLevelExp * ENDLESS_EXP_BOSS_CAP_PCT));
    exp = Math.min(exp, bossCap);
  }
  return Math.max(1, exp);
}

/*
  EXP sanity notes (endless caps use expForLevel(plv + 1); isEndlessRunActive() is stage>20).
  Spot-check stages vs player level (plv≈anchor): compare base*tier*relative to caps.
  - plv 21: nextLvExp≈23,151 => normal cap≈6,945, boss cap≈19,678.
  - plv 30: nextLvExp≈60,361 => normal cap≈18,108, boss cap≈51,307.
  - plv 50: nextLvExp≈281,342 => normal cap≈84,403, boss cap≈239,141.
  - plv 80: nextLvExp≈2,831,050 => normal cap≈849,315, boss cap≈2,406,393 (Math.round).
  - plv 120: nextLvExp≈61,503,211 => normal cap≈18,450,963, boss cap≈52,277,729.
*/

// ============================================================
//  TURN STATE / SAFETY LIMITS
// ============================================================
const TURN={PLAYER:'PLAYER',ENEMY:'ENEMY',RESOLVING:'RESOLVING'};

// ===== Growth Stage Constants =====
const GROWTH = {
  FLETCHLING:'fletchling',
  JUVENILE:'juvenile',
  ADULT:'adult',
  APEX:'apex',
};

function getGrowthStageForLevel(lv){
  if(lv>=21) return GROWTH.APEX;
  if(lv>=15) return GROWTH.ADULT;
  if(lv>=7) return GROWTH.JUVENILE;
  return GROWTH.FLETCHLING;
}
const MAX_PLAYER_ACTIONS_PER_TURN=6;
const MAX_ENEMY_ACTIONS_PER_TURN=3;
/** Legacy per-bird movement ability ids still referenced by cooldown UI + playerAction guards. */
const HUMMINGBIRD_DASH_ABILITY_IDS=new Set(['sonicDash','hummingbirdDash']);
const PEREGRINE_DIVE_ABILITY_IDS=new Set(['peregrineDive','deathDive']);
const SNOWY_OWL_DIVE_ABILITY_IDS=new Set(['snowyOwlDive']);
const ROBIN_DART_ABILITY_IDS=new Set(['robinDart','dart']);
const BOWERBIRD_LURE_ABILITY_IDS=new Set(['bowerbirdLure','bowerLure']);
/** Caps card/passive EN gains per player turn (separate from size-based turn regen). */
const MAX_ENERGY_GAIN_PER_TURN=12;

// ============================================================
//  ENERGY — size-based momentum (partial regen each turn)
// ============================================================
const ENERGY_STACK_CAP_BY_SIZE = { tiny:3, small:3, medium:3, large:3, xl:3 };
const MIN_MAX_ENERGY = 2;
const PLAYER_ENERGY_MAX = 6;
const PLAYER_ENERGY_START = 4;
const PLAYER_ENERGY_REGEN = 3;
const ENEMY_ENERGY_MAX = 6;
const ENEMY_ENERGY_START = 4;
const ENEMY_ENERGY_REGEN = 3;

function normalizeBirdSizeForEnergy(sz){
  const s=String(sz||'medium').toLowerCase();
  if(s==='extra_large'||s==='extra large'||s==='very large'||s==='verylarge') return 'large';
  if(s==='giant'||s==='boss override'||s==='bossoverride') return 'xl';
  return (['tiny','small','medium','large','xl'].includes(s)?s:'medium');
}

/**
 * @param {string} size
 * @returns {{maxEN:number,startEN:number,regenEN:number}}
 */
function getEnergyProfile(size){
  const k=normalizeBirdSizeForEnergy(size);
  if(k==='tiny'||k==='small') return {maxEN:5,startEN:4,regenEN:3};
  if(k==='medium') return {maxEN:4,startEN:3,regenEN:2};
  if(k==='large'||k==='xl') return {maxEN:3,startEN:2,regenEN:2};
  return {maxEN:4,startEN:3,regenEN:2};
}
function getEnemyEnergyProfile(){
  return {maxEN:ENEMY_ENERGY_MAX,startEN:ENEMY_ENERGY_START,regenEN:ENEMY_ENERGY_REGEN};
}
globalThis.getEnergyProfile=getEnergyProfile;
globalThis.getEnemyEnergyProfile=getEnemyEnergyProfile;

function computePlayerEffectiveMaxEnergy(player){
  const p=player;
  if(!p) return PLAYER_ENERGY_MAX;
  const bd=BIRDS[p.birdKey]||{};
  const size=normalizeBirdSizeForEnergy(p.size||bd.size||'medium');
  const sizeStackCap=ENERGY_STACK_CAP_BY_SIZE[size] ?? 3;
  const bonus=Math.max(0, Math.min(sizeStackCap, p.energyBonus||0));
  return Math.max(MIN_MAX_ENERGY, PLAYER_ENERGY_MAX + bonus);
}

function computePlayerMaxEnergy(){
  return computePlayerEffectiveMaxEnergy(G.player);
}

function computePlayerStartEnergy(player){
  const p=player||G.player;
  const cap=computePlayerEffectiveMaxEnergy(p);
  return Math.min(cap, PLAYER_ENERGY_START);
}

function computePlayerEnergyRegen(player){
  return PLAYER_ENERGY_REGEN;
}

/** Player-only: base regen minus frozen/paralyzed/chilled penalties. */
function computePlayerEnergyRegenThisTurn(player, status){
  let r=computePlayerEnergyRegen(player);
  const ps=status||G.playerStatus||{};
  const _fz=ps.frozen;
  const frzTurns=(typeof _fz==='object'&&_fz)?(_fz.turns||0):(typeof _fz==='number'?_fz:0);
  if(frzTurns>0) return 0;
  if((ps.paralyzed||0)>0) return 0;
  const chillStacks=ps.chilled?.stacks||0;
  if(chillStacks>0) r=Math.max(0, r-chillStacks);
  return r;
}

/*
EN_SYSTEM_BALANCE_AUDIT (manual / grep-assisted)
- Physical filler attacks: prefer flat [1,1,1,1] EN-by-level baselines; spells skew [1,1,2,2] / [2,2,2,3] (see template-factories + ABILITY_ENERGY_PATCH).
- Large & XL (maxEN 3): any slotted skill that reaches 3 EN is awkward with Frozen (+1) or multi-action turns.
- Known template/meta ids at 3 EN (see ABILITY_TEMPLATES + FAMILY_ENERGY_BY_SLOT): deathDive, thunderScreech, stormChorus, mobSwarm, wingStorm, murderMurmuration; several lines use energyByLevel ending in 3 (e.g. curvedTalons L4, wingStorm L4).
- Large/XL birds that reach those ids via family evolution (non-exhaustive): albatross sweep/current branches, harpy crush line, crow murder chain, snowy owl lines via thunderScreech/stormChorus aliases, hummingbird dive line, dukeBlakiston dive lineage.
- Grep hints: rg "energyCost:\\s*3" js/core/game.js ; rg "energyByLevel:\\[[^\\]]*3" js/core/game.js
*/

// ============================================================
//  GAME STATE
// ============================================================
const AVIAN_EVENT_BUS = (()=>{
  const listeners = new Map();
  return {
    on(evt, fn){
      if(!evt || typeof fn!=='function') return ()=>{};
      if(!listeners.has(evt)) listeners.set(evt, new Set());
      listeners.get(evt).add(fn);
      return ()=>listeners.get(evt)?.delete(fn);
    },
    emit(evt, payload={}){
      const set = listeners.get(evt);
      if(!set || !set.size) return;
      for(const fn of [...set]){ try{ fn(payload); }catch(err){ console.error(err); } }
    }
  };
})();
globalThis.AvianEvents = AVIAN_EVENT_BUS;

const GAME_MODULES = [];
function registerGameModule(mod){
  if(!mod || !mod.id || GAME_MODULES.some(m=>m.id===mod.id)) return;
  GAME_MODULES.push(mod);
}
function runModuleHook(hook, payload){
  for(const mod of GAME_MODULES){
    const fn = mod && mod[hook];
    if(typeof fn==='function'){
      try{ fn(payload); }catch(err){ console.error(err); }
    }
  }
}
globalThis.registerGameModule = registerGameModule;

let _warnedMissingAbilityPassiveUpgradePack = false;
function initDataPacks(){
  const pack = globalThis.ABILITY_PASSIVE_UPGRADE_PACK;
  const tree = globalThis.ABILITY_FAMILY_TREE;
  if(pack && typeof pack === 'object'){
    G.dataPacks = G.dataPacks || {};
    G.dataPacks.abilityPassiveUpgrade = Object.freeze({
      STATUS_GLOSSARY: pack.STATUS_GLOSSARY || Object.freeze({}),
      ABILITY_DEFS: pack.ABILITY_DEFS || Object.freeze({}),
    });
  }
  else{
    G.dataPacks = G.dataPacks || {};
    G.dataPacks.abilityPassiveUpgrade = null;
    if(!_warnedMissingAbilityPassiveUpgradePack){
      _warnedMissingAbilityPassiveUpgradePack = true;
      console.warn('[DataPack] ABILITY_PASSIVE_UPGRADE_PACK missing; metadata overlays disabled.');
    }
  }
  if(tree && typeof tree === 'object' && tree.birds){
    G.dataPacks = G.dataPacks || {};
    G.dataPacks.abilityFamilyTree = Object.freeze({
      version: tree.version,
      sourceHint: tree.sourceHint,
      birds: tree.birds,
    });
  }
  else{
    G.dataPacks = G.dataPacks || {};
    G.dataPacks.abilityFamilyTree = null;
  }
}

let G = {
  player: null, enemy: null, stage: 1, turn: 'player', turnPhase:TURN.PLAYER,
  playerStatus:{}, enemyStatus:{},
  crowDefendCooldown:0, blackbirdAttackCount:0,
  enemyNextAction:null, animLock:false, battleOver:false,
  pendingLevelUp:false,
  bossDoublingRoundsLeft:0,
  endlessMode:false, endlessBattle:0,
  bossKills:0,
  // per-battle ability state
  swoopCooldown:0, hummingbirdDashCooldown:0, peregrineDiveCooldown:0, snowyOwlDiveCooldown:0, robinDartCooldown:0, bowerbirdLureCooldown:0, intimidateCooldown:0, fruitCooldown:0,
  stickLanceStage:0, flybyCharged:false, flybyUsed:false,
  rockDropPending:false, humTurns:0, humMissBonus:0,
  chargeUpActive:false,
  warcryActive:false, warcryATK:0,
  battleHymnActive:false, battleHymnDEF:0, battleHymnACC:0,
  serratedStacks:0,
  sitAndWaitActive:false,
  sitAndWaitUsedThisTurn:false,
  tookieActive:false, tookieMiss:0,
  tauntActive:false,
  regenTurns:0, regenPct:0,
  activeDodgeBuffs:{}, activeAccBuffs:{},
  _roostData:null,
  _pendingReward:null, _pendingLevelUp:false,
  // Enemy rage tracking
  enemyRageActive:false,
  enemyTurnCount:0,
  playerActionsThisTurn:0, enemyActionsThisTurn:0,
  playerTurnFlags:{energyGainedThisTurn:0,onHitTriggered:false},
  enemyUsedHardCCLastTurn:false,
  // Collected rewards list (for Nest display)
  collectedRewards:[],
  _goldReplaceMode:false,
  // Run unlock tracking
  runCrits:0, runBuffs:0, runDebuffs:0,
  runUpgradesPurchased:new Set(),
  codex:{abilities:{},enemies:{},birds:{},artifacts:{},statuses:{}},
  // Economy
  shinyObjects:0,
  /** Story overworld only; mirrored from save (see ow_enemy_population.js). */
  overworldEnemySeedPack:null,
  _pendingStorkShop:false,
  _pendingShopMode:null,
  runClassPerks:[],
  classPerks:{},
  _classPerkChoicesGranted:0,
  autoQueuedAbilityId:null,
  abilityCooldowns:{},
  _actionTapLockUntil:0,
  _unlockPopups:[],
  phase:'PLAYER',
  actionQueue:[],
  actionBusy:false,
  speed:1,
  ui:{
    gameMode:'story',
    battleLayout:'mobile',
    selectionView:'size',
    expandedBird:null,
    combatDropdownOpen:{player:true,enemy:true},
  },
};
globalThis.G = G;

function _agentDbgLog(location, message, data, hypothesisId) {
  const payload = { sessionId: '5e515f', location, message, data: data || {}, timestamp: Date.now(), hypothesisId: hypothesisId || '' };
  try {
    const k = 'avianAscent_dbg_5e515f';
    const arr = JSON.parse(localStorage.getItem(k) || '[]');
    arr.push(payload);
    if (arr.length > 300) arr.splice(0, arr.length - 300);
    localStorage.setItem(k, JSON.stringify(arr));
  } catch (_) {}
  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5e515f' }, body: JSON.stringify(payload) }).catch(() => {});
  // #endregion
}
globalThis._agentDbgLog = _agentDbgLog;

const DEFAULT_UI_STATE = Object.freeze({
  gameMode:'story',
  battleLayout:'mobile',
  selectionView:'all',
  lockFilter:'unlocked',
  expandedBird:null,
  combatDropdownOpen:{player:true,enemy:true},
});

function ensureUIState(){
  if(!G.ui || typeof G.ui!=='object') G.ui={};
  G.ui.gameMode = (G.ui.gameMode==='endless') ? 'endless' : 'story';
  G.ui.battleLayout = (G.ui.battleLayout==='mobile') ? 'mobile' : 'desktop';
  G.ui.selectionView = String(G.ui.selectionView || DEFAULT_UI_STATE.selectionView);
  G.ui.lockFilter = ['all','unlocked','locked'].includes(G.ui.lockFilter) ? G.ui.lockFilter : DEFAULT_UI_STATE.lockFilter;
  G.ui.expandedBird = G.ui.expandedBird ? String(G.ui.expandedBird) : null;
  if(!G.ui.combatDropdownOpen || typeof G.ui.combatDropdownOpen!=='object') G.ui.combatDropdownOpen={};
  G.ui.combatDropdownOpen.player = !!G.ui.combatDropdownOpen.player;
  G.ui.combatDropdownOpen.enemy = !!G.ui.combatDropdownOpen.enemy;
  return G.ui;
}

const TELEMETRY_KEY='avianAscent_telemetry_v1';
function loadTelemetry(){
  try{return JSON.parse(localStorage.getItem(TELEMETRY_KEY)||'{"runs":[],"meta":{}}');}catch(_){return {runs:[],meta:{}};}
}
function saveTelemetry(data){
  try{localStorage.setItem(TELEMETRY_KEY, JSON.stringify(data));}catch(_){ }
}
function telemetryPushRun(run){
  const data = loadTelemetry();
  data.runs = Array.isArray(data.runs) ? data.runs : [];
  data.runs.unshift(run);
  data.runs = data.runs.slice(0, 120);
  saveTelemetry(data);
}
function getTelemetrySummary(){
  const runs = loadTelemetry().runs||[];
  if(!runs.length) return {runs:0, avgStage:0, topDeaths:[], winRateByBird:[]};
  const deaths = new Map();
  const birds = new Map();
  let stageTotal = 0;
  for(const r of runs){
    stageTotal += Number(r.stageReached||1);
    const death = String(r.deathCause||'unknown');
    deaths.set(death, (deaths.get(death)||0)+1);
    const b = String(r.bird||'unknown');
    if(!birds.has(b)) birds.set(b, {bird:b, runs:0, wins:0});
    const row = birds.get(b); row.runs++; if(r.won) row.wins++;
  }
  return {
    runs:runs.length,
    avgStage: +(stageTotal/runs.length).toFixed(2),
    topDeaths:[...deaths.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5),
    winRateByBird:[...birds.values()].map(x=>({...x, winRate:+((x.wins/Math.max(1,x.runs))*100).toFixed(1)})).sort((a,b)=>b.winRate-a.winRate)
  };
}
globalThis.getTelemetrySummary = getTelemetrySummary;

const HIGHSCORE_KEY='avian_highscores_v1';
function getRunSnapshot(){
  const p=G.player||{};
  return {
    birdKey:p.birdKey||'unknown',
    birdName:p.name||'Unknown',
    stage:G.endlessMode && G.stage>20 ? `Endless ${G.endlessBattle||Math.max(1,G.stage-20)}` : `Stage ${G.stage||1}`,
    stageNumber:Number(G.stage||1),
    endless:!!G.endlessMode,
    stats:{...(p.stats||{})},
    abilities:(p.abilities||[]).map(a=>{
      const t=ABILITY_TEMPLATES[a.id];
      return `${t?.name||a.id} Lv${a.level||1}`;
    }),
    upgrades:(G.collectedRewards||[]).map(r=>r.name),
    ts:Date.now()
  };
}
function saveHighscoreEntry(won=false){
  const snap=getRunSnapshot();
  const entry={...snap, won:!!won};
  try{
    const rows=JSON.parse(localStorage.getItem(HIGHSCORE_KEY)||'[]');
    rows.push(entry);
    rows.sort((a,b)=> (b.stageNumber||0)-(a.stageNumber||0) || Number(!!b.won)-Number(!!a.won));
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(rows.slice(0,20)));
  }catch(_){ }
}
function renderHighscoreBoard(){
  const grid=document.getElementById('highscore-grid');
  if(!grid) return;
  let rows=[];
  try{ rows=JSON.parse(localStorage.getItem(HIGHSCORE_KEY)||'[]'); }catch(_){ rows=[]; }
  if(!rows.length){
    grid.innerHTML='<div class="run-card"><div class="run-stage">No highscores yet</div><div class="run-meta">Finish a run to log your best attempts.</div></div>';
    return;
  }
  grid.innerHTML=rows.slice(0,8).map((r,i)=>`
    <div class="run-card">
      <div class="run-stage">#${i+1} · ${r.stage}${r.won?' · 👑 Win':''}</div>
      <div class="run-bird">${r.birdName||r.birdKey}</div>
      <div class="run-meta">HP ${r.stats?.hp||0}/${r.stats?.maxHp||0} · ATK ${r.stats?.atk||0} · DEF ${r.stats?.def||0} · SPD ${r.stats?.spd||0}</div>
      <div class="run-meta">${(r.abilities||[]).slice(0,3).join(' · ')}</div>
      <div class="run-meta">Upgrades: ${((r.upgrades||[]).slice(0,2).join(' · '))||'—'}</div>
    </div>`).join('');
}

registerGameModule({
  id:'telemetry-persistence',
  onRunEnd(ctx){
    telemetryPushRun({
      bird: ctx?.bird || G.player?.birdKey || 'unknown',
      won: !!ctx?.won,
      stageReached: ctx?.stageReached || G.stage || 1,
      deathCause: ctx?.deathCause || 'unknown',
      at: Date.now(),
      endless: !!(ctx?.endless ?? G.endlessMode),
    });
  }
});

removeMimicEverywhere();

// ============================================================
//  SELECTION SCREEN
// ============================================================
// Dismiss tooltip on outside tap (mobile)
document.addEventListener('touchstart',e=>{
  const tt=document.getElementById('action-tooltip');
  if(!tt||tt.style.display!=='block') return;
  const keep = e.target.closest('.action-btn,#action-tooltip,.stat-mini,#passive-badge,.enemy-ab-tag,[data-nest-item],[data-nest-inv],[data-reward-mutation]');
  if(!keep) hideTooltip();
},{passive:true});

// ============================================================
//  COMBO SYSTEM (removed — no-ops keep legacy call sites stable)
// ============================================================
function registerHit() {}
function registerMiss() {}

// ============================================================
//  PASSIVE TRAIT HELPERS
// ============================================================
function triggerPassive(trigger, ...args) {
  const bd=BIRDS[G.player.birdKey];
  if(!bd||!bd.passive) return;
  if(bd.passive[trigger]) bd.passive[trigger](G.player,...args);
}
function renderPassiveBadge() {
  const badge=document.getElementById('passive-badge');
  if(!badge) return;
  const key=G.player?.birdKey||G.selected;
  const bd=key&&BIRDS[key];
  if(bd&&bd.passive){
    badge.textContent=`★ ${bd.passive.name}`;
    badge.title='';
    badge.style.display='inline-block';
    badge._richTooltipBound = false;
    bindRichTooltip(badge, () => buildPassiveTooltipHTML(key), { category: 'passives' });
  } else badge.style.display='none';
}

// ============================================================
//  NEST / INVENTORY
// ============================================================
function formatAbilityLevelPathway(tmpl){
  if(!tmpl || !Array.isArray(tmpl.levels) || !tmpl.levels.length) return '';
  return tmpl.levels
    .map((entry, idx)=>{
      const desc=String(entry?.desc || '').trim();
      return desc ? `Lv.${idx+1} · ${desc}` : '';
    })
    .filter(Boolean)
    .join('\n');
}
function makeMutatedFeatherShopOffer(){
  return {
    id:'shop_mutated_feather',
    tier:'purple',
    icon:'🪶',
    name:'Mutated Feather',
    desc:'Upgrade one equipped skill (use from Nest).',
    costOverride:78,
    isPinnedShopItem:true,
    isFeatherShopItem:true,
    shopCategory:'misc',
    stackable:false,
    apply(p){
      p.mutatedFeatherCount=(p.mutatedFeatherCount||0)+1;
    },
  };
}
try{ globalThis.makeMutatedFeatherShopOffer=makeMutatedFeatherShopOffer; }catch(_){}

function buildNestAbilitySection(player){
  ensureFamilyEvolutionState(player);
  if(typeof Avian?.shop?.ensureAbilityInventory==='function') Avian.shop.ensureAbilityInventory(player);
  const featherCt=Math.max(0, Number(player.mutatedFeatherCount)||0);
  const canMutate=featherCt>0;
  const selectedSlot=Number.isFinite(G._nestSelectedAbilitySlot)?G._nestSelectedAbilitySlot:null;
  const slots=getSkillSlots(player).slice().sort((a,b)=>a.slotIndex-b.slotIndex);
  let equippedHtml='';
  for(const slot of slots){
    const label=getSkillSlotDisplayLabel(slot);
    const pathLbl=slot.pathId?` · ${slot.pathId.replace(/_/g,' ')}`:'';
    const tierLbl=slot.abilityId?`Tier ${slot.tier||0}${pathLbl}`:'Empty';
    const isFlex=slot.slotIndex>=2;
    const isSelected=selectedSlot===slot.slotIndex;
    const action=slot.abilityId?resolveSkillSlotEvolutionAction(slot, player):'none';
    const mutateEnabled=canMutate && action!=='none';
    const tmpl=slot.abilityId?(ABILITY_TEMPLATES[slot.abilityId]||{}):{};
    const desc=tmpl.levels?.[0]?.desc||tmpl.desc||'';
    equippedHtml+=`<div class="nest-ab-slot-card${isSelected?' selected':''}${!slot.abilityId?' empty':''}" data-nest-ab-slot="${slot.slotIndex}">
      <div class="nest-ab-slot-head"><span class="nest-ab-slot-idx">Slot ${slot.slotIndex+1}</span>${isFlex && slot.abilityId?`<button type="button" class="nest-ab-unequip-btn" data-nest-ab-unequip="${slot.slotIndex}">Store</button>`:''}</div>
      <div class="nest-ab-name">${slot.abilityId?escapeHtmlRoster(label):'<span class="nest-inv-empty">Empty</span>'}</div>
      <div class="nest-ab-lv">${tierLbl}</div>
      ${desc?`<div class="nest-ab-desc">${escapeHtmlRoster(desc)}</div>`:''}
      ${slot.abilityId?`<button type="button" class="nest-mutate-btn${mutateEnabled?'':' disabled'}" data-nest-ab-mutate="${slot.slotIndex}" ${mutateEnabled?'':'disabled'} title="${mutateEnabled?'Spend 1 Mutated Feather to upgrade this skill':'Need a Mutated Feather in your Nest'}">Mutate Ability</button>`:''}
    </div>`;
  }
  const inv=player.abilityInventory||[];
  let vaultHtml='';
  if(!inv.length){
    vaultHtml=`<div class="nest-inv-empty">No shop abilities in vault. Buy abilities at Stork's Emporium.</div>`;
  } else {
    vaultHtml='<div class="nest-ability-vault-grid">';
    inv.forEach((entry, idx)=>{
      const name=entry.name||entry.abilityId||'Ability';
      vaultHtml+=`<div class="nest-ab-vault-item" data-nest-ab-vault="${idx}" title="Click to equip into selected flex slot (or first empty slot 3–4)"><strong>${escapeHtmlRoster(name)}</strong><br><span class="nest-ab-lv">Tier ${entry.tier||0}</span></div>`;
    });
    vaultHtml+='</div>';
  }
  const slotHint=selectedSlot!=null?`Selected slot ${selectedSlot+1} for equip.`:'Click a flex slot (3–4) to select, then click a vault ability to equip.';
  return `<div class="nest-section nest-ability-section"><div class="nest-section-title">⚔ Abilities · 🪶 Mutated Feathers: ${featherCt}</div><div class="nest-ledger-subtitle">Equipped loadout</div><div class="nest-abilities-grid">${equippedHtml}</div><div class="nest-ledger-subtitle">Ability vault (${inv.length})</div>${vaultHtml}<p class="nest-ledger-note">${slotHint} Starter slots (1–2) mutate with feathers but stay fixed. Flex slots (3–4) hold shop abilities.</p></div>`;
}

function setNestMutateConfirmVisible(visible, enabled){
  const confirm=document.getElementById('nest-mutate-confirm');
  if(!confirm) return;
  confirm.className=visible?'confirm-btn visible':'confirm-btn';
  confirm.disabled=!visible||!enabled;
}

function closeNestMutateModal(){
  const modal=document.getElementById('nest-mutate-modal');
  if(modal){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
  const grid=document.getElementById('nest-mutate-grid');
  if(grid) grid.innerHTML='';
  setNestMutateConfirmVisible(false, false);
  delete G._nestMutateSelectedId;
  delete G._nestMutateAction;
}

function updateNestMutateSelection(card, selectedId){
  document.querySelectorAll('#nest-mutate-grid .skill-upgrade-card').forEach(x=>x.classList.remove('selected'));
  if(card) card.classList.add('selected');
  G._nestMutateSelectedId=selectedId;
  setNestMutateConfirmVisible(true, !!selectedId);
}

function confirmNestMutateChoice(){
  const slot=getSkillSlotByIndex(G.player, G._nestMutateSlotIndex);
  if(!slot || !G.player) return;
  const action=G._nestMutateAction;
  if(action==='choose_path'){
    const pathId=G._nestMutateSelectedId;
    if(!pathId){ logMsg('Choose a path first.','miss'); return; }
    const before=ABILITY_TEMPLATES?.[slot.abilityId]?.name||slot.abilityId;
    applySkillPathSelection(slot, pathId, G.player);
    const after=ABILITY_TEMPLATES?.[slot.abilityId]?.name||slot.abilityId;
    finalizeSkillEvolutionChoice(`🧬 ${before} committed to the ${pathId.replace(/_/g,' ')} path → ${after}.`);
    return;
  }
  if(action==='tier_up'){
    const before=ABILITY_TEMPLATES?.[slot.abilityId]?.name||slot.abilityId;
    autoUpgradeSkillSlotTier(slot, G.player);
    const after=ABILITY_TEMPLATES?.[slot.abilityId]?.name||slot.abilityId;
    finalizeSkillEvolutionChoice(`🧬 ${before} evolved into ${after}!`);
  }
}

function attachNestMutateCardTooltip(card, abilityId){
  if(!card || !abilityId) return;
  const abObj=()=>ensureAbilityObjectFromTemplate(abilityId, null, G._nestMutateSlotIndex, G.player);
  card.addEventListener('mouseenter',e=>{if(!window._isTouchDevice)showActionTooltip(e,abObj());});
  card.addEventListener('mousemove',e=>{if(!window._isTouchDevice)moveTooltip(e);});
  card.addEventListener('mouseleave',()=>{if(!window._isTouchDevice)hideTooltip();});
}

function renderNestMutatePathChoices(slot){
  const grid=document.getElementById('nest-mutate-grid');
  const title=document.getElementById('nest-mutate-title');
  const sub=document.getElementById('nest-mutate-sub');
  const confirm=document.getElementById('nest-mutate-confirm');
  if(!grid) return;
  const family=getSkillSlotFamilyDef(slot, G.player?.birdKey);
  const currentTmpl=ABILITY_TEMPLATES?.[slot.abilityId]||{};
  if(title) title.textContent=`🧬 ${family?.displayName||'Skill Evolution'}`;
  if(sub) sub.textContent=`Choose 1 of 3 tier-1 branches for ${currentTmpl.name||getSkillSlotDisplayLabel(slot)}.`;
  delete G._nestMutateSelectedId;
  if(confirm) confirm.textContent='✓ Confirm Mutation';
  setNestMutateConfirmVisible(true, false);
  grid.innerHTML='';
  const options=getSkillEvolutionPathOptions(slot, G.player?.birdKey);
  if(!options.length){
    grid.innerHTML='<p style="color:var(--text-dim);text-align:center;padding:12px 0;grid-column:1/-1;">This ability cannot be mutated yet.</p>';
    setNestMutateConfirmVisible(false, false);
    return;
  }
  options.forEach(option=>{
    const tmpl=option.abilityTemplate||{};
    const card=document.createElement('div');
    card.className='skill-upgrade-card';
    card.innerHTML=`<div class="su-name">${option.displayName}</div><div class="su-lv">Tier 1 · ${tmpl.name||option.abilityId}</div><div class="su-effect">${tmpl.levels?.[0]?.desc||tmpl.desc||'No description available.'}</div>`;
    attachNestMutateCardTooltip(card, option.abilityId);
    card.onclick=()=>updateNestMutateSelection(card, option.pathId);
    grid.appendChild(card);
  });
}

function renderNestMutateTierPreview(slot){
  const grid=document.getElementById('nest-mutate-grid');
  const title=document.getElementById('nest-mutate-title');
  const sub=document.getElementById('nest-mutate-sub');
  const confirm=document.getElementById('nest-mutate-confirm');
  if(!grid) return;
  const nextTier=(slot.tier||0)+1;
  const path=getSkillSlotPathDef(slot, G.player?.birdKey);
  const nextId=path?.abilities?.[nextTier];
  const currentTmpl=ABILITY_TEMPLATES?.[slot.abilityId]||{};
  const nextTmpl=ABILITY_TEMPLATES?.[nextId]||{};
  if(title) title.textContent='🧬 Preview Tier Upgrade';
  if(sub) sub.textContent=`${currentTmpl.name||slot.abilityId} will evolve into ${nextTmpl.name||nextId}.`;
  grid.innerHTML=`<div class="skill-upgrade-card selected"><div class="su-name">${currentTmpl.name||slot.abilityId} → ${nextTmpl.name||nextId}</div><div class="su-lv">Tier ${slot.tier||0} → Tier ${nextTier}</div><div class="su-effect">${nextTmpl.levels?.[0]?.desc||nextTmpl.desc||'No description available.'}</div></div>`;
  attachNestMutateCardTooltip(grid.querySelector('.skill-upgrade-card'), nextId);
  if(confirm) confirm.textContent='✓ Confirm Mutation';
  setNestMutateConfirmVisible(true, true);
}

function openNestMutateModal(slot, action){
  wireNestMutateModal();
  G._nestMutateAction=action;
  delete G._nestMutateSelectedId;
  const modal=document.getElementById('nest-mutate-modal');
  const sub=document.getElementById('nest-mutate-sub');
  if(sub) sub.textContent=`Spend 1 Mutated Feather to evolve ${getSkillSlotDisplayLabel(slot)}.`;
  if(action==='choose_path') renderNestMutatePathChoices(slot);
  else if(action==='tier_up') renderNestMutateTierPreview(slot);
  if(modal){ modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); }
}

function beginNestMutateFlow(slotIndex){
  if(!G.player || (G.player.mutatedFeatherCount||0)<=0){
    logMsg('No Mutated Feather available. Buy one at Stork\'s shop or find one as a rare drop.','miss');
    return;
  }
  ensureFamilyEvolutionState(G.player);
  const slot=getSkillSlotByIndex(G.player, slotIndex);
  if(!slot?.abilityId){ logMsg('That slot has no ability to mutate.','miss'); return; }
  const action=resolveSkillSlotEvolutionAction(slot, G.player);
  if(action==='none'){ logMsg('That skill is fully evolved.','miss'); return; }
  if(!getSkillSlotFamilyDef(slot, G.player?.birdKey)){
    logMsg('This ability has no evolution tree available.','miss');
    return;
  }
  G._nestMutateFlow=true;
  G._nestMutateSlotIndex=slotIndex;
  openNestMutateModal(slot, action);
}

function cancelNestMutateFlow(){
  G._nestMutateFlow=false;
  G._nestMutateSlotIndex=null;
  closeNestMutateModal();
}

function wireNestMutateModal(){
  const modal=document.getElementById('nest-mutate-modal');
  if(!modal || modal.dataset.nestMutateWired==='1') return;
  modal.dataset.nestMutateWired='1';
  document.getElementById('nest-mutate-cancel')?.addEventListener('click', e=>{ e.preventDefault(); cancelNestMutateFlow(); });
  document.getElementById('nest-mutate-close-btn')?.addEventListener('click', e=>{ e.preventDefault(); cancelNestMutateFlow(); });
  document.getElementById('nest-mutate-confirm')?.addEventListener('click', e=>{ e.preventDefault(); confirmNestMutateChoice(); });
  modal.addEventListener('click', e=>{ if(e.target===modal) cancelNestMutateFlow(); });
}

function handleNestAbilityClick(ev){
  const el=ev.target.closest('[data-nest-ab-slot],[data-nest-ab-vault],[data-nest-ab-mutate],[data-nest-ab-unequip]');
  if(!el || !G.player) return;
  ev.stopPropagation();
  if(el.dataset.nestAbMutate!=null){
    beginNestMutateFlow(Number(el.dataset.nestAbMutate));
    return;
  }
  if(el.dataset.nestAbUnequip!=null){
    const si=Number(el.dataset.nestAbUnequip);
    if(typeof Avian?.shop?.unequipToVault==='function' && Avian.shop.unequipToVault(G.player, si)){
      saveRun(); openNest();
    }
    return;
  }
  if(el.dataset.nestAbVault!=null){
    const vi=Number(el.dataset.nestAbVault);
    const target=Number.isFinite(G._nestSelectedAbilitySlot)?G._nestSelectedAbilitySlot:undefined;
    if(typeof Avian?.shop?.equipVaultAbility==='function' && Avian.shop.equipVaultAbility(G.player, vi, target)){
      saveRun(); openNest();
    }
    return;
  }
  if(el.dataset.nestAbSlot!=null){
    G._nestSelectedAbilitySlot=Number(el.dataset.nestAbSlot);
    openNest();
  }
}

function openNest() {
  const modal=document.getElementById('nest-modal');
  const content=document.getElementById('nest-content');
  const sub=document.getElementById('nest-subtitle');
  const p=G.player;
  if(!p){content.innerHTML='<p style="color:var(--text-dim);text-align:center">No active run.</p>';modal.classList.add('open');return;}
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function') Avian.mutations.reapplyPlayerStatsFromSources(p);
  sub.textContent=`${p.name} · Stage ${G.stage} · Lv.${p.birdLevel} · 🪶 ${Math.max(0, Number(p.mutatedFeatherCount)||0)}`;
  let html='';
  // Stats (top of Nest)
  const s=p.stats;
  const _nestWarcry=G.warcryActive?(s.atk||0)*(1+G.warcryATK/100):s.atk;
  const _nestDef=s.def+(G.battleHymnActive?G.battleHymnDEF:0);
  const _nestAcc=Math.min(100,s.acc+(G.battleHymnActive?G.battleHymnACC:0)-(G.playerStatus.accDebuff||0));
  const _nestDodge=getEffectiveDodge(p);
  const _nestCrit=Math.min(100,(s.critChance||5)+(p._velocityStacks||0));
  const _eqMech=typeof Avian?.mutations?.getMechanicsRollup==='function'?Avian.mutations.getMechanicsRollup(p):null;
  const _nestCritMultBase=p.goldCritMult||1.8;
  const _nestCritBonusPct=(p.critDamageBonusPct||0)+(_eqMech?.critDamageBonusPct||0);
  const _nestCritMultDisp=_nestCritBonusPct>0?`${formatCombatNumber(_nestCritMultBase)}× <span class="nest-crit-bonus" title="Added to multiplier on critical hits">(+${formatCombatNumber(_nestCritBonusPct)})</span>`:`${formatCombatNumber(_nestCritMultBase)}×`;
  function _nestStat(val,base,suffix=''){const d=val-base;const col=d>0?'var(--red-light)':d<0?'var(--purple-light)':'var(--gold)';const arr=d>0?' ▲':d<0?' ▼':'';return `<span style="color:${col}">${formatCombatNumber(val)}${suffix}${arr}</span>`;}
  html+=`<div class="nest-section"><div class="nest-section-title">📊 Stats ${G.turn?'(In Battle)':''}</div>
  <div class="nest-stats-grid">
    <div class="nest-stat-card"><div class="nest-stat-val">${formatCombatNumber(s.hp)}/${formatCombatNumber(s.maxHp)}</div><div class="nest-stat-lbl">HP</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val">${_nestStat(_nestWarcry,s.atk)}</div><div class="nest-stat-lbl">ATK</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val">${_nestStat(_nestDef,s.def)}</div><div class="nest-stat-lbl">DEF</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val">${formatCombatNumber(s.spd)}</div><div class="nest-stat-lbl">SPD</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val">${_nestStat(_nestDodge,s.dodge,'%')}</div><div class="nest-stat-lbl">DODGE</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val">${_nestStat(_nestAcc,s.acc,'%')}</div><div class="nest-stat-lbl">ACC</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val" style="color:${_nestCrit>5?'#e8c96a':'var(--gold)'}">${formatCombatNumber(_nestCrit)}%</div><div class="nest-stat-lbl">🎯 Crit %</div></div>
    <div class="nest-stat-card"><div class="nest-stat-val" style="color:${_nestCritMultBase>1.5||_nestCritBonusPct>0?'#e8c96a':'var(--gold)'}">${_nestCritMultDisp}</div><div class="nest-stat-lbl">💥 Crit Dmg</div></div>
    <div class="nest-stat-card" title="Magic Attack — improves spell and ailment potency"><div class="nest-stat-val" style="color:#6ae8e8">${formatCombatNumber(s.matk||8)}</div><div class="nest-stat-lbl" style="color:#4ab8c0">✦ M.ATK</div></div>
    <div class="nest-stat-card" title="Magic Defence — resists enemy spells and ailments"><div class="nest-stat-val" style="color:#6ae8e8">${formatCombatNumber(s.mdef||8)}</div><div class="nest-stat-lbl" style="color:#4ab8c0">✦ M.DEF</div></div>
    ${(s.armorPen||0)>0?`<div class="nest-stat-card" title="Ignores enemy DEF when dealing physical damage"><div class="nest-stat-val">${formatCombatNumber(s.armorPen)}%</div><div class="nest-stat-lbl">Armour Pen</div></div>`:''}
    ${(s.magicPen||0)>0?`<div class="nest-stat-card" title="Ignores enemy MDEF when dealing magical damage"><div class="nest-stat-val">${formatCombatNumber(s.magicPen)}%</div><div class="nest-stat-lbl">Magic Pen</div></div>`:''}
  </div></div>`;
  // Passive trait + authored class perk
  const passInfo=getBirdPassiveInfo(p.birdKey);
  if(passInfo){
    html+=`<div class="nest-passive"><div class="nest-passive-title">★ PASSIVE: ${escapeHtmlRoster(passInfo.name)}</div><div class="nest-passive-desc">${escapeHtmlRoster(passInfo.desc||passInfo.effect||'')}</div></div>`;
  }
  const authoredPerk=getBirdAuthoredClassPerk(p.birdKey);
  if(authoredPerk){
    html+=`<div class="nest-passive nest-class-perk"><div class="nest-passive-title">🧬 CLASS PERK: ${escapeHtmlRoster(authoredPerk.name)}</div><div class="nest-passive-desc">${escapeHtmlRoster(authoredPerk.effect||'')}</div></div>`;
  }
  const ownedClassPerks=getBirdClassPerks(p.birdKey);
  if(ownedClassPerks.length){
    const role=getBirdClassRoleByKey(p.birdKey);
    const perkCards=ownedClassPerks.map(perkId=>{
      const perk=(CLASS_PERK_BY_CLASS[role]||[]).find(entry=>entry.id===perkId);
      if(!perk) return '';
      return `<div class="nest-reward-row"><span class="nest-reward-icon">🧬</span><span class="nest-reward-name">${perk.name}</span><span class="nest-reward-desc">${perk.desc}</span></div>`;
    }).join('');
    if(perkCards){
      html+=`<div class="nest-section"><div class="nest-section-title">🧬 Class Perks · ${idToClassLabel(role)}</div><div class="nest-rewards-list">${perkCards}</div></div>`;
    }
  }
  html+=buildNestEquipmentSection(p);
  html+=buildNestAbilitySection(p);
  // Run bonuses (feathers / card stats / mechanics) — above collected card list
  const Ldg=p._statLedger;
  const upgMap=Ldg?.fromUpgrades||{};
  const lvlMap=Ldg?.fromLevel||{};
  const eqMap=Ldg?.fromEquipment||{};
  const nestEqRows=[];
  const nestUpgRows=[];
  const nestLvlRows=[];
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const ev=Number(eqMap[k]||0);
    if(Math.abs(ev)>0.0001) nestEqRows.push(`<div class="nest-ledger-row"><span class="nest-ledger-k">${STAT_LEDGER_LABELS[k]||k}</span><span class="nest-ledger-v">+${formatLedgerDelta(ev)}</span></div>`);
  }
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const uv=Number(upgMap[k]||0);
    if(Math.abs(uv)>0.0001) nestUpgRows.push(`<div class="nest-ledger-row"><span class="nest-ledger-k">${STAT_LEDGER_LABELS[k]||k}</span><span class="nest-ledger-v">+${formatLedgerDelta(uv)}</span></div>`);
  }
  for(const k of STAT_LEDGER_TRACKED_KEYS){
    const lv=Number(lvlMap[k]||0);
    if(Math.abs(lv)>0.0001) nestLvlRows.push(`<div class="nest-ledger-row"><span class="nest-ledger-k">${STAT_LEDGER_LABELS[k]||k}</span><span class="nest-ledger-v">+${formatLedgerDelta(lv)}</span></div>`);
  }
  const mechFromCards=(Ldg?.mechanicalLines||[]).map(l=>escapeHtmlRoster(l));
  const mechDerived=getDerivedMechanicalBonusLines(p).map(l=>escapeHtmlRoster(l));
  const mechSeen=new Set();
  const mechCombined=[];
  for(const line of [...mechFromCards,...mechDerived]){ if(line && !mechSeen.has(line)){ mechSeen.add(line); mechCombined.push(line); } }
  const mechHtml=mechCombined.length?`<div class="nest-ledger-mech-block">${mechCombined.map(l=>`<div class="nest-ledger-mech">${l}</div>`).join('')}</div>`:'';
  if(nestUpgRows.length||nestLvlRows.length||nestEqRows.length||mechHtml){
    html+=`<div class="nest-section nest-ledger-section"><div class="nest-section-title">✨ Run bonuses (from Feathers &amp; cards)</div>`;
    if(nestLvlRows.length) html+=`<div class="nest-ledger-subtitle">Level-up (Feathers)</div><div class="nest-ledger-grid">${nestLvlRows.join('')}</div>`;
    if(nestEqRows.length) html+=`<div class="nest-ledger-subtitle">Equipped mutations</div><div class="nest-ledger-grid">${nestEqRows.join('')}</div>`;
    if(nestUpgRows.length) html+=`<div class="nest-ledger-subtitle">Card / shop / reward stats</div><div class="nest-ledger-grid">${nestUpgRows.join('')}</div>`;
    if(mechHtml) html+=`<div class="nest-ledger-subtitle">Card &amp; passive combat modifiers</div>${mechHtml}`;
    html+=`</div>`;
  }
  // Collected rewards
  if(G.collectedRewards&&G.collectedRewards.length>0){
    // Group duplicates
    const rewardMap=new Map();
    G.collectedRewards.forEach(r=>{
      const key=r.id||r.name;
      if(rewardMap.has(key)){rewardMap.get(key).count++;}
      else{rewardMap.set(key,{...r,count:1});}
    });
    const tierOrder={gold:0,purple:1,blue:2,green:3,grey:4};
    const grouped=[...rewardMap.values()].sort((a,b)=>(tierOrder[a.tier]||4)-(tierOrder[b.tier]||4));
    html+=`<div class="nest-section"><div class="nest-section-title">🎁 Collected Rewards (${G.collectedRewards.length})</div><div class="nest-rewards-list">`;
    grouped.forEach(r=>{
      const tierColor={gold:'var(--gold)',purple:'var(--purple-light)',blue:'var(--blue-light)',green:'var(--green-light)',grey:'var(--text-dim)'}[r.tier]||'var(--text-dim)';
      const countBadge=r.count>1?`<span style="background:rgba(201,168,76,.2);border:1px solid var(--gold);border-radius:10px;padding:1px 7px;font-size:.72rem;color:var(--gold);font-family:Cinzel,serif;margin-left:6px">${r.count}×</span>`:'';
      html+=`<div class="nest-reward-row"><span class="nest-reward-icon">${r.icon}</span><span class="nest-reward-name" style="color:${tierColor}">${r.name}${countBadge}</span><span class="nest-reward-desc">${r.desc}</span></div>`;
    });
    html+=`</div></div>`;
  }
  content.innerHTML=html;
  content.onclick=(ev)=>{
    if(ev.target.closest('[data-nest-ab-slot],[data-nest-ab-vault],[data-nest-ab-mutate],[data-nest-ab-unequip]')){
      handleNestAbilityClick(ev);
      return;
    }
    handleNestEquipClick(ev);
  };
  wireNestMutationTooltips(content);
  modal.classList.add('open');
}
function notifyOwUiEmbedClose(){
  if(!globalThis.__AVIAN_OW_UI_EMBED__ && !globalThis.__AVIAN_OW_NEST_EMBED__) return;
  if(typeof window === 'undefined' || !window.parent || window.parent === window) return;
  try{ window.parent.postMessage({ type: 'avianOwUiClose' }, '*'); }catch(_){}
  try{ window.parent.postMessage({ type: 'avianOwNestClose' }, '*'); }catch(_){}
}
function closeNest() {
  document.getElementById('nest-modal').classList.remove('open');
  const content=document.getElementById('nest-content');
  if(content) content.onclick=null;
  notifyOwUiEmbedClose();
}

function nestTierCssClass(tier){
  return normalizeRewardTier(tier);
}
function nestTierColorVar(tier){
  const key=nestTierCssClass(tier);
  return {grey:'var(--tier-grey)',green:'var(--tier-green)',blue:'var(--tier-blue)',purple:'var(--tier-purple)',gold:'var(--gold)'}[key]||'var(--gold)';
}
function getNestSlotIcons(){
  return Avian?.mutations?.SLOT_ICONS||{};
}

const NEST_MUT_COMPARE_LS_KEY='avian_nest_mut_compare';
function readNestMutCompareMode(){
  if(G._nestMutCompare!=null) return !!G._nestMutCompare;
  try{
    const v=localStorage.getItem(NEST_MUT_COMPARE_LS_KEY);
    if(v!=null) G._nestMutCompare=(v==='1'||v==='true');
  }catch(_){}
  if(G._nestMutCompare==null) G._nestMutCompare=false;
  return G._nestMutCompare;
}
function setNestMutCompareMode(on){
  G._nestMutCompare=!!on;
  try{ localStorage.setItem(NEST_MUT_COMPARE_LS_KEY,G._nestMutCompare?'1':'0'); }catch(_){}
}
function _nestInventoryMutStatsHtml(player,itemId,compareMode){
  const item=typeof Avian?.mutations?.getItem==='function'?Avian.mutations.getItem(itemId):null;
  if(!item) return '';
  let statsHtml='';
  if(compareMode && typeof Avian?.mutations?.formatMutationCompareHtml==='function'){
    const baseId=typeof Avian?.mutations?.getCompareBaselineId==='function'?Avian.mutations.getCompareBaselineId(player,itemId):null;
    const baseline=baseId?Avian.mutations.getItem(baseId):null;
    statsHtml=Avian.mutations.formatMutationCompareHtml(item,baseline);
  } else {
    statsHtml=getMutationDescHtml(item,{compact:true});
  }
  if(!statsHtml) return '';
  return `<div class="nest-mut-stats mut-stat-compact-wrap">${statsHtml}</div>`;
}

function _nestMutationItemHtml(itemId, slotLbl, slotKey, slotIndex){
  const icons=getNestSlotIcons();
  const slotBadge=icons[slotKey]?`<span class="nest-slot-badge" title="${escapeHtmlRoster(slotLbl)}">${icons[slotKey]}</span>`:'';
  if(!itemId){
    return `<div class="nest-equip-slot" data-nest-slot="${slotKey}" data-nest-idx="${slotIndex}"><div class="nest-equip-slot-lbl">${slotBadge}${slotLbl}</div><div class="nest-equip-slot-name" style="color:var(--text-dim)">Empty</div></div>`;
  }
  const item=typeof Avian?.mutations?.getItem==='function'?Avian.mutations.getItem(itemId):null;
  if(!item){
    return `<div class="nest-equip-slot" data-nest-slot="${slotKey}" data-nest-idx="${slotIndex}"><div class="nest-equip-slot-lbl">${slotBadge}${slotLbl}</div><div class="nest-equip-slot-name" style="color:var(--text-dim)">Empty</div></div>`;
  }
  const tierCss=nestTierCssClass(item.tier);
  const tierMeta=rewardTierMeta(item.tier);
  const tierColor=nestTierColorVar(item.tier);
  const statsBlock=getMutationDescHtml(item,{compact:true});
  const statsHtml=statsBlock?`<div class="nest-mut-stats mut-stat-compact-wrap nest-equip-mut-stats">${statsBlock}</div>`:'';
  return `<div class="nest-equip-slot filled tier-${item.tier} tier-ui-${tierCss}" data-nest-slot="${slotKey}" data-nest-idx="${slotIndex}" data-nest-item="${itemId}"><div class="nest-equip-slot-lbl">${slotBadge}${slotLbl}</div><div class="nest-tier-label" style="color:${tierColor}">${tierMeta.label}</div><div class="nest-equip-slot-name" style="color:${tierColor}">${escapeHtmlRoster(item.name)}</div>${statsHtml}</div>`;
}

function handleNestEquipClick(ev){
  const compareToggle=ev.target.closest('[data-nest-compare-toggle]');
  if(compareToggle){
    setNestMutCompareMode(compareToggle.checked);
    openNest();
    return;
  }
  const el=ev.target.closest('[data-nest-slot],[data-nest-inv],[data-nest-filter]');
  if(!el || !G.player) return;
  if(el.dataset.nestFilter){
    G._nestActiveSlotFilter=el.dataset.nestFilter;
    openNest();
    return;
  }
  if(el.dataset.nestInv){
    const itemId=el.dataset.nestInv;
    if(typeof Avian?.mutations?.equipAuto==='function') Avian.mutations.equipAuto(G.player, itemId);
    saveRun(); openNest(); return;
  }
  const slotKey=el.dataset.nestSlot;
  const slotIndex=Number(el.dataset.nestIdx)||0;
  if(el.dataset.nestItem){
    if(typeof Avian?.mutations?.unequip==='function') Avian.mutations.unequip(G.player, slotKey, slotIndex);
    saveRun(); openNest(); return;
  }
}

function buildNestEquipmentSection(player){
  if(typeof Avian?.mutations?.ensurePlayerMutationState!=='function') return '';
  Avian.mutations.ensurePlayerMutationState(player);
  const slotsDef=Avian.data?.mutations?.slots;
  const order=slotsDef?.order||['wing','feet','head','beak','chest','eyes','tail','plumage','syrinx'];
  const limits=slotsDef?.limits||{};
  const labels=Avian.mutations.SLOT_LABELS||{};
  const icons=getNestSlotIcons();
  if(!G._nestActiveSlotFilter || (G._nestActiveSlotFilter!=='all' && !order.includes(G._nestActiveSlotFilter))) G._nestActiveSlotFilter='all';
  const activeFilter=G._nestActiveSlotFilter;
  const filterHtml=`<div class="nest-slot-filters"><button type="button" class="nest-slot-filter${activeFilter==='all'?' active':''}" data-nest-filter="all">🧬 All</button>${order.map(sk=>{
    const active=sk===activeFilter?' active':'';
    const icon=icons[sk]||'🧬';
    return `<button type="button" class="nest-slot-filter${active}" data-nest-filter="${sk}">${icon} ${escapeHtmlRoster(labels[sk]||sk)}</button>`;
  }).join('')}</div>`;
  const eq=player.equippedMutations||{};
  let slotsHtml='';
  const slotKeys=activeFilter==='all'?order:[activeFilter];
  for(const sk of slotKeys){
    const cap=limits[sk]||1;
    const arr=Array.isArray(eq[sk])?eq[sk]:[];
    for(let i=0;i<cap;i++){
      const lbl=activeFilter==='all'
        ? (cap>1?`${labels[sk]||sk} ${i+1}`:(labels[sk]||sk))
        : (cap>1?`${labels[sk]||sk} ${i+1}`:(labels[sk]||sk));
      slotsHtml+=_nestMutationItemHtml(arr[i]||null, lbl, sk, i);
    }
  }
  const summary=typeof Avian.mutations.getEquippedSummary==='function'?Avian.mutations.getEquippedSummary(player):{lines:[]};
  const bonusHtml=(summary.lines||[]).map(l=>{
    const valStr=String(l.value);
    const valDisp=valStr.includes('%')?valStr:formatCombatNumber(l.value);
    return `<span class="nest-equip-bonus-chip">${escapeHtmlRoster(l.label)} ${escapeHtmlRoster(valDisp)}</span>`;
  }).join('')||'<span class="nest-inv-empty">No mutation bonuses yet.</span>';
  const inv=player.mutationInventory||[];
  const filteredInv=inv.filter(entry=>{
    const id=typeof entry==='string'?entry:entry?.itemId;
    const item=Avian.mutations.getItem(id);
    if(!item) return false;
    return activeFilter==='all' || item.slot===activeFilter;
  });
  const filterLabel=activeFilter==='all'?'All mutations':(labels[activeFilter]||activeFilter);
  const compareMode=readNestMutCompareMode();
  const compareToggleHtml=`<div class="nest-compare-toggle-row"><label class="nest-compare-toggle"><input type="checkbox" data-nest-compare-toggle${compareMode?' checked':''}/><span class="nest-compare-switch" aria-hidden="true"></span><span class="nest-compare-label">Compare to equipped</span></label></div>`;
  let invHtml='';
  if(!filteredInv.length){
    invHtml=`<div class="nest-inv-empty">No ${escapeHtmlRoster(filterLabel)} in inventory.</div>`;
  } else {
    invHtml='<div class="nest-inventory-grid">';
    for(const entry of filteredInv){
      const id=typeof entry==='string'?entry:entry?.itemId;
      const item=Avian.mutations.getItem(id);
      if(!item) continue;
      const tierCss=nestTierCssClass(item.tier);
      const tierMeta=rewardTierMeta(item.tier);
      const tierColor=nestTierColorVar(item.tier);
      const slotBadge=icons[item.slot]?`<span class="nest-slot-badge">${icons[item.slot]}</span>`:'';
      const statsBlock=_nestInventoryMutStatsHtml(player,id,compareMode);
      invHtml+=`<div class="nest-inv-item tier-${item.tier} tier-ui-${tierCss}" data-nest-inv="${id}">${slotBadge}<div class="nest-tier-label" style="color:${tierColor}">${tierMeta.label}</div><strong style="color:${tierColor}">${escapeHtmlRoster(item.name)}</strong><br><span style="color:${tierColor}">${escapeHtmlRoster(labels[item.slot]||item.slot)}</span>${statsBlock}</div>`;
    }
    invHtml+='</div>';
  }
  return `<div class="nest-section nest-equipment-section"><div class="nest-section-title">🧬 Mutations Equipped</div>${filterHtml}<div class="nest-ledger-subtitle">Equipped · ${escapeHtmlRoster(filterLabel)}</div><div class="nest-equip-grid${activeFilter==='all'?' nest-equip-grid-all':''}">${slotsHtml}</div>${compareToggleHtml}<div class="nest-ledger-subtitle">Bonus from equipped</div><div class="nest-equip-bonus">${bonusHtml}</div><div class="nest-section-title" style="margin-top:14px">🎒 Inventory · ${escapeHtmlRoster(filterLabel)} (${filteredInv.length})</div>${invHtml}<p class="nest-ledger-note">Select a slot type above. Click inventory items to equip. Click equipped items to store in inventory.${compareMode?' Compare mode shows stat changes vs the equipped mutation in the slot you would replace.':''}</p></div>`;
}

/**
 * Minimal bootstrap when index.html is loaded in an iframe from the overworld map (?avianOwNestEmbed=1).
 * Reuses continueRun + openNest so the panel matches the main game nest exactly.
 */
function bootstrapOwNestEmbed(){
  try{
    const a=document.getElementById('theme-bgm-audio');
    if(a){ try{ a.pause(); }catch(_){} }
  }catch(_){}
  const save=loadSaveData();
  if(!save?.player){
    G.player=null;
    openNest();
    return;
  }
  G._continueRunOpenNestOnly=true;
  try{
    continueRun();
  }catch(err){
    console.error('bootstrapOwNestEmbed failed', err);
    G._continueRunOpenNestOnly=false;
    try{
      G.player=save.player||null;
      openNest();
    }catch(_){}
  }
}
function bootstrapOwSettingsEmbed(){
  try{
    const a=document.getElementById('theme-bgm-audio');
    if(a){ try{ a.pause(); }catch(_){} }
  }catch(_){}
  const save=loadSaveData();
  if(save?.player){
    G._continueRunOpenNestOnly=true;
    try{ continueRun(); }catch(_){ G._continueRunOpenNestOnly=false; G.player=save.player||null; }
  }
  openSettingsModal();
}
function bootstrapOwReferenceEmbed(){
  try{
    const a=document.getElementById('theme-bgm-audio');
    if(a){ try{ a.pause(); }catch(_){} }
  }catch(_){}
  const save=loadSaveData();
  if(save?.player){
    G._continueRunOpenNestOnly=true;
    try{ continueRun(); }catch(_){ G._continueRunOpenNestOnly=false; G.player=save.player||null; }
  }
  openRefGuideModal();
}
function bootstrapOwUiEmbed(){
  const mode=String(globalThis.__AVIAN_OW_UI_EMBED__||'nest');
  if(mode==='settings') bootstrapOwSettingsEmbed();
  else if(mode==='reference') bootstrapOwReferenceEmbed();
  else bootstrapOwNestEmbed();
}
globalThis.bootstrapOwNestEmbed=bootstrapOwNestEmbed;
globalThis.bootstrapOwUiEmbed=bootstrapOwUiEmbed;

function codexMark(type, id, field='seen'){
  if(!id) return;
  if(!G.codex) G.codex={abilities:{},enemies:{},birds:{},artifacts:{},statuses:{}};
  if(!G.codex[type]) G.codex[type]={};
  if(!G.codex[type][id]) G.codex[type][id]={seen:false,used:false};
  G.codex[type][id][field]=true;
  if(document.getElementById('ref-guide-modal')?.classList.contains('open')){
    try{ buildRefGuide(); }catch(_){ }
  }
}

const SKILL_EVOLUTION_LEVEL_INTERVAL = 3;
const FAMILY_EVOLUTION_STATE_VERSION = 13; /* bumped for combat rewrite: wipes legacy family-evolution state */
/* Combat rewrite: all legacy *_SKILL_SLOT_LAYOUT / *_SKILL_FAMILIES consts and FAMILY_EVOLUTION_BIRD_DATA literal removed. js/systems/combat-pack-boot.js rebuilds FAMILY_EVOLUTION_BIRD_DATA from Avian.data.combatPack at startup. */
const FAMILY_EVOLUTION_BIRD_DATA = Object.create(null);
function buildFamilySkillAbilityLookup(slotLayout, families){
  const out = Object.create(null);
  if (Array.isArray(slotLayout)){
    for(const slot of slotLayout){
      if(!slot) continue;
      out[slot.abilityId] = {familyId:slot.familyId, pathId:null, tier:0, abilityId:slot.abilityId};
    }
  }
  if (families && typeof families === 'object'){
    for(const family of Object.values(families)){
      for(const path of Object.values(family.paths||{})){
        for(const [tierKey, abilityId] of Object.entries(path.abilities||{})){
          const tier=Number(tierKey)||0;
          const prev=out[abilityId];
          if(prev && prev.pathId===null && prev.tier===0 && tier>=1) continue;
          out[abilityId] = {familyId:family.familyId, pathId:path.pathId, tier, abilityId};
        }
      }
    }
  }
  return out;
}
function isSkillEvolutionLevel(level){
  return Number.isFinite(level) && level>0 && level % SKILL_EVOLUTION_LEVEL_INTERVAL === 0;
}
function getBirdFamilyEvolutionData(birdKey){
  const k = String(birdKey||'');
  if(k==='secretarybird') return FAMILY_EVOLUTION_BIRD_DATA.secretary || null;
  if(k==='harpyeagle') return FAMILY_EVOLUTION_BIRD_DATA.harpy || null;
  return FAMILY_EVOLUTION_BIRD_DATA[k] || null;
}
function getBirdSkillFamilyCatalog(birdKey){
  return getBirdFamilyEvolutionData(birdKey)?.families || null;
}
function usesFamilySkillEvolution(player){
  return !!getBirdSkillFamilyCatalog(player?.birdKey);
}
function createSkillSlotState(slotIndex, familyId, pathId, tier, abilityId, masteryCount=0, masteries=[]){
  return {
    slotIndex:Number.isFinite(slotIndex)?slotIndex:0,
    familyId:familyId||null,
    pathId:pathId||null,
    tier:Math.max(0, Number(tier)||0),
    abilityId:String(abilityId||''),
    masteryCount:Math.max(0, Number(masteryCount)||0),
    masteries:Array.isArray(masteries)?masteries.filter(Boolean).map(String):[],
  };
}
function getBaseSkillSlotsForBird(birdKey){
  const data = getBirdFamilyEvolutionData(birdKey);
  if(!data) return [];
  return data.slotLayout.map(slot=>createSkillSlotState(slot.slotIndex, slot.familyId, null, 0, slot.abilityId, 0, []));
}
function getFamilyEvolutionAbilityStateFromId(birdKey, abilityId){
  const raw = String(abilityId || '');
  const lookup = getBirdFamilyEvolutionData(birdKey)?.abilityLookup;
  let state = lookup?.[raw] || null;
  if(state) return state;
  const canon = resolveAbilityAliasSourceId(raw);
  if(canon && canon !== raw && lookup?.[canon]) return lookup[canon];
  const universal = globalThis.UNIVERSAL_FAMILY_ABILITY_LOOKUP;
  if(universal?.[raw]) return universal[raw];
  if(canon && universal?.[canon]) return universal[canon];
  return null;
}
function getSkillSlotFamilyDef(slotOrFamilyId, birdKey='sparrow'){
  const familyId = typeof slotOrFamilyId==='string' ? slotOrFamilyId : slotOrFamilyId?.familyId;
  if(!familyId) return null;
  const catalog = getBirdSkillFamilyCatalog(birdKey);
  if(catalog?.[familyId]) return catalog[familyId];
  if(typeof globalThis.buildFamilyEntryFromPackId==='function') return globalThis.buildFamilyEntryFromPackId(familyId);
  return null;
}
function getSkillSlotPathDef(slot, birdKey='sparrow'){
  const family = getSkillSlotFamilyDef(slot, birdKey);
  if(!family || !slot?.pathId) return null;
  return family.paths?.[slot.pathId] || null;
}
function getSkillSlotDisplayLabel(slot){
  if(!slot) return 'Unknown Slot';
  const tmpl = ABILITY_TEMPLATES?.[slot.abilityId] || {};
  const family = getSkillSlotFamilyDef(slot, G.player?.birdKey || 'sparrow');
  return tmpl.name || family?.displayName || slot.familyId || `Slot ${slot.slotIndex+1}`;
}
function normalizeSkillSlotState(slot, fallback, birdKey='sparrow'){
  const base = fallback || createSkillSlotState(0, null, null, 0, '', 0, []);
  const catalog = getBirdSkillFamilyCatalog(birdKey);
  const rawFam = slot?.familyId ?? base.familyId;
  if(catalog && rawFam && !catalog[rawFam] && !getSkillSlotFamilyDef(rawFam, birdKey)){
    return createSkillSlotState(base.slotIndex, base.familyId, null, 0, base.abilityId, 0, []);
  }
  let next = createSkillSlotState(slot?.slotIndex ?? base.slotIndex, slot?.familyId ?? base.familyId, slot?.pathId ?? base.pathId, slot?.tier ?? base.tier, slot?.abilityId ?? base.abilityId, slot?.masteryCount ?? base.masteryCount, slot?.masteries ?? base.masteries);
  if(usesFamilySkillEvolution({birdKey}) && next.abilityId){
    const info = getFamilyEvolutionAbilityStateFromId(birdKey, next.abilityId);
    if(info && info.familyId===next.familyId){
      next.pathId = next.pathId || info.pathId || null;
      next.tier = Math.max(next.tier||0, info.tier||0);
    }else if(catalog && catalog[next.familyId]){
      next.pathId = null;
      next.tier = 0;
      next.abilityId = base.abilityId;
      next.masteries = [];
      next.masteryCount = 0;
    }
  }
  if(!next.abilityId) next.abilityId = base.abilityId;
  return next;
}
function getSkillSlots(player){
  return Array.isArray(player?.familyEvolutionState?.skillSlots) ? player.familyEvolutionState.skillSlots : [];
}
function getSkillSlotByIndex(player, slotIndex){
  return getSkillSlots(player).find(slot=>slot.slotIndex===slotIndex) || null;
}
function getAbilitySkillSlot(player, ability){
  if(!ability) return null;
  if(Number.isFinite(ability.slotIndex)) return getSkillSlotByIndex(player, ability.slotIndex);
  const slots = getSkillSlots(player);
  return slots.find(slot=>slot.abilityId===ability.id) || null;
}
function countSkillSlotMastery(slot, masteryId){
  return (slot?.masteries||[]).filter(id=>id===masteryId).length;
}
function getSkillEvolutionPathOptions(slot, birdKey='sparrow'){
  const family = getSkillSlotFamilyDef(slot, birdKey);
  if(!family) return [];
  return Object.values(family.paths||{}).flatMap(path=>{
    const tierOneAbilityId = path.abilities?.[1];
    if(!tierOneAbilityId) return [];
    return [{
      familyId:family.familyId,
      pathId:path.pathId,
      displayName:path.displayName,
      abilityId:tierOneAbilityId,
      abilityTemplate:ABILITY_TEMPLATES?.[tierOneAbilityId] || null,
    }];
  });
}
function slotNeedsPathChoice(slot){
  return !!(slot && slot.familyId && !slot.pathId);
}
function slotCanTierUp(slot, birdKey='sparrow'){
  const family = getSkillSlotFamilyDef(slot, birdKey);
  return !!(slot && family && slot.pathId && (slot.tier||0) < (family.maxTier||3));
}
function isSkillSlotMaxTier(slot, birdKey='sparrow'){
  const family = getSkillSlotFamilyDef(slot, birdKey);
  return !!(slot && family && slot.pathId && (slot.tier||0) >= (family.maxTier||3));
}
function resolveSkillSlotEvolutionAction(slot, player=G.player){
  if(!slot || !usesFamilySkillEvolution(player)) return 'none';
  if(slotNeedsPathChoice(slot)) return 'choose_path';
  if(slotCanTierUp(slot, player?.birdKey)) return 'tier_up';
  return 'none';
}
function applySkillPathSelection(slot, pathId, player=G.player){
  if(!slot || !player) return null;
  const path = getSkillSlotFamilyDef(slot, player.birdKey)?.paths?.[pathId];
  if(!path) return null;
  slot.pathId = pathId;
  slot.tier = 1;
  slot.abilityId = path.abilities?.[1] || slot.abilityId;
  return slot;
}
function autoUpgradeSkillSlotTier(slot, player=G.player){
  if(!slot || !slotCanTierUp(slot, player?.birdKey)) return null;
  const nextTier = (slot.tier||0) + 1;
  const path = getSkillSlotPathDef(slot, player?.birdKey);
  if(!path?.abilities?.[nextTier]) return null;
  slot.tier = nextTier;
  slot.abilityId = path.abilities[nextTier];
  return slot;
}
function getSkillSlotMasteryOptions(slot, player=G.player){
  const family = getSkillSlotFamilyDef(slot, player?.birdKey);
  return Array.isArray(family?.masteries) ? family.masteries : [];
}
function applySkillSlotMastery(slot, masteryId, player=G.player){
  if(!slot) return null;
  const pick = getSkillSlotMasteryOptions(slot, player).find(entry=>entry.id===masteryId);
  if(!pick) return null;
  if(!Array.isArray(slot.masteries)) slot.masteries = [];
  slot.masteries.push(masteryId);
  slot.masteryCount = (slot.masteries||[]).length;
  return pick;
}
function ensureAbilityObjectFromTemplate(id, existing=null, slotIndex=null, energyCostPlayer=null){
  const tmpl = ABILITY_TEMPLATES?.[id] || {};
  const level = Math.max(1, Number(existing?.level || 1));
  const idChanged = existing?.id && existing.id !== id;
  const preserved = idChanged ? { level: existing.level } : existing;
  const out = {...tmpl, ...(preserved||{}), id, name:tmpl.name||existing?.name||id, level};
  if(Number.isFinite(slotIndex)) out.slotIndex = slotIndex;
  if(tmpl && (tmpl.btnType || tmpl.type)){
    out.btnType = tmpl.btnType || tmpl.type;
    out.type = out.btnType;
  } else {
    if(!String(out.btnType||'').trim() && tmpl.btnType) out.btnType = tmpl.btnType;
    if(!String(out.type||'').trim() && tmpl.type) out.type = tmpl.type;
    if(out.btnType && !out.type) out.type = out.btnType;
    if(out.type && !out.btnType) out.btnType = out.type;
  }
  const costCtx = energyCostPlayer ?? G.player;
  out.energyCost = getAbilityEnergyCost(out, costCtx);
  out.ailmentIds = deriveAbilityAilments(out, tmpl);
  return out;
}
function syncPlayerAbilitiesFromSkillSlots(player){
  if(!player || !usesFamilySkillEvolution(player)) return;
  const slots = getSkillSlots(player).slice().sort((a,b)=>a.slotIndex-b.slotIndex);
  if(!slots.length) return;
  const seenAbilityIds=new Set();
  const bySlot = new Map((player.abilities||[]).map(ab=>[Number.isFinite(ab?.slotIndex)?ab.slotIndex:-1, ab]));
  const byId = new Map((player.abilities||[]).map(ab=>[ab?.id, ab]));
  const out=[];
  for(const slot of slots){
    if(!slot.abilityId) continue;
    if(seenAbilityIds.has(slot.abilityId)){
      try{ console.warn('[abilities] duplicate skill slot abilityId='+slot.abilityId+' slot='+slot.slotIndex); }catch(_){}
      continue;
    }
    seenAbilityIds.add(slot.abilityId);
    const prior = bySlot.get(slot.slotIndex) || byId.get(slot.abilityId) || null;
    const ab = ensureAbilityObjectFromTemplate(slot.abilityId, prior, slot.slotIndex, player);
    if(slot.isStarterMain || slot.slotIndex === 0) ab.fixedMainAttackCost = true;
    out.push(ab);
  }
  player.abilities = out;
}
globalThis.getSkillSlots=getSkillSlots;
globalThis.usesFamilySkillEvolution=usesFamilySkillEvolution;
globalThis.ensureFamilyEvolutionState=ensureFamilyEvolutionState;
globalThis.getSkillEvolutionPathOptions=getSkillEvolutionPathOptions;
globalThis.applySkillPathSelection=applySkillPathSelection;
globalThis.autoUpgradeSkillSlotTier=autoUpgradeSkillSlotTier;
globalThis.slotCanTierUp=slotCanTierUp;
globalThis.syncPlayerAbilitiesFromSkillSlots=syncPlayerAbilitiesFromSkillSlots;

// ============================================================
//  SAVE / LOAD SYSTEM (localStorage)
//
//  SAVE_KEY is the localStorage bucket; bumping it nukes old runs.
//  SAVE_SCHEMA_VERSION (set in js/systems/save-migrations.js) is the
//  in-blob version. Bump that + add a migration step instead of bumping
//  the key when shipping shape changes. See docs/save-versioning.md.
// ============================================================
const SAVE_KEY = globalThis.AVIAN_OW_KEYS?.SAVE ?? 'avianAscent_save_v2';
const RUN_SAVE_SCHEMA_VERSION = (typeof globalThis.Avian?.systems?.SAVE_SCHEMA_VERSION === 'number')
  ? globalThis.Avian.systems.SAVE_SCHEMA_VERSION
  : 2;
function ensureFamilyEvolutionState(player){
  if(!player || typeof player!=='object') return null;
  const birdKey = String(player.birdKey || '');
  const catalog = getBirdSkillFamilyCatalog(birdKey);
  const baseSlots = getBaseSkillSlotsForBird(birdKey);
  if(!player.familyEvolutionState || typeof player.familyEvolutionState!=='object'){
    player.familyEvolutionState = {};
  }
  const state = player.familyEvolutionState;
  state.version = FAMILY_EVOLUTION_STATE_VERSION;
  state.birdKey = birdKey;
  state.rootTemplate = String(state.rootTemplate || birdKey);
  if(catalog){
    let rawSlots = Array.isArray(state.skillSlots) && state.skillSlots.length
      ? state.skillSlots
      : baseSlots.map((slot, idx)=>{
          const currentId = String(player.abilities?.[idx]?.id || '');
          const info = getFamilyEvolutionAbilityStateFromId(birdKey, currentId);
          if(info && info.familyId===slot.familyId){
            return createSkillSlotState(slot.slotIndex, info.familyId, info.pathId, info.tier, info.abilityId, 0, []);
          }
          return slot;
        });
    state.skillSlots = baseSlots.map((baseSlot, idx)=>normalizeSkillSlotState(rawSlots[idx], baseSlot, birdKey));
    (player.abilities||[]).forEach((ab, idx)=>{
      if(!ab?.id) return;
      const slot = state.skillSlots[idx];
      if(!slot) return;
      const famId = ab.familyId || slot.familyId;
      if(!famId && !getFamilyEvolutionAbilityStateFromId(birdKey, ab.id)) return;
      const resolvedFam = famId || getFamilyEvolutionAbilityStateFromId(birdKey, ab.id)?.familyId;
      if(resolvedFam) slot.familyId = resolvedFam;
      slot.abilityId = ab.id;
      slot.slotIndex = idx;
      const info = getFamilyEvolutionAbilityStateFromId(birdKey, ab.id);
      if(info && info.familyId===slot.familyId){
        slot.pathId = slot.pathId || info.pathId || null;
        slot.tier = Math.max(slot.tier||0, info.tier||0);
      }
    });
    syncPlayerAbilitiesFromSkillSlots(player);
  }else{
    try{
      if(birdKey && BIRDS?.[birdKey]){
        console.warn('[family-evolution] Missing catalog for playable birdKey='+birdKey+'; using mirrored flat slots until data lands.');
      }
    }catch(_e){}
    const mirrored = Array.isArray(player.abilities)
      ? player.abilities.slice(0,4).map((ab, idx)=>createSkillSlotState(idx, null, null, 0, ab?.id || '', 0, []))
      : [];
    state.skillSlots = mirrored;
  }
  return state;
}
/** Must match js/world/ow_enemy_population.js pack count (10). */
function _isValidOverworldEnemySeedPack(p){
  return !!(p && p.v===1 && Number.isInteger(p.packIndex) && p.packIndex>=0 && p.packIndex<10);
}
function saveRun() {
  if(!G.player) return;
  try {
    const onBattleScreen=!!document.getElementById('screen-battle')?.classList.contains('active');
    const overworldProgress = ensureOverworldProgress(G.stage);
    let overworldEnemySeedPack=null;
    if(!G.endlessMode){
      if(_isValidOverworldEnemySeedPack(G.overworldEnemySeedPack)){
        overworldEnemySeedPack={v:1,packIndex:G.overworldEnemySeedPack.packIndex};
      }else{
        const prev=loadSaveData();
        if(_isValidOverworldEnemySeedPack(prev?.overworldEnemySeedPack)){
          overworldEnemySeedPack={v:1,packIndex:prev.overworldEnemySeedPack.packIndex};
          G.overworldEnemySeedPack=overworldEnemySeedPack;
        }
      }
    }
    const save={
      player: JSON.parse(JSON.stringify(G.player)),
      stage: G.stage, bossKills: G.bossKills,
      endlessMode: G.endlessMode, endlessBattle: G.endlessBattle,
      overworldEnemySeedPack,
      collectedRewards: G.collectedRewards||[],
      classPerks: JSON.parse(JSON.stringify((G.classPerks||{}))),
      runClassPerks: JSON.parse(JSON.stringify((G.runClassPerks||[]))),
      runUpgradesPurchased: [...(G.runUpgradesPurchased||new Set())],
      shopSnapshots: JSON.parse(JSON.stringify(G._shopSnapshots||{})),
      overworldProgress: G.endlessMode ? null : JSON.parse(JSON.stringify(overworldProgress)),
      codex: JSON.parse(JSON.stringify(G.codex||{abilities:{},enemies:{},birds:{},artifacts:{},statuses:{}})),
      ui: JSON.parse(JSON.stringify(ensureUIState())),
      inBattle: onBattleScreen && !!G.enemy && !G.battleOver,
      battle: (onBattleScreen && G.enemy && !G.battleOver) ? {
        enemy: JSON.parse(JSON.stringify(G.enemy)),
        enemyNextAction: G.enemyNextAction?JSON.parse(JSON.stringify(G.enemyNextAction)):null,
        playerStatus: JSON.parse(JSON.stringify(G.playerStatus||{})),
        enemyStatus: JSON.parse(JSON.stringify(G.enemyStatus||{})),
        turn: G.turn,
        turnPhase: G.turnPhase,
        phase: G.phase,
      } : null,
      savedAt: Date.now(),
      shinyObjects: Math.max(0, Math.floor(Number(G.shinyObjects) || 0)),
      owEncounterChain: (!G.endlessMode && Array.isArray(G._owStageEnemies) && G._owStageEnemies.length) ? {
        owStageEnemies: G._owStageEnemies.slice(),
        owEnemyIndex: G._owEnemyIndex || 0,
        owEnemyCount: G._owEnemyCount || 0,
        owEncounterRollStage: Number.isFinite(Number(G._owEncounterRollStage)) ? Math.floor(G._owEncounterRollStage) : null,
        owEncounterDrafts: G._owEncounterDrafts ? JSON.parse(JSON.stringify(G._owEncounterDrafts)) : null,
        owEncounterDraftsSig: G._owEncounterDraftsSig || null,
        owPendingBattleStage: Number.isFinite(Number(G._owPendingBattleStage)) ? G._owPendingBattleStage : null,
        owPendingNodeId: Number.isFinite(Number(G._owPendingNodeId)) ? G._owPendingNodeId : null,
        battleTerrain: (typeof G._battleTerrain === 'string' && G._battleTerrain.trim()) ? G._battleTerrain.trim() : null,
      } : null,
    };
    // Strip un-serializable passive fns from player
    delete save.player.passive;
    ensureFamilyEvolutionState(save.player);
    syncPlayerAbilitiesFromSkillSlots(save.player);
    save.schemaVersion = RUN_SAVE_SCHEMA_VERSION;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch(e){ console.warn('Save failed',e); }
}
function loadSaveData() {
  try {
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    let parsed = JSON.parse(raw);
    if(parsed && typeof parsed === 'object'){
      const migrate = globalThis.Avian?.systems?.runSaveMigrations;
      if(typeof migrate === 'function') parsed = migrate(parsed);
    }
    return parsed;
  } catch(e){ return null; }
}
function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}
async function clearGameCache() {
  let ran = false;
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
        ran = true;
      }
    } catch (_) { /* noop */ }
  }
  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      if (names.length) ran = true;
    } catch (_) { /* noop */ }
  }
  return ran;
}
function clearAllProgress() {
  const preserve = {
    access: localStorage.getItem(ACCESS_KEY),
    music: localStorage.getItem(MUSIC_SETTINGS_KEY),
  };
  const keys = [
    SAVE_KEY,
    globalThis.AVIAN_OW_KEYS?.STATE ?? 'avianAscent_overworld',
    globalThis.AVIAN_OW_KEYS?.NAV ?? 'avianAscent_nav',
    UNLOCK_KEY,
    RUN_HISTORY_KEY,
    HIGHSCORE_KEY,
    TELEMETRY_KEY,
    'avianAscent_personal_bests',
    'avianAscent_last_seed',
    'blakiston_debug_unlocked',
    globalThis.FORTUNE_META_KEY || 'avianAscent_meta_v1',
  ];
  for (const k of keys) {
    try { localStorage.removeItem(k); } catch (_) { /* noop */ }
  }
  if (preserve.access != null) {
    try { localStorage.setItem(ACCESS_KEY, preserve.access); } catch (_) { /* noop */ }
  }
  if (preserve.music != null) {
    try { localStorage.setItem(MUSIC_SETTINGS_KEY, preserve.music); } catch (_) { /* noop */ }
  }
  delete G.player;
  G._shopSnapshots = {};
  G.collectedRewards = [];
  window.__blakistonDebugUnlocked = false;
}
function openEraseProgressModal() {
  document.getElementById('erase-progress-modal')?.classList.add('open');
}
function closeEraseProgressModal() {
  document.getElementById('erase-progress-modal')?.classList.remove('open');
}
function openClearCacheModal() {
  document.getElementById('clear-cache-modal')?.classList.add('open');
}
function closeClearCacheModal() {
  document.getElementById('clear-cache-modal')?.classList.remove('open');
}
async function confirmClearCache() {
  await clearGameCache();
  closeClearCacheModal();
  const msg = document.getElementById('dev-code-msg');
  if (msg) {
    msg.textContent = 'Cached assets cleared. Reloading…';
    msg.style.color = 'var(--gold-light)';
  }
  setTimeout(() => { location.reload(); }, 800);
}
function confirmEraseProgress() {
  clearAllProgress();
  closeEraseProgressModal();
  closeSelectHubPanel();
  deleteSave();
  const msg = document.getElementById('dev-code-msg');
  if (msg) {
    msg.textContent = '🗑 All saved progress erased.';
    msg.style.color = 'var(--gold-light)';
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
  }
  initSelectionSafe();
}
function continueRun() {
  const save=loadSaveData();
  if(!save) return;
  G.ui = {...DEFAULT_UI_STATE, ...(save.ui||{})};
  ensureUIState();
  G.endlessMode=save.endlessMode||false;
  if(!save.ui) G.ui.gameMode = G.endlessMode ? 'endless' : 'story';
  applyUIStateToDOM();
  G.endlessBattle=save.endlessBattle||0;
  G.bossKills=save.bossKills||0;
  G.stage=Math.max(1,Math.floor(Number(save.stage)||1));
  G._overworldProgress = normalizeOverworldProgress(save.overworldProgress||null, G.stage);
  if(!G.endlessMode && _isOverworldRun()){
    G.stage = Math.max(1, (G._overworldProgress?.completedStage||0) + 1);
  }
  G.collectedRewards=save.collectedRewards||[];
  G.player=save.player;
  if(G.player?.birdKey && BIRDS[G.player.birdKey]?.size) G.player.size=BIRDS[G.player.birdKey].size;
  G.player.class = resolveFinalClass(G.player?.class, G.player?.birdKey);
  ensureFamilyEvolutionState(G.player);
  syncPlayerAbilitiesFromSkillSlots(G.player);
  G.classPerks = JSON.parse(JSON.stringify(save.classPerks||save.classPerksByBird||{}));
  G.runClassPerks = JSON.parse(JSON.stringify(save.runClassPerks||[]));
  ensureClassPerkState(G);
  G._classPerkChoicesGranted = Math.max(getClassPerkGrantCountForMode('story'), getClassPerkGrantCountForMode('endless'));
  if(!G.player._appliedClassPerkIds || typeof G.player._appliedClassPerkIds!=='object'){
    G.player._appliedClassPerkIds=Object.fromEntries(getBirdClassPerks(G.player?.birdKey).map(id=>[id,true]));
  }
  if(!Array.isArray(G.player.endlessRewards)) G.player.endlessRewards=[];
  ensurePassiveEvolutionState(G.player);
  if(typeof Avian?.mutations?.ensurePlayerMutationState==='function') Avian.mutations.ensurePlayerMutationState(G.player);
  if(typeof applyBirdCardProgression==='function') applyBirdCardProgression(G.player);
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function') Avian.mutations.reapplyPlayerStatsFromSources(G.player);
  if(!Array.isArray(G.player.abilityInventory)) G.player.abilityInventory=[];
  G.player.mutatedFeatherCount=Math.max(0, Number(G.player.mutatedFeatherCount)||0);
  if(typeof Avian?.shop?.ensureAbilityInventory==='function') Avian.shop.ensureAbilityInventory(G.player);
  G.runUpgradesPurchased=new Set(save.runUpgradesPurchased||[]);
  G._shopSnapshots=save.shopSnapshots||{};
  G._pendingLevelUpChoices=0;
  G._pendingSkillEvolutionChoices=0;
  G.codex=save.codex||{abilities:{},enemies:{},birds:{},artifacts:{},statuses:{}};
  G.shinyObjects = Math.max(0, Math.floor(Number(save.shinyObjects) || 0));
  G.overworldEnemySeedPack=null;
  if(!G.endlessMode&&_isValidOverworldEnemySeedPack(save.overworldEnemySeedPack)){
    G.overworldEnemySeedPack={v:1,packIndex:save.overworldEnemySeedPack.packIndex};
  }
  const oc = save.owEncounterChain;
  const _pendRestore = Number(G._owPendingBattleStage);
  const encStForOcRestore = (Number.isFinite(_pendRestore) && _pendRestore > 0)
    ? Math.floor(_pendRestore)
    : Math.max(1, Math.floor(Number(save.stage) || 1));
  const skipOcEnemyRestore = !G.endlessMode && STORY_BOSS_STAGES.has(encStForOcRestore);
  const ocRollStage = (oc && Number.isFinite(Number(oc.owEncounterRollStage)))
    ? Math.floor(Number(oc.owEncounterRollStage))
    : null;
  const ocAlignedWithPendingEncounter = ocRollStage == null || ocRollStage === encStForOcRestore;

  const _applyOcNavHintsIfUnset = ()=>{
    const havePending = Number.isFinite(Number(G._owPendingBattleStage)) && Number(G._owPendingBattleStage) > 0;
    if(!havePending && Number.isFinite(Number(oc.owPendingBattleStage))) G._owPendingBattleStage = Math.floor(Number(oc.owPendingBattleStage));
    const haveNode = Number.isFinite(Number(G._owPendingNodeId));
    if(!haveNode && Number.isFinite(Number(oc.owPendingNodeId))) G._owPendingNodeId = Math.floor(Number(oc.owPendingNodeId));
    const haveTerrain = typeof G._battleTerrain === 'string' && G._battleTerrain.trim();
    if(!haveTerrain && typeof oc.battleTerrain === 'string' && oc.battleTerrain.trim()) G._battleTerrain = oc.battleTerrain.trim();
  };

  if(!G.endlessMode && oc && ocAlignedWithPendingEncounter && Array.isArray(oc.owStageEnemies) && oc.owStageEnemies.length && !skipOcEnemyRestore){
    G._owStageEnemies = oc.owStageEnemies.slice();
    G._owEnemyIndex = Math.max(0, Math.floor(Number(oc.owEnemyIndex) || 0));
    G._owEnemyCount = Math.max(1, Math.floor(Number(oc.owEnemyCount) || G._owStageEnemies.length));
    G._owEncounterRollStage = Number.isFinite(Number(oc.owEncounterRollStage)) ? Math.floor(Number(oc.owEncounterRollStage)) : null;
    G._owEncounterDrafts = (Array.isArray(oc.owEncounterDrafts) && oc.owEncounterDrafts.length) ? JSON.parse(JSON.stringify(oc.owEncounterDrafts)) : null;
    G._owEncounterDraftsSig = (G._owEncounterDrafts && oc.owEncounterDraftsSig) ? oc.owEncounterDraftsSig : null;
    G._owEncounterMaterialized = null;
    G._owEncounterMaterializedSig = null;
    _applyOcNavHintsIfUnset();
  } else if(!G.endlessMode && skipOcEnemyRestore && oc){
    G._owStageEnemies = null;
    G._owEnemyIndex = 0;
    G._owEnemyCount = 1;
    G._owEncounterRollStage = null;
    G._owEncounterDrafts = null;
    G._owEncounterDraftsSig = null;
    G._owEncounterMaterialized = null;
    G._owEncounterMaterializedSig = null;
    _applyOcNavHintsIfUnset();
  } else if(!save.inBattle && !oc){
    const preserveOwBattleIntent = !G.endlessMode
      && Number.isFinite(Number(G._owPendingBattleStage))
      && Number(G._owPendingBattleStage) > 0
      && Array.isArray(G._owStageEnemies)
      && G._owStageEnemies.length > 0;
    if(!preserveOwBattleIntent){
      G._owStageEnemies = null;
      G._owEncounterDrafts = null;
      G._owEncounterDraftsSig = null;
      G._owEncounterMaterialized = null;
      G._owEncounterMaterializedSig = null;
      G._owEncounterRollStage = null;
    }
  }
  // Re-attach passive reference (fns can't be serialized)
  const bd=BIRDS[G.player.birdKey];
  if(bd) G.player.passive=bd.passive||null;
  ensureMainAttackAndLoadoutRules();
  removeMimicEverywhere();
  normalizeAbilityCooldownsForPlayer(G.player);
  enforceAbilityCosts(G.player);
  recomputeClassPerkEffects();
  if(G.player.cardDodge===undefined) G.player.cardDodge=0;
  if(G.player.stats && 'mdodge' in G.player.stats) delete G.player.stats.mdodge;
  if('cardMdodge' in G.player) delete G.player.cardMdodge;
  ensureStatLedgerAfterLoad(G.player);
  if(typeof applyOwnedFortuneArtifacts==='function') applyOwnedFortuneArtifacts(G.player);

  const bsave=save.battle;
  // Overworld "Nest" explicitly resumes on the war room with the nest modal — do not
  // hijack that flow with a stale mid-battle snapshot (player was safe on the map).
  if(save.inBattle&&bsave&&bsave.enemy && !G._continueRunOpenNestOnly){
    G._continueRunOpenNestOnly=false;
    G.enemy=bsave.enemy;
    G.enemy.class = resolveFinalClass(G.enemy?.class || G.enemy?.enemyClass, G.enemy?.birdKey || G.enemy?.portraitKey || G.enemy?.id || '');
    G.enemy.enemyClass = resolveFinalClass(G.enemy?.enemyClass || G.enemy?.class, G.enemy?.birdKey || G.enemy?.portraitKey || G.enemy?.id || '');
    G.enemyNextAction=bsave.enemyNextAction||planEnemyAction();
    G.playerStatus=bsave.playerStatus||{};
    G.enemyStatus=bsave.enemyStatus||{};
    G.turn=bsave.turn||'player';
    G.turnPhase=bsave.turnPhase||TURN.PLAYER;
    G.phase=bsave.phase||(G.turn==='player'?'PLAYER':'ENEMY');
    G.battleOver=false;
    G.actionQueue=[];
    G.actionBusy=false;
    preparePlayerCombatLoadout(G.player);
    normalizeBattleTurnState();
    showScreen('screen-battle');
    updateStageProgress();
    refreshBattleUI();
    if(G.turn==='enemy') scheduleOpeningEnemyTurn();
    return;
  }

  G.phase='PLAYER';
  if(G._continueRunOpenNestOnly){
    G._continueRunOpenNestOnly=false;
    showScreen('screen-select');
    applyUIStateToDOM();
    try{
      initSelection();
      wireRefGuideClicks();
    }catch(_){}
    requestAnimationFrame(()=>{
      try{ openNest(); }catch(_){}
      try{ saveRun(); }catch(_){}
    });
    return;
  }

  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:continueRun:preLoadStage',message:'continueRun calling loadStage',data:{stage:G.stage,pendingStage:G._owPendingBattleStage,owEnemies:G._owStageEnemies,inBattle:!!save?.inBattle},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  loadStage();
}
function goMainMenu() {
  if(G.player) saveRun();
  try { localStorage.removeItem('avianAscent_overworld'); localStorage.removeItem('avianAscent_nav'); } catch(_) {}
  showScreen('screen-select');initSelectionSafe();
}

// ============================================================
//  OVERWORLD BRIDGE
// ============================================================
const _OW_STATE_KEY = globalThis.AVIAN_OW_KEYS?.STATE ?? 'avianAscent_overworld';
const _OW_NAV_KEY = globalThis.AVIAN_OW_KEYS?.NAV ?? 'avianAscent_nav';

function flyAgain() {
  deleteSave();
  try { localStorage.removeItem(_OW_STATE_KEY); localStorage.removeItem(_OW_NAV_KEY); } catch (_) {}
  G.player = null;
  G.enemy = null;
  G.phase = null;
  G.battleOver = true;
  takeFlightToSelect();
}
globalThis.flyAgain = flyAgain;

function getEncounterStage() {
  const pending = Number(G?._owPendingBattleStage);
  if(Number.isFinite(pending) && pending > 0) return Math.floor(pending);
  return Math.max(1, Math.floor(Number(G?.stage) || 1));
}

function getStageEncounterChainLength(){
  if(G.endlessMode) return 1;
  const fromList = Array.isArray(G._owStageEnemies) ? G._owStageEnemies.length : 0;
  const fromCount = Math.max(0, Math.floor(Number(G._owEnemyCount) || 0));
  return Math.max(1, fromList || fromCount || 1);
}

function hasMultiEnemyChainPending(){
  if(G.endlessMode) return false;
  const chain = Array.isArray(G._owStageEnemies) ? G._owStageEnemies : null;
  if(!chain || chain.length <= 1) return false;
  const idx = Math.max(0, Math.floor(Number(G._owEnemyIndex) || 0));
  return idx < chain.length - 1;
}

function resetStageBattleStats(){
  G._stageBattleStats = null;
  G._deferredStageLevelUp = false;
}

function accumulateStageBattleStats(){
  if(typeof BS === 'undefined' || !BS) return;
  const cur = {
    dmgDealt: Number(BS.dmgDealt) || 0,
    dmgTaken: Number(BS.dmgTaken) || 0,
    crits: Number(BS.crits) || 0,
    dodges: Number(BS.dodges) || 0,
    turns: Number(BS.turns) || 0,
    highestHit: Number(BS.highestHit) || 0,
  };
  if(!G._stageBattleStats){
    G._stageBattleStats = {...cur};
    return;
  }
  const acc = G._stageBattleStats;
  acc.dmgDealt = (acc.dmgDealt || 0) + cur.dmgDealt;
  acc.dmgTaken = (acc.dmgTaken || 0) + cur.dmgTaken;
  acc.crits = (acc.crits || 0) + cur.crits;
  acc.dodges = (acc.dodges || 0) + cur.dodges;
  acc.turns = (acc.turns || 0) + cur.turns;
  acc.highestHit = Math.max(acc.highestHit || 0, cur.highestHit);
}

function continueToNextEncounterBird(){
  G._owEnemyIndex = (G._owEnemyIndex || 0) + 1;
  G.battleOver = false;
  saveRun();
  const battleNum = Math.min((G._owEnemyIndex || 0) + 1, getStageEncounterChainLength());
  const total = getStageEncounterChainLength();
  logMsg(`⚔ Next opponent approaches — Battle ${battleNum} of ${total}`, 'system');
  setTimeout(() => {
    try { loadStage(); }
    catch (err) { console.error('continueToNextEncounterBird failed:', err); }
  }, 700);
}

function normalizeOverworldProgress(progress=null, fallbackStage=1) {
  const maxStage = getStoryMaxStage();
  const impl = globalThis.normalizeOverworldProgressShared;
  if(typeof impl === 'function') return impl(progress, fallbackStage, maxStage);
  const nextStage = Math.max(1, Math.floor(Number(fallbackStage) || 1));
  const rawCompleted = Number(progress?.completedStage);
  const ceiling = Math.max(0, nextStage - 1);
  const merged = Math.min(maxStage, Math.max(
    ceiling,
    Number.isFinite(rawCompleted) ? Math.floor(rawCompleted) : 0
  ));
  const completedStage = Math.min(merged, ceiling);
  const rawNodeId = Number(progress?.currentNodeId);
  const currentNodeId = Number.isFinite(rawNodeId) ? Math.max(0, Math.floor(rawNodeId)) : 0;
  const lastSummary = (progress?.lastSummary && typeof progress.lastSummary === 'object')
    ? JSON.parse(JSON.stringify(progress.lastSummary))
    : null;
  return {completedStage, currentNodeId, lastSummary};
}

function ensureOverworldProgress(fallbackStage=G.stage||1) {
  G._overworldProgress = normalizeOverworldProgress(G._overworldProgress, fallbackStage);
  return G._overworldProgress;
}

function setOverworldCurrentNode(nodeId) {
  const rawNodeId = Number(nodeId);
  if(!Number.isFinite(rawNodeId)) return;
  const progress = ensureOverworldProgress();
  progress.currentNodeId = Math.max(0, Math.floor(rawNodeId));
}

function finalizeOverworldStageClear(clearedStage, nodeId, summary={}) {
  const stageNum = Math.max(1, Math.floor(Number(clearedStage) || 1));
  const progress = ensureOverworldProgress(stageNum);
  progress.completedStage = Math.max(progress.completedStage || 0, stageNum);
  const owNodes = getActiveOwNodesForProgress();
  const nextCursor =
    typeof globalThis.resolveOverworldCursorNodeIdAfterClear === 'function'
      ? globalThis.resolveOverworldCursorNodeIdAfterClear(progress.completedStage, owNodes)
      : null;
  if (nextCursor != null) progress.currentNodeId = nextCursor;
  else if (Number.isFinite(Number(nodeId))) progress.currentNodeId = Math.max(0, Math.floor(Number(nodeId)));
  progress.lastSummary = {
    stage: stageNum,
    nodeId: Number.isFinite(Number(nodeId)) ? Math.max(0, Math.floor(Number(nodeId))) : progress.currentNodeId,
    shinyGain: Math.max(0, Math.floor(Number(summary?.shinyGain) || 0)),
    enemiesDefeated: Math.max(1, Math.floor(Number(summary?.enemiesDefeated) || 1)),
    nextStage: Math.min(getStoryMaxStage(), stageNum + 1),
  };
  G.stage = Math.max(1, progress.completedStage + 1);
  return progress;
}

function clearOverworldPendingBattle() {
  G._owPendingBattleStage = null;
  G._owPendingNodeId = null;
  G._owEnemyCount = 0;
  G._owSequenceShiny = 0;
  G._owEnemyIndex = 0;
  G._owStageEnemies = null;
  G._owEncounterDrafts = null;
  G._owEncounterDraftsSig = null;
  G._owEncounterMaterialized = null;
  G._owEncounterMaterializedSig = null;
  G._battleTerrain = null;
  G._encounterPreviewCollapsed = null;
  G._owEncounterRollStage = null;
  resetStageBattleStats();
}

/** Lock story rolls per stage slot; rebuild when bird chain, player level, or difficulty changes. */
function ensureOwEncounterDrafts(encounterStage){
  if(G.endlessMode || !G._owStageEnemies?.length){
    G._owEncounterDrafts = null;
    G._owEncounterDraftsSig = null;
    return;
  }
  const plv = Math.max(1, Math.floor(G.player?.birdLevel || 1));
  const diffId = G.difficulty || 'juvenile';
  const sig = `${encounterStage}|${(G._owStageEnemies || []).join(',')}|lv${plv}|d${diffId}`;
  if(G._owEncounterDraftsSig === sig && Array.isArray(G._owEncounterDrafts) && G._owEncounterDrafts.length === G._owStageEnemies.length) return;
  G._owEncounterDraftsSig = sig;
  G._owEncounterDrafts = G._owStageEnemies.map(bk=>{
    const d = buildOwEnemyDraftFromBirdKey(bk, encounterStage);
    return d ? JSON.parse(JSON.stringify(d)) : null;
  });
}

/** One overworld slot: roster enemy draft before mergeScaledStatsIntoEnemy. */
function buildOwEnemyDraftFromBirdKey(bk, encounterStage){
  const tok=String(bk||'').trim();
  const tokNorm=tok.toLowerCase().replace(/\s+/g,'');
  if((tokNorm==='duke_blakiston'||tokNorm==='dukeblakiston'||tok===getStoryDukeRosterId?.()) && encounterStage>=STORY_DUKE_STAGE){
    return makeDukeBlakiston();
  }
  const isMilestoneBoss = encounterStage === STORY_MILESTONE_BOSS_STAGE;
  const isForgeBoss = !!(G._owForgeNavMeta?.forgeNodeIsBoss || G._owForgeNavMeta?.isForgeTest && G._owForgeNavMeta?.forgeNodeIsBoss);
  const isBoss = isMilestoneBoss || isForgeBoss;
  const bossTitle = isBoss ? (isMilestoneBoss ? bossTitleForStageMilestone(encounterStage) : 'Boss') : '';
  if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(tok)&&typeof buildEnemyFromRosterId==='function'){
    return buildEnemyFromRosterId(tok,{isBoss,bossTitle});
  }
  const resolved=typeof resolveOwStageToken==='function'?resolveOwStageToken(tok,encounterStage,{isBoss}):tok;
  if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(resolved)&&typeof buildEnemyFromRosterId==='function'){
    return buildEnemyFromRosterId(resolved,{isBoss,bossTitle});
  }
  return buildStoryEnemyFromBirdKey(resolved, encounterStage, {isBoss,bossTitle});
}

/** Apply the same scaling merge loadStage uses; mutates ed in place. */
function mergeScaledStatsIntoEnemy(ed, encounterStage){
  if(!ed) return ed;
  const diffMult = DIFFICULTIES[G.difficulty||'juvenile'].mult;
  const scaleOpts={
    isEndless:(G.endlessMode && encounterStage>20),
    isStory:!G.endlessMode,
    diffMult,
    playerBirdLevel:Math.max(1, Math.floor(G.player?.birdLevel||1)),
  };
  const scaled=ed._storyDirectStats ? {
    hp:ed.hp,maxHp:ed.maxHp,atk:ed.atk,def:ed.def,spd:ed.spd,acc:ed.acc,dodge:ed.dodge,mdef:ed.mdef,matk:ed.matk,cc:ed.cc||0.05,cd:ed.cd||1.5,en:ed.energyMax||ed.stats?.en||getEnergyProfile(normalizeBirdSizeForEnergy(ed.size)).maxEN,enemyClass:ed.enemyClass,effectiveLevel:ed.storyLevel||0,
  } : (ed.isBoss
    ? buildScaledBoss(ed, encounterStage, scaleOpts)
    : buildScaledEnemy(ed, encounterStage, scaleOpts));
  ed.hp=scaled.hp; ed.maxHp=scaled.maxHp;
  ed.atk=scaled.atk; ed.def=scaled.def; ed.spd=scaled.spd;
  ed.acc=scaled.acc; ed.dodge=scaled.dodge;
  ed.cc=scaled.cc; ed.cd=scaled.cd;
  ed.mdef=scaled.mdef; ed.matk=scaled.matk;
  ed.enemyClass=scaled.enemyClass||ed.enemyClass||inferEnemyClassFromStyle(ed.aiStyle);
  ed.combatTier = (scaled && 'tier' in scaled && scaled.tier!=null) ? scaled.tier : (ed.combatTier||ed.enemyTier||null);
  if(Number.isFinite(scaled.effectiveLevel)) ed.effectiveLevel=scaled.effectiveLevel;
  if(G.player?.mutBloodMoon){ ed.atk=Math.floor(ed.atk*1.10); ed.matk=Math.floor((ed.matk||ed.atk)*1.10); }
  ed.stats = {hp:ed.hp, maxHp:ed.hp, atk:ed.atk, def:ed.def, spd:ed.spd, acc:ed.acc, dodge:ed.dodge, mdef:ed.mdef, matk:ed.matk, cc:ed.cc, cd:ed.cd, critChance:Math.round((ed.cc||0.05)*100), critMult:ed.cd||1.5, en:(scaled.en||0)};
  const prof=getEnemyEnergyProfile();
  ed.energyMax=prof.maxEN;
  ed.energyRegen=prof.regenEN;
  ed.energy=prof.startEN;
  ed.stats.en=prof.maxEN;
  if (!ed._mutationsApplied) {
    ed._statBaseBeforeMutations = {
      atk: Number(ed.stats.atk) || 0,
      matk: Number(ed.stats.matk) || 0,
      def: Number(ed.stats.def) || 0,
      mdef: Number(ed.stats.mdef) || 0,
      dodge: Number(ed.stats.dodge) || 0,
      acc: Number(ed.stats.acc) || 0,
      spd: Number(ed.stats.spd) || 0,
      critChance: Number(ed.stats.critChance) || 0,
      maxHp: Number(ed.stats.maxHp) || 0,
    };
    const forgeEnc = G._owForgeEncounter;
    const slotIdx = Math.max(0, G._owEnemyIndex || 0);
    const forgeSlot = forgeEnc?.slots?.[slotIdx];
    if (forgeSlot?.useCustomStats && forgeSlot.customStats) {
      const cs = forgeSlot.customStats;
      const apply = (k, v) => {
        if (v == null) return;
        ed.stats[k] = v;
        if (k === 'maxHp') { ed.maxHp = v; ed.hp = v; ed.stats.hp = v; }
        else if (k in ed) ed[k] = v;
      };
      apply('maxHp', cs.maxHp);
      apply('atk', cs.atk);
      apply('def', cs.def);
      apply('matk', cs.matk);
      apply('mdef', cs.mdef);
      apply('spd', cs.spd);
    }
    if (typeof globalThis.applyForgePowerScaling === 'function' && (G._owForgePowerTier || 0) > 0) {
      globalThis.applyForgePowerScaling(ed, G._owForgePowerTier);
      ed._statBaseBeforeMutations = {
        atk: Number(ed.stats.atk) || 0,
        matk: Number(ed.stats.matk) || 0,
        def: Number(ed.stats.def) || 0,
        mdef: Number(ed.stats.mdef) || 0,
        dodge: Number(ed.stats.dodge) || 0,
        acc: Number(ed.stats.acc) || 0,
        spd: Number(ed.stats.spd) || 0,
        critChance: Number(ed.stats.critChance) || 0,
        maxHp: Number(ed.stats.maxHp) || 0,
      };
    }
    if (typeof Avian?.mutations?.rollEnemyMutationsFromForgeSlot === 'function' && forgeSlot) {
      ed.mutationIds = Avian.mutations.rollEnemyMutationsFromForgeSlot({
        mutationBand: forgeSlot.mutationBand,
        maxMutations: forgeSlot.maxMutations,
        stage: encounterStage,
        isBoss: !!ed.isBoss,
      });
      if (typeof Avian.mutations.applyMutationsToEntity === 'function') {
        Avian.mutations.applyMutationsToEntity(ed, ed.mutationIds);
      }
    } else if (typeof Avian?.mutations?.rollEndlessEnemyMutations === 'function'
      && (G._groveAmbushActive || (G.endlessMode && encounterStage > 20))) {
      ed.mutationIds = Avian.mutations.rollEndlessEnemyMutations(G.player, {
        stage: encounterStage,
        isBoss: !!ed.isBoss,
        endlessBattle: getEndlessEffectiveBattleNumber(encounterStage),
      });
      if (typeof Avian.mutations.applyMutationsToEntity === 'function') {
        Avian.mutations.applyMutationsToEntity(ed, ed.mutationIds);
      }
    } else if (typeof Avian?.mutations?.rollEnemyMutations === 'function') {
      if (!Array.isArray(ed.mutationIds) || !ed.mutationIds.length) {
        ed.mutationIds = Avian.mutations.rollEnemyMutations({
          stage: encounterStage,
          isBoss: !!ed.isBoss,
          endless: !!(G.endlessMode && encounterStage > 20),
        });
      }
      if (typeof Avian.mutations.applyMutationsToEntity === 'function') {
        Avian.mutations.applyMutationsToEntity(ed, ed.mutationIds);
      }
    }
    ed._mutationsApplied = true;
  }
  return ed;
}

/** Scale drafts for current level/difficulty; kits stay tied to encounter drafts. */
function ensureOwEncounterMaterialized(encounterStage){
  if(G.endlessMode || !G._owStageEnemies?.length) return;
  ensureOwEncounterDrafts(encounterStage);
  const plv = Math.max(1, Math.floor(G.player?.birdLevel || 1));
  const diffMult = DIFFICULTIES[G.difficulty || 'juvenile'].mult;
  const scaleSig = `${G._owEncounterDraftsSig || ''}|lv${plv}|d${diffMult}`;
  if(G._owEncounterMaterializedSig === scaleSig && Array.isArray(G._owEncounterMaterialized) && G._owEncounterMaterialized.length === G._owStageEnemies.length && G._owEncounterMaterialized.every(x=>x && typeof x==='object')) return;
  G._owEncounterMaterializedSig = scaleSig;
  G._owEncounterMaterialized = (G._owEncounterDrafts || []).map(draft=>{
    if(!draft) return null;
    const ed = JSON.parse(JSON.stringify(draft));
    mergeScaledStatsIntoEnemy(ed, encounterStage);
    return ed;
  });
}

function escapeEncounterPreviewHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Ability ids from enemy kit (string pool entries or synced skill objects). */
function getEnemyKitAbilityIds(enemy){
  if(!enemy) return [];
  const abs=enemy.abilities||[];
  const ids=[];
  for(const x of abs){
    if(typeof x==='string'&&x) ids.push(x);
    else if(x&&typeof x==='object'&&x.id) ids.push(x.id);
  }
  return ids;
}

function getEnemyAbilityDisplayLabel(abilityId, enemy){
  const eab=ENEMY_ABILITY_POOL[abilityId];
  if(eab?.name) return eab.name;
  const slot=(enemy?.abilities||[]).find(a=>a&&a.id===abilityId);
  const tmpl=getAbilityTemplateForUI(slot||{id:abilityId});
  return tmpl?.name||abilityId;
}

/** Enemy combat ability keys resolved to display names (kit ids + ABILITY_TEMPLATES + ENEMY_ABILITY_POOL). */
function getEnemyPreviewSkillNames(enemy){
  if(!enemy) return ['—','—','—','—'];
  if(enemy.id==='duke_blakiston'){
    return ["River Grip","Royal Decree","Court Wardens","Owl's Verdict"];
  }
  const names=[];
  if(Array.isArray(enemy.abilities) && enemy.abilities.length){
    enemy.abilities.slice(0,4).forEach(entry=>{
      if(typeof entry==='string'){
        names.push(getEnemyAbilityDisplayLabel(entry,enemy));
      } else if(entry && typeof entry==='object'){
        const tmpl=getAbilityTemplateForUI(entry);
        if(tmpl?.name){ names.push(tmpl.name); return; }
        const eab=ENEMY_ABILITY_POOL[entry.id];
        names.push(eab?.name||String(entry.name||entry.id||'—'));
      }
    });
  }
  while(names.length<4) names.push('—');
  return names.slice(0,4);
}

/** Enemy combat ability keys (raw pool IDs). */
function getEnemyPreviewSkillKeys(enemy){
  if(!enemy) return [];
  if(enemy.id==='duke_blakiston') return ['dukeRiverGrip','dukeDecree','dukeWardens','dukeOwlsVerdict'];
  if(Array.isArray(enemy.abilities) && enemy.abilities.length){
    return enemy.abilities.slice(0,4).map(entry=>typeof entry==='string'?entry:(entry?.id||''));
  }
  return [];
}

function getEnemyPreviewLevel(enemy){
  if(!enemy) return 1;
  if(Number.isFinite(enemy.storyLevel)) return enemy.storyLevel;
  if(Number.isFinite(enemy.effectiveLevel)) return enemy.effectiveLevel;
  const st=getEncounterStage();
  return computeEnemyEffectiveLevel(st, Math.max(1, Math.floor(G.player?.birdLevel||1)), !!(G.endlessMode && st>20));
}

function getEnemyPreviewLevelLine(enemy){
  const lv=getEnemyPreviewLevel(enemy);
  return {short:`Lv. ${lv}`, detail:`Level ${lv}`};
}

function buildEnemyInfoPopupAbilitiesHtml(enemy){
  if(!enemy) return '<em>No special abilities</em>';
  if(enemy.id==='duke_blakiston'){
    const lines=[
      ['River Grip','Physical pressure and control.'],
      ['Royal Decree','Shifts the flow of battle.'],
      ['Court Wardens','Summons aid.'],
      ["Owl's Verdict",'Devastating finisher phases.'],
    ];
    return '<ul>'+lines.map(([n,d])=>`<li><strong>${escapeEncounterPreviewHtml(n)}</strong> — ${escapeEncounterPreviewHtml(d)}</li>`).join('')+'</ul>';
  }
  const parts=[];
  const hasObjAbs=Array.isArray(enemy.abilities)&&enemy.abilities.some(x=>x&&typeof x==='object'&&x.id);
  if(hasObjAbs){
    enemy.abilities.slice(0,4).forEach(entry=>{
      if(!entry||typeof entry!=='object'||!entry.id) return;
      const tmpl=getAbilityTemplateForUI(entry);
      const lv=Math.max(1,Math.min(4,Number(entry.level)||1));
      const lvData=tmpl?.levels?.[lv-1];
      const desc=String(lvData?.desc||tmpl?.desc||'');
      parts.push(`<li><strong>${escapeEncounterPreviewHtml(tmpl?.name||entry.id)}</strong> <small>Lv${lv}</small> — ${escapeEncounterPreviewHtml(desc)}</li>`);
    });
  }else if(Array.isArray(enemy.abilities) && enemy.abilities.length){
    enemy.abilities.forEach(abKey=>{
      if(typeof abKey!=='string') return;
      const eab=ENEMY_ABILITY_POOL[abKey];
      if(!eab) return;
      const dmgNote=eab.dmg?` <em>(${escapeEncounterPreviewHtml(String(eab.dmg))})</em>`:'';
      parts.push(`<li><strong>${escapeEncounterPreviewHtml(eab.name)}</strong> — ${escapeEncounterPreviewHtml(eab.desc||'')}${dmgNote}</li>`);
    });
  }
  if(!parts.length){
    getEnemyKitAbilityIds(enemy).slice(0,8).forEach(id=>{
      const t=ABILITY_TEMPLATES[id];
      if(t){
        parts.push(`<li><strong>${escapeEncounterPreviewHtml(t.name||id)}</strong> — ${escapeEncounterPreviewHtml(String(t.levels?.[0]?.desc||t.desc||''))}</li>`);
        return;
      }
      const eab=ENEMY_ABILITY_POOL[id];
      if(eab){
        const dmgNote=eab.dmg?` <em>(${escapeEncounterPreviewHtml(String(eab.dmg))})</em>`:'';
        parts.push(`<li><strong>${escapeEncounterPreviewHtml(eab.name)}</strong> — ${escapeEncounterPreviewHtml(eab.desc||'')}${dmgNote}</li>`);
      }
    });
  }
  return parts.length?`<ul>${parts.join('')}</ul>`:'<em>No special abilities</em>';
}

function closeEnemyInfoPopup(){
  const popup=document.getElementById('enemy-info-popup');
  if(popup){
    popup.style.display='none';
    popup.classList.remove('enemy-info-popup--open');
  }
}

function openEnemyInfoPopup(){
  if(!G.enemy) return;
  const popup=document.getElementById('enemy-info-popup');
  if(!popup) return;
  wireEnemyInfoPopupOnce();
  const spriteEl=document.getElementById('enemy-info-popup-sprite');
  if(spriteEl){
    let ent=G.enemy;
    if(G.enemy.birdKey&&BIRDS[G.enemy.birdKey]){
      ent=Object.assign({}, BIRDS[G.enemy.birdKey], G.enemy, { portraitKey: G.enemy.portraitKey || BIRDS[G.enemy.birdKey].portraitKey });
    }
    spriteEl.innerHTML=renderEntityAvatarHTML(ent,'battle');
  }
  const nm=escapeEncounterPreviewHtml(String(G.enemy.name||'Enemy'));
  const hdr=document.getElementById('enemy-info-popup-header');
  if(hdr) hdr.innerHTML=`<strong>${nm}</strong>${G.enemy.isBoss?' <span aria-hidden="true">👑</span>':''}`;
  const lv=Number.isFinite(G.enemy.storyLevel)?G.enemy.storyLevel:(Number.isFinite(G.enemy.effectiveLevel)?G.enemy.effectiveLevel:getEnemyPreviewLevel(G.enemy));
  const aiStyle=typeof G.enemy.aiStyle==='string'?G.enemy.aiStyle:'tactical';
  const cls=idToClassLabel(resolveFinalClass(G.enemy.class||G.enemy.enemyClass||inferEnemyClassFromStyle(aiStyle), G.enemy.birdKey||''));
  const szRaw=SIZE_LABELS[String(G.enemy.size||'medium').toLowerCase()]||String(G.enemy.size||'');
  const sz=escapeEncounterPreviewHtml(szRaw);
  const thr=getEnemyPreviewLevelLine(G.enemy);
  const meta=document.getElementById('enemy-info-popup-meta');
  if(meta) meta.innerHTML=`Class: ${escapeEncounterPreviewHtml(cls)} · Size: ${sz}<br/>LVL ${lv} · ${escapeEncounterPreviewHtml(thr.detail)}`;
  const mutEl=document.getElementById('enemy-info-popup-mutations');
  if(mutEl) mutEl.innerHTML=buildEnemyInfoPopupMutationsHtml(G.enemy);
  const passEl=document.getElementById('enemy-info-popup-passive');
  if(passEl){
    const bk=G.enemy.birdKey||G.enemy.templateKey;
    const bird=bk&&BIRDS[bk]?BIRDS[bk]:null;
    const passive=bird?.passive;
    passEl.innerHTML=passive
      ? `<div class="enemy-info-passive-name">★ ${escapeHtmlRoster(passive.name)}</div><div class="enemy-info-passive-desc">${escapeHtmlRoster(passive.desc||passive.effect||'')}</div>`
      : '<p class="enemy-info-empty">None</p>';
  }
  const ab=document.getElementById('enemy-info-popup-abilities');
  if(ab) ab.innerHTML=buildEnemyInfoPopupAbilitiesHtml(G.enemy);
  popup.style.display='flex';
  popup.classList.add('enemy-info-popup--open');
}

function buildEnemyInfoPopupMutationsHtml(enemy){
  const ids=enemy?.mutationIds||[];
  if(!ids.length) return '<p class="enemy-info-empty">None</p>';
  const tierIcons=typeof Avian?.mutations?.TIER_ICONS==='object'?Avian.mutations.TIER_ICONS:{};
  return ids.map(id=>{
    const item=typeof Avian?.mutations?.getItem==='function'?Avian.mutations.getItem(id):null;
    if(!item) return '';
    const icon=tierIcons[item.tier]||'🧬';
    const stats=getMutationDescHtml(item);
    return `<div class="enemy-info-mut-row"><span class="enemy-info-mut-icon">${icon}</span><div class="enemy-info-mut-body"><div class="enemy-info-mut-name">${escapeHtmlRoster(item.name)}</div>${stats?`<div class="enemy-info-mut-stats">${stats}</div>`:''}</div></div>`;
  }).filter(Boolean).join('');
}

function wireEnemyInfoPopupOnce(){
  if(G._enemyInfoPopupWired) return;
  G._enemyInfoPopupWired=true;
  const root=document.getElementById('enemy-info-popup');
  if(!root) return;
  root.querySelector('.enemy-info-popup-backdrop')?.addEventListener('click',closeEnemyInfoPopup);
  root.querySelector('.enemy-info-popup-close')?.addEventListener('click',closeEnemyInfoPopup);
  const wrap=document.getElementById('enemy-avatar-wrap');
  if(!wrap) return;
  wrap.style.cursor='pointer';
  wrap.setAttribute('role','button');
  wrap.setAttribute('tabindex','0');
  wrap.setAttribute('aria-label','View enemy details');
  wrap.addEventListener('click',e=>{ e.stopPropagation(); openEnemyInfoPopup(); });
  wrap.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openEnemyInfoPopup(); }
  });
}

/** Source of truth for encounter preview + tooltips: materialized OW chain, else current G.enemy. */
function getCurrentStageEncounterPreviewData(){
  const st=getEncounterStage();
  ensureOwEncounterMaterialized(st);
  const idx=G._owEnemyIndex||0;
  if(!G.endlessMode && G._owStageEnemies?.length && Array.isArray(G._owEncounterMaterialized)){
    return G._owEncounterMaterialized.map((en,i)=>({
      enemy:en,
      slotIndex:i,
      isCurrent:i===idx,
    })).filter(x=>x.enemy);
  }
  if(G.enemy) return [{enemy:G.enemy, slotIndex:0, isCurrent:true}];
  return [];
}

/** Rich HTML tooltip for a single enemy ability (ENEMY_ABILITY_POOL or player-template kit id). */
function buildEnemyAbilityTooltipHtml(abKey, enemyStats, enemyCtx=null){
  const eab=ENEMY_ABILITY_POOL[abKey];
  if(eab){
    const nm=escapeEncounterPreviewHtml(eab.name||abKey);
    const desc=escapeEncounterPreviewHtml(eab.desc||'');
    const dmgRaw=eab.dmg||'';
    let category='Ability';
    if(dmgRaw==='healing') category='Heal';
    else if(dmgRaw==='buff') category='Buff';
    else if(abKey==='eShield'||/defend|shield/i.test(desc)) category='Shield';
    else if(dmgRaw==='0 direct') category='Debuff';
    else category='Offensive';
    let dmgLine='';
    if(category==='Offensive' && enemyStats){
      const atk=enemyStats.atk||8;
      const low=Math.max(1,Math.floor(atk*0.8));
      const high=Math.max(low,Math.floor(atk*1.2));
      dmgLine=`<div class="tt-row"><span class="tt-lbl">Damage</span><span class="tt-val">${low}–${high}</span></div>`;
    } else if(category==='Heal' && enemyStats){
      const heal=Math.floor((enemyStats.maxHp||enemyStats.hp||40)*0.15);
      dmgLine=`<div class="tt-row"><span class="tt-lbl">Heal</span><span class="tt-val">~${heal} HP</span></div>`;
    } else if(category==='Buff'){
      dmgLine=`<div class="tt-row"><span class="tt-lbl">Effect</span><span class="tt-val">Self-buff</span></div>`;
    }
    const dodge=eab.dodgeable?'<div class="tt-row"><span class="tt-lbl">Dodge</span><span class="tt-val tt-hit-good">Can be dodged</span></div>':'';
    return `<div class="tt-name">${nm}</div><div class="tt-type">${category}</div>${dmgLine}${dodge}<div class="tt-desc">${desc}</div>`;
  }
  const en=enemyCtx||{};
  const lv=Math.max(1,Math.min(4,Number(en.level)||Number(en.storyLevel)||1));
  const ab={id:abKey,level:lv};
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl) return '';
  const nm=escapeEncounterPreviewHtml(tmpl.name||abKey);
  const typeLbl=escapeEncounterPreviewHtml(String(tmpl.type||tmpl.btnType||'Ability'));
  const miss=tmpl.baseMissChance!==undefined?Math.max(0,tmpl.baseMissChance-5*(lv-1)):null;
  const hit=miss!==null?100-miss:null;
  const hitClass=hit===null?'':(hit>=80?'tt-hit-great':hit>=55?'tt-hit-good':'tt-hit-bad');
  const fakeAttacker={stats:enemyStats||{}};
  const {isDamaging,dmgLow,dmgHigh}=estimateSkillDamageRange(ab,tmpl,fakeAttacker,{isPlayerCombatPreview:false,applyMitigation:false});
  let html=`<div class="tt-name">${nm}</div><div class="tt-type">${typeLbl} · Lv${lv}</div>`;
  if(hit!==null) html+=`<div class="tt-row"><span class="tt-lbl">Hit</span><span class="tt-val ${hitClass}">${hit}%</span></div>`;
  if(isDamaging&&dmgLow!=null) html+=`<div class="tt-row"><span class="tt-lbl">Damage (est.)</span><span class="tt-val">${dmgLow}–${dmgHigh}</span></div>`;
  const lvData=Array.isArray(tmpl.levels)?tmpl.levels[lv-1]:null;
  const desc=escapeEncounterPreviewHtml(String(lvData?.desc||tmpl.desc||''));
  html+=`<div class="tt-desc">${desc}</div>`;
  return html;
}

function buildEncounterPreviewTooltipHtml(enemy){
  if(!enemy) return '';
  const nm=escapeEncounterPreviewHtml(enemy.name||'Enemy');
  const cls=idToClassLabel(resolveFinalClass(enemy.class||enemy.enemyClass||inferEnemyClassFromStyle(enemy.aiStyle), enemy.birdKey||''));
  const sz=SIZE_LABELS[String(enemy.size||'medium').toLowerCase()]||escapeEncounterPreviewHtml(enemy.size||'');
  const lv=getEnemyPreviewLevel(enemy);
  const thr=getEnemyPreviewLevelLine(enemy);
  const mini=enemy.portraitKey||enemy.birdKey||'';
  const icon=(PORTRAITS[mini]||PORTRAITS[String(mini).toLowerCase()]||enemy.emoji||'🪶');
  const keys=getEnemyPreviewSkillKeys(enemy);
  const names=getEnemyPreviewSkillNames(enemy);
  const eStats=enemy.stats||{atk:enemy.atk||8,maxHp:enemy.maxHp||enemy.hp||40};
  const previewLv=getEnemyPreviewLevel(enemy);
  const skillItems=names.map((n,i)=>{
    const key=keys[i]||'';
    const eab=ENEMY_ABILITY_POOL[key];
    let desc='';
    let badge='';
    if(eab){
      desc=escapeEncounterPreviewHtml(eab.desc||'');
      badge=eab.dodgeable?' <span style="color:var(--gold);font-size:.62rem">dodgeable</span>':'';
    }else if(key){
      const tmpl=getAbilityTemplateForUI({id:key,level:Math.max(1,Math.min(4,previewLv))});
      if(tmpl){
        const lv=Math.max(1,Math.min(4,previewLv,tmpl.levels?.length||4));
        const lvData=tmpl.levels?.[lv-1];
        desc=escapeEncounterPreviewHtml(String(lvData?.desc||tmpl.desc||''));
      }
    }
    return `<li>${escapeEncounterPreviewHtml(n)}${badge}${desc?`<div style="font-size:.65rem;color:var(--text-dim);margin:1px 0 3px">${desc}</div>`:''}</li>`;
  }).join('');
  const mutIds=enemy.mutationIds||[];
  let mutBlock='';
  if(mutIds.length){
    const mutItems=mutIds.map(id=>{
      const item=typeof Avian?.mutations?.getItem==='function'?Avian.mutations.getItem(id):null;
      if(!item) return '';
      const descHtml=getMutationDescHtml(item);
      const descPlain=typeof Avian?.mutations?.formatMutationDesc==='function'?Avian.mutations.formatMutationDesc(item):(item.statLine||item.name);
      const descBody=descHtml||escapeEncounterPreviewHtml(descPlain);
      return `<li><strong>${escapeEncounterPreviewHtml(item.name)}</strong>${descHtml?`<div class="enc-preview-mut-stats">${descBody}</div>`:` — ${descBody}`}</li>`;
    }).filter(Boolean).join('');
    if(mutItems) mutBlock=`<div class="enc-preview-tt-skills"><div class="enc-preview-tt-skills-h">Mutations</div><ul class="enc-preview-tt-ul">${mutItems}</ul></div>`;
  }
  return `<div class="enc-preview-tt"><div class="enc-preview-tt-head">${icon} <strong>${nm}</strong></div>
<div class="enc-preview-tt-meta">Class: ${escapeEncounterPreviewHtml(cls)}<br/>Size: ${escapeEncounterPreviewHtml(sz)}<br/>LVL ${lv}<br/>${escapeEncounterPreviewHtml(thr.detail)}</div>
<div class="enc-preview-tt-skills"><div class="enc-preview-tt-skills-h">Combat Abilities</div><ul class="enc-preview-tt-ul">${skillItems}</ul></div>${mutBlock}</div>`;
}

function _initEncounterPreviewCollapse(){
  const wrap=document.getElementById('encounter-preview-wrap');
  const btn=document.getElementById('encounter-preview-toggle');
  if(!wrap||!btn||btn._epWired) return;
  btn._epWired=true;
  btn.addEventListener('click',()=>{
    const collapsed=wrap.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', String(!collapsed));
    G._encounterPreviewCollapsed=collapsed;
  });
  const mq=window.matchMedia('(max-width:720px)');
  const applyResponsive=()=>{
    if(G._encounterPreviewCollapsed!=null) return;
    wrap.classList.toggle('collapsed', mq.matches);
    btn.setAttribute('aria-expanded', String(!mq.matches));
  };
  mq.addEventListener('change', applyResponsive);
  applyResponsive();
}

function renderEncounterPreview(){
  const wrap=document.getElementById('encounter-preview-wrap');
  if(!wrap) return;
  if(!document.getElementById('screen-battle')?.classList.contains('active')){
    wrap.style.display='none';
    return;
  }
  wrap.style.display='block';
  _initEncounterPreviewCollapse();
  const rows=getCurrentStageEncounterPreviewData();
  const inner=wrap.querySelector('.encounter-preview-inner');
  if(!inner) return;
  if(!rows.length){
    inner.innerHTML='<div class="enc-preview-empty">No encounter data</div>';
    return;
  }
  inner.classList.toggle('encounter-preview--single', rows.length===1);
  inner.innerHTML=rows.map(({enemy,isCurrent},i)=>{
    const pk=enemy.portraitKey||enemy.birdKey||'';
    const sprite=(PORTRAITS[pk]||PORTRAITS[String(pk).toLowerCase()]||`<span class="enc-preview-emoji">${enemy.emoji||'🪶'}</span>`);
    const nm=escapeEncounterPreviewHtml(enemy.name||'—');
    const lv=getEnemyPreviewLevel(enemy);
    const thr=getEnemyPreviewLevelLine(enemy);
    const cur=isCurrent?' enc-preview-card--current':'';
    return `<div class="enc-preview-card${cur}" data-enc-idx="${i}" tabindex="0" aria-label="${nm}, level ${lv}, ${thr.short}">
<div class="enc-preview-sprite">${sprite}</div>
<div class="enc-preview-text">
<div class="enc-preview-name">${nm}${enemy.isBoss?' <span class="enc-preview-crown" aria-hidden="true">👑</span>':''}</div>
<div class="enc-preview-sub">LVL ${lv} · ${escapeEncounterPreviewHtml(thr.short)}</div>
</div>
</div>`;
  }).join('');
  inner.querySelectorAll('.enc-preview-card').forEach(card=>{
    const idx=Number(card.getAttribute('data-enc-idx'));
    const row=rows[idx];
    if(!row) return;
    const html=buildEncounterPreviewTooltipHtml(row.enemy);
    const show=e=>{
      showTooltip(e, html, e.clientX+14, e.clientY+14);
    };
    card.addEventListener('mouseenter', show);
    card.addEventListener('mousemove', e=>moveTooltip(e.clientX+14, e.clientY+14));
    card.addEventListener('mouseleave', hideTooltip);
    card.addEventListener('focus', ev=>{
      const r = card.getBoundingClientRect();
      showTooltip(ev, html, r.right + 12, r.top + 4);
    });
    card.addEventListener('blur', hideTooltip);
  });
}

/** PNG: assets/arenas/arena-{id}.png — see assets/arenas/README.md */
const BATTLE_ARENA_BY_STAGE = {
  1: 'barn', 2: 'river', 3: 'river', 4: 'open-glade', 5: 'ruins', 6: 'ruins',
  7: 'forest', 8: 'trees', 9: 'bridge', 10: 'castle-gate',
  11: 'forest', 12: 'open-glade', 13: 'trees', 14: 'castle-gate',
  15: 'castle-interior', 16: 'castle-interior', 17: 'castle-interior', 18: 'castle-interior',
  19: 'castle-gate', 20: 'castle-throne',
};

function terrainStringToArenaId(terrain) {
  if (!terrain || typeof terrain !== 'string') return null;
  const t = terrain.toLowerCase();
  if (t.includes('finch') || t.includes('burrow')) return 'finch-burrow';
  if (t.includes('throne') && t.includes('castle')) return 'castle-throne';
  if (t.includes('inner court') || t.includes('high spire')) return 'castle-interior';
  if (t.includes('rampart') || (t.includes('outer') && t.includes('court'))) return 'castle-interior';
  if (t.includes('cathedral') || t.includes('castle road')) return 'castle-interior';
  if (t.includes('fog pass') || t.includes('mountain pass')) return 'castle-gate';
  if (t.includes('stone bridge') || t.includes('bridge crossing')) return 'bridge';
  if (t.includes('bridge')) return 'bridge';
  if (t.includes('river') || t.includes('rapids') || t.includes('ford')) return 'river';
  if (t.includes('mill') || t.includes('ruin')) return 'ruins';
  if (t.includes('barn') || t.includes('yard') || t.includes('farmstead')) return 'barn';
  if (t.includes('house') || t.includes('homestead')) return 'house';
  if (t.includes('keep')) return 'castle-gate';
  if (t.includes('throne gate')) return 'castle-gate';
  if (t.includes('glade')) return 'open-glade';
  if (t.includes('crag') || (t.includes('ridge') && !t.includes('castle'))) return 'open-glade';
  if (t.includes('ashwood') || t.includes('forest') || t.includes('glen')) return 'forest';
  if (t.includes('mossy') || t.includes('hollow') || t.includes('track') || t.includes('trail')) return 'trees';
  return null;
}

function resolveBattleArenaId(encounterStage, terrain) {
  const fromTerrain = terrainStringToArenaId(terrain);
  if (fromTerrain) return fromTerrain;
  const st = Math.max(1, Math.min(20, Math.floor(Number(encounterStage)) || 1));
  return BATTLE_ARENA_BY_STAGE[st] || 'forest';
}

function battleArenaImagePaths(arenaId) {
  const id = String(arenaId || 'forest');
  const mobile = typeof document !== 'undefined' && document.body?.classList?.contains('ui-mobile-mode');
  const variant = mobile ? 'mobile' : 'desktop';
  return [
    `assets/arenas/arena-${id}-${variant}.png`,
    `assets/arenas/arena-${id}.png`,
  ];
}

function updateBattleArena() {
  const layer = document.getElementById('battle-arena-layer');
  const bd = document.getElementById('battle-arena-backdrop');
  if (!layer || !bd) return;
  const stage = getEncounterStage();
  const terrain = G._battleTerrain || null;
  const arenaId = resolveBattleArenaId(stage, terrain);
  layer.dataset.arena = arenaId;
  const paths = battleArenaImagePaths(arenaId);
  let pathIdx = 0;
  const tryNext = () => {
    if (pathIdx >= paths.length) {
      bd.style.backgroundImage = '';
      layer.classList.remove('arena-has-art');
      return;
    }
    const path = paths[pathIdx];
    pathIdx += 1;
    const img = new Image();
    img.onload = () => {
      bd.style.backgroundImage = `url('${path}')`;
      layer.classList.add('arena-has-art');
    };
    img.onerror = () => tryNext();
    img.src = path;
  };
  tryNext();
}
globalThis.updateBattleArena = updateBattleArena;

let _battleLogDrawerBound = false;
function initBattleLogDrawer() {
  if (_battleLogDrawerBound) return;
  const btn = document.getElementById('battle-log-toggle');
  const sec = document.getElementById('battle-log-section');
  if (!btn || !sec) return;
  _battleLogDrawerBound = true;
  const mq = window.matchMedia('(max-width: 900px)');
  const applyMq = () => {
    if (mq.matches) {
      sec.classList.add('collapsed');
      btn.setAttribute('aria-expanded', 'false');
    } else {
      sec.classList.remove('collapsed');
      btn.setAttribute('aria-expanded', 'true');
    }
  };
  btn.addEventListener('click', () => {
    if (!mq.matches) return;
    sec.classList.toggle('collapsed');
    btn.setAttribute('aria-expanded', sec.classList.contains('collapsed') ? 'false' : 'true');
  });
  mq.addEventListener('change', applyMq);
  applyMq();
}

/** True whenever the current run was launched via the overworld map. */
function _isOverworldRun() {
  if(G.endlessMode) return false;
  try { return !!localStorage.getItem(_OW_STATE_KEY); } catch(_) { return false; }
}

/** Map overworld node enemy labels to roster ids or resolvable birdKeys. */
function normalizeOwEnemyListForBattle(enemies, stage){
  if(!Array.isArray(enemies)||!enemies.length) return [];
  const st=Math.max(1,Math.floor(Number(stage)||G?.stage||1));
  const aliases={
    wardenrook:'crow',wardenrooks:'crow',rookwarden:'crow',
    dukblakiston:'dukeBlakiston',dukeblakiston:'dukeBlakiston',
  };
  return enemies.map(raw=>{
    const s=String(raw||'').trim();
    if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(s)) return s;
    const compact=s.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9_]/g,'');
    if(aliases[compact]) return typeof resolveOwStageToken==='function'?resolveOwStageToken(aliases[compact],st):aliases[compact];
    if(BIRDS&&BIRDS[compact]) return typeof resolveOwStageToken==='function'?resolveOwStageToken(compact,st):compact;
    const nk=normalizeEnemyNameKey(raw);
    const fromEnemy=ENEMIES.find(e=>normalizeEnemyNameKey(e.name)===nk);
    if(fromEnemy){
      if(fromEnemy.birdKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(fromEnemy.birdKey,st):fromEnemy.birdKey;
      if(fromEnemy.portraitKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(fromEnemy.portraitKey,st):fromEnemy.portraitKey;
    }
    if(BIRDS){
      const flat=String(raw||'').toLowerCase().replace(/[^a-z]/g,'');
      const birdKey=Object.keys(BIRDS).find(k=>k.toLowerCase().replace(/[^a-z]/g,'')===flat);
      if(birdKey) return typeof resolveOwStageToken==='function'?resolveOwStageToken(birdKey,st):birdKey;
    }
    return typeof resolveOwStageToken==='function'?resolveOwStageToken(compact,st):compact;
  });
}

/** Story fights that are a single boss (no multi-bird queue): milestone boss at 10, Duke Blakiston at 20. */
const STORY_BOSS_STAGES = new Set([10, 20]);
const STORY_MILESTONE_BOSS_STAGE = 10;
const STORY_DUKE_STAGE = 20;
const STORY_BOSS_STAT_MULT = Object.freeze({ hp: 2.0, atk: 1.3, matk: 1.3 });
function getStoryEnemyLevelBand(stage){
  if(typeof globalThis.getStoryEnemyLevelBand==='function'){
    const band=globalThis.getStoryEnemyLevelBand(stage);
    if(band.boss) return [band.level, band.level];
    if(band.duke) return [band.level, band.level];
    return [band.min, band.max];
  }
  if(stage<=4) return [1,2];
  if(stage<=9) return [3,5];
  if(stage<=14) return [6,8];
  return [9,10];
}
function getStoryEvolvedSlotCount(level){
  const budget=typeof getEnemyMutatedAbilityBudget==='function'?getEnemyMutatedAbilityBudget(level):{slots:0};
  return budget.slots||0;
}
/** Tier band → enemy level hint for skill mirroring budget. */
function getOwEnemySkillDepthFromTierBand(band){
  const b=Math.min(4,Math.max(1,Math.floor(Number(band))||1));
  const levelHint=[3,5,7,10][b-1]||4;
  const budget=typeof getEnemyMutatedAbilityBudget==='function'?getEnemyMutatedAbilityBudget(levelHint):{slots:0,tiers:[]};
  return{evolvedSlots:budget.slots||0,upgrades:0,levelHint};
}
/**
 * Fill enemy.abilities from base starters + player-mirrored mutations (when player has evolved slots).
 */
function materializeEnemyFamilySkillSlots(enemy, birdKey, enemyClass, evolvedSlotCount, upgradeCount){
  void upgradeCount;
  const level=Number.isFinite(enemy?.storyLevel)?enemy.storyLevel
    :(Number.isFinite(enemy?.effectiveLevel)?enemy.effectiveLevel:Math.max(1,Math.floor(Number(evolvedSlotCount)||1)*3));
  if(typeof materializeEnemySkillsFromPlayerMirror==='function'){
    return materializeEnemySkillsFromPlayerMirror(enemy,birdKey,level,G.player,enemyClass||enemy?.enemyClass);
  }
  return false;
}
function rollInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function weightedPick(entries){
  const total=entries.reduce((s,e)=>s+Math.max(0,Number(e.w)||0),0);
  if(total<=0) return entries[0]?.k;
  let r=Math.random()*total;
  for(const e of entries){ r-=Math.max(0,Number(e.w)||0); if(r<=0) return e.k; }
  return entries[entries.length-1]?.k;
}
function classGrowthWeightsForStory(cls){
  const c=resolveFinalClass(cls);
  if(c==='rogue') return [{k:'atk',w:4},{k:'spd',w:4},{k:'dodge',w:3},{k:'maxHp',w:2},{k:'def',w:2},{k:'mdef',w:1},{k:'matk',w:1}];
  if(c==='inquisitor') return [{k:'atk',w:4},{k:'spd',w:3},{k:'dodge',w:3},{k:'maxHp',w:2},{k:'def',w:2},{k:'mdef',w:2},{k:'matk',w:1}];
  if(c==='knight') return [{k:'maxHp',w:5},{k:'def',w:4},{k:'mdef',w:3},{k:'atk',w:2},{k:'dodge',w:2},{k:'spd',w:1},{k:'matk',w:1}];
  if(c==='bard') return [{k:'spd',w:4},{k:'dodge',w:4},{k:'atk',w:2},{k:'matk',w:2},{k:'maxHp',w:2},{k:'def',w:2},{k:'mdef',w:2}];
  if(c==='siren') return [{k:'matk',w:4},{k:'mdef',w:3},{k:'maxHp',w:3},{k:'spd',w:2},{k:'dodge',w:2},{k:'atk',w:1},{k:'def',w:1}];
  return [{k:'matk',w:4},{k:'mdef',w:3},{k:'maxHp',w:3},{k:'spd',w:2},{k:'dodge',w:2},{k:'atk',w:1},{k:'def',w:1}]; // mage
}
function buildStoryEnemyFromBirdKey(birdKey, stage, opts={}){
  const bd=BIRDS?.[birdKey];
  if(!bd) return null;
  const stats={
    hp:roundCombatStat(bd.stats?.hp||bd.stats?.maxHp||30, 0.01),
    maxHp:roundCombatStat(bd.stats?.maxHp||bd.stats?.hp||30, 0.01),
    atk:roundCombatStat(bd.stats?.atk||6, 0.01),
    def:roundCombatStat(bd.stats?.def||2, 0),
    matk:roundCombatStat(bd.stats?.matk||8, 0.01),
    mdef:roundCombatStat(bd.stats?.mdef||8, 0),
    spd:roundCombatStat(bd.stats?.spd||6, 0.01),
    acc:roundCombatStat(bd.stats?.acc||80, 60),
    dodge:roundCombatStat(bd.stats?.dodge||10, 0),
    critChance:roundCombatStat(bd.stats?.critChance||5, 0),
    critMult:Math.max(1.1,Number(bd.stats?.critMult||1.5)),
  };
  const plv=Math.max(1, Math.floor(G.player?.birdLevel||1));
  const level=typeof getEnemyLevelForDifficulty==='function'
    ? getEnemyLevelForDifficulty(plv, G.difficulty||'juvenile')
    : plv;
  const cls=String(bd.class||'striker').toLowerCase();
  const featherTotal=3*level;
  for(let i=0;i<featherTotal;i++) applyEnemyFeatherFromPlayerMirror(stats,cls);
  const enemyStub={birdKey, abilities:[], familyEvolutionState:{}};
  if(typeof materializeEnemySkillsFromPlayerMirror==='function'){
    materializeEnemySkillsFromPlayerMirror(enemyStub,birdKey,level,G.player,cls);
  }
  const evolvedSlots=getStoryEvolvedSlotCount(level);
  const diffMult = DIFFICULTIES[G.difficulty||'juvenile']?.mult || 1;
  stats.maxHp=roundCombatStat(Math.max(0.01, stats.maxHp*diffMult), 0.01);
  stats.hp=stats.maxHp;
  stats.atk=roundCombatStat(Math.max(0.01, stats.atk*diffMult), 0.01);
  stats.matk=roundCombatStat(Math.max(0.01, stats.matk*diffMult), 0.01);
  if(opts.isBoss){
    stats.maxHp=roundCombatStat(Math.max(0.01, stats.maxHp*STORY_BOSS_STAT_MULT.hp), 0.01);
    stats.hp=stats.maxHp;
    stats.atk=roundCombatStat(Math.max(0.01, stats.atk*STORY_BOSS_STAT_MULT.atk), 0.01);
    stats.matk=roundCombatStat(Math.max(0.01, stats.matk*STORY_BOSS_STAT_MULT.matk), 0.01);
  }
  normalizeCombatStats(stats);
  const size=bd.size||'medium';
  const enProf=getEnemyEnergyProfile();
  const aiStyle=(['predator','striker'].includes(cls)?'aggressive':(cls==='tank'?'defensive':(cls==='trickster'?'trickster':'cautious')));
  const aiPersonality=typeof inferAIPersonalityFromClass==='function'?inferAIPersonalityFromClass(cls):inferAIPersonalityFromStyle(aiStyle,bd.name);
  return {
    id:`story_${birdKey}_${stage}_${Math.floor(Math.random()*1e6)}`,
    name:bd.name,
    birdKey,
    portraitKey:bd.portraitKey||birdKey,
    size,
    enemyClass:cls,
    aiStyle,
    aiPersonality,
    abilities:JSON.parse(JSON.stringify(enemyStub.abilities||[])),
    stats:{...stats,en:enProf.maxEN},
    hp:stats.hp,maxHp:stats.maxHp,atk:stats.atk,def:stats.def,spd:stats.spd,acc:stats.acc,dodge:stats.dodge,mdef:stats.mdef,matk:stats.matk,
    cc:Math.max(0.05,Math.min(0.95,(stats.critChance||5)/100)), cd:stats.critMult||1.5,
    energyMax:enProf.maxEN,energy:enProf.startEN,energyRegen:enProf.regenEN,
    isBoss:!!opts.isBoss,
    bossTitle:opts.bossTitle||'',
    storyLevel:level, storyEvolvedSlots:evolvedSlots,
    _storyDirectStats:true,
  };
}

function generateStoryStageEnemyKeys(stage, playerBirdKey){
  const st=Math.max(1,Math.floor(Number(stage)||1));
  if(STORY_BOSS_STAGES.has(st)){
    if(st===STORY_DUKE_STAGE){
      const dukeId=typeof getStoryDukeRosterId==='function'?getStoryDukeRosterId():'BO-DUKEB-STORY-L10';
      return [dukeId];
    }
    if(st===STORY_MILESTONE_BOSS_STAGE){
      const pickFn=typeof pickStoryEncounterEnemyIds==='function'?pickStoryEncounterEnemyIds:null;
      if(pickFn){
        const ids=pickFn(st, playerBirdKey||'', 1);
        if(ids?.length) return ids;
      }
      return [];
    }
    return [];
  }
  const pickFn=typeof pickStoryEncounterEnemyIds==='function'?pickStoryEncounterEnemyIds:null;
  if(pickFn){
    try{
      const p=pickFn(st, playerBirdKey||'');
      if(Array.isArray(p)&&p.length>=1) return p;
    }catch(err){ console.warn('[StoryEncounter] pickStoryEncounterEnemyIds failed', err); }
  }
  const chainCount=typeof globalThis.getStoryEncounterChainCount==='function'
    ? Math.max(1,globalThis.getStoryEncounterChainCount(st))
    : 3;
  return Array.from({length:chainCount},()=>'EN-SPARR-HESQ-L01');
}

function commitStoryEncounterMeta(stageNum, playerBirdKey, owBirdKeys){
  const st=Math.max(1,Math.floor(Number(stageNum)||1));
  if(STORY_BOSS_STAGES.has(st)){
    G.currentStoryEncounter={
      stageNumber:st,
      isBoss:true,
      birdKeys: st===STORY_DUKE_STAGE ? ['dukeBlakiston'] : (Array.isArray(owBirdKeys)?owBirdKeys.filter(Boolean):[])
    };
  }else{
    const keys=Array.isArray(owBirdKeys)?owBirdKeys.filter(Boolean):[];
    G.currentStoryEncounter={
      stageNumber:st,
      isBoss:false,
      birdKeys: keys.slice()
    };
  }
  try{ if(typeof window!=='undefined') window.currentStageEncounter=G.currentStoryEncounter; }catch(_){}
}
/** One feather = same stat increments as player LEVELUP_STAT_POOL choices (class-weighted pick). */
function applyEnemyFeatherFromPlayerMirror(stats, cls){
  const key=weightedPick(classGrowthWeightsForStory(cls));
  switch(key){
    case 'maxHp':
      stats.maxHp=(stats.maxHp||1)+4;
      stats.hp=stats.maxHp;
      break;
    case 'atk': stats.atk=(stats.atk||0)+2; break;
    case 'matk': stats.matk=(stats.matk||8)+2; break;
    case 'def': stats.def=(stats.def||0)+2; break;
    case 'mdef': stats.mdef=(stats.mdef||8)+2; break;
    case 'spd': stats.spd=(stats.spd||1)+2; break;
    case 'dodge':
      stats.dodge=Math.min(95,(stats.dodge||0)+2);
      break;
    default: stats.atk=(stats.atk||0)+2; break;
  }
}
function applyStoryEnemyGrowth(stats,key){
  switch(key){
    case 'maxHp': stats.maxHp+=4; stats.hp=stats.maxHp; break;
    case 'atk': stats.atk+=2; break;
    case 'matk': stats.matk=(stats.matk||8)+2; break;
    case 'def': stats.def+=2; break;
    case 'mdef': stats.mdef=(stats.mdef||8)+2; break;
    case 'spd': stats.spd+=2; break;
    case 'dodge': stats.dodge=Math.min(95,(stats.dodge||0)+2); break;
  }
}
function chooseStoryPathForSlot(slot, birdKey, cls){
  const options=getSkillEvolutionPathOptions(slot, birdKey) || [];
  if(!options.length) return null;
  const pref={
    striker:['speed','crit','burst','tempo','rush'],
    predator:['execute','prey','mark','hunt','pressure'],
    bruiser:['guard','tank','impact','brawl','counter'],
    tank:['guard','bulwark','ward','brace','shield'],
    trickster:['trick','steal','dread','disrupt','flutter'],
    singer:['song','chorus','echo','refrain','hex'],
  }[cls] || [];
  const birdHint=String(birdKey||'').toLowerCase().replace(/_/g,'');
  const scored=options.map(opt=>{
    const id=String(opt.pathId||'').toLowerCase();
    const dn=String(opt.displayName||'').toLowerCase();
    let s=1;
    if(pref.some(x=>id.includes(x)||dn.includes(x))) s+=3;
    if(id.includes(birdHint.slice(0,4))) s+=2;
    return {opt,score:s};
  });
  const best=scored.sort((a,b)=>b.score-a.score)[0];
  return best?.opt?.pathId || options[0].pathId;
}

/** Linear story (and shared save state): variable-length enemy chains per stage band (see getStoryEncounterChainCount). */
function syncStoryEncounterBirdQueue(encounterStage){
  if(G.endlessMode) return;
  const st=Math.max(1,Math.floor(Number(encounterStage)||1));
  if(STORY_BOSS_STAGES.has(st)){
    G._owEncounterRollStage=null;
    G._owEncounterDrafts=null;
    G._owEncounterDraftsSig=null;
    G._owEncounterMaterialized=null;
    G._owEncounterMaterializedSig=null;
    G._owEnemyIndex=0;
    G._owEnemyCount=1;
    G._defeatedEncounterBirds=[];
    if(st===STORY_DUKE_STAGE){
      const dukeId=typeof getStoryDukeRosterId==='function'?getStoryDukeRosterId():'BO-DUKEB-STORY-L10';
      G._owStageEnemies=[dukeId];
    }else if(st===STORY_MILESTONE_BOSS_STAGE){
      const pickFn=typeof pickStoryEncounterEnemyIds==='function'?pickStoryEncounterEnemyIds:null;
      G._owStageEnemies=pickFn?pickFn(st,G.player?.birdKey||'',1):[];
    }else{
      G._owStageEnemies=null;
    }
    commitStoryEncounterMeta(st, G.player?.birdKey, G._owStageEnemies);
    return;
  }
  if(_isOverworldRun() && Array.isArray(G._owStageEnemies) && G._owStageEnemies.length>0){
    G._owEnemyCount=Math.max(G._owEnemyCount||0,G._owStageEnemies.length);
    commitStoryEncounterMeta(st, G.player?.birdKey, G._owStageEnemies);
    return;
  }
  const idx=G._owEnemyIndex||0;
  const midChain=Number(G._owEncounterRollStage)===st && Array.isArray(G._owStageEnemies) && G._owStageEnemies.length>1 && idx>0 && idx<G._owStageEnemies.length;
  const freshRolled=Number(G._owEncounterRollStage)===st && Array.isArray(G._owStageEnemies) && G._owStageEnemies.length>1 && idx===0;
  if(midChain || freshRolled) return;
  const rolled=generateStoryStageEnemyKeys(st,G.player?.birdKey);
  G._owStageEnemies=normalizeOwEnemyListForBattle(rolled, st);
  G._owEnemyIndex=0;
  G._owEnemyCount=Math.max(1,G._owStageEnemies?.length||1);
  G._owEncounterRollStage=st;
  G._defeatedEncounterBirds=[];
  resetStageBattleStats();
  commitStoryEncounterMeta(st, G.player?.birdKey, G._owStageEnemies);
}

/**
 * Called on index.html startup. If the player navigated here from the overworld
 * (entering a stage or shop node), restore the run and route correctly.
 * Returns true if it handled the intent so initSelectionSafe can bail out early.
 */

function handleOverworldReturn() {
  let intent = null;
  try { intent = JSON.parse(localStorage.getItem(_OW_NAV_KEY) || 'null'); } catch(_) {}
  if (!intent?.action) return false;

  const save = loadSaveData();
  if (!save?.player) return false;
  if (save?.endlessMode) {
    try {
      localStorage.removeItem(_OW_NAV_KEY);
      localStorage.removeItem(_OW_STATE_KEY);
    } catch(_) {}
    return false;
  }

  try { localStorage.removeItem(_OW_NAV_KEY); } catch(_) {}

  if (intent.action === 'forgeTest') {
    G._owForgeReturnToForge = true;
    G._owForgeNavMeta = {
      mapId: intent.mapId || 'main',
      encounter: intent.encounter || null,
      clearRewards: Array.isArray(intent.clearRewards) ? intent.clearRewards : null,
      isForgeTest: true,
      forgeNodeIsBoss: !!intent.isBoss,
    };
    G._owForgeEncounter = intent.encounter || null;
    G._owForgePowerTier = 0;
    G._owPendingBattleStage = Math.max(1, Math.floor(Number(intent.stage) || save.stage || 1));
    G._owPendingNodeId = Number.isFinite(Number(intent.nodeId)) ? Math.floor(Number(intent.nodeId)) : null;
    G._battleTerrain = (typeof intent.terrain === 'string' && intent.terrain.trim()) ? intent.terrain.trim() : null;
    G._owSequenceShiny = 0;
    resetStageBattleStats();
    const stageNum = G._owPendingBattleStage;
    const pbk = save?.player?.birdKey;
    const resolveFn = typeof globalThis.resolveForgeEncounterBirdKeys === 'function'
      ? globalThis.resolveForgeEncounterBirdKeys : null;
    const rolled = resolveFn && intent.encounter
      ? resolveFn(intent.encounter, pbk, stageNum)
      : (pbk ? [pbk] : ['sparrow']);
    G._owStageEnemies = normalizeOwEnemyListForBattle(rolled, stageNum);
    G._owEnemyIndex = 0;
    G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
    G._owEncounterRollStage = stageNum;
    try {
      continueRun();
    } catch (err) {
      console.error('handleOverworldReturn forgeTest failed', err);
      G._owForgeReturnToForge = false;
      return false;
    }
    return true;
  }

  if (intent.action === 'battle') {
    // #region agent log
    fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:battle',message:'OW battle intent',data:{stage:intent.stage,nodeId:intent.nodeId,hasEncounter:!!intent.encounter,hasSave:!!save?.player},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    G._owForgeNavMeta = {
      mapId: intent.mapId || 'main',
      nodeKey: intent.nodeKey || null,
      encounter: intent.encounter || null,
      bonusConfig: intent.bonus || null,
      clearRewards: Array.isArray(intent.clearRewards) ? intent.clearRewards : null,
      powerTier: Math.max(0, Math.floor(Number(intent.powerTier) || 0)),
      isBonus: !!intent.isBonus,
      isWorldInterior: !!intent.isWorldInterior,
      worldId: intent.worldId || null,
      worldIndex: intent.worldIndex != null ? Number(intent.worldIndex) : null,
      subStage: intent.subStage != null ? Number(intent.subStage) : null,
      skipMainStageAdvance: !!(intent.isBonus || intent.isWorldInterior),
    };
    G._owForgeEncounter = intent.encounter || null;
    G._owForgePowerTier = G._owForgeNavMeta.powerTier;
    G._owPendingBattleStage = Math.max(1, Math.floor(Number(intent.stage) || save.stage || 1));
    G._owPendingNodeId = Number.isFinite(Number(intent.nodeId)) ? Math.floor(Number(intent.nodeId)) : null;
    G._battleTerrain = (typeof intent.terrain === 'string' && intent.terrain.trim()) ? intent.terrain.trim() : null;
    G._owSequenceShiny = 0;
    resetStageBattleStats();
    const stageNum=G._owPendingBattleStage;
    const pbk=save?.player?.birdKey;
    if(!G.endlessMode && !STORY_BOSS_STAGES.has(stageNum) && intent.encounter){
      const resolveFn = typeof globalThis.resolveForgeEncounterBirdKeys === 'function'
        ? globalThis.resolveForgeEncounterBirdKeys : null;
      const rolled = resolveFn
        ? resolveFn(intent.encounter, pbk, stageNum)
        : generateStoryStageEnemyKeys(stageNum, pbk);
      G._owStageEnemies = normalizeOwEnemyListForBattle(rolled, stageNum);
      G._owEnemyIndex   = 0;
      G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
      G._owEncounterRollStage = stageNum;
      commitStoryEncounterMeta(stageNum, pbk, G._owStageEnemies);
    } else if(!G.endlessMode && !STORY_BOSS_STAGES.has(stageNum)){
      const rolled=generateStoryStageEnemyKeys(stageNum, pbk);
      G._owStageEnemies = normalizeOwEnemyListForBattle(rolled, stageNum);
      G._owEnemyIndex   = 0;
      G._owEnemyCount = Math.max(1, G._owStageEnemies?.length || 1);
      G._owEncounterRollStage = stageNum;
      commitStoryEncounterMeta(stageNum, pbk, G._owStageEnemies);
    } else {
      G._owStageEnemies = null;
      G._owEnemyIndex   = 0;
      G._owEnemyCount = 1;
      commitStoryEncounterMeta(stageNum, pbk, null);
    }
    try{
      // #region agent log
      fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:preContinueRun',message:'Before continueRun',data:{pendingStage:G._owPendingBattleStage,owEnemies:G._owStageEnemies,owCount:G._owEnemyCount,encounterRollStage:G._owEncounterRollStage},timestamp:Date.now(),hypothesisId:'H1,H4'})}).catch(()=>{});
      // #endregion
      continueRun(); // restores state; continueRun ends with loadStage()
    }catch(err){
      // #region agent log
      fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:handleOverworldReturn:battleCatch',message:'continueRun failed',data:{err:String(err&&err.message||err),stack:String(err&&err.stack||'').slice(0,500)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      console.error('handleOverworldReturn battle failed', err);
      try{ localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); }catch(_){ }
      return false;
    }
    return true;
  }
  if (intent.action === 'shop') {
    G._currentShopNodeId = intent.nodeId ?? null; // persist shop snapshot by node
    setOverworldCurrentNode(intent.nodeId);
    G._pendingOverworldShop = true; // loadStage() will detect this and open shop instead
    try{
      continueRun();
      return true;
    }catch(err){
      console.error('handleOverworldReturn shop failed', err);
      G._pendingOverworldShop = false;
      G._currentShopNodeId = null;
      try{ localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); }catch(_){}
      return false;
    }
  }
  if (intent.action === 'nest') {
    const nestSave = loadSaveData();
    if (!nestSave?.player) return false;
    G._continueRunOpenNestOnly = true;
    try {
      continueRun();
    } catch (err) {
      console.error('Overworld nest: continueRun failed', err);
      G._continueRunOpenNestOnly = false;
      try { localStorage.setItem(_OW_NAV_KEY, JSON.stringify(intent)); } catch (_) {}
      return false;
    }
    return true;
  }
  return false;
}
globalThis.handleOverworldReturn = handleOverworldReturn;

// ============================================================
//  NEXT STAGE PREVIEW
// ============================================================
function showNextStagePreview() {
  const el=document.getElementById('next-stage-preview');
  if(!el) return;
  const nextStage=G.stage+1;
  if(!G.endlessMode && nextStage > getStoryMaxStage()){ el.style.display='none'; return; }
  let enemy;
  if(G.endlessMode&&nextStage>20){
    el.innerHTML=`<div class="nsp-title">Next Up</div><div class="nsp-enemy">⚔</div><div class="nsp-name" style="color:var(--gold)">Endless Battle ${G.endlessBattle+1}</div><div class="nsp-stats">Scaled enemies await...</div>`;
  } else {
    const isBoss=(nextStage===STORY_MILESTONE_BOSS_STAGE || nextStage===STORY_DUKE_STAGE);
    const previewIds=typeof pickStoryEncounterEnemyIds==='function'
      ? pickStoryEncounterEnemyIds(nextStage, G.player?.birdKey||'', 1)
      : ['EN-SPARR-HESQ-L01'];
    const previewId=previewIds[(nextStage*17)%Math.max(1,previewIds.length)]||previewIds[0];
    enemy=buildEdFromBirdEnemyTemplate(previewId,{isBoss,bossTitle:isBoss?bossTitleForStageMilestone(nextStage):''});
    if(enemy) mergeScaledStatsIntoEnemy(enemy, nextStage);
    const sizeLabel={tiny:'Tiny',small:'Small',medium:'Medium',large:'Large',xl:'Extra Large'}[enemy.size]||'?';
    const nspSprite=enemy.portraitKey?renderBirdIconHTML(enemy.portraitKey,'small',false):`<span class="nsp-emoji">${enemy.emoji||'⚔'}</span>`;
    el.innerHTML=`<div class="nsp-title">⟩ Next Stage ${nextStage}</div><div class="nsp-enemy">${nspSprite}</div><div class="nsp-name">${enemy.isBoss?`👑 ${enemy.bossTitle}: `:''} ${enemy.name}</div><div class="nsp-stats">HP ${enemy.hp} · ATK ${enemy.atk} · ${sizeLabel}${enemy.isBoss?' · <span class="rage-badge">BOSS</span>':''}</div>`;
  }
  el.style.display='block';
}

// ============================================================
//  SELECTION SCREEN
// ============================================================
const SIZE_ORDER = ['tiny','small','medium','large','xl'];
const SIZE_LABELS = {tiny:'Tiny',small:'Small',medium:'Medium',large:'Large',xl:'X-Large'};
const ROLE_ORDER = ['knight','rogue','mage','siren','inquisitor','bard'];
const ROLE_LABELS = {knight:'🛡️ Knight',rogue:'🗡️ Rogue',mage:'🔮 Mage',siren:'🎵 Siren',inquisitor:'🦅 Inquisitor',bard:'🎭 Bard',striker:'🗡️ Rogue',bruiser:'🛡️ Knight',tank:'🛡️ Knight',trickster:'🎭 Bard',predator:'🦅 Inquisitor',singer:'🔮 Mage'};
const ROLE_FLAVOR = {knight:'Armoured defender; absorbs and redirects physical damage.',rogue:'Fast evasive striker; speed, dodge, and penetration.',mage:'Arcane damage and control through spells.',siren:'Song-focused buffs, debuffs, and vocal magic.',inquisitor:'Execution pressure, pierce, and finishing power.',bard:'Utility, feints, and disruptive setups.'};
let shopPurchaseMade = false;

function initSelection() {
  const ui=ensureUIState();
  ui.selectionView='all';
  if(!ui.lockFilter) ui.lockFilter='unlocked';
  migrateLegacySelectionView(ui);
  if(!ui.expandedBird && G.selected) ui.expandedBird=G.selected;
  applyUIStateToDOM();
  // Check for saved run
  const save=loadSaveData();
  const row=document.getElementById('continue-row');
  const info=document.getElementById('continue-info');
  if(save&&save.player){
    if(row){
      row.style.display='flex';
      const mins=Math.floor((Date.now()-save.savedAt)/60000);
      const timeStr=mins<1?'just now':mins<60?`${mins}m ago`:`${Math.floor(mins/60)}h ago`;
      if(info) info.textContent=`${save.player.name} · Stage ${save.stage} · Lv.${save.player.birdLevel} · saved ${timeStr}`;
    }
  } else if(row){
    row.style.display='none';
  }

  // Build difficulty picker
  buildDifficultyPicker();

  // Build bird grid
  buildRosterFilterSelect();
  buildGameModeToggle();
  buildBirdGrid();
  renderHighscoreBoard();
  syncSelectTakeFlightButton();
}

function buildRosterFilterSelect(){
  const sel=document.getElementById('roster-filter-select');
  if(!sel) return;
  const ui=ensureUIState();
  if(!ui.lockFilter) ui.lockFilter='unlocked';
  const roleOptions=ROLE_ORDER.map(c=>`<option value="role:${c}">${idToClassLabel(c)}</option>`).join('');
  sel.innerHTML=`
    <option value="all">All Birds</option>
    <option value="alpha">Alphabetical</option>
    <option value="speciesTier">Species rarity (Tiers)</option>
    <option value="size">By Size</option>
    <option value="unlocked">Unlocked</option>
    <option value="locked">Locked</option>
    ${roleOptions}
  `;
  syncRosterFilterSelect();
}
function syncRosterFilterSelect(){
  const sel=document.getElementById('roster-filter-select');
  if(!sel) return;
  const ui=ensureUIState();
  let v='all';
  if(ui.lockFilter==='unlocked') v='unlocked';
  else if(ui.lockFilter==='locked') v='locked';
  else if(ui.selectionView==='size') v='size';
  else if(ui.selectionView==='alpha') v='alpha';
  else if(ui.selectionView==='speciesTier') v='speciesTier';
  else if(ui.selectionView && ui.selectionView!=='all') v=ui.selectionView;
  sel.value=v;
}
function onRosterFilterChange(value){
  const ui=ensureUIState();
  if(value==='all'){ ui.selectionView='all'; ui.lockFilter='all'; }
  else if(value==='size'){ ui.selectionView='size'; ui.lockFilter='all'; }
  else if(value==='alpha'){ ui.selectionView='alpha'; ui.lockFilter='all'; }
  else if(value==='speciesTier'){ ui.selectionView='speciesTier'; ui.lockFilter='all'; }
  else if(value==='unlocked'){ ui.selectionView='all'; ui.lockFilter='unlocked'; }
  else if(value==='locked'){ ui.selectionView='all'; ui.lockFilter='locked'; }
  else if(value.startsWith('role:')){ ui.selectionView=value; ui.lockFilter='all'; }
  buildBirdGrid();
  syncRosterFilterSelect();
}
globalThis.onRosterFilterChange=onRosterFilterChange;
// Stubs so legacy callers don't throw
function buildSelectionViewButtons(){ buildRosterFilterSelect(); }
function buildLockFilterButtons(){ syncRosterFilterSelect(); }

function setRosterMode(mode){
  const ui=ensureUIState();
  ui.lockFilter='all';
  ui.selectionView = (mode==='size') ? 'size' : 'all';
  buildSelectionViewButtons();
  buildLockFilterButtons();
  buildBirdGrid();
}

function setLockFilter(mode,btn){
  const ui=ensureUIState();
  ui.lockFilter = ['all','unlocked','locked'].includes(mode) ? mode : 'all';
  if(ui.selectionView==='size' || ui.selectionView==='all') ui.selectionView='all';
  buildLockFilterButtons();
  buildBirdGrid();
}

function buildGameModeToggle(){
  const host=document.getElementById('game-mode-toggle');
  if(!host) return;
  const ui=ensureUIState();
  const isEndless=(ui.gameMode==='endless');
  host.innerHTML=`<div class="mode-toggle"><button class="mode-toggle-btn ${!isEndless?'active':''}" onclick="setGameMode('story',this)">📖 Story Mode</button><button class="mode-toggle-btn ${isEndless?'active':''}" onclick="setGameMode('endless',this)">♾ Endless Mode</button></div>`;
}

function setGameMode(mode,btn){
  const ui=ensureUIState();
  ui.gameMode=(mode==='endless')?'endless':'story';
  applyUIStateToDOM();
  buildGameModeToggle();
  if(typeof syncSfselRunSummary==='function') syncSfselRunSummary();
}

function classToRoleId(cls,birdKey=''){
  return resolveFinalClass(cls,birdKey);
}
function migrateLegacySelectionView(ui=ensureUIState()){
  const raw=String(ui?.selectionView||'all');
  if(raw.startsWith('role:')) return;
  if(raw.startsWith('class:')){
    const legacy=raw.split(':')[1]||'all';
    ui.selectionView = legacy==='all' ? 'all' : `role:${classToRoleId(legacy)}`;
    return;
  }
  if(raw==='class') ui.selectionView='all';
}
function idToClassLabel(id){
  if(id==='all') return 'All';
  return (ROLE_LABELS[id]||id).replace(/^.*\s/,'');
}
function wireRefGuideClicks(){
  const btn = document.getElementById('ref-guide-open-btn');
  if(!btn || btn.dataset.wired==='1') return;
  btn.dataset.wired='1';
  btn.addEventListener('click', ()=>{
    try{
      if(typeof openRefGuideModal === 'function') openRefGuideModal();
    }catch(e){
      console.error('Ref guide open failed:', e);
      failsafeAdvance('ref-guide click');
    }
  }, {passive:true});
}

function renderStarterFallbackGrid(reason=''){
  const grid = document.getElementById('bird-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const starters = ['sparrow','goose','blackbird','crow','macaw','robin'];
  const row = document.createElement('div');
  row.className = 'size-birds-row';
  const statMax={HP:1,ATK:1,DEF:1,SPD:1,Dodge:1,ACC:1,Crit:1,MATK:1,MDEF:1};

  starters.forEach(key=>{
    const bird = BIRDS?.[key];
    if(!bird) return;
    row.appendChild(buildBirdCard(key, bird, false, statMax));
  });

  grid.appendChild(row);
  const label=document.getElementById('bird-count-label');
  if(label) label.textContent='6/6 birds unlocked (recovery)';

  if(BIRDS?.sparrow){
    G.selected='sparrow';
    ensureUIState().expandedBird='sparrow';
    updateAscentPanel('sparrow');
  }
  console.warn('Selection recovery fallback used.', reason);
}

function initSelectionSafe(){
  try { if(typeof rebuildFortuneHireCatalog==='function') rebuildFortuneHireCatalog(); } catch(_) {}
  try { if(typeof syncFortuneBalances==='function') syncFortuneBalances(); } catch(_) {}
  // If we navigated back from the overworld, handle the pending intent first.
  try { syncBuildNestUnlockUI(); } catch(_) {}
  try {
    const params = new URLSearchParams(globalThis.location?.search || '');
    if (params.get('forge') === '1' && isBuildNestUnlocked()) {
      try { globalThis.history.replaceState(null, '', globalThis.location.pathname + globalThis.location.hash); } catch(_) {}
      if (typeof globalThis.openMapForge === 'function') {
        globalThis.openMapForge();
        return;
      }
    }
  } catch(_) {}
  try { if (handleOverworldReturn()) return; } catch(err) {
    // #region agent log
    fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:initSelectionSafe:owCatch',message:'handleOverworldReturn outer catch',data:{err:String(err&&err.message||err)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
  }
  try{
    initSelection();
    wireRefGuideClicks();

    // If init did not throw but produced no cards (mobile/content:// edge), recover anyway.
    const cards=document.querySelectorAll('.bird-card').length;
    if(cards<=1){
      const ui=ensureUIState();
      ui.selectionView='all';
      buildSelectionViewButtons();
      buildLockFilterButtons();
      buildBirdGrid();
    }
    const postRepairCards=document.querySelectorAll('.bird-card').length;
    if(postRepairCards===0){
      renderStarterFallbackGrid('initSelectionSafe empty grid');
      failsafeAdvance('initSelectionSafe empty grid');
    }
  }catch(err){
    console.error('initSelection crashed:', err);

    renderStarterFallbackGrid('initSelectionSafe catch');
    failsafeAdvance('initSelectionSafe fallback');
  }
}

function buildDifficultyPicker() {
  const container = document.getElementById('diff-picker');
  if(!container) return;
  container.innerHTML = '';
  Object.values(DIFFICULTIES).forEach(d => {
    const locked = d.unlockRequires && !isUnlocked(d.unlockRequires);
    const btn = document.createElement('button');
    btn.className = 'diff-btn' + (locked?' locked-diff':'') + (G._selectedDifficulty===d.id?' active':'');
    btn.style.borderColor = locked ? 'rgba(60,50,35,.4)' : d.color+'88';
    if(G._selectedDifficulty===d.id) { btn.style.background=d.color; btn.style.color='#0a0c0f'; }
    btn.innerHTML = `<span>${d.emoji}</span><span>${d.label}</span>` + (locked?` <span style="font-size:.65rem;opacity:.7">🔒</span>`:'');
    if(locked) { btn.title = 'Complete Hard mode to unlock'; }
    else {
      btn.title = d.scalingTip || '';
      btn.onclick = () => selectDifficulty(d.id);
    }
    container.appendChild(btn);
  });
  // Set default
  if(!G._selectedDifficulty) { G._selectedDifficulty='juvenile'; buildDifficultyPicker(); }
  const desc = document.getElementById('diff-desc');
  const cur = DIFFICULTIES[G._selectedDifficulty||'juvenile'];
  if(desc) desc.textContent = `${cur.emoji} ${cur.label}: ${cur.desc}`;
}

function selectDifficulty(id) {
  G._selectedDifficulty = id;
  buildDifficultyPicker();
  if(typeof syncSfselRunSummary==='function') syncSfselRunSummary();
}

function setSelView(view, btn) {
  const ui=ensureUIState();
  ui.selectionView = String(view||'all');
  migrateLegacySelectionView(ui);
  buildSelectionViewButtons();
  buildLockFilterButtons();
  buildBirdGrid();
}

function buildBirdGrid() {
  const ui=ensureUIState();
  if(!ui.selectionView) ui.selectionView='all';
  migrateLegacySelectionView(ui);
  const selectedView=ui.selectionView;
  const isAlpha = selectedView === 'alpha';
  const isSpeciesTier = selectedView === 'speciesTier';
  const view = isAlpha || isSpeciesTier ? selectedView : (String(selectedView).startsWith('role:') ? 'all' : (selectedView==='size' ? 'size' : 'all'));
  const classFilter = String(selectedView).startsWith('role:') ? (String(selectedView).split(':')[1]||'all') : 'all';
  const lockFilter = ['all','unlocked','locked'].includes(ui.lockFilter) ? ui.lockFilter : 'unlocked';
  const starterKeys = (typeof Avian?.data?.motherGooseCatalog?.starterBirdKeys === 'function'
    ? Avian.data.motherGooseCatalog.starterBirdKeys()
    : ['sparrow','blackbird','macaw','crow','goose']);
  const speciesTierOrder = ['grey','green','blue','purple','gold','orange'];
  const speciesTierLabels = Avian?.data?.birdCardTiers?.SPECIES_RARITY_LABELS || {};

  const grid = document.getElementById('bird-grid');
  if(!grid) return;
  grid.innerHTML = '';

  let safeBirdEntries = Object.entries(BIRDS).filter(([,b])=>{
    return !!(b && b.stats && Number.isFinite(b.stats.hp) && Number.isFinite(b.stats.atk) && Number.isFinite(b.stats.def));
  });
  if(classFilter!=='all') safeBirdEntries = safeBirdEntries.filter(([key,b])=>classToRoleId(b.class,key)===classFilter);
  if(lockFilter!=='all') safeBirdEntries = safeBirdEntries.filter(([,bird])=>{
    const locked = bird.unlockRequires && !isUnlocked(bird.unlockRequires);
    return lockFilter==='locked' ? !!locked : !locked;
  });

  // Hard recovery: if strict stat validation gets stripped by legacy patch code,
  // render from the full roster model instead of collapsing to Sparrow-only.
  if(safeBirdEntries.length<=1){
    safeBirdEntries = Object.entries(BIRDS).filter(([,b])=>!!(b && typeof b==='object' && b.name));
    if(classFilter!=='all') safeBirdEntries = safeBirdEntries.filter(([key,b])=>classToRoleId(b.class,key)===classFilter);
    if(lockFilter!=='all') safeBirdEntries = safeBirdEntries.filter(([,bird])=>{
      const locked = bird.unlockRequires && !isUnlocked(bird.unlockRequires);
      return lockFilter==='locked' ? !!locked : !locked;
    });
  }
  const fallbackStarters = ['sparrow','goose','blackbird','crow','macaw','robin'];

  const groups = {};
  const orderedKeys = view==='size' ? SIZE_ORDER : (view==='speciesTier' ? speciesTierOrder : ROLE_ORDER);
  const groupLabels = view==='size' ? SIZE_LABELS : (view==='speciesTier' ? speciesTierLabels : ROLE_LABELS);

  orderedKeys.forEach(k => groups[k]=[]);

  safeBirdEntries.forEach(([key, bird]) => {
    let groupKey;
    if(view==='size') groupKey = bird.size||'medium';
    else if(view==='speciesTier') {
      const rarityMeta=getBirdSpeciesRarityMeta(key);
      groupKey = rarityMeta.speciesTier||'grey';
    } else groupKey = classToRoleId(bird.class,key);
    if(!groups[groupKey]) groups[groupKey]=[];
    groups[groupKey].push([key, bird]);
  });

  const appendSection=(title, entries)=>{
    if(!entries||!entries.length) return;
    const section = document.createElement('div');
    section.className = 'size-section';
    const header = document.createElement('div');
    header.className = 'size-header';
    header.innerHTML = `<div class="size-header-line"></div><div class="size-header-title">${title}</div><div class="size-header-line"></div>`;
    section.appendChild(header);
    const row = document.createElement('div');
    row.className='size-birds-row';
    entries.forEach(([key,bird])=>{
      totalBirds++;
      const locked = bird.unlockRequires && !isUnlocked(bird.unlockRequires);
      if(!locked) totalUnlocked++;
      row.appendChild(buildBirdCard(key,bird,locked));
    });
    section.appendChild(row);
    grid.appendChild(section);
  };

  let totalUnlocked=0, totalBirds=0;
  if(view==='alpha'){
    const sorted = safeBirdEntries.slice().sort((a,b)=>String(a[1].name||a[0]).localeCompare(String(b[1].name||b[0])));
    appendSection('Alphabetical', sorted);
  } else if(view==='all'){
    const starterSet = new Set(starterKeys);
    const starters = safeBirdEntries.filter(([key])=>starterSet.has(key));
    const others = safeBirdEntries.filter(([key])=>!starterSet.has(key));
    if(starters.length) appendSection('Starters', starters);
    if(others.length) appendSection('All other birds', others);
  } else if(view==='speciesTier'){
    speciesTierOrder.forEach(groupKey=>{
      const entries = (groups[groupKey]||[]).slice().sort((a,b)=>String(a[1].name||a[0]).localeCompare(String(b[1].name||b[0])));
      if(!entries.length) return;
      appendSection(groupLabels[groupKey]||groupKey, entries);
    });
  } else orderedKeys.forEach(groupKey => {
    const entries = groups[groupKey];
    if(!entries||!entries.length) return;

    const section = document.createElement('div');
    section.className = 'size-section';

    // Section header
    const header = document.createElement('div');
    header.className = 'size-header';
    header.innerHTML = `<div class="size-header-line"></div><div class="size-header-title">${groupLabels[groupKey]||groupKey}</div>`;
    if(view==='role' && ROLE_FLAVOR[groupKey]) {
      header.innerHTML += `<div style="font-size:.62rem;color:var(--text-dim);font-style:italic;flex-shrink:0;">${ROLE_FLAVOR[groupKey]}</div>`;
    }
    header.innerHTML += `<div class="size-header-line"></div>`;
    section.appendChild(header);

    const row = document.createElement('div');
    row.className = 'size-birds-row';

    entries.forEach(([key, bird]) => {
      totalBirds++;
      const locked = bird.unlockRequires && !isUnlocked(bird.unlockRequires);
      if(!locked) totalUnlocked++;
      const card = buildBirdCard(key, bird, locked);
      row.appendChild(card);
    });

    section.appendChild(row);
    grid.appendChild(section);
  });

  const label = document.getElementById('bird-count-label');
  if(label){
    const lockTag = lockFilter==='all' ? '' : (lockFilter==='locked' ? ' · Locked only' : ' · Unlocked only');
    label.textContent = `${totalUnlocked}/${totalBirds} birds unlocked${classFilter!=='all' ? ` · ${idToClassLabel(classFilter)}`:''}${lockTag}`;
  }

  const focusKey=ui.expandedBird||G.selected;
  if(focusKey && BIRDS[focusKey]) updateAscentPanel(focusKey);
  else updateAscentPanel('');

  // Hard fallback: never allow an empty/brick select screen.
  if(totalBirds===0){
    console.error('Character select fallback: no valid bird entries detected.');
    const section=document.createElement('div');
    section.className='size-section';
    const row=document.createElement('div');
    row.className='size-birds-row';
    fallbackStarters.forEach(key=>{
      const bird=BIRDS[key];
      if(!bird||!bird.stats) return;
      row.appendChild(buildBirdCard(key,bird,false));
    });
    section.appendChild(row);
    grid.appendChild(section);
    if(label) label.textContent='6/6 birds unlocked (fallback)';
  }
}

document.addEventListener('click', (e)=>{
  const menu=document.getElementById('class-filter-menu');
  const btn=document.getElementById('class-filter-btn');
  if(!menu||!btn) return;
  if(menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('open');
});


function renderBirdCardStarsHtml(stars, maxStars=5) {
  const n=Math.max(0, Math.min(maxStars, Math.floor(Number(stars)||0)));
  let html=`<span class="bird-card-stars" aria-label="${n} of ${maxStars} stars">`;
  for(let i=0;i<maxStars;i++){
    html+=`<span class="bird-card-star${i<n?' is-filled':''}">${i<n?'★':'☆'}</span>`;
  }
  return html+'</span>';
}

function getBirdSpeciesRarityMeta(birdKey) {
  const cat=Avian?.data?.motherGooseCatalog;
  const tierPack=Avian?.data?.birdCardTiers;
  const row=cat?.getBirdSpeciesRow?.(birdKey);
  const speciesTier=row?.speciesTier||'grey';
  const label=tierPack?.SPECIES_RARITY_LABELS?.[speciesTier]||tierPack?.TIER_LABELS?.[speciesTier]||speciesTier;
  const css=tierPack?.TIER_CSS?.[speciesTier]||'tier-grey';
  return {speciesTier, label, css};
}

function buildBirdCard(key, bird, locked) {
  const card = document.createElement('div');
  const ui=ensureUIState();
  const cardTier=!locked&&typeof getBirdCardTier==='function'?getBirdCardTier(key):'grey';
  const tierCss=Avian?.data?.birdCardTiers?.TIER_CSS?.[cardTier]||'tier-grey';
  card.className = 'bird-card' + (locked ? ' bird-locked' : ` bird-card--${tierCss}`) + (ui.expandedBird===key?' selected':'');
  card.dataset.birdKey = key;
  if (!locked) card.onclick = () => selectBird(key, card);

  const cls = classToRoleId(bird.class);
  const sizeClass = getUISizeClass(bird, 'select');

  const unlockLabel = bird.unlockHint || '🔒 Locked';

  if(locked) {
    card.innerHTML = `
      <div class="bird-card-head">
        <span class="class-badge class-${cls}">${idToClassLabel(cls).toUpperCase()}</span>
        <span class="bird-size-chip">${SIZE_LABELS[bird.size||'medium']||bird.size}</span>
      </div>
      <div style="display:flex;justify-content:center;margin:2px auto 6px;">${renderBirdIconHTML(key,sizeClass,true)}</div>
      <div class="bird-nm" style="color:#555;font-size:.8rem;">${bird.name}</div>
      <div class="lock-overlay"><span class="lock-icon" style="font-size:1rem;">🔒</span><div class="lock-label" style="font-size:.6rem;color:#555;line-height:1.3;">${unlockLabel}</div></div>`;
  } else {
    const cardTier=typeof getBirdCardTier==='function'?getBirdCardTier(key):'grey';
    const cardStars=typeof getBirdCardStars==='function'?getBirdCardStars(key):0;
    const tierPack=Avian?.data?.birdCardTiers;
    const tierLabel=tierPack?.TIER_LABELS?.[cardTier]||cardTier;
    const tierCss=tierPack?.TIER_CSS?.[cardTier]||'tier-grey';
    const maxStars=tierPack?.STARS_PER_TIER||5;
    const starsHtml=renderBirdCardStarsHtml(cardStars, maxStars);
    const rarityMeta=getBirdSpeciesRarityMeta(key);
    const rarityBadge=`<span class="bird-card-rarity-badge ${rarityMeta.css}" title="Species rarity">${escapeHtmlRoster(rarityMeta.label)} species</span>`;
    const feathers=typeof getSpeciesFeathers==='function'?getSpeciesFeathers(key):0;
    const featherChip=feathers>0?`<span class="bird-feather-chip" title="Species Feathers">🪶 ${feathers}</span>`:'';
    card.innerHTML = `
      <div class="bird-card-head">
        <span class="class-badge class-${cls}">${idToClassLabel(cls).toUpperCase()}</span>
        <span class="bird-size-chip">${SIZE_LABELS[bird.size||'medium']||bird.size}</span>
        <span class="bird-card-tier-badge ${tierCss}">${tierLabel}</span>
        ${rarityBadge}
        ${featherChip}
      </div>
      ${starsHtml}
      <div style="display:flex;justify-content:center;margin:4px auto 8px;">${renderBirdIconHTML(key,sizeClass,false)}</div>
      <div class="bird-nm">${bird.name}</div>
      <div class="bird-tagline-mini">${bird.tagline||''}</div>`;
  }
  return card;
}

function selectBird(key, el) {
  primeAudioIfNeeded();
  const ui=ensureUIState();
  G.selected = key;
  ui.expandedBird = key;
  document.querySelectorAll('#bird-grid .bird-card').forEach(n=>n.classList.remove('selected'));
  if(el && el.classList) el.classList.add('selected');
  updateAscentPanel(key);
  if(el && typeof el.scrollIntoView==='function'){
    try{ el.scrollIntoView({block:'nearest', behavior:'smooth', inline:'nearest'}); }catch(_){ try{ el.scrollIntoView(false); }catch(__){} }
  }
}

function mutateBirdCardSelect(birdKey){
  if(!birdKey||typeof mutateBirdCard!=='function') return;
  const result=mutateBirdCard(birdKey);
  if(result?.ok){
    updateAscentPanel(birdKey);
    if(typeof buildBirdGrid==='function') try{ buildBirdGrid(); }catch(_){}
    if(typeof renderFortuneInventory==='function') try{ renderFortuneInventory(); }catch(_){}
    if(result.isTierUp){
      const ui=ensureUIState();
      requestAnimationFrame(()=>{
        try{
          const card=document.querySelector(`#bird-grid .bird-card[data-bird-key="${birdKey}"]`);
          if(!card) return;
          if(ui.expandedBird===birdKey) card.classList.add('selected');
          card.classList.remove('bird-card--tier-up-flash');
          void card.offsetWidth;
          card.classList.add('bird-card--tier-up-flash');
          card.addEventListener('animationend',()=>card.classList.remove('bird-card--tier-up-flash'),{once:true});
        }catch(_){}
      });
    }
  }
}
globalThis.mutateBirdCardSelect=mutateBirdCardSelect;


/* ===== Sprite/Portrait helper: always prefer sprite when available ===== */
function __normSpriteKey(k){ return String(k||'').toLowerCase().replace(/[^a-z]/g,''); }
function __hasSpriteKey(k){
  k=__normSpriteKey(k);
  // sprite keys are represented by CSS class .sprite-<key>
  return !!(document.querySelector && document.querySelector('.sprite-'+k)) || (globalThis.SPRITE_KEYS_ALL && SPRITE_KEYS_ALL.has && SPRITE_KEYS_ALL.has(k));
}
/** Effective roster size for UI (fixes older saves missing player.size; aliases emperorpenguin → penguin). */
function rosterSizeForEntity(entity){
  let sz=String(entity?.size||entity?.birdSize||'').trim().toLowerCase();
  if(sz) return sz;
  const flat=String(entity?.birdKey||entity?.portraitKey||entity?.id||'').toLowerCase().replace(/[^a-z]/g,'');
  if(!flat) return '';
  const toCanon={emperorpenguin:'penguin',secretarybird:'secretary',harpyeagle:'harpy',baldeagle:'baldEagle',blackcockatoo:'blackCockatoo',dukeblakiston:'dukeBlakiston'};
  const canon=toCanon[flat]||flat;
  if(BIRDS[canon]?.size) return String(BIRDS[canon].size).toLowerCase();
  const hit=Object.keys(BIRDS).find(k=>String(k).toLowerCase().replace(/[^a-z]/g,'')===flat);
  return hit&&BIRDS[hit]?.size?String(BIRDS[hit].size).toLowerCase():'';
}
function getUISizeClass(entity, context='general'){
  const key=__normSpriteKey(entity?.portraitKey||entity?.birdKey||entity?.id||'');
  const sz=rosterSizeForEntity(entity);
  const isBoss=!!entity?.isBoss;
  if(isBoss&&context==='battle') return 'boss';
  if(key==='penguin') return 'xl';
  if(key==='seagull') return 'medium';
  if(key==='robin') return 'small';
  if(sz.includes('tiny')) return 'tiny';
  if(sz.includes('small')) return 'small';
  if(sz==='xl'||sz.includes('xlarge')) return 'xl';
  if(sz.includes('large')) return 'large';
  if(sz.includes('medium')) return 'medium';
  return 'medium';
}
function normalizeSpriteBirdKey(raw){
  const k = String(raw||'').toLowerCase().replace(/[^a-z]/g,'');
  if(k === 'peregrinefalcon') return 'peregrine';
  if(k === 'snowyowl' || k === 'snowy') return 'snowyowl';
  if(k === 'secretary') return 'secretarybird';
  if(k === 'harpyeagle') return 'harpy';
  return k;
}
function neutralBirdFallbackHTML(sizeClass){
  return `<svg class="bird-fallback-svg ${sizeClass||''}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18 50c10-20 24-31 44-30-6 7-10 13-12 19 8 1 14 5 18 11-12-1-21 1-28 7-6 5-11 8-18 7 3-4 4-8 4-14-4 0-6 0-8 0z" fill="#c9a84c" opacity=".9"/><path d="M37 27c7 6 9 12 7 18" stroke="#0a0c0f" stroke-width="2" fill="none" opacity=".5"/></svg>`;
}
function renderBirdIconHTML(birdKey, sizeClass, locked){
  const k = normalizeSpriteBirdKey(birdKey);
  if(k === 'mutatedpigeon'){
    return `<div class="sprite4 ${sizeClass||''} sprite-mutatedpigeon frame-0 ${locked?'locked':''}"></div>`;
  }
  const spriteBirds = /^(sparrow|goose|blackbird|crow|macaw|robin|dove|hummingbird|shoebill|secretarybird|secretary|magpie|kookaburra|kiwi|penguin|flamingo|seagull|swan|emu|bowerbird|raven|lyrebird|peregrine|snowyowl|toucan|dukeblakiston|albatross|harpy|harpyeagle|baldeagle|blackcockatoo|ostrich|cassowary|barnowl|bluejay|bushturkey|bustard|cardinal|dodo|fairywren|finch|firecrest|galah|goldeneagle|pigeon)$/;
  if(spriteBirds.test(k)){
    return `<div class="sprite4 ${sizeClass||''} sprite-${k} frame-0 ${locked?'locked':''}"></div>`;
  }
  return neutralBirdFallbackHTML(sizeClass);
}
function renderEntityAvatarHTML(entity, context='battle', locked=false){
  const key = normalizeSpriteBirdKey(entity?.portraitKey || entity?.birdKey || entity?.id || '');
  const sizeClass = getUISizeClass(entity, context);
  return renderBirdIconHTML(key, sizeClass, locked);
}
function syncSfselRunSummary(){
  const wrap=document.getElementById('sfsel-run-summary');
  if(!wrap) return;
  const ui=ensureUIState();
  const diffId=G._selectedDifficulty||'juvenile';
  const diff=DIFFICULTIES?.[diffId]||DIFFICULTIES?.juvenile;
  const modeLabel=(ui.gameMode==='endless')?'♾ Endless':'📖 Story';
  const diffLabel=diff?(diff.emoji?`${diff.emoji} ${diff.label}`:diff.label):'Difficulty';
  wrap.innerHTML=`<span class="sfsel__run-chip sfsel__run-chip--mode">${escapeHtmlRoster(modeLabel)}</span><span class="sfsel__run-chip">${escapeHtmlRoster(diffLabel)}</span>`;
}
globalThis.syncSfselRunSummary=syncSfselRunSummary;

function syncSfselSelectedLabel(){
  const el=document.getElementById('sfsel-selected-label');
  if(!el) return;
  const key=G.selected;
  const bird=key&&BIRDS[key]?BIRDS[key]:null;
  if(!bird){
    el.hidden=true;
    el.textContent='';
    return;
  }
  const tierPack=Avian?.data?.birdCardTiers;
  const cardTier=typeof getBirdCardTier==='function'?getBirdCardTier(key):'grey';
  const tierLabel=tierPack?.TIER_LABELS?.[cardTier]||cardTier;
  const tierCss=tierPack?.TIER_CSS?.[cardTier]||'tier-grey';
  el.hidden=false;
  el.innerHTML=`Selected: <strong>${escapeHtmlRoster(bird.name)}</strong> <span class="bird-card-tier-badge ${tierCss}">${escapeHtmlRoster(tierLabel)}</span>`;
}

function syncSelectTakeFlightButton(){
  const btn=document.getElementById('take-flight-select-btn');
  if(!btn) return;
  const ok=!!(G.selected && BIRDS[G.selected]);
  btn.disabled=!ok;
  btn.setAttribute('aria-disabled', ok?'false':'true');
  btn.classList.toggle('take-flight-select-btn--disabled', !ok);
  const bird=ok?BIRDS[G.selected]:null;
  btn.textContent=bird?`✈ Take Flight as ${bird.name}`:'✈ Take Flight';
  syncSfselSelectedLabel();
  syncSfselRunSummary();
}
globalThis.syncSelectTakeFlightButton=syncSelectTakeFlightButton;

function escapeHtmlRoster(s){
  return String(s??'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function rosterAbilityBlurb(t){
  const raw=(t.levels&&t.levels[0]&&t.levels[0].desc!=null)?t.levels[0].desc:(t.desc!=null?t.desc:'No description');
  const text=typeof globalThis.normalizeCombatEnLabel==='function'?globalThis.normalizeCombatEnLabel(String(raw).trim()):String(raw).trim();
  return escapeHtmlRoster(text);
}
/** Same skill slot → ability pipeline as a new run (family evolution + ABILITY_TEMPLATES), for roster UI only. */
function buildRosterPreviewStubForBirdKey(birdKey){
  const bd=BIRDS[birdKey];
  if(!bd) return null;
  return{
    birdKey,
    name: bd.name,
    portraitKey: bd.portraitKey||birdKey,
    size: bd.size||'medium',
    class: bd.class,
    stats: {...bd.stats},
    abilities: (bd.startAbilities||[]).map(id=>({id, level:1})),
    energyBonus: 0,
    firstAttackFree: false,
    firstSpellFree: false,
    augFirstSpellCostDown: 0,
    mutArcOverload: false,
    familyEvolutionState: null,
  };
}
function rosterPreviewSlotTag(birdKey, stub, ab, idx){
  if(!stub||!usesFamilySkillEvolution(stub)) return ['CORE','LINE 2','LINE 3','LINE 4'][idx]||'SKILL';
  const slots=getSkillSlots(stub).slice().sort((a,b)=>(a.slotIndex||0)-(b.slotIndex||0));
  const slot=slots.find(s=>Number.isFinite(ab?.slotIndex)&&s.slotIndex===ab.slotIndex)||slots[idx];
  const fam=slot?getSkillSlotFamilyDef(slot, birdKey):null;
  if(fam?.displayName) return String(fam.displayName).toUpperCase();
  return ['CORE','LINE 2','LINE 3','LINE 4'][idx]||'SKILL';
}
function materializeRosterPreviewKit(birdKey){
  const out={abilities:[], energyMax:0, stats:null, slotTags:[]};
  const stub=buildRosterPreviewStubForBirdKey(birdKey);
  if(!stub) return out;
  const prev=G.player;
  try{
    G.player=stub;
    stub.energyMax=computePlayerMaxEnergy();
    ensureFamilyEvolutionState(stub);
    if(typeof applyBirdCardProgression==='function') applyBirdCardProgression(stub);
    out.abilities=Array.isArray(stub.abilities)?stub.abilities.slice():[];
    out.energyMax=Math.max(0, Number(stub.energyMax)||computePlayerMaxEnergy());
    out.stats=stub.stats?{...stub.stats}:{};
    out.slotTags=out.abilities.map((ab, i)=>rosterPreviewSlotTag(birdKey, stub, ab, i));
  }finally{
    G.player=prev;
  }
  return out;
}
// Stubs kept so any call sites or wrapper hooks don't throw
function openRosterChampionModal(){}
function closeRosterChampionModal(){}
globalThis.openRosterChampionModal=openRosterChampionModal;
globalThis.closeRosterChampionModal=closeRosterChampionModal;

function _setSfselEmptyState(show){
  const el=document.getElementById('sfsel-detail-empty');
  if(!el) return;
  el.classList.toggle('sfsel__detail-empty--hidden', !show);
}

function updateAscentPanel(key) {
  const panel = document.getElementById('ascent-panel');
  if(!panel){
    syncSelectTakeFlightButton();
    return;
  }
  const bird = BIRDS[key];
  if(!bird){
    G.selected=null;
    try{ const u=ensureUIState(); u.expandedBird=null; }catch(_){}
    panel.classList.add('is-empty');
    panel.classList.remove('is-filled');
    panel.innerHTML='<div class="ascent-empty">Select a bird from the roster.</div>';
    _setSfselEmptyState(true);
    syncSelectTakeFlightButton();
    renderPassiveBadge();
    return;
  }

  try{
    if(!bird.stats||typeof bird.stats!=='object'){
      throw new Error('Bird stats missing for '+key);
    }

    G.selected = key;

    const cls = classToRoleId(bird.class);
    const sizeClass = getUISizeClass(bird, 'panel');
    const classLabel=idToClassLabel(cls);
    const sizeLabel=SIZE_LABELS[bird.size||'medium']||bird.size;
    const kit=materializeRosterPreviewKit(key);
    const dispStats=kit.stats&&Object.keys(kit.stats).length?kit.stats:bird.stats;
    const maxEn=kit.energyMax>0?kit.energyMax:getEnergyProfile(normalizeBirdSizeForEnergy(bird.size||'medium')).maxEN;
    const startEnShow=getEnergyProfile(normalizeBirdSizeForEnergy(bird.size||'medium')).startEN;
    const cc=dispStats.critChance||5;
    const cd=Number.isFinite(dispStats.critMult)?Number(dispStats.critMult):1.5;
    const roleSummary={
      striker:'Fast combo attacker',
      bruiser:'Heavy bruiser with hit pressure',
      tank:'Defensive frontliner',
      trickster:'Debuff-focused trickster',
      predator:'Execute-focused predator',
      singer:'Song-based controller',
    }[cls]||'Adaptive bird';

    const startAbilityDetails=(kit.abilities.length?kit.abilities:(bird.startAbilities||[]).map(id=>({id,level:1}))).map((ab,idx)=>{
      const id=typeof ab==='string'?ab:(ab&&ab.id);
      const t=getAbilityTemplateForUI(ab)||getAbilityTemplateForUI({id,level:1})||{};
      const en=Number.isFinite(ab?.energyCost)?ab.energyCost:(Array.isArray(t.energyByLevel)?(t.energyByLevel[0]??t.energyCost??0):(t.energyCost??0));
      const type=String(t.btnType||t.type||ab?.btnType||ab?.type||'utility').toUpperCase();
      const slotTag=escapeHtmlRoster((kit.slotTags&&kit.slotTags[idx])||(['CORE','LINE 2','LINE 3','LINE 4'][idx]||'SKILL'));
      const short=rosterAbilityBlurb(t);
      const nm=escapeHtmlRoster(t.name||ab?.name||id);
      return `<div class="ascent-ability-card"><div class="ascent-ability-top"><span class="ascent-ability-name">${nm}</span><span class="ascent-ability-en">${en} EN</span></div><div class="ascent-ability-tags">${slotTag} · ${type}</div><div class="ascent-ability-desc">${short}</div></div>`;
    }).join('');

    const statsStrip=`
      <div class="ascent-stats-strip">
        <span class="ascent-stat-chip"><abbr title="Hit Points">HP</abbr> <strong>${dispStats.hp}</strong></span>
        <span class="ascent-stat-chip"><abbr title="Attack">ATK</abbr> <strong>${dispStats.atk}</strong></span>
        <span class="ascent-stat-chip"><abbr title="Defense">DEF</abbr> <strong>${dispStats.def}</strong></span>
        <span class="ascent-stat-chip"><abbr title="Speed">SPD</abbr> <strong>${dispStats.spd}</strong></span>
        <span class="ascent-stat-chip"><abbr title="Accuracy">ACC</abbr> <strong>${dispStats.acc}%</strong></span>
        <span class="ascent-stat-chip">MATK <strong>${dispStats.matk||0}</strong></span>
        <span class="ascent-stat-chip">MDEF <strong>${dispStats.mdef||0}</strong></span>
        <span class="ascent-stat-chip">CC <strong>${cc}%</strong></span>
        <span class="ascent-stat-chip">CD <strong>${cd.toFixed(1)}×</strong></span>
        <span class="ascent-stat-chip"><abbr title="Battle start / max momentum (EN)">EN</abbr> <strong>${startEnShow}/${maxEn}</strong></span>
      </div>`;

    const passiveInfo=getBirdPassiveInfo(key);
    const passiveName=escapeHtmlRoster(passiveInfo?.name||bird.passive?.name||'—');
    const passiveDesc=escapeHtmlRoster(passiveInfo?.desc||passiveInfo?.effect||bird.passive?.desc||'No passive listed.');
    const cardTier=typeof getBirdCardTier==='function'?getBirdCardTier(key):'grey';
    const cardStars=typeof getBirdCardStars==='function'?getBirdCardStars(key):0;
    const tierPack=Avian?.data?.birdCardTiers;
    const tierLabel=escapeHtmlRoster(tierPack?.TIER_LABELS?.[cardTier]||cardTier);
    const tierCss=tierPack?.TIER_CSS?.[cardTier]||'tier-grey';
    const maxStars=tierPack?.STARS_PER_TIER||5;
    const starsHtml=renderBirdCardStarsHtml(cardStars, maxStars);
    const rarityMeta=getBirdSpeciesRarityMeta(key);
    const rarityLabel=escapeHtmlRoster(rarityMeta.label);
    const progress=typeof getBirdCardProgress==='function'?getBirdCardProgress(key):null;
    const preview=progress?.preview||null;
    const speciesFeathers=typeof getSpeciesFeathers==='function'?getSpeciesFeathers(key):0;
    const mutationCost=progress?.cost??(typeof getBirdCardMutationCost==='function'?getBirdCardMutationCost(cardTier):0);
    const ownsCard=typeof ownsBirdCard==='function'?ownsBirdCard(key):true;
    const previewTier=preview?(preview.isTierUp?preview.tierAfter:cardTier):cardTier;
    const previewStars=preview?(preview.isTierUp?preview.starsAfter:(preview.starsAfter??cardStars+1)):cardStars;
    const nextPassivePreview=progress?.canUpgrade&&typeof formatPassiveEffectForTier==='function'
      ? escapeHtmlRoster(formatPassiveEffectForTier(key, previewTier, previewStars))
      : '';
    const cardHint=!ownsCard
      ? '<p class="ascent-card-hint">No card — hatch at <strong>The Hatchery</strong>.</p>'
      : '';
    const mutateBtn=typeof renderBirdCardUpgradeHtml==='function'
      ? renderBirdCardUpgradeHtml(key, { layout: 'panel' })
      : '';
    const classPerkInfo=getBirdAuthoredClassPerk(key);
    const classPerkName=escapeHtmlRoster(classPerkInfo?.name||'—');
    const classPerkDesc=escapeHtmlRoster(classPerkInfo?.effect||'No class perk listed.');

    panel.innerHTML = `
      <div class="ascent-strip ascent-strip--filled ascent-strip--${tierCss}">
        <div class="ascent-strip-portrait-wrap" aria-hidden="true"><div class="ascent-panel-portrait">${renderBirdIconHTML(key, sizeClass, false)}</div></div>
        <div class="ascent-strip-body">
          <div class="ascent-strip-title-row">
            <span class="ascent-panel-name">${escapeHtmlRoster(bird.name)}</span>
            <span class="class-badge class-${cls}">${escapeHtmlRoster(classLabel.toUpperCase())}</span>
            <span class="bird-size-chip">${escapeHtmlRoster(sizeLabel)}</span>
            <span class="bird-card-tier-badge ${tierCss}">${tierLabel}</span>
            <span class="bird-card-rarity-badge ${rarityMeta.css}">${rarityLabel} species</span>
            <span class="ascent-strip-tagline">${escapeHtmlRoster(bird.tagline||'')}</span>
          </div>
          ${cardHint}
          <div class="ascent-card-progress">
            <span class="ascent-card-tier">Card tier: <strong class="${tierCss}">${tierLabel}</strong></span>
            <span class="ascent-card-stars-wrap">${starsHtml}</span>
            <span class="ascent-card-rarity">Rarity: <strong class="${rarityMeta.css}">${rarityLabel}</strong></span>
            ${ownsCard?`<span class="ascent-card-feathers">Species Feathers: <strong>${speciesFeathers}</strong>${progress?.canUpgrade?` / ${mutationCost}`:''}</span>`:''}
            ${mutateBtn}
          </div>
          <div class="ascent-strip-hscroll" tabindex="0" role="region" aria-label="Stats, passive, and skills">
            <div class="ascent-hblock ascent-hblock-stats">
              <div class="ascent-hblock-label">Stats</div>
              ${statsStrip}
            </div>
            <div class="ascent-hblock ascent-hblock-passive">
              <div class="ascent-hblock-label">Passive</div>
              <div class="ascent-panel-passive ascent-panel-passive--inline"><strong>${passiveName}:</strong> ${passiveDesc}</div>
              ${nextPassivePreview?`<div class="ascent-passive-next"><span class="ascent-hblock-label">After next upgrade</span> ${nextPassivePreview}</div>`:''}
            </div>
            <div class="ascent-hblock ascent-hblock-class-perk">
              <div class="ascent-hblock-label">Class perk</div>
              <div class="ascent-panel-passive ascent-panel-passive--inline"><strong>${classPerkName}:</strong> ${classPerkDesc}</div>
            </div>
            <div class="ascent-hblock ascent-hblock-abilities">
              <div class="ascent-hblock-label">Starting skills</div>
              <div class="ascent-abilities-row">${startAbilityDetails}</div>
            </div>
            <div class="ascent-hblock ascent-hblock-playstyle">
              <div class="ascent-hblock-label">Playstyle</div>
              <div class="showcase-summary">${escapeHtmlRoster(roleSummary)}</div>
            </div>
          </div>
        </div>
      </div>`;
    panel.classList.remove('is-empty');
    panel.classList.add('is-filled');
    _setSfselEmptyState(false);
    renderPassiveBadge();
  }catch(err){
    console.error('updateAscentPanel failed:',key,err);
    panel.classList.add('is-empty');
    panel.classList.remove('is-filled');
    panel.innerHTML='<div class="ascent-empty">Could not load bird profile.</div>';
    G.selected=null;
    _setSfselEmptyState(true);
    renderPassiveBadge();
  }
  syncSelectTakeFlightButton();
}




function startSelectedBird(key){
  if(key && BIRDS[key]) G.selected = key;
  return startGame();
}

function beginRun(){ return startGame(); }

const COMBAT_ITEM_CATALOG = Object.freeze({
  freshWater: Object.freeze({ itemKey:'freshWater', shopId:'shop_item_fresh_water', tier:'grey', icon:'💧', name:'Fresh Water', healPct:0.25, energyCost:1, maxHold:3, costOverride:12, combatHint:'Restore 25% of your max HP. Costs 1 energy. You can use one heal item per turn.' }),
  sugarWater: Object.freeze({ itemKey:'sugarWater', shopId:'shop_item_sugar_water', tier:'green', icon:'🌾', name:'Bird Seed', healPct:0.50, energyCost:2, maxHold:2, costOverride:22, combatHint:'Restore 50% of your max HP. Costs 2 energy. You can use one heal item per turn.' }),
  honeyWater: Object.freeze({ itemKey:'honeyWater', shopId:'shop_item_honey_water', tier:'blue', icon:'🍯', name:'Honey Water', healPct:0.75, energyCost:3, maxHold:1, costOverride:32, combatHint:'Restore 75% of your max HP. Costs 3 energy. You can use one heal item per turn.' }),
});

function getCombatItemMaxHold(itemKey){
  const def=COMBAT_ITEM_CATALOG[itemKey];
  if(!def) return 0;
  const meta=typeof getFortuneMeta==='function'?getFortuneMeta():null;
  const bonus=meta?.combatItemCapBonus?.[itemKey]||0;
  return def.maxHold+Math.max(0, Math.floor(Number(bonus)||0));
}

function playerIsKnightClass(player){
  if(!player) return false;
  return resolveFinalClass(player.class, player.birdKey)==='knight';
}

function createDefaultCombatItems(){
  return { freshWater:getCombatItemMaxHold('freshWater'), sugarWater:0, honeyWater:0 };
}

function ensureCombatItems(player){
  if(!player) return null;
  if(!player.combatItems || typeof player.combatItems!=='object') player.combatItems=createDefaultCombatItems();
  for(const key of Object.keys(COMBAT_ITEM_CATALOG)){
    const maxHold=getCombatItemMaxHold(key);
    player.combatItems[key]=Math.max(0, Math.min(maxHold, Math.floor(Number(player.combatItems[key])||0)));
  }
  return player.combatItems;
}

function getCombatItemCount(player, itemKey){
  ensureCombatItems(player);
  return Math.max(0, Math.floor(Number(player?.combatItems?.[itemKey])||0));
}

function canAddCombatItem(player, itemKey, n=1){
  const def=COMBAT_ITEM_CATALOG[itemKey];
  if(!def) return false;
  return getCombatItemCount(player, itemKey)+Math.max(1,Math.floor(Number(n)||1))<=getCombatItemMaxHold(itemKey);
}

function addCombatItem(player, itemKey, n=1){
  const def=COMBAT_ITEM_CATALOG[itemKey];
  if(!def || !player) return 0;
  ensureCombatItems(player);
  const add=Math.max(1,Math.floor(Number(n)||1));
  const room=getCombatItemMaxHold(itemKey)-getCombatItemCount(player, itemKey);
  const applied=Math.min(add, Math.max(0, room));
  if(applied>0) player.combatItems[itemKey]+=applied;
  return applied;
}

function buildCombatItemShopOffer(def){
  const pct=Math.round((def.healPct||0)*100);
  const maxHold=getCombatItemMaxHold(def.itemKey);
  return {
    id:def.shopId,
    tier:def.tier,
    icon:def.icon,
    name:def.name,
    desc:`Battle item · Hold ${maxHold} · Heal ${pct}% max HP (${def.energyCost} EN in combat)`,
    costOverride:def.costOverride,
    itemKey:def.itemKey,
    isCombatItem:true,
    shopCategory:'items',
    apply(p){
      const added=addCombatItem(p, def.itemKey, 1);
      if(added>0 && typeof logMsg==='function') logMsg(`+1 ${def.name} (${getCombatItemCount(p, def.itemKey)}/${getCombatItemMaxHold(def.itemKey)})`,'exp-gain');
    },
  };
}

// ============================================================
//  GAME FLOW
// ============================================================
function startGame() {
  if(!G.selected) return;
  primeAudioIfNeeded();
  beginThemeBgmFadeOutForRunStart();
  G.endlessMode = (ensureUIState().gameMode==='endless');
  if (G.endlessMode) {
    try {
      localStorage.removeItem(_OW_STATE_KEY);
      localStorage.removeItem(_OW_NAV_KEY);
    } catch(_) {}
  }
  G.difficulty = G._selectedDifficulty || 'juvenile';
  const bd = BIRDS[G.selected];
  G.collectedRewards=[];
  G.player = {
    name: bd.name, portraitKey: bd.portraitKey, birdKey: G.selected,
    size: bd.size||'medium',
    stats: {...bd.stats},
    abilities: [...bd.startAbilities,...(bd.extraAbilities||[])].map(id=>({
      ...ABILITY_TEMPLATES[id],
      level: 1,
      ailmentIds: [],
      energyCost: Number.isFinite(ABILITY_TEMPLATES[id]?.energyCost)?ABILITY_TEMPLATES[id].energyCost:0,
    })),
    exp: 0, birdLevel: 1,
    goldCritMult: 1.5,
    mainAttackId: bd.mainAttackId||null,
    immuneParalyze: bd.passive?.immuneParalyze||false,
    poisonCap: 5,
    endlessRewards: [],
    critChance: bd.stats.critChance||5,
    passive: bd.passive||null,
    cardDodge: 0,
    energyMax: 0,
    energy: 0,
    energyRegen: 0,
    passiveEvolution:{tier:0,choices:{},pathHistory:[]},
    mutationInventory: [],
    equippedMutations: null,
    abilityInventory: [],
    mutatedFeatherCount: 0,
    combatItems: createDefaultCombatItems(),
  };
  normalizeCombatStats(G.player.stats);
  if(typeof Avian?.mutations?.ensurePlayerMutationState==='function') Avian.mutations.ensurePlayerMutationState(G.player);
  ensureFamilyEvolutionState(G.player);
  syncPlayerAbilitiesFromSkillSlots(G.player);
  G.player.class = bd.class;
  G.player.size = bd.size||'medium';
  if(typeof applyOwnedFortuneArtifacts==='function') applyOwnedFortuneArtifacts(G.player);
  G.player.energyMax = computePlayerMaxEnergy();
  G.player.energy = computePlayerStartEnergy(G.player);
  G.player.energyRegen = computePlayerEnergyRegen(G.player);
  codexMark('birds', G.player.birdKey, 'seen');
  (G.player.abilities||[]).forEach(a=>codexMark('abilities',a.id,'seen'));
  ensureMainAttackAndLoadoutRules();
  removeMimicEverywhere();
  normalizeAbilityCooldownsForPlayer(G.player);
  enforceAbilityCosts(G.player);
  initStatLedgerForNewRun(G.player);
  if(typeof applyBirdCardProgression==='function') applyBirdCardProgression(G.player);
  G.stage = 1;
  G.endlessBattle = 0;
  G.autoQueuedAbilityId=null;
  G._breakClampStreak=0;
  G.bossKills = 0;
  G.abilityCooldowns={};
  G._pendingLevelUpChoices=0;
  G._pendingSkillEvolutionChoices=0;
  G.runCrits = 0; G.runBuffs = 0; G.runDebuffs = 0;
  G.runUpgradesPurchased = new Set();
  G.codex = {abilities:{},enemies:{},birds:{},artifacts:{},statuses:{}};
  G.shinyObjects = 0;
  G.runClassPerks = [];
  G.classPerks = {};
  G._classPerkChoicesGranted = 0;
  G._overworldProgress = normalizeOverworldProgress({completedStage:0,currentNodeId:0,lastSummary:null}, 1);
  clearOverworldPendingBattle();
  saveRun();
  G.phase='PLAYER';
  const runStartEvt = {birdKey:G.player.birdKey, difficulty:G.difficulty, endless:!!G.endlessMode};
  AvianEvents.emit('run:start', runStartEvt);
  runModuleHook('onRunStart', runStartEvt);
  // Launch the overworld map between stages (endless mode goes straight to battle)
  if (!G.endlessMode) {
    try {
      const mode = typeof globalThis.getCustomOverworldMode === 'function'
        ? globalThis.getCustomOverworldMode() : null;
      if (mode === 'playtest' && typeof globalThis.clearCustomOverworldMode === 'function') {
        globalThis.clearCustomOverworldMode();
      }
      localStorage.setItem(_OW_STATE_KEY, JSON.stringify({nodeId:0, birdKey:G.selected}));
      localStorage.removeItem(_OW_NAV_KEY);
      window.location.href = 'blackstone_overworld_new.html';
      return;
    } catch(_) {}
  }
  loadStage();
}

// Build endless-mode enemy from enemy roster (scaling in loadStage).
function makeEndlessEnemy(stage) {
  const st=Math.max(1,Number(stage)||1);
  const endlessBattle=getEndlessEffectiveBattleNumber(st);
  const isBoss=endlessBattle>0 ? (endlessBattle%ENDLESS_BOSS_CADENCE===0) : (st%10===0);
  const playerLv=Math.max(1,Math.floor(G.player?.birdLevel||1));
  const rosterId=typeof pickEndlessRosterEnemyId==='function'
    ? pickEndlessRosterEnemyId(st,isBoss,playerLv)
    : 'EN-SPARR-HESQ-L01';
  const bossTitle=isBoss
    ? (st>20?'💀 Endless Titan':bossTitleForStageMilestone(st))
    : '';
  const ed=typeof buildEnemyFromRosterId==='function'
    ? buildEnemyFromRosterId(rosterId,{isBoss,bossTitle})
    : null;
  if(ed&&isBoss&&st>20) ed.name='Corrupted '+ed.name;
  return ed;
}

/** Stats that may be temporarily modified during combat — snapshotted at battle start and restored when combat ends. */
const BATTLE_TEMP_PLAYER_STAT_KEYS = ['atk','def','spd','dodge','mdef','matk','critChance'];

function captureBattleTempPlayerStats(){
  if(!G.player?.stats) return;
  const snap = {};
  for(const k of BATTLE_TEMP_PLAYER_STAT_KEYS){
    const v = G.player.stats[k];
    snap[k] = (typeof v === 'number' && Number.isFinite(v)) ? v : 0;
  }
  G._battleTempPlayerStatsSnapshot = snap;
}

function restoreBattleTempPlayerStats(){
  const snap = G._battleTempPlayerStatsSnapshot;
  if(!snap || !G.player?.stats){
    G._battleTempPlayerStatsSnapshot = null;
    return;
  }
  for(const k of BATTLE_TEMP_PLAYER_STAT_KEYS){
    if(Object.prototype.hasOwnProperty.call(snap, k)) G.player.stats[k] = snap[k];
  }
  G._battleTempPlayerStatsSnapshot = null;
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function'){
    Avian.mutations.reapplyPlayerStatsFromSources(G.player);
  }
}

function prepareEnemyCombatLoadout(enemy){
  if(!enemy) return;
  if(typeof ensureFamilyEvolutionState==='function') ensureFamilyEvolutionState(enemy);
  if(typeof syncPlayerAbilitiesFromSkillSlots==='function') syncPlayerAbilitiesFromSkillSlots(enemy);
  if(enemy.stats) normalizeCombatStats(enemy.stats);
}
globalThis.prepareEnemyCombatLoadout=prepareEnemyCombatLoadout;

function preparePlayerCombatLoadout(player){
  if(!player) return;
  if(typeof applyOwnedFortuneArtifacts==='function') applyOwnedFortuneArtifacts(player);
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function'){
    Avian.mutations.reapplyPlayerStatsFromSources(player);
  }
  ensureFamilyEvolutionState(player);
  syncPlayerAbilitiesFromSkillSlots(player);
  ensureMainAttackAndLoadoutRules();
  enforceAbilityCosts(player);
  const abs=player.abilities||[];
  if(abs.length<1){
    console.warn('[combat] empty abilities after loadout sync', player.birdKey);
    if(typeof logMsg==='function') logMsg('⚠ No abilities equipped — recovering turn.','system');
    if(typeof failsafeAdvance==='function') failsafeAdvance('empty abilities');
  }
}

function normalizeBattleTurnState(){
  G.animLock=false;
  G.actionBusy=false;
  G.actionQueue=[];
  if(G.turnPhase===TURN.RESOLVING){
    G.turnPhase=G.turn==='enemy'?TURN.ENEMY:TURN.PLAYER;
    G.phase=G.turn==='enemy'?'ENEMY':'PLAYER';
  }
  if(G.player&&G.enemy&&!G.battleOver){
    if(G.turn==='player'){
      G.phase='PLAYER';
      G.turnPhase=TURN.PLAYER;
    }else if(G.turn==='enemy'){
      G.phase='ENEMY';
      G.turnPhase=TURN.ENEMY;
    }else if(G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER){
      G.turn='player';
    }else if(G.phase==='ENEMY'&&G.turnPhase===TURN.ENEMY){
      G.turn='enemy';
    }
  }
  syncCombatTurnFlags();
}

function resetForNewBattle(){
  G.playerStatus={};
  G.enemyStatus={};
  G.crowDefendCooldown=0; G.blackbirdAttackCount=0;
  G.swoopCooldown=0; G.hummingbirdDashCooldown=0; G.peregrineDiveCooldown=0; G.snowyOwlDiveCooldown=0; G.robinDartCooldown=0; G.bowerbirdLureCooldown=0; G.intimidateCooldown=0; G.fruitCooldown=0;
  G.stickLanceStage=0; G.flybyCharged=false; G.flybyUsed=false;
  G.rockDropPending=false; G.humTurns=0; G.humMissBonus=0;
  G.chargeUpActive=false; G.warcryActive=false; G.warcryATK=0;
  G.battleHymnActive=false; G.battleHymnDEF=0; G.battleHymnACC=0;
  G.enemyRageActive=false; G.enemyTurnCount=0;
  G.serratedStacks=0; G.sitAndWaitActive=false;
  G.tookieActive=false; G.tookieMiss=0;
  G.tauntActive=false; G.regenTurns=0; G.regenPct=0;
  G.activeDodgeBuffs={}; G.activeAccBuffs={};
  G._roostData=null;
  G.animLock=false; G.battleOver=false;
  G.actionQueue=[]; G.actionBusy=false;
  G._goldReplaceMode=false;
  G._perkIronCoreUsed=false;
  G._perkFirstVsFullUsed=false;
  G._perkUtilityRefundUsed=false;
  G.turnCount=0;
  G._playerEnergyTurnIndex=0;
  G._enemyEnergyTurnIndex=0;
  G._incomingAttackKind=null;
  delete G._pendingStrikeActionMods;
  G._firstAttackUsed=false;
  G._firstSpellUsed=false;
  G._spellCastCount=0;
  if(G.player){
    G.player._mimicStored=null;
    G.player._firstHitReducedUsed=false;
    G.player._lowHpSpdApplied=false;
    G.player._lowHpDefApplied=false;
    G.player._survivorMoltUsed=false;
    G.player._mimicUsed=false;
    G.player._mimicAbility=null;
    G.player._blueJayHitLastTurn=false;
    G.player._blueJayRecentHit=false;
    G.player._shoebillHadUtilityPriorTurn=false;
    G.player._crowMurderMindUsed=false;
    G.player._sheetNextCrit=0;
    G.player._hbUtilityFirst=true;
    G.player._macawLastTurnFam='';
    G.player._emuDustUsed=false;
    G.player.energyMax=computePlayerMaxEnergy();
    G.player.energy=computePlayerStartEnergy(G.player);
    G.player.energyRegen=computePlayerEnergyRegen(G.player);
    delete G.player._magpieSpdLoan;
    delete G.player._ostrichSpdLoan;
    delete G.player._albatrossSpdLoan;
    delete G.player._ravenGrimSpdLoan;
  }
}

function normalizeEnemyNameKey(name){
  return String(name||'').toLowerCase().replace(/[^a-z]/g,'');
}

/** Story / endless tier band 1–5 from stage depth (matches loadStage). */
function storyTierFromStage(stage){
  const s=Math.max(1,Number(stage)||1);
  if(s<=5) return 1;
  if(s<=10) return 2;
  if(s<=15) return 3;
  if(s<=19) return 4;
  return 5;
}

/** Legacy shim: build draft from roster id or birdKey token. */
function buildEdFromBirdEnemyTemplate(src, opts={}){
  if(!src) return null;
  if(typeof src==='string'){
    if(typeof isRosterEnemyId==='function'&&isRosterEnemyId(src)&&typeof buildEnemyFromRosterId==='function'){
      return buildEnemyFromRosterId(src,opts);
    }
    return buildOwEnemyDraftFromBirdKey(src, G.stage||1);
  }
  if(src.id&&typeof buildEnemyFromRosterId==='function') return buildEnemyFromRosterId(src.id,opts);
  if(src.birdKey) return buildOwEnemyDraftFromBirdKey(src.birdKey, G.stage||1);
  return null;
}

function pickRandomBirdEnemyDraftForStage(stageNumber, opts={}){
  const ids=typeof pickStoryEncounterEnemyIds==='function'
    ? pickStoryEncounterEnemyIds(stageNumber, G.player?.birdKey||'', 1)
    : ['EN-SPARR-HESQ-L01'];
  return buildEdFromBirdEnemyTemplate(ids[0], opts);
}

function pickRandomBirdEnemyDraft(tier, opts={}){
  void tier;
  const rosterId=typeof pickEndlessRosterEnemyId==='function'
    ? pickEndlessRosterEnemyId(G.stage||1, !!opts.isBoss, Math.max(1, Math.floor(G.player?.birdLevel||1)))
    : 'EN-SPARR-HESQ-L01';
  return buildEdFromBirdEnemyTemplate(rosterId, opts);
}

function bossTitleForStageMilestone(stage){
  const idx=Math.max(0,Math.floor(Number(stage)/10)-1);
  const titles=['⚡ Stage Boss','🌩 Stage Boss','🌀 Stage Boss','👑 Stage Boss'];
  return titles[Math.min(idx,titles.length-1)];
}

/** After battle DOM is shown, wait for layout then run the first enemy turn (speed initiative). */
const OPENING_ENEMY_DELAY_MS = 920;
function scheduleOpeningEnemyTurn(){
  const tick=()=>{
    try{
      primeAudioIfNeeded();
      const scr=document.getElementById('screen-battle');
      if(scr&&typeof scr.scrollIntoView==='function'){
        try{ scr.scrollIntoView({block:'nearest',behavior:'smooth',inline:'nearest'}); }
        catch(_){ try{ scr.scrollIntoView(false); }catch(__){} }
      }
    }catch(_){}
    const nm=G.enemy?.name?String(G.enemy.name):'';
    showBattleCaption(nm?`${nm} strikes first!`:'Enemy strikes first!',780);
    setTimeout(()=>{
      enemyTurn().catch(err=>{
        console.error('[combat] opening enemyTurn failed', err);
        G.animLock=false;
        if(typeof lockActionUI==='function') lockActionUI(false);
        if(typeof normalizeBattleTurnState==='function') normalizeBattleTurnState();
        if(G.player?.stats?.hp>0 && G.enemy?.stats?.hp>0 && typeof afterEnemyTurn==='function') afterEnemyTurn();
      });
    },OPENING_ENEMY_DELAY_MS);
  };
  if(typeof requestAnimationFrame==='function') requestAnimationFrame(()=>requestAnimationFrame(tick));
  else setTimeout(tick,0);
}

function loadStage() {
  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:loadStage:entry',message:'loadStage start',data:{encounterStage:typeof getEncounterStage==='function'?getEncounterStage():null,owEnemies:G._owStageEnemies,owIdx:G._owEnemyIndex},timestamp:Date.now(),hypothesisId:'H2,H3'})}).catch(()=>{});
  // #endregion
  // Overworld shop: open the shop instead of a battle.
  if (G._pendingOverworldShop) {
    G._pendingOverworldShop = false;
    showStorkShop('grey');
    return;
  }
  G.autoQueuedAbilityId=null;
  G._breakClampStreak=0;
  G.abilityCooldowns=G.abilityCooldowns||{};
  const encounterStage = getEncounterStage();
  syncStoryEncounterBirdQueue(encounterStage);
  const stageSequenceLabel = (!G.endlessMode && (G._owEnemyCount||0) > 1)
    ? ` · Battle ${Math.min((G._owEnemyIndex||0)+1, G._owEnemyCount)} of ${G._owEnemyCount}`
    : '';
  ensureOwEncounterMaterialized(encounterStage);
  let ed;
  let skipEnemyScalarMerge = false;
  // Overworld stage: use pre-materialized snapshot so preview matches battle rolls
  if (!G.endlessMode && G._owStageEnemies?.length > 0) {
    const idx = G._owEnemyIndex || 0;
    const mat = G._owEncounterMaterialized?.[idx];
    if(mat){
      ed = JSON.parse(JSON.stringify(mat));
      skipEnemyScalarMerge = true;
    } else {
      const bk = G._owStageEnemies[idx];
      ed = buildOwEnemyDraftFromBirdKey(bk, encounterStage);
    }
  }
  const diffMult = DIFFICULTIES[G.difficulty||'juvenile'].mult;

  if (G.endlessMode && encounterStage > ENDLESS_STORY_END_STAGE) {
    G.endlessBattle = getEndlessEffectiveBattleNumber(encounterStage);
    ed = makeEndlessEnemy(encounterStage);
  } else if (!ed) {
    const stage = encounterStage;
    if (stage === STORY_DUKE_STAGE && !G.endlessMode) {
      ed = makeDukeBlakiston();
    } else if (stage === STORY_MILESTONE_BOSS_STAGE && !G.endlessMode) {
      const bossTok = G._owStageEnemies?.[0]
        || (typeof pickStoryEncounterEnemyIds === 'function'
          ? pickStoryEncounterEnemyIds(stage, G.player?.birdKey||'', 1)[0]
          : null);
      ed = buildOwEnemyDraftFromBirdKey(bossTok||'harpy', stage);
      if(ed){
        ed.isBoss=true;
        ed.bossTitle=bossTitleForStageMilestone(stage);
      }
    } else if (!G.endlessMode) {
      const bk = G._owStageEnemies?.[G._owEnemyIndex || 0];
      if (bk) ed = buildOwEnemyDraftFromBirdKey(bk, stage);
    } else {
      ed = pickRandomBirdEnemyDraftForStage(stage, { isBoss: false });
    }
  }
  if(ed && !skipEnemyScalarMerge){
    mergeScaledStatsIntoEnemy(ed, encounterStage);
  }
  G.enemy = ed;
  // #region agent log
  fetch('http://127.0.0.1:7940/ingest/a2f9b3c2-6614-4231-b7d9-0c870302a25c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5e515f'},body:JSON.stringify({sessionId:'5e515f',location:'game.js:loadStage:enemySet',message:'G.enemy assigned',data:{hasEnemy:!!G.enemy,enemyId:G.enemy?.id||G.enemy?.name||null,hasStats:!!G.enemy?.stats,birdKey:G._owStageEnemies?.[G._owEnemyIndex||0]||null},timestamp:Date.now(),hypothesisId:'H2,H5'})}).catch(()=>{});
  // #endregion
  if (G.enemy && G.enemy.stats) {
    const base = G.enemy._statBaseBeforeMutations || G.enemy.stats;
    G.enemy._battleStatBase = {
      atk: Number(base.atk) || 0,
      matk: Number(base.matk) || 0,
      def: Number(base.def) || 0,
      mdef: Number(base.mdef) || 0,
      dodge: Number(base.dodge) || 0,
      acc: Number(base.acc) || 0,
      spd: Number(base.spd) || 0,
    };
  }
  const stageEvt = {stage:encounterStage, enemyId:G.enemy.id||G.enemy.name, isBoss:!!G.enemy.isBoss};
  AvianEvents.emit('stage:loaded', stageEvt);
  runModuleHook('onStageLoaded', stageEvt);
  if(!G.enemy.aiType) G.enemy.aiType=mapAiStyleToType(G.enemy.aiStyle);
  if(!G.enemy.aiPersonality) G.enemy.aiPersonality=inferAIPersonalityFromStyle(G.enemy.aiStyle,G.enemy.name);
  codexMark('enemies', G.enemy.id||G.enemy.name, 'seen');
  enforceAbilityCosts(G.player);
  applyBiomeModifiers();
  // Remove stat bonuses before resetting flags (avoid accumulating across battles)
  resetForNewBattle();
  recomputeClassPerkEffects();
  // Reset Goose bruise accumulator per battle
  if(G.player._bruiseAcc!==undefined) G.player._bruiseAcc=0;
  // Reset battle stats
  resetBattleStats();
  // Clear any visual carry-overs from last battle
  document.getElementById('player-panel')?.classList.remove('player-danger');
  document.getElementById('enemy-panel')?.classList.remove('boss-phase-two');
  const pb=document.getElementById('boss-phase-banner');if(pb){pb.textContent='';pb.classList.remove('visible');}
  preparePlayerCombatLoadout(G.player);
  prepareEnemyCombatLoadout(G.enemy);
  // Bird passive hooks (onBattleStart) — after loadout so mutation/equipment stats are applied first
  const bd2=BIRDS[G.player.birdKey||'sparrow'];
  if(bd2&&bd2.passive&&bd2.passive.onBattleStart) bd2.passive.onBattleStart(G.player);
  if(typeof Avian?.passives?.onBattleStart==='function') Avian.passives.onBattleStart();
  if((G.player?.openingEnemyFear||0)>0){
    G.enemyStatus.feared=Math.max(G.enemyStatus.feared||0, G.player.openingEnemyFear);
  }
  if(G.player?.relTensionCoil && G.player.stats.hp<=Math.floor((G.player.stats.maxHp||1)*0.5)){
    G.playerStatus.tensionCoil={turns:1,pct:0.15};
  }
  captureBattleTempPlayerStats();
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterPrepareLoadout', 'after preparePlayerCombatLoadout', { abilityCount: G.player?.abilities?.length || 0, mainAttackId: G.player?.mainAttackId || null }, 'H5');
  // #endregion
  normalizeBattleTurnState();
  // Speed determines first turn
  const pSpd=G.player.stats.spd, eSpd=G.enemy.stats.spd;
  G.turn = pSpd >= eSpd ? 'player' : 'enemy';
  G.turnPhase = G.turn==='player'?TURN.PLAYER:TURN.ENEMY;
  G.phase = G.turn==='player' ? 'PLAYER' : 'ENEMY';
  if(G.turn==='player') startPlayerTurn(G.player);
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterStartPlayerTurn', 'after turn init', { turn: G.turn, playerEnergy: G.player?.energy, enemyHp: G.enemy?.stats?.hp }, 'H5');
  // #endregion
  G.enemyNextAction = planEnemyAction();
  showScreen('screen-battle');
  const _battleAccCfg=getAccessibilitySettings();
  applyCombatLayoutSettings(_battleAccCfg);
  applyCombatArrangement(_battleAccCfg);
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterShowScreen', 'battle screen shown', { activeScreen: document.querySelector('.screen.active')?.id || null }, 'H5');
  // #endregion
  const _battleLogEl=document.getElementById('battle-log'); if(_battleLogEl) _battleLogEl.innerHTML='';
  updateBattleArena();
  initBattleLogDrawer();
  updateStageProgress();
  if(G.player) ensureMainAttackAndLoadoutRules();
  refreshBattleUI();
  // #region agent log
  _agentDbgLog('game.js:loadStage:afterRefreshBattleUI', 'refreshBattleUI done', { actionsGrid: !!document.getElementById('actions-grid') }, 'H5');
  // #endregion
  if (G.enemy.isBoss) {
    const stageLabel = G.endlessMode && encounterStage > 20
      ? `Endless Battle ${G.endlessBattle}` : `Stage ${encounterStage}`;
    logMsg(`👑 ${G.enemy.bossTitle}: ${G.enemy.name} descends! [${stageLabel}${stageSequenceLabel}]`,'boss');
    logMsg(`Defeat them for a guaranteed Epic reward!`,'system');
    SFX.boss(); doScreenShake(true);
  } else {
    logMsg(`⚔ Stage ${encounterStage}${stageSequenceLabel}: ${G.enemy.name} appears!`,'system');
  }
  if (G.turn==='enemy') {
    logMsg(`⚡ ${G.enemy.name} (SPD ${G.enemy.stats.spd}) is faster — they strike first!`,'miss');
    scheduleOpeningEnemyTurn();
  }
  tryStartDukeBattleBgmIfNeeded();
  // #region agent log
  _agentDbgLog('game.js:loadStage:complete', 'loadStage complete', { turn: G.turn, battleOver: !!G.battleOver }, 'H5');
  // #endregion
}

function setSuppliesSubView(which){
  const ref = document.getElementById('supplies-view-reference');
  const rec = document.getElementById('supplies-view-records');
  const bRef = document.getElementById('supplies-nav-reference');
  const bRec = document.getElementById('supplies-nav-records');
  if(!ref || !rec) return;
  const isRef = which === 'reference';
  ref.classList.toggle('is-active', isRef);
  rec.classList.toggle('is-active', !isRef);
  if(bRef){
    bRef.classList.toggle('is-active', isRef);
    bRef.setAttribute('aria-selected', String(isRef));
  }
  if(bRec){
    bRec.classList.toggle('is-active', !isRef);
    bRec.setAttribute('aria-selected', String(!isRef));
  }
  if(!isRef){
    try{
      if(typeof renderRunHistory === 'function') renderRunHistory();
      if(typeof renderHighscoreBoard === 'function') renderHighscoreBoard();
    }catch(_){}
  }
}
globalThis.setSuppliesSubView = setSuppliesSubView;

function openSelectHubPanel(which){
  const allowed = {supplies:1,map:1,door:1,fortune:1,inventory:1,hatchery:1};
  if(!allowed[which]) return;
  const root = document.getElementById('select-hub-panels');
  const screenEl = document.getElementById('screen-select');
  if(!root || !screenEl) return;
  if(which === 'supplies') setSuppliesSubView('reference');
  if(which === 'fortune'){
    const msg=document.getElementById('fortune-shop-msg');
    if(msg) msg.textContent='';
    if(typeof renderFortuneShop==='function') renderFortuneShop();
    else if(typeof setFortuneSubView==='function') setFortuneSubView('trade');
  }
  if(which === 'hatchery'){
    if(typeof renderHatchery==='function') renderHatchery();
    else if(typeof syncFortuneBalances==='function') syncFortuneBalances();
  }
  if(which === 'inventory'){
    if(typeof renderFortuneInventory==='function') renderFortuneInventory();
    else if(typeof syncFortuneBalances==='function') syncFortuneBalances();
  }
  ['supplies','map','door','fortune','inventory','hatchery'].forEach(w=>{
    const p = document.getElementById('select-hub-'+w);
    if(!p) return;
    const on = w===which;
    p.classList.toggle('is-open', on);
    p.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
  root.classList.add('is-open');
  root.setAttribute('aria-hidden','false');
  screenEl.classList.add('select-hub-panel-active');
  const panel = document.getElementById('select-hub-'+which);
  if(panel) panel.scrollTop = 0;
  if(which==='door'){
    if(typeof syncSfselRunSummary==='function') syncSfselRunSummary();
    if(typeof syncSelectTakeFlightButton==='function') syncSelectTakeFlightButton();
  }
}
function closeSelectHubPanel(){
  try{ if(typeof closeRosterChampionModal==='function') closeRosterChampionModal(); }catch(_){}
  const root = document.getElementById('select-hub-panels');
  const screenEl = document.getElementById('screen-select');
  if(root){
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden','true');
  }
  screenEl?.classList.remove('select-hub-panel-active');
  ['supplies','map','door','fortune','inventory','hatchery'].forEach(w=>{
    const p = document.getElementById('select-hub-'+w);
    if(p){
      p.classList.remove('is-open');
      p.setAttribute('aria-hidden','true');
    }
  });
}
globalThis.openSelectHubPanel = openSelectHubPanel;
globalThis.closeSelectHubPanel = closeSelectHubPanel;

function takeFlightToSelect(){
  showScreen('screen-select');
  if(typeof initSelectionSafe==='function') initSelectionSafe();
  // Stay on the war-room splash; player opens "Begin Ascent" to reach the roster (avoids skipping the barn menu).
  requestAnimationFrame(()=>{
    try{ syncSelectTakeFlightButton(); }catch(_){}
  });
}
globalThis.takeFlightToSelect = takeFlightToSelect;
function scrollToSelectRoster(){
  openSelectHubPanel('door');
}
globalThis.scrollToSelectRoster = scrollToSelectRoster;

function showScreen(id) {
  const prev=(document.querySelector('.screen.active')||{}).id;
  closeSelectHubPanel();
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(prev==='screen-battle' && id!=='screen-battle') stopAllGameAudio();
  if(prev==='screen-gameover' && (id==='screen-select'||id==='screen-start')) stopAllGameAudio();
  if(id==='screen-stork-shop' || id==='screen-grove' || id==='screen-map-forge'){
    const el=document.getElementById(id);
    if(el){
      el.scrollTop=0;
      el.scrollIntoView({behavior:'auto', block:'start'});
    }
    document.documentElement.scrollTop=0;
    document.body.scrollTop=0;
    try{ window.scrollTo({top:0, behavior:'auto'}); }catch(_){ window.scrollTo(0,0); }
  }
  const evt={id};
  AvianEvents.emit('screen:change', evt);
  runModuleHook('onScreenChange', evt);
  syncThemeBgmPlaybackForScreen(id);
  if(id==='screen-battle'){
    const _accCfg=getAccessibilitySettings();
    applyCombatLayoutSettings(_accCfg);
    applyCombatArrangement(_accCfg);
  }
}
globalThis.showScreen = showScreen;

// ============================================================
//  UI
// ============================================================
function buildPlayerCombatStatHint(){
  const s=G.playerStatus||{};
  const parts=[];
  if(getWeakenStacks(s)>0){
    const st=getWeakenStacks(s);
    const turns=typeof s.weaken==='number'?s.weaken:(s.weaken?.turns||0);
    parts.push(`Weaken ×${st} (${turns}t, −${Math.round((1-getWeakenDamageMult(st))*100)}% dmg, −${getWeakenDodgePenalty(st)} dodge)`);
  }
  if((s.feared||0)>0) parts.push(`Fear ${s.feared}t (30% skip)`);
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
function getAvatar(who)     { return document.getElementById(`${who}-avatar`); }
function getAvatarWrap(who) { return document.getElementById(`${who}-avatar-wrap`); }
function getPanel(who)      { return document.getElementById(`${who}-panel`); }

function refreshBattleUI() {
  const p = G.player.stats;
  document.getElementById('player-name').textContent = G.player.name;
  document.getElementById('player-avatar').innerHTML = renderEntityAvatarHTML(G.player, 'battle');
  setHpBar('player', p.hp, p.maxHp);
  setEnergyBar('player', G.player.energy, G.player.energyMax);
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
  if(G.enemy.birdKey&&BIRDS[G.enemy.birdKey]){
    const enemyBird = Object.assign({}, BIRDS[G.enemy.birdKey], G.enemy, { portraitKey: G.enemy.portraitKey || BIRDS[G.enemy.birdKey].portraitKey });
    document.getElementById('enemy-avatar').innerHTML = renderEntityAvatarHTML(enemyBird, 'battle');
    document.getElementById('enemy-avatar').style.fontSize='';
  }else if(G.enemy.portraitKey){
    document.getElementById('enemy-avatar').innerHTML = renderEntityAvatarHTML(G.enemy, 'battle');
    document.getElementById('enemy-avatar').style.fontSize='';
  }else{
    document.getElementById('enemy-avatar').textContent = G.enemy.emoji;
    document.getElementById('enemy-avatar').style.fontSize='3.8rem';
  }
  setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
  setEnergyBar('enemy', G.enemy.energy, G.enemy.energyMax||3);
  const eclsEl=document.getElementById('enemy-class-label');
  if(eclsEl){
    const ecls=idToClassLabel(resolveFinalClass(G.enemy.class||inferEnemyClassFromStyle(G.enemy)||'predator',G.enemy.birdKey||''));
    eclsEl.textContent = `${G.enemy.isBoss?'Boss · ':''}${ecls}`;
  }

  document.getElementById('level-label').textContent = `STAGE ${getEncounterStage()}`;
  document.getElementById('bird-lv-label').textContent = `Lv.${G.player.birdLevel}`;
  const shinyEl=document.getElementById('battle-shiny-count'); if(shinyEl) shinyEl.textContent=String(G.shinyObjects||0);

  // EXP bar
  const needed = expForLevel(G.player.birdLevel+1);
  const pct = Math.min(G.player.exp/needed*100,100);
  document.getElementById('exp-bar').style.width = pct+'%';
  document.getElementById('exp-txt').textContent = `${G.player.exp} / ${needed}`;

  // Stats
  // Compute effective stats with buffs for display
  const _effDef=Math.floor((p.def+(G.battleHymnActive?G.battleHymnDEF:0))*(playerHasBurning()?0.8:1));
  const _effAcc=Math.min(100,p.acc+(G.battleHymnActive?G.battleHymnACC:0)-(G.playerStatus?.accDebuff||0));
  const _effDodge=getEffectiveDodge(G.player);
  const _effSpd=(p.spd||0) + ((G.playerStatus?.slow?.spdPenalty)?-(G.playerStatus.slow.spdPenalty||0):0);
  const _effMatk=(p.matk||8);
  const _effMdef=Math.floor((p.mdef||8)*(playerHasBurning()?0.8:1));
  const _eqMechCombat=typeof Avian?.mutations?.getMechanicsRollup==='function'?Avian.mutations.getMechanicsRollup(G.player):null;
  const escAttr=(s)=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const _trendTag = (diff) => diff>0 ? '<small class="stat-trend up">▲</small>' : (diff<0 ? '<small class="stat-trend down">▼</small>' : '');
  const _atkDiff = G.warcryActive ? Math.max(1,Math.floor((p.atk||0)*(G.warcryATK||0)/100)) : (getWeakenStacks(G.playerStatus)>0 ? -1 : 0);
  const _effAtk=G.warcryActive?(p.atk||0)*(1+G.warcryATK/100):p.atk;
  const _critChance = Math.min(100,(p.critChance||5));
  const _critBase=G.player.goldCritMult||1.5;
  const _critBonusPct=(G.player.critDamageBonusPct||0)+(_eqMechCombat?.critDamageBonusPct||0);
  const _critMultHtml=_critBonusPct>0?`${formatCombatNumber(_critBase)}×<small class="stat-cd-bonus">+${formatCombatNumber(_critBonusPct)}</small>`:`${formatCombatNumber(_critBase)}×`;
  const _ccBaseStore=(p.critChance||5);
  const _statNote=(label,diff,srcUp='',srcDown='')=>`${label} ${diff>=0?'+':''}${diff}. ${diff>0?srcUp:(diff<0?srcDown:'No active modifier.')}`;
  const _atkNote=(G.warcryActive?`Warcry +${G.warcryATK}% ATK.`:'') + (getWeakenStacks(G.playerStatus)>0?' Weaken reducing output.':'');
  const _accCardBonus=(G.player.firstAttackAccBonus||0)>0?` Shop/card hit bonus +${G.player.firstAttackAccBonus}% (applies to all attacks).`:'';
  const statCell=(klass,label,val,{suffix='',title='',trend='',statKey='',statRaw=null}={})=>{
    const dataAttr=statKey?` data-stat-key="${statKey}" data-stat-raw="${Number(statRaw ?? val)}"`:'';
    return `<div class="stat-mini ${klass}"${dataAttr} title="${escAttr(title)}"><span class="stat-k">${label}</span><span class="stat-v">${formatCombatNumber(val)}${suffix}${trend}</span></div>`;
  };
  const _bt=(key,raw,extra='')=>{ const b=buildStatBreakdownTitle(key,raw,G.player); return [b,extra].filter(Boolean).join(' | '); };
  const _pCombatHint=buildPlayerCombatStatHint();
  const _pHintRow=_pCombatHint?`<div class="stat-status-hint" style="grid-column:1/-1">${escAttr(_pCombatHint)}</div>`:'';
  const _effArmorPen=getPlayerArmorPenPct(G.player);
  const _effMagicPen=getPlayerMagicPenPct(G.player);
  const _penCells=`${(_effArmorPen>0)?statCell('stat-armor-pen','Armour Pen',_effArmorPen,{suffix:'%',title:_bt('armorPen',p.armorPen||0,'Ignores enemy DEF on physical hits.'),statKey:'armorPen',statRaw:p.armorPen||0}):''}${(_effMagicPen>0)?statCell('stat-magic-pen','Magic Pen',_effMagicPen,{suffix:'%',title:_bt('magicPen',p.magicPen||0,'Ignores enemy MDEF on magical hits.'),statKey:'magicPen',statRaw:p.magicPen||0}):''}`;

  document.getElementById('player-stats-mini').innerHTML =
    `${statCell('stat-atk','ATK',_effAtk,{title:_bt('atk',p.atk,_statNote('Battle ATK',_effAtk-(p.atk||0),_atkNote,'Debuffs reducing ATK effect.')),trend:_trendTag(_effAtk-(p.atk||0)),statKey:'atk',statRaw:p.atk})}
     ${statCell('stat-matk','MATK',_effMatk,{title:_bt('matk',p.matk||8,'Magic Attack — improves spell/ailment potency'),trend:_trendTag(_effMatk-(p.matk||8)),statKey:'matk',statRaw:p.matk||8})}
     ${statCell('stat-def','DEF',_effDef,{title:_bt('def',p.def,_statNote('Battle DEF',_effDef-(p.def||0),'Battle Hymn increased DEF.','Debuffs reducing DEF.')),trend:_trendTag(_effDef-p.def),statKey:'def',statRaw:p.def})}
     ${statCell('stat-mdef','MDEF',_effMdef,{title:_bt('mdef',p.mdef||8,'Magic Defence — resists enemy spells and ailments'),trend:_trendTag(_effMdef-(p.mdef||8)),statKey:'mdef',statRaw:p.mdef||8})}
     ${statCell('stat-dodge','Dodge',_effDodge,{suffix:'%',title:_bt('dodge',p.dodge,`Physical dodge. ${_statNote('Display',_effDodge-(p.dodge||0),'Evasion buffs active.','Debuffs reduced dodge.')}`),trend:_trendTag(_effDodge-p.dodge),statKey:'dodge',statRaw:p.dodge})}
     ${statCell('stat-acc','ACC',_effAcc,{suffix:'%',title:_bt('acc',p.acc,_statNote('Battle ACC',_effAcc-(p.acc||0),'Battle Hymn increased ACC.','Blind/ruffle reduced ACC.')+_accCardBonus),trend:_trendTag(_effAcc-p.acc),statKey:'acc',statRaw:p.acc})}
     ${statCell('stat-spd','SPD',_effSpd,{title:_bt('spd',p.spd,_statNote('Battle SPD',_effSpd-(p.spd||0),'Buff increased SPD.','Slow/clip effects reduced SPD.')),trend:_trendTag(_effSpd-p.spd),statKey:'spd',statRaw:p.spd})}
     ${statCell('stat-cc','CC',_critChance,{suffix:'%',title:_bt('critChance',_ccBaseStore,`Shown value includes battle modifiers (e.g. burn). ${_statNote('vs stored CC',_critChance-_ccBaseStore,'Temporary buffs.','')}`),trend:_trendTag(_critChance-_ccBaseStore),statKey:'critChance',statRaw:_ccBaseStore})}
     <div class="stat-mini stat-cd" title="${escAttr(`Base crit multiplier ${formatCombatNumber(_critBase)}×. On critical hits, +${formatCombatNumber(_critBonusPct)} is added to the multiplier (e.g. Execution Beak). Shown value is base; small +number is the crit-only add.`)}"><span class="stat-k">CD</span><span class="stat-v">${_critMultHtml}</span></div>
     ${_penCells}
     ${_pHintRow}`;
  wireCombatStatTooltips();

  // Enemy stats display
  const eal=document.getElementById('enemy-abilities-list');
  const ep2=G.enemy.stats;
  const eCritChance=Math.max(0,Math.min(100,(ep2.cc??((ep2.critChance||5)/100))*100));
  const eCritMult=(ep2.cd??ep2.critMult??1.5);
  const _eTrendTag = (diff) => diff>0 ? '<small class="stat-trend up">▲</small>' : (diff<0 ? '<small class="stat-trend down">▼</small>' : '');
  const _eBase = G.enemy._battleStatBase || {};
  const enemyCell=(klass,label,val,{suffix='',title='',trend='',baseKey='',statKey='',statRaw=null}={})=>{
    const dataAttr=statKey?` data-stat-key="${statKey}" data-stat-raw="${Number(statRaw ?? val)}"`:'';
    return `<div class="est ${klass}"${dataAttr} title="${escAttr(title)}"><span class="stat-k">${label}</span><span class="stat-v">${formatCombatNumber(val)}${suffix}${trend || (baseKey ? _eTrendTag(val - (Number(_eBase[baseKey])||val)) : '')}</span></div>`;
  };
  const _eCombatHint=buildEnemyCombatStatHint();
  const _eHintRow=_eCombatHint?`<div class="stat-status-hint est-hint" style="grid-column:1/-1">${escAttr(_eCombatHint)}</div>`:'';
  const _effEnemyDef=Math.floor((ep2.def||0)*(enemyHasBurning()?0.8:1));
  const _effEnemyMdef=Math.floor((ep2.mdef||8)*(enemyHasBurning()?0.8:1));
  const _effEnemyDodge=(ep2.dodge||0);
  const _enemyDodgeSpdNote=enemyHasBurning()?' — Burning: −20% DEF/MDEF':'';
  document.getElementById('enemy-stats-mini').innerHTML =
    `${enemyCell('stat-atk','ATK',ep2.atk,{title:'Physical attack',baseKey:'atk',statKey:'atk',statRaw:ep2.atk})}
     ${enemyCell('stat-matk','MATK',ep2.matk||6,{title:'Magic attack',baseKey:'matk',statKey:'matk',statRaw:ep2.matk||6})}
     ${enemyCell('stat-def','DEF',_effEnemyDef,{title:'Physical defence'+_enemyDodgeSpdNote,baseKey:'def',statKey:'def',statRaw:ep2.def,trend:_eTrendTag(_effEnemyDef-(ep2.def||0))})}
     ${enemyCell('stat-mdef','MDEF',_effEnemyMdef,{title:'Magic defence'+_enemyDodgeSpdNote,baseKey:'mdef',statKey:'mdef',statRaw:ep2.mdef||8,trend:_eTrendTag(_effEnemyMdef-(ep2.mdef||8))})}
     ${enemyCell('stat-dodge','Dodge',_effEnemyDodge,{suffix:'%',title:`Dodge${_enemyDodgeSpdNote}`,baseKey:'dodge',statKey:'dodge',statRaw:ep2.dodge||0})}
     ${enemyCell('stat-acc','ACC',ep2.acc||70,{suffix:'%',title:'Accuracy',baseKey:'acc',statKey:'acc',statRaw:ep2.acc||70})}
     ${enemyCell('stat-spd','SPD',ep2.spd||0,{title:'Speed',baseKey:'spd',statKey:'spd',statRaw:ep2.spd||0})}
     ${enemyCell('stat-cc','CC',eCritChance,{suffix:'%',title:'Crit chance',statKey:'critChance',statRaw:eCritChance})}
     ${enemyCell('stat-cd','CD',Number(eCritMult),{suffix:'×',title:'Crit damage'})}
     ${_eHintRow}`;
  wireCombatEnemyStatTooltips();
  wireEnemyMutationTooltips();
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

  document.getElementById('player-shield-overlay').className='shield-overlay';
  document.getElementById('enemy-shield-overlay').className='shield-overlay'+(G.enemyStatus.defending>0?' active':'');

  renderEnemyPlan();
  wireCombatDropdownStateSync();
  applyUIStateToDOM();
  renderActions();
  wireEnemyInfoPopupOnce();
}

function setHpBar(who,hp,max) {
  const pct=Math.max(0,hp/max*100);
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
    hpTextEl.textContent=`${formatCombatNumber(Math.max(0,hp))}/${formatCombatNumber(max)} (${pct.toFixed(2)}%)`;
    hpTextEl.classList.remove('hp-delta-up','hp-delta-down');
    if(delta<0){ hpTextEl.classList.add('hp-delta-down'); }
    else if(delta>0){ hpTextEl.classList.add('hp-delta-up'); }
  }

  bar.classList.remove('recent-hit','recent-heal');
  if(delta<0) bar.classList.add('recent-hit');
  else if(delta>0) bar.classList.add('recent-heal');

  // Danger pulse on player panel when low HP
  if(who==='player') {
    const panel=document.getElementById('player-panel');
    if(pct<25) panel.classList.add('player-danger');
    else panel.classList.remove('player-danger');
  }

  // Boss phase-two glow + warning banner when boss drops below 50%
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
}

function renderStatuses(id, statuses) {
  const el=document.getElementById(id); el.innerHTML='';
  const owner = id === 'player-status' ? 'player' : 'enemy';
  const ownerStats = owner === 'player' ? G?.player?.stats : G?.enemy?.stats;
  const poisonCap = G?.player ? (G.player.poisonCap||5) : 5;
  const poisonBoundaryDamage = stacks=>{
    const mult=owner==='player'?(G?.player?.poisonTickMult||1):1;
    const flat=owner==='enemy'?((G?.player?.poisonFlatBonus||0)+(G?.player?.perkPoisonTickBonus||0)+(G?.player?.relVenomLedger?1:0)):0;
    return Math.max(1,Math.floor(2*(stacks||0)*mult)+flat);
  };
  const nextTickInfo = (key, value) => {
    if(key==='poison' && value?.stacks>0) {
      return `Each end-of-turn boundary: ${poisonBoundaryDamage(value.stacks)} poison (player turn end + enemy turn end).`;
    }
    if(key==='bleed' && ((value?.turns||0)>0 || (value?.stacks||0)>0)){
      return 'Healing received and heal effects −50%.';
    }
    if(key==='burning'){
      return '7 flat at end of enemy phase; −20% DEF/MDEF while burning.';
    }
    if(key==='delayed' && value?.dmg!=null && value?.dmg!==''){
      return `Detonates end of this unit next turn (${Math.max(1, Math.floor(Number(value.dmg)))} stored). Reapply replaces.`;
    }
    return '';
  };
  const detailText = (key, value, summary='') => {
    const turns = typeof value==='number' ? value : (value?.turns ?? null);
    const stacks = typeof value==='object' && typeof value?.stacks==='number' ? value.stacks : null;
    const bits = [];
    if(turns!==null) bits.push(`Duration: ${turns} turn${turns===1?'':'s'}.`);
    if(stacks!==null) bits.push(`Stacks: ${stacks}.`);
    const next = nextTickInfo(key, value);
    if(next) bits.push(next);
    if(summary) bits.push(summary);
    return bits.join(' ');
  };
  Object.entries(statuses).forEach(([k,v])=>{
    if (!v && v!==0) return;
    if (v===0 || (typeof v==='object' && v.turns==null && v.stacks==null && (v.dmg==null||v.dmg===''))) return;
    const b=document.createElement('span');
    b.className=`status-badge ${k}`;
    let tooltipSummary='';
    if (k==='poison') { const per=poisonBoundaryDamage(v.stacks); b.textContent=`☣ Poison×${v.stacks}/${poisonCap}(${v.turns}t, ${per}/boundary)`; tooltipSummary='Stacks to 5. 2 damage per stack; ticks at end of player turn and enemy turn.'; }
    else if (k==='bleed') { b.className='status-badge bleed'; b.textContent=`🩸 Bleed(${v.turns||0}t, heal −50%)`; tooltipSummary='Non-stacking. Healing received/effects reduced by 50%. Refresh only.'; }
    else if (k==='weaken') {
      const st=getWeakenStacks(statuses);
      const turns=typeof v==='number'?v:(v?.turns||0);
      const dmgPct=Math.round((1-getWeakenDamageMult(st))*100);
      const dodgePen=getWeakenDodgePenalty(st);
      b.textContent=`🐔 Weaken×${st}(${turns}t, −${dmgPct}% dmg, −${dodgePen} dodge)`;
      tooltipSummary=(AILMENTS?.weaken?.desc)||'Stacks to 3. −10% outgoing damage and −10 dodge per stack. Refreshes duration.';
    }
    else if (k==='paralyzed') { b.textContent=`⚡ Para(${v}t, 20% skip)`; }
    else if (k==='burning') { const bt=typeof v==='number'?v:(v.turns||0); b.textContent=`🔥 Burn(${bt}t, 7@enemy end, −20% DEF/MDEF)`; tooltipSummary='Non-stacking. 7 flat damage end of enemy turn; −20% DEF and MDEF while burning.'; }
    else if (k==='delayed') { b.textContent=`🎵 Delayed(${v.dmg}dmg)`; tooltipSummary='Non-stacking. Stored damage detonates end of target next turn; reapply refreshes/replaces.'; }
    else if (k==='confused') { b.className='status-badge confused'; const sc=v.selfChance!=null?v.selfChance:(v.skipChance!=null?v.skipChance:STATUS_CONFUSED_SELF_PCT); b.textContent=`🌀 Confused(${v.turns}t,${sc}% self-hit)`; tooltipSummary='Non-stacking. 30% chance to hit yourself with your own attack.'; }
    else if (k==='tookie') { b.className='status-badge stunned'; b.textContent=`🦜 Tookie(+${v.atkBonus}%atk,${v.turns}t)`; }
    else if (k==='humDodge') { b.className='status-badge evading'; b.textContent=`🎵 Hum+${v.bonus}%(${v.turns}t)`; }
    else if (k==='warcry') { b.className='status-badge stunned'; b.textContent=`🎺 Warcry+${v.atkBonus}%(${v.turns}t)`; }
    else if (k==='battleHymn') { b.className='status-badge evading'; b.textContent=`🎼 Hymn(${v.turns}t)`; }
    else if (k==='stunned') { b.className='status-badge stunned'; b.textContent=`😵 Stunned(${v}t)`; }
    else if (k==='mud') { b.className='status-badge delayed'; b.textContent=`🟤 Slowed(${v.turns}t)`; }
    else if (k==='slow') { const t=(typeof v==='number'?v:(v.turns||0)); const sp=(typeof v==='number'?2:(v.spdPenalty??0)); const dg=(typeof v==='number'?8:(v.dodgePenalty??0)); b.className='status-badge slow'; b.textContent=`🐌 Slow(${t}t,-${sp} SPD,-${dg}% DODGE)`; }
    else if (k==='chilled') { const st=v.stacks||0; const t=v.turns||0; b.className='status-badge slow'; b.textContent=`❄ Chill×${st}/${5}(${t}t, −${st*8}% SPD)`; tooltipSummary='Stacks to 5. −8% SPD per stack. At 5 stacks becomes Frozen.'; }
    else if (k==='frozen') { const ft=v.turns||0; b.className='status-badge slow'; b.textContent=`🧊 Frozen(${ft}t,+1 EN skills)`; tooltipSummary='Refresh only. Active skills cost +1 EN. After Frozen ends, Chilled resets to 0.'; }
    else if (k==='feared') { b.className='status-badge feared'; b.textContent=`😨 Feared(${v}t,30% skip)`; tooltipSummary='Refresh only. 30% chance to skip turn.'; }
    else if (k==='lullabied') { b.className='status-badge lullabied'; b.textContent=`💤 Lulled(${v}t)`; tooltipSummary='Debuff: chance to skip actions while lulled.'; }
    else if (k==='evading') { b.className='status-badge evading'; b.textContent=`💨 Evade(${v}t)`; }
    else if (k==='guarded') {
      const pct=Math.floor(Number(v.physReducPct)||0);
      const t=Math.floor(Number(v.turns)||0);
      b.className='status-badge guarded';
      b.textContent=`🛡 Guarded(${pct}%·${t}t)`;
      tooltipSummary='Physical attack damage reduction only. Does not reduce magic or song damage.';
    }
    else if (k==='defending') { b.className='status-badge defending'; b.textContent=`🛡 Guard(${v}t)`; tooltipSummary='Damage reduction while guarding.'; }
    else if (k==='dustDevil') { b.className='status-badge feared'; b.textContent=`🌪 Blinded(${v.turns}t,-${v.accDrop||15}%ACC)`; }
    else if (k==='featherRuffle') { b.className='status-badge weaken'; b.textContent=`🪶 Ruffled(${v.turns}t,-${v.atkReduction}%ATK${v.accDrop>0?',-'+v.accDrop+'%ACC':''})`; }
    else if (k==='exposedGuard') { b.className='status-badge weaken'; b.textContent=`🎯 Exposed(${v.turns}t,+${Math.round((v.pct||0)*100)}% dmg)`; }
    else if (k==='hum') { b.className='status-badge evading'; b.textContent=`🎵 Hum(${v}t)`; }
    else if (k==='rockDrop') { b.className='status-badge delayed'; b.textContent=`🪨 Rock Ready`; }
    else if (k==='flyby') { b.className='status-badge evading'; b.textContent=`💨 Momentum!`; }
    else if (k==='countering') { b.className='status-badge defending'; b.textContent=`⚔ Counter(${v.turns||0}t)`; }
    else if (k==='defBoost') { b.className='status-badge defending'; b.textContent=`🧱 DEF+${v.amt}(${v.turns}t)`; }
    else if (k==='parry') { b.className='status-badge evading'; b.textContent=`🗡 Parry(${v}t)`; }
    else if (k==='enemyBlind') { b.className='status-badge feared'; b.textContent=`👁 Blind(${v}t)`; }
    else if (k==='sittingDuck') { b.className='status-badge feared'; b.textContent=`🦆 Duck!(Dodge=0%)`; }
    else if (k==='wingClip') { b.className='status-badge feared'; b.textContent=`✂ Clipped(${v.turns}t,-${v.spdRedux}SPD)`; }
    else if (k==='sonicSkip') { b.className='status-badge paralyzed'; b.textContent=`🔊 Dirge(${v.turns}t,${v.chance}%skip)`; tooltipSummary='Debuff: chance to skip actions from sonic disorientation.'; }
    else if (k==='peregrineCritLens') { b.className='status-badge crit'; b.textContent=`🦅 Aim+${v.bonus||0}%Crit(${v.turns}t)`; }
    else if (k==='kookaCritLens') { b.className='status-badge crit'; b.textContent=`🪶 Lock+${v.bonus||0}%Crit(${v.turns}t)`; }
    else if (k==='peregrineDiveAmp') { b.className='status-badge buffed'; b.textContent=`🦅 Stoop+${Math.round((v.mult||0)*100)}%(${v.turns}t)`; }
    else if (k==='peregrineDefBreak') { b.className='status-badge weaken'; b.textContent=`🛡 Broken(${v.turns}t,−${v.defLost||0}DEF)`; }
    else if (k==='owlCritFocus') { b.className='status-badge crit'; b.textContent=`🦉 Moon+${v.bonus||0}%Crit(${v.turns}t)`; }
    else if (k==='owlArmorStress') { b.className='status-badge weaken'; b.textContent=`🦉 Stressed(${v.turns}t,−${v.defLost||0}DEF)`; }
    else { return; }
    b.title=b.textContent.replace(/\s+/g,' ').trim();
    b.dataset.statusId = k;
    b.dataset.statusDetail = detailText(k, v, tooltipSummary);
    b.addEventListener('mouseenter',e=>showTooltip(e,`${b.title}\n${b.dataset.statusDetail||''}`,e.clientX+12,e.clientY+12));
    b.addEventListener('mousemove',e=>moveTooltip(e.clientX+12,e.clientY+12));
    b.addEventListener('mouseleave',hideTooltip);
    el.appendChild(b);
  });
}

function setEnergyBar(side,cur,max){
  const fill=document.getElementById(`${side}-en-bar`);
  const txt=document.getElementById(`${side}-en-text`);
  const c=Math.max(0, Number(cur)||0);
  const m=Math.max(1, Number(max)||1);
  if(fill) fill.style.width = `${Math.max(0,Math.min(100,(c/m)*100))}%`;
  if(txt) txt.textContent = `${c}/${m}`;
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

function lockActionUI(locked){
  const grid=document.getElementById('actions-grid');
  if(!grid) return;
  grid.querySelectorAll('button').forEach(b=>b.disabled=!!locked);
}

function canPlayerAct(){
  return !G.battleOver&&G.turn==='player'&&G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER&&!G.actionBusy&&!G.animLock;
}

function syncCombatTurnFlags(){
  if(G.battleOver||!G.player||!G.enemy) return;
  if(G.turnPhase===TURN.RESOLVING) return;
  if(G.phase==='PLAYER'&&G.turnPhase===TURN.PLAYER){
    G.turn='player';
  }else if(G.phase==='ENEMY'&&G.turnPhase===TURN.ENEMY){
    G.turn='enemy';
  }
}

function renderEnemyPlan(){
  const host=document.getElementById('enemy-intent-panel');
  if(!host || !G.enemy) return;
  const maxE=Math.max(0,G.enemy.energyMax||3);
  const curE=(G.turnPhase===TURN.ENEMY) ? Math.max(0,G.enemy.energy||0) : maxE;
  let label='🤔 Thinking...';
  let title='';
  if(G.enemyNextAction){
    label=G.enemyNextAction.label||'Enemy Plan';
    if(/^\[[^\]]+\]\s+/.test(String(label))){ const i=String(label).indexOf('] '); if(i>=0) label=String(label).slice(i+2).trim(); }
    if(G.enemyNextAction.type==='plan'){
      const parts=(G.enemyNextAction.actions||[]).slice(0,3);
      const blocks=parts.map(a=>{
        if(a.type==='ability') return buildEnemyAbilityTooltipHtml(a.abilityId, G.enemy.stats);
        return `<div class="tt-name">${escapeEncounterPreviewHtml(a.label||a.type)}</div>`;
      }).filter(Boolean).join('<hr style="border:0;border-top:1px solid var(--border);margin:6px 0">');
      title=(parts.length>1?`<div class="tt-desc" style="margin-bottom:6px;opacity:.9">Planned turn — ${parts.length} actions</div>`:'')+blocks;
    } else if(G.enemyNextAction.type==='ability'){
      title=buildEnemyAbilityTooltipHtml(G.enemyNextAction.abilityId, G.enemy.stats);
    }
  }
  host.innerHTML=`<div class="intent-row intent-row--compact"><span class="intent-name">${escapeEncounterPreviewHtml(label)}</span><span class="intent-meta"><span class="intent-ap">EN ${curE}/${maxE}</span></span></div>`;
  host.removeAttribute('title');
  if(title){
    host.onmouseenter=(e)=>showTooltip(e,title,e.clientX+10,e.clientY+10);
    host.onmousemove=(e)=>moveTooltip(e.clientX+10,e.clientY+10);
    host.onmouseleave=()=>hideTooltip();
  } else { host.onmouseenter=null; host.onmousemove=null; host.onmouseleave=null; }
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

function enqueueAction(fn){
  G.actionQueue=G.actionQueue||[];
  G.actionQueue.push(fn);
  runActionQueue();
}

async function runActionQueue(){
  if(G.actionBusy) return;
  G.actionBusy=true;
  lockActionUI(true);

  try{
    while((G.actionQueue||[]).length){
      const fn=G.actionQueue.shift();
      try{
        await fn();
      }catch(err){
        console.error('Action failed:', err);

        G.animLock=false;
        G.actionQueue.length=0;

        if(G.player?.stats?.hp>0 && G.enemy?.stats?.hp>0 && !G.battleOver){
          G.phase='PLAYER';
          G.turnPhase=TURN.PLAYER;
          G.turn='player';
        }

        logMsg('⚠ Action failed (recovered). Check console.', 'miss');
      }

      if(!G.player||!G.enemy||G.battleOver) break;
      renderAllCombatUI();
    }
  } finally {
    G.actionBusy=false;
    if(G.phase==='PLAYER' && G.turnPhase===TURN.PLAYER){
      G.animLock=false;
      lockActionUI(false);
    }
    renderActions();
  }
}


// ============================================================
// FAILSAFE — prevents "stuck UI / no one's turn / dead clicks"
// ============================================================
function isActiveBattleContext(){
  const onBattle=!!document.getElementById('screen-battle')?.classList.contains('active');
  return !!(onBattle && G.player && G.enemy && !G.battleOver);
}
globalThis.isActiveBattleContext=isActiveBattleContext;

function failsafeAdvance(reason='') {
  try {
    G.animLock = false;

    if (G.actionBusy) {
      G.actionBusy = false;
      G.actionQueue = [];
    }

    if (typeof lockActionUI === 'function') lockActionUI(false);

    if (G.player && G.enemy && !G.battleOver) {
      if (typeof TURN !== 'undefined') G.turnPhase = TURN.PLAYER;
      G.turn = 'player';
      G.phase = 'PLAYER';
    }

    if(isActiveBattleContext()){
      if (typeof renderAllCombatUI === 'function') renderAllCombatUI();
      if (typeof refreshBattleUI === 'function') refreshBattleUI();
      if (typeof renderActions === 'function') renderActions();
      if (typeof renderEnergyOrbs === 'function') renderEnergyOrbs();
    }

    // console.warn('[failsafeAdvance]', reason);
  } catch (e) {
    console.error('failsafeAdvance failed:', e);
  }
}

window.addEventListener('error', (ev) => {
  // #region agent log
  _agentDbgLog('game.js:window.error', 'uncaught error', { msg: String(ev.message || ''), file: String(ev.filename || ''), line: ev.lineno || null, col: ev.colno || null, stack: String(ev.error?.stack || '').slice(0, 800) }, 'H5');
  // #endregion
  try { console.error('[game] uncaught error:', ev.message, ev.error || ev); } catch(_) {}
  if(isActiveBattleContext()){
    try { failsafeAdvance('window.onerror'); } catch(_) {}
  }
});
window.addEventListener('unhandledrejection', (ev) => {
  try { console.error('[game] unhandled rejection:', ev.reason); } catch(_) {}
  if(isActiveBattleContext()){
    try { failsafeAdvance('unhandledrejection'); } catch(_) {}
  }
});


// ============================================================
// ON-SCREEN ERROR HUD (mobile-friendly)
// ============================================================
function installLegacyErrorHUD(){
  if (document.getElementById('error-hud')) return;

  const hud = document.createElement('div');
  hud.id = 'error-hud';
  hud.style.cssText = `
    position:fixed; left:8px; right:8px; bottom:8px;
    z-index:999999; font:12px/1.25 monospace;
    color:#fff; background:rgba(40,0,0,.92);
    border:1px solid rgba(255,120,120,.65);
    border-radius:12px; padding:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.45);
    max-height:40vh; overflow:auto; display:none;
  `;

  hud.innerHTML = `
    <div style="display:flex; gap:8px; align-items:center; justify-content:space-between;">
      <div style="font-weight:700; letter-spacing:.08em; color:#ffb3b3;">
        ⚠ ERROR
      </div>
      <div style="display:flex; gap:6px;">
        <button id="eh-copy" style="padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;">Copy</button>
        <button id="eh-clear" style="padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;">Clear</button>
        <button id="eh-hide" style="padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;">Hide</button>
      </div>
    </div>

    <div id="eh-meta" style="margin-top:6px; opacity:.85;">
      (Errors will appear here)
    </div>

    <div id="eh-list" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;"></div>

    <label style="display:flex; gap:8px; align-items:center; margin-top:10px; opacity:.9;">
      <input id="eh-autofix" type="checkbox" checked />
      Auto-recover (calls failsafeAdvance)
    </label>
  `;

  document.body.appendChild(hud);

  const list = hud.querySelector('#eh-list');
  const meta = hud.querySelector('#eh-meta');
  const btnHide = hud.querySelector('#eh-hide');
  const btnClear = hud.querySelector('#eh-clear');
  const btnCopy = hud.querySelector('#eh-copy');
  const chkAuto = hud.querySelector('#eh-autofix');

  const store = {
    max: 8,
    items: [],
  };

  function showHUD(){
    hud.style.display = 'block';
  }

  function escapeHtml(v){
    return String(v).replace(/[&<>"']/g, c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[c]));
  }

  function pushItem(kind, msg, src, line, col, stack){
    const time = new Date().toLocaleTimeString();
    const entry = {
      time, kind,
      msg: String(msg || ''),
      src: String(src || ''),
      line: line ?? '',
      col: col ?? '',
      stack: String(stack || ''),
    };
    store.items.unshift(entry);
    if(store.items.length > store.max) store.items.pop();

    meta.textContent = `${store.items.length} error(s) captured. Latest at ${time}.`;
    list.innerHTML = '';

    store.items.forEach(e=>{
      const box = document.createElement('div');
      box.style.cssText = `
        padding:8px; border-radius:10px;
        border:1px solid rgba(255,255,255,.18);
        background:rgba(255,255,255,.06);
      `;
      const loc = e.src ? `@ ${e.src}${e.line!==''?`:${e.line}`:''}${e.col!==''?`:${e.col}`:''}` : '';
      box.innerHTML = `
        <div style="opacity:.9"><strong>${e.kind}</strong> • ${e.time}</div>
        <div style="margin-top:4px">${escapeHtml(e.msg)}</div>
        ${loc ? `<div style="margin-top:4px; opacity:.75">${escapeHtml(loc)}</div>` : ''}
        ${e.stack ? `<details style="margin-top:6px; opacity:.9"><summary>stack</summary><pre style="white-space:pre-wrap;margin:6px 0 0 0">${escapeHtml(e.stack)}</pre></details>`:''}
      `;
      list.appendChild(box);
    });

    showHUD();

    if(chkAuto && chkAuto.checked){
      try{
        if(typeof failsafeAdvance === 'function') failsafeAdvance('ErrorHUD auto-recover');
      }catch(_){ }
    }
  }

  btnHide.onclick = ()=>{ hud.style.display='none'; };
  btnClear.onclick = ()=>{
    store.items = [];
    list.innerHTML = '';
    meta.textContent = '(Errors cleared)';
  };
  btnCopy.onclick = async ()=>{
    const text = store.items.map(e=>{
      return `[${e.time}] ${e.kind}: ${e.msg}\n${e.src}${e.line!==''?`:${e.line}`:''}${e.col!==''?`:${e.col}`:''}\n${e.stack}\n`;
    }).join('\n');
    try{
      await navigator.clipboard.writeText(text);
      meta.textContent = 'Copied to clipboard ✅';
    }catch(err){
      meta.textContent = 'Copy failed (clipboard not available on this device).';
      console.warn('Clipboard copy failed:', err);
    }
  };

  window.addEventListener('error', (ev)=>{
    const err = ev.error;
    pushItem(
      'Error',
      ev.message,
      ev.filename,
      ev.lineno,
      ev.colno,
      err && err.stack ? err.stack : ''
    );
  });

  window.addEventListener('unhandledrejection', (ev)=>{
    const r = ev.reason;
    pushItem(
      'PromiseRejection',
      r && r.message ? r.message : String(r),
      '',
      '',
      '',
      r && r.stack ? r.stack : ''
    );
  });

  window.showErrorHUD = ()=> showHUD();
}

function installErrorHUD(){
  if (document.getElementById('error-console-overlay') || document.getElementById('error-hud')) return;
  if (typeof globalThis.__errorHudBundledInstall === 'function') {
    globalThis.__errorHudBundledInstall();
    return;
  }
  installLegacyErrorHUD();
}



const ABILITY_DISPLAY_TAGS = {
  rapidPeck:['BASIC'], blackPeck:['BASIC'], gooseHonk:['BASIC'], headWhip:['BASIC'], kick:['BASIC'], raptorKick:['BASIC'],
  talonStrike:['HEAVY'], heavyTalon:['HEAVY'], bodySlam:['HEAVY'], trample:['HEAVY'], skyStrike:['HEAVY','SIGNATURE'],
  windSlash:['SPELL'], shriekwave:['SPELL','CONTROL'], stormChorus:['SPELL','CONTROL','SIGNATURE'], mudLash:['SPELL','CONTROL','SIGNATURE'],
  murderMurmuration:['MULTI','SIGNATURE'], stickLance:['HEAVY','SIGNATURE'],
  fishSnatcher:['UTILITY','HEAL','SIGNATURE'], fruitBomb:['SPELL','SIGNATURE'],
  roost:['HEAL'], preen:['UTILITY','HEAL'], crowDefend:['GUARD'], guard:['GUARD'], evade:['UTILITY'],
  intimidate:['CONTROL'], threatDisplay:['CONTROL'], dreadCall:['UTILITY','CONTROL'],
  victoryChant:['UTILITY'], battleChirp:['UTILITY'], battleFocus:['UTILITY'], focusChirp:['UTILITY'],
  steal_shine:['UTILITY','SIGNATURE'], feather_flick:['UTILITY'], featherFlick:['UTILITY'], graceStep:['UTILITY'],
  sgl_snap_peck:['BASIC'], sgl_swoop_pass:['HEAVY','SIGNATURE'], sgl_raucous_cry:['UTILITY','CONTROL'], sgl_scavenge_mark:['UTILITY'],
  gos_beak_snap:['BASIC'], gos_body_check:['HEAVY','SIGNATURE'], gos_honk_blast:['UTILITY'], gos_brace_up:['GUARD','HEAL'],
  sbl_beak_chop:['BASIC'], sbl_skull_crack:['HEAVY','SIGNATURE'], sbl_still_stance:['GUARD'], sbl_dread_mark:['UTILITY','HEAL'],
  pelican_snap:['BASIC'], pelican_crush:['HEAVY','SIGNATURE'], pelican_guard:['GUARD'], pelican_recovery:['UTILITY','HEAL'],
  hrp_talon_clutch:['BASIC'], hrp_canopy_crush:['HEAVY','SIGNATURE'], hrp_predator_grip:['HEAVY','SIGNATURE'], hrp_prey_lock:['UTILITY'],
  savageKick:['HEAVY','SIGNATURE'], raptorKickFrenzy:['HEAVY','MULTI','SIGNATURE'], honkTerror:['CONTROL','SIGNATURE'],
  rallyCall:['UTILITY'], focusSight:['UTILITY'], battleRhythm:['UTILITY'],
};
function getAbilityDisplayTags(ab){
  const id=ab?.id||'';
  return ABILITY_DISPLAY_TAGS[id] || [String((ab?.type||ab?.btnType||'utility')).toUpperCase()];
}
function abilityTypeChipLabel(btnType){
  const map={physical:'Physical',ranged:'Ranged',spell:'Spell',utility:'Utility'};
  return map[String(btnType||'utility').toLowerCase()]||'Utility';
}

/** True when the player can click and afford this ability (mirrors renderActions disable rules). */
function isPlayerAbilityUsable(ab){
  if(!ab || !G.player) return false;
  if(G.turnPhase===TURN.PLAYER && (G.playerActionsThisTurn||0)>=MAX_PLAYER_ACTIONS_PER_TURN) return false;
  if(ab.id==='crowDefend' && G.crowDefendCooldown>0) return false;
  if((ab.id==='swoop' || (ab.id==='sonicDash' && G.player?.birdKey!=='hummingbird')) && G.swoopCooldown>0) return false;
  if((G.player?.birdKey==='hummingbird' || G.player?.birdKey==='firecrest') && HUMMINGBIRD_DASH_ABILITY_IDS.has(ab.id) && G.hummingbirdDashCooldown>0) return false;
  if(G.player?.birdKey==='peregrine' && PEREGRINE_DIVE_ABILITY_IDS.has(ab.id) && G.peregrineDiveCooldown>0) return false;
  if(G.player?.birdKey==='snowyOwl' && SNOWY_OWL_DIVE_ABILITY_IDS.has(ab.id) && G.snowyOwlDiveCooldown>0) return false;
  if(G.player?.birdKey==='robin' && ROBIN_DART_ABILITY_IDS.has(ab.id) && G.robinDartCooldown>0) return false;
  if(G.player?.birdKey==='bowerbird' && BOWERBIRD_LURE_ABILITY_IDS.has(ab.id) && G.bowerbirdLureCooldown>0) return false;
  if(ab.id==='intimidate' && G.intimidateCooldown>0) return false;
  if(getAbilityCooldown(ab.id)>0) return false;
  if(ab.id==='sitAndWait' && G.sitAndWaitUsedThisTurn) return false;
  if(G.autoQueuedAbilityId && ab.id!==G.autoQueuedAbilityId) return false;
  if(G.turnPhase===TURN.PLAYER && !canUseAbility(G.player, ab)) return false;
  return true;
}

function playerHasAffordableAbility(player){
  if(!player?.abilities?.length) return false;
  if(player===G.player){
    if(!canPlayerAct()) return false;
    if((G.playerStatus?.stunned||0)>0) return false;
  }
  return player.abilities.some(ab=>isPlayerAbilityUsable(ab));
}

function canUseCombatItem(itemKey){
  if(!G.player || G.turn!=='player' || G.phase!=='PLAYER' || G.turnPhase!==TURN.PLAYER) return false;
  if(G._combatHealUsedThisTurn) return false;
  if(!canPlayerAct()) return false;
  const def=COMBAT_ITEM_CATALOG[itemKey];
  if(!def || getCombatItemCount(G.player, itemKey)<=0) return false;
  return (G.player.energy||0)>=def.energyCost;
}

function useCombatItem(itemKey){
  const def=COMBAT_ITEM_CATALOG[itemKey];
  if(!def || !G.player) return false;
  if(!canUseCombatItem(itemKey)){
    if(G._combatHealUsedThisTurn) logMsg('Already used a heal item this turn.','miss');
    else if(getCombatItemCount(G.player, itemKey)<=0) logMsg(`No ${def.name} left.`,'miss');
    else logMsg('Not enough energy.','miss');
    return false;
  }
  const fakeAb={ id:'combat_item_'+itemKey, energyCost:def.energyCost, name:def.name };
  spendEnergy(G.player, fakeAb);
  const rawHeal=Math.max(1, Math.floor((G.player.stats.maxHp||1)*(def.healPct||0)));
  const heal=scaleHealForBleed('player', rawHeal);
  G.player.stats.hp=Math.min(G.player.stats.maxHp||1, (G.player.stats.hp||0)+heal);
  setHpBar('player', G.player.stats.hp, G.player.stats.maxHp);
  spawnFloat('player', `+${heal}`, 'fn-heal');
  SFX.heal?.();
  G.player.combatItems[itemKey]--;
  G._combatHealUsedThisTurn=true;
  codexMark('items', itemKey, 'seen');
  codexMark('items', itemKey, 'used');
  logMsg(`${def.name}: restored ${heal} HP (${Math.round((def.healPct||0)*100)}% max, ${def.energyCost} energy).`,'exp-gain');
  renderEnergyOrbs();
  renderCombatItems();
  renderActions();
  refreshBattleUI();
  if((G.player.energy||0)<=0) endPlayerTurn(true);
  return true;
}

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
    btn.innerHTML=`<span class="combat-item-main"><span class="combat-item-icon" aria-hidden="true">${def.icon}</span><span class="combat-item-label">${escapeHtmlRoster(def.name)}</span></span><span class="combat-item-meta">${pct}% · ${def.energyCost} EN · ×${count}</span>`;
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

function renderActions() {
  const grid=document.getElementById('actions-grid');
  if(!grid) return;
  if(!G.player) return;
  if(usesFamilySkillEvolution(G.player)){
    syncPlayerAbilitiesFromSkillSlots(G.player);
    ensureMainAttackAndLoadoutRules();
  }
  grid.innerHTML='';
  renderEnergyOrbs();
  renderCombatItems();
  if(G.player.abilities?.length) enforceAbilityCosts(G.player);
  const locked=!canPlayerAct();
  const endTurnBlocked=!!(G.actionBusy||G.turnPhase===TURN.RESOLVING);
  let allAbilities=[...(G.player.abilities||[])];
  const order={physical:0,ranged:1,spell:2,utility:3};
  allAbilities=allAbilities.sort((a,b)=>{
    return (order[a.btnType]??9)-(order[b.btnType]??9);
  });
  let autoQueued=G.autoQueuedAbilityId||null;
  if(autoQueued){
    const aq=G.player.abilities.find(x=>x.id===autoQueued);
    if(!aq||!canUseAbility(G.player,aq)){G.autoQueuedAbilityId=null;autoQueued=null;}
  }
  allAbilities.forEach((ab,idx)=>{
    const btn=document.createElement('button');
    btn.setAttribute('data-ab-idx',idx);
    btn.setAttribute('data-ab-id',ab.id||'');
    const energyCost=syncAbilityEnergyCost(ab);
    let btnCostText=`${energyCost} EN`;
    let cdisabled=false;
    if (ab.id==='crowDefend') {
      btnCostText=G.crowDefendCooldown>0?`Cooldown:${G.crowDefendCooldown}t`:'Ready';
      cdisabled=G.crowDefendCooldown>0;
    }
    if (ab.id==='swoop' || (ab.id==='sonicDash' && G.player?.birdKey!=='hummingbird')) {
      btnCostText=G.swoopCooldown>0?`Cooldown:${G.swoopCooldown}t`:'Ready';
      cdisabled=G.swoopCooldown>0;
    }
    if ((G.player?.birdKey==='hummingbird' || G.player?.birdKey==='firecrest') && HUMMINGBIRD_DASH_ABILITY_IDS.has(ab.id)) {
      btnCostText=G.hummingbirdDashCooldown>0?`Cooldown:${G.hummingbirdDashCooldown}t`:'Ready';
      cdisabled=G.hummingbirdDashCooldown>0;
    }
    if (G.player?.birdKey==='peregrine' && PEREGRINE_DIVE_ABILITY_IDS.has(ab.id)) {
      btnCostText=G.peregrineDiveCooldown>0?`Cooldown:${G.peregrineDiveCooldown}t`:'Ready';
      cdisabled=G.peregrineDiveCooldown>0;
    }
    if (G.player?.birdKey==='snowyOwl' && SNOWY_OWL_DIVE_ABILITY_IDS.has(ab.id)) {
      btnCostText=G.snowyOwlDiveCooldown>0?`Cooldown:${G.snowyOwlDiveCooldown}t`:'Ready';
      cdisabled=G.snowyOwlDiveCooldown>0;
    }
    if (G.player?.birdKey==='robin' && ROBIN_DART_ABILITY_IDS.has(ab.id)) {
      btnCostText=G.robinDartCooldown>0?`Cooldown:${G.robinDartCooldown}t`:'Ready';
      cdisabled=G.robinDartCooldown>0;
    }
    if (G.player?.birdKey==='bowerbird' && BOWERBIRD_LURE_ABILITY_IDS.has(ab.id)) {
      btnCostText=G.bowerbirdLureCooldown>0?`Cooldown:${G.bowerbirdLureCooldown}t`:'Ready';
      cdisabled=G.bowerbirdLureCooldown>0;
    }
    if (ab.id==='intimidate') {
      btnCostText=G.intimidateCooldown>0?`Cooldown:${G.intimidateCooldown}t`:'Ready';
      cdisabled=G.intimidateCooldown>0;
    }
    if (ab.id==='flyby') {
      btnCostText=G.flybyCharged?'Momentum ready!':'Build momentum';
    }
    if (ab.id==='rockDrop') {
      btnCostText=G.rockDropPending?'Drop armed!':btnCostText;
    }
    const genericCd=getAbilityCooldown(ab.id);
    if(genericCd>0){btnCostText=`Cooldown:${genericCd}t`;cdisabled=true;}
    if (ab.id==='sitAndWait' && G.sitAndWaitUsedThisTurn) { btnCostText='Used this turn'; cdisabled=true; }
    if (ab.id==='stickLance') {
      if (G.stickLanceStage===1) btnCostText='⚔ Strike now!';
      else if (G.stickLanceStage===-1) btnCostText='No stick found';
    }
    if(autoQueued&&ab.id!==autoQueued){cdisabled=true;btnCostText='Auto queued';}
    if(autoQueued&&ab.id===autoQueued){btnCostText='Auto queued';}
    if(!cdisabled && G.turnPhase===TURN.PLAYER && !canUseAbility(G.player,ab)){cdisabled=true;btnCostText=`${energyCost} EN (insufficient)`;}
    btn.disabled=locked||cdisabled;
    btn.title=`${ab.name}\nEnergy: ${energyCost}`;
    const ailDots=(ab.ailmentIds||[]).map(a=>`<div class="ail-dot ${a}"></div>`).join('');
    const dmgTypes=['physical','ranged','spell'];
    const _tmplUI=getAbilityTemplateForUI(ab);
    const effBtn=getEffectiveAbilityBtnType(ab,_tmplUI);
    btn.className=`action-btn ${effBtn}`;
    let modTxt='';
    if(dmgTypes.includes(effBtn)){
      const mods=[];
      if(G.warcryActive) mods.push('⬆ ATK buff');
      if(getWeakenStacks(G.playerStatus)>0) mods.push('⬇ Weakened');
      if(G.playerStatus?.feared) mods.push('⬇ Fear hit penalty');
      if(G.playerStatus?.battleHymn) mods.push('⬆ Hymn buff');
      if(mods.length) modTxt=`<span class=\"btn-mod\" title=\"${mods.join(' | ')}\">${mods.join(' · ')}</span>`;
    }
    const fullDesc=((getAbDesc(ab)||'')+getAbilityDamageScalingHintForUI(ab)).replace(/<[^>]+>/g,'').trim();
    const _dmgEst=estimateSkillDamageRange(ab,_tmplUI,G.player,{isPlayerCombatPreview:true});
    let dmgRow='';
    if(_dmgEst.isDamaging&&_dmgEst.dmgLow!=null){
      if(_dmgEst.hybridSplit){
        const h=_dmgEst.hybridSplit;
        dmgRow=`<div class="btn-dmg-row"><span class="btn-dmg-hybrid" title="Hybrid: ATK-scaling half (red) and M.ATK-scaling half (purple); combat averages the two after DEF/M.DEF.">
          <span class="btn-dmg-atk">ATK ~${h.atkLow}–${h.atkHigh}</span>
          <span class="btn-dmg-matk">MATK ~${h.matkLow}–${h.matkHigh}</span>
        </span></div>`;
      }else dmgRow=`<div class="btn-dmg-row"><span class="btn-dmg-est" title="Estimated damage after enemy DEF/M.DEF (approx.; your buffs included)">Dmg ~${_dmgEst.dmgLow}–${_dmgEst.dmgHigh}</span></div>`;
    }
    const _escMini=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const _statPrev=getSkillStatPreviewLines(ab,_tmplUI);
    const statPrevChip=_statPrev.length?`<span class="btn-stat-preview">${_statPrev.map(l=>_escMini(l)).join(' · ')}</span>`:'';
    const typeLbl=abilityTypeChipLabel(effBtn);
    btn.innerHTML=`
      <div class="btn-head">
        <span class="btn-name">${_escMini(ab.name)}</span>
        <span class="btn-meta">
          <span class="btn-type-chip btn-type-chip--${effBtn}">${typeLbl}</span>
          <span class="btn-en-chip">${_escMini(btnCostText)}</span>
        </span>
      </div>
      ${dmgRow}
      ${fullDesc?`<p class="btn-desc-full">${_escMini(fullDesc)}</p>`:''}
      ${statPrevChip}
      ${modTxt}
      ${ab.level>1?`<span class="ab-lv-badge">Lv${ab.level}</span>`:''}
      ${ailDots?`<div class="ailment-icons">${ailDots}</div>`:''}
      <span class="kb-hint">[${idx+1}]</span>`;
    const currentAb = ()=> (G?.player?.abilities||[]).find(x=>x.id===ab.id) || ab;
    btn.onclick=()=>enqueueAction(()=>{
      const act=globalThis.playerAction||playerAction;
      return act(currentAb(),true);
    });
    // Tooltip - desktop hover + mobile tap toggle
    // Desktop: hover tooltips
    btn.addEventListener('mouseenter',e=>{if(!window._isTouchDevice)showActionTooltip(e,currentAb());});
    btn.addEventListener('mousemove',e=>{if(!window._isTouchDevice)moveTooltip(e);});
    btn.addEventListener('mouseleave',()=>{if(!window._isTouchDevice)hideTooltip();});
    // Mobile: long-press (500ms) shows tooltip; normal tap fires the action
    let _longPressTimer=null;
    btn.addEventListener('touchstart',e=>{
      window._isTouchDevice=true;
      // Start long-press timer - does NOT preventDefault so tap still fires click
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

// ===== TOOLTIPS / SKILL UI RESOLVER =====
/** Resolve template metadata for UI (tooltips, roster, action cards). Matches merged ABILITY_TEMPLATES plus alias source; falls back to partial runtime ability objects. */
function getAbilityTemplateForUI(abOrId){
  const isObj=abOrId&&typeof abOrId==='object';
  const id=isObj?String(abOrId.id||''):String(abOrId||'');
  if(!id) return null;
  const t=ABILITY_TEMPLATES?.[id];
  if(t) return t;
  if(isObj&&(abOrId.name||abOrId.desc||Array.isArray(abOrId.levels))){
    return {
      id,
      name:abOrId.name||id,
      type:abOrId.type||abOrId.btnType||'utility',
      btnType:abOrId.btnType||abOrId.type||'utility',
      desc:abOrId.desc||'',
      levels:Array.isArray(abOrId.levels)&&abOrId.levels.length?abOrId.levels:[{desc:abOrId.desc||''}],
      baseMissChance:abOrId.baseMissChance,
      baseDmgMult:abOrId.baseDmgMult,
      cooldownByLevel:abOrId.cooldownByLevel,
      energyByLevel:abOrId.energyByLevel,
      energyCost:abOrId.energyCost,
      damageScaling:abOrId.damageScaling,
    };
  }
  return null;
}

/** Physical / ranged / spell / utility: derive from combat pack row when available. */
function getEffectiveAbilityBtnType(ab, tmpl){
  const t=tmpl||getAbilityTemplateForUI(ab);
  const packRow=t?._combatPackRow;
  if(typeof globalThis.resolveCombatRowBtnType==='function' && packRow){
    return globalThis.resolveCombatRowBtnType(packRow);
  }
  const fromTmpl=String(t?.btnType||t?.type||'').trim().toLowerCase();
  if(fromTmpl) return fromTmpl;
  return String(ab?.btnType||ab?.type||'').trim().toLowerCase();
}

function estimateMultiplierFromSkillDescription(txt=''){
  const s=String(txt||'');
  const matk=s.match(/(\d+(?:\.\d+)?)\s*%\s*M\.?\s*ATK/i);
  if(matk) return (Number(matk[1])||0)/100;
  const matkCompact=s.match(/(\d+(?:\.\d+)?)\s*%\s*MATK\b/i);
  if(matkCompact) return (Number(matkCompact[1])||0)/100;
  const dmgPer=s.match(/(\d+(?:\.\d+)?)\s*%\s*dmg(?:\s*per\s*hit)?/i);
  if(dmgPer) return (Number(dmgPer[1])||0)/100;
  const multi=s.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*%/i);
  if(multi){
    const hits=Math.max(1,Number(multi[1])||1);
    const pct=Math.max(0,Number(multi[2])||0);
    return (hits*pct)/100;
  }
  const all=s.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
  let bestV=0;
  for(const m of all){
    const v=Number(m[1])||0;
    const pos=m.index??0;
    const slice=s.slice(Math.max(0,pos-22),pos+22);
    if(/miss|skip|fumble|chance to|ailment|poison|burn|bleed|para|confuse|fear|weak|weaken|slow\b|chill|expose|next attack|crit chance|dodge|hum dodge|restore|heal|shield|buff|debuff|−\s*\d+\s*def|def −|−\s*\d+\s*acc|acc −/i.test(slice)&&v<=45) continue;
    if(v>bestV) bestV=v;
  }
  if(bestV>0) return bestV/100;
  return null;
}

function getEffectivePlayerAtkForDamagePreview(){
  const p=G?.player;
  if(!p) return 0;
  let b=Number(p.stats?.atk||0);
  if(G?.warcryActive) b=Math.floor(b*(1+(G.warcryATK||0)/100));
  if(G?.sitAndWaitActive) b=Math.floor(b*1.25);
  if(G?.tookieActive&&G?.playerStatus?.tookie) b=Math.floor(b*(1+(G.playerStatus.tookie.atkBonus||0)/100));
  return b;
}
function getEffectivePlayerOffensiveAtkForPreview(){
  return softenMainStatForCombat(getEffectivePlayerAtkForDamagePreview())*COMBAT_OFFENSIVE_STAT_MULT;
}
function getEffectivePlayerOffensiveMatkForPreview(){
  const m=Number(G?.player?.stats?.matk||8);
  return softenMainStatForCombat(m)*COMBAT_OFFENSIVE_STAT_MULT;
}
function getPackRowScaleStatRaw(statKey, stats, isPlayerCombat){
  const key=String(statKey||'ATK').toUpperCase();
  const s=stats||(isPlayerCombat&&G?.player?.stats)||{};
  if(key==='MATK') return Number(s.matk||8);
  if(key==='SPD') return Number(s.spd||0);
  if(key==='DEF') return Number(s.def||0);
  if(key==='MDEF') return Number(s.mdef||0);
  if(key==='ACC') return Number(s.acc||0);
  if(key==='DODGE') return Number(s.dodge||0);
  if(key==='ATK'&&isPlayerCombat&&G?.player) return getEffectivePlayerAtkForDamagePreview();
  return Number(s.atk||0);
}
function packRowScaleContribution(scaleStat, scalePct, stats, isPlayerCombat){
  const pct=Number(scalePct)||0;
  if(pct<=0) return 0;
  const raw=getPackRowScaleStatRaw(scaleStat, stats, isPlayerCombat);
  return raw*(pct/100);
}

/** `${birdKey}::${abilityId}` → mult[] parsed from that bird's SKILL_ACTION_OVERRIDES (avoids shared id clashes e.g. dart). */
const STRIKE_PREVIEW_MULT_SCOPED=Object.create(null);
function registerStrikePreviewForBird(birdKey, overrideMap){
  if(!birdKey||!overrideMap||typeof overrideMap!=='object') return;
  const prefix=`${birdKey}::`;
  for(const id of Object.keys(overrideMap)){
    const fn=overrideMap[id];
    if(typeof fn!=='function') continue;
    const src=Function.prototype.toString.call(fn);
    const m=src.match(/\bmult\s*:\s*(\[[0-9.,\s]+\])/);
    if(!m) continue;
    let arr;
    try{ arr=JSON.parse(m[1]); }catch(_){ continue; }
    if(!Array.isArray(arr)||!arr.length) continue;
    STRIKE_PREVIEW_MULT_SCOPED[prefix+id]=arr;
  }
}
function getStrikePreviewMultiplierForAbility(abilityId, lv, attacker){
  const bk=(attacker&&attacker.birdKey)||G?.player?.birdKey||'';
  if(!bk||!abilityId) return null;
  const table=STRIKE_PREVIEW_MULT_SCOPED[`${bk}::${abilityId}`];
  if(!table||!table.length) return null;
  const i=Math.max(0,Math.min(Math.max(1,Number(lv)||1)-1,table.length-1));
  const v=table[i];
  return Number.isFinite(Number(v))?Number(v):null;
}

/** Hybrid = (physical half + matk half) / 2 in combat; spec matches each family's formula. */
function getHybridPreviewSpec(ab, lv){
  const id=ab?.id;
  if(!id) return null;
  const canon=(typeof resolveAbilityAliasSourceId==='function')?resolveAbilityAliasSourceId(id):id;
  const fn=ACTIONS[canon]||ACTIONS[id];
  if(typeof fn!=='function') return null;
  const s=Function.prototype.toString.call(fn);
  const hybridM=s.match(/\bhybrid\s*:\s*(\[[0-9.,\s]+\])/);
  let hybridLv=false;
  if(hybridM){
    try{
      const arr=JSON.parse(hybridM[1]);
      const i=Math.max(0,Math.min((lv||1)-1,arr.length-1));
      hybridLv=!!Number(arr[i]);
    }catch(_){}
  }
  const kindH=/damageKind\s*:\s*['"]hybrid['"]/.test(s);
  if(!hybridLv && !kindH) return null;
  if(/executeCrowStrikeAction/.test(s) && kindH) return {phys:'plain',m0:0.75,m1:0.9};
  if(/executeBlackbirdPeckAction/.test(s) && kindH) return {phys:'plain',m0:0.8,m1:0.9};
  if(/executeBlackbirdSpellAction/.test(s) && kindH) return {phys:'plain',m0:0.8,m1:0.92};
  if(/executeSnowyOwlTalonStrike/.test(s) && hybridLv) return {phys:'plain',m0:0.55,m1:0.5};
  if(/executeSnowyOwlDiveStrike|executePeregrineDiveStrike|executeHummingbirdDashStrike/.test(s) && hybridLv) return {phys:'scaling',m0:0.55,m1:0.52};
  if(hybridLv) return {phys:'scaling',m0:0.55,m1:0.52};
  if(kindH) return {phys:'plain',m0:0.75,m1:0.9};
  return null;
}

function estimateHybridSplitBands(tmpl,ab,physMult,multCore,lv,spec,opts,pendingMatkAdd){
  opts=opts||{};
  const applyMit=opts.applyMitigation!==false;
  const scaleStat=getEffectivePlayerOffensiveAtkForPreview();
  let atkLo, atkHi;
  if(spec.phys==='scaling' && tmpl?.damageScaling && G?.player){
    const sc=tmpl.damageScaling;
    let baseLo=Math.max(1,Math.floor(scaleStat*0.8*physMult));
    let baseHi=Math.max(1,Math.floor(scaleStat*1.2*physMult));
    let secLo=0, secHi=0;
    if(sc.secondaryScaler&&Number(sc.secondaryScaleValue)>0){
      const pstats=G.player.stats||{};
      const scn=String(sc.secondaryScaler).toUpperCase();
      let statv=0;
      if(scn==='SPD') statv=Number(pstats.spd||0);
      else if(scn==='DEF') statv=Number(pstats.def||0);
      else if(scn==='MATK'||scn==='MATT') statv=Number(pstats.matk||0);
      const eff=softenMainStatForCombat(statv)*COMBAT_OFFENSIVE_STAT_MULT;
      const core=eff*Number(sc.secondaryScaleValue)*physMult;
      secLo=Math.max(0,Math.floor(core*0.82));
      secHi=Math.max(0,Math.floor(core*1.18));
    }
    atkLo=applyConditionalPhysicalDamageMultipliers(baseLo+secLo, sc.conditionalBonuses);
    atkHi=applyConditionalPhysicalDamageMultipliers(baseHi+secHi, sc.conditionalBonuses);
  }else{
    atkLo=Math.max(1,Math.floor(scaleStat*0.8*physMult));
    atkHi=Math.max(atkLo,Math.floor(scaleStat*1.2*physMult));
  }
  if(getWeakenStacks(G?.playerStatus)>0){
    const wm=getWeakenDamageMult(getWeakenStacks(G.playerStatus));
    atkLo=Math.max(1,Math.floor(atkLo*wm));
    atkHi=Math.max(1,Math.floor(atkHi*wm));
  }
  if(applyMit&&G?.enemy){
    const en=G.enemy.stats||G.enemy;
    const pierce=getPhysicalPierceFractionForPreview(ab);
    const guard=physicalGuardValueFromEnemyDef(Number(en.def||0),pierce);
    const mul=damageMitigationMultiplierFromGuard(guard);
    atkLo=Math.max(1,Math.floor(atkLo*mul));
    atkHi=Math.max(1,Math.floor(atkHi*mul));
  }
  let mInner=Math.max(spec.m0, multCore*spec.m1);
  if(pendingMatkAdd) mInner+=pendingMatkAdd;
  const effM=getEffectivePlayerOffensiveMatkForPreview();
  let mLo=Math.max(1,Math.floor(effM*0.8));
  let mHi=Math.max(1,Math.floor(effM*1.2));
  if(getWeakenStacks(G?.playerStatus)>0){ const wm=getWeakenDamageMult(getWeakenStacks(G.playerStatus)); mLo=Math.max(1,Math.floor(mLo*wm)); mHi=Math.max(1,Math.floor(mHi*wm)); }
  const smult=mInner;
  let matkLo=Math.max(1,Math.floor(mLo*smult));
  let matkHi=Math.max(matkLo,Math.floor(mHi*smult));
  if(applyMit&&G?.enemy){
    const gM=magicalGuardValueFromEnemyMdef(Number(G.enemy.stats.mdef??8));
    const mul=damageMitigationMultiplierFromGuard(gM);
    matkLo=Math.max(1,Math.floor(matkLo*mul));
    matkHi=Math.max(1,Math.floor(matkHi*mul));
  }
  return {atkLow:atkLo, atkHigh:atkHi, matkLow:matkLo, matkHigh:matkHi};
}

/**
 * Rough damage band for UI. Player preview: matches pdmg/matk (soft cap ×0.75 offensive), pending strike mult, weaken,
 * and mitigation via soften + guard ×0.80 and pierce (preview uses template pierce; combat uses G._currentPiercePct too).
 * Pass attacker as {stats:{atk,matk}} for enemies; opts.isPlayerCombatPreview false skips player-only modifiers.
 */
function estimateSkillDamageRange(ab,tmpl,attacker,opts){
  opts=opts||{};
  const isPlayerCombat=opts.isPlayerCombatPreview!==undefined
    ? !!opts.isPlayerCombatPreview
    : !!(G?.player&&attacker===G.player);
  const p=attacker||G?.player;
  const stats=p&&(p.stats||p)||{};
  let pAtk=Number(stats.atk||0);
  let pMatk=Number(stats.matk||8);
  if(isPlayerCombat&&G?.player){
    pAtk=getEffectivePlayerAtkForDamagePreview();
    pMatk=Number(G.player.stats?.matk||8);
  }
  if(!tmpl) return {isDamaging:false,dmgLow:null,dmgHigh:null,btnType:'',hybridSplit:null,lv:1,lvData:null};
  const btnType=getEffectiveAbilityBtnType(ab,tmpl);
  const isDamaging=['physical','ranged','spell'].includes(btnType);
  const levels=Array.isArray(tmpl.levels)?tmpl.levels:[];
  const lv=Math.max(1,Math.min(ab?.level||1,levels.length||1));
  const lvData=levels[lv-1]||{desc:(ab?.desc||tmpl.desc||'')};
  if(!isDamaging){
    return {isDamaging:false,dmgLow:null,dmgHigh:null,btnType,lv,lvData,hybridSplit:null};
  }
  const packRow=tmpl._combatPackRow;
  if(packRow&&!packRow.noDamage){
    const previewStats=isPlayerCombat&&G?.player?G.player.stats:stats;
    let raw=typeof computeAbilityRawDamage==='function'
      ? computeAbilityRawDamage(packRow, previewStats)
      : (Number(packRow.baseFlat)||0)+packRowScaleContribution(packRow.scaleStat,packRow.scalePct,previewStats,isPlayerCombat)
        +(packRow.secondaryScaleStat?packRowScaleContribution(packRow.secondaryScaleStat,packRow.secondaryScalePct,previewStats,isPlayerCombat):0);
    const hits=Math.max(1,Number(packRow.hits)||1);
    let perHit=Math.max(1, Math.round(raw));
    if(isPlayerCombat&&G?._pendingStrikeActionMods){
      const add=Number(G._pendingStrikeActionMods.multAdd)||0;
      if(add>0) perHit=roundCombatDamage(perHit*(1+add));
    }
    if(isPlayerCombat&&getWeakenStacks(G?.playerStatus)>0){
      perHit=roundCombatDamage(perHit*getWeakenDamageMult(getWeakenStacks(G.playerStatus)));
    }
    const applyMit=opts.applyMitigation!==false;
    if(applyMit&&isPlayerCombat&&G?.enemy){
      const en=G.enemy.stats||G.enemy;
      const pierce=['physical','ranged'].includes(btnType)
        ? getPhysicalPierceFractionForPreview(ab)
        : getMagicalPierceFractionForPreview(ab);
      const rawDef=['physical','ranged'].includes(btnType)?Number(en.def||0):Number(en.mdef??8);
      const effDef=effectiveDefence(rawDef,pierce,{burning:enemyHasBurning()});
      perHit=Math.max(0.01, roundCombatDamage(typeof mitigatedDamage==='function'?mitigatedDamage(perHit,effDef):perHit*curvedDefenceMultiplier(effDef)));
    }
    const dmgLow=perHit*hits;
    const dmgHigh=dmgLow;
    return {isDamaging,dmgLow,dmgHigh,btnType,lv,lvData,hybridSplit:null};
  }
  const scaleStat=(btnType==='spell')
    ? (isPlayerCombat&&G?.player ? getEffectivePlayerOffensiveMatkForPreview() : softenMainStatForCombat(pMatk)*COMBAT_OFFENSIVE_STAT_MULT)
    : (isPlayerCombat&&G?.player ? getEffectivePlayerOffensiveAtkForPreview() : softenMainStatForCombat(pAtk)*COMBAT_OFFENSIVE_STAT_MULT);
  let dmgMult=(tmpl.baseDmgMult!==undefined)?(Number(tmpl.baseDmgMult)||0)+0.1*(lv-1):null;
  if(!(dmgMult>0)){
    dmgMult=estimateMultiplierFromSkillDescription(lvData?.desc||'')??estimateMultiplierFromSkillDescription(tmpl?.desc||'');
  }
  if(!(dmgMult>0)) return {isDamaging:true,dmgLow:null,dmgHigh:null,btnType,lv,lvData,hybridSplit:null};
  const strikePrev=getStrikePreviewMultiplierForAbility(ab?.id,lv,p);
  if(strikePrev!=null) dmgMult=strikePrev;
  const multCore=dmgMult;
  let physMult=multCore;
  let pendingMatkAdd=0;
  if(isPlayerCombat&&G?._pendingStrikeActionMods){
    const add=Number(G._pendingStrikeActionMods.multAdd)||0;
    const mAdd=G._pendingStrikeActionMods.matkMultAdd!=null?Number(G._pendingStrikeActionMods.matkMultAdd):add;
    pendingMatkAdd=mAdd;
    if(btnType==='spell'){
      dmgMult=multCore+mAdd;
      physMult=multCore+add;
    }else{
      dmgMult=multCore+add;
      physMult=dmgMult;
    }
  }
  const hySpec=(isPlayerCombat&&G?.player&&G?.enemy)?getHybridPreviewSpec(ab,lv):null;
  if(hySpec&&isDamaging&&isPlayerCombat&&G?.player&&G?.enemy){
    const hb=estimateHybridSplitBands(tmpl,ab,physMult,multCore,lv,hySpec,opts,pendingMatkAdd);
    const combinedL=Math.max(1,Math.floor((hb.atkLow+hb.matkLow)/2));
    const combinedH=Math.max(combinedL,Math.floor((hb.atkHigh+hb.matkHigh)/2));
    return {isDamaging,dmgLow:combinedL,dmgHigh:combinedH,btnType,lv,lvData,hybridSplit:hb};
  }
  let dmgLow=null,dmgHigh=null;
  if(isDamaging){
    if(btnType==='spell'&&isPlayerCombat&&G?.player&&G?.enemy){
      const effM=getEffectivePlayerOffensiveMatkForPreview();
      let mLo=Math.max(1,Math.floor(effM*0.8));
      let mHi=Math.max(1,Math.floor(effM*1.2));
      if(getWeakenStacks(G?.playerStatus)>0){ const wm=getWeakenDamageMult(getWeakenStacks(G.playerStatus)); mLo=Math.max(1,Math.floor(mLo*wm)); mHi=Math.max(1,Math.floor(mHi*wm)); }
      const mult=dmgMult;
      dmgLow=Math.max(1,Math.floor(mLo*mult));
      dmgHigh=Math.max(dmgLow,Math.floor(mHi*mult));
    }else if(isPlayerCombat&&['physical','ranged'].includes(btnType)&&tmpl.damageScaling&&G?.player){
      const sc=tmpl.damageScaling;
      let baseLo=Math.max(1,Math.floor(scaleStat*0.8*dmgMult));
      let baseHi=Math.max(1,Math.floor(scaleStat*1.2*dmgMult));
      let secLo=0, secHi=0;
      if(sc.secondaryScaler&&Number(sc.secondaryScaleValue)>0){
        const pstats=G.player.stats||{};
        const scn=String(sc.secondaryScaler).toUpperCase();
        let statv=0;
        if(scn==='SPD') statv=Number(pstats.spd||0);
        else if(scn==='DEF') statv=Number(pstats.def||0);
        else if(scn==='MATK'||scn==='MATT') statv=Number(pstats.matk||0);
        const eff=softenMainStatForCombat(statv)*COMBAT_OFFENSIVE_STAT_MULT;
        const core=eff*Number(sc.secondaryScaleValue)*dmgMult;
        secLo=Math.max(0,Math.floor(core*0.82));
        secHi=Math.max(0,Math.floor(core*1.18));
      }
      dmgLow=applyConditionalPhysicalDamageMultipliers(baseLo+secLo, sc.conditionalBonuses);
      dmgHigh=applyConditionalPhysicalDamageMultipliers(baseHi+secHi, sc.conditionalBonuses);
    }else{
      dmgLow=Math.max(1,Math.floor(scaleStat*0.8*dmgMult));
      dmgHigh=Math.max(dmgLow,Math.floor(scaleStat*1.2*dmgMult));
    }
  }
  if(isPlayerCombat&&['physical','ranged'].includes(btnType)&&getWeakenStacks(G?.playerStatus)>0){
    const wm=getWeakenDamageMult(getWeakenStacks(G.playerStatus));
    if(dmgLow!=null) dmgLow=roundCombatDamage(dmgLow*wm);
    if(dmgHigh!=null) dmgHigh=roundCombatDamage(dmgHigh*wm);
  }
  const applyMit=opts.applyMitigation!==false;
  if(applyMit&&isPlayerCombat&&G?.enemy&&isDamaging){
    const en=G.enemy.stats||G.enemy;
    if(btnType==='spell'){
      const pierce=getMagicalPierceFractionForPreview(ab);
      const gM=magicalGuardValueFromEnemyMdef(Number(en.mdef??8),pierce);
      const mul=damageMitigationMultiplierFromGuard(gM);
      if(dmgLow!=null) dmgLow=roundCombatDamage(dmgLow*mul);
      if(dmgHigh!=null) dmgHigh=roundCombatDamage(dmgHigh*mul);
    }else if(['physical','ranged'].includes(btnType)){
      const pierce=getPhysicalPierceFractionForPreview(ab);
      const guard=physicalGuardValueFromEnemyDef(Number(en.def||0),pierce);
      const mul=damageMitigationMultiplierFromGuard(guard);
      if(dmgLow!=null) dmgLow=roundCombatDamage(dmgLow*mul);
      if(dmgHigh!=null) dmgHigh=roundCombatDamage(dmgHigh*mul);
    }
  }
  return {isDamaging,dmgLow,dmgHigh,btnType,lv,lvData,hybridSplit:null};
}

function snowyOwlEyeStatPreviewLines(ab){
  const lv=Math.max(1,Math.min(4,ab?.level||1));
  const i=lv-1;
  const id=ab?.id||'';
  if(id==='owl_eye') return [`Next attack +${Math.round(([0.14,0.17,0.20,0.23][i]||0.14)*100)}% damage`];
  if(id==='owl_hunters_sight') return [`Next attack +${Math.round(([0.20,0.24,0.28,0.32][i]||0.20)*100)}% damage`];
  if(id==='moon_lock') return [`Next attack +${Math.round(([0.28,0.32,0.36,0.40][i]||0.28)*100)}% damage`];
  if(id==='expose_prey') return [`Enemy −${[1,2,2,3][i]||1} DEF (${[2,2,3,3][i]||2}t)`];
  if(id==='owl_weakpoint_sight') return [`Enemy −${[2,3,4,5][i]||2} DEF (${[2,3,3,4][i]||2}t)`];
  if(id==='owl_ruin_lock') return [`Enemy −${[3,4,5,6][i]||3} DEF (${[3,3,4,4][i]||3}t)`];
  if(id==='cold_eye') return [`Your attacks +${[8,12,16,20][i]||8}% crit (${[2,2,3,3][i]||2}t)`];
  if(id==='owl_killer_sight') return [`Your attacks +${[12,16,20,24][i]||12}% crit (${[2,3,3,3][i]||2}t)`];
  if(id==='owl_death_lock') return [`Your attacks +${[16,20,24,28][i]||16}% crit (${[3,3,3,4][i]||3}t)`];
  return [];
}
function snowyOwlGlideStatPreviewLines(ab){
  const lv=Math.max(1,Math.min(4,ab?.level||1));
  const i=lv-1;
  const id=ab?.id||'';
  if(id==='frost_glide'){
    return [
      `Hum dodge +${[10,12,14,16][i]}% (2–3t; branch may trade for slow/weaken)`,
      `Baseline: enemy SPD −1, dodge −${5+(i>=2?1:0)} (2t)`,
    ];
  }
  if(id==='silent_glide') return [`Hum dodge +${[28,32,36,40][i]}% (${[2,2,3,3][i]}t)`];
  if(id==='ghost_drift') return [`Hum dodge +${[38,42,46,50][i]}% (${[2,3,3,3][i]}t)`];
  if(id==='snow_silence') return [`Hum dodge +${[48,52,56,60][i]}% (3t) · Enemy ACC −${[10,12,14,16][i]}%`];
  if(id==='winter_drift') return [`Enemy slow SPD −${3}, dodge −10 (3t) · Weaken ${[20,24,28,32][i]}%`];
  if(id==='white_silence') return [`Heavy slow + Weaken ${[28,32,36,40][i]}% · Enemy ACC −${[6,8,10,12][i]}%`];
  if(id==='hunting_glide') return [`Next attack +${Math.round(([0.10,0.13,0.16,0.19][i]||0.10)*100)}% damage`];
  if(id==='shadow_drift') return [`Next attack +${Math.round(([0.16,0.20,0.24,0.28][i]||0.16)*100)}% · light slow`];
  if(id==='night_silence') return [`Next attack +${Math.round(([0.24,0.28,0.32,0.36][i]||0.24)*100)}% · Hum dodge +${[14,16,18,20][i]}% (2t)`];
  return [];
}

/** Curated "current → after" lines for major buff utilities (tooltip only). */
const SKILL_STAT_PREVIEW={
  windFeint(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const bonus=[20,25,30,35][lv-1]||20;
    const turns=[2,2,2,3][lv-1]||2;
    const cur=Math.round(Number(p?.stats?.dodge||0));
    return [`Dodge: ${cur}% → ${cur+bonus}% (${turns}t)`];
  },
  evade(p,ab){ return SKILL_STAT_PREVIEW.windFeint(p,ab); },
  tailwindFeint(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const spd=[2,3,4,5][lv-1]||2;
    const cur=Math.round(Number(p?.stats?.spd||0));
    return [`SPD: ${cur} → ${cur+spd} (2t)`];
  },
  crowDefend(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const defGain=[2,3,4,5][lv-1]||2;
    const cur=Math.round(Number(p?.stats?.def||0));
    return [`DEF: ${cur} → ${cur+defGain} (1t)`];
  },
  gloom_wing(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const dodge=[20,24,28,32][lv-1]||20;
    const cur=Math.round(Number(p?.stats?.dodge||0));
    return [`Dodge: ${cur}% → ${cur+dodge}% (2t)`];
  },
  battle_focus(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=[12,15,18,21][lv-1]||12;
    return [`Next hit: +${pct}% damage (until used)`];
  },
  battleFocus(p,ab){ return SKILL_STAT_PREVIEW.battle_focus(p,ab); },
  focusChirp(p,ab){ return SKILL_STAT_PREVIEW.battle_focus(p,ab); },
  keen_eye(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.15,0.18,0.21,0.24][lv-1]||0.15)*100);
    return [`Next attack +${pct}% damage`];
  },
  hunters_sight(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.22,0.26,0.30,0.34][lv-1]||0.22)*100);
    return [`Next attack +${pct}% damage`];
  },
  fatal_lock(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.30,0.34,0.38,0.42][lv-1]||0.30)*100);
    return [`Next attack +${pct}% damage`];
  },
  expose_flight(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const lost=[1,2,2,3][lv-1]||1; const turns=[2,2,3,3][lv-1]||2;
    return [`Enemy −${lost} DEF (${turns}t)`];
  },
  weakpoint_sight(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const lost=[2,3,4,5][lv-1]||2; const turns=[2,3,3,4][lv-1]||2;
    return [`Enemy −${lost} DEF (${turns}t)`];
  },
  ruin_lock(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const lost=[3,4,5,6][lv-1]||3; const turns=[3,3,4,4][lv-1]||3;
    return [`Enemy −${lost} DEF (${turns}t)`];
  },
  predatory_eye(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const cr=[10,14,18,22][lv-1]||10; const t=[2,2,3,3][lv-1]||2;
    return [`Your attacks +${cr}% crit (${t}t)`];
  },
  killer_sight(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const cr=[14,18,22,26][lv-1]||14; const t=[2,3,3,3][lv-1]||2;
    return [`Your attacks +${cr}% crit (${t}t)`];
  },
  death_lock(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const cr=[18,22,26,30][lv-1]||18; const t=[3,3,3,4][lv-1]||3;
    return [`Your attacks +${cr}% crit (${t}t)`];
  },
  aerial_pace(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const spd=[1,1,2,2][lv-1]||1; const dg=[12,14,16,18][lv-1]||12; const t=[2,2,2,2][lv-1]||2;
    const cs=Math.round(Number(p?.stats?.spd||0)); const cd=Math.round(Number(p?.stats?.dodge||0));
    return [`SPD ${cs}→${cs+spd} · Dodge ${cd}%→${cd+dg}% (${t}t)`];
  },
  rapid_pace(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const spd=[2,3,4,5][lv-1]||2; const t=[2,2,2,3][lv-1]||2;
    const cs=Math.round(Number(p?.stats?.spd||0));
    return [`SPD ${cs}→${cs+spd} (${t}t)`];
  },
  glide_burst(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const spd=[4,5,6,7][lv-1]||4; const dg=[8,10,12,14][lv-1]||8; const t=[2,2,3,3][lv-1]||2;
    const cs=Math.round(Number(p?.stats?.spd||0)); const cd=Math.round(Number(p?.stats?.dodge||0));
    return [`SPD ${cs}→${cs+spd} · Dodge ${cd}%→${cd+dg}% (${t}t)`];
  },
  stoop_tempo(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const spd=[3,4,5,6][lv-1]||3; const ad=[8,10,12,14][lv-1]||8; const t=[2,2,2,3][lv-1]||2;
    const cs=Math.round(Number(p?.stats?.spd||0));
    return [`SPD ${cs}→${cs+spd} · Enemy ACC −${ad}% (${t}t)`];
  },
  slip_pace(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const dg=[30,34,38,42][lv-1]||30; const t=[2,2,3,3][lv-1]||2;
    const cd=Math.round(Number(p?.stats?.dodge||0));
    return [`Dodge ${cd}%→${cd+dg}% (${t}t)`];
  },
  ghost_glide(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const dg=[40,44,48,52][lv-1]||40; const t=[2,3,3,3][lv-1]||2;
    const cd=Math.round(Number(p?.stats?.dodge||0));
    return [`Dodge ${cd}%→${cd+dg}% (${t}t)`];
  },
  phantom_stoop(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const dg=[50,54,58,62][lv-1]||50; const t=[3,3,3,3][lv-1]||3;
    const cd=Math.round(Number(p?.stats?.dodge||0));
    return [`Dodge ${cd}%→${cd+dg}% + slow (${t}t)`];
  },
  hunting_pace(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.10,0.12,0.14,0.16][lv-1]||0.10)*100);
    const t=[2,2,2,3][lv-1]||2;
    return [`Next Dive-line hit +${pct}% dmg (${t}t)`];
  },
  falling_glide(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.14,0.16,0.18,0.20][lv-1]||0.14)*100);
    const t=[2,2,3,3][lv-1]||2;
    return [`Next Dive-line hit +${pct}% dmg (${t}t)`];
  },
  kill_stoop(p,ab){
    const lv=Math.max(1,Math.min(4,ab?.level||1));
    const pct=Math.round(([0.18,0.22,0.26,0.30][lv-1]||0.18)*100);
    const t=[3,3,3,3][lv-1]||3;
    return [`Next Dive-line hit +${pct}% dmg (${t}t)`];
  },
  owl_eye(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  owl_hunters_sight(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  moon_lock(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  expose_prey(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  owl_weakpoint_sight(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  owl_ruin_lock(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  cold_eye(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  owl_killer_sight(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  owl_death_lock(p,ab){ return snowyOwlEyeStatPreviewLines(ab); },
  frost_glide(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  silent_glide(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  ghost_drift(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  snow_silence(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  winter_drift(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  white_silence(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  hunting_glide(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  shadow_drift(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
  night_silence(p,ab){ return snowyOwlGlideStatPreviewLines(ab); },
};

function _previewPickArrayFromSource(src, key){
  if(!src||!key) return null;
  const re=new RegExp('\\b'+key+'\\s*:\\s*(\\[[0-9.,\\s]+\\])');
  const m=String(src).match(re);
  if(!m) return null;
  try{
    const a=JSON.parse(m[1]);
    return Array.isArray(a)?a:null;
  }catch(_){ return null; }
}
/** Numeric utility lines from SKILL_ACTION_OVERRIDES config literals (any bird). */
function buildGenericUtilityStatPreviewFromAction(ab,tmpl){
  const lines=[];
  if(!G?.player) return lines;
  const btn=String(tmpl?.btnType||tmpl?.type||ab?.btnType||'').toLowerCase();
  if(btn!=='utility') return lines;
  const id=ab?.id;
  if(!id) return lines;
  const canon=(typeof resolveAbilityAliasSourceId==='function')?resolveAbilityAliasSourceId(id):id;
  const actFn=ACTIONS[canon]||ACTIONS[id];
  if(typeof actFn!=='function') return lines;
  const src=Function.prototype.toString.call(actFn);
  const lv=Math.max(1,Math.min(4,ab?.level||1));
  const i=lv-1;
  const pick=(key)=>_previewPickArrayFromSource(src,key);
  const turns=pick('turns');
  const humTurns=pick('humTurns');
  const tTurn=turns&&turns[i]!=null?turns[i]:(humTurns&&humTurns[i]!=null?humTurns[i]:null);
  const fmtT=tTurn!=null?` (${tTurn}t)`:'';

  const bonus=pick('bonus');
  if(bonus&&bonus[i]!=null){
    const cur=Math.round(Number(G.player.stats?.dodge||0));
    lines.push(`Dodge: ${cur}% → ${cur+bonus[i]}%${fmtT}`);
  }
  const spd=pick('spd');
  const dodge=pick('dodge');
  if(spd&&spd[i]!=null){
    const cs=Math.round(Number(G.player.stats?.spd||0));
    if(dodge&&dodge[i]!=null&&dodge[i]>0){
      const cd=Math.round(Number(G.player.stats?.dodge||0));
      lines.push(`SPD ${cs}→${cs+spd[i]} · Dodge ${cd}%→${cd+dodge[i]}%${fmtT}`);
    }else lines.push(`SPD: ${cs} → ${cs+spd[i]}${fmtT}`);
  }else if(dodge&&dodge[i]!=null&&dodge[i]>0){
    const cd=Math.round(Number(G.player.stats?.dodge||0));
    lines.push(`Dodge ${cd}%→${cd+dodge[i]}%${fmtT}`);
  }

  const amp=pick('amp');
  if(amp&&amp[i]!=null) lines.push(`Next hit +${Math.round(amp[i]*100)}% damage${fmtT}`);
  const markAmp=pick('markAmp');
  if(markAmp&&markAmp[i]!=null) lines.push(`Next hit +${Math.round(markAmp[i]*100)}% damage${fmtT}`);
  const accDown=pick('accDown');
  if(accDown&&accDown[i]!=null) lines.push(`Enemy ACC −${accDown[i]}%${fmtT}`);
  const guard=pick('guard');
  if(guard&&guard[i]!=null) lines.push(`Defend +${guard[i]} (guard stacks)${fmtT}`);
  const humDodge=pick('humDodge');
  if(humDodge&&humDodge[i]!=null){
    const ht=humTurns&&humTurns[i]!=null?humTurns[i]:tTurn;
    lines.push(`Hum dodge +${humDodge[i]}%${ht!=null?` (${ht}t)`:''}`);
  }
  const expose=pick('expose');
  if(expose&&expose[i]!=null) lines.push(`Enemy +${Math.round(expose[i]*100)}% damage taken${fmtT}`);
  const defStrip=pick('defStrip');
  if(defStrip&&defStrip[i]!=null) lines.push(`Enemy −${defStrip[i]} DEF${fmtT}`);
  const energy=pick('energy');
  if(energy&&energy[i]!=null) lines.push(`On hit: +${energy[i]} EN`);
  const stripBuffs=pick('stripBuffs');
  if(stripBuffs&&stripBuffs[i]!=null&&stripBuffs[i]>0) lines.push(`Steal up to ${stripBuffs[i]} enemy buff(s)`);

  return lines.slice(0,5);
}

function getSkillStatPreviewLines(ab,tmpl){
  const id=ab?.id;
  if(!id||!G?.player) return [];
  const canon=(typeof resolveAbilityAliasSourceId==='function')?resolveAbilityAliasSourceId(id):id;
  const keys=[id,canon].filter((k,i,a)=>k&&a.indexOf(k)===i);
  for(const key of keys){
    const fn=SKILL_STAT_PREVIEW[key];
    if(typeof fn==='function'){
      try{
        const r=fn(G.player,ab,tmpl)||[];
        if(r.length) return r;
      }catch(_){}
    }
  }
  return buildGenericUtilityStatPreviewFromAction(ab,tmpl);
}

function buildActionTooltipHTML(ab){
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl) return '';
  const levels = Array.isArray(tmpl.levels) ? tmpl.levels : [];
  const lv=Math.max(1, Math.min(ab.level||1, levels.length||1));
  const lvData=levels[lv-1] || {desc: (ab.desc||tmpl.desc||'')};
  const miss=tmpl.baseMissChance!==undefined?Math.max(0,tmpl.baseMissChance-5*(lv-1)):null;
  const hit=miss!==null?100-miss:null;
  const hitClass=hit===null?'':(hit>=80?'tt-hit-great':hit>=55?'tt-hit-good':'tt-hit-bad');
  const energy=getEnergyCost(ab);
  const cooldown=getTemplateCooldown(ab);
  const {isDamaging,dmgLow,dmgHigh,btnType,hybridSplit}=estimateSkillDamageRange(ab,tmpl,G.player,{isPlayerCombatPreview:true});
  const effectList=(ab.ailmentIds||[]).length?ab.ailmentIds.map(a=>a.replace(/_/g,' ')).join(', '):'—';

  let html=`<div class="tt-name">${tmpl.name}</div><div class="tt-type">${tmpl.type} · Lv${ab.level}</div>`;
  html+=`<div class="tt-row"><span class="tt-lbl">Energy</span><span class="tt-val">${energy}</span></div>`;
  html+=`<div class="tt-row"><span class="tt-lbl">Cooldown</span><span class="tt-val">${cooldown>0?cooldown+' turn'+(cooldown>1?'s':''):'None'}</span></div>`;
  if (hit!==null) html+=`<div class="tt-row"><span class="tt-lbl">Hit</span><span class="tt-val ${hitClass}">${hit}%</span></div>`;
  if (isDamaging) {
    if(hybridSplit){
      html+=`<div class="tt-row"><span class="tt-lbl">ATK half (est.)</span><span class="tt-val tt-dmg-atk">${hybridSplit.atkLow}–${hybridSplit.atkHigh}</span></div>`;
      html+=`<div class="tt-row"><span class="tt-lbl">M.ATK half (est.)</span><span class="tt-val tt-dmg-matk">${hybridSplit.matkLow}–${hybridSplit.matkHigh}</span></div>`;
      html+=`<div class="tt-row"><span class="tt-lbl">Combined (avg.)</span><span class="tt-val">${dmgLow!==null?`${dmgLow}–${dmgHigh}`:'Varies'}</span></div>`;
    }else html+=`<div class="tt-row"><span class="tt-lbl">Damage (est.)</span><span class="tt-val">${dmgLow!==null?`${dmgLow}–${dmgHigh}`:'Varies'}</span></div>`;
  }
  html+=`<div class="tt-row"><span class="tt-lbl">Effects</span><span class="tt-val">${effectList}</span></div>`;
  const statLines=getSkillStatPreviewLines(ab,tmpl);
  for(const line of statLines){
    html+=`<div class="tt-row"><span class="tt-lbl">Stat preview</span><span class="tt-val" style="font-size:.88em">${line}</span></div>`;
  }
  const lsPct=getAbilityLifestealPct(ab);
  if(lsPct>0) html+=`<div class="tt-row"><span class="tt-lbl">Lifesteal</span><span class="tt-val">${lsPct}% of damage dealt</span></div>`;
  const pb=G.playerStatus?.pendingStrikeBuff;
  if(pb && ['physical','ranged','spell'].includes(btnType)){
    const pct=Math.round((Number(pb.multAdd)||0)*100);
    const hb=Number(pb.hitBonus)||0;
    const cb=Number(pb.critBonus)||0;
    const bits=[];
    if(pct) bits.push(`+${pct}% ATK-scaling damage`);
    if(hb) bits.push(`−${hb}% miss on that action`);
    if(cb) bits.push(`+${cb}% crit on that action`);
    if(bits.length) html+=`<div class="tt-row"><span class="tt-lbl">Queued</span><span class="tt-val" style="font-size:.88em">${bits.join(' · ')}</span></div>`;
  }
  const scaleNote=tmpl.damageScaling?.scalingNote;
  html+=`<div class="tt-desc">${lvData.desc}${scaleNote?`<div class="tt-scaling" style="opacity:.92;margin-top:6px;font-size:.9em;border-top:1px solid rgba(255,255,255,.12);padding-top:6px">${scaleNote}</div>`:''}</div>`;
  html+=`<div class="tt-note" style="opacity:.75;margin-top:6px;font-size:.78em">Damage estimate uses your current stats, skill tier mults, DEF/M.DEF mitigation, and common buffs — combat rolls can vary.</div>`;
  if(window._isTouchDevice) html+=richTooltipCloseBtn();
  return html;
}

// ===== TOOLTIPS =====
function showActionTooltip(e,ab) {
  if(!tooltipsEnabled('abilities')) return;
  const tt=document.getElementById('action-tooltip');
  const html=buildActionTooltipHTML(ab);
  if (!html) return;
  tt.innerHTML=html;
  tt.style.display='block';
  tt.classList.toggle('is-touch-open', !!window._isTouchDevice);
  positionTooltip(e);
}
function positionTooltip(e) {
  const tt=document.getElementById('action-tooltip');
  if(window._isTouchDevice){
    // Center on screen for mobile
    tt.style.left='50%'; tt.style.top='50%';
    tt.style.transform='translate(-50%,-50%)';
    tt.style.position='fixed';
  } else {
    tt.style.transform='';
    moveTooltip(e);
  }
}
// Accepts either (event) OR (x,y). Desktop: beside cursor (right, flip left); touch uses centered modal.
function moveTooltip(a,b) {
  const tt=document.getElementById('action-tooltip');
  if(!tt || tt.style.display==='none') return;
  let anchorX, anchorY;

  if(typeof a==='number'){
    anchorX=a;
    anchorY=(typeof b==='number')?b:0;
  } else if(a&&typeof a==='object'){
    anchorX=a.clientX;
    anchorY=a.clientY;
  } else {
    return;
  }

  const margin=8;
  const gap=14;
  const width=tt.offsetWidth||240;
  const height=tt.offsetHeight||160;

  let left=anchorX+gap;
  let top=anchorY-height/2;

  if(left+width+margin>window.innerWidth){
    left=anchorX-width-gap;
  }
  if(left<margin) left=margin;
  if(left+width+margin>window.innerWidth) left=Math.max(margin, window.innerWidth-width-margin);

  top=Math.min(Math.max(top, margin), Math.max(margin, window.innerHeight-height-margin));

  tt.style.left=left+'px';
  tt.style.top=top+'px';
}

// Generic tooltip used by enemy intent panel, reward icons, etc.
function showTooltip(e,text,x,y){
  const tt=document.getElementById('action-tooltip');
  if(!tt) return;

  tt.innerHTML=`<div class="tt-desc">${text}</div>`;
  tt.style.display='block';

  if(typeof x==='number'&&typeof y==='number') moveTooltip(x,y);
  else moveTooltip(e);
}

function hideTooltip() {
  const tt=document.getElementById('action-tooltip');
  tt.style.display='none';
  tt._currentAbId=null;
  tt.style.transform='';
  tt.classList.remove('is-touch-open');
}

function getAbDesc(ab) {
  const tmpl=getAbilityTemplateForUI(ab);
  if (!tmpl||!tmpl.levels) return ab.desc||'';
  const lv=Math.min(ab.level,tmpl.levels.length);
  return tmpl.levels[lv-1].desc;
}


function getAbilityCooldown(abId){
  return (G.abilityCooldowns&&G.abilityCooldowns[abId])?G.abilityCooldowns[abId]:0;
}

function getClassCooldownAdjustment(ab, player){
  const bd=BIRDS[player?.birdKey]||{};
  const cls=String(player?.class||bd.class||'bruiser').toLowerCase();
  const lv=player?.birdLevel||1;
  const t=getAbilityTemplateForUI(ab)||ab||{};
  const kind=String(t.type||t.btnType||ab.type||ab.btnType||'').toLowerCase();

  // Class rhythm:
  // Singer/Trickster: smoother spell cycles later
  // Trickster swarm patterns: summon/flood spells stay longer cooldown
  // Tank/Bruiser: defensive/utility tools smooth out later
  // Predator/Striker: attack buttons mostly keep their pace
  if(kind==='spell'){
    if((cls==='singer' || cls==='trickster') && lv>=8) return -1;
    if(cls==='trickster' && /murmuration|swarm|summon|flock|wing\s*storm|wingStorm|mobSwarm/i.test(t.id||t.name||'')) return 1;
  }
  if(kind==='utility'){
    if((cls==='tank' || cls==='bruiser' || cls==='singer') && lv>=10) return -1;
  }
  return 0;
}

function getTemplateCooldown(ab){
  const t=getAbilityTemplateForUI(ab);
  if(!t||!t.cooldownByLevel) return 0;
  const idx=Math.min((ab.level||1)-1,t.cooldownByLevel.length-1);
  let cd=Math.max(0,t.cooldownByLevel[idx]||0);

  const isSpell = (t.type==='spell' || t.btnType==='spell' || ab.type==='spell' || ab.btnType==='spell');
  const isUlt = !!(ab.isUltimate) || /ultimate|verdict|cataclysm|apex/i.test(t.name||ab.name||'');

  if(isSpell){
    // Normal spells: 1–3 turns. Ult spells: 3–5 turns.
    cd = isUlt ? clamp(cd,3,5) : clamp(cd,1,3);
  }

  // Class-specific pacing
  cd += getClassCooldownAdjustment(ab, G.player);

  // Never below 1 turn if the ability uses cooldowns
  if(t.cooldownByLevel && (t.cooldownByLevel[idx]||0) > 0){
    cd = Math.max(1, cd);
  }

  return cd;
}
function setAbilityCooldown(ab){
  const cd=getTemplateCooldown(ab);
  if(cd>0){ if(!G.abilityCooldowns) G.abilityCooldowns={}; G.abilityCooldowns[ab.id]=cd; }
}

function reduceOtherSpellCooldownsOnCast(usedAbId){
  const cls=(G.player?.class || BIRDS[G.player?.birdKey]?.class || '').toLowerCase();
  const isCaster = MAGIC_CLASSES.has(cls);
  if(!isCaster) return;

  // once per action
  G.playerTurnFlags = G.playerTurnFlags || {};
  if(G.playerTurnFlags._spellTempoUsedThisAction) return;
  G.playerTurnFlags._spellTempoUsedThisAction = true;

  if(!G.abilityCooldowns) return;
  for(const [id,cd] of Object.entries(G.abilityCooldowns)){
    if(id===usedAbId) continue;
    const t=ABILITY_TEMPLATES[id];
    const isSpell=(t?.type==='spell' || t?.btnType==='spell');
    if(!isSpell) continue;
    G.abilityCooldowns[id]=Math.max(0, cd-1);
  }
}

// ------------------ COOLDOWN NORMALIZER ------------------
function normalizeAbilityCooldownsForPlayer(p){
  if(!p?.abilities) return;
  p.abilities.forEach(ab=>{
    if(!ab||!ab.id) return;
    if(ab.id==='skipTurn'||ab.id==='sittingDuck'||ab.id==='endTurn') return;
    const isMagic=(ab.type==='magic'||ab.btnType==='magic'||/spell|hex|curse|arcane|shadow|storm/i.test(ab.name||''));
    const isUlt=/ultimate|verdict|cataclysm|apex/i.test(ab.name||'')||ab.isUltimate;
    const cd=(ab.cooldownMax??ab.cooldown??ab.baseCooldown??0);
    if(isMagic){
      const target=isUlt?clamp(cd||4,3,5):clamp(cd||2,1,3);
      ab.cooldownMax=target;
      if(ab.cooldown==null) ab.cooldown=0;
    } else {
      const target=isUlt?clamp(cd||3,2,5):clamp(cd||1,0,3);
      ab.cooldownMax=target;
      if(ab.cooldown==null) ab.cooldown=0;
    }
  });
}

function getPlayerPiercePctForAbility(ab){
  const base=ab?.piercePct||0;
  const t=ABILITY_TEMPLATES?.[ab?.id]||ab||{};
  const txt=`${t.name||''} ${t.desc||''}`.toLowerCase();
  const isHeavy=txt.includes('heavy')||txt.includes('smash')||txt.includes('slam')||txt.includes('crusher');
  const classPerks=applyClassPerksToCombatContext(G.player?.birdKey,{});
  let perk=(classPerks.piercingTempo?0.10:0);
  if(isHeavy && classPerks.crushingForce) perk+=0.10;
  return Math.max(0, base+perk);
}

function getPlayerClassRole(player=G.player){
  const cls=(player?.class || BIRDS[player?.birdKey]?.class || '').toLowerCase();
  return classToRoleId(cls, player?.birdKey) || 'striker';
}
function getClassPerkTriggerForCurrentStage(){
  const mode=(G.ui?.gameMode||'story')==='endless' ? 'endless' : 'story';
  if(mode==='story'){
    if((G.stage||0)!==11) return null;
    if((G.runClassPerks||[]).length>=getClassPerkCapForMode('story')) return null;
    if((G.runClassPerks||[]).some(entry=>entry?.source==='story-class-perk-10')) return null;
    return 'story-class-perk-10';
  }
  if((G.endlessBattle||0)!==30) return null;
  if((G.runClassPerks||[]).length>=getClassPerkCapForMode('endless')) return null;
  if((G.runClassPerks||[]).some(entry=>entry?.source==='endless-class-perk-30')) return null;
  return 'endless-class-perk-30';
}

function resumeAfterGrove(){
  G._skipGroveRoll = true;
  continueStageTransitionAfterRewards();
  G._skipGroveRoll = false;
}

function continueStageTransitionAfterRewards(){
  if(!hasMultiEnemyChainPending() && maybeOfferPassiveEvolutionChoice()) return;
  if(!hasMultiEnemyChainPending() && maybeOfferClassPerkChoice()) return;

  const lastEnemyWasBoss = G.enemy && G.enemy.isBoss;
  const safeHP = G.player.stats.hp > G.player.stats.maxHp * 0.2;
  const multiEnemyChainPending = hasMultiEnemyChainPending();
  if(!G._skipGroveRoll && !lastEnemyWasBoss && safeHP && Math.random() < 0.1 && !multiEnemyChainPending){
    setTimeout(()=>showGroveEvent(), 350);
    return;
  }

  G.phase='PLAYER';
  if (multiEnemyChainPending) {
    G._owEnemyIndex++;
    saveRun();
    loadStage();
    return;
  }
  resetStageBattleStats();
  if (G._owForgeReturnToForge) {
    G._owForgeReturnToForge = false;
    G._owForgeNavMeta = null;
    G._owForgeEncounter = null;
    G._owForgePowerTier = 0;
    clearOverworldPendingBattle();
    saveRun();
    if (typeof showScreen === 'function') showScreen('screen-map-forge');
    if (typeof globalThis.openMapForge === 'function') globalThis.openMapForge({ skipReload: true });
    return;
  }
  if (!G.endlessMode && _isOverworldRun()) {
    const forgeMeta = G._owForgeNavMeta || null;
    if (forgeMeta && typeof globalThis.markOwNodeCleared === 'function' && forgeMeta.mapId != null && G._owPendingNodeId != null) {
      globalThis.markOwNodeCleared(forgeMeta.mapId, G._owPendingNodeId);
      if (forgeMeta.isBonus && typeof globalThis.incrementBonusRepeatCount === 'function') {
        globalThis.incrementBonusRepeatCount(forgeMeta.mapId, G._owPendingNodeId);
      }
      const rewardList = forgeMeta.clearRewards?.length
        ? forgeMeta.clearRewards
        : (forgeMeta.isBonus && forgeMeta.bonusConfig?.rewards ? forgeMeta.bonusConfig.rewards : null);
      if (rewardList?.length && typeof globalThis.grantForgeClearRewards === 'function') {
        const granted = globalThis.grantForgeClearRewards(G.player, rewardList, G);
        if (granted.shinies > 0) {
          logMsg('Clear reward: +' + granted.shinies + ' shinies!', 'boss');
        }
        if (granted.mutations?.length) {
          logMsg('Clear reward: mutation added to nest inventory!', 'boss');
        }
      }
      if (forgeMeta.isWorldInterior && G.enemy?.isBoss && forgeMeta.worldId && typeof globalThis.markOwWorldCompleted === 'function') {
        globalThis.markOwWorldCompleted(forgeMeta.worldId);
        const stack = typeof globalThis.readOwMapStack === 'function' ? globalThis.readOwMapStack() : [];
        const entry = stack[stack.length - 1];
        if (entry && typeof globalThis.markOwNodeCleared === 'function') {
          globalThis.markOwNodeCleared(entry.parentMapId || 'main', entry.returnNodeId);
        }
      }
    }
    if (!forgeMeta?.skipMainStageAdvance) {
      finalizeOverworldStageClear(G._owPendingBattleStage || G.stage, G._owPendingNodeId, {
        shinyGain: G._owSequenceShiny || 0,
        enemiesDefeated: G._owEnemyCount || G._owStageEnemies?.length || 1,
      });
    }
    G._owForgeNavMeta = null;
    G._owForgeEncounter = null;
    G._owForgePowerTier = 0;
    clearOverworldPendingBattle();
    saveRun();
    try{
      const owp=G._overworldProgress;
      const nid=owp && Number.isFinite(Number(owp.currentNodeId)) ? Math.floor(Number(owp.currentNodeId)) : 0;
      if(typeof globalThis.persistOwMapSnapshot==='function')
        globalThis.persistOwMapSnapshot(nid, G.player?.birdKey||null);
    }catch(_){}
    try { window.location.href = 'blackstone_overworld_new.html'; return; } catch(_) {}
  } else if (G._owStageEnemies?.length) {
    G._owStageEnemies = null;
    G._owEnemyIndex = 0;
    G._owEnemyCount = 1;
    G._owEncounterRollStage = null;
    G._owEncounterDrafts = null;
    G._owEncounterDraftsSig = null;
    G._owEncounterMaterialized = null;
    G._owEncounterMaterializedSig = null;
  }
  loadStage();
}

function openClassPerkChoice(options=[], source=''){
  const sourceConfig=CLASS_PERK_SOURCE_RULES[source] || CLASS_PERK_SOURCE_RULES['story-class-perk-10'];
  const role=getPlayerClassRole();
  const roleLabel=idToClassLabel(role);
  G._rewardScreenMode='class-perk';
  G._pendingClassPerkChoice={source, options, role};
  G._pendingReward=null;
  showScreen('screen-reward');
  document.getElementById('reward-title').textContent=sourceConfig.title;
  document.getElementById('reward-sub').textContent=`${sourceConfig.subtitle} ${roleLabel ? `Active Class: ${roleLabel}.` : ''}`;
  renderBattleSummary();
  const confirmBtn=document.getElementById('reward-confirm-btn');
  confirmBtn.textContent='✓ Claim Class Perk';
  confirmBtn.className='confirm-btn';
  const grid=document.getElementById('reward-grid');
  grid.innerHTML='';
  options.forEach(perk=>{
    const tags=(perk.tags||[]).map(tag=>`<span class="reward-tag">${tag}</span>`).join('');
    const c=document.createElement('div');
    c.className='reward-card reward-card-class-perk tier-purple';
    c.innerHTML=`
      <div class="reward-tier-label">Class Perk</div>
      <span class="reward-icon">🧬</span>
      <div class="reward-name">${perk.name}</div>
      <div class="reward-desc">${perk.desc}</div>
      <div class="reward-class-row"><span class="class-badge class-${role}">${roleLabel}</span>${tags}</div>`;
    c.onclick=()=>{
      document.querySelectorAll('#reward-grid .reward-card').forEach(x=>x.classList.remove('selected'));
      c.classList.add('selected');
      G._pendingReward=perk;
      confirmBtn.className='confirm-btn visible';
    };
    grid.appendChild(c);
  });
}

function maybeOfferClassPerkChoice(){
  const source=getClassPerkTriggerForCurrentStage();
  if(!source || !G.player?.birdKey) return false;
  const available=getAvailableClassPerksForBird(G.player.birdKey);
  if(!available.length) return false;
  openClassPerkChoice(available.slice(0,3), source);
  return true;
}

function applyPassiveEvolutionChoice(tier,path){
  if(!G.player?.passive) return false;
  const pe=ensurePassiveEvolutionState(G.player);
  if(!pe || pe.choices?.[tier]) return false;
  if(!(tier===1||tier===2)) return false;
  if(path!=='offensive'&&path!=='utility') return false;
  pe.choices[tier]=path;
  pe.tier=Math.max(pe.tier||0,tier);
  pe.pathHistory.push({tier,path,atEndlessBattle:G.endlessBattle||0});
  const bonus=getPassiveEvolutionBonuses(G.player);
  G.player.passiveEvolutionBonuses=bonus;
  const def=getPassiveEvolutionDefinition(G.player.passive);
  const pick=(tier===1?def.stage1:def.stage2).find(x=>(x.path||'offensive')===path) || (tier===1?def.stage1[0]:def.stage2[0]);
  logMsg(`🧬 Passive Evolution ${tier}: ${pick?.name||path} selected.`, 'exp-gain');
  saveRun();
  return true;
}

function maybeOfferPassiveEvolutionChoice(){
  if(!isEndlessRunActive() || !G.player?.passive) return false;
  const pe=ensurePassiveEvolutionState(G.player);
  const eb=Math.max(0,G.endlessBattle||0);
  let tierToOffer=0;
  if(!pe.choices?.[1] && eb>=PASSIVE_EVOLUTION_MILESTONES.evo1) tierToOffer=1;
  else if(!pe.choices?.[2] && eb>=PASSIVE_EVOLUTION_MILESTONES.evo2) tierToOffer=2;
  if(!tierToOffer) return false;

  const def=getPassiveEvolutionDefinition(G.player.passive);
  const options=tierToOffer===1?def.stage1:def.stage2;
  const [optA,optB]=options;
  const pathA=optA?.path||'offensive';
  const pathB=optB?.path||'utility';
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML=`<div style="width:min(760px,94vw);background:rgba(16,12,8,.98);border:1px solid var(--gold);border-radius:14px;padding:16px;">
    <div style="font-family:Cinzel,serif;color:var(--gold);font-size:1.1rem;margin-bottom:6px;">PASSIVE EVOLUTION</div>
    <div style="color:var(--text-dim);margin-bottom:14px;">Choose how your passive evolves · <strong style="color:var(--gold-light)">${def.base}</strong> · Evolution ${tierToOffer}<br><span style="font-size:.78rem;color:var(--text-dim)">Each option permanently upgrades this passive for the rest of the run.</span></div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;">
      <button data-path="${pathA}" style="text-align:left;background:rgba(28,22,12,.96);border:1px solid rgba(201,168,76,.35);color:var(--text);border-radius:10px;padding:12px;cursor:pointer;">
        <div style="font-family:Cinzel,serif;color:var(--gold-light)">Option A · ${optA?.name||'Offensive Path'}</div>
        <div style="font-size:.82rem;color:var(--text-dim)">${optA?.effect||''}</div>
      </button>
      <button data-path="${pathB}" style="text-align:left;background:rgba(28,22,12,.96);border:1px solid rgba(201,168,76,.35);color:var(--text);border-radius:10px;padding:12px;cursor:pointer;">
        <div style="font-family:Cinzel,serif;color:var(--gold-light)">Option B · ${optB?.name||'Utility Path'}</div>
        <div style="font-size:.82rem;color:var(--text-dim)">${optB?.effect||''}</div>
      </button>
    </div>
  </div>`;
  overlay.querySelectorAll('button[data-path]').forEach(btn=>btn.addEventListener('click',()=>{
    applyPassiveEvolutionChoice(tierToOffer, btn.getAttribute('data-path'));
    overlay.remove();
    continueStageTransitionAfterRewards();
  }));
  document.body.appendChild(overlay);
  return true;
}

function applyOpeningStrikePassiveOnTurnStart(){
  const cls=(G.player?.class||BIRDS[G.player?.birdKey]?.class||'').toLowerCase();
  if(!['striker','trickster'].includes(cls)) return;
  G.playerStatus.openingStrikePierce=1;
}

function getCrowDefendCooldown(ab) {
  if (ab.level>=4) return 0;
  if (ab.level>=2) return 1;
  return 2;
}

function logMsg(msg,cls='') {
  const log=document.getElementById('battle-log');
  const d=document.createElement('div');
  d.className=`log-entry ${cls}`; d.textContent=msg;
  log.appendChild(d);
  const entries=log.querySelectorAll('.log-entry');
  if(entries.length>5){ for(let i=0;i<entries.length-5;i++) entries[i].remove(); }
  log.scrollTop=log.scrollHeight;
}

// ============================================================
//  ANIMATION ENGINE
// ============================================================
function playAvatarAnim(who,cls,dur=600) {
  const animCls=['do-smash-r','do-smash-l','do-hit','do-dodge-r','do-dodge-l','do-miss-r','do-miss-l','do-shield'];
  return new Promise(res=>{
    const wrap=getAvatarWrap(who);
    const inner=getAvatar(who);
    const host=wrap||inner;
    if(!host){ res(); return; }
    for(const node of [wrap,inner].filter(Boolean)){
      animCls.forEach(c=>node.classList.remove(c));
    }
    void host.offsetWidth;
    host.classList.add(cls);
    setTimeout(()=>{ try{ host.classList.remove(cls); }catch(_){} res(); },dur);
  });
}

function spawnFloat(who,text,cls) {
  const wrap=getAvatarWrap(who);
  if(!wrap) return;
  const raw=String(text||'').trim();
  const el=document.createElement('div');
  el.className=`float-number ${cls}`;

  const lower=raw.toLowerCase();
  const isDamage = cls==='fn-dmg' || cls==='fn-crit' || cls==='fn-magic' || /^[-−]/.test(raw) || lower.includes(' dmg');
  const isAilment = ['poison','bleed','burn','weaken','para','fear','confuse','slow','stun','lull','resonance'].some(k=>lower.includes(k));
  const isBuff = ['immune','guard','evade','dodge','heal','atk','def','acc','crit','energy'].some(k=>lower.includes(k));

  if(isDamage) el.classList.add('float-damage');
  if(cls==='fn-magic') el.classList.add('float-magic');
  if(isAilment || cls==='fn-poison' || cls==='fn-burn') el.classList.add('float-ailment');
  if(isBuff && !isDamage) el.classList.add('float-buff');
  if(cls==='fn-buff-trend') el.classList.add('float-buff-trend');
  if(cls==='fn-debuff-trend') el.classList.add('float-debuff-trend');

  const iconMatch = raw.match(/^([^\w\s+\-]+)/);
  const icon = iconMatch ? iconMatch[0] : '';
  const content = icon ? raw.slice(icon.length).trim() : raw;
  if(icon){
    const ico=document.createElement('span');
    ico.className='float-icon';
    ico.textContent=icon;
    // hook for future ailment/attack sprites
    if(isAilment) ico.dataset.spriteType='ailment';
    if(isDamage) ico.dataset.spriteType='attack';
    el.appendChild(ico);
  }
  const txt=document.createElement('span');
  txt.className='float-text';
  txt.textContent=content || raw;
  el.appendChild(txt);

  wrap.appendChild(el);
  setTimeout(()=>el.remove(),1250);
}

function flashPanel(who,color) {
  const p=getPanel(who);
  if(!p) return;
  p.classList.remove('flash-red','flash-blue');
  void p.offsetWidth;
  p.classList.add(`flash-${color}`);
  setTimeout(()=>{ try{ p.classList.remove(`flash-${color}`); }catch(_){} },600);
}

async function doAttack(attacker,target,result) {
  const smash=attacker==='player'?'do-smash-r':'do-smash-l';
  const dodge_=target==='player'?'do-dodge-l':'do-dodge-r';
  const attackP=playAvatarAnim(attacker,smash,520);
  await delay(250);
  if (result.wasDodged) {
    playAvatarAnim(target,dodge_,560);
    spawnFloat(target,'Dodge!','fn-dodge');
    SFX.dodge();
    if(target==='player') BS.dodges++;
  } else {
    playAvatarAnim(target,'do-hit',420);
    flashPanel(target,target==='player'?'blue':'red');
    // Screen shake threshold: % of target's max HP
    const targetMaxHp = target==='enemy' ? G.enemy.stats.maxHp : G.player.stats.maxHp;
    const dmgPct = result.dmgDealt / targetMaxHp;
    // Urgency: pitch scales up as enemy HP drops (1.0 → 1.5 as enemy goes 100% → 0%)
    const enemyHpPct = target==='enemy' ? Math.max(0, G.enemy.stats.hp / G.enemy.stats.maxHp) : 1;
    const urgency = target==='enemy' ? 1 + (1 - enemyHpPct) * 0.5 : 1;
    const dmgDisp = formatCombatNumber(result.dmgDealt);
    if (result.isCrit) {
      spawnFloat(target,`💥 -${dmgDisp}!`,'fn-crit');
      SFX.crit(urgency);
      if(dmgPct>=0.25) doScreenShake(dmgPct>=0.50);
      if(target==='enemy'){ BS.crits++; G.runCrits++; }
    } else if (result.isMagic) {
      spawnFloat(target,`-${dmgDisp}`,'fn-magic');
      SFX.hit(urgency);
      if(dmgPct>=0.25) doScreenShake(dmgPct>=0.50);
    } else {
      spawnFloat(target,`-${dmgDisp}`,'fn-dmg');
      SFX.hit(urgency);
      if(dmgPct>=0.25) doScreenShake(dmgPct>=0.50);
    }
    if(target==='enemy'){ BS.dmgDealt+=result.dmgDealt; if(result.dmgDealt>BS.highestHit) BS.highestHit=result.dmgDealt; }
    if(target==='player'){ BS.dmgTaken+=result.dmgDealt; }
    if (result.wasBlocked) { setTimeout(()=>spawnFloat(target,'🛡','fn-dodge'),120); SFX.shield(); }
  }
  await attackP;
}

async function doMiss(attacker, kind='accuracy') {
  if(attacker==='player' && kind!=='dodge') registerMiss();
  const cls=attacker==='player'?'do-miss-r':'do-miss-l';
  const isDodge=kind==='dodge';
  spawnFloat(attacker, isDodge?'Dodge!':'Miss!', isDodge?'fn-dodge':'fn-miss');
  if(isDodge) SFX.dodge(); else SFX.miss();
  await playAvatarAnim(attacker,cls,580);
}

async function doShield(who) {
  playAvatarAnim(who,'do-shield',660);
  spawnFloat(who,'🛡 Block','fn-dodge');
  SFX.shield();
  await delay(400);
}

async function doSpell(target,text) { spawnFloat(target,text,'fn-status'); SFX.spell(); await delay(450); }
async function doHeal(who,amt) {
  spawnFloat(who,`+${amt}`,'fn-heal');
  SFX.heal();
  if(who==='player'&&G.player){
    const _phbd=BIRDS[G.player.birdKey];
    if(_phbd&&_phbd.passive&&_phbd.passive.onHeal) _phbd.passive.onHeal(G.player,amt);
    setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
  }
  await delay(400);
}
function delay(ms) {
  const speed=(G&&G.speed)?G.speed:1;
  return new Promise(r=>setTimeout(r,Math.max(0,Math.floor(ms/Math.max(0.25,speed)))));
}

// ============================================================
//  COMBAT MATH
// ============================================================
function roll(a,b){return Math.floor(Math.random()*(b-a+1))+a;}

// ============================================================


// Accuracy is fixed by bird traits (class + size), not level growth.
const BASE_ACC_BY_CLASS = {
  striker:86, bruiser:80, tank:74, trickster:84, predator:82, singer:80,
};
const BASE_ACC_BY_SIZE = {tiny:2, small:1, medium:0, large:-1, xl:-2};

function getPlayerBaseAcc(){
  const bd=BIRDS[G.player?.birdKey]||{};
  const cls=bd.class||'bruiser';
  const size=G.player?.size||bd.size||'medium';
  const base=(BASE_ACC_BY_CLASS[cls]??80)+(BASE_ACC_BY_SIZE[size]??0);
  return Math.max(65,Math.min(90,base));
}
function getPlayerAccMod(){
  let mod=0;
  if(G.sitAndWaitActive) mod+=8;
  if(G.battleHymnActive) mod+=Math.floor((G.battleHymnACC||0)*0.5);
  if(G.humMissBonus>0) mod+=Math.floor((G.humMissBonus||0)*0.5);
  mod-=(G.playerStatus?.accDebuff||0);
  return mod;
}
function getPlayerEffectiveAcc(){
  return Math.max(0,getPlayerBaseAcc()+getPlayerAccMod());
}

function clamp01(v){return Math.max(0,Math.min(1,v));}

/** Locked combat tuning: offensive stats ×0.75; guard in denominators ×0.80. */
const COMBAT_OFFENSIVE_STAT_MULT = 0.75;
const POST_BATTLE_HEAL_PCT_STORY = 0.20;
const POST_BATTLE_HEAL_PCT_ENDLESS = 0.33;

function getPostBattleHealPct(){
  return G.endlessMode ? POST_BATTLE_HEAL_PCT_ENDLESS : POST_BATTLE_HEAL_PCT_STORY;
}

function shouldApplyPostBattleHealNow(){
  return !!G.player;
}

function applyPostBattleHealIfDue(){
  if(!shouldApplyPostBattleHealNow()) return;
  const postHealMult=G.player?.mutHuntersCruelty?0.5:1;
  const postHeal=roundCombatDamage(Math.max(0.01, G.player.stats.maxHp * getPostBattleHealPct() * postHealMult));
  G.player.stats.hp=Math.min(G.player.stats.hp + postHeal, G.player.stats.maxHp);
  spawnFloat('player', `+${postHeal} 🩹`, 'fn-heal');
  const flatHeal=(G.player.postBattleFlatHeal || 0);
  if(flatHeal>0){
    G.player.stats.hp=Math.min(G.player.stats.maxHp, G.player.stats.hp + flatHeal);
    spawnFloat('player', `+${flatHeal} 🩹`, 'fn-heal');
  }
  const bonusPct=(G.player.postBattleHealBonusPct || 0);
  if(bonusPct>0){
    const extra=roundCombatDamage(Math.max(0.01, G.player.stats.maxHp * bonusPct));
    G.player.stats.hp=Math.min(G.player.stats.hp + extra, G.player.stats.maxHp);
    spawnFloat('player', `+${extra} 🩹`, 'fn-heal');
  }
}
const COMBAT_GUARD_DEF_MULT = 0.80;
const COMBAT_GUARD_MDEF_MULT = 0.80;
const HIT_CHANCE_PCT_CLAMP = {min: MIN_HIT_CHANCE || 40, max: MAX_HIT_CHANCE || 95};

/** Soft-cap main stats for formulas (bands 25–30 / 40–50; hard 99). */
function softenMainStatForCombat(n){
  const x = Math.max(0, Math.min(99, Number(n) || 0));
  if (x <= 28) return x;
  if (x <= 45) return 28 + (x - 28) * 0.65;
  return 28 + (45 - 28) * 0.65 + (x - 45) * 0.40;
}

/** Dodge % for hit math: diminishing >25 / >35, hard cap 60. */
function effectiveDodgePercentForCombat(raw){
  const d = Math.max(0, Number(raw) || 0);
  if (d <= 25) return d;
  if (d <= 35) return 25 + (d - 25) * 0.55;
  return Math.min(60, 25 + 10 * 0.55 + (d - 35) * 0.35);
}

function damageMitigationMultiplierFromGuard(guardVal){
  return 100 / (100 + Math.max(0, guardVal | 0));
}

function physicalGuardValueFromEnemyDef(enemyDefRaw, pierceFrac){
  let d = Math.max(0, Number(enemyDefRaw) || 0);
  d = Math.floor(d * (1 - Math.min(0.95, Math.max(0, pierceFrac || 0))));
  if (enemyHasBurning()) d = Math.floor(d * 0.8);
  return Math.max(0, Math.floor(softenMainStatForCombat(d) * COMBAT_GUARD_DEF_MULT));
}

function magicalGuardValueFromEnemyMdef(mdefRaw, pierceFrac){
  let m = Math.max(0, Number(mdefRaw) || 0);
  m = Math.floor(m * (1 - Math.min(0.95, Math.max(0, pierceFrac || 0))));
  if (enemyHasBurning()) m = Math.floor(m * 0.8);
  return Math.max(0, Math.floor(softenMainStatForCombat(m) * COMBAT_GUARD_MDEF_MULT));
}

function physicalGuardValueFromPlayerDef(defRaw, burnMult){
  let d = Math.max(0, Number(defRaw) || 0);
  d = Math.floor(d * (burnMult == null ? 1 : burnMult));
  return Math.max(0, Math.floor(softenMainStatForCombat(d) * COMBAT_GUARD_DEF_MULT));
}

function magicalGuardValueFromPlayerMdef(mdefRaw, burnMult){
  let m = Math.max(0, Number(mdefRaw) || 0);
  m = Math.floor(m * (burnMult == null ? 1 : burnMult));
  return Math.max(0, Math.floor(softenMainStatForCombat(m) * COMBAT_GUARD_MDEF_MULT));
}

function getPlayerArmorPenPct(player=G.player){
  let pct=Number(player?.stats?.armorPen)||0;
  pct+=(getPassiveEvolutionBonuses(player).piercePct||0);
  if(player?.augAttackPiercePct) pct+=player.augAttackPiercePct*100;
  return Math.min(95, Math.max(0, pct));
}
function getPlayerMagicPenPct(player=G.player){
  let pct=Number(player?.stats?.magicPen)||0;
  if(player?.augSpellPiercePct) pct+=player.augSpellPiercePct*100;
  return Math.min(95, Math.max(0, pct));
}
globalThis.getPlayerArmorPenPct=getPlayerArmorPenPct;
globalThis.getPlayerMagicPenPct=getPlayerMagicPenPct;

/** Pierce 0–1: fractional ability pierce + template pts on G._currentPiercePct. */
function getPhysicalPierceFractionForDamage(ab){
  const fromAb = ab ? (getPlayerPiercePctForAbility(ab) || 0) : 0;
  const pts = Number(G._currentPiercePct) || 0;
  const eqPct = getPlayerArmorPenPct();
  return Math.min(0.95, fromAb + pts / 100 + eqPct / 100);
}

function getMagicalPierceFractionForDamage(ab){
  const pts = Number(G._currentPiercePct) || 0;
  let fromAb = 0;
  if(ab?.pierceMdef) fromAb = Number(ab.pierceMdef) / 100;
  const eqPct = getPlayerMagicPenPct();
  return Math.min(0.95, fromAb + pts / 100 + eqPct / 100);
}

/** UI / preview: template pierce without relying on G._currentPiercePct from pdmg. */
function getPhysicalPierceFractionForPreview(ab){
  const fromAb = ab ? (getPlayerPiercePctForAbility(ab) || 0) : 0;
  if (!ab) return Math.min(0.95, fromAb + getPlayerArmorPenPct() / 100);
  const tmpl = getAbilityTemplateForUI(ab);
  const lv = Math.min(ab.level || 1, 4);
  let pts = (tmpl?.pierceDef || 0) + (lv >= 2 ? 5 : 0) + (lv >= 3 ? 5 : 0);
  if (BIRDS[G.player.birdKey]?.passive?.id === 'passive_kiwi_burrow_sense' && !G._firstAttackUsed) pts += 10;
  const enCost = Number(tmpl?.energy ?? tmpl.energyCost ?? ab?.energy ?? 1);
  if (BIRDS[G.player.birdKey]?.passive?.id === 'passive_secretary_long_leg_reach' && enCost <= 1) pts += 10;
  return Math.min(0.95, fromAb + pts / 100 + getPlayerArmorPenPct() / 100);
}

function getMagicalPierceFractionForPreview(ab){
  let fromAb = 0;
  if(ab){
    const tmpl = getAbilityTemplateForUI(ab);
    fromAb = (Number(tmpl?.pierceMdef) || Number(ab.pierceMdef) || 0) / 100;
  }
  return Math.min(0.95, fromAb + getPlayerMagicPenPct() / 100);
}

function calcHitChance(attAcc, defDodgeRaw, baseHitFrac){
  const basePct = Math.max(0, Math.min(100, (baseHitFrac <= 1 ? baseHitFrac * 100 : baseHitFrac)));
  const dodge = effectiveDodgePercentForCombat(defDodgeRaw);
  const accSkew = (Math.max(0, attAcc || 0) - 75) * 0.22;
  const hitPct = Math.max(HIT_CHANCE_PCT_CLAMP.min, Math.min(HIT_CHANCE_PCT_CLAMP.max, basePct - dodge + accSkew));
  return hitPct / 100;
}

/** Pass final guard (after soften ×0.80) for legacy call sites. */
function calcDefenseMultiplier(def){
  return damageMitigationMultiplierFromGuard(Math.max(0, def | 0));
}

// Apply one-time bonuses when stage changes
function applyGrowthStageTransition(p, fromStage, toStage){
  if(!p?.stats) return;

  const cls=(p.class || (BIRDS[p.birdKey]?.class) || '').toLowerCase();
  p.growthStage = toStage;

  if(cls==='striker'){
    p.passiveCritBonus = (toStage===GROWTH.FLETCHLING)?0.15:(toStage===GROWTH.JUVENILE)?0.25:0.35;
    p.passiveBleedOnCrit = (toStage===GROWTH.JUVENILE)?1:((toStage===GROWTH.ADULT||toStage===GROWTH.APEX)?2:0);
  }
  if(cls==='tank'){
    /* guardBlockPct legacy removed — mitigation uses DEF/MDEF guard pipeline */
  }
  if(cls==='singer'){
    p.spellAilmentEvery = (toStage===GROWTH.FLETCHLING)?4:3;
    p.spellAilmentDouble = (toStage===GROWTH.ADULT||toStage===GROWTH.APEX);
  }
  if(cls==='bruiser' || cls==='predator'){
    p.afterDefendPierce = (toStage===GROWTH.FLETCHLING)?0.0:0.25;
    if(toStage===GROWTH.ADULT||toStage===GROWTH.APEX) p.afterDefendAtkBuff = 2;
  }
  if(cls==='singer'){
    p.buffDurationPlus = 1;
    p.buffEchoPct = (toStage===GROWTH.JUVENILE||toStage===GROWTH.ADULT||toStage===GROWTH.APEX)?0.5:0;
  }
  if(cls==='trickster'){
    p.firstAttackBonusPct = (toStage===GROWTH.FLETCHLING)?0.30:(toStage===GROWTH.JUVENILE)?0.50:0.20;
    p.firstAttackEachTurn = (toStage===GROWTH.ADULT||toStage===GROWTH.APEX);
  }

  if(typeof logMsg==='function'){
    const nice = toStage.charAt(0).toUpperCase() + toStage.slice(1);
    logMsg(`🪶 Growth: ${BIRDS[p.birdKey]?.name || 'Bird'} became ${nice}!`, 'exp-gain');
  }
}

function checkGrowthStage(p){
  const prev = p.growthStage || getGrowthStageForLevel((p.birdLevel||1)-1);
  const next = getGrowthStageForLevel(p.birdLevel||1);
  if(prev!==next) applyGrowthStageTransition(p, prev, next);
  else p.growthStage = next;
}
const ENEMY_TIER_MULTIPLIERS = {
  normal:{hp:1.0,atk:1.0,def:1.0},
  elite:{hp:1.4,atk:1.15,def:1.2},
  boss:{hp:2.0,atk:1.3,def:1.3},
  lieutenant:{hp:1.7,atk:1.2,def:1.2},
};

const ENEMY_SIZE_MODIFIERS = {
  tiny:{hp:0.75,atk:0.85,def:0.7,matk:1.0,mdef:0.9,spd:1.35,acc:1.05},
  small:{hp:0.9,atk:0.95,def:0.9,matk:1.0,mdef:0.95,spd:1.15,acc:1.03},
  medium:{hp:1.0,atk:1.0,def:1.0,matk:1.0,mdef:1.0,spd:1.0,acc:1.0},
  large:{hp:1.25,atk:1.15,def:1.2,matk:1.0,mdef:1.1,spd:0.9,acc:0.97},
  xl:{hp:1.5,atk:1.25,def:1.35,matk:1.0,mdef:1.15,spd:0.8,acc:0.95},
};

const ENEMY_CLASS_MODIFIERS = {
  striker:{atk:1.2,matk:0.9,def:0.85,mdef:1.0,spd:1.15,acc:1.05,ccAdd:0.08,cdSet:1.6},
  singer:{atk:0.9,matk:1.25,def:1.0,mdef:1.15,spd:1.0,acc:1.02,ccAdd:0.03},
  tank:{atk:1.0,matk:1.0,def:1.35,mdef:1.25,spd:0.85,acc:0.95,ccAdd:0.0},
  trickster:{atk:1.0,matk:1.0,def:1.0,mdef:1.0,spd:1.2,acc:1.08,ccAdd:0.05},
  bruiser:{atk:1.25,matk:1.0,def:1.1,mdef:1.0,spd:1.0,acc:1.0,ccAdd:0.04},
  predator:{atk:1.15,matk:1.0,def:1.0,mdef:1.0,spd:1.1,acc:1.05,ccAdd:0.10,cdSet:1.7},

};

function getEnemyBaseStats(base){
  const s=base?.stats||{};
  const hp=(base.hp??s.maxHp??s.hp??1);
  const size=base?.size||'medium';
  const enDefault=getEnergyProfile(normalizeBirdSizeForEnergy(size)).maxEN;
  const en=(s.en??base.en??enDefault);
  const ccRaw=(s.cc??base.cc??((s.critChance??base.critChance??5)/100));
  const cdRaw=(s.cd??base.cd??(s.critMult??base.critMult??1.5));
  return {
    hp:Math.max(1,Math.floor(hp)),
    atk:Math.max(1,Math.floor(base.atk??s.atk??1)),
    def:Math.max(0,Math.floor(base.def??s.def??0)),
    matk:Math.max(1,Math.floor(base.matk??s.matk??6)),
    mdef:Math.max(0,Math.floor(base.mdef??s.mdef??8)),
    spd:Math.max(1,Math.floor(base.spd??s.spd??1)),
    acc:Math.max(60,Math.floor(base.acc??s.acc??70)),
    dodge:Math.max(0,Math.floor(base.dodge??s.dodge??5)),
    cc:Math.max(0,Math.min(0.95,Number(ccRaw)||0.05)),
    cd:Math.max(1.1,Number(cdRaw)||1.5),
    en:Math.max(1,Math.floor(en)),
  };
}

function resolveEnemyTier(enemyBase, forceTier=''){
  if(forceTier) return forceTier;
  if(enemyBase?.enemyTier) return enemyBase.enemyTier;
  if(enemyBase?.isLieutenant) return 'lieutenant';
  if(enemyBase?.isElite) return 'elite';
  if(enemyBase?.isBoss) return 'boss';
  return 'normal';
}

// --- Enemy combat scaling (authoring rules for new enemies) ---
// - Template stats (makeEnemy / BIRD_ENEMIES) are the baseline identity.
// - Size + enemyClass modifiers shape role (tank vs striker, etc.) — not stage power.
// - Power growth is level-based: effectiveLevel = stage depth + player bird level contribution + endless bonus.
// - Difficulty preset mult (DIFFICULTIES.*.mult) scales enemy HP + ATK/MATK only.
// - Elite random spawns disabled (combatResolveEnemyTier never promotes to elite).
const ENEMY_PLAYER_LEVEL_TO_EFFECTIVE = 0.42;
// Endless scaling design notes:
// - Endless reuses the same stage-derived curve Story uses.
// - After Story clears (Stage 20), endless adds an extra ramp every N battles.
// - Effective level growth is intentionally unbounded (no level-10/story-end cap).
const ENDLESS_STORY_END_STAGE = 20;
const ENDLESS_BOSS_CADENCE = 20;
const ENDLESS_SHOP_CADENCE = 10;
const ENEMY_ENDLESS_EXTRA_LEVEL_EVERY = 5;
const ENEMY_ENDLESS_EXTRA_LEVEL_STEP = 3;
const ENEMY_ENDLESS_EXTRA_LEVEL_BONUS_EVERY = 3;
const ENEMY_HP_PER_LEVEL_BY_SIZE = Object.freeze({tiny:2.55,small:3.3,medium:3.95,large:4.7,xl:5.55});
const ENEMY_ATK_PER_LEVEL_BY_SIZE = Object.freeze({tiny:0.45,small:0.55,medium:0.64,large:0.72,xl:0.81});
const ENEMY_MATK_PER_LEVEL_BY_SIZE = Object.freeze({tiny:0.51,small:0.62,medium:0.70,large:0.77,xl:0.83});

/** Pure helper: convert absolute stage to endless battle number (Stage 21 => Endless 1). */
function getEndlessEffectiveBattleNumber(stage){
  const s=Math.max(1,Math.floor(Number(stage)||1));
  return Math.max(0,s-ENDLESS_STORY_END_STAGE);
}

const ENDLESS_RANDOM_MUTATION_TIERS = Object.freeze(['white', 'green', 'blue', 'purple', 'gold']);
const ENDLESS_BOSS_MUTATION_REWARD_TIERS = Object.freeze({
  10: ['green', 'green', 'green'],
  20: ['blue', 'blue', 'green'],
  30: ['blue', 'blue', 'blue'],
  40: ['purple', 'blue', 'blue'],
  50: ['purple', 'purple', 'blue'],
});

function getEndlessNormalFightTier(eb){
  const n=Math.max(0,Math.floor(Number(eb)||0));
  if(n>=1 && n<=9) return 'white';
  if(n>=11 && n<=29) return 'green';
  if(n>=31 && n<=49) return 'blue';
  return null;
}

function rollRandomAnyMutationTiers(count){
  const n=Math.max(0,Math.floor(Number(count)||0));
  const out=[];
  for(let i=0;i<n;i++){
    out.push(ENDLESS_RANDOM_MUTATION_TIERS[Math.floor(Math.random()*ENDLESS_RANDOM_MUTATION_TIERS.length)]);
  }
  return out;
}

function getStoryMutationRewardTiers(stage, isBoss){
  const st=Math.max(1,Math.floor(Number(stage)||1));
  if(isBoss && st===STORY_MILESTONE_BOSS_STAGE) return ['blue','blue','purple'];
  if(isBoss && st===STORY_DUKE_STAGE) return ['purple','purple','purple'];
  if(st<=4) return ['white','white','white'];
  if(st<=9) return ['green','green','green'];
  if(st<=16) return ['blue','blue','blue'];
  if(st<=19) return ['purple','purple','purple'];
  return ['purple','purple','purple'];
}

function resolveMutationRewardTiers({ stage, isBoss }={}){
  const st=Math.max(1,Math.floor(Number(stage)||1));
  if(isEndlessRunActive()){
    const eb=getEndlessEffectiveBattleNumber(st);
    if(eb>=51 && eb<=100) return rollRandomAnyMutationTiers(3);
    if(eb>0 && eb%ENDLESS_BOSS_CADENCE===0){
      const bossTiers=ENDLESS_BOSS_MUTATION_REWARD_TIERS[eb];
      return bossTiers ? [...bossTiers] : [];
    }
    if(eb>0 && eb%ENDLESS_BOSS_CADENCE!==0) return rollRandomAnyMutationTiers(3);
    return [];
  }
  return getStoryMutationRewardTiers(st, !!isBoss);
}

function normalizeMutationDataTier(tier){
  const t=String(tier||'white').toLowerCase();
  return t==='grey' ? 'white' : t;
}

function pickUniqueMutationReward(tier, used, isBoss){
  if(typeof Avian?.mutations?.rollMutationReward!=='function') return null;
  const dataTier=normalizeMutationDataTier(tier);
  let guard=0;
  while(guard<25){
    guard++;
    const rw=Avian.mutations.rollMutationReward({ tier: dataTier, stage: G.stage, isBoss: !!isBoss });
    if(!rw || used.has(rw.id)) continue;
    used.add(rw.id);
    return rw;
  }
  return null;
}

function buildMutationRewardPool(){
  const isBoss=!!(G.enemy && G.enemy.isBoss);
  const tiers=resolveMutationRewardTiers({ stage: G.stage, isBoss });
  const used=new Set();
  return tiers.map(tier=>pickUniqueMutationReward(tier, used, isBoss)).filter(Boolean);
}

function computeEnemyEffectiveLevel(stage, playerBirdLevel, isEndless){
  const s=Math.max(1,Math.floor(stage||1));
  const pl=Math.max(1,Math.floor(playerBirdLevel||1));
  let L=1+(s-1)+Math.floor((pl-1)*ENEMY_PLAYER_LEVEL_TO_EFFECTIVE);
  const endlessBattle=getEndlessEffectiveBattleNumber(s);
  if(isEndless && endlessBattle>0){
    // Keep endless growth uncapped after stage 20.
    L+=Math.floor(endlessBattle/ENEMY_ENDLESS_EXTRA_LEVEL_EVERY)*ENEMY_ENDLESS_EXTRA_LEVEL_STEP;
    L+=Math.floor(endlessBattle/ENEMY_ENDLESS_EXTRA_LEVEL_BONUS_EVERY);
  }
  return Math.max(1,L);
}

/** Story midgame rebalance: slight curve on stages 6–19 (non-endless). Boss/lieutenant get a milder cut. */
function getStoryEnemyPowerMultiplier(stage, tier, opts) {
  if (!opts || !opts.isStory || opts.isEndless) return 1;
  const s = Math.max(1, Math.floor(stage || 1));
  if (s < 6 || s > 19) return 1;
  const t = (s - 6) / 13;
  if (tier === 'boss' || tier === 'lieutenant') return 0.97 - t * 0.04;
  return 0.94 - t * 0.06;
}

function combatResolveEnemyTier(enemyBase, stage, opts, templateTier){
  if(templateTier==='boss') return 'boss';
  if(templateTier==='lieutenant') return 'lieutenant';
  if(enemyBase?.isBoss) return 'boss';
  if(templateTier==='elite') return 'normal';
  return 'normal';
}

function buildScaledEnemy(enemyBase, stage, opts={}){
  const s=Math.max(1, Math.floor(stage||1));
  const isEndless=!!opts.isEndless;
  const diffMult=Number.isFinite(opts.diffMult)?opts.diffMult:1;
  const templateTier=resolveEnemyTier(enemyBase, opts.tier);
  const tier=combatResolveEnemyTier(enemyBase, stage, opts, templateTier);
  const mult=ENEMY_TIER_MULTIPLIERS[tier]||ENEMY_TIER_MULTIPLIERS.normal;
  const base=getEnemyBaseStats(enemyBase);
  const sizeKey=String(enemyBase?.size||'medium').toLowerCase();
  const sizeMod=ENEMY_SIZE_MODIFIERS[sizeKey]||ENEMY_SIZE_MODIFIERS.medium;
  const classKey=String(enemyBase?.enemyClass||inferEnemyClassFromStyle(enemyBase?.aiStyle)||'singer').toLowerCase();
  const classMod=ENEMY_CLASS_MODIFIERS[classKey]||ENEMY_CLASS_MODIFIERS.singer;

  // Identity: base template -> size role -> class role (no stage multipliers here)
  let hpBase=base.hp*sizeMod.hp;
  let atkBase=base.atk*sizeMod.atk;
  let defBase=base.def*sizeMod.def;
  let matkBase=base.matk*sizeMod.matk;
  let mdefBase=base.mdef*sizeMod.mdef;
  let spdBase=base.spd*sizeMod.spd;
  let accBase=base.acc*sizeMod.acc;
  let cc=base.cc;
  let cd=base.cd;

  atkBase*=classMod.atk;
  matkBase*=classMod.matk;
  defBase*=classMod.def;
  mdefBase*=classMod.mdef;
  spdBase*=classMod.spd;
  accBase*=classMod.acc;
  cc=Math.min(0.95,Math.max(0,cc+(classMod.ccAdd||0)));
  if(Number.isFinite(classMod.cdSet)) cd=classMod.cdSet;

  const L=computeEnemyEffectiveLevel(s, opts.playerBirdLevel, isEndless);
  const gain=Math.max(0,L-1);
  const hpPL=ENEMY_HP_PER_LEVEL_BY_SIZE[sizeKey]??ENEMY_HP_PER_LEVEL_BY_SIZE.medium;
  const atkPL=ENEMY_ATK_PER_LEVEL_BY_SIZE[sizeKey]??ENEMY_ATK_PER_LEVEL_BY_SIZE.medium;
  const matkPL=ENEMY_MATK_PER_LEVEL_BY_SIZE[sizeKey]??ENEMY_MATK_PER_LEVEL_BY_SIZE.medium;

  let hp=hpBase+gain*hpPL;
  let atk=atkBase+gain*atkPL;
  let matk=matkBase+gain*matkPL;
  let def=defBase+Math.floor(gain/4);
  let mdef=mdefBase+Math.floor(gain/5);
  let spd=spdBase+Math.floor(gain/8);

  hp*=mult.hp;
  atk*=mult.atk;
  matk*=mult.atk;
  def*=mult.def;
  mdef*=mult.def;

  hp*=diffMult;
  atk*=diffMult;
  matk*=diffMult;
  def*=diffMult;
  mdef*=diffMult;
  spd*=diffMult;

  const storyMult = getStoryEnemyPowerMultiplier(s, tier, opts);
  hp *= storyMult;
  atk *= storyMult;
  matk *= storyMult;
  def *= storyMult;
  mdef *= storyMult;
  spd *= storyMult;

  const endlessBattle=isEndless?getEndlessEffectiveBattleNumber(s):0;
  const pl=Math.max(1,Math.floor(opts.playerBirdLevel||1));
  let rampMult=1;
  if(isEndless&&endlessBattle>0&&pl>=20&&L>=20){
    const rampSteps=Math.floor(endlessBattle/3);
    rampMult=1+rampSteps*0.05;
  }
  hp*=rampMult;
  atk*=rampMult;
  matk*=rampMult;
  def*=rampMult;
  mdef*=rampMult;
  spd*=rampMult;

  let acc=Math.max(60,Math.min(96,Math.floor(accBase+Math.floor(gain/4)+(tier==='boss'?2:0))));
  let dodge=Math.max(0,Math.min(42,Math.floor(base.dodge+Math.floor(gain/6)+(tier==='boss'?2:0))));
  acc=Math.max(60,Math.min(96,Math.floor(acc*diffMult*storyMult*rampMult)));
  dodge=Math.max(0,Math.min(42,Math.floor(dodge*diffMult*storyMult*rampMult)));

  hp=Math.max(1,Math.round(hp));
  atk=Math.max(1,Math.round(atk));
  matk=Math.max(1,Math.round(matk));
  def=Math.max(0,Math.round(def));
  mdef=Math.max(0,Math.round(mdef));
  spd=Math.max(1,Math.round(spd));

  return {hp,maxHp:hp,atk,def,matk,mdef,spd,acc,dodge,cc,cd,critChance:Math.round(cc*100),critMult:cd,en:base.en,tier,enemyClass:classKey,effectiveLevel:L};
}

function buildScaledBoss(enemyBase, stage, opts={}){
  const forcedTier=opts.tier||resolveEnemyTier(enemyBase);
  return buildScaledEnemy(enemyBase, stage, {...opts,tier:forcedTier});
}

function enemyScaleFactor(base, stage, diffMult){
  const isEndless=(G.endlessMode && stage>20);
  const opts={
    isEndless,
    isStory:!G.endlessMode,
    diffMult,
    playerBirdLevel:Math.max(1, Math.floor(G.player?.birdLevel||1)),
  };
  return (base?.isBoss)
    ? buildScaledBoss(base,stage,opts)
    : buildScaledEnemy(base,stage,opts);
}

// Physical dodge: base stat + active buff bonuses + card bonus (capped +5)
function getEffectiveDodge(p) {
  const cardBonus = Math.min(5, p.cardDodge || 0);
  const buffBonus = (G.playerStatus.humDodge&&G.playerStatus.humDodge.turns>0 ? G.playerStatus.humDodge.bonus : 0)
    + (G.playerStatus.battleHymnDodge&&G.playerStatus.battleHymnDodge.turns>0 ? G.playerStatus.battleHymnDodge.bonus : 0)
    + (G.playerStatus.evading>0&&G.playerStatus.evadeBonus ? G.playerStatus.evadeBonus : 0);
  if(G.playerStatus.sittingDuck) return 0;
  let dodge = (p.stats.dodge || 0) + buffBonus + cardBonus;
  dodge += (G.playerStatus.passiveDodge || 0);
  dodge -= getWeakenDodgePenalty(getWeakenStacks(G.playerStatus));
  if(typeof Avian?.dispatcher?.modifyDodge==='function') dodge = Avian.dispatcher.modifyDodge(dodge);
  return Math.max(0, dodge);
}

function chance(p){return Math.random()*100<p;}

// ------------------ STATUS HELPERS ------------------
function addStatus(obj,key,val,cap=99){ obj[key]=Math.min(cap,(obj[key]||0)+val); }
function setStatusMax(obj,key,val){ obj[key]=Math.max(obj[key]||0,val); }
/** Timed numeric status: refresh duration (Math.max), never stack turns. */
function refreshStatus(obj,key,turns,cap=99){ obj[key]=Math.min(cap,Math.max(obj[key]||0,Math.max(1,Math.floor(Number(turns)||1)))); }

function getGuardedPhysReducPct(status){
  const g=status?.guarded;
  if(!g||typeof g!=='object') return 0;
  const turns=Math.floor(Number(g.turns)||0);
  if(turns<=0) return 0;
  return Math.max(0, Math.min(90, Number(g.physReducPct)||0));
}

function applyGuardedBuff(side, opts={}){
  const status=side==='enemy'?G.enemyStatus:G.playerStatus;
  if(!status) return;
  const pct=Math.max(0, Math.min(90, Math.floor(Number(opts.physReducPct)||0)));
  const turns=Math.max(1, Math.floor(Number(opts.turns)||1));
  const sourceAbilityId=opts.sourceAbilityId?String(opts.sourceAbilityId):'';
  const cur=status.guarded;
  if(cur&&typeof cur==='object'){
    status.guarded={
      turns:Math.max(cur.turns||0, turns),
      physReducPct:Math.max(Number(cur.physReducPct)||0, pct),
      sourceAbilityId:sourceAbilityId||cur.sourceAbilityId||'',
    };
  }else{
    status.guarded={turns, physReducPct:pct, sourceAbilityId};
  }
}

function tickGuardedStatus(status){
  if(!status?.guarded||typeof status.guarded!=='object') return;
  status.guarded.turns=Math.max(0, Math.floor(Number(status.guarded.turns)||0)-1);
  if(status.guarded.turns<=0) delete status.guarded;
}

function playerIsGuarding(playerStatus){
  const s=playerStatus||{};
  if((s.defending||0)>0) return true;
  return getGuardedPhysReducPct(s)>0;
}

function resolveGuardedReductionPct(row, riderValue=0, ab=null){
  const explicit=Number(riderValue)||0;
  if(explicit>0) return Math.min(90, explicit);
  const text=String(row?.riderText||row?.shortDesc||'');
  const m=text.match(/(\d+(?:\.\d+)?)\s*%\s*damage\s*reduction/i);
  if(m) return Math.min(90, Number(m[1]));
  const level=Math.max(1, Math.floor(Number(ab?.level)||Number(row?.level)||1));
  const ap=Math.max(1, Math.floor(Number(row?.apCost)||1));
  let base=15, step=5;
  if(ap===2){ base=22; step=6; }
  else if(ap>=3){ base=30; step=7; }
  return Math.min(50, base+(level-1)*step);
}
/** Source-keyed stat loan: same source refreshes magnitude + duration; different sources may combine. */
function applySourceStatLoan(ps,player,bagName,statKey,sourceId,value,turns=1){
  if(!ps||!player||!player.stats||!statKey) return 0;
  if(!ps[bagName]) ps[bagName]=Object.create(null);
  const bag=ps[bagName];
  const slotKey=statKey+':'+String(sourceId||'unknown');
  const prev=bag[slotKey];
  if(prev&&prev.amt){
    player.stats[statKey]=Math.max(0,Math.round(((player.stats[statKey]||0)-(prev.amt||0))*100)/100);
  }
  const amt=Math.max(prev?(prev.amt||0):0,Number(value)||0);
  if(amt>0){
    player.stats[statKey]=Math.round(((player.stats[statKey]||0)+amt)*100)/100;
    bag[slotKey]={statKey,amt,turns:Math.max(1,Math.floor(Number(turns)||1)),sourceId:String(sourceId||'')};
  }else if(bag[slotKey]) delete bag[slotKey];
  return amt;
}
function decaySourceStatLoans(ps,player,bagName){
  if(!ps||!player||!player.stats||!ps[bagName]) return;
  const bag=ps[bagName];
  for(const k in bag){
    const entry=bag[k];
    if(!entry) continue;
    entry.turns=(entry.turns||1)-1;
    if(entry.turns<=0){
      const sk=entry.statKey||String(k).split(':')[0];
      player.stats[sk]=Math.max(0,Math.round(((player.stats[sk]||0)-(entry.amt||0))*100)/100);
      delete bag[k];
    }
  }
  if(!Object.keys(bag).length) delete ps[bagName];
}
/** Percentage stat loan: computes amt from current stat (minus this source's prior loan), then delegates to applySourceStatLoan. */
function applySourceStatLoanPct(ps,player,bagName,statKey,sourceId,pct,turns=1){
  if(!ps||!player||!player.stats||!statKey) return 0;
  if(!ps[bagName]) ps[bagName]=Object.create(null);
  const bag=ps[bagName];
  const slotKey=statKey+':'+String(sourceId||'unknown');
  const prev=bag[slotKey];
  let base=Number(player.stats[statKey])||0;
  if(prev&&prev.amt) base=Math.max(0,Math.round((base-(prev.amt||0))*100)/100);
  const amt=Math.max(0,Math.round(base*(Number(pct)||0)/100*100)/100);
  return applySourceStatLoan(ps,player,bagName,statKey,sourceId,amt,turns);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function clampSkipChance(v){return Math.max(20,Math.min(35,Math.round(v||20)));}
const STATUS_CONFUSED_SELF_PCT = 30;
const STATUS_FEAR_SKIP_PCT = 30;
const WEAKEN_MAX_STACKS = 3;
const WEAKEN_TURNS_DEFAULT = 3;
function getWeakenStacks(statusObj){
  if(!statusObj) return 0;
  const w=statusObj.weaken;
  if(!w) return 0;
  if(typeof w==='number') return w>0?1:0;
  return Math.min(WEAKEN_MAX_STACKS, Math.max(0, Math.floor(Number(w.stacks)||0)));
}
function getWeakenDamageMult(stacks){
  const n=Math.max(0, Math.min(WEAKEN_MAX_STACKS, Number(stacks)||0));
  return Math.max(0.7, 1 - 0.1 * n);
}
function getWeakenDodgePenalty(stacks){
  return 10 * Math.max(0, Math.min(WEAKEN_MAX_STACKS, Number(stacks)||0));
}
function applyWeakenStack(target, addStacks=1){
  const status=target==='player'?G.playerStatus:G.enemyStatus;
  if(!status) return;
  let w=status.weaken;
  if(typeof w==='number' && w>0) w={stacks:1, turns:w};
  else if(!w || typeof w!=='object') w={stacks:0, turns:0};
  w.stacks=Math.min(WEAKEN_MAX_STACKS, (w.stacks||0)+Math.max(1, Math.floor(Number(addStacks)||1)));
  w.turns=WEAKEN_TURNS_DEFAULT;
  status.weaken=w;
}
function getEffectiveEnemyDodgeForPlayerHit(){
  let d = (G.enemy?.stats?.dodge ?? 0);
  const pen=getWeakenDodgePenalty(getWeakenStacks(G.enemyStatus));
  return Math.max(0, d - pen);
}
function scaleHealForBleed(who, raw){
  const st = who==='player' ? G.playerStatus : G.enemyStatus;
  const b = st?.bleed;
  const hasBleed = !!(b && ((b.turns||0)>0 || (b.stacks||0)>0));
  if(!hasBleed) return roundCombatDamage(raw);
  return roundCombatDamage(Math.max(0.01, raw * 0.5));
}
function normalizeBurningTurns(v){
  if(v==null) return 3;
  if(typeof v==='number') return Math.max(1, v);
  if(typeof v==='object') return Math.max(1, v.turns||3);
  return 3;
}
function enemyHasBurning(){
  const b = G.enemyStatus?.burning;
  return !!b && ((typeof b==='number'&&b>0) || (typeof b==='object'&&(b.turns||0)>0));
}
function playerHasBurning(){
  const b = G.playerStatus?.burning;
  return !!b && ((typeof b==='number'&&b>0) || (typeof b==='object'&&(b.turns||0)>0));
}
function applyChilledStacksToEnemy(addStacks){
  const status = G.enemyStatus;
  if(!status.chilled) status.chilled={stacks:0,turns:0,baseSpd:null};
  const cap = 5;
  const baseTurns = 2;
  const extraTurns = (G.player?.chillExtraTurns||0);
  if(status.chilled.baseSpd==null) status.chilled.baseSpd = Math.max(1, Number(G.enemy?.stats?.spd)||1);
  const prev = Math.min(cap, status.chilled.stacks||0);
  const next = Math.min(cap, prev + Math.max(1, Math.floor(Number(addStacks)||1)));
  status.chilled.stacks = next;
  status.chilled.turns = Math.max(status.chilled.turns||0, baseTurns+extraTurns);
  const base = status.chilled.baseSpd;
  G.enemy.stats.spd = Math.max(1, Math.floor(base * (1 - 0.08 * next)));
  if(next>=cap){
    const bs=status.chilled.baseSpd;
    delete status.chilled;
    status.frozen={turns:1,baseSpd:bs};
    logMsg(`❄ ${G.enemy.name} is Frozen!`,'system');
  }
  return true;
}
function rollStunChance(v){return chance(Math.min(50,Math.max(0,v||0)));}
function applyEnemySlow(spdPenalty,dodgePenalty,turns){
  if(!G.enemyStatus.slow){
    const spdDrop=Math.min(spdPenalty,Math.max(0,(G.enemy.stats.spd||1)-1));
    G.enemy.stats.spd=Math.max(1,(G.enemy.stats.spd||1)-spdDrop);
    G.enemy.stats.dodge=Math.max(0,(G.enemy.stats.dodge||0)-dodgePenalty);
    G.enemyStatus.slow={turns,spdPenalty:spdDrop,dodgePenalty};
  }else{
    G.enemyStatus.slow.turns=Math.max(G.enemyStatus.slow.turns,turns);
    G.enemyStatus.slow.spdPenalty=Math.max(G.enemyStatus.slow.spdPenalty,spdPenalty);
    G.enemyStatus.slow.dodgePenalty=Math.max(G.enemyStatus.slow.dodgePenalty,dodgePenalty);
  }
}
/**
 * Combat duration policy (skill audit):
 * - Stat modifiers (player/enemy ATK, MATK, DEF, MDEF, ACC, dodge, SPD, etc.): default **1 turn**
 *   unless a skill is explicitly designed as sustained; same-ability refresh should replace, not stack.
 * - Ailments (Fear, Poison, Burn, Confused, Paralyze, Weaken-as-ailment track, etc.): **not** capped at 1 turn;
 *   durations may scale with skill level / template rules via applyAilment, tryApplyAilment, and bespoke handlers.
 * - **Miss vs on-hit debuff:** for damaging attacks, extra ailments/riders should run only after a real hit (e.g. dealDamage
 *   with dmg>0, or a hit branch after a per-swing miss roll). Pure control songs (e.g. dirge, lullaby) intentionally skip
 *   accuracy rolls — do not fold them into generic “miss = no debuff” without a balance review.
 */
/** Next offensive player action: mult add on physical (pdmg) and magic (matk), plus hit/crit helpers. Promoted in playerAction. */
function applyPendingStrikeBuff(opts={}){
  const multAdd=Number(opts.multAdd!=null?opts.multAdd:opts.damagePct)||0;
  const matkMultAdd=opts.matkMultAdd!=null?Number(opts.matkMultAdd):multAdd;
  const hitBonus=Math.max(0,Number(opts.hitBonus)||0);
  const critBonus=Math.max(0,Number(opts.critBonus)||0);
  const sourceAbilityId=String(opts.sourceAbilityId||opts.sourceId||'');
  const next={multAdd,matkMultAdd,hitBonus,critBonus,sourceAbilityId};
  const cur=G.playerStatus.pendingStrikeBuff;
  if(cur && sourceAbilityId && cur.sourceAbilityId===sourceAbilityId){
    G.playerStatus.pendingStrikeBuff=next;
    return;
  }
  G.playerStatus.pendingStrikeBuff=next;
}

/** Timed **stat-style** player buff (dodge/ACC/SPD shards, etc.): default 1 turn. Not for DoT/control ailments—those use ailment paths. Same sourceAbilityId replaces on that key. */
function applyPlayerTimedBuff(key, props, opts={}){
  if(!key) return;
  const turns=Math.max(1,Math.floor(opts.turns!=null?opts.turns:1));
  const sourceAbilityId=String(opts.sourceAbilityId||opts.sourceId||'');
  const next={...props, turns, sourceAbilityId};
  const cur=G.playerStatus[key];
  if(cur && typeof cur==='object' && sourceAbilityId && cur.sourceAbilityId===sourceAbilityId){
    G.playerStatus[key]={...cur, ...next};
    return;
  }
  G.playerStatus[key]=next;
}

function promotePendingStrikeBuffToActive(){
  const p=G.playerStatus?.pendingStrikeBuff;
  if(!p) return;
  delete G.playerStatus.pendingStrikeBuff;
  G._pendingStrikeActionMods={
    multAdd:Number(p.multAdd)||0,
    matkMultAdd:Number(p.matkMultAdd!=null?p.matkMultAdd:p.multAdd)||0,
    hitBonus:Math.max(0,Number(p.hitBonus)||0),
    critBonus:Math.max(0,Number(p.critBonus)||0),
    sourceAbilityId:p.sourceAbilityId||'',
  };
}

function applyPlayerSlow(spdPenalty,dodgePenalty,turns){
  if(!G.playerStatus.slow || typeof G.playerStatus.slow!=='object'){
    const spdDrop=Math.min(spdPenalty,Math.max(0,(G.player.stats.spd||1)-1));
    G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-spdDrop);
    G.player.stats.dodge=Math.max(0,(G.player.stats.dodge||0)-dodgePenalty);
    G.playerStatus.slow={turns,spdPenalty:spdDrop,dodgePenalty};
  }else{
    G.playerStatus.slow.turns=Math.max(G.playerStatus.slow.turns||0,turns);
    G.playerStatus.slow.spdPenalty=Math.max(G.playerStatus.slow.spdPenalty||0,spdPenalty);
    G.playerStatus.slow.dodgePenalty=Math.max(G.playerStatus.slow.dodgePenalty||0,dodgePenalty);
  }
}

/** Refresh-only enemy dodge shred used by striker marks (toucan color / flamingo mire). */
function refreshEnemyStrikerDodgeMark(dodgeCut, turns){
  const t=Math.max(1,Math.floor(turns||2));
  const s=G.enemyStatus.strikerDodgeMark;
  if(s && (s.amt||0)>0){
    G.enemy.stats.dodge=(G.enemy.stats.dodge||0)+(s.amt||0);
  }
  const cur=Math.max(0,G.enemy.stats.dodge||0);
  const amt=Math.min(cur,Math.max(0,Math.floor(dodgeCut||0)));
  G.enemy.stats.dodge=cur-amt;
  G.enemyStatus.strikerDodgeMark={amt,turns:t};
}

function getAbilityLifestealPct(abOrId){
  const tmpl=getAbilityTemplateForUI(abOrId);
  const row=tmpl?._combatPackRow;
  if(!row) return 0;
  return Math.max(0, Number(row.lifestealPct) || 0);
}

function resolveAbilityCombatRow(srcAbility){
  if(G._dispatcherCombatRow) return G._dispatcherCombatRow;
  const ab=srcAbility||G._activePlayerAbility||null;
  if(!ab) return null;
  const tmpl=getAbilityTemplateForUI(ab);
  return tmpl?._combatPackRow||ab?._dispatcherRow||null;
}

/** Row-based raw damage → curved defence. No EN power tier multiplier. */
function computeOutgoingDamageBase(isMagic, srcAbility, legacyAmount=0){
  const activeAb=srcAbility||G._activePlayerAbility||null;
  const row=resolveAbilityCombatRow(activeAb);
  const enCost=activeAb?getAbilityAuthoredEnergyCost(activeAb,G.player):1;
  let rawDamage=0;
  if(row&&typeof computeAbilityRawDamage==='function'){
    rawDamage=computeAbilityRawDamage(row, G.player.stats);
  }else if(legacyAmount>0){
    rawDamage=legacyAmount;
  }else{
    rawDamage=Math.max(0, Number(G.player?.stats?.atk)||0);
  }
  let pierce=isMagic?getMagicalPierceFractionForDamage(activeAb):getPhysicalPierceFractionForDamage(activeAb);
  if(G.playerStatus?.openingStrikePierce) pierce=Math.max(pierce,0.45);
  const rawDef=isMagic?(G.enemy.stats.mdef||0):(G.enemy.stats.def||0);
  const effDef=effectiveDefence(rawDef,pierce,{burning:enemyHasBurning()});
  const mitigated=typeof mitigatedDamage==='function'
    ? mitigatedDamage(rawDamage, effDef)
    : rawDamage*curvedDefenceMultiplier(effDef);
  return {rawDamage, mitigated, enCost, effectiveDef:effDef, row};
}

function collectDispatcherConditionalBonusFractions(row){
  const fractions=[];
  if(!row?.riders) return fractions;
  const es=G.enemyStatus||{};
  for(const r of row.riders){
    if(r.kind==='bonusVsAilment'&&r.ailment==='bleed'&&(es.bleed?.stacks||0)>0&&(r.value||0)>0){
      fractions.push(Number(r.value)/100);
    }else if(r.kind==='bonusVsLowHp'){
      const enemy=G.enemy?.stats;
      if(enemy&&enemy.hp&&enemy.maxHp&&enemy.hp<=Math.floor(enemy.maxHp*(r.threshold||0.35))&&(r.value||0)>0){
        fractions.push(Number(r.value)/100);
      }
    }
  }
  return fractions;
}

function collectOutgoingDamageBonusFractions(ctx){
  const {isAttack,isSpell,isMagic,activeAb,classPerkCtx,passiveEvoBonus,ailCount,hasPoison,hasChill}=ctx;
  const fractions=[];
  const p=G.player;
  const es=G.enemyStatus||{};
  const _burningNow=es.burning&&((typeof es.burning==='number'&&es.burning>0)||(typeof es.burning==='object'&&(es.burning.turns||0)>0));
  const _passId=BIRDS[p?.birdKey]?.passive?.id;

  if((p?.vsPoisonPctBonus||0)>0&&hasPoison) fractions.push(p.vsPoisonPctBonus);
  if((p?.vsChillPctBonus||0)>0&&hasChill) fractions.push(p.vsChillPctBonus);
  if(isSpell&&(p?.vsChillSpellPctBonus||0)>0&&hasChill) fractions.push(p.vsChillSpellPctBonus);
  if(enemyHasAfflictionForCardBonuses()&&(p?.vsAfflictedPctBonus||0)>0) fractions.push(p.vsAfflictedPctBonus);
  if((p?.vsMultiAfflictedPctBonus||0)>0){
    const need=Math.max(2,Number(p?.vsMultiAfflictedMinAilments)||2);
    if(ailCount>=need) fractions.push(p.vsMultiAfflictedPctBonus);
  }
  const dpp=p?.damagePerAilmentPct||0;
  const dpcap=p?.damagePerAilmentPctCap||0;
  if(dpp>0&&dpcap>0&&ailCount>0) fractions.push(Math.min(dpcap,dpp*ailCount));
  if(isAttack&&(p?.augAttackDmgPct||0)>0) fractions.push(p.augAttackDmgPct);
  if(p&&typeof Avian?.mutations?.getMechanicsRollup==='function'){
    const _eqM=Avian.mutations.getMechanicsRollup(p);
    const attackWeight=activeAb?getAbilityAttackWeight(activeAb,p):null;
    if(attackWeight==='light'&&(_eqM.lightAttackDmgPct||0)>0) fractions.push(_eqM.lightAttackDmgPct/100);
    if(attackWeight==='medium'&&(_eqM.mediumAttackDmgPct||0)>0) fractions.push(_eqM.mediumAttackDmgPct/100);
    if(attackWeight==='heavy'&&(_eqM.heavyAttackDmgPct||0)>0) fractions.push(_eqM.heavyAttackDmgPct/100);
    if(isMultiHitAbility(activeAb)&&(_eqM.multiHitDmgPct||0)>0) fractions.push(_eqM.multiHitDmgPct/100);
    if(_eqM.damageBonuses&&_eqM.damageBonuses.length){
      for(const db of _eqM.damageBonuses){
        if(!db||!db.pct) continue;
        if(db.tag==='light'&&attackWeight==='light') fractions.push(db.pct/100);
        else if(db.tag==='medium'&&attackWeight==='medium') fractions.push(db.pct/100);
        else if(db.tag==='heavy'&&attackWeight==='heavy') fractions.push(db.pct/100);
        else if((db.tag==='magic'||db.tag==='spell')&&isSpell) fractions.push(db.pct/100);
        else if(db.tag==='generic'||!db.tag) fractions.push(db.pct/100);
      }
    }
  }
  if(isSpell&&!G._firstSpellUsed&&(p?.firstSpellBattleBonusPct||0)>0) fractions.push(p.firstSpellBattleBonusPct);
  if(isSpell&&(p?.everyFourthSpellBonusPct||0)>0&&(((G._spellCastCount||0)+1)%4===0)) fractions.push(p.everyFourthSpellBonusPct);
  if(isSpell&&(p?.augFourthSpellEcho||0)>0&&(((G._spellCastCount||0)+1)%4===0)) fractions.push(p.augFourthSpellEcho);
  if(isSpell&&(p?.augSpellDmgPct||0)>0) fractions.push(p.augSpellDmgPct);
  if(isSpell&&(es.poison?.stacks||0)>0&&(p?.augSpellVsPoisonPct||0)>0) fractions.push(p.augSpellVsPoisonPct);
  if(isSpell&&(es.feared||0)>0&&(p?.augSpellVsFearPct||0)>0) fractions.push(p.augSpellVsFearPct);
  if(isAttack&&(p?.augAttackVsBleedPct||0)>0&&(es.bleed?.stacks||0)>0) fractions.push(p.augAttackVsBleedPct);
  if(isAttack&&!isMagic&&(p?.knightPhysBonus||0)>0&&playerIsKnightClass(p)) fractions.push(p.knightPhysBonus);
  if(isAttack&&(p?.augFirstAttackBattlePct||0)>0&&!G._firstAttackUsed) fractions.push(p.augFirstAttackBattlePct);
  if(isAttack&&(p?.augAttackExecutePct||0)>0&&G.enemy.stats.hp<=Math.floor((G.enemy.stats.maxHp||1)*0.5)) fractions.push(p.augAttackExecutePct);
  if(classPerkCtx.warBody&&(p.stats.hp||1)<=Math.floor((p.stats.maxHp||1)*0.5)) fractions.push(0.10);
  if(classPerkCtx.openingRush&&isAttack&&!G._firstAttackUsed) fractions.push(0.15);
  if(classPerkCtx.markedForDeath&&(es.feared||0)>0) fractions.push(0.15);
  if(_passId==='passive_toucan_prism_beak'&&_burningNow&&(isAttack||isSpell)) fractions.push(0.10);
  if(_passId==='passive_firecrest_emberwake'&&_burningNow&&(isAttack||isSpell)) fractions.push(0.10);
  if(_passId==='passive_raven_grim_opportunity'&&(isAttack||isSpell)){
    const deb=(es.poison?.stacks||0)>0||(es.bleed?.stacks||0)>0||(es.feared||0)>0||getWeakenStacks(es)>0||(es.paralyzed||0)>0||!!es.confused||_burningNow||(es.chilled?.stacks||0)>0||(es.accDebuff||0)>0;
    if(deb) fractions.push(0.04);
  }
  if(classPerkCtx.executionLine&&(G.enemy.stats.hp||1)<=Math.floor((G.enemy.stats.maxHp||1)*0.4)) fractions.push(0.20);
  if(classPerkCtx.patientHunter&&!G._perkFirstVsFullUsed&&(G.enemy.stats.hp||0)>=(G.enemy.stats.maxHp||1)){
    fractions.push(0.15);
    G._perkFirstVsFullUsed=true;
  }
  if((G.playerStatus?.holdTheLineBoost||0)>0&&isAttack) fractions.push(0.10);
  if(isAttack&&(p?.augThirdAttackPct||0)>0){
    p._augAtkCounter=(p._augAtkCounter||0)+1;
    if((p._augAtkCounter%3)===0) fractions.push(p.augThirdAttackPct);
  }
  if(G.playerStatus?.huntersMarkBonusPct){ fractions.push(G.playerStatus.huntersMarkBonusPct); delete G.playerStatus.huntersMarkBonusPct; }
  if(G.playerStatus?.cockatooReadExtra){
    if(macawEnemyHasDebuff()) fractions.push(G.playerStatus.cockatooReadExtra);
    delete G.playerStatus.cockatooReadExtra;
  }
  if(es.exposedGuard?.pct) fractions.push(es.exposedGuard.pct);
  if(G.playerStatus?.postDefAtkPct){ fractions.push(G.playerStatus.postDefAtkPct); delete G.playerStatus.postDefAtkPct; }
  if(G.playerStatus?.tensionCoil?.turns>0) fractions.push(G.playerStatus.tensionCoil.pct);
  if(p?.mutSuddenFlight&&!p._mutSuddenFlightUsed){ fractions.push(0.25); p._mutSuddenFlightUsed=true; }
  if(p?.mutHuntersCruelty&&G.enemy.stats.hp<=Math.floor((G.enemy.stats.maxHp||1)*0.5)) fractions.push(0.20);
  if(p?.mutRazorInstinct&&!ctx.isCrit) fractions.push(-0.10);
  if(isAttack&&!G.playerTurnFlags?.firstAttackResolved&&(p?.firstAttackEachTurnBonusPct||0)>0){
    fractions.push(p.firstAttackEachTurnBonusPct);
    if(G.playerTurnFlags) G.playerTurnFlags.firstAttackResolved=true;
  }
  if(isAttack&&!G._firstAttackUsed&&(p?.firstAttackEachBattleBonusPct||0)>0) fractions.push(p.firstAttackEachBattleBonusPct);
  if((passiveEvoBonus.damagePct||0)>0) fractions.push(passiveEvoBonus.damagePct);
  if(G._dispatcherCombatRow) fractions.push(...collectDispatcherConditionalBonusFractions(G._dispatcherCombatRow));
  if((G.playerStatus?.holdTheLineBoost||0)>0&&isAttack) delete G.playerStatus.holdTheLineBoost;
  if(_passId==='passive_raven_grim_opportunity'&&(isAttack||isSpell)){
    const deb=(es.poison?.stacks||0)>0||(es.bleed?.stacks||0)>0||(es.feared||0)>0||getWeakenStacks(es)>0||(es.paralyzed||0)>0||!!es.confused||_burningNow||(es.chilled?.stacks||0)>0||(es.accDebuff||0)>0;
    if(deb&&!p._ravenGrimSpdThisTurn){ p.stats.spd=(p.stats.spd||1)+4; p._ravenGrimSpdThisTurn=true; p._ravenGrimSpdLoan=4; }
  }
  return fractions;
}

function applyLifestealFromDamage(dmg, srcAbility){
  if(dmg<=0 || !G.player) return;
  const pct=getAbilityLifestealPct(srcAbility||G._activePlayerAbility);
  if(pct<=0) return;
  const heal=scaleHealForBleed('player', roundCombatDamage(Math.max(0.01, dmg * pct / 100)));
  if(heal<=0) return;
  G.player.stats.hp=Math.min(G.player.stats.maxHp||1, (G.player.stats.hp||0)+heal);
  spawnFloat('player', `+${heal} 💉`, 'fn-heal');
}

function getEnemyAbilityAuthoredEnCost(ab){
  if(!ab) return 1;
  const tmpl=getAbilityTemplateForUI(ab);
  return Math.max(1, Number(tmpl?.energy ?? tmpl.energyCost ?? tmpl?.apCost ?? ab?.energy ?? ab?.energyCost ?? 1));
}

function computeEntityAbilityRawDamage(entity, ab, tmpl, isMagic){
  const row=tmpl?._combatPackRow||ab?._dispatcherRow||null;
  const stats=entity?.stats||entity||{};
  if(row&&typeof computeAbilityRawDamage==='function'){
    return Math.max(1, Math.round(computeAbilityRawDamage(row, stats)));
  }
  if(isMagic) return Math.max(1, Math.floor(Number(stats.matk||8)));
  return Math.max(1, Math.floor(Number(stats.atk||8)));
}

function applyCurvedMitigationToPlayer(preMit,isMagic,srcAbility){
  const _aura=getPassiveDefMdefBonuses();
  const rawDef=isMagic
    ? ((G.player.stats.mdef||0)+_aura.mdef)
    : ((G.player.stats.def||0)+_aura.def);
  let pen=0;
  if(isMagic){
    pen=Math.min(0.95, (Number(srcAbility?.pierceMdef)||0)/100 + (Number(G._currentPiercePct)||0)/100);
  } else if(srcAbility){
    pen=getPhysicalPierceFractionForDamage(srcAbility);
  }
  const effDef=effectiveDefence(rawDef,pen,{burning:playerHasBurning()});
  return Math.max(0, preMit*curvedDefenceMultiplier(effDef));
}

function computePlayerCritDamageAdd(activeAb){
  let critDmgAdd=Number(G.player?.critDamageBonusPct)||0;
  if(typeof Avian?.mutations?.getMechanicsRollup==='function'){
    const _eqCritM=Avian.mutations.getMechanicsRollup(G.player);
    if((_eqCritM.critDamageBonusPct||0)>0) critDmgAdd+=_eqCritM.critDamageBonusPct/100;
  }
  if((G.player?.critVsAfflictedBonusPct||0)>0 && enemyHasAfflictionForCardBonuses()) critDmgAdd+=G.player.critVsAfflictedBonusPct;
  const _pid=BIRDS[G.player?.birdKey]?.passive?.id;
  const es=G.enemyStatus||{};
  if(_pid==='passive_snowyowl_whiteout_stalker'){
    const delayed=!!(es.delayed&&es.delayed.dmg>0);
    const chill=(es.chilled?.stacks||0)>0;
    if(delayed||chill) critDmgAdd+=0.10;
  }
  if(_pid==='passive_cassowary_terror_kick' && getWeakenStacks(es)>0) critDmgAdd+=0.10;
  if(_pid==='passive_vulture_carrion_sense' && (es.bleed?.stacks||0)>0) critDmgAdd+=0.10;
  if(_pid==='passive_harpy_apex_grip'){
    const ab=activeAb;
    const k=String(ab?.btnType||ab?.type||ABILITY_TEMPLATES?.[ab?.id]?.btnType||'').toLowerCase();
    if((k==='physical'||k==='ranged') && !G._firstAttackUsed) critDmgAdd+=0.10;
  }
  if((G.playerStatus.galahCritDmg||0)>0) critDmgAdd+=Math.max(0,G.playerStatus.galahCritDmg)/100;
  const _tcb=G.playerStatus.tricksterCritDmgBuff;
  if(_tcb && (_tcb.turns||0)>0 && (_tcb.pct||0)>0) critDmgAdd+=Math.max(0,_tcb.pct)/100;
  const tmpl=ABILITY_TEMPLATES?.[activeAb?.id]||{};
  const en=Number(tmpl.energy ?? tmpl.energyCost ?? activeAb?.energy ?? 1);
  if(_pid==='passive_bustard_heavy_steps' && en>=2) critDmgAdd+=0.10;
  if(_pid==='passive_shoebill_silent_stance' && !G.player._shoebillHadUtilityPriorTurn) critDmgAdd+=0.10;
  return critDmgAdd;
}

function dealDamage(target,amount,isCrit=false,isMagic=false,srcAbility=null) {
  const passiveEvoBonus=getPassiveEvolutionBonuses(G.player);
  const classPerkCtx=applyClassPerksToCombatContext(G.player?.birdKey,{});
  const activeAb=srcAbility||G._activePlayerAbility||null;
  const activeType=String(activeAb?.btnType||activeAb?.type||ABILITY_TEMPLATES?.[activeAb?.id]?.btnType||ABILITY_TEMPLATES?.[activeAb?.id]?.type||'').toLowerCase();
  const isAttack=(activeType==='physical'||activeType==='ranged');
  const isSpell=(activeType==='spell');
  let damageMeta=null;
  let dmg;
  if(target==='enemy'){
    const legacyAmount=(amount>0&&!resolveAbilityCombatRow(activeAb))?amount:0;
    damageMeta=computeOutgoingDamageBase(isMagic,activeAb,legacyAmount);
    dmg=roundCombatDamage(Math.max(0.01, damageMeta.mitigated));
    G._lastCurvedDamageMeta=damageMeta;
    isCrit=false;
  } else {
    dmg=roundCombatDamage(Math.max(0.01, amount));
  }
  if(target==='enemy'){
    const esAff=G.enemyStatus||{};
    const hasPoison=(esAff.poison?.stacks||0)>0;
    const hasChill=(esAff.chilled?.stacks||0)>0;
    const ailCount=countAilmentCategoriesOnEnemy();
    if(esAff.bleed?.stacks>0){
      dmg += (G.player?.vsBleedFlatBonus||0);
      if((G.player?.vsBleedPctBonus||0)>0) dmg=roundCombatDamage(dmg*(1+G.player.vsBleedPctBonus));
    }
    const bonusFractions=collectOutgoingDamageBonusFractions({
      isAttack,isSpell,isMagic,activeAb,classPerkCtx,passiveEvoBonus,ailCount,hasPoison,hasChill,isCrit,
    });
    const totalMod=typeof sumAdditiveDamageBonus==='function'
      ? sumAdditiveDamageBonus(bonusFractions)
      : (1+bonusFractions.reduce((a,b)=>a+(Number(b)||0),0));
    dmg=roundCombatDamage(dmg*totalMod);
    if(typeof Avian?.passives?.applyDamageBonus==='function'){
      dmg=Avian.passives.applyDamageBonus(dmg,activeAb,{isAttack,isSpell,isMagic});
    }
    if(typeof Avian?.dispatcher?.applyDispatcherHitMods==='function'){
      dmg=Avian.dispatcher.applyDispatcherHitMods(dmg);
    }else if(G._dispatcherCombatRow && typeof Avian?.dispatcher?.applyPostCurveModifiers==='function'){
      dmg=Avian.dispatcher.applyPostCurveModifiers(dmg,G._dispatcherCombatRow);
    }
    const _passId=BIRDS[G.player?.birdKey]?.passive?.id;
    if(!isMagic && classPerkCtx.predatorRhythm && (G.playerActionsThisTurn||0)===2 && chance(10)) isCrit=true;
    if(!isCrit && typeof getPlayerCritChance==='function' && chance(getPlayerCritChance(activeAb))) isCrit=true;
    if(isCrit){
      const critDmgAdd=computePlayerCritDamageAdd(activeAb);
      const critMult=(G.player.goldCritMult||BASE_CRIT_DAMAGE||1.5)+critDmgAdd;
      dmg=roundCombatDamage(dmg*critMult);
      if(_passId==='passive_magpie_shiny_opportunist' && isAttack && !(G.player._magpieCritSpdThisTurn)){
        G.player._magpieCritSpdThisTurn=true;
        G.playerStatus.magpieSpdNext=4;
      }
    }
    if(typeof globalThis.avianApplySynergyConsumeDamage==='function'){
      dmg=globalThis.avianApplySynergyConsumeDamage('enemy',isCrit,isMagic,dmg);
    }
    if(damageMeta){
      dmg=applyMinimumDamage(roundCurvedDamage(dmg),damageMeta.enCost);
    }
  }
  let wasBlocked=false;
  if (target==='enemy') {
    if(!isMagic){
      const enemyGuardedPct=getGuardedPhysReducPct(G.enemyStatus);
      if(enemyGuardedPct>0) dmg=roundCombatDamage(dmg*(1-enemyGuardedPct/100));
    }
    const def=G.enemyStatus.defending;
    const blockPct=0.4;
    if (def>0){dmg=roundCombatDamage(dmg*blockPct);wasBlocked=true;}
  }
  if (target==='player') {
    const enemyEnCost=getEnemyAbilityAuthoredEnCost(activeAb);
    const playerDodge = getEffectiveDodge(G.player);
    const enemyBaseAcc=Math.max(0, (G.enemy.stats.acc||70) - (G.enemyStatus.accDebuff||0) - (G.enemyStatus.enemyBlind>0?15:0));
    const hitPct=calculateAbilityHitChancePct(enemyBaseAcc, playerDodge, enemyEnCost);
    if (Math.random()*100>=hitPct){
      G._currentPiercePct=0;
      const _pbd=BIRDS[G.player.birdKey]; if(_pbd&&_pbd.passive&&_pbd.passive.onDodge)_pbd.passive.onDodge(G.player);
      if((G.player?.healOnDodge||0)>0){
        const heal=scaleHealForBleed('player',Math.max(0,G.player.healOnDodge||0));
        G.player.stats.hp=Math.min(G.player.stats.maxHp,G.player.stats.hp+heal);
        spawnFloat('player',`+${heal}`,'fn-heal');
      }
      if(classPerkCtx.slipstream){
        G.playerStatus.perkSlipstream=1;
      }
      return {dmgDealt:0,wasDodged:true,wasBlocked:false,isCrit,isMagic};
    }
    dmg=roundCombatDamage(applyCurvedMitigationToPlayer(dmg,isMagic,activeAb));
    G._currentPiercePct=0;
    if((G.enemyStatus?.feared||0)>0 && G.player?.relTerrorLedger) dmg=roundCombatDamage(dmg*0.90);
    if(G.playerStatus?.ironResolve && G.playerStatus.ironResolve.turns>0) dmg=roundCombatDamage(dmg*0.80);
    const _bd=BIRDS[G.player.birdKey];
    const _p=_bd&&_bd.passive;
    if(isMagic){
      // Harpy: magicResist flat %
      if(_p&&_p.magicResist) dmg=roundCombatDamage(dmg*(1-_p.magicResist));
      // Emperor Penguin: Blubber Coat scales with missing HP
      if(_p&&_p.onMagicHit){ const reduced=_p.onMagicHit(G.player,dmg); dmg=Math.max(1,reduced); }
    } else {
      // Physical resist (Goose Bruised Hide)
      if(_p&&_p.physicalResist) dmg=roundCombatDamage(dmg*(1-_p.physicalResist));
      const guardedPct=getGuardedPhysReducPct(G.playerStatus);
      if(guardedPct>0) dmg=roundCombatDamage(dmg*(1-guardedPct/100));
    }
    if(!isCrit){
      const rr=rollEnemyCritDamage(dmg);
      dmg=rr.amount;
      isCrit=rr.isCrit;
    }
    dmg=applyMinimumDamage(roundCurvedDamage(dmg), enemyEnCost);
    const bypassDeflect=!!G._incomingBypassesDeflect;
    if(G.playerStatus.parry&&G.playerStatus.parry>0){
      const isParryValid=(G._incomingAttackKind==='physical'||G._incomingAttackKind==='ranged')&&!bypassDeflect;
      const preParryDamage=dmg;
      if(isParryValid){
        const refl=Math.max(1,Math.floor(preParryDamage*(G.playerStatus.parryMult||2)));
        G.enemy.stats.hp-=refl; setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
        spawnFloat('enemy',`🗡-${refl}`,'fn-dmg');
        logMsg(`🗡 Parry reflected ${refl} damage!`,'system');
        dmg=Math.max(0,Math.floor(preParryDamage*(G.playerStatus.parryTakenMult??0.5)));
      } else {
        logMsg('🗡 Parry failed — enemy used magic/song.','miss');
      }
      G.playerStatus.parry=Math.max(0,(G.playerStatus.parry||1)-1);
      if(G.playerStatus.parry<=0){delete G.playerStatus.parry;delete G.playerStatus.parryLevel;delete G.playerStatus.parryMult;delete G.playerStatus.parryTakenMult;}
      renderStatuses('player-status',G.playerStatus);
    }
    const _firstHitRed=Math.max((G.player?.firstHitReduce||0),(G.player?.relIronLedger?0.12:0));
    if(_firstHitRed>0 && !G.player._firstHitReducedUsed){
      dmg=roundCombatDamage(dmg*(1-_firstHitRed));
      G.player._firstHitReducedUsed=true;
    }
    if((passiveEvoBonus.drPct||0)>0){
      dmg=roundCombatDamage(dmg*(1-passiveEvoBonus.drPct));
    }
    applyFractionalHp(G.player.stats, -dmg);
    if(BIRDS[G.player?.birdKey]?.passive?.id==='passive_bluejay_territorial_fury' && dmg>0) G.player._blueJayRecentHit=true;
    if((G.player?.lowHpSpdBonus||0)>0 && !G.player._lowHpSpdApplied && G.player.stats.hp<=Math.floor((G.player.stats.maxHp||1)*0.5)){
      G.player.stats.spd=(G.player.stats.spd||0)+G.player.lowHpSpdBonus;
      G.player._lowHpSpdApplied=true;
    }
    if((G.player?.lowHpDefBonus||0)>0 && !G.player._lowHpDefApplied && G.player.stats.hp<=Math.floor((G.player.stats.maxHp||1)*0.5)){
      G.player.stats.def=(G.player.stats.def||0)+G.player.lowHpDefBonus;
      G.player._lowHpDefApplied=true;
    }
    if((G.player?.survivorMoltHeal||0)>0 && !G.player._survivorMoltUsed && G.player.stats.hp>0 && G.player.stats.hp<=Math.floor((G.player.stats.maxHp||1)*0.3)){
      const heal=scaleHealForBleed('player',G.player.survivorMoltHeal);
      G.player.stats.hp=Math.min((G.player.stats.maxHp||1),G.player.stats.hp+heal);
      G.player._survivorMoltUsed=true;
      spawnFloat('player',`+${heal}`,'fn-heal');
    }
    if(G.playerStatus.countering&&dmg>0){
      const c=G.playerStatus.countering;
      const back=roundCombatDamage(dmg*(c.mult||1.2));
      G.enemy.stats.hp=Math.max(0,G.enemy.stats.hp-back);
      setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
      spawnFloat('enemy',`⚔-${back}`,'fn-crit');
      logMsg(`⚔ Counter retaliates for ${back}!`,'crit');
      c.turns=Math.max(0,(c.turns||1)-1);
      if(c.turns<=0) delete G.playerStatus.countering;
    }
    if(wasBlocked){
      const _blkbd=BIRDS[G.player.birdKey];
      if(_blkbd&&_blkbd.passive&&_blkbd.passive.onBlock)_blkbd.passive.onBlock(G.player);
      if(G.playerStatus.counterThorns){
        const thorn=roundCombatDamage(dmg*G.playerStatus.counterThorns);
        G.enemy.stats.hp=Math.max(0,G.enemy.stats.hp-thorn);
        setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
        spawnFloat('enemy',`🛡-${thorn}`,'fn-dmg');
        logMsg(`🛡 Defend thorns deal ${thorn}!`,'system');
      }
    }
    const _pbd2=BIRDS[G.player.birdKey]; if(_pbd2&&_pbd2.passive&&_pbd2.passive.onDamage)_pbd2.passive.onDamage(G.player,dmg);
    if(G.player._berserkerMode){if(!G.player._berserkDmgAcc)G.player._berserkDmgAcc=0;G.player._berserkDmgAcc+=dmg;while(G.player._berserkDmgAcc>=15){G.player._berserkDmgAcc-=15;G.player.stats.atk++;spawnFloat('player','⚔+1','fn-status');}}
  } else {
    if(G.playerStatus?.openingStrikePierce) delete G.playerStatus.openingStrikePierce;
    G._currentPiercePct=0;
    dmg=applyBossBurstBuffer(dmg);
    if(G._playerConfusesSelfThisAction){
      G._playerConfusesSelfThisAction=false;
      applyFractionalHp(G.player.stats, -dmg);
      setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
      spawnFloat('player',`🌀 -${formatCombatNumber(dmg)}`,'fn-dmg');
      logMsg(`🌀 Confused — you hit yourself for ${formatCombatNumber(dmg)}!`,'miss');
      return {dmgDealt:dmg,wasDodged:false,wasBlocked:false,isCrit,isMagic};
    }
    G.enemy.stats.hp = Math.max(0, Math.round((Number(G.enemy.stats.hp) - dmg) * 100) / 100);
    if(dmg>0) applyLifestealFromDamage(dmg, srcAbility||G._activePlayerAbility);
    const _atkKind=String(srcAbility?.btnType||srcAbility?.type||G._activePlayerAbility?.btnType||G._activePlayerAbility?.type||'').toLowerCase();
    if((_atkKind==='physical'||_atkKind==='ranged') && dmg>0){
      if(isCrit && (G.player?.healOnCrit||0)>0){
        const heal=scaleHealForBleed('player',Math.max(0,G.player.healOnCrit||0));
        G.player.stats.hp=Math.min(G.player.stats.maxHp,G.player.stats.hp+heal);
        spawnFloat('player',`+${heal}`,'fn-heal');
      }
      if((G.player?.bleedOnHitChance||0)>0 && chance(Math.min(95,G.player.bleedOnHitChance))) applyAilment('enemy','bleed',1);
      if((G.player?.poisonOnHitChance||0)>0 && chance(Math.min(95,G.player.poisonOnHitChance))) applyAilment('enemy','poison',1);
      if((G.player?.augAttackBleedChance||0)>0 && chance(Math.min(95,G.player.augAttackBleedChance))) applyAilment('enemy','bleed',1);
      if((G.player?.augCritBleed||0)>0 && isCrit) applyAilment('enemy','bleed',G.player.augCritBleed);
      if((G.player?.relCarrionLedger||false) && (G.enemyStatus?.bleed?.stacks||0)>0) G.enemy.stats.hp=Math.max(0,G.enemy.stats.hp-1);
      if((G.player?.augHuntersMarkPct||0)>0) G.playerStatus.huntersMarkBonusPct=G.player.augHuntersMarkPct;
      tryMutationOnHitAilments(dmg, false, true);
    }
    if(_atkKind==='spell' && dmg>0){
      if(G.player?.augSpellPoison) applyAilment('enemy','poison',1);
      if(G.player?.augSpellCritPoison && isCrit) applyAilment('enemy','poison',1);
      if(G.player?.augFirstSpellFear && !G._firstSpellUsed) applyAilment('enemy','feared',1);
      if((G.player?.chillOnSpellChance||0)>0 && chance(Math.min(95,G.player.chillOnSpellChance))) applyAilment('enemy','chilled',1);
      tryMutationOnHitAilments(dmg, true, false);
    }
    if(G.enemy?.id==='duke_blakiston' && (G.enemyStatus.wardens||0)>0){
      G.enemyStatus.wardens-=1;
      const rr=Math.max(1,Math.floor((G.enemy.stats.atk||8)*0.15));
      G.player.stats.hp-=rr;
      spawnFloat('player',`-${rr}`,'fn-dmg');
      logMsg('🛡️ Warden retaliates!','boss');
      setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
    }
    if(G.enemy.stats.hp<=0){
      G.enemy.stats.hp=0;
      setHpBar('enemy',0,G.enemy.stats.maxHp);
      if((G.player?.healOnKill||0)>0){
        const heal=scaleHealForBleed('player',Math.max(0,G.player.healOnKill||0));
        G.player.stats.hp=Math.min(G.player.stats.maxHp,G.player.stats.hp+heal);
        spawnFloat('player',`+${heal}`,'fn-heal');
      }

      // Prevent any further action; death flow handles transitions
      G.animLock=false;
      G.turnPhase=null;
      return {dmgDealt:dmg,wasDodged:false,wasBlocked,isCrit,isMagic};
    }
    const _secbd=BIRDS[G.player.birdKey];
    if(_secbd&&_secbd.passive&&_secbd.passive.onPhysicalHit&&!isMagic) _secbd.passive.onPhysicalHit(G.player,G);
    const abType=(srcAbility?.btnType||srcAbility?.type||G._activePlayerAbility?.btnType||G._activePlayerAbility?.type||'');
    const canBleedHit = (abType==='physical' || abType==='ranged');
    const bleedFromCrit = isCrit ? ((G.player?.critBleed||0) + (G.player?.passiveBleedOnCrit||0)) : 0;
    if(canBleedHit && bleedFromCrit>0) applyAilment('enemy','bleed',bleedFromCrit);
    registerHit();
    if(isAttack && (G.player._sheetNextCrit||0)>0) G.player._sheetNextCrit=0;
  }
  dmg=roundCombatDamage(dmg);
  return {dmgDealt:dmg,wasDodged:false,wasBlocked,isCrit,isMagic};
}

function pdmg(mult=1,ab=null,opts={}) {
  let b=G.player.stats.atk;
  if (G.warcryActive) b=Math.floor(b*(1+G.warcryATK/100));
  if (G.sitAndWaitActive) b=Math.floor(b*1.25);
  if (G.tookieActive && G.playerStatus.tookie) b=Math.floor(b*(1+G.playerStatus.tookie.atkBonus/100));
  const effCore=softenMainStatForCombat(b)*COMBAT_OFFENSIVE_STAT_MULT;
  const __adm=(G.actionDamageHitsRemaining&&G.actionDamageHitsRemaining>0)?(G.actionDamageMult||1):1;
  let strikeAdd=0;
  if(!opts.skipPendingStrikeAdd && G._pendingStrikeActionMods) strikeAdd=Number(G._pendingStrikeActionMods.multAdd)||0;
  let base=roundCombatDamage(rollCombatSpread(effCore*.8, effCore*1.2)*(mult+strikeAdd)*__adm);
  if((G.actionDamageHitsRemaining||0)>0){ G.actionDamageHitsRemaining=Math.max(0,G.actionDamageHitsRemaining-1); if(G.actionDamageHitsRemaining===0) G.actionDamageMult=1; }
  if(getWeakenStacks(G.playerStatus)>0) base=roundCombatDamage(base*getWeakenDamageMult(getWeakenStacks(G.playerStatus)));
  if(ab){
    const tmpl=getAbilityTemplateForUI(ab);
    const lv=Math.min(ab.level,4);
    let piercePct=(tmpl?.pierceDef||0) + (lv>=2?5:0) + (lv>=3?5:0);
    if(BIRDS[G.player.birdKey]?.passive?.id==='passive_kiwi_burrow_sense' && !G._firstAttackUsed) piercePct+=10;
    const enCost=Number(tmpl.energy ?? tmpl.energyCost ?? ab?.energy ?? 1);
    if(BIRDS[G.player.birdKey]?.passive?.id==='passive_secretary_long_leg_reach' && enCost<=1) piercePct+=10;
    G._currentPiercePct=Math.max(Number(G._currentPiercePct)||0,piercePct);
    if(G.player.birdKey==='kiwi'&&G.enemy.stats.hp/G.enemy.stats.maxHp>0.75) base=roundCombatDamage(base*1.10);
  } else {
    G._currentPiercePct=0;
  }
  return base;
}

/** Count distinct enemy debuff categories for alternate scaling (not stack depth). */
function countEnemyCombatDebuffCategories(){
  const s=G.enemyStatus||{};
  let n=0;
  if((s.feared||0)>0) n++;
  if(getWeakenStacks(s)>0) n++;
  if((s.paralyzed||0)>0) n++;
  if(s.confused) n++;
  if(s.burning) n++;
  if((s.poison?.stacks||0)>0) n++;
  if((s.bleed?.stacks||0)>0) n++;
  if((s.accDebuff||0)>0) n++;
  if(s.slow) n++;
  if((s.chilled?.stacks||0)>0) n++;
  if((s.exposedGuard?.pct||0)>0) n++;
  if((s.peregrineDefBreak?.defLost||0)>0) n++;
  if((s.owlArmorStress?.defLost||0)>0) n++;
  return n;
}
/** Categories counted for upgrade cards (ailment scaling / vs afflicted). */
function countAilmentCategoriesOnEnemy(){
  const s=G.enemyStatus||{};
  let n=0;
  if((s.poison?.stacks||0)>0) n++;
  if((s.bleed?.stacks||0)>0) n++;
  if((s.feared||0)>0) n++;
  if(getWeakenStacks(s)>0) n++;
  if((s.paralyzed||0)>0) n++;
  if(s.confused && ((typeof s.confused==='object'&&(s.confused.turns||0)>0))) n++;
  if(s.burning && ((typeof s.burning==='number'&&s.burning>0)||(typeof s.burning==='object'&&(s.burning.turns||0)>0))) n++;
  if((s.chilled?.stacks||0)>0) n++;
  if(s.slow && ((typeof s.slow==='object'&&(s.slow.turns||0)>0)||(typeof s.slow==='number'&&s.slow>0))) n++;
  if((s.accDebuff||0)>0) n++;
  if((s.exposedGuard?.pct||0)>0) n++;
  return n;
}
function enemyHasAfflictionForCardBonuses(){
  return countAilmentCategoriesOnEnemy()>0;
}
function selfDodgeBuffActive(){
  const h=G.playerStatus?.humDodge;
  return (h?.turns||0)>0 && (h?.bonus||0)>0;
}
function computeSecondaryStatFlatForPhysical(scaler, coeff, mult){
  if(!coeff||coeff<=0) return 0;
  const p=G.player?.stats||{};
  let stat=0;
  if(scaler==='SPD') stat=p.spd||0;
  else if(scaler==='DEF') stat=p.def||0;
  else if(scaler==='MATT'||scaler==='MATK') stat=p.matk||0;
  else return 0;
  const eff=softenMainStatForCombat(stat)*COMBAT_OFFENSIVE_STAT_MULT;
  const core=eff*coeff*(mult||1);
  if(core<0.5) return 0;
  return rollCombatSpread(Math.max(0.01, core*0.82), Math.max(0.01, core*1.18));
}
function applyConditionalPhysicalDamageMultipliers(subtotal, conditionalBonuses){
  let m=1;
  for(const c of conditionalBonuses||[]){
    if(!c||typeof c!=='object') continue;
    if(c.type==='while_self_buff_active' && c.buff==='dodge_up' && selfDodgeBuffActive()) m+=Number(c.damageBonus)||0;
    if(c.type==='per_target_debuff'){
      const maxS=Number.isFinite(c.maxStacks)?c.maxStacks:99;
      const stacks=Math.min(maxS, countEnemyCombatDebuffCategories());
      m+=stacks*(Number(c.damageBonusPerStack)||0);
    }
    if(c.type==='high_player_spd'){
      const th=Number(c.threshold);
      if(Number.isFinite(th) && (G.player.stats.spd||0)>=th) m+=Number(c.damageBonus)||0;
    }
    if(c.type==='while_guarding' && playerIsGuarding(G.playerStatus)) m+=Number(c.damageBonus)||0;
  }
  return Math.max(1, Math.floor(subtotal*m));
}
/** Optional ATT-primary physical damage with secondary stat / conditional bonuses (see ability.damageScaling). */
function pdmgWithAlternateScaling(mult=1, ab=null){
  const base=pdmg(mult, ab);
  if(!ab||!ab.id) return base;
  const sc=ABILITY_TEMPLATES[ab.id]?.damageScaling;
  if(!sc) return base;
  let total=base;
  if(sc.secondaryScaler && sc.secondaryScaleValue>0){
    total+=computeSecondaryStatFlatForPhysical(String(sc.secondaryScaler).toUpperCase(), Number(sc.secondaryScaleValue), mult);
  }
  return applyConditionalPhysicalDamageMultipliers(total, sc.conditionalBonuses);
}
function getAbilityDamageScalingHintForUI(ab){
  const ls=getAbilityLifestealPct(ab);
  if(ls>0) return ` Lifesteal ${ls}%`;
  const note=getAbilityTemplateForUI(ab)?.damageScaling?.scalingNote;
  return note?` ${String(note)}`:'';
}
function calcEnemyAbilityDamage(enemy,{stat='atk',base=0,scaling=1,variance=0.15}={}){
  const raw=Math.max(0,Number(enemy?.stats?.[stat]||enemy?.[stat]||0));
  const s=softenMainStatForCombat(raw)*COMBAT_OFFENSIVE_STAT_MULT;
  const core=base+(s*scaling);
  const lo=Math.max(1,Math.floor(core*(1-variance)));
  const hi=Math.max(lo,Math.floor(core*(1+variance)));
  return roll(lo,hi);
}

function applyBossBurstBuffer(rawDamage){
  const dmg=roundCombatDamage(Math.max(0, rawDamage||0));
  const e=G.enemy;
  if(!e?.isBoss) return dmg;
  const maxHp=Math.max(1, Number(e?.stats?.maxHp||e?.maxHp||1));
  const cap=roundCombatDamage(maxHp*0.40);
  if(dmg<=cap) return dmg;
  const excess=dmg-cap;
  return roundCombatDamage(cap+excess*0.70);
}

function edmg(mult=1) {
  const atk=G.enemy.stats.atk||0;
  const lull=(G.enemyStatus.lullabied>0)?0.5:1;
  const weak=getWeakenDamageMult(getWeakenStacks(G.enemyStatus));
  const ruffleReduct=G.enemyStatus.featherRuffle&&G.enemyStatus.featherRuffle.turns>0
    ?(1-(G.enemyStatus.featherRuffle.atkReduction||0)/100):1;
  let out=roundCombatDamage(Math.max(0.01, atk*(Number(mult)||1)*lull*weak*ruffleReduct));
  if((G.biomeMod?.lightningBonus||0)>0 && getEnemyKitAbilityIds(G.enemy).includes('eStun')){
    out=roundCombatDamage(out*(1+G.biomeMod.lightningBonus));
  }
  if((G.biomeMod?.enemyCritPlus||0)>0 && chance(Math.floor(G.biomeMod.enemyCritPlus*100))){
    out=roundCombatDamage(out*1.4);
  }
  return out;
}

function rollEnemyCritDamage(baseDamage){
  const raw=roundCombatDamage(Math.max(0.01, baseDamage||1));
  const cc=Math.max(0,Math.min(0.95,G.enemy?.stats?.cc??((G.enemy?.stats?.critChance||5)/100)));
  let cd=Math.max(1.1,Number(G.enemy?.stats?.cd??G.enemy?.stats?.critMult??1.5));
  const mutCrit=Number(G.enemy?._mutationMechanics?.critDamageBonusPct)||0;
  if(mutCrit>0) cd+=mutCrit/100;
  const isCrit=chance(Math.round(cc*100));
  return {amount:isCrit?roundCombatDamage(raw*cd):raw,isCrit};
}

function getPlayerMissChance(ab) {
  const tmpl=getAbilityTemplateForUI(ab);
  if (!tmpl) return 15;
  const classPerkCtx=applyClassPerksToCombatContext(G.player?.birdKey,{});
  const lv=Math.min(ab.level,4);
  const baseMiss=tmpl.baseMissChance!==undefined?tmpl.baseMissChance:15;
  const perLvReduction=(tmpl.type==='physical')?0:4;
  const reduced=Math.max(0,baseMiss-perLvReduction*(lv-1));
  // Floor: risky high-miss moves can never fully negate their risk
  const floor=baseMiss>=35?12:baseMiss>=25?7:baseMiss>=15?3:0;
  // Accuracy bonuses
  let accBonus=0;
  if (G.sitAndWaitActive) accBonus+=25;
  if (G.battleHymnActive) accBonus+=G.battleHymnACC;
  if (G.humMissBonus>0) accBonus+=G.humMissBonus;
  const tookiePenalty = G.tookieActive && G.playerStatus.tookie ? G.playerStatus.tookie.missPen : 0;
  const bClass=(BIRDS[G.player.birdKey]&&BIRDS[G.player.birdKey].class)||'';
  const bSize=(G.player&&G.player.size)||'medium';
  const classAdj=(tmpl.type==='physical'&&bClass==='striker')?-2:(tmpl.type==='ranged'&&bClass==='trickster')?-2:(tmpl.type==='spell'&&MAGIC_CLASSES.has(bClass))?-1:0;
  const sizeAdj=(tmpl.type==='physical'&&bSize==='xl')?2:(tmpl.type==='physical'&&bSize==='tiny')?-1:0;
  const missReduce=((G.player&&G.player.missReduce)||0)*100;
  let extra=0;
  const kind=String(tmpl.btnType||tmpl.type||'').toLowerCase();
  const isAttack=(kind==='physical'||kind==='ranged');
  const isSpell=(kind==='spell');
  if(isAttack) extra+=(G.player?.augAttackAcc||0);
  if(isSpell) extra+=(G.player?.augSpellAcc||0);
  if(isSpell && classPerkCtx.arcFocus) extra+=8;
  if((G.playerStatus?.perkUtilityAcc||0)>0){ extra+=8; delete G.playerStatus.perkUtilityAcc; }
  if(classPerkCtx.falseOpening){
    const es=G.enemyStatus||{};
    const debuffed=!!(es.poison||es.bleed||es.burning||getWeakenStacks(es)||es.feared||es.confused||es.paralyzed||es.slow||es.chilled||es.accDebuff>0);
    if(debuffed) extra += 6;
  }
  if((G.player?.augPostDefAcc||0)>0 && G.playerStatus?.postDefAccNext){ extra += G.player.augPostDefAcc; delete G.playerStatus.postDefAccNext; }
  if(G.player?.relHawkLedger && isEndlessRunActive()){ const eb=G.endlessBattle||0; if(eb>=10) extra+=8; if(eb>=20) extra+=8; if(eb>=30) extra+=8; }
  extra += (G.player?.hitChanceBonus||0);
  if(BIRDS[G.player?.birdKey]?.passive?.id==='passive_barnowl_silent_approach' && isAttack && !G._firstAttackUsed && (G.player.stats.hp||0)>=(G.player.stats.maxHp||1)) accBonus+=10;
  return Math.max(floor, reduced - accBonus + tookiePenalty - (G.playerStatus.accDebuff||0) + classAdj + sizeAdj - missReduce - extra - getPlayerHitBonus(ab));
}

/** Hit % = attacker ACC − target DODGE − EN-tier accuracy penalty; clamped 40–95. */
function getPlayerHitPercentForAttack(ab){
  const enCost=getAbilityAuthoredEnergyCost(ab,G.player);
  const dodge=getEffectiveEnemyDodgeForPlayerHit();
  let acc=getPlayerEffectiveAcc();
  const t=ABILITY_TEMPLATES?.[ab?.id]||ABILITY_TEMPLATES_EXTRA?.[ab?.id]||ab||{};
  const kind=String(t.btnType||t.type||ab?.btnType||ab?.type||'').toLowerCase();
  const isAttack=(kind==='physical'||kind==='ranged');
  if(isAttack && !G._firstAttackUsed) acc+=Number(G.player?.firstAttackAccBonus||0);
  return calculateAbilityHitChancePct(acc, dodge, enCost);
}

function getPlayerAccuracy() {
  let acc = G.player.stats.acc||80;
  if (G.sitAndWaitActive) acc+=25;
  if (G.battleHymnActive) acc+=G.battleHymnACC;
  // accDebuff
  acc -= (G.playerStatus.accDebuff||0);
  return Math.min(acc,100);
}

/** Returns { hit, reason: 'accuracy'|'dodge'|null } for player attacks vs enemy. */
function resolvePlayerAttackHit(ab) {
  const t=ABILITY_TEMPLATES?.[ab?.id]||ABILITY_TEMPLATES_EXTRA?.[ab?.id]||ab||{};
  const kind=String(t.btnType||t.type||ab?.btnType||ab?.type||'').toLowerCase();
  const isAttack=(kind==='physical'||kind==='ranged');
  if(isAttack && !G._firstAttackUsed && G.player?.firstAttackAlwaysHit) return {hit:true, reason:null};
  if(!isAttack){
    if(chance(getPlayerMissChance(ab))) return {hit:false, reason:'accuracy'};
    return {hit:true, reason:null};
  }
  const hitPct=getPlayerHitPercentForAttack(ab);
  if(Math.random()*100>=hitPct) return {hit:false, reason:'accuracy'};
  return {hit:true, reason:null};
}
function playerAttackMisses(ab) {
  return !resolvePlayerAttackHit(ab).hit;
}
async function doPlayerAttackMiss(ab) {
  const r=resolvePlayerAttackHit(ab);
  if(r.hit) return false;
  await doMiss('player', r.reason==='dodge'?'dodge':'accuracy');
  const name=ab?.name||'Attack';
  if(r.reason==='dodge') logMsg(`${G.enemy?.name||'Enemy'} dodged ${name}!`,'dodge');
  else logMsg(`${name} missed!`,'miss');
  return true;
}

function getPlayerDmgMult(ab) {
  const tmpl=ABILITY_TEMPLATES[ab.id];
  if (!tmpl||!tmpl.baseDmgMult) return 1;
  return tmpl.baseDmgMult+0.1*(ab.level-1);
}

function getAilChance(ab,ailId) {
  const tmpl=ABILITY_TEMPLATES[ab.id];
  if (!tmpl||!tmpl.levels) return 0;
  const lvData=tmpl.levels[Math.min(ab.level-1,tmpl.levels.length-1)];
  if (lvData.newAilment===ailId) return lvData.ailChance||0;
  if (lvData.newAilment2===ailId) return lvData.ailChance2||0;
  if (lvData.newAilment3===ailId) return lvData.ailChance3||0;
  // Previous levels carry forward
  for (let i=0;i<Math.min(ab.level-1,tmpl.levels.length);i++) {
    const d=tmpl.levels[i];
    if (d.newAilment===ailId||d.newAilment2===ailId||d.newAilment3===ailId) {
      const introducedAt=i;
      const lvNow=Math.min(ab.level-1,tmpl.levels.length-1);
      const baseC=(d.newAilment===ailId?(d.ailChance||0):d.newAilment2===ailId?(d.ailChance2||0):(d.ailChance3||0));
      return baseC+5*(lvNow-introducedAt);
    }
  }
  return 0;
}

function tryApplyAilment(target,ailId,ab) {
  const c=getAilChance(ab,ailId);
  if (!c) return false;
  // Magic stat competition: attacker matk vs target mdef shifts probability
  const attackerMatk = target==='enemy' ? (G.player.stats.matk||8) : (G.enemy.stats.matk||8);
  const targetMdef   = target==='enemy' ? (G.enemy.stats.mdef||8)  : (G.player.stats.mdef||8);
  const magicShift   = (attackerMatk - targetMdef) * 1.5; // ±1.5% per point difference
  const adjusted     = Math.max(5, Math.min(95, c + magicShift));
  // Boss status resistance: 50% reduction
  const controlBoost=(target==='enemy') ? Math.floor((getPassiveEvolutionBonuses(G.player).controlPct||0)*100) : 0;
  const finalAdj=Math.max(5, Math.min(95, adjusted + controlBoost));
  const rollPct = (target==='enemy'&&G.enemy.isBoss) ? Math.max(5,Math.floor(finalAdj*0.5)) : finalAdj;
  if(!chance(rollPct)) return false;
  const stacks = (ailId==='poison' && G.player && G.player.poisonStacksPerHit)
    ? G.player.poisonStacksPerHit : 1;
  applyAilment(target,ailId,stacks);
  return true;
}

function getDelayedDmgBoostPct() {
  if (!G.player) return 0;
  const eqM = (typeof Avian !== 'undefined' && Avian.mutations && typeof Avian.mutations.getMechanicsRollup === 'function')
    ? Avian.mutations.getMechanicsRollup(G.player) : null;
  return Number(eqM?.delayedDmgPct) || 0;
}

function applyDelayedDamage(target, hitDmg) {
  if (!hitDmg || Number(hitDmg) <= 0) return false;
  const status = target === 'player' ? G.playerStatus : G.enemyStatus;
  let pct = 0;
  if (target === 'enemy' && G.player) pct = getDelayedDmgBoostPct();
  const stored = Math.max(1, Math.floor(Number(hitDmg) * (1 + pct / 100)));
  status.delayed = { dmg: stored };
  codexMark('statuses', 'delayed', 'seen');
  if (typeof renderStatuses === 'function') {
    renderStatuses(target === 'player' ? 'player-status' : 'enemy-status', status);
  }
  spawnFloat(target === 'player' ? 'player' : 'enemy', `🎵 Delayed(${stored})`, 'fn-status');
  const who = target === 'player' ? (G.player?.name || 'you') : (G.enemy?.name || 'enemy');
  logMsg(`🎵 Delayed stores ${stored} damage — detonates end of ${who}'s next turn!`, 'system');
  return true;
}

function tryMutationOnHitAilments(dmg, isMagic, isPhysical) {
  if (!G.player || !dmg || dmg <= 0) return;
  const eqM = (typeof Avian !== 'undefined' && Avian.mutations && typeof Avian.mutations.getMechanicsRollup === 'function')
    ? Avian.mutations.getMechanicsRollup(G.player) : null;
  if (!eqM) return;
  const list = isMagic ? (eqM.magicAilments || []) : isPhysical ? (eqM.physicalAilments || []) : [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (!entry || !entry.id || !entry.chance) continue;
    if (!chance(Math.min(95, Number(entry.chance)))) continue;
    if (entry.id === 'delayed') {
      applyDelayedDamage('enemy', dmg);
    } else {
      applyAilment('enemy', entry.id, 1);
    }
    if (typeof renderStatuses === 'function') renderStatuses('enemy-status', G.enemyStatus);
  }
}

function applyAilment(target,ailId,stacks=1) {
  const status=target==='player'?G.playerStatus:G.enemyStatus;
  codexMark('statuses',ailId,'seen');
  // Check passive immunities when applying to player
  if(target==='player'&&G.player){
    const _bd=BIRDS[G.player.birdKey];
    const p=_bd&&_bd.passive;
    if(ailId==='poison'  && p&&p.immunePoison)  { spawnFloat('player','🛡 Poison Immune!','fn-status'); return false; }
    if(ailId==='weaken'  && p&&p.immuneWeaken)  { spawnFloat('player','🛡 Weaken Immune!','fn-status'); return false; }
    if(ailId==='feared'  && (p&&p.immuneFear||G.player.stats.immuneFear))  { spawnFloat('player','🛡 Fear Immune!','fn-status'); return false; }
    if(ailId==='confused'&& p&&p.immuneConfused){ spawnFloat('player','🛡 Confuse Immune!','fn-status'); return false; }
    if(ailId==='paralyzed'&&(p&&p.immuneStun||G.player.immuneParalyze))   { spawnFloat('player','🛡 Stun Immune!','fn-status'); return false; }
  }
  if (ailId==='poison') {
    if (!status.poison) status.poison={stacks:0,turns:3};
    const cap = G.player ? (G.player.poisonCap||5) : 5;
    const biomeBonus=(target==='player' && (G.biomeMod?.enemyPoisonPlus||0)>0)?G.biomeMod.enemyPoisonPlus:0;
    const fromPlayer=(target==='enemy');
    status.poison.stacks=Math.min((status.poison.stacks||0)+stacks+biomeBonus, cap);
    const extraTurns=(fromPlayer)?(G.player?.poisonExtraTurns||0):0;
    status.poison.turns=3+extraTurns;
  } else if (ailId==='bleed') {
    const fromPlayer=(target==='enemy');
    const bonusTurns=fromPlayer?Math.min(2, Math.floor(Number(G.player?.bleedBonusStacks)||0)):0;
    status.bleed={stacks:1,turns:3+bonusTurns};
  } else if (ailId==='weaken') {
    applyWeakenStack(target, stacks);
    return true;
  } else if (ailId==='paralyzed') {
    status.paralyzed=3;
  } else if (ailId==='burning') {
    const t = Math.max(1, Math.floor(Number(stacks)||3));
    status.burning={turns:t};
  } else if (ailId==='chilled') {
    if(target!=='enemy') return false;
    return applyChilledStacksToEnemy(stacks);
  } else if (ailId==='feared') {
    const extra=((target==='enemy')&&G.player?.mutDarkChorus)?1:0;
    const incoming=Math.max(1, Math.floor(Number(stacks)||1)+extra);
    status.feared=Math.max(status.feared||0, incoming);
  } else if (ailId==='confused') {
    const t=Math.max(1, Math.floor(Number(stacks)||2));
    status.confused={turns:t,selfChance:STATUS_CONFUSED_SELF_PCT};
  } else if (ailId==='delayed') {
    return false;
  }
  if(target==='enemy' && G.player){
    const pid=BIRDS[G.player.birdKey]?.passive?.id;
    if(pid==='passive_crow_murder_mind' && !G.player._crowMurderMindUsed){
      const debKeys=new Set(['poison','bleed','weaken','paralyzed','feared','burning','chilled','confused','slow']);
      if(debKeys.has(ailId) || ailId==='mud'){
        G.player._crowMurderMindUsed=true;
        if(ailId==='poison' && status.poison) status.poison.turns=(status.poison.turns||0)+1;
        if(ailId==='bleed' && status.bleed) status.bleed.turns=(status.bleed.turns||0)+1;
        if(ailId==='weaken') applyWeakenStack(target, 1);
        if(ailId==='paralyzed') status.paralyzed=(status.paralyzed||0)+1;
        if(ailId==='feared') status.feared=(status.feared||0)+1;
        if(ailId==='burning'){
          if(typeof status.burning==='number') status.burning+=1;
          else if(status.burning&&typeof status.burning==='object') status.burning.turns=(status.burning.turns||0)+1;
        }
        if(ailId==='chilled' && status.chilled) status.chilled.turns=(status.chilled.turns||0)+1;
        if(ailId==='confused' && status.confused&&typeof status.confused==='object') status.confused.turns=(status.confused.turns||0)+1;
        if(ailId==='slow' && status.slow&&typeof status.slow==='object') status.slow.turns=(status.slow.turns||0)+1;
      }
    }
    if(pid==='passive_dukeblakiston_court_of_night' && (ailId==='feared' || ailId==='weaken')){
      G.playerStatus.dukeCourtBuff={atk:4, matk:4, turns:1};
      G.player.stats.atk=(G.player.stats.atk||0)+4;
      G.player.stats.matk=(G.player.stats.matk||0)+4;
    }
  }
  return true;
}

function getPlayerCritChance(ab) {
  let base = G.player.stats.critChance || 5;
  base += (getPassiveEvolutionBonuses(G.player).critFlat||0);
  const t=ABILITY_TEMPLATES?.[ab?.id]||ABILITY_TEMPLATES_EXTRA?.[ab?.id]||ab||{};
  const kind=String(t.btnType||t.type||ab?.btnType||ab?.type||'').toLowerCase();
  const isAttack=(kind==='physical'||kind==='ranged');
  if(isAttack && !G._firstAttackUsed){
    if(G.player?.firstAttackAlwaysCrit) return 100;
    base += (G.player?.firstAttackCritBonus||0);
  }
  if(isAttack) base += (G.player?.augAttackCrit||0);
  const pfLens=G.playerStatus?.peregrineCritLens;
  if(isAttack && pfLens && (pfLens.turns||0)>0) base += (pfLens.bonus||0);
  const kookLens=G.playerStatus?.kookaCritLens;
  if(isAttack && kookLens && (kookLens.turns||0)>0) base += (kookLens.bonus||0);
  const owlLens=G.playerStatus?.owlCritFocus;
  if(isAttack && owlLens && (owlLens.turns||0)>0) base += (owlLens.bonus||0);
  if((isAttack||kind==='spell') && G._pendingStrikeActionMods?.critBonus) base += G._pendingStrikeActionMods.critBonus;
  const _pcId=BIRDS[G.player?.birdKey]?.passive?.id;
  if(isAttack && (G.player._sheetNextCrit||0)>0) base += G.player._sheetNextCrit;
  if(_pcId==='passive_peregrine_kill_dive' && isAttack && G.enemy && (G.enemy.stats.hp||1)<=Math.floor((G.enemy.stats.maxHp||1)*0.5)) base += 10;
  if(_pcId==='passive_kookaburra_laughing_ambush' && isAttack && G.enemyStatus?.confused) base += 10;
  const chillStacks=G.enemyStatus?.chilled?.stacks||0;
  if(_pcId==='passive_flamingo_cold_wader' && (isAttack||kind==='spell')) base += chillStacks*5;
  if(_pcId==='passive_marabou_rot_feast' && (isAttack||kind==='spell') && (G.enemyStatus?.poison?.stacks||0)>0) base += 10;
  if(_pcId==='passive_goldeneagle_sun_hunter' && isAttack && G.enemy && (G.enemy.stats.hp||1)<(G.enemy.stats.maxHp||1)) base += 10;
  if(_pcId==='passive_harpy_apex_grip' && isAttack && !G._firstAttackUsed) base += 10;
  if(_pcId==='passive_bluejay_territorial_fury' && isAttack && G.player._blueJayHitLastTurn) base += 10;
  base += (G.playerStatus?.passiveCrit || 0);
  if(typeof Avian?.dispatcher?.modifyCritChance==='function') base = Avian.dispatcher.modifyCritChance(base);
  return Math.min(100,base);
}

function getPlayerHitBonus(ab) {
  let n=0;
  const ts=G.playerStatus.trailSenseAcc;
  if(ts && (ts.turns||0)>0 && (ts.pct||0)>0) n+=ts.pct;
  if (G._pendingStrikeActionMods?.hitBonus) n+=G._pendingStrikeActionMods.hitBonus;
  if((G.playerStatus.macawFlairAcc||0)>0) n+=G.playerStatus.macawFlairAcc;
  if((G.playerStatus.lyreAccSong||0)>0){ n+=G.playerStatus.lyreAccSong; delete G.playerStatus.lyreAccSong; }
  if(BIRDS[G.player?.birdKey]?.passive?.id==='passive_wagtail_mocking_step' && G.enemyStatus?.confused) n+=10;
  if(BIRDS[G.player?.birdKey]?.passive?.id==='passive_baldeagle_sky_dominance' && G.enemy && (G.enemy.stats.hp||1)<(G.enemy.stats.maxHp||1)) n+=10;
  return n;
}

function tickPoisonDamageOnly(side){
  const status=side==='player'?G.playerStatus:G.enemyStatus;
  const stats=side==='player'?G.player.stats:G.enemy.stats;
  if(!status.poison||!status.poison.stacks||status.poison.stacks<=0||(status.poison.turns||0)<=0) return;
  const ownerBonus=side==='enemy';
  const tickMult=ownerBonus?(G.player?.poisonTickMult||1):1;
  const flatBonus=ownerBonus?((G.player?.poisonFlatBonus||0)+(G.player?.perkPoisonTickBonus||0)+(G.player?.relVenomLedger?1:0)):0;
  const dmg=Math.max(1,Math.floor(2*status.poison.stacks*tickMult)+flatBonus);
  stats.hp-=dmg;
  spawnFloat(side,`☣ -${dmg}`,'fn-poison');
  setHpBar(side,stats.hp,stats.maxHp);
  logMsg(`☣ Poison deals ${dmg} to ${side==='player'?G.player.name:G.enemy.name}!`,'poison-tick');
  if(side==='enemy') BS.dmgDealt+=dmg;
  SFX.poison();
}
function tickPoisonDurationEndRound(){
  for(const side of ['player','enemy']){
    const status=side==='player'?G.playerStatus:G.enemyStatus;
    if(status.poison&&status.poison.stacks>0&&status.poison.turns>0){
      status.poison.turns--;
      if(status.poison.turns<=0) delete status.poison;
    }
  }
}
function tickBurningEndEnemyPhase(){
  for(const side of ['player','enemy']){
    const status=side==='player'?G.playerStatus:G.enemyStatus;
    const stats=side==='player'?G.player.stats:G.enemy.stats;
    const b=status.burning;
    if(!b) continue;
    const turns=typeof b==='number'?b:b.turns;
    if(!turns||turns<=0){ delete status.burning; continue; }
    const burnMult=side==='enemy'?(G.player?.burnBonus||1):1;
    const dmg=roundCombatDamage(7*burnMult);
    stats.hp-=dmg;
    spawnFloat(side,`🔥 -${dmg}`,'fn-burn');
    setHpBar(side,stats.hp,stats.maxHp);
    logMsg(`🔥 Burn deals ${dmg} to ${side==='player'?G.player.name:G.enemy.name}!`,'burn-tick');
    if(side==='enemy') BS.dmgDealt+=dmg;
    if(typeof status.burning==='number') status.burning=turns-1;
    else status.burning.turns=turns-1;
    if((typeof status.burning==='number'&&status.burning<=0)||(typeof status.burning==='object'&&status.burning.turns<=0)) delete status.burning;
  }
}
function tickDelayedForTarget(side){
  const status=side==='player'?G.playerStatus:G.enemyStatus;
  const stats=side==='player'?G.player.stats:G.enemy.stats;
  if(!status.delayed||status.delayed.dmg==null||Number(status.delayed.dmg)<=0) return;
  const dmg=Math.max(1,Math.floor(Number(status.delayed.dmg)));
  stats.hp-=dmg;
  spawnFloat(side,`🎵 -${dmg}`,'fn-status');
  setHpBar(side,stats.hp,stats.maxHp);
  logMsg(`🎵 Resonance detonates! ${dmg} damage!`,'system');
  delete status.delayed;
}

function tickStatuses(who, opts={}) {
  const skipGuarded=!!opts.skipGuarded;
  const s=who==='player'?G.playerStatus:G.enemyStatus;
  const keys=Object.keys(s);
  const owner=who==='player'?G.player:G.enemy;
  keys.forEach(k=>{
    if (k==='poison' || k==='bleed') { /* boundary ticks */ }
    else if (k==='delayed') { /* boundary ticks */ }
    else if (k==='defBoost' && typeof s[k]==='object') {
      s[k].turns--;
      if(s[k].turns<=0){
        owner.stats.def=Math.max(0,(owner.stats.def||0)-(s[k].amt||0));
        delete s[k];
      }
    }
    else if (k==='counterThorns') { /* temporary per defending window */ }
    else if (k==='guarded' && typeof s[k]==='object' && !skipGuarded) tickGuardedStatus(s);
    else if (k==='weaken' && typeof s[k]==='object' && s[k].turns!=null) {
      s[k].turns--;
      if(s[k].turns<=0) delete s[k];
    }
    else if (typeof s[k]==='number'&&s[k]>0) s[k]--;
    else if (typeof s[k]==='object'&&s[k].turns!==undefined) { /* skip */ }
  });
  if(who==='player' && !playerIsGuarding(s) && s.counterThorns) delete s.counterThorns;
}

// ============================================================
//  PLAYER ACTIONS
// ============================================================
/* Note (combat rewrite): ACTIONS is the legacy hand-coded handler map. As of
 * the combat-pack rewrite, every entry below is replaced at boot by dispatcher
 * proxies in js/systems/combat-pack-boot.js. The function bodies below are
 * retained as historic reference (they never run) but the LIVE behaviour comes
 * from Avian.dispatcher.execute() driven by the skill-trees data pack. Treat
 * additions here as dead code: extend the spreadsheets + dispatcher instead. */
/* Combat rewrite: legacy ACTIONS literal + every *_SKILL_ACTION_OVERRIDES block + per-bird mastery helpers + ability alias registrations removed. The live ACTIONS map is populated at boot by js/systems/combat-pack-boot.js with dispatcher proxies. */
const ACTIONS = Object.create(null);
const ABILITY_ALIAS_TO_SOURCE_ID = Object.create(null);
function resolveAbilityAliasSourceId(id){ return String(id || ''); }
function registerAbilityAlias(){ /* legacy alias registration disabled — combat-pack ids are canonical */ }
function registerStrikePreviewForBird(){ /* no-op; legacy strike preview disabled */ }

/* Combat rewrite: RELIABLE_ONE_EN_ATTACK_BY_CLASS + ensureStarterKitEnergySmoothing removed. Combat-pack guarantees each bird starts with a 1-AP main starter. */
function ensureStarterKitEnergySmoothing(){ /* no-op */ }
ensureStarterKitEnergySmoothing();

function checkBlackbirdOmenChorusAfterAbility(prev){
  if(G.player?.birdKey!=='blackbird' || BIRDS.blackbird?.passive?.id!=='passive_blackbird_omen_chorus') return;
  const now=G.enemyStatus?.delayed;
  if(!now||now.dmg==null) return;
  const pSig=prev&&prev.dmg!=null?Number(prev.dmg):null;
  const nSig=Number(now.dmg);
  if(pSig!==null && pSig===nSig) return;
  const old=G.playerStatus.blackbirdOmenMatk;
  if(old&&old.amt) G.player.stats.matk=Math.max(0,(G.player.stats.matk||0)-(old.amt||0));
  G.playerStatus.blackbirdOmenMatk={amt:4, turns:1};
  G.player.stats.matk=(G.player.stats.matk||0)+4;
}

async function playerAction(ab,fromQueue=false) {
  const now=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  if(now<(G._actionTapLockUntil||0)) return;
  G._actionTapLockUntil=now+220;
  if(!fromQueue&&!canPlayerAct()){
    logMsg('Cannot act right now.','system');
    return;
  }
  if(G.turn!=='player'){
    logMsg('Not your turn.','system');
    return;
  }
  if((G.playerActionsThisTurn||0)>=MAX_PLAYER_ACTIONS_PER_TURN){logMsg('Action limit reached — end your turn.','system');return;}

  G.playerTurnFlags = G.playerTurnFlags || {};
  G.playerTurnFlags._spellTempoUsedThisAction = false;
  if(G.autoQueuedAbilityId){
    const autoAb=G.player.abilities.find(x=>x.id===G.autoQueuedAbilityId);
    if(autoAb){
      if(!canUseAbility(G.player,autoAb)){G.autoQueuedAbilityId=null;}
      else {ab=autoAb;logMsg(`🔁 Auto action: ${ab.name}!`,'system');}
    } else G.autoQueuedAbilityId=null;
  }
  const _tmplAct=getAbilityTemplateForUI(ab);
  const effActKind=getEffectiveAbilityBtnType(ab,_tmplAct);
  // Roost delivery at start of turn
  if(G.playerStatus.roosting==='pending'){
    const rd=G._roostData||{pct:.25,lv:1};
    const {pct,lv}=rd;
    let heal=Math.max(1,Math.floor(G.player.stats.maxHp*pct));
    if(BIRDS[G.player?.birdKey]?.passive?.id==='passive_pelican_deep_pouch') heal=Math.floor(heal*1.1);
    heal=scaleHealForBleed('player',heal);
    G.player.stats.hp=Math.min(G.player.stats.hp+heal,G.player.stats.maxHp);
    await doHeal('player',heal);
    setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
    logMsg(`🌿 Roost HEALS +${heal} HP restored! (${Math.floor(pct*100)}% of max)`,'system');
    if(lv>=2){delete G.playerStatus.weaken;}
    if(lv>=3){['weaken','paralyzed','burning','confused','feared','slow','stunned'].forEach(s=>delete G.playerStatus[s]);}
    if(lv>=4){Object.keys(G.playerStatus).forEach(k=>{if(typeof G.playerStatus[k]==='number'&&G.playerStatus[k]>0) delete G.playerStatus[k];});}
    delete G.playerStatus.roosting;
    G._roostData=null;
  }
  if(G.playerStatus.stunned>0){logMsg(`😵 Stunned — can't act!`,'miss');renderActions();refreshBattleUI();return;}
  const _pcl=G.playerStatus.confused;
  const _dmgEarly=effActKind==='physical'||effActKind==='ranged'||effActKind==='spell';
  G._playerConfusesSelfThisAction=!!(_pcl&&(_pcl.turns||0)>0&&_dmgEarly&&chance(Number.isFinite(_pcl.selfChance)?_pcl.selfChance:STATUS_CONFUSED_SELF_PCT));
  if(G.playerStatus.paralyzed>0&&!G.player.immuneParalyze&&chance(AILMENTS.paralyzed.skipChance||20)){
    spawnFloat('player','⚡ Para!','fn-status');await delay(400);
    logMsg(`⚡ Paralyzed — cannot act!`,'miss');renderActions();refreshBattleUI();return;
  }
  if(G.playerStatus.feared>0&&!G.player.humImmuneToFear&&!G.player.bulwarkFearImmune){
    if(effActKind==='utility'&&ab.id!=='crowDefend'){/* utility ok */}
    else if(ab.id==='crowDefend'){logMsg(`😨 Feared — cannot defend!`,'miss');renderActions();refreshBattleUI();return;}
    else if(effActKind!=='utility'&&chance(STATUS_FEAR_SKIP_PCT)){
      playAvatarAnim('player','do-miss-r',560);spawnFloat('player','😨 Panic!','fn-miss');await delay(560);
      logMsg(`😨 Feared — you panic and lose this action!`,'miss');renderActions();refreshBattleUI();return;
    }
  }
  // Stick Lance: if stage was armed but player picks something else — reset
  if(G.stickLanceStage===1 && ab.id!=='stickLance'){
    G.stickLanceStage=0;
    logMsg(`🪵 Stick dropped — Stick Lance reset.`,'miss');
  }
  if(getAbilityCooldown(ab.id)>0){logMsg(`${ab.name} on cooldown! (${getAbilityCooldown(ab.id)}t)`,'miss');return;}
  if((ab.id==='swoop' || (ab.id==='sonicDash' && G.player?.birdKey!=='hummingbird')) && (G.swoopCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.swoopCooldown}t)`,'miss');return;}
  if(HUMMINGBIRD_DASH_ABILITY_IDS.has(ab.id) && (G.hummingbirdDashCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.hummingbirdDashCooldown}t)`,'miss');return;}
  if(PEREGRINE_DIVE_ABILITY_IDS.has(ab.id) && (G.peregrineDiveCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.peregrineDiveCooldown}t)`,'miss');return;}
  if(SNOWY_OWL_DIVE_ABILITY_IDS.has(ab.id) && (G.snowyOwlDiveCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.snowyOwlDiveCooldown}t)`,'miss');return;}
  if(ROBIN_DART_ABILITY_IDS.has(ab.id) && (G.robinDartCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.robinDartCooldown}t)`,'miss');return;}
  if(BOWERBIRD_LURE_ABILITY_IDS.has(ab.id) && (G.bowerbirdLureCooldown||0)>0){logMsg(`${ab.name} on cooldown! (${G.bowerbirdLureCooldown}t)`,'miss');return;}
  if(!canUseAbility(G.player,ab)){logMsg(`Not enough energy for ${ab.name}!`,'miss');return;}
  if(effActKind==='utility' && G.utilityUsedThisTurn?.[ab.id]){
    logMsg(`${ab.name} already used this turn!`,'miss');
    return;
  }
  const _defSkill=(effActKind==='utility' || ab?.id==='crowDefend');
  if(_defSkill){
    if((G.player?.augDefSkillDef||0)>0) G.player.stats.def=(G.player.stats.def||0)+G.player.augDefSkillDef;
    if((G.player?.augDefSkillMdef||0)>0) G.player.stats.mdef=(G.player.stats.mdef||0)+G.player.augDefSkillMdef;
    if((G.player?.augDefSkillHeal||0)>0){
      const _h=scaleHealForBleed('player',G.player.augDefSkillHeal);
      G.player.stats.hp=Math.min(G.player.stats.maxHp,G.player.stats.hp+_h);
    }
    if((G.player?.augDefSkillDodge||0)>0) G.playerStatus.humDodge={bonus:Math.max(G.playerStatus.humDodge?.bonus||0,G.player.augDefSkillDodge),turns:1};
    if(G.player?.augDefSkillClearFear) delete G.playerStatus.feared;
    if((G.player?.augPostDefAtkPct||0)>0) G.playerStatus.postDefAtkPct=G.player.augPostDefAtkPct;
    if((G.player?.augPostDefAcc||0)>0) G.playerStatus.postDefAccNext=true;
    if(G.player?.augIronResolve && !G.player._augIronResolveUsed){ G.playerStatus.ironResolve={turns:1}; G.player._augIronResolveUsed=true; }
    if(G.player?.augDefSkillRefund && chance(G.player.augDefSkillRefund)) gainEnergy(G.player,1);
    if(G.player?.augCounterInstinct) G.playerStatus.counterInstinct=2;
  }
  spendEnergy(G.player,ab);
  codexMark('abilities',ab.id,'used');
  if(G.enemy?.id==='duke_blakiston') dukeTrackDecree(ab.id);
  G._activePlayerAbility=ab;
  const _delayedBeforeAbility = (G.enemyStatus?.delayed && G.enemyStatus.delayed.dmg!=null) ? {dmg:G.enemyStatus.delayed.dmg} : null;
  const classPerkCtx=applyClassPerksToCombatContext(G.player?.birdKey,{});
  if(effActKind==='utility' && classPerkCtx.quickTheft && !G._perkUtilityRefundUsed){
    gainEnergy(G.player,1);
    G._perkUtilityRefundUsed=true;
  }
  if((effActKind==='utility' || effActKind==='buff' || effActKind==='defend') && G.player?.perkUtilityAcc){
    G.playerStatus.perkUtilityAcc=1;
  }
  if(classPerkCtx.holdTheLine && /guard|defend|shield|crowdefend/i.test(ab.id||'')){
    G.playerStatus.holdTheLineBoost=1;
  }
  G.playerActionsThisTurn=(G.playerActionsThisTurn||0)+1;
  renderEnergyOrbs();
  G.turnPhase=TURN.RESOLVING;
  G.animLock=true; G.battleOver=false; renderActions();
  // Track buffs/debuffs for run unlock
  if(BUFF_AB_IDS.has(ab.id)) G.runBuffs++;
  if(DEBUFF_AB_IDS.has(ab.id)) G.runDebuffs++;
  // Apply flyby momentum multiplier if charged and this is an attack
  const flybyWasCharged=G.flybyCharged && ['physical','ranged','spell'].includes(effActKind);
  if(flybyWasCharged){G.flybyCharged=false;delete G.playerStatus.flyby; G.actionDamageMult=1.75; G.actionDamageHitsRemaining=1;}
  const chargedDouble=G.chargeUpActive && ab.id!=='chargeUp' && ['physical','ranged','spell'].includes(effActKind);
  const lyrebirdSongEcho = G.player?.birdKey==='lyrebird' && !G.player?._lyrebirdSongEchoUsed && effActKind==='spell';
  if(chargedDouble){G.chargeUpActive=false;delete G.playerStatus.chargeUp;logMsg('⚡ Charge Up triggers: action repeats!','system');}
  if(lyrebirdSongEcho){G.player._lyrebirdSongEchoUsed=true;logMsg('🎵 Perfect Mimicry triggers: Song repeats at 40% power!','system');}
  // Temporarily double ATK for flyby
  if(flybyWasCharged) G.player.stats.atk*=2;
  if(['physical','ranged','spell'].includes(effActKind)) promotePendingStrikeBuffToActive();
  if (typeof Avian?.dispatcher?.execute === 'function') {
    await Avian.dispatcher.execute(ab);
    if(chargedDouble && !G.battleOver && G.enemy.stats.hp>0){ await Avian.dispatcher.execute(ab); }
    if(lyrebirdSongEcho && !G.battleOver && G.enemy.stats.hp>0){
      G.actionDamageMult=0.40;
      G.actionDamageHitsRemaining=1;
      await Avian.dispatcher.execute(ab);
    }
  } else if (typeof ACTIONS[ab.id] === 'function') {
    await ACTIONS[ab.id](ab);
    if(chargedDouble && !G.battleOver && G.enemy.stats.hp>0){await ACTIONS[ab.id](ab);}
    if(lyrebirdSongEcho && !G.battleOver && G.enemy.stats.hp>0){
      G.actionDamageMult=0.40;
      G.actionDamageHitsRemaining=1;
      await ACTIONS[ab.id](ab);
    }
  } else {
    logMsg('No handler for ability: ' + ab.id, 'miss');
  }
  checkBlackbirdOmenChorusAfterAbility(_delayedBeforeAbility);
  if((effActKind==='physical'||effActKind==='ranged') && classPerkCtx.ironMomentum && /heavy|slam|crusher|smash/i.test((ab.name||ab.id||'').toLowerCase())){
    applySourceStatLoanPct(G.playerStatus, G.player, '_ironMomentumLoans', 'def', ab.id||'ironMomentum', 8, 1);
    spawnTrendFloat('player', 'buff');
  }
  if(effActKind==='physical'||effActKind==='ranged') G._firstAttackUsed=true;
  if(effActKind==='spell'){ G._firstSpellUsed=true; G._spellCastCount=(G._spellCastCount||0)+1; }
  G._lastPlayerAbility = ab.id;
  if(effActKind==='utility'){
    G.utilityUsedThisTurn = G.utilityUsedThisTurn || {};
    G.utilityUsedThisTurn[ab.id] = true;
  }
  setAbilityCooldown(ab);
  if(effActKind==='spell'){
    reduceOtherSpellCooldownsOnCast(ab.id);
  }
  // Passive: combat-pack router + legacy hooks
  const _flBd=BIRDS[G.player.birdKey];
  if(_flBd&&_flBd.passive&&_flBd.passive.onAbilityUse) _flBd.passive.onAbilityUse(G.player,ab);
  if(effActKind==='utility' && _flBd&&_flBd.passive&&_flBd.passive.onUtilityUse) _flBd.passive.onUtilityUse(G.player,ab);
  if(typeof Avian?.passives?.onPlayerAbilityUse==='function'){
    Avian.passives.onPlayerAbilityUse(ab, {
      hitsLanded: G._lastAbilityHitsLanded || 0,
      firstHitLanded: (G._lastAbilityHitsLanded || 0) > 0,
      anyCrit: !!G._lastAbilityAnyCrit,
      crit: !!G._lastAbilityAnyCrit,
      ailmentFailed: !!G._lastAbilityAilmentFailed,
      effActKind,
    });
  }
  if(flybyWasCharged) G.actionDamageMult=1;
  delete G._pendingStrikeActionMods;
  G._activePlayerAbility=null;
  G.animLock=false;
  if(G.enemy.stats.hp<=0||G.player.stats.hp<=0){if(checkDeath())return;}
  G.turnPhase=TURN.PLAYER;
  G.phase='PLAYER';
  refreshBattleUI();
  if((G.player.energy||0)<=0||G.playerStatus.stunned>0) endPlayerTurn(true);
}


function startPlayerTurn(player){
  G._playerTurnSerial=(G._playerTurnSerial|0)+1;
  player.energyMax = computePlayerMaxEnergy();
  player.energyRegen = computePlayerEnergyRegen(player);
  const maxEn = player.energyMax;
  const pte = (G._playerEnergyTurnIndex|0);
  if(pte === 0){
    G._playerEnergyTurnIndex = 1;
    const cur = Number.isFinite(player.energy) ? player.energy : computePlayerStartEnergy(player);
    player.energy = Math.min(maxEn, Math.max(0, cur));
  }else{
    const r=computePlayerEnergyRegenThisTurn(player, G.playerStatus);
    player.energy=Math.min(maxEn, Math.max(0, (player.energy||0)+r));
  }
  G.sitAndWaitUsedThisTurn=false;
  if(typeof BS!=='undefined' && BS.turns===0 && (player.firstTurnEnergy||0)>0){
    player.energy = Math.min(maxEn, (player.energy||0) + player.firstTurnEnergy);
  }
  if(isEndlessRunActive() && G.enemy?.isBoss && player.relPredatoryMemory) player.energy = Math.min(maxEn, (player.energy||0) + 1);
  if(isEndlessRunActive() && player.relFeatheredClock && ((G.endlessBattle||0)%3===0)) player.energy = Math.min(maxEn, (player.energy||0) + 1);
  G.playerActionsThisTurn=0;
  G.playerTurnFlags={energyGainedThisTurn:0,onHitTriggered:false,firstAttackResolved:false};
  G.utilityUsedThisTurn={};
  G.player._blueJayHitLastTurn=!!G.player._blueJayRecentHit;
  G.player._blueJayRecentHit=false;
  G.player._shoebillHadUtilityPriorTurn=!!G.playerStatus.shoebillUsedUtility;
  delete G.playerStatus.shoebillUsedUtility;
  G.player._magpieCritSpdThisTurn=false;
  if(G.playerStatus.magpieSpdNext){
    const add=G.playerStatus.magpieSpdNext;
    G.player.stats.spd=(G.player.stats.spd||1)+add;
    G.player._magpieSpdLoan=add;
    delete G.playerStatus.magpieSpdNext;
  }
  if(G.playerStatus.ostrichSpdNext){
    G.player.stats.spd=(G.player.stats.spd||1)+G.playerStatus.ostrichSpdNext;
    G.player._ostrichSpdLoan=G.playerStatus.ostrichSpdNext;
    delete G.playerStatus.ostrichSpdNext;
  }
  if(G.playerStatus.predatorAtkNext){
    const add=G.playerStatus.predatorAtkNext;
    G.player.stats.atk=(G.player.stats.atk||0)+add;
    G.player._predatorAtkLoan=add;
    delete G.playerStatus.predatorAtkNext;
  }
  if(G.playerStatus.albatrossChillSpd){
    G.player.stats.spd=(G.player.stats.spd||1)+G.playerStatus.albatrossChillSpd;
    G.player._albatrossSpdLoan=G.playerStatus.albatrossChillSpd;
    delete G.playerStatus.albatrossChillSpd;
  }
  if(G.playerStatus.perkSlipstream){
    G.player.stats.spd=(G.player.stats.spd||1)+1;
    G.playerStatus.perkSlipstream=0;
    G.playerStatus.perkSlipstreamDecay=1;
  }else if(G.playerStatus.perkSlipstreamDecay){
    G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-1);
    delete G.playerStatus.perkSlipstreamDecay;
  }
  if(player.mutSuddenFlight) player._mutSuddenFlightUsed=false;
  G._combatHealUsedThisTurn=false;
  if(typeof Avian?.passives?.onPlayerTurnStart==='function') Avian.passives.onPlayerTurnStart(player);
  if(typeof Avian?.dispatcher?.onPlayerTurnStart==='function') Avian.dispatcher.onPlayerTurnStart(player);
  G.turn='player';
  G.turnPhase=TURN.PLAYER;
  G.phase='PLAYER';
  G.animLock=false;
  syncCombatTurnFlags();
  applyOpeningStrikePassiveOnTurnStart();
  renderEnergyOrbs();
  renderActions();
  lockActionUI(false);
  if(G.autoQueuedAbilityId==='breakClamp'){
    const autoAb=(G.player.abilities||[]).find(a=>a.id==='breakClamp');
    if(autoAb && canUseAbility(G.player,autoAb)){
      setTimeout(()=>enqueueAction(()=>playerAction(autoAb,true)), 80);
    }
  }
}
function startEnemyTurn(enemy){
  const prof=getEnemyEnergyProfile();
  const maxEn=prof.maxEN;
  enemy.energyMax=maxEn;
  enemy.energyRegen=Number.isFinite(enemy.energyRegen)?enemy.energyRegen:prof.regenEN;
  const ete = (G._enemyEnergyTurnIndex|0);
  if(ete === 0){
    G._enemyEnergyTurnIndex = 1;
    const cur = Number.isFinite(enemy.energy) ? enemy.energy : prof.startEN;
    enemy.energy = Math.min(maxEn, Math.max(0, cur));
  }else{
    const r = enemy.energyRegen || prof.regenEN;
    enemy.energy = Math.min(maxEn, Math.max(0, (enemy.energy||0) + r));
  }
  G.phase='ENEMY';
}
function isSpellAbilityId(id){
  const t = ABILITY_TEMPLATES?.[id];
  return !!(t && (t.type==='spell' || t.btnType==='spell'));
}

function isMultiHitAbility(ab){
  if(!ab) return false;
  const t = getAbilityTemplateForUI(ab) || ab;
  const role = Array.isArray(t?.role) ? t.role : [];
  if(role.includes('multiHit')) return true;
  const type = t?.type || ab.type || '';
  const btnType = t?.btnType || ab.btnType || '';
  if(type==='utility' || btnType==='utility' || type==='buff' || btnType==='buff' || type==='debuff' || btnType==='debuff') return false;
  const texts = [t?.desc, ab?.desc, ...(Array.isArray(t?.levels)?t.levels.map(l=>l?.desc):[])].filter(Boolean).join(' | ').toLowerCase();
  return /(\b\d+\s*[-–]\s*\d+\s*hits?\b|\b\d+\s*hits?\b|\b\d+×\b|multi-hit|strikes? at)/.test(texts);
}

function getAbilityAuthoredEnergyCost(ab, player){
  const p = player || G.player;
  const t = getAbilityTemplateForUI(ab);

  let cost = 0;
  if(Array.isArray(t?.energyByLevel) && t.energyByLevel.length){
    const idx = Math.min((ab.level||1)-1, t.energyByLevel.length-1);
    cost = Number(t.energyByLevel[idx]) ?? 0;
  }else if(typeof t?.energyCost === 'number'){
    cost = t.energyCost;
  }else if(typeof ab.energyCost === 'number'){
    cost = ab.energyCost;
  }

  if(isMainAttackAbility(ab, p) && !isSpellAbilityId(ab.id) && cost <= 1 && !(ab.fixedMainAttackCost || t?.fixedMainAttackCost)) cost = 1;

  if(p && usesFamilySkillEvolution(p) && !isMainAttackAbility(ab, p) && Array.isArray(t?.energyByLevel) && t.energyByLevel.length){
    const arr=t.energyByLevel.map(x=>Math.max(0,Math.floor(Number(x)||0)));
    const progressive=arr.some((v,i)=>i>0&&v!==arr[0]);
    if(progressive){
      const idx=Math.min(Math.max((ab.level||1)-1,0),arr.length-1);
      cost=arr[idx];
    }else{
      cost=arr[0];
    }
  }

  return Math.max(0, cost);
}

function getAbilityAttackWeight(ab, player){
  const cost = getAbilityAuthoredEnergyCost(ab, player);
  if(cost===1) return 'light';
  if(cost===2) return 'medium';
  if(cost===3) return 'heavy';
  return null;
}

function getAbilityEnergyCost(ab, player){
  const p = player || G.player;
  const t = getAbilityTemplateForUI(ab);
  let cost = getAbilityAuthoredEnergyCost(ab, p);

  const tType=(t?.btnType||t?.type||ab.btnType||ab.type||'').toLowerCase();
  const isAttack=(tType==='physical'||tType==='ranged');
  const isSpell=(tType==='spell');

  if(isAttack && !G._firstAttackUsed && p?.firstAttackFree) cost=0;
  if(isSpell && !G._firstSpellUsed && p?.firstSpellFree) cost=0;
  if(isSpell && !G._firstSpellUsed && (p?.augFirstSpellCostDown||0)>0) cost=Math.max(0,cost-p.augFirstSpellCostDown);
  if(isSpell && p?.mutArcOverload) cost+=1;

  if(cost===1 && isMultiHitAbility(ab) && !isMainAttackAbility(ab, p)) cost += 1;

  const maxE = p?.energyMax ?? 99;
  cost = Math.min(cost, maxE);
  const _fz=G?.playerStatus?.frozen;
  const frzTurns=(typeof _fz==='object'&&_fz)?(_fz.turns||0):(typeof _fz==='number'?_fz:0);
  if(frzTurns>0 && ab?.id!=='skipTurn' && t?.id!=='skipTurn') cost += 1;

  return Math.max(0, cost);
}

function getEnergyCost(ability){
  if(!ability) return 0;
  return getAbilityEnergyCost(ability, G.player);
}
function syncAbilityEnergyCost(ability){
  ability.energyCost=getAbilityEnergyCost(ability, G.player);
  return ability.energyCost;
}
function canUseAbility(player, ability){
  if(typeof G!=='undefined'&&player===G.player&&G.turnPhase===TURN.PLAYER
    && (G.playerActionsThisTurn||0)>=MAX_PLAYER_ACTIONS_PER_TURN){
    return false;
  }
  const cost=getAbilityEnergyCost(ability, player);
  return (player.energy||0) >= cost;
}
function spendEnergy(player, ability){
  const cost=getAbilityEnergyCost(ability, player);
  player.energy = Math.max(0,(player.energy||0) - cost);
  return cost;
}

function enforceAbilityCosts(player){
  const p = player || G.player;
  if(!p?.abilities) return;
  for(const ab of p.abilities){
    const desired = getAbilityEnergyCost(ab, p);
    ab.energyCost = desired;
  }
}
function gainEnergy(player, amount){
  const gained=G.playerTurnFlags?.energyGainedThisTurn||0;
  const canGain=Math.max(0,MAX_ENERGY_GAIN_PER_TURN-gained);
  const applied=Math.max(0,Math.min(amount||0,canGain));
  if(!applied) return 0;
  if(G.playerTurnFlags) G.playerTurnFlags.energyGainedThisTurn=gained+applied;
  player.energy=Math.min(player.energyMax||0,(player.energy||0)+applied);
  return applied;
}

// ============================================================
//  MAGIC ABILITY ACTION HANDLERS
// ============================================================
// Spell accuracy: MATK vs enemy MDEF determines miss chance
// diff = playerMATK - enemyMDEF
// base miss 18%, ±3% per point difference, clamped 3%–40%
function spellMissChance() {
  const matk = G.player.stats.matk || 8;
  const mdef = G.enemy.stats.mdef || 8;
  const diff = matk - mdef;
  const hb=G._pendingStrikeActionMods?.hitBonus||0;
  return Math.max(3, Math.min(40, 18 - diff * 3) - hb);
}

function spellMisses() {
  const ab=G._activePlayerAbility;
  return Math.random()*100 >= getPlayerHitPercentForAttack(ab||{});
}

function summonHitLands(){
  return Math.random()*100 < getPlayerHitPercentForAttack(G._activePlayerAbility||{});
}

function spellAilmentRoll(baseChance,isMultiHit=false){
  const matk=(G.player.stats.matk||8), mdef=(G.enemy.stats.mdef||8);
  const statShift=(matk-mdef)*2;
  const multiAdj=isMultiHit?-0.45:0.2;
  const final=Math.max(3,Math.min(92,Math.floor((baseChance+statShift)*(1+multiAdj))));
  return chance(final);
}

function matk(mult=1) {
  const b=G.player.stats.matk||8;
  const soft=softenMainStatForCombat(b)*COMBAT_OFFENSIVE_STAT_MULT;
  const strikeAdd=(G._pendingStrikeActionMods?.matkMultAdd!=null?G._pendingStrikeActionMods.matkMultAdd:G._pendingStrikeActionMods?.multAdd)||0;
  const __adm=(G.actionDamageHitsRemaining&&G.actionDamageHitsRemaining>0)?(G.actionDamageMult||1):1;
  let base=roundCombatDamage(rollCombatSpread(Math.max(0.01, soft*.8), Math.max(0.01, soft*1.2))*(mult+strikeAdd)*__adm);
  if((G.actionDamageHitsRemaining||0)>0){ G.actionDamageHitsRemaining=Math.max(0,G.actionDamageHitsRemaining-1); if(G.actionDamageHitsRemaining===0) G.actionDamageMult=1; }
  if(getWeakenStacks(G.playerStatus)>0) base=roundCombatDamage(base*getWeakenDamageMult(getWeakenStacks(G.playerStatus)));
  return Math.max(0.01, base);
}


Object.assign(ACTIONS, {
  async bleakBeak(ab){
    const r = dealDamage('enemy', pdmg(0.65, ab), chance(getPlayerCritChance(ab)), false, ab);
    await doAttack('player','enemy', r);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
  },
  async shadowJab(ab){
    const r = dealDamage('enemy', pdmg(0.60, ab), chance(getPlayerCritChance(ab)), false, ab);
    await doAttack('player','enemy', r);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    if(chance(25)) applyAilment('enemy','feared',1);
  },
  async pinionVolley(ab){
    const lv=Math.max(1,Math.min(ab.level||1,4));
    const pierceVals=[0.25,0.30,0.35,0.40];
    const oldPierce=ab.piercePct;
    ab.piercePct=Math.max(oldPierce||0,pierceVals[lv-1]);
    for(let i=0;i<2;i++){
      const r = dealDamage('enemy', pdmg(0.55 + (lv-1)*0.07, ab), chance(getPlayerCritChance(ab)), false, ab);
      await doAttack('player','enemy', r);
      if(G.enemy.stats.hp<=0) break;
    }
    ab.piercePct=oldPierce;
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
  },
  async shieldWing(ab){
    const lv=Math.max(1,Math.min(ab.level||1,4));
    const pct = 8 + (lv-1)*2;
    applySourceStatLoanPct(G.playerStatus, G.player, '_shieldWingLoans', 'def', ab.id||'shieldWing', pct, 2);
    spawnFloat('player', `+${pct}% DEF`, 'fn-status');
    spawnTrendFloat('player', 'buff');
  },
  async ironHonk(ab){
    const lv=Math.max(1,Math.min(ab.level||1,4));
    const r = dealDamage('enemy', pdmg(0.55 + (lv-1)*0.1, ab), chance(getPlayerCritChance(ab)), false, ab);
    await doAttack('player','enemy', r);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    applyWeakenStack('enemy', 1);
    spawnFloat('enemy','🐔 Weaken!','fn-status');
  },
  async dirgeOfDread(ab){
    if(spellMisses()){ await doMiss('player'); logMsg('Dirge of Dread missed!','miss'); return; }
    const lv=Math.max(1,Math.min(ab.level||1,4));
    await doSpell('player', '🎶');
    const dmg = (typeof matk==='function') ? matk(0.60 + (lv-1)*0.12) : pdmg(0.8 + (lv-1)*0.1, ab);
    const r = dealDamage('enemy', dmg, chance(getPlayerCritChance(ab)), true, ab);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    G.enemyStatus.feared=(G.enemyStatus.feared||0)+(2+(lv>=3?1:0));
    applyWeakenStack('enemy', 1);
    renderStatuses('enemy-status', G.enemyStatus);
  },
  async skyHymn(ab){
    const lv=Math.max(1,Math.min(ab.level||1,4));
    await doSpell('player', '🎵');
    G.playerStatus.humDodge={bonus:10+(lv-1)*5, turns:2 + getPlayerClassPerkBuffDurationBonus()};
    const heal = Math.max(3, Math.floor(G.player.stats.maxHp*(0.04 + (lv-1)*0.008))) + getPlayerClassPerkSongHealFlat();
    G.player.stats.hp = Math.min(G.player.stats.hp + heal, G.player.stats.maxHp);
    spawnFloat('player', `+${heal}❤️`, 'fn-heal');
    renderStatuses('player-status', G.playerStatus);
    setHpBar('player', G.player.stats.hp, G.player.stats.maxHp);
  },
  async marshHex(ab){
    if(spellMisses()){ await doMiss('player'); logMsg('Marsh Hex missed!','miss'); return; }
    const lv=Math.max(1,Math.min(ab.level||1,4));
    await doSpell('player','🜁');
    const dmg = (typeof matk==='function') ? matk(1.25 + (lv-1)*0.18) : pdmg(1.1 + (lv-1)*0.12, ab);
    const r = dealDamage('enemy', dmg, chance(getPlayerCritChance(ab)), true, ab);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    applyWeakenStack('enemy', 1);
    G.enemyStatus.feared=(G.enemyStatus.feared||0)+1;
    renderStatuses('enemy-status', G.enemyStatus);
  },
  async stormCall(ab){
    if(spellMisses()){ await doMiss('player'); logMsg('Storm Call missed!','miss'); return; }
    const lv=Math.max(1,Math.min(ab.level||1,4));
    await doSpell('player','⚡');
    const dmg = (typeof matk==='function') ? matk(1.45 + (lv-1)*0.20) : pdmg(1.2 + (lv-1)*0.14, ab);
    const r = dealDamage('enemy', dmg, chance(getPlayerCritChance(ab)), true, ab);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    if(chance(20 + (lv-1)*5)) applyAilment('enemy','paralyzed',1);
  },
  async nightChill(ab){
    if(spellMisses()){ await doMiss('player'); logMsg('Night Chill missed!','miss'); return; }
    const lv=Math.max(1,Math.min(ab.level||1,4));
    await doSpell('player','🌘');
    const dmg = (typeof matk==='function') ? matk(0.95 + (lv-1)*0.13) : pdmg(0.9 + (lv-1)*0.1, ab);
    const r = dealDamage('enemy', dmg, chance(getPlayerCritChance(ab)), true, ab);
    setHpBar('enemy', G.enemy.stats.hp, G.enemy.stats.maxHp);
    applyEnemySlow(2+(lv>=3?1:0), 8+(lv-1)*2, 2);
    spawnFloat('enemy','🐌 Slow!','fn-status');
    renderStatuses('enemy-status', G.enemyStatus);
  },
});

Object.assign(ACTIONS, {
  async thunderScreech(ab) {
    if(spellMisses()){await doMiss('player');logMsg(`Thunder Screech missed! (MATK ${G.player.stats.matk||8} vs MDEF ${G.enemy.stats.mdef||8})`,'miss');return;}
    const lv=ab.level;
    const ignoreMDEF=lv>=3?0.3:0;
    const effectiveMDEF=(G.enemy.stats.mdef||8)*(1-ignoreMDEF);
    const matkBase=G.player.stats.matk||8;
    const dmg=roundCombatDamage(Math.max(0.01, pdmg(1)*([.9,1.1,1.3,1.55][lv-1])*(matkBase/(effectiveMDEF||1))*0.88));
    applyFractionalHp(G.enemy.stats, -dmg); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
    spawnFloat('enemy',`🔊 -${formatCombatNumber(dmg)}`,'fn-dmg');
    if(lv>=2){const dot=Math.floor(G.enemy.stats.maxHp*.1);G.enemy.stats.hp-=dot;setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);spawnFloat('enemy',`-${dot}`,'fn-poison');}
    const skipC=[20,22,25,30][lv-1];
    const skipT=[3,3,4,5][lv-1];
    if(spellAilmentRoll([40,45,50,55][lv-1],false)) G.enemyStatus.sonicSkip={chance:skipC,turns:skipT};
    if(lv>=4){const selfHeal=Math.floor(G.player.stats.maxHp*.2);G.player.stats.hp=Math.min(G.player.stats.hp+selfHeal,G.player.stats.maxHp);setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);spawnFloat('player',`+${selfHeal}`,'fn-heal');}
    await doSpell('enemy','🔊 THUNDER SCREECH!');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🔊 Thunder Screech! ${dmg} sonic dmg + ${skipC}% turn skip for ${skipT}t!`,'player-action');
    triggerBlackbirdSpellPassive();
  },
  async stormChorus(ab) {
    if(spellMisses()){await doMiss('player');logMsg(`Storm Chorus missed! (MATK ${G.player.stats.matk||8} vs MDEF ${G.enemy.stats.mdef||8})`,'miss');return;}
    const lv=ab.level;
    const dmg=matk([.7,.9,1.1,1.3][lv-1]);
    applyFractionalHp(G.enemy.stats, -dmg); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
    spawnFloat('enemy',`🦉 -${formatCombatNumber(dmg)}`,'fn-dmg');
    const paraC=[15,20,20,25][lv-1];
    const turns=lv>=3?2:lv>=2?4:3;
    if(spellAilmentRoll(paraC,false))G.enemyStatus.paralyzed=(G.enemyStatus.paralyzed||0)+turns;
    if(lv>=4) G.player._mdefPierce=true;
    await doSpell('enemy','🦉 STORM CHORUS!');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🦉 Storm Chorus! ${dmg} psychic dmg + Paralysis chance.`,'player-action');
    triggerBlackbirdSpellPassive();
  },
  async shriekwave(ab) {
    if(spellMisses()){await doMiss('player');logMsg(`Shriekwave missed! (MATK ${G.player.stats.matk||8} vs MDEF ${G.enemy.stats.mdef||8})`,'miss');return;}
    const lv=ab.level;
    const isBurned=enemyHasBurning();
    const rawDmg=matk([1.0,1.2,1.4,1.65][lv-1]);
    const burnCritBonus=(isBurned&&lv>=3)?15:0;
    const isCrit=chance(Math.min(95,getPlayerCritChance(ab)+burnCritBonus));
    const dmg=isCrit?roundCombatDamage(rawDmg*(G.player.goldCritMult||1.5)):rawDmg;
    applyFractionalHp(G.enemy.stats, -dmg);
    setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
    spawnFloat('enemy',`🔥 -${formatCombatNumber(dmg)}${isCrit?' CRIT':''}!`,'fn-burn');
    if(spellAilmentRoll([55,60,65,70][lv-1],false)) G.enemyStatus.burning={turns:[3,4,4,5][lv-1]};
    if(lv>=4&&chance(15))applyAilment('enemy','poison',1);
    await doSpell('enemy','🔊 SHRIEKWAVE!');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🔊 Shriekwave! ${dmg} dmg + Burn${isCrit?' (CRIT!)':''}!`,'player-action');
    triggerBlackbirdSpellPassive();
  },
  async mobSwarm(ab) {
    const lv=ab.level;
    const hits=[3,4,4,5][lv-1];
    const dmgM=[.4,.45,.5,.55][lv-1];
    let total=0;
    for(let i=0;i<hits;i++){
      if(!summonHitLands()){await doMiss('player');continue;}
      const d=matk(dmgM);
      applyFractionalHp(G.enemy.stats, -d); total+=d;
      spawnFloat('enemy',` -${formatCombatNumber(d)}`,'fn-dmg');
      setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp);
      await delay(180);
      if(G.battleOver)return;
    }
    const skipC=[15,20,0,0][lv-1];
    const canConfuse=skipC&&spellAilmentRoll([18,22,0,0][lv-1],true);
    const canFear=lv>=3&&spellAilmentRoll([12,14,16,18][lv-1],true);
    if(canConfuse){
      G.enemyStatus.confused={turns:lv>=2?2:1,skipChance:skipC};
    }else if(canFear){
      G.enemyStatus.feared=(G.enemyStatus.feared||0)+(lv>=4?2:1);
    }
    await doSpell('enemy',' MOB SWARM!');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(` Mob Swarm! ${hits} hits, ${total} total!`,'player-action');
    triggerBlackbirdSpellPassive();
  },
  async thornBarrage(ab) {
    const lv=ab.level; const hits=lv>=3?3:2; let total=0;
    const spdPen=[2,2,3,3][lv-1], dodgePen=[10,12,15,20][lv-1], turns=[2,2,3,3][lv-1];
    for(let i=0;i<hits;i++){
      if(await doPlayerAttackMiss(ab)) continue;
      G._currentPiercePct=50;
      const r=dealDamage('enemy',pdmg([.75,.82,.8,.88][lv-1],ab));
      total+=r.dmgDealt; await doAttack('player','enemy',r); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp); if(G.battleOver)return;
    }
    applyEnemySlow(spdPen,dodgePen,turns);
    if(tryApplyAilment('enemy','poison',ab)) spawnFloat('enemy','☣','fn-poison');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🌵 Thorn Barrage! ${total} total ranged dmg + Slow.`,'player-action');
  },
  async shadowPounce(ab) {
    const lv=ab.level;
    if(await doPlayerAttackMiss(ab)) return;
    const hpPct=(G.enemy.stats.hp/Math.max(1,G.enemy.stats.maxHp));
    const finisher=(hpPct<0.4?[0,0,0,0.3][lv-1]:hpPct<0.5?[0,0.1,0.2,0.3][lv-1]:0);
    const isCrit=chance(Math.min(100,(G.player.stats.critChance||5)+[20,25,30,35][lv-1]));
    const r=dealDamage('enemy',pdmg(([1.15,1.3,1.45,1.65][lv-1])*(1+finisher),ab),isCrit,false);
    await doAttack('player','enemy',r); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp); if(G.battleOver)return;
    if(tryApplyAilment('enemy','feared',ab)) spawnFloat('enemy','😨','fn-status');
    logMsg(`🗡 Shadow Pounce! ${r.dmgDealt}${isCrit?' CRIT':''}${finisher>0?' (finisher bonus)':''}.`,'player-action');
  },
  async bulwarkRoar(ab) {
    const lv=ab.level; const defB=[6,8,10,12][lv-1]; const atkRed=[10,15,20,25][lv-1]; const turns=[2,2,3,3][lv-1];
    if(G.playerStatus.bulwarkRoar){
      G.player.stats.def=Math.max(0,(G.player.stats.def||0)-(G.playerStatus.bulwarkRoar.defBonus||0));
    }
    G.player.stats.def+=defB; G.playerStatus.bulwarkRoar={turns,defBonus:defB};
    G.enemyStatus.featherRuffle={...(G.enemyStatus.featherRuffle||{}),atkReduction:atkRed,turns:Math.max((G.enemyStatus.featherRuffle||{}).turns||0,turns),accDrop:(G.enemyStatus.featherRuffle||{}).accDrop||0};
    if(lv>=2) G.playerStatus.humDodge={bonus:10,turns:2};
    if(lv>=4) G.player.bulwarkFearImmune=2;
    await doSpell('player','🛡 BULWARK!');
    renderStatuses('player-status',G.playerStatus); renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🛡 Bulwark Roar! DEF +${defB}, enemy ATK −${atkRed}% for ${turns}t.`,'player-action');
  },
  async astralRefrain(ab) {
    if(spellMisses()){await doMiss('player');logMsg('Astral Refrain missed!','miss');return;}
    const lv=ab.level; const dmg=matk([.95,1.1,1.3,1.5][lv-1]);
    applyFractionalHp(G.enemy.stats, -dmg); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp); spawnFloat('enemy',`✨ -${formatCombatNumber(dmg)}`,'fn-dmg');
    const accDrop=[10,12,15,20][lv-1]; G.enemyStatus.accDebuff=(G.enemyStatus.accDebuff||0)+accDrop;
    if(spellAilmentRoll([35,40,45,50][lv-1],false)){applyAilment('enemy','weaken',1);spawnFloat('enemy','🐔','fn-status');}
    if(spellAilmentRoll([30,35,40,45][lv-1],false)) G.enemyStatus.confused={turns:3+Math.floor(lv/2),skipChance:20+5*lv};
    if(spellAilmentRoll([25,30,35,40][lv-1],false)) G.enemyStatus.feared=(G.enemyStatus.feared||0)+1;
    await doSpell('enemy','🎼 ASTRAL!'); renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`🎼 Astral Refrain! ${dmg} spell dmg, ACC −${accDrop}%.`,'player-action');
  },
  async murderMurmuration(ab) {
    const lv=ab.level; const hits=[3,4,4,5][lv-1]; const mult=[.4,.42,.48,.5][lv-1]; let total=0;
    for(let i=0;i<hits;i++){if(!summonHitLands()){await doMiss('player');continue;}const d=matk(mult); applyFractionalHp(G.enemy.stats, -d); total+=d; spawnFloat('enemy',`‍⬛ -${formatCombatNumber(d)}`,'fn-dmg'); setHpBar('enemy',G.enemy.stats.hp,G.enemy.stats.maxHp); await delay(150); if(G.battleOver)return;}
    const conf=[15,20,25,30][lv-1]; if(spellAilmentRoll(conf,true)) G.enemyStatus.confused={turns:1,skipChance:16+lv*2};
    const fearT=[0,1,2,2][lv-1]; if(fearT>0&&spellAilmentRoll([10,12,14,16][lv-1],true)) G.enemyStatus.feared=(G.enemyStatus.feared||0)+fearT;
    if(lv>=4) G.enemyStatus.featherRuffle={...(G.enemyStatus.featherRuffle||{}),atkReduction:15,turns:2,accDrop:(G.enemyStatus.featherRuffle||{}).accDrop||0};
    await doSpell('enemy','‍⬛ MURMURATION!'); renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`‍⬛ Murder Murmuration! ${hits} hits, ${total} total.`,'player-action');
  },
});

function tickTimedBuffsAfterEnemyPhase(){
  // Tick Tookie Tookie
  if(G.playerStatus.tookie){
    G.playerStatus.tookie.turns--;
    if(G.playerStatus.tookie.turns<=0){
      const t=G.playerStatus.tookie;
      if(t.defBonus>0) G.player.stats.def=Math.max(0,G.player.stats.def-t.defBonus);
      if(t.critBonus>0) G.player.stats.critChance=Math.max(0,(G.player.stats.critChance||10)-t.critBonus);
      delete G.playerStatus.tookie;
      G.tookieActive=false; G.tookieMiss=0;
      logMsg(`🦜 Tookie Tookie fades.`,'system');
    }
  }
  // Tick dustDevil/hum turns
  // dustDevil is now an enemy debuff (blind)
  if(G.enemyStatus.dustDevil){
    G.enemyStatus.dustDevil.turns--;
    if(G.enemyStatus.dustDevil.turns<=0){
      G.enemyStatus.accDebuff=Math.max(0,(G.enemyStatus.accDebuff||0)-(G.enemyStatus.dustDevil.accDrop||0));
      delete G.enemyStatus.dustDevil;
    }
  }
  if(G.playerStatus.hum){
    G.playerStatus.hum--;
    if(G.playerStatus.hum<=0){delete G.playerStatus.hum;G.player.humImmuneToFear=false;G.humMissBonus=0;delete G.playerStatus.humDodge;}
  } else if(G.playerStatus.humDodge) {
    G.playerStatus.humDodge.turns--;
    if(G.playerStatus.humDodge.turns<=0) delete G.playerStatus.humDodge;
  }
  if(G.playerStatus.trailSenseAcc){
    G.playerStatus.trailSenseAcc.turns--;
    if(G.playerStatus.trailSenseAcc.turns<=0) delete G.playerStatus.trailSenseAcc;
  }
  if(G.playerStatus.peregrineCritLens){
    G.playerStatus.peregrineCritLens.turns--;
    if(G.playerStatus.peregrineCritLens.turns<=0) delete G.playerStatus.peregrineCritLens;
  }
  if(G.playerStatus.tricksterCritDmgBuff){
    G.playerStatus.tricksterCritDmgBuff.turns--;
    if(G.playerStatus.tricksterCritDmgBuff.turns<=0) delete G.playerStatus.tricksterCritDmgBuff;
  }
  if(G.playerStatus.kookaCritLens){
    G.playerStatus.kookaCritLens.turns--;
    if(G.playerStatus.kookaCritLens.turns<=0) delete G.playerStatus.kookaCritLens;
  }
  if(G.playerStatus.owlCritFocus){
    G.playerStatus.owlCritFocus.turns--;
    if(G.playerStatus.owlCritFocus.turns<=0) delete G.playerStatus.owlCritFocus;
  }
  if(G.playerStatus.peregrineDiveAmp){
    G.playerStatus.peregrineDiveAmp.turns--;
    if(G.playerStatus.peregrineDiveAmp.turns<=0) delete G.playerStatus.peregrineDiveAmp;
  }
  // Tick warcry
  if(G.playerStatus.warcry){
    G.playerStatus.warcry.turns--;
    if(G.playerStatus.warcry.turns<=0){G.player.stats.spd-=G.playerStatus.warcry.spdBonus;delete G.playerStatus.warcry;G.warcryActive=false;G.warcryATK=0;}
  }
  // Tick battleHymnDodge
  if(G.playerStatus.battleHymnDodge){G.playerStatus.battleHymnDodge.turns--;if(G.playerStatus.battleHymnDodge.turns<=0)delete G.playerStatus.battleHymnDodge;}
  // Tick Flamingo ATK bonus
  // Tick battleHymn
  if(G.playerStatus.battleHymn){
    G.playerStatus.battleHymn.turns--;
    if(G.playerStatus.battleHymn.turns<=0){G.player.stats.def-=G.playerStatus.battleHymn.defBonus;delete G.playerStatus.battleHymn;delete G.playerStatus.battleHymnDodge;G.battleHymnActive=false;G.battleHymnDEF=0;G.battleHymnACC=0;}
  }
  const _tickTmp=(key,stat)=>{
    const o=G.playerStatus[key];
    if(!o||typeof o!=='object') return;
    o.turns=(o.turns||1)-1;
    if(o.turns<=0){
    if(stat==='def') G.player.stats.def=Math.max(0,(G.player.stats.def||0)-(o.amt||0));
    if(stat==='mdef') G.player.stats.mdef=Math.max(0,(G.player.stats.mdef||0)-(o.amt||0));
    if(stat==='matk') G.player.stats.matk=Math.max(0,(G.player.stats.matk||0)-(o.amt||0));
      if(stat==='atk') G.player.stats.atk=Math.max(0,(G.player.stats.atk||0)-(o.atk||0));
      delete G.playerStatus[key];
    }
  };
  _tickTmp('gooseHonkDef','def');
  _tickTmp('tankTempMdef','mdef');
  _tickTmp('featherFeintMdef','mdef');
  if(G.playerStatus.bruiserCallSpd){
    G.playerStatus.bruiserCallSpd.turns--;
    if(G.playerStatus.bruiserCallSpd.turns<=0){
      G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-(G.playerStatus.bruiserCallSpd.bonus||0));
      delete G.playerStatus.bruiserCallSpd;
    }
  }
  _tickTmp('cardinalMatk','matk');
  _tickTmp('cockatooSongMatk','matk');
  _tickTmp('singerSetupMatk','matk');
  _tickTmp('fairywrenMatk','matk');
  _tickTmp('robinDawnMatk','matk');
  _tickTmp('blackbirdOmenMatk','matk');
  if(G.playerStatus.dukeCourtBuff){
    G.playerStatus.dukeCourtBuff.turns--;
    if(G.playerStatus.dukeCourtBuff.turns<=0){
      G.player.stats.atk=Math.max(0,(G.player.stats.atk||0)-(G.playerStatus.dukeCourtBuff.atk||0));
      G.player.stats.matk=Math.max(0,(G.player.stats.matk||0)-(G.playerStatus.dukeCourtBuff.matk||0));
      delete G.playerStatus.dukeCourtBuff;
    }
  }
  if(G.playerStatus.predatorCourtSummon){
    G.playerStatus.predatorCourtSummon.turns--;
    if(G.playerStatus.predatorCourtSummon.turns<=0){
      const c=G.playerStatus.predatorCourtSummon;
      G.player.stats.atk=Math.max(0,(G.player.stats.atk||0)-(c.atk||0));
      G.player.stats.matk=Math.max(0,(G.player.stats.matk||0)-(c.matk||0));
      delete G.playerStatus.predatorCourtSummon;
    }
  }
  if(G.playerStatus.hummingbirdSpd){
    G.playerStatus.hummingbirdSpd.turns--;
    if(G.playerStatus.hummingbirdSpd.turns<=0){
      G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-(G.playerStatus.hummingbirdSpd.bonus||0));
      delete G.playerStatus.hummingbirdSpd;
    }
  }
  delete G.playerStatus.galahCritDmg;
  delete G.playerStatus.macawFlairAcc;
  if(G.player._magpieSpdLoan){ G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-G.player._magpieSpdLoan); delete G.player._magpieSpdLoan; }
  if(G.player._ostrichSpdLoan){ G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-G.player._ostrichSpdLoan); delete G.player._ostrichSpdLoan; }
  if(G.player._predatorUtilitySpdLoan){ G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-G.player._predatorUtilitySpdLoan); delete G.player._predatorUtilitySpdLoan; }
  if(G.player._predatorAtkLoan){ G.player.stats.atk=Math.max(0,(G.player.stats.atk||0)-G.player._predatorAtkLoan); delete G.player._predatorAtkLoan; }
  if(G.player._predatorAtkThisTurnLoan){ G.player.stats.atk=Math.max(0,(G.player.stats.atk||0)-G.player._predatorAtkThisTurnLoan); delete G.player._predatorAtkThisTurnLoan; }
  if(G.player._predatorMdefThisTurnLoan){ G.player.stats.mdef=Math.max(0,(G.player.stats.mdef||0)-G.player._predatorMdefThisTurnLoan); delete G.player._predatorMdefThisTurnLoan; }
  if(G.player._albatrossSpdLoan){ G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-G.player._albatrossSpdLoan); delete G.player._albatrossSpdLoan; }
  if(G.player._ravenGrimSpdLoan){ G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-G.player._ravenGrimSpdLoan); delete G.player._ravenGrimSpdLoan; }
  G.player._ravenGrimSpdThisTurn=false;
  if(G.playerStatus.desertStrider){
    G.playerStatus.desertStrider.turns--;
    if(G.playerStatus.desertStrider.turns<=0){
      G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-(G.playerStatus.desertStrider.spd||0));
      G.player._desertStriderBonus=0;
      delete G.playerStatus.desertStrider;
    }
  }
  if(G.playerStatus.sittingDuck)delete G.playerStatus.sittingDuck;
  if(G.playerStatus.guardianCry){G.playerStatus.guardianCry.turns--; if(G.playerStatus.guardianCry.turns<=0){G.player.stats.def=Math.max(0,G.player.stats.def-(G.playerStatus.guardianCry.defBonus||0));delete G.playerStatus.guardianCry;}}
  if(G.playerStatus.humImmuneToFear){G.playerStatus.humImmuneToFear--; if(G.playerStatus.humImmuneToFear<=0)delete G.playerStatus.humImmuneToFear;}
  if(G.playerStatus.wingStormSPD){
    G.playerStatus.wingStormSPD.turns--;
    if(G.playerStatus.wingStormSPD.turns<=0){G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-(G.playerStatus.wingStormSPD.spd||0));delete G.playerStatus.wingStormSPD;}
  }
  if(G.playerStatus.bulwarkRoar){
    G.playerStatus.bulwarkRoar.turns--;
    if(G.playerStatus.bulwarkRoar.turns<=0){
      const b=G.playerStatus.bulwarkRoar.defBonus||0;
      G.player.stats.def=Math.max(0,(G.player.stats.def||0)-b);
      delete G.playerStatus.bulwarkRoar;
    }
  }
  if(G.playerStatus.fleshRipperCrit){
    G.playerStatus.fleshRipperCrit.turns--;
    if(G.playerStatus.fleshRipperCrit.turns<=0){
      const c=G.playerStatus.fleshRipperCrit.amt||0;
      G.player.stats.critChance=Math.max(0,(G.player.stats.critChance||5)-c);
      delete G.playerStatus.fleshRipperCrit;
    }
  }
  if(G.playerStatus.diveGougeSpd){
    G.playerStatus.diveGougeSpd.turns--;
    if(G.playerStatus.diveGougeSpd.turns<=0){
      const d=G.playerStatus.diveGougeSpd.amt||0;
      G.player.stats.spd=Math.max(1,(G.player.stats.spd||1)-d);
      delete G.playerStatus.diveGougeSpd;
    }
  }
  if(G.enemyStatus.wormRiotExpose){
    G.enemyStatus.wormRiotExpose.turns--;
    if(G.enemyStatus.wormRiotExpose.turns<=0){G.enemy.stats.dodge=G.enemyStatus.wormRiotExpose.oldDodge||0;delete G.enemyStatus.wormRiotExpose;}
  }
  if(G.enemyStatus.strikerDodgeMark){
    G.enemyStatus.strikerDodgeMark.turns--;
    if(G.enemyStatus.strikerDodgeMark.turns<=0){
      G.enemy.stats.dodge=(G.enemy.stats.dodge||0)+(G.enemyStatus.strikerDodgeMark.amt||0);
      delete G.enemyStatus.strikerDodgeMark;
    }
  }
  tickStatuses('player', {skipGuarded:true});
  tickGuardedStatus(G.playerStatus);
}

function endPlayerTurn(force=false) {
  if(!force && (G.actionBusy||(G.actionQueue&&G.actionQueue.length))){
    logMsg('Actions pending…','miss');
    return;
  }
  if(G.turnPhase!==TURN.PLAYER||G.phase!=='PLAYER') return;
  G.animLock=false;
  G.turnPhase=TURN.ENEMY;
  G.phase='ENEMY';
  lockActionUI(true);
  BS.turns++;
  if(G.playerStatus.regen){
    G.playerStatus.regen--;
    if(G.regenPct>0){
      const healAmt=scaleHealForBleed('player',roundCombatDamage(Math.max(0.01,G.player.stats.maxHp*G.regenPct)));
      G.player.stats.hp=Math.min(G.player.stats.hp+healAmt,G.player.stats.maxHp);
      spawnFloat('player',`+${healAmt}`,'fn-heal');
      setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
    }
    if(G.playerStatus.regen<=0){delete G.playerStatus.regen;G.regenTurns=0;G.regenPct=0;}
  }
  const _ptbd=BIRDS[G.player.birdKey];
  if(_ptbd&&_ptbd.passive&&_ptbd.passive.onTurnEnd) _ptbd.passive.onTurnEnd(G.player);
  if((G.player.birdKey==='ostrich'||G.player.birdKey==='emu')&&G.player._rageCharge>0&&!['honkAttack','headWhip'].includes(G._lastPlayerAbility)){
    G.player._rageCharge=0;
  }
  G._lastPlayerAbility=null;
  tickPoisonDamageOnly('player');
  tickPoisonDamageOnly('enemy');
  tickDelayedForTarget('player');
  if(G.player.stats.hp<=0||G.enemy.stats.hp<=0){if(checkDeath())return;}
  tickGuardedStatus(G.enemyStatus);
  G.turn='enemy';
  lockActionUI(true);
  refreshBattleUI();
  setTimeout(()=>{
    enemyTurn().catch(err=>{
      console.error('[combat] enemyTurn failed', err);
      G.animLock=false;
      if(typeof lockActionUI==='function') lockActionUI(false);
      if(typeof normalizeBattleTurnState==='function') normalizeBattleTurnState();
      if(G.player?.stats?.hp>0 && G.enemy?.stats?.hp>0 && typeof afterEnemyTurn==='function') afterEnemyTurn();
    });
  },500);
}

// ============================================================
//  ENEMY AI
// ============================================================
function getEnemyActionEnergyCost(action){
  const frz=(G.enemyStatus?.frozen?.turns||0)>0?1:0;
  if(!action) return 1+frz;
  if(action.type==='ability'){
    const id=action.abilityId;
    const ab=(G.enemy?.abilities||[]).find(a=>a&&a.id===id)||{id,level:1};
    const tmpl=getAbilityTemplateForUI(ab);
    const byLv=Array.isArray(tmpl?.energyByLevel)?tmpl.energyByLevel[Math.min(Math.max(1,ab.level||1),4)-1]:null;
    if(Number.isFinite(byLv)) return Math.max(1,Math.min(5,byLv))+frz;
    if(Number.isFinite(tmpl?.energyCost)) return Math.max(1,Math.min(5,tmpl.energyCost))+frz;
    return 2+frz;
  }
  return 1+frz;
}

function getAIPersonalityProfile(enemy){
  const profiles=globalThis.AI_PERSONALITY_PROFILES||{};
  const id=(enemy?.aiPersonality||'tactical').toLowerCase();
  return profiles[id]||profiles.tactical||{damageBias:1.1,heavyBias:1,controlBias:1.1,buffBias:1,guardBias:0.9,healBias:0.8,finisherBias:1.05,repeatBias:0.8};
}
function getEnemyAIMemory(enemy){
  if(!enemy.aiMemory){
    enemy.aiMemory={lastAbilityId:null,lastActionCategory:null,lastTurnHadDamage:true,utilityStreak:0,turnsSinceHit:0,openingSetupUsed:false};
  }
  return enemy.aiMemory;
}
/** Classify a kit ability id for enemy AI weights (combat-pack templates). */
function classifyKitAbilityForEnemyAI(abilityId, enemy){
  const ab=(enemy?.abilities||[]).find(a=>a&&a.id===abilityId)||{id:abilityId,level:1};
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl) return 'utility';
  const btn=String(tmpl.btnType||tmpl.type||'').toLowerCase();
  const ailments=deriveAbilityAilments(ab, tmpl);
  const ctrlAil=new Set(['feared','weaken','poison','paralyzed','confused','burning','bleed','slow']);
  if(ailments.some(a=>ctrlAil.has(a))) return 'control';
  if(btn==='physical'||btn==='ranged'||btn==='spell') return 'damage';
  const tx=`${tmpl.name||''} ${tmpl.desc||''}`.toLowerCase();
  if(/heal|restore hp|recover|mend|regenerat/i.test(tx)) return 'heal';
  if(/shield|barrier|ward|bulwark|brace|fortif|iron guard/i.test(tx)) return 'guard';
  if(/(^|[^a-z])rage([^a-z]|$)|fury|war\s*cry|warcry|haste|empower|battle cry/i.test(tx)) return 'buff';
  return 'utility';
}
function enemyKitOffersSetupDebuffs(enemy){
  for(const id of getEnemyKitAbilityIds(enemy)){
    if(classifyKitAbilityForEnemyAI(id,enemy)==='control') return true;
  }
  return false;
}
function getEnemyMode(e,p){
  const hpPct=(e.stats.hp||1)/Math.max(1,e.stats.maxHp||1);
  const pHpPct=(p.stats.hp||1)/Math.max(1,p.stats.maxHp||1);
  if(hpPct<0.30) return 'RECOVER';
  if(pHpPct<0.40) return 'EXECUTE';
  if(enemyKitOffersSetupDebuffs(e)) return 'SETUP';
  return 'PRESSURE';
}
function classifyEnemyActionCategory(action){
  if(!action) return 'utility';
  if(action.type!=='ability') return 'utility';
  if(G?.enemy){
    const k=classifyKitAbilityForEnemyAI(action.abilityId,G.enemy);
    if(k==='heal') return 'heal';
    if(k==='guard') return 'guard';
    if(k==='buff') return 'buff';
    if(k==='control') return 'control';
    if(k==='damage') return 'damage';
    if(k==='utility') return 'control';
  }
  return 'damage';
}
function buildEnemyActionPool(e,mode){
  const ids=getEnemyKitAbilityIds(e);
  const pool=[];
  const push=(a,w=1,meta={})=>{for(let i=0;i<w;i++) pool.push({...a,...meta});};
  const pushAbility=(id,w=1,meta={})=>{
    const cat=classifyKitAbilityForEnemyAI(id,e);
    const icon={heal:'🌿',guard:'🛡',control:'🌀',buff:'⚡',damage:'✦',utility:'✨'}[cat]||'✦';
    const isUtility=meta.isUtility!=null?meta.isUtility:(cat==='heal'||cat==='guard'||cat==='buff'||cat==='control');
    push({type:'ability',abilityId:id,icon,label:getEnemyAbilityDisplayLabel(id,e)},w,{isUtility,...meta});
  };
  const healIds=[], guardIds=[], ctrlIds=[], buffIds=[], damIds=[], utilIds=[];
  for(const id of ids){
    const cat=classifyKitAbilityForEnemyAI(id,e);
    if(cat==='heal') healIds.push(id);
    else if(cat==='guard') guardIds.push(id);
    else if(cat==='control') ctrlIds.push(id);
    else if(cat==='buff') buffIds.push(id);
    else if(cat==='damage') damIds.push(id);
    else if(cat==='utility') utilIds.push(id);
  }
  if(mode==='RECOVER'){
    for(const id of healIds) pushAbility(id,4,{isUtility:true});
    for(const id of guardIds) pushAbility(id,3,{isUtility:true});
    for(const id of damIds) pushAbility(id,2,{isUtility:false});
  }else if(mode==='EXECUTE'){
    for(const id of damIds) pushAbility(id,5,{isUtility:false});
    for(const id of ctrlIds) pushAbility(id,2,{isUtility:true});
    for(const id of buffIds) pushAbility(id,2,{isUtility:true});
    for(const id of utilIds) pushAbility(id,2,{isUtility:true});
  }else if(mode==='SETUP'){
    for(const id of ctrlIds) pushAbility(id,4,{isUtility:true});
    for(const id of utilIds) pushAbility(id,2,{isUtility:true});
    for(const id of damIds) pushAbility(id,3,{isUtility:false});
    for(const id of buffIds) pushAbility(id,2,{isUtility:true});
  }else{
    for(const id of damIds) pushAbility(id,5,{isUtility:false});
    for(const id of utilIds) pushAbility(id,2,{isUtility:true});
    for(const id of buffIds) pushAbility(id,2,{isUtility:true});
    for(const id of ctrlIds) pushAbility(id,2,{isUtility:true});
  }
  if(!pool.length){
    for(const id of ids) pushAbility(id,1,{isUtility:false});
  }
  return pool;
}
function projectedEnemyActionDamage(a,e){
  if(!a||a.type!=='ability') return 0;
  const id=a.abilityId;
  const ab=(e.abilities||[]).find(x=>x&&x.id===id)||{id,level:1};
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl) return 0;
  const btn=String(tmpl.btnType||tmpl.type||'').toLowerCase();
  if(btn==='physical'||btn==='ranged'||btn==='spell'){
    let mult=(tmpl.baseDmgMult!=null)?(Number(tmpl.baseDmgMult)||0)+0.1*((ab.level||1)-1):0.9;
    mult=Math.max(0.25,mult);
    const stat=(btn==='spell')?(e.stats.matk||8):(e.stats.atk||8);
    return roundCombatDamage(stat*mult);
  }
  return 0;
}
function canEnemyProjectLethal(e,p,pool,totalEnergy){
  const energy=Math.max(0,totalEnergy||0);
  if(energy<=0) return false;
  const dmgActions=[];
  const seen=new Set();
  for(const a of pool||[]){
    const cost=getEnemyActionEnergyCost(a);
    const dmg=projectedEnemyActionDamage(a,e);
    if(cost<=0||dmg<=0||cost>energy) continue;
    const sig=`${a.type}:${a.abilityId||''}:${cost}:${dmg}`;
    if(seen.has(sig)) continue;
    seen.add(sig);
    dmgActions.push({cost,dmg});
  }
  const targetHp=Math.max(1,Math.floor(p?.stats?.hp||1));
  if(!dmgActions.length) return false;
  const dp=Array(energy+1).fill(0);
  for(let en=1;en<=energy;en++){
    for(const a of dmgActions){
      if(a.cost<=en) dp[en]=Math.max(dp[en], dp[en-a.cost]+a.dmg);
    }
  }
  return dp[energy] >= targetHp;
}
function getBossIntentCycle(e){
  const id=normalizeEnemyNameKey(e?.name||'');
  if(id==='dukeblakiston') return ['control','buff','pressure','attack'];
  return ['buff','control','attack','pressure'];
}
function getEnemyArchetype(e){
  const cls=String(e?.enemyClass||'').toLowerCase();
  const persona=String(e?.aiPersonality||'').toLowerCase();
  if(['striker'].includes(cls)) return 'striker';
  if(['predator'].includes(cls) || ['executioner','reaper'].includes(persona)) return 'predator';
  if(['bruiser'].includes(cls) || ['duelist'].includes(persona)) return 'bruiser';
  if(['tank'].includes(cls) || ['tank'].includes(persona)) return 'tank';
  if(['trickster'].includes(cls) || ['control','seer','scavenger','opportunistic'].includes(persona)) return 'trickster';
  if(['singer'].includes(cls)) return 'singer';
  return 'striker';
}
function getArchetypeIntentWeights(){
  return globalThis.ARCHETYPE_INTENT_WEIGHTS||{striker:{attack:60,pressure:25,buff:10,control:5,finish:0}};
}
function getArchetypePriorityOrder(archetype){
  if(archetype==='predator') return ['control','heavy','damage','buff','guard','heal'];
  if(archetype==='bruiser') return ['buff','heavy','damage','guard','control','heal'];
  if(archetype==='tank') return ['buff','guard','damage','control','heavy','heal'];
  if(archetype==='trickster') return ['control','damage','heavy','buff','guard','heal'];
  if(archetype==='singer') return ['control','buff','damage','heavy','guard','heal'];
  return ['damage','heavy','control','buff','guard','heal'];
}
function getArchetypeCategoryBonus(archetype,cat){
  const order=getArchetypePriorityOrder(archetype);
  const idx=order.indexOf(cat);
  if(idx<0) return 1;
  const bonus=[1.35,1.22,1.10,1.0,0.9,0.82][idx] || 0.82;
  return bonus;
}
function selectEnemyIntent(e,p,pool,totalEnergy,mode){
  const stage=(G.stage||1);
  const archetype=getEnemyArchetype(e);
  const canFinish=(stage>5) && canEnemyProjectLethal(e,p,pool,totalEnergy);
  if(e?.isBoss){
    if(canFinish) return {intent:'finish', canFinish:true, archetype};
    const cycle=getBossIntentCycle(e);
    const idx=Math.max(0,((G.enemyTurnCount||1)-1)%cycle.length);
    return {intent:cycle[idx]||'attack', canFinish:false, archetype};
  }
  if(canFinish) return {intent:'finish', canFinish:true, archetype};

  const intentWeights=getArchetypeIntentWeights();
  const base=intentWeights[archetype]||intentWeights.striker;
  const weights={...base};
  const pHp=(p.stats.hp||1)/Math.max(1,p.stats.maxHp||1);
  const eHp=(e.stats.hp||1)/Math.max(1,e.stats.maxHp||1);
  if(mode==='SETUP') weights.control=(weights.control||0)+8;
  if(mode==='RECOVER') weights.buff=(weights.buff||0)+10;
  if(archetype==='predator' && pHp<0.5) weights.attack=(weights.attack||0)+12;
  if(eHp<0.45) weights.buff=(weights.buff||0)+6;
  const hasControl=(pool||[]).some(a=>classifyEnemyActionCategory(a)==='control');
  const hasBuff=(pool||[]).some(a=>['buff','guard','heal'].includes(classifyEnemyActionCategory(a)));
  if(!hasControl) weights.control=0;
  if(!hasBuff) weights.buff=0;
  if(stage<=5) weights.finish=0;
  const entries=Object.entries(weights).filter(([,w])=>w>0);
  if(!entries.length) return {intent:'attack', canFinish:false, archetype};
  const total=entries.reduce((n,[,w])=>n+w,0);
  let rollVal=Math.random()*total;
  for(const [intent,w] of entries){
    rollVal-=w;
    if(rollVal<=0) return {intent, canFinish:false, archetype};
  }
  return {intent:entries[entries.length-1][0], canFinish:false, archetype};
}
function filterEnemyActionsByIntent(intent,pool){
  const all=(pool||[]);
  const categories=all.map(a=>({action:a,cat:classifyEnemyActionCategory(a)}));
  if(intent==='finish') return categories.filter(x=>x.cat==='damage').map(x=>x.action);
  if(intent==='attack') return categories.filter(x=>x.cat==='damage').map(x=>x.action);
  if(intent==='control') return categories.filter(x=>x.cat==='control').map(x=>x.action);
  if(intent==='buff') return categories.filter(x=>['buff','guard','heal'].includes(x.cat)).map(x=>x.action);
  if(intent==='pressure') return categories.filter(x=>x.cat==='control'||x.cat==='damage').map(x=>x.action);
  return all;
}
function getEnemyEnergySpendCap(e,p,pool,totalEnergy,intent,canFinish){
  const energy=Math.max(0,totalEnergy||0);
  if(energy<=0) return 0;
  const stage=(G.stage||1);
  if(intent==='finish' && canFinish && stage>5) return energy;
  const minSpend=Math.max(1,Math.ceil(energy*0.6));
  let maxSpend=Math.max(minSpend,Math.floor(energy*0.75));
  const hardCaps={2:2,3:2,4:3,5:3};
  if(hardCaps[energy]) maxSpend=Math.min(maxSpend,hardCaps[energy]);
  if(maxSpend<minSpend) maxSpend=minSpend;
  let spendCap=roll(minSpend,maxSpend);
  return Math.max(1,Math.min(energy,spendCap));
}
function getEnemyOpeningBias(enemy,turnNumber){
  const p=(enemy.aiPersonality||'tactical').toLowerCase();
  if(turnNumber>1) return {};
  if(['aggressive','duelist','executioner'].includes(p)) return {damage:1.25,heavy:1.20,control:0.9};
  if(['control','seer'].includes(p)) return {control:1.35,buff:1.2,damage:0.9};
  if(['tank'].includes(p)) return {guard:1.25,heal:1.15,damage:0.9};
  if(['scavenger','opportunistic'].includes(p)) return {control:1.2,damage:1.05};
  if(['predator'].includes(p)) return {control:1.25,damage:1.1};
  return {};
}
function getEnemyActionComboBonus(enemy,action,cat){
  const m=getEnemyAIMemory(enemy);
  const p=(enemy.aiPersonality||'tactical').toLowerCase();
  const prev=String(m.lastAbilityId||'');
  if(!prev) return 1;
  if(['duelist','executioner'].includes(p) && ['eWeaken','eFear','eBlind'].includes(prev) && (cat==='heavy'||cat==='damage')) return 1.30;
  if(['seer','control'].includes(p) && prev==='eBlind' && cat==='damage') return 1.25;
  if(['reaper','scavenger'].includes(p) && ['ePoison','eVenom'].includes(prev) && (cat==='damage'||cat==='heavy')) return 1.25;
  if(p==='predator' && ['eShield','eRage','eWeaken','eFear'].includes(prev) && (cat==='heavy'||cat==='damage')) return 1.35;
  return 1;
}
/* planEnemyTurn — implemented in js/systems/enemy-ai.js (enhanced EV planner). */

function enemyHpPct(e){ return (e?.stats?.hp||1)/Math.max(1,(e?.stats?.maxHp||1)); }
function playerHpPct(){ return (G.player?.stats?.hp||1)/Math.max(1,(G.player?.stats?.maxHp||1)); }
function mapAiStyleToType(style){
  const s=String(style||'').toLowerCase();
  if(['aggressive','berserker'].includes(s)) return 'aggressive';
  if(['cautious','defensive'].includes(s)) return 'defensive';
  if(['trickster'].includes(s)) return 'trickster';
  if(['predator'].includes(s)) return 'predator';
  return 'aggressive';
}
function planEnemyAction() {
  const e=G.enemy;
  if(typeof prepareEnemyCombatLoadout==='function') prepareEnemyCombatLoadout(e);
  const plan=planEnemyTurn(e,G.player);
  const actions=(plan.actions||[]).slice(0,MAX_ENEMY_ACTIONS_PER_TURN);
  G.enemyPlannedActions=actions;
  const persona=(e.aiPersonality||'tactical');
  const preview=actions.slice(0,2).map(a=>`${a.icon||'•'} ${a.type==='ability'?getEnemyAbilityDisplayLabel(a.abilityId,G.enemy):a.label}`).join(' → ');
  const extraCount=Math.max(0,actions.length-2);
  const more=extraCount>0?` +${extraCount}`:'';
  const labelText=((preview||'…')+more).trim();
  return {label:labelText,type:'plan',actions,mode:plan.mode,archetype:plan.archetype||'striker',intent:plan.intent||'attack',energySpendCap:plan.energySpendCap||0,personality:persona};
}


function isBossEnrageAllowed(){ return !!(G.endlessMode && (G.stage||0) > 20); }
function dukeNightfall(){
  const d=G.enemy.duke; d.phase=2; d.nightfallTurns=2;
  setStatusMax(G.enemyStatus,'nightfall',2);
  setStatusMax(G.playerStatus,'blind',Math.max(G.playerStatus.blind||0,1));
  refreshStatus(G.enemyStatus,'defending',10,999);
  logMsg('🦉 Nightfall descends. The marsh swallows light.','boss');
}
function dukeRiverGrip(){
  setStatusMax(G.playerStatus,'rooted',2);
  applyPlayerSlow(2,8,2);
  spawnFloat('player','🌊 River Grip!','fn-status');
  logMsg('🌊 River Grip binds your wings.','boss');
}
function dukeTrackDecree(abilityId){
  const d=G.enemy?.duke; if(!d) return;
  if(d.decreeKey===abilityId) d.decreeStacks=clamp((d.decreeStacks||0)+1,0,6);
  else { d.decreeKey=abilityId; d.decreeStacks=0; }
}
function dukeApplyDecreePunish(){
  const d=G.enemy.duke; const st=d.decreeStacks||0; if(st<=0) return;
  applyWeakenStack('player', 1+Math.floor(st/2));
  refreshStatus(G.playerStatus,'vulnerable',1,6);
  spawnFloat('player',`📜 Decree(${st})`,'fn-status');
  logMsg(`📜 Court Decree punishes repetition (${st}).`,'boss');
}
function dukeOwlsVerdict(){
  const p=G.player.stats; const missing=1-(p.hp/p.maxHp); const mult=1.15+missing*0.95;
  const r=dealDamage('player',edmg(1.35*mult));
  spawnFloat('player',`🦉-${r.dmgDealt}`,'fn-dmg');
  logMsg('🦉 Owl’s Verdict!','boss');
}
function dukeSummonCourt(){
  refreshStatus(G.enemyStatus,'defending',18,999);
  refreshStatus(G.enemyStatus,'wardens',2,4);
  spawnFloat('enemy','🛡️ Court Guards!','fn-status');
  logMsg('🛡️ The Court gathers—wardens at his wings.','boss');
}
function dukeTurnAI(){
  const e=G.enemy; const d=e.duke;
  const mem=getEnemyAIMemory(e);
  const enraged=isBossEnrageAllowed() && e.stats.hp<=Math.floor(e.stats.maxHp*0.35);
  if(enraged) setStatusMax(G.enemyStatus,'enraged',2);
  d.riverCd=Math.max(0,(d.riverCd||0)-1);
  d.summonCd=Math.max(0,(d.summonCd||0)-1);
  d.verdictCd=Math.max(0,(d.verdictCd||0)-1);
  if(d.phase>=3) dukeApplyDecreePunish();
  if(d.phase===1 && e.stats.hp<=Math.floor(e.stats.maxHp*0.75)){ mem.utilityStreak=(mem.utilityStreak||0)+1; mem.lastTurnHadDamage=false; mem.lastAbilityId='dukeNightfall'; mem.lastActionCategory='control'; dukeNightfall(); return; }
  if(d.phase===2){ d.nightfallTurns--; if(d.nightfallTurns<=0){ d.phase=3; logMsg('📜 The Court speaks in decree.','boss'); } }
  if(d.summonCd===0){ d.summonCd=4; mem.utilityStreak=(mem.utilityStreak||0)+1; mem.lastTurnHadDamage=false; mem.lastAbilityId='dukeSummonCourt'; mem.lastActionCategory='guard'; dukeSummonCourt(); return; }
  if(d.riverCd===0){ d.riverCd=3; mem.utilityStreak=(mem.utilityStreak||0)+1; mem.lastTurnHadDamage=false; mem.lastAbilityId='dukeRiverGrip'; mem.lastActionCategory='control'; dukeRiverGrip(); return; }
  const p=G.player.stats;
  if(d.verdictCd===0 && (p.hp<=Math.floor(p.maxHp*0.5) || (G.enemyStatus.enraged||0)>0)){ d.verdictCd=3; mem.utilityStreak=0; mem.lastAbilityId='dukeOwlsVerdict'; mem.lastActionCategory='heavy'; mem.lastTurnHadDamage=true; dukeOwlsVerdict(); return; }
  const r=dealDamage('player',edmg(1.0));
  mem.utilityStreak=0; mem.lastAbilityId='dukeTalons'; mem.lastActionCategory='damage'; mem.lastTurnHadDamage=(r.dmgDealt||0)>0;
  spawnFloat('player',`-${r.dmgDealt}`,'fn-dmg');
  logMsg('🦉 Talons in the dark.','boss');
}

function enemyKitAbilityIsHardCC(abilityId, enemy){
  if(abilityId==='eStun') return true;
  const ab=(enemy.abilities||[]).find(a=>a&&a.id===abilityId)||{id:abilityId,level:1};
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl) return false;
  return deriveAbilityAilments(ab,tmpl).includes('paralyzed');
}

async function executeEnemyKitTemplateAbility(enemy, abilityId, totalEnemyMiss){
  const ab=(enemy.abilities||[]).find(a=>a&&a.id===abilityId)||{id:abilityId,level:Math.max(1,Math.min(4,enemy.storyLevel||1))};
  const tmpl=getAbilityTemplateForUI(ab);
  if(!tmpl){
    logMsg(`${enemy.name} hesitates.`,'miss');
    return;
  }
  const btn=String(tmpl.btnType||tmpl.type||'').toLowerCase();
  const name=tmpl.name||abilityId;
  const cat=classifyKitAbilityForEnemyAI(abilityId,enemy);
  if(cat==='heal'){
    const heal=roundCombatDamage((enemy.stats.maxHp||40)*0.14);
    applyFractionalHp(enemy.stats, heal);
    enemy.stats.hp=Math.min(enemy.stats.maxHp||enemy.stats.hp, enemy.stats.hp);
    await doSpell('enemy',`🌿 ${name}!`);
    setHpBar('enemy',enemy.stats.hp,enemy.stats.maxHp);
    logMsg(`${enemy.name} recovers ${heal} HP.`,'enemy-action');
    return;
  }
  if(cat==='guard'){
    await doSpell('enemy',`🛡 ${name}!`);
    refreshStatus(G.enemyStatus,'defending',1,999);
    await doShield('enemy');
    renderStatuses('enemy-status',G.enemyStatus);
    logMsg(`${enemy.name} braces!`,'enemy-action');
    return;
  }
  if(cat==='buff'){
    await doSpell('enemy',`⚡ ${name}!`);
    G.enemyStatus.atkBuff=Math.max(G.enemyStatus.atkBuff||0,roundCombatDamage((enemy.stats.atk||8)*0.22));
    logMsg(`${enemy.name} surges — ATK up!`,'enemy-action');
    renderStatuses('enemy-status',G.enemyStatus);
    return;
  }
  if(btn==='physical'||btn==='ranged'){
    G._incomingAttackKind=btn==='ranged'?'ranged':'physical';
    G._incomingBypassesDeflect=false;
    if(totalEnemyMiss>0&&chance(totalEnemyMiss)){
      await doMiss('enemy');
      logMsg(`${enemy.name} fumbles!`,'miss');
      return;
    }
    const tmplRow=getAbilityTemplateForUI(ab);
    const raw=computeEntityAbilityRawDamage(enemy, ab, tmplRow, false);
    const r=dealDamage('player',raw,false,false,ab);
    await doAttack('enemy','player',r);
    setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
    if(r.wasDodged) logMsg(`${name} — dodged!`,'miss');
    else logMsg(`${enemy.name} — ${name}${r.isCrit?' CRIT':''} for ${r.dmgDealt}!`,'enemy-action');
    return;
  }
  if(btn==='spell'){
    G._incomingAttackKind='magic';
    G._incomingBypassesDeflect=true;
    const tmplRow2=getAbilityTemplateForUI(ab);
    const raw=computeEntityAbilityRawDamage(enemy, ab, tmplRow2, true);
    const r=dealDamage('player',raw,false,true,ab);
    if(r.wasDodged){
      spawnFloat('player','Dodged!','fn-dodge'); playAvatarAnim('player','do-dodge-r',400); SFX.dodge(); await delay(420);
      logMsg(`✨ ${G.player.name} slips the spell!`,'system');
      return;
    }
    await doSpell('enemy',`✦ ${name}!`);
    await doAttack('enemy','player',r);
    setHpBar('player',G.player.stats.hp,G.player.stats.maxHp);
    if(r.wasDodged) logMsg(`${name} — dodged!`,'miss');
    else logMsg(`${enemy.name} — ${name}${r.isCrit?' CRIT':''} for ${r.dmgDealt}!`,'enemy-action');
    return;
  }
  await doSpell('enemy',`✦ ${name}!`);
  const ailments=deriveAbilityAilments(ab,tmpl);
  let any=false;
  for(const ail of ailments){
    if(chance(Math.min(88,42+(ab.level||1)*9))){
      applyAilment('player',ail,1);
      any=true;
    }
  }
  if(any) logMsg(`${enemy.name} — ${name}!`,'enemy-action');
  else logMsg(`${enemy.name} uses ${name}.`,'enemy-action');
}

async function enemyTurn() {
  const e=G.enemy; G.animLock=true; G.turn='enemy'; G.turnPhase=TURN.ENEMY; G.phase='ENEMY';
  lockActionUI(true);
  G.enemyTurnCount=(G.enemyTurnCount||0)+1;
  startEnemyTurn(e);
  if(G.enemy?.aiType==='boss_duke'){
    let dukeActions=0;
    while((e.energy||0)>0 && dukeActions<MAX_ENEMY_ACTIONS_PER_TURN){
      dukeTurnAI();
      e.energy=Math.max(0,(e.energy||0)-1);
      dukeActions++;
      if(G.player.stats.hp<=0||G.enemy.stats.hp<=0){if(checkDeath())return;}
      await delay(220);
    }
    G.animLock=false;
    afterEnemyTurn();
    return;
  }
  // Tick mud slow
  if(G.enemyStatus.mud){
    G.enemyStatus.mud.turns--;
    if(G.enemyStatus.mud.turns<=0){G.enemy.stats.spd+=G.enemyStatus.mud.origReduced;delete G.enemyStatus.mud;logMsg(`${G.enemy.name} shook off the mud!`,'system');}
  }
  if(G.enemyStatus.slow){
    G.enemyStatus.slow.turns--;
    if(G.enemyStatus.slow.turns<=0){
      G.enemy.stats.spd=Math.max(1,(G.enemy.stats.spd||1)+(G.enemyStatus.slow.spdPenalty||0));
      G.enemy.stats.dodge=Math.min(95,(G.enemy.stats.dodge||0)+(G.enemyStatus.slow.dodgePenalty||0));
      delete G.enemyStatus.slow;
      logMsg(`${G.enemy.name} shook off Slow.`,'system');
    }
  }
  if(G.enemyStatus.chilled && (G.enemyStatus.chilled.turns||0)>0){
    G.enemyStatus.chilled.turns--;
    if(G.enemyStatus.chilled.turns<=0){
      const base=G.enemyStatus.chilled.baseSpd;
      if(base!=null) G.enemy.stats.spd=Math.max(1, base);
      delete G.enemyStatus.chilled;
      logMsg(`${G.enemy.name} shook off Chill.`,'system');
    }
  }
  if(G.enemyStatus.feared>0&&chance(STATUS_FEAR_SKIP_PCT)){
    spawnFloat('enemy','😨 Panic!','fn-status');await delay(400);
    logMsg(`${e.name} is too frightened to act!`,'enemy-action');
    G.animLock=false;afterEnemyTurn();return;
  }

  if(G.enemyStatus.sonicSkip&&G.enemyStatus.sonicSkip.turns>0&&chance(G.enemyStatus.sonicSkip.chance)){
    spawnFloat('enemy','🔊 Stunned by Dirge!','fn-status');await delay(400);
    logMsg(`${e.name} stunned by Sonic Dirge!`,'enemy-action');
    G.animLock=false;afterEnemyTurn();return;
  }
  if(G.enemyStatus.waddleLullaby&&G.enemyStatus.waddleLullaby.turns>0&&chance(G.enemyStatus.waddleLullaby.chance)){
    spawnFloat('enemy','💤 Lulled!','fn-status');await delay(400);
    logMsg(`${e.name} is lulled to sleep by the Emperor Penguin's waddle!`,'enemy-action');
    G.animLock=false;afterEnemyTurn();return;
  }
  if(G.enemyStatus.stunned>0){spawnFloat('enemy','😵 Stunned!','fn-status');await delay(400);logMsg(`${e.name} is stunned!`,'enemy-action');G.animLock=false;afterEnemyTurn();return;}
  if(G.enemyStatus.paralyzed>0&&chance(AILMENTS.paralyzed.skipChance||20)){spawnFloat('enemy','⚡ Para!','fn-status');await delay(400);logMsg(`${e.name} paralyzed — cannot act!`,'enemy-action');G.animLock=false;afterEnemyTurn();return;}

  if(G.playerStatus.counterInstinct&&G.playerStatus.counterInstinct>0){
    applyAilment('enemy','bleed',1);
    G.playerStatus.counterInstinct--;
    if(G.playerStatus.counterInstinct<=0) delete G.playerStatus.counterInstinct;
  }
  G.enemyNextAction=planEnemyAction();
  const rawPlan=(G.enemyNextAction&&G.enemyNextAction.actions&&G.enemyNextAction.actions.length)?G.enemyNextAction.actions:planEnemyTurn(e,G.player).actions;
  const plan=rawPlan.slice(0,MAX_ENEMY_ACTIONS_PER_TURN);
  G.enemyLastPlan=plan;
  const blindPenalty=(G.enemyStatus.enemyBlind>0)?15:0;
  const totalEnemyMiss=blindPenalty;

  G.enemyActionsThisTurn=0;
  let usedHardCCThisTurn=false;
  const aiMem=getEnemyAIMemory(e);
  let turnHadDamage=false;
  for(const action of plan){
    if(G.enemyActionsThisTurn>=MAX_ENEMY_ACTIONS_PER_TURN) break;
    const cost=getEnemyActionEnergyCost(action);
    if((e.energy||0)<cost) break;
    e.energy-=cost;
    G.enemyActionsThisTurn++;
    renderEnemyPlan();
    G.enemyLastAction=action||null;
    G._incomingBypassesDeflect=false;

    if(action.type==='ability'){
      if(enemyKitAbilityIsHardCC(action.abilityId,e)) usedHardCCThisTurn=true;
      const _cAb=G.enemyStatus.confused;
      if(_cAb&&(_cAb.turns||0)>0&&chance(Number.isFinite(_cAb.selfChance)?_cAb.selfChance:STATUS_CONFUSED_SELF_PCT)){
        const abRoll=rollEnemyCritDamage(edmg(0.85));
        const selfD=abRoll.amount;
        e.stats.hp=Math.max(0,e.stats.hp-selfD);
        setHpBar('enemy',e.stats.hp,e.stats.maxHp);
        spawnFloat('enemy',`🌀 -${selfD}`,'fn-dmg');
        logMsg(`${e.name} fumbles in confusion for ${selfD}!`,'enemy-action');
        await delay(400);
        if(selfD>0) turnHadDamage=true;
        continue;
      }
      const _stBd=BIRDS[G.player.birdKey];
      if(_stBd&&_stBd.passive&&_stBd.passive.onEnemyAttackCheck&&_stBd.passive.onEnemyAttackCheck(G.player,G)){
        spawnFloat('enemy','👁 Frozen by Dread!','fn-status');
        logMsg(`${e.name} freezes under ${G.player.name}'s prehistoric stare!`,'system');
        continue;
      }
      await executeEnemyKitTemplateAbility(e,action.abilityId,totalEnemyMiss);
      if(projectedEnemyActionDamage(action,e)>0) turnHadDamage=true;
      const _macBd2=BIRDS[G.player.birdKey];
      if(_macBd2&&_macBd2.passive&&_macBd2.passive.onEnemyAbility) _macBd2.passive.onEnemyAbility(G.player,action.abilityId);
      renderStatuses('player-status',G.playerStatus); renderStatuses('enemy-status',G.enemyStatus);
    } else if(action.type==='strike'||action.type==='heavy'||action.type==='defend'){
      logMsg(`${e.name} hesitates (legacy action).`,'miss');
    }

    aiMem.lastAbilityId=action.abilityId||action.type;
    aiMem.lastActionCategory=classifyEnemyActionCategory(action);
    if(G.player.stats.hp<=0||G.enemy.stats.hp<=0){break;}
  }

  aiMem.lastTurnHadDamage=turnHadDamage;
  aiMem.turnsSinceHit=turnHadDamage?0:((aiMem.turnsSinceHit||0)+1);
  G.enemyUsedHardCCLastTurn=usedHardCCThisTurn;
  G.animLock=false;
  if(G.player.stats.hp<=0||G.enemy.stats.hp<=0){if(checkDeath())return;}
  afterEnemyTurn();
}

function afterEnemyTurn() {
  G._incomingAttackKind=null;
  tickPoisonDamageOnly('player');
  tickPoisonDamageOnly('enemy');
  tickPoisonDurationEndRound();
  tickBurningEndEnemyPhase();
  tickDelayedForTarget('enemy');
  if(G.player.stats.hp<=0||G.enemy.stats.hp<=0){if(checkDeath())return;}
  if(G.enemyStatus.frozen&&(G.enemyStatus.frozen.turns||0)>0){
    G.enemyStatus.frozen.turns--;
    if(G.enemyStatus.frozen.turns<=0){
      const fbs=G.enemyStatus.frozen.baseSpd;
      if(fbs!=null) G.enemy.stats.spd=Math.max(1,fbs);
      delete G.enemyStatus.frozen;
      delete G.enemyStatus.chilled;
      if(G.enemy?.name) logMsg(`${G.enemy.name} thaws — chill cleared.`,'system');
    }
  }
  if(G.playerStatus.frozen&&(G.playerStatus.frozen.turns||0)>0){
    G.playerStatus.frozen.turns--;
    if(G.playerStatus.frozen.turns<=0){
      delete G.playerStatus.frozen;
      delete G.playerStatus.chilled;
    }
  }
  tickStatuses('enemy', {skipGuarded:true});
  if(G.playerStatus.confused&&typeof G.playerStatus.confused==='object'){G.playerStatus.confused.turns--;if(G.playerStatus.confused.turns<=0)delete G.playerStatus.confused;}
  if(G.enemyStatus.confused&&typeof G.enemyStatus.confused==='object'){G.enemyStatus.confused.turns--;if(G.enemyStatus.confused.turns<=0)delete G.enemyStatus.confused;}
  if(G.enemyStatus.enemyBlind>0){G.enemyStatus.enemyBlind--;if(G.enemyStatus.enemyBlind<=0)delete G.enemyStatus.enemyBlind;}
  if(G.enemyStatus.feared>0){G.enemyStatus.feared--;}
  if(G.enemyStatus.featherRuffle&&G.enemyStatus.featherRuffle.turns>0){
    G.enemyStatus.featherRuffle.turns--;
    if(G.enemyStatus.featherRuffle.turns<=0){
      if(G.enemyStatus.featherRuffle.accDrop>0)G.enemyStatus.accDebuff=Math.max(0,(G.enemyStatus.accDebuff||0)-G.enemyStatus.featherRuffle.accDrop);
      delete G.enemyStatus.featherRuffle;
    }
  }
  if(G.enemyStatus.wingClip&&G.enemyStatus.wingClip.turns>0){
    G.enemyStatus.wingClip.turns--;
    if(G.enemyStatus.wingClip.turns<=0){G.enemy.stats.spd+=G.enemyStatus.wingClip.spdRedux;delete G.enemyStatus.wingClip;}
  }
  if(G.enemyStatus.sonicSkip&&G.enemyStatus.sonicSkip.turns>0){
    G.enemyStatus.sonicSkip.turns--;
    if(G.enemyStatus.sonicSkip.turns<=0)delete G.enemyStatus.sonicSkip;
  }
  // Emperor Penguin Waddle Lullaby tick
  if(G.enemyStatus.waddleLullaby){
    G.enemyStatus.waddleLullaby.turns--;
    if(G.enemyStatus.waddleLullaby.turns<=0)delete G.enemyStatus.waddleLullaby;
  }
  if(G.enemyStatus.exposedGuard){
    G.enemyStatus.exposedGuard.turns--;
    if(G.enemyStatus.exposedGuard.turns<=0) delete G.enemyStatus.exposedGuard;
  }
  if(G.enemyStatus.bruiserAccMark){
    G.enemyStatus.bruiserAccMark.turns--;
    if(G.enemyStatus.bruiserAccMark.turns<=0){
      const a=G.enemyStatus.bruiserAccMark.amt||0;
      if(a) G.enemyStatus.accDebuff=Math.max(0,(G.enemyStatus.accDebuff||0)-a);
      delete G.enemyStatus.bruiserAccMark;
    }
  }
  if(G.enemyStatus.peregrineDefBreak){
    G.enemyStatus.peregrineDefBreak.turns--;
    if(G.enemyStatus.peregrineDefBreak.turns<=0){
      const lost=G.enemyStatus.peregrineDefBreak.defLost||0;
      if(lost) G.enemy.stats.def=(G.enemy.stats.def||0)+lost;
      delete G.enemyStatus.peregrineDefBreak;
    }
  }
  if(G.enemyStatus.owlArmorStress){
    G.enemyStatus.owlArmorStress.turns--;
    if(G.enemyStatus.owlArmorStress.turns<=0){
      const lost=G.enemyStatus.owlArmorStress.defLost||0;
      if(lost) G.enemy.stats.def=(G.enemy.stats.def||0)+lost;
      delete G.enemyStatus.owlArmorStress;
    }
  }
  // Cooldowns
  if(G.swoopCooldown>0)G.swoopCooldown--;
  if(G.hummingbirdDashCooldown>0)G.hummingbirdDashCooldown--;
  if(G.peregrineDiveCooldown>0)G.peregrineDiveCooldown--;
  if(G.snowyOwlDiveCooldown>0)G.snowyOwlDiveCooldown--;
  if(G.robinDartCooldown>0)G.robinDartCooldown--;
  if(G.bowerbirdLureCooldown>0)G.bowerbirdLureCooldown--;
  if(G.intimidateCooldown>0)G.intimidateCooldown--;
  if(G.crowDefendCooldown>0)G.crowDefendCooldown--;
  if(G.abilityCooldowns){Object.keys(G.abilityCooldowns).forEach(k=>{G.abilityCooldowns[k]=Math.max(0,(G.abilityCooldowns[k]||0)-1); if(G.abilityCooldowns[k]===0) delete G.abilityCooldowns[k];});}
  tickTimedBuffsAfterEnemyPhase();
  if(typeof Avian?.dispatcher?.onAfterEnemyTurn==='function') Avian.dispatcher.onAfterEnemyTurn(G.player);
  if(typeof Avian?.passives?.onAfterEnemyTurn==='function') Avian.passives.onAfterEnemyTurn(G.player);
  G.turn='player';
  G.turnPhase=TURN.PLAYER;
  G.phase='PLAYER';
  G.animLock=false;
  lockActionUI(false);
  startPlayerTurn(G.player);
  G.enemyNextAction=planEnemyAction();
  refreshBattleUI();
}


function showBattleCaption(text='Bird Slain', duration=520){
  const el=document.getElementById('battle-caption');
  if(!el) return;
  el.textContent=text;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),duration);
}

// ============================================================
//  DEATH & POST-COMBAT
// ============================================================
function checkDeath() {
  if(G.battleOver&&(G.enemy.stats.hp<=0||G.player.stats.hp<=0))return true;
  if(G.enemy.stats.hp<=0){
    G._lastDeathCause = 'enemy_defeated';
    G.battleOver=true;
    if(G.enemy.isBoss){
      G.bossKills++;
      logMsg(`💀 Boss kill #${G.bossKills}! Future enemies grow stronger.`,'boss');
      const _bossBd=BIRDS[G.player.birdKey];
      if(_bossBd&&_bossBd.passive&&_bossBd.passive.onBossKill) _bossBd.passive.onBossKill(G.player);
    }
    logMsg(`✨ ${G.enemy.name} defeated!`,'crit');
    if(isDukeStoryBossFight()) beginDukeBattleBgmFadeOut();
    setTimeout(postCombat,700);return true;
  }
  if(G.player.stats.hp<=0){
    G._lastDeathCause = 'player_hp_zero';
    G.battleOver=true;
    logMsg(`💀 ${G.player.name} has fallen...`,'enemy-action');
    setTimeout(showDefeat,700);
    return true;
  }
  return false;
}


function isGreyShopStage(stage){
  const s = Math.max(1, Math.floor(Number(stage) || 0));
  const endlessBattle = getEndlessEffectiveBattleNumber(s);
  if (G.endlessMode && endlessBattle > 0) {
    return endlessBattle % ENDLESS_SHOP_CADENCE === 0;
  }
  const storyBoss = s === STORY_MILESTONE_BOSS_STAGE || s === STORY_DUKE_STAGE;
  return (s % 4 === 0) && !storyBoss;
}

function isShopDueAfterBattle({ stage, endlessMode, endlessBattle, lastEnemyWasBoss } = {}){
  if(endlessMode){
    const eb = Math.max(0, Math.floor(Number(endlessBattle) || 0));
    return eb > 0 && eb % ENDLESS_SHOP_CADENCE === 0;
  }
  return !!lastEnemyWasBoss || isGreyShopStage(stage);
}


function getBattleStatsSafe(){
  // BS is used for reward bonuses; if it's missing, default safely
  const b = (typeof BS !== 'undefined' && BS) ? BS : null;
  return {
    turns: (b && Number.isFinite(b.turns)) ? b.turns : 999,
    dmgTaken: (b && Number.isFinite(b.dmgTaken)) ? b.dmgTaken : 999,
  };
}

function postCombat() {
  try {
    restoreBattleTempPlayerStats();
    // Hard reset any combat locks so UI can't get stuck
    G.animLock = false;
    G.turn = 'post';
    if (typeof lockActionUI === 'function') lockActionUI(true);

    if (G._groveAmbushActive) {
      G._groveAmbushActive = false;
      const expGain = computeNormalEnemyExpGain(G.enemy);
      G.player.exp += expGain;
      spawnFloat('player', `+${expGain} EXP`, 'fn-exp');
      logMsg(`+${expGain} EXP!`, 'exp-gain');
      SFX.exp();
      applyPostBattleHealIfDue();
      saveRun();
      G.phase = 'PLAYER';
      if (typeof lockActionUI === 'function') lockActionUI(false);
      setTimeout(() => resumeAfterGrove(), 250);
      return;
    }

    const bs = getBattleStatsSafe();

    // EXP — enemy level + threat tier + relative level (normal); boss = 65% level-up threshold (+ small bonus if boss above player level)
    let expGain;
    G.phase='REWARD';
    if (G.enemy.isBoss) {
      expGain = computeBossExpGain(G.enemy);
    } else {
      expGain = computeNormalEnemyExpGain(G.enemy);
    }

    G.player.exp += expGain;
    spawnFloat('player', `+${expGain} EXP`, 'fn-exp');
    logMsg(`+${expGain} EXP!`, 'exp-gain');
    SFX.exp();

    applyPostBattleHealIfDue();

    if(!Array.isArray(G._defeatedEncounterBirds)) G._defeatedEncounterBirds=[];
    G._defeatedEncounterBirds.push({
      level:getEnemyPreviewLevel(G.enemy),
      birdKey:G.enemy?.birdKey||G.enemy?.portraitKey||'',
      isBoss:!!G.enemy?.isBoss,
    });

    if(isEndlessRunActive() && G.enemy?.isBoss){
      if(G.player?.relBattleCarcass){
        G.player.stats.hp=Math.min(G.player.stats.maxHp, G.player.stats.hp+4);
        spawnFloat('player','+4 🩹','fn-heal');
      }
      if(G.player?.relPredatorsArchive){
        G.player.stats.atk+=1;
        G.player.stats.matk=(G.player.stats.matk||0)+1;
      }
      if(G.player?.relCrownLongHunt){
        const picks=['atk','matk','def','mdef','maxHp'];
        const k=picks[Math.floor(Math.random()*picks.length)];
        if(k==='maxHp'){ G.player.stats.maxHp+=5; G.player.stats.hp=Math.min(G.player.stats.maxHp,G.player.stats.hp+5); }
        else G.player.stats[k]=(G.player.stats[k]||0)+1;
        logMsg(`👑 Crown of the Long Hunt grants +1 ${k.toUpperCase()==='MAXHP'?'MAX HP':k.toUpperCase()}.`,'system');
      }
    }

    // Shiny reward — tuned so ~4–8 normal kills afford a white-tier shop item (36 shinies)
    const isStoryMode=(G.ui?.gameMode||'story')==='story';
    const stage=Math.max(1,getEncounterStage());
    const endlessBattle=Math.max(0,G.endlessBattle||0);
    let shinyGain=0;
    if(G.enemy.isBoss){
      if(isStoryMode){
        if(stage>=20) shinyGain=roll(SHINY_BOSS_STORY.late[0], SHINY_BOSS_STORY.late[1]);
        else if(stage>=10) shinyGain=roll(SHINY_BOSS_STORY.mid[0], SHINY_BOSS_STORY.mid[1]);
        else shinyGain=roll(SHINY_BOSS_STORY.early[0], SHINY_BOSS_STORY.early[1]);
      } else {
        shinyGain=roll(SHINY_BOSS_ENDLESS[0], SHINY_BOSS_ENDLESS[1]);
      }
    } else {
      if(isStoryMode){
        if(stage>=20) shinyGain=roll(SHINY_NORMAL_STORY.late[0], SHINY_NORMAL_STORY.late[1]);
        else if(stage>=10) shinyGain=roll(SHINY_NORMAL_STORY.mid[0], SHINY_NORMAL_STORY.mid[1]);
        else shinyGain=roll(SHINY_NORMAL_STORY.early[0], SHINY_NORMAL_STORY.early[1]);
      } else {
        const infl=Math.min(SHINY_ENDLESS_INFLATION_CAP, Math.floor(endlessBattle/10));
        shinyGain=roll(SHINY_NORMAL_ENDLESS[0], SHINY_NORMAL_ENDLESS[1]) + infl;
      }
    }

    // SAFE: bs defaults prevent crashes
    const perfectBonus = (bs.dmgTaken <= 0) ? SHINY_BONUS_PERFECT : 0;
    const fastWinBonus = (bs.turns <= 3) ? SHINY_BONUS_FAST : 0;

    if(G.player?.moltingRitual){
      G.player.stats.atk += 1;
      G.player.stats.maxHp = Math.max(1, (G.player.stats.maxHp||1) - 3);
      G.player.stats.hp = Math.min(G.player.stats.hp, G.player.stats.maxHp);
      logMsg('🔥 Molting Ritual: +1 ATK, -3 Max HP.', 'system');
    }
    const magpieBonus = (G.player?.birdKey==='magpie') ? SHINY_BONUS_MAGPIE : 0;
    shinyGain += perfectBonus + fastWinBonus + magpieBonus;
    G.shinyObjects += shinyGain;
    if(_isOverworldRun()) G._owSequenceShiny = (G._owSequenceShiny||0) + shinyGain;

    const bonusParts = [];
    if (perfectBonus > 0) bonusParts.push(`perfect +${SHINY_BONUS_PERFECT}`);
    if (fastWinBonus > 0) bonusParts.push(`fast +${SHINY_BONUS_FAST}`);
    if (magpieBonus > 0) bonusParts.push(`shiny collector +${SHINY_BONUS_MAGPIE}`);
    const bonusTxt = bonusParts.length ? ` (${bonusParts.join(', ')})` : '';
    logMsg(`✨ +${shinyGain} Shiny Object${shinyGain > 1 ? 's' : ''}${bonusTxt}! (Total: ${G.shinyObjects})`, 'exp-gain');

    if (G.player && Math.random() < 0.01) {
      G.player.mutatedFeatherCount = (G.player.mutatedFeatherCount || 0) + 1;
      logMsg('🪶 Mutated Feather found!', 'exp-gain');
    }

    // Level up check
    let leveled = false;
    let levelUpsGained = 0;
    while (G.player.exp >= expForLevel(G.player.birdLevel + 1)) {
      G.player.exp -= expForLevel(G.player.birdLevel + 1);
      G.player.birdLevel++;
      checkGrowthStage(G.player);

      // Level-up heal: 50% of currently missing HP
      const missingHp = Math.max(0, G.player.stats.maxHp - G.player.stats.hp);
      const lvHeal = Math.max(1, Math.floor(missingHp * 0.50));
      G.player.stats.hp = Math.min(G.player.stats.hp + lvHeal, G.player.stats.maxHp);

      leveled = true;
      levelUpsGained++;
      logMsg(`🌟 LEVEL UP! Now Lv.${G.player.birdLevel}! Healed ${lvHeal} HP.`, 'exp-gain');
      SFX.levelUp();
    }
    G._pendingLevelUpChoices = (G._pendingLevelUpChoices||0) + levelUpsGained;

    handleBossClearUnlocks();
    checkRunUnlocks();
    saveRun();

    if (hasMultiEnemyChainPending()) {
      accumulateStageBattleStats();
      if (leveled) G._deferredStageLevelUp = true;
      continueToNextEncounterBird();
      return;
    }

    accumulateStageBattleStats();
    const showLevelUp = leveled || !!G._deferredStageLevelUp;
    if (G._deferredStageLevelUp) G._deferredStageLevelUp = false;

    // Transition (stage complete or single-enemy fight)
    G.phase='REWARD';
    setTimeout(() => {
      if (typeof lockActionUI === 'function') lockActionUI(false);
      G.animLock = false;
      showRewardScreen(showLevelUp);
    }, 250);

  } catch (err) {
    console.error('postCombat crash prevented:', err);

    // Emergency fallback: never freeze
    G.animLock = false;
    if (typeof lockActionUI === 'function') lockActionUI(false);

    // Try to at least show reward screen
    try { showRewardScreen(false); }
    catch (e) { console.error('fallback reward screen failed:', e); }
  }
}

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

function applySingleReward(rw) {
  if (!rw || rw.id === '_reward_skip') return;
  if (rw.type === 'mutation') {
    const itemId = rw.mutationItemId || rw.id;
    if (typeof Avian?.mutations?.addToInventory === 'function') Avian.mutations.addToInventory(G.player, itemId);
    if (typeof Avian?.mutations?.equipAuto === 'function') Avian.mutations.equipAuto(G.player, itemId);
    if (typeof Avian?.mutations?.reapplyPlayerStatsFromSources === 'function') Avian.mutations.reapplyPlayerStatsFromSources(G.player);
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
        advanceStage();
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
  else if (_isOverworldRun()) continueStageTransitionAfterRewards();
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

function buildNestRewardCardHtml(drop, animDelayMs=0){
  const tierCss=normalizeRewardTier(drop.tier||'white');
  const tierMeta=rewardTierMeta(drop.tier);
  const desc=drop.type==='mutation'
    ?(getMutationDescHtml(drop.mutationItemId||drop.id,{compact:true})||escapeHtmlRoster(drop.desc||''))
    :escapeHtmlRoster(drop.desc||'');
  const style=animDelayMs>0?` style="animation-delay:${animDelayMs}ms"`:'';
  return `<div class="nest-reward-card tier-${tierCss}"${style}>
    <div class="reward-tier-label">${tierMeta.label}</div>
    <span class="reward-icon">${drop.icon||'🎁'}</span>
    <div class="reward-name">${escapeHtmlRoster(drop.name||'Reward')}</div>
    <div class="reward-desc">${desc}</div>
  </div>`;
}

function renderNestRewardCollectedTray(){
  const tray=document.getElementById('nest-reward-tray');
  if(!tray) return;
  const collected=G._nestRewardsCollected||[];
  tray.innerHTML=collected.map((drop,i)=>buildNestRewardCardHtml(drop, i*110)).join('');
  collected.forEach((drop, i)=>{
    if(drop.type!=='mutation') return;
    const mutId=drop.mutationItemId||drop.id;
    const card=tray.children[i];
    if(mutId&&card&&typeof bindRichTooltip==='function'){
      bindRichTooltip(card, ()=>buildMutationTooltipHTML(mutId), {category:'mutations'});
    }
  });
}

function finishNestRewardReveal(){
  const hint=document.getElementById('nest-shake-hint');
  if(hint) hint.textContent='Rewards collected!';
  const footnote=document.getElementById('nest-reward-footnote');
  if(footnote) footnote.style.display='block';
  const nest=document.getElementById('reward-nest');
  if(nest){
    nest.classList.remove('nest-shakeable');
    nest.onclick=null;
  }
  const confirmBtn=document.getElementById('reward-confirm-btn');
  if(confirmBtn){
    confirmBtn.textContent='Continue →';
    confirmBtn.className='confirm-btn visible';
  }
  G._rewardsAlreadyGranted=true;
  G._nestShaken=true;
}

function revealAllNestDrops(){
  const drops=G._nestRewardDrops||[];
  if(!drops.length){
    finishNestRewardReveal();
    return;
  }
  if(!G._nestRewardsCollected) G._nestRewardsCollected=[];
  const start=G._nestRewardDropIndex||0;
  for(let i=start;i<drops.length;i++){
    const drop=drops[i];
    if(typeof grantNestDrop==='function') grantNestDrop(drop);
    G._nestRewardsCollected.push(drop);
  }
  G._nestRewardDropIndex=drops.length;
  renderNestRewardCollectedTray();
  finishNestRewardReveal();
}

function handleNestShake(){
  const nest=document.getElementById('reward-nest');
  if(!nest||!nest.classList.contains('nest-shakeable')||G._nestShaken) return;
  nest.classList.remove('nest-shaking');
  void nest.offsetWidth;
  nest.classList.add('nest-shaking');
  setTimeout(()=>{
    nest.classList.remove('nest-shaking');
    revealAllNestDrops();
  },480);
}
globalThis.handleNestShake=handleNestShake;

function showRewardScreen(hasLevelUp) {
  G.animLock=false;
  if(typeof lockActionUI==='function') lockActionUI(false);
  showScreen('screen-reward');
  G._rewardScreenMode='nest';
  G._pendingLevelUp=hasLevelUp;
  G._pendingReward=null;
  G._pendingRewardQueue=null;
  G._pendingEndlessMutationPick=null;
  G._rewardsAlreadyGranted=false;
  G._nestRewardDropIndex=0;
  G._nestRewardsCollected=[];
  G._nestShaken=false;

  const defeated=typeof getDefeatedBirdsForReward==='function'?getDefeatedBirdsForReward():[];
  const isBoss=defeated.some(b=>b.isBoss)||!!G.enemy?.isBoss;
  const useEndlessRewards=G.endlessMode&&getEncounterStage()>20;
  const drops=useEndlessRewards&&typeof buildEndlessClearRewardDrops==='function'
    ? buildEndlessClearRewardDrops(defeated,{difficulty:G.difficulty,stage:getEncounterStage(),isBoss})
    :(typeof buildNestRewardDrops==='function'
      ? buildNestRewardDrops(defeated,{difficulty:G.difficulty,stage:getEncounterStage(),isBoss})
      : []);

  G._nestRewardDrops=drops;
  G._defeatedEncounterBirds=[];

  document.getElementById('reward-title').textContent=isBoss?'👑 Boss Defeated!':'✦ Victory! ✦';
  const dropCount=drops.length;
  document.getElementById('reward-sub').textContent=dropCount>1
    ?`Tap the nest once — ${dropCount} rewards will fall out!`
    :(dropCount===1?'Tap the nest once for your reward!':'No nest rewards — continue onward.');

  const footnote=document.getElementById('nest-reward-footnote');
  if(footnote) footnote.style.display='none';
  renderNestRewardCollectedTray();
  renderBattleSummary();

  const nest=document.getElementById('reward-nest');
  const confirmBtn=document.getElementById('reward-confirm-btn');
  confirmBtn.textContent='Continue →';
  confirmBtn.className='confirm-btn';

  if(!dropCount){
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

// ============================================================
//  LEVEL-UP SCREEN — select then confirm
// ============================================================
let _luSelectedStatChoiceId=null;
const LEVELUP_STAT_POOL = [
  {id:'vit4', label:'+4 Max HP', stat:'maxHp', amount:4, apply(){ G.player.stats.maxHp=(G.player.stats.maxHp||1)+4; G.player.stats.hp=Math.min((G.player.stats.hp||1)+4,G.player.stats.maxHp||1); }},
  {id:'atk2', label:'+2 ATK', stat:'atk', amount:2, apply(){ G.player.stats.atk=(G.player.stats.atk||0)+2; }},
  {id:'matk2', label:'+2 MATK', stat:'matk', amount:2, apply(){ G.player.stats.matk=(G.player.stats.matk||0)+2; }},
  {id:'def2', label:'+2 DEF', stat:'def', amount:2, apply(){ G.player.stats.def=(G.player.stats.def||0)+2; }},
  {id:'mdef2', label:'+2 MDEF', stat:'mdef', amount:2, apply(){ G.player.stats.mdef=(G.player.stats.mdef||0)+2; }},
  {id:'spd2', label:'+2 SPD', stat:'spd', amount:2, apply(){ G.player.stats.spd=(G.player.stats.spd||0)+2; }},
  {id:'dod2', label:'+2 Dodge', stat:'dodge', amount:2, apply(){ G.player.stats.dodge=Math.min(95,(G.player.stats.dodge||0)+2); }},
];
const LEVELUP_FEATHER_POOL = LEVELUP_STAT_POOL;
const ENDLESS_RARE_LEVELUP_CHOICES = [
  {id:'vit8', label:'+8 Max HP (rare)', stat:'maxHp', amount:8, apply(){ G.player.stats.maxHp=(G.player.stats.maxHp||1)+8; G.player.stats.hp=Math.min((G.player.stats.hp||1)+8,G.player.stats.maxHp||1); }},
  {id:'atk4r', label:'+4 ATK (rare)', stat:'atk', amount:4, apply(){ G.player.stats.atk=(G.player.stats.atk||0)+4; }},
  {id:'spd4r', label:'+4 SPD (rare)', stat:'spd', amount:4, apply(){ G.player.stats.spd=(G.player.stats.spd||0)+4; }},
];

function isMainAttackAbility(ab, ownerPlayer=null){
  if(!ab) return false;
  if(ab.isMainAttack) return true;
  const t = ABILITY_TEMPLATES?.[ab.id];
  if(t?.isMainAttack) return true;
  if(ab.slot==='main') return true;
  const owner = ownerPlayer ?? G?.player;
  if(ab.id===owner?.mainAttackId) return true;
  return false;
}

function getMainAttackAutoLevel(birdLevel){
  if(birdLevel>=10) return 4;
  if(birdLevel>=7) return 3;
  if(birdLevel>=4) return 2;
  return 1;
}

function applyMainAttackAutoLevel(){
  if(!G.player||!Array.isArray(G.player.abilities)) return;

  const main=
    G.player.abilities.find(a=>isMainAttackAbility(a))||
    G.player.abilities.find(a=>a.id==='mainAttack');

  if(!main) return;

  const newLv=getMainAttackAutoLevel(G.player.birdLevel||1);

  if((main.level||1)!==newLv){
    main.level=newLv;

    if(typeof deriveAilments==='function'){
      main.ailmentIds=deriveAilments(main.id,newLv);
    }

    if(typeof logMsg==='function'){
      logMsg(`⚔ ${main.name} auto-upgraded to Lv.${newLv}!`,'exp-gain');
    }
  }
}

function rollLuFeatherPanelOptions(){
  const pool=LEVELUP_FEATHER_POOL.map(x=>({...x}));
  if(isEndlessRunActive() && chance(18)){
    const rare=ENDLESS_RARE_LEVELUP_CHOICES[Math.floor(Math.random()*ENDLESS_RARE_LEVELUP_CHOICES.length)];
    pool.push({...rare, id:`${rare.id}_rare`});
  }
  return pool;
}

function luFeatherDraftTotal(){
  const d=G._luFeatherDraft||{};
  return Object.values(d).reduce((a,n)=>a+Math.max(0,Math.floor(Number(n)||0)),0);
}
function luFeathersUnallocated(){
  return Math.max(0,(G._pendingLevelUpChoices||0)-luFeatherDraftTotal());
}

function refreshLuFeatherPanelUI(){
  const rem=document.getElementById('lu-feather-remaining');
  if(rem) rem.innerHTML=`Remaining Feathers: <strong>${luFeathersUnallocated()}</strong>`;
  const opts=G._luFeatherPanelOptions;
  if(Array.isArray(opts)){
    for(const opt of opts){
      const el=document.getElementById(`lu-fc-${opt.id}`);
      if(el) el.textContent=String((G._luFeatherDraft||{})[opt.id]||0);
      const n=Math.max(0,Math.floor(Number((G._luFeatherDraft||{})[opt.id])||0));
      const minus=document.getElementById(`lu-fp-minus-${opt.id}`);
      const plus=document.getElementById(`lu-fp-plus-${opt.id}`);
      if(minus) minus.disabled=n<=0;
      if(plus) plus.disabled=luFeathersUnallocated()<=0;
    }
  }
  const btn=document.getElementById('lu-skill-confirm');
  if(btn){
    const ok=luFeathersUnallocated()===0 && luFeatherDraftTotal()>0;
    btn.className=ok?'confirm-btn visible':'confirm-btn';
    btn.disabled=!ok;
  }
}

function buildFeatherStatPanel(){
  const grid=document.getElementById('lu-skill-grid');
  if(!grid) return;
  grid.innerHTML='';
  grid.classList.add('lu-feather-grid');
  G._luFeatherPanelOptions=rollLuFeatherPanelOptions();
  G._luFeatherDraft=G._luFeatherDraft||{};
  for(const opt of G._luFeatherPanelOptions){
    const row=document.createElement('div');
    row.className='lu-feather-row';
    row.innerHTML=`
      <div class="lu-feather-info">
        <span class="lu-feather-name">${opt.label}</span>
        <span class="lu-feather-desc">${getLevelUpStatEffectDesc(opt)}</span>
      </div>
      <div class="lu-feather-stepper">
        <button type="button" class="lu-feather-btn lu-feather-minus" id="lu-fp-minus-${opt.id}">−</button>
        <span class="lu-feather-count" id="lu-fc-${opt.id}">0</span>
        <button type="button" class="lu-feather-btn lu-feather-plus" id="lu-fp-plus-${opt.id}">+</button>
      </div>`;
    row.querySelector(`#lu-fp-minus-${opt.id}`).onclick=()=>{
      const cur=Math.max(0,Math.floor(Number((G._luFeatherDraft||{})[opt.id])||0));
      if(cur<=0) return;
      G._luFeatherDraft[opt.id]=cur-1;
      refreshLuFeatherPanelUI();
    };
    row.querySelector(`#lu-fp-plus-${opt.id}`).onclick=()=>{
      if(luFeathersUnallocated()<=0) return;
      const cur=Math.max(0,Math.floor(Number((G._luFeatherDraft||{})[opt.id])||0));
      G._luFeatherDraft[opt.id]=cur+1;
      refreshLuFeatherPanelUI();
    };
    grid.appendChild(row);
  }
  refreshLuFeatherPanelUI();
}

function getLevelUpStatEffectDesc(opt){
  if(opt.stat==='goldCritMult') return `Increase crit damage multiplier by ${opt.amount}.`;
  if(opt.stat==='dodge') return `Increase dodge by ${opt.amount}%.`;
  if(opt.stat==='critChance') return `Increase crit chance by ${opt.amount}%.`;
  return `Improve ${String(opt.stat).toUpperCase()} by ${opt.amount}.`;
}

function ensureMainAttackAndLoadoutRules(){
  if(!G.player) return;
  const bd=BIRDS[G.player.birdKey]||{};
  if(usesFamilySkillEvolution(G.player)){
    syncPlayerAbilitiesFromSkillSlots(G.player);
    if(!Array.isArray(G.player.abilities)) G.player.abilities=[];
    G.player.abilities=G.player.abilities.filter(ab=>ab&&ab.id&&ab.id!=='skipTurn'&&ab.id!=='sittingDuck');
    G.player.abilities=G.player.abilities.filter(ab=>ab.id!=='mainAttack');
    const bases=getBaseSkillSlotsForBird(G.player.birdKey);
    const preferred=bd.mainAttackId || bases[0]?.abilityId || G.player.abilities[0]?.id;
    if(preferred) G.player.mainAttackId=preferred;
    G.player.abilities.forEach(ab=>{ ab.isMainAttack=(ab.id===preferred); });
    removeMimicEverywhere();
    normalizeAbilityCooldownsForPlayer(G.player);
    enforceAbilityCosts(G.player);
    return;
  }
  const birdClass=bd.class||'';
  const isMagic=MAGIC_CLASSES.has(birdClass);
  if(!Array.isArray(G.player.abilities)) G.player.abilities=[];
  G.player.abilities=G.player.abilities.filter(ab=>ab&&ab.id&&ab.id!=='skipTurn'&&ab.id!=='sittingDuck');
  if(!isMagic){
    // Migration cleanup: non-magic birds should not keep legacy generic Peck/mainAttack card.
    G.player.abilities=G.player.abilities.filter(ab=>ab.id!=='mainAttack');
  }
  G.player.abilities.forEach(ab=>delete ab.isMainAttack);

  let mainAb=null;
  if(isMagic){
    const isBlackbird = (G.player?.birdKey==='blackbird');
    if(isBlackbird){
      G.player.mainAttackId='shadow_peck';
      mainAb=G.player.abilities.find(a=>a.id==='shadow_peck') || null;
      G.player.abilities=G.player.abilities.filter(a=>a.id!=='mainAttack');
      if(!mainAb){
        mainAb={...(ABILITY_TEMPLATES.shadow_peck||{}), id:'shadow_peck', level:1};
        G.player.abilities.unshift(mainAb);
      }
    }else{
      if(bd.mainAttackId) G.player.mainAttackId=bd.mainAttackId;
      mainAb=G.player.abilities.find(a=>a.id==='mainAttack');
      if(!mainAb){
        mainAb={id:'mainAttack',name:'Peck',level:1,type:'physical',btnType:'physical'};
        G.player.abilities.unshift(mainAb);
      }
      mainAb.name='Peck';
    }
  } else {
    const preferred=bd.mainAttackId||(bd.startAbilities&&bd.startAbilities[0]);
    mainAb=G.player.abilities.find(a=>a.id===preferred)||G.player.abilities[0]||null;
  }
  if(mainAb) mainAb.isMainAttack=true;

  const cap=4;
  const nonMain=G.player.abilities.filter(a=>!isMainAttackAbility(a));
  if(nonMain.length>cap){
    const kept=nonMain.slice(0,cap);
    G.player.abilities=[...(mainAb?[mainAb]:[]),...kept];
  }

  removeMimicEverywhere();
  normalizeAbilityCooldownsForPlayer(G.player);
  enforceAbilityCosts(G.player);
}

function setLevelUpPanelTitle(text){
  const title = document.querySelector('.levelup-choice-title');
  if(title) title.textContent = text;
}
function configureLevelUpConfirm(label, handler, visible=false){
  const btn = document.getElementById('lu-skill-confirm');
  if(!btn) return;
  btn.textContent = label;
  btn.onclick = handler;
  btn.className = visible ? 'confirm-btn visible' : 'confirm-btn';
}
function configureLevelUpSecondary(label='', handler=null, visible=false){
  const btn = document.getElementById('lu-skip-btn');
  if(!btn) return;
  btn.textContent = label || '⟩ Exit Level Up';
  btn.onclick = handler || afterLevelUp;
  btn.style.display = visible ? '' : 'none';
}
function resetLevelUpFlowState(){
  delete G._skillEvolutionFlow;
  delete G._selectedSkillEvolutionCardId;
}
function updateSkillEvolutionSelection(card, selectedId){
  document.querySelectorAll('#lu-skill-grid .skill-upgrade-card').forEach(x=>x.classList.remove('selected'));
  if(card) card.classList.add('selected');
  G._selectedSkillEvolutionCardId = selectedId;
}
function getSkillEvolutionSelection(){
  return G._selectedSkillEvolutionCardId || null;
}
function renderSkillEvolutionSlotSelection(){
  showScreen('screen-levelup');
  resetLevelUpFlowState();
  G._skillEvolutionFlow = {step:'slot'};
  const bd=BIRDS[G.player?.birdKey]||{};
  const grid=document.getElementById('lu-skill-grid');
  const preview=document.getElementById('lu-stat-preview');
  const featherRem=document.getElementById('lu-feather-remaining');
  if(featherRem) featherRem.innerHTML='';
  if(preview) preview.innerHTML='';
  setLevelUpPanelTitle('🧬 Choose a Skill to Evolve');
  document.getElementById('lu-sub').textContent=`Lv.${G.player.birdLevel} milestone reached — choose 1 equipped skill to evolve (${Math.max(1,G._pendingSkillEvolutionChoices||1)} remaining) · ${bd.name || G.player.birdKey}.`;
  configureLevelUpConfirm('✓ Inspect Evolution', confirmSkillEvolutionChoice, false);
  configureLevelUpSecondary('', null, false);
  grid.innerHTML='';
  grid.classList.remove('lu-feather-grid');
  getSkillSlots(G.player).slice().sort((a,b)=>a.slotIndex-b.slotIndex).forEach(slot=>{
    if(!slot?.abilityId) return;
    const tmpl = ABILITY_TEMPLATES?.[slot.abilityId] || {};
    const family = getSkillSlotFamilyDef(slot, G.player?.birdKey);
    const action = resolveSkillSlotEvolutionAction(slot, G.player);
    const card=document.createElement('div');
    card.className='skill-upgrade-card';
    card.innerHTML=`<div class="su-name">${tmpl.name || slot.abilityId}</div><div class="su-lv">${family?.displayName||slot.familyId||'Family'} · Tier ${slot.tier||0}${slot.pathId?` · ${slot.pathId.replace(/_/g,' ')}`:''}</div><div class="su-effect">${(tmpl.levels?.[0]?.desc||tmpl.desc||'No description')}<br><span style="color:var(--gold-light)">${action==='choose_path'?'Choose a branch path.':action==='tier_up'?'Preview the next tier in this path.':'Fully evolved — no further upgrades.'}</span></div>`;
    if(action==='none'){
      card.style.opacity='.55';
      card.style.cursor='default';
    }else{
      card.onclick=()=>{ updateSkillEvolutionSelection(card, String(slot.slotIndex)); configureLevelUpConfirm('✓ Inspect Evolution', confirmSkillEvolutionChoice, true); };
    }
    grid.appendChild(card);
  });
}
function renderSkillEvolutionPathSelection(slot){
  const grid=document.getElementById('lu-skill-grid');
  const preview=document.getElementById('lu-stat-preview');
  if(preview) preview.innerHTML='';
  const family = getSkillSlotFamilyDef(slot, G.player?.birdKey);
  const currentTmpl = ABILITY_TEMPLATES?.[slot.abilityId] || {};
  G._skillEvolutionFlow = {step:'path', slotIndex:slot.slotIndex};
  setLevelUpPanelTitle(`🧬 ${family?.displayName||'Skill Evolution'}`);
  document.getElementById('lu-sub').textContent=`Choose 1 of 3 tier-1 branches for ${currentTmpl.name || family?.displayName || 'this skill'}.`;
  configureLevelUpConfirm('✓ Evolve Skill', confirmSkillEvolutionChoice, false);
  configureLevelUpSecondary(G._nestMutateFlow?'✕ Cancel':'⟨ Back', G._nestMutateFlow?cancelNestMutateFlow:renderSkillEvolutionSlotSelection, true);
  grid.innerHTML='';
  getSkillEvolutionPathOptions(slot, G.player?.birdKey).forEach(option=>{
    const tmpl = option.abilityTemplate || {};
    const card=document.createElement('div');
    card.className='skill-upgrade-card';
    card.innerHTML=`<div class="su-name">${option.displayName}</div><div class="su-lv">Tier 1 · ${tmpl.name || option.abilityId}</div><div class="su-effect">${tmpl.levels?.[0]?.desc || tmpl.desc || 'No description available.'}</div>`;
    card.onclick=()=>{ updateSkillEvolutionSelection(card, option.pathId); configureLevelUpConfirm('✓ Evolve Skill', confirmSkillEvolutionChoice, true); };
    grid.appendChild(card);
  });
}
function renderSkillEvolutionTierPreview(slot){
  const grid=document.getElementById('lu-skill-grid');
  const preview=document.getElementById('lu-stat-preview');
  if(preview) preview.innerHTML='';
  const nextTier = (slot.tier||0)+1;
  const path = getSkillSlotPathDef(slot, G.player?.birdKey);
  const nextId = path?.abilities?.[nextTier];
  const currentTmpl = ABILITY_TEMPLATES?.[slot.abilityId] || {};
  const nextTmpl = ABILITY_TEMPLATES?.[nextId] || {};
  G._skillEvolutionFlow = {step:'tier', slotIndex:slot.slotIndex};
  setLevelUpPanelTitle('🧬 Preview Tier Upgrade');
  document.getElementById('lu-sub').textContent=`${currentTmpl.name || slot.abilityId} will evolve into ${nextTmpl.name || nextId}.`;
  configureLevelUpConfirm('✓ Apply Tier Upgrade', confirmSkillEvolutionChoice, true);
  configureLevelUpSecondary(G._nestMutateFlow?'✕ Cancel':'⟨ Back', G._nestMutateFlow?cancelNestMutateFlow:renderSkillEvolutionSlotSelection, true);
  grid.innerHTML=`<div class="skill-upgrade-card selected"><div class="su-name">${currentTmpl.name || slot.abilityId} → ${nextTmpl.name || nextId}</div><div class="su-lv">Tier ${slot.tier||0} → Tier ${nextTier}</div><div class="su-effect">${nextTmpl.levels?.[0]?.desc || nextTmpl.desc || 'No description available.'}</div></div>`;
}
function renderSkillEvolutionMasterySelection(slot){
  const grid=document.getElementById('lu-skill-grid');
  const preview=document.getElementById('lu-stat-preview');
  if(preview) preview.innerHTML='';
  const tmpl = ABILITY_TEMPLATES?.[slot.abilityId] || {};
  G._skillEvolutionFlow = {step:'mastery', slotIndex:slot.slotIndex};
  setLevelUpPanelTitle('♾ Choose a Mastery');
  document.getElementById('lu-sub').textContent=`${tmpl.name || slot.abilityId} is fully evolved. Choose an Endless mastery.`;
  configureLevelUpConfirm('✓ Claim Mastery', confirmSkillEvolutionChoice, false);
  configureLevelUpSecondary('⟨ Back', renderSkillEvolutionSlotSelection, true);
  grid.innerHTML='';
  getSkillSlotMasteryOptions(slot, G.player).forEach(option=>{
    const card=document.createElement('div');
    card.className='skill-upgrade-card';
    card.innerHTML=`<div class="su-name">${option.name}</div><div class="su-lv">Mastery ${slot.masteryCount+1}</div><div class="su-effect">${option.desc}</div>`;
    card.onclick=()=>{ updateSkillEvolutionSelection(card, option.id); configureLevelUpConfirm('✓ Claim Mastery', confirmSkillEvolutionChoice, true); };
    grid.appendChild(card);
  });
}
function beginSkillEvolutionFlow(){
  if(!(G._pendingSkillEvolutionChoices>0) || !usesFamilySkillEvolution(G.player)) return false;
  const actionable = getSkillSlots(G.player).some(slot=>resolveSkillSlotEvolutionAction(slot, G.player)!=='none');
  if(!actionable){
    G._pendingSkillEvolutionChoices = 0;
    logMsg(`🧬 ${(BIRDS[G.player?.birdKey]?.name)||G.player?.birdKey||'Bird'} skill milestones reached, but every slot is fully evolved for this mode.`, 'system');
    return false;
  }
  renderSkillEvolutionSlotSelection();
  return true;
}
function finalizeSkillEvolutionChoice(message){
  syncPlayerAbilitiesFromSkillSlots(G.player);
  ensureMainAttackAndLoadoutRules();
  refreshPlayerAbilityAilments();
  (G.player.abilities||[]).forEach(a=>codexMark('abilities', a.id, 'seen'));
  saveRun();
  if(G._nestMutateFlow){
    if((G.player.mutatedFeatherCount||0)>0) G.player.mutatedFeatherCount--;
    closeNestMutateModal();
    G._nestMutateFlow=false;
    G._nestMutateSlotIndex=null;
    if(message) logMsg(message, 'exp-gain');
    if(typeof refreshBattleUI==='function') try{ refreshBattleUI(); }catch(_){}
    openNest();
    return;
  }
  resetLevelUpFlowState();
  if(message) logMsg(message, 'exp-gain');
}
function confirmSkillEvolutionChoice(){
  const flow = G._skillEvolutionFlow || {step:'slot'};
  if(flow.step==='slot'){
    const slotIndex = Number(getSkillEvolutionSelection());
    const slot = getSkillSlotByIndex(G.player, slotIndex);
    if(!slot){ logMsg('Choose a skill slot first.','miss'); return; }
    const action = resolveSkillSlotEvolutionAction(slot, G.player);
    if(action==='choose_path') return renderSkillEvolutionPathSelection(slot);
    if(action==='tier_up') return renderSkillEvolutionTierPreview(slot);
    logMsg('That slot has no evolution available right now.','miss');
    return;
  }
  const slot = getSkillSlotByIndex(G.player, flow.slotIndex);
  if(!slot){ logMsg('That skill slot could not be found.','miss'); return; }
  if(flow.step==='path'){
    const pathId = getSkillEvolutionSelection();
    if(!pathId){ logMsg('Choose a path first.','miss'); return; }
    const before = ABILITY_TEMPLATES?.[slot.abilityId]?.name || slot.abilityId;
    applySkillPathSelection(slot, pathId, G.player);
    const after = ABILITY_TEMPLATES?.[slot.abilityId]?.name || slot.abilityId;
    finalizeSkillEvolutionChoice(`🧬 ${before} committed to the ${pathId.replace(/_/g,' ')} path → ${after}.`);
    return;
  }
  if(flow.step==='tier'){
    const before = ABILITY_TEMPLATES?.[slot.abilityId]?.name || slot.abilityId;
    autoUpgradeSkillSlotTier(slot, G.player);
    const after = ABILITY_TEMPLATES?.[slot.abilityId]?.name || slot.abilityId;
    finalizeSkillEvolutionChoice(`🧬 ${before} evolved into ${after}!`);
    return;
  }
  if(flow.step==='mastery'){
    const masteryId = getSkillEvolutionSelection();
    if(!masteryId){ logMsg('Choose a mastery first.','miss'); return; }
    const pick = applySkillSlotMastery(slot, masteryId, G.player);
    if(!pick){ logMsg('That mastery is unavailable.','miss'); return; }
    finalizeSkillEvolutionChoice(`♾ ${getSkillSlotDisplayLabel(slot)} gained mastery: ${pick.name}.`);
  }
}

function showLevelUpScreen() {
  if(!(G._pendingLevelUpChoices>0)) return;
  showScreen('screen-levelup');
  resetLevelUpFlowState();
  _luSelectedStatChoiceId=null;
  G._luFeatherDraft={};
  delete G._luFeatherPanelOptions;
  const feathers=Math.max(1,G._pendingLevelUpChoices||1);
  document.getElementById('lu-sub').textContent=`Lv.${G.player.birdLevel} reached! You have ${feathers} Feather${feathers===1?'':'s'} — spend each one on the stats below, then confirm once.`;
  const now=G.player.stats||{};
  const pairs=[
    ['HP','maxHp','stat'],['ATK','atk','stat'],['DEF','def','stat'],['SPD','spd','stat'],
    ['MATK','matk','stat'],['MDEF','mdef','stat'],['ACC','acc','stat'],
    ['Dodge','dodge','stat'],['Max EN','energyMax','en'],
  ];
  const prevWrap=document.getElementById('lu-stat-preview');
  if(prevWrap){
    prevWrap.innerHTML=pairs.map(([label,key,kind])=>{
      let val;
      if(kind==='critMult') val=(G.player.goldCritMult||1.5).toFixed(2);
      else if(kind==='en') val=G.player.energyMax ?? computePlayerMaxEnergy();
      else val=now[key]??0;
      return `<div class="lu-stat-row"><strong>${label}</strong><span><span class="v-new">${val}</span></span></div>`;
    }).join('');
  }

  document.getElementById('lu-skills-panel').classList.add('active');
  setLevelUpPanelTitle('📈 Spend Feathers');
  configureLevelUpConfirm('✓ Confirm upgrades', confirmSkillUpgrade, false);
  configureLevelUpSecondary('⟩ Exit Level Up', onExitLevelUpRequested, true);
  buildFeatherStatPanel();
}

function showLUPanel(which) {
  document.getElementById('lu-skills-panel').classList.add('active');
  _luSelectedStatChoiceId=null;
  document.getElementById('lu-skill-confirm').className='confirm-btn';
  document.getElementById('lu-skip-btn').className='confirm-btn';
}

function countLevelAilments(lv){
  return [lv?.newAilment, lv?.newAilment2, lv?.newAilment3].filter(Boolean).length;
}
function ailmentSlotsForLevel(tmpl, level){
  const base=Math.max(0,countLevelAilments((tmpl?.levels||[])[0]||{}));
  return base + (level>=4 ? 1 : 0);
}
function deriveAbilityAilments(ab, tmpl){
  if(!tmpl) return [];
  const levels = Array.isArray(tmpl.levels) ? tmpl.levels : [];
  const contactAilments=['poison','paralyzed','burning','weaken'];
  const isContactOnly=tmpl.type==='spell'||tmpl.type==='utility';
  const ailIds=[];
  for(let i=0;i<(ab.level||1);i++){
    const d=levels[i]||{};
    [d.newAilment,d.newAilment2,d.newAilment3].forEach(a=>{
      if(!a) return;
      if(isContactOnly&&contactAilments.includes(a)) return;
      if(!ailIds.includes(a)) ailIds.push(a);
    });
  }
  const cap=ailmentSlotsForLevel(tmpl, ab.level||1);
  let out=ailIds.slice(0,cap);
  if((ab.level||1)>=4 && ab.modAilmentChoice && !out.includes(ab.modAilmentChoice) && out.length<cap){
    out.push(ab.modAilmentChoice);
  }
  return out.slice(0,cap);
}
function openAbilityModificationChoice(ab, tmpl){
  const pool=['poison','burning','weaken','paralyzed','feared','confused','slow','bleed'];
  const existing=new Set(deriveAbilityAilments({...ab,modAilmentChoice:null}, tmpl));
  const options=pool.filter(a=>!existing.has(a));
  options.sort(()=>Math.random()-0.5);
  const picks=options.slice(0,3);
  if(!picks.length) return Promise.resolve(null);
  const modal=document.getElementById('ability-mod-modal');
  const sub=document.getElementById('ability-mod-sub');
  const list=document.getElementById('ability-mod-options');
  if(!modal||!list) return Promise.resolve(picks[0]);
  if(sub) sub.textContent=`${ab.name} reached Lv.4 — choose 1 ailment to add.`;
  return new Promise(resolve=>{
    list.innerHTML='';
    picks.forEach(id=>{
      const btn=document.createElement('button');
      btn.className='abandon-confirm-btn';
      btn.style.width='100%';
      btn.textContent=id.charAt(0).toUpperCase()+id.slice(1);
      btn.onclick=()=>{ modal.classList.remove('open'); resolve(id); };
      list.appendChild(btn);
    });
    globalThis._abilityModCancelResolver=()=>resolve(null);
    modal.classList.add('open');
  });
}
function closeAbilityModModal(){
  const modal=document.getElementById('ability-mod-modal');
  if(modal) modal.classList.remove('open');
  if(typeof globalThis._abilityModCancelResolver==='function'){
    globalThis._abilityModCancelResolver();
    globalThis._abilityModCancelResolver=null;
  }
}
function refreshPlayerAbilityAilments(){
  (G.player?.abilities||[]).forEach(ab=>{
    const tmpl=ABILITY_TEMPLATES[ab.id];
    if(tmpl) ab.ailmentIds=deriveAbilityAilments(ab, tmpl);
  });
}

async function confirmSkillUpgrade() {
  const opts=G._luFeatherPanelOptions;
  if(Array.isArray(opts) && opts.length){
    if(luFeathersUnallocated()!==0){
      logMsg('Assign every Feather before confirming.','miss');
      return;
    }
    if(luFeatherDraftTotal()<=0){
      logMsg('Spend your Feathers on at least one stat.','miss');
      return;
    }
    const lines=[];
    for(const opt of opts){
      const n=Math.max(0,Math.floor(Number((G._luFeatherDraft||{})[opt.id])||0));
      for(let i=0;i<n;i++){
        const beforeFeather = G.player.stats ? {...G.player.stats} : {};
        opt.apply();
        const Lf = ensureStatLedger(G.player);
        if(Lf && G.player.stats) mergeStatDeltaIntoBucket(Lf.fromLevel, beforeFeather, G.player.stats);
      }
      if(n>0) lines.push(`${n}× ${opt.label}`);
    }
    if(G.player.stats) normalizeCombatStats(G.player.stats);
    if(typeof refreshBattleUI==='function') refreshBattleUI();
    logMsg(`📈 ${lines.join(', ')}`,'exp-gain');
    delete G._luFeatherDraft;
    delete G._luFeatherPanelOptions;
    G._pendingLevelUpChoices=0;
    G._levelUpStatChoices=[];
    _luSelectedStatChoiceId=null;
    const grid=document.getElementById('lu-skill-grid');
    if(grid){ grid.innerHTML=''; grid.classList.remove('lu-feather-grid'); }
    saveRun();
    afterLevelUp();
    return;
  }
  logMsg('Open the level-up screen to spend Feathers.','miss');
}

function onExitLevelUpRequested(){
  const pending = Math.max(0, Math.floor(Number(G._pendingLevelUpChoices)||0));
  const allocated = luFeatherDraftTotal();
  if(pending<=0){
    logMsg('No unspent Feathers to defer.','system');
    afterLevelUp();
    return;
  }
  logMsg(`🪶 Deferred ${pending} Feather${pending===1?'':'s'} (allocated preview: ${allocated}). Spend them later from the level-up panel.`, 'system');
  delete G._luFeatherDraft;
  delete G._luFeatherPanelOptions;
  _luSelectedStatChoiceId=null;
  const grid=document.getElementById('lu-skill-grid');
  if(grid){
    grid.innerHTML='';
    grid.classList.remove('lu-feather-grid');
  }
  const rem=document.getElementById('lu-feather-remaining');
  if(rem) rem.innerHTML='';
  saveRun();
  afterLevelUp();
}

function afterLevelUp() {
  // After level-up: go to Stork shop if it was a boss (non-overworld only), otherwise advance
  if(G._pendingStorkShop && !_isOverworldRun()){
    const m=G._pendingShopMode||'boss'; G._pendingStorkShop=false; G._pendingShopMode=null; showStorkShop(m);
  } else {
    G._pendingStorkShop=false; G._pendingShopMode=null;
    advanceStage();
  }
}

function advanceStage() {
  G.stage++;
  if(isEndlessRunActive()) applyEndlessProgressionMilestones();
  // Story run ends after final story stage (20 for default Blackstone map)
  if(!G.endlessMode && G.stage > getStoryMaxStage()){
    try { localStorage.removeItem(_OW_STATE_KEY); localStorage.removeItem(_OW_NAV_KEY); } catch(_) {}
    deleteSave();
    showVictory();
    return;
  }
  // Stage 40 = endless battle 20 — grant unlock
  if(G.endlessMode&&G.endlessBattle>=20&&!isUnlocked('stage40')){
    grantUnlock('stage40');
    logMsg('🔓 Legendary birds unlocked: Shoebill Stork & Harpy Eagle!','boss');
  }
  saveRun();
  continueStageTransitionAfterRewards();
}

// ============================================================
//  WHISPERING GROVE EVENT
// ============================================================
function isBossStage(stage){
  const s=Math.max(1,Math.floor(Number(stage)||0));
  return s===STORY_MILESTONE_BOSS_STAGE || s===STORY_DUKE_STAGE;
}

const GROVE_OUTCOME_POOL = Object.freeze(['egg','ambush','fruit','nest']);

function grantGroveNestMutation(){
  const rw=typeof Avian?.mutations?.rollMutationRewardFromDropWeights==='function'
    ? Avian.mutations.rollMutationRewardFromDropWeights({ stage: G.stage||1 })
    : null;
  if(!rw) return null;
  if(rw.type==='mutation'){
    const itemId=rw.mutationItemId||rw.id;
    if(typeof Avian?.mutations?.addToInventory==='function') Avian.mutations.addToInventory(G.player, itemId);
    codexMark('mutations', itemId, 'seen');
  } else if(typeof rw.apply==='function'){
    applyUpgradeWithMaxHpHealing(G.player, ()=>rw.apply(G.player), rw.name||'Grove Nest Reward', {id:rw.id, desc:rw.desc});
  }
  if(!G.collectedRewards) G.collectedRewards=[];
  G.collectedRewards.push({id:rw.id||rw.name,icon:rw.icon,tier:rw.tier,name:rw.name,desc:rw.desc});
  if(rw.type!=='mutation') codexMark('artifacts', rw.id||rw.name, 'seen');
  return rw;
}

function startGroveAmbushBattle(){
  G._groveAmbushActive=true;
  const encounterStage=getEncounterStage();
  let ed=pickRandomBirdEnemyDraftForStage(encounterStage, { isBoss: false });
  ed._mutationsApplied=false;
  mergeScaledStatsIntoEnemy(ed, encounterStage);
  G.enemy=ed;
  G.autoQueuedAbilityId=null;
  G._breakClampStreak=0;
  G.abilityCooldowns=G.abilityCooldowns||{};
  codexMark('enemies', G.enemy.id||G.enemy.name, 'seen');
  if(!G.enemy.aiType) G.enemy.aiType=mapAiStyleToType(G.enemy.aiStyle);
  if(!G.enemy.aiPersonality) G.enemy.aiPersonality=inferAIPersonalityFromStyle(G.enemy.aiStyle,G.enemy.name);
  enforceAbilityCosts(G.player);
  applyBiomeModifiers();
  resetForNewBattle();
  recomputeClassPerkEffects();
  if(G.player._bruiseAcc!==undefined) G.player._bruiseAcc=0;
  resetBattleStats();
  document.getElementById('player-panel')?.classList.remove('player-danger');
  document.getElementById('enemy-panel')?.classList.remove('boss-phase-two');
  const pb=document.getElementById('boss-phase-banner');if(pb){pb.textContent='';pb.classList.remove('visible');}
  preparePlayerCombatLoadout(G.player);
  const bd2=BIRDS[G.player.birdKey||'sparrow'];
  if(bd2&&bd2.passive&&bd2.passive.onBattleStart) bd2.passive.onBattleStart(G.player);
  if(typeof Avian?.passives?.onBattleStart==='function') Avian.passives.onBattleStart();
  captureBattleTempPlayerStats();
  normalizeBattleTurnState();
  G.battleOver=false;
  G.animLock=false;
  G.actionBusy=false;
  G.actionQueue=[];
  const pSpd=G.player.stats.spd, eSpd=G.enemy.stats.spd;
  G.turn = pSpd >= eSpd ? 'player' : 'enemy';
  G.turnPhase = G.turn==='player'?TURN.PLAYER:TURN.ENEMY;
  G.phase = G.turn==='player' ? 'PLAYER' : 'ENEMY';
  if(G.turn==='player') startPlayerTurn(G.player);
  G.enemyNextAction = planEnemyAction();
  showScreen('screen-battle');
  const _battleLogEl=document.getElementById('battle-log'); if(_battleLogEl) _battleLogEl.innerHTML='';
  updateBattleArena();
  initBattleLogDrawer();
  updateStageProgress();
  refreshBattleUI();
  logMsg(`🌳 Grove Ambush! ${G.enemy.name} (Lv.${G.player.birdLevel}) strikes!`,'enemy-action');
  if(G.turn==='enemy') scheduleOpeningEnemyTurn();
  saveRun();
}

function showGroveEvent(){
  G._groveOutcomes = null;
  G._groveResolved = false;
  const trees = document.getElementById('grove-trees');
  trees.style.display = 'none';
  document.getElementById('grove-result-msg').textContent = '';
  document.getElementById('grove-reward-section').style.display = 'none';
  document.getElementById('grove-continue-btn').style.display = 'none';
  document.getElementById('grove-continue-btn').textContent = 'Continue →';
  document.getElementById('grove-opt-row').style.display = 'flex';
  document.getElementById('grove-intro-text').style.display = '';

  const isSmall = ['tiny','small'].includes(G.player.size||'medium');
  const sizeHint = isSmall
    ? `<em>Your small form lets you slip into tight spaces — but beware larger threats.</em>`
    : `<em>Your size grants power, but agility may be needed here.</em>`;
  document.getElementById('grove-intro-text').innerHTML =
    `Ancient trees hide secrets — eggs, fruit, nests, or ambush.<br><br>${sizeHint}<br><br><strong>Pick one tree. Risk the grove?</strong>`;

  document.getElementById('grove-optout-btn').onclick = ()=>{
    logMsg('🌳 You leave the grove undisturbed. Onward.','system');
    G.phase='PLAYER';
    saveRun();
    resumeAfterGrove();
  };
  document.getElementById('grove-enter-btn').onclick = ()=> enterGrove();

  document.querySelectorAll('.grove-tree').forEach(t=>{
    t.className='grove-tree';
    t.innerHTML='🌳<span class="grove-rustle">Rustle…</span>';
    t.style.opacity='1'; t.style.transform='';
    t.onclick=null;
    t.classList.remove('grove-other-trees');
  });

  showScreen('screen-grove');
}

function enterGrove(){
  G._groveOutcomes = pickRandom(GROVE_OUTCOME_POOL, 3);

  document.getElementById('grove-opt-row').style.display = 'none';
  document.getElementById('grove-intro-text').style.display = 'none';
  const trees = document.getElementById('grove-trees');
  trees.style.display = 'grid';

  document.querySelectorAll('.grove-tree').forEach((t,i)=>{
    t.onclick = ()=> resolveGrove(i);
  });
}

async function resolveGrove(idx){
  if(G._groveResolved) return;
  G._groveResolved = true;

  const type = G._groveOutcomes[idx];
  const trees = document.querySelectorAll('.grove-tree');
  trees.forEach(t=>{ t.onclick=null; });

  const chosen = trees[idx];
  chosen.classList.add('revealed');

  await new Promise(r=>setTimeout(r,350));

  const hp = G.player.stats.hp;
  const maxHp = G.player.stats.maxHp;
  const resultEl = document.getElementById('grove-result-msg');
  let msg='', flavor='', floatClass='fn-heal';

  switch(type){
    case 'nest':{
      chosen.className='grove-tree revealed outcome-nest';
      chosen.innerHTML=`<span>🪹</span><span class="grove-outcome-label">Hidden Nest!</span>`;
      const rw=grantGroveNestMutation();
      if(rw){
        msg=`🪹 Nest treasure: ${rw.name} added to your nest inventory!`;
        SFX.spell(); SFX.exp();
      } else {
        msg='🪹 The nest is empty this time.';
      }
      resultEl.textContent = msg;
      resultEl.style.color = 'var(--gold)';
      trees.forEach((t,i)=>{ if(i!==idx) t.classList.add('grove-other-trees'); });
      logMsg(`🌳 Grove: ${msg}`,'exp-gain');
      await new Promise(r=>setTimeout(r,900));
      document.getElementById('grove-continue-btn').style.display='inline-block';
      return;
    }
    case 'ambush':{
      chosen.className='grove-tree revealed outcome-ambush';
      chosen.innerHTML=`<span>⚔️</span><span class="grove-outcome-label">Ambush!</span>`;
      msg='⚔️ A rival bird bursts from the branches!';
      flavor='Fight at your level — victory lets you move on.';
      resultEl.innerHTML = `<strong>${msg}</strong><br><span style="color:var(--text-dim);font-size:.82rem;">${flavor}</span>`;
      resultEl.style.color = 'var(--red-light)';
      logMsg(`🌳 Grove: ${msg}`,'enemy-action');
      trees.forEach((t,i)=>{ if(i!==idx) t.classList.add('grove-other-trees'); });
      await new Promise(r=>setTimeout(r,700));
      startGroveAmbushBattle();
      return;
    }
    case 'fruit':{
      chosen.className='grove-tree revealed outcome-fruit';
      const heal = Math.max(1, Math.floor(maxHp * 0.25));
      G.player.stats.hp = Math.min(maxHp, hp + heal);
      setHpBar('player', G.player.stats.hp, G.player.stats.maxHp);
      chosen.innerHTML=`<span>🍎</span><span class="grove-outcome-label">Grove Fruit!</span>`;
      msg = `🍎 Ripe grove fruit! +${heal} HP (25% max)`;
      flavor = 'Sweet restoration from the canopy.';
      floatClass='fn-heal';
      SFX.heal();
      spawnFloat('player',`+${heal}`,'fn-heal');
      break;
    }
    case 'egg':{
      chosen.className='grove-tree revealed outcome-egg';
      const added=typeof addSavedEggs==='function'?addSavedEggs(1):0;
      chosen.innerHTML=`<span>🥚</span><span class="grove-outcome-label">Saved Egg!</span>`;
      msg = added ? '🥚 A Saved Egg is tucked safely in your global bank (+1)!' : '🥚 You found an egg, but the bank could not be reached.';
      flavor = 'Banked immediately — no Flight completion required.';
      floatClass='fn-heal';
      SFX.exp();
      break;
    }
  }

  resultEl.innerHTML = `<strong>${msg}</strong><br><span style="color:var(--text-dim);font-size:.82rem;">${flavor}</span>`;
  resultEl.style.color = floatClass==='fn-heal' ? 'var(--green-light)' : 'var(--red-light)';
  logMsg(`🌳 Grove: ${msg}`, floatClass==='fn-heal'?'exp-gain':'enemy-action');
  trees.forEach((t,i)=>{ if(i!==idx) t.classList.add('grove-other-trees'); });
  await new Promise(r=>setTimeout(r,900));
  document.getElementById('grove-continue-btn').style.display='inline-block';
}

function groveFinish(){
  saveRun();
  G.phase='PLAYER';
  resumeAfterGrove();
}

// ============================================================
//  UTILS
// ============================================================
function pickRandom(arr,n){return[...arr].sort(()=>Math.random()-.5).slice(0,n);}

function showVictory(){
  if(!G.endlessMode){
    try { localStorage.removeItem(_OW_STATE_KEY); localStorage.removeItem(_OW_NAV_KEY); } catch(_) {}
  }
  G._flightSavedEggsAwarded=0;
  // HARD RESET COMBAT STATE
  G.animLock = false;
  G.turnPhase = null;
  G.turn = null;
  lockActionUI(true);
  G.playerStatus = {};
  G.enemyStatus = {};
  G.actionQueue=[];
  G.actionBusy=false;
  G.turnCount = 0;

  // Grant difficulty-based unlocks
  const diff=G.difficulty||'juvenile';
  if(diff==='fletchling'&&!isUnlocked('fletchlingWin')){ grantUnlock('fletchlingWin'); logMsg('🔓 Fletchling conquered!','boss'); }
  if(diff==='juvenile'&&!isUnlocked('juvenileWin')){ grantUnlock('juvenileWin'); grantUnlock('stage20'); logMsg('🔓 Juvenile conquered! New birds are now available.','boss'); }
  if(diff==='predator'&&!isUnlocked('predatorWin')){ grantUnlock('predatorWin'); grantUnlock('juvenileWin'); grantUnlock('stage20'); logMsg('🔓 Predator conquered! MURDER mode unlocked!','boss'); }
  // Legacy unlock ID for saves
  if(!isUnlocked('stage20')) grantUnlock('stage20');
  SFX.victory();
  checkRunUnlocks();
  saveRunHistory(true);
  saveHighscoreEntry(true);
  G.phase='REWARD';
  document.getElementById('gameover-inner').className='gameover-inner win';
  document.getElementById('gameover-title').textContent='⚔ Ascended! ⚔';
  const endMsg=G.endlessMode
    ?`${G.player.name} conquered Stage 20 and flies into endless glory! The battle continues...`
    :`${G.player.name} conquered all 20 stages and ascended to legend! 🔓 New birds unlocked!`;
  const abilityList=(G.player.abilities||[]).map(a=>`${ABILITY_TEMPLATES[a.id]?.name||a.id} Lv${a.level||1}`).join(' · ');
  document.getElementById('gameover-msg').textContent=endMsg;
  const flyAgainBtn=document.getElementById('fly-again-btn');
  if(flyAgainBtn) flyAgainBtn.style.display=(G.ui?.gameMode==='story')?'none':'inline-block';
  const unlockIds=['unlock_hummingbird','unlock_shoebill','unlock_secretary','unlock_magpie','unlock_kookaburra','unlock_peregrine','unlock_harpy','unlock_ostrich','unlock_kiwi','unlock_lyrebird','unlock_toucan','unlock_penguin','unlock_emu','unlock_swan','unlock_flamingo','unlock_seagull','unlock_albatross','unlock_duke_blakiston'];
  const unlockedNow=unlockIds.filter(id=>isUnlocked(id)).map(id=>id.replace('unlock_','').replace(/_/g,' '));
  const runUnlocks=document.getElementById('run-unlocks');
  if(runUnlocks){
    runUnlocks.innerHTML=`<div style="margin:10px 0 6px;font-size:.82rem;color:var(--gold-light)">🏆 Achievement: Court Cleared</div>
    <div style="font-size:.76rem;color:var(--text-dim);line-height:1.5">${G.player.name} · HP ${G.player.stats.hp}/${G.player.stats.maxHp} · ATK ${G.player.stats.atk} · DEF ${G.player.stats.def} · SPD ${G.player.stats.spd}<br/>Abilities: ${abilityList||'—'}<br/>Unlocked roster: ${unlockedNow.join(', ')||'None yet'}</div>`;
  }
  showRunStats();
  if(G.endlessMode){
    G.endlessBattle=0;
    logMsg('🌟 Stage 20 complete! Endless mode continues — bosses await!','boss');
    advanceStage();
    return;
  }
  G._flightSavedEggsAwarded=typeof awardFlightSavedEggs==='function'?awardFlightSavedEggs():0;
  if(G._flightSavedEggsAwarded>0) showRunStats();
  renderUnlockPopupsOnGameover();
  const endEvt={won:true, bird:G.player?.birdKey||'unknown', stageReached:G.stage||20, deathCause:'victory', endless:!!G.endlessMode};
  AvianEvents.emit('run:end', endEvt);
  runModuleHook('onRunEnd', endEvt);
  showScreen('screen-gameover');
  if((G.ui?.gameMode||'story')==='story') startStoryCinematic();
}
function showDefeat(){
  G._groveAmbushActive=false;
  G._flightSavedEggsAwarded=typeof awardFlightSavedEggs==='function'?awardFlightSavedEggs():0;
  restoreBattleTempPlayerStats();
  G.phase='REWARD';
  G.playerStatus = {};
  G.enemyStatus = {};
  G.actionQueue=[];
  G.actionBusy=false;
  G.turnCount = 0;
  deleteSave();
  SFX.defeat();
  checkRunUnlocks();
  saveRunHistory(false);
  saveHighscoreEntry(false);
  document.getElementById('gameover-inner').className='gameover-inner lose';
  document.getElementById('gameover-title').textContent='💀 Fallen';
  const stageLabel=G.endlessMode&&G.stage>20?`Endless Battle ${G.endlessBattle}`:`Stage ${G.stage}`;
  document.getElementById('gameover-msg').textContent=`${G.player.name} fell at ${stageLabel}. Lv.${G.player.birdLevel}. Rise again.`;
  const flyAgainBtn=document.getElementById('fly-again-btn');
  if(flyAgainBtn) flyAgainBtn.style.display='inline-block';
  hideStoryCinematic();
  const endEvt={won:false, bird:G.player?.birdKey||'unknown', stageReached:G.stage||1, deathCause:G._lastDeathCause||'hp_zero', endless:!!G.endlessMode};
  AvianEvents.emit('run:end', endEvt);
  runModuleHook('onRunEnd', endEvt);
  showRunStats();
  renderUnlockPopupsOnGameover();
  showScreen('screen-gameover');
}
function showRunStats(){
  const el=document.getElementById('run-stats'); if(!el) return;
  const stages=G.endlessMode?`${G.stage}+`:`${Math.min(G.stage,20)}/20`;
  const enemiesDefeated=Math.max(0,(G.stage||1)-1);
  const birdName=G.player?.name||'Unknown';
  el.innerHTML=`
    <div class="vstat"><div class="vstat-val">${birdName}</div><div class="vstat-lbl">Bird</div></div>
    <div class="vstat"><div class="vstat-val">${stages}</div><div class="vstat-lbl">Stage Reached</div></div>
    <div class="vstat"><div class="vstat-val">${enemiesDefeated}</div><div class="vstat-lbl">Enemies Defeated</div></div>
    <div class="vstat"><div class="vstat-val">${G.player.birdLevel}</div><div class="vstat-lbl">Level</div></div>
    <div class="vstat"><div class="vstat-val">${G.bossKills}</div><div class="vstat-lbl">Boss Kills</div></div>
    <div class="vstat"><div class="vstat-val">${BS.dmgDealt}</div><div class="vstat-lbl">Damage Dealt</div></div>
    <div class="vstat"><div class="vstat-val">${BS.highestHit}</div><div class="vstat-lbl">Highest Hit</div></div>
    <div class="vstat"><div class="vstat-val">${G.runCrits||0}</div><div class="vstat-lbl">Critical Hits</div></div>
    <div class="vstat"><div class="vstat-val">${G.collectedRewards.length}</div><div class="vstat-lbl">Rewards</div></div>
    <div class="vstat"><div class="vstat-val">${G.shinyObjects||0}</div><div class="vstat-lbl">Shiny Objects</div></div>
    ${G._flightSavedEggsAwarded>0?`<div class="vstat"><div class="vstat-val">+${G._flightSavedEggsAwarded} 🥚</div><div class="vstat-lbl">Saved Eggs</div></div>`:''}
    <div class="vstat"><div class="vstat-val">${G.player.stats.atk}</div><div class="vstat-lbl">Final ATK</div></div>
    <div class="vstat"><div class="vstat-val">${G.player.stats.hp}/${G.player.stats.maxHp}</div><div class="vstat-lbl">HP Left</div></div>`;
  el.style.display='grid';
}

let _storyCineTimer=null;
let _storyCineSpeed=1;
let _storyCineSkip=false;
function hideStoryCinematic(){
  if(_storyCineTimer){ clearTimeout(_storyCineTimer); _storyCineTimer=null; }
  const wrap=document.getElementById('story-cinematic');
  if(wrap) wrap.style.display='none';
}
function startStoryCinematic(){
  const wrap=document.getElementById('story-cinematic');
  const textEl=document.getElementById('story-cinematic-text');
  const slower=document.getElementById('story-slower-btn');
  const faster=document.getElementById('story-faster-btn');
  const skip=document.getElementById('story-skip-btn');
  if(!wrap||!textEl||!slower||!faster||!skip) return;

  const lines=[
    'Duke Blakiston falls. The iron gates of the court swing open — then still.',
    `${G.player?.name||'Your bird'} rises above the blackwater and broken reeds.`,
    'A new song carries across the canopy — the sky remembers your ascent.'
  ].join('\n\n');

  _storyCineSpeed=1;
  _storyCineSkip=false;
  let i=0;
  textEl.textContent='';
  textEl.scrollTop=0;
  wrap.style.display='block';

  slower.onclick=()=>{ _storyCineSpeed=Math.max(0.5, Math.round((_storyCineSpeed-0.25)*100)/100); };
  faster.onclick=()=>{ _storyCineSpeed=Math.min(3, Math.round((_storyCineSpeed+0.25)*100)/100); };
  skip.onclick=()=>{ _storyCineSkip=true; };

  const tick=()=>{
    if(_storyCineSkip){
      textEl.textContent=lines;
      textEl.scrollTop=textEl.scrollHeight;
      _storyCineTimer=null;
      return;
    }
    i=Math.min(lines.length, i+1);
    textEl.textContent=lines.slice(0,i);
    textEl.scrollTop=textEl.scrollHeight;
    if(i>=lines.length){ _storyCineTimer=null; return; }
    _storyCineTimer=setTimeout(tick, Math.max(10, Math.floor(30/_storyCineSpeed)));
  };
  tick();
}

// ============================================================
//  WEB AUDIO ENGINE — procedural sounds, no assets needed
// ============================================================
let _audioCtx = null;
let _soundEnabled = true;
function getAudioCtx() {
  if (!_audioCtx) { try { _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){} }
  return _audioCtx;
}
/** Call from user gestures (e.g. start run) so the first battle SFX are not blocked as autoplay. */
function primeAudioIfNeeded() {
  const ctx = getAudioCtx();
  if (!ctx || ctx.state !== 'suspended') return;
  try { ctx.resume().catch(() => {}); } catch (_) {}
}
globalThis.primeAudioIfNeeded = primeAudioIfNeeded;
function toggleSound() {
  _soundEnabled = !_soundEnabled;
  const btn=document.getElementById('sound-toggle-btn');
  if(btn) btn.textContent = _soundEnabled ? '🔊' : '🔇';
}
function playTone(freq, type='square', dur=0.12, vol=0.18, delay=0, freqEnd=null) {
  if (!_soundEnabled) return;
  const ctx = getAudioCtx(); if (!ctx) return;
  const volScale=getAudioVolumeMultipliers().masterSfx;
  if(volScale<=0.001) return;
  const run = () => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      if (freqEnd !== null) osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + delay + dur);
      gain.gain.setValueAtTime(vol*volScale, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch (_) {}
  };
  if (ctx.state === 'suspended') ctx.resume().then(run).catch(() => {});
  else run();
}
const SFX = {
  hit(urgency=1)  { playTone(180*urgency,'sawtooth',.09,.22,0,120*urgency); },
  crit(urgency=1) { playTone(320*urgency,'square',.06,.28); playTone(480*urgency,'square',.1,.2,.06,600*urgency); },
  miss()    { playTone(140,'sine',.12,.12,0,90); },
  dodge()   { playTone(600,'sine',.06,.12); playTone(800,'sine',.08,.1,.05); },
  heal()    { playTone(440,'sine',.08,.14); playTone(660,'sine',.12,.12,.08,880); },
  spell()   { playTone(260,'triangle',.15,.16,0,340); },
  exp()     { [0,.06,.12,.18].forEach((d,i)=>playTone(440+i*110,'sine',.1,.12,d)); },
  levelUp() { [0,.08,.16,.24,.32].forEach((d,i)=>playTone(330+i*110,'triangle',.14,.18,d)); },
  boss()    { playTone(80,'sawtooth',.3,.28); playTone(120,'square',.25,.18,.1); },
  victory() { [0,.1,.2,.3,.45].forEach((d,i)=>playTone([330,440,550,660,880][i],'triangle',.2,.2,d)); },
  defeat()  { [0,.15,.3].forEach((d,i)=>playTone([220,180,110][i],'sawtooth',.25,.2,d)); },
  poison()  { playTone(200,'square',.08,.1,0,150); },
  shield()  { playTone(500,'triangle',.08,.14); playTone(400,'triangle',.06,.1,.07); },
  ambush()  { playTone(800,'square',.04,.3); playTone(1200,'square',.08,.3,.04); playTone(600,'sawtooth',.12,.2,.1,300); },
};

// ============================================================
//  SCREEN SHAKE
// ============================================================
function doScreenShake(heavy=false) {
  const app=document.getElementById('app');
  const cls=heavy?'do-screen-shake-heavy':'do-screen-shake';
  app.classList.remove('do-screen-shake','do-screen-shake-heavy');
  void app.offsetWidth;
  app.classList.add(cls);
  setTimeout(()=>app.classList.remove(cls),heavy?600:450);
}

// ============================================================
//  BATTLE STATS TRACKER
// ============================================================
let BS = { dmgDealt:0, dmgTaken:0, crits:0, dodges:0, turns:0, highestHit:0 };
function resetBattleStats() { BS={dmgDealt:0,dmgTaken:0,crits:0,dodges:0,turns:0,highestHit:0}; }
function getBattleSummaryStats(){
  const acc = G._stageBattleStats;
  if(acc && typeof acc === 'object'){
    return {
      dmgDealt: Number(acc.dmgDealt) || 0,
      dmgTaken: Number(acc.dmgTaken) || 0,
      crits: Number(acc.crits) || 0,
      dodges: Number(acc.dodges) || 0,
      turns: Number(acc.turns) || 0,
      highestHit: Number(acc.highestHit) || 0,
    };
  }
  return (typeof BS !== 'undefined' && BS) ? BS : { dmgDealt:0, dmgTaken:0, crits:0, dodges:0, turns:0, highestHit:0 };
}
function renderBattleSummary() {
  const el=document.getElementById('battle-summary-bar'); if(!el) return;
  const stats = getBattleSummaryStats();
  el.innerHTML=`<div class="battle-summary">
    <div><div class="bsum-val">${stats.dmgDealt}</div><div class="bsum-lbl">Dmg Dealt</div></div>
    <div><div class="bsum-val">${stats.crits}</div><div class="bsum-lbl">Crits</div></div>
    <div><div class="bsum-val">${stats.dodges}</div><div class="bsum-lbl">Dodges</div></div>
    <div><div class="bsum-val">${stats.turns}</div><div class="bsum-lbl">Turns</div></div>
  </div>`;
}

// ============================================================
//  STAGE PROGRESS BAR
// ============================================================
function updateStageProgress() {
  const wrap=document.getElementById('stage-progress-wrap'); if(!wrap) return;
  const curStage=getEncounterStage();
  if(G.endlessMode&&curStage>20){wrap.style.display='none';return;}
  wrap.style.display='flex';
  const total=getStoryMaxStage();
  const cur=Math.min(curStage,total);
  document.getElementById('stage-progress-fill').style.width=(cur/total*100)+'%';
  document.getElementById('stage-progress-txt').textContent=`${cur}/${total}`;
  // Mark boss stages
  const bossEl=document.getElementById('stage-progress-bosses');
  if(bossEl&&!bossEl.children.length){
    [10,20].forEach(s=>{
      const pip=document.createElement('div');
      pip.className='boss-pip';
      pip.style.left=(s/total*100)+'%';
      pip.title=`Stage ${s} Boss`;
      bossEl.appendChild(pip);
    });
  }
}

// ============================================================
//  KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  // 1-4: ability shortcuts during player turn
  if(e.key==='Escape' && document.getElementById('ref-guide-modal')?.classList.contains('open')){
    e.preventDefault();
    closeRefGuideModal();
    return;
  }
  if(e.key==='Escape' && document.getElementById('settings-modal')?.classList.contains('open')){
    e.preventDefault();
    closeSettingsModal();
    return;
  }
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if(e.key==='Escape' && document.getElementById('select-hub-panels')?.classList.contains('is-open')){
    e.preventDefault();
    closeSelectHubPanel();
    return;
  }
  const screen=document.querySelector('.screen.active'); if(!screen) return;
  if(screen.id==='screen-start'){
    if(e.key==='Enter' || e.key===' '){
      e.preventDefault();
      takeFlightToSelect();
    }
    return;
  }
  if(screen.id==='screen-battle') {
    if(!G.animLock && G.turn==='player' && G.player) {
      const idx=parseInt(e.key)-1;
      if(idx>=0&&idx<=8){
        const btns=[...document.querySelectorAll('#actions-grid .action-btn[data-ab-idx]')].filter(b=>!b.classList.contains('endturn-mini'));
        const btn=btns[idx]||null;
        if(btn&&!btn.disabled) { btn.click(); return; }
      }
    }
    // Escape: close enemy info popup first, else nest menu
    if(e.key==='Escape') {
      const eip=document.getElementById('enemy-info-popup');
      if(eip && eip.classList.contains('enemy-info-popup--open')){ closeEnemyInfoPopup(); return; }
      if(!G.animLock) document.getElementById('nest-modal')?.classList.toggle('open');
    }
    // M = mute
    if(e.key.toLowerCase()==='m') toggleSound();
  }
  if(screen.id==='screen-select') {
    const doorOpen = document.getElementById('select-hub-door')?.classList.contains('is-open');
    if(doorOpen){
      if(e.key==='Enter') { if(G.selected) startGame(); }
      const cards=[...document.querySelectorAll('#bird-grid .bird-card:not(.bird-locked)')];
      if(cards.length && ['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)){
        e.preventDefault();
        const selected = cards.findIndex(c=>c.classList.contains('selected'));
        const cur = selected>=0 ? selected : 0;
        const delta = (e.key==='ArrowRight'||e.key==='ArrowDown') ? 1 : -1;
        const nxt = (cur + delta + cards.length) % cards.length;
        cards[nxt].click();
        cards[nxt].scrollIntoView({block:'nearest', inline:'nearest'});
      }
    }
  }
  if(screen.id==='screen-reward') {
    if(e.key==='Enter') { const cb=document.getElementById('reward-confirm-btn'); if(cb&&cb.classList.contains('visible')) cb.click(); }
    const cards=[...document.querySelectorAll('#reward-grid .reward-card')];
    if(cards.length && ['ArrowRight','ArrowLeft'].includes(e.key)){
      e.preventDefault();
      const selected = cards.findIndex(c=>c.classList.contains('selected'));
      const cur = selected>=0 ? selected : 0;
      const delta = e.key==='ArrowRight' ? 1 : -1;
      const nxt = (cur + delta + cards.length) % cards.length;
      cards[nxt].click();
    }
  }

  if(e.key.length===1) checkSecretUnlockChar(e.key);
});

// ============================================================
//  RUN HISTORY
// ============================================================
const RUN_HISTORY_KEY='avianAscent_runHistory_v1';
function saveRunHistory(won) {
  if(!G.player) return;
  try {
    const hist=JSON.parse(localStorage.getItem(RUN_HISTORY_KEY)||'[]');
    hist.unshift({
      bird:G.player.name, won,
      stage:Math.min(G.stage,20), birdLevel:G.player.birdLevel,
      bossKills:G.bossKills, date:Date.now(),
      endless:G.endlessMode&&G.stage>20?G.stage-20:0,
    });
    localStorage.setItem(RUN_HISTORY_KEY,JSON.stringify(hist.slice(0,5)));
  } catch(e){}
}
function renderRunHistory() {
  try {
    const hist=JSON.parse(localStorage.getItem(RUN_HISTORY_KEY)||'[]');
    const wrap=document.getElementById('run-history');
    const grid=document.getElementById('run-history-grid');
    if(!wrap||!grid) return;
    grid.innerHTML='';
    if(!hist.length){
      wrap.style.display='block';
      grid.innerHTML='<div class="run-entry run-empty"><div class="run-result">No recent runs yet.</div><div class="run-result" style="color:var(--text-dim)">Finish or abandon a run to see entries here.</div></div>';
      return;
    }
    hist.forEach(r=>{
      const d=document.createElement('div');
      d.className=`run-entry ${r.won?'run-win':'run-lose'}`;
      const ago=Math.floor((Date.now()-r.date)/60000);
      const timeStr=ago<1?'just now':ago<60?`${ago}m ago`:ago<1440?`${Math.floor(ago/60)}h ago`:`${Math.floor(ago/1440)}d ago`;
      const stageStr=r.endless>0?`Stage 20 + ${r.endless} endless`:r.won?'✦ Ascended':r.stage>=20?'Stage 20':'Stage '+r.stage;
      d.innerHTML=`<div class="run-bird">${r.won?'👑 ':'💀 '}${r.bird}</div>
        <div class="run-result">${stageStr} · Lv.${r.birdLevel}</div>
        <div class="run-result" style="color:var(--text-dim)">${r.bossKills} bosses · ${timeStr}</div>`;
      grid.appendChild(d);
    });
    wrap.style.display='block';
  } catch(e){}
}

// ============================================================
//  REFERENCE GUIDE — tabbed, dynamically built
// ============================================================
let _refActiveTab = 0;
const _refFilters = {
  abRarity: '',
  abEn: '',
  abType: '',
  mutTier: '',
  mutSlot: '',
  mutCategory: '',
};

function refAbilityEnergyCost(t) {
  if (!t) return 0;
  if (Number.isFinite(Number(t.energy))) return Number(t.energy);
  if (Number.isFinite(Number(t.energyCost))) return Number(t.energyCost);
  const byLv = t.energyByLevel;
  if (Array.isArray(byLv) && byLv.length) return Number(byLv[0]) || 0;
  return 0;
}

function refAbilityCodexType(id, t) {
  const mapped = String(t?.codexType || t?.type || 'physical').toLowerCase();
  if (mapped === 'song') return 'spell';
  return mapped;
}

function refAbilityPassesEnFilter(enCost, filter) {
  if (!filter) return true;
  const en = Number(enCost) || 0;
  if (filter === '0') return en <= 0;
  if (filter === '1') return en === 1;
  if (filter === '2') return en === 2;
  if (filter === '3plus') return en >= 3;
  return true;
}

function buildRefFilterBarHtml(activeTab) {
  if (activeTab === 1) {
    const r = _refFilters.abRarity || '';
    const e = _refFilters.abEn || '';
    const ty = _refFilters.abType || '';
    return `<div class="ref-filter-bar">
<label>Tier<select id="ref-filter-ab-rarity" data-ref-filter="abRarity">
<option value=""${r === '' ? ' selected' : ''}>All</option>
<option value="common"${r === 'common' ? ' selected' : ''}>Common</option>
<option value="uncommon"${r === 'uncommon' ? ' selected' : ''}>Uncommon</option>
<option value="rare"${r === 'rare' ? ' selected' : ''}>Rare</option>
<option value="epic"${r === 'epic' ? ' selected' : ''}>Epic</option>
</select></label>
<label>EN cost<select id="ref-filter-ab-en" data-ref-filter="abEn">
<option value=""${e === '' ? ' selected' : ''}>All</option>
<option value="0"${e === '0' ? ' selected' : ''}>Free (0)</option>
<option value="1"${e === '1' ? ' selected' : ''}>1 EN</option>
<option value="2"${e === '2' ? ' selected' : ''}>2 EN</option>
<option value="3plus"${e === '3plus' ? ' selected' : ''}>3+ EN</option>
</select></label>
<label>Type<select id="ref-filter-ab-type" data-ref-filter="abType">
<option value=""${ty === '' ? ' selected' : ''}>All</option>
<option value="physical"${ty === 'physical' ? ' selected' : ''}>Physical</option>
<option value="ranged"${ty === 'ranged' ? ' selected' : ''}>Ranged</option>
<option value="spell"${ty === 'spell' ? ' selected' : ''}>Spell</option>
<option value="utility"${ty === 'utility' ? ' selected' : ''}>Utility</option>
</select></label>
</div>`;
  }
  if (activeTab === 5) {
    const tier = _refFilters.mutTier || '';
    const slot = _refFilters.mutSlot || '';
    const cat = _refFilters.mutCategory || '';
    const slotLabels = (typeof Avian !== 'undefined' && Avian.mutations && Avian.mutations.SLOT_LABELS) || {};
    const slotOpts = Object.keys(slotLabels).map((sk) => {
      const sel = slot === sk ? ' selected' : '';
      return `<option value="${sk}"${sel}>${slotLabels[sk]}</option>`;
    }).join('');
    return `<div class="ref-filter-bar">
<label>Tier<select id="ref-filter-mut-tier" data-ref-filter="mutTier">
<option value=""${tier === '' ? ' selected' : ''}>All</option>
<option value="white"${tier === 'white' ? ' selected' : ''}>White</option>
<option value="green"${tier === 'green' ? ' selected' : ''}>Green</option>
<option value="blue"${tier === 'blue' ? ' selected' : ''}>Blue</option>
<option value="purple"${tier === 'purple' ? ' selected' : ''}>Purple</option>
<option value="gold"${tier === 'gold' ? ' selected' : ''}>Gold</option>
</select></label>
<label>Slot<select id="ref-filter-mut-slot" data-ref-filter="mutSlot">
<option value=""${slot === '' ? ' selected' : ''}>All</option>
${slotOpts}
</select></label>
<label>Category<select id="ref-filter-mut-category" data-ref-filter="mutCategory">
<option value=""${cat === '' ? ' selected' : ''}>All</option>
<option value="hybrid"${cat === 'hybrid' ? ' selected' : ''}>Hybrid</option>
<option value="offensive"${cat === 'offensive' ? ' selected' : ''}>Offensive</option>
<option value="defensive"${cat === 'defensive' ? ' selected' : ''}>Defensive</option>
</select></label>
</div>`;
  }
  return '';
}

function wireRefFilterSelects() {
  document.querySelectorAll('[data-ref-filter]').forEach((el) => {
    el.onchange = () => {
      const key = el.getAttribute('data-ref-filter');
      if (key && Object.prototype.hasOwnProperty.call(_refFilters, key)) {
        _refFilters[key] = el.value || '';
        buildRefGuide();
      }
    };
  });
}

const ABILITIES_REFERENCE = {
  multiPeck:{desc:'Sparrow neutral opener.',effect:'Multi-hit physical setup before choosing a branch.'},
  rapidPeck:{desc:'Striker basic opener.',effect:'Piercing multi-hit pressure after the Rapid branch choice.'},
  dart:{desc:'Reliable basic strike.',effect:'Stable damage with light utility pressure.'},
  honkAttack:{desc:'Bruiser/Tank basic control strike.',effect:'Physical damage with fear or control pressure.'},
  roost:{desc:'Recovery utility.',effect:'Restores HP and supports sustained fights.'},
  stormCall:{desc:'High-impact spell cast.',effect:'Heavy magic damage with setup payoff.'},
  dirgeOfDread:{desc:'Control song pattern.',effect:'Fear and weaken pressure over short windows.'},
  pinionVolley:{desc:'Predator multi-hit tool.',effect:'Repeated hits with armor-piercing pressure.'},
  bleakBeak:{desc:'Singer spell/basic hybrid.',effect:'Reliable low-cost spell chip and setup.'},
};

const ENEMY_BIRD_DATA = [
  {name:'Crow', hp:45, atk:8, def:5, type:'striker'},
  {name:'Hawk', hp:55, atk:10, def:6, type:'predator'},
  {name:'Emu', hp:120, atk:12, def:10, type:'bruiser'},
  {name:'Blakiston Owl', hp:300, atk:18, def:15, type:'boss'},
];

function openRefGuideModal() {
  const m = document.getElementById('ref-guide-modal');
  if (!m) return;
  m.classList.add('open');
  m.setAttribute('aria-hidden', 'false');
  try { buildRefGuide(); } catch (_) {}
  document.body.style.overflow = 'hidden';
}
function closeRefGuideModal() {
  const m = document.getElementById('ref-guide-modal');
  if (!m) return;
  m.classList.remove('open');
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  notifyOwUiEmbedClose();
}
function toggleRefGuide() {
  const m = document.getElementById('ref-guide-modal');
  if (!m) return;
  if (m.classList.contains('open')) closeRefGuideModal();
  else openRefGuideModal();
}

function selectRefTab(idx) {
  _refActiveTab = idx;
  buildRefGuide();
}
globalThis.selectRefTab = selectRefTab;

function skillCard(id) {
  const tmpl = ABILITY_TEMPLATES[id];
  if (!tmpl) return '';
  const typeLabel = {physical:'Physical',ranged:'Ranged',spell:'Song/Spell',utility:'Utility'}[tmpl.type]||tmpl.type;
  const levels = (tmpl.levels||[]).map((lv,i)=>`
    <div class="ref-skill-lv">
      <span class="ref-skill-lv-badge">Lv${i+1}</span>
      <span class="ref-skill-lv-text">${lv.desc||''}</span>
    </div>`).join('');
  return `<div class="ref-skill-card">
    <div class="ref-skill-header">
      <span class="ref-skill-name">${tmpl.name}</span>
      <span class="ref-skill-type ${tmpl.type||'physical'}">${typeLabel}</span>
    </div>
    <div class="ref-skill-base">${tmpl.desc||''}</div>
    <div class="ref-skill-levels">${levels}</div>
  </div>`;
}

function buildRefGuide() {
  const tabs = document.getElementById('ref-tabs');
  const panels = document.getElementById('ref-panels');
  if (!tabs || !panels) return;

  const defs=[
    {k:'birds',label:'🐦 Birds'},
    {k:'abilities',label:'🪶 Abilities'},
    {k:'enemies',label:'☠ Enemies'},
    {k:'statuses',label:'☣ Status Effects'},
    {k:'artifacts',label:'💎 Artefacts'},
    {k:'mutations',label:'🧬 Mutations'},
    {k:'items',label:'💧 Items'},
    {k:'mechanics',label:'⚙ Mechanics'},
  ];
  _refActiveTab=Math.max(0,Math.min(_refActiveTab,defs.length-1));
  const prevQ=(document.getElementById('ref-search-input')?.value||'').toLowerCase();
  const prevShowLocked=!!document.getElementById('ref-show-locked')?.checked;
  const filterBar = buildRefFilterBarHtml(_refActiveTab);
  tabs.innerHTML = `<div class="ref-codex-toolbar"><input id="ref-search-input" placeholder="Search codex..." class="ref-search-input"/><label class="ref-show-locked-label"><input id="ref-show-locked" type="checkbox"> Show locked</label></div>${filterBar}` + defs.map((t,i)=>`<div class="ref-tab${i===_refActiveTab?' active':''}" onclick="selectRefTab(${i})">${t.label}</div>`).join('');

  const q=prevQ;
  const showLocked=prevShowLocked;
  const isMatch=(txt)=>!q||String(txt||'').toLowerCase().includes(q);
  const card=(name,desc,unlocked,meta='')=>`<div class="ref-skill-card" style="opacity:${unlocked?1:0.55}"><div class="ref-skill-header"><span class="ref-skill-name">${unlocked?name:'???'}</span>${meta?`<span class="ref-skill-type utility">${meta}</span>`:''}</div><div class="ref-skill-base">${unlocked?desc:'Unlock by encountering this entry in a run.'}</div></div>`;

  const birdsIntro='<p class="ref-entry-desc ref-birds-intro">Unlock birds through runs, The Hatchery, and secret codes. Entries you have seen in a run appear here with their combat role.</p>';
  const birds=birdsIntro+Object.entries(BIRDS||{}).filter(([id,b])=>isMatch(b.name)).map(([id,b])=>{
    const u=!!G.codex?.birds?.[id]?.seen;
    if(!u&&!showLocked) return '';
    const roleId=classToRoleId(b.class);
    const roleLabel=idToClassLabel(roleId).toUpperCase();
    return card(b.name, `${b.tagline||''} · Role: ${roleLabel}`,u,roleId||'bird');
  }).join('');

  const packAbilityDefs = G.dataPacks?.abilityPassiveUpgrade?.ABILITY_DEFS || {};
  const abilities=Object.entries(ABILITY_TEMPLATES||{}).filter(([id,t])=>{
    const metaDef = packAbilityDefs[id] || {};
    const rarity = String(t.rarity || 'common').toLowerCase();
    if (_refFilters.abRarity && rarity !== _refFilters.abRarity) return false;
    const enCost = refAbilityEnergyCost(t);
    if (!refAbilityPassesEnFilter(enCost, _refFilters.abEn)) return false;
    const codexType = refAbilityCodexType(id, t);
    if (_refFilters.abType && codexType !== _refFilters.abType) return false;
    return isMatch(t.name)||isMatch(t.shortDesc)||isMatch(t.desc)||isMatch(metaDef.role)||isMatch(metaDef.notes);
  }).map(([id,t])=>{
    const c=G.codex?.abilities?.[id]||{seen:false,used:false};
    const u=!!c.seen;
    if(!u&&!showLocked) return '';
    const packDef = packAbilityDefs[id] || null;
    const enCost = refAbilityEnergyCost(t);
    const enLabel = enCost <= 0 ? 'Free' : `${enCost} EN`;
    const meta=`${enLabel} · ${t.rarity||'common'} · ${refAbilityCodexType(id, t)}`;
    const base=(t.shortDesc||t.desc||'No description yet.');
    const roleLine=packDef?.role?`<br><strong style="color:var(--gold-light)">Role:</strong> ${packDef.role}`:'';
    const notesLine=packDef?.notes?`<br><strong style="color:var(--gold-light)">Pack Notes:</strong> ${packDef.notes}`:'';
    const tagsLine=(Array.isArray(packDef?.tags)&&packDef.tags.length)?`<br><strong style="color:var(--gold-light)">Tags:</strong> ${packDef.tags.join(', ')}`:'';
    const path=formatAbilityLevelPathway(t);
    const levelPathLine=path?`<br><br><strong style="color:var(--gold-light)">Level Path:</strong><br>${path.replace(/\n/g,'<br>')}`:'';
    const desc=`${base}${roleLine}${notesLine}${tagsLine}${levelPathLine}`;
    return card(packDef?.name||t.name, desc,u,meta);
  }).join('');

  const rosterRows=Avian?.data?.enemyRoster?.byId||{};
  const enemies=Object.values(rosterRows).filter(e=>isMatch(e.name||e.fantasyTitle||'')).slice(0,120).map(e=>{
    const id=e.id||e.birdKey||e.name;
    const u=!!G.codex?.enemies?.[id]?.seen;
    if(!u&&!showLocked) return '';
    const ai=mapAiStyleToType(e.aiStyle||'aggressive');
    const st=e.stats||{};
    return card(e.name, `HP ${st.hp||0} · ATK ${st.atk||0} · L${e.storyLevel||'?'} · AI: ${ai}`,u,ai);
  }).join('');

  const packStatusGlossary = G.dataPacks?.abilityPassiveUpgrade?.STATUS_GLOSSARY || {};
  const statusIds=[...new Set([...Object.keys(AILMENTS||{}), ...Object.keys(packStatusGlossary), ...Object.keys(G.codex?.statuses||{})])];
  const statuses=statusIds.filter(id=>isMatch(id)).map(id=>{
    const u=!!G.codex?.statuses?.[id]?.seen;
    if(!u&&!showLocked) return '';
    const ail=AILMENTS[id];
    const d=(ail?.desc||packStatusGlossary[id])||'Status effect.';
    const label=ail?.name||(id[0].toUpperCase()+id.slice(1));
    return card(label,d,u,'status');
  }).join('');

  const mutCatalog=(typeof Avian?.mutations?.getCatalog==='function')?Avian.mutations.getCatalog():(Avian?.data?.mutations?.byId||{});
  const mutations=Object.entries(mutCatalog).filter(([id,item])=>{
    if(!item) return false;
    const tier = String(item.tier || '').toLowerCase();
    if (_refFilters.mutTier && tier !== _refFilters.mutTier) return false;
    if (_refFilters.mutSlot && item.slot !== _refFilters.mutSlot) return false;
    const category = String(item.category || '').toLowerCase();
    if (_refFilters.mutCategory && category !== _refFilters.mutCategory) return false;
    const slotLbl=Avian?.mutations?.SLOT_LABELS?.[item.slot]||item.slot||'';
    return isMatch(item.name)||isMatch(id)||isMatch(slotLbl)||isMatch(item.tier);
  }).map(([id,item])=>{
    const u=!!G.codex?.mutations?.[id]?.seen;
    if(!u&&!showLocked) return '';
    const slotLbl=Avian?.mutations?.SLOT_LABELS?.[item.slot]||item.slot||'';
    const tier=item.tier||'';
    const stats=u?getMutationDescHtml(item,{compact:true}):'';
    const body=u?`${stats}<div style="font-size:.78em;margin-top:6px;color:var(--text-dim)">${escapeHtmlRoster(slotLbl)} · ${escapeHtmlRoster(tier)} tier</div>`:'Unlock by finding this mutation in a run, shop, or nest.';
    return card(item.name||id,body,u,`${tier} · ${slotLbl}`);
  }).join('');

  const combatItems=Object.values(COMBAT_ITEM_CATALOG||{}).filter(def=>isMatch(def.name)||isMatch(def.combatHint)).map(def=>{
    const u=!!G.codex?.items?.[def.itemKey]?.seen;
    if(!u&&!showLocked) return '';
    const pct=Math.round((def.healPct||0)*100);
    const desc=def.combatHint||`Restore ${pct}% max HP for ${def.energyCost} energy (one heal item per turn).`;
    return card(def.name,desc,u,`${def.tier||'item'} · battle`);
  }).join('');

  const tierOrder=['grey','green','blue','purple','gold'];
  const tierLabel={grey:'Grey',green:'Green',blue:'Blue',purple:'Purple',gold:'Gold'};
  const rewardsSeen=new Set(Object.keys(G.codex?.artifacts||{}).filter(id=>G.codex?.artifacts?.[id]?.seen));
  const pool=(typeof getUpgradePool==='function')?getUpgradePool():[];
  const artsByTier=tierOrder.map(tier=>{
    const items=pool.filter(r=>r.tier===tier && (isMatch(r.name)||isMatch(r.desc))).map(r=>{
      const key=r.id||r.name;
      const unlocked=rewardsSeen.has(key) || (G.collectedRewards||[]).some(x=>(x.id||x.name)===key);
      if(!unlocked && !showLocked) return '';
      return card(r.name,r.desc,unlocked,tier);
    }).filter(Boolean).join('');
    if(!items) return '';
    return `<div style="grid-column:1/-1;margin-top:4px"><div style="font-family:'Cinzel',serif;color:var(--gold-light);font-size:.78rem;letter-spacing:.06em;margin:3px 0 6px;">${tierLabel[tier]} Tier</div><div class="ref-skills-grid">${items}</div></div>`;
  }).join('');
  const arts=artsByTier || (showLocked?card('???','Find rewards in runs to fill this section.',false,'locked'):'' );

  const mechanics=`<div class="ref-skills-grid">
    ${card('War Room & Character Select','Mission map sets difficulty and Story vs Endless. Begin Ascent opens Character Select to pick your bird. Inventory holds feathers and artifacts; Supplies holds this Reference codex.',true,'war-room')}
    ${card('Bird Cards & Tiers','Hatch at The Hatchery. Duplicate hatches grant Species Feathers. Spend feathers in Feather Sack or Character Select to raise stars and ascend tiers — higher tiers boost stats and passive scaling for that species.',true,'bird-cards')}
    ${card('Species Feathers','Per-bird currency from duplicate hatches at The Hatchery. Fuels card star and tier upgrades in Feather Sack or Character Select. Distinct from Mutated Feathers earned during runs.',true,'species-feathers')}
    ${card('Energy & Cooldowns','Main attacks are free unless spells. Abilities spend energy and many skills have cooldowns.',true,'core')}
    ${card('Post-Battle Recovery','Story: heal 20% max HP after each bird you defeat in a stage (including multi-bird nodes). Endless: heal 33% max HP after each victory. Halved with Hunter\'s Cruelty mutation.',true,'heal')}
    ${card('Role Taxonomy','Birds are grouped by combat roles: Striker, Bruiser, Tank, Trickster, Predator, Singer.',true,'roles')}
    ${card('Mutation Slots','Equip mutations in wing, feet, head, beak, chest, eyes, tail, plumage, and syrinx slots (limits per slot). Manage loadout in the Nest.',true,'mutations')}
    ${card('Nest Inventory','Found mutations go to nest inventory. Equip, compare, and sell extras between battles.',true,'nest')}
    ${card('Stork Shop','Spend Shiny Objects on upgrades, combat heal items, and mutation stock between fights.',true,'shop')}
    ${card('Mutated Feathers','Rare in-run currency used for mutation-focused rewards and nest progression (when offered).',true,'feathers')}
    ${card('Hit vs Dodge','Accuracy rolls can Miss. If the attack connects, a separate dodge roll may show Dodge — not Miss.',true,'combat')}
    ${card('Weaken (stacks)','Stacks to ×3: −10% outgoing damage and −10 Dodge per stack. Refreshes 3-turn duration.',true,'ailment')}
    ${card('Passive Evolution (Endless)','In Endless mode only, passives evolve at milestones with offensive vs utility choices. Story mode uses fixed starter passives.',true,'endless')}
    ${card('Enemy AI Profiles','Enemy personalities (aggressive, tactical, control, tank, predator, etc.) bias action planning.',true,'ai')}
    ${card('Codex Unlocks','Entries unlock when seen or used during runs. Open Reference from war room Supplies. Use search, filters, and Show Locked to browse all.',true,'codex')}
    ${card('Combat Screen Layout','Settings → Display: pick Original, Compact, Actions First, Log Focus, or Custom. Custom opens a panel editor to reorder sections and hide what you do not need. Size sliders still fine-tune avatars, panels, action tray, and log.',true,'combat-ui')}
    ${card('DEF & MDEF Penetration','DEF Penetration and generic Penetration bonuses ignore physical guard. MDEF Penetration ignores magical guard. Ability pierce stacks on top of equipped mutations.',true,'penetration')}
  </div>`;

  const panelBodies=[birds,abilities,enemies,statuses,arts,mutations,combatItems];
  const panelFallback=['No matching birds.','No matching abilities.','No matching enemies.','No matching statuses.','No matching artefacts.','No matching mutations.','No matching items.'];
  panels.innerHTML=panelBodies.map((html,i)=>{
    const inner=html||`<div class="ref-entry-desc">${panelFallback[i]}</div>`;
    const wrap=i===4?inner:`<div class="ref-skills-grid">${inner}</div>`;
    return `<div class="ref-panel ${_refActiveTab===i?'active':''}" id="ref-panel-${i}">${wrap}</div>`;
  }).join('')+`<div class="ref-panel ${_refActiveTab===7?'active':''}" id="ref-panel-7">${mechanics}</div>`;
  const qEl=document.getElementById('ref-search-input');
  const lEl=document.getElementById('ref-show-locked');
  if(qEl){ qEl.value=prevQ; qEl.oninput=()=>buildRefGuide(); }
  if(lEl){ lEl.checked=prevShowLocked; lEl.onchange=()=>buildRefGuide(); }
  wireRefFilterSelects();
}



function renderReferenceGuide(){
  buildRefGuide();
}

// ============================================================
//  RUN UNLOCK TRACKING
// ============================================================
const BUFF_AB_IDS=new Set(['hum','dustDevil','warcry','battleHymn','reveille','victoryChant','preen','molt','roost','fruitSweetener','tookieTookie','sitAndWait','bashUp','flyby','chargeUp','evade','crowDefend','bulwarkRoar']);
const DEBUFF_AB_IDS=new Set(['dirge','lullaby','theJoker','intimidate','featherRuffle','wingClip','tailPull','taunt','eyeGouge','mudshot','cactiSpine','aerialPoop','thornBarrage','astralRefrain','murderMurmuration','plagueBlast','toxicSpit','incendiaryFeathers','blackPeck']);

function checkRunUnlocks() {
  const newUnlocks=[];
  if(G.runCrits>=100&&!isUnlocked('crit100Run')){ grantUnlock('crit100Run'); newUnlocks.push('Flamingo & Bald Eagle unlocked! (100 crits)'); }
  if(G.runBuffs>=250&&!isUnlocked('buff250Run')){ grantUnlock('buff250Run'); newUnlocks.push('Swan & Macaw unlocked! (250 buffs)'); }
  if(G.runDebuffs>=250&&!isUnlocked('debuff250Run')){ grantUnlock('debuff250Run'); newUnlocks.push('Snowy Owl & Raven unlocked! (250 debuffs)'); }
  newUnlocks.forEach(msg=>showUnlockToast('🔓 '+msg));
}
function showUnlockToast(msg) {
  const t=document.getElementById('unlock-toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3500);
}

// ============================================================
//  STORK SHOP
// ============================================================
let _shopItems=[];
let _shopSelectedIdx=null;

/** Shelf utilities (non-upgrade slots). IDs must stay stable for overworld shop snapshots. */
/* Combat rewrite: legacy shop utility shelves removed. Stork-shop ability stock now comes from shop-v2 (combat pack). */
const _SHOP_UTILS_REGULAR = [];
const _SHOP_UTILS_BOSS    = [];

function makeUtilityOffer(mode){
  const pool = mode==='boss' ? _SHOP_UTILS_BOSS : _SHOP_UTILS_REGULAR;
  const src = pool[Math.floor(Math.random()*pool.length)];
  return {...src, apply:src.apply};
}

function assignShopItems(items){
  _shopItems=Array.isArray(items)?items:[];
  try{ globalThis._shopItems=_shopItems; }catch(_){}
}
function syncShopItemsToGlobal(){
  assignShopItems(_shopItems);
}

const SHOP_COMBAT_ITEMS = Object.freeze([
  buildCombatItemShopOffer(COMBAT_ITEM_CATALOG.freshWater),
  buildCombatItemShopOffer(COMBAT_ITEM_CATALOG.sugarWater),
  buildCombatItemShopOffer(COMBAT_ITEM_CATALOG.honeyWater),
]);

function showStorkShop(mode='boss') {
  G._shopMode=mode;
  enterStorkShopScreen();
}

function enterStorkShopScreen(){
  shopResetVisitState();
  showScreen('screen-stork-shop');
  setShopTab('all');
  const buyBtn=document.getElementById('shop-buy-btn'); if(buyBtn) buyBtn.disabled=true;
  const log=document.getElementById('shop-purchase-log');
  if(log){
    const mode=G._shopMode||'boss';
    log.textContent=mode==='endless-boss'
      ? 'Items · 1 ability · 1 mutation · Mutated Feather (Misc tab, 78🌟).'
      : 'Items · Misc · 9 Abilities · 9 Mutations · Sell inventory mutations on Sell tab.';
  }
  generateShopItems();
}

const SHOP_COSTS={grey:36,green:48,blue:70,purple:82,gold:164};

const SHOP_STATE = {
  purchaseMadeThisVisit:false,
  selectedIndex:null,
  selectedBuyIndices:new Set(),
  selectedSellIndices:new Set(),
  healingPurchasesThisVisit:new Set(),
  featherBoughtThisVisit:false,
  pinnedFeatherOffer:null,
};

const SHOP_BUY_CATEGORY_TABS=['all','items','misc','abilities','mutations'];
const SHOP_CATEGORY_DISPLAY_ORDER=['items','misc','abilities','mutations'];
const SHOP_CATEGORY_TITLES={
  items:'Items',
  misc:'Misc',
  abilities:'Abilities',
  mutations:'Mutations',
};

function resolveShopItemCategory(item){
  if(!item) return null;
  if(item.isCombatItem||item.shopCategory==='items') return 'items';
  if(item.isHealingShopItem||item.shopCategory==='healing') return 'items';
  if(item.isFeatherShopItem||item.shopCategory==='misc') return 'misc';
  if(item.isLearnAbility||item.shopCategory==='abilities') return 'abilities';
  if(item.type==='mutation'||item.shopCategory==='mutation') return 'mutations';
  return null;
}

function shopItemMatchesCategory(item, category){
  if(!item) return false;
  if(category==='all') return resolveShopItemCategory(item)!==null;
  if(category==='items') return !!item.isCombatItem || item.shopCategory==='items' || !!item.isHealingShopItem;
  if(category==='misc') return !!item.isFeatherShopItem || item.shopCategory==='misc';
  if(category==='abilities') return !!item.isLearnAbility || item.shopCategory==='abilities';
  if(category==='mutations') return item.type==='mutation' || item.shopCategory==='mutation';
  return true;
}

function getShopCategoryLogText(category){
  const mode=G._shopMode||'boss';
  if(category==='all') return 'All offerings — select items, then Buy Selected.';
  if(category==='items') return 'Stackable battle heals — buy until your hold cap, then use in combat (1 heal per turn).';
  if(category==='misc') return 'Mutated Feather (78🌟) upgrades a skill from your Nest — pinned, does not refresh.';
  if(category==='abilities') return mode==='endless-boss' ? 'One ability offer this visit.' : 'Nine ability offers — stored in Nest vault when bought.';
  if(category==='mutations') return mode==='endless-boss' ? 'One mutation offer this visit.' : 'Nine mutation offers — weighted by tier.';
  return '';
}

function clearShopSelection(){
  SHOP_STATE.selectedBuyIndices.clear();
  SHOP_STATE.selectedSellIndices.clear();
  SHOP_STATE.selectedIndex=null;
  _shopSelectedIdx=null;
}

function getShopItemBaseCost(item){
  if(!item) return 0;
  let baseCost=(typeof item.costOverride==='number')?item.costOverride:(SHOP_COSTS[item.tier]||1);
  if(G.player?.mutLongWar) baseCost=Math.ceil(baseCost*1.15);
  return baseCost;
}

function getShopItemBuyCost(item){
  return Math.max(0,getShopItemBaseCost(item)-Math.max(0,G._nextShopDiscount||0));
}

function getShopSelectedBuyTotal(){
  const indices=[...SHOP_STATE.selectedBuyIndices].sort((a,b)=>a-b);
  let total=0;
  let discount=Math.max(0,G._nextShopDiscount||0);
  for(const idx of indices){
    const item=_shopItems[idx];
    if(!item) continue;
    const base=getShopItemBaseCost(item);
    const applied=Math.min(discount, base);
    total+=base-applied;
    discount-=applied;
  }
  return total;
}

function getShopMarginalBuyCost(item){
  const base=getShopItemBaseCost(item);
  if(SHOP_STATE.selectedBuyIndices.size===0){
    return Math.max(0,base-Math.max(0,G._nextShopDiscount||0));
  }
  return base;
}

function getShopRemainingBudget(){
  return G.shinyObjects-getShopSelectedBuyTotal();
}

function updateShopBuyButtonState(){
  const buyBtn=document.getElementById('shop-buy-btn');
  if(!buyBtn) return;
  const n=SHOP_STATE.selectedBuyIndices.size;
  buyBtn.disabled=n===0;
  buyBtn.textContent=n>0?`✓ Buy Selected (${n})`:'✓ Buy Selected';
}

function updateShopSellButtonState(){
  const sellBtn=document.getElementById('shop-sell-btn');
  if(!sellBtn) return;
  const n=SHOP_STATE.selectedSellIndices.size;
  sellBtn.disabled=n===0;
  sellBtn.textContent=n>0?`✓ Sell Selected (${n})`:'✓ Sell Selected';
}

function appendShopSectionHeading(grid, title){
  const div=document.createElement('div');
  div.className='shop-section-heading shop-row-label';
  div.textContent=title;
  grid.appendChild(div);
}

function buildShopBuyCard(item, idx, {isSelected, canSelect, cost}){
  const isCombatShopItem=!!item.isCombatItem;
  const atCap=isCombatShopItem && item.itemKey && !canAddCombatItem(G.player, item.itemKey, 1);
  const div=document.createElement('div');
  div.className=`shop-item tier-${item.tier||'grey'}${isSelected?' selected':''}${(!isSelected && !canSelect)?' cant-afford':''}${atCap?' shop-locked-visit':''}`;
  div.dataset.shopIdx=String(idx);
  div.innerHTML=`
    <div class="shop-item-select-tick">✓</div>
    <div class="shop-item-head">
      <div class="reward-tier-label">${(REWARD_TIERS[item.tier]||REWARD_TIERS.grey).label}</div>
      <div class="shop-item-cost">${cost}🌟</div>
    </div>
    <span class="reward-icon">${item.icon}</span>
    <div class="reward-name">${item.name}</div>
    <div class="reward-desc mut-stat-compact-wrap">${item.type==='mutation'||item.mutationItemId?(getMutationDescHtml(item.mutationItemId||item.id,{compact:true})||escapeHtmlRoster(item.desc||'')):escapeHtmlRoster(item.desc||'')}</div>`;
  if(item.desc && tooltipsEnabled('items')) div.title=item.type==='mutation'?String(item.desc||'').replace(/\n/g,' · '):item.desc;
  div.addEventListener('click', ()=>{
    if(SHOP_STATE.selectedBuyIndices.has(idx)){
      SHOP_STATE.selectedBuyIndices.delete(idx);
      renderShopItems();
      return;
    }
    if(!canSelect) return;
    SHOP_STATE.selectedBuyIndices.add(idx);
    renderShopItems();
  });
  return div;
}

function setShopTab(tab){
  const isSell=(tab==='sell');
  clearShopSelection();
  G._shopTab=isSell?'sell':'buy';
  G._shopCategoryTab=(!isSell && SHOP_BUY_CATEGORY_TABS.includes(tab))?tab:(G._shopCategoryTab||'all');
  if(!isSell && SHOP_BUY_CATEGORY_TABS.includes(tab)) G._shopCategoryTab=tab;
  SHOP_BUY_CATEGORY_TABS.forEach(cat=>{
    const el=document.getElementById('shop-tab-'+cat);
    if(el) el.classList.toggle('active', !isSell && G._shopCategoryTab===cat);
  });
  const sellTab=document.getElementById('shop-tab-sell');
  if(sellTab) sellTab.classList.toggle('active', isSell);
  const buyBtn=document.getElementById('shop-buy-btn');
  const sellBtn=document.getElementById('shop-sell-btn');
  const refreshBtn=document.getElementById('shop-refresh-btn');
  if(buyBtn) buyBtn.style.display=isSell?'none':'';
  if(sellBtn) sellBtn.style.display=isSell?'':'none';
  if(refreshBtn) refreshBtn.style.display=isSell?'none':'';
  const log=document.getElementById('shop-purchase-log');
  if(log){
    if(isSell){
      log.textContent='Sell mutations from your inventory for half their shop buy price (in shinies).';
    } else {
      log.textContent=getShopCategoryLogText(G._shopCategoryTab);
    }
  }
  if(isSell) renderShopSellItems();
  else renderShopItems();
}

function getMutationSellPrice(tier){
  const raw=String(tier||'white').toLowerCase();
  const key=raw==='grey'?'white':raw;
  const costs=(Avian?.mutations?.MUTATION_SHOP_COSTS)||{white:16,green:28,blue:44,purple:64,gold:96};
  return Math.max(1, Math.floor((costs[key]||costs[raw]||20)/2));
}

function renderShopSellItems(){
  const grid=document.getElementById('shop-items-grid'); if(!grid) return;
  grid.innerHTML='';
  const shinyCt=document.getElementById('shop-shiny-count'); if(shinyCt) shinyCt.textContent=G.shinyObjects;
  SHOP_STATE.selectedSellIndices=new Set([...SHOP_STATE.selectedSellIndices].filter(i=>i>=0 && i<(G.player?.mutationInventory||[]).length));
  updateShopSellButtonState();
  const inv=G.player?.mutationInventory||[];
  if(!inv.length){
    grid.innerHTML='<div style="grid-column:1/-1;color:var(--text-dim);text-align:center;padding:24px 0;">No mutations in inventory to sell.</div>';
    return;
  }
  appendShopSectionHeading(grid, 'Sell Mutations');
  const labels=Avian?.mutations?.SLOT_LABELS||{};
  const icons=Avian?.mutations?.SLOT_ICONS||{};
  inv.forEach((entry, idx)=>{
    const id=typeof entry==='string'?entry:entry?.itemId;
    const item=Avian?.mutations?.getItem?.(id);
    if(!item) return;
    const tierCss=normalizeRewardTier(item.tier);
    const tierMeta=rewardTierMeta(item.tier);
    const price=getMutationSellPrice(item.tier);
    const isSelected=SHOP_STATE.selectedSellIndices.has(idx);
    const div=document.createElement('div');
    div.className=`shop-item tier-${tierCss} shop-sell-item${isSelected?' selected':''}`;
    div.dataset.shopIdx=String(idx);
    div.innerHTML=`
      <div class="shop-item-select-tick">✓</div>
      <div class="shop-item-head">
        <div class="reward-tier-label">${tierMeta.label}</div>
        <div class="shop-item-cost">${price}🌟</div>
      </div>
      <span class="reward-icon">${icons[item.slot]||'🧬'}</span>
      <div class="reward-name">${item.name}</div>
      <div class="reward-desc">${labels[item.slot]||item.slot} · Sell for half buy price</div>`;
    div.addEventListener('click', ()=>{
      if(SHOP_STATE.selectedSellIndices.has(idx)) SHOP_STATE.selectedSellIndices.delete(idx);
      else SHOP_STATE.selectedSellIndices.add(idx);
      renderShopSellItems();
    });
    grid.appendChild(div);
  });
}

function shopSellSelected(){
  const indices=[...SHOP_STATE.selectedSellIndices].sort((a,b)=>b-a);
  if(!indices.length || !G.player) return false;
  const inv=G.player.mutationInventory||[];
  let total=0;
  const soldNames=[];
  for(const idx of indices){
    const entry=inv[idx];
    if(!entry) continue;
    const id=typeof entry==='string'?entry:entry?.itemId;
    const item=Avian?.mutations?.getItem?.(id);
    if(!item) continue;
    const price=getMutationSellPrice(item.tier);
    total+=price;
    soldNames.push(item.name);
    inv.splice(idx, 1);
  }
  if(!soldNames.length) return false;
  G.shinyObjects+=total;
  G.player.mutationInventory=inv;
  if(typeof Avian?.mutations?.reapplyPlayerStatsFromSources==='function') Avian.mutations.reapplyPlayerStatsFromSources(G.player);
  logMsg(`💰 Sold ${soldNames.length} mutation(s) for ${total}🌟.`, 'exp-gain');
  const log=document.getElementById('shop-purchase-log');
  if(log) log.textContent=`✓ Sold: ${soldNames.join(', ')} (+${total}🌟).`;
  clearShopSelection();
  saveRun();
  renderShopSellItems();
  return true;
}

function rollShopTier(weights){
  const tiers=Object.keys(weights);
  const vals=tiers.map(t=>weights[t]);
  return rollWeighted(tiers,vals);
}
function pickUniqueRewardByTier(tier,used){
  const pool=getUpgradePool().filter(r=>r.tier===tier&&upgradeEligibleForRewardPick(r,used));
  if(!pool.length) return null;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  used.add(pick.id);
  return pick;
}

// Reconstruct a shop item (with its apply function) from a persisted ID.
// Used when restoring saved shop snapshots for overworld nodes.
function _findShopItemById(id) {
  if (id === 'shop_mutated_feather') return makeMutatedFeatherShopOffer();
  const combatDef = SHOP_COMBAT_ITEMS.find(x => x.id === id);
  if (combatDef) {
    const def = COMBAT_ITEM_CATALOG[combatDef.itemKey];
    if (def) return buildCombatItemShopOffer(def);
  }
  const upg = getUpgradePool().find(x => x.id === id);
  if (upg) return upg;
  if (typeof Avian?.mutations?.reconstructShopOffer === 'function') {
    const mut = Avian.mutations.reconstructShopOffer(id);
    if (mut) return mut;
  }
  if (typeof Avian?.shop?.findById === 'function') {
    const ability = Avian.shop.findById(id);
    if (ability) return ability;
  }
  const util = [..._SHOP_UTILS_REGULAR,..._SHOP_UTILS_BOSS].find(x => x.id === id);
  if (util) return {...util};
  return null;
}
function generateShopItems() {
  if (typeof globalThis.__avianPatchedGenerateShopItems === 'function') {
    return globalThis.__avianPatchedGenerateShopItems();
  }
  const nodeId = G._currentShopNodeId ?? null;
  const mode = G._shopMode || 'boss';

  // ── Return-visit: restore snapshot (minus already-purchased items) ──────────
  if (nodeId != null && G._shopSnapshots?.[nodeId]) {
    const snap = G._shopSnapshots[nodeId];
    const bought = new Set(snap.boughtIds || []);
    assignShopItems((snap.itemIds || [])
      .filter(id => !bought.has(id))
      .map(id => _findShopItemById(id))
      .filter(Boolean));
    renderShopItems();
    return;
  }

  // ── First visit: generate random items ──────────────────────────────────────
  assignShopItems([]);
  const used = new Set();
  const goldCapReached = getGoldCardCount() >= getGoldCardLimit();

  _shopItems.push(...SHOP_COMBAT_ITEMS.map(it => ({ ...it })));

  if (mode === 'grey') {
    // Regular shop: 5 upgrade cards + 1 utility = 6 upgrade slots
    for (let i = 0; i < 5; i++) {
      const tier = goldCapReached
        ? rollShopTier({grey:52,green:30,blue:16,purple:2})
        : rollShopTier({grey:50,green:28,blue:16,purple:5,gold:1});
      const pick = pickUniqueRewardByTier(tier,used)
        || pickUniqueRewardByTier('green',used)
        || pickUniqueRewardByTier('grey',used);
      if (pick) _shopItems.push(pick);
    }
    _shopItems.push(makeUtilityOffer('regular'));
  } else {
    // Boss shop: 5 elite cards + 1 utility = 6 upgrade slots
    for (let i = 0; i < 5; i++) {
      const tier = goldCapReached
        ? rollShopTier({blue:56,purple:44})
        : rollShopTier({blue:50,purple:38,gold:12});
      const pick = pickUniqueRewardByTier(tier,used)
        || pickUniqueRewardByTier('purple',used)
        || pickUniqueRewardByTier('blue',used);
      if (pick) _shopItems.push(pick);
    }
    _shopItems.push(makeUtilityOffer('boss'));
  }

  // ── Save snapshot so the same items appear on return visits ─────────────────
  if (nodeId != null) {
    if (!G._shopSnapshots) G._shopSnapshots = {};
    G._shopSnapshots[nodeId] = {
      mode,
      itemIds: _shopItems.map(it => it.id),
      boughtIds: [],
    };
    saveRun();
  }

  renderShopItems();
}

try{
  globalThis.assignShopItems=assignShopItems;
  globalThis.SHOP_COMBAT_ITEMS=SHOP_COMBAT_ITEMS;
  globalThis.COMBAT_ITEM_CATALOG=COMBAT_ITEM_CATALOG;
  globalThis.SHOP_STATE=SHOP_STATE;
  globalThis._findShopItemById=_findShopItemById;
  globalThis.setShopTab=setShopTab;
  globalThis.shopSellSelected=shopSellSelected;
}catch(_){}

function shopResetVisitState(){
  SHOP_STATE.purchaseMadeThisVisit = false;
  SHOP_STATE.selectedIndex = null;
  SHOP_STATE.selectedBuyIndices = new Set();
  SHOP_STATE.selectedSellIndices = new Set();
  SHOP_STATE.healingPurchasesThisVisit = new Set();
  SHOP_STATE.featherBoughtThisVisit = false;
  SHOP_STATE.pinnedFeatherOffer = null;
  _shopSelectedIdx = null;
  G._shopRefreshCount = 0;
  G._shopTab = 'buy';
}
function shopLockVisitState(){
  SHOP_STATE.purchaseMadeThisVisit = true;
  clearShopSelection();
}
function getShopRefreshCost(){
  const c=Math.max(0,G._shopRefreshCount||0);
  return 20+12*c+6*c*c;
}

function renderShopItems() {
  if(Array.isArray(globalThis._shopItems) && globalThis._shopItems.length>_shopItems.length){
    assignShopItems(globalThis._shopItems);
  }
  const grid=document.getElementById('shop-items-grid'); if(!grid){ syncShopItemsToGlobal(); return; }
  grid.innerHTML='';
  const shinyCt=document.getElementById('shop-shiny-count'); if(shinyCt) shinyCt.textContent=G.shinyObjects;
  SHOP_STATE.selectedBuyIndices=new Set([...SHOP_STATE.selectedBuyIndices].filter(i=>i>=0 && i<_shopItems.length && _shopItems[i]));
  updateShopBuyButtonState();
  const refreshBtn=document.getElementById('shop-refresh-btn');
  if(refreshBtn){
    refreshBtn.disabled=false;
    const rCost=(G._freeShopRefresh||0)>0?0:getShopRefreshCost();
    refreshBtn.textContent=`🔄 Refresh (${rCost}🌟)`;
  }

  const category=G._shopCategoryTab||'all';
  const remaining=getShopRemainingBudget();
  const indexed=_shopItems.map((item,idx)=>({item,idx}));

  function appendCategoryCards(rows){
    rows.forEach(({item,idx})=>{
      const cost=getShopItemBaseCost(item);
      const atCap=!!(item.isCombatItem && item.itemKey && !canAddCombatItem(G.player, item.itemKey, 1));
      const isSelected=SHOP_STATE.selectedBuyIndices.has(idx);
      const canSelect=!atCap && (isSelected || remaining>=getShopMarginalBuyCost(item));
      grid.appendChild(buildShopBuyCard(item, idx, {isSelected, canSelect, cost}));
    });
  }

  if(category==='all'){
    let any=false;
    SHOP_CATEGORY_DISPLAY_ORDER.forEach(cat=>{
      const rows=indexed.filter(({item})=>shopItemMatchesCategory(item, cat));
      if(!rows.length) return;
      any=true;
      appendShopSectionHeading(grid, SHOP_CATEGORY_TITLES[cat]||cat);
      appendCategoryCards(rows);
    });
    if(!any){
      grid.innerHTML=`<div style="grid-column:1/-1;color:var(--text-dim);text-align:center;padding:24px 0;">Nothing in this category right now.</div>`;
    }
  } else {
    const rows=indexed.filter(({item})=>shopItemMatchesCategory(item, category));
    if(!rows.length){
      grid.innerHTML=`<div style="grid-column:1/-1;color:var(--text-dim);text-align:center;padding:24px 0;">Nothing in this category right now.</div>`;
      syncShopItemsToGlobal();
      return;
    }
    appendShopSectionHeading(grid, SHOP_CATEGORY_TITLES[category]||category);
    appendCategoryCards(rows);
  }
  syncShopItemsToGlobal();
}

function purchaseShopItemAtIndex(idx, costOverride){
  const item=_shopItems[idx];
  if(!item) return null;
  if(item.isCombatItem && item.itemKey && !canAddCombatItem(G.player, item.itemKey, 1)) return null;
  const cost=(typeof costOverride==='number')?costOverride:getShopItemBuyCost(item);
  if(G.shinyObjects<cost) return null;

  G.shinyObjects-=cost;
  if(cost<getShopItemBaseCost(item) && G._nextShopDiscount>0) G._nextShopDiscount=0;
  if(item.type==='mutation'){
    const itemId=item.mutationItemId||item.id;
    if(typeof Avian?.mutations?.addToInventory==='function') Avian.mutations.addToInventory(G.player, itemId);
    codexMark('mutations', itemId, 'seen');
  } else if(item.isCombatItem && typeof item.apply==='function'){
    item.apply(G.player);
  } else {
    applyUpgradeWithMaxHpHealing(G.player, ()=>item.apply(G.player), item.name||'Shop Item', {id:item.id, desc:item.desc});
  }
  refreshPlayerAbilityAilments();
  enforceAbilityCosts(G.player);

  if(!G.collectedRewards) G.collectedRewards=[];
  G.collectedRewards.push({id:item.id||item.name,icon:item.icon,tier:item.tier,name:item.name,desc:item.desc});
  codexMark('artifacts', item.id||item.name, 'seen');

  if(item.stackable===false){ if(!(G.runUpgradesPurchased instanceof Set)) G.runUpgradesPurchased=new Set(); G.runUpgradesPurchased.add(item.id); }
  if ((G._currentShopNodeId ?? null) != null && G._shopSnapshots?.[G._currentShopNodeId]) {
    if (!G._shopSnapshots[G._currentShopNodeId].boughtIds) G._shopSnapshots[G._currentShopNodeId].boughtIds = [];
    if (item.id && !G._shopSnapshots[G._currentShopNodeId].boughtIds.includes(item.id))
      G._shopSnapshots[G._currentShopNodeId].boughtIds.push(item.id);
  }
  _shopItems.splice(idx,1);
  assignShopItems(_shopItems);
  if(item.isFeatherShopItem) SHOP_STATE.featherBoughtThisVisit=true;
  return {item, cost, isCombatItem:!!item.isCombatItem};
}

async function shopBuySelected() {
  if(Array.isArray(globalThis._shopItems) && globalThis._shopItems.length>_shopItems.length){
    assignShopItems(globalThis._shopItems);
  }
  const indices=[...SHOP_STATE.selectedBuyIndices].sort((a,b)=>a-b);
  if(!indices.length) return false;

  let discount=Math.max(0,G._nextShopDiscount||0);
  const costByIdx=new Map();
  let totalCost=0;
  for(const idx of indices){
    const item=_shopItems[idx];
    if(!item) continue;
    if(item.isCombatItem && item.itemKey && !canAddCombatItem(G.player, item.itemKey, 1)) continue;
    const base=getShopItemBaseCost(item);
    const applied=Math.min(discount, base);
    const cost=base-applied;
    discount-=applied;
    costByIdx.set(idx, cost);
    totalCost+=cost;
  }
  if(G.shinyObjects<totalCost){
    logMsg('Not enough shiny objects!','miss');
    return false;
  }
  if(costByIdx.size && (G._nextShopDiscount||0)>0){
    const anyDiscounted=[...costByIdx.entries()].some(([idx,c])=>c<getShopItemBaseCost(_shopItems[idx]));
    if(anyDiscounted) G._nextShopDiscount=0;
  }

  const purchased=[];
  for(const idx of [...indices].sort((a,b)=>b-a)){
    const cost=costByIdx.get(idx);
    if(cost==null) continue;
    const result=purchaseShopItemAtIndex(idx, cost);
    if(result){
      purchased.push(result);
      SHOP_STATE.selectedBuyIndices.delete(idx);
    }
  }
  if(!purchased.length) return false;

  const names=purchased.map(r=>`${r.item.icon} ${r.item.name}`);
  logMsg(`🌟 Purchased ${purchased.length} item(s)!`,'exp-gain');
  const log=document.getElementById('shop-purchase-log');
  if(log) log.textContent=`✓ Bought: ${names.join(', ')}. Keep shopping or leave when done.`;

  clearShopSelection();
  saveRun();
  renderShopItems();
  if(document.getElementById('screen-battle')?.classList.contains('active') && typeof refreshBattleUI==='function'){
    try{ refreshBattleUI(); }catch(_){}
  }
  return true;
}
function shopRefresh() {
  if((G._freeShopRefresh||0)>0){G._freeShopRefresh--; }
  else {
    const rc=getShopRefreshCost();
    if(G.shinyObjects<rc){ logMsg(`Need ${rc} shiny objects to refresh!`,'miss'); return false; }
    G.shinyObjects-=rc;
  }
  G._shopRefreshCount=(G._shopRefreshCount||0)+1;
  const _rNodeId = G._currentShopNodeId ?? null;
  const keepFeather=!SHOP_STATE.featherBoughtThisVisit;
  const savedFeather=keepFeather?SHOP_STATE.pinnedFeatherOffer:null;
  if (_rNodeId != null && G._shopSnapshots) delete G._shopSnapshots[_rNodeId];
  if(keepFeather && savedFeather) SHOP_STATE.pinnedFeatherOffer=savedFeather;
  const log=document.getElementById('shop-purchase-log');
  if(log) log.textContent='🔄 Shop refreshed — abilities re-rolled. Mutated Feather unchanged if still available.';
  generateShopItems();
  return true;
}
function exitStorkShop() {
  const returningShopNodeId = G._currentShopNodeId;
  if (returningShopNodeId != null) setOverworldCurrentNode(returningShopNodeId);
  G._currentShopNodeId = null;
  // Return to overworld after shopping (story/overworld mode only)
  if (!G.endlessMode && _isOverworldRun()) {
    // Safety net: if stage was never finalized (e.g. boss shop shown mid-overworld), do it now
    if (G._owPendingBattleStage != null) {
      finalizeOverworldStageClear(G._owPendingBattleStage, G._owPendingNodeId, {
        shinyGain: G._owSequenceShiny || 0,
        enemiesDefeated: G._owEnemyCount || G._owStageEnemies?.length || 1,
      });
      clearOverworldPendingBattle();
    }
    saveRun();
    try{
      const owp=G._overworldProgress;
      const nid=owp && Number.isFinite(Number(owp.currentNodeId))
        ? Math.floor(Number(owp.currentNodeId))
        : (Number.isFinite(Number(returningShopNodeId)) ? Math.floor(Number(returningShopNodeId)) : 0);
      if(typeof globalThis.persistOwMapSnapshot==='function')
        globalThis.persistOwMapSnapshot(nid, G.player?.birdKey||null);
    }catch(_){}
    try { window.location.href = 'blackstone_overworld_new.html'; return; } catch(_) {}
  }
  advanceStage();
}

// ============================================================
//  ABANDON RUN
// ============================================================
function openAbandonModal() {
  const m=document.getElementById('abandon-modal'); if(m) m.classList.add('open');
}
function closeAbandonModal() {
  const m=document.getElementById('abandon-modal'); if(m) m.classList.remove('open');
}
function confirmAbandon() {
  closeAbandonModal();
  checkRunUnlocks();
  deleteSave();
  stopAllGameAudio();
  showScreen('screen-select');initSelectionSafe();
  renderRunHistory();
}


function unlockAllCodexEntries(){
  if(!G.codex) G.codex={abilities:{},enemies:{},birds:{},artifacts:{},statuses:{},mutations:{},items:{}};
  const ensure=(type,id,used=false)=>{
    if(!id) return;
    if(!G.codex[type]) G.codex[type]={};
    if(!G.codex[type][id]) G.codex[type][id]={seen:false,used:false};
    G.codex[type][id].seen=true;
    if(used) G.codex[type][id].used=true;
  };

  Object.keys(BIRDS||{}).forEach(id=>ensure('birds',id,false));
  Object.keys(ABILITY_TEMPLATES||{}).forEach(id=>ensure('abilities',id,true));
  const rosterRows=Avian?.data?.enemyRoster?.byId||{};
  Object.keys(rosterRows).forEach(id=>ensure('enemies',id,false));
  Object.keys(AILMENTS||{}).forEach(id=>ensure('statuses',id,false));

  try{
    const pool=(typeof getUpgradePool==='function') ? getUpgradePool() : [];
    pool.forEach(r=>ensure('artifacts',r?.id||r?.name,false));
  }catch(_){/* ignore artifact unlock errors */}

  try{
    const mutCatalog=(typeof Avian?.mutations?.getCatalog==='function')?Avian.mutations.getCatalog():(Avian?.data?.mutations?.byId||{});
    Object.keys(mutCatalog).forEach(id=>ensure('mutations',id,false));
  }catch(_){/* ignore mutation unlock errors */}

  Object.keys(COMBAT_ITEM_CATALOG||{}).forEach(key=>{
    const def=COMBAT_ITEM_CATALOG[key];
    if(def?.itemKey) ensure('items',def.itemKey,false);
  });
}

// ============================================================
//  DEV CODE
// ============================================================
function checkDevCode(val) {
  const msg = document.getElementById('dev-code-msg');
  const code=(val||'').trim().toLowerCase();
  const allUnlockIds=['stage20','stage40','crit100Run','buff250Run','debuff250Run','fletchlingWin','juvenileWin','predatorWin','easyWin','normalWin','hardWin','unlock_hummingbird','unlock_shoebill','unlock_secretary','unlock_magpie','unlock_kookaburra','unlock_peregrine','unlock_harpy','unlock_ostrich','unlock_kiwi','unlock_lyrebird','unlock_toucan','unlock_penguin','unlock_emu','unlock_swan','unlock_flamingo','unlock_seagull','unlock_albatross','unlock_duke_blakiston'];
  if (code === 'birdwatching') {
    const u = getUnlocks();
    allUnlockIds.forEach(id => { u[id] = true; });
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(u));
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) { msg.textContent = '🔓 Birdwatching: all birds unlocked (including Emu)!'; msg.style.color = 'var(--gold-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    initSelectionSafe();
    return;
  }
  if (code === 'headinghome') {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({}));
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) { msg.textContent = '🔒 Headinghome: unlockable birds locked again.'; msg.style.color = 'var(--red-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    initSelectionSafe();
    return;
  }
  if (code === 'blakiston') {
    const u=getUnlocks();
    u.unlock_duke_blakiston=true;
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(u));
    try { localStorage.setItem('blakiston_debug_unlocked', '1'); } catch(_) {}
    window.__blakistonDebugUnlocked = true;
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) { msg.textContent = '🦉 Duke Blakiston unlocked as a playable bird.'; msg.style.color = 'var(--gold-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    initSelectionSafe();
    return;
  }
  if (code === 'reference') {
    unlockAllCodexEntries();
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) { msg.textContent = '📖 Reference: all Codex entries unlocked for browsing.'; msg.style.color = 'var(--gold-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    renderReferenceGuide();
    return;
  }
  if (code === 'buildnest') {
    try { localStorage.setItem('avian_buildnest_unlocked', '1'); } catch(_) {}
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) { msg.textContent = '🪺 Build Nest unlocked — map forge available in the war room.'; msg.style.color = 'var(--gold-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    syncBuildNestUnlockUI();
    initSelectionSafe();
    return;
  }
  if (code === 'goldengoose') {
    if (typeof addSavedEggs === 'function') addSavedEggs(9999);
    if (typeof addGoldenGooseEggs === 'function') addGoldenGooseEggs(9000);
    const input = document.getElementById('dev-code-input');
    if (input) input.value = '';
    if (msg) {
      msg.textContent = '🪿 GoldenGoose: +9999 Saved Eggs and +9000 Golden Goose Eggs!';
      msg.style.color = 'var(--gold-light)';
    }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 3200);
    if (typeof syncFortuneBalances === 'function') syncFortuneBalances();
    if (typeof renderFortuneInventory === 'function') renderFortuneInventory();
    return;
  }
  if (val.length >= 10) {
    if (msg) { msg.textContent = 'Invalid code.'; msg.style.color = 'var(--red-light)'; }
    setTimeout(() => { if (msg) msg.textContent = ''; }, 1800);
  }
}

const ACCESS_KEY='avian_accessibility_v1';
const MUSIC_SETTINGS_KEY='avian_music_v1';
const THEME_BGM_DEFAULT_VOLUME_PCT=50;
const THEME_BGM_RUN_START_FADE_MS=1400;
const DUKE_BGM_FADE_IN_MS=1200;
const DUKE_BGM_FADE_OUT_MS=1400;
let _themeBgmFadeRaf=null;
let _themeBgmFadeActive=false;
let _dukeBgmFadeRaf=null;
let _dukeBgmFadeActive=false;
let _dukeBgmFadeOutActive=false;
function cancelThemeBgmFade(){
  if(_themeBgmFadeRaf!=null){
    cancelAnimationFrame(_themeBgmFadeRaf);
    _themeBgmFadeRaf=null;
  }
  _themeBgmFadeActive=false;
  applyThemeMusicToAudioEl();
}
/** Smoothly lower menu theme volume when starting a new run (Take Flight); avoids an abrupt cut when battle screen mounts. */
function beginThemeBgmFadeOutForRunStart(durationMs=THEME_BGM_RUN_START_FADE_MS){
  cancelThemeBgmFade();
  const el=getThemeBgmAudio();
  if(!el||el.muted) return;
  const fromVol=Number(el.volume)||0;
  if(fromVol<=0.001||el.paused) return;
  _themeBgmFadeActive=true;
  const t0=performance.now();
  const dur=Math.max(200,Number(durationMs)||THEME_BGM_RUN_START_FADE_MS);
  function tick(now){
    if(!_themeBgmFadeActive){ _themeBgmFadeRaf=null; return; }
    const u=Math.min(1,(now-t0)/dur);
    el.volume=Math.max(0,fromVol*(1-u));
    if(u>=1){
      el.pause();
      _themeBgmFadeActive=false;
      _themeBgmFadeRaf=null;
      applyThemeMusicToAudioEl();
      return;
    }
    _themeBgmFadeRaf=requestAnimationFrame(tick);
  }
  _themeBgmFadeRaf=requestAnimationFrame(tick);
}
function getMusicSettings(){
  try{
    const raw=JSON.parse(localStorage.getItem(MUSIC_SETTINGS_KEY)||'{}');
    const vol=Number(raw.volume);
    const cfg=getAccessibilitySettings();
    return{
      muted:!!raw.muted,
      volume:Number.isFinite(vol)?Math.max(0,Math.min(100,vol)):(Number(cfg.audio?.music)||THEME_BGM_DEFAULT_VOLUME_PCT),
    };
  }catch(_){
    const cfg=getAccessibilitySettings();
    return{muted:false,volume:Number(cfg.audio?.music)||THEME_BGM_DEFAULT_VOLUME_PCT};
  }
}
function saveMusicSettings(s){
  try{
    localStorage.setItem(MUSIC_SETTINGS_KEY,JSON.stringify({
      muted:!!s.muted,
      volume:Math.max(0,Math.min(100,Number(s.volume)||THEME_BGM_DEFAULT_VOLUME_PCT)),
    }));
  }catch(_){}
}
function getThemeBgmAudio(){
  return document.getElementById('theme-bgm-audio');
}
function getDukeBattleBgmAudio(){
  return document.getElementById('duke-battle-bgm-audio');
}
function cancelDukeBgmFade(){
  if(_dukeBgmFadeRaf!=null){
    cancelAnimationFrame(_dukeBgmFadeRaf);
    _dukeBgmFadeRaf=null;
  }
  _dukeBgmFadeActive=false;
  _dukeBgmFadeOutActive=false;
}
function getDukeBgmTargetVolume(){
  const s=getMusicSettings();
  const mult=getAudioVolumeMultipliers();
  return s.muted?0:Math.max(0,Math.min(1,s.volume/100*mult.masterMusic));
}
function primeDukeBattleBgmAudio(){
  const el=getDukeBattleBgmAudio();
  if(!el||el.dataset.dukePrimed==='1') return;
  el.dataset.dukePrimed='1';
  try{ el.load(); }catch(_){}
}
function stopDukeBattleBgmImmediate(){
  cancelDukeBgmFade();
  const el=getDukeBattleBgmAudio();
  if(!el) return;
  try{ el.pause(); el.currentTime=0; }catch(_){}
  applyDukeBattleBgmToAudioEl();
}
function stopDukeBattleBgm(){
  stopDukeBattleBgmImmediate();
}
function duckThemeBgmForBattle(){
  cancelThemeBgmFade();
  const theme=getThemeBgmAudio();
  if(theme){
    try{ theme.pause(); }catch(_){}
  }
}
function beginDukeBattleBgmFadeIn(durationMs=DUKE_BGM_FADE_IN_MS){
  const el=getDukeBattleBgmAudio();
  if(!el) return;
  const target=getDukeBgmTargetVolume();
  if(target<=0.001){
    stopDukeBattleBgmImmediate();
    return;
  }
  cancelDukeBgmFade();
  _dukeBgmFadeActive=true;
  el.muted=false;
  el.volume=0;
  const t0=performance.now();
  const dur=Math.max(200,Number(durationMs)||DUKE_BGM_FADE_IN_MS);
  try{ el.currentTime=0; el.play().catch(()=>{}); }catch(_){}
  function tick(now){
    if(!_dukeBgmFadeActive){ _dukeBgmFadeRaf=null; return; }
    const u=Math.min(1,(now-t0)/dur);
    el.volume=Math.max(0,target*u);
    if(u>=1){
      el.volume=target;
      _dukeBgmFadeActive=false;
      _dukeBgmFadeRaf=null;
      return;
    }
    _dukeBgmFadeRaf=requestAnimationFrame(tick);
  }
  _dukeBgmFadeRaf=requestAnimationFrame(tick);
}
function beginDukeBattleBgmFadeOut(onDone, durationMs=DUKE_BGM_FADE_OUT_MS){
  const el=getDukeBattleBgmAudio();
  if(!el){
    if(typeof onDone==='function') onDone();
    return;
  }
  if(el.paused){
    if(typeof onDone==='function') onDone();
    return;
  }
  cancelDukeBgmFade();
  _dukeBgmFadeOutActive=true;
  _dukeBgmFadeActive=true;
  const fromVol=Number(el.volume)||getDukeBgmTargetVolume();
  const t0=performance.now();
  const dur=Math.max(200,Number(durationMs)||DUKE_BGM_FADE_OUT_MS);
  function tick(now){
    if(!_dukeBgmFadeActive){ _dukeBgmFadeRaf=null; _dukeBgmFadeOutActive=false; return; }
    const u=Math.min(1,(now-t0)/dur);
    el.volume=Math.max(0,fromVol*(1-u));
    if(u>=1){
      try{ el.pause(); el.currentTime=0; }catch(_){}
      _dukeBgmFadeActive=false;
      _dukeBgmFadeOutActive=false;
      _dukeBgmFadeRaf=null;
      applyDukeBattleBgmToAudioEl();
      if(typeof onDone==='function') onDone();
      return;
    }
    _dukeBgmFadeRaf=requestAnimationFrame(tick);
  }
  _dukeBgmFadeRaf=requestAnimationFrame(tick);
}
function isDukeStoryBossFight(){
  if(G.endlessMode) return false;
  const st=getEncounterStage();
  if(st!==STORY_DUKE_STAGE) return false;
  const id=String(G.enemy?.id||'').toLowerCase();
  if(id==='duke_blakiston') return true;
  if(String(G.enemy?.aiType||'')==='boss_duke') return true;
  return false;
}
function tryStartDukeBattleBgmIfNeeded(){
  if(!isDukeStoryBossFight()){
    stopDukeBattleBgmImmediate();
    return;
  }
  const el=getDukeBattleBgmAudio();
  if(!el||getMusicSettings().muted){
    stopDukeBattleBgmImmediate();
    return;
  }
  if(_dukeBgmFadeActive&&!_dukeBgmFadeOutActive) return;
  if(!el.paused&&!_dukeBgmFadeOutActive){
    const target=getDukeBgmTargetVolume();
    if(Math.abs(Number(el.volume)-target)<0.02) return;
  }
  duckThemeBgmForBattle();
  primeDukeBattleBgmAudio();
  beginDukeBattleBgmFadeIn();
}
/** Call once so the browser fetches/decodes the MP3 (hidden via clip, not display:none). */
function primeThemeBgmAudio(){
  const el=getThemeBgmAudio();
  if(!el||el.dataset.themePrimed==='1') return;
  el.dataset.themePrimed='1';
  try{ el.load(); }catch(_){}
}
function tryPlayThemeBgmForCurrentMenuScreen(){
  const el=getThemeBgmAudio();
  if(!el||getMusicSettings().muted) return;
  const scr=document.querySelector('.screen.active');
  if(!scr||(scr.id!=='screen-start'&&scr.id!=='screen-select')) return;
  primeThemeBgmAudio();
  applyThemeMusicToAudioEl();
  el.play().catch(()=>{});
}
function applyDukeBattleBgmToAudioEl(){
  const el=getDukeBattleBgmAudio();
  if(!el) return;
  const s=getMusicSettings();
  const mult=getAudioVolumeMultipliers();
  el.volume=Math.max(0,Math.min(1,s.volume/100*mult.masterMusic));
  el.muted=!!s.muted;
}
function applyThemeMusicToAudioEl(){
  const el=getThemeBgmAudio();
  if(!el) return;
  const s=getMusicSettings();
  const mult=getAudioVolumeMultipliers();
  el.volume=Math.max(0,Math.min(1,s.volume/100*mult.masterMusic));
  el.muted=!!s.muted;
  applyDukeBattleBgmToAudioEl();
}
function stopAllGameAudio(){
  cancelThemeBgmFade();
  cancelDukeBgmFade();
  const theme=getThemeBgmAudio();
  const duke=getDukeBattleBgmAudio();
  if(theme){ try{ theme.pause(); theme.currentTime=0; }catch(_){} }
  if(duke){ try{ duke.pause(); duke.currentTime=0; }catch(_){} }
  const ctx=getAudioCtx();
  if(ctx && ctx.state==='running'){ try{ ctx.suspend(); }catch(_){} }
}
globalThis.stopAllGameAudio=stopAllGameAudio;
function syncThemeMusicButtonLabels(){
  const s=getMusicSettings();
  const icon=s.muted?'🔇':'🔊';
  const start=document.getElementById('theme-music-btn-start');
  const sel=document.getElementById('theme-music-btn-select');
  [start,sel].forEach(b=>{
    if(!b) return;
    b.textContent=icon;
    b.setAttribute('aria-label',s.muted?'Unmute menu music':'Mute menu music');
    b.title=s.muted?'Menu music (muted)':'Menu music';
  });
}
function syncThemeBgmPlaybackForScreen(screenId){
  if(screenId!=='screen-battle'&&!_dukeBgmFadeOutActive) stopDukeBattleBgmImmediate();
  const el=getThemeBgmAudio();
  if(!el) return;
  const onMenu=screenId==='screen-start'||screenId==='screen-select';
  if(!onMenu){
    if(_themeBgmFadeActive) return;
    try{ el.pause(); }catch(_){}
    return;
  }
  cancelThemeBgmFade();
  tryPlayThemeBgmForCurrentMenuScreen();
}
function toggleThemeMusicMuted(){
  const s=getMusicSettings();
  s.muted=!s.muted;
  saveMusicSettings(s);
  applyThemeMusicToAudioEl();
  syncThemeMusicButtonLabels();
  const mm=document.getElementById('setting-music-muted');
  if(mm) mm.checked=!!s.muted;
  const active=document.querySelector('.screen.active');
  if(active&&(active.id==='screen-start'||active.id==='screen-select')){
    tryPlayThemeBgmForCurrentMenuScreen();
  }else if(active?.id==='screen-battle'&&isDukeStoryBossFight()){
    tryStartDukeBattleBgmIfNeeded();
  }
}
function updateMusicSettingsFromControls(){
  const volEl=document.getElementById('setting-music-volume');
  const muteEl=document.getElementById('setting-music-muted');
  const s={
    volume:Number(volEl?.value)||THEME_BGM_DEFAULT_VOLUME_PCT,
    muted:!!muteEl?.checked,
  };
  saveMusicSettings(s);
  applyThemeMusicToAudioEl();
  syncThemeMusicButtonLabels();
  const active=document.querySelector('.screen.active');
  if(active&&(active.id==='screen-start'||active.id==='screen-select')){
    tryPlayThemeBgmForCurrentMenuScreen();
  }else if(active?.id==='screen-battle'&&isDukeStoryBossFight()){
    tryStartDukeBattleBgmIfNeeded();
  }
}
function wireThemeBgmAutoplayUnlock(){
  const detach=()=>{
    document.removeEventListener('pointerdown',onUserAct,true);
    document.removeEventListener('click',onUserAct,true);
    document.removeEventListener('keydown',onUserAct,true);
  };
  const onUserAct=(e)=>{
    if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ') return;
    detach();
    tryPlayThemeBgmForCurrentMenuScreen();
  };
  document.addEventListener('pointerdown',onUserAct,{capture:true});
  document.addEventListener('click',onUserAct,{capture:true});
  document.addEventListener('keydown',onUserAct,{capture:true});
}
globalThis.toggleThemeMusicMuted=toggleThemeMusicMuted;
globalThis.updateMusicSettingsFromControls=updateMusicSettingsFromControls;

function detectPreferredUIMode(){
  const narrow=typeof window!=='undefined' && window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  const touch=(typeof navigator!=='undefined' && (navigator.maxTouchPoints||0)>0);
  if(narrow || (touch && typeof window!=='undefined' && window.innerWidth<1024)) return 'mobile';
  return 'desktop';
}
function resolveUiMode(cfg){
  const c=cfg||getAccessibilitySettings();
  if(c.uiAutoDetect!==false) return detectPreferredUIMode();
  return (c.uiMode==='desktop')?'desktop':'mobile';
}
const COMBAT_ARRANGEMENTS=['classic','compact','actionsFirst','logFocus','custom'];
const DEFAULT_COMBAT_ARRANGEMENT='classic';
const COMBAT_ARRANGEMENT_HINTS={
  classic:'Original: birds side by side, then actions and battle log.',
  compact:'Compact: stacked layout with smaller panels — good for phones or tight screens.',
  actionsFirst:'Actions First: ability tray above birds so you can act without scrolling.',
  logFocus:'Log Focus: tall battle log beside the fight on wide screens; taller log when narrow.',
  custom:'Custom: reorder panels and hide sections via Customize panels… in Settings → Display.',
};
const COMBAT_PANEL_DEFS=[
  {id:'topbar', label:'Top bar (menu & stage)'},
  {id:'stageProgress', label:'Stage progress bar'},
  {id:'encounterPreview', label:'Encounter preview'},
  {id:'exp', label:'EXP bar'},
  {id:'player', label:'Your bird'},
  {id:'enemy', label:'Enemy'},
  {id:'actions', label:'Actions'},
  {id:'log', label:'Battle log'},
];
const COMBAT_PANEL_IDS=COMBAT_PANEL_DEFS.map(d=>d.id);
const DEFAULT_COMBAT_CUSTOM_LAYOUT={
  order:COMBAT_PANEL_IDS.slice(),
  visible:Object.fromEntries(COMBAT_PANEL_IDS.map(id=>[id,true])),
};
function normalizeCombatCustomLayout(raw){
  const d=DEFAULT_COMBAT_CUSTOM_LAYOUT;
  const r=raw&&typeof raw==='object'?raw:{};
  const order=[];
  const seen=new Set();
  (Array.isArray(r.order)?r.order:[]).forEach(pid=>{
    const id=String(pid||'');
    if(!COMBAT_PANEL_IDS.includes(id)||seen.has(id)) return;
    seen.add(id);
    order.push(id);
  });
  COMBAT_PANEL_IDS.forEach(id=>{if(!seen.has(id)) order.push(id);});
  const visIn=r.visible&&typeof r.visible==='object'?r.visible:{};
  const visible=Object.assign({}, d.visible);
  COMBAT_PANEL_IDS.forEach(id=>{
    if(visIn[id]!=null) visible[id]=!!visIn[id];
  });
  visible.topbar=true;
  return {order, visible};
}
let _combatCustomDraft=null;
function resetCombatCustomDraft(){
  _combatCustomDraft=null;
}
function getCombatCustomDraft(){
  if(!_combatCustomDraft){
    const cfg=getAccessibilitySettings();
    _combatCustomDraft=normalizeCombatCustomLayout(cfg.combatCustomLayout);
  }
  return _combatCustomDraft;
}
function normalizeCombatArrangement(raw){
  const id=String(raw||'').toLowerCase();
  return COMBAT_ARRANGEMENTS.includes(id)?id:DEFAULT_COMBAT_ARRANGEMENT;
}
const DEFAULT_COMBAT_LAYOUT={avatarScale:100,combatantsScale:100,actionTrayScale:100,battleLogScale:100};
function normalizeCombatLayout(raw){
  const d=DEFAULT_COMBAT_LAYOUT;
  const r=raw&&typeof raw==='object'?raw:{};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||100));
  return {
    avatarScale:clamp(r.avatarScale,70,130),
    combatantsScale:clamp(r.combatantsScale,70,130),
    actionTrayScale:clamp(r.actionTrayScale,70,130),
    battleLogScale:clamp(r.battleLogScale,70,150),
  };
}
function normalizeAccessibilitySettings(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  let musicVol=THEME_BGM_DEFAULT_VOLUME_PCT;
  try{
    const leg=JSON.parse(localStorage.getItem(MUSIC_SETTINGS_KEY)||'{}');
    if(Number.isFinite(Number(leg.volume))) musicVol=Number(leg.volume);
  }catch(_){}
  const audio=Object.assign({master:100,music:musicVol,sfx:100}, raw.audio||{});
  if(raw.musicVolume!=null && raw.audio?.music==null) audio.music=Number(raw.musicVolume)||musicVol;
  return {
    fontSize:Number(raw.fontSize)||100,
    colorBlind:String(raw.colorBlind||'off'),
    reduceMotion:!!raw.reduceMotion,
    highContrast:!!raw.highContrast,
    uiMode:(raw.uiMode==='desktop')?'desktop':'mobile',
    uiAutoDetect:raw.uiAutoDetect!==false,
    combatLayout:normalizeCombatLayout(raw.combatLayout),
    combatArrangement:normalizeCombatArrangement(raw.combatArrangement),
    combatCustomLayout:normalizeCombatCustomLayout(raw.combatCustomLayout),
    audio,
    tooltips:{...DEFAULT_TOOLTIP_SETTINGS, ...(raw.tooltips||{})},
  };
}
function getAccessibilitySettings(){
  try{
    const raw=JSON.parse(localStorage.getItem(ACCESS_KEY)||'{}');
    return normalizeAccessibilitySettings(raw);
  }catch(_){
    return normalizeAccessibilitySettings({});
  }
}
function bootstrapAccessibilityDefaults(){
  let raw=null;
  try{ raw=JSON.parse(localStorage.getItem(ACCESS_KEY)||'null'); }catch(_){}
  if(!raw || typeof raw!=='object'){
    const uiMode=detectPreferredUIMode();
    const cfg=normalizeAccessibilitySettings({
      uiMode,
      uiAutoDetect:true,
      fontSize:uiMode==='mobile'?115:100,
    });
    localStorage.setItem(ACCESS_KEY, JSON.stringify(cfg));
    return;
  }
  if(raw.uiMode==null || raw.uiMode===''){
    raw.uiMode=detectPreferredUIMode();
    raw.uiAutoDetect=raw.uiAutoDetect!==false;
    localStorage.setItem(ACCESS_KEY, JSON.stringify(normalizeAccessibilitySettings(raw)));
  }
}
let _uiAutoDetectResizeTimer=null;
function wireUiAutoDetectResize(){
  if(typeof window==='undefined' || window._uiAutoDetectWired) return;
  window._uiAutoDetectWired=true;
  window.addEventListener('resize', ()=>{
    clearTimeout(_uiAutoDetectResizeTimer);
    _uiAutoDetectResizeTimer=setTimeout(()=>{
      const cfg=getAccessibilitySettings();
      if(!cfg.uiAutoDetect) return;
      const next=detectPreferredUIMode();
      if(resolveUiMode(cfg)===next) return;
      cfg.uiMode=next;
      localStorage.setItem(ACCESS_KEY, JSON.stringify(cfg));
      applyAccessibilitySettings(cfg);
      const ui=document.getElementById('setting-ui-mode');
      if(ui) ui.value=next;
    }, 200);
  });
}
function getAudioVolumeMultipliers(){
  const cfg=getAccessibilitySettings();
  const a=cfg.audio||{};
  const master=Math.max(0, Math.min(1, (Number(a.master)||100)/100));
  const sfx=Math.max(0, Math.min(1, (Number(a.sfx)||100)/100));
  const music=Math.max(0, Math.min(1, (Number(a.music)||100)/100));
  return {master, sfx, music, masterSfx:master*sfx, masterMusic:master*music};
}
function selectSettingsTab(ev){
  const btn=ev?.target?.closest?.('[data-settings-tab]');
  if(!btn) return;
  const tab=btn.dataset.settingsTab;
  document.querySelectorAll('.settings-tab').forEach(t=>{
    t.classList.toggle('active', t===btn || t.dataset.settingsTab===tab);
  });
  document.querySelectorAll('.settings-panel').forEach(p=>{
    p.classList.toggle('active', p.dataset.settingsPanel===tab);
  });
}
globalThis.selectSettingsTab=selectSettingsTab;
function applyUIStateToDOM(){
  const ui=ensureUIState();
  const main=document.getElementById('endless-check');
  if(main) main.checked=(ui.gameMode==='endless');
  document.body.classList.toggle('ui-mobile-mode', ui.battleLayout==='mobile');
  document.body.classList.toggle('ui-desktop-mode', ui.battleLayout==='desktop');
  if (document.getElementById('screen-battle')?.classList.contains('active') && typeof updateBattleArena === 'function') {
    updateBattleArena();
  }
  const playerDrop=document.getElementById('player-stats-drop');
  const enemyDrop=document.getElementById('enemy-stats-drop');
  if(playerDrop) playerDrop.open=!!ui.combatDropdownOpen.player;
  if(enemyDrop) enemyDrop.open=!!ui.combatDropdownOpen.enemy;
}
function syncCombatDropdownUIState(){
  const ui=ensureUIState();
  const playerDrop=document.getElementById('player-stats-drop');
  const enemyDrop=document.getElementById('enemy-stats-drop');
  if(playerDrop) ui.combatDropdownOpen.player=!!playerDrop.open;
  if(enemyDrop) ui.combatDropdownOpen.enemy=!!enemyDrop.open;
}

function wireCombatDropdownStateSync(){
  ['player-stats-drop','enemy-stats-drop'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el || el.dataset.uiStateWired==='1') return;
    el.dataset.uiStateWired='1';
    el.addEventListener('toggle', ()=>syncCombatDropdownUIState());
  });
}
function applyCombatLayoutSettings(cfg){
  const cl=normalizeCombatLayout(cfg?.combatLayout);
  const battle=document.getElementById('screen-battle');
  if(!battle) return;
  battle.style.setProperty('--combat-avatar-scale', String(cl.avatarScale));
  battle.style.setProperty('--combat-combatants-scale', String(cl.combatantsScale));
  battle.style.setProperty('--combat-action-scale', String(cl.actionTrayScale));
  battle.style.setProperty('--combat-log-scale', String(cl.battleLogScale));
}
function clearCombatCustomPanelStyles(){
  const battle=document.getElementById('screen-battle');
  if(!battle) return;
  battle.querySelectorAll('[data-combat-panel]').forEach(el=>{
    el.classList.remove('combat-panel-hidden');
    el.style.order='';
  });
}
function applyCombatCustomPanels(raw){
  const battle=document.getElementById('screen-battle');
  if(!battle) return;
  const layout=normalizeCombatCustomLayout(raw);
  clearCombatCustomPanelStyles();
  layout.order.forEach((pid,idx)=>{
    const el=battle.querySelector('[data-combat-panel="'+pid+'"]');
    if(!el) return;
    el.style.order=String(idx);
    if(layout.visible[pid]===false) el.classList.add('combat-panel-hidden');
  });
}
function syncCombatCustomEditRow(arrId){
  const id=arrId!=null?String(arrId):normalizeCombatArrangement(getAccessibilitySettings().combatArrangement);
  const show=id==='custom';
  const row=document.getElementById('setting-combat-custom-edit-row');
  if(row) row.style.display=show?'block':'none';
}
function renderCombatCustomPanelEditor(){
  const list=document.getElementById('combat-custom-panel-list');
  if(!list) return;
  const draft=getCombatCustomDraft();
  const defs=Object.fromEntries(COMBAT_PANEL_DEFS.map(d=>[d.id,d]));
  list.textContent='';
  draft.order.forEach((pid,idx)=>{
    const def=defs[pid]||{id:pid,label:pid};
    const row=document.createElement('div');
    row.className='combat-custom-panel-row';
    row.setAttribute('role','listitem');
    const label=document.createElement('span');
    label.className='combat-custom-panel-label';
    label.textContent=def.label;
    row.appendChild(label);
    if(pid==='topbar'){
      const note=document.createElement('span');
      note.className='settings-hint';
      note.textContent='Always visible';
      row.appendChild(note);
    }else{
      const lab=document.createElement('label');
      lab.className='combat-custom-panel-show';
      const cb=document.createElement('input');
      cb.type='checkbox';
      cb.checked=draft.visible[pid]!==false;
      cb.dataset.panelId=pid;
      cb.dataset.change='toggleCombatCustomPanelVisible';
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' Show'));
      row.appendChild(lab);
    }
    const moves=document.createElement('div');
    moves.className='combat-custom-panel-moves';
    const up=document.createElement('button');
    up.type='button';
    up.className='menu-btn';
    up.textContent='↑';
    up.disabled=idx===0;
    up.dataset.action='moveCombatCustomPanel:up';
    up.dataset.combatDraftId=pid;
    const down=document.createElement('button');
    down.type='button';
    down.className='menu-btn';
    down.textContent='↓';
    down.disabled=idx===draft.order.length-1;
    down.dataset.action='moveCombatCustomPanel:down';
    down.dataset.combatDraftId=pid;
    moves.appendChild(up);
    moves.appendChild(down);
    row.appendChild(moves);
    list.appendChild(row);
  });
}
function openCombatCustomLayoutModal(){
  resetCombatCustomDraft();
  renderCombatCustomPanelEditor();
  const m=document.getElementById('combat-custom-layout-modal');
  if(m) m.classList.add('open');
}
function closeCombatCustomLayoutModal(){
  resetCombatCustomDraft();
  const m=document.getElementById('combat-custom-layout-modal');
  if(m) m.classList.remove('open');
}
function saveCombatCustomLayoutFromModal(){
  const prev=getAccessibilitySettings();
  const draft=normalizeCombatCustomLayout(getCombatCustomDraft());
  const cfg=Object.assign({}, prev, {combatArrangement:'custom', combatCustomLayout:draft});
  localStorage.setItem(ACCESS_KEY, JSON.stringify(normalizeAccessibilitySettings(cfg)));
  resetCombatCustomDraft();
  closeCombatCustomLayoutModal();
  const arrSel=document.getElementById('setting-combat-arrangement');
  if(arrSel) arrSel.value='custom';
  applyAccessibilitySettings(getAccessibilitySettings());
}
function resetCombatCustomLayoutDraft(){
  _combatCustomDraft=normalizeCombatCustomLayout(null);
  renderCombatCustomPanelEditor();
}
function toggleCombatCustomPanelVisible(checked, ev){
  const pid=ev?.target?.dataset?.panelId;
  if(!pid||pid==='topbar') return;
  const draft=getCombatCustomDraft();
  draft.visible[pid]=!!checked;
  renderCombatCustomPanelEditor();
}
function moveCombatCustomPanel(dir, ev){
  const pid=ev?.target?.closest?.('[data-combat-draft-id]')?.dataset?.combatDraftId;
  if(!pid) return;
  const draft=getCombatCustomDraft();
  const o=draft.order;
  const i=o.indexOf(pid);
  if(i<0) return;
  const j=(dir==='up')?i-1:i+1;
  if(j<0||j>=o.length) return;
  o.splice(i,1);
  o.splice(j,0,pid);
  renderCombatCustomPanelEditor();
}
globalThis.openCombatCustomLayoutModal=openCombatCustomLayoutModal;
globalThis.closeCombatCustomLayoutModal=closeCombatCustomLayoutModal;
globalThis.saveCombatCustomLayoutFromModal=saveCombatCustomLayoutFromModal;
globalThis.resetCombatCustomLayoutDraft=resetCombatCustomLayoutDraft;
globalThis.toggleCombatCustomPanelVisible=toggleCombatCustomPanelVisible;
globalThis.moveCombatCustomPanel=moveCombatCustomPanel;
function applyCombatArrangement(cfg){
  const battle=document.getElementById('screen-battle');
  if(!battle) return;
  const id=normalizeCombatArrangement(cfg?.combatArrangement);
  COMBAT_ARRANGEMENTS.forEach(k=>battle.classList.remove('combat-arr--'+k));
  battle.classList.add('combat-arr--'+id);
  clearCombatCustomPanelStyles();
  if(id==='custom') applyCombatCustomPanels(cfg?.combatCustomLayout);
  syncCombatCustomEditRow(id);
  const hint=document.getElementById('setting-combat-arrangement-hint');
  if(hint) hint.textContent=COMBAT_ARRANGEMENT_HINTS[id]||COMBAT_ARRANGEMENT_HINTS.classic;
  const sel=document.getElementById('setting-combat-arrangement');
  if(sel) sel.value=id;
}
function syncCombatLayoutLabels(cl){
  const c=normalizeCombatLayout(cl);
  const pairs=[
    ['setting-combat-avatar-val',c.avatarScale],
    ['setting-combat-combatants-val',c.combatantsScale],
    ['setting-combat-action-val',c.actionTrayScale],
    ['setting-combat-log-val',c.battleLogScale],
  ];
  pairs.forEach(([id,pct])=>{const el=document.getElementById(id);if(el)el.textContent=`${pct}%`;});
}
function syncUiModeControls(cfg){
  const effective=resolveUiMode(cfg);
  const ui=document.getElementById('setting-ui-mode');
  const uiAuto=document.getElementById('setting-ui-auto-detect');
  const hint=document.getElementById('setting-ui-mode-hint');
  if(ui){
    ui.value=effective;
    ui.disabled=!!(uiAuto&&uiAuto.checked);
  }
  if(hint){
    hint.textContent=(uiAuto&&uiAuto.checked)
      ? 'Auto-detect is choosing the layout from your screen size.'
      : 'Pick compact mobile or desktop battle and war-room layout.';
  }
}
function applyAccessibilitySettings(s){
  const cfg=s||getAccessibilitySettings();
  document.documentElement.style.fontSize=`${Math.max(85,Math.min(140,Number(cfg.fontSize)||100))}%`;
  document.body.classList.toggle('reduce-motion', !!cfg.reduceMotion);
  document.body.classList.toggle('high-contrast', !!cfg.highContrast);
  ['cb-protanopia','cb-deuteranopia','cb-tritanopia'].forEach(c=>document.body.classList.remove(c));
  if(cfg.colorBlind==='protanopia') document.body.classList.add('cb-protanopia');
  if(cfg.colorBlind==='deuteranopia') document.body.classList.add('cb-deuteranopia');
  if(cfg.colorBlind==='tritanopia') document.body.classList.add('cb-tritanopia');
  const mode=resolveUiMode(cfg);
  ensureUIState().battleLayout=(mode==='mobile')?'mobile':'desktop';
  applyUIStateToDOM();
  applyCombatLayoutSettings(cfg);
  applyCombatArrangement(cfg);
  syncUiModeControls(cfg);
  syncCombatLayoutLabels(cfg.combatLayout);
}
function openSettingsModal(){
  const cfg=getAccessibilitySettings();
  const font=document.getElementById('setting-font-size');
  const cb=document.getElementById('setting-color-blind');
  const rm=document.getElementById('setting-reduce-motion');
  const hc=document.getElementById('setting-high-contrast');
  const ui=document.getElementById('setting-ui-mode');
  const uiAuto=document.getElementById('setting-ui-auto-detect');
  if(font) font.value=String(cfg.fontSize||100);
  if(cb) cb.value=cfg.colorBlind||'off';
  if(rm) rm.checked=!!cfg.reduceMotion;
  if(hc) hc.checked=!!cfg.highContrast;
  if(uiAuto) uiAuto.checked=cfg.uiAutoDetect!==false;
  const arrSel=document.getElementById('setting-combat-arrangement');
  if(arrSel) arrSel.value=normalizeCombatArrangement(cfg.combatArrangement);
  syncCombatCustomEditRow(cfg.combatArrangement);
  syncUiModeControls(cfg);
  applyCombatArrangement(cfg);
  const cl=normalizeCombatLayout(cfg.combatLayout);
  const setRange=(id,val)=>{const el=document.getElementById(id);if(el)el.value=String(val);};
  setRange('setting-combat-avatar-scale',cl.avatarScale);
  setRange('setting-combat-combatants-scale',cl.combatantsScale);
  setRange('setting-combat-action-scale',cl.actionTrayScale);
  setRange('setting-combat-log-scale',cl.battleLogScale);
  const ms=getMusicSettings();
  const a=cfg.audio||{};
  const master=document.getElementById('setting-master-volume');
  const mv=document.getElementById('setting-music-volume');
  const sv=document.getElementById('setting-sfx-volume');
  const mm=document.getElementById('setting-music-muted');
  if(master) master.value=String(a.master??100);
  if(mv) mv.value=String(a.music??ms.volume);
  if(sv) sv.value=String(a.sfx??100);
  if(mm) mm.checked=!!ms.muted;
  const tt=cfg.tooltips||DEFAULT_TOOLTIP_SETTINGS;
  const ttAb=document.getElementById('setting-tt-abilities');
  const ttMut=document.getElementById('setting-tt-mutations');
  const ttItems=document.getElementById('setting-tt-items');
  const ttPass=document.getElementById('setting-tt-passives');
  if(ttAb) ttAb.checked=tt.abilities!==false;
  if(ttMut) ttMut.checked=tt.mutations!==false;
  if(ttItems) ttItems.checked=tt.items!==false;
  if(ttPass) ttPass.checked=tt.passives!==false;
  const m=document.getElementById('settings-modal'); if(m) m.classList.add('open');
}
function closeSettingsModal(){
  const m=document.getElementById('settings-modal'); if(m) m.classList.remove('open');
  notifyOwUiEmbedClose();
}
function returnToWarRoomFromSettings(){
  closeSettingsModal();
  showScreen('screen-select');
  if(typeof initSelectionSafe==='function') initSelectionSafe();
}
globalThis.returnToWarRoomFromSettings = returnToWarRoomFromSettings;
function resetCombatLayoutSettings(){
  const prev=getAccessibilitySettings();
  const cfg=Object.assign({}, prev, {combatLayout:Object.assign({}, DEFAULT_COMBAT_LAYOUT)});
  localStorage.setItem(ACCESS_KEY, JSON.stringify(cfg));
  applyAccessibilitySettings(cfg);
  openSettingsModal();
}
globalThis.resetCombatLayoutSettings=resetCombatLayoutSettings;
function updateAccessibilitySettings(){
  const prev=getAccessibilitySettings();
  const uiAutoDetect=!!document.getElementById('setting-ui-auto-detect')?.checked;
  const manualUiMode=String(document.getElementById('setting-ui-mode')?.value||ensureUIState().battleLayout);
  const cfg={
    fontSize:Number(document.getElementById('setting-font-size')?.value||100),
    colorBlind:String(document.getElementById('setting-color-blind')?.value||'off'),
    reduceMotion:!!document.getElementById('setting-reduce-motion')?.checked,
    highContrast:!!document.getElementById('setting-high-contrast')?.checked,
    uiMode:manualUiMode,
    uiAutoDetect,
    combatLayout:normalizeCombatLayout({
      avatarScale:document.getElementById('setting-combat-avatar-scale')?.value,
      combatantsScale:document.getElementById('setting-combat-combatants-scale')?.value,
      actionTrayScale:document.getElementById('setting-combat-action-scale')?.value,
      battleLogScale:document.getElementById('setting-combat-log-scale')?.value,
    }),
    combatArrangement:normalizeCombatArrangement(document.getElementById('setting-combat-arrangement')?.value),
    combatCustomLayout:prev.combatCustomLayout,
    audio:Object.assign({}, prev.audio, {
      master:Number(document.getElementById('setting-master-volume')?.value??prev.audio?.master??100),
      music:Number(document.getElementById('setting-music-volume')?.value??prev.audio?.music??THEME_BGM_DEFAULT_VOLUME_PCT),
      sfx:Number(document.getElementById('setting-sfx-volume')?.value??prev.audio?.sfx??100),
    }),
    tooltips:{
      abilities:!!document.getElementById('setting-tt-abilities')?.checked,
      mutations:!!document.getElementById('setting-tt-mutations')?.checked,
      items:!!document.getElementById('setting-tt-items')?.checked,
      passives:!!document.getElementById('setting-tt-passives')?.checked,
    },
  };
  if(uiAutoDetect) cfg.uiMode=detectPreferredUIMode();
  localStorage.setItem(ACCESS_KEY, JSON.stringify(normalizeAccessibilitySettings(cfg)));
  applyAccessibilitySettings(getAccessibilitySettings());
  applyThemeMusicToAudioEl();
  syncThemeMusicButtonLabels();
}
function updateAudioSettingsFromControls(){
  const prev=getAccessibilitySettings();
  const ms=getMusicSettings();
  const cfg=normalizeAccessibilitySettings(Object.assign({}, prev, {
    audio:{
      master:Number(document.getElementById('setting-master-volume')?.value??prev.audio?.master??100),
      music:Number(document.getElementById('setting-music-volume')?.value??prev.audio?.music??THEME_BGM_DEFAULT_VOLUME_PCT),
      sfx:Number(document.getElementById('setting-sfx-volume')?.value??prev.audio?.sfx??100),
    },
  }));
  saveMusicSettings({muted:!!document.getElementById('setting-music-muted')?.checked, volume:cfg.audio.music});
  localStorage.setItem(ACCESS_KEY, JSON.stringify(cfg));
  applyThemeMusicToAudioEl();
  syncThemeMusicButtonLabels();
  const active=document.querySelector('.screen.active');
  if(active&&(active.id==='screen-start'||active.id==='screen-select')){
    tryPlayThemeBgmForCurrentMenuScreen();
  }else if(active?.id==='screen-battle'&&isDukeStoryBossFight()){
    tryStartDukeBattleBgmIfNeeded();
  }
}
function updateMusicSettingsFromControls(){
  updateAudioSettingsFromControls();
}
globalThis.updateAudioSettingsFromControls=updateAudioSettingsFromControls;

installErrorHUD();
bootstrapAccessibilityDefaults();
applyAccessibilitySettings();
wireUiAutoDetectResize();
if(typeof window!=='undefined'){
  window.addEventListener('pagehide', ()=>stopAllGameAudio());
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState==='hidden') stopAllGameAudio();
  });
}
wireCombatDropdownStateSync();
applyUIStateToDOM();
applyThemeMusicToAudioEl();
syncThemeMusicButtonLabels();
syncThemeBgmPlaybackForScreen((document.querySelector('.screen.active')||{}).id||'screen-start');
primeDukeBattleBgmAudio();
wireThemeBgmAutoplayUnlock();


/* ============================================================
   PATCH: Pixel sprites for player/enemy avatars + Character Select
   Birds supported: sparrow, goose, blackbird, crow, macaw,
                    hummingbird, shoebill, secretarybird
   Frames:
     0 idle
     1 taunt/cast (spell/song)
     2 attack
     3 power/buff
   ============================================================ */
(function(){
  const SPRITE_KEYS = new Set(['sparrow','goose','blackbird','crow','macaw','hummingbird','shoebill','secretarybird','secretary','magpie','kookaburra','kiwi','penguin','robin','dove','flamingo','seagull','swan','emu','bowerbird','raven','lyrebird','peregrine','snowyowl','toucan','dukeblakiston','albatross','harpy','harpyeagle','baldeagle','blackcockatoo','ostrich','cassowary','barnowl','bluejay','bushturkey','bustard','cardinal','dodo','fairywren','finch','firecrest','galah','goldeneagle','pigeon','mutatedpigeon']);
  const CASTERS = new Set(['singer','trickster']);

  function normKey(k){ return String(k||'').toLowerCase().replace(/[^a-z]/g,''); } // secretaryBird -> secretarybird
  function whoEl(who){ return document.getElementById(`${who}-avatar`); }

  function ensureSpriteInEl(el, key, locked){
    if(!el || !SPRITE_KEYS.has(key)) return null;
    let spr = el.querySelector('.sprite4');
    if(spr) return spr;
    el.innerHTML = `<div class="sprite4 ${locked?'locked':''} sprite-${key} frame-0" id="${el.id}-sprite"></div>`;
    el.style.fontSize='';
    return el.querySelector('.sprite4');
  }

  function setFrameFor(who, frame, holdMs){
    const key = who==='player' ? normKey(G?.player?.birdKey) : normKey(G?.enemy?.portraitKey || G?.enemy?.birdKey);
    const el = whoEl(who);
    const spr = ensureSpriteInEl(el, key, false);
    if(!spr) return;
    spr.classList.remove('frame-0','frame-1','frame-2','frame-3');
    spr.classList.add('frame-'+frame);
    if(holdMs){
      clearTimeout(globalThis[`__${who}FrameTimer`]);
      globalThis[`__${who}FrameTimer`] = setTimeout(()=>setFrameFor(who,0), holdMs);
    }
  }

  function startIdleBlink(who){
    const flag = `__${who}IdleLoopStarted`;
    if(globalThis[flag]) return;
    globalThis[flag]=true;
    setInterval(()=>{
      try{
        const key = who==='player' ? normKey(G?.player?.birdKey) : normKey(G?.enemy?.portraitKey || G?.enemy?.birdKey);
        if(!SPRITE_KEYS.has(key)) return;
        // blink/cast frame briefly
        setFrameFor(who,1,220);
      }catch(_){}
    }, 2600);
  }

  // Hook refreshBattleUI to render sprites
  const oldRefresh = globalThis.refreshBattleUI;
  if(typeof oldRefresh==='function'){
    globalThis.refreshBattleUI = function(){
      oldRefresh.apply(this, arguments);
      try{
        const pk = normKey(G?.player?.birdKey);
        if(SPRITE_KEYS.has(pk)){
          ensureSpriteInEl(whoEl('player'), pk, false);
          startIdleBlink('player');
        }
        const ek = normKey(G?.enemy?.portraitKey || G?.enemy?.birdKey);
        if(SPRITE_KEYS.has(ek)){
          // don't override if enemy is Duke with its own sprite system (optional)
          if(!(G?.enemy?.id==='dukeBlakiston' || /blakiston/i.test(G?.enemy?.name||''))){
            ensureSpriteInEl(whoEl('enemy'), ek, false);
            startIdleBlink('enemy');
          }
        }
      }catch(_){}
    };
  }

  // Hook playerAction to flash correct frame based on ability type
  const oldPlayerAction = globalThis.playerAction;
  if(typeof oldPlayerAction==='function'){
    globalThis.playerAction = async function(ab, fromQueue){
      try{
        const t = ABILITY_TEMPLATES?.[ab?.id] || {};
        const at = (t.type || t.btnType || '').toLowerCase();
        const cls = (G?.player?.class || BIRDS?.[G?.player?.birdKey]?.class || '').toLowerCase();
        const isCaster = CASTERS.has(cls);

        if(at==='attack') setFrameFor('player',2,260);
        else if(at==='spell' || at==='song') setFrameFor('player',1,280);
        else setFrameFor('player',3,280);

      }catch(_){}
      return await oldPlayerAction.apply(this, arguments);
    };
  }

  // Hook enemy action execution if available
  const oldExec = globalThis.executeEnemyAction;
  if(typeof oldExec==='function'){
    globalThis.executeEnemyAction = async function(act){
      try{
        const ek = normKey(G?.enemy?.portraitKey || G?.enemy?.birdKey);
        if(SPRITE_KEYS.has(ek) && !(G?.enemy?.id==='dukeBlakiston' || /blakiston/i.test(G?.enemy?.name||''))){
          if(act?.type==='attack') setFrameFor('enemy',2,260);
          else if(act?.type==='ability') setFrameFor('enemy',3,260);
        }
      }catch(_){}
      return await oldExec.apply(this, arguments);
    };
  }

  // Character Select: wrap buildBirdCard to use sprites
  if(typeof globalThis.buildBirdCard==='function'){
    const _old = globalThis.buildBirdCard;
    globalThis.buildBirdCard = function(key, bird, locked, globalMax){
      const card = _old.apply(this, arguments);
      try{
        const k = normKey(key);
        if(!SPRITE_KEYS.has(k)) return card;
        const portrait = card.querySelector('.bird-portrait');
        if(!portrait) return card;
       portrait.outerHTML = renderBirdIconHTML(key, bird, locked);
       portrait.innerHTML = renderBirdIconHTML(key, bird, locked);
        if(!locked){
          card.addEventListener('mouseenter', ()=> {
            const s = portrait.querySelector('.sprite4'); if(!s) return;
            s.classList.remove('frame-0','frame-1','frame-2','frame-3'); s.classList.add('frame-1');
          }, {passive:true});
          card.addEventListener('mouseleave', ()=> {
            const s = portrait.querySelector('.sprite4'); if(!s) return;
            s.classList.remove('frame-0','frame-1','frame-2','frame-3'); s.classList.add('frame-0');
          }, {passive:true});
        }
      }catch(_){}
      return card;
    };
  }

})();



/* ============================================================
   PATCH: Sprites always visible (no Birdwatching required)
   - Replace PORTRAITS entries with sprite HTML for supported birds
   - Forces all UI locations using PORTRAITS[...] to show sprites
   ============================================================ */
(function(){
  const SPRITE_KEYS = ['sparrow','goose','blackbird','crow','macaw','hummingbird','shoebill','secretarybird','secretary','magpie','kookaburra','robin','kiwi','penguin','dove','flamingo','seagull','swan','emu','bowerbird','raven','lyrebird','peregrine','snowyowl','toucan','dukeblakiston','albatross','harpy','harpyeagle','baldeagle','blackcockatoo','ostrich','cassowary','barnowl','bluejay','bushturkey','bustard','cardinal','dodo','fairywren','finch','firecrest','galah','goldeneagle','pigeon','mutatedpigeon'];
  function mk(k, small=true){
    const cls = small ? 'sprite4 small' : 'sprite4';
    return `<div class="${cls} sprite-${k} frame-0"></div>`;
  }
  // Replace portrait glyphs with sprite blocks
  if(globalThis.PORTRAITS){
    SPRITE_KEYS.forEach(k=>{
      PORTRAITS[k] = mk(k, true);
    });
    PORTRAITS['secretaryBird'] = mk('secretarybird', true);
  }

  // Also make sure buildBirdCard locked branch is not stuck on emoji after render
  const oldBuild = globalThis.buildBirdCard;
  if(typeof oldBuild==='function' && !oldBuild.__spriteWrapped){
    const norm = (s)=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
    const set = new Set(SPRITE_KEYS);
    const wrapped = function(key, bird, locked, globalMax){
      const card = oldBuild.apply(this, arguments);
      try{
        const k = norm(key);
        if(!set.has(k)) return card;
        const portrait = card.querySelector('.bird-portrait');
        if(portrait){
          portrait.innerHTML = mk(k,true);
          const spr = portrait.querySelector('.sprite4');
          if(spr && locked) spr.classList.add('locked');
        }
      }catch(_){}
      return card;
    };
    wrapped.__spriteWrapped = true;
    globalThis.buildBirdCard = wrapped;
  }

  // Refresh selection if already on screen.
  // Deferred so that modules listed AFTER js/core/game.js in
  // js/bootstrap/load-order.json (enemies, upgrade-cards, systems wrappers,
  // ui, sprites) finish loading before initSelectionSafe → handleOverworldReturn
  // → continueRun → loadStage runs. Without this defer, an OW return
  // would fire here before the post-game.js modules registered, which
  // could swallow an error in continueRun and strand the player on the
  // default screen-start splash.
  const _avianSpritePatchInit = function(){
    try{
      if(typeof initSelectionSafe==='function') initSelectionSafe();
    }catch(_){}
  };
  if(typeof queueMicrotask === 'function') queueMicrotask(_avianSpritePatchInit);
  else if(typeof Promise !== 'undefined' && typeof Promise.resolve === 'function') Promise.resolve().then(_avianSpritePatchInit);
  else setTimeout(_avianSpritePatchInit, 0);
})();



/* ============================================================
   PATCH: Medium bird sprites on select/preview (no squish)
   - magpie, kookaburra use .sprite4.medium on select screen
   - player/enemy avatars can use battle-medium if size is medium
   ============================================================ */
(function(){
  function normKey(k){ return String(k||'').toLowerCase().replace(/[^a-z]/g,''); }
  function sizeClassForBird(b, context='select'){
    return (typeof globalThis.getUISizeClass==='function')
      ? globalThis.getUISizeClass(b, context)
      : 'medium';
  }

  // Wrap buildBirdCard again (safe) to choose size class
  if(typeof globalThis.buildBirdCard==='function'){
    const _old=globalThis.buildBirdCard;
    globalThis.buildBirdCard=function(key,bird,locked,globalMax){
      const card=_old.apply(this,arguments);
      try{
        const k=normKey(key);
        const portrait=card.querySelector('.bird-portrait');
        if(!portrait) return card;

        // If sprite supported, use it always
        const supported = (globalThis.SPRITE_KEYS && SPRITE_KEYS.has(k)) || (portrait.innerHTML||'').includes('sprite-') || false;
        if((globalThis.SPRITE_KEYS && SPRITE_KEYS.has(k)) || /sprite-/.test(portrait.innerHTML)){
          const sz=sizeClassForBird(bird,'select');
          portrait.innerHTML = `<div class="sprite4 ${sz} sprite-${k} frame-0 ${locked?'locked':''}"></div>`;
        }
      }catch(_){}
      return card;
    };
  }

  // Hook updateAscentPanel to render sprite portrait in inline preview
  const oldUpdate=globalThis.updateAscentPanel;
  if(typeof oldUpdate==='function'){
    globalThis.updateAscentPanel=function(){
      oldUpdate.apply(this,arguments);
      const key=arguments[0];
      try{
        const k=normKey(key);
        const bird = globalThis.BIRDS?.[key] || globalThis.BIRDS?.[k];
        const panel=document.getElementById('ascent-panel');
        if(!panel || !bird) return;
        const portrait=panel.querySelector('.ascent-portrait');
        if(!portrait) return;
        if(globalThis.SPRITE_KEYS && SPRITE_KEYS.has(k)){
          // Medium birds get medium portrait
          const sz = sizeClassForBird(bird,'panel');
          portrait.innerHTML = `<div class="sprite4 ${sz} sprite-${k} frame-0"></div>`;
        }
      }catch(_){}
    };
  }
})();



/* ============================================================
   PATCH: Enable Kiwi + Penguin sprites everywhere sprites are used
   - Adds sprite keys
   - Ensures penguin displays as "Emperor Penguin" in UI labels
   ============================================================ */
(function(){
  try{
    // Ensure externally provided sprite sheets are recognised everywhere
    if(globalThis.SPRITE_KEYS_ALL && SPRITE_KEYS_ALL.add){
      SPRITE_KEYS_ALL.add('kiwi');
      SPRITE_KEYS_ALL.add('penguin');
SPRITE_KEYS_ALL.add('magpie');
      SPRITE_KEYS_ALL.add('flamingo');
      SPRITE_KEYS_ALL.add('seagull');
      SPRITE_KEYS_ALL.add('bowerbird');
    }
  }catch(_){}
})();



// ===== 05_script_05.js =====

/* ============================================================
   PATCH: Tiny sprite animation controller refresh
   - Keeps magpie on 2x2 sheet
   - Adds small idle flutter + clearer attack/run/crouch cues
   ============================================================ */
(function(){
  const SPRITE_KEYS = new Set(['sparrow','goose','blackbird','crow','macaw','robin','hummingbird','shoebill','secretarybird','secretary','magpie','kookaburra','flamingo','seagull','swan','emu','penguin','bowerbird','raven','lyrebird','peregrine','snowyowl','toucan','dukeblakiston','albatross','harpy','harpyeagle','baldeagle','blackcockatoo','ostrich','cassowary','barnowl','bluejay','bushturkey','bustard','cardinal','dodo','fairywren','finch','firecrest','galah','goldeneagle','pigeon','mutatedpigeon']);
  const CASTERS = new Set(['singer','trickster']);

  function normKey(k){ return String(k||'').toLowerCase().replace(/[^a-z]/g,''); }
  function whoEl(who){ return document.getElementById(`${who}-avatar`); }
  function currentKey(who){ return normKey(who==='player' ? G?.player?.birdKey : (G?.enemy?.portraitKey || G?.enemy?.birdKey)); }

  function ensureSprite(who){
    const key=currentKey(who);
    const el=whoEl(who);
    if(!el || !SPRITE_KEYS.has(key)) return null;
    let spr=el.querySelector('.sprite4');
    if(!spr){
      el.innerHTML = `<div class="sprite4 sprite-${key} frame-0" id="${who}-avatar-sprite"></div>`;
      spr=el.querySelector('.sprite4');
    }
    return spr;
  }

  function clearFrames(spr){ spr.classList.remove('frame-0','frame-1','frame-2','frame-3'); }

  function setSpriteFrame(who, frame, holdMs=0){
    const spr=ensureSprite(who);
    if(!spr) return;
    clearFrames(spr);
    spr.classList.add(`frame-${frame}`);
    if(holdMs>0){
      clearTimeout(spr._frameTimer);
      spr._frameTimer=setTimeout(()=>{
        const s=ensureSprite(who);
        if(!s) return;
        clearFrames(s);
        s.classList.add('frame-0');
      }, holdMs);
    }
  }

  function pulseIdle(who){
    const flag=`__spriteIdle_${who}`;
    if(globalThis[flag]) return;
    globalThis[flag]=true;
    setInterval(()=>{
      const spr=ensureSprite(who);
      if(!spr || document.hidden) return;
      if(spr._busyUntil && spr._busyUntil > Date.now()) return;
      setSpriteFrame(who, 1, 170);
    }, who==='player' ? 3200 : 4100);
  }

  function playAction(who, kind){
    const spr=ensureSprite(who);
    if(!spr) return;
    spr._busyUntil=Date.now()+420;
    if(kind==='attack') setSpriteFrame(who,1,260);
    else if(kind==='run') setSpriteFrame(who,2,260);
    else if(kind==='crouch') setSpriteFrame(who,3,280);
    else setSpriteFrame(who,0);
  }

  const oldRefresh=globalThis.refreshBattleUI;
  if(typeof oldRefresh==='function'){
    globalThis.refreshBattleUI=function(){
      const out=oldRefresh.apply(this, arguments);
      try{ ensureSprite('player'); ensureSprite('enemy'); pulseIdle('player'); pulseIdle('enemy'); }catch(_){}
      return out;
    };
  }

  const oldPlayerAction=globalThis.playerAction;
  if(typeof oldPlayerAction==='function'){
    globalThis.playerAction=async function(ab, fromQueue){
      try{
        const t=ABILITY_TEMPLATES?.[ab?.id] || {};
        const at=String(t.type || t.btnType || '').toLowerCase();
        const cls=String(G?.player?.class || BIRDS?.[G?.player?.birdKey]?.class || '').toLowerCase();
        if(at==='physical' || at==='attack' || at==='melee') playAction('player','attack');
        else if(at==='movement' || at==='dash') playAction('player','run');
        else if(at==='spell' || at==='song' || CASTERS.has(cls)) playAction('player','crouch');
        else playAction('player','attack');
      }catch(_){}
      return await oldPlayerAction.apply(this, arguments);
    };
  }

  const oldEnemy=globalThis.executeEnemyAction;
  if(typeof oldEnemy==='function'){
    globalThis.executeEnemyAction=async function(act){
      try{
        const ek=currentKey('enemy');
        if(SPRITE_KEYS.has(ek) && !(G?.enemy?.id==='dukeBlakiston' || /blakiston/i.test(G?.enemy?.name||''))){
          if(act?.type==='attack') playAction('enemy','attack');
          else if(act?.type==='move') playAction('enemy','run');
          else playAction('enemy','crouch');
        }
      }catch(_){}
      return await oldEnemy.apply(this, arguments);
    };
  }

  const oldDoAttack=globalThis.doAttack;
  if(typeof oldDoAttack==='function'){
    globalThis.doAttack=async function(attacker,target,result){
      try{ playAction(attacker,'attack'); setTimeout(()=>playAction(target,'crouch'), 120); }catch(_){}
      return await oldDoAttack.apply(this, arguments);
    };
  }

  globalThis.__birdSpriteController={ setSpriteFrame, playAction, ensureSprite };
})();


// ===== 06_script_06.js =====

/* ============================================================
   PATCH: Bird animation polish + procedural enemy personalities
   - idle breathing
   - attack snap
   - hit recoil
   - enemy stagger
   - slight hover for flying birds
   - personality-driven enemy planning
   ============================================================ */
(function(){
  const FLYERS = new Set(['sparrow','goose','blackbird','crow','macaw','robin','hummingbird','magpie','kookaburra','flamingo','seagull','raven','hawk','owl']);
  const TRICKSTERS = new Set(['crow','raven','magpie','seagull']);
  const DEFENSIVE = new Set(['goose','swan','pelican','duck']);
  const PREDATORS = new Set(['hawk','falcon','eagle','owl','redtailedhawk','barnowl']);
  const AGGRESSORS = new Set(['emu','cassowary','shoebill','secretarybird','harpy','harpyeagle','condor']);
  const BOSS_IDS = new Set(['dukeblakiston']);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes birdIdleBreath {
      0%,100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-2px) scale(1.015); }
    }
    @keyframes birdHoverFloat {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes birdAttackSnap {
      0% { transform: translateX(0) scale(1); }
      35% { transform: translateX(8px) scale(1.06); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes birdAttackSnapEnemy {
      0% { transform: translateX(0) scale(1); }
      35% { transform: translateX(-8px) scale(1.06); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes birdHitRecoil {
      0% { transform: translateX(0); filter: none; }
      40% { transform: translateX(-6px); filter: brightness(1.15); }
      100% { transform: translateX(0); filter: none; }
    }
    @keyframes birdHitRecoilEnemy {
      0% { transform: translateX(0); filter: none; }
      40% { transform: translateX(6px); filter: brightness(1.15); }
      100% { transform: translateX(0); filter: none; }
    }
    @keyframes birdStagger {
      0% { transform: translateY(0); }
      30% { transform: translateY(2px) rotate(-2deg); }
      70% { transform: translateY(-1px) rotate(1deg); }
      100% { transform: translateY(0) rotate(0deg); }
    }
    .sprite4.anim-idle {
      animation: birdIdleBreath 2.25s ease-in-out infinite;
      transform-origin: 50% 100%;
      will-change: transform;
    }
    .sprite4.anim-hover {
      animation: birdHoverFloat 1.8s ease-in-out infinite;
      transform-origin: 50% 100%;
      will-change: transform;
    }
    .sprite4.anim-idle.anim-hover {
      animation: birdIdleBreath 2.4s ease-in-out infinite, birdHoverFloat 1.8s ease-in-out infinite;
    }
    .sprite4.anim-attack-player {
      animation: birdAttackSnap 240ms ease-out 1;
      z-index: 2;
    }
    .sprite4.anim-attack-enemy {
      animation: birdAttackSnapEnemy 240ms ease-out 1;
      z-index: 2;
    }
    .sprite4.anim-hit-player {
      animation: birdHitRecoil 220ms ease-out 1, birdStagger 260ms ease-out 1;
      z-index: 2;
    }
    .sprite4.anim-hit-enemy {
      animation: birdHitRecoilEnemy 220ms ease-out 1, birdStagger 260ms ease-out 1;
      z-index: 2;
    }
  `;
  document.head.appendChild(style);

  const ctl = globalThis.__birdSpriteController || {};
  const baseEnsure = ctl.ensureSprite || function(who){
    return document.querySelector(`#${who}-avatar .sprite4`);
  };

  function normKey(k){ return String(k||'').toLowerCase().replace(/[^a-z]/g,''); }
  function isBossEnemy(e){
    const key = normKey(e?.birdKey || e?.id || e?.name);
    return BOSS_IDS.has(key) || /blakiston|duke/i.test(String(e?.name||''));
  }

  function getBirdKeyFor(who){
    if(who === 'player') return normKey(globalThis.G?.player?.birdKey || globalThis.G?.player?.name);
    return normKey(globalThis.G?.enemy?.birdKey || globalThis.G?.enemy?.id || globalThis.G?.enemy?.name);
  }

  function refreshAmbient(who){
    const spr = baseEnsure(who);
    if(!spr) return null;
    const key = getBirdKeyFor(who);
    spr.dataset.birdKey = key;
    spr.classList.add('anim-idle');
    if(FLYERS.has(key) && !/emu|kiwi|penguin/.test(key)) spr.classList.add('anim-hover');
    else spr.classList.remove('anim-hover');
    return spr;
  }

  function oneShotClass(spr, cls, ms){
    if(!spr) return;
    spr.classList.remove(cls);
    void spr.offsetWidth;
    spr.classList.add(cls);
    clearTimeout(spr._animTimerMap?.[cls]);
    spr._animTimerMap = spr._animTimerMap || {};
    spr._animTimerMap[cls] = setTimeout(() => spr.classList.remove(cls), ms);
  }

  function playAttackMotion(who){
    const spr = refreshAmbient(who);
    if(!spr) return;
    oneShotClass(spr, who === 'player' ? 'anim-attack-player' : 'anim-attack-enemy', 260);
  }

  function playHitMotion(who){
    const spr = refreshAmbient(who);
    if(!spr) return;
    oneShotClass(spr, who === 'player' ? 'anim-hit-player' : 'anim-hit-enemy', 280);
  }

  const oldRefresh = globalThis.refreshBattleUI;
  if(typeof oldRefresh === 'function'){
    globalThis.refreshBattleUI = function(){
      const out = oldRefresh.apply(this, arguments);
      try{
        refreshAmbient('player');
        refreshAmbient('enemy');
      }catch(_){}
      return out;
    };
  }

  const oldDoAttack = globalThis.doAttack;
  if(typeof oldDoAttack === 'function'){
    globalThis.doAttack = async function(attacker, target, result){
      try{
        playAttackMotion(attacker);
        setTimeout(() => playHitMotion(target), 115);
      }catch(_){}
      return await oldDoAttack.apply(this, arguments);
    };
  }

  const oldExec = globalThis.executeEnemyAction;
  if(typeof oldExec === 'function'){
    globalThis.executeEnemyAction = async function(act){
      try{
        if(act?.type === 'attack' || act?.type === 'strike' || act?.type === 'heavy' || act?.abilityId === 'eStun'){
          playAttackMotion('enemy');
        }
      }catch(_){}
      return await oldExec.apply(this, arguments);
    };
  }

  globalThis.__birdSpritePolish = { refreshAmbient, playAttackMotion, playHitMotion };
})();

// Dev-only: validate BIRDS ability ids vs ABILITY_TEMPLATES (+ family base slots, upgrade id uniqueness).
// Enable auto-run: set globalThis.__CONTENT_VALIDATE__ = true before game.js loads, or open with ?contentValidate=1
// Manual: validateDevContentIntegrity() in the console (returns { ok, issues }).
(function(){
  function shouldRunDevContentValidation(){
    if(globalThis.__CONTENT_VALIDATE__===true) return true;
    try{
      if(typeof location!=='undefined' && location.search && /[?&]contentValidate=1(?:&|$)/.test(location.search)) return true;
      const h = typeof location!=='undefined' ? String(location.hostname||'') : '';
      if(h==='localhost' || h==='127.0.0.1') return true;
    }catch(_){}
    return false;
  }
  function abilityTemplateLooksValid(id){
    const t = ABILITY_TEMPLATES && ABILITY_TEMPLATES[id];
    return !!(t && typeof t==='object' && (t.name || t.id || t.type || (Array.isArray(t.levels)&&t.levels.length)));
  }
  function validateDevContentIntegrity(){
    const issues = [];
    const add = msg => issues.push(msg);
    try{
      const birds = BIRDS || {};
      for(const bk of Object.keys(birds)){
        const bd = birds[bk];
        if(!bd || typeof bd!=='object') continue;
        const need = new Set();
        (bd.startAbilities||[]).forEach(x=>{ if(x) need.add(String(x)); });
        (bd.extraAbilities||[]).forEach(x=>{ if(x) need.add(String(x)); });
        if(bd.mainAttackId) need.add(String(bd.mainAttackId));
        for(const aid of need){
          if(!abilityTemplateLooksValid(aid)) add(`BIRDS[${bk}] references missing/empty ABILITY_TEMPLATES["${aid}"]`);
        }
        const fed = typeof getBirdFamilyEvolutionData==='function' ? getBirdFamilyEvolutionData(bk) : null;
        if(fed && Array.isArray(fed.slotLayout)){
          fed.slotLayout.forEach((slot, i)=>{
            const sid = slot && slot.abilityId;
            if(sid && !abilityTemplateLooksValid(String(sid))){
              add(`BIRDS[${bk}] family slotLayout[${i}] missing ABILITY_TEMPLATES["${sid}"]`);
            }
          });
          if(Array.isArray(bd.startAbilities)){
            const slotBases = fed.slotLayout.map(s=>s&&s.abilityId).filter(Boolean);
            if(slotBases.length && bd.startAbilities.length===slotBases.length){
              const startSet = new Set((bd.startAbilities||[]).map(String));
              const missing = slotBases.filter(id=>!startSet.has(String(id)));
              if(missing.length) add(`BIRDS[${bk}] startAbilities must list the same family slot bases as slotLayout (missing: ${missing.join(', ')})`);
            }else if(slotBases.length && bd.startAbilities.length && bd.startAbilities.length!==slotBases.length){
              add(`BIRDS[${bk}] startAbilities length (${bd.startAbilities.length}) should match family slot count (${slotBases.length})`);
            }
          }
        }
      }
      if(Array.isArray(UPGRADE_CARDS_REWORK)){
        const seen = new Set();
        UPGRADE_CARDS_REWORK.forEach(u=>{
          if(!u || !u.id) return;
          if(seen.has(u.id)) add(`UPGRADE_CARDS_REWORK duplicate id: ${u.id}`);
          seen.add(u.id);
        });
      }
    }catch(e){
      add(`validateDevContentIntegrity internal error: ${e && e.message ? e.message : e}`);
    }
    if(issues.length){
      console.warn(`[ContentValidate] ${issues.length} issue(s):`);
      issues.forEach(m=>console.warn('  -', m));
    }else if(shouldRunDevContentValidation()){
      console.info('[ContentValidate] OK — bird abilities, family slots, and upgrade ids look consistent.');
    }
    return { ok: issues.length===0, issues };
  }
  globalThis.validateDevContentIntegrity = validateDevContentIntegrity;
  if(shouldRunDevContentValidation()){
    try{ validateDevContentIntegrity(); }catch(e){ console.warn('[ContentValidate] failed:', e); }
  }
})();

// ===== 07_script_07.js =====

/* ============================================================
   PATCH: Unified size-class resolver
   - keeps one sizing decision across selection, ascent, and battle
   - preserves actual large/xl birds instead of collapsing them to medium
   ============================================================ */
(function(){
  globalThis.getUISizeClass = function(entity, context='general'){
    const key = String(entity?.portraitKey || entity?.birdKey || entity?.id || '').toLowerCase().replace(/[^a-z]/g,'');
    const sz = typeof rosterSizeForEntity==='function'?rosterSizeForEntity(entity):String(entity?.size||entity?.birdSize||'').toLowerCase();
    const isBoss = !!entity?.isBoss;
    if(isBoss && context==='battle') return 'boss';
    if(key === 'penguin') return 'xl';
    if(key === 'seagull') return 'medium';
    if(key === 'robin') return 'small';
    if(sz.includes('tiny')) return 'tiny';
    if(sz.includes('small')) return 'small';
    if(sz==='xl'||sz.includes('xlarge')) return 'xl';
    if(sz.includes('large')) return 'large';
    if(sz.includes('medium')) return 'medium';
    return 'medium';
  };
})();


// ===== 08_script_08.js =====

/* ===== FINAL PENGUIN RENDER PATCH ===== */
(function(){
  const spriteBirds = new Set([
    'sparrow','goose','blackbird','crow','macaw','robin','dove','hummingbird','shoebill',
    'secretarybird','secretary','magpie','kookaburra','kiwi','penguin','flamingo','seagull',
    'swan','emu','bowerbird','raven','lyrebird','peregrine','snowyowl','toucan','dukeblakiston',
    'albatross','harpy','harpyeagle','baldeagle','blackcockatoo','ostrich','cassowary',
    'barnowl','bluejay','bushturkey','bustard','cardinal','dodo','fairywren','finch','firecrest','galah','goldeneagle','pigeon'
  ]);
  const norm = s => {
    const k = String(s || '').toLowerCase().replace(/[^a-z]/g,'');
    if(k === 'secretary') return 'secretarybird';
    if(k === 'harpyeagle') return 'harpy';
    return k;
  };

  globalThis.getUISizeClass = function(entity, context='general'){
    const key = norm(entity?.portraitKey || entity?.birdKey || entity?.id || '');
    const sz = typeof rosterSizeForEntity==='function'?rosterSizeForEntity(entity):String(entity?.size||entity?.birdSize||'').toLowerCase();
    if(entity?.isBoss && context === 'battle') return 'boss';
    if(key === 'penguin') return 'xl';
    if(key === 'seagull') return 'medium';
    if(key === 'robin') return 'small';
    if(sz.includes('tiny')) return 'tiny';
    if(sz.includes('small')) return 'small';
    if(sz==='xl'||sz.includes('xlarge')) return 'xl';
    if(sz.includes('large')) return 'large';
    if(sz.includes('medium')) return 'medium';
    return 'medium';
  };

  globalThis.renderBirdIconHTML = function(birdKey, sizeOrEntity, locked){
    const key = norm(birdKey);
    const entity = (sizeOrEntity && typeof sizeOrEntity === 'object') ? sizeOrEntity : { size: String(sizeOrEntity || 'medium') };
    let sizeClass = (typeof sizeOrEntity === 'string') ? sizeOrEntity : globalThis.getUISizeClass(entity, 'general');
    if(key === 'penguin') sizeClass = 'xl';
    if(key === 'seagull') sizeClass = 'medium';
    if(key === 'robin') sizeClass = 'small';
    if(spriteBirds.has(key)){
      return '<div class="sprite4 ' + sizeClass + ' sprite-' + key + ' frame-0 ' + (locked ? 'locked' : '') + '"></div>';
    }
    const emo = (globalThis.PORTRAITS && (PORTRAITS[birdKey] || PORTRAITS[key])) || '';
    return '<div class="bird-emo">' + emo + '</div>';
  };

  if(globalThis.PORTRAITS){
    PORTRAITS.penguin = '<div class="sprite4 xl sprite-penguin frame-0"></div>';
    PORTRAITS.duke_blakiston = '<div class="sprite4 boss sprite-dukeblakiston frame-0"></div>';
  }

  if(typeof globalThis.buildBirdCard === 'function'){
    const oldBuildBirdCard = globalThis.buildBirdCard;
    globalThis.buildBirdCard = function(key, bird, locked, globalMax){
      const card = oldBuildBirdCard.apply(this, arguments);
      try{
        const portrait = card.querySelector('.bird-portrait');
        if(!portrait) return card;
        const k = norm(key);
        if(!spriteBirds.has(k)) return card;
        const sizeClass = globalThis.getUISizeClass(bird, 'select');
        portrait.innerHTML = globalThis.renderBirdIconHTML(k, sizeClass, locked);
      }catch(e){}
      return card;
    };
  }

  if(typeof globalThis.renderEntityAvatarHTML === 'function'){
    globalThis.renderEntityAvatarHTML = function(entity, context='battle', locked=false){
      const key = entity?.portraitKey || entity?.birdKey || entity?.id || '';
      const sizeClass = globalThis.getUISizeClass(entity, context);
      const k = norm(key);
      if(spriteBirds.has(k)){
        return '<div class="sprite4 ' + sizeClass + ' sprite-' + k + ' frame-0 ' + (locked ? 'locked' : '') + '"></div>';
      }
      if(globalThis.PORTRAITS && (PORTRAITS[key] || PORTRAITS[norm(key)])){
        return (PORTRAITS[key] || PORTRAITS[norm(key)]);
      }
      return '<div class="bird-emo">' + (entity?.emoji || '') + '</div>';
    };
  }

  const oldUpdateAscentPanel = globalThis.updateAscentPanel;
  if(typeof oldUpdateAscentPanel === 'function'){
    globalThis.updateAscentPanel = function(){
      oldUpdateAscentPanel.apply(this, arguments);
      const key = arguments[0];
      try{
        const bird = globalThis.BIRDS?.[key];
        const panelPortrait = document.querySelector('.ascent-panel-portrait');
        if(bird && panelPortrait && spriteBirds.has(norm(key))){
          panelPortrait.innerHTML = globalThis.renderBirdIconHTML(key, globalThis.getUISizeClass(bird, 'panel'), false);
        }
      }catch(e){}
    };
  }

  try{
    if(globalThis.__AVIAN_OW_UI_EMBED__ && typeof globalThis.bootstrapOwUiEmbed === 'function'){
      globalThis.bootstrapOwUiEmbed();
    }else if(globalThis.__AVIAN_OW_NEST_EMBED__ && typeof globalThis.bootstrapOwNestEmbed === 'function'){
      globalThis.bootstrapOwNestEmbed();
    }else{
      // Defer until the rest of the bundle finishes loading so that modules
      // listed AFTER js/core/game.js in js/bootstrap/load-order.json
      // (enemies, upgrade-cards, tier-pick, class-perks-deck, endless-bands,
      // qol, content, systems, shop, ui, sprites) have all registered their
      // globals + wrappers before initSelectionSafe → handleOverworldReturn →
      // continueRun → loadStage runs. Without this defer, an OW return
      // would fire before ENEMIES / UPGRADE_CARDS_REWORK exist and the
      // outer try/catch above silently aborts, stranding the player on
      // the default screen-start splash. queueMicrotask runs at the end
      // of the current synchronous task — i.e. after the bundle script
      // completes — which is exactly when every module is ready.
      const _avianBootstrapInit = function(){
        try{
          if(typeof globalThis.initSelectionSafe === 'function') globalThis.initSelectionSafe();
          else if(typeof globalThis.initSelection === 'function') globalThis.initSelection();
        }catch(_e){}
      };
      if(typeof queueMicrotask === 'function') queueMicrotask(_avianBootstrapInit);
      else if(typeof Promise !== 'undefined' && typeof Promise.resolve === 'function') Promise.resolve().then(_avianBootstrapInit);
      else setTimeout(_avianBootstrapInit, 0);
    }
  }catch(e){}
})();

/* Combat rewrite: surface the legacy registries on globalThis so the new
 * combat-pack boot glue (js/systems/combat-pack-boot.js) can mutate them
 * regardless of whether it runs from the concatenated bundle (same script
 * scope) or as a separate <script> in dev mode (where top-level `const`
 * declarations are NOT visible across files). */
try {
  if (typeof ABILITY_TEMPLATES !== 'undefined' && !globalThis.ABILITY_TEMPLATES) globalThis.ABILITY_TEMPLATES = ABILITY_TEMPLATES;
  if (typeof ACTIONS !== 'undefined' && !globalThis.ACTIONS) globalThis.ACTIONS = ACTIONS;
  if (typeof CLASS_PERK_DEFS !== 'undefined' && !globalThis.CLASS_PERK_DEFS) globalThis.CLASS_PERK_DEFS = CLASS_PERK_DEFS;
  if (typeof CLASS_PERK_BY_CLASS !== 'undefined' && !globalThis.CLASS_PERK_BY_CLASS) globalThis.CLASS_PERK_BY_CLASS = CLASS_PERK_BY_CLASS;
  if (typeof CLASS_PERK_SOURCE_RULES !== 'undefined' && !globalThis.CLASS_PERK_SOURCE_RULES) globalThis.CLASS_PERK_SOURCE_RULES = CLASS_PERK_SOURCE_RULES;
  if (typeof PASSIVE_EVOLUTION_DEFS !== 'undefined' && !globalThis.PASSIVE_EVOLUTION_DEFS) globalThis.PASSIVE_EVOLUTION_DEFS = PASSIVE_EVOLUTION_DEFS;
  if (typeof FAMILY_EVOLUTION_BIRD_DATA !== 'undefined' && !globalThis.FAMILY_EVOLUTION_BIRD_DATA) globalThis.FAMILY_EVOLUTION_BIRD_DATA = FAMILY_EVOLUTION_BIRD_DATA;
  if (typeof _SHOP_UTILS_REGULAR !== 'undefined' && !globalThis._SHOP_UTILS_REGULAR) globalThis._SHOP_UTILS_REGULAR = _SHOP_UTILS_REGULAR;
  if (typeof _SHOP_UTILS_BOSS !== 'undefined' && !globalThis._SHOP_UTILS_BOSS) globalThis._SHOP_UTILS_BOSS = _SHOP_UTILS_BOSS;
} catch (_e) { /* boot continues even if a particular symbol is missing */ }
