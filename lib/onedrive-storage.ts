import {APP_VERSION,SCHEMA_VERSION,migrateState,type PlannerState} from './model.ts';
import {assertState} from './domain.ts';

export type JSONValue = null | boolean | number | string | JSONValue[] | {[key:string]:JSONValue};
/** Tokens and provider passwords belong in the backend vault, never this payload. */
export type CloudPayload = {planner:PlannerState;career?:JSONValue;integrations?:{todoist?:{cache:import('./todoist-sync.ts').TodoistCache;syncToken:string}}};
export interface ObjectTransport {
 read(path:string):Promise<Uint8Array|null>;
 write(path:string,bytes:Uint8Array):Promise<void>;
}
export type CloudSnapshot = {format:1;accountHash:string;revision:number;schemaVersion:number;appVersion:string;updatedAt:string;payload:CloudPayload;operations:Record<string,{fingerprint:string;revision:number}>};
type Head={format:1;accountHash:string;revision:number;path:string;checksum:string};
export class CloudStorageError extends Error {
 code:string;status:number;
 constructor(code:string,status=409){super(code);this.code=code;this.status=status;}
}
const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));
const decode=(bytes:Uint8Array)=>JSON.parse(new TextDecoder().decode(bytes));
export async function cloudChecksum(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),x=>x.toString(16).padStart(2,'0')).join('');}
const secretKeys=new Set(['access_token','refresh_token','client_secret','clientSecret','accessToken','refreshToken','password','recoveryKey','siteAccessToken','token']);
function rejectSecrets(value:unknown){if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(secretKeys.has(key)&&child!==undefined&&child!==null&&child!=='')throw new CloudStorageError('CLOUD_PAYLOAD_CONTAINS_CREDENTIALS',400);rejectSecrets(child);}}
function validatePayload(value:CloudPayload){rejectSecrets(value);if(!value||!value.planner||value.planner.schemaVersion>SCHEMA_VERSION)throw new CloudStorageError('CLOUD_SCHEMA_UNSUPPORTED',422);assertState(migrateState(value.planner));}
function id(value:string){if(!value||value.length>256)throw new CloudStorageError('CLOUD_ID_INVALID',400);return value;}
/**
 * All calls to commit for one account MUST run inside the same durable backend
 * coordinator. A process-local mutex is insufficient. Browser clients never
 * receive this transport or write HEAD directly. A failed commit can leave
 * unreachable immutable objects; it never deletes the previous good snapshot.
 */
export class OneDriveSnapshotStore {
 private transport:ObjectTransport;
 constructor(transport:ObjectTransport){this.transport=transport;}
 private async account(accountId:string){return cloudChecksum(new TextEncoder().encode(id(accountId)));}
 async read(accountId:string):Promise<CloudSnapshot|null>{
  const accountHash=await this.account(accountId),prefix=`sync/${accountHash}/`,raw=await this.transport.read(prefix+'HEAD.json');if(!raw)return null;
  let head:Head;try{head=decode(raw)}catch{throw new CloudStorageError('CLOUD_HEAD_INVALID',422)}
  if(head.format!==1||head.accountHash!==accountHash||!Number.isSafeInteger(head.revision)||head.revision<1||!/^objects\/[a-f0-9]{64}\.json$/.test(head.path)||! /^[a-f0-9]{64}$/.test(head.checksum))throw new CloudStorageError('CLOUD_HEAD_INVALID',422);
  const bytes=await this.transport.read(prefix+head.path);if(!bytes||await cloudChecksum(bytes)!==head.checksum)throw new CloudStorageError('CLOUD_CHECKSUM_MISMATCH',422);
  let snapshot:CloudSnapshot;try{snapshot=decode(bytes)}catch{throw new CloudStorageError('CLOUD_SNAPSHOT_INVALID',422)}
  if(snapshot.format!==1||snapshot.accountHash!==accountHash||snapshot.revision!==head.revision||snapshot.schemaVersion>SCHEMA_VERSION||!snapshot.operations||typeof snapshot.operations!=='object'||Array.isArray(snapshot.operations))throw new CloudStorageError('CLOUD_SNAPSHOT_INVALID',422);
  validatePayload(snapshot.payload);snapshot.payload.planner=migrateState(snapshot.payload.planner);return snapshot;
 }
 async commit(input:{accountId:string;baseRevision:number;operationId:string;payload:CloudPayload;preservedOperations?:CloudSnapshot['operations']}):Promise<CloudSnapshot>{
  id(input.operationId);validatePayload(input.payload);
  if(!Number.isSafeInteger(input.baseRevision)||input.baseRevision<0)throw new CloudStorageError('CLOUD_REVISION_INVALID',400);
  // Bind receipts to the exact submitted bytes, including the base revision.
  const fingerprint=await cloudChecksum(encode({baseRevision:input.baseRevision,payload:input.payload}));
  const current=await this.read(input.accountId),receipt=current?.operations[input.operationId];
  if(receipt){if(receipt.fingerprint!==fingerprint)throw new CloudStorageError('CLOUD_OPERATION_REUSED',409);return current!;}
  if((current?.revision||0)!==input.baseRevision)throw new CloudStorageError('CLOUD_CONFLICT',409);
  const accountHash=await this.account(input.accountId),revision=input.baseRevision+1,prefix=`sync/${accountHash}/`;
  const operations={...(input.preservedOperations||{}),...(current?.operations||{}),[input.operationId]:{fingerprint,revision}};
  const snapshot:CloudSnapshot={format:1,accountHash,revision,schemaVersion:SCHEMA_VERSION,appVersion:APP_VERSION,updatedAt:new Date().toISOString(),payload:structuredClone(input.payload),operations};
  const bytes=encode(snapshot),checksum=await cloudChecksum(bytes),path=`objects/${checksum}.json`;
  await this.transport.write(prefix+path,bytes);
  const verified=await this.transport.read(prefix+path);if(!verified||await cloudChecksum(verified)!==checksum)throw new CloudStorageError('CLOUD_WRITE_VERIFICATION_FAILED',503);
  const head:Head={format:1,accountHash,revision,path,checksum};
  await this.transport.write(prefix+'HEAD.json',encode(head));
  const published=await this.read(input.accountId);if(!published||published.revision!==revision||published.operations[input.operationId]?.fingerprint!==fingerprint)throw new CloudStorageError('CLOUD_PUBLICATION_UNVERIFIED',503);
  return published;
 }
}
