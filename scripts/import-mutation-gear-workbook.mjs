#!/usr/bin/env node
/*
 * Import Avian_Ascent_New_Mutation_Gear_Workbook.xlsx → js/data/mutations/*
 *   AA_MUTATION_GEAR_WORKBOOK=/path/to/workbook.xlsx node scripts/import-mutation-gear-workbook.mjs
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
  'Avian_Ascent_New_Mutation_Gear_Workbook.xlsx',
);
const WORKBOOK = process.env.AA_MUTATION_GEAR_WORKBOOK || DEFAULT_WORKBOOK;
const OUT_DIR = path.join(ROOT, 'js', 'data', 'mutations');
const MUTATIONS_VERSION = '2026.06-mutations-v6';

const TIER_MAP = { Grey: 'white', Green: 'green', Blue: 'blue', Purple: 'purple', Gold: 'gold', Orange: 'orange' };
const TIER_KEYS = ['white', 'green', 'blue', 'purple', 'gold', 'orange'];
const DROP_WEIGHTS = { white: 40, green: 24, blue: 16, purple: 10, gold: 6, orange: 4 };

const TIER_PREFIXES = ['Minor', 'Major', 'Grand', 'Epic', 'Legendary', 'Crippling', 'Ruinous', 'Fatal'];

const SLOT_MAP = {
  'Left Wing': 'leftWing', 'Right Wing': 'rightWing', 'Left Foot': 'leftFoot', 'Right Foot': 'rightFoot',
  Beak: 'beak', Syrinx: 'syrinx', Chest: 'chest', Plumage: 'plumage', Eye: 'eyes', Head: 'head', Tail: 'tail',
};

const ITEM_TYPE_MAP = {
  Normal: 'normal', 'Class Only': 'classOnly', 'Class-only': 'classOnly',
  'Set Piece': 'set', 'Set-piece': 'set', Unique: 'unique',
};

const CLASS_MAP = {
  None: null, Knight: 'knight', Rogue: 'rogue', Mage: 'mage', Siren: 'siren',
  Inquisitor: 'inquisitor', Bard: 'bard', Brute: 'brute', Duke: 'duke',
};

const AILMENT_SCHOOL = {
  poison: 'physical', bleed: 'physical', paralyzed: 'physical', delayed: 'physical',
  chilled: 'magic', weaken: 'magic', burning: 'magic', blinded: 'magic', marked: 'magic',
};

const STAT_PCT_ATTRS = {
  'HP Up': 'maxHp', 'Max HP Up': 'maxHp', 'ATK Up': 'atk', 'MATK Up': 'matk',
  'DEF Up': 'def', 'MDEF Up': 'mdef', 'SPD Up': 'spd',
};

const SLOT_ORDER = [
  'leftWing', 'rightWing', 'leftFoot', 'rightFoot', 'beak', 'syrinx',
  'chest', 'plumage', 'eyes', 'head', 'tail',
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
  const ridMap = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\b([^>]+)\/?>/g)) {
    const attrs = m[1];
    const idM = attrs.match(/\bId="([^"]+)"/);
    const targetM = attrs.match(/\bTarget="([^"]+)"/);
    if (idM && targetM) ridMap[idM[1]] = targetM[1].replace(/^\//, '');
  }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    let target = ridMap[m[2]] || '';
    if (target.startsWith('/')) target = target.slice(1);
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    if (entries[target]) sheets[m[1]] = parseSheet(entries[target], sharedStrings);
  }
  return sheets;
}

function headerIndex(header, ...names) {
  for (const name of names) {
    const i = header.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function toSnakeId(name) {
  return String(name || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

function parseNumFromBackend(raw) {
  const s = String(raw || '').trim();
  const pct = s.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (pct) return Number(pct[1]);
  const dodge = s.match(/([+-]?\d+(?:\.\d+)?)\s*dodge/i);
  if (dodge) return Number(dodge[1]);
  const pierce = s.match(/ignores\s+(\d+(?:\.\d+)?)\s*%\s*(?:def|mdef)/i);
  if (pierce) return Number(pierce[1]);
  const mult = s.match(/([+-]?\d+(?:\.\d+)?)\s*x/i);
  if (mult) return Math.round(Number(mult[1]) * 100);
  const plain = s.match(/(\d+(?:\.\d+)?)/);
  if (plain) return Number(plain[1]);
  return 0;
}

function splitTierPrefixed(full) {
  const s = String(full || '').trim();
  if (!s) return null;

  const applyMatch = s.match(/^Apply\s+(Minor|Major|Grand|Epic|Legendary|Crippling|Ruinous|Fatal)\s+(.+)$/i);
  if (applyMatch) {
    return { tier: applyMatch[1], effect: applyMatch[2], kind: 'applyDown' };
  }

  const chanceMatch = s.match(/^(Minor|Major|Grand|Epic|Legendary|Crippling|Ruinous|Fatal)\s+chance to apply\s+(.+)$/i);
  if (chanceMatch) {
    return { tier: chanceMatch[1], effect: `${chanceMatch[2]}`, kind: 'ailmentChance', ailment: chanceMatch[2] };
  }

  const gainShield = s.match(/^(Minor|Major|Grand|Epic|Legendary)\s+Shield$/i);
  if (gainShield) {
    return { tier: gainShield[1], effect: 'Shield', kind: 'shield' };
  }

  for (const t of TIER_PREFIXES) {
    if (s.startsWith(t + ' ')) {
      return { tier: t, effect: s.slice(t.length + 1), kind: 'attribute' };
    }
  }
  return { tier: 'Minor', effect: s, kind: 'attribute' };
}

function findCatalogRows(sheets) {
  const candidates = ['Mutation Catalog', 'Rarity Rules'];
  for (const name of candidates) {
    const rows = sheets[name];
    if (!rows?.length) continue;
    if (rows.some((r) => String(r[0] || '').startsWith('MUT-'))) return rows;
  }
  for (const name of Object.keys(sheets)) {
    const rows = sheets[name];
    if (rows.length > 1 && headerIndex(rows[0], 'Item ID') >= 0) {
      if (rows.some((r) => String(r[0] || '').startsWith('MUT-'))) return rows;
    }
  }
  return [];
}

function findEffectMatrixRows(sheets) {
  const candidates = ['Effect Cost Matrix', 'Player-Facing Tiers'];
  for (const name of candidates) {
    const rows = sheets[name];
    if (rows?.length && String(rows[0][0] || '').trim() === 'Effect Name') return rows;
  }
  for (const name of Object.keys(sheets)) {
    const rows = sheets[name];
    if (rows?.length && String(rows[0][0] || '').trim() === 'Effect Name') return rows;
  }
  return [];
}

function findSetRulesRows(sheets) {
  for (const name of ['Set Bonus Examples', 'Slot Rules']) {
    const rows = sheets[name];
    if (!rows?.length) continue;
    const header = rows[0];
    if (headerIndex(header, 'Set Name') >= 0 && headerIndex(header, 'Pieces Required') >= 0) return rows;
  }
  for (const name of Object.keys(sheets)) {
    const rows = sheets[name];
    if (!rows?.length) continue;
    const header = rows[0];
    if (headerIndex(header, 'Set Name') >= 0 && headerIndex(header, 'Pieces Required') >= 0) return rows;
  }
  return [];
}

function buildEffectMatrix(rows) {
  const lookup = Object.create(null);
  const bonusLib = Object.create(null);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const fullName = String(row[0] || '').trim();
    if (!fullName || fullName === 'Effect Name') continue;
    const category = String(row[1] || '').trim();
    const tier = String(row[2] || '').trim();
    const backend = String(row[3] || '').trim();
    const cost = Number(row[4]) || 0;
    const notes = String(row[9] || row[5] || '').trim();

    lookup[fullName] = { category, backend, tier, cost };
    const split = splitTierPrefixed(fullName);
    const baseEffect = split ? split.effect : fullName;
    const id = toSnakeId(baseEffect);
    if (!bonusLib[id]) {
      bonusLib[id] = {
        id,
        name: baseEffect,
        category,
        baseCost: cost,
        minRarity: 'blue',
        allowedClasses: [],
        notes,
      };
    }
  }
  return { lookup, bonusLib };
}

function tierNumericValue(category, tier, backend, lookup, effectName) {
  const fullKey = `${tier} ${effectName}`.replace(/\s+/g, ' ').trim();
  const ref = lookup[fullKey] || lookup[`Apply ${fullKey}`];
  if (ref?.backend && !/^(minor|major|grand|epic|legendary|crippling|ruinous|fatal)$/i.test(ref.backend)) {
    return parseNumFromBackend(ref.backend);
  }
  if (backend) return parseNumFromBackend(backend);

  const t = String(tier || 'Minor').toLowerCase();
  const tierScale = {
    minor: 1, major: 1.33, grand: 2, epic: 3, legendary: 4.17,
    crippling: 1.67, ruinous: 2.5, fatal: 3.33,
  };
  const scale = tierScale[t] || 1;
  const isMajor = t === 'major' || scale > 1.2;

  if (/dodge down/i.test(effectName) || /dodge down/i.test(category)) {
    if (t === 'fatal') return -12;
    if (t === 'ruinous') return -10;
    if (t === 'crippling') return -8;
    return isMajor ? -5 : -3;
  }
  if (/dodge up/i.test(category) || /dodge up/i.test(effectName)) {
    if (t === 'legendary') return 12;
    if (t === 'epic') return 10;
    if (t === 'grand') return 8;
    return isMajor ? 5 : 3;
  }
  if (/ailment chance/i.test(category) || /chance to apply/i.test(effectName)) {
    if (t === 'fatal') return 45;
    if (t === 'ruinous') return 30;
    if (t === 'crippling') return 20;
    return isMajor ? 15 : 10;
  }
  if (/lifesteal/i.test(category) || /lifesteal/i.test(effectName)) {
    if (t === 'legendary') return 35;
    if (t === 'epic') return 30;
    if (t === 'grand') return 25;
    return isMajor ? 18 : 10;
  }
  if (/shield/i.test(category) || effectName === 'Shield') {
    if (t === 'legendary') return 25;
    if (t === 'epic') return 18;
    if (t === 'grand') return 12;
    return isMajor ? 8 : 6;
  }
  if (/pierce/i.test(category) || /pierce/i.test(effectName)) {
    if (t === 'legendary') return 40;
    if (t === 'epic') return 25;
    if (t === 'grand') return 20;
    return isMajor ? 15 : 10;
  }
  if (/crit chance/i.test(category) || /crit chance/i.test(effectName)) {
    if (t === 'legendary') return 20;
    if (t === 'epic') return 16;
    if (t === 'grand') return 12;
    return isMajor ? 8 : 5;
  }
  if (/crit damage/i.test(category) || /crit damage/i.test(effectName)) {
    if (t === 'legendary') return 50;
    if (t === 'epic') return 35;
    if (t === 'grand') return 25;
    return isMajor ? 15 : 10;
  }
  if (/down/i.test(effectName)) return Math.round(6 * scale);
  return Math.round(6 * scale);
}

function pushAilmentChance(item, ailmentName, tier, lookup) {
  const ailId = toSnakeId(ailmentName);
  const school = AILMENT_SCHOOL[ailId] || 'physical';
  const category = 'Ailment Chance';
  const val = tierNumericValue(category, tier, '', lookup, `${ailmentName} Chance Up`);
  item.mechanics = item.mechanics || {};
  item.mechanics.ailmentChances = item.mechanics.ailmentChances || [];
  item.mechanics.ailmentChances.push({ id: ailId, chance: val, school });
}

function applyStatEffect(item, effectName, tier, lookup) {
  const row = lookup[`${tier} ${effectName}`];
  const category = row?.category || '';
  const backend = row?.backend || '';
  const val = tierNumericValue(category, tier, backend, lookup, effectName);

  if (STAT_PCT_ATTRS[effectName]) {
    item.statsPct = item.statsPct || {};
    item.statsPct[STAT_PCT_ATTRS[effectName]] = (item.statsPct[STAT_PCT_ATTRS[effectName]] || 0) + val;
    return;
  }
  if (effectName === 'Dodge Up') {
    item.stats = item.stats || {};
    item.stats.dodge = (item.stats.dodge || 0) + val;
    return;
  }
  if (effectName === 'Dodge Down') {
    item.stats = item.stats || {};
    item.stats.dodge = (item.stats.dodge || 0) + val;
    return;
  }
  if (effectName === 'Crit Chance Up') {
    item.stats = item.stats || {};
    item.stats.critChance = (item.stats.critChance || 0) + val;
    return;
  }
  if (effectName === 'Crit Damage Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.critDamageBonusPct = (item.mechanics.critDamageBonusPct || 0) + val;
    return;
  }
  if (effectName === 'Light Attack Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.lightAttackDmgPct = (item.mechanics.lightAttackDmgPct || 0) + val;
    return;
  }
  if (effectName === 'Medium Attack Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.mediumAttackDmgPct = (item.mechanics.mediumAttackDmgPct || 0) + val;
    return;
  }
  if (effectName === 'Heavy Attack Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.heavyAttackDmgPct = (item.mechanics.heavyAttackDmgPct || 0) + val;
    return;
  }
  if (effectName === 'Physical Damage Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.physicalDamageUpPct = (item.mechanics.physicalDamageUpPct || 0) + val;
    return;
  }
  if (effectName === 'Magic Damage Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.magicDamageUpPct = (item.mechanics.magicDamageUpPct || 0) + val;
    return;
  }
  if (effectName === 'Physical Pierce' || effectName === 'DEF Pierce') {
    item.mechanics = item.mechanics || {};
    item.mechanics.armorPen = (item.mechanics.armorPen || 0) + val;
    return;
  }
  if (effectName === 'Magic Pierce' || effectName === 'MDEF Pierce') {
    item.mechanics = item.mechanics || {};
    item.mechanics.magicPen = (item.mechanics.magicPen || 0) + val;
    return;
  }
  if (effectName === 'Shield Strength Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.shieldPowerPct = (item.mechanics.shieldPowerPct || 0) + val;
    return;
  }
  if (effectName === 'Lifesteal' || effectName === 'Lifesteal Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.lifestealPct = (item.mechanics.lifestealPct || 0) + val;
    return;
  }
  if (effectName === 'Healing Received Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.healingReceivedPct = (item.mechanics.healingReceivedPct || 0) + val;
    return;
  }
  if (effectName === 'Ultimate Meter Gain Up') {
    item.mechanics = item.mechanics || {};
    item.mechanics.ultimateMeterGainPct = (item.mechanics.ultimateMeterGainPct || 0) + val;
    return;
  }
}

function pushBonus(item, id, name, tier, val) {
  item.bonuses = item.bonuses || [];
  item.bonuses.push({ id, name, value: val, tier });
}

function applyEffectLine(item, rawText, lookup, isBonusLine) {
  const text = String(rawText || '').trim();
  if (!text) return;

  const split = splitTierPrefixed(text);
  if (!split) return;

  const { tier, effect, kind } = split;

  if (kind === 'ailmentChance') {
    pushAilmentChance(item, split.ailment, tier, lookup);
    return;
  }

  if (kind === 'shield' || (isBonusLine && effect === 'Shield')) {
    const val = tierNumericValue('Shield', tier, '', lookup, 'Shield');
    pushBonus(item, toSnakeId(`${tier} Shield`), `${tier} Shield`, tier, val);
    return;
  }

  if (kind === 'applyDown' || (isBonusLine && / down$/i.test(effect))) {
    const bonusId = toSnakeId(`apply_${tier}_${effect}`);
    const val = tierNumericValue('Debuff / Negative %', tier, '', lookup, effect);
    pushBonus(item, bonusId, `Apply ${tier} ${effect}`, tier, val);
    return;
  }

  if (isBonusLine && effect === 'Dodge Down') {
    const val = tierNumericValue('Dodge Down', tier, '', lookup, 'Dodge Down');
    pushBonus(item, toSnakeId(`${tier}_dodge_down`), `${tier} Dodge Down`, tier, val);
    return;
  }

  if (isBonusLine && (effect === 'Lifesteal' || effect === 'Lifesteal Up')) {
    const val = tierNumericValue('Lifesteal', tier, '', lookup, 'Lifesteal');
    item.mechanics = item.mechanics || {};
    item.mechanics.lifestealPct = (item.mechanics.lifestealPct || 0) + val;
    return;
  }

  applyStatEffect(item, effect, tier, lookup);
}

function parseCatalogRow(row, header, lookup) {
  const idIdx = headerIndex(header, 'Item ID', 'ID');
  const id = String(row[idIdx] || '').trim();
  if (!id || id === 'Item ID' || !id.startsWith('MUT-')) return null;

  const item = {
    id,
    tier: TIER_MAP[String(row[headerIndex(header, 'Rarity')] || 'Grey').trim()] || 'white',
    name: String(row[headerIndex(header, 'Item Name', 'Mutation Name')] || '').trim(),
    slot: SLOT_MAP[String(row[headerIndex(header, 'Slot')] || '').trim()] || 'chest',
    slotLimit: 1,
    itemType: ITEM_TYPE_MAP[String(row[headerIndex(header, 'Item Type')] || 'Normal').trim()] || 'normal',
    classRequired: CLASS_MAP[String(row[headerIndex(header, 'Class Required')] || 'None').trim()] ?? null,
    setName: (() => {
      const s = String(row[headerIndex(header, 'Set Name')] || '').trim();
      return !s || s === 'None' ? null : s;
    })(),
  };

  const tierCol = headerIndex(header, 'Tier 1') >= 0;
  for (let n = 1; n <= 4; n++) {
    const attr = String(row[headerIndex(header, `Attribute ${n}`)] || '').trim();
    if (!attr) continue;
    if (tierCol) {
      const t = String(row[headerIndex(header, `Tier ${n}`)] || 'Minor').trim();
      applyEffectLine(item, `${t} ${attr}`.trim(), lookup, false);
    } else {
      applyEffectLine(item, attr, lookup, false);
    }
  }
  for (let n = 1; n <= 2; n++) {
    const bonus = String(row[headerIndex(header, `Bonus ${n}`)] || '').trim();
    if (!bonus) continue;
    if (tierCol) {
      const t = String(row[headerIndex(header, `Bonus Tier ${n}`)] || 'Minor').trim();
      applyEffectLine(item, `${t} ${bonus}`.trim(), lookup, true);
    } else {
      applyEffectLine(item, bonus, lookup, true);
    }
  }

  const text = String(row[headerIndex(header, 'Player-Facing Text')] || '').trim();
  item.statLine = text || item.name;

  if (item.stats && !Object.keys(item.stats).length) delete item.stats;
  if (item.statsPct && !Object.keys(item.statsPct).length) delete item.statsPct;
  if (item.mechanics && !Object.keys(item.mechanics).length) delete item.mechanics;
  if (item.bonuses && !item.bonuses.length) delete item.bonuses;

  return item;
}

function inferSetCondition(text) {
  const s = String(text || '').toLowerCase();
  if (s.includes('bloodied')) return 'bloodied';
  if (s.includes('hp is above') || s.includes('hp above')) return 'hpAbove50';
  if (s.includes('start of combat') || s.includes('battle start')) return 'battleStart';
  if (s.includes('attacks have')) return 'onAttack';
  return 'passive';
}

function parseSlotRules(rows) {
  const sets = Object.create(null);
  if (!rows?.length) return sets;
  const header = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const setName = String(row[headerIndex(header, 'Set Name')] || '').trim();
    if (!setName || setName === 'Set Name') continue;
    const id = toSnakeId(setName);
    if (!sets[id]) {
      sets[id] = {
        id,
        name: setName,
        theme: '',
        thresholds: [],
        bonuses: {},
        piece2: '',
        piece4: '',
        piece6: '',
        recommendedClasses: [],
        notes: 'Imported from Slot Rules sheet.',
      };
    }
    const pieces = Number(row[headerIndex(header, 'Pieces Required')]) || 0;
    const bonusTier = String(row[headerIndex(header, 'Set Bonus Tier', 'Bonus Tier')] || '').trim();
    const text = String(row[headerIndex(header, 'Player-Facing Set Bonus', 'Set Bonus Text')] || '').trim();
    const backend = String(row[headerIndex(header, 'Backend Value')] || '').trim();
    if (!pieces) continue;
    if (!sets[id].thresholds.includes(pieces)) sets[id].thresholds.push(pieces);
    sets[id].bonuses[pieces] = {
      tier: bonusTier,
      text,
      backend,
      condition: inferSetCondition(text),
    };
    if (pieces === 2) sets[id].piece2 = text;
    else if (pieces === 4) sets[id].piece4 = text;
    else if (pieces === 6) sets[id].piece6 = text;
    else if (!sets[id].piece2) sets[id].piece2 = text;
  }
  for (const id in sets) {
    sets[id].thresholds.sort((a, b) => a - b);
  }
  return sets;
}

function writeMutationDataFile(filePath, header, varName, payload) {
  const json = JSON.stringify(payload);
  const body = [
    header,
    "(function(){'use strict';",
    `globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);Avian.data.mutations=Avian.data.mutations||Object.create(null);Avian.data.mutations.${varName}=Object.freeze(${json});`,
    '})();',
    '',
  ].join('\n');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, body, 'utf8');
}

function main() {
  if (!existsSync(WORKBOOK)) {
    console.error('[mutation-gear] missing workbook:', WORKBOOK);
    process.exit(1);
  }

  const sheets = loadWorkbookSheets(WORKBOOK);
  const catalogRows = findCatalogRows(sheets);
  const matrixRows = findEffectMatrixRows(sheets);
  const setRows = findSetRulesRows(sheets);

  if (!catalogRows.length) {
    console.error('[mutation-gear] catalog sheet not found (expected Rarity Rules with MUT- rows)');
    process.exit(1);
  }
  if (!matrixRows.length) {
    console.error('[mutation-gear] Player-Facing Tiers sheet not found');
    process.exit(1);
  }

  const { lookup, bonusLib } = buildEffectMatrix(matrixRows);
  const header = catalogRows.find((r) => headerIndex(r, 'Item ID') >= 0) || catalogRows[0];
  const byTier = Object.fromEntries(TIER_KEYS.map((t) => [t, {}]));
  let count = 0;

  for (let i = 0; i < catalogRows.length; i++) {
    const item = parseCatalogRow(catalogRows[i], header, lookup);
    if (!item) continue;
    byTier[item.tier][item.id] = item;
    count++;
  }

  writeMutationDataFile(
    path.join(OUT_DIR, 'slots.js'),
    '/* GENERATED slots - mutation gear workbook */',
    'slots',
    { limits: Object.fromEntries(SLOT_ORDER.map((s) => [s, 1])), order: SLOT_ORDER },
  );

  for (const tier of TIER_KEYS) {
    const n = Object.keys(byTier[tier]).length;
    writeMutationDataFile(
      path.join(OUT_DIR, `items-${tier}.js`),
      `/* GENERATED items-${tier} - ${n} items */`,
      `items_${tier}`,
      byTier[tier],
    );
    console.log(`[mutation-gear] ${tier}: ${n} items`);
  }

  writeMutationDataFile(
    path.join(OUT_DIR, 'bonus-library.js'),
    '/* GENERATED bonus library */',
    'bonusLibrary',
    bonusLib,
  );

  writeMutationDataFile(
    path.join(OUT_DIR, 'sets.js'),
    '/* GENERATED set bonuses */',
    'sets',
    parseSlotRules(setRows),
  );

  const indexLines = [
    '/* Avian Ascent - index.js',
    ' * Mutations catalog index - byId lookup and drop weights.',
    ' * Generated by scripts/import-mutation-gear-workbook.mjs - do not edit by hand.',
    ' */',
    "(function(){'use strict';",
    'var Avian=globalThis.Avian||(globalThis.Avian={});Avian.data=Avian.data||Object.create(null);',
    'var m=Avian.data.mutations=Avian.data.mutations||Object.create(null);',
    'var byId=Object.create(null);',
  ];
  for (const tier of TIER_KEYS) {
    indexLines.push(`if(m.items_${tier}){for(var k in m.items_${tier})byId[k]=m.items_${tier}[k];}`);
  }
  indexLines.push('m.byId=Object.freeze(byId);');
  indexLines.push(`m.dropWeights=Object.freeze(${JSON.stringify(DROP_WEIGHTS)});`);
  indexLines.push(`m.version='${MUTATIONS_VERSION}';`);
  indexLines.push('})();');
  indexLines.push('');
  writeFileSync(path.join(OUT_DIR, 'index.js'), indexLines.join('\n'), 'utf8');

  console.log(`[mutation-gear] total catalog items: ${count}`);
  console.log(`[mutation-gear] bonus library entries: ${Object.keys(bonusLib).length}`);
  console.log(`[mutation-gear] version: ${MUTATIONS_VERSION}`);
}

main();
