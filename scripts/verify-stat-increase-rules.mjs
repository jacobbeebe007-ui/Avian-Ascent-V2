#!/usr/bin/env node
/**
 * Vitality +1 = Max Health +5; Agility +1 = Evasion +0.5.
 * Max HP = Size Base + 5×VIT + 5×(Level−1) (Combat Workbook v2.1).
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

ok('vitalityMaxHpPerPoint is 5', cfg.vitalityMaxHpPerPoint === 5, `got=${cfg.vitalityMaxHpPerPoint}`);
ok('levelHealthFlat is 5', cfg.levelHealthFlat === 5, `got=${cfg.levelHealthFlat}`);
ok('attackPowerStatScale is 2', cfg.attackPowerStatScale === 2, `got=${cfg.attackPowerStatScale}`);
ok('agilityDodgePctPerPoint is 0.5', cfg.agilityDodgePctPerPoint === 0.5);
ok('hit minPct is 60', Avian.data.combatConfig.hit.minPct === 60);

const sparrow = Avian.data.birdsV2.sparrow;
ok('sparrow L1 cache is 128 + 5×3 = 143', Number(sparrow.stats.maxHp) === 143,
  `got=${sparrow.stats.maxHp}`);
ok('sparrow baseHealth is 128 (Small)', Number(sparrow.baseHealth) === 128,
  `got=${sparrow.baseHealth}`);

const barn = Avian.data.birdsV2.barnowl;
ok('Barn Owl is Rogue', barn.class === 'rogue', `got=${barn.class}`);
ok('Barn Owl DEX 11 / Focus 2 / Precision 88',
  barn.stats.dex === 11 && barn.stats.matk === 2 && barn.basePrecision === 88,
  `dex=${barn.stats.dex} matk=${barn.stats.matk} prec=${barn.basePrecision}`);

const l1 = bp.vitalityToMaxHp(128, 3, 1);
const l1plus = bp.vitalityToMaxHp(128, 4, 1);
ok('+1 Vitality always adds +5 Max Health', l1plus - l1 === 5, `128+VIT3=${l1} 128+VIT4=${l1plus}`);

for (const vit of [0, 1, 5, 12]) {
  const a = bp.vitalityToMaxHp(137, vit, 1);
  const b = bp.vitalityToMaxHp(137, vit + 1, 1);
  ok(`BH 137 VIT ${vit}→${vit + 1} ΔHP=5`, b - a === 5, `a=${a} b=${b} Δ=${b - a}`);
}

const d0 = bp.agilityToDodge(9);
const d1 = bp.agilityToDodge(10);
ok('+1 Agility adds +0.5 Evasion', Math.abs((d1 - d0) - 0.5) < 0.0001, `9→${d0} 10→${d1}`);

const entity = {
  baseHealth: 128,
  birdLevel: 1,
  stats: { vitality: 3, spd: 9, maxHp: 143, hp: 143, dodge: 4.5 },
};
bp.refreshDerivedStats(entity);
ok('refresh keeps Sparrow L1 Max HP 143', entity.stats.maxHp === 143, `got=${entity.stats.maxHp}`);
ok('refresh keeps Sparrow L1 Dodge 4.5', entity.stats.dodge === 4.5, `got=${entity.stats.dodge}`);

entity.stats.vitality += 1;
bp.refreshDerivedStats(entity, { dodge: false });
ok('refresh Vitality +1 → Max HP +5', entity.stats.maxHp === 148, `got=${entity.stats.maxHp}`);
ok('full HP follows Max HP on Vitality gain', entity.stats.hp === 148, `got=${entity.stats.hp}`);

entity.birdLevel = 2;
entity.stats.vitality = 3;
bp.refreshDerivedStats(entity, { dodge: false });
ok('Sparrow L2 Max HP is 128 + 15 + 5 = 148', entity.stats.maxHp === 148, `got=${entity.stats.maxHp}`);

entity.stats.spd += 2;
entity._statLedger = { fromLevel: { dodge: 2 }, fromUpgrades: {}, fromCardTier: {}, fromEquipment: {} };
bp.refreshDerivedStats(entity, { hp: false });
ok('Agility +2 raises Dodge by 1 and keeps extra +2 Evasion',
  entity.stats.dodge === 4.5 + 1 + 2, `got=${entity.stats.dodge}`);

const grown = bp.computeFinalStats({
  base: { vitality: 3, atk: 1, dex: 9, def: 4, matk: 0, mdef: 4, spd: 9, baseHealth: 128 },
  baseHealth: 128,
  className: 'rogue',
  level: 2,
  skipLevelFlat: true,
  totalStars: 0,
  tier: 'grey',
});
ok('Sparrow L2 Max HP via computeFinalStats is 148', Number(grown.ledger.maxHp) === 148,
  `got=${grown.ledger.maxHp}`);

const tiny = bp.vitalityToMaxHp(125, 0, 1);
const giant = bp.vitalityToMaxHp(140, 0, 1);
ok('Tiny→Giant free HP gap is 15 (12%)', giant - tiny === 15, `tiny=${tiny} giant=${giant}`);

if (failed) {
  console.error(`\n[verify-stat-increase-rules] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[verify-stat-increase-rules] pass');
