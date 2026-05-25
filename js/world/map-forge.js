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

  function mkId() {
    return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function slugName(name) {
    return String(name || 'map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
  }

  function createEmptyMap() {
    return global.upgradeMapToV2({
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
      nodes: [{ id: 0, type: 'start', name: 'The Nest', x: 1211, y: 764, stage: 0 }],
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
      return Array.isArray(JSON.parse(raw || '[]')) ? JSON.parse(raw) : [];
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
      else if (n.type === 'shop' || n.type === 'world' || n.type === 'bonus' || n.type === 'return') {
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
    let copy = global.upgradeMapToV2 ? global.upgradeMapToV2(Object.assign({}, map)) : Object.assign({}, map);
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

  function setStatus(msg, isError) {
    const el = document.getElementById('map-forge-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = isError ? 'var(--red-light, #ff9090)' : 'var(--text-dim, #9a9488)';
  }

  function validateMap(map) {
    const nodes = map?.nodes || [];
    if (!nodes.length) return 'Add at least one node.';
    if (nodes.filter((n) => n.type === 'start').length !== 1) return 'Exactly one Start node required.';
    if (nodes[0].type !== 'start') return 'First node must be Start.';
    if (!nodes.some((n) => n.type === 'stage' || n.type === 'boss')) return 'Add at least one Stage or Boss.';
    if (!map.backgroundDataUrl) return 'Upload a background image first.';
    return null;
  }

  function serializeNode(n, worldIndex) {
    const out = { id: n.id, type: n.type, name: n.name || '', x: n.x, y: n.y };
    if (n.type === 'start') out.stage = 0;
    else if (n.type === 'world') out.worldId = n.worldId;
    else if (n.type === 'shop' || n.type === 'return') { /* no stage */ }
    else {
      if (worldIndex != null && n.subStage) out.subStage = n.subStage;
      else if (n.stage) out.stage = n.stage;
      if (n.terrain) out.terrain = n.terrain;
      if (n.portraitBird) out.portraitBird = n.portraitBird;
    }
    if (n.final) out.final = true;
    if (n.encounter) out.encounter = JSON.parse(JSON.stringify(n.encounter));
    if (n.bonusConfig) out.bonusConfig = JSON.parse(JSON.stringify(n.bonusConfig));
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
    return n.final ? NVC_FINAL : NVC[n.type] || NVC.stage;
  }

  function nodeLabel(n, worldIndex) {
    if (typeof global.getNodeDisplayLabel === 'function') return global.getNodeDisplayLabel(n, worldIndex);
    return n.name || n.type;
  }

  function mapPointFromEvent(svg, e) {
    const rect = svg.getBoundingClientRect();
    const sx = MAP_W / rect.width;
    const sy = MAP_H / rect.height;
    return {
      x: Math.round(Math.max(0, Math.min(MAP_W, (e.clientX - rect.left) * sx))),
      y: Math.round(Math.max(0, Math.min(MAP_H, (e.clientY - rect.top) * sy))),
    };
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
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    if (editBtn) editBtn.style.display = (_editContext === 'main' && n?.type === 'world') ? '' : 'none';
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
    if (!isCombat) {
      panel.style.display = 'none';
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
      const birds = global.getForgeBirdOptions ? global.getForgeBirdOptions() : [{ id: 'random', label: 'Random' }];
      const bands = global.OW_MUTATION_BAND_OPTIONS || [];
      n.encounter.slots.forEach((slot, idx) => {
        const row = document.createElement('div');
        row.className = 'map-forge-encounter-row';
        const birdSel = document.createElement('select');
        birdSel.className = 'map-forge-field-input';
        birds.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = 'Bird ' + (idx + 1) + ': ' + b.label;
          if (slot.birdKey === b.id) o.selected = true;
          birdSel.appendChild(o);
        });
        birdSel.onchange = () => { slot.birdKey = birdSel.value; };
        const bandSel = document.createElement('select');
        bandSel.className = 'map-forge-field-input';
        bands.forEach((b) => {
          const o = document.createElement('option');
          o.value = b.id;
          o.textContent = b.label;
          if (slot.mutationBand === b.id) o.selected = true;
          bandSel.appendChild(o);
        });
        bandSel.onchange = () => { slot.mutationBand = bandSel.value; };
        const mutSel = document.createElement('select');
        mutSel.className = 'map-forge-field-input';
        for (let m = 0; m <= 11; m++) {
          const o = document.createElement('option');
          o.value = String(m);
          o.textContent = 'Mutations: ' + m;
          if (slot.maxMutations === m) o.selected = true;
          mutSel.appendChild(o);
        }
        mutSel.onchange = () => { slot.maxMutations = Math.floor(Number(mutSel.value) || 0); };
        row.appendChild(birdSel);
        row.appendChild(bandSel);
        row.appendChild(mutSel);
        rowsEl.appendChild(row);
      });
    }
    if (bonusEl) {
      const showBonus = n.type === 'bonus';
      bonusEl.style.display = showBonus ? '' : 'none';
      if (showBonus) {
        if (!n.bonusConfig) {
          n.bonusConfig = { powerProgression: true, maxRepeats: 5, rewards: [{ type: 'shinies', min: 15, max: 30 }] };
        }
        const cfg = n.bonusConfig;
        const powEl = document.getElementById('map-forge-bonus-power');
        const repEl = document.getElementById('map-forge-bonus-repeats');
        if (powEl) { powEl.checked = !!cfg.powerProgression; powEl.onchange = () => { cfg.powerProgression = powEl.checked; }; }
        if (repEl) {
          repEl.value = String(cfg.maxRepeats || 5);
          repEl.onchange = () => { cfg.maxRepeats = Math.max(1, Math.min(20, Math.floor(Number(repEl.value) || 5))); };
        }
        const rewardsEl = document.getElementById('map-forge-bonus-rewards');
        if (rewardsEl && !rewardsEl.dataset.wired) {
          rewardsEl.dataset.wired = '1';
          document.getElementById('map-forge-bonus-add-shiny')?.addEventListener('click', () => {
            cfg.rewards = cfg.rewards || [];
            cfg.rewards.push({ type: 'shinies', min: 10, max: 25 });
            renderEncounterPanel();
          });
          document.getElementById('map-forge-bonus-add-mut')?.addEventListener('click', () => {
            cfg.rewards = cfg.rewards || [];
            cfg.rewards.push({ type: 'mutation', tierBand: 'blue_purple' });
            renderEncounterPanel();
          });
        }
        const list = document.getElementById('map-forge-bonus-reward-list');
        if (list) {
          list.innerHTML = '';
          (cfg.rewards || []).forEach((r, i) => {
            const li = document.createElement('div');
            li.className = 'map-forge-bonus-reward-row';
            li.textContent = r.type === 'shinies'
              ? 'Shinies ' + r.min + '-' + r.max
              : 'Mutation (' + (r.tierBand || 'blue_purple') + ')';
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.textContent = '×';
            rm.className = 'map-forge-node-move';
            rm.onclick = () => { cfg.rewards.splice(i, 1); renderEncounterPanel(); };
            li.appendChild(rm);
            list.appendChild(li);
          });
        }
      }
    }
  }

  function renderNodeList() {
    const list = document.getElementById('map-forge-node-list');
    const slice = getEditingSlice();
    if (!list || !slice) return;
    list.innerHTML = '';
    const wi = slice.worldIndex;
    slice.nodes.forEach((n) => {
      const row = document.createElement('div');
      row.className = 'map-forge-node-row' + (n.id === _selectedId ? ' is-selected' : '');
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'map-forge-node-pick';
      const lbl = nodeLabel(n, wi);
      label.textContent = '#' + n.id + ' ' + (n.type === 'boss' && n.final ? 'final boss' : n.type) + (lbl ? ' · ' + lbl : '') + (n.name ? ' — ' + n.name : '');
      label.onclick = () => {
        _selectedId = n.id;
        renderNodeList();
        renderForgeCanvas();
        syncNodeEditorFields();
        renderEncounterPanel();
      };
      row.appendChild(label);
      ['↑', '↓'].forEach((sym, di) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'map-forge-node-move';
        btn.textContent = sym;
        btn.disabled = di === 0 ? n.id <= 0 : n.id >= slice.nodes.length - 1;
        btn.onclick = (ev) => { ev.stopPropagation(); moveNode(n.id, di === 0 ? -1 : 1); };
        row.appendChild(btn);
      });
      list.appendChild(row);
    });
  }

  function syncNodeEditorFields() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    const editor = document.getElementById('map-forge-node-editor');
    if (!editor) return;
    if (!n || n.type === 'start' || n.type === 'return') {
      editor.style.display = 'none';
      renderEncounterPanel();
      syncBreadcrumb();
      return;
    }
    editor.style.display = '';
    const nameEl = document.getElementById('map-forge-node-name');
    const terrainEl = document.getElementById('map-forge-node-terrain');
    const finalEl = document.getElementById('map-forge-node-final');
    if (nameEl) nameEl.value = n.name || '';
    if (terrainEl) terrainEl.value = n.terrain || '';
    if (finalEl) {
      finalEl.checked = !!n.final;
      finalEl.disabled = n.type !== 'boss';
      finalEl.closest('label').style.display = n.type === 'boss' ? '' : 'none';
    }
    renderEncounterPanel();
    syncBreadcrumb();
  }

  function moveNode(id, dir) {
    const slice = getEditingSlice();
    if (!slice) return;
    const idx = slice.nodes.findIndex((n) => n.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= slice.nodes.length) return;
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
    const pathG = document.createElementNS(SVG_NS, 'g');
    for (let i = 0; i < slice.nodes.length - 1; i++) {
      if (pathReveal && global.isPathSegmentRevealed && !global.isPathSegmentRevealed(slice.nodes, i, fakeProgress, slice.mapId, { worldId: slice.mapId }, true)) continue;
      const a = slice.nodes[i];
      const b = slice.nodes[i + 1];
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
      if (pathReveal && global.isNodeVisibleOnMap && !global.isNodeVisibleOnMap(slice.nodes, ni, fakeProgress, slice.mapId, { worldId: slice.mapId }, true)) return;
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
      txt.setAttribute('font-size', '9');
      txt.setAttribute('fill', vc.ring);
      txt.style.pointerEvents = 'none';
      const sym = { shop: '$', start: '⌂', world: 'W', bonus: '★', return: '↩' };
      txt.textContent = sym[n.type] || nodeLabel(n, slice.worldIndex) || '';
      g.appendChild(txt);
      svg.appendChild(g);
    });
  }

  function applyNodeFieldChanges() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    if (!n) return;
    const nameEl = document.getElementById('map-forge-node-name');
    const terrainEl = document.getElementById('map-forge-node-terrain');
    const finalEl = document.getElementById('map-forge-node-final');
    if (nameEl) n.name = nameEl.value.trim() || n.name;
    if (terrainEl && n.type !== 'shop') n.terrain = terrainEl.value.trim();
    if (finalEl && n.type === 'boss') {
      if (finalEl.checked) {
        slice.nodes.forEach((x) => { if (x.type === 'boss') delete x.final; });
        n.final = true;
      } else delete n.final;
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
    const slice = getEditingSlice();
    if (!slice) return;
    if (_tool === 'start') {
      if (slice.nodes.some((n) => n.type === 'start')) { setStatus('Only one Start node allowed.', true); return; }
      slice.nodes.unshift({ id: 0, type: 'start', name: 'The Nest', x, y, stage: 0 });
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
      else if (_tool === 'bonus') slice.nodes.push(Object.assign(base, { type: 'bonus', terrain: 'Bonus Arena', bonusConfig: { powerProgression: true, maxRepeats: 5, rewards: [{ type: 'shinies', min: 15, max: 30 }] } }));
      else if (_tool === 'boss') slice.nodes.push(Object.assign(base, { type: 'boss', terrain: 'Boss Arena' }));
      else if (_tool === 'return') slice.nodes.push(Object.assign(base, { type: 'return' }));
      else slice.nodes.push(Object.assign(base, { type: 'stage', terrain: 'Wilds' }));
    }
    _map = normalizeMap(_map);
    _selectedId = slice.nodes[slice.nodes.length - 1]?.id ?? 0;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('');
  }

  function deleteSelectedNode() {
    const slice = getEditingSlice();
    const n = slice?.nodes?.find((x) => x.id === _selectedId);
    if (!n || n.type === 'start') { setStatus('Cannot delete Start node.', true); return; }
    slice.nodes = slice.nodes.filter((x) => x.id !== _selectedId);
    if (n.type === 'world' && n.worldId && _map.worlds[n.worldId]) delete _map.worlds[n.worldId];
    _map = normalizeMap(_map);
    _selectedId = null;
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
  }

  function editWorldMap() {
    const n = _map?.nodes?.find((x) => x.id === _selectedId);
    if (!n || n.type !== 'world' || !n.worldId) return;
    _editContext = n.worldId;
    _selectedId = null;
    syncBreadcrumb();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
    setStatus('Editing ' + (_map.worlds[n.worldId]?.name || n.worldId));
  }

  function exitWorldEditor() {
    _editContext = 'main';
    _selectedId = null;
    _map = normalizeMap(_map);
    syncBreadcrumb();
    renderNodeList();
    renderForgeCanvas();
    syncNodeEditorFields();
  }

  function loadMap(map) {
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
    setStatus('');
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

  function wireMapForge() {
    if (_wired) return;
    _wired = true;
    document.querySelectorAll('[data-forge-tool]').forEach((btn) => {
      btn.addEventListener('click', () => setTool(btn.getAttribute('data-forge-tool')));
    });
    document.getElementById('map-forge-edit-world-btn')?.addEventListener('click', editWorldMap);
    document.getElementById('map-forge-world-back')?.addEventListener('click', exitWorldEditor);
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
          _selectedId = Number(g.getAttribute('data-node-id'));
          _drag = { id: _selectedId, moved: false };
          renderNodeList();
          renderForgeCanvas();
          syncNodeEditorFields();
          e.preventDefault();
          return;
        }
        if (e.button === 0) placeNode(mapPointFromEvent(svg, e).x, mapPointFromEvent(svg, e).y);
      });
      global.addEventListener('mousemove', (e) => {
        if (!_drag) return;
        const slice = getEditingSlice();
        const n = slice?.nodes?.find((x) => x.id === _drag.id);
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
    document.getElementById('map-forge-upload')?.addEventListener('change', function () {
      const file = this.files && this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const slice = getEditingSlice();
        if (!slice) return;
        if (_editContext === 'main') _map.backgroundDataUrl = String(reader.result || '');
        else if (_map.worlds[_editContext]) _map.worlds[_editContext].backgroundDataUrl = String(reader.result || '');
        renderForgeCanvas();
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
      if (!this.value) { loadMap(createEmptyMap()); setCurrentDraftId(''); return; }
      const draft = readDrafts().find((d) => d.id === this.value);
      if (draft) { loadMap(draft); setCurrentDraftId(this.value); }
    });
    ['map-forge-node-name', 'map-forge-node-terrain', 'map-forge-node-final'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', applyNodeFieldChanges);
    });
    document.getElementById('map-forge-name')?.addEventListener('change', function () {
      if (_map) _map.name = this.value.trim() || 'Untitled Map';
    });
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
    if (global.isBuildNestUnlocked && !global.isBuildNestUnlocked()) return;
    if (global.showScreen) global.showScreen('screen-map-forge');
    initMapForge();
  }

  function closeMapForge() {
    if (global.showScreen) global.showScreen('screen-select');
    if (global.initSelectionSafe) global.initSelectionSafe();
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
  global.editWorldMap = editWorldMap;
  global.exitWorldEditor = exitWorldEditor;

  if (global.Avian?.actions) {
    Object.assign(global.Avian.actions, {
      openMapForge, closeMapForge, saveMapForgeDraft, exportMapForge,
      playtestMapForge, activateMapForNextRun, deleteMapForgeNode: deleteSelectedNode,
      newMapForge, editWorldMap, exitWorldEditor,
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
