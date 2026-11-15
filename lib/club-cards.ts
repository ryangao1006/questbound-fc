import type {ClubState} from './club-state.ts';
import type {ClubPlayer} from './club-model.ts';

/**
 * Comic player cards and the club crest (PLAN 3.7). Card art is generated from
 * stable hashes so the same player always looks the same and no canvas per card
 * is needed — the UI renders one lightweight SVG/CSS avatar each.
 */
export type CardTier='gold'|'silver'|'bronze';
export type CardTierStyle={tier:CardTier;label:string;ink:string;paper:string;accent:string};
const TIER_STYLES:Record<CardTier,CardTierStyle>={
 gold:{tier:'gold',label:'Gold',ink:'#3a2a08',paper:'#ffe9a8',accent:'#f4c445'},
 silver:{tier:'silver',label:'Silver',ink:'#22303c',paper:'#e6eef5',accent:'#9fb4c7'},
 bronze:{tier:'bronze',label:'Bronze',ink:'#33200f',paper:'#f0d6bd',accent:'#b9793f'},
};
export function cardTier(ovr:number):CardTier{return ovr>=80?'gold':ovr>=70?'silver':'bronze'}
export function cardTierStyle(ovr:number):CardTierStyle{return TIER_STYLES[cardTier(ovr)]}
function hash(text:string){let value=2166136261;for(const character of text){value^=character.charCodeAt(0);value=Math.imul(value,16777619)}return value>>>0||1}
export type CardAvatar={skin:number;hairStyle:number;hairColour:string;kitTrim:string;face:number;build:number};
const SKIN_TONES=['#f2c8a8','#d9a479','#b57b52','#8a5a3b','#5f3d28','#f5d7bd'];
const HAIR_COLOURS=['#221a15','#422a1b','#17191c','#5b3e2b','#a35c2a','#c9b89a'];
export function cardAvatar(player:{id:string;position:string}):CardAvatar{
 const seed=hash(player.id),goalkeeper=player.position==='GK';
 return {skin:seed%SKIN_TONES.length,hairStyle:Math.floor(seed/7)%4,hairColour:HAIR_COLOURS[Math.floor(seed/11)%HAIR_COLOURS.length],kitTrim:goalkeeper?'#ffd479':(Math.floor(seed/13)%2?'#f2f7ff':'#10151f'),face:Math.floor(seed/17)%6,build:0.4+((seed/23)%40)/100};
}
export type PlayerCard={
 id:string;name:string;number:number;position:string;line:'GK'|'DEF'|'MID'|'ATT';
 ovr:number;tier:CardTierStyle;starter:boolean;origin:'initial'|'signed';
 paidPrice:number|null;avatar:CardAvatar;captain:boolean;
 attributes:{pac:number;sho:number;pas:number;dri:number;def:number;phy:number};
};
export function playerCard(club:ClubState,player:ClubPlayer,captainId?:string):PlayerCard{
 const starter=club.lineup.includes(player.id);
 const line=player.position==='GK'?'GK':['CB','LB','RB'].includes(player.position)?'DEF':['DM','CM','AM'].includes(player.position)?'MID':'ATT';
 const paid=(player as unknown as {paidPrice?:number}).paidPrice;
 return {id:player.id,name:player.name,number:player.number,position:player.position,line,ovr:player.ovr,tier:cardTierStyle(player.ovr),starter,origin:player.origin,paidPrice:typeof paid==='number'?paid:null,avatar:cardAvatar(player),captain:!!captainId&&captainId===player.id,attributes:{pac:player.attributes.pac,sho:player.attributes.sho,pas:player.attributes.pas,dri:player.attributes.dri,def:player.attributes.def,phy:player.attributes.phy}};
}
/** Starters first in line-up order, then the bench by overall. */
export function squadCards(club:ClubState,captainId?:string):PlayerCard[]{
 const byId=new Map(club.players.map(player=>[player.id,player]));
 const starters=club.lineup.map(id=>byId.get(id)).filter((player):player is ClubPlayer=>Boolean(player)).map(player=>playerCard(club,player,captainId));
 const bench=club.players.filter(player=>!club.lineup.includes(player.id)).sort((a,b)=>b.ovr-a.ovr||a.name.localeCompare(b.name)).map(player=>playerCard(club,player,captainId));
 return [...starters,...bench];
}
export type ClubCrest={initials:string;shape:'shield';colours:[string,string];stars:number;stripe:boolean;motto:string};
export function clubCrest(club:ClubState):ClubCrest{
 const primary=club.colours?.primary??'#2f6f4e',secondary=club.colours?.secondary??'#c8f56e';
 const words=club.name.replace(/[^A-Za-z\u4e00-\u9fa5 ]/g,'').trim().split(/\s+/).filter(Boolean);
 const initials=club.shortName?.slice(0,3).toUpperCase()||words.map(word=>word[0]).join('').slice(0,3).toUpperCase()||'FC';
 return {initials,shape:'shield',colours:[primary,secondary],stars:Math.min(5,club.trophies?.length??0),stripe:hash(club.name)%2===0,motto:club.city?club.city.toUpperCase():'EST. 2026'};
}
export function cardSummary(cards:PlayerCard[]){const starters=cards.filter(card=>card.starter),bench=cards.filter(card=>!card.starter);return {total:cards.length,starters:starters.length,bench:bench.length,gold:cards.filter(card=>card.tier.tier==='gold').length,silver:cards.filter(card=>card.tier.tier==='silver').length,bronze:cards.filter(card=>card.tier.tier==='bronze').length,startersAvg:starters.length?Math.round(starters.reduce((sum,card)=>sum+card.ovr,0)/starters.length):0}}
