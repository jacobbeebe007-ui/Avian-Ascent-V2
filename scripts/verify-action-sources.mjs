#!/usr/bin/env node
/*
 * Phase 5 — six action source resolution matrix.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;

function fail(msg) {
  console.error('[action-sources] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[action-sources] ok  ', msg);
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
    BIRDS: {
      sparrow: { name: 'Sparrow', class: 'rogue', birdKey: 'sparrow' },
    },
  });
  ctx.globalThis = ctx;

  const baseFiles = [
    'js/bootstrap/_namespace.js',
    'js/data/combat-config.js',
    'js/data/effect-tiers.js',
    'js/data/equipment/slots.js',
    'js/data/equipment/skills.js',
    'js/data/equipment/items.js',
    'js/data/combat-pack/innate-utilities.js',
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
]);

const actions = ctx.Avian.equipmentActions;
const equipment = ctx.Avian.equipment;

function player(loadout) {
  return {
    birdKey: 'sparrow',
    class: 'rogue',
    equipment: Object.assign(equipment.createEmptyLoadout(), loadout || {}),
  };
}

function assertBasic(entity, expectedId, expectedNameFragment) {
  const basic = actions.resolveBasicAttack(entity);
  if (!basic) {
    fail(`basic attack null (expected ${expectedId})`);
    return;
  }
  if (basic.id !== expectedId) fail(`basic id expected ${expectedId}, got ${basic.id}`);
  else ok(`basic → ${expectedId}`);
  if (expectedNameFragment && !String(basic.name).includes(expectedNameFragment)) {
    fail(`basic name expected to include "${expectedNameFragment}", got ${basic.name}`);
  }
}

function assertWeapon(entity, slot, expectedSkillId) {
  const w = actions.resolveWeaponSkills(entity);
  const ab = w[slot];
  if (!expectedSkillId) {
    if (ab) fail(`${slot} expected empty, got ${ab.id}`);
    else ok(`${slot} empty as expected`);
    return;
  }
  if (!ab || ab.id !== expectedSkillId) {
    fail(`${slot} expected ${expectedSkillId}, got ${ab && ab.id}`);
  } else {
    ok(`${slot} → ${expectedSkillId}`);
  }
}

function assertArmour(entity, expectedSkillId) {
  const ab = actions.resolveArmourTechnique(entity);
  if (!expectedSkillId) {
    if (ab) fail(`armour expected empty, got ${ab.id}`);
    else ok('armour slot empty');
    return;
  }
  if (!ab || ab.id !== expectedSkillId) fail(`armour expected ${expectedSkillId}, got ${ab && ab.id}`);
  else ok(`armour → ${expectedSkillId}`);
}

function assertUltimate(entity, expectPresent) {
  const ab = actions.resolveUltimate(entity);
  if (expectPresent && !ab) fail('ultimate expected but null');
  else if (!expectPresent && ab) fail(`ultimate expected null, got ${ab.id}`);
  else ok(expectPresent ? `ultimate → ${ab.id}` : 'ultimate absent without gold/orange source');
}

// unarmed rogue → Beak Jab / BASIC_PHYSICAL
assertBasic(player(), 'BASIC_PHYSICAL', 'Beak Jab');

// unarmed mage → Tail Wand / BASIC_MAGIC
assertBasic({
  birdKey: 'barnOwl',
  class: 'mage',
  equipment: equipment.createEmptyLoadout(),
}, 'BASIC_MAGIC', 'Tail Wand');

// wand main → BASIC_MAGIC (Tail Wand name for mage; Beak path for rogue with magic weapon uses BASIC_MAGIC id)
assertBasic(player({ mainHand: 'EQ-WD-GRY' }), 'BASIC_MAGIC');

// matching Talon Blades → PAIR_TALON_TWIN in weaponB
assertWeapon(player({ mainHand: 'EQ-TB-GRY', offHand: 'EQ-TB-GRY' }), 'weaponA', 'WPN_TALON_RAKE');
assertWeapon(player({ mainHand: 'EQ-TB-GRY', offHand: 'EQ-TB-GRY' }), 'weaponB', 'PAIR_TALON_TWIN');

// mixed 1H → off-hand primary in weaponB
assertWeapon(player({ mainHand: 'EQ-TB-GRY', offHand: 'EQ-WD-GRY' }), 'weaponA', 'WPN_TALON_RAKE');
assertWeapon(player({ mainHand: 'EQ-TB-GRY', offHand: 'EQ-WD-GRY' }), 'weaponB', 'WPN_WAND_DART');

// 2H → skill1 + skill2, offHand ignored
assertWeapon(player({ mainHand: 'EQ-LN-GRY', offHand: 'EQ-TB-GRY' }), 'weaponA', 'WPN_LANCE_THRUST');
assertWeapon(player({ mainHand: 'EQ-LN-GRY', offHand: 'EQ-TB-GRY' }), 'weaponB', 'WPN_LANCE_CHARGE');

// armour technique
assertArmour(player({ armour: 'EQ-AM-GRY' }), 'ARM_MEDIUM_WINGBRACE');
assertArmour(player(), null);

// ultimate requires qualifying Gold/Orange item
assertUltimate(player({ mainHand: 'EQ-TB-GRY' }), false);
assertUltimate(player({ mainHand: 'EQ-TB-GLD' }), true);

const arr = actions.buildAbilitiesArray(player({ mainHand: 'EQ-TB-GLD' }));
if (Array.isArray(arr) && arr.length === 6) ok('buildAbilitiesArray length 6');
else fail(`buildAbilitiesArray length expected 6, got ${arr && arr.length}`);

if (failed) {
  console.error(`\n[action-sources] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[action-sources] all checks passed');
