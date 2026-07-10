/**
 * Remove S2/S3 and non-base ability upgrade rows from skill-trees.js.
 * Usage: node scripts/prune-ability-upgrades.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TARGET = path.resolve('js/data/combat-pack/skill-trees.js');
const src = readFileSync(TARGET, 'utf8');
const match = src.match(/skillTrees = Object\.freeze\((\{[\s\S]*\})\);/);
if (!match) {
  console.error('[prune] could not parse skillTrees Object.freeze payload');
  process.exit(1);
}

const skillTrees = JSON.parse(match[1]);
const ids = Object.keys(skillTrees);
let removed = 0;

function shouldRemove(row, id) {
  if (!row || typeof row !== 'object') return true;
  if (/_S[23]$/.test(id)) return true;
  if (Number(row.mutationStage) > 1) return true;
  const level = Number(row.level) || 1;
  const branch = String(row.branch || 'base').toLowerCase();
  if (level > 1 && branch !== 'base') return true;
  return false;
}

for (const id of ids) {
  if (shouldRemove(skillTrees[id], id)) {
    delete skillTrees[id];
    removed++;
  }
}

const header = `/* GENERATED — synced from Master workbook Ability Mutation Trees */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.data = Avian.data || Object.create(null);
  Avian.data.combatPack = Avian.data.combatPack || Object.create(null);
  Avian.data.combatPack.skillTrees = Object.freeze(${JSON.stringify(skillTrees)});
})();
`;

writeFileSync(TARGET, header, 'utf8');
console.log('[prune] removed', removed, 'rows; kept', Object.keys(skillTrees).length);
