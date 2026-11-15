import {CLUB_FORMATIONS,lineOf,type ClubFormation,type ClubPlayer} from './club-model.ts';
import {setClubLineup,type ClubState} from './club-state.ts';

/**
 * Player condition, injuries and the assistant (PLAN 3.6): starters lose fitness
 * after a match, the bench recovers, a small deterministic injury chance exists,
 * and the default assistant keeps the eleven legal and can auto-substitute.
 * All rules are pure and deterministic; the UI only reads them.
 */
export type ClubAssistant={autoSquad:boolean};
export const DEFAULT_ASSISTANT:ClubAssistant={autoSquad:true};
export const FITNESS_MAX=100;
export const FITNESS_UNAVAILABLE=35;
function hash(text:string){let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0||1}
function rng(seed:number){let state=(seed>>>0)||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296}}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function fitnessOf(player:ClubPlayer){return clamp(Math.round(player.fitness??FITNESS_MAX),0,FITNESS_MAX)}
export function injuryMatchesOf(player:ClubPlayer){return Math.max(0,Math.round(player.injuryMatches??0))}
export function isInjured(player:ClubPlayer){return injuryMatchesOf(player)>0}
export function isAvailable(player:ClubPlayer){return !isInjured(player)&&fitnessOf(player)>=FITNESS_UNAVAILABLE}
export function assistantOf(club:ClubState):ClubAssistant{return {...DEFAULT_ASSISTANT,...(club.assistant??{})}}
export type ConditionReport={available:number;injured:number;tired:number;startersAvgFitness:number};
export function conditionReport(club:ClubState):ConditionReport{
 const players=club.players,starters=players.filter(player=>club.lineup.includes(player.id));
 return {available:players.filter(isAvailable).length,injured:players.filter(isInjured).length,tired:players.filter(player=>!isInjured(player)&&fitnessOf(player)<FITNESS_UNAVAILABLE).length,startersAvgFitness:starters.length?Math.round(starters.reduce((sum,player)=>sum+fitnessOf(player),0)/starters.length):0};
}
/** Play a match: drain the eleven, recover the rest, roll deterministic injuries. */
export function afterMatch(club:ClubState,playedIds:readonly string[],seed:string):ClubState{
 const random=rng(hash(seed)),played=new Set(playedIds);
 const players=club.players.map(player=>{
  const fitness=fitnessOf(player),injury=injuryMatchesOf(player);
  if(played.has(player.id)){
   const lost=6+Math.round(random()*6);
   const nextFitness=clamp(fitness-lost,0,FITNESS_MAX);
   const injuryChance=nextFitness<55?0.1:0.025;
   if(injury===0&&random()<injuryChance)return {...player,fitness:20,injuryMatches:1+Math.floor(random()*3)};
   return {...player,fitness:nextFitness,injuryMatches:injury};
  }
  return {...player,fitness:clamp(fitness+12+Math.round(random()*8),0,FITNESS_MAX),injuryMatches:Math.max(0,injury-1)};
 });
 return {...club,players};
}
/** Best legal eleven from the players who can actually play. */
export function pickLegalLineup(club:ClubState,formation:ClubFormation=club.formation):string[]{
 const available=club.players.filter(isAvailable);
 const rest=club.players.filter(player=>!isAvailable(player)).sort((a,b)=>injuryMatchesOf(a)-injuryMatchesOf(b)||fitnessOf(b)-fitnessOf(a)||b.ovr-a.ovr);
 const pool=[...available,...rest];
 const byOvr=(a:ClubPlayer,b:ClubPlayer)=>Number(isAvailable(b))-Number(isAvailable(a))||b.ovr-a.ovr||a.name.localeCompare(b.name);
 const picks:string[]=[],used=new Set<string>();
 const take=(candidates:ClubPlayer[])=>{const player=candidates.find(entry=>!used.has(entry.id));if(!player)return undefined;used.add(player.id);picks.push(player.id);return player};
 // one keeper
 take(pool.filter(player=>player.position==='GK').sort(byOvr))??take(available.filter(player=>player.position==='GK').sort(byOvr));
 // one player per outfield slot line
 const slots=CLUB_FORMATIONS[formation]??CLUB_FORMATIONS['4-3-3'];
 for(const slot of slots){
  if(slot.line==='GK')continue;
  take(pool.filter(player=>player.position!=='GK'&&lineOf(player.position)===slot.line).sort(byOvr));
 }
 // fill any remaining places from the best available players
 for(const player of [...available].sort(byOvr))if(picks.length<11&&!used.has(player.id)){used.add(player.id);picks.push(player.id)}
 for(const player of rest)if(picks.length<11&&!used.has(player.id)){used.add(player.id);picks.push(player.id)}
 return picks.slice(0,11);
}
/** Keep the saved eleven legal; with the assistant on, injured/tired players are replaced. */
export function ensureLegalLineup(club:ClubState):{club:ClubState;changed:boolean}{
 const assistant=assistantOf(club);
 const current=club.lineup;
 const legal=current.length===11&&new Set(current).size===11&&current.every(id=>{const player=club.players.find(entry=>entry.id===id);return player?player.position==='GK'?true:true:false})&&current.filter(id=>club.players.find(player=>player.id===id)?.position==='GK').length===1;
 const allAvailable=current.every(id=>{const player=club.players.find(entry=>entry.id===id);return player?isAvailable(player):false});
 if(legal&&(allAvailable||!assistant.autoSquad))return {club,changed:false};
 const next=setClubLineup(club,club.formation,pickLegalLineup(club));
 return {club:next,changed:true};
}
