#!/usr/bin/env node
/*
 * Structural CI checks against generated equipment v0.3 data.
 * Mirrors importer fail-fast invariants without re-reading the workbook.
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
  'js/data/equipment/slots.js',
  'js/data/equipment/skills.js',
  'js/data/equipment/items.js',
  'js/data/equipment/families.js',
  'js/data/equipment/reference-loadouts.js',
  'js/data/birds-v2.js',
  'js/data/combat-pack/classes.js',
  'js/data/combat-pack/bird-passives.js',
  'js/data/combat-pack/innate-utilities.js',
]);

if (!data) {
  fail('Avian.data not published');
  process.exit(1);
}

const slots = data.equipment && data.equipment.slots;
const skills = data.equipment && data.equipment.skills;
const items = data.equipment && data.equipment.items;
const families = data.equipment && data.equipment.families;
const loadouts = data.equipment && data.equipment.referenceLoadouts;
const birds = data.birdsV2;
const classes = data.combatPack && data.combatPack.classes;
const passives = data.combatPack && data.combatPack.birdPassives;
const utilities = data.combatPack && data.combatPack.innateUtilities;
const tiers = data.effectTiers;
const cfg = data.combatConfig;

if (!slots || !slots.slotOrder || slots.slotOrder.length !== 7) {
  fail('expected 7 equipment slots, got ' + (slots && slots.slotOrder && slots.slotOrder.length));
}
if (slots.slots && slots.slots.shield) fail('dedicated shield slot should be removed');
if (!slots.slots || !slots.slots.offHand) fail('offHand slot missing');

const skillIds = skills ? Object.keys(skills) : [];
if (skillIds.length < 82) fail('expected ≥82 skills (v0.9 Skill Library), got ' + skillIds.length);
if (!skills.BASIC_PHYSICAL || !skills.BASIC_MAGIC) fail('missing BASIC_PHYSICAL / BASIC_MAGIC');
if (!skills.BASIC_PHYSICAL.naturalStrikeFlat || skills.BASIC_PHYSICAL.skillPowerPct !== 100) {
  fail('BASIC_PHYSICAL must be Beak Jab (flat 1–2 + 100% Skill Power)');
}
if (skills.BASIC_PHYSICAL.name !== 'Beak Jab') fail('BASIC_PHYSICAL name must be Beak Jab, got ' + skills.BASIC_PHYSICAL.name);
if (skills.BASIC_MAGIC.name !== 'Tail Wand') fail('BASIC_MAGIC name must be Tail Wand, got ' + skills.BASIC_MAGIC.name);
if (skills.BASIC_PHYSICAL.heavyAccuracyPenalty) fail('BASIC_PHYSICAL must have no heavy accuracy penalty');

const itemIds = items ? Object.keys(items) : [];
if (itemIds.length !== 240) fail('expected 240 items, got ' + itemIds.length);

const familyIds = families ? Object.keys(families) : [];
/* 40 catalogue + Dagger Pinion alias + Bow/Hand Crossbow stubs */
if (familyIds.length < 40) fail('expected ≥40 families, got ' + familyIds.length);

const birdIds = birds ? Object.keys(birds) : [];
if (birdIds.length !== 52) fail('expected 52 birds, got ' + birdIds.length);

if (!classes || Object.keys(classes).length < 8) fail('expected ≥8 classes');
if (!passives || Object.keys(passives).length !== 52) fail('expected 52 bird passives v2');
if (!utilities || Object.keys(utilities).length !== 52) fail('expected 52 innate utilities');

if (!tiers || !tiers.buff || tiers.buff.minor !== 4 || tiers.buff.moderate !== 10 || tiers.buff.major !== 20) {
  fail('effectTiers must be Minor=4 / Moderate=10 / Major=20 (v0.9 flat)');
}
if (!tiers.flatStat) fail('effectTiers.flatStat expected');
if (tiers.buff.grand != null || tiers.buff.epic != null || tiers.buff.legendary != null) {
  fail('legacy grand/epic/legendary tiers must not appear in effectTiers');
}

if (!cfg || cfg.packVersion !== '2026.07-weapon-first-v0.9') {
  fail('combatConfig.packVersion must be weapon-first-v0.9');
}
if (!cfg.weaponFirst || !cfg.weaponFirst.enabled) fail('combatConfig.weaponFirst.enabled expected');
if (cfg.directScaling && cfg.directScaling.enabled) fail('combatConfig.directScaling must be disabled for v0.9');
if (!cfg.defence || cfg.defence.mitigationCap !== 0.75) fail('combatConfig.defence.mitigationCap must be 0.75');
if (!cfg.penetration || cfg.penetration.cap !== 0.4) fail('combatConfig.penetration.cap must be 0.4');
if (!cfg.ultimateMeter || cfg.ultimateMeter.utilityAwards[1] !== 0) {
  fail('combatConfig utility meter awards must be 0 (R-ULT-001)');
}

const forbidden = new Set((slots.forbiddenStatIds || []).map((s) => String(s).toLowerCase()));
const rarityOrder = slots.rarityOrder || ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

let orangeMissingUnique = 0;
let nonOrangeWithUnique = 0;
let unresolvedSkill = 0;
let forbiddenStatHits = 0;
let handsMismatch = 0;

for (const id of itemIds) {
  const it = items[id];
  if (!it) continue;
  for (const key of ['skill1', 'skill2', 'pairedSkill', 'ultimate']) {
    const sid = it[key];
    if (sid && !skills[sid]) {
      unresolvedSkill++;
      if (unresolvedSkill <= 5) fail(id + ' unresolved ' + key + '=' + sid);
    }
  }
  if (it.rarity === 'orange') {
    if (!it.uniqueEffect) orangeMissingUnique++;
  } else if (it.uniqueEffect) {
    nonOrangeWithUnique++;
  }
  const hands = Number(it.hands) || 0;
  if (it.slot === 'Weapon') {
    if (hands !== 1 && hands !== 2) handsMismatch++;
  } else if (hands !== 0) {
    handsMismatch++;
  }
  const stats = it.stats || {};
  for (const sk of Object.keys(stats)) {
    const low = sk.toLowerCase();
    if (low === 'acc' || forbidden.has(sk) || forbidden.has(low)) forbiddenStatHits++;
    /* Core % rolls are forbidden in v0.9; ailmentChancePct / healingPowerPct remain allowed. */
    if (/^(hp|atk|dex|def|matk|mdef|spd|vitality|might|guard|focus|resolve|agility)pct$/i.test(sk)) {
      forbiddenStatHits++;
    }
    if (/light|medium|heavy.*attack/i.test(sk)) forbiddenStatHits++;
  }
  if (it.slot === 'Weapon' && (it.minDamage == null || it.maxDamage == null)) {
    fail(id + ' weapon missing min/max damage');
  }
}

if (orangeMissingUnique) fail(orangeMissingUnique + ' orange items missing uniqueEffect');
if (nonOrangeWithUnique) fail(nonOrangeWithUnique + ' non-orange items have uniqueEffect');
if (handsMismatch) fail(handsMismatch + ' items with inconsistent hands');
if (forbiddenStatHits) fail(forbiddenStatHits + ' forbidden-stat hits on items');

/* 40 families × 6 rarities = 240 */
const byFamily = Object.create(null);
for (const id of itemIds) {
  const f = items[id].family || '?';
  byFamily[f] = (byFamily[f] || 0) + 1;
}
const badFamilyCounts = Object.keys(byFamily).filter((f) => byFamily[f] !== 6);
if (badFamilyCounts.length) {
  fail('families without exactly 6 rarities: ' + badFamilyCounts.slice(0, 8).join(', '));
}

/* ACC floors retired — Precision is action-owned (v0.5+). */
const classMinAcc = Object.create(null);
for (const ck of Object.keys(classes || {})) {
  classMinAcc[ck] = Number(classes[ck].minAcc) || 0;
}
let accFloorFails = 0;
for (const bk of birdIds) {
  const b = birds[bk];
  if (!passives[bk]) fail('missing passive for ' + bk);
  if (!utilities[bk]) fail('missing utility for ' + bk);
  /* Spot-check v0.9 Base Health + Vitality → Max HP. */
  if (bk === 'sparrow') {
    if (Number(b.baseHealth) !== 10) fail('sparrow baseHealth expected 10, got ' + b.baseHealth);
    if (Number(b.vitality) !== 3) fail('sparrow vitality expected 3, got ' + b.vitality);
    if (Number(b.stats && b.stats.dex) !== 9) fail('sparrow dexterity expected 9');
    if (Number(b.stats && b.stats.maxHp) !== 12) {
      fail('sparrow maxHp expected 12 (10×(1+3×0.05)), got ' + (b.stats && b.stats.maxHp));
    }
  }
}
if (accFloorFails) fail(accFloorFails + ' ACC floor fails');
if (!birds.dukeBlakiston || !birds.dukeBlakiston.bossOverride) {
  fail('Duke Blakiston must be present with bossOverride=true');
}

/* Core item stats use flat-only *Flat keys in v0.9 (no core *Pct). */
let bareCoreHits = 0;
let corePctHits = 0;
let flatHits = 0;
for (const id of itemIds.slice(0, 50)) {
  const st = items[id].stats || {};
  if (st.atk != null || st.hp != null || st.def != null) bareCoreHits++;
  if (st.atkPct != null || st.hpPct != null || st.dexPct != null || st.spdPct != null) corePctHits++;
  if (st.atkFlat != null || st.dexFlat != null || st.hpFlat != null || st.spdFlat != null
    || st.defFlat != null || st.matkFlat != null || st.mdefFlat != null) flatHits++;
}
if (bareCoreHits) fail(bareCoreHits + ' sample items still use bare core stats (expected *Flat)');
if (corePctHits) fail(corePctHits + ' sample items still have core *Pct rolls');
if (!flatHits) fail('expected flat *Flat core stats on sample items');
const sample = items['EQ-TB-GRY'];
if (!sample || sample.stats.dexFlat == null) {
  fail('EQ-TB-GRY missing dexFlat');
}
if (sample.minDamage == null || sample.maxDamage == null) {
  fail('EQ-TB-GRY missing weapon damage range');
}

if (!loadouts || !Array.isArray(loadouts.rows || loadouts) && typeof loadouts !== 'object') {
  fail('reference-loadouts missing');
}

const fixturesPath = path.join(ROOT, 'scripts/fixtures/equipment-damage-fixtures.json');
if (!existsSync(fixturesPath)) fail('missing equipment-damage-fixtures.json');
else {
  const fx = JSON.parse(readFileSync(fixturesPath, 'utf8'));
  if (!fx.fixtures || fx.fixtures.length < 10) fail('damage fixtures too short');
}

/* Rarity budgets present */
for (const r of rarityOrder) {
  if (!slots.rarityBudgets || !slots.rarityBudgets[r]) fail('missing rarity budget for ' + r);
}

if (process.exitCode) {
  console.error('verify-equipment-content: FAILED');
  process.exit(1);
}
console.log('verify-equipment-content: OK');
console.log('  slots=8 skills=' + skillIds.length + ' items=' + itemIds.length +
  ' families=' + familyIds.length + ' birds=' + birdIds.length);
