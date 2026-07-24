#!/usr/bin/env node
/*
 * Import Affinity Arsenal v0.6 workbook (folds v0.4 Vitality rebase + v0.5 terminology):
 *   Newest Avian_Ascent_Master_Affinity_Ailments_and_Arsenal_v0.6.xlsx
 *   → js/data/equipment/{slots,skills,items,families,reference-loadouts}.js
 *   → js/data/effect-tiers.js
 *   → js/data/birds-v2.js, js/data/combat-pack/{classes,bird-passives,innate-utilities}.js
 *   → scripts/fixtures/equipment-damage-fixtures.json
 *
 * Override: AA_EQUIPMENT_WORKBOOK=/path/to/workbook.xlsx
 * Legacy v0.3 path still works if pointed explicitly (flat-stat headers).
 *
 * Fail-fast: any unparseable bonus/unique/trade-off text, unresolved skill id,
 * budget breach, forbidden stat, or count mismatch aborts the import with a report.
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
  'Newest Avian_Ascent_Master_Affinity_Ailments_and_Arsenal_v0.6.xlsx',
);
const WORKBOOK = process.env.AA_EQUIPMENT_WORKBOOK || DEFAULT_WORKBOOK;
const EQUIPMENT_PACK_VERSION = '2026.07-affinity-arsenal-v0.6';
const PENDING_FAMILIES = new Set(['Bow', 'Hand Crossbow']);

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
/* v0.6: all sixteen equipment columns are percentage decimals on the sheet. */
const CORE_PCT_KEYS = new Set(['hp', 'atk', 'def', 'matk', 'mdef', 'spd']);
const PCT_STATS = new Set(STAT_ORDER); // all stored as % after import
const STAT_ID_MAP = {
  HP: 'hp', ATK: 'atk', DEF: 'def', MATK: 'matk', MDEF: 'mdef', SPD: 'spd',
  DodgePct: 'dodgePct', CritChancePct: 'critChancePct', CritDamagePct: 'critDamagePct',
  PhysicalPenPct: 'physicalPenPct', MagicPenPct: 'magicPenPct',
  PhysicalDamagePct: 'physicalDamagePct', MagicDamagePct: 'magicDamagePct',
  AspectDamagePct: 'aspectDamagePct', HealingPowerPct: 'healingPowerPct', ShieldStrengthPct: 'shieldStrengthPct',
};
const AFFINITY_TO_LATIN = {
  earth: 'terra', sky: 'aeris', storm: 'tempest', day: 'solis', night: 'lunae', water: 'maris',
  terra: 'terra', aeris: 'aeris', tempest: 'tempest', solis: 'solis', lunae: 'lunae', maris: 'maris',
  neutral: 'neutral',
};
const SCALING_STAT_MAP = {
  Might: 'ATK', ATK: 'ATK', Guard: 'DEF', DEF: 'DEF', Focus: 'MATK', MATK: 'MATK',
  Resolve: 'MDEF', MDEF: 'MDEF', Agility: 'SPD', SPD: 'SPD', Vitality: 'HP', HP: 'HP',
  None: null, '': null,
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

function ledgerForScaling(stat) {
  const u = String(stat || '').toUpperCase();
  if (u === 'ATK' || u === 'MIGHT') return 'atk';
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
    ` * Source workbook: Avian_Ascent_Master_Affinity_Ailments_and_Arsenal v${META.version} (updated ${META.updated})` + (note ? `\n * ${note}` : ''),
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

/* ---- Slot Rules ---- */
const SLOT_KEY_MAP = {
  Helmet: 'helmet', 'Armour/Plumage': 'armour', 'Main Weapon': 'mainHand', 'Off Weapon': 'offHand',
  Shield: 'shield', 'Left Anklet': 'ankletL', 'Right Anklet': 'ankletR', Necklace: 'necklace',
};
const slotRows = [];
for (let r = 5; r <= 12; r++) {
  const row = sheets['Slot Rules'][r];
  if (!row) { fail(`Slot Rules row ${r} missing`); continue; }
  slotRows.push(row);
}
const slots = {};
for (const row of slotRows) {
  const key = SLOT_KEY_MAP[row[0]];
  if (!key) { fail('Unknown loadout slot: ' + row[0]); continue; }
  slots[key] = {
    label: row[0],
    accepts: row[2],
    handCapacity: num(row[3]),
    activeContribution: row[4] || 'None',
    duplicateAllowed: /yes/i.test(row[7] || ''),
    budgetClass: row[8],
    notes: row[9] || '',
  };
}
if (Object.keys(slots).length !== 8) fail(`expected 8 loadout slots, got ${Object.keys(slots).length}`);

const budgetClassMultipliers = {};
for (let r = 16; r <= 22; r++) {
  const row = sheets['Slot Rules'][r];
  if (!row || !row[0]) continue;
  budgetClassMultipliers[row[0]] = num(row[1]);
}
if (Object.keys(budgetClassMultipliers).length !== 7) fail('expected 7 budget-class multipliers');

/* ---- Stat Definitions → cost vector + forbidden stats ---- */
const statCosts = {}; // statKey → cost per stored decimal unit
const statDisplayNames = {};
const forbiddenStatIds = [];
for (const { cells } of tableRows(sheets['Stat Definitions'], 4)) {
  const statId = cells[1];
  const status = cells[5] || '';
  if (/Allowed/i.test(status)) {
    const key = STAT_ID_MAP[statId];
    if (!key) { fail('Unmapped allowed stat: ' + statId); continue; }
    statCosts[key] = num(cells[6]);
    statDisplayNames[key] = cells[2];
  } else if (/Removed|Not available/i.test(status)) {
    forbiddenStatIds.push(statId);
  }
}
if (Object.keys(statCosts).length !== 16) fail(`expected 16 allowed stats, got ${Object.keys(statCosts).length}`);

// Cross-check cost vector vs Data Lists row 5 (columns M..AB)
{
  const dl = sheets['Data Lists'][5] || [];
  STAT_ORDER.forEach((key, i) => {
    const dlCost = num(dl[12 + i]);
    if (dlCost !== statCosts[key]) fail(`Data Lists cost vector mismatch for ${key}: ${dlCost} vs ${statCosts[key]}`);
  });
}

/* ---- Effect Tiers (v0.6 core 6/8/12) ---- */
const tierRows = { minor: sheets['Effect Tiers'][5], moderate: sheets['Effect Tiers'][6], major: sheets['Effect Tiers'][7] };
const effectTiers = {
  packVersion: EQUIPMENT_PACK_VERSION,
  buff: {},
  debuff: {},
  points: { minor: 3, moderate: 5, major: 8 },
  brace: {},
  stacking: {
    mode: 'strongestPerDirection',
    coreTempCapPct: 20,
    precisionTempCapPoints: 12,
  },
};
for (const [tier, row] of Object.entries(tierRows)) {
  if (!row) { fail('Effect Tiers row missing for ' + tier); continue; }
  const up = pct(row[1]);
  const down = Math.abs(pct(row[2]));
  effectTiers.buff[tier] = up;
  effectTiers.debuff[tier] = down;
  effectTiers.brace[tier] = up;
}

/* ---- Rarity Budgets + coefficient bands ---- */
const rarityBudgets = {};
for (let r = 5; r <= 10; r++) {
  const row = sheets['Rarity Budgets'][r];
  const key = RARITY_KEYS[row[0]];
  if (!key) { fail('Unknown rarity: ' + row[0]); continue; }
  rarityBudgets[key] = {
    rank: num(row[1]),
    baseBudget: num(row[2]),
    attributeLines: num(row[3]),
    namedBonuses: num(row[4]),
    uniqueRule: row[5] === 'Required' ? 'required' : 'no',
    skillRank: num(row[6]),
    designRole: row[7],
    targetLow: num(row[8]),
    targetHigh: num(row[9]),
  };
}
const apBands = {};
for (let r = 15; r <= 19; r++) {
  const row = sheets['Rarity Budgets'][r];
  if (!row || row[0] === '') continue;
  apBands[String(num(row[0]))] = {
    baseDamage: num(row[1]),
    minAp: num(row[2]),
    maxAp: num(row[3]),
    use: row[6] || '',
  };
}
if (Object.keys(apBands).length !== 5) fail('expected 5 EN coefficient bands');

/* ---- Skill Library ---- */
const skillRarityCols = { grey: 18, green: 19, blue: 20, purple: 21, gold: 22, orange: 23 };
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
  const ap = {};
  for (const [rk, ci] of Object.entries(skillRarityCols)) {
    const v = cells[ci];
    if (v !== '') ap[rk] = num(v);
  }
  const riderText = cells[24] || '';
  const source = cells[2] || '';
  const isCombo = id.startsWith('COMBO_') || /^Combination$/i.test(source);
  const primaryStat = mapScalingStat(cells[11]);
  const secondaryStat = mapScalingStat(cells[12]);
  const primaryCoeff = num(cells[33]);
  const secondaryCoeff = num(cells[34]);
  const basePrecision = num(cells[32]);
  const baseDamage = num(cells[16]);
  const en = num(cells[6]);
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
  const rawDamageType = cells[10] || 'Physical';
  const damageType = /^Martial$/i.test(rawDamageType) ? 'Physical'
    : /^Hybrid$/i.test(rawDamageType) ? 'Hybrid'
    : rawDamageType;

  if (isCombo) {
    const mainTag = String(cells[3] || '').split('+')[0].trim();
    const focusMatch = String(cells[3] || '').match(/(Poison|Burn|Chill|Shock|Bleed|Echo)\s+Orb/i);
    const offHandOrbFocus = focusMatch ? focusMatch[1].toLowerCase() : null;
    const scaling = [];
    if (primaryStat && primaryCoeff) {
      scaling.push({ stat: primaryStat, coeff: primaryCoeff, ledgerKey: ledgerForScaling(primaryStat) });
    }
    if (secondaryStat && secondaryCoeff) {
      scaling.push({ stat: secondaryStat, coeff: secondaryCoeff, ledgerKey: ledgerForScaling(secondaryStat) });
    }
    skills[id] = {
      id,
      name: cells[1],
      source: 'Combination',
      family: 'Combination',
      barSlot: cells[4],
      skillType,
      en,
      cooldown: num(cells[7]),
      meter,
      target: cells[9],
      damageType,
      scalingStat: null,
      scaling,
      aspectRule: 'OffHandOrbAffinity',
      hits: num(cells[15]) || 1,
      precision: basePrecision || 0.92,
      baseDamage: baseDamage || 6,
      coefficientFixed: true,
      ap: null,
      riderText,
      rider: parseComboRider(riderText),
      minRarity: RARITY_KEYS[cells[25]] || 'grey',
      classNote: cells[30] || 'Combination technique',
      intrinsicPenPct: pct(cells[26]),
      pairKey: String(cells[3] || '').replace(/\s*\+\s*/g, '|'),
      mainTag,
      offHandOrbFocus,
    };
  } else {
    const fixedCoeff = primaryCoeff || (Object.values(ap)[0] != null ? Object.values(ap)[0] : null);
    skills[id] = {
      id,
      name: cells[1],
      source,
      family: cells[3],
      barSlot: cells[4],
      skillType,
      en,
      cooldown: num(cells[7]),
      meter,
      target: cells[9],
      damageType,
      scalingStat: primaryStat,
      aspectRule: cells[14] || '',
      hits: num(cells[15]),
      ap,
      riderText,
      rider: parseEffectText(riderText, { strict: false, mode: 'action' }),
      minRarity: RARITY_KEYS[cells[25]] || 'grey',
      classNote: cells[30] || '',
      intrinsicPenPct: pct(cells[26]),
      coefficientFixed: true,
    };
    if (fixedCoeff != null) skills[id].fixedCoefficient = fixedCoeff;
    if (basePrecision) skills[id].basePrecision = basePrecision;
    if (baseDamage) skills[id].baseDamage = baseDamage;
    if (en >= 2 && /Basic|Utility/i.test(skillType) === false && en === 2) {
      /* EN role bump already in sheet values */
    }
    if (/Dagger Pinion|Talon Dagger/i.test(cells[3] || '')) {
      skills[id].legacyFamily = 'Talon Dagger';
    }
  }

  const sk = skills[id];
  if (!isCombo && sk.skillType !== 'Utility' && sk.skillType !== 'Ultimate Utility' && Object.keys(ap).length) {
    const band = apBands[String(sk.en)];
    if (band) {
      for (const [rk, v] of Object.entries(ap)) {
        if (v < band.minAp - 1e-9 || v > band.maxAp + 1e-9) {
          fail(`skill ${id} AP ${v} (${rk}) outside EN ${sk.en} band [${band.minAp}, ${band.maxAp}]`);
        }
      }
    }
  }
}
const skillCount = Object.keys(skills).length;
const dashSkillCount = num(dashValue('Skill Templates'));
if (dashSkillCount && skillCount !== dashSkillCount) {
  fail(`expected ${dashSkillCount} skill rows (Dashboard "Skill Templates"), got ${skillCount}`);
}
if (!skills.BASIC_PHYSICAL || !skills.BASIC_MAGIC) fail('missing BASIC_PHYSICAL / BASIC_MAGIC skill rows');

/* ---- Equipment Stats (percentage matrix) ---- */
const itemStats = {}; // id → { stats (converted), rawDecimals, statCost, attributeCount }
for (const { cells, rowNum } of tableRows(sheets['Equipment Stats'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Equipment Stats row ${rowNum}: empty id`); continue; }
  const raw = {};
  STAT_ORDER.forEach((key, i) => {
    raw[key] = num(cells[4 + i]);
  });
  const converted = {};
  STAT_ORDER.forEach((key) => {
    const v = raw[key];
    if (v === 0) return;
    /* Store as percent numbers (4.09 = +4.09%). */
    converted[toItemStatKey(key)] = pct(v);
  });
  let cost = 0;
  STAT_ORDER.forEach((key) => { cost += raw[key] * statCosts[key]; });
  itemStats[id] = {
    stats: converted,
    statCost: round2(cost),
    sheetStatCost: num(cells[20]),
    attributeCount: num(cells[21]),
  };
  if (Math.abs(itemStats[id].statCost - itemStats[id].sheetStatCost) > 0.01) {
    fail(`item ${id}: recomputed stat cost ${itemStats[id].statCost} != sheet ${itemStats[id].sheetStatCost}`);
  }
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

  const bonus1Text = cells[16] || '';
  const bonus2Text = cells[18] || '';
  const uniqueText = cells[20] || '';
  const tradeoffText = cells[22] || '';

  const bonuses = [];
  if (bonus1Text) bonuses.push({ text: bonus1Text, cost: num(cells[17]), parsed: parseEffectText(bonus1Text, { strict: true }) });
  if (bonus2Text) bonuses.push({ text: bonus2Text, cost: num(cells[19]), parsed: parseEffectText(bonus2Text, { strict: true }) });

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
    bonuses,
    uniqueEffect: uniqueText ? { text: uniqueText, cost: num(cells[21]), parsed: parseEffectText(uniqueText, { strict: true }) } : null,
    tradeoff: tradeoffText ? { text: tradeoffText, credit: num(cells[23]), parsed: parseEffectText(tradeoffText, { strict: true }) } : null,
    stats: es.stats,
    notes: cells[35] || '',
  };
  const comboTag = cells[36] || '';
  if (comboTag) item.combinationTag = comboTag;
  if (cells[37]) item.combinationStatus = cells[37];
  if (/Focus Orb/i.test(item.family)) {
    const focus = ORB_FOCUS_FROM_TAG[comboTag]
      || (String(item.name).match(/\b(Poison|Burn|Chill|Shock|Bleed|Echo)\b/i) || [])[1];
    if (focus) item.orbFocus = String(focus).toLowerCase();
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
  if (es.attributeCount !== rb.attributeLines) fail(`item ${id}: ${es.attributeCount} attribute lines, expected ${rb.attributeLines}`);
  if (bonuses.length !== rb.namedBonuses) fail(`item ${id}: ${bonuses.length} named bonuses, expected ${rb.namedBonuses}`);
  if (rb.uniqueRule === 'required' && !item.uniqueEffect) fail(`item ${id}: orange item missing unique effect`);
  if (rb.uniqueRule !== 'required' && item.uniqueEffect) fail(`item ${id}: unique effect on non-orange item`);
  // budget window
  const mult = budgetClassMultipliers[item.budgetClass];
  if (mult == null) fail(`item ${id}: unknown budget class ${item.budgetClass}`);
  const budget = rb.baseBudget * (mult || 0);
  const totalCost = es.statCost
    + bonuses.reduce((s, b) => s + b.cost, 0)
    + (item.uniqueEffect ? item.uniqueEffect.cost : 0)
    - (item.tradeoff ? item.tradeoff.credit : 0);
  const used = budget ? totalCost / budget : 0;
  if (used < rb.targetLow - 1e-6 || used > rb.targetHigh + 1e-6) {
    fail(`item ${id}: budget used ${(used * 100).toFixed(1)}% outside [${rb.targetLow * 100}%, ${rb.targetHigh * 100}%] (cost ${round2(totalCost)} / budget ${round2(budget)})`);
  }
}
const itemCount = Object.keys(items).length;
if (itemCount !== 240) fail(`expected 240 items, got ${itemCount}`);

/* ---- Equipment Families ---- */
const families = {};
for (const { cells, rowNum } of tableRows(sheets['Equipment Families'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Equipment Families row ${rowNum}: empty family`); continue; }
  families[name] = {
    name,
    slot: cells[1],
    subtype: cells[2],
    hands: num(cells[3]),
    classAccess: cells[4],
    preferredClasses: cells[5],
    primaryStats: cells[6],
    skillA: cells[7],
    skillB: cells[8] || null,
    ultimate: cells[9] || null,
    playstyle: cells[10],
    catalogueGroup: cells[13],
  };
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
    if (PENDING_FAMILIES.has(fam)) {
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
  const o = hasKeyCol ? 1 : 0;
  const className = hasKeyCol ? cells[1] : cells[0];
  const rarityKey = RARITY_KEYS[hasKeyCol ? cells[2] : cells[1]];
  const loadout = {
    class: String(className).toLowerCase(),
    rarity: rarityKey,
    equipment: {
      helmet: cells[2 + o] || null,
      armour: cells[3 + o] || null,
      mainHand: cells[4 + o] || null,
      offHand: cells[5 + o] || null,
      shield: cells[6 + o] || null,
      ankletL: cells[7 + o] || null,
      ankletR: cells[8 + o] || null,
      necklace: cells[9 + o] || null,
    },
    totals: {},
  };
  STAT_ORDER.forEach((key, i) => {
    const v = num(cells[10 + o + i]);
    if (v !== 0) loadout.totals[toItemStatKey(key)] = pct(v);
  });
  // verify every referenced item exists + recompute totals
  const recomputed = {};
  for (const [slotKey, iid] of Object.entries(loadout.equipment)) {
    if (!iid) continue;
    const it = items[iid];
    if (!it) { fail(`reference loadout ${className}/${rarityKey}: ${slotKey} item "${iid}" not in catalogue`); continue; }
    for (const [sk, sv] of Object.entries(it.stats)) recomputed[sk] = round2((recomputed[sk] || 0) + sv);
  }
  for (const key of STAT_ORDER) {
    const itemKey = toItemStatKey(key);
    const a = loadout.totals[itemKey] || 0;
    const b = recomputed[itemKey] || 0;
    if (Math.abs(a - b) > 0.05) fail(`reference loadout ${className}/${rarityKey}: ${itemKey} total ${a} != recomputed ${b}`);
  }
  referenceLoadouts.push(loadout);
}
if (referenceLoadouts.length !== 48) fail(`expected 48 reference loadouts (8 classes x 6 rarities), got ${referenceLoadouts.length}`);

/* ---- Class Perks → classes ---- */
const classes = {};
for (const { cells, rowNum } of tableRows(sheets['Class Perks'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Class Perks row ${rowNum}: empty class`); continue; }
  const id = name.toLowerCase();
  classes[id] = {
    id,
    name,
    combatIdentity: cells[1],
    reference: {
      hp: num(cells[2]), atk: num(cells[3]), def: num(cells[4]), matk: num(cells[5]), mdef: num(cells[6]), spd: num(cells[7]),
      dodge: pct(cells[8]), acc: 0, critChance: pct(cells[10]), critDamage: num(cells[11]),
    },
    /* Precision is action-owned in v0.5+; no permanent ACC floor. */
    minAcc: 0,
    precisionSource: cells[12] || 'Skill Library',
    weights: {
      hp: num(cells[13]), atk: num(cells[14]), def: num(cells[15]), matk: num(cells[16]), mdef: num(cells[17]),
      spd: num(cells[18]), dodge: num(cells[19]), ferocity: num(cells[20]), crit: num(cells[21]), acc: 0,
    },
    classPerk: cells[22],
    classPerkEffect: cells[23],
    classPerkTrigger: cells[24],
    classPerkParsed: parseEffectText(cells[23], { strict: false }),
    powerScore: num(cells[25]),
    equipmentDirection: cells[27] || '',
  };
}
if (Object.keys(classes).length !== 8) fail(`expected 8 classes, got ${Object.keys(classes).length}`);

/* ---- Bird Stats → birds-v2 ---- */
const existingBirdKeys = loadExistingBirdKeys();
const birdsV2 = {};
const birdNameToKey = {};
for (const { cells, rowNum } of tableRows(sheets['Bird Stats'], 4)) {
  const name = cells[0];
  if (!name) { fail(`Bird Stats row ${rowNum}: empty name`); continue; }
  const key = birdKeyFor(name, existingBirdKeys);
  if (!key) { fail(`Bird Stats: no existing bird key for "${name}"`); continue; }
  birdNameToKey[name] = key;
  const cls = String(cells[1] || '').toLowerCase();
  const hp = num(cells[7]);
  const bird = {
    name,
    class: cls,
    realSize: cells[2],
    speciesTier: RARITY_KEYS[cells[3]] || String(cells[3] || '').toLowerCase(),
    tierRank: num(cells[4]),
    starter: /yes/i.test(cells[5] || ''),
    aspect: normalizeAffinity(cells[6]),
    stats: {
      hp, maxHp: hp,
      atk: num(cells[8]), def: num(cells[9]), matk: num(cells[10]), mdef: num(cells[11]), spd: num(cells[12]),
      dodge: pct(cells[13]),
      /* Precision removed as permanent bird stat (v0.5). */
      acc: 0,
      critChance: pct(cells[15]),
    },
    critDamage: num(cells[16]),
    primaryScaling: cells[17],
    bossOverride: /OVERRIDE/i.test(cells[21] || '') || name === 'Duke Blakiston',
    roleNote: cells[23] || '',
    gearNote: cells[24] || '',
  };
  birdsV2[key] = bird;
}
if (Object.keys(birdsV2).length !== 52) fail(`expected 52 birds, got ${Object.keys(birdsV2).length}`);

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
  birdPassives[key] = {
    bird: name,
    name: cells[3],
    effect: cells[4],
    triggerLimit: cells[5],
    score: passiveScore,
    budget: passiveBudget,
    parsed: parseEffectText(cells[4], { strict: false }),
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

/* ---- Damage Lab oracle fixtures (direct scaling + % equipment) ---- */
const EN_BASE = { 1: 5, 2: 11, 3: 17, 4: 23, 6: 35 };
function defenceModFor(effDef) {
  return 100 / (100 + Math.max(0, effDef));
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
    if (!sk || sk.skillType === 'Utility' || sk.ap == null) continue;
    const ap = sk.ap[lo.rarity] != null ? sk.ap[lo.rarity] : sk.fixedCoefficient;
    if (ap == null) continue;
    const scalingKey = sk.scalingStat === 'MATK' ? 'matk' : 'atk';
    const gearPct = (lo.totals[scalingKey + 'Pct'] || 0) / 100;
    const attackerStat = Math.round(cls.reference[scalingKey] * (1 + gearPct));
    const defKey = sk.damageType === 'Magic' ? 'mdef' : 'def';
    const defGearPct = (lo.totals[defKey + 'Pct'] || 0) / 100;
    const defenderDef = Math.round(cls.reference[defKey] * (1 + defGearPct));
    const penPct = Math.min(40, sk.intrinsicPenPct
      + (sk.damageType === 'Magic' ? (lo.totals.magicPenPct || 0) : (lo.totals.physicalPenPct || 0)));
    const effDef = defenderDef * (1 - penPct / 100);
    const baseDamage = (apBands[String(sk.en)] && apBands[String(sk.en)].baseDamage) || 0;
    const defenceMod = defenceModFor(effDef);
    const raw = (baseDamage + attackerStat * ap) * defenceMod;
    const damage = Math.max(1, Math.round(raw));
    fixtures.push({
      class: lo.class, rarity: lo.rarity, skillId: sid,
      en: sk.en, baseDamage, ap,
      attackerScalingTotal: attackerStat, classReference: cls.reference[scalingKey],
      gearPct: round2(gearPct),
      defenderDefence: defenderDef, penPct: round2(penPct), effectiveDefence: round2(effDef),
      defenceMod: Math.round(defenceMod * 10000) / 10000,
      aspectMod: 1, bonusMod: 1, crit: false,
      expectedDamage: damage,
      formula: 'directScaling',
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
  slotOrder: ['helmet', 'armour', 'mainHand', 'offHand', 'shield', 'ankletL', 'ankletR', 'necklace'],
  budgetClassMultipliers,
  rarityBudgets,
  rarityOrder: RARITY_ORDER,
  statCosts,
  statDisplayNames,
  forbiddenStatIds,
  apBands,
};

writeDataFile('js/data/equipment/slots.js', 'Avian.data.equipment.slots', slotsData);
writeDataFile('js/data/equipment/skills.js', 'Avian.data.equipment.skills', skills,
  'v0.6 Skill Library: 64 base + 18 combinations; fixed technique coefficients; EN role bumps.');
writeDataFile('js/data/equipment/items.js', 'Avian.data.equipment.items', items,
  'v0.6 percentage-scaled catalogue (core stats as *Pct).');
writeDataFile('js/data/equipment/families.js', 'Avian.data.equipment.families', families,
  'v0.6 family access locks, Dagger Pinion rename, Bow/HCrossbow stubs (no invented items).');
writeDataFile('js/data/equipment/reference-loadouts.js', 'Avian.data.equipment.referenceLoadouts', referenceLoadouts);
writeDataFile('js/data/effect-tiers.js', 'Avian.data.effectTiers', effectTiers,
  'v0.6 core 6/8/12 + point tiers 3/5/8 + Brace.');
writeDataFile('js/data/birds-v2.js', 'Avian.data.birdsV2', birdsV2,
  'v0.6 bird bases: +20 Vitality rebase; Precision removed; Affinity plain→Latin.');
writeDataFile('js/data/combat-pack/classes.js', 'Avian.data.combatPack.classes', classes,
  'v0.6 class references (+20 Vitality); Precision action-owned.');
writeDataFile('js/data/combat-pack/bird-passives.js', 'Avian.data.combatPack.birdPassives', birdPassives,
  'v0.6 species passives.');
writeDataFile('js/data/combat-pack/innate-utilities.js', 'Avian.data.combatPack.innateUtilities', innateUtilities,
  'v0.6 innate utilities (one per bird).');

mkdirSync(path.join(ROOT, 'scripts', 'fixtures'), { recursive: true });
writeFileSync(
  path.join(ROOT, 'scripts', 'fixtures', 'equipment-damage-fixtures.json'),
  JSON.stringify({
    _note: `GENERATED by import-equipment-workbook.mjs from workbook v${META.version}. Direct-scaling oracles: round((Base Damage + Stat × coeff) × Defence Mod), min 1.`,
    fixtures,
  }, null, 2) + '\n',
);
console.log('wrote scripts/fixtures/equipment-damage-fixtures.json (' + fixtures.length + ' vectors)');

console.log(`\nimport OK — workbook v${META.version} (${META.updated}); ${itemCount} items, ${skillCount} skills, ${Object.keys(families).length} families, ${referenceLoadouts.length} reference loadouts, ${Object.keys(birdsV2).length} birds, ${Object.keys(classes).length} classes; ${warnings.length} warning(s).`);
