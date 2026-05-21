/* One-shot surgical excision of legacy combat content from js/core/game.js.
 *
 * Locates each legacy block by unique anchor strings, balances braces where
 * necessary to find the closing line, then removes the range (inclusive) and
 * replaces it with a tiny stub comment. Idempotent: if a block has already
 * been excised the operation logs and continues.
 *
 * Usage:
 *   node scripts/excise-legacy-combat.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TARGET = path.resolve('js/core/game.js');
let src = readFileSync(TARGET, 'utf8');
const origBytes = Buffer.byteLength(src, 'utf8');
const origLines = src.split('\n').length;
const log = [];

function fail(msg) { console.error('[excise] ' + msg); process.exit(1); }

function findOpen(openSig) {
  const lines = src.split('\n');
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) {
      if (openIdx !== -1) fail(`Multiple matches for "${openSig}" (${openIdx + 1}, ${i + 1})`);
      openIdx = i;
    }
  }
  return { openIdx, lines };
}

/** Excise from openSig line through the line that contains closeSig, inclusive. */
function exciseSig(id, openSig, closeSig, replacementLines) {
  const { openIdx, lines } = findOpen(openSig);
  if (openIdx === -1) { log.push(`[${id}] open not found; skipping`); return; }
  let closeIdx = -1;
  for (let j = openIdx; j < lines.length; j++) {
    if (lines[j].includes(closeSig)) { closeIdx = j; break; }
  }
  if (closeIdx === -1) fail(`[${id}] closeSig "${closeSig}" not found after line ${openIdx + 1}`);
  const removed = closeIdx - openIdx + 1;
  src = lines.slice(0, openIdx).concat(replacementLines, lines.slice(closeIdx + 1)).join('\n');
  log.push(`[${id}] removed ${removed} lines (${openIdx + 1}..${closeIdx + 1})`);
}

/** Excise from openSig through the matched closing brace of the literal. */
function exciseBalancedBraces(id, openSig, replacementLines) {
  const { openIdx, lines } = findOpen(openSig);
  if (openIdx === -1) { log.push(`[${id}] open not found; skipping`); return; }
  let depth = 0, closeIdx = -1;
  outer: for (let j = openIdx; j < lines.length; j++) {
    for (const c of lines[j]) {
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { closeIdx = j; break outer; }
      }
    }
  }
  if (closeIdx === -1) fail(`[${id}] could not find matching close brace`);
  const removed = closeIdx - openIdx + 1;
  src = lines.slice(0, openIdx).concat(replacementLines, lines.slice(closeIdx + 1)).join('\n');
  log.push(`[${id}] removed ${removed} lines (${openIdx + 1}..${closeIdx + 1})`);
}

// ---------------------------------------------------------------------
// 1. PASSIVE_EVOLUTION_DEFS
// ---------------------------------------------------------------------
exciseBalancedBraces(
  'PASSIVE_EVOLUTION_DEFS',
  'const PASSIVE_EVOLUTION_DEFS = Object.freeze({',
  ['const PASSIVE_EVOLUTION_DEFS = Object.create(null); /* Combat rewrite: populated at boot from combat-pack endless passives. */'],
);

// ---------------------------------------------------------------------
// 2. CLASS_PERK_DEFS + CLASS_PERK_BY_CLASS + CLASS_PERK_SOURCE_RULES
// ---------------------------------------------------------------------
exciseSig(
  'CLASS_PERK_*',
  'const CLASS_PERK_DEFS = {',
  // The very last line of CLASS_PERK_SOURCE_RULES is `});` followed by an empty
  // line and `function ensureClassPerkState`. Find the unique sentinel below.
  "subtitle:'Your role sharpens in the long hunt.',",
  ['/* CLASS_PERK_* legacy content removed below */'],
);
// Now also delete the trailing `  },\n});` that closes CLASS_PERK_SOURCE_RULES.
// Easier: anchored on the new sentinel line we just inserted.
exciseSig(
  'CLASS_PERK_*-tail',
  '/* CLASS_PERK_* legacy content removed below */',
  '});',
  [
    '/* Combat rewrite: legacy CLASS_PERK_DEFS / CLASS_PERK_BY_CLASS / CLASS_PERK_SOURCE_RULES tables removed. Bird passives (combat-pack/bird-passives.js) drive class-style behaviour through js/systems/passive-hooks.js. */',
    'const CLASS_PERK_DEFS         = Object.create(null);',
    'const CLASS_PERK_BY_CLASS     = CLASS_PERK_DEFS;',
    'const CLASS_PERK_SOURCE_RULES = Object.create(null);',
  ],
);

// ---------------------------------------------------------------------
// 3. ABILITY_TEMPLATES (primary literal)
// ---------------------------------------------------------------------
exciseBalancedBraces(
  'ABILITY_TEMPLATES',
  'const ABILITY_TEMPLATES = {',
  ['const ABILITY_TEMPLATES = Object.create(null); /* Combat rewrite: populated at boot from combat-pack skillTrees. */'],
);

// ---------------------------------------------------------------------
// 4. ABILITY_TEMPLATES_LEARNABLE + SKIP_TURN + SITTING_DUCK + 2 assigns
// ---------------------------------------------------------------------
exciseSig(
  'LEARNABLE+SKIP+SITTING',
  'const ABILITY_TEMPLATES_LEARNABLE = {',
  "ABILITY_TEMPLATES['sittingDuck'] = ABILITY_SITTING_DUCK;",
  ['/* Combat rewrite: ABILITY_TEMPLATES_LEARNABLE + skipTurn + sittingDuck removed. The combat-pack is the only source of ability data. */'],
);

// ---------------------------------------------------------------------
// 5. ABILITY_TEMPLATES_EXTRA + assign
// ---------------------------------------------------------------------
exciseSig(
  'EXTRA',
  'const ABILITY_TEMPLATES_EXTRA = {',
  'Object.assign(ABILITY_TEMPLATES, ABILITY_TEMPLATES_EXTRA);',
  ['/* Combat rewrite: ABILITY_TEMPLATES_EXTRA removed. */'],
);

// ---------------------------------------------------------------------
// 6. ABILITY_TEMPLATES_MAGIC + 2 assigns
// ---------------------------------------------------------------------
exciseSig(
  'MAGIC+merges',
  'const ABILITY_TEMPLATES_MAGIC = {',
  'Object.assign(ABILITY_TEMPLATES, ABILITY_TEMPLATES_LEARNABLE);',
  ['/* Combat rewrite: ABILITY_TEMPLATES_MAGIC + LEARNABLE merge removed. */'],
);

// ---------------------------------------------------------------------
// 7. Per-bird SKILL_SLOT_LAYOUT / SKILL_FAMILIES + FAMILY_EVOLUTION_BIRD_DATA
// ---------------------------------------------------------------------
function exciseSkillFamiliesAndEvolutionData() {
  const lines = src.split('\n');
  const openSig = 'const SPARROW_SKILL_SLOT_LAYOUT = Object.freeze([';
  const closeSig = 'function isSkillEvolutionLevel(level){';
  let openIdx = -1, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) openIdx = i;
    if (lines[i].includes(closeSig)) closeIdx = i;
  }
  if (openIdx === -1 || closeIdx === -1) { log.push('[SKILL_FAMILIES+FEVB] anchors not found'); return; }
  const removed = closeIdx - openIdx;
  const before = lines.slice(0, openIdx);
  const after = lines.slice(closeIdx);
  src = before.concat([
    '/* Combat rewrite: all legacy *_SKILL_SLOT_LAYOUT / *_SKILL_FAMILIES consts and FAMILY_EVOLUTION_BIRD_DATA literal removed. js/systems/combat-pack-boot.js rebuilds FAMILY_EVOLUTION_BIRD_DATA from Avian.data.combatPack at startup. */',
    'const FAMILY_EVOLUTION_BIRD_DATA = Object.create(null);',
    'function buildFamilySkillAbilityLookup(slotLayout, families){',
    '  const out = Object.create(null);',
    '  if (Array.isArray(slotLayout)){',
    '    for(const slot of slotLayout){',
    '      if(!slot) continue;',
    '      out[slot.abilityId] = {familyId:slot.familyId, pathId:null, tier:0, abilityId:slot.abilityId};',
    '    }',
    '  }',
    '  if (families && typeof families === \'object\'){',
    '    for(const family of Object.values(families)){',
    '      for(const path of Object.values(family.paths||{})){',
    '        for(const [tierKey, abilityId] of Object.entries(path.abilities||{})){',
    '          const tier=Number(tierKey)||0;',
    '          const prev=out[abilityId];',
    '          if(prev && prev.pathId===null && prev.tier===0 && tier>=1) continue;',
    '          out[abilityId] = {familyId:family.familyId, pathId:path.pathId, tier, abilityId};',
    '        }',
    '      }',
    '    }',
    '  }',
    '  return out;',
    '}',
  ], after).join('\n');
  log.push(`[SKILL_FAMILIES+FEVB] removed ${removed} lines (${openIdx + 1}..${closeIdx})`);
}
exciseSkillFamiliesAndEvolutionData();

// ---------------------------------------------------------------------
// 8. Per-bird fixedMainAttackCost checklist → slot.isStarterMain check
// ---------------------------------------------------------------------
function rewireFixedMainAttackChecklist() {
  const lines = src.split('\n');
  const openSig = "if(slot.familyId==='rapid') ab.fixedMainAttackCost = true;";
  const closeSig = "if(player.birdKey==='marabou' && slot.abilityId==='marabou_jab') ab.fixedMainAttackCost = true;";
  let openIdx = -1, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) openIdx = i;
    if (lines[i].includes(closeSig)) closeIdx = i;
  }
  if (openIdx === -1 || closeIdx === -1) { log.push('[fixedMainAttackCost] anchors not found'); return; }
  const removed = closeIdx - openIdx + 1;
  src = lines.slice(0, openIdx).concat(['    if(slot.isStarterMain) ab.fixedMainAttackCost = true;'], lines.slice(closeIdx + 1)).join('\n');
  log.push(`[fixedMainAttackCost] removed ${removed} lines (${openIdx + 1}..${closeIdx + 1})`);
}
rewireFixedMainAttackChecklist();

// ---------------------------------------------------------------------
// 9. Legacy ACTIONS literal + every *_SKILL_ACTION_OVERRIDES + helpers
// ---------------------------------------------------------------------
function exciseActionsAndOverrides() {
  const lines = src.split('\n');
  const openSig = 'const ACTIONS = {';
  const closeSig = '].forEach(([bk,map])=>registerStrikePreviewForBird(bk,map));';
  let openIdx = -1, closeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) openIdx = i;
    if (lines[i].includes(closeSig)) closeIdx = i;
  }
  if (openIdx === -1 || closeIdx === -1) { log.push('[ACTIONS+OVERRIDES] anchors not found'); return; }
  let trueClose = closeIdx;
  for (let j = closeIdx + 1; j < Math.min(closeIdx + 4, lines.length); j++) {
    if (lines[j].includes('})();')) { trueClose = j; break; }
  }
  const removed = trueClose - openIdx + 1;
  src = lines.slice(0, openIdx).concat([
    '/* Combat rewrite: legacy ACTIONS literal + every *_SKILL_ACTION_OVERRIDES block + per-bird mastery helpers + ability alias registrations removed. The live ACTIONS map is populated at boot by js/systems/combat-pack-boot.js with dispatcher proxies. */',
    'const ACTIONS = Object.create(null);',
    'const ABILITY_ALIAS_TO_SOURCE_ID = Object.create(null);',
    'function resolveAbilityAliasSourceId(id){ return String(id || \'\'); }',
    'function registerAbilityAlias(){ /* legacy alias registration disabled — combat-pack ids are canonical */ }',
    'function registerStrikePreviewForBird(){ /* no-op; legacy strike preview disabled */ }',
  ], lines.slice(trueClose + 1)).join('\n');
  log.push(`[ACTIONS+OVERRIDES+helpers] removed ${removed} lines (${openIdx + 1}..${trueClose + 1})`);
}
exciseActionsAndOverrides();

// ---------------------------------------------------------------------
// 10. RELIABLE_ONE_EN_ATTACK_BY_CLASS + ensureStarterKitEnergySmoothing
// ---------------------------------------------------------------------
function exciseEnergySmoothing() {
  const lines = src.split('\n');
  const openSig = 'const RELIABLE_ONE_EN_ATTACK_BY_CLASS = Object.freeze({';
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) { openIdx = i; break; }
  }
  if (openIdx === -1) { log.push('[smoothing] open not found'); return; }
  // Walk to end of ensureStarterKitEnergySmoothing
  let endIdx = -1, sawFn = false, depth = 0;
  for (let j = openIdx; j < lines.length; j++) {
    const line = lines[j];
    if (!sawFn && line.includes('function ensureStarterKitEnergySmoothing(')) sawFn = true;
    if (sawFn) {
      for (const c of line) {
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) { endIdx = j; break; }
        }
      }
      if (endIdx !== -1) break;
    }
  }
  if (endIdx === -1) { log.push('[smoothing] end not found'); return; }
  const removed = endIdx - openIdx + 1;
  src = lines.slice(0, openIdx).concat([
    '/* Combat rewrite: RELIABLE_ONE_EN_ATTACK_BY_CLASS + ensureStarterKitEnergySmoothing removed. Combat-pack guarantees each bird starts with a 1-AP main starter. */',
    'function ensureStarterKitEnergySmoothing(){ /* no-op */ }',
  ], lines.slice(endIdx + 1)).join('\n');
  log.push(`[smoothing] removed ${removed} lines (${openIdx + 1}..${endIdx + 1})`);
}
exciseEnergySmoothing();

// ---------------------------------------------------------------------
// 11. _SHOP_UTILS_REGULAR / _SHOP_UTILS_BOSS
// ---------------------------------------------------------------------
function exciseShopUtils() {
  const lines = src.split('\n');
  const openSig = 'const _SHOP_UTILS_REGULAR = [';
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(openSig)) { openIdx = i; break; }
  }
  if (openIdx === -1) { log.push('[_SHOP_UTILS_*] open not found'); return; }
  let endIdx = -1;
  for (let j = openIdx + 1; j < lines.length; j++) {
    if (lines[j].includes('function makeUtilityOffer(')) { endIdx = j - 1; break; }
  }
  if (endIdx === -1) { log.push('[_SHOP_UTILS_*] end sentinel not found'); return; }
  while (endIdx > openIdx && lines[endIdx].trim() === '') endIdx--;
  const removed = endIdx - openIdx + 1;
  src = lines.slice(0, openIdx).concat([
    '/* Combat rewrite: legacy shop utility shelves removed. Stork-shop ability stock now comes from shop-v2 (combat pack). */',
    'const _SHOP_UTILS_REGULAR = [];',
    'const _SHOP_UTILS_BOSS    = [];',
  ], lines.slice(endIdx + 1)).join('\n');
  log.push(`[_SHOP_UTILS_*] removed ${removed} lines (${openIdx + 1}..${endIdx + 1})`);
}
exciseShopUtils();

// ---------------------------------------------------------------------
// 12. Rewire playerAction → dispatcher.execute
// ---------------------------------------------------------------------
const pa1Before = src;
src = src.replace(
  /  await ACTIONS\[ab\.id\]\(ab\);\n  if\(chargedDouble && !G\.battleOver && G\.enemy\.stats\.hp>0\)\{await ACTIONS\[ab\.id\]\(ab\);\}/m,
  '  await Avian.dispatcher.execute(ab);\n  if(chargedDouble && !G.battleOver && G.enemy.stats.hp>0){await Avian.dispatcher.execute(ab);}',
);
if (src !== pa1Before) log.push('[playerAction] rewired primary + chargedDouble await calls');
const pa2Before = src;
src = src.replace(
  /    G\.actionDamageHitsRemaining=1;\n    await ACTIONS\[ab\.id\]\(ab\);\n  \}/m,
  '    G.actionDamageHitsRemaining=1;\n    await Avian.dispatcher.execute(ab);\n  }',
);
if (src !== pa2Before) log.push('[playerAction] rewired lyrebirdSongEcho await call');

// ---------------------------------------------------------------------
// 13. Trim ensureAbilityObjectFromTemplate
// ---------------------------------------------------------------------
const eaBefore = src;
src = src.replace(
  /function ensureAbilityObjectFromTemplate\(id, existing=null, slotIndex=null, energyCostPlayer=null\)\{[\s\S]*?return out;\n\}/m,
  `function ensureAbilityObjectFromTemplate(id, existing=null, slotIndex=null, energyCostPlayer=null){
  const tmpl = ABILITY_TEMPLATES?.[id] || {};
  const level = Math.max(1, Number(existing?.level || 1));
  const out = {...tmpl, ...(existing||{}), id, name:tmpl.name||existing?.name||id, level};
  if(Number.isFinite(slotIndex)) out.slotIndex = slotIndex;
  if(!String(out.btnType||'').trim() && tmpl.btnType) out.btnType = tmpl.btnType;
  if(!String(out.type||'').trim() && tmpl.type) out.type = tmpl.type;
  if(out.btnType && !out.type) out.type = out.btnType;
  if(out.type && !out.btnType) out.btnType = out.type;
  const costCtx = energyCostPlayer ?? G.player;
  out.energyCost = getAbilityEnergyCost(out, costCtx);
  out.ailmentIds = deriveAbilityAilments(out, tmpl);
  return out;
}`,
);
if (src !== eaBefore) log.push('[ensureAbilityObjectFromTemplate] trimmed to single ABILITY_TEMPLATES lookup');

// ---------------------------------------------------------------------
// 14. End-of-file globalThis exports: add stubs for the new symbols
// ---------------------------------------------------------------------
const exBefore = src;
src = src.replace(
  /try \{\n  if \(typeof ABILITY_TEMPLATES !== 'undefined' && !globalThis\.ABILITY_TEMPLATES\) globalThis\.ABILITY_TEMPLATES = ABILITY_TEMPLATES;[\s\S]*?\} catch \(_e\) \{ \/\* boot continues even if a particular symbol is missing \*\/ \}/m,
  `try {
  if (typeof ABILITY_TEMPLATES !== 'undefined' && !globalThis.ABILITY_TEMPLATES) globalThis.ABILITY_TEMPLATES = ABILITY_TEMPLATES;
  if (typeof ACTIONS !== 'undefined' && !globalThis.ACTIONS) globalThis.ACTIONS = ACTIONS;
  if (typeof CLASS_PERK_DEFS !== 'undefined' && !globalThis.CLASS_PERK_DEFS) globalThis.CLASS_PERK_DEFS = CLASS_PERK_DEFS;
  if (typeof CLASS_PERK_BY_CLASS !== 'undefined' && !globalThis.CLASS_PERK_BY_CLASS) globalThis.CLASS_PERK_BY_CLASS = CLASS_PERK_BY_CLASS;
  if (typeof CLASS_PERK_SOURCE_RULES !== 'undefined' && !globalThis.CLASS_PERK_SOURCE_RULES) globalThis.CLASS_PERK_SOURCE_RULES = CLASS_PERK_SOURCE_RULES;
  if (typeof PASSIVE_EVOLUTION_DEFS !== 'undefined' && !globalThis.PASSIVE_EVOLUTION_DEFS) globalThis.PASSIVE_EVOLUTION_DEFS = PASSIVE_EVOLUTION_DEFS;
  if (typeof FAMILY_EVOLUTION_BIRD_DATA !== 'undefined' && !globalThis.FAMILY_EVOLUTION_BIRD_DATA) globalThis.FAMILY_EVOLUTION_BIRD_DATA = FAMILY_EVOLUTION_BIRD_DATA;
  if (typeof _SHOP_UTILS_REGULAR !== 'undefined' && !globalThis._SHOP_UTILS_REGULAR) globalThis._SHOP_UTILS_REGULAR = _SHOP_UTILS_REGULAR;
  if (typeof _SHOP_UTILS_BOSS !== 'undefined' && !globalThis._SHOP_UTILS_BOSS) globalThis._SHOP_UTILS_BOSS = _SHOP_UTILS_BOSS;
} catch (_e) { /* boot continues even if a particular symbol is missing */ }`,
);
if (src !== exBefore) log.push('[globalThis-exports] extended with new stub symbols');

writeFileSync(TARGET, src, 'utf8');
const newBytes = Buffer.byteLength(src, 'utf8');
const newLines = src.split('\n').length;
console.log('[excise] ' + log.length + ' operations performed:');
for (const m of log) console.log('  ' + m);
console.log(`[excise] game.js: ${origLines} -> ${newLines} lines (${origBytes - newBytes} bytes removed)`);
