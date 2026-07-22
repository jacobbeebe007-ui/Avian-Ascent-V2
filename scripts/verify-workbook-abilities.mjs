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
  path.join(process.env.HOME || '', 'Documents', 'Avian Ascent', 'Avian Workbooks',
    'Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx'),
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
  for (const m of rels.matchAll(/<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bId="([^"]+)"/g)) {
    ridMap[m[2]] = m[1].replace(/^\//, '');
  }
  let target = null;
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    if (m[1] === sheetName) target = 'xl/' + ridMap[m[2]].replace(/^xl\//, '');
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
    // Whole-phrase word match so short keys like "id" can't hit substrings
    // inside unrelated headers (e.g. "Ailment / Rider").
    const re = new RegExp(`(?:^|\\b)${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|$)`);
    const idx = headers.findIndex((h) => re.test(String(h).toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function extractWorkbookAbilities(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).toLowerCase());
  const idIdx = headerIndex(headers, ['ability id', 'skill id', 'id']);
  const nameIdx = headerIndex(headers, ['ability name', 'name']);
  const cdIdx = headerIndex(headers, ['cooldown']);
  const enIdx = headerIndex(headers, ['en cost', 'energy', 'en']);
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = idIdx >= 0 ? String(row[idIdx] || '').trim() : '';
    const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
    if (idIdx >= 0 && (!id || /^n\/a$/i.test(id))) continue;
    if (idIdx < 0 && !name) continue;
    out.push({
      id,
      name,
      cooldown: cdIdx >= 0 ? String(row[cdIdx] || '').trim() : '',
      enCost: enIdx >= 0 ? String(row[enIdx] || '').trim() : '',
    });
  }
  return out;
}

function loadSkillTrees() {
  // skill-trees.js is generated: Avian.data.combatPack.skillTrees = Object.freeze({...json...});
  const src = readFileSync(SKILL_TREES, 'utf8');
  const sandbox = {};
  sandbox.globalThis = sandbox;
  try {
    new Function('globalThis', src)(sandbox);
  } catch (_e) { /* fall through to empty */ }
  return sandbox?.Avian?.data?.combatPack?.skillTrees || {};
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
const trees = loadSkillTrees();
const treeIds = new Set(Object.keys(trees));

// The workbook sheet has no Ability ID column — abilities are keyed by name.
// skill-trees.js ids are generated (<FAMILY>_S<stage>) with a `name` field,
// so parity is checked on names (case-insensitive).
const treeByName = new Map();
for (const [id, entry] of Object.entries(trees)) {
  const nm = String(entry?.name || '').trim().toLowerCase();
  if (nm && !treeByName.has(nm)) treeByName.set(nm, { id, entry });
}

const lookupKey = (a) => String(a.name || a.id || '').trim().toLowerCase();
const missingInRepo = workbookAbilities.filter((a) => {
  const key = lookupKey(a);
  return key && !treeByName.has(key) && !treeIds.has(a.id);
});

if (missingInRepo.length) {
  fail(`${missingInRepo.length} workbook abilities missing from skill-trees.js (first 10): ${missingInRepo.slice(0, 10).map((a) => a.name || a.id).join(', ')}`);
}

// Cooldown drift is warn-only: legacy skill-tree cooldowns are known to have
// dropped "N turns" values at import time, and the whole legacy kit system is
// slated for removal by the equipment-v2 migration (see docs/equipment-v2-migration.md).
let cooldownDrift = 0;
for (const ab of workbookAbilities.slice(0, 500)) {
  const hit = treeByName.get(lookupKey(ab));
  if (!hit) continue;
  const wbCdNum = String(ab.cooldown || '').trim().match(/^(\d+)/);
  const repoCd = Number(hit.entry.cooldown) || 0;
  if (wbCdNum && Number(wbCdNum[1]) !== repoCd) cooldownDrift += 1;
}
if (cooldownDrift) {
  console.warn(`warn: ${cooldownDrift} abilities with cooldown drift vs workbook (legacy kits — see equipment-v2 migration notes)`);
}

console.log(`verify-workbook-abilities: checked ${workbookAbilities.length} workbook rows, ${treeIds.size} skill-tree ids, ${failed} failures`);
process.exit(failed > 0 ? 1 : 0);
