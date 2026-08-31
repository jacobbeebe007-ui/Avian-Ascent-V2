#!/usr/bin/env node
/* One-shot extractor for Step 7 Phases 7–8 (combat setup + controller). */
import { readFileSync, writeFileSync } from 'node:fs';

const gamePath = 'js/core/game.js';
const lines = readFileSync(gamePath, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function removeRanges(ranges) {
  const drop = new Set();
  for (const [s, e] of ranges) {
    for (let i = s; i <= e; i++) drop.add(i);
  }
  return lines.filter((_, i) => !drop.has(i + 1)).join('\n');
}

const combatSetup = `/* Avian Ascent — battle loadout and loadStage (Step 7 Phase 7). */
${slice(7597, 8072)}
globalThis.prepareEnemyCombatLoadout = prepareEnemyCombatLoadout;
globalThis.loadStage = loadStage;
`;

const combatController = `/* Avian Ascent — combat action queue and failsafe recovery (Step 7 Phase 8). */
${slice(8369, 8490)}
globalThis.failsafeAdvance = failsafeAdvance;
globalThis.enqueueAction = enqueueAction;
`;

writeFileSync('js/systems/combat-setup.js', combatSetup);
writeFileSync('js/systems/combat-controller.js', combatController);

const next = removeRanges([
  [8369, 8490],
  [7597, 8072],
]);

writeFileSync(gamePath, next);
console.log('extract-combat-phase7-8: wrote combat-setup + combat-controller, trimmed game.js');
