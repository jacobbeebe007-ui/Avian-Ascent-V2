#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const {
  extractActionsBlockKeys,
  extractRegisterAliasIds,
  extractSkillOverrideKeys,
  getMergedSkillTemplateIds,
  extractBirdAndFamilyReferencedSkillIds,
} = require('./lib/extract-game-object.js');

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

function getTemplateAbilityIds(){
  const gameSrc = fs.readFileSync(path.join('js','core','game.js'), 'utf8');
  const skillsPath = path.join('js', 'data', 'skills.js');
  const skillsSrc = fs.existsSync(skillsPath) ? fs.readFileSync(skillsPath, 'utf8') : '';
  return getMergedSkillTemplateIds(gameSrc, skillsSrc || null);
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

  const skillsPath = path.join('js', 'data', 'skills.js');
  const skillsSrc = fs.existsSync(skillsPath) ? fs.readFileSync(skillsPath, 'utf8') : '';
  const templateHaystack = skillsSrc ? `${skillsSrc}\n${gameSrc}` : gameSrc;
  const cooldownShort = [];
  for(const id of templateIds){
    const markerRe = new RegExp(`\\b${id.replace(/[^a-zA-Z0-9_]/g,'')}\\s*:\\s*\\{`);
    if(!markerRe.test(templateHaystack)) continue;
    const idx = templateHaystack.search(markerRe);
    if(idx === -1) continue;
    const chunk = templateHaystack.slice(idx, idx + 1200);
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
  const pack = require(path.join('..','js','data','skill_passive_upgrade_pack.js'));
  const abilityDefs = (pack && pack.SKILL_DEFS) || {};
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

['js/data/skills.js','js/data/biomes.js','js/data/skill_passive_upgrade_pack.js','js/data/birds.js','js/data/enemies.js','js/data/skill-families.js','js/data/rewards-upgrades.js','js/combat/damage-math.js','js/core/game.js','js/combat/enemy-damage.js','js/combat/status.js','js/combat/turn-loop.js','js/combat/ai-enemy.js','js/data/content.js','js/systems/systems.js','js/systems/shop.js'].forEach(f=>{
  if(fs.existsSync(f)) parseJs(f);
});

['css/main.css','css/sprites.css'].forEach(f=>{
  if(fs.existsSync(f)) checkSpriteRefs(f);
});

runAbilityMetadataParityCheck();
runAbilityInventoryAndWiringReport();

function runBirdSkillTemplateRegistryCheck(){
  const gamePath = path.join('js', 'core', 'game.js');
  const birdsPath = path.join('js', 'data', 'birds.js');
  const familiesPath = path.join('js', 'data', 'skill-families.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const birdsSrc = fs.existsSync(birdsPath) ? fs.readFileSync(birdsPath, 'utf8') : '';
  const familiesSrc = fs.existsSync(familiesPath) ? fs.readFileSync(familiesPath, 'utf8') : '';
  const birdHaystack = `${birdsSrc}\n${familiesSrc}\n${gameSrc}`;
  const { ids: templateIds, parseError } = getTemplateAbilityIds();
  if(parseError) return;
  const templateSet = new Set(templateIds);
  const birdRefs = extractBirdAndFamilyReferencedSkillIds(birdHaystack);
  const missing = birdRefs.filter((id) => !templateSet.has(id)).sort();
  const lines = [
    `Bird/family skill refs: ${birdRefs.length} heuristic ids, ${missing.length} missing from merged SKILL templates.`,
    missing.length ? `Missing: ${missing.join(', ')}` : 'Missing: none',
  ];
  if(missing.length && STRICT_PARITY){
    fail(lines.join('\n'));
    return;
  }
  if(missing.length && IS_DEV_MODE){
    console.warn(lines.join('\n'));
  }
  if(process.env.ABILITY_INVENTORY_LOG === '1'){
    const refSet = new Set(birdRefs);
    const orphanTemplates = templateIds.filter((id) => !refSet.has(id)).sort();
    console.log(`Orphan template ids (heuristic, not referenced by BIRDS/family scan): ${orphanTemplates.length}`);
    if(orphanTemplates.length) console.log(orphanTemplates.slice(0, 80).join(', ') + (orphanTemplates.length > 80 ? '…' : ''));
  }
}

runBirdSkillTemplateRegistryCheck();

if(process.exitCode){
  process.exit(process.exitCode);
}
console.log('ci-check: OK');
