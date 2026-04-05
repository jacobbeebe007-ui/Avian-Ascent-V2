// ===================== BIOMES =====================
const BIOMES = [
  { id:'wetlands', name:'Black Marsh Wetlands', stageMin:1, stageMax:10, mod:{ enemyPoisonPlus:1 } },
  { id:'cliffs', name:'Razor Cliffline', stageMin:11, stageMax:20, mod:{ enemyCritPlus:0.05 } },
  { id:'stormcoast', name:'Storm Coast', stageMin:21, stageMax:30, mod:{ lightningBonus:0.15 } },
  { id:'court', name:"Blakiston's Court", stageMin:31, stageMax:9999, mod:{ dread:1 } },
];

function getBiomeForStage(stage){
  for(const b of BIOMES){
    if(stage>=b.stageMin && stage<=b.stageMax) return b;
  }
  return BIOMES[BIOMES.length-1];
}
