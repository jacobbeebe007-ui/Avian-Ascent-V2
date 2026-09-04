#!/usr/bin/env node
/**
 * Apply Avian_Ascent_Combat_Workbookv2.1.xlsx → runtime data (test prototype).
 *
 * Updates:
 *  - birds-v2.js size Base Health + Barn Owl class/stats + precision
 *  - size-chart.js size baseHealth
 *  - level-growth.js class 4-stat cycles
 *  - effect-tiers.js Minor/Major/Grand magnitudes
 *  - equipment core-rules, families, skills: no ordinary CDs; Fortify/Ward 4 AP
 *  - basic attack Skill Power 45%
 *
 * Usage:
 *   node scripts/import-combat-workbook-v21.mjs
 *   AA_COMBAT_WORKBOOK=/path/to.xlsx node scripts/import-combat-workbook-v21.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKBOOK = process.env.AA_COMBAT_WORKBOOK
  || path.join(ROOT, 'Avian_Ascent_Combat_Workbookv2.1.xlsx');

const SIZE_BASE = Object.freeze({
  Tiny: 125,
  Small: 128,
  Medium: 131,
  Large: 134,
  'Very Large': 137,
  Giant: 140,
  'Boss Override': 150,
});

const CLASS_CYCLES = Object.freeze({
  knight: ['might', 'guard', 'might', 'vitality'],
  rogue: ['dexterity', 'agility', 'dexterity', 'vitality'],
  mage: ['focus', 'resolve', 'focus', 'vitality'],
  siren: ['focus', 'agility', 'focus', 'resolve'],
  inquisitor: ['might', 'vitality', 'might', 'resolve'],
  bard: ['dexterity', 'focus', 'vitality', 'agility'],
  brute: ['might', 'vitality', 'might', 'guard'],
  duke: ['focus', 'vitality', 'focus', 'resolve'],
});

const CLASS_TITLES = {
  knight: 'Knight', rogue: 'Rogue', mage: 'Mage', siren: 'Siren',
  inquisitor: 'Inquisitor', bard: 'Bard', brute: 'Brute', duke: 'Duke',
};

const NAME_TO_KEY = Object.freeze({
  Sparrow: 'sparrow', Hummingbird: 'hummingbird', Blackbird: 'blackbird',
  Macaw: 'macaw', 'Peregrine Falcon': 'peregrine', 'Snowy Owl': 'snowyOwl',
  Kiwi: 'kiwi', 'Black Cockatoo': 'blackCockatoo', Crow: 'crow',
  Kookaburra: 'kookaburra', Lyrebird: 'lyrebird', Raven: 'raven',
  Magpie: 'magpie', Robin: 'robin', Bowerbird: 'bowerbird', Toucan: 'toucan',
  Swan: 'swan', Flamingo: 'flamingo', 'Secretary Bird': 'secretary',
  Albatross: 'albatross', Seagull: 'seagull', Goose: 'goose',
  'Shoebill Stork': 'shoebill', 'Harpy Eagle': 'harpy', 'Bald Eagle': 'baldEagle',
  'Emperor Penguin': 'penguin', Ostrich: 'ostrich', Cassowary: 'cassowary',
  Emu: 'emu', 'Duke Blakiston': 'dukeBlakiston', Wren: 'wren',
  'Superb Fairywren': 'fairywren', Firecrest: 'firecrest',
  'Willie Wagtail': 'wagtail', Galah: 'galah', 'Blue Jay': 'bluejay',
  Cardinal: 'cardinal', 'Bush Turkey': 'bushturkey', Vulture: 'vulture',
  'Barn Owl': 'barnowl', Bustard: 'bustard', 'Golden Eagle': 'goldeneagle',
  'Australian Pelican': 'pelican', 'Marabou Stork': 'marabou',
  Pigeon: 'pigeon', 'Rock Pigeon': 'rockPigeon', Dove: 'dove',
  'Rock Dove': 'rockDove', Kakapo: 'kakapo', Dodo: 'dodo',
  Chickadee: 'chickadee', Finch: 'finch',
});

const CLASS_PRECISION = Object.freeze({
  knight: 80, rogue: 86, mage: 84, siren: 83,
  inquisitor: 80, bard: 82, brute: 78, duke: 84,
});

const SIZE_PREC = Object.freeze({
  Tiny: 5, Small: 3, Medium: 0, Large: -2,
  'Very Large': -4, Giant: -6, 'Boss Override': 0,
});

/* ---------- OOXML reader (handles absolute rel targets + t="str") ---------- */
function zipEntries(file) {
  const b = readFileSync(file);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65558); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) throw new Error(`Invalid OOXML: ${file}`);
  const out = Object.create(null);
  let p = b.readUInt32LE(e + 16);
  const end = p + b.readUInt32LE(e + 12);
  while (p < end && b.readUInt32LE(p) === 0x02014b50) {
    const method = b.readUInt16LE(p + 10);
    const size = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28);
    const xl = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const off = b.readUInt32LE(p + 42);
    const name = b.toString('utf8', p + 46, p + 46 + nl);
    const dataAt = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
    const raw = b.slice(dataAt, dataAt + size);
    out[name] = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString('utf8');
    p += 46 + nl + xl + cl;
  }
  return out;
}
const decode = (s = '') => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#10;/g, '\n').replace(/&#13;/g, '\r')
  .replace(/&amp;/g, '&');
function col(ref) {
  let n = 0;
  for (const c of (/^([A-Z]+)/.exec(ref) || ['', 'A'])[1]) n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}
function parseSheet(xml, shared) {
  const rows = [];
  let m;
  const rr = /<(?:x:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  while ((m = rr.exec(xml))) {
    const row = [];
    let c;
    const cr = /<(?:x:)?c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
    while ((c = cr.exec(m[2]))) {
      const attrs = c[1];
      const body = c[2] || '';
      const ref = /r="([A-Z]+\d+)"/.exec(attrs);
      const type = /t="([^"]+)"/.exec(attrs)?.[1] || '';
      const vm = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(body);
      let value = vm ? decode(vm[1]) : '';
      if (type === 's' && vm) value = shared[Number(vm[1])] || '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)]
          .map((x) => decode(x[1])).join('');
      }
      row[ref ? col(ref[1]) : row.length] = value;
    }
    rows[Number(m[1]) - 1] = row;
  }
  return rows;
}
function readWorkbook(file) {
  const e = zipEntries(file);
  const wb = e['xl/workbook.xml'];
  const rels = e['xl/_rels/workbook.xml.rels'] || '';
  const shared = [];
  for (const m of (e['xl/sharedStrings.xml'] || '')
    .matchAll(/<(?:x:)?si\b[^>]*>([\s\S]*?)<\/(?:x:)?si>/g)) {
    shared.push([...m[1].matchAll(/<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/g)]
      .map((x) => decode(x[1])).join(''));
  }
  const targets = Object.create(null);
  for (const m of rels.matchAll(/<Relationship\s+([^>]+?)\s*\/>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && t) targets[id] = t;
  }
  const sheets = Object.create(null);
  for (const m of wb.matchAll(/<(?:x:)?sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    let t = targets[m[2]];
    if (!t) continue;
    t = t.replace(/^\//, '');
    const key = t.startsWith('xl/') ? t : `xl/${t}`;
    if (e[key]) sheets[decode(m[1])] = parseSheet(e[key], shared);
  }
  return sheets;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emitFrozenModule(header, assignPath, value) {
  return `${header}
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  ${assignPath} = Object.freeze(${JSON.stringify(value)});
})();
`;
}

function buildLevelGrowth() {
  const out = {};
  for (const [cls, cycle] of Object.entries(CLASS_CYCLES)) {
    const title = CLASS_TITLES[cls];
    const cum = {
      vitality: 0, might: 0, dexterity: 0, guard: 0, focus: 0, resolve: 0, agility: 0,
    };
    for (let lvl = 1; lvl <= 30; lvl++) {
      if (lvl > 1) {
        const stat = cycle[(lvl - 2) % cycle.length];
        cum[stat] += 1;
      }
      out[`${title}|${lvl}`] = {
        class: cls,
        level: lvl,
        vitality: cum.vitality,
        might: cum.might,
        dexterity: cum.dexterity,
        guard: cum.guard,
        focus: cum.focus,
        resolve: cum.resolve,
        agility: cum.agility,
      };
    }
  }
  return out;
}

function parseBirdRecalibration(rows) {
  const birds = [];
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = String(r[0] || '').trim();
    if (!name || !NAME_TO_KEY[name]) continue;
    birds.push({
      name,
      key: NAME_TO_KEY[name],
      oldClass: String(r[1] || '').toLowerCase(),
      newClass: String(r[2] || '').toLowerCase(),
      size: String(r[3] || '').trim(),
      tier: String(r[4] || '').toLowerCase(),
      starter: String(r[5] || '').toLowerCase() === 'yes',
      affinity: String(r[6] || '').trim(),
      vit: num(r[7]),
      might: num(r[8]),
      dex: num(r[9]),
      guard: num(r[10]),
      focus: num(r[11]),
      resolve: num(r[12]),
      agility: num(r[13]),
      oldL1Hp: num(r[14]),
      newL1Hp: num(r[15]),
      hpChange: num(r[16]),
      oldPrecision: num(r[17]),
      newPrecision: num(r[18]),
      attackIdentity: String(r[19] || '').trim(),
      reviewState: String(r[20] || '').trim(),
      designNote: String(r[21] || '').trim(),
    });
  }
  return birds;
}

function primaryScaling(identity, cls) {
  const id = String(identity || '').toLowerCase();
  if (id.includes('hybrid')) return 'Dexterity / Focus';
  if (id.includes('authored')) return 'Might / Focus / Resolve';
  if (id.includes('might or focus') || id.includes('might / focus')) return 'Might / Focus / Resolve';
  if (id.includes('dexterity')) return 'Dexterity';
  if (id.includes('focus')) return 'Focus';
  if (id.includes('might')) {
    if (cls === 'brute') return 'Might / Guard / Vitality';
    if (cls === 'knight') return 'Might / Guard';
    return 'Might';
  }
  return cls === 'bard' ? 'Dexterity / Focus' : 'Might';
}

function dodgeFromAgi(agi) {
  return Math.min(50, Math.max(0, agi * 0.5));
}

function maxHp(sizeBase, vit, level = 1) {
  return Math.round(sizeBase + 5 * vit + 5 * (level - 1));
}

function rewriteBirdsV2(existing, recal) {
  const out = {};
  for (const row of recal) {
    const prev = existing[row.key] || {};
    const sizeBase = SIZE_BASE[row.size];
    if (sizeBase == null) throw new Error(`Unknown size ${row.size} for ${row.name}`);
    const cls = row.newClass;
    const classPrec = CLASS_PRECISION[cls] ?? (Number(prev.classPrecision) || 80);
    const sizePrec = SIZE_PREC[row.size] ?? 0;
    const speciesPrec = row.newPrecision - classPrec - sizePrec;
    const hp = maxHp(sizeBase, row.vit, 1);
    if (hp !== row.newL1Hp) {
      console.warn(`[warn] ${row.name} HP formula ${hp} != workbook ${row.newL1Hp}`);
    }
    out[row.key] = {
      ...prev,
      name: row.name,
      class: cls,
      realSize: row.size,
      speciesTier: row.tier,
      starter: row.starter,
      baseHealth: sizeBase,
      vitality: row.vit,
      stats: {
        vitality: row.vit,
        atk: row.might,
        dex: row.dex,
        def: row.guard,
        matk: row.focus,
        mdef: row.resolve,
        spd: row.agility,
        hp,
        maxHp: hp,
        dodge: dodgeFromAgi(row.agility),
        acc: row.newPrecision,
        critChance: Number(prev.stats?.critChance) || 8,
      },
      primaryScaling: primaryScaling(row.attackIdentity, cls),
      bossOverride: row.size === 'Boss Override',
      basePrecision: row.newPrecision,
      classPrecision: classPrec,
      sizePrecisionModifier: sizePrec,
      speciesPrecisionModifier: speciesPrec,
    };
    if (row.key === 'barnowl') {
      out[row.key].roleNote = 'Silent hunter: Dexterity Rogue. First Finesse hit vs a target that has not acted ignores 4 Guard and gains +10 Precision.';
      out[row.key].precisionIdentity = 'Silent hunter.';
    }
  }
  for (const key of Object.keys(existing)) {
    if (!out[key]) out[key] = existing[key];
  }
  return out;
}

function patchJsonLiteralFile(filePath, mutate) {
  const src = readFileSync(filePath, 'utf8');
  const m = src.match(/Object\.freeze\((\{[\s\S]*\}|\[[\s\S]*\])\)\s*;?\s*\}\)\s*\(\)\s*;?\s*$/);
  if (!m) throw new Error(`Cannot find Object.freeze payload in ${filePath}`);
  const obj = JSON.parse(m[1]);
  mutate(obj);
  const header = src.slice(0, src.indexOf('(function'));
  const assignMatch = src.match(/(Avian\.data(?:\.\w+)+)\s*=\s*Object\.freeze/);
  if (!assignMatch) throw new Error(`Cannot find assign path in ${filePath}`);
  let out = emitFrozenModule(
    header.trimEnd() || `/* Updated by import-combat-workbook-v21.mjs */`,
    assignMatch[1],
    obj,
  );
  /* Preserve nested Avian.data.equipment namespace init when present. */
  if (/Avian\.data\.equipment\.\w+\s*=\s*Object\.freeze/.test(src)
    && !/Avian\.data\.equipment = Avian\.data\.equipment/.test(out)) {
    out = out.replace(
      "Avian.data = Avian.data || Object.create(null);\n  ",
      "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment = Avian.data.equipment || Object.create(null);\n  ",
    );
  }
  writeFileSync(filePath, out);
}

function zeroOrdinaryCooldowns(skills) {
  const keepOnce = /ultimate|once.?per|per.?battle|bastion|aegis/i;
  for (const sk of Object.values(skills)) {
    if (!sk || typeof sk !== 'object') continue;
    const id = String(sk.id || sk.name || '');
    const type = String(sk.skillType || sk.barSlot || '');
    if (keepOnce.test(id) || keepOnce.test(type)) continue;
    /* Ordinary weapon / restoration / fortify / ward → CD 0 */
    if (sk.cooldown != null && Number(sk.cooldown) > 0) sk.cooldown = 0;
    if (sk.enCooldown != null && Number(sk.enCooldown) > 0) sk.enCooldown = 0;
  }
}

function syncWeaponTechniques(families, skills, weaponDistRows) {
  /* Map workbook Technique A/B AP + power onto family rows when names match. */
  for (let i = 4; i < weaponDistRows.length; i++) {
    const r = weaponDistRows[i] || [];
    const family = String(r[0] || '').trim();
    if (!family || !families[family]) continue;
    const fam = families[family];
    const aAp = num(r[6]);
    const bAp = num(r[9]);
    const aEffect = String(r[7] || '');
    const bEffect = String(r[10] || '');
    const aPct = Number((/(\d+(?:\.\d+)?)\s*%/.exec(aEffect) || [])[1]);
    const bPct = Number((/(\d+(?:\.\d+)?)\s*%/.exec(bEffect) || [])[1]);
    if (aAp > 0) fam.skill1En = aAp;
    if (bAp > 0) fam.skill2En = bAp;
    fam.skill1Cooldown = 0;
    fam.skill2Cooldown = 0;
    if (Number.isFinite(aPct) && aPct > 0) fam.skill1PowerPct = Math.round(aPct);
    if (Number.isFinite(bPct) && bPct > 0) fam.skill2PowerPct = Math.round(bPct);
    fam.skill1Name = String(r[5] || fam.skill1Name || '').trim() || fam.skill1Name;
    fam.skill2Name = String(r[8] || fam.skill2Name || '').trim() || fam.skill2Name;

    const skA = fam.skillA && skills[fam.skillA];
    const skB = fam.skillB && skills[fam.skillB];
    if (skA) {
      skA.cooldown = 0;
      if (aAp > 0) { skA.en = aAp; skA.enCost = aAp; }
      if (Number.isFinite(aPct) && aPct > 0) {
        skA.skillPowerPct = Math.round(aPct);
        skA.skillPower = Math.round(aPct) / 100;
      }
      if (fam.skill1Name) skA.name = fam.skill1Name;
    }
    if (skB) {
      skB.cooldown = 0;
      if (bAp > 0) { skB.en = bAp; skB.enCost = bAp; }
      if (Number.isFinite(bPct) && bPct > 0) {
        skB.skillPowerPct = Math.round(bPct);
        skB.skillPower = Math.round(bPct) / 100;
      }
      if (fam.skill2Name) skB.name = fam.skill2Name;
    }
  }
}

function main() {
  console.log(`Reading ${path.basename(WORKBOOK)}…`);
  const sheets = readWorkbook(WORKBOOK);
  const recal = parseBirdRecalibration(sheets['Bird Recalibration'] || []);
  if (recal.length < 50) throw new Error(`Expected ~52 birds, got ${recal.length}`);
  console.log(`Parsed ${recal.length} bird recalibration rows`);

  /* birds-v2 */
  const birdsSrc = readFileSync(path.join(ROOT, 'js/data/birds-v2.js'), 'utf8');
  const birdsMatch = birdsSrc.match(/Object\.freeze\((\{[\s\S]*\})\)\s*;?\s*\}\)\s*\(\)\s*;?\s*$/);
  if (!birdsMatch) throw new Error('birds-v2.js parse failed');
  const existingBirds = JSON.parse(birdsMatch[1]);
  const nextBirds = rewriteBirdsV2(existingBirds, recal);
  writeFileSync(path.join(ROOT, 'js/data/birds-v2.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs from Combat Workbook v2.1
 * Max HP = Size Base + 5×VIT + 5×(Level−1). Size bases 125–140.
 */`,
    'Avian.data.birdsV2',
    nextBirds,
  ));
  console.log('Wrote js/data/birds-v2.js');

  /* size chart — add baseHealth */
  const sizeChart = {};
  for (const [tier, base] of Object.entries(SIZE_BASE)) {
    sizeChart[tier] = {
      tier,
      runtimeSize: tier === 'Very Large' ? 'xl'
        : tier === 'Boss Override' ? 'boss'
          : tier.toLowerCase().replace(/\s+/g, ''),
      baseHealth: base,
      precisionModifier: SIZE_PREC[tier] ?? 0,
      accMod: SIZE_PREC[tier] ?? 0,
      notes: tier === 'Medium' ? 'Neutral baseline.' : '',
    };
  }
  writeFileSync(path.join(ROOT, 'js/data/size-chart.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs — Size & Health v2.1 */`,
    'Avian.data.sizeChart',
    sizeChart,
  ));
  console.log('Wrote js/data/size-chart.js');

  /* level growth cycles */
  const growth = buildLevelGrowth();
  writeFileSync(path.join(ROOT, 'js/data/progression/level-growth.js'),
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs
 * Combat Workbook v2.1 class growth cycles (one authored stat per level).
 * Max Health +5 per level is applied separately in bird-progression.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.progression = Avian.data.progression || Object.create(null);
  Avian.data.progression.levelGrowth = Object.freeze(${JSON.stringify(growth)});
})();
`);
  console.log('Wrote js/data/progression/level-growth.js');

  /* effect tiers: Minor ±1, Major ±2, Grand ±4 (moderate alias → major for compat) */
  writeFileSync(path.join(ROOT, 'js/data/effect-tiers.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs
 * Combat Workbook v2.1: Minor ±1 / Major ±2 / Grand ±4; Standard duration 3 turns.
 */`,
    'Avian.data.effectTiers',
    {
      packVersion: '2026.09-combat-v2.1',
      buff: { minor: 1, moderate: 2, major: 2, grand: 4 },
      debuff: { minor: 1, moderate: 2, major: 2, grand: 4 },
      points: { minor: 1, moderate: 2, major: 2, grand: 4 },
      brace: { minor: 1, moderate: 2, major: 2, grand: 4 },
      durations: { standard: 3, grand: 2, brief: 1, extended: 4 },
      stacking: { mode: 'strongestPerDirection', coreTempCapPct: 20, precisionTempCapPoints: 12 },
      flatStat: true,
    },
  ));
  console.log('Wrote js/data/effect-tiers.js');

  /* equipment core rules + families + skills */
  patchJsonLiteralFile(path.join(ROOT, 'js/data/equipment/core-rules.js'), (rules) => {
    rules.packVersion = '2026.09-combat-v2.1';
    rules.weaponDamageFormula = 'Attack Power = Weapon Roll + 2 × Scaling Stat; raw = Attack Power × (Skill Power ÷ 100)';
    rules.basicAttackSkillPowerPct = 45;
    rules.weaponSkill1 = { en: 2, cooldown: 0 };
    rules.weaponSkill2 = { en: 3, cooldown: 0 };
    rules.armourRestoration = { ...(rules.armourRestoration || {}), en: 2, cooldown: 0 };
    rules.magicArmourRestoration = { ...(rules.magicArmourRestoration || {}), en: 2, cooldown: 0 };
    rules.fortify = { ...(rules.fortify || {}), en: 4, cooldown: 0, duration: 2, overflow: true };
    rules.ward = { ...(rules.ward || {}), en: 4, cooldown: 0, duration: 2, overflow: true };
    rules.bastionAegis = { ...(rules.bastionAegis || {}), en: 5, cooldown: 0, duration: 2, overflow: true };
    rules.combatWorkbookV21 = true;
  });
  console.log('Patched js/data/equipment/core-rules.js');

  const familiesSrc = readFileSync(path.join(ROOT, 'js/data/equipment/families.js'), 'utf8');
  const famMatch = familiesSrc.match(/Object\.freeze\((\{[\s\S]*\})\)\s*;?\s*\}\)\s*\(\)\s*;?\s*$/);
  const families = JSON.parse(famMatch[1]);
  const skillsSrc = readFileSync(path.join(ROOT, 'js/data/equipment/skills.js'), 'utf8');
  const skMatch = skillsSrc.match(/Object\.freeze\((\{[\s\S]*\})\)\s*;?\s*\}\)\s*\(\)\s*;?\s*$/);
  const skills = JSON.parse(skMatch[1]);

  for (const fam of Object.values(families)) {
    if (!fam || typeof fam !== 'object') continue;
    if (fam.skill1Cooldown != null) fam.skill1Cooldown = 0;
    if (fam.skill2Cooldown != null) fam.skill2Cooldown = 0;
  }
  zeroOrdinaryCooldowns(skills);
  if (skills.BASIC_PHYSICAL) {
    skills.BASIC_PHYSICAL.skillPowerPct = 45;
    skills.BASIC_PHYSICAL.skillPower = 0.45;
    skills.BASIC_PHYSICAL.riderText = 'Equipped Basic Attack — Attack Power × 45%. Unarmed fallback is flat 1–2.';
    delete skills.BASIC_PHYSICAL.naturalStrikeFlat;
  }
  if (skills.BASIC_MAGIC) {
    skills.BASIC_MAGIC.skillPowerPct = 45;
    skills.BASIC_MAGIC.skillPower = 0.45;
    skills.BASIC_MAGIC.riderText = 'Equipped Basic Attack — Attack Power × 45%. Unarmed fallback is flat 1–2.';
    delete skills.BASIC_MAGIC.naturalStrikeFlat;
  }
  /* Fortify / Ward EN → 4 */
  for (const sk of Object.values(skills)) {
    if (!sk) continue;
    const name = String(sk.name || sk.id || '');
    if (/^fortify$/i.test(name) || /FORTIFY/i.test(String(sk.id || ''))) {
      sk.en = 4; sk.enCost = 4; sk.cooldown = 0;
    }
    if (/^ward$/i.test(name) || (/WARD/i.test(String(sk.id || '')) && !/forward|reward/i.test(String(sk.id || '')))) {
      if (/ward/i.test(name) || /_WARD|WARD_/i.test(String(sk.id || ''))) {
        sk.en = 4; sk.enCost = 4; sk.cooldown = 0;
      }
    }
    if (/restoration|rebalance|brace|featherstep/i.test(name)) {
      sk.cooldown = 0;
    }
  }

  syncWeaponTechniques(families, skills, sheets['Weapon Distribution'] || []);

  /* ---- Phase 4–5: starters, Grey defence actions, loadout budgets ---- */
  const STARTER_WEAPONS = Object.freeze({
    mage: 'WPN-031',       /* Wand — Arcane Ward */
    siren: 'WPN-103',      /* Lament Song */
    knight: 'WPN-025',     /* Beak Hammer — Fortifying Slam */
    brute: 'WPN-025',
    bard: 'WPN-097',       /* Bard Song */
    rogue: 'WPN-007',      /* Talon Blade */
    inquisitor: 'WPN-085', /* War Scythe */
  });
  const STARTER_ARMOUR = Object.freeze({
    mage: 'ARM-007',
    siren: 'ARM-007',
    knight: 'ARM-001',
    brute: 'ARM-001',
    bard: 'ARM-007',
    rogue: 'ARM-019',
    inquisitor: 'ARM-001',
  });
  const STARTER_OFFHAND = Object.freeze({
    /* 1H starters that need Shield Fortify (weapon does not already grant Fortify/Ward). */
    rogue: 'SHD-019',
    bard: 'SHD-007',
    siren: 'SHD-007',
    /* knight/brute Beak Hammer already has Fortifying Slam; mage Wand has Arcane Ward */
  });

  patchJsonLiteralFile(path.join(ROOT, 'js/data/equipment/core-rules.js'), (rules) => {
    rules.basicStartingWeapons = { ...STARTER_WEAPONS };
    rules.starterDefenceKit = {
      armour: { ...STARTER_ARMOUR },
      offHand: { ...STARTER_OFFHAND },
    };
    rules.wholeLoadoutBudgets = {
      grey: { flatCore: 6, lightProtection: 20, balancedProtection: 28, heavyProtection: 36, namedProperties: 0 },
      green: { flatCore: 9, lightProtection: 24, balancedProtection: 34, heavyProtection: 43, namedProperties: 1 },
      blue: { flatCore: 12, lightProtection: 29, balancedProtection: 41, heavyProtection: 52, namedProperties: 1 },
      purple: { flatCore: 16, lightProtection: 35, balancedProtection: 49, heavyProtection: 62, namedProperties: 2 },
      gold: { flatCore: 20, lightProtection: 42, balancedProtection: 59, heavyProtection: 74, namedProperties: 2 },
      orange: { flatCore: 24, lightProtection: 50, balancedProtection: 70, heavyProtection: 88, namedProperties: 3 },
    };
    rules.combatWorkbookV21Phase45 = true;
  });

  writeFileSync(path.join(ROOT, 'js/data/equipment/starting-weapons.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs
 * Combat Workbook v2.1 — starters map into full Grey family kits (Basic + A + B).
 * Legacy WPN-B0x Basic-only rows remain in the catalogue for tests/explicit equip.
 */`,
    'Avian.data.equipment.startingWeapons',
    {
      packVersion: '2026.09-combat-v2.1',
      byClass: { ...STARTER_WEAPONS },
      ids: Object.values(STARTER_WEAPONS),
      legacyBasicIds: ['WPN-B01', 'WPN-B02', 'WPN-B03', 'WPN-B04', 'WPN-B05'],
      defenceKit: {
        armour: { ...STARTER_ARMOUR },
        offHand: { ...STARTER_OFFHAND },
      },
    },
  ).replace(
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment.startingWeapons",
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment = Avian.data.equipment || Object.create(null);\n  Avian.data.equipment.startingWeapons",
  ));
  console.log('Wrote starting-weapons.js (full family kits)');

  /* Grey plumage defence skills available from Grey rarity */
  const PLUMAGE_GREY_SKILLS = ['ESK-001', 'ESK-007', 'ESK-013', 'ESK-019', 'ESK-025', 'ESK-031', 'ESK-037', 'ESK-043'];
  for (const id of PLUMAGE_GREY_SKILLS) {
    const sk = skills[id];
    if (!sk) continue;
    sk.minRarity = 'grey';
    sk.cooldown = 0;
    if (sk.en == null) sk.en = 2;
  }
  /* Featherstep: Minor Agility Up 3 owner turns + small Magic Armour restore */
  if (skills['ESK-019']) {
    const fs = skills['ESK-019'];
    fs.duration = '3 turns';
    fs.riderText = 'Gain Minor Agility Up for 3 owner turns and restore 2 Magic Armour.';
    fs.riders = [
      { kind: 'restoreMagicArmour', value: 2 },
      { kind: 'tierStat', tier: 'minor', stat: 'spd', dir: 'up', turns: 3, target: 'self' },
    ];
    fs.protectionRiders = [{ kind: 'restoreMagicArmour', value: 2 }];
  }
  /* Rebalance / Brace naming alignment */
  if (skills['ESK-013']) {
    skills['ESK-013'].name = 'Rebalance';
    skills['ESK-013'].riderText = 'Restore 3 Armour and 3 Magic Armour.';
  }
  if (skills['ESK-025']) {
    skills['ESK-025'].name = 'Brace';
    skills['ESK-025'].riderText = 'Restore 4 Armour (armour-type pool).';
  }
  if (skills['ESK-001']) {
    skills['ESK-001'].name = 'Brace';
    skills['ESK-001'].riderText = 'Restore 4 Armour, capped at normal Maximum Armour.';
  }

  /* Shield Fortify — Grey-accessible 4 AP defence action */
  skills['ESK-SHD-FORTIFY'] = {
    id: 'ESK-SHD-FORTIFY',
    name: 'Fortify',
    source: 'Shield',
    family: 'Shield Defence',
    slot: 'Shield',
    pool: 'A',
    barSlot: 'Armour Technique',
    skillType: 'Fortify',
    en: 4,
    enCost: 4,
    cooldown: 0,
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
    riderText: 'Gain 8 Fortified Armour (add 8 to current Armour and temporary Maximum Armour) for 2 turns.',
    riders: [{ kind: 'fortify', value: 8, turns: 2 }],
    protectionRiders: [{ kind: 'fortify', value: 8, turns: 2 }],
    armourChange: 'Heal current Armour + temporary maximum',
    magicArmourChange: '—',
    duration: '2 turns',
    minRarity: 'grey',
    status: 'Active',
  };
  /* Align named Fortify skills to 4 AP */
  for (const sk of Object.values(skills)) {
    if (!sk) continue;
    const nm = String(sk.name || '');
    const typ = String(sk.skillType || '');
    if (/^fortify$/i.test(nm) || (/fortify/i.test(typ) && !/slam/i.test(nm))) {
      sk.en = 4;
      sk.enCost = 4;
      sk.cooldown = 0;
    }
    if (/^ward$/i.test(nm) || (/^ward$/i.test(typ))) {
      sk.en = 4;
      sk.enCost = 4;
      sk.cooldown = 0;
    }
  }

  writeFileSync(path.join(ROOT, 'js/data/equipment/families.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs — Combat Workbook v2.1 weapon families */`,
    'Avian.data.equipment.families',
    families,
  ).replace(
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment.families",
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment = Avian.data.equipment || Object.create(null);\n  Avian.data.equipment.families",
  ));
  writeFileSync(path.join(ROOT, 'js/data/equipment/skills.js'), emitFrozenModule(
    `/* GENERATED by scripts/import-combat-workbook-v21.mjs — Combat Workbook v2.1 skills (no ordinary CDs; Grey defence) */`,
    'Avian.data.equipment.skills',
    skills,
  ).replace(
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment.skills",
    "Avian.data = Avian.data || Object.create(null);\n  Avian.data.equipment = Avian.data.equipment || Object.create(null);\n  Avian.data.equipment.skills",
  ));
  console.log('Wrote families.js + skills.js');

  /* Assign Grey armour/shield skill1 from family defence kits */
  patchJsonLiteralFile(path.join(ROOT, 'js/data/equipment/items.js'), (items) => {
    const familySkillA = {};
    for (const [fname, fam] of Object.entries(families)) {
      if (fam && fam.skillA) familySkillA[fname] = fam.skillA;
    }
    for (const it of Object.values(items)) {
      if (!it || typeof it !== 'object') continue;
      if (it.slot === 'Armour' && String(it.rarity).toLowerCase() === 'grey') {
        const sid = familySkillA[it.family];
        if (sid) it.skill1 = sid;
      }
      if (it.slot === 'Shield' && String(it.rarity).toLowerCase() === 'grey') {
        it.skill1 = 'ESK-SHD-FORTIFY';
      }
    }
  });
  console.log('Patched items.js Grey armour/shield defence skills');

  /* Six visible slots — collapse anklet L/R into anklets pair */
  patchJsonLiteralFile(path.join(ROOT, 'js/data/equipment/slots.js'), (slots) => {
    slots.slotOrder = ['helmet', 'armour', 'mainHand', 'offHand', 'anklets', 'necklace'];
    const prev = slots.slots || {};
    slots.slots = {
      helmet: prev.helmet || {
        label: 'Headgear', accepts: 'Helmet', handCapacity: 0,
        activeContribution: 'Passive only', duplicateAllowed: false, budgetClass: 'Helmet',
        notes: 'Precision, Guard/Resolve and resistance.',
      },
      armour: {
        ...(prev.armour || {}),
        label: 'Plumage',
        accepts: 'Armour',
        activeContribution: 'Yes: one defence action from Grey',
        notes: 'Primary Armour/Magic Armour source (~70% of worn pools).',
      },
      mainHand: {
        ...(prev.mainHand || {}),
        notes: 'Weapon range + Techniques A/B. Starters grant full family kits.',
      },
      offHand: {
        ...(prev.offHand || {}),
        notes: 'Second 1H weapon, Shield or Orb. At most one replacement/defence action.',
      },
      anklets: {
        label: 'Anklets (pair)',
        accepts: 'Anklet',
        handCapacity: 0,
        activeContribution: 'Passive only',
        duplicateAllowed: false,
        budgetClass: 'Anklet',
        notes: 'Collapsed pair slot — Agility, Dodge and mobility (~10% protection).',
      },
      necklace: prev.necklace || {
        label: 'Necklace', accepts: 'Necklace', handCapacity: 0,
        activeContribution: 'Passive or replaces Bird Utility', duplicateAllowed: false,
        budgetClass: 'Necklace', notes: 'Affinity, ailment and build conversion.',
      },
    };
    slots.wholeLoadoutBudgets = {
      grey: { flatCore: 6, lightProtection: 20, balancedProtection: 28, heavyProtection: 36 },
      green: { flatCore: 9, lightProtection: 24, balancedProtection: 34, heavyProtection: 43 },
      blue: { flatCore: 12, lightProtection: 29, balancedProtection: 41, heavyProtection: 52 },
      purple: { flatCore: 16, lightProtection: 35, balancedProtection: 49, heavyProtection: 62 },
      gold: { flatCore: 20, lightProtection: 42, balancedProtection: 59, heavyProtection: 74 },
      orange: { flatCore: 24, lightProtection: 50, balancedProtection: 70, heavyProtection: 88 },
    };
    slots.packVersion = '2026.09-combat-v2.1';
  });
  console.log('Patched slots.js — 6 slots (anklets pair)');

  patchJsonLiteralFile(path.join(ROOT, 'js/data/equipment/reference-loadouts.js'), (rows) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (!row || !row.equipment) continue;
      const eq = row.equipment;
      const pair = eq.ankletL || eq.ankletR || null;
      eq.anklets = pair;
      delete eq.ankletL;
      delete eq.ankletR;
    }
  });
  console.log('Patched reference-loadouts.js anklets');

  /* Story: no hidden damage/stat multipliers — difficulty via gear completeness + AI */
  patchJsonLiteralFile(path.join(ROOT, 'js/data/enemy-scaling-profiles.js'), (pack) => {
    const p = pack.profiles || pack;
    if (p.story) {
      p.story.vitalityMult = 1;
      p.story.offenceMult = 1;
      p.story.defenceMult = 1;
      p.story.agilityMult = 1;
      p.story.equipmentRarityOffset = -1;
      p.story.equipmentCompleteness = [0.75, 0.85];
      p.story.aiEfficiency = [0.7, 0.8];
      p.story.equipmentPolicy = '75–85% complete worn/basic named kit; one rarity below when available';
      p.story.aiPolicy = '70–80% AP efficiency; may leave 1 AP or miss a setup';
      p.story.hiddenMultipliers = 'None';
      p.story.status = 'Prototype';
      p.story.packNote = 'Combat Workbook v2.1 Enemy & AI';
    }
    if (p.standard) {
      p.standard.vitalityMult = 1;
      p.standard.offenceMult = 1;
      p.standard.defenceMult = 1;
      p.standard.agilityMult = 1;
      p.standard.hiddenMultipliers = 'None';
      p.standard.status = 'Locked';
    }
    pack.packVersion = '2026.09-combat-v2.1';
  });
  console.log('Patched enemy-scaling-profiles.js (no Story hidden mults)');

  /* Barn Owl → birds.js class/passive */
  const birdsJsPath = path.join(ROOT, 'js/data/birds.js');
  let birdsJs = readFileSync(birdsJsPath, 'utf8');
  if (/barnowl:\s*\{[\s\S]*?class:\s*"mage"/.test(birdsJs)) {
    birdsJs = birdsJs.replace(
      /(barnowl:\s*\{[\s\S]*?class:\s*)"mage"/,
      '$1"rogue"',
    );
  }
  birdsJs = birdsJs.replace(
    /passive:\{id:"PAS-040",name:"Rafter-Moon Judgement",desc:"[^"]*"\}/,
    'passive:{id:"PAS-040",name:"Silent Approach",desc:"Your first Finesse hit against a target that has not acted ignores 4 Guard and gains +10 Precision."}',
  );
  /* class kit / perk text if present as mage-only — leave perk for later species pass */
  writeFileSync(birdsJsPath, birdsJs);
  console.log('Patched js/data/birds.js Barn Owl → Rogue');

  console.log('\n[import-combat-workbook-v21] done');
}

main();
