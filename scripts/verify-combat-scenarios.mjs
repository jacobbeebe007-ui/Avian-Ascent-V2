#!/usr/bin/env node
/**
 * Combat Scenario Test Harness runner.
 *
 * Usage:
 *   node scripts/verify-combat-scenarios.mjs
 *   node scripts/verify-combat-scenarios.mjs --filter EN-
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runScenarioSuite, createSandbox } from './combat-scenarios/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENARIO_DIR = path.join(__dirname, 'combat-scenarios', 'scenarios');

const MODULES = [
  'energy.mjs',
  'cooldowns.mjs',
  'damage.mjs',
  'protection.mjs',
  'ailments.mjs',
  'buffs-debuffs.mjs',
  'precision-dodge.mjs',
  'passives.mjs',
  'class-perks.mjs',
  'equipment.mjs',
  'enemy-ai.mjs',
  'death-victory.mjs',
];

function parseArgs(argv) {
  const out = { filter: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--filter' && argv[i + 1]) {
      out.filter = argv[++i];
    } else if (argv[i].startsWith('--filter=')) {
      out.filter = argv[i].slice('--filter='.length);
    }
  }
  return out;
}

async function loadAllScenarios(filter) {
  const all = [];
  for (const file of MODULES) {
    const full = path.join(SCENARIO_DIR, file);
    const mod = await import(pathToFileURL(full).href);
    const list = Array.isArray(mod.default) ? mod.default : [];
    for (const s of list) {
      if (filter) {
        const hay = `${s.id} ${s.name}`;
        if (!hay.toLowerCase().includes(filter.toLowerCase())) continue;
      }
      all.push(s);
    }
  }
  return all;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log('[combat-scenarios] loading game bundle…');
  const sandbox = createSandbox({ quiet: true });
  const scenarios = await loadAllScenarios(args.filter);
  if (!scenarios.length) {
    console.error('[combat-scenarios] no scenarios matched');
    process.exit(1);
  }
  console.log(`[combat-scenarios] running ${scenarios.length} scenario(s)\n`);

  const { passed, failed, pending, total } = runScenarioSuite(scenarios, { sandbox });

  console.log('');
  console.log(`[combat-scenarios] ${passed} passed, ${failed} failed, ${pending} pending / ${total}`);
  if (failed > 0) process.exit(1);
  console.log('[combat-scenarios] all checks passed');
}

main().catch((err) => {
  console.error('[combat-scenarios] fatal', err);
  process.exit(1);
});
