"use client";
import type {Command,Envelope} from './model.ts';
import type {QueuedCommand,SiteSnapshot} from './site-queue.ts';

/**
 * Device-only offline copy for the private site. Nothing here is shared between
 * devices and no private page or API response is placed in an HTTP cache.
 */
const DB='questbound-site',VERSION=1,SNAPSHOT='snapshot',QUEUE='queue',SNAPSHOT_KEY='latest';

function open():Promise<IDBDatabase|null>{
 if(typeof indexedDB==='undefined')return Promise.resolve(null);
 return new Promise(resolve=>{
  let request:IDBOpenDBRequest;
  try{request=indexedDB.open(DB,VERSION)}catch{resolve(null);return}
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(SNAPSHOT))db.createObjectStore(SNAPSHOT);if(!db.objectStoreNames.contains(QUEUE))db.createObjectStore(QUEUE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>resolve(null);
  request.onblocked=()=>resolve(null);
 });
}

async function run<T>(mode:IDBTransactionMode,work:(db:IDBDatabase)=>T|Promise<T>):Promise<T|null>{
 const db=await open();if(!db)return null;
 try{return await work(db)}catch{return null}finally{db.close()}
}

export async function readSnapshot():Promise<SiteSnapshot|null>{
 const db=await open();if(!db)return null;
 return new Promise(resolve=>{
  try{
   const request=db.transaction(SNAPSHOT,'readonly').objectStore(SNAPSHOT).get(SNAPSHOT_KEY);
   request.onsuccess=()=>{const value=request.result as SiteSnapshot|undefined;resolve(value&&value.state?value:null)};
   request.onerror=()=>resolve(null);
  }catch{resolve(null)}finally{db.close()}
 });
}

export async function writeSnapshot(envelope:Envelope,now=new Date()):Promise<boolean>{
 return (await run('readwrite',db=>new Promise<boolean>(resolve=>{
  const store=db.transaction(SNAPSHOT,'readwrite').objectStore(SNAPSHOT);
  const read=store.get(SNAPSHOT_KEY);
  read.onsuccess=()=>{
   const previous=read.result as SiteSnapshot|undefined;
   if(previous&&previous.revision>envelope.revision){resolve(false);return}
   const next:SiteSnapshot={revision:envelope.revision,updatedAt:envelope.updatedAt,state:envelope.state,cachedAt:now.toISOString()};
   const write=store.put(next,SNAPSHOT_KEY);
   write.onsuccess=()=>resolve(true);write.onerror=()=>resolve(false);
  };
  read.onerror=()=>resolve(false);
 }))) ?? false;
}

export async function readQueue():Promise<QueuedCommand[]>{
 const list=await run('readonly',db=>new Promise<QueuedCommand[]>(resolve=>{
  const store=db.transaction(QUEUE,'readonly').objectStore(QUEUE);
  const request=store.getAll();
  request.onsuccess=()=>resolve((request.result as QueuedCommand[]).sort((a,b)=>a.at.localeCompare(b.at)));
  request.onerror=()=>resolve([]);
 }));
 return list??[];
}

export async function queueCommand(command:Command,id:string,now=new Date()):Promise<QueuedCommand[]>{
 const list=await run('readwrite',db=>new Promise<QueuedCommand[]>(resolve=>{
  const tx=db.transaction(QUEUE,'readwrite'),store=tx.objectStore(QUEUE);
  const request=store.getAll();
  request.onsuccess=()=>{
   const existing=(request.result as QueuedCommand[]).sort((a,b)=>a.at.localeCompare(b.at));
   if(existing.some(item=>item.id===id)){resolve(existing);return}
   const entry:QueuedCommand={id,command,at:now.toISOString()};
   store.put(entry);
   tx.oncomplete=()=>resolve([...existing,entry]);
   tx.onerror=()=>resolve(existing);
  };
  request.onerror=()=>resolve([]);
 }));
 return list??[];
}

export async function clearQueued(ids:string[]):Promise<void>{
 if(!ids.length)return;
 await run('readwrite',db=>new Promise<void>(resolve=>{
  const tx=db.transaction(QUEUE,'readwrite'),store=tx.objectStore(QUEUE);
  for(const id of ids)store.delete(id);
  tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();
 }));
}

export async function clearSiteCache():Promise<void>{
 await run('readwrite',db=>new Promise<void>(resolve=>{
  const tx=db.transaction([SNAPSHOT,QUEUE],'readwrite');
  tx.objectStore(SNAPSHOT).clear();tx.objectStore(QUEUE).clear();
  tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();
 }));
}
