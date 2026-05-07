/**
 * Audit family skill ability IDs vs ABILITY_TEMPLATES keys (with alias resolution).
 * Run: node scripts/audit-family-abilities.js
 */
const fs = require('fs');
const path = require('path');
const gameJs = path.join(__dirname, '..', 'js', 'core', 'game.js');
const s = fs.readFileSync(gameJs, 'utf8');

const i0 = s.indexOf('const SPARROW_SKILL_SLOT_LAYOUT = Object.freeze');
const i1 = s.indexOf('function isSkillEvolutionLevel');
const fam = s.slice(i0, i1);

const ids = new Set();
for (const m of fam.matchAll(/abilities:\s*\{([^}]+)\}/gs)) {
  const inner = m[1];
  for (const n of inner.matchAll(/\d:\s*'([^']+)'/g)) ids.add(n[1]);
  for (const n of inner.matchAll(/\d:\s*"([^"]+)"/g)) ids.add(n[1]);
}
for (const m of fam.matchAll(/abilityId:\s*'([^']+)'/g)) ids.add(m[1]);

/** Simple alias chain from registerAbilityAlias('new','source',...) */
const aliasToSource = new Map();
for (const m of s.matchAll(/registerAbilityAlias\s*\(\s*'([^']+)'\s*,\s*'([^']+)'/g)) {
  aliasToSource.set(m[1], m[2]);
}
/** Kiwi tier IDs pass variables into registerAbilityAlias — scrape literal tuples. */
for (const m of s.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'[^']*'\s*\]/g)) {
  if (/^kiwi_/.test(m[1])) aliasToSource.set(m[1], m[2]);
}

function resolveAliasChain(id) {
  let cur = id;
  const seen = new Set();
  while (aliasToSource.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = aliasToSource.get(cur);
  }
  return cur;
}

function templateKeyExists(id) {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s,{])${esc}\\s*:`, 'm');
  return re.test(s);
}

const missing = [...ids].filter((id) => {
  const canon = resolveAliasChain(id);
  return !templateKeyExists(canon);
});

console.log('family ability ids', ids.size);
console.log('missing template (after alias resolve)', missing.length);
if (missing.length) console.log(missing.sort().join('\n'));
