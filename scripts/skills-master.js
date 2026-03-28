#!/usr/bin/env node
/**
 * Consolidated player-facing skill id list: template tables + ACTIONS + overrides + aliases.
 * Run: node scripts/skills-master.js [--csv]
 * JSON to stdout; with --csv, prints a second block "---CSV---" then CSV rows.
 */
const fs = require('fs');
const path = require('path');

function extractObjectLiteralAfterMarker(src, marker){
  const markerIdx = src.indexOf(marker);
  if(markerIdx === -1) return null;
  const openIdx = src.indexOf('{', markerIdx);
  if(openIdx === -1) return null;
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for(let i = openIdx; i < src.length; i++){
    const ch = src[i];
    const next = src[i + 1];
    if(inLineComment){ if(ch === '\n') inLineComment = false; continue; }
    if(inBlockComment){
      if(ch === '*' && next === '/'){ inBlockComment = false; i++; }
      continue;
    }
    if(inString){
      if(escaped) escaped = false;
      else if(ch === '\\') escaped = true;
      else if(ch === stringQuote){ inString = false; stringQuote = ''; }
      continue;
    }
    if(ch === '/' && next === '/'){ inLineComment = true; i++; continue; }
    if(ch === '/' && next === '*'){ inBlockComment = true; i++; continue; }
    if(ch === '"' || ch === '\'' || ch === '`'){ inString = true; stringQuote = ch; continue; }
    if(ch === '{') depth++;
    if(ch === '}'){
      depth--;
      if(depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  return null;
}

function extractTopLevelObjectKeys(objectLiteralSrc){
  if(!objectLiteralSrc) return [];
  const keys = [];
  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for(let i = 0; i < objectLiteralSrc.length; i++){
    const ch = objectLiteralSrc[i];
    const next = objectLiteralSrc[i + 1];
    if(inLineComment){ if(ch === '\n') inLineComment = false; continue; }
    if(inBlockComment){
      if(ch === '*' && next === '/'){ inBlockComment = false; i++; }
      continue;
    }
    if(inString){
      if(escaped) escaped = false;
      else if(ch === '\\') escaped = true;
      else if(ch === stringQuote){ inString = false; stringQuote = ''; }
      continue;
    }
    if(ch === '/' && next === '/'){ inLineComment = true; i++; continue; }
    if(ch === '/' && next === '*'){ inBlockComment = true; i++; continue; }
    if(ch === '"' || ch === '\'' || ch === '`'){ inString = true; stringQuote = ch; continue; }
    if(ch === '{'){ depth++; continue; }
    if(ch === '}'){ depth--; continue; }
    if(depth !== 1) continue;
    if(/[A-Za-z_$]/.test(ch)){
      let j = i + 1;
      while(j < objectLiteralSrc.length && /[A-Za-z0-9_$]/.test(objectLiteralSrc[j])) j++;
      const ident = objectLiteralSrc.slice(i, j);
      let k = j;
      while(k < objectLiteralSrc.length && /\s/.test(objectLiteralSrc[k])) k++;
      if(objectLiteralSrc[k] === ':') keys.push(ident);
      i = j - 1;
    }
  }
  return Array.from(new Set(keys));
}

function extractActionsBlockKeys(gameSrc){
  const start = gameSrc.indexOf('const ACTIONS = {');
  const keys = new Set();
  if(start !== -1){
    const slice = extractObjectLiteralAfterMarker(gameSrc.slice(start), 'const ACTIONS =');
    if(slice) extractTopLevelObjectKeys(slice).forEach(k => keys.add(k));
  }
  const re = /Object\.assign\(ACTIONS,\s*\{/g;
  let m;
  while((m = re.exec(gameSrc))){
    const sub = extractObjectLiteralAfterMarker(gameSrc.slice(m.index), 'Object.assign(ACTIONS,');
    if(sub) extractTopLevelObjectKeys(sub).forEach(k => keys.add(k));
  }
  return Array.from(keys);
}

function extractSkillOverrideKeys(gameSrc){
  const out = new Set();
  const re = /const ([A-Z0-9_]+_SKILL_ACTION_OVERRIDES) = \{/g;
  let m;
  while((m = re.exec(gameSrc))){
    const marker = `const ${m[1]} =`;
    const sub = extractObjectLiteralAfterMarker(gameSrc, marker);
    if(sub) extractTopLevelObjectKeys(sub).forEach(k => out.add(k));
  }
  return Array.from(out);
}

function extractRegisterAliasIds(gameSrc){
  const out = new Set();
  const re = /registerAbilityAlias\(\s*'([^']+)'/g;
  let m;
  while((m = re.exec(gameSrc))) out.add(m[1]);
  return Array.from(out);
}

function extractAbilityTemplateAssignKeys(gameSrc){
  const s = new Set();
  let m;
  const r1 = /ABILITY_TEMPLATES\['([^']+)'\]\s*=/g;
  while((m = r1.exec(gameSrc))) s.add(m[1]);
  const r2 = /ABILITY_TEMPLATES\.([A-Za-z0-9_]+)\s*=/g;
  while((m = r2.exec(gameSrc))) s.add(m[1]);
  return s;
}

function addSources(map, ids, label){
  for(const id of ids){
    if(!map[id]) map[id] = [];
    if(!map[id].includes(label)) map[id].push(label);
  }
}

function main(){
  const wantCsv = process.argv.includes('--csv');
  const gamePath = path.join(__dirname, '..', 'js', 'core', 'game.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const baseObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES =');
  const extraObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_EXTRA =');
  const learnObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_LEARNABLE =');
  const magicObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_MAGIC =');
  const sparrowEvo = extractObjectLiteralAfterMarker(gameSrc, 'const SPARROW_EVOLUTION_TEMPLATES =');

  const sourceById = {};
  addSources(sourceById, extractTopLevelObjectKeys(baseObj), 'ABILITY_TEMPLATES');
  addSources(sourceById, extractTopLevelObjectKeys(extraObj), 'ABILITY_TEMPLATES_EXTRA');
  if(learnObj) addSources(sourceById, extractTopLevelObjectKeys(learnObj), 'ABILITY_TEMPLATES_LEARNABLE');
  if(magicObj) addSources(sourceById, extractTopLevelObjectKeys(magicObj), 'ABILITY_TEMPLATES_MAGIC');
  if(sparrowEvo) addSources(sourceById, extractTopLevelObjectKeys(sparrowEvo), 'SPARROW_EVOLUTION_TEMPLATES');
  addSources(sourceById, extractAbilityTemplateAssignKeys(gameSrc), 'ABILITY_TEMPLATES_ASSIGN');

  const actionKeys = new Set(extractActionsBlockKeys(gameSrc));
  const overrideKeys = new Set(extractSkillOverrideKeys(gameSrc));
  const aliasIds = new Set(extractRegisterAliasIds(gameSrc));

  delete sourceById.mimic;

  const allIds = new Set([
    ...Object.keys(sourceById),
    ...actionKeys,
    ...overrideKeys,
    ...aliasIds,
  ]);
  allIds.delete('mimic');

  const sorted = Array.from(allIds).sort();
  const skills = sorted.map(id => ({
    id,
    templateSources: sourceById[id] || [],
    inActions: actionKeys.has(id) || overrideKeys.has(id),
    registeredAliasNewId: aliasIds.has(id),
    notes: '',
    owner: '',
  }));

  const report = {
    generated: new Date().toISOString(),
    description: 'Union of skill/template ids for tooling; merge order at runtime is game.js Object.assign into ABILITY_TEMPLATES.',
    counts: {
      withTemplateLiteral: Object.keys(sourceById).length,
      actionsUnion: actionKeys.size,
      skillOverrides: overrideKeys.size,
      registerAliasNewIds: aliasIds.size,
      totalSkills: skills.length,
    },
    skills,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if(wantCsv){
    process.stdout.write('\n---CSV---\n');
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    process.stdout.write(['id', 'templateSources', 'inActions', 'registeredAliasNewId', 'notes', 'owner'].join(',') + '\n');
    for(const row of skills){
      process.stdout.write([
        esc(row.id),
        esc(row.templateSources.join('|')),
        row.inActions ? '1' : '0',
        row.registeredAliasNewId ? '1' : '0',
        esc(row.notes),
        esc(row.owner),
      ].join(',') + '\n');
    }
  }
}

main();
