import {clubRatings,type ClubState} from './club-state.ts';
import {quoteTraining,trainingCap,trainingPrice,type ClubPlayer} from './club-model.ts';
import {cardTierStyle,type PlayerCard} from './club-cards.ts';
import {radarPolygon,type Point} from './club-diagrams.ts';
import type {FootballAttributes} from './football-data.ts';

/**
 * One player's detail view (PLAN 3.7 player cards): a six-attribute spider, the
 * training-centre cap, the next price per attribute and the player's line fit.
 * Pure and derived from the saved club.
 */
export type AttributeKey=keyof FootballAttributes;
export const ATTRIBUTE_ORDER:AttributeKey[]=['pac','sho','pas','dri','def','phy'];
export type AttributeState={key:AttributeKey;label:string;value:number;cap:number;price:number|null;blocked:string|null};
export type PlayerDetail={
 id:string;name:string;number:number;position:string;line:'GK'|'DEF'|'MID'|'ATT';
 ovr:number;tier:PlayerCard['tier'];starter:boolean;origin:'initial'|'signed';paidPrice:number|null;
 attributes:AttributeState[];spider:string;spiderPoints:{label:string;x:number;y:number}[];
 cap:number;capProgress:number;nextPrice:number|null;lineRating:number;
 radarCenter:Point;radarRadius:number;
};
const LABELS:Record<AttributeKey,string>={pac:'PAC',sho:'SHO',pas:'PAS',dri:'DRI',def:'DEF',phy:'PHY'};
const CAP_LABELS:Record<string,string>={GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',DM:'DEF',CM:'MID',AM:'MID',LM:'MID',RM:'MID',ST:'ATT',LW:'ATT',RW:'ATT'};
function lineOf(position:string):'GK'|'DEF'|'MID'|'ATT'{
 if(position==='GK')return 'GK';
 if(['CB','LB','RB'].includes(position))return 'DEF';
 if(['DM','CM','AM'].includes(position))return 'MID';
 return 'ATT';
}
export function playerDetail(club:ClubState,playerId:string,center:Point={x:60,y:60},radius=44):PlayerDetail{
 const player=club.players.find(entry=>entry.id===playerId);
 if(!player)throw new Error('Choose a player from your squad.');
 const centre=Math.max(1,club.facilities.trainingCentre),cap=trainingCap(centre),line=lineOf(player.position);
 const attributes:AttributeState[]=ATTRIBUTE_ORDER.map(key=>{
  const quote=quoteTraining(player as ClubPlayer,key,centre);
  return {key,label:LABELS[key],value:player.attributes[key],cap,price:quote.blocked?null:quote.price,blocked:quote.blocked};
 });
 const spider=radarPolygon(ATTRIBUTE_ORDER.map(key=>({label:LABELS[key],value:player.attributes[key]})),center,radius,99);
 const prices=attributes.map(attribute=>attribute.price).filter((price):price is number=>typeof price==='number');
 const ratings=clubRatings(club);
 return {id:player.id,name:player.name,number:player.number,position:player.position,line,ovr:player.ovr,tier:cardTierStyle(player.ovr),starter:club.lineup.includes(player.id),origin:player.origin,paidPrice:typeof (player as unknown as {paidPrice?:number}).paidPrice==='number'?(player as unknown as {paidPrice:number}).paidPrice:null,attributes,spider:spider.points,spiderPoints:spider.axes.map(axis=>({label:axis.label,x:axis.tip.x,y:axis.tip.y})),cap,capProgress:Math.round(Math.min(1,player.ovr/cap)*100),nextPrice:prices.length?Math.min(...prices):null,lineRating:ratings[line],radarCenter:center,radarRadius:radius};
}
export function attributePriceTable(player:ClubPlayer,centreLevel=1){return ATTRIBUTE_ORDER.map(key=>({key,label:LABELS[key],...quoteTraining(player,key,centreLevel)}))}
export function detailSummary(detail:PlayerDetail){return {name:detail.name,ovr:detail.ovr,line:detail.line,cap:detail.cap,nextPrice:detail.nextPrice,progress:`${detail.capProgress}%`}}
export function canTrainDetail(club:ClubState,detail:PlayerDetail,key:AttributeKey){const attribute=detail.attributes.find(entry=>entry.key===key);if(!attribute)return {ok:false,reason:'Choose an attribute.'};if(attribute.blocked)return {ok:false,reason:attribute.blocked};if(typeof attribute.price!=='number')return {ok:false,reason:'This attribute cannot be trained.'};return {ok:true,price:attribute.price}}
export function capLabelFor(position:string){return CAP_LABELS[position as keyof typeof CAP_LABELS]??'MID'}
export function nextTrainingAttribute(detail:PlayerDetail):AttributeKey|null{
 const options=detail.attributes.filter(attribute=>!attribute.blocked&&typeof attribute.price==='number').sort((a,b)=>(a.price??0)-(b.price??0)||a.value-b.value);
 return options.length?options[0].key:null;
}
export function trainingPriceFor(value:number){return trainingPrice(value)}
