import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,totalXP,type PlannerState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {careerProgress,confirmedCareerFeedback,coachFeedback,hasSavedFocusSession} from '../lib/career-feedback.ts';
import {GameAudio,SOUND_NOTES,soundAllowed,soundQuiet,readDeviceSound} from '../lib/game-audio.ts';

test('career milestones use saved XP, preserve claimed equipment on undo and never mutate records',()=>{
 const state=initialState();state.rewards=[{id:'earned',points:100,active:true,at:'2026-11-12T00:00:00Z'}];
 const original=JSON.stringify(state),career=careerProgress(state);assert.equal(career.rank,2);assert.equal(career.ready[0].id,'boots');assert.equal(career.next?.id,'kit');assert.equal(career.progress,0);assert.equal(career.toNextLevel,100);assert.equal(JSON.stringify(state),original);
 state.settings.unlocked.push('boots');state.rewards[0].active=false;assert.equal(careerProgress(state).milestones[0].available,true);assert.equal(totalXP(state),0);
});
test('confirmed feedback follows reward activation: duplicates, undo, unrelated updates and short focus do not award celebrations',()=>{
 let state=reduceCommand(initialState(),{type:'task.add',task:{id:'q',title:'Local test'}});const command={type:'task.toggle',id:'q',done:true},after=reduceCommand(state,command);
 assert.equal(confirmedCareerFeedback(state,after,command)?.points,10);assert.equal(confirmedCareerFeedback(after,after,command),null);assert.equal(confirmedCareerFeedback(state,after,{type:'settings.update',patch:{language:'zh'}}),null);
 const undo=reduceCommand(after,{...command,done:false});assert.equal(confirmedCareerFeedback(after,undo,{...command,done:false}),null);assert.equal(confirmedCareerFeedback(undo,after,command)?.points,10);
 state=reduceCommand(initialState(),{type:'focus.start',minutes:15},new Date('2026-11-12T00:00:00Z'));const short=reduceCommand(state,{type:'focus.finish'},new Date('2026-11-12T01:00:00Z'));assert.equal(confirmedCareerFeedback(state,short,{type:'focus.finish'}),null);assert.equal(hasSavedFocusSession(state,short),true);const zero=reduceCommand(state,{type:'focus.finish'},new Date('2026-11-12T00:00:00Z'));assert.equal(hasSavedFocusSession(state,zero),false);
});
test('level-up feedback occurs only at the existing 100 XP boundary and focus XP stays 5',()=>{
 let state=reduceCommand(initialState(),{type:'task.add',task:{id:'q',title:'Local test'}});state.rewards.push({id:'history',points:90,active:true,at:'2026-11-12T00:00:00Z'});
 const command={type:'task.toggle',id:'q',done:true},after=reduceCommand(state,command);const feedback=confirmedCareerFeedback(state,after,command);assert.equal(feedback?.levelUp,true);assert.equal(feedback?.level,2);assert.equal(totalXP(after),100);
 state=reduceCommand(initialState(),{type:'focus.start',minutes:25},new Date('2026-11-12T00:00:00Z'));const focus=reduceCommand(state,{type:'focus.finish'},new Date('2026-11-12T00:20:00Z'));assert.equal(confirmedCareerFeedback(state,focus,{type:'focus.finish'})?.points,5);
});
test('coach feedback uses saved activity and offers a gentle starting point without missed-day penalties',()=>{
 const state=initialState(),before=JSON.stringify(state);assert.match(coachFeedback(state).key,/manageable/);assert.equal(JSON.stringify(state),before);
 state.activeSession={id:'focus',area:'Projects',startedAt:'2026-11-12T00:00:00Z',target:1500,pausedSeconds:0,pausedAt:'2026-11-12T00:05:00Z'};assert.match(coachFeedback(state).key,/paused/);
});
test('sound policy honours quiet hours, mute, zero volume, hidden tabs and saved enable preference',()=>{
 const settings={...initialState().settings,sound:true},device={muted:false,volume:.3};
 assert.equal(soundQuiet(settings,new Date('2026-11-12T14:00:00Z')),true);assert.equal(soundQuiet(settings,new Date('2026-11-13T00:00:00Z')),false);
 const day=new Date('2026-11-12T04:00:00Z');assert.equal(soundAllowed(settings,device,true,day),true);
 for(const [sound,muted,volume,visible] of [[false,false,.3,true],[true,true,.3,true],[true,false,0,true],[true,false,.3,false]] as const)assert.equal(soundAllowed({...settings,sound},{muted,volume},visible,day),false);
 assert.equal(soundAllowed(settings,device,true,new Date('2026-11-12T21:00:00Z')),false);assert.deepEqual(readDeviceSound('{broken'),device);assert.deepEqual(readDeviceSound('{"muted":true,"volume":5}'),{muted:true,volume:1});
});
test('audio waits for a user gesture, suppresses repeat events, bounds gain and releases voices',async()=>{
 let created=0,started=0,stopped=0;const peaks:number[]=[];
 const context={state:'suspended',currentTime:1,destination:{},resume:async()=>{context.state='running'},close:async()=>{},createOscillator:()=>({type:'',frequency:{setValueAtTime(){}},connect(){},disconnect(){},start(){started++},stop(){stopped++},onended:null}),createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(n:number){peaks.push(n)},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 const audio=new GameAudio(()=>{created++;return context as unknown as AudioContext});assert.equal(audio.play('complete',.3,true,'operation'),false);assert.equal(created,0);
 await audio.arm();assert.equal(audio.play('complete',.3,true,'operation'),true);assert.equal(started,SOUND_NOTES.complete.length);assert(peaks.every(n=>n<=.085));assert.equal(audio.play('complete',.3,true,'operation'),false);assert.equal(audio.play('level',.3,false,'another'),false);audio.stop();assert(stopped>=started);audio.close();
});
test('tactile clicks have short bounded envelopes, throttle rapid clicks, and never interrupt a saved achievement',async()=>{
 const frequencies:number[]=[],durations:number[]=[],peaks:number[]=[];let stopped=0;const context={state:'running',currentTime:1,destination:{},resume:async()=>{},close:async()=>{},createOscillator:()=>({type:'',frequency:{setValueAtTime(n:number){frequencies.push(n)},exponentialRampToValueAtTime(n:number){frequencies.push(n)}},connect(){},disconnect(){},start(){},stop(at?:number){stopped++;if(at)durations.push(at-context.currentTime)},onended:null}),createGain:()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(n:number){peaks.push(n)},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}})};
 const audio=new GameAudio(()=>context as unknown as AudioContext);await audio.arm();assert.equal(audio.play('selection',.4,true,undefined,'soft'),true);assert(durations.every(t=>t<.07));assert(frequencies[0]>frequencies[1]);assert(peaks.every(g=>g<=.075));assert.equal(audio.play('selection',.4,true),false);context.currentTime+=.1;assert.equal(audio.play('complete',.4,true,'saved'),true);const count=stopped;context.currentTime+=.1;assert.equal(audio.play('selection',.4,true),false);assert.equal(stopped,count);context.currentTime+=1;assert.equal(audio.play('selection',.4,true,undefined,'crisp'),true);audio.close();assert.equal(readDeviceSound('{"muted":false,"volume":0.4,"clickStyle":"crisp"}').clickStyle,'crisp');assert.equal(readDeviceSound('{"muted":false,"volume":0.4,"clickStyle":"loud"}').clickStyle,undefined)
});
