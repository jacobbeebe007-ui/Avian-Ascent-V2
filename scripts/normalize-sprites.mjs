#!/usr/bin/env node
/**
 * Map every sprite upload (any casing / legacy spaced names) to assets/sprites/{spriteKey}.png.
 * Prefers real PNG over JPEG when multiple sources exist for the same bird.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_DIR = path.join(ROOT, 'assets', 'sprites');

/** Normalized filename (a-z0-9 only) → canonical spriteKey */
const FILE_ALIASES = {
  baldeagle: 'baldeagle',
  emperorpenguin: 'penguin',
  secretarybird: 'secretarybird',
  secretary: 'secretarybird',
  shoebillstork: 'shoebill',
  harpyeagle: 'harpy',
  blackcockatoo: 'blackcockatoo',
  dukeblakiston: 'dukeblakiston',
  mutatedpigeon: 'mutatedpigeon',
  superbfairywren: 'fairywren',
  rockpigeon: 'pigeon',
  rockdove: 'dove',
};

function flatName(filename) {
  return path.basename(filename, path.extname(filename)).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toSpriteKey(filename) {
  const flat = flatName(filename);
  return FILE_ALIASES[flat] || flat;
}

function isPng(buf) {
  return buf.length >= 4 && buf.slice(0, 4).toString('hex') === '89504e47';
}

function score(buf) {
  return (isPng(buf) ? 1_000_000_000 : 0) + buf.length;
}

mkdirSync(SPRITE_DIR, { recursive: true });

const byKey = new Map();

for (const name of readdirSync(SPRITE_DIR)) {
  if (!/\.(png|jpe?g)$/i.test(name)) continue;
  const full = path.join(SPRITE_DIR, name);
  const key = toSpriteKey(name);
  const buf = readFileSync(full);
  const entry = { name, full, buf, fmt: isPng(buf) ? 'PNG' : 'JPEG' };
  const prev = byKey.get(key);
  if (!prev || score(buf) > score(prev.buf)) byKey.set(key, entry);
}

let ok = 0;
const warnings = [];

for (const [key, best] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dest = path.join(SPRITE_DIR, `${key}.png`);
  copyFileSync(best.full, dest);
  const tag = best.fmt === 'PNG' ? 'ok' : 'warn';
  console.log(`[${tag}] ${best.name} → ${key}.png (${best.fmt})`);
  if (best.fmt !== 'PNG') warnings.push(key);
  ok++;
}

console.log(`\nNormalized ${ok} sprite key(s).`);
if (warnings.length) {
  console.warn(`\nStill JPEG (no transparency): ${warnings.join(', ')}`);
  console.warn('Re-export those as PNG with alpha and drop into assets/sprites/.');
}
