import test from 'node:test';import assert from 'node:assert/strict';
import {initialState,migrateState,totalXP,type PlannerState} from '../lib/model.ts';
import {reduceCommand,assertState} from '../lib/domain.ts';
import {reconcileTodoist,mergeTodoistCache,verifyTodoistProjectChildren,buildTodoistCommands,acknowledgeTodoist,verifyTodoistRecurringTasks,type TodoistCache,type TodoistSync} from '../lib/todoist-sync.ts';
import {canRebaseCommand} from '../lib/command-rebase.ts';
import {todoistWorkDay,todoistDeadline,rescheduleTodoistDue} from '../lib/todoist-dates.ts';
import {newTaskDraft,taskDraftPatch} from '../lib/task-draft.ts';
import {subjectChoices,areaNames} from '../lib/subjects.ts';
import {packSnapshot,unpackSnapshot} from '../lib/archive.ts';import {newKey} from '../lib/crypto.ts';
const now=new Date('2026-11-12T10:00:00Z');
const cache:TodoistCache={projects:[{id:'p1',name:'School Tasks'},{id:'p2',name:'Classes & Events'},{id:'inbox',name:'Inbox',inbox_project:true}],sections:[{id:'physics',name:'Physics',project_id:'p1'},{id:'math',name:'Mathematics',project_id:'p1'},{id:'nec',name:'Economics (NEC)',project_id:'p1'},{id:'custom',name:'My own subject 中文',project_id:'p2'}],items:[]};
const start=()=>reconcileTodoist(initialState(),cache,now);
function add(s=start()){return reduceCommand(s,{type:'task.add',task:{id:'local-task',title:'My task',listId:'school',subjectId:s.subjects.find(x=>x.remoteId==='physics')!.id,plannedOn:'2026-11-13'}},now)}
const remote=(id='r1')=>({id,project_id:'p1',section_id:'physics',content:'Remote task',priority:2,checked:false,due:{date:'2026-11-13',string:'every day',is_recurring:true,lang:'en',timezone:'Asia/Shanghai'}});

test('full editor changes send title, subject, both dates, priority and bilingual notes together',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null,description:'Old notes',deadline:{date:'2026-11-20'}}]},now);
 const task=s.tasks[0],draft=newTaskDraft(task,'unused'),subject=s.subjects.find(x=>x.remoteId==='math')!;
 const edited={...draft.value,title:'Edited task 中文',subjectId:subject.id,area:subject.title,plannedOn:'2026-11-21',deadline:'2026-11-25T13:30:00.000Z',deadlineConfirmed:true,priority:3,notes:'First line\n中文备注 **details**'};
 const {patch,base}=taskDraftPatch(draft.base,edited);
 s=reduceCommand(s,{type:'task.edit',id:task.id,patch,base},now);
 const commands=await buildTodoistCommands(s.outbox[0],s);
 assert.equal(commands.length,2);assert.deepEqual(commands[0].args,{id:'r1',section_id:'math'});
 assert.deepEqual(commands[1].args,{id:'r1',content:edited.title,description:edited.notes,priority:4,due:{date:'2026-11-21'},deadline:{date:'2026-11-25'}});
 assert.equal(s.tasks[0].id,task.id);assert.equal(s.tasks[0].remoteId,'r1');assert.equal(s.tasks[0].done,false);assert.equal(totalXP(s),0);assertState(s);
});

test('inbound field edits, moves and all priority levels preserve identity and history',()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);
 const id=s.tasks[0].id;s.tasks[0].subtasks=[{id:'step',title:'Local step',done:false}];s.tasks[0].estimate=50;
 for(const priority of [1,2,3,4]){
  s=reconcileTodoist(s,{...cache,items:[{...remote(),project_id:'p2',section_id:'custom',content:'Todoist title 中文',description:'Todoist notes\n第二行',priority,due:{date:'2026-11-22',string:'22 Nov',is_recurring:false,lang:'en',timezone:'Asia/Shanghai'},deadline:{date:'2026-11-26'}}]},now);
  const t=s.tasks[0];assert.equal(t.id,id);assert.equal(t.title,'Todoist title 中文');assert.equal(t.notes,'Todoist notes\n第二行');assert.equal(t.plannedOn,'2026-11-22');assert.equal(t.deadline,'2026-11-26T15:59:00.000Z');assert.equal(t.deadlineConfirmed,true);assert.equal(t.priority,priority-1);assert.equal(t.area,'My own subject 中文');assert.equal(t.estimate,50);assert.equal(t.subtasks[0].id,'step');assert.equal(totalXP(s),0);
 }
 assert.equal(s.tasks.length,1);assertState(s);
});

test('clearing subject, notes and dates sends explicit removals and accepts the echo',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),description:'Notes',deadline:{date:'2026-11-25'}}]},now);
 const id=s.tasks[0].id;
 s=reduceCommand(s,{type:'task.edit',id,patch:{subjectId:'',notes:'',plannedOn:'',deadline:'',deadlineConfirmed:false,priority:0}},now);
 const commands=await buildTodoistCommands(s.outbox[0],s);
 assert.deepEqual(commands[0].args,{id:'r1',project_id:'p1'});
 assert.deepEqual(commands[1].args,{id:'r1',description:'',priority:1,due:null,deadline:null});
 s.outbox=[];s=reconcileTodoist(s,{...cache,items:[{...remote(),section_id:null,description:'',priority:1,due:null,deadline:null}]},now);
 assert.equal(s.tasks[0].subjectId,undefined);assert.equal(s.tasks[0].notes,'');assert.equal(s.tasks[0].plannedOn,'');assert.equal(s.tasks[0].deadline,'');assert.equal(s.tasks[0].deadlineConfirmed,false);assert.equal(s.tasks[0].priority,0);assert.equal(totalXP(s),0);assertState(s);
});

test('work days distinguish date-only, floating and fixed timezone timestamps around midnight',()=>{
 const zone='Asia/Shanghai';assert.equal(todoistWorkDay(null,zone),'');
 assert.equal(todoistWorkDay({date:'2026-11-21'},zone),'2026-11-21');
 assert.equal(todoistWorkDay({date:'2026-11-21T02:30:00',timezone:null},zone),'2026-11-21');
 assert.equal(todoistWorkDay({date:'2026-11-20T18:30:00Z',timezone:zone},zone),'2026-11-21');
 assert.equal(todoistWorkDay({date:'2026-11-21T02:30:00+08:00'},'America/Los_Angeles'),'2026-11-20');
 const s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:{date:'2026-11-20T18:30:00Z',timezone:zone}}]},now);
 assert.equal(s.tasks[0].plannedOn,'2026-11-21');assertState(s);
});

test('moving timed work preserves wall time, seconds and recurrence metadata across timezone offsets',async()=>{
 const due={date:'2026-11-20T18:30:12.123Z',timezone:'Asia/Shanghai',string:'every day at 02:30',is_recurring:true,lang:'en'};
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due}]},now);
 s=reduceCommand(s,{type:'task.edit',id:s.tasks[0].id,patch:{plannedOn:'2026-11-22'}},now);
 const commands=await buildTodoistCommands(s.outbox[0],s);
 assert.deepEqual(commands[0].args.due,{...due,date:'2026-11-21T18:30:12.123Z'});
 assert.deepEqual(rescheduleTodoistDue({...due,date:'2026-11-21T02:30:00',timezone:null},'2026-11-22','Asia/Shanghai'),{...due,date:'2026-11-22T02:30:00',timezone:null});
 const summer={date:'2026-10-31T17:00:00Z',timezone:'America/New_York'};
 assert.deepEqual(rescheduleTodoistDue(summer,'2026-11-02','America/New_York'),{...summer,date:'2026-11-02T18:00:00.000Z'});
 assert.equal(rescheduleTodoistDue(due,'','Asia/Shanghai'),null);
});

test('deadline echoes and remote day moves retain the local clock; provider clearing remains authoritative',()=>{
 const custom='2026-11-25T13:30:00.000Z';
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),deadline:{date:'2026-11-25'}}]},now);
 s.tasks[0].deadline=custom;s.tasks[0].syncBase!.deadline=custom;
 for(let n=0;n<2;n++)s=reconcileTodoist(s,{...cache,items:[{...remote(),description:'Unrelated remote notes',deadline:{date:'2026-11-25'}}]},now);
 assert.equal(s.tasks[0].deadline,custom);assert.equal(s.tasks[0].notes,'Unrelated remote notes');
 s=reconcileTodoist(s,{...cache,items:[{...remote(),deadline:{date:'2026-11-26'}}]},now);
 assert.equal(s.tasks[0].deadline,'2026-11-26T13:30:00.000Z');
 s=reconcileTodoist(s,{...cache,items:[{...remote(),deadline:null}]},now);assert.equal(s.tasks[0].deadline,'');assert.equal(s.tasks[0].deadlineConfirmed,false);
 assert.equal(todoistDeadline('2026-11-25',undefined,'America/New_York'),'2026-11-26T04:59:00.000Z');
});

test('a pending deadline move does not conflict with the unchanged provider date',()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),deadline:{date:'2026-11-25'}}]},now);
 s.tasks[0].deadline='2026-11-25T13:30:00.000Z';s.tasks[0].syncBase!.deadline=s.tasks[0].deadline;
 s=reduceCommand(s,{type:'task.edit',id:s.tasks[0].id,patch:{deadline:'2026-11-26T13:30:00.000Z'}},now);
 s=reconcileTodoist(s,{...cache,items:[{...remote(),deadline:{date:'2026-11-25'}}]},now);
 assert.equal(s.outbox[0].conflict,undefined);assert.equal(s.tasks[0].deadline,'2026-11-26T13:30:00.000Z');
 s=reconcileTodoist(s,{...cache,items:[{...remote(),deadline:{date:'2026-11-27'}}]},now);assert.equal(s.outbox[0].conflict,true);
});

test('Todoist projects and sections become exact part/subject choices with existing school identity',()=>{const s=start();assert.deepEqual(s.lists.filter(x=>!x.archived).map(x=>x.title).sort(),['Classes & Events','Inbox','School Tasks']);assert.equal(s.lists.find(l=>l.projectId==='p1')!.id,'school');assert.deepEqual(subjectChoices(s,'school').map(x=>x.title).sort(),['Economics (NEC)','Mathematics','Physics']);assert(!subjectChoices(s,'school').some(x=>x.title==='AS/A-level Maths'));assert(areaNames(s).includes('My own subject 中文'));assertState(s);});
test('new and renamed Todoist parts and subjects keep their stable mappings without duplication',()=>{let s=start();const before=s.subjects.find(x=>x.remoteId==='physics')!.id;const next={...cache,projects:cache.projects.map(p=>p.id==='p1'?{...p,name:'My school'}:p),sections:cache.sections.map(x=>x.id==='physics'?{...x,name:'物理'}:x)};s=reconcileTodoist(s,next,now);s=reconcileTodoist(s,next,now);assert.equal(s.lists.find(l=>l.projectId==='p1')!.title,'My school');assert.equal(s.subjects.find(x=>x.remoteId==='physics')!.id,before);assert.equal(s.subjects.filter(x=>x.remoteId==='physics').length,1);assert.equal(s.subjects.find(x=>x.id===before)!.title,'物理');});
test('site creates parts then subjects then tasks with durable dependency IDs',async()=>{let s=start();s=reduceCommand(s,{type:'part.add',part:{id:'newpart',title:'My new part'}},now);s=reduceCommand(s,{type:'subject.add',subject:{id:'newsubject',title:'New subject',listId:'newpart'}},now);s=reduceCommand(s,{type:'task.add',task:{id:'newtask',title:'A quest',listId:'newpart',subjectId:'newsubject'}},now);assert.deepEqual(s.outbox.map(o=>o.action),['project.upsert','section.upsert','task.upsert']);const project=await buildTodoistCommands(s.outbox[0],s);assert.equal(project[0].type,'project_add');assert.equal(project[0].args.name,'My new part');assert.match(project[0].temp_id!,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);assert.deepEqual(await buildTodoistCommands(s.outbox[0],s),project);await assert.rejects(()=>buildTodoistCommands(s.outbox[1],s),/Waiting for the part/);s.lists.find(l=>l.id==='newpart')!.projectId='remote-newpart';const section=await buildTodoistCommands(s.outbox[1],s);assert.equal(section[0].args.project_id,'remote-newpart');s.subjects.find(x=>x.id==='newsubject')!.remoteId='remote-newsubject';const task=await buildTodoistCommands(s.outbox[2],s);assert.equal(task[0].args.project_id,'remote-newpart');assert.equal(task[0].args.section_id,'remote-newsubject');assert.equal(s.tasks[0].area,'New subject');assertState(s);});
test('invalid cross-part subject selections are rejected and changing part clears the old subject',()=>{let s=add();const wrong=s.subjects.find(x=>x.remoteId==='custom')!.id;assert.throws(()=>reduceCommand(s,{type:'task.edit',id:'local-task',patch:{subjectId:wrong}},now),/selected part/);const part=s.lists.find(x=>x.projectId==='p2')!.id;s=reduceCommand(s,{type:'task.edit',id:'local-task',patch:{listId:part,subjectId:'',area:'Projects'}},now);assert.equal(s.tasks[0].subjectId,undefined);assert.equal(s.tasks[0].listId,part);});
test('local rename updates linked task, time block and session while retaining rewards and remote section IDs',()=>{let s=add();s.outbox=[];const subject=s.subjects.find(x=>x.remoteId==='physics')!;s.blocks.push({id:'b',taskId:'local-task',title:'Study',area:'Physics',start:now.toISOString(),end:new Date(+now+1800000).toISOString(),repeat:'none',exceptions:{}});s.sessions.push({id:'ss',taskId:'local-task',area:'Physics',startedAt:now.toISOString(),endedAt:new Date(+now+1500000).toISOString(),seconds:1500,kind:'focus'});s=reduceCommand(s,{type:'subject.rename',id:subject.id,title:'Physics revision'},now);assert.equal(s.tasks[0].area,'Physics revision');assert.equal(s.blocks[0].area,'Physics revision');assert.equal(s.sessions[0].area,'Physics revision');assert.equal(s.subjects.find(x=>x.id===subject.id)!.remoteId,'physics');assert.equal(s.outbox[0].action,'section.upsert');assert.equal(totalXP(s),0);});
test('Todoist task moves update both part and subject instead of keeping the previous selection',()=>{let s=start();s=reconcileTodoist(s,{...cache,items:[remote()]},now);const identity=s.tasks[0].id;s=reconcileTodoist(s,{...cache,items:[{...remote(),project_id:'p2',section_id:'custom',content:'Changed'}]},now);assert.equal(s.tasks[0].id,identity);assert.equal(s.tasks[0].listId,s.lists.find(x=>x.projectId==='p2')!.id);assert.equal(s.tasks[0].subjectId,s.subjects.find(x=>x.remoteId==='custom')!.id);assert.equal(s.tasks[0].area,'My own subject 中文');assert.equal(s.tasks[0].needsReview,true);assertState(s);});
test('unrelated edits preserve recurring due values, while moves use separate stable commands',async()=>{let s=reconcileTodoist(start(),{...cache,items:[remote()]},now);const id=s.tasks[0].id;s=reduceCommand(s,{type:'task.edit',id,patch:{title:'Edited title'}},now);const first=s.outbox[0];const commands=await buildTodoistCommands(first,s);assert.equal(commands[0].type,'item_update');assert(!('due'in commands[0].args));assert(!('deadline'in commands[0].args));first.attemptedAt=now.toISOString();first.payload.commands=commands;s=reduceCommand(s,{type:'task.edit',id,patch:{notes:'Another edit'}},now);assert.equal(s.outbox.length,2);assert.deepEqual(await buildTodoistCommands(s.outbox[0],s),commands);s.outbox=[];s=reduceCommand(s,{type:'task.edit',id,patch:{listId:s.lists.find(x=>x.projectId==='p2')!.id,subjectId:s.subjects.find(x=>x.remoteId==='custom')!.id}},now);const move=await buildTodoistCommands(s.outbox[0],s);assert.equal(move[0].type,'item_move');assert.equal(move[0].args.section_id,'custom');assert.deepEqual(await buildTodoistCommands(s.outbox[0],s),move);});
test('pending local edits detect overlapping Todoist changes without losing either version',()=>{let s=reconcileTodoist(start(),{...cache,items:[remote()]},now);s=reduceCommand(s,{type:'task.edit',id:s.tasks[0].id,patch:{title:'Local draft'}},now);s=reconcileTodoist(s,{...cache,items:[{...remote(),content:'Changed in Todoist'}]},now);assert.equal(s.tasks[0].title,'Local draft');assert.equal(s.outbox[0].conflict,true);assert.match(s.outbox[0].error!,/both versions/);});
test('incremental empty responses preserve metadata; tombstones hide choices without deleting task history',()=>{let s=reconcileTodoist(start(),{...cache,items:[remote()]},now);const c=mergeTodoistCache(cache,{sync_token:'next',projects:[],sections:[],items:[]});assert.equal(c.sections.length,4);s=reconcileTodoist(s,{...cache,sections:cache.sections.map(x=>x.id==='physics'?{...x,is_deleted:true}:x)},now);assert(!subjectChoices(s,'school').some(x=>x.remoteId==='physics'));assert.equal(s.tasks.length,1);assert.equal(s.tasks[0].area,'Physics');assertState(s);});
test('remote completion, reopening and repeated deltas do not duplicate XP',()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);const event={...remote(),due:null,checked:true};s=reconcileTodoist(s,{...cache,items:[event]},now);s=reconcileTodoist(s,{...cache,items:[event]},now);assert.equal(totalXP(s),10);assert.equal(s.rewards.length,1);assert.equal(s.outbox.length,0);s=reconcileTodoist(s,{...cache,items:[{...event,checked:false}]},now);assert.equal(totalXP(s),0);});
test('schema 4 backups gain subject records additively and new backups retain mappings and queued writes',async()=>{let s=add();const old=structuredClone(s) as Partial<PlannerState>;old.schemaVersion=4;delete old.subjects;const next=migrateState(old);assert.equal(next.schemaVersion,8);assert.deepEqual(next.tasks,s.tasks);s=reduceCommand(s,{type:'subject.rename',id:s.tasks[0].subjectId!,title:'New name'},now);const key=newKey(),pack=await packSnapshot(s,19,key,now),restored=await unpackSnapshot(pack.bytes,key);assert.deepEqual(restored.state,JSON.parse(JSON.stringify(s)));assert.equal(pack.snapshot.counts.subjects,s.subjects.length);assert.equal(pack.snapshot.counts.lists,s.lists.length);});

test('queued unsent task edits coalesce all changed fields and status reversals keep their order',async()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);const id=s.tasks[0].id;s=reduceCommand(s,{type:'task.edit',id,patch:{title:'First edit'}},now);s=reduceCommand(s,{type:'task.edit',id,patch:{notes:'Second edit'}},now);assert.equal(s.outbox.length,1);const commands=await buildTodoistCommands(s.outbox[0],s);assert.equal(commands[0].args.content,'First edit');assert.equal(commands[0].args.description,'Second edit');s.outbox=[];for(const done of [true,false,true])s=reduceCommand(s,{type:'task.toggle',id,done},now);assert.deepEqual(s.outbox.map(o=>o.action),['task.close','task.reopen','task.close']);assert.equal(totalXP(s),10);});
test('simultaneous section renames become a visible conflict instead of losing the remote name',()=>{let s=start();const subject=s.subjects.find(x=>x.remoteId==='physics')!;s=reduceCommand(s,{type:'subject.rename',id:subject.id,title:'Local name'},now);s=reconcileTodoist(s,{...cache,sections:cache.sections.map(x=>x.id==='physics'?{...x,name:'Other device name'}:x)},now);assert.equal(s.subjects.find(x=>x.id===subject.id)!.title,'Local name');assert.equal(s.outbox[0].conflict,true);});
test('full structural snapshots archive absent sections; minimal task tombstones preserve unrelated records',()=>{const original=structuredClone(cache);const next=mergeTodoistCache(cache,{sync_token:'full',full_sync:true,projects:cache.projects,sections:cache.sections.filter(x=>x.id!=='physics'),items:[]});assert.deepEqual(cache,original);let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);s=reconcileTodoist(s,next,now);assert.equal(s.subjects.find(x=>x.remoteId==='physics')!.archived,true);s=reconcileTodoist(s,{...next,items:[{id:'r1',is_deleted:true} as never]},now);assert(s.tasks[0].deletedAt);assert.equal(totalXP(s),0);assertState(s);});

test('a task draft saves only changed fields and overlapping remote edits keep the draft safe',()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);const id=s.tasks[0].id,base=s.tasks[0].title;s=reconcileTodoist(s,{...cache,items:[{...remote(),content:'Remote revision',description:'New remote notes',due:null}]},now);assert.throws(()=>reduceCommand(s,{type:'task.edit',id,patch:{title:'My draft'},base:{title:base}},now),/draft is kept/);s=reduceCommand(s,{type:'task.edit',id,patch:{estimate:50},base:{estimate:25}},now);assert.equal(s.tasks[0].title,'Remote revision');assert.equal(s.tasks[0].notes,'New remote notes');assert.equal(s.tasks[0].estimate,50);});

test('background synchronization can be rebased while overlapping user edits remain a conflict',()=>{const before=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now),after=structuredClone(before),id=before.tasks[0].id;after.connections.todoist.lastSync='2026-11-13T10:00:00Z';assert(canRebaseCommand({type:'subject.add',subject:{id:'s',listId:'school',title:'Subject'}},before,after));const command={type:'task.edit',id,patch:{title:'Draft'},base:{title:before.tasks[0].title}};assert(canRebaseCommand(command,before,after));after.tasks[0].title='Different edit';assert(!canRebaseCommand(command,before,after));after.settings.theme='classic-career';assert(!canRebaseCommand({type:'settings.update',patch:{theme:'night-stadium'}},before,after));assert(canRebaseCommand({type:'settings.update',patch:{language:'zh'}},before,after));});

test('explicit project deletion removes its stale child tasks even when child tombstones are omitted',()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null},{...remote('other'),project_id:'p2',section_id:'custom',due:null}]},now);s=reduceCommand(s,{type:'task.toggle',id:s.tasks[0].id,done:true},now);s.outbox=[];const next={...cache,projects:cache.projects.map(p=>p.id==='p1'?{...p,is_deleted:true}:p),items:[{...remote(),due:null},{...remote('other'),project_id:'p2',section_id:'custom',due:null}]};s=reconcileTodoist(s,next,now);assert(s.tasks.find(t=>t.remoteId==='r1')!.deletedAt);assert(!s.tasks.find(t=>t.remoteId==='other')!.deletedAt);assert.equal(totalXP(s),0);assert.equal(s.outbox.length,0);assertState(s);});

test('missing project children are checked directly and only a confirmed missing task becomes deleted',async()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);s=reduceCommand(s,{type:'task.toggle',id:s.tasks[0].id,done:true},now);s.outbox=[];const missing={...cache,projects:cache.projects.map(p=>p.id==='p1'?{...p,is_archived:true}:p),items:[{...remote(),due:null}]};const completed=await verifyTodoistProjectChildren(missing,s,async()=>({status:200,item:{...remote(),due:null,checked:true}}),now);assert(!completed.items[0].is_deleted);let calls=0;const gone=await verifyTodoistProjectChildren(missing,s,async()=>{calls++;return {status:404}},now);assert.equal(calls,1);assert(!('is_deleted' in missing.items[0]));s=reconcileTodoist(s,gone,now);assert(s.tasks[0].deletedAt);assert.equal(totalXP(s),0);assertState(s);});
test('failed child verification preserves prior records and reports the unavailable source',async()=>{const s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);const missing={...cache,projects:cache.projects.map(p=>p.id==='p1'?{...p,is_archived:true}:p),items:[{...remote(),due:null}]};await assert.rejects(()=>verifyTodoistProjectChildren(missing,s,async()=>({status:503}),now),/Previous records are preserved/);assert(!s.tasks[0].deletedAt);});

test('archived parts retain task history but cancel future unfinished-work reminders',()=>{let s=reduceCommand(initialState(),{type:'task.add',task:{id:'archived-work',title:'Old work',listId:'school',area:'Physics',plannedOn:'2026-11-12',deadline:'2026-11-13T10:00:00Z',deadlineConfirmed:true}},now);assert(s.reminders.some(r=>r.status==='pending'));s.lists.find(p=>p.id==='school')!.archived=true;s=reduceCommand(s,{type:'settings.update',patch:{sound:false}},now);assert(!s.reminders.some(r=>r.status==='pending'&&r.taskId==='archived-work'));assert(!s.tasks[0].deletedAt);assert.equal(totalXP(s),0);});

test('deletion tombstones with cleared parent fields use the saved mapping for tasks and subjects',()=>{let s=reconcileTodoist(start(),{...cache,items:[{...remote(),due:null}]},now);s=reduceCommand(s,{type:'task.toggle',id:s.tasks[0].id,done:true},now);s.outbox=[];const next={...cache,sections:cache.sections.map(x=>x.id==='physics'?{id:x.id,project_id:'0',name:'',is_deleted:true}:x),items:[{id:'r1',project_id:'0',content:'',priority:1,is_deleted:true,checked:false}]};s=reconcileTodoist(s,next,now);assert(s.tasks[0].deletedAt);assert.equal(s.tasks[0].title,'Remote task');assert.equal(s.tasks[0].remoteProjectId,'p1');assert.equal(s.subjects.find(x=>x.remoteId==='physics')!.archived,true);assert.equal(totalXP(s),0);assertState(s);});

test('recurring reschedules retain work scope and queued completion after a scheduling echo',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),completed_count:0}]},now);const id=s.tasks[0].id,scope=s.tasks[0].occurrence;
 s=reduceCommand(s,{type:'task.edit',id,patch:{plannedOn:'2026-11-14',plannedTime:'18:30'}},now);
 const schedule=s.outbox[0],commands=await buildTodoistCommands(schedule,s);s.outbox.shift();s.tasks[0].remoteDue=commands[0].args.due as Record<string,unknown>;
 s=reduceCommand(s,{type:'task.toggle',id,done:true},now);
 s=reconcileTodoist(s,{...cache,items:[{...remote(),completed_count:0,due:{...remote().due,date:'2026-11-14T10:30:00.000Z'}}]},now);
 assert.equal(s.tasks[0].occurrence,scope);assert.equal(s.tasks[0].done,true);assert.equal(totalXP(s),10);
 const close=await buildTodoistCommands(s.outbox[0],s);assert.equal(close[0].type,'item_close');
 s.outbox=[];s=reconcileTodoist(s,{...cache,items:[{...remote(),completed_count:1,due:{...remote().due,date:'2026-11-15T10:30:00.000Z'}}]},now);
 assert.equal(s.tasks[0].done,false);assert.notEqual(s.tasks[0].occurrence,scope);assert.equal(totalXP(s),10);assert.equal(s.rewards.length,1);
});

test('remote recurrence completion and undo reuse durable reward identities, never scheduled dates',()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),completed_count:7}]},now);const scope=s.tasks[0].occurrence;
 const reschedule={...remote(),completed_count:7,due:{...remote().due,date:'2026-12-01T18:30:00'}};
 s=reconcileTodoist(s,{...cache,items:[reschedule]},now);assert.equal(s.tasks[0].occurrence,scope);assert.equal(totalXP(s),0);
 const complete={...reschedule,completed_count:8,due:{...reschedule.due,date:'2026-12-02T18:30:00'}};
 for(let i=0;i<2;i++)s=reconcileTodoist(s,{...cache,items:[complete]},now);assert.equal(totalXP(s),10);assert.equal(s.rewards.length,1);
 s=reconcileTodoist(s,{...cache,items:[reschedule]},now);assert.equal(totalXP(s),0);assert.equal(s.tasks[0].occurrence,scope);
 s=reconcileTodoist(s,{...cache,items:[complete]},now);assert.equal(totalXP(s),10);assert.equal(s.rewards.length,1);
});

test('recurring undo restores the prior due and scope with the provider recurrence command',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),completed_count:0}]},now);const id=s.tasks[0].id,scope=s.tasks[0].occurrence;
 s=reduceCommand(s,{type:'task.toggle',id,done:true},now);s.outbox=[];
 s=reconcileTodoist(s,{...cache,items:[{...remote(),completed_count:1,due:{...remote().due,date:'2026-11-14'}}]},now);
 s=reduceCommand(s,{type:'task.toggle',id,done:false,occurrence:scope},now);
 const commands=await buildTodoistCommands(s.outbox[0],s);assert.equal(commands[0].type,'item_update_date_complete');assert.equal(commands[0].args.is_forward,0);assert.equal((commands[0].args.due as {date:string}).date,'2026-11-13');assert.equal(totalXP(s),0);assert.equal(s.tasks[0].occurrence,scope);
 const job=s.outbox[0];job.payload.commands=commands;job.attemptedAt=now.toISOString();s.tasks[0].remoteDue={...remote().due,date:'2026-12-20'};assert.deepEqual(await buildTodoistCommands(job,s),commands);
});

test('unknown recurring completion evidence keeps the queued operation instead of silently dropping it',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[remote()]},now);const id=s.tasks[0].id;
 s=reduceCommand(s,{type:'task.toggle',id,done:true},now);
 s=reconcileTodoist(s,{...cache,items:[{...remote(),due:{...remote().due,date:'2026-11-14'}}]},now);
 await assert.rejects(()=>buildTodoistCommands(s.outbox[0],s),/remains queued/);assert.equal(s.outbox.length,1);assert.equal(totalXP(s),10);
});

test('an accepted reschedule becomes the due date restored by recurring undo',async()=>{
 let s=reconcileTodoist(start(),{...cache,items:[{...remote(),completed_count:0}]},now);const id=s.tasks[0].id,scope=s.tasks[0].occurrence;
 s=reduceCommand(s,{type:'task.edit',id,patch:{plannedOn:'2026-11-15',plannedTime:'19:00'}},now);s=reduceCommand(s,{type:'task.toggle',id,done:true},now);
 const schedule=s.outbox[0],commands=await buildTodoistCommands(schedule,s);s=acknowledgeTodoist(s,schedule,commands,{});s.outbox.shift();
 assert.equal((await buildTodoistCommands(s.outbox[0],s))[0].type,'item_close');s.outbox=[];
 s=reconcileTodoist(s,{...cache,items:[{...remote(),completed_count:1,due:{...remote().due,date:'2026-11-16T11:00:00.000Z'}}]},now);
 s=reduceCommand(s,{type:'task.toggle',id,done:false,occurrence:scope},now);const undo=await buildTodoistCommands(s.outbox[0],s);assert.equal((undo[0].args.due as {date:string}).date,'2026-11-15T11:00:00.000Z');assert.equal(s.tasks[0].plannedTime,'19:00');
});
test('optional recurrence counters are verified directly before interpreting a changed due date',async()=>{
 const s=reconcileTodoist(start(),{...cache,items:[{...remote(),completed_count:3}]},now),next={...cache,items:[{...remote(),due:{...remote().due,date:'2026-11-14'}}]};let calls=0;
 const verified=await verifyTodoistRecurringTasks(next,s,async id=>{calls++;return {status:200,item:{...next.items[0],id,completed_count:3}}},now);assert.equal(calls,1);assert.equal(verified.items[0].completed_count,3);assert(!('completed_count' in next.items[0]));assert.equal(reconcileTodoist(s,verified,now).tasks[0].occurrence,s.tasks[0].occurrence);
 await assert.rejects(()=>verifyTodoistRecurringTasks(next,s,async()=>({status:503}),now),/Previous records are preserved/);
});
