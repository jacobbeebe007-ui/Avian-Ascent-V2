#!/usr/bin/env node
/**
 * Import a Map Forge JSON export into the Mission Map test catalog.
 *
 * Usage:
 *   node scripts/import-test-map.mjs path/to/export.json --id finch-burrow --name "Finch-Burrow"
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const mapsDir = path.join(root, 'js/data/maps');
const assetsDir = path.join(root, 'assets/maps');
const manifestPath = path.join(mapsDir, 'manifest.json');

function fail(message) {
  console.error('[import-test-map] ' + message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  let id = '';
  let name = '';
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id') {
      id = String(argv[++i] || '').trim();
    } else if (arg === '--name') {
      name = String(argv[++i] || '').trim();
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }
  return {
    inputPath: positional[0] ? path.resolve(process.cwd(), positional[0]) : '',
    id,
    name,
  };
}

function slugId(value) {
  return String(value || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
}

function decodeDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim();
  const match = /^data:([^;]+);base64,(.+)$/s.exec(raw);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function extForMime(mime) {
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  return '.png';
}

function extractBackground(mapId, label, dataUrl) {
  const raw = String(dataUrl || '').trim();
  if (!raw) return { path: '', wrote: false, bytes: 0 };
  if (!raw.startsWith('data:image/')) return { path: raw, wrote: false, bytes: 0 };

  const decoded = decodeDataUrl(raw);
  if (!decoded) fail('Could not decode background for ' + label + '.');

  mkdirSync(assetsDir, { recursive: true });
  const ext = extForMime(decoded.mime);
  const filename = mapId + '-' + label + ext;
  const relPath = 'assets/maps/' + filename;
  const absPath = path.join(root, relPath);
  writeFileSync(absPath, decoded.buffer);
  return { path: relPath, wrote: true, bytes: decoded.buffer.length };
}

function validateMap(raw) {
  if (!raw || typeof raw !== 'object') fail('Input JSON must be an object.');
  if (!Array.isArray(raw.nodes) || !raw.nodes.length) fail('Map must include a non-empty nodes array.');
}

function upsertManifest(entry) {
  mkdirSync(mapsDir, { recursive: true });
  let manifest = [];
  if (existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest = Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      manifest = [];
    }
  }
  const idx = manifest.findIndex((m) => m && m.id === entry.id);
  if (idx >= 0) manifest[idx] = entry;
  else manifest.push(entry);
  manifest.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

const { inputPath, id: idArg, name: nameArg } = parseArgs(process.argv.slice(2));
if (!inputPath) fail('Missing input JSON path.');

const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
validateMap(raw);

const mapId = slugId(idArg || raw.id || raw.name);
const mapName = nameArg || String(raw.name || mapId);
const map = JSON.parse(JSON.stringify(raw));

const written = [];
const mainBg = extractBackground(mapId, 'main', map.backgroundDataUrl);
if (mainBg.path) map.backgroundDataUrl = mainBg.path;
if (mainBg.wrote) written.push({ label: 'main', path: mainBg.path, bytes: mainBg.bytes });

Object.keys(map.worlds || {}).forEach((worldId) => {
  const world = map.worlds[worldId];
  if (!world || typeof world !== 'object') return;
  const bg = extractBackground(mapId, worldId, world.backgroundDataUrl);
  if (bg.path) world.backgroundDataUrl = bg.path;
  if (bg.wrote) written.push({ label: worldId, path: bg.path, bytes: bg.bytes });
});

const outFile = mapId + '.json';
const outPath = path.join(mapsDir, outFile);
writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');

upsertManifest({ id: mapId, name: mapName, file: outFile });

console.log('[import-test-map] wrote ' + path.relative(root, outPath));
console.log('[import-test-map] updated ' + path.relative(root, manifestPath));
if (written.length) {
  written.forEach((w) => {
    console.log('[import-test-map] background ' + w.label + ' -> ' + w.path + ' (' + w.bytes + ' bytes)');
  });
} else {
  console.log('[import-test-map] backgrounds already path-based (no PNG extraction).');
}
console.log('[import-test-map] catalog id: ' + mapId + ' (' + mapName + ')');
