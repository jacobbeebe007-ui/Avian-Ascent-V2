#!/usr/bin/env node
/* Verify Armour / Magic Armour / Fortify / Ward protection pools (equipment v1.2). */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
let failed = 0;
function fail(msg) { console.error('FAIL:', msg); failed++; }
function ok(msg) { console.log('OK:', msg); }

function load(relPaths) {
  const sandbox = { globalThis: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of relPaths) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) { fail('missing ' + rel); continue; }
    vm.runInContext(readFileSync(full, 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

const ctx = load([
  'js/bootstrap/_namespace.js',
  'js/data/combat-config.js',
  'js/data/equipment/core-rules.js',
  'js/data/equipment/ailment-gates.js',
  'js/systems/protection-pools.js',
]);

const prot = ctx.Avian && ctx.Avian.protection;
if (!prot) { fail('Avian.protection missing'); process.exit(1); }

const stats = {
  normalMaxArmour: 24,
  maxArmour: 24,
  armour: 20,
  normalMaxMagicArmour: 18,
  maxMagicArmour: 18,
  magicArmour: 15,
};
const status = {};

/* Fortify: 20/24 + 12 → 32/36 */
prot.applyFortify(stats, status, 12, 2);
if (stats.armour !== 32 || stats.maxArmour !== 36) fail(`Fortify expected 32/36, got ${stats.armour}/${stats.maxArmour}`);
else ok('Fortify heals + overflows to 32/36');

stats.armour = 27;
prot.expireFortify(stats, status);
if (stats.armour !== 24 || stats.maxArmour !== 24) fail(`Fortify expiry expected 24/24, got ${stats.armour}/${stats.maxArmour}`);
else ok('Fortify expiry clamps to normal max');

/* Ward */
stats.magicArmour = 15;
stats.maxMagicArmour = 18;
stats.normalMaxMagicArmour = 18;
prot.applyWard(stats, status, 8, 2);
if (stats.magicArmour !== 23 || stats.maxMagicArmour !== 26) fail(`Ward expected 23/26, got ${stats.magicArmour}/${stats.maxMagicArmour}`);
else ok('Ward heals + overflows to 23/26');

/* Restoration capped */
stats.armour = 18;
stats.normalMaxArmour = 24;
stats.maxArmour = 24;
const restored = prot.restoreArmour(stats, 8);
if (stats.armour !== 24 || restored !== 6) fail(`Restore expected +6 to 24, got restore=${restored} armour=${stats.armour}`);
else ok('Armour restoration caps at normal max');

/* restoreLowerPool prefers the pool with more room / lower fill */
stats.armour = 20;
stats.normalMaxArmour = 24;
stats.maxArmour = 24;
stats.magicArmour = 5;
stats.normalMaxMagicArmour = 18;
stats.maxMagicArmour = 18;
const lower = prot.restoreLowerPool(stats, 4);
if (!lower || lower.poolKey !== 'magicArmour' || lower.restored !== 4 || stats.magicArmour !== 9) {
  fail(`restoreLowerPool expected magic +4 → 9, got ${JSON.stringify(lower)} marm=${stats.magicArmour}`);
} else ok('restoreLowerPool fills lower Magic Armour pool');

stats.armour = 10;
stats.magicArmour = 18;
const lower2 = prot.restoreLowerPool(stats, 3);
if (!lower2 || lower2.poolKey !== 'armour' || lower2.restored !== 3 || stats.armour !== 13) {
  fail(`restoreLowerPool expected armour +3 → 13, got ${JSON.stringify(lower2)} arm=${stats.armour}`);
} else ok('restoreLowerPool fills lower Armour pool');

/* Overflow damage */
stats.armour = 4;
const hit = prot.applyDamageThroughProtection(stats, status, 7, false);
if (hit.remaining !== 3 || stats.armour !== 0 || !hit.brokePool || !hit.damagedHealth) {
  fail(`Overflow expected remaining 3 / broke+health, got ${JSON.stringify(hit)}`);
} else ok('Physical overflow Armour→Health');

/* Same-hit ailment gate */
if (prot.ailmentApplicationAllowed(hit) !== true) fail('ailment gate should allow after break+health');
else ok('Ailment gate allows break+health');
const exactZero = prot.applyDamageThroughProtection({ armour: 5, maxArmour: 5, normalMaxArmour: 5 }, {}, 5, false);
if (prot.ailmentApplicationAllowed(exactZero) !== false) fail('exact-zero pool with no health dmg must block ailment');
else ok('Exact-zero pool without Health dmg blocks ailment');

/* Independent pools */
stats.armour = 0;
stats.magicArmour = 10;
const magHit = prot.applyDamageThroughProtection(stats, status, 4, true);
if (stats.magicArmour !== 6 || stats.armour !== 0) fail('Magic damage must not touch Armour');
else ok('Magic Armour independent of Armour');

const physHit = prot.applyDamageThroughProtection(stats, status, 3, false);
if (physHit.remaining !== 3) fail('Physical with 0 Armour should fully overflow');
else ok('Zero Armour physical overflows while Magic Armour remains');

/* Fortify reapplication uses greater bonus; same refresh does not re-heal */
stats.armour = 10;
stats.normalMaxArmour = 24;
stats.maxArmour = 24;
status.fortify = null;
stats._fortifyBonus = 0;
prot.applyFortify(stats, status, 8, 2);
if (stats.armour !== 18 || stats._fortifyBonus !== 8) fail(`Fortify fresh expected armour 18 bonus 8, got ${stats.armour}/${stats._fortifyBonus}`);
else ok('Fortify fresh apply heals full amount');
const sameRefresh = prot.applyFortify(stats, status, 8, 2);
if (stats.armour !== 18 || stats._fortifyBonus !== 8 || sameRefresh !== 0) {
  fail(`same Fortify refresh should not re-heal, got armour=${stats.armour} bonus=${stats._fortifyBonus} returned=${sameRefresh}`);
} else ok('Fortify same-bonus refresh does not re-heal');
prot.applyFortify(stats, status, 12, 2);
if (stats._fortifyBonus !== 12 || status.fortify.amount !== 12) fail('reapply should keep greater Fortify 12');
else if (stats.armour !== 22) fail(`Fortify upgrade should add delta only (18+4=22), got ${stats.armour}`);
else ok('Fortify reapplication keeps greater bonus and adds delta only');

const gates = ctx.Avian.data.equipment.ailmentGates;
if (!Array.isArray(gates) || gates.length < 5) fail('ailmentGates missing');
else ok(`ailmentGates loaded (${gates.length})`);

if (prot.protectionPoolForAilment('Bleed') !== 'armour') fail('Bleed should gate on Armour');
if (prot.protectionPoolForAilment('Poison') !== 'magicArmour') fail('Poison should gate on Magic Armour');
if (prot.protectionPoolForAilment('fracture') !== 'armour') fail('Fracture should gate on Armour');
if (prot.protectionPoolForAilment('crippled') !== 'armour') fail('Crippled should gate on Armour');
if (prot.protectionPoolForAilment('dazed') !== 'armour') fail('Dazed should gate on Armour');
else ok('Ailment→pool mapping (incl. physical ailments)');

if (typeof prot.applyHybridDamageThroughProtection !== 'function') {
  fail('applyHybridDamageThroughProtection missing');
} else {
  const dual = {
    armour: 20, maxArmour: 20, normalMaxArmour: 20,
    magicArmour: 20, maxMagicArmour: 20, normalMaxMagicArmour: 20,
  };
  const hybridEq = prot.applyHybridDamageThroughProtection(dual, {}, 20, 20);
  const healthEq = Number(hybridEq.remaining) || 0;
  const appliedEq = healthEq + (Number(hybridEq.absorbed) || 0);
  if (Math.abs(healthEq - 20) > 0.05) fail(`hybrid 20/20 vs 20/20 expected 20 Health, got ${healthEq}`);
  else if (Math.abs(appliedEq - 40) > 0.15) fail(`hybrid equal-pool applied ${appliedEq}, expected 40`);
  else ok('Hybrid mean-pool gate: 40 vs 20/20 deals 20 Health (parity with specialist)');

  const mismatch = {
    armour: 10, maxArmour: 40, normalMaxArmour: 40,
    magicArmour: 30, maxMagicArmour: 40, normalMaxMagicArmour: 40,
  };
  const hybridMid = prot.applyHybridDamageThroughProtection(mismatch, {}, 20, 20);
  if (Math.abs((Number(hybridMid.remaining) || 0) - 20) > 0.15) {
    fail(`hybrid 20/20 vs 10/30 expected ~20 Health, got ${hybridMid.remaining}`);
  } else ok('Hybrid vs mismatched pools deals mean-gate Health (~20)');

  const openWound = {
    armour: 0, maxArmour: 20, normalMaxArmour: 20,
    magicArmour: 40, maxMagicArmour: 40, normalMaxMagicArmour: 40,
  };
  const hybridOpen = prot.applyHybridDamageThroughProtection(openWound, {}, 20, 20);
  if (Math.abs((Number(hybridOpen.remaining) || 0) - 20) > 0.15) {
    fail(`hybrid vs 0/40 expected 20 Health, got ${hybridOpen.remaining}`);
  } else ok('Hybrid vs empty Armour + thick Magic Armour is midway (20), not 0');
}

if (failed) {
  console.error(`\n[protection] ${failed} failure(s)`);
  process.exit(1);
}
console.log('\n[protection] all checks passed');
