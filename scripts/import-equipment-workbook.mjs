#!/usr/bin/env node
/*
 * Import "Newest Avian_Ascent_Master_Equipment_and_Bird_Balance_v0.3.xlsx"
 *   → js/data/equipment/{slots,skills,items,families,reference-loadouts}.js
 *   → js/data/effect-tiers-v2.js
 *   → js/data/birds-v2.js, js/data/combat-pack/{classes-v2,bird-passives-v2,innate-utilities}.js
 *   → scripts/fixtures/equipment-damage-fixtures.json (Damage Lab oracle vectors)
 *
 * Usage: AA_EQUIPMENT_WORKBOOK=/path/to/workbook.xlsx node scripts/import-equipment-workbook.mjs
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
  'Newest Avian_Ascent_Master_Equipment_and_Bird_Balance_v0.3.xlsx',
);
const WORKBOOK = process.env.AA_EQUIPMENT_WORKBOOK || DEFAULT_WORKBOOK;
const EQUIPMENT_PACK_VERSION = '2026.07-equipment-v0.3';

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
const PCT_STATS = new Set(STAT_ORDER.slice(6));
const STAT_ID_MAP = {
  HP: 'hp', ATK: 'atk', DEF: 'def', MATK: 'matk', MDEF: 'mdef', SPD: 'spd',
  DodgePct: 'dodgePct', CritChancePct: 'critChancePct', CritDamagePct: 'critDamagePct',
  PhysicalPenPct: 'physicalPenPct', MagicPenPct: 'magicPenPct',
  PhysicalDamagePct: 'physicalDamagePct', MagicDamagePct: 'magicDamagePct',
  AspectDamagePct: 'aspectDamagePct', HealingPowerPct: 'healingPowerPct', ShieldStrengthPct: 'shieldStrengthPct',
};

/* ------------------------------------------------------------------ *
 * Effect-text parser (strict for equipment bonus/unique/trade-off)    *
 * ------------------------------------------------------------------ */

const EFFECT_STAT_NAMES = [
  ['Physical Damage', 'physicalDamage'],
  ['Magic Damage', 'magicDamage'],
  ['Aspect Damage', 'aspectDamage'],
  ['Damage Taken', 'damageTaken'],
  ['Crit Chance', 'critChance'],
  ['Crit Damage', 'critDamage'],
  ['Healing Power', 'healingPower'],
  ['Shield Strength', 'shieldStrength'],
  ['Healing', 'healingReceived'],
  ['Accuracy', 'acc'],
  ['MATK', 'matk'],
  ['MDEF', 'mdef'],
  ['ATK', 'atk'],
  ['DEF', 'def'],
  ['SPD', 'spd'],
  ['Dodge', 'dodge'],
  ['ACC', 'acc'],
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
  [/(?:^|; )(?:While |When |)above (\d+)% HP\b/i, (m) => ({ kind: 'whileHpAbove', pct: Number(m[1]) })],
  [/^(?:When|While) below (\d+)% HP/i, (m) => ({ kind: 'whileHpBelow', pct: Number(m[1]) })],
  [/fall(?:s)? below (\d+)% HP/i, (m) => ({ kind: 'onHpBelow', pct: Number(m[1]) })],
  [/^After you Dodge a Magic attack/, () => ({ kind: 'afterDodgeMagic' })],
  [/^After you Dodge/, () => ({ kind: 'afterDodge' })],
  [/after you Dodge/, () => ({ kind: 'afterDodge' })],
  [/^After two consecutive Dodges/, () => ({ kind: 'afterConsecutiveDodges', count: 2 })],
  [/^After a critical hit/, () => ({ kind: 'afterCrit' })],
  [/^After applying a stat debuff/, () => ({ kind: 'afterApplyDebuff' })],
  [/^After applying an ailment/, () => ({ kind: 'afterApplyAilment' })],
  [/^After you apply an ailment stack/, () => ({ kind: 'afterApplyAilment' })],
  [/^(?:After|When you) cleans(?:ing|e) a debuff( or ailment)?/, (m) => ({ kind: 'afterCleanse', includesAilment: !!m[1] })],
  [/^After dealing (?:Aspect-)?dominant (?:Aspect )?damage/, () => ({ kind: 'afterDominantHit' })],
  [/^After you heal or gain a Shield/, () => ({ kind: 'afterHealOrShield' })],
  [/^After healing/, () => ({ kind: 'afterHeal' })],
  [/^After landing a Physical skill/, () => ({ kind: 'afterPhysicalHit' })],
  [/^After taking reduced damage/, () => ({ kind: 'afterReducedDamage' })],
  [/^After using two different staff skills/, () => ({ kind: 'afterTwoDifferentStaffSkills' })],
  [/^After using both Grimoire attacks/, () => ({ kind: 'afterBothGrimoireAttacks' })],
  [/^After using a Magic skill/, () => ({ kind: 'afterMagicSkill' })],
  [/^After using an Armour Technique/, () => ({ kind: 'afterArmourTechnique' })],
  [/^After you Guard/, () => ({ kind: 'afterGuard' })],
  [/^After you act before the enemy/, () => ({ kind: 'afterActFirst' })],
  [/^After you break Guard/, () => ({ kind: 'afterBreakGuard' })],
  [/^After you take damage/, () => ({ kind: 'afterTakeDamage' })],
  [/after taking Magic damage/, () => ({ kind: 'afterTakeMagicDamage' })],
  [/^After your Armour Technique absorbs a hit/, () => ({ kind: 'afterArmourAbsorb' })],
  [/when an Armour Technique reduces damage/, () => ({ kind: 'afterArmourAbsorb' })],
  [/^After using ([A-Za-z' -]+?),/, (m) => ({ kind: 'afterSkillUse', skill: m[1] })],
  [/^After ([A-Za-z' -]+?) (lands|hits|cleanses a debuff|absorbs damage),/, (m) => ({ kind: 'afterSkillEvent', skill: m[1], event: m[2] })],
  [/^After ([A-Za-z' -]+?),/, (m) => ({ kind: 'afterSkillUse', skill: m[1] })],
  [/^Against a target below (\d+)% HP/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/against a target below (\d+)% HP/, (m) => ({ kind: 'vsTargetHpBelow', pct: Number(m[1]) })],
  [/after reducing an enemy below (\d+)% HP/, (m) => ({ kind: 'afterEnemyHpBelow', pct: Number(m[1]) })],
  [/^Against a target with Delayed damage stored/, () => ({ kind: 'vsTargetDelayed' })],
  [/^Against a (Bleeding or Poisoned|Bleeding|Poisoned|debuffed) target/, (m) => ({ kind: 'vsTargetState', state: m[1] })],
  [/against a (Bleeding or Poisoned|Bleeding|Poisoned|debuffed) target/, (m) => ({ kind: 'vsTargetState', state: m[1] })],
  [/^(?:At combat start|Before combat)/, () => ({ kind: 'combatStart' })],
  [/^At the start of each turn, if the enemy has a buff/, () => ({ kind: 'turnStartEnemyBuffed' })],
  [/^If hit while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'hitWhileSkillActive', skill: m[1] })],
  [/^(?:If you are|While) faster(?: than the enemy)?/, () => ({ kind: 'whileFaster' })],
  [/^If you took no damage since your previous turn/, () => ({ kind: 'noDamageSinceLastTurn' })],
  [/^Shields created while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'shieldsWhileSkillActive', skill: m[1] })],
  [/while ([A-Za-z' -]+?) is active/, (m) => ({ kind: 'whileSkillActive', skill: m[1] })],
  [/^The first Aspect weakness hit each turn/, () => ({ kind: 'firstAspectWeaknessHit' })],
  [/^The first damaging attack that would hit after ([A-Za-z' -]+)/, (m) => ({ kind: 'firstIncomingHitAfterSkill', skill: m[1] })],
  [/^The first damaging hit received after an Armour Technique/, () => ({ kind: 'firstHitReceivedAfterArmourTechnique' })],
  [/^The first heal received at full HP/, () => ({ kind: 'firstHealAtFullHp' })],
  [/^The first successful Dodge/, () => ({ kind: 'firstDodge' })],
  [/^The first time you Guard/, () => ({ kind: 'firstGuard' })],
  [/first ([A-Za-z' -]+?) critical hit/, (m) => ({ kind: 'skillCrit', skill: m[1] })],
  [/^When ([A-Za-z' -]+?) hits an Aspect weakness/, (m) => ({ kind: 'onAspectWeaknessHit', skill: m[1] })],
  [/^When you hit an Aspect weakness/, () => ({ kind: 'onAspectWeaknessHit' })],
  [/^When ([A-Za-z' -]+?) hits a Guarded target/, (m) => ({ kind: 'onSkillHitGuarded', skill: m[1] })],
  [/^When an ailment upgrades/, () => ({ kind: 'onAilmentUpgrade' })],
  [/prevent the next ailment from upgrading/, () => ({ kind: 'onAilmentUpgrade' })],
  [/^When Burn reaches 5 stacks/, () => ({ kind: 'vsScorchedTarget' })],
  [/^While Shielded/, () => ({ kind: 'whileShielded' })],
  [/^While affected by an ailment/, () => ({ kind: 'whileAilmented' })],
  [/^Your Armour Technique/, () => ({ kind: 'armourTechniqueModifier' })],
  [/^Your first landed weapon hit/, () => ({ kind: 'firstWeaponHit' })],
  [/^Your first resisted hit/, () => ({ kind: 'firstResistedHit' })],
  [/^Damage-linked healing from ([A-Za-z' -]+?) skills/, (m) => ({ kind: 'skillHealingModifier', family: m[1] })],
  [/^Overhealing from ([A-Za-z' -]+?) becomes/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/after a landed Physical hit against your Shield/, () => ({ kind: 'hitOnShieldReceived' })],
  [/lethal damage leaves you at 1 HP/, () => ({ kind: 'onLethalDamage' })],
  [/a landed ([A-Za-z' -]+?) applies/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/a resisted ([A-Za-z' -]+?) hit is treated/, (m) => ({ kind: 'skillModifier', skill: m[1] })],
  [/when the two equipped Orbs have different Aspects/, () => ({ kind: 'skillModifier', condition: 'differentOrbAspects' })],
  [/^(?:Minor|Moderate|Major) [A-Za-z %]+ (?:Up|Down)\b.*while equipped/, () => ({ kind: 'whileEquipped' })],
  [/^([A-Z][A-Za-z' -]+?) (?:also grants|also restores|grants|gains|applies|heals|stores|persists|breaks|makes|deals|extends|may choose|may cleanse|may replace)\b/,
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
  [/Heal (\d+)% Max HP/i, (m) => ({ id: 'healMaxHp', pct: Number(m[1]) })],
  [/(Minor|Moderate|Major) Damage Reduction/i, (m) => ({ id: 'damageReduction', tier: m[1].toLowerCase() })],
  [/appl(?:y|ies) (\d+) (?:additional )?(?:stacks? of (?:its|the wand's|an) aligned ailment|aligned ailment stacks?)/,
    (m) => ({ id: 'applyAlignedAilment', stacks: Number(m[1]) })],
  [/applies (\d+) additional aligned ailment stack/, (m) => ({ id: 'applyAlignedAilment', stacks: Number(m[1]) })],
  [/stores? (?:an additional )?(\d+)%(?: of its damage| Ability Power)? as Delayed damage/, (m) => ({ id: 'delayedStore', pct: Number(m[1]) })],
  [/heals? for (\d+)% of damage dealt/, (m) => ({ id: 'healOnDamage', pct: Number(m[1]) })],
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
    ` * Source workbook: Avian_Ascent_Master_Equipment_and_Bird_Balance v${META.version} (updated ${META.updated})` + (note ? `\n * ${note}` : ''),
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
  'Bird Stats', 'Bird Abilities', 'Aspects & Ailments', 'Data Lists'];
for (const n of need) {
  if (!sheets[n]) { console.error('Missing sheet:', n); process.exit(1); }
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
  } else {
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

/* ---- Effect Tiers ---- */
const tierRows = { minor: sheets['Effect Tiers'][5], moderate: sheets['Effect Tiers'][6], major: sheets['Effect Tiers'][7] };
const effectTiers = { buff: {}, debuff: {} };
for (const [tier, row] of Object.entries(tierRows)) {
  if (!row) { fail('Effect Tiers row missing for ' + tier); continue; }
  effectTiers.buff[tier] = pct(row[1]);
  effectTiers.debuff[tier] = Math.abs(pct(row[2]));
}

/* ---- Rarity Budgets + AP bands ---- */
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
for (let r = 14; r <= 18; r++) {
  const row = sheets['Rarity Budgets'][r];
  if (!row || row[0] === '') continue;
  apBands[String(num(row[0]))] = { minAp: num(row[1]), maxAp: num(row[2]), use: row[3] || '' };
}
if (Object.keys(apBands).length !== 5) fail('expected 5 EN AP bands');

/* ---- Skill Library ---- */
const skillRarityCols = { grey: 14, green: 15, blue: 16, purple: 17, gold: 18, orange: 19 };
const skills = {};
for (const { cells, rowNum } of tableRows(sheets['Skill Library'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Skill Library row ${rowNum}: empty id`); continue; }
  const ap = {};
  for (const [rk, ci] of Object.entries(skillRarityCols)) {
    const v = cells[ci];
    if (v !== '') ap[rk] = num(v);
  }
  const riderText = cells[20] || '';
  skills[id] = {
    id,
    name: cells[1],
    source: cells[2],
    family: cells[3],
    barSlot: cells[4],
    skillType: cells[5],
    en: num(cells[6]),
    cooldown: num(cells[7]),
    meter: cells[8] === 'Full' ? 'full' : 'none',
    target: cells[9],
    damageType: cells[10],
    scalingStat: cells[11] === 'None' ? null : cells[11],
    aspectRule: cells[12],
    hits: num(cells[13]),
    ap,
    riderText,
    rider: parseEffectText(riderText, { strict: false, mode: 'action' }),
    minRarity: RARITY_KEYS[cells[21]] || 'grey',
    classNote: cells[23] || '',
    intrinsicPenPct: pct(cells[25]),
  };
  // AP within band for damaging skills
  const sk = skills[id];
  if (sk.skillType !== 'Utility' && sk.skillType !== 'Ultimate Utility' && Object.keys(ap).length) {
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

/* ---- Equipment Stats (numeric matrix) ---- */
const itemStats = {}; // id → { stats (converted), rawDecimals, statCost, attributeCount }
for (const { cells, rowNum } of tableRows(sheets['Equipment Stats'], 4)) {
  const id = cells[0];
  if (!id) { fail(`Equipment Stats row ${rowNum}: empty id`); continue; }
  const raw = {};
  STAT_ORDER.forEach((key, i) => {
    raw[key] = num(cells[4 + i]);
  });
  // percent stats are stored as decimals in the sheet; convert to percent numbers
  const converted = {};
  STAT_ORDER.forEach((key) => {
    const v = raw[key];
    if (v === 0) return;
    converted[key] = PCT_STATS.has(key) ? pct(v) : v;
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
    aspect: (cells[11] || 'Neutral').toLowerCase(),
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
if (Object.keys(families).length !== 40) fail(`expected 40 families, got ${Object.keys(families).length}`);
for (const [fam, counts] of Object.entries(familyRarityCounts)) {
  if (!families[fam]) fail(`catalogue family "${fam}" not in Equipment Families sheet`);
  for (const rk of RARITY_ORDER) {
    if ((counts[rk] || 0) !== 1) fail(`family "${fam}": ${counts[rk] || 0} ${rk} items, expected 1`);
  }
}
for (const fam of Object.keys(families)) {
  if (!familyRarityCounts[fam]) fail(`family "${fam}" has no catalogue items`);
}

/* ---- Reference Loadouts ---- */
const referenceLoadouts = [];
for (const { cells, rowNum } of tableRows(sheets['Reference Loadouts'], 4)) {
  const cls = cells[0];
  const rarity = RARITY_KEYS[cells[1]];
  if (!cls || !rarity) { fail(`Reference Loadouts row ${rowNum}: bad class/rarity`); continue; }
  const loadout = {
    class: cls.toLowerCase(),
    rarity,
    equipment: {
      helmet: cells[2] || null,
      armour: cells[3] || null,
      mainHand: cells[4] || null,
      offHand: cells[5] || null,
      shield: cells[6] || null,
      ankletL: cells[7] || null,
      ankletR: cells[8] || null,
      necklace: cells[9] || null,
    },
    totals: {},
  };
  STAT_ORDER.forEach((key, i) => {
    const v = num(cells[10 + i]);
    if (v !== 0) loadout.totals[key] = PCT_STATS.has(key) ? pct(v) : v;
  });
  // verify every referenced item exists + recompute totals
  const recomputed = {};
  for (const [slotKey, iid] of Object.entries(loadout.equipment)) {
    if (!iid) continue;
    const it = items[iid];
    if (!it) { fail(`reference loadout ${cls}/${rarity}: ${slotKey} item "${iid}" not in catalogue`); continue; }
    for (const [sk, sv] of Object.entries(it.stats)) recomputed[sk] = round2((recomputed[sk] || 0) + sv);
  }
  for (const key of STAT_ORDER) {
    const a = loadout.totals[key] || 0;
    const b = recomputed[key] || 0;
    if (Math.abs(a - b) > 0.01) fail(`reference loadout ${cls}/${rarity}: ${key} total ${a} != recomputed ${b}`);
  }
  referenceLoadouts.push(loadout);
}
if (referenceLoadouts.length !== 48) fail(`expected 48 reference loadouts (8 classes x 6 rarities), got ${referenceLoadouts.length}`);

/* ---- Class Perks → classes-v2 ---- */
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
      dodge: pct(cells[8]), acc: pct(cells[9]), critChance: pct(cells[10]), critDamage: num(cells[11]),
    },
    minAcc: pct(cells[12]),
    weights: {
      hp: num(cells[13]), atk: num(cells[14]), def: num(cells[15]), matk: num(cells[16]), mdef: num(cells[17]),
      spd: num(cells[18]), dodge: num(cells[19]), acc: num(cells[20]), crit: num(cells[21]),
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
    speciesTier: RARITY_KEYS[cells[3]] || cells[3].toLowerCase(),
    tierRank: num(cells[4]),
    starter: /yes/i.test(cells[5] || ''),
    aspect: String(cells[6] || '').toLowerCase(),
    stats: {
      hp, maxHp: hp,
      atk: num(cells[8]), def: num(cells[9]), matk: num(cells[10]), mdef: num(cells[11]), spd: num(cells[12]),
      dodge: pct(cells[13]), acc: pct(cells[14]), critChance: pct(cells[15]),
    },
    critDamage: num(cells[16]),
    primaryScaling: cells[17],
    bossOverride: /OVERRIDE/i.test(cells[21] || '') || name === 'Duke Blakiston',
    roleNote: cells[23] || '',
    gearNote: cells[24] || '',
  };
  birdsV2[key] = bird;
  // ACC floor audit
  const cref = classes[cls];
  if (cref && bird.stats.acc < cref.minAcc && !bird.bossOverride) {
    fail(`bird ${name}: ACC ${bird.stats.acc}% below class minimum ${cref.minAcc}%`);
  }
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
  if (passiveScore > passiveBudget + 1e-9) fail(`bird ${name}: passive score ${passiveScore} > budget ${passiveBudget}`);
  if (utilScore > utilBudget + 1e-9) fail(`bird ${name}: utility score ${utilScore} > budget ${utilBudget}`);
  const expectedBudget = utilityBudgetFor(utilEn, utilCd);
  if (Math.abs(expectedBudget - utilBudget) > 1e-9) {
    fail(`bird ${name}: utility budget ${utilBudget} != formula value ${expectedBudget} (EN ${utilEn}, CD ${utilCd})`);
  }
  if (!birdPassives[key].parsed) warn(`bird passive not fully parsed (kept raw): ${name} — "${cells[4]}"`);
  if (!innateUtilities[key].parsed) warn(`innate utility not fully parsed (kept raw): ${name} — "${cells[13]}"`);
}
if (Object.keys(birdPassives).length !== 52) fail(`expected 52 bird passives, got ${Object.keys(birdPassives).length}`);

/* ---- Aspects & Ailments: verify chart vs js/data/aspects.js ---- */
{
  const aspectsSrc = readFileSync(path.join(ROOT, 'js', 'data', 'aspects.js'), 'utf8');
  const m = aspectsSrc.match(/Avian\.data\.aspects = Object\.freeze\((\{[\s\S]*?\})\);/);
  if (!m) fail('could not parse js/data/aspects.js');
  else {
    const live = JSON.parse(m[1]);
    const MOD_TO_REL = { 1.2: 'dominant', 1: 'neutral', 0.8: 'resisted' };
    const names = ['Terra', 'Aeris', 'Tempest', 'Solis', 'Lunae', 'Maris'];
    for (let i = 0; i < 6; i++) {
      const row = sheets['Aspects & Ailments'][5 + i];
      const attacker = names[i].toLowerCase();
      if (!row || row[0] !== names[i]) { fail(`Aspects chart row ${5 + i}: expected ${names[i]}`); continue; }
      for (let j = 0; j < 6; j++) {
        const defender = names[j].toLowerCase();
        const rel = MOD_TO_REL[num(row[1 + j])];
        const liveRel = live.chart[attacker] && live.chart[attacker][defender];
        if (rel !== liveRel) fail(`Aspect chart drift ${attacker}→${defender}: workbook ${rel} vs code ${liveRel}`);
      }
    }
  }
}

/* ---- Damage Lab oracle fixtures (Scaling Model formula, data-driven) ---- */
const EN_BASE = { 1: 5, 2: 11, 3: 17, 4: 23, 6: 35 };
function statModFor(total, ref) {
  return Math.min(1.6, Math.max(0.8, 1 + (total - ref) / 50));
}
function defenceModFor(effDef) {
  return 100 / (100 + effDef * 3);
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
    if (!sk || sk.skillType === 'Utility') continue;
    const ap = sk.ap[lo.rarity];
    if (ap == null) continue;
    const scalingKey = sk.scalingStat === 'MATK' ? 'matk' : 'atk';
    const attackerStat = cls.reference[scalingKey] + (lo.totals[scalingKey] || 0);
    const defKey = sk.damageType === 'Magic' ? 'mdef' : 'def';
    const defenderDef = cls.reference[defKey] + (lo.totals[defKey] || 0);
    const penPct = Math.min(40, sk.intrinsicPenPct
      + (sk.damageType === 'Magic' ? (lo.totals.magicPenPct || 0) : (lo.totals.physicalPenPct || 0)));
    const effDef = defenderDef * (1 - penPct / 100);
    const enBase = EN_BASE[sk.en];
    const statMod = statModFor(attackerStat, cls.reference[scalingKey]);
    const defenceMod = defenceModFor(effDef);
    const damage = Math.max(1, Math.round(enBase * ap * statMod * defenceMod * 1 * 1));
    fixtures.push({
      class: lo.class, rarity: lo.rarity, skillId: sid,
      en: sk.en, enBase, ap,
      attackerScalingTotal: attackerStat, classReference: cls.reference[scalingKey],
      statMod: round2(statMod),
      defenderDefence: defenderDef, penPct: round2(penPct), effectiveDefence: round2(effDef),
      defenceMod: Math.round(defenceMod * 10000) / 10000,
      aspectMod: 1, bonusMod: 1, crit: false,
      expectedDamage: damage,
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
writeDataFile('js/data/equipment/skills.js', 'Avian.data.equipment.skills', skills);
writeDataFile('js/data/equipment/items.js', 'Avian.data.equipment.items', items);
writeDataFile('js/data/equipment/families.js', 'Avian.data.equipment.families', families);
writeDataFile('js/data/equipment/reference-loadouts.js', 'Avian.data.equipment.referenceLoadouts', referenceLoadouts);
writeDataFile('js/data/effect-tiers-v2.js', 'Avian.data.effectTiers', effectTiers,
  'v2 sibling: three-tier Minor/Moderate/Major model. Becomes effect-tiers.js in Phase 13.');
writeDataFile('js/data/birds-v2.js', 'Avian.data.birdsV2', birdsV2,
  'v2 sibling: v0.3 bird base stats. Wired into boot in Phase 6.');
writeDataFile('js/data/combat-pack/classes-v2.js', 'Avian.data.combatPack.classes', classes,
  'v2 sibling: v0.3 class references, weights and perks. Wired into boot in Phase 6.');
writeDataFile('js/data/combat-pack/bird-passives-v2.js', 'Avian.data.combatPack.birdPassives', birdPassives,
  'v2 sibling: v0.3 species passives. Wired into boot in Phase 6.');
writeDataFile('js/data/combat-pack/innate-utilities.js', 'Avian.data.combatPack.innateUtilities', innateUtilities,
  'v0.3 innate utilities (one per bird). Wired into boot in Phase 6.');

mkdirSync(path.join(ROOT, 'scripts', 'fixtures'), { recursive: true });
writeFileSync(
  path.join(ROOT, 'scripts', 'fixtures', 'equipment-damage-fixtures.json'),
  JSON.stringify({
    _note: `GENERATED by import-equipment-workbook.mjs from workbook v${META.version}. Damage Lab oracle vectors: round(EN Base x AP x Stat Mod x Defence Mod x Aspect Mod x Bonus Mod), min 1.`,
    fixtures,
  }, null, 2) + '\n',
);
console.log('wrote scripts/fixtures/equipment-damage-fixtures.json (' + fixtures.length + ' vectors)');

console.log(`\nimport OK — workbook v${META.version} (${META.updated}); ${itemCount} items, ${skillCount} skills, ${Object.keys(families).length} families, ${referenceLoadouts.length} reference loadouts, ${Object.keys(birdsV2).length} birds, ${Object.keys(classes).length} classes; ${warnings.length} warning(s).`);
