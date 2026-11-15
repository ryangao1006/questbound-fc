import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type Task} from '../lib/model.ts';
import {newTaskDraft,readTaskDraft,mergeTaskDraft,taskDraftPatch,resolveTaskDraft} from '../lib/task-draft.ts';
import {focusPresentation,syncFeedback} from '../lib/planner-feedback.ts';
import {reduceCommand as applyCommand} from '../lib/domain.ts';

test('restored drafts merge unrelated changes and retain the original baseline for overlapping edits',()=>{
 const task={id:'quest',title:'Original',notes:'Old note',listId:'school',area:'Physics',estimate:25} as Task;
 const draft=newTaskDraft(task,'unused',1);draft.value.notes='My new note';
 const restored=readTaskDraft(JSON.stringify(draft),{...task,title:'Renamed elsewhere'},'unused',2);
 const merged=mergeTaskDraft(restored,{...task,title:'Renamed elsewhere'});
 assert.equal(merged.record.value.title,'Renamed elsewhere');assert.deepEqual(merged.conflicts,[]);
 assert.deepEqual(taskDraftPatch(merged.record.base,merged.record.value).patch,{notes:'My new note'});
 const overlap=mergeTaskDraft(restored,{...task,notes:'Their new note'});assert.deepEqual(overlap.conflicts,['notes']);assert.equal(overlap.record.base.notes,'Old note');
 const keep=resolveTaskDraft(restored,{...task,notes:'Their new note'},true);assert.equal(keep.base.notes,'Their new note');assert.equal(keep.value.notes,'My new note');
 const useSaved=resolveTaskDraft(restored,{...task,notes:'Their new note'},false);assert.equal(useSaved.value.notes,'Their new note');
});
test('legacy and corrupt drafts never silently replace a current quest or its completion and provider IDs',()=>{
 const task={id:'quest',title:'Latest',notes:'Note',done:true,remoteId:'live'} as Task;
 const legacy=readTaskDraft(JSON.stringify({...task,title:'Old draft',done:false,remoteId:'stale'}),task,'new');
 assert.deepEqual(mergeTaskDraft(legacy,task).conflicts,['title']);
 assert.equal('done' in legacy.value,false);assert.equal('remoteId' in legacy.value,false);
 assert.equal(readTaskDraft('{bad',task,'new').value.title,'Latest');
 assert.equal(readTaskDraft(JSON.stringify({...legacy,taskId:'someone-else'}),task,'new').value.title,'Latest');
});
test('new draft IDs survive reopen and part/subject choices stay together in the saved patch',()=>{
 const task={title:'New',listId:'school',subjectId:'physics',area:'Physics'};
 const draft=newTaskDraft(task,'stable-new-id');draft.value={...draft.value,listId:'life',subjectId:'',area:'No subject'};
 assert.equal(readTaskDraft(JSON.stringify(draft),task,'another-id').draftId,'stable-new-id');
 assert.deepEqual(taskDraftPatch(draft.base,draft.value).patch,{listId:'life',subjectId:'',area:'No subject'});
 const existing={...draft,taskId:'existing',draftId:'existing'};const changed=mergeTaskDraft(existing,{...task,id:'existing',subjectId:'maths',area:'Maths'});assert(changed.conflicts.includes('subjectId'));
});
test('a safe restored draft saves its note without reverting a remote title, rewards or task completion',()=>{
 let state=initialState();state=applyCommand(state,{type:'task.add',task:{id:'quest',title:'Original',notes:'Old',listId:'school',area:'Physics'}});
 const original=state.tasks[0],draft=newTaskDraft(original,'unused');draft.value.notes='My note';
 state=applyCommand(state,{type:'task.edit',id:'quest',patch:{title:'Remote title'}});state=applyCommand(state,{type:'task.toggle',id:'quest',done:true});
 const latest=state.tasks[0],merged=mergeTaskDraft(draft,latest),change=taskDraftPatch(merged.record.base,merged.record.value);
 const result=applyCommand(state,{type:'task.edit',id:'quest',...change});assert.equal(result.tasks[0].title,'Remote title');assert.equal(result.tasks[0].notes,'My note');assert.equal(result.tasks[0].done,true);assert.deepEqual(result.rewards,state.rewards);
});
test('focus presentation excludes pauses, caps overdue time and follows the existing 20 minute XP rule',()=>{
 const a={id:'session',area:'Projects',startedAt:'2026-11-12T00:00:00Z',target:1500,pausedSeconds:300,pausedAt:'2026-11-12T00:20:00Z'};
 assert.equal(focusPresentation(a,new Date('2026-11-12T01:00:00Z')).clock,'10:00');assert.equal(focusPresentation(a,new Date()).status,'Paused');assert.equal(focusPresentation(a,new Date()).xpEligible,false);
 const finished=focusPresentation({...a,pausedAt:undefined},new Date('2026-11-12T01:00:00Z'));assert.equal(finished.clock,'00:00');assert.equal(finished.progress,100);assert.equal(finished.status,'Ready to save');assert.equal(finished.xpEligible,true);
 assert.equal(focusPresentation({...a,target:900,pausedAt:undefined},new Date('2026-11-12T01:00:00Z')).xpEligible,false);
});
test('sync feedback distinguishes an unsaved change from saved data waiting for connected apps',()=>{
 const state=initialState();assert.equal(syncFeedback(state,'Saved').label,'Saved');
 state.outbox.push({id:'op',provider:'todoist',action:'task.upsert',entityId:'quest',payload:{},attempts:0,nextAttempt:'',status:'pending'});
 assert.equal(syncFeedback(state,'Saved').label,'Pending sync');assert.match(syncFeedback(state,'Saved').detail,/Saved in your planner/);
 assert.equal(syncFeedback(state,'Pending sync').label,'Pending sync');assert.match(syncFeedback(state,'Pending sync').detail,/Saved on this device/);assert.equal(syncFeedback(state,'Not saved').label,'Not saved');const confirming=syncFeedback(state,'Reward confirming');assert.equal(confirming.label,'Saved on this device');assert.equal(confirming.tone,'pending');assert.match(confirming.detail,/Reward confirming/);assert.equal(syncFeedback(state,'Saving…').label,'Saving…');
 state.outbox[0].conflict=true;assert.equal(syncFeedback(state,'Saved').label,'Sync needs attention');assert.equal(syncFeedback(state,'Conflict').label,'Conflict');assert.equal(syncFeedback(state,'Saved',true).label,'Connection lost');
});

test('the full editor saves all editable details together without changing completion, provider IDs or rewards',()=>{
 let state=applyCommand(initialState(),{type:'task.add',task:{id:'full-editor-qa',title:'Original',area:'English Literature',notes:'Original briefing',remoteId:'provider-task',subtasks:[{id:'step',title:'Original step',done:false}],sources:[{title:'Original source',url:'https://example.com/original'}]}});
 state=applyCommand(state,{type:'task.toggle',id:'full-editor-qa',done:true});const original=state.tasks.find(t=>t.id==='full-editor-qa')!,rewards=structuredClone(state.rewards),subject=state.subjects.find(s=>s.listId==='life'&&s.title==='Fitness')!;
 const draft=newTaskDraft(original,'unused');draft.value={...draft.value,title:'A complete revised task',notes:'Detailed briefing',listId:'life',subjectId:subject.id,area:subject.title,plannedOn:'2026-11-20',deadline:'2026-11-21T09:00:00Z',deadlineConfirmed:true,estimate:50,priority:3,main:false,subtasks:[{id:'step',title:'Revised step',done:true}],sources:[{title:'New source',url:'https://example.com/revised'}],reminders:false,needsReview:false};
 const saved=applyCommand(state,{type:'task.edit',id:original.id,...taskDraftPatch(draft.base,draft.value)}),task=saved.tasks.find(t=>t.id===original.id)!;
 for(const [key,value]of Object.entries(draft.value))assert.deepEqual(task[key as keyof Task],value);
 for(const key of ['id','done','remoteId','createdAt','completedAt'] as const)assert.deepEqual(task[key],original[key]);assert.deepEqual(saved.rewards,rewards);
});
test('source-link drafts survive reopen and detect overlapping edits before replacing references',()=>{
 const task={id:'source-qa',title:'Task',sources:[{title:'Reference',url:'https://example.com/original'}]} as Task,draft=newTaskDraft(task,'unused');draft.value.sources=[{title:'My reference',url:'https://example.com/mine'}];
 const restored=readTaskDraft(JSON.stringify(draft),task,'unused'),latest={...task,title:'Remote rename',sources:[{title:'Their reference',url:'https://example.com/theirs'}]};const merged=mergeTaskDraft(restored,latest);assert.deepEqual(merged.conflicts,['sources']);assert.equal(merged.record.value.title,'Remote rename');assert.equal(merged.record.value.sources?.[0].url,'https://example.com/mine');
 const resolved=resolveTaskDraft(restored,latest,true),patch=taskDraftPatch(resolved.base,resolved.value);assert.deepEqual(patch.base.sources,latest.sources);assert.deepEqual(patch.patch.sources,draft.value.sources);assert.equal('title' in patch.patch,false);
});
test('older drafts adopt existing references and malformed link drafts cannot discard saved sources',()=>{
 const task={id:'legacy-source',title:'Current',notes:'Original note',sources:[{title:'Saved source',url:'https://example.com/saved'}]} as Task;
 const old={version:1,taskId:task.id,draftId:task.id,base:{title:'Current',notes:'Original note'},value:{title:'Current',notes:'My draft note'},updatedAt:1};
 for(const sources of [undefined,{invalid:true},[null],[{title:'Broken',url:42}]]){const raw=JSON.stringify({...old,base:{...old.base,sources},value:{...old.value,sources}}),merged=mergeTaskDraft(readTaskDraft(raw,task,'unused'),task);assert.deepEqual(merged.record.value.sources,task.sources);assert.deepEqual(merged.conflicts,[]);assert.deepEqual(taskDraftPatch(merged.record.base,merged.record.value).patch,{notes:'My draft note'})}
});
