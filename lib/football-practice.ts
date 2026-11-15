import * as small from './football-engine/v4.ts';
import {createMatch,stepMatch} from './football-engine/v2.ts';
import {matchEngine,type MatchState,type MatchInput} from './football-match.ts';
import {createCareer,availableSquadNumbers,precisePosition} from './football-career.ts';
import {createFootballWorldRoster,PREMIER_LEAGUE_CLUBS} from './football-data.ts';
import type {CareerState,ActiveFixture} from './football-model.ts';
import type {PlannerState} from './model.ts';
import type {PlayerAttributes} from './football-stats.ts';
export function practiceCareer(planner:PlannerState){const club=PREMIER_LEAGUE_CLUBS[0],world=createFootballWorldRoster();return createCareer(planner,{type:'career.create',id:'local-training-only',clubId:club.id,position:precisePosition(planner.settings.position),number:availableSquadNumbers(world,club.id)[0]},'local-training-only')}
export function createPractice(career:CareerState,kind:'solo'|'three',attributes=career.player.attributes):MatchState{
 const c=structuredClone(career),fixture=c.fixtures.find(f=>f.home===c.player.clubId||f.away===c.player.clubId)!;
 c.active={id:'local-practice-v2',fixtureId:fixture.id,attributes,specialties:c.equippedSpecialties,selection:'starting',mode:'full',speed:1,seed:4711,subMinute:0,avatar:c.active?.avatar} as ActiveFixture;
 const state=(kind==='three'?small.createMatch:createMatch)(c,fixture,true);state.extraTime=false;state.id=kind==='three'?'local-practice-v4':'local-practice-v2';state.stoppage=null;state.paused=false;
 for(const home of [true,false]){const own=state.actors.find(p=>p.id===state.controlledId)!,team=state.actors.filter(p=>p.home===home&&p.onPitch),keeper=team.find(p=>p.position==='GK')!,attacker=team.find(p=>p.id!==own.id&&p.position==='ST')||team.find(p=>p.id!==own.id&&p.position!=='GK')!;
  const pool=home===own.home?[own,keeper,attacker,...team]:[keeper,...team.filter(p=>p.position==='CM'||p.position==='ST'),...team],chosen=[...new Map(pool.map(p=>[p.id,p])).values()].slice(0,3);
  for(const p of team){p.onPitch=kind==='solo'?p.id===own.id:chosen.includes(p);p.bench=kind==='three'?false:!p.onPitch;}
 }
 const own=state.actors.find(p=>p.id===state.controlledId)!;own.x=kind==='three'?(state.playerHome?26:34):(state.playerHome?60:45);own.y=kind==='three'?20:34;
 if(kind==='three'){for(const home of [true,false]){const team=state.actors.filter(p=>p.home===home&&p.onPitch),outfield=team.filter(p=>p.position!=='GK');for(const [i,p]of outfield.entries()){p.x=home?24+i*10:36-i*10;p.y=i?29:11}const keeper=team.find(p=>p.position==='GK');if(keeper){keeper.x=home?3:57;keeper.y=20}}own.x=own.position==='GK'?(state.playerHome?3:57):(state.playerHome?26:34);own.y=20;}own.facing=[state.playerHome?1:-1,0];
 state.ball={x:own.x+.6*own.facing[0],y:own.y,z:.12,vx:0,vy:0,vz:0,owner:own.id,lastTeam:own.home};
 return state;
}
export function chargePower(milliseconds:number){return Math.max(.15,Math.min(1,.15+Math.max(0,milliseconds)/850*.85))}
export function practiceInput(state:MatchState,input:Omit<MatchInput,'frame'>){matchEngine(state).applyMatchInput(state,{...input,frame:state.frame})}
/** Real fixed-seed engine trials. No claimed percentages or synthetic performance bonuses. */
export function measureBuild(c:CareerState,attributes:PlayerAttributes){
 const moving=createPractice(c,'solo',attributes),p=moving.actors.find(p=>p.id===moving.controlledId)!,start=p.x;practiceInput(moving,{move:[moving.playerHome?1:-1,0],sprint:true});for(let i=0;i<60;i++)stepMatch(moving);const distance=Math.abs(p.x-start);
 const shot=createPractice(c,'solo',attributes);practiceInput(shot,{action:'shoot',power:.65,target:[shot.playerHome?106:-1,34]});for(let i=0;i<8;i++)stepMatch(shot);const ballSpeed=Math.hypot(shot.ball.vx,shot.ball.vy);
 return {twoSecondSprint:Math.round(distance*100)/100,shotSpeed:Math.round(ballSpeed*100)/100};
}
