import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {advanceLiveMatch} from '../lib/club-match.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const play=()=>{let state=stateOf();state=reduceCommand(state,{type:'club.live.start',id:'live-1',tier:1} as never);return state};

test('a live match advances one block at a time and only writes a result at full time',()=>{
 let state=play();
 assert(state.club!.live);
 assert.equal(state.club!.live!.session.block,0);
 state=reduceCommand(state,{type:'club.live.advance',id:'live-adv-1'} as never);
 assert.equal(state.club!.live!.session.block,1);
 assert.equal((state.club!.matches??[]).length,0);
 for(let block=1;block<18;block+=1)state=reduceCommand(state,{type:'club.live.advance',id:`live-adv-${block+1}`} as never);
 assert.equal(state.club!.live,undefined);
 assert.equal(state.club!.matches!.length,1);
 const record=state.club!.matches![0];
 assert(Number.isFinite(record.seed)&&record.seed>0);
 assert.equal(record.events!.filter(event=>event.kind==='goal'&&event.side==='home').length,record.score[0]);
 assert.equal(record.events!.filter(event=>event.kind==='goal'&&event.side==='away').length,record.score[1]);
});

test('changing the tactic is allowed only while the match is live',()=>{
 const started=play();
 const changed=reduceCommand(started,{type:'club.live.tactic',id:'live-tac-1',tactic:'press'} as never);
 assert.equal(changed.club!.live!.session.home.tactic,'press');
 assert.throws(()=>reduceCommand(started,{type:'club.live.tactic',id:'live-tac-2',tactic:'unknown'} as never),/known tactic/);
});

test('abandoning a live match leaves the record list untouched',()=>{
 const started=play();
 const abandoned=reduceCommand(started,{type:'club.live.abandon',id:'live-abandon'} as never);
 assert.equal(abandoned.club!.live,undefined);
 assert.equal((abandoned.club!.matches??[]).length,0);
});

test('a live match pays nothing and cannot double-write a result on replay',()=>{
 let state=play();
 const funds=state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 for(let block=0;block<18;block+=1)state=reduceCommand(state,{type:'club.live.advance',id:`adv-${block}`} as never);
 assert.equal(state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),funds);
 assert.equal(state.club!.matches!.length,1);
 assert.throws(()=>reduceCommand(state,{type:'club.live.advance',id:'adv-again'} as never),/Start a live match/);
 assert.equal(state.club!.matches!.length,1);
});
