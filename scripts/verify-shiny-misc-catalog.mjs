#!/usr/bin/env node
/**
 * Runtime check: tiered shiny misc catalog rolls and grants distinct items.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ROOT = process.cwd();

function fail(msg) {
  console.error('[shiny-misc-catalog] FAIL', msg);
  process.exitCode = 1;
}
function ok(msg) {
  console.log('[shiny-misc-catalog] ok  ', msg);
}

const sandbox = {
  globalThis: {},
  console,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const file of [
  'js/bootstrap/_namespace.js',
  'js/data/shiny-misc-catalog.js',
]) {
  vm.runInContext(readFileSync(`${ROOT}/${file}`, 'utf8'), sandbox, { filename: file });
}

const catalog = sandbox.Avian?.data?.shinyMiscCatalog;
if (!catalog) fail('shinyMiscCatalog missing');
else ok('catalog loaded');

const items = catalog.items || [];
if (items.length < 5) fail(`expected at least 5 shiny misc tiers, got ${items.length}`);
else ok(`${items.length} shiny misc tiers defined`);

const tiers = new Set(items.map((it) => it.tier));
for (const tier of ['grey', 'green', 'blue', 'purple', 'gold']) {
  if (!tiers.has(tier)) fail(`missing tier ${tier}`);
}
ok('all standard tiers represented');

const weightSum = items.reduce((sum, it) => sum + (Number(it.dropWeight) || 0), 0);
if (weightSum <= 0) fail('drop weights must sum above zero');
else ok(`drop weights sum to ${weightSum}`);

const forced = catalog.rollShinyMiscItem(true);
if (!forced || !forced.id) fail('forced roll returned nothing');
else ok(`forced roll -> ${forced.name} (${forced.tier})`);

const drop = catalog.shinyMiscToNestDrop(forced);
if (!drop || drop.type !== 'shiny' || drop.shinyMiscId !== forced.id) fail('nest drop mapping failed');
else ok('nest drop mapping includes shinyMiscId');

const seen = new Set();
for (let i = 0; i < 5000; i++) {
  const rolled = catalog.rollShinyMiscItem(true);
  if (rolled) seen.add(rolled.id);
}
if (seen.size < 3) fail(`weighted rolls too narrow after 5000 tries (${seen.size} ids)`);
else ok(`weighted rolls produced ${seen.size} distinct ids in 5000 tries`);

if (process.exitCode) {
  console.error('[shiny-misc-catalog] checks failed');
  process.exit(process.exitCode);
}
console.log('[shiny-misc-catalog] OK');
