import type {ObjectTransport} from '../lib/onedrive-storage.ts';
import {cloudChecksum} from '../lib/onedrive-storage.ts';
import {base64url,unbase64} from '../lib/crypto.ts';
export type PendingPublication={path:string;pointer:string;previousHash:string|null;nextHash:string};
export interface PublicationJournal {get():Promise<PendingPublication|null>;put(v:PendingPublication):Promise<void>;clear():Promise<void>}
/** Per-account caller must serialize. Journal contains a small HEAD pointer only, never records. */
export function fencedTransport(base:ObjectTransport,journal:PublicationJournal,safeConditionalReplay=false):ObjectTransport {
 async function recover(){const p=await journal.get();if(!p)return;const current=await base.read(p.path),hash=current?await cloudChecksum(current):null;
  if(hash===p.nextHash){await journal.clear();return}
  if(hash!==p.previousHash)throw Object.assign(new Error('Cloud publication conflicts with an external change. Previous data is preserved.'),{status:409,code:'CLOUD_PUBLICATION_CONFLICT'});
  const bytes=unbase64(p.pointer);if(bytes.length>4096||await cloudChecksum(bytes)!==p.nextHash)throw new Error('Invalid publication journal.');
  if(safeConditionalReplay){await base.write(p.path,bytes);const verified=await base.read(p.path);if(!verified||await cloudChecksum(verified)!==p.nextHash)throw new Error('Cloud publication verification is pending.');await journal.clear();return}
  // Do not repeat a timed-out PUT: the original may still complete later.
  throw Object.assign(new Error('The previous cloud publication is still uncertain. Local records remain saved; retry verification shortly.'),{status:503,code:'CLOUD_PUBLICATION_PENDING'});
 }
 return {read:async path=>{await recover();return base.read(path)},write:async(path,bytes)=>{await recover();if(!path.endsWith('/HEAD.json'))return base.write(path,bytes);if(bytes.length>4096)throw new Error('Cloud publication pointer is too large.');const old=await base.read(path),p={path,pointer:base64url(bytes),previousHash:old?await cloudChecksum(old):null,nextHash:await cloudChecksum(bytes)};await journal.put(p);await base.write(path,bytes);const verified=await base.read(path);if(!verified||await cloudChecksum(verified)!==p.nextHash)throw new Error('Cloud publication verification pending.');await journal.clear()}};
}
