import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {playerDetail,detailSummary,canTrainDetail,nextTrainingAttribute,ATTRIBUTE_ORDER,attributePriceTable} from '../lib/club-player-detail.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};

test('a player detail carries six attributes, a spider and the centre cap',()=>{
 const state=stateOf(),player=state.club!.players.find(entry=>entry.id===state.club!.lineup[3])!;
 const detail=playerDetail(state.club!,player.id);
 assert.equal(detail.attributes.length,6);
 assert.deepEqual(detail.attributes.map(entry=>entry.key),ATTRIBUTE_ORDER);
 assert.equal(detail.spider.split(' ').length,6);
 assert.equal(detail.spiderPoints.length,6);
 assert.equal(detail.cap,69);
 assert(detail.capProgress>=0&&detail.capProgress<=100);
 assert.equal(detail.starter,true);
 assert(detail.lineRating>0);
 for(const point of detail.spiderPoints){assert(Math.hypot(point.x-60,point.y-60)<=44.01)}
});

test('next training prices come from the real quote rules',()=>{
 const state=stateOf(),player=state.club!.players[0];
 const detail=playerDetail(state.club!,player.id);
 const table=attributePriceTable(player,state.club!.facilities.trainingCentre);
 assert.equal(detail.attributes.length,table.length);
 for(const attribute of detail.attributes){
  assert.equal(attribute.cap,69);
  if(!attribute.blocked)assert([20,40,60,100,160].includes(attribute.price as number));
 }
 const cheapest=Math.min(...detail.attributes.map(attribute=>attribute.price??Infinity));
 assert.equal(detail.nextPrice,cheapest===Infinity?null:cheapest);
 assert.equal(detailSummary(detail).ovr,player.ovr);
});

test('training eligibility reports blocked attributes and the cheapest next step',()=>{
 const state=stateOf(),player=state.club!.players[0];
 const capped={...player,attributes:{...player.attributes,pac:69}};
 const club={...state.club!,players:state.club!.players.map(entry=>entry.id===player.id?capped:entry)};
 const detail=playerDetail(club,player.id);
 assert.equal(canTrainDetail(club,detail,'pac').ok,false);
 assert.match(canTrainDetail(club,detail,'pac').reason??'',/caps/);
 assert.equal(canTrainDetail(club,detail,'sho').ok,true);
 const next=nextTrainingAttribute(detail);
 assert(next!==null);
 assert.equal(detail.attributes.find(entry=>entry.key===next)!.blocked,null);
});

test('unknown players are refused and the derivation is pure',()=>{
 const state=stateOf(),snapshot=JSON.stringify(state.club);
 assert.throws(()=>playerDetail(state.club!,'nope'),/Choose a player/);
 const detail=playerDetail(state.club!,state.club!.players[0].id);
 detailSummary(detail);canTrainDetail(state.club!,detail,'pas');nextTrainingAttribute(detail);
 assert.equal(JSON.stringify(state.club),snapshot);
});
