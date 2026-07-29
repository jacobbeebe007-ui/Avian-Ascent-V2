/**
 * Assertion helpers for combat scenario tests.
 * Failures include scenario id and Expected/Received diffs.
 */

export class AssertionError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = 'AssertionError';
    this.scenarioId = meta.scenarioId || null;
    this.expected = meta.expected;
    this.received = meta.received;
  }
}

function fmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'object' && v !== null) {
    try { return JSON.stringify(v); } catch (_) { return String(v); }
  }
  return String(v);
}

function prefix(scenarioId, message) {
  return scenarioId ? `[${scenarioId}] ${message}` : message;
}

function diffBlock(expected, received) {
  if (expected != null && typeof expected === 'object' && !Array.isArray(expected)
    && received != null && typeof received === 'object' && !Array.isArray(received)) {
    const lines = ['', 'Expected:'];
    for (const k of Object.keys(expected)) lines.push(`  ${k}: ${fmt(expected[k])}`);
    lines.push('', 'Received:');
    for (const k of Object.keys(expected)) {
      lines.push(`  ${k}: ${fmt(received[k])}`);
    }
    for (const k of Object.keys(received)) {
      if (!Object.prototype.hasOwnProperty.call(expected, k)) {
        lines.push(`  ${k}: ${fmt(received[k])}`);
      }
    }
    return lines.join('\n');
  }
  return `\nExpected: ${fmt(expected)}\nReceived: ${fmt(received)}`;
}

export function expectValue(actual, expected, message = 'value', scenarioId = null) {
  if (actual !== expected) {
    throw new AssertionError(
      prefix(scenarioId, message) + diffBlock(expected, actual),
      { scenarioId, expected, received: actual },
    );
  }
}

export function expectNear(actual, expected, tolerance = 0.05, message = 'near', scenarioId = null) {
  const a = Number(actual);
  const e = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(e) || Math.abs(a - e) > tolerance) {
    throw new AssertionError(
      prefix(scenarioId, message) + diffBlock(expected, actual) + `\nTolerance: ±${tolerance}`,
      { scenarioId, expected, received: actual },
    );
  }
}

export function expectRange(actual, min, max, message = 'range', scenarioId = null) {
  const a = Number(actual);
  if (!Number.isFinite(a) || a < min || a > max) {
    throw new AssertionError(
      prefix(scenarioId, message) + `\nExpected: ${min}..${max}\nReceived: ${fmt(actual)}`,
      { scenarioId, expected: { min, max }, received: actual },
    );
  }
}

export function expectStatus(combatant, statusKey, expected, scenarioId = null) {
  const statusBag = combatant?.status || combatant?._status || combatant;
  const bag = statusBag?.[statusKey] != null
    ? statusBag
    : (combatant?.playerStatus || combatant?.enemyStatus || statusBag);
  const cur = bag?.[statusKey];
  if (expected === true) {
    if (!cur) {
      throw new AssertionError(
        prefix(scenarioId, `expected status "${statusKey}" to be present`) +
        diffBlock({ [statusKey]: true }, { [statusKey]: cur || false }),
        { scenarioId, expected: true, received: cur },
      );
    }
    return;
  }
  if (expected === false || expected == null) {
    expectNoStatus(combatant, statusKey, scenarioId);
    return;
  }
  if (typeof expected === 'object') {
    for (const k of Object.keys(expected)) {
      const got = cur && typeof cur === 'object' ? cur[k] : cur;
      if (got !== expected[k]) {
        throw new AssertionError(
          prefix(scenarioId, `status "${statusKey}.${k}"`) +
          diffBlock({ [k]: expected[k] }, { [k]: got }),
          { scenarioId, expected: expected[k], received: got },
        );
      }
    }
    return;
  }
  expectValue(cur, expected, `status "${statusKey}"`, scenarioId);
}

export function expectNoStatus(combatant, statusKey, scenarioId = null) {
  const bags = [
    combatant?.status,
    combatant?._status,
    combatant?.playerStatus,
    combatant?.enemyStatus,
    combatant,
  ].filter(Boolean);
  for (const bag of bags) {
    const cur = bag[statusKey];
    if (cur && !(typeof cur === 'object' && (cur.turns === 0 || cur.stacks === 0))) {
      throw new AssertionError(
        prefix(scenarioId, `expected no status "${statusKey}"`) +
        diffBlock({ [statusKey]: false }, { [statusKey]: cur }),
        { scenarioId, expected: false, received: cur },
      );
    }
  }
}

export function expectCooldown(combatantOrG, skillId, turns, scenarioId = null) {
  let cd = 0;
  if (combatantOrG?.abilityCooldowns) {
    cd = Number(combatantOrG.abilityCooldowns[skillId]) || 0;
  } else if (combatantOrG?.G?.abilityCooldowns) {
    cd = Number(combatantOrG.G.abilityCooldowns[skillId]) || 0;
  } else if (typeof combatantOrG === 'object' && skillId in (combatantOrG || {})) {
    cd = Number(combatantOrG[skillId]) || 0;
  }
  expectValue(cd, turns, `cooldown ${skillId}`, scenarioId);
}

export function expectEnergy(combatant, amount, scenarioId = null) {
  expectValue(Number(combatant?.energy) || 0, amount, 'energy', scenarioId);
}

export function expectDamage(result, amount, scenarioId = null) {
  const dmg = result && typeof result === 'object'
    ? (result.dmgDealt ?? result.damage ?? result.amount ?? 0)
    : Number(result) || 0;
  expectValue(dmg, amount, 'damage', scenarioId);
}

export function expectEventCount(log, eventType, count, scenarioId = null) {
  const events = Array.isArray(log) ? log : (log?.events || []);
  const n = events.filter((e) => {
    if (typeof e === 'string') return e === eventType;
    return e?.type === eventType || e?.kind === eventType || e?.event === eventType;
  }).length;
  expectValue(n, count, `event count "${eventType}"`, scenarioId);
}

export function expectActionRejected(result, reason = null, scenarioId = null) {
  const rejected = !!(result && (result.rejected || result.actionRejected || result.ok === false));
  if (!rejected) {
    throw new AssertionError(
      prefix(scenarioId, 'expected action to be rejected') +
      diffBlock({ actionRejected: true, reason }, result || { actionRejected: false }),
      { scenarioId, expected: true, received: false },
    );
  }
  if (reason != null && result.reason != null && result.reason !== reason) {
    throw new AssertionError(
      prefix(scenarioId, 'rejection reason') + diffBlock(reason, result.reason),
      { scenarioId, expected: reason, received: result.reason },
    );
  }
}

/**
 * Apply a flat expect object against a captured combat state snapshot.
 */
export function applyExpectMap(snapshot, expectMap, scenarioId) {
  if (!expectMap) return;
  const aliases = {
    playerEnergy: () => snapshot.player.energy,
    playerHp: () => snapshot.player.hp,
    playerArmour: () => snapshot.player.armour,
    playerMaxArmour: () => snapshot.player.maxArmour,
    playerMagicArmour: () => snapshot.player.magicArmour,
    playerMaxMagicArmour: () => snapshot.player.maxMagicArmour,
    enemyHp: () => snapshot.enemy.hp,
    enemyArmour: () => snapshot.enemy.armour,
    enemyMagicArmour: () => snapshot.enemy.magicArmour,
    enemyWasHit: () => snapshot.meta.enemyWasHit,
    actionRejected: () => snapshot.meta.actionRejected,
    hasFortify: () => !!snapshot.playerStatus?.fortify,
    hasWard: () => !!snapshot.playerStatus?.ward,
    battleOver: () => snapshot.meta.battleOver,
    winner: () => snapshot.meta.winner,
  };

  for (const [key, expected] of Object.entries(expectMap)) {
    if (key === 'immediate' || key === 'endOfTurn' || key === 'followingTurns') continue;
    if (typeof aliases[key] === 'function') {
      const actual = aliases[key]();
      if (typeof expected === 'boolean' && key.startsWith('has')) {
        expectValue(!!actual, expected, key, scenarioId);
      } else {
        expectValue(actual, expected, key, scenarioId);
      }
      continue;
    }
    if (key === 'enemyHpChange') {
      const change = snapshot.meta.enemyHpBefore - snapshot.enemy.hp;
      expectValue(change, expected, 'enemyHpChange', scenarioId);
      continue;
    }
    if (key === 'playerHpChange') {
      const change = snapshot.meta.playerHpBefore - snapshot.player.hp;
      expectValue(change, expected, 'playerHpChange', scenarioId);
      continue;
    }
  }
}
