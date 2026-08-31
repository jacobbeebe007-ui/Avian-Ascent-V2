#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

function collect(attr) {
  const out = new Set();
  const re = new RegExp(`${attr}="([^"]+)"`, 'g');
  let m;
  while ((m = re.exec(html))) out.add(m[1].split(':')[0]);
  return [...out].sort();
}

const actions = collect('data-action');
const changes = collect('data-change');
const inputs = collect('data-input');
const submits = collect('data-submit');

let md = `# Global UI API (Step 7)

Required browser-callable actions resolved by \`js/ui/event-router.js\` via \`Avian.actions[name]\` with fallback to \`globalThis[name]\`.

## data-action handlers (${actions.length})

${actions.map((a) => `- \`${a}\``).join('\n')}

## data-change handlers (${changes.length})

${changes.map((a) => `- \`${a}\``).join('\n')}

## data-input handlers (${inputs.length})

${inputs.map((a) => `- \`${a}\``).join('\n')}

## data-submit handlers (${submits.length})

${submits.map((a) => `- \`${a}\``).join('\n')}

## Legacy inline onclick (game.js generated HTML)

- \`hideTooltip()\` — combat tooltip close button in rich tooltips

## Explicit globalThis exports

See \`scripts/verify-architecture.mjs\` for the authoritative required-global list maintained in CI.

Regenerate: \`node scripts/generate-global-ui-api.mjs\`
`;

writeFileSync('docs/global-ui-api.md', md);
console.log(`Wrote docs/global-ui-api.md (${actions.length} data-action handlers)`);
