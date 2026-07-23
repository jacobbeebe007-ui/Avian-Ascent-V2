#!/usr/bin/env node
/**
 * Phase 13 — assert legacy mutation/kit identifiers are excised from runtime code.
 * Scans js/ + index.html (docs/ exempt). Allows js/meta/ card-mutation naming.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCAN_ROOTS = [
  path.join(ROOT, 'js'),
  path.join(ROOT, 'index.html'),
];

const ALLOW_PATH_RE = [
  /[/\\]js[/\\]meta[/\\]/,
  /^js[/\\]systems[/\\]save-migrations\.js$/,
  /^js[/\\]data[/\\]maps[/\\]/,
];

const FORBIDDEN = [
  { label: 'Avian.mutations', re: /\bAvian\.mutations\b/ },
  { label: 'Avian.mutationEffects', re: /\bAvian\.mutationEffects\b/ },
  { label: 'mutationInventory', re: /\bmutationInventory\b/ },
  { label: 'equippedMutations', re: /\bequippedMutations\b/ },
  { label: 'mutationIds (enemy gear)', re: /\bmutationIds\b/ },
  { label: 'mutationsPackVersion', re: /\bmutationsPackVersion\b/ },
  { label: 'rollEnemyMutations', re: /\brollEnemyMutations\b/ },
  { label: 'MUTATION_SHOP_COSTS', re: /\bMUTATION_SHOP_COSTS\b/ },
  { label: 'OW_MUTATION_BANDS', re: /\bOW_MUTATION_BANDS\b/ },
  { label: 'grantGroveGearMutation', re: /\bgrantGroveGearMutation\b/ },
  { label: 'SLOT_LABELS (mutation map)', re: /\bSLOT_LABELS\b/ },
  { label: 'lightAttackDmgPct', re: /\blightAttackDmgPct\b/ },
  { label: 'mediumAttackDmgPct', re: /\bmediumAttackDmgPct\b/ },
  { label: 'heavyAttackDmgPct', re: /\bheavyAttackDmgPct\b/ },
  { label: 'multiHitDmgPct (gear)', re: /\bmultiHitDmgPct\b/ },
  { label: 'physicalAilment (gear stat)', re: /\bphysicalAilment(?!Chance|s)\b/ },
  { label: 'magicAilment (gear stat)', re: /\bmagicAilment(?!Chance|s)\b/ },
  { label: '_FAMILY_S ability ids', re: /_FAMILY_S\d+/ },
  { label: 'Incinerate', re: /\bIncinerate\b/ },
  { label: 'MUT- item prefix', re: /MUT-[A-Z0-9-]+/ },
  { label: 'combatPack.skillTrees', re: /combatPack\.skillTrees/ },
];

const BIRD_DATA_FILES = [
  'js/data/birds.js',
  'js/data/birds-v2.js',
];
const BIRD_DATA_FORBIDDEN = [
  { label: 'startAbilities in bird data', re: /\bstartAbilities\b/ },
  { label: 'slotAbilities in bird data', re: /\bslotAbilities\b/ },
  { label: 'abilitySlotCount in bird data', re: /\babilitySlotCount\b/ },
];

function isAllowed(relPath) {
  const norm = relPath.split(path.sep).join('/');
  return ALLOW_PATH_RE.some((re) => re.test(norm));
}

function collectFiles(entry) {
  if (!statSync(entry).isDirectory()) return [entry];
  const out = [];
  for (const name of readdirSync(entry)) {
    if (name === 'meta') continue;
    const full = path.join(entry, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectFiles(full));
    else if (/\.(js|html|json)$/i.test(name) && !/avian-game\.bundle\.js$/i.test(name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function scanFile(file, text, failures) {
  const r = rel(file);
  if (isAllowed(r)) return;
  const lines = text.split('\n');
  for (const rule of FORBIDDEN) {
    lines.forEach((line, idx) => {
      if (rule.re.test(line)) {
        failures.push(`${r}:${idx + 1}: forbidden ${rule.label}`);
      }
    });
  }
}

function scanBirdData(failures) {
  for (const relFile of BIRD_DATA_FILES) {
    const full = path.join(ROOT, relFile);
    let text;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (const rule of BIRD_DATA_FORBIDDEN) {
      lines.forEach((line, idx) => {
        if (rule.re.test(line)) failures.push(`${relFile}:${idx + 1}: forbidden ${rule.label}`);
      });
    }
  }
}

function scanEffectTiers(failures) {
  const full = path.join(ROOT, 'js/data/effect-tiers.js');
  let text;
  try {
    text = readFileSync(full, 'utf8');
  } catch {
    failures.push('missing js/data/effect-tiers.js');
    return;
  }
  for (const legacy of ['grand', 'epic', 'legendary']) {
    const re = new RegExp(`"${legacy}"\\s*:`);
    if (re.test(text)) failures.push(`effect-tiers.js: legacy tier key "${legacy}"`);
  }
}

const failures = [];
for (const root of SCAN_ROOTS) {
  const fullRoot = path.isAbsolute(root) ? root : path.join(ROOT, root);
  for (const file of collectFiles(fullRoot)) {
    if (file.endsWith('effect-tiers.js')) continue;
    scanFile(file, readFileSync(file, 'utf8'), failures);
  }
}
scanBirdData(failures);
scanEffectTiers(failures);

if (failures.length) {
  console.error('[equipment-excise] FAIL — legacy identifiers still present:\n' + failures.map((f) => '  ' + f).join('\n'));
  process.exit(1);
}
console.log('[equipment-excise] OK — mutation/kit legacy identifiers absent from runtime scan');
