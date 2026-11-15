/** IndexedDB API simulation, not an actual browser/device verification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {emptyLocalPlanner,localCommand,prepareCloudCommit} from '../lib/local-planner.ts';
import {SCHEMA_VERSION} from '../lib/model.ts';
const connections:IDBDatabase[]=[];
const open=indexedDB.open.bind(indexedDB);
indexedDB.open=(name:string,version?:number)=>{const request=open(name,version);request.addEventListener('success',()=>connections.push(request.result));return request;};
let serial=0;
async function freshModule(){const path='../lib/planner-idb.ts?instance='+serial++;return import(path) as Promise<typeof import('../lib/planner-idb.ts')>}
const close=()=>{for(const db of connections.splice(0))db.close()};
test('IndexedDB commits survive connection close/reopen with account isolation and queued upload',async()=>{
 const db=await freshModule();let local=emptyLocalPlanner('microsoft:owner-one');local=localCommand(local,{type:'task.add',task:{title:'Persisted offline task'}},'offline-add','2026-11-13T00:00:00Z');const prepared=prepareCloudCommit(local,'mac');
 await db.writeLocalPlanner(prepared.record);await db.writeLocalPlanner(emptyLocalPlanner('microsoft:owner-two'));close();
 const reopened=await freshModule();const restored=await reopened.readLocalPlanner('microsoft:owner-one');assert.deepEqual(restored,prepared.record);assert.equal(restored?.pending[0].id,'offline-add');assert.deepEqual(prepareCloudCommit(restored!,'mac').request,prepared.request);assert.equal((await reopened.readLocalPlanner('microsoft:owner-two'))?.envelope.state.tasks.length,0);assert.equal(await reopened.readLocalPlanner('missing-account'),undefined);close();
});
test('IndexedDB generation conflict aborts transaction without replacing saved state',async()=>{
 const db=await freshModule();const base=emptyLocalPlanner('conflict-account');await db.writeLocalPlanner(base);const first=localCommand(base,{type:'task.add',task:{title:'First tab'}},'first');await db.writeLocalPlanner(first,base.generation);
 const stale=localCommand(base,{type:'task.add',task:{title:'Second tab'}},'second');await assert.rejects(db.writeLocalPlanner(stale,base.generation),(error:unknown)=>(error as {status?:number}).status===409);
 assert.deepEqual(await db.readLocalPlanner(base.accountId),first);close();const reopen=await freshModule();assert.deepEqual(await reopen.readLocalPlanner(base.accountId),first);close();
});
test('IndexedDB draft keys stay account-isolated after reopen and independent deletion',async()=>{
 const db=await freshModule();const one='qfc-draft:microsoft:one:task-a',two='qfc-draft:microsoft:two:task-a';await db.draftStore('put',one,'Owner one draft');await db.draftStore('put',two,'Owner two draft');close();
 const reopened=await freshModule();assert.equal(await reopened.draftStore('get',one),'Owner one draft');assert.equal(await reopened.draftStore('get',two),'Owner two draft');await reopened.draftStore('delete',one);assert.equal(await reopened.draftStore('get',one),null);assert.equal(await reopened.draftStore('get',two),'Owner two draft');close();
});
test('IndexedDB unavailable connection reports failure instead of acknowledging a save',async()=>{
 const db=await freshModule();await db.readLocalPlanner('failure-account');close();await assert.rejects(db.writeLocalPlanner(emptyLocalPlanner('failure-account')));const reopened=await freshModule();assert.equal(await reopened.readLocalPlanner('failure-account'),undefined);close();
});
test('older IndexedDB envelopes migrate without changing an uncertain upload payload',async()=>{
 const db=await freshModule();const prepared=prepareCloudCommit(emptyLocalPlanner('legacy-cache'),'mac').record;
 const legacy=JSON.parse(JSON.stringify(prepared));
 for(const state of [legacy.envelope.state,legacy.attempt.snapshot.state]){state.schemaVersion=7;delete state.economy}
 legacy.base.snapshot={state:structuredClone(legacy.envelope.state)};
 const attempt=JSON.stringify(legacy.attempt);await db.writeLocalPlanner(legacy);close();
 const reopened=await freshModule(),restored=(await reopened.readLocalPlanner('legacy-cache'))!;
 assert.equal(restored.envelope.state.schemaVersion,SCHEMA_VERSION);assert.ok(restored.envelope.state.economy);
 assert.equal(restored.base.snapshot?.state.schemaVersion,SCHEMA_VERSION);
 assert.equal(JSON.stringify(restored.attempt),attempt);
 assert.deepEqual(prepareCloudCommit(restored,'mac').request.snapshot,legacy.attempt.snapshot);close();
});
