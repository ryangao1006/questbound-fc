import {clubRatings,type ClubState} from './club-state.ts';
import {scoutCap,signingPrice,worldPlayerOvr} from './club-transfers.ts';
import type {FootballRosterPlayer} from './football-data.ts';
import {clubIndex,matchesScoutingFilters,type RosterClub,type ScoutingFilters} from './club-scouting-filters.ts';

/**
 * Scouting recommendations (PLAN 3.5 "推荐名单").
 * Pure rules: which line needs work, what the club can afford, and which real
 * players fit the scout centre's cap. No storage, no clock, no randomness.
 */
export type ClubLine='DEF'|'MID'|'ATT'|'GK';
export type ScoutingNeed={line:ClubLine;rating:number;gap:number;target:number};
export type ScoutingRecommendation={
 id:string;name:string;position:string;ovr:number;price:number;line:ClubLine;
 reason:'weakest-line'|'upgrade'|'depth'|'affordable';
 score:number;
};
export type ScoutingPlan={
 needs:ScoutingNeed[];
 weakest:ClubLine;
 budget:number;
 scoutCap:number;
 squadSize:number;
 recommendations:ScoutingRecommendation[];
 note:string;
};
const TARGET_RATING=72;
const LINE_GROUPS:Record<Exclude<ClubLine,'GK'>,string[]>={DEF:['CB','LB','RB'],MID:['DM','CM','AM','LM','RM'],ATT:['ST','LW','RW']};
function lineOf(position:string):ClubLine{
 if(position==='GK')return 'GK';
 if(LINE_GROUPS.DEF.includes(position))return 'DEF';
 if(LINE_GROUPS.MID.includes(position))return 'MID';
 return 'ATT';
}
export function scoutingNeeds(club:ClubState):ScoutingNeed[]{
 const ratings=clubRatings(club),lines:(Exclude<ClubLine,'GK'>)[]=['DEF','MID','ATT'];
 return lines.map(line=>({line,rating:ratings[line],gap:Math.max(0,Math.round((TARGET_RATING-ratings[line])*10)/10),target:TARGET_RATING}))
  .sort((a,b)=>b.gap-a.gap||a.line.localeCompare(b.line));
}
export function weakestLine(club:ClubState):ClubLine{return scoutingNeeds(club)[0].line}
export function scoutingPlan(club:ClubState,roster:readonly FootballRosterPlayer[],budget:number,options:{limit?:number;occupied?:Iterable<string>;clubs?:readonly RosterClub[];filters?:ScoutingFilters}={}):ScoutingPlan{
 const limit=Math.max(1,Math.min(10,options.limit??5)),occupied=new Set(options.occupied??[]),cap=scoutCap(club.facilities.scoutCentre);
 const needs=scoutingNeeds(club),weak=needs[0].line,ratings=clubRatings(club);
 const starters=new Set(club.lineup);
 const index=options.clubs?clubIndex(options.clubs):null;
 const candidates=roster.filter(player=>!occupied.has(player.id)&&!club.players.some(entry=>entry.id===player.id)&&(!index||!options.filters||matchesScoutingFilters(player,index,options.filters)));
 const recommended:ScoutingRecommendation[]=[];
 for(const player of candidates){
  const ovr=worldPlayerOvr(player),line=lineOf(player.position);
  if(ovr>cap)continue;
  const price=signingPrice(ovr),upgrade=ovr-ratings[line];
  const weakestBonus=line===weak?6:0;
  const affordability=budget>=price?4:0;
  const depthBonus=line===weak&&ovr>=ratings[line]?2:0;
  const score=upgrade*3+weakestBonus+depthBonus+affordability+(price>0?Math.min(3,6000/price):0);
  const reason:ScoutingRecommendation['reason']=line===weak&&upgrade>0?'weakest-line':upgrade>=3?'upgrade':budget>=price?'affordable':'depth';
  recommended.push({id:player.id,name:player.name,position:player.position,ovr,price,line,reason,score});
 }
 recommended.sort((a,b)=>b.score-a.score||b.ovr-a.ovr||a.price-b.price||a.id.localeCompare(b.id));
 const top=recommended.slice(0,limit);
 const note=budget>=top[0]?.price?`${weak} is the weakest line (${ratings[weak].toFixed(1)}); the first pick fits the budget.`:`${weak} is the weakest line (${ratings[weak].toFixed(1)}); the first pick is ${top[0]?top[0].price.toLocaleString():'unavailable'} FC and the budget is ${budget.toLocaleString()} FC.`;
 return {needs,weakest:weak,budget,scoutCap:cap,squadSize:club.players.length,recommendations:top,note};
}
export function recommendationLabel(plan:ScoutingPlan,line:{DEF:string;MID:string;ATT:string;GK:string}){return line[plan.weakest]}
