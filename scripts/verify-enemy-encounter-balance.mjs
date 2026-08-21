import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { Math, Number, Object, globalThis: null };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(path.join(root, 'js/systems/enemy-encounter-balance.js'), 'utf8'), sandbox);

const balance = sandbox.Avian.balance.enemyEncounters;
let failures = 0;
function check(label, condition, detail = '') {
  if (!condition) {
    failures++;
    console.error('[FAIL]', label, detail);
  } else console.log('[ok]  ', label, detail);
}

check('first Endless map starts two levels below player', balance.endlessMapLevelOffset(0) === -2);
check('each early Endless map adds one enemy level', balance.endlessMapLevelOffset(1) === -1 && balance.endlessMapLevelOffset(2) === 0);
check('Endless map level advantage is capped', balance.endlessMapLevelOffset(99) === 3);
check('legacy Endless remains player-relative', balance.endlessMapLevelOffset() === 0);

const normal = balance.encounterMultipliers({ isEndless: true, segmentIndex: 0 });
const elite = balance.encounterMultipliers({ isEndless: true, isElite: true, segmentIndex: 0 });
const boss = balance.encounterMultipliers({ isEndless: true, isBoss: true, segmentIndex: 0 });
check('first-map normal enemies are softened', normal.hp < 1 && normal.offence < 1);
check('mini-bosses are tougher but remain below final bosses', elite.hp > normal.hp && elite.hp < boss.hp);
check('final bosses emphasize health over burst damage', boss.hp > boss.offence);

const story10 = balance.encounterMultipliers({ isStory: true, isBoss: true, stage: 10 });
const story20 = balance.encounterMultipliers({ isStory: true, isBoss: true, stage: 20 });
check('early Story boss receives a meaningful health reduction', story10.hp <= 0.80);
check('final Story boss remains tougher than the early boss', story20.hp > story10.hp && story20.offence > story10.offence);

const scaled = balance.applyMultipliers({ hp: 300, maxHp: 300, atk: 50, matk: 40, def: 30, mdef: 20, _progressHpMult: 2 }, story10);
check('multipliers affect all core combat stats', scaled.maxHp === 234 && scaled.atk === 45 && scaled.def === 28,
  JSON.stringify(scaled));
check('HP-derived mutation scaling follows encounter health', scaled._progressHpMult === 1.56);

if (failures) process.exit(1);
console.log('\nOK enemy encounter balance');
