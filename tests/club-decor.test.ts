import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {decorOptions,decorChoice,canSelectDecor,resolveDecor,decorSummary} from '../lib/club-decor.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3',colours:{primary:'#2f6f4e',secondary:'#c8f56e'}} as never)};

test('defaults are unlocked and higher decorations stay locked at level one',()=>{
 const state=stateOf(),options=decorOptions(state.club!);
 const byId=new Map(options.map(option=>[option.id,option]));
 assert.equal(byId.get('pitch.stripes')!.unlocked,true);
 assert.equal(byId.get('stands.classic')!.unlocked,true);
 assert.equal(byId.get('lights.white')!.unlocked,true);
 assert.equal(byId.get('pitch.halftone')!.unlocked,false);
 assert.equal(byId.get('lights.cool')!.unlocked,false);
 assert.deepEqual(decorChoice(state.club!),{pitch:'pitch.stripes',stands:'stands.classic',lights:'lights.white'});
 assert.equal(options.filter(option=>option.selected).length,3);
});

test('facility levels and trophies unlock decorations',()=>{
 const base=stateOf();
 const advanced={...base,club:{...base.club!,facilities:{...base.club!.facilities,stadium:4,trainingCentre:2},trophies:[{id:'t1',kind:'cup' as const,tier:0,label:'Cup',at:'2026-11-01T00:00:00Z'},{id:'t2',kind:'cup' as const,tier:0,label:'Cup',at:'2026-11-02T00:00:00Z'},{id:'t3',kind:'cup' as const,tier:0,label:'Cup',at:'2026-11-03T00:00:00Z'}]}};
 const options=decorOptions(advanced.club!);
 for(const id of ['pitch.checker','pitch.diagonal','pitch.halftone','stands.home','stands.gold','lights.warm','lights.cool']){
  assert.equal(options.find(option=>option.id===id)!.unlocked,true,id);
 }
});

test('the decor command refuses locked options and accepts unlocked ones without charging',()=>{
 const state=stateOf(),before=state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 assert.throws(()=>reduceCommand(state,{type:'club.decor',id:'d1',pitch:'pitch.halftone'} as never),/not unlocked/);
 assert.throws(()=>reduceCommand(state,{type:'club.decor',id:'d2',pitch:'pitch.unknown'} as never),/known decoration/);
 const applied=reduceCommand(state,{type:'club.decor',id:'d3',pitch:'pitch.stripes',stands:'stands.home'} as never);
 assert.equal(applied.club!.decor!.stands,'stands.home');
 assert.equal(applied.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),before);
 assert.equal(canSelectDecor(applied.club!,'pitch','pitch.stripes').ok,true);
});

test('resolved decor uses club colours and the selection',()=>{
 const state=stateOf(),base=resolveDecor(state.club!);
 assert.deepEqual(base.colours.stands,['#5b6b80','#8fa0b5']);
 assert.equal(base.colours.lights,'#ffffff');
 const home=resolveDecor({...state.club!,decor:{stands:'stands.home',lights:'lights.warm'}});
 assert.deepEqual(home.colours.stands,['#2f6f4e','#c8f56e']);
 assert.equal(home.colours.lights,'#ffd7a1');
 assert.equal(decorSummary(state.club!).unlocked,4);
});
