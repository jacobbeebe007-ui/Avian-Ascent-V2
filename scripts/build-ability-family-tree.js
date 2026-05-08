#!/usr/bin/env node
/**
 * Generates js/data/ability_family_tree.js from the family-evolution block in js/core/game.js.
 * Run after editing skill families in game.js: node scripts/build-ability-family-tree.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'js', 'core', 'game.js');
const OUT = path.join(ROOT, 'js', 'data', 'ability_family_tree.js');

/** 1-based inclusive line range: SKILL_EVOLUTION_LEVEL_INTERVAL through closing `FAMILY_EVOLUTION_BIRD_DATA` freeze */
const START_LINE = 3856;
const END_LINE = 5619;

function sliceGameJsLines(src) {
  const lines = src.split(/\r?\n/);
  return lines.slice(START_LINE - 1, END_LINE).join('\n');
}

function compactPath(pathDef) {
  if (!pathDef || typeof pathDef !== 'object') return pathDef;
  const out = {
    pathId: pathDef.pathId,
    displayName: pathDef.displayName,
    abilities: pathDef.abilities,
  };
  if (pathDef.damageTypeProgression && typeof pathDef.damageTypeProgression === 'object') {
    out.damageTypeProgression = pathDef.damageTypeProgression;
  }
  return Object.freeze(out);
}

function compactFamily(fam) {
  if (!fam || typeof fam !== 'object') return fam;
  const pathsIn = fam.paths || {};
  const paths = {};
  for (const pk of Object.keys(pathsIn)) {
    paths[pk] = compactPath(pathsIn[pk]);
  }
  const out = {
    familyId: fam.familyId,
    displayName: fam.displayName,
    baseAbilityId: fam.baseAbilityId,
    maxTier: fam.maxTier,
    paths: Object.freeze(paths),
  };
  if (typeof fam.role === 'string') out.role = fam.role;
  if (typeof fam.slotRole === 'string') out.slotRole = fam.slotRole;
  if (fam.tierNames && typeof fam.tierNames === 'object') out.tierNames = fam.tierNames;
  return Object.freeze(out);
}

function compactBirdEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const famIn = entry.families || {};
  const families = {};
  for (const fk of Object.keys(famIn)) {
    families[fk] = compactFamily(famIn[fk]);
  }
  return Object.freeze({
    birdKey: entry.birdKey,
    slotLayout: entry.slotLayout,
    families: Object.freeze(families),
  });
}

function buildTreeFromGameJs() {
  const src = fs.readFileSync(GAME, 'utf8');
  const slice = sliceGameJsLines(src);
  const ctx = vm.createContext({
    Object,
    Array,
    Number,
    String,
    Boolean,
    Math,
    RegExp,
    Error,
    JSON,
    console,
  });
  vm.runInContext(
    `${slice}\n;var __ABILITY_FAMILY_TREE_EXPORT = FAMILY_EVOLUTION_BIRD_DATA;`,
    ctx
  );
  const raw = ctx.__ABILITY_FAMILY_TREE_EXPORT;
  if (!raw || typeof raw !== 'object') {
    throw new Error('VM did not produce FAMILY_EVOLUTION_BIRD_DATA');
  }
  const birds = {};
  for (const bk of Object.keys(raw)) {
    birds[bk] = compactBirdEntry(raw[bk]);
  }
  return Object.freeze({
    version: 1,
    sourceHint: 'Generated from js/core/game.js family-evolution block; re-run scripts/build-ability-family-tree.js after edits.',
    generatedAt: new Date().toISOString(),
    birds: Object.freeze(birds),
  });
}

function emitJs(tree) {
  const json = JSON.stringify(tree, null, 2);
  return `/*
 * Ability family tree (structural graph: slot layout + path tier ability ids).
 * GENERATED FILE — do not edit by hand. Run: node scripts/build-ability-family-tree.js
 */
(function () {
  const TREE = Object.freeze(${json});
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TREE;
  }
  globalThis.ABILITY_FAMILY_TREE = TREE;
})();`;
}

function main() {
  const tree = buildTreeFromGameJs();
  fs.writeFileSync(OUT, emitJs(tree), 'utf8');
  console.log('Wrote', path.relative(ROOT, OUT));
}

main();
