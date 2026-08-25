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
  const forgeEls = new Map();
  function makeEl(id) {
    if (forgeEls.has(id)) return forgeEls.get(id);
    const children = [];
    const el = {
      id,
      style: {},
      value: '',
      checked: false,
      disabled: false,
      hidden: false,
      textContent: '',
      innerHTML: '',
      width: 160,
      height: 107,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      dataset: {},
      children,
      firstChild: null,
      appendChild(c) { children.push(c); this.firstChild = this.firstChild || c; return c; },
      removeChild() { this.firstChild = null; children.length = 0; },
      setAttribute() {},
      getAttribute() { return null; },
      addEventListener() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, right: 160, bottom: 107, width: 160, height: 107, x: 0, y: 0 };
      },
      getContext() {
        return {
          clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
          moveTo() {}, lineTo() {}, strokeRect() {}, setTransform() {}, scale() {},
          fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '',
          fillText() {}, measureText() { return { width: 0 }; },
        };
      },
      querySelector(sel) {
        if (id === 'map-forge-node-type' && sel === 'option[value="world"]') {
          if (!el._worldOpt) el._worldOpt = { value: 'world', hidden: false };
          return el._worldOpt;
        }
        return null;
      },
      querySelectorAll() { return []; },
      closest() {
        return { style: {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } };
      },
    };
    forgeEls.set(id, el);
    return el;
  }
  // Prefetch node-type select so World-option sync can run in tests.
  makeEl('map-forge-node-type');
  globalThis.document = {
    getElementById: (id) => (id ? makeEl(id) : null),
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
    createTextNode: (t) => ({ textContent: String(t || ''), nodeValue: String(t || '') }),
    createElementNS: () => ({
      style: {},
      setAttribute() {},
      appendChild() {},
    }),
    body: { appendChild() {} },
  };
  const _ls = new Map();
  globalThis.localStorage = {
    getItem: (k) => (_ls.has(k) ? _ls.get(k) : null),
    setItem(k, v) { _ls.set(String(k), String(v)); },
    removeItem(k) { _ls.delete(k); },
  };
  globalThis.Avian = { data: Object.create(null), systems: Object.create(null), actions: Object.create(null) };
  require(path.join(root, 'js/bootstrap/_namespace.js'));
  require(path.join(root, 'js/data/story-map.js'));
  require(path.join(root, 'js/world/overworld_bridge.js'));
  require(path.join(root, 'js/world/ow_map_runtime.js'));
  require(path.join(root, 'js/world/map-pack-schema.js'));
  require(path.join(root, 'js/world/map-forge-library.js'));
  require(path.join(root, 'js/world/map-forge-canvas.js'));
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
const forgeSource = readFileSync(path.join(root, 'js/world/map-forge.js'), 'utf8');
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
ok('World Creator title present', forgeSection.includes('World Creator'));
ok('Library screen present', forgeSection.includes('id="map-forge-library"'));
ok('Forge screen defaults to library mode', html.includes('class="screen is-library" id="screen-map-forge"'));
ok('Library defaults to open', html.includes('id="map-forge-library" class="map-forge-library is-open"'));
ok('Library has loading fallback', html.includes('map-forge-library-fallback'));
const openForgeBody = forgeSource.slice(
  forgeSource.indexOf('async function openMapForge'),
  forgeSource.indexOf('function openMapForgeLibrary')
);
ok('Build Nest shows its library before async initialization',
  openForgeBody.indexOf('showLibrary();') < openForgeBody.indexOf('await initMapForge();'));
ok('refreshMapForgeLibrary exported', forgeSource.includes('global.refreshMapForgeLibrary = refreshLibrary'));
ok('Forge draft hydration has timeout fallback', forgeSource.includes('FORGE_DRAFT_HYDRATE_TIMEOUT_MS'));
ok('World tree present', forgeSection.includes('id="map-forge-world-tree"'));
ok('Place palette includes Stage', forgeSection.includes('data-forge-tool="stage"'));
ok('Place palette includes Spawn', forgeSection.includes('data-forge-tool="start"'));
ok('Place palette includes Map gate', forgeSection.includes('data-forge-tool="world"'));

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

// Summary counts label jobs via effective type.
{
  const summarySlice = {
    mapId: 'main',
    nodes: [
      { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'stage', uiAction: 'none', text: 'A' } },
      { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'boss', uiAction: 'none', text: 'B' } },
      { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'bonus', uiAction: 'none', text: 'C' }, bonusConfig: { powerProgression: true, maxRepeats: 3 } },
      { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'shop', uiAction: 'none', text: 'Shop' } },
      { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'world', uiAction: 'none', text: 'W' }, worldId: 'world9' },
      { type: 'label', labelConfig: { actsAsNode: false, mimicType: 'stage', uiAction: 'none', text: 'Decor' } },
    ],
  };
  const sum = globalThis.summarizeMapSlice(summarySlice);
  ok('Summary counts stage+boss jobs as combat', sum.combat === 2);
  ok('Summary counts bonus jobs', sum.bonus === 1);
  ok('Summary counts shop jobs', sum.shop === 1);
  ok('Summary counts world jobs', sum.worlds === 1);
}

// Filter / bulk / world template / boss-bonus job helpers via Forge API.
if (api) {
  api.loadMap({
    schemaVersion: 2,
    name: 'Unify jobs',
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
        nodes: [],
      },
    },
  });
  api.setEditContext('world1');
  api.addWorldTemplate();
  const templated = api.getState();
  ok('World template creates 6 nodes', templated.nodeCount === 6);
  ok('World template nodes are labels', templated.nodes.every((n) => n.type === 'label'));
  ok('World template includes Spawn job', templated.nodes.some((n) => n.job === 'start'));
  ok('World template includes Stage jobs', templated.nodes.filter((n) => n.job === 'stage').length === 3);
  ok('World template includes Boss job', templated.nodes.some((n) => n.job === 'boss'));
  ok('World template includes Return job', templated.nodes.some((n) => n.job === 'return'));
  ok('World jobs disallowed inside world', templated.worldJobsAllowed === false);
  ok('World option hidden inside world', templated.worldOptionHidden === true);

  const stageJob = templated.nodes.find((n) => n.job === 'stage');
  const bossJob = templated.nodes.find((n) => n.job === 'boss');
  const spawnJob = templated.nodes.find((n) => n.job === 'start');
  ok('Filter stage matches stage job', api.filterMatches(
    { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'stage', uiAction: 'none' } },
    'stage',
  ));
  ok('Filter label skips stage job', !api.filterMatches(
    { type: 'label', labelConfig: { actsAsNode: true, mimicType: 'stage', uiAction: 'none' } },
    'label',
  ));
  ok('Filter label matches decorative', api.filterMatches(
    { type: 'label', labelConfig: { actsAsNode: false, mimicType: 'stage', uiAction: 'none' } },
    'label',
  ));
  ok('Boss job is boss-like', !!bossJob?.isBossLike);
  ok('Stage job is combat', !!stageJob?.isCombat);
  ok('Spawn job is not combat', !spawnJob?.isCombat);

  api.bulkSelectAllStages();
  const bulk = api.getState();
  ok('Bulk select checks combat label jobs', bulk.bulkChecked.length === 4);
  ok('Bulk select includes boss job', bulk.bulkChecked.includes(bossJob.id));
  ok('Bulk select excludes spawn', !bulk.bulkChecked.includes(spawnJob.id));

  // Bonus job gets bonusConfig from upgrade/normalize.
  api.setEditContext('main');
  api.placeNodeAt(500, 500);
  ok('Convert to bonus job', api.convertSelected('bonus') === true);
  const bonusNode = api.getSelected();
  ok('Bonus job has bonusConfig', !!(bonusNode?.bonusConfig));
  ok('Bonus job is bonus-like in state', api.getState().nodes.some((n) => n.id === bonusNode.id && n.isBonusLike));
}

// Soft guidelines: incomplete maps still save; validation is advisory.
ok('Shop forge tab present', forgeSection.includes('data-forge-panel-tab="shop"'));
ok('On path checkbox present', forgeSection.includes('id="map-forge-node-on-path"'));
ok('Must complete checkbox present', forgeSection.includes('id="map-forge-node-must-complete"'));
ok('Path order field present', forgeSection.includes('id="map-forge-node-path-order"'));

{
  const incomplete = {
    schemaVersion: 2,
    id: 'soft-save-map',
    name: 'Soft Save',
    nodes: [],
    worlds: {},
    backgroundDataUrl: '',
  };
  api.loadMap(incomplete);
  const hard = api.validateMap(incomplete);
  ok('validateMap only blocks corrupt payloads', hard == null);
  const issues = globalThis.collectMapValidationIssues(incomplete);
  ok('Guidelines report warnings for empty map', issues.some((i) => /node/i.test(i.message)));
  ok('Playtest errors include missing spawn or combat', issues.some((i) => i.severity === 'error'));
  const blocked = api.playtestBlockedReason(incomplete);
  ok('Playtest is blocked on errors', typeof blocked === 'string' && blocked.length > 0);
  const drafts = api.saveDraft();
  ok('Soft save writes draft without spawn/background', Array.isArray(drafts) && drafts.some((d) => d.id === 'soft-save-map' || d.name === 'Soft Save'));
}

// pathOrder ties produce split edges.
{
  const branchNodes = [
    { id: 0, type: 'label', name: 'Spawn', x: 100, y: 500, pathOrder: 0, onPath: true,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'start', uiAction: 'none', text: 'Spawn' }) },
    { id: 1, type: 'label', name: 'Left', x: 40, y: 300, pathOrder: 1, onPath: true,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'stage', uiAction: 'none', text: 'Left' }), terrain: 'Wilds' },
    { id: 2, type: 'label', name: 'Right', x: 160, y: 300, pathOrder: 1, onPath: true,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'stage', uiAction: 'none', text: 'Right' }), terrain: 'Wilds' },
    { id: 3, type: 'label', name: 'Boss', x: 100, y: 100, pathOrder: 2, onPath: true, mustComplete: true,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'boss', uiAction: 'none', text: 'Boss' }), terrain: 'Boss Arena' },
    { id: 4, type: 'label', name: 'Return', x: 100, y: 20, pathOrder: 3, onPath: true,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'return', uiAction: 'none', text: 'Return' }) },
    { id: 5, type: 'label', name: 'Side', x: 300, y: 300, pathOrder: 1, onPath: false,
      labelConfig: Object.assign(globalThis.defaultLabelConfig(), { actsAsNode: true, mimicType: 'shop', uiAction: 'none', text: 'Side' }) },
  ];
  globalThis.ensureOwPathOrders(branchNodes);
  const edges = globalThis.buildOwPathEdges(branchNodes);
  ok('Branch map builds edges', edges.length >= 3);
  ok('Spawn fans out to both order-1 stages', edges.filter((e) => e.from === 0).length >= 2);
  ok('Off-path shop excluded from path nodes', !globalThis.isOwPathNode(branchNodes[5]));
  ok('Return hidden until must-complete cleared', globalThis.isOwReturnGateVisible(branchNodes, 'main', { nodeClears: {} }) === false);
  const cleared = { nodeClears: { 'main:3': true } };
  ok('Return visible after must-complete clear', globalThis.isOwReturnGateVisible(branchNodes, 'main', cleared) === true);
}

// shopConfig serializes on export.
if (api) {
  api.loadMap({
    schemaVersion: 2,
    id: 'shop-cfg-map',
    name: 'Shop Cfg',
    backgroundDataUrl: 'data:image/png;base64,aa',
    nodes: [],
    worlds: {},
  });
  api.setEditContext('main');
  api.placeNodeAt(200, 200);
  ok('Convert to shop job', api.convertSelected('shop') === true);
  const shopSel = api.getSelected();
  shopSel.shopConfig = {
    useCustomStock: true,
    offers: [{ id: 'shop_item_fresh_water', qty: 2, kind: 'item' }],
  };
  shopSel.mustComplete = true;
  shopSel.pathOrder = 2;
  shopSel.onPath = true;
  const payload = api.buildExport();
  const exported = (payload.nodes || []).find((n) => n.id === shopSel.id);
  ok('Exported shopConfig useCustomStock', !!(exported?.shopConfig?.useCustomStock));
  ok('Exported shopConfig offers', Array.isArray(exported?.shopConfig?.offers) && exported.shopConfig.offers.length === 1);
  ok('Exported mustComplete', exported?.mustComplete === true);
  ok('Exported pathOrder', exported?.pathOrder === 2);
}

// Schema v3 + templates + portable pack.
{
  ok('upgradeMapToV3 is published', typeof globalThis.upgradeMapToV3 === 'function');
  const v2 = {
    schemaVersion: 2,
    name: 'Legacy',
    nodes: [{ id: 0, type: 'start', name: 'Spawn', x: 10, y: 10 }],
    worlds: {},
  };
  const v3 = globalThis.upgradeMapToV3(v2);
  ok('upgradeMapToV3 sets schemaVersion 3', v3.schemaVersion === 3);
  ok('upgradeMapToV3 stamps spawn kind', globalThis.getOwLocationKind(v3.nodes[0]) === 'start');
  const linear = globalThis.createWorldPackTemplate('linear5');
  ok('linear5 template has spawn', (linear.nodes || []).some((n) => globalThis.isOwSpawnNode(n)));
  ok('linear5 template has combat', (linear.nodes || []).some((n) => globalThis.isForgeCombatNode(n)));
  const hub = globalThis.createWorldPackTemplate('hub2');
  ok('hub2 template has two nested maps', Object.keys(hub.worlds || {}).length === 2);
  const pack = api.buildPortablePack();
  ok('Portable pack is schema 3', pack.schemaVersion === 3);
  const withBg = {
    schemaVersion: 3,
    name: 'Art',
    backgroundDataUrl: 'data:image/png;base64,aaa',
    nodes: [{ type: 'start', name: 'Spawn', x: 1, y: 1 }],
    worlds: { world1: { name: 'W', nodes: [], backgroundDataUrl: 'data:image/png;base64,bbb' } },
  };
  const extracted = globalThis.extractWorldPackAssets(withBg);
  ok('extractWorldPackAssets moves data URLs into assets', extracted.backgroundDataUrl.slice(0, 6) === 'asset:' && extracted.assets);
  const round = globalThis.parseWorldPackJson(JSON.stringify(extracted));
  ok('parseWorldPackJson restores data URLs', String(round.backgroundDataUrl).slice(0, 5) === 'data:');
  const emptyPack = globalThis.createEmptyWorldPack();
  const emptyIssues = globalThis.collectMapValidationIssues(emptyPack);
  ok('Empty pack has playtest errors', emptyIssues.some((i) => i.severity === 'error'));
  const hubErrors = globalThis.collectMapPlaytestErrors(hub);
  ok('Hub template still errors without background', hubErrors.some((i) => /background/i.test(i.message)));
}

if (api) {
  api.loadMap(globalThis.createWorldPackTemplate('hub2'));
  const beforeMaps = Object.keys(api.buildExport().worlds || {}).length;
  api.addNestedMapFromTree();
  const afterAdd = Object.keys(api.buildExport().worlds || {}).length;
  ok('World tree can add a nested map', afterAdd === beforeMaps + 1);
  const extraId = Object.keys(api.buildExport().worlds).find((id) => id !== 'world1' && id !== 'world2');
  api.duplicateNestedMap('world1');
  ok('World tree can duplicate a nested map', Object.keys(api.buildExport().worlds || {}).length === afterAdd + 1);
  if (extraId) {
    api.deleteNestedMap(extraId);
    ok('World tree can delete a nested map', !api.buildExport().worlds[extraId]);
  }
}

if (api) {
  api.loadMap({ schemaVersion: 3, name: 'Place kind', nodes: [], worlds: {} });
  api.setEditContext('main');
  api.setTool('stage');
  api.placeNodeAt(200, 200);
  // placeNodeAt forces label tool for regression coverage; place a stage via convert still works.
  ok('Place API still drops a label first', api.getSelected()?.type === 'label');
  api.convertSelected('stage');
  ok('Placed stage has kind stage', api.getSelected()?.kind === 'stage' || api.getSelected()?.labelConfig?.mimicType === 'stage');
  api.placeNodeAs('boss', 300, 300);
  ok('placeNodeAs boss stamps boss kind', api.getSelected()?.kind === 'boss' || api.getSelected()?.labelConfig?.mimicType === 'boss');
  api.placeNodeAs('shop', 400, 400);
  ok('placeNodeAs shop stamps shop kind', api.getSelected()?.kind === 'shop' || api.getSelected()?.labelConfig?.mimicType === 'shop');
}

{
  const gameSrc = readFileSync(path.join(root, 'js/core/game.js'), 'utf8');
  ok('Overworld battle honors custom multi-enemy encounters', /isCustomOverworldActive/.test(gameSrc) && !/normalizeOwEnemyListForBattle\(rolled, stageNum\)\.slice\(0,1\)/.test(gameSrc));
  ok('Custom overworld keeps authored enemy count', /customOw/.test(gameSrc) && /_owEnemyCount=Math.max\(1,G\._owStageEnemies/.test(gameSrc));
  const importSrc = readFileSync(path.join(root, 'scripts/import-story-map.mjs'), 'utf8');
  ok('Story import CLI keeps nested maps', importSrc.includes('Nested maps (worlds) are preserved') && /worlds,/.test(importSrc));
}

// Bundle must include the fresh-select fix — index.html loads avian-game.bundle.js.
const bundle = readFileSync(path.join(root, 'js/avian-game.bundle.js'), 'utf8');
ok('Bundle calls selectFreshLastNode after place', /selectFreshLastNode\(\)/.test(bundle));
ok('Bundle place status mentions job', bundle.includes('set Node type (job)'));
ok('Bundle exports __mapForgeTestApi', bundle.includes('__mapForgeTestApi'));
ok('Bundle has isBossLike helper', bundle.includes('function isBossLike'));
ok('Bundle does not use stale slice id fallback after place',
  !/slice\.nodes\[slice\.nodes\.length - 1\]\?\.id \?\? 0/.test(bundle));
ok('Bundle has buildOwPathEdges', bundle.includes('buildOwPathEdges'));
ok('Bundle has areOwMustCompleteNodesCleared', bundle.includes('areOwMustCompleteNodesCleared'));
ok('Bundle includes world-pack schema v3', bundle.includes('upgradeMapToV3'));
ok('Bundle includes World Creator library', bundle.includes('renderMapForgeLibrary'));

if (process.exitCode) {
  console.error('\nMap Forge action verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll Map Forge action checks passed.');
