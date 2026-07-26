/* Avian Ascent — Equipment v0.3 action sources (Phases 4a/4b/5)
 *
 * Derives six action sources from the 7-slot loadout into dispatcher-compatible abilities.
 * Gated by Avian.flags.equipmentV2.
 */
(function () {
  'use strict';
  var Avian = globalThis.Avian || (globalThis.Avian = {});
  Avian.systems = Avian.systems || Object.create(null);
  var ns = Avian.equipmentActions = Object.create(null);

  var SOURCE_ORDER = ['basic', 'utility', 'weaponA', 'weaponB', 'armour', 'ultimate'];
  var ULTIMATE_RARITIES = { gold: true, orange: true };

  function isEquipmentV2() {
    if (typeof Avian.isEquipmentV2 === 'function') return Avian.isEquipmentV2();
    return !!(Avian.flags && Avian.flags.equipmentV2);
  }

  function combatConfig() {
    return (Avian.data && Avian.data.combatConfig) || null;
  }

  function skillsCatalog() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.skills) || null;
  }

  function getSkill(skillId) {
    var cat = skillsCatalog();
    return cat && skillId ? cat[skillId] || null : null;
  }

  function getItem(itemId) {
    if (typeof Avian.equipment !== 'undefined' && typeof Avian.equipment.getItem === 'function') {
      return Avian.equipment.getItem(itemId);
    }
    var items = Avian.data && Avian.data.equipment && Avian.data.equipment.items;
    return items && itemId ? items[itemId] || null : null;
  }

  function equippedItemId(entity, slotKey) {
    if (!entity || !entity.equipment) return null;
    var id = entity.equipment[slotKey];
    return id || null;
  }

  function equippedItem(entity, slotKey) {
    return getItem(equippedItemId(entity, slotKey));
  }

  function normalizeRarity(raw) {
    var r = String(raw || 'grey').toLowerCase();
    if (r === 'grand' || r === 'epic') return 'gold';
    if (r === 'legendary') return 'orange';
    return r;
  }

  function tierPct(tier, dir) {
    var tiers = Avian.data && Avian.data.effectTiers;
    var bucket = dir === 'down' ? 'debuff' : 'buff';
    var map = tiers && tiers[bucket];
    var t = String(tier || 'minor').toLowerCase();
    if (map && map[t] != null) return Number(map[t]);
    var cfg = combatConfig();
    if (cfg && cfg.effectTiers) {
      if (cfg.effectTiers.core && cfg.effectTiers.core[t] != null) return Number(cfg.effectTiers.core[t]);
      if (cfg.effectTiers[t] != null) return Number(cfg.effectTiers[t]);
    }
    return t === 'major' ? 12 : (t === 'moderate' ? 8 : 6);
  }

  function pointTierPct(tier) {
    var tiers = Avian.data && Avian.data.effectTiers;
    var t = String(tier || 'minor').toLowerCase();
    if (tiers && tiers.points && tiers.points[t] != null) return Number(tiers.points[t]);
    var cfg = combatConfig();
    if (cfg && cfg.effectTiers && cfg.effectTiers.points && cfg.effectTiers.points[t] != null) {
      return Number(cfg.effectTiers.points[t]);
    }
    return t === 'major' ? 8 : (t === 'moderate' ? 5 : 3);
  }

  function normalizeFamilyName(name) {
    var n = String(name || '');
    if (n === 'Talon Dagger') return 'Dagger Pinion';
    var g = Avian.data && Avian.data.displayGlossary && Avian.data.displayGlossary.familyAliases;
    if (g && g[n]) return g[n];
    return n;
  }

  function combinationsCatalog() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.combinationTechniques) || null;
  }

  function orbFocusesCatalog() {
    return (Avian.data && Avian.data.equipment && Avian.data.equipment.orbFocuses) || null;
  }

  function inferOrbFocusId(item) {
    if (!item) return null;
    if (item.orbFocus) return String(item.orbFocus).toLowerCase();
    if (item.family !== 'Focus Orb') return null;
    var orbs = orbFocusesCatalog() || {};
    var aspect = item.aspect;
    for (var oid in orbs) {
      if (!Object.prototype.hasOwnProperty.call(orbs, oid)) continue;
      if (orbs[oid].affinity === aspect || orbs[oid].exemplarItemId === item.id) return oid;
    }
    var nameMatch = String(item.name || '').match(/\b(Poison|Burn|Chill|Shock|Bleed|Echo)\b/i);
    return nameMatch ? nameMatch[1].toLowerCase() : null;
  }

  function findCombinationSkillId(mainFamily, offItem) {
    var combos = combinationsCatalog();
    if (!combos || !mainFamily || !offItem) return null;
    var mainTag = normalizeFamilyName(mainFamily);
    var focusId = inferOrbFocusId(offItem);
    var candidates = [];
    if (focusId) {
      var orbLabel = (orbFocusesCatalog() && orbFocusesCatalog()[focusId] && orbFocusesCatalog()[focusId].label)
        || (focusId.charAt(0).toUpperCase() + focusId.slice(1) + ' Orb');
      candidates.push(mainTag + '|' + orbLabel);
      candidates.push(mainTag + '|' + focusId.charAt(0).toUpperCase() + focusId.slice(1) + ' Orb');
    }
    var offFamily = normalizeFamilyName(offItem.family);
    if (offFamily && offFamily !== 'Focus Orb') {
      candidates.push(mainTag + '|' + offFamily);
    }
    for (var i = 0; i < candidates.length; i++) {
      var pairKey = candidates[i];
      for (var sid in combos) {
        if (!Object.prototype.hasOwnProperty.call(combos, sid)) continue;
        if (combos[sid].pairKey === pairKey) return sid;
      }
    }
    return null;
  }

  function matchingFocusPairSkillId(mainItem, offItem) {
    var mainFocus = inferOrbFocusId(mainItem);
    var offFocus = inferOrbFocusId(offItem);
    if (!mainFocus || !offFocus || mainFocus !== offFocus) return null;
    var id = 'PAIR_FOCUS_' + String(mainFocus).toUpperCase();
    var pack = (Avian.data && Avian.data.equipment && Avian.data.equipment.skills) || null;
    return pack && pack[id] ? id : null;
  }

  function statToRiderKind(stat, dir, target) {
    var s = String(stat || '').toLowerCase();
    var down = dir === 'down';
    var enemy = String(target || 'self').toLowerCase() === 'enemy';
    if (s === 'atk') return down ? (enemy ? 'reduceEnemyAtk' : 'gainAtk') : 'gainAtk';
    if (s === 'matk') return down ? (enemy ? 'reduceEnemyMatk' : 'gainMatk') : 'gainMatk';
    if (s === 'def') return down ? (enemy ? 'reduceEnemyDef' : 'gainDef') : 'gainDef';
    if (s === 'mdef') return down ? (enemy ? 'reduceEnemyMdef' : 'gainMdef') : 'gainMdef';
    if (s === 'spd') return down ? (enemy ? 'reduceEnemySpd' : 'gainSpeed') : 'gainSpeed';
    if (s === 'dodge') return down ? (enemy ? 'reduceEnemyDodge' : 'gainDodge') : 'gainDodge';
    if (s === 'acc') return down ? (enemy ? 'reduceEnemyAcc' : 'gainAcc') : 'gainAcc';
    if (s === 'critchance' || s === 'crit') return down ? (enemy ? 'reduceEnemyCrit' : 'gainCritChance') : 'gainCritChance';
    if (s === 'physicaldamage' || s === 'magicdamage' || s === 'damage') return 'flatDamageBonus';
    return null;
  }

  function riderWhenFromParsed(parsed) {
    if (!parsed || !parsed.trigger) return null;
    var kind = parsed.trigger.kind;
    if (kind === 'onUse') return null;
    if (kind === 'vsTargetHpBelow') return 'onHit';
    if (kind === 'vsTargetState') return 'onHit';
    if (kind === 'skillModifier') return null;
    return null;
  }

  function convertParsedRiderToRows(parsed, skillId) {
    var riders = [];
    if (!parsed) return riders;
    var when = riderWhenFromParsed(parsed);
    var effects = parsed.effects || [];
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (!eff || eff.kind !== 'tierStat') continue;
      var kind = statToRiderKind(eff.stat, eff.dir, eff.target);
      if (!kind) continue;
      var val = tierPct(eff.tier, eff.dir);
      var flatCore = !!(Avian.data && Avian.data.effectTiers && Avian.data.effectTiers.flatStat);
      var coreStat = /^(atk|matk|def|mdef|spd|dex|vitality|hp)$/i.test(String(eff.stat || ''));
      var chanceKind = kind === 'gainDodge' || kind === 'gainAcc' || kind === 'gainCritChance'
        || kind === 'reduceEnemyDodge' || kind === 'reduceEnemyAcc' || kind === 'reduceEnemyCrit';
      riders.push({
        kind: kind,
        value: val,
        when: when,
        scope: eff.target === 'enemy' ? 'enemy' : 'self',
        valueUnit: (flatCore && coreStat && !chanceKind) ? 'flat' : 'pct',
      });
    }
    var specials = parsed.specials || [];
    for (var si = 0; si < specials.length; si++) {
      var sp = specials[si];
      if (!sp || !sp.id) continue;
      if (sp.id === 'shield') riders.push({ kind: 'gainShield', value: Number(sp.maxHpPct) || 15, when: null });
      if (sp.id === 'healMaxHp') riders.push({ kind: 'healMaxHpPct', value: Number(sp.pct) || 10, when: null });
      if (sp.id === 'cleanse') {
        /* handled via applyTagRidersFromRow Cleanse tag */
      }
      if (sp.id === 'applyAilment') {
        /* ailment handled separately if wired on row */
      }
    }
    if (specials.some(function (s) { return s && s.id === 'cleanse'; })) {
      riders.push({ kind: 'tagFlag', value: 0, tags: ['Cleanse'] });
    }
    return riders;
  }

  function resolveStructuredRider(skill) {
    if (!skill) return null;
    if (skill.rider && typeof skill.rider === 'object') return skill.rider;
    if (!skill.riderText) return null;
    if (typeof Avian.workbookEffects !== 'undefined' && typeof Avian.workbookEffects.parseTrigger === 'function') {
      return {
        text: skill.riderText,
        trigger: Avian.workbookEffects.parseTrigger(skill.riderText),
        effects: [],
        specials: [],
      };
    }
    return null;
  }

  function resolveItemAspect(item, skill) {
    if (item && item.aspect && item.aspect !== 'neutral') return item.aspect;
    if (skill && skill.aspectRule && skill.aspectRule !== 'None' && skill.aspectRule !== 'Item Aspect') {
      return String(skill.aspectRule);
    }
    return item && item.aspect ? item.aspect : null;
  }

  function categoryForSkill(skill) {
    if (!skill) return 'physical';
    if (String(skill.damageType).toLowerCase() === 'utility' || String(skill.skillType).toLowerCase() === 'utility') {
      return 'utility';
    }
    if (String(skill.damageType).toLowerCase() === 'magic') return 'magic';
    return 'physical';
  }

  function btnTypeForRow(row) {
    if (typeof globalThis.resolveCombatRowBtnType === 'function') {
      return globalThis.resolveCombatRowBtnType(row);
    }
    var cat = String(row.category || '').toLowerCase();
    if (cat === 'magic' || cat === 'spell') return 'spell';
    if (row.noDamage || cat === 'utility') return 'utility';
    return 'physical';
  }

  function buildTags(skill, item, row) {
    var tags = ['Equipment'];
    if (row.isUltimate) tags.push('Ultimate');
    if (item && item.family) tags.push(String(item.family));
    if (skill && skill.skillType) tags.push(String(skill.skillType));
    if (row.noDamage) tags.push('Utility');
    return tags;
  }

  ns.skillToAbilityRow = function skillToAbilityRow(skillId, item, rarityOptional) {
    var skill = getSkill(skillId);
    if (!skill) return null;
    var rarity = normalizeRarity(rarityOptional || (item && item.rarity) || 'grey');
    var apMap = skill.ap || {};
    var apVal = skill.fixedCoefficient != null ? Number(skill.fixedCoefficient) : apMap[rarity];
    if (apVal == null && rowIsUltimate(skill)) {
      apVal = apMap.gold != null ? apMap.gold : apMap.orange;
    }
    if (apVal == null && !rowIsUltimate(skill) && apMap && typeof apMap === 'object') {
      apVal = apMap.grey != null ? apMap.grey : 1;
    }
    var pen = Number(skill.intrinsicPenPct) || 0;
    var dmgType = String(skill.damageType || 'Physical');
    var isUtil = dmgType.toLowerCase() === 'utility' || (Number(skill.hits) || 0) === 0;
    var structured = resolveStructuredRider(skill);
    var riders = convertParsedRiderToRows(structured, skillId);
    if (skill.rider && skill.rider.kind === 'applyAilment') {
      riders.push({
        kind: 'applyAilment',
        ailment: skill.rider.ailment,
        stacks: Number(skill.rider.stacks) || 1,
        when: 'onHit',
      });
    }
    var aspect = resolveItemAspect(item, skill);
    if (skill.aspectRule === 'OffHandOrbAffinity' && item && item.aspect) {
      aspect = item.aspect;
    }
    if (Avian.affinity && typeof Avian.affinity.normalize === 'function' && aspect) {
      aspect = Avian.affinity.normalize(aspect) || aspect;
    }
    var cfgWf = combatConfig();
    var weaponFirst = !!(cfgWf && cfgWf.weaponFirstV09 && cfgWf.weaponFirst && cfgWf.weaponFirst.enabled !== false);
    var skillPowerPct = skill.skillPowerPct != null ? Number(skill.skillPowerPct)
      : (apVal != null ? Math.round(Number(apVal) * (Number(apVal) <= 10 ? 100 : 1)) : null);
    var minDmg = item && item.minDamage != null ? Number(item.minDamage) : null;
    var maxDmg = item && item.maxDamage != null ? Number(item.maxDamage) : null;
    var scalingStat = skill.scalingStat || (item && item.scalingStat) || null;
    if (weaponFirst && item && item.scalingStat
      && (skill.id === 'BASIC_PHYSICAL' || skill.id === 'BASIC_MAGIC' || skill.naturalStrikeFlat)) {
      scalingStat = item.scalingStat;
      if (/magic/i.test(String(item.damageType || ''))) dmgType = 'Magic';
      else dmgType = 'Physical';
    }
    var row = {
      id: skill.id,
      name: skill.name,
      enCost: Number(skill.en) || 0,
      apCost: Number(skill.en) || 0,
      cooldown: Number(skill.cooldown) || 0,
      damageType: dmgType,
      damageCategory: skill.damageCategory || (item && item.damageCategory) || null,
      scaleStat: scalingStat,
      damageStat: scalingStat,
      scalingStat: scalingStat,
      abilityPower: apVal != null ? Number(apVal) : null,
      fixedCoefficient: skill.fixedCoefficient != null ? Number(skill.fixedCoefficient) : (apVal != null ? Number(apVal) : null),
      skillPowerPct: skillPowerPct,
      skillPower: skill.skillPower != null ? Number(skill.skillPower) : (skillPowerPct != null ? skillPowerPct / 100 : null),
      naturalStrikeFlat: skill.naturalStrikeFlat || null,
      minDamage: minDmg,
      maxDamage: maxDmg,
      baseDamage: skill.baseDamage != null ? Number(skill.baseDamage) : null,
      scaling: skill.scaling || null,
      precision: skill.precision != null ? Number(skill.precision)
        : (skill.basePrecision != null ? Number(skill.basePrecision) : null),
      coefficientFixed: !!skill.coefficientFixed,
      useDirectScaling: weaponFirst ? false : !!(skill.baseDamage != null || skill.coefficientFixed || (skill.scaling && skill.scaling.length)),
      useWeaponFirst: weaponFirst && !isUtil,
      hits: Math.max(0, Number(skill.hits) || 0),
      hitCount: Math.max(0, Number(skill.hits) || 0),
      aspect: aspect,
      isUltimate: rowIsUltimate(skill),
      piercePercent: pen / 100,
      pierceDef: dmgType === 'Magic' ? 0 : pen,
      pierceMdef: dmgType === 'Magic' ? pen : 0,
      tags: [],
      source: skill.source === 'Combination' ? 'combination' : 'equipment',
      equipmentSkillId: skillId,
      equipmentItemId: item && item.id ? item.id : null,
      riderText: skill.riderText || (structured && structured.text) || '',
      structuredRider: structured,
      category: categoryForSkill(skill),
      target: String(skill.target || 'Enemy').toLowerCase() === 'self' ? 'self' : 'enemy',
      noDamage: isUtil,
      riders: riders,
    };
    row.tags = buildTags(skill, item, row);
    if (skill.source === 'Combination') row.tags.push('Combination');
    if (typeof globalThis.applyAbilityTextEnrichment === 'function') {
      globalThis.applyAbilityTextEnrichment(row);
    }
    if (typeof globalThis.enrichCombatRow === 'function') {
      globalThis.enrichCombatRow(row);
    }
    if (apVal != null) row.abilityPower = Number(apVal);
    if (row.precision != null) row.hitChanceOverride = row.precision;
    return row;
  };

  function rowIsUltimate(skill) {
    if (!skill) return false;
    if (skill.meter === 'full' || skill.meter === 'ultimate') return true;
    return String(skill.barSlot || '').toLowerCase().indexOf('ultimate') >= 0;
  }

  function abilityFromRow(row, opts) {
    opts = opts || {};
    if (!row) return null;
    var btnType = btnTypeForRow(row);
    var ab = {
      id: row.id,
      name: row.name,
      type: btnType,
      btnType: btnType,
      level: 1,
      energyCost: Number(row.enCost) || 0,
      energy: Number(row.enCost) || 0,
      cooldown: Number(row.cooldown) || 0,
      isUltimate: !!row.isUltimate,
      isMainAttack: !!opts.isMainAttack,
      source: 'equipment',
      equipmentSkillId: row.equipmentSkillId,
      equipmentItemId: row.equipmentItemId,
      actionSource: opts.actionSource || null,
      _dispatcherRow: row,
    };
    if (opts.nameOverride) ab.name = opts.nameOverride;
    return ab;
  }

  function emptyPlaceholder(actionSource, reason) {
    return {
      empty: true,
      reason: reason || 'Unavailable',
      id: '__empty_' + actionSource,
      name: '—',
      type: 'utility',
      btnType: 'utility',
      level: 1,
      energyCost: 99,
      disabled: true,
      actionSource: actionSource,
    };
  }

  function weaponItemHands(item) {
    if (!item || item.slot !== 'Weapon') return 0;
    return Number(item.hands) || 0;
  }

  function isWeaponItem(item) {
    return !!(item && item.slot === 'Weapon');
  }

  function entityClassId(entity) {
    var cls = entity && (entity.class || entity.className || entity.birdClass);
    if (!cls && entity && entity.birdKey && typeof Avian.getBirdV2 === 'function') {
      var bird = Avian.getBirdV2(entity.birdKey);
      cls = bird && bird.class;
    }
    if (!cls && entity && entity.key && typeof Avian.getBirdV2 === 'function') {
      var bird2 = Avian.getBirdV2(entity.key);
      cls = bird2 && bird2.class;
    }
    return String(cls || '').toLowerCase();
  }

  function usesTailWandBasic(entity, basicCfg) {
    var cls = entityClassId(entity);
    var list = (basicCfg && basicCfg.tailWandClasses) || ['mage', 'siren'];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i]).toLowerCase() === cls) return true;
    }
    return false;
  }

  function basicDisplayName(entity, basicCfg, magic) {
    if (usesTailWandBasic(entity, basicCfg) || magic) {
      if (usesTailWandBasic(entity, basicCfg)) return basicCfg.tailWandName || 'Tail Wand';
    }
    return basicCfg.beakJabName || basicCfg.naturalStrikeName || 'Beak Jab';
  }

  ns.resolveBasicAttack = function resolveBasicAttack(entity) {
    var cfg = combatConfig();
    var basicCfg = cfg && cfg.basicAttack ? cfg.basicAttack : {};
    var tailWand = usesTailWandBasic(entity, basicCfg);
    var main = equippedItem(entity, 'mainHand');
    if (!main || !isWeaponItem(main)) {
      var bareId = tailWand
        ? (basicCfg.magicId || 'BASIC_MAGIC')
        : (basicCfg.physicalId || 'BASIC_PHYSICAL');
      var bareRow = ns.skillToAbilityRow(bareId, null, 'grey');
      if (!bareRow) return null;
      bareRow.heavyAccuracyPenalty = 0;
      if (tailWand) {
        bareRow.damageType = 'Magic';
        bareRow.scaleStat = 'Focus';
        bareRow.damageStat = 'Focus';
        bareRow.scalingStat = 'Focus';
      }
      return abilityFromRow(bareRow, {
        isMainAttack: true,
        actionSource: 'basic',
        nameOverride: basicDisplayName(entity, basicCfg, tailWand),
      });
    }
    var mainSkill = getSkill(main.skill1);
    var magic = tailWand || (mainSkill && String(mainSkill.damageType).toLowerCase() === 'magic');
    var basicId = magic ? (basicCfg.magicId || 'BASIC_MAGIC') : (basicCfg.physicalId || 'BASIC_PHYSICAL');
    var basicRow = ns.skillToAbilityRow(basicId, main, normalizeRarity(main.rarity));
    if (!basicRow) return null;
    basicRow.heavyAccuracyPenalty = 0;
    if (tailWand) {
      basicRow.damageType = 'Magic';
      basicRow.scaleStat = 'Focus';
      basicRow.damageStat = 'Focus';
      basicRow.scalingStat = 'Focus';
    }
    return abilityFromRow(basicRow, {
      isMainAttack: true,
      actionSource: 'basic',
      nameOverride: basicDisplayName(entity, basicCfg, magic),
    });
  };

  ns.resolveWeaponSkills = function resolveWeaponSkills(entity) {
    var out = { weaponA: null, weaponB: null };
    var main = equippedItem(entity, 'mainHand');
    if (!main || !isWeaponItem(main)) return out;
    var off = equippedItem(entity, 'offHand');
    var offWeapon = off && isWeaponItem(off) ? off : null;
    var hands = weaponItemHands(main);
    var rarityMain = normalizeRarity(main.rarity);

    if (hands === 2) {
      if (main.skill1) {
        var r1 = ns.skillToAbilityRow(main.skill1, main, rarityMain);
        out.weaponA = r1 ? abilityFromRow(r1, { actionSource: 'weaponA' }) : null;
      }
      if (main.skill2) {
        var r2 = ns.skillToAbilityRow(main.skill2, main, rarityMain);
        out.weaponB = r2 ? abilityFromRow(r2, { actionSource: 'weaponB' }) : null;
      }
      return out;
    }

    if (main.skill1) {
      var ra = ns.skillToAbilityRow(main.skill1, main, rarityMain);
      out.weaponA = ra ? abilityFromRow(ra, { actionSource: 'weaponA' }) : null;
    }

    var mainFamily = normalizeFamilyName(main.family);
    var offFamily = offWeapon ? normalizeFamilyName(offWeapon.family) : null;

    /* Dual-wield: matching Focus → matching Paired → curated Combination → unlinked normals. */
    if (offWeapon && mainFamily === 'Focus Orb' && offFamily === 'Focus Orb') {
      var focusPairId = matchingFocusPairSkillId(main, offWeapon);
      if (focusPairId) {
        var rfp = ns.skillToAbilityRow(focusPairId, main, rarityMain);
        out.weaponB = rfp ? abilityFromRow(rfp, { actionSource: 'weaponB' }) : null;
        return out;
      }
    }

    if (offWeapon && mainFamily && offFamily === mainFamily && main.pairedSkill) {
      var rp = ns.skillToAbilityRow(main.pairedSkill, main, rarityMain);
      out.weaponB = rp ? abilityFromRow(rp, { actionSource: 'weaponB' }) : null;
      return out;
    }

    if (offWeapon && (offFamily === 'Focus Orb' || mainFamily === 'Wand' || mainFamily === 'Talon Blade'
      || mainFamily === 'Duel Sabre' || mainFamily === 'War Pick')) {
      var comboId = findCombinationSkillId(mainFamily, offWeapon);
      if (comboId) {
        var rc = ns.skillToAbilityRow(comboId, offWeapon, normalizeRarity(offWeapon.rarity));
        out.weaponB = rc ? abilityFromRow(rc, { actionSource: 'weaponB' }) : null;
        return out;
      }
    }

    if (offWeapon && offWeapon.skill1) {
      var rb = ns.skillToAbilityRow(offWeapon.skill1, offWeapon, normalizeRarity(offWeapon.rarity));
      /* Focus Pulse rename / focus rider stamp */
      if (offFamily === 'Focus Orb' && rb && rb._dispatcherRow) {
        var focuses = orbFocusesCatalog();
        var focus = null;
        if (focuses) {
          for (var fid in focuses) {
            if (!Object.prototype.hasOwnProperty.call(focuses, fid)) continue;
            if (focuses[fid].exemplarItemId === offWeapon.id || focuses[fid].affinity === offWeapon.aspect) {
              focus = focuses[fid];
              break;
            }
          }
        }
        if (focus) {
          rb.name = focus.techniqueName || rb.name;
          rb._dispatcherRow.name = rb.name;
          if (focus.onHit && focus.onHit.kind === 'applyAilment') {
            rb._dispatcherRow.riders = (rb._dispatcherRow.riders || []).concat([{
              kind: 'applyAilment',
              ailment: focus.onHit.ailment,
              stacks: Number(focus.onHit.stacks) || 1,
              when: 'onHit',
            }]);
          }
        }
      }
      out.weaponB = rb;
    }
    return out;
  };

  ns.resolveArmourTechnique = function resolveArmourTechnique(entity) {
    var armour = equippedItem(entity, 'armour');
    if (!armour || !armour.skill1) return null;
    var row = ns.skillToAbilityRow(armour.skill1, armour, normalizeRarity(armour.rarity));
    return row ? abilityFromRow(row, { actionSource: 'armour' }) : null;
  };

  function collectUltimateCandidates(entity) {
    var list = [];
    if (!entity || !entity.equipment) return list;
    var order = (typeof Avian.equipment !== 'undefined' && typeof Avian.equipment.getSlotOrder === 'function')
      ? Avian.equipment.getSlotOrder()
      : ['helmet', 'armour', 'mainHand', 'offHand', 'ankletL', 'ankletR', 'necklace'];
    for (var i = 0; i < order.length; i++) {
      var item = equippedItem(entity, order[i]);
      if (!item || !item.ultimate) continue;
      var rarity = normalizeRarity(item.rarity);
      if (!ULTIMATE_RARITIES[rarity]) continue;
      list.push({ item: item, skillId: item.ultimate, rarity: rarity });
    }
    return list;
  }

  ns.resolveUltimate = function resolveUltimate(entity) {
    var candidates = collectUltimateCandidates(entity);
    if (!candidates.length) return null;

    var chosen = null;
    if (entity.ultimateSourceItemId) {
      for (var i = 0; i < candidates.length; i++) {
        if (candidates[i].item.id === entity.ultimateSourceItemId) {
          chosen = candidates[i];
          break;
        }
      }
    }
    /* Default to first equipped ultimate; extras stay in the Nest skill bank. */
    if (!chosen) {
      chosen = candidates[0];
      if (entity && !entity.isEnemy && candidates[0] && candidates[0].item) {
        entity.ultimateSourceItemId = candidates[0].item.id;
      }
    }

    if (!chosen) return null;
    var row = ns.skillToAbilityRow(chosen.skillId, chosen.item, chosen.rarity);
    if (!row) return null;
    var cfg = combatConfig();
    var ultCfg = cfg && cfg.ultimateMeter ? cfg.ultimateMeter : {};
    if (ultCfg.ultimateEnCost != null && Number(ultCfg.ultimateEnCost) > 0) {
      row.enCost = Number(ultCfg.ultimateEnCost);
      row.apCost = Number(ultCfg.ultimateEnCost);
    }
    return abilityFromRow(row, { actionSource: 'ultimate' });
  };

  ns.resolveInnateUtility = function resolveInnateUtility(entity) {
    var birdKey = entity && entity.birdKey;
    if (!birdKey) return null;
    var utils = Avian.data && Avian.data.combatPack && Avian.data.combatPack.innateUtilities;
    var util = utils && utils[birdKey];
    if (!util) return null;
    var target = String(util.target || 'Self').toLowerCase() === 'self' ? 'self' : 'enemy';
    var row = {
      id: 'innate_' + birdKey,
      name: util.name || 'Innate Utility',
      enCost: Number(util.en) || 1,
      apCost: Number(util.en) || 1,
      cooldown: Number(util.cooldown) || 0,
      damageType: 'Utility',
      category: 'utility',
      noDamage: true,
      target: target,
      hits: 0,
      riderText: util.effect || '',
      structuredRider: util.parsed || null,
      tags: ['Innate', 'Utility', 'Equipment'],
      source: 'equipment',
      equipmentSkillId: null,
      equipmentItemId: null,
      riders: convertParsedRiderToRows(util.parsed, 'innate_' + birdKey),
    };
    if (typeof globalThis.applyAbilityTextEnrichment === 'function') {
      globalThis.applyAbilityTextEnrichment(row);
    }
    if (typeof globalThis.enrichCombatRow === 'function') {
      globalThis.enrichCombatRow(row);
    }
    return abilityFromRow(row, { actionSource: 'utility' });
  };

  ns.buildActionSources = function buildActionSources(entity) {
    if (!entity) {
      return { basic: null, utility: null, weaponA: null, weaponB: null, armour: null, ultimate: null };
    }
    var weapons = ns.resolveWeaponSkills(entity);
    return {
      basic: ns.resolveBasicAttack(entity),
      utility: ns.resolveInnateUtility(entity),
      weaponA: weapons.weaponA,
      weaponB: weapons.weaponB,
      armour: ns.resolveArmourTechnique(entity),
      ultimate: ns.resolveUltimate(entity),
    };
  };

  var EMPTY_REASONS = {
    utility: 'No innate utility',
    weaponA: 'No weapon skill',
    weaponB: 'No secondary weapon skill',
    armour: 'No armour technique',
    ultimate: 'No qualifying ultimate',
  };

  ns.buildAbilitiesArray = function buildAbilitiesArray(entity) {
    var src = ns.buildActionSources(entity);
    var out = [];
    for (var i = 0; i < SOURCE_ORDER.length; i++) {
      var key = SOURCE_ORDER[i];
      var ab = src[key];
      if (ab) out.push(ab);
      else if (key === 'basic') out.push(emptyPlaceholder(key, 'Basic attack unavailable'));
      else out.push(emptyPlaceholder(key, EMPTY_REASONS[key] || 'Empty slot'));
    }
    return out;
  };

  ns.syncEntityAbilities = function syncEntityAbilities(entity) {
    if (!entity || !isEquipmentV2()) return entity;
    entity.abilities = ns.buildAbilitiesArray(entity);
    var basic = entity.abilities[0];
    if (basic && !basic.empty) {
      entity.mainAttackId = basic.id;
      entity.abilities.forEach(function (ab) {
        if (ab) ab.isMainAttack = ab.id === basic.id;
      });
    }
    return entity;
  };

  ns.getSourceOrder = function getSourceOrder() {
    return SOURCE_ORDER.slice();
  };

  ns.collectUltimateCandidates = collectUltimateCandidates;

  ns.getActionSourceLabel = function getActionSourceLabel(sourceKey) {
    var labels = {
      basic: 'Basic',
      utility: 'Utility',
      weaponA: 'Weapon A',
      weaponB: 'Weapon B',
      armour: 'Armour',
      ultimate: 'Ultimate',
    };
    return labels[sourceKey] || sourceKey || '';
  };

  Avian.systems.equipmentActions = ns;
})();
