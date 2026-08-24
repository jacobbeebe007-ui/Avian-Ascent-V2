#!/usr/bin/env node
/**
 * Import a Map Forge / World Creator JSON export as the built-in story map.
 *
 * Usage:
 *   node scripts/import-story-map.mjs path/to/avian-world-export.json
 *
 * Nested maps (worlds) are preserved. Spawn may be a native start node or a
 * label/kind Spawn location.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outputPath = path.join(root, 'js/data/story-map.js');
const inputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : '';

function fail(message) {
  console.error('[import-story-map] ' + message);
  process.exit(1);
}

function asPositiveInt(value, fallback) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nodeKind(n) {
  if (!n) return '';
  if (n.kind) return String(n.kind);
  if (n.type === 'label' && n.labelConfig?.actsAsNode) return String(n.labelConfig.mimicType || '');
  return String(n.type || '');
}

function isSpawnNode(n) {
  return nodeKind(n) === 'start' || n?.type === 'start';
}

function isCombatNode(n) {
  const k = nodeKind(n);
  return k === 'stage' || k === 'boss';
}

function resolveAssets(raw) {
  const src = raw && typeof raw === 'object' ? clone(raw) : raw;
  const assets = src?.assets && typeof src.assets === 'object' ? src.assets : {};
  function resolve(url) {
    const s = String(url || '');
    if (s.slice(0, 6) === 'asset:') return assets[s.slice(6)] || '';
    return s;
  }
  src.backgroundDataUrl = resolve(src.backgroundDataUrl);
  Object.keys(src.worlds || {}).forEach((wid) => {
    if (src.worlds[wid]) src.worlds[wid].backgroundDataUrl = resolve(src.worlds[wid].backgroundDataUrl);
  });
  delete src.assets;
  return src;
}

function normalizeNodes(nodes) {
  return (nodes || []).map((node, index) => {
    const out = clone(node);
    out.id = index;
    out.x = Math.max(0, Math.floor(Number(out.x) || 0));
    out.y = Math.max(0, Math.floor(Number(out.y) || 0));
    out.type = String(out.type || (index === 0 ? 'start' : 'stage'));
    out.name = String(out.name || (isSpawnNode(out) ? 'Start' : 'Node ' + index));
    return out;
  });
}

function validateLinearStoryNodes(nodes, label) {
  const where = label || 'map';
  if (!Array.isArray(nodes) || !nodes.length) fail(where + ' needs at least one node.');
  if (nodes.filter(isSpawnNode).length !== 1) fail(where + ' must have exactly one Spawn.');

  let expectedStage = 1;
  let sawCombat = false;
  for (const node of nodes) {
    if (!isCombatNode(node)) continue;
    sawCombat = true;
    const stage = Math.floor(Number(node.stage) || 0);
    if (node.subStage) continue;
    if (stage) {
      if (stage !== expectedStage) {
        fail(where + ' combat stages must be sequential. Expected stage ' + expectedStage + ' at node ' + node.id + ', got ' + stage + '.');
      }
      expectedStage += 1;
    }
  }
  if (!sawCombat && expectedStage === 1) {
    /* Nested-world hubs may have no main-map combat. */
  }
  return Math.max(0, expectedStage - 1);
}

function validateWorlds(worlds) {
  Object.entries(worlds || {}).forEach(([worldId, world]) => {
    if (!world || typeof world !== 'object') fail('World ' + worldId + ' must be an object.');
    if (!Array.isArray(world.nodes) || !world.nodes.length) fail('World ' + worldId + ' needs nodes.');
    world.nodes = normalizeNodes(world.nodes);
    if (world.nodes.filter(isSpawnNode).length !== 1) fail('World ' + worldId + ' must have exactly one Spawn.');
  });
}

function normalizeStoryMap(raw) {
  if (!raw || typeof raw !== 'object') fail('Input JSON must be an object.');
  const pack = resolveAssets(raw);
  if (!Array.isArray(pack.nodes)) fail('Input JSON must include a nodes array.');

  const nodes = normalizeNodes(pack.nodes);
  const worlds = pack.worlds && typeof pack.worlds === 'object' ? clone(pack.worlds) : {};
  validateWorlds(worlds);

  const startMapId = String(pack.startMapId || 'main');
  const startNodes = startMapId === 'main' ? nodes : (worlds[startMapId]?.nodes || []);
  const maxStage = validateLinearStoryNodes(startNodes, startMapId === 'main' ? 'Story map' : 'Start map')
    || asPositiveInt(pack.maxStage, 0);
  const backgroundDataUrl = String(pack.backgroundDataUrl || '').trim();
  if (!backgroundDataUrl) fail('Story map must include backgroundDataUrl.');

  return {
    schemaVersion: Number(pack.schemaVersion) >= 3 ? 3 : 2,
    id: 'story-blackstone',
    name: String(pack.name || 'Blackstone Forest'),
    createdAt: pack.createdAt || new Date().toISOString(),
    mapWidth: asPositiveInt(pack.mapWidth, 1536),
    mapHeight: asPositiveInt(pack.mapHeight, 1024),
    backgroundDataUrl,
    pathReveal: pack.pathReveal !== false,
    maxStage,
    startMapId: worlds[startMapId] ? startMapId : 'main',
    worlds,
    nodes,
  };
}

function renderStoryMapModule(map) {
  return `/**
 * Built-in story overworld map used by Blackstone Forest and Map Forge.
 */
(function (global) {
  'use strict';

  const STORY_MAP = ${JSON.stringify(map, null, 2)};

  function cloneStoryMap(map) {
    return JSON.parse(JSON.stringify(map));
  }

  global.AVIAN_STORY_MAP_DEFAULT = STORY_MAP;
  global.cloneStoryMap = cloneStoryMap;
  global.cloneDefaultStoryMap = function () {
    return cloneStoryMap(STORY_MAP);
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

if (!inputPath) fail('Missing input JSON path.');

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const map = normalizeStoryMap(raw);
writeFileSync(outputPath, renderStoryMapModule(map), 'utf8');
console.log('[import-story-map] wrote js/data/story-map.js with ' + map.nodes.length + ' nodes, ' + Object.keys(map.worlds || {}).length + ' nested maps, and ' + map.maxStage + ' stages.');
