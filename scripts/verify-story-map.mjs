#!/usr/bin/env node
/**
 * Regression checks for the shared story map source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function ok(label, cond) {
  if (!cond) {
    console.error('[FAIL]', label);
    process.exitCode = 1;
    return false;
  }
  console.log('[ok]  ', label);
  return true;
}

const storyMapSrc = readFileSync(path.join(root, 'js/data/story-map.js'), 'utf8');
const sandbox = { globalThis: {} };
sandbox.window = sandbox.globalThis;
sandbox.globalThis.globalThis = sandbox.globalThis;
sandbox.globalThis.window = sandbox.globalThis;
vm.createContext(sandbox);
vm.runInContext(storyMapSrc, sandbox);

const map = sandbox.globalThis.AVIAN_STORY_MAP_DEFAULT;
ok('Shared story map is published', !!map && typeof map === 'object');
ok('Clone helper is published', typeof sandbox.globalThis.cloneDefaultStoryMap === 'function');
ok('Story map uses schema v2', map?.schemaVersion === 2);
ok('Story map has a background', typeof map?.backgroundDataUrl === 'string' && map.backgroundDataUrl.length > 0);
ok('Story map has nodes', Array.isArray(map?.nodes) && map.nodes.length > 0);
ok('Story map has exactly one start', map?.nodes?.filter((n) => n.type === 'start').length === 1);
ok('Story map starts with start node', map?.nodes?.[0]?.type === 'start');

let expectedStage = 1;
for (const node of map?.nodes || []) {
  if (node.type !== 'stage' && node.type !== 'boss') continue;
  ok('Stage ' + expectedStage + ' is sequential', Math.floor(Number(node.stage) || 0) === expectedStage);
  expectedStage += 1;
}
ok('Story map has combat stages', expectedStage > 1);
ok('maxStage matches combat stages', Math.floor(Number(map?.maxStage) || 0) === expectedStage - 1);
ok('Story map has no nested worlds', !map?.worlds || Object.keys(map.worlds).length === 0);
ok('Story map startMapId is main', !map?.startMapId || map.startMapId === 'main');

const owRuntimeSrc = readFileSync(path.join(root, 'js/world/ow_map_runtime.js'), 'utf8');
const packSchemaSrc = readFileSync(path.join(root, 'js/world/map-pack-schema.js'), 'utf8');
const owSandbox = { global: {}, globalThis: {} };
owSandbox.global = owSandbox.globalThis;
owSandbox.window = owSandbox.globalThis;
vm.createContext(owSandbox);
vm.runInContext(owRuntimeSrc, owSandbox);
vm.runInContext(packSchemaSrc, owSandbox);
vm.runInContext(storyMapSrc, owSandbox);
const ow = owSandbox.globalThis;
const cloneStory = ow.cloneDefaultStoryMap;
ok('Story clone helper loads in overworld sandbox', typeof cloneStory === 'function');
const v3Map = ow.upgradeMapToV3(cloneStory());
const barnGate = v3Map.nodes.find((n) => n.name === 'Barn Gate');
ok('v3 story nodes keep stage numbers in display labels', barnGate && ow.getNodeDisplayLabel(barnGate, null) === '1');
ok('v3 story nodes resolve stage titles', ow.getStoryStageNodeTitle(1, v3Map) === 'Barn Gate');
const storyV2 = ow.upgradeMapToV2(cloneStory());
const storyStage = storyV2.nodes.find((n) => n.name === 'Barn Gate');
ok('story map v2 keeps classic stage node type', storyStage && storyStage.type === 'stage');

const overworldHtml = readFileSync(path.join(root, 'blackstone_overworld_new.html'), 'utf8');
ok('Overworld page loads shared story map script', overworldHtml.includes('js/data/story-map.js'));
ok('Overworld page has no inline DEFAULT_NODES source', !overworldHtml.includes('const DEFAULT_NODES='));
ok('Overworld render skips decor labels only', overworldHtml.includes('isOwDecorLabelNode(n)') && !overworldHtml.includes('if(n.type===\'label\') return;'));
ok('Overworld uses effective node type for labels', overworldHtml.includes('const effType=eff?.type||n.type'));
ok('Story map keeps v2 upgrade path', overworldHtml.includes('storyBuiltin:true'));

if (process.exitCode) {
  console.error('\nStory map verification failed.');
  process.exit(process.exitCode);
}

console.log('\nAll story map checks passed.');
