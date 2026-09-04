import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {
  Math,
  Number,
  Object,
  Array,
  String,
  globalThis: null,
  Avian: { balance: {}, systems: {}, data: {} },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(relPath) {
  vm.runInContext(readFileSync(path.join(root, relPath), 'utf8'), sandbox);
}

load('js/systems/experience-scaling.js');

const exp = sandbox.Avian.balance.experience;
let failures = 0;

function check(label, condition, detail = '') {
  if (!condition) {
    failures += 1;
    console.error('[FAIL]', label, detail);
  } else {
    console.log('[ok]  ', label, detail);
  }
}

function expForLevel(lv) {
  if (lv <= 15) return Math.floor(70 * 1.34 ** (lv - 1));
  if (lv <= 25) return Math.floor(70 * 1.34 ** 14 * 1.16 ** (lv - 15));
  return Math.floor(70 * 1.34 ** 14 * 1.16 ** 10 * 1.07 ** (lv - 25));
}

function baseExpForEnemyLevel(lv) {
  const table = [14, 18, 25, 35, 49, 67, 92, 127, 176, 244, 336];
  const L = Math.max(0, Math.floor(lv));
  if (L <= 10) return table[L];
  const over = L - 10;
  return Math.max(table[10], Math.round(table[10] + 28 * over + 14 * Math.log2(over + 1)));
}

function relativeLevelExpMultiplier(enemyLv, playerLv) {
  const d = enemyLv - playerLv;
  if (d <= -3) return 0.70;
  if (d === -2) return 0.82;
  if (d === -1) return 0.92;
  if (d === 0) return 1.00;
  if (d === 1) return 1.12;
  if (d === 2) return 1.25;
  return 1.40;
}

function stageExpMultiplierStory(stage) {
  return 1 + Math.min(1.0, (stage - 1) * 0.05);
}

const baseCtx = {
  playerLevel: 8,
  stage: 12,
  endlessBattle: 0,
  isEndlessRunActive: false,
  difficulty: 'juvenile',
  segmentIndex: null,
  getEnemyLevel: (enemy) => enemy.storyLevel || enemy.effectiveLevel || 8,
  baseExpForLevel: baseExpForEnemyLevel,
  relativeLevelMult: relativeLevelExpMultiplier,
  stageDepthMult: () => stageExpMultiplierStory(12),
  expForLevel,
};

check('larger birds pay more EXP than tiny birds', exp.sizeExpMultiplier({ size: 'large' }) > exp.sizeExpMultiplier({ size: 'tiny' }));
check('boss size tier is highest', exp.sizeExpMultiplier({ size: 'boss', isBoss: true }) >= exp.sizeExpMultiplier({ size: 'giant' }));
check('elite encounters pay more than normals', exp.roleExpMultiplier({ isElite: true }) > exp.roleExpMultiplier({ encounterType: 'Normal' }));
check('purple species tier pays more than grey', exp.speciesTierExpMultiplier({ speciesTier: 'purple' }, baseCtx) > exp.speciesTierExpMultiplier({ speciesTier: 'grey' }, baseCtx));
check('murder difficulty pays more than fletchling in story', exp.difficultyExpMultiplier('murder', false) > exp.difficultyExpMultiplier('fletchling', false));
check('story finale act pays more than act one', exp.storyActExpMultiplier(18) > exp.storyActExpMultiplier(3));
check('endless map segments deepen rewards', exp.endlessSegmentExpMultiplier(3) > exp.endlessSegmentExpMultiplier(0));

const tinyNormal = exp.computeNormalAward({
  ...baseCtx,
  enemy: { size: 'tiny', storyLevel: 8, encounterType: 'Normal', speciesTier: 'grey' },
});
const largeElite = exp.computeNormalAward({
  ...baseCtx,
  enemy: { size: 'large', storyLevel: 8, isElite: true, speciesTier: 'purple' },
});
check('large elite purple enemy beats tiny grey normal', largeElite > tinyNormal, `${largeElite} vs ${tinyNormal}`);

const storyBoss = exp.computeBossAward({
  ...baseCtx,
  stage: 20,
  enemy: { size: 'boss', isBoss: true, storyLevel: 10, speciesTier: 'orange' },
});
const earlyBoss = exp.computeBossAward({
  ...baseCtx,
  stage: 10,
  enemy: { size: 'large', isBoss: true, storyLevel: 6, speciesTier: 'blue' },
});
check('finale boss pays more than milestone boss', storyBoss > earlyBoss, `${storyBoss} vs ${earlyBoss}`);

const endlessNormal = exp.computeNormalAward({
  ...baseCtx,
  isEndlessRunActive: true,
  endlessBattle: 12,
  segmentIndex: 2,
  stage: 32,
  stageDepthMult: () => 1 + Math.min(1.2, 12 * 0.03),
  enemy: { size: 'medium', effectiveLevel: 15, speciesTier: 'blue' },
});
const endlessCap = Math.round(expForLevel(9) * exp.ENDLESS_EXP_NORMAL_CAP_PCT);
check('endless normal awards respect cap', endlessNormal <= endlessCap, `${endlessNormal} <= ${endlessCap}`);

const endlessBoss = exp.computeBossAward({
  ...baseCtx,
  isEndlessRunActive: true,
  endlessBattle: 20,
  segmentIndex: 4,
  stage: 40,
  stageDepthMult: () => 1 + Math.min(1.2, 20 * 0.03),
  enemy: { size: 'xl', isBoss: true, effectiveLevel: 18, speciesTier: 'gold' },
});
const bossCap = Math.round(expForLevel(9) * exp.ENDLESS_EXP_BOSS_CAP_PCT);
check('endless boss awards respect cap', endlessBoss <= bossCap, `${endlessBoss} <= ${bossCap}`);

let breakdown = null;
exp.computeNormalAward({
  ...baseCtx,
  enemy: { size: 'large', storyLevel: 9, isElite: true, speciesTier: 'blue' },
  captureBreakdown: (value) => { breakdown = value; },
});
check('breakdown captures scaling factors', breakdown && breakdown.multipliers.size > 1 && breakdown.multipliers.role > 1);

if (failures) process.exit(1);
console.log('\nOK experience scaling');
