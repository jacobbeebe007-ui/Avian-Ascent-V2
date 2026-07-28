#!/usr/bin/env node
/*
 * Import Avian Ascent Equipment System v1.2 (Restoration Cooldowns) standalone workbook
 * into js/data/equipment/* without overwriting v0.9 bird base stats / combat-pack.
 *
 * Source: Avian_Ascent_Equipment_System_v1.2_Restoration_Cooldowns.xlsx
 * Override: AA_EQUIPMENT_WORKBOOK=/path/to/workbook.xlsx
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_WORKBOOK = path.join(ROOT, 'Avian_Ascent_Equipment_System_v1.2_Restoration_Cooldowns.xlsx');
const WORKBOOK = process.env.AA_EQUIPMENT_WORKBOOK || DEFAULT_WORKBOOK;
const PACK_VERSION = '2026.07-equipment-v1.2-restoration';

const RARITY_RANK = { grey: 1, green: 2, blue: 3, purple: 4, gold: 5, orange: 6 };
const CLASS_IDS = ['knight', 'rogue', 'mage', 'siren', 'inquisitor', 'bard', 'brute'];

/* ------------------------------------------------------------------ *
 * XLSX reader (handles x: namespace + t="str" inline values)            *
 * ------------------------------------------------------------------ */

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
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
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

function parseSheet(sheetXml) {
  const rows = Object.create(null);
  const rowRe = /<(?:x:)?row\b([^>]*)>([\s\S]*?)<\/(?:x:)?row>/g;
  let rm;
  while ((rm = rowRe.exec(sheetXml))) {
    const rM = rm[1].match(/\br="(\d+)"/);
    const rowNum = rM ? Number(rM[1]) : 0;
    const cells = [];
    const cellRe = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1];
      const inner = cm[2] || '';
      const refM = attrs.match(/\br="([^"]+)"/);
      const idx = colIndex(colLetters(refM ? refM[1] : 'A'));
      const tM = attrs.match(/\bt="([^"]+)"/);
      let val = '';
      if (tM && tM[1] === 'inlineStr') {
        const t = inner.match(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/);
        val = t ? t[1] : '';
      } else {
        const v = inner.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/);
        val = v ? v[1] : '';
      }
      cells[idx] = decodeEntities(String(val).trim());
    }
    const dense = [];
    for (let i = 0; i < cells.length; i++) dense[i] = cells[i] ?? '';
    rows[rowNum] = dense;
  }
  return rows;
}

function loadWorkbookSheets(zipPath) {
  const entries = readZipEntries(zipPath);
  const wb = entries['xl/workbook.xml'];
  const sheetMetas = [...wb.matchAll(/<(?:x:)?sheet\b([^>]*?)\/>/g)].map((m) => {
    const attrs = m[1];
    return {
      name: decodeEntities(attrs.match(/name="([^"]+)"/)[1]),
      rid: attrs.match(/r:id="([^"]+)"/)[1],
    };
  });
  const rels = entries['xl/_rels/workbook.xml.rels'];
  const ridToTarget = Object.create(null);
  for (const m of rels.matchAll(/<(?:Relationship)\b([^>]*?)\/>/g)) {
    const attrs = m[1];
    const id = attrs.match(/\bId="([^"]+)"/)[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)[1].replace(/^\//, '');
    ridToTarget[id] = target;
  }
  const sheets = Object.create(null);
  for (const meta of sheetMetas) {
    const target = ridToTarget[meta.rid];
    if (!target || !entries[target]) throw new Error('Missing sheet path for ' + meta.name);
    sheets[meta.name] = parseSheet(entries[target]);
  }
  return sheets;
}

function headerIndex(headerRow) {
  const map = Object.create(null);
  for (let i = 0; i < headerRow.length; i++) {
    const key = String(headerRow[i] || '').trim();
    if (key) map[key] = i;
  }
  return map;
}

function cell(row, idx, key) {
  const i = idx[key];
  return i == null ? '' : (row[i] ?? '');
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function rarityKey(v) {
  return String(v || '').trim().toLowerCase();
}

function scalingStatCode(label) {
  const s = String(label || '').trim().toLowerCase();
  if (s === 'might' || s === 'atk' || s === 'strength') return 'ATK';
  if (s === 'dexterity' || s === 'dex' || s === 'finesse') return 'DEX';
  if (s === 'focus' || s === 'matk' || s === 'magic') return 'MATK';
  if (s === 'guard' || s === 'def') return 'DEF';
  if (s === 'resolve' || s === 'mdef') return 'MDEF';
  if (s === 'vitality' || s === 'hp') return 'HP';
  if (s === 'agility' || s === 'spd') return 'SPD';
  return null;
}

function damageTypeFromCategory(cat) {
  const c = String(cat || '').toLowerCase();
  if (c.includes('magic')) return 'Magic';
  return 'Physical';
}

function parseClassRestriction(text) {
  const t = String(text || '').trim();
  if (!t || /^any$/i.test(t)) return 'Any';
  const lower = t.toLowerCase();
  const found = [];
  for (const c of CLASS_IDS) {
    if (lower.includes(c)) found.push(c[0].toUpperCase() + c.slice(1));
  }
  if (/rogue only/i.test(t)) return 'Rogue';
  if (/bard only/i.test(t)) return 'Bard';
  if (!found.length) return t;
  return found.join(' / ');
}

function classListFromText(text) {
  const t = String(text || '').toLowerCase();
  const out = [];
  for (const c of CLASS_IDS) {
    if (t.includes(c)) out.push(c);
  }
  if (/rogue only/.test(t)) return ['rogue'];
  if (/bard only/.test(t)) return ['bard'];
  return out;
}

function skillIdFromName(name, prefix) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
  return prefix + '_' + slug;
}

function parseProtectionRiders(effectText) {
  const text = String(effectText || '');
  const riders = [];

  /* Dual Bastion/Aegis — allow parentheticals between Fortify and Ward amounts. */
  const dual = text.match(
    /Gain\s+(\d+)\s+Fortified Armour(?:\s*\([^)]*\))?\s*(?:,?\s*and|,)\s*(\d+)\s+Ward(?:\s+Magic)?\s*Armour/i,
  );
  if (dual) {
    const turnsM = text.match(/for\s+(\d+)\s+turns?/i);
    riders.push({
      kind: 'bastion',
      armour: Number(dual[1]),
      magicArmour: Number(dual[2]),
      turns: turnsM ? Number(turnsM[1]) : 2,
      value: Number(dual[1]),
    });
    return riders;
  }

  const fortify = text.match(/Gain\s+(\d+)\s+Fortified Armour/i);
  if (fortify) {
    const turnsM = text.match(/for\s+(\d+)\s+turns?/i);
    riders.push({ kind: 'fortify', value: Number(fortify[1]), turns: turnsM ? Number(turnsM[1]) : 2 });
  }
  const ward = text.match(/Gain\s+(\d+)\s+Ward(?:\s+Magic)?\s*Armour/i)
    || text.match(/(?:^|[^\w])(?:and|,)\s*(\d+)\s+Ward(?:\s+Magic)?\s*Armour/i);
  if (ward) {
    const turnsM = text.match(/for\s+(\d+)\s+turns?/i);
    riders.push({ kind: 'ward', value: Number(ward[1]), turns: turnsM ? Number(turnsM[1]) : 2 });
  }

  const restoreBoth = text.match(/Restore\s+(\d+)\s+Armour\s+and\s+(\d+)\s+Magic Armour/i);
  if (restoreBoth) {
    riders.push({ kind: 'restoreArmour', value: Number(restoreBoth[1]) });
    riders.push({ kind: 'restoreMagicArmour', value: Number(restoreBoth[2]) });
  } else {
    /* Allow "Restore N Armour and gain …" — do not require !(and). */
    const restoreArm = text.match(/Restore\s+(\d+)\s+Armour(?!\s+and\s+\d+\s+Magic)/i);
    if (restoreArm && !/Fortified Armour/i.test(text.slice(
      Math.max(0, text.search(/Restore\s+\d+\s+Armour/i) - 20),
      text.search(/Restore\s+\d+\s+Armour/i) + 40,
    ))) {
      riders.push({ kind: 'restoreArmour', value: Number(restoreArm[1]) });
    }
    const restoreMag = text.match(/Restore\s+(\d+)\s+Magic Armour/i);
    if (restoreMag) riders.push({ kind: 'restoreMagicArmour', value: Number(restoreMag[1]) });
  }

  const lowerPool = text.match(/Restore\s+(\d+)\s+to\s+(?:whichever|the)\s+(?:protection\s+)?pool(?:\s+is)?(?:\s+currently)?\s+lower/i)
    || text.match(/Restore\s+(\d+)\s+to\s+the\s+lower\s+protection\s+pool/i);
  if (lowerPool) {
    riders.push({ kind: 'restoreLowerPool', value: Number(lowerPool[1]) });
  }

  return riders;
}

function normalizeAilmentId(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  if (/^bleed/.test(s)) return 'bleed';
  if (/^burn|^scorch/.test(s)) return 'burning';
  if (/^poison|^toxic|^venom/.test(s)) return 'poison';
  if (/^chill|^frost|^frozen/.test(s)) return 'chilled';
  if (/^shock|^paralys|^paraly/.test(s)) return 'paralyzed';
  if (/^weaken/.test(s)) return 'weakened';
  return s;
}

/** Parse Full Effect text for ailment rolls used by the combat dispatcher. */
function parseAilmentRoll(effectText) {
  const text = String(effectText || '');
  const out = Object.create(null);
  if (/both hits damage Health/i.test(text)) out.ailmentRequireBothHitsHealth = true;

  const guaranteed = text.match(/On hit,\s*apply\s+(\d+)\s+(Bleed|Burn|Scorched|Poison|Toxic|Chilled|Frost|Shock|Paralys(?:ed|ed)?|Weaken(?:ed)?)\s+stacks?/i);
  if (guaranteed) {
    out.ailment = normalizeAilmentId(guaranteed[2]);
    out.ailmentChance = 100;
    return out;
  }

  const orbChance = text.match(/(\d+(?:\.\d+)?)\s*%\s*chance to apply(?:\s+\d+\s+stacks?)?\s+(?:of\s+)?(?:the\s+)?Orb['’]?s\s+ailment/i);
  if (orbChance) {
    out.ailmentChance = Number(orbChance[1]) || 60;
    out.ailmentFromOrb = true;
    return out;
  }

  if (/roll the weapon['’]?s magical ailment chance/i.test(text)) {
    out.ailmentFromWeapon = true;
    out.ailmentChance = 50;
    return out;
  }

  const rollNamed = text.match(/(\d+(?:\.\d+)?)\s*%\s*chance to apply\s+(?:(\d+)\s+stacks?\s+of\s+)?(Bleed|Burn|Scorched|Poison|Toxic|Chilled|Frost|Shock|Paralys(?:ed|ed)?|Weaken(?:ed)?)\b/i);
  if (rollNamed) {
    out.ailment = normalizeAilmentId(rollNamed[3]);
    out.ailmentChance = Number(rollNamed[1]) || 0;
  }
  return out;
}

function hitsFromEffect(text) {
  const t = String(text || '');
  if (/strike twice|two hits|2 hits|hits twice/i.test(t)) return 2;
  if (/three hits|strike thrice|3 hits/i.test(t)) return 3;
  return 1;
}

function writeDataFile(relPath, namespaceExpr, data, note) {
  const abs = path.join(ROOT, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  const body = [
    `/* GENERATED by scripts/import-equipment-v12-workbook.mjs — do not edit by hand.`,
    ` * Source workbook: Equipment System v1.2 Restoration Cooldowns`,
    ` * Pack: ${PACK_VERSION}` + (note ? `\n * ${note}` : ''),
    ` */`,
    `(function () {`,
    `  'use strict';`,
    `  var Avian = globalThis.Avian || (globalThis.Avian = {});`,
    `  Avian.data = Avian.data || Object.create(null);`,
    `  Avian.data.equipment = Avian.data.equipment || Object.create(null);`,
    `  ${namespaceExpr} = Object.freeze(${JSON.stringify(data)});`,
    `})();`,
    ``,
  ];
  writeFileSync(abs, body.join('\n'));
  console.log('wrote', relPath);
}

/* ------------------------------------------------------------------ *
 * Import                                                              *
 * ------------------------------------------------------------------ */

if (!existsSync(WORKBOOK)) {
  console.error('Workbook not found:', WORKBOOK);
  process.exit(1);
}

const sheets = loadWorkbookSheets(WORKBOOK);
const need = [
  'Dashboard', 'Core Rules', 'Equipment Slots', 'Rarity & Budgets', 'Weapon Families',
  'Weapons Catalogue', 'Armour-Plumage', 'Helmets', 'Shields', 'Accessories',
  'Set Bonuses', 'Materials & Infusions', 'Ailment Gates', 'Unified Catalogue',
  'Skill Rules', 'Weapon Skill Library', 'Equipment Skill Library',
  'Fortify & Ward', 'Legacy Barrier Migration',
];
for (const n of need) {
  if (!sheets[n]) { console.error('Missing sheet:', n); process.exit(1); }
}

/* ---- Skills ---- */
const skills = Object.create(null);

/* Natural Strike variants retained from v0.9 (Beak Jab / Tail Wand). */
skills.BASIC_PHYSICAL = {
  id: 'BASIC_PHYSICAL',
  name: 'Beak Jab',
  source: 'Bird + Main Hand',
  family: 'Basic',
  barSlot: 'Basic Attack',
  skillType: 'Basic',
  en: 1,
  cooldown: 0,
  meter: 0,
  target: 'Enemy',
  damageType: 'Physical',
  damageCategory: 'Physical Strength',
  scalingStat: 'ATK',
  aspectRule: 'inherit',
  hits: 1,
  skillPowerPct: 0,
  skillPower: 0,
  naturalStrikeFlat: { min: 1, max: 2 },
  heavyAccuracyPenalty: 0,
  riderText: 'Natural Strike — flat 1–2 physical damage (no weapon scaling).',
  riders: [],
  minRarity: 'grey',
};
skills.BASIC_MAGIC = {
  id: 'BASIC_MAGIC',
  name: 'Tail Wand',
  source: 'Bird + Main Hand',
  family: 'Basic',
  barSlot: 'Basic Attack',
  skillType: 'Basic',
  en: 1,
  cooldown: 0,
  meter: 0,
  target: 'Enemy',
  damageType: 'Magic',
  damageCategory: 'Magical',
  scalingStat: 'MATK',
  aspectRule: 'inherit',
  hits: 1,
  skillPowerPct: 0,
  skillPower: 0,
  naturalStrikeFlat: { min: 1, max: 2 },
  heavyAccuracyPenalty: 0,
  riderText: 'Natural Strike — flat 1–2 magical damage (no weapon scaling).',
  riders: [],
  minRarity: 'grey',
};

const wskRows = sheets['Weapon Skill Library'];
const wskHeader = headerIndex(wskRows[4]);
const skillNameToId = Object.create(null);
for (const rn of Object.keys(wskRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = wskRows[rn];
  const id = cell(row, wskHeader, 'Skill ID');
  const name = cell(row, wskHeader, 'Skill Name');
  if (!id || !name) continue;
  const en = num(cell(row, wskHeader, 'EN'), 2);
  const cooldown = num(cell(row, wskHeader, 'Cooldown'), 0);
  const powerPct = num(cell(row, wskHeader, 'Skill Power %'), 0);
  const hits = hitsFromEffect(cell(row, wskHeader, 'Full Effect'));
  const perHit = hits > 1 && powerPct > 0 ? powerPct / hits : powerPct;
  const effect = cell(row, wskHeader, 'Full Effect');
  const riders = parseProtectionRiders(effect);
  const ailmentRoll = parseAilmentRoll(effect);
  const noDamage = powerPct <= 0 || /Zero Damage|Restoration|Fortify|Ward|Bastion|Aegis/i.test(cell(row, wskHeader, 'Skill Type')) && !/Deal\s+\d/i.test(effect);
  skills[id] = {
    id,
    name,
    source: 'Weapon',
    family: cell(row, wskHeader, 'Weapon Family'),
    barSlot: cell(row, wskHeader, 'Skill Slot') === 'Skill 2' ? 'Weapon Technique B' : 'Weapon Technique A',
    skillType: cell(row, wskHeader, 'Skill Type'),
    en,
    cooldown,
    meter: 0,
    target: noDamage && !/Deal\s+\d/i.test(effect) ? 'Self' : 'Enemy',
    damageType: damageTypeFromCategory(cell(row, wskHeader, 'Damage Category')),
    damageCategory: cell(row, wskHeader, 'Damage Category'),
    scalingStat: scalingStatCode(cell(row, wskHeader, 'Scaling Stat')),
    aspectRule: 'inherit',
    hits,
    skillPowerPct: powerPct,
    skillPower: powerPct / 100,
    perHitSkillPower: perHit / 100,
    fixedCoefficient: powerPct / 100,
    coefficientFixed: true,
    riderText: effect,
    riders,
    protectionRiders: riders,
    armourInteraction: cell(row, wskHeader, 'Armour / Ailment Interaction'),
    powerAudit: cell(row, wskHeader, 'Power Audit'),
    minRarity: 'grey',
    status: cell(row, wskHeader, 'Status') || 'Active',
  };
  Object.assign(skills[id], ailmentRoll);
  skillNameToId[name.toLowerCase()] = id;
  skillNameToId[(cell(row, wskHeader, 'Weapon Family') + '|' + name).toLowerCase()] = id;
}

const eskRows = sheets['Equipment Skill Library'];
const eskHeader = headerIndex(eskRows[4]);
for (const rn of Object.keys(eskRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = eskRows[rn];
  const id = cell(row, eskHeader, 'Skill ID');
  const name = cell(row, eskHeader, 'Skill Name');
  if (!id || !name) continue;
  const effect = cell(row, eskHeader, 'Full Effect');
  const riders = parseProtectionRiders(effect);
  const en = num(cell(row, eskHeader, 'EN'), 2);
  const cooldown = num(cell(row, eskHeader, 'Cooldown'), 0);
  const skillType = cell(row, eskHeader, 'Skill Type');
  skills[id] = {
    id,
    name,
    source: cell(row, eskHeader, 'Source Type') || 'Equipment',
    family: cell(row, eskHeader, 'Family / Set'),
    slot: cell(row, eskHeader, 'Slot'),
    pool: cell(row, eskHeader, 'Pool'),
    barSlot: 'Armour Technique',
    skillType,
    en,
    cooldown,
    meter: 0,
    target: 'Self',
    damageType: 'Utility',
    damageCategory: null,
    scalingStat: null,
    aspectRule: 'none',
    hits: 0,
    skillPowerPct: 0,
    skillPower: 0,
    noDamage: true,
    riderText: effect,
    riders,
    protectionRiders: riders,
    armourChange: cell(row, eskHeader, 'Armour Change'),
    magicArmourChange: cell(row, eskHeader, 'Magic Armour Change'),
    duration: cell(row, eskHeader, 'Duration'),
    minRarity: rarityKey(cell(row, eskHeader, 'Minimum Rarity')) || 'green',
    status: cell(row, eskHeader, 'Status') || 'Active',
  };
  skillNameToId[name.toLowerCase()] = id;
  skillNameToId[(cell(row, eskHeader, 'Family / Set') + '|' + name).toLowerCase()] = id;
}

function resolveSkillId(name, family) {
  if (!name || /^none$/i.test(name)) return null;
  const famKey = ((family || '') + '|' + name).toLowerCase();
  if (skillNameToId[famKey]) return skillNameToId[famKey];
  if (skillNameToId[name.toLowerCase()]) return skillNameToId[name.toLowerCase()];
  return null;
}

/* ---- Families ---- */
const families = Object.create(null);
const famRows = sheets['Weapon Families'];
const famHeader = headerIndex(famRows[4]);
for (const rn of Object.keys(famRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = famRows[rn];
  const name = cell(row, famHeader, 'Family');
  if (!name) continue;
  const hands = /2H/i.test(cell(row, famHeader, 'Hands')) ? 2 : 1;
  const s1 = cell(row, famHeader, 'Skill 1');
  const s2 = cell(row, famHeader, 'Skill 2');
  families[name] = {
    name,
    slot: 'Weapon',
    hands,
    damageType: damageTypeFromCategory(cell(row, famHeader, 'Damage Category')),
    damageCategory: cell(row, famHeader, 'Damage Category'),
    scalingStat: scalingStatCode(cell(row, famHeader, 'Scaling Stat')),
    classAccess: parseClassRestriction(cell(row, famHeader, 'Class Access')),
    greyRange: { min: num(cell(row, famHeader, 'Grey Min')), max: num(cell(row, famHeader, 'Grey Max')) },
    skillA: resolveSkillId(s1, name),
    skillB: resolveSkillId(s2, name),
    skill1Name: s1,
    skill2Name: s2,
    skill1En: num(cell(row, famHeader, 'Skill 1 EN'), 2),
    skill2En: num(cell(row, famHeader, 'Skill 2 EN'), 3),
    skill1Cooldown: num(cell(row, famHeader, 'Skill 1 Cooldown'), 0),
    skill2Cooldown: num(cell(row, famHeader, 'Skill 2 Cooldown'), 1),
    skill1PowerPct: num(cell(row, famHeader, 'Skill 1 Power %'), 0),
    skill2PowerPct: num(cell(row, famHeader, 'Skill 2 Power %'), 0),
    identity: cell(row, famHeader, 'Identity'),
    notes: cell(row, famHeader, 'Rules Note'),
    catalogueGroup: 'weapon',
  };
}

/* ---- Items ---- */
const items = Object.create(null);

function addFlatStats(stats, row, idx) {
  const map = [
    ['Vitality', 'hpFlat'],
    ['Might', 'atkFlat'],
    ['Dexterity', 'dexFlat'],
    ['Guard', 'defFlat'],
    ['Focus', 'matkFlat'],
    ['Resolve', 'mdefFlat'],
    ['Agility', 'spdFlat'],
  ];
  for (const [col, key] of map) {
    const v = num(cell(row, idx, col));
    if (v) stats[key] = v;
  }
  const crit = num(cell(row, idx, 'Critical %'));
  if (crit) stats.critChancePct = crit;
  const pPen = num(cell(row, idx, 'Physical Pen.'));
  if (pPen) stats.physicalPenPct = pPen;
  const mPen = num(cell(row, idx, 'Magic Pen.'));
  if (mPen) stats.magicPenPct = mPen;
  const ailRes = num(cell(row, idx, 'Ailment Resistance %'));
  if (ailRes) stats.ailmentResistancePct = ailRes;
}

function addProtectionStats(stats, row, idx) {
  const armour = num(cell(row, idx, 'Armour'));
  const magicArmour = num(cell(row, idx, 'Magic Armour'));
  if (armour) stats.armourFlat = armour;
  if (magicArmour) stats.magicArmourFlat = magicArmour;
  const pen = num(cell(row, idx, 'Agility Penalty'));
  if (pen) stats.agilityPenalty = pen;
}

/* Weapons */
const wpnRows = sheets['Weapons Catalogue'];
const wpnHeader = headerIndex(wpnRows[4]);
for (const rn of Object.keys(wpnRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = wpnRows[rn];
  const id = cell(row, wpnHeader, 'Item ID');
  if (!id) continue;
  const family = cell(row, wpnHeader, 'Family');
  const rarity = rarityKey(cell(row, wpnHeader, 'Rarity'));
  const hands = /2H/i.test(cell(row, wpnHeader, 'Hands')) ? 2 : 1;
  const s1Name = cell(row, wpnHeader, 'Skill 1');
  const s2Name = cell(row, wpnHeader, 'Skill 2');
  const stats = Object.create(null);
  addFlatStats(stats, row, wpnHeader);
  items[id] = {
    id,
    name: cell(row, wpnHeader, 'Item Name'),
    slot: 'Weapon',
    subtype: hands === 2 ? 'Two-handed weapon' : 'One-handed weapon',
    family,
    set: null,
    rarity,
    rank: RARITY_RANK[rarity] || 1,
    hands,
    weight: null,
    budgetClass: hands === 2 ? 'Weapon 2H' : 'Weapon 1H',
    classRestriction: parseClassRestriction(cell(row, wpnHeader, 'Class Access')),
    preferredClasses: cell(row, wpnHeader, 'Class Access'),
    aspect: 'neutral',
    skill1: resolveSkillId(s1Name, family),
    skill2: resolveSkillId(s2Name, family),
    pairedSkill: null,
    ultimate: null,
    damageType: damageTypeFromCategory(cell(row, wpnHeader, 'Damage Category')),
    damageCategory: cell(row, wpnHeader, 'Damage Category'),
    scalingStat: scalingStatCode(cell(row, wpnHeader, 'Scaling Stat')),
    minDamage: num(cell(row, wpnHeader, 'Damage Min')),
    maxDamage: num(cell(row, wpnHeader, 'Damage Max')),
    flatCoreText: '',
    secondaryText: '',
    bonuses: [],
    uniqueEffect: null,
    tradeoff: null,
    stats,
    identity: cell(row, wpnHeader, 'Identity'),
    notes: cell(row, wpnHeader, 'Notes'),
    npcEligible: true,
    audit: 'PASS',
  };
}

function importDefensiveSheet(sheetName, slotName) {
  const rows = sheets[sheetName];
  const idx = headerIndex(rows[4]);
  for (const rn of Object.keys(rows).map(Number).sort((a, b) => a - b)) {
    if (rn <= 4) continue;
    const row = rows[rn];
    const id = cell(row, idx, 'Item ID');
    if (!id) continue;
    const family = cell(row, idx, 'Set') || cell(row, idx, 'Family');
    const rarity = rarityKey(cell(row, idx, 'Rarity'));
    const defaultSkillName = cell(row, idx, 'Default Granted Skill');
    const skill1 = /^none$/i.test(defaultSkillName) ? null : resolveSkillId(defaultSkillName, family);
    const poolA = cell(row, idx, 'Skill Pool A (2 EN)');
    const poolB = cell(row, idx, 'Skill Pool B (3 EN)');
    const stats = Object.create(null);
    addFlatStats(stats, row, idx);
    addProtectionStats(stats, row, idx);
    const weight = cell(row, idx, 'Weight') || null;
    items[id] = {
      id,
      name: cell(row, idx, 'Item Name'),
      slot: slotName,
      subtype: weight ? `${weight} ${slotName}` : slotName,
      family,
      set: family,
      rarity,
      rank: RARITY_RANK[rarity] || 1,
      hands: 0,
      weight,
      budgetClass: slotName === 'Armour' ? 'Armour' : slotName,
      classRestriction: 'Any',
      preferredClasses: cell(row, idx, 'Best Suited'),
      aspect: 'neutral',
      skill1,
      skill2: null,
      skillPoolA: resolveSkillId(poolA, family),
      skillPoolB: resolveSkillId(poolB, family),
      skillPoolAName: poolA,
      skillPoolBName: poolB,
      pairedSkill: null,
      ultimate: null,
      damageType: null,
      damageCategory: null,
      scalingStat: null,
      minDamage: 0,
      maxDamage: 0,
      flatCoreText: '',
      secondaryText: '',
      bonuses: [],
      uniqueEffect: null,
      tradeoff: num(cell(row, idx, 'Agility Penalty')) || null,
      stats,
      twoPieceBonus: cell(row, idx, '2-Piece Bonus') || null,
      threePieceBonus: cell(row, idx, '3-Piece Bonus') || null,
      eligibleInfusions: cell(row, idx, 'Eligible Infusions') || null,
      identity: cell(row, idx, 'Identity'),
      notes: cell(row, idx, 'Rules Note') || cell(row, idx, 'Notes'),
      npcEligible: true,
      audit: cell(row, idx, 'Status') || 'PASS',
    };
    if (!families[family]) {
      families[family] = {
        name: family,
        slot: slotName,
        hands: slotName === 'Shield' ? 1 : 0,
        weight,
        catalogueGroup: 'defensive',
        skillA: resolveSkillId(poolA, family),
        skillB: resolveSkillId(poolB, family),
        identity: cell(row, idx, 'Identity'),
      };
    }
  }
}

importDefensiveSheet('Armour-Plumage', 'Armour');
importDefensiveSheet('Helmets', 'Helmet');
importDefensiveSheet('Shields', 'Shield');

/* Accessories */
const accRows = sheets['Accessories'];
const accHeader = headerIndex(accRows[4]);
for (const rn of Object.keys(accRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = accRows[rn];
  const id = cell(row, accHeader, 'Item ID');
  if (!id) continue;
  const family = cell(row, accHeader, 'Family');
  const rarity = rarityKey(cell(row, accHeader, 'Rarity'));
  const slot = cell(row, accHeader, 'Slot');
  const defaultSkillName = cell(row, accHeader, 'Default Granted Skill');
  const skill1 = /^none$/i.test(defaultSkillName) ? null : resolveSkillId(defaultSkillName, family);
  const stats = Object.create(null);
  addFlatStats(stats, row, accHeader);
  items[id] = {
    id,
    name: cell(row, accHeader, 'Item Name'),
    slot,
    subtype: slot,
    family,
    set: null,
    rarity,
    rank: RARITY_RANK[rarity] || 1,
    hands: 0,
    weight: null,
    budgetClass: slot,
    classRestriction: 'Any',
    preferredClasses: 'Any',
    aspect: 'neutral',
    skill1,
    skill2: null,
    skillPoolA: resolveSkillId(cell(row, accHeader, 'Skill Pool A (2 EN)'), family),
    skillPoolB: resolveSkillId(cell(row, accHeader, 'Skill Pool B (3 EN)'), family),
    skillPoolAName: cell(row, accHeader, 'Skill Pool A (2 EN)'),
    skillPoolBName: cell(row, accHeader, 'Skill Pool B (3 EN)'),
    pairedSkill: null,
    ultimate: null,
    damageType: null,
    damageCategory: null,
    scalingStat: null,
    minDamage: 0,
    maxDamage: 0,
    flatCoreText: '',
    secondaryText: '',
    bonuses: [],
    uniqueEffect: null,
    tradeoff: null,
    stats,
    identity: cell(row, accHeader, 'Identity'),
    notes: cell(row, accHeader, 'Notes'),
    npcEligible: true,
    audit: 'PASS',
  };
  if (!families[family]) {
    families[family] = {
      name: family,
      slot,
      hands: 0,
      catalogueGroup: 'accessory',
      skillA: items[id].skillPoolA,
      skillB: items[id].skillPoolB,
      identity: cell(row, accHeader, 'Identity'),
    };
  }
}

/* ---- Set bonuses ---- */
const setBonuses = Object.create(null);
const setRows = sheets['Set Bonuses'];
const setHeader = headerIndex(setRows[4]);
for (const rn of Object.keys(setRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = setRows[rn];
  const name = cell(row, setHeader, 'Set');
  if (!name) continue;
  setBonuses[name] = {
    name,
    weight: cell(row, setHeader, 'Weight'),
    protectionSplit: cell(row, setHeader, 'Protection Split'),
    bestSuited: cell(row, setHeader, 'Best Suited'),
    primaryStats: cell(row, setHeader, 'Primary Stats'),
    armourPiece: cell(row, setHeader, 'Armour Piece'),
    helmet: cell(row, setHeader, 'Helmet'),
    shield: cell(row, setHeader, 'Shield'),
    twoPiece: cell(row, setHeader, '2-Piece Identity'),
    threePiece: cell(row, setHeader, '3-Piece Identity'),
  };
}

/* ---- Materials & Infusions ---- */
const matRows = sheets['Materials & Infusions'];
const materials = [];
const infusions = [];
for (const rn of Object.keys(matRows).map(Number).sort((a, b) => a - b)) {
  if (rn < 5 || rn > 12) continue;
  const row = matRows[rn];
  if (row[0]) {
    materials.push({
      name: row[0],
      protectionIdentity: row[1] || '',
      commonStats: row[2] || '',
      typicalWeight: row[3] || '',
    });
  }
  if (row[5]) {
    infusions.push({
      name: row[5],
      protectsAgainst: row[6] || '',
      typicalEffects: row[7] || '',
      exampleVariant: row[8] || '',
      availability: row[9] || '',
    });
  }
}

/* ---- Ailment gates ---- */
const ailRows = sheets['Ailment Gates'];
const ailHeader = headerIndex(ailRows[4]);
const ailmentGates = [];
for (const rn of Object.keys(ailRows).map(Number).sort((a, b) => a - b)) {
  if (rn <= 4) continue;
  const row = ailRows[rn];
  const ailment = cell(row, ailHeader, 'Ailment / Effect');
  if (!ailment) continue;
  ailmentGates.push({
    ailment,
    damageType: cell(row, ailHeader, 'Damage Type'),
    protectionPool: cell(row, ailHeader, 'Protection Pool'),
    applicationRequirement: cell(row, ailHeader, 'Application Requirement'),
    tickInteraction: cell(row, ailHeader, 'Tick Interaction'),
    restoringProtection: cell(row, ailHeader, 'Restoring Protection'),
    bypassRule: cell(row, ailHeader, 'Bypass Rule'),
    notes: cell(row, ailHeader, 'Notes'),
  });
}

/* ---- Core rules snapshot ---- */
const coreRules = {
  packVersion: PACK_VERSION,
  weaponDamageFormula: 'Weapon × ((Skill Power + Stat×2.5)÷100)',
  naturalStrikeEn: 1,
  weaponSkill1: { en: 2, cooldown: 0 },
  weaponSkill2: { en: 3, cooldown: 1 },
  armourRestoration: { en: 2, cooldown: 1, overflow: false },
  magicArmourRestoration: { en: 2, cooldown: 1, overflow: false },
  fortify: { en: 3, cooldown: 2, duration: 2, overflow: true },
  ward: { en: 3, cooldown: 2, duration: 2, overflow: true },
  bastionAegis: { en: 3, cooldown: 3, duration: 2, overflow: true },
  barrierRemoved: true,
  rarityDamageFactors: {
    grey: 1.0, green: 1.25, blue: 1.55, purple: 1.9, gold: 2.3, orange: 2.75,
  },
  protectionBudgets: {
    armour: { grey: 4, green: 6, blue: 9, purple: 12, gold: 16, orange: 22 },
    helmet: { grey: 2, green: 3, blue: 4, purple: 6, gold: 8, orange: 11 },
    shield: { grey: 3, green: 4, blue: 6, purple: 8, gold: 12, orange: 16 },
  },
  weightMultipliers: { light: 0.8, medium: 1.0, heavy: 1.1 },
  flatAttributeBudgets: { grey: 1, green: 2, blue: 3, purple: 5, gold: 7, orange: 9 },
};

/* ---- Slots (unchanged 7-key loadout) ---- */
const slots = {
  slotOrder: ['helmet', 'armour', 'mainHand', 'offHand', 'ankletL', 'ankletR', 'necklace'],
  slots: {
    helmet: {
      label: 'Helmet', accepts: 'Helmet', handCapacity: 0,
      activeContribution: 'May grant one 2 EN or 3 EN utility skill',
      duplicateAllowed: false, budgetClass: 'Helmet',
      notes: 'Secondary protection and identity.',
    },
    armour: {
      label: 'Armour/Plumage', accepts: 'Armour', handCapacity: 0,
      activeContribution: 'May grant one defensive equipment skill',
      duplicateAllowed: false, budgetClass: 'Armour',
      notes: 'Largest Armour/Magic Armour contribution.',
    },
    mainHand: {
      label: 'Main Weapon', accepts: 'Weapon', handCapacity: 2,
      activeContribution: 'Weapon Skill 1 (2 EN) and Skill 2 (3 EN)',
      duplicateAllowed: false, budgetClass: 'Weapon 1H / Weapon 2H',
      notes: 'Two-handed occupies both weapon slots.',
    },
    offHand: {
      label: 'Off Hand', accepts: 'Weapon', handCapacity: 1,
      activeContribution: 'Off-hand Skill, or Shield modifiers',
      duplicateAllowed: true, budgetClass: 'Weapon 1H',
      notes: 'Accepts one-handed weapons or Shields. Empty when main is two-handed unless unique exception.',
    },
    ankletL: {
      label: 'Left Anklet', accepts: 'Anklet', handCapacity: 0,
      activeContribution: 'May grant movement/buff skill',
      duplicateAllowed: true, budgetClass: 'Anklet', notes: 'Half-strength passive rolls.',
    },
    ankletR: {
      label: 'Right Anklet', accepts: 'Anklet', handCapacity: 0,
      activeContribution: 'May grant movement/buff skill',
      duplicateAllowed: true, budgetClass: 'Anklet', notes: 'Half-strength passive rolls.',
    },
    necklace: {
      label: 'Necklace', accepts: 'Necklace', handCapacity: 0,
      activeContribution: 'May grant buff/setup/defensive skill',
      duplicateAllowed: false, budgetClass: 'Necklace', notes: 'Build identity and resistance.',
    },
  },
  budgetClassMultipliers: {
    'Weapon 1H': 1, 'Weapon 2H': 1.5, Armour: 1, Shield: 1,
    Helmet: 0.75, Anklet: 0.5, Necklace: 0.75,
  },
  rarityBudgets: {
    grey: { flatAttribute: 1, armour: 4, helmet: 2, shield: 3, damageFactor: 1.0 },
    green: { flatAttribute: 2, armour: 6, helmet: 3, shield: 4, damageFactor: 1.25 },
    blue: { flatAttribute: 3, armour: 9, helmet: 4, shield: 6, damageFactor: 1.55 },
    purple: { flatAttribute: 5, armour: 12, helmet: 6, shield: 8, damageFactor: 1.9 },
    gold: { flatAttribute: 7, armour: 16, helmet: 8, shield: 12, damageFactor: 2.3 },
    orange: { flatAttribute: 9, armour: 22, helmet: 11, shield: 16, damageFactor: 2.75 },
  },
  rarityOrder: ['grey', 'green', 'blue', 'purple', 'gold', 'orange'],
  weightMultipliers: { light: 0.8, medium: 1.0, heavy: 1.1 },
  statDisplayNames: {
    hp: 'Vitality',
    atk: 'Might',
    dex: 'Dexterity',
    matk: 'Focus',
    def: 'Guard',
    mdef: 'Resolve',
    spd: 'Agility',
    armour: 'Armour',
    magicArmour: 'Magic Armour',
    critChancePct: 'Critical Chance',
    physicalPenPct: 'Physical Penetration',
    magicPenPct: 'Magic Penetration',
    dodgePct: 'Dodge',
    critDamagePct: 'Ferocity',
    healingPowerPct: 'Healing Power',
  },
  forbiddenStatIds: [],
};

/* ---- Weapon access ---- */
const weaponAccess = Object.create(null);
for (const name of Object.keys(families)) {
  const fam = families[name];
  if (fam.slot !== 'Weapon') continue;
  weaponAccess[name] = {
    family: name,
    hands: fam.hands,
    classAccess: classListFromText(fam.classAccess),
    damageCategory: fam.damageCategory,
    scalingStat: fam.scalingStat,
  };
}

/* ---- Reference loadouts (class × rarity) ---- */
function itemsBySlotRarity(slot, rarity) {
  return Object.values(items).filter((it) => it.slot === slot && it.rarity === rarity);
}

function pickWeaponForClass(classId, rarity) {
  const list = itemsBySlotRarity('Weapon', rarity).filter((it) => {
    const access = weaponAccess[it.family];
    if (!access || !access.classAccess || !access.classAccess.length) return true;
    return access.classAccess.includes(classId);
  });
  if (!list.length) return null;
  /* Prefer 2H for knight/brute, 1H for classes that can dual-wield or use shields. */
  const prefer2H = classId === 'knight' || classId === 'brute';
  const prefer1H = !prefer2H;
  const preferMagic = classId === 'mage' || classId === 'siren';
  const preferFinesse = classId === 'rogue' || classId === 'bard';
  list.sort((a, b) => {
    let sa = 0;
    let sb = 0;
    if (prefer2H) { sa += a.hands === 2 ? 50 : 0; sb += b.hands === 2 ? 50 : 0; }
    if (prefer1H) {
      sa += a.hands === 1 ? 50 : -50;
      sb += b.hands === 1 ? 50 : -50;
    }
    if (preferMagic) {
      sa += a.damageType === 'Magic' ? 10 : 0;
      sb += b.damageType === 'Magic' ? 10 : 0;
    }
    if (preferFinesse) {
      sa += /Finesse/i.test(a.damageCategory || '') ? 10 : 0;
      sb += /Finesse/i.test(b.damageCategory || '') ? 10 : 0;
    }
    sa += (a.minDamage + a.maxDamage);
    sb += (b.minDamage + b.maxDamage);
    return sb - sa;
  });
  return list[0];
}

function pickDefensive(slot, rarity, classId) {
  const list = itemsBySlotRarity(slot, rarity);
  if (!list.length) return null;
  list.sort((a, b) => {
    const score = (it) => {
      let s = (Number(it.stats.armourFlat) || 0) + (Number(it.stats.magicArmourFlat) || 0);
      const pref = String(it.preferredClasses || '').toLowerCase();
      if (pref.includes(classId)) s += 20;
      if (classId === 'mage' || classId === 'siren') s += (Number(it.stats.magicArmourFlat) || 0) * 2;
      if (classId === 'knight' || classId === 'brute') s += (Number(it.stats.armourFlat) || 0) * 2;
      if (classId === 'rogue') s += /shadowplume|light/i.test(it.weight || '') || /shadowplume/i.test(it.family || '') ? 15 : 0;
      return s;
    };
    return score(b) - score(a);
  });
  return list[0];
}

function pickAccessory(slot, rarity) {
  const list = itemsBySlotRarity(slot, rarity);
  return list[0] || null;
}

const referenceLoadouts = [];
for (const classId of CLASS_IDS) {
  for (const rarity of Object.keys(RARITY_RANK)) {
    const weapon = pickWeaponForClass(classId, rarity);
    const armour = pickDefensive('Armour', rarity, classId);
    const helmet = pickDefensive('Helmet', rarity, classId);
    const shield = weapon && weapon.hands === 2 ? null : pickDefensive('Shield', rarity, classId);
    const anklet = pickAccessory('Anklet', rarity);
    const necklace = pickAccessory('Necklace', rarity);
    const equipment = {
      helmet: helmet ? helmet.id : null,
      armour: armour ? armour.id : null,
      mainHand: weapon ? weapon.id : null,
      offHand: shield ? shield.id : null,
      ankletL: anklet ? anklet.id : null,
      ankletR: anklet ? anklet.id : null,
      necklace: necklace ? necklace.id : null,
    };
    const totals = Object.create(null);
    const keys = ['hpFlat', 'atkFlat', 'dexFlat', 'defFlat', 'matkFlat', 'mdefFlat', 'spdFlat', 'armourFlat', 'magicArmourFlat'];
    for (const slotKey of Object.keys(equipment)) {
      const it = equipment[slotKey] ? items[equipment[slotKey]] : null;
      if (!it || !it.stats) continue;
      for (const k of keys) {
        const v = Number(it.stats[k]) || 0;
        if (v) totals[k] = (totals[k] || 0) + v;
      }
      if (it.stats.agilityPenalty) {
        totals.spdFlat = (totals.spdFlat || 0) + Number(it.stats.agilityPenalty);
      }
    }
    const skill = weapon && weapon.skill1 ? skills[weapon.skill1] : null;
    referenceLoadouts.push({
      class: classId,
      rarity,
      equipment,
      totals,
      weaponMin: weapon ? weapon.minDamage : 0,
      weaponMax: weapon ? weapon.maxDamage : 0,
      scalingStat: weapon ? (weapon.scalingStat === 'ATK' ? 'Might' : weapon.scalingStat === 'DEX' ? 'Dexterity' : weapon.scalingStat === 'MATK' ? 'Focus' : weapon.scalingStat) : null,
      skillId: weapon ? weapon.skill1 : null,
      skillPower: skill ? skill.skillPower : 0,
    });
  }
}

/* ---- Orb focuses (exemplars → Focus Orb rarity row) ---- */
const focusOrbs = Object.values(items).filter((it) => it.family === 'Focus Orb');
const orbFocuses = Object.create(null);
const affinityCycle = ['ember', 'frost', 'storm', 'venom', 'blood', 'lunar'];
for (let i = 0; i < focusOrbs.length; i++) {
  const it = focusOrbs[i];
  const aff = affinityCycle[i % affinityCycle.length];
  orbFocuses[aff] = {
    id: aff,
    affinity: aff,
    exemplarItemId: it.id,
    techniqueName: 'Orb Pulse',
    onHit: { kind: 'applyAilment', ailment: aff === 'ember' ? 'burning' : aff === 'frost' ? 'chilled' : aff === 'storm' ? 'paralyzed' : aff === 'venom' ? 'poison' : aff === 'blood' ? 'bleed' : 'weakened', stacks: 1 },
  };
}

/* Preserve combination / paired techniques (family-tag driven; not in v1.2 workbook). */
const comboFixture = path.join(ROOT, 'scripts', 'fixtures', 'equipment-combo-skills.json');
if (existsSync(comboFixture)) {
  const keep = JSON.parse(readFileSync(comboFixture, 'utf8'));
  let kept = 0;
  for (const id of Object.keys(keep)) {
    if (skills[id]) continue;
    const sk = keep[id];
    const roll = parseAilmentRoll(sk.riderText || '');
    if (sk.rider && sk.rider.kind === 'applyAilment') {
      if (!roll.ailment) roll.ailment = normalizeAilmentId(sk.rider.ailment);
      if (roll.ailmentChance == null) roll.ailmentChance = sk.rider.chance != null ? Number(sk.rider.chance) : 100;
    }
    skills[id] = Object.assign({}, sk, roll);
    kept++;
  }
  console.log('preserved combo/pair skills:', kept);
}

/* Stamp Focus Orb items with orbFocus affinity for arsenal overlays. */
const focusAffinityByRarity = {
  grey: 'ember', green: 'frost', blue: 'storm', purple: 'venom', gold: 'blood', orange: 'lunar',
};
for (const it of Object.values(items)) {
  if (it.family !== 'Focus Orb') continue;
  it.orbFocus = focusAffinityByRarity[it.rarity] || 'ember';
  it.aspect = it.orbFocus;
}

/* ---- Write outputs (do NOT touch birds-v2 / combat-pack) ---- */
writeDataFile('js/data/equipment/slots.js', 'Avian.data.equipment.slots', slots, '7-slot loadout; Shield via offHand');
writeDataFile('js/data/equipment/skills.js', 'Avian.data.equipment.skills', skills, `${Object.keys(skills).length} skills (BASIC + WSK + ESK + COMBO/PAIR)`);
writeDataFile('js/data/equipment/items.js', 'Avian.data.equipment.items', items, `${Object.keys(items).length} catalogue items`);
writeDataFile('js/data/equipment/families.js', 'Avian.data.equipment.families', families, `${Object.keys(families).length} families`);
writeDataFile('js/data/equipment/set-bonuses.js', 'Avian.data.equipment.setBonuses', setBonuses, `${Object.keys(setBonuses).length} defensive sets`);
writeDataFile('js/data/equipment/materials-infusions.js', 'Avian.data.equipment.materialsInfusions', { materials, infusions, namingFormula: 'Rarity + Infusion + Material/Set + Slot' });
writeDataFile('js/data/equipment/ailment-gates.js', 'Avian.data.equipment.ailmentGates', ailmentGates, 'Protection-pool ailment gates');
writeDataFile('js/data/equipment/core-rules.js', 'Avian.data.equipment.coreRules', coreRules, 'v1.2 restoration / fortify / ward rules');
writeDataFile('js/data/equipment/reference-loadouts.js', 'Avian.data.equipment.referenceLoadouts', referenceLoadouts, `${referenceLoadouts.length} class×rarity loadouts`);
writeDataFile('js/data/equipment/weapon-access.js', 'Avian.data.equipment.weaponAccess', weaponAccess);
writeDataFile('js/data/equipment/orb-focuses.js', 'Avian.data.equipment.orbFocuses', orbFocuses);

const itemCount = Object.keys(items).length;
const skillCount = Object.keys(skills).length;
const wpnCount = Object.values(items).filter((i) => i.slot === 'Weapon').length;
const armCount = Object.values(items).filter((i) => i.slot === 'Armour').length;
const hlmCount = Object.values(items).filter((i) => i.slot === 'Helmet').length;
const shdCount = Object.values(items).filter((i) => i.slot === 'Shield').length;
const accCount = Object.values(items).filter((i) => i.slot === 'Anklet' || i.slot === 'Necklace').length;
const unresolvedWeapons = Object.values(items).filter((i) => i.slot === 'Weapon' && (!i.skill1 || !i.skill2));
const barrierSkills = Object.values(skills).filter((s) => /barrier/i.test(s.riderText || '') || /barrier/i.test(s.name || ''));

console.log('\nImport summary');
console.log('  items:', itemCount, `(W${wpnCount} A${armCount} H${hlmCount} S${shdCount} Acc${accCount})`);
console.log('  skills:', skillCount);
console.log('  families:', Object.keys(families).length);
console.log('  set bonuses:', Object.keys(setBonuses).length);
console.log('  loadouts:', referenceLoadouts.length);
if (unresolvedWeapons.length) {
  console.error('FAIL: weapons missing skills:', unresolvedWeapons.map((i) => i.id).join(', '));
  process.exit(1);
}
if (itemCount !== 300) {
  console.error('FAIL: expected 300 items, got', itemCount);
  process.exit(1);
}
if (barrierSkills.length) {
  console.error('FAIL: Barrier wording still present in skills:', barrierSkills.map((s) => s.id).join(', '));
  process.exit(1);
}
console.log('OK');
