#!/usr/bin/env node
/* Verify Build Nest modules expose required globals (Step 7 Phase 4). */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'js/systems/build-nest-state.js',
  'js/systems/build-nest-forge-runtime.js',
];

const globals = [
  'isBuildNestUnlocked',
  'syncBuildNestUnlockUI',
  'normalizeForgeSlotTierStar',
  'getForgeEncounterSlot',
  'shouldBuildForgeTierStarEnemy',
  'buildTierStarEnemyFromBirdKey',
];

const checks = [];
for (const f of files) {
  checks.push({ name: `exists ${f}`, ok: existsSync(f) });
}
const gameJs = readFileSync('js/core/game.js', 'utf8');
for (const g of ['isBuildNestUnlocked', 'normalizeForgeSlotTierStar', 'buildTierStarEnemyFromBirdKey']) {
  checks.push({ name: `game.js no longer defines ${g}`, ok: !new RegExp(`function ${g}\\(`).test(gameJs) });
}
const bundle = existsSync('js/avian-game.bundle.js') ? readFileSync('js/avian-game.bundle.js', 'utf8') : '';
for (const g of globals) {
  const ok = bundle.includes(`globalThis.${g}`) || bundle.includes(`function ${g}(`);
  checks.push({ name: `global ${g}`, ok });
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('verify-build-nest FAILED:');
  for (const f of failed) console.error(' -', f.name);
  process.exit(1);
}
console.log(`verify-build-nest: ${checks.length} checks passed`);
