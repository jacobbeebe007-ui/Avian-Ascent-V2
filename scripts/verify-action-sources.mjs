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

function riderKinds(entity) {
  const util = actions.resolveInnateUtility(entity);
  const riders = (util && util._dispatcherRow && util._dispatcherRow.riders) || [];
  return riders.map((r) => r && r.kind).filter(Boolean);
}

{
  const sparrow = player();
  sparrow.birdKey = 'sparrow';
  const kinds = riderKinds(sparrow);
  if (kinds.includes('gainSpeed')) ok('sparrow Hedge Hop grants Agility Up');
  else fail('sparrow Hedge Hop missing gainSpeed, got ' + kinds.join(','));
}

{
  const owl = {
    birdKey: 'snowyOwl',
    class: 'mage',
    equipment: equipment.createEmptyLoadout(),
  };
  const kinds = riderKinds(owl);
  if (kinds.includes('magicArmourDamage') && kinds.includes('applyAilment')) {
    ok('snowy owl Frost Glide deals Magic Armour then Chilled');
  } else fail('snowy owl missing pool damage / chilled, got ' + kinds.join(','));
}

{
  const crow = {
    birdKey: 'crow',
    class: 'knight',
    equipment: equipment.createEmptyLoadout(),
  };
  const kinds = riderKinds(crow);
  if (kinds.includes('restoreArmour')) ok('crow Battle Focus restores Armour');
  else fail('crow missing restoreArmour, got ' + kinds.join(','));
}

{
  const penguin = {
    birdKey: 'penguin',
    class: 'knight',
    equipment: equipment.createEmptyLoadout(),
  };
  const kinds = riderKinds(penguin);
  if (kinds.includes('ward') && kinds.includes('magicArmourRetaliateOnPhysical') && !kinds.includes('magicArmourDamage')) {
    ok('penguin Snow Wall wards and retaliates instead of instant Magic Armour damage');
  } else fail('penguin Snow Wall riders wrong: ' + kinds.join(','));
}

{
  const magpie = {
    birdKey: 'magpie',
    class: 'rogue',
    equipment: equipment.createEmptyLoadout(),
  };
  const kinds = riderKinds(magpie);
  if (kinds.includes('armourDamage') && kinds.includes('reduceEnemyAccFlat')) {
    ok('magpie Feather Feint pokes Armour then Precision Down');
  } else fail('magpie missing armour poke / precision, got ' + kinds.join(','));
}

{
  const harpy = {
    birdKey: 'harpy',
    class: 'inquisitor',
    equipment: equipment.createEmptyLoadout(),
  };
  const util = actions.resolveInnateUtility(harpy);
  const riders = (util && util._dispatcherRow && util._dispatcherRow.riders) || [];
  const mark = riders.find((r) => r && r.kind === 'applyMark' && r.mark === 'predator');
  if (mark) ok('harpy Predator Grip applies Predator Mark');
  else fail('harpy missing Predator Mark, kinds=' + riders.map((r) => r && r.kind).join(','));
}

function ridersFor(birdKey, cls) {
  const entity = {
    birdKey,
    class: cls || 'rogue',
    equipment: equipment.createEmptyLoadout(),
  };
  const util = actions.resolveInnateUtility(entity);
  return (util && util._dispatcherRow && util._dispatcherRow.riders) || [];
}

{
  const kinds = ridersFor('toucan', 'bard').map((r) => r.kind);
  if (kinds.includes('nextSkillAspect') && kinds.includes('gainAccNextHit')) {
    ok('toucan Colour Display arms Day aspect + next-skill Precision');
  } else fail('toucan riders wrong: ' + kinds.join(','));
}

{
  const kinds = ridersFor('kiwi', 'inquisitor').map((r) => r.kind);
  if (kinds.includes('gainAccNextHit') && kinds.includes('ignoreMatchingDefNextHit')) {
    ok('kiwi Scent Hunt arms Precision and matching-defence ignore');
  } else fail('kiwi riders wrong: ' + kinds.join(','));
}

{
  const kinds = ridersFor('goldeneagle', 'rogue').map((r) => r.kind);
  if (kinds.includes('gainCritNextHit')) ok('golden eagle Hunter\'s Majesty arms next-skill Critical');
  else fail('golden eagle riders wrong: ' + kinds.join(','));
}

{
  const kinds = ridersFor('cassowary', 'brute').map((r) => r.kind);
  if (kinds.includes('armourDamage') && kinds.includes('nextAttackAccPenalty') && kinds.includes('reduceEnemyDef')) {
    ok('cassowary War Stomp pokes Armour, Guard Down on Health, self Precision penalty');
  } else fail('cassowary riders wrong: ' + kinds.join(','));
}

{
  const riders = ridersFor('barnowl', 'mage');
  const kinds = riders.map((r) => r.kind);
  const next = riders.find((r) => r.kind === 'gainAccNextHit');
  if (kinds.includes('gainSpeed') && next && next.gate === 'night' && !kinds.includes('gainAcc')) {
    ok('barn owl Agility now + Night-gated next Precision');
  } else fail('barn owl riders wrong: ' + kinds.join(',') + ' next=' + JSON.stringify(next));
}

{
  const riders = ridersFor('ostrich', 'brute');
  const next = riders.find((r) => r.kind === 'gainAccNextHit');
  if (riders.some((r) => r.kind === 'gainSpeed') && next && next.gate === 'strengthWeapon') {
    ok('ostrich next Strength weapon skill Precision is gated');
  } else fail('ostrich riders wrong: ' + riders.map((r) => r.kind).join(',') + ' next=' + JSON.stringify(next));
}

{
  const kinds = ridersFor('secretary', 'knight').map((r) => r.kind);
  if (kinds.includes('gainSpeed') && kinds.includes('gainAcc') && !kinds.includes('gainAccNextHit')) {
    ok('secretary Precision lasts until next turn (not next-hit)');
  } else fail('secretary riders wrong: ' + kinds.join(','));
}

{
  const riders = ridersFor('dodo', 'knight');
  const down = riders.find((r) => r.kind === 'gainSpeed' && r.value < 0);
  if (riders.some((r) => r.kind === 'fortify') && down) ok('dodo Fortify with self Agility Down');
  else fail('dodo riders wrong: ' + JSON.stringify(riders.map((r) => ({ kind: r.kind, value: r.value }))));
}

{
  const kinds = ridersFor('pigeon', 'bard').map((r) => r.kind);
  if (kinds.includes('restoreArmour') && kinds.includes('restoreMagicArmour')) {
    ok('pigeon restores both protection pools');
  } else fail('pigeon riders wrong: ' + kinds.join(','));
}

{
  const pere = ridersFor('peregrine', 'rogue');
  const kinds = pere.map((r) => r.kind);
  if (kinds.includes('gainAccNextHit') && kinds.includes('cannotRedirectNextSkill')) {
    ok('peregrine next weapon skill Precision cannot be redirected');
  } else fail('peregrine riders wrong: ' + kinds.join(','));
}

function countKind(riders, kind) {
  return riders.filter((r) => r && r.kind === kind).length;
}

{
  const riders = ridersFor('seagull', 'rogue');
  const speed = riders.filter((r) => r.kind === 'gainSpeed');
  const restore = riders.filter((r) => r.kind === 'restoreLowerPool');
  if (speed.length === 1 && speed[0].when === 'ifCleansed'
    && restore.length === 1 && restore[0].when === 'ifCleansed') {
    ok('seagull cleanse bonuses are ifCleansed-gated (no ungated duplicates)');
  } else fail('seagull riders wrong: ' + JSON.stringify(riders.map((r) => ({ kind: r.kind, when: r.when }))));
}

{
  const riders = ridersFor('blackbird', 'mage');
  const downs = riders.filter((r) => r.kind === 'reduceEnemyMdef');
  if (downs.length === 1 && (downs[0].when === 'ifTargetNoMagicArmour' || downs[0].when === 'targetNoMagicArmour')) {
    ok('blackbird Resolve Down is blocked by Magic Armour');
  } else fail('blackbird riders wrong: ' + JSON.stringify(riders.map((r) => ({ kind: r.kind, when: r.when }))));
}

{
  const riders = ridersFor('goose', 'brute');
  const downs = riders.filter((r) => r.kind === 'reduceEnemyAtk');
  if (riders.some((r) => r.kind === 'magicArmourDamage')
    && downs.length === 1 && downs[0].when === 'reachedHealth') {
    ok('goose Might Down only applies if Magic Armour damage reaches Health');
  } else fail('goose riders wrong: ' + JSON.stringify(riders.map((r) => ({ kind: r.kind, when: r.when }))));
}

{
  const riders = ridersFor('cassowary', 'brute');
  const guardDown = riders.filter((r) => r.kind === 'reduceEnemyDef');
  if (riders.some((r) => r.kind === 'armourDamage')
    && riders.some((r) => r.kind === 'nextAttackAccPenalty')
    && !riders.some((r) => r.kind === 'gainGuarded')
    && guardDown.length === 1 && guardDown[0].when === 'reachedHealth') {
    ok('cassowary War Stomp: Armour poke, Health-gated Guard Down, self Precision penalty (no self Guard)');
  } else fail('cassowary riders wrong: ' + JSON.stringify(riders.map((r) => ({ kind: r.kind, when: r.when }))));
}

{
  const riders = ridersFor('pigeon', 'bard');
  if (countKind(riders, 'restoreArmour') === 1
    && countKind(riders, 'restoreMagicArmour') === 1
    && countKind(riders, 'bastion') === 0) {
    ok('pigeon dual restore does not also apply Bastion');
  } else fail('pigeon dual restore riders wrong: ' + JSON.stringify(riders.map((r) => r.kind)));
}

{
  const riders = ridersFor('bluejay', 'bard');
  if (countKind(riders, 'restoreArmour') >= 1
    && countKind(riders, 'restoreMagicArmour') >= 1
    && countKind(riders, 'bastion') === 0) {
    ok('blue jay dual restore does not also apply Bastion');
  } else fail('blue jay riders wrong: ' + JSON.stringify(riders.map((r) => r.kind)));
}

if (failed) {
  console.error(`\n[action-sources] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[action-sources] all checks passed');
