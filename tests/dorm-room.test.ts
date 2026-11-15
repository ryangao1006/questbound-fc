import test from 'node:test';
import assert from 'node:assert/strict';
import {walkRoom,nearbyRoomObject,DORM_OBJECTS} from '../lib/dorm-room.ts';
test('room movement stays inside boundaries, uses capped delta and normalised diagonals',()=>{
 const start={x:0,z:2.2};assert.deepEqual(walkRoom(start,0,0,1),start);
 const a=walkRoom(start,1,0,.05),b=walkRoom(start,1,1,.05);assert.ok(Math.abs(Math.hypot(b.x-start.x,b.z-start.z)-(a.x-start.x))<1e-9);
 assert.deepEqual(walkRoom(start,1,0,50),a);
 let p=start;for(let i=0;i<1000;i++)p=walkRoom(p,1,1,.05);assert.ok(p.x<=3.22&&p.z<=2.72);
});
test('furniture blocks the player and interactions require proximity',()=>{
 const bed=DORM_OBJECTS[0],p={x:bed.x,z:bed.z+bed.d/2+.29};const moved=walkRoom(p,0,-1,.05);assert.deepEqual(moved,p);
 assert.equal(nearbyRoomObject({x:0,z:2.2}),undefined);
 assert.equal(nearbyRoomObject({x:2.3,z:-1.4}),'wardrobe');
 assert.equal(nearbyRoomObject({x:.2,z:-1.2}),'desk');
});

test('third person movement follows the camera and cancellation stops all input',async()=>{
 const {newDormRuntime,advanceDorm,clearDormInput,dormCamera}=await import('../lib/dorm-controller.ts');
 const r=newDormRuntime();r.point={x:0,z:0};r.keys.add('w');advanceDorm(r,.05);assert.ok(r.point.z<0);
 r.point={x:0,z:0};r.yaw=Math.PI/2;advanceDorm(r,.05);assert.ok(r.point.x<0);
 r.stick={x:1,y:1};clearDormInput(r);const before={...r.point};advanceDorm(r,1);assert.deepEqual(r.point,before);assert.equal(r.moving,false);
 const camera=dormCamera(r);assert.ok(camera.x>=-3.32&&camera.x<=3.32&&camera.z>=-2.82&&camera.z<=2.82);
});

test('room simulation travels equally in map and 30/60/120 Hz 3D updates',async()=>{
 const {newDormRuntime,advanceDorm}=await import('../lib/dorm-controller.ts');
 const travel=(hz:number)=>{const r=newDormRuntime();r.point={x:0,z:1.5};r.keys.add('w');for(let n=0;n<hz;n++)advanceDorm(r,1/hz);return r;};
 const expected=travel(120);for(const hz of [10,30,60]){const r=travel(hz);assert.ok(Math.abs(r.point.z-expected.point.z)<1e-8);assert.ok(Math.abs(r.speed-2.1)<1e-8)}
});
test('acceleration, braking and analog movement are bounded and cancellation is immediate',async()=>{
 const {newDormRuntime,advanceDorm,clearDormInput}=await import('../lib/dorm-controller.ts');
 const r=newDormRuntime();r.keys.add('w');advanceDorm(r,1/120);assert.ok(r.speed>0&&r.speed<2.1);
 for(let n=0;n<20;n++)advanceDorm(r,1/120);assert.ok(Math.abs(r.speed-2.1)<1e-8);
 r.keys.clear();advanceDorm(r,1/120);assert.ok(r.speed>0&&r.speed<2.1);advanceDorm(r,.1);assert.equal(r.moving,false);
 r.stick={x:.05,y:.05};const before={...r.point};advanceDorm(r,.1);assert.deepEqual(r.point,before);
 r.keys.add('shift');r.keys.add('d');advanceDorm(r,.1);clearDormInput(r);advanceDorm(r,.1);assert.equal(r.speed,0);assert.equal(r.moving,false);assert.deepEqual(r.velocity,{x:0,z:0});
});
test('diagonal start and straight start have equal distance; long interruptions cannot leap',async()=>{
 const {newDormRuntime,advanceDorm}=await import('../lib/dorm-controller.ts');const a=newDormRuntime(),b=newDormRuntime();a.keys.add('w');b.keys.add('w');b.keys.add('d');const origin={...a.point};advanceDorm(a,.05);advanceDorm(b,.05);assert.ok(Math.abs(Math.hypot(a.point.x-origin.x,a.point.z-origin.z)-Math.hypot(b.point.x-origin.x,b.point.z-origin.z))<1e-9);
 const before={...a.point};advanceDorm(a,100);assert.ok(Math.hypot(a.point.x-before.x,a.point.z-before.z)<=.36);
});
