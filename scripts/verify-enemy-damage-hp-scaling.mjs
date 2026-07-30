/**
 * Enemy Basic Attack must use equipped weapon rows (not unarmed Natural Strike),
 * and stage-10 boss HP must stay below the old inflated band.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const sandbox = {
  console,
  Math,
  Number,
  Object,
  Array,
  String,
  JSON,
  globalThis: null,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of [
  'js/bootstrap/_namespace.js',
  'js/data/combat-config.js',
  'js/data/enemy-scaling-profiles.js',
  'js/data/progression/rules.js',
  'js/data/progression/level-growth.js',
  'js/data/progression/star-growth.js',
  'js/data/progression/tier-mults.js',
  'js/data/birds-v2.js',
  'js/data/aspects.js',
  'js/systems/ability-rider-parser.js',
  'js/systems/combat-formulas.js',
  'js/systems/bird-progression.js',
]) {
  vm.runInContext(read(f), sandbox, { filename: f, timeout: 10000 });
}

let failed = 0;
function ok(label, cond, detail) {
  if (!cond) {
    failed += 1;
    console.error('[FAIL]', label, detail || '');
    return;
  }
  console.log('[ok]  ', label, detail || '');
}

const c = sandbox;
const profiles = c.Avian.data.enemyScalingProfiles.profiles;

ok('boss vitalityMult lessened', Number(profiles.boss.vitalityMult) <= 1.15,
  `got=${profiles.boss.vitalityMult}`);
ok('boss levelOffset lessened', Number(profiles.boss.levelOffset) <= 1,
  `got=${profiles.boss.levelOffset}`);
ok('elite has no bonus vitalityMult', Number(profiles.elite.vitalityMult) === 1,
  `got=${profiles.elite.vitalityMult}`);
ok('veteran has no bonus vitalityMult', Number(profiles.veteran.vitalityMult) === 1,
  `got=${profiles.veteran.vitalityMult}`);

const equipped = {
  id: 'BASIC_PHYSICAL',
  name: 'Basic Attack',
  minDamage: 2,
  maxDamage: 3,
  skillPowerPct: 100,
  scaleStat: 'ATK',
};
const wrapped = { id: 'BASIC_PHYSICAL', _dispatcherRow: equipped };
ok('isNaturalBasicAbility unwraps _dispatcherRow',
  c.isNaturalBasicAbility(wrapped) === false);

const attacker = { stats: { atk: 23, matk: 0, dex: 5, spd: 10 } };
const target = { stats: { def: 16, mdef: 10 } };
const natural = c.calculateDamage({
  attacker,
  target,
  ability: { id: 'BASIC_PHYSICAL', naturalStrikeFlat: { min: 1, max: 2 }, name: 'Natural Strike' },
  hitSucceeded: true,
  rollWeapon: false,
  battleState: {},
  bonusFractions: [],
});
const weapon = c.calculateDamage({
  attacker,
  target,
  ability: equipped,
  hitSucceeded: true,
  rollWeapon: false,
  battleState: {},
  bonusFractions: [],
});
const viaWrap = c.calculateDamage({
  attacker,
  target,
  ability: c.isNaturalBasicAbility(wrapped) ? wrapped : equipped,
  hitSucceeded: true,
  rollWeapon: false,
  battleState: {},
  bonusFractions: [],
});

ok('Natural Strike stays ~1 vs Guard 16', Number(natural.damage) <= 2, `got=${natural.damage}`);
ok('Equipped Basic scales with Might (23 vs Guard 16)', Number(weapon.damage) >= 3,
  `got=${weapon.damage} pre=${weapon.preMitigation}`);
ok('Wrapped equipped Basic matches weapon path', Number(viaWrap.damage) === Number(weapon.damage),
  `got=${viaWrap.damage}`);

const bp = c.Avian.birdProgression;
const milestones = c.Avian.data.enemyScalingProfiles.milestones;
const birds = c.Avian.data.birdsV2;

function bossHp(birdKey) {
  const b = birds[birdKey];
  const tier = 'blue';
  const ms = milestones[tier];
  const starsInTier = Number(profiles.boss.starsInTier) || 5;
  const totalStars = (Number(ms?.totalStars) || 0) - (Number(ms?.standardStarsInTier) || 0) + starsInTier;
  const level = 6 + (Number(profiles.boss.levelOffset) || 0);
  const result = bp.computeFinalStats({
    base: {
      vitality: Number(b.vitality ?? b.stats?.vitality) || 0,
      atk: Number(b.stats?.atk) || 0,
      dex: Number(b.stats?.dex) || 0,
      def: Number(b.stats?.def) || 0,
      matk: Number(b.stats?.matk) || 0,
      mdef: Number(b.stats?.mdef) || 0,
      spd: Number(b.stats?.spd) || 0,
      baseHealth: b.baseHealth,
    },
    baseHealth: b.baseHealth,
    className: b.class,
    level,
    totalStars,
    tier,
    equipmentFlat: {},
  });
  const ledger = bp.applyEnemyProfile(Object.assign({}, result.ledger), 'boss');
  return Number(ledger.maxHp) || 0;
}

const blueKeys = Object.keys(birds).filter((k) => birds[k].speciesTier === 'blue');
let maxBlueBossHp = 0;
let maxKey = '';
for (const k of blueKeys) {
  const hp = bossHp(k);
  if (hp > maxBlueBossHp) {
    maxBlueBossHp = hp;
    maxKey = k;
  }
}
ok('Stage-10-band blue boss HP under 320 (was ~448+)', maxBlueBossHp < 320,
  `max=${maxBlueBossHp} (${maxKey})`);

const snowy = bossHp('snowyOwl');
ok('Snowy Owl stage-10 boss HP well under old 448', snowy > 0 && snowy < 280,
  `got=${snowy}`);

const ostrichLedger = (() => {
  const b = birds.ostrich;
  const result = bp.computeFinalStats({
    base: {
      vitality: Number(b.vitality ?? b.stats?.vitality) || 0,
      atk: Number(b.stats?.atk) || 0,
      dex: Number(b.stats?.dex) || 0,
      def: Number(b.stats?.def) || 0,
      matk: Number(b.stats?.matk) || 0,
      mdef: Number(b.stats?.mdef) || 0,
      spd: Number(b.stats?.spd) || 0,
      baseHealth: b.baseHealth,
    },
    baseHealth: b.baseHealth,
    className: b.class,
    level: 7,
    totalStars: 15,
    tier: 'blue',
    equipmentFlat: {},
  });
  return bp.applyEnemyProfile(Object.assign({}, result.ledger), 'boss');
})();
const hpFromVit = bp.vitalityToMaxHp(ostrichLedger.leveledBaseHealth, ostrichLedger.vitality);
ok('applyEnemyProfile does not double-dip HP×vit',
  Number(ostrichLedger.maxHp) === hpFromVit,
  `maxHp=${ostrichLedger.maxHp} fromVit=${hpFromVit}`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nOK enemy damage + boss HP scaling');
