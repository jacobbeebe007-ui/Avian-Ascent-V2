#!/usr/bin/env node
/**
 * Audit equipment skills: riderText should produce executable riders or tag/lifesteal effects.
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
  'js/systems/ability-rider-parser.js',
  'js/systems/combat-formulas.js',
]) {
  vm.runInContext(readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
}

const skillsSandbox = vm.createContext({ globalThis: {} });
skillsSandbox.globalThis = skillsSandbox;
vm.runInContext(readFileSync(path.join(ROOT, 'js/data/equipment/skills.js'), 'utf8'), skillsSandbox, { filename: 'skills.js' });
const trees = skillsSandbox.Avian?.data?.equipment?.skills || {};

const enrich = sandbox.applyAbilityTextEnrichment;
const enrichCombat = sandbox.enrichCombatRow;

const TAG_UTILITY = new Set(['Cleanse', 'Purge', 'Marked', 'Bloodied']);
const IGNORE_RIDER_LABELS = new Set(['None', '']);
/* Attack-setup / conditional Skill Power lines are tracked separately from combat riders. */
const DEFERRED_SETUP = /next\s+(?:Strength|Finesse|Magic|weapon)?\s*skill|gains?\s+\+\d+\s+Skill Power/i;
/* Pure damage lines are executed via skillPower — not rider handlers. */
const PURE_DAMAGE = /^(?:Deal|Strike)\b/i;
const NATURAL_STRIKE = /Natural Strike/i;

let unhooked = 0;
const samples = [];

function hasExecutableEffect(row) {
  const riders = (row.riders || []).filter((r) => r.kind !== 'raw');
  if (riders.length > 0) return true;
  if ((Number(row.lifestealPct) || 0) > 0) return true;
  if (row.ailment && (Number(row.ailmentChance) || 0) > 0) return true;
  for (const t of row.tags || []) if (TAG_UTILITY.has(t)) return true;
  return false;
}

function skillToRow(skill) {
  const structured = skill.riders || skill.protectionRiders || [];
  return {
    id: skill.id,
    name: skill.name,
    riderText: skill.riderText || '',
    riders: structured.map((r) => Object.assign({}, r)),
    tags: [],
    lifestealPct: 0,
    ailment: skill.ailment || (skill.rider && skill.rider.ailment) || null,
    ailmentChance: skill.ailmentChance != null ? Number(skill.ailmentChance)
      : (skill.rider && skill.rider.kind === 'applyAilment' ? 100 : 0),
    displayText: skill.riderText || '',
  };
}

for (const [id, skill] of Object.entries(trees)) {
  const copy = skillToRow(skill);
  enrich(copy);
  if (typeof enrichCombat === 'function') enrichCombat(copy);

  const rt = String(copy.riderText || '').trim();
  if (!rt || IGNORE_RIDER_LABELS.has(rt)) continue;
  if (NATURAL_STRIKE.test(rt)) continue;
  if (DEFERRED_SETUP.test(rt) && !hasExecutableEffect(copy)) continue;
  /* Pure damage with optional conditional clauses still deal damage via skillPower. */
  if (PURE_DAMAGE.test(rt) && !/Restore\s+\d+|Fortif|Ward\s|gain\s+(Minor|Moderate|Major)/i.test(rt)) {
    continue;
  }
  if (!hasExecutableEffect(copy)) {
    unhooked++;
    if (samples.length < 12) samples.push({ id, name: copy.name, riderText: rt });
  }
}

console.log(`audit-ability-riders: scanned ${Object.keys(trees).length} equipment skills; unhooked riderText=${unhooked}`);
if (samples.length) console.log('samples:', samples);
if (STRICT && unhooked > 0) process.exit(1);
process.exit(0);
