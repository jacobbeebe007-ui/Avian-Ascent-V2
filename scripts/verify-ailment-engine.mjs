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

eq(ctx.calcPoisonTickDmg(3, 1), 3, 'poison 3 stacks = 3 dmg');
eq(ctx.calcPoisonTickDmg(5, 1), 5, 'poison 5 stacks = 5 dmg');

const gBoss = { enemy: { isBoss: true } };
const gNorm = { enemy: { isBoss: false } };
eq(ctx.calcToxicTickDmg(200, gNorm, 'enemy'), 12, 'toxic cap normal 12');
eq(ctx.calcToxicTickDmg(200, gBoss, 'enemy'), 8, 'toxic cap boss 8');

eq(ctx.calcBleedTickDmg(100, 2, gNorm, 'enemy'), 4, 'bleed 2 stacks 4% of 100');
eq(ctx.calcBleedTickDmg(500, 3, gNorm, 'enemy'), 8, 'bleed cap normal 8');

eq(ctx.getBleedHealMult(1), 0.85, 'bleed 1 stack heal mult');
eq(ctx.getBleedHealMult(3), 0.55, 'bleed 3 stack heal mult');

eq(ctx.getWeakenDamageMultFromRules(3), 0.76, 'weaken 3 stacks dmg mult');
eq(ctx.getWeakenDodgePenaltyFromRules(3), 12, 'weaken 3 stacks dodge pen');

eq(ctx.getChilledSpdMult(5), 0.7, 'chilled 5 stacks spd mult');
eq(ctx.getBurningDefMult(3, false), 0.88, 'burning 3 stacks def mult');
eq(ctx.getBurningDefMult(0, true), 0.88, 'scorched def mult');

eq(ctx.getDelayedStoragePct('light', 1), 0.25, 'delayed light 25%');
eq(ctx.getDelayedStoragePct('heavy', 3), 0.45, 'delayed heavy 45%');
eq(ctx.getDelayedStoragePct(null, 4), 0.5, 'delayed special 50%');

eq(ctx.resolveAilmentChance(25, 'enemy', { enemy: { isBoss: false } }, {}), 25, 'resist 0 → 25%');
eq(ctx.resolveAilmentChance(25, 'enemy', { enemy: { isBoss: true } }, {}), 5, 'boss resist 20 → min 5%');
eq(ctx.resolveAilmentChance(10, 'enemy', { enemy: { isBoss: true } }, {}), 5, 'floor at 5%');

eq(ctx.hasAilmentGuard({ frostGuard: { turns: 1 } }, 'frostGuard'), true, 'frost guard active');
eq(ctx.hasAilmentGuard({}, 'frostGuard'), false, 'no frost guard');

if (failed) {
  console.error(`\n[ailment-engine] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[ailment-engine] all checks passed');
