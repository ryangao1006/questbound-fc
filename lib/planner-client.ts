import type {Command,Envelope} from './model';
import {emptyLocalPlanner,localCommand,incorporateCloud,prepareCloudCommit,acknowledgeCloud,rejectCloudAttempt,type CloudEnvelope,type LocalPlanner} from './local-planner';
import {readLocalPlanner,writeLocalPlanner,draftStore} from './planner-idb';
import {cloudErrorMessage} from './cloud-errors';

export type AccountSession={account:{id:string;label:string}|null;configured:boolean;setupRequired?:boolean;background?:{checkedAt?:string;lastError?:string}|null};
export type ClientStatus={scope:string;session:AccountSession;pending:number;status:string;error?:string;record?:LocalPlanner};
let enabled=false,scope='local',deviceId='',session:AccountSession={account:null,configured:false},ready:Promise<void>|undefined,flushing:Promise<void>|undefined;
const listeners=new Set<()=>void>();let status:ClientStatus={scope,session,pending:0,status:'Local saved'};
const emit=(record?:LocalPlanner,error?:string)=>{status={scope,session,pending:record?.pending.length||0,status:record?.conflicts.length?'Conflict':scope==='local'?'Local saved':record?.base.pendingOperation?'Sync needs attention':error||record?.pending.length?'Pending sync':'Cloud synced',error,record};listeners.forEach(f=>f())};
export function enableLocalPlanner(){enabled=true;try{scope=localStorage.getItem('qfc-account-scope')||'local';deviceId=localStorage.getItem('qfc-planner-device')||crypto.randomUUID();localStorage.setItem('qfc-planner-device',deviceId)}catch{deviceId=crypto.randomUUID()}}
export function isLocalPlanner(){return enabled}
export function plannerScope(){return enabled?scope:'site'}
export function clientStatus(){return status}
export function onClientStatus(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
async function network<T>(path:string,body?:unknown):Promise<T>{const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(enabled&&scope!=='local'&&!path.startsWith('account/')?{'X-QFC-Account':scope}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(30000)});const data=await response.json() as Record<string,unknown>;if(!response.ok)throw Object.assign(new Error(cloudErrorMessage(data.code,String(data.error||'This action could not be completed.'),status.record?.envelope.state.settings.language)),{status:response.status,code:data.code});if(enabled&&path.startsWith('cloud/')&&data.accountId&&data.accountId!==scope)throw Object.assign(new Error('The signed-in account changed in another tab. Reload to switch accounts; this device’s changes are kept separately.'),{status:403,code:'ACCOUNT_CHANGED'});return data as T}
async function ensure(){if(!ready)ready=(async()=>{try{session=await network<AccountSession>('account/session');scope=session.account?.id||'local';localStorage.setItem('qfc-account-scope',scope)}catch{/* Preserve the last known account during a network outage. */}let record=await readLocalPlanner(scope);if(!record){record=emptyLocalPlanner(scope);await writeLocalPlanner(record)}emit(record)})().catch(error=>{ready=undefined;throw error});return ready}
async function lock<T>(work:()=>Promise<T>):Promise<T>{if(navigator.locks)return navigator.locks.request('qfc-planner:'+scope,work);return work()}
export async function syncLocalPlanner(){await ensure();if(flushing)return flushing;flushing=lock(async()=>{let record=(await readLocalPlanner(scope))!;if(scope==='local'){emit(record);return}try{
 const currentSession=await network<AccountSession>('account/session');if(currentSession.account?.id!==scope)throw Object.assign(new Error('The signed-in account changed. Reload to continue. Saved changes remain in their original account.'),{status:403,code:'ACCOUNT_CHANGED'});session=currentSession;
 // A timed-out upload is retried with the identical batch ID and snapshot first.
 if(record.attempt){try{const cloud=await network<CloudEnvelope>('cloud/commit',{...prepareCloudCommit(record,deviceId).request,accountId:scope});const next=acknowledgeCloud(record,cloud);await writeLocalPlanner(next,record.generation);record=next;}catch(error){if((error as {status?:number}).status!==409||(error as {code?:string}).code==='CLOUD_PENDING_COMMIT')throw error;const next=rejectCloudAttempt(record);await writeLocalPlanner(next,record.generation);record=next}}
 const cloud=await network<CloudEnvelope>('cloud/read');let next=incorporateCloud(record,cloud);await writeLocalPlanner(next,record.generation);record=next;
 if(record.pending.length&&!record.conflicts.length){const prepared=prepareCloudCommit(record,deviceId);await writeLocalPlanner(prepared.record,record.generation);record=prepared.record;const saved=await network<CloudEnvelope>('cloud/commit',{...prepared.request,accountId:scope});next=acknowledgeCloud(record,saved);await writeLocalPlanner(next,record.generation);record=next;}emit(record);
 }catch(error){if(record.attempt&&(error as {status?:number}).status===409&&(error as {code?:string}).code!=='CLOUD_PENDING_COMMIT'){const next=rejectCloudAttempt(record);await writeLocalPlanner(next,record.generation);record=next}emit(record,(error as Error).message)}}).finally(()=>{flushing=undefined});return flushing}
export async function plannerApi<T=Record<string,unknown>>(path:string,body?:unknown):Promise<T>{
 if(!enabled)return network<T>(path,body);
 await ensure();
 if(path==='state'){const local=await readLocalPlanner(scope);if(!local)throw new Error('Local storage is unavailable.');void syncLocalPlanner();return local.envelope as T}
 if(path==='command'){return lock(async()=>{const record=(await readLocalPlanner(scope))!,request=body as {command:Command;operationId:string};const next=localCommand(record,request.command,request.operationId);await writeLocalPlanner(next,record.generation);emit(next);void syncLocalPlanner();return next.envelope as T})}
 if(path==='sync'){await syncLocalPlanner();if(scope!=='local'){await network('sync',{});await syncLocalPlanner()}return (await readLocalPlanner(scope))!.envelope as T}
 if(path==='backups'&&scope==='local')throw new Error('Local account backups are available through Export this device. Cloud backups require Microsoft sign-in.');
 if(path.startsWith('career/'))throw new Error('Existing career data is preserved. Career play remains on your private site during this sync release.');
 if(scope==='local')throw new Error('Sign in with Microsoft to use cloud connections. Your tasks are saved on this device.');
 await syncLocalPlanner();const current=await readLocalPlanner(scope);if(current?.pending.length||current?.conflicts.length||current?.attempt)throw new Error('Sync this account’s pending changes and resolve conflicts before importing. Your local copy is kept.');
 const result=await network<T>(path,body);await syncLocalPlanner();return result;
}
export async function resolveLocalConflicts(choices:Record<string,'local'|'remote'>){await ensure();await lock(async()=>{const record=(await readLocalPlanner(scope))!,cloud=await network<CloudEnvelope>('cloud/read'),next=incorporateCloud(record,cloud,choices);await writeLocalPlanner(next,record.generation);emit(next)});await syncLocalPlanner()}
export async function importLocalPreview(){await ensure();const local=await readLocalPlanner('local'),target=(await readLocalPlanner(scope))!;return {local,target,count:local?.envelope.state.tasks.filter(t=>!t.deletedAt).length||0};}
export async function importLocalConfirmed(){await ensure();if(scope==='local')throw new Error('Sign in first.');await syncLocalPlanner();await lock(async()=>{const source=await readLocalPlanner('local'),target=(await readLocalPlanner(scope))!;if(!source)return;if(target.pending.length||target.attempt||target.conflicts.length)throw new Error('Sync this account’s pending changes and resolve conflicts before importing. Your local copy is kept.');const cloud=await network<CloudEnvelope>('cloud/read');const imported=incorporateCloud({...target,base:{snapshot:null,revision:0,updatedAt:''},envelope:source.envelope,pending:[{id:crypto.randomUUID(),command:{type:'local.import'} as Command,at:new Date().toISOString()}]},cloud);await writeLocalPlanner({...imported,accountId:scope,generation:target.generation+1},target.generation);emit(imported)});await syncLocalPlanner()}
export async function exportLocalPlanner(){await ensure();return JSON.stringify(await readLocalPlanner(scope),null,2)}
export async function recoverUnpublishedUpload(){await ensure();const record=await readLocalPlanner(scope),id=record?.base.pendingOperation?.id;if(!id)throw new Error('No unpublished cloud operation needs recovery.');await network('cloud/recover',{operationId:id,confirm:true,accountId:scope});await syncLocalPlanner()}
export async function signOutPlanner(){await network('account/logout',{});scope='local';session={...session,account:null};try{localStorage.setItem('qfc-account-scope','local')}catch{}location.reload()}

const drafts=new Map<string,string>();
export function draftKey(key:string){return `qfc-draft:${plannerScope()}:${key}`}
export function readDraft(key:string){const full=draftKey(key);if(drafts.has(full))return drafts.get(full)!;try{return localStorage.getItem(full)||(!enabled?localStorage.getItem(key):null)}catch{return null}}
export async function hydrateDraft(key:string){const full=draftKey(key),saved=await draftStore('get',full);if(saved&&!drafts.has(full))drafts.set(full,saved);return readDraft(key)}
export function saveDraft(key:string,value:string){const full=draftKey(key);drafts.set(full,value);try{localStorage.setItem(full,value)}catch{}return draftStore('put',full,value)}
export function removeDraft(key:string){const full=draftKey(key);drafts.delete(full);try{localStorage.removeItem(full);if(!enabled)localStorage.removeItem(key)}catch{}return draftStore('delete',full)}
