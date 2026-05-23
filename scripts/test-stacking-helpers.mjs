/** Smoke tests for refresh / source-keyed stat loan helpers (mirrors game.js). */
function refreshStatus(obj, key, turns, cap = 99) {
  obj[key] = Math.min(cap, Math.max(obj[key] || 0, Math.max(1, Math.floor(Number(turns) || 1))));
}
function applySourceStatLoan(ps, player, bagName, statKey, sourceId, value, turns = 1) {
  if (!ps || !player || !player.stats || !statKey) return 0;
  if (!ps[bagName]) ps[bagName] = Object.create(null);
  const bag = ps[bagName];
  const slotKey = statKey + ':' + String(sourceId || 'unknown');
  const prev = bag[slotKey];
  if (prev && prev.amt) {
    player.stats[statKey] = Math.max(0, Math.round(((player.stats[statKey] || 0) - (prev.amt || 0)) * 100) / 100);
  }
  const amt = Math.max(prev ? (prev.amt || 0) : 0, Number(value) || 0);
  if (amt > 0) {
    player.stats[statKey] = Math.round(((player.stats[statKey] || 0) + amt) * 100) / 100;
    bag[slotKey] = { statKey, amt, turns: Math.max(1, Math.floor(Number(turns) || 1)), sourceId: String(sourceId || '') };
  } else if (bag[slotKey]) delete bag[slotKey];
  return amt;
}

/** Mirrors getAbilityAuthoredEnergyCost / getAbilityAttackWeight from game.js (pure subset). */
function getAbilityAuthoredEnergyCost(ab, template, opts = {}) {
  const p = opts.player || {};
  let cost = 0;
  if (Array.isArray(template?.energyByLevel) && template.energyByLevel.length) {
    const idx = Math.min((ab.level || 1) - 1, template.energyByLevel.length - 1);
    cost = Number(template.energyByLevel[idx]) ?? 0;
  } else if (typeof template?.energyCost === 'number') {
    cost = template.energyCost;
  } else if (typeof ab.energyCost === 'number') {
    cost = ab.energyCost;
  }
  const isMainAttack = opts.isMainAttack || false;
  const isSpell = template?.type === 'spell' || template?.btnType === 'spell';
  if (isMainAttack && !isSpell && !(ab.fixedMainAttackCost || template?.fixedMainAttackCost)) cost = 1;
  if (opts.usesFamilyEvolution && !isMainAttack && Array.isArray(template?.energyByLevel) && template.energyByLevel.length) {
    const arr = template.energyByLevel.map(x => Math.max(0, Math.floor(Number(x) || 0)));
    const progressive = arr.some((v, i) => i > 0 && v !== arr[0]);
    if (progressive) {
      const idx = Math.min(Math.max((ab.level || 1) - 1, 0), arr.length - 1);
      cost = arr[idx];
    } else {
      cost = arr[0];
    }
  }
  return Math.max(0, cost);
}

function getAbilityAttackWeight(ab, template, opts = {}) {
  const cost = getAbilityAuthoredEnergyCost(ab, template, opts);
  if (cost === 1) return 'light';
  if (cost === 2) return 'medium';
  if (cost === 3) return 'heavy';
  return null;
}

function applyRuntimeEnergyModifiers(authoredCost, ab, template, ctx = {}) {
  let cost = authoredCost;
  const tType = (template?.btnType || template?.type || ab.btnType || ab.type || '').toLowerCase();
  const isAttack = tType === 'physical' || tType === 'ranged';
  const isSpell = tType === 'spell';
  const isMultiHit = Array.isArray(template?.role) && template.role.includes('multiHit');
  const isMainAttack = ctx.isMainAttack || false;
  if (isAttack && !ctx.firstAttackUsed && ctx.firstAttackFree) cost = 0;
  if (isSpell && !ctx.firstSpellUsed && ctx.firstSpellFree) cost = 0;
  if (isSpell && !ctx.firstSpellUsed && (ctx.augFirstSpellCostDown || 0) > 0) cost = Math.max(0, cost - ctx.augFirstSpellCostDown);
  if (isSpell && ctx.mutArcOverload) cost += 1;
  if (cost === 1 && isMultiHit && !isMainAttack) cost += 1;
  if (ctx.frozenTurns > 0 && ab?.id !== 'skipTurn') cost += 1;
  return Math.max(0, cost);
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('OK:', msg);
}

const st = {};
refreshStatus(st, 'defending', 1);
refreshStatus(st, 'defending', 1);
assert(st.defending === 1, 'defending refresh stays at 1 turn, not 2');

const ps = {};
const player = { stats: { atk: 10 } };
applySourceStatLoan(ps, player, '_dispatcherStatLoans', 'atk', 'skillA:atk', 5, 1);
applySourceStatLoan(ps, player, '_dispatcherStatLoans', 'atk', 'skillA:atk', 5, 1);
assert(player.stats.atk === 15, 'same-source reapply refreshes atk loan (10+5), not stacks to 20');

applySourceStatLoan(ps, player, '_dispatcherStatLoans', 'atk', 'skillB:atk', 3, 1);
assert(player.stats.atk === 18, 'different-source atk loans combine (15+3)');

// Attack weight tests
const mainAttackTpl = { energyCost: 2, type: 'physical' };
assert(
  getAbilityAttackWeight({ id: 'mainAttack', level: 1 }, mainAttackTpl, { isMainAttack: true }) === 'light',
  'mainAttack forced to light (1 EN authored)'
);

const deathDiveTpl = { energyCost: 3, type: 'physical', role: ['finisher'] };
assert(
  getAbilityAttackWeight({ id: 'deathDive', level: 1 }, deathDiveTpl) === 'heavy',
  'deathDive 3 EN → heavy'
);

const swoopTpl = { energyCost: 2, type: 'physical', role: ['burst'] };
assert(
  getAbilityAttackWeight({ id: 'swoop', level: 1 }, swoopTpl) === 'medium',
  'swoop 2 EN → medium'
);

const counterTpl = { energyCost: 1, type: 'utility', role: ['reactive'] };
assert(
  getAbilityAttackWeight({ id: 'counter', level: 1 }, counterTpl) === 'light',
  'counter 1 EN utility → light authored (no dealDamage bonus in practice)'
);

const flurryTpl = { energyCost: 2, type: 'physical', role: ['multiHit'] };
assert(
  getAbilityAuthoredEnergyCost({ id: 'flurry', level: 1 }, flurryTpl) === 2,
  'multi-hit flurry authored cost stays 2 EN (not +1 surcharge)'
);
assert(
  getAbilityAttackWeight({ id: 'flurry', level: 1 }, flurryTpl) === 'medium',
  'multi-hit flurry → medium (authored 2 EN, not spend 3 EN)'
);

const authoredFlurry = getAbilityAuthoredEnergyCost({ id: 'flurry', level: 1 }, flurryTpl);
const runtimeFlurry = applyRuntimeEnergyModifiers(authoredFlurry, { id: 'flurry' }, flurryTpl, { frozenTurns: 1 });
assert(runtimeFlurry === 3, 'getAbilityEnergyCost adds frozen +1 on top of authored base');

const oneEnMultiTpl = { energyCost: 1, type: 'physical', role: ['multiHit'] };
const authoredOneEnMulti = getAbilityAuthoredEnergyCost({ id: 'thornBarrage', level: 1 }, oneEnMultiTpl);
const runtimeOneEnMulti = applyRuntimeEnergyModifiers(authoredOneEnMulti, { id: 'thornBarrage' }, oneEnMultiTpl);
assert(authoredOneEnMulti === 1, '1 EN multi-hit authored stays 1');
assert(runtimeOneEnMulti === 2, '1 EN multi-hit runtime spend adds +1');
assert(
  getAbilityAttackWeight({ id: 'thornBarrage', level: 1 }, oneEnMultiTpl) === 'light',
  '1 EN multi-hit attack weight stays light (authored)'
);

const spellTpl = { energyCost: 1, type: 'spell' };
assert(
  getAbilityAttackWeight({ id: 'spark', level: 1 }, spellTpl) === 'light',
  '1 EN spell → light attack weight'
);

const progressiveTpl = { energyByLevel: [1, 2, 2, 3], type: 'physical' };
assert(
  getAbilityAttackWeight({ id: 'curvedTalons', level: 4 }, progressiveTpl, { usesFamilyEvolution: true }) === 'heavy',
  'progressive energyByLevel L4 → heavy (3 EN)'
);

if (failed) { process.exit(1); }
console.log('All stacking helper tests passed.');
