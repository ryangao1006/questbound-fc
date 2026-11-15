import {level,type PlannerState} from './model.ts';
import {buildAttributes,ATTRIBUTE_KEYS,type Allocation} from './football-stats.ts';
import type {CareerState,WorkCredit} from './football-model.ts';
export const skillBudget=(c:CareerState)=>c.grants.reduce((sum,g)=>sum+(g.active||g.vested?g.points:0),0);
export const creditSeconds=(credit:WorkCredit)=>Math.max(credit.taskSeconds,credit.focusSeconds);
export const availableWorkSeconds=(c:CareerState)=>c.workCredits.reduce((sum,w)=>sum+Math.max(0,creditSeconds(w)-w.consumedSeconds),0);
export const fixturePasses=(c:CareerState)=>Math.floor(availableWorkSeconds(c)/3600);
export const taskWorkScope=(id:string,occurrence?:string)=>`task:${id}${occurrence?':'+occurrence:''}`;
/** Called inside the same database transaction as every planner write, including provider retries. */
export function reconcileCareerProgress(input:CareerState,planner:PlannerState,operationId:string,now=new Date()):CareerState{
 const c=structuredClone(input),current=level(planner),at=now.toISOString();
 for(let value=c.highestLevel+1;value<=current;value++)if(value>c.baselineLevel&&!c.grants.some(g=>g.level===value))c.grants.push({id:`${c.id}:level:${value}`,level:value,points:4,active:true,vested:false,at,operationId});
 c.highestLevel=Math.max(c.highestLevel,current);
 for(const grant of c.grants)grant.active=grant.level<=current||grant.vested;
 const budget=skillBudget(c);let build=buildAttributes(c.player.base,c.player.allocation);
 if(build.cost>budget){const allocation={...c.player.allocation};for(let attempt=0;attempt<1200&&build.cost>budget;attempt++){const key=[...ATTRIBUTE_KEYS].reverse().find(k=>(allocation[k]||0)>0);if(!key)break;allocation[key]!--;build=buildAttributes(c.player.base,allocation)}c.player.allocation=allocation;c.player.attributes=build.attributes;c.lastProgressNotice='An undone reward removed unused skill points. Your saved match history is preserved.'}
 const credits=new Map(c.workCredits.map(w=>[w.id,{...w,taskSeconds:0,focusSeconds:0,sourceIds:[] as string[]}]));
 const get=(id:string)=>{if(!credits.has(id))credits.set(id,{id,taskSeconds:0,focusSeconds:0,consumedSeconds:0,at,sourceIds:[]});return credits.get(id)!};
 for(const reward of planner.rewards){if(!reward.id.startsWith('task:')||c.excludedRewardIds.includes(reward.id)||reward.at<c.createdAt)continue;const credit=get(reward.id);credit.taskSeconds=reward.active?1200:0;credit.sourceIds.push(reward.id)}
 for(const session of planner.sessions){if(session.kind!=='focus'||session.endedAt<c.createdAt||session.startedAt<c.createdAt&&session.id!==c.baselineFocus?.id)continue;const credit=get(session.workScope||(session.id===c.baselineFocus?.id?c.baselineFocus.scope:undefined)||(!session.taskId?'unlinked-focus':taskWorkScope(session.taskId)));credit.focusSeconds+=Math.max(0,session.seconds-(session.id===c.baselineFocus?.id?c.baselineFocus.seconds:0));credit.sourceIds.push('focus:'+session.id)}
 c.workCredits=[...credits.values()].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
 return c;
}
export function spendFixturePass(c:CareerState){if(fixturePasses(c)<1)throw new Error('Complete three tasks or save 60 focus minutes to unlock a competitive fixture.');let remaining=3600;for(const credit of c.workCredits){const available=Math.max(0,creditSeconds(credit)-credit.consumedSeconds),take=Math.min(remaining,available);credit.consumedSeconds+=take;remaining-=take;if(!remaining)break}if(remaining)throw new Error('Fixture work credit is inconsistent.')}
export function applyAllocation(c:CareerState,allocation:Allocation,operationId:string,now=new Date()){
 if(c.active)throw new Error('Finish the current fixture before changing your build.');const {attributes,cost}=buildAttributes(c.player.base,allocation);if(cost>skillBudget(c))throw new Error('This build needs more skill points.');c.player.allocation=structuredClone(allocation);c.player.attributes=attributes;c.allocations.push({id:operationId,operationId,at:now.toISOString(),cost,allocation:structuredClone(allocation),attributes:structuredClone(attributes),sourceLevels:c.grants.filter(g=>g.active||g.vested).map(g=>g.level)});
}
export function vestBuild(c:CareerState){let required=buildAttributes(c.player.base,c.player.allocation).cost;for(const grant of c.grants.filter(g=>g.active||g.vested).sort((a,b)=>a.level-b.level)){if(required<=0)break;grant.vested=true;required-=grant.points}}
