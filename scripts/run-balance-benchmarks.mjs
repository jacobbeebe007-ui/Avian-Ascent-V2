#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSandbox } from './combat-scenarios/harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--')).map(x => { const [k,v='true']=x.slice(2).split('='); return [k,v]; }));
const runs = Math.max(1, Number(args.runs || 1000));
const seed = Number(args.seed || 12345);
const outDir = path.resolve(ROOT, args.output || 'artifacts/balance');
const sandbox = createSandbox({ quiet:true });
const Avian = sandbox.Avian;
const cfg = Avian?.data?.balanceBenchmarks;
if (!cfg || typeof Avian?.debug?.simulateDuel !== 'function') throw new Error('benchmark definitions or simulation runtime missing; run npm run bundle');

const targetBird = { balanced:'crow', highArmour:'crow', highMagicArmour:'blackbird', highDodge:'sparrow', highHp:'goose', lowDefence:'chickadee' };
const nominalCosts = { basic:1, utility:2, weaponA:2, weaponB:3, armour:2, ultimate:0 };
const rows = [];
const technicalFailures = [];
const warnings = [];

function round(n, places=3) { const p=10**places; return Math.round((Number(n)||0)*p)/p; }
function aggregate(label, cls, bird, tier, opponent, rarity, defender, count=runs, kind='target', fixture=null) {
  const total = {
    wins:0, turns:0, damage:0, health:0, armourDmg:0, magicDmg:0,
    taken:0, healthLost:0, armourAbs:0, magicAbs:0,
    attacks:0, hits:0, precisionMisses:0, dodges:0, misses:0, crits:0, critRolls:0,
    healing:0, armourRestored:0, magicArmourRestored:0, fortify:0, ward:0, wasted:0,
    enemyActions:0, en:0, source:{}, ailments:{attempts:0,successes:0,stacks:0,turnsActive:0,evolutions:0,damage:0,controlTurns:0},
    passiveTriggers:0,
  };
  for (let i=0;i<count;i++) {
    const r = Avian.debug.simulateDuel({ attackerBirdKey:bird, defenderBirdKey:defender, attackerRarity:rarity, defenderRarity:rarity, attackerEquipment:fixture?.equipment, defenderStats:fixture?.target, seed:seed + rows.length*100003 + i, maxTurns:cfg.maxTurns });
    if (!r || !Number.isFinite(r.damageDealt) || !Number.isFinite(r.turns)) technicalFailures.push(`${label}: non-finite result at run ${i}`);
    if (r?.turns > cfg.maxTurns || r?.turns < 1) technicalFailures.push(`${label}: invalid termination at run ${i}`);
    if (r?.winner === 'attacker') total.wins++;
    total.turns += r?.turns||0;
    total.damage += r?.damageDealt||0;
    total.health += r?.healthDamageDealt||0;
    total.armourDmg += r?.armourDamageDealt||0;
    total.magicDmg += r?.magicArmourDamageDealt||0;
    total.taken += r?.damageTaken||0;
    total.healthLost += r?.healthLost||0;
    total.armourAbs += r?.armourAbsorbed||0;
    total.magicAbs += r?.magicArmourAbsorbed||0;
    total.attacks += r?.attacksAttempted||0;
    total.hits += r?.hits||0;
    total.precisionMisses += r?.precisionMisses||0;
    total.dodges += r?.dodges||0;
    total.misses += r?.misses||0;
    total.crits += r?.crits||0;
    total.critRolls += r?.critRolls||0;
    total.healing += r?.healing||0;
    total.armourRestored += r?.armourRestored||0;
    total.magicArmourRestored += r?.magicArmourRestored||0;
    total.fortify += r?.fortifyGenerated||0;
    total.ward += r?.wardGenerated||0;
    total.wasted += r?.protectionWasted||0;
    total.enemyActions += r?.enemyActions||0;
    total.passiveTriggers += r?.passiveTriggers||0;
    if (r?.ailments) {
      total.ailments.attempts += r.ailments.attempts||0;
      total.ailments.successes += r.ailments.successes||0;
      total.ailments.stacks += r.ailments.stacks||0;
    }
    for (const [source,n] of Object.entries(r?.actionsUsed||{})) {
      total.source[source]=(total.source[source]||0)+n;
      total.en+=n*(nominalCosts[source] ?? 2);
    }
  }
  const attempts=total.attacks;
  const hitRate=attempts ? total.hits/attempts : 0;
  const actionCount=Object.values(total.source).reduce((a,n)=>a+(n||0),0);
  const row = {
    kind,class:cls,bird,tier,opponent,runs:count,winRate:round(total.wins/count),averageTurns:round(total.turns/count),actionsToVictory:round(actionCount/count),
    totalDamageDealt:round(total.damage/count),healthDamageDealt:round(total.health/count),armourDamageDealt:round(total.armourDmg/count),magicArmourDamageDealt:round(total.magicDmg/count),
    damagePerTurn:round(total.damage/Math.max(1,total.turns)),damagePerEN:round(total.damage/Math.max(1,total.en)),rawDamagePerEN:round(total.damage/Math.max(1,total.en)),healthDamagePerEN:round(total.health/Math.max(1,total.en)),protectionDamagePerEN:round((total.armourDmg+total.magicDmg)/Math.max(1,total.en)),
    damageTaken:round(total.taken/count),healthLost:round(total.healthLost/count),armourAbsorbed:round(total.armourAbs/count),magicArmourAbsorbed:round(total.magicAbs/count),effectiveSurvivability:round((total.damage+total.taken)/count),
    enSpent:round(total.en/count),enWasted:0,averageENPerTurn:round(total.en/Math.max(1,total.turns)),actionsPerTurn:round(actionCount/Math.max(1,total.turns)),unaffordableTurns:0,
    attacksAttempted:attempts,hits:total.hits,precisionMisses:total.precisionMisses,dodges:total.dodges,misses:total.misses,hitRate:round(hitRate),dodgeRate:round(attempts?total.dodges/attempts:0),criticalRate:round(total.critRolls?total.crits/total.critRolls:0),
    healing:round(total.healing/count),armourRestored:round(total.armourRestored/count),magicArmourRestored:round(total.magicArmourRestored/count),fortifyGenerated:round(total.fortify/count),wardGenerated:round(total.ward/count),protectionWasted:round(total.wasted/count),
    ailments:total.ailments,skillUsage:total.source,
    passive:{triggers:total.passiveTriggers,value:0,triggerFightRate:0,disabledWinRateDelta:null},classPerk:{disabledWinRateDelta:null},firstActorWinRate:round(total.wins/count),
    telemetryCoverage:'Native duel telemetry: pool damage, crits, restores, Fortify/Ward, ailments when emitted; passive/perk A-B deltas remain null.'
  };
  rows.push(row);
  if (kind === 'target' && (row.averageTurns<cfg.thresholds.turnsMin || row.averageTurns>cfg.thresholds.turnsMax)) warnings.push(`${label} average turns ${row.averageTurns}`);
  if (attempts && (row.hitRate<cfg.thresholds.hitRateMin || row.hitRate>cfg.thresholds.hitRateMax)) warnings.push(`${label} hit rate ${(row.hitRate*100).toFixed(1)}%`);
  return row;
}

console.log(`Running balance matrix (${runs} runs/matchup, seed ${seed})…`);
for (const [cls,entry] of Object.entries(cfg.roster)) for (const [tier,build] of Object.entries(entry.tiers)) {
  for (const target of ['balanced','highArmour','highMagicArmour','highDodge','highHp']) aggregate(`${cls}/${tier}/${target}`,cls,entry.birdId,tier,target,build.rarity,targetBird[target],runs,'target',{equipment:build.equipment,target:cfg.targets[tier][target]});
  aggregate(`${cls}/${tier}/mirror`,cls,entry.birdId,tier,`${cls} mirror`,build.rarity,entry.birdId,runs,'mirror',{equipment:build.equipment});
}
const contrasts = [['knight','rogue'],['knight','mage'],['rogue','knight'],['rogue','mage'],['mage','knight'],['mage','siren'],['brute','knight']];
for (const [a,b] of contrasts) aggregate(`${a}/late/${b}`,a,cfg.roster[a].birdId,'late',b,'gold',cfg.roster[b].birdId,runs,'class');
for (const [name,boss] of Object.entries(cfg.boss.tiers)) aggregate(`boss/${name}`,'boss',cfg.roster.knight.birdId,name,'duke reference',boss.rarity,cfg.boss.birdId,runs,'boss');
for (const band of cfg.endlessBands) aggregate(`endless/${band}`,'endless',cfg.roster.rogue.birdId,`band-${band}`,'scaled knight','grey','crow',Math.max(1,Math.ceil(runs/10)),'endless');

const baselinePath=path.join(ROOT,'scripts/data/balance-baseline.json');
let drift=[];
if (existsSync(baselinePath)) {
  const old=JSON.parse(readFileSync(baselinePath,'utf8'));
  for (const row of rows) { const prior=old.rows?.find(x=>x.class===row.class&&x.tier===row.tier&&x.opponent===row.opponent); if (prior) drift.push({class:row.class,tier:row.tier,opponent:row.opponent,damagePerEN:{previous:prior.damagePerEN,current:row.damagePerEN,changePercent:round(prior.damagePerEN?(row.damagePerEN-prior.damagePerEN)/prior.damagePerEN*100:0,1)}}); }
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),config:{runs,seed,benchmarkVersion:cfg.version},roster:Object.fromEntries(Object.entries(cfg.roster).map(([k,v])=>[k,{birdId:v.birdId,reason:v.reason,tiers:v.tiers}])),targets:cfg.targets,boss:cfg.boss,endlessBands:cfg.endlessBands,rows,warnings:[...new Set(warnings)],technicalFailures:[...new Set(technicalFailures)],balanceDrift:drift};
mkdirSync(outDir,{recursive:true});
writeFileSync(path.join(outDir,'benchmark-latest.json'),JSON.stringify(report,null,2)+'\n');
const columns=['kind','class','bird','tier','opponent','runs','winRate','averageTurns','damagePerTurn','damagePerEN','hitRate','dodgeRate','criticalRate','damageTaken','armourAbsorbed','magicArmourAbsorbed','armourDamageDealt','magicArmourDamageDealt','healing'];
const csv=[columns.join(','),...rows.map(r=>columns.map(c=>JSON.stringify(r[c]??'')).join(','))].join('\n')+'\n';
writeFileSync(path.join(outDir,'benchmark-latest.csv'),csv);
console.log('\nAVIAN ASCENT BALANCE BENCHMARK'); console.log(`Seed ${seed} | ${runs} runs per principal matchup | ${rows.length} summaries`);
for (const cls of Object.keys(cfg.roster)) { const r=rows.find(x=>x.class===cls&&x.tier==='starter'&&x.opponent==='balanced'); console.log(`${cls.padEnd(11)} win ${(r.winRate*100).toFixed(1).padStart(5)}% | turns ${r.averageTurns.toFixed(2).padStart(5)} | damage/EN ${r.damagePerEN.toFixed(2)}`); }
console.log(`\nOUTLIERS (${report.warnings.length})`); report.warnings.slice(0,20).forEach(x=>console.log(`⚠ ${x}`));
console.log(`\nReports: ${path.relative(ROOT,outDir)}/benchmark-latest.{json,csv}`);
if (technicalFailures.length) { console.error(technicalFailures.join('\n')); process.exitCode=1; }
