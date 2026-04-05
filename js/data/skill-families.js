// Skill family / evolution tables (legacy 76ac60f)
const SKILL_EVOLUTION_LEVEL_INTERVAL = 3;
const FAMILY_EVOLUTION_STATE_VERSION = 12;
const SPARROW_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'rapid', abilityId:'multiPeck'},
  {slotIndex:1, familyId:'dart', abilityId:'dart'},
  {slotIndex:2, familyId:'wind', abilityId:'windFeint'},
  {slotIndex:3, familyId:'mark', abilityId:'trackPrey'},
]);
const SPARROW_SKILL_FAMILIES = Object.freeze({
  rapid:{
    familyId:'rapid', displayName:'Rapid Line', baseAbilityId:'multiPeck', role:'core burst', maxTier:3,
    masteries:[
      {id:'power', name:'Rending Flurry', desc:'+10% Rapid-line damage.'},
      {id:'precision', name:'Needle Rhythm', desc:'Rapid-line attacks gain +5 pierce and -3% miss.'},
      {id:'control', name:'Cruel Pressure', desc:'Rapid-line rider chances gain +10%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'rapidPeck',2:'bodkinStrike',3:'bodkinBarrage'}},
      confuse:{pathId:'confuse', displayName:'Confuse', abilities:{1:'rapidFlap',2:'disruptiveRush',3:'chaosTempest'}},
      poison:{pathId:'poison', displayName:'Poison', abilities:{1:'rapidTalon',2:'venomFlurry',3:'venomStorm'}},
    },
  },
  dart:{
    familyId:'dart', displayName:'Dart Line', baseAbilityId:'dart', role:'filler precision attack', maxTier:3,
    masteries:[
      {id:'power', name:'Sureflight', desc:'+8% Dart-line damage.'},
      {id:'precision', name:'Needle Eye', desc:'Dart-line attacks gain -4% miss chance.'},
      {id:'control', name:'Lingering Barbs', desc:'Dart-line rider chances gain +12%.'},
    ],
    paths:{
      burn:{pathId:'burn', displayName:'Burn', abilities:{1:'searingDart',2:'searingArrow',3:'searingJavelin'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'broadDart',2:'broadArrow',3:'broadJavelin'}},
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'bodkinDart',2:'bodkinArrow',3:'bodkinJavelin'}},
    },
  },
  wind:{
    familyId:'wind', displayName:'Wind Line', baseAbilityId:'windFeint', role:'utility / SPD / defense', maxTier:3,
    masteries:[
      {id:'power', name:'Slipstream Veil', desc:'Wind-line dodge and speed bonuses gain +5.'},
      {id:'precision', name:'Cold Draft', desc:'Wind-line enemy ACC reduction gains +5%.'},
      {id:'control', name:'Calm Eye', desc:'Wind-line effects last 1 extra turn.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'windSlip',2:'slipVeil',3:'phantomGale'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'tailwindFeint',2:'tailwindGust',3:'hyperCurrent'}},
      acc_debuff:{pathId:'acc_debuff', displayName:'Accuracy Down', abilities:{1:'featherDrift',2:'blindingVeil',3:'stormShroud'}},
    },
  },
  mark:{
    familyId:'mark', displayName:'Mark Line', baseAbilityId:'trackPrey', role:'setup / prey targeting', maxTier:3,
    masteries:[
      {id:'power', name:'Focused Quarry', desc:'Mark-line damage bonuses gain +8%.'},
      {id:'precision', name:'Cracked Guard', desc:'Mark-line defense-break exposure gains +6%.'},
      {id:'control', name:'Cull Instinct', desc:'Mark-line execute bonuses gain +10% below 50% HP.'},
    ],
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'markPrey',2:'brandPrey',3:'huntersMark'}},
      def_break:{pathId:'def_break', displayName:'Defense Break', abilities:{1:'exposeWeakness',2:'exposeGuard',3:'quarryBreak'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'predatorMark',2:'predatorBrand',3:'finalHunt'}},
    },
  },
});
const GOOSE_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'gos_beak_snap', slotRole:'filler_close_attack', maxTier:3,
    tierNames:{1:'Snap', 2:'Bite', 3:'Tear'},
    masteries:[
      {id:'power', name:'Angry Pressure', desc:'Beak-line damage and pierce bite harder through armor.'},
      {id:'precision', name:'Territorial Aim', desc:'Beak-line accuracy pressure; bleed and weaken riders improve.'},
      {id:'control', name:'Nasty Hold', desc:'Beak-line debuff riders improve; read path bonus vs compromised rises.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'gos_beak_snap', 2:'gos_hook_bite', 3:'gos_hook_tear'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'gos_raking_snap', 2:'gos_raking_bite', 3:'gos_salt_tear'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'gos_dulling_snap', 2:'gos_grinding_bite', 3:'gos_fading_tear'}},
    },
  },
  body:{
    familyId:'body', displayName:'Body Line', baseAbilityId:'gos_body_check', slotRole:'signature_bruiser_attack', maxTier:3,
    tierNames:{1:'Check', 2:'Slam', 3:'Crush'},
    masteries:[
      {id:'power', name:'Bulk Momentum', desc:'Body-line impact damage scales further; crit route hits harder.'},
      {id:'precision', name:'Line Drive', desc:'Body-line pierce and guard-break stress improve.'},
      {id:'control', name:'Crowd the Lane', desc:'Weaken-on-hit and anti-offense control riders improve.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'gos_body_check', 2:'gos_heavy_slam', 3:'gos_dominance_crush'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'gos_pressing_check', 2:'gos_pressing_slam', 3:'gos_suffocating_crush'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'gos_cracking_check', 2:'gos_break_slam', 3:'gos_collapse_crush'}},
    },
  },
  honk:{
    familyId:'honk', displayName:'Honk Line', baseAbilityId:'gos_honk_blast', slotRole:'disruption_control', maxTier:3,
    tierNames:{1:'Honk', 2:'Blare', 3:'Uproar'},
    masteries:[
      {id:'power', name:'Loud Claim', desc:'Honk-line damage and fear pressure intensify.'},
      {id:'precision', name:'Grating Tone', desc:'Honk-line accuracy breaks cut deeper; speed rally improves.'},
      {id:'control', name:'Field Control', desc:'Honk-line fear and disruption riders improve.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'gos_honk_blast', 2:'gos_dread_blare', 3:'gos_panic_uproar'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'gos_harsh_honk', 2:'gos_wavering_blare', 3:'gos_blinding_uproar'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'gos_keen_honk', 2:'gos_rally_blare', 3:'gos_charge_uproar'}},
    },
  },
  brace:{
    familyId:'brace', displayName:'Brace Line', baseAbilityId:'gos_brace_up', slotRole:'guard_setup', maxTier:3,
    tierNames:{1:'Brace', 2:'Hold', 3:'Stand'},
    masteries:[
      {id:'power', name:'Iron Posture', desc:'Brace-line guard duration and stubborn mitigation improve.'},
      {id:'precision', name:'Measured Lean', desc:'Brace-line next-hit setup and read bonuses improve.'},
      {id:'control', name:'No Ground Given', desc:'Brace-line payoff vs compromised targets improves.'},
    ],
    paths:{
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'gos_brace_up', 2:'gos_hold_line', 3:'gos_stand_fast'}},
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'gos_brace_mark', 2:'gos_press_line', 3:'gos_final_stand'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'gos_read_threat', 2:'gos_read_line', 3:'gos_read_stand'}},
    },
  },
});
const GOOSE_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'gos_beak_snap'},
  {slotIndex:1, familyId:'body', abilityId:'gos_body_check'},
  {slotIndex:2, familyId:'honk', abilityId:'gos_honk_blast'},
  {slotIndex:3, familyId:'brace', abilityId:'gos_brace_up'},
]);
const gooseStartingSkillSlots = GOOSE_SKILL_SLOT_LAYOUT.map(slot=>Object.freeze({
  slotIndex:slot.slotIndex,
  familyId:slot.familyId,
  pathId:null,
  tier:0,
  abilityId:slot.abilityId,
  masteryCount:0,
}));
const BLACKBIRD_SKILL_FAMILIES = Object.freeze({
  song:{
    familyId:'song', displayName:'Song Line', baseAbilityId:'dark_song', slotRole:'core_magic_burst', maxTier:3,
    tierNames:{1:'Song', 2:'Verse', 3:'Anthem'},
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'dread_song', 2:'panic_verse', 3:'night_anthem'}},
      venomous:{pathId:'venomous', displayName:'Venomous', abilities:{1:'venomous_song', 2:'venomous_verse', 3:'venomous_anthem'}},
      hex:{pathId:'hex', displayName:'Hex', abilities:{1:'hex_song', 2:'hex_verse', 3:'doom_anthem'}},
    },
  },
  peck:{
    familyId:'peck', displayName:'Shadow Peck Line', baseAbilityId:'shadow_peck', slotRole:'filler_attack', maxTier:3,
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'raking_peck', 2:'rend_strike', 3:'carrion_barrage'}, damageTypeProgression:{1:'physical', 2:'physical', 3:'physical'}},
      siphon:{pathId:'siphon', displayName:'Siphon', abilities:{1:'siphon_peck', 2:'umbral_strike', 3:'soul_barrage'}, damageTypeProgression:{1:'hybrid', 2:'magic', 3:'magic'}},
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'needle_peck', 2:'bodkin_strike', 3:'splinter_barrage'}, damageTypeProgression:{1:'physical', 2:'physical', 3:'physical'}},
    },
  },
  gloom:{
    familyId:'gloom', displayName:'Gloom Line', baseAbilityId:'gloom_wing', slotRole:'utility', maxTier:3,
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'shade_wing', 2:'veil_wing', 3:'ghost_wing'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'murk_wing', 2:'blind_veil', 3:'eclipse_shroud'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'heavy_wing', 2:'drag_veil', 3:'dusk_field'}},
    },
  },
  sign:{
    familyId:'sign', displayName:'Sign Line', baseAbilityId:'grim_sign', slotRole:'setup', maxTier:3,
    tierNames:{1:'Sign', 2:'Seal', 3:'Doom'},
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'grim_mark', 2:'grave_seal', 3:'harbinger_doom'}},
      def_break:{pathId:'def_break', displayName:'Defense Break', abilities:{1:'crack_guard', 2:'break_seal', 3:'ruin_doom'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'death_sign', 2:'death_seal', 3:'final_omen'}},
    },
  },
});
const BLACKBIRD_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'song', abilityId:'dark_song'},
  {slotIndex:1, familyId:'peck', abilityId:'shadow_peck'},
  {slotIndex:2, familyId:'gloom', abilityId:'gloom_wing'},
  {slotIndex:3, familyId:'sign', abilityId:'grim_sign'},
]);
const blackbirdStartingSkillSlots = BLACKBIRD_SKILL_SLOT_LAYOUT.map(slot=>Object.freeze({
  slotIndex:slot.slotIndex,
  familyId:slot.familyId,
  pathId:null,
  tier:0,
  abilityId:slot.abilityId,
  masteryCount:0,
}));
const CROW_SKILL_FAMILIES = Object.freeze({
  peck:{
    familyId:'peck', displayName:'Peck Line', baseAbilityId:'peck', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Peck', 2:'Jab', 3:'Flurry'},
    masteries:[
      {id:'power', name:'Carrion Instinct', desc:'+10% Peck-line damage.'},
      {id:'precision', name:'Eye For Weakness', desc:'Peck-line attacks gain -4% miss chance and +6% crit vs compromised targets.'},
      {id:'control', name:'Harrier Pressure', desc:'Peck-line rider chances gain +10% and exposed bonuses improve slightly.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'raking_peck', 2:'tearing_jab', 3:'carrion_flurry'}, damageTypeProgression:{1:'physical', 2:'physical', 3:'physical'}},
      hex:{pathId:'hex', displayName:'Hex', abilities:{1:'hex_peck', 2:'umbral_jab', 3:'hex_flurry'}, damageTypeProgression:{1:'hybrid', 2:'magic', 3:'magic'}},
      precision:{pathId:'precision', displayName:'Precision', abilities:{1:'keen_peck', 2:'target_jab', 3:'execution_flurry'}, damageTypeProgression:{1:'hybrid', 2:'hybrid', 3:'hybrid'}},
    },
  },
  murder:{
    familyId:'murder', displayName:'Murmuration Line', baseAbilityId:'murder_murmuration', slotRole:'signature_control', maxTier:3,
    tierNames:{1:'Murmuration', 2:'Swarm', 3:'Murder'},
    masteries:[
      {id:'power', name:'Mob Instinct', desc:'+10% Murmuration-line damage.'},
      {id:'precision', name:'Coordinated Angles', desc:'Murmuration-line attacks gain +8% hit chance and +8% exposed payoff.'},
      {id:'control', name:'Unsettling Wingbeat', desc:'Murmuration-line Fear/Expose chances gain +10%.'},
    ],
    paths:{
      talon:{pathId:'talon', displayName:'Talon', abilities:{1:'harrier_murmuration', 2:'talon_swarm', 3:'blackwing_murder'}, damageTypeProgression:{1:'physical', 2:'physical', 3:'physical'}},
      dread:{pathId:'dread', displayName:'Dread', abilities:{1:'dread_murmuration', 2:'panic_swarm', 3:'murder_of_terror'}, damageTypeProgression:{1:'magic', 2:'magic', 3:'magic'}},
      hunting:{pathId:'hunting', displayName:'Hunting', abilities:{1:'hunting_murmuration', 2:'marking_swarm', 3:'execution_murder'}, damageTypeProgression:{1:'hybrid', 2:'hybrid', 3:'hybrid'}},
    },
  },
  call:{
    familyId:'call', displayName:'Dread Call Line', baseAbilityId:'dread_call', slotRole:'utility_control', maxTier:3,
    tierNames:{1:'Call', 2:'Cry', 3:'Chorus'},
    masteries:[
      {id:'power', name:'Ringing Malice', desc:'Call-line setup grants +6% more damage or stronger payoff values.'},
      {id:'precision', name:'Needling Chorus', desc:'Call-line debuffs last 1 extra turn when possible.'},
      {id:'control', name:'Shaken Nerves', desc:'Call-line Fear and ACC-break values gain +10%.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'ominous_call', 2:'panic_cry', 3:'doom_chorus'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'distracting_call', 2:'mocking_cry', 3:'ruin_chorus'}},
      hunt:{pathId:'hunt', displayName:'Hunt', abilities:{1:'hunting_call', 2:'pack_cry', 3:'kill_chorus'}},
    },
  },
  focus:{
    familyId:'focus', displayName:'Battle Focus Line', baseAbilityId:'battle_focus', slotRole:'setup', maxTier:3,
    tierNames:{1:'Focus', 2:'Plan', 3:'Hunt'},
    masteries:[
      {id:'power', name:'Cold Calculation', desc:'Focus-line damage amp or expose values gain +6%.'},
      {id:'precision', name:'Studied Opening', desc:'Focus-line setups also grant +4% crit on the next attack.'},
      {id:'control', name:'Snatch EN', desc:'Steal-line skills restore 1 extra EN once per use.'},
    ],
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'keen_focus', 2:'hunt_plan', 3:'killer_hunt'}},
      def_break:{pathId:'def_break', displayName:'Defense Break', abilities:{1:'weakpoint_focus', 2:'break_plan', 3:'ruin_hunt'}},
      tempo:{pathId:'tempo', displayName:'Next strike setup', abilities:{1:'opening_focus', 2:'tempo_plan', 3:'perfect_hunt'}},
    },
  },
});
const CROW_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'peck', abilityId:'peck'},
  {slotIndex:1, familyId:'murder', abilityId:'murder_murmuration'},
  {slotIndex:2, familyId:'call', abilityId:'dread_call'},
  {slotIndex:3, familyId:'focus', abilityId:'battle_focus'},
]);
const crowStartingSkillSlots = CROW_SKILL_SLOT_LAYOUT.map(slot=>Object.freeze({
  slotIndex:slot.slotIndex,
  familyId:slot.familyId,
  pathId:null,
  tier:0,
  abilityId:slot.abilityId,
  masteryCount:0,
}));
const MAGPIE_SKILL_FAMILIES = Object.freeze({
  swoop:{
    familyId:'swoop', displayName:'Swoop Line', baseAbilityId:'swoop', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Swoop', 2:'Dive', 3:'Barrage'},
    masteries:[
      {id:'power', name:'Low Pass', desc:'+10% Swoop-line damage.'},
      {id:'precision', name:'Flash of White', desc:'Swoop-line attacks gain -4% miss and better payoff into openings.'},
      {id:'control', name:'Nagging Wings', desc:'Swoop-line bleed/opening riders improve slightly.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'raking_swoop', 2:'tearing_dive', 3:'carrion_flurry'}},
      blindside:{pathId:'blindside', displayName:'Blindside', abilities:{1:'sneak_swoop', 2:'blindside_dive', 3:'cheapshot_flurry'}},
      shinybite:{pathId:'shinybite', displayName:'Shiny Bite', abilities:{1:'gleam_swoop', 2:'pilfer_dive', 3:'thief_flurry'}},
    },
  },
  steal:{
    familyId:'steal', displayName:'Steal Line', baseAbilityId:'steal_shine', slotRole:'trickster_utility', maxTier:3,
    tierNames:{1:'Steal', 2:'Swipe', 3:'Heist'},
    masteries:[
      {id:'power', name:'Polished Prize', desc:'Steal-line next-attack payoff improves by +6%.'},
      {id:'precision', name:'Sticky Fingers', desc:'Steal-line skills strip an extra enemy buff when possible.'},
      {id:'control', name:'Bent Rhythm', desc:'Steal-line energy/expose pressure improves slightly.'},
    ],
    paths:{
      buff:{pathId:'buff', displayName:'Buff', abilities:{1:'shine_snatch', 2:'bright_swipe', 3:'glitter_heist'}},
      tempo:{pathId:'tempo', displayName:'EN / next hit', abilities:{1:'quick_snatch', 2:'tempo_swipe', 3:'momentum_heist'}},
      weakpoint:{pathId:'weakpoint', displayName:'Weakpoint', abilities:{1:'weakpoint_snatch', 2:'crackswipe', 3:'ruin_heist'}},
    },
  },
  flick:{
    familyId:'flick', displayName:'Feather Flick Line', baseAbilityId:'feather_flick', slotRole:'harass_control', maxTier:3,
    tierNames:{1:'Flick', 2:'Toss', 3:'Storm'},
    masteries:[
      {id:'power', name:'Eye-Needler', desc:'Flick-line ACC-break and dodge values improve.'},
      {id:'precision', name:'Side-Step Timing', desc:'Flick-line effects last 1 extra turn when possible.'},
      {id:'control', name:'Heckler', desc:'Flick-line taunt/opening follow-up gains a little more bite.'},
    ],
    paths:{
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'dust_flick', 2:'blinding_toss', 3:'feather_storm'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'feather_slip', 2:'skitter_toss', 3:'phantom_storm'}},
      taunt:{pathId:'taunt', displayName:'Taunt', abilities:{1:'mock_flick', 2:'jeer_toss', 3:'heckle_storm'}},
    },
  },
  dart:{
    familyId:'dart', displayName:'Dart Line', baseAbilityId:'dart', slotRole:'precision_payoff', maxTier:3,
    tierNames:{1:'Dart', 2:'Arrow', 3:'Javelin'},
    masteries:[
      {id:'power', name:'Sharp Trinket', desc:'+10% Dart-line damage.'},
      {id:'precision', name:'Glitter Trajectory', desc:'Dart-line attacks gain -4% miss and +6% pierce.'},
      {id:'control', name:'Opening Angles', desc:'Dart-line payoff versus compromised targets improves slightly.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'broad_dart', 2:'broad_arrow', 3:'broad_javelin'}},
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'bodkin_dart', 2:'bodkin_arrow', 3:'bodkin_javelin'}},
      trickshot:{pathId:'trickshot', displayName:'Trickshot', abilities:{1:'ricochet_dart', 2:'trick_arrow', 3:'phantom_javelin'}},
    },
  },
});
const MAGPIE_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'swoop', abilityId:'swoop'},
  {slotIndex:1, familyId:'steal', abilityId:'steal_shine'},
  {slotIndex:2, familyId:'flick', abilityId:'feather_flick'},
  {slotIndex:3, familyId:'dart', abilityId:'dart'},
]);
const magpieStartingSkillSlots = MAGPIE_SKILL_SLOT_LAYOUT.map(slot=>Object.freeze({
  slotIndex:slot.slotIndex,
  familyId:slot.familyId,
  pathId:null,
  tier:0,
  abilityId:slot.abilityId,
  masteryCount:0,
}));

function cloneBirdSkillFamily(src, overrides={}){
  return Object.freeze({...src, ...overrides});
}

const HUMMINGBIRD_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'needle', abilityId:'needle_jab'},
  {slotIndex:1, familyId:'dash', abilityId:'dash'},
  {slotIndex:2, familyId:'flutter', abilityId:'blink_flutter'},
  {slotIndex:3, familyId:'combo', abilityId:'combo_strike'},
]);
const HUMMINGBIRD_SKILL_FAMILIES = Object.freeze({
  needle:{
    familyId:'needle', displayName:'Needle Line', baseAbilityId:'needle_jab', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Sting',3:'Flurry'},
    masteries:[
      {id:'power', name:'Glass Beak', desc:'+8% Needle-line damage.'},
      {id:'precision', name:'Thread the Needle', desc:'Needle-line attacks gain ÔêÆ3% miss and +4 pierce.'},
      {id:'control', name:'Toxic Pressure', desc:'Needle-line Bleed/Poison riders gain +8%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'needle_jab',2:'needle_sting',3:'needle_flurry'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'razor_jab',2:'razor_sting',3:'razor_flurry'}},
      venom:{pathId:'venom', displayName:'Venom', abilities:{1:'venom_jab',2:'venom_sting',3:'venom_flurry'}},
    },
  },
  dash:{
    familyId:'dash', displayName:'Dash Line', baseAbilityId:'dash', slotRole:'signature_burst', maxTier:3,
    tierNames:{1:'Dash',2:'Rush',3:'Strike'},
    masteries:[
      {id:'power', name:'Velocity Carve', desc:'+10% Dash-line damage.'},
      {id:'precision', name:'Blur Sight', desc:'Dash-line crit routes gain +6% crit chance.'},
      {id:'control', name:'Static Wing', desc:'Shock Paralysis and rending bleed riders gain +10%.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'sonic_dash',2:'critical_rush',3:'blurring_strike'}},
      shock:{pathId:'shock', displayName:'Shock', abilities:{1:'static_dash',2:'shock_rush',3:'storm_blur'}},
      rend:{pathId:'rend', displayName:'Rend', abilities:{1:'hum_vein_dash',2:'hum_tear_rush',3:'hum_red_blur'}},
    },
  },
  flutter:{
    familyId:'flutter', displayName:'Flutter Line', baseAbilityId:'blink_flutter', slotRole:'evasion_utility', maxTier:3,
    tierNames:{1:'Flutter',2:'Blink',3:'Mirage'},
    masteries:[
      {id:'power', name:'Iridescent Veil', desc:'Flutter-line dodge and SPD bonuses gain +4.'},
      {id:'precision', name:'Eye Trick', desc:'Flutter-line enemy ACC penalties gain +5%.'},
      {id:'control', name:'Draft Rider', desc:'Flutter-line buff durations +1 turn when possible.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'blink_flutter',2:'evasive_blink',3:'mirage_flutter'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'rapid_flutter',2:'velocity_blink',3:'hyper_mirage'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'distracting_flutter',2:'blur_blink',3:'shimmer_mirage'}},
    },
  },
  combo:{
    familyId:'combo', displayName:'Combo Line', baseAbilityId:'combo_strike', slotRole:'finisher_setup', maxTier:3,
    tierNames:{1:'Strike',2:'Chain',3:'Finale'},
    masteries:[
      {id:'power', name:'Killer Beat', desc:'Combo-line damage amp and trigger resonance gain +6% / +6 dmg.'},
      {id:'precision', name:'Opening Artist', desc:'Combo-line execute routes gain +8% below-half payoff.'},
      {id:'control', name:'Echo Fighter', desc:'Trigger-path afterbeat follow-up +10 damage.'},
    ],
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'combo_strike',2:'chain_measure',3:'finale_strike'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'finish_strike',2:'kill_chain',3:'flash_finale'}},
      trigger:{pathId:'trigger', displayName:'Trigger', abilities:{1:'trigger_strike',2:'echo_chain',3:'repeat_finale'}},
    },
  },
});

const ROBIN_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'peck', abilityId:'quick_peck'},
  {slotIndex:1, familyId:'dart', abilityId:'dart_rush'},
  {slotIndex:2, familyId:'chirp', abilityId:'bright_chirp'},
  {slotIndex:3, familyId:'hop', abilityId:'hop_step'},
]);
const ROBIN_SKILL_FAMILIES = Object.freeze({
  peck:{
    familyId:'peck', displayName:'Peck Line', baseAbilityId:'quick_peck', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Nip',2:'Tap',3:'Burst'},
    masteries:[
      {id:'power', name:'Field Edge', desc:'+8% Peck-line damage.'},
      {id:'precision', name:'Clean Aim', desc:'Peck-line ÔêÆ3% miss; pierce route +4 pierce.'},
      {id:'control', name:'Redbreast Pressure', desc:'Bleed riders +8%; expose route +4% vs compromised.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'quick_peck',2:'rob_razor_jab',3:'rob_razor_flurry'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'rob_needle_peck',2:'rob_needle_jab',3:'rob_needle_flurry'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'rob_spot_peck',2:'rob_mark_jab',3:'rob_open_flurry'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
    },
  },
  dart:{
    familyId:'dart', displayName:'Dart Line', baseAbilityId:'dart_rush', slotRole:'signature_burst', maxTier:3,
    tierNames:{1:'Rush',2:'Dash',3:'Strike'},
    masteries:[
      {id:'power', name:'Burst Line', desc:'+7% Dart-line damage; return route afterbeat +6.'},
      {id:'precision', name:'Sharp Turn', desc:'Crit route +5 effective crit; pierce on rush +3.'},
      {id:'control', name:'Second Pass', desc:'Bleed burst +8% rider; double-pass afterbeat +10.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'dart_rush',2:'rob_swift_dash',3:'rob_flash_strike'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'rob_rending_rush',2:'rob_rending_dash',3:'rob_rending_strike'}},
      return:{pathId:'return', displayName:'Return', abilities:{1:'rob_passing_rush',2:'rob_return_dash',3:'rob_double_strike'}},
    },
  },
  chirp:{
    familyId:'chirp', displayName:'Chirp Line', baseAbilityId:'bright_chirp', slotRole:'tempo_utility', maxTier:3,
    tierNames:{1:'Chirp',2:'Call',3:'Song'},
    masteries:[
      {id:'power', name:'Morning Cadence', desc:'Speed-path SPD +1 when possible.'},
      {id:'precision', name:'Bright Note', desc:'ACC-break path +4% debuff.'},
      {id:'control', name:'Soft Edge', desc:'Weaken path +1 turn when possible.'},
    ],
    paths:{
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'bright_chirp',2:'rob_rally_call',3:'rob_quick_song'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'rob_distracting_chirp',2:'rob_wavering_call',3:'rob_blur_song'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'rob_dulling_chirp',2:'rob_softening_call',3:'rob_fading_song'}},
    },
  },
  hop:{
    familyId:'hop', displayName:'Hop Line', baseAbilityId:'hop_step', slotRole:'setup_positioning', maxTier:3,
    tierNames:{1:'Step',2:'Hop',3:'Bound'},
    masteries:[
      {id:'power', name:'Lively Feet', desc:'Dodge-path +4% dodge window.'},
      {id:'precision', name:'Hedge Line', desc:'Amp-path next-hit +3%.'},
      {id:'control', name:'Echo Step', desc:'Trigger-path afterbeat chip +8.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'light_step',2:'quick_hop',3:'spring_bound'}},
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'lining_step',2:'hunter_hop',3:'final_bound'}},
      trigger:{pathId:'trigger', displayName:'Trigger', abilities:{1:'trigger_step',2:'echo_hop',3:'repeat_bound'}},
    },
  },
});

/**
 * PreÔÇôfamily-evolution Bowerbird flat-kit and misplaced-generic ids (save migration ONLY).
 * Not registered as live ability aliases ÔÇö `migrateBowerbirdLegacyFamilySkillSlots` + `legacyBaseAbilityIds` rewrite slots to family bases.
 */
const LEGACY_BOWERBIRD_FLAT_SKILL_FOR_MIGRATION = Object.freeze(new Set([
  'decorate','inspireSong','charmDisplay','focusCall',
  'aerialPoop','victoryChant','taunt','battleFocus',
  'windFeint','trackPrey','markPrey','peck','headWhip',
]));

const BOWERBIRD_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'trinket', abilityId:'trinket_toss'},
  {slotIndex:1, familyId:'lure', abilityId:'lure_call'},
  {slotIndex:2, familyId:'build', abilityId:'bower_build'},
  {slotIndex:3, familyId:'display', abilityId:'display_mark'},
]);
const BOWERBIRD_SKILL_FAMILIES = Object.freeze({
  trinket:{
    familyId:'trinket', displayName:'Trinket Line', baseAbilityId:'trinket_toss', slotRole:'filler_control', maxTier:3,
    tierNames:{1:'Toss',2:'Scatter',3:'Scatterstorm'},
    masteries:[
      {id:'power', name:'Oddity Edge', desc:'+8% Trinket-line damage.'},
      {id:'precision', name:'Blindside Eye', desc:'Blindside route +4% vs distracted.'},
      {id:'control', name:'Weaken Craft', desc:'Weaken route +6% rider; gleam expose +1%.'},
    ],
    paths:{
      blindside:{pathId:'blindside', displayName:'Blindside', abilities:{1:'trinket_toss',2:'sharp_scatter',3:'scatterstorm'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'dulling_toss',2:'dulling_scatter',3:'fading_storm'}},
      mark:{pathId:'mark', displayName:'Mark', abilities:{1:'gleam_toss',2:'gleam_scatter',3:'gleam_storm'}},
    },
  },
  lure:{
    familyId:'lure', displayName:'Lure Line', baseAbilityId:'lure_call', slotRole:'signature_bait_attack', maxTier:3,
    tierNames:{1:'Call',2:'Lure',3:'Snare'},
    masteries:[
      {id:'power', name:'Bait Weight', desc:'+7% Lure-line damage; venom route +8% poison rider.'},
      {id:'precision', name:'Glimmer Focus', desc:'Confuse route +4% odds.'},
      {id:'control', name:'Dread Theater', desc:'Fear route +6% fear rider.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'bow_dread_call',2:'bow_dread_lure',3:'bow_dread_snare'}},
      confuse:{pathId:'confuse', displayName:'Confuse', abilities:{1:'glimmer_call',2:'glimmer_lure',3:'glimmer_snare'}},
      toxic:{pathId:'toxic', displayName:'Venom', abilities:{1:'bow_rank_call',2:'bow_acrid_lure',3:'bow_viral_snare'}},
    },
  },
  build:{
    familyId:'build', displayName:'Build Line', baseAbilityId:'bower_build', slotRole:'setup', maxTier:3,
    tierNames:{1:'Build',2:'Shape',3:'Structure'},
    masteries:[
      {id:'power', name:'Workshop', desc:'Amp-path next-hit +4%.'},
      {id:'precision', name:'Stress Lines', desc:'Break-path DEF shred +1.'},
      {id:'control', name:'Shelter Craft', desc:'Guard-path +1 turn when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'bower_build',2:'fine_shape',3:'grand_structure'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'weak_build',2:'split_shape',3:'ruin_structure'}},
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'safe_build',2:'shelter_shape',3:'secure_structure'}},
    },
  },
  display:{
    familyId:'display', displayName:'Display Line', baseAbilityId:'display_mark', slotRole:'payoff_setup', maxTier:3,
    tierNames:{1:'Mark',2:'Display',3:'Finale'},
    masteries:[
      {id:'power', name:'Spotlight', desc:'Expose-path +2% exposed window.'},
      {id:'precision', name:'Curtain Call', desc:'Read-path +3% vs compromised.'},
      {id:'control', name:'Final Bow', desc:'Execute-path +4% low-HP bite.'},
    ],
    paths:{
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'display_mark',2:'open_display',3:'grand_finale'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'read_display',2:'read_stage',3:'read_finale'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'death_mark',2:'death_display',3:'final_display'}},
    },
  },
});

const TOUCAN_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'toucan_beak_jab'},
  {slotIndex:1, familyId:'slam', abilityId:'beak_slam'},
  {slotIndex:2, familyId:'toss', abilityId:'fruit_toss'},
  {slotIndex:3, familyId:'mark', abilityId:'color_mark'},
]);
const TOUCAN_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'toucan_beak_jab', slotRole:'filler_reach_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Lance',3:'Skewer'},
    masteries:[
      {id:'power', name:'Reach Weight', desc:'+6% Beak-line damage; pierce route +4% vs high DEF.'},
      {id:'precision', name:'Bill Geometry', desc:'Beak-line ÔêÆ3% miss and +4 pierce.'},
      {id:'control', name:'Vivid Pierce', desc:'Bleed route +8% rider; expose route +4% vs compromised.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'toucan_beak_jab',2:'beak_lance',3:'beak_skewer'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'toucan_razor_jab',2:'toucan_razor_lance',3:'toucan_razor_skewer'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'toucan_spot_jab',2:'toucan_spot_lance',3:'toucan_open_skewer'}},
    },
  },
  slam:{
    familyId:'slam', displayName:'Slam Line', baseAbilityId:'beak_slam', slotRole:'signature_heavy_attack', maxTier:3,
    tierNames:{1:'Slam',2:'Smash',3:'Crush'},
    masteries:[
      {id:'power', name:'Heavy Chromatic', desc:'+7% Slam-line damage; cull route +8% weaken rider.'},
      {id:'precision', name:'Aim Down the Bill', desc:'Crit route +4 effective crit; shock +6% para.'},
      {id:'control', name:'Commitment', desc:'Shock route +8% paralysis; cull route +1 weaken stack bias.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'beak_slam',2:'bright_smash',3:'prism_crush'}},
      shock:{pathId:'shock', displayName:'Shock', abilities:{1:'shock_slam',2:'static_smash',3:'lock_crush'}},
      cull:{pathId:'cull', displayName:'Cull', abilities:{1:'tou_press_slam',2:'tou_dent_smash',3:'tou_split_crush'}},
    },
  },
  toss:{
    familyId:'toss', displayName:'Toss Line', baseAbilityId:'fruit_toss', slotRole:'projectile_control', maxTier:3,
    tierNames:{1:'Toss',2:'Scatter',3:'Burst'},
    masteries:[
      {id:'power', name:'Tropical Weight', desc:'+6% Toss-line chip; sour route +6% weaken.'},
      {id:'precision', name:'Arc Control', desc:'Bright route +6% confuse; heavy +1 slow turn when possible.'},
      {id:'control', name:'Crowd the Branch', desc:'Toss-line ACC pressure +5%; burst hits +1 when possible.'},
    ],
    paths:{
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'sour_toss',2:'sour_scatter',3:'sour_burst'}},
      confuse:{pathId:'confuse', displayName:'Confuse', abilities:{1:'bright_toss',2:'bright_scatter',3:'bright_burst'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'heavy_toss',2:'heavy_scatter',3:'heavy_burst'}},
    },
  },
  mark:{
    familyId:'mark', displayName:'Color Mark Line', baseAbilityId:'color_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Sign',3:'Focus'},
    masteries:[
      {id:'power', name:'Prism Setup', desc:'Amp-path next-hit +4%; break-path DEF +1.'},
      {id:'precision', name:'Hue Reader', desc:'Read-path +5% vs compromised.'},
      {id:'control', name:'Spotlight', desc:'Break-path lasts +1t when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'color_mark',2:'vivid_sign',3:'prism_focus'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'crack_mark',2:'break_sign',3:'ruin_focus'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'read_mark',2:'read_sign',3:'read_focus'}},
    },
  },
});

const SWAN_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'neck', abilityId:'neck_jab'},
  {slotIndex:1, familyId:'sweep', abilityId:'wing_sweep'},
  {slotIndex:2, familyId:'glide', abilityId:'grace_glide'},
  {slotIndex:3, familyId:'poise', abilityId:'poise_mark'},
]);
const SWAN_SKILL_FAMILIES = Object.freeze({
  neck:{
    familyId:'neck', displayName:'Neck Line', baseAbilityId:'neck_jab', slotRole:'filler_precision_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Lunge',3:'Pierce'},
    masteries:[
      {id:'power', name:'Royal Pierce', desc:'Pierce route +5% vs high DEF; +4 pierce.'},
      {id:'precision', name:'Still Water', desc:'Neck-line ÔêÆ3% miss; bleed route +6% rider.'},
      {id:'control', name:'Opening Stroke', desc:'Expose route +5% compromised payoff.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'neck_jab',2:'neck_lunge',3:'swan_pierce'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'swan_razor_jab',2:'swan_razor_lunge',3:'swan_razor_pierce'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'spot_jab',2:'spot_lunge',3:'open_pierce'}},
    },
  },
  sweep:{
    familyId:'sweep', displayName:'Sweep Line', baseAbilityId:'wing_sweep', slotRole:'signature_burst_attack', maxTier:3,
    tierNames:{1:'Sweep',2:'Arc',3:'Crest'},
    masteries:[
      {id:'power', name:'Silver Crest', desc:'+7% Sweep-line damage; return path +6 delayed.'},
      {id:'precision', name:'Measured Arc', desc:'Crit route +4 effective crit.'},
      {id:'control', name:'Crown Pressure', desc:'Weaken route +8% rider; delayed stacks harder.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'wing_sweep',2:'silver_arc',3:'regal_crest'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'pressing_sweep',2:'pressing_arc',3:'crushing_crest'}},
      return:{pathId:'return', displayName:'Return', abilities:{1:'echo_sweep',2:'return_arc',3:'double_crest'}},
    },
  },
  glide:{
    familyId:'glide', displayName:'Grace Glide Line', baseAbilityId:'grace_glide', slotRole:'posture_utility', maxTier:3,
    tierNames:{1:'Glide',2:'Drift',3:'Waltz'},
    masteries:[
      {id:'power', name:'Downstroke', desc:'Speed path +1 SPD when possible.'},
      {id:'precision', name:'Veil Line', desc:'Dodge path +4% dodge; ACC path +5% enemy ACC down.'},
      {id:'control', name:'Balanced Wing', desc:'ACC-break path +1t when possible.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'grace_glide',2:'swan_ghost_drift',3:'swan_white_waltz'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'light_glide',2:'swift_drift',3:'swan_waltz'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'distracting_glide',2:'veil_drift',3:'blinding_waltz'}},
    },
  },
  poise:{
    familyId:'poise', displayName:'Poise Line', baseAbilityId:'poise_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Poise',3:'Finale'},
    masteries:[
      {id:'power', name:'Finishing Line', desc:'Execute path +4% low-HP bite; amp path +3% next-hit.'},
      {id:'precision', name:'Cold Read', desc:'Break path +1 DEF stress when possible.'},
      {id:'control', name:'Last Measure', desc:'Amp path next-hit +2%; break lasts +1t when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'poise_mark',2:'poised_step',3:'final_poise'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'swan_crack_mark',2:'break_step',3:'ruin_poise'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'swan_death_mark',2:'swan_death_step',3:'swan_finale_strike'}},
    },
  },
});

const FLAMINGO_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'leg', abilityId:'leg_jab'},
  {slotIndex:1, familyId:'sweep', abilityId:'marsh_sweep'},
  {slotIndex:2, familyId:'pose', abilityId:'balance_pose'},
  {slotIndex:3, familyId:'mire', abilityId:'mire_mark'},
]);
const FLAMINGO_SKILL_FAMILIES = Object.freeze({
  leg:{
    familyId:'leg', displayName:'Leg Line', baseAbilityId:'leg_jab', slotRole:'filler_reach_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Sweep',3:'Pierce'},
    masteries:[
      {id:'power', name:'Straight Piercing', desc:'Pierce route +5% vs high DEF; +4 pierce.'},
      {id:'precision', name:'Pink Line', desc:'Leg-line ÔêÆ3% miss; bleed route +6% bleed rider.'},
      {id:'control', name:'Marsh Reader', desc:'Expose route +5% compromised payoff.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'leg_jab',2:'leg_sweep',3:'leg_pierce'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'flm_razor_jab',2:'flm_razor_sweep',3:'flm_razor_pierce'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'flm_spot_jab',2:'flm_spot_sweep',3:'flm_open_pierce'}},
    },
  },
  sweep:{
    familyId:'sweep', displayName:'Marsh Sweep Line', baseAbilityId:'marsh_sweep', slotRole:'signature_control_attack', maxTier:3,
    tierNames:{1:'Sweep',2:'Surge',3:'Crest'},
    masteries:[
      {id:'power', name:'Tidal Pull', desc:'Slow path +1 slow turn when Power+Control mastered; +5% sweep damage.'},
      {id:'precision', name:'Measured Wake', desc:'Weaken path +8% rider; redwake path +6% bleed rider.'},
      {id:'control', name:'Shallow Crown', desc:'Weaken path stacks harder; redwake bleed +4% rider when Control mastered.'},
    ],
    paths:{
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'marsh_sweep',2:'wading_surge',3:'tidal_crest'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'flm_pressing_sweep',2:'flm_pressing_surge',3:'flm_crushing_crest'}},
      redwake:{pathId:'redwake', displayName:'Redwake', abilities:{1:'flm_reed_cut',2:'flm_bog_surge',3:'flm_crimson_crest'}},
    },
  },
  pose:{
    familyId:'pose', displayName:'Balance Pose Line', baseAbilityId:'balance_pose', slotRole:'stance_utility', maxTier:3,
    tierNames:{1:'Pose',2:'Balance',3:'Stance'},
    masteries:[
      {id:'power', name:'White Stillness', desc:'Dodge path +4% dodge; guard path +4 guard pool.'},
      {id:'precision', name:'Glass Water', desc:'ACC-break path +5% enemy ACC down.'},
      {id:'control', name:'Patient Footing', desc:'Guard pool +2; dodge stance +1t when Control mastered.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'balance_pose',2:'grace_balance',3:'white_stance'}},
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'firm_pose',2:'stable_balance',3:'iron_stance'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'distracting_pose',2:'veil_balance',3:'mirage_stance'}},
    },
  },
  mire:{
    familyId:'mire', displayName:'Mire Line', baseAbilityId:'mire_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Mire',3:'Sink'},
    masteries:[
      {id:'power', name:'Sinking Setup', desc:'Amp path next-hit +3%; break path +1 DEF stress.'},
      {id:'precision', name:'Reed-Line Read', desc:'Read path +5% vs compromised targets.'},
      {id:'control', name:'Sticky Marsh', desc:'Amp next-hit +2%; break lasts +1t when Control mastered.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'mire_mark',2:'deep_mire',3:'sinking_mark'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'crack_mire',2:'split_mire',3:'ruin_sink'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'read_mire',2:'read_marsh',3:'read_sink'}},
    },
  },
});

const SECRETARY_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'leg', abilityId:'sec_leg_jab'},
  {slotIndex:1, familyId:'kick', abilityId:'sec_crushing_kick'},
  {slotIndex:2, familyId:'stride', abilityId:'hunter_stride'},
  {slotIndex:3, familyId:'prey', abilityId:'prey_mark'},
]);
const SECRETARY_SKILL_FAMILIES = Object.freeze({
  leg:{
    familyId:'leg', displayName:'Leg Line', baseAbilityId:'sec_leg_jab', slotRole:'filler_reach_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Strike',3:'Pierce'},
    masteries:[
      {id:'power', name:'Stilt Pierce', desc:'Pierce route +5% vs high DEF; +4 pierce.'},
      {id:'precision', name:'Measured Reach', desc:'Leg-line ÔêÆ3% miss; bleed route +6% bleed rider.'},
      {id:'control', name:'Dulling Line', desc:'Weaken route +8% rider; compromised payoff +3%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'sec_leg_jab',2:'sec_leg_strike',3:'sec_leg_pierce'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'sec_razor_jab',2:'sec_razor_strike',3:'sec_razor_pierce'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'sec_dulling_jab',2:'sec_dulling_strike',3:'sec_dulling_pierce'}},
    },
  },
  kick:{
    familyId:'kick', displayName:'Kick Line', baseAbilityId:'sec_crushing_kick', slotRole:'signature_execution_attack', maxTier:3,
    tierNames:{1:'Kick',2:'Stomp',3:'Crush'},
    masteries:[
      {id:'power', name:'Crushing Verdict', desc:'Crit route +6% kick damage; execute route +4% low-HP bite.'},
      {id:'precision', name:'Stamp Focus', desc:'Shock route +6% para rider; crit route +4 effective crit.'},
      {id:'control', name:'Grounded Lock', desc:'Shock route +8% para; crit capstone +5% pierce.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'sec_crushing_kick',2:'sec_hunter_stomp',3:'sec_execution_crush'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'sec_shock_kick',2:'sec_shock_stomp',3:'sec_lock_crush'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'sec_finisher_kick',2:'sec_finisher_stomp',3:'sec_final_crush'}},
    },
  },
  stride:{
    familyId:'stride', displayName:'Hunter Stride Line', baseAbilityId:'hunter_stride', slotRole:'positioning_setup', maxTier:3,
    tierNames:{1:'Stride',2:'Pace',3:'Advance'},
    masteries:[
      {id:'power', name:'Long Step', desc:'Speed path +1 SPD when possible; stride pacing for the kick line.'},
      {id:'precision', name:'Stalking Eye', desc:'Amp path +4% next-hit; dodge path +4% dodge.'},
      {id:'control', name:'Killing Angle', desc:'Amp path +2% next-hit; enemy ACC pressure +3 when possible.'},
    ],
    paths:{
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'hunter_stride',2:'long_pace',3:'predator_advance'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'side_stride',2:'clean_pace',3:'ghost_advance'}},
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'lining_stride',2:'measured_pace',3:'kill_advance'}},
    },
  },
  prey:{
    familyId:'prey', displayName:'Prey Line', baseAbilityId:'prey_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Sight',3:'Collapse'},
    masteries:[
      {id:'power', name:'Collapse Setup', desc:'Amp path next-hit +3%; break path +1 DEF stress.'},
      {id:'precision', name:'Weak Line', desc:'Read path +5% vs compromised.'},
      {id:'control', name:'Pinned Quarry', desc:'Break lasts +1t when possible; read +2%.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'prey_mark',2:'hunter_sight',3:'prey_collapse'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'open_mark',2:'weak_sight',3:'ruin_collapse'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'read_prey',2:'read_sight',3:'read_collapse'}},
    },
  },
});

const ALBATROSS_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'wing', abilityId:'alb_wing_jab'},
  {slotIndex:1, familyId:'sweep', abilityId:'alb_ocean_sweep'},
  {slotIndex:2, familyId:'glide', abilityId:'alb_glide_line'},
  {slotIndex:3, familyId:'current', abilityId:'alb_current_mark'},
]);
const ALBATROSS_SKILL_FAMILIES = Object.freeze({
  wing:{
    familyId:'wing', displayName:'Wing Line', baseAbilityId:'alb_wing_jab', slotRole:'filler_reach_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Sweep',3:'Arc'},
    masteries:[
      {id:'power', name:'Long Reach', desc:'Pierce route +5% vs high DEF; +4 pierce.'},
      {id:'precision', name:'Open Sky', desc:'Wing-line ÔêÆ3% miss; bleed route +6% bleed rider.'},
      {id:'control', name:'Surface Reader', desc:'Expose route +5% compromised payoff.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'alb_wing_jab',2:'alb_wing_sweep',3:'alb_wing_arc'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'alb_razor_jab',2:'alb_razor_sweep',3:'alb_razor_arc'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'alb_spot_jab',2:'alb_spot_sweep',3:'alb_open_arc'}},
    },
  },
  sweep:{
    familyId:'sweep', displayName:'Ocean Sweep Line', baseAbilityId:'alb_ocean_sweep', slotRole:'signature_control_attack', maxTier:3,
    tierNames:{1:'Sweep',2:'Current',3:'Tempest'},
    masteries:[
      {id:'power', name:'Vast Wake', desc:'+6% Sweep-line damage; slow path +4% vs already slowed.'},
      {id:'precision', name:'Measured Tempest', desc:'Weaken route +6% rider; return wake +4 flat.'},
      {id:'control', name:'Deep Current', desc:'Slow +1 turn when possible; return wake stacks harder.'},
    ],
    paths:{
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'alb_ocean_sweep',2:'alb_pulling_current',3:'alb_tempest_wake'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'alb_pressing_sweep',2:'alb_pressing_current',3:'alb_crushing_tempest'}},
      return:{pathId:'return', displayName:'Return', abilities:{1:'alb_echo_sweep',2:'alb_return_current',3:'alb_returning_tempest'}},
    },
  },
  glide:{
    familyId:'glide', displayName:'Glide Line', baseAbilityId:'alb_glide_line', slotRole:'tempo_positioning', maxTier:3,
    tierNames:{1:'Glide',2:'Drift',3:'Current'},
    masteries:[
      {id:'power', name:'Endless Line', desc:'Speed path +1 SPD when possible.'},
      {id:'precision', name:'Shear Wind', desc:'Dodge path +4% dodge; guard path +3 guard value.'},
      {id:'control', name:'Calm Air', desc:'Utility durations +1 turn when Control mastered.'},
    ],
    paths:{
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'alb_glide_line',2:'alb_long_drift',3:'alb_endless_current'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'alb_soft_glide',2:'alb_ghost_drift',3:'alb_white_current'}},
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'alb_steady_glide',2:'alb_broad_drift',3:'alb_ocean_current'}},
    },
  },
  current:{
    familyId:'current', displayName:'Current Line', baseAbilityId:'alb_current_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Pull',3:'Wake'},
    masteries:[
      {id:'power', name:'Tidal Setup', desc:'Amp path next-hit +3%; break path +1 DEF stress.'},
      {id:'precision', name:'Rip Tide', desc:'Read path +5% vs compromised.'},
      {id:'control', name:'Locked Flow', desc:'Break lasts +1t when possible; wake mark +2% next-hit.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'alb_current_mark',2:'alb_pull_mark',3:'alb_wake_mark'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'alb_crack_current',2:'alb_split_current',3:'alb_ruin_wake'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'alb_read_current',2:'alb_read_pull',3:'alb_read_wake'}},
    },
  },
});

const SEAGULL_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'snap', abilityId:'sgl_snap_peck'},
  {slotIndex:1, familyId:'swoop', abilityId:'sgl_swoop_pass'},
  {slotIndex:2, familyId:'cry', abilityId:'sgl_raucous_cry'},
  {slotIndex:3, familyId:'scavenge', abilityId:'sgl_scavenge_mark'},
]);
const SEAGULL_SKILL_FAMILIES = Object.freeze({
  snap:{
    familyId:'snap', displayName:'Snap Line', baseAbilityId:'sgl_snap_peck', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Snap',2:'Bite',3:'Rip'},
    masteries:[
      {id:'power', name:'Salt Jaw', desc:'Bleed route +6% bleed rider; pierce route +4 pierce.'},
      {id:'precision', name:'Hook Eye', desc:'Snap-line ÔêÆ3% miss; expose route +5% compromised payoff.'},
      {id:'control', name:'Beach Raider', desc:'Expose durations +1 turn when Control mastered.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'sgl_snap_peck',2:'sgl_raking_bite',3:'sgl_salt_rip'}},
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'sgl_hook_peck',2:'sgl_hook_bite',3:'sgl_hook_rip'}},
      expose:{pathId:'expose', displayName:'Expose', abilities:{1:'sgl_spot_peck',2:'sgl_scavenge_bite',3:'sgl_open_rip'}},
    },
  },
  swoop:{
    familyId:'swoop', displayName:'Swoop Line', baseAbilityId:'sgl_swoop_pass', slotRole:'signature_harrier_attack', maxTier:3,
    tierNames:{1:'Pass',2:'Dive',3:'Break'},
    masteries:[
      {id:'power', name:'Break Surge', desc:'+6% Swoop damage; crit route +4% crit chance.'},
      {id:'precision', name:'Skim Line', desc:'Blindside route +5% vs openings; slow route +4% vs slowed.'},
      {id:'control', name:'Undertow Drag', desc:'Slow stacks harder; blindside +3% vs debuffed.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'sgl_swoop_pass',2:'sgl_skimming_dive',3:'sgl_breakwing'}},
      blindside:{pathId:'blindside', displayName:'Blindside', abilities:{1:'sgl_mugging_pass',2:'sgl_snatch_dive',3:'sgl_plunder_break'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'sgl_drag_pass',2:'sgl_drag_dive',3:'sgl_undertow_break'}},
    },
  },
  cry:{
    familyId:'cry', displayName:'Cry Line', baseAbilityId:'sgl_raucous_cry', slotRole:'disruption_utility', maxTier:3,
    tierNames:{1:'Cry',2:'Squall',3:'Uproar'},
    masteries:[
      {id:'power', name:'Gull Storm', desc:'ACC break route +3% enemy ACC crash.'},
      {id:'precision', name:'Grinding Call', desc:'Weaken route +6% Weaken odds.'},
      {id:'control', name:'Whitecap Surge', desc:'Speed route +1 SPD when possible; cry effects +1 turn.'},
    ],
    paths:{
      acc_break:{pathId:'acc_break', displayName:'ACC Break', abilities:{1:'sgl_raucous_cry',2:'sgl_wavering_squall',3:'sgl_blinding_uproar'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'sgl_harsh_cry',2:'sgl_grinding_squall',3:'sgl_fading_uproar'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'sgl_keen_cry',2:'sgl_tailwind_squall',3:'sgl_whitecap_uproar'}},
    },
  },
  scavenge:{
    familyId:'scavenge', displayName:'Scavenge Line', baseAbilityId:'sgl_scavenge_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Claim',3:'Haul'},
    masteries:[
      {id:'power', name:'Haul Setup', desc:'Amp path next-hit +3%; break path +1 DEF stress.'},
      {id:'precision', name:'Scrap Reader', desc:'Read path +5% vs compromised.'},
      {id:'control', name:'Tide Claim', desc:'Break lasts +1t when possible; mark +2% next-hit.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'sgl_scavenge_mark',2:'sgl_claim_sign',3:'sgl_haul_mark'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'sgl_crack_mark',2:'sgl_strip_sign',3:'sgl_break_haul'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'sgl_read_scrap',2:'sgl_read_claim',3:'sgl_read_haul'}},
    },
  },
});

const SHOEBILL_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'sbl_beak_chop'},
  {slotIndex:1, familyId:'crack', abilityId:'sbl_skull_crack'},
  {slotIndex:2, familyId:'stance', abilityId:'sbl_still_stance'},
  {slotIndex:3, familyId:'dread', abilityId:'sbl_dread_mark'},
]);
const SHOEBILL_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'sbl_beak_chop', slotRole:'filler_heavy_attack', maxTier:3,
    tierNames:{1:'Chop',2:'Break',3:'Cleave'},
    masteries:[
      {id:'power', name:'Swamp Weight', desc:'Beak-line damage +4%; pierce route +3 pierce.'},
      {id:'precision', name:'Hook Aim', desc:'Beak-line ÔêÆ3% miss; bleed route +5% bleed odds.'},
      {id:'control', name:'Crushing Patience', desc:'Weaken-route riders +6%; wounded-target payoff +4%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'sbl_beak_chop',2:'sbl_split_break',3:'sbl_bone_cleave'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'sbl_rending_chop',2:'sbl_rending_break',3:'sbl_deep_cleave'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'sbl_dulling_chop',2:'sbl_sapping_break',3:'sbl_hollow_cleave'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
    },
  },
  crack:{
    familyId:'crack', displayName:'Crack Line', baseAbilityId:'sbl_skull_crack', slotRole:'signature_execution_attack', maxTier:3,
    tierNames:{1:'Crack',2:'Collapse',3:'Ruin'},
    masteries:[
      {id:'power', name:'Prehistoric Drive', desc:'Crack-line damage +5%; crit route +3% crit chance.'},
      {id:'precision', name:'Skull Line', desc:'Fear-route fear odds +6%; execute route +4% vs low HP.'},
      {id:'control', name:'Bog Executioner', desc:'DEF-break stress +1 when possible; fear lasts feel heavier.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'sbl_skull_crack',2:'sbl_grave_collapse',3:'sbl_skull_ruin'}},
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'sbl_dread_crack',2:'sbl_hollow_collapse',3:'sbl_night_ruin'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'sbl_hunter_crack',2:'sbl_prey_collapse',3:'sbl_final_ruin'}},
    },
  },
  stance:{
    familyId:'stance', displayName:'Still Stance Line', baseAbilityId:'sbl_still_stance', slotRole:'guard_setup', maxTier:3,
    tierNames:{1:'Stance',2:'Hold',3:'Silence'},
    masteries:[
      {id:'power', name:'Looming Bulk', desc:'Guard-route stacks +4; stillness feels heavier.'},
      {id:'precision', name:'Measured Step', desc:'Dodge-route dodge +4%; amp-route next-hit +3%.'},
      {id:'control', name:'Ambush Composure', desc:'Read-route compromised bonus +4%; mire slow +1 turn when possible.'},
    ],
    paths:{
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'sbl_still_stance',2:'sbl_hold_ground',3:'sbl_dead_still'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'sbl_slow_step',2:'sbl_mire_hold',3:'sbl_ghost_silence'}},
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'sbl_lining_stance',2:'sbl_measured_hold',3:'sbl_killing_silence'}},
    },
  },
  dread:{
    familyId:'dread', displayName:'Dread Line', baseAbilityId:'sbl_dread_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Sign',3:'Doom'},
    masteries:[
      {id:'power', name:'Written Collapse', desc:'Amp-path next-hit +4%; break-path exposed damage +3%.'},
      {id:'precision', name:'Cold Stare', desc:'Read-path compromised bonus +5%; break DEF strip +1.'},
      {id:'control', name:'Swamp Verdict', desc:'Fear pressure on marked hits +6% when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'sbl_dread_mark',2:'sbl_grave_sign',3:'sbl_doom_mark'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'sbl_crack_sign',2:'sbl_break_doom',3:'sbl_ruin_doom'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'sbl_read_dread',2:'sbl_read_sign',3:'sbl_read_doom'}},
    },
  },
});

const HARPY_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'talon', abilityId:'hrp_talon_clutch'},
  {slotIndex:1, familyId:'crush', abilityId:'hrp_canopy_crush'},
  {slotIndex:2, familyId:'grip', abilityId:'hrp_predator_grip'},
  {slotIndex:3, familyId:'lock', abilityId:'hrp_prey_lock'},
]);
const HARPY_SKILL_FAMILIES = Object.freeze({
  talon:{
    familyId:'talon', displayName:'Talon Line', baseAbilityId:'hrp_talon_clutch', slotRole:'filler_talon_attack', maxTier:3,
    tierNames:{1:'Clutch',2:'Rend',3:'Rip'},
    masteries:[
      {id:'power', name:'Crown Talons', desc:'Talon-line damage +4%; pierce route +3 pierce.'},
      {id:'precision', name:'Canopy Aim', desc:'Talon-line ÔêÆ3% miss; bleed route +5% bleed odds.'},
      {id:'control', name:'Crushing Grip', desc:'Weaken-route riders +6%; wounded-target payoff +4%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'hrp_talon_clutch',2:'hrp_split_rend',3:'hrp_bone_rip'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'hrp_rending_clutch',2:'hrp_deep_rend',3:'hrp_blood_rip'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'hrp_crushing_clutch',2:'hrp_sapping_rend',3:'hrp_hollow_rip'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
    },
  },
  crush:{
    familyId:'crush', displayName:'Crush Line', baseAbilityId:'hrp_canopy_crush', slotRole:'signature_execution_attack', maxTier:3,
    tierNames:{1:'Crush',2:'Break',3:'Dominion'},
    masteries:[
      {id:'power', name:'Apex Drop', desc:'Crush-line damage +5%; crit route +3 crit chance.'},
      {id:'precision', name:'Pinning Force', desc:'Paralysis-route para odds +6%; execute route +4% vs low HP.'},
      {id:'control', name:'Canopy Verdict', desc:'DEF-break stress +1 when possible; prey feels locked.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'hrp_canopy_crush',2:'hrp_predator_break',3:'hrp_crown_dominion'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'hrp_shock_crush',2:'hrp_snare_break',3:'hrp_lock_dominion'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'hrp_hunter_crush',2:'hrp_prey_break',3:'hrp_final_dominion'}},
    },
  },
  grip:{
    familyId:'grip', displayName:'Grip Line', baseAbilityId:'hrp_predator_grip', slotRole:'control_setup', maxTier:3,
    tierNames:{1:'Grip',2:'Hold',3:'Seize'},
    masteries:[
      {id:'power', name:'Iron Talons', desc:'Guard-route stacks +4; grip feels heavier.'},
      {id:'precision', name:'Lining Kill', desc:'Amp-route next-hit +3%; ACC-break route +2 ACC down.'},
      {id:'control', name:'Canopy Lock', desc:'Read-style setups +4% compromised bonus when on amp path.'},
    ],
    paths:{
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'hrp_predator_grip',2:'hrp_iron_hold',3:'hrp_death_seize'}},
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'hrp_lining_grip',2:'hrp_measured_grip',3:'hrp_kill_seize'}},
      acc_break:{pathId:'acc_break', displayName:'ACC Break', abilities:{1:'hrp_harsh_grip',2:'hrp_breaking_hold',3:'hrp_blinding_seize'}},
    },
  },
  lock:{
    familyId:'lock', displayName:'Prey Lock Line', baseAbilityId:'hrp_prey_lock', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Lock',2:'Claim',3:'Dominion'},
    masteries:[
      {id:'power', name:'Claimed Quarry', desc:'Amp-path next-hit +4%; break-path expose +3%.'},
      {id:'precision', name:'Reader of Fear', desc:'Read-path compromised bonus +5%; break DEF strip +1.'},
      {id:'control', name:'No Escape', desc:'Marked prey: follow-up physical +6% when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'hrp_prey_lock',2:'hrp_hunter_claim',3:'hrp_doom_dominion'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'hrp_crack_lock',2:'hrp_break_claim',3:'hrp_ruin_dominion'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'hrp_read_prey',2:'hrp_read_claim',3:'hrp_read_dominion'}},
    },
  },
});

const PEREGRINE_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'talon', abilityId:'talon_jab'},
  {slotIndex:1, familyId:'dive', abilityId:'dive'},
  {slotIndex:2, familyId:'eye', abilityId:'keen_eye'},
  {slotIndex:3, familyId:'pace', abilityId:'aerial_pace'},
]);
const PEREGRINE_SKILL_FAMILIES = Object.freeze({
  talon:{
    familyId:'talon', displayName:'Talon Line', baseAbilityId:'talon_jab', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Rake',3:'Rend'},
    masteries:[
      {id:'power', name:'Killing Talons', desc:'+8% Talon-line damage.'},
      {id:'precision', name:'Surgical Claws', desc:'Talon-line Pierce and accuracy pressure improve.'},
      {id:'control', name:'Predator Pressure', desc:'Talon-line Bleed and finisher riders improve.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'talon_jab',2:'talon_rake',3:'talon_rend'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'slice_jab',2:'slice_rake',3:'slice_rend'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'hunters_jab',2:'hunters_rake',3:'hunters_rend'}},
    },
  },
  dive:{
    familyId:'dive', displayName:'Dive Line', baseAbilityId:'dive', slotRole:'signature_burst', maxTier:3,
    tierNames:{1:'Dive',2:'Drop',3:'Impact'},
    masteries:[
      {id:'power', name:'Gravity Well', desc:'+7% Dive-line damage; return-pass delayed chip +6.'},
      {id:'precision', name:'Aimpoint', desc:'Crit-route dives hit harder on weak targets.'},
      {id:'control', name:'Terminal Voltage', desc:'Shock dives gain +8% Paralysis odds.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'falcon_dive',2:'killing_drop',3:'impact_strike'}},
      shock:{pathId:'shock', displayName:'Shock', abilities:{1:'thunder_dive',2:'shock_drop',3:'storm_impact'}},
      return:{pathId:'return', displayName:'Return', abilities:{1:'passing_dive',2:'return_drop',3:'double_impact'}},
    },
  },
  eye:{
    familyId:'eye', displayName:'Keen Eye Line', baseAbilityId:'keen_eye', slotRole:'hunter_setup', maxTier:3,
    tierNames:{1:'Eye',2:'Sight',3:'Lock'},
    masteries:[
      {id:'power', name:'Amp Focus', desc:'Amp-path next-hit bonuses +5%.'},
      {id:'precision', name:'Armor Reader', desc:'Break-path DEF shred +1.'},
      {id:'control', name:'Death Gaze', desc:'Crit-lock bonus crit chance +3.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'keen_eye',2:'hunters_sight',3:'fatal_lock'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'expose_flight',2:'weakpoint_sight',3:'ruin_lock'}},
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'predatory_eye',2:'killer_sight',3:'death_lock'}},
    },
  },
  pace:{
    familyId:'pace', displayName:'Aerial Pace Line', baseAbilityId:'aerial_pace', slotRole:'momentum_utility', maxTier:3,
    tierNames:{1:'Pace',2:'Glide',3:'Stoop'},
    masteries:[
      {id:'power', name:'Thermal Lift', desc:'Speed-path SPD bonuses +1.'},
      {id:'precision', name:'Slipstream', desc:'Dodge-path dodge bonuses +4%.'},
      {id:'control', name:'Killing Line', desc:'Momentum-path next-dive bonus +3% mult.'},
    ],
    paths:{
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'rapid_pace',2:'glide_burst',3:'stoop_tempo'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'slip_pace',2:'ghost_glide',3:'phantom_stoop'}},
      momentum:{pathId:'momentum', displayName:'Momentum', abilities:{1:'hunting_pace',2:'falling_glide',3:'kill_stoop'}},
    },
  },
});

const KIWI_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'beak_jab'},
  {slotIndex:1, familyId:'probe', abilityId:'night_probe'},
  {slotIndex:2, familyId:'scent', abilityId:'scent_hunt'},
  {slotIndex:3, familyId:'scrape', abilityId:'scrape'},
]);
const KIWI_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'beak_jab', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Drive',3:'Flurry'},
    masteries:[
      {id:'power', name:'Burrow Pressure', desc:'+8% Beak-line damage.'},
      {id:'precision', name:'Bill Geometry', desc:'Beak-line attacks gain ÔêÆ3% miss and +4 pierce.'},
      {id:'control', name:'Carrion Habit', desc:'Beak-line Bleed/Hex riders gain +8%.'},
    ],
    paths:{
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'kiwi_beak_bleed_1',2:'kiwi_beak_bleed_2',3:'kiwi_beak_bleed_3'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      hex:{pathId:'hex', displayName:'Hex', abilities:{1:'kiwi_beak_hex_1',2:'kiwi_beak_hex_2',3:'kiwi_beak_hex_3'}, damageTypeProgression:{1:'hybrid',2:'magic',3:'magic'}},
      precision:{pathId:'precision', displayName:'Precision', abilities:{1:'kiwi_beak_prec_1',2:'kiwi_beak_prec_2',3:'kiwi_beak_prec_3'}, damageTypeProgression:{1:'hybrid',2:'hybrid',3:'hybrid'}},
    },
  },
  probe:{
    familyId:'probe', displayName:'Night Probe Line', baseAbilityId:'night_probe', slotRole:'signature_strike', maxTier:3,
    tierNames:{1:'Probe',2:'Plunge',3:'Burrow'},
    masteries:[
      {id:'power', name:'Night Weight', desc:'+7% Probe-line damage.'},
      {id:'precision', name:'Echo Strike', desc:'Probe-line miss ÔêÆ2%.'},
      {id:'control', name:'Ground Shock', desc:'Probe-line Burn riders +8%.'},
    ],
    paths:{
      trample:{pathId:'trample', displayName:'Trample', abilities:{1:'kiwi_probe_trample_1',2:'kiwi_probe_trample_2',3:'kiwi_probe_trample_3'}},
      buffet:{pathId:'buffet', displayName:'Buffet', abilities:{1:'kiwi_probe_buffet_1',2:'kiwi_probe_buffet_2',3:'kiwi_probe_buffet_3'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'kiwi_probe_exec_1',2:'kiwi_probe_exec_2',3:'kiwi_probe_exec_3'}},
    },
  },
  scent:{
    familyId:'scent', displayName:'Scent Hunt Line', baseAbilityId:'scent_hunt', slotRole:'hunter_setup', maxTier:3,
    tierNames:{1:'Scent',2:'Trail',3:'Quarry'},
    masteries:[
      {id:'power', name:'Blood Memory', desc:'Scent-line amp bonuses +4%.'},
      {id:'precision', name:'Soft Tissue', desc:'Scent-line expose values +2%.'},
      {id:'control', name:'Final Nest', desc:'Scent-line execute bonuses +6% below half HP.'},
    ],
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'kiwi_scent_amp_1',2:'kiwi_scent_amp_2',3:'kiwi_scent_amp_3'}},
      def_break:{pathId:'def_break', displayName:'Defense Break', abilities:{1:'kiwi_scent_def_1',2:'kiwi_scent_def_2',3:'kiwi_scent_def_3'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'kiwi_scent_exec_1',2:'kiwi_scent_exec_2',3:'kiwi_scent_exec_3'}},
    },
  },
  scrape:{
    familyId:'scrape', displayName:'Scrape Line', baseAbilityId:'scrape', slotRole:'ground_control', maxTier:3,
    tierNames:{1:'Scrape',2:'Rake',3:'Dust'},
    masteries:[
      {id:'power', name:'Loose Earth', desc:'Scrape-line dodge/SPD buffs +3 when possible.'},
      {id:'precision', name:'Blind Soil', desc:'Scrape-line enemy ACC penalties +4%.'},
      {id:'control', name:'Burrow Drag', desc:'Scrape-line slow riders +1 SPD down when possible.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'kiwi_scrape_dodge_1',2:'kiwi_scrape_dodge_2',3:'kiwi_scrape_dodge_3'}},
      speed:{pathId:'speed', displayName:'Speed', abilities:{1:'kiwi_scrape_spd_1',2:'kiwi_scrape_spd_2',3:'kiwi_scrape_spd_3'}},
      acc_debuff:{pathId:'acc_debuff', displayName:'Accuracy Down', abilities:{1:'kiwi_scrape_acc_1',2:'kiwi_scrape_acc_2',3:'kiwi_scrape_acc_3'}},
    },
  },
});

const SNOWY_OWL_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'talon', abilityId:'talon_snap'},
  {slotIndex:1, familyId:'dive', abilityId:'silent_dive'},
  {slotIndex:2, familyId:'eye', abilityId:'owl_eye'},
  {slotIndex:3, familyId:'glide', abilityId:'frost_glide'},
]);
const SNOWY_OWL_SKILL_FAMILIES = Object.freeze({
  talon:{
    familyId:'talon', displayName:'Talon Line', baseAbilityId:'talon_snap', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Snap',2:'Clutch',3:'Rend'},
    masteries:[
      {id:'power', name:'Ice Talons', desc:'+8% Talon-line damage.'},
      {id:'precision', name:'Quiet Strike', desc:'Talon-line Pierce and hit consistency improve.'},
      {id:'control', name:'Winter Grip', desc:'Frostbite-path slow and Weaken riders improve.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'talon_snap',2:'talon_clutch',3:'talon_rend'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'razor_snap',2:'razor_clutch',3:'razor_rend'}},
      freezebite:{pathId:'freezebite', displayName:'Frostbite', abilities:{1:'frost_snap',2:'frost_clutch',3:'frost_rend'}},
    },
  },
  dive:{
    familyId:'dive', displayName:'Silent Dive Line', baseAbilityId:'silent_dive', slotRole:'signature_burst', maxTier:3,
    tierNames:{1:'Dive',2:'Drop',3:'Impact'},
    masteries:[
      {id:'power', name:'Plunge Weight', desc:'+7% Dive-line damage; return-pass delayed +6.'},
      {id:'precision', name:'Ghost Line', desc:'Crit-route ambush +4 effective crit pressure.'},
      {id:'control', name:'Whiteout', desc:'Slow-route dives apply heavier chill.'},
    ],
    paths:{
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'ghost_dive',2:'kill_drop',3:'silent_impact'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'frost_dive',2:'winter_drop',3:'whiteout_impact'}},
      return:{pathId:'return', displayName:'Return', abilities:{1:'owl_passing_dive',2:'owl_return_drop',3:'owl_double_impact'}},
    },
  },
  eye:{
    familyId:'eye', displayName:'Owl Eye Line', baseAbilityId:'owl_eye', slotRole:'hunter_setup', maxTier:3,
    tierNames:{1:'Eye',2:'Sight',3:'Lock'},
    masteries:[
      {id:'power', name:'Patient Aim', desc:'Amp-path next-hit bonuses +4%.'},
      {id:'precision', name:'Tear Hide', desc:'Break-path armor stress +1 DEF.'},
      {id:'control', name:'Frozen Gaze', desc:'Crit-focus path +3 crit chance.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'owl_eye',2:'owl_hunters_sight',3:'moon_lock'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'expose_prey',2:'owl_weakpoint_sight',3:'owl_ruin_lock'}},
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'cold_eye',2:'owl_killer_sight',3:'owl_death_lock'}},
    },
  },
  glide:{
    familyId:'glide', displayName:'Frost Glide Line', baseAbilityId:'frost_glide', slotRole:'control_utility', maxTier:3,
    tierNames:{1:'Glide',2:'Drift',3:'Silence'},
    masteries:[
      {id:'power', name:'Downwind', desc:'Slow-path chill +1 SPD penalty when possible.'},
      {id:'precision', name:'Snow Veil', desc:'Dodge-path dodge bonuses +4%.'},
      {id:'control', name:'Ambush Ritual', desc:'Ambush-path next-hit bonus +3%.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'silent_glide',2:'ghost_drift',3:'snow_silence'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'frost_glide',2:'winter_drift',3:'white_silence'}},
      ambush:{pathId:'ambush', displayName:'Ambush', abilities:{1:'hunting_glide',2:'shadow_drift',3:'night_silence'}},
    },
  },
});

const MACAW_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'echo', abilityId:'echo_note'},
  {slotIndex:1, familyId:'mimic', abilityId:'mimic_song'},
  {slotIndex:2, familyId:'taunt', abilityId:'feather_taunt'},
  {slotIndex:3, familyId:'chorus', abilityId:'chorus_mark'},
]);
const MACAW_SKILL_FAMILIES = Object.freeze({
  echo:{
    familyId:'echo', displayName:'Echo Line', baseAbilityId:'echo_note', slotRole:'filler_spell', maxTier:3,
    tierNames:{1:'Note',2:'Echo',3:'Refrain'},
    masteries:[
      {id:'power', name:'Bright Cadence', desc:'+8% Echo-line spell damage.'},
      {id:'precision', name:'Pitch Perfect', desc:'Echo-line spells gain ÔêÆ3% spell miss chance.'},
      {id:'control', name:'Ringing Riders', desc:'Echo-line Burn/Confuse chances gain +8%.'},
    ],
    paths:{
      burn:{pathId:'burn', displayName:'Burn', abilities:{1:'ember_note',2:'ember_echo',3:'ember_refrain'}},
      confuse:{pathId:'confuse', displayName:'Confuse', abilities:{1:'warble_note',2:'dizzy_echo',3:'maddening_refrain'}},
      delayed:{pathId:'delayed', displayName:'Resonance', abilities:{1:'echo_note',2:'delayed_echo',3:'returning_refrain'}},
    },
  },
  mimic:{
    familyId:'mimic', displayName:'Mimic Line', baseAbilityId:'mimic_song', slotRole:'signature_control_spell', maxTier:3,
    tierNames:{1:'Song',2:'Chorus',3:'Aria'},
    masteries:[
      {id:'power', name:'Loud Echo', desc:'+10% Mimic-line spell damage.'},
      {id:'precision', name:'Sharp Ear', desc:'Mimic-line control chances gain +8%.'},
      {id:'control', name:'Parrot Cunning', desc:'Copycat reactive bonus and Fear/Paralysis riders gain +10%.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'dread_mimic',2:'panic_chorus',3:'terror_aria'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'shock_mimic',2:'static_chorus',3:'lock_aria'}},
      copycat:{pathId:'copycat', displayName:'Copycat', abilities:{1:'mirror_mimic',2:'echo_chorus',3:'stolen_aria'}},
    },
  },
  taunt:{
    familyId:'taunt', displayName:'Feather Taunt Line', baseAbilityId:'feather_taunt', slotRole:'disruption', maxTier:3,
    tierNames:{1:'Taunt',2:'Flourish',3:'Spectacle'},
    masteries:[
      {id:'power', name:'Showboat', desc:'Taunt-line enemy ACC penalties gain +6%.'},
      {id:'precision', name:'Flashy Escape', desc:'Taunt-line dodge bonuses gain +5.'},
      {id:'control', name:'Crowd Work', desc:'Taunt-line Weaken and bait pressure gain +1 turn when possible.'},
    ],
    paths:{
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'glitter_taunt',2:'dazzle_flourish',3:'spectacle_storm'}},
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'slip_taunt',2:'feather_flourish',3:'mirage_spectacle'}},
      pressure:{pathId:'pressure', displayName:'Pressure', abilities:{1:'mock_taunt',2:'provoking_flourish',3:'grand_spectacle'}},
    },
  },
  chorus:{
    familyId:'chorus', displayName:'Chorus Line', baseAbilityId:'chorus_mark', slotRole:'setup', maxTier:3,
    tierNames:{1:'Mark',2:'Measure',3:'Finale'},
    masteries:[
      {id:'power', name:'Crescendo', desc:'Chorus-line damage amp and Afterbeat Resonance gain +6% / +8 flat.'},
      {id:'precision', name:'Downbeat', desc:'Chorus-line Weaken lasts 1 extra turn when possible.'},
      {id:'control', name:'Grand Pause', desc:'Chorus-line Afterbeat Resonance +12 and setup ACC debuffs +5%.'},
    ],
    paths:{
      damage_amp:{pathId:'damage_amp', displayName:'Damage Amp', abilities:{1:'chorus_mark',2:'harmonic_measure',3:'finale_mark'}},
      delayed:{pathId:'delayed', displayName:'Afterbeat', abilities:{1:'echo_mark',2:'resonant_measure',3:'delayed_finale'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'cracking_mark',2:'softening_measure',3:'fading_finale'}},
    },
  },
});

const LYREBIRD_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'echo', abilityId:'echo_note'},
  {slotIndex:1, familyId:'mimic', abilityId:'mimic_chorus'},
  {slotIndex:2, familyId:'display', abilityId:'display_step'},
  {slotIndex:3, familyId:'refrain', abilityId:'refrain_mark'},
]);
const LYREBIRD_SKILL_FAMILIES = Object.freeze({
  echo:{
    familyId:'echo', displayName:'Echo Line', baseAbilityId:'echo_note', slotRole:'filler_spell', maxTier:3,
    tierNames:{1:'Trill',2:'Layer',3:'Cadenza'},
    masteries:[
      {id:'power', name:'Silver Throat', desc:'+8% Echo-line spell damage.'},
      {id:'precision', name:'Stage Pitch', desc:'Echo-line ÔêÆ3% spell miss.'},
      {id:'control', name:'Layered Song', desc:'Echo-line Burn/Confuse +8%.'},
    ],
    paths:{
      burn:{pathId:'burn', displayName:'Burn', abilities:{1:'ember_note',2:'ember_echo',3:'ember_refrain'}},
      confuse:{pathId:'confuse', displayName:'Confuse', abilities:{1:'warble_note',2:'dizzy_echo',3:'maddening_refrain'}},
      delayed:{pathId:'delayed', displayName:'Resonance', abilities:{1:'echo_note',2:'delayed_echo',3:'returning_refrain'}},
    },
  },
  mimic:{
    familyId:'mimic', displayName:'Mimic Line', baseAbilityId:'mimic_chorus', slotRole:'signature_imitation_spell', maxTier:3,
    tierNames:{1:'Borrow',2:'Bridge',3:'Ovation'},
    masteries:[
      {id:'power', name:'Great Pretender', desc:'+9% Mimic-line damage.'},
      {id:'precision', name:'Borrowed Voice', desc:'Mimic-line Fear/Paralysis +8%.'},
      {id:'control', name:'Encore Theft', desc:'Copycat pulse payoff +12%.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'lyre_dread_chorus',2:'lyre_panic_verse',3:'lyre_terror_anthem'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'lyre_shock_chorus',2:'lyre_static_verse',3:'lyre_lock_anthem'}},
      copycat:{pathId:'copycat', displayName:'Copycat', abilities:{1:'lyre_mirror_chorus',2:'lyre_echo_verse',3:'lyre_stolen_anthem'}},
    },
  },
  display:{
    familyId:'display', displayName:'Display Line', baseAbilityId:'display_step', slotRole:'performance_utility', maxTier:3,
    tierNames:{1:'Step',2:'Flourish',3:'Display'},
    masteries:[
      {id:'power', name:'Tail Train', desc:'Display-line ACC pressure +5%.'},
      {id:'precision', name:'Fan Flourish', desc:'Dodge-path +4% dodge window.'},
      {id:'control', name:'Courtship', desc:'Pressure-path Weaken +1 turn when possible.'},
    ],
    paths:{
      dodge:{pathId:'dodge', displayName:'Dodge', abilities:{1:'lyre_grace_step',2:'lyre_feather_flourish',3:'lyre_grand_display'}},
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'lyre_distracting_step',2:'lyre_mock_flourish',3:'lyre_blinding_display'}},
      pressure:{pathId:'pressure', displayName:'Pressure', abilities:{1:'lyre_proud_step',2:'lyre_dominant_flourish',3:'lyre_stage_display'}},
    },
  },
  refrain:{
    familyId:'refrain', displayName:'Refrain Line', baseAbilityId:'refrain_mark', slotRole:'setup', maxTier:3,
    tierNames:{1:'Cue',2:'Cadence',3:'Curtain'},
    masteries:[
      {id:'power', name:'Crescendo', desc:'Amp-path next-hit +4%; Stage Return Resonance +8 flat.'},
      {id:'precision', name:'Downbeat', desc:'Read-path +4% vs compromised.'},
      {id:'control', name:'Grand Pause', desc:'Stage Return path Resonance +12.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Damage Amp', abilities:{1:'refrain_mark',2:'lyre_harmonic_measure',3:'lyre_finale_mark'}},
      delayed:{pathId:'delayed', displayName:'Stage Return', abilities:{1:'lyre_echo_mark',2:'lyre_resonant_measure',3:'lyre_delayed_finale'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'lyre_fault_mark',2:'lyre_weak_measure',3:'lyre_collapse_finale'}},
    },
  },
});

const BLACK_COCKATOO_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'beak_crack'},
  {slotIndex:1, familyId:'boom', abilityId:'boom_call'},
  {slotIndex:2, familyId:'wing', abilityId:'wing_beat'},
  {slotIndex:3, familyId:'resonance', abilityId:'resonance_mark'},
]);
const BLACK_COCKATOO_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'beak_crack', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Crack',2:'Bite',3:'Crush'},
    masteries:[
      {id:'power', name:'Iron Bill', desc:'+8% Beak-line damage.'},
      {id:'precision', name:'Split Grain', desc:'Beak-line Pierce and guard-break riders +4%.'},
      {id:'control', name:'Crack Focus', desc:'Beak-line Weaken odds +8%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'beak_crack',2:'bc_bodkin_bite',3:'splinter_crush'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'dulling_crack',2:'numbing_bite',3:'crushing_weakness'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'split_crack',2:'break_bite',3:'ruin_crush'}},
    },
  },
  boom:{
    familyId:'boom', displayName:'Boom Line', baseAbilityId:'boom_call', slotRole:'signature_resonant_attack', maxTier:3,
    tierNames:{1:'Call',2:'Boom',3:'Shockwave'},
    masteries:[
      {id:'power', name:'Thunderhead', desc:'+7% Boom-line damage; Reverberation path +6 Resonance flat.'},
      {id:'precision', name:'Echo Find', desc:'Boom-line Fear/Paralysis odds +8%.'},
      {id:'control', name:'Aftershock', desc:'Reverberation path Resonance +10.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'cockatoo_dread_call',2:'terror_boom',3:'black_shockwave'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'shock_call',2:'static_boom',3:'lockwave'}},
      delayed:{pathId:'delayed', displayName:'Reverberation', abilities:{1:'echo_call',2:'resonant_boom',3:'returning_shockwave'}},
    },
  },
  wing:{
    familyId:'wing', displayName:'Wing Beat Line', baseAbilityId:'wing_beat', slotRole:'control_utility', maxTier:3,
    tierNames:{1:'Beat',2:'Gust',3:'Gale'},
    masteries:[
      {id:'power', name:'Dust Storm', desc:'Wing-line ACC crash +5%.'},
      {id:'precision', name:'Shear Wind', desc:'Wing-line Slow +1 turn when possible.'},
      {id:'control', name:'Iron Pinion', desc:'Guard-path brace +4% damage reduction.'},
    ],
    paths:{
      acc_break:{pathId:'acc_break', displayName:'Accuracy Break', abilities:{1:'dust_beat',2:'shudder_gust',3:'black_gale'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'heavy_beat',2:'drag_gust',3:'falling_gale'}},
      guard:{pathId:'guard', displayName:'Guard', abilities:{1:'brace_beat',2:'guard_gust',3:'iron_gale'}},
    },
  },
  resonance:{
    familyId:'resonance', displayName:'Resonance Line', baseAbilityId:'resonance_mark', slotRole:'setup', maxTier:3,
    tierNames:{1:'Mark',2:'Pulse',3:'Collapse'},
    masteries:[
      {id:'power', name:'Crest Harmonics', desc:'Amp-path next-hit +5%; Returning Pulse +8 Resonance flat.'},
      {id:'precision', name:'Fault Finder', desc:'Read-path bonus vs debuffed +4%.'},
      {id:'control', name:'Collapse Art', desc:'Returning Pulse path Resonance +12.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'resonance_mark',2:'harmonic_pulse',3:'resonant_collapse'}},
      delayed:{pathId:'delayed', displayName:'Returning Pulse', abilities:{1:'cockatoo_echo_mark',2:'return_pulse',3:'delayed_collapse'}},
      read:{pathId:'read', displayName:'Read', abilities:{1:'fault_mark',2:'weak_pulse',3:'collapse_read'}},
    },
  },
});

const KOOKABURRA_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'beak_chop'},
  {slotIndex:1, familyId:'laugh', abilityId:'laugh_call'},
  {slotIndex:2, familyId:'watch', abilityId:'perch_watch'},
  {slotIndex:3, familyId:'drop', abilityId:'drop_strike'},
]);
const KOOKABURRA_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'beak_chop', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Chop',2:'Crack',3:'Break'},
    masteries:[
      {id:'power', name:'Kingfisher Bill', desc:'+8% Beak-line damage.'},
      {id:'precision', name:'Fish Bone', desc:'Beak-line Pierce and bleed riders +4%.'},
      {id:'control', name:'Grip Focus', desc:'Beak-line Weaken odds +8%.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'beak_chop',2:'bodkin_crack',3:'splinter_break'}},
      bleed:{pathId:'bleed', displayName:'Bleed', abilities:{1:'razor_chop',2:'razor_crack',3:'razor_break'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'dulling_chop',2:'numbing_crack',3:'weakening_break'}},
    },
  },
  laugh:{
    familyId:'laugh', displayName:'Laugh Line', baseAbilityId:'laugh_call', slotRole:'signature_sonic_attack', maxTier:3,
    tierNames:{1:'Call',2:'Laugh',3:'Cackle'},
    masteries:[
      {id:'power', name:'Bush King', desc:'+7% Laugh-line damage; Ricochet path +6 laugh-echo flat.'},
      {id:'precision', name:'Mocking Eye', desc:'Laugh-line Fear/Paralysis odds +8%.'},
      {id:'control', name:'Ricochet', desc:'Ricochet path laugh echo +10.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'kooka_dread_call',2:'mocking_laugh',3:'terror_cackle'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'kooka_shock_call',2:'static_laugh',3:'lock_cackle'}},
      delayed:{pathId:'delayed', displayName:'Ricochet', abilities:{1:'kooka_echo_call',2:'echo_laugh',3:'returning_cackle'}},
    },
  },
  watch:{
    familyId:'watch', displayName:'Perch Watch Line', baseAbilityId:'perch_watch', slotRole:'hunter_setup', maxTier:3,
    tierNames:{1:'Watch',2:'Sight',3:'Lock'},
    masteries:[
      {id:'power', name:'Roost Read', desc:'Amp-path next-hit +5%; echo +8.'},
      {id:'precision', name:'Tear Line', desc:'Break-path DEF strip +1.'},
      {id:'control', name:'Strike Window', desc:'Crit-path +3% effective crit.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'perch_watch',2:'kooka_hunters_sight',3:'perch_lock'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'expose_perch',2:'kooka_weakpoint_sight',3:'kooka_ruin_lock'}},
      crit:{pathId:'crit', displayName:'Crit', abilities:{1:'killer_watch',2:'killing_sight',3:'kooka_death_lock'}},
    },
  },
  drop:{
    familyId:'drop', displayName:'Drop Line', baseAbilityId:'drop_strike', slotRole:'opportunistic_payoff', maxTier:3,
    tierNames:{1:'Strike',2:'Drop',3:'Smash'},
    masteries:[
      {id:'power', name:'Stoop Weight', desc:'Drop-line damage +7%; execute route +4%.'},
      {id:'precision', name:'Killing Angle', desc:'Trigger-path laugh echo +8.'},
      {id:'control', name:'Ground Game', desc:'Slow-route +1 turn when possible.'},
    ],
    paths:{
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'drop_strike',2:'hunter_drop',3:'kill_smash'}},
      trigger:{pathId:'trigger', displayName:'Trigger', abilities:{1:'kooka_trigger_strike',2:'echo_drop',3:'repeat_smash'}},
      slow:{pathId:'slow', displayName:'Slow', abilities:{1:'clutch_strike',2:'drag_drop',3:'ground_smash'}},
    },
  },
});

const RAVEN_SKILL_SLOT_LAYOUT = Object.freeze([
  {slotIndex:0, familyId:'beak', abilityId:'beak_jab'},
  {slotIndex:1, familyId:'omen', abilityId:'omen_call'},
  {slotIndex:2, familyId:'watch', abilityId:'dark_watch'},
  {slotIndex:3, familyId:'fate', abilityId:'fate_mark'},
]);
const ravenStartingSkillSlots = RAVEN_SKILL_SLOT_LAYOUT.map(slot=>Object.freeze({
  slotIndex:slot.slotIndex,
  familyId:slot.familyId,
  pathId:null,
  tier:0,
  abilityId:slot.abilityId,
  masteryCount:0,
}));
const RAVEN_SKILL_FAMILIES = Object.freeze({
  beak:{
    familyId:'beak', displayName:'Beak Line', baseAbilityId:'beak_jab', slotRole:'filler_attack', maxTier:3,
    tierNames:{1:'Jab',2:'Strike',3:'Rend'},
    masteries:[
      {id:'power', name:'Splinter Instinct', desc:'+8% Beak-line damage; splinter route +4% vs heavy armor.'},
      {id:'precision', name:'Omen Geometry', desc:'Beak-line ÔêÆ3% miss and +4 pierce; doom route +4% vs compromised.'},
      {id:'control', name:'Crushing Pressure', desc:'Weaken-route riders +8%; doom-route payoff +6% vs debuffed.'},
    ],
    paths:{
      pierce:{pathId:'pierce', displayName:'Pierce', abilities:{1:'beak_jab',2:'rav_bodkin_strike',3:'rav_splinter_rend'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      weaken:{pathId:'weaken', displayName:'Weaken', abilities:{1:'rav_dulling_jab',2:'rav_sapping_strike',3:'rav_crushing_rend'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
      doombite:{pathId:'doombite', displayName:'Doombite', abilities:{1:'rav_omen_jab',2:'rav_omen_strike',3:'rav_omen_rend'}, damageTypeProgression:{1:'physical',2:'physical',3:'physical'}},
    },
  },
  omen:{
    familyId:'omen', displayName:'Omen Line', baseAbilityId:'omen_call', slotRole:'signature_doom_attack', maxTier:3,
    tierNames:{1:'Call',2:'Cry',3:'Omen'},
    masteries:[
      {id:'power', name:'Prophet\'s Weight', desc:'+7% Omen-line sonic damage; Tolling path +6 flat Resonance.'},
      {id:'precision', name:'Cold Read', desc:'Omen-line Fear/Paralysis odds +8%.'},
      {id:'control', name:'Inevitable Chorus', desc:'Omen-line ACC pressure +5%; Tolling path Resonance +10.'},
    ],
    paths:{
      fear:{pathId:'fear', displayName:'Fear', abilities:{1:'rav_dread_call',2:'rav_panic_cry',3:'raven_omen'}},
      paralysis:{pathId:'paralysis', displayName:'Paralysis', abilities:{1:'rav_shock_omen',2:'rav_static_cry',3:'rav_lock_omen'}},
      delayed:{pathId:'delayed', displayName:'Tolling', abilities:{1:'rav_echo_omen',2:'rav_doom_cry',3:'rav_returning_omen'}},
    },
  },
  watch:{
    familyId:'watch', displayName:'Dark Watch Line', baseAbilityId:'dark_watch', slotRole:'battlefield_setup', maxTier:3,
    tierNames:{1:'Veil',2:'Glint',3:'Pinion'},
    masteries:[
      {id:'power', name:'Grim Focus', desc:'Amp-path next-hit +4%; omen lock +3%.'},
      {id:'precision', name:'Fault Line', desc:'Break-path DEF strip +1; read-path +4% vs compromised.'},
      {id:'control', name:'Collapse Window', desc:'Read-path compromised bonus +4%; break slow +1 turn when possible.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'dark_watch',2:'rav_grim_sight',3:'rav_omen_lock'}},
      break:{pathId:'break', displayName:'Break', abilities:{1:'rav_expose_weakness',2:'rav_ruin_sight',3:'rav_collapse_lock'}},
      debuff_read:{pathId:'debuff_read', displayName:'Debuff Read', abilities:{1:'rav_read_weakness',2:'rav_read_sight',3:'rav_read_doom'}},
    },
  },
  fate:{
    familyId:'fate', displayName:'Fate Line', baseAbilityId:'fate_mark', slotRole:'setup_payoff', maxTier:3,
    tierNames:{1:'Mark',2:'Sign',3:'Doom'},
    masteries:[
      {id:'power', name:'Written End', desc:'Amp-path next-hit +4%; Writ Loop Resonance +8 flat.'},
      {id:'precision', name:'Second Sight', desc:'Execute-path low-HP payoff +6%; read bonus +3%.'},
      {id:'control', name:'Eclipse Line', desc:'Writ Loop path next-turn collapse +12 Resonance.'},
    ],
    paths:{
      amp:{pathId:'amp', displayName:'Amp', abilities:{1:'fate_mark',2:'rav_grim_sign',3:'rav_final_doom'}},
      delayed:{pathId:'delayed', displayName:'Writ Loop', abilities:{1:'rav_fate_echo_mark',2:'rav_return_sign',3:'rav_delayed_doom'}},
      execute:{pathId:'execute', displayName:'Execute', abilities:{1:'rav_fate_death_mark',2:'rav_fate_death_sign',3:'rav_fate_final_mark'}},
    },
  },
});

function buildFamilySkillAbilityLookup(slotLayout, families){
  const out = Object.create(null);
  for(const slot of slotLayout){
    out[slot.abilityId] = {familyId:slot.familyId, pathId:null, tier:0, abilityId:slot.abilityId};
  }
  for(const family of Object.values(families||{})){
    for(const path of Object.values(family.paths||{})){
      for(const [tierKey, abilityId] of Object.entries(path.abilities||{})){
        const tier=Number(tierKey)||0;
        const prev=out[abilityId];
        if(prev && prev.pathId===null && prev.tier===0 && tier>=1) continue;
        out[abilityId] = {familyId:family.familyId, pathId:path.pathId, tier, abilityId};
      }
    }
  }
  return Object.freeze(out);
}
const FAMILY_EVOLUTION_BIRD_DATA = Object.freeze({
  sparrow:{
    birdKey:'sparrow',
    slotLayout:SPARROW_SKILL_SLOT_LAYOUT,
    families:SPARROW_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SPARROW_SKILL_SLOT_LAYOUT, SPARROW_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      rapid:{legacy:['rapidPeck'], current:'multiPeck'},
      mark:{legacy:['markPrey'], current:'trackPrey'},
    }),
  },
  goose:{
    birdKey:'goose',
    slotLayout:GOOSE_SKILL_SLOT_LAYOUT,
    families:GOOSE_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(GOOSE_SKILL_SLOT_LAYOUT, GOOSE_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['peck','headWhip'], current:'gos_beak_snap'},
      body:{legacy:['talon_slam','heavyTalon','heavy_talon','territorial_honk','gooseHonk','fearHonk'], current:'gos_body_check'},
      honk:{legacy:['guard','iron_guard','bulwark_brace','fortress_stance'], current:'gos_honk_blast'},
      brace:{legacy:['talon_slam','heavy_talon','trample_slam','crushing_stampede','wing_buffet','bone_buffet','gale_crush','rending_talon','finisher_slam','execution_crush','spite_guard','punish_brace','retribution_fortress','steady_guard','restoring_brace','enduring_fortress'], current:'gos_brace_up'},
    }),
  },
  blackbird:{
    birdKey:'blackbird',
    slotLayout:BLACKBIRD_SKILL_SLOT_LAYOUT,
    families:BLACKBIRD_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(BLACKBIRD_SKILL_SLOT_LAYOUT, BLACKBIRD_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      song:{legacy:['stormChorus'], current:'dark_song'},
      peck:{legacy:['blackPeck'], current:'shadow_peck'},
      gloom:{legacy:['battleChorus'], current:'gloom_wing'},
      sign:{legacy:['thunderScreech'], current:'grim_sign'},
    }),
  },
  crow:{
    birdKey:'crow',
    slotLayout:CROW_SKILL_SLOT_LAYOUT,
    families:CROW_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(CROW_SKILL_SLOT_LAYOUT, CROW_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      peck:{legacy:['crowStrike', 'mockingPeck', 'peck'], current:'peck'},
      murder:{legacy:['stickLance', 'murderMurmuration'], current:'murder_murmuration'},
      call:{legacy:['guard', 'dreadCall'], current:'dread_call'},
      focus:{legacy:['battleFocus'], current:'battle_focus'},
    }),
  },
  magpie:{
    birdKey:'magpie',
    slotLayout:MAGPIE_SKILL_SLOT_LAYOUT,
    families:MAGPIE_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(MAGPIE_SKILL_SLOT_LAYOUT, MAGPIE_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      // These legacy ids are retained only to migrate old Magpie save slots into the
      // new family-slot layout. They should not be granted or surfaced as live Magpie skills.
      swoop:{legacy:['featherFlick', 'swoopCut', 'swoop'], current:'swoop'},
      steal:{legacy:['glintJab', 'stealTempo', 'stealShine'], current:'steal_shine'},
      flick:{legacy:['mockingSong', 'featherFlick'], current:'feather_flick'},
      dart:{legacy:['stealTempo', 'glintJab', 'dart'], current:'dart'},
    }),
  },
  hummingbird:{
    birdKey:'hummingbird',
    slotLayout:HUMMINGBIRD_SKILL_SLOT_LAYOUT,
    families:HUMMINGBIRD_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(HUMMINGBIRD_SKILL_SLOT_LAYOUT, HUMMINGBIRD_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      needle:{legacy:['multiPeck','rapidPeck','nectarJab','needleJab'], current:'needle_jab'},
      dash:{legacy:['sonicDash','swoop'], current:'dash'},
      flutter:{legacy:['blinkFlutter','evade'], current:'blink_flutter'},
      combo:{legacy:['comboStrike','talonRake','burst'], current:'combo_strike'},
    }),
  },
  robin:{
    birdKey:'robin',
    slotLayout:ROBIN_SKILL_SLOT_LAYOUT,
    families:ROBIN_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(ROBIN_SKILL_SLOT_LAYOUT, ROBIN_SKILL_FAMILIES),
    // legacy*: preÔÇôfamily-evolution flat kit ids ÔÇö save/load + migrateRobinLegacyFamilySkillSlots only; live Robin kit is quick_peck / dart_rush / bright_chirp / hop_step.
    legacyBaseAbilityIds:Object.freeze({
      peck:{legacy:['needleJab','nectarJab','rapidPeck','multiPeck','peck','headWhip'], current:'quick_peck'},
      dart:{legacy:['swoopCut','dart','swoop'], current:'dart_rush'},
      chirp:{legacy:['focusChirp','battleChirp','warcry','battleFocus','keen_focus'], current:'bright_chirp'},
      hop:{legacy:['trackPrey','markPrey','predatorMark','featherRuffle','windFeint','evade'], current:'hop_step'},
    }),
  },
  peregrine:{
    birdKey:'peregrine',
    slotLayout:PEREGRINE_SKILL_SLOT_LAYOUT,
    families:PEREGRINE_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(PEREGRINE_SKILL_SLOT_LAYOUT, PEREGRINE_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      talon:{legacy:['swoopCut','dart','swoop'], current:'talon_jab'},
      dive:{legacy:['skyfallStrike','deathDive','skyStrike'], current:'dive'},
      eye:{legacy:['windFeint','evade','trackPrey','huntersMark'], current:'keen_eye'},
      pace:{legacy:['windFeint','trackPrey','predatorMark','featherRuffle','markPrey'], current:'aerial_pace'},
    }),
  },
  kiwi:{
    birdKey:'kiwi',
    slotLayout:KIWI_SKILL_SLOT_LAYOUT,
    families:KIWI_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(KIWI_SKILL_SLOT_LAYOUT, KIWI_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['silentPierce','peck','needle_peck','probeStrike'], current:'beak_jab'},
      probe:{legacy:['diveBomb','beakSlam','heavyTalon','heavy_talon'], current:'night_probe'},
      scent:{legacy:['trackPrey','predatorMark','featherRuffle','markPrey','huntersMark'], current:'scent_hunt'},
      scrape:{legacy:['windFeint','evade'], current:'scrape'},
    }),
  },
  snowyOwl:{
    birdKey:'snowyOwl',
    slotLayout:SNOWY_OWL_SKILL_SLOT_LAYOUT,
    families:SNOWY_OWL_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SNOWY_OWL_SKILL_SLOT_LAYOUT, SNOWY_OWL_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      talon:{legacy:['silentPierce','peck','needle_peck','mockingPeck','crowStrike'], current:'talon_snap'},
      dive:{legacy:['nightTalon','deathDive','skyStrike','heavyTalon','diveBomb','skyfallStrike'], current:'silent_dive'},
      eye:{legacy:['trackPrey','predatorMark','featherRuffle','markPrey','huntersMark'], current:'owl_eye'},
      glide:{legacy:['windFeint','evade','huntersCry','dread_call','dreadCall','victoryChant'], current:'frost_glide'},
    }),
  },
  macaw:{
    birdKey:'macaw',
    slotLayout:MACAW_SKILL_SLOT_LAYOUT,
    families:MACAW_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(MACAW_SKILL_SLOT_LAYOUT, MACAW_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      echo:{legacy:['echoSong', 'shriekwave'], current:'echo_note'},
      mimic:{legacy:['mimicSong', 'birdBrain'], current:'mimic_song'},
      taunt:{legacy:['confuseChorus', 'dirge', 'distractingChorus', 'jungleChorus', 'dizzyChorus'], current:'feather_taunt'},
      chorus:{legacy:['battleChorus', 'victoryChant', 'inspireSong', 'freedomCry'], current:'chorus_mark'},
    }),
  },
  lyrebird:{
    birdKey:'lyrebird',
    slotLayout:LYREBIRD_SKILL_SLOT_LAYOUT,
    families:LYREBIRD_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(LYREBIRD_SKILL_SLOT_LAYOUT, LYREBIRD_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      echo:{legacy:['echoSong','shriekwave'], current:'echo_note'},
      mimic:{legacy:['mimicSong','birdBrain'], current:'mimic_chorus'},
      display:{legacy:['confuseChorus','dirge','dizzyChorus','feather_taunt','mockingPeck'], current:'display_step'},
      refrain:{legacy:['battleChorus','victoryChant','inspireSong','chorus_mark','echo_mark'], current:'refrain_mark'},
    }),
  },
  blackCockatoo:{
    birdKey:'blackCockatoo',
    slotLayout:BLACK_COCKATOO_SKILL_SLOT_LAYOUT,
    families:BLACK_COCKATOO_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(BLACK_COCKATOO_SKILL_SLOT_LAYOUT, BLACK_COCKATOO_SKILL_FAMILIES),
    // PreÔÇôfamily-evolution flat ids only (migrate tier-0 bases into slot-state skills).
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['peck','piercingScreech','mainAttack'], current:'beak_crack'},
      boom:{legacy:['stormChorus','thunderScreech','sonicDirge','birdBrain'], current:'boom_call'},
      wing:{legacy:['battleChorus','victoryChant'], current:'wing_beat'},
      resonance:{legacy:['battleChorus','thunderScreech'], current:'resonance_mark'},
    }),
  },
  kookaburra:{
    birdKey:'kookaburra',
    slotLayout:KOOKABURRA_SKILL_SLOT_LAYOUT,
    families:KOOKABURRA_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(KOOKABURRA_SKILL_SLOT_LAYOUT, KOOKABURRA_SKILL_FAMILIES),
    // Save migration only: preÔÇôfamily-evolution Kookaburra flat ids ÔåÆ current tier-0 bases (not used for new runs).
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['mockingPeck','peck','mainAttack'], current:'beak_chop'},
      laugh:{legacy:['laughingCall','echoLaugh','dizzyChorus'], current:'laugh_call'},
      watch:{legacy:['dizzyChorus','battleChorus'], current:'perch_watch'},
      drop:{legacy:['echoLaugh','diveBomb','heavyTalon','heavy_talon'], current:'drop_strike'},
    }),
  },
  raven:{
    birdKey:'raven',
    slotLayout:RAVEN_SKILL_SLOT_LAYOUT,
    families:RAVEN_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(RAVEN_SKILL_SLOT_LAYOUT, RAVEN_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['blackPeck','probeStrike','peck','silentPierce','needle_peck'], current:'beak_jab'},
      omen:{legacy:['dreadCall','dread_call','dirge','hex_song','ominous_call','mocking_cry','ruin_chorus'], current:'omen_call'},
      watch:{legacy:['nightfallSong','battleFocus','battle_focus','keen_focus','weakpoint_focus','opening_focus'], current:'dark_watch'},
      fate:{legacy:['fearChorus','lullaby','grim_sign','markPrey','trackPrey','dusk_field'], current:'fate_mark'},
    }),
  },
  bowerbird:{
    birdKey:'bowerbird',
    slotLayout:BOWERBIRD_SKILL_SLOT_LAYOUT,
    families:BOWERBIRD_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(BOWERBIRD_SKILL_SLOT_LAYOUT, BOWERBIRD_SKILL_FAMILIES),
    /** Tier-0 id normalization for old saves; see LEGACY_BOWERBIRD_FLAT_SKILL_FOR_MIGRATION + migrateBowerbirdLegacyFamilySkillSlots. */
    legacyBaseAbilityIds:Object.freeze({
      trinket:{legacy:['decorate','aerialPoop','peck','headWhip'], current:'trinket_toss'},
      lure:{legacy:['inspireSong','victoryChant'], current:'lure_call'},
      build:{legacy:['charmDisplay','taunt','windFeint'], current:'bower_build'},
      display:{legacy:['focusCall','battleFocus','battle_focus','trackPrey','markPrey'], current:'display_mark'},
    }),
  },
  toucan:{
    birdKey:'toucan',
    slotLayout:TOUCAN_SKILL_SLOT_LAYOUT,
    families:TOUCAN_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(TOUCAN_SKILL_SLOT_LAYOUT, TOUCAN_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['fruitSpit','peck','headWhip','mudshot','needle_peck','probeStrike','decorate'], current:'toucan_beak_jab'},
      slam:{legacy:['sunCall','beakSlam','heavyTalon','heavy_talon','bodySlam','talon_slam','savageKick'], current:'beak_slam'},
      toss:{legacy:['jungleChorus','taunt','distractingChorus','confuseChorus','windFeint'], current:'fruit_toss'},
      mark:{legacy:['echoScreech','shriekwave','owlPsyche','trackPrey','markPrey','battleFocus','battle_focus'], current:'color_mark'},
    }),
  },
  swan:{
    birdKey:'swan',
    slotLayout:SWAN_SKILL_SLOT_LAYOUT,
    families:SWAN_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SWAN_SKILL_SLOT_LAYOUT, SWAN_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      neck:{legacy:['bracePeck','peck','headWhip','probeStrike','needle_peck'], current:'neck_jab'},
      sweep:{legacy:['wingShield','royalGuard','guard','bodySlam','heavyTalon','heavy_talon','talon_slam','savageKick'], current:'wing_sweep'},
      glide:{legacy:['calmingSong','hum','evade','windFeint','royalGuard','guard'], current:'grace_glide'},
      poise:{legacy:['battleFocus','battle_focus','trackPrey','markPrey','guard'], current:'poise_mark'},
    }),
  },
  flamingo:{
    birdKey:'flamingo',
    slotLayout:FLAMINGO_SKILL_SLOT_LAYOUT,
    families:FLAMINGO_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(FLAMINGO_SKILL_SLOT_LAYOUT, FLAMINGO_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      leg:{legacy:['mudshot','peck','headWhip','needle_peck','probeStrike','decorate'], current:'leg_jab'},
      sweep:{legacy:['marshCall','rotChorus','bodySlam','heavyTalon','heavy_talon','talon_slam','savageKick','wingShield','royalGuard','guard'], current:'marsh_sweep'},
      pose:{legacy:['bogWhisper','hum','preen','windFeint','calmingSong','evade'], current:'balance_pose'},
      mire:{legacy:['battleFocus','battle_focus','trackPrey','markPrey'], current:'mire_mark'},
    }),
  },
  secretary:{
    birdKey:'secretary',
    slotLayout:SECRETARY_SKILL_SLOT_LAYOUT,
    families:SECRETARY_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SECRETARY_SKILL_SLOT_LAYOUT, SECRETARY_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      leg:{legacy:['headWhip','peck','probeStrike','needle_peck','bracePeck'], current:'sec_leg_jab'},
      kick:{legacy:['serratedSlash','tearing_bite','rend_strike','tearing_jab','bodySlam','heavyTalon','heavy_talon','talon_slam','savageKick','beakSlam','serpentCrusher','trample','warCharge','warStomp','stampedeStrike'], current:'sec_crushing_kick'},
      stride:{legacy:['guard','royalGuard','windFeint','hum','evade','calmingSong','sitAndWait','crowDefend'], current:'hunter_stride'},
      prey:{legacy:['threatDisplay','battleFocus','battle_focus','trackPrey','markPrey','intimidate','taunt'], current:'prey_mark'},
    }),
  },
  albatross:{
    birdKey:'albatross',
    slotLayout:ALBATROSS_SKILL_SLOT_LAYOUT,
    families:ALBATROSS_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(ALBATROSS_SKILL_SLOT_LAYOUT, ALBATROSS_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      wing:{legacy:['galeStrike','supersonic'], current:'alb_wing_jab'},
      sweep:{legacy:['oceanCall','wingStorm'], current:'alb_ocean_sweep'},
      glide:{legacy:['windChorus','hum','veil_wing'], current:'alb_glide_line'},
      current:{legacy:['stormSong','sonicDirge'], current:'alb_current_mark'},
    }),
  },
  seagull:{
    birdKey:'seagull',
    slotLayout:SEAGULL_SKILL_SLOT_LAYOUT,
    families:SEAGULL_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SEAGULL_SKILL_SLOT_LAYOUT, SEAGULL_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      snap:{legacy:['featherFlick','peck','headWhip','rapidPeck','multiPeck'], current:'sgl_snap_peck'},
      swoop:{legacy:['diveSnatch','swoop','dart','diveBomb','swoopCut'], current:'sgl_swoop_pass'},
      cry:{legacy:['blindScreech','shriekwave','windSlash','distractingChorus','dizzyChorus','dirge','taunt'], current:'sgl_raucous_cry'},
      scavenge:{legacy:['distractingChorus','trackPrey','markPrey','predatorMark','battleFocus','battle_focus'], current:'sgl_scavenge_mark'},
    }),
  },
  shoebill:{
    birdKey:'shoebill',
    slotLayout:SHOEBILL_SKILL_SLOT_LAYOUT,
    families:SHOEBILL_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(SHOEBILL_SKILL_SLOT_LAYOUT, SHOEBILL_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      beak:{legacy:['bracePeck','peck','headWhip','probeStrike','needle_peck','mockingPeck'], current:'sbl_beak_chop'},
      crack:{legacy:['shoebillClamp','heavyTalon','heavy_talon','talon_slam','beakSlam','bodySlam'], current:'sbl_skull_crack'},
      stance:{legacy:['guard','royalGuard','wingShield','iron_guard','bulwark_brace','crowDefend','iceGuard'], current:'sbl_still_stance'},
      dread:{legacy:['huntersCry','victoryChant','dread_call','dreadCall','trackPrey','markPrey','predatorMark','battleFocus','battle_focus','featherRuffle'], current:'sbl_dread_mark'},
    }),
  },
  harpy:{
    birdKey:'harpy',
    slotLayout:HARPY_SKILL_SLOT_LAYOUT,
    families:HARPY_SKILL_FAMILIES,
    abilityLookup:buildFamilySkillAbilityLookup(HARPY_SKILL_SLOT_LAYOUT, HARPY_SKILL_FAMILIES),
    legacyBaseAbilityIds:Object.freeze({
      talon:{legacy:['fleshTear','fleshRipper','peck','headWhip','probeStrike','needle_peck','mockingPeck','bracePeck','crowStrike'], current:'hrp_talon_clutch'},
      crush:{legacy:['raptorDive','deathDive','skyStrike','skyfallStrike','beakSlam','executionTalon','heavyTalon','heavy_talon','talon_slam','bodySlam','diveBomb'], current:'hrp_canopy_crush'},
      grip:{legacy:['predatorMark','trackPrey','markPrey','huntersMark','guard','royalGuard','wingShield','huntersCry','victoryChant','battleFocus','battle_focus','featherRuffle','dread_call','dreadCall','evade','windFeint'], current:'hrp_predator_grip'},
      lock:{legacy:['predatorBrand','finalHunt','executionTalon','beakSlam','deathDive','heavyTalon','heavy_talon','rending_talon','finisher_slam','execution_crush','predatorMark','trackPrey','markPrey'], current:'hrp_prey_lock'},
    }),
  },
});

try {
  globalThis.SKILL_EVOLUTION_LEVEL_INTERVAL = SKILL_EVOLUTION_LEVEL_INTERVAL;
  globalThis.FAMILY_EVOLUTION_BIRD_DATA = FAMILY_EVOLUTION_BIRD_DATA;
} catch (_) {}
