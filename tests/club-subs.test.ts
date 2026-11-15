import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {clubSlots,lineupSlots,formationSlots} from '../lib/club-lineup.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const started=(tier=1)=>reduceCommand(stateOf(),{type:'club.live.start',id:'sub-live',tier} as never);
const benchOf=(state:ReturnType<typeof started>)=>state.club!.players.filter(player=>!state.club!.lineup.includes(player.id));
const outfieldBench=(state:ReturnType<typeof started>)=>benchOf(state).filter(player=>player.position!=='GK');

test('formation slots cover eleven players with one keeper and valid coordinates',()=>{
 for(const formation of ['4-3-3','4-4-2','4-2-3-1'] as const){
  const slots=formationSlots(formation);
  assert.equal(slots.length,11);
  assert.equal(slots.filter(slot=>slot.role==='GK').length,1);
  for(const slot of slots){assert(slot.x>=0&&slot.x<=105&&slot.y>=0&&slot.y<=68)}
 }
 const state=stateOf(),slots=clubSlots(state.club!);
 assert.equal(slots.length,11);
 assert.equal(new Set(slots.map(slot=>slot.id)).size,11);
 assert.equal(slots[0].role,'GK');
});

test('a live substitution swaps the lineup, re-ratings the team and records the event',()=>{
 const state=started(),outId=state.club!.lineup.find(id=>state.club!.players.find(player=>player.id===id)!.position!=='GK')!,incoming=outfieldBench(state)[0];
 const before=state.club!.live!.session.home.lines;
 const subbed=reduceCommand(state,{type:'club.live.sub',id:'sub-1',outId,inId:incoming.id} as never);
 assert.equal(subbed.club!.lineup.includes(incoming.id),true);
 assert.equal(subbed.club!.lineup.includes(outId),false);
 assert.equal(subbed.club!.live!.session.subs,1);
 const event=subbed.club!.live!.session.events.at(-1)!;
 assert.equal(event.kind,'sub');assert.equal(event.scorer,incoming.name);assert.equal(event.out,state.club!.players.find(player=>player.id===outId)!.name);
 assert(subbed.club!.live!.session.home.lines.DEF!==before.DEF||subbed.club!.live!.session.home.lines.MID!==before.MID||subbed.club!.live!.session.home.lines.ATT!==before.ATT);
});

test('five substitutions are allowed and the sixth is refused',()=>{
 let state=started();
 for(let index=0;index<5;index+=1){
  const outId=state.club!.lineup.filter(id=>state.club!.players.find(player=>player.id===id)!.position!=='GK')[0],incoming=outfieldBench(state)[0];
  state=reduceCommand(state,{type:'club.live.sub',id:`sub-${index}`,outId,inId:incoming.id} as never);
 }
 assert.equal(state.club!.live!.session.subs,5);
 const outId=state.club!.lineup.filter(id=>state.club!.players.find(player=>player.id===id)!.position!=='GK')[0],incoming=outfieldBench(state)[0];
 assert.throws(()=>reduceCommand(state,{type:'club.live.sub',id:'sub-6',outId,inId:incoming.id} as never),/Five substitutions/);
});

test('substitutions refuse bad input and finished matches',()=>{
 const state=started(),bench=benchOf(state),starter=state.club!.lineup[3];
 assert.throws(()=>reduceCommand(state,{type:'club.live.sub',id:'a',outId:'nope',inId:bench[0].id} as never),/starting eleven/);
 assert.throws(()=>reduceCommand(state,{type:'club.live.sub',id:'b',outId:starter,inId:starter} as never),/already on the pitch/);
 assert.throws(()=>reduceCommand(state,{type:'club.live.sub',id:'c',outId:starter,inId:'nope'} as never),/from your squad/);
 let live=state;
 for(let block=0;block<18;block+=1)live=reduceCommand(live,{type:'club.live.advance',id:`adv-${block}`} as never);
 assert.throws(()=>reduceCommand(live,{type:'club.live.sub',id:'late',outId:starter,inId:bench[0].id} as never),/live match|finished/);
});

test('a finished live match stores its lineups and substitution count',()=>{
 let state=started(),bench=outfieldBench(state);
 state=reduceCommand(state,{type:'club.live.sub',id:'s1',outId:state.club!.lineup.filter(id=>state.club!.players.find(player=>player.id===id)!.position!=='GK')[4],inId:bench[0].id} as never);
 for(let block=0;block<18;block+=1)state=reduceCommand(state,{type:'club.live.advance',id:`a${block}`} as never);
 const record=state.club!.matches![0];
 assert.equal(record.subs,1);
 assert(record.lineups&&record.lineups.home.length===11&&record.lineups.away.length===11);
 assert(record.events!.some(event=>event.kind==='sub'&&event.scorer===bench[0].name));
});

test('lineup slots assign defenders to defensive slots and forwards to attack slots',()=>{
 const state=stateOf(),slots=clubSlots(state.club!);
 for(const slot of slots){
  const player=state.club!.players.find(entry=>entry.id===slot.id)!;
  if(slot.role==='GK')assert.equal(player.position,'GK');
  if(slot.role==='DEF')assert(['CB','LB','RB','DM'].includes(player.position));
  if(slot.role==='ATT')assert(['ST','LW','RW','AM','CM'].includes(player.position));
 }
 assert.equal(lineupSlots('4-3-3',state.club!.players.slice(0,11)).length,11);
});
