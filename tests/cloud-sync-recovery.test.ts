import test from 'node:test';import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {OneDriveSnapshotStore} from '../lib/onedrive-storage.ts';
import {commitFingerprint,acknowledgedPending,verifySeenCloud} from '../cloud/sync-recovery.ts';
test('lost acknowledgement can clear pending commit from verified receipt on a different device',async()=>{
 const files=new Map<string,Uint8Array>(),store=new OneDriveSnapshotStore({read:async p=>files.get(p)||null,write:async(p,b)=>{files.set(p,b)}}),input={baseRevision:0,payload:{planner:initialState()}};
 const pending={id:'saved-operation',fingerprint:await commitFingerprint(input)};
 const snapshot=await store.commit({accountId:'owner',operationId:pending.id,...input});assert.equal(acknowledgedPending(pending,snapshot),true);await assert.rejects(verifySeenCloud({revision:2,hash:'newer'},snapshot),{code:'CLOUD_HEAD_MISSING_OR_REGRESSED'});
 assert.equal(acknowledgedPending({...pending,fingerprint:'different-payload'},snapshot),false);assert.equal(acknowledgedPending(pending,null),false);
});
test('previously verified cloud cannot disappear or silently become an older empty account',async()=>{
 assert.equal(await verifySeenCloud(null,null),null);
 await assert.rejects(verifySeenCloud({revision:2,hash:'verified'},null),{code:'CLOUD_HEAD_MISSING_OR_REGRESSED'});
});
