import type {FootballRosterPlayer} from './football-data.ts';

/**
 * Scouting filters for the transfer list (PLAN 3.5 "按位置、能力和价格搜索，提供推荐名单").
 * Pure lookups over the versioned roster + club directory so the UI can offer
 * league, region and position filters without extra storage.
 */
export type RosterClub={id:string;league:string;country:string;name:string};
export type ScoutingFilters={league?:string;region?:string;position?:string};
export const SCOUTING_LEAGUES=[{id:'premier-league',label:'Premier League'},{id:'background',label:'Other leagues'}] as const;
export function clubIndex(clubs:readonly RosterClub[]):Map<string,RosterClub>{return new Map(clubs.map(club=>[club.id,club]))}
export function scoutingLeagues(clubs:readonly RosterClub[]){return [...new Set(clubs.map(club=>club.league))].sort().map(id=>({id,label:id==='premier-league'?'Premier League':id==='background'?'Other leagues':id}))}
export function scoutingRegions(clubs:readonly RosterClub[]){return [...new Set(clubs.map(club=>club.country))].sort().filter(Boolean).map(id=>({id,label:id}))}
export function playerLeague(player:Pick<FootballRosterPlayer,'clubId'>,index:Map<string,RosterClub>):string{return index.get(player.clubId)?.league??'unknown'}
export function playerRegion(player:Pick<FootballRosterPlayer,'clubId'>,index:Map<string,RosterClub>):string{return index.get(player.clubId)?.country??'unknown'}
export function matchesScoutingFilters(player:FootballRosterPlayer,index:Map<string,RosterClub>,filters:ScoutingFilters){
 if(filters.league&&playerLeague(player,index)!==filters.league)return false;
 if(filters.region&&playerRegion(player,index)!==filters.region)return false;
 if(filters.position&&player.position!==filters.position)return false;
 return true;
}
export function filterRoster<Player extends FootballRosterPlayer>(players:readonly Player[],clubs:readonly RosterClub[],filters:ScoutingFilters):Player[]{
 const index=clubIndex(clubs);
 return players.filter(player=>matchesScoutingFilters(player,index,filters));
}
export function scoutingFilterOptions(clubs:readonly RosterClub[]){return {leagues:scoutingLeagues(clubs),regions:scoutingRegions(clubs)}}
export function describeFilters(filters:ScoutingFilters):string{
 const parts=[filters.league&&(filters.league==='premier-league'?'Premier League':filters.league),filters.region,filters.position].filter(Boolean);
 return parts.length?parts.join(' · '):'All players';
}
