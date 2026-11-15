import {clubRatings,type ClubState,type ClubTactic} from './club-state.ts';
import {clubSlots,opponentSlots,type FormationName,type LineupSlot} from './club-lineup.ts';

/**
 * Deterministic manager-match model (PLAN 3.6).
 * One seeded block generator drives both the quick simulation and the live
 * "command" session, so pausing, switching a tactic and resuming still produces
 * the identical match when no decision is made.
 */
export type ClubTeamLine=number;
export type ClubTeam={name:string;shortName:string;lines:{DEF:ClubTeamLine;MID:ClubTeamLine;ATT:ClubTeamLine;GK:ClubTeamLine};tactic:ClubTactic;scorers:{ATT:string[];MID:string[];DEF:string[]};formation?:FormationName;slots?:LineupSlot[]};
export type MatchEventKind='goal'|'chance'|'save'|'sub';
export type ClubMatchEvent={minute:number;side:'home'|'away';kind:MatchEventKind;line:'MID'|'ATT';label:string;scorer?:string;x?:number;y?:number;out?:string};
/** A five-minute slice of ball possession: where the ball was, and who had it. */
export type MatchPathFrame={minute:number;x:number;y:number;side:'home'|'away'};
export type PlayerMatchRating={name:string;line:'MID'|'ATT'|'DEF';goals:number;rating:number};
export type ClubMatchReport={
 home:ClubTeam;away:ClubTeam;seed:number;score:[number,number];possession:[number,number];
 shots:[number,number];onTarget:[number,number];events:ClubMatchEvent[];
 ratings:{home:number;away:number};playerRatings:{home:PlayerMatchRating[];away:PlayerMatchRating[]};path:MatchPathFrame[];lineups:{home:LineupSlot[];away:LineupSlot[]};
 explanation:{dominantLine:'DEF'|'MID'|'ATT'|'GK'|'even';dominantSide:'home'|'away'|'even';chancesFrom:string;concededBecause:string;tacticNote:string;nextStep:string};
};
export type LiveMatchSession={
 home:ClubTeam;away:ClubTeam;seed:number;rng:number;block:number;finished:boolean;
 possession:[number,number];shots:[number,number];onTarget:[number,number];score:[number,number];events:ClubMatchEvent[];path:MatchPathFrame[];subs:number;
};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const round1=(value:number)=>Math.round(value*10)/10;
const BLOCKS=18;

/** Pure xorshift step so the RNG state can live inside a saved session. */
export function nextRandom(state:number):{value:number;state:number}{
 let next=(state>>>0)||1;
 next^=next<<13;next^=next>>>17;next^=next<<5;next>>>=0;
 return {value:next/4294967296,state:next};
}
function rng(seed:number){let state=(seed>>>0)||1;return()=>{const step=nextRandom(state);state=step.state;return step.value}}

export const TACTIC_SHAPE:Record<ClubTactic,{ATT:number;MID:number;DEF:number;risk:number}>={
 balanced:{ATT:0,MID:0,DEF:0,risk:0},
 possession:{ATT:-1,MID:4,DEF:0,risk:-0.5},
 counter:{ATT:3,MID:-2,DEF:1,risk:0.5},
 wide:{ATT:2,MID:-1,DEF:1,risk:0.5},
 press:{ATT:1,MID:1,DEF:2,risk:1.5},
};

export function teamFromClub(club:ClubState):ClubTeam{
 const ratings=clubRatings(club),byId=new Map(club.players.map(player=>[player.id,player]));
 const scorers={ATT:[] as string[],MID:[] as string[],DEF:[] as string[]};
 for(const id of club.lineup){
  const player=byId.get(id);if(!player)continue;
  const line=player.position==='GK'?'GK':['CB','LB','RB'].includes(player.position)?'DEF':['DM','CM','AM'].includes(player.position)?'MID':'ATT';
  if(line==='ATT')scorers.ATT.push(player.name);
  if(line==='MID')scorers.MID.push(player.name);
  if(line==='DEF')scorers.DEF.push(player.name);
 }
 return {name:club.name,shortName:club.shortName,lines:{DEF:ratings.DEF,MID:ratings.MID,ATT:ratings.ATT,GK:ratings.GK},tactic:club.tactics.active,scorers,formation:club.formation,slots:clubSlots(club)};
}

const OPPONENT_NAMES=[['Kestrel Town','KES'],['Harbour Rovers','HBR'],['Ashford United','ASH'],['Vale Athletic','VLA'],['Granite City','GRC'],['Marlow Wanderers','MAR'],['Redcliff FC','RDC'],['Oakham Rangers','OAK']];
const OPPONENT_TACTICS:ClubTactic[]=['balanced','possession','counter','wide','press'];
export function opponentFor(tier:number,seed:number,index=0){
 const random=rng(seed+index*97),bases=[55,62,70,78][clamp(Math.round(tier),0,3)];
 const base=bases+Math.floor(random()*5)-2,spread=()=>base+Math.floor(random()*7)-3;
 const [name,shortName]=OPPONENT_NAMES[Math.floor(random()*OPPONENT_NAMES.length)];
 const tactic=OPPONENT_TACTICS[Math.floor(random()*OPPONENT_TACTICS.length)];
 return {name,shortName,lines:{DEF:spread(),MID:spread(),ATT:spread(),GK:spread()},tactic,scorers:{ATT:[`${name} forward`],MID:[`${name} midfielder`],DEF:[`${name} defender`]},formation:'4-4-2',slots:opponentSlots(name,'4-4-2','away')} as ClubTeam;
}
function shaped(team:ClubTeam,home:boolean){
 const shape=TACTIC_SHAPE[team.tactic]??TACTIC_SHAPE.balanced,boost=home?2:0;
 return {ATT:team.lines.ATT+shape.ATT+boost,MID:team.lines.MID+shape.MID+boost,DEF:team.lines.DEF+shape.DEF+boost*0.5,GK:team.lines.GK+boost*0.5,risk:shape.risk};
}
type Side='home'|'away';
function possessionEdge(side:Side,possession:[number,number]){return side==='home'?(possession[0]-50)/100:(possession[1]-50)/100}

/** Where a chance/save/goal happened, derived from the event itself (no extra rng draws). */
export function eventSpot(kind:MatchEventKind,side:'home'|'away',index:number):{x:number;y:number}{
 const lane=[30,38,46,34,26][index%5];
 if(kind==='goal')return {x:side==='home'?98:7,y:lane};
 if(kind==='save')return {x:side==='home'?89:16,y:lane};
 return {x:side==='home'?80:25,y:clamp(lane/2+4+(index%3)*3,4,64)};
}
export function createLiveMatch(home:ClubTeam,away:ClubTeam,seed:number):LiveMatchSession{
 const h=shaped(home,true),a=shaped(away,false),possessionHome=clamp(50+(h.MID-a.MID)*0.55,28,72);
 return {home,away,seed,rng:(seed>>>0)||1,block:0,finished:false,possession:[round1(possessionHome),round1(100-possessionHome)],shots:[0,0],onTarget:[0,0],score:[0,0],events:[],path:[],subs:0};
}
/** Play the next five-minute block. The rng state is carried in the session. */
export function advanceLiveMatch(session:LiveMatchSession):LiveMatchSession{
 if(session.finished)return session;
 const block=session.block;
 const shapeHome=shaped(session.home,true),shapeAway=shaped(session.away,false);
 const shots:[number,number]=[...session.shots],onTarget:[number,number]=[...session.onTarget],score:[number,number]=[...session.score];
 const events=[...session.events],path=[...session.path];let rng=session.rng;
 const attacking:'home'|'away'=block%2===0?'home':'away';
 for(let index=0;index<3;index+=1){
  const minute=Math.min(90,block*5+1+index*2);
  const direction=attacking==='home'?1:-1,progress=(index+1)/4;
  path.push({minute,side:attacking,x:clamp(52.5+direction*(6+(block%4)*4+progress*30),6,99),y:clamp(34+Math.sin((block*3+index)*0.9+(session.seed%11))*16,8,60)});
 };
 const draw=()=>{const step=nextRandom(rng);rng=step.state;return step.value};
 const kickoffMinute=Math.min(90,block*5+2+Math.floor(draw()*3));
 const sides:{side:Side;team:ClubTeam;shape:ReturnType<typeof shaped>;other:ReturnType<typeof shaped>}[]=[
  {side:'home',team:session.home,shape:shapeHome,other:shapeAway},
  {side:'away',team:session.away,shape:shapeAway,other:shapeHome},
 ];
 for(const entry of sides){
  const index=entry.side==='home'?0:1;
  const exposed=entry.other.risk*3.2;
  const edge=(entry.shape.ATT-(entry.other.DEF-exposed))/70+(entry.side==='home'?0.04:0);
  const chanceChance=clamp(0.26+edge*0.5+possessionEdge(entry.side,session.possession),0.08,0.62);
  if(draw()>chanceChance)continue;
  shots[index]+=1;
  const shooterLine=draw()<0.68?'ATT':'MID';
  const names=entry.team.scorers[shooterLine];
  const scorer=names.length?names[Math.floor(draw()*names.length)]:undefined;
  const quality=entry.shape.ATT+draw()*18-(entry.other.DEF-exposed)*0.55;
  const target=quality>22+draw()*10;
  if(!target){const spot=eventSpot('chance',entry.side,events.length);events.push({minute:kickoffMinute,side:entry.side,kind:'chance',line:shooterLine,label:'Off target',scorer,...spot});continue}
  onTarget[index]+=1;
  const saves=clamp(0.42+(entry.other.GK-entry.shape.ATT*0.5)/140,0.18,0.78);
  if(draw()<saves){const spot=eventSpot('save',entry.side,events.length);events.push({minute:kickoffMinute,side:entry.side,kind:'save',line:shooterLine,label:'Saved',scorer,...spot});continue}
  score[index]+=1;
  const spot=eventSpot('goal',entry.side,events.length);
  events.push({minute:kickoffMinute,side:entry.side,kind:'goal',line:shooterLine,label:'Goal',scorer,...spot});
 }
 const nextBlock=block+1;
 return {...session,rng,block:nextBlock,finished:nextBlock>=BLOCKS,shots,onTarget,score,events,path};
}
/** Tactic changes are only meaningful between blocks and never consume rng. */
export function setLiveTactic(session:LiveMatchSession,side:Side,tactic:ClubTactic):LiveMatchSession{
 if(session.finished)throw new Error('This match is already finished.');
 if(!TACTIC_SHAPE[tactic])throw new Error('Choose a known tactic.');
 return {...session,[side]:{...session[side],tactic}};
}
export function liveMatchReport(session:LiveMatchSession):ClubMatchReport{
 const {home,away,score,events,possession,shots,onTarget}=session;
 const h=shaped(home,true),a=shaped(away,false);
 const ratingFor=(side:Side)=>{
  const index=side==='home'?0:1,own=side==='home'?h:a,other=side==='home'?a:h;
  const base=6+(score[index]-score[1-index])*0.25+((own.ATT+own.MID+own.DEF)-(other.ATT+other.MID+other.DEF))/90;
  return Math.round(clamp(base,3,10)*10)/10;
 };
 const rateSide=(team:ClubTeam,side:Side):PlayerMatchRating[]=>{
  const index=side==='home'?0:1,bonus=(score[index]-score[1-index])*0.35;
  const goalsBy=new Map<string,number>();
  for(const event of events)if(event.side===side&&event.kind==='goal'&&event.scorer)goalsBy.set(event.scorer,(goalsBy.get(event.scorer)??0)+1);
  const rows:PlayerMatchRating[]=[];
  for(const line of ['DEF','MID','ATT'] as const){
   for(const name of team.scorers[line]){
    const goals=goalsBy.get(name)??0;
    rows.push({name,line,goals,rating:Math.round(clamp(6+bonus+goals*1.1+(line==='DEF'?Math.max(0,-bonus)*0.2:0),3,10)*10)/10});
   }
  }
  return rows;
 };
 const lineDiff=(key:'DEF'|'MID'|'ATT')=>h[key]-a[key];
 const dominantLine:'DEF'|'MID'|'ATT'=(Math.abs(lineDiff('MID'))>=Math.abs(lineDiff('ATT'))&&Math.abs(lineDiff('MID'))>=Math.abs(lineDiff('DEF')))?'MID':(Math.abs(lineDiff('ATT'))>=Math.abs(lineDiff('DEF'))?'ATT':'DEF');
 const diff=lineDiff(dominantLine),dominantSide:'home'|'away'|'even'=Math.abs(diff)<1.5?'even':diff>0?'home':'away';
 const chancesFrom=(()=>{const count={ATT:0,MID:0};for(const event of events){if(event.side!=='home')continue;count[event.line]+=1}return count.ATT>=count.MID?'your attack':'your midfield'})();
 const goalsAgainst=events.filter(event=>event.side==='away'&&event.kind==='goal');
 const concededBecause=goalsAgainst.length?(goalsAgainst.some(event=>event.line==='ATT')?'their forwards found space behind your line':'their midfield broke through the middle'):'you kept their chances low';
 const tacticNote=home.tactic==='press'?'High pressing won the ball early but left space behind.':home.tactic==='possession'?'Patient possession kept the ball but slowed the final pass.':home.tactic==='counter'?'Counter-attacks created the best chances after defending deep.':home.tactic==='wide'?'Width stretched them, but crosses needed more bodies in the box.':'Balanced shape kept the team compact.';
 const nextStep=dominantSide==='away'?`Improve ${dominantLine==='ATT'?'your attack':dominantLine==='MID'?'your midfield':'your defence'} or lower the opponent's edge in that line.`:'Keep this shape and train the line that created the chances.';
 return {home,away,seed:session.seed,score,possession,shots,onTarget,events,path:session.path,lineups:{home:session.home.slots??[],away:session.away.slots??[]},ratings:{home:ratingFor('home'),away:ratingFor('away')},playerRatings:{home:rateSide(home,'home'),away:rateSide(away,'away')},explanation:{dominantLine,dominantSide,chancesFrom,concededBecause,tacticNote,nextStep}};
}
export function simulateClubMatch(home:ClubTeam,away:ClubTeam,seed:number):ClubMatchReport{
 let session=createLiveMatch(home,away,seed);
 while(!session.finished)session=advanceLiveMatch(session);
 return liveMatchReport(session);
}
export function summarizeMatch(report:ClubMatchReport){
 const [home,away]=report.score,winner=home>away?report.home.name:away>home?report.away.name:null;
 return {headline:winner?`${winner} win ${Math.max(home,away)}–${Math.min(home,away)}`:`Draw ${home}–${away}`,possessionReport:`${Math.round(report.possession[0])}% – ${Math.round(report.possession[1])}%`,shotsReport:`${report.shots[0]} (${report.onTarget[0]} on target) – ${report.shots[1]} (${report.onTarget[1]} on target)`};
}
