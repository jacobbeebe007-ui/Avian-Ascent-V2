/**
 * Smoke test: Map Forge data-action handlers + label-as-job model.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function ok(label, cond) {
  if (!cond) {
    console.error('[FAIL]', label);
    process.exitCode = 1;
    return false;
  }
  console.log('[ok]  ', label);
  return true;
}

function loadShell() {
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      setAttribute() {},
      addEventListener() {},
      dataset: {},
    }),
    createElementNS: () => ({
      style: {},
      setAttribute() {},
      appendChild() {},
    }),
    body: { appendChild() {} },
  };
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  };
  globalThis.Avian = { data: Object.create(null), systems: Object.create(null), actions: Object.create(null) };
  require(path.join(root, 'js/bootstrap/_namespace.js'));
  require(path.join(root, 'js/data/story-map.js'));
  require(path.join(root, 'js/world/overworld_bridge.js'));
  require(path.join(root, 'js/world/ow_map_runtime.js'));
  require(path.join(root, 'js/world/map-forge.js'));
}

loadShell();

function resolveAction(name) {
  if (!name) return null;
  const fromAvian = globalThis.Avian?.actions?.[name];
  if (typeof fromAvian === 'function') return fromAvian;
  const fromGlobal = globalThis[name];
  if (typeof fromGlobal === 'function') return fromGlobal;
  return null;
}

/** Apply the forge label-job model without UI (mirrors convertSelectedNodeType). */
function assignLabelJob(node, typeKey) {
  const saved = node.labelConfig ? JSON.parse(JSON.stringify(node.labelConfig)) : null;
  const cfg = globalThis.defaultLabelConfig();
  if (saved) Object.assign(cfg, saved);
  node.type = 'label';
  if (typeKey === 'label') {
    cfg.actsAsNode = false;
    cfg.uiAction = 'none';
  } else if (typeKey === 'labelUi') {
    cfg.actsAsNode = false;
    cfg.uiAction = 'nest';
  } else {
    cfg.actsAsNode = true;
    cfg.uiAction = 'none';
    cfg.mimicType = typeKey;
    if (typeKey === 'stage' || typeKey === 'boss' || typeKey === 'bonus') {
      node.terrain = node.terrain || (typeKey === 'boss' ? 'Boss Arena' : typeKey === 'bonus' ? 'Bonus Arena' : 'Wilds');
    }
    if (typeKey === 'start') node.stage = 0;
  }
  node.labelConfig = cfg;
  globalThis.ensureLabelConfig(node);
  if (typeKey !== 'label' && typeKey !== 'labelUi') {
    node.labelConfig.actsAsNode = true;
    node.labelConfig.uiAction = 'none';
    node.labelConfig.mimicType = typeKey;
  }
  return node;
}

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const forgeStart = html.indexOf('id="screen-map-forge"');
const forgeEnd = html.indexOf('<!-- BATTLE -->', forgeStart);
const forgeSection = forgeStart >= 0 ? html.slice(forgeStart, forgeEnd) : '';
const actionRe = /data-action="([^":]+)/g;
const forgeActions = new Set();
let m;
while ((m = actionRe.exec(forgeSection)) !== null) {
  forgeActions.add(m[1]);
}

ok('Found Map Forge screen section', forgeStart >= 0);
ok('Map Forge has data-action buttons', forgeActions.size >= 20);
ok('Opacity slider present', forgeSection.includes('id="map-forge-label-opacity"'));
ok('Border colour picker present', forgeSection.includes('id="map-forge-label-border-color"'));
ok('Text colour picker present', forgeSection.includes('id="map-forge-label-text-color"'));
ok('Node type job hint present', forgeSection.includes('id="map-forge-node-type-hint"'));
ok('Node type labeled as job', forgeSection.includes('Node type (job)'));

forgeActions.forEach((name) => {
  ok('Resolves action: ' + name, typeof resolveAction(name) === 'function');
});

const labelNode = {
  type: 'label',
  labelConfig: {
    text: 'Shop',
    mimicType: 'shop',
    shape: 'rounded',
    width: 120,
    height: 40,
    showText: true,
    showBorder: true,
    showFill: true,
    actsAsNode: true,
    uiAction: 'none',
  },
};
globalThis.ensureLabelConfig(labelNode);
ok('Node proxy label actsAsNode', labelNode.labelConfig.actsAsNode === true);
ok('Node proxy mimicType', labelNode.labelConfig.mimicType === 'shop');
ok('Default opacity applied', labelNode.labelConfig.opacity === 0.72);

const uiLabel = {
  type: 'label',
  labelConfig: {
    text: 'Nest',
    mimicType: 'stage',
    shape: 'pill',
    width: 80,
    height: 36,
    showText: true,
    showBorder: true,
    showFill: true,
    actsAsNode: false,
    uiAction: 'nest',
    opacity: 1.5,
    borderColor: '#AaBbCc',
    textColor: 'bad',
  },
};
globalThis.ensureLabelConfig(uiLabel);
ok('UI button label clears actsAsNode', uiLabel.labelConfig.actsAsNode === false);
ok('UI button uiAction nest', globalThis.getOwMapUiAction(uiLabel.labelConfig) === 'nest');
ok('Opacity clamped to 1', uiLabel.labelConfig.opacity === 1);
ok('Border colour normalized', uiLabel.labelConfig.borderColor === '#aabbcc');

// Label job: Stage keeps type=label and preserves appearance.
const jobStage = {
  type: 'label',
  name: 'Label',
  labelConfig: {
    text: 'Keep Me',
    shape: 'circle',
    width: 64,
    height: 64,
    showText: true,
    showBorder: true,
    showFill: true,
    opacity: 0.55,
    borderColor: '#ff0000',
    textColor: '#00ff00',
    uiAction: 'none',
    actsAsNode: false,
    mimicType: 'stage',
  },
};
assignLabelJob(jobStage, 'stage');
ok('Stage job keeps type label', jobStage.type === 'label');
ok('Stage job actsAsNode', jobStage.labelConfig.actsAsNode === true);
ok('Stage job mimicType stage', jobStage.labelConfig.mimicType === 'stage');
ok('Stage job keeps shape', jobStage.labelConfig.shape === 'circle');
ok('Stage job keeps opacity', jobStage.labelConfig.opacity === 0.55);
ok('Stage job is combat', globalThis.isForgeCombatNode(jobStage) === true);
ok('Stage job effective type', globalThis.getOwEffectiveNodeType(jobStage) === 'stage');

const jobSpawn = {
  type: 'label',
  name: 'Label',
  labelConfig: globalThis.defaultLabelConfig(),
};
jobSpawn.labelConfig.text = 'Spawn Gate';
jobSpawn.labelConfig.shape = 'pill';
assignLabelJob(jobSpawn, 'start');
ok('Spawn job keeps type label', jobSpawn.type === 'label');
ok('Spawn job recognized', globalThis.isOwSpawnNode(jobSpawn) === true);
ok('Spawn job effective type start', globalThis.getOwEffectiveNodeType(jobSpawn) === 'start');
ok('Spawn find index', globalThis.findOwSpawnNodeIndex([
  { type: 'label', labelConfig: { actsAsNode: false, uiAction: 'none', mimicType: 'stage' } },
  jobSpawn,
]) === 1);

// Spawn uniqueness vs hard start + proxy spawn
const mixed = [
  { id: 0, type: 'start', name: 'Spawn' },
  { id: 1, type: 'label', labelConfig: { actsAsNode: true, mimicType: 'start', uiAction: 'none', text: 'Also Spawn' } },
];
ok('Hard start is spawn', globalThis.isOwSpawnNode(mixed[0]));
ok('Proxy start is spawn', globalThis.isOwSpawnNode(mixed[1]));
ok('Two spawns counted', mixed.filter((n) => globalThis.isOwSpawnNode(n)).length === 2);

// World sub-stage recompute for label combat jobs
const worldDef = {
  worldIndex: 1,
  nodes: [
    { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'start', uiAction: 'none', text: 'Spawn' }, stage: 0 },
    { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'stage', uiAction: 'none', text: 'A' }, terrain: 'Wilds' },
    { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'boss', uiAction: 'none', text: 'B' }, terrain: 'Boss Arena' },
    { type: 'label', labelConfig: { actsAsNode: false, uiAction: 'none', mimicType: 'stage', text: 'Decor' } },
  ],
};
const subCount = globalThis.recomputeWorldSubStages(worldDef);
ok('World sub-stages count combat label jobs', subCount === 2);
ok('First combat label gets subStage 1', worldDef.nodes[1].subStage === 1);
ok('Boss label gets subStage 2', worldDef.nodes[2].subStage === 2);
ok('Decorative label has no subStage', worldDef.nodes[3].subStage == null);

// Place-then-select in a World with existing Spawn must select the new node (not id 0).
const worldNodes = [
  { type: 'start', name: 'Spawn', x: 100, y: 100 },
  { type: 'stage', name: 'Stage 1', x: 100, y: 200, terrain: 'Wilds' },
];
worldNodes.push({
  x: 300,
  y: 300,
  type: 'label',
  name: 'Label',
  labelConfig: globalThis.defaultLabelConfig(),
});
const normalized = globalThis.normalizeOwMapNodes(worldNodes);
ok('Normalize assigns sequential ids', normalized[0].id === 0 && normalized[2].id === 2);
ok('Fresh last node after place is not Spawn', normalized[normalized.length - 1].type === 'label');
ok('Fresh last node id is 2', normalized[normalized.length - 1].id === 2);

if (process.exitCode) {
  console.error('\nMap Forge action verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll Map Forge action checks passed.');
