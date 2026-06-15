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
  let _tool = 'stage';
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
      nodes: [{ id: 0, type: 'start', name: 'Spawn', x: 1211, y: 764, stage: 0 }],
    });
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
    catch (_) { setStatus('Could not save draft — storage may be full.', true); return false; }
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
            nodes: [
              { id: 0, type: 'start', name: 'World Start', x: 768, y: 800, stage: 0 },
              { id: 1, type: 'return', name: 'Return Gate', x: 768, y: 200 },
            ],
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

  function applyLabelRole(n, role) {
    if (!n || n.type !== 'label') return;
    if (global.ensureLabelConfig) global.ensureLabelConfig(n);
    const cfg = n.labelConfig;
    if (role === 'uiButton') {
      cfg.actsAsNode = false;
      if (!cfg.uiAction || cfg.uiAction === 'none') cfg.uiAction = 'nest';
      const labels = global.OW_MAP_UI_ACTION_LABELS || {};
      if (!cfg.text || cfg.text === 'Label') cfg.text = labels[cfg.uiAction] || 'Button';
      if (cfg.shape === 'rounded' || !cfg.shape) cfg.shape = 'pill';
    } else if (role === 'nodeProxy') {
      cfg.uiAction = 'none';
      cfg.actsAsNode = true;
      if (!cfg.mimicType || cfg.mimicType === 'none') cfg.mimicType = 'stage';
    } else {
      cfg.uiAction = 'none';
      cfg.actsAsNode = false;
    }
    if (global.ensureLabelConfig) global.ensureLabelConfig(n);
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

  function syncForgeValidationStatus(issues) {
    if (Date.now() < _actionStatusUntil) return;
    const list = Array.isArray(issues) ? issues : getValidationIssues();
    const errors = list.filter((i) => i.severity === 'error');
    const warnings = list.filter((i) => i.severity === 'warning');
    const el = document.getElementById('map-forge-status');
    if (!el) return;
    if (errors.length) {
      const hint = isEmptyDraft(_map) ? 'New map — upload a background, then place Stage nodes. ' : '';
      const first = errors[0].message || '';
      const extra = errors.length > 1 ? ' (+' + (errors.length - 1) + ' more)' : '';
      el.textContent = hint + errors.length + (errors.length === 1 ? ' issue: ' : ' issues — ') + first + extra;
      el.classList.remove('map-forge-status--warn');
      el.style.color = 'var(--red-light, #ff9090)';
      return;
    }
    if (warnings.length) {
      const first = warnings[0].message || '';
      const extra = warnings.length > 1 ? ' (+' + (warnings.length - 1) + ' more)' : '';
      el.textContent = warnings.length + (warnings.length === 1 ? ' warning: ' : ' warnings — ') + first + extra;
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
    if (nodes.filter((n) => n.type === 'start').length !== 1) return 'Exactly one Spawn node required.';
    if (nodes[0].type !== 'start') return 'First node must be Spawn.';
    if (!nodes.some((n) => n.type === 'stage' || n.type === 'boss')) return 'Add at least one Stage or Boss.';
    if (!map.backgroundDataUrl) return 'Upload a background image first.';
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

  function formatVariantSummary(enemyId) {
    const row = (typeof global.getEnemyRosterRow === 'function' ? global.getEnemyRosterRow(enemyId) : null)
      || (typeof global.getRosterRow === 'function' ? global.getRosterRow(enemyId) : null);
    if (!row) return '';
    let t = row.fantasyTitle || row.name || enemyId;
    if (row.storyLevel) t += ' · Lv.' + row.storyLevel;
    return t;
  }

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

  function ensureNodeClearRewards(n) {
    if (!n || !global.isForgeCombatNode || !global.isForgeCombatNode(n)) return;
    if (!Array.isArray(n.clearRewards) && n.bonusConfig?.rewards?.length) {
      n.clearRewards = JSON.parse(JSON.stringify(n.bonusConfig.rewards));
      delete n.bonusConfig.rewards;
    }
    if (!Array.isArray(n.clearRewards)) n.clearRewards = [];
  }

  function renderClearRewardsList(n) {
    const list = document.getElementById('map-forge-clear-reward-list');
    if (!list) return;
    ensureNodeClearRewards(n);
    list.innerHTML = '';
    const cardTiers = global.OW_CARD_TIER_MUTATION_OPTIONS || [];
    const itemKeys = ['freshWater', 'sugarWater', 'honeyWater'];
    const itemLabels = { freshWater: 'Fresh Water', sugarWater: 'Bird Seed', honeyWater: 'Honey Water' };
    const birdOpts = global.getForgeBirdOptions ? global.getForgeBirdOptions() : [{ id: 'random', label: 'Random' }];
    const appendRemove = (row, i) => {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = '×';
      rm.className = 'map-forge-node-move';
      rm.onclick = () => { n.clearRewards.splice(i, 1); renderClearRewardsList(n); };
      row.appendChild(rm);
      list.appendChild(row);
    };
    (n.clearRewards || []).forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'map-forge-clear-reward-row';
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
        countIn.onchange = () => { r.count = Math.max(1, Math.min(11, Math.floor(Number(countIn.value) || 1))); };
        row.appendChild(lbl);
        row.appendChild(tierSel);
        row.appendChild(countIn);
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
        itemKeys.forEach((k) => {
          const o = document.createElement('option');
          o.value = k;
          o.textContent = itemLabels[k] || k;
          if ((r.itemKey || 'freshWater') === k) o.selected = true;
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
      } else if (r.type === 'savedEggs' || r.type === 'goldenGoose') {
        const lbl = document.createElement('span');
        lbl.className = 'map-forge-reward-type-label';
        lbl.textContent = r.type === 'savedEggs' ? 'Saved Eggs' : 'Golden Goose Egg';
        const countIn = document.createElement('input');
        countIn.type = 'number';
        countIn.className = 'map-forge-reward-num';
        countIn.min = '0';
        countIn.value = String(r.count ?? 1);
        countIn.onchange = () => { r.count = Math.max(0, Math.floor(Number(countIn.value) || 0)); };
        row.appendChild(lbl);
        row.appendChild(countIn);
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
      }
      appendRemove(row, i);
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
    sel.innerHTML = '<option value="">— New map —</option>';
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
    const rewardsPanel = document.getElementById('map-forge-clear-rewards-panel');
    if (!isCombat) {
      panel.style.display = 'none';
      if (rewardsPanel) rewardsPanel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    if (global.ensureNodeEncounter) global.ensureNodeEncounter(n);
    const countEl = document.getElementById('map-forge-enemy-count');
    const rowsEl = document.getElementById('map-forge-encounter-rows');
    const bonusEl = document.getElementById('map-forge-bonus-panel');
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

        const variantWrap = document.createElement('label');
        variantWrap.className = 'map-forge-encounter-field map-forge-encounter-field--wide';
        variantWrap.textContent = 'Variant';
        const variantSel = document.createElement('select');
        variantSel.className = 'map-forge-field-input';
        const variants = typeof global.listEnemyVariantsForBird === 'function'
          ? global.listEnemyVariantsForBird(slot.birdKey, slot.enemyLevel || 1, { isBoss: isBossNode })
          : [{ id: '', label: 'Random variant (this species)' }];
        variants.forEach((v) => {
          const o = document.createElement('option');
          o.value = v.id;
          o.textContent = v.label;
          if ((slot.enemyId || '') === v.id) o.selected = true;
          variantSel.appendChild(o);
        });
        variantSel.onchange = () => {
          const vid = variantSel.value;
          if (vid) slot.enemyId = vid;
          else delete slot.enemyId;
          renderEncounterPanel();
        };
        variantWrap.appendChild(variantSel);
        grid.appendChild(variantWrap);

        if (slot.enemyId) {
          const summary = document.createElement('div');
          summary.className = 'map-forge-variant-summary';
          summary.textContent = formatVariantSummary(slot.enemyId);
          variantWrap.appendChild(summary);
        }

        const levelWrap = document.createElement('label');
        levelWrap.className = 'map-forge-encounter-field';
        levelWrap.textContent = 'Level';
        const levelSel = document.createElement('select');
        levelSel.className = 'map-forge-field-input';
        for (let lv = 1; lv <= 20; lv++) {
          const o = document.createElement('option');
          o.value = String(lv);
          o.textContent = 'Lv ' + lv;
          if ((slot.enemyLevel || 1) === lv) o.selected = true;
          levelSel.appendChild(o);
        }
        levelSel.onchange = () => {
          const newLv = Math.max(1, Math.min(20, Math.floor(Number(levelSel.value) || 1)));
          const prevId = slot.enemyId;
          slot.enemyLevel = newLv;
          if (prevId) {
            const row = (typeof global.getEnemyRosterRow === 'function' ? global.getEnemyRosterRow(prevId) : null)
              || (typeof global.getRosterRow === 'function' ? global.getRosterRow(prevId) : null);
            if (!row || Number(row.storyLevel) !== newLv) delete slot.enemyId;
          }
          renderEncounterPanel();
        };
        levelWrap.appendChild(levelSel);
        grid.appendChild(levelWrap);

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
          hint.textContent = 'Level and mutations apply when a random roster bird is rolled at runtime.';
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
    if (rewardsPanel) {
      rewardsPanel.style.display = '';
      renderClearRewardsList(n);
    }
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
      label.textContent = '#' + n.id + ' ' + typeLabel + (lbl ? ' · ' + lbl : '') + (n.name ? ' — ' + n.name : '');
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
    const roleEl = document.getElementById('map-forge-label-role');
    const mimicEl = document.getElementById('map-forge-label-mimic');
    const uiActionEl = document.getElementById('map-forge-label-ui-action');
    const proxyWrap = document.getElementById('map-forge-label-proxy-wrap');
    const uiWrap = document.getElementById('map-forge-label-ui-wrap');
    const uiHint = document.getElementById('map-forge-label-ui-hint');
    const textEl = document.getElementById('map-forge-label-text');
    const shapeEl = document.getElementById('map-forge-label-shape');
    const widthEl = document.getElementById('map-forge-label-width');
    const heightEl = document.getElementById('map-forge-label-height');
    const showTextEl = document.getElementById('map-forge-label-show-text');
    const showBorderEl = document.getElementById('map-forge-label-show-border');
    const showFillEl = document.getElementById('map-forge-label-show-fill');

    if (roleEl) roleEl.value = role;
    if (proxyWrap) proxyWrap.style.display = role === 'nodeProxy' ? '' : 'none';
    if (uiWrap) uiWrap.style.display = role === 'uiButton' ? '' : 'none';
    if (mimicEl) mimicEl.value = cfg.mimicType || 'stage';
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

    document.getElementById('map-forge-label-role')?.addEventListener('change', (e) => {
      const n = getSelectedLabelNode();
      if (!n) return;
      applyLabelRole(n, e.target.value);
      renderLabelEditorPanel(n);
      renderValidationPanel();
      renderForgeCanvas();
      pushHistory();
    });

    document.getElementById('map-forge-label-mimic')?.addEventListener('change', (e) => {
      const n = getSelectedLabelNode();
      if (!n?.labelConfig) return;
      n.labelConfig.mimicType = e.target.value;
      renderForgeCanvas();
      pushHistory();
    });

    document.getElementById('map-forge-label-ui-action')?.addEventListener('change', (e) => {
      const n = getSelectedLabelNode();
      if (!n?.labelConfig) return;
      const cfg = n.labelConfig;
      const prev = cfg.uiAction;
      cfg.uiAction = e.target.value || 'nest';
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
    if (!n || n.type === 'start' || n.type === 'return') {
      editor.style.display = 'none';
      renderLabelEditorPanel(null);
      renderEncounterPanel();
      syncBreadcrumb();
      return;
    }
    const isOverworld = n.type === 'overworld';
    editor.style.display = '';
    const isLabel = n.type === 'label';
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
    if (nameEl) nameEl.value = n.name || '';
    if (isOverworld) {
      if (terrainLabel) terrainLabel.style.display = 'none';
      if (terrainSel) terrainSel.style.display = 'none';
      if (terrainCustom) terrainCustom.style.display = 'none';
      if (portraitLabel) portraitLabel.style.display = 'none';
      if (portraitEl) portraitEl.style.display = 'none';
      if (arenaPreview) arenaPreview.style.display = 'none';
      if (finalEl) finalEl.closest('label').style.display = 'none';
    } else if (isLabel) {
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
    wrap.classList.toggle('is-grab-tool', _tool === 'pan');
    if (_tool !== 'pan') wrap.classList.remove('is-panning');
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
    _tool = tool;
    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-forge-tool') === tool);
    });
    syncForgeCanvasCursor();
  }

  function placeNode(x, y) {
    pushHistory();
    const slice = getEditingSlice();
    if (!slice) return;
    if (_tool === 'start') {
      if (slice.nodes.some((n) => n.type === 'start')) { setStatus('Only one Spawn node allowed.', true); return; }
      slice.nodes.unshift({ id: 0, type: 'start', name: 'Spawn', x, y, stage: 0 });
    } else if (_tool === 'world' && _editContext === 'main') {
      _worldCounter += 1;
      const wid = 'world' + _worldCounter;
      slice.nodes.push({ type: 'world', name: 'World ' + _worldCounter, worldId: wid, x, y });
      _map.worlds[wid] = {
        name: 'World ' + _worldCounter,
        worldIndex: _worldCounter,
        backgroundDataUrl: '',
        nodes: [
          { id: 0, type: 'start', name: 'World Start', x: 768, y: 800, stage: 0 },
          { id: 1, type: 'return', name: 'Return Gate', x: 768, y: 150 },
        ],
      };
    } else {
      const base = { x, y, name: _tool === 'shop' ? 'Stork Emporium' : _tool === 'bonus' ? 'Bonus Stage' : _tool === 'boss' ? 'Boss Stage' : _tool === 'return' ? 'Return Gate' : 'Stage' };
      if (_tool === 'shop') slice.nodes.push(Object.assign(base, { type: 'shop' }));
      else if (_tool === 'bonus') slice.nodes.push(Object.assign(base, { type: 'bonus', terrain: 'Bonus Arena', bonusConfig: { powerProgression: true, maxRepeats: 5 }, clearRewards: [{ type: 'shinies', min: 15, max: 30 }] }));
      else if (_tool === 'boss') slice.nodes.push(Object.assign(base, { type: 'boss', terrain: 'Boss Arena' }));
      else if (_tool === 'return') slice.nodes.push(Object.assign(base, { type: 'return' }));
      else if (_tool === 'overworld') slice.nodes.push(Object.assign(base, { type: 'overworld', name: 'Overworld Gate' }));
      else if (_tool === 'label') {
        const labelCfg = typeof global.defaultLabelConfig === 'function' ? global.defaultLabelConfig() : {
          text: 'Label', mimicType: 'stage', shape: 'rounded', width: 80, height: 36,
          showText: true, showBorder: true, showFill: true, actsAsNode: false,
        };
        labelCfg.text = 'Label';
        slice.nodes.push(Object.assign(base, { type: 'label', name: 'Label', labelConfig: labelCfg }));
      }
      else slice.nodes.push(Object.assign(base, { type: 'stage', terrain: 'Wilds' }));
    }
    _map = normalizeMap(_map);
    _selectedId = slice.nodes[slice.nodes.length - 1]?.id ?? 0;
    _selectedIds = [_selectedId];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('');
  }

  function deleteSelectedNode() {
    const slice = getEditingSlice();
    if (_selectedId == null) { setStatus('Select a node to delete.', true); return; }
    const idx = slice?.nodes?.findIndex((x) => x.id === _selectedId) ?? -1;
    if (idx < 0) { setStatus('Select a node to delete.', true); return; }
    const n = slice.nodes[idx];
    if (n.type === 'start') { setStatus('Cannot delete Spawn node.', true); return; }
    pushHistory();
    slice.nodes.splice(idx, 1);
    if (n.type === 'world' && n.worldId && _map.worlds[n.worldId]) delete _map.worlds[n.worldId];
    _map = normalizeMap(_map);
    _selectedId = null;
    _selectedIds = [];
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Node deleted.');
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
          nodes: [
            { id: 0, type: 'start', name: 'World Start', x: 768, y: 800, stage: 0 },
            { id: 1, type: 'return', name: 'Return Gate', x: 768, y: 150 },
          ],
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
    if (type === 'shinies') n.clearRewards.push({ type: 'shinies', min: 10, max: 25 });
    else if (type === 'mutation') n.clearRewards.push({ type: 'mutation', tierBand: 'blue', count: 1 });
    else if (type === 'nest') n.clearRewards.push({ type: 'nest', slots: [{ tier: 'blue' }] });
    else if (type === 'item') n.clearRewards.push({ type: 'item', itemKey: 'freshWater', min: 1, max: 1 });
    else if (type === 'savedEggs') n.clearRewards.push({ type: 'savedEggs', count: 1 });
    else if (type === 'goldenGoose') n.clearRewards.push({ type: 'goldenGoose', count: 1 });
    else if (type === 'speciesFeathers') n.clearRewards.push({ type: 'speciesFeathers', birdKey: 'random', count: 1 });
    renderClearRewardsList(n);
  }

  function addShinyReward() { addClearReward(); }
  function addMutReward() { addClearReward(); }

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
    const payload = buildExportPayload(_map);
    const drafts = readDrafts();
    const idx = drafts.findIndex((d) => d.id === payload.id);
    if (idx >= 0) drafts[idx] = payload; else drafts.push(payload);
    if (!writeDrafts(drafts)) return;
    setCurrentDraftId(payload.id);
    _map = payload;
    renderDraftSelect();
    markSavedFingerprint();
    setStatus(err ? 'Draft saved (incomplete): ' + err : 'Draft saved.');
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
    if (global.resetOwCustomProgress) global.resetOwCustomProgress();
    if (global.clearOwMapStack) global.clearOwMapStack();
    try {
      global.localStorage.setItem(KEYS.STATE || 'avianAscent_overworld', JSON.stringify({ nodeId: 0 }));
      global.localStorage.removeItem(KEYS.NAV || 'avianAscent_nav');
    } catch (_) {}
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
    if (global.resetOwCustomProgress) global.resetOwCustomProgress();
    if (global.clearOwMapStack) global.clearOwMapStack();
    setStatus('Map active for your next story run.');
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
      portraitSel.innerHTML = '<option value="">— Default —</option>';
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

  function alignSelection(mode) {
    const nodes = getSelectionNodes();
    if (nodes.length < 1) { setStatus('Select node(s) to align.', true); return; }
    pushHistory();
    if (mode === 'left') { const v = Math.min(...nodes.map((n) => n.x)); nodes.forEach((n) => { n.x = v; }); }
    else if (mode === 'right') { const v = Math.max(...nodes.map((n) => n.x)); nodes.forEach((n) => { n.x = v; }); }
    else if (mode === 'centerH') { const v = nodes.reduce((s, n) => s + n.x, 0) / nodes.length; nodes.forEach((n) => { n.x = Math.round(v); }); }
    else if (mode === 'top') { const v = Math.min(...nodes.map((n) => n.y)); nodes.forEach((n) => { n.y = v; }); }
    else if (mode === 'bottom') { const v = Math.max(...nodes.map((n) => n.y)); nodes.forEach((n) => { n.y = v; }); }
    else if (mode === 'centerV') { const v = nodes.reduce((s, n) => s + n.y, 0) / nodes.length; nodes.forEach((n) => { n.y = Math.round(v); }); }
    renderForgeCanvas();
    renderMinimap();
  }

  function distributeSelection(axis) {
    const nodes = getSelectionNodes();
    if (nodes.length < 3) { setStatus('Select 3+ nodes to distribute.', true); return; }
    pushHistory();
    const sorted = nodes.slice().sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = axis === 'h' ? last.x - first.x : last.y - first.y;
    const step = span / (sorted.length - 1);
    sorted.forEach((n, i) => {
      if (axis === 'h') n.x = Math.round(first.x + step * i);
      else n.y = Math.round(first.y + step * i);
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
      { type: 'start', name: 'World Start', x: 768, y: 850, stage: 0 },
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
    setStatus('World template added.');
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
      hint.textContent = slot.birdKey === 'random' && !slot.enemyId
        ? 'Stats preview unavailable until species or variant is pinned.'
        : 'Pick a specific bird to preview stats.';
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
        if (_tool === 'pan' && e.button === 0) {
          e.preventDefault();
          beginPanDrag(e.clientX, e.clientY);
          return;
        }
        const g = e.target.closest('[data-node-id]');
        if (g) {
          const nid = Number(g.getAttribute('data-node-id'));
          if (e.shiftKey) {
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
        if (_tool === 'select') {
          const picked = pickNodeAtPoint(svg, e);
          _selectedId = picked ? picked.id : null;
          _selectedIds = picked ? [picked.id] : [];
          renderNodeList();
          renderForgeCanvas();
          syncNodeEditorFields();
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
      if (e.button === 1 || (_spacePan && e.button === 0) || (_tool === 'pan' && e.button === 0)) {
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
    ['map-forge-node-name', 'map-forge-node-final'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', applyNodeFieldChanges);
    });
    document.getElementById('map-forge-name')?.addEventListener('change', function () {
      if (_map) _map.name = this.value.trim() || 'Untitled Map';
    });
    if (!_autoSaveTimer) {
      _autoSaveTimer = global.setInterval(() => {
        if (!document.getElementById('screen-map-forge')?.classList.contains('active')) return;
        if (isMapForgeDirty()) saveMapForgeDraft();
      }, 60000);
    }
    global.addEventListener('keydown', (e) => {
      const forgeScreen = document.getElementById('screen-map-forge');
      if (!forgeScreen?.classList.contains('active')) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const toolKeys = { '1': 'stage', '2': 'boss', '3': 'bonus', '4': 'world', '5': 'shop', '6': 'return', '7': 'start', '8': 'label', '9': 'overworld' };
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelectedNode(); return; }
      if (e.key === 'Escape') { deselectNode(); return; }
      if (e.key === 's' || e.key === 'S') { setTool('select'); return; }
      if (e.key === 'h' || e.key === 'H') { setTool('pan'); return; }
      if (toolKeys[e.key]) { setTool(toolKeys[e.key]); return; }
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

  global.initMapForge = initMapForge;
  global.openMapForge = openMapForge;
  global.closeMapForge = closeMapForge;
  global.saveMapForgeDraft = saveMapForgeDraft;
  global.exportMapForge = exportMapForge;
  global.playtestMapForge = playtestMapForge;
  global.activateMapForNextRun = activateMapForNextRun;
  global.deleteMapForgeNode = deleteSelectedNode;
  global.newMapForge = newMapForge;
  global.setMapForgeTool = setTool;
  global.editWorldMap = editWorldMap;
  global.exitWorldEditor = exitWorldEditor;
  global.deselectMapForgeNode = deselectNode;
  global.duplicateMapForgeNode = duplicateSelectedNode;
  global.addMapForgeShinyReward = addShinyReward;
  global.addMapForgeMutReward = addMutReward;
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
  global.alignMapForgeLeft = () => alignSelection('left');
  global.alignMapForgeRight = () => alignSelection('right');
  global.alignMapForgeCenterH = () => alignSelection('centerH');
  global.alignMapForgeTop = () => alignSelection('top');
  global.alignMapForgeBottom = () => alignSelection('bottom');
  global.alignMapForgeCenterV = () => alignSelection('centerV');
  global.distributeMapForgeH = () => distributeSelection('h');
  global.distributeMapForgeV = () => distributeSelection('v');

  if (global.Avian?.actions) {
    Object.assign(global.Avian.actions, {
      openMapForge, closeMapForge, saveMapForgeDraft, exportMapForge,
      playtestMapForge, activateMapForNextRun, deleteMapForgeNode: deleteSelectedNode,
      newMapForge, editWorldMap, exitWorldEditor,
      deselectMapForgeNode: deselectNode, duplicateMapForgeNode: duplicateSelectedNode,
      addMapForgeShinyReward: addShinyReward, addMapForgeMutReward: addMutReward,
      undoMapForge, redoMapForge, playtestFromSelectedNode, fightMapForgeNode,
      confirmMapForgeDiscard, cancelMapForgeDiscard,
      copyMapForgeConfig, pasteMapForgeConfig, applyEncounterPreset,
      bulkSelectAllStages, bulkApplyEncounter, bulkApplyRewards, addWorldTemplate,
      mapForgeZoomFit, mapForgeZoom100, mapForgeZoom200,
      alignMapForgeLeft: global.alignMapForgeLeft, alignMapForgeRight: global.alignMapForgeRight,
      alignMapForgeCenterH: global.alignMapForgeCenterH, alignMapForgeTop: global.alignMapForgeTop,
      alignMapForgeBottom: global.alignMapForgeBottom, alignMapForgeCenterV: global.alignMapForgeCenterV,
      distributeMapForgeH: global.distributeMapForgeH, distributeMapForgeV: global.distributeMapForgeV,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
