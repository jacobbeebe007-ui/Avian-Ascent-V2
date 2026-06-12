#!/usr/bin/env node
/*
 * Avian Ascent — Combat Content Importer
 *
 * Reads the two authoring spreadsheets and emits the data pack consumed
 * by js/systems/ability-dispatcher.js and js/systems/passive-hooks.js.
 *
 *   node scripts/import-combat-content.mjs [--verify]
 *
 * Outputs (written into js/data/combat-pack/):
 *   classes.js, birds-kits.js, families.js, skill-trees.js,
 *   bird-passives.js, endless-passives.js, shop-pool.js
 *
 * The script is purely additive — it never writes outside js/data/combat-pack/.
 * Re-run after editing the spreadsheets to regenerate the data layer.
 *
 * No external dependencies. Pure Node stdlib (fs/path/zlib).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const NEW_SHEETS = 'c:\\Users\\JaK_d\\Desktop\\Avian Ascent\\New Sheets';
const SHOP_XLSX = process.env.AA_SHOP_XLSX || path.join(NEW_SHEETS, 'New - avian_ascent_shop_learnable_abilities.xlsx');
const PERKS_XLSX = process.env.AA_PERKS_XLSX || path.join(NEW_SHEETS, 'avian_ascent_passive_perks.xlsx');
const ABILITY_XLSX_CANDIDATES = [
  'avian_ascent_ability_skill_trees_en_balanced_v2_updated.xlsx',
  'avian_ascent_ability_skill_trees_unique_starter_kits.xlsx',
];
const ABILITY_XLSX = process.env.AA_ABILITY_XLSX
  || ABILITY_XLSX_CANDIDATES.map((f) => path.join(NEW_SHEETS, f)).find((p) => existsSync(p))
  || path.join(NEW_SHEETS, ABILITY_XLSX_CANDIDATES[0]);
const ABILITY_SHEET_NAMES = ['Class Rules', 'Level 1 Kits', 'Ability Families', 'Skill Trees'];
const OUTPUT_DIR = path.join(ROOT, 'js', 'data', 'combat-pack');

// ---------------------------------------------------------------------------
// Minimal zip reader (xlsx is a zip)
// ---------------------------------------------------------------------------
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
    else throw new Error('Unsupported compression ' + compMethod + ' in ' + name);
    entries[name] = data.toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// XML helpers for OOXML SpreadsheetML
// ---------------------------------------------------------------------------
const decodeEntities = (s) => s
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#10;/g, '\n')
  .replace(/&#13;/g, '\r')
  .replace(/&amp;/g, '&');

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
  const rowRe = /<x:row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/x:row>|<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml)) !== null) {
    const rNum = parseInt(m[1] || m[3], 10);
    const inner = m[2] || m[4];
    const cells = [];
    const cellRe = /<x:c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/x:c>)|<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const attrs = cm[1] || cm[3];
      const body = cm[2] || cm[4] || '';
      const refM = /r="([A-Z]+\d+)"/.exec(attrs);
      const tM = /t="([^"]+)"/.exec(attrs);
      const t = tM ? tM[1] : '';
      const col = refM ? colNumFromRef(refM[1]) : cells.length + 1;
      let val = '';
      const vM = /<x:v>([\s\S]*?)<\/x:v>|<v>([\s\S]*?)<\/v>/.exec(body);
      if (t === 's' && vM) {
        const idx = parseInt(vM[1] || vM[2], 10);
        val = sharedStrings[idx] || '';
      } else if (t === 'inlineStr') {
        const isM = /<x:is>([\s\S]*?)<\/x:is>|<is>([\s\S]*?)<\/is>/.exec(body);
        if (isM) {
          val = [...((isM[1] || isM[2]).matchAll(/<x:t[^>]*>([\s\S]*?)<\/x:t>|<t[^>]*>([\s\S]*?)<\/t>/g))]
            .map((x) => decodeEntities(x[1] || x[2])).join('');
        }
      } else if (vM) {
        val = decodeEntities(vM[1] || vM[2]);
      } else if (t === 'str' && vM) {
        val = decodeEntities(vM[1] || vM[2]);
      }
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
  if (!wb) throw new Error('workbook.xml not in ' + xlsxPath);
  const wbRels = entries['xl/_rels/workbook.xml.rels'] || '';
  const sharedStrings = entries['xl/sharedStrings.xml'] ? parseSharedStrings(entries['xl/sharedStrings.xml']) : [];

  const relMap = Object.create(null);
  for (const rm of wbRels.matchAll(/<Relationship\s+([^>]+?)\s*\/>/g)) {
    const attrs = rm[1];
    const id = /(?:^|\s)Id="([^"]+)"/.exec(attrs)?.[1];
    const target = /(?:^|\s)Target="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) relMap[id] = target.replace(/^\/+/, '');
  }
  const sheetMetas = [];
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)) {
    sheetMetas.push({ name: decodeEntities(m[1]), rid: m[2] });
  }
  const sheets = Object.create(null);
  for (const meta of sheetMetas) {
    const target = relMap[meta.rid];
    if (!target) continue;
    const key = target.startsWith('xl/') ? target : ('xl/' + target.replace(/^\/+/, ''));
    const sheetXml = entries[key];
    if (!sheetXml) continue;
    sheets[meta.name] = parseSheet(sheetXml, sharedStrings);
  }
  return sheets;
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------
function headerToIndexMap(headerRow) {
  const map = Object.create(null);
  headerRow.forEach((name, i) => {
    if (!name) return;
    const norm = String(name).trim();
    if (!map[norm]) map[norm] = i;
  });
  return map;
}
function get(row, header, name) {
  const i = header[name];
  if (i == null) return '';
  return (row[i] || '').toString().trim();
}
function asNum(s) {
  if (s == null || s === '') return 0;
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
function asPct(s) {
  if (s == null || s === '') return 0;
  // Accept "12%", "12", "0.12", "13% chance"
  const m = String(s).match(/-?\d+(?:\.\d+)?/);
  if (!m) return 0;
  const n = Number(m[0]);
  return n;
}

// ---------------------------------------------------------------------------
// Bird key normalisation — must match js/data/birds.js
// ---------------------------------------------------------------------------
const BIRD_NAME_TO_KEY = {
  'Sparrow': 'sparrow',
  'Goose': 'goose',
  'Blackbird': 'blackbird',
  'Crow': 'crow',
  'Magpie': 'magpie',
  'Hummingbird': 'hummingbird',
  'Robin': 'robin',
  'Peregrine Falcon': 'peregrine',
  'Peregrine': 'peregrine',
  'Kiwi': 'kiwi',
  'Snowy Owl': 'snowyOwl',
  'Macaw': 'macaw',
  'Lyrebird': 'lyrebird',
  'Black Cockatoo': 'blackCockatoo',
  'Kookaburra': 'kookaburra',
  'Raven': 'raven',
  'Bowerbird': 'bowerbird',
  'Toucan': 'toucan',
  'Swan': 'swan',
  'Flamingo': 'flamingo',
  'Secretary Bird': 'secretary',
  'Secretary': 'secretary',
  'Albatross': 'albatross',
  'Seagull': 'seagull',
  'Shoebill': 'shoebill',
  'Harpy Eagle': 'harpy',
  'Harpy': 'harpy',
  'Bald Eagle': 'baldEagle',
  'Penguin': 'penguin',
  'Ostrich': 'ostrich',
  'Cassowary': 'cassowary',
  'Emu': 'emu',
  'Duke Blakiston': 'dukeBlakiston',
  'Wren': 'wren',
  'Fairywren': 'fairywren',
  'Fairy-wren': 'fairywren',
  'Firecrest': 'firecrest',
  'Wagtail': 'wagtail',
  'Galah': 'galah',
  'Blue Jay': 'bluejay',
  'Bluejay': 'bluejay',
  'Cardinal': 'cardinal',
  'Bush Turkey': 'bushturkey',
  'Bushturkey': 'bushturkey',
  'Vulture': 'vulture',
  'Barn Owl': 'barnowl',
  'Barnowl': 'barnowl',
  'Bustard': 'bustard',
  'Golden Eagle': 'goldeneagle',
  'Goldeneagle': 'goldeneagle',
  'Pelican': 'pelican',
  'Marabou Stork': 'marabou',
  'Marabou': 'marabou',
};
function birdKey(name) {
  if (!name) return '';
  const trimmed = name.trim();
  return BIRD_NAME_TO_KEY[trimmed] || trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const CLASS_KEY = (s) => (s || '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Formula parser: "2 hits of Base 2 + 40% ATK each", "Base 3 + 55% ATK",
//                  "Base 6 + 100% ATK + 5% Lifesteal", "No direct damage"
// ---------------------------------------------------------------------------
function parseDamageFormula(text) {
  const out = {
    hits: 1,
    baseFlat: 0,
    scaleStat: 'ATK',
    scalePct: 0,
    secondaryScaleStat: null,
    secondaryScalePct: 0,
    lifestealPct: 0,
    noDamage: false,
  };
  if (!text) { out.noDamage = true; return out; }
  const s = String(text).trim();
  if (/no\s+direct\s+damage|none/i.test(s)) { out.noDamage = true; return out; }
  const hitsM = s.match(/(\d+)\s*hits?\s+of\s+/i);
  if (hitsM) out.hits = parseInt(hitsM[1], 10);
  const baseM = s.match(/Base\s+(\d+(?:\.\d+)?)/i);
  if (baseM) out.baseFlat = Number(baseM[1]);
  const statMatches = [...s.matchAll(/(\d+(?:\.\d+)?)\s*%\s*(ATK|MATK|SPD|DEF|MDEF|ACC|DODGE)\b/gi)];
  if (statMatches.length >= 1) {
    out.scaleStat = String(statMatches[0][2]).toUpperCase();
    out.scalePct = Number(statMatches[0][1]);
  }
  if (statMatches.length >= 2) {
    out.secondaryScaleStat = String(statMatches[1][2]).toUpperCase();
    out.secondaryScalePct = Number(statMatches[1][1]);
  }
  const hpM = s.match(/(\d+(?:\.\d+)?)\s*%\s*(?:Max\s*Health|Lifesteal)/i);
  if (hpM) out.lifestealPct = Number(hpM[1]);
  return out;
}

function parsePierce(typeText, pctText) {
  const out = { def: 0, mdef: 0 };
  const t = (typeText || '').trim();
  if (!t || t.toLowerCase() === 'none') return out;
  const pct = asNum(pctText);
  // Skill Trees DEF/MDEF Ignore column may include the percent inline (e.g. "5% DEF ignore", "10% MDEF ignore")
  const inlineM = t.match(/(\d+(?:\.\d+)?)\s*%\s*(MDEF|DEF)/i);
  if (inlineM) {
    const p = Number(inlineM[1]);
    if (/MDEF/i.test(inlineM[2])) out.mdef = p;
    else out.def = p;
    return out;
  }
  // Fall back to the separate Type + % columns (Shop Ability Pool layout)
  if (pct > 0) {
    if (/mdef|magic/i.test(t)) out.mdef = pct;
    else if (/def\s*ignore|^\s*def\s*$/i.test(t) || /\bDEF\b/.test(t)) out.def = pct;
  }
  return out;
}

// Tier remap: Shop xlsx uses SHOP_G## for BOTH Green and Gold tiers. Disambiguate.
function remapShopId(id, tier) {
  if (!id || !tier) return id;
  if (/^SHOP_G\d/.test(id)) {
    if (/^green$/i.test(tier)) return id.replace(/^SHOP_G/, 'SHOP_GN');
    if (/^gold$/i.test(tier)) return id.replace(/^SHOP_G/, 'SHOP_GD');
  }
  return id;
}

function parseTarget(s) {
  const t = (s || '').trim().toLowerCase();
  if (t === 'self') return 'self';
  if (t === 'self and enemy' || t === 'self & enemy') return 'self_and_enemy';
  return 'enemy';
}

function parseAilment(name) {
  const n = (name || '').trim();
  if (!n || /^none$/i.test(n)) return null;
  // Multi-option: "Chilled / Weaken / Delayed" → store as array
  if (n.includes('/')) {
    return n.split('/').map((x) => normaliseAilmentId(x)).filter(Boolean);
  }
  return normaliseAilmentId(n);
}
function normaliseAilmentId(s) {
  const k = s.trim().toLowerCase();
  if (!k) return null;
  if (/^bleed/.test(k)) return 'bleed';
  if (/^burning|^burn/.test(k)) return 'burning';
  if (/^chilled|^chill/.test(k)) return 'chilled';
  if (/^delayed/.test(k)) return 'delayed';
  if (/^paralys|^paraly[sz]ed/.test(k)) return 'paralyzed';
  if (/^poison/.test(k)) return 'poison';
  if (/^weaken/.test(k)) return 'weaken';
  return null;
}

// Rider parser — emit a small structured list driven by tags + numeric regexes
function parseRiderWhen(text) {
  if (/after\s+attack/i.test(text)) return 'onHit';
  if (/if\s+(?:this\s+)?hits?|if\s+at\s+least\s+\d+\s+hits?\s+land/i.test(text)) return 'onHit';
  if (/if\s+weaken\s+applies?|when\s+weaken\s+applies?|target\s+is\s+weakened/i.test(text)) return 'onAilment:weaken';
  if (/if\s+bleed\s+applies?|when\s+bleed\s+applies?|if\s+bleeding\s+applies?|enemy\s+is\s+already\s+bleeding/i.test(text)) return 'onAilment:bleed';
  if (/if\s+chilled?\s+applies?|when\s+chilled?\s+applies?|target\s+is\s+chilled?/i.test(text)) return 'onAilment:chilled';
  if (/if\s+burning\s+applies?|when\s+burning\s+applies?/i.test(text)) return 'onAilment:burning';
  if (/if\s+poison\s+applies?|when\s+poison\s+applies?/i.test(text)) return 'onAilment:poison';
  if (/if\s+paralys/i.test(text)) return 'onAilment:paralyzed';
  if (/if\s+delayed\s+applies?/i.test(text)) return 'onAilment:delayed';
  return null;
}

function parseRiders(riderText, codeTags) {
  const riders = [];
  const text = (riderText || '').trim();
  if (!text || /^none$/i.test(text)) return riders;
  const when = parseRiderWhen(text);
  const addSelf = (kind, n, extra = {}) => riders.push({ kind, value: n, scope: 'self', duration: 'untilNextTurn', when, ...extra });
  const addEnemy = (kind, n, extra = {}) => riders.push({ kind, value: n, scope: 'enemy', duration: 'untilNextTurn', when: when || 'onHit', ...extra });
  let m;

  // Self gain riders
  for (const gm of text.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) addSelf('gainDodge', Number(gm[1]));
  for (const gm of text.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Speed/gi)) addSelf('gainSpeed', Number(gm[1]));
  for (const gm of text.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/gi)) addSelf('gainCritChance', Number(gm[1]));
  for (const gm of text.matchAll(/\+?\s*(\d+(?:\.\d+)?)\s*%\s*Crit\s*Damage/gi)) addSelf('gainCritDamage', Number(gm[1]));
  for (const gm of text.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/gi)) addSelf('gainMatk', Number(gm[1]));
  for (const gm of text.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Magic\s*Defen[cs]e/gi)) addSelf('gainMdef', Number(gm[1]));
  for (const gm of text.matchAll(/(?:gain\s+\+?|\bor\s+\+?\s*)(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e(?!\s*and)/gi)) {
    if (!/Magic\s*Defen/i.test(gm[0])) addSelf('gainDef', Number(gm[1]));
  }
  for (const gm of text.matchAll(/gain\s+\+?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Physical\s*)?Attack(?!\s*Damage)/gi)) {
    if (!/Magic\s*Attack/i.test(gm[0])) addSelf('gainAtk', Number(gm[1]));
  }

  // Enemy debuff riders
  for (const gm of text.matchAll(/(?:enemy\s+loses|reduce\s+enemy\s+dodge\s+by)\s+(\d+(?:\.\d+)?)\s*%\s*Dodge/gi)) addEnemy('reduceEnemyDodge', Number(gm[1]));
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Attack(?!\s*and)/gi)) {
    if (!/Magic\s*Attack/i.test(gm[0])) addEnemy('reduceEnemyAtk', Number(gm[1]));
  }
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/gi)) addEnemy('reduceEnemyMatk', Number(gm[1]));
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Speed/gi)) addEnemy('reduceEnemySpd', Number(gm[1]));
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Crit\s*Chance/gi)) addEnemy('reduceEnemyCrit', Number(gm[1]));
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Defen[cs]e/gi)) addEnemy('reduceEnemyMdef', Number(gm[1]));
  for (const gm of text.matchAll(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Defen[cs]e(?!\s*and)/gi)) {
    if (!/Magic\s*Defen/i.test(gm[0])) addEnemy('reduceEnemyDef', Number(gm[1]));
  }
  // Combined "Attack and Magic Attack"
  if ((m = text.match(/enemy\s+loses\s+(\d+(?:\.\d+)?)\s*%\s*Attack\s+and\s+(\d+(?:\.\d+)?)\s*%\s*Magic\s*Attack/i))) {
    addEnemy('reduceEnemyAtk', Number(m[1]));
    addEnemy('reduceEnemyMatk', Number(m[2]));
  }

  // Heal % max HP
  if ((m = text.match(/heal\s+(\d+(?:\.\d+)?)\s*%\s*Max\s*Health/i))) {
    riders.push({ kind: 'healMaxHpPct', value: Number(m[1]), scope: 'self', when });
  }

  if (/\bguard\b/i.test(text) && /defence|defense|gain/i.test(text)) addSelf('gainGuard', 1);
  if ((m = text.match(/(\d+(?:\.\d+)?)\s*%\s*damage\s*reduction/i))) {
    addSelf('gainGuarded', Number(m[1]));
  } else if (/brace|damage reduction/i.test(text)) {
    addSelf('gainGuarded', 0);
  }
  if (/counter\s*chance|small counter/i.test(text)) addSelf('gainCounter', 1);
  if (/taunt/i.test(text)) addSelf('gainTaunt', 1);

  // Resource
  if (/refund\s+1\s*(?:AP|EN)\s*once\s*per\s*turn/i.test(text)) riders.push({ kind: 'refundApOnCrit', value: 1, oncePerTurn: true });
  if ((m = text.match(/\+?\s*(\d+)\s*(?:AP|EN)\s*recovery\s*(?:next\s*turn|on\s*next\s*turn)/i))) riders.push({ kind: 'gainApNextTurn', value: Number(m[1]) });

  // Conditional damage
  if (/against\s+bleeding|vs\s+bleeding|enemy\s+is\s+bleeding|bleeding\s+enemies?/i.test(text)) {
    const pm = text.match(/\+?\s*(\d+(?:\.\d+)?)\s*%/);
    if (pm) riders.push({ kind: 'bonusVsAilment', ailment: 'bleed', value: Number(pm[1]) });
    else riders.push({ kind: 'bonusVsAilment', ailment: 'bleed', value: 0 });
  }
  if (/low\s*HP|below\s+\d+%\s+Health|low-Health/i.test(text)) {
    const pm = text.match(/below\s+(\d+(?:\.\d+)?)\s*%/i);
    riders.push({ kind: 'bonusVsLowHp', threshold: pm ? Number(pm[1]) / 100 : 0.35, value: 0 });
  }

  // Tag-driven fallthroughs
  const tags = (codeTags || '').split(/[;,]/).map((t) => t.trim()).filter(Boolean);
  for (const tg of tags) {
    if (/pierce-upgrade/i.test(tg)) riders.push({ kind: 'tagFlag', tag: 'pierceUpgrade' });
    if (/utility-rider/i.test(tg)) riders.push({ kind: 'tagFlag', tag: 'utilityRider' });
    if (/finisher/i.test(tg)) riders.push({ kind: 'tagFlag', tag: 'finisher' });
    if (/opener/i.test(tg)) riders.push({ kind: 'tagFlag', tag: 'opener' });
    if (/multi-hit/i.test(tg)) riders.push({ kind: 'tagFlag', tag: 'multiHit' });
  }
  if (!riders.length && text) {
    riders.push({ kind: 'raw', text });
  }
  return riders;
}

// ---------------------------------------------------------------------------
// Build classes data
// ---------------------------------------------------------------------------
function buildClasses(perksSheets) {
  const rows = perksSheets['Class Rules'] || [];
  if (!rows.length) throw new Error('Missing "Class Rules" sheet');
  const header = headerToIndexMap(rows[0]);
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = CLASS_KEY(get(r, header, 'Class'));
    if (!id) continue;
    out[id] = {
      id,
      name: get(r, header, 'Class'),
      coreIdentity: get(r, header, 'Core Identity'),
      damageStyle: get(r, header, 'Damage Style'),
      mainAilment: get(r, header, 'Main Ailment'),
      defensiveAngle: get(r, header, 'Defensive Angle'),
      statHooks: get(r, header, 'Best Stat Hooks'),
      balanceCaution: get(r, header, 'Balance Caution'),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build bird kits from "Level 1 Kits" + assign class
// ---------------------------------------------------------------------------
function buildBirdKits(perksSheets) {
  const rows = perksSheets['Level 1 Kits'] || [];
  if (!rows.length) throw new Error('Missing "Level 1 Kits" sheet');
  const header = headerToIndexMap(rows[0]);
  const kits = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const birdName = get(r, header, 'Bird');
    if (!birdName) continue;
    const key = birdKey(birdName);
    kits[key] = {
      birdKey: key,
      birdName,
      class: CLASS_KEY(get(r, header, 'Class')),
      gameplayIdentity: get(r, header, 'Gameplay Identity'),
      starters: [
        {
          slot: 0,
          name: get(r, header, 'Skill 1'),
          type: get(r, header, 'Type 1'),
          apCost: asNum(get(r, header, 'Cost 1')),
          formula: get(r, header, 'Formula 1'),
          pierce: get(r, header, 'Ignore 1'),
          ailment: get(r, header, 'Ailment 1'),
          ailmentChance: asPct(get(r, header, 'Chance 1')),
          utility: get(r, header, 'Utility 1'),
          target: get(r, header, 'Target 1'),
        },
        {
          slot: 1,
          name: get(r, header, 'Skill 2'),
          type: get(r, header, 'Type 2'),
          apCost: asNum(get(r, header, 'Cost 2')),
          formula: get(r, header, 'Formula 2'),
          pierce: get(r, header, 'Ignore 2'),
          ailment: get(r, header, 'Ailment 2'),
          ailmentChance: asPct(get(r, header, 'Chance 2')),
          utility: get(r, header, 'Utility 2'),
          target: get(r, header, 'Target 2'),
        },
      ],
    };
  }
  return kits;
}

// ---------------------------------------------------------------------------
// Build families: per-bird (88) from perks workbook + shop (150) from shop workbook
// ---------------------------------------------------------------------------
function buildFamilies(perksSheets, shopSheets) {
  const out = {};
  // Bird families
  const fams = perksSheets['Ability Families'] || [];
  const fh = headerToIndexMap(fams[0]);
  for (let i = 1; i < fams.length; i++) {
    const r = fams[i];
    const id = get(r, fh, 'Family ID');
    if (!id) continue;
    const birdName = get(r, fh, 'Bird');
    out[id] = {
      id,
      kind: 'starter',
      birdKey: birdKey(birdName),
      birdName,
      class: CLASS_KEY(get(r, fh, 'Class')),
      starterSlot: asNum(get(r, fh, 'Starter Slot')) - 1, // 0-indexed
      name: get(r, fh, 'Family Name'),
      type: get(r, fh, 'Ability Type'),
      damageStyle: get(r, fh, 'Damage Style'),
      scaleStat: get(r, fh, 'Scaling Stat'),
      defaultAilment: get(r, fh, 'Default Ailment'),
      inspiration: get(r, fh, 'Real-Life Inspiration'),
      role: get(r, fh, 'Build Role'),
      notes: get(r, fh, 'Notes'),
      maxTier: 3,
    };
  }
  // Shop families — derived from Shop Ability Pool's BASE rows
  const pool = shopSheets['Shop Ability Pool'] || [];
  const ph = headerToIndexMap(pool[0]);
  for (let i = 1; i < pool.length; i++) {
    const r = pool[i];
    const rawFamId = get(r, ph, 'Family ID');
    const tier = get(r, ph, 'Purchase Tier');
    const famId = remapShopId(rawFamId, tier);
    if (!famId || out[famId]) continue;
    out[famId] = {
      id: famId,
      kind: 'shop',
      birdKey: null,
      birdName: 'All birds',
      class: '',
      starterSlot: null,
      name: get(r, ph, 'Ability Name'),
      type: get(r, ph, 'Ability Category'),
      damageStyle: get(r, ph, 'Style'),
      scaleStat: get(r, ph, 'Scaling Stat'),
      defaultAilment: get(r, ph, 'Base Ailment'),
      inspiration: '',
      role: get(r, ph, 'Designed For'),
      notes: get(r, ph, 'Balance Notes'),
      maxTier: 3,
      tier,
      rarityWeight: asNum(get(r, ph, 'Rarity Weight')),
      shopUnlock: get(r, ph, 'Shop Unlock'),
      shopCost: asNum(get(r, ph, 'Shop Cost')),
      tags: get(r, ph, 'Tags'),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Build skill trees: 880 (bird) + 1500 (shop) ability rows
// ---------------------------------------------------------------------------
function pickShortDescription(r, h) {
  const candidates = [
    'Short Description',
    'Short Desc',
    'Ability Short Description',
    'UI Short Description',
    'Tooltip Short Description',
    'Description Short',
  ];
  for (const name of candidates) {
    const val = get(r, h, name);
    if (val) return normalizeShortDesc(val);
  }
  return '';
}

function normalizeShortDesc(text) {
  return String(text || '')
    .replace(/\bAP\/EN\b/gi, 'EN')
    .replace(/(\d+(?:\.\d+)?)\s*%\s*Max\s*Health/gi, '$1% Lifesteal')
    .replace(/\bMax\s*Health\s*%/gi, 'Lifesteal %');
}

function buildSkillTrees(perksSheets, shopSheets) {
  const out = {};

  function rowToEntry(r, h, source) {
    const rawId = get(r, h, 'Ability ID');
    if (!rawId) return null;
    const rawFamilyId = get(r, h, 'Family ID');
    const tier = get(r, h, 'Purchase Tier');
    const id = source === 'shop' ? remapShopId(rawId, tier) : rawId;
    const familyId = source === 'shop' ? remapShopId(rawFamilyId, tier) : rawFamilyId;
    const branch = (get(r, h, 'Branch') || 'Base').toLowerCase();
    const level = asNum(get(r, h, 'Unlock Level'));
    const formula = parseDamageFormula(get(r, h, 'Damage Formula') || get(r, h, 'Formula') || '');
    const pierce = parsePierce(get(r, h, 'DEF/MDEF Ignore') || get(r, h, 'Pierce Type') || '', get(r, h, 'Pierce %') || '');
    const target = parseTarget(get(r, h, 'Targeting') || get(r, h, 'Target') || '');
    const ailment = parseAilment(get(r, h, 'Ailment') || get(r, h, 'Base Ailment') || '');
    const ailmentChance = asPct(get(r, h, 'Ailment Chance') || get(r, h, 'Ailment Chance %') || '');
    const cooldown = asNum(get(r, h, 'Cooldown'));
    const apCost = asNum(get(r, h, 'AP/EN Cost') || get(r, h, 'AP Cost') || '');
    const riderText = get(r, h, 'Buff / Debuff / Utility') || get(r, h, 'Utility Rider') || '';
    const codeTags = get(r, h, 'Code Tags') || get(r, h, 'Tags') || '';
    const replaces = get(r, h, 'Replaces / Upgrades') || get(r, h, 'Prerequisite') || '';
    const name = get(r, h, 'Ability Name') || id;
    const shortDesc = pickShortDescription(r, h);
    const category = (get(r, h, 'Ability Category') || 'Physical').toLowerCase();
    const hits = formula.hits;
    return {
      id,
      familyId,
      source,
      bird: get(r, h, 'Bird') || '',
      birdKey: birdKey(get(r, h, 'Bird') || ''),
      class: CLASS_KEY(get(r, h, 'Class') || ''),
      starterSlot: asNum(get(r, h, 'Starter Slot') || '0') - 1,
      level,
      branch,
      name,
      category,
      apCost: apCost || 1,
      target,
      hits,
      baseFlat: formula.baseFlat,
      scaleStat: formula.scaleStat,
      scalePct: formula.scalePct,
      secondaryScaleStat: formula.secondaryScaleStat,
      secondaryScalePct: formula.secondaryScalePct,
      lifestealPct: formula.lifestealPct,
      hpScalePct: 0,
      noDamage: formula.noDamage,
      pierceDef: pierce.def,
      pierceMdef: pierce.mdef,
      ailment,
      ailmentChance,
      cooldown,
      riderText,
      riders: parseRiders(riderText, codeTags),
      tags: codeTags.split(/[;,]/).map((t) => t.trim()).filter(Boolean),
      replaces,
      shortDesc,
      designNote: get(r, h, 'Design Note') || get(r, h, 'Balance Notes') || '',
      tier: get(r, h, 'Purchase Tier') || '',
    };
  }

  const bird = perksSheets['Skill Trees'] || [];
  if (bird.length) {
    const h = headerToIndexMap(bird[0]);
    for (let i = 1; i < bird.length; i++) {
      const e = rowToEntry(bird[i], h, 'bird');
      if (e) out[e.id] = e;
    }
  }
  const shop = shopSheets['Ability Upgrade Trees'] || [];
  if (shop.length) {
    const h = headerToIndexMap(shop[0]);
    for (let i = 1; i < shop.length; i++) {
      const e = rowToEntry(shop[i], h, 'shop');
      if (e) out[e.id] = e;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bird passives + endless upgrades + generic endless
// ---------------------------------------------------------------------------
function buildBirdPassives(perksSheets) {
  const rows = perksSheets['Passive Perks'] || [];
  if (!rows.length) throw new Error('Missing Passive Perks sheet');
  const h = headerToIndexMap(rows[0]);
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = get(r, h, 'Passive ID');
    if (!id) continue;
    const birdName = get(r, h, 'Bird');
    out[id] = {
      id,
      birdKey: birdKey(birdName),
      birdName,
      class: CLASS_KEY(get(r, h, 'Class')),
      name: get(r, h, 'Passive Name'),
      type: get(r, h, 'Passive Type'),
      target: parseTarget(get(r, h, 'Target')),
      trigger: get(r, h, 'Trigger / Condition'),
      effect: get(r, h, 'Base Passive Effect'),
      numerical: get(r, h, 'Numerical Values'),
      synergy: get(r, h, 'Ability / Playstyle Synergy'),
      inspiration: get(r, h, 'Real-Life Inspiration'),
      balanceNote: get(r, h, 'Balance Note'),
      tags: (get(r, h, 'Tags') || '').split(/[,;]/).map((t) => t.trim()).filter(Boolean),
    };
  }
  return out;
}

function buildEndlessPassives(perksSheets) {
  const rows = perksSheets['Endless Passive Upgrades'] || [];
  if (!rows.length) return {};
  const h = headerToIndexMap(rows[0]);
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = get(r, h, 'Upgrade ID');
    if (!id) continue;
    out[id] = {
      id,
      birdKey: birdKey(get(r, h, 'Bird')),
      class: CLASS_KEY(get(r, h, 'Class')),
      basePassive: get(r, h, 'Base Passive'),
      name: get(r, h, 'Endless Upgrade Name'),
      rank: get(r, h, 'Endless Rank'),
      unlock: get(r, h, 'Suggested Unlock'),
      target: parseTarget(get(r, h, 'Target')),
      effect: get(r, h, 'Upgrade Effect'),
      numerical: get(r, h, 'Numerical Values'),
      pierceAllowed: /yes/i.test(get(r, h, 'Armour Ignore Allowed?')),
      stacking: get(r, h, 'Stacking / Cap'),
      balanceNote: get(r, h, 'Balance Note'),
      tags: (get(r, h, 'Tags') || '').split(/[,;]/).map((t) => t.trim()).filter(Boolean),
    };
  }
  return out;
}

function buildGenericEndless(perksSheets) {
  const rows = perksSheets['Generic Endless Upgrades'] || [];
  if (!rows.length) return {};
  const h = headerToIndexMap(rows[0]);
  const out = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = get(r, h, 'Upgrade ID');
    if (!id) continue;
    out[id] = {
      id,
      class: CLASS_KEY(get(r, h, 'Class')),
      name: get(r, h, 'Upgrade Name'),
      rank: get(r, h, 'Endless Rank'),
      target: parseTarget(get(r, h, 'Target')),
      effect: get(r, h, 'Upgrade Effect'),
      numerical: get(r, h, 'Numerical Values'),
      pierceAllowed: /yes/i.test(get(r, h, 'Armour Ignore Allowed?')),
      stacking: get(r, h, 'Stacking / Cap'),
      useCase: get(r, h, 'Use Case'),
      balanceNote: get(r, h, 'Balance Note'),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Shop pool — base abilities with their economy fields
// ---------------------------------------------------------------------------
const SHOP_COST_BY_EN = { 1: 50, 2: 100, 3: 150 };

function shopCostFromAp(apCost) {
  const en = Math.max(1, Math.round(Number(apCost) || 1));
  return SHOP_COST_BY_EN[en] || SHOP_COST_BY_EN[3];
}

function buildShopPool(shopSheets) {
  const rows = shopSheets['Shop Ability Pool'] || [];
  if (!rows.length) throw new Error('Missing Shop Ability Pool sheet');
  const h = headerToIndexMap(rows[0]);
  const TIER_RULES = {};
  const trRows = shopSheets['Tier AP Rules'] || [];
  if (trRows.length) {
    const th = headerToIndexMap(trRows[0]);
    for (let i = 1; i < trRows.length; i++) {
      const r = trRows[i];
      const tier = get(r, th, 'Tier');
      if (!tier) continue;
      TIER_RULES[tier] = {
        tier,
        rank: asNum(get(r, th, 'Rank')),
        rarityWeight: asNum(get(r, th, 'Rarity Weight')),
        unlockStage: get(r, th, 'Unlock Stage'),
        unlockStageNum: asNum(get(r, th, 'Unlock Stage')),
        expectedAp: get(r, th, 'Expected AP'),
        baseDamageGuidance: get(r, th, 'Expected Base Damage'),
        ailmentGuidance: get(r, th, 'Ailment Guidance'),
        pierceGuidance: get(r, th, 'Pierce Guidance'),
      };
    }
  }
  const entries = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const tier = get(r, h, 'Purchase Tier');
    const id = remapShopId(get(r, h, 'Ability ID'), tier);
    const famId = remapShopId(get(r, h, 'Family ID'), tier);
    if (!id || !famId) continue;
    const apCost = asNum(get(r, h, 'AP Cost') || get(r, h, 'AP/EN Cost') || '');
    entries[famId] = {
      familyId: famId,
      baseAbilityId: id,
      rawFamilyId: get(r, h, 'Family ID'),
      name: get(r, h, 'Ability Name'),
      tier: get(r, h, 'Purchase Tier'),
      rarityWeight: asNum(get(r, h, 'Rarity Weight')),
      shopUnlock: get(r, h, 'Shop Unlock'),
      shopUnlockStage: asNum(get(r, h, 'Shop Unlock')),
      apCost: apCost || 1,
      shopCost: shopCostFromAp(apCost),
      category: get(r, h, 'Ability Category'),
      style: get(r, h, 'Style'),
      designedFor: get(r, h, 'Designed For'),
      eligibleBirds: get(r, h, 'Eligible Birds'),
      upgradeSummary: get(r, h, 'Upgrade Family Summary'),
      tags: (get(r, h, 'Tags') || '').split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      balanceNotes: get(r, h, 'Balance Notes'),
      shortDesc: pickShortDescription(r, h),
      familyDesc: get(r, h, 'Family Description') || '',
    };
  }
  return { tierRules: TIER_RULES, entries };
}

// ---------------------------------------------------------------------------
// Emit data files
// ---------------------------------------------------------------------------
function ensureDir(p) { mkdirSync(p, { recursive: true }); }
function emitFile(name, jsBody) {
  const target = path.join(OUTPUT_DIR, name);
  writeFileSync(target, jsBody, 'utf8');
  return statSync(target).size;
}

function jsHeader(filename, notes) {
  return `/* Avian Ascent — combat data pack: ${filename}
 * GENERATED by scripts/import-combat-content.mjs from the authoring spreadsheets.
 * Do not edit by hand. Re-run the importer when the source xlsx files change.
${notes ? ' * ' + notes + '\n' : ''} */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);
`;
}
function jsFooter(exportName, payload) {
  return `  Avian.data.combatPack.${exportName} = Object.freeze(${stringifyDeepFrozen(payload)});\n})();\n`;
}

function stringifyDeepFrozen(obj) {
  // Compact-ish JSON with sorted top-level keys for stable diffs.
  if (obj == null) return 'null';
  if (Array.isArray(obj)) {
    return '[' + obj.map((x) => stringifyDeepFrozen(x)).join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stringifyDeepFrozen(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function mergeAbilitySheets(perksSheets, abilitySheets) {
  const merged = { ...perksSheets };
  for (const name of ABILITY_SHEET_NAMES) {
    if (abilitySheets[name]?.length) merged[name] = abilitySheets[name];
  }
  return merged;
}

function main() {
  if (process.argv.includes('--inspect-headers')) {
    if (process.argv.includes('--shop') && existsSync(SHOP_XLSX)) {
      const shopSheets = readWorkbook(SHOP_XLSX);
      for (const name of ['Shop Ability Pool', 'Ability Upgrade Trees', 'Tier AP Rules']) {
        const rows = shopSheets[name] || [];
        console.log('===', name, 'rows=', rows.length, '===');
        if (!rows.length) continue;
        console.log(rows[0].map((h, i) => `${i + 1}:${h}`).join('\n'));
      }
      process.exit(0);
    }
    const abilitySheets = existsSync(ABILITY_XLSX) ? readWorkbook(ABILITY_XLSX) : {};
    for (const name of ABILITY_SHEET_NAMES) {
      const rows = abilitySheets[name] || [];
      console.log('===', name, 'rows=', rows.length, '===');
      if (!rows.length) continue;
      console.log(rows[0].map((h, i) => `${i + 1}:${h}`).join('\n'));
    }
    process.exit(0);
  }
  for (const p of [SHOP_XLSX, PERKS_XLSX]) {
    if (!existsSync(p)) {
      console.error('[importer] missing input xlsx:', p);
      process.exit(1);
    }
  }
  console.log('[importer] reading shop xlsx :', SHOP_XLSX);
  const shopSheets = readWorkbook(SHOP_XLSX);
  console.log('[importer] reading perks xlsx:', PERKS_XLSX);
  let perksSheets = readWorkbook(PERKS_XLSX);
  if (existsSync(ABILITY_XLSX)) {
    console.log('[importer] reading ability xlsx:', ABILITY_XLSX);
    const abilitySheets = readWorkbook(ABILITY_XLSX);
    perksSheets = mergeAbilitySheets(perksSheets, abilitySheets);
  } else {
    console.warn('[importer] ability xlsx not found — using perks workbook for ability sheets:', ABILITY_XLSX);
  }

  ensureDir(OUTPUT_DIR);

  const classes = buildClasses(perksSheets);
  const birdKits = buildBirdKits(perksSheets);
  const families = buildFamilies(perksSheets, shopSheets);
  const skillTrees = buildSkillTrees(perksSheets, shopSheets);
  const birdPassives = buildBirdPassives(perksSheets);
  const endlessPassives = buildEndlessPassives(perksSheets);
  const genericEndless = buildGenericEndless(perksSheets);
  const shopPool = buildShopPool(shopSheets);

  // Validate
  const reports = [
    ['classes', Object.keys(classes).length, 6],
    ['birdKits', Object.keys(birdKits).length, 44],
    ['families', Object.keys(families).length, 238],
    ['skillTrees', Object.keys(skillTrees).length, 2380],
    ['birdPassives', Object.keys(birdPassives).length, 44],
    ['endlessPassives', Object.keys(endlessPassives).length, 176],
    ['genericEndless', Object.keys(genericEndless).length, 24],
    ['shopPoolEntries', Object.keys(shopPool.entries).length, 150],
  ];
  let warn = 0;
  for (const [name, got, expected] of reports) {
    const tag = got === expected ? 'ok ' : 'WARN';
    if (got !== expected) warn++;
    console.log(`[importer] ${tag} ${name.padEnd(16)} ${String(got).padStart(5)} (expected ${expected})`);
  }
  if (process.argv.includes('--verify')) {
    process.exit(warn > 0 ? 2 : 0);
  }

  const written = [];
  written.push(emitFile('classes.js',
    jsHeader('classes.js', '6 classes: identity, damage style, main ailment, balance notes.') +
    jsFooter('classes', classes)));
  written.push(emitFile('birds-kits.js',
    jsHeader('birds-kits.js', '44 birds × class + 2 starter skill specs (raw rows; resolved into ability templates at runtime).') +
    jsFooter('birdKits', birdKits)));
  written.push(emitFile('families.js',
    jsHeader('families.js', '88 bird families + 150 shop families with metadata (id, kind, class, scaleStat, default ailment, role, tier/economy for shop).') +
    jsFooter('families', families)));
  written.push(emitFile('skill-trees.js',
    jsHeader('skill-trees.js', '2,380 ability rows (Base + L3/L6/L9 × Power/Ailment/Utility) normalised for the dispatcher.') +
    jsFooter('skillTrees', skillTrees)));
  written.push(emitFile('bird-passives.js',
    jsHeader('bird-passives.js', '44 fixed normal-mode bird passive perks (one per bird).') +
    jsFooter('birdPassives', birdPassives)));
  written.push(emitFile('endless-passives.js',
    jsHeader('endless-passives.js', '176 bird-specific Endless passive upgrades + 24 generic class-wide Endless upgrades.') +
    jsFooter('endlessPassives', { bird: endlessPassives, generic: genericEndless })));
  written.push(emitFile('shop-pool.js',
    jsHeader('shop-pool.js', '150 shop-purchasable ability families with rarity weights, costs, unlock stages, plus Tier AP rules table.') +
    jsFooter('shopPool', shopPool)));

  const totalBytes = written.reduce((a, b) => a + b, 0);
  console.log(`[importer] emitted 7 files into ${OUTPUT_DIR} (${(totalBytes / 1024).toFixed(1)} KiB)`);

  if (warn > 0) {
    console.warn(`[importer] ${warn} row-count warnings — review source spreadsheets if unexpected.`);
  }
}

main();
