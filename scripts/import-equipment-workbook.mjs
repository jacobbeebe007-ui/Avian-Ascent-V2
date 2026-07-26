#!/usr/bin/env node
/*
 * Import Equipment v0.9 workbook (weapon-first, flat equipment stats):
 *   Newest_Avian_Ascent_Master_v0.9_Base_Stats_Implemented.xlsx
 *   → js/data/equipment/{slots,skills,items,families,reference-loadouts,combinations}.js
 *   → js/data/effect-tiers.js
 *   → js/data/birds-v2.js, js/data/combat-pack/{classes,bird-passives,innate-utilities}.js
 *   → scripts/fixtures/equipment-damage-fixtures.json
 *
 * Override: AA_EQUIPMENT_WORKBOOK=/path/to/workbook.xlsx
 *
 * Fail-fast: any unparseable bonus/unique/trade-off text, unresolved skill id,
 * forbidden stat, or count mismatch aborts the import with a report.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_WORKBOOK = path.join(
  process.env.HOME || '',
  'Documents',
  'Avian Ascent',
  'Avian Workbooks',
  'Newest_Avian_Ascent_Master_v0.9_Base_Stats_Implemented.xlsx',
);
const WORKBOOK = process.env.AA_EQUIPMENT_WORKBOOK || DEFAULT_WORKBOOK;
const EQUIPMENT_PACK_VERSION = '2026.07-weapon-first-v0.9';
const PENDING_FAMILIES = new Set([
  'Bow', 'Hand Crossbow', 'Hook Axe', 'War Pick', 'Ailment Reliquary',
]);
/** R-CD-001 fixed cooldown by EN (6 EN uses Ultimate gate; cooldown column stays 0). */
const EN_COOLDOWN = { 1: 0, 2: 0, 3: 1, 4: 2, 5: 3, 6: 0 };
/** R-EN-005 pure-damage master coefficient bands. */
const EN_MASTER_BANDS = {
  1: { min: 0.70, max: 0.90 },
  2: { min: 1.00, max: 1.20 },
  3: { min: 1.30, max: 1.50 },
  4: { min: 1.60, max: 1.90 },
  5: { min: 2.00, max: 2.35 },
  6: { min: 2.45, max: 2.90 },
};
const FALLBACK_STAT_COSTS = {
  hp: 120, atk: 220, def: 220, matk: 220, mdef: 220, spd: 300,
  dodgePct: 200, critChancePct: 220, critDamagePct: 60,
  physicalPenPct: 160, magicPenPct: 160,
  physicalDamagePct: 170, magicDamagePct: 170, aspectDamagePct: 140,
  healingPowerPct: 110, shieldStrengthPct: 110,
};
/** Flat core cost per point (Working Draft proxy when sheet costs are formula-only). */
const FLAT_STAT_COST = { hp: 8, atk: 14, dex: 14, def: 14, matk: 14, mdef: 14, spd: 18 };
/** v0.9 flat core keys on items and reference loadouts. */
const CORE_FLAT_EMIT_KEYS = [
  ['hpFlat', 9], ['atkFlat', 10], ['dexFlat', 11], ['defFlat', 12],
  ['matkFlat', 13], ['mdefFlat', 14], ['spdFlat', 15],
];
const BUDGET_CLASS_MULTIPLIERS = {
  'Weapon 1H': 1, 'Weapon 2H': 1.5, Armour: 1, Shield: 1,
  Helmet: 0.75, Anklet: 0.5, Necklace: 0.75,
};

/* ------------------------------------------------------------------ *
 * XLSX reading (pure Node; shared approach with import-mutation-gear) *
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

function parseSheet(sheetXml, sharedStrings) {
  const rows = Object.create(null); // rowNumber → dense array
  const rowRe = /<(?:x:)?row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  let rm;
  while ((rm = rowRe.exec(sheetXml))) {
    const rowNum = Number(rm[1]);
    const cells = [];
    const cellRe = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    let cm;
    while ((cm = cellRe.exec(rm[2]))) {
      const attrs = cm[1];
      const inner = cm[2] || '';
      const refM = attrs.match(/\br="([^"]+)"/);
      const ref = refM ? refM[1] : '';
      const idx = colIndex(colLetters(ref));
      const tM = attrs.match(/\bt="([^"]+)"/);
      let val = '';
      if (tM && tM[1] === 'inlineStr') {
        const t = inner.match(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/);
        val = t ? t[1] : '';
      } else {
        const v = inner.match(/<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/);
        val = v ? v[1] : '';
        if (tM && tM[1] === 's') val = sharedStrings[Number(val)] || '';
      }
      cells[idx] = decodeEntities(String(val).trim());
    }
    const dense = [];
    for (let i = 0; i < cells.length; i++) dense[i] = cells[i] || '';
    while (dense.length && !dense[dense.length - 1]) dense.pop();
    rows[rowNum] = dense;
  }
  return rows;
}

function loadWorkbookSheets(xlsxPath) {
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
  const relMap = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const id = (m[1].match(/\bId="([^"]+)"/) || [])[1];
    const target = (m[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) relMap[id] = target;
  }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\b([^>]*)\/>/g)) {
    const name = (m[1].match(/\bname="([^"]+)"/) || [])[1];
    const rid = (m[1].match(/\br:id="([^"]+)"/) || [])[1];
    if (!name || !rid) continue;
    const target = relMap[rid];
    if (!target) continue;
    const key = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = entries[key];
    if (!xml) continue;
    sheets[decodeEntities(name)] = parseSheet(xml, sharedStrings);
  }
  return sheets;
}

/* -------------------- helpers -------------------- */

const errors = [];
const warnings = [];
function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function num(v, def = 0) {
  if (v === '' || v == null) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function pct(v) { // stored decimal → integer/decimal percent, float-noise-free
  return Math.round(num(v) * 10000) / 100;
}

function round2(v) { return Math.round(v * 100) / 100; }

// Table extraction: header on `headerRow`, data rows are every following row with a
// non-empty first cell (interior blank spacer rows are skipped, not treated as EOF).
function tableRows(sheet, headerRow) {
  const rows = [];
  const maxRow = Math.max(...Object.keys(sheet).map(Number));
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const row = sheet[r];
    if (!row || !row[0]) continue;
    rows.push({ rowNum: r, cells: row });
  }
  return rows;
}

const RARITY_KEYS = { Grey: 'grey', Green: 'green', Blue: 'blue', Purple: 'purple', Gold: 'gold', Orange: 'orange' };
const RARITY_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];

const STAT_ORDER = [
  'hp', 'atk', 'def', 'matk', 'mdef', 'spd',
  'dodgePct', 'critChancePct', 'critDamagePct',
  'physicalPenPct', 'magicPenPct', 'physicalDamagePct', 'magicDamagePct',
  'aspectDamagePct', 'healingPowerPct', 'shieldStrengthPct',
];
/* v0.7: sixteen % columns plus six core Flat columns on Equipment Stats. */
const CORE_PCT_KEYS = new Set(['hp', 'atk', 'def', 'matk', 'mdef', 'spd']);
const CORE_FLAT_KEYS = ['hp', 'atk', 'def', 'matk', 'mdef', 'spd'];
const PCT_STATS = new Set(STAT_ORDER);
const STAT_ID_MAP = {
  /* v0.7 ids */
  HP: 'hp', ATK: 'atk', DEF: 'def', MATK: 'matk', MDEF: 'mdef', SPD: 'spd',
  DodgePct: 'dodgePct', CritChancePct: 'critChancePct', CritDamagePct: 'critDamagePct',
  PhysicalPenPct: 'physicalPenPct', MagicPenPct: 'magicPenPct',
  PhysicalDamagePct: 'physicalDamagePct', MagicDamagePct: 'magicDamagePct',
  AspectDamagePct: 'aspectDamagePct', HealingPowerPct: 'healingPowerPct', ShieldStrengthPct: 'shieldStrengthPct',
  /* v0.9 weapon-first ids */
  HPBase: 'hpBase', VIT: 'hp', MIG: 'atk', DEX: 'dex', FOC: 'matk', GRD: 'def', RES: 'mdef', AGI: 'spd',
  CRIT: 'critChancePct', FER: 'critDamagePct', 'PEN-P': 'physicalPenPct', 'PEN-M': 'magicPenPct',
};
const CANONICAL_STAT_DISPLAY_NAMES = {
  hp: 'Vitality', atk: 'Might', dex: 'Dexterity', def: 'Guard', matk: 'Focus', mdef: 'Resolve',
  spd: 'Agility', dodgePct: 'Dodge', critChancePct: 'Critical Chance', critDamagePct: 'Ferocity',
  physicalPenPct: 'Physical Penetration', magicPenPct: 'Magic Penetration',
  physicalDamagePct: 'Physical Damage', magicDamagePct: 'Magic Damage',
  aspectDamagePct: 'Aspect Damage', healingPowerPct: 'Healing Power', shieldStrengthPct: 'Shield Strength',
};
const AFFINITY_TO_LATIN = {
  earth: 'terra', sky: 'aeris', storm: 'tempest', day: 'solis', night: 'lunae', water: 'maris',
  terra: 'terra', aeris: 'aeris', tempest: 'tempest', solis: 'solis', lunae: 'lunae', maris: 'maris',
  neutral: 'neutral',
};
const SCALING_STAT_MAP = {
  Might: 'ATK', ATK: 'ATK', Dexterity: 'DEX', DEX: 'DEX', Guard: 'DEF', DEF: 'DEF',
  Focus: 'MATK', MATK: 'MATK', Resolve: 'MDEF', MDEF: 'MDEF', Agility: 'SPD', SPD: 'SPD',
  Vitality: 'HP', HP: 'HP', None: null, '': null,
};
const ORB_FOCUS_FROM_TAG = {
  'Poison Orb': 'poison', 'Burn Orb': 'burn', 'Chill Orb': 'chill',
  'Shock Orb': 'shock', 'Bleed Orb': 'bleed', 'Echo Orb': 'echo',
};

function normalizeAffinity(raw) {
  const s = String(raw || 'neutral').trim().toLowerCase();
  if (!s || s === 'neutral') return 'neutral';
  return AFFINITY_TO_LATIN[s] || s;
}

function mapScalingStat(raw) {
  if (raw == null || raw === '' || /^none$/i.test(raw)) return null;
  return SCALING_STAT_MAP[raw] || SCALING_STAT_MAP[String(raw).trim()] || String(raw).toUpperCase();
}

function parseDamageTypeFields(raw) {
  const s = String(raw || 'Physical').trim();
  if (/Physical Strength/i.test(s)) return { damageType: 'Physical', damageCategory: 'Physical Strength' };
  if (/Physical Finesse/i.test(s)) return { damageType: 'Physical', damageCategory: 'Physical Finesse' };
  if (/^Martial$/i.test(s)) return { damageType: 'Physical', damageCategory: 'Physical Strength' };
  if (/Hybrid/i.test(s)) return { damageType: 'Hybrid', damageCategory: null };
  if (/Magic/i.test(s)) return { damageType: 'Magic', damageCategory: null };
  return { damageType: s, damageCategory: null };
}

function ferocityToCritDamagePct(v) {
  const n = num(v);
  if (!n) return 0;
  if (n > 0 && n <= 1) return pct(n);
  return Math.round(n * 100) / 100;
}

function flatStatsFromEquipmentRow(cells) {
  const stats = {};
  for (const [key, col] of CORE_FLAT_EMIT_KEYS) {
    const v = num(cells[col]);
    if (v) stats[key] = Math.round(v);
  }
  const crit = num(cells[16]);
  if (crit) stats.critChancePct = pct(crit);
  const fer = num(cells[17]);
  if (fer) stats.critDamagePct = ferocityToCritDamagePct(fer);
  const physPen = num(cells[18]); if (physPen) stats.physicalPenPct = pct(physPen);
  const magPen = num(cells[19]); if (magPen) stats.magicPenPct = pct(magPen);
  const ail = num(cells[20]); if (ail) stats.ailmentChancePct = pct(ail);
  const heal = num(cells[21]); if (heal) stats.healingPowerPct = pct(heal);
  const bar = num(cells[22]); if (bar) stats.shieldStrengthPct = pct(bar);
  return stats;
}

function parseFamilySlotHands(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^([^/]+)\s*\/\s*(\dH)/i);
  if (m) return { slot: m[1].trim(), hands: m[2].toUpperCase() === '2H' ? 2 : 1 };
  if (/Armour|Helmet|Shield|Anklet|Necklace/i.test(s)) return { slot: s.split('/')[0].trim(), hands: 0 };
  return { slot: s, hands: 0 };
}

function uniqueRuleFromPermission(raw) {
  const s = String(raw || '');
  return /required|yes/i.test(s) ? 'required' : 'no';
}

function ledgerForScaling(stat) {
  const u = String(stat || '').toUpperCase();
  if (u === 'ATK' || u === 'MIGHT') return 'atk';
  if (u === 'DEX' || u === 'DEXTERITY') return 'dex';
  if (u === 'MATK' || u === 'FOCUS') return 'matk';
  if (u === 'SPD' || u === 'AGILITY') return 'spd';
  if (u === 'DEF' || u === 'GUARD') return 'def';
  if (u === 'MDEF' || u === 'RESOLVE') return 'mdef';
  if (u === 'HP' || u === 'VITALITY') return 'hp';
  return String(stat || '').toLowerCase();
}

/** Core stats → atkPct keys; chance/damage stay *Pct names. */
function toItemStatKey(orderKey) {
  if (CORE_PCT_KEYS.has(orderKey)) return orderKey + 'Pct';
  return orderKey;
}

function toItemFlatKey(orderKey) {
  return orderKey + 'Flat';
}

function expectedCooldown(en) {
  if (EN_COOLDOWN[en] != null) return EN_COOLDOWN[en];
  return null;
}

/* ------------------------------------------------------------------ *
 * Effect-text parser (strict for equipment bonus/unique/trade-off)    *
 * ------------------------------------------------------------------ */

const EFFECT_STAT_NAMES = [
  ['Physical Damage', 'physicalDamage'],
  ['Martial Damage', 'physicalDamage'],
  ['Magic Damage', 'magicDamage'],
  ['Aspect Damage', 'aspectDamage'],
  ['Affinity Damage', 'aspectDamage'],
  ['Damage Taken', 'damageTaken'],
  ['Crit Chance', 'critChance'],
  ['Critical', 'critChance'],
  ['Crit Damage', 'critDamage'],
  ['Ferocity', 'critDamage'],
  ['Healing Power', 'healingPower'],
  ['Shield Strength', 'shieldStrength'],
  ['Barrier Power', 'shieldStrength'],
  ['Healing', 'healingReceived'],
  ['Accuracy', 'acc'],
  ['Precision', 'acc'],
  ['MATK', 'matk'],
  ['Focus', 'matk'],
  ['MDEF', 'mdef'],
  ['Resolve', 'mdef'],
  ['ATK', 'atk'],
  ['Might', 'atk'],
  ['Dexterity', 'dex'],
  ['DEF', 'def'],
  ['Guard', 'def'],
  ['SPD', 'spd'],
  ['Agility', 'spd'],
  ['HP', 'hp'],
  ['Vitality', 'hp'],
  ['Dodge', 'dodge'],
  ['Evasion', 'dodge'],
  ['ACC', 'acc'],
  ['Brace', 'brace'],
  ['Damage', 'damage'],
];
const TIER_EFFECT_RE = new RegExp(
  '\\b(Minor|Moderate|Major)\\s+(' + EFFECT_STAT_NAMES.map((e) => e[0]).join('|') + ')\\s+(Up|Down)\\b',
  'g',
);

function statKeyFor(name) {
  for (const [label, key] of EFFECT_STAT_NAMES) if (label === name) return key;
  return null;
}

function extractDuration(text) {
  let m;
  if ((m = text.match(/for (\d+) turns?\b/))) return { kind: 'turns', turns: Number(m[1]) };
  if (/for that turn\b/.test(text)) return { kind: 'turns', turns: 1 };
  if (/until the start of your next turn/.test(text)) return { kind: 'untilNextTurn' };
  if (/until the end of the next turn/.test(text)) return { kind: 'untilEndOfNextTurn' };
  if (/until the end of the target's next turn/.test(text)) return { kind: 'untilEndOfNextTurn' };
  if (/until the end of (?:your|the target's) second turn/.test(text)) return { kind: 'turns', turns: 2 };
  if (/until your next turn/.test(text)) return { kind: 'untilNextTurn' };
  if (/until battle end/.test(text)) return { kind: 'battleEnd' };
  if (/for this skill/.test(text)) return { kind: 'thisSkill' };
  if (/for your next skill/.test(text)) return { kind: 'nextSkill' };
  if (/your next ([A-Za-z' -]+?) attack|next Basic Attack|next damaging hit|next weapon attack|the next one\b/.test(text)) {
    return { kind: 'nextAttack' };
  }
  if (/while equipped/.test(text)) return { kind: 'whileEquipped' };
  if (/^While |^Above |^Against |^If you are faster|^While faster|ends immediately below/.test(text)) return { kind: 'whileCondition' };
  return null;
}

function extractLimit(text) {
  if (/once per combat/i.test(text) || /each combat/i.test(text) || /^The first time you/i.test(text) || /^Your first /i.test(text) || /^The first heal received at full HP/i.test(text)) return 'oncePerCombat';
  if (/once per turn/i.test(text) || /each turn/i.test(text)) return 'oncePerTurn';
  return null;
}

// Ordered trigger classification table. First match wins. Matched case-insensitively.
const TRIGGER_TABLE_RAW = [
  [/(?:^|; )(?:While |When |)above (\d+)% (?:HP|Vitality|Health)\b/i, (m) => ({ kind: 'whileHpAbove', pct: Number(m[1]) })],
  [/^Above (\d+)% (?:HP|Vitality|Health)\b/i, (m) => ({ kind: 'whileHpAbove', pct: Number(m[1]) })],
  [/^(?:When|While) below (\d+)% (?:HP|Vitality|Health)/i, (m) => ({ kind: 'whileHpBelow', pct: Number(m[1]) })],
  [/fall(?:s)? below (\d+)% (?:HP|Vitality|Health)/i, (m) => ({ kind: 'onHpBelow', pct: Number(m[1]) })],
  [/^The first time you fall below (\d+)% (?:HP|Vitality|Health)/i, (m) => ({ kind: 'onHpBelow', pct: Number(m[1]) })],
  [/^Once per combat when you fall below (\d+)% (?:HP|Vitality|Health)/i, (m) => ({ kind: 'onHpBelow', pct: Number(m[1]) })],
  [/^Once per combat after reducing an enemy below (\d+)% (?:HP|Vitality|Health)/i, (m) => ({ kind: 'afterEnemyHpBelow', pct: Number(m[1]) })],
  [/^After you (?:Dodge|evade) a Magic attack/i, () => ({ kind: 'afterDodgeMagic' })],
  [/^After you (?:Dodge|evade)/i, () => ({ kind: 'afterDodge' })],
  [/after you (?:Dodge|evade)/i, () => ({ kind: 'afterDodge' })],
  [/^After two consecutive (?:Dodges|evades)/i, () => ({ kind: 'afterConsecutiveDodges', count: 2 })],
  [/^After a critical hit/, () => ({ kind: 'afterCrit' })],
  [/^After applying a stat debuff/, () => ({ kind: 'afterApplyDebuff' })],
  [/^After applying an ailment/, () => ({ kind: 'afterApplyAilment' })],
  [/^After you apply an ailment stack/, () => ({ kind: 'afterApplyAilment' })],
  [/^(?:After|When you) cleans(?:ing|e) a debuff( or ailment)?/, (m) => ({ kind: 'afterCleanse', includesAilment: !!m[1] })],
  [/^After dealing (?:Aspect-|Affinity )?dominant (?:Aspect |Affinity )?damage/, () => ({ kind: 'afterDominantHit' })],
  [/^After you heal or gain a (?:Shield|Barrier)/, () => ({ kind: 'afterHealOrShield' })],
  [/^After healing/, () => ({ kind: 'afterHeal' })],
  [/^After landing a (?:Physical|Martial) skill/, () => ({ kind: 'afterPhysicalHit' })],
  [/^After taking reduced damage/, () => ({ kind: 'afterReducedDamage' })],
  [/^After using two different staff skills/, () => ({ kind: 'afterTwoDifferentStaffSkills' })],
  [/^After using two different 1 EN actions in one turn/, () => ({ kind: 'afterTwoDifferent1En' })],
  [/^After using both Grimoire attacks/, () => ({ kind: 'afterBothGrimoireAttacks' })],
  [/^After using a Magic skill/, () => ({ kind: 'afterMagicSkill' })],
  [/^After using an Armour Technique/, () => ({ kind: 'afterArmourTechnique' })],
  [/^After you Guard/, () => ({ kind: 'afterGuard' })],
  [/^After you act before the enemy/, () => ({ kind: 'afterActFirst' })],
  [/^After you (?:break Guard|remove an enemy's Brace)/, () => ({ kind: 'afterBreakGuard' })],
  [/^After you take damage/, () => ({ kind: 'afterTakeDamage' })],
  [/after taking Magic damage/, () => ({ kind: 'afterTakeMagicDamage' })],
  [/^After your Armour Technique absorbs a hit/, () => ({ kind: 'afterArmourAbsorb' })],
  [/when an Armour Technique reduces damage/, () => ({ kind: 'afterArmourAbsorb' })],
  [/^When Verse and Chorus triggers/, () => ({ kind: 'onClassPerk', perk: 'verseAndChorus' })],
  [/^If acting before the target, your first 2\+ EN Martial weapon attack/, () => ({ kind: 'actingFirstMartial', minEn: 2 })],
  [/^If acting before the target, your first Night Magic attack/, () => ({ kind: 'actingFirst', aspect: 'night', category: 'magic' })],
  [/^When Brace reduces damage or a Barrier absorbs damage/, () => ({ kind: 'afterReducedDamage' })],
  [/^The first time each battle a song grants Might Up or Focus Up/, () => ({ kind: 'afterSongBuff', stats: ['atk', 'matk'] })],
  [/^The first time each turn you take damage while above (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'onDamagedHighHp', pct: Number(m[1]) })],
  [/^If you did not use a damaging action last turn/, () => ({ kind: 'noDamageActionLastTurn' })],
  [/^Your first Martial attack after using ([A-Za-z' -]+?) ignores/, (m) => ({ kind: 'afterSkillUse', skill: m[1], nextMartialPen: true })],
  [/^The first time each turn you damage a debuffed target with Storm/, () => ({ kind: 'vsTargetState', state: 'debuffed', aspect: 'storm' })],
  [/^While the target is below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/^While below (\d+)% (?:HP|Vitality|Health), the first song you use/, (m) => ({ kind: 'whileHpBelow', pct: Number(m[1]), skillClass: 'song' })],
  [/^While below (\d+)% (?:HP|Vitality|Health), take/, (m) => ({ kind: 'whileHpBelow', pct: Number(m[1]) })],
  [/^After using ([A-Za-z' -]+?),/, (m) => ({ kind: 'afterSkillUse', skill: m[1] })],
  [/^After ([A-Za-z' -]+?) (lands|hits|cleanses a debuff|absorbs damage),/, (m) => ({ kind: 'afterSkillEvent', skill: m[1], event: m[2] })],
  [/^After ([A-Za-z' -]+?),/, (m) => ({ kind: 'afterSkillUse', skill: m[1] })],
  [/^Against a target below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/against a target below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/^Once per combat against a target below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/after reducing an enemy below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'afterEnemyHpBelow', pct: Number(m[1]) })],
  [/^Against a target with Delayed damage stored/, () => ({ kind: 'vsTargetDelayed' })],
  [/^Against a target with (Bleed|Burn|Poison|Shock|Chill(?:ed)?)\b/, (m) => ({ kind: 'vsTargetState', state: m[1] })],
  [/^Against a (Bleeding or Poisoned|Bleeding|Poisoned|debuffed|Braced) target/, (m) => ({ kind: 'vsTargetState', state: m[1] })],
  [/against a (Bleeding or Poisoned|Bleeding|Poisoned|debuffed|Braced) target/, (m) => ({ kind: 'vsTargetState', state: m[1] })],
  [/^(?:At combat start|Before combat)/, () => ({ kind: 'combatStart' })],
  [/^At the start of each turn, if the enemy has a buff/, () => ({ kind: 'turnStartEnemyBuffed' })],
  [/^If hit while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'hitWhileSkillActive', skill: m[1] })],
  [/^(?:If you are|While) faster(?: than the enemy)?/, () => ({ kind: 'whileFaster' })],
  [/^If you took no damage since your previous turn/, () => ({ kind: 'noDamageSinceLastTurn' })],
  [/^Shields created while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'shieldsWhileSkillActive', skill: m[1] })],
  [/while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'whileSkillActive', skill: m[1] })],
  [/^While protected by a (?:Shield|Barrier)/, () => ({ kind: 'whileShielded' })],
  [/^While below (\d+)% (?:HP|Vitality|Health)/, (m) => ({ kind: 'whileHpBelow', pct: Number(m[1]) })],
  [/^The first (?:Aspect|Affinity) weakness hit each turn/, () => ({ kind: 'firstAspectWeaknessHit' })],
  [/^The first damaging attack that would hit after ([A-Za-z' -]+)/, (m) => ({ kind: 'firstIncomingHitAfterSkill', skill: m[1] })],
  [/^The first damaging hit received after an Armour Technique/, () => ({ kind: 'firstHitReceivedAfterArmourTechnique' })],
  [/^The first heal received at full (?:HP|Vitality|Health)/, () => ({ kind: 'firstHealAtFullHp' })],
  [/^The first successful (?:Dodge|evade|Evasion)/i, () => ({ kind: 'firstDodge' })],
  [/^The first time you Guard/, () => ({ kind: 'firstGuard' })],
  [/^The first time you gain Brace/, () => ({ kind: 'firstBrace' })],
  [/first ([A-Za-z' -]+?) critical hit/, (m) => ({ kind: 'skillCrit', skill: m[1] })],
  [/^When ([A-Za-z' -]+?) hits an (?:Aspect|Affinity) weakness/, (m) => ({ kind: 'onAspectWeaknessHit', skill: m[1] })],
  [/^When you hit an (?:Aspect|Affinity) weakness/, () => ({ kind: 'onAspectWeaknessHit' })],
  [/^When ([A-Za-z' -]+?) hits a (?:Guarded|Braced) target/, (m) => ({ kind: 'onSkillHitGuarded', skill: m[1] })],
  [/^When an ailment upgrades/, () => ({ kind: 'onAilmentUpgrade' })],
  [/prevent the next ailment from upgrading/, () => ({ kind: 'onAilmentUpgrade' })],
  [/^When Burn reaches 5 stacks/, () => ({ kind: 'vsScorchedTarget' })],
  [/^While (?:Shielded|Barriered)/, () => ({ kind: 'whileShielded' })],
  [/^While affected by an ailment/, () => ({ kind: 'whileAilmented' })],
  [/^Your Armour Technique/, () => ({ kind: 'armourTechniqueModifier' })],
  [/^Your first landed weapon hit/, () => ({ kind: 'firstWeaponHit' })],
  [/^Your first resisted hit/, () => ({ kind: 'firstResistedHit' })],
  [/^Damage-linked healing from ([A-Za-z' -]+?) skills/, (m) => ({ kind: 'skillHealingModifier', family: m[1] })],
  [/^Overhealing from ([A-Za-z' -]+?) becomes/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/after a landed (?:Physical|Martial) hit against your Shield/, () => ({ kind: 'hitOnShieldReceived' })],
  [/lethal damage leaves you at 1 (?:HP|Vitality|Health)/, () => ({ kind: 'onLethalDamage' })],
  [/a landed ([A-Za-z' -]+?) applies/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/a resisted ([A-Za-z' -]+?) hit is treated/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/when the two equipped Orbs have different (?:Aspects|Affinities)/, () => ({ kind: 'skillModifier', condition: 'differentOrbAspects' })],
  [/^(?:Minor|Moderate|Major) [A-Za-z %]+ (?:Up|Down)\b.*while equipped/, () => ({ kind: 'whileEquipped' })],
  [/^([A-Z][A-Za-z' -]+?) (?:also grants|also restores|grants|gains|applies|heals|stores|persists|breaks|makes|deals|extends|may choose|may cleanse|may replace|also restores)\b/,
    (m) => ({ kind: 'skillModifier', skill: m[1] }), 'case-sensitive'],
];
// Compile case-insensitive variants except entries that rely on capitalisation.
const TRIGGER_TABLE = TRIGGER_TABLE_RAW.map(([re, mk, mode]) => [
  mode === 'case-sensitive' || re.flags.includes('i') ? re : new RegExp(re.source, re.flags + 'i'),
  mk,
]);

// Non-tiered exact effects. Multiple may match one text.
const SPECIAL_TABLE = [
  [/makes a second hit at (\d+)% Ability Power/, (m) => ({ id: 'extraHit', apPct: Number(m[1]) })],
  [/deals one additional (\d+)% Ability Power hit/, (m) => ({ id: 'extraHit', apPct: Number(m[1]) })],
  [/return fixed damage equal to (\d+)% of the damage received/, (m) => ({ id: 'returnDamage', source: 'damageReceived', pct: Number(m[1]) })],
  [/return fixed damage equal to (\d+)% of your Max HP/, (m) => ({ id: 'returnDamage', source: 'maxHp', pct: Number(m[1]) })],
  [/reflect (\d+)% of damage taken/, (m) => ({ id: 'returnDamage', source: 'damageReceived', pct: Number(m[1]) })],
  [/gain a Shield equal to (\d+)% Max HP/, (m) => ({ id: 'shield', maxHpPct: Number(m[1]) })],
  [/Shield equal to (\d+)% Max HP/, (m) => ({ id: 'shield', maxHpPct: Number(m[1]) })],
  [/appl(?:y|ies) (\d+) Burn stacks?/i, (m) => ({ id: 'applyAilment', ailment: 'burn', stacks: Number(m[1]) })],
  [/appl(?:y|ies) (\d+) Chilled stacks?/i, (m) => ({ id: 'applyAilment', ailment: 'chilled', stacks: Number(m[1]) })],
  [/appl(?:y|ies) (\d+) Poison stacks?/i, (m) => ({ id: 'applyAilment', ailment: 'poison', stacks: Number(m[1]) })],
  [/applies Bleed\b/, () => ({ id: 'applyAilment', ailment: 'bleed', stacks: 1 })],
  [/Heal (\d+)% Max (?:HP|Vitality|Health)/i, (m) => ({ id: 'healMaxHp', pct: Number(m[1]) })],
  [/heals? (\d+)% Max (?:HP|Vitality|Health)/i, (m) => ({ id: 'healMaxHp', pct: Number(m[1]) })],
  [/take (\d+)% less Martial damage/i, (m) => ({ id: 'damageReduction', tier: 'minor', dmgType: 'physical', pct: Number(m[1]) })],
  [/(Minor|Moderate|Major) (?:Damage Reduction|Brace(?: Down)?)/i, (m) => ({ id: 'damageReduction', tier: m[1].toLowerCase() })],
  [/appl(?:y|ies) (\d+) (?:additional )?(?:stacks? of (?:its|the wand's|an) aligned ailment|aligned ailment stacks?|aligned base stacks?)/,
    (m) => ({ id: 'applyAlignedAilment', stacks: Number(m[1]) })],
  [/applies (\d+) additional aligned ailment stack/, (m) => ({ id: 'applyAlignedAilment', stacks: Number(m[1]) })],
  [/stores? (?:an additional )?(\d+)%(?: of its damage| Ability Power| this technique's total scaling)? as Delayed damage/, (m) => ({ id: 'delayedStore', pct: Number(m[1]) })],
  [/heals? for (\d+)% of damage dealt/, (m) => ({ id: 'healOnDamage', pct: Number(m[1]) })],
  [/overhealing becomes a Barrier/i, () => ({ id: 'overhealToBarrier' })],
  [/Overhealing from .+ becomes a Barrier/i, () => ({ id: 'overhealToBarrier' })],
  [/converts all overhealing into a Barrier/i, () => ({ id: 'overhealToBarrier' })],
  [/gain a (?:Shield|Barrier) equal to (\d+)% Max (?:HP|Vitality|Health)/, (m) => ({ id: 'shield', maxHpPct: Number(m[1]) })],
  [/(?:Shield|Barrier) equal to (\d+)% Max (?:HP|Vitality|Health)/, (m) => ({ id: 'shield', maxHpPct: Number(m[1]) })],
  [/makes a second hit at (\d+)% (?:Ability Power|this technique's total scaling)/, (m) => ({ id: 'extraHit', apPct: Number(m[1]) })],
  [/deals one additional hit at (\d+)%/i, (m) => ({ id: 'extraHit', apPct: Number(m[1]) })],
  [/ignores (\d+)% Guard/i, (m) => ({ id: 'ignoreGuardPct', pct: Number(m[1]) })],
  [/ignores (\d+)% Resolve/i, (m) => ({ id: 'ignoreResolvePct', pct: Number(m[1]) })],
  [/Ignore (\d+)% Guard/i, (m) => ({ id: 'ignoreGuardPct', pct: Number(m[1]) })],
  [/Ignore (\d+)% Resolve/i, (m) => ({ id: 'ignoreResolvePct', pct: Number(m[1]) })],
  [/cannot be Dodged/i, () => ({ id: 'cannotBeDodged' })],
  [/breaks Guard/i, () => ({ id: 'breakGuard' })],
  [/return fixed damage equal to (\d+)% of your Max (?:HP|Vitality|Health)/i, (m) => ({ id: 'returnDamage', source: 'maxHp', pct: Number(m[1]) })],
  [/restores? (\d+)% Max Health/i, (m) => ({ id: 'healMaxHp', pct: Number(m[1]) })],
  [/applies? 1 Bleed stack/i, () => ({ id: 'applyAilment', ailment: 'bleed', stacks: 1 })],
  [/choose one Affinity|may choose any Affinity|reveal the enemy/i, () => ({ id: 'narrativeSpecial' })],
  [/ready .+ without its paired cooldown/i, () => ({ id: 'readySkill' })],
  [/resets? .+ cooldown/i, () => ({ id: 'resetCooldown' })],
  [/automatically gain .+ base effect/i, () => ({ id: 'autoCastTechnique' })],
  [/capped at (\d+)% Max Health/i, (m) => ({ id: 'barrierCap', pct: Number(m[1]) })],
  [/overhealing(?: from [A-Za-z' -]+?)? becomes a Shield(?:, capped at (\d+)% Max HP)?/i,
    (m) => ({ id: 'overhealToShield', capMaxHpPct: m[1] ? Number(m[1]) : null })],
  [/converts all overhealing into a Shield/, () => ({ id: 'overhealToShield', capMaxHpPct: null })],
  [/restores (\d+)% Max HP at the end of your next turn as a delayed heal/, (m) => ({ id: 'delayedHeal', maxHpPct: Number(m[1]) })],
  [/cleanse (\d+|all) (?:debuffs?(?: and ailments?)?|ailments?)/i, (m) => ({ id: 'cleanse', count: m[1] === 'all' ? 'all' : Number(m[1]) })],
  [/may cleanse (\d+) ailment/, (m) => ({ id: 'cleanse', count: Number(m[1]), scope: 'ailment' })],
  [/breaks? Guard/i, () => ({ id: 'breakGuard' })],
  [/cannot be Dodged/, () => ({ id: 'undodgeable' })],
  [/ignores (\d+)% (DEF|MDEF)/, (m) => ({ id: 'penetration', pct: Number(m[1]), stat: m[2] === 'DEF' ? 'physical' : 'magic' })],
  [/may choose any Aspect before (?:use|damage is resolved)/, () => ({ id: 'chooseAspect' })],
  [/choose one Aspect; the first Neutral Basic Attack you land adopts that Aspect/, () => ({ id: 'adoptAspect' })],
  [/reveal the enemy's equipped Ultimate source and current Aspect/, () => ({ id: 'revealEnemyInfo' })],
  [/resisted (?:[A-Za-z' -]+? )?hit is treated as Neutral/, () => ({ id: 'resistedToNeutral' })],
  [/resets ([A-Za-z' -]+?)'s cooldown/, (m) => ({ id: 'resetCooldown', skill: m[1] })],
  [/immediately ready ([A-Za-z' -]+?) without its paired cooldown/, (m) => ({ id: 'resetCooldown', skill: m[1] })],
  [/extends the target's current stat debuff by (\d+) turn/, (m) => ({ id: 'extendDebuff', turns: Number(m[1]) })],
  [/prevent the next ailment from upgrading[^.]*remove (\d+) stack instead/, (m) => ({ id: 'preventAilmentUpgrade', removeStacks: Number(m[1]) })],
  [/lethal damage leaves you at 1 HP/, () => ({ id: 'surviveLethal' })],
  [/is Dodged instead/, () => ({ id: 'autoDodge' })],
  [/automatically gain ([A-Za-z' -]+?)'s base effect/, (m) => ({ id: 'autoTriggerSkill', skill: m[1] })],
  [/persists until battle end/, () => ({ id: 'persistUntilBattleEnd' })],
  [/the count resets when hit/, () => ({ id: 'resetCounterOnHit' })],
  [/matching its scaling stat/, () => ({ id: 'statMatchesScaling' })],
  [/\+(\d+)% Dodge/, (m) => ({ id: 'flatStat', stat: 'dodge', amount: Number(m[1]) })],
];

function parseEffectText(text, { strict, mode }) {
  const clean = String(text || '').trim();
  if (!clean) return null;

  const limit = extractLimit(clean);
  // Strip leading limit clause so trigger regexes see the real clause.
  let body = clean.replace(/^Once per (?:turn|combat)(?: |, ?)/i, '');
  body = body.charAt(0).toUpperCase() + body.slice(1);

  let trigger = null;
  for (const [re, mk] of TRIGGER_TABLE) {
    const m = body.match(re);
    if (m) { trigger = mk(m); break; }
  }
  // Utility/rider texts are on-use actions; a plain "Gain X / Apply Y" needs no trigger clause.
  if (!trigger && mode === 'action' && /^(Gain|Apply|Heal|Copy|Repeat|Cleanse)\b/i.test(body)) {
    trigger = { kind: 'onUse' };
  }

  const effects = [];
  let m;
  TIER_EFFECT_RE.lastIndex = 0;
  while ((m = TIER_EFFECT_RE.exec(clean))) {
    const stat = statKeyFor(m[2]);
    effects.push({
      kind: 'tierStat',
      tier: m[1].toLowerCase(),
      stat,
      dir: m[3].toLowerCase(),
      target: /\bapply\b|\bapplies\b|to the attacker|to the target/.test(clean) && m[3] === 'Down' ? 'enemy' : 'self',
    });
  }

  const specials = [];
  for (const [re, mk] of SPECIAL_TABLE) {
    const sm = clean.match(re);
    if (sm) specials.push(mk(sm));
  }
  // statMatchesScaling: the "X Up or Y Up" pair is one conditional effect, not two.
  if (specials.some((s) => s.id === 'statMatchesScaling') && effects.length) {
    effects.splice(1); // keep first; runtime resolves the stat from scaling stat
    effects[0] = Object.assign({}, effects[0], { stat: 'scalingStat' });
  }

  const duration = extractDuration(clean);
  const parsed = {
    text: clean,
    trigger,
    limit,
    duration,
    effects,
    specials,
  };

  const problems = [];
  if (!trigger) problems.push('no trigger classification');
  if (!effects.length && !specials.length) problems.push('no effects or specials extracted');
  if (problems.length) {
    if (strict) fail(`effect text unparseable (${problems.join('; ')}): "${clean}"`);
    else return null;
  }
  return parsed;
}

/* ------------------------------------------------------------------ *
 * Bird key mapping                                                    *
 * ------------------------------------------------------------------ */

const BIRD_KEY_ALIASES = {
  'Peregrine Falcon': 'peregrine',
  'Snowy Owl': 'snowyOwl',
  'Black Cockatoo': 'blackCockatoo',
  'Superb Fairywren': 'fairywren',
  'Willie Wagtail': 'wagtail',
  'Barn Owl': 'barnowl',
  'Blue Jay': 'bluejay',
  'Bush Turkey': 'bushturkey',
  'Golden Eagle': 'goldeneagle',
  'Australian Pelican': 'pelican',
  'Marabou Stork': 'marabou',
  'Emperor Penguin': 'penguin',
  'Harpy Eagle': 'harpy',
  'Bald Eagle': 'baldEagle',
  'Secretary Bird': 'secretary',
  'Shoebill Stork': 'shoebill',
  'Duke Blakiston': 'dukeBlakiston',
  'Rock Pigeon': 'rockPigeon',
  'Rock Dove': 'rockDove',
};

function birdKeyFor(name, existingKeys) {
  if (BIRD_KEY_ALIASES[name]) return BIRD_KEY_ALIASES[name];
  const lower = name.toLowerCase().replace(/[^a-z]/g, '');
  for (const k of existingKeys) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

function loadExistingBirdKeys() {
  const src = readFileSync(path.join(ROOT, 'js', 'data', 'birds.js'), 'utf8');
  const keys = [];
  for (const m of src.matchAll(/^ {2}([a-zA-Z]+):\{/gm)) keys.push(m[1]);
  return keys;
}

/* ------------------------------------------------------------------ *
 * Generated-file writer                                               *
 * ------------------------------------------------------------------ */

let META = { version: '?', updated: '?' };

function excelSerialToIso(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return String(v);
  const ms = Math.round((n - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function writeDataFile(relPath, namespaceExpr, data, note) {
  const abs = path.join(ROOT, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  const body = [
    `/* GENERATED by scripts/import-equipment-workbook.mjs — do not edit by hand.`,
    ` * Source workbook: Equipment v${META.version} (updated ${META.updated})` + (note ? `\n * ${note}` : ''),
    ` */`,
    `(function () {`,
    `  'use strict';`,
    `  var Avian = globalThis.Avian || (globalThis.Avian = {});`,
    `  Avian.data = Avian.data || Object.create(null);`,
  ];
  if (namespaceExpr.startsWith('Avian.data.combatPack.')) {
    body.push(`  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);`);
  }
  if (namespaceExpr.startsWith('Avian.data.equipment.')) {
    body.push(`  Avian.data.equipment = Avian.data.equipment || Object.create(null);`);
  }
  body.push(`  ${namespaceExpr} = Object.freeze(${JSON.stringify(data)});`);
  body.push(`})();`, ``);
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
const need = ['Dashboard', 'Slot Rules', 'Stat Definitions', 'Effect Tiers', 'Rarity Budgets', 'Skill Library',
  'Equipment Catalogue', 'Equipment Stats', 'Equipment Families', 'Reference Loadouts', 'Class Perks',
  'Bird Stats', 'Bird Abilities', 'Data Lists'];
for (const n of need) {
  if (!sheets[n]) { console.error('Missing sheet:', n); process.exit(1); }
}
const affinitySheetName = sheets['Affinities & Ailments']
  ? 'Affinities & Ailments'
  : (sheets['Aspects & Ailments'] ? 'Aspects & Ailments' : null);
if (!affinitySheetName) {
  console.error('Missing sheet: Affinities & Ailments (or Aspects & Ailments)');
  process.exit(1);
}

// Dashboard metadata: find labelled cells anywhere on the sheet
function dashValue(label) {
  for (const row of Object.values(sheets['Dashboard'])) {
    const i = row.indexOf(label);
    if (i >= 0) {
      for (let j = i + 1; j < row.length; j++) if (row[j] !== '') return row[j];
    }
  }
  return '';
}
META.version = dashValue('Design Version') || '0.3';
META.updated = excelSerialToIso(dashValue('Last Updated'));

/* ---- Slot Rules (v0.9 aggregate slots → seven loadout keys) ---- */
const slots = {
  helmet: {
    label: 'Helmet',
    accepts: 'Helmet',
    handCapacity: 0,
    activeContribution: 'None by default',
    duplicateAllowed: false,
    budgetClass: 'Helmet',
    notes: 'Passive stats and named effects.',
  },
  armour: {
    label: 'Armour/Plumage',
    accepts: 'Armour',
    handCapacity: 0,
    activeContribution: 'Armour Technique; Gold/Orange may offer Ultimate',
    duplicateAllowed: false,
    budgetClass: 'Armour',
    notes: 'Light, Medium, Heavy or Mystic.',
  },
  mainHand: {
    label: 'Main Weapon',
    accepts: 'Weapon',
    handCapacity: 2,
    activeContribution: 'Weapon Skill A; two-handed also supplies Skill B',
    duplicateAllowed: false,
    budgetClass: 'Weapon 1H / Weapon 2H',
    notes: 'May be paired with another one-handed weapon or a wing-mounted Shield.',
  },
  offHand: {
    label: 'Off Hand',
    accepts: 'Weapon',
    handCapacity: 1,
    activeContribution: 'Off-hand Skill, paired technique, or Shield modifiers',
    duplicateAllowed: true,
    budgetClass: 'Weapon 1H',
    notes: 'Accepts one-handed weapons or Shields. Must be empty of weapons when the main weapon is two-handed; Shields remain allowed with two-handed mains.',
  },
  ankletL: {
    label: 'Left Anklet',
    accepts: 'Anklet',
    handCapacity: 0,
    activeContribution: 'None',
    duplicateAllowed: true,
    budgetClass: 'Anklet',
    notes: 'Half-strength passive rolls; two anklets ≈ one full slot.',
  },
  ankletR: {
    label: 'Right Anklet',
    accepts: 'Anklet',
    handCapacity: 0,
    activeContribution: 'None',
    duplicateAllowed: true,
    budgetClass: 'Anklet',
    notes: 'Half-strength passive rolls; two anklets ≈ one full slot.',
  },
  necklace: {
    label: 'Necklace',
    accepts: 'Necklace',
    handCapacity: 0,
    activeContribution: 'None',
    duplicateAllowed: false,
    budgetClass: 'Necklace',
    notes: 'Three-quarter-strength passive rolls; utility preferred.',
  },
};
const budgetClassMultipliers = { ...BUDGET_CLASS_MULTIPLIERS };

/* ---- Stat Definitions → cost vector + forbidden stats ---- */
const statCosts = {}; // statKey → cost per stored decimal unit
const statDisplayNames = {};
const forbiddenStatIds = [];
for (const { cells } of tableRows(sheets['Stat Definitions'], 4)) {
  const statId = cells[1];
  if (!statId) continue;
  const status = cells[5] || '';
  /* v0.7 used Allowed/Removed; v0.9 uses Equipment Rule (Flat only / Controlled…). */
  const isCoreOrSecondary = /Allowed|Flat only|Controlled/i.test(status)
    && !/Not a normal item roll|Removed|Not available|Action-owned/i.test(status);
  if (isCoreOrSecondary) {
    const key = STAT_ID_MAP[statId];
    if (!key || key === 'hpBase') {
      if (key !== 'hpBase') warn('Skipping unmapped Stat Definitions row: ' + statId);
      continue;
    }
    const costVal = num(cells[6]);
    const fallback = FALLBACK_STAT_COSTS[key] || FLAT_STAT_COST[key] || 0;
    statCosts[key] = costVal > 0 ? costVal : fallback;
    statDisplayNames[key] = cells[2] || CANONICAL_STAT_DISPLAY_NAMES[key] || statId;
  } else if (/Removed|Not available|Action-owned/i.test(status)) {
    forbiddenStatIds.push(statId);
  }
}
for (const [key, cost] of Object.entries(FALLBACK_STAT_COSTS)) {
  if (statCosts[key] == null || !(statCosts[key] > 0)) statCosts[key] = cost;
}
if (statCosts.dex == null) statCosts.dex = FLAT_STAT_COST.dex;
for (const [key, label] of Object.entries(CANONICAL_STAT_DISPLAY_NAMES)) {
  if (!statDisplayNames[key]) statDisplayNames[key] = label;
}
if (Object.keys(statCosts).length < 8) warn(`Stat Definitions yielded ${Object.keys(statCosts).length} cost keys (using fallbacks)`);

// Cross-check cost vector vs Data Lists when numeric costs are present (v0.6 layout).
{
  const dl = sheets['Data Lists'][5] || [];
  const first = num(dl[12]);
  if (first > 0) {
    STAT_ORDER.forEach((key, i) => {
      const dlCost = num(dl[12 + i]);
      if (dlCost > 0 && dlCost !== statCosts[key]) {
        warn(`Data Lists cost vector mismatch for ${key}: ${dlCost} vs ${statCosts[key]} (using Stat Definitions / fallback)`);
      }
    });
  }
}

/* ---- Effect Tiers (v0.9 flat integer tiers) ---- */
const tierRows = { minor: sheets['Effect Tiers'][5], moderate: sheets['Effect Tiers'][6], major: sheets['Effect Tiers'][7] };
const effectTiers = {
  packVersion: EQUIPMENT_PACK_VERSION,
  buff: {},
  debuff: {},
  points: {},
  brace: {},
  stacking: {
    mode: 'strongestPerDirection',
    coreTempCapPct: 20,
    precisionTempCapPoints: 12,
  },
  flatStat: true,
};
for (const [tier, row] of Object.entries(tierRows)) {
  if (!row) { fail('Effect Tiers row missing for ' + tier); continue; }
  const up = Math.abs(Math.round(num(row[1])));
  const down = Math.abs(Math.round(num(row[2])));
  effectTiers.buff[tier] = up;
  effectTiers.debuff[tier] = down;
  effectTiers.brace[tier] = up;
  effectTiers.points[tier] = up;
}

/* ---- Rarity Budgets + coefficient bands ---- */
const rarityBudgets = {};
for (let r = 5; r <= 10; r++) {
  const row = sheets['Rarity Budgets'][r];
  const key = RARITY_KEYS[row[0]];
  if (!key) { fail('Unknown rarity: ' + row[0]); continue; }
  rarityBudgets[key] = {
    rank: num(row[1]),
    attributeLines: num(row[2]),
    namedBonuses: num(row[3]),
    uniqueRule: uniqueRuleFromPermission(row[4]),
    weaponDamageFactor: num(row[5]),
    typicalCoreRoll: num(row[6]),
    vitalityRoll: num(row[7]),
    skillPowerRule: row[8] || '',
    designRole: row[9] || '',
    /* Legacy aliases for budget audit helpers */
    baseBudget: num(row[6]),
    targetLow: 0.85,
    targetHigh: 1.15,
  };
}
const skillPowerBands = {};
for (const [en, band] of Object.entries(EN_MASTER_BANDS)) {
  skillPowerBands[en] = {
    minSkillPower: band.min,
    maxSkillPower: band.max,
    minAp: band.min,
    maxAp: band.max,
    use: 'R-EN-005',
  };
}
const apBands = { ...skillPowerBands };

/* ---- Skill Library (v0.9 weapon-first skill power) ---- */
const skills = {};
function parseComboRider(text) {
  const t = String(text || '');
  let m;
  if ((m = t.match(/apply (\d+) Poison stack/i))) {
    return { kind: 'applyAilment', ailment: 'poison', stacks: Number(m[1]), when: 'onLand' };
  }
  if ((m = t.match(/apply (\d+) Burn stack/i))) {
    return { kind: 'applyAilment', ailment: 'burning', stacks: Number(m[1]), when: 'onLand' };
  }
  if ((m = t.match(/apply (\d+) Chilled stack/i))) {
    return { kind: 'applyAilment', ailment: 'chilled', stacks: Number(m[1]), when: 'onLand' };
  }
  if ((m = t.match(/apply (\d+) Shock stack/i))) {
    return { kind: 'applyAilment', ailment: 'shock', stacks: Number(m[1]), when: 'onLand' };
  }
  if ((m = t.match(/apply (\d+) Bleed stack/i))) {
    return { kind: 'applyAilment', ailment: 'bleed', stacks: Number(m[1]), when: 'onLand' };
  }
  if (/75%.*25%|Echo/i.test(t) && /Delayed/i.test(t)) {
    return { kind: 'echoSplit', immediatePct: 0.75, delayedPct: 0.25, when: 'onLand' };
  }
  return parseEffectText(t, { strict: false, mode: 'action' });
}

for (const { cells, rowNum } of tableRows(sheets['Skill Library'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Skill Library row ${rowNum}: empty id`); continue; }
  const skillPowerRaw = num(cells[16]);
  const skillPowerPct = Math.round(skillPowerRaw * 100);
  const skillPower = skillPowerPct / 100;
  const perHitPower = num(cells[17]) || skillPower;
  const riderText = cells[18] || '';
  const source = cells[2] || '';
  const isCombo = id.startsWith('COMBO_') || /^Combination$/i.test(source);
  const primaryStat = mapScalingStat(cells[11]);
  const secondaryStat = mapScalingStat(cells[12]);
  const secondaryShare = num(cells[13], secondaryStat ? 0.5 : 0);
  const basePrecision = num(cells[20]);
  const en = num(cells[6]);
  const cooldown = num(cells[7]);
  const meterRaw = String(cells[8] || '');
  const meter = /^full$/i.test(meterRaw) ? 'full'
    : (/^once$/i.test(meterRaw) || isCombo) ? 'once'
    : 'none';
  const skillTypeRaw = cells[5] || '';
  const skillType = /Hybrid Attack/i.test(skillTypeRaw) ? 'Attack'
    : /Ultimate Attack/i.test(skillTypeRaw) ? 'Ultimate Attack'
    : /Ultimate Utility/i.test(skillTypeRaw) ? 'Ultimate Utility'
    : /Utility/i.test(skillTypeRaw) ? 'Utility'
    : skillTypeRaw;
  const dmgFields = parseDamageTypeFields(cells[10]);

  const expectCd = expectedCooldown(en);
  const enforceCd = /Attack/i.test(skillType) && !/Utility/i.test(skillType);
  if (enforceCd && expectCd != null && cooldown !== expectCd) {
    fail(`skill ${id}: cooldown ${cooldown} for EN ${en}, expected ${expectCd} (R-CD-001)`);
  }

  if (isCombo) {
    const mainTag = String(cells[3] || '').split('+')[0].trim();
    const focusMatch = String(cells[3] || '').match(/(Poison|Burn|Chill|Shock|Bleed|Echo)\s+Orb/i);
    const offHandOrbFocus = focusMatch ? focusMatch[1].toLowerCase() : null;
    const offTagMatch = String(cells[3] || '').match(/\+\s*(.+)$/);
    const offTag = offTagMatch ? offTagMatch[1].trim() : null;
    const share2 = secondaryStat ? (secondaryShare || 0.5) : 1;
    const primaryCoeff = skillPower * (secondaryStat ? (1 - share2) : 1);
    const secondaryCoeff = secondaryStat ? skillPower * share2 : 0;
    const scaling = [];
    if (primaryStat && primaryCoeff) {
      scaling.push({ stat: primaryStat, coeff: round2(primaryCoeff), ledgerKey: ledgerForScaling(primaryStat) });
    }
    if (secondaryStat && secondaryCoeff) {
      scaling.push({ stat: secondaryStat, coeff: round2(secondaryCoeff), ledgerKey: ledgerForScaling(secondaryStat) });
    }
    skills[id] = {
      id,
      name: cells[1],
      source: 'Combination',
      family: 'Combination',
      barSlot: cells[4],
      skillType,
      en,
      cooldown,
      meter,
      target: cells[9],
      damageType: dmgFields.damageType,
      damageCategory: dmgFields.damageCategory,
      scalingStat: null,
      scaling,
      aspectRule: offHandOrbFocus ? 'OffHandOrbAffinity' : 'MainHandAffinity',
      hits: num(cells[15]) || 1,
      skillPowerPct,
      skillPower,
      perHitSkillPower: round2(perHitPower),
      precision: basePrecision || 0.92,
      basePrecision: basePrecision || undefined,
      fixedCoefficient: skillPower,
      coefficientFixed: true,
      ap: null,
      riderText,
      rider: parseComboRider(riderText) || parseEffectText(riderText, { strict: false, mode: 'action' }),
      minRarity: RARITY_KEYS[cells[19]] || 'grey',
      classNote: cells[22] || 'Combination technique',
      pairKey: String(cells[3] || '').replace(/\s*\+\s*/g, '|'),
      mainTag,
      offTag,
      offHandOrbFocus,
    };
  } else {
    skills[id] = {
      id,
      name: cells[1],
      source,
      family: cells[3],
      barSlot: cells[4],
      skillType,
      en,
      cooldown,
      meter,
      target: cells[9],
      damageType: dmgFields.damageType,
      damageCategory: dmgFields.damageCategory,
      scalingStat: primaryStat,
      aspectRule: cells[14] || '',
      hits: num(cells[15]),
      skillPowerPct,
      skillPower,
      perHitSkillPower: round2(perHitPower),
      fixedCoefficient: skillPower,
      coefficientFixed: true,
      ap: null,
      riderText,
      rider: parseEffectText(riderText, { strict: false, mode: 'action' }),
      minRarity: RARITY_KEYS[cells[19]] || 'grey',
      classNote: cells[22] || '',
    };
    if (basePrecision) skills[id].basePrecision = basePrecision;
    if (/Dagger Pinion|Talon Dagger/i.test(cells[3] || '')) {
      skills[id].legacyFamily = 'Talon Dagger';
    }
  }

  const sk = skills[id];
  const band = skillPowerBands[String(sk.en)];
  const isUtil = sk.skillType === 'Utility' || sk.skillType === 'Ultimate Utility';
  if (!isUtil && band && skillPower > 0 && !isCombo) {
    if (skillPower > band.maxSkillPower + 1e-9) {
      fail(`skill ${id} skillPower ${skillPower} above EN ${sk.en} band max ${band.maxSkillPower}`);
    }
    if (skillPower < band.minSkillPower - 0.15) {
      warn(`skill ${id} skillPower ${skillPower} below EN ${sk.en} band min ${band.minSkillPower} (rider discount?)`);
    }
  }
}

for (const id of ['BASIC_PHYSICAL', 'BASIC_MAGIC']) {
  if (!skills[id]) continue;
  Object.assign(skills[id], {
    skillPowerPct: 100,
    skillPower: 1,
    fixedCoefficient: 1,
    naturalStrikeFlat: { min: 1, max: 2 },
    basePrecision: 1,
    coefficientFixed: true,
  });
}
const skillCount = Object.keys(skills).length;
const dashSkillCount = num(dashValue('Skill Templates'));
if (dashSkillCount && skillCount !== dashSkillCount) {
  warn(`Dashboard "Skill Templates"=${dashSkillCount} but Skill Library imported ${skillCount} (using library count)`);
}
if (skillCount < 82) fail(`expected ≥82 skill rows, got ${skillCount}`);
if (!skills.BASIC_PHYSICAL || !skills.BASIC_MAGIC) fail('missing BASIC_PHYSICAL / BASIC_MAGIC skill rows');

/* Every Combination Techniques Skill ID must resolve in the Skill Library. */
{
  const ctSheet = sheets['Combination Techniques'];
  if (ctSheet) {
    for (const { cells, rowNum } of tableRows(ctSheet, 3)) {
      const sid = cells[11];
      const en = num(cells[2]);
      if (!sid || !/^(PAIR_|COMBO_)/.test(sid) || !en) continue;
      if (!skills[sid]) fail(`Combination Techniques row ${rowNum}: Skill ID ${sid} missing from Skill Library`);
    }
  }
}

/* ---- Equipment Stats (v0.9 flat cores + secondary %) ---- */
const itemStats = {}; // id → { stats, attributeCount, weaponMeta }
for (const { cells, rowNum } of tableRows(sheets['Equipment Stats'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Equipment Stats row ${rowNum}: empty id`); continue; }
  const stats = flatStatsFromEquipmentRow(cells);
  const attrCount = num(cells[24]) || Object.keys(stats).filter((k) => k.endsWith('Flat')).length;
  itemStats[id] = {
    stats,
    attributeCount: attrCount,
    minDamage: num(cells[7]),
    maxDamage: num(cells[8]),
    damageType: cells[5] || '',
    scalingStat: mapScalingStat(cells[6]),
  };
}

/* ---- Equipment Catalogue ---- */
const items = {};
const familyRarityCounts = {};
for (const { cells, rowNum } of tableRows(sheets['Equipment Catalogue'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Equipment Catalogue row ${rowNum}: empty id`); continue; }
  const rarity = RARITY_KEYS[cells[5]];
  if (!rarity) { fail(`item ${id}: unknown rarity ${cells[5]}`); continue; }
  const es = itemStats[id];
  if (!es) { fail(`item ${id}: no Equipment Stats row`); continue; }

  const bonus1Text = cells[22] || '';
  const bonus2Text = cells[23] || '';
  const uniqueText = cells[24] || '';
  const tradeoffText = cells[25] || '';

  const bonuses = [];
  if (bonus1Text) bonuses.push({ text: bonus1Text, cost: 0, parsed: parseEffectText(bonus1Text, { strict: true }) });
  if (bonus2Text) bonuses.push({ text: bonus2Text, cost: 0, parsed: parseEffectText(bonus2Text, { strict: true }) });

  const catMin = num(cells[18]);
  const catMax = num(cells[19]);
  const dmgCat = parseDamageTypeFields(cells[16]);
  const item = {
    id,
    name: cells[1],
    slot: cells[2],
    subtype: cells[3],
    family: cells[4],
    rarity,
    rank: num(cells[6]),
    hands: num(cells[7]),
    budgetClass: cells[8],
    classRestriction: cells[9] || 'Any',
    preferredClasses: cells[10] || '',
    aspect: normalizeAffinity(cells[11]),
    skill1: cells[12] || null,
    skill2: cells[13] || null,
    pairedSkill: cells[14] || null,
    ultimate: cells[15] || null,
    damageType: dmgCat.damageType,
    damageCategory: dmgCat.damageCategory,
    scalingStat: mapScalingStat(cells[17]),
    minDamage: catMin || es.minDamage,
    maxDamage: catMax || es.maxDamage,
    flatCoreText: cells[20] || '',
    secondaryText: cells[21] || '',
    bonuses,
    uniqueEffect: uniqueText ? { text: uniqueText, cost: 0, parsed: parseEffectText(uniqueText, { strict: true }) } : null,
    tradeoff: tradeoffText ? { text: tradeoffText, credit: 0, parsed: parseEffectText(tradeoffText, { strict: true }) } : null,
    stats: es.stats,
    notes: cells[27] || '',
    npcEligible: /yes/i.test(cells[26] || ''),
  };
  if (cells[28]) item.audit = cells[28];
  if (/Focus Orb/i.test(item.family)) {
    const focusMatch = String(item.name).match(/\b(Poison|Burn|Chill(?:ed)?|Shock|Bleed|Echo)\b/i);
    if (focusMatch) {
      const raw = String(focusMatch[1]).toLowerCase();
      item.orbFocus = raw === 'chilled' ? 'chill' : raw;
    }
  }
  if (/Dagger Pinion/i.test(item.family)) item.legacyFamily = 'Talon Dagger';
  items[id] = item;
  familyRarityCounts[item.family] = familyRarityCounts[item.family] || {};
  familyRarityCounts[item.family][rarity] = (familyRarityCounts[item.family][rarity] || 0) + 1;

  /* --- audit re-implementation (fail-fast) --- */
  // hands/budget-class consistency
  if (item.budgetClass === 'Weapon 1H' && item.hands !== 1) fail(`item ${id}: Weapon 1H with hands=${item.hands}`);
  if (item.budgetClass === 'Weapon 2H' && item.hands !== 2) fail(`item ${id}: Weapon 2H with hands=${item.hands}`);
  if (item.budgetClass !== 'Weapon 1H' && item.budgetClass !== 'Weapon 2H' && item.hands !== 0) {
    fail(`item ${id}: non-weapon with hands=${item.hands}`);
  }
  // skill id resolution
  for (const [label, sid] of [['skill1', item.skill1], ['skill2', item.skill2], ['pairedSkill', item.pairedSkill], ['ultimate', item.ultimate]]) {
    if (sid && !skills[sid]) fail(`item ${id}: ${label} "${sid}" not in Skill Library`);
  }
  // rarity rules
  const rb = rarityBudgets[rarity];
  if (es.attributeCount !== rb.attributeLines) {
    warn(`item ${id}: ${es.attributeCount} attribute lines, expected ${rb.attributeLines}`);
  }
  if (bonuses.length !== rb.namedBonuses) {
    warn(`item ${id}: ${bonuses.length} named bonuses, expected ${rb.namedBonuses}`);
  }
  if (rb.uniqueRule === 'required' && !item.uniqueEffect) fail(`item ${id}: orange item missing unique effect`);
  if (rb.uniqueRule !== 'required' && item.uniqueEffect && rarity !== 'orange') {
    warn(`item ${id}: unique effect on ${rarity} item (workbook)`);
  }
  const mult = budgetClassMultipliers[item.budgetClass];
  if (mult == null) fail(`item ${id}: unknown budget class ${item.budgetClass}`);
  if (rb.typicalCoreRoll > 0 && mult > 0) {
    const roughLines = es.attributeCount + bonuses.length + (item.uniqueEffect ? 1 : 0);
    const used = roughLines / (rb.typicalCoreRoll * mult);
    if (used < rb.targetLow - 1e-6 || used > rb.targetHigh + 1e-6) {
      warn(`item ${id}: rough budget proxy ${(used * 100).toFixed(1)}% outside [${rb.targetLow * 100}%, ${rb.targetHigh * 100}%]`);
    }
  }
}
const itemCount = Object.keys(items).length;
if (itemCount !== 240) fail(`expected 240 items, got ${itemCount}`);

/* ---- Equipment Families (v0.9 weapon-first guide) ---- */
const families = {};
for (const { cells } of tableRows(sheets['Equipment Families'], 4)) {
  const name = cells[0];
  if (!name || name === 'Family') continue;
  const slotHands = parseFamilySlotHands(cells[1]);
  const notes = cells[12] || '';
  families[name] = {
    name,
    slot: slotHands.slot,
    hands: slotHands.hands,
    damageType: cells[2] || '',
    scalingStat: mapScalingStat(cells[3]),
    greyRange: cells[4] || '',
    greenRange: cells[5] || '',
    blueRange: cells[6] || '',
    purpleRange: cells[7] || '',
    goldRange: cells[8] || '',
    orangeRange: cells[9] || '',
    primaryFlatStats: cells[10] || '',
    identity: cells[11] || '',
    notes,
    skillA: null,
    skillB: null,
    ultimate: null,
    catalogueGroup: notes,
  };
  if (PENDING_FAMILIES.has(name) || /contentPending|Pending/i.test(notes)) {
    families[name].catalogueState = 'familyConfirmedContentPending';
    families[name].inventItems = false;
  }
}
if (Object.keys(families).length < 40) fail(`expected ≥40 families, got ${Object.keys(families).length}`);
for (const [fam, counts] of Object.entries(familyRarityCounts)) {
  if (!families[fam]) fail(`catalogue family "${fam}" not in Equipment Families sheet`);
  for (const rk of RARITY_ORDER) {
    if ((counts[rk] || 0) !== 1) fail(`family "${fam}": ${counts[rk] || 0} ${rk} items, expected 1`);
  }
}
for (const fam of Object.keys(families)) {
  if (!familyRarityCounts[fam]) {
    if (PENDING_FAMILIES.has(fam) || families[fam].catalogueState === 'familyConfirmedContentPending') {
      families[fam].catalogueState = 'familyConfirmedContentPending';
      families[fam].inventItems = false;
      continue;
    }
    fail(`family "${fam}" has no catalogue items`);
  }
}

/* ---- Reference Loadouts (Key | Class | Rarity | …) ---- */
const referenceLoadouts = [];
for (const { cells, rowNum } of tableRows(sheets['Reference Loadouts'], 4)) {
  const cls = cells[1] || cells[0];
  const rarity = RARITY_KEYS[cells[2]] || RARITY_KEYS[cells[1]];
  if (!cls || !rarity || !RARITY_KEYS[cells[2]]) {
    /* Legacy v0.3 layout fallback: Class | Rarity without Key */
    if (RARITY_KEYS[cells[1]] && cells[0]) {
      /* handled below via offset */
    } else {
      fail(`Reference Loadouts row ${rowNum}: bad class/rarity`);
      continue;
    }
  }
  const hasKeyCol = !!RARITY_KEYS[cells[2]];
  const className = hasKeyCol ? cells[1] : cells[0];
  const rarityKey = RARITY_KEYS[hasKeyCol ? cells[2] : cells[1]];
  if (String(className).toLowerCase() === 'duke') continue;
  const equipStart = hasKeyCol ? 3 : 2;
  const loadout = {
    class: String(className).toLowerCase(),
    rarity: rarityKey,
    equipment: {
      helmet: cells[equipStart] || null,
      armour: cells[equipStart + 1] || null,
      mainHand: cells[equipStart + 2] || null,
      offHand: cells[equipStart + 3] || cells[equipStart + 4] || null,
      ankletL: cells[equipStart + 5] || null,
      ankletR: cells[equipStart + 6] || null,
      necklace: cells[equipStart + 7] || null,
    },
    totals: {},
  };
  const flatStart = equipStart + 8;
  const flatMap = [
    ['hpFlat', flatStart], ['atkFlat', flatStart + 1], ['dexFlat', flatStart + 2], ['defFlat', flatStart + 3],
    ['matkFlat', flatStart + 4], ['mdefFlat', flatStart + 5], ['spdFlat', flatStart + 6],
  ];
  for (const [key, col] of flatMap) {
    const v = num(cells[col]);
    if (v !== 0) loadout.totals[key] = Math.round(v);
  }
  const crit = num(cells[flatStart + 7]); if (crit) loadout.totals.critChancePct = pct(crit);
  const fer = num(cells[flatStart + 8]); if (fer) loadout.totals.critDamagePct = ferocityToCritDamagePct(fer);
  const pp = num(cells[flatStart + 9]); if (pp) loadout.totals.physicalPenPct = pct(pp);
  const mp = num(cells[flatStart + 10]); if (mp) loadout.totals.magicPenPct = pct(mp);
  loadout.weaponMin = num(cells[flatStart + 11]);
  loadout.weaponMax = num(cells[flatStart + 12]);
  loadout.scalingStat = cells[flatStart + 13] || '';
  loadout.skillId = cells[flatStart + 14] || '';
  loadout.skillPower = num(cells[flatStart + 15]);
  // verify every referenced item exists + recompute totals
  const recomputed = {};
  for (const [slotKey, iid] of Object.entries(loadout.equipment)) {
    if (!iid) continue;
    const it = items[iid];
    if (!it) { fail(`reference loadout ${className}/${rarityKey}: ${slotKey} item "${iid}" not in catalogue`); continue; }
    for (const [sk, sv] of Object.entries(it.stats)) recomputed[sk] = round2((recomputed[sk] || 0) + sv);
  }
  loadout.totals = recomputed;
  /* 2H main clears offHand (including Shields) to match runtime equip rules. */
  const mainIt = loadout.equipment.mainHand ? items[loadout.equipment.mainHand] : null;
  if (mainIt && (Number(mainIt.hands) || 0) === 2 && loadout.equipment.offHand) {
    loadout.equipment.offHand = null;
    const refreshed = {};
    for (const [slotKey, iid] of Object.entries(loadout.equipment)) {
      if (!iid) continue;
      const it = items[iid];
      if (!it) continue;
      for (const [sk, sv] of Object.entries(it.stats)) refreshed[sk] = round2((refreshed[sk] || 0) + sv);
    }
    loadout.totals = refreshed;
  }
  referenceLoadouts.push(loadout);
}
if (referenceLoadouts.length !== 42) fail(`expected 42 reference loadouts (7 classes x 6 rarities; Duke excluded), got ${referenceLoadouts.length}`);

/* ---- Bird Stats → birds-v2 (v0.9 base allocation) ---- */
const existingBirdKeys = loadExistingBirdKeys();
const birdsV2 = {};
const birdNameToKey = {};
const BIRD_ATTR_BUDGET = { grey: 30, green: 30, blue: 30, purple: 30, gold: 32, orange: 34 };
const BIRD_ATTR_CAP = { grey: 10, green: 12, blue: 14, purple: 16, gold: 18, orange: 18 };
for (const { cells, rowNum } of tableRows(sheets['Bird Stats'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Bird Stats row ${rowNum}: empty name`); continue; }
  const key = birdKeyFor(name, existingBirdKeys);
  if (!key) { fail(`Bird Stats: no existing bird key for "${name}"`); continue; }
  birdNameToKey[name] = key;
  const cls = String(cells[1] || '').toLowerCase();
  const baseHealth = num(cells[7]);
  const vitality = num(cells[8]);
  const might = num(cells[9]);
  const dexterity = num(cells[10]);
  const guard = num(cells[11]);
  const focus = num(cells[12]);
  const resolve = num(cells[13]);
  const agility = num(cells[14]);
  const maxHp = Math.max(1, Math.round(baseHealth * (1 + vitality * 0.05)));
  const speciesTier = RARITY_KEYS[cells[3]] || String(cells[3] || '').toLowerCase();
  const attrSum = vitality + might + dexterity + guard + focus + resolve + agility;
  const budget = BIRD_ATTR_BUDGET[speciesTier];
  const cap = BIRD_ATTR_CAP[speciesTier];
  if (budget && attrSum !== budget) {
    warn(`bird ${name}: attribute sum ${attrSum}, expected ${budget} for tier ${speciesTier}`);
  }
  if (cap) {
    for (const [label, v] of [['vitality', vitality], ['might', might], ['dexterity', dexterity], ['guard', guard], ['focus', focus], ['resolve', resolve], ['agility', agility]]) {
      if (v > cap) warn(`bird ${name}: ${label} ${v} exceeds tier cap ${cap}`);
    }
  }
  birdsV2[key] = {
    name,
    class: cls,
    realSize: cells[2],
    speciesTier,
    tierRank: num(cells[4]),
    starter: /yes/i.test(cells[5] || ''),
    aspect: normalizeAffinity(cells[6]),
    baseHealth,
    vitality,
    stats: {
      vitality,
      atk: might,
      dex: dexterity,
      def: guard,
      matk: focus,
      mdef: resolve,
      spd: agility,
      hp: maxHp,
      maxHp,
      dodge: Math.min(50, agility * 0.5),
      acc: 0,
      critChance: pct(cells[16]),
    },
    critDamage: num(cells[17]),
    primaryScaling: cells[18],
    bossOverride: /OVERRIDE/i.test(cells[20] || '') || name === 'Duke Blakiston',
    roleNote: cells[19] || '',
    gearNote: '',
  };
}
if (Object.keys(birdsV2).length !== 52) fail(`expected 52 birds, got ${Object.keys(birdsV2).length}`);

function meanField(birds, pick) {
  if (!birds.length) return 0;
  return birds.reduce((s, b) => s + pick(b), 0) / birds.length;
}

/* Class Perks sheet is qualitative (High/Low directions) in v0.9 — keep authored perk text. */
const CLASS_PERK_CANON = {
  knight: {
    classPerk: 'Bulwark Oath',
    classPerkEffect: 'The first damaging hit received each turn deals 6% less damage (Minor).',
    classPerkTrigger: 'Once per turn; counts toward damage-reduction caps.',
  },
  rogue: {
    classPerk: 'Rogue Tempo',
    classPerkEffect: 'If acting before the target, the first Basic Attack each turn gains Minor Damage Up (+6%).',
    classPerkTrigger: 'Once per turn; equipment techniques do not qualify solely because of their EN cost.',
  },
  mage: {
    classPerk: 'Arcane Pressure',
    classPerkEffect: "Magic damage ignores 10% of the target's Resolve.",
    classPerkTrigger: 'Adds to skill and gear penetration; total Magic Penetration is capped at 40%.',
  },
  siren: {
    classPerk: 'Resonant Hex',
    classPerkEffect: 'Minor and Moderate stat debuffs you apply last 1 additional turn.',
    classPerkTrigger: '',
  },
  inquisitor: {
    classPerk: 'Judgement Leech',
    classPerkEffect: 'After a damaging skill hits an ailmented or debuffed target, restore 4% of missing EN (once per action).',
    classPerkTrigger: '',
  },
  bard: {
    classPerk: 'Verse and Chorus',
    classPerkEffect: 'When you alternate Martial and Magic damaging actions, the second action gains Minor Damage Up.',
    classPerkTrigger: '',
  },
  brute: {
    classPerk: 'Crushing Momentum',
    classPerkEffect: 'After taking damage, your next Martial damaging action gains Minor Damage Up.',
    classPerkTrigger: '',
  },
  duke: {
    classPerk: 'Duke Ascension',
    classPerkEffect: 'After defeating an enemy, gain +5% all damage for the remainder of the encounter (stacks once).',
    classPerkTrigger: '',
  },
};

/* ---- Class Perks → classes (reference averaged from birds-v2) ---- */
const classes = {};
for (const { cells, rowNum } of tableRows(sheets['Class Perks'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Class Perks row ${rowNum}: empty class`); continue; }
  const id = name.toLowerCase();
  const classBirds = Object.values(birdsV2).filter((b) => b.class === id);
  const reference = {
    hp: Math.round(meanField(classBirds, (b) => b.stats.maxHp)),
    atk: round2(meanField(classBirds, (b) => b.stats.atk)),
    dex: round2(meanField(classBirds, (b) => b.stats.dex)),
    def: round2(meanField(classBirds, (b) => b.stats.def)),
    matk: round2(meanField(classBirds, (b) => b.stats.matk)),
    mdef: round2(meanField(classBirds, (b) => b.stats.mdef)),
    spd: round2(meanField(classBirds, (b) => b.stats.spd)),
    dodge: round2(meanField(classBirds, (b) => b.stats.dodge)),
    acc: 0,
    critChance: round2(meanField(classBirds, (b) => b.stats.critChance)),
    critDamage: round2(meanField(classBirds, (b) => b.critDamage)),
  };
  const perk = CLASS_PERK_CANON[id] || {};
  classes[id] = {
    id,
    name,
    combatIdentity: cells[8] || cells[1] || '',
    reference,
    minAcc: 0,
    precisionSource: 'Skill Library',
    weights: {},
    classPerk: perk.classPerk || '',
    classPerkEffect: perk.classPerkEffect || '',
    classPerkTrigger: perk.classPerkTrigger || '',
    classPerkParsed: parseEffectText(perk.classPerkEffect || '', { strict: false }),
    equipmentDirection: cells[9] || '',
    baseHealthDirection: cells[1] || '',
    npcEquipmentPolicy: cells[9] || '',
    aiPolicy: cells[10] || '',
  };
}
if (Object.keys(classes).length !== 8) fail(`expected 8 classes, got ${Object.keys(classes).length}`);

/* ---- Bird Abilities → bird-passives-v2 + innate-utilities ---- */
const birdPassives = {};
const innateUtilities = {};
function utilityBudgetFor(en, cooldown) {
  if (en === 1) return cooldown >= 3 ? 2.5 : 2;
  if (en === 2) return cooldown >= 3 ? 4 : 3;
  return 5;
}
for (const { cells, rowNum } of tableRows(sheets['Bird Abilities'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Bird Abilities row ${rowNum}: empty name`); continue; }
  const key = birdNameToKey[name] || birdKeyFor(name, existingBirdKeys);
  if (!key) { fail(`Bird Abilities: no bird key for "${name}"`); continue; }
  const passiveScore = num(cells[6]);
  const passiveBudget = num(cells[7]);
  const utilEn = num(cells[10]);
  const utilCd = num(cells[11]);
  const utilScore = num(cells[14]);
  const utilBudget = num(cells[15]);
  const passiveParsed = parseEffectText(cells[4], { strict: false });
  if (passiveParsed && !passiveParsed.limit) {
    const lim = String(cells[5] || '');
    if (/once per combat|once per battle/i.test(lim)) passiveParsed.limit = 'oncePerCombat';
    else if (/once per turn/i.test(lim)) passiveParsed.limit = 'oncePerTurn';
  }
  birdPassives[key] = {
    bird: name,
    name: cells[3],
    effect: cells[4],
    triggerLimit: cells[5],
    score: passiveScore,
    budget: passiveBudget,
    parsed: passiveParsed,
    equipmentSynergy: cells[19] || '',
  };
  innateUtilities[key] = {
    bird: name,
    name: cells[9],
    en: utilEn,
    cooldown: utilCd,
    target: cells[12],
    effect: cells[13],
    score: utilScore,
    budget: utilBudget,
    parsed: parseEffectText(cells[13], { strict: false, mode: 'action' }),
  };
  if (passiveScore > passiveBudget + 1e-9) warn(`bird ${name}: passive score ${passiveScore} > budget ${passiveBudget}`);
  if (utilScore > utilBudget + 1e-9) warn(`bird ${name}: utility score ${utilScore} > budget ${utilBudget}`);
  const expectedBudget = utilityBudgetFor(utilEn, utilCd);
  if (Math.abs(expectedBudget - utilBudget) > 1e-9) {
    warn(`bird ${name}: utility budget ${utilBudget} != formula value ${expectedBudget} (EN ${utilEn}, CD ${utilCd})`);
  }
  if (!birdPassives[key].parsed && key === 'lyrebird') {
    birdPassives[key].parsed = {
      text: cells[4],
      trigger: { kind: 'afterSongBuff', stats: ['atk', 'matk'] },
      limit: /once per combat|once per battle/i.test(String(cells[5] || '')) ? 'oncePerCombat' : 'oncePerTurn',
      duration: null,
      effects: [],
      specials: [{ id: 'copyMightFocus' }],
    };
  }
  if (!birdPassives[key].parsed) warn(`bird passive not fully parsed (kept raw): ${name} — "${cells[4]}"`);
  if (!innateUtilities[key].parsed) warn(`innate utility not fully parsed (kept raw): ${name} — "${cells[13]}"`);
}
if (Object.keys(birdPassives).length !== 52) fail(`expected 52 bird passives, got ${Object.keys(birdPassives).length}`);

/* ---- Affinities & Ailments: verify chart vs js/data/aspects.js ---- */
{
  const aspectsSrc = readFileSync(path.join(ROOT, 'js', 'data', 'aspects.js'), 'utf8');
  const m = aspectsSrc.match(/Avian\.data\.aspects = Object\.freeze\((\{[\s\S]*?\})\);/);
  if (!m) fail('could not parse js/data/aspects.js');
  else {
    const live = JSON.parse(m[1]);
    const MOD_TO_REL = { 1.2: 'dominant', 1: 'neutral', 0.8: 'resisted' };
    const plainNames = ['Earth', 'Sky', 'Storm', 'Day', 'Night', 'Water'];
    const latinNames = ['terra', 'aeris', 'tempest', 'solis', 'lunae', 'maris'];
    const sheet = sheets[affinitySheetName];
    const header = sheet[4] || [];
    const usesPlain = /Earth/i.test(header[1] || '');
    for (let i = 0; i < 6; i++) {
      const row = sheet[5 + i];
      const attackerPlain = plainNames[i];
      const attackerLatin = latinNames[i];
      const expectedLabel = usesPlain ? attackerPlain : attackerPlain.replace(
        /Earth|Sky|Storm|Day|Night|Water/,
        (x) => ({ Earth: 'Terra', Sky: 'Aeris', Storm: 'Tempest', Day: 'Solis', Night: 'Lunae', Water: 'Maris' }[x]),
      );
      if (!row || String(row[0]).toLowerCase() !== String(usesPlain ? attackerPlain : expectedLabel).toLowerCase()) {
        /* Accept either plain or Latin row labels. */
        const okLabel = row && (
          String(row[0]).toLowerCase() === attackerPlain.toLowerCase()
          || String(row[0]).toLowerCase() === attackerLatin
          || String(row[0]).toLowerCase() === ({ terra: 'Terra', aeris: 'Aeris', tempest: 'Tempest', solis: 'Solis', lunae: 'Lunae', maris: 'Maris' }[attackerLatin]).toLowerCase()
        );
        if (!okLabel) { fail(`Affinity chart row ${5 + i}: unexpected label ${row && row[0]}`); continue; }
      }
      for (let j = 0; j < 6; j++) {
        const defenderLatin = latinNames[j];
        const rel = MOD_TO_REL[num(row[1 + j])];
        const liveRel = live.chart[attackerLatin] && live.chart[attackerLatin][defenderLatin];
        if (rel !== liveRel) fail(`Affinity chart drift ${attackerLatin}→${defenderLatin}: workbook ${rel} vs code ${liveRel}`);
      }
    }
  }
}

/* ---- Combination Techniques pack (from Skill Library COMBO_* + pair registry) ---- */
const FOCUS_AFFINITY = {
  poison: 'terra', burn: 'solis', chill: 'maris', shock: 'tempest', bleed: 'lunae', echo: 'aeris',
};
const combinationTechniques = {};
for (const sk of Object.values(skills)) {
  if (!sk.id || !String(sk.id).startsWith('COMBO_')) continue;
  const focus = sk.offHandOrbFocus || null;
  const channels = sk.damageType === 'Hybrid'
    ? ['martial', 'magic']
    : (sk.damageType === 'Magic' || sk.damageType === 'magic' ? ['magic'] : ['martial']);
  const scaling = (sk.scaling || []).map((s) => ({
    stat: s.ledgerKey || ledgerForScaling(s.stat),
    coeff: s.coeff,
    displayStat: s.stat === 'ATK' ? 'Might' : s.stat === 'MATK' ? 'Focus' : s.stat === 'SPD' ? 'Agility' : s.stat,
  }));
  combinationTechniques[sk.id] = {
    id: sk.id,
    pairKey: sk.pairKey,
    name: sk.name,
    mainTag: sk.mainTag,
    offTag: sk.offTag || null,
    offHandOrb: focus ? (focus.charAt(0).toUpperCase() + focus.slice(1) + ' Orb') : (sk.offTag || null),
    offHandOrbFocus: focus,
    en: sk.en,
    cooldown: sk.cooldown,
    precision: sk.basePrecision || sk.precision || 0.92,
    skillPower: sk.skillPower,
    skillPowerPct: sk.skillPowerPct,
    scaling,
    channels,
    affinity: focus ? (FOCUS_AFFINITY[focus] || null) : null,
    affinityFrom: focus ? 'orb' : 'main',
    rider: sk.rider,
    riderText: sk.riderText,
    replaces: 'offHandNormal',
    meter: 'oncePerAction',
    status: 'confirmedV09',
  };
}

/* ---- Weapon access (confirmed locks + pending stubs) ---- */
function classAccessList(raw) {
  return String(raw || '')
    .split(/[\/,]/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'any');
}
const weaponAccess = {};
const ACCESS_FAMILIES = [
  'Bow', 'Hand Crossbow', 'Greatbow', 'Focus Orb', 'Dagger Pinion',
  'Hook Axe', 'War Pick', 'Ailment Reliquary',
];
for (const fam of ACCESS_FAMILIES) {
  const f = families[fam];
  if (!f) continue;
  const pending = PENDING_FAMILIES.has(fam)
    || f.catalogueState === 'familyConfirmedContentPending';
  weaponAccess[fam] = {
    family: fam,
    hands: f.hands,
    classAccess: classAccessList(f.primaryFlatStats || ''),
    techniques: { A: f.skillA, paired: f.skillB, B: f.skillB },
    orbCombination: /Focus Orb|Hand Crossbow|Dagger Pinion|Talon Blade|Wand/i.test(fam),
    catalogueState: pending ? 'familyConfirmedContentPending' : (fam === 'Greatbow' ? 'reRestricted' : 'confirmed'),
    inventItems: false,
  };
}
/* Confirmed access overrides from Current Rules / CHG-058. */
if (weaponAccess.Greatbow) weaponAccess.Greatbow.classAccess = ['knight', 'brute'];
if (weaponAccess.Bow) weaponAccess.Bow.classAccess = ['rogue', 'bard'];
if (weaponAccess['Hand Crossbow']) weaponAccess['Hand Crossbow'].classAccess = ['rogue', 'bard'];
if (weaponAccess['Dagger Pinion']) weaponAccess['Dagger Pinion'].classAccess = ['rogue'];
if (weaponAccess['Focus Orb']) {
  weaponAccess['Focus Orb'].classAccess = ['mage', 'siren', 'inquisitor', 'bard'];
}

/* ---- Damage Lab oracle fixtures (weapon-first v0.9) ---- */
const DEFENCE_RATING_SCALE = 2.5;
const MITIGATION_CAP = 0.75;
const MITIGATION_BASE = 100;
function mitigationFromDef(effDef) {
  const rating = Math.max(0, effDef) * DEFENCE_RATING_SCALE;
  return Math.min(MITIGATION_CAP, rating / (MITIGATION_BASE + rating));
}
const fixtures = [];
for (const lo of referenceLoadouts) {
  if (!['grey', 'purple', 'gold'].includes(lo.rarity)) continue;
  const cls = classes[lo.class];
  if (!cls) continue;
  const mainItem = lo.equipment.mainHand ? items[lo.equipment.mainHand] : null;
  const skillIds = [];
  if (mainItem && mainItem.skill1) skillIds.push(mainItem.skill1);
  skillIds.push(mainItem && skills[mainItem.skill1] && skills[mainItem.skill1].damageType === 'Magic' ? 'BASIC_MAGIC' : 'BASIC_PHYSICAL');
  for (const sid of skillIds) {
    const sk = skills[sid];
    if (!sk || sk.skillType === 'Utility' || sk.skillType === 'Ultimate Utility') continue;
    const skillPowerPct = sk.skillPowerPct != null ? sk.skillPowerPct : Math.round((sk.skillPower || 0) * 100);
    if (!skillPowerPct) continue;
    const scalingKey = ledgerForScaling(sk.scalingStat || 'ATK');
    const gearFlat = lo.totals[`${scalingKey}Flat`] || 0;
    const classRef = cls.reference[scalingKey] ?? cls.reference.atk ?? 0;
    const stat = Math.round(classRef + gearFlat);
    const wMin = mainItem ? (mainItem.minDamage || 0) : 0;
    const wMax = mainItem ? (mainItem.maxDamage || 0) : 0;
    const weaponDamage = (wMin + wMax) / 2;
    let rawWeapon = weaponDamage * ((skillPowerPct + stat * DEFENCE_RATING_SCALE) / 100);
    if (sk.naturalStrikeFlat) {
      rawWeapon = (sk.naturalStrikeFlat.min + sk.naturalStrikeFlat.max) / 2 + rawWeapon;
    }
    const defKey = sk.damageType === 'Magic' ? 'mdef' : 'def';
    const defFlat = lo.totals[`${defKey}Flat`] || 0;
    const defenderDef = Math.round((cls.reference[defKey] || 0) + defFlat);
    const effDef = Math.max(0, defenderDef);
    const mit = mitigationFromDef(effDef);
    const damage = Math.max(1, Math.round(rawWeapon * (1 - mit)));
    fixtures.push({
      class: lo.class, rarity: lo.rarity, skillId: sid,
      en: sk.en, skillPowerPct, weaponDamage: round2(weaponDamage),
      attackerScalingTotal: stat, classReference: classRef,
      gearFlat,
      defenderDefence: defenderDef, effectiveDefence: effDef,
      mitigation: Math.round(mit * 10000) / 10000,
      mitigationBase: MITIGATION_BASE,
      defenceRatingScale: DEFENCE_RATING_SCALE,
      aspectMod: 1, bonusMod: 1, crit: false,
      expectedDamage: damage,
      formula: 'weaponFirstV09',
    });
  }
}

/* ------------------------------------------------------------------ *
 * Report + write                                                      *
 * ------------------------------------------------------------------ */

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 20)) console.log('  WARN', w);
  if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more`);
}
if (errors.length) {
  console.error(`\nIMPORT FAILED — ${errors.length} error(s):`);
  for (const e of errors) console.error('  FAIL', e);
  process.exit(1);
}

const slotsData = {
  packVersion: EQUIPMENT_PACK_VERSION,
  slots,
  slotOrder: ['helmet', 'armour', 'mainHand', 'offHand', 'ankletL', 'ankletR', 'necklace'],
  budgetClassMultipliers,
  rarityBudgets,
  rarityOrder: RARITY_ORDER,
  statCosts,
  statDisplayNames,
  forbiddenStatIds,
  apBands,
  skillPowerBands,
};

writeDataFile('js/data/equipment/slots.js', 'Avian.data.equipment.slots', slotsData);
writeDataFile('js/data/equipment/skills.js', 'Avian.data.equipment.skills', skills,
  'v0.9 Skill Library: skillPower % weapon-first; EN cooldown bands; COMBO_* combinations.');
writeDataFile('js/data/equipment/items.js', 'Avian.data.equipment.items', items,
  'v0.9 flat-stat catalogue (hpFlat/atkFlat/dexFlat + secondary % pens).');
writeDataFile('js/data/equipment/families.js', 'Avian.data.equipment.families', families,
  'v0.9 family weapon ranges + flat identity; pending Bow/HXB/Hook/Pick/Reliquary.');
writeDataFile('js/data/equipment/reference-loadouts.js', 'Avian.data.equipment.referenceLoadouts', referenceLoadouts);
writeDataFile('js/data/equipment/combinations.js', 'Avian.data.equipment.combinationTechniques', combinationTechniques,
  'v0.9 combination techniques from Skill Library COMBO_* rows.');
writeDataFile('js/data/equipment/weapon-access.js', 'Avian.data.equipment.weaponAccess', weaponAccess,
  'v0.9 pending-family access stubs (no invented catalogue rows).');
writeDataFile('js/data/effect-tiers.js', 'Avian.data.effectTiers', effectTiers,
  'v0.9 flat effect tiers (4/10/20) + brace/points.');
writeDataFile('js/data/birds-v2.js', 'Avian.data.birdsV2', birdsV2,
  'v0.9 bird base stats (vitality + seven attributes + derived HP/dodge).');
writeDataFile('js/data/combat-pack/classes.js', 'Avian.data.combatPack.classes', classes,
  'v0.9 class references averaged from birds-v2; qualitative perks from sheet.');
writeDataFile('js/data/combat-pack/bird-passives.js', 'Avian.data.combatPack.birdPassives', birdPassives,
  'v0.9 species passives.');
writeDataFile('js/data/combat-pack/innate-utilities.js', 'Avian.data.combatPack.innateUtilities', innateUtilities,
  'v0.9 innate utilities (one per bird).');

mkdirSync(path.join(ROOT, 'scripts', 'fixtures'), { recursive: true });
writeFileSync(
  path.join(ROOT, 'scripts', 'fixtures', 'equipment-damage-fixtures.json'),
  JSON.stringify({
    _note: `GENERATED by import-equipment-workbook.mjs from workbook v${META.version}. Oracle: weaponFirstV09 — round(weaponDamage × ((skillPowerPct + stat×${DEFENCE_RATING_SCALE})/100) [+ natural strike flat]) × (1 − mit), mit=min(${MITIGATION_CAP}, effDef×${DEFENCE_RATING_SCALE}/(${MITIGATION_BASE}+effDef×${DEFENCE_RATING_SCALE})), min 1.`,
    fixtures,
  }, null, 2) + '\n',
);
console.log('wrote scripts/fixtures/equipment-damage-fixtures.json (' + fixtures.length + ' vectors)');

console.log(`\nimport OK — workbook v${META.version} (${META.updated}); ${itemCount} items, ${skillCount} skills, ${Object.keys(families).length} families, ${referenceLoadouts.length} reference loadouts, ${Object.keys(birdsV2).length} birds, ${Object.keys(classes).length} classes; ${warnings.length} warning(s).`);
