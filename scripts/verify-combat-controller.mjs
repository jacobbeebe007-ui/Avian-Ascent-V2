#!/usr/bin/env node
/* Verify combat setup/controller modules (Step 7 Phases 7–8). */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'js/systems/combat-setup.js',
  'js/systems/combat-controller.js',
];

const globals = [
  'loadStage',
  'prepareEnemyCombatLoadout',
  'enqueueAction',
  'failsafeAdvance',
  'isActiveBattleContext',
];

const checks = [];
for (const f of files) {
  checks.push({ name: `exists ${f}`, ok: existsSync(f) });
}
const gameJs = readFileSync('js/core/game.js', 'utf8');
for (const g of ['loadStage', 'enqueueAction', 'failsafeAdvance', 'resetForNewBattle', 'lockActionUI']) {
  checks.push({ name: `game.js no longer defines ${g}`, ok: !new RegExp(`function ${g}\\(`).test(gameJs) });
}
const bundle = existsSync('js/avian-game.bundle.js') ? readFileSync('js/avian-game.bundle.js', 'utf8') : '';
for (const g of globals) {
  const ok = bundle.includes(`globalThis.${g}`) || bundle.includes(`function ${g}(`);
  checks.push({ name: `global ${g}`, ok });
}
checks.push({
  name: 'bundle defines resetForNewBattle',
  ok: bundle.includes('function resetForNewBattle('),
});
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('verify-combat-controller FAILED:');
  for (const f of failed) console.error(' -', f.name);
  process.exit(1);
}
console.log(`verify-combat-controller: ${checks.length} checks passed`);
