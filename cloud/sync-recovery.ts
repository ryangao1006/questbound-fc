import {cloudChecksum,type CloudSnapshot,type CloudPayload} from '../lib/onedrive-storage.ts';
export type PendingCommit={id:string;fingerprint:string};
export type SeenCloud={revision:number;hash:string};
export async function commitFingerprint(input:{baseRevision:number;payload:CloudPayload}){return cloudChecksum(new TextEncoder().encode(JSON.stringify({baseRevision:input.baseRevision,payload:input.payload})));}
export function acknowledgedPending(pending:PendingCommit|null|undefined,snapshot:CloudSnapshot|null){return !!pending&&snapshot?.operations[pending.id]?.fingerprint===pending.fingerprint;}
export async function verifySeenCloud(seen:SeenCloud|null|undefined,snapshot:CloudSnapshot|null):Promise<SeenCloud|null>{
 if(seen&&(!snapshot||snapshot.revision<seen.revision))throw Object.assign(new Error('Previously verified OneDrive records are missing or older. Restore a verified recovery copy; local records are preserved.'),{status:422,code:'CLOUD_HEAD_MISSING_OR_REGRESSED'});
 return snapshot?{revision:snapshot.revision,hash:await cloudChecksum(new TextEncoder().encode(JSON.stringify(snapshot)))}:null;
}
