import type {ClubState} from './club-state.ts';
import {CLUB_FORMATIONS,type ClubFormation} from './club-model.ts';
import type {FootballPosition} from './football-data.ts';

/**
 * Formation slots for the 11-a-side match model (PLAN 3.6 / stage 2).
 * Coordinates are on the 105 × 68 pitch with the home side attacking +x.
 * A slot only decides where a player stands; it does not simulate collisions.
 */
export type SlotRole='GK'|'DEF'|'MID'|'ATT';
export type PitchSlot={role:SlotRole;x:number;y:number};
export type LineupSlot={id:string;name:string;position:FootballPosition;role:SlotRole;x:number;y:number};
export type FormationName=ClubFormation;

const PITCH_SLOTS:Record<FormationName,[number,number][]>={
 '4-3-3':[[5,34],[22,8],[18,27],[18,41],[22,60],[45,20],[45,34],[45,48],[78,12],[84,34],[78,56]],
 '4-4-2':[[5,34],[20,8],[16,27],[16,41],[20,60],[46,8],[44,26],[44,42],[46,60],[80,28],[80,40]],
 '4-2-3-1':[[5,34],[20,8],[16,27],[16,41],[20,60],[38,27],[38,41],[58,12],[58,34],[58,56],[84,34]],
};
/** Slot roles and coordinates for a formation, in the same order as CLUB_FORMATIONS. */
export function formationSlots(formation:FormationName):PitchSlot[]{
 const definitions=CLUB_FORMATIONS[formation]??CLUB_FORMATIONS['4-3-3'],points=PITCH_SLOTS[formation]??PITCH_SLOTS['4-3-3'];
 return definitions.map((definition,index)=>({role:definition.line,x:points[index]?.[0]??50,y:points[index]?.[1]??34})) as PitchSlot[];
}
const GROUP:Record<SlotRole,string[]>={
 GK:['GK'],
 DEF:['CB','LB','RB','DM'],
 MID:['DM','CM','AM','LM','RM'],
 ATT:['ST','LW','RW','AM','CM'],
};
function groupOf(position:FootballPosition):SlotRole{
 if(position==='GK')return 'GK';
 if(['CB','LB','RB'].includes(position))return 'DEF';
 if(['DM','CM','AM'].includes(position))return 'MID';
 return 'ATT';
}
/** Assign the saved starting XI to formation slots by role, keeping slot order deterministic. */
export function lineupSlots(formation:FormationName, players:{id:string;name:string;position:FootballPosition}[]):LineupSlot[]{
 const slots=formationSlots(formation);
 const used=new Set<string>(),result:LineupSlot[]=[];
 const pick=(role:SlotRole,index:number):{id:string;name:string;position:FootballPosition}|undefined=>{
  const preferred=players.filter(player=>!used.has(player.id)&&groupOf(player.position)===role);
  const candidates=preferred.length?preferred:players.filter(player=>!used.has(player.id));
  return candidates[index%Math.max(1,candidates.length)];
 };
 for(const slot of slots){
  const chosen=pick(slot.role,result.filter(entry=>entry.role===slot.role).length);
  if(!chosen)continue;
  used.add(chosen.id);
  result.push({id:chosen.id,name:chosen.name,position:chosen.position,role:slot.role,x:slot.x,y:slot.y});
 }
 return result;
}
/** Formation-aware slots for a saved club, falling back to the current formation. */
export function clubSlots(club:ClubState,lineup:readonly string[]=club.lineup):LineupSlot[]{
 const byId=new Map(club.players.map(player=>[player.id,player]));
 const starters=lineup.map(id=>byId.get(id)).filter((player):player is NonNullable<typeof player>=>Boolean(player));
 return lineupSlots(club.formation,starters.map(player=>({id:player.id,name:player.name,position:player.position})));
}
/** Cheap opponent line-up: a symmetric formation from the opponent's tactic name. */
export function opponentSlots(name:string,formation:FormationName='4-4-2',side:'home'|'away'='away'):LineupSlot[]{
 const slots=formationSlots(formation);
 return slots.map((slot,index)=>{
  const mirror=side==='away'?105-slot.x:slot.x;
  const roleName=slot.role==='GK'?'GK':slot.role==='DEF'?'defender':slot.role==='MID'?'midfielder':'forward';
  return {id:`${name}-${index}`,name:`${name} ${roleName}`,position:(slot.role==='GK'?'GK':slot.role==='DEF'?'CB':slot.role==='MID'?'CM':'ST') as FootballPosition,role:slot.role,x:mirror,y:slot.y};
 });
}
export const FORMATION_GROUP=GROUP;
