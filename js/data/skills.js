// ============================================================
//  BASE SKILL TEMPLATES
// ============================================================
// Each skill has a levels array describing what each level adds.
// fn = function name called on use.
// ailments = list of ailment ids the skill can apply (for display)
const SKILL_TEMPLATES = {
  // ---- SPARROW ----
  multiPeck:{
    id:'multiPeck', name:'Multi Peck', isBasic:true, type:'physical', btnType:'physical',
    desc:'Neutral sparrow flurry. Repeated pecks before you commit to a branch.',
    baseMissChance:9, baseDmgMult:0.42, pierceDef:0,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'3 hits, 9% miss each. 42% dmg per hit'},
      {lv:2, desc:'3 hits, 8% miss each. 46% dmg per hit'},
      {lv:3, desc:'4 hits, 8% miss each. 46% dmg per hit'},
      {lv:4, desc:'4 hits, 7% miss each. 50% dmg per hit'},
    ]
  },

  rapidPeck:{
    id:'rapidPeck', name:'Rapid Peck', isBasic:true, type:'physical', btnType:'physical',
    desc:'Fast striker flurry. Three reliable pecks with pierce pressure.',
    baseMissChance:8, baseDmgMult:0.55, pierceDef:0,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'3 hits, 8% miss each. 55% dmg per hit'},
      {lv:2, desc:'3 hits, 8% miss each. 55% dmg per hit'},
      {lv:3, desc:'3 hits, 8% miss each. 55% dmg per hit'},
      {lv:4, desc:'3 hits, 8% miss each. 55% dmg per hit'},
    ]
  },

  dart:{
    id:'dart', name:'Dart', type:'physical', btnType:'physical',
    desc:'Fast reliable strike. Striker basic with light Weaken pressure.', ailments:[],
    baseMissChance:12, baseDmgMult:1.0,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'100% dmg, 12% miss'},
      {lv:2, desc:'115% dmg, 10% miss — Weaken 15%', newAilment:'weaken', ailChance:15},
      {lv:3, desc:'130% dmg, 8% miss — Weaken 20%', ailChance:20},
      {lv:4, desc:'145% dmg, 6% miss — Weaken 25%', ailChance:25},
    ]
  },

  trackPrey:{
    id:'trackPrey', name:'Track Prey', type:'utility', btnType:'utility',
    desc:'Neutral sparrow setup. Study the target before specializing the hunt.', ailments:[],
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'Study the target. Your next attack deals +12% damage'},
      {lv:2, desc:'Study the target. Your next attack deals +15% damage'},
      {lv:3, desc:'Study the target. Your next attack deals +18% damage'},
      {lv:4, desc:'Study the target. Your next attack deals +21% damage'},
    ]
  },

  evade:{
    id:'evade', name:'Evade', type:'utility', btnType:'utility',
    desc:'+25% dodge for 3 turns.', ailments:[],
    levels:[
      {lv:1, desc:'+25% dodge 3t'},
      {lv:2, desc:'+30% dodge 3t'},
      {lv:3, desc:'+35% dodge 3t, reduce paralysis chance 50%'},
      {lv:4, desc:'+40% dodge 4t, immune to paralysis'},
    ]
  },
  // ---- BLACKBIRD ----
  blackPeck:{
    id:'blackPeck', name:'Shadow Peck', type:'physical', btnType:'physical',
    desc:'Weak hit, 2nd use always crits.', ailments:[],
    levels:[
      {lv:1, desc:'2nd hit always crits, 15% miss'},
      {lv:2, desc:'Crit now every 2nd, Feather Disease 20%', newAilment:'burning', ailChance:20},
      {lv:3, desc:'Feather Disease 35%, crit dmg ×2.2'},
      {lv:4, desc:'Feather Disease 50%, crit dmg ×2.5, no miss'},
    ]
  },
  dirge:{
    cooldownByLevel:[3,4,5,6],
    id:'dirge', name:'Dirge', type:'spell', btnType:'spell',
    desc:'Song — confuse enemy for 3 turns.', ailments:[],
    levels:[
      {lv:1, desc:'Confuse 3t, 30% skip chance'},
      {lv:2, desc:'Confuse 4t, 40% skip — Paralysis 25%', newAilment:'paralyzed', ailChance:25},
      {lv:3, desc:'Confuse 5t, 45%, Paralysis 40%, 5 poison dmg delayed'},
      {lv:4, desc:'Confuse 6t, 50%, Paralysis 50%, 10 poison delayed, can re-confuse'},
    ]
  },
  lullaby:{
    id:'lullaby', name:'Lullaby', type:'spell', btnType:'spell',
    desc:'Song — slow enemy, reduce ATK 3t.', ailments:[],
    levels:[
      {lv:1, desc:'ATK ×0.6 for 3t'},
      {lv:2, desc:'ATK ×0.5 for 4t, Resonance 15 dmg next turn', newAilment:'delayed', delayDmg:15},
      {lv:3, desc:'ATK ×0.45 for 5t, Resonance 25 dmg'},
      {lv:4, desc:'ATK ×0.35 for 6t, Resonance 40 dmg, also weakens dodge'},
    ]
  },
  // ---- CROW ----
  crowStrike:{
    id:'crowStrike', name:'Strike', type:'physical', btnType:'physical',
    desc:'Standard attack.', ailments:[],
    levels:[
      {lv:1, desc:'10% miss, 100% dmg'},
      {lv:2, desc:'8% miss, 110% dmg — Avian Poison 15%', newAilment:'poison', ailChance:15},
      {lv:3, desc:'6% miss, 125% — Poison 25%', ailChance:25},
      {lv:4, desc:'3% miss, 140% — Poison 35% (endless-safe), Weaken 20%', newAilment:'poison', ailChance:35, newAilment2:'weaken', ailChance2:20},
    ]
  },
  beakSlam:{
    id:'beakSlam', name:'Beak Slam', type:'physical', btnType:'physical',
    desc:'2-handed — stun chance.', ailments:[],
    levels:[
      {lv:1, desc:'18% miss, 140% dmg, 30% stun'},
      {lv:2, desc:'14% miss, 160% dmg, 40% stun — Paralysis 20%', newAilment:'paralyzed', ailChance:20},
      {lv:3, desc:'10% miss, 180% dmg, 50% stun, Paralysis 30%', ailChance:30},
      {lv:4, desc:'8% miss, 200% dmg, 50% stun, Paralysis 40%', ailChance:40},
    ]
  },
  talonRake:{
    id:'talonRake', name:'Talon Rake', type:'physical', btnType:'physical',
    desc:'Two 1-handed strikes — miss risk.', ailments:[],
    levels:[
      {lv:1, desc:'2 hits, 28% miss each, 85% dmg'},
      {lv:2, desc:'2 hits, 22% miss, 100% — Burn 20%', newAilment:'burning', ailChance:20},
      {lv:3, desc:'3 hits, 18% miss, 105% — Burn 30%', ailChance:30},
      {lv:4, desc:'3 hits, 12% miss, 115% — Burn 40%, Poison 20% (endless-safe)', newAilment:'burning', ailChance:40, newAilment2:'poison', ailChance2:20},
    ]
  },
  crowDefend:{
    id:'crowDefend', name:'Defend', type:'utility', btnType:'utility',
    desc:'Brace and raise defense this turn. 2-turn cooldown.', ailments:[],
    levels:[
      {lv:1, desc:'Gain +2 DEF for 1 turn, guard stance active. CD 2t'},
      {lv:2, desc:'Gain +3 DEF for 1 turn, guard stance active. CD 2t'},
      {lv:3, desc:'Gain +4 DEF for 1 turn, guard stance active + thorns. CD 2t'},
      {lv:4, desc:'Gain +5 DEF for 1 turn, guard stance active + stronger thorns. CD 2t'},
    ]
  },
  // Shoebill Stork live kit: sbl_beak_chop / sbl_skull_crack / sbl_still_stance / sbl_dread_mark (family evolution). Legacy id `shoebillClamp` removed — save migration only in legacyBaseAbilityIds + migrateShoebillLegacyFamilySkillSlots.
  // ---- CASSOWARY / EMU (stomp line; Trample + aliases → Serpent Crusher) ----
  serpentCrusher:{
    id:'serpentCrusher', name:'Serpent Crusher', type:'physical', btnType:'physical',
    desc:'Precise beak strike. +30% dmg vs Poisoned enemies. 15% Paralyze.',
    baseMissChance:12,
    levels:[
      {lv:1, desc:'115% dmg (×1.3 vs Poisoned), 12% miss. 15% Paralyze.', newAilment:'paralyzed', ailChance:15},
      {lv:2, desc:'130% dmg, 10% miss. 20% Paralyze.', ailChance:20},
      {lv:3, desc:'145% dmg, 8% miss. 25% Paralyze + Weaken 20% on hit.', newAilment2:'weaken', ailChance2:20},
      {lv:4, desc:'160% dmg, 5% miss. 30% Paralyze + Weaken 30%.', ailChance:30, ailChance2:30},
    ]
  },
  // ---- FLAMINGO ----
  mudLash:{
    id:'mudLash', name:'Mud Lash', type:'physical', btnType:'physical',
    desc:'Whip head in a filtering frenzy — 95% dmg. Consecutive uses scale. Applies Poison.',
    baseMissChance:15, baseDmgMult:0.95,
    levels:[
      {lv:1, desc:'95% dmg (×1.2 if used consecutively), 15% miss. 1-2 Poison stacks. 10% Confuse.', newAilment:'poison', ailChance:100},
      {lv:2, desc:'105% dmg, 12% miss. +1 Poison + heals 10% of dmg dealt.', ailChance:100},
      {lv:3, desc:'115% dmg, 10% miss. +2 Poison, heals 12% of dmg.', ailChance:100},
      {lv:4, desc:'125% dmg, 8% miss. +2 Poison, heals 15%, Confuse 20%.', ailChance:100, newAilment2:'confused', ailChance2:20},
    ]
  },
  // ---- HARPY EAGLE ----
  fleshRipper:{
    id:'fleshRipper', name:'Flesh Ripper', type:'physical', btnType:'physical',
    desc:'Hook and tear with razor beak. 125% dmg. Applies Burn. Bonus vs low-HP.',
    baseMissChance:10,
    levels:[
      {lv:1, desc:'125% dmg, 10% miss. Applies Burn 3t. +15% Crit chance.', newAilment:'burning', ailChance:100},
      {lv:2, desc:'140% dmg, 8% miss. Burn 3t. +20% Crit.', ailChance:100},
      {lv:3, desc:'155% dmg, 6% miss. Burn 4t. +20% Crit. +25% dmg if enemy <50% HP.', ailChance:100},
      {lv:4, desc:'175% dmg, 4% miss. Burn 4t. +25% Crit. +35% dmg if enemy <50% HP.', ailChance:100},
    ]
  },
  // ---- PEREGRINE FALCON ----
  diveGouge:{
    id:'diveGouge', name:'Dive Gouge', type:'physical', btnType:'physical',
    desc:'High-speed stoop ends in beak stab. 150% dmg, 30% miss. Gain +SPD on crit. Pierces DEF.',
    baseMissChance:30, baseDmgMult:1.5, pierceDef:20,
    levels:[
      {lv:1, desc:'150% dmg, 30% miss. Pierce 20% DEF. Crit = +2 SPD next turn.'},
      {lv:2, desc:'165% dmg, 25% miss. Pierce 25% DEF. Gain +3 SPD on crit.'},
      {lv:3, desc:'180% dmg, 20% miss. Pierce 30% DEF. Gain +4 SPD on crit + Weaken 20%', newAilment:'weaken', ailChance:20},
      {lv:4, desc:'200% dmg, 15% miss. Pierce 35% DEF. Gain +5 SPD on crit + Weaken 30%', ailChance:30},
    ]
  },
  // ---- SWAN ----
  serratedSlash:{
    id:'serratedSlash', name:'Serrated Slash', type:'physical', btnType:'physical',
    desc:'Rake with comb-edged beak. Causes Bleed (like Poison, physical). Heals on hit.',
    baseMissChance:12, baseDmgMult:1.05,
    levels:[
      {lv:1, desc:'105% dmg, 12% miss. Bleed DoT (1 stack). Heals 15% HP over 2t.', newAilment:'poison', ailChance:100},
      {lv:2, desc:'118% dmg, 10% miss. 2 Bleed stacks. Cleanse 1 debuff on self.', ailChance:100},
      {lv:3, desc:'130% dmg, 8% miss. 2 Bleed. Cleanse 2 debuffs. +15% crit.', ailChance:100},
      {lv:4, desc:'145% dmg, 6% miss. 3 Bleed. Cleanse all debuffs. +20% crit.', ailChance:100},
    ]
  },
  // ---- BALD EAGLE ----
  fishSnatcher:{
    id:'fishSnatcher', name:'Fish Snatcher', type:'physical', btnType:'physical',
    desc:'Spear-like stab — 120% dmg. 20% chance to Steal enemy buff. Heals vs low-HP.',
    baseMissChance:14,
    levels:[
      {lv:1, desc:'120% dmg, 14% miss. 20% Steal (copy 1 enemy buff). +10% dmg vs <50% HP.'},
      {lv:2, desc:'135% dmg, 11% miss. 25% Steal. +12% vs low HP.'},
      {lv:3, desc:'150% dmg, 8% miss. 30% Steal. Heal 25% of dmg dealt.'},
      {lv:4, desc:'165% dmg, 5% miss. 35% Steal. Heal 30% of dmg dealt + Weaken 15%.', newAilment:'weaken', ailChance:15},
    ]
  },
  // ---- GOOSE ----
  honkAttack:{
    id:'honkAttack', name:'Honk', isBasic:true, isMainAttack:true, type:'physical', btnType:'physical',
    desc:'Booming strike. Tank basic: solid hit with light control chance.', ailments:[],
    baseMissChance:25,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'110% dmg, 25% miss'},
      {lv:2, desc:'125% dmg, 20% miss — 15% Paralysis', newAilment:'paralyzed', ailChance:15},
      {lv:3, desc:'140% dmg, 18% miss — 20% Paralysis', ailChance:20},
      {lv:4, desc:'155% dmg, 12% miss — 25% Paralysis + 10% Stun', ailChance:25},
    ]
  },

  gooseHonk:{
    id:'gooseHonk', name:'Goose HONK', isBasic:true, type:'physical', btnType:'physical',
    desc:'Territorial blast. Tank basic with fear pressure, not burst abuse.', ailments:[],
    baseMissChance:24,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'110% dmg, 24% miss'},
      {lv:2, desc:'125% dmg, 20% miss — 20% Fear', newAilment:'feared', ailChance:20},
      {lv:3, desc:'140% dmg, 16% miss — 25% Fear', ailChance:25},
      {lv:4, desc:'155% dmg, 12% miss — 30% Fear + 10% Paralysis', ailChance:30, newAilment2:'paralyzed', ailChance2:10},
    ]
  },

  penguinHonk:{
    id:'penguinHonk', name:'Icebreaker Honk', isBasic:true, type:'physical', btnType:'physical',
    desc:'Frost-laced body check. Ice tank basic with Chilled pressure.', ailments:[],
    baseMissChance:22,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'105% dmg, 22% miss — 20% Chilled', newAilment:'chilled', ailChance:20},
      {lv:2, desc:'120% dmg, 18% miss — 25% Chilled', ailChance:25},
      {lv:3, desc:'135% dmg, 15% miss — 30% Chilled', ailChance:30},
      {lv:4, desc:'150% dmg, 10% miss — 35% Chilled + 10% Paralysis', ailChance:35, newAilment2:'paralyzed', ailChance2:10},
    ]
  },

  headWhip:{
    id:'headWhip', name:'Head Whip', isBasic:true, type:'physical', btnType:'physical',
    desc:'Whiplash neck strike. Bruiser basic with modest Weaken pressure.', ailments:[],
    baseMissChance:18,
    energyByLevel:[1,1,1,1],
    energyCost:1,
    levels:[
      {lv:1, desc:'115% dmg, 18% miss'},
      {lv:2, desc:'130% dmg, 15% miss — 15% Weaken', newAilment:'weaken', ailChance:15},
      {lv:3, desc:'145% dmg, 12% miss — 20% Weaken', ailChance:20},
      {lv:4, desc:'160% dmg, 10% miss — 25% Weaken + 10% Stun', ailChance:25},
    ]
  },

  intimidate:{
    id:'intimidate', name:'Intimidate', type:'utility', btnType:'utility',
    desc:'Fear enemy 2 turns. 2-turn cooldown.', ailments:[],
    levels:[
      {lv:1, desc:'Fear 2t, CD 2t'},
      {lv:2, desc:'Fear 3t, Weaken 30%, CD 2t', newAilment:'weaken', ailChance:30},
      {lv:3, desc:'Fear 4t, Weaken 45%, 15 fear dmg, CD 1t'},
      {lv:4, desc:'Fear 5t, Weaken 60%, 25 fear dmg, no CD'},
    ]
  },
  roost:{
    id:'roost', name:'Roost', type:'utility', btnType:'utility',
    desc:'Heal next turn and cleanse debuffs (tank-only learnable).', ailments:[],
    cooldownByLevel:[2,2,3,3],
    levels:[
      {lv:1, desc:'Heal 25% next turn'},
      {lv:2, desc:'Heal 30% next turn, cleanse 1 status'},
      {lv:3, desc:'Heal 38% next turn, cleanse all debuffs + 1 control ailment'},
      {lv:4, desc:'Heal 45% next turn, full cleanse (all debuffs + control ailments), uninterruptable'},
    ]
  },

  // ---- NEW BIRD ABILITIES ----
  bleakBeak:{
    id:'bleakBeak', name:'Bleak Beak', type:'physical', btnType:'physical',
    isNeutral:false, allowedClasses:['singer','trickster'],
    energyByLevel:[1,1,1,1], energyCost:1, cooldownByLevel:[0,0,0,0],
    desc:'Caster basic peck. Lower damage, dependable setup tool.', ailments:[],
    levels:[
      {lv:1, desc:'85% damage'},
      {lv:2, desc:'95% damage'},
      {lv:3, desc:'105% damage'},
      {lv:4, desc:'115% damage'},
    ]
  },

  shadowJab:{
    id:'shadowJab', name:'Shadow Jab', type:'physical', btnType:'physical',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[1,1,1,1], energyCost:1, cooldownByLevel:[0,0,0,0],
    desc:'Singer basic strike. Slightly low damage with light Fear pressure.', ailments:[],
    levels:[
      {lv:1, desc:'80% damage + 15% Fear', newAilment:'feared', ailChance:15},
      {lv:2, desc:'90% damage + 20% Fear', ailChance:20},
      {lv:3, desc:'100% damage + 25% Fear', ailChance:25},
      {lv:4, desc:'110% damage + 30% Fear', ailChance:30},
    ]
  },

  pinionVolley:{
    id:'pinionVolley', name:'Pinion Volley', type:'ranged', btnType:'ranged',
    isNeutral:false, allowedClasses:['trickster','striker'],
    energyByLevel:[1,1,1,1], cooldownByLevel:[1,1,1,1],
    piercePctByLevel:[0.25,0.30,0.35,0.40],
    desc:'Striker payoff basic-skill hybrid. Two reliable piercing hits.',
    levels:[
      {lv:1, desc:'2×52% hits, pierce 25% DEF'},
      {lv:2, desc:'2×60% hits, pierce 30% DEF'},
      {lv:3, desc:'2×68% hits, pierce 35% DEF'},
      {lv:4, desc:'2×76% hits, pierce 40% DEF'},
    ]
  },

  shieldWing:{
    id:'shieldWing', name:'Shield-Wing', type:'utility', btnType:'utility',
    isNeutral:false, allowedClasses:['tank','bruiser','predator'],
    energyByLevel:[1,1,1,1], cooldownByLevel:[2,2,2,2],
    desc:'Core tank/bruiser setup skill. Gain Guard and stabilize.',
    levels:[
      {lv:1, desc:'Gain reduced damage based on DEF'},
      {lv:2, desc:'Gain more damage reduction + cleanse 1 debuff'},
      {lv:3, desc:'Gain high damage reduction + cleanse 1 debuff'},
      {lv:4, desc:'Gain very high damage reduction + cleanse 2 debuffs'},
    ]
  },

  ironHonk:{
    id:'ironHonk', name:'Iron Honk', type:'physical', btnType:'physical',
    isNeutral:false, allowedClasses:['tank'],
    energyByLevel:[1,1,1,1], cooldownByLevel:[2,2,2,2],
    desc:'Tank setup strike. Low damage, guaranteed Weaken pressure.',
    levels:[
      {lv:1, desc:'60% damage + Weaken'},
      {lv:2, desc:'70% damage + stronger Weaken', newAilment:'weaken', ailChance:100},
      {lv:3, desc:'80% damage + stronger Weaken'},
      {lv:4, desc:'90% damage + strongest Weaken'},
    ]
  },

  dirgeOfDread:{
    id:'dirgeOfDread', name:'Dirge of Dread', type:'spell', btnType:'spell',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[1,1,2,2], cooldownByLevel:[2,2,3,3],
    desc:'Control song that applies Fear + Weaken. Utility first, damage second.', ailments:[],
    levels:[
      {lv:1, desc:'50% MATK, Fear 2t, Weaken 2t'},
      {lv:2, desc:'60% MATK, stronger control'},
      {lv:3, desc:'70% MATK, stronger control'},
      {lv:4, desc:'82% MATK, strongest control'},
    ]
  },

  skyHymn:{
    id:'skyHymn', name:'Sky Hymn', type:'spell', btnType:'spell',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[1,1,2,2], cooldownByLevel:[2,2,2,3],
    desc:'Singer song with small healing and momentum. Reliable, not explosive.', ailments:[],
    levels:[
      {lv:1, desc:'Small heal + momentum'},
      {lv:2, desc:'Moderate heal + momentum'},
      {lv:3, desc:'Better heal + momentum'},
      {lv:4, desc:'Strong heal + momentum'},
    ]
  },

  marshHex:{
    id:'marshHex', name:'Marsh Hex', type:'spell', btnType:'spell',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[2,2,3,3], cooldownByLevel:[2,2,3,3],
    desc:'Singer payoff spell. Strong debuffing burst, not instant-delete damage.', ailments:[],
    levels:[
      {lv:1, desc:'118% MATK + Weaken/Fear'},
      {lv:2, desc:'132% MATK + stronger debuffs'},
      {lv:3, desc:'148% MATK + stronger debuffs'},
      {lv:4, desc:'165% MATK + strongest debuffs'},
    ]
  },

  stormCall:{
    id:'stormCall', name:'Storm Call', type:'spell', btnType:'spell',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[2,2,3,3], cooldownByLevel:[3,3,4,4],
    desc:'Heavy lightning spell with clear cooldown and burst role.', ailments:[],
    levels:[
      {lv:1, desc:'135% MATK + Paralysis chance'},
      {lv:2, desc:'150% MATK + stronger paralysis'},
      {lv:3, desc:'170% MATK + stronger paralysis'},
      {lv:4, desc:'190% MATK + strongest paralysis'},
    ]
  },

  nightChill:{
    id:'nightChill', name:'Night Chill', type:'spell', btnType:'spell',
    isNeutral:false, allowedClasses:['singer'],
    energyByLevel:[1,1,2,2], cooldownByLevel:[2,2,2,2],
    desc:'Singer setup spell. Moderate damage with reliable Slow/Chilled pressure.', ailments:[],
    levels:[
      {lv:1, desc:'90% MATK + Slow'},
      {lv:2, desc:'102% MATK + stronger Slow'},
      {lv:3, desc:'116% MATK + stronger Slow'},
      {lv:4, desc:'130% MATK + strongest Slow'},
    ]
  },

  // ---- KOOKABURRA ----
  bashUp:{
    id:'bashUp', name:'Bash-Up', type:'physical', btnType:'physical',
    desc:'100% atk, 20% miss. If Sit & Wait was active, hits TWICE at 15% miss.',
    baseMissChance:20,
    levels:[
      {lv:1, desc:'100% dmg, 20% miss. Double-hit if after Sit & Wait (15% miss)'},
      {lv:2, desc:'115% dmg, 16% miss. Double-hit: Weaken 20%', newAilment:'weaken', ailChance:20},
      {lv:3, desc:'130% dmg, 12% miss. Double-hit: Weaken 35%', ailChance:35},
      {lv:4, desc:'150% dmg, 8% miss. Double-hit: Weaken 50%, 15% stun'},
    ]
  },
  sitAndWait:{
    id:'sitAndWait', name:'Sit & Wait', type:'utility', btnType:'utility',
    desc:'Ambush stance — buff ATK+15%, ACC+15%. 30% spotted chance (fails if spotted). 2 buffs: max 3t.',
    levels:[
      {lv:1, desc:'ATK+15%, ACC+15% next turn. 30% spotted = fail'},
      {lv:2, desc:'ATK+20%, ACC+20%. 25% spotted'},
      {lv:3, desc:'ATK+25%, ACC+25%. 20% spotted'},
      {lv:4, desc:'ATK+30%, ACC+30%. 15% spotted, reduces all CDs by 1'},
    ]
  },
  theJoker:{
    cooldownByLevel:[3,4,5,6],
    id:'theJoker', name:'The Joker', type:'spell', btnType:'spell',
    desc:'Confuse 2t (20% skip) + Weaken (0.8× ATK). Scales with upgrades.',
    levels:[
      {lv:1, desc:'Confuse 2t 20% skip + Weaken 0.8× for 2t'},
      {lv:2, desc:'Confuse 3t 30% skip + Weaken 0.7× for 3t — Paralysis 15%', newAilment:'paralyzed', ailChance:15},
      {lv:3, desc:'Confuse 3t 40% skip + Weaken 0.6× for 4t + Poison 20%', newAilment2:'poison', ailChance2:20},
      {lv:4, desc:'Confuse 4t 50% skip + Weaken 0.5× for 4t + Poison 30%, also Burn 20%', ailChance2:30, newAilment3:'burning', ailChance3:20},
    ]
  },
  // ---- MACAW ----
  breakClamp:{
    id:'breakClamp', name:'Beak Clamp', type:'physical', btnType:'physical', autoChain:true,
    desc:'Heavy beak clamp — auto-repeats until it misses. Each consecutive hit +15% DMG (max 3 stacks).',
    baseMissChance:20, baseDmgMult:1.1,
    levels:[
      {lv:1, desc:'110% dmg, 20% miss. Auto-repeats, +15% per hit. Max +45% at 3rd hit.'},
      {lv:2, desc:'120% dmg, 17% miss. +18% per hit.'},
      {lv:3, desc:'130% dmg, 14% miss. +21% per hit + Weaken 15% on 3rd hit.', newAilment:'weaken', ailChance:15},
      {lv:4, desc:'145% dmg, 11% miss. +25% per hit + Weaken 25%.', ailChance:25},
    ]
  },
  // ---- SHARED / ALIAS TARGET (e.g. bodkin_bite) — not Kiwi slot-state; Kiwi uses beak_jab → probeStrike ----
  silentPierce:{
    id:'silentPierce', name:'Silent Pierce', type:'physical', btnType:'physical',
    desc:'Stealthy beak thrust — high accuracy, chance to Fear. Ignores enemy DEF.',
    baseMissChance:5, pierceDef:15,
    levels:[
      {lv:1, desc:'110% dmg, 5% miss. Pierce 15% DEF. 15% Fear.', newAilment:'feared', ailChance:15},
      {lv:2, desc:'125% dmg, 4% miss. Pierce 22% DEF. 20% Fear.', ailChance:20},
      {lv:3, desc:'140% dmg, 3% miss. Pierce 28% DEF. 25% Fear + if already feared: +20% crit.', ailChance:25},
      {lv:4, desc:'160% dmg, 2% miss. Pierce 35% DEF. 30% Fear + reapplies status ailments.', ailChance:30},
    ]
  },
  // ---- TOUCAN ----
  serratedBill:{
    id:'serratedBill', name:'Serrated Bill', isBasic:true, type:'physical', btnType:'physical',
    desc:'Rogue/trickster basic. Rewards repeated use with stacking damage.',
    baseMissChance:18, baseDmgMult:0.82,
    energyByLevel:[1,1,1,1], energyCost:1,
    levels:[
      {lv:1, desc:'82% dmg, 18% miss. +20% per consecutive use (max 5 stacks)'},
      {lv:2, desc:'92% base dmg, 15% miss — Burn 12% at max stacks', newAilment:'burning', ailChance:12},
      {lv:3, desc:'102% base dmg, 12% miss — Burn 20%, Weaken 15%', ailChance:20, newAilment2:'weaken', ailChance2:15},
      {lv:4, desc:'115% base dmg, 10% miss — Burn 30%, Weaken 25%, cap raised', ailChance:30, ailChance2:25},
    ]
  },

  tookieTookie:{
    id:'tookieTookie', name:'Tookie Tookie', type:'spell', btnType:'spell',
    desc:'Song: +50% ATK, +20% miss chance for 2 turns. "Ahh Ahh, Eee Eee!"',
    levels:[
      {lv:1, desc:'ATK ×1.5, miss +20% for 2t'},
      {lv:2, desc:'ATK ×1.65, miss +15%, DEF +3 for 2t'},
      {lv:3, desc:'ATK ×1.8, miss +12%, DEF +4, Crit +15% for 3t'},
      {lv:4, desc:'ATK ×2.0, miss +8%, DEF +5, Crit +25%, 3t — fear immune'},
    ]
  },
  fruitSweetener:{
    id:'fruitSweetener', name:'Fruit Sweetener', type:'utility', btnType:'utility',
    desc:'Heal 15% HP instantly. 2-turn cooldown.',
    levels:[
      {lv:1, desc:'Heal 15% HP. CD 2t'},
      {lv:2, desc:'Heal 22% HP. CD 2t. Also restores 1 cleanse'},
      {lv:3, desc:'Heal 28% HP. CD 1t'},
      {lv:4, desc:'Heal 35% HP. No CD. Also grants +10% dodge for 2t'},
    ]
  },
  // ---- HUMMINGBIRD ----
  nectarJab:{
    id:'nectarJab', name:'Nectar Jab', isBasic:true, type:'physical', btnType:'physical',
    desc:'Small-bird flurry basic. Multi-hit, precision-focused, not free spam.',
    baseMissChance:8, baseDmgMult:0.42,
    energyByLevel:[1,1,1,1], energyCost:1,
    levels:[
      {lv:1, desc:'3 hits ×42% ATK. 8% miss each. 20% Pierce DEF.', pierceChance:20},
      {lv:2, desc:'3 hits ×50% ATK, 6% miss. 25% Pierce + Weaken 12%.', pierceChance:25, newAilment:'weaken', ailChance:12},
      {lv:3, desc:'4 hits ×50% ATK, 5% miss. 30% Pierce.', pierceChance:30},
      {lv:4, desc:'4 hits ×55% ATK, 4% miss. 35% Pierce. Crits apply Bleed; 8% Burn chance.', pierceChance:35, newAilment:'poison', ailChance:35, newAilment2:'burning', ailChance2:8},
    ]
  },

  // ---- KIWI (mechanical base for live `beak_jab` alias) ----
  probeStrike:{
    id:'probeStrike', name:'Probe Strike', isBasic:true, type:'physical', btnType:'physical',
    desc:'Precision pierce basic. Reliable anti-armor option for beak strikers.',
    baseMissChance:8, baseDmgMult:0.96, pierceDef:30,
    energyByLevel:[1,1,1,1], energyCost:1,
    levels:[
      {lv:1, desc:'96% ATK, 8% miss. Ignores 30% DEF. +15% dmg vs high-HP.'},
      {lv:2, desc:'110% ATK, 6% miss. Ignores 38% DEF.'},
      {lv:3, desc:'124% ATK, 5% miss. Ignores 45% DEF + Fear 15%.', newAilment:'feared', ailChance:15},
      {lv:4, desc:'138% ATK, 4% miss. Ignores 55% DEF + Fear 25%. Armor Shred: −2 DEF permanent.', ailChance:25},
    ]
  },

};
