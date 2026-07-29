/**
 * Standard combatant / loadout / combat-state builders for scenario tests.
 * Operates against a VM sandbox that has already loaded the game bundle.
 */

const STARTING_WEAPONS = Object.freeze({
  mage: 'WPN-B01',
  siren: 'WPN-B01',
  knight: 'WPN-B02',
  brute: 'WPN-B02',
  bard: 'WPN-B03',
  rogue: 'WPN-B04',
  inquisitor: 'WPN-B05',
});

export { STARTING_WEAPONS };

function sandboxAvian(sandbox) {
  return sandbox.Avian || sandbox.globalThis?.Avian;
}

/**
 * Build a bird combatant with optional overrides.
 * Prefers Avian.debug / equipment-sims builders when available.
 */
export function createTestBird(sandbox, birdKey = 'sparrow', opts = {}) {
  const Avian = sandboxAvian(sandbox);
  const key = String(birdKey || 'sparrow').toLowerCase();
  let entity;

  if (typeof Avian?.systems?.equipmentSims?.buildBirdCombatant === 'function') {
    entity = Avian.systems.equipmentSims.buildBirdCombatant(key, {
      rarity: opts.rarity || 'grey',
      isEnemy: !!opts.isEnemy,
    });
  } else {
    /* Inline equivalent of equipment-sims buildBirdCombatant */
    const birdDef = typeof Avian.getBirdDef === 'function'
      ? Avian.getBirdDef(key)
      : (sandbox.BIRDS && sandbox.BIRDS[key]);
    if (!birdDef) throw new Error(`Unknown bird: ${key}`);
    const classId = opts.class || birdDef.class || 'rogue';
    const stats = typeof Avian.buildCombatStatsFromBirdDef === 'function'
      ? Avian.buildCombatStatsFromBirdDef(birdDef, classId)
      : Object.assign({}, birdDef.stats || { hp: 50, atk: 10, def: 10, matk: 8, mdef: 8, spd: 10 });
    entity = {
      name: birdDef.name || key,
      birdKey: key,
      class: classId,
      size: birdDef.realSize || birdDef.size || 'medium',
      stats: Object.assign({}, stats),
      equipmentInventory: [],
      autoPickUltimate: true,
      isEnemy: !!opts.isEnemy,
      ultimateMeter: 0,
    };
    if (Avian.equipment) {
      if (typeof Avian.equipment.ensurePlayerEquipmentState === 'function') {
        Avian.equipment.ensurePlayerEquipmentState(entity);
      }
      entity.equipment = Avian.equipment.createEmptyLoadout
        ? Avian.equipment.createEmptyLoadout()
        : { helmet: null, armour: null, mainHand: null, offHand: null, ankletL: null, ankletR: null, necklace: null };
      const ref = Avian.equipment.findReferenceLoadout?.(classId, opts.rarity || 'grey');
      if (ref?.equipment) {
        for (const sk of Object.keys(ref.equipment)) {
          entity.equipment[sk] = ref.equipment[sk] || null;
        }
      }
    }
    if (typeof Avian.applyBirdV2IdentityToEntry === 'function') {
      Avian.applyBirdV2IdentityToEntry(key, entity);
    }
    finalizeCombatant(sandbox, entity);
  }

  applyCombatantOverrides(sandbox, entity, opts);
  return entity;
}

export function finalizeCombatant(sandbox, entity) {
  const Avian = sandboxAvian(sandbox);
  const normalizeCombatStats = sandbox.normalizeCombatStats;
  if (typeof normalizeCombatStats === 'function') normalizeCombatStats(entity.stats);
  if (entity.stats.maxHp == null) entity.stats.maxHp = entity.stats.hp;
  entity.stats.hp = entity.stats.maxHp;
  if (typeof Avian?.equipment?.applyEquipmentStatsToEntity === 'function') {
    Avian.equipment.applyEquipmentStatsToEntity(entity);
  }
  if (typeof Avian?.equipmentActions?.syncEntityAbilities === 'function') {
    Avian.equipmentActions.syncEntityAbilities(entity);
  }
  if (typeof sandbox.enforceAbilityCosts === 'function') sandbox.enforceAbilityCosts(entity);

  const g = sandbox.G;
  const prevPlayer = g && g.player;
  if (g) g.player = entity;
  entity.energyMax = typeof sandbox.computePlayerEffectiveMaxEnergy === 'function'
    ? sandbox.computePlayerEffectiveMaxEnergy(entity)
    : (typeof sandbox.computePlayerMaxEnergy === 'function' ? sandbox.computePlayerMaxEnergy() : 6);
  entity.energy = typeof sandbox.computePlayerStartEnergy === 'function'
    ? sandbox.computePlayerStartEnergy(entity)
    : Math.min(entity.energyMax, 4);
  entity.energyRegen = typeof sandbox.computePlayerEnergyRegen === 'function'
    ? sandbox.computePlayerEnergyRegen(entity)
    : 3;
  if (g) g.player = prevPlayer;
  return entity;
}

export function createTestWeapon(sandbox, weaponId) {
  const Avian = sandboxAvian(sandbox);
  const items = Avian?.data?.equipment?.items;
  const id = String(weaponId || '');
  if (items && items[id]) return { id, ...items[id] };
  return { id, name: id, slot: 'mainHand' };
}

export function createTestArmour(sandbox, armourId) {
  const Avian = sandboxAvian(sandbox);
  const items = Avian?.data?.equipment?.items;
  const id = String(armourId || '');
  if (items && items[id]) return { id, ...items[id] };
  return { id, name: id, slot: 'armour' };
}

/**
 * Equip loadout onto an entity (mutates). Accepts { mainHand, armour, … } item ids.
 */
export function applyEquipment(sandbox, entity, equipment) {
  if (!entity || !equipment) return entity;
  const Avian = sandboxAvian(sandbox);
  if (!entity.equipment) {
    entity.equipment = Avian?.equipment?.createEmptyLoadout
      ? Avian.equipment.createEmptyLoadout()
      : {};
  }
  for (const [slot, itemId] of Object.entries(equipment)) {
    entity.equipment[slot] = itemId || null;
  }
  if (typeof Avian?.equipment?.applyEquipmentStatsToEntity === 'function') {
    Avian.equipment.applyEquipmentStatsToEntity(entity);
  }
  if (typeof Avian?.equipmentActions?.syncEntityAbilities === 'function') {
    Avian.equipmentActions.syncEntityAbilities(entity);
  }
  if (typeof sandbox.enforceAbilityCosts === 'function') sandbox.enforceAbilityCosts(entity);
  return entity;
}

function applyCombatantOverrides(sandbox, entity, opts = {}) {
  if (!entity) return;
  const stats = entity.stats || (entity.stats = {});

  if (opts.hp != null) {
    stats.hp = Number(opts.hp);
    if (opts.maxHp == null && stats.maxHp != null && stats.hp > stats.maxHp) {
      stats.maxHp = stats.hp;
    }
  }
  if (opts.maxHp != null) {
    stats.maxHp = Number(opts.maxHp);
    if (opts.hp == null) stats.hp = stats.maxHp;
  }
  if (opts.armour != null) stats.armour = Number(opts.armour);
  if (opts.maxArmour != null) {
    stats.maxArmour = Number(opts.maxArmour);
    if (stats.normalMaxArmour == null) stats.normalMaxArmour = Number(opts.maxArmour);
  }
  if (opts.normalMaxArmour != null) stats.normalMaxArmour = Number(opts.normalMaxArmour);
  if (opts.magicArmour != null) stats.magicArmour = Number(opts.magicArmour);
  if (opts.maxMagicArmour != null) {
    stats.maxMagicArmour = Number(opts.maxMagicArmour);
    if (stats.normalMaxMagicArmour == null) stats.normalMaxMagicArmour = Number(opts.maxMagicArmour);
  }
  if (opts.normalMaxMagicArmour != null) stats.normalMaxMagicArmour = Number(opts.normalMaxMagicArmour);

  for (const stat of ['atk', 'def', 'matk', 'mdef', 'spd', 'dodge', 'acc', 'critChance']) {
    if (opts[stat] != null) stats[stat] = Number(opts[stat]);
  }

  if (opts.energy != null) entity.energy = Number(opts.energy);
  if (opts.energyMax != null) entity.energyMax = Number(opts.energyMax);
  if (opts.energyRegen != null) entity.energyRegen = Number(opts.energyRegen);
  if (opts.class) entity.class = opts.class;
  if (opts.bird) entity.birdKey = opts.bird;
  if (opts.birdKey) entity.birdKey = opts.birdKey;

  if (opts.equipment) applyEquipment(sandbox, entity, opts.equipment);

  if (opts.statuses) {
    entity._status = entity._status || {};
    Object.assign(entity._status, opts.statuses);
  }
}

/**
 * Create a clean combat state on sandbox.G from a scenario setup block.
 */
export function createCleanCombatState(sandbox, setup = {}) {
  const Avian = sandboxAvian(sandbox);
  if (Avian?.flags) Avian.flags.equipmentV2 = true;

  const playerOpts = Object.assign({ bird: 'sparrow' }, setup.player || {});
  const enemyOpts = Object.assign({ bird: 'crow', isEnemy: true }, setup.enemy || {});

  const playerBird = playerOpts.bird || playerOpts.birdKey || 'sparrow';
  const enemyBird = enemyOpts.bird || enemyOpts.birdKey || 'crow';

  const player = createTestBird(sandbox, playerBird, playerOpts);
  const enemy = createTestBird(sandbox, enemyBird, enemyOpts);
  enemy.isEnemy = true;

  /* Ensure starting weapon when requested / default rogue path */
  if (playerOpts.equipment?.mainHand || !player.equipment?.mainHand) {
    const classId = player.class || 'rogue';
    const defaultWpn = STARTING_WEAPONS[classId] || 'WPN-B04';
    if (!player.equipment) player.equipment = {};
    if (!player.equipment.mainHand) {
      applyEquipment(sandbox, player, { mainHand: playerOpts.equipment?.mainHand || defaultWpn });
    }
  }

  applyCombatantOverrides(sandbox, player, playerOpts);
  applyCombatantOverrides(sandbox, enemy, enemyOpts);

  const g = sandbox.G;
  if (!g) throw new Error('sandbox.G missing — load full game bundle');

  g.player = player;
  g.enemy = enemy;
  g.playerStatus = Object.assign({}, playerOpts.statuses || player._status || {});
  g.enemyStatus = Object.assign({}, enemyOpts.statuses || enemy._status || {});
  g.battleOver = false;
  g.turn = 'player';
  g.turnPhase = sandbox.TURN?.PLAYER ?? 'player';
  g.phase = 'PLAYER';
  g.playerActionsThisTurn = 0;
  g.enemyActionsThisTurn = 0;
  g.utilityUsedThisTurn = {};
  g.actionUsedThisTurn = {};
  g.abilityCooldowns = {};
  g.playerUltimateMeter = 0;
  g.enemyUltimateMeter = 0;
  g._playerEnergyTurnIndex = setup.playerEnergyTurnIndex != null
    ? Number(setup.playerEnergyTurnIndex)
    : 1; /* past first-turn start energy unless scenario opts into turn 0 */
  g._enemyEnergyTurnIndex = 1;
  g._playerTurnSerial = 1;
  g.playerTurnFlags = { energyGainedThisTurn: 0, onHitTriggered: false, firstAttackResolved: false };

  if (setup.abilityCooldowns) {
    Object.assign(g.abilityCooldowns, setup.abilityCooldowns);
  }

  /* Re-sync abilities after final equipment overrides */
  if (typeof Avian?.equipmentActions?.syncEntityAbilities === 'function') {
    Avian.equipmentActions.syncEntityAbilities(player);
    Avian.equipmentActions.syncEntityAbilities(enemy);
  }
  if (typeof sandbox.enforceAbilityCosts === 'function') {
    sandbox.enforceAbilityCosts(player);
    sandbox.enforceAbilityCosts(enemy);
  }

  /* Re-apply energy after sync (sync may not touch energy, but overrides might) */
  if (playerOpts.energy != null) player.energy = Number(playerOpts.energy);
  if (enemyOpts.energy != null) enemy.energy = Number(enemyOpts.energy);

  return { player, enemy, G: g };
}

export function findAbilityBySource(entity, sourceKey) {
  const abs = entity?.abilities || [];
  return abs.find((ab) => ab && !ab.empty && (ab.actionSource || '') === sourceKey) || null;
}

export function findAbilityById(entity, id) {
  const abs = entity?.abilities || [];
  return abs.find((ab) => ab && ab.id === id) || null;
}

export function getBasicAttack(entity) {
  return findAbilityBySource(entity, 'basic')
    || (entity?.abilities || []).find((ab) => ab && ab.isMainAttack)
    || null;
}
