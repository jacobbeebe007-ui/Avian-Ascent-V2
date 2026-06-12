/* Unit tests for row-based combat damage (no EN power tier double-scaling). */
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

const combat = sandbox.Avian?.combat;
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

check('Avian.combat present', !!combat);
check('computeAbilityRawDamage is function', typeof combat?.computeAbilityRawDamage === 'function');
check('mitigatedDamage is function', typeof combat?.mitigatedDamage === 'function');
check('sumAdditiveDamageBonus is function', typeof combat?.sumAdditiveDamageBonus === 'function');

if (combat) {
  const treasureRow = {
    baseFlat: 5,
    scaleStat: 'ATK',
    scalePct: 68,
    secondaryScaleStat: 'MATK',
    secondaryScalePct: 22,
    apCost: 2,
  };
  const stats = { atk: 16, matk: 8 };
  const raw = combat.computeAbilityRawDamage(treasureRow, stats);
  const mitigated = combat.mitigatedDamage(raw, 6);
  const final = combat.roundCurvedDamage(mitigated);
  check('Treasure Ambush raw = 17.64', Math.abs(raw - 17.64) < 0.01, `got=${raw}`);
  check('Treasure Ambush mitigated ~14.22', Math.abs(mitigated - 14.218) < 0.05, `got=${mitigated}`);
  check('Treasure Ambush final = 14', final === 14, `got=${final}`);

  const bowerRow = {
    baseFlat: 2,
    scaleStat: 'MATK',
    scalePct: 38,
    secondaryScaleStat: 'ATK',
    secondaryScalePct: 28,
    apCost: 1,
  };
  const bowerRaw = combat.computeAbilityRawDamage(bowerRow, stats);
  const vsDef = combat.mitigatedDamage(bowerRaw, 6);
  const vsMdef = combat.mitigatedDamage(bowerRaw, 4);
  check('Bower Lure raw > 0', bowerRaw > 0, `got=${bowerRaw}`);
  check('Bower Lure MDEF mitigation differs from DEF', Math.abs(vsMdef - vsDef) > 0.01, `def=${vsDef} mdef=${vsMdef}`);

  const add = combat.sumAdditiveDamageBonus([0.10, 0.15, 0.20]);
  check('additive bonus 1+0.10+0.15+0.20 = 1.45', Math.abs(add - 1.45) < 0.0001, `got=${add}`);

  check('min damage 1 EN = 1', combat.applyMinimumDamage(0, 1) === 1);
  check('min damage 2 EN = 3', combat.applyMinimumDamage(1, 2) === 3);
  check('min damage 3 EN = 5', combat.applyMinimumDamage(2, 3) === 5);

  const selfTest = combat.runDamageFormulaSelfTest?.();
  check('runDamageFormulaSelfTest passes', !!selfTest?.ok, JSON.stringify(selfTest));

  const bowerTest = combat.runBowerLureSelfTest?.();
  check('runBowerLureSelfTest passes', !!bowerTest?.ok, JSON.stringify(bowerTest));
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '[ok]  ' : '[FAIL]'} ${c.name}${c.detail ? ` -- ${c.detail}` : ''}`);
}
if (failed.length) {
  console.error(`\n${failed.length} of ${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} of ${checks.length} checks passed.`);
process.exit(0);
