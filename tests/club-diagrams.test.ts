import test from 'node:test';
import assert from 'node:assert/strict';
import {polar,radarPolygon,compareBars,progressRing,formationDots,trophyPips,levelPips,ratingsRadar,budgetSplit} from '../lib/club-diagrams.ts';

test('polar points sit on the requested radius',()=>{
 const north=polar({x:50,y:50},40,0);
 assert.equal(north.x,50);assert.equal(north.y,10);
 const east=polar({x:50,y:50},40,90);
 assert.equal(east.x,90);assert.equal(east.y,50);
});

test('radar polygons have one point per axis and stay inside the radius',()=>{
 const radar=radarPolygon([{label:'DEF',value:60},{label:'MID',value:80},{label:'ATT',value:40},{label:'GK',value:100}],{x:60,y:60},50);
 assert.equal(radar.axes.length,4);
 assert.equal(radar.points.split(' ').length,4);
 for(const axis of radar.axes){
  const distance=Math.hypot(axis.tip.x-60,axis.tip.y-60);
  assert(distance<=50.01);
 }
 assert.equal(radar.axes[3].tip.x,10);
 assert.equal(radar.axes[3].tip.y,60);
});

test('compare bars clamp to 0..100 and report the difference',()=>{
 const bars=compareBars(72,58);
 assert.equal(bars.oursPct,72);assert.equal(bars.theirsPct,58);assert.equal(bars.diff,14);
 const clamped=compareBars(120,-5);
 assert.equal(clamped.oursPct,100);assert.equal(clamped.theirsPct,0);
});

test('progress rings and pips stay inside their ranges',()=>{
 assert.deepEqual(progressRing(1,14,100),{fraction:0.071,dashOffset:92.86});
 assert.deepEqual(progressRing(14,14,100),{fraction:1,dashOffset:0});
 assert.deepEqual(progressRing(0,0,100),{fraction:0,dashOffset:100});
 assert.deepEqual(trophyPips(3),{filled:3,total:5});
 assert.deepEqual(trophyPips(9),{filled:5,total:5});
 assert.deepEqual(levelPips(2),{filled:2,total:5});
});

test('formation dots keep eleven players inside the viewBox',()=>{
 const dots=formationDots('4-3-3',105,68);
 assert.equal(dots.slots.length,11);
 assert.equal(dots.slots.filter(slot=>slot.role==='GK').length,1);
 for(const dot of dots.slots){assert(dot.x>=0&&dot.x<=105);assert(dot.y>=0&&dot.y<=68)}
 const scaled=formationDots('4-4-2',300,200);
 for(const dot of scaled.slots){assert(dot.x>=0&&dot.x<=300);assert(dot.y>=0&&dot.y<=200)}
});

test('ratings radar and budget split are deterministic and sensible',()=>{
 const a=ratingsRadar({DEF:60,MID:61,ATT:56,GK:62},{x:60,y:60},50),b=ratingsRadar({DEF:60,MID:61,ATT:56,GK:62},{x:60,y:60},50);
 assert.deepEqual(a,b);
 assert.deepEqual(budgetSplit(150,[20,40]),{affordable:true,remaining:130,pct:100});
 assert.deepEqual(budgetSplit(10,[20,40]),{affordable:false,remaining:0,pct:50});
});
