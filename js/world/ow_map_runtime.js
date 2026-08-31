/**
 * Custom overworld map runtime: path reveal, forge encounters, world labels.
 */
(function (global) {
  'use strict';

  global.OW_CARD_TIER_EQUIPMENT_OPTIONS = [
    { id: 'grey', label: 'Grey' },
    { id: 'green', label: 'Green' },
    { id: 'blue', label: 'Blue' },
    { id: 'purple', label: 'Purple' },
    { id: 'gold', label: 'Gold' },
    { id: 'orange', label: 'Orange' },
  ];

  global.OW_EQUIPMENT_BANDS = {
    grey: ['grey'],
    green: ['green'],
    blue: ['blue'],
    purple: ['purple'],
    gold: ['gold'],
    orange: ['orange'],
    grey_green: ['grey', 'green'],
    green_blue: ['green', 'blue'],
    blue_purple: ['blue', 'purple'],
    purple_gold: ['purple', 'gold'],
  };

  global.isForgeCombatNode = function (n) {
    if (!n) return false;
    const t = typeof global.getOwEffectiveNodeType === 'function'
      ? global.getOwEffectiveNodeType(n)
      : n.type;
    return t === 'stage' || t === 'boss' || t === 'bonus' || !!n.final;
  };

  global.isOwSpawnNode = function (n) {
    if (!n) return false;
    if (n.kind === 'start' || n.type === 'start') return true;
    return n.type === 'label'
      && !!(n.labelConfig && n.labelConfig.actsAsNode)
      && n.labelConfig.mimicType === 'start';
  };

  global.nodeHasJobType = function (n, job) {
    if (!n || !job) return false;
    const t = typeof global.getOwEffectiveNodeType === 'function'
      ? global.getOwEffectiveNodeType(n)
      : n.type;
    return t === job;
  };

  global.OW_MAP_UI_ACTIONS = [
    { id: 'none', label: 'None' },
    { id: 'nest', label: 'Nest' },
    { id: 'settings', label: 'Settings' },
    { id: 'reference', label: 'Reference' },
    { id: 'openLocation', label: 'Enter' },
    { id: 'prevNode', label: 'Back' },
    { id: 'nextNode', label: 'Next' },
  ];

  global.OW_MAP_UI_ACTION_LABELS = {
    nest: 'Nest',
    settings: 'Settings',
    reference: 'Reference',
    openLocation: 'Enter',
    prevNode: 'Back',
    nextNode: 'Next',
  };

  global.getOwMapUiAction = function (cfg) {
    const id = String(cfg?.uiAction || 'none').trim();
    if (!id || id === 'none') return '';
    const known = (global.OW_MAP_UI_ACTIONS || []).some((a) => a.id === id);
    return known ? id : '';
  };

  global.defaultLabelConfig = function () {
    return {
      text: '',
      mimicType: 'stage',
      shape: 'rounded',
      width: 80,
      height: 36,
      showText: true,
      showBorder: true,
      showFill: true,
      actsAsNode: false,
      uiAction: 'none',
      opacity: 0.72,
      borderColor: '',
      textColor: '',
    };
  };

  function clampLabelOpacity(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  function normalizeLabelHexColor(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '';
    const m = s.match(/^#?([0-9a-fA-F]{6})$/);
    return m ? ('#' + m[1].toLowerCase()) : '';
  }

  global.normalizeLabelConfigFields = function (cfg, opts) {
    const def = global.defaultLabelConfig();
    const src = cfg && typeof cfg === 'object' ? cfg : {};
    const asLabel = !opts || opts.asLabel !== false;
    const uiAction = asLabel
      ? (global.getOwMapUiAction({ uiAction: src.uiAction }) || 'none')
      : 'none';
    return {
      text: String(src.text != null ? src.text : def.text),
      mimicType: src.mimicType || def.mimicType,
      shape: src.shape || def.shape,
      width: Math.max(16, Math.min(400, Math.floor(Number(src.width) || def.width))),
      height: Math.max(12, Math.min(200, Math.floor(Number(src.height) || def.height))),
      showText: src.showText !== false,
      showBorder: src.showBorder !== false,
      showFill: src.showFill !== false,
      actsAsNode: uiAction !== 'none' ? false : (asLabel ? !!src.actsAsNode : false),
      uiAction,
      opacity: clampLabelOpacity(src.opacity, def.opacity),
      borderColor: normalizeLabelHexColor(src.borderColor),
      textColor: normalizeLabelHexColor(src.textColor),
    };
  };

  global.ensureLabelConfig = function (node) {
    if (!node || node.type !== 'label') return null;
    node.labelConfig = global.normalizeLabelConfigFields(node.labelConfig, { asLabel: true });
    return node.labelConfig;
  };

  /** Appearance styling for any node type (preserves Stage/Boss/etc. gameplay type). */
  global.ensureNodeAppearance = function (node) {
    if (!node) return null;
    if (node.type === 'label') return global.ensureLabelConfig(node);
    const src = node.labelConfig && typeof node.labelConfig === 'object' ? node.labelConfig : {};
    const textFallback = src.text != null && String(src.text) !== ''
      ? src.text
      : (node.name || '');
    node.labelConfig = global.normalizeLabelConfigFields(
      Object.assign({}, src, { text: textFallback, uiAction: 'none', actsAsNode: false }),
      { asLabel: false }
    );
    return node.labelConfig;
  };

  global.nodeUsesLabelAppearance = function (node) {
    return !!(node && node.labelConfig && typeof node.labelConfig === 'object');
  };

  global.isOwPathNode = function (n) {
    if (!n) return false;
    if (n.onPath === false) return false;
    if (n.type === 'label') {
      if (global.getOwMapUiAction(n.labelConfig)) return false;
      return !!(n.labelConfig && n.labelConfig.actsAsNode);
    }
    return true;
  };

  global.getPathNodeIndices = function (nodes) {
    const arr = nodes || [];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      if (global.isOwPathNode(arr[i])) out.push(i);
    }
    return out;
  };

  /** Assign missing pathOrder values from path-node array order (legacy linear maps). */
  global.ensureOwPathOrders = function (nodes) {
    const arr = nodes || [];
    let seq = 0;
    let maxAssigned = -1;
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      if (!n || !global.isOwPathNode(n)) continue;
      if (n.pathOrder != null && Number.isFinite(Number(n.pathOrder))) {
        maxAssigned = Math.max(maxAssigned, Math.floor(Number(n.pathOrder)));
      }
    }
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      if (!n) continue;
      if (!global.isOwPathNode(n)) {
        if (n.pathOrder == null) n.pathOrder = 0;
        continue;
      }
      if (n.pathOrder == null || !Number.isFinite(Number(n.pathOrder))) {
        maxAssigned += 1;
        n.pathOrder = maxAssigned;
      } else {
        n.pathOrder = Math.floor(Number(n.pathOrder));
      }
      seq = Math.max(seq, n.pathOrder);
    }
    return seq;
  };

  global.getOwNodePathOrder = function (n) {
    if (!n) return 0;
    const v = Math.floor(Number(n.pathOrder));
    return Number.isFinite(v) ? v : 0;
  };

  /**
   * Build proximity edges between consecutive pathOrder layers.
   * Returns [{ from, to }] using node ids.
   */
  global.buildOwPathEdges = function (nodes) {
    const arr = nodes || [];
    global.ensureOwPathOrders(arr);
    const byOrder = new Map();
    for (let i = 0; i < arr.length; i++) {
      const n = arr[i];
      if (!global.isOwPathNode(n)) continue;
      const ord = global.getOwNodePathOrder(n);
      if (!byOrder.has(ord)) byOrder.set(ord, []);
      byOrder.get(ord).push(n);
    }
    const orders = Array.from(byOrder.keys()).sort((a, b) => a - b);
    const edges = [];
    const edgeKey = (a, b) => String(a) + '>' + String(b);
    const seen = new Set();

    function addEdge(fromId, toId) {
      const k = edgeKey(fromId, toId);
      if (seen.has(k)) return;
      seen.add(k);
      edges.push({ from: fromId, to: toId });
    }

    function dist2(a, b) {
      const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
      const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
      return dx * dx + dy * dy;
    }

    for (let oi = 0; oi < orders.length - 1; oi++) {
      const parents = byOrder.get(orders[oi]) || [];
      const children = byOrder.get(orders[oi + 1]) || [];
      if (!parents.length || !children.length) continue;

      const childHasParent = children.map(() => false);
      for (let p = 0; p < parents.length; p++) {
        const parent = parents[p];
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < children.length; c++) {
          const d = dist2(parent, children[c]);
          if (d < bestD) { bestD = d; best = c; }
        }
        addEdge(parent.id, children[best].id);
        childHasParent[best] = true;
        if (children.length > 1) {
          let second = -1;
          let secondD = Infinity;
          for (let c = 0; c < children.length; c++) {
            if (c === best) continue;
            const d = dist2(parent, children[c]);
            if (d < secondD) { secondD = d; second = c; }
          }
          if (second >= 0 && secondD <= bestD * 2.25) {
            addEdge(parent.id, children[second].id);
            childHasParent[second] = true;
          }
        }
      }
      for (let c = 0; c < children.length; c++) {
        if (childHasParent[c]) continue;
        let nearest = 0;
        let nearestD = Infinity;
        for (let p = 0; p < parents.length; p++) {
          const d = dist2(parents[p], children[c]);
          if (d < nearestD) { nearestD = d; nearest = p; }
        }
        addEdge(parents[nearest].id, children[c].id);
      }
    }
    return edges;
  };

  global.getOwPathParentIds = function (nodes, nodeId) {
    const edges = global.buildOwPathEdges(nodes);
    const id = Math.max(0, Math.floor(Number(nodeId) || 0));
    return edges.filter((e) => e.to === id).map((e) => e.from);
  };

  global.getOwPathChildIds = function (nodes, nodeId) {
    const edges = global.buildOwPathEdges(nodes);
    const id = Math.max(0, Math.floor(Number(nodeId) || 0));
    return edges.filter((e) => e.from === id).map((e) => e.to);
  };

  global.isOwPathEdgeRevealed = function (nodes, edge, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    if (!edge) return true;
    const arr = nodes || [];
    const from = arr.find((n) => n && n.id === edge.from) || arr[edge.from];
    if (!from) return true;
    return global.isOwSegmentSourceCleared(from, progress, mapId, mapDef);
  };

  /** True when every mustComplete node on the slice is cleared (or none marked). */
  global.areOwMustCompleteNodesCleared = function (nodes, mapId, progress) {
    const arr = nodes || [];
    const required = arr.filter((n) => n && n.mustComplete);
    if (!required.length) return true;
    const prog = progress || {};
    return required.every((n) => {
      const eff = global.getOwEffectiveNodeType(n) || n.type;
      if (global.isOwSpawnNode(n) || eff === 'start') return true;
      const key = global.owNodeKey(mapId, n.id);
      if (prog.nodeClears && prog.nodeClears[key]) return true;
      if (eff === 'world' && n.worldId && prog.worldsCompleted && prog.worldsCompleted[n.worldId]) return true;
      return false;
    });
  };

  /** Return gate is hidden until must-complete nodes are done. */
  global.isOwReturnGateVisible = function (nodes, mapId, progress) {
    return global.areOwMustCompleteNodesCleared(nodes, mapId, progress);
  };

  global.getOwEffectiveNodeType = function (n) {
    if (!n) return '';
    if (typeof global.getOwLocationKind === 'function') {
      const kind = global.getOwLocationKind(n);
      if (kind === 'labelUi' || kind === 'label') return n.type === 'label' ? 'label' : (n.type || kind);
      if (kind && kind !== 'none') return kind;
    }
    if (n.kind && n.kind !== 'label' && n.kind !== 'labelUi' && n.kind !== 'none') return n.kind;
    if (n.type === 'label' && n.labelConfig && n.labelConfig.actsAsNode) {
      return n.labelConfig.mimicType || 'none';
    }
    return n.type || '';
  };

  global.getOwEffectiveNode = function (n) {
    if (!n) return n;
    const t = global.getOwEffectiveNodeType(n);
    if (!t || t === 'none' || t === 'label' || t === n.type) {
      if (n.type !== 'label' || !n.labelConfig || !n.labelConfig.actsAsNode) return n;
    }
    if (t && t !== 'none' && t !== 'label') {
      return Object.assign({}, n, { type: t, _labelProxy: true });
    }
    return n;
  };

  global.owNodeKey = function (mapId, nodeId) {
    return String(mapId || 'main') + ':' + Math.max(0, Math.floor(Number(nodeId) || 0));
  };

  global.defaultForgeEncounter = function (node) {
    const eff = typeof global.getOwEffectiveNodeType === 'function'
      ? global.getOwEffectiveNodeType(node)
      : node?.type;
    const isBoss = eff === 'boss' || !!node?.final;
    const count = isBoss ? 1 : 3;
    const slots = [];
    for (let i = 0; i < count; i++) {
      slots.push({ birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: isBoss ? 2 : 1 });
    }
    return { enemyCount: count, slots, combatStatMult: 1, healthDamageMult: 1 };
  };

  function clampForgeEncounterMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0.1, Math.min(5, Math.round(n * 10) / 10));
  }

  function normalizeForgeSlotTier(tier) {
    if (typeof global.normalizeBirdCardTier === 'function') return global.normalizeBirdCardTier(tier);
    const order = global.BIRD_CARD_TIER_ORDER || ['grey', 'green', 'blue', 'purple', 'gold', 'orange'];
    const t = String(tier || 'grey').toLowerCase();
    return order.indexOf(t) >= 0 ? t : 'grey';
  }

  function clampForgeSlotStars(stars) {
    if (typeof global.clampBirdCardStars === 'function') return global.clampBirdCardStars(stars);
    return Math.max(0, Math.min(5, Math.floor(Number(stars) || 0)));
  }

  global.pickRandomForgeBirdKey = function (scalingStage) {
    const st = Math.max(1, Math.floor(Number(scalingStage) || 1));
    const birds = global.BIRDS || {};
    let keys = Object.keys(birds).filter((k) => k && birds[k]);
    if (typeof global.listForgeEnemySpeciesOptions === 'function') {
      const opts = global.listForgeEnemySpeciesOptions(st).filter((o) => o.id && o.id !== 'random');
      if (opts.length) keys = opts.map((o) => o.id);
    }
    if (st !== 20) keys = keys.filter((k) => k !== 'dukeBlakiston');
    if (!keys.length) return 'sparrow';
    return keys[Math.floor(Math.random() * keys.length)];
  };

  global.ensureNodeEncounter = function (node) {
    if (!node || !global.isForgeCombatNode(node)) return null;
    if (!node.encounter || !Array.isArray(node.encounter.slots)) {
      node.encounter = global.defaultForgeEncounter(node);
    }
    const enc = node.encounter;
    enc.enemyCount = Math.max(1, Math.min(5, Math.floor(Number(enc.enemyCount) || enc.slots.length || 1)));
    enc.combatStatMult = clampForgeEncounterMult(enc.combatStatMult);
    enc.healthDamageMult = clampForgeEncounterMult(enc.healthDamageMult);
    while (enc.slots.length < enc.enemyCount) {
      enc.slots.push({ birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: 1 });
    }
    enc.slots = enc.slots.slice(0, enc.enemyCount).map((s) => {
      const slot = {
        birdKey: s.birdKey || 'random',
        enemyTier: normalizeForgeSlotTier(s.enemyTier || 'grey'),
        enemyStars: clampForgeSlotStars(s.enemyStars != null ? s.enemyStars : 0),
        mutationBand: s.mutationBand || 'green',
        maxMutations: Math.max(0, Math.min(11, Math.floor(Number(s.maxMutations) || 0))),
      };
      if (s.enemyId) slot.enemyId = String(s.enemyId);
      if (s.isBoss) slot.isBoss = true;
      if (s.useCustomStats) slot.useCustomStats = true;
      if (s.customStats && typeof s.customStats === 'object') {
        slot.customStats = {
          maxHp: Math.max(1, Math.floor(Number(s.customStats.maxHp) || 1)),
          atk: Math.max(1, Math.floor(Number(s.customStats.atk) || 1)),
          def: Math.max(0, Math.floor(Number(s.customStats.def) || 0)),
          matk: Math.max(1, Math.floor(Number(s.customStats.matk) || 1)),
          mdef: Math.max(0, Math.floor(Number(s.customStats.mdef) || 0)),
          spd: Math.max(1, Math.floor(Number(s.customStats.spd) || 1)),
        };
      }
      if (s.ai && typeof s.ai === 'object') {
        slot.ai = typeof global.normalizeSavedEnemyAI === 'function'
          ? global.normalizeSavedEnemyAI(s.ai)
          : s.ai;
      } else {
        slot.ai = typeof global.defaultEnemyAI === 'function'
          ? global.defaultEnemyAI()
          : { profile: 'default', behaviour: 'automatic' };
      }
      return slot;
    });
    return enc;
  };

  global.getNodeDisplayLabel = function (node, worldIndex) {
    if (!node) return '';
    const kind = typeof global.getOwLocationKind === 'function'
      ? global.getOwLocationKind(node)
      : (typeof global.getOwEffectiveNodeType === 'function'
        ? global.getOwEffectiveNodeType(node)
        : node.type);
    if (kind === 'world') return node.name || 'World';
    if (kind === 'bonus') return node.name || 'Bonus';
    if (kind === 'return') return node.name || 'Return';
    if (kind === 'overworld') return node.name || 'Overworld';
    if (kind === 'shop') return node.name || 'Shop';
    if (kind === 'start') return node.name || 'Start';
    if (kind === 'label' || kind === 'labelUi') {
      return node.labelConfig?.text || node.name || 'Label';
    }
    if (worldIndex != null && Number(node.subStage) > 0) {
      return String(worldIndex) + '-' + String(node.subStage);
    }
    if (kind === 'boss' && node.final) return 'Boss';
    if (global.isForgeCombatNode(node)) return String(node.stage || node.subStage || '');
    return node.name || '';
  };

  global.getStoryStageNodeTitle = function (stage, map) {
    const st = Math.max(1, Math.floor(Number(stage) || 1));
    const nodes = (map && Array.isArray(map.nodes) ? map.nodes : global.AVIAN_STORY_MAP_DEFAULT?.nodes) || [];
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const kind = typeof global.getOwLocationKind === 'function'
        ? global.getOwLocationKind(node)
        : node.type;
      if ((kind === 'stage' || kind === 'boss') && Number(node.stage) === st) {
        return String(node.name || '').trim();
      }
    }
    return '';
  };

  global.syntheticStageForWorldNode = function (worldIndex, subStage) {
    const wi = Math.max(1, Math.floor(Number(worldIndex) || 1));
    const ss = Math.max(1, Math.floor(Number(subStage) || 1));
    return wi * 100 + ss;
  };

  global.resolveForgeEncounterBirdKeys = function (encounter, playerBirdKey, scalingStage) {
    const enc = encounter || { enemyCount: 1, slots: [{ birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: 1 }] };
    const st = Math.max(1, Math.floor(Number(scalingStage) || 1));
    const pbk = String(playerBirdKey || '').trim();
    let pool = [];
    if (typeof global.getStoryStageEnemyCandidateIds === 'function') {
      pool = global.getStoryStageEnemyCandidateIds(st, pbk).slice();
    } else if (typeof global.pickStoryEncounterEnemyIds === 'function') {
      pool = global.pickStoryEncounterEnemyIds(st, pbk, enc.enemyCount || 1).slice();
    } else if (typeof global.pickStoryEncounterBirdKeys === 'function') {
      pool = global.pickStoryEncounterBirdKeys(st, pbk).slice();
    }
    if (!pool.length) pool = ['EN-SPARR-HESQ-L01'];
    const out = [];
    const slots = enc.slots || [];
    for (let i = 0; i < enc.enemyCount; i++) {
      const slot = slots[i] || { birdKey: 'random', enemyTier: 'grey', enemyStars: 0 };
      if (slot.enemyId && typeof global.isRosterEnemyId === 'function' && global.isRosterEnemyId(slot.enemyId)) {
        out.push(slot.enemyId);
      } else if (slot.birdKey && slot.birdKey !== 'random') {
        const bk = String(slot.birdKey || '').trim();
        const bkNorm = bk.toLowerCase().replace(/\s+/g, '');
        const isDuke = bk === 'dukeBlakiston' || bkNorm === 'dukeblakiston' || bkNorm === 'duke_blakiston';
        if (isDuke && st !== 20) {
          out.push(pool[Math.floor(Math.random() * pool.length)]);
        } else {
          out.push(bk);
        }
      } else {
        out.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return out;
  };

  global.isOwSegmentSourceCleared = function (node, progress, mapId, mapDef) {
    if (!node) return false;
    if (global.isOwSpawnNode(node)) return true;
    const prog = progress || {};
    const key = global.owNodeKey(mapId, node.id);
    if (prog.nodeClears && prog.nodeClears[key]) return true;
    const eff = global.getOwEffectiveNodeType(node) || node.type;
    if (eff === 'world' && node.worldId && prog.worldsCompleted && prog.worldsCompleted[node.worldId]) {
      return true;
    }
    if (eff === 'return') {
      const wid = mapDef?.worldId || mapId;
      return !!(prog.worldsCompleted && prog.worldsCompleted[wid]);
    }
    return false;
  };

  global.isPathSegmentRevealed = function (nodes, segmentIndex, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    const arr = nodes || [];
    const edges = global.buildOwPathEdges(arr);
    const i = Math.max(0, Math.floor(Number(segmentIndex) || 0));
    if (!edges.length) {
      const pathIdx = global.getPathNodeIndices(arr);
      if (i <= 0) return true;
      const nodeIdx = pathIdx[i];
      if (nodeIdx == null) return true;
      return global.isOwSegmentSourceCleared(arr[nodeIdx], progress, mapId, mapDef);
    }
    const edge = edges[i];
    if (!edge) return true;
    return global.isOwPathEdgeRevealed(arr, edge, progress, mapId, mapDef, pathReveal);
  };

  global.isNodeVisibleOnMap = function (nodes, nodeIndex, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    const arr = nodes || [];
    const idx = Math.max(0, Math.floor(Number(nodeIndex) || 0));
    const node = arr[idx];
    if (!node) return false;
    const eff = global.getOwEffectiveNodeType(node) || node.type;
    if (eff === 'return' && !global.isOwReturnGateVisible(arr, mapId, progress)) return false;
    if (node.type === 'label' && !(node.labelConfig && node.labelConfig.actsAsNode)) return true;
    if (global.isOwSpawnNode(node)) return true;
    if (global.isOwSegmentSourceCleared(node, progress, mapId, mapDef)) return true;
    if (!global.isOwPathNode(node)) return true;
    const parents = global.getOwPathParentIds(arr, node.id);
    if (!parents.length) return true;
    return parents.some((pid) => {
      const parent = arr.find((n) => n && n.id === pid) || arr[pid];
      return global.isOwSegmentSourceCleared(parent, progress, mapId, mapDef);
    });
  };

  global.resolveMapStartMapId = function (map) {
    const id = String(map?.startMapId || 'main');
    if (id === 'main') return 'main';
    if (map?.worlds && map.worlds[id]) return id;
    return 'main';
  };

  global.findOwSpawnNodeIndex = function (nodes) {
    if (!Array.isArray(nodes)) return 0;
    const i = nodes.findIndex((n) => global.isOwSpawnNode(n));
    return i >= 0 ? i : 0;
  };

  global.upgradeMapToV2 = function (map) {
    const m = Object.assign({}, map || {});
    m.schemaVersion = 2;
    m.pathReveal = m.pathReveal !== false;
    // Shallow-clone worlds so callers (e.g. history snapshots) do not share
    // world objects/node arrays with the live editor map.
    const srcWorlds = m.worlds && typeof m.worlds === 'object' ? m.worlds : {};
    m.worlds = {};
    Object.keys(srcWorlds).forEach((wid) => {
      const src = srcWorlds[wid] || {};
      m.worlds[wid] = Object.assign({}, src, {
        nodes: Array.isArray(src.nodes) ? src.nodes.slice() : [],
      });
    });
    m.nodes = Array.isArray(m.nodes) ? m.nodes.slice() : [];
    const sm = String(m.startMapId || 'main');
    m.startMapId = (sm === 'main' || (m.worlds && m.worlds[sm])) ? sm : 'main';
    let worldCount = 0;
    m.nodes.forEach((n) => {
      const isWorldJob = n.type === 'world'
        || (n.type === 'label' && n.labelConfig?.actsAsNode && n.labelConfig?.mimicType === 'world');
      if (isWorldJob) {
        worldCount += 1;
        if (!n.worldId) n.worldId = 'world' + worldCount;
        if (!m.worlds[n.worldId]) {
          m.worlds[n.worldId] = {
            name: n.name || 'World ' + worldCount,
            worldIndex: worldCount,
            backgroundDataUrl: '',
            nodes: [],
          };
        }
      }
      if (global.isForgeCombatNode(n)) global.ensureNodeEncounter(n);
      if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
      else if (n.labelConfig && global.ensureNodeAppearance) global.ensureNodeAppearance(n);
      const effMain = global.getOwEffectiveNodeType(n) || n.type;
      if ((n.type === 'bonus' || effMain === 'bonus') && !n.bonusConfig) {
        n.bonusConfig = { powerProgression: true, maxRepeats: 5 };
      }
      if (global.isForgeCombatNode(n)) {
        if (!Array.isArray(n.clearRewards) && n.bonusConfig?.rewards?.length) {
          n.clearRewards = JSON.parse(JSON.stringify(n.bonusConfig.rewards));
          delete n.bonusConfig.rewards;
        }
        if (!Array.isArray(n.clearRewards)) n.clearRewards = [];
      }
    });
    global.ensureOwPathOrders(m.nodes);
    Object.keys(m.worlds).forEach((wid) => {
      const w = m.worlds[wid];
      if (w?.nodes) {
        w.nodes.forEach((n) => {
          if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
          else if (n.labelConfig && global.ensureNodeAppearance) global.ensureNodeAppearance(n);
          const effW = global.getOwEffectiveNodeType(n) || n.type;
          if ((n.type === 'bonus' || effW === 'bonus') && !n.bonusConfig) {
            n.bonusConfig = { powerProgression: true, maxRepeats: 5 };
          }
          if (global.isForgeCombatNode(n)) {
            if (!Array.isArray(n.clearRewards) && n.bonusConfig?.rewards?.length) {
              n.clearRewards = JSON.parse(JSON.stringify(n.bonusConfig.rewards));
              delete n.bonusConfig.rewards;
            }
            if (!Array.isArray(n.clearRewards)) n.clearRewards = [];
          }
        });
        global.ensureOwPathOrders(w.nodes);
      }
      global.recomputeWorldSubStages(w);
    });
    return m;
  };

  global.recomputeWorldSubStages = function (worldDef) {
    if (!worldDef || !Array.isArray(worldDef.nodes)) return 0;
    let sub = 0;
    worldDef.nodes.forEach((n) => {
      const eff = global.getOwEffectiveNodeType(n) || n.type;
      if (eff === 'start' || global.isOwSpawnNode(n)) {
        n.stage = 0;
        delete n.subStage;
      } else if (eff === 'shop' || eff === 'return' || eff === 'world' || eff === 'overworld'
        || (n.type === 'label' && !(n.labelConfig && n.labelConfig.actsAsNode))) {
        delete n.stage;
        delete n.subStage;
      } else if (eff === 'stage' || eff === 'boss' || eff === 'bonus') {
        sub += 1;
        n.subStage = sub;
        delete n.stage;
        if (global.isForgeCombatNode(n)) global.ensureNodeEncounter(n);
      }
      if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
      else if (n.labelConfig && global.ensureNodeAppearance) global.ensureNodeAppearance(n);
    });
    return sub;
  };

  global.resolveOwActiveMapSlice = function (mapDef, activeMapId) {
    if (!mapDef) return null;
    const id = String(activeMapId || 'main');
    if (id === 'main') {
      return {
        mapId: 'main',
        name: mapDef.name || 'Main Map',
        backgroundDataUrl: mapDef.backgroundDataUrl || '',
        nodes: mapDef.nodes || [],
        worldIndex: null,
        pathReveal: mapDef.pathReveal !== false,
      };
    }
    const world = mapDef.worlds && mapDef.worlds[id];
    if (!world) return null;
    return {
      mapId: id,
      name: world.name || id,
      backgroundDataUrl: world.backgroundDataUrl || '',
      nodes: world.nodes || [],
      worldIndex: world.worldIndex || 1,
      worldId: id,
      pathReveal: mapDef.pathReveal !== false,
    };
  };

  global.getForgeBirdOptions = function () {
    if (typeof global.listForgeEnemySpeciesOptions === 'function') {
      return global.listForgeEnemySpeciesOptions();
    }
    const birds = global.BIRDS || {};
    const keys = Object.keys(birds).sort();
    return [{ id: 'random', label: 'Random' }].concat(
      keys.map((k) => ({ id: k, label: birds[k]?.name || k }))
    );
  };

  global.applyForgePowerScaling = function (ed, powerTier) {
    const tier = Math.max(0, Math.floor(Number(powerTier) || 0));
    if (!ed || tier <= 0) return ed;
    const mult = 1 + tier * 0.1;
    const scaleStat = (v) => Math.max(1, Math.floor((Number(v) || 0) * mult));
    if (ed.stats) {
      ed.stats.maxHp = scaleStat(ed.stats.maxHp);
      ed.stats.hp = ed.stats.maxHp;
      ed.stats.atk = scaleStat(ed.stats.atk);
      ed.stats.matk = scaleStat(ed.stats.matk);
      ed.stats.def = scaleStat(ed.stats.def);
      ed.stats.mdef = scaleStat(ed.stats.mdef);
    }
    ed.hp = ed.stats?.hp ?? ed.hp;
    ed.maxHp = ed.stats?.maxHp ?? ed.maxHp;
    ed.atk = ed.stats?.atk ?? ed.atk;
    ed.def = ed.stats?.def ?? ed.def;
    return ed;
  };

  /** Build Nest encounter multipliers: combatStatMult (all combat) then healthDamageMult (HP/ATK/MATK). */
  global.applyForgeEncounterStatMults = function (ed, encounter) {
    if (!ed || !encounter) return ed;
    const combatMult = clampForgeEncounterMult(encounter.combatStatMult);
    const hdMult = clampForgeEncounterMult(encounter.healthDamageMult);
    if (combatMult === 1 && hdMult === 1) return ed;
    const floorStat = (v, mult) => Math.max(1, Math.floor((Number(v) || 0) * mult));
    const floorOpt = (v, mult) => Math.max(0, Math.floor((Number(v) || 0) * mult));
    const combatThenHd = combatMult * hdMult;
    const setPair = (key, value) => {
      if (ed.stats) ed.stats[key] = value;
      if (key in ed || key === 'maxHp') ed[key] = value;
    };
    const maxHp = floorStat(ed.stats?.maxHp ?? ed.maxHp, combatThenHd);
    setPair('maxHp', maxHp);
    if (ed.stats) ed.stats.hp = maxHp;
    ed.hp = maxHp;
    setPair('atk', floorStat(ed.stats?.atk ?? ed.atk, combatThenHd));
    setPair('matk', floorStat(ed.stats?.matk ?? ed.matk, combatThenHd));
    setPair('def', floorOpt(ed.stats?.def ?? ed.def, combatMult));
    setPair('mdef', floorOpt(ed.stats?.mdef ?? ed.mdef, combatMult));
    setPair('spd', floorStat(ed.stats?.spd ?? ed.spd, combatMult));
    if (ed.stats && ('acc' in ed.stats || ed.acc != null)) {
      const acc = Math.max(1, Math.min(99, floorStat(ed.stats?.acc ?? ed.acc, combatMult)));
      setPair('acc', acc);
    }
    if (ed.stats && ('dodge' in ed.stats || ed.dodge != null)) {
      const dodge = Math.max(0, Math.min(99, floorOpt(ed.stats?.dodge ?? ed.dodge, combatMult)));
      setPair('dodge', dodge);
    }
    return ed;
  };

  global.grantForgeClearRewards = function (player, rewards, G) {
    const empty = { shinies: 0, mutations: [], equipment: [], items: [], nests: 0, rescuedNests: 0, savedEggs: 0, goldenGoose: 0, feathers: [], pendingEquipmentChoice: [] };
    if (!Array.isArray(rewards) || !rewards.length) return empty;
    const granted = Object.assign({}, empty, { mutations: [], equipment: [], items: [], feathers: [], pendingEquipmentChoice: [] });
    const rollForgeEquipment = (band) => {
      if (typeof global.Avian?.equipmentLoot?.rollEquipmentDrop !== 'function') return null;
      return global.Avian.equipmentLoot.rollEquipmentDrop({
        band: band || 'blue',
        stage: G?.stage || 1,
        filterForPlayer: true,
      });
    };
    const grantEquipmentId = (id) => {
      if (!id) return;
      if (typeof global.Avian?.equipment?.grantEquipment === 'function') {
        global.Avian.equipment.grantEquipment(player, id);
      } else if (typeof global.Avian?.equipment?.addToInventory === 'function') {
        global.Avian.equipment.addToInventory(player, id);
      } else {
        return;
      }
      granted.equipment.push(id);
      if (typeof global.Avian?.equipmentLoot?.registerOrangeAcquired === 'function') {
        global.Avian.equipmentLoot.registerOrangeAcquired(global.Avian.equipmentLoot.getItem(id));
      }
    };
    const grantGearFromBand = (band) => {
      const eqId = rollForgeEquipment(band);
      if (eqId) grantEquipmentId(eqId);
    };
    rewards.forEach((r) => {
      if (!r) return;
      const chance = r.chance != null ? Math.max(0, Math.min(100, Number(r.chance))) : 100;
      if (chance < 100 && Math.random() * 100 >= chance) return;
      if (r.type === 'shinies') {
        const lo = Math.max(0, Math.floor(Number(r.min) || 0));
        const hi = Math.max(lo, Math.floor(Number(r.max) || lo));
        const gain = lo + Math.floor(Math.random() * (hi - lo + 1));
        granted.shinies += gain;
        if (G) G.shinyObjects = (G.shinyObjects || 0) + gain;
      } else if (r.type === 'mutation') {
        const eqId = r.equipmentId || r.mutationId;
        const grantMode = r.grantMode || (eqId ? 'specified' : (r.count != null ? 'roll' : 'choice'));
        if (grantMode === 'specified' && eqId) {
          grantEquipmentId(String(eqId));
        } else if (grantMode === 'choice') {
          granted.pendingEquipmentChoice.push({
            tierBand: r.tierBand || r.tier || 'blue',
            pickCount: Math.max(2, Math.min(5, Math.floor(Number(r.pickCount) || 3))),
          });
        } else {
          const count = Math.max(1, Math.floor(Number(r.count) || 1));
          const band = r.tierBand || r.tier || 'blue';
          for (let i = 0; i < count; i++) grantGearFromBand(band);
        }
      } else if (r.type === 'nest' && Array.isArray(r.slots)) {
        r.slots.forEach((slot) => {
          grantGearFromBand(slot?.tier || slot?.tierBand || 'blue');
          granted.nests += 1;
        });
      } else if (r.type === 'item' && r.itemKey) {
        const lo = Math.max(0, Math.floor(Number(r.min) || Number(r.qty) || 1));
        const hi = Math.max(lo, Math.floor(Number(r.max) || lo));
        const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
        if (typeof global.addCombatItem === 'function') global.addCombatItem(player, r.itemKey, qty);
        granted.items.push({ itemKey: r.itemKey, quantity: qty });
      } else if (r.type === 'rescuedNest') {
        const eggId = String(r.eggId || 'cracked').toLowerCase();
        const n = Math.max(1, Math.floor(Number(r.count) || 1));
        if (typeof global.addRescuedNest === 'function') global.addRescuedNest(eggId, n);
        granted.rescuedNests += n;
      } else if (r.type === 'savedEggs') {
        const n = Math.max(0, Math.floor(Number(r.count) || 0));
        if (n && typeof global.addSavedEggs === 'function') global.addSavedEggs(n);
        granted.savedEggs += n;
      } else if (r.type === 'goldenGoose') {
        const n = Math.max(0, Math.floor(Number(r.count) || 0));
        if (n && typeof global.addGoldenGooseEggs === 'function') global.addGoldenGooseEggs(n);
        granted.goldenGoose += n;
      } else if (r.type === 'speciesFeathers') {
        let bk = r.birdKey || 'random';
        if (bk === 'random') {
          const meta = typeof global.getFortuneMeta === 'function' ? global.getFortuneMeta() : null;
          const owned = meta?.birdCards?.owned || {};
          const keys = Object.keys(owned);
          bk = keys.length ? keys[Math.floor(Math.random() * keys.length)] : null;
        }
        const n = Math.max(0, Math.floor(Number(r.count) || 0));
        if (bk && n && typeof global.addSpeciesFeathers === 'function') {
          global.addSpeciesFeathers(bk, n);
          granted.feathers.push({ birdKey: bk, count: n });
        }
      }
    });
    return granted;
  };

  global.buildForgeEquipmentChoicePool = function (choice, player) {
    const loot = global.Avian && global.Avian.equipmentLoot;
    if (!loot || typeof loot.rollEquipmentDrop !== 'function' || typeof loot.buildRewardCard !== 'function') return [];
    const tier = String(choice?.tierBand || choice?.tier || 'blue').toLowerCase();
    const pickCount = Math.max(2, Math.min(5, Math.floor(Number(choice?.pickCount) || 3)));
    const used = new Set();
    const pool = [];
    let guard = 0;
    while (pool.length < pickCount && guard < pickCount * 8) {
      guard++;
      const id = loot.rollEquipmentDrop({
        rarity: tier,
        stage: (global.G && global.G.stage) || 1,
        filterForPlayer: true,
        player: player || (global.G && global.G.player),
        usedIds: used,
      });
      if (!id) break;
      const card = loot.buildRewardCard(id);
      if (card) pool.push(card);
    }
    return pool;
  };

  global.grantForgeBonusRewards = function (player, bonusConfig, G) {
    const rewards = bonusConfig?.rewards || bonusConfig?.clearRewards;
    return global.grantForgeClearRewards(player, rewards, G);
  };

  global.FORGE_TERRAIN_PRESETS = [
    { label: 'Finch Burrow', terrain: 'Finch Burrow', arenaId: 'finch-burrow' },
    { label: 'Overgrown Yard', terrain: 'Overgrown Yard', arenaId: 'barn' },
    { label: 'River Ford', terrain: 'River Ford', arenaId: 'river' },
    { label: 'River Rapids', terrain: 'River Rapids', arenaId: 'river' },
    { label: 'Rocky Outcrop', terrain: 'Rocky Outcrop', arenaId: 'open-glade' },
    { label: 'Collapsed Mill', terrain: 'Collapsed Mill', arenaId: 'ruins' },
    { label: 'Darkwood Path', terrain: 'Darkwood Path', arenaId: 'forest' },
    { label: 'Ancient Trail', terrain: 'Ancient Trail', arenaId: 'trees' },
    { label: 'Stone Bridge', terrain: 'Stone Bridge', arenaId: 'bridge' },
    { label: 'Bridge Crossing', terrain: 'Bridge Crossing', arenaId: 'bridge' },
    { label: 'Ashen Forest', terrain: 'Ashen Forest', arenaId: 'forest' },
    { label: 'Highland Ridge', terrain: 'Highland Ridge', arenaId: 'open-glade' },
    { label: 'Shadow Hollow', terrain: 'Shadow Hollow', arenaId: 'trees' },
    { label: 'Mountain Pass', terrain: 'Mountain Pass', arenaId: 'castle-gate' },
    { label: 'Castle Road', terrain: 'Castle Road', arenaId: 'castle-interior' },
    { label: 'Castle Walls', terrain: 'Castle Walls', arenaId: 'castle-interior' },
    { label: 'Outer Courtyard', terrain: 'Outer Courtyard', arenaId: 'castle-interior' },
    { label: 'Castle Spire', terrain: 'Castle Spire', arenaId: 'castle-interior' },
    { label: 'Throne Approach', terrain: 'Throne Approach', arenaId: 'castle-gate' },
    { label: 'Castle Throne', terrain: 'Castle Throne Room', arenaId: 'castle-throne' },
    { label: 'Open Glade', terrain: 'Open Glade', arenaId: 'open-glade' },
    { label: 'Wilds', terrain: 'Wilds', arenaId: 'forest' },
    { label: 'Boss Arena', terrain: 'Boss Arena', arenaId: 'castle-interior' },
    { label: 'Bonus Arena', terrain: 'Bonus Arena', arenaId: 'open-glade' },
  ];

  global.FORGE_ENCOUNTER_PRESETS = {
    standardStage: {
      enemyCount: 3,
      slots: [
        { birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: 1 },
        { birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: 1 },
        { birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: 1 },
      ],
    },
    miniBoss: {
      enemyCount: 2,
      slots: [
        { birdKey: 'random', enemyTier: 'blue', enemyStars: 0, mutationBand: 'blue', maxMutations: 2 },
        { birdKey: 'random', enemyTier: 'blue', enemyStars: 0, mutationBand: 'blue', maxMutations: 2 },
      ],
    },
    hardBoss: {
      enemyCount: 1,
      slots: [{ birdKey: 'random', enemyTier: 'purple', enemyStars: 0, mutationBand: 'purple', maxMutations: 3 }],
    },
  };

  const MUT_BAND_WEIGHT = { grey: 1, grey_green: 2, green: 3, green_blue: 4, blue: 5, blue_purple: 6, purple: 7, purple_gold: 8, gold: 9, orange: 10 };

  global.summarizeMapSlice = function (slice, mapDef) {
    if (!slice?.nodes) return { combat: 0, worlds: 0, bonus: 0, shop: 0, avgMutTier: 0, bonusPower: [] };
    const nodes = slice.nodes;
    let combat = 0;
    let worlds = 0;
    let bonus = 0;
    let shop = 0;
    let mutSum = 0;
    let mutCount = 0;
    const bonusPower = [];
    nodes.forEach((n) => {
      const eff = global.getOwEffectiveNodeType(n) || n.type;
      if (eff === 'world') worlds += 1;
      else if (eff === 'bonus') {
        bonus += 1;
        if (n.bonusConfig?.powerProgression) bonusPower.push(n.bonusConfig.maxRepeats || 5);
      } else if (eff === 'shop') shop += 1;
      else if (eff === 'stage' || eff === 'boss') combat += 1;
      if (global.isForgeCombatNode(n) && n.encounter?.slots) {
        n.encounter.slots.forEach((s) => {
          mutSum += MUT_BAND_WEIGHT[s.mutationBand] || 3;
          mutCount += 1;
        });
      }
    });
    return {
      combat,
      worlds: slice.mapId === 'main' ? worlds : 0,
      bonus,
      shop,
      avgMutTier: mutCount ? (mutSum / mutCount).toFixed(1) : '-',
      bonusPower,
      mapId: slice.mapId,
    };
  };

  global.collectMapValidationIssues = function (map) {
    const issues = [];
    const add = (severity, message, mapId, nodeId) => issues.push({
      severity: severity === 'error' ? 'error' : 'warning',
      message,
      mapId: mapId || 'main',
      nodeId: nodeId ?? null,
    });

    const nodes = map?.nodes || [];
    const effType = (n) => (global.getOwEffectiveNodeType ? global.getOwEffectiveNodeType(n) : n?.type) || '';
    if (!nodes.length) add('warning', 'Add at least one node.');
    const startMapId = String(map?.startMapId || 'main');
    const startSlice = startMapId === 'main'
      ? nodes
      : (map?.worlds?.[startMapId]?.nodes || []);
    const startSpawns = startSlice.filter((n) => global.isOwSpawnNode(n)).length;
    if (startSpawns === 0) add('error', 'Start map needs a Spawn location.', startMapId, null);
    const mainSpawns = nodes.filter((n) => global.isOwSpawnNode(n)).length;
    if (mainSpawns > 1) add('warning', 'Exactly one Spawn node recommended on the main map.');
    const hasCombat = (arr) => (arr || []).some((n) => {
      const t = effType(n);
      return t === 'stage' || t === 'boss' || t === 'bonus';
    });
    let anyCombat = hasCombat(nodes);
    Object.keys(map?.worlds || {}).forEach((wid) => {
      if (hasCombat(map.worlds[wid]?.nodes)) anyCombat = true;
    });
    if (!anyCombat) add('error', 'Add at least one Stage, Boss, or Bonus.');
    if (!map?.backgroundDataUrl) add('error', 'Upload a main map background image.');

    const worldIdsUsed = new Set(
      nodes.filter((n) => effType(n) === 'world' && n.worldId).map((n) => n.worldId)
    );
    Object.keys(map?.worlds || {}).forEach((wid) => {
      if (!worldIdsUsed.has(wid) && wid !== startMapId) add('warning', 'Orphaned world data: ' + wid, 'main', null);
    });
    nodes.forEach((n) => {
      if (effType(n) !== 'world') return;
      if (!n.worldId || !map?.worlds?.[n.worldId]) {
        add('error', 'Map gate "' + (n.name || n.id) + '" points at a missing map.', 'main', n.id);
      }
    });
    if (startMapId !== 'main' && !map?.worlds?.[startMapId]) {
      add('error', 'startMapId "' + startMapId + '" does not exist.');
    }

    if (!nodes.some((n) => effType(n) === 'boss' && n.final)) add('warning', 'No final boss marked on main map.');

    const owGates = nodes.filter((n) => effType(n) === 'overworld');
    if (owGates.length > 1) add('warning', 'Multiple Overworld gates on main map - players may confuse which to use.', 'main', owGates[1]?.id);

    let firstCombatIdx = nodes.findIndex((n) => {
      const t = effType(n);
      return t === 'stage' || t === 'boss';
    });
    const shopBeforeCombat = nodes.findIndex((n, i) => effType(n) === 'shop' && (firstCombatIdx < 0 || i < firstCombatIdx));
    if (shopBeforeCombat >= 0) add('warning', 'Shop appears before first combat node.', 'main', nodes[shopBeforeCombat]?.id);

    nodes.forEach((n) => {
      if (n.type === 'label') {
        const cfg = n.labelConfig || {};
        const uiAction = global.getOwMapUiAction(cfg);
        if (uiAction && cfg.actsAsNode) {
          add('warning', 'Label cannot use both a UI button and node proxy - pick one role.', 'main', n.id);
        }
        if (cfg.actsAsNode && (!cfg.mimicType || cfg.mimicType === 'none')) {
          add('warning', 'Functional label needs a mimic class.', 'main', n.id);
        }
        if (cfg.actsAsNode && !cfg.showFill && !cfg.showBorder && !cfg.showText) {
          const mt = cfg.mimicType;
          if (!mt || mt === 'none') add('warning', 'Invisible functional label has no action.', 'main', n.id);
        }
        if (uiAction && !cfg.showFill && !cfg.showBorder && !cfg.showText) {
          add('warning', 'Invisible UI button - add text or border so players can find it.', 'main', n.id);
        }
        if (cfg.actsAsNode && cfg.mimicType === 'bonus' && (!Array.isArray(n.clearRewards) || !n.clearRewards.length)) {
          add('warning', 'Bonus label has no clear rewards.', 'main', n.id);
        }
        return;
      }
      {
        const effBonus = effType(n);
        if (effBonus === 'bonus' && (!Array.isArray(n.clearRewards) || !n.clearRewards.length)) {
          add('warning', 'Bonus node has no clear rewards.', 'main', n.id);
        }
      }
    });

    Object.keys(map?.worlds || {}).forEach((wid) => {
      const w = map.worlds[wid];
      const wn = w?.nodes || [];
      if (!w?.backgroundDataUrl) add('warning', 'World "' + (w.name || wid) + '" has no background.', wid, null);
      if (!wn.some((n) => global.isOwSpawnNode(n))) add('warning', 'World "' + (w.name || wid) + '" missing Spawn node.', wid, null);
      if (!wn.some((n) => effType(n) === 'return')) add('warning', 'World "' + (w.name || wid) + '" missing return gate.', wid, null);
      if (!wn.some((n) => effType(n) === 'boss')) add('warning', 'World "' + (w.name || wid) + '" missing boss.', wid, null);
      const hasReturn = wn.some((n) => effType(n) === 'return');
      const hasMust = wn.some((n) => n && n.mustComplete);
      const hasBoss = wn.some((n) => effType(n) === 'boss');
      if (hasReturn && !hasMust && !hasBoss) {
        add('warning', 'World "' + (w.name || wid) + '" has a Return Gate with no Must-complete nodes or boss.', wid, null);
      }
      const bossOrders = wn.filter((n) => effType(n) === 'boss').map((n) => global.getOwNodePathOrder(n));
      const retOrders = wn.filter((n) => effType(n) === 'return').map((n) => global.getOwNodePathOrder(n));
      if (bossOrders.length && retOrders.length && Math.min(...retOrders) <= Math.min(...bossOrders)) {
        const retNode = wn.find((n) => effType(n) === 'return');
        add('warning', 'Return gate should come after boss in path order.', wid, retNode?.id);
      }
    });

    return issues;
  };

  global.previewForgeSlotStats = function (birdKey, stage, isBoss, extra) {
    let enemyId = null;
    if (extra && typeof extra === 'object' && extra.enemyId) enemyId = extra.enemyId;
    else if (typeof extra === 'string') enemyId = extra;
    if (enemyId) {
      const row = (typeof global.getEnemyRosterRow === 'function' ? global.getEnemyRosterRow(enemyId) : null)
        || (typeof global.getRosterRow === 'function' ? global.getRosterRow(enemyId) : null);
      if (row && row.stats) {
        const s = row.stats;
        return {
          maxHp: Math.max(1, Math.floor(s.maxHp || s.hp || 30)),
          atk: Math.max(1, Math.floor(s.atk || 6)),
          def: Math.max(0, Math.floor(s.def || 2)),
          matk: Math.max(0, Math.floor(Number(s.matk) || 0)),
          mdef: Math.max(0, Math.floor(s.mdef || 8)),
          spd: Math.max(1, Math.floor(s.spd || 6)),
        };
      }
    }
    const bd = global.BIRDS?.[birdKey];
    if (!bd || birdKey === 'random') return null;
    const st = Math.max(1, Math.floor(Number(stage) || 1));
    let maxHp = Math.max(1, Math.floor(bd.stats?.maxHp || bd.stats?.hp || 30));
    let atk = Math.max(1, Math.floor(bd.stats?.atk || 6));
    let def = Math.max(0, Math.floor(bd.stats?.def || 2));
    let matk = Math.max(0, Math.floor(Number(bd.stats?.matk) || 0));
    let mdef = Math.max(0, Math.floor(bd.stats?.mdef || 8));
    let spd = Math.max(1, Math.floor(bd.stats?.spd || 6));
    if (isBoss) {
      maxHp = Math.floor(maxHp * 2);
      atk = Math.floor(atk * 1.3);
      matk = Math.floor(matk * 1.3);
    }
    return { maxHp, atk, def, matk, mdef, spd };
  };
})(typeof window !== 'undefined' ? window : globalThis);
