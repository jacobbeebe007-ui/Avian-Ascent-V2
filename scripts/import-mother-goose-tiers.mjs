#!/usr/bin/env node
/*
 * Import Mother Goose Tiers sheet → js/data/mother-goose-species-tiers.js
 *
 *   node scripts/import-mother-goose-tiers.mjs
 *   node scripts/build-bundle.js
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEW_SHEETS = 'c:\\Users\\JaK_d\\Desktop\\Avian Ascent\\New Sheets';
const MASTER_XLSX_NAME = 'Master Bird List - New Stats - Boss Tiers - Titles - Passives and Perks - Gatcha Tiers.xlsx';
const MASTER_XLSX_CANDIDATES = [
  path.join(NEW_SHEETS, 'Main', MASTER_XLSX_NAME),
  path.join(NEW_SHEETS, MASTER_XLSX_NAME),
];
const MASTER_XLSX = process.env.AA_MASTER_BIRD_XLSX
  || MASTER_XLSX_CANDIDATES.find((p) => existsSync(p))
  || MASTER_XLSX_CANDIDATES[0];
const OUT = path.join(ROOT, 'js', 'data', 'mother-goose-species-tiers.js');

const BIRD_NAME_TO_KEY = {
  'Sparrow': 'sparrow', 'Goose': 'goose', 'Blackbird': 'blackbird', 'Crow': 'crow', 'Magpie': 'magpie',
  'Hummingbird': 'hummingbird', 'Robin': 'robin', 'Peregrine Falcon': 'peregrine', 'Peregrine': 'peregrine',
  'Kiwi': 'kiwi', 'Snowy Owl': 'snowyOwl', 'Macaw': 'macaw', 'Lyrebird': 'lyrebird', 'Black Cockatoo': 'blackCockatoo',
  'Kookaburra': 'kookaburra', 'Raven': 'raven', 'Bowerbird': 'bowerbird', 'Toucan': 'toucan', 'Swan': 'swan',
  'Flamingo': 'flamingo', 'Secretary Bird': 'secretary', 'Secretary': 'secretary', 'Albatross': 'albatross',
  'Seagull': 'seagull', 'Shoebill': 'shoebill', 'Shoebill Stork': 'shoebill', 'Harpy Eagle': 'harpy', 'Harpy': 'harpy',
  'Bald Eagle': 'baldEagle', 'Emperor Penguin': 'penguin', 'Penguin': 'penguin', 'Ostrich': 'ostrich',
  'Cassowary': 'cassowary', 'Emu': 'emu', 'Duke Blakiston': 'dukeBlakiston', 'Wren': 'wren',
  'Superb Fairywren': 'fairywren', 'Fairywren': 'fairywren', 'Firecrest': 'firecrest', 'Willie Wagtail': 'wagtail',
  'Wagtail': 'wagtail', 'Galah': 'galah', 'Blue Jay': 'bluejay', 'Bluejay': 'bluejay', 'Cardinal': 'cardinal',
  'Bush Turkey': 'bushturkey', 'Bushturkey': 'bushturkey', 'Vulture': 'vulture', 'Barn Owl': 'barnowl', 'Barnowl': 'barnowl',
  'Bustard': 'bustard', 'Golden Eagle': 'goldeneagle', 'Australian Pelican': 'pelican', 'Pelican': 'pelican',
  'Marabou Stork': 'marabou', 'Marabou': 'marabou',
  'Chickadee': 'chickadee', 'Dodo': 'dodo', 'Dove': 'dove', 'Finch': 'finch', 'Kakapo': 'kakapo',
  'Pigeon': 'pigeon', 'Rock Dove': 'rockDove', 'Rock Pigeon': 'rockPigeon',
};

const SPECIES_TIER_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
const GLEAMING_WEIGHT_BY_SPECIES_TIER = {
  grey: 5,
  green: 10,
  blue: 18,
  purple: 28,
  gold: 40,
  orange: 0,
};

const EGG_POOL_PATTERNS = [
  { id: 'cracked', re: /cracked\s*egg/i },
  { id: 'feathered', re: /feathered\s*egg/i },
  { id: 'gleaming', re: /gleaming\s*egg/i },
  { id: 'royal', re: /royal\s*egg/i },
  { id: 'ancestral', re: /ancestral\s*egg/i },
];

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

const decodeEntities = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
function colNumFromRef(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    out.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeEntities(x[1])).join(''));
  }
  return out;
}
function parseSheet(xml, sharedStrings) {
  const rows = [];
  for (const m of xml.matchAll(/<(?:x:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g)) {
    const rNum = parseInt(m[1], 10);
    const inner = m[2];
    const cells = [];
    for (const cm of inner.matchAll(/<(?:x:)?c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g)) {
      const attrs = cm[1] || cm[3];
      const body = cm[2] || cm[4] || '';
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const tM = /t="([^"]+)"/.exec(attrs);
      const t = tM ? tM[1] : '';
      const col = refM ? colNumFromRef(refM[1]) : cells.length + 1;
      let val = '';
      const vM = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body);
      if (t === 's' && vM) val = sharedStrings[parseInt(vM[1], 10)] || '';
      else if (t === 'str' && vM) val = decodeEntities(vM[1]);
      else if (t === 'inlineStr') {
        const isM = /<(?:x:)?is>([\s\S]*?)<\/(?:x:)?is>/.exec(body);
        if (isM) val = [...isM[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)].map((x) => decodeEntities(x[1])).join('');
      } else if (vM) val = decodeEntities(vM[1]);
      cells.push({ col, val: val == null ? '' : String(val) });
    }
    const max = cells.reduce((mx, c) => Math.max(mx, c.col), 0);
    const arr = new Array(max).fill('');
    cells.forEach((c) => { if (c.col >= 1) arr[c.col - 1] = c.val; });
    rows[rNum - 1] = arr;
  }
  return rows;
}
function readWorkbook(xlsxPath) {
  const entries = readZipEntries(xlsxPath);
  const wbRels = entries['xl/_rels/workbook.xml.rels'] || '';
  const sharedStrings = entries['xl/sharedStrings.xml'] ? parseSharedStrings(entries['xl/sharedStrings.xml']) : [];
  const relMap = Object.create(null);
  for (const rm of wbRels.matchAll(/<Relationship[^>]+>/g)) {
    const attrs = rm[0];
    const id = /Id="([^"]+)"/.exec(attrs)?.[1];
    const target = /Target="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) relMap[id] = target.replace(/^\/+/, '');
  }
  const sheets = Object.create(null);
  const wb = entries['xl/workbook.xml'];
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    const target = relMap[m[2]];
    if (!target) continue;
    const key = target.startsWith('xl/') ? target : ('xl/' + target.replace(/^\/+/, ''));
    const sheetXml = entries[key];
    if (sheetXml) sheets[decodeEntities(m[1])] = parseSheet(sheetXml, sharedStrings);
  }
  return sheets;
}

function headerToIndexMap(headerRow) {
  const map = Object.create(null);
  headerRow.forEach((name, i) => { if (name) map[String(name).trim()] = i; });
  return map;
}

function normalizeSpeciesTier(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return SPECIES_TIER_ORDER.includes(t) ? t : 'grey';
}

function parseEggPools(guidance) {
  const text = String(guidance || '');
  const out = [];
  for (const pat of EGG_POOL_PATTERNS) {
    if (pat.re.test(text)) out.push(pat.id);
  }
  return out;
}

function isStarterFlag(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function buildSpeciesTiers(sheets) {
  const rows = sheets['Mother Goose Tiers'];
  if (!rows || !rows.length) throw new Error('Missing "Mother Goose Tiers" sheet');

  const headerRow = rows[12] || [];
  const header = headerToIndexMap(headerRow);
  const colBird = header['Bird Name'];
  const colTier = header['Mother Goose Species Tier'];
  const colEggs = header['Egg Pool Guidance'];
  const colStarter = header['Starter Bird?'];
  if (colBird == null || colTier == null || colEggs == null) {
    throw new Error('Mother Goose Tiers: missing required columns (Bird Name, Mother Goose Species Tier, Egg Pool Guidance)');
  }

  const byBirdKey = Object.create(null);
  const starterBirdKeys = [];

  for (let i = 13; i < rows.length; i++) {
    const row = rows[i] || [];
    const birdName = String(row[colBird] || '').trim();
    if (!birdName) continue;

    const birdKey = BIRD_NAME_TO_KEY[birdName];
    if (!birdKey) throw new Error('No birdKey mapping for: ' + birdName);

    const eggPools = parseEggPools(row[colEggs]);
    if (!eggPools.length) throw new Error('No egg pools for: ' + birdName);

    const starterBird = colStarter != null && isStarterFlag(row[colStarter]);
    if (starterBird) starterBirdKeys.push(birdKey);

    byBirdKey[birdKey] = {
      birdName,
      speciesTier: normalizeSpeciesTier(row[colTier]),
      eggPools,
      starterBird,
    };
  }

  if (!Object.keys(byBirdKey).length) throw new Error('No birds parsed from Mother Goose Tiers');
  if (starterBirdKeys.length !== 5) {
    console.warn('[mother-goose-tiers] expected 5 starter birds, got', starterBirdKeys.length, starterBirdKeys);
  }

  return {
    byBirdKey,
    starterBirdKeys,
    speciesTierOrder: SPECIES_TIER_ORDER,
    gleamingWeightBySpeciesTier: GLEAMING_WEIGHT_BY_SPECIES_TIER,
  };
}

function emitJs(payload) {
  const json = JSON.stringify(payload, null, 2);
  return `/* GENERATED by scripts/import-mother-goose-tiers.mjs — do not edit by hand. */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.motherGooseSpeciesTiers = Object.freeze(${json});
})();
`;
}

function main() {
  if (!existsSync(MASTER_XLSX)) {
    console.error('[mother-goose-tiers] missing:', MASTER_XLSX);
    process.exit(1);
  }
  console.log('[mother-goose-tiers] reading:', MASTER_XLSX);
  const sheets = readWorkbook(MASTER_XLSX);
  const payload = buildSpeciesTiers(sheets);
  console.log('[mother-goose-tiers] birds:', Object.keys(payload.byBirdKey).length);
  console.log('[mother-goose-tiers] starters:', payload.starterBirdKeys.join(', '));
  writeFileSync(OUT, emitJs(payload), 'utf8');
  console.log('[mother-goose-tiers] wrote:', OUT);
}

main();
