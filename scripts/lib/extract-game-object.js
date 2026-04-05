/**
 * Shared parsers for extracting top-level keys from object literals in game.js
 * (used by ci-check.js, skills-master.js, and future tooling).
 */
'use strict';

function extractObjectLiteralAfterMarker(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return null;
  const openIdx = src.indexOf('{', markerIdx);
  if (openIdx === -1) return null;
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

function extractTopLevelObjectKeys(objectLiteralSrc) {
  if (!objectLiteralSrc) return [];
  const keys = [];
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < objectLiteralSrc.length; i++) {
    const ch = objectLiteralSrc[i];
    const next = objectLiteralSrc[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') {
      inString = true;
      stringQuote = ch;
      continue;
    }
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (depth !== 1) continue;
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < objectLiteralSrc.length && /[A-Za-z0-9_$]/.test(objectLiteralSrc[j])) j++;
      const ident = objectLiteralSrc.slice(i, j);
      let k = j;
      while (k < objectLiteralSrc.length && /\s/.test(objectLiteralSrc[k])) k++;
      if (objectLiteralSrc[k] === ':') keys.push(ident);
      i = j - 1;
      continue;
    }
    if (ch === '"' || ch === '\'') {
      let j = i + 1;
      let str = '';
      while (j < objectLiteralSrc.length) {
        const c = objectLiteralSrc[j];
        if (c === '\\') {
          str += c + (objectLiteralSrc[j + 1] || '');
          j += 2;
          continue;
        }
        if (c === ch) break;
        str += c;
        j++;
      }
      let k = j + 1;
      while (k < objectLiteralSrc.length && /\s/.test(objectLiteralSrc[k])) k++;
      if (objectLiteralSrc[k] === ':') keys.push(str);
      i = j;
    }
  }
  return Array.from(new Set(keys));
}

/** Bracket/dot assignments into template object, e.g. SKILL_TEMPLATES['x'] = or ABILITY_TEMPLATES.foo = */
function extractTemplateAssignKeys(gameSrc, objectName) {
  const s = new Set();
  const esc = objectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = new RegExp(`${esc}\\['([^']+)'\\]\\s*=`, 'g');
  const r2 = new RegExp(`${esc}\\.([A-Za-z0-9_]+)\\s*=`, 'g');
  let m;
  while ((m = r1.exec(gameSrc))) s.add(m[1]);
  while ((m = r2.exec(gameSrc))) s.add(m[1]);
  return s;
}

function extractActionsBlockKeys(gameSrc) {
  const start = gameSrc.indexOf('const ACTIONS = {');
  const keys = new Set();
  if (start !== -1) {
    const slice = extractObjectLiteralAfterMarker(gameSrc.slice(start), 'const ACTIONS =');
    if (slice) extractTopLevelObjectKeys(slice).forEach((k) => keys.add(k));
  }
  const re = /Object\.assign\(ACTIONS,\s*\{/g;
  let m;
  while ((m = re.exec(gameSrc))) {
    const sub = extractObjectLiteralAfterMarker(gameSrc.slice(m.index), 'Object.assign(ACTIONS,');
    if (sub) extractTopLevelObjectKeys(sub).forEach((k) => keys.add(k));
  }
  return Array.from(keys);
}

function extractRegisterAliasIds(gameSrc) {
  const out = new Set();
  const re = /registerAbilityAlias\(\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(gameSrc))) out.add(m[1]);
  return Array.from(out);
}

function extractSkillOverrideKeys(gameSrc) {
  const out = new Set();
  const re = /const ([A-Z0-9_]+_SKILL_ACTION_OVERRIDES) = \{/g;
  let m;
  while ((m = re.exec(gameSrc))) {
    const marker = `const ${m[1]} =`;
    const sub = extractObjectLiteralAfterMarker(gameSrc, marker);
    if (sub) extractTopLevelObjectKeys(sub).forEach((k) => out.add(k));
  }
  return Array.from(out);
}

function primaryTemplateConstMarker(gameSrc) {
  if (gameSrc.includes('const SKILL_TEMPLATES =')) return 'const SKILL_TEMPLATES =';
  return 'const ABILITY_TEMPLATES =';
}

function templateObjectNames(gameSrc) {
  const names = new Set(['ABILITY_TEMPLATES', 'SKILL_TEMPLATES']);
  return Array.from(names);
}

/**
 * Merge template ids from base object + extra/learnable/magic/sparrow + assign keys for all template globals.
 * @param {string} gameSrc - contents of js/core/game.js
 * @param {string|null|undefined} skillsSrc - contents of js/data/skills.js when templates live there; else omit for legacy single-file parse
 */
function getMergedSkillTemplateIds(gameSrc, skillsSrc) {
  const baseFrom = skillsSrc && skillsSrc.includes('SKILL_TEMPLATES') ? skillsSrc : gameSrc;
  const baseMarker = primaryTemplateConstMarker(baseFrom);
  const baseObj = extractObjectLiteralAfterMarker(baseFrom, baseMarker);
  const extraObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_EXTRA =');
  const learnObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_LEARNABLE =');
  const magicObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_MAGIC =');
  const sparrowEvo = extractObjectLiteralAfterMarker(gameSrc, 'const SPARROW_EVOLUTION_TEMPLATES =');
  if (!baseObj || !extraObj) {
    return {
      ids: [],
      parseError:
        'Could not parse primary SKILL_TEMPLATES/ABILITY_TEMPLATES + ABILITY_TEMPLATES_EXTRA (base in js/data/skills.js if present, extras in game.js)',
    };
  }
  const assignKeys = new Set();
  for (const nm of templateObjectNames(gameSrc)) {
    extractTemplateAssignKeys(gameSrc, nm).forEach((k) => assignKeys.add(k));
  }
  if (skillsSrc) {
    for (const nm of templateObjectNames(skillsSrc)) {
      extractTemplateAssignKeys(skillsSrc, nm).forEach((k) => assignKeys.add(k));
    }
  }
  const ids = new Set([
    ...extractTopLevelObjectKeys(baseObj),
    ...extractTopLevelObjectKeys(extraObj),
    ...(learnObj ? extractTopLevelObjectKeys(learnObj) : []),
    ...(magicObj ? extractTopLevelObjectKeys(magicObj) : []),
    ...(sparrowEvo ? extractTopLevelObjectKeys(sparrowEvo) : []),
    ...assignKeys,
  ]);
  ids.delete('mimic');
  return { ids: Array.from(ids), parseError: null };
}

function extractQuotedIdsFromChunk(chunk) {
  const ids = [];
  if (!chunk) return ids;
  const re = /'([^']+)'/g;
  let m;
  while ((m = re.exec(chunk))) ids.push(m[1]);
  return ids;
}

/**
 * Heuristic: skill/ability ids referenced from BIRDS loadouts and family path `abilities:{...}` maps in game.js.
 */
function extractBirdAndFamilyReferencedSkillIds(gameSrc) {
  const out = new Set();
  const listPairRe = /\b(startAbilities|extraAbilities):\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = listPairRe.exec(gameSrc))) {
    for (const id of extractQuotedIdsFromChunk(m[2])) out.add(id);
  }
  const mainAtkRe = /\bmainAttackId:\s*'([^']+)'/g;
  while ((m = mainAtkRe.exec(gameSrc))) out.add(m[1]);

  const pathAbilitiesRe = /abilities:\s*\{([^}]*)\}/g;
  while ((m = pathAbilitiesRe.exec(gameSrc))) {
    for (const id of extractQuotedIdsFromChunk(m[1])) out.add(id);
  }

  const abilityIdFieldRe = /\babilityId:\s*'([^']+)'/g;
  while ((m = abilityIdFieldRe.exec(gameSrc))) out.add(m[1]);

  out.delete('');
  return Array.from(out);
}

module.exports = {
  extractObjectLiteralAfterMarker,
  extractTopLevelObjectKeys,
  extractTemplateAssignKeys,
  extractActionsBlockKeys,
  extractRegisterAliasIds,
  extractSkillOverrideKeys,
  primaryTemplateConstMarker,
  getMergedSkillTemplateIds,
  extractBirdAndFamilyReferencedSkillIds,
};
