import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const started=(()=>{let cached:ReturnType<typeof stateOf>|null=null;return()=>{if(!cached)cached=reduceCommand(stateOf(),{type:'club.live.start',id:'live-f',tier:0} as never);return cached}})();

test('changing formation mid-match keeps the eleven legal and updates the slots',()=>{
 const state=started(),live=state.club!.live!;
 const before=live.session.home.slots!.map(slot=>`${slot.role}:${slot.x},${slot.y}`);
 const changed=reduceCommand(state,{type:'club.live.formation',id:'f1',formation:'4-4-2'} as never);
 assert.equal(changed.club!.formation,'4-4-2');
 assert.equal(changed.club!.live!.session.home.formation,'4-4-2');
 assert.equal(changed.club!.lineup.length,11);
 assert.equal(new Set(changed.club!.lineup).size,11);
 assert.equal(changed.club!.lineup.filter(id=>changed.club!.players.find(player=>player.id===id)?.position==='GK').length,1);
 const after=changed.club!.live!.session.home.slots!.map(slot=>`${slot.role}:${slot.x},${slot.y}`);
 assert.notDeepEqual(after,before,'the formation shapes the pitch positions');
 assert.equal(changed.club!.live!.session.home.tactic,live.session.home.tactic);
});

test('formation changes are refused for unknown shapes, finished matches or no live match',()=>{
 const state=started();
 assert.throws(()=>reduceCommand(state,{type:'club.live.formation',id:'f2',formation:'3-4-3'} as never),/supported formation/);
 assert.throws(()=>reduceCommand(stateOf(),{type:'club.live.formation',id:'f3',formation:'4-4-2'} as never),/live match/);
 let live=state;
 for(let block=0;block<18;block+=1)live=reduceCommand(live,{type:'club.live.advance',id:`adv-${block}`} as never);
 assert.throws(()=>reduceCommand(live,{type:'club.live.formation',id:'f4',formation:'4-4-2'} as never),/live match/);
});

test('a formation change keeps the current score and continues play deterministically',()=>{
 const state=started();
 const advanced=reduceCommand(reduceCommand(state,{type:'club.live.advance',id:'a1'} as never),{type:'club.live.advance',id:'a2'} as never);
 const beforeScore=advanced.club!.live!.session.score,eventsBefore=advanced.club!.live!.session.events.length;
 const changed=reduceCommand(advanced,{type:'club.live.formation',id:'f5',formation:'4-2-3-1'} as never);
 assert.deepEqual(changed.club!.live!.session.score,beforeScore);
 assert.equal(changed.club!.live!.session.events.length,eventsBefore);
 let played=changed;
 for(let block=changed.club!.live!.session.block;block<18;block+=1)played=reduceCommand(played,{type:'club.live.advance',id:`tail-${block}`} as never);
 assert(played.club!.matches!.length===1);
 assert(played.club!.matches![0].timeline!.length>0);
});
