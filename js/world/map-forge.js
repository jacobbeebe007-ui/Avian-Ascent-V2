/**
 * Map Forge — in-game overworld map editor (BuildNest unlock).
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
  };
  const NVC_FINAL = { ring: '#7820a0', glow: 'rgba(120,32,160,.42)', r: 31 };

  let _map = null;
  let _tool = 'stage';
  let _selectedId = null;
  let _drag = null;
  let _wired = false;

  function mkId() {
    return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function slugName(name) {
    return String(name || 'map')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'map';
  }

  function createEmptyMap() {
    return {
      schemaVersion: 1,
      id: mkId(),
      name: 'Untitled Map',
      createdAt: new Date().toISOString(),
      mapWidth: MAP_W,
      mapHeight: MAP_H,
      backgroundDataUrl: '',
      maxStage: 0,
      nodes: [
        { id: 0, type: 'start', name: 'The Nest', x: 1211, y: 764, stage: 0 },
      ],
    };
  }

  function readDrafts() {
    try {
      const raw = global.localStorage.getItem(DRAFTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function writeDrafts(list) {
    try {
      global.localStorage.setItem(DRAFTS_KEY, JSON.stringify(list));
      return true;
    } catch (err) {
      setStatus('Could not save draft — storage may be full.', true);
      return false;
    }
  }

  function getCurrentDraftId() {
    try {
      return global.localStorage.getItem(CURRENT_ID_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function setCurrentDraftId(id) {
    try {
      if (id) global.localStorage.setItem(CURRENT_ID_KEY, id);
      else global.localStorage.removeItem(CURRENT_ID_KEY);
    } catch (_) {}
  }

  function recomputeStages(nodes) {
    let combat = 0;
    for (const n of nodes) {
      if (n.type === 'start') {
        n.stage = 0;
      } else if (n.type === 'shop') {
        delete n.stage;
      } else if (n.type === 'stage' || n.type === 'boss') {
        combat += 1;
        n.stage = combat;
        if (n.type === 'boss' && n.final) {
          /* keep final flag */
        }
      }
    }
    return combat;
  }

  function normalizeMap(map) {
    const copy = Object.assign({}, map);
    copy.schemaVersion = 1;
    copy.mapWidth = MAP_W;
    copy.mapHeight = MAP_H;
    copy.nodes = typeof global.normalizeOwMapNodes === 'function'
      ? global.normalizeOwMapNodes(copy.nodes || [])
      : (copy.nodes || []).map((n, i) => Object.assign({}, n, { id: i }));
    copy.maxStage = recomputeStages(copy.nodes);
    return copy;
  }

  function setStatus(msg, isError) {
    const el = document.getElementById('map-forge-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? 'var(--red-light, #ff9090)' : 'var(--text-dim, #9a9488)';
  }

  function validateMap(map) {
    const nodes = map?.nodes || [];
    if (!nodes.length) return 'Add at least one node.';
    const starts = nodes.filter((n) => n.type === 'start');
    if (starts.length !== 1) return 'Exactly one Start node is required (first in path order).';
    if (nodes[0].type !== 'start') return 'The first node must be Start.';
    const combat = nodes.filter((n) => n.type === 'stage' || n.type === 'boss');
    if (!combat.length) return 'Add at least one Stage or Boss node.';
    if (!map.backgroundDataUrl) return 'Upload a background image first.';
    return null;
  }

  function buildExportPayload(map) {
    const normalized = normalizeMap(map);
    return {
      schemaVersion: 1,
      id: normalized.id,
      name: normalized.name,
      createdAt: normalized.createdAt || new Date().toISOString(),
      mapWidth: MAP_W,
      mapHeight: MAP_H,
      backgroundDataUrl: normalized.backgroundDataUrl || '',
      maxStage: normalized.maxStage,
      nodes: normalized.nodes.map((n) => {
        const out = {
          id: n.id,
          type: n.type,
          name: n.name || '',
          x: n.x,
          y: n.y,
        };
        if (n.type === 'start') out.stage = 0;
        else if (n.type === 'shop') { /* no stage */ }
        else {
          out.stage = n.stage;
          if (n.terrain) out.terrain = n.terrain;
          if (n.portraitBird) out.portraitBird = n.portraitBird;
        }
        if (n.final) out.final = true;
        return out;
      }),
    };
  }

  function nvc(n) {
    return n.final ? NVC_FINAL : NVC[n.type] || NVC.stage;
  }

  function mapPointFromEvent(svg, e) {
    const rect = svg.getBoundingClientRect();
    const sx = MAP_W / rect.width;
    const sy = MAP_H / rect.height;
    const x = Math.round(Math.max(0, Math.min(MAP_W, (e.clientX - rect.left) * sx)));
    const y = Math.round(Math.max(0, Math.min(MAP_H, (e.clientY - rect.top) * sy)));
    return { x, y };
  }

  function renderDraftSelect() {
    const sel = document.getElementById('map-forge-draft-select');
    if (!sel) return;
    const drafts = readDrafts();
    const cur = getCurrentDraftId();
    sel.innerHTML = '<option value="">— New map —</option>';
    drafts.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name || d.id;
      if (d.id === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderNodeList() {
    const list = document.getElementById('map-forge-node-list');
    if (!list || !_map) return;
    list.innerHTML = '';
    _map.nodes.forEach((n) => {
      const row = document.createElement('div');
      row.className = 'map-forge-node-row' + (n.id === _selectedId ? ' is-selected' : '');
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'map-forge-node-pick';
      label.dataset.nodeId = String(n.id);
      const typeLabel = n.type === 'boss' && n.final ? 'final boss' : n.type;
      const stageTxt = n.type === 'shop' ? '' : n.type === 'start' ? '' : ` · S${n.stage}`;
      label.textContent = `#${n.id} ${typeLabel}${stageTxt}${n.name ? ' — ' + n.name : ''}`;
      label.addEventListener('click', () => {
        _selectedId = n.id;
        renderNodeList();
        renderForgeCanvas();
        syncNodeEditorFields();
      });
      row.appendChild(label);
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'map-forge-node-move';
      up.textContent = '↑';
      up.title = 'Move up';
      up.disabled = n.id <= 0;
      up.addEventListener('click', (ev) => {
        ev.stopPropagation();
        moveNode(n.id, -1);
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'map-forge-node-move';
      down.textContent = '↓';
      down.title = 'Move down';
      down.disabled = n.id >= _map.nodes.length - 1;
      down.addEventListener('click', (ev) => {
        ev.stopPropagation();
        moveNode(n.id, 1);
      });
      row.appendChild(up);
      row.appendChild(down);
      list.appendChild(row);
    });
  }

  function syncNodeEditorFields() {
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    const nameEl = document.getElementById('map-forge-node-name');
    const terrainEl = document.getElementById('map-forge-node-terrain');
    const finalEl = document.getElementById('map-forge-node-final');
    const editor = document.getElementById('map-forge-node-editor');
    if (!editor) return;
    if (!n || n.type === 'start') {
      editor.style.display = 'none';
      return;
    }
    editor.style.display = '';
    if (nameEl) nameEl.value = n.name || '';
    if (terrainEl) terrainEl.value = n.terrain || '';
    if (finalEl) {
      finalEl.checked = !!n.final;
      finalEl.disabled = n.type !== 'boss';
      finalEl.closest('label').style.display = n.type === 'boss' ? '' : 'none';
    }
  }

  function moveNode(id, dir) {
    const idx = _map.nodes.findIndex((n) => n.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= _map.nodes.length) return;
    const tmp = _map.nodes[idx];
    _map.nodes[idx] = _map.nodes[next];
    _map.nodes[next] = tmp;
    _map = normalizeMap(_map);
    _selectedId = _map.nodes[next].id;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
  }

  function renderForgeCanvas() {
    const bg = document.getElementById('map-forge-bg');
    const svg = document.getElementById('map-forge-svg');
    if (!svg || !_map) return;
    if (bg) {
      bg.src = _map.backgroundDataUrl || '';
      bg.style.display = _map.backgroundDataUrl ? 'block' : 'none';
    }
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);

    const pathG = document.createElementNS(SVG_NS, 'g');
    for (let i = 0; i < _map.nodes.length - 1; i++) {
      const a = _map.nodes[i];
      const b = _map.nodes[i + 1];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(a.x));
      line.setAttribute('y1', String(a.y));
      line.setAttribute('x2', String(b.x));
      line.setAttribute('y2', String(b.y));
      line.setAttribute('stroke', '#887018');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '0.75');
      pathG.appendChild(line);
    }
    svg.appendChild(pathG);

    _map.nodes.forEach((n) => {
      const vc = nvc(n);
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('data-node-id', String(n.id));
      g.style.cursor = 'grab';
      if (n.id === _selectedId) {
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
      txt.setAttribute('font-size', n.type === 'boss' ? '10' : '9');
      txt.setAttribute('fill', vc.ring);
      txt.style.pointerEvents = 'none';
      if (n.type === 'shop') txt.textContent = '$';
      else if (n.type === 'start') txt.textContent = '⌂';
      else if (n.type === 'boss' || n.type === 'stage') txt.textContent = String(n.stage || '');
      g.appendChild(txt);
      svg.appendChild(g);
    });
  }

  function applyNodeFieldChanges() {
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    if (!n) return;
    const nameEl = document.getElementById('map-forge-node-name');
    const terrainEl = document.getElementById('map-forge-node-terrain');
    const finalEl = document.getElementById('map-forge-node-final');
    if (nameEl) n.name = nameEl.value.trim() || n.name;
    if (terrainEl && n.type !== 'shop') n.terrain = terrainEl.value.trim();
    if (finalEl && n.type === 'boss') {
      if (finalEl.checked) {
        _map.nodes.forEach((x) => { if (x.type === 'boss') delete x.final; });
        n.final = true;
      } else {
        delete n.final;
      }
    }
    _map = normalizeMap(_map);
    renderNodeList();
    renderForgeCanvas();
  }

  function setTool(tool) {
    _tool = tool;
    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-forge-tool') === tool);
    });
  }

  function placeNode(x, y) {
    if (_tool === 'start') {
      if (_map.nodes.some((n) => n.type === 'start')) {
        setStatus('Only one Start node allowed.', true);
        return;
      }
      _map.nodes.unshift({ id: 0, type: 'start', name: 'The Nest', x, y, stage: 0 });
    } else {
      const base = {
        x,
        y,
        name: _tool === 'shop' ? 'Stork Emporium' : _tool === 'boss' ? 'Boss Stage' : 'Stage',
      };
      if (_tool === 'shop') {
        _map.nodes.push(Object.assign(base, { type: 'shop' }));
      } else if (_tool === 'boss') {
        _map.nodes.push(Object.assign(base, { type: 'boss', terrain: 'Boss Arena' }));
      } else {
        _map.nodes.push(Object.assign(base, { type: 'stage', terrain: 'Wilds' }));
      }
    }
    _map = normalizeMap(_map);
    _selectedId = _map.nodes[_map.nodes.length - 1]?.id ?? 0;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('');
  }

  function deleteSelectedNode() {
    if (_selectedId == null) return;
    const n = _map.nodes.find((x) => x.id === _selectedId);
    if (!n || n.type === 'start') {
      setStatus('Cannot delete the Start node.', true);
      return;
    }
    _map.nodes = _map.nodes.filter((x) => x.id !== _selectedId);
    _map = normalizeMap(_map);
    _selectedId = null;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Node removed.');
  }

  function loadMap(map) {
    _map = normalizeMap(Object.assign(createEmptyMap(), map || {}));
    _selectedId = null;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) nameEl.value = _map.name || '';
    renderDraftSelect();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('');
  }

  function saveMapForgeDraft() {
    if (!_map) return;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    applyNodeFieldChanges();
    const err = validateMap(_map);
    if (err) {
      setStatus('Draft saved with warnings: ' + err, true);
    }
    const payload = buildExportPayload(_map);
    const drafts = readDrafts();
    const idx = drafts.findIndex((d) => d.id === payload.id);
    if (idx >= 0) drafts[idx] = payload;
    else drafts.push(payload);
    if (!writeDrafts(drafts)) return;
    setCurrentDraftId(payload.id);
    _map = payload;
    renderDraftSelect();
    setStatus(err ? 'Draft saved (incomplete).' : 'Draft saved.');
  }

  function exportMapForge() {
    if (!_map) return;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    applyNodeFieldChanges();
    const err = validateMap(_map);
    if (err) {
      setStatus(err, true);
      return;
    }
    const payload = buildExportPayload(_map);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `avian-map-${slugName(payload.name)}-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Map exported.');
  }

  function importMapForgeFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!parsed.nodes) throw new Error('Invalid map file');
        loadMap(parsed);
        setStatus('Map imported.');
      } catch (_) {
        setStatus('Could not read map file.', true);
      }
    };
    reader.readAsText(file);
  }

  function playtestMapForge() {
    if (!_map) return;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    applyNodeFieldChanges();
    const err = validateMap(_map);
    if (err) {
      setStatus(err, true);
      return;
    }
    const payload = buildExportPayload(_map);
    if (typeof global.persistCustomOverworldMap === 'function') {
      if (!global.persistCustomOverworldMap(payload)) {
        setStatus('Could not store map for playtest (storage full?).', true);
        return;
      }
    }
    if (typeof global.setCustomOverworldMode === 'function') global.setCustomOverworldMode('playtest');
    try {
      global.localStorage.setItem(KEYS.STATE || 'avianAscent_overworld', JSON.stringify({ nodeId: 0 }));
      global.localStorage.removeItem(KEYS.NAV || 'avianAscent_nav');
    } catch (_) {}
    global.location.href = 'blackstone_overworld_new.html?playtest=1';
  }

  function activateMapForNextRun() {
    if (!_map) return;
    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) _map.name = nameEl.value.trim() || 'Untitled Map';
    applyNodeFieldChanges();
    const err = validateMap(_map);
    if (err) {
      setStatus(err, true);
      return false;
    }
    const payload = buildExportPayload(_map);
    if (typeof global.persistCustomOverworldMap === 'function') {
      if (!global.persistCustomOverworldMap(payload)) {
        setStatus('Could not activate map (storage full?).', true);
        return false;
      }
    }
    if (typeof global.setCustomOverworldMode === 'function') global.setCustomOverworldMode('run');
    setStatus('Map active for your next story run.');
    return true;
  }

  function wireMapForge() {
    if (_wired) return;
    _wired = true;

    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.getAttribute('data-forge-tool')));
    });

    const svg = document.getElementById('map-forge-svg');
    if (svg) {
      svg.addEventListener('mousedown', (e) => {
        const g = e.target.closest('[data-node-id]');
        if (g) {
          const id = Number(g.getAttribute('data-node-id'));
          _selectedId = id;
          _drag = { id, moved: false };
          renderNodeList();
          renderForgeCanvas();
          syncNodeEditorFields();
          e.preventDefault();
          return;
        }
        if (e.button === 0 && _tool !== 'select') {
          const pt = mapPointFromEvent(svg, e);
          placeNode(pt.x, pt.y);
        }
      });
      global.addEventListener('mousemove', (e) => {
        if (!_drag || !_map) return;
        const n = _map.nodes.find((x) => x.id === _drag.id);
        if (!n) return;
        const pt = mapPointFromEvent(svg, e);
        if (Math.abs(pt.x - n.x) > 2 || Math.abs(pt.y - n.y) > 2) _drag.moved = true;
        n.x = pt.x;
        n.y = pt.y;
        renderForgeCanvas();
      });
      global.addEventListener('mouseup', () => {
        if (_drag?.moved) _map = normalizeMap(_map);
        _drag = null;
      });
    }

    const upload = document.getElementById('map-forge-upload');
    if (upload) {
      upload.addEventListener('change', () => {
        const file = upload.files && upload.files[0];
        if (!file) return;
        if (file.size > 4 * 1024 * 1024) {
          setStatus('Large image (>4MB) — export may be heavy; saving to drafts could fail.', true);
        }
        const reader = new FileReader();
        reader.onload = () => {
          if (_map) {
            _map.backgroundDataUrl = String(reader.result || '');
            renderForgeCanvas();
            setStatus('Background uploaded.');
          }
        };
        reader.readAsDataURL(file);
        upload.value = '';
      });
    }

    const importInput = document.getElementById('map-forge-import');
    if (importInput) {
      importInput.addEventListener('change', () => {
        const file = importInput.files && importInput.files[0];
        importMapForgeFile(file);
        importInput.value = '';
      });
    }

    const draftSel = document.getElementById('map-forge-draft-select');
    if (draftSel) {
      draftSel.addEventListener('change', () => {
        const id = draftSel.value;
        if (!id) {
          loadMap(createEmptyMap());
          setCurrentDraftId('');
          return;
        }
        const draft = readDrafts().find((d) => d.id === id);
        if (draft) {
          loadMap(draft);
          setCurrentDraftId(id);
        }
      });
    }

    ['map-forge-node-name', 'map-forge-node-terrain', 'map-forge-node-final'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyNodeFieldChanges);
    });

    const nameEl = document.getElementById('map-forge-name');
    if (nameEl) {
      nameEl.addEventListener('change', () => {
        if (_map) _map.name = nameEl.value.trim() || 'Untitled Map';
      });
    }
  }

  function initMapForge() {
    wireMapForge();
    const curId = getCurrentDraftId();
    const draft = curId ? readDrafts().find((d) => d.id === curId) : null;
    loadMap(draft || createEmptyMap());
    if (curId && draft) setCurrentDraftId(curId);
    setTool('stage');
  }

  function openMapForge() {
    if (typeof global.isBuildNestUnlocked === 'function' && !global.isBuildNestUnlocked()) return;
    if (typeof global.showScreen === 'function') global.showScreen('screen-map-forge');
    initMapForge();
  }

  function closeMapForge() {
    if (typeof global.showScreen === 'function') global.showScreen('screen-select');
    if (typeof global.initSelectionSafe === 'function') global.initSelectionSafe();
  }

  function newMapForge() {
    loadMap(createEmptyMap());
    setCurrentDraftId('');
    renderDraftSelect();
    setStatus('New map.');
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

  if (global.Avian && global.Avian.actions) {
    global.Avian.actions.openMapForge = openMapForge;
    global.Avian.actions.closeMapForge = closeMapForge;
    global.Avian.actions.saveMapForgeDraft = saveMapForgeDraft;
    global.Avian.actions.exportMapForge = exportMapForge;
    global.Avian.actions.playtestMapForge = playtestMapForge;
    global.Avian.actions.activateMapForNextRun = activateMapForNextRun;
    global.Avian.actions.deleteMapForgeNode = deleteSelectedNode;
    global.Avian.actions.newMapForge = newMapForge;
  }
})(typeof window !== 'undefined' ? window : globalThis);
