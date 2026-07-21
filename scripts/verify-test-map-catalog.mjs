#!/usr/bin/env node
/**
 * Verify Mission Map test catalog: manifest, map JSON, and background assets.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mapsDir = path.join(root, 'js/data/maps');
const manifestPath = path.join(mapsDir, 'manifest.json');

function fail(message) {
  console.error('[verify-test-map-catalog] FAIL: ' + message);
  process.exit(1);
}

function ok(message) {
  console.log('[verify-test-map-catalog] OK: ' + message);
}

if (!existsSync(manifestPath)) fail('Missing manifest at js/data/maps/manifest.json');

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (err) {
  fail('Could not parse manifest.json: ' + err.message);
}

if (!Array.isArray(manifest) || !manifest.length) fail('manifest.json must be a non-empty array.');

const seenIds = new Set();
for (const entry of manifest) {
  if (!entry || typeof entry !== 'object') fail('Manifest entries must be objects.');
  const id = String(entry.id || '').trim();
  const file = String(entry.file || '').trim();
  if (!id || !file) fail('Each manifest entry needs id and file.');
  if (seenIds.has(id)) fail('Duplicate manifest id: ' + id);
  seenIds.add(id);
  if (file.includes('..') || file.includes('/') || file.includes('\\')) {
    fail('Manifest file must be a bare filename: ' + file);
  }

  const mapPath = path.join(mapsDir, file);
  if (!existsSync(mapPath)) fail('Missing map JSON: js/data/maps/' + file);

  let map;
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch (err) {
    fail('Could not parse js/data/maps/' + file + ': ' + err.message);
  }
  if (!Array.isArray(map.nodes) || !map.nodes.length) {
    fail('Map js/data/maps/' + file + ' must include a non-empty nodes array.');
  }

  const checkBg = (bgUrl, label) => {
    const raw = String(bgUrl || '').trim();
    if (!raw) return;
    if (raw.startsWith('data:')) {
      fail('Map ' + file + ' ' + label + ' still uses embedded data URL — run import-test-map.mjs.');
    }
    if (!raw.startsWith('assets/')) {
      fail('Map ' + file + ' ' + label + ' must use assets/ path, got: ' + raw);
    }
    const assetPath = path.join(root, raw.replace(/\//g, path.sep));
    if (!existsSync(assetPath)) fail('Missing background asset for ' + file + ': ' + raw);
  };

  checkBg(map.backgroundDataUrl, 'main backgroundDataUrl');
  Object.values(map.worlds || {}).forEach((world, idx) => {
    checkBg(world?.backgroundDataUrl, 'world backgroundDataUrl #' + idx);
  });
}

ok('manifest has ' + manifest.length + ' map(s)');
