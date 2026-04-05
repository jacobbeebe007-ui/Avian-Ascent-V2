// Playable bird definitions (legacy 76ac60f)
const BIRDS = {
  // ÔöÇÔöÇ TINY ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  sparrow:{
    name:'Sparrow', portraitKey:'sparrow', tagline:'Swift as wind, strikes like needles.',
    size:'tiny', class:'striker',
    stats:{hp:28,maxHp:28,atk:5,def:2,spd:9,dodge:35,acc:85,mdef:6,matk:6,critChance:10},
    statBars:{HP:28/50,ATK:5/15,SPD:9/10,Dodge:.7,ACC:.85}, color:'#6a8ae8',
    mainAttackId:'multiPeck',
    startAbilities:['multiPeck','dart','windFeint','trackPrey'],
    passive:{id:'windDancer',name:'Wind Dancer',desc:'Every dodge grants +1% permanent dodge (max +15%).',
      onDodge(p){if(!p._windDancerBonus)p._windDancerBonus=0;if(p._windDancerBonus<15){p._windDancerBonus++;p.stats.dodge=Math.min(p.stats.dodge+1,100);}}},
  },
  hummingbird:{
    name:'Hummingbird', portraitKey:'hummingbird', tagline:'Blurred wings, needle beak. Zap & zip.',
    size:'tiny', class:'striker',
    unlockRequires:'unlock_hummingbird',
    unlockHint:'Defeat Stage 10 with Sparrow.',
    stats:{hp:25,maxHp:25,atk:7,def:1,spd:12,dodge:55,acc:92,mdef:4,matk:10,critChance:18},
    color:'#40e8c0',
    mainAttackId:'needle_jab',
    startAbilities:['needle_jab','dash','blink_flutter','combo_strike'],
    passive:{id:'hoverBlitz',name:'Hover Blitz',desc:'+2 SPD per dodge (max +10, resets on hit). Crits heal 10% HP.',
      onBattleStart(p){p._hoverStacks=0;},
      onDodge(p){if(!p._hoverStacks)p._hoverStacks=0;if(p._hoverStacks<10){p._hoverStacks+=2;p.stats.spd=Math.min(p.stats.spd+2,20);}},
      onDamage(p){if(p._hoverStacks>0){p.stats.spd=Math.max(p.stats.spd-p._hoverStacks,1);p._hoverStacks=0;}},
      onCrit(p){p.stats.hp=Math.min(p.stats.hp+Math.floor(p.stats.maxHp*.1),p.stats.maxHp);}},
  },

  // ÔöÇÔöÇ SMALL ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  blackbird:{
    name:'Blackbird', portraitKey:'phainopepla', tagline:'Songs that shatter minds. Eyes like embers.',
    size:'small', class:'singer',
    stats:{hp:38,maxHp:38,atk:6,def:3,spd:7,dodge:25,acc:80,mdef:8,matk:14},
    statBars:{HP:38/50,ATK:6/15,SPD:7/10,Dodge:.5,ACC:.8}, color:'#9a6ae8',
    startAbilities:['dark_song','shadow_peck','gloom_wing','grim_sign'],
    mainAttackId:'shadow_peck',
    passive:{id:'songResilient',name:'Song Resilient',desc:'Every successful spell cast, restore 2 HP.',
      onSpell(p){p.stats.hp=Math.min(p.stats.hp+2,p.stats.maxHp);}},
  },
  macaw:{
    name:'Macaw', portraitKey:'macaw', tagline:'Every word is a weapon.',
    size:'small', class:'singer',
    stats:{hp:34,maxHp:34,atk:6,def:3,spd:9,dodge:28,acc:88,mdef:8,matk:14,critChance:8},
    color:'#1a6aba',
    mainAttackId:'echo_note',
    startAbilities:['echo_note','mimic_song','feather_taunt','chorus_mark'],
    passive:{id:'parrot',name:'Parrot',
      desc:'After an enemy uses an ability, gain +5% Dodge for 1 turn (max 20%). Your next Mimic-line spell reads that rhythm for extra payoff.',
      onBattleStart(p){p._macawEchoDodge=0;p._macawCopycatPulse=false;},
      onEnemyAbility(p,abilityId){p._macawEchoDodge=Math.min(20,(p._macawEchoDodge||0)+5);G.playerStatus.humDodge={bonus:p._macawEchoDodge,turns:1};p._macawCopycatPulse=true;}},
  },
  peregrine:{
    name:'Peregrine Falcon', portraitKey:'peregrine', tagline:'Lock. Stoop. No survivors.',
    size:'small', class:'striker',
    unlockRequires:'unlock_peregrine',
    unlockHint:'Defeat Stage 20 with Hummingbird.',
    stats:{hp:32,maxHp:32,atk:8,def:3,spd:10,dodge:28,acc:88,critChance:12,mdef:8,matk:8},
    statBars:{HP:32/50,ATK:8/15,SPD:10/10,Dodge:.56,ACC:.88}, color:'#6a8ac8',
    mainAttackId:'talon_jab',
    startAbilities:['talon_jab','dive','keen_eye','aerial_pace'],
    passive:{id:'stoopHunter',name:'Stoop Hunter',desc:'Your first Dive-line strike each battle deals +15% damage and carries extra Pierce pressure.',
      onBattleStart(p){p._peregrineFirstStoop=true;}},
  },
  snowyOwl:{
    name:'Snowy Owl', portraitKey:'snowyOwl', tagline:'The snow listens. Then it falls.',
    size:'small', class:'predator',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:28,maxHp:28,atk:12,def:2,spd:9,dodge:38,acc:92,critChance:15,mdef:3,matk:3},
    statBars:{HP:28/50,ATK:12/15,SPD:9/10,Dodge:.76,ACC:.92}, color:'#e8f0f8',
    mainAttackId:'talon_snap',
    startAbilities:['talon_snap','silent_dive','owl_eye','frost_glide'],
    passive:{id:'moonlitPatience',name:'Moonlit Patience',
      desc:'End a turn without taking damage: +2% crit (max +10%, resets when hit). First Silent Dive each battle deals +10% damage, +8% more if the prey is slowed, weakened, or heavily off-balance.',
      onBattleStart(p){p._owlCritStacks=0;p._owlHitThisTurn=false;p._snowyFirstSilentDive=true;p.stats.critChance=BIRDS.snowyOwl.stats.critChance||15;},
      onTurnEnd(p){if(!p._owlHitThisTurn&&(p._owlCritStacks||0)<10){p._owlCritStacks=(p._owlCritStacks||0)+2;p.stats.critChance=(BIRDS.snowyOwl.stats.critChance||15)+p._owlCritStacks;}p._owlHitThisTurn=false;},
      onDamage(p){p._owlHitThisTurn=true;p._owlCritStacks=0;p.stats.critChance=BIRDS.snowyOwl.stats.critChance||15;},
    },
  },
  kiwi:{
    name:'Kiwi', portraitKey:'kiwi', tagline:'Nocturnal probe. Beak pierces armor like butter.',
    size:'small', class:'predator',
    unlockRequires:'unlock_kiwi',
    unlockHint:'Defeat Stage 20 with Magpie.',
    stats:{hp:34,maxHp:34,atk:8,def:3,spd:8,dodge:48,acc:88,critChance:12,mdef:5,matk:7},
    color:'#a0784a',
    mainAttackId:'beak_jab',
    startAbilities:['beak_jab','night_probe','scent_hunt','scrape'],
    passive:{id:'probeMaster',name:'Probe Master',desc:'Pierce attacks ignore 20-35% DEF (scaling per hit). +10% dmg vs high-HP foes (above 75% HP).',
      get _pierceBase(){return 30;}},
  },
  blackCockatoo:{
    name:'Black Cockatoo', portraitKey:'blackCockatoo', tagline:'Booming crest. Shock, resonance, and heavy wingbeats.',
    size:'medium', class:'bruiser',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:44,maxHp:44,atk:9,def:5,spd:5,dodge:14,acc:80,critChance:8,mdef:9,matk:12},
    color:'#2a1a3a',
    mainAttackId:'beak_crack',
    startAbilities:['beak_crack','boom_call','wing_beat','resonance_mark'],
    passive:{id:'resonantMenace',name:'Resonant Menace',desc:'Boom-line sonic spells ignore 10% M.DEF. Your attacks deal +8% damage vs Feared or Paralyzed foes.',
      get _boomMdefPierce(){return 0.10;}},
  },

  // ÔöÇÔöÇ MEDIUM ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  crow:{
    name:'Crow', portraitKey:'crow', tagline:'Clever. Coordinated. Unsettling.',
    size:'medium', class:'trickster',
    stats:{hp:38,maxHp:38,atk:7,def:4,spd:6,dodge:16,acc:92,mdef:10,matk:7},
    statBars:{HP:38/50,ATK:7/15,SPD:6/10,Dodge:.32,ACC:.92}, color:'#c0c8d8',
    mainAttackId:'peck',
    startAbilities:['peck','murder_murmuration','dread_call','battle_focus'],
    passive:{id:'opportunistInstinct',name:'Opportunist Instinct',desc:'Once each turn, damaging a Feared, Weakened, or Exposed enemy restores 1 EN.',
      onBattleStart(p){p._crowOpportunistReady=true;}},
  },
  kookaburra:{
    name:'Kookaburra', portraitKey:'kookaburra', tagline:'Bush king. Laughing pressure, perch reads, and sudden drops.',
    size:'medium', class:'bruiser',
    unlockRequires:'unlock_kookaburra',
    unlockHint:'Defeat Stage 10 with Macaw.',
    stats:{hp:46,maxHp:46,atk:9,def:5,spd:7,dodge:22,acc:82,mdef:10,matk:8},
    statBars:{HP:46/50,ATK:9/15,SPD:7/10,Dodge:.44,ACC:.82}, color:'#c8a060',
    mainAttackId:'beak_chop',
    startAbilities:['beak_chop','laugh_call','perch_watch','drop_strike'],
    passive:{id:'laughingPerch',name:'Laughing Perch',desc:'Laugh-line sonic spells ignore 8% M.DEF. +5% damage vs Feared or Paralyzed foes. First physical attack each battle always crits. Immune to Fear and Confused. Boss kill resets your opening-strike crit window.',
      immuneFear:true, immuneConfused:true,
      get _laughMdefPierce(){return 0.08;},
      onBattleStart(p){p.firstAttackAlwaysCrit=true;},
      onBossKill(p){p.firstAttackAlwaysCrit=true;spawnFloat('player','­ƒ¬Â Perch Ready!','fn-status');}},
  },
  lyrebird:{
    name:'Lyrebird', portraitKey:'lyrebird', tagline:'The great deceiver. Master of all songs.',
    size:'medium', class:'singer',
    unlockRequires:'unlock_lyrebird',
    unlockHint:'Defeat Stage 20 with Kookaburra.',
    stats:{hp:38,maxHp:38,atk:6,def:4,spd:6,dodge:20,acc:82,critChance:6,mdef:10,matk:14},
    statBars:{HP:38/50,ATK:6/15,SPD:6/10,Dodge:.4,ACC:.82}, color:'#c8902a',
    mainAttackId:'echo_note',
    startAbilities:['echo_note','mimic_chorus','display_step','refrain_mark'],
    passive:{id:'lyreStage',name:'Perfect Mimicry',desc:'First Song each battle repeats at 40% power. After an enemy uses an ability, gain +5% Dodge for 1 turn (max 20%). Your next Mimic-line spell reads that rhythm for extra payoff.',
      onBattleStart(p){
        p._lyrebirdSongEchoUsed=false;
        p._macawEchoDodge=0;
        p._macawCopycatPulse=false;
      },
      onEnemyAbility(p,abilityId){
        p._macawEchoDodge=Math.min(20,(p._macawEchoDodge||0)+5);
        G.playerStatus.humDodge={bonus:p._macawEchoDodge,turns:1};
        p._macawCopycatPulse=true;
      }},
  },
  raven:{
    name:'Raven', portraitKey:'raven', tagline:'The field remembers. You only hurry the ending.',
    size:'medium', class:'trickster',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:38,maxHp:38,atk:8,def:3,spd:7,dodge:22,acc:82,mdef:8,matk:14},
    color:'#6030d0',
    mainAttackId:'beak_jab',
    startAbilities:['beak_jab','omen_call','dark_watch','fate_mark'],
    passive:{id:'omen',name:'Omen of Dread',
      desc:'+12% damage vs Feared enemies. At battle start, a random blessing and a random curse ripple across the fight ÔÇö neither side is spared the sign.',
      onBattleStart(p){
        const blessings=[
          ()=>{p.stats.atk+=4;logMsg('Ôÿá Omen Blessing: +4 ATK!','crit');},
          ()=>{p.stats.dodge=Math.min(p.stats.dodge+15,70);logMsg('Ôÿá Omen Blessing: +15% Dodge!','crit');},
          ()=>{G.player.goldCritMult=Math.min(2.5,Math.max(G.player.goldCritMult||1.5,2.5));logMsg('Ôÿá Omen Blessing: Crit ÔåÆ2.5├ù!','crit');},
          ()=>{p.stats.hp=Math.min(p.stats.hp+Math.floor(p.stats.maxHp*.25),p.stats.maxHp);logMsg('Ôÿá Omen Blessing: +25% HP!','exp-gain');},
        ];
        const curses=[
          ()=>{G.enemyStatus.weaken=4;logMsg('Ôÿá Omen Curse on enemy: Chicken Pox!','system');},
          ()=>{G.enemyStatus.poison={stacks:3,turns:4};logMsg('Ôÿá Omen Curse on enemy: Poison!','system');},
          ()=>{G.enemyStatus.confused={turns:2,skipChance:40};logMsg('Ôÿá Omen Curse on enemy: Confused!','system');},
          ()=>{G.enemy.stats.atk=Math.max(1,Math.floor(G.enemy.stats.atk*.7));logMsg('Ôÿá Omen Curse on enemy: ATK ÔêÆ30%!','system');},
        ];
        blessings[Math.floor(Math.random()*blessings.length)]();
        curses[Math.floor(Math.random()*curses.length)]();
      }},
  },
  magpie:{
    name:'Magpie', portraitKey:'magpie', tagline:'Flashy thief. Swoops in, steals the moment, and slips away.',
    size:'medium', class:'trickster',
    unlockRequires:'unlock_magpie',
    unlockHint:'Defeat Stage 10 with Robin.',
    stats:{hp:40,maxHp:40,atk:7,def:4,spd:9,dodge:34,acc:88,mdef:8,matk:9,critChance:10},
    color:'#2a2a2a',
    mainAttackId:'swoop',
    startAbilities:['swoop','steal_shine','feather_flick','dart'],
    passive:{id:'shinyCollector',name:'Shiny Collector',desc:'+3 shiny after each victory. Once each turn, exploiting a buffed or compromised enemy restores 1 EN.'},
  },


  robin:{
    name:'Robin', portraitKey:'robin', tagline:'Hedge-hop skirmisher. Quick pecks, bright chirps, and a darting finish.',
    size:'small', class:'striker',
    stats:{hp:34,maxHp:34,atk:7,def:3,spd:8,dodge:24,acc:88,mdef:8,matk:8,critChance:8},
    color:'#d86a4c',
    mainAttackId:'quick_peck',
    startAbilities:['quick_peck','dart_rush','bright_chirp','hop_step'],
    passive:{id:'hedgeHunter',name:'Hedge Hunter',desc:'Physical hits grant +2% ACC for this battle (max +12%). Bonus +4% damage vs exposed or accuracy-shaken foes.',
      onBattleStart(p){p._robinAccStacks=0;},
      onPhysicalHit(p){if((p._robinAccStacks||0)<12){p._robinAccStacks=(p._robinAccStacks||0)+2;p.stats.acc=Math.min(100,(p.stats.acc||88)+2);}}},
  },
  bowerbird:{
    name:'Bowerbird', portraitKey:'bowerbird', tagline:'Stage-maker. Builds the bower, lures the eye, and cashes the display.',
    size:'medium', class:'trickster',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:40,maxHp:40,atk:8,def:4,spd:7,dodge:22,acc:86,mdef:9,matk:9},
    color:'#4a6a9a',
    mainAttackId:'trinket_toss',
    startAbilities:['trinket_toss','lure_call','bower_build','display_mark'],
    passive:{id:'collectorInstinct',name:'Collector Instinct',desc:'Your attacks deal +5% damage vs foes who are feared, confused, weakened, or exposed.',
      onBattleStart(){}},
  },

  // ÔöÇÔöÇ LARGE ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  toucan:{
    name:'Toucan', portraitKey:'toucan', tagline:'Oversized bill, vivid pressure, odd reach.',
    size:'large', class:'striker',
    unlockRequires:'unlock_toucan',
    unlockHint:'Enter: "Ahh Ahh Eee Eee Tookie Tookie"',
    stats:{hp:46,maxHp:46,atk:8,def:5,spd:5,dodge:14,acc:82,mdef:9,matk:9,critChance:6},
    statBars:{HP:46/50,ATK:8/15,SPD:5/10,Dodge:.28,ACC:.82}, color:'#60c840',
    /* Neutral beak slot uses id toucan_beak_jab (display "Beak Jab"): global beak_jab is Kiwi/Raven ÔåÆ probeStrike. */
    mainAttackId:'toucan_beak_jab',
    startAbilities:['toucan_beak_jab','beak_slam','fruit_toss','color_mark'],
    passive:{id:'vividReach',name:'Vivid Reach',desc:'Your attacks deal +6% damage vs enemies who are confused, weakened, slowed, or exposed.',
      onBattleStart(){}},
  },
  swan:{
    name:'Swan', portraitKey:'swan', tagline:'Glides in silence. Strikes when the line is set.',
    size:'large', class:'striker',
    unlockRequires:'unlock_swan',
    unlockHint:'Reach Endless Stage 30 with any Striker.',
    stats:{hp:44,maxHp:44,atk:9,def:5,spd:6,dodge:22,acc:86,mdef:10,matk:9,critChance:5},
    color:'#f0f4fc',
    mainAttackId:'neck_jab',
    startAbilities:['neck_jab','wing_sweep','grace_glide','poise_mark'],
    passive:{id:'lineOfGrace',name:'Line of Grace',
      desc:'Your attacks deal +6% damage vs enemies who are exposed, weakened, or suffering significant accuracy loss.',
      onBattleStart(){}},
  },
  flamingo:{
    name:'Flamingo', portraitKey:'flamingo', tagline:'Wading lines. Soft water, hard footing.',
    size:'large', class:'striker',
    unlockRequires:'unlock_flamingo',
    unlockHint:'Reach Endless Stage 30 with any Striker.',
    stats:{hp:48,maxHp:48,atk:8,def:4,spd:6,dodge:18,acc:80,mdef:12,matk:8},
    color:'#e8609a',
    startAbilities:['leg_jab','marsh_sweep','balance_pose','mire_mark'],
    passive:{id:'marshPoise',name:'Marsh Poise',
      desc:'Your attacks deal +6% damage vs slowed or weakened foes, +4% more vs enemies with heavy accuracy loss (10+). Delayed wake damage you trigger is +12% stronger.',
      onBattleStart(){}},
  },
  secretary:{
    name:'Secretary Bird', portraitKey:'secretary', tagline:'Stalking justice. The kick decides.',
    size:'large', class:'predator',
    unlockRequires:'unlock_secretary',
    unlockHint:'Defeat Stage 10 with Crow.',
    stats:{hp:48,maxHp:48,atk:9,def:6,spd:5,dodge:10,acc:80,critChance:8,mdef:10,matk:6},
    statBars:{HP:48/50,ATK:9/15,SPD:5/10,Dodge:.2,ACC:.8}, color:'#e0a060',
    startAbilities:['sec_leg_jab','sec_crushing_kick','hunter_stride','prey_mark'],
    passive:{id:'stiltVerdict',name:'Stilt Verdict',
      desc:'Physical attacks deal +6% vs paralyzed foes, +5% vs slowed foes, and +5% vs enemies below 45% HP. Immune to Poison.',
      immunePoison:true,
      onBattleStart(){}},
  },
  albatross:{
    name:'Albatross', portraitKey:'albatross', tagline:'Vast ocean soarer. Wide wing pressure, patient currents, returning wakes.',
    size:'large', class:'striker',
    unlockRequires:'unlock_albatross',
    unlockHint:'Reach Endless Stage 50 with any bird.',
    stats:{hp:58,maxHp:58,atk:9,def:7,spd:6,dodge:12,acc:80,mdef:9,matk:7,critChance:6},
    color:'#9fb7c9',
    mainAttackId:'alb_wing_jab',
    startAbilities:['alb_wing_jab','alb_ocean_sweep','alb_glide_line','alb_current_mark'],
    passive:{id:'tradeWinds',name:'Trade-Wind Patience',desc:'Every 2 turns, +1 SPD (max 20). Physical attacks deal +6% vs slowed foes.',
      onBattleStart(p){p._oceanWandererTurns=0;},
      onTurnEnd(p){p._oceanWandererTurns=(p._oceanWandererTurns||0)+1;if((p._oceanWandererTurns%2)===0){p.stats.spd=Math.min(20,(p.stats.spd||1)+1);}}},
  },

  seagull:{
    name:'Seagull', portraitKey:'seagull', tagline:'Coastal pest. Harrying swoops, noisy cries, scavengerÔÇÖs payoff.',
    size:'medium', class:'trickster',
    unlockRequires:'unlock_seagull',
    unlockHint:'Reach level 21 in Endless mode with any Trickster.',
    stats:{hp:36,maxHp:36,atk:7,def:3,spd:9,dodge:26,acc:86,mdef:8,matk:8,critChance:10},
    color:'#b0c8d8',
    mainAttackId:'sgl_snap_peck',
    startAbilities:['sgl_snap_peck','sgl_swoop_pass','sgl_raucous_cry','sgl_scavenge_mark'],
    passive:{id:'scavengeFlock',name:'Scavenger\'s Instinct',desc:'+20% damage vs enemies below 60% HP. Summoned mobs steal 5% enemy ATK as SPD (stacks). Immune to Fear.',
      immuneFear:true,
      onBattleStart(p){p._scavengeStacks=0;}},
  },

  // ÔöÇÔöÇ XL ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  goose:{
    name:'Goose', portraitKey:'goose', tagline:'Territorial bruiser. Honk, check, refuse to yield.',
    size:'xl', class:'tank',
    stats:{hp:55,maxHp:55,atk:9,def:7,spd:2,dodge:5,acc:70,mdef:12,matk:4},
    statBars:{HP:55/50,ATK:9/15,SPD:2/10,Dodge:.1,ACC:.7}, color:'#e8c96a',
    startAbilities:['gos_beak_snap','gos_body_check','gos_honk_blast','gos_brace_up'],
    mainAttackId:'gos_beak_snap',
    passive:{id:'bruisedHide',name:'Bruised Hide',desc:'Every 20 HP taken = +1 ATK until battle ends. Takes 20% reduced physical damage.',
      physicalResist:0.20,
      onDamage(p,dmg){if(!p._bruiseAcc)p._bruiseAcc=0;p._bruiseAcc+=dmg;while(p._bruiseAcc>=20){p._bruiseAcc-=20;G.player.stats.atk++;spawnFloat('player','­ƒÆó+ATK','fn-status');}}},
  },
  shoebill:{
    name:'Shoebill Stork', portraitKey:'shoebill', tagline:'Ancient. Patient. Inevitable.',
    size:'xl', class:'tank',
    unlockRequires:'unlock_shoebill',
    unlockHint:'Defeat Stage 10 with Goose.',
    stats:{hp:70,maxHp:70,atk:10,def:10,spd:2,dodge:5,acc:72,critChance:5,mdef:16,matk:6},
    statBars:{HP:70/50,ATK:10/15,SPD:2/10,Dodge:.1,ACC:.72}, color:'#5a7090',
    startAbilities:['sbl_beak_chop','sbl_skull_crack','sbl_still_stance','sbl_dread_mark'],
    mainAttackId:'sbl_beak_chop',
    passive:{id:'prehistoricStare',name:'Prehistoric Stare',desc:'Enemies have 15% chance to skip attack from dread (30% when feared). Immune to Fear & Stun.',
      immuneFear:true, immuneStun:true,
      onEnemyAttackCheck(p,G){const fearBonus=G.enemyStatus.feared>0?15:0;return chance(15+fearBonus);}},
  },
  harpy:{
    name:'Harpy Eagle', portraitKey:'harpy', tagline:'Warlord of the canopy. No mercy.',
    size:'xl', class:'predator',
    unlockRequires:'unlock_harpy',
    unlockHint:'Defeat Stage 20 with Hummingbird.',
    stats:{hp:58,maxHp:58,atk:13,def:6,spd:4,dodge:8,acc:78,critChance:15,mdef:8,matk:6},
    statBars:{HP:58/50,ATK:13/15,SPD:4/10,Dodge:.16,ACC:.78}, color:'#c84030',
    startAbilities:['hrp_talon_clutch','hrp_canopy_crush','hrp_predator_grip','hrp_prey_lock'],
    mainAttackId:'hrp_talon_clutch',
    abilityPool:['physical'],
    passive:{id:'warlordsPath',name:'Talon Apex',desc:'+18% damage vs enemies below 40% HP. Every boss kill permanently raises ATK by 3. Takes 15% reduced magic damage.',
      magicResist:0.15,
      onBossKill(p){p.stats.atk+=3;spawnFloat('player','ÔÜö+3 ATK','fn-crit');}},
  },
  baldEagle:{
    name:'Bald Eagle', portraitKey:'baldEagle', tagline:'Unbreakable. Undying. Undefeated.',
    size:'xl', class:'predator',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:60,maxHp:60,atk:11,def:7,spd:4,dodge:10,acc:78,mdef:10,matk:6},
    color:'#e8e4d8',
    startAbilities:['skyTalon','guard','predatorMark','freedomCry'],
    passive:{id:'lastStand',name:'Last Stand',
      desc:'First time per battle you would die, survive at 1 HP and gain +5 ATK for 3 turns. Immune to Paralysis.',
      immuneParalyze:true,
      onBattleStart(p){p._lastStandUsed=false;},
    },
  },
  penguin:{
    name:'Emperor Penguin', portraitKey:'penguin', tagline:'Ice-clad waddler. Magic slides off its blubber.',
    size:'xl', class:'tank',
    unlockRequires:'unlock_penguin',
    unlockHint:'Reach Endless Stage 30 with any Tank.',
    stats:{hp:65,maxHp:65,atk:9,def:9,spd:3,dodge:12,acc:75,mdef:14,matk:5},
    color:'#3a5878',
    startAbilities:['icebreakerHonk','snowWall','guard','tundraCall'],
    passive:{id:'blubberCoat',name:'Blubber Coat',desc:'Reduces all magic damage by 25ÔÇô40% (scales with missing HP). Waddle applies Lullaby (15% skip/turn) on attack.',
      get _baseMagicReduce(){return 0.25;},
      onMagicHit(p,dmg){const hpPct=p.stats.hp/p.stats.maxHp;return Math.floor(dmg*(1-(0.25+(1-hpPct)*0.15)));},
    },
  },
  ostrich:{
    name:'Ostrich', portraitKey:'ostrich', tagline:'Flightless thunder. Charges build to earth-shaking fury.',
    size:'xl', class:'bruiser',
    unlockRequires:'unlock_ostrich',
    unlockHint:'Defeat Stage 20 with Shoebill.',
    stats:{hp:72,maxHp:72,atk:12,def:8,spd:1,dodge:5,acc:70,mdef:10,matk:4},
    color:'#b89060',
    startAbilities:['powerKick','stampedeStrike','sandKick','momentumCharge'],
    passive:{id:'rageCharge',name:'Desert Strider',desc:'Dodging grants +2 SPD for 2 turns. Heavy attacks charge over 2ÔÇô3 turns (+50% dmg/turn). Misses reset charge. Immune to Slow.',
      immuneSlow:true,
      onBattleStart(p){p._rageCharge=0;},
      onDodge(p){
        if(p._desertStriderBonus){p.stats.spd=Math.max(1,(p.stats.spd||1)-p._desertStriderBonus);}
        p._desertStriderBonus=2;
        p.stats.spd=Math.min(20,(p.stats.spd||1)+2);
        G.playerStatus.desertStrider={turns:2,spd:2};
      }},
  },

  cassowary:{
    name:'Cassowary', tagline:'Jungle juggernaut. Bone-crushing kicks and armored hide.',
    size:'xl', class:'bruiser',
    unlockRequires:'juvenileWin',
    unlockHint:'Defeat Stage 20 on Normal mode to unlock.',
    stats:{hp:74,maxHp:74,atk:13,def:9,spd:3,dodge:8,acc:74,mdef:11,matk:4},
    color:'#3b4a56',
    startAbilities:['raptorKick','warStomp','momentumCharge','crushingTalon'],
    passive:{id:'jungleBulwark',name:'Jungle Bulwark',desc:'Takes 10% reduced physical damage. First heavy hit each battle applies Fear 2t.',
      physicalResist:0.10,
      onBattleStart(p){p._cassFearUsed=false;},
      onPhysicalHit(p,G){if(!p._cassFearUsed){p._cassFearUsed=true;G.enemyStatus.feared=Math.max(G.enemyStatus.feared||0,2);spawnFloat('enemy','­ƒÆÇ Fear!','fn-status');}}},
  },
  emu:{
    name:'Emu', portraitKey:'emu', tagline:'Flightless brute. Kicks and stomps with terrifying force.',
    size:'xl', class:'bruiser',
    unlockRequires:'unlock_emu',
    unlockHint:'Reach Endless Stage 40 with any Tank.',
    stats:{hp:80,maxHp:80,atk:14,def:10,spd:2,dodge:20,acc:72,mdef:10,matk:4},
    color:'#7a6040',
    startAbilities:['headWhip','warCharge','sandKick','momentumStrike'],
    passive:{id:'rumbleStrike',name:'Rumble Strike',desc:'+20% max HP. Counter-attacks on block for 30% ATK. Immune to Stun.',
      immuneStun:true,
      onBattleStart(p){if(!p._emuHPBoosted){p._emuHPBoosted=true;p.stats.maxHp=Math.floor(p.stats.maxHp*1.20);p.stats.hp=p.stats.maxHp;}},
      onBlock(p){const ctr=Math.floor(p.stats.atk*.3);G.enemy.stats.hp-=ctr;spawnFloat('enemy',`ÔÜí-${ctr}`,'fn-dmg');}}
  },
  dukeBlakiston:{
    name:'Duke Blakiston', portraitKey:'duke_blakiston', tagline:'Lord of the court. Commanding, relentless, imperial.',
    size:'xl', class:'predator',
    unlockRequires:'unlock_duke_blakiston',
    unlockHint:"Enter code 'Blakiston' on the selection screen.",
    stats:{hp:68,maxHp:68,atk:11,def:9,spd:6,dodge:12,acc:84,mdef:14,matk:14,critChance:8},
    color:'#6f88c2',
    startAbilities:['nightTalon','nightfallCall','courtSummon','verdict'],
    passive:{id:'imperialEdict',name:'Imperial Edict',desc:'Casting a spell grants +1 MATK (max +4). Defending restores 2 HP.',
      onBattleStart(p){p._dukeMatk=0;},
      onSpell(p){if((p._dukeMatk||0)<4){p._dukeMatk=(p._dukeMatk||0)+1;p.stats.matk=(p.stats.matk||0)+1;}},
      onBlock(p){p.stats.hp=Math.min(p.stats.maxHp,p.stats.hp+2);} }
  },
};

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

globalThis.BIRDS = BIRDS;
