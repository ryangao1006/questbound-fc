import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {saveCueAtIntent,saveCueAfterSave} from '../lib/task-feedback.ts';

const complete={type:'task.toggle',done:true},reopen={type:'task.toggle',done:false},edit={type:'task.edit'};

test('a completion never sounds from the optimistic preview',()=>{
 assert.equal(saveCueAtIntent(complete),null);
 assert.equal(saveCueAtIntent(reopen),'selection');
 assert.equal(saveCueAtIntent(edit),'selection');
});

test('a completion is only voiced after the planner accepted it',()=>{
 assert.equal(saveCueAfterSave(complete),'complete');
 assert.equal(saveCueAfterSave(complete,true),'level');
 assert.equal(saveCueAfterSave(reopen),null);
 assert.equal(saveCueAfterSave(edit),null);
});

test('the private site offers one authoritative store, not a retired Microsoft entry',()=>{
 const sync=readFileSync(new URL('../components/account-sync.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../components/quest-app.tsx',import.meta.url),'utf8');
 assert(!sync.includes('workers.dev'),'the retired workers.dev link must not be rendered');
 assert(!sync.includes('Microsoft and OneDrive entry'),'the retired entry card must be removed');
 assert(!app.includes('connections/onedrive/start'),'the Microsoft app-registration form must be removed');
 assert(!app.includes('Set up Microsoft sign-in'),'the Microsoft sign-in setup block must be removed');
 assert(sync.includes('if(!isLocalPlanner())return null;'),'the private site must not render the cloud account card');
});

test('a failed change stays retryable',()=>{
 const app=readFileSync(new URL('../components/quest-app.tsx',import.meta.url),'utf8');
 assert(app.includes('setRetryCommand(command)'),'a failed command must be kept for retry');
 assert(app.includes('setRetryCommand(null)'),'a successful save must clear the retry offer');
 assert(app.includes('retryable={!!retryCommand}'),'the sync pill must expose the retry state');
 const pill=readFileSync(new URL('../components/sync-indicator.tsx',import.meta.url),'utf8');
 assert(pill.includes("status.tone==='error'&&onRetry"),'retry must only appear for a failure');
});
