import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {playerFrame,boundedPlayerZoom,playerFrameLoop,setIdlePresentation,PLAYER_LIGHTING} from '../lib/player-presentation.ts';

test('full body and portrait camera frames fit the player on tall phone and desktop viewports',()=>{
 for(const height of [150,180,205])for(const aspect of [.35,.55,.85,1.3,2.5])for(const portrait of [false,true]){
  const frame=playerFrame(portrait,height,aspect),scale=height/180,camera=new THREE.PerspectiveCamera(34,aspect,.05,30);
  camera.position.set(0,frame.targetY,frame.distance);camera.lookAt(0,frame.targetY,0);camera.updateMatrixWorld();
  const ys=portrait?[frame.targetY-.34*scale,frame.targetY+.34*scale]:[0,1.8*scale],halfWidth=(portrait?.35:.7)*scale;
  for(const x of [-halfWidth,halfWidth])for(const y of ys){const point=new THREE.Vector3(x,y,0).project(camera);assert(Math.abs(point.x)<.94);assert(Math.abs(point.y)<.94);assert(point.z>-1&&point.z<1);}
 }
});
test('zoom stops at safe distances and can move back away from either limit',()=>{
 const frame=playerFrame(false,205,.85);
 assert.equal(boundedPlayerZoom(frame.distance,100,frame.minDistance,frame.maxDistance),frame.minDistance);
 assert.equal(boundedPlayerZoom(frame.distance,-100,frame.minDistance,frame.maxDistance),frame.maxDistance);
 assert(boundedPlayerZoom(frame.minDistance,-1,frame.minDistance,frame.maxDistance)>frame.minDistance);
 assert(boundedPlayerZoom(frame.maxDistance,1,frame.minDistance,frame.maxDistance)<frame.maxDistance);
});
test('a paused player holds the rigged idle pose and resumes without returning to the bind pose',()=>{
 const arm=new THREE.Object3D();arm.rotation.z=Math.PI/3;
 const clip=new THREE.AnimationClip('idle',4,[new THREE.NumberKeyframeTrack('.rotation[z]',[0,4],[.1,.2])]);
 const mixer=new THREE.AnimationMixer(arm),idle=mixer.clipAction(clip);
 setIdlePresentation(idle,mixer,true,true);assert(arm.rotation.z<.11);const pose=arm.rotation.z;
 mixer.update(10);assert.equal(arm.rotation.z,pose);
 setIdlePresentation(idle,mixer,false,false);mixer.update(.5);assert(arm.rotation.z>pose);assert(arm.rotation.z<.2);
});
test('hidden, phone and reduced-motion previews avoid the continuous rendering loop',()=>{
 assert.equal(playerFrameLoop(true,false,false),'always');
 for(const mobile of [true,false])for(const reduced of [true,false])assert.equal(playerFrameLoop(false,reduced,mobile),'demand');
 assert.equal(playerFrameLoop(true,true,false),'demand');assert.equal(playerFrameLoop(true,false,true),'demand');
 assert.deepEqual(Object.keys(PLAYER_LIGHTING),['night-stadium','classic-career']);
 for(const value of Object.values(PLAYER_LIGHTING)){assert(value.exposure>=1&&value.exposure<=1.15);assert(value.environment>0&&value.environment<=1);}
});
