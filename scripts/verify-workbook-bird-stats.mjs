#!/usr/bin/env node
/**
 * Assert the GitHub master workbook Bird Stats match runtime js/data/birds-v2.js.
 *   node scripts/verify-workbook-bird-stats.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWorkbook } from './lib/ooxml-workbook.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKBOOK_CANDIDATES = [
  'Avian_Ascent_Current_Master_v2.1.xlsx',
  'Avian_Ascent_Current_Master_v1.6_Structured_Effects Updated.xlsm',
  'Avian_Ascent_Current_Master_v1.6_Structured_Effects.xlsm',
];
const WORKBOOK = WORKBOOK_CANDIDATES
  .map((name) => path.join(ROOT, name))
  .find((p) => existsSync(p));
const BIRDS_V2 = path.join(ROOT, 'js/data/birds-v2.js');

const AFFINITY = {
  aeris: 'Sky', lunae: 'Night', solis: 'Day', maris: 'Water', terra: 'Earth', tempest: 'Storm',
};

let failed = 0;
function ok(msg) { console.log('  ✓', msg); }
function fail(msg) { failed += 1; console.error('  ✗', msg); }

function loadBirdsV2() {
  const src = readFileSync(BIRDS_V2, 'utf8');
  const start = src.indexOf('{', src.indexOf('Object.freeze('));
  let depth = 0;
  let end = -1;
  for (let p = start; p < src.length; p++) {
    if (src[p] === '{') depth += 1;
    else if (src[p] === '}') {
      depth -= 1;
      if (depth === 0) { end = p + 1; break; }
    }
  }
  return JSON.parse(src.slice(start, end));
}

function headerMap(row) {
  const map = Object.create(null);
  for (let i = 0; i < (row || []).length; i++) {
    const h = String(row[i] || '').trim().toLowerCase();
    if (h) map[h] = i;
  }
  return map;
}

function num(v) {
  if (v == null || v === '') return NaN;
  const s = String(v).replace(/%/g, '').trim();
  return Number(s);
}

function intish(v) {
  const n = num(v);
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

console.log('== Workbook bird base stats ==');
if (!WORKBOOK) {
  fail(`missing master workbook (tried ${WORKBOOK_CANDIDATES.join(', ')})`);
  process.exit(1);
}
ok(`using ${path.basename(WORKBOOK)}`);

const sheets = readWorkbook(WORKBOOK);
const birds = loadBirdsV2();
const keys = Object.keys(birds);
if (keys.length !== 52) fail(`birds-v2 expected 52, got ${keys.length}`);
else ok('runtime birds-v2 has 52 birds');

const rows = sheets['Bird Stats'];
if (!rows) {
  fail('Bird Stats sheet missing');
  process.exit(1);
}
const headerAt = rows.findIndex((r) => r && String(r[0] || '').trim() === 'Bird Name');
if (headerAt < 0) {
  fail('Bird Name header not found');
  process.exit(1);
}
const cols = headerMap(rows[headerAt]);
const required = [
  'bird name', 'class', 'real size', 'species tier', 'base health', 'base vitality',
  'might', 'dexterity', 'guard', 'focus', 'resolve', 'agility', 'l1 max health',
  'base precision',
];
for (const h of required) {
  if (cols[h] == null) fail(`Bird Stats missing column ${h}`);
}
if (failed === 0) ok('Bird Stats has current base-stat columns including L1 Max Health and Base Precision');

const byName = Object.create(null);
for (const [key, row] of Object.entries(birds)) byName[row.name] = { key, row };

let matched = 0;
for (const cells of rows.slice(headerAt + 1)) {
  const name = String(cells?.[0] || '').trim();
  if (!name) continue;
  const found = byName[name];
  if (!found) { fail(`workbook bird ${name} not in birds-v2`); continue; }
  matched += 1;
  delete byName[name];
  const b = found.row;
  const st = b.stats;
  const got = {
    class: String(cells[cols.class] || '').toLowerCase(),
    size: String(cells[cols['real size']] || ''),
    tier: String(cells[cols['species tier']] || '').toLowerCase(),
    bh: intish(cells[cols['base health']]),
    vit: intish(cells[cols['base vitality']]),
    might: intish(cells[cols.might]),
    dex: intish(cells[cols.dexterity]),
    guard: intish(cells[cols.guard]),
    focus: intish(cells[cols.focus]),
    resolve: intish(cells[cols.resolve]),
    agility: intish(cells[cols.agility]),
    maxHp: intish(cells[cols['l1 max health']]),
    precision: intish(cells[cols['base precision']]),
  };
  const expHp = Math.max(1, Math.round(Number(b.baseHealth) + Number(b.vitality) * 3));
  const checks = [
    ['class', got.class, b.class],
    ['size', got.size, b.realSize],
    ['tier', got.tier, b.speciesTier],
    ['baseHealth', got.bh, Number(b.baseHealth)],
    ['vitality', got.vit, Number(b.vitality)],
    ['might', got.might, Number(st.atk)],
    ['dexterity', got.dex, Number(st.dex)],
    ['guard', got.guard, Number(st.def)],
    ['focus', got.focus, Number(st.matk)],
    ['resolve', got.resolve, Number(st.mdef)],
    ['agility', got.agility, Number(st.spd)],
    ['l1MaxHealth', got.maxHp, Number(st.maxHp)],
    ['l1MaxHealthFormula', got.maxHp, expHp],
    ['basePrecision', got.precision, Number(b.basePrecision || st.acc)],
  ];
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) fail(`${name} ${field}: workbook ${actual} != runtime ${expected}`);
  }
}

const leftover = Object.keys(byName);
if (leftover.length) fail(`birds-v2 birds missing from workbook: ${leftover.join(', ')}`);
if (matched === 52) ok('all 52 runtime birds present in Bird Stats');
else fail(`matched ${matched} workbook birds, expected 52`);

const currentRules = (sheets['Current Rules'] || []).flat().join('\n');
if (/Vitality × 3|Vitality x 3|\+3 Max Health|increases Max Health by 3/i.test(currentRules)
    && !/5% of Base Health/.test(currentRules)) {
  ok('Current Rules use +3 Max Health, not 5% of Base Health');
} else fail('Current Rules still document the old 5% Vitality formula');

const core = (sheets['Core Rules'] || []).flat().join('\n');
if (/Base Health \+ Vitality × 3|Base Health \+ Vitality x 3/.test(core)
    && !/Vitality×0\.05|Vitality×0.05|0\.05 × Final Vitality/.test(core)) {
  ok('Core Rules Health formula is Base Health + Vitality × 3');
} else fail('Core Rules Health formula is not the current runtime conversion');

if (failed) {
  console.error(`\n[verify-workbook-bird-stats] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[verify-workbook-bird-stats] pass');
