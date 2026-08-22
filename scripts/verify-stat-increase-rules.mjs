#!/usr/bin/env node
/**
 * Vitality +1 = Max Health +3; Agility +1 = Evasion +0.5.
 *   node scripts/verify-stat-increase-rules.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

const sandbox = {
  console,
  Math,
  Number,
  Object,
  Array,
  String,
  JSON,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of [
  'js/bootstrap/_namespace.js',
  'js/data/combat-config.js',
  'js/data/birds-v2.js',
  'js/systems/bird-progression.js',
]) {
  vm.runInContext(read(f), sandbox, { filename: f, timeout: 10000 });
}

const Avian = sandbox.Avian;
let failed = 0;
function ok(label, cond, detail) {
  if (!cond) {
    failed += 1;
    console.error('[FAIL]', label, detail || '');
    return;
  }
  console.log('[ok]  ', label, detail || '');
}

const bp = Avian.birdProgression;
const cfg = Avian.data.combatConfig.weaponFirst;

ok('vitalityMaxHpPerPoint is 3', cfg.vitalityMaxHpPerPoint === 3, `got=${cfg.vitalityMaxHpPerPoint}`);
ok('agilityDodgePctPerPoint is 0.5', cfg.agilityDodgePctPerPoint === 0.5);

const sparrow = Avian.data.birdsV2.sparrow;
ok('sparrow L1 cache is 10 + 3×3 = 19', Number(sparrow.stats.maxHp) === 19,
  `got=${sparrow.stats.maxHp}`);

const l1 = bp.vitalityToMaxHp(10, 3);
const l1plus = bp.vitalityToMaxHp(10, 4);
ok('+1 Vitality always adds +3 Max Health', l1plus - l1 === 3, `10+VIT3=${l1} 10+VIT4=${l1plus}`);

for (const vit of [0, 1, 5, 12]) {
  const a = bp.vitalityToMaxHp(16, vit);
  const b = bp.vitalityToMaxHp(16, vit + 1);
  ok(`BH 16 VIT ${vit}→${vit + 1} ΔHP=3`, b - a === 3, `a=${a} b=${b}`);
}

const d0 = bp.agilityToDodge(9);
const d1 = bp.agilityToDodge(10);
ok('+1 Agility adds +0.5 Evasion', Math.abs((d1 - d0) - 0.5) < 0.0001, `9→${d0} 10→${d1}`);

const entity = {
  baseHealth: 10,
  birdLevel: 1,
  stats: { vitality: 3, spd: 9, maxHp: 19, hp: 19, dodge: 4.5 },
};
bp.refreshDerivedStats(entity);
ok('refresh keeps Sparrow L1 Max HP 19', entity.stats.maxHp === 19, `got=${entity.stats.maxHp}`);
ok('refresh keeps Sparrow L1 Dodge 4.5', entity.stats.dodge === 4.5, `got=${entity.stats.dodge}`);

entity.stats.vitality += 1;
bp.refreshDerivedStats(entity, { dodge: false });
ok('refresh Vitality +1 → Max HP +3', entity.stats.maxHp === 22, `got=${entity.stats.maxHp}`);
ok('full HP follows Max HP on Vitality gain', entity.stats.hp === 22, `got=${entity.stats.hp}`);

entity.stats.spd += 2;
entity._statLedger = { fromLevel: { dodge: 2 }, fromUpgrades: {}, fromCardTier: {}, fromEquipment: {} };
bp.refreshDerivedStats(entity, { hp: false });
ok('Agility +2 raises Dodge by 1 and keeps extra +2 Evasion',
  entity.stats.dodge === 4.5 + 1 + 2, `got=${entity.stats.dodge}`);

const grown = bp.computeFinalStats({
  base: { vitality: 3, atk: 1, dex: 9, def: 4, matk: 0, mdef: 4, spd: 9, baseHealth: 10 },
  baseHealth: 10,
  className: 'rogue',
  level: 2,
  skipLevelFlat: true,
  totalStars: 0,
  tier: 'grey',
});
ok('Sparrow L2 Max HP is 15 + 9 = 24', Number(grown.ledger.maxHp) === 24,
  `got=${grown.ledger.maxHp} LBH=${grown.ledger.leveledBaseHealth}`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nOK stat increase rules');
