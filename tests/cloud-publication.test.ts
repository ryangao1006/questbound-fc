import test from 'node:test';import assert from 'node:assert/strict';
import {fencedTransport,type PendingPublication} from '../cloud/publication.ts';
const bytes=(s:string)=>new TextEncoder().encode(s);
test('durable pointer journal blocks later writes until the original publication is verified after restart',async()=>{
 const files=new Map<string,Uint8Array>();let pending:PendingPublication|null=null,fail=true;const path='sync/account/HEAD.json';files.set(path,bytes('old'));
 const base={read:async(p:string)=>files.get(p)||null,write:async(p:string,b:Uint8Array)=>{if(fail&&p===path){fail=false;throw new Error('Network interrupted')}files.set(p,b)}};
 const journal={get:async()=>pending,put:async(p:PendingPublication)=>{pending=p},clear:async()=>{pending=null}};
 await assert.rejects(fencedTransport(base,journal).write(path,bytes('new')));assert.ok(pending);assert.equal(new TextDecoder().decode(files.get(path)),'old');
 const restarted=fencedTransport(base,journal);await assert.rejects(restarted.read('other'),{code:'CLOUD_PUBLICATION_PENDING'});files.set(path,bytes('new'));await restarted.read('other');assert.equal(new TextDecoder().decode(files.get(path)),'new');assert.equal(pending,null);
});
test('publication recovery verifies a completed-but-unacknowledged write without replay and rejects external head conflicts',async()=>{
 const files=new Map<string,Uint8Array>();let pending:PendingPublication|null=null,writes=0;const path='sync/account/HEAD.json';
 const base={read:async(p:string)=>files.get(p)||null,write:async(p:string,b:Uint8Array)=>{writes++;files.set(p,b);throw new Error('Response lost')}};
 const journal={get:async()=>pending,put:async(p:PendingPublication)=>{pending=p},clear:async()=>{pending=null}};
 await assert.rejects(fencedTransport(base,journal).write(path,bytes('new')));await fencedTransport(base,journal).read(path);assert.equal(writes,1);assert.equal(pending,null);
 await assert.rejects(fencedTransport(base,journal).write(path,bytes('next')));files.set(path,bytes('external'));
 await assert.rejects(fencedTransport(base,journal).read(path),{code:'CLOUD_PUBLICATION_CONFLICT'});assert.ok(pending);
});
