import {createPractice,practiceInput} from './football-practice.ts';
import {stepMatch} from './football-match.ts';
import type {CareerState} from './football-model.ts';
import type {PlayerAttributes} from './football-stats.ts';

export type TrialMetrics={
 /** Seconds to cover the first 8 m from a standstill (lower is better). */
 accelerationSeconds:number;
 /** Mean lateral error of a 20 m ground pass to a standing target, in metres (lower is better). */
 passErrorMetres:number;
 /** Mean lateral deviation of five 18 m shots aimed at the same corner, in metres (lower is better). */
 shotSpreadMetres:number;
 /** Seconds to reverse from full sprint to two metres per second the other way (lower is better). */
 turnSeconds:number;
 /** Distance covered in the last second of a five second sprint, in metres (higher is better). */
 lateSprintMetres:number;
};

const TICKS=30;
const round=(value:number)=>Math.round(value*100)/100;
const solo=(career:CareerState,attributes:PlayerAttributes,seed:number)=>{
 const state=createPractice(career,'solo',attributes);
 state.seed=seed;state.rng=seed||1;
 return state;
};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);

function acceleration(career:CareerState,attributes:PlayerAttributes){
 const state=solo(career,attributes,4711),start=state.actors.find(actor=>actor.id===state.controlledId)!;
 practiceInput(state,{move:[state.playerHome?1:-1,0],sprint:true});
 const from={x:start.x,y:start.y};
 for(let tick=1;tick<=TICKS*4;tick+=1){
  stepMatch(state);
  if(distance(start,from)>=8)return round(tick/TICKS);
 }
 return round(TICKS*4/TICKS);
}

function turn(career:CareerState,attributes:PlayerAttributes){
 const state=solo(career,attributes,4711),player=state.actors.find(actor=>actor.id===state.controlledId)!;
 const forward=state.playerHome?1:-1;
 practiceInput(state,{move:[forward,0],sprint:true});
 for(let tick=0;tick<TICKS;tick+=1)stepMatch(state);
 practiceInput(state,{move:[-forward,0],sprint:true});
 for(let tick=1;tick<=TICKS*3;tick+=1){
  stepMatch(state);
  if(player.vx*forward<-2)return round(tick/TICKS);
 }
 return round(TICKS*3/TICKS);
}

function lateSprint(career:CareerState,attributes:PlayerAttributes){
 const state=solo(career,attributes,4711),player=state.actors.find(actor=>actor.id===state.controlledId)!;
 practiceInput(state,{move:[state.playerHome?1:-1,0],sprint:true});
 for(let tick=0;tick<TICKS*4;tick+=1)stepMatch(state);
 const from={x:player.x,y:player.y};
 for(let tick=0;tick<TICKS;tick+=1)stepMatch(state);
 return round(distance(player,from));
}

function passError(career:CareerState,attributes:PlayerAttributes){
 const errors:number[]=[];
 for(const seed of [11,23,37,41,53]){
  const state=solo(career,attributes,seed),player=state.actors.find(actor=>actor.id===state.controlledId)!;
  const goalX=player.x+(state.playerHome?20:-20),goalY=player.y;
  practiceInput(state,{action:'pass',power:.55,target:[goalX,goalY]});
  let previous={x:state.ball.x,y:state.ball.y};
  for(let tick=0;tick<TICKS*3;tick+=1){
   stepMatch(state);
   const ball=state.ball;
   const crossed=state.playerHome?ball.x>=goalX:ball.x<=goalX;
   if(crossed&&ball.x!==previous.x){
    const slide=(goalX-previous.x)/(ball.x-previous.x||1),y=previous.y+(ball.y-previous.y)*slide;
    errors.push(Math.abs(y-goalY));break;
   }
   previous={x:ball.x,y:ball.y};
  }
 }
 return errors.length?round(errors.reduce((sum,value)=>sum+value,0)/errors.length):0;
}

function shotSpread(career:CareerState,attributes:PlayerAttributes){
 const deviations:number[]=[];
 for(const seed of [7,19,29,43,61]){
  const state=solo(career,attributes,seed),player=state.actors.find(actor=>actor.id===state.controlledId)!;
  const goalX=state.playerHome?60:0;
  player.x=goalX+(state.playerHome?-18:18);player.y=20;
  state.ball={x:player.x+(state.playerHome?0.6:-0.6),y:player.y,z:.12,vx:0,vy:0,vz:0,owner:player.id,lastTouch:player.id,lastTeam:player.home};
  practiceInput(state,{action:'shoot',power:.8,target:[goalX+(state.playerHome?1:-1),16]});
  let previous={x:state.ball.x,y:state.ball.y};
  for(let tick=0;tick<TICKS*4;tick+=1){
   stepMatch(state);
   const ball=state.ball,crossed=state.playerHome?ball.x>=goalX:ball.x<=goalX;
   if(crossed&&ball.x!==previous.x){
    const slide=(goalX-previous.x)/(ball.x-previous.x||1),y=previous.y+(ball.y-previous.y)*slide;
    if(ball.z<=2.44)deviations.push(Math.abs(y-16));break;
   }
   previous={x:ball.x,y:ball.y};
  }
 }
 return deviations.length?round(deviations.reduce((sum,value)=>sum+value,0)/deviations.length):0;
}

/** Fixed-seed trials. Every number comes from the real practice engine, not a formula. */
export function runTrials(career:CareerState,attributes:PlayerAttributes):TrialMetrics{
 return {
  accelerationSeconds:acceleration(career,attributes),
  passErrorMetres:passError(career,attributes),
  shotSpreadMetres:shotSpread(career,attributes),
  turnSeconds:turn(career,attributes),
  lateSprintMetres:lateSprint(career,attributes),
 };
}
