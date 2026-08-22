import assert from 'node:assert/strict';
import { createSandbox } from './combat-scenarios/harness.mjs';
const sandbox=createSandbox({quiet:true});
const cfg=sandbox.Avian?.data?.balanceBenchmarks;
assert.ok(cfg,'balance benchmark data loads');
assert.deepEqual(Object.keys(cfg.roster),['knight','rogue','mage','siren','inquisitor','bard','brute']);
const items=sandbox.Avian.data.equipment.items;
for (const [cls,entry] of Object.entries(cfg.roster)) {
  assert.ok(sandbox.Avian.data.birdsV2[entry.birdId],`${cls} benchmark bird exists`);
  for (const tier of ['starter','mid','late']) for (const id of Object.values(entry.tiers[tier].equipment).filter(Boolean)) assert.ok(items[id],`${cls}/${tier} item ${id} exists`);
}
for (const tier of ['starter','mid','late']) for (const target of ['balanced','highArmour','highMagicArmour','highHp','highDodge','lowDefence']) {
  const t=cfg.targets[tier][target]; assert.ok(Number.isFinite(t.hp)&&t.hp>0); assert.ok(t.armour>=0&&t.magicArmour>=0&&t.dodge>=0);
}
const opts={attackerBirdKey:'sparrow',defenderBirdKey:'crow',attackerRarity:'grey',defenderRarity:'grey',seed:cfg.baseSeed,maxTurns:cfg.maxTurns};
assert.deepEqual(sandbox.Avian.debug.simulateDuel(opts),sandbox.Avian.debug.simulateDuel(opts),'seeded duel is reproducible');
console.log('balance benchmark fixtures: OK (7 classes × 3 tiers, deterministic duel, valid equipment/targets)');
