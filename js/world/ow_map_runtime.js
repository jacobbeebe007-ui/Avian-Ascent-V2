/**
 * Custom overworld map runtime: path reveal, forge encounters, world labels.
 */
(function (global) {
  'use strict';

  global.OW_CARD_TIER_MUTATION_OPTIONS = [
    { id: 'grey', label: 'Grey' },
    { id: 'green', label: 'Green' },
    { id: 'blue', label: 'Blue' },
    { id: 'purple', label: 'Purple' },
    { id: 'gold', label: 'Gold' },
    { id: 'orange', label: 'Orange' },
  ];

  global.OW_MUTATION_BANDS = {
    grey: ['white'],
    green: ['green'],
    blue: ['blue'],
    purple: ['purple'],
    gold: ['gold'],
    orange: ['orange'],
    grey_green: ['white', 'green'],
    green_blue: ['green', 'blue'],
    blue_purple: ['blue', 'purple'],
    purple_gold: ['purple', 'gold'],
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
    { id: 'orange', label: 'Orange' },
  ];

  global.isForgeCombatNode = function (n) {
    return !!n && (n.type === 'stage' || n.type === 'boss' || n.type === 'bonus' || n.final);
  };

  global.OW_MAP_UI_ACTIONS = [
    { id: 'none', label: 'None' },
    { id: 'nest', label: 'Nest' },
    { id: 'settings', label: 'Settings' },
    { id: 'reference', label: 'Reference' },
    { id: 'openLocation', label: 'Open location' },
    { id: 'prevNode', label: 'Previous node' },
    { id: 'nextNode', label: 'Next node' },
  ];

  global.OW_MAP_UI_ACTION_LABELS = {
    nest: 'Nest',
    settings: 'Settings',
    reference: 'Reference',
    openLocation: 'Open',
    prevNode: 'Prev',
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
    };
  };

  global.ensureLabelConfig = function (node) {
    if (!node || node.type !== 'label') return null;
    const def = global.defaultLabelConfig();
    const cfg = node.labelConfig && typeof node.labelConfig === 'object' ? node.labelConfig : {};
    const uiAction = global.getOwMapUiAction({ uiAction: cfg.uiAction }) || 'none';
    node.labelConfig = {
      text: String(cfg.text != null ? cfg.text : def.text),
      mimicType: cfg.mimicType || def.mimicType,
      shape: cfg.shape || def.shape,
      width: Math.max(16, Math.min(400, Math.floor(Number(cfg.width) || def.width))),
      height: Math.max(12, Math.min(200, Math.floor(Number(cfg.height) || def.height))),
      showText: cfg.showText !== false,
      showBorder: cfg.showBorder !== false,
      showFill: cfg.showFill !== false,
      actsAsNode: uiAction !== 'none' ? false : !!cfg.actsAsNode,
      uiAction,
    };
    return node.labelConfig;
  };

  global.isOwPathNode = function (n) {
    if (!n) return false;
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

  global.getOwEffectiveNodeType = function (n) {
    if (!n) return '';
    if (n.type === 'label' && n.labelConfig && n.labelConfig.actsAsNode) {
      return n.labelConfig.mimicType || 'none';
    }
    return n.type || '';
  };

  global.getOwEffectiveNode = function (n) {
    if (!n || n.type !== 'label' || !n.labelConfig || !n.labelConfig.actsAsNode) return n;
    const t = global.getOwEffectiveNodeType(n);
    if (!t || t === 'none') return n;
    return Object.assign({}, n, { type: t, _labelProxy: true });
  };

  global.owNodeKey = function (mapId, nodeId) {
    return String(mapId || 'main') + ':' + Math.max(0, Math.floor(Number(nodeId) || 0));
  };

  global.defaultForgeEncounter = function (node) {
    const isBoss = node?.type === 'boss';
    const count = isBoss ? 1 : 3;
    const slots = [];
    for (let i = 0; i < count; i++) {
      slots.push({ birdKey: 'random', enemyTier: 'grey', enemyStars: 0, mutationBand: 'green', maxMutations: isBoss ? 2 : 1 });
    }
    return { enemyCount: count, slots };
  };

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
      return slot;
    });
    return enc;
  };

  global.getNodeDisplayLabel = function (node, worldIndex) {
    if (!node) return '';
    if (node.type === 'world') return node.name || 'World';
    if (node.type === 'bonus') return node.name || 'Bonus';
    if (node.type === 'return') return node.name || 'Return';
    if (node.type === 'overworld') return node.name || 'Overworld';
    if (node.type === 'shop') return node.name || 'Shop';
    if (node.type === 'start') return node.name || 'Start';
    if (node.type === 'label') return node.labelConfig?.text || node.name || 'Label';
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
    const pathIdx = global.getPathNodeIndices(arr);
    const i = Math.max(0, Math.floor(Number(segmentIndex) || 0));
    if (i <= 0) return true;
    const nodeIdx = pathIdx[i];
    if (nodeIdx == null) return true;
    const source = arr[nodeIdx];
    return global.isOwSegmentSourceCleared(source, progress, mapId, mapDef);
  };

  global.isNodeVisibleOnMap = function (nodes, nodeIndex, progress, mapId, mapDef, pathReveal) {
    if (!pathReveal) return true;
    const arr = nodes || [];
    const idx = Math.max(0, Math.floor(Number(nodeIndex) || 0));
    const node = arr[idx];
    if (!node) return false;
    if (node.type === 'label' && !(node.labelConfig && node.labelConfig.actsAsNode)) return true;
    if (node.type === 'start') return true;
    if (global.isOwSegmentSourceCleared(node, progress, mapId, mapDef)) return true;
    const pathIdx = global.getPathNodeIndices(arr);
    const pathPos = pathIdx.indexOf(idx);
    if (pathPos < 0) return true;
    return global.isPathSegmentRevealed(arr, pathPos, progress, mapId, mapDef, pathReveal);
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
      if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
      if (n.type === 'bonus' && !n.bonusConfig) {
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
    Object.keys(m.worlds).forEach((wid) => {
      const w = m.worlds[wid];
      if (w?.nodes) {
        w.nodes.forEach((n) => {
          if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
          if (global.isForgeCombatNode(n)) {
            if (!Array.isArray(n.clearRewards) && n.bonusConfig?.rewards?.length) {
              n.clearRewards = JSON.parse(JSON.stringify(n.bonusConfig.rewards));
              delete n.bonusConfig.rewards;
            }
            if (!Array.isArray(n.clearRewards)) n.clearRewards = [];
          }
        });
      }
      global.recomputeWorldSubStages(w);
    });
    return m;
  };

  global.recomputeWorldSubStages = function (worldDef) {
    if (!worldDef || !Array.isArray(worldDef.nodes)) return 0;
    let sub = 0;
    worldDef.nodes.forEach((n) => {
      if (n.type === 'start') {
        n.stage = 0;
        delete n.subStage;
      } else if (n.type === 'shop' || n.type === 'return' || n.type === 'world' || n.type === 'overworld' || n.type === 'label') {
        delete n.stage;
        delete n.subStage;
      } else if (n.type === 'stage' || n.type === 'boss' || n.type === 'bonus') {
        sub += 1;
        n.subStage = sub;
        delete n.stage;
        if (global.isForgeCombatNode(n)) global.ensureNodeEncounter(n);
      if (n.type === 'label' && global.ensureLabelConfig) global.ensureLabelConfig(n);
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

  global.grantForgeClearRewards = function (player, rewards, G) {
    const empty = { shinies: 0, mutations: [], items: [], nests: 0, savedEggs: 0, goldenGoose: 0, feathers: [] };
    if (!Array.isArray(rewards) || !rewards.length) return empty;
    const granted = Object.assign({}, empty, { mutations: [], items: [], feathers: [] });
    const rollForgeMutation = (band) => {
      if (typeof global.Avian?.mutations?.rollEnemyMutationsFromForgeSlot !== 'function') return [];
      return global.Avian.mutations.rollEnemyMutationsFromForgeSlot({
        mutationBand: band || 'blue',
        maxMutations: 1,
        stage: G?.stage || 1,
        isBoss: false,
      });
    };
    const grantMutationIds = (ids) => {
      ids.forEach((id) => {
        if (id && typeof global.Avian?.mutations?.addToInventory === 'function') {
          global.Avian.mutations.addToInventory(player, id);
          granted.mutations.push(id);
        }
      });
    };
    rewards.forEach((r) => {
      if (!r) return;
      if (r.type === 'shinies') {
        const lo = Math.max(0, Math.floor(Number(r.min) || 0));
        const hi = Math.max(lo, Math.floor(Number(r.max) || lo));
        const gain = lo + Math.floor(Math.random() * (hi - lo + 1));
        granted.shinies += gain;
        if (G) G.shinyObjects = (G.shinyObjects || 0) + gain;
      } else if (r.type === 'mutation') {
        const count = Math.max(1, Math.floor(Number(r.count) || 1));
        const band = r.tierBand || r.tier || 'blue';
        for (let i = 0; i < count; i++) grantMutationIds(rollForgeMutation(band));
      } else if (r.type === 'nest' && Array.isArray(r.slots)) {
        r.slots.forEach((slot) => {
          grantMutationIds(rollForgeMutation(slot?.tier || 'blue'));
          granted.nests += 1;
        });
      } else if (r.type === 'item' && r.itemKey) {
        const lo = Math.max(0, Math.floor(Number(r.min) || Number(r.qty) || 1));
        const hi = Math.max(lo, Math.floor(Number(r.max) || lo));
        const qty = lo + Math.floor(Math.random() * (hi - lo + 1));
        if (typeof global.addCombatItem === 'function') global.addCombatItem(player, r.itemKey, qty);
        granted.items.push({ itemKey: r.itemKey, quantity: qty });
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
      if (n.type === 'world') worlds += 1;
      else if (n.type === 'bonus') {
        bonus += 1;
        if (n.bonusConfig?.powerProgression) bonusPower.push(n.bonusConfig.maxRepeats || 5);
      } else if (n.type === 'shop') shop += 1;
      else if (n.type === 'stage' || n.type === 'boss') combat += 1;
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
      avgMutTier: mutCount ? (mutSum / mutCount).toFixed(1) : '—',
      bonusPower,
      mapId: slice.mapId,
    };
  };

  global.collectMapValidationIssues = function (map) {
    const issues = [];
    const add = (severity, message, mapId, nodeId) => issues.push({ severity, message, mapId: mapId || 'main', nodeId: nodeId ?? null });

    const nodes = map?.nodes || [];
    if (!nodes.length) add('error', 'Add at least one node.');
    if (nodes.filter((n) => n.type === 'start').length !== 1) add('error', 'Exactly one Spawn node required.');
    if (nodes[0] && nodes[0].type !== 'start') add('error', 'First node must be Spawn.');
    if (!nodes.some((n) => n.type === 'stage' || n.type === 'boss')) add('error', 'Add at least one Stage or Boss.');
    if (!map?.backgroundDataUrl) add('error', 'Upload a main map background image.');

    const worldIdsUsed = new Set(nodes.filter((n) => n.type === 'world' && n.worldId).map((n) => n.worldId));
    Object.keys(map?.worlds || {}).forEach((wid) => {
      if (!worldIdsUsed.has(wid)) add('error', 'Orphaned world data: ' + wid, 'main', null);
    });

    if (!nodes.some((n) => n.type === 'boss' && n.final)) add('warning', 'No final boss marked on main map.');

    const owGates = nodes.filter((n) => n.type === 'overworld');
    if (owGates.length > 1) add('warning', 'Multiple Overworld gates on main map — players may confuse which to use.', 'main', owGates[1]?.id);

    let firstCombatIdx = nodes.findIndex((n) => n.type === 'stage' || n.type === 'boss');
    const shopBeforeCombat = nodes.findIndex((n, i) => n.type === 'shop' && (firstCombatIdx < 0 || i < firstCombatIdx));
    if (shopBeforeCombat >= 0) add('warning', 'Shop appears before first combat node.', 'main', nodes[shopBeforeCombat]?.id);

    nodes.forEach((n) => {
      if (n.type === 'label') {
        const cfg = n.labelConfig || {};
        const uiAction = global.getOwMapUiAction(cfg);
        if (uiAction && cfg.actsAsNode) {
          add('warning', 'Label cannot use both a UI button and node proxy — pick one role.', 'main', n.id);
        }
        if (cfg.actsAsNode && (!cfg.mimicType || cfg.mimicType === 'none')) {
          add('warning', 'Functional label needs a mimic class.', 'main', n.id);
        }
        if (cfg.actsAsNode && !cfg.showFill && !cfg.showBorder && !cfg.showText) {
          const mt = cfg.mimicType;
          if (!mt || mt === 'none') add('warning', 'Invisible functional label has no action.', 'main', n.id);
        }
        if (uiAction && !cfg.showFill && !cfg.showBorder && !cfg.showText) {
          add('warning', 'Invisible UI button — add text or border so players can find it.', 'main', n.id);
        }
        return;
      }
      if (n.type === 'bonus' && (!Array.isArray(n.clearRewards) || !n.clearRewards.length)) {
        add('warning', 'Bonus node has no clear rewards.', 'main', n.id);
      }
    });

    Object.keys(map?.worlds || {}).forEach((wid) => {
      const w = map.worlds[wid];
      const wn = w?.nodes || [];
      if (!w?.backgroundDataUrl) add('warning', 'World "' + (w.name || wid) + '" has no background.', wid, null);
      if (!wn.some((n) => n.type === 'return')) add('warning', 'World "' + (w.name || wid) + '" missing return gate.', wid, null);
      if (!wn.some((n) => n.type === 'boss')) add('warning', 'World "' + (w.name || wid) + '" missing boss.', wid, null);
      const bossIdx = wn.findIndex((n) => n.type === 'boss');
      const retIdx = wn.findIndex((n) => n.type === 'return');
      if (bossIdx >= 0 && retIdx >= 0 && retIdx <= bossIdx) {
        add('warning', 'Return gate should come after boss in path order.', wid, wn[retIdx]?.id);
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
          matk: Math.max(1, Math.floor(s.matk || 8)),
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
    let matk = Math.max(1, Math.floor(bd.stats?.matk || 8));
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
