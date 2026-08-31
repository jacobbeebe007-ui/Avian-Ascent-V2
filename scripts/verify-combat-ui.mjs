#!/usr/bin/env node
/* Verify combat UI modules expose required globals (Step 7 Phase 3). */
import { readFileSync, existsSync } from 'node:fs';

const files = [
  'js/ui/combat-stats-modal.js',
  'js/ui/combat-bars.js',
  'js/ui/combat-status.js',
  'js/ui/combat-enemy-telegraph.js',
  'js/ui/combat-hud.js',
  'js/ui/combat-actions.js',
];

const globals = [
  'openCombatStatsModal',
  'setHpBar',
  'renderStatuses',
  'renderEnemyPlan',
  'refreshBattleUI',
  'renderActions',
];

const checks = [];
for (const f of files) {
  checks.push({ name: `exists ${f}`, ok: existsSync(f) });
}
const bundle = existsSync('js/avian-game.bundle.js') ? readFileSync('js/avian-game.bundle.js', 'utf8') : '';
for (const g of globals) {
  const ok = bundle.includes(`globalThis.${g}`) || bundle.includes(`function ${g}(`);
  checks.push({ name: `global ${g}`, ok });
}
const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('verify-combat-ui FAILED:');
  for (const f of failed) console.error(' -', f.name);
  process.exit(1);
}
console.log(`verify-combat-ui: ${checks.length} checks passed`);
