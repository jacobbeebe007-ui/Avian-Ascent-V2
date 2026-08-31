#!/usr/bin/env node
/* Verify js/core/game-helpers.js pure helpers (Step 7). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const helpersPath = path.resolve('js/core/game-helpers.js');
const combatConfigPath = path.resolve('js/data/combat-config.js');
const namespacePath = path.resolve('js/bootstrap/_namespace.js');

const sandbox = {
  console,
  Math, Number, Object, Array, String, JSON, BIRDS: { sparrow: { class: 'striker' } },
  globalThis: null,
};
sandbox.globalThis = sandbox;
sandbox.Avian = { data: { combatConfig: { weaponFirst: { enabled: true, agilityDodgePctPerPoint: 0.5, dodgeCapPct: 50 } } }, helpers: {} };

vm.createContext(sandbox);
vm.runInContext(readFileSync(namespacePath, 'utf8'), sandbox, { filename: '_namespace.js' });
vm.runInContext(readFileSync(combatConfigPath, 'utf8'), sandbox, { filename: 'combat-config.js' });
vm.runInContext(readFileSync(helpersPath, 'utf8'), sandbox, { filename: 'game-helpers.js' });

const c = sandbox;
const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

check('formatCombatNumber', c.formatCombatNumber(1.234) === '1.23');
check('roundCombatDamage min 0.01', c.roundCombatDamage(0) === 0.01);
check('roundCombatStat floor', c.roundCombatStat(1.236, 0) === 1.24);
check('normalizeRewardTier white→grey', c.normalizeRewardTier('white') === 'grey');
check('normalizeRewardTier unknown', c.normalizeRewardTier('bogus') === 'grey');
check('rewardTierMeta gold', c.rewardTierMeta('gold').label === 'Legendary');
check('resolveFinalClass bird', c.resolveFinalClass('', 'sparrow') === 'rogue');
check('resolveFinalClass legacy', c.resolveFinalClass('support', '') === 'mage');
check('escapeEncounterPreviewHtml', c.escapeEncounterPreviewHtml('<a&"') === '&lt;a&amp;&quot;');
check('formatSignedCombatStat zero', c.Avian.helpers.formatSignedCombatStat(0) === '+0.00');
check('formatSignedCombatStat negative pct', c.Avian.helpers.formatSignedCombatStat(-2.5, true) === '-2.50%');
check('dodgeBonusFromSpeed', c.dodgeBonusFromSpeed(20) === 10);
check('nestTierCssClass', c.Avian.helpers.nestTierCssClass('WHITE') === 'grey');

const failed = checks.filter((x) => !x.ok);
if (failed.length) {
  console.error('verify-game-helpers FAILED:');
  for (const f of failed) console.error(' -', f.name, f.detail);
  process.exit(1);
}
console.log(`verify-game-helpers: ${checks.length} checks passed`);
