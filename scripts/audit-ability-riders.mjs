#!/usr/bin/env node
/**
 * Audit combat-pack abilities: riderText should produce executable riders or tag/lifesteal effects.
 *   node scripts/audit-ability-riders.mjs [--strict]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict');

const sandbox = vm.createContext({ console, Math, Number, Object, Array, String, JSON, globalThis: null });
sandbox.globalThis = sandbox;

for (const rel of [
  'js/data/effect-tiers.js',
  'js/data/combat-stat-magnitudes.js',
  'js/systems/ability-rider-parser.js',
  'js/systems/combat-formulas.js',
]) {
  vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const src = readFileSync(path.join(ROOT, 'js/data/combat-pack/skill-trees.js'), 'utf8');
const m = src.match(/skillTrees = Object\.freeze\(([\s\S]+)\);\s*\n?\s*\}\)\(\);/);
if (!m) {
  console.error('audit-ability-riders: could not parse skill-trees.js');
  process.exit(1);
}
const trees = JSON.parse(m[1]);

const enrich = sandbox.applyAbilityTextEnrichment;
const enrichCombat = sandbox.enrichCombatRow;

const TAG_UTILITY = new Set(['Cleanse', 'Purge', 'Marked', 'Bloodied']);
const IGNORE_RIDER_LABELS = new Set(['None', '']);

let unhooked = 0;
let hybridMismatch = 0;
let perHitMismatch = 0;
const labelCounts = Object.create(null);
const samples = [];

function hasExecutableEffect(row) {
  const riders = (row.riders || []).filter((r) => r.kind !== 'raw');
  if (riders.length > 0) return true;
  if ((Number(row.lifestealPct) || 0) > 0) return true;
  if (row.ailment && (Number(row.ailmentChance) || 0) > 0) return true;
  const tags = row.tags || [];
  for (const t of tags) {
    if (TAG_UTILITY.has(t)) return true;
  }
  return false;
}

function expectedHybridFromText(text) {
  const m = String(text || '').match(/Uses\s+(\d+(?:\.\d+)?)\s*%\s*ATK\s+and\s+(\d+(?:\.\d+)?)\s*%\s*MATK/i);
  if (!m) return null;
  return { ATK: Number(m[1]) / 100, MATK: Number(m[2]) / 100 };
}

for (const [id, row] of Object.entries(trees)) {
  const copy = JSON.parse(JSON.stringify(row));
  enrich(copy);
  enrichCombat(copy);

  const rt = String(copy.riderText || '').trim();
  if (rt && !IGNORE_RIDER_LABELS.has(rt) && !hasExecutableEffect(copy)) {
    unhooked++;
    labelCounts[rt] = (labelCounts[rt] || 0) + 1;
    if (samples.length < 12) {
      samples.push({ id, name: copy.name, riderText: rt });
    }
  }

  const text = [copy.displayText, copy.shortDesc, copy.riderText].filter(Boolean).join('\n');
  const expected = expectedHybridFromText(text);
  if (expected && copy.hybridScaling) {
    const gAtk = Number(copy.hybridScaling.ATK) || 0;
    const gMatk = Number(copy.hybridScaling.MATK) || 0;
    if (Math.abs(gAtk - expected.ATK) > 0.001 || Math.abs(gMatk - expected.MATK) > 0.001) {
      hybridMismatch++;
      if (samples.length < 20) samples.push({ id, issue: 'hybridScaling', expected, got: copy.hybridScaling });
    }
  }
  if (/First hit uses ATK,\s*second uses MATK/i.test(text) && !copy.hybridPerHit) {
    perHitMismatch++;
  }
}

console.log(`audit-ability-riders: ${Object.keys(trees).length} abilities`);
console.log(`  unhooked riderText: ${unhooked}`);
console.log(`  hybrid scaling mismatches: ${hybridMismatch}`);
console.log(`  hybridPerHit flag missing: ${perHitMismatch}`);

if (unhooked > 0) {
  console.log('\nTop unhooked labels:');
  for (const [label, count] of Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${count}x ${label}`);
  }
  if (samples.length) {
    console.log('\nSamples:');
    for (const s of samples.filter((x) => x.riderText)) console.log(`  ${s.id} — ${s.riderText}`);
  }
}

const failed = (STRICT ? unhooked : 0) + hybridMismatch + perHitMismatch;
if (failed > 0 && STRICT) {
  console.error(`\naudit-ability-riders: ${failed} issue(s) in strict mode`);
  process.exit(1);
}
if (unhooked > 80) {
  console.warn(`\naudit-ability-riders: warn — ${unhooked} abilities still lack parsed riders (threshold 80)`);
}
process.exit(0);
