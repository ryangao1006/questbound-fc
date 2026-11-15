import {creditBalance,type Economy} from './economy.ts';
import type {PlannerState} from './model.ts';
import type {ClubState} from './club-state.ts';
import {canSelectKit,collectibleKits} from './club-collection.ts';

/**
 * Club display rights (PLAN 4.3): cosmetic purchases and unlocks the account
 * already owns become club display rights. Nothing here charges again.
 */
export type DisplayKind='frame'|'backdrop'|'kit';
export type DisplayOption={id:string;kind:DisplayKind;name:string;colours:[string,string];description:string;owned:boolean;selected:boolean};
export type ClubDisplay={frame?:string;backdrop?:string;kit?:string};
export type DisplayRights={frames:string[];backdrops:string[];kits:string[]};

export const DISPLAY_CATALOG:{id:string;kind:DisplayKind;name:string;colours:[string,string];description:string}[]=[
 {id:'frame.silver',kind:'frame',name:'Silver finish',colours:['#d6e2ee','#71859e'],description:'A brushed silver club card.'},
 {id:'frame.emerald',kind:'frame',name:'Emerald finish',colours:['#a3e4bc','#1e755a'],description:'A deep green club card.'},
 {id:'frame.obsidian',kind:'frame',name:'Obsidian finish',colours:['#4b5069','#151d30'],description:'A dark club card with bright lettering.'},
 {id:'backdrop.stadium',kind:'backdrop',name:'Floodlight backdrop',colours:['#173454','#81c9e9'],description:'Floodlight beams behind the club card.'},
 {id:'backdrop.sunset',kind:'backdrop',name:'Golden hour backdrop',colours:['#a95237','#f4d08a'],description:'Warm light behind the club card.'},
 {id:'backdrop.tactics',kind:'backdrop',name:'Tactics backdrop',colours:['#163d36','#72b8a4'],description:'A tactical grid behind the club card.'},
];
export function ownedDisplayRights(economy:Economy,settings:Pick<PlannerState['settings'],'unlocked'>):DisplayRights{
 const frames=[...new Set(economy.purchases.filter(purchase=>purchase.itemId.startsWith('frame.')).map(purchase=>purchase.itemId))];
 const backdrops=[...new Set(economy.purchases.filter(purchase=>purchase.itemId.startsWith('backdrop.')).map(purchase=>purchase.itemId))];
 const kits=[...new Set(settings.unlocked.filter(item=>['academyKit','awayKit','goldboots','boots','celebration','armband'].includes(item)))];
 return {frames,backdrops,kits};
}
export function clubDisplay(state:Pick<PlannerState,'club'|'economy'|'settings'>):{rights:DisplayRights;display:ClubDisplay;options:DisplayOption[];kits:ReturnType<typeof collectibleKits>;availableCredits:number}{
 const rights=ownedDisplayRights(state.economy,state.settings),display=state.club?.display??{};
 const kitOptions=collectibleKits(state.club).map(kit=>({...kit,selected:display.kit===kit.id}));
 const options=DISPLAY_CATALOG.map(item=>{
  const owned=item.kind==='frame'?rights.frames.includes(item.id):rights.backdrops.includes(item.id);
  const selected=item.kind==='frame'?display.frame===item.id:display.backdrop===item.id;
  return {...item,owned,selected};
 });
 return {rights,display,options,kits:kitOptions,availableCredits:creditBalance(state.economy)};
}
export function canSelectDisplay(state:Pick<PlannerState,'club'|'economy'|'settings'>,kind:DisplayKind,itemId:string|undefined):{ok:boolean;reason?:string}{
 if(itemId===undefined||itemId===''||itemId==='none')return {ok:true};
 if(kind==='kit')return canSelectKit(state.club,itemId);
 const item=DISPLAY_CATALOG.find(entry=>entry.id===itemId&&entry.kind===kind);
 if(!item)return {ok:false,reason:'Choose a known display item.'};
 const rights=ownedDisplayRights(state.economy,state.settings);
 const owned=kind==='frame'?rights.frames.includes(itemId):rights.backdrops.includes(itemId);
 return owned?{ok:true}:{ok:false,reason:'This display item is not owned by this account yet.'};
}
export function displayStyle(option:DisplayOption|undefined):{borderColor?:string;background?:string}{
 if(!option)return {};
 return option.kind==='frame'?{borderColor:option.colours[0]}:{background:`linear-gradient(135deg, ${option.colours[0]}, ${option.colours[1]})`};
}
export function displayDefaults(club:ClubState|undefined):ClubDisplay{return {...(club?.display??{})}}
