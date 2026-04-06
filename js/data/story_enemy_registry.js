/**
 * Master story-mode enemy registry + encounter pair picker.
 * Canonical combat entities are built in game.js (buildStoryEnemyFromBirdKey).
 */
(function initStoryEnemyRegistry(global) {
  'use strict';

  const STORY_ENEMY_REGISTRY = {
    sparrow: { birdKey: 'sparrow', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    robin: { birdKey: 'robin', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    blackbird: { birdKey: 'blackbird', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    seagull: { birdKey: 'seagull', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    kiwi: { birdKey: 'kiwi', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    hummingbird: { birdKey: 'hummingbird', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    macaw: { birdKey: 'macaw', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    crow: { birdKey: 'crow', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    magpie: { birdKey: 'magpie', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    goose: { birdKey: 'goose', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    penguin: { birdKey: 'penguin', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    peregrine: { birdKey: 'peregrine', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    snowyOwl: { birdKey: 'snowyOwl', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    kookaburra: { birdKey: 'kookaburra', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    lyrebird: { birdKey: 'lyrebird', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    raven: { birdKey: 'raven', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    bowerbird: { birdKey: 'bowerbird', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    toucan: { birdKey: 'toucan', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    swan: { birdKey: 'swan', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    flamingo: { birdKey: 'flamingo', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    albatross: { birdKey: 'albatross', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    blackCockatoo: { birdKey: 'blackCockatoo', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    secretary: { birdKey: 'secretary', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    shoebill: { birdKey: 'shoebill', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    harpy: { birdKey: 'harpy', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    baldEagle: { birdKey: 'baldEagle', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    ostrich: { birdKey: 'ostrich', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    cassowary: { birdKey: 'cassowary', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    emu: { birdKey: 'emu', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    wren: { birdKey: 'wren', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    fairywren: { birdKey: 'fairywren', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    firecrest: { birdKey: 'firecrest', threatTier: 1, threatValue: 1, enemyEligible: true, bossOnly: false, minStage: 1, maxStage: 19 },
    wagtail: { birdKey: 'wagtail', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    galah: { birdKey: 'galah', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    bluejay: { birdKey: 'bluejay', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    cardinal: { birdKey: 'cardinal', threatTier: 2, threatValue: 2, enemyEligible: true, bossOnly: false, minStage: 3, maxStage: 19 },
    bushturkey: { birdKey: 'bushturkey', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    vulture: { birdKey: 'vulture', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    barnowl: { birdKey: 'barnowl', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    bustard: { birdKey: 'bustard', threatTier: 3, threatValue: 3, enemyEligible: true, bossOnly: false, minStage: 5, maxStage: 19 },
    goldeneagle: { birdKey: 'goldeneagle', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    pelican: { birdKey: 'pelican', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    marabou: { birdKey: 'marabou', threatTier: 4, threatValue: 4, enemyEligible: true, bossOnly: false, minStage: 11, maxStage: 19 },
    dukeBlakiston: { birdKey: 'dukeBlakiston', threatTier: 5, threatValue: 6, enemyEligible: false, bossOnly: true, minStage: 20, maxStage: 20 },
  };

  const STORY_BIRD_CLASS = {
    sparrow: 'striker', robin: 'singer', blackbird: 'singer', seagull: 'trickster', kiwi: 'predator',
    hummingbird: 'striker', macaw: 'singer', crow: 'trickster', magpie: 'trickster', goose: 'tank', penguin: 'tank',
    peregrine: 'striker', snowyOwl: 'predator', kookaburra: 'trickster', lyrebird: 'singer', raven: 'trickster',
    bowerbird: 'trickster', toucan: 'striker', swan: 'tank', flamingo: 'striker', albatross: 'bruiser',
    blackCockatoo: 'singer', secretary: 'predator', shoebill: 'tank', harpy: 'predator', baldEagle: 'predator',
    ostrich: 'bruiser', cassowary: 'bruiser', emu: 'bruiser', dukeBlakiston: 'predator',
    wren: 'striker', fairywren: 'singer', firecrest: 'striker', wagtail: 'trickster', galah: 'trickster', bluejay: 'bruiser',
    cardinal: 'singer', bushturkey: 'bruiser', vulture: 'bruiser', barnowl: 'predator', bustard: 'bruiser', goldeneagle: 'predator',
    pelican: 'tank', marabou: 'predator',
  };

  const STORY_STAGE_BUDGETS = {
    1: 2, 2: 2, 3: 3, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5,
    10: 0, 11: 6, 12: 6, 13: 7, 14: 7, 15: 7, 16: 8, 17: 8, 18: 9, 19: 9, 20: 0,
  };

  const STORY_BOSS_STAGES = new Set([10, 20]);

  function getStoryStageBudget(stageNumber) {
    const s = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (STORY_BOSS_STAGES.has(s)) return 0;
    if (Object.prototype.hasOwnProperty.call(STORY_STAGE_BUDGETS, s)) return STORY_STAGE_BUDGETS[s];
    return Math.max(2, s);
  }

  function isBossStage(stageNumber) {
    return STORY_BOSS_STAGES.has(Number(stageNumber));
  }

  function getEnemyLevelBandForStage(stageNumber) {
    const s = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (s <= 4) return { min: 0, max: 2 };
    if (s <= 9) return { min: 1, max: 3 };
    if (s <= 14) return { min: 4, max: 6 };
    return { min: 7, max: 10 };
  }

  function getEvolvedSlotCountForLevel(level) {
    const lv = Math.floor(Number(level)) || 0;
    if (lv <= 2) return 0;
    if (lv <= 5) return 1;
    if (lv <= 8) return 2;
    return 3;
  }

  function normalizeBirdKey(key) {
    return String(key || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase();
  }

  function registryKeyFromPlayerBird(playerBirdKey) {
    const n = normalizeBirdKey(playerBirdKey).replace(/[^a-z0-9_]/g, '');
    const aliases = {
      peregrinefalcon: 'peregrine', snowyowl: 'snowyowl', secretarybird: 'secretary',
      emperorpenguin: 'penguin', harpyeagle: 'harpy', baldeagle: 'baldEagle', blackcockatoo: 'blackCockatoo',
      dukeblakiston: 'dukeBlakiston', duke_blakiston: 'dukeBlakiston',
    };
    if (aliases[n]) return aliases[n];
    if (STORY_ENEMY_REGISTRY[playerBirdKey]) return playerBirdKey;
    const hit = Object.keys(STORY_ENEMY_REGISTRY).find((k) => normalizeBirdKey(k) === n);
    return hit || playerBirdKey;
  }

  function getPlayerThreatValue(playerBirdKey) {
    const rk = registryKeyFromPlayerBird(playerBirdKey);
    const entry = STORY_ENEMY_REGISTRY[rk];
    if (entry) return entry.threatValue;
    return 1;
  }

  function getPlayerThreatBudgetAdjustment(stageNumber, playerBirdKey) {
    const threat = getPlayerThreatValue(playerBirdKey);
    const st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (threat <= 2) return 0;
    if (threat === 3) return st >= 3 ? 1 : 0;
    if (threat >= 4) return st >= 2 ? 1 : 0;
    return 0;
  }

  function getStoryRegistryThreatForBirdKey(birdKey) {
    const rk = registryKeyFromPlayerBird(birdKey);
    const e = STORY_ENEMY_REGISTRY[rk];
    return e ? e.threatValue : null;
  }

  function buildAllowedEnemyPool(stageNumber) {
    const st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    return Object.keys(STORY_ENEMY_REGISTRY).filter((key) => {
      const e = STORY_ENEMY_REGISTRY[key];
      if (!e.enemyEligible) return false;
      if (e.bossOnly) return false;
      if (st < e.minStage) return false;
      if (st > e.maxStage) return false;
      if (st <= 2) return e.threatValue === 1;
      if (st <= 4) return e.threatValue <= 2;
      if (st <= 9) return e.threatValue <= 3;
      if (st <= 14) return e.threatValue >= 2 && e.threatValue <= 4;
      return e.threatValue >= 3 && e.threatValue <= 4;
    });
  }

  function shuffle(arr) {
    const clone = arr.slice();
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = clone[i];
      clone[i] = clone[j];
      clone[j] = t;
    }
    return clone;
  }

  function getBirdDef(key) {
    const birds = global.BIRDS || global.BirdRoster || {};
    if (birds[key]) return birds[key];
    if (typeof key === 'string' && birds[key.toLowerCase?.()]) return birds[key.toLowerCase()];
    return null;
  }

  function getBirdClass(key) {
    const bird = getBirdDef(key);
    const fromRoster = bird?.class || bird?.birdClass;
    if (fromRoster) return String(fromRoster).toLowerCase();
    const bk = STORY_ENEMY_REGISTRY[key]?.birdKey || key;
    return STORY_BIRD_CLASS[bk] || null;
  }

  function isBadEarlyPair(stageNumber, keyA, keyB) {
    if (stageNumber > 9) return false;
    const a = STORY_ENEMY_REGISTRY[keyA];
    const b = STORY_ENEMY_REGISTRY[keyB];
    if (!a || !b) return false;
    if (a.threatValue >= 3 && b.threatValue >= 3 && stageNumber <= 8) return true;
    const classA = String(getBirdClass(keyA) || '').toLowerCase();
    const classB = String(getBirdClass(keyB) || '').toLowerCase();
    const heavy = new Set(['tank', 'bruiser', 'predator']);
    if (stageNumber <= 6 && heavy.has(classA) && heavy.has(classB)) return true;
    if (stageNumber <= 6 && classA === 'trickster' && classB === 'trickster') return true;
    return false;
  }

  function pickEnemyPair(stageNumber, playerBirdKey) {
    const pool = buildAllowedEnemyPool(stageNumber);
    if (pool.length < 2) {
      console.warn('[StoryEncounter] Pool too small for stage', stageNumber, pool);
      return ['sparrow', 'robin'];
    }
    const budget =
      getStoryStageBudget(stageNumber) + getPlayerThreatBudgetAdjustment(stageNumber, playerBirdKey);
    const shuffled = shuffle(pool);
    let bestPair = null;
    let bestScore = -Infinity;
    for (let i = 0; i < shuffled.length; i++) {
      for (let j = i + 1; j < shuffled.length; j++) {
        const aKey = shuffled[i];
        const bKey = shuffled[j];
        const a = STORY_ENEMY_REGISTRY[aKey];
        const b = STORY_ENEMY_REGISTRY[bKey];
        const total = a.threatValue + b.threatValue;
        if (isBadEarlyPair(stageNumber, aKey, bKey)) continue;
        if (total > budget) continue;
        const score = total;
        if (score > bestScore) {
          bestScore = score;
          bestPair = [a.birdKey, b.birdKey];
        }
      }
    }
    if (!bestPair) {
      const sorted = shuffled
        .slice()
        .sort((ka, kb) => STORY_ENEMY_REGISTRY[ka].threatValue - STORY_ENEMY_REGISTRY[kb].threatValue);
      bestPair = [
        STORY_ENEMY_REGISTRY[sorted[0]].birdKey,
        STORY_ENEMY_REGISTRY[sorted[1]].birdKey,
      ];
    }
    return bestPair;
  }

  function generateStoryEncounter(stageNumber, playerBirdKey, _playerLevel) {
    const st = Math.max(1, Math.floor(Number(stageNumber)) || 1);
    if (isBossStage(st)) {
      return {
        stageNumber: st,
        isBoss: true,
        budget: 0,
        birdKeys: st === 20 ? ['dukeBlakiston'] : [],
        enemies: [],
      };
    }
    const pair = pickEnemyPair(st, playerBirdKey);
    const budget = getStoryStageBudget(st) + getPlayerThreatBudgetAdjustment(st, playerBirdKey);
    return {
      stageNumber: st,
      isBoss: false,
      budget,
      birdKeys: pair,
      enemies: [],
    };
  }

  global.STORY_ENEMY_REGISTRY = STORY_ENEMY_REGISTRY;
  global.STORY_BOSS_STAGES_REGISTRY = STORY_BOSS_STAGES;
  global.getStoryStageBudget = getStoryStageBudget;
  global.isBossStageStory = isBossStage;
  global.getEnemyLevelBandForStage = getEnemyLevelBandForStage;
  global.getEvolvedSlotCountForLevel = getEvolvedSlotCountForLevel;
  global.normalizeBirdKey = normalizeBirdKey;
  global.pickEnemyPair = pickEnemyPair;
  global.generateStoryEncounter = generateStoryEncounter;
  global.getPlayerThreatValue = getPlayerThreatValue;
  global.getStoryRegistryThreatForBirdKey = getStoryRegistryThreatForBirdKey;
  global.getPlayerThreatBudgetAdjustment = getPlayerThreatBudgetAdjustment;
})(typeof window !== 'undefined' ? window : globalThis);
