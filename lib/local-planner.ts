import {initialState,migrateState,type Envelope,type PlannerState,type Command} from './model.ts';
import {reduceCommand,assertState} from './domain.ts';
import {mergePlanner,type MergeConflict} from './planner-merge.ts';

export type CloudSnapshot={state:PlannerState;career?:unknown;[key:string]:unknown};
export type CloudEnvelope={snapshot:CloudSnapshot|null;revision:number;updatedAt:string;accountId?:string;pendingOperation?:{id:string;recoveryRequired:true}};
export type LocalOperation={id:string;command:Command;at:string};
export type LocalPlanner={version:1;accountId:string;generation:number;envelope:Envelope;base:CloudEnvelope;pending:LocalOperation[];conflicts:MergeConflict[];attempt?:{operationId:string;baseRevision:number;snapshot:CloudSnapshot;operationIds:string[]};lastError?:string};
export function emptyLocalPlanner(accountId:string):LocalPlanner{return {version:1,accountId,generation:0,envelope:{state:initialState(),revision:0,updatedAt:new Date().toISOString()},base:{snapshot:null,revision:0,updatedAt:''},pending:[],conflicts:[]};}

/** Resolve generated entity IDs before committing the local transaction. */
export function localCommand(record:LocalPlanner,command:Command,operationId:string,at=new Date().toISOString()):LocalPlanner{
 if(record.pending.some(v=>v.id===operationId))return record;
 const cmd=structuredClone(command);cmd.id||=crypto.randomUUID();
 for(const key of ['task','part','subject','block']){const value=cmd[key];if(value&&typeof value==='object'&&!Array.isArray(value)){(value as Record<string,unknown>).id||=crypto.randomUUID()}}
 const state=reduceCommand(record.envelope.state,cmd,new Date(at));assertState(state);
 return {...record,generation:record.generation+1,envelope:{state,revision:record.envelope.revision+1,updatedAt:at},pending:[...record.pending,{id:operationId,command:cmd,at}]};
}
export function incorporateCloud(record:LocalPlanner,cloud:CloudEnvelope,choices:Record<string,'local'|'remote'>={}):LocalPlanner{
 if(record.attempt)throw new Error('Retry or explicitly reject the pending cloud commit before incorporating a new version.');
 if(!cloud.snapshot){if(record.base.snapshot||record.base.revision>0)throw new Error('The previously saved OneDrive head is missing. Local records are preserved; restore a verified recovery point.');return {...record,base:cloud,generation:record.generation+1};}
 cloud={...cloud,snapshot:{...cloud.snapshot,state:migrateState(cloud.snapshot!.state)}};
 assertState(cloud.snapshot!.state);
 if(!record.pending.length&&!record.conflicts.length)return {...record,generation:record.generation+1,base:cloud,envelope:{state:cloud.snapshot!.state,revision:cloud.revision,updatedAt:cloud.updatedAt},conflicts:[],lastError:undefined};
 const merged=mergePlanner(record.base.snapshot?.state||initialState(),record.envelope.state,cloud.snapshot!.state,choices);
 if(!merged.conflicts.length)assertState(merged.state);
 return {...record,generation:record.generation+1,...(!merged.conflicts.length?{base:cloud}:{}),envelope:{...record.envelope,state:merged.state},conflicts:merged.conflicts,attempt:undefined};
}
export function prepareCloudCommit(record:LocalPlanner,deviceId:string){
 if(record.conflicts.length)throw new Error('Resolve sync conflicts before uploading.');
 const attempt=record.attempt||{operationId:crypto.randomUUID(),baseRevision:record.base.revision,snapshot:{...record.base.snapshot,state:record.envelope.state},operationIds:record.pending.map(v=>v.id)};
 return {record:record.attempt?record:{...record,generation:record.generation+1,attempt},request:{operationId:attempt.operationId,baseRevision:attempt.baseRevision,snapshot:attempt.snapshot,deviceId}};
}
export function acknowledgeCloud(record:LocalPlanner,cloud:CloudEnvelope):LocalPlanner{
 const attempt=record.attempt;if(!attempt)throw new Error('No pending commit to acknowledge.');
 if(cloud.revision<=attempt.baseRevision)throw new Error('Cloud acknowledgement did not advance the submitted revision.');
 const ids=new Set(attempt.operationIds),pending=record.pending.filter(v=>!ids.has(v.id));
 if(!cloud.snapshot)throw new Error('Cloud verification returned no snapshot.');
 return incorporateCloud({...record,base:{snapshot:attempt.snapshot,revision:attempt.baseRevision+1,updatedAt:cloud.updatedAt},pending,attempt:undefined},cloud);
}

/** Only use after an explicit server rejection (e.g. revision conflict), never a timeout. */
export function rejectCloudAttempt(record:LocalPlanner):LocalPlanner{return {...record,generation:record.generation+1,attempt:undefined};}
