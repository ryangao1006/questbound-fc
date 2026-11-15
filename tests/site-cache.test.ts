/** IndexedDB API simulation, not an actual browser/device verification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {initialState,type Envelope} from '../lib/model.ts';

const connections:IDBDatabase[]=[];
const open=indexedDB.open.bind(indexedDB);
indexedDB.open=(name:string,version?:number)=>{const request=open(name,version);request.addEventListener('success',()=>connections.push(request.result));return request;};
let serial=0;
async function fresh(){const path='../lib/site-cache.ts?instance='+serial++;return import(path) as Promise<typeof import('../lib/site-cache.ts')>}
const close=()=>{for(const db of connections.splice(0))db.close()};
const envelope=(revision:number):Envelope=>({revision,updatedAt:`2026-11-14T0${revision}:00:00.000Z`,state:initialState()});

test('the device snapshot survives a close and reopen',async()=>{
 const db=await fresh();assert.equal(await db.writeSnapshot(envelope(4)),true);close();
 const reopened=await fresh();const snapshot=await reopened.readSnapshot();
 assert.equal(snapshot?.revision,4);assert.equal(snapshot?.state.tasks.length,initialState().tasks.length);close();
});

test('an older server revision cannot overwrite a newer device copy',async()=>{
 const db=await fresh();await db.writeSnapshot(envelope(9));assert.equal(await db.writeSnapshot(envelope(3)),false);
 assert.equal((await db.readSnapshot())?.revision,9);close();
});

test('queued changes keep order, ignore duplicate operation ids and can be cleared',async()=>{
 const db=await fresh();await db.queueCommand({type:'task.add',task:{title:'first'}},'op-a',new Date('2026-11-14T00:00:01Z'));
 await db.queueCommand({type:'task.add',task:{title:'second'}},'op-b',new Date('2026-11-14T00:00:02Z'));
 await db.queueCommand({type:'task.add',task:{title:'duplicate'}},'op-a',new Date('2026-11-14T00:00:03Z'));
 const queue=await db.readQueue();assert.deepEqual(queue.map(entry=>entry.id),['op-a','op-b']);
 close();
 const reopened=await fresh();assert.equal((await reopened.readQueue()).length,2);
 await reopened.clearQueued(['op-a']);assert.deepEqual((await reopened.readQueue()).map(entry=>entry.id),['op-b']);close();
});

test('clearing the device copy removes both the snapshot and the queue',async()=>{
 const db=await fresh();await db.writeSnapshot(envelope(2));await db.queueCommand({type:'task.add',task:{title:'queued'}},'op-1');
 await db.clearSiteCache();assert.equal(await db.readSnapshot(),null);assert.deepEqual(await db.readQueue(),[]);close();
});
