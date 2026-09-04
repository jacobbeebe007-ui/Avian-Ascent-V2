#!/usr/bin/env node
/*
 * Structural CI checks for Affinity Arsenal v0.6 content.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function loadAvianData(relPaths) {
  const sandbox = { globalThis: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of relPaths) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing file ' + rel);
      continue;
    }
    vm.runInContext(readFileSync(full, 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.Avian && sandbox.Avian.data;
}

const data = loadAvianData([
  'js/data/combat-config.js',
  'js/data/effect-tiers.js',
  'js/data/aspects.js',
  'js/data/affinities.js',
  'js/data/ailment-families.js',
  'js/data/display-glossary.js',
  'js/data/enemy-scaling-profiles.js',
  'js/data/progression/rules.js',
  'js/data/progression/level-growth.js',
  'js/data/progression/star-growth.js',
  'js/data/progression/tier-mults.js',
  'js/data/equipment/skills.js',
  'js/data/equipment/items.js',
  'js/data/equipment/families.js',
  'js/data/equipment/orb-focuses.js',
  'js/data/equipment/combinations.js',
  'js/data/equipment/weapon-access.js',
]);

if (!data) {
  fail('Avian.data not published');
  process.exit(1);
}

const skills = data.equipment && data.equipment.skills;
const orbs = data.equipment && data.equipment.orbFocuses;
const combos = data.equipment && data.equipment.combinationTechniques;
const tiers = data.effectTiers;
const aspects = data.aspects;
const affinities = data.affinities;
const cfg = data.combatConfig;
const families = data.ailmentFamilies;

const skillIds = skills ? Object.keys(skills) : [];
const comboIds = skillIds.filter((id) => id.startsWith('COMBO_'));
if (skillIds.length < 82) fail('expected ≥82 skills, got ' + skillIds.length);
if (comboIds.length < 18) fail('expected ≥18 COMBO_* skills, got ' + comboIds.length);

if (!orbs || Object.keys(orbs).length !== 6) {
  fail('expected 6 orb focuses, got ' + (orbs ? Object.keys(orbs).length : 0));
}
if (!combos || Object.keys(combos).length < 18) {
  fail('expected ≥18 combinationTechniques, got ' + (combos ? Object.keys(combos).length : 0));
}

for (const id of Object.keys(combos || {})) {
  if (!skills[id]) fail('combo missing from skills catalog: ' + id);
}

if (!tiers || !tiers.buff || tiers.buff.minor !== 4 || tiers.buff.moderate !== 10 || tiers.buff.major !== 20) {
  fail('effect tiers core expected 4/10/20');
}
if (!tiers.points || tiers.points.minor !== 4 || tiers.points.moderate !== 10 || tiers.points.major !== 20) {
  fail('effect point tiers expected 4/10/20');
}

if (!aspects || !aspects.aliases || aspects.aliases.earth !== 'terra') {
  fail('affinity alias earth→terra missing');
}
if (!aspects.displayNames || aspects.displayNames.terra !== 'Earth') {
  fail('displayNames.terra expected Earth');
}
if (!affinities || !affinities.toLegacy || affinities.toLegacy.sky !== 'aeris') {
  fail('affinities.toLegacy.sky expected aeris');
}

const chart = aspects.chart;
const expected = {
  terra: { terra: 'neutral', aeris: 'resisted', tempest: 'dominant', solis: 'dominant', lunae: 'neutral', maris: 'resisted' },
};
if (!chart || !chart.terra || chart.terra.aeris !== 'resisted' || chart.terra.tempest !== 'dominant') {
  fail('aspect chart terra row mismatch');
}
for (const [atk, row] of Object.entries(expected)) {
  for (const [def, rel] of Object.entries(row)) {
    if (chart[atk][def] !== rel) fail('chart ' + atk + '→' + def + ' expected ' + rel);
  }
}

if (!cfg || (
  cfg.packVersion !== '2026.09-combat-v2.1-master'
  && cfg.packVersion !== '2026.07-equipment-v1.5-physical-ailments'
  && cfg.packVersion !== '2026.07-equipment-v1.3-basic-starting-weapons'
  && cfg.packVersion !== '2026.07-equipment-v1.2-restoration'
  && cfg.packVersion !== '2026.07-weapon-first-v0.9'
)) {
  fail('combatConfig.packVersion mismatch (expected combat-v2.1-master)');
}
if (!cfg.affinityArsenalV06) fail('combatConfig.affinityArsenalV06 should be true');
if (!cfg.weaponFirstV09 || !cfg.weaponFirst || !cfg.weaponFirst.enabled) fail('weaponFirst expected');
if (!cfg.ailments || cfg.ailments.burnMaxStacks !== 5) fail('burnMaxStacks expected 5');
if (cfg.ailments.stacksPerActionCap !== 2 || cfg.ailments.stacksPerTurnCap !== 4) {
  fail('ailment application caps expected 2/4');
}

if (!families || !families.stacking || !families.stacking.shock) {
  fail('ailmentFamilies.shock missing');
}
if (!families.resolved || !families.resolved.incinerating || !families.resolved.controlResistance) {
  fail('ailmentFamilies resolved incinerating/controlResistance missing');
}
if (!families.stacking.fracture || !families.stacking.crippled || !families.stacking.dazed) {
  fail('ailmentFamilies physical stacking ailments missing');
}
if (!families.resolved.shattered || !families.resolved.immobilised || !families.resolved.concussed) {
  fail('ailmentFamilies physical resolved states missing');
}

const access = data.equipment.weaponAccess;
if (!access || !access.Greatbow || access.Greatbow.classAccess.indexOf('knight') < 0) {
  fail('Greatbow class access expected knight/brute');
}
if (!access['Dagger Pinion'] || access['Dagger Pinion'].classAccess.indexOf('rogue') < 0) {
  fail('Dagger Pinion rogue-only expected');
}

const levelGrowth = data.progression && data.progression.levelGrowth;
if (!levelGrowth || Object.keys(levelGrowth).length !== 240) {
  fail('expected 240 level-growth keys, got ' + (levelGrowth ? Object.keys(levelGrowth).length : 0));
}

const profiles = data.enemyScalingProfiles && data.enemyScalingProfiles.profiles;
if (!profiles || !profiles.standard || !profiles.boss) fail('enemy scaling profiles missing');

const fo = Object.values(data.equipment.items || {}).filter((it) => it.family === 'Focus Orb');
const stamped = fo.filter((it) => it.orbFocus);
if (stamped.length < 6) fail('expected at least 6 Focus Orb items with orbFocus, got ' + stamped.length);

if (!process.exitCode) {
  console.log('OK affinity-arsenal content: v0.9 skills/combos, 6 orbs, tiers 4/10/20, aliases, progression.');
}
