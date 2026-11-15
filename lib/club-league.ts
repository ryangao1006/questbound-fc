import {opponentFor,teamFromClub,type ClubTeam} from './club-match.ts';
import {simulateClubMatchV2} from './match-v2.ts';
import type {MatchV2Report} from './match-v2.ts';
import type {ClubState} from './club-state.ts';

/**
 * Four-tier league (PLAN 3.6): eight clubs, a double round-robin of fourteen
 * rounds, promotion for the top two and relegation for the bottom two. Every
 * fixture is simulated by the same seeded manager-match model as friendlies.
 */
export type LeagueTier=0|1|2|3;
export const LEAGUE_TIERS:LeagueTier[]=[0,1,2,3];
export const TIER_LABELS=['Rookie','Rising','Contender','Elite'] as const;
export const TIER_OVR=[55,62,70,78] as const;
export type LeagueTeam={id:string;name:string;shortName:string;lines:{DEF:number;MID:number;ATT:number;GK:number};tactic:ClubTeam['tactic']};
export type LeagueFixture={round:number;home:string;away:string};
export type LeagueRow={teamId:string;played:number;won:number;drawn:number;lost:number;gf:number;ga:number;points:number};
export type ClubSeason={id:string;tier:LeagueTier;round:number;seed:number;teams:LeagueTeam[];fixtures:LeagueFixture[];table:LeagueRow[];finished:boolean;matches:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function hash(text:string){let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0||1}

function roundRobin(ids:string[]):{home:string;away:string}[][]{
 const list=[...ids],rounds:{home:string;away:string}[][]=[],size=list.length;
 for(let round=0;round<size-1;round+=1){
  const pairs:{home:string;away:string}[]=[];
  for(let index=0;index<size/2;index+=1){
   const first=list[index],second=list[size-1-index];
   pairs.push(index%2===0?{home:first,away:second}:{home:second,away:first});
  }
  rounds.push(pairs);
  list.splice(1,0,list.pop()!);
 }
 return rounds;
}

export function createSeason(club:ClubState,tier:LeagueTier,seed:number,seasonId:string):ClubSeason{
 const opponents:LeagueTeam[]=[];
 for(let index=0;index<7;index+=1){
  const team=opponentFor(tier,seed,index);
  opponents.push({id:`opp-${index}`,name:team.name,shortName:team.shortName,lines:team.lines,tactic:team.tactic});
 }
 const own=teamFromClub(club);
 const self:LeagueTeam={id:'club',name:own.name,shortName:own.shortName,lines:own.lines,tactic:own.tactic};
 const teams=[self,...opponents];
 const first=roundRobin(teams.map(team=>team.id));
 const fixtures:LeagueFixture[]=[];
 for(const [index,pairs] of [...first,...first].entries()){
  const round=index+1;
  for(const pair of pairs)fixtures.push({round,home:index<7?pair.home:pair.away,away:index<7?pair.away:pair.home});
 }
 return {id:seasonId,tier,round:0,seed,teams,fixtures,table:teams.map(team=>({teamId:team.id,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,points:0})),finished:false,matches:0};
}

function applyResult(table:LeagueRow[],home:string,away:string,homeGoals:number,awayGoals:number){
 const homeRow=table.find(row=>row.teamId===home),awayRow=table.find(row=>row.teamId===away);
 if(!homeRow||!awayRow)return;
 homeRow.played+=1;awayRow.played+=1;
 homeRow.gf+=homeGoals;homeRow.ga+=awayGoals;awayRow.gf+=awayGoals;awayRow.ga+=homeGoals;
 if(homeGoals>awayGoals){homeRow.won+=1;awayRow.lost+=1;homeRow.points+=3}
 else if(homeGoals<awayGoals){awayRow.won+=1;homeRow.lost+=1;awayRow.points+=3}
 else {homeRow.drawn+=1;awayRow.drawn+=1;homeRow.points+=1;awayRow.points+=1}
}
export function sortTable(table:LeagueRow[]){return [...table].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf||a.teamId.localeCompare(b.teamId))}

export function playSeasonRound(club:ClubState,season:ClubSeason):{season:ClubSeason;report?:MatchV2Report;results:{home:string;away:string;score:[number,number]}[]}{
 if(season.finished)throw new Error('This season is already finished.');
 const nextRound=season.round+1;
 const fixtures=season.fixtures.filter(fixture=>fixture.round===nextRound);
 if(!fixtures.length)throw new Error('This season has no further fixtures.');
 const own=teamFromClub(club),results:{home:string;away:string;score:[number,number]}[]=[];let report:MatchV2Report|undefined;
 const table=season.table.map(row=>({...row}));
 for(const fixture of fixtures){
  const homeTeam=season.teams.find(team=>team.id===fixture.home)!,awayTeam=season.teams.find(team=>team.id===fixture.away)!;
  const home=fixture.home==='club'?own:{...homeTeam,scorers:{ATT:[`${homeTeam.name} forward`],MID:[`${homeTeam.name} midfielder`],DEF:[`${homeTeam.name} defender`]}};
  const away=fixture.away==='club'?own:{...awayTeam,scorers:{ATT:[`${awayTeam.name} forward`],MID:[`${awayTeam.name} midfielder`],DEF:[`${awayTeam.name} defender`]}};
  const sim=simulateClubMatchV2(home,away,hash(`${season.seed}:${season.id}:${nextRound}:${fixture.home}:${fixture.away}`));
  if(fixture.home==='club'||fixture.away==='club')report=sim;
  applyResult(table,fixture.home,fixture.away,sim.score[0],sim.score[1]);
  results.push({home:fixture.home,away:fixture.away,score:sim.score});
 }
 const finished=nextRound>=Math.max(...season.fixtures.map(fixture=>fixture.round));
 return {season:{...season,round:nextRound,table:sortTable(table),finished,matches:season.matches+1},report,results};
}
export type SeasonOutcome={status:'promoted'|'relegated'|'stayed';position:number;nextTier:LeagueTier};
export function seasonOutcome(season:ClubSeason):SeasonOutcome{
 const sorted=sortTable(season.table),position=sorted.findIndex(row=>row.teamId==='club')+1;
 if(position<=2&&season.tier<3)return {status:'promoted',position,nextTier:(season.tier+1) as LeagueTier};
 if(position>=7&&season.tier>0)return {status:'relegated',position,nextTier:(season.tier-1) as LeagueTier};
 return {status:'stayed',position,nextTier:season.tier};
}
export function ownRow(season:ClubSeason){return season.table.find(row=>row.teamId==='club')}
export function tierForLevel(level:number):LeagueTier{return clamp(Math.floor((level-1)/4),0,3) as LeagueTier}
