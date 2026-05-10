#!/usr/bin/env node
/* Avian Ascent — ABILITY_TEMPLATES diff between two git refs.
 *
 * Usage:
 *   node scripts/diff-templates.js <fromRef> [toRef]
 *   node scripts/diff-templates.js HEAD~1            # vs working tree
 *   node scripts/diff-templates.js main HEAD         # main → HEAD
 *
 * Stdlib only. Extracts each top-level ABILITY_TEMPLATES key with its
 * raw object literal and shows added / removed / changed entries. Useful
 * when reviewing balance PRs without scrolling through a 30k-line diff.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function gitShow(ref, file) {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    console.error(`[diff-templates] failed to read ${ref}:${file} — ${e.message.split('\n')[0]}`);
    process.exit(1);
  }
}

function readWorkingTree(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

/**
 * Extracts top-level keys + their raw literal text from
 *   const ABILITY_TEMPLATES = { ... };
 * Returns Map<string, string>.
 */
function extractTemplates(src) {
  const out = new Map();
  const markers = [
    'const ABILITY_TEMPLATES =',
    'const ABILITY_TEMPLATES_EXTRA =',
    'const ABILITY_TEMPLATES_LEARNABLE =',
    'const ABILITY_TEMPLATES_MAGIC =',
  ];
  for (const marker of markers) {
    const start = src.indexOf(marker);
    if (start < 0) continue;
    const open = src.indexOf('{', start);
    if (open < 0) continue;
    let depth = 0;
    let inString = false;
    let stringQuote = '';
    let escaped = false;
    let entryStart = -1;
    let entryKey = null;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === stringQuote) {
          inString = false;
          stringQuote = '';
        }
        continue;
      }
      if (ch === '"' || ch === '\'' || ch === '`') {
        inString = true;
        stringQuote = ch;
        continue;
      }
      if (ch === '{') {
        depth++;
        continue;
      }
      if (ch === '}') {
        depth--;
        if (depth === 0) break;
        if (depth === 1 && entryStart >= 0 && entryKey) {
          out.set(entryKey, src.slice(entryStart, i + 1).trim());
          entryStart = -1;
          entryKey = null;
        }
        continue;
      }
      if (depth === 1 && entryStart < 0 && /[A-Za-z_$"']/.test(ch)) {
        // start of a new top-level entry — read the key
        let j = i;
        let key = '';
        if (ch === '"' || ch === '\'') {
          j++;
          while (j < src.length && src[j] !== ch) {
            key += src[j];
            j++;
          }
          j++;
        } else {
          while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) {
            key += src[j];
            j++;
          }
        }
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === ':') {
          entryKey = key;
          entryStart = i;
          i = j;
        } else {
          i = j - 1;
        }
      }
    }
  }
  return out;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/diff-templates.js <fromRef> [toRef]');
  process.exit(1);
}
const fromRef = args[0];
const toRef = args[1];
const file = 'js/core/game.js';

const fromSrc = gitShow(fromRef, file);
const toSrc = toRef ? gitShow(toRef, file) : readWorkingTree(file);

const fromMap = extractTemplates(fromSrc);
const toMap = extractTemplates(toSrc);

const added = [];
const removed = [];
const changed = [];

for (const k of toMap.keys()) {
  if (!fromMap.has(k)) added.push(k);
  else if (toMap.get(k) !== fromMap.get(k)) changed.push(k);
}
for (const k of fromMap.keys()) {
  if (!toMap.has(k)) removed.push(k);
}

const label = `${fromRef} → ${toRef || 'working-tree'}`;
console.log(`ABILITY_TEMPLATES diff (${label}):`);
console.log(`  total entries: ${fromMap.size} → ${toMap.size}`);
console.log(`  added (${added.length}):   ${added.sort().join(', ') || '—'}`);
console.log(`  removed (${removed.length}): ${removed.sort().join(', ') || '—'}`);
console.log(`  changed (${changed.length}): ${changed.sort().join(', ') || '—'}`);

if (process.env.AVIAN_DIFF_VERBOSE === '1') {
  for (const k of changed.sort()) {
    console.log('\n--- ' + k + ' ---');
    console.log('FROM:\n' + fromMap.get(k));
    console.log('TO:\n' + toMap.get(k));
  }
}
