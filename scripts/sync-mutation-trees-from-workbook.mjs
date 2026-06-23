#!/usr/bin/env node
/**
 * Sync js/data/combat-pack/skill-trees.js from Master workbook "Ability Mutation Trees".
 * Node fallback when pwsh import-master-workbook.ps1 is unavailable.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORKBOOK_CANDIDATES = [
  process.env.AA_MASTER_WORKBOOK_XLSX,
  path.join(process.env.HOME || '', 'Documents', 'Avian Ascent', 'Avian Workbooks',
    'Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx'),
  path.join(process.env.HOME || '', 'Downloads', 'Avian Music bites', 'Avian Workbooks',
    'Master workbook Avian_Ascent_Workbook_Master list of birds, abilities, passives, perks, Aspects etc.xlsx'),
].filter(Boolean);
const WORKBOOK = WORKBOOK_CANDIDATES.find((p) => existsSync(p));
const OUT = path.join(ROOT, 'js', 'data', 'combat-pack', 'skill-trees.js');

const BUFF_TIER_PCT = { minor: 6, major: 8, grand: 12, epic: 18, legendary: 25 };

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
    const commentLen = buf.readUInt32LE(p + 32);
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
  for (const rm of entries[target].matchAll(/<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
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

function headerIndex(headers, name) {
  return headers.findIndex((h) => String(h).toLowerCase() === name.toLowerCase()
    || String(h).toLowerCase().includes(name.toLowerCase()));
}

function parseHybridScaling(text) {
  const m = String(text || '').match(/Uses\s+(\d+(?:\.\d+)?)\s*%\s*ATK\s+and\s+(\d+(?:\.\d+)?)\s*%\s*MATK/i);
  if (!m) return null;
  return { ATK: Number(m[1]) / 100, MATK: Number(m[2]) / 100 };
}

function parseLifesteal(text) {
  const m = String(text || '').match(/(?:Heal for |)(Minor|Major|Grand|Epic|Legendary)\s+Lifesteal/i);
  if (!m) return 0;
  return BUFF_TIER_PCT[m[1].toLowerCase()] || 0;
}

if (!WORKBOOK) {
  console.error('[sync-mutation-trees] master workbook not found');
  process.exit(1);
}

const rows = loadSheet(WORKBOOK, 'Ability Mutation Trees');
const headers = rows[0];
const col = (n) => headerIndex(headers, n);
const famI = col('Family ID');
const stageI = col('Mutation Stage');
const dispI = col('Display Text');
const utilI = col('Buff / Debuff / Utility');
const enI = col('EN Cost');
const apI = col('Ability Power');
const hitsI = col('Hit Count');
const cdI = col('Cooldown');
const ailI = col('Ailment / Rider');
const ailChI = col('Ailment Chance');
const nameI = col('Ability Name');
const dmgI = col('Damage Type');

const src = readFileSync(OUT, 'utf8');
const m = src.match(/skillTrees = Object\.freeze\(([\s\S]+)\);\s*\n/);
if (!m) throw new Error('Could not parse skill-trees.js');
const trees = eval('(' + m[1] + ')');

let updated = 0;
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const fam = row[famI];
  const stage = row[stageI] || '1';
  if (!fam) continue;
  const id = `${fam}_S${stage}`;
  const entry = trees[id];
  if (!entry) continue;

  const display = row[dispI] || '';
  const utility = row[utilI] || '';
  const merged = `${display}\n${utility}`;
  const shortDesc = display.replace(/\r\n|\n/g, ' ').trim().slice(0, 240);

  entry.displayText = display;
  entry.shortDesc = shortDesc;
  if (utility) entry.riderText = utility;
  if (row[enI]) entry.apCost = entry.enCost = Number(row[enI]) || entry.apCost;
  if (row[apI]) entry.abilityPower = Number(row[apI]) || entry.abilityPower;
  if (row[hitsI]) entry.hits = entry.hitCount = Number(row[hitsI]) || entry.hits;
  if (row[cdI] && /^\d/.test(row[cdI])) entry.cooldown = Number(row[cdI]) || 0;
  if (row[ailI]) entry.ailment = row[ailI].toLowerCase().includes('blind') ? 'blinded'
    : row[ailI].toLowerCase().includes('burn') ? 'burning'
      : row[ailI].toLowerCase().includes('bleed') ? 'bleed'
        : row[ailI].toLowerCase().includes('poison') ? 'poison'
          : row[ailI].toLowerCase().includes('chill') ? 'chilled'
            : row[ailI].toLowerCase().includes('delay') ? 'delayed'
              : row[ailI].toLowerCase().includes('weaken') ? 'weaken'
                : entry.ailment;
  if (row[ailChI]) entry.ailmentChance = Number(String(row[ailChI]).replace('%', '')) || entry.ailmentChance;
  if (row[nameI]) entry.name = row[nameI];

  const hs = parseHybridScaling(merged);
  if (hs) entry.hybridScaling = hs;
  entry.hybridPerHit = /First hit uses ATK,\s*second uses MATK/i.test(merged);
  const ls = parseLifesteal(merged);
  if (ls > 0) entry.lifestealPct = ls;

  if (String(row[dmgI] || '').toLowerCase() === 'hybrid') {
    entry.category = 'hybrid';
    entry.damageStat = 'HYBRID';
    entry.damageType = 'Hybrid';
    entry.scaleStat = 'HYBRID';
  }

  updated++;
}

const body = `/* GENERATED — synced from Master workbook Ability Mutation Trees */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);
  Avian.data.combatPack.skillTrees = Object.freeze(${JSON.stringify(trees)});
})();
`;
writeFileSync(OUT, body, 'utf8');
console.log(`[sync-mutation-trees] updated ${updated} abilities from ${path.basename(WORKBOOK)}`);
