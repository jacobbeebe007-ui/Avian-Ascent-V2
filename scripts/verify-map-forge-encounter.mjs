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
g.BIRDS = { sparrow: { name: 'Sparrow' }, dukeBlakiston: { name: 'Duke Blakiston' } };
g.Avian = { data: { enemyRoster: null }, mutations: { rollEnemyMutationsFromForgeSlot: () => [] } };
g.STORY_DUKE_ROSTER_ID = 'BO-DUKEB-STORY-L10';
g.getStoryDukeRosterId = () => 'BO-DUKEB-STORY-L10';

loadScript('js/data/enemy-roster.js');
loadScript('js/systems/story-enemy-levels.js');
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

const node = { type: 'stage', encounter: { enemyCount: 1, slots: [{ birdKey: 'sparrow', enemyTier: 'blue', enemyStars: 3, mutationBand: 'blue', maxMutations: 2 }] } };
g.ensureNodeEncounter(node);
const slot = node.encounter.slots[0];
assert(slot.birdKey === 'sparrow', 'birdKey preserved');
assert(slot.enemyTier === 'blue', 'enemyTier normalized');
assert(slot.enemyStars === 3, 'enemyStars normalized');
assert(slot.mutationBand === 'blue', 'mutationBand preserved');
assert(slot.maxMutations === 2, 'maxMutations preserved');

node.encounter.slots[0].enemyId = 'EN-SPARR-HESQ-L03';
g.ensureNodeEncounter(node);
assert(node.encounter.slots[0].enemyId === 'EN-SPARR-HESQ-L03', 'enemyId preserved');

const ids = g.resolveForgeEncounterBirdKeys(node.encounter, 'goose', 5);
assert(Array.isArray(ids) && ids.length === 1, 'resolve returns one id');
assert(ids[0] === 'EN-SPARR-HESQ-L03', 'prefers explicit enemyId');

const speciesOnly = { enemyCount: 1, slots: [{ birdKey: 'sparrow', enemyTier: 'green', enemyStars: 2 }] };
const speciesIds = g.resolveForgeEncounterBirdKeys(speciesOnly, 'goose', 5);
assert(speciesIds[0] === 'sparrow', 'species slot emits birdKey token');

const rewards = [
  { type: 'savedEggs', count: 2 },
  { type: 'goldenGoose', count: 1 },
];
g.addSavedEggs = (n) => n;
g.addGoldenGooseEggs = (n) => n;
const granted = g.grantForgeClearRewards({}, rewards, { shinyObjects: 0 });
assert(granted.savedEggs === 2, 'savedEggs granted');
assert(granted.goldenGoose === 1, 'goldenGoose granted');

const randomEnc = { enemyCount: 1, slots: [{ birdKey: 'random', enemyTier: 'grey', enemyStars: 0 }] };
let dukeHits = 0;
for (let i = 0; i < 5000; i++) {
  const rolled = g.resolveForgeEncounterBirdKeys(randomEnc, 'sparrow', 4);
  const tok = String(rolled[0] || '').toLowerCase();
  if (tok.includes('duke') || tok === 'dukeblakiston') dukeHits++;
}
assert(dukeHits === 0, 'stage 4 random forge never rolls Duke (' + dukeHits + ' hits)');

const dukeSlot = { enemyCount: 1, slots: [{ birdKey: 'dukeBlakiston', enemyTier: 'orange', enemyStars: 0 }] };
const dukeStage4 = g.resolveForgeEncounterBirdKeys(dukeSlot, 'sparrow', 4);
assert(!String(dukeStage4[0] || '').toLowerCase().includes('duke'), 'explicit duke slot on stage 4 is rerolled');

const stage20 = g.resolveForgeEncounterBirdKeys({ enemyCount: 1, slots: [{ birdKey: 'random' }] }, 'sparrow', 20);
assert(String(stage20[0] || '').indexOf('DUKEB') >= 0, 'stage 20 random resolves to Duke roster id');

const dukeTok = g.resolveOwStageToken('dukeBlakiston', 4, {});
assert(!String(dukeTok || '').toLowerCase().includes('duke'), 'resolveOwStageToken rejects Duke below stage 20');

const forgeOpts = g.listForgeEnemySpeciesOptions(4);
assert(!forgeOpts.some((o) => o.id === 'dukeBlakiston'), 'forge species list excludes Duke on stage 4');

const multi = {
  enemyCount: 3,
  slots: [
    { birdKey: 'sparrow', enemyTier: 'grey', enemyStars: 0 },
    { birdKey: 'sparrow', enemyTier: 'green', enemyStars: 1 },
    { birdKey: 'sparrow', enemyTier: 'blue', enemyStars: 2 },
  ],
};
const multiIds = g.resolveForgeEncounterBirdKeys(multi, 'goose', 5);
assert(multiIds.length === 3, 'three-slot encounter resolves three ids');

const gameJs = require('node:fs').readFileSync(path.join(root, 'js/core/game.js'), 'utf8');
assert(!/normalizeOwEnemyListForBattle\(rolled, stageNum\)\.slice\(0,1\)/.test(gameJs), 'game.js no longer truncates forge lists with .slice(0,1) on normalize');
assert(/isCustomOverworldActive/.test(gameJs), 'game.js branches custom overworld enemy counts');

console.log(`verify-map-forge-encounter: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
