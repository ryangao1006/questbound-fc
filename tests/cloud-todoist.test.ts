import test from 'node:test';
import assert from 'node:assert/strict';
import {CloudTodoist} from '../lib/cloud-todoist.ts';
import {OneDriveSnapshotStore,type ObjectTransport} from '../lib/onedrive-storage.ts';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
class Memory implements ObjectTransport{files=new Map<string,Uint8Array>();async read(k:string){return this.files.get(k)?.slice()||null}async write(k:string,b:Uint8Array){this.files.set(k,b.slice())}}
function remote(){
 const item={id:'item',content:'Read',description:'notes',project_id:'project',section_id:'subject',priority:2,due:{date:'2026-11-20T16:00:00',timezone:'Asia/Shanghai',is_recurring:false},deadline:{date:'2026-11-22'},checked:false};
 const section={id:'subject',project_id:'project',name:'English'};const seen=new Map<string,unknown>();const requests:unknown[][]=[];let failOnce=false;
 const fetcher=(async(url:RequestInfo|URL,init?:RequestInit)=>{assert.match(String(init?.headers&&new Headers(init.headers).get('Authorization')),/^Bearer private-token$/);if(String(url).includes('/tasks/'))return Response.json(item);
  const body=new URLSearchParams(init?.body as string),commands=JSON.parse(body.get('commands')||'[]') as {uuid:string;type:string;args:Record<string,unknown>}[];requests.push(commands);
  const status:Record<string,string>={};for(const c of commands){if(!seen.has(c.uuid)){if(c.type==='item_update')Object.assign(item,{...('content'in c.args?{content:c.args.content}:{}),...('description'in c.args?{description:c.args.description}:{}),...('priority'in c.args?{priority:c.args.priority}:{}),...('due'in c.args?{due:c.args.due}:{}),...('deadline'in c.args?{deadline:c.args.deadline}:{})});if(c.type==='section_update')section.name=String(c.args.name);seen.set(c.uuid,c)}status[c.uuid]='ok'}if(commands.length&&failOnce){failOnce=false;throw new Error('lost acknowledgement')}
  return Response.json({sync_token:'cursor',full_sync:true,items:[item],projects:[{id:'project',name:'School Tasks'}],sections:[section],sync_status:status,temp_id_mapping:{}});
 }) as typeof fetch;
 return {item,section,requests,seen,fetcher,failNext(){failOnce=true}};
}
async function setup(){const store=new OneDriveSnapshotStore(new Memory());await store.commit({accountId:'owner',baseRevision:0,operationId:'init',payload:{planner:initialState()}});const r=remote(),adapter=new CloudTodoist(store,'owner','private-token',r.fetcher);await adapter.connect();return {store,r,adapter}}
async function edit(store:OneDriveSnapshotStore){const s=(await store.read('owner'))!,task=s.payload.planner.tasks.find(t=>t.remoteId==='item')!;s.payload.planner=reduceCommand(s.payload.planner,{type:'task.edit',id:task.id,patch:{title:'Write essay',notes:'new note',priority:3,plannedOn:'2026-11-21',plannedTime:'17:30'},base:{title:task.title,notes:task.notes,priority:task.priority,plannedOn:task.plannedOn,plannedTime:task.plannedTime}});return store.commit({accountId:'owner',baseRevision:s.revision,operationId:'edit',payload:s.payload})}
test('cloud Todoist pulls all task fields and subjects; sends local edits, then receives remote edits',async()=>{
 const {store,r,adapter}=await setup();let s=(await store.read('owner'))!;const task=s.payload.planner.tasks[0];assert.equal(task.title,'Read');assert.equal(task.notes,'notes');assert.equal(task.plannedTime,'16:00');assert.equal(task.area,'English');assert.equal(task.priority,1);assert.equal(s.payload.integrations?.todoist?.syncToken,'cursor');
 await edit(store);s=await adapter.sync();assert.equal(r.item.content,'Write essay');assert.equal(r.item.description,'new note');assert.equal(r.item.priority,4);assert.equal(r.item.due.date,'2026-11-21T09:30:00.000Z');assert.equal(s.payload.planner.outbox.length,0);
 r.item.content='Remote new title';r.item.description='Remote notes';r.item.priority=2;r.item.due.date='2026-11-24T10:20:00';r.section.name='English Language';s=await adapter.sync();assert.equal(s.payload.planner.tasks[0].title,'Remote new title');assert.equal(s.payload.planner.tasks[0].notes,'Remote notes');assert.equal(s.payload.planner.tasks[0].plannedTime,'10:20');assert.equal(s.payload.planner.tasks[0].area,'English Language');assert.equal(s.payload.planner.tasks[0].priority,1);
});
test('lost Todoist response keeps exact queued commands and replays UUIDs after reconnection',async()=>{
 const {store,r,adapter}=await setup();await edit(store);r.failNext();await assert.rejects(adapter.sync(),/lost acknowledgement/);const queued=(await store.read('owner'))!.payload.planner.outbox[0];assert.ok(queued.payload.commands);assert.equal(queued.status,'error');const first=r.requests.filter(x=>x.length)[0];await adapter.sync(true);const second=r.requests.filter(x=>x.length)[1];assert.deepEqual(second,first);assert.equal(r.seen.size,first.length);assert.equal((await store.read('owner'))!.payload.planner.outbox.length,0);
});
test('subject rename two-way and repeated imports reuse task mappings',async()=>{
 const {store,r,adapter}=await setup();let s=(await store.read('owner'))!;const subject=s.payload.planner.subjects.find(x=>x.remoteId==='subject')!;s.payload.planner=reduceCommand(s.payload.planner,{type:'subject.rename',id:subject.id,title:'Literature'});await store.commit({accountId:'owner',baseRevision:s.revision,operationId:'rename',payload:s.payload});await adapter.sync();assert.equal(r.section.name,'Literature');await adapter.importProject('project','sync',['item']);await adapter.importProject('project','sync',['item']);assert.equal((await store.read('owner'))!.payload.planner.tasks.filter(t=>t.remoteId==='item').length,1);assert.equal((await adapter.preview('project')).items.length,1);
});
test('disconnected token errors preserve previous snapshot and credentials never enter cloud data',async()=>{
 const {store,adapter}=await setup();const before=(await store.read('owner'))!;const bad=new CloudTodoist(store,'owner','private-token',(async()=>new Response('',{status:401})) as typeof fetch);await assert.rejects(bad.sync(),/TODOIST_RECONNECT/);assert.equal((await store.read('owner'))!.revision,before.revision);const disconnected=await adapter.disconnect();assert.equal(disconnected.payload.planner.connections.todoist.connected,false);assert.equal(disconnected.payload.integrations?.todoist,undefined);assert.ok(!JSON.stringify(disconnected).includes('private-token'));
});
test('date-only remote deadline preserves locally chosen clock time',async()=>{
 const {store,adapter}=await setup();let s=(await store.read('owner'))!;const task=s.payload.planner.tasks[0];task.deadline='2026-11-22T07:15:00.000Z';task.syncBase={...task.syncBase,deadline:task.deadline};await store.commit({accountId:'owner',baseRevision:s.revision,operationId:'deadline-clock',payload:s.payload});s=await adapter.sync();assert.equal(s.payload.planner.tasks[0].deadline,'2026-11-22T07:15:00.000Z');await adapter.importProject('project','import',['item']);assert.equal((await store.read('owner'))!.payload.planner.lists.find(x=>x.projectId==='project')?.mode,'sync');
});
test('missing command acknowledgement leaves exact work queued rather than assuming success',async()=>{
 const {store,r}=await setup();await edit(store);const fetcher=(async(url:RequestInfo|URL,init?:RequestInit)=>{const response=await r.fetcher(url,init);const value=await response.json() as Record<string,unknown>;if(new URLSearchParams(init?.body as string).get('commands'))value.sync_status={};return Response.json(value)}) as typeof fetch;
 const adapter=new CloudTodoist(store,'owner','private-token',fetcher);await assert.rejects(adapter.sync(),/TODOIST_COMMAND_REJECTED/);const queued=(await store.read('owner'))!.payload.planner.outbox[0];assert.equal(queued.status,'error');assert.ok(queued.payload.commands);assert.equal(queued.attempts,1);
});

test('unchanged provider polls do not create immutable snapshots',async()=>{
 const {store,adapter}=await setup();await adapter.sync();const revision=(await store.read('owner'))!.revision;await adapter.sync();assert.equal((await store.read('owner'))!.revision,revision);
});
test('background poll honours retry delay while explicit retry can proceed',async()=>{
 const {store,r,adapter}=await setup();await edit(store);r.failNext();await assert.rejects(adapter.sync());const sends=r.requests.filter(x=>x.length).length;await adapter.sync();assert.equal(r.requests.filter(x=>x.length).length,sends);await adapter.sync(true);assert.equal((await store.read('owner'))!.payload.planner.outbox.length,0);
});
test('first connection initializes an empty verified account only after Todoist accepts its token',async()=>{const store=new OneDriveSnapshotStore(new Memory()),r=remote();const connected=await new CloudTodoist(store,'new-owner','private-token',r.fetcher).connect();assert.equal(connected.payload.planner.connections.todoist.connected,true);assert.equal(connected.payload.planner.tasks.length,1);assert.equal(connected.payload.planner.rewards.length,0);const empty=new OneDriveSnapshotStore(new Memory());await assert.rejects(new CloudTodoist(empty,'other-owner','bad',(async()=>new Response('',{status:401})) as typeof fetch).connect(),/TODOIST_RECONNECT/);assert.equal(await empty.read('other-owner'),null)});
