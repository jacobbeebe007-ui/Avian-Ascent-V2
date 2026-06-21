/* Hit chance, crit chance, and crit damage verification — spec examples. */
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
  if (!ok) console.error('FAIL:', name, detail || '');
  else console.log('OK:', name);
}

// 1 — Heavy attack hit example: ACC 82, penalty 12, dodge 20 → 50%
{
  const hit = c.calculateAbilityHitChancePct(82, 20, 12);
  check('Heavy hit example 50%', hit === 50, `got=${hit}`);
}

// 2 — Hit clamps
{
  check('Hit clamp max 95%', c.calculateAbilityHitChancePct(200, 0, 0) === 95);
  check('Hit clamp min 15%', c.calculateAbilityHitChancePct(10, 80, 0) === 15);
}

// 3 — Crow example: ACC 78, penalty 0, dodge 18 → 60%
{
  const hit = c.calculateAbilityHitChancePct(78, 18, 0);
  check('Crow Bone Lance hit 60%', hit === 60, `got=${hit}`);
}

// 4 — Crit chance clamps
{
  check('Crit chance 12+8=20%', c.clampCritChancePct(20) === 20);
  check('Crit chance cap 50%', c.clampCritChancePct(60) === 50);
  check('Crit chance floor 0%', c.clampCritChancePct(-5) === 0);
}

// 5 — Crit damage clamps and example
{
  const mult = c.clampCritDamageMult(1.5);
  check('Base crit damage 1.50x', mult === 1.5, `got=${mult}`);
  check('Crit damage cap 2.00x', c.clampCritDamageMult(2.5) === 2);
  check('Crit damage floor 1.25x', c.clampCritDamageMult(1.0) === 1.25);
  const dmg = Math.round(20 * c.clampCritDamageMult(1.5));
  check('20 dmg × 1.50 crit = 30', dmg === 30, `got=${dmg}`);
}

// 6 — Power-tier accuracy penalties
{
  const tiers = [
    { power: 0.95, expected: 0 },
    { power: 1.05, expected: 5 },
    { power: 1.15, expected: 8 },
    { power: 1.25, expected: 12 },
    { power: 1.35, expected: 15 },
  ];
  for (const t of tiers) {
    const row = c.enrichCombatRow({ apCost: 2, abilityPower: t.power, scaleStat: 'ATK', scalePct: 50 });
    const pen = c.calculateAbilityAccuracyPenalty(row);
    check(`Power ${t.power} penalty ${t.expected}`, pen === t.expected, `got=${pen}`);
  }
}

// 7 — Miss path returns zero damage
{
  const result = c.calculateDamage({ hitSucceeded: false, attacker: {}, target: {}, ability: { apCost: 1 } });
  check('Miss path damage 0', result.damage === 0);
}

// 8 — EN-cost penalty deprecated (always 0)
{
  check('EN penalty removed', c.getAccuracyPenaltyForEnCost(3) === 0);
}

const failed = checks.filter((x) => !x.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) {
  failed.forEach((f) => console.error('  -', f.name, f.detail || ''));
  process.exit(1);
}
