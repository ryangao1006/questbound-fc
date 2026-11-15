import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {createCup,playCupRound,cupOutcomeLabel} from '../lib/club-cup.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const clubOf=()=>stateOf().club!;

test('a cup is four teams with two semi-finals and a final',()=>{
 const cup=createCup(clubOf(),1,99,'cup-1');
 assert.equal(cup.teams.length,4);
 assert.equal(new Set(cup.teams.map(team=>team.id)).size,4);
 assert.equal(cup.matches.length,2);
 assert(cup.matches.every(match=>match.round===1));
 assert.equal(cup.teams[0].id,'club');
 assert(cup.teams.slice(1).every(team=>team.realClubId));
 assert.equal(cup.round,0);
});

test('playing the semis creates the final and finishing sets a winner',()=>{
 const state=stateOf(),cup=createCup(state.club!,0,7,'cup-2');
 const semis=playCupRound(state.club!,cup);
 assert.equal(semis.cup.round,1);
 assert.equal(semis.cup.matches.length,3);
 assert.equal(semis.cup.matches.filter(match=>match.round===1).every(match=>match.score),true);
 assert.equal(semis.cup.matches[2].round,2);
 const final=playCupRound(state.club!,semis.cup);
 assert.equal(final.cup.finished,true);
 assert(final.cup.winner);
 assert.equal(final.cup.matches.filter(match=>match.round===2).length,1);
 assert(['won','lost'].includes(cupOutcomeLabel(final.cup)!));
 assert.throws(()=>playCupRound(state.club!,final.cup),/finished/);
});

test('the cup is deterministic for the same seed and club',()=>{
 const state=stateOf(),a=createCup(state.club!,1,123,'cup-3'),b=createCup(state.club!,1,123,'cup-3');
 assert.deepEqual(a,b);
 assert.deepEqual(playCupRound(state.club!,a).cup,playCupRound(state.club!,b).cup);
});

test('the challenge cup persists through the commands without paying funds',()=>{
 const state=stateOf(),before=state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 const started=reduceCommand(state,{type:'club.cup.start',id:'cup-cmd',tier:2} as never);
 assert.equal(started.club!.cup!.tier,2);
 const semis=reduceCommand(started,{type:'club.cup.play',id:'cup-play-1'} as never);
 assert.equal(semis.club!.cup!.round,1);
 const final=reduceCommand(semis,{type:'club.cup.play',id:'cup-play-2'} as never);
 assert.equal(final.club!.cup!.finished,true);
 assert.equal(final.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),before);
});

test('winning the cup adds exactly one trophy and losing adds none',()=>{
 const state=stateOf();
 const started=reduceCommand(state,{type:'club.cup.start',id:'cup-t',tier:0} as never);
 let current=reduceCommand(started,{type:'club.cup.play',id:'cup-t-1'} as never);
 current=reduceCommand(current,{type:'club.cup.play',id:'cup-t-2'} as never);
 const cup=current.club!.cup!;
 const trophies=current.club!.trophies??[];
 if(cup.winner==='club')assert.equal(trophies.filter(trophy=>trophy.kind==='cup').length,1);
 else assert.equal(trophies.filter(trophy=>trophy.kind==='cup').length,0);
});

test('a drawn cup final records a penalty shootout and a winner',()=>{
 const state=stateOf();
 let found:ReturnType<typeof playCupRound>|null=null;
 for(let seed=1;seed<=40&&!found;seed+=1){
  const cup=createCup(state.club!,0,seed,'cup-pens-'+seed);
  const semis=playCupRound(state.club!,cup);
  const final=playCupRound(state.club!,semis.cup);
  if(final.cup.finished){const match=final.cup.matches.find(entry=>entry.round===2)!;if(match.pens)found=final}
 }
 assert(found,'a drawn final with penalties exists within 40 seeds');
 const match=found!.cup.matches.find(entry=>entry.round===2)!;
 assert(match.pens);assert.notEqual(match.pens![0],match.pens![1]);
 const winner=match.pens![0]>match.pens![1]?match.home:match.away;
 assert.equal(found!.cup.winner,winner);
 assert(found!.cup.matches.every(entry=>entry.pens===undefined||entry.round===2));
});

test('a cup round saves the club match as a score-only record',()=>{
 const state=stateOf();
 const started=reduceCommand(state,{type:'club.cup.start',id:'cup-rec',tier:0} as never);
 const played=reduceCommand(started,{type:'club.cup.play',id:'cup-rec-semis'} as never);
 const record=played.club!.matches![0];
 assert(record,'the cup match is saved');
 assert.equal(record.tier,0);
 assert.equal(record.score.length,2);
 assert(record.opponent.name.length>0);
});
