/**
 * Smoke tests for js/data/enemy-roster.js
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

globalThis.window = globalThis;
globalThis.Avian = { data: Object.create(null) };
require(path.join(root, 'js/data/enemy-roster.js'));
require(path.join(root, 'js/data/birds.js'));
require(path.join(root, 'js/systems/story-enemy-levels.js'));
require(path.join(root, 'js/systems/enemy-roster-runtime.js'));

const roster = globalThis.Avian.data.enemyRoster;
ok('enemyRoster present', !!roster);
ok('byId populated', roster && Object.keys(roster.byId).length >= 500);
ok('normalByLevel L1 non-empty', !!(roster.normalByLevel && roster.normalByLevel[1] && roster.normalByLevel[1].length));

const birds = globalThis.BIRDS || {};
const birdKeys = Object.keys(birds).filter((k) => k !== 'dukeBlakiston');
let missingL1 = 0;
for (const bk of birdKeys) {
  const byBird = roster.byBirdLevel && roster.byBirdLevel[bk];
  const l1 = byBird && byBird[1];
  if (!l1 || !l1.length) missingL1++;
}
ok('playable birds missing L1 normal row <= 5', missingL1 <= 5);

const dukeId = globalThis.getStoryDukeRosterId();
const dukeRow = roster.byId[dukeId];
ok('Duke L10 boss row exists', !!dukeRow && dukeRow.storyLevel === 10 && dukeRow.birdKey === 'dukeBlakiston');

const sparrowL1 = Object.values(roster.byId).find((r) => r.birdKey === 'sparrow' && r.storyLevel === 1 && !r.isBoss);
ok('Sparrow L1 normal row', !!sparrowL1);
if (sparrowL1) {
  ok('Sparrow L1 HP ~37', sparrowL1.stats.hp >= 35 && sparrowL1.stats.hp <= 40);
  ok('Sparrow L1 ATK ~10', sparrowL1.stats.atk >= 8 && sparrowL1.stats.atk <= 12);
}

if (process.exitCode) {
  console.error('\nEnemy roster verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll enemy roster checks passed.');
