/**
 * Smoke tests for js/systems/encounter-generator.js
 */
import { createRequire } from 'module';
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
  globalThis.Avian = { data: Object.create(null), systems: Object.create(null) };
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {}, addEventListener() {} }),
    body: { appendChild() {} },
  };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

  require(path.join(root, 'js/data/mother-goose-species-tiers.js'));
  require(path.join(root, 'js/data/enemy-roster.js'));
  require(path.join(root, 'js/data/birds.js'));
  require(path.join(root, 'js/systems/story-enemy-levels.js'));
  require(path.join(root, 'js/systems/enemy-roster-runtime.js'));
  require(path.join(root, 'js/data/story_enemy_registry.js'));
  require(path.join(root, 'js/data/story_milestone_boss_pool.js'));
  require(path.join(root, 'js/systems/encounter-generator.js'));
}

loadShell();

const gen = globalThis.Avian?.systems?.encounterGenerator;
const roster = globalThis.Avian.data.enemyRoster;
const tiers = globalThis.Avian.data.motherGooseSpeciesTiers.byBirdKey;

function speciesTierOf(birdKey) {
  return tiers[birdKey]?.speciesTier || 'grey';
}

ok('encounterGenerator namespace present', !!gen);
ok('getEnemyLevelForDifficulty is a function', typeof gen?.getEnemyLevelForDifficulty === 'function');
ok('pickStoryEncounterEnemyIds is a function', typeof gen?.pickStoryEncounterEnemyIds === 'function');

ok('Fletchling level offset', gen.getEnemyLevelForDifficulty(5, 'fletchling') === 4);
ok('Juvenile same level', gen.getEnemyLevelForDifficulty(5, 'juvenile') === 5);
ok('Predator +1 level', gen.getEnemyLevelForDifficulty(5, 'predator') === 6);
ok('Murder +2 levels', gen.getEnemyLevelForDifficulty(5, 'murder') === 7);
ok('Level floor at 1', gen.getEnemyLevelForDifficulty(1, 'fletchling') === 1);

const pool = gen.getStoryStageEnemyCandidateIds(3, 'sparrow');
ok('Pool excludes player bird roster rows', !pool.some((id) => roster.byId[id]?.birdKey === 'sparrow'));
ok('Stage 3 grey pool non-empty', pool.length >= 20);
ok('Stage 3 pool grey only', pool.every((id) => speciesTierOf(roster.byId[id]?.birdKey) === 'grey'));

const chain = gen.pickStoryEncounterEnemyIds(3, 'crow');
ok('Normal stage chain length 3', chain.length === 3);
ok('Chain returns roster ids', chain.every((id) => String(id).startsWith('EN-') || String(id).startsWith('BO-')));
ok('Chain picks grey tier only', chain.every((id) => speciesTierOf(roster.byId[id]?.birdKey) === 'grey'));
const unique = new Set(chain);
ok('Chain enemies unique when pool large enough', unique.size === chain.length);

const stage20 = gen.pickStoryEncounterEnemyIds(20, 'sparrow', 1);
ok('Stage 20 returns Duke roster id', stage20[0] === globalThis.getStoryDukeRosterId());

const stage10 = gen.pickStoryEncounterEnemyIds(10, 'sparrow', 1);
ok('Stage 10 milestone from L6 roster', stage10.length === 1 && roster.byId[stage10[0]]?.storyLevel === 6);
ok('Stage 10 boss is blue tier', speciesTierOf(roster.byId[stage10[0]]?.birdKey) === 'blue');

const pool10 = gen.getStoryStageEnemyCandidateIds(10, 'sparrow');
ok('Stage 10 candidate pool blue only', pool10.length > 0 && pool10.every((id) => speciesTierOf(roster.byId[id]?.birdKey) === 'blue'));

if (process.exitCode) {
  console.error('\nEncounter generator verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll encounter-generator checks passed.');
