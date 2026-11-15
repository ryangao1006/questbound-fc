import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateClubMatchV2,shotXg,xgSummary,attackStrength,createMatchV2,advanceMatchV2} from '../lib/match-v2.ts';
import type {ClubTeam} from '../lib/club-match.ts';

const team=(lines:Partial<ClubTeam['lines']>={},tactic:ClubTeam['tactic']='balanced'):ClubTeam=>({name:'Test FC',shortName:'TST',lines:{DEF:60,MID:60,ATT:60,GK:60,...lines},tactic,scorers:{ATT:['Striker'],MID:['Mid'],DEF:['Back']}});
const avg=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;

test('v2 is deterministic and produces a coherent report',()=>{
 const a=simulateClubMatchV2(team(),team({DEF:64}),42),b=simulateClubMatchV2(team(),team({DEF:64}),42);
 assert.deepEqual(a,b);
 assert.equal(a.engine,'v2');
 assert.equal(a.path.length,54);
 assert(a.timeline.length>0);
 assert(a.events.length>0);
 for(const item of a.timeline){assert(item.minute>=1&&item.minute<=90);assert(item.carrier>=0&&item.carrier<=10)}
 for(const shot of a.shotXgs){assert(shot.xg>=0.01&&shot.xg<=0.85);assert(shot.distance>=0)}
 assert.equal(a.events.filter(event=>event.kind==='goal'&&event.side==='home').length,a.score[0]);
 assert.equal(a.events.filter(event=>event.kind==='goal'&&event.side==='away').length,a.score[1]);
 assert(a.onTarget[0]>=a.score[0]&&a.onTarget[1]>=a.score[1]);
});

test('shot quality falls with distance from goal',()=>{
 const near=shotXg(100,34,'home'),mid=shotXg(85,34,'home'),far=shotXg(65,34,'home');
 assert(near>mid&&mid>far);
 assert(near>0.25&&far<0.06);
 const wide=shotXg(90,60,'home'),central=shotXg(90,34,'home');
 assert(central>wide);
});

test('a stronger attack scores more and earns more xG across seeds',()=>{
 const strong=team({ATT:86}),weak=team({ATT:50}),def=team();
 const strongGoals=Array.from({length:80},(_,index)=>simulateClubMatchV2(strong,def,100+index));
 const weakGoals=Array.from({length:80},(_,index)=>simulateClubMatchV2(weak,def,100+index));
 assert(avg(strongGoals.map(report=>report.score[0]))>avg(weakGoals.map(report=>report.score[0]))+0.4);
 assert(avg(strongGoals.map(report=>report.xg[0]))>avg(weakGoals.map(report=>report.xg[0])));
});

test('home advantage shows across many matches',()=>{
 let home=0,away=0;
 for(let seed=1;seed<=120;seed+=1){const report=simulateClubMatchV2(team(),team(),seed);home+=report.score[0];away+=report.score[1]}
 assert(home>away,`${home} vs ${away}`);
});

test('the summary reports xG, shots and goals consistently',()=>{
 const report=simulateClubMatchV2(team({ATT:72}),team({DEF:58}),7),summary=xgSummary(report);
 assert.deepEqual(summary.goals,report.score);
 assert.deepEqual(summary.shots,report.shotsV2);
 assert.equal(summary.xg.length,2);
 assert(summary.perShot>=0&&summary.perShot<=0.85);
 assert(summary.xg[0]>=report.score[0]*0+0);
});

test('attack strength reacts to tactics and to the opponent defence',()=>{
 const base=attackStrength(team(),team(),true);
 const pressed=attackStrength(team({},'press'),team(),true);
 const against={...team(),lines:{DEF:80,MID:60,ATT:60,GK:60}};
 assert(pressed.multiplier!==base.multiplier);
 assert(attackStrength(team(),against as ClubTeam,true).multiplier<base.multiplier);
});

test('the ball keeps flowing: each timeline item starts near where the previous one ended',()=>{
 const report=simulateClubMatchV2(team({ATT:74,MID:66}),team({DEF:58}),21);
 const items=report.timeline.filter(item=>item.kind!=='restart');
 assert(items.length>10);
 let near=0,checked=0;
 for(let index=1;index<items.length;index+=1){
  const previous=items[index-1],current=items[index];
  const jump=Math.hypot(current.from.x-previous.to.x,current.from.y-previous.to.y);
  checked+=1;
  if(jump<=18)near+=1;
 }
 assert(near/checked>0.8,`${near}/${checked} possessions continue from the ball`);
});

test('a live v2 session exposes the ball position and advances block by block',()=>{
 const state=createMatchV2(team(),team({MID:64}),9);
 assert.deepEqual(state.ball,{x:52.5,y:34});
 const first=advanceMatchV2(state);
 assert.equal(first.block,1);
 assert(first.timeline.length>0);
 assert(first.ball.x>=0&&first.ball.x<=105);
 assert.equal(first.finished,false);
 let live=first;while(!live.finished)live=advanceMatchV2(live);
 assert.equal(live.finished,true);
 assert.equal(live.block,18);
});

test('the ball track is a continuous monotonic keyframe list for smooth playback',()=>{
 const report=simulateClubMatchV2(team({ATT:74}),team({DEF:58}),33);
 assert(report.ballTrack.length>report.timeline.length);
 assert.equal(report.ballTrack[0].m,0);
 assert.deepEqual({x:report.ballTrack[0].x,y:report.ballTrack[0].y},{x:52.5,y:34});
 let previous=0,bigJumps=0,smooth=0;
 for(let index=0;index<report.ballTrack.length;index+=1){
  const frame=report.ballTrack[index];
  assert(frame.m>=previous-0.001,`track minutes are monotonic at ${index}`);
  previous=frame.m;
  assert(frame.x>=0&&frame.x<=105&&frame.y>=0&&frame.y<=68);
  if(index>0){const prior=report.ballTrack[index-1];const jump=Math.hypot(frame.x-prior.x,frame.y-prior.y);if(jump>40)bigJumps+=1;else if(jump<=20)smooth+=1}
 }
 assert(bigJumps<=8,`${bigJumps} long teleports`);
 // pass/dribble keyframes legitimately cover 20-40 pitch units; the watch clamps speed on top
 assert(smooth/(report.ballTrack.length-1)>0.6,`${smooth}/${report.ballTrack.length-1} short segments`);
 assert(report.ballTrack[report.ballTrack.length-1].m<=90.5);
});
