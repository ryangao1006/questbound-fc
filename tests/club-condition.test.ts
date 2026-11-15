import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {afterMatch,assistantOf,assistantSubstitution,autoSubstitution,conditionReport,ensureLegalLineup,fitnessOf,isAvailable,isInjured,pickLegalLineup,DEFAULT_ASSISTANT} from '../lib/club-condition.ts';
import type {ClubState} from '../lib/club-state.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const withPlayer=(state:ReturnType<typeof stateOf>,playerId:string,patch:Partial<{fitness:number;injuryMatches:number}>)=>{
 const next=structuredClone(state);
 next.club={...next.club!,players:next.club!.players.map(player=>player.id===playerId?{...player,...patch}:player)};
 return next;
};

test('a match drains the eleven and recovers the bench within bounds',()=>{
 const state=stateOf(),club=state.club!;
 const next=afterMatch(club,club.lineup,'seed-1');
 for(const id of club.lineup){
  const player=next.players.find(entry=>entry.id===id)!;
  assert(fitnessOf(player)<100||isInjured(player));
  assert(fitnessOf(player)>=0&&fitnessOf(player)<=100);
 }
 for(const player of next.players.filter(entry=>!club.lineup.includes(entry.id))){
  assert(fitnessOf(player)>=fitnessOf(club.players.find(entry=>entry.id===player.id)!));
 }
 const again=afterMatch(club,club.lineup,'seed-1');
 assert.deepEqual(again.players,next.players,'the same seed gives the same condition changes');
});

test('injuries are deterministic, flagged and reduced by a match of rest',()=>{
 let club=stateOf().club!;
 let injured=0;
 for(let index=0;index<40&&!injured;index+=1){
  const next=afterMatch(club,club.lineup,`injury-${index}`);
  injured=next.players.filter(isInjured).length;
  if(injured){const player=next.players.find(isInjured)!;assert((player.injuryMatches??0)>=1&&(player.injuryMatches??0)<=3);const rested=afterMatch(next,[],`rest-${index}`);const restedPlayer=rested.players.find(entry=>entry.id===player.id)!;assert.equal(restedPlayer.injuryMatches,(player.injuryMatches??0)-1)}
 }
 assert(injured>0,'an injury occurs within forty matches');
});

test('availability thresholds and reports',()=>{
 const state=stateOf(),starter=state.club!.lineup[3];
 const tired=withPlayer(state,starter,{fitness:20});
 const report=conditionReport(tired.club!);
 assert.equal(report.tired>=1,true);
 assert.equal(isAvailable(tired.club!.players.find(entry=>entry.id===starter)!),false);
 const injured=withPlayer(state,starter,{injuryMatches:2});
 assert.equal(isInjured(injured.club!.players.find(entry=>entry.id===starter)!),true);
 assert.equal(conditionReport(injured.club!).injured,1);
});

test('the legal line-up keeps eleven unique players and exactly one keeper',()=>{
 const state=stateOf(),injuredStarter=state.club!.lineup[3];
 const club=withPlayer(state,injuredStarter,{injuryMatches:2}).club!;
 const lineup=pickLegalLineup(club);
 assert.equal(lineup.length,11);
 assert.equal(new Set(lineup).size,11);
 assert.equal(lineup.filter(id=>club.players.find(player=>player.id===id)?.position==='GK').length,1);
 assert.equal(lineup.includes(injuredStarter),false);
});

test('the assistant fixes an illegal eleven only when enabled',()=>{
 const state=stateOf(),starter=state.club!.lineup[3];
 const club=withPlayer(state,starter,{injuryMatches:2}).club!;
 const on=ensureLegalLineup(club);
 assert.equal(on.changed,true);
 assert.equal(on.club.lineup.includes(starter),false);
 const off=ensureLegalLineup({...club,assistant:{autoSquad:false}});
 assert.equal(off.changed,false);
 assert.equal(off.club.lineup.includes(starter),true);
 assert.deepEqual(assistantOf(club),DEFAULT_ASSISTANT);
});

test('training refuses an injured player and the assistant command persists',()=>{
 const state=stateOf(),starter=state.club!.lineup[3];
 const injured=withPlayer(state,starter,{injuryMatches:1});
 assert.throws(()=>reduceCommand(injured,{type:'club.train',id:'t1',playerId:starter,attribute:'pas'} as never),/injured/);
 const toggled=reduceCommand(state,{type:'club.assistant',id:'a1',autoSquad:false,autoSubs:false} as never);
 assert.deepEqual(toggled.club!.assistant,{autoSquad:false,autoSubs:false});
 assert.equal(assistantOf(toggled.club!).autoSquad,false);
});

test('a quick match auto-repairs the eleven and leaves everyone fitter or tired',()=>{
 const state=stateOf(),starter=state.club!.lineup[2];
 const injured=withPlayer(state,starter,{injuryMatches:2});
 const played=reduceCommand(injured,{type:'club.match',id:'m1',tier:0} as never);
 assert.equal(played.club!.lineup.includes(starter),false);
 assert.equal(played.club!.lineup.length,11);
 const conditions=played.club!.players.map(player=>fitnessOf(player));
 assert(conditions.every(value=>value>=0&&value<=100));
 assert(played.club!.matches!.length===1);
});

test('the assistant can suggest and execute a substitution only with a fit bench',()=>{
 const state=stateOf(),out=state.club!.lineup[3];
 const tired=withPlayer(state,out,{fitness:40}).club!;
 const swap=assistantSubstitution(tired);
 if(swap){assert.equal(swap.outId,out);assert.notEqual(swap.inId,out)}
 assert.equal(autoSubstitution({...tired,assistant:{autoSquad:true,autoSubs:false}},0),null);
 assert.equal(autoSubstitution(tired,5),null);
 const fresh=withPlayer(state,state.club!.lineup[3],{fitness:100}).club!;
 const noSwap=assistantSubstitution(fresh);
 assert(noSwap===null||noSwap.inId.length>0);
});
