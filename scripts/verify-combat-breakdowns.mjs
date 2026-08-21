import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { console, performance: { now: () => 1 }, globalThis: null };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/bootstrap/_namespace.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/systems/combat-breakdown.js', 'utf8'), context);
const api = context.Avian.systems.combatBreakdown;

const calc = { damage: 12, preMitigation: 15, effectiveDef: 3, components: { weaponDamage: 8, enBase: 8, skillPowerPct: 125, relevantStat: 4, defStat: 7, defMod: .8, typeMod: 1, bonusMod: 1, weaponFirst: true } };
const params = { attacker: { id: 'player' }, target: { id: 'enemy' }, ability: { id: 'WSK-026', name: 'Sundering Wing', damageType: 'Physical', scaleStat: 'Might', enCost: 3, flatPen: 4 }, isCriticalHit: false, hitSucceeded: true };
calc.breakdown = api.fromCalculation(calc, params);
api.captureCalculation(calc);
api.routeDamage({ remaining: 2, absorbed: 10, poolBefore: 10, poolAfter: 0, poolKey: 'armour', isMagic: false });
const result = api.getHistory()[0];
assert.equal(result.damage.totalDamage, 12, 'reported total equals formula damage');
assert.equal(result.damage.armourDamage + result.damage.healthDamage, result.damage.totalDamage, 'martial routing totals');
assert.equal(result.damage.effectiveDefence, 3, 'effective defence is the runtime value');
assert.equal(result.damage.weaponRoll, 8, 'weapon roll is retained');
assert.equal(result.damage.skillPowerPercent, 125, 'Skill Power is retained');

const magic = api.fromCalculation({ damage: 9, preMitigation: 10, components: { defStat: 1, typeMod: 1, bonusMod: 1 } }, { ability: { id: 'spell', damageType: 'Magic' } });
api.captureCalculation({ breakdown: magic });
api.routeDamage({ remaining: 3, absorbed: 6, poolKey: 'magicArmour', isMagic: true });
assert.equal(magic.damage.magicArmourDamage + magic.damage.healthDamage, magic.damage.totalDamage, 'magic routing totals');
console.log('Combat breakdown invariants verified.');
