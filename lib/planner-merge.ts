import {reconcileEconomy} from './economy.ts';
import type {PlannerState} from './model.ts';

export type MergeConflict={path:string;local:unknown;remote:unknown};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const keyed=(x:unknown[]):x is {id:string}[]=>x.every(v=>object(v)&&typeof v.id==='string')&&new Set(x.map(v=>(v as {id:string}).id)).size===x.length;

/** Three-way merge. Omitted records conflict with edits rather than resurrecting them. */
export function mergePlanner(base:PlannerState,local:PlannerState,remote:PlannerState,choices:Record<string,'local'|'remote'>={}){
 const conflicts:MergeConflict[]=[];
 function visit(b:unknown,l:unknown,r:unknown,path:string):unknown{
  if(same(l,r)||same(b,r))return structuredClone(l);
  if(same(b,l))return structuredClone(r);
  const conflict=()=>{if(choices[path])return structuredClone(choices[path]==='local'?l:r);conflicts.push({path,local:l,remote:r});return structuredClone(l)};
  // Scheduling, classification and a live timer are indivisible semantic units.
  if(path==='activeSession')return conflict();
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)&&keyed(b)&&keyed(l)&&keyed(r)){
   const out:unknown[]=[];for(const id of new Set([...r,...l,...b].map(v=>v.id))){const value=visit(b.find(v=>v.id===id),l.find(v=>v.id===id),r.find(v=>v.id===id),`${path}[${id}]`);if(value!==undefined)out.push(value)}return out;
  }
  if(object(b)&&object(l)&&object(r)){
   // A deletion and an edit of the same task require one coherent choice.
   if(/^tasks\[[^\]]+\]$/.test(path)&&!!l.deletedAt!==!!r.deletedAt&&!!l.deletedAt!==!!b.deletedAt&& !same(b,r))return conflict();
   if(/^tasks\[[^\]]+\]$/.test(path)&&!!l.deletedAt!==!!r.deletedAt&&!!r.deletedAt!==!!b.deletedAt&& !same(b,l))return conflict();
   if(path.startsWith('tasks[')&&!path.includes('].')){
    const groups=[['listId','subjectId','area'],['plannedOn','plannedTime','plannedEnd'],['done','completedAt','occurrence','recurrenceState','remoteDue','skipHistory','deletedAt']];
    const out:Record<string,unknown>={},used=new Set<string>();
    for(const fields of groups){if(!fields.some(k=>k in b||k in l||k in r))continue;const pick=(v:Record<string,unknown>)=>Object.fromEntries(fields.map(k=>[k,v[k]]));const value=visit(pick(b),pick(l),pick(r),`${path}.${fields[0]}Group`) as Record<string,unknown>;Object.assign(out,value);fields.forEach(k=>used.add(k));}
    for(const k of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)]))if(!used.has(k))out[k]=visit(b[k],l[k],r[k],`${path}.${k}`);
    return out;
   }
   // Semantic groups must not be split into individually compatible fields.
   if(path.endsWith('Group'))return conflict();
   return Object.fromEntries([...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])].map(k=>[k,visit(b[k],l[k],r[k],path?`${path}.${k}`:k)]));
  }
  return conflict();
 }
 const state=visit(base,local,remote,'') as PlannerState;
 // A subject's chosen destination owns its linked task membership. Otherwise
 // independent conflict choices could leave a task in another subject's part.
 for(const task of state.tasks){const subject=state.subjects.find(s=>s.id===task.subjectId);if(subject){task.listId=subject.listId;task.area=subject.title;}}
 // Finishing the same focus session on another device cannot resurrect it.
 if(state.sessions.some(s=>s.id===(state.activeSession?.id||base.activeSession?.id))){state.activeSession=null;const index=conflicts.findIndex(c=>c.path==='activeSession');if(index>=0)conflicts.splice(index,1);}
 // Reward activity is derived from the selected completion, never merged independently.
 for(const task of state.tasks){const id=`task:${task.id}${task.recurring?':'+task.occurrence:''}`;const reward=state.rewards.find(r=>r.id===id);if(reward)reward.active=task.done&&!task.deletedAt;}
 for(const reward of state.rewards)if(reward.id.startsWith('habit:')){const key=reward.id.slice('habit:'.length);if(key in state.habitChecks)reward.active=state.habitChecks[key];}
 // Unsent provider jobs follow the user's merged choice. Already attempted
 // commands are immutable because their UUIDs may have reached Todoist.
 for(const job of state.outbox){
  if(job.provider!=='todoist'||job.attemptedAt||job.payload.commands||job.attempts>0)continue;
  if(job.action==='task.upsert'){const task=state.tasks.find(t=>t.id===job.entityId);if(task)job.payload.task=structuredClone(task);}
  if(job.action==='section.upsert'){const subject=state.subjects.find(s=>s.id===job.entityId);if(subject){job.payload.title=subject.title;job.payload.listId=subject.listId;}}
  if(job.action==='project.upsert'){const part=state.lists.find(p=>p.id===job.entityId);if(part)job.payload.title=part.title;}
 }
 if(!conflicts.length)reconcileEconomy(state);
 return {state,conflicts};
}
