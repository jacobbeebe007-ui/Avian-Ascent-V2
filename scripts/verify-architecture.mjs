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
const combatUiIdx = scripts.indexOf('js/ui/combat-hud.js');
check('combat-hud loads after game.js', combatUiIdx >= 0 && gameIdx >= 0 && combatUiIdx > gameIdx);
const forgeRuntimeIdx = scripts.indexOf('js/systems/build-nest-forge-runtime.js');
const buildNestStateIdx = scripts.indexOf('js/systems/build-nest-state.js');
const rewardScreenIdx = scripts.indexOf('js/ui/reward-screen.js');
const shopCompareIdx = scripts.indexOf('js/ui/shop-compare.js');
check('build-nest-state loads before game.js', buildNestStateIdx >= 0 && gameIdx >= 0 && buildNestStateIdx < gameIdx);
check('build-nest-forge-runtime loads after game.js', forgeRuntimeIdx >= 0 && gameIdx >= 0 && forgeRuntimeIdx > gameIdx);
check('reward-screen loads after game.js', rewardScreenIdx >= 0 && gameIdx >= 0 && rewardScreenIdx > gameIdx);
check('shop-compare loads after game.js', shopCompareIdx >= 0 && gameIdx >= 0 && shopCompareIdx > gameIdx);
const storyFlowIdx = scripts.indexOf('js/systems/story-stage-flow.js');
check('story-stage-flow loads after game.js', storyFlowIdx >= 0 && gameIdx >= 0 && storyFlowIdx > gameIdx);
const combatSetupIdx = scripts.indexOf('js/systems/combat-setup.js');
const combatControllerIdx = scripts.indexOf('js/systems/combat-controller.js');
check('combat-setup loads after game.js', combatSetupIdx >= 0 && gameIdx >= 0 && combatSetupIdx > gameIdx);
check('combat-controller loads after combat-setup', combatControllerIdx >= 0 && combatSetupIdx >= 0 && combatControllerIdx > combatSetupIdx);
const compatIdx = scripts.indexOf('js/legacy/game-compat.js');
const dovePatchIdx = scripts.indexOf('js/legacy/dove-sprite-patch.js');
const spritesIdx = scripts.indexOf('js/ui/sprites.js');
const combatFxIdx = scripts.indexOf('js/ui/combat-fx.js');
check('dove-sprite-patch loads after sprites.js', dovePatchIdx >= 0 && spritesIdx >= 0 && dovePatchIdx > spritesIdx);
check('combat-fx loads after sprites.js', combatFxIdx >= 0 && spritesIdx >= 0 && combatFxIdx > spritesIdx);
check('combat-fx loads before dove-sprite-patch', combatFxIdx >= 0 && dovePatchIdx >= 0 && combatFxIdx < dovePatchIdx);
check('game-compat loads last among shell scripts', compatIdx >= 0 && compatIdx === scripts.length - 1);
check('combat-hud loads before sprites.js', combatUiIdx >= 0 && scripts.indexOf('js/ui/sprites.js') > combatUiIdx);

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
  'refreshBattleUI',
  'renderActions',
  'renderStatuses',
  'setHpBar',
  'openCombatStatsModal',
  'renderEnemyPlan',
  'isBuildNestUnlocked',
  'buildTierStarEnemyFromBirdKey',
  'confirmReward',
  'showRewardScreen',
  'bindShopItemCompareTooltips',
  'handleOverworldReturn',
  'continueStageTransitionAfterRewards',
  'loadStage',
  'failsafeAdvance',
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
