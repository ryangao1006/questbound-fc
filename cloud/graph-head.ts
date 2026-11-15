import {cloudChecksum} from '../lib/onedrive-storage.ts';
export type HeadItem={id:string;eTag:string;description?:string};
export type HeadCAS={id:string;eTag:string;checksum:string};
export interface HeadMetadata {item():Promise<HeadItem|null>;create():Promise<HeadItem>;patch(id:string,eTag:string,description:string):Promise<number>}
export interface HeadJournal {get():Promise<HeadCAS|null>;put(v:HeadCAS):Promise<void>;clear():Promise<void>}
/** Graph driveItem metadata PATCH documents If-Match; content PUT is never used for publication. */
export function conditionalHead(metadata:HeadMetadata,journal:HeadJournal){
 return {read:async()=>{const item=await metadata.item(),bytes=item?.description?new TextEncoder().encode(item.description):null,pending=await journal.get();if(bytes&&pending&&await cloudChecksum(bytes)===pending.checksum)await journal.clear();return bytes},write:async(bytes:Uint8Array)=>{
  const checksum=await cloudChecksum(bytes),description=new TextDecoder().decode(bytes);let pending=await journal.get();
  if(pending&&pending.checksum!==checksum)throw Object.assign(new Error('Resolve the pending cloud head first.'),{status:409});
  let item=await metadata.item();if(!item)item=await metadata.create();
  if(item.description===description){await journal.clear();return}
  if(!pending){pending={id:item.id,eTag:item.eTag,checksum};await journal.put(pending)}
  if(!pending.eTag||!pending.id)throw new Error('OneDrive did not return a usable version tag.');
  const status=await metadata.patch(pending.id,pending.eTag,description);
  // A delayed identical attempt cannot overwrite a later commit: its original ETag is pinned.
  const verified=await metadata.item();if(verified?.description===description){await journal.clear();return}
  if(status===412)throw Object.assign(new Error('OneDrive head changed concurrently.'),{status:409,code:'CLOUD_PUBLICATION_CONFLICT'});
  throw new Error('OneDrive metadata publication is not verified.');
 }};
}
