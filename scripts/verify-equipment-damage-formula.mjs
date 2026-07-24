/* Equipment v0.6 direct-scaling damage + ultimate meter verification. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve('.');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const namespaceSrc = read('js/bootstrap/_namespace.js');
const combatConfigSrc = read('js/data/combat-config.js');
const classesSrc = read('js/data/combat-pack/classes.js');
const aspectsSrc = read('js/data/aspects.js');
const riderParserSrc = read('js/systems/ability-rider-parser.js');
const formulasSrc = read('js/systems/combat-formulas.js');
const meterRuntimeSrc = read('js/systems/master-workbook-runtime.js');
const fixturesJson = JSON.parse(read('scripts/fixtures/equipment-damage-fixtures.json'));

const sandbox = {
  console,
  Math, Number, Object, Array, String, JSON, globalThis: null,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(namespaceSrc, sandbox, { filename: '_namespace.js', timeout: 5000 });
vm.runInContext(combatConfigSrc, sandbox, { filename: 'combat-config.js', timeout: 5000 });
vm.runInContext(classesSrc, sandbox, { filename: 'classes.js', timeout: 5000 });
vm.runInContext(aspectsSrc, sandbox, { filename: 'aspects.js', timeout: 5000 });
vm.runInContext(riderParserSrc, sandbox, { filename: 'ability-rider-parser.js', timeout: 5000 });
vm.runInContext(formulasSrc, sandbox, { filename: 'combat-formulas.js', timeout: 5000 });
vm.runInContext(meterRuntimeSrc, sandbox, { filename: 'master-workbook-runtime.js', timeout: 5000 });

const c = sandbox;

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}
function near(a, b, eps = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

check('Avian.isEquipmentV2', typeof c.Avian.isEquipmentV2 === 'function' && c.Avian.isEquipmentV2());
check('combatConfig loaded', !!c.Avian.data.combatConfig);
check('classes loaded', !!c.Avian.data.combatPack.classes);
check('directScaling enabled', !!(c.Avian.data.combatConfig.directScaling && c.Avian.data.combatConfig.directScaling.enabled));

check('pen cap 0.40', near(c.getDefenceModifier(100, 'Physical', 0.95, { useConstantDefence: true }), c.getDefenceModifier(100, 'Physical', 0.4, { useConstantDefence: true })), 'pen capped');
check('crit damage cap 2.0', c.clampCritDamageMult(5) === 2.0, `got=${c.clampCritDamageMult(5)}`);

function isMagicSkill(skillId) {
  return skillId === 'BASIC_MAGIC' || /STAFF|SCEPTRE|WAND|ORB|HEX|GRIMOIRE|SCYTHE|LAMENT|SONG/i.test(skillId);
}

for (const fx of fixturesJson.fixtures) {
  const magic = isMagicSkill(fx.skillId);
  const attacker = {
    class: fx.class,
    stats: {
      atk: magic ? 0 : fx.attackerScalingTotal,
      matk: magic ? fx.attackerScalingTotal : 0,
    },
  };
  const target = {
    stats: {
      def: magic ? 0 : fx.defenderDefence,
      mdef: magic ? fx.defenderDefence : 0,
    },
  };
  const ability = {
    enCost: fx.en,
    apCost: fx.en,
    scaleStat: magic ? 'MATK' : 'ATK',
    scalePct: 100,
    category: magic ? 'magic' : 'physical',
    damageType: magic ? 'Magic' : 'Physical',
    damageStat: magic ? 'MATK' : 'ATK',
    baseDamage: fx.baseDamage,
    fixedCoefficient: fx.ap,
    coefficientFixed: true,
    useDirectScaling: true,
    piercePercent: fx.penPct / 100,
  };
  c.enrichCombatRow(ability);

  const result = c.calculateDamage({ attacker, target, ability, hitSucceeded: true });
  const label = `${fx.class}/${fx.rarity}/${fx.skillId}`;
  const roundedDamage = Math.round(result.damage);
  check(`fixture ${label}`, roundedDamage === fx.expectedDamage, `got=${result.damage} rounded=${roundedDamage} expected=${fx.expectedDamage}`);
  check(`fixture directScaling ${label}`, !!result.components.directScaling, 'expected directScaling path');
  if (fx.defenceMod != null) {
    check(`fixture defMod ${label}`, near(result.components.defMod, fx.defenceMod, 0.02), `got=${result.components.defMod} expected=${fx.defenceMod}`);
  }
}

check('utility meter award is 0 (equipment)', c.computeUltimateMeterAward(
  { id: 'TEST_UTIL', _dispatcherRow: { id: 'TEST_UTIL', noDamage: true, enCost: 2, target: 'self' } },
  { utilitySucceeded: true, hitsLanded: 0 },
) === 0, `got=${c.computeUltimateMeterAward({ id: 'TEST_UTIL', _dispatcherRow: { id: 'TEST_UTIL', noDamage: true, enCost: 2, target: 'self' } }, { utilitySucceeded: true, hitsLanded: 0 })}`);

check('damaging hit meter award > 0 (equipment)', c.computeUltimateMeterAward(
  { id: 'TEST_DMG', _dispatcherRow: { id: 'TEST_DMG', enCost: 2, apCost: 2, target: 'enemy' } },
  { hitsLanded: 1 },
) === 12, `got=${c.computeUltimateMeterAward({ id: 'TEST_DMG', _dispatcherRow: { id: 'TEST_DMG', enCost: 2, apCost: 2, target: 'enemy' } }, { hitsLanded: 1 })}`);

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
