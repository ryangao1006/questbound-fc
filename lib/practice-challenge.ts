import {createPractice} from './football-practice.ts';
import type {CareerState} from './football-model.ts';
import type {PlayerAttributes} from './football-stats.ts';
import type {MatchState} from './football-match.ts';
export const PASSING_ROUNDS=5;
export type PassingGate={x:number;y:number;halfWidth:number;height:number;direction:1|-1};
export type PassingResult={hit:boolean;error:number|null;reason:'hit'|'wide'|'high'|'short'};
export type PassingAttempt={frame:number;previous:{x:number;y:number;z:number};lastFrame:number;launched:boolean;resolved?:boolean};
export function passingRound(career:CareerState,round:number,attributes?:PlayerAttributes){
 const state=createPractice(career,'solo',attributes),own=state.actors.find(a=>a.id===state.controlledId)!,direction:1|-1=state.playerHome?1:-1;
 own.x=direction===1?40:65;own.y=34;own.vx=own.vy=0;own.facing=[direction,0];
 state.ball={x:own.x+.65*direction,y:34,z:.15,vx:0,vy:0,vz:0,owner:own.id,lastTouch:own.id,lastTeam:own.home};
 const y=[28,40,24,44,34][Math.max(0,Math.min(4,round))];
 return {state,gate:{x:own.x+18*direction,y,halfWidth:[2.2,1.8,1.5,1.2,.8][Math.max(0,Math.min(4,round))],height:.6,direction} as PassingGate};
}
export function startPassingAttempt(state:MatchState):PassingAttempt{return {frame:state.frame,lastFrame:state.frame,previous:{x:state.ball.x,y:state.ball.y,z:state.ball.z},launched:false}}
/** Segment/plane intersection avoids missing a fast pass between rendered snapshots. */
export function observePassingAttempt(attempt:PassingAttempt,state:MatchState,gate:PassingGate):PassingResult|null{
 if(attempt.resolved||state.frame<=attempt.lastFrame)return null;
 const b=state.ball,previous=attempt.previous;attempt.lastFrame=state.frame;
 if(!b.owner&&b.lastTouch===state.controlledId)attempt.launched=true;
 if(attempt.launched&&(previous.x-gate.x)*gate.direction<=0&&(b.x-gate.x)*gate.direction>=0&&b.x!==previous.x){
  const t=(gate.x-previous.x)/(b.x-previous.x),y=previous.y+(b.y-previous.y)*t,z=previous.z+(b.z-previous.z)*t,error=Math.abs(y-gate.y),hit=error<=gate.halfWidth&&z<=gate.height;
  attempt.resolved=true;return {hit,error:Math.round(error*100)/100,reason:hit?'hit':z>gate.height?'high':'wide'};
 }
 attempt.previous={x:b.x,y:b.y,z:b.z};
 if(state.frame-attempt.frame>=180||state.finished||state.stoppage||attempt.launched&&!!b.owner){attempt.resolved=true;return {hit:false,error:null,reason:'short'}};
 return null;
}
export function readPassingBest(value:unknown){return Number.isInteger(value)&&Number(value)>=0&&Number(value)<=PASSING_ROUNDS?Number(value):0}
