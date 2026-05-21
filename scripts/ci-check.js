#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STRICT_PARITY = process.env.CI_STRICT_PARITY === '1' || process.env.ABILITY_PARITY_STRICT === '1';
const IS_DEV_MODE = process.env.NODE_ENV !== 'production';

function fail(msg){
  console.error(msg);
  process.exitCode = 1;
}

function parseJs(file){
  const src = fs.readFileSync(file, 'utf8');
  try { new Function(src); }
  catch (e) { fail(`JS parse failed: ${file}\n${e.message}`); }
}

function checkSpriteRefs(cssFile){
  const css = fs.readFileSync(cssFile, 'utf8');
  const re = /background-image\s*:\s*url\("\.\.\/assets\/sprites\/([^)"']+)"\)/g;
  let m;
  while((m = re.exec(css))){
    const sprite = m[1];
    const full = path.join('assets','sprites',sprite);
    if(!fs.existsSync(full)) fail(`Missing sprite referenced in ${cssFile}: ${full}`);
  }
}

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

    if(ch === '"' || ch === '\''){
      let j = i + 1;
      let str = '';
      while(j < objectLiteralSrc.length){
        const c = objectLiteralSrc[j];
        if(c === '\\'){
          str += c + (objectLiteralSrc[j+1] || '');
          j += 2;
          continue;
        }
        if(c === ch) break;
        str += c;
        j++;
      }
      let k = j + 1;
      while(k < objectLiteralSrc.length && /\s/.test(objectLiteralSrc[k])) k++;
      if(objectLiteralSrc[k] === ':') keys.push(str);
      i = j;
    }
  }

  return Array.from(new Set(keys));
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

function getTemplateAbilityIds(){
  const gameSrc = fs.readFileSync(path.join('js','core','game.js'), 'utf8');
  const baseObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES =');
  const extraObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_EXTRA =');
  const learnObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_LEARNABLE =');
  const magicObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_MAGIC =');
  const sparrowEvo = extractObjectLiteralAfterMarker(gameSrc, 'const SPARROW_EVOLUTION_TEMPLATES =');

  const ids = new Set();
  if (baseObj && baseObj.includes(':')) extractTopLevelObjectKeys(baseObj).forEach(k => ids.add(k));
  if (extraObj) extractTopLevelObjectKeys(extraObj).forEach(k => ids.add(k));
  if (learnObj) extractTopLevelObjectKeys(learnObj).forEach(k => ids.add(k));
  if (magicObj) extractTopLevelObjectKeys(magicObj).forEach(k => ids.add(k));
  if (sparrowEvo) extractTopLevelObjectKeys(sparrowEvo).forEach(k => ids.add(k));
  extractAbilityTemplateAssignKeys(gameSrc).forEach(k => ids.add(k));

  // Combat rewrite: ability content now lives in the combat data pack. If no
  // legacy ABILITY_TEMPLATES literal was found in game.js, harvest ids from
  // js/data/combat-pack/skill-trees.js so downstream checks can still report
  // meaningful coverage.
  if (ids.size === 0) {
    try {
      const skillTreesPath = path.join(__dirname, '..', 'js', 'data', 'combat-pack', 'skill-trees.js');
      if (fs.existsSync(skillTreesPath)) {
        const sandbox = { globalThis: {} };
        sandbox.globalThis = sandbox;
        const code = fs.readFileSync(skillTreesPath, 'utf8');
        new Function('globalThis', code)(sandbox);
        const trees = sandbox?.Avian?.data?.combatPack?.skillTrees || {};
        for (const k of Object.keys(trees)) ids.add(k);
      }
    } catch (_e) { /* swallow; report parseError below if we still have nothing */ }
  }

  ids.delete('mimic');
  if (ids.size === 0) return { ids: [], parseError: 'Could not parse ABILITY_TEMPLATES blocks from js/core/game.js' };
  return { ids: Array.from(ids), parseError: null };
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

function extractRegisterAliasIds(gameSrc){
  const out = new Set();
  const re = /registerAbilityAlias\(\s*'([^']+)'/g;
  let m;
  while((m = re.exec(gameSrc))) out.add(m[1]);
  return Array.from(out);
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

function runAbilityInventoryAndWiringReport(){
  const gamePath = path.join('js','core','game.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const { ids: templateIds, parseError } = getTemplateAbilityIds();
  if(parseError){
    fail(parseError);
    return;
  }
  const templateSet = new Set(templateIds);
  const actionKeys = extractActionsBlockKeys(gameSrc);
  const aliasIds = extractRegisterAliasIds(gameSrc);
  const overrideKeys = extractSkillOverrideKeys(gameSrc);
  const actionSet = new Set(actionKeys);
  overrideKeys.forEach(k => actionSet.add(k));

  const actionsWithoutTemplate = actionKeys.filter(id => !templateSet.has(id)).sort();
  const overridesWithoutTemplate = overrideKeys.filter(id => !templateSet.has(id)).sort();
  const aliasMissingTarget = [];
  const reAlias = /registerAbilityAlias\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  let am;
  while((am = reAlias.exec(gameSrc))){
    const [, newId, srcId] = am;
    if(!templateSet.has(srcId)) aliasMissingTarget.push(`${newId}→${srcId}`);
  }

  const cooldownShort = [];
  for(const id of templateIds){
    const markerRe = new RegExp(`\\b${id.replace(/[^a-zA-Z0-9_]/g,'')}\\s*:\\s*\\{`);
    if(!markerRe.test(gameSrc)) continue;
    const idx = gameSrc.search(markerRe);
    if(idx === -1) continue;
    const chunk = gameSrc.slice(idx, idx + 1200);
    const mc = chunk.match(/cooldownByLevel\s*:\s*\[([^\]]*)\]/);
    if(!mc) continue;
    const parts = mc[1].split(',').map(s => s.trim()).filter(Boolean);
    if(parts.length > 0 && parts.length !== 4) cooldownShort.push(`${id}(${parts.length})`);
  }

  const lines = [
    `Ability wiring: ${templateIds.length} template ids (merged), ${actionKeys.length} base ACTIONS, ${overrideKeys.length} override keys, ${aliasIds.length} registerAbilityAlias new-ids.`,
    `- ACTIONS missing template (${actionsWithoutTemplate.length}): ${actionsWithoutTemplate.join(', ') || 'none'}`,
    `- Overrides missing template (${overridesWithoutTemplate.length}): ${overridesWithoutTemplate.join(', ') || 'none'}`,
    `- Alias source missing template (${aliasMissingTarget.length}): ${aliasMissingTarget.slice(0, 12).join('; ') || 'none'}${aliasMissingTarget.length > 12 ? '…' : ''}`,
    `- cooldownByLevel length ≠ 4 (${cooldownShort.length}): ${cooldownShort.slice(0, 20).join(', ') || 'none'}${cooldownShort.length > 20 ? '…' : ''}`
  ];

  const bad = actionsWithoutTemplate.length || overridesWithoutTemplate.length || aliasMissingTarget.length;
  if(bad && STRICT_PARITY){
    fail(lines.join('\n'));
    return;
  }
  if(bad && IS_DEV_MODE){
    console.warn(lines.join('\n'));
  } else if(process.env.ABILITY_INVENTORY_LOG === '1'){
    console.log(lines.join('\n'));
  }
}

function runAbilityMetadataParityCheck(){
  // The legacy `js/data/ability_passive_upgrade_pack.js` metadata pack was
  // retired as part of the 2026 combat rewrite. Ability metadata now lives in
  // `js/data/combat-pack/skill-trees.js` and is the single source of truth, so
  // this parity check is a no-op until/unless we reintroduce a parallel pack.
  if(!fs.existsSync(path.join(__dirname, '..', 'js', 'data', 'ability_passive_upgrade_pack.js'))) return;
  const pack = require(path.join('..','js','data','ability_passive_upgrade_pack.js'));
  const abilityDefs = (pack && pack.ABILITY_DEFS) || {};
  const metadataIds = Object.keys(abilityDefs);
  const { ids: templateIds, parseError } = getTemplateAbilityIds();

  if(parseError){
    fail(`Ability parity parse error: ${parseError}`);
    return;
  }

  const templateSet = new Set(templateIds);
  const metadataSet = new Set(metadataIds);

  const missingMetadataEntries = templateIds.filter(id => !metadataSet.has(id)).sort();
  const orphanMetadataEntries = metadataIds.filter(id => !templateSet.has(id)).sort();

  const requiredFieldGaps = [];
  for(const id of metadataIds){
    const entry = abilityDefs[id] || {};
    const missing = [];
    if(!Array.isArray(entry.tags) || entry.tags.length === 0) missing.push('tags');
    if(typeof entry.role !== 'string' || !entry.role.trim()) missing.push('role');
    if(typeof entry.notes !== 'string' || !entry.notes.trim()) missing.push('notes');
    if(missing.length) requiredFieldGaps.push({ id, fields: missing });
  }

  const hasIssues = missingMetadataEntries.length || orphanMetadataEntries.length || requiredFieldGaps.length;
  if(!hasIssues) return;

  const lines = [
    'Ability metadata parity report:',
    `- missing metadata entries (${missingMetadataEntries.length}): ${missingMetadataEntries.join(', ') || 'none'}`,
    `- orphan metadata entries (${orphanMetadataEntries.length}): ${orphanMetadataEntries.join(', ') || 'none'}`,
    `- required field gaps (${requiredFieldGaps.length}): ${requiredFieldGaps.map(g => `${g.id}[${g.fields.join(',')}]`).join(', ') || 'none'}`
  ];

  if(IS_DEV_MODE && !STRICT_PARITY){
    console.warn(lines.join('\n'));
  }

  if(STRICT_PARITY){
    fail(lines.join('\n'));
  }
}

function collectFamilyTreeAbilityIds(tree){
  const ids = new Set();
  const birds = tree && tree.birds;
  if(!birds || typeof birds !== 'object') return ids;
  for(const bird of Object.values(birds)){
    for(const slot of bird.slotLayout || []){
      if(slot && slot.abilityId) ids.add(String(slot.abilityId));
    }
    const families = bird.families || {};
    for(const fam of Object.values(families)){
      const paths = fam.paths || {};
      for(const pth of Object.values(paths)){
        const abs = pth.abilities || {};
        for(const v of Object.values(abs)){
          if(v != null && String(v).length) ids.add(String(v));
        }
      }
    }
  }
  return ids;
}

/** Optional: non-empty birdKey, familyId, pathId (plan structural sanity). */
function collectFamilyTreeStructuralGaps(tree){
  const gaps = [];
  const birds = tree && tree.birds;
  if(!birds || typeof birds !== 'object'){
    gaps.push('missing or invalid tree.birds');
    return gaps;
  }
  for(const [birdKey, bird] of Object.entries(birds)){
    if(!bird || typeof bird !== 'object'){
      gaps.push(`bird entry "${birdKey}": not an object`);
      continue;
    }
    if(!String(bird.birdKey || '').trim()) gaps.push(`bird "${birdKey}": empty birdKey`);
    const families = bird.families || {};
    for(const [fk, fam] of Object.entries(families)){
      if(!fam || typeof fam !== 'object'){
        gaps.push(`${birdKey}.families.${fk}: invalid`);
        continue;
      }
      if(!String(fam.familyId || '').trim()) gaps.push(`${birdKey}.families.${fk}: empty familyId`);
      const paths = fam.paths || {};
      for(const [pk, pth] of Object.entries(paths)){
        if(!pth || typeof pth !== 'object'){
          gaps.push(`${birdKey}.paths.${pk}: invalid`);
          continue;
        }
        if(!String(pth.pathId || '').trim()) gaps.push(`${birdKey}.families.${fk}.paths.${pk}: empty pathId`);
      }
    }
  }
  return gaps;
}

function treeIdMatchesTemplate(id, templateSet, aliasToSource){
  if(templateSet.has(id)) return true;
  const seen = new Set();
  let cur = id;
  while(aliasToSource.has(cur) && !seen.has(cur)){
    seen.add(cur);
    cur = aliasToSource.get(cur);
    if(templateSet.has(cur)) return true;
  }
  return false;
}

/** Ids declared in Kiwi V2 bridge rows: ['kiwi_*','templateId','Name'] */
function extractKiwiBridgeAliasIds(gameSrc){
  const ids = new Set();
  const re = /\['(kiwi_[a-z0-9_]+)'\s*,/g;
  let m;
  while((m = re.exec(gameSrc))) ids.add(m[1]);
  return ids;
}

function runAbilityFamilyTreeParityCheck(){
  const absTree = path.join(__dirname, '..', 'js', 'data', 'ability_family_tree.js');
  if(!fs.existsSync(absTree)){
    // Retired with the 2026 combat rewrite — replaced by
    // js/data/combat-pack/families.js + skill-trees.js, validated by the
    // import-combat-content.mjs importer itself.
    return;
  }
  let tree;
  try{
    tree = require(absTree);
  }catch(e){
    fail(`Ability family tree: require failed (${e.message})`);
    return;
  }
  const structuralGaps = collectFamilyTreeStructuralGaps(tree);
  if(structuralGaps.length){
    const lines = [
      'Ability family tree structural gaps:',
      ...structuralGaps.slice(0, 40).map(g => `- ${g}`),
      ...(structuralGaps.length > 40 ? [`- … (${structuralGaps.length} total)`] : [])
    ];
    if(IS_DEV_MODE && !STRICT_PARITY){
      console.warn(lines.join('\n'));
    }else if(STRICT_PARITY){
      fail(lines.join('\n'));
      return;
    }
  }
  const { ids: templateIds, parseError } = getTemplateAbilityIds();
  if(parseError){
    fail(`Ability family tree parity: ${parseError}`);
    return;
  }
  const gamePath = path.join(__dirname, '..', 'js', 'core', 'game.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const aliasToSource = new Map();
  const reAlias = /registerAbilityAlias\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  let am;
  while((am = reAlias.exec(gameSrc))){
    aliasToSource.set(am[1], am[2]);
  }
  const actionKeys = extractActionsBlockKeys(gameSrc);
  const overrideKeys = extractSkillOverrideKeys(gameSrc);
  const acceptableIds = new Set(templateIds);
  actionKeys.forEach(k => acceptableIds.add(k));
  overrideKeys.forEach(k => acceptableIds.add(k));
  extractRegisterAliasIds(gameSrc).forEach(k => acceptableIds.add(k));
  extractKiwiBridgeAliasIds(gameSrc).forEach(k => acceptableIds.add(k));
  const treeIds = collectFamilyTreeAbilityIds(tree);
  const missingTemplates = [...treeIds].filter(id => !treeIdMatchesTemplate(id, acceptableIds, aliasToSource)).sort();
  if(!missingTemplates.length) return;

  const lines = [
    'Ability family tree vs wired ability ids (templates / ACTIONS / overrides / alias new-ids):',
    `- family-tree ability ids not found (${missingTemplates.length}): ${missingTemplates.join(', ') || 'none'}`
  ];

  if(IS_DEV_MODE && !STRICT_PARITY){
    console.warn(lines.join('\n'));
    return;
  }
  if(STRICT_PARITY){
    fail(lines.join('\n'));
  }
}

['js/core/game.js','js/data/content.js','js/systems/systems.js','js/systems/shop.js'].forEach(f=>{
  if(fs.existsSync(f)) parseJs(f);
});

['css/main.css','css/sprites.css'].forEach(f=>{
  if(fs.existsSync(f)) checkSpriteRefs(f);
});

/* ============================================================
 * Phase 4 lint hardening (A.5)
 *   - HTML must have no inline on… handlers.
 *   - No new globalThis.<name> = … outside the allowed bootstrap files.
 *   - Every data-action / data-input / data-change name in HTML must
 *     resolve to a function known to the bundle.
 * ========================================================== */

function runHtmlInlineHandlerCheck(){
  const htmlPath = 'index.html';
  if(!fs.existsSync(htmlPath)) return;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /\son(?:click|input|change|submit|focus|blur|key(?:up|down|press)|mouse(?:over|out|enter|leave|down|up|move)|load|error|drag|drop|wheel|context(?:menu)?|paste|cut|copy)\s*=/gi;
  const hits = html.match(re);
  if(hits && hits.length){
    fail(`HTML lint: ${hits.length} inline on… attribute(s) found in index.html. Replace with data-action / data-input / data-change.`);
  }
}

const GLOBALS_ALLOWED_FILES = new Set([
  'js/bootstrap/_namespace.js',
]);
function isDataFile(rel){
  const norm = rel.replace(/\\/g, '/');
  return norm.startsWith('js/data/');
}
function listScriptFilesForLint(){
  const out = [];
  function walk(dir){
    if(!fs.existsSync(dir)) return;
    for(const entry of fs.readdirSync(dir, { withFileTypes: true })){
      const full = path.join(dir, entry.name).replace(/\\/g, '/');
      if(entry.isDirectory()) walk(full);
      else if(entry.isFile() && entry.name.endsWith('.js')) out.push(full);
    }
  }
  walk('js');
  if(fs.existsSync('sw.js')) out.push('sw.js');
  return out.filter(f => !f.endsWith('avian-game.bundle.js'));
}

function collectTopLevelFunctionNames(){
  /* Names that already exist as top-level `function X(` declarations across
   * the bundle. Re-assigning these via `globalThis.X = wrapper(X)` is an
   * existing wrapper pattern, not a new global, so it's exempt from the
   * baseline check. */
  const names = new Set();
  for(const rel of listScriptFilesForLint()){
    const src = fs.readFileSync(rel, 'utf8');
    const re = /^\s*function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/gm;
    let m;
    while((m = re.exec(src))) names.add(m[1]);
  }
  return names;
}

function runGlobalsBaselineCheck(){
  const baselineFile = path.join(__dirname, '.globals-baseline.json');
  const established = collectTopLevelFunctionNames();
  const found = new Map();
  for(const rel of listScriptFilesForLint()){
    if(GLOBALS_ALLOWED_FILES.has(rel) || isDataFile(rel)) continue;
    const src = fs.readFileSync(rel, 'utf8');
    const re = /globalThis\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)/g;
    let m;
    while((m = re.exec(src))){
      const name = m[1];
      if(established.has(name)) continue; // wrapper of an existing function
      if(!found.has(name)) found.set(name, rel);
    }
  }
  const foundNames = Array.from(found.keys()).sort();
  if(!fs.existsSync(baselineFile)){
    fs.writeFileSync(baselineFile, JSON.stringify(foundNames, null, 2) + '\n', 'utf8');
    console.log(`[ci-check] wrote initial globals baseline (${foundNames.length} names) → scripts/.globals-baseline.json`);
    return;
  }
  let baseline;
  try{
    baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  }catch(e){
    fail(`Globals baseline parse error: ${e.message}`);
    return;
  }
  const baselineSet = new Set(baseline);
  const newOnes = foundNames.filter(n => !baselineSet.has(n));
  if(newOnes.length){
    fail(
      `Globals regression: ${newOnes.length} new globalThis.<name> assignment(s) outside js/data/* and js/bootstrap/_namespace.js:\n` +
      newOnes.map(n => `  - globalThis.${n} (in ${found.get(n)})`).join('\n') +
      `\nPrefer attaching to Avian.actions / Avian.systems / Avian.ui instead.\n` +
      `If the new global is intentional, regenerate the baseline by deleting scripts/.globals-baseline.json and rerunning ci-check.`,
    );
  }
}

function collectDataActionNames(html){
  const out = new Set();
  const re = /\sdata-(?:action|input|change|submit)\s*=\s*"([^"]+)"/g;
  let m;
  while((m = re.exec(html))){
    const spec = m[1];
    const name = spec.split(':', 1)[0].trim();
    if(name) out.add(name);
  }
  return Array.from(out);
}

function collectFunctionNames(){
  const names = new Set();
  for(const rel of listScriptFilesForLint()){
    const src = fs.readFileSync(rel, 'utf8');
    let m;
    const r1 = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while((m = r1.exec(src))) names.add(m[1]);
    const r2 = /globalThis\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=(?!=)\s*(?:function|\(|[A-Za-z_$])/g;
    while((m = r2.exec(src))) names.add(m[1]);
    const r3 = /Avian\.actions(?:\.register\(\s*'([A-Za-z_$][A-Za-z0-9_$]*)'|\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=)/g;
    while((m = r3.exec(src))){
      if(m[1]) names.add(m[1]);
      if(m[2]) names.add(m[2]);
    }
  }
  return names;
}

function runDataActionResolutionCheck(){
  const htmlPath = 'index.html';
  if(!fs.existsSync(htmlPath)) return;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const used = collectDataActionNames(html);
  const known = collectFunctionNames();
  const missing = used.filter(n => !known.has(n)).sort();
  if(missing.length){
    fail(
      `data-action lint: ${missing.length} action(s) referenced in index.html have no matching function or Avian.actions registration:\n` +
      missing.map(n => `  - ${n}`).join('\n'),
    );
  }
}

runHtmlInlineHandlerCheck();
runGlobalsBaselineCheck();
runDataActionResolutionCheck();
runAbilityMetadataParityCheck();
runAbilityFamilyTreeParityCheck();
runAbilityInventoryAndWiringReport();

if(process.exitCode){
  process.exit(process.exitCode);
}
console.log('ci-check: OK');
