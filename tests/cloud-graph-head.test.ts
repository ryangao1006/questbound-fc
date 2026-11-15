import test from 'node:test';import assert from 'node:assert/strict';
import {conditionalHead,type HeadCAS} from '../cloud/graph-head.ts';
test('conditional metadata retries keep original ETag and delayed attempts cannot revert later heads',async()=>{
 let item={id:'head',eTag:'1',description:'old'},pending:HeadCAS|null=null,fail=true;const tags:string[]=[];
 const metadata={item:async()=>({...item}),create:async()=>({...item}),patch:async(_id:string,tag:string,description:string)=>{tags.push(tag);if(fail){fail=false;throw new Error('Lost network before dispatch')}if(tag!==item.eTag)return 412;item={...item,eTag:String(Number(item.eTag)+1),description};return 200}};
 const journal={get:async()=>pending,put:async(p:HeadCAS)=>{pending=p},clear:async()=>{pending=null}};
 await assert.rejects(conditionalHead(metadata,journal).write(new TextEncoder().encode('new')));assert.ok(pending);
 await conditionalHead(metadata,journal).write(new TextEncoder().encode('new'));assert.deepEqual(tags,['1','1']);assert.equal(pending,null);
 await conditionalHead(metadata,journal).write(new TextEncoder().encode('later'));assert.equal(await metadata.patch('head','1','new'),412);assert.equal(item.description,'later');
});
test('conditional publication detects a conflicting external edit instead of changing its expected ETag',async()=>{
 let item={id:'head',eTag:'1',description:'old'},pending:HeadCAS|null=null,fail=true;
 const metadata={item:async()=>({...item}),create:async()=>({...item}),patch:async(_id:string,tag:string,description:string)=>{if(fail){fail=false;throw new Error('Timeout')}if(tag!==item.eTag)return 412;item={...item,eTag:'3',description};return 200}};
 const journal={get:async()=>pending,put:async(p:HeadCAS)=>{pending=p},clear:async()=>{pending=null}};
 await assert.rejects(conditionalHead(metadata,journal).write(new TextEncoder().encode('new')));item={...item,eTag:'2',description:'external'};
 await assert.rejects(conditionalHead(metadata,journal).write(new TextEncoder().encode('new')),{code:'CLOUD_PUBLICATION_CONFLICT'});assert.equal(item.description,'external');assert.ok(pending);
});
test('read-back of completed publication clears the CAS journal after its response is lost',async()=>{
 let item={id:'head',eTag:'1',description:'old'},pending:HeadCAS|null=null;
 const metadata={item:async()=>({...item}),create:async()=>({...item}),patch:async(_id:string,_tag:string,description:string)=>{item={...item,eTag:'2',description};throw new Error('Response lost after save')}};
 const journal={get:async()=>pending,put:async(p:HeadCAS)=>{pending=p},clear:async()=>{pending=null}};
 const head=conditionalHead(metadata,journal);await assert.rejects(head.write(new TextEncoder().encode('new')));assert.ok(pending);assert.equal(new TextDecoder().decode((await head.read())!),'new');assert.equal(pending,null);
});
