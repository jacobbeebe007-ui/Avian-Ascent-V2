/**
 * Shared overworld ↔ main game bridge: localStorage keys, progress shape,
 * and helpers used by js/core/game.js and blackstone_overworld_new.html.
 */
(function (global) {
  'use strict';

  global.AVIAN_OW_KEYS = {
    SAVE: 'avianAscent_save_v2',
    STATE: 'avianAscent_overworld',
    NAV: 'avianAscent_nav',
    CUSTOM_MAP: 'avian_map_forge_active_map',
    CUSTOM_MODE: 'avian_use_custom_overworld',
    BUILDNEST: 'avian_buildnest_unlocked',
    FORGE_DRAFTS: 'avian_map_forge_drafts',
    FORGE_CURRENT_ID: 'avian_map_forge_current_id',
    CUSTOM_PROGRESS: 'avian_ow_custom_progress',
    MAP_STACK: 'avian_ow_map_stack',
    MISSION_MAP_VARIANT: 'avian_mission_map_variant',
  };

  /** Finch-Burrow Test Map JSON (Mission Map → Test tab). */
  global.AVIAN_MISSION_TEST_MAP_URL = 'js/data/Finch-Burrow%20Test%20Map.json';

  global.getMissionMapVariant = function () {
    try {
      const raw = global.localStorage.getItem(global.AVIAN_OW_KEYS.MISSION_MAP_VARIANT);
      return raw === 'test' ? 'test' : 'demo';
    } catch (_) {
      return 'demo';
    }
  };

  global.setMissionMapVariant = function (which) {
    const v = which === 'test' ? 'test' : 'demo';
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.MISSION_MAP_VARIANT, v);
    } catch (_) {}
    return v;
  };

  /**
   * Fetch the Mission Map Test JSON. Returns a map def or null on failure.
   * @returns {Promise<object|null>}
   */
  global.fetchMissionTestMap = async function () {
    try {
      const res = await global.fetch(global.AVIAN_MISSION_TEST_MAP_URL, { cache: 'force-cache' });
      if (!res.ok) return null;
      const parsed = await res.json();
      if (!parsed || !Array.isArray(parsed.nodes) || !parsed.nodes.length) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  function emptyCustomProgress() {
    return { nodeClears: {}, worldsCompleted: {}, bonusRepeats: {}, activeMapId: 'main' };
  }

  global.readOwCustomProgress = function () {
    try {
      const raw = global.localStorage.getItem(global.AVIAN_OW_KEYS.CUSTOM_PROGRESS);
      const p = raw ? JSON.parse(raw) : null;
      if (!p || typeof p !== 'object') return emptyCustomProgress();
      return {
        nodeClears: p.nodeClears && typeof p.nodeClears === 'object' ? p.nodeClears : {},
        worldsCompleted: p.worldsCompleted && typeof p.worldsCompleted === 'object' ? p.worldsCompleted : {},
        bonusRepeats: p.bonusRepeats && typeof p.bonusRepeats === 'object' ? p.bonusRepeats : {},
        activeMapId: p.activeMapId || 'main',
      };
    } catch (_) {
      return emptyCustomProgress();
    }
  };

  global.writeOwCustomProgress = function (progress) {
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.CUSTOM_PROGRESS, JSON.stringify(progress));
      return true;
    } catch (_) {
      return false;
    }
  };

  global.resetOwCustomProgress = function () {
    global.writeOwCustomProgress(emptyCustomProgress());
  };

  global.getOwActiveMapId = function () {
    return global.readOwCustomProgress().activeMapId || 'main';
  };

  global.setOwActiveMapId = function (mapId) {
    const p = global.readOwCustomProgress();
    p.activeMapId = String(mapId || 'main');
    global.writeOwCustomProgress(p);
  };

  global.seedOwRunToStartMap = function (map) {
    const resolveStart = typeof global.resolveMapStartMapId === 'function'
      ? global.resolveMapStartMapId
      : (m) => {
        const id = String(m?.startMapId || 'main');
        if (id === 'main') return 'main';
        return (m?.worlds && m.worlds[id]) ? id : 'main';
      };
    const findSpawn = typeof global.findOwSpawnNodeIndex === 'function'
      ? global.findOwSpawnNodeIndex
      : (nodes) => {
        if (!Array.isArray(nodes)) return 0;
        const i = nodes.findIndex((n) => n && (
          n.type === 'start'
          || (n.type === 'label' && n.labelConfig?.actsAsNode && n.labelConfig?.mimicType === 'start')
        ));
        return i >= 0 ? i : 0;
      };
    const startId = resolveStart(map);
    global.resetOwCustomProgress();
    global.clearOwMapStack();
    global.setOwActiveMapId(startId);
    const slice = startId === 'main'
      ? (map?.nodes || [])
      : (map?.worlds?.[startId]?.nodes || []);
    const spawnIdx = findSpawn(slice);
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.STATE, JSON.stringify({ nodeId: spawnIdx }));
      global.localStorage.removeItem(global.AVIAN_OW_KEYS.NAV);
    } catch (_) {}
    return { startId, spawnIdx };
  };

  global.readOwMapStack = function () {
    try {
      const raw = global.localStorage.getItem(global.AVIAN_OW_KEYS.MAP_STACK);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  };

  global.writeOwMapStack = function (stack) {
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.MAP_STACK, JSON.stringify(stack || []));
    } catch (_) {}
  };

  global.pushOwMapStack = function (entry) {
    const stack = global.readOwMapStack();
    stack.push(entry);
    global.writeOwMapStack(stack);
  };

  global.popOwMapStack = function () {
    const stack = global.readOwMapStack();
    const entry = stack.pop();
    global.writeOwMapStack(stack);
    return entry || null;
  };

  global.clearOwMapStack = function () {
    global.writeOwMapStack([]);
    global.setOwActiveMapId('main');
  };

  global.isOwNodeCleared = function (mapId, nodeId, progress) {
    const p = progress || global.readOwCustomProgress();
    const key = typeof global.owNodeKey === 'function'
      ? global.owNodeKey(mapId, nodeId)
      : String(mapId) + ':' + nodeId;
    return !!(p.nodeClears && p.nodeClears[key]);
  };

  global.markOwNodeCleared = function (mapId, nodeId) {
    const p = global.readOwCustomProgress();
    const key = typeof global.owNodeKey === 'function'
      ? global.owNodeKey(mapId, nodeId)
      : String(mapId) + ':' + nodeId;
    p.nodeClears[key] = true;
    global.writeOwCustomProgress(p);
  };

  global.isOwWorldCompleted = function (worldId, progress) {
    const p = progress || global.readOwCustomProgress();
    return !!(p.worldsCompleted && p.worldsCompleted[worldId]);
  };

  global.markOwWorldCompleted = function (worldId) {
    const p = global.readOwCustomProgress();
    p.worldsCompleted[worldId] = true;
    global.writeOwCustomProgress(p);
  };

  global.getBonusRepeatCount = function (mapId, nodeId, progress) {
    const p = progress || global.readOwCustomProgress();
    const key = typeof global.owNodeKey === 'function'
      ? global.owNodeKey(mapId, nodeId)
      : String(mapId) + ':' + nodeId;
    return Math.max(0, Math.floor(Number(p.bonusRepeats?.[key]) || 0));
  };

  global.incrementBonusRepeatCount = function (mapId, nodeId) {
    const p = global.readOwCustomProgress();
    const key = typeof global.owNodeKey === 'function'
      ? global.owNodeKey(mapId, nodeId)
      : String(mapId) + ':' + nodeId;
    p.bonusRepeats[key] = Math.max(0, Math.floor(Number(p.bonusRepeats[key]) || 0)) + 1;
    global.writeOwCustomProgress(p);
    return p.bonusRepeats[key];
  };

  global.canEnterBonusNode = function (mapId, nodeId, bonusConfig, progress) {
    const cfg = bonusConfig || {};
    const max = Math.max(1, Math.floor(Number(cfg.maxRepeats) || 20));
    const count = global.getBonusRepeatCount(mapId, nodeId, progress);
    return count < max;
  };

  /**
   * Canonical merge — keep in sync with normalizeOverworldProgress in game.js callers.
   * @param {object|null|undefined} progress
   * @param {number} fallbackStage current story stage (ceiling for completedStage)
   * @param {number} [maxStage=20] story stage cap for this map
   */
  function normalizeOverworldProgressShared(progress, fallbackStage, maxStage) {
    const cap = Math.max(1, Math.floor(Number(maxStage) || 20));
    const nextStage = Math.max(1, Math.floor(Number(fallbackStage) || 1));
    const rawCompleted = Number(progress?.completedStage);
    const ceiling = Math.max(0, nextStage - 1);
    const merged = Math.min(
      cap,
      Math.max(ceiling, Number.isFinite(rawCompleted) ? Math.floor(rawCompleted) : 0)
    );
    const completedStage = Math.min(merged, ceiling);
    const rawNodeId = Number(progress?.currentNodeId);
    const currentNodeId = Number.isFinite(rawNodeId) ? Math.max(0, Math.floor(rawNodeId)) : 0;
    const lastSummary =
      progress?.lastSummary && typeof progress.lastSummary === 'object'
        ? JSON.parse(JSON.stringify(progress.lastSummary))
        : null;
    return { completedStage, currentNodeId, lastSummary };
  }

  global.normalizeOverworldProgressShared = normalizeOverworldProgressShared;

  global.isOwCombatNode = function (n) {
    if (typeof global.isForgeCombatNode === 'function') return global.isForgeCombatNode(n);
    if (!n) return false;
    const t = typeof global.getOwEffectiveNodeType === 'function'
      ? global.getOwEffectiveNodeType(n)
      : n.type;
    return t === 'stage' || t === 'boss' || t === 'bonus' || !!n.final;
  };

  function owBridgeEffectiveType(n) {
    if (!n) return '';
    if (typeof global.getOwEffectiveNodeType === 'function') return global.getOwEffectiveNodeType(n) || n.type || '';
    return n.type || '';
  }

  /** @param {Array} nodes overworld NODES array (id aligns with index) */
  global.inferOwCompletedStageFromNodeId = function (nodeId, nodes) {
    const arr = nodes || [];
    const n = arr[Math.max(0, Math.floor(Number(nodeId) || 0))];
    if (!n) return 0;
    if (global.isOwCombatNode(n)) return Math.max(0, Number(n.stage || 1) - 1);
    if (owBridgeEffectiveType(n) === 'shop') return Math.max(0, Number(arr[n.id - 1]?.stage || 0));
    return 0;
  };

  /** Highest combat stage number on a node list (main-map stages only). */
  global.getMaxStageFromOwNodes = function (nodes) {
    const arr = nodes || [];
    let max = 0;
    for (const n of arr) {
      if (!n) continue;
      const eff = owBridgeEffectiveType(n);
      if (eff === 'bonus' || eff === 'world' || eff === 'return') continue;
      if (!global.isOwCombatNode(n)) continue;
      max = Math.max(max, Math.floor(Number(n.stage || n.subStage) || 0));
    }
    return Math.max(1, max || 20);
  };

  /** @param {Array} nodes */
  global.buildStageToNodeMap = function (nodes) {
    /** @type {Record<number, number>} */
    const map = {};
    for (const n of nodes || []) {
      if (!global.isOwCombatNode(n)) continue;
      const st = Math.floor(Number(n.stage) || 0);
      if (st > 0) map[st] = Math.max(0, Math.floor(Number(n.id) || 0));
    }
    return map;
  };

  global.loadCustomOverworldMap = function () {
    try {
      const raw = global.localStorage.getItem(global.AVIAN_OW_KEYS.CUSTOM_MAP);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.nodes) || !parsed.nodes.length) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  global.getCustomOverworldMode = function () {
    try {
      return global.localStorage.getItem(global.AVIAN_OW_KEYS.CUSTOM_MODE) || null;
    } catch (_) {
      return null;
    }
  };

  global.isCustomOverworldActive = function () {
    const mode = global.getCustomOverworldMode();
    return mode === 'run' || mode === 'playtest';
  };

  global.getActiveCustomOverworldMaxStage = function () {
    if (!global.isCustomOverworldActive()) return null;
    const map = global.loadCustomOverworldMap();
    if (!map) return null;
    if (Number.isFinite(Number(map.maxStage)) && Number(map.maxStage) > 0) {
      return Math.floor(Number(map.maxStage));
    }
    return global.getMaxStageFromOwNodes(map.nodes);
  };

  global.persistCustomOverworldMap = function (mapDef) {
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.CUSTOM_MAP, JSON.stringify(mapDef));
      return true;
    } catch (_) {
      return false;
    }
  };

  global.setCustomOverworldMode = function (mode) {
    try {
      if (mode) global.localStorage.setItem(global.AVIAN_OW_KEYS.CUSTOM_MODE, String(mode));
      else global.localStorage.removeItem(global.AVIAN_OW_KEYS.CUSTOM_MODE);
    } catch (_) {}
  };

  global.clearCustomOverworldMode = function () {
    global.setCustomOverworldMode(null);
  };

  /**
   * Map node id for the next combat story stage after clearing `completedStage`
   * (matches blackstone_overworld_new.html NODES; shops are skipped).
   * @param {number} completedStage stage just cleared (1–20)
   * @param {Array|null} [nodes] optional custom node list
   * @returns {number|null} map node id, or null to use caller fallback (e.g. beat final stage)
   */
  global.resolveOverworldCursorNodeIdAfterClear = function (completedStage, nodes) {
    const st = Math.max(0, Math.floor(Number(completedStage) || 0));
    const nextStage = st + 1;
    if (Array.isArray(nodes) && nodes.length) {
      const maxStage = global.getMaxStageFromOwNodes(nodes);
      if (nextStage > maxStage) return null;
      const stageToNode = global.buildStageToNodeMap(nodes);
      const id = stageToNode[nextStage];
      return Number.isFinite(id) ? id : null;
    }
    if (nextStage > 20) return null;
    /** @type {Record<number, number>} */
    const stageToNode = {
      1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11,
      11: 13, 12: 14, 13: 15, 14: 17, 15: 18, 16: 19, 17: 20, 18: 21, 19: 22, 20: 23,
    };
    const id = stageToNode[nextStage];
    return Number.isFinite(id) ? id : null;
  };

  /**
   * Builds the overworldProgress object shown on the map (matches legacy bootstrap).
   */
  global.mergeOverworldBootstrapProgress = function (opts) {
    const savedProgress = opts.savedProgress || null;
    const owState = opts.owState || null;
    const saveStage = opts.saveStage;
    const nodes = opts.nodes || [];
    const maxStage = opts.maxStage != null
      ? Math.max(1, Math.floor(Number(opts.maxStage) || 20))
      : global.getMaxStageFromOwNodes(nodes);
    const owNodeId = Number(owState?.nodeId);
    const inferredCompletedStage = Number.isFinite(owNodeId)
      ? global.inferOwCompletedStageFromNodeId(owNodeId, nodes)
      : 0;
    const savedCompletedStage = Math.max(
      inferredCompletedStage,
      Math.max(0, Math.floor(Number(savedProgress?.completedStage ?? ((saveStage || 1) - 1)) || 0))
    );
    const savedNodeId = Number(savedProgress?.currentNodeId);
    const normalized = normalizeOverworldProgressShared(
      {
        completedStage: savedCompletedStage,
        currentNodeId: Number.isFinite(owNodeId)
          ? Math.max(0, Math.floor(owNodeId))
          : Number.isFinite(savedNodeId)
            ? Math.max(0, Math.floor(savedNodeId))
            : 0,
        lastSummary: savedProgress?.lastSummary || null,
      },
      Math.max(1, Number(saveStage) || 1),
      maxStage
    );
    return normalized;
  };

  global.readOwSaveParsed = function () {
    try {
      return JSON.parse(global.localStorage.getItem(global.AVIAN_OW_KEYS.SAVE) || 'null');
    } catch (_) {
      return null;
    }
  };

  global.readOwStateParsed = function () {
    try {
      return JSON.parse(global.localStorage.getItem(global.AVIAN_OW_KEYS.STATE) || 'null');
    } catch (_) {
      return null;
    }
  };

  global.persistOwMapSnapshot = function (nodeId, birdKey) {
    try {
      global.localStorage.setItem(
        global.AVIAN_OW_KEYS.STATE,
        JSON.stringify({ nodeId: nodeId, birdKey: birdKey })
      );
    } catch (_) {}
  };

  global.mergeOwStateWithCurrentNode = function (nodeId) {
    try {
      const raw = global.localStorage.getItem(global.AVIAN_OW_KEYS.STATE);
      if (!raw) return;
      const ow = JSON.parse(raw);
      ow.nodeId = nodeId;
      global.localStorage.setItem(global.AVIAN_OW_KEYS.STATE, JSON.stringify(ow));
    } catch (_) {}
  };

  global.persistOwNavIntent = function (obj) {
    try {
      global.localStorage.setItem(global.AVIAN_OW_KEYS.NAV, JSON.stringify(obj));
    } catch (_) {}
  };

  global.normalizeOwMapNodes = function (nodes) {
    const list = Array.isArray(nodes) ? nodes.slice() : [];
    const out = list.map((n, i) => {
      const copy = Object.assign({}, n);
      copy.id = i;
      copy.x = Math.round(Number(copy.x) || 0);
      copy.y = Math.round(Number(copy.y) || 0);
      if (copy.type === 'start') copy.stage = 0;
      if (copy.onPath === false) copy.onPath = false;
      else if (copy.onPath != null) copy.onPath = !!copy.onPath;
      if (copy.mustComplete) copy.mustComplete = true;
      else delete copy.mustComplete;
      if (copy.shopConfig && typeof copy.shopConfig === 'object') {
        copy.shopConfig = JSON.parse(JSON.stringify(copy.shopConfig));
      }
      return copy;
    });
    if (typeof global.ensureOwPathOrders === 'function') global.ensureOwPathOrders(out);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
