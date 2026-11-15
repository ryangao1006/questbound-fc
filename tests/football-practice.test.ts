import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {practiceCareer,createPractice,chargePower,measureBuild,practiceInput} from '../lib/football-practice.ts';
import {stepMatch,matchEngine} from '../lib/football-match.ts';
import {createMatch as createV1} from '../lib/football-engine/v1.ts';
const planner=initialState(),career=practiceCareer(planner);
test('practice is six players, reproducible and cannot alter planner, career, passes or rewards',()=>{
 const before=JSON.stringify({planner,career}),a=createPractice(career,'three'),b=createPractice(career,'three');
 assert.equal(a.actors.filter(p=>p.onPitch).length,6);assert.equal(a.actors.filter(p=>p.onPitch&&p.position==='GK').length,2);
 assert.equal(a.practice,true);assert.equal(a.version,'fixed-football-4');
 for(const s of [a,b]){practiceInput(s,{move:[.7,.3],sprint:true});for(let i=0;i<180;i++)stepMatch(s)}
 assert.deepEqual(a,b);assert.equal(JSON.stringify({planner,career}),before);
});
test('engine trials measure stronger pace and shooting from actual simulation, not invented percentages',()=>{
 const low={...career.player.attributes,pac:40,sho:40},high={...low,pac:90,sho:90},a=measureBuild(career,low),b=measureBuild(career,high);
 assert(b.twoSecondSprint>a.twoSecondSprint);assert(b.shotSpeed>a.shotSpeed);assert.deepEqual(measureBuild(career,low),a);
});
test('charge clamps input, close control reduces speed, idle inputs stop movement',()=>{
 assert.equal(chargePower(-100),.15);assert.equal(chargePower(850),1);assert(chargePower(400)>chargePower(100));
 const a=createPractice(career,'solo'),b=createPractice(career,'solo');practiceInput(a,{move:[1,0],sprint:true});practiceInput(b,{move:[1,0],sprint:true,closeControl:true});for(let i=0;i<45;i++){stepMatch(a);stepMatch(b)}
 const player=(s:typeof a)=>s.actors.find(p=>p.id===s.controlledId)!;
 assert(player(a).x>player(b).x);practiceInput(a,{move:[0,0],sprint:false});for(let i=0;i<60;i++)stepMatch(a);assert(Math.abs(player(a).vx)<.1);
});
test('retained v1 dispatch stays available and solo checkpoints resume exact v2 state',()=>{
 const s=createPractice(career,'solo'),a=structuredClone(s),b=structuredClone(s);for(let i=0;i<200;i++)stepMatch(a);for(let i=0;i<100;i++)stepMatch(b);const restored=JSON.parse(JSON.stringify(b));for(let i=0;i<100;i++)stepMatch(restored);assert.deepEqual(restored,JSON.parse(JSON.stringify(a)));
 const old={...s,version:'fixed-football-1',physicsVersion:'pitch-physics-1'};assert.equal(matchEngine(old).createMatch,createV1);
});
