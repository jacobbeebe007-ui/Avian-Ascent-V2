/**
 * Smoke tests for js/systems/encounter-generator.js
 */
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function ok(label, cond) {
  if (!cond) {
    console.error('[FAIL]', label);
    process.exitCode = 1;
    return false;
  }
  console.log('[ok]  ', label);
  return true;
}

function loadShell() {
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }),
    body: { appendChild() {} },
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

  const birdsPath = path.join(root, 'js/data/birds.js');
  require(birdsPath);

  const registryPath = path.join(root, 'js/data/story_enemy_registry.js');
  require(registryPath);

  const milestonePath = path.join(root, 'js/data/story_milestone_boss_pool.js');
  require(milestonePath);

  const genPath = path.join(root, 'js/systems/encounter-generator.js');
  require(genPath);
}

loadShell();

const gen = globalThis.Avian?.systems?.encounterGenerator;
ok('encounterGenerator namespace present', !!gen);
ok('getEnemyLevelForDifficulty is a function', typeof gen?.getEnemyLevelForDifficulty === 'function');
ok('pickStoryEncounterBirdKeys is a function', typeof gen?.pickStoryEncounterBirdKeys === 'function');

ok('Fletchling level offset', gen.getEnemyLevelForDifficulty(5, 'fletchling') === 4);
ok('Juvenile same level', gen.getEnemyLevelForDifficulty(5, 'juvenile') === 5);
ok('Predator +1 level', gen.getEnemyLevelForDifficulty(5, 'predator') === 6);
ok('Murder +2 levels', gen.getEnemyLevelForDifficulty(5, 'murder') === 7);
ok('Level floor at 1', gen.getEnemyLevelForDifficulty(1, 'fletchling') === 1);

const milestone = new Set(globalThis.getStoryMilestoneBossCandidateBirdKeys?.() || []);
const pool = gen.getStoryRandomBirdPool(3, 'sparrow');
ok('Pool excludes Duke', !pool.some((k) => String(k).toLowerCase().includes('duke')));
ok('Pool excludes player bird', !pool.includes('sparrow'));
for (const mk of milestone) {
  ok(`Pool excludes milestone boss ${mk}`, !pool.includes(mk));
}
ok('Pool has many birds', pool.length >= 30);

const chain = gen.pickStoryEncounterBirdKeys(3, 'crow');
ok('Normal stage chain length 3', chain.length === 3);
const unique = new Set(chain);
ok('Chain birds unique when pool large enough', unique.size === chain.length);

ok('Stage 20 returns Duke', gen.pickStoryEncounterBirdKeys(20, 'sparrow')[0] === 'dukeBlakiston');

const bossPick = globalThis.pickRandomMilestoneBossKey();
ok('Milestone boss pick in pool', milestone.has(bossPick));

if (process.exitCode) {
  console.error('\nEncounter generator verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll encounter-generator checks passed.');
