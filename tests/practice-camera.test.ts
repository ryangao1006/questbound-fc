import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPreset,cameraDimensions} from '../lib/practice-camera.ts';
test('practice camera preferences are bounded and reduced motion retains a fixed wide view',()=>{
 assert.equal(cameraPreset('bad'),'broadcast');assert.equal(cameraPreset(null),'broadcast');
 for(const mobile of [false,true]){
 const close=cameraDimensions('close',mobile,false),normal=cameraDimensions('broadcast',mobile,false),wide=cameraDimensions('wide',mobile,false);
 assert(close.height<normal.height&&normal.height<wide.height);assert(close.back<normal.back&&normal.back<wide.back);
 for(const preset of ['close','broadcast','wide'] as const)assert.deepEqual(cameraDimensions(preset,mobile,true),{height:72,back:58});
 }
});
