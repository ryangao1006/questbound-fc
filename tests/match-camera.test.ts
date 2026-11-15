import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_MATCH_CAMERA,cameraRig,parseMatchCamera,readMatchCamera,writeMatchCamera} from '../lib/match-camera.ts';

test('camera settings fall back to the broadcast default for missing or invalid values',()=>{
 assert.deepEqual(parseMatchCamera(null),DEFAULT_MATCH_CAMERA);
 assert.deepEqual(parseMatchCamera({preset:'nonsense',follow:'wide',zoom:NaN}),DEFAULT_MATCH_CAMERA);
 assert.equal(parseMatchCamera({preset:'close'}).preset,'close');
});

test('follow strength and zoom are clamped to usable values',()=>{
 assert.deepEqual(parseMatchCamera({follow:-3,zoom:9}),{preset:'broadcast',follow:0,zoom:1.4});
 assert.deepEqual(parseMatchCamera({follow:4,zoom:.1}),{preset:'broadcast',follow:1,zoom:.7});
});

test('the rig moves the look-at point from the ball toward the player',()=>{
 const ball=cameraRig({preset:'broadcast',follow:0,zoom:1});
 const player=cameraRig({preset:'broadcast',follow:1,zoom:1});
 assert.equal(ball.playerWeight,.25);
 assert.equal(player.playerWeight,.85);
 assert(Math.abs(ball.playerWeight+ball.ballWeight-1)<1e-9);
 assert.equal(ball.height,player.height);
});

test('close and wide presets change framing and zoom scales it',()=>{
 const base=cameraRig({preset:'broadcast',follow:.4,zoom:1});
 const close=cameraRig({preset:'close',follow:.4,zoom:1});
 const wide=cameraRig({preset:'wide',follow:.4,zoom:1});
 const zoomed=cameraRig({preset:'broadcast',follow:.4,zoom:1.3});
 assert(close.height<base.height&&wide.height>base.height);
 assert(zoomed.height>base.height);
 assert(close.back<base.back&&wide.back>base.back);
});

test('reduced motion keeps one stable wide framing',()=>{
 const a=cameraRig({preset:'close',follow:1,zoom:1.4},{reduced:true});
 const b=cameraRig({preset:'wide',follow:0,zoom:.7},{reduced:true});
 assert.deepEqual(a,b);
 assert.equal(a.height,72);
});

test('settings round-trip through storage without touching the account',()=>{
 const store=new Map<string,string>();
 const storage={getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>void store.set(key,value)};
 const written=writeMatchCamera({preset:'wide',follow:.65,zoom:1.15},storage);
 assert.deepEqual(readMatchCamera(storage),written);
 assert.equal(store.size,1);
});
