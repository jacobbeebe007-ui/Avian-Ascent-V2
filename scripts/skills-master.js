#!/usr/bin/env node
/**
 * Consolidated player-facing skill id list: template tables + ACTIONS + overrides + aliases.
 * Run: node scripts/skills-master.js [--csv]
 * JSON to stdout; with --csv, prints a second block "---CSV---" then CSV rows.
 *
 * (Replaces legacy scripts/ability-inventory.js — use this script only.)
 */
const fs = require('fs');
const path = require('path');
const {
  extractObjectLiteralAfterMarker,
  extractTopLevelObjectKeys,
  extractTemplateAssignKeys,
  extractActionsBlockKeys,
  extractRegisterAliasIds,
  extractSkillOverrideKeys,
  primaryTemplateConstMarker,
  getMergedSkillTemplateIds,
} = require('./lib/extract-game-object.js');

function addSources(map, ids, label) {
  for (const id of ids) {
    if (!map[id]) map[id] = [];
    if (!map[id].includes(label)) map[id].push(label);
  }
}

function main() {
  const wantCsv = process.argv.includes('--csv');
  const gamePath = path.join(__dirname, '..', 'js', 'core', 'game.js');
  const skillsPath = path.join(__dirname, '..', 'js', 'data', 'skills.js');
  const gameSrc = fs.readFileSync(gamePath, 'utf8');
  const skillsSrc = fs.existsSync(skillsPath) ? fs.readFileSync(skillsPath, 'utf8') : '';
  const baseFrom = skillsSrc && skillsSrc.includes('SKILL_TEMPLATES') ? skillsSrc : gameSrc;
  const baseMarker = primaryTemplateConstMarker(baseFrom);
  const baseObj = extractObjectLiteralAfterMarker(baseFrom, baseMarker);
  const extraObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_EXTRA =');
  const learnObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_LEARNABLE =');
  const magicObj = extractObjectLiteralAfterMarker(gameSrc, 'const ABILITY_TEMPLATES_MAGIC =');
  const sparrowEvo = extractObjectLiteralAfterMarker(gameSrc, 'const SPARROW_EVOLUTION_TEMPLATES =');

  const sourceById = {};
  const baseLabel = baseMarker.includes('SKILL_TEMPLATES') ? 'SKILL_TEMPLATES' : 'ABILITY_TEMPLATES';
  addSources(sourceById, extractTopLevelObjectKeys(baseObj), baseLabel);
  addSources(sourceById, extractTopLevelObjectKeys(extraObj), 'ABILITY_TEMPLATES_EXTRA');
  if (learnObj) addSources(sourceById, extractTopLevelObjectKeys(learnObj), 'ABILITY_TEMPLATES_LEARNABLE');
  if (magicObj) addSources(sourceById, extractTopLevelObjectKeys(magicObj), 'ABILITY_TEMPLATES_MAGIC');
  if (sparrowEvo) addSources(sourceById, extractTopLevelObjectKeys(sparrowEvo), 'SPARROW_EVOLUTION_TEMPLATES');
  for (const nm of ['SKILL_TEMPLATES', 'ABILITY_TEMPLATES']) {
    addSources(sourceById, extractTemplateAssignKeys(gameSrc, nm), `${nm}_ASSIGN`);
  }

  const actionKeys = new Set(extractActionsBlockKeys(gameSrc));
  const overrideKeys = new Set(extractSkillOverrideKeys(gameSrc));
  const aliasIds = new Set(extractRegisterAliasIds(gameSrc));

  delete sourceById.mimic;

  const { ids: mergedIds } = getMergedSkillTemplateIds(gameSrc, skillsSrc || null);
  const allIds = new Set([
    ...mergedIds,
    ...actionKeys,
    ...overrideKeys,
    ...aliasIds,
  ]);
  allIds.delete('mimic');

  const sorted = Array.from(allIds).sort();
  const skills = sorted.map((id) => ({
    id,
    templateSources: sourceById[id] || [],
    inActions: actionKeys.has(id) || overrideKeys.has(id),
    registeredAliasNewId: aliasIds.has(id),
    notes: '',
    owner: '',
  }));

  const report = {
    generated: new Date().toISOString(),
    description: 'Union of skill/template ids for tooling; merge order at runtime is game.js Object.assign into SKILL_TEMPLATES / ABILITY_TEMPLATES.',
    counts: {
      withTemplateLiteral: mergedIds.length,
      actionsUnion: actionKeys.size,
      skillOverrides: overrideKeys.size,
      registerAliasNewIds: aliasIds.size,
      totalSkills: skills.length,
    },
    skills,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (wantCsv) {
    process.stdout.write('\n---CSV---\n');
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    process.stdout.write(['id', 'templateSources', 'inActions', 'registeredAliasNewId', 'notes', 'owner'].join(',') + '\n');
    for (const row of skills) {
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
