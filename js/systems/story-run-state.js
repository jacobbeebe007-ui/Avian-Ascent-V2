/**
 * Story-run checkpoint ledger.
 *
 * This deliberately complements (rather than replaces) the combat save in game.js:
 * it records navigation/reward/shop checkpoints without ever serialising a half turn.
 */
(function (global) {
  'use strict';

  const KEY = 'avianAscent_story_run_v1';
  const COMPLETIONS_KEY = 'avianAscent_story_completions_v1';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function blank() {
    return {
      version: 1, mode: 'story', active: false, playerBirdId: null,
      currentMapId: null, currentNodeId: null, encountersCompleted: 0,
      bossDefeated: false, runInventory: [], rewardsEarned: [],
      shopsVisited: [], runFlags: {}, startedAt: null, checkpoint: 'war-room',
      updatedAt: null,
    };
  }
  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(global.localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) { return fallback; }
  }
  function load() {
    const raw = readJson(KEY, blank());
    return Object.assign(blank(), raw, {
      runInventory: Array.isArray(raw.runInventory) ? raw.runInventory : [],
      rewardsEarned: Array.isArray(raw.rewardsEarned) ? raw.rewardsEarned : [],
      shopsVisited: Array.isArray(raw.shopsVisited) ? raw.shopsVisited : [],
      runFlags: raw.runFlags && typeof raw.runFlags === 'object' ? raw.runFlags : {},
    });
  }
  function save(state) {
    const next = Object.assign(blank(), state || {}, { updatedAt: Date.now() });
    try { global.localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
    return clone(next);
  }
  function start(playerBirdId, mapId) {
    if (!playerBirdId) throw new Error('[story-flow] Cannot begin ascent: player bird is missing.');
    return save(Object.assign(blank(), {
      active: true, playerBirdId: String(playerBirdId),
      currentMapId: String(mapId || 'story-blackstone'), currentNodeId: 0,
      startedAt: Date.now(), checkpoint: 'map',
    }));
  }
  function checkpoint(name, patch) {
    const current = load();
    if (!current.active && name !== 'war-room') return current;
    return save(Object.assign(current, patch || {}, { checkpoint: String(name || current.checkpoint) }));
  }
  function enterNode(nodeId, mapId, kind) {
    return checkpoint(kind === 'shop' ? 'shop' : 'encounter', {
      currentNodeId: nodeId, currentMapId: mapId || load().currentMapId,
      runFlags: Object.assign({}, load().runFlags, { combatRestoreSupported: false }),
    });
  }
  function collectReward(reward) {
    const current = load();
    const id = String(reward?.id || reward?.equipmentItemId || reward?.name || 'reward');
    if (current.rewardsEarned.some((entry) => entry.checkpointId === id + ':' + current.currentNodeId)) return current;
    current.rewardsEarned.push({ checkpointId: id + ':' + current.currentNodeId, id, name: reward?.name || id });
    if (reward?.equipmentItemId && !current.runInventory.includes(reward.equipmentItemId)) current.runInventory.push(reward.equipmentItemId);
    return checkpoint('reward-collected', current);
  }
  function visitShop(nodeId) {
    const current = load();
    const id = String(nodeId == null ? current.currentNodeId : nodeId);
    if (!current.shopsVisited.includes(id)) current.shopsVisited.push(id);
    return checkpoint('shop-purchase', current);
  }
  function winEncounter(isBoss) {
    const current = load();
    const completed = Object.assign({}, current.runFlags.completedNodes || {});
    const key = String(current.currentMapId) + ':' + String(current.currentNodeId);
    if (!completed[key]) current.encountersCompleted += 1;
    completed[key] = true;
    current.runFlags.completedNodes = completed;
    if (isBoss) current.bossDefeated = true;
    return checkpoint(isBoss ? 'boss-victory' : 'victory', current);
  }
  function complete(summary) {
    const current = load();
    const record = Object.assign({ completedAt: Date.now() }, current, summary || {});
    const history = readJson(COMPLETIONS_KEY, []);
    const list = Array.isArray(history) ? history : [];
    list.unshift(record);
    try { global.localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(list.slice(0, 20))); } catch (_) {}
    save(Object.assign(blank(), { checkpoint: 'war-room' }));
    return clone(record);
  }

  global.Avian = global.Avian || {};
  global.Avian.storyRun = { KEY, COMPLETIONS_KEY, blank, load, save, start, checkpoint, enterNode, collectReward, visitShop, winEncounter, complete };
})(typeof window !== 'undefined' ? window : globalThis);
