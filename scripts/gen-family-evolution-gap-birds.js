#!/usr/bin/env node
/**
 * Emits js/data/family-evolution-gap-birds.js — compact family-evolution skill
 * catalogs for playable birds that previously lacked FAMILY_EVOLUTION_BIRD_DATA.
 *
 * Run: node scripts/gen-family-evolution-gap-birds.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'data', 'family-evolution-gap-birds.js');

const freeze = 'Object.freeze';

function strikerFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'filler_attack',maxTier:3,\
tierNames:{1:'I',2:'II',3:'III'},\
masteries:[\
{id:'power',name:'Pressure',desc:'+5% ${title} damage.'},\
{id:'precision',name:'Aim',desc:'${title} accuracy improves.'},\
{id:'control',name:'Control',desc:'${title} riders improve.'}],\
paths:${freeze}({\
pierce:{pathId:'pierce',displayName:'Pierce',abilities:{1:'${base}',2:'talon_rake',3:'talon_rend'}},\
bleed:{pathId:'bleed',displayName:'Bleed',abilities:{1:'slice_jab',2:'slice_rake',3:'slice_rend'}},\
execute:{pathId:'execute',displayName:'Execute',abilities:{1:'hunters_jab',2:'hunters_rake',3:'hunters_rend'}}\
})\
}`;
}

function heavyFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'signature_attack',maxTier:3,\
tierNames:{1:'Open',2:'Break',3:'Ruin'},\
masteries:[\
{id:'power',name:'Weight',desc:'+6% ${title} damage.'},\
{id:'precision',name:'Line',desc:'Crit routes hit cleaner.'},\
{id:'control',name:'Lock',desc:'Control riders improve.'}],\
paths:${freeze}({\
crit:{pathId:'crit',displayName:'Crit',abilities:{1:'${base}',2:'silver_arc',3:'regal_crest'}},\
weaken:{pathId:'weaken',displayName:'Weaken',abilities:{1:'pressing_sweep',2:'pressing_arc',3:'crushing_crest'}},\
return:{pathId:'return',displayName:'Return',abilities:{1:'echo_sweep',2:'return_arc',3:'double_crest'}}\
})\
}`;
}

function braceFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'guard_setup',maxTier:3,\
tierNames:{1:'Brace',2:'Hold',3:'Stand'},\
masteries:[\
{id:'power',name:'Bulwark',desc:'Guard stacks feel heavier.'},\
{id:'precision',name:'Measure',desc:'Amp routes sharpen.'},\
{id:'control',name:'Anchor',desc:'Read routes improve.'}],\
paths:${freeze}({\
guard:{pathId:'guard',displayName:'Guard',abilities:{1:'${base}',2:'gos_hold_line',3:'gos_stand_fast'}},\
amp:{pathId:'amp',displayName:'Amp',abilities:{1:'iron_guard',2:'gos_press_line',3:'gos_final_stand'}},\
read:{pathId:'read',displayName:'Read',abilities:{1:'steady_guard',2:'gos_read_line',3:'gos_read_stand'}}\
})\
}`;
}

function markFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'setup_payoff',maxTier:3,\
tierNames:{1:'Mark',2:'Sign',3:'Finale'},\
masteries:[\
{id:'power',name:'Written Focus',desc:'Amp routes improve.'},\
{id:'precision',name:'Cold Read',desc:'Break routes improve.'},\
{id:'control',name:'Verdict',desc:'Execute routes improve.'}],\
paths:${freeze}({\
amp:{pathId:'amp',displayName:'Amp',abilities:{1:'markPrey',2:'brandPrey',3:'huntersMark'}},\
break:{pathId:'break',displayName:'Break',abilities:{1:'exposeWeakness',2:'exposeGuard',3:'quarryBreak'}},\
execute:{pathId:'execute',displayName:'Execute',abilities:{1:'predatorMark',2:'predatorBrand',3:'finalHunt'}}\
})\
}`;
}

function rallyFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'mobility_utility',maxTier:3,\
tierNames:{1:'Stride',2:'Draft',3:'Storm'},\
masteries:[\
{id:'power',name:'Tempo',desc:'Speed routes improve.'},\
{id:'precision',name:'Veil',desc:'Dodge routes improve.'},\
{id:'control',name:'Pressure',desc:'Accuracy-break routes improve.'}],\
paths:${freeze}({\
speed:{pathId:'speed',displayName:'Speed',abilities:{1:'${base}',2:'tailwindGust',3:'hyperCurrent'}},\
dodge:{pathId:'dodge',displayName:'Dodge',abilities:{1:'graceStep',2:'slipVeil',3:'phantomGale'}},\
acc_break:{pathId:'acc_break',displayName:'Accuracy Break',abilities:{1:'featherDrift',2:'blindingVeil',3:'stormShroud'}}\
})\
}`;
}

function iceHonkFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'tank_strike',maxTier:3,\
tierNames:{1:'Peck',2:'Blast',3:'Wave'},\
masteries:[\
{id:'power',name:'Ice Weight',desc:'Honk-line chip improves.'},\
{id:'precision',name:'Frost Aim',desc:'Accuracy riders improve.'},\
{id:'control',name:'Cold Front',desc:'Control riders improve.'}],\
paths:${freeze}({\
chill:{pathId:'chill',displayName:'Chill',abilities:{1:'${base}',2:'gos_dread_blare',3:'gos_panic_uproar'}},\
break:{pathId:'break',displayName:'Break',abilities:{1:'gos_harsh_honk',2:'gos_wavering_blare',3:'gos_blinding_uproar'}},\
speed:{pathId:'speed',displayName:'Rally',abilities:{1:'gos_keen_honk',2:'gos_rally_blare',3:'gos_charge_uproar'}}\
})\
}`;
}

function echoSongFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'filler_spell',maxTier:3,\
tierNames:{1:'Note',2:'Echo',3:'Refrain'},\
masteries:[\
{id:'power',name:'Bright Cadence',desc:'+8% song damage.'},\
{id:'precision',name:'Pitch',desc:'Spell miss improves.'},\
{id:'control',name:'Ring',desc:'Control riders improve.'}],\
paths:${freeze}({\
burn:{pathId:'burn',displayName:'Burn',abilities:{1:'ember_note',2:'ember_echo',3:'ember_refrain'}},\
confuse:{pathId:'confuse',displayName:'Confuse',abilities:{1:'warble_note',2:'dizzy_echo',3:'maddening_refrain'}},\
delayed:{pathId:'delayed',displayName:'Resonance',abilities:{1:'${base}',2:'delayed_echo',3:'returning_refrain'}}\
})\
}`;
}

function mimicSongFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'signature_spell',maxTier:3,\
tierNames:{1:'Call',2:'Verse',3:'Aria'},\
masteries:[\
{id:'power',name:'Voice',desc:'+9% chorus damage.'},\
{id:'precision',name:'Ear',desc:'Control odds improve.'},\
{id:'control',name:'Show',desc:'Copycat payoff improves.'}],\
paths:${freeze}({\
fear:{pathId:'fear',displayName:'Fear',abilities:{1:'dread_mimic',2:'panic_chorus',3:'terror_aria'}},\
paralysis:{pathId:'paralysis',displayName:'Paralysis',abilities:{1:'shock_mimic',2:'static_chorus',3:'lock_aria'}},\
copycat:{pathId:'copycat',displayName:'Copycat',abilities:{1:'${base}',2:'echo_chorus',3:'stolen_aria'}}\
})\
}`;
}

function trickUtilityFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'trick_utility',maxTier:3,\
tierNames:{1:'Feint',2:'Flourish',3:'Spectacle'},\
masteries:[\
{id:'power',name:'Flash',desc:'ACC pressure improves.'},\
{id:'precision',name:'Slip',desc:'Dodge bonuses improve.'},\
{id:'control',name:'Crowd',desc:'Pressure riders improve.'}],\
paths:${freeze}({\
acc_break:{pathId:'acc_break',displayName:'Accuracy Break',abilities:{1:'glitter_taunt',2:'dazzle_flourish',3:'spectacle_storm'}},\
dodge:{pathId:'dodge',displayName:'Dodge',abilities:{1:'slip_taunt',2:'feather_flourish',3:'mirage_spectacle'}},\
pressure:{pathId:'pressure',displayName:'Pressure',abilities:{1:'${base}',2:'provoking_flourish',3:'grand_spectacle'}}\
})\
}`;
}

function tankHealFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'tank_sustain',maxTier:3,\
tierNames:{1:'Recover',2:'Bulk',3:'Anchor'},\
masteries:[\
{id:'power',name:'Deep Bag',desc:'Healing routes improve.'},\
{id:'precision',name:'Meter',desc:'Meter buff routes improve.'},\
{id:'control',name:'Poise',desc:'Hybrid routes improve.'}],\
paths:${freeze}({\
heal:{pathId:'heal',displayName:'Heal',abilities:{1:'${base}',2:'preen',3:'molt'}},\
guard:{pathId:'guard',displayName:'Wall',abilities:{1:'guardianCry',2:'bulwarkRoar',3:'fortress_stance'}},\
cleanse:{pathId:'cleanse',displayName:'Cleanse',abilities:{1:'reveille',2:'battleHymn',3:'victoryChant'}}\
})\
}`;
}

function chorusUtilityFam(fid, title, base) {
  return `\
  ${fid}:{\
 familyId:'${fid}',displayName:'${title}',baseAbilityId:'${base}',slotRole:'support_spell',maxTier:3,\
tierNames:{1:'Cue',2:'Cadence',3:'Curtain'},\
masteries:[\
{id:'power',name:'Prism Setup',desc:'Amp routes improve.'},\
{id:'precision',name:'Hue Reader',desc:'Delayed routes improve.'},\
{id:'control',name:'Spotlight',desc:'Weaken routes improve.'}],\
paths:${freeze}({\
damage_amp:{pathId:'damage_amp',displayName:'Damage Amp',abilities:{1:'${base}',2:'harmonic_measure',3:'finale_mark'}},\
delayed:{pathId:'delayed',displayName:'Afterbeat',abilities:{1:'echo_mark',2:'resonant_measure',3:'delayed_finale'}},\
weaken:{pathId:'weaken',displayName:'Weaken',abilities:{1:'cracking_mark',2:'softening_measure',3:'fading_finale'}}\
})\
}`;
}

/** Birds keyed same as BIRDS + skillSlots order */
const SPECS = [
  ['baldEagle', ['skyTalon', 'guard', 'predatorMark', 'freedomCry'], [strikerFam, braceFam, markFam, rallyFam], ['Sky Talon Line', 'Shield Line', 'Predator Mark Line', 'Freedom Rally Line']],
  ['penguin', ['icebreakerHonk', 'snowWall', 'guard', 'tundraCall'], [iceHonkFam, heavyFam, braceFam, tankHealFam], ['Ice Honk Line', 'Ice Wall Line', 'Brace Line', 'Tundra Sustain Line']],
  ['ostrich', ['powerKick', 'stampedeStrike', 'sandKick', 'momentumCharge'], [strikerFam, heavyFam, braceFam, rallyFam], ['Kick Line', 'Charge Line', 'Dust Line', 'Momentum Line']],
  ['cassowary', ['raptorKick', 'warStomp', 'momentumCharge', 'crushingTalon'], [strikerFam, heavyFam, rallyFam, strikerFam], ['Kick Line', 'Stomp Line', 'Momentum Line', 'Talon Line']],
  ['emu', ['headWhip', 'warCharge', 'sandKick', 'momentumStrike'], [strikerFam, heavyFam, braceFam, strikerFam], ['Whip Line', 'Charge Line', 'Dust Line', 'Strike Line']],
  ['dukeBlakiston', ['nightTalon', 'nightfallCall', 'courtSummon', 'verdict'], [strikerFam, mimicSongFam, chorusUtilityFam, heavyFam], ['Night Talon Line', 'Court Call Line', 'Summon Line', 'Verdict Line']],
  ['wren', ['wren_quick_peck', 'wren_needle_dart', 'wren_feather_feint', 'wren_trail_step'], [strikerFam, strikerFam, trickUtilityFam, rallyFam], ['Quick Peck Line', 'Needle Line', 'Feint Line', 'Trail Line']],
  ['fairywren', ['fwren_song', 'fwren_bright_call', 'fwren_tiny_peck', 'fwren_refrain'], [echoSongFam, mimicSongFam, strikerFam, echoSongFam], ['Song Line', 'Bright Call Line', 'Peck Line', 'Refrain Line']],
  ['firecrest', ['firecrest_jab', 'firecrest_burn_dash', 'firecrest_cinder_step', 'firecrest_heat_mark'], [strikerFam, strikerFam, rallyFam, chorusUtilityFam], ['Flame Jab Line', 'Burn Dash Line', 'Cinder Line', 'Heat Mark Line']],
  ['wagtail', ['wagtail_peck', 'wagtail_flick_strike', 'wagtail_mock_call', 'wagtail_tail_mark'], [strikerFam, strikerFam, trickUtilityFam, chorusUtilityFam], ['Peck Line', 'Flick Line', 'Mock Line', 'Tail Mark Line']],
  ['galah', ['galah_beak_tap', 'galah_flash_strike', 'galah_screech', 'galah_show_mark'], [strikerFam, strikerFam, mimicSongFam, chorusUtilityFam], ['Tap Line', 'Flash Line', 'Screech Line', 'Show Mark Line']],
  ['bluejay', ['bluejay_crest_jab', 'bluejay_jaybreaker', 'bluejay_crest_guard', 'bluejay_raucous_cry'], [strikerFam, heavyFam, braceFam, trickUtilityFam], ['Crest Jab Line', 'Jaybreaker Line', 'Crest Guard Line', 'Cry Line']],
  ['cardinal', ['cardinal_note', 'cardinal_hymn', 'cardinal_jab', 'cardinal_refrain'], [echoSongFam, mimicSongFam, strikerFam, echoSongFam], ['Note Line', 'Hymn Line', 'Jab Line', 'Refrain Line']],
  ['bushturkey', ['bturkey_scrap_peck', 'bturkey_brush_crash', 'bturkey_bush_guard', 'bturkey_rattle_call'], [strikerFam, heavyFam, braceFam, trickUtilityFam], ['Scrap Line', 'Brush Crash Line', 'Bush Guard Line', 'Rattle Line']],
  ['vulture', ['vulture_grave_jab', 'vulture_corpse_crush', 'vulture_bone_ward', 'vulture_grave_dirge'], [strikerFam, heavyFam, braceFam, mimicSongFam], ['Grave Jab Line', 'Corpse Crush Line', 'Bone Ward Line', 'Dirge Line']],
  ['barnowl', ['barnowl_talon', 'barnowl_shadow_dive', 'barnowl_death_glare', 'barnowl_silent_glide'], [strikerFam, heavyFam, chorusUtilityFam, rallyFam], ['Talon Line', 'Shadow Dive Line', 'Glare Line', 'Glide Line']],
  ['bustard', ['bustard_heavy_jab', 'bustard_dust_trample', 'bustard_plainshield', 'bustard_steppe_call'], [strikerFam, heavyFam, braceFam, mimicSongFam], ['Heavy Jab Line', 'Trample Line', 'Plainshield Line', 'Steppe Call Line']],
  ['goldeneagle', ['golden_talon', 'golden_swoop', 'golden_verdict', 'golden_focus'], [strikerFam, heavyFam, heavyFam, rallyFam], ['Sun Talon Line', 'Swoop Line', 'Verdict Line', 'Focus Line']],
  ['pelican', ['pelican_snap', 'pelican_crush', 'pelican_guard', 'pelican_recovery'], [strikerFam, heavyFam, braceFam, tankHealFam], ['Snap Line', 'Crush Line', 'Guard Line', 'Recovery Line']],
  ['marabou', ['marabou_jab', 'marabou_lunge', 'marabou_sentence', 'marabou_hunt'], [strikerFam, strikerFam, heavyFam, chorusUtilityFam], ['Rotbeak Line', 'Lunge Line', 'Sentence Line', 'Hunt Line']],
];

function makeSlotLayout(slots) {
  const famIds = ['a', 'b', 'c', 'd'];
  const lines = slots.map((aid, i) => `  {slotIndex:${i}, familyId:'${famIds[i]}', abilityId:'${aid}'}`);
  return `${freeze}([\n${lines.join(',\n')}\n])`;
}

function familiesFor(bird) {
  const [_, aids, builders, titles] = bird;
  const famKeys = ['a', 'b', 'c', 'd'];
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(builders[i](famKeys[i], titles[i], aids[i]));
  }
  return `${freeze}({\n${parts.join(',\n')}\n})`;
}

function emit() {
  const birds = {};
  const chunks = [];
  for (const row of SPECS) {
    const [key, aids, ,] = row;
    chunks.push(`\
  ${key}:{\
 birdKey:'${key}',\
 slotLayout:${makeSlotLayout(aids)},\
 families:${familiesFor(row)},\
  }`);
    birds[key] = {
      birdKey: key,
      startAbilities: aids,
      familySlotIds: ['a', 'b', 'c', 'd'],
    };
  }

  const inventoryPath = path.join(ROOT, 'scripts', 'data', 'family-evolution-gap-inventory.json');
  fs.mkdirSync(path.dirname(inventoryPath), { recursive: true });
  fs.writeFileSync(
    inventoryPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: 'Gap birds now carry authored catalogs in js/data/family-evolution-gap-birds.js',
        birds,
      },
      null,
      2
    ),
    'utf8'
  );

  const body = `\
/**
 * Family-evolution catalogs for birds that previously lacked skill-slot trees.
 * GENERATED FILE — run: node scripts/gen-family-evolution-gap-birds.js
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);

  Avian.data.familyEvolutionGapBirds = ${freeze}({
${chunks.join(',\n')}
  });
})();
`;

  fs.writeFileSync(OUT, body, 'utf8');
  console.log('Wrote', path.relative(ROOT, OUT));
  console.log('Wrote', path.relative(ROOT, inventoryPath));
}

emit();
