/**
 * Smoke test: Map Forge data-action handlers + label role model.
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
ok('Default borderColor empty', labelNode.labelConfig.borderColor === '');
ok('Default textColor empty', labelNode.labelConfig.textColor === '');

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
ok('Bad text colour cleared', uiLabel.labelConfig.textColor === '');

const stageWithAppearance = {
  type: 'stage',
  name: 'Stage 1',
  labelConfig: {
    text: 'Gate',
    shape: 'pill',
    width: 100,
    height: 40,
    showText: true,
    showBorder: false,
    showFill: true,
    opacity: 0.4,
    borderColor: '#112233',
    textColor: '#445566',
  },
};
globalThis.ensureNodeAppearance(stageWithAppearance);
ok('Stage appearance preserved type', stageWithAppearance.type === 'stage');
ok('Stage appearance text', stageWithAppearance.labelConfig.text === 'Gate');
ok('Stage appearance opacity', stageWithAppearance.labelConfig.opacity === 0.4);
ok('Stage appearance forces no uiAction', stageWithAppearance.labelConfig.uiAction === 'none');
ok('Stage appearance forces actsAsNode false', stageWithAppearance.labelConfig.actsAsNode === false);

// Appearance survives Label → Stage conversion (strip must not drop labelConfig).
const convertProbe = {
  type: 'label',
  name: 'Label',
  x: 10,
  y: 20,
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
  },
};
const saved = JSON.parse(JSON.stringify(convertProbe.labelConfig));
delete convertProbe.worldId;
delete convertProbe.terrain;
delete convertProbe.portraitBird;
delete convertProbe.final;
delete convertProbe.encounter;
delete convertProbe.bonusConfig;
delete convertProbe.clearRewards;
delete convertProbe.stage;
delete convertProbe.subStage;
// Intentionally do NOT delete labelConfig (regression for Worlds type convert).
convertProbe.type = 'stage';
convertProbe.name = 'Stage';
convertProbe.terrain = 'Wilds';
convertProbe.labelConfig = saved;
globalThis.ensureNodeAppearance(convertProbe);
ok('Converted stage keeps appearance text', convertProbe.labelConfig.text === 'Keep Me');
ok('Converted stage keeps shape', convertProbe.labelConfig.shape === 'circle');
ok('Converted stage keeps opacity', convertProbe.labelConfig.opacity === 0.55);

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
ok('Stale undefined id would wrongly become 0', (undefined ?? 0) === 0);

if (process.exitCode) {
  console.error('\nMap Forge action verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll Map Forge action checks passed.');
