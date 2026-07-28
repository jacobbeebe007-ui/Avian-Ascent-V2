#!/usr/bin/env node
/**
 * Apply passive_perk_updates_v1 JSON → combat-pack bird-passives, innate-utilities,
 * classes, CLASS_PERK_CANON sync helpers, and birds.js passive/class perk text.
 *
 * Source: scripts/data/passive-perk-updates-v1.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const UPDATES = JSON.parse(readFileSync(path.join(__dirname, 'data', 'passive-perk-updates-v1.json'), 'utf8'));

const NAME_TO_KEY = {
  'Sparrow': 'sparrow', 'Hummingbird': 'hummingbird', 'Blackbird': 'blackbird', 'Macaw': 'macaw',
  'Peregrine Falcon': 'peregrine', 'Snowy Owl': 'snowyOwl', 'Kiwi': 'kiwi', 'Black Cockatoo': 'blackCockatoo',
  'Crow': 'crow', 'Kookaburra': 'kookaburra', 'Lyrebird': 'lyrebird', 'Raven': 'raven', 'Magpie': 'magpie',
  'Robin': 'robin', 'Bowerbird': 'bowerbird', 'Toucan': 'toucan', 'Swan': 'swan', 'Flamingo': 'flamingo',
  'Secretary Bird': 'secretary', 'Albatross': 'albatross', 'Seagull': 'seagull', 'Goose': 'goose',
  'Shoebill Stork': 'shoebill', 'Harpy Eagle': 'harpy', 'Bald Eagle': 'baldEagle',
  'Emperor Penguin': 'penguin', 'Ostrich': 'ostrich', 'Cassowary': 'cassowary', 'Emu': 'emu',
  'Duke Blakiston': 'dukeBlakiston', 'Wren': 'wren', 'Superb Fairywren': 'fairywren',
  'Firecrest': 'firecrest', 'Willie Wagtail': 'wagtail', 'Galah': 'galah', 'Blue Jay': 'bluejay',
  'Cardinal': 'cardinal', 'Bush Turkey': 'bushturkey', 'Vulture': 'vulture', 'Barn Owl': 'barnowl',
  'Bustard': 'bustard', 'Golden Eagle': 'goldeneagle', 'Australian Pelican': 'pelican',
  'Marabou Stork': 'marabou', 'Pigeon': 'pigeon', 'Rock Pigeon': 'rockPigeon', 'Dove': 'dove',
  'Rock Dove': 'rockDove', 'Kakapo': 'kakapo', 'Dodo': 'dodo', 'Chickadee': 'chickadee', 'Finch': 'finch',
};

const CLASS_ID = {
  Knight: 'knight', Rogue: 'rogue', Mage: 'mage', Siren: 'siren',
  Inquisitor: 'inquisitor', Bard: 'bard', Brute: 'brute', Duke: 'duke',
};

const failures = [];
function fail(m) { failures.push(m); console.error('[passive-perk] FAIL', m); }
function ok(m) { console.log('[passive-perk] OK', m); }

function extractFrozenObject(src, label) {
  const marker = 'Object.freeze(';
  const i = src.indexOf(marker);
  if (i < 0) { fail(`${label}: no Object.freeze`); return null; }
  const start = i + marker.length;
  let depth = 0;
  let end = -1;
  for (let p = start; p < src.length; p++) {
    if (src[p] === '{') depth++;
    else if (src[p] === '}') {
      depth--;
      if (depth === 0) { end = p + 1; break; }
    }
  }
  if (end < 0) { fail(`${label}: unbalanced`); return null; }
  return { start, end, obj: JSON.parse(src.slice(start, end)) };
}

function rewriteFrozen(file, label, mutate) {
  const src = readFileSync(file, 'utf8');
  const ex = extractFrozenObject(src, label);
  if (!ex) return;
  mutate(ex.obj);
  writeFileSync(file, src.slice(0, ex.start) + JSON.stringify(ex.obj) + src.slice(ex.end));
}

/** Best-effort structured parse for Nest/runtime — preserves text even when complex. */
function parsePassiveText(text, limitText) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const body = clean.replace(/^Once per (?:turn|combat)(?: |, ?)/i, '');
  let trigger = null;
  const triggerPatterns = [
    /* Specific patterns before generic "After using X,". */
    [/^After using two different skills/i, () => ({ kind: 'afterTwoDifferentSkills' })],
    [/^When Verse and Chorus triggers/i, () => ({ kind: 'onClassPerk', perk: 'verseAndChorus' })],
    [/^After successfully applying/i, () => ({ kind: 'afterDebuffApplied' })],
    [/^After applying /i, () => ({ kind: 'afterAilmentApplied' })],
    [/^After landing a critical/i, () => ({ kind: 'afterCrit' })],
    [/^After you Dodge/i, () => ({ kind: 'afterDodge' })],
    [/^After an enemy attack/i, () => ({ kind: 'afterEnemyAttack' })],
    [/^After damaging /i, () => ({ kind: 'afterDamageDealt' })],
    [/^After taking damage|The first time each turn you take damage/i, () => ({ kind: 'onDamagedHighHp' })],
    [/^After Armour absorbs|Once per turn after Armour absorbs|The first time each turn Armour absorbs/i, () => ({ kind: 'afterArmourAbsorb' })],
    [/^After restoring Armour|After using Armour Restoration/i, () => ({ kind: 'afterArmourRestorationOrFortify' })],
    [/^If acting before the target/i, () => ({ kind: 'actingFirst' })],
    [/^While below 50%|While the target is below 50%/i, () => ({ kind: 'whileHpBelow', pct: 50 })],
    [/^If you did not use a damaging/i, () => ({ kind: 'noDamageActionLastTurn' })],
    [/^Your first /i, () => ({ kind: 'skillModifier' })],
    [/^The first /i, () => ({ kind: 'skillModifier' })],
    [/^After using a (?:song|call|support|Magic|Day|Water|Armour)/i, () => ({ kind: 'afterSkillUse' })],
    [/^After using ([^.]+?),/i, (m) => ({ kind: 'afterSkillUse', skill: m[1].trim() })],
  ];
  for (const [re, mk] of triggerPatterns) {
    const m = body.match(re) || clean.match(re);
    if (m) { trigger = mk(m); break; }
  }
  if (!trigger) trigger = { kind: 'passiveAlways' };

  const effects = [];
  const tierRe = /\b(Minor|Moderate|Major)\s+(Might|Focus|Guard|Resolve|Agility|Dexterity|Vitality|Evasion|Brace|Damage|Critical(?: Chance)?|Precision|Might|Focus)\s+(Up|Down)\b/gi;
  let m;
  while ((m = tierRe.exec(clean))) {
    const statRaw = m[2].toLowerCase();
    const statMap = {
      might: 'atk', focus: 'matk', guard: 'def', resolve: 'mdef', agility: 'spd',
      dexterity: 'dex', vitality: 'vitality', evasion: 'dodge', brace: 'brace',
      damage: 'damage', 'critical chance': 'critChance', critical: 'critChance', precision: 'acc',
    };
    effects.push({
      kind: 'tierStat',
      tier: m[1].toLowerCase(),
      stat: statMap[statRaw] || statRaw,
      dir: m[3].toLowerCase(),
      target: /down/i.test(m[3]) && /apply|target/i.test(clean) ? 'enemy' : 'self',
    });
  }
  const flatPrec = clean.match(/([+\-−–]?)\s*(\d+)\s+Precision\b/gi) || [];
  for (const fp of flatPrec) {
    const n = fp.match(/([+\-−–]?)(\d+)/);
    if (!n) continue;
    const sign = /[−–\-]/.test(n[1] || '') || /Down|apply\s*−|apply\s*-/i.test(clean) ? -1 : 1;
    const amount = sign * Number(n[2]);
    effects.push({ kind: 'flatStat', stat: 'acc', dir: amount < 0 ? 'down' : 'up', amount, target: amount < 0 ? 'enemy' : 'self' });
  }
  const critPts = clean.match(/\+(\d+)\s+percentage points?\s+Critical Chance/i);
  if (critPts) {
    effects.push({ kind: 'flatStat', stat: 'critChance', dir: 'up', amount: Number(critPts[1]), target: 'self' });
  }

  const specials = [];
  const restArm = clean.match(/restore\s+(\d+)\s+Armour/i);
  if (restArm) specials.push({ id: 'restoreArmour', amount: Number(restArm[1]) });
  const restMag = clean.match(/restore\s+(\d+)\s+Magic Armour/i);
  if (restMag) specials.push({ id: 'restoreMagicArmour', amount: Number(restMag[1]) });
  const restLower = clean.match(/restore\s+(\d+)\s+to the lower protection pool/i);
  if (restLower) specials.push({ id: 'restoreLowerProtection', amount: Number(restLower[1]) });
  const skillPow = clean.match(/\+(\d+)\s+Skill Power/i);
  if (skillPow) specials.push({ id: 'skillPowerBonus', amount: Number(skillPow[1]) });
  const ignoreGuard = clean.match(/ignores?\s+(\d+)\s+Guard/i);
  if (ignoreGuard) specials.push({ id: 'ignoreGuardFlat', amount: Number(ignoreGuard[1]) });
  const healPct = clean.match(/heal(?:s)?\s+(\d+)%\s+Maximum Health/i);
  if (healPct) specials.push({ id: 'healMaxHp', pct: Number(healPct[1]) });
  const magArmDmgPct = clean.match(/(\d+)\s*%\s+additional damage to Magic Armour/i);
  if (magArmDmgPct) specials.push({ id: 'magicArmourDamagePct', pct: Number(magArmDmgPct[1]) });
  const armDmgPct = clean.match(/(\d+)\s*%\s+additional damage to Armour/i);
  if (armDmgPct) specials.push({ id: 'armourDamagePct', pct: Number(armDmgPct[1]) });
  const magArmDmg = clean.match(/(?:deal|deals)\s+(\d+)\s+(?:additional\s+)?Magic Armour damage/i);
  if (magArmDmg) specials.push({ id: 'magicArmourDamage', amount: Number(magArmDmg[1]) });
  const armDmg = clean.match(/(?:deal|deals)\s+(\d+)\s+(?:additional\s+)?Armour damage(?!\s+to)/i);
  if (armDmg) specials.push({ id: 'armourDamage', amount: Number(armDmg[1]) });
  const skillPowVsMagArm = clean.match(/\+(\d+)\s+Skill Power against Magic Armour/i);
  if (skillPowVsMagArm) specials.push({ id: 'skillPowerVsMagicArmour', amount: Number(skillPowVsMagArm[1]) });
  const skillPowVsArm = clean.match(/\+(\d+)\s+Skill Power against Armour/i);
  if (skillPowVsArm) specials.push({ id: 'skillPowerVsArmour', amount: Number(skillPowVsArm[1]) });
  const fortify = clean.match(/(\d+)\s+Fortified Armour/i);
  if (fortify) specials.push({ id: 'fortify', amount: Number(fortify[1]) });
  const ward = clean.match(/(\d+)\s+Ward Magic Armour/i);
  if (ward) specials.push({ id: 'ward', amount: Number(ward[1]) });
  const appChance = clean.match(/\+(\d+)\s+percentage points?\s+application chance/i);
  if (appChance) specials.push({ id: 'ailmentAppChanceBonus', amount: Number(appChance[1]) });
  const cleanse = /cleanse/i.test(clean);
  if (cleanse) specials.push({ id: 'cleanse', count: 1 });

  let limit = null;
  const lim = String(limitText || '');
  if (/once per turn/i.test(lim) || /once per turn/i.test(clean)) limit = 'oncePerTurn';
  else if (/once per combat/i.test(lim) || /once per combat/i.test(clean)) limit = 'oncePerCombat';
  else if (/(\d+)-turn cooldown/i.test(lim)) {
    const cm = lim.match(/(\d+)-turn cooldown/i);
    limit = { kind: 'cooldownTurns', turns: Number(cm[1]) };
  }

  return {
    text: clean,
    trigger,
    limit,
    duration: /until the start of your next turn/i.test(clean)
      ? { kind: 'untilNextTurn' }
      : (/for\s+(\d+)\s+turns?/i.test(clean)
        ? { kind: 'turns', turns: Number(clean.match(/for\s+(\d+)\s+turns?/i)[1]) }
        : null),
    effects,
    specials,
  };
}

function parseUtilityText(text) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const parsed = parsePassiveText(clean, null) || { text: clean, trigger: { kind: 'onUse' }, limit: null, duration: null, effects: [], specials: [] };
  parsed.trigger = { kind: 'onUse' };
  return parsed;
}

/* ---- Class perks → classes.js ---- */
const CLASS_PERK_CANON = {};
for (const [clsName, row] of Object.entries(UPDATES.class_perks)) {
  const id = CLASS_ID[clsName];
  if (!id) { fail(`unknown class ${clsName}`); continue; }
  CLASS_PERK_CANON[id] = {
    classPerk: row.name,
    classPerkEffect: row.effect,
    classPerkTrigger: row.trigger,
    hook: row.hook,
    notes: row.notes,
  };
}

rewriteFrozen(path.join(ROOT, 'js/data/combat-pack/classes.js'), 'classes.js', (classes) => {
  for (const [id, canon] of Object.entries(CLASS_PERK_CANON)) {
    if (!classes[id]) { fail(`classes missing ${id}`); continue; }
    classes[id].classPerk = canon.classPerk;
    classes[id].classPerkEffect = canon.classPerkEffect;
    classes[id].classPerkTrigger = canon.classPerkTrigger;
    classes[id].classPerkParsed = parsePassiveText(canon.classPerkEffect, canon.classPerkTrigger);
    classes[id].perkHook = canon.hook;
    classes[id].perkNotes = canon.notes;
  }
});
ok('updated 8 class perks in classes.js');

/* Persist canon snippet for importer sync */
writeFileSync(
  path.join(__dirname, 'data', 'class-perk-canon.json'),
  JSON.stringify(CLASS_PERK_CANON, null, 2) + '\n',
);
ok('wrote scripts/data/class-perk-canon.json');

/* ---- Species passives + utilities ---- */
const species = UPDATES.species_updates || {};
if (Object.keys(species).length !== 52) fail(`expected 52 species, got ${Object.keys(species).length}`);

rewriteFrozen(path.join(ROOT, 'js/data/combat-pack/bird-passives.js'), 'bird-passives.js', (pack) => {
  for (const [name, row] of Object.entries(species)) {
    const key = NAME_TO_KEY[name];
    if (!key) { fail(`no key for ${name}`); continue; }
    if (!pack[key]) { fail(`missing passive row ${key}`); continue; }
    pack[key].effect = row.passive;
    pack[key].triggerLimit = row.limit;
    pack[key].equipmentSynergy = row.synergy || pack[key].equipmentSynergy || '';
    pack[key].hook = row.hook || '';
    pack[key].notes = row.notes || '';
    pack[key].parsed = parsePassiveText(row.passive, row.limit);
  }
});
ok('updated 52 bird passives');

rewriteFrozen(path.join(ROOT, 'js/data/combat-pack/innate-utilities.js'), 'innate-utilities.js', (pack) => {
  for (const [name, row] of Object.entries(species)) {
    const key = NAME_TO_KEY[name];
    if (!key || !pack[key]) { fail(`missing utility row ${key || name}`); continue; }
    pack[key].effect = row.utility;
    if (row.cooldown != null) pack[key].cooldown = Number(row.cooldown);
    pack[key].hook = row.hook || '';
    pack[key].notes = row.notes || '';
    pack[key].parsed = parseUtilityText(row.utility);
  }
});
ok('updated 52 innate utilities');

/* ---- Sync birds.js passive.desc + class perk text (boot still prefers combat-pack) ---- */
{
  let src = readFileSync(path.join(ROOT, 'js/data/birds.js'), 'utf8');
  for (const [name, row] of Object.entries(species)) {
    const key = NAME_TO_KEY[name];
    if (!key) continue;
    const esc = row.passive.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const re = new RegExp(`(${key}:\\{[\\s\\S]*?passive:\\{id:"[^"]+",name:"[^"]+",desc:")([^"]*)(")`);
    if (re.test(src)) src = src.replace(re, `$1${esc}$3`);
  }
  /* Class perk effect strings on bird entries */
  for (const [clsName, row] of Object.entries(UPDATES.class_perks)) {
    const id = CLASS_ID[clsName];
    const effectEsc = row.effect.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    /* Replace classPerkEffect for birds of this class — via classPerk name match */
    const re = new RegExp(
      `(classPerk:"${row.name}",\\s*\\n\\s*classPerkEffect:")([^"]*)(")`,
      'g',
    );
    src = src.replace(re, `$1${effectEsc}$3`);
  }
  /* Siren birds may still say Cursed Call already; ensure Resonant Hex → Cursed Call if any */
  src = src.replace(/classPerk:"Resonant Hex"/g, 'classPerk:"Cursed Call"');
  writeFileSync(path.join(ROOT, 'js/data/birds.js'), src);
  ok('synced birds.js passive/class perk text');
}

/* ---- Patch CLASS_PERK_CANON in import-equipment-workbook.mjs ---- */
{
  const file = path.join(ROOT, 'scripts/import-equipment-workbook.mjs');
  let src = readFileSync(file, 'utf8');
  const start = src.indexOf('const CLASS_PERK_CANON = {');
  const end = src.indexOf('};', start);
  if (start < 0 || end < 0) fail('CLASS_PERK_CANON block not found');
  else {
    const block = `const CLASS_PERK_CANON = ${JSON.stringify({
      knight: {
        classPerk: CLASS_PERK_CANON.knight.classPerk,
        classPerkEffect: CLASS_PERK_CANON.knight.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.knight.classPerkTrigger,
      },
      rogue: {
        classPerk: CLASS_PERK_CANON.rogue.classPerk,
        classPerkEffect: CLASS_PERK_CANON.rogue.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.rogue.classPerkTrigger,
      },
      mage: {
        classPerk: CLASS_PERK_CANON.mage.classPerk,
        classPerkEffect: CLASS_PERK_CANON.mage.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.mage.classPerkTrigger,
      },
      siren: {
        classPerk: CLASS_PERK_CANON.siren.classPerk,
        classPerkEffect: CLASS_PERK_CANON.siren.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.siren.classPerkTrigger,
      },
      inquisitor: {
        classPerk: CLASS_PERK_CANON.inquisitor.classPerk,
        classPerkEffect: CLASS_PERK_CANON.inquisitor.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.inquisitor.classPerkTrigger,
      },
      bard: {
        classPerk: CLASS_PERK_CANON.bard.classPerk,
        classPerkEffect: CLASS_PERK_CANON.bard.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.bard.classPerkTrigger,
      },
      brute: {
        classPerk: CLASS_PERK_CANON.brute.classPerk,
        classPerkEffect: CLASS_PERK_CANON.brute.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.brute.classPerkTrigger,
      },
      duke: {
        classPerk: CLASS_PERK_CANON.duke.classPerk,
        classPerkEffect: CLASS_PERK_CANON.duke.classPerkEffect,
        classPerkTrigger: CLASS_PERK_CANON.duke.classPerkTrigger,
      },
    }, null, 2).replace(/^/gm, '').replace(/"([^"]+)":/g, '$1:')}`;
    /* Keep readable object literal */
    const lit = `const CLASS_PERK_CANON = {
  knight: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.knight.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.knight.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.knight.classPerkTrigger)},
  },
  rogue: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.rogue.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.rogue.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.rogue.classPerkTrigger)},
  },
  mage: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.mage.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.mage.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.mage.classPerkTrigger)},
  },
  siren: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.siren.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.siren.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.siren.classPerkTrigger)},
  },
  inquisitor: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.inquisitor.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.inquisitor.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.inquisitor.classPerkTrigger)},
  },
  bard: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.bard.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.bard.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.bard.classPerkTrigger)},
  },
  brute: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.brute.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.brute.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.brute.classPerkTrigger)},
  },
  duke: {
    classPerk: ${JSON.stringify(CLASS_PERK_CANON.duke.classPerk)},
    classPerkEffect: ${JSON.stringify(CLASS_PERK_CANON.duke.classPerkEffect)},
    classPerkTrigger: ${JSON.stringify(CLASS_PERK_CANON.duke.classPerkTrigger)},
  },
}`;
    src = src.slice(0, start) + lit + src.slice(end + 2);
    writeFileSync(file, src);
    ok('synced CLASS_PERK_CANON in import-equipment-workbook.mjs');
  }
}

if (failures.length) {
  console.error(`\n[passive-perk] ${failures.length} failure(s)`);
  process.exit(1);
}
console.log('\n[passive-perk] apply complete');
