#!/usr/bin/env node
/**
 * Diff Master workbook "Bird Ability List" against js/data/combat-pack/skill-trees.js
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MASTER_CANDIDATES = [
  process.env.AA_MASTER_WORKBOOK_XLSX,
  path.join(process.env.HOME || '', 'Downloads', 'Avian Music bites', 'Avian Workbooks',
    'Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx'),
].filter(Boolean);

const MASTER_XLSX = MASTER_CANDIDATES.find((p) => existsSync(p));
const SKILL_TREES = path.join(ROOT, 'js', 'data', 'combat-pack', 'skill-trees.js');

function readZipEntries(zipPath) {
  const buf = readFileSync(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found');
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = Object.create(null);
  let p = cdOffset;
  while (p < cdOffset + cdSize) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lhNameLen = buf.readUInt16LE(localOff + 26);
    const lhExtraLen = buf.readUInt16LE(localOff + 28);
    const dataOff = localOff + 30 + lhNameLen + lhExtraLen;
    const cdata = buf.slice(dataOff, dataOff + compSize);
    entries[name] = (compMethod === 8 ? zlib.inflateRawSync(cdata) : cdata).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function loadSheet(xlsxPath, sheetName) {
  const entries = readZipEntries(xlsxPath);
  const ssXml = entries['xl/sharedStrings.xml'] || '<sst/>';
  const sharedStrings = [];
  for (const m of ssXml.matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)) {
    const texts = [];
    for (const t of m[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)) texts.push(t[1]);
    sharedStrings.push(texts.join(''));
  }
  const wb = entries['xl/workbook.xml'];
  const rels = entries['xl/_rels/workbook.xml.rels'];
  const ridMap = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) {
    ridMap[m[1]] = m[2].replace(/^\//, '');
  }
  let target = null;
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    if (m[1] === sheetName) target = 'xl/' + ridMap[m[2]];
  }
  if (!target || !entries[target]) throw new Error('Sheet not found: ' + sheetName);
  const rows = [];
  const sheetXml = entries[target];
  for (const rm of sheetXml.matchAll(/<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<(?:x:)?c\b([^>]*)>(?:<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>)?/g)) {
      const refM = cm[1].match(/\br="([^"]+)"/);
      const letters = (refM ? refM[1] : 'A').replace(/\d+/g, '');
      let idx = 0;
      for (let i = 0; i < letters.length; i++) idx = idx * 26 + (letters.charCodeAt(i) - 64);
      idx -= 1;
      const tM = cm[1].match(/\bt="([^"]+)"/);
      let val = cm[2] != null ? cm[2] : '';
      if (tM && tM[1] === 's') val = sharedStrings[Number(val)] || '';
      cells[idx] = String(val).trim();
    }
    const dense = [];
    for (let i = 0; i < cells.length; i++) dense[i] = cells[i] || '';
    while (dense.length && !dense[dense.length - 1]) dense.pop();
    if (dense.some(Boolean)) rows.push(dense);
  }
  return rows;
}

function headerIndex(headers, names) {
  for (const name of names) {
    const idx = headers.findIndex((h) => String(h).toLowerCase().includes(name.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractWorkbookAbilities(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).toLowerCase());
  const idIdx = headerIndex(headers, ['ability id', 'id', 'skill id']);
  const nameIdx = headerIndex(headers, ['ability name', 'name']);
  const cdIdx = headerIndex(headers, ['cooldown']);
  const enIdx = headerIndex(headers, ['en cost', 'energy', 'en']);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
    if (!id || /^n\/a$/i.test(id)) continue;
    out.push({
      id,
      name: nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '',
      cooldown: cdIdx >= 0 ? String(row[cdIdx] || '').trim() : '',
      enCost: enIdx >= 0 ? String(row[enIdx] || '').trim() : '',
    });
  }
  return out;
}

function loadSkillTreeIds() {
  const src = readFileSync(SKILL_TREES, 'utf8');
  const ids = new Set();
  for (const m of src.matchAll(/\bid:\s*"([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function loadSkillTreeMap() {
  const src = readFileSync(SKILL_TREES, 'utf8');
  const map = Object.create(null);
  const blocks = src.split(/\n\s*"/);
  for (const block of blocks) {
    const idM = block.match(/^([A-Z0-9_]+)/);
    if (!idM) continue;
    const id = idM[1];
    const nameM = block.match(/name:\s*"([^"]*)"/);
    const cdM = block.match(/cooldown:\s*(\d+)/);
    const enM = block.match(/enCost:\s*(\d+)/);
    map[id] = {
      name: nameM ? nameM[1] : '',
      cooldown: cdM ? cdM[1] : '',
      enCost: enM ? enM[1] : '',
    };
  }
  return map;
}

let failed = 0;
function fail(msg) {
  failed += 1;
  console.error('FAIL:', msg);
}

if (!MASTER_XLSX) {
  console.warn('verify-workbook-abilities: master workbook not found — skipping');
  process.exit(0);
}

const rows = loadSheet(MASTER_XLSX, 'Bird Ability List');
const workbookAbilities = extractWorkbookAbilities(rows);
const treeIds = loadSkillTreeIds();
const treeMap = loadSkillTreeMap();

const wbIds = new Set(workbookAbilities.map((a) => a.id));
const missingInRepo = workbookAbilities.filter((a) => !treeIds.has(a.id));
const extraInRepo = [...treeIds].filter((id) => !wbIds.has(id));

if (missingInRepo.length) {
  fail(`${missingInRepo.length} workbook abilities missing from skill-trees.js (first 10): ${missingInRepo.slice(0, 10).map((a) => a.id).join(', ')}`);
}
if (extraInRepo.length > 50) {
  console.warn(`warn: ${extraInRepo.length} skill-tree ids not in workbook list (may be aliases/endless)`);
}

for (const ab of workbookAbilities.slice(0, 500)) {
  const row = treeMap[ab.id];
  if (!row) continue;
  if (ab.name && row.name && ab.name.toLowerCase() !== row.name.toLowerCase()) {
    fail(`name drift ${ab.id}: workbook "${ab.name}" vs repo "${row.name}"`);
  }
  if (ab.cooldown && row.cooldown && String(ab.cooldown) !== String(row.cooldown)) {
    fail(`cooldown drift ${ab.id}: workbook ${ab.cooldown} vs repo ${row.cooldown}`);
  }
}

console.log(`verify-workbook-abilities: checked ${workbookAbilities.length} workbook rows, ${treeIds.size} skill-tree ids, ${failed} failures`);
process.exit(failed > 0 ? 1 : 0);
