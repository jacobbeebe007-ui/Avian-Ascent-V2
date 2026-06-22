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

  function getBirdSpeciesTier(birdKey) {
    var tiers = Avian.data && Avian.data.motherGooseSpeciesTiers;
    var row = tiers && tiers.byBirdKey ? tiers.byBirdKey[birdKey] : null;
    return row && row.speciesTier ? row.speciesTier : 'grey';
  }

  function rowMatchesStorySpeciesTier(row, speciesTier) {
    if (!speciesTier || !row) return true;
    return getBirdSpeciesTier(row.birdKey) === speciesTier;
  }

  function filterNormalPoolForBand(band, playerBirdKey, speciesTier) {
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
        if (!rowMatchesStorySpeciesTier(row, speciesTier)) continue;
        out.push(ids[i]);
      }
    }
    return out;
  }

  function filterBossPoolForLevel(level, playerBirdKey, speciesTier) {
    var r = roster();
    if (!r || !r.bossesByLevel) return [];
    var playerNorm = normalizeBirdKey(playerBirdKey);
    var ids = r.bossesByLevel[level] || [];
    return ids.filter(function (id) {
      var row = getRosterRow(id);
      if (!row) return false;
      if (playerNorm && normalizeBirdKey(row.birdKey) === playerNorm) return false;
      if (!rowMatchesStorySpeciesTier(row, speciesTier)) return false;
      return true;
    });
  }

  function getStoryEncounterPoolIds(stage, playerBirdKey) {
    var st = Math.max(1, Math.floor(Number(stage)) || 1);
    var bandFn = global.getStoryEnemyLevelBand;
    var band = typeof bandFn === 'function' ? bandFn(st) : { min: 1, max: 2 };
    var tierFn = global.getStorySpeciesTierForStage;
    var speciesTier = typeof tierFn === 'function' ? tierFn(st) : null;

    if (band.duke) {
      var dukeId = typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : global.STORY_DUKE_ROSTER_ID;
      return dukeId ? [dukeId] : [];
    }
    if (band.boss) {
      var bossLv = band.level || 6;
      var bossPool = filterBossPoolForLevel(bossLv, playerBirdKey, speciesTier);
      if (!bossPool.length) {
        bossPool = filterNormalPoolForBand({ min: bossLv, max: bossLv }, playerBirdKey, speciesTier);
      }
      return bossPool.slice().sort();
    }

    var pool = filterNormalPoolForBand(band, playerBirdKey, speciesTier);
    var seen = {};
    var out = [];
    pool.forEach(function (id) {
      if (!seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    });
    return out.sort();
  }

  function pickStoryEncounterEnemyIds(stage, playerBirdKey, chainCount) {
    var st = Math.max(1, Math.floor(Number(stage)) || 1);
    var bandFn = global.getStoryEnemyLevelBand;
    var band = typeof bandFn === 'function' ? bandFn(st) : { min: 1, max: 2 };
    var tierFn = global.getStorySpeciesTierForStage;
    var speciesTier = typeof tierFn === 'function' ? tierFn(st) : null;

    if (band.duke) {
      var dukeId = typeof global.getStoryDukeRosterId === 'function'
        ? global.getStoryDukeRosterId()
        : global.STORY_DUKE_ROSTER_ID;
      return [dukeId || 'BO-DUKEB-STORY-L10'];
    }
    if (band.boss) {
      var bossLv = band.level || 6;
      var bossPool = filterBossPoolForLevel(bossLv, playerBirdKey, speciesTier);
      if (!bossPool.length) {
        bossPool = filterNormalPoolForBand({ min: bossLv, max: bossLv }, playerBirdKey, speciesTier);
      }
      var bossPick = pickRandom(bossPool);
      return bossPick ? [bossPick] : [];
    }

    var count = Math.max(1, Math.floor(Number(chainCount)) || 1);
    var pool = filterNormalPoolForBand(band, playerBirdKey, speciesTier);
    if (!pool.length) {
      console.warn('[EnemyRoster] Empty pool for stage', st, band, 'tier', speciesTier);
      return Array.from({ length: count }, function () { return 'EN-SPARR-HESQ-L01'; });
    }
    var shuffled = shuffle(pool);
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push(shuffled[i % shuffled.length]);
    }
    return out;
  }

  function nearestBossRosterLevel(level) {
    var lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    if (lv <= 10) return 10;
    if (lv <= 20) return 20;
    return 30;
  }

  function pickEndlessRosterEnemyId(stage, isBoss, playerBirdLevel) {
    var r = roster();
    if (!r) return 'EN-SPARR-HESQ-L01';
    var baseLv = Math.max(1, Math.min(20, Math.floor(Number(playerBirdLevel) || 1)));
    var level;
    if (isBoss) {
      level = Math.random() < 0.5 ? baseLv : Math.min(20, baseLv + 1);
      var bossRosterLv = nearestBossRosterLevel(level);
      var bosses = r.bossesByLevel && r.bossesByLevel[bossRosterLv];
      if (bosses && bosses.length) return pickRandom(bosses);
      bosses = r.bossesByLevel && r.bossesByLevel[20];
      if (bosses && bosses.length) return pickRandom(bosses);
    } else {
      var delta = Math.floor(Math.random() * 3) - 1;
      level = Math.max(1, Math.min(20, baseLv + delta));
      var normals = r.normalByLevel && r.normalByLevel[level];
      if (normals && normals.length) return pickRandom(normals);
    }
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

  function listForgeEnemySpeciesOptions(scalingStage) {
    var st = Math.max(1, Math.floor(Number(scalingStage) || 0));
    var r = roster();
    var birds = global.BIRDS || {};
    var keys = [];
    if (r && r.byBirdLevel) {
      keys = Object.keys(r.byBirdLevel).filter(function (k) {
        if (!k || !(birds[k] || getRosterRow(k))) return false;
        if (st !== 20 && k === 'dukeBlakiston') return false;
        return true;
      });
    }
    keys.sort(function (a, b) {
      var na = (birds[a] && birds[a].name) || a;
      var nb = (birds[b] && birds[b].name) || b;
      return String(na).localeCompare(String(nb));
    });
    return [{ id: 'random', label: 'Random species' }].concat(
      keys.map(function (k) {
        return { id: k, label: (birds[k] && birds[k].name) || k };
      })
    );
  }

  function pickRandomRosterIdAtLevel(level, opts) {
    opts = opts || {};
    var r = roster();
    if (!r) return null;
    var lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    var pool = [];
    if (opts.isBoss && r.bossesByLevel && r.bossesByLevel[lv]) {
      pool = pool.concat(r.bossesByLevel[lv]);
    }
    if (r.normalByLevel && r.normalByLevel[lv]) {
      pool = pool.concat(r.normalByLevel[lv]);
    }
    if (!pool.length && r.normalByLevel) {
      var levels = Object.keys(r.normalByLevel).map(Number).filter(function (n) { return n > 0; });
      if (levels.length) {
        var nearest = levels.reduce(function (best, n) {
          return Math.abs(n - lv) < Math.abs(best - lv) ? n : best;
        }, levels[0]);
        pool = (r.normalByLevel[nearest] || []).slice();
      }
    }
    return pickRandom(pool);
  }

  function listEnemyVariantsForBird(birdKey, level, opts) {
    opts = opts || {};
    var r = roster();
    var bk = String(birdKey || '').trim();
    var lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    if (!bk || bk === 'random') {
      return [{ id: '', label: 'Random species — any roster bird at this level' }];
    }
    var ids = [];
    if (opts.isBoss && r && r.bossesByBirdLevel && r.bossesByBirdLevel[bk] && r.bossesByBirdLevel[bk][lv]) {
      ids = ids.concat(r.bossesByBirdLevel[bk][lv]);
    }
    if (r && r.byBirdLevel && r.byBirdLevel[bk] && r.byBirdLevel[bk][lv]) {
      ids = ids.concat(r.byBirdLevel[bk][lv]);
    }
    var seen = {};
    var out = [{ id: '', label: 'Random variant (this species)' }];
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
      var rcs = typeof global.roundCombatStat === 'function' ? global.roundCombatStat : function (n, f) { return Math.max(f || 0, Math.round(Number(n) * 100) / 100); };
      stats.maxHp = rcs(Math.max(0.01, stats.maxHp * diffMult), 0.01);
      stats.hp = stats.maxHp;
      stats.atk = rcs(Math.max(0.01, (stats.atk || 1) * diffMult), 0.01);
      stats.matk = rcs(Math.max(0.01, (stats.matk || 1) * diffMult), 0.01);
    }
    if (opts.isBoss && global.STORY_BOSS_STAT_MULT) {
      var mult = global.STORY_BOSS_STAT_MULT;
      var rcs2 = typeof global.roundCombatStat === 'function' ? global.roundCombatStat : function (n, f) { return Math.max(f || 0, Math.round(Number(n) * 100) / 100); };
      stats.maxHp = rcs2(Math.max(0.01, stats.maxHp * (mult.hp || 2)), 0.01);
      stats.hp = stats.maxHp;
      stats.atk = rcs2(Math.max(0.01, stats.atk * (mult.atk || 1.3)), 0.01);
      stats.matk = rcs2(Math.max(0.01, stats.matk * (mult.matk || 1.3)), 0.01);
    }
    if (typeof global.normalizeCombatStats === 'function') global.normalizeCombatStats(stats);

    var size = row.size || 'medium';
    var enProf = typeof global.getEnemyEnergyProfile === 'function'
      ? global.getEnemyEnergyProfile()
      : { maxEN: 6, startEN: 4, regenEN: 3 };
    var cls = row.class || 'rogue';
    var aiStyle = row.aiStyle || 'aggressive';
    var aiPersonality = typeof global.inferAIPersonalityFromRosterProfile === 'function'
      ? global.inferAIPersonalityFromRosterProfile(row.aiProfile)
      : '';
    if (!aiPersonality) {
      aiPersonality = typeof global.inferAIPersonalityFromClass === 'function'
        ? global.inferAIPersonalityFromClass(cls)
        : (typeof global.inferAIPersonalityFromStyle === 'function'
          ? global.inferAIPersonalityFromStyle(aiStyle, row.name)
          : 'tactical');
    }
    var aspect = row.aspect || '';
    if (!aspect && row.birdKey && global.BIRDS && global.BIRDS[row.birdKey]) {
      aspect = global.BIRDS[row.birdKey].aspect || '';
    }

    var enemyStub = { birdKey: row.birdKey, abilities: [], familyEvolutionState: {} };
    var skillLevel = row.storyLevel || 1;
    if (typeof global.materializeEnemySkillsFromWorkbookKit === 'function') {
      global.materializeEnemySkillsFromWorkbookKit(enemyStub, row.birdKey, skillLevel, cls, row);
    } else if (typeof global.materializeEnemySkillsFromPlayerMirror === 'function') {
      global.materializeEnemySkillsFromPlayerMirror(enemyStub, row.birdKey, skillLevel, null, cls);
    }

    var cc = Math.max(0.05, Math.min(0.95, ((stats.critChance || 5) / 100)));
    var cd = stats.critMult || 1.5;
    var isBoss = !!opts.isBoss || !!row.isBoss;

    return {
      id: enemyId,
      rosterId: enemyId,
      name: row.name,
      birdKey: row.birdKey,
      portraitKey: row.birdKey === 'pigeon' ? 'mutatedpigeon' : row.birdKey,
      fantasyTitle: row.fantasyTitle || '',
      size: size,
      enemyClass: cls,
      class: cls,
      aiStyle: aiStyle,
      aiPersonality: aiPersonality,
      aiProfile: row.aiProfile || '',
      aiPriority: row.aiPriority || '',
      healingRule: row.healingRule || '',
      defenceRule: row.defenceRule || '',
      attackRule: row.attackRule || '',
      abilityBias: row.abilityBias || '',
      aspect: aspect,
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

  function isDukeStageToken(tok) {
    var s = String(tok || '').trim();
    if (!s) return false;
    var low = s.toLowerCase().replace(/\s+/g, '');
    if (low === 'dukeblakiston' || low === 'duke_blakiston') return true;
    var dukeId = typeof global.getStoryDukeRosterId === 'function'
      ? global.getStoryDukeRosterId()
      : 'BO-DUKEB-STORY-L10';
    return s === dukeId || s.indexOf('DUKEB') >= 0;
  }

  function pickRandomFromStagePool(stage, playerBirdKey) {
    var st = Math.max(1, Math.floor(Number(stage) || 1));
    var pbk = String(playerBirdKey || '').trim();
    var pool = [];
    if (typeof global.getStoryStageEnemyCandidateIds === 'function') {
      pool = global.getStoryStageEnemyCandidateIds(st, pbk).slice();
    } else if (typeof pickStoryEncounterEnemyIds === 'function') {
      pool = pickStoryEncounterEnemyIds(st, pbk, 1).slice();
    }
    if (!pool.length) pool = ['EN-SPARR-HESQ-L01'];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function resolveOwStageToken(tok, stage, opts) {
    var s = String(tok || '').trim();
    if (!s) return null;
    var st = Math.max(1, Math.floor(Number(stage) || 1));
    if (isRosterEnemyId(s)) {
      if (isDukeStageToken(s) && st !== 20) {
        return pickRandomFromStagePool(st, opts && opts.playerBirdKey);
      }
      return s;
    }
    if (isDukeStageToken(s)) {
      if (st === 20) {
        return typeof global.getStoryDukeRosterId === 'function'
          ? global.getStoryDukeRosterId()
          : 'BO-DUKEB-STORY-L10';
      }
      return pickRandomFromStagePool(st, opts && opts.playerBirdKey);
    }
    return pickRosterIdForBirdAndStage(s, stage, opts) || s;
  }

  ns.pickRosterIdForBirdAndLevel = pickRosterIdForBirdAndLevel;
  ns.pickRandomRosterIdAtLevel = pickRandomRosterIdAtLevel;
  ns.listForgeEnemySpeciesOptions = listForgeEnemySpeciesOptions;
  ns.listEnemyVariantsForBird = listEnemyVariantsForBird;
  ns.getRosterRow = getRosterRow;
  ns.isRosterEnemyId = isRosterEnemyId;
  ns.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  ns.getStoryEncounterPoolIds = getStoryEncounterPoolIds;
  ns.pickEndlessRosterEnemyId = pickEndlessRosterEnemyId;
  ns.buildEnemyFromRosterId = buildEnemyFromRosterId;
  ns.resolveOwStageToken = resolveOwStageToken;
  ns.filterNormalPoolForBand = filterNormalPoolForBand;
  ns.getBirdSpeciesTier = getBirdSpeciesTier;

  global.pickRosterIdForBirdAndLevel = pickRosterIdForBirdAndLevel;
  global.pickRandomRosterIdAtLevel = pickRandomRosterIdAtLevel;
  global.listForgeEnemySpeciesOptions = listForgeEnemySpeciesOptions;
  global.listEnemyVariantsForBird = listEnemyVariantsForBird;
  global.getEnemyRosterRow = getRosterRow;
  global.isRosterEnemyId = isRosterEnemyId;
  global.pickStoryEncounterEnemyIds = pickStoryEncounterEnemyIds;
  global.getStoryEncounterPoolIds = getStoryEncounterPoolIds;
  global.pickEndlessRosterEnemyId = pickEndlessRosterEnemyId;
  global.buildEnemyFromRosterId = buildEnemyFromRosterId;
  global.resolveOwStageToken = resolveOwStageToken;
})(typeof window !== 'undefined' ? window : globalThis);
