#!/usr/bin/env node
/*
 * Avian Ascent — Mutations / Equipment Importer
 *
 * Reads avian_ascent_expanded_tiered_item_list.xlsx and emits js/data/mutations/*
 *
 *   node scripts/import-mutations-content.mjs [--verify]
 *
 * Env: AA_MUTATIONS_XLSX (path to spreadsheet)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_XLSX = path.join(homedir(), 'Downloads', 'avian_ascent_expanded_tiered_item_list.xlsx');
const MUTATIONS_XLSX = process.env.AA_MUTATIONS_XLSX || DEFAULT_XLSX;
const OUTPUT_DIR = path.join(ROOT, 'js', 'data', 'mutations');

const SLOT_LIMITS = Object.freeze({
  wing: 2, feet: 2, head: 1, beak: 1, chest: 1,
  eyes: 1, tail: 1, plumage: 1, syrinx: 1,
});

const STAT_MAP = {
  Health: 'maxHp',
  Attack: 'atk',
  'Attack Base': 'atk',
  Defence: 'def',
  Speed: 'spd',
  Dodge: 'dodge',
  'Magic Attack': 'matk',
  'Magic Attack Base': 'matk',
  'Magic Defence': 'mdef',
  'Crit Chance': 'critChance',
  'Light Attack Damage': 'lightAttackDmgPct',
  'Medium Attack Damage': 'mediumAttackDmgPct',
  'Heavy Attack Damage': 'heavyAttackDmgPct',
  'DEF Penetration': 'defPenPct',
  'Physical Ailment Chance': 'physicalAilmentChance',
  'Magic Ailment Chance': 'magicAilmentChance',
};

const TIER_KEYS = ['white', 'green', 'blue', 'purple', 'gold'];

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

const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&amp;/g, '&');

function colNumFromRef(ref) {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseSharedStrings(xml) {
  const out = [];
  const reSi = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = reSi.exec(xml)) !== null) {
    const parts = [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => decodeEntities(x[1]));
    out.push(parts.join(''));
  }
  return out;
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowRe = /<(?:x:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  let m;
  while ((m = rowRe.exec(xml)) !== null) {
    const rNum = parseInt(m[1], 10);
    const inner = m[2];
    const cells = [];
    const cellRe = /<(?:x:)?c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const attrs = cm[1];
      const body = cm[2] || '';
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const tM = /t="([^"]+)"/.exec(attrs);
      const t = tM ? tM[1] : '';
      const col = refM ? colNumFromRef(refM[1]) : cells.length + 1;
      let val = '';
      const vM = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body);
      if (t === 's' && vM) val = sharedStrings[parseInt(vM[1], 10)] || '';
      else if (vM) val = decodeEntities(vM[1]);
      cells.push({ col, val: val == null ? '' : String(val) });
    }
    const max = cells.reduce((mx, c) => Math.max(mx, c.col), 0);
    const arr = new Array(max).fill('');
    cells.forEach((c) => { if (c.col >= 1 && c.col <= max) arr[c.col - 1] = c.val; });
    rows[rNum - 1] = arr;
  }
  return rows.filter(Boolean);
}

function readWorkbook(xlsxPath) {
  const entries = readZipEntries(xlsxPath);
  const wb = entries['xl/workbook.xml'];
  const wbRels = entries['xl/_rels/workbook.xml.rels'] || '';
  const sharedStrings = entries['xl/sharedStrings.xml'] ? parseSharedStrings(entries['xl/sharedStrings.xml']) : [];
  const relMap = Object.create(null);
  for (const rm of wbRels.matchAll(/<Relationship\s+([^>]+?)\s*\/>/g)) {
    const attrs = rm[1];
    const id = /(?:^|\s)Id="([^"]+)"/.exec(attrs)?.[1];
    const target = /(?:^|\s)Target="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) relMap[id] = target.replace(/^\/+/, '');
  }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\s+name="([^"]+)"\s+sheetId="(\d+)"\s+r:id="([^"]+)"/g)) {
    const name = decodeEntities(m[1]);
    const target = relMap[m[3]];
    if (!target) continue;
    const key = target.startsWith('xl/') ? target : 'xl/' + target;
    if (entries[key]) sheets[name] = parseSheet(entries[key], sharedStrings);
  }
  return sheets;
}

function headerToIndexMap(headerRow) {
  const map = Object.create(null);
  headerRow.forEach((name, i) => { if (name) map[String(name).trim()] = i; });
  return map;
}
function get(row, header, name) {
  const i = header[name];
  return i == null ? '' : String(row[i] || '').trim();
}
function asNum(s) {
  if (!s) return 0;
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

function normSlot(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s || 'wing';
}

function normTier(raw) {
  return String(raw || 'white').trim().toLowerCase();
}

function addStatRoll(stats, statName, roll, unit) {
  if (!statName || !roll) return;
  const key = STAT_MAP[statName];
  if (!key) return;
  const n = asNum(roll);
  if (!n) return;
  if (unit === '%' || String(unit).includes('%')) {
    stats[key] = (stats[key] || 0) + n;
  } else {
    stats[key] = (stats[key] || 0) + n;
  }
}

function parseDamageBonus(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(/([+-]?\d+(?:\.\d+)?)\s*%?\s*(Light|Medium|Heavy|Magic|Spell)?/i);
  if (!m) return null;
  return { tag: (m[2] || 'generic').toLowerCase(), pct: Math.abs(Number(m[1])) };
}

function parseItemRow(row, header) {
  const id = get(row, header, 'Item ID');
  if (!id) return null;
  const tier = normTier(get(row, header, 'Tier'));
  const slot = normSlot(get(row, header, 'Slot'));
  const stats = Object.create(null);
  const mechanics = Object.create(null);

  addStatRoll(stats, get(row, header, 'Primary Stat'), get(row, header, 'Primary Roll'), get(row, header, 'Primary Unit'));
  addStatRoll(stats, get(row, header, 'Secondary Stat'), get(row, header, 'Secondary Roll'), get(row, header, 'Secondary Unit'));
  addStatRoll(stats, get(row, header, 'Tertiary Stat'), get(row, header, 'Tertiary Roll'), get(row, header, 'Tertiary Unit'));

  const tradeStat = get(row, header, 'Trade-off Stat');
  const tradeRoll = get(row, header, 'Trade-off Roll');
  if (tradeStat && tradeRoll) {
    const tk = STAT_MAP[tradeStat];
    if (tk) stats[tk] = (stats[tk] || 0) - Math.abs(asNum(tradeRoll));
  }

  const atkBoost = get(row, header, 'Attack Boost');
  if (atkBoost) {
    const db = parseDamageBonus(atkBoost);
    if (db) mechanics.damageBonus = db;
  }
  const dmgBonus = get(row, header, 'Damage Bonus');
  if (dmgBonus) {
    const db = parseDamageBonus(dmgBonus);
    if (db) mechanics.damageBonus = db;
  }
  const penBonus = get(row, header, 'Penetration Bonus');
  if (penBonus) mechanics.piercePct = asNum(penBonus);
  const penTarget = get(row, header, 'Penetration Target') || get(row, header, 'Penetration Bonus');
  if (penTarget && !mechanics.piercePct) mechanics.piercePct = asNum(penTarget);

  const physAil = get(row, header, 'Physical Ailment');
  const physAilCh = get(row, header, 'Physical Ailment Chance');
  if (physAil) mechanics.physicalAilment = { id: physAil, chance: asNum(physAilCh) };
  const magAil = get(row, header, 'Magic Ailment');
  const magAilCh = get(row, header, 'Magic Ailment Chance');
  if (magAil) mechanics.magicAilment = { id: magAil, chance: asNum(magAilCh) };

  const tagsRaw = get(row, header, 'Build Tags');
  const buildTags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

  const item = {
    id,
    tier,
    name: get(row, header, 'Item Name'),
    slot,
    slotLimit: SLOT_LIMITS[slot] || 1,
    category: get(row, header, 'Category').toLowerCase() || 'hybrid',
    itemClass: get(row, header, 'Item Class'),
    stats,
    statLine: get(row, header, 'Stat Line') || get(row, header, 'Use Case / Balance Note'),
    buildTags,
  };
  if (Object.keys(mechanics).length) item.mechanics = mechanics;
  return item;
}

function buildDropWeights(tierRows) {
  const out = Object.create(null);
  for (const row of tierRows.slice(1)) {
    if (!row || !row[0]) continue;
    const tier = normTier(row[0]);
    const weight = asNum(row[2]);
    if (tier && weight) out[tier] = weight;
  }
  return out;
}

function jsHeader(name, note) {
  return `/* Avian Ascent — ${name}\n * ${note}\n * Generated by scripts/import-mutations-content.mjs — do not edit by hand.\n */\n(function(){'use strict';\n`;
}
function jsFooter(varName, obj) {
  return `globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);Avian.data.mutations=Avian.data.mutations||Object.create(null);Avian.data.mutations.${varName}=Object.freeze(${JSON.stringify(obj)});\n})();\n`;
}

function emitFile(filename, content) {
  const fp = path.join(OUTPUT_DIR, filename);
  writeFileSync(fp, content, 'utf8');
  return content.length;
}

function main() {
  if (!existsSync(MUTATIONS_XLSX)) {
    console.error('[mutations-importer] missing xlsx:', MUTATIONS_XLSX);
    process.exit(1);
  }
  console.log('[mutations-importer] reading', MUTATIONS_XLSX);
  const sheets = readWorkbook(MUTATIONS_XLSX);
  const allItems = sheets['All Items'];
  if (!allItems || allItems.length < 2) {
    console.error('[mutations-importer] All Items sheet missing or empty');
    process.exit(1);
  }
  const header = headerToIndexMap(allItems[0]);
  const byTier = Object.fromEntries(TIER_KEYS.map((t) => [t, Object.create(null)]));
  const byId = Object.create(null);
  let count = 0;
  for (let i = 1; i < allItems.length; i++) {
    const item = parseItemRow(allItems[i], header);
    if (!item) continue;
    byId[item.id] = item;
    byTier[item.tier][item.id] = item;
    count++;
  }
  const dropWeights = buildDropWeights(sheets['Tier Ranges'] || []);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalBytes = 0;
  totalBytes += emitFile('slots.js',
    jsHeader('slots.js', 'Equipment slot definitions and limits.') +
    jsFooter('slots', { limits: SLOT_LIMITS, order: ['wing', 'feet', 'head', 'beak', 'chest', 'eyes', 'tail', 'plumage', 'syrinx'] }) +
    ''
  );

  for (const tier of TIER_KEYS) {
    const n = Object.keys(byTier[tier]).length;
    totalBytes += emitFile(`items-${tier}.js`,
      jsHeader(`items-${tier}.js`, `${n} ${tier}-tier mutation items.`) +
      jsFooter(`items_${tier}`, byTier[tier])
    );
    console.log(`[mutations-importer] ${tier}: ${n} items`);
  }

  totalBytes += emitFile('index.js',
    jsHeader('index.js', 'Mutations catalog index — byId lookup and drop weights.') +
    `var Avian=globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);\nvar m=Avian.data.mutations=Avian.data.mutations||Object.create(null);\nvar byId=Object.create(null);\n` +
    TIER_KEYS.map((t) => `if(m.items_${t}){for(var k in m.items_${t})byId[k]=m.items_${t}[k];}`).join('\n') +
    `\nm.byId=Object.freeze(byId);\nm.dropWeights=Object.freeze(${JSON.stringify(dropWeights)});\nm.version='2026.05-mutations-v1';\n})();\n`
  );

  console.log(`[mutations-importer] ${count} items, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB written to ${OUTPUT_DIR}`);
  if (process.argv.includes('--verify') && count < 3000) process.exit(2);
}

main();
