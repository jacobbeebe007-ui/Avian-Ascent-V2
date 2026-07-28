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

let ailmentTextChecked = 0;
for (const skillId of skillIds) {
  const skill = skills[skillId];
  const text = String(skill.riderText || '');
  if (!/chance to apply|On hit,\s*apply\s+\d+\s+(Bleed|Burn|Poison|Chilled|Shock)|Orb['’]?s\s+ailment|weapon['’]?s magical ailment chance/i.test(text)) {
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

if (failed) {
  console.error(`\n[equipment-skills] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-skills] all checks passed');
