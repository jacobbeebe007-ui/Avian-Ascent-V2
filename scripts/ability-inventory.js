#!/usr/bin/env node
/**
 * Emits a sorted ability id inventory (templates + ACTIONS + overrides + aliases).
 * Run: node scripts/ability-inventory.js
 * Requires the same extract helpers as ci-check (duplicated here to stay standalone).
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

    if(inLineComment){
      if(ch === '\n') inLineComment = false;
      continue;
    }

    if(inBlockComment){
      if(ch === '*' && next === '/'){
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if(inString){
      if(escaped){
        escaped = false;
      }else if(ch === '\\'){
        escaped = true;
      }else if(ch === stringQuote){
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if(ch === '/' && next === '/'){
      inLineComment = true;
      i++;
      continue;
    }
    if(ch === '/' && next === '*'){
      inBlockComment = true;
      i++;
      continue;
    }
    if(ch === '"' || ch === '\'' || ch === '`'){
      inString = true;
      stringQuote = ch;
      continue;
    }

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

    if(inLineComment){
      if(ch === '\n') inLineComment = false;
      continue;
    }
    if(inBlockComment){
      if(ch === '*' && next === '/'){
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if(inString){
      if(escaped){
        escaped = false;
      }else if(ch === '\\'){
        escaped = true;
      }else if(ch === stringQuote){
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if(ch === '/' && next === '/'){
      inLineComment = true;
      i++;
      continue;
    }
    if(ch === '/' && next === '*'){
      inBlockComment = true;
      i++;
      continue;
    }
    if(ch === '"' || ch === '\'' || ch === '`'){
      inString = true;
      stringQuote = ch;
      continue;
    }

    if(ch === '{'){
      depth++;
      continue;
    }
    if(ch === '}'){
      depth--;
      continue;
    }

    if(depth !== 1) continue;

    if(/[A-Za-z_$]/.test(ch)){
      let j = i + 1;
      while(j < objectLiteralSrc.length && /[A-Za-z0-9_$]/.test(objectLiteralSrc[j])) j++;
      const ident = objectLiteralSrc.slice(i, j);
      let k = j;
      while(k < objectLiteralSrc.length && /\s/.test(objectLiteralSrc[k])) k++;
      if(objectLiteralSrc[k] === ':') keys.push(ident);
      i = j - 1;
      continue;
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

function main(){
  const gamePath = path.join(__dirname, '..', 'js', 'core', 'game.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const baseObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES =');
  const extraObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_EXTRA =');
  const learnObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_LEARNABLE =');
  const magicObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_MAGIC =');
  const sparrowEvo = extractObjectLiteralAfterMarker(gameSrc, 'const SPARROW_EVOLUTION_TEMPLATES =');

  const templateIds = new Set([
    ...extractTopLevelObjectKeys(baseObj),
    ...extractTopLevelObjectKeys(extraObj),
    ...(learnObj ? extractTopLevelObjectKeys(learnObj) : []),
    ...(magicObj ? extractTopLevelObjectKeys(magicObj) : []),
    ...(sparrowEvo ? extractTopLevelObjectKeys(sparrowEvo) : []),
    ...extractAbilityTemplateAssignKeys(gameSrc)
  ]);
  templateIds.delete('mimic');

  const actionKeys = extractActionsBlockKeys(gameSrc);
  const overrideKeys = extractSkillOverrideKeys(gameSrc);
  const aliasNewIds = extractRegisterAliasIds(gameSrc);

  const all = new Set([...templateIds, ...actionKeys, ...overrideKeys, ...aliasNewIds]);
  const sorted = Array.from(all).sort();

  let packAbilityIds = new Set();
  try {
    const pack = require(path.join(__dirname, '..', 'js', 'data', 'ability_passive_upgrade_pack.js'));
    Object.keys(pack.ABILITY_DEFS || {}).forEach(k => packAbilityIds.add(k));
  } catch(_e){
    packAbilityIds = new Set();
  }

  const report = {
    generated: new Date().toISOString(),
    counts: {
      templatesMerged: templateIds.size,
      actionsBaseAndAssign: actionKeys.length,
      skillOverrides: overrideKeys.length,
      aliasNewIds: aliasNewIds.length,
      union: sorted.length,
      packAbilityDefs: packAbilityIds.size
    },
    idsSorted: sorted,
    checklistSchema: {
      id: 'string',
      templateDesc: 'ABILITY_TEMPLATES[id].desc',
      energyByLevel: 'vs getEnergyCost at lv1-4',
      cooldownByLevel: 'vs getTemplateCooldown',
      actionsHandler: 'ACTIONS[id] or override',
      primaryStatusKeys: 'G.playerStatus / G.enemyStatus fields touched',
      damageEntry: 'dealDamage / pdmg / matk / custom',
      durationPolicy: 'stat modifiers (ATK/DEF/ACC/dodge/SPD/etc.) default 1t; ailments (Fear/Poison/Burn/Confused/…) may be longer and level-scaled'
    }
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main();
