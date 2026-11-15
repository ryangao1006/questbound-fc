import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA_VERSION,initialState,migrateState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {clubFunds,clubRatings,type ClubState} from '../lib/club-state.ts';

const create=()=>{const state=structuredClone(initialState());return reduceCommand(state,{type:'club.create',id:'op-create',name:'Northbridge FC',shortName:'nbr',city:'Northbridge',colours:{primary:'#1f4e79',secondary:'#c8f56e'},kits:{home:'#1f4e79',away:'#e8edf4'},formation:'4-3-3'} as never)};
const grant=(state:ReturnType<typeof initialState>,amount=500)=>{state.economy.sources.push({id:'match:test',kind:'match',amount,eligible:amount,spent:0,at:new Date().toISOString()});return state};

test('creating a club writes one optional document field and leaves the schema alone',()=>{
 const state=create();
 assert.equal(SCHEMA_VERSION,8);
 assert.equal(state.schemaVersion,8);
 assert(state.club);
 assert.equal(state.club!.name,'Northbridge FC');
 assert.equal(state.club!.shortName,'NBR');
 assert.equal(state.club!.players.length,20);
 assert.equal(state.club!.lineup.length,11);
 assert.equal(state.club!.tactics.active,'balanced');
 assert.equal(state.club!.facilities.trainingCentre,1);
 const roundTrip=migrateState(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(roundTrip.club,state.club);
});

test('a second club cannot be created and the draft is validated',()=>{
 assert.throws(()=>reduceCommand(create(),{type:'club.create',id:'op-again',name:'Another',shortName:'ANO'} as never),/already exists/);
 assert.throws(()=>reduceCommand(initialState(),{type:'club.create',id:'x',name:'A',shortName:'AB'} as never),/name/);
 assert.throws(()=>reduceCommand(initialState(),{type:'club.create',id:'x',name:'Alpha',shortName:'A'} as never),/short name/);
 assert.throws(()=>reduceCommand(initialState(),{type:'club.create',id:'x',name:'Alpha',shortName:'AB',colours:{primary:'red'}} as never),/colours/);
});

test('training costs funds, raises one attribute by one and records a receipt',()=>{
 const state=grant(create(),500);
 const club=state.club!,player=club.players.find(entry=>entry.position==='CM')!;
 const before=player.attributes.pas,funds=clubFunds(state.economy);
 const next=reduceCommand(state,{type:'club.train',id:'op-train',playerId:player.id,attribute:'pas'} as never);
 const trained=next.club!.players.find(entry=>entry.id===player.id)!;
 assert.equal(trained.attributes.pas,Math.min(before+1,99));
 assert.equal(clubFunds(next.economy),funds-20);
 assert.equal(next.club!.receipts.length,1);
 assert.equal(next.club!.receipts[0].kind,'training');
 assert.equal(next.club!.receipts[0].cost,20);
});

test('training refuses without funds and never leaves a receipt or a changed attribute',()=>{
 const created=create();const state={...created,economy:{...created.economy,sources:created.economy.sources.map(source=>source.id==='grant:club-initial'?{...source,amount:0,eligible:0}:source)}};const club=state.club!,player=club.players.find(entry=>entry.position==='CB')!;
 assert.throws(()=>reduceCommand(state,{type:'club.train',id:'op-poor',playerId:player.id,attribute:'def'} as never),/Not enough club funds/);
 assert.equal(state.club!.receipts.length,0);
 assert.equal(state.club!.players.find(entry=>entry.id===player.id)!.attributes.def,player.attributes.def);
});

test('the training centre cap blocks upgrades it cannot support',()=>{
 const state=grant(create(),5000);
 const club=state.club!,player=club.players.find(entry=>entry.position==='LW')!;
 const boosted:ClubState={...club,players:club.players.map(entry=>entry.id===player.id?{...entry,attributes:{...entry.attributes,sho:95}}:entry)};
 const withBoost={...state,club:boosted};
 assert.throws(()=>reduceCommand(withBoost,{type:'club.train',id:'op-cap',playerId:player.id,attribute:'sho'} as never),/caps this attribute/);
});

test('lineup rules: eleven unique players and exactly one keeper',()=>{
 const state=create(),club=state.club!;
 const ids=club.lineup;
 assert.equal(ids.length,11);
 assert.throws(()=>reduceCommand(state,{type:'club.lineup',id:'op-10',formation:'4-4-2',starters:ids.slice(0,10)} as never),/eleven/);
 assert.throws(()=>reduceCommand(state,{type:'club.lineup',id:'op-dup',formation:'4-4-2',starters:[...ids.slice(0,10),ids[0]]} as never),/twice/);
 const outfield=club.players.filter(player=>player.position!=='GK').map(player=>player.id);
 assert.throws(()=>reduceCommand(state,{type:'club.lineup',id:'op-nogk',formation:'4-4-2',starters:outfield.slice(0,11)} as never),/goalkeeper/);
 const swapped=reduceCommand(state,{type:'club.lineup',id:'op-ok',formation:'4-4-2',starters:ids} as never);
 assert.equal(swapped.club!.formation,'4-4-2');
 assert(swapped.club!.lineup.includes(club.players.find(player=>player.position==='GK')!.id));
});

test('club ratings stay on the PLAN scale and follow the lineup',()=>{
 const state=create(),ratings=clubRatings(state.club!);
 for(const value of Object.values(ratings))assert(value>=1&&value<=99);
 assert(ratings.overall>0);
 const expected=Math.round((ratings.DEF*.3+ratings.MID*.3+ratings.ATT*.3+ratings.GK*.1)*10)/10;
 assert.equal(ratings.overall,expected);
});

test('the first club carries the one-off 150 grant exactly once',()=>{
 const state=create();
 const grant=state.economy.sources.find(source=>source.id==='grant:club-initial');
 assert(grant);
 assert.equal(grant!.kind,'grant');
 assert.equal(grant!.eligible,150);
 assert.equal(clubFunds(state.economy)>=150,true);
 const after=reduceCommand(state,{type:'club.lineup',id:'op-lineup',formation:'4-3-3',starters:state.club!.lineup} as never);
 assert.equal(after.economy.sources.filter(source=>source.id==='grant:club-initial').length,1);
 assert.equal(after.economy.sources.find(source=>source.id==='grant:club-initial')!.eligible,150);
});

test('a legacy club can claim the migration grant exactly once',()=>{
 const created=create();
 const legacy={...created,economy:{...created.economy,sources:created.economy.sources.filter(source=>source.id!=='grant:club-initial')}};
 assert.equal(legacy.economy.sources.some(source=>source.id==='grant:club-initial'),false);
 assert.throws(()=>reduceCommand(legacy,{type:'club.migrate',id:'m1'} as never),/Confirm/);
 const migrated=reduceCommand(legacy,{type:'club.migrate',id:'m2',confirm:true} as never);
 const grant=migrated.economy.sources.find(source=>source.id==='grant:club-initial');
 assert(grant);assert.equal(grant!.eligible,150);
 assert(migrated.club!.migratedAt);
 const again=reduceCommand(migrated,{type:'club.migrate',id:'m3',confirm:true} as never);
 assert.equal(again.economy.sources.filter(source=>source.id==='grant:club-initial').length,1);
});
