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

// Documents the stale-slice bug: normalize replaces the nodes array, so the pre-normalize
// reference's last node has no id and `?? 0` incorrectly selects Spawn.
{
  let live = globalThis.normalizeOwMapNodes([
    { type: 'start', name: 'Spawn', x: 100, y: 100 },
    { type: 'stage', name: 'Stage 1', x: 100, y: 200, terrain: 'Wilds' },
  ]);
  const staleRef = live;
  staleRef.push({
    x: 300, y: 300, type: 'label', name: 'Label',
    labelConfig: globalThis.defaultLabelConfig(),
  });
  live = globalThis.normalizeOwMapNodes(staleRef);
  const buggyId = staleRef[staleRef.length - 1]?.id ?? 0;
  const freshId = live[live.length - 1]?.id;
  ok('Stale slice after normalize falls back to Spawn id 0', buggyId === 0);
  ok('Fresh slice after normalize selects new label id', freshId === 2 && live[2].type === 'label');
}

// Live Forge API: place → job change → delete inside a World (not main).
const api = globalThis.__mapForgeTestApi;
ok('Map Forge test API exported', !!(api && typeof api.placeNodeAt === 'function'));
if (api) {
  api.loadMap({
    schemaVersion: 2,
    name: 'Worlds regression',
    nodes: [{
      x: 200, y: 200, type: 'label', name: 'World Gate', worldId: 'world1',
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), {
        text: 'World Gate', actsAsNode: true, mimicType: 'world', uiAction: 'none',
      }),
    }],
    worlds: {
      world1: {
        name: 'World 1',
        worldIndex: 1,
        backgroundDataUrl: '',
        nodes: [
          { x: 100, y: 100, type: 'start', name: 'Spawn' },
          { x: 100, y: 220, type: 'stage', name: 'Stage 1', terrain: 'Wilds' },
        ],
      },
    },
  });
  api.setEditContext('world1');
  const before = api.getState();
  ok('Edit context is world1', before.editContext === 'world1');
  ok('World starts with 2 nodes', before.nodeCount === 2);

  api.placeNodeAt(400, 400);
  const afterPlace = api.getState();
  const placed = api.getSelected();
  ok('After place, tool is select', afterPlace.tool === 'select');
  ok('After place, selected id is not Spawn', afterPlace.selectedId === 2);
  ok('After place, selected node is the new label', !!(placed && placed.type === 'label' && placed.name === 'Label'));
  ok('After place, world has 3 nodes', afterPlace.nodeCount === 3);

  ok('Convert placed label to Stage job', api.convertSelected('stage') === true);
  const afterJob = api.getState();
  const staged = api.getSelected();
  ok('Stage job keeps type label', staged?.type === 'label');
  ok('Stage job actsAsNode', staged?.labelConfig?.actsAsNode === true);
  ok('Stage job mimicType stage', staged?.labelConfig?.mimicType === 'stage');
  ok('Stage job appears in path list', afterJob.nodes.some((n) => n.id === 2 && n.job === 'stage' && n.actsAsNode));
  ok('Selected remains the placed node after job change', afterJob.selectedId === 2);

  // pushHistory must not detach the live world nodes array (Worlds-only regression).
  const liveWorldNodes = api.getState().nodes.map((n) => n.id);
  ok('World node ids stable before delete', liveWorldNodes.join(',') === '0,1,2');

  const countBeforeDelete = afterJob.nodeCount;
  api.deleteSelected();
  const afterDelete = api.getState();
  ok('Delete removed the placed node', afterDelete.nodeCount === countBeforeDelete - 1);
  ok('Delete cleared selection', afterDelete.selectedId == null);
  ok('Spawn still present after deleting placed node', afterDelete.nodes.some((n) => n.job === 'start' || n.type === 'start'));
  ok('Deleted label id is gone', !afterDelete.nodes.some((n) => n.id === 2 && n.name === 'Stage'));
}

// Bundle must include the fresh-select fix — index.html loads avian-game.bundle.js.
const bundle = readFileSync(path.join(root, 'js/avian-game.bundle.js'), 'utf8');
ok('Bundle calls selectFreshLastNode after place', /selectFreshLastNode\(\)/.test(bundle));
ok('Bundle place status mentions job', bundle.includes('set Node type (job)'));
ok('Bundle exports __mapForgeTestApi', bundle.includes('__mapForgeTestApi'));
ok('Bundle does not use stale slice id fallback after place',
  !/slice\.nodes\[slice\.nodes\.length - 1\]\?\.id \?\? 0/.test(bundle));

if (process.exitCode) {
  console.error('\nMap Forge action verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll Map Forge action checks passed.');
