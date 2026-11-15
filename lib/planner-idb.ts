import {migrateState} from './model.ts';
import type {LocalPlanner} from './local-planner.ts';
let opening:Promise<IDBDatabase>|undefined;
function database(){return opening??=new Promise<IDBDatabase>((resolve,reject)=>{const req=indexedDB.open('questbound-planner',1);req.onupgradeneeded=()=>{req.result.createObjectStore('accounts',{keyPath:'accountId'});req.result.createObjectStore('drafts')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>{opening=undefined;reject(req.error)};req.onblocked=()=>{opening=undefined;reject(new Error('Close another Questbound tab to finish local storage setup.'))}})}
export async function readLocalPlanner(accountId:string):Promise<LocalPlanner|undefined>{
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction('accounts'),req=tx.objectStore('accounts').get(accountId);let value:LocalPlanner|undefined;
  req.onsuccess=()=>{
   value=req.result;
   if(value){
    value.envelope={...value.envelope,state:migrateState(value.envelope.state)};
    if(value.base.snapshot)value.base={...value.base,snapshot:{...value.base.snapshot,state:migrateState(value.base.snapshot.state)}};
    // Keep any uncertain-write attempt byte-for-byte intact for idempotent retries.
   }
  };
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);
 })
}
export async function writeLocalPlanner(record:LocalPlanner,expectedGeneration?:number){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('accounts','readwrite'),store=tx.objectStore('accounts');let conflict=false;const req=store.get(record.accountId);req.onsuccess=()=>{if(expectedGeneration!==undefined&&(req.result?.generation??0)!==expectedGeneration){conflict=true;tx.abort();return}store.put(record)};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Object.assign(new Error(conflict?'Another tab saved a change. Please try again.':'Local storage could not save this change.'),{status:conflict?409:507}));tx.onerror=()=>reject(tx.error)})}
export async function draftStore(action:'get'|'put'|'delete',key:string,value?:string):Promise<string|null>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',action==='get'?'readonly':'readwrite'),store=tx.objectStore('drafts'),req=action==='get'?store.get(key):action==='put'?store.put(value,key):store.delete(key);let result:string|null=null;req.onsuccess=()=>{if(action==='get')result=req.result||null};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error)})}
