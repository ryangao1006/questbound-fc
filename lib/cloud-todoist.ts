import {OneDriveSnapshotStore,CloudStorageError,type CloudSnapshot,type CloudPayload} from './onedrive-storage.ts';
import {mergeTodoistCache,reconcileTodoist,verifyTodoistProjectChildren,verifyTodoistRecurringTasks,buildTodoistCommands,acknowledgeTodoist,isFlag,type TodoistSync,type TodoistCache,type TodoistItem} from './todoist-sync.ts';
import {makeTask} from './domain.ts';
import {initialState} from './model.ts';
import {todoistWorkDay,todoistWorkTime,todoistDeadline} from './todoist-dates.ts';
const resources=JSON.stringify(['items','projects','sections']);
/** Execute under the same durable account coordinator as planner commits. Token is supplied from the encrypted vault. */
export class CloudTodoist {
 private store:OneDriveSnapshotStore;private accountId:string;private token:string;private fetcher:typeof fetch;
 constructor(store:OneDriveSnapshotStore,accountId:string,token:string,fetcher:typeof fetch=fetch){this.store=store;this.accountId=accountId;this.token=token;this.fetcher=fetcher;}
 private async current(){const s=await this.store.read(this.accountId);if(!s)throw new CloudStorageError('CLOUD_NOT_INITIALIZED',409);return s;}
 private async save(previous:CloudSnapshot,payload:CloudPayload){return this.store.commit({accountId:this.accountId,baseRevision:previous.revision,operationId:crypto.randomUUID(),payload});}
 private async request(form:Record<string,string>):Promise<TodoistSync>{
  const response=await this.fetcher('https://api.todoist.com/api/v1/sync',{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new CloudStorageError(response.status===401?'TODOIST_RECONNECT':'TODOIST_UNAVAILABLE',response.status===401?401:502);
  const data=await response.json() as TodoistSync;
  if(typeof data.sync_token!=='string'||data.full_sync&&(!Array.isArray(data.items)||!Array.isArray(data.sections)||!Array.isArray(data.projects)))throw new CloudStorageError('TODOIST_RESPONSE_INCOMPLETE',502);return data;
 }
 private async readItem(id:string){const response=await this.fetcher('https://api.todoist.com/api/v1/tasks/'+encodeURIComponent(id),{headers:{Authorization:`Bearer ${this.token}`},signal:AbortSignal.timeout(20000)});return {status:response.status,...(response.ok?{item:await response.json() as TodoistItem}:{})};}
 async connect(){if(!this.token||this.token.length>1000)throw new CloudStorageError('TODOIST_TOKEN_INVALID',400);const data=await this.request({sync_token:'*',resource_types:resources}),cache=mergeTodoistCache(null,data);const existing=await this.store.read(this.accountId),s=existing||await this.store.commit({accountId:this.accountId,baseRevision:0,operationId:crypto.randomUUID(),payload:{planner:initialState()}});return this.save(s,{...s.payload,planner:reconcileTodoist(s.payload.planner,cache),integrations:{...s.payload.integrations,todoist:{cache,syncToken:data.sync_token}}});}
 async disconnect(){const s=await this.current(),p=structuredClone(s.payload);p.planner.connections.todoist={connected:false};if(p.integrations)delete p.integrations.todoist;return this.save(s,p);}
 async preview(projectId:string){const data=await this.request({sync_token:'*',resource_types:resources}),s=await this.current();return {projects:data.projects||[],items:(data.items||[]).filter(i=>i.project_id===projectId&&!isFlag(i.checked)&&!isFlag(i.is_deleted)).map(i=>({id:i.id,title:i.content,notes:i.description||'',sectionId:i.section_id,plannedOn:todoistWorkDay(i.due,s.payload.planner.settings.timezone),deadline:i.deadline?.date||''}))};}
 async importProject(projectId:string,mode:'import'|'sync',selected:string[]){
  const s=await this.current(),data=await this.request({sync_token:'*',resource_types:resources}),project=data.projects?.find(p=>p.id===projectId&&!isFlag(p.is_deleted));if(!project)throw new CloudStorageError('TODOIST_PROJECT_INVALID',400);
  const p=structuredClone(s.payload),state=p.planner;let list=state.lists.find(l=>l.projectId===projectId);if(!list){list={id:'todoist-project:'+projectId,title:project.name,mode,projectId};state.lists.push(list)}else if(mode==='sync')list.mode='sync';
  for(const section of data.sections||[])if(section.project_id===projectId&&!isFlag(section.is_deleted)&&!state.subjects.some(x=>x.remoteId===section.id))state.subjects.push({id:'todoist-section:'+section.id,title:section.name,listId:list.id,remoteId:section.id});
  for(const item of data.items||[])if(item.project_id===projectId&&selected.includes(item.id)&&!isFlag(item.checked)&&!isFlag(item.is_deleted)&&!state.tasks.some(t=>t.remoteId===item.id)){
   const subject=state.subjects.find(x=>x.remoteId===item.section_id);state.tasks.push(makeTask({id:'todoist-task:'+item.id,title:item.content,notes:item.description||'',listId:list.id,subjectId:subject?.id,area:subject?.title||'No subject',remoteId:item.id,remoteProjectId:projectId,remoteSectionId:item.section_id||undefined,remoteDue:item.due?{...item.due}:undefined,plannedOn:todoistWorkDay(item.due,state.settings.timezone),plannedTime:todoistWorkTime(item.due,state.settings.timezone),deadline:todoistDeadline(item.deadline?.date,undefined,state.settings.timezone),deadlineConfirmed:!!item.deadline,priority:Math.max(0,item.priority-1),needsReview:true,recurring:!!item.due?.is_recurring,occurrence:item.due?.date,sources:[{title:'Todoist',url:'https://app.todoist.com/app/task/'+item.id}]},new Date()));
  }
  p.integrations={...p.integrations,todoist:{cache:mergeTodoistCache(p.integrations?.todoist?.cache||null,data),syncToken:data.sync_token}};return this.save(s,p);
 }
 private async pull(){const s=await this.current(),saved=s.payload.integrations?.todoist;const data=await this.request({sync_token:saved?.syncToken||'*',resource_types:resources});let cache:TodoistCache=mergeTodoistCache(saved?.cache||null,data);cache=await verifyTodoistProjectChildren(cache,s.payload.planner,id=>this.readItem(id));cache=await verifyTodoistRecurringTasks(cache,s.payload.planner,id=>this.readItem(id));const payload:CloudPayload={...s.payload,planner:reconcileTodoist(s.payload.planner,cache),integrations:{...s.payload.integrations,todoist:{cache,syncToken:data.sync_token}}};
  const comparable=(value:CloudPayload)=>{const clone=structuredClone(value),connection=clone.planner.connections.todoist;if(connection){delete connection.lastSync;delete connection.structureSyncedAt;}return JSON.stringify(clone)};
  if(comparable(payload)===comparable(s.payload))return s;
  return this.save(s,payload);
 }
 async sync(force=false){
  let snapshot=await this.current();if(snapshot.payload.planner.settings.integrationsPaused)throw new CloudStorageError('INTEGRATIONS_PAUSED',409);
  snapshot=await this.pull();
  // Snapshot the queue IDs: dependent creation jobs may resolve mappings in sequence.
  for(const jobId of snapshot.payload.planner.outbox.filter(j=>j.provider==='todoist').map(j=>j.id)){
   snapshot=await this.current();let job=snapshot.payload.planner.outbox.find(j=>j.id===jobId);if(!job||job.conflict||!force&&job.status==='error'&&Date.parse(job.nextAttempt)>Date.now())continue;
   try{
    if(!job.payload.commands){
     const task=snapshot.payload.planner.tasks.find(t=>t.id===job!.entityId);
     if(task?.recurring&&task.remoteId&&['task.close','task.reopen'].includes(job.action)){
      const read=await this.readItem(task.remoteId);if(read.status!==200||read.item?.id!==task.remoteId)throw new CloudStorageError('TODOIST_RECURRENCE_UNVERIFIED',502);
      const p=structuredClone(snapshot.payload),t=p.planner.tasks.find(t=>t.id===task.id)!,queued=p.planner.outbox.find(j=>j.id===jobId)!;
      t.recurrenceState??={scopes:{},dues:{}};if(Number.isInteger(read.item.completed_count)&&read.item.completed_count!>=0){t.recurrenceState.observedCount=read.item.completed_count;if(t.recurrenceState.count===undefined){t.recurrenceState.count=read.item.completed_count;t.recurrenceState.scopes[read.item.completed_count!]=t.occurrence||String(read.item.due?.date);const captured=queued.payload.task as import('./model.ts').Task;if(captured)captured.recurrenceState=structuredClone(t.recurrenceState)}}t.remoteDue=read.item.due?{...read.item.due}:undefined;snapshot=await this.save(snapshot,p);job=snapshot.payload.planner.outbox.find(j=>j.id===jobId)!;
     }
     const commands=await buildTodoistCommands(job,snapshot.payload.planner),p=structuredClone(snapshot.payload),queued=p.planner.outbox.find(j=>j.id===jobId)!;queued.payload.commands=commands;queued.attemptedAt=new Date().toISOString();snapshot=await this.save(snapshot,p);job=snapshot.payload.planner.outbox.find(j=>j.id===jobId)!;
    }
    const commands=await buildTodoistCommands(job,snapshot.payload.planner);
    if(commands.length){const result=await this.request({commands:JSON.stringify(commands),sync_token:'*',resource_types:resources});for(const command of commands)if(result.sync_status?.[command.uuid]!=='ok')throw new CloudStorageError('TODOIST_COMMAND_REJECTED',502);
     const p=structuredClone(snapshot.payload);acknowledgeTodoist(p.planner,job,commands,result.temp_id_mapping||{});p.planner.outbox=p.planner.outbox.filter(j=>j.id!==jobId);p.integrations={...p.integrations,todoist:{cache:mergeTodoistCache(p.integrations?.todoist?.cache||null,result),syncToken:result.sync_token}};snapshot=await this.save(snapshot,p);
    }else{const p=structuredClone(snapshot.payload);p.planner.outbox=p.planner.outbox.filter(j=>j.id!==jobId);snapshot=await this.save(snapshot,p);}
   }catch(error){
    // If the acknowledged receipt could not be committed, keep the exact saved commands.
    snapshot=await this.current();const p=structuredClone(snapshot.payload),queued=p.planner.outbox.find(j=>j.id===jobId);if(queued){queued.status='error';queued.attempts++;queued.error=error instanceof CloudStorageError?error.code:'TODOIST_SYNC_FAILED';queued.nextAttempt=new Date(Date.now()+60000).toISOString();p.planner.connections.todoist={...p.planner.connections.todoist,connected:true,error:queued.error};snapshot=await this.save(snapshot,p);}throw error;
   }
  }
  return this.pull();
 }
}
