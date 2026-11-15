import test from 'node:test';
import assert from 'node:assert/strict';
import {applyQueued,enqueue,flushQueue,newestSnapshot,type QueuedCommand} from '../lib/site-queue.ts';
import {initialState,totalXP,type Envelope} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';

const envelope=():Envelope=>({revision:7,updatedAt:'2026-11-14T00:00:00.000Z',state:initialState()});

test('queued commands keep their order and never duplicate an operation id',()=>{
 const one:QueuedCommand={id:'a',command:{type:'task.toggle',id:'missing',done:true},at:'2026-11-14T01:00:00.000Z'};
 const two:QueuedCommand={id:'b',command:{type:'task.toggle',id:'missing',done:false},at:'2026-11-14T01:00:01.000Z'};
 assert.deepEqual(enqueue(enqueue([],one),two).map(entry=>entry.id),['a','b']);
 assert.equal(enqueue(enqueue([],one),one).length,1);
});

test('an offline change is visible on the device without changing the server revision',()=>{
 const base=envelope();
 const task=reduceCommand(base.state,{type:'task.add',task:{title:'Offline quest'}});
 const withTask={...base,state:task};
 const id=task.tasks.at(-1)!.id;
 const queued:QueuedCommand[]=[{id:'op-1',command:{type:'task.toggle',id,done:true},at:'2026-11-14T02:00:00.000Z'}];
 const shown=applyQueued(withTask,queued);
 assert.equal(shown.state.tasks.find(item=>item.id===id)?.done,true);
 assert.equal(shown.revision,7);
 assert.equal(base.state.tasks.some(item=>item.id===id),false);
});

test('an older cached snapshot never replaces a newer one',()=>{
 const older={revision:3,updatedAt:'a',cachedAt:'x',state:initialState()};
 const newer={revision:9,updatedAt:'b',cachedAt:'y',state:initialState()};
 assert.equal(newestSnapshot(older,newer).revision,9);
 assert.equal(newestSnapshot(newer,older).revision,9);
 assert.equal(newestSnapshot(null,older).revision,3);
});

test('queued commands are sent in order with their original ids, then removed',async()=>{
 const sent:string[]=[];
 const queue:QueuedCommand[]=[{id:'op-1',command:{type:'task.add',task:{title:'one'}},at:'1'},{id:'op-2',command:{type:'task.add',task:{title:'two'}},at:'2'}];
 const result=await flushQueue(queue,{send:async entry=>{sent.push(entry.id);return {...envelope(),revision:7+sent.length}},refresh:async()=>envelope()});
 assert.deepEqual(sent,['op-1','op-2']);
 assert.deepEqual(result.accepted.map(entry=>entry.id),['op-1','op-2']);
 assert.deepEqual(result.remaining,[]);
 assert.equal(result.last?.revision,9);
});

test('a stale revision is refreshed once and the same command is retried',async()=>{
 const attempts:string[]=[];
 let refreshed=0;
 const result=await flushQueue([{id:'op-9',command:{type:'task.add',task:{title:'retry me'}},at:'1'}],{
  send:async entry=>{attempts.push(entry.id);if(attempts.length===1)throw Object.assign(new Error('stale'),{status:409});return envelope()},
  refresh:async()=>{refreshed+=1;return envelope()}
 });
 assert.equal(refreshed,1);
 assert.deepEqual(attempts,['op-9','op-9']);
 assert.equal(result.remaining.length,0);
});

test('a real conflict keeps the change on the device instead of dropping it',async()=>{
 const result=await flushQueue([{id:'op-c',command:{type:'task.add',task:{title:'keep me'}},at:'1'}],{
  send:async()=>{throw Object.assign(new Error('stale'),{status:409})},
  refresh:async()=>envelope()
 });
 assert.equal(result.conflict,true);
 assert.deepEqual(result.remaining.map(entry=>entry.id),['op-c']);
 assert.deepEqual(result.accepted,[]);
});

test('a network failure stops the flush and keeps everything after it',async()=>{
 let calls=0;
 const result=await flushQueue([{id:'op-1',command:{type:'task.add',task:{title:'a'}},at:'1'},{id:'op-2',command:{type:'task.add',task:{title:'b'}},at:'2'}],{
  send:async()=>{calls+=1;throw new TypeError('Failed to fetch')},
  refresh:async()=>envelope()
 });
 assert.equal(calls,1);
 assert.deepEqual(result.remaining.map(entry=>entry.id),['op-1','op-2']);
 assert.equal(result.accepted.length,0);
 assert.equal(totalXP(initialState()),0);
});
