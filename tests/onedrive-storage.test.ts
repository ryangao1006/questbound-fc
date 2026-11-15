import test from 'node:test';
import assert from 'node:assert/strict';
import {OneDriveSnapshotStore,type ObjectTransport} from '../lib/onedrive-storage.ts';
import {initialState} from '../lib/model.ts';
class Memory implements ObjectTransport {
 files=new Map<string,Uint8Array>();failHead=false;corruptObjects=false;timeoutAfterHead=false;
 async read(path:string){const b=this.files.get(path);return b?b.slice():null;}
 async write(path:string,bytes:Uint8Array){if(this.failHead&&path.endsWith('HEAD.json'))throw new Error('disconnected');this.files.set(path,this.corruptObjects&&path.includes('/objects/')?new Uint8Array([1]):bytes.slice());if(this.timeoutAfterHead&&path.endsWith('HEAD.json')){this.timeoutAfterHead=false;throw new Error('timeout')}}
}
const payload=()=>({planner:initialState(),career:{id:'legacy-career',checkpoint:{sequence:12,randomState:42}}});
test('verified cloud snapshot preserves full state, career and account isolation',async()=>{
 const transport=new Memory(),store=new OneDriveSnapshotStore(transport),p=payload();p.planner.outbox.push({id:'job',provider:'todoist',action:'task.upsert',entityId:'x',payload:{title:'Read'},attempts:0,nextAttempt:new Date().toISOString(),status:'pending'});
 const saved=await store.commit({accountId:'microsoft:one',baseRevision:0,operationId:'op-1',payload:p});assert.equal(saved.revision,1);assert.deepEqual((await store.read('microsoft:one'))?.payload,p);assert.equal(await store.read('microsoft:two'),null);assert.equal(saved.schemaVersion,8);
});
test('duplicate operation is idempotent even with old revision; reusing ID with different bytes fails',async()=>{
 const store=new OneDriveSnapshotStore(new Memory()),p=payload(),input={accountId:'one',baseRevision:0,operationId:'stable',payload:p};await store.commit(input);assert.equal((await store.commit(input)).revision,1);p.planner.settings.name='Other';await assert.rejects(store.commit(input),/CLOUD_OPERATION_REUSED/);
});
test('stale writer is rejected without changing cloud state',async()=>{
 const store=new OneDriveSnapshotStore(new Memory());await store.commit({accountId:'one',baseRevision:0,operationId:'first',payload:payload()});await assert.rejects(store.commit({accountId:'one',baseRevision:0,operationId:'second',payload:payload()}),/CLOUD_CONFLICT/);assert.equal((await store.read('one'))?.revision,1);
});
test('interrupted HEAD publication keeps previous good version and permits exact retry',async()=>{
 const transport=new Memory(),store=new OneDriveSnapshotStore(transport);await store.commit({accountId:'one',baseRevision:0,operationId:'first',payload:payload()});transport.failHead=true;const p=payload();p.planner.settings.name='Updated';const next={accountId:'one',baseRevision:1,operationId:'second',payload:p};await assert.rejects(store.commit(next),/disconnected/);assert.equal((await store.read('one'))?.payload.planner.settings.name,'Ryan');transport.failHead=false;assert.equal((await store.commit(next)).revision,2);
});
test('lost response after successful publication retries without another revision',async()=>{
 const transport=new Memory(),store=new OneDriveSnapshotStore(transport),input={accountId:'one',baseRevision:0,operationId:'first',payload:payload()};transport.timeoutAfterHead=true;await assert.rejects(store.commit(input),/timeout/);assert.equal((await store.commit(input)).revision,1);
});
test('corrupt uploaded objects never become authoritative',async()=>{
 const transport=new Memory(),store=new OneDriveSnapshotStore(transport);transport.corruptObjects=true;await assert.rejects(store.commit({accountId:'one',baseRevision:0,operationId:'first',payload:payload()}),/CLOUD_WRITE_VERIFICATION_FAILED/);assert.equal(await store.read('one'),null);
});
test('cloud archive excludes credentials and rejects unsupported schemas',async()=>{
 const store=new OneDriveSnapshotStore(new Memory()),p=payload();(p as unknown as Record<string,unknown>).refresh_token='secret';await assert.rejects(store.commit({accountId:'one',baseRevision:0,operationId:'first',payload:p}),/CONTAINS_CREDENTIALS/);const future=payload();future.planner.schemaVersion=999;await assert.rejects(store.commit({accountId:'one',baseRevision:0,operationId:'future',payload:future}),/SCHEMA_UNSUPPORTED/);
});
test('tampered committed object fails checksum instead of returning partial records',async()=>{
 const transport=new Memory(),store=new OneDriveSnapshotStore(transport);await store.commit({accountId:'one',baseRevision:0,operationId:'first',payload:payload()});const path=[...transport.files.keys()].find(p=>p.includes('/objects/'))!;transport.files.set(path,new TextEncoder().encode('{}'));await assert.rejects(store.read('one'),/CLOUD_CHECKSUM_MISMATCH/);
});
