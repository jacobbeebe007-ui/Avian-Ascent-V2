/* Avian Ascent — Equipment-era boot glue (Phase 13).
 *
 * Runs after game.js and equipment data/systems. Binds equipment skills to
 * ABILITY_TEMPLATES / ACTIONS and applies v0.3 bird identity to BIRDS entries.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});

  function clearObject(target, label) {
    if (!target || typeof target !== 'object') return;
    if (Object.isFrozen(target)) {
      if (Avian.debug && Avian.debug.enabled) console.warn('[combat-pack-boot] skipping frozen', label);
      return;
    }
    for (var key in target) { try { delete target[key]; } catch (_e) { /* sealed */ } }
  }

  function normalizeEnLabel(s) {
    return String(s || '').replace(/\b(\d+)\s*AP\b/g, '$1 EN').replace(/\bAP\s*·/g, 'EN ·');
  }
  globalThis.normalizeCombatEnLabel = normalizeEnLabel;

  function resolveCombatRowBtnType(row) {
    if (!row) return 'utility';
    if (/magic|spell/i.test(row.category || '')) return 'spell';
    if (/^song$/i.test(row.category || '') || /song/i.test(row.skillType || '')) return 'song';
    if (typeof globalThis.isHybridDamage === 'function' && globalThis.isHybridDamage(row)) return 'hybrid';
    if (String(row.scaleStat || row.damageStat || '').toUpperCase() === 'MATK') return 'spell';
    if (Number(row.pierceMdef) > 0 && !Number(row.pierceDef)) return 'spell';
    if (row.branch === 'utility' && (row.noDamage || row.target === 'self')) return 'utility';
    if (/utility|guard|heal|buff|control/i.test(row.category || '') && row.noDamage) return 'utility';
    if (row.target === 'self' && row.noDamage) return 'utility';
    var family = String(row.family || row.weaponFamily || '').toLowerCase();
    if (!family && Array.isArray(row.tags)) {
      for (var ti = 0; ti < row.tags.length; ti++) {
        var tag = String(row.tags[ti] || '').toLowerCase();
        if (/bow|crossbow/.test(tag)) { family = tag; break; }
      }
    }
    if (/bow|crossbow/.test(family)) return 'ranged';
    return 'physical';
  }
  globalThis.resolveCombatRowBtnType = resolveCombatRowBtnType;

  function rowToTemplate(row) {
    var btnType = resolveCombatRowBtnType(row);
    var ailmentList = row.ailment ? (Array.isArray(row.ailment) ? row.ailment : [row.ailment]) : [];
    var primaryAil = ailmentList[0] || null;
    var secondaryAil = ailmentList[1] || null;
    var ailChance = row.ailmentChance || 0;
    var desc = normalizeEnLabel(String(row.shortDesc || row.desc || '').trim());
    if (!desc && typeof globalThis.describeMasterAbility === 'function') {
      desc = normalizeEnLabel(globalThis.describeMasterAbility(row));
    }
    if (!desc) desc = normalizeEnLabel(row.riderText || row.designNote || '');
    var apCost = row.apCost || row.enCost || row.energyCost || 1;
    var level = {
      lv: 1,
      desc: desc,
      newAilment: primaryAil,
      ailChance: ailChance,
      newAilment2: secondaryAil,
      ailChance2: secondaryAil ? ailChance : 0,
    };
    var tooltipDesc = normalizeEnLabel(String(row.displayText || row.shortDesc || desc).trim());
    var combatBrief = typeof globalThis.buildAbilityCombatBrief === 'function'
      ? globalThis.buildAbilityCombatBrief({ id: row.id }, row)
      : desc;
    return {
      id: row.id,
      name: row.name || row.id,
      type: btnType,
      btnType: btnType,
      desc: desc,
      shortDesc: desc,
      combatBrief: combatBrief,
      tooltipDesc: tooltipDesc,
      energyCost: apCost,
      energy: apCost,
      energyByLevel: [apCost, apCost, apCost, apCost],
      cooldownByLevel: [Number(row.cooldown) || 0, Number(row.cooldown) || 0, Number(row.cooldown) || 0, Number(row.cooldown) || 0],
      isUltimate: !!row.isUltimate,
      tags: row.tags || [],
      pierceDef: row.pierceDef || 0,
      pierceMdef: row.pierceMdef || 0,
      hits: row.hits || row.hitCount || 1,
      baseDmgMult: row.abilityPower != null ? Number(row.abilityPower) : ((row.scalePct || 0) / 100),
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
    if (typeof globalThis.UPGRADE_CARDS_REWORK !== 'undefined') globalThis.UPGRADE_CARDS_REWORK = [];
    clearObject(globalThis.CLASS_PERK_DEFS, 'CLASS_PERK_DEFS');
    clearObject(globalThis.CLASS_PERK_BY_CLASS, 'CLASS_PERK_BY_CLASS');
    clearObject(globalThis.PASSIVE_EVOLUTION_DEFS, 'PASSIVE_EVOLUTION_DEFS');
    if (Array.isArray(globalThis._SHOP_UTILS_REGULAR)) globalThis._SHOP_UTILS_REGULAR.length = 0;
    if (Array.isArray(globalThis._SHOP_UTILS_BOSS)) globalThis._SHOP_UTILS_BOSS.length = 0;
  } catch (e) {
    console.warn('[combat-pack-boot] failed to clear legacy registries:', e);
  }

  var skillCatalog = Avian.data && Avian.data.equipment && Avian.data.equipment.skills;
  var actionsNs = Avian.equipmentActions;

  try {
    if (typeof globalThis.ABILITY_TEMPLATES !== 'undefined' && skillCatalog) {
      for (var ai in globalThis.ABILITY_TEMPLATES) delete globalThis.ABILITY_TEMPLATES[ai];
      for (var skillId in skillCatalog) {
        var row = actionsNs && typeof actionsNs.skillToAbilityRow === 'function'
          ? actionsNs.skillToAbilityRow(skillId, null, 'grey')
          : null;
        if (!row) continue;
        if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(row);
        globalThis.ABILITY_TEMPLATES[skillId] = rowToTemplate(row);
      }
      var innateUtils = Avian.data && Avian.data.combatPack && Avian.data.combatPack.innateUtilities;
      if (innateUtils && actionsNs && typeof actionsNs.resolveInnateUtility === 'function') {
        for (var birdKey in innateUtils) {
          var utilRow = actionsNs.resolveInnateUtility({ birdKey: birdKey });
          if (!utilRow || !utilRow._dispatcherRow) continue;
          var utilId = utilRow.id;
          if (typeof globalThis.enrichCombatRow === 'function') globalThis.enrichCombatRow(utilRow._dispatcherRow);
          globalThis.ABILITY_TEMPLATES[utilId] = rowToTemplate(utilRow._dispatcherRow);
        }
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to populate ABILITY_TEMPLATES from equipment skills:', e);
  }

  try {
    if (typeof globalThis.BIRDS === 'object' && globalThis.BIRDS) {
      for (var bk in globalThis.BIRDS) {
        var bird = globalThis.BIRDS[bk];
        if (!bird) continue;
        if (typeof Avian.applyBirdV2IdentityToEntry === 'function') {
          Avian.applyBirdV2IdentityToEntry(bk, bird);
        }
        if (bird.combatFamilies) delete bird.combatFamilies;
        if (bird.startAbilities) delete bird.startAbilities;
        if (bird.slotAbilities) delete bird.slotAbilities;
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to apply bird identity:', e);
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

  try {
    if (typeof globalThis.ACTIONS === 'object' && globalThis.ACTIONS) {
      for (var ak in globalThis.ACTIONS) delete globalThis.ACTIONS[ak];
      if (Avian.dispatcher && typeof Avian.dispatcher.registerActions === 'function') {
        var n = Avian.dispatcher.registerActions(globalThis.ACTIONS);
        if (Avian.debug && Avian.debug.enabled) console.log('[combat-pack-boot] registered', n, 'dispatcher proxies in ACTIONS');
      }
    }
  } catch (e) {
    console.warn('[combat-pack-boot] failed to register ACTIONS proxies:', e);
  }

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
        if (Avian.equipmentLoot && typeof Avian.equipmentLoot.reconstructShopOffer === 'function') {
          var eq = Avian.equipmentLoot.reconstructShopOffer(id);
          if (eq) return eq;
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
          for (var i = 0; i < qty; i++) out.push(Object.assign({}, base));
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
          if (Avian.equipmentLoot && typeof Avian.equipmentLoot.rollUnlockedTierShopStock === 'function') {
            var unlocked = typeof Avian.equipmentLoot.getRunUnlockedEquipmentRarities === 'function'
              ? Avian.equipmentLoot.getRunUnlockedEquipmentRarities(globalThis.G && globalThis.G.player, globalThis.G)
              : ['grey'];
            var eqOffers = Avian.equipmentLoot.rollUnlockedTierShopStock({
              unlockedRarities: unlocked,
              perTier: (typeof globalThis.SHOP_EQUIPMENT_PER_TIER === 'number') ? globalThis.SHOP_EQUIPMENT_PER_TIER : 6,
              usedIds: new Set(),
              filterForPlayer: true,
              player: globalThis.G && globalThis.G.player,
              stage: currentShopStage(),
              g: globalThis.G,
            });
            items.push.apply(items, eqOffers);
          } else if (Avian.equipmentLoot && typeof Avian.equipmentLoot.rollEquipmentStock === 'function') {
            var eqCount = (typeof globalThis.SHOP_EQUIPMENT_PER_TIER === 'number') ? globalThis.SHOP_EQUIPMENT_PER_TIER : 6;
            var eqOffersLegacy = Avian.equipmentLoot.rollEquipmentStock(eqCount, currentShopStage(), new Set());
            items.push.apply(items, eqOffersLegacy);
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

  try {
    if (typeof globalThis.getUpgradePool === 'function') {
      globalThis.getUpgradePool = function () { return []; };
    }
  } catch (_e) { /* noop */ }

  try {
    if (Avian.data && Avian.data.familyEvolutionGapBirds) Avian.data.familyEvolutionGapBirds = {};
  } catch (_e) { /* noop */ }

  if (Avian.debug && Avian.debug.enabled) console.log('[combat-pack-boot] complete (equipment-only).');
})();
