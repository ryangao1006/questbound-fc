import {TACTIC_SHAPE,type ClubMatchEvent,type ClubMatchReport,type ClubTeam,type MatchPathFrame,type PlayerMatchRating} from './club-match.ts';
import type {ClubTactic} from './club-state.ts';
import {formationSlots,type LineupSlot} from './club-lineup.ts';

/**
 * Match engine v2: possession chains, shot quality (xG) and a carrier timeline so
 * the watch can animate a ball that belongs to a player instead of drifting.
 *
 * Open-source references that informed the design:
 * - GallagherAiden/footballSimulationEngine (iterative possession/passing/shooting)
 *   https://github.com/GallagherAiden/footballSimulationEngine
 * - Dixon-Coles attack/defence strengths and Poisson goal counts
 *   https://github.com/topics/dixon-coles
 * - open xG models (distance/angle shot quality)
 *   https://github.com/finleyaf/xg_modeling-with-football-data
 *   https://github.com/bsobkowicz1096/Football-xG-Predictor
 */
export type PitchPoint={x:number;y:number};
export type TimelineItem={minute:number;t:number;side:'home'|'away';kind:'dribble'|'pass'|'shot'|'restart';from:PitchPoint;to:PitchPoint;carrier:number;receiver:number;duration:number};
export type ShotXg={minute:number;side:'home'|'away';x:number;y:number;distance:number;xg:number;outcome:'goal'|'save'|'off'};
export type V2State={
 home:ClubTeam;away:ClubTeam;seed:number;rng:number;block:number;finished:boolean;
 possession:[number,number];score:[number,number];shots:[number,number];onTarget:[number,number];
 events:ClubMatchEvent[];timeline:TimelineItem[];shotXgs:ShotXg[];xg:[number,number];path:MatchPathFrame[];subs:number;ball:PitchPoint;
 /** Continuous ball keyframes in match minutes, built from the timeline. */
 ballTrack:{m:number;x:number;y:number}[];clockMinute:number;
};
export type MatchV2Report=ClubMatchReport & {engine:'v2';timeline:TimelineItem[];shotXgs:ShotXg[];xg:[number,number];shotsV2:[number,number];ballTrack:{m:number;x:number;y:number}[]};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const round=(value:number)=>Math.round(value*100)/100;
const BLOCKS=18;
function nextRandom(state:number){let next=(state>>>0)||1;next^=next<<13;next^=next>>>17;next^=next<<5;next>>>=0;return {value:next/4294967296,state:next}}
function draw(state:number){const step=nextRandom(state);return {value:step.value,state:step.state}}
export function shotXg(x:number,y:number,side:'home'|'away'):number{
 const goalX=side==='home'?105:0,dx=Math.abs(x-goalX),dy=Math.abs(y-34),distance=Math.sqrt(dx*dx+dy*dy);
 return round(1/(1+Math.exp(-(1.2-0.16*distance-0.08*dy))));
}
export function attackStrength(team:ClubTeam,other:ClubTeam,home:boolean){
 const shape=TACTIC_SHAPE[team.tactic]??TACTIC_SHAPE.balanced,boost=home?2:0;
 const attack=team.lines.ATT+shape.ATT+boost,defence=other.lines.DEF+(TACTIC_SHAPE[other.tactic]?.DEF??0)+boost*0.5;
 return {multiplier:clamp(Math.exp((attack-defence)/55),0.55,1.8),attack,defence};
}
function withSlots(team:ClubTeam,side:'home'|'away'):ClubTeam{
 if(team.slots&&team.slots.length===11)return team;
 const slots:LineupSlot[]=formationSlots('4-4-2').map((slot,index)=>({
  id:`${team.shortName}-${index}`,name:index===0?`${team.name} GK`:`${team.name} ${slot.role} ${index}`,
  position:(slot.role==='GK'?'GK':slot.role==='DEF'?'CB':slot.role==='MID'?'CM':'ST') as LineupSlot['position'],
  role:slot.role,x:side==='away'?105-slot.x:slot.x,y:slot.y,
 }));
 return {...team,slots};
}
export function createMatchV2(home:ClubTeam,away:ClubTeam,seed:number):V2State{
 const homeTeam=withSlots(home,'home'),awayTeam=withSlots(away,'away');
 const hShape=TACTIC_SHAPE[homeTeam.tactic]??TACTIC_SHAPE.balanced,aShape=TACTIC_SHAPE[awayTeam.tactic]??TACTIC_SHAPE.balanced;
 const possessionHome=clamp(52+((homeTeam.lines.MID+hShape.MID)-(awayTeam.lines.MID+aShape.MID))*0.55,28,72);
 return {home:homeTeam,away:awayTeam,seed,rng:(seed>>>0)||1,block:0,finished:false,possession:[round(possessionHome),round(100-possessionHome)],score:[0,0],shots:[0,0],onTarget:[0,0],events:[],timeline:[],shotXgs:[],xg:[0,0],path:[],subs:0,ball:{x:52.5,y:34},ballTrack:[{m:0,x:52.5,y:34}],clockMinute:0};
}
export function advanceMatchV2(input:V2State):V2State{
 if(input.finished)return input;
 const block=input.block;
 if(!input.ball)input={...input,ball:{x:52.5,y:34}};
 const state:V2State={...input,rng:input.rng,ball:{...input.ball},ballTrack:[...input.ballTrack],score:[...input.score] as [number,number],shots:[...input.shots] as [number,number],onTarget:[...input.onTarget] as [number,number],xg:[...input.xg] as [number,number],events:[...input.events],timeline:[...input.timeline],shotXgs:[...input.shotXgs],path:[...input.path]};
 const roll=()=>{const step=draw(state.rng);state.rng=step.state;return step.value};
 const minuteBase=block*5;
 state.clockMinute=Math.max(state.clockMinute,minuteBase);
 const blockEnd=minuteBase+5;
 const pushItem=(item:TimelineItem)=>{
  state.timeline.push(item);
  const remaining=Math.max(0.05,blockEnd-state.clockMinute);
  const durationMinutes=Math.min(remaining,Math.max(0.06,item.duration/60));
  state.ballTrack.push({m:round(state.clockMinute),x:round(item.from.x),y:round(item.from.y)});
  state.clockMinute=Math.min(blockEnd,state.clockMinute+durationMinutes);
  state.ballTrack.push({m:round(state.clockMinute),x:round(item.to.x),y:round(item.to.y)});
 };
 const chains=2+Math.floor(roll()*2);
 for(let chainIndex=0;chainIndex<chains;chainIndex+=1){
  const side=roll()*100<state.possession[0]?'home':'away',index=side==='home'?0:1;
  const team=side==='home'?state.home:state.away,opponent=side==='home'?state.away:state.home;
  const slots:LineupSlot[]=team.slots??[];
  const goalX=side==='home'?105:0,strength=attackStrength(team,opponent,side==='home');
  let targetCarrier=1+Math.floor(roll()*10);
  let position={...state.ball};
  // the carrier is the outfield player nearest the ball, so possessions start where the ball is
  let best=Infinity;
  for(let index=1;index<11;index+=1){const slot=slots[index];if(!slot)continue;const distance=Math.hypot(slot.x-position.x,slot.y-position.y);if(distance<best){best=distance;targetCarrier=index}}
  let carrier=targetCarrier;
  const steps=2+Math.floor(roll()*3);let minute=clamp(minuteBase+1+Math.floor(roll()*4),1,90);
  for(let step=0;step<steps;step+=1){
   const receiver=1+Math.floor(roll()*10);
   const target={x:clamp(position.x+(goalX-position.x)*0.32+(roll()*10-5),2,103),y:clamp(position.y+(roll()*16-8),2,66)};
   const kind:TimelineItem['kind']=roll()<0.55?'pass':'dribble';
   pushItem({minute,t:round((step+1)/steps),side,kind,from:{...position},to:target,carrier,receiver,duration:8+Math.floor(roll()*8)});
   if(kind==='pass')carrier=receiver;
   position=target;minute=clamp(minute+1,1,90);
  }
  state.ball={...position};
  if(Math.abs(goalX-position.x)>32)continue;
  const shotX=clamp(position.x,side==='home'?78:6,side==='home'?104:27),shotY=clamp(position.y,4,64);
  const xg=clamp(shotXg(shotX,shotY,side)*strength.multiplier,0.01,0.85);
  state.shots[index]+=1;state.xg[index]=round(state.xg[index]+xg);
  pushItem({minute,t:1,side,kind:'shot',from:{x:shotX,y:shotY},to:{x:goalX,y:34+(roll()*8-4)},carrier,receiver:-1,duration:2});
  const shotRoll=roll(),outcome:ShotXg['outcome']=shotRoll<xg?'goal':shotRoll<xg+0.35?'save':'off';
  state.shotXgs.push({minute,side,x:shotX,y:shotY,distance:round(Math.hypot(shotX-goalX,shotY-34)),xg,outcome});
  const shooter=slots[carrier],name=shooter?.name??team.name,line=shooter?.role==='ATT'?'ATT':'MID';
  if(outcome==='goal'){state.score[index]+=1;state.onTarget[index]+=1;state.events.push({minute,side,kind:'goal',line,label:'Goal',scorer:name,x:shotX,y:shotY});
   pushItem({minute:clamp(minute+1,1,90),t:0,side,kind:'restart',from:{x:52.5,y:34},to:{x:52.5,y:34},carrier:1,receiver:1,duration:6});
   state.ball={x:52.5,y:34};
  } else if(outcome==='save'){state.onTarget[index]+=1;state.events.push({minute,side,kind:'save',line,label:'Saved',scorer:name,x:shotX,y:shotY});}
  else state.events.push({minute,side,kind:'chance',line,label:'Off target',scorer:name,x:shotX,y:shotY});
 }
 if(state.clockMinute<blockEnd){state.ballTrack.push({m:round(blockEnd),x:round(state.ball.x),y:round(state.ball.y)});state.clockMinute=blockEnd}
 for(let frameIndex=0;frameIndex<3;frameIndex+=1){
  const items=state.timeline.filter(item=>item.minute>minuteBase&&item.minute<=minuteBase+5);
  const item=items.length?items[Math.min(items.length-1,frameIndex)]:undefined;
  state.path.push({minute:Math.min(90,minuteBase+1+frameIndex*2),side:item?.side??(state.possession[0]>=50?'home':'away'),x:item?round((item.from.x+item.to.x)/2):52.5,y:item?round((item.from.y+item.to.y)/2):34});
 }
 const nextBlock=block+1;
 return {...state,block:nextBlock,finished:nextBlock>=BLOCKS};
}
export function setV2Tactic(state:V2State,side:'home'|'away',tactic:ClubTactic):V2State{
 if(state.finished)throw new Error('This match is already finished.');
 if(!TACTIC_SHAPE[tactic])throw new Error('Choose a known tactic.');
 return {...state,[side]:{...state[side],tactic}} as V2State;
}
export function replaceV2Team(state:V2State,side:'home'|'away',team:ClubTeam):V2State{
 return {...state,[side]:team} as V2State;
}
export function reportMatchV2(state:V2State):MatchV2Report{
 const {home,away,score,possession,shots,onTarget,events,timeline,shotXgs,xg,path}=state;
 const ratings=(side:'home'|'away')=>{const index=side==='home'?0:1;return Math.round(clamp(6+(score[index]-score[1-index])*0.25,3,10)*10)/10};
 const rateTeam=(team:ClubTeam,side:'home'|'away'):PlayerMatchRating[]=>{
  const index=side==='home'?0:1,bonus=(score[index]-score[1-index])*0.35,goals=new Map<string,number>();
  for(const event of events)if(event.side===side&&event.kind==='goal'&&event.scorer)goals.set(event.scorer,(goals.get(event.scorer)??0)+1);
  const rows:PlayerMatchRating[]=[];
  for(const line of ['DEF','MID','ATT'] as const)for(const name of team.scorers[line]){const count=goals.get(name)??0;rows.push({name,line,goals:count,rating:Math.round(clamp(6+bonus+count*1.1,3,10)*10)/10})}
  return rows;
 };
 const lineDiff=(key:'DEF'|'MID'|'ATT')=>home.lines[key]-away.lines[key];
 const dominantLine:'DEF'|'MID'|'ATT'=(Math.abs(lineDiff('MID'))>=Math.abs(lineDiff('ATT'))&&Math.abs(lineDiff('MID'))>=Math.abs(lineDiff('DEF')))?'MID':(Math.abs(lineDiff('ATT'))>=Math.abs(lineDiff('DEF'))?'ATT':'DEF');
 const diff=lineDiff(dominantLine),dominantSide:'home'|'away'|'even'=Math.abs(diff)<1.5?'even':diff>0?'home':'away';
 const homeShots=events.filter(event=>event.side==='home').length,awayShots=events.filter(event=>event.side==='away').length;
 return {engine:'v2',home,away,seed:state.seed,score,possession,shots,onTarget,events,path,timeline:timeline.slice(0,260),shotXgs,xg,shotsV2:shots,ballTrack:state.ballTrack,
  ratings:{home:ratings('home'),away:ratings('away')},playerRatings:{home:rateTeam(home,'home'),away:rateTeam(away,'away')},
  lineups:{home:(home.slots??[]) as LineupSlot[],away:(away.slots??[]) as LineupSlot[]},
  explanation:{dominantLine,dominantSide,chancesFrom:homeShots>=awayShots?'your attack':'your midfield',concededBecause:events.some(event=>event.side==='away'&&event.kind==='goal')?'their chances came from the final third':'you kept their chances low',tacticNote:'Possession chains decide where the shots come from.',nextStep:dominantSide==='away'?'Improve the weaker line or lower their edge.':'Keep this shape and train the line that created the chances.'}};
}
export function simulateClubMatchV2(home:ClubTeam,away:ClubTeam,seed:number):MatchV2Report{
 let state=createMatchV2(home,away,seed);
 while(!state.finished)state=advanceMatchV2(state);
 return reportMatchV2(state);
}
export function xgSummary(report:MatchV2Report){return {xg:report.xg,shots:report.shotsV2,goals:report.score,perShot:report.shotXgs.length?round(report.shotXgs.reduce((sum,shot)=>sum+shot.xg,0)/report.shotXgs.length):0}}
