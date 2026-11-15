import type {FootballAttributes,FootballGoalkeeperAttributes,FootballPosition} from './football-data.ts';
import {overall,rookieAttributes} from './football-engine/stats-v1.ts';

/**
 * Club domain for the manager pivot (PLAN.md). Pure data and maths only:
 * nothing here reads or writes the planner document, and nothing is persisted yet.
 */
export type ClubLine='DEF'|'MID'|'ATT'|'GK';
export type ClubFormation='4-4-2'|'4-3-3'|'4-2-3-1';
export type ClubPlayer={
 id:string;name:string;position:FootballPosition;number:number;foot:'left'|'right';
 attributes:FootballAttributes;goalkeeper:FootballGoalkeeperAttributes;
 origin:'initial'|'signed';ovr:number;
 /** Condition and injuries (optional so old documents load as fully fit). */
 fitness?:number;injuryMatches?:number;
};
export type FormationSlot={line:ClubLine;position:FootballPosition};
export type LineRatings={DEF:number;MID:number;ATT:number;GK:number;overall:number};
export const CLUB_FORMATIONS:Record<ClubFormation,FormationSlot[]>={
 '4-4-2':[{line:'GK',position:'GK'},{line:'DEF',position:'LB'},{line:'DEF',position:'CB'},{line:'DEF',position:'CB'},{line:'DEF',position:'RB'},{line:'MID',position:'CM'},{line:'MID',position:'CM'},{line:'MID',position:'AM'},{line:'MID',position:'AM'},{line:'ATT',position:'ST'},{line:'ATT',position:'ST'}],
 '4-3-3':[{line:'GK',position:'GK'},{line:'DEF',position:'LB'},{line:'DEF',position:'CB'},{line:'DEF',position:'CB'},{line:'DEF',position:'RB'},{line:'MID',position:'DM'},{line:'MID',position:'CM'},{line:'MID',position:'CM'},{line:'ATT',position:'LW'},{line:'ATT',position:'ST'},{line:'ATT',position:'RW'}],
 '4-2-3-1':[{line:'GK',position:'GK'},{line:'DEF',position:'LB'},{line:'DEF',position:'CB'},{line:'DEF',position:'CB'},{line:'DEF',position:'RB'},{line:'MID',position:'DM'},{line:'MID',position:'DM'},{line:'MID',position:'AM'},{line:'MID',position:'AM'},{line:'MID',position:'AM'},{line:'ATT',position:'ST'}],
};
export const LINE_WEIGHTS:Record<Exclude<ClubLine,'GK'>,[keyof FootballAttributes,number][]>={
 ATT:[['sho',.40],['dri',.25],['pac',.15],['pas',.15],['phy',.05]],
 MID:[['pas',.45],['dri',.30],['pac',.10],['phy',.10],['def',.05]],
 DEF:[['def',.55],['phy',.20],['pac',.10],['pas',.10],['dri',.05]],
};
const COMPATIBLE:Record<FootballPosition,FootballPosition[]>={
 GK:[],CB:['DM','LB','RB'],LB:['RB','CB','LW'],RB:['LB','CB','RW'],DM:['CM','CB'],CM:['DM','AM'],
 AM:['CM','LW','RW','ST'],LW:['RW','AM','ST'],RW:['LW','AM','ST'],ST:['LW','RW','AM'],
};
export const POSITION_FIT={exact:1,compatible:.95,unsuitable:.85} as const;

export function lineOf(position:FootballPosition):ClubLine{
 if(position==='GK')return 'GK';
 if(position==='CB'||position==='LB'||position==='RB')return 'DEF';
 if(position==='DM'||position==='CM'||position==='AM')return 'MID';
 return 'ATT';
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const round1=(value:number)=>Math.round(value*10)/10;

export function positionFit(actual:FootballPosition,wanted:FootballPosition){
 if(actual===wanted)return POSITION_FIT.exact;
 return COMPATIBLE[wanted]?.includes(actual)?POSITION_FIT.compatible:POSITION_FIT.unsuitable;
}
export function lineRating(player:ClubPlayer,line:ClubLine){
 if(line==='GK')return overall('GK',player.goalkeeper);
 const weights=LINE_WEIGHTS[line];
 return clamp(weights.reduce((sum,[key,weight])=>sum+player.attributes[key]*weight,0),1,99);
}
export function playerRatingInSlot(player:ClubPlayer,slot:FormationSlot){
 const fit=positionFit(player.position,slot.position);
 return clamp(lineRating(player,slot.line)*fit,1,99);
}
/** Starters must be supplied in formation slot order. */
export function lineRatings(starters:(ClubPlayer|undefined)[],formation:ClubFormation):LineRatings{
 const slots=CLUB_FORMATIONS[formation];
 const buckets:{DEF:number[];MID:number[];ATT:number[];GK:number[]}={DEF:[],MID:[],ATT:[],GK:[]};
 slots.forEach((slot,index)=>{
  const player=starters[index];
  if(!player)return;
  if(slot.line==='GK'){if(player.position!=='GK')return;buckets.GK.push(overall('GK',player.goalkeeper));return}
  buckets[slot.line].push(lineRating(player,slot.line)*positionFit(player.position,slot.position));
 });
 const average=(values:number[])=>values.length?round1(values.reduce((sum,value)=>sum+value,0)/values.length):0;
 const DEF=average(buckets.DEF),MID=average(buckets.MID),ATT=average(buckets.ATT),GK=average(buckets.GK);
 return {DEF,MID,ATT,GK,overall:round1(DEF*.3+MID*.3+ATT*.3+GK*.1)};
}
export function levelForXp(xp:number){return 1+Math.floor(Math.max(0,xp)/100)}
export function xpForLevel(level:number){return Math.max(0,(level-1)*100)}
/** PLAN.md 3.3: price of the next point at the current attribute value. */
export function trainingPrice(current:number){
 if(current>=99)return null;
 if(current<70)return 20;
 if(current<80)return 40;
 if(current<90)return 60;
 if(current<95)return 100;
 return 160;
}
/** Training-centre level caps (1-5). */
export const TRAINING_CENTRE_CAPS=[69,74,79,89,99] as const;
export function trainingCap(centreLevel:number){return TRAINING_CENTRE_CAPS[clamp(Math.round(centreLevel),1,5)-1]}
export type TrainingQuote={attribute:keyof FootballAttributes;from:number;to:number;price:number;blocked:string|null};
export function quoteTraining(player:ClubPlayer,attribute:keyof FootballAttributes,centreLevel=1):TrainingQuote{
 const from=player.attributes[attribute],price=trainingPrice(from),cap=trainingCap(centreLevel);
 if(price===null)return {attribute,from,to:from,price:0,blocked:'Already at the maximum.'};
 if(from>=cap)return {attribute,from,to:from,price,blocked:'The training centre caps this attribute.'};
 return {attribute,from,to:from+1,price,blocked:null};
}
export function trainPlayer(player:ClubPlayer,attribute:keyof FootballAttributes,centreLevel=1):ClubPlayer{
 const quote=quoteTraining(player,attribute,centreLevel);
 if(quote.blocked)return player;
 const next={...player,attributes:{...player.attributes,[attribute]:quote.to}};
 return {...next,ovr:overall(next.position,{...next.attributes,...next.goalkeeper})};
}

/* ---------- deterministic initial squad ---------- */
function rng(seed:number){let state=seed>>>0||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296}}
const FIRST=['Ari','Bram','Cato','Dima','Eli','Fenn','Gio','Hale','Ivo','Jae','Kai','Lior','Mika','Nero','Odin','Pax','Quin','Rui','Sol','Taro','Umi','Vale','Wren','Yuri','Zane'];
const LAST=['Abara','Bexley','Corran','Dax','Ellery','Farrow','Gareth','Hollis','Ives','Juno','Kellen','Lark','Marlow','Nyx','Orrin','Pell','Quill','Rook','Sayer','Thane','Ulric','Vesper','Ward','Yarrow','Zorik'];
const SQUAD_PLAN:{position:FootballPosition;count:number}[]=[
 {position:'GK',count:2},{position:'CB',count:3},{position:'LB',count:2},{position:'RB',count:2},
 {position:'DM',count:2},{position:'CM',count:3},{position:'AM',count:2},{position:'LW',count:2},{position:'RW',count:2},
];
const SHIRT_ORDER:FootballPosition[]=['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'];

export function generateInitialSquad(seed=20261114):ClubPlayer[]{
 const random=rng(seed),players:ClubPlayer[]=[];
 let shirt=1;
 for(const entry of SQUAD_PLAN){
  for(let index=0;index<entry.count;index+=1){
   const target=56+Math.floor(random()*7); // 56-62
   const baseline=rookieAttributes(entry.position);
   const baseOvr=overall(entry.position,baseline);
   const scale=target/Math.max(1,baseOvr);
   const attributes=Object.fromEntries(Object.entries(baseline).map(([key,value])=>[key,clamp(Math.round(value*scale+(random()-.5)*4),20,99)])) as FootballAttributes;
   const goalkeeper=Object.fromEntries(Object.entries(baseline).filter(([key])=>['diving','handling','kicking','reflexes','speed','positioning'].includes(key)).map(([key,value])=>[key,clamp(Math.round(value*scale+(random()-.5)*4),20,99)])) as FootballGoalkeeperAttributes;
   const name=`${FIRST[Math.floor(random()*FIRST.length)]} ${LAST[Math.floor(random()*LAST.length)]}`;
   const player:ClubPlayer={id:`initial-${shirt}-${entry.position.toLowerCase()}`,name,position:entry.position,number:shirt,foot:random()<.24?'left':'right',attributes,goalkeeper,origin:'initial',ovr:overall(entry.position,{...attributes,...goalkeeper})};
   players.push(player);shirt+=1;
  }
 }
 return players;
}
/** Sort a squad into a formation: keepers first, then the best fitting player per slot. */
export function autoPick(starters:ClubPlayer[],formation:ClubFormation){
 const slots=CLUB_FORMATIONS[formation],used=new Set<string>(),picked:(ClubPlayer|undefined)[]=[];
 for(const slot of slots){
  const candidate=starters.filter(player=>!used.has(player.id)&&(slot.line!=='GK'||player.position==='GK'))
   .sort((a,b)=>lineRating(b,slot.line)*positionFit(b.position,slot.position)-lineRating(a,slot.line)*positionFit(a.position,slot.position)||a.id.localeCompare(b.id))[0];
  if(candidate){used.add(candidate.id);picked.push(candidate)}else picked.push(undefined);
 }
 return picked;
}
export function squadNumbers(players:ClubPlayer[]){return [...new Set(players.map(player=>player.number))].length===players.length}
export {SHIRT_ORDER};
