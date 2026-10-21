#!/usr/bin/env node
/**
 * Enemy kit abilities obey the same authored cooldown + once-per-turn rules as
 * the player's loadout: an innate utility (CD 3) cannot be planned twice in one
 * turn or on back-to-back turns, basic attacks stay repeatable, and the enemy
 * "heal" branch applies the authored row instead of a flat 14% Health recovery.
 */
import { createSandbox } from './combat-scenarios/harness.mjs';
import { createCleanCombatState, findAbilityById } from './combat-scenarios/fixtures.mjs';

let failed = 0;
function fail(msg) { console.error('FAIL:', msg); failed++; }
function ok(msg) { console.log('OK:', msg); }

const sandbox = createSandbox({ quiet: true });
const ctx = createCleanCombatState(sandbox, {
  player: { bird: 'sparrow', energy: 6 },
  enemy: { bird: 'rockDove', energy: 6 },
});
const { enemy, G } = ctx;
const innate = findAbilityById(enemy, 'innate_rockDove');
if (!innate) { fail('rockDove enemy kit lacks innate_rockDove'); process.exit(1); }
const innateCd = sandbox.getTemplateCooldown(innate);
if (innateCd !== 3) fail(`Stone Refrain authored CD expected 3, got ${innateCd}`);
else ok('Stone Refrain authored cooldown is 3');

/* ---- rule helpers ------------------------------------------------------ */
sandbox.resetEnemyAbilityCooldowns();
if (!sandbox.enemyAbilityIsRepeatable('BASIC_PHYSICAL', enemy)) fail('basic attack should be repeatable');
else ok('basic attack is repeatable');
if (sandbox.enemyAbilityIsRepeatable('innate_rockDove', enemy)) fail('innate utility must not be repeatable');
else ok('innate utility is once-per-turn');

sandbox.registerEnemyAbilityUse(enemy, 'innate_rockDove');
if (sandbox.isEnemyAbilityAvailable('innate_rockDove', enemy)) fail('innate should be unavailable right after use');
else ok('innate unavailable in the same turn after use');
if (sandbox.getEnemyAbilityCooldown('innate_rockDove') !== 3) fail(`expected CD 3 after use, got ${sandbox.getEnemyAbilityCooldown('innate_rockDove')}`);
sandbox.resetEnemyTurnAbilityUse();
sandbox.tickEnemyAbilityCooldowns();
sandbox.tickEnemyAbilityCooldowns();
if (sandbox.isEnemyAbilityAvailable('innate_rockDove', enemy)) fail('innate should still be on cooldown after 2 ticks');
else ok('innate still on cooldown after 2 ticks');
sandbox.tickEnemyAbilityCooldowns();
if (!sandbox.isEnemyAbilityAvailable('innate_rockDove', enemy)) fail('innate should be available after 3 ticks');
else ok('innate available again after 3 ticks');
sandbox.registerEnemyAbilityUse(enemy, 'BASIC_PHYSICAL');
if (!sandbox.isEnemyAbilityAvailable('BASIC_PHYSICAL', enemy)) fail('basic attack must stay available after use');
else ok('basic attack stays available after use');

/* ---- planner: never plans a non-basic ability twice in one turn -------- */
sandbox.resetEnemyAbilityCooldowns();
let dupPlans = 0;
let innatePlans = 0;
for (let i = 0; i < 300; i++) {
  enemy.energy = 6;
  sandbox.resetEnemyTurnAbilityUse();
  const plan = sandbox.planEnemyTurn(enemy, G.player);
  const seen = {};
  for (const a of plan.actions || []) {
    if (a.type !== 'ability') continue;
    if (a.abilityId === 'innate_rockDove') innatePlans++;
    if (seen[a.abilityId] && !sandbox.enemyAbilityIsRepeatable(a.abilityId, enemy)) dupPlans++;
    seen[a.abilityId] = true;
  }
}
if (dupPlans !== 0) fail(`planner duplicated a once-per-turn ability in ${dupPlans} plans`);
else ok('planner never repeats a non-basic ability within a turn (300 plans)');
if (innatePlans === 0) fail('planner never selected the innate utility while it was available');
else ok(`planner still uses the innate when available (${innatePlans}/300 plans)`);

/* ---- planner: excludes abilities on cooldown --------------------------- */
let cdLeaks = 0;
for (let i = 0; i < 300; i++) {
  enemy.energy = 6;
  sandbox.resetEnemyTurnAbilityUse();
  G.enemyAbilityCooldowns = { innate_rockDove: 2 };
  const plan = sandbox.planEnemyTurn(enemy, G.player);
  if ((plan.actions || []).some((a) => a.abilityId === 'innate_rockDove')) cdLeaks++;
}
if (cdLeaks !== 0) fail(`planner selected an on-cooldown ability in ${cdLeaks} plans`);
else ok('planner never selects an on-cooldown ability (300 plans)');

/* ---- live enemyTurn: innate at most once per turn, never back-to-back --- */
const noopAsync = async () => {};
for (const fn of ['doSpell', 'doAttack', 'doMiss', 'doShield', 'doHeal', 'delay']) sandbox[fn] = noopAsync;
for (const fn of ['spawnFloat', 'playAvatarAnim', 'setHpBar', 'renderStatuses', 'renderEnemyPlan', 'refreshBattleUI',
  'lockActionUI', 'renderActions', 'setEnergyBar', 'renderEnergyOrbs', 'spawnTrendFloat', 'startPlayerTurn']) {
  sandbox[fn] = () => {};
}
sandbox.SFX = new Proxy({}, { get: () => () => {} });
const logs = [];
sandbox.logMsg = (msg) => { logs.push(String(msg)); };
sandbox.checkDeath = () => false;

sandbox.resetEnemyAbilityCooldowns();
G.player.stats.hp = G.player.stats.maxHp = 100000;
G.enemyStatus = {};
G.playerStatus = {};
const usesPerTurn = [];
for (let t = 0; t < 6; t++) {
  const before = logs.length;
  G.enemy.energy = 6;
  G.player.stats.hp = 100000;
  await sandbox.enemyTurn();
  const turnLogs = logs.slice(before);
  usesPerTurn.push(turnLogs.filter((l) => /Stone Refrain/.test(l)).length);
}
if (usesPerTurn.some((n) => n > 1)) fail(`Stone Refrain used more than once in a turn: ${usesPerTurn.join(',')}`);
else ok(`Stone Refrain at most once per enemy turn (${usesPerTurn.join(',')})`);
let backToBack = false;
let lastUse = -10;
usesPerTurn.forEach((n, i) => { if (n > 0) { if (i - lastUse < 3) backToBack = true; lastUse = i; } });
if (backToBack) fail(`Stone Refrain reused before its 3-turn cooldown elapsed: ${usesPerTurn.join(',')}`);
else ok('Stone Refrain respects its cooldown across live enemy turns');

/* ---- heal branch applies the authored row -------------------------------- */
const ctx2 = createCleanCombatState(sandbox, {
  player: { bird: 'sparrow', energy: 6 },
  enemy: { bird: 'robin', energy: 6 },
});
const robin = ctx2.enemy;
const mend = findAbilityById(robin, 'ESK-007');
if (!mend) { fail('robin enemy kit lacks ESK-007 Mend Weave'); }
else {
  if (sandbox.classifyKitAbilityForEnemyAI('ESK-007', robin) !== 'heal') fail('ESK-007 expected to classify as heal for the AI');
  robin.stats.hp = 50;
  robin.stats.maxHp = 150;
  robin.stats.magicArmour = 0;
  robin.stats.maxMagicArmour = robin.stats.normalMaxMagicArmour = 20;
  const hpBefore = robin.stats.hp;
  const marmBefore = robin.stats.magicArmour;
  const executed = await sandbox.executeEnemyKitTemplateAbility(robin, 'ESK-007', 0);
  if (!executed) fail('ESK-007 did not execute');
  if (robin.stats.hp !== hpBefore) fail(`Mend Weave must not heal Health (hp ${hpBefore} → ${robin.stats.hp})`);
  else ok('Mend Weave no longer heals 14% Health');
  if (!(robin.stats.magicArmour > marmBefore)) fail(`Mend Weave should restore Magic Armour (got ${robin.stats.magicArmour})`);
  else ok(`Mend Weave restores Magic Armour (${marmBefore} → ${robin.stats.magicArmour})`);
}

if (failed) { console.error(`verify-enemy-ability-cadence: ${failed} failure(s)`); process.exit(1); }
console.log('verify-enemy-ability-cadence: all checks passed');
