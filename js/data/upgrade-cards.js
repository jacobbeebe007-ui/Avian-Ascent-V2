/* Avian Ascent — UPGRADE_CARDS_REWORK pool (formerly inline in js/core/game.js).
 *
 * Tagged stat / status / synergy cards used by the post-combat reward picker
 * (`getUpgradePool` / `rollUpgradeCard` / `generateBossRewards`). Apply
 * functions reference helpers (`_upgFlatStat`, `_upgFlatMaxHp`,
 * `_upgGoldenFeather`) and `BIRDS` defined in game.js. Those names resolve
 * lazily at call time, so loading this file AFTER game.js is safe.
 *
 * Tag taxonomy: keep tags in sync with js/data/upgrade-card-tags.js
 * (`Avian.data.birdTagWeights`) so the tag-weighted shop draft can prefer
 * archetype-fitting cards.
 */
(function () {
  'use strict';
  /** @type {Array<object>} */
  var cards = [
    // GREY
    {id:'g_feather_lining',tier:'grey',icon:'❤️',name:'Feather Lining',desc:'+8 Max HP',tags:['stat','hp'],apply:p=>_upgFlatMaxHp(p,8)},
    {id:'g_keen_beak',tier:'grey',icon:'🗡️',name:'Keen Beak',desc:'+1 ATK',tags:['stat','atk'],apply:p=>_upgFlatStat(p,'atk',1)},
    {id:'g_spell_feather',tier:'grey',icon:'✨',name:'Spell Feather',desc:'+1 MATK',tags:['stat','matk'],apply:p=>_upgFlatStat(p,'matk',1)},
    {id:'g_feather_guard',tier:'grey',icon:'🛡️',name:'Feather Guard',desc:'+1 DEF',tags:['stat','def'],apply:p=>_upgFlatStat(p,'def',1)},
    {id:'g_warding_down',tier:'grey',icon:'🔷',name:'Warding Down',desc:'+1 MDEF',tags:['stat','mdef'],apply:p=>_upgFlatStat(p,'mdef',1)},
    {id:'g_fleet_step',tier:'grey',icon:'💨',name:'Fleet Step',desc:'+1 SPD',tags:['stat','spd'],apply:p=>_upgFlatStat(p,'spd',1)},
    {id:'g_quick_blood',tier:'grey',icon:'💥',name:'Quick Blood',desc:'+3% crit chance',tags:['stat','crit'],apply:p=>{p.stats.critChance=Math.min(95,(p.stats.critChance||5)+3);}},
    {id:'g_sharpened_finish',tier:'grey',icon:'🩸',name:'Sharpened Finish',desc:'+5% crit damage',tags:['stat','crit'],apply:p=>{p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.05;}},
    {id:'g_focused_eye',tier:'grey',icon:'🎯',name:'Focused Eye',desc:'+4% hit chance',tags:['stat','accuracy'],apply:p=>{p.hitChanceBonus=(p.hitChanceBonus||0)+4;}},
    {id:'g_light_frame',tier:'grey',icon:'🪽',name:'Light Frame',desc:'+3% Dodge',tags:['defense','dodge'],apply:p=>{p.stats.dodge=Math.min(95,(p.stats.dodge||0)+3);}},
    {id:'g_first_bite',tier:'grey',icon:'🦴',name:'First Bite',desc:'First attack each battle +5% damage',tags:['opening','offense'],stackable:false,apply:p=>{p.firstAttackEachBattleBonusPct=Math.max(p.firstAttackEachBattleBonusPct||0,0.05);}},
    {id:'g_guard_posture',tier:'grey',icon:'🛡',name:'Guard Posture',desc:'First hit taken each battle reduced by -10% damage',tags:['defense'],stackable:false,apply:p=>{p.firstHitReduce=Math.max(p.firstHitReduce||0,0.10);}},
    {id:'g_crit_medicine',tier:'grey',icon:'💉',name:'Critical Medicine',desc:'Heal 2 HP on crit',tags:['combat-trigger','sustain'],apply:p=>{p.healOnCrit=(p.healOnCrit||0)+2;}},
    {id:'g_dodge_medicine',tier:'grey',icon:'🪶',name:'Evasive Medicine',desc:'Heal 2 HP on dodge',tags:['combat-trigger','sustain'],apply:p=>{p.healOnDodge=(p.healOnDodge||0)+2;}},
    {id:'g_finish_medicine',tier:'grey',icon:'🦅',name:'Hunter Medicine',desc:'Heal 4 HP on kill',tags:['combat-trigger','sustain'],apply:p=>{p.healOnKill=(p.healOnKill||0)+4;}},
    {id:'g_irritating_peck',tier:'grey',icon:'🩸',name:'Irritating Peck',desc:'Attacks apply Bleed(1) on hit (6% chance)',tags:['status-synergy','bleed'],apply:p=>{p.bleedOnHitChance=(p.bleedOnHitChance||0)+6;}},
    {id:'g_spoiled_thorn',tier:'grey',icon:'☣️',name:'Spoiled Thorn',desc:'Attacks apply Poison(1) on hit (6% chance)',tags:['status-synergy','poison'],apply:p=>{p.poisonOnHitChance=(p.poisonOnHitChance||0)+6;}},
    {id:'g_cold_feather',tier:'grey',icon:'❄️',name:'Cold Feather',desc:'Spells apply Chill(1) on hit (6% chance)',tags:['status-synergy','chill'],apply:p=>{p.chillOnSpellChance=(p.chillOnSpellChance||0)+6;}},
    {id:'g_pain_scent',tier:'grey',icon:'🐾',name:'Pain Scent',desc:'+5% damage vs enemies with any ailment',tags:['status-synergy','ailment'],stackable:false,apply:p=>{p.vsAfflictedPctBonus=Math.max(p.vsAfflictedPctBonus||0,0.05);}},
    // GREEN
    {id:'gr_sturdy_heart',tier:'green',icon:'💚',name:'Sturdy Heart',desc:'+14 Max HP',tags:['stat','hp'],apply:p=>_upgFlatMaxHp(p,14)},
    {id:'gr_razor_talons',tier:'green',icon:'🗡️',name:'Razor Talons',desc:'+2 ATK',tags:['stat','atk'],apply:p=>_upgFlatStat(p,'atk',2)},
    {id:'gr_arcane_plume',tier:'green',icon:'🔮',name:'Arcane Plume',desc:'+2 MATK',tags:['stat','matk'],apply:p=>_upgFlatStat(p,'matk',2)},
    {id:'gr_iron_molt',tier:'green',icon:'🧱',name:'Iron Molt',desc:'+2 DEF',tags:['stat','def'],apply:p=>_upgFlatStat(p,'def',2)},
    {id:'gr_rune_guard',tier:'green',icon:'🌀',name:'Rune Guard',desc:'+2 MDEF',tags:['stat','mdef'],apply:p=>_upgFlatStat(p,'mdef',2)},
    {id:'gr_tailwind',tier:'green',icon:'🌬️',name:'Tailwind',desc:'+2 SPD',tags:['stat','spd'],apply:p=>_upgFlatStat(p,'spd',2)},
    {id:'gr_predators_eye',tier:'green',icon:'👁️',name:"Predator's Eye",desc:'+5% crit chance',tags:['stat','crit'],apply:p=>{p.stats.critChance=Math.min(95,(p.stats.critChance||5)+5);}},
    {id:'gr_execution_habit',tier:'green',icon:'💢',name:'Execution Habit',desc:'+10% crit damage',tags:['stat','crit'],apply:p=>{p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.10;}},
    {id:'gr_calm_focus',tier:'green',icon:'🎯',name:'Calm Focus',desc:'+6% hit chance',tags:['stat','accuracy'],apply:p=>{p.hitChanceBonus=(p.hitChanceBonus||0)+6;}},
    {id:'gr_hard_plumage',tier:'green',icon:'🛡️',name:'Hard Plumage',desc:'First hit taken each battle reduced by -15% damage',tags:['defense'],stackable:false,apply:p=>{p.firstHitReduce=Math.max(p.firstHitReduce||0,0.15);}},
    {id:'gr_field_dressing',tier:'green',icon:'🌿',name:'Field Dressing',desc:'Heal 5 HP on kill',tags:['combat-trigger','sustain'],apply:p=>{p.healOnKill=(p.healOnKill||0)+5;}},
    {id:'gr_slipstream_tonic',tier:'green',icon:'💧',name:'Slipstream Tonic',desc:'Heal 3 HP on dodge',tags:['combat-trigger','sustain'],apply:p=>{p.healOnDodge=(p.healOnDodge||0)+3;}},
    {id:'gr_venom_beak',tier:'green',icon:'☣️',name:'Venom Beak',desc:'Attacks apply Poison(1) on hit (8% chance)',tags:['status-synergy','poison'],apply:p=>{p.poisonOnHitChance=(p.poisonOnHitChance||0)+8;}},
    {id:'gr_serrated_talon',tier:'green',icon:'🩸',name:'Serrated Talon',desc:'Attacks apply Bleed(1) on hit (8% chance)',tags:['status-synergy','bleed'],apply:p=>{p.bleedOnHitChance=(p.bleedOnHitChance||0)+8;}},
    {id:'gr_winter_tongue',tier:'green',icon:'❄️',name:'Winter Tongue',desc:'Spells apply Chill(1) on hit (8% chance)',tags:['status-synergy','chill'],apply:p=>{p.chillOnSpellChance=(p.chillOnSpellChance||0)+8;}},
    {id:'gr_blood_memory',tier:'green',icon:'🦷',name:'Blood Memory',desc:'+10% damage vs Bleeding enemies',tags:['status-synergy','bleed'],stackable:false,apply:p=>{p.vsBleedPctBonus=Math.max(p.vsBleedPctBonus||0,0.10);}},
    {id:'gr_toxic_study',tier:'green',icon:'🧪',name:'Toxic Study',desc:'+10% damage vs Poisoned enemies',tags:['status-synergy','poison'],stackable:false,apply:p=>{p.vsPoisonPctBonus=Math.max(p.vsPoisonPctBonus||0,0.10);}},
    {id:'gr_hunter_of_the_sick',tier:'green',icon:'🪶',name:'Hunter of the Sick',desc:'+10% damage vs enemies with any ailment',tags:['status-synergy','ailment'],stackable:false,apply:p=>{p.vsAfflictedPctBonus=Math.max(p.vsAfflictedPctBonus||0,0.10);}},
    // BLUE
    {id:'b_vital_gale',tier:'blue',icon:'💙',name:'Vital Gale',desc:'+20 Max HP',tags:['stat','hp'],apply:p=>_upgFlatMaxHp(p,20)},
    {id:'b_predator_sight',tier:'blue',icon:'👁️',name:'Predator Sight',desc:'+7% crit chance',tags:['stat','crit'],apply:p=>{p.stats.critChance=Math.min(95,(p.stats.critChance||5)+7);}},
    {id:'b_execution_beak',tier:'blue',icon:'💢',name:'Execution Beak',desc:'Crit damage +15%',tags:['stat','crit'],apply:p=>{p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.15;}},
    {id:'b_iron_feather_mantle',tier:'blue',icon:'🧱',name:'Iron Feather Mantle',desc:'+3 DEF',tags:['stat','def'],apply:p=>_upgFlatStat(p,'def',3)},
    {id:'b_arcane_mantle',tier:'blue',icon:'🔷',name:'Arcane Mantle',desc:'+3 MDEF',tags:['stat','mdef'],apply:p=>_upgFlatStat(p,'mdef',3)},
    {id:'b_hawk_instinct',tier:'blue',icon:'💨',name:'Hawk Instinct',desc:'+3 SPD',tags:['stat','spd'],apply:p=>_upgFlatStat(p,'spd',3)},
    {id:'b_storm_pulse',tier:'blue',icon:'🌩️',name:'Storm Pulse',desc:'First attack each battle is guaranteed to hit',tags:['opening'],stackable:false,apply:p=>{p.firstAttackAlwaysHit=true;}},
    {id:'b_skirmishers_form',tier:'blue',icon:'⚔️',name:"Skirmisher's Form",desc:'+2 ATK, +2 SPD',tags:['hybrid','atk','spd'],apply:p=>{_upgFlatStat(p,'atk',2);_upgFlatStat(p,'spd',2);}},
    {id:'b_runic_guard',tier:'blue',icon:'🔮',name:'Runic Guard',desc:'+2 MATK, +2 MDEF',tags:['hybrid','matk','mdef'],apply:p=>{_upgFlatStat(p,'matk',2);_upgFlatStat(p,'mdef',2);}},
    {id:'b_iron_gale',tier:'blue',icon:'🌪️',name:'Iron Gale',desc:'+2 DEF, +2 SPD',tags:['hybrid','def','spd'],apply:p=>{_upgFlatStat(p,'def',2);_upgFlatStat(p,'spd',2);}},
    {id:'b_predators_mind',tier:'blue',icon:'🧠',name:"Predator's Mind",desc:'+5% hit chance, +5% crit damage',tags:['hybrid','accuracy','crit'],apply:p=>{p.hitChanceBonus=(p.hitChanceBonus||0)+5;p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.05;}},
    {id:'b_deep_cut',tier:'blue',icon:'🩸',name:'Deep Cut',desc:'Bleed applied by you gains +1 stack',tags:['status-synergy','bleed'],stackable:false,apply:p=>{p.bleedBonusStacks=Math.max(p.bleedBonusStacks||0,1);}},
    {id:'b_venom_reservoir',tier:'blue',icon:'☣️',name:'Venom Reservoir',desc:'Poison lasts +1 turn',tags:['status-synergy','poison'],stackable:false,apply:p=>{p.poisonExtraTurns=Math.max(p.poisonExtraTurns||0,1);}},
    {id:'b_frozen_nerve',tier:'blue',icon:'❄️',name:'Frozen Nerve',desc:'Chill lasts +1 turn',tags:['status-synergy','chill'],stackable:false,apply:p=>{p.chillExtraTurns=Math.max(p.chillExtraTurns||0,1);}},
    {id:'b_blood_tracker',tier:'blue',icon:'🦴',name:'Blood Tracker',desc:'+15% damage vs Bleeding enemies',tags:['status-synergy','bleed'],stackable:false,apply:p=>{p.vsBleedPctBonus=Math.max(p.vsBleedPctBonus||0,0.15);}},
    {id:'b_plague_tracker',tier:'blue',icon:'☠️',name:'Plague Tracker',desc:'+15% damage vs Poisoned enemies',tags:['status-synergy','poison'],stackable:false,apply:p=>{p.vsPoisonPctBonus=Math.max(p.vsPoisonPctBonus||0,0.15);}},
    {id:'b_shatter_instinct',tier:'blue',icon:'🧊',name:'Shatter Instinct',desc:'+15% damage vs Chilled enemies',tags:['status-synergy','chill'],stackable:false,apply:p=>{p.vsChillPctBonus=Math.max(p.vsChillPctBonus||0,0.15);}},
    {id:'b_stacked_misery',tier:'blue',icon:'🕸️',name:'Stacked Misery',desc:'+5% damage per ailment on target (max +15%)',tags:['status-synergy','ailment'],stackable:false,apply:p=>{p.damagePerAilmentPct=Math.max(p.damagePerAilmentPct||0,0.05);p.damagePerAilmentPctCap=Math.max(p.damagePerAilmentPctCap||0,0.15);}},
    {id:'b_opening_drive',tier:'blue',icon:'🚩',name:'Opening Drive',desc:'First attack each battle +15% damage',tags:['opening','offense'],stackable:false,apply:p=>{p.firstAttackEachBattleBonusPct=Math.max(p.firstAttackEachBattleBonusPct||0,0.15);}},
    // PURPLE
    {id:'p_iron_heart',tier:'purple',icon:'💜',name:'Iron Heart',desc:'+28 Max HP',tags:['stat','hp'],apply:p=>_upgFlatMaxHp(p,28)},
    {id:'p_war_talons',tier:'purple',icon:'⚔️',name:'War Talons',desc:'+4 ATK',tags:['stat','atk'],apply:p=>_upgFlatStat(p,'atk',4)},
    {id:'p_void_plumage',tier:'purple',icon:'🪄',name:'Void Plumage',desc:'+4 MATK',tags:['stat','matk'],apply:p=>_upgFlatStat(p,'matk',4)},
    {id:'p_stone_coat',tier:'purple',icon:'🪨',name:'Stone Coat',desc:'+4 DEF',tags:['stat','def'],apply:p=>_upgFlatStat(p,'def',4)},
    {id:'p_runed_hide',tier:'purple',icon:'🔯',name:'Runed Hide',desc:'+4 MDEF',tags:['stat','mdef'],apply:p=>_upgFlatStat(p,'mdef',4)},
    {id:'p_gale_body',tier:'purple',icon:'🌬️',name:'Gale Body',desc:'+4 SPD',tags:['stat','spd'],apply:p=>_upgFlatStat(p,'spd',4)},
    {id:'p_duelist_discipline',tier:'purple',icon:'🎯',name:'Duelist Discipline',desc:'+9% crit chance',tags:['stat','crit'],apply:p=>{p.stats.critChance=Math.min(95,(p.stats.critChance||5)+9);}},
    {id:'p_rending_instinct',tier:'purple',icon:'💥',name:'Rending Instinct',desc:'Crit damage +20%',tags:['stat','crit'],apply:p=>{p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.20;}},
    {id:'p_bloodwind_technique',tier:'purple',icon:'🩸',name:'Bloodwind Technique',desc:'+2 ATK, +2 SPD, +5% crit damage',tags:['hybrid','atk','spd','crit'],apply:p=>{_upgFlatStat(p,'atk',2);_upgFlatStat(p,'spd',2);p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.05;}},
    {id:'p_hexbound_plumage',tier:'purple',icon:'☣️',name:'Hexbound Plumage',desc:'+2 MATK, +2 MDEF, +5% damage vs Poisoned enemies',tags:['hybrid','matk','mdef','poison'],stackable:false,apply:p=>{_upgFlatStat(p,'matk',2);_upgFlatStat(p,'mdef',2);p.vsPoisonPctBonus=Math.max(p.vsPoisonPctBonus||0,0.05);}},
    {id:'p_duelists_frame',tier:'purple',icon:'🪶',name:"Duelist's Frame",desc:'+5% crit chance, +5% crit damage, +5% dodge',tags:['hybrid','crit','dodge'],apply:p=>{p.stats.critChance=Math.min(95,(p.stats.critChance||5)+5);p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.05;p.stats.dodge=Math.min(95,(p.stats.dodge||0)+5);}},
    {id:'p_blood_frenzy',tier:'purple',icon:'🩸',name:'Blood Frenzy',desc:'+20% damage vs Bleeding enemies',tags:['status-synergy','bleed'],stackable:false,apply:p=>{p.vsBleedPctBonus=Math.max(p.vsBleedPctBonus||0,0.20);}},
    {id:'p_venom_scholar',tier:'purple',icon:'☣️',name:'Venom Scholar',desc:'Poison damage +20%',tags:['status-synergy','poison'],stackable:false,apply:p=>{p.poisonTickMult=Math.max(p.poisonTickMult||1,1.20);}},
    {id:'p_carrion_feast',tier:'purple',icon:'🍖',name:'Carrion Feast',desc:'+20% damage vs enemies with 2 or more ailments',tags:['status-synergy','ailment'],stackable:false,apply:p=>{p.vsMultiAfflictedPctBonus=Math.max(p.vsMultiAfflictedPctBonus||0,0.20);p.vsMultiAfflictedMinAilments=Math.max(p.vsMultiAfflictedMinAilments||0,2);}},
    {id:'p_execution_window',tier:'purple',icon:'🪓',name:'Execution Window',desc:'Crits vs afflicted enemies deal +20% crit damage',tags:['status-synergy','crit','ailment'],stackable:false,apply:p=>{p.critVsAfflictedBonusPct=Math.max(p.critVsAfflictedBonusPct||0,0.20);}},
    {id:'p_rot_and_ruin',tier:'purple',icon:'🦠',name:'Rot and Ruin',desc:'+7% damage per ailment on target (max +20%)',tags:['status-synergy','ailment'],stackable:false,apply:p=>{p.damagePerAilmentPct=Math.max(p.damagePerAilmentPct||0,0.07);p.damagePerAilmentPctCap=Math.max(p.damagePerAilmentPctCap||0,0.20);}},
    {id:'p_survivors_molt',tier:'purple',icon:'🪶',name:"Survivor's Molt",desc:'Once per battle below 30% HP, heal 8',tags:['combat-trigger','defense'],stackable:false,apply:p=>{p.survivorMoltHeal=Math.max(p.survivorMoltHeal||0,8);}},
    {id:'p_precision_talon',tier:'purple',icon:'🏹',name:'Precision Talon',desc:'+10% hit chance',tags:['stat','accuracy'],apply:p=>{p.hitChanceBonus=(p.hitChanceBonus||0)+10;}},
    {id:'p_relentless_strike',tier:'purple',icon:'⚔️',name:'Relentless Strike',desc:'First attack each turn deals +10% damage',tags:['opening','offense'],stackable:false,apply:p=>{p.firstAttackEachTurnBonusPct=Math.max(p.firstAttackEachTurnBonusPct||0,0.10);}},
    // GOLD
    {id:'z_king_bloodline',tier:'gold',icon:'👑',name:'King Bloodline',desc:'+36 Max HP',tags:['stat','hp'],stackable:false,apply:p=>_upgFlatMaxHp(p,36)},
    {id:'z_sky_hunter',tier:'gold',icon:'🦅',name:'Sky Hunter',desc:'+5 ATK',tags:['stat','atk'],stackable:false,apply:p=>_upgFlatStat(p,'atk',5)},
    {id:'z_void_hunter',tier:'gold',icon:'🌑',name:'Void Hunter',desc:'+5 MATK',tags:['stat','matk'],stackable:false,apply:p=>_upgFlatStat(p,'matk',5)},
    {id:'z_crown_of_the_four_winds',tier:'gold',icon:'👑',name:'Crown of the Four Winds',desc:'+2 ATK, +2 SPD, +5% crit chance, +5% dodge',tags:['hybrid','atk','spd','crit','dodge'],stackable:false,apply:p=>{_upgFlatStat(p,'atk',2);_upgFlatStat(p,'spd',2);p.stats.critChance=Math.min(95,(p.stats.critChance||5)+5);p.stats.dodge=Math.min(95,(p.stats.dodge||0)+5);}},
    {id:'z_blackstone_sigil',tier:'gold',icon:'🗿',name:'Blackstone Sigil',desc:'+2 MATK, +2 MDEF, +5% hit chance, +5% crit damage',tags:['hybrid','matk','mdef','accuracy','crit'],stackable:false,apply:p=>{_upgFlatStat(p,'matk',2);_upgFlatStat(p,'mdef',2);p.hitChanceBonus=(p.hitChanceBonus||0)+5;p.critDamageBonusPct=(p.critDamageBonusPct||0)+0.05;}},
    {id:'z_golden_feather',tier:'gold',icon:'🪶',name:'Golden Feather',desc:'+1 Max EN (max 3 copies per run)',tags:['unique','energy'],stackable:true,maxStacks:3,runSpawnCap:3,apply:p=>_upgGoldenFeather(p)},
    {id:'z_sky_predator',tier:'gold',icon:'🦅',name:'Sky Predator',desc:'First attack each battle always crits',tags:['unique','offense'],stackable:false,apply:p=>{p.firstAttackAlwaysCrit=true;}},
    {id:'z_blackstone_trophy',tier:'gold',icon:'🏆',name:'Blackstone Trophy',desc:'Enemies start battle with Fear(1)',tags:['unique','control'],stackable:false,apply:p=>{p.openingEnemyFear=Math.max(p.openingEnemyFear||0,1);}},
    {id:'z_tempo_crown',tier:'gold',icon:'⏱️',name:'Tempo Crown',desc:'First physical hit each turn +20% damage',tags:['unique','opening'],stackable:false,apply:p=>{p.firstAttackEachTurnBonusPct=Math.max(p.firstAttackEachTurnBonusPct||0,0.20);}},
    {id:'z_void_rune',tier:'gold',icon:'✨',name:'Void Rune',desc:'Spells gain +25% damage',tags:['unique','magic'],stackable:false,apply:p=>{p.augSpellDmgPct=Math.max(p.augSpellDmgPct||0,0.25);}},
    {id:'z_predators_crest',tier:'gold',icon:'🦴',name:"Predator's Crest",desc:'Attacks gain +25% damage',tags:['unique','physical'],stackable:false,apply:p=>{p.augAttackDmgPct=Math.max(p.augAttackDmgPct||0,0.25);}},
    {id:'z_lord_of_plagues',tier:'gold',icon:'☣️',name:'Lord of Plagues',desc:'+25% damage vs afflicted enemies',tags:['unique','ailment'],stackable:false,apply:p=>{p.vsAfflictedPctBonus=Math.max(p.vsAfflictedPctBonus||0,0.25);}},
    {id:'z_tyrants_wound',tier:'gold',icon:'🩸',name:"Tyrant's Wound",desc:'Enemies suffering Bleed take +25% damage from you',tags:['unique','bleed'],stackable:false,apply:p=>{p.vsBleedPctBonus=Math.max(p.vsBleedPctBonus||0,0.25);}},
    {id:'z_winter_crown',tier:'gold',icon:'❄️',name:'Winter Crown',desc:'Chilled enemies take +25% spell damage from you',tags:['unique','chill','magic'],stackable:false,apply:p=>{p.vsChillSpellPctBonus=Math.max(p.vsChillSpellPctBonus||0,0.25);}},
    {id:'z_fourfold_suffering',tier:'gold',icon:'☠️',name:'Fourfold Suffering',desc:'+8% damage per ailment on target (max +25%)',tags:['unique','ailment','scaling'],stackable:false,apply:p=>{p.damagePerAilmentPct=Math.max(p.damagePerAilmentPct||0,0.08);p.damagePerAilmentPctCap=Math.max(p.damagePerAilmentPctCap||0,0.25);}},
  ];
  globalThis.UPGRADE_CARDS_REWORK = cards;
})();
