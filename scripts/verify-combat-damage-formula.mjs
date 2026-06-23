/* Master damage formula verification — full 27-case matrix (spec section 27). */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const aspectsPath = path.resolve('js/data/aspects.js');
const magnitudesPath = path.resolve('js/data/combat-stat-magnitudes.js');
const riderParserPath = path.resolve('js/systems/ability-rider-parser.js');
const formulasPath = path.resolve('js/systems/combat-formulas.js');
const aspectsSrc = readFileSync(aspectsPath, 'utf8');
const magnitudesSrc = readFileSync(magnitudesPath, 'utf8');
const riderParserSrc = readFileSync(riderParserPath, 'utf8');
const formulasSrc = readFileSync(formulasPath, 'utf8');

const sandbox = {
  console,
  Math, Number, Object, Array, String, JSON, globalThis: null,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
// Aspect chart must load first so getAspectMultiplier can read Avian.data.aspects.
vm.runInContext(aspectsSrc, sandbox, { filename: 'aspects.js', timeout: 5000 });
vm.runInContext(magnitudesSrc, sandbox, { filename: 'combat-stat-magnitudes.js', timeout: 5000 });
vm.runInContext(riderParserSrc, sandbox, { filename: 'ability-rider-parser.js', timeout: 5000 });
vm.runInContext(formulasSrc, sandbox, { filename: 'combat-formulas.js', timeout: 5000 });

const c = sandbox;
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}
function near(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

// ---- Exports + constants ----------------------------------------------------
check('calculateDamage exported', typeof c.calculateDamage === 'function');
check('clampCritChancePct exported', typeof c.clampCritChancePct === 'function');
check('clampCritDamageMult exported', typeof c.clampCritDamageMult === 'function');
check('MIN_HIT_CHANCE is 15', c.MIN_HIT_CHANCE === 15, `got=${c.MIN_HIT_CHANCE}`);
check('MASTER_BASE_CRIT_MULT is 1.35', c.MASTER_BASE_CRIT_MULT === 1.35, `got=${c.MASTER_BASE_CRIT_MULT}`);
check('MASTER_MAX_CRIT_MULT is 1.50', c.MASTER_MAX_CRIT_MULT === 1.5, `got=${c.MASTER_MAX_CRIT_MULT}`);
check('crit mult clamps to 1.50 ceiling', c.clampCritDamageMult(2.0) === 1.5, `got=${c.clampCritDamageMult(2.0)}`);
check('aspect chart loaded', typeof c.getAspectMultiplier === 'function' && c.getAspectMultiplier('terra', 'tempest') === 1.2, `got=${c.getAspectMultiplier('terra', 'tempest')}`);
check('enrichCombatRow exported', typeof c.enrichCombatRow === 'function');
check('usesMasterDamage exported', typeof c.usesMasterDamage === 'function');

const player = { class: 'rogue', stats: { atk: 16, matk: 8, def: 10, mdef: 8, spd: 12, maxHp: 100, hp: 100 } };
const mage = { class: 'mage', stats: { atk: 8, matk: 28, def: 6, mdef: 12, spd: 10, maxHp: 80, hp: 80 } };
const enemy = { stats: { def: 12, mdef: 10, hp: 50, maxHp: 100 } };
const burningEnemy = { stats: { def: 20, mdef: 10, hp: 50, maxHp: 100 } };

function dmg(params) {
  return c.calculateDamage(params).damage;
}

// 1 — 1 EN Light attack using ATK
{
  const ability = c.enrichCombatRow({ apCost: 1, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const d = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  const expected = Math.max(1, Math.round(5 * ability.abilityPower * c.getStatModifier(16, c.getClassBaseline('rogue')) * c.getDefenceModifier(12, 'Physical', 0, {})));
  check('1 — 1 EN Light ATK', d === expected, `got=${d} expected=${expected}`);
}

// 2 — 2 EN Medium attack using MATK
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'MATK', scalePct: 60, category: 'magic', damageType: 'Magic' });
  const d = dmg({ attacker: mage, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('2 — 2 EN Medium MATK uses 11 base', d >= 7, `got=${d}`);
  check('2 — Magic uses MDEF curve', c.getDefenceModifier(10, 'Magic', 0, {}) < 1, 'defMod');
}

// 3 — 3 EN Heavy attack using ATK with Heavy Accuracy Penalty
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 80, category: 'physical' });
  const penalty = c.calculateHeavyAccuracyPenalty(ability);
  check('3 — Heavy ATK accuracy penalty > 0', penalty > 0, `penalty=${penalty}`);
  const d = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('3 — Heavy ATK damage > 2 EN', d >= 10, `got=${d}`);
}

// 4 — 3 EN Recoil Heavy attack with 15% recoil
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 90, category: 'physical', abilityPower: 1.25 });
  check('4 — recoil percent is 15%', near(ability.recoilPercent, 0.15), `recoil%=${ability.recoilPercent}`);
  const recoil = c.calculateRecoilDamage(30, ability);
  check('4 — recoil = round(30 * 0.15) = 5', recoil === 5, `recoil=${recoil}`);
}

// 5 — Brute ability using DEF as damage stat
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'DEF', scalePct: 40, category: 'physical', damageStat: 'DEF' });
  const brute = { class: 'brute', stats: { atk: 16, def: 22, mdef: 8 } };
  check('5 — Brute baseline is 14', c.getClassBaseline('brute') === 14, `baseline=${c.getClassBaseline('brute')}`);
  const d = dmg({ attacker: brute, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('5 — Brute DEF stat attack > 0', d > 0 && ability.damageStat === 'DEF', `got=${d}`);
}

// 6 — Rogue ability using SPD as damage stat
{
  const ability = c.enrichCombatRow({ apCost: 1, scaleStat: 'SPD', scalePct: 50, category: 'physical', damageStat: 'SPD' });
  const spdAttacker = { class: 'rogue', stats: { atk: 10, spd: 20 } };
  const d = dmg({ attacker: spdAttacker, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  check('6 — Rogue SPD stat attack > 0', d > 0 && ability.damageStat === 'SPD', `got=${d}`);
}

// 7 — Bard/Inquisitor Hybrid attack using ATK + MATK
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 60, secondaryScaleStat: 'MATK', secondaryScalePct: 40, category: 'physical' });
  check('7 — hybrid attack stat blended', ability.damageStat === 'HYBRID' && !!ability.hybridScaling, JSON.stringify(ability.hybridScaling));
  const hybridAttacker = { class: 'bard', stats: { atk: 20, matk: 10 } };
  const blended = c.getRelevantAttackStat(hybridAttacker, ability);
  check('7 — relevant stat is blended (not additive)', near(blended, 20 * 0.6 + 10 * 0.4), `blended=${blended}`);
}

// 8 — Hybrid attack using blended DEF/MDEF for defence
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, secondaryScaleStat: 'MATK', secondaryScalePct: 50, category: 'physical' });
  const hybridDef = c.getRelevantDefenceStat(enemy, ability);
  const pureDef = c.getRelevantDefenceStat(enemy, { damageType: 'Physical' });
  check('8 — hybrid defence blends DEF/MDEF', hybridDef > 0 && hybridDef !== pureDef, `hybrid=${hybridDef} pure=${pureDef}`);
}

// 8b — Hybrid row with no explicit split defaults to an even ATK/MATK blend
{
  const ability = c.enrichCombatRow({ apCost: 2, category: 'hybrid', damageType: 'Hybrid', damageStat: 'HYBRID' });
  check('8b — implicit hybrid gets default scaling', !!ability.hybridScaling, JSON.stringify(ability.hybridScaling));
  const hybridAttacker = { class: 'bard', stats: { atk: 20, matk: 10 } };
  const blended = c.getRelevantAttackStat(hybridAttacker, ability);
  check('8b — implicit hybrid blends ATK+MATK (not ATK only)', near(blended, 20 * 0.5 + 10 * 0.5) && blended !== 20, `blended=${blended}`);
}

// 8c — Hybrid text split 60/40 from Display Text
{
  const ability = c.enrichCombatRow({
    apCost: 2,
    category: 'hybrid',
    damageType: 'Hybrid',
    damageStat: 'HYBRID',
    displayText: 'Uses 60% ATK and 40% MATK.',
  });
  check('8c — 60/40 hybrid from text', near(ability.hybridScaling.ATK, 0.6) && near(ability.hybridScaling.MATK, 0.4), JSON.stringify(ability.hybridScaling));
}

// 8d — Per-hit hybrid flag from text
{
  const ability = c.enrichCombatRow({
    apCost: 2,
    category: 'hybrid',
    damageType: 'Hybrid',
    damageStat: 'HYBRID',
    displayText: 'Hits twice. First hit uses ATK, second uses MATK; if both hit, gain Major ACC Up.',
  });
  check('8d — hybridPerHit from text', !!ability.hybridPerHit, `hybridPerHit=${ability.hybridPerHit}`);
  const split0 = c.calculateHybridDisplaySplit(10, Object.assign({}, ability, { hitIndex: 0 }));
  const split1 = c.calculateHybridDisplaySplit(10, Object.assign({}, ability, { hitIndex: 1 }));
  check('8d — per-hit display split hit0 physical', split0.physical === 10 && split0.magic === 0, JSON.stringify(split0));
  check('8d — per-hit display split hit1 magic', split1.magic === 10 && split1.physical === 0, JSON.stringify(split1));
}

// 9 — True Damage attack ignoring defence
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'true', damageType: 'True', damageStat: 'TRUE' });
  const d = dmg({ attacker: player, target: { stats: { def: 999, mdef: 999 } }, ability, bonusFractions: [], hitSucceeded: true });
  check('9 — true damage defMod = 1', c.getDefenceModifier(999, 'True', 0, {}) === 1, 'defMod');
  check('9 — true damage > 0 despite huge defence', d > 0, `got=${d}`);
}

// 10 / 27 — Multi-hit splits a single total across hits
{
  const split = c.calculateMultiHitDamage(17, 3);
  const sum = split.reduce((a, b) => a + b, 0);
  check('10 — multi-hit split length', split.length === 3, JSON.stringify(split));
  check('27 — multi-hit total once then split (sum preserved)', sum === 17, `sum=${sum}`);
}

// 11 — Conditional attack against Burning target
{
  const ability = c.enrichCombatRow({
    apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
    condition: 'targetBurning', conditionalAbilityPower: 1.20, conditionalAbilityPowerMode: 'replace',
  });
  const base = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyStatus: {} } });
  const burning = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyStatus: { burning: { turns: 2 } } } });
  check('11 — conditional vs Burning increases damage', burning > base, `base=${base} burning=${burning}`);
}

// 12 — Conditional attack against Bleeding target
{
  const ability = c.enrichCombatRow({
    apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical',
    condition: 'targetBleeding', conditionalAbilityPower: 1.25, conditionalAbilityPowerMode: 'replace',
  });
  const base = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyStatus: {} } });
  const bleeding = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, battleState: { enemyStatus: { bleed: { stacks: 2 } } } });
  check('12 — conditional vs Bleeding increases damage', bleeding > base, `base=${base} bleeding=${bleeding}`);
}

// 13 — Passive/perk/mutation/equipment bonuses capped (normal 30%)
{
  const cap = c.getBonusCap({ class: 'rogue' }, {});
  const bonus = c.getTotalDamageBonus([0.10, 0.15, 0.20], cap);
  check('13 — normal bonus cap = 0.30', near(bonus, 0.30), `bonus=${bonus}`);
}

// 14 — Boss using higher bonus cap (50%)
{
  const cap = c.getBonusCap({ isBoss: true }, {});
  const bonus = c.getTotalDamageBonus([0.20, 0.20, 0.20], cap);
  check('14 — boss bonus cap = 0.50', near(bonus, 0.50), `bonus=${bonus} cap=${cap}`);
}

// 15 — Attack that misses deals 0 damage
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const miss = c.calculateDamage({ attacker: player, target: enemy, ability, hitSucceeded: false });
  check('15 — miss deals 0', miss.damage === 0, `got=${miss.damage}`);
}

// 16–22 — Aspect effectiveness chart matchups
const aspectCases = [
  ['16', 'terra', 'tempest', 1.20, 'Dominant'],
  ['17', 'terra', 'aeris', 0.80, 'Resisted'],
  ['18', 'aeris', 'lunae', 1.20, 'Dominant'],
  ['19', 'tempest', 'maris', 1.20, 'Dominant'],
  ['20', 'solis', 'maris', 0.80, 'Resisted'],
  ['21', 'lunae', 'solis', 0.80, 'Resisted'],
  ['22', 'maris', 'terra', 1.20, 'Dominant'],
];
for (const [n, atk, def, expected] of aspectCases) {
  const mod = c.getAspectMultiplier(atk, def);
  check(`${n} — ${atk} vs ${def} = ${expected}x`, near(mod, expected), `got=${mod}`);
}

// 23 — Aspect_Mod is NOT reduced by Bonus_Mod caps
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const atkTerra = { class: 'rogue', aspect: 'terra', stats: { atk: 16 } };
  // Both capped identically; aspect dominant vs neutral should still differ by exactly 1.20x.
  const dominant = c.calculateDamage({ attacker: atkTerra, target: { aspect: 'tempest', stats: { def: 12 } }, ability, bonusFractions: [1.0], hitSucceeded: true });
  const neutral = c.calculateDamage({ attacker: atkTerra, target: { aspect: 'lunae', stats: { def: 12 } }, ability, bonusFractions: [1.0], hitSucceeded: true });
  check('23 — aspect dominant unaffected by capped bonus', near(dominant.components.aspectMod, 1.2) && near(neutral.components.aspectMod, 1.0) && near(dominant.components.bonusMod, neutral.components.bonusMod), `domAspect=${dominant.components.aspectMod} neuAspect=${neutral.components.aspectMod} domBonus=${dominant.components.bonusMod}`);
}

// 24 — True Damage ignores defence but still uses Aspect_Mod
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'true', damageType: 'True', damageStat: 'TRUE' });
  const atkTerra = { class: 'rogue', aspect: 'terra', stats: { atk: 16 } };
  const dominant = c.calculateDamage({ attacker: atkTerra, target: { aspect: 'tempest', stats: { def: 999, mdef: 999 } }, ability, bonusFractions: [], hitSucceeded: true });
  check('24 — true damage still applies aspect mod', near(dominant.components.aspectMod, 1.2) && dominant.components.defMod === 1, `aspectMod=${dominant.components.aspectMod} defMod=${dominant.components.defMod}`);
}

// 25 — Recoil is based on final damage dealt
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 90, category: 'physical', abilityPower: 1.35 });
  check('25 — recoil percent 20% at AP>=1.31', near(ability.recoilPercent, 0.20), `recoil%=${ability.recoilPercent}`);
  check('25 — recoil scales with final damage', c.calculateRecoilDamage(50, ability) === Math.round(50 * 0.20) && c.calculateRecoilDamage(10, ability) === Math.round(10 * 0.20), `r50=${c.calculateRecoilDamage(50, ability)} r10=${c.calculateRecoilDamage(10, ability)}`);
}

// 26 — Recoil is a pure function of final damage (does not depend on lifesteal/heal state)
{
  const ability = c.enrichCombatRow({ apCost: 3, scaleStat: 'ATK', scalePct: 90, category: 'physical', abilityPower: 1.25, lifestealPct: 50 });
  const r1 = c.calculateRecoilDamage(40, ability);
  const r2 = c.calculateRecoilDamage(40, ability);
  check('26 — recoil deterministic, independent of lifesteal', r1 === r2 && r1 === Math.round(40 * 0.15), `r1=${r1} r2=${r2}`);
}

// Extra: crit applies after the formula and respects the 1.50 ceiling
{
  const ability = c.enrichCombatRow({ apCost: 2, scaleStat: 'ATK', scalePct: 50, category: 'physical' });
  const normal = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true });
  const crit = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, isCriticalHit: true, critMultiplier: 1.35 });
  const critCapped = dmg({ attacker: player, target: enemy, ability, bonusFractions: [], hitSucceeded: true, isCriticalHit: true, critMultiplier: 5.0 });
  check('crit applies multiplier', crit >= normal, `normal=${normal} crit=${crit}`);
  check('crit never exceeds 1.50x ceiling', critCapped <= Math.round(normal * 1.5) + 1, `normal=${normal} critCapped=${critCapped}`);
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
