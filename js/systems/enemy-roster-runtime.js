/**
 * Enemy roster lookup and combat draft builder (Master Bird List import).
 */
(function initEnemyRosterRuntime(global) {
  'use strict';

  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.enemyRoster = Avian.systems.enemyRoster || {};

  function roster() {
    return Avian.data && Avian.data.enemyRoster;
  }

  function isRosterEnemyId(tok) {
    var s = String(tok || '');
    return s.indexOf('EN-') === 0 || s.indexOf('BO-') === 0;
  }

  function normalizeBirdKey(key) {
    return String(key || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase();
  }

  function pickRandom(arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr) {
    var clone = arr.slice();
    for (var i = clone.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = clone[i];
      clone[i] = clone[j];
      clone[j] = t;
    }
    return clone;
  }

  function getRosterRow(enemyId) {
    var r = roster();
    return r && r.byId ? r.byId[enemyId] : null;
  }

  function filterNormalPoolForBand(band, playerBirdKey) {
    var r = roster();
    if (!r || !r.normalByLevel) return [];
    var playerNorm = normalizeBirdKey(playerBirdKey);
    var out = [];
    var min = Math.max(1, band.min || 1);
    var max = Math.max(min, band.max || min);
    for (var lv = min; lv <= max; lv++) {
      var ids = r.normalByLevel[lv] || [];
      for (var i = 0; i < ids.length; i++) {
        var row = getRosterRow(ids[i]);
        if (!row || row.isBoss) continue;
        if (playerNorm && normalizeBirdKey(row.birdKey) === playerNorm) continue;
        out.push(ids[i]);
      }
    }
    return out;
  }

  function filterBossPoolForLevel(level, playerBirdKey) {
    var r = roster();
    if (!r || !r.bossesByLevel) return [];
    var playerNorm = normalizeBirdKey(playerBirdKey);
    var ids = r.bossesByLevel[level] || [];
    return ids.filter(function (id) {
      var row = getRosterRow(id);
      if (!row) return false;
      if (playerNorm && normalizeBirdKey(row.birdKey) === playerNorm) return false;
      return true;
    });
  }

  function pickStoryEncounterEnemyIds(stage, playerBirdKey, chainCount) {
    var st = Math.max(1, Math.floor(Number(stage)) || 1);
    var bandFn = global.getStoryEnemyLevelBand;
    var band = typeof bandFn === 'function' ? bandFn(st) : { min: 1, max: 2 };

    if (band.duke) {
      var dukeId = typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : global.STORY_DUKE_ROSTER_ID;
      return [dukeId || 'BO-DUKEB-STORY-L10'];
    }
    if (band.boss) {
      var bossLv = band.level || 6;
      var bossPool = filterBossPoolForLevel(bossLv, playerBirdKey);
      if (!bossPool.length) {
        bossPool = filterNormalPoolForBand({ min: bossLv, max: bossLv }, playerBirdKey);
      }
      var bossPick = pickRandom(bossPool);
      return bossPick ? [bossPick] : [];
    }

    var count = Math.max(1, Math.floor(Number(chainCount)) || 3);
    var pool = filterNormalPoolForBand(band, playerBirdKey);
    if (!pool.length) {
      console.warn('[EnemyRoster] Empty pool for stage', st, band);
      return Array.from({ length: count }, function () { return 'EN-SPARR-HESQ-L01'; });
    }
    var shuffled = shuffle(pool);
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push(shuffled[i % shuffled.length]);
    }
    return out;
  }

  function pickEndlessRosterEnemyId(stage, isBoss) {
    var r = roster();
    if (!r) return 'EN-SPARR-HESQ-L01';
    var battle = typeof global.getEndlessEffectiveBattleNumber === 'function'
      ? global.getEndlessEffectiveBattleNumber(stage)
      : Math.max(1, Math.floor(Number(stage) || 1));
    var level = Math.max(1, Math.min(10, 1 + Math.floor(battle / 3)));
    if (isBoss) {
      var bosses = r.bossesByLevel && r.bossesByLevel[level];
      if (bosses && bosses.length) return pickRandom(bosses);
      level = Math.min(10, level + 1);
      bosses = r.bossesByLevel && r.bossesByLevel[level];
      if (bosses && bosses.length) return pickRandom(bosses);
    }
    var normals = r.normalByLevel && r.normalByLevel[level];
    if (normals && normals.length) return pickRandom(normals);
    return 'EN-SPARR-HESQ-L01';
  }

  function pickRosterIdForBirdAndStage(birdKey, stage, opts) {
    opts = opts || {};
    var r = roster();
    if (!r) return null;
    var bk = String(birdKey || '').trim();
    var bandFn = global.getStoryEnemyLevelBand;
    var band = typeof bandFn === 'function'
      ? bandFn(Math.max(1, Math.floor(Number(stage)) || 1))
      : { min: 1, max: 2 };
    if (band.duke && (bk === 'dukeBlakiston' || bk === 'duke_blakiston')) {
      return typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : 'BO-DUKEB-STORY-L10';
    }
    if (band.boss && opts.isBoss) {
      var bosses = filterBossPoolForLevel(band.level || 6, '');
      var match = bosses.filter(function (id) {
        return getRosterRow(id) && getRosterRow(id).birdKey === bk;
      });
      if (match.length) return pickRandom(match);
      return pickRandom(bosses);
    }
    var byBird = r.byBirdLevel && r.byBirdLevel[bk];
    if (!byBird) return null;
    var min = Math.max(1, band.min || 1);
    var max = Math.max(min, band.max || min);
    var pool = [];
    for (var lv = min; lv <= max; lv++) {
      var ids = opts.isBoss ? (r.bossesByBirdLevel && r.bossesByBirdLevel[bk] && r.bossesByBirdLevel[bk][lv]) : byBird[lv];
      if (ids && ids.length) pool = pool.concat(ids);
    }
    return pickRandom(pool);
  }

  function pickRosterIdForBirdAndLevel(birdKey, level, opts) {
    opts = opts || {};
    var r = roster();
    if (!r) return null;
    var bk = String(birdKey || '').trim();
    if (!bk || bk === 'random') return null;
    var lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    var pool = [];
    if (opts.isBoss && r.bossesByBirdLevel && r.bossesByBirdLevel[bk] && r.bossesByBirdLevel[bk][lv]) {
      pool = pool.concat(r.bossesByBirdLevel[bk][lv]);
    }
    if (r.byBirdLevel && r.byBirdLevel[bk] && r.byBirdLevel[bk][lv]) {
      pool = pool.concat(r.byBirdLevel[bk][lv]);
    }
    if (!pool.length && r.byBirdLevel && r.byBirdLevel[bk]) {
      var levels = Object.keys(r.byBirdLevel[bk]).map(Number).filter(function (n) {
        return n > 0;
      });
      if (levels.length) {
        var nearest = levels.reduce(function (best, n) {
          return Math.abs(n - lv) < Math.abs(best - lv) ? n : best;
        }, levels[0]);
        pool = (r.byBirdLevel[bk][nearest] || []).slice();
      }
    }
    return pickRandom(pool);
  }

  function listForgeEnemySpeciesOptions() {
    var r = roster();
    var birds = global.BIRDS || {};
    var keys = [];
    if (r && r.byBirdLevel) {
      keys = Object.keys(r.byBirdLevel).filter(function (k) {
        return k && (birds[k] || getRosterRow(k));
      });
    }
    keys.sort(function (a, b) {
      var na = (birds[a] && birds[a].name) || a;
      var nb = (birds[b] && birds[b].name) || b;
      return String(na).localeCompare(String(nb));
    });
    return [{ id: 'random', label: 'Random' }].concat(
      keys.map(function (k) {
        return { id: k, label: (birds[k] && birds[k].name) || k };
      })
    );
  }

  function listEnemyVariantsForBird(birdKey, level, opts) {
    opts = opts || {};
    var r = roster();
    var bk = String(birdKey || '').trim();
    if (!bk || bk === 'random') {
      return [{ id: '', label: 'Any variant (random)' }];
    }
    var lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    var ids = [];
    if (opts.isBoss && r && r.bossesByBirdLevel && r.bossesByBirdLevel[bk] && r.bossesByBirdLevel[bk][lv]) {
      ids = ids.concat(r.bossesByBirdLevel[bk][lv]);
    }
    if (r && r.byBirdLevel && r.byBirdLevel[bk] && r.byBirdLevel[bk][lv]) {
      ids = ids.concat(r.byBirdLevel[bk][lv]);
    }
    var seen = {};
    var out = [{ id: '', label: 'Any variant (random)' }];
    ids.forEach(function (id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      var row = getRosterRow(id);
      if (!row) return;
      var label = row.fantasyTitle || row.name || id;
      if (row.enemyVariant) label += ' — ' + row.enemyVariant;
      label += ' (Lv.' + (row.storyLevel || lv) + ')';
      out.push({ id: id, label: label });
    });
    if (out.length === 1) {
      out.push({ id: '', label: 'No roster rows at level ' + lv });
    }
    return out;
  }

  function buildEnemyFromRosterId(enemyId, opts) {
    opts = opts || {};
    var row = getRosterRow(enemyId);
    if (!row) return null;

    var stats = Object.assign({}, row.stats || {});
    stats.maxHp = stats.maxHp || stats.hp || 30;
    stats.hp = stats.maxHp;
    var diffMult = opts.diffMult;
    if (diffMult == null && global.G && global.G.difficulty && global.DIFFICULTIES) {
      diffMult = global.DIFFICULTIES[global.G.difficulty || 'juvenile']?.mult || 1;
    }
    if (Number.isFinite(diffMult) && diffMult !== 1) {
      stats.maxHp = Math.max(1, Math.floor(stats.maxHp * diffMult));
      stats.hp = stats.maxHp;
      stats.atk = Math.max(1, Math.floor((stats.atk || 1) * diffMult));
      stats.matk = Math.max(1, Math.floor((stats.matk || 1) * diffMult));
    }
    if (opts.isBoss && global.STORY_BOSS_STAT_MULT) {
      var mult = global.STORY_BOSS_STAT_MULT;
      stats.maxHp = Math.max(1, Math.floor(stats.maxHp * (mult.hp || 2)));
      stats.hp = stats.maxHp;
      stats.atk = Math.max(1, Math.floor(stats.atk * (mult.atk || 1.3)));
      stats.matk = Math.max(1, Math.floor(stats.matk * (mult.matk || 1.3)));
    }

    var size = row.size || 'medium';
    var enProf = typeof global.getEnemyEnergyProfile === 'function'
      ? global.getEnemyEnergyProfile()
      : { maxEN: 6, startEN: 4, regenEN: 3 };
    var cls = row.class || 'rogue';
    var aiStyle = row.aiStyle || 'aggressive';
    var aiPersonality = typeof global.inferAIPersonalityFromClass === 'function'
      ? global.inferAIPersonalityFromClass(cls)
      : (typeof global.inferAIPersonalityFromStyle === 'function'
        ? global.inferAIPersonalityFromStyle(aiStyle, row.name)
        : 'tactical');

    var enemyStub = { birdKey: row.birdKey, abilities: [], familyEvolutionState: {} };
    var skillLevel = row.storyLevel || 1;
    if (typeof global.materializeEnemySkillsFromPlayerMirror === 'function' && global.G && global.G.player) {
      global.materializeEnemySkillsFromPlayerMirror(enemyStub, row.birdKey, skillLevel, global.G.player, cls);
    }

    var cc = Math.max(0.05, Math.min(0.95, ((stats.critChance || 5) / 100)));
    var cd = stats.critMult || 1.5;
    var isBoss = !!opts.isBoss || !!row.isBoss;

    return {
      id: enemyId,
      rosterId: enemyId,
      name: row.name,
      birdKey: row.birdKey,
      portraitKey: row.birdKey,
      fantasyTitle: row.fantasyTitle || '',
      size: size,
      enemyClass: cls,
      class: cls,
      aiStyle: aiStyle,
      aiPersonality: aiPersonality,
      abilities: JSON.parse(JSON.stringify(enemyStub.abilities || [])),
      stats: Object.assign({}, stats, { en: enProf.maxEN, cc: cc, cd: cd, critChance: Math.round(cc * 100), critMult: cd }),
      hp: stats.hp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def,
      spd: stats.spd,
      acc: stats.acc,
      dodge: stats.dodge,
      mdef: stats.mdef,
      matk: stats.matk,
      cc: cc,
      cd: cd,
      energyMax: enProf.maxEN,
      energy: enProf.startEN,
      energyRegen: enProf.regenEN,
      isBoss: isBoss,
      bossTitle: opts.bossTitle || '',
      storyLevel: skillLevel,
      _storyDirectStats: true,
      _fromRoster: true,
    };
  }

  function resolveOwStageToken(tok, stage, opts) {
    var s = String(tok || '').trim();
    if (!s) return null;
    if (isRosterEnemyId(s)) return s;
    var low = s.toLowerCase().replace(/\s+/g, '');
    if (low === 'dukeblakiston' || low === 'duke_blakiston') {
      return typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : 'BO-DUKEB-STORY-L10';
    }
    return pickRosterIdForBirdAndStage(s, stage, opts) || s;
  }

  ns.pickRosterIdForBirdAndLevel = pickRosterIdForBirdAndLevel;
  ns.listForgeEnemySpeciesOptions = listForgeEnemySpeciesOptions;
  ns.listEnemyVariantsForBird = listEnemyVariantsForBird;
  ns.getRosterRow = getRosterRow;
  ns.isRosterEnemyId = isRosterEnemyId;
  ns.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  ns.pickEndlessRosterEnemyId = pickEndlessRosterEnemyId;
  ns.buildEnemyFromRosterId = buildEnemyFromRosterId;
  ns.resolveOwStageToken = resolveOwStageToken;
  ns.filterNormalPoolForBand = filterNormalPoolForBand;

  global.pickRosterIdForBirdAndLevel = pickRosterIdForBirdAndLevel;
  global.listForgeEnemySpeciesOptions = listForgeEnemySpeciesOptions;
  global.listEnemyVariantsForBird = listEnemyVariantsForBird;
  global.getEnemyRosterRow = getRosterRow;
  global.isRosterEnemyId = isRosterEnemyId;
  global.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  global.pickEndlessRosterEnemyId = pickEndlessRosterEnemyId;
  global.buildEnemyFromRosterId = buildEnemyFromRosterId;
  global.resolveOwStageToken = resolveOwStageToken;
})(typeof window !== 'undefined' ? window : globalThis);
