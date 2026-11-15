import {CLUB_FORMATIONS,autoPick,generateInitialSquad,levelForXp,lineRatings,positionFit,quoteTraining,type ClubFormation,type ClubLine,type ClubPlayer,type LineRatings} from './club-model.ts';
import {previewClubMigration,type ClubMigrationPreview} from './club-migration.ts';
import type {PlannerState} from './model.ts';

/**
 * A deterministic preview club for the manager pivot. This is the shape the real
 * ClubSave will take, but it is generated on the fly and never written anywhere.
 */
export type ClubPreviewPlayer=ClubPlayer&{line:ClubLine;fit:number;training:{from:number;to:number;price:number;blocked:string|null}};
export type ClubPreview={
 identity:{name:string;shortName:string;city:string;crest:{primary:string;secondary:string};homeKit:string;awayKit:string};
 level:number;xp:number;formation:ClubFormation;ratings:LineRatings;
 squad:ClubPreviewPlayer[];starters:string[];bench:string[];
 facilities:{trainingCentre:number;scoutCentre:number;stadium:number};
 migration:ClubMigrationPreview;
};
export const FORMATION_OPTIONS=['4-4-2','4-3-3','4-2-3-1'] as const;

export function buildClubPreview(state?:PlannerState,seed=20261114):ClubPreview{
 const squad=generateInitialSquad(seed),formation:ClubFormation='4-3-3',slots=CLUB_FORMATIONS[formation],picked=autoPick(squad,formation);
 const ratings=lineRatings(picked,formation);
 const starterIds=picked.map(player=>player?.id).filter(Boolean) as string[];
 const fitById=new Map<string,number>();
 picked.forEach((player,index)=>{if(player)fitById.set(player.id,positionFit(player.position,slots[index].position))});
 const xp=state?Math.max(0,state.rewards.reduce((sum,reward)=>sum+(reward.active?reward.points:0),0)):420;
 const migration=state?previewClubMigration(state):{xp:420,funds:360,initialGrant:150,displayRights:{frames:[],backdrops:[],kits:['academyKit']},frozen:{personalAttributes:true,skillPoints:null,matchHistory:null},baseline:{rewardIdentities:0,sessionIdentities:0,activeSession:false},warnings:['No planner loaded: these numbers are illustrative.']};
 return {
  identity:{name:'Northbridge FC',shortName:'NBR',city:'Northbridge',crest:{primary:'#1f4e79',secondary:'#c8f56e'},homeKit:'#1f4e79',awayKit:'#e8edf4'},
  level:levelForXp(xp),xp,formation,ratings,
  squad:squad.map(player=>{
   const value=quoteTraining(player,'pas',3);
   return {...player,line:player.position==='GK'?'GK':['CB','LB','RB'].includes(player.position)?'DEF':['DM','CM','AM'].includes(player.position)?'MID':'ATT',fit:fitById.get(player.id)??1,training:{from:value.from,to:value.to,price:value.price,blocked:value.blocked}} as ClubPreviewPlayer;
  }),
  starters:starterIds,
  bench:squad.filter(player=>!starterIds.includes(player.id)).map(player=>player.id),
  facilities:{trainingCentre:3,scoutCentre:2,stadium:2},
  migration,
 };
}
export function squadLineCounts(preview:ClubPreview){
 return {GK:preview.squad.filter(player=>player.line==='GK').length,DEF:preview.squad.filter(player=>player.line==='DEF').length,MID:preview.squad.filter(player=>player.line==='MID').length,ATT:preview.squad.filter(player=>player.line==='ATT').length};
}
