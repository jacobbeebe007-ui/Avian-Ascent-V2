#!/usr/bin/env node
/*
 * Phase 9 — equipment UI surface checks (static + minimal runtime).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let failed = 0;

function fail(msg) {
  console.error('[equipment-ui] FAIL', msg);
  failed++;
}
function ok(msg) {
  console.log('[equipment-ui] ok  ', msg);
}

const gamePath = path.join(ROOT, 'js/core/game.js');
const gameSrc = readFileSync(gamePath, 'utf8');

const staticChecks = [
  ['buildEquipmentTooltipHTML', /function buildEquipmentTooltipHTML\b/],
  ['buildNestEquipmentSectionV2', /function buildNestEquipmentSectionV2\b/],
  ['nest equipment two-column layout', /nest-eq-layout/],
  ['nest worn doll', /nest-eq-doll/],
  ['grantPlayerEquipmentItem', /function grantPlayerEquipmentItem\b/],
  ['grantEquipment newest-bag copy', /Bag · newest first/],
  ['nest mobile hint', /nest-eq-hint--narrow/],
  ['equipment v2 action grid class', /actions-grid--equipment-v2/],
  ['wireNestEquipmentTooltips', /function wireNestEquipmentTooltips\b/],
  ['setUltimateSource action', /Avian\.actions\.register\('setUltimateSource'/],
  ['event-router 1-6 comment', /When `equipmentV2` is on, `1`-`6`/],
  ['formatEquipmentStatsHtml weapon damage', /function formatEquipmentStatsHtml[\s\S]*?minDamage[\s\S]*?maxDamage/],
  ['enemy nest equipment stats', /function buildEnemyInfoPopupMutationsHtml[\s\S]*?formatEquipmentCompactStatsHtml/],
  ['enemy equipment effect summary', /function formatEquipmentEffectSummaryHtml\b/],
  ['wire enemy equipment tooltips', /function wireEnemyInfoEquipmentTooltips\b/],
  ['enemy preview starter kit', /function ensureEnemyPreviewEquipmentState\b/],
  ['enemy preview ensureStartingWeapon', /ensureEnemyPreviewEquipmentState[\s\S]*?ensureStartingWeapon/],
];

for (const [label, re] of staticChecks) {
  const src = label.includes('event-router')
    ? readFileSync(path.join(ROOT, 'js/ui/event-router.js'), 'utf8')
    : gameSrc;
  if (re.test(src)) ok(label);
  else fail('missing ' + label);
}

function loadSandbox() {
  const ctx = vm.createContext({
    globalThis: {},
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    JSON,
    BIRDS: { sparrow: { name: 'Sparrow', class: 'rogue', birdKey: 'sparrow' } },
  });
  ctx.globalThis = ctx;
  const files = [
    'js/bootstrap/_namespace.js',
    'js/data/combat-config.js',
    'js/data/effect-tiers.js',
    'js/data/equipment/slots.js',
    'js/data/equipment/skills.js',
    'js/data/equipment/items.js',
    'js/systems/equipment.js',
    'js/systems/equipment-actions.js',
    'js/systems/equipment-loot.js',
  ];
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) {
      fail('missing runtime file ' + rel);
      return null;
    }
    vm.runInContext(readFileSync(full, 'utf8'), ctx, { filename: rel });
  }
  ctx.Avian = ctx.globalThis.Avian;
  ctx.Avian.flags = { equipmentV2: true };
  return ctx;
}

const ctx = loadSandbox();
if (ctx) {
  const order = ctx.Avian.equipmentActions.getSourceOrder();
  if (Array.isArray(order) && order.length === 6) ok('six action source order');
  else fail(`expected 6 source keys, got ${order?.length ?? 'null'}`);

  const labels = order.map((k) => ctx.Avian.equipmentActions.getActionSourceLabel(k));
  if (labels.every(Boolean)) ok('action source labels defined');
  else fail('missing action source labels: ' + labels.join(', '));

  if (typeof ctx.Avian.equipmentActions.collectUltimateCandidates === 'function') {
    ok('collectUltimateCandidates exported');
  } else {
    fail('collectUltimateCandidates not exported');
  }

  if (typeof ctx.Avian.equipment.grantEquipment === 'function' && typeof ctx.Avian.equipment.findEmptyEquipSlotForItem === 'function') {
    ok('grantEquipment and findEmptyEquipSlotForItem exported');
  } else {
    fail('grantEquipment / findEmptyEquipSlotForItem missing');
  }

  const sampleWpn = ctx.Avian.data?.equipment?.items?.['WPN-007'];
  const sampleArmour = ctx.Avian.data?.equipment?.items?.['ARM-001'];
  const descFn = ctx.Avian.equipmentLoot?.formatEquipmentDesc;
  if (sampleWpn && typeof descFn === 'function') {
    const desc = descFn(sampleWpn);
    if (/Damage\s+3–4/.test(desc) || /Damage\s+3-4/.test(desc)) {
      ok('loot desc shows weapon damage range');
    } else {
      fail('loot desc missing weapon damage range: ' + desc);
    }
  } else {
    fail('could not format sample weapon desc');
  }
  if (sampleArmour && typeof descFn === 'function') {
    const armourDesc = descFn(sampleArmour);
    if (/Damage\s+0/.test(armourDesc) || /Damage\s+\d/.test(armourDesc)) {
      fail('non-weapon loot desc should omit damage: ' + armourDesc);
    } else {
      ok('non-weapon loot desc omits damage');
    }
  }
}

if (failed) {
  process.exitCode = 1;
  console.error(`[equipment-ui] ${failed} check(s) failed`);
} else {
  console.log('[equipment-ui] all checks passed');
}
