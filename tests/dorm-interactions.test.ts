import test from 'node:test';
import assert from 'node:assert/strict';
import {DORM_OBJECTS,DORM_INTERACTIONS,dormInteraction} from '../lib/dorm-room.ts';
import {translate} from '../lib/i18n.ts';
test('room interactions map real furniture to read-only or existing planner panels',()=>{
 assert.equal(new Set(DORM_INTERACTIONS.map(item=>item.id)).size,4);
 for(const item of DORM_INTERACTIONS){assert.ok(DORM_OBJECTS.some(object=>object.id===item.id));assert.ok(item.height>0);assert.ok(['appearance','tasks','trophies'].includes(item.panel));assert.notEqual(translate('zh',item.label),item.label);assert.notEqual(translate('zh',item.hint),item.hint);assert.equal(dormInteraction(item.id),item)}
 assert.equal(dormInteraction('bed'),undefined);assert.equal(dormInteraction('unknown'),undefined);
});
test('return and pending-draft messages are available in both languages',()=>{
 for(const label of ['Back to dorm','Your dressing room','Your room position and camera are kept.','Your appearance draft stays in the wardrobe.','Keep editing','Discard and exit','Jog'])assert.notEqual(translate('zh',label),translate('en',label));
});
