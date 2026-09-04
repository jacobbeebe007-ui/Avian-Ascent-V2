#!/usr/bin/env node
/**
 * Assert Combat Workbook v2.1 Bird Recalibration matches runtime js/data/birds-v2.js.
 *   node scripts/verify-workbook-bird-stats.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKBOOK = path.join(ROOT, 'Avian_Ascent_Combat_Workbookv2.1.xlsx');
const BIRDS_V2 = path.join(ROOT, 'js/data/birds-v2.js');

let failed = 0;
function ok(msg) { console.log('  ✓', msg); }
function fail(msg) { failed += 1; console.error('  ✗', msg); }

function zipEntries(file) {
  const b = readFileSync(file);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65558); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) throw new Error(`Invalid OOXML: ${file}`);
  const out = Object.create(null);
  let p = b.readUInt32LE(e + 16);
  const end = p + b.readUInt32LE(e + 12);
  while (p < end && b.readUInt32LE(p) === 0x02014b50) {
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28);
    const xl = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const off = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nl);
    const dataAt = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
    const raw = b.slice(dataAt, dataAt + size);
    out[name] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nl + xl + cl;
  }
  return out;
}
const decode = (s = '') => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&#13;/g, '\r')
  .replace(/&amp;/g, '&');
function col(ref) {
  let n = 0;
  for (const c of (/^([A-Z]+)/.exec(ref) || ['', 'A'])[1]) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}
function parseSheet(xml) {
  const rows = [];
  let m;
  const rr = /<(?:x:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  while ((m = rr.exec(xml))) {
    const row = [];
    let c;
    const cr = /<(?:x:)?c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    while ((c = cr.exec(m[2]))) {
      const attrs = c[1];
      const body = c[2] || '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs);
      const vm = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body);
      const value = vm ? decode(vm[1]) : '';
      row[ref ? col(ref[1]) : row.length] = value;
    }
    rows[Number(m[1]) - 1] = row;
  }
  return rows;
}
function readCombatWorkbook(file) {
  const e = zipEntries(file);
  const wb = e['xl/workbook.xml'];
  const rels = e['xl/_rels/workbook.xml.rels'] || '';
  const targets = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\s+([^>]+?)\s*\/>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && t) targets[id] = t.replace(/^\//, '');
  }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    let t = targets[m[2]];
    if (!t) continue;
    const key = t.startsWith('xl/') ? t : `xl/${t}`;
    if (e[key]) sheets[decode(m[1])] = parseSheet(e[key]);
  }
  return sheets;
}

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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

console.log('== Combat Workbook v2.1 bird recalibration ==');
if (!existsSync(WORKBOOK)) {
  fail(`missing ${path.basename(WORKBOOK)}`);
  process.exit(1);
}

const sheets = readCombatWorkbook(WORKBOOK);
const birds = loadBirdsV2();
const keys = Object.keys(birds);
if (keys.length !== 52) fail(`birds-v2 expected 52, got ${keys.length}`);
else ok('runtime birds-v2 has 52 birds');

const rows = sheets['Bird Recalibration'];
if (!rows) {
  fail('Bird Recalibration sheet missing');
  process.exit(1);
}

const byName = Object.create(null);
for (const [key, row] of Object.entries(birds)) byName[row.name] = { key, row };

let matched = 0;
for (let i = 4; i < rows.length; i++) {
  const cells = rows[i] || [];
  const name = String(cells[0] || '').trim();
  if (!name || !byName[name]) {
    if (name && !byName[name]) fail(`workbook bird ${name} not in birds-v2`);
    continue;
  }
  matched += 1;
  const found = byName[name];
  delete byName[name];
  const b = found.row;
  const st = b.stats;
  const got = {
    class: String(cells[2] || '').toLowerCase(),
    size: String(cells[3] || ''),
    vit: num(cells[7]),
    might: num(cells[8]),
    dex: num(cells[9]),
    guard: num(cells[10]),
    focus: num(cells[11]),
    resolve: num(cells[12]),
    agility: num(cells[13]),
    maxHp: num(cells[15]),
    precision: num(cells[18]),
  };
  const SIZE = {
    Tiny: 125, Small: 128, Medium: 131, Large: 134,
    'Very Large': 137, Giant: 140, 'Boss Override': 150,
  };
  const sizeBase = SIZE[got.size];
  const formulaHp = Math.round(sizeBase + 5 * got.vit);
  const checks = [
    ['class', got.class, b.class],
    ['size', got.size, b.realSize],
    ['baseHealth', sizeBase, Number(b.baseHealth)],
    ['vitality', got.vit, Number(b.vitality)],
    ['might', got.might, Number(st.atk)],
    ['dexterity', got.dex, Number(st.dex)],
    ['guard', got.guard, Number(st.def)],
    ['focus', got.focus, Number(st.matk)],
    ['resolve', got.resolve, Number(st.mdef)],
    ['agility', got.agility, Number(st.spd)],
    ['l1MaxHealth', got.maxHp, Number(st.maxHp)],
    ['l1MaxHealthFormula', formulaHp, Number(st.maxHp)],
    ['basePrecision', got.precision, Number(b.basePrecision || st.acc)],
  ];
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) fail(`${name} ${field}: workbook/formula ${actual} != runtime ${expected}`);
  }
}

const leftover = Object.keys(byName);
if (leftover.length) fail(`birds-v2 birds missing from workbook: ${leftover.join(', ')}`);
if (matched === 52) ok('all 52 runtime birds present in Bird Recalibration');
else fail(`matched ${matched} workbook birds, expected 52`);

const core = (sheets['V2 Core Rules'] || []).flat().join('\n');
if (/Weapon Roll \+ 2|Size Base \+ 5×VIT|5×\(Level/i.test(core)) {
  ok('V2 Core Rules document Attack Power and compressed Health');
} else fail('V2 Core Rules missing Attack Power / Health formulas');

if (failed) {
  console.error(`\n[verify-workbook-bird-stats] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[verify-workbook-bird-stats] pass');
