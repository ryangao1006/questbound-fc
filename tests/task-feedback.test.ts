import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,totalXP} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {previewTaskCheck} from '../lib/task-feedback.ts';

test('immediate checkmark does not mint rewards, advance recurrence or mutate rollback state',()=>{
 const state=reduceCommand(initialState(),{type:'task.add',task:{id:'quick',title:'Test',area:'Projects'}},new Date());
 const basis={revision:1,state,updatedAt:new Date().toISOString()};
 const next=previewTaskCheck(basis,{type:'task.toggle',id:'quick',done:true})!;
 assert.equal(next.state.tasks[0].done,true);
 assert.equal(basis.state.tasks[0].done,false);
 assert.equal(totalXP(next.state),0);
 assert.equal(next.state.rewards,basis.state.rewards);
 assert.equal(next.state.outbox,basis.state.outbox);
 assert.equal(next.revision,basis.revision);
 assert.equal(previewTaskCheck(next,{type:'task.toggle',id:'quick',done:true}),undefined);
 assert.equal(previewTaskCheck(next,{type:'task.toggle',id:'quick',done:false})!.state.tasks[0].done,false);
 assert.equal(previewTaskCheck(basis,{type:'task.toggle',id:'missing',done:true}),undefined);
});
