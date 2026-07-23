#!/usr/bin/env node
/*
 * Equipment v0.3 loot verification (Phase 7).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;

function fail(msg) {
  console.error('[equipment-loot] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[equipment-loot] ok  ', msg);
}

function loadSandbox(extraFiles, flagOn = true) {
  const ctx = {
    globalThis: {},
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    Set,
    BIRDS: {
      crow: { name: 'Crow', class: 'knight', stats: { hp: 60, maxHp: 60, atk: 12, def: 17, spd: 9 } },
      sparrow: { name: 'Sparrow', class: 'rogue', stats: { hp: 20, maxHp: 20, atk: 5, def: 3, spd: 8 } },
      finch: { name: 'Finch', class: 'mage', stats: { hp: 40, maxHp: 40, atk: 4, def: 5, spd: 10, matk: 18 } },
    },
    G: {
      player: null,
      shinyObjects: 100,
      stage: 10,
      runOrangeEquipmentIds: new Set(),
      runOrangeEquipmentFamilies: new Set(),
    },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const baseFiles = [
    'js/data/combat-config.js',
    'js/data/equipment/slots.js',
    'js/data/equipment/items.js',
    'js/data/equipment/families.js',
    'js/data/equipment/loot-tables.js',
    'js/systems/equipment.js',
    'js/systems/equipment-loot.js',
  ];
  for (const rel of [...baseFiles, ...(extraFiles || [])]) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing file ' + rel);
      continue;
    }
    vm.runInContext(readFileSync(full, 'utf8'), ctx, { filename: rel });
  }
  ctx.globalThis.Avian = ctx.globalThis.Avian || {};
  ctx.globalThis.Avian.flags = { equipmentV2: !!flagOn };
  ctx.Avian = ctx.globalThis.Avian;
  return ctx;
}

function sumWeights(weights) {
  let total = 0;
  for (const k in weights) {
    if (Object.prototype.hasOwnProperty.call(weights, k)) total += Number(weights[k]) || 0;
  }
  return total;
}

function freshPlayer(birdKey, ctxRef) {
  const bd = ctxRef.BIRDS[birdKey];
  return {
    birdKey,
    class: bd.class,
    stats: { ...bd.stats },
    equipment: ctxRef.Avian.equipment.createEmptyLoadout(),
    equipmentInventory: [],
  };
}

const ctx = loadSandbox();
const loot = ctx.Avian.equipmentLoot;
const equipment = ctx.Avian.equipment;

// --- rarity weight tables sum ≈ 1.0 per band ---
const bandWeights = ctx.Avian.data.equipment.loot.rarityWeightsByBand;
for (const bandId of Object.keys(bandWeights)) {
  const total = sumWeights(bandWeights[bandId]);
  if (Math.abs(total - 1) > 0.001) fail(`band ${bandId} weights sum ${total}, expected ~1.0`);
  else ok(`band ${bandId} weights sum ${total.toFixed(3)}`);
}

for (const row of ctx.Avian.data.equipment.loot.rarityWeightsByStage) {
  const total = sumWeights(row.weights);
  if (Math.abs(total - 1) > 0.001) fail(`stage row maxStage=${row.maxStage} weights sum ${total}`);
  else ok(`stage maxStage=${row.maxStage} weights sum ${total.toFixed(3)}`);
}

// --- class-filtered stock never returns wrong hard-restricted class item ---
ctx.G.player = freshPlayer('finch', ctx);
let classViolations = 0;
for (let i = 0; i < 200; i++) {
  const id = loot.rollEquipmentDrop({ classId: 'mage', stage: 12, filterForPlayer: true, rng: Math.random });
  if (!id) continue;
  const item = equipment.getItem(id);
  if (!item) continue;
  if (!loot.itemHardAllowedForClass(item, 'mage')) classViolations++;
}
if (classViolations) fail(`${classViolations} class-restricted items rolled for mage`);
else ok('class-filtered drops respect hard class restrictions (200 rolls)');

// --- orange uniqueness perRun blocks second copy ---
ctx.G.runOrangeEquipmentIds = new Set();
ctx.G.runOrangeEquipmentFamilies = new Set();
const orangeItems = Object.values(ctx.Avian.data.equipment.items).filter((it) => it.rarity === 'orange');
if (!orangeItems.length) fail('no orange items in catalog');
else {
  orangeItems.forEach((item) => {
    ctx.G.runOrangeEquipmentIds.add(item.id);
    if (item.family) ctx.G.runOrangeEquipmentFamilies.add(item.family);
  });
  let blocked = 0;
  for (let i = 0; i < 100; i++) {
    const id = loot.rollEquipmentDrop({ rarity: 'orange', filterForPlayer: false, rng: Math.random });
    if (!id) blocked++;
    else fail(`perRun allowed orange ${id} when catalog exhausted`);
  }
  if (blocked !== 100) fail(`perRun orange block incomplete (${blocked}/100 null rolls)`);
  else ok('perRun orange uniqueness blocks all orange when run catalog full');

  ctx.G.runOrangeEquipmentIds = new Set();
  ctx.G.runOrangeEquipmentFamilies = new Set();
  const sample = orangeItems[0];
  ctx.G.runOrangeEquipmentIds.add(sample.id);
  if (sample.family) ctx.G.runOrangeEquipmentFamilies.add(sample.family);
  let dupes = 0;
  for (let i = 0; i < 80; i++) {
    const id = loot.rollEquipmentDrop({ rarity: 'orange', filterForPlayer: false, rng: Math.random });
    if (!id) continue;
    const got = equipment.getItem(id);
    if (id === sample.id || (got && got.family === sample.family)) dupes++;
  }
  if (dupes) fail(`perRun allowed ${dupes} duplicate orange family/id rolls`);
  else ok('perRun blocks second copy of same orange family/id');
}

// --- buy/sell round-trip inventory count ---
ctx.G.player = freshPlayer('sparrow', ctx);
ctx.G.shinyObjects = 500;
const before = ctx.G.player.equipmentInventory.length;
const stock = loot.rollEquipmentStock(1, 8, new Set(), { filterForPlayer: true });
if (!stock.length) fail('rollEquipmentStock returned empty');
else {
  const offer = stock[0];
  const buyCost = offer.costOverride;
  ctx.G.shinyObjects -= buyCost;
  equipment.addToInventory(ctx.G.player, offer.equipmentItemId || offer.id);
  loot.registerOrangeAcquired(equipment.getItem(offer.equipmentItemId || offer.id));
  const afterBuy = ctx.G.player.equipmentInventory.length;
  if (afterBuy !== before + 1) fail(`buy did not add inventory (${before} -> ${afterBuy})`);
  else ok('buy adds one equipment item to inventory');

  const sellIdx = afterBuy - 1;
  const sellId = ctx.G.player.equipmentInventory[sellIdx];
  const sellItem = equipment.getItem(sellId);
  const sellPrice = loot.getSellPrice(sellItem.rarity);
  ctx.G.player.equipmentInventory.splice(sellIdx, 1);
  ctx.G.shinyObjects += sellPrice;
  if (ctx.G.player.equipmentInventory.length !== before) {
    fail(`sell did not restore inventory count (${ctx.G.player.equipmentInventory.length} vs ${before})`);
  } else ok('sell restores inventory count after round-trip');
}

if (failed) {
  console.error(`\n[equipment-loot] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[equipment-loot] all checks passed');
