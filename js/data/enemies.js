// Story ENEMIES + BIRD_ENEMIES (legacy 76ac60f); boss pool + ENEMY_ABILITY_POOL stay in game.js
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
  if(['berserker'].includes(s)) return 'bruiser';
  if(['aggressive'].includes(s)) return 'striker';
  if(['cautious','defensive'].includes(s)) return 'tank';
  if(['trickster'].includes(s)) return 'trickster';
  if(['predator'].includes(s)) return 'predator';
  return 'singer';
}

function makeEnemy(name, emoji, hp, atk, def, spd, style, isBoss=false, bossTitle='', opts={}) {
  const acc = opts.acc||72;
  const dodge = opts.dodge||5;
  const size = opts.size||'medium';
  const abilities = opts.abilities||[];
  const mdef = opts.mdef||8;
  const matk = opts.matk||6;
  const baseEn = Number.isFinite(opts.baseEn)
    ? opts.baseEn
    : (isBoss ? 6 : (size==='xl'?5:size==='large'?4:size==='medium'?4:3));
  const enemyClass = opts.enemyClass || inferEnemyClassFromStyle(style);
  const cc = Number.isFinite(opts.cc) ? opts.cc : (Number.isFinite(opts.critChance) ? (opts.critChance/100) : 0.05);
  const cd = Number.isFinite(opts.cd) ? opts.cd : (Number.isFinite(opts.critMult) ? opts.critMult : 1.5);
  const portraitKey = opts.portraitKey||null;
  const enemyTier = opts.enemyTier || (isBoss ? (/final boss/i.test(String(bossTitle||'')) ? 'boss' : 'lieutenant') : 'normal');
  return {name, emoji, portraitKey, hp, maxHp:hp, atk, def, spd, acc, dodge, size, enemyClass, aiStyle:style, aiPersonality:(opts.aiPersonality||inferAIPersonalityFromStyle(style,name)), isBoss, bossTitle, enemyTier, abilities,
    stats:{hp,maxHp:hp,atk,def,spd,acc,dodge,mdef,matk,en:baseEn,cc,cd,critChance:Math.round(cc*100),critMult:cd}};
}
const ENEMIES = [
  // Tier 1 ÔÇö Stages 1-4 (weak)
  makeEnemy('Young Sparrow','',18,3,1,7,'aggressive',false,'',{acc:65,dodge:20,size:'tiny',abilities:['eVenom'],portraitKey:'sparrow'}),
  makeEnemy('Dove','­ƒòè´©Å',24,5,2,5,'cautious',false,'',{acc:68,dodge:10,size:'small',abilities:['eWeaken'],portraitKey:'dove'}),
  makeEnemy('Magpie','ÔÇìÔ¼ø',32,7,3,6,'aggressive',false,'',{acc:72,dodge:15,size:'small',abilities:['eVenom','eWeaken'],portraitKey:'magpie'}),
  makeEnemy('Starling','',28,6,1,8,'berserker',false,'',{acc:70,dodge:25,size:'tiny',abilities:['eBlind'],portraitKey:'blackbird'}),
  makeEnemy('Finch','',20,4,1,8,'aggressive',false,'',{acc:66,dodge:30,size:'tiny',abilities:['eBlind'],portraitKey:'sparrow'}),
  makeEnemy('Robin','',24,5,2,8,'aggressive',false,'',{acc:74,dodge:22,size:'small',abilities:['eBlind'],portraitKey:'robin'}),
  makeEnemy('Blackbird','',26,5,2,7,'cautious',false,'',{acc:72,dodge:18,size:'small',abilities:['eFear'],portraitKey:'blackbird'}),
  makeEnemy('Wood Pigeon','­ƒòè´©Å',30,6,3,5,'cautious',false,'',{acc:70,dodge:12,size:'medium',abilities:['eWeaken'],portraitKey:'dove'}),
  // Tier 1 Boss
  makeEnemy('Storm Falcon','­ƒªà',55,12,6,7,'berserker',true,'ÔÜí Stage Boss',{acc:76,dodge:18,size:'large',abilities:['eStun','eWeaken','eRage'],portraitKey:'peregrine'}),
  // Tier 2 ÔÇö Stages 5-9
  makeEnemy('Barn Owl','­ƒªë',38,9,4,5,'cautious',false,'',{acc:75,dodge:12,size:'medium',abilities:['eFear','eHeal'],portraitKey:'snowyOwl'}),
  makeEnemy('Kite','­ƒªà',44,11,4,6,'aggressive',false,'',{acc:77,dodge:20,size:'medium',abilities:['eBurn','eVenom'],portraitKey:'peregrine'}),
  makeEnemy('Raven','ÔÇìÔ¼ø',50,10,6,4,'cautious',false,'',{acc:74,dodge:10,size:'medium',abilities:['eWeaken','eBlind'],portraitKey:'raven'}),
  makeEnemy('Osprey','­ƒªà',58,13,5,6,'berserker',false,'',{acc:78,dodge:15,size:'large',abilities:['eBurn','eStun'],portraitKey:'peregrine'}),
  makeEnemy('Jackdaw','ÔÇìÔ¼ø',36,8,3,7,'aggressive',false,'',{acc:72,dodge:18,size:'small',abilities:['eFear','eVenom'],portraitKey:'crow'}),
  // Tier 2 Boss
  makeEnemy('Thunderhawk','­ƒªà',90,18,9,6,'berserker',true,'­ƒî® Stage Boss',{acc:82,dodge:12,size:'large',abilities:['eRage','eStun','eFear','eShield'],portraitKey:'harpy'}),
  // Tier 3 ÔÇö Stages 10-14
  makeEnemy('Red-tailed Hawk','­ƒªà',65,15,7,5,'aggressive',false,'',{acc:79,dodge:10,size:'large',abilities:['eBurn','eWeaken'],portraitKey:'peregrine'}),
  makeEnemy('Peregrine','­ƒªà',70,17,6,8,'aggressive',false,'',{acc:83,dodge:20,size:'medium',abilities:['eStun','eBlind'],portraitKey:'peregrine'}),
  makeEnemy('Great Horned Owl','­ƒªë',80,16,10,4,'cautious',false,'',{acc:75,dodge:8,size:'large',abilities:['eFear','eHeal','eShield'],portraitKey:'snowyOwl'}),
  makeEnemy('Harpy Eagle','­ƒªà',88,19,8,5,'berserker',false,'',{acc:82,dodge:10,size:'large',abilities:['eRage','eBurn','ePoison'],portraitKey:'harpy'}),
  makeEnemy('Crowned Crane','­ƒª®',60,13,7,5,'cautious',false,'',{acc:78,dodge:12,size:'large',abilities:['eFear','eHeal'],portraitKey:'flamingo'}),
  // Tier 3 Boss
  makeEnemy('Hurricane Crane','­ƒª®',130,26,14,5,'berserker',true,'­ƒîÇ Stage Boss',{acc:84,dodge:8,size:'xl',abilities:['eRage','eStun','ePoison','eFear','eShield'],portraitKey:'flamingo'}),
  // Tier 4 ÔÇö Stages 15-19
  makeEnemy('Condor','­ƒªà',95,21,10,4,'cautious',false,'',{acc:78,dodge:6,size:'xl',abilities:['eFear','eHeal','eBlind'],portraitKey:'harpy'}),
  makeEnemy('Martial Eagle','­ƒªà',110,24,12,5,'aggressive',false,'',{acc:83,dodge:8,size:'xl',abilities:['eBurn','eRage','eStun'],portraitKey:'baldEagle'}),
  makeEnemy('Thunderbird','ÔÜí',120,26,11,6,'berserker',false,'',{acc:85,dodge:10,size:'xl',abilities:['ePoison','eBurn','eRage','eStun'],portraitKey:'baldEagle'}),
  makeEnemy('Seraph Vulture','­ƒªà',135,28,14,4,'cautious',false,'',{acc:80,dodge:5,size:'xl',abilities:['eFear','eHeal','eShield','eBlind'],portraitKey:'shoebill'}),
  makeEnemy('Phantom Owl','­ƒªë',90,20,12,5,'cautious',false,'',{acc:80,dodge:15,size:'large',abilities:['eFear','eBlind','eWeaken'],portraitKey:'snowyOwl'}),
  // Final Boss
  makeEnemy('Sky Sovereign','­ƒææ',200,35,18,6,'berserker',true,'­ƒææ Final Boss',{acc:90,dodge:12,size:'xl',abilities:['eRage','eStun','ePoison','eFear','eShield','eBurn'],portraitKey:'baldEagle'}),
];

// Birds that can appear as enemy combatants (adds variety). Set enemyClass for singer/tank/trickster; matk/mdef/mdodge feed scaling.
// Combat kits come from family skill slots + ABILITY_TEMPLATES (buildEdFromBirdEnemyTemplate). Penguin/emu have no family catalog yet ÔÇö legacy abilities only.
// Tier bands: keep aligned with js/world/ow_enemy_population.js OW_POOL_BY_BAND (overworld seeded packs).
const BIRD_ENEMIES = [
  {name:'Wild Sparrow',emoji:'',birdKey:'sparrow',tier:[1,2],hp:30,atk:6,def:2,matk:6,mdef:7,spd:9,acc:82,dodge:32,mdodge:28,enemyClass:'bruiser',size:'tiny',aiStyle:'berserker'},
  {name:'Grove Cantor',emoji:'­ƒÄÁ',birdKey:'blackbird',tier:[1,2],hp:30,atk:5,def:3,matk:12,mdef:9,spd:7,acc:78,dodge:22,mdodge:18,enemyClass:'singer',size:'small',aiStyle:'cautious'},
  {name:'Glitter Thief',emoji:'Ô£¿',birdKey:'magpie',tier:[1,2],hp:34,atk:7,def:4,matk:9,mdef:8,spd:8,acc:86,dodge:28,mdodge:22,enemyClass:'trickster',size:'medium',aiStyle:'aggressive'},
  {name:'Rogue Crow',emoji:'ÔÇìÔ¼ø',birdKey:'crow',tier:[2,3],hp:38,atk:8,def:5,matk:8,mdef:9,spd:5,acc:88,dodge:14,mdodge:12,enemyClass:'trickster',size:'medium',aiStyle:'aggressive'},
  {name:'Savage Kookaburra',emoji:'',birdKey:'kookaburra',tier:[2,3],hp:48,atk:10,def:5,matk:8,mdef:9,spd:7,acc:80,dodge:20,mdodge:16,enemyClass:'bruiser',size:'medium',aiStyle:'aggressive'},
  {name:'Marsh Chorus',emoji:'­ƒª®',birdKey:'flamingo',tier:[2,3],hp:46,atk:7,def:5,matk:11,mdef:11,spd:5,acc:76,dodge:14,mdodge:12,enemyClass:'singer',size:'large',aiStyle:'cautious'},
  {name:'Frost Chanter',emoji:'­ƒªë',birdKey:'snowyOwl',tier:[2,3],hp:34,atk:6,def:5,matk:13,mdef:9,spd:8,acc:84,dodge:22,mdodge:18,enemyClass:'singer',size:'small',aiStyle:'cautious'},
  {name:'Feral Toucan',emoji:'',birdKey:'toucan',tier:[3,4],hp:48,atk:9,def:7,matk:10,mdef:9,spd:4,acc:74,dodge:10,mdodge:10,enemyClass:'tank',size:'large',aiStyle:'cautious'},
  {name:'Outcast Goose',emoji:'',birdKey:'goose',tier:[3,4],hp:62,atk:11,def:8,matk:5,mdef:12,spd:2,acc:70,dodge:5,mdodge:8,enemyClass:'tank',size:'xl',aiStyle:'berserker'},
  {name:'Shadow Raven',emoji:'',birdKey:'raven',tier:[3,4],hp:40,atk:8,def:4,matk:12,mdef:8,spd:7,acc:80,dodge:20,mdodge:16,enemyClass:'singer',size:'medium',aiStyle:'aggressive'},
  {name:'Macaw Hexer',emoji:'­ƒª£',birdKey:'macaw',tier:[3,4],hp:38,atk:6,def:4,matk:14,mdef:9,spd:9,acc:82,dodge:26,mdodge:20,enemyClass:'singer',size:'small',aiStyle:'cautious'},
  {name:'Lyre Mimic',emoji:'­ƒ¬Â',birdKey:'lyrebird',tier:[3,4],hp:40,atk:6,def:5,matk:15,mdef:10,spd:6,acc:82,dodge:20,mdodge:16,enemyClass:'singer',size:'medium',aiStyle:'cautious'},
  {name:'Pit Sentinel',emoji:'­ƒÉº',birdKey:'penguin',tier:[3,4],hp:66,atk:8,def:10,matk:5,mdef:14,spd:3,acc:75,dodge:12,mdodge:12,enemyClass:'tank',size:'xl',aiStyle:'defensive',abilities:['eShield','eWeaken']},
  {name:'Apex Peregrine',emoji:'',birdKey:'peregrine',tier:[4],hp:36,atk:12,def:4,matk:7,mdef:7,spd:11,acc:90,dodge:26,mdodge:20,enemyClass:'predator',size:'small',aiStyle:'berserker'},
  {name:'Storm Swan',emoji:'',birdKey:'swan',tier:[4],hp:50,atk:10,def:6,matk:11,mdef:10,spd:6,acc:82,dodge:18,mdodge:14,enemyClass:'tank',size:'large',aiStyle:'cautious'},
  {name:'Iron Stork',emoji:'',birdKey:'shoebill',tier:[4],hp:72,atk:9,def:12,matk:6,mdef:16,spd:2,acc:72,dodge:5,mdodge:8,enemyClass:'tank',size:'xl',aiStyle:'defensive'},
  {name:'Dust Bulwark',emoji:'',birdKey:'emu',tier:[4],hp:78,atk:11,def:11,matk:4,mdef:10,spd:2,acc:72,dodge:10,mdodge:10,enemyClass:'tank',size:'xl',aiStyle:'defensive',abilities:['eRage','eWeaken']},
  {name:'War Harpy',emoji:'',birdKey:'harpy',tier:[4],hp:65,atk:14,def:7,matk:6,mdef:8,spd:5,acc:78,dodge:8,mdodge:8,enemyClass:'predator',size:'xl',aiStyle:'berserker'},
];

function applyBiomeModifiers(){
  const b=getBiomeForStage(G.stage);
  if(!b) return;
  G.biome=b.id;
  G.biomeMod=b.mod||{};
  if(typeof logMsg==='function') logMsg(`­ƒù║´©Å ${b.name}`,'system');
}

globalThis.ENEMIES = ENEMIES;
globalThis.BIRD_ENEMIES = BIRD_ENEMIES;
