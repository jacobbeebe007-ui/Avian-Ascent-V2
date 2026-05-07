/**
 * Shared overworld ↔ main game bridge: localStorage keys, progress shape,
 * and helpers used by js/core/game.js and blackstone_overworld_new.html.
 */
(function (global) {
  'use strict';

  global.AVIAN_OW_KEYS = {
    SAVE: 'avianAscent_save_v1',
    STATE: 'avianAscent_overworld',
    NAV: 'avianAscent_nav',
  };

  /**
   * Canonical merge — keep in sync with normalizeOverworldProgress in game.js callers.
   * @param {object|null|undefined} progress
   * @param {number} fallbackStage current story stage (ceiling for completedStage)
   */
  function normalizeOverworldProgressShared(progress, fallbackStage) {
    const nextStage = Math.max(1, Math.floor(Number(fallbackStage) || 1));
    const rawCompleted = Number(progress?.completedStage);
    const ceiling = Math.max(0, nextStage - 1);
    const merged = Math.min(
      20,
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

  /**
   * Map node id for the next combat story stage after clearing `completedStage`
   * (matches blackstone_overworld_new.html NODES; shops are skipped).
   * @param {number} completedStage stage just cleared (1–20)
   * @returns {number|null} map node id, or null to use caller fallback (e.g. beat stage 20)
   */
  global.resolveOverworldCursorNodeIdAfterClear = function (completedStage) {
    const st = Math.max(0, Math.floor(Number(completedStage) || 0));
    const nextStage = st + 1;
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
    const owNodeId = Number(owState?.nodeId);
    const inferredCompletedStage = Number.isFinite(owNodeId)
      ? global.inferOwCompletedStageFromNodeId(owNodeId, nodes)
      : 0;
    const savedCompletedStage = Math.max(
      inferredCompletedStage,
      Math.max(0, Math.floor(Number(savedProgress?.completedStage ?? ((saveStage || 1) - 1)) || 0))
    );
    const savedNodeId = Number(savedProgress?.currentNodeId);
    return {
      completedStage: savedCompletedStage,
      currentNodeId: Number.isFinite(owNodeId)
        ? Math.max(0, Math.floor(owNodeId))
        : Number.isFinite(savedNodeId)
          ? Math.max(0, Math.floor(savedNodeId))
          : 0,
      lastSummary: savedProgress?.lastSummary || null,
    };
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
})(typeof window !== 'undefined' ? window : globalThis);
