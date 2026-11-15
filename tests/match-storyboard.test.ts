import test from 'node:test';
import assert from 'node:assert/strict';
import {storyboardFromRecord,storyboardBeats,panelLabel,storyboardSummary} from '../lib/match-storyboard.ts';

const record=(events:any[],score:[number,number]=[0,0])=>({events,score,teams:{home:'Northbridge FC',away:'Vale Athletic'}});
const goal=(minute:number,side:'home'|'away'='home',scorer='Rui Dax')=>({minute,side,kind:'goal' as const,line:'ATT' as const,label:'Goal',scorer,homeName:'Northbridge FC',awayName:'Vale Athletic'});
const save=(minute:number)=>({minute,side:'home' as const,kind:'save' as const,line:'ATT' as const,label:'Saved',scorer:'Yuri Sayer',homeName:'Northbridge FC',awayName:'Vale Athletic'});

test('a match timeline becomes eighteen five-minute panels',()=>{
 const board=storyboardFromRecord(record([goal(17),save(22)]));
 assert.equal(board.panels.length,18);
 assert.equal(board.panels[0].minuteStart,1);
 assert.equal(board.panels[0].minuteEnd,5);
 assert.equal(board.panels[1].minuteStart,6);
 assert.equal(board.panels[17].minuteEnd,90);
 assert.equal(board.homeName,'Northbridge FC');
 assert.equal(board.totalEvents,2);
});

test('panels carry the running score and their event kinds',()=>{
 const board=storyboardFromRecord(record([goal(8),goal(22,'away'),save(24)],[1,1]));
 assert.equal(board.panels[1].kind,'goal');
 assert.deepEqual(board.panels[1].score,[1,0]);
 assert.equal(board.panels[4].kind,'goal');
 assert.deepEqual(board.panels[4].score,[1,1]);
 assert.equal(board.panels[4].events.length,2);
 const quiet=board.panels.filter(panel=>panel.kind==='quiet');
 assert(quiet.length>0);
 assert.equal(quiet[0].events.length,0);
});

test('substitutions and chances get their own panel kinds',()=>{
 const sub={minute:11,side:'home' as const,kind:'sub' as const,line:'MID' as const,label:'Substitution',scorer:'Jae Rook',out:'Dima Orrin',homeName:'Northbridge FC',awayName:'Vale Athletic'};
 const chance={minute:13,side:'home' as const,kind:'chance' as const,line:'ATT' as const,label:'Off target',scorer:'Nero Pell',homeName:'Northbridge FC',awayName:'Vale Athletic'};
 const board=storyboardFromRecord(record([sub,chance]));
 assert.equal(board.panels[2].kind,'sub');
 assert.equal(board.panels[2].events[0].out,'Dima Orrin');
 assert.equal(board.panels[2].events[1].kind,'chance');
});

test('labels and summaries describe the beats',()=>{
 const board=storyboardFromRecord(record([goal(17),save(22)]));
 const goalPanel=board.panels[3];
 assert.equal(goalPanel.kind,'goal');
 assert(panelLabel(goalPanel).includes('Rui Dax'));
 assert.equal(panelLabel(board.panels[0]),'Quiet spell');
 const summary=storyboardSummary(board);
 assert.equal(summary.panels,18);
 assert.equal(summary.goals,1);
 assert.equal(summary.beats,2);
 assert.deepEqual(summary.score,[0,0]);
});

test('a record without a timeline still yields an empty quiet board',()=>{
 const board=storyboardFromRecord(record([]));
 assert.equal(board.panels.length,18);
 assert.equal(board.totalEvents,0);
 assert.equal(storyboardBeats(board).length,0);
 assert(board.panels.every(panel=>panel.kind==='quiet'));
});
