#!/usr/bin/env node
/**
 * Copy uploaded 2x2 bird sprite sheets into assets/sprites/{spriteKey}.png.
 * Sources: explicit paths and Cursor attachment folder (images_*Name-*.png).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'sprites');

/** Basename prefix (after images_) → spriteKey */
const BATCH_MAP = {
  Pigeon: 'pigeon',
  Sparrow: 'sparrow',
  Superbfairywren: 'fairywren',
  Baldeagle: 'baldeagle',
  Albatross: 'albatross',
  Barnowl: 'barnowl',
  Blackbird: 'blackbird',
  Bluejay: 'bluejay',
  Bushturkey: 'bushturkey',
  Bustard: 'bustard',
  Crow: 'crow',
  Dove: 'dove',
  Finch: 'finch',
  Firecrest: 'firecrest',
  Goldeneagle: 'goldeneagle',
  Macaw: 'macaw',
  Dodo: 'dodo',
  Galah: 'galah',
  Goose: 'goose',
  Mutatedpigeon: 'mutatedpigeon',
};

const home = process.env.USERPROFILE || process.env.HOME || '';
const CURSOR_ASSETS = path.join(
  home,
  '.cursor',
  'projects',
  'c-Users-JaK-d-Documents-GitHub-Avian-Ascent-V2',
  'assets',
);

function findSourceForPrefix(prefix) {
  const dirs = [CURSOR_ASSETS, path.join(ROOT, 'assets')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith('.png')) continue;
      const m = name.match(/images_([A-Za-z0-9]+)-/);
      if (!m) continue;
      if (m[1].toLowerCase() === prefix.toLowerCase()) {
        return path.join(dir, name);
      }
    }
  }
  return null;
}

mkdirSync(OUT_DIR, { recursive: true });

let ok = 0;
let fail = 0;

for (const [prefix, spriteKey] of Object.entries(BATCH_MAP)) {
  const dest = path.join(OUT_DIR, `${spriteKey}.png`);
  const src = findSourceForPrefix(prefix);
  if (!src) {
    console.error(`[skip] No source for ${prefix} → ${spriteKey}.png`);
    fail++;
    continue;
  }
  copyFileSync(src, dest);
  console.log(`[ok] ${path.basename(src)} → assets/sprites/${spriteKey}.png`);
  ok++;
}

console.log(`\nInstalled ${ok} sprite(s), ${fail} missing.`);
if (fail > 0) process.exit(1);
