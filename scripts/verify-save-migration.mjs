#!/usr/bin/env node
/*
 * Phase 10 — save schema v13 migration + load-time equipment loadout validation.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SAVE_KEY = 'avianAscent_save_v2';
const META_KEY = 'avianAscent_meta_v1';
const UNLOCK_KEY = 'avianAscent_unlocks_v1';
const HIGHSCORE_KEY = 'avian_highscores_v1';
const RUN_HISTORY_KEY = 'avianAscent_runHistory_v1';
const ACCESS_KEY = 'avian_accessibility_v1';
const BACKUP_KEY = 'avianAscent_save_v2_backup_pre_v13';

let failed = 0;

function fail(msg) {
  console.error('[save-migration] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[save-migration] ok  ', msg);
}

function createMockLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    _dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

function loadSandbox(extraFiles = [], opts = {}) {
  const ctx = {
    globalThis: {},
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON,
    Date,
    localStorage: opts.localStorage || createMockLocalStorage(),
    sessionStorage: createMockLocalStorage(),
    BIRDS: {
      crow: {
        name: 'Crow',
        class: 'knight',
        stats: { hp: 60, maxHp: 60, atk: 12, def: 17, spd: 9, dodge: 4, acc: 84, mdef: 8, matk: 0, critChance: 8 },
      },
    },
    STAT_LEDGER_TRACKED_KEYS: ['maxHp', 'atk', 'def', 'spd', 'acc', 'dodge', 'matk', 'mdef', 'critChance', 'armorPen', 'magicPen'],
    G: { shinyObjects: 0, ui: { gameMode: 'story' }, endlessMode: false },
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
    'js/data/equipment/loot-tables.js',
    'js/data/equipment/items.js',
    'js/data/equipment/reference-loadouts.js',
    'js/meta/fortune-meta.js',
    'js/systems/save-migrations.js',
    'js/systems/equipment.js',
  ];

  for (const rel of [...baseFiles, ...extraFiles]) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing file ' + rel);
      continue;
    }
    vm.runInContext(readFileSync(full, 'utf8'), ctx, { filename: rel });
  }

  ctx.globalThis.FORTUNE_META_KEY = META_KEY;
  ctx.Avian = ctx.globalThis.Avian || {};
  ctx.Avian.flags = { equipmentV2: opts.equipmentV2 !== false };
  return ctx;
}

function readFixture(name) {
  const full = path.join(ROOT, 'scripts/fixtures', name);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function testV12MutationReset() {
  const ls = createMockLocalStorage({
    [UNLOCK_KEY]: JSON.stringify({ hummingbird: true }),
    [META_KEY]: JSON.stringify({ goldenGooseEggs: 5, birdCards: { owned: {}, mutationHistory: {} } }),
    [HIGHSCORE_KEY]: JSON.stringify([{ score: 100 }]),
    [RUN_HISTORY_KEY]: JSON.stringify([{ won: false }]),
    [ACCESS_KEY]: JSON.stringify({ textScale: 1 }),
  });
  const ctx = loadSandbox([], { localStorage: ls, equipmentV2: true });
  const systems = ctx.Avian.systems;
  const fixture = readFixture('save-v12-mutations.json');
  const raw = JSON.stringify(fixture);

  ls.setItem(SAVE_KEY, raw);
  const backedUp = systems.maybeBackupPreV13Save(raw, fixture);
  if (!backedUp) fail('v12 backup not written');
  else ok('v12 backup written once');

  if (ls.getItem(BACKUP_KEY) !== raw) fail('backup blob mismatch');
  else ok('backup blob matches source');

  const migrated = systems.runSaveMigrations(JSON.parse(raw));
  if (!migrated?._equipmentV2PreReleaseReset) fail('v12 migration did not mark pre-release reset');
  else ok('v12 migration marked pre-release reset');

  const sellValue = systems.computeMutationEraCompensation(fixture);
  const stipend = systems.EQUIPMENT_V2_STARTER_STIPEND;
  const expectedComp = sellValue + stipend;
  if (migrated._equipmentV2MigrationResult?.compensation !== expectedComp) {
    fail(`compensation expected ${expectedComp}, got ${migrated._equipmentV2MigrationResult?.compensation}`);
  } else {
    ok(`compensation computed (${expectedComp}🌟)`);
  }

  systems.grantEquipmentV2MigrationCompensation(expectedComp, migrated._equipmentV2MigrationResult);
  const meta = JSON.parse(ls.getItem(META_KEY));
  if (meta.equipmentV2Migration?.pendingShinyCompensation !== expectedComp) {
    fail('meta pending compensation missing');
  } else {
    ok('meta compensation granted');
  }

  if (JSON.parse(ls.getItem(UNLOCK_KEY)).hummingbird !== true) fail('unlocks not preserved');
  else ok('unlocks preserved');

  if (JSON.parse(ls.getItem(HIGHSCORE_KEY)).length !== 1) fail('highscores not preserved');
  else ok('highscores preserved');

  if (JSON.parse(ls.getItem(RUN_HISTORY_KEY)).length !== 1) fail('run history not preserved');
  else ok('run history preserved');

  if (JSON.parse(ls.getItem(ACCESS_KEY)).textScale !== 1) fail('accessibility not preserved');
  else ok('accessibility preserved');

  ls.removeItem(SAVE_KEY);
  ls.setItem(SAVE_KEY, raw);
  let crashed = false;
  try {
    const again = systems.runSaveMigrations(JSON.parse(ls.getItem(SAVE_KEY)));
    if (!again) crashed = true;
  } catch (_) {
    crashed = true;
  }
  if (crashed) fail('loading pre-v13 crashed');
  else ok('loading pre-v13 does not crash');
}

function testCorruptedLoadoutSanitization() {
  const ctx = loadSandbox([], { equipmentV2: true });
  const equipment = ctx.Avian.equipment;
  const fixture = readFixture('save-v13-corrupted-loadouts.json');
  const player = JSON.parse(JSON.stringify(fixture.player));

  const beforeShiny = ctx.G.shinyObjects;
  const result = equipment.sanitizeEquipmentLoadout(player, { removeUnmappable: true });

  if (player.equipment.mainHand !== 'EQ-LN-GRY') fail('2H mainHand should remain');
  else ok('2H mainHand kept');

  if (player.equipment.offHand == null) ok('offHand cleared for 2H conflict');
  else fail(`offHand not cleared for 2H+offHand (offHand=${String(player.equipment.offHand)})`);

  if (player.equipmentInventory.includes('EQ-NOT-REAL')) fail('invalid inventory id not removed');
  else ok('invalid inventory id removed');

  const wrongSlotId = 'EQ-HP-GRY';
  player.equipment.mainHand = wrongSlotId;
  player.equipment.offHand = null;
  player.equipmentInventory = [];
  equipment.sanitizeEquipmentLoadout(player, { removeUnmappable: false });
  if (player.equipment.mainHand != null) fail('wrong-slot item should be unequipped');
  else ok('wrong-slot item unequipped to inventory');

  if (!player.equipmentInventory.includes(wrongSlotId)) fail('wrong-slot item should land in inventory');
  else ok('wrong-slot item moved to inventory');

  if (result.compensation <= 0) fail('invalid id should grant compensation');
  else ok('invalid id grants compensation');
}

function testEquipmentV2SaveStamp() {
  const ctx = loadSandbox([], { equipmentV2: true });
  const systems = ctx.Avian.systems;
  const save = {
    schemaVersion: 12,
    equipmentV2: true,
    equipmentPackVersion: systems.EQUIPMENT_PACK_VERSION,
    player: {
      birdKey: 'crow',
      equipment: equipmentEmpty(ctx),
      equipmentInventory: [],
    },
  };
  const migrated = systems.runSaveMigrations(save);
  if (migrated._equipmentV2PreReleaseReset) fail('equipment v2 save should not reset');
  else ok('equipment v2 save skips pre-release reset');

  if (migrated.equipmentV2 !== true) fail('equipmentV2 stamp missing');
  else ok('equipmentV2 stamped on migrated save');

  if (migrated.equipmentPackVersion !== systems.EQUIPMENT_PACK_VERSION) fail('equipmentPackVersion missing');
  else ok('equipmentPackVersion stamped');

  if (Number(migrated.schemaVersion) !== 15) fail('schemaVersion should be 15 after migration');
  else ok('schemaVersion is 15');

  if (migrated.affinityArsenalPackVersion !== systems.AFFINITY_ARSENAL_PACK_VERSION) {
    fail('affinityArsenalPackVersion missing');
  } else ok('affinityArsenalPackVersion stamped');
}

function testShieldSlotMigration() {
  const ctx = loadSandbox([], { equipmentV2: true });
  const systems = ctx.Avian.systems;
  const save = {
    schemaVersion: 14,
    equipmentV2: true,
    equipmentPackVersion: systems.EQUIPMENT_PACK_VERSION,
    player: {
      birdKey: 'crow',
      equipment: {
        helmet: null,
        armour: null,
        mainHand: 'EQ-LN-GRY',
        offHand: null,
        shield: 'EQ-SM-GRY',
        ankletL: null,
        ankletR: null,
        necklace: null,
      },
      equipmentInventory: [],
    },
  };
  const migrated = systems.runSaveMigrations(save);
  if (Number(migrated.schemaVersion) !== 15) fail('shield migration should reach schema 15');
  else ok('shield migration reaches schema 15');
  if (migrated.player.equipment.shield != null) fail('legacy shield key should be removed');
  else ok('legacy shield key removed');
  if (migrated.player.equipment.offHand !== 'EQ-SM-GRY') {
    fail('shield should move into empty offHand, got ' + migrated.player.equipment.offHand);
  } else ok('shield migrated into offHand');

  const saveOccupied = {
    schemaVersion: 14,
    equipmentV2: true,
    equipmentPackVersion: systems.EQUIPMENT_PACK_VERSION,
    player: {
      birdKey: 'sparrow',
      equipment: {
        helmet: null,
        armour: null,
        mainHand: 'EQ-TB-GRY',
        offHand: 'EQ-TB-GRY',
        shield: 'EQ-SM-GRY',
        ankletL: null,
        ankletR: null,
        necklace: null,
      },
      equipmentInventory: [],
    },
  };
  const m2 = systems.runSaveMigrations(saveOccupied);
  if (m2.player.equipment.offHand !== 'EQ-TB-GRY') fail('occupied offHand should be preserved');
  else ok('occupied offHand preserved during shield migrate');
  if (!Array.isArray(m2.player.equipmentInventory) || !m2.player.equipmentInventory.includes('EQ-SM-GRY')) {
    fail('displaced shield should go to inventory');
  } else ok('displaced shield moved to inventory');
}

function equipmentEmpty(ctx) {
  return ctx.Avian.equipment.createEmptyLoadout();
}

function testFlagOffSchema13() {
  const ctx = loadSandbox([], { equipmentV2: false });
  const systems = ctx.Avian.systems;
  const save = {
    schemaVersion: 12,
    equipmentV2: true,
    equipmentPackVersion: systems.EQUIPMENT_PACK_VERSION,
    player: { birdKey: 'crow', equipment: equipmentEmpty(ctx), equipmentInventory: [] },
  };
  const migrated = systems.runSaveMigrations(save);
  // Phase 13: runtime flag is always true; save stamp follows live flag when set false in sandbox.
  if (migrated.equipmentV2 !== false) fail('sandbox flag-off save should stamp equipmentV2:false');
  else ok('sandbox flag-off save stamps equipmentV2:false');
}

testV12MutationReset();
testCorruptedLoadoutSanitization();
testEquipmentV2SaveStamp();
testShieldSlotMigration();
testFlagOffSchema13();

if (failed) {
  console.error(`\n[save-migration] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[save-migration] all checks passed');
