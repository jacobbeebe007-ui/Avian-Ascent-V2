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
  'js/data/equipment/starting-weapons.js',
  'js/data/equipment/core-rules.js',
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

// unarmed rogue → Beak Jab / BASIC_PHYSICAL (fallback only)
assertBasic(player(), 'BASIC_PHYSICAL', 'Beak Jab');

// unarmed mage → Tail Wand / BASIC_MAGIC (fallback only)
assertBasic({
  birdKey: 'barnOwl',
  class: 'mage',
  equipment: equipment.createEmptyLoadout(),
}, 'BASIC_MAGIC', 'Tail Wand');

// class Basic starting weapons grant only Basic Attack (no weapon skills)
assertBasic(player({ mainHand: 'WPN-B04' }), 'BASIC_PHYSICAL', 'Talon Scratch');
assertWeapon(player({ mainHand: 'WPN-B04' }), 'weaponA', null);
assertWeapon(player({ mainHand: 'WPN-B04' }), 'weaponB', null);
assertBasic(player({ mainHand: 'WPN-B02' }), 'BASIC_PHYSICAL', 'Beak Stab');
assertBasic({
  birdKey: 'barnOwl',
  class: 'mage',
  equipment: Object.assign(equipment.createEmptyLoadout(), { mainHand: 'WPN-B01' }),
}, 'BASIC_MAGIC', 'Tail Wand');

// ensureStartingWeapon grants class starter when mainHand empty
{
  const p = player();
  equipment.ensurePlayerEquipmentState(p);
  if (p.equipment.mainHand !== 'WPN-B04') fail(`starter grant expected WPN-B04, got ${p.equipment.mainHand}`);
  else ok('ensureStartingWeapon grants Talon Scratch to rogue');
}

// Enemy with only enemyClass (no player.class) still gets class starter + named basic
{
  const enemy = {
    isEnemy: true,
    enemyClass: 'mage',
    equipment: equipment.createEmptyLoadout(),
  };
  equipment.ensureStartingWeapon(enemy);
  if (enemy.equipment.mainHand !== 'WPN-B01') fail(`enemy mage starter expected WPN-B01, got ${enemy.equipment.mainHand}`);
  else ok('ensureStartingWeapon grants Tail Wand to enemy mage via enemyClass');
  assertBasic(enemy, 'BASIC_MAGIC', 'Tail Wand');
}

// wand main → BASIC_MAGIC (equipped Basic Attack name for non-basic weapons)
assertBasic(player({ mainHand: 'WPN-031' }), 'BASIC_MAGIC', 'Basic Attack');

// matching Talon Blades → WSK-004 in weaponB
assertWeapon(player({ mainHand: 'WPN-007', offHand: 'WPN-007' }), 'weaponA', 'WSK-003');
assertWeapon(player({ mainHand: 'WPN-007', offHand: 'WPN-007' }), 'weaponB', 'WSK-004');

// mixed 1H → off-hand primary in weaponB
assertWeapon(player({ mainHand: 'WPN-007', offHand: 'WPN-031' }), 'weaponA', 'WSK-003');
assertWeapon(player({ mainHand: 'WPN-007', offHand: 'WPN-031' }), 'weaponB', 'WSK-011');

// 2H → skill1 + skill2, offHand ignored
assertWeapon(player({ mainHand: 'WPN-061', offHand: 'WPN-007' }), 'weaponA', 'WSK-021');
assertWeapon(player({ mainHand: 'WPN-061', offHand: 'WPN-007' }), 'weaponB', 'WSK-022');

// armour technique
assertArmour(player({ armour: 'ARM-002' }), 'ESK-001');
assertArmour(player(), null);
/* Grey armour has no skill1 — fall back to shield, then helmet. */
assertArmour(player({ armour: 'ARM-001', offHand: 'SHD-002' }), 'ESK-005');
assertArmour(player({ armour: 'ARM-001', helmet: 'HLM-002' }), 'ESK-003');
assertArmour(player({ armour: 'ARM-002', offHand: 'SHD-002' }), 'ESK-001'); // armour wins

const restoreRow = actions.skillToAbilityRow('ESK-001', null, 'green');
if (!restoreRow || !(restoreRow.riders || []).some((r) => r.kind === 'restoreArmour' && r.value === 4)) {
  fail('ESK-001 must carry restoreArmour:4 rider');
} else ok('ESK-001 restoreArmour rider');

const lowerRow = actions.skillToAbilityRow('ESK-015', null, 'green');
if (!lowerRow || !(lowerRow.riders || []).some((r) => r.kind === 'restoreLowerPool')) {
  fail('ESK-015 must carry restoreLowerPool rider');
} else ok('ESK-015 restoreLowerPool rider');

const bastionRow = actions.skillToAbilityRow('ESK-014', null, 'purple');
if (!bastionRow || !(bastionRow.riders || []).some((r) => r.kind === 'bastion' && r.armour === 5 && r.magicArmour === 5)) {
  fail('ESK-014 must carry bastion 5/5 rider');
} else ok('ESK-014 bastion rider');

// ultimate requires qualifying Gold/Orange item
assertUltimate(player({ mainHand: 'WPN-007' }), false);
assertUltimate(player({ mainHand: 'WPN-011' }), false); // v1.2 weapons have no ultimates

const arr = actions.buildAbilitiesArray(player({ mainHand: 'WPN-011' }));
if (Array.isArray(arr) && arr.length === 6) ok('buildAbilitiesArray length 6');
else fail(`buildAbilitiesArray length expected 6, got ${arr && arr.length}`);

if (failed) {
  console.error(`\n[action-sources] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[action-sources] all checks passed');
