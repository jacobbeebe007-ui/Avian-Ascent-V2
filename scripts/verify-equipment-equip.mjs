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

const ctx = loadSandbox(['js/systems/equipment.js']);
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
equipment.addToInventory(knight, 'EQ-HP-GRY');
equipment.addToInventory(knight, 'EQ-AM-GRY');
equipment.addToInventory(knight, 'EQ-LN-GRY');
equipment.addToInventory(knight, 'EQ-SM-GRY');
equipment.addToInventory(knight, 'EQ-NH-GRY');
equipment.addToInventory(knight, 'EQ-TB-GRY');

assertEquip(knight, 'EQ-HP-GRY', 'helmet', true, 'helmet accepts Helmet item');
assertEquip(knight, 'EQ-AM-GRY', 'armour', true, 'armour accepts Armour item');
assertEquip(knight, 'EQ-LN-GRY', 'mainHand', true, 'mainHand accepts Weapon item');
assertEquip(knight, 'EQ-SM-GRY', 'shield', true, 'shield accepts Shield item');
assertEquip(knight, 'EQ-NH-GRY', 'necklace', true, 'necklace accepts Necklace item');
assertEquip(knight, 'EQ-HP-GRY', 'armour', false, 'helmet item rejected in armour slot');
assertEquip(knight, 'EQ-AM-GRY', 'mainHand', false, 'armour item rejected in mainHand slot');

// --- 1H / 2H hand rules ---
const rogue = freshPlayer('sparrow');
equipment.addToInventory(rogue, 'EQ-TB-GRY');
equipment.addToInventory(rogue, 'EQ-TB-GRY');

assertEquip(rogue, 'EQ-TB-GRY', 'offHand', true, '1H weapon allowed in offHand');

const knight2h = freshPlayer('crow');
equipment.addToInventory(knight2h, 'EQ-LN-GRY');
assertEquip(knight2h, 'EQ-LN-GRY', 'offHand', false, '2H weapon rejected in offHand');
if (equipment.equip(knight2h, 'EQ-LN-GRY', 'mainHand')) ok('2H weapon equips in mainHand');
else fail('2H weapon should equip in mainHand');

equipment.addToInventory(rogue, 'EQ-TB-GRY');
if (equipment.equip(rogue, 'EQ-TB-GRY', 'offHand')) ok('offHand equip before 2H conflict test');
else fail('offHand equip failed');

const twoHPlayer = freshPlayer('crow');
equipment.addToInventory(twoHPlayer, 'EQ-LN-GRY');
equipment.addToInventory(twoHPlayer, 'EQ-TB-GRY');
equipment.equip(twoHPlayer, 'EQ-TB-GRY', 'offHand');
equipment.equip(twoHPlayer, 'EQ-LN-GRY', 'mainHand');
if (!twoHPlayer.equipment.offHand) ok('2H in mainHand forces empty offHand');
else fail('offHand should be cleared when equipping 2H mainHand');

// --- duplicate 1H weapons ---
const dual = freshPlayer('sparrow');
equipment.addToInventory(dual, 'EQ-TB-GRY');
equipment.addToInventory(dual, 'EQ-TB-GRY');
equipment.equip(dual, 'EQ-TB-GRY', 'mainHand');
equipment.equip(dual, 'EQ-TB-GRY', 'offHand');
if (dual.equipment.mainHand === 'EQ-TB-GRY' && dual.equipment.offHand === 'EQ-TB-GRY') {
  ok('duplicate 1H weapons allowed in both hands');
} else {
  fail('duplicate 1H dual-wield failed');
}

// --- duplicate anklets ---
const ank = freshPlayer('crow');
equipment.addToInventory(ank, 'EQ-AI-GRY');
equipment.addToInventory(ank, 'EQ-AI-GRY');
equipment.equip(ank, 'EQ-AI-GRY', 'ankletL');
equipment.equip(ank, 'EQ-AI-GRY', 'ankletR');
if (ank.equipment.ankletL === 'EQ-AI-GRY' && ank.equipment.ankletR === 'EQ-AI-GRY') {
  ok('duplicate anklets allowed');
} else {
  fail('duplicate anklet equip failed');
}

// --- shield independent of hands ---
const shieldPlayer = freshPlayer('crow');
equipment.addToInventory(shieldPlayer, 'EQ-LN-GRY');
equipment.addToInventory(shieldPlayer, 'EQ-SM-GRY');
equipment.equip(shieldPlayer, 'EQ-LN-GRY', 'mainHand');
const shieldCheck = equipment.canEquip(shieldPlayer, 'EQ-SM-GRY', 'shield');
if (shieldCheck.ok) ok('shield independent of 2H weapon hands');
else fail('shield should equip alongside 2H mainHand');

// --- class hard restriction ---
const mageWand = 'EQ-WD-GRY';
const knightForClass = freshPlayer('crow');
equipment.addToInventory(knightForClass, mageWand);
const classCheck = equipment.canEquip(knightForClass, mageWand, 'mainHand');
if (!classCheck.ok && classCheck.reason === 'class_restricted') {
  ok('class hard restriction blocks knight from mage wand');
} else {
  fail(`expected class_restricted for knight + wand, got ${JSON.stringify(classCheck)}`);
}

// --- dual-wield double-counts ATK ---
const atkPlayer = freshPlayer('sparrow');
equipment.addToInventory(atkPlayer, 'EQ-TB-GRY');
equipment.addToInventory(atkPlayer, 'EQ-TB-GRY');
equipment.equip(atkPlayer, 'EQ-TB-GRY', 'mainHand');
equipment.equip(atkPlayer, 'EQ-TB-GRY', 'offHand');
equipment.reapplyPlayerStatsFromSources(atkPlayer);
const roll = equipment.rollupEquipmentStats(atkPlayer);
if ((roll.stats.atk || 0) === 6) ok('dual-wield double-counts ATK (+6 from two blades)');
else fail(`expected equipment atk rollup 6, got ${roll.stats.atk}`);

// --- unequip returns to inventory ---
const unequipPlayer = freshPlayer('crow');
equipment.addToInventory(unequipPlayer, 'EQ-HP-GRY');
equipment.equip(unequipPlayer, 'EQ-HP-GRY', 'helmet');
const invBefore = unequipPlayer.equipmentInventory.length;
equipment.unequip(unequipPlayer, 'helmet');
if (!unequipPlayer.equipment.helmet && unequipPlayer.equipmentInventory.length === invBefore + 1) {
  ok('unequip returns item to inventory');
} else {
  fail('unequip did not return item to inventory');
}

// --- Crow grey reference loadout totals ---
const crowPlayer = freshPlayer('crow');
crowPlayer._statLedger.birdBaseline = {
  maxHp: 60, atk: 12, def: 17, spd: 9, acc: 84, dodge: 4, matk: 0, mdef: 8, critChance: 8,
};
if (equipment.seedGreyReferenceLoadout(crowPlayer)) ok('seeded knight grey reference loadout');
else fail('seedGreyReferenceLoadout failed for crow/knight');

equipment.reapplyPlayerStatsFromSources(crowPlayer);
const ledger = crowPlayer._statLedger.fromEquipment || {};
const ref = ctx.Avian.data.equipment.referenceLoadouts.find(
  (r) => r.class === 'knight' && r.rarity === 'grey',
);
const totals = ref && ref.totals ? ref.totals : {};

function near(a, b, tol, label) {
  const da = Number(a) || 0;
  const db = Number(b) || 0;
  if (Math.abs(da - db) <= tol) {
    ok(`${label}: ${da} ≈ ${db}`);
    return true;
  }
  fail(`${label}: expected ~${db}, got ${da}`);
  return false;
}

near(ledger.maxHp, totals.hp, 0.01, 'reference loadout HP rollup');
near(ledger.atk, totals.atk, 0.01, 'reference loadout ATK rollup');
near(ledger.def, totals.def, 0.01, 'reference loadout DEF rollup');

if (failed) {
  console.error(`\n[equipment-equip] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-equip] all checks passed');
