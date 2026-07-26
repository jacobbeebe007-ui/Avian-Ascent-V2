/* Equipment v0.9 weapon-first damage + ultimate meter verification. */
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
check('weaponFirst enabled', !!(c.Avian.data.combatConfig.weaponFirst && c.Avian.data.combatConfig.weaponFirst.enabled));
check('directScaling disabled', !(c.Avian.data.combatConfig.directScaling && c.Avian.data.combatConfig.directScaling.enabled));

check('mitigation 10 Guard → 20%', near(c.getMitigationFraction(10), 0.2, 0.001), `got=${c.getMitigationFraction(10)}`);
check('mitigation cap 75%', near(c.getMitigationFraction(120), 0.75, 0.001), `got=${c.getMitigationFraction(120)}`);
check('pen cap 0.40', near(
  c.getDefenceModifier(100, 'Physical', 0.95, { useRatingMitigation: true }),
  c.getDefenceModifier(100, 'Physical', 0.4, { useRatingMitigation: true }),
), 'pen capped');
check('crit damage cap 2.0', c.clampCritDamageMult(5) === 2.0, `got=${c.clampCritDamageMult(5)}`);

function scalingKeyFor(skillId, fx) {
  if (fx.scalingStat) {
    const u = String(fx.scalingStat).toUpperCase();
    if (u === 'DEX' || u === 'DEXTERITY') return 'dex';
    if (u === 'MATK' || u === 'FOCUS') return 'matk';
    if (u === 'SPD' || u === 'AGILITY') return 'spd';
    return 'atk';
  }
  if (/STAFF|SCEPTRE|WAND|ORB|HEX|GRIMOIRE|SCYTHE|LAMENT|SONG|BASIC_MAGIC/i.test(skillId)) return 'matk';
  if (/DAGGER|TALON|PINION|SABRE|BOW/i.test(skillId)) return 'dex';
  return 'atk';
}

for (const fx of fixturesJson.fixtures) {
  const sk = scalingKeyFor(fx.skillId, fx);
  const magic = sk === 'matk' || fx.skillId === 'BASIC_MAGIC';
  const attacker = {
    class: fx.class,
    stats: {
      atk: sk === 'atk' ? fx.attackerScalingTotal : 0,
      dex: sk === 'dex' ? fx.attackerScalingTotal : 0,
      matk: sk === 'matk' ? fx.attackerScalingTotal : 0,
      spd: sk === 'spd' ? fx.attackerScalingTotal : 0,
    },
  };
  const target = {
    stats: {
      def: magic ? 0 : fx.defenderDefence,
      mdef: magic ? fx.defenderDefence : 0,
    },
  };
  const ability = {
    id: fx.skillId,
    enCost: fx.en,
    apCost: fx.en,
    scalingStat: sk === 'dex' ? 'DEX' : (magic ? 'MATK' : 'ATK'),
    damageStat: sk === 'dex' ? 'DEX' : (magic ? 'MATK' : 'ATK'),
    scaleStat: sk === 'dex' ? 'DEX' : (magic ? 'MATK' : 'ATK'),
    damageType: magic ? 'Magic' : 'Physical',
    skillPowerPct: fx.skillPowerPct,
    fixedCoefficient: (fx.skillPowerPct || 100) / 100,
    coefficientFixed: true,
    useWeaponFirst: true,
    naturalStrikeFlat: /BASIC_/i.test(fx.skillId) ? { min: 1, max: 2 } : null,
    piercePercent: (fx.penPct || 0) / 100,
  };

  const result = c.calculateDamage({
    attacker,
    target,
    ability,
    hitSucceeded: true,
    weaponDamage: fx.weaponDamage,
  });
  const label = `${fx.class}/${fx.rarity}/${fx.skillId}`;
  const roundedDamage = Math.round(result.damage);
  check(`fixture ${label}`, roundedDamage === fx.expectedDamage, `got=${result.damage} rounded=${roundedDamage} expected=${fx.expectedDamage}`);
  check(`fixture weaponFirst ${label}`, !!result.components.weaponFirst, 'expected weaponFirst path');
  if (fx.mitigation != null) {
    const mit = 1 - Number(result.components.defMod);
    check(`fixture mit ${label}`, near(mit, fx.mitigation, 0.02), `got=${mit} expected=${fx.mitigation}`);
  }
}

check('utility meter award is 0 (equipment)', c.computeUltimateMeterAward(
  { id: 'TEST_UTIL', _dispatcherRow: { id: 'TEST_UTIL', noDamage: true, enCost: 2, target: 'self' } },
  { utilitySucceeded: true, hitsLanded: 0 },
) === 0, `got=${c.computeUltimateMeterAward({ id: 'TEST_UTIL', _dispatcherRow: { id: 'TEST_UTIL', noDamage: true, enCost: 2, target: 'self' } }, { utilitySucceeded: true, hitsLanded: 0 })}`);

const failed = checks.filter((x) => !x.ok);
for (const x of checks) {
  console.log(`${x.ok ? 'PASS' : 'FAIL'} ${x.name}${x.detail ? ' — ' + x.detail : ''}`);
}
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nOK — ${checks.length} checks`);
