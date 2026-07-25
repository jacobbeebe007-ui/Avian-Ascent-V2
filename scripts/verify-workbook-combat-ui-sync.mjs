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

if (failed) {
  console.error(`\n[wb-ui-sync] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[wb-ui-sync] all checks passed');
