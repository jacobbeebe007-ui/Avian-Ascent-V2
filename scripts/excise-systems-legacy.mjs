/* Surgical removal of the "Global class scaling pass" IIFE in
 * js/systems/systems.js. After the combat rewrite, every `setLevels(legacyId, …)`
 * call in this block is a no-op (the legacy ids no longer exist in
 * ABILITY_TEMPLATES) so the IIFE is ~240 lines of dead patches.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TARGET = path.resolve('js/systems/systems.js');
let src = readFileSync(TARGET, 'utf8');
const beforeLines = src.split('\n').length;

const nl = src.includes('\r\n') ? '\r\n' : '\n';

function exciseBetween(label, startMarker, endAnchor, replacement) {
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) { console.log(`[systems-excise] ${label}: start marker not found; skipping`); return; }
  const endIdxAnchor = src.indexOf(endAnchor, startIdx);
  if (endIdxAnchor === -1) { console.warn(`[systems-excise] ${label}: end anchor not found; skipping`); return; }
  const endIdx = endIdxAnchor + (`${nl}})();`).length;
  src = src.slice(0, startIdx) + replacement + src.slice(endIdx);
  console.log(`[systems-excise] ${label}: excised ${endIdx - startIdx} chars`);
}

exciseBetween(
  'global class scaling pass',
  '/* ===== Global class scaling pass ===== */',
  `${nl}})();${nl}${nl}/* =================================================================${nl} * Run-summary QoL`,
  [
    '/* ===== Global class scaling pass =====',
    ' * Combat rewrite: the legacy `setLevels(\'rapidPeck\', …)` patch table is removed.',
    ' * Ability levels/descs are now data-pack-driven (js/data/combat-pack/skill-trees.js)',
    ' * and read directly by the dispatcher. */',
  ].join(nl),
);

exciseBetween(
  'trickster identity + ability scaling pass',
  '/* ===== Trickster identity + ability scaling pass ===== */',
  `${nl}})();${nl}${nl}${nl}// ===== 24_script_24.js =====`,
  [
    '/* ===== Trickster identity + ability scaling pass =====',
    ' * Combat rewrite: legacy `setLevels(\'dart\', …)` etc patches are removed; the data',
    ' * pack is the only source of ability tuning. */',
  ].join(nl),
);

exciseBetween(
  'cooldown-only IIFE',
  `(function(){${nl}function cooldown(id,cd){`,
  `cooldown('chargeUp',3);${nl}${nl}})();`,
  '/* Combat rewrite: legacy cooldown(\'flyby\'/\'chargeUp\') tweaks removed — data pack governs cooldowns. */',
);

writeFileSync(TARGET, src, 'utf8');
const afterLines = src.split('\n').length;
console.log(`[systems-excise] systems.js: ${beforeLines} -> ${afterLines} lines total`);
