#!/usr/bin/env node
/*
 * Runtime checks for equipment v0.3 equip/validation/rollup (Phase 3).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;

function fail(msg) {
  console.error('[equipment-equip] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[equipment-equip] ok  ', msg);
}

function loadSandbox(extraFiles) {
  const ctx = {
    globalThis: {},
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    BIRDS: {
      crow: {
        name: 'Crow',
        class: 'knight',
        stats: { hp: 60, maxHp: 60, atk: 12, def: 17, spd: 9, dodge: 4, acc: 84, mdef: 8, matk: 0, critChance: 8 },
      },
      sparrow: {
        name: 'Sparrow',
        class: 'rogue',
        stats: { hp: 20, maxHp: 20, atk: 5, def: 3, spd: 8, acc: 90, dodge: 5, matk: 8, mdef: 5, critChance: 5 },
      },
    },
    STAT_LEDGER_TRACKED_KEYS: ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance', 'armorPen', 'magicPen'],
    G: { ui: { gameMode: 'story' }, endlessMode: false },
    ensureStatLedger(player) {
      if (!player._statLedger) {
        player._statLedger = {
          birdBaseline: {},
          fromLevel: {},
          fromUpgrades: {},
          fromCardTier: {},
          fromEquipment: {},
          fromEquipmentPct: {},
          mechanicalLines: [],
        };
      }
      return player._statLedger;
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const baseFiles = [
    'js/data/combat-config.js',
    'js/data/equipment/slots.js',
    'js/data/equipment/items.js',
    'js/data/equipment/starting-weapons.js',
    'js/data/equipment/reference-loadouts.js',
  ];
  for (const rel of [...baseFiles, ...(extraFiles || [])]) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing file ' + rel);
      continue;
    }
    vm.runInContext(readFileSync(full, 'utf8'), ctx, { filename: rel });
  }
  return ctx;
}

const ctx = loadSandbox(['js/systems/protection-pools.js', 'js/systems/equipment.js']);
ctx.globalThis.Avian = ctx.globalThis.Avian || {};
ctx.globalThis.Avian.flags = { equipmentV2: true };
ctx.Avian = ctx.globalThis.Avian;

const equipment = ctx.Avian.equipment;
const items = ctx.Avian.data.equipment.items;

function freshPlayer(birdKey) {
  const bd = ctx.BIRDS[birdKey];
  return {
    birdKey,
    class: bd.class,
    stats: { ...bd.stats },
    equipment: equipment.createEmptyLoadout(),
    equipmentInventory: [],
    _statLedger: {
      birdBaseline: { ...bd.stats, maxHp: bd.stats.maxHp || bd.stats.hp },
      fromLevel: {},
      fromUpgrades: {},
      fromCardTier: {},
      fromEquipment: {},
      fromEquipmentPct: {},
      mechanicalLines: [],
    },
  };
}

function assertEquip(player, itemId, slotKey, expectOk, label) {
  const r = equipment.canEquip(player, itemId, slotKey);
  if (!!r.ok !== !!expectOk) {
    fail(`${label}: expected ok=${expectOk}, got ok=${r.ok} reason=${r.reason}`);
    return false;
  }
  ok(label);
  return true;
}

// --- slot acceptance matrix ---
const knight = freshPlayer('crow');
equipment.addToInventory(knight, 'HLM-001');
equipment.addToInventory(knight, 'ARM-001');
equipment.addToInventory(knight, 'WPN-061');
equipment.addToInventory(knight, 'SHD-001');
equipment.addToInventory(knight, 'ACC-025');
equipment.addToInventory(knight, 'WPN-007');

assertEquip(knight, 'HLM-001', 'helmet', true, 'helmet accepts Helmet item');
assertEquip(knight, 'ARM-001', 'armour', true, 'armour accepts Armour item');
assertEquip(knight, 'WPN-061', 'mainHand', true, 'mainHand accepts Weapon item');
assertEquip(knight, 'SHD-001', 'offHand', true, 'offHand accepts Shield item');
assertEquip(knight, 'ACC-025', 'necklace', true, 'necklace accepts Necklace item');
assertEquip(knight, 'HLM-001', 'armour', false, 'helmet item rejected in armour slot');
assertEquip(knight, 'ARM-001', 'mainHand', false, 'armour item rejected in mainHand slot');

// --- 1H / 2H hand rules ---
const rogue = freshPlayer('sparrow');
equipment.addToInventory(rogue, 'WPN-001');
equipment.addToInventory(rogue, 'WPN-001');
equipment.addToInventory(rogue, 'WPN-007');

assertEquip(rogue, 'WPN-001', 'offHand', true, 'dagger allowed in offHand');
assertEquip(rogue, 'WPN-007', 'offHand', false, 'one-handed sword rejected in offHand');
if (equipment.slotAcceptsItem('offHand', items['WPN-031'])) ok('wand allowed in offHand');
else fail('wand should be accepted in offHand');
if (!equipment.slotAcceptsItem('mainHand', items['SHD-001'])) ok('shield rejected in mainHand');
else fail('shield should be off-hand only');

const knight2h = freshPlayer('crow');
equipment.addToInventory(knight2h, 'WPN-061');
assertEquip(knight2h, 'WPN-061', 'offHand', false, '2H weapon rejected in offHand');
if (equipment.equip(knight2h, 'WPN-061', 'mainHand')) ok('2H weapon equips in mainHand');
else fail('2H weapon should equip in mainHand');

equipment.addToInventory(rogue, 'WPN-001');
if (equipment.equip(rogue, 'WPN-001', 'offHand')) ok('offHand equip before 2H conflict test');
else fail('offHand equip failed');

const twoHPlayer = freshPlayer('crow');
equipment.addToInventory(twoHPlayer, 'WPN-061');
equipment.addToInventory(twoHPlayer, 'SHD-001');
equipment.equip(twoHPlayer, 'SHD-001', 'offHand');
equipment.equip(twoHPlayer, 'WPN-061', 'mainHand');
if (!twoHPlayer.equipment.offHand) ok('2H in mainHand forces empty offHand');
else fail('offHand should be cleared when equipping 2H mainHand');

// --- duplicate 1H weapons ---
const dual = freshPlayer('sparrow');
equipment.addToInventory(dual, 'WPN-001');
equipment.addToInventory(dual, 'WPN-001');
equipment.equip(dual, 'WPN-001', 'mainHand');
equipment.equip(dual, 'WPN-001', 'offHand');
if (dual.equipment.mainHand === 'WPN-001' && dual.equipment.offHand === 'WPN-001') {
  ok('duplicate daggers allowed in both hands');
} else {
  fail('duplicate 1H dual-wield failed');
}

// --- anklets pair slot (v2.1 collapsed) ---
const ank = freshPlayer('crow');
equipment.addToInventory(ank, 'ACC-001');
equipment.equip(ank, 'ACC-001', 'anklets');
if (ank.equipment.anklets === 'ACC-001' && !ank.equipment.ankletL && !ank.equipment.ankletR) {
  ok('anklets pair slot equips');
} else {
  fail('anklets pair equip failed: ' + JSON.stringify(ank.equipment));
}

// --- second anklet stays in bag when pair slot filled ---
const ankAuto = freshPlayer('crow');
equipment.equip(ankAuto, 'ACC-001', 'anklets');
const autoSlot = equipment.findEmptyEquipSlotForItem(ankAuto, 'ACC-001');
if (autoSlot == null) ok('findEmptyEquipSlotForItem has no second anklet slot');
else fail(`expected no empty anklet slot, got ${autoSlot}`);
const autoEq = equipment.grantEquipment(ankAuto, 'ACC-001');
if (autoEq.ok && !autoEq.autoEquipped && ankAuto.equipment.anklets === 'ACC-001') {
  ok('grantEquipment keeps second anklet in bag when pair filled');
} else {
  fail('second anklet should remain in bag: ' + JSON.stringify(autoEq));
}

// --- 2H main blocks Shields in offHand ---
const shieldPlayer = freshPlayer('crow');
equipment.addToInventory(shieldPlayer, 'WPN-061');
equipment.addToInventory(shieldPlayer, 'SHD-001');
equipment.equip(shieldPlayer, 'WPN-061', 'mainHand');
const shieldCheck = equipment.canEquip(shieldPlayer, 'SHD-001', 'offHand');
if (!shieldCheck.ok && shieldCheck.reason === 'two_handed_main') {
  ok('shield blocked in offHand with 2H weapon');
} else {
  fail('shield should be blocked with 2H mainHand, got ' + JSON.stringify(shieldCheck));
}

// --- 2H main clears offHand weapons and Shields ---
const weaponOff = freshPlayer('crow');
equipment.addToInventory(weaponOff, 'WPN-061');
weaponOff.equipment.offHand = 'WPN-001';
equipment.equip(weaponOff, 'WPN-061', 'mainHand');
if (!weaponOff.equipment.offHand) ok('2H main clears offHand weapon');
else fail('offHand weapon should clear when equipping 2H mainHand');

const clearShield = freshPlayer('crow');
equipment.addToInventory(clearShield, 'SHD-001');
equipment.addToInventory(clearShield, 'WPN-061');
equipment.equip(clearShield, 'SHD-001', 'offHand');
equipment.equip(clearShield, 'WPN-061', 'mainHand');
if (!clearShield.equipment.offHand) ok('2H main clears offHand Shield');
else fail('offHand Shield should clear when equipping 2H mainHand');

const validateShield = freshPlayer('crow');
equipment.addToInventory(validateShield, 'WPN-061');
equipment.addToInventory(validateShield, 'SHD-001');
equipment.equip(validateShield, 'WPN-061', 'mainHand');
validateShield.equipment.offHand = 'SHD-001';
const issues = equipment.validateLoadout(validateShield);
if (!validateShield.equipment.offHand && issues.some((x) => x.action === 'unequip_two_handed_conflict')) {
  ok('validateLoadout unequips Shield with 2H main');
} else {
  fail('validateLoadout should clear Shield with 2H main');
}

// --- class hard restriction ---
const mageWand = 'WPN-031';
const knightForClass = freshPlayer('crow');
equipment.addToInventory(knightForClass, mageWand);
const classCheck = equipment.canEquip(knightForClass, mageWand, 'mainHand');
if (!classCheck.ok && classCheck.reason === 'class_restricted') {
  ok('class hard restriction blocks knight from mage wand');
} else {
  fail(`expected class_restricted for knight + wand, got ${JSON.stringify(classCheck)}`);
}

// --- dual-wield stacks Dexterity flat for two legal daggers ---
const atkPlayer = freshPlayer('sparrow');
equipment.addToInventory(atkPlayer, 'WPN-001');
equipment.addToInventory(atkPlayer, 'WPN-001');
equipment.equip(atkPlayer, 'WPN-001', 'mainHand');
equipment.equip(atkPlayer, 'WPN-001', 'offHand');
equipment.reapplyPlayerStatsFromSources(atkPlayer);
const roll = equipment.rollupEquipmentStats(atkPlayer);
const dexFlat = Number(roll.stats && roll.stats.dex) || 0;
const expectedFlat = (Number(items['WPN-001'].stats.dexFlat) || 0) * 2;
if (Math.abs(dexFlat - expectedFlat) < 1e-6 && expectedFlat > 0) {
  ok(`dual-wield stacks Dexterity flat (${dexFlat} from two daggers)`);
} else {
  fail(`expected equipment dex flat ${expectedFlat}, got flat=${dexFlat}`);
}

// --- unequip returns to inventory ---
const unequipPlayer = freshPlayer('crow');
equipment.addToInventory(unequipPlayer, 'HLM-001');
equipment.equip(unequipPlayer, 'HLM-001', 'helmet');
const invBefore = unequipPlayer.equipmentInventory.length;
equipment.unequip(unequipPlayer, 'helmet');
if (!unequipPlayer.equipment.helmet && unequipPlayer.equipmentInventory.length === invBefore + 1) {
  ok('unequip returns item to inventory');
} else {
  fail('unequip did not return item to inventory');
}

// --- Armour / Magic Armour pools from equipment (Nest + combat bars) ---
{
  const armPlayer = freshPlayer('crow');
  equipment.addToInventory(armPlayer, 'ARM-001');
  equipment.addToInventory(armPlayer, 'HLM-001');
  equipment.equip(armPlayer, 'ARM-001', 'armour');
  equipment.equip(armPlayer, 'HLM-001', 'helmet');
  equipment.reapplyPlayerStatsFromSources(armPlayer);
  const rollArm = equipment.rollupEquipmentStats(armPlayer);
  const expectArm = Math.max(0, Math.floor(Number(rollArm.stats?.armour) || 0));
  const expectMarm = Math.max(0, Math.floor(Number(rollArm.stats?.magicArmour) || 0));
  const gotArm = Number(armPlayer.stats.maxArmour) || 0;
  const gotMarm = Number(armPlayer.stats.maxMagicArmour) || 0;
  const curArm = Number(armPlayer.stats.armour) || 0;
  const curMarm = Number(armPlayer.stats.magicArmour) || 0;
  if (expectArm > 0 && gotArm === expectArm && curArm === expectArm) {
    ok(`equipment ARM pools fill Nest/combat (${curArm}/${gotArm} from ARM+HLM)`);
  } else {
    fail(`expected Armour ${expectArm}/${expectArm}, got ${curArm}/${gotArm}`);
  }
  if (gotMarm === expectMarm && curMarm === expectMarm) {
    ok(`equipment MARM pools fill Nest/combat (${curMarm}/${gotMarm})`);
  } else {
    fail(`expected Magic Armour ${expectMarm}/${expectMarm}, got ${curMarm}/${gotMarm}`);
  }
  const armFlat = Number(items['ARM-001']?.stats?.armourFlat) || 0;
  const hlmFlat = Number(items['HLM-001']?.stats?.armourFlat) || 0;
  if (expectArm === armFlat + hlmFlat && expectArm > 0) {
    ok(`Armour sums across equipment sources (${armFlat}+${hlmFlat}=${expectArm})`);
  } else {
    fail(`Armour rollup ${expectArm} != ARM ${armFlat} + HLM ${hlmFlat}`);
  }
}

// --- grantEquipment auto-wears empty slots, bags when full ---
{
  const grantEmpty = freshPlayer('crow');
  const gHelm = equipment.grantEquipment(grantEmpty, 'HLM-001');
  if (gHelm.ok && gHelm.autoEquipped && grantEmpty.equipment.helmet === 'HLM-001' && !grantEmpty.equipmentInventory.includes('HLM-001')) {
    ok('grantEquipment auto-equips empty helmet');
  } else {
    fail(`grantEquipment should auto-equip empty helmet, got ${JSON.stringify(gHelm)} helm=${grantEmpty.equipment.helmet}`);
  }
  const gHelm2 = equipment.grantEquipment(grantEmpty, 'HLM-001');
  if (gHelm2.ok && !gHelm2.autoEquipped && grantEmpty.equipment.helmet === 'HLM-001' && grantEmpty.equipmentInventory[0] === 'HLM-001') {
    ok('grantEquipment bags a second helmet when slot is full');
  } else {
    fail(`full helmet should stay in bag, got auto=${gHelm2.autoEquipped} inv=${JSON.stringify(grantEmpty.equipmentInventory)}`);
  }
}

{
  const grantOff = freshPlayer('sparrow');
  equipment.ensurePlayerEquipmentState(grantOff);
  const starter = grantOff.equipment.mainHand;
  const gWpn = equipment.grantEquipment(grantOff, 'WPN-001');
  if (gWpn.ok && gWpn.autoEquipped && gWpn.slot === 'offHand' && grantOff.equipment.offHand === 'WPN-001' && grantOff.equipment.mainHand === starter) {
    ok('grantEquipment auto-equips 1H dagger to empty offHand');
  } else {
    fail(`expected offHand auto-equip, got ${JSON.stringify(gWpn)} off=${grantOff.equipment.offHand}`);
  }
}

{
  const grant2h = freshPlayer('crow');
  equipment.ensurePlayerEquipmentState(grant2h);
  const g2h = equipment.grantEquipment(grant2h, 'WPN-061');
  if (g2h.ok && !g2h.autoEquipped && grant2h.equipmentInventory[0] === 'WPN-061' && grant2h.equipment.mainHand && grant2h.equipment.mainHand !== 'WPN-061') {
    ok('grantEquipment leaves 2H in bag when mainHand is already filled');
  } else {
    fail(`2H should stay in bag when mainHand full, got ${JSON.stringify(g2h)} main=${grant2h.equipment.mainHand}`);
  }
}

{
  const grantAnk = freshPlayer('crow');
  const a1 = equipment.grantEquipment(grantAnk, 'ACC-001');
  const a2 = equipment.grantEquipment(grantAnk, 'ACC-001');
  if (a1.autoEquipped && !a2.autoEquipped && grantAnk.equipment.anklets === 'ACC-001') {
    ok('grantEquipment fills anklets pair once');
  } else {
    fail(`anklets pair once: a1=${JSON.stringify(a1)} a2=${JSON.stringify(a2)} eq=${grantAnk.equipment.anklets}`);
  }
}

{
  const grantClass = freshPlayer('crow');
  const gWand = equipment.grantEquipment(grantClass, 'WPN-031');
  if (gWand.ok && !gWand.autoEquipped && grantClass.equipmentInventory.includes('WPN-031')) {
    ok('grantEquipment does not auto-equip class-restricted gear');
  } else {
    fail(`mage wand should stay in knight bag, got ${JSON.stringify(gWand)}`);
  }
}

{
  const orderP = freshPlayer('crow');
  equipment.addToInventory(orderP, 'HLM-001');
  equipment.addToInventory(orderP, 'ARM-001');
  if (orderP.equipmentInventory[0] === 'ARM-001' && orderP.equipmentInventory[1] === 'HLM-001') {
    ok('addToInventory prepends so newest bag item is first');
  } else {
    fail(`expected [ARM-001, HLM-001], got ${JSON.stringify(orderP.equipmentInventory)}`);
  }
}

{
  const noRe = freshPlayer('crow');
  equipment.grantEquipment(noRe, 'HLM-001');
  equipment.unequip(noRe, 'helmet');
  if (!noRe.equipment.helmet && noRe.equipmentInventory[0] === 'HLM-001') {
    ok('unequip returns to front of bag without auto-re-equipping');
  } else {
    fail(`unequip should not auto-re-equip, helm=${noRe.equipment.helmet} inv=${JSON.stringify(noRe.equipmentInventory)}`);
  }
}

if (failed) {
  console.error(`\n[equipment-equip] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-equip] all checks passed');
