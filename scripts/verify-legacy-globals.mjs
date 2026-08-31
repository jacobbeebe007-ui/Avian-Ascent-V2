#!/usr/bin/env node
/* Verify legacy global UI API + Step 7 exports (Phase 9). */
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const bundle = readFileSync('js/avian-game.bundle.js', 'utf8');
const compat = readFileSync('js/legacy/game-compat.js', 'utf8');

function collect(attr) {
  const out = new Set();
  const re = new RegExp(`${attr}="([^"]+)"`, 'g');
  let m;
  while ((m = re.exec(html))) out.add(m[1].split(':')[0]);
  return [...out].sort();
}

function hasCallable(name) {
  if (bundle.includes(`function ${name}(`)) return true;
  if (new RegExp(`globalThis\\.${name}\\s*=`).test(bundle)) return true;
  if (new RegExp(`global\\.${name}\\s*=`).test(bundle)) return true;
  if (new RegExp(`Avian\\.actions\\.${name}\\s*=`).test(bundle)) return true;
  if (new RegExp(`Avian\\.actions\\['${name}'\\]\\s*=`).test(bundle)) return true;
  return false;
}

const checks = [];
for (const name of collect('data-action')) {
  checks.push({ name: `data-action ${name}`, ok: hasCallable(name) });
}
for (const name of collect('data-change')) {
  checks.push({ name: `data-change ${name}`, ok: hasCallable(name) });
}
for (const name of collect('data-input')) {
  checks.push({ name: `data-input ${name}`, ok: hasCallable(name) });
}

checks.push({ name: 'game-compat exposes Avian.legacy.exposeLegacyGlobals', ok: compat.includes('exposeLegacyGlobals') });
checks.push({ name: 'game-compat STEP7_LEGACY_FUNCTIONS registry', ok: compat.includes('STEP7_LEGACY_FUNCTIONS') });
checks.push({ name: 'dove patch module exists', ok: existsSync('js/legacy/dove-sprite-patch.js') });
checks.push({ name: 'game.js no dove patch IIFE', ok: !readFileSync('js/core/game.js', 'utf8').includes('sprite-dove frame-0') });

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error('verify-legacy-globals FAILED:');
  for (const f of failed) console.error(' -', f.name);
  process.exit(1);
}
console.log(`verify-legacy-globals: ${checks.length} checks passed`);
