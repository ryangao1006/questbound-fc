import type {FootballAttributes} from './football-data.ts';
import {CLUB_FORMATIONS,autoPick,generateInitialSquad,lineOf,lineRatings,quoteTraining,trainPlayer,type ClubFormation,type ClubLine,type ClubPlayer} from './club-model.ts';
import {spendClubFunds,type Economy} from './economy.ts';

/**
 * Club data stored inside the existing versioned planner document. No SQL schema
 * change: the document is still schema 8 and simply gains an optional `club` field.
 */
export type ClubTactic='balanced'|'possession'|'counter'|'wide'|'press';
export type ClubFacilities={trainingCentre:number;scoutCentre:number;stadium:number};
export type ClubReceipt={id:string;kind:'training'|'facility'|'tactic'|'signing'|'sale';label:string;cost:number;at:string;funding:{sourceId:string;amount:number}[]};
export type ClubState={
 version:1;id:string;name:string;shortName:string;city:string;
 colours:{primary:string;secondary:string};kits:{home:string;away:string};
 formation:ClubFormation;players:ClubPlayer[];lineup:string[];
 facilities:ClubFacilities;tactics:{active:ClubTactic;levels:Record<ClubTactic,number>};
 receipts:ClubReceipt[];migratedAt?:string;matches?:ClubMatchRecord[];season?:import('./club-league.ts').ClubSeason;cup?:import('./club-cup.ts').ClubCup;trophies?:ClubTrophy[];history?:SeasonRecord[];display?:{frame?:string;backdrop?:string;kit?:string};decor?:{pitch?:string;stands?:string;lights?:string};assistant?:{autoSquad?:boolean;autoSubs?:boolean};createdAt:string;
};
export type SeasonRecord={id:string;tier:number;position:number;points:number;won:number;drawn:number;lost:number;gf:number;ga:number;outcome:'champion'|'promoted'|'relegated'|'stayed'|'abandoned';at:string;lineup?:{id:string;name:string;position:string;ovr:number}[]};
export type ClubTrophy={id:string;kind:'cup'|'league';tier:number;label:string;at:string;kitId?:string;celebratedAt?:string};
export type ClubMatchRecord={id:string;at:string;tier:number;opponent:{name:string;shortName:string};teams:{home:string;away:string};score:[number,number]};
export const CLUB_NAME_MAX=40,CLUB_SHORT_MAX=4;
export const CLUB_TACTICS:ClubTactic[]=['balanced','possession','counter','wide','press'];
const HEX=/^#[0-9a-f]{6}$/i;
const clean=(value:unknown,max:number)=>String(value??'').trim().replace(/\s+/g,' ').slice(0,max);

export function seedFrom(text:string){let hash=2166136261;for(const character of text){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0)||1}

export type ClubIdentityInput={name:string;shortName:string;city?:string;colours?:{primary?:string;secondary?:string};kits?:{home?:string;away?:string};formation?:ClubFormation};
export function createClubState(input:ClubIdentityInput,operationId:string,now=new Date()):ClubState{
 const name=clean(input.name,CLUB_NAME_MAX),shortName=clean(input.shortName,CLUB_SHORT_MAX).toUpperCase();
 if(name.length<2)throw new Error('Give your club a name.');
 if(shortName.length<2)throw new Error('Use a short name of two to four characters.');
 const primary=input.colours?.primary??'#1f4e79',secondary=input.colours?.secondary??'#c8f56e';
 if(!HEX.test(primary)||!HEX.test(secondary))throw new Error('Choose valid club colours.');
 const home=input.kits?.home??primary,away=input.kits?.away??'#e8edf4';
 if(!HEX.test(home)||!HEX.test(away))throw new Error('Choose valid kit colours.');
 const formation=(input.formation&&CLUB_FORMATIONS[input.formation]?input.formation:'4-3-3') as ClubFormation;
 const squad=generateInitialSquad(seedFrom(operationId+name+shortName));
 const picked=autoPick(squad,formation).map(player=>player?.id).filter(Boolean) as string[];
 return {version:1,id:'club-'+seedFrom(operationId).toString(36),name,shortName,city:clean(input.city,40)||'Northbridge',colours:{primary,secondary},kits:{home,away},formation,players:squad,lineup:picked,facilities:{trainingCentre:1,scoutCentre:1,stadium:1},tactics:{active:'balanced',levels:{balanced:0,possession:0,counter:0,wide:0,press:0}},receipts:[],createdAt:now.toISOString()};
}

export const TACTIC_TRAINING_PRICES=[100,200,350,550,800] as const;
export const TACTIC_MAX_LEVEL=5;
/** Which attributes a tactic trains, per PLAN 3.4 (line groups, +1 per level, cap 99). */
export const TACTIC_BONUS:Record<ClubTactic,{attribute:keyof FootballAttributes;lines:ClubLine[];label:string}>={
 balanced:{attribute:'dri',lines:['DEF','MID','ATT'],label:'All outfield DRI'},
 possession:{attribute:'pas',lines:['DEF','MID','ATT'],label:'All outfield PAS'},
 counter:{attribute:'pac',lines:['MID','ATT'],label:'Midfield and attack PAC'},
 wide:{attribute:'pas',lines:['DEF','MID','ATT'],label:'Full-backs and wingers PAS'},
 press:{attribute:'def',lines:['MID','ATT'],label:'Midfield and attack DEF'},
};
export const FACILITY_PRICES={trainingCentre:[300,700,1600,3200],scoutCentre:[400,1000,2200],stadium:[400,900,1800,3600]} as const;
export const FACILITY_MAX={trainingCentre:5,scoutCentre:4,stadium:5} as const;
/** Club levels required to reach training-centre L3/L4/L5 and scout-centre L2/L3/L4. */
export const FACILITY_GATES={trainingCentre:[0,0,3,6,10],scoutCentre:[0,5,10,15],stadium:[0,0,0,0,0]} as const;
export type FacilityKey=keyof typeof FACILITY_PRICES;
export function facilityUpgradeCost(facility:FacilityKey,currentLevel:number){const prices=FACILITY_PRICES[facility];const index=Math.max(0,currentLevel-1);return index<prices.length?prices[index]:null}
export function facilityGate(facility:FacilityKey,nextLevel:number){const gates=FACILITY_GATES[facility];return gates[Math.max(0,nextLevel-1)]??0}
export function tacticTrainingCost(level:number){return level>=TACTIC_MAX_LEVEL?null:TACTIC_TRAINING_PRICES[Math.max(0,level)]}
/** Effective attributes add the active tactic's training bonus to the players in its lines. */
export function effectiveAttributes(player:ClubPlayer,tactics:ClubState['tactics']){
 const level=tactics.levels[tactics.active]??0;if(!level)return {...player.attributes};
 const bonus=TACTIC_BONUS[tactics.active];
 if(!bonus.lines.includes(lineOf(player.position)))return {...player.attributes};
 return {...player.attributes,[bonus.attribute]:Math.min(99,player.attributes[bonus.attribute]+level)};
}

/** Debit the shared FC Credits ledger for a club action, recording who paid. */
export function debitClubFunds(economy:Economy,cost:number,receiptId:string,at=new Date()):ClubReceipt['funding']{
 spendClubFunds(economy,cost,receiptId,at);
 return (economy.clubSpend??[]).find(entry=>entry.id===receiptId)?.funding??[];
}

export function clubPlayer(club:ClubState,playerId:string){
 const player=club.players.find(entry=>entry.id===playerId);
 if(!player)throw new Error('Choose a player from your squad.');
 return player;
}

export type TrainResult={club:ClubState;price:number;attribute:keyof FootballAttributes;from:number;to:number;ovrFrom:number;ovrTo:number};
export function trainClubPlayer(club:ClubState,playerId:string,attribute:keyof FootballAttributes,economy:Economy,operationId:string,now=new Date()):TrainResult{
 const player=clubPlayer(club,playerId);
 const quote=quoteTraining(player,attribute,club.facilities.trainingCentre);
 if(quote.blocked)throw new Error(quote.blocked);
 if(!(['pac','sho','pas','dri','def','phy'] as string[]).includes(attribute))throw new Error('Choose a trainable attribute.');
 const funding=debitClubFunds(economy,quote.price,operationId,now);
 const trained=trainPlayer(player,attribute,club.facilities.trainingCentre);
 const next:ClubState={...club,players:club.players.map(entry=>entry.id===trained.id?trained:entry),receipts:[...club.receipts,{id:operationId,kind:'training',label:`${player.name} · ${attribute.toUpperCase()}`,cost:quote.price,at:now.toISOString(),funding}]};
 return {club:next,price:quote.price,attribute,from:quote.from,to:quote.to,ovrFrom:player.ovr,ovrTo:trained.ovr};
}

export function setClubLineup(club:ClubState,formation:ClubFormation,starters:string[]){
 if(!CLUB_FORMATIONS[formation])throw new Error('Choose a supported formation.');
 if(!Array.isArray(starters)||starters.length!==11)throw new Error('Pick exactly eleven starters.');
 if(new Set(starters).size!==11)throw new Error('A player cannot start twice.');
 const players=starters.map(id=>clubPlayer(club,id));
 if(players.filter(player=>player.position==='GK').length!==1)throw new Error('Start exactly one goalkeeper.');
 return {...club,formation,lineup:starters};
}

export function clubRatings(club:ClubState){
 const byId=new Map(club.players.map(player=>[player.id,player]));
 const starters=club.lineup.map(id=>byId.get(id)).map(player=>player?{...player,attributes:effectiveAttributes(player,club.tactics)}:undefined);
 return lineRatings(starters,club.formation);
}
export function clubFunds(economy:Economy){return economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0)}
