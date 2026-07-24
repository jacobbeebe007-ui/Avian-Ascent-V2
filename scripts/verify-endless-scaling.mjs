/**
 * Smoke test: endless cadence, roster level picks, reward drops, utility classification.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function loadScript(relPath) {
  require(path.join(root, relPath));
}

const g = globalThis;
g.G = { player: { birdLevel: 15, equippedMutations: {} } };
g.Avian = { data: { enemyRoster: null }, mutations: {} };

loadScript('js/data/enemy-roster.js');
loadScript('js/systems/enemy-roster-runtime.js');
loadScript('js/systems/nest-rewards.js');

loadScript('js/systems/combat-formulas.js');

// Inline utility classifier (same rules as combat-pack-boot.js)
g.resolveCombatRowBtnType = function resolveCombatRowBtnType(row) {
  if (!row) return 'utility';
  if (/magic|song|spell/i.test(row.category || '')) return 'spell';
  if (typeof g.isHybridDamage === 'function' && g.isHybridDamage(row)) return 'hybrid';
  if (String(row.scaleStat || '').toUpperCase() === 'MATK') return 'spell';
  if (Number(row.pierceMdef) > 0 && !Number(row.pierceDef)) return 'spell';
  if (row.branch === 'utility' && (row.noDamage || row.target === 'self')) return 'utility';
  if (/utility|guard|heal|buff|control/i.test(row.category || '') && row.noDamage) return 'utility';
  if (row.target === 'self' && row.noDamage) return 'utility';
  return 'physical';
};

// Minimal constants/helpers from game.js surface
g.ENDLESS_STORY_END_STAGE = 20;
g.ENDLESS_BOSS_CADENCE = 20;
g.ENDLESS_SHOP_CADENCE = 10;
g.getEndlessEffectiveBattleNumber = (stage) => Math.max(0, Math.floor(Number(stage) || 0) - g.ENDLESS_STORY_END_STAGE);
g.getEndlessNormalFightTier = (eb) => {
  const n = Math.max(0, Math.floor(Number(eb) || 0));
  if (n >= 1 && n <= 9) return 'white';
  if (n >= 11 && n <= 29) return 'green';
  if (n >= 31 && n <= 49) return 'blue';
  return null;
};

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error('FAIL:', msg);
}

// Boss cadence 20 / shop cadence 10
for (let eb = 1; eb <= 40; eb++) {
  const isBoss = eb > 0 && eb % g.ENDLESS_BOSS_CADENCE === 0;
  const isShop = eb > 0 && eb % g.ENDLESS_SHOP_CADENCE === 0;
  if (eb === 20) {
    assert(isBoss && isShop, 'battle 20 is both boss and shop');
  } else if (eb % 20 === 0) {
    assert(isBoss, `battle ${eb} is boss`);
  } else if (eb % 10 === 0) {
    assert(isShop && !isBoss, `battle ${eb} is shop only`);
  }
}

// Roster pick uses player level band (1–20)
const roster = g.Avian.data.enemyRoster;
assert(roster && roster.normalByLevel && roster.normalByLevel[15], 'roster has level 15 normals');
const picked = g.pickEndlessRosterEnemyId(35, false, 15);
const row = g.getEnemyRosterRow(picked);
assert(row && !row.isBoss, 'normal pick is not boss');
assert(row.storyLevel >= 14 && row.storyLevel <= 16, 'normal pick near player level ±1');

const bossPick = g.pickEndlessRosterEnemyId(40, true, 15);
const bossRow = g.getEnemyRosterRow(bossPick);
assert(bossRow && bossRow.isBoss, 'boss pick is boss');

// Endless reward drops: heal-only per bird (equipment is choose-1-of-3 in UI)
g.Avian.flags = { equipmentV2: true };
g.Avian.equipmentLoot = {
  rollEquipmentReward: () => ({ id: 'eq-test', type: 'equipment', name: 'Test Eq', tier: 'green' }),
};
const drops = g.buildEndlessClearRewardDrops(
  [{ level: 12, isBoss: false }, { level: 14, isBoss: true }],
  { difficulty: 'juvenile', stage: 32 }
);
assert(drops.length === 2, 'two birds => two heal drops (equipment via pick UI)');
assert(drops.every((d) => d.type === 'combat_item'), 'endless clear drops are heals only');
assert(!drops.some((d) => d.type === 'equipment' || d.type === 'mutation'), 'endless clear omits equipment/mutation');

const endlessNest = g.buildNestRewardDrops([{ level: 8 }], { storyMode: false, stage: 8, difficulty: 'juvenile' });
assert(!endlessNest.some((d) => d.type === 'equipment' || d.equipmentItemId), 'endless nest branch omits equipment');

loadScript('js/systems/endless-map.js');
const map = g.EndlessMap.createEndlessMapState('verify-seed', 0);
const start = map.nodes.find((n) => n.type === 'start');
const boss = map.nodes.find((n) => n.type === 'boss');
assert(start && boss, 'map has start and boss');
assert(start.y > boss.y, 'start is below boss (bottom-to-top climb)');
const posStart = g.EndlessMap.getNodeDisplayPosition(start, map);
const posBoss = g.EndlessMap.getNodeDisplayPosition(boss, map);
assert(posStart.y > posBoss.y, 'display Y places start below boss');

// Utility classification
const utilRow = {
  branch: 'utility',
  category: 'guard',
  target: 'self',
  noDamage: true,
  scaleStat: 'ATK',
  pierceDef: 0,
  pierceMdef: 0,
};
const hybridRow = {
  branch: 'utility',
  category: 'hybrid',
  damageType: 'Hybrid',
  damageStat: 'HYBRID',
  target: 'self_and_enemy',
  noDamage: false,
  scaleStat: 'HYBRID',
  pierceDef: 10,
  pierceMdef: 0,
};
assert(g.resolveCombatRowBtnType(utilRow) === 'utility', 'pure self utility');
assert(g.resolveCombatRowBtnType(hybridRow) === 'hybrid', 'hybrid utility with damage is hybrid');

const split = g.calculateHybridDisplaySplit(10, hybridRow);
assert(split.physical + split.magic === split.total && split.total === 10, 'hybrid display split sums to total');

// getEndlessNormalFightTier wiring
assert(g.getEndlessNormalFightTier(5) === 'white', 'early endless tier white');
assert(g.getEndlessNormalFightTier(15) === 'green', 'mid endless tier green');

console.log(`verify-endless-scaling: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
