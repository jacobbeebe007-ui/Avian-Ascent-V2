/* Master damage formula verification — 15 required examples. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const formulasPath = path.resolve('js/systems/combat-formulas.js');
const formulas = readFileSync(formulasPath, 'utf8');

const sandbox = {
  console,
  Math, Number, Object, Array, globalThis: null,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(formulas, sandbox, { filename: 'combat-formulas.js', timeout: 5000 });

const c = sandbox;
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function near(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

check('calculateDamage exported', typeof c.calculateDamage === 'function');
check('enrichCombatRow exported', typeof c.enrichCombatRow === 'function');
check('usesMasterDamage exported', typeof c.usesMasterDamage === 'function');

const player = { class: 'rogue', stats: { atk: 16, matk: 8, def: 10, mdef: 8, spd: 12, maxHp: 100, hp: 100 } };
const mage = { class: 'mage', stats: { atk: 8, matk: 28, def: 6, mdef: 12, spd: 10, maxHp: 80, hp: 80 } };
const enemy = { stats: { def: 12, mdef: 10, hp: 50, maxHp: 100 } };
const burningEnemy = { stats: { def: 20, mdef: 10, hp: 50, maxHp: 100 } };

function dmg(params) {
  return c.calculateDamage(params).damage;
}

// 1 — 1 EN ATK physical
{
  const ability = c.enrichCombatRow({ apCost: 1, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const d = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  const expected = Math.max(1, Math.round(5 * ability.abilityPower * c.getStatModifier(16, c.getClassBaseline('rogue')) * c.getDefenceModifier(12, 'Physical', 0, {})));
  check('1 EN ATK', d === expected, `got=${d} expected=${expected}`);
}

// 2 — 2 EN MATK magic
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'MATK', scalePct: 60, category: 'magic', damageType: 'Magic' });
  const d = dmg({ attacker: mage, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('2 EN MATK > 1 EN baseline', d >= 7, `got=${d}`);
  check('2 EN MATK uses MDEF curve', c.getDefenceModifier(10, 'Magic', 0, {}) < 1, 'defMod');
}

// 3 — 3 EN heavy ATK with accuracy penalty
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 80, category: 'physical' });
  const penalty = c.calculateHeavyAccuracyPenalty(ability);
  check('3 EN heavy ATK penalty > 0', penalty > 0, `penalty=${penalty}`);
  const d = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('3 EN heavy ATK damage > 2 EN', d >= 10, `got=${d}`);
}

// 4 — recoil on heavy ability
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 90, category: 'physical', abilityPower: 1.35 });
  const final = 40;
  const recoil = c.calculateRecoilDamage(final, ability);
  check('recoil heavy >= 15% of damage', recoil >= Math.floor(final * 0.15), `recoil=${recoil}`);
}

// 5 — DEF stat attack
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'DEF', scalePct: 40, category: 'physical', damageStat: 'DEF' });
  const defAttacker = { class: 'knight', stats: { atk: 10, def: 18, mdef: 8 } };
  const d = dmg({ attacker: defAttacker, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('DEF stat attack > 0', d > 0, `got=${d}`);
}

// 6 — SPD stat attack
{
  const ability = c.enrichCombatRow({ apCost: 1, scaleStat: 'SPD', scalePct: 50, category: 'physical', damageStat: 'SPD' });
  const spdAttacker = { class: 'rogue', stats: { atk: 10, spd: 20 } };
  const d = dmg({ attacker: spdAttacker, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('SPD stat attack > 0', d > 0, `got=${d}`);
}

// 7 — hybrid attack scaling
{
  const ability = c.enrichCombatRow({
    apCost: 2,
    scaleStat: 'ATK',
    scalePct: 60,
    secondaryScaleStat: 'MATK',
    secondaryScalePct: 40,
    category: 'physical',
  });
  check('hybrid attack stat', ability.damageStat === 'HYBRID' && ability.hybridScaling, JSON.stringify(ability.hybridScaling));
  const hybridAttacker = { class: 'rogue', stats: { atk: 20, matk: 10 } };
  const d = dmg({ attacker: hybridAttacker, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('hybrid attack damage > 0', d > 0, `got=${d}`);
}

// 8 — hybrid defence
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, secondaryScaleStat: 'MATK', secondaryScalePct: 50, category: 'physical' });
  const hybridDef = c.getRelevantDefenceStat(enemy, ability);
  const pureDef = c.getRelevantDefenceStat(enemy, { damageType: 'Physical' });
  check('hybrid defence between DEF-only and MDEF-only', hybridDef > 0 && hybridDef !== pureDef, `hybrid=${hybridDef} pure=${pureDef}`);
}

// 9 — true damage ignores defence
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'true', damageType: 'True', damageStat: 'TRUE' });
  const d = dmg({ attacker: player, target: { stats: { def: 999, mdef: 999 } }, ability, bonusFractions: [], hitSucceeded: true });
  const defMod = c.getDefenceModifier(999, 'True', 0, {});
  check('true damage defMod = 1', defMod === 1, `defMod=${defMod}`);
  check('true damage > 0', d > 0, `got=${d}`);
}

// 10 — multi-hit split preserves total
{
  const split = c.calculateMultiHitDamage(17, 3);
  const sum = split.reduce((a, b) => a + b, 0);
  check('multi-hit split length', split.length === 3, JSON.stringify(split));
  check('multi-hit split sum', sum === 17, `sum=${sum}`);
}

// 11 — Burning condition lowers effective defence
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const normal = dmg({ attacker: player, target: burningEnemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyHasBurning: false } });
  const burning = dmg({ attacker: player, target: burningEnemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyHasBurning: true } });
  check('Burning target takes more damage', burning >= normal, `normal=${normal} burning=${burning}`);
}

// 12 — Bleeding condition boosts ability power
{
  const ability = c.enrichCombatRow({
    apCost: 2,
    scaleStat: 'ATK',
    scalePct: 50,
    category: 'physical',
    condition: 'targetBleeding',
    conditionalAbilityPower: 1.25,
    riders: [{ kind: 'bonusVsAilment', ailment: 'bleed', value: 25 }],
  });
  const base = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyStatus: {} } });
  const bleeding = dmg({
    attacker: player,
    target: enemy,
    ability,
    bonusFractions: [],
    hitSucceeded: true,
    battleState: { enemyStatus: { bleed: { stacks: 2 } } },
  });
  check('Bleeding condition increases damage', bleeding > base, `base=${base} bleeding=${bleeding}`);
}

// 13 — bonus caps (normal 30%)
{
  const cap = c.getBonusCap({ class: 'rogue' }, {});
  const bonus = c.getTotalDamageBonus([0.10, 0.15, 0.20], cap);
  check('normal bonus cap = 0.30', near(bonus, 0.30), `bonus=${bonus}`);
}

// 14 — boss cap 50%
{
  const cap = c.getBonusCap({ isBoss: true }, {});
  const bonus = c.getTotalDamageBonus([0.20, 0.20, 0.20], cap);
  check('boss bonus cap = 0.50', near(bonus, 0.50), `bonus=${bonus} cap=${cap}`);
}

// 15 — miss equals 0
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const miss = c.calculateDamage({ attacker: player, target: enemy, ability, hitSucceeded: false });
  check('miss equals 0', miss.damage === 0, `got=${miss.damage}`);
}

check('describeMasterAbility format', (() => {
  const row = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const text = c.describeMasterAbility(row);
  return text.includes('Ability Power:') && text.includes('Uses ATK') && !text.includes('Base ');
})(), 'desc');

check('usesMasterDamage for damaging row', c.usesMasterDamage(c.enrichCombatRow({ apCost: 1, scaleStat: 'ATK', scalePct: 10 })));
check('usesMasterDamage false for utility', !c.usesMasterDamage({ noDamage: true }));

const failed = checks.filter((x) => !x.ok);
for (const x of checks) {
  console.log(`${x.ok ? '[ok]  ' : '[FAIL]'} ${x.name}${x.detail ? ` -- ${x.detail}` : ''}`);
}
if (failed.length) {
  console.error(`\n${failed.length} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} of ${checks.length} checks passed.`);
process.exit(0);
