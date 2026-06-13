/**
 * Smoke test: map forge encounter slot schema + enemyId resolution.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function loadScript(relPath) {
  const abs = path.join(root, relPath);
  require(abs);
}

const g = globalThis;
g.BIRDS = { sparrow: { name: 'Sparrow' } };
g.Avian = { data: { enemyRoster: null }, mutations: { rollEnemyMutationsFromForgeSlot: () => [] } };

loadScript('js/data/enemy-roster.js');
loadScript('js/systems/enemy-roster-runtime.js');
loadScript('js/world/ow_map_runtime.js');

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

const node = { type: 'stage', encounter: { enemyCount: 1, slots: [{ birdKey: 'sparrow', enemyLevel: 3, mutationBand: 'blue', maxMutations: 2 }] } };
g.ensureNodeEncounter(node);
const slot = node.encounter.slots[0];
assert(slot.birdKey === 'sparrow', 'birdKey preserved');
assert(slot.enemyLevel === 3, 'enemyLevel normalized');
assert(slot.mutationBand === 'blue', 'mutationBand preserved');
assert(slot.maxMutations === 2, 'maxMutations preserved');

node.encounter.slots[0].enemyId = 'EN-SPARR-HESQ-L03';
g.ensureNodeEncounter(node);
assert(node.encounter.slots[0].enemyId === 'EN-SPARR-HESQ-L03', 'enemyId preserved');

const ids = g.resolveForgeEncounterBirdKeys(node.encounter, 'goose', 5);
assert(Array.isArray(ids) && ids.length === 1, 'resolve returns one id');
assert(ids[0] === 'EN-SPARR-HESQ-L03', 'prefers explicit enemyId');

const rewards = [
  { type: 'savedEggs', count: 2 },
  { type: 'goldenGoose', count: 1 },
];
g.addSavedEggs = (n) => n;
g.addGoldenGooseEggs = (n) => n;
const granted = g.grantForgeClearRewards({}, rewards, { shinyObjects: 0 });
assert(granted.savedEggs === 2, 'savedEggs granted');
assert(granted.goldenGoose === 1, 'goldenGoose granted');

console.log(`verify-map-forge-encounter: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
