/**
 * Smoke tests for story enemy level bands + roster pools
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
  require(path.join(root, 'js/data/enemy-roster.js'));
  require(path.join(root, 'js/data/birds.js'));
  require(path.join(root, 'js/systems/story-enemy-levels.js'));
  require(path.join(root, 'js/systems/enemy-roster-runtime.js'));
  require(path.join(root, 'js/data/story_enemy_registry.js'));
  require(path.join(root, 'js/systems/encounter-generator.js'));
}

loadShell();

const band3 = globalThis.getStoryEnemyLevelBand(3);
ok('Stage 3 band L1-2', band3.min === 1 && band3.max === 2);

const band10 = globalThis.getStoryEnemyLevelBand(10);
ok('Stage 10 boss L6', band10.boss === true && band10.level === 6);

const band20 = globalThis.getStoryEnemyLevelBand(20);
ok('Stage 20 duke L10', band20.duke === true && band20.level === 10);

const roster = globalThis.Avian.data.enemyRoster;
function poolSizeForBand(band) {
  const out = new Set();
  for (let lv = band.min; lv <= band.max; lv++) {
    (roster.normalByLevel[lv] || []).forEach((id) => out.add(id));
  }
  return out.size;
}
ok('Stages 1-4 pool non-empty', poolSizeForBand({ min: 1, max: 2 }) > 50);

const gen = globalThis.Avian.systems.encounterGenerator;
const stage10 = gen.pickStoryEncounterEnemyIds(10, 'sparrow', 1);
ok('Stage 10 returns roster id', stage10.length === 1 && (String(stage10[0]).startsWith('EN-') || String(stage10[0]).startsWith('BO-')));
const row10 = roster.byId[stage10[0]];
ok('Stage 10 milestone uses L6 roster row', row10 && row10.storyLevel === 6);

const stage20 = gen.pickStoryEncounterEnemyIds(20, 'sparrow', 1);
ok('Stage 20 returns Duke roster id', stage20[0] === globalThis.getStoryDukeRosterId());

if (process.exitCode) {
  console.error('\nStory level band verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll story level band checks passed.');
