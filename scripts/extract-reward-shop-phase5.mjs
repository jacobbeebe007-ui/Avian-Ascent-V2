#!/usr/bin/env node
/* One-shot extractor for Step 7 Phase 5 (reward screen + shop compare + shop cadence). */
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

const shopCompare = `/* Avian Ascent — Stork shop compare tooltips (Step 7 Phase 5). */
${slice(2562, 2702)}
`;

const shopCadence = `/* Avian Ascent — shop visit cadence after battles (Step 7 Phase 5). */
${slice(15504, 15522)}
globalThis.isGreyShopStage = isGreyShopStage;
globalThis.isShopDueAfterBattle = isShopDueAfterBattle;
`;

const rewardScreen = `/* Avian Ascent — post-battle reward screen orchestration (Step 7 Phase 5). */
${slice(15705, 16360)}
globalThis.showRewardScreen = showRewardScreen;
globalThis.confirmReward = confirmReward;
globalThis.applySingleReward = applySingleReward;
globalThis.handleNestShake = handleNestShake;
`;

writeFileSync('js/ui/shop-compare.js', shopCompare);
writeFileSync('js/systems/shop-cadence.js', shopCadence);
writeFileSync('js/ui/reward-screen.js', rewardScreen);

const next = removeRanges([
  [2562, 2702],
  [15504, 15522],
  [15705, 16360],
]);

writeFileSync(gamePath, next);
console.log('extract-reward-shop-phase5: wrote 3 modules, trimmed game.js');
