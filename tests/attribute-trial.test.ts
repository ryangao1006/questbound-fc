import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {practiceCareer} from '../lib/football-practice.ts';
import {runTrials} from '../lib/attribute-trial.ts';

const career=practiceCareer(initialState());
const base=career.player.attributes;

test('fixed-seed trials are reproducible and do not mutate the career',()=>{
 const before=JSON.stringify(career),first=runTrials(career,base),second=runTrials(career,base);
 assert.deepEqual(first,second);
 assert.equal(JSON.stringify(career),before);
 for(const value of Object.values(first)){assert(Number.isFinite(value));assert(value>=0)}
});

test('pace, acceleration and agility improve the movement trials',()=>{
 const fast={...base,pac:92,acc:92,agi:92,sta:92},slow={...base,pac:40,acc:40,agi:40,sta:40};
 const a=runTrials(career,fast),b=runTrials(career,slow);
 assert(a.accelerationSeconds<b.accelerationSeconds,`${a.accelerationSeconds} < ${b.accelerationSeconds}`);
 assert(a.turnSeconds<=b.turnSeconds,`${a.turnSeconds} <= ${b.turnSeconds}`);
 assert(a.lateSprintMetres>b.lateSprintMetres,`${a.lateSprintMetres} > ${b.lateSprintMetres}`);
});

test('passing and finishing change the ball trials, not the movement ones',()=>{
 const skilled={...base,pas:95,cro:95,sho:95,fin:95},clumsy={...base,pas:35,cro:35,sho:35,fin:35};
 const a=runTrials(career,skilled),b=runTrials(career,clumsy);
 assert(a.passErrorMetres<b.passErrorMetres,`${a.passErrorMetres} < ${b.passErrorMetres}`);
 assert(a.shotSpreadMetres<b.shotSpreadMetres,`${a.shotSpreadMetres} < ${b.shotSpreadMetres}`);
 assert.equal(a.accelerationSeconds,b.accelerationSeconds);
});

test('the trial reports metres and seconds a player would recognise',()=>{
 const metrics=runTrials(career,base);
 assert(metrics.accelerationSeconds>0.5&&metrics.accelerationSeconds<4);
 assert(metrics.passErrorMetres>=0&&metrics.passErrorMetres<12);
 assert(metrics.shotSpreadMetres>=0&&metrics.shotSpreadMetres<12);
 assert(metrics.lateSprintMetres>=0&&metrics.lateSprintMetres<14);
});
