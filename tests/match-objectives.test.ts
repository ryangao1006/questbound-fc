import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {practiceCareer,createPractice} from '../lib/football-practice.ts';
import {objectivesFor,evaluateObjectives,phaseRatings} from '../lib/match-objectives.ts';
import type {MatchState} from '../lib/football-match.ts';
import * as v1 from '../lib/football-engine/v1.ts';

const career=practiceCareer(initialState());
const three=()=>createPractice(career,'three');
const controlled=(state:MatchState)=>state.actors.find(actor=>actor.id===state.controlledId)!;
const withStats=(state:MatchState,patch:Record<string,number>)=>{const player=controlled(state);Object.assign(player.stats,patch);return state};

test('every match briefs one main objective and at most two secondary ones',()=>{
 for(const position of ['GK','CB','LB','CM','AM','LW','RW','ST'] as const){
  const state=three();controlled(state).position=position;
  const list=objectivesFor(state);
  assert.equal(list.filter(item=>item.main).length,1,position);
  assert(list.filter(item=>!item.main).length<=2,position);
  assert.equal(new Set(list.map(item=>item.id)).size,list.length,position);
 }
});

test('the brief follows the position instead of one generic checklist',()=>{
 const keeper=three();controlled(keeper).position='GK';
 const striker=three();controlled(striker).position='ST';
 const defender=three();controlled(defender).position='CB';
 const ids=(state:MatchState)=>objectivesFor(state).map(item=>item.id).join(',');
 assert.equal(objectivesFor(keeper)[0].kind,'saves');
 assert.equal(objectivesFor(striker)[0].kind,'shotsOnTarget');
 assert.equal(objectivesFor(defender)[0].kind,'tackles');
 assert.notEqual(ids(keeper),ids(striker));
 assert.equal(ids(three()),ids(three()));
});

test('shorter formats ask for correspondingly smaller numbers',()=>{
 const drill=three();
 const full={...three(),version:v1.MATCH_ENGINE_VERSION,physicsVersion:v1.PHYSICS_VERSION} as MatchState;
 const drillTarget=objectivesFor(drill)[0].target,fullTarget=objectivesFor(full)[0].target;
 assert(fullTarget>=drillTarget);
 assert.equal(drillTarget>=1,true);
});

test('objectives are judged from the real statistics and the scoreline',()=>{
 const state=three();controlled(state).position='CB';
 withStats(state,{tackles:9,interceptions:4,completedPasses:20});
 const results=evaluateObjectives(state);
 assert.equal(results.find(item=>item.objective.id==='tackles')?.met,true);
 const clean=results.find(item=>item.objective.id==='cleanSheet');
 assert.equal(clean?.met,true);
 state.score=[0,2];
 assert.equal(evaluateObjectives(state).find(item=>item.objective.id==='cleanSheet')?.met,false);
});

test('phase ratings stay inside 0–10 and respond to the player',()=>{
 const quiet=three();quiet.controlledId=controlled(quiet).id;
 const busy=three();withStats(busy,{tackles:6,interceptions:4,completedPasses:30,passes:33,turnovers:1,fouls:0,positionScore:26,positionSamples:30});
 const a=phaseRatings(quiet),b=phaseRatings(busy);
 for(const value of [a.defending,b.defending,a.organising,b.organising]){assert(value>=0&&value<=10)}
 assert(b.defending>a.defending);
 assert(b.organising>a.organising);
 assert.equal(a.goalkeeping,null);
 const keeper=three();controlled(keeper).position='GK';withStats(keeper,{saves:6});
 assert((phaseRatings(keeper).goalkeeping??0)>5);
});
