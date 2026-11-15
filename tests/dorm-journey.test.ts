import test from 'node:test';import assert from 'node:assert/strict';
import {newDormRuntime} from '../lib/dorm-controller.ts';
import {captureDorm,resumeDorm,dormDestination,dormTransitionDuration} from '../lib/dorm-journey.ts';
import {initialState} from '../lib/model.ts';
import {appearanceValues,readAppearanceDraft} from '../lib/appearance-draft.ts';
test('dorm snapshots restore position, camera and facing without restoring held input',()=>{
 const r=newDormRuntime();r.point={x:.5,z:1.2};r.yaw=.9;r.pitch=.4;r.distance=2.2;r.facing=-1;r.keys.add('w');r.stick={x:.8,y:0};r.speed=2.1;
 const snapshot=captureDorm(r,true,true,'desk');r.point.x=1;const restored=resumeDorm(snapshot);
 assert.deepEqual(restored.point,{x:.5,z:1.2});assert.equal(restored.yaw,.9);assert.equal(restored.pitch,.4);assert.equal(restored.distance,2.2);assert.equal(restored.facing,-1);assert.equal(restored.keys.size,0);assert.equal(restored.speed,0);assert.deepEqual(restored.stick,{x:0,y:0});assert.equal(snapshot.map,true);assert.equal(snapshot.focusObject,'desk');restored.point.x=-1;assert.equal(snapshot.point.x,.5);
});
test('dorm destinations are complete existing pages and reduced motion removes transition delay',()=>{
 assert.equal(dormDestination('desk'),'quests');assert.equal(dormDestination('wardrobe'),'appearance');assert.equal(dormDestination('mirror'),'appearance');assert.equal(dormDestination('trophies'),'history');
 assert.equal(dormTransitionDuration(false,false),180);for(const [saved,device] of [[true,false],[false,true],[true,true]])assert.equal(dormTransitionDuration(saved,device),0);
});
test('appearance drafts preserve previews and their baseline without writing saved values',()=>{
 const saved=appearanceValues(initialState().settings),value={...saved,name:'New preview',playerNumber:0};const raw=JSON.stringify({version:1,baseline:JSON.stringify(saved),value});const draft=readAppearanceDraft(raw)!;
 assert.equal(draft.value.name,'New preview');assert.equal(draft.value.playerNumber,0);assert.equal(draft.baseline,JSON.stringify(saved));assert.notEqual(saved.name,'New preview');assert.equal(readAppearanceDraft(JSON.stringify({...draft,value:{...value,avatar:{...value.avatar,hair:99}}})),null);
 assert.equal(readAppearanceDraft('broken'),null);assert.equal(readAppearanceDraft(JSON.stringify({version:2,baseline:'{}',value})),null);
});
