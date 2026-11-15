import test from 'node:test';
import assert from 'node:assert/strict';
import {COMIC_INK,COMIC_PALETTE,comicPaletteFor,halftoneSpec,goalBurst,sprintLines,inkOutline,COMIC_PROFILE_ID} from '../lib/comic-art.ts';

test('the comic profile is the shared qfc-comic-v2 identity',()=>{
 assert.equal(COMIC_PROFILE_ID,'qfc-comic-v2');
 assert.equal(COMIC_INK,'#10151f');
 assert.equal(COMIC_PALETTE.burst.length>=4,true);
});

test('halftone specs stay in a usable range per density',()=>{
 const light=halftoneSpec('light'),medium=halftoneSpec('medium'),heavy=halftoneSpec('heavy');
 for(const spec of [light,medium,heavy]){
  assert(spec.scale>=8&&spec.scale<=24);
  assert(spec.radius>0&&spec.radius<spec.scale/2);
  assert(spec.angleDegrees>=0&&spec.angleDegrees<90);
  assert(spec.opacity>0&&spec.opacity<0.3);
 }
 assert(heavy.opacity>medium.opacity&&medium.opacity>light.opacity);
});

test('goal bursts are deterministic per seed and minute',()=>{
 const a=goalBurst(1234,true,'Northbridge FC','Vale Athletic',22);
 const b=goalBurst(1234,true,'Northbridge FC','Vale Athletic',22);
 assert.deepEqual(a,b);
 assert.equal(a.headline,'GOAL!');
 assert.equal(a.subline,"22' Northbridge FC");
 assert(a.rotation>=-12&&a.rotation<=12);
 assert(a.scale>0.9&&a.scale<1.2);
 assert(a.rays>=10);
 assert.notDeepEqual(goalBurst(1234,true,'Northbridge FC','Vale Athletic',23),a);
});

test('sprint lines are deterministic and bounded',()=>{
 const lines=sprintLines(77),again=sprintLines(77);
 assert.deepEqual(lines,again);
 assert.equal(lines.length,5);
 for(const line of lines){
  assert(line.angle>=0&&line.angle<=Math.PI*2);
  assert(line.length>=0.8&&line.length<=1.9);
  assert(line.offset>=0&&line.offset<0.6);
 }
});

test('club colours accent the comic palette and ink outlines expand',()=>{
 const palette=comicPaletteFor('#2f6f4e','#c8f56e');
 assert.equal(palette.accent,'#c8f56e');
 assert.equal(palette.burst[1],'#2f6f4e');
 assert.equal(palette.ink,COMIC_INK);
 const outline=inkOutline(1);
 assert(outline.scale>1);
 assert.equal(outline.colour,COMIC_INK);
});
