/**
 * Map Forge v2 — worlds, bonus stages, encounter config.
 */
(function (global) {
  'use strict';

  const MAP_W = 1536;
  const MAP_H = 1024;
  const KEYS = global.AVIAN_OW_KEYS || {};
  const DRAFTS_KEY = KEYS.FORGE_DRAFTS || 'avian_map_forge_drafts';
  const CURRENT_ID_KEY = KEYS.FORGE_CURRENT_ID || 'avian_map_forge_current_id';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const NVC = {
    start: { ring: '#60883a', glow: 'rgba(96,136,58,.3)', r: 22 },
    stage: { ring: '#887030', glow: 'rgba(136,112,48,.27)', r: 20 },
    shop: { ring: '#988028', glow: 'rgba(152,128,40,.3)', r: 22 },
    boss: { ring: '#8a3020', glow: 'rgba(138,48,32,.38)', r: 27 },
    world: { ring: '#208878', glow: 'rgba(32,136,120,.35)', r: 24 },
    bonus: { ring: '#c89010', glow: 'rgba(200,144,16,.35)', r: 21 },
    return: { ring: '#5080a0', glow: 'rgba(80,128,160,.32)', r: 20 },
    overworld: { ring: '#c8a020', glow: 'rgba(200,160,32,.32)', r: 23 },
    label: { ring: '#9a9488', glow: 'rgba(154,148,136,.25)', r: 14 },
  };
  const NVC_FINAL = { ring: '#7820a0', glow: 'rgba(120,32,160,.42)', r: 31 };

  let _map = null;
  let _tool = 'label';
  let _selectedId = null;
  let _drag = null;
  let _wired = false;
  let _editContext = 'main';
  let _pathRevealPreview = false;
  let _worldCounter = 0;
  let _selectedIds = [];
  let _lastSavedFingerprint = '';
  let _history = [];
  let _historyIndex = -1;
  let _historyLock = false;
  const HISTORY_MAX = 20;
  let _zoom = 1;
  let _panX = 0;
  let _panY = 0;
  let _snapGrid = false;
  let _spacePan = false;
  let _panDrag = null;
  let _nodeListFilter = 'all';
  let _bulkChecked = new Set();
  let _configClipboard = null;
  let _pendingDirtyAction = null;
  let _actionStatusUntil = 0;
  let _sidebarPanel = 'node'; // 'node' | 'rewards'

  function upgradeMapSafe(raw) {
    if (typeof global.upgradeMapToV2 === 'function') return global.upgradeMapToV2(raw);
    console.error('[map-forge] upgradeMapToV2 not loaded — using raw map object');
    const m = Object.assign({}, raw || {});
    m.schemaVersion = 2;
    m.worlds = m.worlds && typeof m.worlds === 'object' ? m.worlds : {};
    m.nodes = Array.isArray(m.nodes) ? m.nodes : [];
    m.pathReveal = m.pathReveal !== false;
    return m;
  }

  function mkId() {
    return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function slugName(name) {
    return String(name || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
  }

  function createEmptyMap() {
    return upgradeMapSafe({
      schemaVersion: 2,
      id: mkId(),
      name: 'Untitled Map',
      createdAt: new Date().toISOString(),
      mapWidth: MAP_W,
      mapHeight: MAP_H,
      backgroundDataUrl: '',
      pathReveal: true,
      maxStage: 0,
      worlds: {},
      startMapId: 'main',
      nodes: [],
    });
  }

  function resolveMapStartMapId(map) {
    const id = String(map?.startMapId || 'main');
    if (id === 'main') return 'main';
    if (map?.worlds && map.worlds[id]) return id;
    return 'main';
  }

  function findSpawnNodeIndex(nodes) {
    if (!Array.isArray(nodes)) return 0;
    const i = nodes.findIndex((n) => n.type === 'start');
    return i >= 0 ? i : 0;
  }

  function seedRunProgressToStart(map) {
    if (typeof global.seedOwRunToStartMap === 'function') {
      return global.seedOwRunToStartMap(map);
    }
    const startId = resolveMapStartMapId(map);
    if (global.resetOwCustomProgress) global.resetOwCustomProgress();
    if (global.clearOwMapStack) global.clearOwMapStack();
    if (global.setOwActiveMapId) global.setOwActiveMapId(startId);
    const slice = startId === 'main'
      ? (map?.nodes || [])
      : (map?.worlds?.[startId]?.nodes || []);
    const spawnIdx = findSpawnNodeIndex(slice);
    try {
      global.localStorage.setItem(KEYS.STATE || 'avianAscent_overworld', JSON.stringify({ nodeId: spawnIdx }));
      global.localStorage.removeItem(KEYS.NAV || 'avianAscent_nav');
    } catch (_) {}
    return { startId, spawnIdx };
  }

  function getEditingSlice() {
    if (!_map) return null;
    if (_editContext === 'main') {
      return { mapId: 'main', nodes: _map.nodes, backgroundDataUrl: _map.backgroundDataUrl, worldIndex: null };
    }
    const w = _map.worlds?.[_editContext];
    if (!w) return { mapId: 'main', nodes: _map.nodes, backgroundDataUrl: _map.backgroundDataUrl, worldIndex: null };
    return { mapId: _editContext, nodes: w.nodes, backgroundDataUrl: w.backgroundDataUrl, worldIndex: w.worldIndex };
  }

  function readDrafts() {
    try {
      const raw = global.localStorage.getItem(DRAFTS_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function writeDrafts(list) {
    try { global.localStorage.setItem(DRAFTS_KEY, JSON.stringify(list)); return true; }
    catch (_) { setStatus('Could not save draft - storage may be full.', true); return false; }
  }

  function getCurrentDraftId() {
    try { return global.localStorage.getItem(CURRENT_ID_KEY) || ''; } catch (_) { return ''; }
  }

  function setCurrentDraftId(id) {
    try { if (id) global.localStorage.setItem(CURRENT_ID_KEY, id); else global.localStorage.removeItem(CURRENT_ID_KEY); } catch (_) {}
  }

  function recomputeStages(nodes, worldIndex) {
    if (worldIndex != null) {
      return typeof global.recomputeWorldSubStages === 'function'
        ? global.recomputeWorldSubStages({ nodes, worldIndex })
        : 0;
    }
    let combat = 0;
    for (const n of nodes) {
      if (n.type === 'start') n.stage = 0;
      else if (n.type === 'shop' || n.type === 'world' || n.type === 'bonus' || n.type === 'return' || n.type === 'overworld' || n.type === 'label') {
        delete n.stage; delete n.subStage;
      } else if (n.type === 'stage' || n.type === 'boss') {
        combat += 1;
        n.stage = combat;
        if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
      }
    }
    return combat;
  }

  function normalizeMap(map) {
    let copy = upgradeMapSafe(Object.assign({}, map));
    copy.schemaVersion = 2;
    copy.mapWidth = MAP_W;
    copy.mapHeight = MAP_H;
    copy.pathReveal = copy.pathReveal !== false;
    copy.worlds = copy.worlds || {};
    const sm = String(copy.startMapId || 'main');
    copy.startMapId = (sm === 'main' || (copy.worlds && copy.worlds[sm])) ? sm : 'main';
    copy.nodes = typeof global.normalizeOwMapNodes === 'function'
      ? global.normalizeOwMapNodes(copy.nodes || [])
      : (copy.nodes || []).map((n, i) => Object.assign({}, n, { id: i }));
    _worldCounter = 0;
    copy.nodes.forEach((n) => {
      if (n.type === 'world') {
        _worldCounter += 1;
        if (!n.worldId) n.worldId = 'world' + _worldCounter;
        if (!copy.worlds[n.worldId]) {
          copy.worlds[n.worldId] = {
            name: n.name || 'World ' + _worldCounter,
            worldIndex: _worldCounter,
            backgroundDataUrl: '',
            nodes: [],
          };
        }
      }
    });
    Object.keys(copy.worlds).forEach((wid) => {
      const w = copy.worlds[wid];
      w.nodes = typeof global.normalizeOwMapNodes === 'function'
        ? global.normalizeOwMapNodes(w.nodes || [])
        : (w.nodes || []).map((n, i) => Object.assign({}, n, { id: i }));
      if (global.recomputeWorldSubStages) global.recomputeWorldSubStages(w);
    });
    copy.maxStage = recomputeStages(copy.nodes, null);
    return copy;
  }

  function setStatus(msg, isError, isWarn) {
    const el = document.getElementById('map-forge-status');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('map-forge-status--warn');
    if (isError) el.style.color = 'var(--red-light, #ff9090)';
    else if (isWarn) {
      el.style.color = '#e8c060';
      el.classList.add('map-forge-status--warn');
    } else el.style.color = 'var(--text-dim, #9a9488)';
    if (msg) _actionStatusUntil = Date.now() + 3500;
  }

  function reportForgeError(label, err) {
    const msg = err && err.message ? err.message : String(err || label || 'Unknown error');
    const stack = err && err.stack ? err.stack : '';
    try {
      console.error('[map-forge]', label, err);
    } catch (_e) { /* noop */ }
    if (typeof global.pushErrorHUD === 'function') {
      try {
        global.pushErrorHUD('MapForge', String(label || 'Error') + ': ' + msg, err instanceof Error ? err : { stack });
      } catch (_e2) { /* noop */ }
    }
    setStatus((label ? label + ': ' : '') + msg, true);
  }

  function getSelectedLabelNode() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    return n && n.type === 'label' ? n : null;
  }

  function deriveLabelRole(cfg) {
    if (!cfg) return 'decorative';
    if (global.getOwMapUiAction && global.getOwMapUiAction(cfg)) return 'uiButton';
    if (cfg.actsAsNode) return 'nodeProxy';
    return 'decorative';
  }

  function getNodeTypeSelectValue(n) {
    if (!n) return 'label';
    if (n.type === 'label') {
      if (global.getOwMapUiAction && global.getOwMapUiAction(n.labelConfig)) return 'labelUi';
      return 'label';
    }
    return n.type;
  }

  function stripTypedNodeFields(n) {
    delete n.worldId;
    delete n.terrain;
    delete n.portraitBird;
    delete n.final;
    delete n.encounter;
    delete n.bonusConfig;
    delete n.clearRewards;
    delete n.stage;
    delete n.subStage;
    delete n.labelConfig;
  }

  function convertSelectedNodeType(typeKey) {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    if (!n || !slice) return false;

    if (getNodeTypeSelectValue(n) === typeKey) return true;

    const prevType = n.type;
    const prevWorldId = n.worldId;

    if (typeKey === 'world' && _editContext !== 'main') {
      setStatus('World nodes can only be placed on the main map.', true);
      return false;
    }
    if (typeKey === 'start') {
      const otherSpawn = slice.nodes.some((x) => x.id !== n.id && x.type === 'start');
      if (otherSpawn) {
        setStatus('Only one Spawn node allowed on this map.', true);
        return false;
      }
    }

    pushHistory();

    if (prevType === 'world' && prevWorldId && typeKey !== 'world' && _map.worlds?.[prevWorldId]) {
      delete _map.worlds[prevWorldId];
    }

    if (typeKey === 'label' || typeKey === 'labelUi') {
      stripTypedNodeFields(n);
      n.type = 'label';
      n.name = n.name || 'Label';
      const labelCfg = typeof global.defaultLabelConfig === 'function' ? global.defaultLabelConfig() : {
        text: 'Label', mimicType: 'stage', shape: 'rounded', width: 80, height: 36,
        showText: true, showBorder: true, showFill: true, actsAsNode: false, uiAction: 'none',
      };
      labelCfg.actsAsNode = false;
      if (typeKey === 'labelUi') {
        labelCfg.uiAction = 'nest';
        labelCfg.shape = 'pill';
        const labels = global.OW_MAP_UI_ACTION_LABELS || {};
        labelCfg.text = labels.nest || 'Nest';
        n.name = labelCfg.text;
      } else {
        labelCfg.uiAction = 'none';
        labelCfg.text = 'Label';
      }
      n.labelConfig = labelCfg;
      if (global.ensureLabelConfig) global.ensureLabelConfig(n);
    } else if (typeKey === 'start') {
      stripTypedNodeFields(n);
      n.type = 'start';
      n.name = 'Spawn';
      n.stage = 0;
    } else if (typeKey === 'shop') {
      stripTypedNodeFields(n);
      n.type = 'shop';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Stork Emporium';
    } else if (typeKey === 'return') {
      stripTypedNodeFields(n);
      n.type = 'return';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Return Gate';
    } else if (typeKey === 'overworld') {
      stripTypedNodeFields(n);
      n.type = 'overworld';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Overworld Gate';
    } else if (typeKey === 'bonus') {
      stripTypedNodeFields(n);
      n.type = 'bonus';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Bonus Stage';
      n.terrain = 'Bonus Arena';
      n.bonusConfig = { powerProgression: true, maxRepeats: 5 };
      n.clearRewards = [{ type: 'shinies', min: 15, max: 30 }];
      if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    } else if (typeKey === 'boss') {
      stripTypedNodeFields(n);
      n.type = 'boss';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Boss Stage';
      n.terrain = 'Boss Arena';
      if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    } else if (typeKey === 'world') {
      stripTypedNodeFields(n);
      _worldCounter += 1;
      const wid = 'world' + _worldCounter;
      n.type = 'world';
      n.name = n.name && n.name !== 'Label' ? n.name : ('World ' + _worldCounter);
      n.worldId = wid;
      _map.worlds[wid] = {
        name: n.name,
        worldIndex: _worldCounter,
        backgroundDataUrl: '',
        nodes: [],
      };
    } else {
      stripTypedNodeFields(n);
      n.type = 'stage';
      n.name = n.name && n.name !== 'Label' ? n.name : 'Stage';
      n.terrain = 'Wilds';
      if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    }

    _map = normalizeMap(_map);
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Node type set to ' + (typeKey === 'start' ? 'Spawn' : typeKey === 'labelUi' ? 'Label (UI button)' : typeKey) + '.');
    return true;
  }

  function applyLabelDimensions(fromBlur) {
    const n = getSelectedLabelNode();
    if (!n) return;
    const cfg = n.labelConfig;
    const widthEl = document.getElementById('map-forge-label-width');
    const heightEl = document.getElementById('map-forge-label-height');
    if (widthEl) {
      cfg.width = Math.max(16, Math.min(400, Math.floor(Number(widthEl.value) || 80)));
      widthEl.value = String(cfg.width);
    }
    if (heightEl) {
      cfg.height = Math.max(12, Math.min(200, Math.floor(Number(heightEl.value) || 36)));
      heightEl.value = String(cfg.height);
    }
    if (global.ensureLabelConfig) global.ensureLabelConfig(n);
    renderForgeCanvas();
    if (fromBlur) pushHistory();
  }

  function getValidationIssues() {
    if (!_map || typeof global.collectMapValidationIssues !== 'function') return [];
    return global.collectMapValidationIssues(_map);
  }

  function isEmptyDraft(map) {
    if (!map) return true;
    if (map.backgroundDataUrl) return false;
    const nodes = map.nodes || [];
    const combat = nodes.filter((n) => n.type === 'stage' || n.type === 'boss');
    return combat.length === 0;
  }

  function cloneMapPayload(map) {
    if (!map || typeof map !== 'object') return null;
    if (typeof global.cloneStoryMap === 'function') return global.cloneStoryMap(map);
    return JSON.parse(JSON.stringify(map));
  }

  function getCurrentStoryMapForForge() {
    const active = typeof global.loadCustomOverworldMap === 'function'
      ? global.loadCustomOverworldMap()
      : null;
    if (active) {
      return { source: 'active', map: cloneMapPayload(active) };
    }
    const builtIn = typeof global.cloneDefaultStoryMap === 'function'
      ? global.cloneDefaultStoryMap()
      : cloneMapPayload(global.AVIAN_STORY_MAP_DEFAULT);
    return builtIn ? { source: 'built-in', map: builtIn } : null;
  }

  function syncForgeValidationStatus(issues) {
    if (Date.now() < _actionStatusUntil) return;
    const list = Array.isArray(issues) ? issues : getValidationIssues();
    const errors = list.filter((i) => i.severity === 'error');
    const warnings = list.filter((i) => i.severity === 'warning');
    const el = document.getElementById('map-forge-status');
    if (!el) return;
    if (errors.length) {
      const hint = isEmptyDraft(_map) ? 'New map - upload a background, then place Stage nodes. ' : '';
      const first = errors[0].message || '';
      const extra = errors.length > 1 ? ' (+' + (errors.length - 1) + ' more)' : '';
      el.textContent = hint + errors.length + (errors.length === 1 ? ' issue: ' : ' issues - ') + first + extra;
      el.classList.remove('map-forge-status--warn');
      el.style.color = 'var(--red-light, #ff9090)';
      return;
    }
    if (warnings.length) {
      const first = warnings[0].message || '';
      const extra = warnings.length > 1 ? ' (+' + (warnings.length - 1) + ' more)' : '';
      el.textContent = warnings.length + (warnings.length === 1 ? ' warning: ' : ' warnings - ') + first + extra;
      el.classList.add('map-forge-status--warn');
      el.style.color = '#e8c060';
      return;
    }
    el.textContent = '';
    el.classList.remove('map-forge-status--warn');
    el.style.color = 'var(--text-dim, #9a9488)';
  }

  function validateMap(map) {
    const nodes = map?.nodes || [];
    if (!nodes.length) return 'Add at least one node.';
    const mainSpawns = nodes.filter((n) => n.type === 'start').length;
    if (mainSpawns === 0) return 'Add a Spawn node (place a Label, then set Node type to Spawn).';
    if (mainSpawns > 1) return 'Exactly one Spawn node required on the main map.';
    if (!nodes.some((n) => n.type === 'stage' || n.type === 'boss')) return 'Add at least one Stage or Boss.';
    if (!map.backgroundDataUrl) return 'Upload a background image first.';
    const startId = resolveMapStartMapId(map);
    if (startId !== 'main') {
      const wn = map.worlds?.[startId]?.nodes || [];
      if (!wn.some((n) => n.type === 'start')) return 'Start map "' + startId + '" needs a Spawn node.';
    }
    return null;
  }

  function serializeNode(n, worldIndex) {
    const out = { id: n.id, type: n.type, name: n.name || '', x: n.x, y: n.y };
    if (n.type === 'start') out.stage = 0;
    else if (n.type === 'world') out.worldId = n.worldId;
    else if (n.type === 'shop' || n.type === 'return' || n.type === 'overworld') { /* no stage */ }
    else {
      if (worldIndex != null && n.subStage) out.subStage = n.subStage;
      else if (n.stage) out.stage = n.stage;
      if (n.terrain) out.terrain = n.terrain;
      if (n.portraitBird) out.portraitBird = n.portraitBird;
    }
    if (n.final) out.final = true;
    if (n.encounter) out.encounter = JSON.parse(JSON.stringify(n.encounter));
    if (n.bonusConfig) out.bonusConfig = JSON.parse(JSON.stringify(n.bonusConfig));
    if (n.clearRewards) out.clearRewards = JSON.parse(JSON.stringify(n.clearRewards));
    if (n.type === 'label' && n.labelConfig) out.labelConfig = JSON.parse(JSON.stringify(n.labelConfig));
    return out;
  }

  function buildExportPayload(map) {
    const normalized = normalizeMap(map);
    const worlds = {};
    Object.keys(normalized.worlds || {}).forEach((wid) => {
      const w = normalized.worlds[wid];
      worlds[wid] = {
        name: w.name,
        worldIndex: w.worldIndex,
        backgroundDataUrl: w.backgroundDataUrl || '',
        nodes: (w.nodes || []).map((n) => serializeNode(n, w.worldIndex)),
      };
    });
    return {
      schemaVersion: 2,
      id: normalized.id,
      name: normalized.name,
      createdAt: normalized.createdAt || new Date().toISOString(),
      mapWidth: MAP_W,
      mapHeight: MAP_H,
      pathReveal: normalized.pathReveal !== false,
      backgroundDataUrl: normalized.backgroundDataUrl || '',
      maxStage: normalized.maxStage,
      startMapId: resolveMapStartMapId(normalized),
      nodes: normalized.nodes.map((n) => serializeNode(n, null)),
      worlds,
    };
  }

  function nvc(n) {
    if (n.type === 'label') {
      const ui = global.getOwMapUiAction?.(n.labelConfig);
      if (ui) return { ring: '#7090b8', glow: 'rgba(112,144,184,.28)', r: 16 };
      const mt = n.labelConfig?.mimicType;
      if (mt && mt !== 'none' && NVC[mt]) return NVC[mt];
      return NVC.label;
    }
    return n.final ? NVC_FINAL : NVC[n.type] || NVC.stage;
  }

  const UI_ACTION_ICONS = {
    nest: '🪺',
    settings: '⚙',
    reference: '📖',
    openLocation: '▶',
    prevNode: '◀',
    nextNode: '▶',
  };

  function appendForgeLabelShape(g, cfg, vc, x, y) {
    const w = cfg.width || 80;
    const h = cfg.height || 36;
    const shape = cfg.shape || 'rounded';
    if (cfg.showFill || cfg.showBorder) {
      if (shape === 'circle') {
        const el = document.createElementNS(SVG_NS, 'ellipse');
        el.setAttribute('cx', String(x));
        el.setAttribute('cy', String(y));
        el.setAttribute('rx', String(w / 2));
        el.setAttribute('ry', String(h / 2));
        if (cfg.showFill) el.setAttribute('fill', 'rgba(6,12,5,.72)');
        else el.setAttribute('fill', 'none');
        if (cfg.showBorder) {
          el.setAttribute('stroke', vc.ring);
          el.setAttribute('stroke-width', '2');
        }
        g.appendChild(el);
      } else {
        const el = document.createElementNS(SVG_NS, 'rect');
        el.setAttribute('x', String(x - w / 2));
        el.setAttribute('y', String(y - h / 2));
        el.setAttribute('width', String(w));
        el.setAttribute('height', String(h));
        if (shape === 'pill' || shape === 'rounded') el.setAttribute('rx', String(shape === 'pill' ? h / 2 : 6));
        if (cfg.showFill) el.setAttribute('fill', 'rgba(6,12,5,.72)');
        else el.setAttribute('fill', 'none');
        if (cfg.showBorder) {
          el.setAttribute('stroke', vc.ring);
          el.setAttribute('stroke-width', '2');
        }
        g.appendChild(el);
      }
    }
    if (cfg.showText && cfg.text) {
      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', String(x));
      txt.setAttribute('y', String(y + 1));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.setAttribute('font-family', 'Cinzel, serif');
      txt.setAttribute('font-size', '8');
      txt.setAttribute('fill', vc.ring);
      txt.style.pointerEvents = 'none';
      const ui = global.getOwMapUiAction?.(cfg);
      const icon = ui ? (UI_ACTION_ICONS[ui] || '') : '';
      txt.textContent = (icon ? icon + ' ' : '') + cfg.text;
      g.appendChild(txt);
    }
  }

  function nodeLabel(n, worldIndex) {
    if (typeof global.getNodeDisplayLabel === 'function') return global.getNodeDisplayLabel(n, worldIndex);
    return n.name || n.type;
  }

  function mapPointFromEvent(svg, e) {
    const wrap = document.getElementById('map-forge-canvas-wrap');
    const rect = wrap?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return { x: 0, y: 0 };
    const localX = (e.clientX - rect.left - _panX) / _zoom;
    const localY = (e.clientY - rect.top - _panY) / _zoom;
    const x = (localX / rect.width) * MAP_W;
    const y = (localY / rect.height) * MAP_H;
    return {
      x: snapCoord(Math.round(Math.max(0, Math.min(MAP_W, x)))),
      y: snapCoord(Math.round(Math.max(0, Math.min(MAP_H, y)))),
    };
  }

  function snapCoord(v) {
    if (!_snapGrid) return v;
    const g = 32;
    return Math.round(v / g) * g;
  }

  function applyCanvasTransform() {
    const inner = document.getElementById('map-forge-canvas-inner');
    if (inner) {
      inner.style.transformOrigin = '0 0';
      inner.style.transform = 'translate(' + _panX + 'px,' + _panY + 'px) scale(' + _zoom + ')';
    }
  }

  function getMapFingerprint() {
    try {
      applyNodeFieldChanges();
      const nameEl = document.getElementById('map-forge-name');
      if (nameEl && _map) _map.name = nameEl.value.trim() || _map.name;
      return JSON.stringify(buildExportPayload(_map)) + '|' + getCurrentDraftId() + '|' + _editContext;
    } catch (_) { return ''; }
  }

  function getSelectedNode() {
    const slice = getEditingSlice();
    if (!slice || _selectedId == null) return null;
    return slice.nodes.find((x) => x.id === _selectedId) || null;
  }

  function markSavedFingerprint() {
    _lastSavedFingerprint = getMapFingerprint();
  }

  function isMapForgeDirty() {
    return getMapFingerprint() !== _lastSavedFingerprint;
  }

  function pushHistory() {
    if (_historyLock || !_map) return;
    const snap = JSON.stringify({
      map: buildExportPayload(_map),
      editContext: _editContext,
      selectedId: _selectedId,
      selectedIds: _selectedIds.slice(),
    });
    if (_historyIndex >= 0 && _history[_historyIndex] === snap) return;
    _history = _history.slice(0, _historyIndex + 1);
    _history.push(snap);
    if (_history.length > HISTORY_MAX) _history.shift();
    else _historyIndex += 1;
    _historyIndex = _history.length - 1;
  }

  function restoreHistorySnapshot(snap) {
    _historyLock = true;
    try {
      const data = JSON.parse(snap);
      _map = normalizeMap(Object.assign(createEmptyMap(), data.map || {}));
      _editContext = data.editContext || 'main';
      _selectedIds = Array.isArray(data.selectedIds) ? data.selectedIds : [];
      _selectedId = data.selectedId ?? _selectedIds[0] ?? null;
      const nameEl = document.getElementById('map-forge-name');
      if (nameEl) nameEl.value = _map.name || '';
      refreshForgeUI();
    } finally {
      _historyLock = false;
    }
  }

  function undoMapForge() {
    if (_historyIndex <= 0) { setStatus('Nothing to undo.'); return; }
    _historyIndex -= 1;
    restoreHistorySnapshot(_history[_historyIndex]);
    setStatus('Undone.');
  }

  function redoMapForge() {
    if (_historyIndex >= _history.length - 1) { setStatus('Nothing to redo.'); return; }
    _historyIndex += 1;
    restoreHistorySnapshot(_history[_historyIndex]);
    setStatus('Redone.');
  }

  function refreshForgeUI() {
    try {
      populateStartMapSelect();
      renderNodeList();
      renderForgeCanvas();
      syncNodeEditorFields();
      renderValidationPanel();
      renderMapSummary();
      renderMinimap();
      syncPlaytestFromBtn();
      applyCanvasTransform();
      syncBreadcrumb();
      syncForgeCanvasCursor();
    } catch (err) {
      reportForgeError('Map Forge UI error', err);
    }
  }

  function renderValidationPanel() {
    const panel = document.getElementById('map-forge-validation-panel');
    if (!panel || !_map) return;
    const issues = getValidationIssues();
    panel.innerHTML = '';
    if (!issues.length) {
      const ok = document.createElement('div');
      ok.className = 'map-forge-validation-ok';
      ok.textContent = 'No issues found.';
      panel.appendChild(ok);
      syncForgeValidationStatus(issues);
      return;
    }
    issues.forEach((iss) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'map-forge-validation-row map-forge-validation-' + iss.severity;
      row.textContent = (iss.severity === 'error' ? '✕ ' : '⚠ ') + iss.message;
      row.onclick = () => {
        if (iss.mapId && iss.mapId !== 'main' && iss.mapId !== _editContext) {
          _editContext = iss.mapId;
          _selectedId = iss.nodeId;
          _selectedIds = iss.nodeId != null ? [iss.nodeId] : [];
        } else if (iss.nodeId != null) {
          _selectedId = iss.nodeId;
          _selectedIds = [iss.nodeId];
        }
        refreshForgeUI();
        if (iss.nodeId != null) centerViewOnNode(getSelectedNode());
      };
      panel.appendChild(row);
    });
    syncForgeValidationStatus(issues);
  }

  function renderMapSummary() {
    const el = document.getElementById('map-forge-map-summary');
    if (!el || !global.summarizeMapSlice) return;
    const slice = getEditingSlice();
    const mainSum = global.summarizeMapSlice({ mapId: 'main', nodes: _map.nodes }, _map);
    const curSum = slice ? global.summarizeMapSlice(slice, _map) : mainSum;
    let text = curSum.combat + ' combat · ' + (slice?.mapId === 'main' ? mainSum.worlds : 0) + ' worlds · ' + curSum.bonus + ' bonus · ' + curSum.shop + ' shop';
    text += ' · avg mut tier ' + curSum.avgMutTier;
    if (curSum.bonusPower?.length) text += ' · bonus power up to ' + Math.max(...curSum.bonusPower) + ' clears';
    el.textContent = text;
  }

  function centerViewOnNode(n) {
    if (!n) return;
    const wrap = document.getElementById('map-forge-canvas-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    _zoom = Math.max(_zoom, 1);
    _panX = rect.width / 2 - n.x * (_zoom * rect.width / MAP_W);
    _panY = rect.height / 2 - n.y * (_zoom * rect.height / MAP_H);
    applyCanvasTransform();
    renderMinimap();
  }

  function fitAllNodes() {
    const slice = getEditingSlice();
    if (!slice?.nodes?.length) return;
    let minX = MAP_W, minY = MAP_H, maxX = 0, maxY = 0;
    slice.nodes.forEach((n) => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y);
    });
    const wrap = document.getElementById('map-forge-canvas-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const pad = 80;
    const bw = Math.max(1, maxX - minX + pad * 2);
    const bh = Math.max(1, maxY - minY + pad * 2);
    _zoom = Math.min(3, Math.max(0.25, Math.min(rect.width / bw, rect.height / bh)));
    _panX = (rect.width - (minX + maxX) * _zoom * rect.width / MAP_W) / 2;
    _panY = (rect.height - (minY + maxY) * _zoom * rect.height / MAP_H) / 2;
    applyCanvasTransform();
    renderMinimap();
  }

  function renderMinimap() {
    const canvas = document.getElementById('map-forge-minimap');
    if (!canvas) return;
    const slice = getEditingSlice();
    if (!slice) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(6,12,5,.85)';
    ctx.fillRect(0, 0, w, h);
    slice.nodes.forEach((n) => {
      const px = (n.x / MAP_W) * w;
      const py = (n.y / MAP_H) * h;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = (_selectedIds.includes(n.id) || n.id === _selectedId) ? '#f0d060' : (NVC[n.type]?.ring || '#887030');
      ctx.fill();
    });
    const wrap = document.getElementById('map-forge-canvas-wrap');
    if (wrap && _zoom > 0) {
      const wrect = wrap.getBoundingClientRect();
      const vw = wrect.width / _zoom;
      const vh = wrect.height / _zoom;
      const vx = (-_panX / _zoom);
      const vy = (-_panY / _zoom);
      ctx.strokeStyle = 'rgba(240,208,96,.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect((vx / MAP_W) * w, (vy / MAP_H) * h, (vw / MAP_W) * w, (vh / MAP_H) * h);
    }
  }

  function syncTerrainPicker(n) {
    const sel = document.getElementById('map-forge-terrain-select');
    const custom = document.getElementById('map-forge-terrain-custom');
    const preview = document.getElementById('map-forge-arena-preview');
    if (!sel) return;
    const presets = global.FORGE_TERRAIN_PRESETS || [];
    const terrain = n?.terrain || '';
    const match = presets.find((p) => p.terrain === terrain);
    if (match) {
      sel.value = match.terrain;
      if (custom) { custom.style.display = 'none'; custom.value = ''; }
    } else if (terrain) {
      sel.value = '__custom__';
      if (custom) { custom.style.display = ''; custom.value = terrain; }
    } else {
      sel.value = presets[0]?.terrain || '';
      if (custom) custom.style.display = 'none';
    }
    if (preview && n) {
      const stage = n.stage || n.subStage || 1;
      const t = terrain || sel.value;
      const matchPreset = presets.find((p) => p.terrain === t);
      const arenaId = matchPreset?.arenaId || 'forest';
      preview.src = 'assets/arenas/arena-' + arenaId + '-desktop.png';
      preview.onerror = function () {
        preview.onerror = null;
        preview.src = 'assets/arenas/arena-' + arenaId + '.png';
      };
      preview.alt = arenaId;
    }
  }

  function syncPlaytestFromBtn() {
    const btn = document.getElementById('map-forge-playtest-from-btn');
    if (btn) btn.disabled = _selectedId == null;
  }

  function confirmDirtyThen(fn) {
    if (!isMapForgeDirty()) { fn(); return; }
    _pendingDirtyAction = fn;
    const modal = document.getElementById('map-forge-unsaved-modal');
    if (modal) modal.classList.add('active');
  }

  function pickNodeAtPoint(svg, e) {
    const pt = mapPointFromEvent(svg, e);
    const slice = getEditingSlice();
    if (!slice) return null;
    let best = null;
    let bestDist = Infinity;
    slice.nodes.forEach((n) => {
      const vc = nvc(n);
      const dx = pt.x - n.x;
      const dy = pt.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= vc.r + 8 && dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    });
    return best;
  }

  function getForgeCombatItemOptions() {
    const catalog = global.COMBAT_ITEM_CATALOG || globalThis.COMBAT_ITEM_CATALOG;
    if (catalog && typeof catalog === 'object') {
      return Object.keys(catalog).map((k) => ({
        id: k,
        label: catalog[k]?.name || k,
      }));
    }
    return [
      { id: 'freshWater', label: 'Fresh Water' },
      { id: 'sugarWater', label: 'Bird Seed' },
      { id: 'honeyWater', label: 'Honey Water' },
    ];
  }

  function getForgeMutationOptions() {
    const byId = (global.Avian && global.Avian.data && global.Avian.data.mutations && global.Avian.data.mutations.byId) || {};
    const keys = Object.keys(byId);
    if (!keys.length) return [];
    return keys
      .map((id) => {
        const item = byId[id];
        return { id, label: (item?.name || id) + (item?.tier ? ' (' + item.tier + ')' : '') };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  function setSidebarPanel(panel) {
    _sidebarPanel = panel === 'rewards' ? 'rewards' : 'node';
    document.querySelectorAll('[data-forge-panel-tab]').forEach((btn) => {
      const on = btn.getAttribute('data-forge-panel-tab') === _sidebarPanel;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('[data-forge-panel]').forEach((pane) => {
      const on = pane.getAttribute('data-forge-panel') === _sidebarPanel;
      pane.classList.toggle('is-active', on);
      if (on) pane.removeAttribute('hidden');
      else pane.setAttribute('hidden', '');
    });
    if (_sidebarPanel === 'rewards') syncRewardsPanel();
  }

  function ensureNodeClearRewards(n) {
    if (!n || !global.isForgeCombatNode || !global.isForgeCombatNode(n)) return;
    if (!Array.isArray(n.clearRewards) && n.bonusConfig?.rewards?.length) {
      n.clearRewards = JSON.parse(JSON.stringify(n.bonusConfig.rewards));
      delete n.bonusConfig.rewards;
    }
    if (!Array.isArray(n.clearRewards)) n.clearRewards = [];
  }

  function syncRewardsPanel() {
    const emptyEl = document.getElementById('map-forge-rewards-empty');
    const editorEl = document.getElementById('map-forge-rewards-editor');
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    const isCombat = n && global.isForgeCombatNode && global.isForgeCombatNode(n);
    if (!isCombat) {
      if (emptyEl) emptyEl.style.display = '';
      if (editorEl) editorEl.style.display = 'none';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (editorEl) editorEl.style.display = '';
    renderClearRewardsList(n);
  }

  function moveClearReward(n, index, dir) {
    if (!n?.clearRewards) return;
    const j = index + dir;
    if (j < 0 || j >= n.clearRewards.length) return;
    const tmp = n.clearRewards[index];
    n.clearRewards[index] = n.clearRewards[j];
    n.clearRewards[j] = tmp;
    renderClearRewardsList(n);
  }

  function appendChanceControl(row, r, n) {
    const wrap = document.createElement('label');
    wrap.className = 'map-forge-reward-chance';
    wrap.title = 'Chance to grant this reward (0–100%)';
    const lbl = document.createElement('span');
    lbl.textContent = '%';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'map-forge-reward-num';
    inp.min = '0';
    inp.max = '100';
    inp.value = String(r.chance != null ? r.chance : 100);
    inp.onchange = () => {
      r.chance = Math.max(0, Math.min(100, Math.floor(Number(inp.value) || 100)));
      inp.value = String(r.chance);
    };
    wrap.appendChild(inp);
    wrap.appendChild(lbl);
    row.appendChild(wrap);
  }

  function renderClearRewardsList(n) {
    const list = document.getElementById('map-forge-clear-reward-list');
    if (!list) return;
    ensureNodeClearRewards(n);
    list.innerHTML = '';
    const cardTiers = global.OW_CARD_TIER_MUTATION_OPTIONS || [];
    const itemOpts = getForgeCombatItemOptions();
    const mutOpts = getForgeMutationOptions();
    const birdOpts = global.getForgeBirdOptions ? global.getForgeBirdOptions() : [{ id: 'random', label: 'Random' }];
    const appendControls = (row, i) => {
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.className = 'map-forge-node-move';
      up.title = 'Move up';
      up.disabled = i === 0;
      up.onclick = () => moveClearReward(n, i, -1);
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.className = 'map-forge-node-move';
      down.title = 'Move down';
      down.disabled = i >= (n.clearRewards.length - 1);
      down.onclick = () => moveClearReward(n, i, 1);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.className = 'map-forge-node-move';
      rm.title = 'Remove';
      rm.onclick = () => { n.clearRewards.splice(i, 1); renderClearRewardsList(n); };
      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(rm);
      list.appendChild(row);
    };
    (n.clearRewards || []).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'map-forge-clear-reward-row map-forge-clear-reward-card';
      if (r.type === 'shinies') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = 'Shinies';
        const minIn = document.createElement('input');
        minIn.type = 'number';
        minIn.className = 'map-forge-reward-num';
        minIn.min = '0';
        minIn.value = String(r.min ?? 10);
        minIn.onchange = () => {
          r.min = Math.max(0, Math.floor(Number(minIn.value) || 0));
          if (r.max < r.min) r.max = r.min;
          renderClearRewardsList(n);
        };
        const dash = document.createElement('span');
        dash.textContent = '–';
        dash.className = 'map-forge-reward-dash';
        const maxIn = document.createElement('input');
        maxIn.type = 'number';
        maxIn.className = 'map-forge-reward-num';
        maxIn.min = '0';
        maxIn.value = String(r.max ?? 25);
        maxIn.onchange = () => {
          r.max = Math.max(r.min ?? 0, Math.floor(Number(maxIn.value) || 0));
          renderClearRewardsList(n);
        };
        row.appendChild(lbl);
        row.appendChild(minIn);
        row.appendChild(dash);
        row.appendChild(maxIn);
      } else if (r.type === 'mutation') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = 'Mutation';
        const tierSel = document.createElement('select');
        tierSel.className = 'map-forge-field-input map-forge-reward-tier';
        tierSel.disabled = !!(r.mutationId);
        cardTiers.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = b.label;
          if ((r.tierBand || r.tier || 'blue') === b.id) o.selected = true;
          tierSel.appendChild(o);
        });
        tierSel.onchange = () => { r.tierBand = tierSel.value; };
        const countIn = document.createElement('input');
        countIn.type = 'number';
        countIn.className = 'map-forge-reward-num';
        countIn.min = '1';
        countIn.max = '11';
        countIn.value = String(r.count ?? 1);
        countIn.title = 'Count';
        countIn.disabled = !!(r.mutationId);
        countIn.onchange = () => { r.count = Math.max(1, Math.min(11, Math.floor(Number(countIn.value) || 1))); };
        const mutSel = document.createElement('select');
        mutSel.className = 'map-forge-field-input map-forge-reward-mutation-id';
        mutSel.title = 'Specific mutation (optional)';
        const anyOpt = document.createElement('option');
        anyOpt.value = '';
        anyOpt.textContent = '- Roll by tier -';
        mutSel.appendChild(anyOpt);
        mutOpts.forEach((m) => {
          const o = document.createElement('option');
          o.value = m.id;
          o.textContent = m.label;
          if ((r.mutationId || '') === m.id) o.selected = true;
          mutSel.appendChild(o);
        });
        mutSel.onchange = () => {
          r.mutationId = mutSel.value || undefined;
          if (!r.mutationId) delete r.mutationId;
          renderClearRewardsList(n);
        };
        row.appendChild(lbl);
        row.appendChild(tierSel);
        row.appendChild(countIn);
        row.appendChild(mutSel);
      } else if (r.type === 'nest') {
        if (!Array.isArray(r.slots)) r.slots = [{ tier: 'blue' }];
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = 'Reward Nest';
        row.appendChild(lbl);
        const nestWrap = document.createElement('div');
        nestWrap.className = 'map-forge-nest-slots';
        r.slots.forEach((slot, si) => {
          const slotRow = document.createElement('div');
          slotRow.className = 'map-forge-nest-slot-row';
          const slotLbl = document.createElement('span');
          slotLbl.textContent = 'Drop ' + (si + 1);
          slotLbl.className = 'map-forge-nest-slot-label';
          const tierSel = document.createElement('select');
          tierSel.className = 'map-forge-field-input';
          cardTiers.forEach((b) => {
            const o = document.createElement('option');
            o.value = b.id;
            o.textContent = b.label;
            if ((slot.tier || 'blue') === b.id) o.selected = true;
            tierSel.appendChild(o);
          });
          tierSel.onchange = () => { slot.tier = tierSel.value; };
          slotRow.appendChild(slotLbl);
          slotRow.appendChild(tierSel);
          nestWrap.appendChild(slotRow);
        });
        const countSel = document.createElement('select');
        countSel.className = 'map-forge-field-input';
        for (let c = 1; c <= 5; c++) {
          const o = document.createElement('option');
          o.value = String(c);
          o.textContent = c + ' drop' + (c > 1 ? 's' : '');
          if (r.slots.length === c) o.selected = true;
          countSel.appendChild(o);
        }
        countSel.onchange = () => {
          const want = Math.max(1, Math.min(5, Math.floor(Number(countSel.value) || 1)));
          while (r.slots.length < want) r.slots.push({ tier: 'blue' });
          r.slots.length = want;
          renderClearRewardsList(n);
        };
        row.appendChild(countSel);
        row.appendChild(nestWrap);
      } else if (r.type === 'item') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = 'Item';
        const itemSel = document.createElement('select');
        itemSel.className = 'map-forge-field-input';
        itemOpts.forEach((it) => {
          const o = document.createElement('option');
          o.value = it.id;
          o.textContent = it.label;
          if ((r.itemKey || 'freshWater') === it.id) o.selected = true;
          itemSel.appendChild(o);
        });
        itemSel.onchange = () => { r.itemKey = itemSel.value; };
        const minIn = document.createElement('input');
        minIn.type = 'number';
        minIn.className = 'map-forge-reward-num';
        minIn.min = '1';
        minIn.value = String(r.min ?? 1);
        minIn.onchange = () => {
          r.min = Math.max(1, Math.floor(Number(minIn.value) || 1));
          if (r.max < r.min) r.max = r.min;
        };
        const dash = document.createElement('span');
        dash.textContent = '–';
        dash.className = 'map-forge-reward-dash';
        const maxIn = document.createElement('input');
        maxIn.type = 'number';
        maxIn.className = 'map-forge-reward-num';
        maxIn.min = '1';
        maxIn.value = String(r.max ?? r.min ?? 1);
        maxIn.onchange = () => { r.max = Math.max(r.min ?? 1, Math.floor(Number(maxIn.value) || 1)); };
        row.appendChild(lbl);
        row.appendChild(itemSel);
        row.appendChild(minIn);
        row.appendChild(dash);
        row.appendChild(maxIn);
      } else if (r.type === 'rescuedNest' || r.type === 'goldenGoose') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = r.type === 'rescuedNest' ? 'Rescued Nest' : 'Golden Goose Egg';
        const countIn = document.createElement('input');
        countIn.type = 'number';
        countIn.className = 'map-forge-reward-num';
        countIn.min = '0';
        countIn.value = String(r.count ?? 1);
        countIn.onchange = () => { r.count = Math.max(0, Math.floor(Number(countIn.value) || 0)); };
        row.appendChild(lbl);
        row.appendChild(countIn);
        if (r.type === 'rescuedNest') {
          const tierSel = document.createElement('select');
          tierSel.className = 'map-forge-field-input';
          ['cracked', 'feathered', 'gleaming', 'royal', 'ancestral'].forEach((tier) => {
            const o = document.createElement('option');
            o.value = tier;
            o.textContent = tier;
            if ((r.eggId || 'cracked') === tier) o.selected = true;
            tierSel.appendChild(o);
          });
          tierSel.onchange = () => { r.eggId = tierSel.value; };
          row.appendChild(tierSel);
        }
      } else if (r.type === 'speciesFeathers') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = 'Species Feather';
        const birdSel = document.createElement('select');
        birdSel.className = 'map-forge-field-input';
        birdOpts.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = b.label;
          if ((r.birdKey || 'random') === b.id) o.selected = true;
          birdSel.appendChild(o);
        });
        birdSel.onchange = () => { r.birdKey = birdSel.value; };
        const countIn = document.createElement('input');
        countIn.type = 'number';
        countIn.className = 'map-forge-reward-num';
        countIn.min = '1';
        countIn.value = String(r.count ?? 1);
        countIn.onchange = () => { r.count = Math.max(1, Math.floor(Number(countIn.value) || 1)); };
        row.appendChild(lbl);
        row.appendChild(birdSel);
        row.appendChild(countIn);
      } else {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = String(r.type || 'Unknown');
        row.appendChild(lbl);
      }
      appendChanceControl(row, r, n);
      appendControls(row, i);
    });
  }

  function syncBreadcrumb() {
    const el = document.getElementById('map-forge-breadcrumb');
    if (!el) return;
    if (_editContext === 'main') {
      el.textContent = 'Main Map';
      el.style.display = '';
    } else {
      const w = _map?.worlds?.[_editContext];
      el.textContent = 'Main Map › ' + (w?.name || _editContext);
    }
    const backBtn = document.getElementById('map-forge-world-back');
    if (backBtn) backBtn.style.display = _editContext === 'main' ? 'none' : '';
    const editBtn = document.getElementById('map-forge-edit-world-btn');
    const sidebarEnter = document.getElementById('map-forge-sidebar-enter-world');
    const sidebarExit = document.getElementById('map-forge-sidebar-exit-world');
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    const showEnter = _editContext === 'main' && n?.type === 'world';
    if (editBtn) editBtn.style.display = showEnter ? '' : 'none';
    if (sidebarEnter) sidebarEnter.style.display = showEnter ? '' : 'none';
    if (sidebarExit) sidebarExit.style.display = _editContext !== 'main' ? '' : 'none';
  }

  function renderDraftSelect() {
    const sel = document.getElementById('map-forge-draft-select');
    if (!sel) return;
    const cur = getCurrentDraftId();
    sel.innerHTML = '<option value="">- New map -</option>';
    readDrafts().forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name || d.id;
      if (d.id === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderEncounterPanel() {
    const panel = document.getElementById('map-forge-encounter-panel');
    if (!panel) return;
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    const isCombat = n && global.isForgeCombatNode && global.isForgeCombatNode(n);
    if (!isCombat) {
      panel.style.display = 'none';
      syncRewardsPanel();
      const fightBtn = document.getElementById('map-forge-fight-btn');
      if (fightBtn) fightBtn.disabled = true;
      return;
    }
    panel.style.display = '';
    if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    const countEl = document.getElementById('map-forge-enemy-count');
    const combatMultEl = document.getElementById('map-forge-combat-stat-mult');
    const hdMultEl = document.getElementById('map-forge-health-damage-mult');
    const rowsEl = document.getElementById('map-forge-encounter-rows');
    const bonusEl = document.getElementById('map-forge-bonus-panel');
    if (combatMultEl) {
      combatMultEl.value = String(n.encounter.combatStatMult ?? 1);
      combatMultEl.onchange = () => {
        n.encounter.combatStatMult = Number(combatMultEl.value);
        global.ensureNodeEncounter(n);
        combatMultEl.value = String(n.encounter.combatStatMult);
      };
    }
    if (hdMultEl) {
      hdMultEl.value = String(n.encounter.healthDamageMult ?? 1);
      hdMultEl.onchange = () => {
        n.encounter.healthDamageMult = Number(hdMultEl.value);
        global.ensureNodeEncounter(n);
        hdMultEl.value = String(n.encounter.healthDamageMult);
      };
    }
    if (countEl) {
      countEl.value = String(n.encounter.enemyCount);
      countEl.onchange = () => {
        n.encounter.enemyCount = Math.max(1, Math.min(5, Math.floor(Number(countEl.value) || 1)));
        global.ensureNodeEncounter(n);
        renderEncounterPanel();
      };
    }
    if (rowsEl) {
      rowsEl.innerHTML = '';
      const speciesOpts = global.getForgeBirdOptions ? global.getForgeBirdOptions() : [{ id: 'random', label: 'Random' }];
      const mutTiers = global.OW_CARD_TIER_MUTATION_OPTIONS || [];
      const isBossNode = n.type === 'boss' || !!n.final;
      n.encounter.slots.forEach((slot, idx) => {
        const row = document.createElement('div');
        row.className = 'map-forge-encounter-row';
        const head = document.createElement('div');
        head.className = 'map-forge-encounter-row-head';
        head.textContent = 'Enemy ' + (idx + 1);
        row.appendChild(head);
        const grid = document.createElement('div');
        grid.className = 'map-forge-encounter-row-grid';

        const speciesWrap = document.createElement('label');
        speciesWrap.className = 'map-forge-encounter-field';
        speciesWrap.textContent = 'Species';
        const speciesSel = document.createElement('select');
        speciesSel.className = 'map-forge-field-input';
        speciesOpts.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = b.label;
          if (slot.birdKey === b.id) o.selected = true;
          speciesSel.appendChild(o);
        });
        speciesSel.onchange = () => {
          slot.birdKey = speciesSel.value;
          delete slot.enemyId;
          renderEncounterPanel();
        };
        speciesWrap.appendChild(speciesSel);
        grid.appendChild(speciesWrap);

        const tierWrap = document.createElement('label');
        tierWrap.className = 'map-forge-encounter-field';
        tierWrap.textContent = 'Tier';
        const tierSel = document.createElement('select');
        tierSel.className = 'map-forge-field-input';
        const tierOrder = global.BIRD_CARD_TIER_ORDER || ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
        const tierLabels = (global.Avian && global.Avian.data && global.Avian.data.birdCardTiers && global.Avian.data.birdCardTiers.TIER_LABELS) || {
          grey: 'Grey', green: 'Green', blue: 'Blue', purple: 'Purple', gold: 'Gold', orange: 'Orange',
        };
        const slotTier = (typeof global.normalizeBirdCardTier === 'function'
          ? global.normalizeBirdCardTier(slot.enemyTier || 'grey')
          : String(slot.enemyTier || 'grey').toLowerCase());
        tierOrder.forEach((tierId) => {
          const o = document.createElement('option');
          o.value = tierId;
          o.textContent = tierLabels[tierId] || tierId;
          if (slotTier === tierId) o.selected = true;
          tierSel.appendChild(o);
        });
        tierSel.onchange = () => {
          slot.enemyTier = tierSel.value;
          delete slot.enemyId;
          renderEncounterPanel();
        };
        tierWrap.appendChild(tierSel);
        grid.appendChild(tierWrap);

        const starsWrap = document.createElement('label');
        starsWrap.className = 'map-forge-encounter-field';
        starsWrap.textContent = 'Stars';
        const starsSel = document.createElement('select');
        starsSel.className = 'map-forge-field-input';
        const starsPerTier = global.BIRD_CARD_STARS_PER_TIER || 5;
        const slotStars = typeof global.clampBirdCardStars === 'function'
          ? global.clampBirdCardStars(slot.enemyStars != null ? slot.enemyStars : 0)
          : Math.max(0, Math.min(starsPerTier, Math.floor(Number(slot.enemyStars) || 0)));
        for (let s = 0; s <= starsPerTier; s++) {
          const o = document.createElement('option');
          o.value = String(s);
          o.textContent = s === 0 ? '0 stars' : s + ' star' + (s === 1 ? '' : 's');
          if (slotStars === s) o.selected = true;
          starsSel.appendChild(o);
        }
        starsSel.onchange = () => {
          slot.enemyStars = Math.max(0, Math.min(starsPerTier, Math.floor(Number(starsSel.value) || 0)));
          delete slot.enemyId;
          renderEncounterPanel();
        };
        starsWrap.appendChild(starsSel);
        grid.appendChild(starsWrap);

        const mutWrap = document.createElement('label');
        mutWrap.className = 'map-forge-encounter-field';
        mutWrap.textContent = 'Mutation tier';
        const bandSel = document.createElement('select');
        bandSel.className = 'map-forge-field-input';
        mutTiers.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = b.label;
          if (slot.mutationBand === b.id) o.selected = true;
          bandSel.appendChild(o);
        });
        bandSel.onchange = () => { slot.mutationBand = bandSel.value; };
        mutWrap.appendChild(bandSel);
        grid.appendChild(mutWrap);

        const countWrap = document.createElement('label');
        countWrap.className = 'map-forge-encounter-field';
        countWrap.textContent = 'Mutations on enemy';
        const mutSel = document.createElement('select');
        mutSel.className = 'map-forge-field-input';
        for (let m = 0; m <= 11; m++) {
          const o = document.createElement('option');
          o.value = String(m);
          o.textContent = String(m);
          if (slot.maxMutations === m) o.selected = true;
          mutSel.appendChild(o);
        }
        mutSel.onchange = () => { slot.maxMutations = Math.floor(Number(mutSel.value) || 0); };
        countWrap.appendChild(mutSel);
        grid.appendChild(countWrap);

        row.appendChild(grid);
        if (slot.birdKey === 'random') {
          const hint = document.createElement('p');
          hint.className = 'map-forge-hint map-forge-encounter-random-hint';
          hint.textContent = 'Tier and stars apply when a random species is rolled at runtime.';
          row.appendChild(hint);
        }
        rowsEl.appendChild(row);
      });
    }
    if (bonusEl) {
      const showBonus = n.type === 'bonus';
      bonusEl.style.display = showBonus ? '' : 'none';
      if (showBonus) {
        if (!n.bonusConfig) {
          n.bonusConfig = { powerProgression: true, maxRepeats: 5 };
        }
        const cfg = n.bonusConfig;
        const powEl = document.getElementById('map-forge-bonus-power');
        const repEl = document.getElementById('map-forge-bonus-repeats');
        if (powEl) { powEl.checked = !!cfg.powerProgression; powEl.onchange = () => { cfg.powerProgression = powEl.checked; }; }
        if (repEl) {
          repEl.value = String(cfg.maxRepeats || 5);
          repEl.onchange = () => { cfg.maxRepeats = Math.max(1, Math.min(20, Math.floor(Number(repEl.value) || 5))); };
        }
      }
    }
    syncRewardsPanel();
    renderBossStatsPanel(n);
    const fightBtn = document.getElementById('map-forge-fight-btn');
    if (fightBtn) fightBtn.disabled = !isCombat;
  }

  function renderNodeList() {
    const list = document.getElementById('map-forge-node-list');
    const slice = getEditingSlice();
    if (!list || !slice) return;
    list.innerHTML = '';
    const wi = slice.worldIndex;
    slice.nodes.forEach((n) => {
      if (_nodeListFilter !== 'all' && n.type !== _nodeListFilter) return;
      const row = document.createElement('div');
      row.className = 'map-forge-node-row' + ((n.id === _selectedId || _selectedIds.includes(n.id)) ? ' is-selected' : '');
      row.draggable = true;
      row.dataset.nodeId = String(n.id);
      row.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', String(n.id)); });
      row.addEventListener('dragover', (ev) => { ev.preventDefault(); });
      row.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const fromId = Number(ev.dataTransfer.getData('text/plain'));
        const toId = n.id;
        if (fromId === toId) return;
        pushHistory();
        const fromIdx = slice.nodes.findIndex((x) => x.id === fromId);
        const toIdx = slice.nodes.findIndex((x) => x.id === toId);
        if (fromIdx < 0 || toIdx < 0) return;
        const [item] = slice.nodes.splice(fromIdx, 1);
        slice.nodes.splice(toIdx, 0, item);
        if (_editContext === 'main') _map = normalizeMap(_map);
        else if (_map.worlds[_editContext]) global.recomputeWorldSubStages(_map.worlds[_editContext]);
        renderNodeList();
        renderForgeCanvas();
      });
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = _bulkChecked.has(n.id);
      chk.className = 'map-forge-bulk-chk';
      chk.onclick = (ev) => {
        ev.stopPropagation();
        if (chk.checked) _bulkChecked.add(n.id); else _bulkChecked.delete(n.id);
      };
      row.appendChild(chk);
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'map-forge-node-pick';
      const lbl = nodeLabel(n, wi);
      const typeLabel = n.type === 'start' ? 'spawn' : (n.type === 'boss' && n.final ? 'final boss' : n.type);
      label.textContent = '#' + n.id + ' ' + typeLabel + (lbl ? ' · ' + lbl : '') + (n.name ? ' - ' + n.name : '');
      label.onclick = () => {
        _selectedId = n.id;
        _selectedIds = [n.id];
        renderNodeList();
        renderForgeCanvas();
        syncNodeEditorFields();
        renderEncounterPanel();
        centerViewOnNode(n);
      };
      row.appendChild(label);
      ['↑', '↓'].forEach((sym, di) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-forge-node-move';
        btn.textContent = sym;
        const onPath = typeof global.isOwPathNode === 'function' ? global.isOwPathNode(n) : true;
        btn.disabled = !onPath || (di === 0 ? n.id <= 0 : n.id >= slice.nodes.length - 1);
        btn.onclick = (ev) => { ev.stopPropagation(); moveNode(n.id, di === 0 ? -1 : 1); };
        row.appendChild(btn);
      });
      list.appendChild(row);
    });
  }

  function renderLabelEditorPanel(n) {
    const panel = document.getElementById('map-forge-label-panel');
    if (!panel) return;
    const show = n && n.type === 'label';
    panel.style.display = show ? '' : 'none';
    if (!show) return;
    if (global.ensureLabelConfig) global.ensureLabelConfig(n);
    const cfg = n.labelConfig;
    const role = deriveLabelRole(cfg);
    const uiActionEl = document.getElementById('map-forge-label-ui-action');
    const uiWrap = document.getElementById('map-forge-label-ui-wrap');
    const uiHint = document.getElementById('map-forge-label-ui-hint');
    const textEl = document.getElementById('map-forge-label-text');
    const shapeEl = document.getElementById('map-forge-label-shape');
    const widthEl = document.getElementById('map-forge-label-width');
    const heightEl = document.getElementById('map-forge-label-height');
    const showTextEl = document.getElementById('map-forge-label-show-text');
    const showBorderEl = document.getElementById('map-forge-label-show-border');
    const showFillEl = document.getElementById('map-forge-label-show-fill');

    if (uiWrap) uiWrap.style.display = role === 'uiButton' ? '' : 'none';
    if (uiActionEl) uiActionEl.value = cfg.uiAction && cfg.uiAction !== 'none' ? cfg.uiAction : 'nest';
    if (uiHint) {
      if (role === 'uiButton') {
        const opt = (global.OW_MAP_UI_ACTIONS || []).find((a) => a.id === cfg.uiAction);
        uiHint.textContent = 'Opens ' + (opt?.label || cfg.uiAction) + ' in playtest/run.';
        uiHint.style.display = '';
      } else {
        uiHint.style.display = 'none';
      }
    }
    if (textEl) textEl.value = cfg.text || '';
    if (shapeEl) shapeEl.value = cfg.shape || 'rounded';
    if (widthEl) widthEl.value = String(cfg.width || 80);
    if (heightEl) heightEl.value = String(cfg.height || 36);
    if (showTextEl) showTextEl.checked = !!cfg.showText;
    if (showBorderEl) showBorderEl.checked = !!cfg.showBorder;
    if (showFillEl) showFillEl.checked = !!cfg.showFill;
  }

  function wireLabelEditorControls() {
    const panel = document.getElementById('map-forge-label-panel');
    if (!panel || panel.dataset.forgeLabelWired === '1') return;
    panel.dataset.forgeLabelWired = '1';

    document.getElementById('map-forge-label-ui-action')?.addEventListener('change', (e) => {
      const n = getSelectedLabelNode();
      if (!n?.labelConfig) return;
      const cfg = n.labelConfig;
      const prev = cfg.uiAction;
      cfg.uiAction = e.target.value || 'nest';
      cfg.actsAsNode = false;
      if (global.ensureLabelConfig) global.ensureLabelConfig(n);
      const labels = global.OW_MAP_UI_ACTION_LABELS || {};
      if (!cfg.text || cfg.text === 'Label' || cfg.text === labels[prev]) {
        cfg.text = labels[cfg.uiAction] || cfg.text || 'Button';
      }
      if (cfg.shape === 'rounded' || !cfg.shape) cfg.shape = 'pill';
      renderLabelEditorPanel(n);
      renderValidationPanel();
      renderForgeCanvas();
      pushHistory();
    });

    document.getElementById('map-forge-label-text')?.addEventListener('input', (e) => {
      const n = getSelectedLabelNode();
      if (!n?.labelConfig) return;
      n.labelConfig.text = e.target.value;
      renderForgeCanvas();
    });

    document.getElementById('map-forge-label-shape')?.addEventListener('change', (e) => {
      const n = getSelectedLabelNode();
      if (!n?.labelConfig) return;
      n.labelConfig.shape = e.target.value;
      renderForgeCanvas();
      pushHistory();
    });

    const onDimInput = () => applyLabelDimensions(false);
    const onDimChange = () => applyLabelDimensions(true);
    const widthEl = document.getElementById('map-forge-label-width');
    const heightEl = document.getElementById('map-forge-label-height');
    widthEl?.addEventListener('input', onDimInput);
    widthEl?.addEventListener('change', onDimChange);
    heightEl?.addEventListener('input', onDimInput);
    heightEl?.addEventListener('change', onDimChange);

    ['map-forge-label-show-text', 'map-forge-label-show-border', 'map-forge-label-show-fill'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const n = getSelectedLabelNode();
        if (!n?.labelConfig) return;
        const key = id === 'map-forge-label-show-text' ? 'showText' : id === 'map-forge-label-show-border' ? 'showBorder' : 'showFill';
        n.labelConfig[key] = !!e.target.checked;
        renderForgeCanvas();
        pushHistory();
      });
    });
  }

  function syncNodeEditorFields() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    const editor = document.getElementById('map-forge-node-editor');
    if (!editor) return;
    if (!n) {
      editor.style.display = 'none';
      renderLabelEditorPanel(null);
      renderEncounterPanel();
      syncBreadcrumb();
      return;
    }
    const isOverworld = n.type === 'overworld';
    const isShop = n.type === 'shop';
    const isReturn = n.type === 'return';
    const isStart = n.type === 'start';
    const isWorld = n.type === 'world';
    const isLabel = n.type === 'label';
    const hideCombatFields = isOverworld || isLabel || isShop || isReturn || isStart || isWorld;
    editor.style.display = '';
    const typeEl = document.getElementById('map-forge-node-type');
    const nameEl = document.getElementById('map-forge-node-name');
    const finalEl = document.getElementById('map-forge-node-final');
    const worldRenameWrap = document.getElementById('map-forge-world-rename-wrap');
    const worldRenameEl = document.getElementById('map-forge-world-rename');
    const terrainLabel = document.querySelector('label[for="map-forge-terrain-select"]');
    const terrainSel = document.getElementById('map-forge-terrain-select');
    const terrainCustom = document.getElementById('map-forge-terrain-custom');
    const portraitLabel = document.querySelector('label[for="map-forge-portrait-bird"]');
    const portraitEl = document.getElementById('map-forge-portrait-bird');
    const arenaPreview = document.getElementById('map-forge-arena-preview');
    if (typeEl) typeEl.value = getNodeTypeSelectValue(n);
    if (nameEl) nameEl.value = n.name || '';
    if (hideCombatFields) {
      if (terrainLabel) terrainLabel.style.display = 'none';
      if (terrainSel) terrainSel.style.display = 'none';
      if (terrainCustom) terrainCustom.style.display = 'none';
      if (portraitLabel) portraitLabel.style.display = 'none';
      if (portraitEl) portraitEl.style.display = 'none';
      if (arenaPreview) arenaPreview.style.display = 'none';
      if (finalEl) finalEl.closest('label').style.display = 'none';
    } else {
      syncTerrainPicker(n);
      if (terrainLabel) terrainLabel.style.display = '';
      if (terrainSel) terrainSel.style.display = '';
      if (portraitLabel) portraitLabel.style.display = '';
      if (portraitEl) portraitEl.style.display = '';
      if (arenaPreview) arenaPreview.style.display = '';
      if (portraitEl) portraitEl.value = n.portraitBird || '';
      if (finalEl) {
        finalEl.checked = !!n.final;
        finalEl.disabled = n.type !== 'boss';
        finalEl.closest('label').style.display = n.type === 'boss' ? '' : 'none';
      }
    }
    if (worldRenameWrap) worldRenameWrap.style.display = _editContext !== 'main' ? '' : 'none';
    if (worldRenameEl && _editContext !== 'main') {
      worldRenameEl.value = _map?.worlds?.[_editContext]?.name || '';
    }
    renderLabelEditorPanel(n);
    renderEncounterPanel();
    syncBreadcrumb();
  }

  function moveNode(id, dir) {
    const slice = getEditingSlice();
    if (!slice) return;
    const idx = slice.nodes.findIndex((n) => n.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= slice.nodes.length) return;
    pushHistory();
    const tmp = slice.nodes[idx];
    slice.nodes[idx] = slice.nodes[next];
    slice.nodes[next] = tmp;
    if (_editContext === 'main') _map = normalizeMap(_map);
    else if (_map.worlds[_editContext]) {
      global.recomputeWorldSubStages(_map.worlds[_editContext]);
    }
    _selectedId = slice.nodes[next].id;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
  }

  function renderForgeCanvas() {
    const bg = document.getElementById('map-forge-bg');
    const svg = document.getElementById('map-forge-svg');
    const slice = getEditingSlice();
    if (!svg || !slice) return;
    if (bg) {
      bg.src = slice.backgroundDataUrl || '';
      bg.style.display = slice.backgroundDataUrl ? 'block' : 'none';
    }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', '0 0 ' + MAP_W + ' ' + MAP_H);
    const pathReveal = _pathRevealPreview && _map.pathReveal !== false;
    const fakeProgress = pathReveal ? { nodeClears: {}, worldsCompleted: {} } : null;
    if (pathReveal && _selectedId != null) {
      for (let j = 0; j < slice.nodes.length; j++) {
        if (slice.nodes[j].id <= _selectedId) {
          const k = global.owNodeKey ? global.owNodeKey(slice.mapId, slice.nodes[j].id) : slice.mapId + ':' + slice.nodes[j].id;
          fakeProgress.nodeClears[k] = true;
        }
      }
    }
    if (_snapGrid) {
      const gridG = document.createElementNS(SVG_NS, 'g');
      gridG.setAttribute('opacity', '0.15');
      for (let gx = 0; gx <= MAP_W; gx += 32) {
        const ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('x1', String(gx)); ln.setAttribute('y1', '0');
        ln.setAttribute('x2', String(gx)); ln.setAttribute('y2', String(MAP_H));
        ln.setAttribute('stroke', '#c9a84c'); ln.setAttribute('stroke-width', '1');
        gridG.appendChild(ln);
      }
      for (let gy = 0; gy <= MAP_H; gy += 32) {
        const ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('x1', '0'); ln.setAttribute('y1', String(gy));
        ln.setAttribute('x2', String(MAP_W)); ln.setAttribute('y2', String(gy));
        ln.setAttribute('stroke', '#c9a84c'); ln.setAttribute('stroke-width', '1');
        gridG.appendChild(ln);
      }
      svg.insertBefore(gridG, svg.firstChild);
    }
    const pathG = document.createElementNS(SVG_NS, 'g');
    const pathIdx = typeof global.getPathNodeIndices === 'function'
      ? global.getPathNodeIndices(slice.nodes)
      : slice.nodes.map((_, i) => i);
    for (let j = 0; j < pathIdx.length - 1; j++) {
      if (pathReveal && global.isPathSegmentRevealed && !global.isPathSegmentRevealed(slice.nodes, j, fakeProgress, slice.mapId, { worldId: slice.mapId }, true)) continue;
      const a = slice.nodes[pathIdx[j]];
      const b = slice.nodes[pathIdx[j + 1]];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('stroke', '#887018');
      line.setAttribute('stroke-width', '3');
      pathG.appendChild(line);
    }
    svg.appendChild(pathG);
    slice.nodes.forEach((n, ni) => {
      if (n.type === 'label') return;
      if (pathReveal && global.isNodeVisibleOnMap && !global.isNodeVisibleOnMap(slice.nodes, ni, fakeProgress, slice.mapId, { worldId: slice.mapId }, true)) return;
      const vc = nvc(n);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('data-node-id', String(n.id));
      g.style.cursor = 'grab';
      if (n.id === _selectedId || _selectedIds.includes(n.id)) {
        const sel = document.createElementNS(SVG_NS, 'circle');
        sel.setAttribute('cx', String(n.x));
        sel.setAttribute('cy', String(n.y));
        sel.setAttribute('r', String(vc.r + 6));
        sel.setAttribute('fill', 'none');
        sel.setAttribute('stroke', '#f0d060');
        sel.setAttribute('stroke-width', '2');
        sel.setAttribute('stroke-dasharray', '4 3');
        g.appendChild(sel);
      }
      const glow = document.createElementNS(SVG_NS, 'circle');
      glow.setAttribute('cx', String(n.x));
      glow.setAttribute('cy', String(n.y));
      glow.setAttribute('r', String(vc.r + 4));
      glow.setAttribute('fill', vc.glow);
      g.appendChild(glow);
      const main = document.createElementNS(SVG_NS, 'circle');
      main.setAttribute('cx', String(n.x));
      main.setAttribute('cy', String(n.y));
      main.setAttribute('r', String(vc.r));
      main.setAttribute('fill', 'rgba(6,12,5,.78)');
      main.setAttribute('stroke', vc.ring);
      main.setAttribute('stroke-width', '2');
      g.appendChild(main);
      const txt = document.createElementNS(SVG_NS, 'text');
      txt.setAttribute('x', String(n.x));
      txt.setAttribute('y', String(n.y + 1));
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'middle');
      txt.setAttribute('font-family', 'Cinzel, serif');
      txt.setAttribute('font-size', '9');
      txt.setAttribute('fill', vc.ring);
      txt.style.pointerEvents = 'none';
      const sym = { shop: '$', start: '⌂', world: 'W', bonus: '★', return: '↩', overworld: 'OW', label: 'T' };
      txt.textContent = sym[n.type] || nodeLabel(n, slice.worldIndex) || '';
      g.appendChild(txt);
      svg.appendChild(g);
    });
    slice.nodes.forEach((n) => {
      if (n.type !== 'label') return;
      if (global.ensureLabelConfig) global.ensureLabelConfig(n);
      const cfg = n.labelConfig;
      const vc = nvc(n);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('data-node-id', String(n.id));
      g.style.cursor = 'grab';
      if (n.id === _selectedId || _selectedIds.includes(n.id)) {
        const w = cfg.width || 80;
        const h = cfg.height || 36;
        const sel = document.createElementNS(SVG_NS, 'rect');
        sel.setAttribute('x', String(n.x - w / 2 - 4));
        sel.setAttribute('y', String(n.y - h / 2 - 4));
        sel.setAttribute('width', String(w + 8));
        sel.setAttribute('height', String(h + 8));
        sel.setAttribute('fill', 'none');
        sel.setAttribute('stroke', '#f0d060');
        sel.setAttribute('stroke-width', '2');
        sel.setAttribute('stroke-dasharray', '4 3');
        g.appendChild(sel);
      }
      appendForgeLabelShape(g, cfg, vc, n.x, n.y);
      svg.appendChild(g);
    });
    renderMinimap();
  }

  function applyNodeFieldChanges() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    if (!n) return;
    const nameEl = document.getElementById('map-forge-node-name');
    const terrainSel = document.getElementById('map-forge-terrain-select');
    const terrainCustom = document.getElementById('map-forge-terrain-custom');
    const portraitEl = document.getElementById('map-forge-portrait-bird');
    const finalEl = document.getElementById('map-forge-node-final');
    if (nameEl) n.name = nameEl.value.trim() || n.name;
    if (n.type !== 'shop') {
      if (terrainSel?.value === '__custom__' && terrainCustom) n.terrain = terrainCustom.value.trim();
      else if (terrainSel?.value) n.terrain = terrainSel.value;
    }
    if (portraitEl) {
      if (portraitEl.value) n.portraitBird = portraitEl.value;
      else delete n.portraitBird;
    }
    if (finalEl && n.type === 'boss') {
      if (finalEl.checked) {
        slice.nodes.forEach((x) => { if (x.type === 'boss') delete x.final; });
        n.final = true;
      } else delete n.final;
    }
    _map = normalizeMap(_map);
    renderNodeList();
    renderForgeCanvas();
    renderValidationPanel();
    renderMapSummary();
  }

  function syncForgeCanvasCursor() {
    const wrap = document.getElementById('map-forge-canvas-wrap');
    if (!wrap) return;
    // Select tool pans on empty drag — no exclusive grab mode.
    wrap.classList.remove('is-grab-tool');
    if (!_panDrag) wrap.classList.remove('is-panning');
  }

  function beginPanDrag(clientX, clientY) {
    _panDrag = { x: clientX, y: clientY, panX: _panX, panY: _panY };
    document.getElementById('map-forge-canvas-wrap')?.classList.add('is-panning');
  }

  function endPanDrag() {
    _panDrag = null;
    document.getElementById('map-forge-canvas-wrap')?.classList.remove('is-panning');
  }

  function setTool(tool) {
    // Pan is no longer a separate tool — fold into select.
    if (tool === 'pan') tool = 'select';
    _tool = tool;
    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-forge-tool') === tool);
    });
    syncForgeCanvasCursor();
  }

  function placeNode(x, y) {
    if (_tool !== 'label') {
      setStatus('Use the Label place tool, then set Node type in the Node panel.', true);
      return;
    }
    pushHistory();
    const slice = getEditingSlice();
    if (!slice) return;
    const labelCfg = typeof global.defaultLabelConfig === 'function' ? global.defaultLabelConfig() : {
      text: 'Label', mimicType: 'stage', shape: 'rounded', width: 80, height: 36,
      showText: true, showBorder: true, showFill: true, actsAsNode: false, uiAction: 'none',
    };
    labelCfg.text = 'Label';
    labelCfg.actsAsNode = false;
    labelCfg.uiAction = 'none';
    slice.nodes.push({ x, y, type: 'label', name: 'Label', labelConfig: labelCfg });
    _map = normalizeMap(_map);
    _selectedId = slice.nodes[slice.nodes.length - 1]?.id ?? 0;
    _selectedIds = [_selectedId];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Label placed — set Node type in the Node panel.');
  }

  function deleteSelectedNode() {
    const slice = getEditingSlice();
    if (_selectedId == null) { setStatus('Select a node to delete.', true); return; }
    const idx = slice?.nodes?.findIndex((x) => x.id === _selectedId) ?? -1;
    if (idx < 0) { setStatus('Select a node to delete.', true); return; }
    const n = slice.nodes[idx];
    pushHistory();
    slice.nodes.splice(idx, 1);
    if (n.type === 'world' && n.worldId && _map.worlds[n.worldId]) delete _map.worlds[n.worldId];
    _map = normalizeMap(_map);
    _selectedId = null;
    _selectedIds = [];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus(n.type === 'start' ? 'Spawn deleted — add a Spawn before save/export.' : 'Node deleted.');
  }

  function deselectNode() {
    _selectedId = null;
    _selectedIds = [];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('');
  }

  function duplicateSelectedNode() {
    const slice = getEditingSlice();
    const n = getSelectedNode();
    if (!n) { setStatus('Select a node to duplicate.', true); return; }
    if (n.type === 'start') { setStatus('Cannot duplicate Spawn node.', true); return; }
    pushHistory();
    const copy = JSON.parse(JSON.stringify(n));
    copy.x = Math.min(MAP_W - 40, (n.x || 0) + 40);
    copy.y = Math.min(MAP_H - 40, (n.y || 0) + 40);
    delete copy.id;
    if (copy.type === 'world' && copy.worldId) {
      _worldCounter += 1;
      const wid = 'world' + _worldCounter;
      const srcWorld = _map.worlds[n.worldId];
      copy.worldId = wid;
      copy.name = (n.name || 'World') + ' Copy';
      _map.worlds[wid] = srcWorld
        ? JSON.parse(JSON.stringify(srcWorld))
        : {
          name: copy.name,
          worldIndex: _worldCounter,
          backgroundDataUrl: '',
          nodes: [],
        };
      _map.worlds[wid].name = copy.name;
      _map.worlds[wid].worldIndex = _worldCounter;
    }
    slice.nodes.push(copy);
    _map = normalizeMap(_map);
    _selectedId = slice.nodes[slice.nodes.length - 1]?.id ?? null;
    _selectedIds = [_selectedId];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Node duplicated.');
  }

  function addClearReward() {
    const n = getSelectedNode();
    if (!n || !global.isForgeCombatNode || !global.isForgeCombatNode(n)) return;
    ensureNodeClearRewards(n);
    const typeEl = document.getElementById('map-forge-reward-add-type');
    const type = typeEl?.value || 'shinies';
    if (type === 'shinies') n.clearRewards.push({ type: 'shinies', min: 10, max: 25, chance: 100 });
    else if (type === 'mutation') n.clearRewards.push({ type: 'mutation', tierBand: 'blue', count: 1, chance: 100 });
    else if (type === 'nest') n.clearRewards.push({ type: 'nest', slots: [{ tier: 'blue' }], chance: 100 });
    else if (type === 'item') n.clearRewards.push({ type: 'item', itemKey: 'freshWater', min: 1, max: 1, chance: 100 });
    else if (type === 'rescuedNest') n.clearRewards.push({ type: 'rescuedNest', eggId: 'cracked', count: 1, chance: 100 });
    else if (type === 'goldenGoose') n.clearRewards.push({ type: 'goldenGoose', count: 1, chance: 100 });
    else if (type === 'speciesFeathers') n.clearRewards.push({ type: 'speciesFeathers', birdKey: 'random', count: 1, chance: 100 });
    renderClearRewardsList(n);
  }

  function populateStartMapSelect() {
    const sel = document.getElementById('map-forge-start-map');
    if (!sel || !_map) return;
    const cur = resolveMapStartMapId(_map);
    sel.innerHTML = '';
    const mainOpt = document.createElement('option');
    mainOpt.value = 'main';
    mainOpt.textContent = 'Main Map';
    sel.appendChild(mainOpt);
    Object.keys(_map.worlds || {}).forEach((wid) => {
      const w = _map.worlds[wid];
      const o = document.createElement('option');
      o.value = wid;
      o.textContent = (w?.name || wid) + ' (world)';
      sel.appendChild(o);
    });
    sel.value = cur;
    const editBtn = document.getElementById('map-forge-edit-start-map');
    if (editBtn) editBtn.style.display = cur !== 'main' ? '' : 'none';
  }

  function applyStartMapChange() {
    const sel = document.getElementById('map-forge-start-map');
    if (!sel || !_map) return;
    const val = sel.value || 'main';
    if (val !== 'main' && !_map.worlds?.[val]) {
      sel.value = 'main';
      _map.startMapId = 'main';
      setStatus('Start map world missing.', true);
      return;
    }
    _map.startMapId = val;
    populateStartMapSelect();
  }

  function editStartMap() {
    if (!_map) return;
    const startId = resolveMapStartMapId(_map);
    if (startId === 'main' || !_map.worlds?.[startId]) {
      setStatus('Select a world as the run start first.', true);
      return;
    }
    pushHistory();
    _editContext = startId;
    _selectedId = null;
    _selectedIds = [];
    syncBreadcrumb();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Editing start map ' + (_map.worlds[startId]?.name || startId));
  }

  function editWorldMap() {
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    if (!n || n.type !== 'world' || !n.worldId) return;
    pushHistory();
    _editContext = n.worldId;
    _selectedId = null;
    _selectedIds = [];
    syncBreadcrumb();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Editing ' + (_map.worlds[n.worldId]?.name || n.worldId));
  }

  function exitWorldEditor() {
    pushHistory();
    _editContext = 'main';
    _selectedId = null;
    _selectedIds = [];
    _map = normalizeMap(_map);
    syncBreadcrumb();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
  }

  function loadMap(map) {
    try {
      _map = normalizeMap(Object.assign(createEmptyMap(), map || {}));
      _editContext = 'main';
      _selectedId = null;
      const nameEl = document.getElementById('map-forge-name');
      if (nameEl) nameEl.value = _map.name || '';
      const pathEl = document.getElementById('map-forge-path-reveal');
      if (pathEl) pathEl.checked = _map.pathReveal !== false;
      renderDraftSelect();
      renderNodeList();
      renderForgeCanvas();
      syncNodeEditorFields();
      syncBreadcrumb();
      _actionStatusUntil = 0;
      refreshForgeUI();
      markSavedFingerprint();
      pushHistory();
    } catch (err) {
      reportForgeError('Failed to load map', err);
    }
  }

  function saveMapForgeDraft() {
    if (!_map) return;
    applyNodeFieldChanges();
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    const err = validateMap(_map);
    if (err) { setStatus('Cannot save: ' + err, true); return; }
    const payload = buildExportPayload(_map);
    const drafts = readDrafts();
    const idx = drafts.findIndex((d) => d.id === payload.id);
    if (idx >= 0) drafts[idx] = payload; else drafts.push(payload);
    if (!writeDrafts(drafts)) return;
    setCurrentDraftId(payload.id);
    _map = payload;
    renderDraftSelect();
    markSavedFingerprint();
    setStatus('Draft saved.');
  }

  function exportMapForge() {
    applyNodeFieldChanges();
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    const err = validateMap(_map);
    if (err) { setStatus(err, true); return; }
    const payload = buildExportPayload(_map);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'avian-map-' + slugName(payload.name) + '-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setStatus('Map exported.');
  }

  function importMapForgeFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadMap(JSON.parse(String(reader.result || '')));
        setStatus('Map imported.');
      } catch (_) { setStatus('Could not read map file.', true); }
    };
    reader.readAsText(file);
  }

  function playtestMapForge() {
    applyNodeFieldChanges();
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    const err = validateMap(_map);
    if (err) { setStatus(err, true); return; }
    const payload = buildExportPayload(_map);
    if (!global.persistCustomOverworldMap(payload)) { setStatus('Could not store map for playtest.', true); return; }
    if (global.setCustomOverworldMode) global.setCustomOverworldMode('playtest');
    seedRunProgressToStart(payload);
    global.location.href = 'blackstone_overworld_new.html?playtest=1';
  }

  function activateMapForNextRun() {
    applyNodeFieldChanges();
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    const err = validateMap(_map);
    if (err) { setStatus(err, true); return false; }
    const payload = buildExportPayload(_map);
    if (!global.persistCustomOverworldMap(payload)) { setStatus('Could not activate map.', true); return false; }
    if (global.setCustomOverworldMode) global.setCustomOverworldMode('run');
    seedRunProgressToStart(payload);
    setStatus('Map active for your next story run (starts on ' + resolveMapStartMapId(payload) + ').');
    return true;
  }

  function populateForgeSelects() {
    const terrainSel = document.getElementById('map-forge-terrain-select');
    if (terrainSel && !terrainSel.dataset.populated) {
      terrainSel.dataset.populated = '1';
      terrainSel.innerHTML = '';
      (global.FORGE_TERRAIN_PRESETS || []).forEach((p) => {
        const o = document.createElement('option');
        o.value = p.terrain;
        o.textContent = p.label;
        terrainSel.appendChild(o);
      });
      const custom = document.createElement('option');
      custom.value = '__custom__';
      custom.textContent = 'Custom…';
      terrainSel.appendChild(custom);
      terrainSel.addEventListener('change', () => {
        const customEl = document.getElementById('map-forge-terrain-custom');
        if (customEl) customEl.style.display = terrainSel.value === '__custom__' ? '' : 'none';
        applyNodeFieldChanges();
        syncTerrainPicker(getSelectedNode());
      });
    }
    const portraitSel = document.getElementById('map-forge-portrait-bird');
    if (portraitSel && !portraitSel.dataset.populated) {
      portraitSel.dataset.populated = '1';
      portraitSel.innerHTML = '<option value="">- Default -</option>';
      (global.getForgeBirdOptions ? global.getForgeBirdOptions() : []).forEach((b) => {
        if (b.id === 'random') return;
        const o = document.createElement('option');
        o.value = b.id;
        o.textContent = b.label;
        portraitSel.appendChild(o);
      });
      portraitSel.addEventListener('change', applyNodeFieldChanges);
    }
    document.querySelectorAll('[data-forge-filter]').forEach((btn) => {
      if (btn.dataset.forgeFilterWired === '1') return;
      btn.dataset.forgeFilterWired = '1';
      btn.addEventListener('click', () => {
        _nodeListFilter = btn.getAttribute('data-forge-filter') || 'all';
        document.querySelectorAll('[data-forge-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
        renderNodeList();
      });
    });
    const snapEl = document.getElementById('map-forge-snap-grid');
    if (snapEl && snapEl.dataset.forgeWired !== '1') {
      snapEl.dataset.forgeWired = '1';
      snapEl.addEventListener('change', (e) => {
        _snapGrid = !!e.target.checked;
        renderForgeCanvas();
      });
    }
    const terrainCustom = document.getElementById('map-forge-terrain-custom');
    if (terrainCustom && terrainCustom.dataset.forgeWired !== '1') {
      terrainCustom.dataset.forgeWired = '1';
      terrainCustom.addEventListener('change', applyNodeFieldChanges);
    }
    const worldRename = document.getElementById('map-forge-world-rename');
    if (worldRename && worldRename.dataset.forgeWired !== '1') {
      worldRename.dataset.forgeWired = '1';
      worldRename.addEventListener('change', applyWorldRename);
    }
  }

  function applyWorldRename() {
    if (_editContext === 'main') return;
    const el = document.getElementById('map-forge-world-rename');
    const w = _map?.worlds?.[_editContext];
    if (!el || !w) return;
    const name = el.value.trim() || w.name;
    w.name = name;
    const worldNode = _map.nodes.find((n) => n.type === 'world' && n.worldId === _editContext);
    if (worldNode) worldNode.name = name;
    syncBreadcrumb();
  }

  function getSelectionNodes() {
    const slice = getEditingSlice();
    if (!slice) return [];
    const ids = _selectedIds.length ? _selectedIds : (_selectedId != null ? [_selectedId] : []);
    return ids.map((id) => slice.nodes.find((n) => n.id === id)).filter(Boolean);
  }

  function nudgeSelectedNode(dx, dy) {
    const nodes = getSelectionNodes();
    if (!nodes.length) return;
    pushHistory();
    nodes.forEach((n) => {
      n.x = snapCoord(Math.max(0, Math.min(MAP_W, (n.x || 0) + dx)));
      n.y = snapCoord(Math.max(0, Math.min(MAP_H, (n.y || 0) + dy)));
    });
    renderForgeCanvas();
    renderMinimap();
  }

  function copyMapForgeConfig() {
    const n = getSelectedNode();
    if (!n) { setStatus('Select a node.', true); return; }
    _configClipboard = {
      encounter: n.encounter ? JSON.parse(JSON.stringify(n.encounter)) : null,
      clearRewards: n.clearRewards ? JSON.parse(JSON.stringify(n.clearRewards)) : [],
      bonusConfig: n.bonusConfig ? JSON.parse(JSON.stringify(n.bonusConfig)) : null,
      terrain: n.terrain,
      portraitBird: n.portraitBird,
    };
    setStatus('Node config copied.');
  }

  function pasteMapForgeConfig() {
    const n = getSelectedNode();
    if (!n || !_configClipboard) { setStatus('Nothing to paste.', true); return; }
    pushHistory();
    if (_configClipboard.encounter && global.isForgeCombatNode(n)) n.encounter = JSON.parse(JSON.stringify(_configClipboard.encounter));
    if (_configClipboard.clearRewards && global.isForgeCombatNode(n)) n.clearRewards = JSON.parse(JSON.stringify(_configClipboard.clearRewards));
    if (_configClipboard.bonusConfig && n.type === 'bonus') n.bonusConfig = JSON.parse(JSON.stringify(_configClipboard.bonusConfig));
    if (_configClipboard.terrain && n.type !== 'shop') n.terrain = _configClipboard.terrain;
    if (_configClipboard.portraitBird) n.portraitBird = _configClipboard.portraitBird;
    syncNodeEditorFields();
    setStatus('Config pasted.');
  }

  function applyEncounterPreset(presetKey) {
    const n = getSelectedNode();
    const preset = global.FORGE_ENCOUNTER_PRESETS?.[presetKey];
    if (!n || !preset || !global.isForgeCombatNode(n)) return;
    pushHistory();
    n.encounter = JSON.parse(JSON.stringify(preset));
    if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    renderEncounterPanel();
    setStatus('Preset applied.');
  }

  function bulkSelectAllStages() {
    const slice = getEditingSlice();
    if (!slice) return;
    _bulkChecked = new Set(slice.nodes.filter((n) => n.type === 'stage' || n.type === 'boss' || n.type === 'bonus').map((n) => n.id));
    renderNodeList();
  }

  function bulkApplyEncounter(presetKey) {
    const presetSel = document.getElementById('map-forge-encounter-preset');
    const key = presetKey || presetSel?.value || 'standardStage';
    const preset = global.FORGE_ENCOUNTER_PRESETS?.[key];
    const slice = getEditingSlice();
    if (!slice || !preset) return;
    pushHistory();
    slice.nodes.forEach((n) => {
      if (!_bulkChecked.has(n.id) || !global.isForgeCombatNode(n)) return;
      n.encounter = JSON.parse(JSON.stringify(preset));
      if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    });
    renderNodeList();
    renderEncounterPanel();
    setStatus('Preset applied to checked nodes.');
  }

  function bulkApplyRewards() {
    const n = getSelectedNode();
    const slice = getEditingSlice();
    if (!n?.clearRewards?.length || !slice) { setStatus('Select a node with rewards first.', true); return; }
    pushHistory();
    const rewards = JSON.parse(JSON.stringify(n.clearRewards));
    slice.nodes.forEach((node) => {
      if (!_bulkChecked.has(node.id) || !global.isForgeCombatNode(node)) return;
      node.clearRewards = JSON.parse(JSON.stringify(rewards));
    });
    renderNodeList();
    setStatus('Rewards copied to checked nodes.');
  }

  function addWorldTemplate() {
    if (_editContext === 'main') return;
    const slice = getEditingSlice();
    if (!slice) return;
    pushHistory();
    slice.nodes.length = 0;
    slice.nodes.push(
      { type: 'stage', name: 'Stage 1', x: 768, y: 720, terrain: 'Wilds' },
      { type: 'stage', name: 'Stage 2', x: 768, y: 590, terrain: 'Wilds' },
      { type: 'stage', name: 'Stage 3', x: 768, y: 460, terrain: 'Wilds' },
      { type: 'boss', name: 'World Boss', x: 768, y: 330, terrain: 'Boss Arena' },
      { type: 'return', name: 'Return Gate', x: 768, y: 200 },
    );
    _map = normalizeMap(_map);
    _selectedId = null;
    _selectedIds = [];
    refreshForgeUI();
    setStatus('World template added — place a Spawn via Label → Spawn before save.');
  }

  function seedPlaytestProgress(nodeIndex, mapId) {
    if (global.resetOwCustomProgress) global.resetOwCustomProgress();
    const progress = typeof global.readOwCustomProgress === 'function' ? global.readOwCustomProgress() : { nodeClears: {}, worldsCompleted: {}, bonusRepeats: {}, activeMapId: 'main' };
    const slice = mapId === 'main' ? _map.nodes : (_map.worlds?.[mapId]?.nodes || []);
    for (let i = 0; i < nodeIndex && i < slice.length; i++) {
      const key = global.owNodeKey ? global.owNodeKey(mapId, slice[i].id) : mapId + ':' + slice[i].id;
      progress.nodeClears[key] = true;
    }
    progress.activeMapId = mapId === 'main' ? 'main' : mapId;
    if (typeof global.writeOwCustomProgress === 'function') global.writeOwCustomProgress(progress);
    try {
      global.localStorage.setItem(KEYS.STATE || 'avianAscent_overworld', JSON.stringify({ nodeId: nodeIndex }));
    } catch (_) {}
  }

  function playtestFromSelectedNode() {
    if (_selectedId == null) { setStatus('Select a node to playtest from.', true); return; }
    applyNodeFieldChanges();
    const slice = getEditingSlice();
    const idx = slice?.nodes?.findIndex((n) => n.id === _selectedId) ?? -1;
    if (idx < 0) return;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    const err = validateMap(_map);
    if (err) { setStatus(err, true); return; }
    const payload = buildExportPayload(_map);
    if (!global.persistCustomOverworldMap(payload)) { setStatus('Could not store map.', true); return; }
    if (global.setCustomOverworldMode) global.setCustomOverworldMode('playtest');
    if (global.clearOwMapStack) global.clearOwMapStack();
    seedPlaytestProgress(idx, slice.mapId);
    markSavedFingerprint();
    try { global.localStorage.removeItem(KEYS.NAV || 'avianAscent_nav'); } catch (_) {}
    global.location.href = 'blackstone_overworld_new.html?playtest=1';
  }

  function fightMapForgeNode() {
    const n = getSelectedNode();
    if (!n || !global.isForgeCombatNode(n)) { setStatus('Select a combat node.', true); return; }
    applyNodeFieldChanges();
    if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    const slice = getEditingSlice();
    const scaleStage = slice?.worldIndex != null && global.syntheticStageForWorldNode
      ? global.syntheticStageForWorldNode(slice.worldIndex, n.subStage || 1)
      : (n.stage || 1);
    if (global.persistOwNavIntent) {
      global.persistOwNavIntent({
        action: 'forgeTest',
        encounter: n.encounter,
        clearRewards: n.clearRewards || [],
        terrain: n.terrain || '',
        stage: scaleStage,
        mapId: slice?.mapId || 'main',
        nodeId: n.id,
        isBoss: n.type === 'boss',
        returnTo: 'forge',
      });
    }
    markSavedFingerprint();
    saveMapForgeDraft();
    global.location.href = 'index.html';
  }

  function confirmMapForgeDiscard() {
    document.getElementById('map-forge-unsaved-modal')?.classList.remove('active');
    const fn = _pendingDirtyAction;
    _pendingDirtyAction = null;
    if (fn) fn();
  }

  function cancelMapForgeDiscard() {
    document.getElementById('map-forge-unsaved-modal')?.classList.remove('active');
    _pendingDirtyAction = null;
  }

  function renderBossStatsPanel(n) {
    const panel = document.getElementById('map-forge-boss-stats-panel');
    if (!panel) return;
    const show = n && (n.type === 'boss' || n.final);
    panel.style.display = show ? '' : 'none';
    if (!show) return;
    if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    const slot = n.encounter?.slots?.[0];
    if (!slot) return;
    panel.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'map-forge-field-label';
    title.textContent = 'Boss stats (slot 1)';
    panel.appendChild(title);
    const useCustom = document.createElement('label');
    useCustom.className = 'map-forge-field-check';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!slot.useCustomStats;
    chk.onchange = () => {
      slot.useCustomStats = chk.checked;
      if (chk.checked && !slot.customStats) {
        const prev = global.previewForgeSlotStats?.(slot.birdKey, n.stage || n.subStage || 1, true, slot);
        slot.customStats = prev ? { ...prev } : { maxHp: 100, atk: 10, def: 5, matk: 10, mdef: 5, spd: 6 };
      }
      renderBossStatsPanel(n);
    };
    useCustom.appendChild(chk);
    useCustom.appendChild(document.createTextNode(' Use custom stats'));
    panel.appendChild(useCustom);
    const stage = n.stage || n.subStage || 1;
    const preview = global.previewForgeSlotStats?.(slot.birdKey, stage, true, slot);
    const stats = slot.useCustomStats && slot.customStats ? slot.customStats : preview;
    if (!stats) {
      const hint = document.createElement('p');
      hint.className = 'map-forge-hint';
      hint.textContent = slot.birdKey === 'random'
        ? 'Stats preview unavailable until a species is chosen (not Random).'
        : 'Pick a species and tier/stars to preview stats.';
      panel.appendChild(hint);
      return;
    }
    ['maxHp', 'atk', 'def', 'matk', 'mdef', 'spd'].forEach((key) => {
      const row = document.createElement('label');
      row.className = 'map-forge-boss-stat-row';
      row.textContent = key + ' ';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'map-forge-reward-num';
      inp.value = String(stats[key] ?? 0);
      inp.disabled = !slot.useCustomStats;
      inp.onchange = () => {
        if (!slot.customStats) slot.customStats = { ...stats };
        slot.customStats[key] = Math.max(0, Math.floor(Number(inp.value) || 0));
      };
      row.appendChild(inp);
      panel.appendChild(row);
    });
  }

  function wireMapForge() {
    if (_wired) return;
    _wired = true;
    wireLabelEditorControls();
    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.getAttribute('data-forge-tool')));
    });
    document.getElementById('map-forge-add-reward')?.addEventListener('click', addClearReward);
    document.querySelectorAll('[data-forge-panel-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setSidebarPanel(btn.getAttribute('data-forge-panel-tab')));
    });
    document.getElementById('map-forge-apply-preset')?.addEventListener('click', () => {
      const sel = document.getElementById('map-forge-encounter-preset');
      applyEncounterPreset(sel?.value || 'standardStage');
    });
    document.getElementById('map-forge-path-preview')?.addEventListener('change', (e) => {
      _pathRevealPreview = !!e.target.checked;
      renderForgeCanvas();
    });
    document.getElementById('map-forge-path-reveal')?.addEventListener('change', (e) => {
      if (_map) _map.pathReveal = !!e.target.checked;
    });
    const svg = document.getElementById('map-forge-svg');
    if (svg) {
      svg.addEventListener('mousedown', (e) => {
        const g = e.target.closest('[data-node-id]');
        if (g) {
          const nid = Number(g.getAttribute('data-node-id'));
          if (e.shiftKey || _tool === 'multi') {
            if (_selectedIds.includes(nid)) _selectedIds = _selectedIds.filter((x) => x !== nid);
            else _selectedIds.push(nid);
            _selectedId = _selectedIds[_selectedIds.length - 1] ?? null;
          } else {
            _selectedId = nid;
            _selectedIds = [nid];
            _drag = { id: _selectedId, moved: false };
          }
          renderNodeList();
          renderForgeCanvas();
          syncNodeEditorFields();
          e.preventDefault();
          return;
        }
        if (_tool === 'select' || _tool === 'multi' || e.button === 1 || _spacePan) {
          const picked = e.button === 0 && !_spacePan ? pickNodeAtPoint(svg, e) : null;
          if (picked && e.button === 0 && !_spacePan) {
            if (_tool === 'multi' || e.shiftKey) {
              if (_selectedIds.includes(picked.id)) _selectedIds = _selectedIds.filter((x) => x !== picked.id);
              else _selectedIds.push(picked.id);
              _selectedId = _selectedIds[_selectedIds.length - 1] ?? null;
            } else {
              _selectedId = picked.id;
              _selectedIds = [picked.id];
            }
            renderNodeList();
            renderForgeCanvas();
            syncNodeEditorFields();
            return;
          }
          // Empty canvas (or Space/middle): pan instead of switching tools
          if (e.button === 0 || e.button === 1) {
            e.preventDefault();
            beginPanDrag(e.clientX, e.clientY);
          }
          if (_tool === 'select' && e.button === 0 && !_spacePan && !picked) {
            _selectedId = null;
            _selectedIds = [];
            renderNodeList();
            renderForgeCanvas();
            syncNodeEditorFields();
          }
          return;
        }
        if (e.button === 0) {
          const pt = mapPointFromEvent(svg, e);
          placeNode(pt.x, pt.y);
        }
      });
      global.addEventListener('mousemove', (e) => {
        if (_panDrag) {
          _panX = _panDrag.panX + (e.clientX - _panDrag.x);
          _panY = _panDrag.panY + (e.clientY - _panDrag.y);
          applyCanvasTransform();
          renderMinimap();
          return;
        }
        if (!_drag) return;
        const slice = getEditingSlice();
        const n = slice?.nodes?.find((x) => x.id === _drag.id);
        if (!n) return;
        const pt = mapPointFromEvent(svg, e);
        if (Math.abs(pt.x - n.x) > 2 || Math.abs(pt.y - n.y) > 2) _drag.moved = true;
        n.x = pt.x;
        n.y = pt.y;
        renderForgeCanvas();
        renderMinimap();
      });
      global.addEventListener('mouseup', () => {
        if (_drag?.moved) {
          pushHistory();
          _map = normalizeMap(_map);
        }
        _drag = null;
        endPanDrag();
      });
    }
    const canvasWrap = document.getElementById('map-forge-canvas-wrap');
    canvasWrap?.addEventListener('mousedown', (e) => {
      if (!document.getElementById('screen-map-forge')?.classList.contains('active')) return;
      // Middle-click, Space+LMB, or empty-canvas select drag handled via svg; wrap catches bg/padding
      if (e.button === 1 || (_spacePan && e.button === 0) || ((_tool === 'select' || _tool === 'multi') && e.button === 0 && !e.target.closest('[data-node-id]'))) {
        // Avoid double-start when svg already began pan; only pan from wrap non-svg hits
        if (e.target.closest('#map-forge-svg') && !_spacePan && e.button === 0) return;
        e.preventDefault();
        beginPanDrag(e.clientX, e.clientY);
      }
    });
    canvasWrap?.addEventListener('wheel', (e) => {
      if (!document.getElementById('screen-map-forge')?.classList.contains('active')) return;
      e.preventDefault();
      const rect = canvasWrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const prevZoom = _zoom;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      _zoom = Math.max(0.25, Math.min(3, _zoom * delta));
      _panX = mx - (mx - _panX) * (_zoom / prevZoom);
      _panY = my - (my - _panY) * (_zoom / prevZoom);
      applyCanvasTransform();
      renderMinimap();
    }, { passive: false });
    document.getElementById('map-forge-minimap')?.addEventListener('click', (e) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * MAP_W;
      const my = ((e.clientY - rect.top) / rect.height) * MAP_H;
      const wrap = document.getElementById('map-forge-canvas-wrap');
      if (!wrap) return;
      const wrect = wrap.getBoundingClientRect();
      _panX = wrect.width / 2 - mx * (_zoom * wrect.width / MAP_W);
      _panY = wrect.height / 2 - my * (_zoom * wrect.height / MAP_H);
      applyCanvasTransform();
      renderMinimap();
    });
    global.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.getElementById('screen-map-forge')?.classList.contains('active')) {
        _spacePan = true;
        document.getElementById('map-forge-canvas-wrap')?.classList.add('is-space-pan');
      }
    });
    global.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        _spacePan = false;
        document.getElementById('map-forge-canvas-wrap')?.classList.remove('is-space-pan');
      }
    });
    document.getElementById('map-forge-upload')?.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const slice = getEditingSlice();
        if (!slice) return;
        if (_editContext === 'main') _map.backgroundDataUrl = String(reader.result || '');
        else if (_map.worlds[_editContext]) _map.worlds[_editContext].backgroundDataUrl = String(reader.result || '');
        pushHistory();
        renderForgeCanvas();
        renderValidationPanel();
        setStatus('Background uploaded.');
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
    document.getElementById('map-forge-import')?.addEventListener('change', function () {
      importMapForgeFile(this.files && this.files[0]);
      this.value = '';
    });
    document.getElementById('map-forge-draft-select')?.addEventListener('change', function () {
      const val = this.value;
      const prev = this.dataset.prev || '';
      const run = () => {
        if (!val) { loadMap(createEmptyMap()); setCurrentDraftId(''); return; }
        const draft = readDrafts().find((d) => d.id === val);
        if (draft) { loadMap(draft); setCurrentDraftId(val); }
        this.dataset.prev = val;
      };
      if (prev && prev !== val && isMapForgeDirty()) {
        this.value = prev;
        confirmDirtyThen(() => { this.value = val; run(); this.dataset.prev = val; });
      } else {
        run();
        this.dataset.prev = val;
      }
    });
    document.getElementById('map-forge-node-type')?.addEventListener('change', (e) => {
      const typeKey = e.target.value;
      if (!convertSelectedNodeType(typeKey)) {
        const n = getSelectedNode();
        e.target.value = getNodeTypeSelectValue(n);
      }
    });
    ['map-forge-node-name', 'map-forge-node-final'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', applyNodeFieldChanges);
    });
    document.getElementById('map-forge-name')?.addEventListener('change', function () {
      if (_map) _map.name = this.value.trim() || 'Untitled Map';
    });
    document.getElementById('map-forge-start-map')?.addEventListener('change', applyStartMapChange);
    if (!_autoSaveTimer) {
      _autoSaveTimer = global.setInterval(() => {
        if (!document.getElementById('screen-map-forge')?.classList.contains('active')) return;
        if (!isMapForgeDirty() || !_map) return;
        if (validateMap(_map)) return;
        saveMapForgeDraft();
      }, 60000);
    }
    global.addEventListener('keydown', (e) => {
      const forgeScreen = document.getElementById('screen-map-forge');
      if (!forgeScreen?.classList.contains('active')) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedNode(); return; }
      if (e.key === 'Escape') { deselectNode(); return; }
      if (e.key === 's' || e.key === 'S') { setTool('select'); return; }
      if (e.key === 'm' || e.key === 'M') { setTool('multi'); return; }
      if (e.key === 'l' || e.key === 'L') { setTool('label'); return; }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); duplicateSelectedNode(); return; }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoMapForge(); return; }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoMapForge(); return; }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); copyMapForgeConfig(); return; }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); pasteMapForgeConfig(); return; }
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeSelectedNode(-step, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudgeSelectedNode(step, 0); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); nudgeSelectedNode(0, -step); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudgeSelectedNode(0, step); return; }
    });
  }

  let _autoSaveTimer = null;

  function mapForgeZoomFit() { fitAllNodes(); }
  function mapForgeZoom100() { _zoom = 1; _panX = 0; _panY = 0; applyCanvasTransform(); renderMinimap(); }
  function mapForgeZoom200() { _zoom = 2; applyCanvasTransform(); renderMinimap(); }

  function initMapForge() {
    wireMapForge();
    populateForgeSelects();
    const curId = getCurrentDraftId();
    const draft = curId ? readDrafts().find((d) => d.id === curId) : null;
    loadMap(draft || createEmptyMap());
    if (curId && draft) setCurrentDraftId(curId);
    setTool('select');
    mapForgeZoomFit();
  }

  function openMapForge(opts) {
    if (global.isBuildNestUnlocked && !global.isBuildNestUnlocked()) {
      const msg = 'Build Nest is locked. Enter the unlock code on the war room first.';
      setStatus(msg, true);
      if (typeof global.pushErrorHUD === 'function') global.pushErrorHUD('MapForge', msg);
      return;
    }
    try {
      if (global.showScreen) global.showScreen('screen-map-forge');
      wireMapForge();
      populateForgeSelects();
      if (opts?.skipReload && _map) {
        refreshForgeUI();
        return;
      }
      initMapForge();
    } catch (err) {
      reportForgeError('Failed to open Map Forge', err);
    }
  }

  function closeMapForge() {
    confirmDirtyThen(() => {
      if (global.showScreen) global.showScreen('screen-select');
      if (global.initSelectionSafe) global.initSelectionSafe();
    });
  }

  function newMapForge() {
    confirmDirtyThen(() => {
      loadMap(createEmptyMap());
      setCurrentDraftId('');
      renderDraftSelect();
      setStatus('New map.');
    });
  }

  function loadCurrentStoryMapIntoForge() {
    confirmDirtyThen(() => {
      const picked = getCurrentStoryMapForForge();
      if (!picked?.map) {
        setStatus('No story map is available to load.', true);
        return;
      }
      const map = picked.map;
      const originalName = map.name || 'Story Map';
      map.id = mkId();
      map.createdAt = new Date().toISOString();
      map.name = originalName + ' Edit';
      setCurrentDraftId('');
      loadMap(map);
      renderDraftSelect();
      setStatus((picked.source === 'active' ? 'Active' : 'Built-in') + ' story map loaded as a new Forge draft.');
      mapForgeZoomFit();
    });
  }

  global.initMapForge = initMapForge;
  global.openMapForge = openMapForge;
  global.closeMapForge = closeMapForge;
  global.saveMapForgeDraft = saveMapForgeDraft;
  global.exportMapForge = exportMapForge;
  global.playtestMapForge = playtestMapForge;
  global.activateMapForNextRun = activateMapForNextRun;
  global.deleteMapForgeNode = deleteSelectedNode;
  global.newMapForge = newMapForge;
  global.loadCurrentStoryMapIntoForge = loadCurrentStoryMapIntoForge;
  global.setMapForgeTool = setTool;
  global.editWorldMap = editWorldMap;
  global.editStartMap = editStartMap;
  global.resolveMapStartMapId = resolveMapStartMapId;
  global.exitWorldEditor = exitWorldEditor;
  global.deselectMapForgeNode = deselectNode;
  global.duplicateMapForgeNode = duplicateSelectedNode;
  global.undoMapForge = undoMapForge;
  global.redoMapForge = redoMapForge;
  global.playtestFromSelectedNode = playtestFromSelectedNode;
  global.fightMapForgeNode = fightMapForgeNode;
  global.confirmMapForgeDiscard = confirmMapForgeDiscard;
  global.cancelMapForgeDiscard = cancelMapForgeDiscard;
  global.copyMapForgeConfig = copyMapForgeConfig;
  global.pasteMapForgeConfig = pasteMapForgeConfig;
  global.applyEncounterPreset = applyEncounterPreset;
  global.bulkSelectAllStages = bulkSelectAllStages;
  global.bulkApplyEncounter = () => {
    const sel = document.getElementById('map-forge-encounter-preset');
    bulkApplyEncounter(sel?.value || 'standardStage');
  };
  global.bulkApplyRewards = bulkApplyRewards;
  global.addWorldTemplate = addWorldTemplate;
  global.mapForgeZoomFit = mapForgeZoomFit;
  global.mapForgeZoom100 = mapForgeZoom100;
  global.mapForgeZoom200 = mapForgeZoom200;

  if (global.Avian?.actions) {
    Object.assign(global.Avian.actions, {
      openMapForge, closeMapForge, saveMapForgeDraft, exportMapForge,
      playtestMapForge, activateMapForNextRun, deleteMapForgeNode: deleteSelectedNode,
      newMapForge, loadCurrentStoryMapIntoForge, editWorldMap, editStartMap, exitWorldEditor,
      deselectMapForgeNode: deselectNode, duplicateMapForgeNode: duplicateSelectedNode,
      undoMapForge, redoMapForge, playtestFromSelectedNode, fightMapForgeNode,
      confirmMapForgeDiscard, cancelMapForgeDiscard,
      copyMapForgeConfig, pasteMapForgeConfig, applyEncounterPreset,
      bulkSelectAllStages, bulkApplyEncounter, bulkApplyRewards, addWorldTemplate,
      mapForgeZoomFit, mapForgeZoom100, mapForgeZoom200,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
