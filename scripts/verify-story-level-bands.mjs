/**
 * Smoke tests for story enemy level bands + species-tier roster pools
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
  require(path.join(root, 'js/data/mother-goose-species-tiers.js'));
  require(path.join(root, 'js/data/enemy-roster.js'));
  require(path.join(root, 'js/data/birds.js'));
  require(path.join(root, 'js/systems/story-enemy-levels.js'));
  require(path.join(root, 'js/systems/enemy-roster-runtime.js'));
  require(path.join(root, 'js/data/story_enemy_registry.js'));
  require(path.join(root, 'js/systems/encounter-generator.js'));
}

loadShell();

const tiers = globalThis.Avian.data.motherGooseSpeciesTiers.byBirdKey;
function speciesTierOf(birdKey) {
  return tiers[birdKey]?.speciesTier || 'grey';
}

const band3 = globalThis.getStoryEnemyLevelBand(3);
ok('Stage 3 band L1-2', band3.min === 1 && band3.max === 2);
ok('Stage 3 species tier grey', globalThis.getStorySpeciesTierForStage(3) === 'grey');
ok('Stage 7 species tier green', globalThis.getStorySpeciesTierForStage(7) === 'green');
ok('Stage 12 species tier blue', globalThis.getStorySpeciesTierForStage(12) === 'blue');
ok('Stage 17 species tier purple', globalThis.getStorySpeciesTierForStage(17) === 'purple');
ok('Stage 20 species tier none', globalThis.getStorySpeciesTierForStage(20) === null);

const band10 = globalThis.getStoryEnemyLevelBand(10);
ok('Stage 10 boss L6', band10.boss === true && band10.level === 6);

const band20 = globalThis.getStoryEnemyLevelBand(20);
ok('Stage 20 duke L10', band20.duke === true && band20.level === 10);

const roster = globalThis.Avian.data.enemyRoster;
const gen = globalThis.Avian.systems.encounterGenerator;

function poolOnlyTier(pool, tier) {
  return pool.length > 0 && pool.every((id) => speciesTierOf(roster.byId[id]?.birdKey) === tier);
}

function poolExcludesTiers(pool, blocked) {
  return pool.every((id) => !blocked.includes(speciesTierOf(roster.byId[id]?.birdKey)));
}

const pool3 = gen.getStoryStageEnemyCandidateIds(3, 'sparrow');
ok('Stage 3 pool grey only', poolOnlyTier(pool3, 'grey'));
ok('Stage 3 pool excludes green+', poolExcludesTiers(pool3, ['green', 'blue', 'purple', 'gold', 'orange']));

const pool7 = gen.getStoryStageEnemyCandidateIds(7, 'hummingbird');
ok('Stage 7 pool green only', poolOnlyTier(pool7, 'green'));

const pool12 = gen.getStoryStageEnemyCandidateIds(12, 'peregrine');
ok('Stage 12 pool blue only', poolOnlyTier(pool12, 'blue'));

const pool17 = gen.getStoryStageEnemyCandidateIds(17, 'flamingo');
ok('Stage 17 pool purple only', poolOnlyTier(pool17, 'purple'));
ok('Stage 17 pool excludes gold/orange', poolExcludesTiers(pool17, ['gold', 'orange']));

const stage10 = gen.pickStoryEncounterEnemyIds(10, 'sparrow', 1);
ok('Stage 10 returns roster id', stage10.length === 1 && (String(stage10[0]).startsWith('EN-') || String(stage10[0]).startsWith('BO-')));
const row10 = roster.byId[stage10[0]];
ok('Stage 10 milestone uses L6 roster row', row10 && row10.storyLevel === 6);
ok('Stage 10 boss is blue tier', row10 && speciesTierOf(row10.birdKey) === 'blue');

const stage20 = gen.pickStoryEncounterEnemyIds(20, 'sparrow', 1);
ok('Stage 20 returns Duke roster id', stage20[0] === globalThis.getStoryDukeRosterId());

if (process.exitCode) {
  console.error('\nStory level band verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll story level band checks passed.');
