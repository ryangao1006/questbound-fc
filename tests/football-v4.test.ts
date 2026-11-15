import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {practiceCareer,createPractice,practiceInput} from '../lib/football-practice.ts';
import {stepMatch,applyMatchInput,matchEngine} from '../lib/football-match.ts';
import {footballField} from '../lib/football-field.ts';
import * as v3 from '../lib/football-engine/v3.ts';
import {basePosition} from '../lib/football-engine/v4.ts';
const career=practiceCareer(initialState());
const ownOf=(s:ReturnType<typeof createPractice>)=>s.actors.find(p=>p.id===s.controlledId)!;
const mateOf=(s:ReturnType<typeof createPractice>)=>{const own=ownOf(s);return s.actors.find(p=>p.home===own.home&&p.onPitch&&p.id!==own.id)};

test('small-sided practice now runs fixed-football-4 on the 60x40 field while v1/v2/v3 stay dispatchable',()=>{
 const s=createPractice(career,'three');
 assert.equal(s.version,'fixed-football-4');assert.equal(s.physicsVersion,'pitch-physics-4');
 assert.equal(matchEngine(s).MATCH_ENGINE_VERSION,'fixed-football-4');
 assert.deepEqual(footballField(s),{width:60,height:40});
 assert.equal(s.actors.filter(p=>p.onPitch).length,6);
 const old=structuredClone(s);old.version=v3.MATCH_ENGINE_VERSION;old.physicsVersion=v3.PHYSICS_VERSION;
 assert.equal(matchEngine(old),v3);assert.equal(matchEngine(old).HALF_SECONDS,90);
 for(const p of [s.actors,...[old.actors]])assert.equal(p.filter(a=>a.onPitch).length>=6,true);
});

test('the controlled player publishes the pass target and it clears when the ball leaves',()=>{
 const s=createPractice(career,'three'),own=ownOf(s);assert.equal(s.ball.owner,own.id);
 stepMatch(s);
 const preview=s.actors.find(p=>p.id===s.passPreview);
 assert(preview,'pass preview should name a teammate');
 assert.equal(preview!.home,own.home);assert.notEqual(preview!.id,own.id);
 // Aiming away from everyone must still resolve to a real, deterministic target.
 const again=structuredClone(s);stepMatch(again);assert.equal(again.passPreview,s.passPreview);
 s.ball={x:5,y:5,z:.12,vx:0,vy:0,vz:0};stepMatch(s);assert.equal(s.passPreview,undefined);
});

test('an action pressed before the pass arrives becomes a real one-touch instead of being dropped',()=>{
 const s=createPractice(career,'three'),own=ownOf(s),mate=mateOf(s)!;
 s.stoppage=null;s.ball={x:own.x-3,y:own.y,z:.12,vx:6,vy:0,vz:0,lastTouch:mate.id,lastTeam:own.home};
 assert.notEqual(s.ball.owner,own.id);
 practiceInput(s,{action:'pass',power:.7,target:[own.x+12,own.y]});
 assert(s.buffer,'pressing while the ball is travelling should buffer the action');
 let released=false;
 for(let i=0;i<40&&!released;i++){stepMatch(s);if(own.stats.passes>0&&s.ball.owner!==own.id&&Math.hypot(s.ball.vx,s.ball.vy)>6)released=true}
 assert(released,'the buffered pass should be released as a first touch');
 assert.equal(s.buffer,undefined);assert.equal(own.stats.passes,1);
});

test('a stale buffered action expires so an old key press cannot fire late',()=>{
 const s=createPractice(career,'three'),own=ownOf(s),mate=mateOf(s)!;
 s.stoppage=null;s.ball={x:own.x-8,y:own.y,z:.12,vx:1.5,vy:0,vz:0,lastTouch:mate.id,lastTeam:!mate.home};
 practiceInput(s,{action:'shoot',power:.9,target:[own.x+10,20]});
 assert(s.buffer);
 for(let i=0;i<24;i++)stepMatch(s);
 assert.equal(s.buffer,undefined,'a buffer older than 0.6 s must be discarded');
 assert.equal(own.stats.passes,0);assert.equal(own.stats.shots,0);
});

test('defenders hold their slot shape instead of collapsing onto one threat',()=>{
 const build=()=>{const s=createPractice(career,'three'),own=ownOf(s);s.stoppage=null;s.ball={x:30,y:34,z:.12,vx:0,vy:0,vz:0,owner:own.id,lastTouch:own.id,lastTeam:own.home};own.x=30;own.y=34;return s};
 const current=build(),legacy=build();
 legacy.version=v3.MATCH_ENGINE_VERSION;legacy.physicsVersion=v3.PHYSICS_VERSION;
 for(let i=0;i<90;i++){stepMatch(current);v3.stepMatch(legacy as never)}
 const away=(s:ReturnType<typeof createPractice>)=>s.actors.filter(p=>p.home!==s.actors.find(a=>a.id===s.controlledId)!.home&&p.onPitch&&p.position!=='GK');
 const drift=(s:ReturnType<typeof createPractice>)=>away(s).reduce((total,p)=>{const base=basePosition(s,p);return total+Math.hypot(p.x-base.x,p.y-base.y)},0);
 assert(away(current).length>=2);
 assert(drift(current)<drift(legacy),`slot shape ${drift(current).toFixed(1)} should beat threat-chasing ${drift(legacy).toFixed(1)}`);
 for(const p of away(current)){assert(p.x>=0&&p.x<=60&&p.y>=0&&p.y<=40)}
});

test('a v4 checkpoint replays exactly and keeps the buffered action in the saved state',()=>{
 const s=createPractice(career,'three'),own=ownOf(s);s.stoppage=null;s.ball={x:own.x-3,y:own.y,z:.12,vx:5,vy:0,vz:0,lastTeam:own.home};
 practiceInput(s,{action:'through',power:.4,target:[own.x+14,own.y],move:[0,-1]});
 const inputs=[{frame:s.frame,action:'through' as const,power:.4,target:[own.x+14,own.y] as [number,number]}];
 const a=structuredClone(s),b=JSON.parse(JSON.stringify(s));
 for(let i=0;i<120;i++){stepMatch(a);stepMatch(b)}
 assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
 assert(inputs.length===1);
 assert.equal(typeof s.buffer,'object');
 const restored=JSON.parse(JSON.stringify(s));
 for(let i=0;i<60;i++)stepMatch(restored);
 assert.equal(restored.version,'fixed-football-4');
});
