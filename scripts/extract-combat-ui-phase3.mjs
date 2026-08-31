#!/usr/bin/env node
/**
 * One-shot extractor for Step 7 Phase 3 combat UI blocks from game.js.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const GAME = 'js/core/game.js';
const lines = readFileSync(GAME, 'utf8').split('\n');

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const files = [
  {
    path: 'js/ui/combat-stats-modal.js',
    header: '/* Avian Ascent — combat Stats & Details modal (Step 7 Phase 3). */\n',
    ranges: [[8928, 9347]],
    footer: `
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatStatsModal = {
  open: openCombatStatsModal,
  close: closeCombatStatsModal,
  refreshIfOpen: refreshCombatStatsModalIfOpen,
  buildDetailsHtml: buildCombatDetailsModalHtml,
};
`,
  },
  {
    path: 'js/ui/combat-bars.js',
    header: '/* Avian Ascent — combat HP/EN/protection bars (Step 7 Phase 3). */\n',
    ranges: [[9471, 9517], [9647, 9739]],
    footer: `
globalThis.setHpBar = setHpBar;
globalThis.setEnergyBar = setEnergyBar;
globalThis.setProtectionBars = setProtectionBars;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatBars = { setHpBar, setEnergyBar, setProtectionBars };
`,
  },
  {
    path: 'js/ui/combat-status.js',
    header: '/* Avian Ascent — combat status badges and ailment symbols (Step 7 Phase 3). */\n',
    ranges: [[9519, 9645]],
    footer: `
globalThis.renderStatuses = renderStatuses;
globalThis.renderBattleAilmentSymbols = renderBattleAilmentSymbols;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatStatus = { renderStatuses, renderBattleAilmentSymbols };
`,
  },
  {
    path: 'js/ui/combat-enemy-telegraph.js',
    header: '/* Avian Ascent — enemy intent telegraph UI (Step 7 Phase 3). */\n',
    ranges: [[9850, 9926]],
    footer: `
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatEnemyTelegraph = { renderEnemyPlan, applyEnemyIntentVisibility };
`,
  },
  {
    path: 'js/ui/combat-hud.js',
    header: '/* Avian Ascent — combat HUD refresh orchestration (Step 7 Phase 3). */\n',
    ranges: [[9349, 9469], [9741, 9828], [9928, 9939]],
    footer: `
globalThis.refreshBattleUI = refreshBattleUI;
globalThis.renderAllCombatUI = renderAllCombatUI;
globalThis.renderEnergyOrbs = renderEnergyOrbs;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatHud = { refreshBattleUI, renderAllCombatUI, renderEnergyOrbs };
`,
  },
  {
    path: 'js/ui/combat-actions.js',
    header: '/* Avian Ascent — combat action tray rendering (Step 7 Phase 3). */\n',
    ranges: [[10294, 10542]],
    footer: `
globalThis.renderActions = renderActions;
globalThis.renderCombatItems = renderCombatItems;
Avian.ui = Avian.ui || Object.create(null);
Avian.ui.combatActions = { renderActions, renderCombatItems };
`,
  },
];

const removeRanges = [];

for (const f of files) {
  const body = f.ranges.map(([s, e]) => slice(s, e)).join('\n\n');
  writeFileSync(f.path, f.header + body + '\n' + f.footer);
  console.log('Wrote', f.path, `(${f.ranges.map((r) => r.join('-')).join(', ')})`);
  for (const [s, e] of f.ranges) removeRanges.push([s, e, f.path]);
}

removeRanges.sort((a, b) => b[0] - a[0]);
const out = [...lines];
for (const [start, end, file] of removeRanges) {
  out.splice(start - 1, end - start + 1, `/* Combat UI → ${file} */`);
}

writeFileSync(GAME, out.join('\n'));
console.log('Updated', GAME, '→', out.length, 'lines');
