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
if (skillIds.length !== 82) {
  fail(`expected 82 skills, got ${skillIds.length}`);
} else {
  ok('82 equipment skill templates present (64+18)');
}

for (const tier of ['minor', 'moderate', 'major']) {
  const mag = effects.tierMagnitude(tier, 'up');
  const expected = tier === 'major' ? 12 : tier === 'moderate' ? 8 : 6;
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
    if (!row.noDamage && row.abilityPower == null && row.baseDamage == null
      && !(skill.ap && Object.keys(skill.ap).length === 0)
      && !(Array.isArray(skill.scaling) && skill.scaling.length)) {
      fail(`${skillId}@${rarity}: missing abilityPower for damaging skill`);
    }
    if (row.source !== 'equipment' && row.source !== 'combination') {
      fail(`${skillId}@${rarity}: source not equipment/combination (got ${row.source})`);
    }
  }
}
ok('all skill ids resolve at grey+orange rarities');

const st = { activeTierEffects: Object.create(null) };
const first = effects.applyTierEffect(st, 'player', 'atk', 'minor', 'up', 'test', 2);
const second = effects.applyTierEffect(st, 'player', 'atk', 'moderate', 'up', 'test', 2);
if (first.magnitude === 6 && second.magnitude === 8 && st.activeTierEffects['atk:up'].magnitude === 8) {
  ok('stacking: Minor then Moderate same stat → Moderate wins');
} else {
  fail(`stacking test failed: ${JSON.stringify({ first, second, active: st.activeTierEffects['atk:up'] })}`);
}

if (failed) {
  console.error(`\n[equipment-skills] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-skills] all checks passed');
