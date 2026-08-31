#!/usr/bin/env node
/**
 * Generates docs/game-js-extraction-audit.md from js/core/game.js analysis.
 * Run: node scripts/generate-game-js-audit.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const GAME_PATH = 'js/core/game.js';
const OUT_PATH = 'docs/game-js-extraction-audit.md';
const src = readFileSync(GAME_PATH, 'utf8');
const lines = src.split('\n');
const lineCount = lines.length;

const funcs = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let m = line.match(/^(?:async )?function (\w+)/);
  if (m) funcs.push({ name: m[1], line: i + 1 });
  m = line.match(/^const (\w+) = (?:async )?function/);
  if (m) funcs.push({ name: m[1], line: i + 1 });
}

function categorize(name) {
  const n = name;
  if (/debug|telemetry|agent|harness|benchmark|scenario|Dbg/i.test(n)) return 'Debug';
  if (/buildNest|MapForge|mapForge|forge/i.test(n)) return 'Build Nest';
  if (/nest|Nest/i.test(n) && !/enemy/i.test(n)) return 'Nest';
  if (/shop|Shop|stork/i.test(n)) return 'Shop';
  if (/reward|Reward|upgrade|Upgrade|tier/i.test(n)) return 'Rewards';
  if (/story|Story|ow|Ow|overworld|Overworld|mission/i.test(n)) return 'Story/Overworld';
  if (/save|Save|load|Load|migrate|erase|cache/i.test(n)) return 'Save/load';
  if (/audio|Audio|bgm|sound|music/i.test(n)) return 'Audio';
  if (/equipment|Equipment|gear|loadout/i.test(n)) return 'Equipment';
  if (/tooltip|Tooltip|wire|bind|render|Render|open|close|show|hide|modal|Modal|html|Html/i.test(n)) return 'Combat UI';
  if (/format|Format|clamp|round|ledger|normalize|resolve.*Class|rewardTier/i.test(n)) return 'Utilities';
  if (/enemy|Enemy|ai|AI|encounter|Encounter|scale/i.test(n)) return 'Enemy setup/AI';
  if (/combat|Combat|battle|Battle|turn|Turn|damage|Damage|ability|Ability|attack|Attack/i.test(n)) return 'Combat';
  if (/bird|Bird|select|Select|unlock|Unlock/i.test(n)) return 'Bird selection';
  if (/passive|Passive|classPerk|ClassPerk/i.test(n)) return 'Class/Passive';
  if (/endless|Endless|grove|Grove/i.test(n)) return 'Endless/Meta';
  return 'Bootstrap/Orchestration';
}

function suggestDest(cat, name) {
  const map = {
    Debug: 'js/debug/',
    'Build Nest': 'js/world/map-forge.js (existing) / js/ui/build-nest.js',
    Nest: 'js/ui/nest-ui.js',
    Shop: 'js/systems/shop-v2.js / js/ui/shop-ui.js',
    Rewards: 'js/systems/nest-rewards.js / js/ui/reward-screen.js',
    'Story/Overworld': 'js/systems/story-run-state.js / js/world/overworld_bridge.js',
    'Save/load': 'js/systems/save-migrations.js',
    Audio: 'js/audio/bgm-shared.js',
    Equipment: 'js/systems/equipment*.js',
    'Combat UI': 'js/ui/combat-hud.js / js/ui/combat-log.js',
    Utilities: 'js/core/game-helpers.js',
    'Enemy setup/AI': 'js/systems/enemy-roster-runtime.js / js/systems/combat-setup.js',
    Combat: 'js/systems/combat-controller.js / js/systems/ability-dispatcher.js',
    'Bird selection': 'js/ui/ui.js',
    'Class/Passive': 'js/systems/class-perk-runtime.js',
    'Endless/Meta': 'js/systems/endless-map.js',
    'Bootstrap/Orchestration': 'js/core/game.js (retain)',
  };
  return map[cat] || 'js/core/game.js (review)';
}

function riskLevel(cat, name) {
  if (cat === 'Utilities') return 'Low';
  if (cat === 'Debug') return 'Low';
  if (cat === 'Combat UI') return 'Medium';
  if (cat === 'Combat') return 'High';
  if (cat === 'Save/load') return 'High';
  if (/turn|finishBattle|loadStage|startBattle/i.test(name)) return 'High';
  return 'Medium';
}

function globalReq(name) {
  const globals = new Set();
  const re = new RegExp(`globalThis\\.${name}\\s*=|window\\.${name}\\s*=|Avian\\.actions\\.${name}`);
  if (re.test(src)) return 'Yes (explicit global/Avian.actions)';
  if (readFileSync('index.html', 'utf8').includes(`data-action="${name}`)) return 'Yes (data-action in index.html)';
  return 'No (internal)';
}

const byCat = {};
for (const f of funcs) {
  const cat = categorize(f.name);
  (byCat[cat] ||= []).push(f);
}

const extracted = {
  Utilities: '✅ Phase 1 (game-helpers.js)',
  Debug: '🟡 Phase 2 (js/debug/)',
  'Combat UI': '⬜ Phase 3',
  'Build Nest': '⬜ Phase 4 (partially in map-forge.js)',
  Rewards: '⬜ Phase 5',
  Shop: '⬜ Phase 5B',
  'Story/Overworld': '⬜ Phase 6',
  'Enemy setup/AI': '⬜ Phase 7',
  Combat: '⬜ Phase 8',
  'Bootstrap/Orchestration': '🔁 Retain in game.js',
};

let md = `# game.js Extraction Audit (Step 7)

Generated: ${new Date().toISOString().slice(0, 10)}  
Source: \`${GAME_PATH}\`  
**Before Step 7:** ${lineCount} lines  
**Functions:** ${funcs.length} top-level

## Extraction status by category

| Category | Count | Status |
|----------|------:|--------|
`;

for (const [cat, arr] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
  md += `| ${cat} | ${arr.length} | ${extracted[cat] || '⬜ Not started'} |\n`;
}

md += `
## Extraction rules (summary)

1. Extract by system boundary, not line count.
2. Preserve \`window\` / \`Avian.actions\` / \`data-action\` compatibility.
3. Update \`js/bootstrap/load-order.json\` for every new module.
4. Run \`npm test\` after each phase.

## Function inventory

| Name | Line | Category | Global | Risk | Suggested destination |
|------|-----:|----------|--------|------|----------------------|
`;

for (const f of funcs) {
  const cat = categorize(f.name);
  md += `| \`${f.name}\` | ${f.line} | ${cat} | ${globalReq(f.name)} | ${riskLevel(cat, f.name)} | ${suggestDest(cat, f.name)} |\n`;
}

md += `
## Major inline data still in game.js

| Block | Notes | Status |
|-------|-------|--------|
| \`ABILITY_TEMPLATES\` | ~5300 lines; boot-populated | ⬜ Deferred (high coupling) |
| \`G\` game state | Central mutable state | 🔁 Partial — classify owners per field |
| \`registerGameModule\` | Module hook registry | 🔁 Retain until all consumers migrated |
| Dove sprite patch IIFE | Legacy enemy portrait | ✅ Isolated at file top |

## Recommended extraction order

1. ✅ Pure helpers → \`js/core/game-helpers.js\`
2. 🟡 Debug/telemetry → \`js/debug/\`
3. ⬜ Combat UI rendering
4. ⬜ Build Nest (extend \`map-forge.js\`)
5. ⬜ Rewards/shop
6. ⬜ Story orchestration
7. ⬜ Encounter/combatant setup
8. ⬜ Combat controller
9. ⬜ Legacy compatibility cleanup

Regenerate this file: \`node scripts/generate-game-js-audit.mjs\`
`;

writeFileSync(OUT_PATH, md);
console.log(`Wrote ${OUT_PATH} (${funcs.length} functions, ${lineCount} lines)`);
