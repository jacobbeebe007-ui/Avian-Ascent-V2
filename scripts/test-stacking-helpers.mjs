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

if (failed) { process.exit(1); }
console.log('All stacking helper tests passed.');
