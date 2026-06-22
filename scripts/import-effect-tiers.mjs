#!/usr/bin/env node
/*
 * Import Effect Tiers.xlsx → js/data/effect-tiers.js
 *   node scripts/import-effect-tiers.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOWNLOADS_WORKBOOK = path.join(
  process.env.HOME || '',
  'Downloads',
  'Avian Music bites',
  'Avian Workbooks',
  'Effect Tiers.xlsx',
);
const EFFECT_TIERS_XLSX = process.env.AA_EFFECT_TIERS_XLSX || DOWNLOADS_WORKBOOK;
const OUT = path.join(ROOT, 'js', 'data', 'effect-tiers.js');

function readZipEntries(zipPath) {
  const buf = readFileSync(zipPath);
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('EOCD not found in ' + zipPath);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = Object.create(null);
  let p = cdOffset;
  const end = cdOffset + cdSize;
  while (p < end) {
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
    let data;
    if (compMethod === 0) data = cdata;
    else if (compMethod === 8) data = zlib.inflateRawSync(cdata);
    else throw new Error('Unsupported compression ' + compMethod);
    entries[name] = data.toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function colLetters(ref) {
  const m = String(ref).match(/^([A-Z]+)/);
  return m ? m[1] : 'A';
}

function colIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

function parseSheet(sheetXml, sharedStrings) {
  const rows = [];
  const rowRe = /<(?:x:)?row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  let rm;
  while ((rm = rowRe.exec(sheetXml))) {
    const cells = [];
    const cellRe = /<(?:x:)?c\b([^>]*)>(?:<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>)?/g;
    let cm;
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1];
      const refM = attrs.match(/\br="([^"]+)"/);
      const ref = refM ? refM[1] : '';
      const idx = colIndex(colLetters(ref));
      const tM = attrs.match(/\bt="([^"]+)"/);
      let val = cm[2] != null ? cm[2] : '';
      if (tM && tM[1] === 's') val = sharedStrings[Number(val)] || '';
      cells[idx] = decodeEntities(val.trim());
    }
    const dense = [];
    for (let i = 0; i < cells.length; i++) dense[i] = cells[i] || '';
    while (dense.length && !dense[dense.length - 1]) dense.pop();
    if (dense.some(Boolean)) rows.push(dense);
  }
  return rows;
}

function loadWorkbook(xlsxPath) {
  const entries = readZipEntries(xlsxPath);
  const ssXml = entries['xl/sharedStrings.xml'] || '<sst/>';
  const sharedStrings = [];
  for (const m of ssXml.matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)) {
    const texts = [];
    for (const t of m[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)) texts.push(decodeEntities(t[1]));
    sharedStrings.push(texts.join(''));
  }
  const wb = entries['xl/workbook.xml'];
  const rels = entries['xl/_rels/workbook.xml.rels'];
  const ridMap = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)) {
    ridMap[m[1]] = m[2].replace(/^\//, '');
  }
  let sheetXml = null;
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    const target = 'xl/' + ridMap[m[2]];
    sheetXml = entries[target];
    break;
  }
  if (!sheetXml) throw new Error('No sheet in ' + xlsxPath);
  return parseSheet(sheetXml, sharedStrings);
}

function parseEffectTiers(rows) {
  const buff = Object.create(null);
  const debuff = Object.create(null);
  const ailmentChance = Object.create(null);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const category = String(row[0] || '').trim();
    const tier = String(row[1] || '').trim().toLowerCase();
    const backend = String(row[2] || '').trim();
    if (!tier || !backend) continue;
    const numM = backend.match(/-?\d+(?:\.\d+)?/);
    if (!numM) continue;
    const val = Math.abs(Number(numM[0]));
    if (/debuff|negative|down/i.test(category)) {
      debuff[tier.replace(/\s+/g, '')] = val;
    } else if (/ailment/i.test(category)) {
      ailmentChance[tier.replace(/\s+/g, '')] = val;
    } else if (/buff|positive|up/i.test(category)) {
      buff[tier.replace(/\s+/g, '')] = val;
    }
  }
  return { buff, debuff, ailmentChance };
}

function main() {
  if (!existsSync(EFFECT_TIERS_XLSX)) {
    console.error('[import-effect-tiers] Missing workbook:', EFFECT_TIERS_XLSX);
    process.exit(1);
  }
  const rows = loadWorkbook(EFFECT_TIERS_XLSX);
  const tiers = parseEffectTiers(rows);
  const body = `/* GENERATED effect tiers — ${path.basename(EFFECT_TIERS_XLSX)} */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.effectTiers = Object.freeze(${JSON.stringify(tiers)});
})();`;
  writeFileSync(OUT, body + '\n', 'utf8');
  console.log('[import-effect-tiers] wrote', OUT);
}

main();
