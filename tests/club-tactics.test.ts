import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {CLUB_TACTICS,TACTIC_BONUS,TACTIC_MAX_LEVEL,clubRatings,effectiveAttributes,facilityGate,facilityUpgradeCost,tacticTrainingCost} from '../lib/club-state.ts';
import {lineOf} from '../lib/club-model.ts';

const fund=(state:ReturnType<typeof initialState>,amount=5000)=>{state.economy.sources.push({id:'match:qa',kind:'match',amount,eligible:amount,spent:0,at:new Date().toISOString()});return state};
const club=()=>{const state=fund(structuredClone(initialState()));return reduceCommand(state,{type:'club.create',id:'op-create',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};

test('five tactics exist with the PLAN training curve and a finite fifth level',()=>{
 assert.deepEqual([...CLUB_TACTICS],['balanced','possession','counter','wide','press']);
 assert.equal(tacticTrainingCost(0),100);assert.equal(tacticTrainingCost(1),200);assert.equal(tacticTrainingCost(2),350);
 assert.equal(tacticTrainingCost(3),550);assert.equal(tacticTrainingCost(4),800);assert.equal(tacticTrainingCost(TACTIC_MAX_LEVEL),null);
});

test('training a tactic costs funds, raises its level and keeps other levels',()=>{
 const state=club();
 const next=reduceCommand(state,{type:'club.tactic.train',id:'op-tt',tactic:'possession'} as never);
 assert.equal(next.club!.tactics.levels.possession,1);
 assert.equal(next.club!.tactics.levels.balanced,0);
 const source=next.economy.sources.find(entry=>entry.id==='match:qa')!;assert.equal(source.eligible-source.spent,4900);
 assert.equal(next.club!.receipts.at(-1)!.kind,'tactic');
 assert.equal(next.club!.receipts.at(-1)!.cost,100);
});

test('a fully trained tactic refuses further spending',()=>{
 let state=club();
 for(let level=0;level<5;level+=1)state=reduceCommand(state,{type:'club.tactic.train',id:'op-'+level,tactic:'counter'} as never);
 assert.equal(state.club!.tactics.levels.counter,5);
 assert.throws(()=>reduceCommand(state,{type:'club.tactic.train',id:'op-6',tactic:'counter'} as never),/fully trained/);
});

test('the active tactic changes effective attributes only on its lines and caps at 99',()=>{
 const state=club();
 const player=state.club!.players.find(entry=>entry.position==='CM')!;
 const balanced=effectiveAttributes(player,{active:'balanced',levels:{balanced:2,possession:0,counter:0,wide:0,press:0}});
 assert.equal(balanced.dri,player.attributes.dri+2);
 const attacker=state.club!.players.find(entry=>entry.position==='LW')!;
 const press=effectiveAttributes(attacker,{active:'press',levels:{balanced:0,possession:0,counter:0,wide:0,press:3}});
 assert.equal(press.def,attacker.attributes.def+3);
 const keeper=state.club!.players.find(entry=>entry.position==='GK')!;
 const keeperBoost=effectiveAttributes(keeper,{active:'press',levels:{balanced:0,possession:0,counter:0,wide:0,press:3}});
 assert.equal(keeperBoost.def,keeper.attributes.def);
 const maxed={...player,attributes:{...player.attributes,dri:98}};
 assert.equal(effectiveAttributes(maxed,{active:'balanced',levels:{balanced:5,possession:0,counter:0,wide:0,press:0}}).dri,99);
});

test('switching tactics is free and keeps training levels',()=>{
 const state=reduceCommand(club(),{type:'club.tactic.train',id:'op-t1',tactic:'wide'} as never);
 const switched=reduceCommand(state,{type:'club.tactic',id:'op-switch',tactic:'press'} as never);
 assert.equal(switched.club!.tactics.active,'press');
 assert.equal(switched.club!.tactics.levels.wide,1);
 assert.equal(switched.economy.clubSpend!.length,state.economy.clubSpend!.length);
});

test('the active tactic is included in the line ratings',()=>{
 const state=club(),before=clubRatings(state.club!);
 const trained=reduceCommand(reduceCommand(state,{type:'club.tactic.train',id:'a',tactic:'balanced'} as never),{type:'club.tactic',id:'b',tactic:'balanced'} as never);
 const after=clubRatings(trained.club!);
 assert(after.DEF>before.DEF||after.ATT>before.ATT||after.MID>before.MID);
});

test('facility prices, gates and maximum levels follow the PLAN table',()=>{
 assert.deepEqual(facilityUpgradeCost('trainingCentre',1),300);
 assert.deepEqual(facilityUpgradeCost('trainingCentre',5),null);
 assert.equal(facilityUpgradeCost('scoutCentre',1),400);
 assert.equal(facilityUpgradeCost('scoutCentre',4),null);
 assert.equal(facilityUpgradeCost('stadium',4),3600);
 assert.equal(facilityGate('trainingCentre',3),3);
 assert.equal(facilityGate('trainingCentre',5),10);
 assert.equal(facilityGate('scoutCentre',2),5);
 assert.equal(facilityGate('stadium',5),0);
});

test('a facility upgrade needs the club level and the funds',()=>{
 const state=club();
 const level2=reduceCommand(state,{type:'club.facility',id:'f2',facility:'trainingCentre'} as never);
 assert.equal(level2.club!.facilities.trainingCentre,2);
 assert.equal(level2.club!.receipts.at(-1)!.cost,300);
 // Training-centre L3 requires club level 3, so a level-1 club is refused before any charge.
 assert.throws(()=>reduceCommand(level2,{type:'club.facility',id:'f3',facility:'trainingCentre'} as never),/club level 3/);
 const poor=fund(structuredClone(initialState()),50);
 const poorClub=reduceCommand(poor,{type:'club.create',id:'op-poor',name:'Poor FC',shortName:'PFC'} as never);
 assert.throws(()=>reduceCommand(poorClub,{type:'club.facility',id:'f4',facility:'stadium'} as never),/Not enough club funds/);
});
