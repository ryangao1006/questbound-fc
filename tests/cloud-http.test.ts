import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedText,isSameOriginWrite} from '../cloud/http-policy.ts';
test('cloud writes require exact same-origin Origin, missing and hostile origins rejected',()=>{
 const make=(origin?:string)=>new Request('https://planner.example/api/cloud/commit',{method:'POST',headers:origin?{origin}:{}});
 assert.equal(isSameOriginWrite(make('https://planner.example'),'https://planner.example'),true);
 assert.equal(isSameOriginWrite(make(),'https://planner.example'),false);
 assert.equal(isSameOriginWrite(make('https://planner.example.evil.test'),'https://planner.example'),false);
});
test('cloud request bounds actual streamed bytes, including Unicode without Content-Length',async()=>{
 assert.equal(await boundedText(new Request('https://planner.example',{method:'POST',body:'中文'}),6),'中文');
 await assert.rejects(boundedText(new Request('https://planner.example',{method:'POST',body:'中文'}),5),{status:413});
});

test('notification subscriptions reject arbitrary servers and URL credentials',async()=>{
 const {validateSubscription}=await import('../cloud/push.ts');
 const s=(endpoint:string)=>({endpoint,expirationTime:null,keys:{auth:'test',p256dh:'test'}});
 assert.doesNotThrow(()=>validateSubscription(s('https://fcm.googleapis.com/fcm/send/test')));
 for(const endpoint of ['https://evil.example/push','http://fcm.googleapis.com/send','https://user:password@fcm.googleapis.com/send','https://fcm.googleapis.com:8443/send','https://fcm.googleapis.com.evil.example/send'])assert.throws(()=>validateSubscription(s(endpoint)));
});

test('browser writes bind both request header and payload to the signed-in cache owner',async()=>{
 const {assertExpectedAccount,assertAccountPayload}=await import('../cloud/http-policy.ts');
 const request=(method:string,owner?:string)=>new Request('https://planner.example/api/cloud/commit',{method,headers:owner?{'X-QFC-Account':owner}:{}});
 assert.doesNotThrow(()=>assertExpectedAccount(request('POST','ownerA'),'ownerA'));
 for(const req of [request('POST'),request('POST','ownerA'),request('GET','ownerA')])assert.throws(()=>assertExpectedAccount(req,'ownerB'),{status:403,code:'ACCOUNT_CHANGED'});
 assert.doesNotThrow(()=>assertExpectedAccount(request('GET'),'ownerB'));
 for(const owner of [undefined,null,'ownerA'])assert.throws(()=>assertAccountPayload(owner,'ownerB'),{status:403,code:'ACCOUNT_CHANGED'});
 assert.doesNotThrow(()=>assertAccountPayload('ownerB','ownerB'));
});
