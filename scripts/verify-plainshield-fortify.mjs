#!/usr/bin/env node
/**
 * Bustard Plainshield must not apply Fortify multiple times from a spam race.
 * Cooldown + once-per-turn locks are committed before execute resolves.
 */
import { createSandbox } from './combat-scenarios/harness.mjs';
import { createCleanCombatState, findAbilityBySource } from './combat-scenarios/fixtures.mjs';

let failed = 0;
function fail(msg) { console.error('FAIL:', msg); failed++; }
function ok(msg) { console.log('OK:', msg); }

const sandbox = createSandbox({ quiet: true });
const ctx = createCleanCombatState(sandbox, {
  player: { bird: 'bustard', energy: 6, equipment: { mainHand: 'WPN-B02' } },
  enemy: { bird: 'crow', hp: 100 },
});
const ab = findAbilityBySource(ctx.player, 'utility');
if (!ab || ab.id !== 'innate_bustard') {
  fail(`expected innate_bustard, got ${ab && ab.id}`);
  process.exit(1);
}
ok('Plainshield resolved as innate_bustard');

if (sandbox.getTemplateCooldown(ab) !== 3) fail(`authored CD expected 3, got ${sandbox.getTemplateCooldown(ab)}`);
else ok('Plainshield authored cooldown is 3');

const fortifyRiders = (ab._dispatcherRow?.riders || []).filter((r) => r && r.kind === 'fortify');
if (fortifyRiders.length !== 1 || fortifyRiders[0].value !== 6) {
  fail(`expected one fortify:6 rider, got ${JSON.stringify(fortifyRiders)}`);
} else ok('Plainshield has a single Fortify 6 rider');

sandbox.G.turn = 'player';
sandbox.G.phase = 'PLAYER';
sandbox.G.turnPhase = 'PLAYER';
sandbox.G.animLock = false;
sandbox.G.battleOver = false;
sandbox.G.utilityUsedThisTurn = {};
sandbox.G.actionUsedThisTurn = {};
sandbox.G.abilityCooldowns = {};
sandbox.G.player.energy = 6;

let fortifyCalls = 0;
const orig = sandbox.Avian.protection.applyFortify.bind(sandbox.Avian.protection);
sandbox.Avian.protection.applyFortify = function (...args) {
  fortifyCalls += 1;
  return orig(...args);
};

/** Mirrors fixed playerAction: commit locks before await execute. */
async function lockedCast(ability) {
  if (sandbox.getAbilityCooldown(ability.id) > 0) return { rejected: true, reason: 'cooldown' };
  if (sandbox.G.utilityUsedThisTurn?.[ability.id]) return { rejected: true, reason: 'utility' };
  if (sandbox.G.actionUsedThisTurn?.[ability.actionSource]) return { rejected: true, reason: 'action' };
  if (!sandbox.canUseAbility(sandbox.G.player, ability)) return { rejected: true, reason: 'energy' };

  sandbox.G.utilityUsedThisTurn = sandbox.G.utilityUsedThisTurn || {};
  sandbox.G.utilityUsedThisTurn[ability.id] = true;
  sandbox.G.actionUsedThisTurn = sandbox.G.actionUsedThisTurn || {};
  sandbox.G.actionUsedThisTurn[ability.actionSource] = true;
  sandbox.setAbilityCooldown(ability);

  sandbox.spendEnergy(sandbox.G.player, ability);
  await sandbox.Avian.dispatcher.execute(ability);
  return { rejected: false };
}

fortifyCalls = 0;
const results = await Promise.all([lockedCast(ab), lockedCast(ab), lockedCast(ab)]);
const accepted = results.filter((r) => !r.rejected).length;
const rejected = results.filter((r) => r.rejected).length;

if (accepted !== 1) fail(`expected exactly 1 accepted Plainshield, got ${accepted}`);
else ok('parallel spam accepts Plainshield once');
if (rejected !== 2) fail(`expected 2 rejections, got ${rejected}`);
else ok('parallel spam rejects 2 follow-ups');
if (fortifyCalls !== 1) fail(`expected 1 applyFortify call, got ${fortifyCalls}`);
else ok('Fortify applied once under parallel spam');
if (sandbox.G.playerStatus.fortify?.amount !== 6) {
  fail(`Fortify bonus expected 6, got ${sandbox.G.playerStatus.fortify?.amount}`);
} else ok('Fortify bonus remains 6 (does not triple)');
if (sandbox.getAbilityCooldown(ab.id) !== 3) fail(`runtime CD expected 3, got ${sandbox.getAbilityCooldown(ab.id)}`);
else ok('Plainshield cooldown set to 3');

/* Same-bonus refresh must not re-heal */
const beforeArm = sandbox.G.player.stats.armour;
const gained = sandbox.Avian.protection.applyFortify(
  sandbox.G.player.stats,
  sandbox.G.playerStatus,
  6,
  2,
);
if (gained !== 0 || sandbox.G.player.stats.armour !== beforeArm) {
  fail(`same Fortify refresh re-healed: gained=${gained} armour ${beforeArm}→${sandbox.G.player.stats.armour}`);
} else ok('same-bonus Fortify refresh does not re-heal');

if (failed) {
  console.error(`\n[plainshield-fortify] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[plainshield-fortify] all checks passed');
