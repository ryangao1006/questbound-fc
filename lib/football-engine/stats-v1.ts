// Retained balance rules. Published versions are immutable.
import type {FootballPosition,FootballAttributes,FootballGoalkeeperAttributes} from '../football-data.ts';
export type OutfieldKey=keyof FootballAttributes;
export type KeeperKey=keyof FootballGoalkeeperAttributes;
export type AttributeKey=OutfieldKey|KeeperKey;
export type PlayerAttributes=FootballAttributes & FootballGoalkeeperAttributes;
export const OUTFIELD_KEYS:OutfieldKey[]=['pac','sho','pas','dri','def','phy'];
export const KEEPER_KEYS:KeeperKey[]=['diving','handling','kicking','reflexes','speed','positioning'];
export const ATTRIBUTE_KEYS:AttributeKey[]=[...OUTFIELD_KEYS,...KEEPER_KEYS];
export const ATTRIBUTE_LABELS:Record<AttributeKey,string>={pac:'Pace',sho:'Shooting',pas:'Passing',dri:'Dribbling',def:'Defending',phy:'Physicality',diving:'Diving',handling:'Handling',kicking:'Kicking',reflexes:'Reflexes',speed:'Speed',positioning:'Positioning'};
export const OVR_WEIGHTS:Record<FootballPosition,number[]>={GK:[20,20,10,25,5,20],CB:[10,2,12,8,43,25],LB:[20,3,20,15,27,15],RB:[20,3,20,15,27,15],DM:[10,5,25,15,30,15],CM:[10,12,32,25,11,10],AM:[12,22,28,28,3,7],LW:[26,22,18,26,2,6],RW:[26,22,18,26,2,6],ST:[20,42,8,20,2,8]};
export const clampRating=(n:number)=>Math.max(1,Math.min(99,Math.round(n)));
export function overall(position:FootballPosition,attributes:Partial<PlayerAttributes>){const keys=position==='GK'?KEEPER_KEYS:OUTFIELD_KEYS;return clampRating(keys.reduce((sum,key,i)=>sum+(attributes[key]??1)*OVR_WEIGHTS[position][i],0)/100)}
const STARTING:Record<FootballPosition,number[]>={GK:[52,32,52,48,35,60],CB:[55,31,52,49,68,64],LB:[70,42,62,61,61,61],RB:[70,42,62,61,61,61],DM:[56,41,65,58,65,62],CM:[60,48,66,64,50,58],AM:[62,54,64,65,31,51],LW:[71,54,55,65,25,50],RW:[71,54,55,65,25,50],ST:[64,66,43,58,24,58]};
export function rookieAttributes(position:FootballPosition):PlayerAttributes{
 const attributes=Object.fromEntries([...OUTFIELD_KEYS.map((key,i)=>[key,STARTING[position][i]]),...KEEPER_KEYS.map((key,i)=>[key,[62,60,57,65,50,63][i]])]) as PlayerAttributes;
 const keys=position==='GK'?KEEPER_KEYS:OUTFIELD_KEYS,weights=OVR_WEIGHTS[position];
 // Calibrate only the chosen starting profile; all careers begin at exactly 62.
 for(let tries=0;tries<100&&overall(position,attributes)!==62;tries++){const change=overall(position,attributes)<62?1:-1;const index=weights.indexOf(Math.max(...weights));attributes[keys[index]]=clampRating(attributes[keys[index]]+change)}
 return attributes;
}
export function upgradeCost(current:number){if(!Number.isInteger(current)||current<1||current>99)throw new Error('Invalid football rating.');return current===99?Infinity:current<70?1:current<80?2:current<90?3:current<95?5:8}
export type Allocation=Partial<Record<AttributeKey,number>>;
export function buildAttributes(base:PlayerAttributes,allocation:Allocation){let cost=0;const result={...base};for(const key of Object.keys(allocation)){if(!ATTRIBUTE_KEYS.includes(key as AttributeKey))throw new Error('Unknown football attribute.');const count=allocation[key as AttributeKey];if(!Number.isInteger(count)||count!<0||count!>98)throw new Error('Choose whole attribute increases.');for(let i=0;i<count!;i++){const price=upgradeCost(result[key as AttributeKey]);if(!Number.isFinite(price))throw new Error('Football attributes cannot exceed 99.');cost+=price;result[key as AttributeKey]++}}return {attributes:result,cost}}
export function recommendedAllocation(base:PlayerAttributes,position:FootballPosition,budget:number):Allocation{const result:Allocation={},keys=position==='GK'?KEEPER_KEYS:OUTFIELD_KEYS,weights=OVR_WEIGHTS[position];let remaining=budget;for(let n=0;n<600;n++){const current=buildAttributes(base,result).attributes;const possible=keys.map((key,i)=>({key,price:upgradeCost(current[key]),benefit:weights[i]/(current[key]-base[key]+4)})).filter(x=>x.price<=remaining).sort((a,b)=>b.benefit/b.price-a.benefit/a.price||a.key.localeCompare(b.key));const best=possible[0];if(!best)break;result[best.key]=(result[best.key]||0)+1;remaining-=best.price}return result}
export const DETAIL_PROFILE_VERSION='position-profile-1';
const DETAIL_GROUPS:Record<OutfieldKey,string[]>={pac:['acceleration','sprintSpeed'],sho:['finishing','shotPower','attackingPosition','longShots','volleys','penalties'],pas:['shortPassing','longPassing','vision','crossing','curve','freeKicks'],dri:['firstTouch','closeControl','agility','balance','reactions','composure'],def:['awareness','interceptions','standingTackle','slidingTackle','headingAccuracy'],phy:['stamina','strength','jumping','aggression']};
export function detailedAttributes(position:FootballPosition,attributes:PlayerAttributes){const result:Record<string,number>={};const offsets=position==='CB'||position==='DM'?[2,-2,1,-1,0,1]:position==='LW'||position==='RW'?[3,-2,2,-3,0,1]:[1,-1,2,-2,0,0];for(const key of OUTFIELD_KEYS)DETAIL_GROUPS[key].forEach((name,i)=>result[name]=clampRating(attributes[key]+offsets[i%offsets.length]));for(const key of KEEPER_KEYS)result[key]=attributes[key];return result}
export type SpecialtyId='quick-first-step'|'secure-first-touch'|'threaded-passer'|'interception-specialist'|'clinical-finisher'|'prepared-substitute'|'aerial-presence'|'keeper-instinct';
export const SPECIALTIES:{id:SpecialtyId;name:string;description:string;mechanic:string;bonus:number}[]=[
 {id:'quick-first-step',name:'Quick first step',description:'8% more acceleration during the first second of a run.',mechanic:'acceleration',bonus:.08},
 {id:'secure-first-touch',name:'Secure first touch',description:'8% less receiving error when the ball arrives under pressure.',mechanic:'firstTouch',bonus:.08},
 {id:'threaded-passer',name:'Threaded passer',description:'8% less execution error on difficult through balls.',mechanic:'throughPass',bonus:.08},
 {id:'interception-specialist',name:'Interception specialist',description:'8% better anticipation when correctly positioned in a passing lane.',mechanic:'interception',bonus:.08},
 {id:'clinical-finisher',name:'Clinical finisher',description:'8% less shot error on balanced shots inside the penalty area.',mechanic:'finishing',bonus:.08},
 {id:'prepared-substitute',name:'Prepared substitute',description:'8% better initial reactions during your first five match minutes after coming on.',mechanic:'subReadiness',bonus:.08},
 {id:'aerial-presence',name:'Aerial presence',description:'8% better reach when timing an aerial contest.',mechanic:'jumping',bonus:.08},
 {id:'keeper-instinct',name:'Keeper instinct',description:'8% faster reactions when the keeper is set and facing the shooter.',mechanic:'keeperReaction',bonus:.08},
];
export function specialtyBonus(ids:SpecialtyId[],mechanic:string){return Math.min(.1,SPECIALTIES.filter(s=>ids.includes(s.id)&&s.mechanic===mechanic).reduce((n,s)=>n+s.bonus,0))}
export const specialtySlots=(plannerLevel:number)=>plannerLevel>=30?3:plannerLevel>=15?2:1;

export const POSITION_LABELS:Record<FootballPosition,string>={GK:'Goalkeeper',CB:'Centre-back',LB:'Left-back',RB:'Right-back',DM:'Defensive midfielder',CM:'Central midfielder',AM:'Attacking midfielder',LW:'Left winger',RW:'Right winger',ST:'Striker'};
export const ATTRIBUTE_BENEFITS:Record<AttributeKey,string>={pac:'Quicker starts and faster recovery runs.',sho:'Better shot execution, power and composure.',pas:'More accurate delivery and better difficult passes.',dri:'Cleaner receiving, tighter turns and closer control.',def:'Better anticipation and well-timed challenges.',phy:'More stamina, stronger contests and aerial reach.',diving:'Reach more shots with a well-timed dive.',handling:'Hold difficult shots more reliably.',kicking:'Deliver more accurate keeper distributions.',reflexes:'React faster when set for a shot.',speed:'Move across the goal and sweep up more quickly.',positioning:'Cover better angles before the shot.'};
