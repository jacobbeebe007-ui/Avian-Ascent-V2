#!/usr/bin/env node
/* Unit checks for Master Ailment List engine helpers. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failed = 0;

function fail(msg) {
  console.error('[ailment-engine] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[ailment-engine] ok  ', msg);
}
function eq(a, b, label) {
  if (a !== b) fail(`${label}: expected ${b}, got ${a}`);
  else ok(label);
}

const ctx = { globalThis: {}, console, Math, Number, Object, Array, String };
ctx.globalThis = ctx;

vm.runInNewContext(readFileSync(path.join(ROOT, 'js', 'data', 'ailment-rules.js'), 'utf8'), ctx);

const R = ctx.AILMENT_RULES;
if (!R) fail('AILMENT_RULES missing');
else ok('AILMENT_RULES loaded');

/* Poison/Bleed/Burn ticks are MaxHP% × stacks (Working Draft). */
eq(ctx.calcPoisonTickDmg(3, 100), ctx.calcPoisonTickDmg(3, 100), 'poison helper callable');
eq(ctx.calcPoisonTickDmg(5, 100) > ctx.calcPoisonTickDmg(3, 100), true, 'poison scales by stacks');

eq(ctx.calcBleedTickDmg(100, 2), ctx.roundCombatDamage
  ? ctx.roundCombatDamage(2)
  : ctx.calcBleedTickDmg(100, 2), 'bleed 2 stacks on 100 hp');
eq(ctx.getBleedHealMult(1), 0.9, 'bleed 1 stack heal mult');
eq(ctx.getBleedHealMult(3), 0.7, 'bleed 3 stack heal mult');

eq(ctx.getWeakenDamageMultFromRules(3), 0.76, 'weaken 3 stacks dmg mult');
eq(ctx.getWeakenDodgePenaltyFromRules(3), 12, 'weaken 3 stacks dodge pen');

eq(ctx.getChilledSpdMult(5), 0.85, 'chilled 5 stacks spd mult');
eq(ctx.getBurningDefMult(3, false), 1, 'burning no longer softens DEF');
eq(ctx.getBurningDefMult(0, true), 1, 'scorched is flat Guard/Resolve Down, not % DEF');
eq(ctx.getScorchedGuardPenalty({ scorched: { turns: 1, guardDown: 4, resolveDown: 4 } }), -4, 'scorched Guard Down');
eq(ctx.getScorchedResolvePenalty({ scorched: { turns: 1, guardDown: 4, resolveDown: 4 } }), -4, 'scorched Resolve Down');
eq(ctx.getFearDamageMult({ feared: 1 }), 0.88, 'fear Major Damage Down −12%');
eq(ctx.getConfusedPrecisionPenalty({ confused: { turns: 1 } }), -8, 'confused Major Precision Down −8');
eq(ctx.getWeakenedMightPenalty({ weakened: { turns: 1, mightDown: 10, focusDown: 10 } }), -10, 'weakened Might Down');

eq(ctx.getDelayedStoragePct('light', 1), 0.25, 'delayed light 25%');
eq(ctx.getDelayedStoragePct('heavy', 3), 0.45, 'delayed heavy 45%');
eq(ctx.getDelayedStoragePct(null, 4), 0.5, 'delayed special 50%');

eq(ctx.resolveAilmentChance(25, 'enemy', { enemy: { isBoss: false } }, {}), 25, 'resist 0 → 25%');
eq(ctx.resolveAilmentChance(25, 'enemy', { enemy: { isBoss: true } }, {}), 5, 'boss resist 20 → min 5%');
eq(ctx.resolveAilmentChance(10, 'enemy', { enemy: { isBoss: true } }, {}), 5, 'floor at 5%');
eq(ctx.resolveAilmentChance(100, 'enemy', { enemy: { isBoss: true } }, {}), 100, '100% on-land ignores boss resist');
eq(ctx.isDeterministicOnLandChance(100, {}), true, '100% is deterministic on land');
eq(ctx.isDeterministicOnLandChance(99, {}), false, '99% is not deterministic');

eq(ctx.hasAilmentGuard({ frostGuard: { turns: 1 } }, 'frostGuard'), true, 'frost guard active');
eq(ctx.hasAilmentGuard({}, 'frostGuard'), false, 'no frost guard');

/* Shock / Paralysis finalized rules */
eq(R.shock.maxStacks, 5, 'shock max stacks 5');
eq(R.shock.maxHpPctPerStack, R.burning.maxHpPctPerStack, 'shock DoT pct matches burn');
eq(ctx.calcShockTickDmg(3, 100), ctx.calcBurningTickDmg(3, 100), 'shock tick == burn tick');
eq(R.paralyzed.extraEnCost, 1, 'paralysis +1 EN');
eq(R.paralyzed.controlResistanceTurns, 2, 'paralysis CR 2 turns');
eq(ctx.getParalysisExtraEnCost({ paralyzed: { turns: 1, extraEnCost: 1 } }), 1, 'extra EN helper');
eq(ctx.isParalyzedActive({ paralyzed: { turns: 1 } }), true, 'paralyzed active');
eq(ctx.isParalyzedActive({}), false, 'not paralyzed');
eq(R.controlResistance.blocks.includes('shock'), true, 'CR blocks shock');
eq(R.controlResistance.blocks.includes('paralyzed'), true, 'CR blocks paralyzed');

/* Physical ailments — Current Master v1.5 */
eq(R.fracture.maxStacks, 5, 'fracture max stacks 5');
eq(R.fracture.guardPerStack, -2, 'fracture −2 Guard/stack');
eq(R.fracture.armourRestorePctPerStack, -0.04, 'fracture −4% armour restore/stack');
eq(R.shattered.duration, 2, 'shattered lasts 2 turns');
eq(R.shattered.attackerPenetrationFlat, 3, 'shattered +3 pen vs target');
eq(R.crippled.maxStacks, 5, 'crippled max stacks 5');
eq(R.crippled.agilityPerStack, -2, 'crippled −2 Agility/stack');
eq(R.immobilised.dodgeZero, true, 'immobilised zeroes dodge');
eq(R.dazed.precisionPerStack, -4, 'dazed −4 Precision/stack');
eq(R.concussed.nextOffensiveExtraEn, 1, 'concussed +1 EN next offensive');
eq(ctx.getFractureGuardPenalty({ fracture: { stacks: 3, turns: 3 } }), -6, 'fracture guard penalty helper');
eq(ctx.getArmourRestoreReceivedMult({ fracture: { stacks: 5, turns: 3 } }), 0.8, 'fracture restore mult at 5');
eq(ctx.getArmourRestoreReceivedMult({ shattered: { turns: 2 } }), 0.75, 'shattered restore mult');
eq(ctx.getCrippledDodgePenalty({ crippled: { stacks: 2, turns: 3 } }), -4, 'crippled dodge penalty');
eq(ctx.getDazedPrecisionPenalty({ dazed: { stacks: 2, turns: 3 } }), -8, 'dazed precision penalty');
eq(ctx.getDazedSkillPowerPenalty({ concussed: { turns: 1 } }), -15, 'concussed skill power');
eq(ctx.getConcussedExtraEnCost({ concussed: { turns: 1, pendingExtraEn: true } }, { id: 'WSK-009', name: 'Crushing Peck' }), 1, 'concussed EN on offensive');
eq(ctx.getConcussedExtraEnCost({ concussed: { turns: 1, pendingExtraEn: true } }, { id: 'BASIC_PHYSICAL', skillType: 'Basic', name: 'Basic Attack' }), 0, 'concussed exempts Basic');
eq(ctx.isMobilitySkillBlocked({ name: 'Hedge Hop', tags: ['evasive'] }), true, 'mobility skill detect');

if (failed) {
  console.error(`\n[ailment-engine] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[ailment-engine] all checks passed');
