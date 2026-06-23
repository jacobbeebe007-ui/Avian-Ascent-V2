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
  },
};
globalThis.ensureLabelConfig(uiLabel);
ok('UI button label clears actsAsNode', uiLabel.labelConfig.actsAsNode === false);
ok('UI button uiAction nest', globalThis.getOwMapUiAction(uiLabel.labelConfig) === 'nest');

if (process.exitCode) {
  console.error('\nMap Forge action verification failed.');
  process.exit(process.exitCode);
}
console.log('\nAll Map Forge action checks passed.');
