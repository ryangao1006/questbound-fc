import {moveTaskWindow,syncTaskWindow} from './task-window.ts';
import {migrateState,localDay,type PlannerState,type Task,type OutboxItem} from './model.ts';
import {makeTask,reduceCommand,rebuildReminders} from './domain.ts';
import {renameSubject} from './subjects.ts';
import {todoistWorkDay,todoistWorkTime,todoistDeadline,rescheduleTodoistDue} from './todoist-dates.ts';
export type TodoistProject={id:string;name:string;parent_id?:string|null;is_deleted?:boolean|number;is_archived?:boolean|number;inbox_project?:boolean;is_inbox_project?:boolean};
export type TodoistSection={id:string;project_id:string;name:string;is_deleted?:boolean|number;is_archived?:boolean|number};
export type TodoistDue={date:string;string?:string;is_recurring?:boolean;timezone?:string|null;lang?:string;[key:string]:unknown};
export type TodoistItem={id:string;content:string;description?:string;project_id:string;section_id?:string|null;parent_id?:string|null;priority:number;checked?:boolean|number;is_deleted?:boolean|number;due?:TodoistDue|null;deadline?:{date:string}|null;updated_at?:string;verification_at?:string;completed_count?:number;postponed_count?:number};
export type TodoistSync={sync_token:string;full_sync?:boolean;items?:TodoistItem[];projects?:TodoistProject[];sections?:TodoistSection[];sync_status?:Record<string,'ok'|{error:string;error_code?:number}>;temp_id_mapping?:Record<string,string>};
export type TodoistCache={items:TodoistItem[];projects:TodoistProject[];sections:TodoistSection[]};
export const isFlag=(value:unknown)=>value===true||value===1;
export function mergeTodoistCache(previous:Partial<TodoistCache>|null,data:TodoistSync):TodoistCache{
 const merge=<T extends {id:string}>(old:T[]|undefined,next:T[]|undefined)=>[...new Map([...(old||[]),...(next||[])].map(x=>[x.id,structuredClone(x)])).values()];
 // Preserve completed/deleted deltas that full active-item snapshots omit.
 const projects=merge(previous?.projects,data.projects),sections=merge(previous?.sections,data.sections);if(data.full_sync){if(data.projects)for(const p of projects)if(!data.projects.some(x=>x.id===p.id))p.is_archived=true;if(data.sections)for(const p of sections)if(!data.sections.some(x=>x.id===p.id))p.is_archived=true;}return {projects,sections,items:merge(previous?.items,data.items)};
}
const aliases:Record<string,string>={'AS/A-level Maths':'Mathematics','NEC Economics':'Economics (NEC)'};
const pending=(s:PlannerState,id:string)=>s.outbox.some(o=>o.provider==='todoist'&&o.entityId===id);
function structureConflict(s:PlannerState,id:string,title:string){for(const job of s.outbox.filter(o=>o.provider==='todoist'&&o.entityId===id&&!o.attemptedAt&&!o.payload.force)){if(job.payload.baseTitle!==undefined&&job.payload.baseTitle!==title&&job.payload.title!==title){job.conflict=true;job.status='error';job.error='This name changed in Todoist too. Review both versions before retrying.'}}}
export function reconcileTodoist(input:PlannerState,cache:TodoistCache,now=new Date()):PlannerState{
 let s=migrateState(structuredClone(input));
 for(const project of cache.projects){
  let list=s.lists.find(l=>l.projectId===project.id);
  if(!list&&!isFlag(project.is_deleted)){
   // Reuse the original school container, keeping its task and history IDs intact.
   list=project.name==='School Tasks'?s.lists.find(l=>l.id==='school'&&!l.projectId&&l.title==='School'):undefined;
   if(!list){list={id:`todoist-project:${project.id}`,title:project.name,mode:'sync',projectId:project.id};s.lists.push(list)}
   list.projectId=project.id;list.mode='sync';
  }
  if(!list)continue;
  if(pending(s,list.id))structureConflict(s,list.id,project.name);if(!pending(s,list.id)){if(project.name)list.title=project.name;list.archived=isFlag(project.is_archived)||isFlag(project.is_deleted)}
  if(!pending(s,list.id))list.syncBaseTitle=project.name;list.inbox=!!(project.inbox_project||project.is_inbox_project);if(!s.outbox.some(o=>o.provider==='todoist'&&o.entityId===list!.id&&o.action==='project.move'))list.parentId=project.parent_id||undefined;
 }
 for(const section of cache.sections){const known=s.subjects.find(x=>x.remoteId===section.id);const list=s.lists.find(l=>l.projectId===section.project_id||(isFlag(section.is_deleted)||!section.project_id)&&l.id===known?.listId);if(!list)continue;let subject=s.subjects.find(x=>x.remoteId===section.id);
  if(!subject&&!isFlag(section.is_deleted)){subject=s.subjects.find(x=>x.listId===list.id&&x.seeded&&!x.remoteId&&(x.title===section.name||aliases[x.title]===section.name));if(!subject){subject={id:`todoist-section:${section.id}`,title:section.name,listId:list.id};s.subjects.push(subject)}subject.remoteId=section.id;subject.seeded=false;}
  if(!subject)continue;if(pending(s,subject.id)){structureConflict(s,subject.id,section.name);continue;}
  if(subject.listId!==list.id){subject.listId=list.id;for(const t of s.tasks.filter(t=>t.subjectId===subject!.id))t.listId=list.id;}
  if(section.name){renameSubject(s,subject,section.name);subject.syncBaseTitle=section.name;}subject.archived=isFlag(section.is_deleted)||isFlag(section.is_archived)||!!list.archived;
 }
 for(const subject of s.subjects)if(subject.seeded&&!subject.remoteId&&s.lists.find(l=>l.id===subject.listId)?.projectId)subject.archived=true;
 for(const task of s.tasks){if(!task.subjectId&&s.lists.find(l=>l.id===task.listId)?.projectId){const subject=s.subjects.find(x=>!x.archived&&x.listId===task.listId&&(x.title===task.area||x.title===aliases[task.area]));if(subject){task.subjectId=subject.id;task.area=subject.title}}}
 for(const part of s.lists){const empty=!s.tasks.some(t=>t.listId===part.id)&&!s.sessions.some(r=>s.tasks.find(t=>t.id===r.taskId)?.listId===part.id);if(['school','beyond','life','projects'].includes(part.id)&&!part.projectId&&empty){part.archived=true;for(const subject of s.subjects.filter(x=>x.listId===part.id))subject.archived=true;}}
 // A deleted project is an explicit deletion of its remaining tasks; Todoist may omit
 // individual child tombstones when the parent is removed in the same sync window.
 const deletedProjects=new Set(cache.projects.filter(p=>isFlag(p.is_deleted)).map(p=>p.id));
 const items=cache.items.map(item=>{const section=cache.sections.find(x=>x.id===item.section_id&&!isFlag(x.is_deleted));return section&&section.project_id!==item.project_id?{...item,project_id:section.project_id}:item});for(const task of s.tasks)if(task.remoteId&&!items.some(item=>item.id===task.remoteId)&&deletedProjects.has(task.remoteProjectId||s.lists.find(p=>p.id===task.listId)?.projectId||''))items.push({id:task.remoteId,project_id:task.remoteProjectId,is_deleted:true} as TodoistItem);
 for(const raw of items){const existing=s.tasks.find(t=>t.remoteId===raw.id),parent=raw.project_id||existing?.remoteProjectId||s.lists.find(p=>p.id===existing?.listId)?.projectId;const item=parent&&deletedProjects.has(parent)?{...raw,is_deleted:true}:raw;
  let task=s.tasks.find(t=>t.remoteId===item.id);if(task?.subjectId&&s.outbox.some(o=>o.provider==='todoist'&&o.entityId===task!.subjectId&&o.action==='section.move'))continue;const list=s.lists.find(l=>l.mode==='sync'&&(l.projectId===item.project_id||(isFlag(item.is_deleted)||!item.project_id)&&l.id===task?.listId));
  if(!list)continue;const subject=s.subjects.find(x=>x.remoteId===item.section_id&&x.listId===list.id);
  const previousDue=task?.remoteDue;
  const previousDeadline=typeof task?.syncBase?.deadline==='string'?task.syncBase.deadline:task?.deadline;
  const incoming:Record<string,unknown>={title:item.content,notes:item.description||'',plannedOn:todoistWorkDay(item.due,s.settings.timezone),plannedTime:todoistWorkTime(item.due,s.settings.timezone),deadline:todoistDeadline(item.deadline?.date,previousDeadline,s.settings.timezone),deadlineConfirmed:!!item.deadline,priority:Math.max(0,(item.priority||1)-1),listId:list.id,subjectId:subject?.id};
  if(task){if(!isFlag(item.is_deleted)){if(Number.isInteger(item.completed_count)&&item.completed_count!>=0){task.recurrenceState??={scopes:{},dues:{}};task.recurrenceState.observedCount=item.completed_count;}task.remoteDue=item.due?{...item.due}:undefined;task.remoteProjectId=item.project_id;task.remoteSectionId=item.section_id||undefined;task.remoteParentId=item.parent_id||undefined;}
   if(pending(s,task.id)){if(isFlag(item.is_deleted)){for(const o of s.outbox.filter(o=>o.provider==='todoist'&&o.entityId===task!.id)){o.conflict=true;o.status='error';o.error='This task was deleted in Todoist. Review it before retrying.'}continue;}for(const job of s.outbox.filter(o=>o.provider==='todoist'&&o.entityId===task!.id&&!o.attemptedAt&&!o.payload.force)){const fields=(job.payload.fields||[]) as string[];const local=(job.payload.task||{}) as Record<string,unknown>;if(task.syncBase&&fields.some(k=>JSON.stringify(task!.syncBase![k])!==JSON.stringify(incoming[k])&&JSON.stringify(local[k])!==JSON.stringify(incoming[k]))){job.conflict=true;job.status='error';job.error='This task changed in Todoist too. Review both versions before retrying.';}}continue;}
  }
  if(isFlag(item.is_deleted)){if(task&&!task.deletedAt){s=reduceCommand(s,{type:'task.delete',id:task.id},now);s.outbox=s.outbox.filter(o=>o.entityId!==task!.id);}continue;}
  if(!task){if(isFlag(item.checked)||list.archived)continue;task=makeTask({id:`todoist-task:${item.id}`,title:item.content,listId:list.id,area:subject?.title||'Projects',subjectId:subject?.id,remoteId:item.id,needsReview:true,sources:[{title:'Todoist',url:`https://app.todoist.com/app/task/${item.id}`}]},now);s.tasks.push(task)}
  if(task.deletedAt)continue;
  if(item.due?.is_recurring){
   const history=task.recurrenceState??={scopes:{},dues:{}};
   const count=Number.isInteger(item.completed_count)&&item.completed_count!>=0?item.completed_count:undefined;
   task.occurrence??=item.due.date;
   if(count!==undefined){
    history.observedCount=count;
    if(history.count===undefined){history.count=count;history.scopes[count]=task.occurrence;}
    else if(count!==history.count){
     const previous=history.count;
     if(count>previous){
      // Only observed completion evidence can open another reward scope. A reschedule cannot.
      if(task.remoteDue)history.dues[previous]??=structuredClone(task.remoteDue);
      if(!task.done){s=reduceCommand(s,{type:'task.toggle',id:task.id,done:true},now);s.outbox=s.outbox.filter(o=>o.entityId!==task!.id);task=s.tasks.find(t=>t.remoteId===item.id)!;}
      if(count>previous+1)task.needsReview=true;
     }else{
      for(let n=count;n<previous;n++){const scope=history.scopes[n],reward=s.rewards.find(r=>r.id===`task:${task!.id}:${scope}`);if(reward)reward.active=false;}
     }
     const h=task.recurrenceState!;h.count=count;h.scopes[count]??=`todoist:${item.id}:completion:${count}`;task.occurrence=h.scopes[count];task.done=false;delete task.completedAt;delete task.startedAt;
    }
    task.recurrenceState!.scopes[count]??=task.occurrence!;
    task.recurrenceState!.dues[count]=structuredClone(item.due);
   }else if(previousDue?.date!==item.due.date&&task.done){task.needsReview=true;}
  }
  const windowBefore=structuredClone(task);Object.assign(task,incoming);moveTaskWindow(windowBefore,task,s.settings.timezone);task.area=subject?.title||'No subject';task.subjectId=subject?.id;task.remoteDue=item.due?{...item.due}:undefined;task.remoteProjectId=item.project_id;task.remoteSectionId=item.section_id||undefined;task.remoteParentId=item.parent_id||undefined;task.recurring=!!item.due?.is_recurring;if(!task.recurring)task.occurrence=undefined;task.syncBase={...incoming};syncTaskWindow(s,task);
  if(!task.recurring&&item.checked!==undefined&&task.done!==isFlag(item.checked)){s=reduceCommand(s,{type:'task.toggle',id:task.id,done:isFlag(item.checked)},now);s.outbox=s.outbox.filter(o=>o.entityId!==task!.id);}
 }
 s.connections.todoist={...s.connections.todoist,connected:true,twoWaySubjects:true,structureSyncedAt:now.toISOString(),lastSync:now.toISOString(),error:undefined,projects:cache.projects.filter(p=>!isFlag(p.is_deleted)&&!isFlag(p.is_archived)).map(p=>({id:p.id,name:p.name}))};
 return rebuildReminders(s,now);
}
export type SyncCommand={type:string;uuid:string;args:Record<string,unknown>;temp_id?:string};
export async function commandUUID(operation:string,step:string){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(operation+':'+step));const hex=Array.from(new Uint8Array(raw)).map(n=>n.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;}
export async function buildTodoistCommands(job:OutboxItem,s:PlannerState):Promise<SyncCommand[]>{
 if(job.payload.commands)return structuredClone(job.payload.commands) as SyncCommand[];
 if(job.action==='project.move'){const part=s.lists.find(l=>l.id===job.entityId),parent=job.payload.parentId?s.lists.find(l=>l.id===job.payload.parentId):undefined;if(!part?.projectId||job.payload.parentId&&!parent?.projectId)throw new Error('Waiting for the part to finish syncing.');return [{type:'project_move',uuid:job.id,args:{id:part.projectId,parent_id:parent?.projectId||null}}]}
 if(job.action==='section.move'){const subject=s.subjects.find(x=>x.id===job.entityId),part=s.lists.find(l=>l.id===String(job.payload.listId));if(!subject?.remoteId||!part?.projectId)throw new Error('Waiting for the subject and part to finish syncing.');return [{type:'section_move',uuid:job.id,args:{id:subject.remoteId,project_id:part.projectId}}]}
 if(job.action==='project.upsert'){const list=s.lists.find(l=>l.id===job.entityId);if(!list)throw new Error('Part no longer exists.');return [{type:list.projectId?'project_update':'project_add',uuid:job.id,...(!list.projectId?{temp_id:await commandUUID(job.id,'temp')}:{}),args:{...(list.projectId?{id:list.projectId}:{}),name:job.payload.title||list.title}}]}
 if(job.action==='section.upsert'){const subject=s.subjects.find(x=>x.id===job.entityId),list=s.lists.find(l=>l.id===subject?.listId);if(!subject||!list?.projectId)throw new Error('Waiting for the part to finish syncing.');return [{type:subject.remoteId?'section_update':'section_add',uuid:job.id,...(!subject.remoteId?{temp_id:await commandUUID(job.id,'temp')}:{}),args:{...(subject.remoteId?{id:subject.remoteId}:{project_id:list.projectId}),name:job.payload.title||subject.title}}]}
 const current=s.tasks.find(t=>t.id===job.entityId);if(!current)return [];
 const task=(job.payload.task||current) as Task;const part=s.lists.find(l=>l.id===task.listId),subject=s.subjects.find(x=>x.id===task.subjectId);
 if(job.action!=='task.upsert'){if(!current.remoteId)throw new Error('Waiting for the task to finish syncing.');if(task.recurring&&job.action==='task.close'){
   const base=task.recurrenceState?.count,observed=current.recurrenceState?.observedCount;
   if(base!==undefined&&observed!==undefined&&observed>base)return [];
   if(base!==undefined&&observed!==undefined&&observed<base)throw new Error('The recurring completion changed in Todoist. Review it before retrying.');
   if(observed===undefined&&current.remoteDue?.date!==task.remoteDue?.date&&current.remoteDue?.date!==current.recurrenceState?.acknowledgedDue?.date)throw new Error('The recurring completion could not be verified. This change remains queued.');
  }
  if(task.recurring&&job.action==='task.reopen')return [{type:'item_update_date_complete',uuid:job.id,args:{id:current.remoteId,due:current.recurrenceState?.dues[String(task.recurrenceState?.count)]||task.remoteDue||null,is_forward:0}}];
  return [{type:job.action==='task.close'?'item_close':job.action==='task.reopen'?'item_uncomplete':'item_delete',uuid:job.id,args:{id:current.remoteId}}]}
 if(!part?.projectId||task.subjectId&&!subject?.remoteId)throw new Error('Waiting for the subject to finish syncing.');
 const fields=(job.payload.fields||['title','notes','priority','plannedOn','plannedTime','deadline','deadlineConfirmed','listId','subjectId']) as string[];const create=!current.remoteId;const args:Record<string,unknown>=create?{project_id:part.projectId,...(subject?.remoteId?{section_id:subject.remoteId}:{})}:{id:current.remoteId};
 if(create||fields.includes('title'))args.content=task.title;if(create||fields.includes('notes'))args.description=task.notes;if(create||fields.includes('priority'))args.priority=task.priority+1;
 if((create&&task.plannedOn)||!create&&(fields.includes('plannedOn')||fields.includes('plannedTime')))args.due=rescheduleTodoistDue(current.remoteDue,task.plannedOn,s.settings.timezone,create||fields.includes('plannedTime')?task.plannedTime:undefined);
 if(create&&task.deadline&&task.deadlineConfirmed||!create&&(fields.includes('deadline')||fields.includes('deadlineConfirmed')))args.deadline=task.deadline&&task.deadlineConfirmed?{date:localDay(task.deadline,s.settings.timezone)}:null;
 const result:SyncCommand[]=[];
 if(!create&&(fields.includes('listId')||fields.includes('subjectId'))){const move:Record<string,unknown>={id:current.remoteId};if(subject?.remoteId)move.section_id=subject.remoteId;else move.project_id=part.projectId;result.push({type:'item_move',uuid:await commandUUID(job.id,'move'),args:move});}
 if(create||Object.keys(args).length>1)result.push({type:create?'item_add':'item_update',uuid:result.length?await commandUUID(job.id,'fields'):job.id,args,...(create?{temp_id:await commandUUID(job.id,'temp')}:{})});return result;
}

/** Verify missing project children explicitly: full active snapshots cannot distinguish completion from deletion. */
export async function verifyTodoistProjectChildren(cache:TodoistCache,state:PlannerState,read:(id:string)=>Promise<{status:number;item?:TodoistItem}>,now=new Date()):Promise<TodoistCache>{
 const next=structuredClone(cache),candidates=state.tasks.filter(t=>t.remoteId&&!t.deletedAt&&!state.outbox.some(o=>o.provider==='todoist'&&o.entityId===t.id)).map(task=>({task,item:next.items.find(i=>i.id===task.remoteId)})).filter(({task,item})=>{const project=next.projects.find(p=>p.id===(item?.project_id||task.remoteProjectId));return project&&(isFlag(project.is_archived)||isFlag(project.is_deleted))&&!isFlag(item?.is_deleted)&&(!item?.verification_at||Date.parse(item.verification_at)<now.getTime()-300000)}).slice(0,8);
 await Promise.all(candidates.map(async({task,item})=>{const response=await read(task.remoteId!);let verified:TodoistItem;if(response.status===404||response.status===410)verified={...item,id:task.remoteId!,project_id:item?.project_id||task.remoteProjectId,is_deleted:true,verification_at:now.toISOString()} as TodoistItem;else if(response.status===200&&response.item&&response.item.id===task.remoteId)verified={...item,...response.item,verification_at:now.toISOString()};else throw new Error('Todoist task availability could not be verified. Previous records are preserved.');const at=next.items.findIndex(i=>i.id===task.remoteId);if(at<0)next.items.push(verified);else next.items[at]=verified;}));return next;
}

/** Due dates are scheduling, never completion receipts. Hydrate optional counters before recurrence reconciliation. */
export async function verifyTodoistRecurringTasks(cache:TodoistCache,state:PlannerState,read:(id:string)=>Promise<{status:number;item?:TodoistItem}>,now=new Date()):Promise<TodoistCache>{
 const next=structuredClone(cache),candidates=next.items.filter(item=>item.due?.is_recurring&&!isFlag(item.is_deleted)).filter(item=>{const task=state.tasks.find(t=>t.remoteId===item.id);return !Number.isInteger(item.completed_count)&&(!task?.recurrenceState||task.remoteDue?.date!==item.due?.date||state.outbox.some(o=>o.entityId===task.id))&&(!item.verification_at||Date.parse(item.verification_at)<now.getTime()-30000)}).slice(0,8);
 await Promise.all(candidates.map(async item=>{const result=await read(item.id);if(result.status!==200||result.item?.id!==item.id)throw new Error('Todoist task availability could not be verified. Previous records are preserved.');Object.assign(item,result.item,{verification_at:now.toISOString()})}));return next;
}

export function acknowledgeTodoist(s:PlannerState,job:OutboxItem,commands:SyncCommand[],mapping:Record<string,string>){const creation=commands.find(c=>c.temp_id),remoteId=creation?mapping[creation.temp_id!]:undefined;
 if(creation&&!remoteId)throw new Error('Todoist accepted this request without returning its mapping. It will be retried with the same operation ID.');
 if(job.action==='section.move'){const subject=s.subjects.find(x=>x.id===job.entityId),part=s.lists.find(l=>l.id===job.payload.listId);if(subject&&part)for(const task of s.tasks.filter(t=>t.subjectId===subject.id)){task.remoteProjectId=part.projectId;task.remoteSectionId=subject.remoteId;if(task.syncBase)task.syncBase={...task.syncBase,listId:part.id,subjectId:subject.id};}return s;}
 if(job.action==='project.move'){const part=s.lists.find(l=>l.id===job.entityId),parent=s.lists.find(l=>l.id===job.payload.parentId);if(part)part.parentId=parent?.projectId||undefined;return s;}
 if(job.action==='project.upsert'){const list=s.lists.find(l=>l.id===job.entityId);if(list&&remoteId)list.projectId=remoteId;}
 else if(job.action==='section.upsert'){const subject=s.subjects.find(x=>x.id===job.entityId);if(subject&&remoteId)subject.remoteId=remoteId;}
 else {const task=s.tasks.find(t=>t.id===job.entityId);if(task){if(remoteId)task.remoteId=remoteId;if(job.action==='task.upsert'){const snapshot=(job.payload.task||task) as Task;const fields=(job.payload.fields||['title','notes','priority','plannedOn','plannedTime','deadline','deadlineConfirmed','listId','subjectId']) as string[];const values=snapshot as unknown as Record<string,unknown>;task.syncBase={...task.syncBase,...Object.fromEntries(fields.map(k=>[k,values[k]]))};const dueCommand=commands.find(c=>c.type==='item_update'||c.type==='item_add');if(dueCommand&&'due' in dueCommand.args){task.remoteDue=dueCommand.args.due?structuredClone(dueCommand.args.due) as Record<string,unknown>:undefined;if(task.recurring){task.recurrenceState??={scopes:{},dues:{}};task.recurrenceState.acknowledgedDue=task.remoteDue;if(task.remoteDue&&task.recurrenceState.count!==undefined)task.recurrenceState.dues[task.recurrenceState.count]=structuredClone(task.remoteDue);}}}}}
 return s;
}
