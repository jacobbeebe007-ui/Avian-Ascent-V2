#!/usr/bin/env node
/* One-shot extractor for Step 7 Phase 6 (story orchestration). */
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

const overworldProgress = `/* Avian Ascent — overworld progress state (Step 7 Phase 6). */
${slice(4247, 4316)}
`;

const overworldBridge = `/* Avian Ascent — overworld return bridge (Step 7 Phase 6). */
${slice(5453, 5486)}

${slice(5851, 6039)}
`;

const stageFlow = `/* Avian Ascent — story stage transition flow (Step 7 Phase 6). */
${slice(10096, 10199)}

${slice(16426, 16455)}
globalThis.continueStageTransitionAfterRewards = continueStageTransitionAfterRewards;
globalThis.advanceStage = advanceStage;
`;

writeFileSync('js/systems/story-overworld-progress.js', overworldProgress);
writeFileSync('js/systems/story-overworld-bridge.js', overworldBridge);
writeFileSync('js/systems/story-stage-flow.js', stageFlow);

const next = removeRanges([
  [16426, 16455],
  [10096, 10199],
  [5851, 6039],
  [5453, 5486],
  [4247, 4316],
]);

writeFileSync(gamePath, next);
console.log('extract-story-phase6: wrote 3 modules, trimmed game.js');
