#!/usr/bin/env node
/*
 * Avian Ascent — Master Bird List importer
 * Reads Master Bird List xlsx and emits birds, enemy roster, classes, passives.
 *
 *   node scripts/import-master-bird-content.mjs [--verify] [--inspect-headers]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const NEW_SHEETS = 'c:\\Users\\JaK_d\\Desktop\\Avian Ascent\\New Sheets';
const MASTER_XLSX = process.env.AA_MASTER_BIRD_XLSX
  || path.join(NEW_SHEETS, 'Master Bird List - New Stats - Boss Tiers - Titles - Passives and Perks - Gatcha Tiers.xlsx');

const OUT_BIRDS = path.join(ROOT, 'js', 'data', 'birds.js');
const OUT_ROSTER = path.join(ROOT, 'js', 'data', 'enemy-roster.js');
const OUT_TITLES = path.join(ROOT, 'js', 'data', 'enemy-title-pools.js');
const OUT_SIZE = path.join(ROOT, 'js', 'data', 'size-chart.js');
const OUT_CLASSES = path.join(ROOT, 'js', 'data', 'combat-pack', 'classes.js');
const OUT_PASSIVES = path.join(ROOT, 'js', 'data', 'combat-pack', 'bird-passives.js');

// Preserve UI metadata from prior birds.js (not in spreadsheet)
const BIRD_PRESERVE = {
  sparrow: { tagline: 'Swift as wind, strikes like needles.', color: '#6a8ae8' },
  hummingbird: { tagline: 'Blurred wings, needle beak. Zap & zip.', color: '#40e8c0', unlockRequires: 'unlock_hummingbird', unlockHint: 'Defeat Stage 10 with Sparrow.' },
  blackbird: { tagline: 'Songs that shatter minds. Eyes like embers.', color: '#9a6ae8' },
  macaw: { tagline: 'Every word is a weapon.', color: '#1a6aba' },
  peregrine: { tagline: 'Lock. Stoop. No survivors.', color: '#6a8ac8', unlockRequires: 'unlock_peregrine', unlockHint: 'Defeat Stage 20 with Hummingbird.' },
  snowyOwl: { tagline: 'The snow listens. Then it falls.', color: '#e8f0f8', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  kiwi: { tagline: 'Nocturnal probe. Beak pierces armor like butter.', color: '#a0784a', unlockRequires: 'unlock_kiwi', unlockHint: 'Defeat Stage 20 with Magpie.' },
  blackCockatoo: { tagline: 'Booming crest. Resonant voice and crushing notes.', color: '#2a1a3a', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  crow: { tagline: 'Clever. Coordinated. Unsettling.', color: '#c0c8d8' },
  kookaburra: { tagline: 'Bush trickster. Laughing pressure, feints, and sudden drops.', color: '#c8a060', unlockRequires: 'unlock_kookaburra', unlockHint: 'Defeat Stage 10 with Macaw.' },
  lyrebird: { tagline: 'The great deceiver. Master of all songs.', color: '#c8902a', unlockRequires: 'unlock_lyrebird', unlockHint: 'Defeat Stage 20 with Kookaburra.' },
  raven: { tagline: 'The field remembers. You only hurry the ending.', color: '#6030d0', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  magpie: { tagline: 'Flashy thief. Swoops in, steals the moment, and slips away.', color: '#2a2a2a', unlockRequires: 'unlock_magpie', unlockHint: 'Defeat Stage 10 with Robin.' },
  robin: { tagline: 'Bright hedge-songster. Quick notes, light strikes, and uplifting refrains.', color: '#d86a4c' },
  bowerbird: { tagline: 'Stage-maker. Builds the bower, lures the eye, and cashes the display.', color: '#4a6a9a', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  toucan: { tagline: 'Oversized bill, vivid pressure, odd reach.', color: '#60c840', unlockRequires: 'unlock_toucan', unlockHint: 'Enter: "Ahh Ahh Eee Eee Tookie Tookie"' },
  swan: { tagline: 'Regal bulwark. Grace, weight, and unbroken composure.', color: '#f0f4fc', unlockRequires: 'unlock_swan', unlockHint: 'Reach Endless Stage 30 with any Tank.' },
  flamingo: { tagline: 'Wading lines. Soft water, hard footing.', color: '#e8609a', unlockRequires: 'unlock_flamingo', unlockHint: 'Reach Endless Stage 30 with any Striker.' },
  secretary: { tagline: 'Stalking justice. The kick decides.', color: '#e0a060', unlockRequires: 'unlock_secretary', unlockHint: 'Defeat Stage 10 with Crow.' },
  albatross: { tagline: 'Vast ocean bruiser. Wide-wing blows and crushing returning sweeps.', color: '#9fb7c9', unlockRequires: 'unlock_albatross', unlockHint: 'Reach Endless Stage 50 with any bird.' },
  seagull: { tagline: 'Coastal pest. Harrying swoops, noisy cries, scavenger’s payoff.', color: '#b0c8d8', unlockRequires: 'unlock_seagull', unlockHint: 'Reach level 21 in Endless mode with any Trickster.' },
  goose: { tagline: 'Territorial bruiser. Honk, check, refuse to yield.', color: '#e8c96a' },
  shoebill: { tagline: 'Ancient. Patient. Inevitable.', color: '#5a7090', unlockRequires: 'unlock_shoebill', unlockHint: 'Defeat Stage 10 with Goose.' },
  harpy: { tagline: 'Warlord of the canopy. No mercy.', color: '#c84030', unlockRequires: 'unlock_harpy', unlockHint: 'Defeat Stage 20 with Hummingbird.', abilityPool: ['physical'] },
  baldEagle: { tagline: 'Unbreakable. Undying. Undefeated.', color: '#e8e4d8', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  penguin: { tagline: 'Ice-clad waddler. Magic slides off its blubber.', color: '#3a5878', unlockRequires: 'unlock_penguin', unlockHint: 'Reach Endless Stage 30 with any Tank.' },
  ostrich: { tagline: 'Flightless thunder. Charges build to earth-shaking fury.', color: '#b89060', unlockRequires: 'unlock_ostrich', unlockHint: 'Defeat Stage 20 with Shoebill.' },
  cassowary: { tagline: 'Jungle juggernaut. Bone-crushing kicks and armored hide.', color: '#3b4a56', unlockRequires: 'juvenileWin', unlockHint: 'Defeat Stage 20 on Normal mode to unlock.' },
  emu: { tagline: 'Flightless brute. Kicks and stomps with terrifying force.', color: '#7a6040', unlockRequires: 'unlock_emu', unlockHint: 'Reach Endless Stage 40 with any Tank.' },
  dukeBlakiston: { tagline: 'Lord of the court. Boss-tier ruler with unique command, control, and execution skills.', color: '#6f88c2', unlockRequires: 'unlock_duke_blakiston', unlockHint: "Enter code 'Blakiston' on the selection screen." },
  wren: { tagline: 'Tiny hedge striker. Fast feet, sharp pecks, no wasted motion.', color: '#6a9a6a', unlockRequires: 'unlock_wren', unlockHint: 'Coming soon.' },
  fairywren: { tagline: 'Brilliant songster. Small frame, bright notes, quick support.', color: '#4a7ae8', unlockRequires: 'unlock_fairywren', unlockHint: 'Coming soon.' },
  firecrest: { tagline: 'Flash of flame. Tiny striker built around speed and burning finishers.', color: '#e85a2a', unlockRequires: 'unlock_firecrest', unlockHint: 'Coming soon.' },
  wagtail: { tagline: 'Tail-flicking nuisance. Sharp feints, mocking calls, constant motion.', color: '#2a2a2a', unlockRequires: 'unlock_wagtail', unlockHint: 'Coming soon.' },
  galah: { tagline: 'Loud pink menace. Flashy disruption, misdirection, and staged payoffs.', color: '#e8a0c8', unlockRequires: 'unlock_galah', unlockHint: 'Coming soon.' },
  bluejay: { tagline: 'Territorial brawler. Harsh hits, loud pressure, and aggressive momentum.', color: '#3a5cb8', unlockRequires: 'unlock_bluejay', unlockHint: 'Coming soon.' },
  cardinal: { tagline: 'Crimson songbird. Strong clear notes and rallying support.', color: '#c02030', unlockRequires: 'unlock_cardinal', unlockHint: 'Coming soon.' },
  bushturkey: { tagline: 'Scrappy ground bruiser. Dirty hits, stubborn guard, and pressure.', color: '#5a5040', unlockRequires: 'unlock_bushturkey', unlockHint: 'Coming soon.' },
  vulture: { tagline: 'Grim scavenger bruiser. Heavy blows and lingering pressure.', color: '#6a5a50', unlockRequires: 'unlock_vulture', unlockHint: 'Coming soon.' },
  barnowl: { tagline: 'Silent dusk hunter. Clean set-up, precise dive, punishing finish.', color: '#c8b8a0', unlockRequires: 'unlock_barnowl', unlockHint: 'Coming soon.' },
  bustard: { tagline: 'Heavy plains bruiser. Wide body, crushing steps, relentless force.', color: '#8a7860', unlockRequires: 'unlock_bustard', unlockHint: 'Coming soon.' },
  goldeneagle: { tagline: 'Imperial hunter. High kill pressure and ruthless finishers.', color: '#c9a020', unlockRequires: 'unlock_goldeneagle', unlockHint: 'Coming soon.' },
  pelican: { tagline: 'Massive bill, massive body. Absorbs hits and refuses to yield.', color: '#a0b8c8', unlockRequires: 'unlock_pelican', unlockHint: 'Coming soon.' },
  marabou: { tagline: 'Corpse-field predator. Grim pressure and towering execution.', color: '#8a8a88', unlockRequires: 'unlock_marabou', unlockHint: 'Coming soon.' },
};

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
};

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

const SHEET_LAYOUT = {
  'Bird Stat Rebalance': { headerRow: 2, dataStart: 3 },
  'Passives & Perks': { headerRow: 2, dataStart: 3 },
  'Class Templates': { headerRow: 2, dataStart: 3 },
  'Size Chart': { headerRow: 2, dataStart: 3 },
  'Bird Trait Overrides': { headerRow: 2, dataStart: 3 },
  'Bird Enemy Title Pools': { headerRow: 2, dataStart: 4 },
  'Enemy Birds': { headerRow: 3, dataStart: 4 },
};

function sheetLayout(sheetName, rows, mustHave) {
  const layout = SHEET_LAYOUT[sheetName];
  if (layout) {
    const header = headerToIndexMap(rows[layout.headerRow] || []);
    return { header, dataStart: layout.dataStart };
  }
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const joined = row.join('|').toLowerCase();
    if (mustHave.every((k) => joined.includes(k.toLowerCase()))) return { header: headerToIndexMap(row), dataStart: i + 1 };
  }
  return { header: headerToIndexMap(rows[0] || []), dataStart: 1 };
}
function headerToIndexMap(headerRow) {
  const map = Object.create(null);
  headerRow.forEach((name, i) => { if (name) map[String(name).trim()] = i; });
  return map;
}
function get(row, header, name) {
  const i = header[name];
  if (i == null) return '';
  return (row[i] || '').toString().trim();
}
function getFuzzy(row, header, names) {
  for (const n of names) {
    const v = get(row, header, n);
    if (v) return v;
  }
  for (const key of Object.keys(header)) {
    for (const n of names) {
      if (key.toLowerCase().includes(n.toLowerCase())) return (row[header[key]] || '').toString().trim();
    }
  }
  return '';
}
function asNum(s) {
  const m = String(s || '').match(/-?\d+(?:\.\d+)?/);
  return m ? Math.round(Number(m[0])) : 0;
}
function birdKey(name) {
  if (!name) return '';
  const t = name.trim();
  return BIRD_NAME_TO_KEY[t] || t.replace(/[^a-zA-Z0-9]/g, '').replace(/^./, (c) => c.toLowerCase());
}
const KNOWN_CLASSES = new Set(['knight', 'rogue', 'mage', 'siren', 'inquisitor', 'bard']);
const LEGACY_CLASS_TO_NEW = {
  striker: 'rogue', singer: 'mage', predator: 'inquisitor', trickster: 'bard', tank: 'knight', bruiser: 'knight',
};
function classId(s) {
  const raw = String(s || 'rogue').trim().toLowerCase();
  const first = raw.split(/\s+/)[0];
  if (KNOWN_CLASSES.has(first)) return first;
  return LEGACY_CLASS_TO_NEW[first] || 'rogue';
}
function sizeId(s) {
  const x = String(s || 'medium').trim().toLowerCase();
  if (x === 'very large' || x === 'verylarge') return 'large';
  if (x === 'giant' || x === 'boss override' || x === 'bossoverride') return 'xl';
  if (x === 'tiny') return 'tiny';
  if (x === 'small') return 'small';
  if (x === 'medium') return 'medium';
  if (x === 'large') return 'large';
  return 'medium';
}
function aiStyleFromProfile(p) {
  const s = String(p || '').toLowerCase();
  if (/berserk|aggress|strike/.test(s)) return 'berserker';
  if (/cautious|patient|guard|defen/.test(s)) return 'cautious';
  if (/trick|feint|harass/.test(s)) return 'trickster';
  if (/predat|hunt|execute/.test(s)) return 'predator';
  return 'aggressive';
}
function slugId(prefix, name) {
  const base = String(name || 'passive').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase();
  return prefix + '-' + base.slice(0, 40);
}

function getFinal(row, header, statLabel) {
  const exact = get(row, header, 'Final ' + statLabel);
  if (exact !== '') return exact;
  return get(row, header, 'Final ' + statLabel.toUpperCase());
}
function getFinalNum(row, header, statLabel) {
  return asNum(getFinal(row, header, statLabel));
}

function buildBirds(sheets) {
  const rows = sheets['Bird Stat Rebalance'] || [];
  const { header, dataStart } = sheetLayout('Bird Stat Rebalance', rows, ['Bird Name', 'Final HP']);
  const birds = Object.create(null);
  let passiveIdx = 1;
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const name = getFuzzy(row, header, ['Bird Name']);
    if (!name || /^bird name/i.test(name)) continue;
    const key = birdKey(name);
    if (!key) continue;
    const hp = getFinalNum(row, header, 'HP');
    if (hp <= 0) continue;
    const cls = classId(getFuzzy(row, header, ['Suggested Class', 'Class']));
    const sz = sizeId(getFuzzy(row, header, ['Real Size Tier', 'Size']));
    const passiveName = getFuzzy(row, header, ['Passive Name']);
    const passiveSummary = getFuzzy(row, header, ['Passive Summary']);
    const classPerk = getFuzzy(row, header, ['Class Perk']);
    const classPerkSummary = getFuzzy(row, header, ['Class Perk Summary']);
    const passiveId = 'PAS-' + String(passiveIdx++).padStart(3, '0');
    const preserve = BIRD_PRESERVE[key] || {};
    const entry = {
      name,
      portraitKey: key,
      size: sz,
      class: cls,
      stats: {
        hp, maxHp: hp,
        atk: getFinalNum(row, header, 'ATK'),
        def: getFinalNum(row, header, 'DEF'),
        spd: getFinalNum(row, header, 'SPD'),
        dodge: getFinalNum(row, header, 'Dodge'),
        acc: getFinalNum(row, header, 'ACC'),
        mdef: getFinalNum(row, header, 'MDEF'),
        matk: getFinalNum(row, header, 'MATK'),
        critChance: 8,
      },
      passive: {
        id: passiveId,
        name: passiveName || preserve.passiveName || '',
        desc: passiveSummary || '',
      },
      classPerk: classPerk || '',
      classPerkEffect: classPerkSummary || '',
    };
    if (preserve.tagline) entry.tagline = preserve.tagline;
    if (preserve.color) entry.color = preserve.color;
    if (preserve.unlockRequires) entry.unlockRequires = preserve.unlockRequires;
    if (preserve.unlockHint) entry.unlockHint = preserve.unlockHint;
    if (preserve.abilityPool) entry.abilityPool = preserve.abilityPool;
    birds[key] = entry;
  }
  return birds;
}

function buildClasses(sheets) {
  const rows = sheets['Class Templates'] || [];
  const { header, dataStart } = sheetLayout('Class Templates', rows, ['Class', 'Base HP']);
  const out = Object.create(null);
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const clsName = get(row, header, 'Class');
    if (!clsName || clsName === 'Class') continue;
    const id = classId(clsName);
    const perk = getFuzzy(row, header, ['Class Perk']);
    out[id] = {
      id,
      name: clsName,
      coreIdentity: getFuzzy(row, header, ['Core Role', 'Core Identity']) || '',
      damageStyle: getFuzzy(row, header, ['Major Strengths']) || '',
      mainAilment: getFuzzy(row, header, ['Signature Rule']) || '',
      defensiveAngle: getFuzzy(row, header, ['True Weaknesses']) || '',
      statHooks: getFuzzy(row, header, ['Balance Lock']) || '',
      balanceCaution: getFuzzy(row, header, ['Balance Lock']) || '',
      classPerk: perk,
      classPerkEffect: getFuzzy(row, header, ['Always Active Effect', 'Perk Clause']) || '',
      baseStats: {
        hp: asNum(getFuzzy(row, header, ['Base HP'])),
        atk: asNum(getFuzzy(row, header, ['Base ATK'])),
        def: asNum(getFuzzy(row, header, ['Base DEF'])),
        spd: asNum(getFuzzy(row, header, ['Base SPD', 'Base Speed'])),
        dodge: asNum(getFuzzy(row, header, ['Base Dodge'])),
        acc: asNum(getFuzzy(row, header, ['Base ACC', 'Base Accuracy'])),
        mdef: asNum(getFuzzy(row, header, ['Base MDEF'])),
        matk: asNum(getFuzzy(row, header, ['Base MATK'])),
      },
    };
  }
  return out;
}

function buildSizeChart(sheets) {
  const rows = sheets['Size Chart'] || [];
  const { header, dataStart } = sheetLayout('Size Chart', rows, ['Real Size Tier']);
  const out = Object.create(null);
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const tier = get(row, header, 'Real Size Tier');
    if (!tier) continue;
    out[tier] = {
      tier,
      runtimeSize: sizeId(tier),
      hpMod: asNum(getFuzzy(row, header, ['HP Mod'])),
      defMod: asNum(getFuzzy(row, header, ['DEF Mod'])),
      spdMod: asNum(getFuzzy(row, header, ['SPD Mod'])),
      dodgeMod: asNum(getFuzzy(row, header, ['Dodge Mod'])),
      accMod: asNum(getFuzzy(row, header, ['ACC Mod'])),
      hpSoftCap: asNum(getFuzzy(row, header, ['HP Soft Cap'])),
    };
  }
  return out;
}

function buildTitlePools(sheets) {
  const rows = sheets['Bird Enemy Title Pools'] || [];
  const { header, dataStart } = sheetLayout('Bird Enemy Title Pools', rows, ['Base Bird', 'Boss Title']);
  const out = Object.create(null);
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const base = getFuzzy(row, header, ['Base Bird']);
    if (!base) continue;
    const key = birdKey(base);
    out[key] = {
      birdKey: key,
      birdName: base,
      class: classId(getFuzzy(row, header, ['Class'])),
      rank1Title: getFuzzy(row, header, ['Rank 1 Title']),
      rank2Title: getFuzzy(row, header, ['Rank 2 Title']),
      rank3Title: getFuzzy(row, header, ['Rank 3 Title']),
      bossTitle: getFuzzy(row, header, ['Boss Title']),
      bossExtraStats: getFuzzy(row, header, ['Boss Extra Stat Identity']),
      bossMechanic: getFuzzy(row, header, ['Boss Mechanic Summary']),
    };
  }
  return out;
}

function buildBirdPassives(sheets, birds) {
  const rows = sheets['Passives & Perks'] || [];
  const { header, dataStart } = sheetLayout('Passives & Perks', rows, ['Bird Name', 'Passive Name']);
  const out = Object.create(null);
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const name = getFuzzy(row, header, ['Bird Name']);
    if (!name) continue;
    const key = birdKey(name);
    const bird = birds[key];
    if (!bird) continue;
    const passiveId = bird.passive?.id || slugId('PAS', name);
    const effect = getFuzzy(row, header, ['Simple Passive Effect', 'Passive Summary']) || bird.passive?.desc || '';
    const trigger = getFuzzy(row, header, ['Trigger', 'Class Perk Trigger']);
    const classPerkEffect = bird.classPerkEffect || getFuzzy(row, header, ['Class Perk Effect', 'Class Perk Summary']) || '';
    out[passiveId] = {
      id: passiveId,
      birdKey: key,
      birdName: name,
      class: bird.class,
      name: getFuzzy(row, header, ['Passive Name']) || passiveId,
      type: getFuzzy(row, header, ['Benefit Type']) || 'Passive',
      target: 'self',
      trigger: trigger || '',
      effect: effect || '',
      numerical: effect || '',
      synergy: getFuzzy(row, header, ['Balance Note']) || '',
      inspiration: '',
      balanceNote: getFuzzy(row, header, ['Balance Note', 'Timing']) || '',
      tags: [bird.class],
      classPerk: getFuzzy(row, header, ['Class Perk']) || bird.classPerk || '',
      classPerkEffect,
    };
  }
  for (const key of Object.keys(birds)) {
    const bird = birds[key];
    const pid = bird.passive?.id;
    if (pid && out[pid] && bird.classPerkEffect) out[pid].classPerkEffect = bird.classPerkEffect;
  }
  for (const key of Object.keys(birds)) {
    const bird = birds[key];
    if (!bird?.passive?.id) continue;
    if (out[bird.passive.id]) continue;
    out[bird.passive.id] = {
      id: bird.passive.id,
      birdKey: key,
      birdName: bird.name,
      class: bird.class,
      name: bird.passive.name || bird.passive.id,
      type: 'Passive',
      target: 'self',
      trigger: '',
      effect: bird.passive.desc || '',
      numerical: bird.passive.desc || '',
      synergy: '',
      inspiration: '',
      balanceNote: '',
      tags: [bird.class],
      classPerk: bird.classPerk || '',
      classPerkEffect: bird.classPerkEffect || '',
    };
  }
  return out;
}

function buildEnemyRoster(sheets) {
  const rows = sheets['Enemy Birds'] || [];
  const { header, dataStart } = sheetLayout('Enemy Birds', rows, ['Enemy ID', 'Base Bird']);
  const byId = Object.create(null);
  const byBirdLevel = Object.create(null);
  const bossesByBirdLevel = Object.create(null);
  const normalByLevel = Object.create(null);
  const bossesByLevel = Object.create(null);
  let count = 0;
  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const id = getFuzzy(row, header, ['Enemy ID']);
    if (!id || /^enemy id/i.test(id)) continue;
    const baseBird = getFuzzy(row, header, ['Base Bird']);
    const bk = birdKey(baseBird);
    const encType = getFuzzy(row, header, ['Encounter Type']).toLowerCase();
    const isBoss = encType === 'boss' || id.startsWith('BO-');
    const level = asNum(getFuzzy(row, header, ['Level']));
    if (!bk || level <= 0) continue;
    const hp = asNum(getFuzzy(row, header, ['Enemy HP']));
    const atk = asNum(getFuzzy(row, header, ['Enemy Attack', 'Enemy ATK']));
    const matk = asNum(getFuzzy(row, header, ['Enemy Magic Attack', 'Enemy MATK']));
    const spd = asNum(getFuzzy(row, header, ['Enemy Speed', 'Enemy SPD']));
    const def = asNum(getFuzzy(row, header, ['Enemy Defence', 'Enemy DEF']));
    const mdef = asNum(getFuzzy(row, header, ['Enemy Magic Defence', 'Enemy MDEF']));
    const acc = asNum(getFuzzy(row, header, ['Enemy Accuracy', 'Enemy ACC']));
    const dodge = asNum(getFuzzy(row, header, ['Enemy Dodge']));
    const aiProfile = getFuzzy(row, header, ['AI Profile']);
    const entry = {
      id,
      birdKey: bk,
      name: getFuzzy(row, header, ['Enemy Name']) || (baseBird + ' L' + level),
      fantasyTitle: getFuzzy(row, header, ['Fantasy Title']),
      enemyVariant: getFuzzy(row, header, ['Enemy Variant']),
      encounterType: isBoss ? 'Boss' : 'Normal',
      isBoss,
      storyLevel: level,
      class: classId(getFuzzy(row, header, ['Class'])),
      size: sizeId(getFuzzy(row, header, ['Real Size Tier', 'Size Tier'])),
      stats: { hp, maxHp: hp, atk, def, spd, dodge, acc, mdef, matk, critChance: 5, critMult: 1.5 },
      aiProfile,
      aiPriority: getFuzzy(row, header, ['AI Priority']),
      aiStyle: aiStyleFromProfile(aiProfile),
      bossMechanic: getFuzzy(row, header, ['Boss Mechanic']),
      suggestedAbilityPack: getFuzzy(row, header, ['Suggested Ability Pack']),
      lootShiny: asNum(getFuzzy(row, header, ['Loot Shiny'])),
      xpWeight: asNum(getFuzzy(row, header, ['XP Weight'])),
      threatScore: asNum(getFuzzy(row, header, ['Threat Score'])),
      spawnRole: getFuzzy(row, header, ['Spawn Role']),
    };
    byId[id] = entry;
    if (!byBirdLevel[bk]) byBirdLevel[bk] = Object.create(null);
    if (!byBirdLevel[bk][level]) byBirdLevel[bk][level] = [];
    byBirdLevel[bk][level].push(id);
    if (isBoss) {
      if (!bossesByBirdLevel[bk]) bossesByBirdLevel[bk] = Object.create(null);
      if (!bossesByBirdLevel[bk][level]) bossesByBirdLevel[bk][level] = [];
      bossesByBirdLevel[bk][level].push(id);
      if (!bossesByLevel[level]) bossesByLevel[level] = [];
      bossesByLevel[level].push(id);
    } else {
      if (!normalByLevel[level]) normalByLevel[level] = [];
      normalByLevel[level].push(id);
    }
    count++;
  }
  return { byId, byBirdLevel, bossesByBirdLevel, normalByLevel, bossesByLevel, count };
}

function emitBirdsJs(birds) {
  const keys = Object.keys(birds).sort();
  let body = keys.map((k) => {
    const b = birds[k];
    const lines = [`  ${k}:{`];
    lines.push(`    name:${JSON.stringify(b.name)}, portraitKey:${JSON.stringify(b.portraitKey)},`);
    if (b.tagline) lines.push(`    tagline:${JSON.stringify(b.tagline)},`);
    lines.push(`    size:${JSON.stringify(b.size)}, class:${JSON.stringify(b.class)},`);
    if (b.unlockRequires) lines.push(`    unlockRequires:${JSON.stringify(b.unlockRequires)},`);
    if (b.unlockHint) lines.push(`    unlockHint:${JSON.stringify(b.unlockHint)},`);
    const st = b.stats;
    lines.push(`    stats:{hp:${st.hp},maxHp:${st.maxHp},atk:${st.atk},def:${st.def},spd:${st.spd},dodge:${st.dodge},acc:${st.acc},mdef:${st.mdef},matk:${st.matk},critChance:${st.critChance}},`);
    if (b.color) lines.push(`    color:${JSON.stringify(b.color)},`);
    if (b.passive) {
      const pd = [`id:${JSON.stringify(b.passive.id)},name:${JSON.stringify(b.passive.name)}`];
      if (b.passive.desc) pd.push(`desc:${JSON.stringify(b.passive.desc)}`);
      lines.push(`    passive:{${pd.join(',')}},`);
    }
    if (b.classPerk) lines.push(`    classPerk:${JSON.stringify(b.classPerk)},`);
    if (b.classPerkEffect) lines.push(`    classPerkEffect:${JSON.stringify(b.classPerkEffect)},`);
    if (b.abilityPool) lines.push(`    abilityPool:${JSON.stringify(b.abilityPool)},`);
    lines.push('  },');
    return lines.join('\n');
  }).join('\n');
  return `/* GENERATED by scripts/import-master-bird-content.mjs — do not edit by hand. */\n(function () {\n  'use strict';\n  var birds = {\n${body}\n  };\n  globalThis.BIRDS = birds;\n})();\n`;
}

function emitDataJs(header, varName, payload, namespace) {
  const json = JSON.stringify(payload);
  if (namespace === 'combatPack') {
    return `${header}\n(function () {\n  'use strict';\n  var Avian = globalThis.Avian || (globalThis.Avian = {});\n  Avian.data = Avian.data || Object.create(null);\n  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);\n  Avian.data.combatPack.${varName} = Object.freeze(${json});\n})();\n`;
  }
  return `${header}\n(function () {\n  'use strict';\n  var Avian = globalThis.Avian || (globalThis.Avian = {});\n  Avian.data = Avian.data || Object.create(null);\n  Avian.data.${varName} = Object.freeze(${json});\n})();\n`;
}

function main() {
  if (!existsSync(MASTER_XLSX)) {
    console.error('[master-bird] missing:', MASTER_XLSX);
    process.exit(1);
  }
  console.log('[master-bird] reading:', MASTER_XLSX);
  const sheets = readWorkbook(MASTER_XLSX);

  if (process.argv.includes('--inspect-headers')) {
    for (const name of Object.keys(sheets)) {
      const rows = sheets[name];
      const { header, dataStart } = sheetLayout(name, rows, ['Bird Name', 'Enemy ID', 'Class', 'Real Size Tier']);
      console.log('\n===', name, 'rows=', rows.length, 'dataStart=', dataStart, '===');
      console.log(Object.keys(header).slice(0, 20).join(' | '));
      if (rows[dataStart]) console.log('sample:', rows[dataStart].slice(0, 8).join(' | '));
    }
    process.exit(0);
  }

  const birds = buildBirds(sheets);
  const classes = buildClasses(sheets);
  const sizeChart = buildSizeChart(sheets);
  const titlePools = buildTitlePools(sheets);
  const birdPassives = buildBirdPassives(sheets, birds);
  const roster = buildEnemyRoster(sheets);

  console.log('[master-bird] birds:', Object.keys(birds).length);
  console.log('[master-bird] classes:', Object.keys(classes).length);
  console.log('[master-bird] enemy roster rows:', roster.count);
  console.log('[master-bird] passives:', Object.keys(birdPassives).length);

  mkdirSync(path.dirname(OUT_CLASSES), { recursive: true });
  writeFileSync(OUT_BIRDS, emitBirdsJs(birds), 'utf8');
  writeFileSync(OUT_ROSTER, emitDataJs('/* GENERATED enemy roster */', 'enemyRoster', {
    byId: roster.byId,
    byBirdLevel: roster.byBirdLevel,
    bossesByBirdLevel: roster.bossesByBirdLevel,
    normalByLevel: roster.normalByLevel,
    bossesByLevel: roster.bossesByLevel,
  }, 'enemyRoster'), 'utf8');
  writeFileSync(OUT_TITLES, emitDataJs('/* GENERATED title pools */', 'enemyTitlePools', titlePools, 'enemyTitlePools'), 'utf8');
  writeFileSync(OUT_SIZE, emitDataJs('/* GENERATED size chart */', 'sizeChart', sizeChart, 'sizeChart'), 'utf8');
  writeFileSync(OUT_CLASSES, emitDataJs('/* GENERATED classes */', 'classes', classes, 'combatPack'), 'utf8');
  writeFileSync(OUT_PASSIVES, emitDataJs('/* GENERATED bird passives */', 'birdPassives', birdPassives, 'combatPack'), 'utf8');

  console.log('[master-bird] wrote:', OUT_BIRDS);
  console.log('[master-bird] wrote:', OUT_ROSTER);
  if (process.argv.includes('--verify')) {
    const fail = Object.keys(birds).length < 40 || roster.count < 500;
    process.exit(fail ? 2 : 0);
  }
}

main();
