#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = {
  globalThis: {},
  Avian: { data: { combatPack: {} } },
  console,
};
sandbox.globalThis = sandbox;
sandbox.globalThis.FAMILY_EVOLUTION_BIRD_DATA = Object.create(null);
vm.createContext(sandbox);

for (const f of [
  'js/data/birds.js',
  'js/data/combat-pack/families.js',
  'js/data/combat-pack/skill-trees.js',
  'js/data/combat-pack/birds-kits.js',
  'js/systems/combat-pack-boot.js',
]) {
  vm.runInContext(readFileSync(f, 'utf8'), sandbox);
}

const data = sandbox.globalThis.FAMILY_EVOLUTION_BIRD_DATA?.secretary;
if (!data) {
  console.error('FAIL: no FAMILY_EVOLUTION_BIRD_DATA.secretary');
  console.error('birds with catalog:', Object.keys(sandbox.globalThis.FAMILY_EVOLUTION_BIRD_DATA || {}).filter((k) => k.includes('sec') || k === 'secretary'));
  process.exit(1);
}
const bases = Object.values(data.families || {}).map((f) => f.baseAbilityId);
console.log('OK secretary:', bases.join(', '));
