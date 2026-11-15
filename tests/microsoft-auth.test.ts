import test from 'node:test';
import assert from 'node:assert/strict';
import {createMicrosoftAuth,type MicrosoftVault,type MicrosoftSession,type MicrosoftPending} from '../lib/microsoft-auth.ts';
const issuer='https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0';
const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function setup(overrides:Record<string,unknown>={}){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const publicKey={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test'};
 const pending=new Map<string,MicrosoftPending>(),sessions=new Map<string,MicrosoftSession>();
 const vault:MicrosoftVault={async putPending(x){pending.set(x.state,x)},async takePending(id){const x=pending.get(id)||null;pending.delete(id);return x},async putSession(x){sessions.set(x.id,x)},async getSession(id){return sessions.get(id)||null},async deleteSession(id){sessions.delete(id)}};
 let claims:Record<string,unknown>={},refreshes=0;
 const transport:typeof fetch=async(input,init)=>{
  if(String(input).endsWith('/keys'))return Response.json({keys:[publicKey]});
  const body=new URLSearchParams(String(init?.body));
  if(body.get('grant_type')==='refresh_token'){refreshes++;return Response.json({access_token:'new-access',refresh_token:'rotated',expires_in:3600});}
  assert.equal(body.get('client_secret'),'secret');assert.ok(body.get('code_verifier'));
  const p=[...pending.values()][0];void p;
  const payload=encode({...claims,...overrides}),header=encode({alg:'RS256',kid:'test'});
  const signature=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(header+'.'+payload))).toString('base64url');
  return Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,id_token:header+'.'+payload+'.'+signature});
 };
 const config={clientId:'client',clientSecret:'secret',redirectUri:'https://planner.example/auth/callback',allowedSubjects:[issuer+'|owner']};
 const auth=createMicrosoftAuth(config,vault,transport);
 async function begin(enrollmentGrant?:string){const req=new Request('https://planner.example/auth/start?returnTo=//evil.example');const start=await (enrollmentGrant?auth.beginEnrollment(req,enrollmentGrant):auth.begin(req));const query=new URL(start.url).searchParams;claims={iss:issuer,aud:'client',sub:'owner',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,nonce:query.get('nonce')};return {start,request:new Request(config.redirectUri+'?code=code&state='+query.get('state'),{headers:{cookie:start.cookie.split(';')[0]}})};}
 return {auth,begin,pending,sessions,config,vault,get refreshes(){return refreshes}};
}
test('Microsoft PKCE flow validates signed identity, binds browser and creates private session',async()=>{
 const ctx=await setup(),{start,request}=await ctx.begin();
 const params=new URL(start.url).searchParams;
 assert.equal(params.get('code_challenge_method'),'S256');assert.ok(params.get('scope')?.includes('Files.ReadWrite.AppFolder'));assert.match(start.cookie,/HttpOnly; Secure; SameSite=Lax/);
 const result=await ctx.auth.callback(request);assert.equal(result.returnTo,'/');assert.equal(result.session.subject,issuer+'|owner');assert.equal(ctx.sessions.size,1);
 const req=new Request('https://planner.example',{headers:{cookie:result.cookies[0].split(';')[0]}});
 assert.equal((await ctx.auth.session(req))?.subject,issuer+'|owner');await assert.rejects(ctx.auth.callback(request),/expired/);
 await ctx.auth.logout(req);assert.equal(await ctx.auth.session(req),null);
});
test('Microsoft callback rejects absent browser binding and consumes state',async()=>{
 const ctx=await setup(),{request}=await ctx.begin();await assert.rejects(ctx.auth.callback(new Request(request.url)),/another browser/);assert.equal(ctx.sessions.size,0);assert.equal(ctx.pending.size,0);
});
for(const [name,claim] of Object.entries({audience:{aud:'other'},nonce:{nonce:'other'},issuer:{iss:'https://evil.example'},expiry:{exp:1},future:{iat:Math.floor(Date.now()/1000)+600},algorithmIdentity:{sub:'outsider'}})){
 test('Microsoft rejects '+name,async()=>{const ctx=await setup(claim),{request}=await ctx.begin();await assert.rejects(ctx.auth.callback(request));assert.equal(ctx.sessions.size,0)});
}
test('Microsoft refresh rotates credentials and never exposes them as cookies',async()=>{
 const ctx=await setup(),{request}=await ctx.begin();const result=await ctx.auth.callback(request);result.session.tokenExpiresAt=0;
 const renewed=await ctx.auth.refresh(result.session);assert.equal(renewed.refreshToken,'rotated');assert.equal(ctx.refreshes,1);assert.ok(result.cookies.every(c=>!c.includes('refresh')));
 ctx.config.allowedSubjects=[];assert.equal(await ctx.auth.session(new Request('https://planner.example',{headers:{cookie:result.cookies[0].split(';')[0]}})),null);
});
test('unconfigured owner cannot be silently enrolled',async()=>{const ctx=await setup();ctx.config.allowedSubjects=[];await assert.rejects(ctx.auth.begin(new Request('https://planner.example')),/owner account/)});
test('trusted enrollment binds only after signed identity and atomic setup-grant acceptance',async()=>{
 const ctx=await setup();ctx.config.allowedSubjects=[];let consumed=false;let enrollments=0;
 ctx.vault.enrollOwner=async(subject,grant)=>{enrollments++;if(consumed||grant!=='trusted-once'||subject!==issuer+'|owner')return false;consumed=true;return true};
 const signed=await ctx.begin('trusted-once');
 const result=await ctx.auth.callback(signed.request);assert.equal(result.session.subject,issuer+'|owner');assert.equal(enrollments,1);assert.equal(consumed,true);assert.ok(ctx.config.allowedSubjects.includes(result.session.subject));assert.ok(signed.start.cookie.includes('HttpOnly'));
});
test('invalid or refused enrollment grant never creates a session',async()=>{
 const ctx=await setup();ctx.config.allowedSubjects=[];ctx.vault.enrollOwner=async()=>false;const {request}=await ctx.begin('wrong');await assert.rejects(ctx.auth.callback(request),/restricted/);assert.equal(ctx.sessions.size,0);
});

test('enrollment never consumes setup authority for an invalid Microsoft identity',async()=>{const ctx=await setup({nonce:'tampered'});ctx.config.allowedSubjects=[];let called=false;ctx.vault.enrollOwner=async()=>{called=true;return true};const {request}=await ctx.begin('trusted-once');await assert.rejects(ctx.auth.callback(request),/verified/);assert.equal(called,false);assert.equal(ctx.sessions.size,0)});

test('background provider authorization refreshes after browser expiry without renewing a session',async()=>{const ctx=await setup(),{request}=await ctx.begin(),done=await ctx.auth.callback(request);const expired={...done.session,expiresAt:1,tokenExpiresAt:0};await ctx.auth.logout(new Request('https://planner.example',{headers:{cookie:done.cookies[0].split(';')[0]}}));assert.equal(ctx.sessions.size,0);await assert.rejects(ctx.auth.refresh(expired),/sign in/);const updated=await ctx.auth.refreshAuthorization(expired);assert.equal(updated.accessToken,'new-access');assert.equal(updated.refreshToken,'rotated');assert.equal(updated.expiresAt,1);assert.equal(ctx.sessions.size,0);ctx.config.allowedSubjects=[];await assert.rejects(ctx.auth.refreshAuthorization(updated),/no longer authorized/)});
