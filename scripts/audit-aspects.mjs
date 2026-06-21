#!/usr/bin/env node
/**
 * Aspect system audit — scans generated data and writes Aspect_Audit_Report.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'Aspect_Audit_Report.md');

const VALID_ASPECTS = new Set(['terra', 'aeris', 'tempest', 'solis', 'lunae', 'maris']);

function loadDataFile(relPath, namespace = 'data') {
  const filePath = path.join(ROOT, relPath);
  const code = readFileSync(filePath, 'utf8');
  const sandbox = { globalThis: {}, console, Object, Array, Math, Number, String, Boolean };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: relPath });
  if (namespace === 'birds') return sandbox.BIRDS || {};
  if (namespace === 'combatPack') return sandbox.Avian?.data?.combatPack || {};
  return sandbox.Avian?.data?.[namespace.replace('data.', '')] || sandbox.Avian?.data || {};
}

function loadCombatFormulas() {
  const code = readFileSync(path.join(ROOT, 'js/systems/combat-formulas.js'), 'utf8');
  const sandbox = { globalThis: {}, console, Math, Number, Object, Array };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'combat-formulas.js' });
  return sandbox;
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function resolveEntityAspect(entity, birds) {
  const direct = String(entity?.aspect || entity?.primaryAspect || '').trim().toLowerCase();
  if (VALID_ASPECTS.has(direct)) return direct;
  const bk = entity?.birdKey || entity?.portraitKey || '';
  if (bk && birds[bk]?.aspect && VALID_ASPECTS.has(birds[bk].aspect)) return birds[bk].aspect;
  return '';
}

function abilityDealsDamage(row) {
  if (!row || row.noDamage) return false;
  const ap = Number(row.abilityPower ?? row.apCost ?? 0);
  if (ap <= 0 && row.category === 'utility') return false;
  return Number(row.abilityPower) > 0 || (!row.noDamage && row.category !== 'utility');
}

function resolveAbilityAspect(row, birdAspect) {
  if (!row) return '';
  const asp = String(row.aspect || '').trim().toLowerCase();
  if (VALID_ASPECTS.has(asp)) return asp;
  const aff = String(row.aspectAffinity || '');
  if (aff && !/none|class-neutral|neutral/i.test(aff)) {
    const token = aff.split(/[\s/]+/).filter(Boolean)[0]?.toLowerCase();
    if (VALID_ASPECTS.has(token)) return token;
  }
  return birdAspect || '';
}

function chartStrongWeak(def, chart) {
  const id = def.id || '';
  const strong = [];
  const weak = [];
  const row = chart[id] || {};
  for (const [tgt, rel] of Object.entries(row)) {
    if (rel === 'dominant') strong.push(tgt);
    if (rel === 'resisted') weak.push(tgt);
  }
  return { strong: strong.sort(), weak: weak.sort() };
}

const aspects = loadDataFile('js/data/aspects.js', 'aspects');
const birdsCode = readFileSync(path.join(ROOT, 'js/data/birds.js'), 'utf8');
const birdsSandbox = { globalThis: {}, console };
birdsSandbox.globalThis = birdsSandbox;
vm.createContext(birdsSandbox);
vm.runInContext(birdsCode, birdsSandbox);
const birds = birdsSandbox.BIRDS || {};

const combatPack = loadDataFile('js/data/combat-pack/skill-trees.js', 'combatPack');
const skillTrees = combatPack.skillTrees || combatPack;
const roster = loadDataFile('js/data/enemy-roster.js', 'enemyRoster');
const enemyById = roster.byId || {};

const birdsMissing = [];
const birdsInvalid = [];
for (const [key, b] of Object.entries(birds)) {
  const asp = String(b.aspect || '').trim().toLowerCase();
  if (!asp) birdsMissing.push({ key, name: b.name });
  else if (!VALID_ASPECTS.has(asp)) birdsInvalid.push({ key, name: b.name, aspect: asp });
}

const abilitiesMissing = [];
const abilitiesDamageNoAspect = [];
for (const [id, row] of Object.entries(skillTrees)) {
  if (typeof row !== 'object' || !row.id) continue;
  if (!abilityDealsDamage(row)) continue;
  const birdAsp = row.birdKey ? resolveEntityAspect({ birdKey: row.birdKey }, birds) : '';
  const resolved = resolveAbilityAspect(row, birdAsp);
  if (!resolved) {
    abilitiesDamageNoAspect.push({ id, name: row.name, birdKey: row.birdKey });
  }
  if (!row.aspect && !row.aspectAffinity) abilitiesMissing.push({ id, name: row.name });
}

const enemiesUnresolvable = [];
let enemySample = 0;
for (const [id, e] of Object.entries(enemyById)) {
  if (enemySample > 5000) break;
  enemySample++;
  const resolved = resolveEntityAspect(e, birds);
  if (!resolved) enemiesUnresolvable.push({ id, birdKey: e.birdKey, name: e.name });
}

const chartMismatches = [];
for (const id of aspects.ids || []) {
  const def = aspects.definitions?.[id];
  if (!def) {
    chartMismatches.push({ id, issue: 'missing definition' });
    continue;
  }
  const derived = chartStrongWeak({ id }, aspects.chart || {});
  const defStrong = [...(def.strongAgainst || [])].sort();
  const defWeak = [...(def.weakAgainst || [])].sort();
  if (JSON.stringify(derived.strong) !== JSON.stringify(defStrong)) {
    chartMismatches.push({ id, issue: 'strongAgainst mismatch', chart: derived.strong, def: defStrong });
  }
  if (JSON.stringify(derived.weak) !== JSON.stringify(defWeak)) {
    chartMismatches.push({ id, issue: 'weakAgainst mismatch', chart: derived.weak, def: defWeak });
  }
}

const formulas = loadCombatFormulas();
const multiplierChecks = [];
if (typeof formulas.getAspectMultiplier === 'function') {
  multiplierChecks.push({ case: 'aeris vs terra (strong)', got: formulas.getAspectMultiplier('aeris', 'terra'), expect: aspects.dominantMod });
  multiplierChecks.push({ case: 'terra vs aeris (weak)', got: formulas.getAspectMultiplier('terra', 'aeris'), expect: aspects.resistedMod });
  multiplierChecks.push({ case: 'terra vs terra (same)', got: formulas.getAspectMultiplier('terra', 'terra'), expect: aspects.neutralMod });
  multiplierChecks.push({ case: 'invalid aspect', got: formulas.getAspectMultiplier('bogus', 'terra'), expect: aspects.neutralMod });
}

const lines = [];
lines.push('# Aspect Audit Report');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## All Aspects');
lines.push('');
for (const id of aspects.ids || []) {
  const def = aspects.definitions?.[id] || {};
  lines.push(`- **${def.name || cap(id)}** (\`${id}\`) — ${def.theme || ''}`);
}
lines.push('');
lines.push('## Matchup modifiers');
lines.push('');
lines.push(`| Result | Multiplier |`);
lines.push(`|--------|------------|`);
lines.push(`| Strong (Dominant) | ${aspects.dominantMod}× |`);
lines.push(`| Neutral / Same | ${aspects.neutralMod}× |`);
lines.push(`| Weak (Resisted) | ${aspects.resistedMod}× |`);
lines.push('');
lines.push('## Matchup table (attacker → target)');
lines.push('');
const ids = aspects.ids || [];
lines.push(`| ↓ / → | ${ids.map(cap).join(' | ')} |`);
lines.push(`|${ids.map(() => '---').join('|')}|`);
for (const atk of ids) {
  const row = aspects.chart?.[atk] || {};
  lines.push(`| **${cap(atk)}** | ${ids.map((t) => row[t] || '—').join(' | ')} |`);
}
lines.push('');
lines.push('## Birds missing aspects');
lines.push('');
if (!birdsMissing.length) lines.push('None.');
else birdsMissing.forEach((b) => lines.push(`- ${b.name} (\`${b.key}\`)`));
lines.push('');
lines.push('## Birds with invalid aspect names');
lines.push('');
if (!birdsInvalid.length) lines.push('None.');
else birdsInvalid.forEach((b) => lines.push(`- ${b.name} (\`${b.key}\`): \`${b.aspect}\``));
lines.push('');
lines.push('## Damaging abilities with no resolvable aspect');
lines.push('');
if (!abilitiesDamageNoAspect.length) lines.push('None.');
else {
  lines.push(`Count: ${abilitiesDamageNoAspect.length}`);
  abilitiesDamageNoAspect.slice(0, 40).forEach((a) => lines.push(`- ${a.name} (\`${a.id}\`) bird=${a.birdKey || '?'}`));
  if (abilitiesDamageNoAspect.length > 40) lines.push(`- … and ${abilitiesDamageNoAspect.length - 40} more`);
}
lines.push('');
lines.push('## Abilities missing aspect fields (raw data)');
lines.push('');
lines.push(`Count: ${abilitiesMissing.length} (may use bird aspect fallback at runtime)`);
lines.push('');
lines.push('## Enemy rows with unresolvable aspect');
lines.push('');
if (!enemiesUnresolvable.length) lines.push('None — all enemies inherit via birdKey.');
else {
  lines.push(`Count: ${enemiesUnresolvable.length}`);
  enemiesUnresolvable.slice(0, 20).forEach((e) => lines.push(`- ${e.name} (\`${e.id}\`) birdKey=${e.birdKey || '?'}`));
}
lines.push('');
lines.push('## Chart vs definition mismatches');
lines.push('');
if (!chartMismatches.length) lines.push('None — chart matches Strong/Weak columns.');
else chartMismatches.forEach((m) => lines.push(`- ${m.id}: ${m.issue}${m.chart ? ` (chart: ${m.chart.join(',')} vs def: ${m.def.join(',')})` : ''}`));
lines.push('');
lines.push('## Runtime multiplier sanity checks');
lines.push('');
multiplierChecks.forEach((c) => {
  const ok = Math.abs(Number(c.got) - Number(c.expect)) < 0.001;
  lines.push(`- ${c.case}: ${c.got} ${ok ? '✓' : `(expected ${c.expect})`}`);
});
lines.push('');
lines.push('## Direct damage vs DoT');
lines.push('');
lines.push('- Aspect multiplier is applied inside `calculateDamage()` only (direct ability hits).');
lines.push('- Poison, bleed, burning, and delayed ticks use ailment-engine paths without aspect modifiers.');
lines.push('- Healing and shielding are not modified by aspects.');
lines.push('');
lines.push('## Manual review');
lines.push('');
lines.push('- Enemy Birds sheet has no Primary Aspect column; runtime inherits from `BIRDS[birdKey].aspect`.');
lines.push('- Legacy Node importers (`import-combat-content.mjs`) do not emit aspects — use `import-master-workbook.ps1`.');
lines.push('');

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('[audit-aspects] wrote', OUT);
console.log('[audit-aspects] birds missing:', birdsMissing.length);
console.log('[audit-aspects] damaging abilities no aspect:', abilitiesDamageNoAspect.length);
console.log('[audit-aspects] chart mismatches:', chartMismatches.length);
