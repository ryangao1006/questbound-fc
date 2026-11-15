// Saved matches always dispatch to their retained engine and physics version.
import * as v1 from './football-engine/v1.ts';
import * as v3 from './football-engine/v3.ts';
import * as v4 from './football-engine/v4.ts';
import * as v2 from './football-engine/v2.ts';
import type {MatchState,MatchInput,MatchActor,MatchAction,Vec} from './football-engine/v2.ts';
export type {MatchState,MatchInput,MatchActor,MatchAction,MatchEvent,Stoppage,PlayerMatchStats,Vec} from './football-engine/v4.ts';
export const {MATCH_ENGINE_VERSION,PHYSICS_VERSION,TICK_RATE,STEP,HALF_SECONDS,createMatch}=v1;
export function matchEngine(state:MatchState){if(state.version===v4.MATCH_ENGINE_VERSION&&state.physicsVersion===v4.PHYSICS_VERSION&&state.balanceVersion==='questbound-football-1')return v4;if(state.version===v3.MATCH_ENGINE_VERSION&&state.physicsVersion===v3.PHYSICS_VERSION&&state.balanceVersion==='questbound-football-1')return v3;if(state.version===v2.MATCH_ENGINE_VERSION&&state.physicsVersion===v2.PHYSICS_VERSION&&state.balanceVersion==='questbound-football-1')return v2;if(state.version===v1.MATCH_ENGINE_VERSION&&state.physicsVersion===v1.PHYSICS_VERSION&&state.balanceVersion==='questbound-football-1')return v1;throw new Error('This match needs its saved engine version.');}
export const stepMatch=(state:MatchState)=>matchEngine(state).stepMatch(state);
export const applyMatchInput=(state:MatchState,input:MatchInput)=>matchEngine(state).applyMatchInput(state,input);
export const advanceMatch=(state:MatchState,inputs:MatchInput[],targetFrame:number)=>matchEngine(state).advanceMatch(state,inputs,targetFrame);
export const matchRating=(state:MatchState,id?:string)=>matchEngine(state).matchRating(state,id);
export const isHighlight=(state:MatchState)=>matchEngine(state).isHighlight(state);
export const kick=(state:MatchState,player:MatchActor,kind:MatchAction,power?:number,target?:Vec)=>matchEngine(state).kick(state,player,kind,power,target);
export const aerialShot=(state:MatchState,player:MatchActor,target?:Vec,power?:number)=>matchEngine(state).aerialShot(state,player,target,power);
