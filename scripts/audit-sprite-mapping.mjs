#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spriteDir = path.join(ROOT, 'assets', 'sprites');
const sprites = new Set(
  readdirSync(spriteDir)
    .filter((f) => /^[a-z0-9]+\.png$/.test(f))
    .map((f) => f.replace('.png', '')),
);

function norm(k) {
  k = String(k || '').toLowerCase().replace(/[^a-z]/g, '');
  if (k === 'secretary') return 'secretarybird';
  if (k === 'harpyeagle') return 'harpy';
  if (k === 'peregrinefalcon') return 'peregrine';
  if (k === 'snowyowl' || k === 'snowy') return 'snowyowl';
  return k;
}

const birdsSrc = readFileSync(path.join(ROOT, 'js/data/birds.js'), 'utf8');
const birds = [];
for (const m of birdsSrc.matchAll(/^\s+([a-zA-Z]+):\{[\s\S]*?portraitKey:"([^"]+)"/gm)) {
  birds.push({ birdKey: m[1], portraitKey: m[2] });
}

const gameSrc = readFileSync(path.join(ROOT, 'js/core/game.js'), 'utf8');
const keysMatch = gameSrc.match(/SPRITE_KEYS_ALL = new Set\(\[([\s\S]*?)\]\)/);
const registered = new Set([...keysMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

let issues = 0;
console.log('=== Birds missing sprite wiring ===');
for (const b of birds) {
  const sk = norm(b.portraitKey || b.birdKey);
  const hasFile = sprites.has(sk);
  const inReg = registered.has(sk);
  if (!hasFile) {
    console.log(`  NO FILE  ${b.birdKey} → ${sk}`);
    issues++;
    continue;
  }
  if (!inReg) {
    console.log(`  NO REG   ${b.birdKey} → ${sk}`);
    issues++;
  }
}
if (!issues) console.log('  (none — all roster birds with sprites are wired)');

console.log('\n=== Enemy-only / extra sprites ===');
const birdSprites = new Set(birds.map((b) => norm(b.portraitKey || b.birdKey)));
for (const s of [...sprites].sort()) {
  if (!birdSprites.has(s)) console.log(`  ${s}`);
}
