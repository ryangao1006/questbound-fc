import {reduceCommand} from './domain.ts';
import {migrateState,type Command,type Envelope,type PlannerState} from './model.ts';

/** One queued planner command, kept on this device until the private site accepts it. */
export type QueuedCommand={id:string;command:Command;at:string};
export type SiteSnapshot={revision:number;updatedAt:string;state:PlannerState;cachedAt:string};
export type QueueTransport={
 send:(entry:QueuedCommand)=>Promise<Envelope>;
 refresh:()=>Promise<Envelope>;
};
export type FlushResult={accepted:QueuedCommand[];remaining:QueuedCommand[];conflict:boolean;last?:Envelope};

/** Append without duplicating an operation id; order is the order the user acted. */
export function enqueue(queue:QueuedCommand[],entry:QueuedCommand){
 if(queue.some(item=>item.id===entry.id))return [...queue];
 return [...queue,{id:entry.id,command:entry.command,at:entry.at}];
}

/** Replay queued commands over the last known server state so the device shows the change immediately. */
export function applyQueued(envelope:Envelope,queue:QueuedCommand[]){
 let state=migrateState(envelope.state);
 for(const entry of queue)state=reduceCommand(state,entry.command);
 return {...envelope,state};
}

/** The newest snapshot wins; an older cache must never overwrite a newer one. */
export function newestSnapshot(previous:SiteSnapshot|null,next:SiteSnapshot){
 if(!previous)return next;
 return next.revision>=previous.revision?next:previous;
}

/**
 * Submit queued commands in order with their original operation ids, so a retried
 * command is idempotent on the server. One 409 refresh is allowed per command.
 */
export async function flushQueue(queue:QueuedCommand[],transport:QueueTransport):Promise<FlushResult>{
 const accepted:QueuedCommand[]=[];
 let remaining=[...queue];
 let last:Envelope|undefined;
 while(remaining.length){
  const [entry,...rest]=remaining;
  try{
   last=await transport.send(entry);
   accepted.push(entry);remaining=rest;
  }catch(error){
   if((error as {status?:number}).status!==409)return {accepted,remaining,conflict:false,last};
   try{
    await transport.refresh();
    last=await transport.send(entry);
    accepted.push(entry);remaining=rest;
   }catch(second){
    return {accepted,remaining,conflict:(second as {status?:number}).status===409,last};
   }
  }
 }
 return {accepted,remaining,conflict:false,last};
}
