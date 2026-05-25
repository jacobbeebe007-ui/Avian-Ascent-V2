/**
 * Custom overworld map runtime: path reveal, forge encounters, world labels.
 */
(function (global) {
  'use strict';

  global.OW_MUTATION_BANDS = {
    grey: ['white'],
    grey_green: ['white', 'green'],
    green: ['green'],
    green_blue: ['green', 'blue'],
    blue: ['blue'],
    blue_purple: ['blue', 'purple'],
    purple: ['purple'],
    purple_gold: ['purple', 'gold'],
    gold: ['gold'],
  };

  global.OW_MUTATION_BAND_OPTIONS = [
    { id: 'grey', label: 'Grey' },
    { id: 'grey_green', label: 'Grey & Green' },
    { id: 'green', label: 'Green' },
    { id: 'green_blue', label: 'Green & Blue' },
    { id: 'blue', label: 'Blue' },
    { id: 'blue_purple', label: 'Blue & Purple' },
    { id: 'purple', label: 'Purple' },
    { id: 'purple_gold', label: 'Purple & Gold' },
    { id: 'gold', label: 'Gold' },
  ];

  global.isForgeCombatNode = function (n) {
    return !!n && (n.type === 'stage' || n.type === 'boss' || n.type === 'bonus' || n.final);
  };

  global.owNodeKey = function (mapId, nodeId) {
    return String(mapId || 'main') + ':' + Math.max(0, Math.floor(Number(nodeId) || 0));
  };

  global.defaultForgeEncounter = function (node) {
    const isBoss = node?.type === 'boss';
    const count = isBoss ? 1 : 3;
    const slots = [];
    for (let i = 0; i < count; i++) {
      slots.push({ birdKey: 'random', mutationBand: 'grey_green', maxMutations: isBoss ? 2 : 1 });
    }
    return { enemyCount: count, slots };
  };

  global.ensureNodeEncounter = function (node) {
    if (!node || !global.isForgeCombatNode(node)) return null;
    if (!node.encounter || !Array.isArray(node.encounter.slots)) {
      node.encounter = global.defaultForgeEncounter(node);
    }
    const enc = node.encounter;
    enc.enemyCount = Math.max(1, Math.min(5, Math.floor(Number(enc.enemyCount) || enc.slots.length || 1)));
    while (enc.slots.length < enc.enemyCount) {
      enc.slots.push({ birdKey: 'random', mutationBand: 'grey_green', maxMutations: 1 });
    }
    enc.slots = enc.slots.slice(0, enc.enemyCount).map((s) => ({
      birdKey: s.birdKey || 'random',
      mutationBand: s.mutationBand || 'grey_green',
      maxMutations: Math.max(0, Math.min(11, Math.floor(Number(s.maxMutations) || 0))),
    }));
    return enc;
  };

  global.getNodeDisplayLabel = function (node, worldIndex) {
    if (!node) return '';
    if (node.type === 'world') return node.name || 'World';
    if (node.type === 'bonus') return node.name || 'Bonus';
    if (node.type === 'return') return node.name || 'Return';
    if (node.type === 'shop') return node.name || 'Shop';
    if (node.type === 'start') return node.name || 'Start';
    if (worldIndex != null && Number(node.subStage) > 0) {
      return String(worldIndex) + '-' + String(node.subStage);
    }
    if (node.type === 'boss' && node.final) return 'Boss';
    if (global.isForgeCombatNode(node)) return String(node.stage || node.subStage || '');
    return node.name || '';
  };

  global.syntheticStageForWorldNode = function (worldIndex, subStage) {
    const wi = Math.max(1, Math.floor(Number(worldIndex) || 1));
    const ss = Math.max(1, Math.floor(Number(subStage) || 1));
    return wi * 100 + ss;
  };

  global.resolveForgeEncounterBirdKeys = function (encounter, playerBirdKey, scalingStage) {
    const enc = encounter || { enemyCount: 1, slots: [{ birdKey: 'random', mutationBand: 'grey_green', maxMutations: 1 }] };
    const st = Math.max(1, Math.floor(Number(scalingStage) || 1));
    const pbk = String(playerBirdKey || '').trim();
    let pool = [];
    if (typeof global.getStoryStageEnemyCandidateBirdKeys === 'function') {
      pool = global.getStoryStageEnemyCandidateBirdKeys(st, pbk).slice();
    } else if (typeof global.pickStoryEncounterBirdKeys === 'function') {
      pool = global.pickStoryEncounterBirdKeys(st, pbk).slice();
    }
    if (!pool.length) pool = ['sparrow', 'crow', 'magpie'];
    pool = pool.filter((k) => k && k !== pbk);
    if (!pool.length) pool = ['sparrow'];
    const out = [];
    const slots = enc.slots || [];
    for (let i = 0; i < enc.enemyCount; i++) {
      const slot = slots[i] || { birdKey: 'random' };
      if (slot.birdKey && slot.birdKey !== 'random') {
        out.push(slot.birdKey);
      } else {
        out.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    return out;
  };

  global.isOwSegmentSourceCleared = function (node, progress, mapId, mapDef) {
    if (!node) return false;
    if (node.type === 'start') return true;
    const prog = progress || {};
    const key = global.owNodeKey(mapId, node.id);
    if (prog.nodeClears && prog.nodeClears[key]) return true;
    if (node.type === 'world' && node.worldId && prog.worldsCompleted && prog.worldsCompleted[node.worldId]) {
      return true;
    }
    if (node.type === 'return') {
      const wid = mapDef?.worldId || mapId;
      return !!(prog.worldsCompleted && prog.worldsCompleted[wid]);
    }
    return false;
  };

  global.isPathSegmentRevealed = function (nodes, segmentIndex, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    const arr = nodes || [];
    const i = Math.max(0, Math.floor(Number(segmentIndex) || 0));
    if (i <= 0) return true;
    const source = arr[i];
    return global.isOwSegmentSourceCleared(source, progress, mapId, mapDef);
  };

  global.isNodeVisibleOnMap = function (nodes, nodeIndex, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    const arr = nodes || [];
    const idx = Math.max(0, Math.floor(Number(nodeIndex) || 0));
    const node = arr[idx];
    if (!node) return false;
    if (node.type === 'start') return true;
    if (global.isOwSegmentSourceCleared(node, progress, mapId, mapDef)) return true;
    return global.isPathSegmentRevealed(arr, idx, progress, mapId, mapDef, pathReveal);
  };

  global.upgradeMapToV2 = function (map) {
    const m = Object.assign({}, map || {});
    m.schemaVersion = 2;
    m.pathReveal = m.pathReveal !== false;
    m.worlds = m.worlds && typeof m.worlds === 'object' ? m.worlds : {};
    m.nodes = Array.isArray(m.nodes) ? m.nodes : [];
    let worldCount = 0;
    m.nodes.forEach((n) => {
      if (n.type === 'world') {
        worldCount += 1;
        if (!n.worldId) n.worldId = 'world' + worldCount;
        if (!m.worlds[n.worldId]) {
          m.worlds[n.worldId] = {
            name: n.name || 'World ' + worldCount,
            worldIndex: worldCount,
            backgroundDataUrl: '',
            nodes: [
              { id: 0, type: 'start', name: 'World Start', x: 768, y: 800, stage: 0 },
              { id: 1, type: 'return', name: 'Return Gate', x: 768, y: 200 },
            ],
          };
        }
      }
      if (global.isForgeCombatNode(n)) global.ensureNodeEncounter(n);
      if (n.type === 'bonus' && !n.bonusConfig) {
        n.bonusConfig = { powerProgression: true, maxRepeats: 5, rewards: [{ type: 'shinies', min: 15, max: 30 }] };
      }
    });
    Object.keys(m.worlds).forEach((wid) => global.recomputeWorldSubStages(m.worlds[wid]));
    return m;
  };

  global.recomputeWorldSubStages = function (worldDef) {
    if (!worldDef || !Array.isArray(worldDef.nodes)) return 0;
    let sub = 0;
    worldDef.nodes.forEach((n) => {
      if (n.type === 'start') {
        n.stage = 0;
        delete n.subStage;
      } else if (n.type === 'shop' || n.type === 'return' || n.type === 'world') {
        delete n.stage;
        delete n.subStage;
      } else if (n.type === 'stage' || n.type === 'boss' || n.type === 'bonus') {
        sub += 1;
        n.subStage = sub;
        delete n.stage;
        if (global.isForgeCombatNode(n)) global.ensureNodeEncounter(n);
      }
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

  global.grantForgeBonusRewards = function (player, bonusConfig, G) {
    if (!bonusConfig || !Array.isArray(bonusConfig.rewards)) return { shinies: 0, mutations: [] };
    const granted = { shinies: 0, mutations: [] };
    bonusConfig.rewards.forEach((r) => {
      if (!r) return;
      if (r.type === 'shinies') {
        const lo = Math.max(0, Math.floor(Number(r.min) || 0));
        const hi = Math.max(lo, Math.floor(Number(r.max) || lo));
        const gain = lo + Math.floor(Math.random() * (hi - lo + 1));
        granted.shinies += gain;
        if (G) G.shinyObjects = (G.shinyObjects || 0) + gain;
      } else if (r.type === 'mutation' && typeof global.Avian?.mutations?.rollEnemyMutationsFromForgeSlot === 'function') {
        const ids = global.Avian.mutations.rollEnemyMutationsFromForgeSlot({
          mutationBand: r.tierBand || 'blue_purple',
          maxMutations: 1,
          stage: G?.stage || 1,
          isBoss: false,
        });
        ids.forEach((id) => {
          if (id && typeof global.Avian.mutations.addToInventory === 'function') {
            global.Avian.mutations.addToInventory(player, id);
            granted.mutations.push(id);
          }
        });
      }
    });
    return granted;
  };
})(typeof window !== 'undefined' ? window : globalThis);
