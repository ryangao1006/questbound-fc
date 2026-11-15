import type {ClubState,ClubTrophy} from './club-state.ts';
import {kitForTrophy,type KitItem} from './club-collection.ts';

/**
 * Trophy celebrations (PLAN 3.7 collections). A cup win or a league title creates
 * a pending celebration the first time the user visits the club; marking it keeps
 * a stable timestamp so it is shown once but can be replayed from the honours tab.
 */
export type Celebration={
 trophyId:string;kind:'cup'|'league';tier:number;
 title:string;titleZh:string;subtitle:string;subtitleZh:string;
 kit:KitItem|null;stars:number;seed:number;at:string;seen:boolean;
};
const TIER_NAMES=['Rookie','Rising','Contender','Elite'];
const TIER_ZH=['新秀','新锐','劲旅','精英'];
function hash(text:string){let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0||1}
export function celebrationFor(club:ClubState,trophy:ClubTrophy):Celebration{
 const tier=Math.max(0,Math.min(3,trophy.tier)),kit=kitForTrophy(trophy)??null;
 const kindTitle=trophy.kind==='cup'?'Challenge Cup winners':'League champions';
 const kindTitleZh=trophy.kind==='cup'?'挑战杯冠军':'联赛冠军';
 return {trophyId:trophy.id,kind:trophy.kind,tier,title:kindTitle,titleZh:kindTitleZh,subtitle:`${TIER_NAMES[tier]} · ${club.name}`,subtitleZh:`${TIER_ZH[tier]} · ${club.name}`,kit,stars:Math.min(5,(club.trophies?.length??1)),seed:hash(trophy.id),at:trophy.at,seen:Boolean(trophy.celebratedAt)};
}
/** The oldest unseen celebration, if any. */
export function pendingCelebration(club:ClubState|undefined):Celebration|null{
 if(!club)return null;
 const unseen=[...(club.trophies??[])].filter(trophy=>!trophy.celebratedAt).sort((a,b)=>a.at.localeCompare(b.at));
 return unseen.length?celebrationFor(club,unseen[0]):null;
}
export function allCelebrations(club:ClubState|undefined):Celebration[]{
 return [...(club?.trophies??[])].sort((a,b)=>b.at.localeCompare(a.at)).map(trophy=>celebrationFor(club!,trophy));
}
export function celebrationStars(seed:number,count=14):{angle:number;radius:number;size:number;rotation:number;delay:number}[]{
 let state=(seed>>>0)||1;
 const next=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296};
 return Array.from({length:count},()=>({angle:next()*360,radius:0.6+next()*0.5,size:6+next()*10,rotation:next()*360,delay:next()*0.6}));
}
