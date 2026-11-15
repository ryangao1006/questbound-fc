import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {FOOTBALL_PLAYERS} from '../lib/football-data.ts';
import {clubFunds,clubRatings} from '../lib/club-state.ts';
import {scoutCap,signingPrice,worldPlayerOvr} from '../lib/club-transfers.ts';
import {scoutingNeeds,scoutingPlan,weakestLine} from '../lib/club-scouting.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const planOf=(state=stateOf())=>scoutingPlan(state.club!,FOOTBALL_PLAYERS,clubFunds(state.economy),{limit:5});

test('needs rank the weakest line first and use the club ratings',()=>{
 const state=stateOf(),ratings=clubRatings(state.club!),needs=scoutingNeeds(state.club!);
 assert.equal(needs.length,3);
 const weakest=needs[0];
 const min=Math.min(ratings.DEF,ratings.MID,ratings.ATT);
 assert.equal(weakest.rating,min);
 assert.equal(weakestLine(state.club!),weakest.line);
 for(const need of needs){assert.equal(need.rating,ratings[need.line]);assert(need.gap>=0)}
});

test('recommendations respect the scout cap, the limit and determinism',()=>{
 const state=stateOf(),plan=planOf(state),cap=scoutCap(state.club!.facilities.scoutCentre);
 assert.equal(plan.recommendations.length,5);
 for(const recommendation of plan.recommendations){
  assert(recommendation.ovr<=cap);
  assert.equal(recommendation.price,signingPrice(recommendation.ovr));
  assert(['weakest-line','upgrade','depth','affordable'].includes(recommendation.reason));
 }
 const again=planOf(state);
 assert.deepEqual(again.recommendations,plan.recommendations);
 assert.equal(plan.scoutCap,cap);
 assert.equal(plan.budget,clubFunds(state.economy));
});

test('players already at the club or occupied elsewhere are never recommended',()=>{
 const state=stateOf(),owned=state.club!.players.map(player=>player.id),plan=planOf(state);
 for(const recommendation of plan.recommendations)assert.equal(owned.includes(recommendation.id),false);
 const occupied=new Set(FOOTBALL_PLAYERS.slice(0,50).map(player=>player.id));
 const filtered=scoutingPlan(state.club!,FOOTBALL_PLAYERS,clubFunds(state.economy),{occupied});
 for(const recommendation of filtered.recommendations)assert.equal(occupied.has(recommendation.id),false);
});

test('the weakest line is preferred in the ranking when affordable options exist',()=>{
 const state=stateOf(),plan=planOf(state),weak=plan.weakest;
 const sameLine=plan.recommendations.filter(recommendation=>recommendation.line===weak);
 assert(sameLine.length>=1,'at least one recommendation targets the weakest line');
 const anyTier=plan.recommendations.map(recommendation=>recommendation.reason);
 assert(anyTier.includes('weakest-line')||anyTier.includes('upgrade'));
});

test('the plan is a report: it never mutates the club and its note reflects the budget',()=>{
 const state=stateOf(),snapshot=JSON.stringify(state.club),plan=planOf(state);
 assert.equal(JSON.stringify(state.club),snapshot);
 assert(plan.note.length>0);
 if(plan.recommendations.length){assert(plan.note.includes(clubFunds(state.economy).toLocaleString())||plan.note.includes('fits'))}
});

test('an unlimited budget finds a legal signing target the club can afford',()=>{
 const rich=stateOf();
 rich.economy.sources.push({id:'match:rich',kind:'match',amount:20000,eligible:20000,spent:0,at:new Date().toISOString()});
 const plan=scoutingPlan(rich.club!,FOOTBALL_PLAYERS,clubFunds(rich.economy),{limit:3});
 const affordable=plan.recommendations.find(recommendation=>recommendation.price<=clubFunds(rich.economy));
 assert(affordable,'at least one affordable recommendation');
 const player=FOOTBALL_PLAYERS.find(entry=>entry.id===affordable!.id)!;
 assert.equal(worldPlayerOvr(player),affordable!.ovr);
});
