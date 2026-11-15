import {advanceMatch,type MatchState,type MatchInput} from './football-match.ts';
import type {ActiveFixture} from './football-model.ts';
export type CachedMatch={version:1;id:string;deviceId:string;state:MatchState;serverFrame:number;ackOperationId?:string;sequence:number;inputs:{serial:number;input:MatchInput}[];nextSerial:number;at:string;pending?:{operationId:string;command:Record<string,unknown>;lastSerial:number}};
let opening:Promise<IDBDatabase>|null=null;
function database(){if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('questbound-football',1);request.onupgradeneeded=()=>request.result.createObjectStore('checkpoints',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});return opening}
export async function saveMatchCache(record:CachedMatch){try{const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('checkpoints','readwrite');tx.objectStore('checkpoints').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});return true}catch{try{localStorage.setItem('qfc-match:'+record.id,JSON.stringify(record));return true}catch{return false}}}
export async function readMatchCache(id:string):Promise<CachedMatch|null>{try{const db=await database();return await new Promise((resolve,reject)=>{const req=db.transaction('checkpoints').objectStore('checkpoints').get(id);req.onsuccess=()=>resolve(req.result?.version===1?req.result:null);req.onerror=()=>reject(req.error)})}catch{try{const value=JSON.parse(localStorage.getItem('qfc-match:'+id)||'null');return value?.version===1?value:null}catch{return null}}}
export async function removeMatchCache(id:string){try{const db=await database();const tx=db.transaction('checkpoints','readwrite');tx.objectStore('checkpoints').delete(id)}catch{}try{localStorage.removeItem('qfc-match:'+id)}catch{}}
export function gameDeviceId(){try{const old=localStorage.getItem('qfc-game-device');if(old)return old;const id=crypto.randomUUID();localStorage.setItem('qfc-game-device',id);return id}catch{return crypto.randomUUID()}}

/** Only replay a local tail onto the exact cloud head that produced it. */
export function reconcileMatchCache(initial:MatchState,active:ActiveFixture,old:CachedMatch|null,deviceId:string){
 const fallback={state:initial,inputs:[] as CachedMatch['inputs'],nextSerial:0,conflict:false};
 if(!old)return fallback;
 if(old.deviceId!==deviceId||old.state.version!==initial.version)return {...fallback,conflict:old.state.frame>initial.frame};
 const exact=old.sequence===active.sequence&&old.serverFrame===initial.frame&&old.ackOperationId===active.checkpointOperationId;
 const acknowledged=!!old.pending&&old.pending.operationId===active.checkpointOperationId&&Number(old.pending.command.targetFrame)===initial.frame;
 if(!exact&&!acknowledged)return {...fallback,conflict:old.inputs.length>0||old.state.frame>initial.frame};
 const inputs=old.inputs.filter(entry=>entry.input.frame>=initial.frame&&(!acknowledged||entry.serial>old.pending!.lastSerial));
 try{return {state:advanceMatch(initial,inputs.map(r=>r.input),Math.max(initial.frame,old.state.frame)),inputs,nextSerial:old.nextSerial,conflict:false}}catch{return {...fallback,conflict:true}}
}

/** A long disconnection must split both simulation time and input count without dropping same-frame actions. */
export function checkpointChunk(log:CachedMatch['inputs'],baseFrame:number,goal:number,maxInputs=5000){
 const limit=Math.min(goal,baseFrame+20000),eligible=log.filter(entry=>entry.input.frame<=limit),records=eligible.slice(0,maxInputs);
 const target=eligible.length>maxInputs?Math.max(baseFrame,records.at(-1)!.input.frame):limit;
 return {target,records};
}
