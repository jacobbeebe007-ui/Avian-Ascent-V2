#!/usr/bin/env node
/* Lightweight architecture regression checks (Step 7). */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const loadOrder = JSON.parse(readFileSync('js/bootstrap/load-order.json', 'utf8'));
const scripts = loadOrder.gameShellScripts || [];
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

const seen = new Set();
for (const rel of scripts) {
  check(`load-order file exists: ${rel}`, existsSync(rel), rel);
  if (seen.has(rel)) check(`no duplicate load-order entry: ${rel}`, false, 'duplicate');
  seen.add(rel);
}

const helpersIdx = scripts.indexOf('js/core/game-helpers.js');
const gameIdx = scripts.indexOf('js/core/game.js');
const telemetryIdx = scripts.indexOf('js/debug/telemetry.js');
check('game-helpers loads before game.js', helpersIdx >= 0 && gameIdx >= 0 && helpersIdx < gameIdx);
check('telemetry loads after game.js', telemetryIdx >= 0 && gameIdx >= 0 && telemetryIdx > gameIdx);

const requiredGlobals = [
  'roundCombatDamage',
  'roundCombatStat',
  'rollCombatSpread',
  'applyFractionalHp',
  'dodgeBonusFromSpeed',
  'normalizeRewardTier',
  'resolveFinalClass',
  'getTelemetrySummary',
  '_agentDbgLog',
  'registerGameModule',
];

const bundlePath = 'js/avian-game.bundle.js';
if (existsSync(bundlePath)) {
  const bundle = readFileSync(bundlePath, 'utf8');
  for (const g of requiredGlobals) {
    const pat = new RegExp(`globalThis\\.${g}\\s*=`);
    check(`bundle exposes globalThis.${g}`, pat.test(bundle) || bundle.includes(`function ${g}(`));
  }
  check('bundle includes game-helpers marker', bundle.includes('game-helpers.js') || bundle.includes('Avian.helpers.formatCombatNumber'));
} else {
  check('bundle present (skip global scan)', true, 'no committed bundle yet');
}

const gameJs = readFileSync('js/core/game.js', 'utf8');
check('game.js has ownership header', gameJs.includes('game bootstrap/orchestration'));
check('game.js no duplicate formatCombatNumber def', (gameJs.match(/function formatCombatNumber/g) || []).length === 0);

const failed = checks.filter((x) => !x.ok);
if (failed.length) {
  console.error('verify-architecture FAILED:');
  for (const f of failed) console.error(' -', f.name, f.detail);
  process.exit(1);
}
console.log(`verify-architecture: ${checks.length} checks passed`);
