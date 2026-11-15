import type {ClubState,ClubTrophy} from './club-state.ts';

/**
 * Collectible kits (PLAN 3.7). Base home/away kits are always available; a cup
 * win or a league title adds a commemorative kit recorded on the trophy. Nothing
 * here charges, and old trophies without a kit id never gain one retroactively.
 */
export type KitItem={
 id:string;name:string;kind:'base'|'cup'|'league';tier:number|null;
 colours:[string,string];at:string|null;owned:boolean;selected:boolean;
};
const BASE_KITS:{id:string;name:string;colours:[string,string]}[]=[
 {id:'kit.home',name:'Home kit',colours:['#c8f56e','#12200a']},
 {id:'kit.away',name:'Away kit',colours:['#e8eef7','#1b2635']},
];
const PALETTES:{cup:[string,string][];league:[string,string][];base:[string,string][]}={
 cup:[['#f4d08a','#8a5a1f'],['#e8edf2','#6b7787'],['#9ad8ff','#1d4f75'],['#f3d4ff','#5b2a70']],
 league:[['#c8f56e','#2f4a12'],['#8fd7ff','#163f5c'],['#ffd479','#5a3d0f'],['#ffb3a7','#5c1f1a']],
 base:BASE_KITS.map(kit=>kit.colours),
};
export function kitForTrophy(trophy:ClubTrophy):KitItem|undefined{
 if(!trophy.kitId)return undefined;
 const palette=trophy.kind==='cup'?PALETTES.cup:PALETTES.league;
 const colours=palette[Math.min(3,Math.max(0,trophy.tier))];
 return {id:trophy.kitId,name:trophy.kind==='cup'?`${['Rookie','Rising','Contender','Elite'][Math.min(3,Math.max(0,trophy.tier))]} Cup kit`:`${['Rookie','Rising','Contender','Elite'][Math.min(3,Math.max(0,trophy.tier))]} champions kit`,kind:trophy.kind,tier:trophy.tier,colours,at:trophy.at,owned:true,selected:false};
}
export function collectibleKits(club:ClubState|undefined):KitItem[]{
 const selected=club?.display?.kit;
 const kits:KitItem[]=BASE_KITS.map(kit=>({...kit,kind:'base',tier:null,at:null,owned:true,selected:selected===kit.id}));
 for(const trophy of [...(club?.trophies??[])].sort((a,b)=>b.at.localeCompare(a.at))){
  const kit=kitForTrophy(trophy);
  if(kit)kits.push({...kit,selected:selected===kit.id});
 }
 return kits;
}
export function canSelectKit(club:ClubState|undefined,kitId:string):{ok:boolean;reason?:string}{
 if(kitId===''||kitId==='none')return {ok:true};
 const kit=collectibleKits(club).find(entry=>entry.id===kitId);
 if(!kit)return {ok:false,reason:'This kit has not been collected yet.'};
 return {ok:true};
}
