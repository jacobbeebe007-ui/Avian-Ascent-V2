/* Avian Ascent — generic stage enemies (formerly `const ENEMIES` in js/core/game.js).
 *
 * Used by the random/pre-overworld stage encounter generator. The
 * overworld-seeded story pool lives in js/data/story_enemy_registry.js
 * and the bird-shaped enemy variants live in `BIRD_ENEMIES` (still in
 * game.js until that small table is also extracted).
 *
 * Loaded AFTER js/core/game.js so we can reuse the existing top-level
 * `makeEnemy` factory rather than inlining its computed `stats` block.
 * Bare references to `ENEMIES` inside game.js function bodies resolve
 * to `globalThis.ENEMIES` at call time, so order is safe.
 */
(function () {
  'use strict';
  if (typeof globalThis.makeEnemy !== 'function') {
    try { console.warn('[Avian] enemies.js: makeEnemy() missing — skipping ENEMIES init.'); } catch (_e) {}
    return;
  }
  const me = globalThis.makeEnemy;
  /** @type {Array<object>} */
  var enemies = [
    me('Young Sparrow','',18,3,1,7,'aggressive',false,'',{acc:65,dodge:20,size:'tiny',abilities:['eVenom'],portraitKey:'sparrow'}),
    me('Dove','🕊️',24,5,2,5,'cautious',false,'',{acc:68,dodge:10,size:'small',abilities:['eWeaken'],portraitKey:'dove'}),
    me('Magpie','‍⬛',32,7,3,6,'aggressive',false,'',{acc:72,dodge:15,size:'small',abilities:['eVenom','eWeaken'],portraitKey:'magpie'}),
    me('Starling','',28,6,1,8,'berserker',false,'',{acc:70,dodge:25,size:'tiny',abilities:['eBlind'],portraitKey:'blackbird'}),
    me('Finch','',20,4,1,8,'aggressive',false,'',{acc:66,dodge:30,size:'tiny',abilities:['eBlind'],portraitKey:'sparrow'}),
    me('Robin','',24,5,2,8,'aggressive',false,'',{acc:74,dodge:22,size:'small',abilities:['eBlind'],portraitKey:'robin'}),
    me('Blackbird','',26,5,2,7,'cautious',false,'',{acc:72,dodge:18,size:'small',abilities:['eFear'],portraitKey:'blackbird'}),
    me('Wood Pigeon','🕊️',30,6,3,5,'cautious',false,'',{acc:70,dodge:12,size:'medium',abilities:['eWeaken'],portraitKey:'dove'}),
    me('Storm Falcon','🦅',55,12,6,7,'berserker',true,'⚡ Stage Boss',{acc:76,dodge:18,size:'large',abilities:['eStun','eWeaken','eRage'],portraitKey:'peregrine'}),
    me('Barn Owl','🦉',38,9,4,5,'cautious',false,'',{acc:75,dodge:12,size:'medium',abilities:['eFear','eHeal'],portraitKey:'snowyOwl'}),
    me('Kite','🦅',44,11,4,6,'aggressive',false,'',{acc:77,dodge:20,size:'medium',abilities:['eBurn','eVenom'],portraitKey:'peregrine'}),
    me('Raven','‍⬛',50,10,6,4,'cautious',false,'',{acc:74,dodge:10,size:'medium',abilities:['eWeaken','eBlind'],portraitKey:'raven'}),
    me('Osprey','🦅',58,13,5,6,'berserker',false,'',{acc:78,dodge:15,size:'large',abilities:['eBurn','eStun'],portraitKey:'peregrine'}),
    me('Jackdaw','‍⬛',36,8,3,7,'aggressive',false,'',{acc:72,dodge:18,size:'small',abilities:['eFear','eVenom'],portraitKey:'crow'}),
    me('Thunderhawk','🦅',90,18,9,6,'berserker',true,'🌩 Stage Boss',{acc:82,dodge:12,size:'large',abilities:['eRage','eStun','eFear','eShield'],portraitKey:'harpy'}),
    me('Red-tailed Hawk','🦅',65,15,7,5,'aggressive',false,'',{acc:79,dodge:10,size:'large',abilities:['eBurn','eWeaken'],portraitKey:'peregrine'}),
    me('Peregrine','🦅',70,17,6,8,'aggressive',false,'',{acc:83,dodge:20,size:'medium',abilities:['eStun','eBlind'],portraitKey:'peregrine'}),
    me('Great Horned Owl','🦉',80,16,10,4,'cautious',false,'',{acc:75,dodge:8,size:'large',abilities:['eFear','eHeal','eShield'],portraitKey:'snowyOwl'}),
    me('Harpy Eagle','🦅',88,19,8,5,'berserker',false,'',{acc:82,dodge:10,size:'large',abilities:['eRage','eBurn','ePoison'],portraitKey:'harpy'}),
    me('Crowned Crane','🦩',60,13,7,5,'cautious',false,'',{acc:78,dodge:12,size:'large',abilities:['eFear','eHeal'],portraitKey:'flamingo'}),
    me('Hurricane Crane','🦩',130,26,14,5,'berserker',true,'🌀 Stage Boss',{acc:84,dodge:8,size:'xl',abilities:['eRage','eStun','ePoison','eFear','eShield'],portraitKey:'flamingo'}),
    me('Condor','🦅',95,21,10,4,'cautious',false,'',{acc:78,dodge:6,size:'xl',abilities:['eFear','eHeal','eBlind'],portraitKey:'harpy'}),
    me('Martial Eagle','🦅',110,24,12,5,'aggressive',false,'',{acc:83,dodge:8,size:'xl',abilities:['eBurn','eRage','eStun'],portraitKey:'baldEagle'}),
    me('Thunderbird','⚡',120,26,11,6,'berserker',false,'',{acc:85,dodge:10,size:'xl',abilities:['ePoison','eBurn','eRage','eStun'],portraitKey:'baldEagle'}),
    me('Seraph Vulture','🦅',135,28,14,4,'cautious',false,'',{acc:80,dodge:5,size:'xl',abilities:['eFear','eHeal','eShield','eBlind'],portraitKey:'shoebill'}),
    me('Phantom Owl','🦉',90,20,12,5,'cautious',false,'',{acc:80,dodge:15,size:'large',abilities:['eFear','eBlind','eWeaken'],portraitKey:'snowyOwl'}),
    me('Sky Sovereign','👑',200,35,18,6,'berserker',true,'👑 Final Boss',{acc:90,dodge:12,size:'xl',abilities:['eRage','eStun','ePoison','eFear','eShield','eBurn'],portraitKey:'baldEagle'}),
  ];
  globalThis.ENEMIES = enemies;
})();
