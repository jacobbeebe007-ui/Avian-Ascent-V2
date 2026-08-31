#!/usr/bin/env node
/* Report game.js line count and extraction progress (Step 7). */
import { readFileSync } from 'node:fs';

const BASELINE = 23337;
const gameJs = readFileSync('js/core/game.js', 'utf8');
const current = gameJs.split('\n').length;
const reduced = BASELINE - current;
const pct = ((reduced / BASELINE) * 100).toFixed(1);

console.log('game.js size report (Step 7)');
console.log('============================');
console.log(`Before Step 7:  ${BASELINE} lines`);
console.log(`Current:        ${current} lines`);
console.log(`Reduced:        ${reduced} lines (${pct}%)`);
console.log('');
console.log('Top remaining categories (heuristic):');
console.log('  - Combat orchestration');
console.log('  - Nest / equipment UI');
console.log('  - Story / overworld flow');
console.log('  - Rewards / shop');
console.log('  - Bootstrap / legacy compatibility');
console.log('');
console.log('Extracted modules:');
console.log('  - js/core/game-helpers.js');
console.log('  - js/debug/agent-debug.js');
console.log('  - js/debug/telemetry.js');
console.log('  - js/legacy/game-compat.js');
