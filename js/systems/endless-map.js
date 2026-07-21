/* Avian Ascent — Endless STS-style branching node map.
 *
 * Procedural path segments (no act floors). Room mix mirrors Slay the Spire
 * weights. Rest grants a pending max-HP% shield for the next combat.
 */
(function (global) {
  'use strict';

  var Avian = global.Avian || (global.Avian = { systems: {}, flags: {} });
  Avian.systems = Avian.systems || Object.create(null);

  var ENDLESS_REST_SHIELD_PCT = 0.30;
  var SEGMENT_CONTENT_FLOORS = 12; // floors 1..12 content; floor 0 start; floor 13 boss
  var ROOM_WEIGHTS = Object.freeze({
    combat: 53,
    elite: 8,
    rest: 12,
    merchant: 5,
    unknown: 22,
  });
  var UNKNOWN_BASE = Object.freeze({
    monster: 10,
    merchant: 3,
    treasure: 2,
    event: 85,
  });
  var ROOM_LABELS = Object.freeze({
    start: 'Start',
    combat: 'Combat',
    elite: 'Elite',
    rest: 'Rest',
    merchant: 'Merchant',
    unknown: 'Unknown',
    boss: 'Boss',
    treasure: 'Treasure',
  });
  var ROOM_ICONS = Object.freeze({
    start: '◆',
    combat: '⚔',
    elite: '☠',
    rest: '🏕',
    merchant: '💰',
    unknown: '?',
    boss: '👑',
    treasure: '💎',
  });

  function mulberry32(a) {
    return function () {
      var t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeedString(str) {
    var s = String(str || 'avian');
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function cloneUnknownTable() {
    return {
      monster: UNKNOWN_BASE.monster,
      merchant: UNKNOWN_BASE.merchant,
      treasure: UNKNOWN_BASE.treasure,
      event: UNKNOWN_BASE.event,
    };
  }

  function pickWeighted(rng, weights) {
    var total = 0;
    var keys = Object.keys(weights);
    for (var i = 0; i < keys.length; i++) total += Math.max(0, Number(weights[keys[i]]) || 0);
    if (total <= 0) return keys[0] || null;
    var roll = rng() * total;
    var acc = 0;
    for (var j = 0; j < keys.length; j++) {
      acc += Math.max(0, Number(weights[keys[j]]) || 0);
      if (roll < acc) return keys[j];
    }
    return keys[keys.length - 1];
  }

  function roomTypeForFloor(floor, depth, rng, parentType) {
    if (floor === 0) return 'start';
    if (floor === depth) return 'boss';
    var weights = {
      combat: ROOM_WEIGHTS.combat,
      elite: ROOM_WEIGHTS.elite,
      rest: ROOM_WEIGHTS.rest,
      merchant: ROOM_WEIGHTS.merchant,
      unknown: ROOM_WEIGHTS.unknown,
    };
    if (floor <= 2) {
      weights.combat += 25;
      weights.elite = Math.max(0, weights.elite - 4);
      weights.rest = Math.max(0, weights.rest - 6);
      weights.merchant = Math.max(0, weights.merchant - 2);
    }
    if (parentType === 'rest') weights.rest = 0;
    if (parentType === 'merchant') weights.merchant = 0;
    return pickWeighted(rng, weights) || 'combat';
  }

  function countNodesOnFloor(map, floor) {
    if (!map || !Array.isArray(map.nodes)) return 1;
    var count = 0;
    for (var i = 0; i < map.nodes.length; i++) {
      if (map.nodes[i].floor === floor) count++;
    }
    return Math.max(1, count);
  }

  function getNodeDisplayPosition(node, map) {
    var depth = Math.max(1, map && map.depth ? map.depth : SEGMENT_CONTENT_FLOORS + 1);
    var floor = Math.max(0, Math.floor(Number(node.floor) || 0));
    var slot = Math.max(0, Math.floor(Number(node.slot) || 0));
    var countOnFloor = countNodesOnFloor(map, floor);
    return {
      x: countOnFloor <= 1 ? 0.5 : (slot + 1) / (countOnFloor + 1),
      y: floor / depth,
    };
  }

  function recomputeNodePositions(map) {
    if (!map || !Array.isArray(map.nodes)) return;
    map.nodes.forEach(function (n) {
      var pos = getNodeDisplayPosition(n, map);
      n.x = pos.x;
      n.y = pos.y;
    });
  }

  function ensureSoftRequirements(nodes, rng) {
    var hasRest = nodes.some(function (n) { return n.type === 'rest'; });
    var hasMerchant = nodes.some(function (n) { return n.type === 'merchant'; });
    var candidates = nodes.filter(function (n) {
      return n.type === 'combat' || n.type === 'unknown';
    });
    function convertOne(toType) {
      if (!candidates.length) return;
      var idx = Math.floor(rng() * candidates.length);
      var node = candidates.splice(idx, 1)[0];
      if (node) node.type = toType;
    }
    if (!hasRest) convertOne('rest');
    if (!hasMerchant) convertOne('merchant');
  }

  function buildSegment(runSeed, segmentIndex) {
    var seg = Math.max(0, Math.floor(Number(segmentIndex) || 0));
    var seedNum = (hashSeedString(String(runSeed || 'avian') + ':seg:' + seg) ^ (seg * 0x9e3779b9)) >>> 0;
    var rng = mulberry32(seedNum || 1);
    var depth = SEGMENT_CONTENT_FLOORS + 1; // boss floor index
    var nodes = [];
    var edges = [];
    var byFloor = [];
    var id = 0;

    function addNode(floor, slot, countOnFloor, type) {
      var node = {
        id: 'n' + id++,
        floor: floor,
        slot: slot,
        type: type,
        x: countOnFloor <= 1 ? 0.5 : (slot + 1) / (countOnFloor + 1),
        y: floor / depth,
      };
      nodes.push(node);
      return node;
    }

    byFloor[0] = [addNode(0, 0, 1, 'start')];
    for (var f = 1; f < depth; f++) {
      var count = 2 + Math.floor(rng() * 3); // 2–4
      byFloor[f] = [];
      for (var s = 0; s < count; s++) {
        byFloor[f].push(addNode(f, s, count, 'combat'));
      }
    }
    byFloor[depth] = [addNode(depth, 0, 1, 'boss')];

    // Assign types with parent-adjacency soft rules (use min parent floor connection later)
    for (var floor = 1; floor < depth; floor++) {
      var row = byFloor[floor];
      for (var i = 0; i < row.length; i++) {
        var approxParent = byFloor[floor - 1][Math.min(i, byFloor[floor - 1].length - 1)];
        row[i].type = roomTypeForFloor(floor, depth, rng, approxParent && approxParent.type);
      }
    }
    ensureSoftRequirements(nodes.filter(function (n) {
      return n.floor > 0 && n.floor < depth;
    }), rng);

    // Edges: connect each node to 1–2 children; guarantee every child has a parent
    for (var fl = 0; fl < depth; fl++) {
      var parents = byFloor[fl];
      var children = byFloor[fl + 1];
      var childHasParent = children.map(function () { return false; });
      for (var p = 0; p < parents.length; p++) {
        var parent = parents[p];
        var ideal = Math.round((p / Math.max(1, parents.length - 1)) * Math.max(0, children.length - 1));
        var targets = [];
        targets.push(Math.max(0, Math.min(children.length - 1, ideal)));
        if (rng() < 0.55 && children.length > 1) {
          var second = ideal + (rng() < 0.5 ? -1 : 1);
          second = Math.max(0, Math.min(children.length - 1, second));
          if (second !== targets[0]) targets.push(second);
        }
        for (var t = 0; t < targets.length; t++) {
          var ci = targets[t];
          edges.push({ from: parent.id, to: children[ci].id });
          childHasParent[ci] = true;
        }
      }
      for (var c = 0; c < children.length; c++) {
        if (childHasParent[c]) continue;
        var nearest = Math.round((c / Math.max(1, children.length - 1)) * Math.max(0, parents.length - 1));
        edges.push({ from: parents[nearest].id, to: children[c].id });
      }
    }

    return {
      segmentIndex: seg,
      seed: seedNum,
      depth: depth,
      nodes: nodes,
      edges: edges,
    };
  }

  function createEndlessMapState(runSeed, segmentIndex) {
    var segment = buildSegment(runSeed, segmentIndex);
    var start = segment.nodes.find(function (n) { return n.type === 'start'; });
    return {
      version: 1,
      runSeed: String(runSeed || ''),
      segmentIndex: segment.segmentIndex,
      depth: segment.depth,
      nodes: segment.nodes,
      edges: segment.edges,
      currentNodeId: start ? start.id : null,
      visitedNodeIds: start ? [start.id] : [],
      unknownTable: cloneUnknownTable(),
      pendingRestShieldPct: 0,
      pendingCombatKind: null,
      activeNodeId: null,
      fromMapGrove: false,
      fromMapMerchant: false,
      lastMessage: '',
    };
  }

  function isEndlessMapActive(G) {
    return !!(G && G.endlessMode && G.endlessMap && Array.isArray(G.endlessMap.nodes));
  }

  function getNode(map, nodeId) {
    if (!map || !nodeId) return null;
    return map.nodes.find(function (n) { return n.id === nodeId; }) || null;
  }

  function isVisited(map, nodeId) {
    return !!(map && Array.isArray(map.visitedNodeIds) && map.visitedNodeIds.indexOf(nodeId) >= 0);
  }

  function getOutgoing(map, nodeId) {
    if (!map) return [];
    return (map.edges || [])
      .filter(function (e) { return e.from === nodeId; })
      .map(function (e) { return getNode(map, e.to); })
      .filter(Boolean);
  }

  function getAvailableNodeIds(map) {
    if (!map || !map.currentNodeId) return [];
    return getOutgoing(map, map.currentNodeId)
      .filter(function (n) { return !isVisited(map, n.id); })
      .map(function (n) { return n.id; });
  }

  function markVisited(map, nodeId) {
    if (!map || !nodeId) return;
    if (!Array.isArray(map.visitedNodeIds)) map.visitedNodeIds = [];
    if (map.visitedNodeIds.indexOf(nodeId) < 0) map.visitedNodeIds.push(nodeId);
    map.currentNodeId = nodeId;
  }

  function resolveUnknown(map, rngFn) {
    var table = map.unknownTable || cloneUnknownTable();
    var rng = typeof rngFn === 'function' ? rngFn : Math.random;
    var picked = pickWeighted(rng, table) || 'event';
    var keys = Object.keys(table);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === picked) table[k] = UNKNOWN_BASE[k];
      else table[k] = (Number(table[k]) || 0) + 1;
    }
    map.unknownTable = table;
    if (picked === 'monster') return 'combat';
    if (picked === 'merchant') return 'merchant';
    if (picked === 'treasure') return 'treasure';
    return 'event';
  }

  function serializeEndlessMap(map) {
    if (!map) return null;
    try {
      return JSON.parse(JSON.stringify(map));
    } catch (_e) {
      return null;
    }
  }

  function restoreEndlessMap(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
    var map = {
      version: 1,
      runSeed: String(raw.runSeed || ''),
      segmentIndex: Math.max(0, Math.floor(Number(raw.segmentIndex) || 0)),
      depth: Math.max(1, Math.floor(Number(raw.depth) || SEGMENT_CONTENT_FLOORS + 1)),
      nodes: JSON.parse(JSON.stringify(raw.nodes)),
      edges: JSON.parse(JSON.stringify(raw.edges)),
      currentNodeId: raw.currentNodeId || null,
      visitedNodeIds: Array.isArray(raw.visitedNodeIds) ? raw.visitedNodeIds.slice() : [],
      unknownTable: raw.unknownTable && typeof raw.unknownTable === 'object'
        ? Object.assign(cloneUnknownTable(), raw.unknownTable)
        : cloneUnknownTable(),
      pendingRestShieldPct: Math.max(0, Number(raw.pendingRestShieldPct) || 0),
      pendingCombatKind: raw.pendingCombatKind || null,
      activeNodeId: raw.activeNodeId || null,
      fromMapGrove: !!raw.fromMapGrove,
      fromMapMerchant: !!raw.fromMapMerchant,
      lastMessage: String(raw.lastMessage || ''),
    };
    recomputeNodePositions(map);
    return map;
  }

  function advanceToNextSegment(map, runSeed) {
    var nextIndex = (map && map.segmentIndex != null ? map.segmentIndex : 0) + 1;
    var next = createEndlessMapState(runSeed || (map && map.runSeed) || '', nextIndex);
    next.pendingRestShieldPct = map && map.pendingRestShieldPct ? map.pendingRestShieldPct : 0;
    return next;
  }

  function renderEndlessMapInto(container, map, opts) {
    opts = opts || {};
    if (!container || !map) return;
    var available = {};
    getAvailableNodeIds(map).forEach(function (id) { available[id] = true; });
    var hp = opts.hp != null ? opts.hp : '—';
    var maxHp = opts.maxHp != null ? opts.maxHp : '—';
    var shinies = opts.shinies != null ? opts.shinies : 0;
    var birdName = opts.birdName || 'Bird';
    var msg = map.lastMessage ? '<div class="em-map-msg">' + escapeHtml(map.lastMessage) + '</div>' : '';

    var edgesSvg = '<svg class="em-map-edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">';
    (map.edges || []).forEach(function (e) {
      var a = getNode(map, e.from);
      var b = getNode(map, e.to);
      if (!a || !b) return;
      var posA = getNodeDisplayPosition(a, map);
      var posB = getNodeDisplayPosition(b, map);
      var x1 = posA.x * 100;
      var y1 = posA.y * 100;
      var x2 = posB.x * 100;
      var y2 = posB.y * 100;
      edgesSvg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" />';
    });
    edgesSvg += '</svg>';

    var nodesHtml = '';
    (map.nodes || []).forEach(function (n) {
      var visited = isVisited(map, n.id);
      var isCurrent = map.currentNodeId === n.id;
      var isAvail = !!available[n.id];
      var cls = 'em-node em-node-' + n.type;
      if (visited) cls += ' is-visited';
      if (isCurrent) cls += ' is-current';
      if (isAvail) cls += ' is-available';
      if (!visited && !isAvail && !isCurrent) cls += ' is-locked';
      var label = ROOM_LABELS[n.type] || n.type;
      var icon = ROOM_ICONS[n.type] || '•';
      var disabled = isAvail ? '' : ' disabled';
      var action = isAvail ? ' data-action="endlessMapSelectNode:' + n.id + '"' : '';
      var pos = getNodeDisplayPosition(n, map);
      nodesHtml +=
        '<button type="button" class="' + cls + '" style="left:' + (pos.x * 100) + '%;top:' + (pos.y * 100) + '%;"' +
        action + disabled + ' title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '">' +
        '<span class="em-node-icon">' + icon + '</span>' +
        '<span class="em-node-label">' + escapeHtml(label) + '</span>' +
        '</button>';
    });

    container.innerHTML =
      '<div class="em-map-hud">' +
        '<div class="em-map-hud-left">' +
          '<span class="em-map-title">Endless Path</span>' +
          '<span class="em-map-meta">Segment ' + (map.segmentIndex + 1) + '</span>' +
        '</div>' +
        '<div class="em-map-hud-right">' +
          '<span>' + escapeHtml(birdName) + '</span>' +
          '<span>HP ' + hp + '/' + maxHp + '</span>' +
          '<span>🌟 ' + shinies + '</span>' +
        '</div>' +
      '</div>' +
      msg +
      '<div class="em-map-canvas">' + edgesSvg + nodesHtml + '</div>' +
      '<p class="em-map-hint">Choose an open path to continue.</p>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var api = {
    ENDLESS_REST_SHIELD_PCT: ENDLESS_REST_SHIELD_PCT,
    ROOM_WEIGHTS: ROOM_WEIGHTS,
    ROOM_LABELS: ROOM_LABELS,
    ROOM_ICONS: ROOM_ICONS,
    createEndlessMapState: createEndlessMapState,
    isEndlessMapActive: isEndlessMapActive,
    getNode: getNode,
    getAvailableNodeIds: getAvailableNodeIds,
    markVisited: markVisited,
    resolveUnknown: resolveUnknown,
    serializeEndlessMap: serializeEndlessMap,
    restoreEndlessMap: restoreEndlessMap,
    advanceToNextSegment: advanceToNextSegment,
    renderEndlessMapInto: renderEndlessMapInto,
    hashSeedString: hashSeedString,
    mulberry32: mulberry32,
  };

  Avian.systems.endlessMap = api;
  global.EndlessMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
