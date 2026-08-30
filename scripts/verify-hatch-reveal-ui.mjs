#!/usr/bin/env node
/**
 * Static checks for Hatchery egg cards and New / Duplicate reveal styling.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function fail(msg) {
  console.error('[hatch-reveal-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[hatch-reveal-ui] ok  ', msg);
}

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'css/main.css'), 'utf8');
const shop = readFileSync(path.join(ROOT, 'js/meta/fortune-shop.js'), 'utf8');
const nests = readFileSync(path.join(ROOT, 'js/meta/rescued-nests.js'), 'utf8');
const inventory = readFileSync(path.join(ROOT, 'js/meta/fortune-inventory.js'), 'utf8');

const htmlChecks = [
  ['hatchery new/dupe legend', /class="hatchery-reveal-legend"/],
  ['hatch subtitle element', /id="mother-goose-hatch-subtitle"/],
  ['hatch modal title', /id="mother-goose-hatch-title"/],
];

const cssChecks = [
  ['new bird hatch card fill', /\.mother-goose-hatch-card--new\{/],
  ['duplicate hatch card fill', /\.mother-goose-hatch-card--dupe\{/],
  ['hatch card gold fill', /\.mother-goose-hatch-card\.tier-gold\{/],
  ['hatch ribbon new', /\.mother-goose-hatch-ribbon--new\{/],
  ['hatch ribbon dupe', /\.mother-goose-hatch-ribbon--dupe\{/],
  ['hatch card pop animation', /@keyframes mother-goose-hatch-card-pop\{/],
  ['hatch shine animation', /@keyframes mother-goose-hatch-shine\{/],
  ['coloured cracked egg card', /\.mother-goose-egg-card--cracked\{/],
  ['coloured ancestral egg card', /\.mother-goose-egg-card--ancestral\{/],
  ['coloured nest inventory card', /\.inventory-item-card--nest-royal\{/],
  ['reduced-motion hatch', /prefers-reduced-motion:reduce[\s\S]*mother-goose-hatch-flip\{transition:none;\}/],
];

const shopChecks = [
  ['species-coloured new ribbon', /mother-goose-hatch-ribbon--new">New</],
  ['species-coloured dupe ribbon', /mother-goose-hatch-ribbon--dupe">Duplicate</],
  ['egg rarity chip on hatch menu', /mother-goose-egg-rarity/],
  ['batch accepts nest opts', /function showMotherGooseHatchModalBatch\(results, eggType, count, opts\)/],
  ['nest panel class', /mother-goose-hatch-panel--nest/],
];

const nestChecks = [
  ['nest open passes source nest', /source:\s*'nest'/],
  ['nest open passes golden eggs', /goldenEggsGained:\s*result\.goldenEggsGained/],
];

const inventoryChecks = [
  ['inventory nest colour class', /inventory-item-card--nest-/],
];

for (const [label, re] of htmlChecks) {
  if (re.test(html)) ok(label);
  else fail('html: ' + label);
}
for (const [label, re] of cssChecks) {
  if (re.test(css)) ok(label);
  else fail('css: ' + label);
}
for (const [label, re] of shopChecks) {
  if (re.test(shop)) ok(label);
  else fail('fortune-shop: ' + label);
}
for (const [label, re] of nestChecks) {
  if (re.test(nests)) ok(label);
  else fail('rescued-nests: ' + label);
}
for (const [label, re] of inventoryChecks) {
  if (re.test(inventory)) ok(label);
  else fail('fortune-inventory: ' + label);
}

if (failed > 0) {
  console.error(`[hatch-reveal-ui] ${failed} check(s) failed`);
  process.exit(1);
}
console.log('[hatch-reveal-ui] OK');
