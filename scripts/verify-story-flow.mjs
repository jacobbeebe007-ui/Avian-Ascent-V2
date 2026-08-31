#!/usr/bin/env node
/* Verify story orchestration modules (Step 7 Phase 6). */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'js/systems/story-overworld-progress.js',
  'js/systems/story-overworld-bridge.js',
  'js/systems/story-stage-flow.js',
];

const globals = [
  'handleOverworldReturn',
  'continueStageTransitionAfterRewards',
  'advanceStage',
];

const checks = [];
for (const f of files) {
  checks.push({ name: `exists ${f}`, ok: existsSync(f) });
}
const gameJs = readFileSync('js/core/game.js', 'utf8');
for (const g of ['handleOverworldReturn', 'continueStageTransitionAfterRewards', 'advanceStage', 'finalizeOverworldStageClear']) {
  checks.push({ name: `game.js no longer defines ${g}`, ok: !new RegExp(`function ${g}\\(`).test(gameJs) });
}
const bundle = existsSync('js/avian-game.bundle.js') ? readFileSync('js/avian-game.bundle.js', 'utf8') : '';
for (const g of globals) {
  const ok = bundle.includes(`globalThis.${g}`) || bundle.includes(`function ${g}(`);
  checks.push({ name: `global ${g}`, ok });
}
checks.push({
  name: 'bundle defines finalizeOverworldStageClear',
  ok: bundle.includes('function finalizeOverworldStageClear('),
});
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('verify-story-flow FAILED:');
  for (const f of failed) console.error(' -', f.name);
  process.exit(1);
}
console.log(`verify-story-flow: ${checks.length} checks passed`);
