import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {clubDisplay,ownedDisplayRights,canSelectDisplay} from '../lib/club-display.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const withPurchase=(state:ReturnType<typeof stateOf>,itemId:string)=>{const next=structuredClone(state);next.economy.purchases.push({id:`purchase-${itemId}`,itemId,cost:180,at:new Date().toISOString(),funding:[]});return next};

test('display rights come from existing purchases and unlocks',()=>{
 const state=stateOf();
 assert.deepEqual(ownedDisplayRights(state.economy,state.settings).frames,[]);
 const bought=withPurchase(state,'frame.emerald');
 assert.deepEqual(ownedDisplayRights(bought.economy,bought.settings).frames,['frame.emerald']);
 const unlocked={...bought,settings:{...bought.settings,unlocked:['academyKit','celebration']}};
 assert.deepEqual(ownedDisplayRights(unlocked.economy,unlocked.settings).kits,['academyKit','celebration']);
});

test('the display command only accepts owned items and never charges',()=>{
 const state=withPurchase(stateOf(),'frame.emerald'),before=state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 const applied=reduceCommand(state,{type:'club.display',id:'d1',frame:'frame.emerald'} as never);
 assert.equal(applied.club!.display!.frame,'frame.emerald');
 assert.equal(applied.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),before);
 assert.equal(applied.economy.purchases.length,state.economy.purchases.length);
 assert.throws(()=>reduceCommand(state,{type:'club.display',id:'d2',frame:'frame.obsidian'} as never),/not owned/);
 assert.throws(()=>reduceCommand(state,{type:'club.display',id:'d3',frame:'frame.missing'} as never),/known display/);
});

test('display selections persist and can be cleared',()=>{
 const state=withPurchase(stateOf(),'backdrop.sunset');
 const chosen=reduceCommand(state,{type:'club.display',id:'d1',backdrop:'backdrop.sunset'} as never);
 assert.equal(chosen.club!.display!.backdrop,'backdrop.sunset');
 const cleared=reduceCommand(chosen,{type:'club.display',id:'d2',backdrop:'none'} as never);
 assert.equal(cleared.club!.display!.backdrop,undefined);
 assert.equal(canSelectDisplay(cleared,'backdrop','backdrop.sunset').ok,true);
});

test('the options list marks ownership and selection for the club card',()=>{
 const state=withPurchase(stateOf(),'backdrop.tactics');
 const view=clubDisplay(state);
 assert.equal(view.options.length>0,true);
 const tactics=view.options.find(option=>option.id==='backdrop.tactics')!;
 assert.equal(tactics.owned,true);
 assert.equal(tactics.selected,false);
 const selected=clubDisplay(reduceCommand(state,{type:'club.display',id:'d1',backdrop:'backdrop.tactics'} as never));
 assert.equal(selected.options.find(option=>option.id==='backdrop.tactics')!.selected,true);
 assert.equal(selected.rights.frames.length,0);
});
