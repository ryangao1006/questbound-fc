import type {MatchState,MatchActor} from './football-match.ts';
import type {FootballPosition} from './football-data.ts';

/**
 * Per-match objectives derived from the player's position, the score and the
 * match length. Nothing is stored: the same match always produces the same brief.
 */
export type ObjectiveKind='saves'|'tackles'|'interceptions'|'passes'|'shotsOnTarget'|'goals'|'assists'|'cleanSheet';
export type MatchObjective={id:string;kind:ObjectiveKind;label:string;target:number;main:boolean};
export type ObjectiveResult={objective:MatchObjective;value:number;met:boolean};
export type PhaseRatings={defending:number;organising:number;goalkeeping:number|null};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const halfSeconds=(state:MatchState)=>state.version==='fixed-football-4'?90:state.version==='fixed-football-3'?90:300;
/** Scale for shorter formats so a three-a-side drill is not judged like a full fixture. */
const scaleFor=(state:MatchState)=>clamp(halfSeconds(state)/300,.3,1);
const positionOf=(state:MatchState)=>state.actors.find(actor=>actor.id===state.controlledId) as MatchActor|undefined;

const defensive=(position:FootballPosition)=>['CB','LB','RB','DM'].includes(position);
const attacking=(position:FootballPosition)=>['LW','RW','ST','AM'].includes(position);

export function objectivesFor(state:MatchState):MatchObjective[]{
 const player=positionOf(state),position=player?.position??'ST',scale=scaleFor(state);
 const round=(value:number)=>Math.max(1,Math.round(value*scale));
 const list:MatchObjective[]=[];
 if(position==='GK')list.push({id:'saves',kind:'saves',label:'Make {0} saves',target:round(3),main:true});
 else if(defensive(position))list.push({id:'tackles',kind:'tackles',label:'Win {0} tackles',target:round(4),main:true});
 else if(attacking(position))list.push({id:'shotsOnTarget',kind:'shotsOnTarget',label:'Hit the target {0} times',target:round(3),main:true});
 else list.push({id:'passes',kind:'passes',label:'Complete {0} passes',target:round(18),main:true});

 const secondary:MatchObjective[]=[];
 if(position==='GK')secondary.push({id:'cleanSheet',kind:'cleanSheet',label:'Keep a clean sheet',target:1,main:false},{id:'passes2',kind:'passes',label:'Complete {0} passes',target:round(10),main:false});
 else if(defensive(position))secondary.push({id:'cleanSheet',kind:'cleanSheet',label:'Keep a clean sheet',target:1,main:false},{id:'interceptions',kind:'interceptions',label:'Intercept {0} balls',target:round(2),main:false});
 else if(['CM','AM'].includes(position))secondary.push({id:'passes2',kind:'passes',label:'Complete {0} more passes',target:round(24),main:false},{id:'assists',kind:'assists',label:'Set one up',target:1,main:false});
 else if(position==='LW'||position==='RW')secondary.push({id:'goals',kind:'goals',label:'Score',target:1,main:false},{id:'assists',kind:'assists',label:'Set one up',target:1,main:false});
 else secondary.push({id:'goals',kind:'goals',label:'Score',target:1,main:false},{id:'passes2',kind:'passes',label:'Link the play with {0} passes',target:round(10),main:false});
 return [...list,...secondary.slice(0,2)];
}

export function objectiveValue(state:MatchState,kind:ObjectiveKind,player?:MatchActor){
 const actor=player??positionOf(state);
 const stats=actor?.stats;
 switch(kind){
  case 'saves':return stats?.saves??0;
  case 'tackles':return stats?.tackles??0;
  case 'interceptions':return stats?.interceptions??0;
  case 'passes':return stats?.completedPasses??0;
  case 'shotsOnTarget':return stats?.shotsOnTarget??0;
  case 'goals':return stats?.goals??0;
  case 'assists':return stats?.assists??0;
  case 'cleanSheet':{
   if(!actor)return 0;
   const conceded=state.score[actor.home?1:0];
   return conceded===0?1:0;
  }
  default:return 0;
 }
}

export function evaluateObjectives(state:MatchState):ObjectiveResult[]{
 const player=positionOf(state);
 return objectivesFor(state).map(objective=>{
  const value=objectiveValue(state,objective.kind,player);
  return {objective,value,met:value>=objective.target};
 });
}

export function phaseRatings(state:MatchState):PhaseRatings{
 const player=positionOf(state),stats=player?.stats;
 if(!player||!stats)return {defending:0,organising:0,goalkeeping:null};
 const accuracy=stats.passes?stats.completedPasses/stats.passes:.5;
 const organisation=stats.positionSamples?stats.positionScore/stats.positionSamples:.5;
 const defending=clamp(4+stats.tackles*.45+stats.interceptions*.4+stats.saves*.3-stats.fouls*.25+stats.turnovers*-.05,0,10);
 const organising=clamp(3.5+accuracy*4+organisation*2-stats.turnovers*.1,0,10);
 const conceded=state.score[player.home?1:0];
 const goalkeeping=player.position==='GK'?clamp(3+stats.saves*.7+(conceded===0?2:0)+(stats.passes?accuracy:0),0,10):null;
 return {defending:Math.round(defending*10)/10,organising:Math.round(organising*10)/10,goalkeeping:goalkeeping===null?null:Math.round(goalkeeping*10)/10};
}
