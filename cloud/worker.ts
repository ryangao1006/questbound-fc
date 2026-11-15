import {commitFingerprint,acknowledgedPending,verifySeenCloud,type SeenCloud,type PendingCommit} from './sync-recovery';
import {initialState} from '../lib/model';
import {conditionalHead,type HeadCAS,type HeadItem} from './graph-head';
import {fencedTransport,type PendingPublication} from './publication';
import {retentionIds} from '../lib/archive';
import {makeVapid,deliver,validateSubscription,type Vapid} from './push';
import type {PushSubscription} from '@block65/webcrypto-web-push';
import {rebuildReminders,isQuiet} from '../lib/domain';
import {needsFreshTaskVerification} from '../lib/task-follow-up';
import {packCloudArchive,unpackCloudArchive,previewCloudRestore,prepareCloudRestore} from '../lib/cloud-archive';
import {CloudTodoist} from '../lib/cloud-todoist';
import {boundedText,isSameOriginWrite,assertExpectedAccount,assertAccountPayload} from './http-policy';
import {DurableObject} from 'cloudflare:workers';
import {createMicrosoftAuth,type MicrosoftVault,type MicrosoftPending,type MicrosoftSession} from '../lib/microsoft-auth';
import {OneDriveSnapshotStore,cloudChecksum,type CloudSnapshot,type CloudPayload} from '../lib/onedrive-storage';
import {base64url,unbase64,newKey,sealJSON,openJSON} from '../lib/crypto';
interface Env {ACCOUNTS:DurableObjectNamespace<AccountCoordinator>;ASSETS:Fetcher;MICROSOFT_CLIENT_ID:string;MICROSOFT_CLIENT_SECRET:string;MICROSOFT_ALLOWED_SUBJECTS:string;APP_ENCRYPTION_KEY:string;PUBLIC_ORIGIN:string;OWNER_SETUP_TOKEN?:string;}
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configured=(e:Env)=>!!(e.MICROSOFT_CLIENT_ID&&e.MICROSOFT_CLIENT_SECRET&&e.APP_ENCRYPTION_KEY&&e.PUBLIC_ORIGIN);
function vault(e:Env):MicrosoftVault {const object=(key:string)=>e.ACCOUNTS.getByName(key);return {putPending:async v=>{await object('pending:'+v.state).vaultPut('pending',JSON.stringify(v),v.expiresAt)},takePending:async s=>{const raw=await object('pending:'+s).vaultTake('pending');return raw?JSON.parse(raw) as MicrosoftPending:null},putSession:async v=>{await object('session:'+v.id).vaultPut('session',JSON.stringify(v),v.expiresAt)},getSession:async id=>{const raw=await object('session:'+id).vaultGet('session');return raw?JSON.parse(raw) as MicrosoftSession:null},deleteSession:async id=>{await object('session:'+id).vaultDelete('session')},enrollOwner:async(subject,grant)=>object('owner-registry').enrollOwner(subject,grant)};}

async function auth(e:Env){const registered=await e.ACCOUNTS.getByName('owner-registry').registeredOwner();return createMicrosoftAuth({clientId:e.MICROSOFT_CLIENT_ID,clientSecret:e.MICROSOFT_CLIENT_SECRET,redirectUri:e.PUBLIC_ORIGIN+'/api/account/callback',allowedSubjects:[...(e.MICROSOFT_ALLOWED_SUBJECTS||'').split('\n').filter(Boolean),...(registered?[registered]:[])]},vault(e));}

const wire=(s:CloudSnapshot|null)=>({snapshot:s?{state:s.payload.planner,...(s.payload.career!==undefined?{career:s.payload.career}:{}),...(s.payload.integrations?{integrations:s.payload.integrations}:{})}:null,revision:s?.revision||0,updatedAt:s?.updatedAt||''});
export default {async fetch(req:Request,e:Env):Promise<Response>{try{
 const url=new URL(req.url),path=url.pathname;
 if(!path.startsWith('/api/'))return e.ASSETS.fetch(req);
 if(path.startsWith('/api/helper/')&&path!=='/api/helper/enroll'){
  const readOnly=path==='/api/helper/backups'||path.startsWith('/api/helper/download/');if(req.method!==(readOnly?'GET':'POST'))return reply({error:'Method not allowed.'},405);
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'',parts=token.split('.');if(parts.length!==2) return reply({error:'Backup helper authorization required.'},401);
  let subject:string;try{subject=new TextDecoder().decode(unbase64(parts[0]))}catch{return reply({error:'Invalid helper token.'},401)}
  const raw=req.method==='POST'?await boundedText(req,8192):'{}',result=JSON.parse(await e.ACCOUNTS.getByName('account:'+subject).helper(token,path,raw));
  if(result.bytes)return new Response(unbase64(result.bytes) as BodyInit,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Checksum-Sha256':result.checksum}});return reply(result);
 }
 if(path==='/api/account/session'){
  if(!configured(e))return reply({account:null,configured:false});const s=await(await auth(e)).session(req);return reply({account:s?{id:s.subject,label:s.name}:null,configured:true,background:s?await e.ACCOUNTS.getByName('account:'+s.subject).serviceStatus():null,setupRequired:!await e.ACCOUNTS.getByName('owner-registry').registeredOwner()&&!(e.MICROSOFT_ALLOWED_SUBJECTS||'').trim()&&!!e.OWNER_SETUP_TOKEN});
 }
 if(!configured(e))return reply({error:'Microsoft / OneDrive setup is not complete.',code:'ACCOUNT_NOT_CONFIGURED'},503);
 if(url.origin!==e.PUBLIC_ORIGIN)return reply({error:'Invalid application origin.'},403);
 if(req.method==='POST'&&!isSameOriginWrite(req,e.PUBLIC_ORIGIN))return reply({error:'Please use the planner to perform this action.'},403);
 const a=await auth(e);
 if(path==='/api/account/enroll/start'&&req.method==='POST'){
  const body=JSON.parse(await boundedText(req,4096)),grant=String(body.setupToken||'');
  if(!e.OWNER_SETUP_TOKEN||!await e.ACCOUNTS.getByName('owner-registry').validSetup(grant))return reply({error:'Owner setup authorization is invalid or has already been used.'},403);
  const start=await a.beginEnrollment(req,grant);return new Response(JSON.stringify({url:start.url}),{headers:{'Content-Type':'application/json','Set-Cookie':start.cookie,'Cache-Control':'no-store'}});
 }
 if(path==='/api/account/start'&&req.method==='GET'){const start=await a.begin(req);return new Response(null,{status:302,headers:{Location:start.url,'Set-Cookie':start.cookie,'Cache-Control':'no-store'}})}
 if(path==='/api/account/callback'&&req.method==='GET'){const done=await a.callback(req);const headers=new Headers({Location:done.returnTo,'Cache-Control':'no-store'});done.cookies.forEach(c=>headers.append('Set-Cookie',c));return new Response(null,{status:303,headers})}
 if(path==='/api/account/logout'&&req.method==='POST'){const done=await a.logout(req),response=reply({ok:true});done.cookies.forEach(c=>response.headers.append('Set-Cookie',c));return response}
 const session=await a.session(req);if(!session)return reply({error:'Please sign in with Microsoft.',code:'AUTH_REQUIRED'},401);
 assertExpectedAccount(req,session.subject);
 const coordinator=e.ACCOUNTS.getByName('account:'+session.subject);
 if((path.startsWith('/api/connections/todoist')||path==='/api/sync'||path==='/api/connections/disconnect'||path==='/api/connections/resume')&&(req.method==='POST'||path==='/api/connections/todoist/preview'&&req.method==='GET')){
  const body=req.method==='POST'?JSON.parse(await boundedText(req,16384)):{};
  return reply(JSON.parse(await coordinator.todoist(JSON.stringify(session),path,JSON.stringify({...body,project:body.project||url.searchParams.get('project')||''}))));
 }
 if(path.startsWith('/api/backups')||path.startsWith('/api/restore')||path.startsWith('/api/push/')||path==='/api/devices'||path==='/api/service/check'||path==='/api/helper/enroll'){
  const readOnly=path==='/api/backups'||path.startsWith('/api/backups/download/')||path==='/api/devices';if(req.method!==(readOnly?'GET':'POST'))return reply({error:'Method not allowed.'},405);
  let body:Record<string,unknown>={};
  if(path==='/api/restore/preview'){const form=await req.formData(),file=form.get('archive');if(!(file instanceof File)||file.size>20*1024*1024)throw new Error('Choose a recovery archive under 20 MB.');body={bytes:base64url(new Uint8Array(await file.arrayBuffer())),key:String(form.get('key')||'')}}
  else if(req.method==='POST')body=JSON.parse(await boundedText(req,16384));
  const value=JSON.parse(await coordinator.services(JSON.stringify(session),path,JSON.stringify(body)));
  if(value.bytes)return new Response(unbase64(value.bytes) as BodyInit,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':'attachment; filename="questbound-fc.qibak"'}});
  return reply(value);
 }
 if(path==='/api/cloud/recover'&&req.method==='POST'){const body=JSON.parse(await boundedText(req,4096));assertAccountPayload(body.accountId,session.subject);return reply({...JSON.parse(await coordinator.recoverPending(JSON.stringify(session),JSON.stringify(body))),accountId:session.subject})}
 if(path==='/api/cloud/read'&&req.method==='GET')return reply({...JSON.parse(await coordinator.read(JSON.stringify(session))),accountId:session.subject});
 if(path==='/api/cloud/commit'&&req.method==='POST'){
  const raw=await boundedText(req);
  const input=JSON.parse(raw) as {accountId:string;operationId:string;baseRevision:number;snapshot:{state:CloudPayload['planner'];career?:CloudPayload['career'];integrations?:CloudPayload['integrations']}};
  assertAccountPayload(input.accountId,session.subject);
  const payload:CloudPayload={planner:input.snapshot.state,...(input.snapshot.career!==undefined?{career:input.snapshot.career}:{}),...(input.snapshot.integrations?{integrations:input.snapshot.integrations}:{})};
  const result=JSON.parse(await coordinator.commit(JSON.stringify(session),JSON.stringify({operationId:input.operationId,baseRevision:input.baseRevision,payload})));return reply({...result,accountId:session.subject});
 }
 return reply({error:'This action is not available in this cloud entry.',code:'NOT_IMPLEMENTED'},404);
 }catch(error){return reply({error:error instanceof Error?error.message:'Request failed.',code:(error as {code?:string}).code||'CLOUD_REQUEST_FAILED'},(error as {status?:number}).status||503)}}};

/** Stores credentials and coordination metadata only; all planner snapshots remain in OneDrive. */
export class AccountCoordinator extends DurableObject<Env>{
 private tail:Promise<unknown>=Promise.resolve();
 private serialized<T>(work:()=>Promise<T>):Promise<T>{const result=this.tail.then(work,work);this.tail=result.catch(()=>{});return result;}
 async serviceStatus(){return await this.ctx.storage.get<{checkedAt:string;lastError?:string}>('service-status')||null}
 async registeredOwner(){return await this.ctx.storage.get<string>('registered-owner')||null}
 async validSetup(grant:string){if(!this.env.OWNER_SETUP_TOKEN||await this.registeredOwner())return false;const a=await cloudChecksum(new TextEncoder().encode(grant)),b=await cloudChecksum(new TextEncoder().encode(this.env.OWNER_SETUP_TOKEN));let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
 async enrollOwner(subject:string,grant:string){return this.serialized(async()=>{if(!await this.validSetup(grant))return false;await this.ctx.storage.put('registered-owner',subject);return true})}
 async vaultPut(key:string,value:string,expiresAt?:number){await this.ctx.storage.put(key,{ciphertext:await sealJSON(value,this.env.APP_ENCRYPTION_KEY),expiresAt});if(expiresAt)await this.ctx.storage.setAlarm(expiresAt);}
 async vaultGet(key:string):Promise<string|null>{const saved=await this.ctx.storage.get<{ciphertext:string;expiresAt?:number}>(key);if(!saved)return null;if(saved.expiresAt&&saved.expiresAt<=Date.now()){await this.ctx.storage.delete(key);return null}return openJSON<string>(saved.ciphertext,this.env.APP_ENCRYPTION_KEY)}
 async vaultTake(key:string):Promise<string|null>{return this.serialized(async()=>{const value=await this.vaultGet(key);await this.ctx.storage.delete(key);return value})}
 async vaultDelete(key:string){await this.ctx.storage.delete(key)}
 async alarm(){
  const account=await this.ctx.storage.get<string>('account-subject');if(!account){await this.ctx.storage.deleteAll();return}
  const errors:string[]=[];
  try{const raw=await this.vaultGet('authorization');if(raw&&await this.vaultGet('todoist'))await this.todoist(raw,'/api/sync','{"background":true}')}catch(e){errors.push(e instanceof Error?e.message:'Source verification failed.')}
  try{const raw=await this.vaultGet('authorization');if(raw)await this.services(raw,'/api/service/check','{}')}catch(e){errors.push(e instanceof Error?e.message:'Background service failed.')}
  await this.ctx.storage.put('service-status',{checkedAt:new Date().toISOString(),...(errors.length?{lastError:[...new Set(errors)].join(' · ')}:{})});
  await this.ctx.storage.setAlarm(Date.now()+60000);
 }

 private async transport(session:MicrosoftSession){
  // Serialize token rotation together with cloud work. Never return tokens to the browser.
  const stored=await this.vaultGet('authorization');const saved:MicrosoftSession|null=stored?JSON.parse(stored):null;
  const refreshed=await(await auth(this.env)).refreshAuthorization(saved&&saved.expiresAt>=session.expiresAt?saved:session);
  await this.vaultPut('authorization',JSON.stringify(refreshed));
  const graph=async(path:string,init?:RequestInit)=>fetch('https://graph.microsoft.com/v1.0'+path,{...init,headers:{...init?.headers,Authorization:'Bearer '+refreshed.accessToken},signal:AbortSignal.timeout(20000)});
  const rootResponse=await graph('/me/drive/special/approot');if(!rootResponse.ok)throw new Error('OneDrive application folder is unavailable. Reconnect Microsoft.');
  const root=await rootResponse.json() as {id:string};
  // Flatten paths into one app folder: no mkdir races and no permissions outside approot.
  const resource=async(path:string)=>'/me/drive/items/'+encodeURIComponent(root.id)+':/'+await cloudChecksum(new TextEncoder().encode(path))+'.json:/content';
  const head=(path:string)=>conditionalHead({item:async()=>{const r=await graph((await resource(path)).replace(/:\/content$/,''));if(r.status===404)return null;if(!r.ok)throw new Error('OneDrive head metadata is unavailable.');return r.json() as Promise<HeadItem>},create:async()=>{const r=await graph('/me/drive/items/'+encodeURIComponent(root.id)+'/children',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:await cloudChecksum(new TextEncoder().encode(path))+'.json',folder:{},'@microsoft.graph.conflictBehavior':'fail'})});if(r.status===409){const current=await graph((await resource(path)).replace(/:\/content$/,''));if(current.ok)return current.json() as Promise<HeadItem>}if(!r.ok)throw new Error('OneDrive head creation failed.');return r.json() as Promise<HeadItem>},patch:async(id,eTag,description)=>{const r=await graph('/me/drive/items/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','If-Match':eTag},body:JSON.stringify({description})});if(!r.ok&&r.status!==412)throw new Error('OneDrive conditional publication failed ('+r.status+').');return r.status}},{get:async()=>await this.ctx.storage.get<HeadCAS>('graph-head-cas')||null,put:async value=>this.ctx.storage.put('graph-head-cas',value),clear:async()=>{await this.ctx.storage.delete('graph-head-cas')}});
  return {read:async (path:string)=>{if(path.endsWith('/HEAD.json'))return head(path).read();const r=await graph(await resource(path));if(r.status===404)return null;if(!r.ok)throw new Error('OneDrive read failed ('+r.status+').');const b=new Uint8Array(await r.arrayBuffer());if(b.length>24*1024*1024)throw new Error('OneDrive snapshot too large.');return b},write:async(path:string,bytes:Uint8Array)=>{if(path.endsWith('/HEAD.json'))return head(path).write(bytes);const r=await graph(await resource(path),{method:'PUT',headers:{'Content-Type':'application/json'},body:bytes as BodyInit});if(!r.ok)throw new Error('OneDrive write failed ('+r.status+').')},remove:async(path:string)=>{const metadata=await graph((await resource(path)).replace(/:\/content$/,''));if(metadata.status===404)return;if(!metadata.ok)throw new Error('Backup cleanup lookup failed.');const item=await metadata.json() as {id:string};const deleted=await graph('/me/drive/items/'+encodeURIComponent(item.id),{method:'DELETE'});if(!deleted.ok&&deleted.status!==404)throw new Error('Backup cleanup failed.')}};
 }
 private async store(session:MicrosoftSession){const store=new OneDriveSnapshotStore(await this.snapshotTransport(session)),read=store.read.bind(store);store.read=async accountId=>{const snapshot=await read(accountId),seen=await this.ctx.storage.get<SeenCloud>('seen-cloud'),next=await verifySeenCloud(seen,snapshot);if(next)await this.ctx.storage.put('seen-cloud',next);const pending=await this.ctx.storage.get<PendingCommit>('pending-commit');if(acknowledgedPending(pending,snapshot))await this.ctx.storage.delete('pending-commit');return snapshot};return store}
 private async snapshotTransport(session:MicrosoftSession){return fencedTransport(await this.transport(session),{get:async()=>await this.ctx.storage.get<PendingPublication>('pending-head')||null,put:async value=>this.ctx.storage.put('pending-head',value),clear:async()=>{await this.ctx.storage.delete('pending-head')}},true)}
 async todoist(rawSession:string,path:string,rawBody:string){return this.serialized(async()=>{
  if(await this.ctx.storage.get('pending-commit'))throw Object.assign(new Error('Retry the pending cloud upload first.'),{status:409});
  const session=JSON.parse(rawSession) as MicrosoftSession,b=JSON.parse(rawBody) as Record<string,unknown>;
  const saved=await this.vaultGet('todoist'),token=path==='/api/connections/todoist'?String(b.token||''):saved?String(JSON.parse(saved).token):'';
  const service=new CloudTodoist(await this.store(session),session.subject,token);
  if(path==='/api/connections/todoist/preview')return JSON.stringify(await service.preview(String(b.project||'')));
  if(path==='/api/connections/todoist'){const snapshot=await service.connect();await this.vaultPut('todoist',JSON.stringify({token}));await this.ctx.storage.put('account-subject',session.subject);await this.ctx.storage.setAlarm(Date.now()+60000);return JSON.stringify({projects:snapshot.payload.integrations?.todoist?.cache.projects||[],...wire(snapshot)})}
  if(path==='/api/connections/disconnect'){if(b.provider!=='todoist')throw new Error('This provider is not supported in the new cloud entry.');const result=await service.disconnect();await this.vaultDelete('todoist');await this.ctx.storage.setAlarm(Date.now()+60000);return JSON.stringify(wire(result))}
  if(path==='/api/connections/resume'){
   const store=await this.store(session),current=await store.read(session.subject);if(!current)throw new Error('Upload your planner first.');const payload=structuredClone(current.payload);
   if(payload.planner.connections.icloud?.connected)throw new Error('Reconnect or disconnect iCloud before resuming.');
   if(payload.planner.connections.todoist?.connected){if(!token)throw new Error('Reconnect Todoist before resuming.');await service.preview('')}
   payload.planner.settings.integrationsPaused=false;const result=await store.commit({accountId:session.subject,baseRevision:current.revision,operationId:crypto.randomUUID(),payload});
   if(!payload.planner.connections.todoist?.connected)return JSON.stringify(wire(result));
   try{return JSON.stringify(wire(await service.sync(true)))}catch(error){const latest=await store.read(session.subject);if(latest){const paused=structuredClone(latest.payload);paused.planner.settings.integrationsPaused=true;await store.commit({accountId:session.subject,baseRevision:latest.revision,operationId:crypto.randomUUID(),payload:paused})}throw error}
  }
  if(!token)throw Object.assign(new Error('Connect Todoist first.'),{status:400});
  if(path==='/api/connections/todoist/import')return JSON.stringify(wire(await service.importProject(String(b.project),b.mode==='sync'?'sync':'import',Array.isArray(b.selected)?b.selected.map(String):[])));
  if(path==='/api/sync'){const result=await service.sync(!b.background);await this.ctx.storage.put('todoist-verified-at',Date.now());return JSON.stringify(wire(result))}
  throw Object.assign(new Error('Unknown Todoist action.'),{status:404});
 })}
 private async push(message:{title:string;body:string;url:string;tag:string}){
  const raw=await this.vaultGet('vapid'),keys:Vapid=raw?JSON.parse(raw):await makeVapid();if(!raw)await this.vaultPut('vapid',JSON.stringify(keys));
  const devices=await this.ctx.storage.list<{subscription:PushSubscription;label:string;enabled:boolean}>({prefix:'device:'});let accepted=0;
  for(const [id,device] of devices){if(!device.enabled)continue;const tag='delivery:'+message.tag+':'+id;if(await this.ctx.storage.get(tag))continue;
   // Persist before transport. Uncertain deliveries are never blindly replayed.
   await this.ctx.storage.put(tag,{status:'sending',at:Date.now()});
   try{const response=await deliver(device.subscription,keys,message);if(response.status===410||response.status===404)await this.ctx.storage.put(id,{...device,enabled:false});if(!response.ok)throw new Error('Push provider rejected delivery.');await this.ctx.storage.put(tag,{status:'accepted',at:Date.now()});accepted++}catch{await this.ctx.storage.put(tag,{status:'uncertain',at:Date.now()})}
  }return accepted;
 }
 private async backup(session:MicrosoftSession,kind:string){
  const key=await this.vaultGet('recovery');if(!key)throw new Error('Create a recovery key first.');const transport=await this.transport(session),store=new OneDriveSnapshotStore(await this.snapshotTransport(session)),snapshot=await store.read(session.subject);if(!snapshot)throw new Error('Upload your planner first.');
  const packed=await packCloudArchive(snapshot,key),id=packed.archive.id,path='backups/'+id+'.qibak';await transport.write(path,packed.bytes);const bytes=await transport.read(path);if(!bytes||await cloudChecksum(bytes)!==packed.checksum)throw new Error('Backup upload verification failed.');await unpackCloudArchive(bytes,key);
  const raw=await transport.read('backups/index.json'),rows=raw?JSON.parse(new TextDecoder().decode(raw)):[];const row={id,created_at:packed.archive.createdAt,revision:snapshot.revision,kind,checksum:packed.checksum,size:bytes.length,verified:1,onedrive_at:new Date().toISOString(),path};rows.unshift(row);const keep=retentionIds(rows),retained=rows.filter((r:{id:string})=>keep.has(r.id));const indexBytes=new TextEncoder().encode(JSON.stringify(retained));await transport.write('backups/index.json',indexBytes);const checked=await transport.read('backups/index.json');if(!checked||await cloudChecksum(checked)!==await cloudChecksum(indexBytes))throw new Error('Backup index verification failed.');for(const old of rows.filter((r:{id:string})=>!keep.has(r.id)))try{await transport.remove(old.path)}catch{/* Cleanup never invalidates a verified new backup. */}return row;
 }
 async services(rawSession:string,path:string,rawBody:string){return this.serialized(async()=>{
  const session=JSON.parse(rawSession) as MicrosoftSession,b=JSON.parse(rawBody);await this.ctx.storage.put('account-subject',session.subject);await this.ctx.storage.setAlarm(Date.now()+60000);
  if(await this.ctx.storage.get('pending-commit'))throw Object.assign(new Error('Retry the pending cloud upload first.'),{status:409});
  if(path==='/api/push/key'){let raw=await this.vaultGet('vapid');if(!raw){raw=JSON.stringify(await makeVapid());await this.vaultPut('vapid',raw)}return JSON.stringify({publicKey:JSON.parse(raw).publicKey})}
  if(path==='/api/push/register'){validateSubscription(b.subscription);if(!/^[\w-]{1,128}$/.test(b.id))throw new Error('Invalid device ID.');await this.ctx.storage.put('device:'+b.id,{subscription:b.subscription,label:String(b.label||'This device').slice(0,80),enabled:true});return '{"ok":true}'}
  if(path==='/api/push/disable'){const key='device:'+String(b.id),device=await this.ctx.storage.get<Record<string,unknown>>(key);if(device)await this.ctx.storage.put(key,{...device,enabled:false});return '{"ok":true}'}
  if(path==='/api/devices'){const rows=await this.ctx.storage.list<Record<string,unknown>>({prefix:'device:'});return JSON.stringify({devices:[...rows].map(([id,d])=>({id:id.slice(7),label:d.label,enabled:d.enabled}))})}
  if(path==='/api/push/test')return JSON.stringify({accepted:await this.push({title:'Questbound FC',body:'Notifications are connected. / 提醒已连接。',url:'/?view=settings',tag:'test:'+crypto.randomUUID()})});
  if(path==='/api/helper/enroll'){let key=await this.vaultGet('recovery');if(!key){key=newKey();await this.vaultPut('recovery',key)}await this.backup(session,'manual');const id=crypto.randomUUID(),token=base64url(new TextEncoder().encode(session.subject))+'.'+newKey();await this.ctx.storage.put('helper:'+await cloudChecksum(new TextEncoder().encode(token)),{id,createdAt:Date.now()});return JSON.stringify({id,token,recoveryKey:key,siteUrl:this.env.PUBLIC_ORIGIN})}
  if(path==='/api/backups/setup'){let key=await this.vaultGet('recovery');if(!key){key=newKey();await this.vaultPut('recovery',key)}return JSON.stringify({key})}
  const transport=await this.transport(session),store=new OneDriveSnapshotStore(await this.snapshotTransport(session));
  if(path==='/api/backups'){const raw=await transport.read('backups/index.json');return JSON.stringify({backups:raw?JSON.parse(new TextDecoder().decode(raw)):[],ready:!!await this.vaultGet('recovery')})}
  if(path.startsWith('/api/backups/download/')){const id=path.split('/').at(-1);if(!/^[\w-]{1,128}$/.test(id||''))throw new Error('Invalid backup ID.');const bytes=await transport.read('backups/'+id+'.qibak');if(!bytes)throw new Error('Backup not found.');return JSON.stringify({bytes:base64url(bytes)})}
  if(path==='/api/backups/create')return JSON.stringify(await this.backup(session,b.kind==='pre-update'?'pre-update':'manual'));
  if(path==='/api/restore/preview'){const bytes=unbase64(b.bytes),archive=await unpackCloudArchive(bytes,b.key),current=await store.read(session.subject),id=crypto.randomUUID();await transport.write('restore/'+id,bytes);await this.vaultPut('restore:'+id,JSON.stringify({key:b.key,revision:current?.revision||0,checksum:await cloudChecksum(bytes),expiresAt:Date.now()+600000}));return JSON.stringify({...previewCloudRestore(archive,current),id,revision:current?.revision||0})}
  if(path==='/api/restore/commit'){const raw=await this.vaultGet('restore:'+String(b.id));if(!raw)throw new Error('Restore preview expired.');const preview=JSON.parse(raw),current=await store.read(session.subject);if(preview.expiresAt<Date.now()||(current?.revision||0)!==preview.revision||b.revision!==preview.revision)throw Object.assign(new Error('Preview the latest records before restoring.'),{status:409});const bytes=await transport.read('restore/'+b.id);if(!bytes||await cloudChecksum(bytes)!==preview.checksum)throw new Error('Restore archive validation failed.');const archive=await unpackCloudArchive(bytes,preview.key);const target=current||await store.commit({accountId:session.subject,baseRevision:0,operationId:'restore-init:'+String(b.id),payload:{planner:initialState()}});await this.backup(session,'pre-restore');const restored=prepareCloudRestore(archive,target,{confirmed:true,preRestoreVerified:true});const result=await store.commit({accountId:session.subject,baseRevision:target.revision,operationId:String(b.operationId),payload:restored.payload,preservedOperations:restored.operations});await this.vaultDelete('restore:'+b.id);return JSON.stringify(wire(result))}
  if(path==='/api/service/check')return JSON.stringify(await this.background(session,store));
  throw Object.assign(new Error('Unknown service action.'),{status:404});
 })}
 async helper(token:string,path:string,rawBody:string){return this.serialized(async()=>{
  const authorized=await this.ctx.storage.get('helper:'+await cloudChecksum(new TextEncoder().encode(token)));if(!authorized)throw Object.assign(new Error('Backup helper authorization is invalid.'),{status:401});
  const raw=await this.vaultGet('authorization');if(!raw)throw new Error('Reconnect Microsoft before using the backup helper.');const session=JSON.parse(raw) as MicrosoftSession,transport=await this.transport(session);
  const index=await transport.read('backups/index.json'),rows=index?JSON.parse(new TextDecoder().decode(index)):[];
  if(path==='/api/helper/backups')return JSON.stringify({backups:rows});
  if(path==='/api/helper/pre-update')return JSON.stringify(await this.backup(session,'pre-update'));
  if(path.startsWith('/api/helper/download/')){const id=path.split('/').at(-1),row=rows.find((r:{id:string})=>r.id===id);if(!row)throw new Error('Backup not found.');const bytes=await transport.read(row.path);if(!bytes||await cloudChecksum(bytes)!==row.checksum)throw new Error('Backup checksum verification failed.');return JSON.stringify({bytes:base64url(bytes),checksum:row.checksum})}
  if(path==='/api/helper/ack'){const b=JSON.parse(rawBody),row=rows.find((r:{id:string;checksum:string;verified:number})=>r.id===b.id&&r.checksum===b.checksum&&r.verified===1);if(!row)throw new Error('Local checksum does not match a verified backup.');row.local_at=new Date().toISOString();const bytes=new TextEncoder().encode(JSON.stringify(rows));await transport.write('backups/index.json',bytes);const verified=await transport.read('backups/index.json');if(!verified||await cloudChecksum(verified)!==await cloudChecksum(bytes))throw new Error('Local backup receipt could not be verified.');return '{"verified":true}'}
  throw Object.assign(new Error('Backup helper action is not permitted.'),{status:403});
 })}
 private async background(session:MicrosoftSession,store:OneDriveSnapshotStore){
  const verified=await this.ctx.storage.get<number>('todoist-verified-at');const now=new Date(),snapshot=await store.read(session.subject);if(!snapshot)return {accepted:0};const payload=structuredClone(snapshot.payload),s=payload.planner;rebuildReminders(s,now);let accepted=0;
  if(!s.settings.integrationsPaused&&s.settings.push&&!isQuiet(s,now))for(const reminder of s.reminders.filter(r=>r.status==='pending'&&Date.parse(r.at)<=now.getTime()&&Date.parse(r.at)>now.getTime()-900000)){
   if(needsFreshTaskVerification(reminder.kind)&&(s.connections.todoist?.error||s.connections.icloud?.connected||s.connections.todoist?.connected&&(!verified||verified<now.getTime()-120000)))continue;
   const task=s.tasks.find(t=>t.id===reminder.taskId);if(task?.done||task?.deletedAt)continue;const count=await this.push({title:reminder.title,body:reminder.body,url:reminder.kind==='carryover'?'/?view=quests&review=carryover':'/?reminder='+encodeURIComponent(reminder.id),tag:reminder.id});if(count){reminder.status='sent';accepted+=count}
  }
  if(JSON.stringify(payload)!==JSON.stringify(snapshot.payload))await store.commit({accountId:session.subject,baseRevision:snapshot.revision,operationId:crypto.randomUUID(),payload});
  const last=await this.ctx.storage.get<number>('last-hourly-backup');if(await this.vaultGet('recovery')&&(!last||last<Date.now()-3600000)){await this.backup(session,'hourly');await this.ctx.storage.put('last-hourly-backup',Date.now())}return {accepted,checkedAt:now.toISOString()};
 }
 async recoverPending(rawSession:string,rawBody:string){return this.serialized(async()=>{
  const session=JSON.parse(rawSession) as MicrosoftSession,b=JSON.parse(rawBody),store=await this.store(session);await store.read(session.subject);
  const pending=await this.ctx.storage.get<PendingCommit>('pending-commit');if(!pending)return '{"resolved":true}';
  if(b.confirm!==true||b.operationId!==pending.id)throw Object.assign(new Error('Explicitly confirm the pending operation before recovery.'),{status:409});
  if(await this.ctx.storage.get('pending-head')||await this.ctx.storage.get('graph-head-cas'))throw Object.assign(new Error('A cloud publication is still uncertain. Verify its original version before recovery.'),{status:409});
  // Serialized, verified read found no receipt and neither publication journal exists:
  // the operation never reached HEAD. Local device queues are deliberately untouched.
  await this.ctx.storage.delete('pending-commit');await this.ctx.storage.put('last-pending-recovery',{id:pending.id,at:Date.now()});return '{"resolved":true,"localQueuesPreserved":true}';
 })}
 async read(raw:string){const session=JSON.parse(raw) as MicrosoftSession;return this.serialized(async()=>{const snapshot=await(await this.store(session)).read(session.subject),pending=await this.ctx.storage.get<PendingCommit>('pending-commit');return JSON.stringify({...wire(snapshot),...(pending?{pendingOperation:{id:pending.id,recoveryRequired:true}}:{})})})}
 async commit(rawSession:string,rawInput:string){const session=JSON.parse(rawSession) as MicrosoftSession,input=JSON.parse(rawInput) as {operationId:string;baseRevision:number;payload:CloudPayload};return this.serialized(async()=>{
  const fingerprint=await commitFingerprint(input);
  const pending=await this.ctx.storage.get<{id:string;fingerprint:string}>('pending-commit');
  if(pending&&(pending.id!==input.operationId||pending.fingerprint!==fingerprint))return Promise.reject(Object.assign(new Error('A previous commit needs retrying before another cloud write.'),{status:409,code:'CLOUD_PENDING_COMMIT'}));
  const store=await this.store(session);await this.ctx.storage.put('pending-commit',{id:input.operationId,fingerprint});
  try{const result=await store.commit({accountId:session.subject,...input});await this.ctx.storage.delete('pending-commit');return JSON.stringify(wire(result))}catch(error){if([400,409,422].includes((error as {status?:number}).status||0))await this.ctx.storage.delete('pending-commit');throw error}
 })}
}
