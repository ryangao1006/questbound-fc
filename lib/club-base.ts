import type {ClubState} from './club-state.ts';

/**
 * Base visuals and rooms (PLAN 3.7). Pure derivation from the saved club so the
 * 3D base can render buildings that reflect real facility levels and honours.
 */
export type BaseRoomId='training'|'tactics'|'dressing'|'stadium'|'trophies'|'transfers'|'league'|'cup';
export type BaseRoom={
 id:BaseRoomId;label:string;labelZh:string;href:string;x:number;z:number;
 building:'pitch'|'office'|'dressing'|'stadium'|'trophy'|'gate';
 level:number;status:string;accent:[string,string];
};
export type BaseVisuals={
 rooms:BaseRoom[];
 stadium:{capacity:number;stands:number;floodlights:boolean;level:number};
 training:{cap:number;level:number;pitchLights:number};
 scout:{level:number;cap:number};
 trophyRoom:{trophies:number;kits:number;level:number};
 squad:{players:number;starters:number};
 theme:{primary:string;secondary:string};
};
const CAPS=[69,74,79,89,99];
const STADIUM_CAPACITY=[4200,7800,12000,18500,26000];
const TRAINING_CAP=[69,74,79,89,99];
function levelOf(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}
export function baseVisuals(club:ClubState):BaseVisuals{
 const primary=club.colours?.primary??'#2f6f4e',secondary=club.colours?.secondary??'#c8f56e';
 const trainingLevel=levelOf(club.facilities.trainingCentre,1,5);
 const scoutLevel=levelOf(club.facilities.scoutCentre,1,4);
 const stadiumLevel=levelOf(club.facilities.stadium,1,5);
 const trophies=club.trophies?.length??0,kits=(club.trophies??[]).filter(trophy=>trophy.kitId).length;
 const level=1+Math.floor(((club.trophies?.length??0)*0)); // reserved for future level wiring
 void level;
 const rooms:BaseRoom[]=[
  {id:'training',label:'Training ground',labelZh:'训练场',href:'/club#club-training',x:-13,z:4,building:'pitch',level:trainingLevel,status:`Lv ${trainingLevel} · cap ${TRAINING_CAP[trainingLevel-1]}`,accent:[primary,'#7fd18a']},
  {id:'tactics',label:'Tactics room',labelZh:'战术室',href:'/club#club-tactics',x:-4,z:-9,building:'office',level:Object.values(club.tactics.levels).reduce((sum,value)=>sum+value,0),status:`${club.tactics.active} · L${club.tactics.levels[club.tactics.active]??0}`,accent:[primary,secondary]},
  {id:'dressing',label:'Dressing room',labelZh:'更衣室',href:'/club#club-squad',x:5,z:8,building:'dressing',level:Math.ceil((club.players.length)/5),status:`${club.players.length} players`,accent:[secondary,primary]},
  {id:'stadium',label:'Stadium',labelZh:'球场',href:'/club#club-match',x:16,z:-4,building:'stadium',level:stadiumLevel,status:`Lv ${stadiumLevel} · ${STADIUM_CAPACITY[stadiumLevel-1].toLocaleString()} seats`,accent:[secondary,'#8fd7ff']},
  {id:'trophies',label:'Trophy room',labelZh:'荣誉室',href:'/club#club-honours',x:-16,z:-10,building:'trophy',level:Math.min(5,1+trophies),status:`${trophies} trophies · ${kits} kits`,accent:['#f4d08a','#c8f56e']},
  {id:'transfers',label:'Transfer office',labelZh:'转会办公室',href:'/club#club-transfers',x:12,z:11,building:'office',level:scoutLevel,status:`scout Lv ${scoutLevel} · cap ${[68,76,84,99][scoutLevel-1]}`,accent:['#a3e4bc',primary]},
  {id:'league',label:'League office',labelZh:'联赛办公室',href:'/club#club-league',x:2,z:-14,building:'office',level:club.season?club.season.tier+1:0,status:club.season?`tier ${club.season.tier+1} · round ${club.season.round}/14`:'no season yet',accent:['#8fd7ff',primary]},
  {id:'cup',label:'Cup room',labelZh:'杯赛室',href:'/club#club-cup',x:-8,z:13,building:'trophy',level:club.cup?((club.cup.finished?2:1)):0,status:club.cup?(club.cup.finished?'finished':'in progress'):'no cup yet',accent:['#f3d4ff','#8fd7ff']},
 ];
 return {rooms,stadium:{capacity:STADIUM_CAPACITY[stadiumLevel-1],stands:stadiumLevel,floodlights:stadiumLevel>=2,level:stadiumLevel},training:{cap:CAPS[trainingLevel-1],level:trainingLevel,pitchLights:trainingLevel},scout:{level:scoutLevel,cap:[68,76,84,99][scoutLevel-1]},trophyRoom:{trophies,kits,level:Math.min(5,1+trophies)},squad:{players:club.players.length,starters:club.lineup.length},theme:{primary,secondary}};
}
export function baseRoom(visuals:BaseVisuals,id:BaseRoomId){return visuals.rooms.find(room=>room.id===id)}
export function baseSceneBounds(){return {minX:-20,maxX:22,minZ:-16,maxZ:16}}
