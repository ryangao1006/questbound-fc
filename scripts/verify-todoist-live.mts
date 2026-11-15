/** Live isolated QA: token is read once from stdin JSON, never argv/env/files/logs. */
import {createInterface} from 'node:readline';
import {execFileSync} from 'node:child_process';
import {openJSON} from '../lib/crypto.ts';
import {readFile} from 'node:fs/promises';
let hidden=false;
if(process.stdin.isTTY){execFileSync('stty',['-echo'],{stdio:'inherit'});hidden=true}
function restoreEcho(){if(hidden){try{execFileSync('stty',['echo'],{stdio:'inherit'})}catch{}hidden=false}}
process.on('exit',restoreEcho);
import assert from 'node:assert/strict';
import {CloudTodoist} from '../lib/cloud-todoist.ts';
import {OneDriveSnapshotStore} from '../lib/onedrive-storage.ts';
import {initialState,type Command} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import type {TodoistSync,TodoistItem} from '../lib/todoist-sync.ts';
const rl=createInterface({input:process.stdin,terminal:false});
process.stdout.write('Ready for one stdin JSON object containing token.\n');
const line=await new Promise<string>(resolve=>rl.once('line',resolve));rl.close();process.stdin.pause();
let input:{token?:string;ciphertext?:string;masterKey?:string};try{input=JSON.parse(line)}catch{throw new Error('Invalid stdin input.')}
if(!input.masterKey&&process.argv.includes('--local-vault-key')){const env=await readFile('.dev.vars','utf8');input.masterKey=env.split('\n').find(line=>line.startsWith('APP_ENCRYPTION_KEY='))?.split('=').slice(1).join('=').trim().replace(/^[\"']|[\"']$/g,'')}
let token=String(input.token||'');if(!token&&input.ciphertext&&input.masterKey){const secret=await openJSON<{token:string}>(input.ciphertext,input.masterKey);token=secret.token;if(!token)throw new Error('Configured Todoist authorization fields: '+Object.keys(secret).join(', '));secret.token=''}delete input.token;delete input.ciphertext;delete input.masterKey;
if(!token||token.length>1000)throw new Error('A token is required through stdin.');
const prefix='Questbound FC QA '+new Date().toISOString().replace(/[:.]/g,'-')+' '+crypto.randomUUID().slice(0,6);
const projects=new Set<string>(),allowedSections=new Set<string>(),allowedTasks=new Set<string>();
const checks:string[]=[];let cleanup=true,failed=false;
async function request(path:string,method='GET',body?:unknown){const response=await fetch('https://api.todoist.com/api/v1/'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('TODOIST_HTTP_'+response.status);return response.status===204?null:response.json();}
async function addProject(name:string){assert.ok(name.startsWith(prefix));const p=await request('projects','POST',{name}) as {id:string};assert.ok(p.id);projects.add(p.id);return p.id;}
const scopedFetch=(async(url:RequestInfo|URL,init?:RequestInit)=>{
 const target=new URL(String(url));assert.equal(target.origin,'https://api.todoist.com');
 if(target.pathname.startsWith('/api/v1/tasks/')){assert.ok(allowedTasks.has(decodeURIComponent(target.pathname.split('/').at(-1)!)));return fetch(url,init)}
 assert.equal(target.pathname,'/api/v1/sync');
 const form=new URLSearchParams(init?.body as string);const commands=JSON.parse(form.get('commands')||'[]') as {type:string;args:Record<string,unknown>;temp_id?:string}[];
 for(const c of commands){if(c.type==='project_add')assert.ok(String(c.args.name).startsWith(prefix));else if(c.type.startsWith('project_'))assert.ok(projects.has(String(c.args.id)));else if(c.type==='section_add')assert.ok(projects.has(String(c.args.project_id)));else if(c.type.startsWith('section_'))assert.ok(allowedSections.has(String(c.args.id)));else if(c.type==='item_add')assert.ok(projects.has(String(c.args.project_id)));else if(c.type.startsWith('item_'))assert.ok(allowedTasks.has(String(c.args.id)));else throw new Error('UNSCOPED_COMMAND');}
 const response=await fetch(url,init);if(!response.ok)return response;const data=await response.json() as TodoistSync;
 for(const c of commands){const mapped=c.temp_id?data.temp_id_mapping?.[c.temp_id]:null;if(mapped){if(c.type==='project_add')projects.add(mapped);if(c.type==='section_add')allowedSections.add(mapped);if(c.type==='item_add')allowedTasks.add(mapped)}}
 data.projects=data.projects?.filter(p=>projects.has(p.id));data.sections=data.sections?.filter(s=>projects.has(s.project_id));for(const s of data.sections||[])allowedSections.add(s.id);
 data.items=data.items?.filter(i=>projects.has(i.project_id)||allowedTasks.has(i.id));for(const i of data.items||[])allowedTasks.add(i.id);
 return Response.json(data,{status:response.status});
}) as typeof fetch;
try{
 const projectId=await addProject(prefix+' — remote seed');
 const section=await request('sections','POST',{project_id:projectId,name:'QA English'}) as {id:string};allowedSections.add(section.id);
 const task=await request('tasks','POST',{project_id:projectId,section_id:section.id,content:'QA seed task',description:'QA seed note',priority:2,due_datetime:'2026-12-20T08:00:00Z'}) as TodoistItem;allowedTasks.add(task.id);
 const files=new Map<string,Uint8Array>();const store=new OneDriveSnapshotStore({async read(k){return files.get(k)||null},async write(k,b){files.set(k,b.slice())}});await store.commit({accountId:'isolated-live-test',baseRevision:0,operationId:'init',payload:{planner:initialState()}});
 const adapter=new CloudTodoist(store,'isolated-live-test',token,scopedFetch);await adapter.connect();
 async function change(command:Command){const s=(await store.read('isolated-live-test'))!;s.payload.planner=reduceCommand(s.payload.planner,command);return store.commit({accountId:'isolated-live-test',baseRevision:s.revision,operationId:crypto.randomUUID(),payload:s.payload})}
 let s=(await store.read('isolated-live-test'))!,local=s.payload.planner.tasks.find(t=>t.remoteId===task.id)!;assert.ok(local);checks.push('remote initial project, subject and task imported into isolated cloud state');
 await change({type:'task.edit',id:local.id,patch:{title:'QA website title 中文',notes:'QA website note 中文',priority:3,plannedOn:'2026-12-21',plannedTime:'17:30'},base:{title:local.title,notes:local.notes,priority:local.priority,plannedOn:local.plannedOn,plannedTime:local.plannedTime}});await adapter.sync(true);
 const written=await request('tasks/'+task.id) as TodoistItem;assert.equal(written.content,'QA website title 中文');assert.equal(written.description,'QA website note 中文');assert.equal(written.priority,4);assert.equal(Date.parse(String(written.due?.datetime||written.due?.date)),Date.parse('2026-12-21T09:30:00Z'));checks.push('website → Todoist: title, notes, priority and planned date/time');
 s=(await store.read('isolated-live-test'))!;const subject=s.payload.planner.subjects.find(x=>x.remoteId===section.id)!;await change({type:'subject.rename',id:subject.id,title:'QA English renamed 网站'});await adapter.sync(true);const sections=await request('sections/'+section.id) as {name:string};assert.equal(sections.name,'QA English renamed 网站');checks.push('website → Todoist: subject rename');
 await request('tasks/'+task.id,'POST',{content:'QA remote title 中文',description:'QA remote note 中文',priority:2,due_datetime:'2026-12-22T03:20:00Z'});await request('sections/'+section.id,'POST',{name:'QA remote subject 中文'});s=await adapter.sync(true);local=s.payload.planner.tasks.find(t=>t.remoteId===task.id)!;assert.equal(local.title,'QA remote title 中文');assert.equal(local.notes,'QA remote note 中文');assert.equal(local.priority,1);assert.equal(local.plannedOn,'2026-12-22');assert.equal(local.plannedTime,'11:20');assert.equal(local.area,'QA remote subject 中文');checks.push('Todoist → website: title, notes, priority, planned date/time and subject rename');
 const extraSection=await request('sections','POST',{project_id:projectId,name:'QA remote new subject'}) as {id:string};allowedSections.add(extraSection.id);await request('tasks/'+task.id+'/move','POST',{section_id:extraSection.id});s=await adapter.sync(true);local=s.payload.planner.tasks.find(t=>t.remoteId===task.id)!;assert.equal(s.payload.planner.subjects.find(x=>x.id===local.subjectId)?.remoteId,extraSection.id);checks.push('Todoist → website: new subject and task membership');
 const second=await addProject(prefix+' — remote new part');s=await adapter.sync(true);assert.ok(s.payload.planner.lists.some(x=>x.projectId===second));checks.push('Todoist → website: new part/project mapping');
 await change({type:'part.add',part:{id:'qa-local-part',title:prefix+' — website new part'}});await adapter.sync(true);s=(await store.read('isolated-live-test'))!;const created=s.payload.planner.lists.find(x=>x.id==='qa-local-part')!;assert.ok(created.projectId&&projects.has(created.projectId));await change({type:'subject.add',subject:{id:'qa-local-subject',listId:created.id,title:'QA website new subject'}});await adapter.sync(true);await change({type:'task.add',task:{id:'qa-local-task',title:'QA website created task',listId:created.id,subjectId:'qa-local-subject',area:'QA website new subject',notes:'QA created note',priority:2,plannedOn:'2026-12-23',plannedTime:'14:00'}});s=await adapter.sync(true);assert.ok(s.payload.planner.tasks.find(t=>t.id==='qa-local-task')?.remoteId);checks.push('website → Todoist: new part, subject and task with stable mappings');
 await change({type:'task.toggle',id:local.id,done:true});await adapter.sync(true);const completed=await request('tasks/'+task.id) as TodoistItem;assert.ok(completed.checked);await request('tasks/'+task.id+'/reopen','POST');s=await adapter.sync(true);assert.equal(s.payload.planner.tasks.find(t=>t.remoteId===task.id)?.done,false);checks.push('website completion → Todoist; Todoist reopening → website');
 // Deadline support varies by account plan; only change this isolated QA task.
 try{await request('tasks/'+task.id,'POST',{deadline_date:'2026-12-24'});s=await adapter.sync(true);assert.ok(s.payload.planner.tasks.find(t=>t.remoteId===task.id)?.deadline.startsWith('2026-12-24'));checks.push('Todoist → website: explicit deadline date')}catch{checks.push('deadline test unavailable or unsupported; not marked passed')}
}catch{failed=true;}finally{
 for(const id of projects){try{await request('projects/'+encodeURIComponent(id),'DELETE');const verify=await fetch('https://api.todoist.com/api/v1/projects/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(![404,410].includes(verify.status))cleanup=false;}catch{cleanup=false;}}
 token='';restoreEcho();process.stdout.write(JSON.stringify({success:!failed&&cleanup,checks,cleanup:{allCreatedProjectsRemoved:cleanup,projectsCreated:projects.size},schoolTaskWrites:0})+'\n');if(failed||!cleanup)process.exitCode=1;
}
