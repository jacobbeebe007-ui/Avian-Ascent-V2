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
    return !!n && (n.type === 'stage' || n.type === 'boss' || n.final);
  };

  /** @param {Array} nodes overworld NODES array (id aligns with index) */
  global.inferOwCompletedStageFromNodeId = function (nodeId, nodes) {
    const arr = nodes || [];
    const n = arr[Math.max(0, Math.floor(Number(nodeId) || 0))];
    if (!n) return 0;
    if (global.isOwCombatNode(n)) return Math.max(0, Number(n.stage || 1) - 1);
    if (n.type === 'shop') return Math.max(0, Number(arr[n.id - 1]?.stage || 0));
    return 0;
  };

  /** Highest combat stage number on a node list. */
  global.getMaxStageFromOwNodes = function (nodes) {
    const arr = nodes || [];
    let max = 0;
    for (const n of arr) {
      if (!global.isOwCombatNode(n)) continue;
      max = Math.max(max, Math.floor(Number(n.stage) || 0));
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
    return list.map((n, i) => {
      const copy = Object.assign({}, n);
      copy.id = i;
      copy.x = Math.round(Number(copy.x) || 0);
      copy.y = Math.round(Number(copy.y) || 0);
      if (copy.type === 'start') copy.stage = 0;
      return copy;
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
