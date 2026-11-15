import {PREMIER_LEAGUE_CLUBS} from './football-data.ts';
import {teamFromClub,type ClubTeam} from './club-match.ts';
import type {MatchV2Report} from './match-v2.ts';
import {simulateClubMatchV2} from './match-v2.ts';
import type {ClubState} from './club-state.ts';

/**
 * Fictional four-club challenge cup (PLAN 3.6): two semi-finals and a final, with
 * real clubs from the versioned directory used only as fictional opponents.
 * Explicitly a game event, not a claim about a real fixture list.
 */
export type CupTier=0|1|2|3;
export type CupTeam={id:string;name:string;shortName:string;lines:ClubTeam['lines'];tactic:ClubTeam['tactic'];realClubId?:string};
export type CupMatch={round:1|2;home:string;away:string;score?:[number,number];pens?:[number,number]};
export type ClubCup={id:string;tier:CupTier;seed:number;teams:CupTeam[];matches:CupMatch[];round:0|1|2;winner?:string;finished:boolean};
const PRESTIGE_BANDS:[number,number][]=[[60,68],[69,75],[76,82],[83,89]];
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function hash(text:string){let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0||1}
function random(seed:number){let state=seed>>>0||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296}}

const CLUB_TACTICS:ClubTeam['tactic'][]=['balanced','possession','counter','wide','press'];
function opponentFromPrestige(realClubId:string,name:string,shortName:string,prestige:number,randomValue:()=>number):CupTeam{
 const base=clamp(Math.round(52+prestige*0.38+randomValue()*4-2),50,95);
 const line=()=>clamp(base+Math.floor(randomValue()*7)-3,40,99);
 return {id:realClubId,name,shortName,lines:{DEF:line(),MID:line(),ATT:line(),GK:line()},tactic:CLUB_TACTICS[Math.floor(randomValue()*CLUB_TACTICS.length)],realClubId};
}
export function createCup(club:ClubState,tier:CupTier,seed:number,cupId:string):ClubCup{
 const randomValue=random(seed),[low,high]=PRESTIGE_BANDS[clamp(tier,0,3)];
 const pool=PREMIER_LEAGUE_CLUBS.filter(entry=>entry.prestige>=low&&entry.prestige<=high);
 const source=pool.length>=3?pool:PREMIER_LEAGUE_CLUBS;
 const picked=new Set<string>(),teams:CupTeam[]=[];
 const own=teamFromClub(club);
 teams.push({id:'club',name:own.name,shortName:own.shortName,lines:own.lines,tactic:own.tactic});
 while(teams.length<4){
  const clubEntry=source[Math.floor(randomValue()*source.length)];
  if(picked.has(clubEntry.id))continue;
  picked.add(clubEntry.id);
  teams.push(opponentFromPrestige(clubEntry.id,clubEntry.name,clubEntry.shortName,clubEntry.prestige,randomValue));
 }
 return {id:cupId,tier,seed,teams,matches:[{round:1,home:'club',away:teams[1].id},{round:1,home:teams[2].id,away:teams[3].id}],round:0,finished:false};
}
function seededReport(seasonSeed:string,home:ClubTeam,away:ClubTeam){return simulateClubMatchV2(home,away,hash(seasonSeed))}
export function playCupRound(club:ClubState,cup:ClubCup):{cup:ClubCup;report?:MatchV2Report;results:{home:string;away:string;score:[number,number]}[]}{
 if(cup.finished)throw new Error('This cup is already finished.');
 const own=teamFromClub(club);
 const build=(team:CupTeam):ClubTeam=>({name:team.name,shortName:team.shortName,lines:team.lines,tactic:team.tactic,scorers:{ATT:[`${team.name} forward`],MID:[`${team.name} midfielder`],DEF:[`${team.name} defender`]}});
 const side=(id:string)=>id==='club'?own:build(cup.teams.find(team=>team.id===id)!);
 const results:{home:string;away:string;score:[number,number]}[]=[];let report:MatchV2Report|undefined;
 const matches=cup.matches.map(match=>({...match}));
 const pending=matches.filter(match=>match.score===undefined);
 const round=(pending[0]?.round??1) as 1|2;
 const current=pending.filter(match=>match.round===round);
 for(const match of current){
  const sim=seededReport(`${cup.seed}:${cup.id}:${round}:${match.home}:${match.away}`,side(match.home),side(match.away));
  match.score=sim.score;
  if(match.home==='club'||match.away==='club')report=sim;
  results.push({home:match.home,away:match.away,score:sim.score});
 }
 const shootout=(match:CupMatch):[number,number]|null=>{
  const [homeGoals,awayGoals]=match.score!;
  if(homeGoals!==awayGoals)return null;
  let home=3+hash(`${cup.seed}:${match.home}:pen`)%3,away=3+hash(`${cup.seed}:${match.away}:pen`)%3,round=0;
  if(home===away){const bonus=hash(`${cup.seed}:${match.home}:${match.away}:sd`);home=away+1+(bonus%2)}
  void round;
  return [home,away];
 };
 const winnerOf=(match:CupMatch)=>{
  const [homeGoals,awayGoals]=match.score!;
  if(homeGoals!==awayGoals)return homeGoals>awayGoals?match.home:match.away;
  const pens=shootout(match);
  if(pens)match.pens=pens;
  return (pens?.[0]??0)>=(pens?.[1]??0)?match.home:match.away;
 };
 if(round===1){
  const semiWinners=current.map(winnerOf);
  const final:CupMatch={round:2,home:semiWinners[0],away:semiWinners[1]};
  return {cup:{...cup,matches:[...matches,final],round:1},report,results};
 }
 const final=current[0],winner=winnerOf(final);
 return {cup:{...cup,matches,round:2,winner,finished:true},report,results};
}
export function cupTeam(cup:ClubCup,id:string){return cup.teams.find(team=>team.id===id)}
export function cupOutcomeLabel(cup:ClubCup){if(!cup.finished)return null;return cup.winner==='club'?'won':'lost'}
