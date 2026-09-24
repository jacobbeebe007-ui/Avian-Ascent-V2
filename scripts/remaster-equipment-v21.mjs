#!/usr/bin/env node
/**
 * Equipment & skill remaster for Combat Foundation v2.1 Health.
 *
 * Rewrites protection flats onto the workbook loadout budgets, grants Grey
 * defence actions, remasters restore/Fortify/Ward riders, adds four plumage
 * sets plus Focus Ward Orbs and new accessories, and refreshes bird HP caches.
 *
 * Run: node scripts/remaster-equipment-v21.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = '2026.09-combat-v2.1-equipment-remaster';

const RARITY_ORDER = ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
const RARITY_PREFIX = {
  grey: '',
  green: 'Sturdy ',
  blue: 'Tempered ',
  purple: 'Masterwork ',
  gold: 'Regal ',
  orange: 'Mythic ',
};

const LOADOUT = {
  grey: { light: 20, balanced: 28, heavy: 36 },
  green: { light: 24, balanced: 34, heavy: 43 },
  blue: { light: 29, balanced: 41, heavy: 52 },
  purple: { light: 35, balanced: 49, heavy: 62 },
  gold: { light: 42, balanced: 59, heavy: 74 },
  orange: { light: 50, balanced: 70, heavy: 88 },
};

const PIECE_BUDGET = {
  grey: { armour: 25, helmet: 7, shield: 9, anklet: 2 },
  green: { armour: 30, helmet: 9, shield: 11, anklet: 2 },
  blue: { armour: 36, helmet: 10, shield: 13, anklet: 3 },
  purple: { armour: 43, helmet: 12, shield: 16, anklet: 3 },
  gold: { armour: 52, helmet: 15, shield: 19, anklet: 4 },
  orange: { armour: 62, helmet: 18, shield: 22, anklet: 4 },
};

const WEIGHT_KEY = { Light: 'light', Medium: 'balanced', Heavy: 'heavy', light: 'light', medium: 'balanced', heavy: 'heavy' };

const SIZE_BASE = {
  Tiny: 125, Small: 128, Medium: 131, Large: 134,
  'Very Large': 137, Giant: 140, 'Boss Override': 150,
};

const NEW_SETS = [
  {
    name: 'Tempestweave',
    weight: 'Medium',
    split: '20% Armour / 80% Magic Armour',
    bestSuited: 'Mage, Siren, Storm Bard',
    primaryStats: 'Focus, Resolve, Agility',
    armourName: 'Tempestweave Mantle',
    helmetName: 'Stormcrest Circlet',
    shieldName: 'Thunder Ward',
    twoPiece: 'While Magic Armour remains, gain +3 Focus.',
    threePiece: 'First time Magic Armour is depleted each combat, restore 8 Magic Armour.',
    identity: 'Storm-threaded plumage that leans into Magic Armour.',
    restore: { id: 'ESK-065', name: 'Storm Mend', kind: 'restoreMagicArmour' },
    surge: { id: 'ESK-066', name: 'Tempest Ward', kind: 'ward' },
  },
  {
    name: 'Maris Tideplate',
    weight: 'Medium',
    split: '50% Armour / 50% Magic Armour',
    bestSuited: 'Siren, Bard, hybrid Inquisitor',
    primaryStats: 'Vitality, Resolve, Guard',
    armourName: 'Tideplate Plumage',
    helmetName: 'Tidehelm',
    shieldName: 'Reef Shield',
    twoPiece: 'Begin combat with +4 Maximum Armour and +4 Maximum Magic Armour.',
    threePiece: 'Once per combat when either protection pool is depleted, restore 5 to both pools.',
    identity: 'Water-laced plates that keep both pools honest.',
    restore: { id: 'ESK-067', name: 'Tide Rebalance', kind: 'restoreLowerPool' },
    surge: { id: 'ESK-068', name: 'Reef Bastion', kind: 'bastion' },
  },
  {
    name: 'Solis Mail',
    weight: 'Heavy',
    split: '80% Armour / 20% Magic Armour',
    bestSuited: 'Knight, Inquisitor, Brute',
    primaryStats: 'Guard, Vitality, Might',
    armourName: 'Solis Mail Harness',
    helmetName: 'Sunplate Helm',
    shieldName: 'Solar Bastion',
    twoPiece: 'While Armour remains, gain +3 Guard.',
    threePiece: 'First time Armour is depleted each combat, restore 8 Armour.',
    identity: 'Day-forged heavy mail built to hold the line.',
    restore: { id: 'ESK-069', name: 'Solar Brace', kind: 'restoreArmour' },
    surge: { id: 'ESK-070', name: 'Sun Fortify', kind: 'fortify' },
  },
  {
    name: 'Aeris Silk',
    weight: 'Light',
    split: '35% Armour / 65% Magic Armour',
    bestSuited: 'Rogue, Mage, Sky Bard',
    primaryStats: 'Agility, Dexterity, Resolve',
    armourName: 'Aeris Silk Vest',
    helmetName: 'Windveil Hood',
    shieldName: 'Gale Buckler',
    twoPiece: 'While both protection pools remain above zero, gain +3 Agility.',
    threePiece: 'First successful Dodge each combat restores 5 to the lower protection pool.',
    identity: 'Sky-light silk that trades mass for tempo.',
    restore: { id: 'ESK-071', name: 'Featherstep Silk', kind: 'restoreLowerPool' },
    surge: { id: 'ESK-072', name: 'Gale Ward', kind: 'ward' },
  },
];

function loadAvian(files) {
  const sandbox = { globalThis: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of files) {
    vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.Avian;
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function writeDataFile(relPath, namespaceExpr, data, note) {
  const abs = path.join(ROOT, relPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  const lines = [
    `/* GENERATED by scripts/remaster-equipment-v21.mjs — do not edit by hand.`,
    ` * Source: Avian_Ascent_Current_Master_v2.1.xlsx equipment remaster`,
    ` * Pack: ${PACK}`,
  ];
  if (note) lines.push(` * ${note}`);
  lines.push(
    ` */`,
    `(function () {`,
    `  'use strict';`,
    `  var Avian = globalThis.Avian || (globalThis.Avian = {});`,
    `  Avian.data = Avian.data || Object.create(null);`,
  );
  if (namespaceExpr.startsWith('Avian.data.equipment')) {
    lines.push('  Avian.data.equipment = Avian.data.equipment || Object.create(null);');
  }
  if (namespaceExpr.startsWith('Avian.data.combatPack')) {
    lines.push('  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);');
  }
  lines.push(
    `  ${namespaceExpr} = Object.freeze(${JSON.stringify(data)});`,
    `})();`,
    ``,
  );
  writeFileSync(abs, lines.join('\n'));
  console.log('wrote', relPath);
}

function parseSplit(text) {
  const m = String(text || '').match(/(\d+)\s*%\s*Armour\s*\/\s*(\d+)\s*%\s*Magic Armour/i);
  if (!m) return { armour: 0.5, magic: 0.5 };
  return { armour: Number(m[1]) / 100, magic: Number(m[2]) / 100 };
}

function splitPools(total, split) {
  const armour = Math.round(total * split.armour);
  const magic = Math.max(0, total - armour);
  return { armour, magic };
}

function scaleRestore(n) {
  const v = Number(n) || 0;
  if (v <= 0) return 0;
  return Math.max(8, Math.min(14, Math.round(v * 2.5)));
}

function scaleFortify(n) {
  const v = Number(n) || 0;
  if (v <= 0) return 0;
  return Math.max(16, Math.min(30, Math.round(v * 2.5)));
}

function scalePoolChip(n) {
  const v = Number(n) || 0;
  if (v <= 0) return 0;
  return Math.max(5, Math.min(16, Math.round(v * 2.5)));
}

function remasterRider(rider) {
  if (!rider || !rider.kind) return rider;
  const r = { ...rider };
  /* Already remastered riders keep Health-band values. */
  const current = Number(r.value != null ? r.value : r.amount);
  if ((r.kind === 'restoreArmour' || r.kind === 'restoreMagicArmour' || r.kind === 'restoreLowerPool') && current >= 8) return r;
  if ((r.kind === 'fortify' || r.kind === 'ward') && current >= 16) return r;
  if (r.kind === 'bastion' && (Number(r.armour) >= 8 || Number(r.magicArmour) >= 8)) return r;
  if (r.kind === 'restoreArmour' || r.kind === 'restoreMagicArmour' || r.kind === 'restoreLowerPool') {
    if (r.value != null) r.value = scaleRestore(r.value);
    if (r.amount != null) r.amount = scaleRestore(r.amount);
  } else if (r.kind === 'fortify' || r.kind === 'ward') {
    if (r.value != null) r.value = scaleFortify(r.value);
    if (r.amount != null) r.amount = scaleFortify(r.amount);
    r.turns = r.turns || 2;
  } else if (r.kind === 'bastion') {
    if (r.armour != null) r.armour = scaleFortify(r.armour) / 2 > 8 ? Math.round(scaleFortify(r.armour) / 2) : scaleRestore(r.armour);
    if (r.magicArmour != null) r.magicArmour = scaleFortify(r.magicArmour) / 2 > 8 ? Math.round(scaleFortify(r.magicArmour) / 2) : scaleRestore(r.magicArmour);
    if (r.value != null) r.value = scaleRestore(r.value);
    r.turns = r.turns || 2;
  }
  return r;
}

function rewriteRiderText(text, riders) {
  let t = String(text || '');
  for (const r of riders || []) {
    if (!r) continue;
    if (r.kind === 'restoreArmour') t = t.replace(/Restore \d+ Armour/i, `Restore ${r.value} Armour`);
    if (r.kind === 'restoreMagicArmour') t = t.replace(/Restore \d+ Magic Armour/i, `Restore ${r.value} Magic Armour`);
    if (r.kind === 'restoreLowerPool') t = t.replace(/restore \d+(?: to the lower protection pool)?/i, `restore ${r.value} to the lower protection pool`);
    if (r.kind === 'fortify') {
      t = t.replace(/Gain \d+ Fortified Armour \(add \d+ to current Armour and temporary Maximum Armour\)/i,
        `Gain ${r.value} Fortified Armour (add ${r.value} to current Armour and temporary Maximum Armour)`);
      t = t.replace(/Gain \d+ Fortified Armour/i, `Gain ${r.value} Fortified Armour`);
    }
    if (r.kind === 'ward') {
      t = t.replace(/Gain \d+ Ward Magic Armour \(add \d+ to current Magic Armour and temporary Maximum Magic Armour\)/i,
        `Gain ${r.value} Ward Magic Armour (add ${r.value} to current Magic Armour and temporary Maximum Magic Armour)`);
      t = t.replace(/Gain \d+ Ward Magic Armour/i, `Gain ${r.value} Ward Magic Armour`);
    }
    if (r.kind === 'bastion') {
      t = t.replace(/(\d+) Armour and (\d+) Magic Armour/, `${r.armour} Armour and ${r.magicArmour} Magic Armour`);
      t = t.replace(
        /Gain \d+ Fortified Armour \(add \d+ to current Armour and temporary Maximum Armour\) and \d+ Ward Magic Armour \(add \d+ to current Magic Armour and temporary Maximum Magic Armour\)/i,
        `Gain ${r.armour} Fortified Armour (add ${r.armour} to current Armour and temporary Maximum Armour) and ${r.magicArmour} Ward Magic Armour (add ${r.magicArmour} to current Magic Armour and temporary Maximum Magic Armour)`
      );
    }
  }
  return t;
}

function makeDefenceSkill(id, name, kind, opts = {}) {
  const restoreVal = opts.restore != null ? opts.restore : 10;
  const fortVal = opts.fortify != null ? opts.fortify : 20;
  const isFortify = kind === 'fortify' || kind === 'ward' || kind === 'bastion';
  const en = isFortify ? 4 : 2;
  let riders = [];
  let riderText = '';
  if (kind === 'restoreArmour') {
    riders = [{ kind: 'restoreArmour', value: restoreVal }];
    riderText = `Restore ${restoreVal} Armour, capped at normal Maximum Armour.`;
  } else if (kind === 'restoreMagicArmour') {
    riders = [{ kind: 'restoreMagicArmour', value: restoreVal }];
    riderText = `Restore ${restoreVal} Magic Armour, capped at normal Maximum Magic Armour.`;
  } else if (kind === 'restoreLowerPool') {
    riders = [{ kind: 'restoreLowerPool', value: restoreVal }];
    riderText = `Restore ${restoreVal} to the lower protection pool, capped at its normal maximum.`;
  } else if (kind === 'fortify') {
    riders = [{ kind: 'fortify', value: fortVal, turns: 2 }];
    riderText = `Gain ${fortVal} Fortified Armour (add ${fortVal} to current Armour and temporary Maximum Armour) for 2 turns.`;
  } else if (kind === 'ward') {
    riders = [{ kind: 'ward', value: fortVal, turns: 2 }];
    riderText = `Gain ${fortVal} Ward Magic Armour (add ${fortVal} to current Magic Armour and temporary Maximum Magic Armour) for 2 turns.`;
  } else if (kind === 'bastion') {
    const half = Math.round(fortVal / 2);
    riders = [{ kind: 'bastion', armour: half, magicArmour: half, turns: 2, value: half }];
    riderText = `Gain ${half} Fortified Armour and ${half} Ward Magic Armour for 2 turns.`;
  }
  return {
    id,
    name,
    source: 'Equipment',
    family: opts.family || 'Defensive Set',
    barSlot: 'Defence',
    skillType: 'Utility',
    en,
    cooldown: 0,
    meter: 0,
    target: 'Self',
    damageType: null,
    damageCategory: null,
    scalingStat: null,
    aspectRule: 'none',
    hits: 0,
    skillPowerPct: 0,
    skillPower: 0,
    riderText,
    riders,
    minRarity: 'grey',
  };
}

function scaleRestoreSafe(n) {
  const v = Number(n) || 0;
  if (v >= 8) return v;
  return scaleRestore(v);
}

function scaleFortifySafe(n) {
  const v = Number(n) || 0;
  if (v >= 16) return v;
  return scaleFortify(v);
}

function scalePoolChipSafe(n) {
  const v = Number(n) || 0;
  if (v >= 5) return v;
  return scalePoolChip(v);
}

function scaleProse(text) {
  if (!text) return text;
  return String(text)
    .replace(/Restore (\d+) Armour and (\d+) Magic Armour/gi, (_, a, b) => `Restore ${scaleRestoreSafe(a)} Armour and ${scaleRestoreSafe(b)} Magic Armour`)
    .replace(/restore (\d+) Armour and (\d+) Magic Armour/gi, (_, a, b) => `restore ${scaleRestoreSafe(a)} Armour and ${scaleRestoreSafe(b)} Magic Armour`)
    .replace(/Restore (\d+) Armour/gi, (_, n) => `Restore ${scaleRestoreSafe(n)} Armour`)
    .replace(/restore (\d+) Armour/gi, (_, n) => `restore ${scaleRestoreSafe(n)} Armour`)
    .replace(/Restore (\d+) Magic Armour/gi, (_, n) => `Restore ${scaleRestoreSafe(n)} Magic Armour`)
    .replace(/restore (\d+) Magic Armour/gi, (_, n) => `restore ${scaleRestoreSafe(n)} Magic Armour`)
    .replace(/restore (\d+) to both pools/gi, (_, n) => `restore ${scaleRestoreSafe(n)} to both pools`)
    .replace(/restore (\d+) to the lower protection pool/gi, (_, n) => `restore ${scaleRestoreSafe(n)} to the lower protection pool`)
    .replace(/restore (\d+) to the protection pool/gi, (_, n) => `restore ${scaleRestoreSafe(n)} to the protection pool`)
    .replace(/Gain (\d+) Fortified Armour and (\d+) Ward Magic Armour/gi, (_, a, b) => `Gain ${scaleFortifySafe(a)} Fortified Armour and ${scaleFortifySafe(b)} Ward Magic Armour`)
    .replace(/Gain (\d+) Fortified Armour/gi, (_, n) => `Gain ${scaleFortifySafe(n)} Fortified Armour`)
    .replace(/Gain (\d+) Ward Magic Armour/gi, (_, n) => `Gain ${scaleFortifySafe(n)} Ward Magic Armour`)
    .replace(/Deal (\d+) Armour damage/gi, (_, n) => `Deal ${scalePoolChipSafe(n)} Armour damage`)
    .replace(/Deal (\d+) Magic Armour damage/gi, (_, n) => `Deal ${scalePoolChipSafe(n)} Magic Armour damage`)
    .replace(/restores (\d+) Armour/gi, (_, n) => `restores ${scaleRestoreSafe(n)} Armour`)
    .replace(/restores (\d+) Magic Armour/gi, (_, n) => `restores ${scaleRestoreSafe(n)} Magic Armour`)
    .replace(/restores? (\d+) to the lower/gi, (_, n) => `restore ${scaleRestoreSafe(n)} to the lower`)
    .replace(/\+(\d+) Maximum Armour and \+(\d+) Maximum Magic Armour/gi, (_, a, b) => `+${scaleRestoreSafe(a)} Maximum Armour and +${scaleRestoreSafe(b)} Maximum Magic Armour`);
}

function scaleParsedTree(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(scaleParsedTree);
  const out = { ...node };
  const kind = String(out.kind || '');
  const restoreIds = ['restoreArmour', 'restoreMagicArmour', 'restoreLowerPool', 'restoreLowerProtection', 'restoreProtection'];
  if (restoreIds.includes(kind) || restoreIds.includes(String(out.id || ''))) {
    if (out.amount != null) out.amount = scaleRestoreSafe(out.amount);
    if (out.value != null) out.value = scaleRestoreSafe(out.value);
  }
  if (kind === 'fortify' || kind === 'ward' || kind === 'bastion'
    || out.id === 'fortify' || out.id === 'ward' || out.id === 'bastion') {
    if (out.amount != null) out.amount = scaleFortifySafe(out.amount);
    if (out.value != null) out.value = scaleFortifySafe(out.value);
    if (out.armour != null) out.armour = scaleRestoreSafe(out.armour);
    if (out.magicArmour != null) out.magicArmour = scaleRestoreSafe(out.magicArmour);
  }
  if (kind === 'poolDamage' || kind === 'armourDamage' || kind === 'magicArmourDamage'
    || out.id === 'poolDamage' || out.id === 'armourDamage' || out.id === 'magicArmourDamage') {
    if (out.amount != null) out.amount = scalePoolChipSafe(out.amount);
    if (out.value != null) out.value = scalePoolChipSafe(out.value);
  }
  for (const key of Object.keys(out)) {
    if (out[key] && typeof out[key] === 'object') out[key] = scaleParsedTree(out[key]);
  }
  return out;
}

function nextId(prefix, existing, start) {
  let n = start;
  while (existing[`${prefix}-${String(n).padStart(3, '0')}`]) n += 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

function applyProtectionToItem(item, setBonuses, families) {
  const slot = item.slot;
  if (!['Armour', 'Helmet', 'Shield', 'Anklet'].includes(slot)) return;
  const rarity = item.rarity;
  const budget = PIECE_BUDGET[rarity];
  if (!budget) return;
  const set = setBonuses[item.family] || setBonuses[item.set] || null;
  const fam = families[item.family] || {};
  const weight = WEIGHT_KEY[set && set.weight] || WEIGHT_KEY[fam.weight] || (
    /shadowplume|fleetstep|aeris|crystalwind/i.test(item.family) ? 'light'
      : /ironfeather|solis|ironspur/i.test(item.family) ? 'heavy'
        : 'balanced'
  );
  const loadout = LOADOUT[rarity][weight];
  let total;
  if (slot === 'Armour') total = Math.round(loadout * 0.70);
  else if (slot === 'Helmet') total = Math.round(loadout * 0.20);
  else if (slot === 'Shield') total = Math.round(loadout * 0.25);
  else total = Math.round(loadout * 0.05);

  let split = set ? parseSplit(set.protectionSplit) : { armour: 0.5, magic: 0.5 };
  if (slot === 'Anklet') {
    if (/ironspur|stoneband/i.test(item.family)) split = { armour: 0.8, magic: 0.2 };
    else if (/runeclasp|galeband/i.test(item.family)) split = { armour: 0.2, magic: 0.8 };
    else if (/heartloop/i.test(item.family)) split = { armour: 0.5, magic: 0.5 };
    else split = { armour: 0.4, magic: 0.6 };
  }
  const pools = splitPools(total, split);
  item.stats = item.stats || {};
  if (pools.armour > 0) item.stats.armourFlat = pools.armour;
  else delete item.stats.armourFlat;
  if (pools.magic > 0) item.stats.magicArmourFlat = pools.magic;
  else delete item.stats.magicArmourFlat;
}

const Avian = loadAvian([
  'js/data/equipment/items.js',
  'js/data/equipment/skills.js',
  'js/data/equipment/families.js',
  'js/data/equipment/set-bonuses.js',
  'js/data/equipment/core-rules.js',
  'js/data/equipment/slots.js',
  'js/data/equipment/reference-loadouts.js',
  'js/data/birds-v2.js',
  'js/data/combat-pack/innate-utilities.js',
  'js/data/combat-pack/bird-passives.js',
]);

const items = clone(Avian.data.equipment.items);
const skills = clone(Avian.data.equipment.skills);
const families = clone(Avian.data.equipment.families);
const setBonuses = clone(Avian.data.equipment.setBonuses);
const coreRules = clone(Avian.data.equipment.coreRules);
const slots = clone(Avian.data.equipment.slots);
const loadouts = clone(Avian.data.equipment.referenceLoadouts);
const birds = clone(Avian.data.birdsV2);
const utilities = clone(Avian.data.combatPack.innateUtilities);
const passives = clone(Avian.data.combatPack.birdPassives);

/* --- remaster existing skills --- */
for (const skill of Object.values(skills)) {
  if (!skill.riders || !skill.riders.length) continue;
  const isProt = skill.riders.some((r) => r && /restore|fortify|ward|bastion/i.test(r.kind || ''));
  if (!isProt) continue;
  skill.riders = skill.riders.map(remasterRider);
  if (Array.isArray(skill.protectionRiders)) {
    skill.protectionRiders = skill.riders.map((r) => ({ ...r }));
  }
  skill.riderText = rewriteRiderText(skill.riderText, skill.riders);
  if (skill.riders.some((r) => r && (r.kind === 'fortify' || r.kind === 'ward' || r.kind === 'bastion'))) {
    skill.en = 4;
    skill.cooldown = 0;
  } else {
    skill.en = skill.en && skill.en > 2 ? 2 : (skill.en || 2);
    skill.cooldown = 0;
  }
}

/* --- Grey defence actions: plumage restore, shield Fortify/Ward --- */
const familyBySlot = Object.create(null);
for (const it of Object.values(items)) {
  if (!['Armour', 'Helmet', 'Shield'].includes(it.slot)) continue;
  const key = `${it.family}|${it.slot}`;
  familyBySlot[key] = familyBySlot[key] || {};
  familyBySlot[key][it.rarity] = it;
}
for (const group of Object.values(familyBySlot)) {
  const grey = group.grey;
  const green = group.green;
  const purple = group.purple;
  if (!grey) continue;
  if (grey.slot === 'Armour') {
    grey.skill1 = (green && green.skill1) || grey.skill1;
  } else if (grey.slot === 'Shield') {
    const surge = (purple && purple.skill1) || (green && green.skill1);
    grey.skill1 = surge || grey.skill1;
  }
}

/* --- apply new pool budgets to existing gear --- */
for (const it of Object.values(items)) {
  applyProtectionToItem(it, setBonuses, families);
}

/* --- set bonus restore prose --- */
for (const set of Object.values(setBonuses)) {
  set.twoPiece = scaleProse(set.twoPiece);
  set.threePiece = scaleProse(set.threePiece);
}

/* --- new defence skills --- */
if (!skills['ESK-065']) {
  for (const set of NEW_SETS) {
    skills[set.restore.id] = makeDefenceSkill(set.restore.id, set.restore.name, set.restore.kind, { family: set.name });
    skills[set.surge.id] = makeDefenceSkill(set.surge.id, set.surge.name, set.surge.kind, { family: set.name });
  }
  skills['ESK-073'] = makeDefenceSkill('ESK-073', 'Orb Ward', 'ward', { family: 'Focus Ward Orb' });
  skills['ESK-074'] = makeDefenceSkill('ESK-074', 'Stoneband Brace', 'restoreArmour', { family: 'Stoneband Anklet' });
  skills['ESK-075'] = makeDefenceSkill('ESK-075', 'Galeband Mend', 'restoreMagicArmour', { family: 'Galeband Anklet' });
  skills['ESK-076'] = makeDefenceSkill('ESK-076', 'Warden Pulse', 'restoreLowerPool', { family: 'Warden Torque' });
  skills['ESK-077'] = makeDefenceSkill('ESK-077', 'Aspect Aegis', 'bastion', { family: 'Aspect Charm' });
}

/* --- new set bonuses + families --- */
for (const set of NEW_SETS) {
  setBonuses[set.name] = {
    name: set.name,
    weight: set.weight,
    protectionSplit: set.split,
    bestSuited: set.bestSuited,
    primaryStats: set.primaryStats,
    armourPiece: set.armourName,
    helmet: set.helmetName,
    shield: set.shieldName,
    twoPiece: set.twoPiece,
    threePiece: set.threePiece,
  };
  families[set.name] = {
    name: set.name,
    slot: 'Armour',
    catalogueGroup: 'defensive',
    weight: set.weight,
    protectionIdentity: set.split,
    identity: set.identity,
  };
}

families['Focus Ward Orb'] = {
  name: 'Focus Ward Orb',
  slot: 'Shield',
  catalogueGroup: 'offhand',
  weight: 'Light',
  protectionIdentity: '15% Armour / 85% Magic Armour',
  identity: 'Off-hand focus that grants Ward from Grey.',
};
families['Stoneband Anklet'] = {
  name: 'Stoneband Anklet', slot: 'Anklet', catalogueGroup: 'accessory', weight: 'Heavy',
  identity: 'Heavy anklet that contributes Armour to the worn pool.',
};
families['Galeband Anklet'] = {
  name: 'Galeband Anklet', slot: 'Anklet', catalogueGroup: 'accessory', weight: 'Light',
  identity: 'Light anklet that contributes Magic Armour to the worn pool.',
};
families['Warden Torque'] = {
  name: 'Warden Torque', slot: 'Necklace', catalogueGroup: 'accessory',
  identity: 'Necklace that can replace a bird utility with a restore pulse.',
};
families['Aspect Charm'] = {
  name: 'Aspect Charm', slot: 'Necklace', catalogueGroup: 'accessory',
  identity: 'Affinity charm that can raise a small dual protection surge.',
};

function makeGearItem(id, slot, family, rarity, baseName, extras) {
  extras = extras || {};
  return {
    id,
    name: `${RARITY_PREFIX[rarity]}${baseName}`,
    slot,
    subtype: slot,
    family,
    set: extras.set || (slot === 'Anklet' || slot === 'Necklace' ? null : family),
    rarity,
    rank: RARITY_ORDER.indexOf(rarity) + 1,
    hands: extras.hands != null ? extras.hands : 0,
    natural: false,
    isBasicStartingWeapon: false,
    weight: extras.weight || null,
    budgetClass: extras.budgetClass || slot,
    classRestriction: extras.classRestriction || null,
    preferredClasses: extras.preferredClasses || '',
    aspect: extras.aspect || 'neutral',
    skill1: extras.skill1 || null,
    skill2: extras.skill2 || null,
    pairedSkill: null,
    ultimate: null,
    damageType: extras.damageType || null,
    damageCategory: extras.damageCategory || null,
    scalingStat: extras.scalingStat || null,
    minDamage: extras.minDamage != null ? extras.minDamage : null,
    maxDamage: extras.maxDamage != null ? extras.maxDamage : null,
    flatCoreText: '',
    secondaryText: '',
    bonuses: [],
    uniqueEffect: rarity === 'orange' ? (extras.uniqueEffect || 'Named remaster interaction; does not multiply action coefficients.') : null,
    tradeoff: extras.tradeoff || null,
    stats: extras.stats || {},
    identity: extras.identity || '',
    notes: 'v2.1 remaster: protection uses Health-band loadout budgets. Grey grants the defence action.',
    npcEligible: true,
    audit: 'PASS',
  };
}

let armN = 49;
let hlmN = 49;
let shdN = 49;
if (!items['ARM-049']) {
for (const set of NEW_SETS) {
  for (const rarity of RARITY_ORDER) {
    const restoreSkill = (rarity === 'grey' || rarity === 'green' || rarity === 'blue') ? set.restore.id : set.surge.id;
    const surgeSkill = set.surge.id;
    const arm = makeGearItem(`ARM-${String(armN).padStart(3, '0')}`, 'Armour', set.name, rarity, set.armourName, {
      skill1: restoreSkill,
      stats: { hpFlat: rarity === 'grey' ? 0 : 1 },
      identity: set.identity,
      uniqueEffect: `Once per combat, ${set.name} restores a Health-band protection packet.`,
    });
    const hlm = makeGearItem(`HLM-${String(hlmN).padStart(3, '0')}`, 'Helmet', set.name, rarity, set.helmetName, {
      identity: set.identity,
    });
    const shd = makeGearItem(`SHD-${String(shdN).padStart(3, '0')}`, 'Shield', set.name, rarity, set.shieldName, {
      skill1: surgeSkill,
      identity: set.identity,
    });
    applyProtectionToItem(arm, setBonuses, families);
    applyProtectionToItem(hlm, setBonuses, families);
    applyProtectionToItem(shd, setBonuses, families);
    items[arm.id] = arm;
    items[hlm.id] = hlm;
    items[shd.id] = shd;
    armN += 1;
    hlmN += 1;
    shdN += 1;
  }
}

for (let i = 0; i < RARITY_ORDER.length; i++) {
  const rarity = RARITY_ORDER[i];
  const id = `ORB-${String(i + 1).padStart(3, '0')}`;
  const orb = makeGearItem(id, 'Shield', 'Focus Ward Orb', rarity, 'Focus Ward Orb', {
    skill1: 'ESK-073',
    budgetClass: 'Shield',
    identity: 'Off-hand focus. Grants Ward from Grey.',
    uniqueEffect: 'Ward amount follows the v2.1 Health-band Fortify/Ward budget.',
    stats: {},
  });
  applyProtectionToItem(orb, { 'Focus Ward Orb': { weight: 'Light', protectionSplit: '15% Armour / 85% Magic Armour' } }, families);
  items[orb.id] = orb;
}

const ACC_DEFS = [
  { family: 'Stoneband Anklet', slot: 'Anklet', base: 'Stoneband Anklet', skill: 'ESK-074', start: 49 },
  { family: 'Galeband Anklet', slot: 'Anklet', base: 'Galeband Anklet', skill: 'ESK-075', start: 55 },
  { family: 'Warden Torque', slot: 'Necklace', base: 'Warden Torque', skill: 'ESK-076', start: 61 },
  { family: 'Aspect Charm', slot: 'Necklace', base: 'Aspect Charm', skill: 'ESK-077', start: 67 },
];
for (const def of ACC_DEFS) {
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    const rarity = RARITY_ORDER[i];
    const id = `ACC-${String(def.start + i).padStart(3, '0')}`;
    const it = makeGearItem(id, def.slot, def.family, rarity, def.base, {
      skill1: rarity === 'grey' || def.slot === 'Necklace' ? def.skill : def.skill,
      stats: def.slot === 'Necklace' ? { mdefFlat: 1 } : { spdFlat: /gale/i.test(def.family) ? 1 : 0, defFlat: /stone/i.test(def.family) ? 1 : 0 },
      identity: families[def.family].identity,
    });
    applyProtectionToItem(it, setBonuses, families);
    items[it.id] = it;
  }
}
}

/* --- core rules + slot budgets --- */
coreRules.packVersion = PACK;
coreRules.armourRestoration = { en: 2, cooldown: 0, overflow: false };
coreRules.magicArmourRestoration = { en: 2, cooldown: 0, overflow: false };
coreRules.fortify = { en: 4, cooldown: 0, duration: 2, overflow: true };
coreRules.ward = { en: 4, cooldown: 0, duration: 2, overflow: true };
coreRules.bastionAegis = { en: 4, cooldown: 0, duration: 2, overflow: true };
coreRules.protectionBudgets = {
  armour: { grey: 25, green: 30, blue: 36, purple: 43, gold: 52, orange: 62 },
  helmet: { grey: 7, green: 9, blue: 10, purple: 12, gold: 15, orange: 18 },
  shield: { grey: 9, green: 11, blue: 13, purple: 16, gold: 19, orange: 22 },
  anklet: { grey: 2, green: 2, blue: 3, purple: 3, gold: 4, orange: 4 },
};
coreRules.loadoutProtection = LOADOUT;
coreRules.wornPoolShare = { plumage: 0.70, headgear: 0.20, anklets: 0.10, shieldExtra: 0.25 };
coreRules.restoreBudget = { rule: '≤35% of expected 3 AP incoming', grey: 10, orange: 14 };
coreRules.fortifyWardBudget = { rule: '≤75% of one expected enemy turn', grey: 16, orange: 30 };

for (const rarity of RARITY_ORDER) {
  const b = PIECE_BUDGET[rarity];
  slots.rarityBudgets[rarity].armour = b.armour;
  slots.rarityBudgets[rarity].helmet = b.helmet;
  slots.rarityBudgets[rarity].shield = b.shield;
  slots.rarityBudgets[rarity].anklet = b.anklet;
}
slots.slots.armour.notes = 'About 70% of worn Armour / Magic Armour. Grants a Grey defence action.';
slots.slots.helmet.notes = 'About 20% of worn pools. Passive only.';
slots.slots.offHand.notes = 'Accepts one-handed weapons, Shields, or Focus Ward Orbs. Shields grant Fortify; Orbs grant Ward from Grey.';
slots.slots.ankletL.notes = 'Pair shares about 10% of worn pools.';
slots.slots.ankletR.notes = 'Pair shares about 10% of worn pools.';

/* --- reference loadout totals --- */
for (const row of loadouts) {
  const totals = Object.create(null);
  const keys = ['hpFlat', 'atkFlat', 'dexFlat', 'defFlat', 'matkFlat', 'mdefFlat', 'spdFlat', 'armourFlat', 'magicArmourFlat'];
  for (const slotKey of Object.keys(row.equipment || {})) {
    const id = row.equipment[slotKey];
    const it = id ? items[id] : null;
    if (!it || !it.stats) continue;
    for (const k of keys) {
      const v = Number(it.stats[k]) || 0;
      if (v) totals[k] = (totals[k] || 0) + v;
    }
    if (it.stats.agilityPenalty) totals.spdFlat = (totals.spdFlat || 0) + Number(it.stats.agilityPenalty);
  }
  row.totals = totals;
}

/* --- bird HP cache --- */
function sizeBaseForBird(bird) {
  if (bird.bossOverride) return SIZE_BASE['Boss Override'];
  return SIZE_BASE[bird.realSize] || SIZE_BASE.Medium;
}
for (const bird of Object.values(birds)) {
  const hp = sizeBaseForBird(bird) + 5 * (Number(bird.vitality) || 0);
  bird.stats = bird.stats || {};
  bird.stats.hp = hp;
  bird.stats.maxHp = hp;
}

/* --- utilities + passives prose --- */
for (const row of Object.values(utilities)) {
  row.effect = scaleProse(row.effect);
  if (row.parsed) {
    row.parsed.text = scaleProse(row.parsed.text);
    row.parsed = scaleParsedTree(row.parsed);
  }
}
for (const row of Object.values(passives)) {
  row.effect = scaleProse(row.effect);
  if (row.parsed) {
    row.parsed.text = scaleProse(row.parsed.text);
    row.parsed = scaleParsedTree(row.parsed);
  }
}

writeDataFile('js/data/equipment/items.js', 'Avian.data.equipment.items', items, `${Object.keys(items).length} catalogue items`);
writeDataFile('js/data/equipment/skills.js', 'Avian.data.equipment.skills', skills, `${Object.keys(skills).length} skills`);
writeDataFile('js/data/equipment/families.js', 'Avian.data.equipment.families', families, `${Object.keys(families).length} families`);
writeDataFile('js/data/equipment/set-bonuses.js', 'Avian.data.equipment.setBonuses', setBonuses, `${Object.keys(setBonuses).length} defensive sets`);
writeDataFile('js/data/equipment/core-rules.js', 'Avian.data.equipment.coreRules', coreRules, 'v2.1 Health-band protection budgets');
writeDataFile('js/data/equipment/slots.js', 'Avian.data.equipment.slots', slots, '7-slot loadout; Shield/Orb via offHand');
writeDataFile('js/data/equipment/reference-loadouts.js', 'Avian.data.equipment.referenceLoadouts', loadouts, `${loadouts.length} class×rarity loadouts`);
writeDataFile('js/data/birds-v2.js', 'Avian.data.birdsV2', birds, 'HP cache = size base + 5×Vitality');
writeDataFile('js/data/combat-pack/innate-utilities.js', 'Avian.data.combatPack.innateUtilities', utilities, 'Fortify/Ward/restore remastered to Health band');
writeDataFile('js/data/combat-pack/bird-passives.js', 'Avian.data.combatPack.birdPassives', passives, 'Protection restore remastered to Health band');

const counts = {
  items: Object.keys(items).length,
  skills: Object.keys(skills).length,
  families: Object.keys(families).length,
  armour: Object.values(items).filter((i) => i.slot === 'Armour').length,
  greyArmourSkills: Object.values(items).filter((i) => i.slot === 'Armour' && i.rarity === 'grey' && i.skill1).length,
  greyShieldSkills: Object.values(items).filter((i) => i.slot === 'Shield' && i.rarity === 'grey' && i.skill1).length,
  sparrowHp: birds.sparrow.stats.maxHp,
};
console.log('remaster summary', JSON.stringify(counts));
