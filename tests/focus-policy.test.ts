import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {reconcileEconomy,creditBalance,assertEconomy} from '../lib/economy.ts';
import {planFocus,focusAssignments,FOCUS_BUCKET_SECONDS} from '../lib/focus-policy.ts';
import {totalXP} from '../lib/model.ts';

const stateOf=()=>structuredClone(initialState());
const run=(state:ReturnType<typeof stateOf>,cmd:Record<string,unknown>,at:string|Date)=>reduceCommand(state,cmd as never,new Date(at));
function finishFocus(state:ReturnType<typeof stateOf>,startAt:string,minutes:number,area='Projects'){const started=run(state,{type:'focus.start',id:'f-'+Math.random().toString(16).slice(2),minutes,area},startAt);const id=started.activeSession!.id;return run(started,{type:'focus.finish',id},new Date(Date.parse(startAt)+minutes*60000))}

test('buckets pay 5 XP and 10 funds per 20 minutes with a carried remainder',()=>{
 assert.deepEqual(planFocus(3000),{chunks:2,carrySeconds:600,xp:10,funds:20});
 assert.deepEqual(planFocus(1500),{chunks:1,carrySeconds:300,xp:5,funds:10});
 assert.deepEqual(planFocus(1500,300),{chunks:1,carrySeconds:600,xp:5,funds:10});
 assert.deepEqual(planFocus(1200),{chunks:1,carrySeconds:0,xp:5,funds:10});
 assert.deepEqual(planFocus(600),{chunks:0,carrySeconds:600,xp:0,funds:0});
 assert.equal(FOCUS_BUCKET_SECONDS,1200);
});

test('a 50 minute session earns two buckets and two XP rewards',()=>{
 const finished=finishFocus(stateOf(),'2026-11-15T08:00:00Z',50);
 const session=finished.sessions[0];
 const rewards=finished.rewards.filter(reward=>reward.id===`session:${session.id}`||reward.id.startsWith(`session:${session.id}:chunk:`));
 assert.equal(rewards.length,2);
 assert.equal(rewards.reduce((sum,reward)=>sum+reward.points,0),10);
 assert(finished.economy.focus,'the bucket rule starts with this session');
 assert.equal(finished.economy.focus!.carrySeconds,600);
 const balance=creditBalance(finished.economy);
 assert.equal(balance,20);
 assert.equal(totalXP(finished)>=10,true);
});

test('two 25 minute sessions keep the 10 minute remainder and do not double count',()=>{
 let state=finishFocus(stateOf(),'2026-11-15T09:00:00Z',25,'Projects');
 const firstBalance=creditBalance(state.economy);
 assert.equal(firstBalance,10);
 state=finishFocus(state,'2026-11-15T10:00:00Z',25,'Projects');
 assert.equal(state.economy.focus!.carrySeconds,600);
 const xp=state.rewards.reduce((sum,reward)=>sum+reward.points,0);
 assert.equal(xp,10);
 assert.equal(creditBalance(state.economy),20);
 assert.equal(state.rewards.filter(reward=>reward.id.startsWith('session:')).length,2);
});

test('a short session carries its time into the next one',()=>{
 let state=finishFocus(stateOf(),'2026-11-15T11:00:00Z',10,'Projects');
 assert.equal(state.rewards.filter(reward=>reward.id.startsWith('session:')).length,0);
 assert.equal(creditBalance(state.economy),0);
 assert.equal(state.economy.focus!.carrySeconds,600);
 state=finishFocus(state,'2026-11-15T12:00:00Z',30,'Projects');
 assert.equal(state.rewards.filter(reward=>reward.id.startsWith('session:')).length,2);
 assert.equal(creditBalance(state.economy),20);
 assert.equal(state.economy.focus!.carrySeconds,0);
});

test('the rule is forward-only: sessions before the cutoff keep the old flat reward',()=>{
 const state=stateOf();
 state.sessions.push({id:'legacy-1',area:'Projects',startedAt:'2026-11-01T08:00:00Z',endedAt:'2026-11-01T08:25:00Z',seconds:1500,kind:'focus'});
 state.rewards.push({id:'session:legacy-1',kind:'bonus',label:'Focus session',points:5,active:true,at:'2026-11-01T08:25:00Z',source:'focus'} as never);
 const reconciled=reconcileEconomy(state,new Date('2026-11-15T10:00:00Z'));
 assert.equal(creditBalance(reconciled.economy),10,'legacy session still pays the old 10');
 const after=finishFocus(reconciled,'2026-11-15T10:00:00Z',25,'Projects');
 assert(after.economy.focus!.from.length>0,'cutoff recorded');
 assert.equal(creditBalance(after.economy),20,'legacy 10 + new bucket 10');
 assert.equal(after.economy.focus!.carrySeconds,300);
 assert.equal(assertEconomy(after.economy),undefined);
});

test('assignments replay deterministically and expose per-session scope',()=>{
 const sessions=[
  {id:'a',area:'P',startedAt:'2026-11-15T08:00:00Z',endedAt:'2026-11-15T08:25:00Z',seconds:1500,kind:'focus' as const,workScope:'task:x'},
  {id:'b',area:'P',startedAt:'2026-11-15T09:00:00Z',endedAt:'2026-11-15T09:25:00Z',seconds:1500,kind:'focus' as const,workScope:'task:x'},
 ];
 const from='2026-11-15T07:00:00Z';
 const first=focusAssignments(sessions,from),again=focusAssignments(sessions,from);
 assert.deepEqual(first,again);
 assert.equal(first.assignments.length,2);
 assert.equal(first.assignments[0].chunks,1);
 assert.equal(first.assignments[1].carryBefore,300);
 assert.equal(first.carrySeconds,600);
 assert.equal(first.assignments.every(entry=>entry.scope==='task:x'),true);
});
