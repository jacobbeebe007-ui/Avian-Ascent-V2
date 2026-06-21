/**
 * Shakeable nest reward drops after story stage / endless victories.
 */
(function initNestRewards() {
  'use strict';

  var global = globalThis;
  var Avian = global.Avian || (global.Avian = {});
  Avian.systems = Avian.systems || {};
  var ns = Avian.systems.nestRewards = Avian.systems.nestRewards || {};

  function rollInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickWeighted(entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += Math.max(0, Number(entries[i].w) || 0);
    if (total <= 0) return entries[0] ? entries[0].k : null;
    var r = Math.random() * total;
    for (var j = 0; j < entries.length; j++) {
      r -= Math.max(0, Number(entries[j].w) || 0);
      if (r <= 0) return entries[j].k;
    }
    return entries[entries.length - 1] ? entries[entries.length - 1].k : null;
  }

  function getNestMutationTiersForBirdLevel(level) {
    var lv = Math.max(1, Math.floor(Number(level) || 1));
    if (lv <= 2) return ['white'];
    if (lv === 3) return ['white', 'green'];
    if (lv <= 5) return ['green'];
    if (lv === 6) return ['green', 'blue'];
    if (lv <= 8) return ['blue'];
    if (lv <= 11) return ['purple'];
    if (lv <= 14) return ['purple', 'gold'];
    return ['purple', 'gold', 'orange'];
  }

  function rollNestMutationTier(level) {
    var tiers = getNestMutationTiersForBirdLevel(level);
    return tiers[Math.floor(Math.random() * tiers.length)];
  }

  function rollNestHealingDrop(level, difficulty) {
    var lv = Math.max(1, Math.floor(Number(level) || 1));
    var diff = String(difficulty || 'juvenile').toLowerCase();
    var downgradeW = diff === 'murder' ? 0.15 : (diff === 'predator' ? 0.22 : 0.28);

    if (lv >= 10 && Math.random() < downgradeW) {
      return { itemKey: 'freshWater', quantity: 2, tier: 'grey', icon: '💧', name: 'Fresh Water x2' };
    }
    if (lv >= 7 && Math.random() < downgradeW * 0.85) {
      return { itemKey: 'freshWater', quantity: 2, tier: 'grey', icon: '💧', name: 'Fresh Water x2' };
    }
    if (lv >= 9) {
      return { itemKey: 'honeyWater', quantity: 1, tier: 'blue', icon: '🍯', name: 'Honey Water' };
    }
    if (lv >= 5) {
      return { itemKey: 'sugarWater', quantity: 1, tier: 'green', icon: '🌾', name: 'Bird Seed' };
    }
    return { itemKey: 'freshWater', quantity: 1, tier: 'grey', icon: '💧', name: 'Fresh Water' };
  }

  function rollNestShinyBonus(level, difficulty, force) {
    if (!force && Math.random() > 0.20) return null;
    var lv = Math.max(1, Math.floor(Number(level) || 1));
    var diff = String(difficulty || 'juvenile').toLowerCase();
    var base = rollInt(2, 5) + Math.floor(lv / 3);
    if (diff === 'predator') base += 1;
    if (diff === 'murder') base += 2;
    return {
      type: 'shiny',
      amount: Math.max(1, base),
      tier: 'gold',
      icon: '✨',
      name: 'Shiny Objects',
      desc: 'Bonus shinies from the nest!',
    };
  }

  function rollMutationRewardForBird(bird, difficulty, stage, isBoss, usedMutationIds) {
    var level = Math.max(1, Math.floor(Number(bird.level) || 1));
    var tier = rollNestMutationTier(level);
    var dataTier = tier === 'grey' ? 'white' : tier;
    var rw = null;
    if (typeof Avian.mutations !== 'undefined' && typeof Avian.mutations.rollMutationReward === 'function') {
      var guard = 0;
      while (guard < 25) {
        guard++;
        rw = Avian.mutations.rollMutationReward({ tier: dataTier, stage: stage, isBoss: !!isBoss });
        if (!rw) continue;
        if (usedMutationIds.has(rw.id)) continue;
        usedMutationIds.add(rw.id);
        break;
      }
    }
    if (!rw) {
      return {
        type: 'combat_item',
        itemKey: 'freshWater',
        quantity: 1,
        tier: 'grey',
        icon: '💧',
        name: 'Fresh Water',
        desc: 'Fallback nest reward.',
      };
    }
    return Object.assign({ type: 'mutation' }, rw);
  }

  function rollDropForBird(bird, difficulty, stage, isBoss, usedMutationIds) {
    var level = Math.max(1, Math.floor(Number(bird.level) || 1));
    var kind = pickWeighted([
      { k: 'mutation', w: 62 },
      { k: 'healing', w: 28 },
      { k: 'shiny', w: 10 },
    ]);

    if (kind === 'shiny') {
      var shiny = rollNestShinyBonus(level, difficulty);
      if (shiny) return shiny;
      kind = 'mutation';
    }

    if (kind === 'healing') {
      var heal = rollNestHealingDrop(level, difficulty);
      return {
        type: 'combat_item',
        itemKey: heal.itemKey,
        quantity: heal.quantity,
        tier: heal.tier,
        icon: heal.icon,
        name: heal.name,
        desc: 'Healing item for battle.',
      };
    }

    return rollMutationRewardForBird(bird, difficulty, stage, isBoss, usedMutationIds);
  }

  function rollStoryBonusDrop(bird, difficulty) {
    if (Math.random() > 0.38) return null;
    var level = Math.max(1, Math.floor(Number(bird && bird.level) || 1));
    var kind = pickWeighted([
      { k: 'healing', w: 28 },
      { k: 'shiny', w: 10 },
    ]);
    if (kind === 'shiny') return rollNestShinyBonus(level, difficulty, true);
    var heal = rollNestHealingDrop(level, difficulty);
    return {
      type: 'combat_item',
      itemKey: heal.itemKey,
      quantity: heal.quantity,
      tier: heal.tier,
      icon: heal.icon,
      name: heal.name,
      desc: 'Healing item for battle.',
    };
  }

  function buildEndlessClearRewardDrops(defeatedBirds, opts) {
    opts = opts || {};
    var birds = Array.isArray(defeatedBirds) ? defeatedBirds : [];
    var difficulty = opts.difficulty || 'juvenile';
    var stage = Math.max(1, Math.floor(Number(opts.stage) || 1));
    var used = new Set();
    var drops = [];
    birds.forEach(function (bird) {
      var level = Math.max(1, Math.floor(Number(bird.level) || 1));
      var heal = rollNestHealingDrop(level, difficulty);
      drops.push({
        type: 'combat_item',
        itemKey: heal.itemKey,
        quantity: heal.quantity,
        tier: heal.tier,
        icon: heal.icon,
        name: heal.name,
        desc: 'Healing item for battle.',
      });
      var tier = rollNestMutationTier(level);
      var dataTier = tier === 'grey' ? 'white' : tier;
      var rw = null;
      if (typeof Avian.mutations !== 'undefined' && typeof Avian.mutations.rollMutationReward === 'function') {
        var guard = 0;
        while (guard < 25) {
          guard++;
          rw = Avian.mutations.rollMutationReward({ tier: dataTier, stage: stage, isBoss: !!bird.isBoss });
          if (!rw) continue;
          if (used.has(rw.id)) continue;
          used.add(rw.id);
          break;
        }
      }
      if (!rw) {
        drops.push({
          type: 'combat_item',
          itemKey: 'freshWater',
          quantity: 1,
          tier: 'grey',
          icon: '💧',
          name: 'Fresh Water',
          desc: 'Fallback endless reward.',
        });
      } else {
        drops.push(Object.assign({ type: 'mutation' }, rw));
      }
    });
    return drops;
  }

  function buildNestRewardDrops(defeatedBirds, opts) {
    opts = opts || {};
    var birds = Array.isArray(defeatedBirds) ? defeatedBirds : [];
    var difficulty = opts.difficulty || 'juvenile';
    var stage = Math.max(1, Math.floor(Number(opts.stage) || 1));
    var isBoss = !!opts.isBoss;
    var used = new Set();
    if (opts.storyMode !== false) {
      var sourceBird = birds[0] || { level: stage, isBoss: isBoss };
      var drops = [rollMutationRewardForBird(sourceBird, difficulty, stage, isBoss || !!sourceBird.isBoss, used)];
      var bonus = rollStoryBonusDrop(sourceBird, difficulty);
      if (bonus) drops.push(bonus);
      return drops;
    }
    return birds.map(function (bird) {
      return rollDropForBird(bird, difficulty, stage, isBoss, used);
    });
  }

  function getDefeatedBirdsForReward() {
    var g = global.G;
    if (!g) return [];
    if (Array.isArray(g._defeatedEncounterBirds) && g._defeatedEncounterBirds.length) {
      return g._defeatedEncounterBirds.slice();
    }
    var enemy = g.enemy;
    var level = typeof global.getEnemyPreviewLevel === 'function'
      ? global.getEnemyPreviewLevel(enemy)
      : (enemy && (enemy.storyLevel || enemy.effectiveLevel)) || 1;
    return [{ level: level, birdKey: enemy && enemy.birdKey }];
  }

  function grantNestDrop(drop) {
    if (!drop || !global.G || !global.G.player) return false;
    var g = global.G;
    if (drop.type === 'mutation') {
      if (typeof global.applySingleReward === 'function') {
        global.applySingleReward(drop);
      } else {
        var itemId = drop.mutationItemId || drop.id;
        if (itemId && typeof Avian.mutations !== 'undefined' && typeof Avian.mutations.addToInventory === 'function') {
          Avian.mutations.addToInventory(g.player, itemId);
        }
      }
      return true;
    }
    if (drop.type === 'shiny') {
      var amt = Math.max(1, Math.floor(Number(drop.amount) || 1));
      g.shinyObjects = (g.shinyObjects || 0) + amt;
      if (typeof global.logMsg === 'function') {
        global.logMsg('✨ Nest bonus: +' + amt + ' Shiny Object' + (amt > 1 ? 's' : '') + '!', 'exp-gain');
      }
      if (!g.collectedRewards) g.collectedRewards = [];
      g.collectedRewards.push({ id: 'nest_shiny', icon: drop.icon, tier: drop.tier, name: drop.name, desc: drop.desc });
      return true;
    }
    if (drop.type === 'combat_item') {
      var qty = Math.max(1, Math.floor(Number(drop.quantity) || 1));
      if (typeof global.addCombatItem === 'function') {
        global.addCombatItem(g.player, drop.itemKey, qty);
      }
      if (typeof global.logMsg === 'function') {
        global.logMsg('🪺 Nest drop: ' + drop.name + '!', 'system');
      }
      if (!g.collectedRewards) g.collectedRewards = [];
      g.collectedRewards.push({ id: drop.itemKey, icon: drop.icon, tier: drop.tier, name: drop.name, desc: drop.desc || '' });
      return true;
    }
    if (drop.type === 'savedEggs') {
      var eggCount = Math.max(1, Math.floor(Number(drop.count) || 1));
      if (typeof global.addSavedEggs === 'function') global.addSavedEggs(eggCount);
      if (typeof global.logMsg === 'function') {
        global.logMsg('🥚 +' + eggCount + ' Saved Egg' + (eggCount > 1 ? 's' : '') + '!', 'exp-gain');
      }
      if (!g.collectedRewards) g.collectedRewards = [];
      g.collectedRewards.push({ id: 'savedEggs', icon: drop.icon || '🥚', tier: drop.tier, name: drop.name, desc: drop.desc || '' });
      return true;
    }
    if (drop.type === 'goldenGoose') {
      var gooseCount = Math.max(1, Math.floor(Number(drop.count) || 1));
      if (typeof global.addGoldenGooseEggs === 'function') global.addGoldenGooseEggs(gooseCount);
      if (typeof global.logMsg === 'function') {
        global.logMsg('🪿 +' + gooseCount + ' Golden Goose Egg' + (gooseCount > 1 ? 's' : '') + '!', 'exp-gain');
      }
      if (!g.collectedRewards) g.collectedRewards = [];
      g.collectedRewards.push({ id: 'goldenGoose', icon: drop.icon || '🪿', tier: drop.tier, name: drop.name, desc: drop.desc || '' });
      return true;
    }
    return false;
  }

  ns.getNestMutationTiersForBirdLevel = getNestMutationTiersForBirdLevel;
  ns.buildNestRewardDrops = buildNestRewardDrops;
  ns.buildEndlessClearRewardDrops = buildEndlessClearRewardDrops;
  ns.getDefeatedBirdsForReward = getDefeatedBirdsForReward;
  ns.grantNestDrop = grantNestDrop;

  global.buildNestRewardDrops = buildNestRewardDrops;
  global.buildEndlessClearRewardDrops = buildEndlessClearRewardDrops;
  global.getDefeatedBirdsForReward = getDefeatedBirdsForReward;
  global.grantNestDrop = grantNestDrop;
})();
