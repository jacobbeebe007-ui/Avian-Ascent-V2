/**
 * World-pack schema v3 — unified location kinds, upgrade from v2, validation tiers,
 * pack serialize/import, and starter templates for World Creator (Build Nest).
 */
(function (global) {
  'use strict';

  const DEFAULT_MAP_W = 1536;
  const DEFAULT_MAP_H = 1024;

  global.OW_LOCATION_KINDS = [
    'label', 'labelUi', 'stage', 'boss', 'bonus', 'shop', 'world', 'return', 'start', 'overworld',
  ];

  global.OW_LOCATION_KIND_LABELS = {
    label: 'Decor',
    labelUi: 'UI button',
    stage: 'Stage',
    boss: 'Boss',
    bonus: 'Bonus',
    shop: 'Shop',
    world: 'Map gate',
    return: 'Return',
    start: 'Spawn',
    overworld: 'Overworld gate',
  };

  global.OW_GAMEPLAY_KINDS = {
    stage: true, boss: true, bonus: true, shop: true, world: true, return: true, start: true, overworld: true,
  };

  global.OW_COMBAT_KINDS = { stage: true, boss: true, bonus: true };

  global.DEFAULT_FORGE_MAP_WIDTH = DEFAULT_MAP_W;
  global.DEFAULT_FORGE_MAP_HEIGHT = DEFAULT_MAP_H;

  function clampMapDim(v, fallback) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 320 ? n : fallback;
  }

  global.clampForgeMapWidth = function (v) {
    return clampMapDim(v, DEFAULT_MAP_W);
  };
  global.clampForgeMapHeight = function (v) {
    return clampMapDim(v, DEFAULT_MAP_H);
  };

  global.getOwLocationKind = function (n) {
    if (!n) return '';
    const raw = String(n.kind || '').trim();
    if (raw && global.OW_LOCATION_KINDS.indexOf(raw) >= 0) return raw;
    if (typeof global.getOwMapUiAction === 'function' && global.getOwMapUiAction(n.labelConfig)) {
      return 'labelUi';
    }
    if (n.type === 'label' && n.labelConfig && n.labelConfig.actsAsNode) {
      const mt = n.labelConfig.mimicType || 'none';
      if (mt && mt !== 'none' && global.OW_LOCATION_KINDS.indexOf(mt) >= 0) return mt;
    }
    if (n.type === 'label') return 'label';
    if (n.type && global.OW_LOCATION_KINDS.indexOf(n.type) >= 0) return n.type;
    return n.type || '';
  };

  global.stampOwLocationKind = function (n) {
    if (!n || typeof n !== 'object') return n;
    const kind = global.getOwLocationKind(n) || 'label';
    n.kind = kind;
    if (kind === 'labelUi') {
      n.type = 'label';
      if (!n.labelConfig) n.labelConfig = typeof global.defaultLabelConfig === 'function'
        ? global.defaultLabelConfig() : {};
      n.labelConfig.actsAsNode = false;
      if (!n.labelConfig.uiAction || n.labelConfig.uiAction === 'none') n.labelConfig.uiAction = 'nest';
    } else if (kind === 'label') {
      n.type = 'label';
      if (!n.labelConfig) n.labelConfig = typeof global.defaultLabelConfig === 'function'
        ? global.defaultLabelConfig() : {};
      n.labelConfig.actsAsNode = false;
      n.labelConfig.uiAction = 'none';
    } else {
      n.type = 'label';
      if (!n.labelConfig) n.labelConfig = typeof global.defaultLabelConfig === 'function'
        ? global.defaultLabelConfig() : {};
      n.labelConfig.actsAsNode = true;
      n.labelConfig.uiAction = 'none';
      n.labelConfig.mimicType = kind;
    }
    if (n.appearance && typeof n.appearance === 'object' && !n.labelConfig) {
      n.labelConfig = n.appearance;
    }
    n.appearance = n.labelConfig;
    return n;
  };

  function stampSliceKinds(nodes) {
    (nodes || []).forEach((n) => global.stampOwLocationKind(n));
  }

  global.upgradeMapToV3 = function (map) {
    const v2 = typeof global.upgradeMapToV2 === 'function'
      ? global.upgradeMapToV2(map)
      : Object.assign({}, map || {});
    const m = Object.assign({}, v2);
    m.schemaVersion = 3;
    m.mapWidth = global.clampForgeMapWidth(m.mapWidth);
    m.mapHeight = global.clampForgeMapHeight(m.mapHeight);
    m.author = String(m.author || '');
    m.notes = String(m.notes || '');
    m.packVersion = Math.max(1, Math.floor(Number(m.packVersion) || 1));
    m.updatedAt = m.updatedAt || new Date().toISOString();
    if (!m.createdAt) m.createdAt = m.updatedAt;
    stampSliceKinds(m.nodes);
    Object.keys(m.worlds || {}).forEach((wid) => {
      const w = m.worlds[wid];
      if (!w) return;
      w.mapWidth = w.mapWidth != null ? global.clampForgeMapWidth(w.mapWidth) : undefined;
      w.mapHeight = w.mapHeight != null ? global.clampForgeMapHeight(w.mapHeight) : undefined;
      stampSliceKinds(w.nodes);
    });
    return m;
  };

  global.listWorldPackMaps = function (map) {
    const list = [{ id: 'main', name: map?.name || 'Main Map', nodes: map?.nodes || [] }];
    Object.keys(map?.worlds || {}).forEach((wid) => {
      const w = map.worlds[wid];
      list.push({ id: wid, name: w?.name || wid, nodes: w?.nodes || [], worldIndex: w?.worldIndex });
    });
    return list;
  };

  global.hasOwBlockingValidationErrors = function (issues) {
    return (issues || []).some((i) => i && i.severity === 'error');
  };

  global.collectMapPlaytestErrors = function (map) {
    return (typeof global.collectMapValidationIssues === 'function'
      ? global.collectMapValidationIssues(map)
      : []).filter((i) => i && i.severity === 'error');
  };

  function mkId() {
    return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function makeKindNode(kind, name, x, y, extra) {
    const labelCfg = typeof global.defaultLabelConfig === 'function'
      ? global.defaultLabelConfig()
      : {
        text: name, mimicType: 'stage', shape: 'rounded', width: 80, height: 36,
        showText: true, showBorder: true, showFill: true, actsAsNode: false, uiAction: 'none',
        opacity: 0.72, borderColor: '', textColor: '',
      };
    labelCfg.text = name;
    const node = Object.assign({
      x, y, type: 'label', name, kind, labelConfig: labelCfg, onPath: kind !== 'label' && kind !== 'labelUi',
    }, extra || {});
    global.stampOwLocationKind(node);
    if ((kind === 'stage' || kind === 'boss' || kind === 'bonus') && global.ensureNodeEncounter) {
      global.ensureNodeEncounter(node);
    }
    if (kind === 'shop' && !node.shopConfig) node.shopConfig = { useCustomStock: false, offers: [] };
    if (kind === 'bonus' && !node.bonusConfig) node.bonusConfig = { powerProgression: true, maxRepeats: 5 };
    if (kind === 'start') node.stage = 0;
    return node;
  }

  global.makeOwKindNode = makeKindNode;

  global.createEmptyWorldPack = function () {
    const upgraded = global.upgradeMapToV3({
      schemaVersion: 3,
      id: mkId(),
      name: 'Untitled World',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: '',
      notes: '',
      packVersion: 1,
      mapWidth: DEFAULT_MAP_W,
      mapHeight: DEFAULT_MAP_H,
      backgroundDataUrl: '',
      pathReveal: true,
      maxStage: 0,
      worlds: {},
      startMapId: 'main',
      nodes: [],
    });
    return upgraded;
  };

  global.createWorldPackTemplate = function (templateId, opts) {
    const opt = opts || {};
    const pack = global.createEmptyWorldPack();
    const now = new Date().toISOString();
    pack.createdAt = now;
    pack.updatedAt = now;

    if (templateId === 'story') {
      const builtIn = typeof global.cloneDefaultStoryMap === 'function'
        ? global.cloneDefaultStoryMap()
        : null;
      if (builtIn) {
        const cloned = global.upgradeMapToV3(JSON.parse(JSON.stringify(builtIn)));
        cloned.id = mkId();
        cloned.createdAt = now;
        cloned.updatedAt = now;
        cloned.name = (cloned.name || 'Story Map') + ' Edit';
        return cloned;
      }
    }

    if (templateId === 'linear5') {
      pack.name = opt.name || 'Linear Campaign';
      pack.nodes = [
        makeKindNode('start', 'Spawn', 1200, 880, { stage: 0, pathOrder: 0 }),
        makeKindNode('stage', 'Stage 1', 1000, 780, { terrain: 'Wilds', pathOrder: 1 }),
        makeKindNode('stage', 'Stage 2', 820, 680, { terrain: 'Wilds', pathOrder: 2 }),
        makeKindNode('shop', 'Shop', 700, 560, { pathOrder: 3 }),
        makeKindNode('stage', 'Stage 3', 620, 440, { terrain: 'Wilds', pathOrder: 4 }),
        makeKindNode('stage', 'Stage 4', 540, 300, { terrain: 'Wilds', pathOrder: 5 }),
        makeKindNode('boss', 'Final Boss', 480, 140, { terrain: 'Boss Arena', pathOrder: 6, final: true, mustComplete: true }),
      ];
      return global.upgradeMapToV3(pack);
    }

    if (templateId === 'hub2') {
      pack.name = opt.name || 'Hub Worlds';
      pack.worlds = {
        world1: {
          name: 'World 1',
          worldIndex: 1,
          backgroundDataUrl: '',
          nodes: [
            makeKindNode('start', 'Spawn', 768, 850, { stage: 0, pathOrder: 0 }),
            makeKindNode('stage', 'Stage 1', 768, 700, { terrain: 'Wilds', pathOrder: 1, mustComplete: true }),
            makeKindNode('boss', 'World Boss', 768, 500, { terrain: 'Boss Arena', pathOrder: 2 }),
            makeKindNode('return', 'Return Gate', 768, 280, { pathOrder: 3 }),
          ],
        },
        world2: {
          name: 'World 2',
          worldIndex: 2,
          backgroundDataUrl: '',
          nodes: [
            makeKindNode('start', 'Spawn', 768, 850, { stage: 0, pathOrder: 0 }),
            makeKindNode('stage', 'Stage 1', 768, 700, { terrain: 'Wilds', pathOrder: 1, mustComplete: true }),
            makeKindNode('boss', 'World Boss', 768, 500, { terrain: 'Boss Arena', pathOrder: 2 }),
            makeKindNode('return', 'Return Gate', 768, 280, { pathOrder: 3 }),
          ],
        },
      };
      pack.nodes = [
        makeKindNode('start', 'Hub Spawn', 768, 880, { stage: 0, pathOrder: 0, onPath: true }),
        makeKindNode('world', 'World 1', 520, 520, { worldId: 'world1', pathOrder: 1 }),
        makeKindNode('world', 'World 2', 1020, 520, { worldId: 'world2', pathOrder: 1 }),
        makeKindNode('boss', 'Hub Boss', 768, 180, { terrain: 'Boss Arena', pathOrder: 2, final: true }),
      ];
      return global.upgradeMapToV3(pack);
    }

    if (templateId === 'singleFight') {
      pack.name = opt.name || 'Single Fight Test';
      pack.nodes = [
        makeKindNode('start', 'Spawn', 600, 700, { stage: 0, pathOrder: 0 }),
        makeKindNode('stage', 'Test Stage', 900, 400, { terrain: 'Wilds', pathOrder: 1 }),
      ];
      return global.upgradeMapToV3(pack);
    }

    pack.name = opt.name || 'Untitled World';
    return pack;
  };

  global.WORLD_PACK_TEMPLATES = [
    { id: 'blank', name: 'Blank world', blurb: 'Empty canvas. Place a Spawn and start building.' },
    { id: 'story', name: 'From story campaign', blurb: 'Load Blackstone Forest as a new draft.' },
    { id: 'linear5', name: 'Linear 5-stage', blurb: 'Spawn, four fights, a shop, and a final boss.' },
    { id: 'hub2', name: 'Hub with 2 maps', blurb: 'Main hub plus two nested maps with return gates.' },
    { id: 'singleFight', name: 'Single-fight test', blurb: 'Spawn and one stage — fastest playtest loop.' },
  ];

  function isDataUrl(s) {
    return typeof s === 'string' && s.slice(0, 5) === 'data:';
  }

  global.extractWorldPackAssets = function (map) {
    const assets = {};
    let n = 0;
    function take(url, hint) {
      if (!isDataUrl(url)) return url || '';
      n += 1;
      const key = hint + '-' + n;
      assets[key] = url;
      return 'asset:' + key;
    }
    const out = JSON.parse(JSON.stringify(map || {}));
    out.backgroundDataUrl = take(out.backgroundDataUrl, 'main');
    Object.keys(out.worlds || {}).forEach((wid) => {
      const w = out.worlds[wid];
      if (!w) return;
      w.backgroundDataUrl = take(w.backgroundDataUrl, wid);
    });
    out.assets = assets;
    return out;
  };

  global.resolveWorldPackAssets = function (map) {
    const src = map && typeof map === 'object' ? map : {};
    const assets = src.assets && typeof src.assets === 'object' ? src.assets : {};
    function resolve(url) {
      const s = String(url || '');
      if (s.slice(0, 6) === 'asset:') {
        const key = s.slice(6);
        return assets[key] || '';
      }
      return s;
    }
    const out = JSON.parse(JSON.stringify(src));
    out.backgroundDataUrl = resolve(out.backgroundDataUrl);
    Object.keys(out.worlds || {}).forEach((wid) => {
      const w = out.worlds[wid];
      if (w) w.backgroundDataUrl = resolve(w.backgroundDataUrl);
    });
    delete out.assets;
    return out;
  };

  global.parseWorldPackJson = function (raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') throw new Error('Pack is not an object.');
    const resolved = global.resolveWorldPackAssets(parsed);
    return global.upgradeMapToV3(resolved);
  };
})(typeof window !== 'undefined' ? window : globalThis);
