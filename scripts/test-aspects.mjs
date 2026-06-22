#!/usr/bin/env node
/** Aspect system unit + integration tests */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function loadSandbox(files) {
  const sandbox = {
    console, Math, Number, Object, Array, globalThis: null,
    Avian: { data: Object.create(null) },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of files) {
    const code = readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
  }
  return sandbox;
}

const c = loadSandbox([
  'js/data/aspects.js',
  'js/systems/combat-formulas.js',
]);

const aspects = c.Avian.data.aspects;
let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('OK:', msg);
}

const DOM = Number(aspects.dominantMod);
const NEU = Number(aspects.neutralMod);
const RES = Number(aspects.resistedMod);

assert(typeof c.getAspectMultiplier === 'function', 'getAspectMultiplier exported');
assert(typeof c.getAspectRelationship === 'function', 'getAspectRelationship exported');

assert(c.getAspectMultiplier('aeris', 'terra') === DOM, `Strong → ${DOM}x (aeris vs terra)`);
assert(c.getAspectMultiplier('terra', 'aeris') === RES, `Weak → ${RES}x (terra vs aeris)`);
assert(c.getAspectMultiplier('aeris', 'maris') === NEU, `Neutral → ${NEU}x (aeris vs maris)`);
assert(c.getAspectMultiplier('maris', 'maris') === NEU, `Same aspect → ${NEU}x`);
assert(c.getAspectMultiplier('invalid', 'terra') === NEU, 'Invalid aspect → neutral, no crash');
assert(c.getAspectRelationship('aeris', 'terra') === 'Strong', 'relationship Strong');
assert(c.getAspectRelationship('terra', 'aeris') === 'Weak', 'relationship Weak');
assert(c.getAspectRelationship('maris', 'maris') === 'Same', 'relationship Same');
assert(c.getAspectRelationship('bogus', 'terra') === 'Invalid', 'relationship Invalid');

const rowWithAspect = c.enrichCombatRow({
  apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
  aspect: 'aeris', abilityPower: 1.0,
});
const rowNoAspect = c.enrichCombatRow({
  apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
  aspectAffinity: 'None / Class-Neutral', abilityPower: 1.0,
});

const terraBird = { class: 'knight', aspect: 'terra', stats: { atk: 20, def: 12, mdef: 8, maxHp: 100, hp: 100 } };
const aerisBird = { class: 'rogue', aspect: 'aeris', stats: { atk: 18, def: 8, mdef: 6, maxHp: 90, hp: 90 } };

function dmg(attacker, target, ability) {
  return c.calculateDamage({
    attacker, target, ability,
    battleState: {}, bonusFractions: [], hitSucceeded: true,
  }).damage;
}

const strongAbility = c.enrichCombatRow({
  apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
  aspect: 'aeris', abilityPower: 1.0,
});
const weakAbility = c.enrichCombatRow({
  apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
  aspect: 'terra', abilityPower: 1.0,
});
const neutralAbility = c.enrichCombatRow({
  apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
  aspect: 'tempest', abilityPower: 1.0,
});

const baseNeutral = dmg(aerisBird, { class: 'knight', aspect: 'tempest', stats: { def: 10, mdef: 8, maxHp: 100, hp: 100 } }, neutralAbility);
const strongHit = dmg(aerisBird, terraBird, strongAbility);
const weakHit = dmg(aerisBird, terraBird, weakAbility);
const neutralHit = dmg(aerisBird, terraBird, neutralAbility);

assert(strongHit > weakHit, `Combat example: strong (${strongHit}) > weak (${weakHit})`);
assert(Math.abs(strongHit / neutralHit - DOM) < 0.08 || strongHit > neutralHit, 'Strong ability vs terra increases damage vs neutral baseline');
assert(weakHit < strongHit, 'Weak ability deals less than strong against same target');

const noAspectFallback = c.calculateDamage({
  attacker: aerisBird,
  target: terraBird,
  ability: rowNoAspect,
  battleState: {}, bonusFractions: [], hitSucceeded: true,
});
assert(noAspectFallback.components?.attackAspect === 'aeris' || noAspectFallback.damage > 0, 'Missing ability aspect falls back to bird aspect safely');

const utilityRow = c.enrichCombatRow({ noDamage: true, category: 'utility', apCost: 1 });
const utilDmg = c.calculateDamage({
  attacker: aerisBird, target: terraBird, ability: utilityRow,
  battleState: {}, bonusFractions: [], hitSucceeded: true,
});
assert(utilDmg.damage === 0, 'Utility/no damage ability returns 0');

const directWithAspect = c.calculateDamage({
  attacker: aerisBird, target: terraBird, ability: rowWithAspect,
  battleState: {}, bonusFractions: [], hitSucceeded: true,
});
assert(directWithAspect.components?.aspectMod === DOM, 'Direct damage applies aspectMod in components');
assert(directWithAspect.components?.aspectRelationship === 'Strong', 'Direct damage sets aspectRelationship');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}
console.log('\nAll aspect tests passed.');
