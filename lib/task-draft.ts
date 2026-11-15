import type {Task} from './model.ts';

export const TASK_DRAFT_FIELDS = ['title','notes','listId','subjectId','area','plannedOn','plannedTime','plannedEnd','deadline','deadlineConfirmed','estimate','priority','main','subtasks','sources','needsReview','reminders'] as const;
export type DraftField = typeof TASK_DRAFT_FIELDS[number];
export type TaskDraft = {version:1;taskId:string|null;draftId:string;base:Partial<Task>;value:Partial<Task>;updatedAt:number;legacy?:boolean};
const classification:DraftField[] = ['listId','subjectId','area'];
const scheduling:DraftField[]=['plannedOn','plannedTime','plannedEnd'];
const groups:DraftField[][] = [classification,scheduling,...TASK_DRAFT_FIELDS.filter(k=>!classification.includes(k)&&!scheduling.includes(k)).map(k=>[k])];
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const pick=(task:Partial<Task>)=>{const value=Object.fromEntries(TASK_DRAFT_FIELDS.filter(k=>k in task).map(k=>[k,task[k]])) as Partial<Task>;if(value.sources!==undefined&&(!Array.isArray(value.sources)||value.sources.some(source=>!source||typeof source.title!=='string'||typeof source.url!=='string')))delete value.sources;return value};
const matches=(a:Partial<Task>,b:Partial<Task>,keys:DraftField[])=>keys.every(k=>same(k==='subjectId'?a[k]||'':a[k],k==='subjectId'?b[k]||'':b[k]));

export function newTaskDraft(task:Partial<Task>,draftId:string,now=Date.now()):TaskDraft {
 return {version:1,taskId:task.id||null,draftId:task.id||draftId,base:pick(task),value:pick(task),updatedAt:now};
}
export function readTaskDraft(raw:string|null,task:Partial<Task>,draftId:string,now=Date.now()):TaskDraft {
 const fresh=newTaskDraft(task,draftId,now);if(!raw)return fresh;
 try{const saved=JSON.parse(raw);if(!object(saved))return fresh;
  if(saved.version===1){if(saved.taskId!==fresh.taskId||typeof saved.draftId!=='string'||!saved.draftId||!object(saved.base)||!object(saved.value))return fresh;
   return {...fresh,draftId:task.id||saved.draftId,base:pick(saved.base),value:pick(saved.value),updatedAt:Number(saved.updatedAt)||now,legacy:!!saved.legacy};
  }
  // Old drafts have no original baseline: require review of differing fields.
  if(saved.id&&task.id&&saved.id!==task.id)return fresh;
  return {...fresh,draftId:task.id||(typeof saved.id==='string'?saved.id:draftId),value:{...fresh.value,...pick(saved)},legacy:!!task.id};
 }catch{return fresh;}
}
export function mergeTaskDraft(record:TaskDraft,latest:Partial<Task>){
 const base={...record.base},value={...record.value},conflicts:DraftField[]=[];
 for(const keys of groups){const edited=!matches(record.base,record.value,keys);
  if(!edited){for(const key of keys){(base as Record<string,unknown>)[key]=latest[key];(value as Record<string,unknown>)[key]=latest[key];}}
  else if(record.taskId&&!matches(latest,record.value,keys)&&(record.legacy||!matches(latest,record.base,keys)))conflicts.push(...keys.filter(k=>!same(latest[k],record.value[k])));
 }
 return {record:{...record,base,value},conflicts};
}
export function taskDraftPatch(base:Partial<Task>,value:Partial<Task>){
 const keys=TASK_DRAFT_FIELDS.filter(k=>!same(base[k],value[k]));
 if(keys.some(k=>scheduling.includes(k)))for(const key of scheduling)if(!keys.includes(key))keys.push(key);
 if(keys.some(k=>classification.includes(k)))for(const key of classification)if(!keys.includes(key))keys.push(key);
 return {patch:Object.fromEntries(keys.map(k=>[k,k==='subjectId'?value[k]||'':value[k]])) as Partial<Task>,base:Object.fromEntries(keys.map(k=>[k,base[k]])) as Partial<Task>};
}
export function resolveTaskDraft(record:TaskDraft,latest:Partial<Task>,keepEdits:boolean,now=Date.now()):TaskDraft {
 const {record:merged,conflicts}=mergeTaskDraft(record,latest),value={...merged.value};
 if(!keepEdits)for(const key of conflicts)(value as Record<string,unknown>)[key]=latest[key];
 return {...merged,base:pick(latest),value,legacy:false,updatedAt:now};
}
