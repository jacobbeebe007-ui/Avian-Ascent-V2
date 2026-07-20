/* Avian Ascent — Combat Pack Boot Glue.
 *
 * Runs after `js/core/game.js` (so `ACTIONS`, `ABILITY_TEMPLATES`, `BIRDS`,
 * `UPGRADE_CARDS_REWORK`, etc. exist) and after the combat-pack data files
 * (so `Avian.data.combatPack` is populated). Job: bind the data to the live
 * registries the game already reads, without touching the runtime helpers.
 *
 * Specifically:
 *   1. Joins each `BIRDS[key]` with `combatPack.birdKits[key]`:
 *        - sets `startAbilities` to the 4-slot layout (2 starters + 2 empties)
 *        - sets `passive` to `{id,name,desc}` from `combatPack.birdPassives`
 *        - sets `mainAttackId` to the slot-0 starter's ability id
 *        - sets `slotAbilities` (up to 7 base ability ids) for card-tier unlocks
 *   2. Populates `ABILITY_TEMPLATES` from `combatPack.skillTrees` so legacy
 *      lookups like `ABILITY_TEMPLATES[id]?.btnType` keep resolving.
 *   3. Registers dispatcher proxies in `ACTIONS` for every ability id.
 *   4. Monkey-patches `generateShopItems` so the existing shop UI sells
 *      ability families from `combatPack.shopPool` instead of stat cards.
 *
 * Family-evolution catalogs (`FAMILY_EVOLUTION_BIRD_DATA`) are not built —
 * flat startAbilities / slotAbilities are the source of truth.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  if (!Avian.data || !Avian.data.combatPack) {
    console.warn('[combat-pack-boot] missing Avian.data.combatPack — skipping bind. All birds will fall back to flat ability slots until the bundle is rebuilt (npm run bundle) and the page is hard-refreshed to clear the service worker cache.');
    return;
  }
  var pack = Avian.data.combatPack;

  // 1. ── Empty legacy content registries -----------------------------------
  function clearObject(target, label) {
    if (!target || typeof target !== 'object') return;
    if (Object.isFrozen(target)) {
      if (Avian.debug && Avian.debug.enabled) console.warn('[combat-pack-boot] skipping frozen', label);
      return;
    }
    for (var key in target) { try { delete target[key]; } catch (_e) { /* sealed value */ } }
  }
  try {
    if (typeof globalThis.UPGRADE_CARDS_REWORK !== 'undefined') globalThis.UPGRADE_CARDS_REWORK = [];
    clearObject(globalThis.CLASS_PERK_DEFS, 'CLASS_PERK_DEFS');
    clearObject(globalThis.CLASS_PERK_BY_CLASS, 'CLASS_PERK_BY_CLASS');
    clearObject(globalThis.PASSIVE_EVOLUTION_DEFS, 'PASSIVE_EVOLUTION_DEFS');
    if (Array.isArray(globalThis._SHOP_UTILS_REGULAR)) globalThis._SHOP_UTILS_REGULAR.length = 0;
    if (Array.isArray(globalThis._SHOP_UTILS_BOSS)) globalThis._SHOP_UTILS_BOSS.length = 0;
  } catch (e) {
    console.warn('[combat-pack-boot] failed to clear legacy registries:', e);
  }

  // 2. ── Build ABILITY_TEMPLATES rows from skill trees ---------------------
  function normalizeEnLabel(s) {
    return String(s || '').replace(/\b(\d+)\s*AP\b/g, '$1 EN').replace(/\bAP\s*·/g, 'EN ·');
  }
  globalThis.normalizeCombatEnLabel = normalizeEnLabel;

  function resolveCombatRowBtnType(row) {
    if (!row) return 'utility';
    if (/magic|song|spell/i.test(row.category || '')) return 'spell';
    if (typeof globalThis.isHybridDamage === 'function' && globalThis.isHybridDamage(row)) return 'hybrid';
    if (String(row.scaleStat || '').toUpperCase() === 'MATK') return 'spell';
    if (Number(row.pierceMdef) > 0 && !Number(row.pierceDef)) return 'spell';
    if (row.branch === 'utility' && (row.noDamage || row.target === 'self')) return 'utility';
    if (/utility|guard|heal|buff|control/i.test(row.category || '') && row.noDamage) return 'utility';
    if (row.target === 'self' && row.noDamage) return 'utility';
    return 'physical';
  }
  globalThis.resolveCombatRowBtnType = resolveCombatRowBtnType;

  function rowToTemplate(row) {
    var btnType = resolveCombatRowBtnType(row);
    var ailmentList = row.ailment ? (Array.isArray(row.ailment) ? row.ailment : [row.ailment]) : [];
    var primaryAil = ailmentList[0] || null;
    var secondaryAil = ailmentList[1] || null;
    var ailChance = row.ailmentChance || 0;
    var desc = normalizeEnLabel(String(row.shortDesc || '').trim());
    if (!desc && typeof globalThis.describeMasterAbility === 'function') {
      desc = normalizeEnLabel(globalThis.describeMasterAbility(row));
    }
    if (!desc) {
      desc = normalizeEnLabel(row.riderText && row.designNote && row.riderText !== row.designNote
        ? row.designNote + ' — ' + row.riderText
        : (row.designNote || row.riderText || ''));
    }
    var level = {
      lv: 1,
      desc: desc,
      newAilment: primaryAil,
      ailChance: ailChance,
      newAilment2: secondaryAil,
      ailChance2: secondaryAil ? ailChance : 0,
    };
    var apCost = row.apCost || row.enCost || 1;
    var isStarterMain = row.starterSlot === 0 && row.level === 1 && row.branch === 'base';
    var tooltipDesc = normalizeEnLabel(String(row.displayText || row.shortDesc || desc).trim());
    var combatBrief = typeof globalThis.buildAbilityCombatBrief === 'function'
      ? globalThis.buildAbilityCombatBrief({ id: row.id }, row)
      : (row.displayText ? normalizeEnLabel(String(row.displayText).split('\n').slice(1, 5).join('\n')) : desc);
    return {
      id: row.id,
      name: row.name || row.id,
      type: btnType,
      btnType: btnType,
      desc: normalizeEnLabel(String(row.shortDesc || desc).trim()),
      shortDesc: desc,
      combatBrief: combatBrief,
      tooltipDesc: tooltipDesc,
      energyCost: apCost,
      energy: apCost,
      energyByLevel: [apCost, apCost, apCost, apCost],
      cooldownByLevel: [Number(row.cooldown) || 0, Number(row.cooldown) || 0, Number(row.cooldown) || 0, Number(row.cooldown) || 0],
      isUltimate: !!row.isUltimate,
      tags: row.tags || [],
      isMainAttack: isStarterMain || undefined,
      fixedMainAttackCost: (isStarterMain && apCost >= 2) || undefined,
      pierceDef: row.pierceDef || 0,
      pierceMdef: row.pierceMdef || 0,
      hits: row.hits || 1,
      baseDmgMult: (row.scalePct || 0) / 100,
      ailments: ailmentList,
      ailChance: ailChance,
      levels: [
        Object.assign({}, level, { lv: 1 }),
        Object.assign({}, level, { lv: 2 }),
        Object.assign({}, level, { lv: 3 }),
        Object.assign({}, level, { lv: 4 }),
      ],
      _combatPackRow: row,
    };
  }
  try {
    if (typeof globalThis.ABILITY_TEMPLATES !== 'undefined') {
      // Wipe legacy entries first
      for (var ai in globalThis.ABILITY_TEMPLATES) delete globalThis.ABILITY_TEMPLATES[ai];
      for (var id in pack.skillTrees) {
        if (typeof globalThis.enrichCombatRow === 'function') {
          globalThis.enrichCombatRow(pack.skillTrees[id]);
        }
        globalThis.ABILITY_TEMPLATES[id] = rowToTemplate(pack.skillTrees[id]);
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to populate ABILITY_TEMPLATES:', e);
  }

  // The data pack uses fuller bird names (e.g. "shoebillstork") while BIRDS in
  // js/data/birds.js uses shorter keys ("shoebill"). Map BIRDS-side key → pack-side key.
  var BIRD_KEY_ALIASES = Object.freeze({
    shoebill: 'shoebillstork',
    penguin: 'emperorpenguin',
    fairywren: 'superbfairywren',
    wagtail: 'williewagtail',
    pelican: 'australianpelican',
  });
  function packKeyFor(birdKey) {
    return BIRD_KEY_ALIASES[birdKey] || birdKey;
  }

  // 3. ── Join BIRDS with bird kits + passives ------------------------------
  function buildAbilityInstance(abId, familyId, slot) {
    var row = pack.skillTrees && pack.skillTrees[abId];
    if (!row) return null;
    var btnType = resolveCombatRowBtnType(row);
    return {
      id: row.id,
      familyId: familyId,
      name: row.name,
      desc: row.shortDesc || row.designNote || row.riderText || '',
      type: btnType,
      btnType: btnType,
      energy: row.apCost || 1,
      energyCost: row.apCost || 1,
      level: 1,
      slotIndex: slot,
      pierceDef: row.pierceDef || 0,
      pierceMdef: row.pierceMdef || 0,
      ailmentIds: row.ailment ? (Array.isArray(row.ailment) ? row.ailment : [row.ailment]) : [],
    };
  }
  // Locate a starter ability id by bird kit slot. The data pack has the family ID via Ability Families
  // (one family per (bird, slot)) and the base ability row sits at <FAMILY>_L1_BASE.
  function familyIdFor(birdKey, slot) {
    if (!pack.families) return null;
    var alias = packKeyFor(birdKey);
    for (var id in pack.families) {
      var f = pack.families[id];
      if (f.birdKey !== birdKey && f.birdKey !== alias) continue;
      var fSlot = f.abilitySlot != null ? f.abilitySlot : f.starterSlot;
      if (fSlot === slot) return id;
    }
    return null;
  }
  function abilityIdForFamily(familyId) {
    return familyId + '_S1';
  }
  try {
    if (typeof globalThis.BIRDS === 'object' && globalThis.BIRDS) {
      for (var birdKey in globalThis.BIRDS) {
        var bird = globalThis.BIRDS[birdKey];
        if (!bird) continue;
        var alias = packKeyFor(birdKey);
        var kit = pack.birdKits && (pack.birdKits[birdKey] || pack.birdKits[alias]);
        if (!kit) continue;
        var famA = familyIdFor(birdKey, 0);
        var famB = familyIdFor(birdKey, 1);
        if (!famA || !famB) continue;
        var starterA = abilityIdForFamily(famA);
        var starterB = abilityIdForFamily(famB);
        bird.startAbilities = [starterA, starterB];
        bird.mainAttackId = starterA;
        // Flat slot ability ids for card-tier unlocks (no family-evolution catalog).
        bird.slotAbilities = [];
        for (var sSlot = 0; sSlot < 7; sSlot++) {
          var famSlotId = familyIdFor(birdKey, sSlot);
          bird.slotAbilities.push(famSlotId ? abilityIdForFamily(famSlotId) : null);
        }
        if (bird.combatFamilies) delete bird.combatFamilies;
        bird.aspect = bird.aspect || (kit && kit.aspect) || (pack.birdKits[birdKey] && pack.birdKits[birdKey].aspect) || '';
        // Locate the passive by birdKey (with alias fallback)
        var passive = null;
        for (var pid in (pack.birdPassives || {})) {
          var pBird = pack.birdPassives[pid].birdKey;
          if (pBird === birdKey || pBird === alias) { passive = pack.birdPassives[pid]; break; }
        }
        if (passive) {
          bird.passive = {
            id: passive.id,
            name: passive.name,
            desc: passive.effect || '',
            trigger: passive.trigger || '',
          };
          if (passive.classPerk) bird.classPerk = passive.classPerk;
          if (passive.classPerkEffect) bird.classPerkEffect = passive.classPerkEffect;
        } else {
          bird.passive = { id: birdKey + '_passive_unset', name: 'No Passive', desc: '' };
        }
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to join BIRDS with combat pack:', e);
  }

  // 3b. ── Ability aliases + optional pack helpers (no family-evolution catalogs)
  if (pack.abilityAliases) {
    globalThis.ABILITY_ID_ALIASES = pack.abilityAliases;
  }
  globalThis.buildFamilyEntryFromPackId = function buildFamilyEntryFromPackId() { return null; };
  globalThis.UNIVERSAL_FAMILY_ABILITY_LOOKUP = Object.create(null);
  Avian.systems = Avian.systems || Object.create(null);
  Avian.systems.combatPackBoot = Avian.systems.combatPackBoot || Object.create(null);
  Avian.systems.combatPackBoot.buildFamilyForBird = function () { return null; };
  try {
    if (typeof globalThis.FAMILY_EVOLUTION_BIRD_DATA === 'object' && globalThis.FAMILY_EVOLUTION_BIRD_DATA) {
      for (var fkk in globalThis.FAMILY_EVOLUTION_BIRD_DATA) delete globalThis.FAMILY_EVOLUTION_BIRD_DATA[fkk];
    }
  } catch (_clearFes) { /* noop */ }

  // 4. ── Register dispatcher proxies for ACTIONS ---------------------------
  try {
    if (typeof globalThis.ACTIONS === 'object' && globalThis.ACTIONS) {
      // Clear all legacy ACTIONS handlers so nothing maps to dead bird-specific JS
      for (var ak in globalThis.ACTIONS) delete globalThis.ACTIONS[ak];
      if (Avian.dispatcher && typeof Avian.dispatcher.registerActions === 'function') {
        var n = Avian.dispatcher.registerActions(globalThis.ACTIONS);
        if (Avian.debug && Avian.debug.enabled) console.log('[combat-pack-boot] registered', n, 'dispatcher proxies in ACTIONS');
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to register ACTIONS proxies:', e);
  }

  // 5. ── Shop monkey-patch -------------------------------------------------
  try {
    if (typeof globalThis.generateShopItems === 'function' && Avian.shop) {

      function buildCombatItemOffers() {
        var SHOP_COMBAT_ITEMS = globalThis.SHOP_COMBAT_ITEMS;
        if (!SHOP_COMBAT_ITEMS) return [];
        return SHOP_COMBAT_ITEMS.map(function (it) {
          return Object.assign({}, it, { shopCategory: 'items' });
        });
      }

      function setShopItems(items) {
        if (typeof globalThis.assignShopItems === 'function') {
          globalThis.assignShopItems(items);
        } else {
          globalThis._shopItems = items;
        }
      }

      function restoreShopItemById(id) {
        if (typeof globalThis._findShopItemById === 'function') {
          var found = globalThis._findShopItemById(id);
          if (found) return found;
        }
        if (Avian.mutations && typeof Avian.mutations.reconstructShopOffer === 'function') {
          var mut = Avian.mutations.reconstructShopOffer(id);
          if (mut) return mut;
        }
        return Avian.shop.findById(id);
      }

      function currentShopStage() {
        if (!globalThis.G) return 1;
        return Math.max(1, Number(globalThis.G.stage) || 1);
      }

      function resolveCustomShopNode(nodeId) {
        if (nodeId == null) return null;
        var map = typeof globalThis.loadCustomOverworldMap === 'function'
          ? globalThis.loadCustomOverworldMap()
          : null;
        if (!map) return null;
        var mapId = (globalThis.G && globalThis.G._currentShopMapId) || 'main';
        var nodes = mapId === 'main'
          ? (map.nodes || [])
          : ((map.worlds && map.worlds[mapId] && map.worlds[mapId].nodes) || []);
        return nodes.find(function (n) { return n && Number(n.id) === Number(nodeId); }) || null;
      }

      function buildCustomShopOffers(shopConfig) {
        var offers = (shopConfig && Array.isArray(shopConfig.offers)) ? shopConfig.offers : [];
        var out = [];
        offers.forEach(function (offer) {
          if (!offer || offer.id == null) return;
          var qty = Math.max(1, Math.min(20, Math.floor(Number(offer.qty) || 1)));
          var base = restoreShopItemById(offer.id);
          if (!base && offer.itemKey) {
            var catalog = globalThis.COMBAT_ITEM_CATALOG || {};
            var def = catalog[offer.itemKey];
            if (def && typeof globalThis.buildCombatItemShopOffer === 'function') {
              base = globalThis.buildCombatItemShopOffer(def);
            }
          }
          if (!base) return;
          for (var i = 0; i < qty; i++) {
            out.push(Object.assign({}, base));
          }
        });
        return out;
      }

      globalThis.__avianPatchedGenerateShopItems = function () {
        var nodeId = (globalThis.G && globalThis.G._currentShopNodeId) != null ? globalThis.G._currentShopNodeId : null;
        var mode = (globalThis.G && globalThis.G._shopMode) || 'boss';

        if (nodeId != null && globalThis.G && globalThis.G._shopSnapshots && globalThis.G._shopSnapshots[nodeId]) {
          var snap = globalThis.G._shopSnapshots[nodeId];
          var bought = new Set(snap.boughtIds || []);
          var restored = (snap.itemIds || [])
            .filter(function (id) { return !bought.has(id); })
            .map(restoreShopItemById)
            .filter(Boolean);
          setShopItems(restored);
          if (typeof globalThis.renderShopItems === 'function') globalThis.renderShopItems();
          return;
        }

        var items = [];
        var shopNode = resolveCustomShopNode(nodeId);
        var shopConfig = shopNode && shopNode.shopConfig;
        if (shopConfig && shopConfig.useCustomStock) {
          items = buildCustomShopOffers(shopConfig);
        } else {
          items = buildCombatItemOffers();
          if (Avian.mutations && typeof Avian.mutations.rollMutationStock === 'function') {
            var mutCount = mode === 'endless-boss' ? 1 : 9;
            var mutOffers = Avian.mutations.rollMutationStock(mutCount, currentShopStage(), new Set());
            items.push.apply(items, mutOffers);
          }
        }
        setShopItems(items);

        if (nodeId != null) {
          if (!globalThis.G._shopSnapshots) globalThis.G._shopSnapshots = {};
          globalThis.G._shopSnapshots[nodeId] = {
            mode: mode,
            itemIds: items.map(function (it) { return it.id; }),
            boughtIds: [],
          };
          if (typeof globalThis.saveRun === 'function') globalThis.saveRun();
        }
        if (typeof globalThis.renderShopItems === 'function') globalThis.renderShopItems();
      };
      globalThis.generateShopItems = globalThis.__avianPatchedGenerateShopItems;
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to patch generateShopItems:', e);
  }

  // 6. ── getUpgradePool returns empty (legacy stat cards retired) ---------
  try {
    if (typeof globalThis.getUpgradePool === 'function') {
      globalThis.getUpgradePool = function () { return []; };
    }
  } catch (_e) { /* noop */ }

  // 7. ── Family-evolution gap birds: drop (data pack supplies them) -------
  try {
    if (Avian.data && Avian.data.familyEvolutionGapBirds) {
      Avian.data.familyEvolutionGapBirds = {};
    }
  } catch (_e) { /* noop */ }

  if (Avian.debug && Avian.debug.enabled) console.log('[combat-pack-boot] complete.');
})();
