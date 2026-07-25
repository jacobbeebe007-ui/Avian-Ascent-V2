#!/usr/bin/env node
/*
 * Checks for Workbook + Combat UI Sync plan:
 * - effect tiers v0.6 shape
 * - skill library present
 * - status frozen active
 * - enemy energy startEN
 * - level-up / glossary naming helpers exist in game.js source
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function fail(msg) { console.error('[wb-ui-sync] FAIL', msg); failed++; }
function ok(msg) { console.log('[wb-ui-sync] ok  ', msg); }

function load(rel) {
  const full = path.join(ROOT, rel);
  if (!existsSync(full)) { fail('missing ' + rel); return ''; }
  return readFileSync(full, 'utf8');
}

const gameSrc = load('js/core/game.js');
const affinityImp = load('scripts/import-affinity-arsenal-workbook.mjs');

if (/write_js\('js\/data\/effect-tiers\.js'/.test(affinityImp)) {
  fail('affinity importer still writes effect-tiers.js');
} else {
  ok('affinity importer does not overwrite effect-tiers');
}

if (!/buildPlayerBirdTooltipHtml[\s\S]*?let html=/.test(gameSrc)
  && !/function buildPlayerBirdTooltipHtml\(player\)\{\s*\n\s*if\(!player\) return '';\s*\n[\s\S]*?let html=/.test(gameSrc)) {
  // looser check
  const fn = gameSrc.match(/function buildPlayerBirdTooltipHtml\([\s\S]*?\n\}/);
  if (!fn || !/let html=/.test(fn[0])) fail('buildPlayerBirdTooltipHtml missing let html=');
  else ok('buildPlayerBirdTooltipHtml initializes html');
} else {
  ok('buildPlayerBirdTooltipHtml initializes html');
}

if (!/levelUpChoiceLabel/.test(gameSrc)) fail('levelUpChoiceLabel missing');
else ok('level-up glossary helper present');

if (!/k:'skills'/.test(gameSrc) || !/equipment\?\.skills/.test(gameSrc)) fail('Skill Library ref tab missing');
else ok('Reference Guide Skill Library tab wired');

if (!/k:'stats'/.test(gameSrc) || !/k:'tiers'/.test(gameSrc)) fail('Stats/Effect Tiers ref tabs missing');
else ok('Reference Guide Stats + Effect Tiers tabs wired');

if (/k:'mutations'/.test(gameSrc) && /label:'🧬 Mutations'/.test(gameSrc)) fail('empty Mutations tab still present');
else ok('Mutations tab retired from Reference Guide');

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of [
  'js/data/effect-tiers.js',
  'js/data/equipment/skills.js',
  'js/data/equipment/slots.js',
  'js/data/status-definitions.js',
  'js/systems/enemy-roster-runtime.js',
]) {
  vm.runInContext(load(rel), ctx, { filename: rel });
}

const tiers = ctx.Avian.data.effectTiers;
if (tiers?.buff?.minor === 6 && tiers?.buff?.moderate === 8 && tiers?.buff?.major === 12) {
  ok('effect tiers 6/8/12');
} else fail('effect tiers unexpected: ' + JSON.stringify(tiers?.buff));

const skillCount = Object.keys(ctx.Avian.data.equipment.skills || {}).length;
if (skillCount === 82) ok('skill library has 82 skills');
else fail(`expected 82 skills, got ${skillCount}`);

const names = ctx.Avian.data.equipment.slots.statDisplayNames || {};
if (names.atk === 'Might') ok('statDisplayNames atk → Might');
else fail('statDisplayNames.atk is ' + names.atk);

const collect = ctx.collectCombatStatusEntries || ctx.Avian.statusDefs.collectCombatStatusEntries;
const frozenEntries = collect({ frozen: { pendingSkip: true, baseSpd: 10 } }, {});
if (frozenEntries.some((e) => e.id === 'frozen')) ok('frozen status collected for badges');
else fail('frozen status not collected');

const labels = ctx.Avian.statusDefs;
// resolve badge path
const resolve = ctx.resolveCombatStatusBadge || ctx.Avian.statusDefs.resolveStatusBadge;
const badge = resolve({ id: 'frozen', value: { pendingSkip: true } }, { statuses: {}, owner: 'player' });
if (badge && /Frozen/i.test(badge.text || '')) ok('frozen badge text resolves');
else fail('frozen badge did not resolve');

// Enemy energy profile constants via game.js text
if (/ENEMY_ENERGY_START = 4/.test(gameSrc) && /ENEMY_ENERGY_REGEN = 3/.test(gameSrc)) {
  ok('enemy EN start 4 / regen 3 constants');
} else fail('enemy EN constants missing');

if (/ed\.stats\.en=prof\.startEN/.test(gameSrc)) ok('OW enemy stats.en uses startEN');
else fail('OW enemy stats.en still not startEN');

if (!/function applyEnemyStatsFromPlayerProgression/.test(gameSrc)) {
  fail('applyEnemyStatsFromPlayerProgression missing');
} else {
  ok('enemy progression parity helper present');
}
if (!/workbookLevel/.test(gameSrc) || !/_fromPlayerProgression/.test(gameSrc)) {
  fail('enemy workbook level scaling wiring incomplete');
} else {
  ok('enemy uses workbook L1–30 progression');
}
if (!/resolveEnemyWorkbookLevel/.test(gameSrc)) {
  fail('resolveEnemyWorkbookLevel missing');
} else {
  ok('enemy workbook level resolver present');
}
if (!/computeFinalStats/.test(gameSrc)) {
  fail('enemy path missing computeFinalStats');
} else {
  ok('enemy scales via birdProgression.computeFinalStats');
}

/* Runtime: sparrow L1 via progression should be near birds-v2 base (~57), not old roster (~37). */
try {
  for (const rel of [
    'js/data/birds-v2.js',
    'js/data/progression/level-growth.js',
    'js/data/progression/star-growth.js',
    'js/data/progression/rules.js',
    'js/data/enemy-scaling-profiles.js',
    'js/data/combat-config.js',
    'js/systems/bird-progression.js',
  ]) {
    vm.runInContext(load(rel), ctx, { filename: rel });
  }
  const base = ctx.Avian.data.birdsV2?.sparrow?.stats || ctx.Avian.data.birds?.sparrow?.stats;
  const hpBase = Number(base?.maxHp ?? base?.hp) || 0;
  const grown = ctx.Avian.birdProgression.computeFinalStats({
    base: { hp: hpBase, atk: base.atk, def: base.def, matk: base.matk, mdef: base.mdef, spd: base.spd },
    className: 'rogue',
    level: 1,
    totalStars: 0,
    tier: 'grey',
  });
  const grownHp = Number(grown.ledger?.maxHp ?? grown.ledger?.hp) || 0;
  if (hpBase >= 50 && grownHp >= 50) ok(`player-parity vitality base/grown ${hpBase}/${grownHp} (roster was ~37)`);
  else fail(`expected v0.6 vitality ≥50, got base=${hpBase} grown=${grownHp}`);

  const crow = ctx.Avian.data.birdsV2?.crow?.stats;
  if (crow && Number(crow.matk) === 0 && Number(crow.acc) === 0) {
    ok('crow Focus/Precision are 0 (v0.6)');
  } else {
    fail(`crow expected FOC 0 / PRE 0, got matk=${crow?.matk} acc=${crow?.acc}`);
  }

  const crowL15 = ctx.Avian.birdProgression.computeFinalStats({
    base: { hp: crow.hp, atk: crow.atk, def: crow.def, matk: crow.matk, mdef: crow.mdef, spd: crow.spd },
    className: 'knight',
    level: 15,
    totalStars: 18,
    tier: 'purple',
  });
  const profiled = ctx.Avian.birdProgression.applyEnemyProfile(crowL15.ledger, 'standard');
  const l15Hp = Number(profiled?.maxHp ?? profiled?.hp) || 0;
  if (l15Hp > Number(crow.hp)) ok(`workbook L15 crow enemy vitality ${l15Hp} > base ${crow.hp}`);
  else fail(`expected L15 crow HP growth, got ${l15Hp} vs base ${crow.hp}`);
} catch (err) {
  fail('progression vitality check threw: ' + err.message);
}

if (failed) {
  console.error(`\n[wb-ui-sync] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[wb-ui-sync] all checks passed');
