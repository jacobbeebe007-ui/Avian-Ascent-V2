#!/usr/bin/env node
/*
 * Phase 4a/4b — equipment skill rows resolve to executable dispatcher rows.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;

function fail(msg) {
  console.error('[equipment-skills] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[equipment-skills] ok  ', msg);
}

function loadSandbox(extraFiles) {
  const ctx = vm.createContext({
    globalThis: {},
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON,
    applySourceStatLoan(ps, player, bag, statKey, sourceId, value, turns) {
      if (!ps[bag]) ps[bag] = Object.create(null);
      ps[bag][sourceId] = { statKey, value, turns: turns || 1 };
      if (player && player.stats) player.stats[statKey] = (Number(player.stats[statKey]) || 0) + value;
      return value;
    },
    applySourceStatLoanPct(ps, player, bag, statKey, sourceId, pct, turns) {
      if (!player || !player.stats) return 0;
      const cur = Number(player.stats[statKey]) || 0;
      const amt = Math.round(cur * (Number(pct) || 0) / 100 * 100) / 100;
      return ctx.applySourceStatLoan(ps, player, bag, statKey, sourceId, amt, turns);
    },
  });
  ctx.globalThis = ctx;

  const baseFiles = [
    'js/bootstrap/_namespace.js',
    'js/data/combat-config.js',
    'js/data/effect-tiers.js',
    'js/data/equipment/skills.js',
    'js/data/equipment/items.js',
    'js/data/equipment/orb-focuses.js',
    'js/systems/ability-rider-parser.js',
    'js/systems/combat-formulas.js',
  ];
  for (const rel of [...baseFiles, ...(extraFiles || [])]) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing file ' + rel);
      continue;
    }
    vm.runInContext(readFileSync(full, 'utf8'), ctx, { filename: rel });
  }
  ctx.Avian = ctx.globalThis.Avian;
  ctx.Avian.flags = { equipmentV2: true };
  return ctx;
}

const ctx = loadSandbox([
  'js/systems/equipment.js',
  'js/systems/equipment-actions.js',
  'js/systems/equipment-effects.js',
]);

const skills = ctx.Avian.data.equipment.skills;
const actions = ctx.Avian.equipmentActions;
const effects = ctx.Avian.equipmentEffects;
const rarities = ['grey', 'orange'];

const skillIds = Object.keys(skills);
if (skillIds.length < 82) {
  fail(`expected ≥82 skills, got ${skillIds.length}`);
} else {
  ok(`${skillIds.length} equipment skill templates present (v0.9 library)`);
}

for (const tier of ['minor', 'moderate', 'major']) {
  const mag = effects.tierMagnitude(tier, 'up');
  const expected = tier === 'major' ? 20 : tier === 'moderate' ? 10 : 4;
  if (mag === expected) ok(`effectTiers ${tier} = ${mag}`);
  else fail(`effectTiers ${tier}: expected ${expected}, got ${mag}`);
}

for (const skillId of skillIds) {
  const skill = skills[skillId];
  const isUlt = skill.meter === 'full' || String(skill.barSlot || '').toLowerCase().includes('ultimate');
  for (const rarity of rarities) {
    if (isUlt && rarity === 'grey') continue;
    const row = actions.skillToAbilityRow(skillId, { id: 'TEST', rarity, aspect: 'terra' }, rarity);
    if (!row) {
      fail(`${skillId}@${rarity}: skillToAbilityRow returned null`);
      continue;
    }
    if (!row.id || !row.name) fail(`${skillId}@${rarity}: missing id/name`);
    if (row.enCost == null && row.apCost == null) fail(`${skillId}@${rarity}: missing EN/AP`);
    if (row.cooldown == null) fail(`${skillId}@${rarity}: missing cooldown`);
    if (!row.noDamage && row.skillPowerPct == null && row.abilityPower == null && row.baseDamage == null
      && !(Array.isArray(skill.scaling) && skill.scaling.length)) {
      fail(`${skillId}@${rarity}: missing skillPowerPct for damaging skill`);
    }
    if (row.source !== 'equipment' && row.source !== 'combination') {
      fail(`${skillId}@${rarity}: source not equipment/combination (got ${row.source})`);
    }
  }
}
ok('all skill ids resolve at grey+orange rarities');

const PROT_KINDS = new Set(['restoreArmour', 'restoreMagicArmour', 'restoreLowerPool', 'fortify', 'ward', 'bastion']);
let protChecked = 0;
for (const skillId of skillIds) {
  const skill = skills[skillId];
  const text = String(skill.riderText || '');
  const wantsProt = /Restore\s+\d+|Fortified Armour|Ward(?:\s+Magic)?\s*Armour|lower\s+protection\s+pool/i.test(text);
  if (!wantsProt) continue;
  const row = actions.skillToAbilityRow(skillId, { id: 'TEST', rarity: 'green' }, 'green');
  const riders = (row && row.riders) || [];
  if (!riders.some((r) => PROT_KINDS.has(r.kind))) {
    fail(`${skillId}: protection riderText missing executable rider (${text.slice(0, 80)})`);
  } else {
    protChecked++;
  }
}
if (protChecked > 0) ok(`${protChecked} protection skills carry executable riders`);
else fail('expected at least one protection skill with riders');

let poolDmgChecked = 0;
for (const skillId of skillIds) {
  const skill = skills[skillId];
  const text = String(skill.riderText || '');
  const mag = text.match(/Deal\s+(\d+)\s+Magic\s+(?:Armour|Armor)\s+damage/i);
  const arm = text.match(/Deal\s+(\d+)\s+(?:Armour|Armor)\s+damage/i);
  if (!mag && !arm) continue;
  const row = actions.skillToAbilityRow(skillId, { id: 'TEST', rarity: 'green' }, 'green');
  const riders = (row && row.riders) || [];
  if (mag && !riders.some((r) => r.kind === 'magicArmourDamage' || r.kind === 'magicArmourRetaliateOnPhysical')) {
    fail(`${skillId}: Magic Armour damage text missing pool rider (${text.slice(0, 80)})`);
  } else if (arm && !/Magic\s+(?:Armour|Armor)/i.test(arm[0]) && !riders.some((r) => r.kind === 'armourDamage')) {
    fail(`${skillId}: Armour damage text missing pool rider (${text.slice(0, 80)})`);
  } else {
    poolDmgChecked++;
  }
}
if (poolDmgChecked > 0) ok(`${poolDmgChecked} pool-damage skill texts resolve to pool-only riders`);
else ok('no equipment skills author pool-only Armour/Magic Armour damage');

/* Ailment rolls from rider text must land on dispatcher rows. */
const bleedRow = actions.skillToAbilityRow('WSK-004', { id: 'WPN-007', rarity: 'grey', family: 'Talon Blade' }, 'grey');
if (!bleedRow || bleedRow.ailment !== 'bleed' || Number(bleedRow.ailmentChance) !== 50) {
  fail(`WSK-004 expected bleed@50, got ${bleedRow && bleedRow.ailment}@${bleedRow && bleedRow.ailmentChance}`);
} else ok('WSK-004 Bleed 50% wired');

const flurry = actions.skillToAbilityRow('WSK-002', { id: 'WPN-001', rarity: 'grey', family: 'Dagger Pinion' }, 'grey');
if (!flurry || flurry.ailment !== 'bleed' || !flurry.ailmentRequireBothHitsHealth) {
  fail('WSK-002 expected bleed + both-hits health gate');
} else ok('WSK-002 Bleed + both-hits gate wired');

const comboBleed = actions.skillToAbilityRow('COMBO_BLEED_TALON', null, 'grey');
if (!comboBleed || comboBleed.ailment !== 'bleed' || Number(comboBleed.ailmentChance) !== 100) {
  fail(`COMBO_BLEED_TALON expected bleed@100, got ${comboBleed && comboBleed.ailment}@${comboBleed && comboBleed.ailmentChance}`);
} else ok('combo On-hit Bleed wired at 100%');

const dazedRow = actions.skillToAbilityRow('WSK-009', { id: 'WPN-025', rarity: 'grey', family: 'Beak Hammer' }, 'grey');
if (!dazedRow || dazedRow.ailment !== 'dazed' || Number(dazedRow.ailmentChance) !== 100 || Number(dazedRow.ailmentStacks) !== 1) {
  fail(`WSK-009 expected dazed@100×1, got ${dazedRow && dazedRow.ailment}@${dazedRow && dazedRow.ailmentChance}×${dazedRow && dazedRow.ailmentStacks}`);
} else ok('WSK-009 Dazed 1 stack wired');

const crippleRow = actions.skillToAbilityRow('WSK-020', { id: 'WPN-055', rarity: 'grey', family: 'Bow' }, 'grey');
if (!crippleRow || crippleRow.ailment !== 'crippled' || Number(crippleRow.ailmentChance) !== 100 || Number(crippleRow.ailmentStacks) !== 2) {
  fail(`WSK-020 expected crippled@100×2, got ${crippleRow && crippleRow.ailment}@${crippleRow && crippleRow.ailmentChance}×${crippleRow && crippleRow.ailmentStacks}`);
} else ok('WSK-020 Crippled 2 stacks wired');

const fractureRow = actions.skillToAbilityRow('WSK-026', { id: 'WPN-073', rarity: 'grey', family: 'Greatblade' }, 'grey');
if (!fractureRow || fractureRow.ailment !== 'fracture' || Number(fractureRow.ailmentChance) !== 100 || Number(fractureRow.ailmentStacks) !== 2) {
  fail(`WSK-026 expected fracture@100×2, got ${fractureRow && fractureRow.ailment}@${fractureRow && fractureRow.ailmentChance}×${fractureRow && fractureRow.ailmentStacks}`);
} else ok('WSK-026 Fracture 2 stacks wired');

let ailmentTextChecked = 0;
for (const skillId of skillIds) {
  const skill = skills[skillId];
  const text = String(skill.riderText || '');
  if (!/chance to apply|apply\s+\d+\s+(Bleed|Burn|Poison|Chilled|Shock|Dazed|Crippled|Fracture)|Orb['’]?s\s+ailment|weapon['’]?s magical ailment chance/i.test(text)) {
    continue;
  }
  const row = actions.skillToAbilityRow(
    skillId,
    skillId === 'WSK-015'
      ? { id: 'WPN-043', rarity: 'grey', family: 'Focus Orb', aspect: 'ember', orbFocus: 'ember' }
      : { id: 'TEST', rarity: 'grey', family: 'Focus Orb', aspect: 'ember', orbFocus: 'ember' },
    'grey'
  );
  if (!row || !(row.ailmentChance > 0) || !row.ailment) {
    fail(`${skillId}: ailment riderText missing ailment/chance (${text.slice(0, 90)})`);
  } else {
    ailmentTextChecked++;
  }
}
if (ailmentTextChecked > 0) ok(`${ailmentTextChecked} ailment skill texts resolve to chance rolls`);
else fail('expected ailment chance skills');

const st = { activeTierEffects: Object.create(null) };
const first = effects.applyTierEffect(st, 'player', 'atk', 'minor', 'up', 'test', 2);
const second = effects.applyTierEffect(st, 'player', 'atk', 'moderate', 'up', 'test', 2);
if (first.magnitude === 4 && second.magnitude === 10 && st.activeTierEffects['atk:up'].magnitude === 10) {
  ok('stacking: Minor then Moderate same stat → Moderate wins (flat 4/10)');
} else {
  fail(`stacking test failed: ${JSON.stringify({ first, second, active: st.activeTierEffects['atk:up'] })}`);
}

function kindsOf(row) {
  return ((row && row.riders) || []).map((r) => r && r.kind).filter(Boolean);
}
function hasKind(row, kind) {
  return kindsOf(row).includes(kind);
}
function riderOf(row, kind) {
  return ((row && row.riders) || []).find((r) => r && r.kind === kind) || null;
}

/* Weapon / armour / shield skill text must resolve to executable riders. */
{
  const quick = actions.skillToAbilityRow('WSK-001', { id: 'WPN-001', rarity: 'grey', family: 'Dagger Pinion' }, 'grey');
  const acc = riderOf(quick, 'gainAccThisHit');
  if (!acc || Number(acc.value) !== 10 || acc.when !== 'userFaster') {
    fail(`WSK-001 expected +10 Precision if faster, got ${JSON.stringify(acc)}`);
  } else ok('WSK-001 Quick Pinion Precision-if-faster');
}

{
  const riposte = actions.skillToAbilityRow('WSK-005', { id: 'WPN-013', rarity: 'grey', family: 'Duel Sabre' }, 'grey');
  const sp = riderOf(riposte, 'skillPowerThisHit');
  if (!sp || Number(sp.value) !== 20 || sp.when !== 'dodgedLast') {
    fail(`WSK-005 expected +20 Skill Power if Dodged, got ${JSON.stringify(sp)}`);
  } else ok('WSK-005 Riposte Slash dodge-gated Skill Power');
}

{
  const ward = actions.skillToAbilityRow('WSK-012', { id: 'WPN-031', rarity: 'grey', family: 'Wand' }, 'grey');
  if (!ward || ward.noDamage !== true) fail('WSK-012 Arcane Ward must be noDamage');
  else if (!hasKind(ward, 'ward') || Number(riderOf(ward, 'ward').value) !== 8) fail('WSK-012 missing Ward 8');
  else ok('WSK-012 Arcane Ward is utility + Ward 8');
}

{
  const hex = actions.skillToAbilityRow('WSK-014', { id: 'WPN-037', rarity: 'grey', family: 'Hexwood Wand' }, 'grey');
  const down = riderOf(hex, 'reduceEnemyMatk');
  if (!down || down.when !== 'reachedHealth') {
    fail(`WSK-014 Focus Down must gate on reachedHealth, got ${JSON.stringify(down)}`);
  } else ok('WSK-014 Withering Hex Health-gated Focus Down');
}

{
  const orb = actions.skillToAbilityRow(
    'WSK-016',
    { id: 'WPN-043', rarity: 'grey', family: 'Focus Orb', aspect: 'ember', orbFocus: 'ember' },
    'grey'
  );
  if (!orb || orb.noDamage !== true) fail('WSK-016 Orb Ward must be noDamage');
  else if (!hasKind(orb, 'ward') || !hasKind(orb, 'resistOrbAilmentApp')) {
    fail(`WSK-016 missing Ward or Orb ailment resist (${kindsOf(orb).join(',')})`);
  } else ok('WSK-016 Orb Ward + matching-ailment resist');
}

{
  const renew = actions.skillToAbilityRow('WSK-018', { id: 'WPN-049', rarity: 'grey', family: 'Bell Sceptre' }, 'grey');
  if (!renew || renew.noDamage !== true) fail('WSK-018 must be noDamage');
  else if (!hasKind(renew, 'restoreArmour') || !hasKind(renew, 'restoreMagicArmour')) {
    fail('WSK-018 missing dual restore');
  } else ok('WSK-018 Harmonic Renewal restore-only');
}

{
  const charge = actions.skillToAbilityRow('WSK-022', { id: 'WPN-061', rarity: 'grey', family: 'Lance' }, 'grey');
  const ign = riderOf(charge, 'ignoreGuardThisHit');
  if (!ign || Number(ign.value) !== 4) fail(`WSK-022 expected ignore 4 Guard, got ${JSON.stringify(ign)}`);
  else ok('WSK-022 Piercing Charge ignore 4 Guard');
}

{
  const draw = actions.skillToAbilityRow('WSK-028', { id: 'WPN-079', rarity: 'grey', family: 'Greatbow' }, 'grey');
  const prec = riderOf(draw, 'gainAccThisHit');
  if (!prec || Number(prec.value) !== 10) fail(`WSK-028 expected +10 Precision, got ${JSON.stringify(prec)}`);
  else ok('WSK-028 Raptor’s Draw +10 Precision');
}

{
  const reap = actions.skillToAbilityRow('WSK-029', { id: 'WPN-085', rarity: 'grey', family: 'War Scythe' }, 'grey');
  if (!reap || Number(reap.lifestealPct) !== 20) {
    fail(`WSK-029 expected 20% lifesteal, got ${reap && reap.lifestealPct}`);
  } else ok('WSK-029 Reaping Arc 20% Health lifesteal');
}

{
  const harvest = actions.skillToAbilityRow('WSK-030', { id: 'WPN-085', rarity: 'grey', family: 'War Scythe' }, 'grey');
  const sp = riderOf(harvest, 'skillPowerThisHit');
  if (!sp || Number(sp.value) !== 20 || sp.when !== 'targetLowHp') {
    fail(`WSK-030 expected +20 Skill Power vs <30% HP, got ${JSON.stringify(sp)}`);
  } else if (harvest.condition === 'targetLowHp' && harvest.conditionalAbilityPower > 1.3) {
    fail(`WSK-030 must not multiply Ability Power by 125% (${harvest.conditionalAbilityPower})`);
  } else ok('WSK-030 Death’s Harvest +20 Skill Power under 30% HP');
}

{
  const burst = actions.skillToAbilityRow('WSK-031', { id: 'WPN-091', rarity: 'grey', family: 'Runic Grimoire' }, 'grey');
  if (!hasKind(burst, 'resolveSourceRider')) fail('WSK-031 missing Grimoire rune rider');
  else ok('WSK-031 Inscribed Burst resolves Grimoire rune');
}

{
  const bastion = actions.skillToAbilityRow('WSK-032', { id: 'WPN-091', rarity: 'grey', family: 'Runic Grimoire' }, 'grey');
  if (!bastion || bastion.noDamage !== true) fail('WSK-032 must be noDamage');
  const fort = riderOf(bastion, 'fortify');
  const ward = riderOf(bastion, 'ward');
  if (!fort || Number(fort.value) !== 5 || !ward || Number(ward.value) !== 7) {
    fail(`WSK-032 expected Fortify 5 + Ward 7, got ${JSON.stringify(kindsOf(bastion))} ${JSON.stringify(fort)} ${JSON.stringify(ward)}`);
  } else ok('WSK-032 Runic Bastion Fortify 5 / Ward 7');
}

{
  const chorus = actions.skillToAbilityRow('WSK-033', { id: 'WPN-097', rarity: 'grey', family: 'Bard Song' }, 'grey');
  if (!hasKind(chorus, 'chooseCoreStatUp')) fail('WSK-033 missing choose Might/Dex/Focus');
  else ok('WSK-033 Rallying Chorus choose-stat Up');
}

{
  const note = actions.skillToAbilityRow('WSK-035', { id: 'WPN-103', rarity: 'grey', family: 'Lament Song' }, 'grey');
  const down = riderOf(note, 'reduceEnemyMdef');
  if (!down || down.when !== 'reachedHealth') fail(`WSK-035 Resolve Down must be reachedHealth, got ${JSON.stringify(down)}`);
  else ok('WSK-035 Mourning Note Health-gated Resolve Down');
}

{
  const brow = actions.skillToAbilityRow('ESK-003', null, 'green');
  if (hasKind(brow, 'gainGuarded')) fail('ESK-003 must not also grant Guarded stance from Guard Up');
  if (!hasKind(brow, 'gainDef') || !hasKind(brow, 'removeAilmentStack')) {
    fail(`ESK-003 expected Guard Up + remove Dazed, got ${kindsOf(brow).join(',')}`);
  } else if (riderOf(brow, 'removeAilmentStack').ailment !== 'dazed') {
    fail('ESK-003 must remove Dazed, not Concussed');
  } else ok('ESK-003 Braced Brow Guard Up + remove 1 Dazed');
}

{
  const mind = actions.skillToAbilityRow('ESK-009', null, 'green');
  if (!hasKind(mind, 'restoreMagicArmour') || !hasKind(mind, 'shortenMagicalDebuff')) {
    fail(`ESK-009 missing restore or duration cut (${kindsOf(mind).join(',')})`);
  } else ok('ESK-009 Clear Mind restore + shorten magical debuff');
}

{
  const shift = actions.skillToAbilityRow('ESK-023', null, 'green');
  const rm = riderOf(shift, 'removeAilmentStack');
  if (!rm || rm.ailment !== 'crippled') fail(`ESK-023 expected remove Crippled, got ${JSON.stringify(rm)}`);
  else ok('ESK-023 Buckler Shift removes 1 Crippled');
}

{
  const brace = actions.skillToAbilityRow('ESK-025', null, 'green');
  const rm = riderOf(brace, 'removeAilmentStack');
  if (!rm || rm.ailment !== 'fracture') fail(`ESK-025 expected remove Fracture, got ${JSON.stringify(rm)}`);
  else ok('ESK-025 Battle Brace removes 1 Fracture');
}

{
  const focus = actions.skillToAbilityRow('ESK-028', null, 'green');
  const arm = riderOf(focus, 'armNextSkill');
  if (!arm || Number(arm.value) !== 15 || arm.gate !== 'strength' || Number(arm.ignoreGuard) !== 4) {
    fail(`ESK-028 expected next Strength +15 SP ignore 4 Guard, got ${JSON.stringify(arm)}`);
  } else ok('ESK-028 Breaker’s Focus arms next Strength skill');
}

{
  const night = actions.skillToAbilityRow('ESK-044', null, 'green');
  if (!hasKind(night, 'ward') || !hasKind(night, 'resistMagicalAilmentApp')) {
    fail(`ESK-044 missing Ward or ailment resist (${kindsOf(night).join(',')})`);
  } else ok('ESK-044 Night Ward + magical ailment resist');
}

{
  const hexg = actions.skillToAbilityRow('ESK-046', null, 'green');
  if (!hasKind(hexg, 'ward') || !hasKind(hexg, 'nextMagicalDebuffShorter')) {
    fail(`ESK-046 missing next-debuff duration cut (${kindsOf(hexg).join(',')})`);
  } else ok('ESK-046 Hex Guard next magical debuff −1 turn');
}

{
  const mark = actions.skillToAbilityRow('ESK-058', null, 'green');
  const arm = riderOf(mark, 'armNextSkill');
  if (!arm || Number(arm.value) !== 15 || arm.gate !== 'finesse' || Number(arm.precision) !== 10) {
    fail(`ESK-058 expected next Finesse +15 SP +10 Precision, got ${JSON.stringify(arm)}`);
  } else ok('ESK-058 Marked Opening arms next Finesse skill');
}

{
  const echo = actions.skillToAbilityRow('COMBO_ECHO_TALON', null, 'grey');
  if (!hasKind(echo, 'delayedDamageSplit') && !echo.delayedDamageSplit) {
    fail('COMBO_ECHO_TALON missing 75/25 Delayed split');
  } else ok('COMBO_ECHO_TALON Delayed 75/25 split');
}

{
  const dual = actions.skillToAbilityRow('ESK-014', null, 'purple');
  const b = riderOf(dual, 'bastion');
  const armAmt = b && (b.armour != null ? Number(b.armour) : Number(b.value));
  const magAmt = b && (b.magicArmour != null ? Number(b.magicArmour) : Number(b.value));
  if (!b || armAmt !== 5 || magAmt !== 5) {
    fail(`ESK-014 bastion should be 5/5, got ${JSON.stringify(b)}`);
  } else ok('ESK-014 Dual Bastion 5/5');
}

let eqAudited = 0;
for (const skillId of skillIds) {
  const skill = skills[skillId];
  const text = String(skill.riderText || '');
  const row = actions.skillToAbilityRow(skillId, { id: 'TEST', rarity: 'grey', family: skill.family, aspect: 'ember', orbFocus: 'ember' }, 'grey');
  if (!row) {
    fail(`${skillId}: skillToAbilityRow null during text audit`);
    continue;
  }
  eqAudited += 1;
  const kinds = kindsOf(row);

  if (/utility/i.test(String(skill.skillType || '')) && !(Number(skill.skillPowerPct) > 0) && !row.noDamage) {
    fail(`${skillId}: Utility skillType should be noDamage`);
  }

  if (/If Magic Armour is broken and Health is damaged/i.test(text)
    || /If Armour is broken and Health is damaged/i.test(text)) {
    const downs = (row.riders || []).filter((r) => r && /^reduceEnemy/.test(r.kind));
    for (const r of downs) {
      if (r.when !== 'reachedHealth') fail(`${skillId}: ${r.kind} should be reachedHealth, got ${r.when}`);
    }
  }

  if (/Gain \d+ Fortified[\s\S]{0,80}?\d+ Ward/i.test(text)) {
    const fw = text.match(/Gain\s+(\d+)\s+Fortified[\s\S]{0,80}?(\d+)\s+Ward/i);
    if (fw && Number(fw[1]) !== Number(fw[2])) {
      if (!kinds.includes('fortify') || !kinds.includes('ward')) {
        fail(`${skillId}: unequal Fortify/Ward should be separate riders (${kinds.join(',')})`);
      }
    } else if (!kinds.includes('bastion') && !(kinds.includes('fortify') && kinds.includes('ward'))) {
      fail(`${skillId}: Fortify+Ward text missing bastion/fortify+ward`);
    }
  }

  if (/remove \d+ Dazed stack/i.test(text) && !kinds.includes('removeAilmentStack')) {
    fail(`${skillId}: missing remove Dazed`);
  }
  if (/The next (Strength|Magic|Finesse) skill/i.test(text) && !kinds.includes('armNextSkill')) {
    fail(`${skillId}: missing armNextSkill`);
  }
  if (/higher Agility than the target/i.test(text) && !kinds.includes('gainAccThisHit')) {
    fail(`${skillId}: missing Precision-if-faster`);
  }
  if (/Dodged the opponent/i.test(text) && !kinds.includes('skillPowerThisHit')) {
    fail(`${skillId}: missing dodge-gated Skill Power`);
  }
  if (/heal Health equal to \d+%/i.test(text) && !(row.lifestealPct > 0)) {
    fail(`${skillId}: missing lifestealPct`);
  }
  if (/\bGuard Up\b/i.test(text) && !/\bBrace\b/i.test(text) && kinds.includes('gainGuarded')) {
    fail(`${skillId}: Guard Up must not also grant Guarded stance`);
  }
}
ok(`audited ${eqAudited} equipment skills against authored rider text`);

if (failed) {
  console.error(`\n[equipment-skills] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-skills] all checks passed');
