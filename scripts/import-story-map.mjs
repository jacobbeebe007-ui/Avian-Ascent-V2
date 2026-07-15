#!/usr/bin/env node
/**
 * Import a Map Forge JSON export as the built-in GitHub Pages story map.
 *
 * Usage:
 *   node scripts/import-story-map.mjs path/to/avian-map-export.json
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

function normalizeNodes(nodes) {
  return nodes.map((node, index) => {
    const out = clone(node);
    out.id = index;
    out.x = Math.max(0, Math.floor(Number(out.x) || 0));
    out.y = Math.max(0, Math.floor(Number(out.y) || 0));
    out.type = String(out.type || (index === 0 ? 'start' : 'stage'));
    out.name = String(out.name || (out.type === 'start' ? 'Start' : 'Node ' + index));
    return out;
  });
}

function validateLinearStoryNodes(nodes) {
  if (!Array.isArray(nodes) || !nodes.length) fail('Story map needs at least one node.');
  if (nodes.filter((n) => n.type === 'start').length !== 1) fail('Story map must have exactly one start node.');
  if (nodes[0].type !== 'start') fail('First story map node must be the start node.');

  let expectedStage = 1;
  for (const node of nodes) {
    if (node.type !== 'stage' && node.type !== 'boss') continue;
    const stage = Math.floor(Number(node.stage) || 0);
    if (stage !== expectedStage) {
      fail('Combat stages must be sequential. Expected stage ' + expectedStage + ' at node ' + node.id + ', got ' + stage + '.');
    }
    expectedStage += 1;
  }
  if (expectedStage === 1) fail('Story map needs at least one stage or boss node.');
  return expectedStage - 1;
}

function validateWorlds(worlds) {
  Object.entries(worlds || {}).forEach(([worldId, world]) => {
    if (!world || typeof world !== 'object') fail('World ' + worldId + ' must be an object.');
    if (!Array.isArray(world.nodes) || !world.nodes.length) fail('World ' + worldId + ' needs nodes.');
    if (world.nodes.filter((n) => n.type === 'start').length !== 1) fail('World ' + worldId + ' must have exactly one start node.');
    if (world.nodes[0].type !== 'start') fail('World ' + worldId + ' first node must be start.');
  });
}

function normalizeStoryMap(raw) {
  if (!raw || typeof raw !== 'object') fail('Input JSON must be an object.');
  if (!Array.isArray(raw.nodes)) fail('Input JSON must include a nodes array.');

  const nodes = normalizeNodes(raw.nodes);
  // Story mode is always a flat main map — ignore nested Forge worlds / startMapId.
  const worlds = {};

  const maxStage = validateLinearStoryNodes(nodes);
  validateWorlds(worlds);
  const backgroundDataUrl = String(raw.backgroundDataUrl || '').trim();
  if (!backgroundDataUrl) fail('Story map must include backgroundDataUrl.');

  return {
    schemaVersion: 2,
    id: 'story-blackstone',
    name: String(raw.name || 'Blackstone Forest'),
    createdAt: raw.createdAt || new Date().toISOString(),
    mapWidth: asPositiveInt(raw.mapWidth, 1536),
    mapHeight: asPositiveInt(raw.mapHeight, 1024),
    backgroundDataUrl,
    pathReveal: raw.pathReveal !== false,
    maxStage,
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
console.log('[import-story-map] wrote js/data/story-map.js with ' + map.nodes.length + ' nodes and ' + map.maxStage + ' stages.');
