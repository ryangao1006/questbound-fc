import test from 'node:test';
import assert from 'node:assert/strict';
import ICAL from 'ical.js';
import {parseICS,writeEventTimes,mergeCalendarBlocks} from '../lib/ical.ts';
import {initialState,zonedTime,localDay} from '../lib/model.ts';
import {reduceCommand,occurrences} from '../lib/domain.ts';
const from=new Date('2026-11-01'),to=new Date('2026-12-01');
function parse(body:string){return parseICS(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`,'cal','https://caldav.icloud.com/test.ics','v1',false,from,to);}
const base='BEGIN:VEVENT\r\nUID:all-day-test\r\nSUMMARY:Holiday\r\nDTSTART;VALUE=DATE:20261115\r\nDTEND;VALUE=DATE:20261118\r\nEND:VEVENT';
test('Apple DATE imports retain civil dates and exclusive end in every host timezone',()=>{
 for(const zone of ['UTC','America/Los_Angeles','Asia/Shanghai']){const old=process.env.TZ;try{process.env.TZ=zone;const [b]=parse(base);assert.equal(b.allDay,true);assert.equal(b.start,zonedTime('2026-11-15','00:00'));assert.equal(b.end,zonedTime('2026-11-18','00:00'));}finally{process.env.TZ=old;}}
});
test('all-day writer round-trips, timed conversions remove old DATE and TZID parameters',()=>{
 const c=new ICAL.Component(ICAL.parse(base));
 writeEventTimes(c,zonedTime('2026-11-20','00:00'),zonedTime('2026-11-22','00:00'),true);
 assert.match(c.toString(),/DTSTART;VALUE=DATE:20261120/);assert.equal(parse(c.toString())[0].end,zonedTime('2026-11-22','00:00'));
 writeEventTimes(c,'2026-11-20T09:00:00.000Z','2026-11-20T10:00:00.000Z',false);
 assert.doesNotMatch(c.toString(),/VALUE=DATE|TZID=/);assert.equal(parse(c.toString())[0].allDay,false);
 assert.equal(parse(c.toString())[0].start,'2026-11-20T09:00:00.000Z');
 writeEventTimes(c,zonedTime('2026-11-21','00:00'),zonedTime('2026-11-22','00:00'),true);
 assert.equal(localDay(parse(c.toString())[0].start),'2026-11-21');
});
test('missing all-day DTEND defaults to one day and recurring exceptions retain type',()=>{
 const [b]=parse(base.replace('DTEND;VALUE=DATE:20261118\r\n',''));assert.equal(b.end,zonedTime('2026-11-16','00:00'));
 const rows=parse(base.replace('DTEND;VALUE=DATE:20261118','DTEND;VALUE=DATE:20261116\r\nRRULE:FREQ=WEEKLY;COUNT=2')+'\r\nBEGIN:VEVENT\r\nUID:all-day-test\r\nRECURRENCE-ID;VALUE=DATE:20261122\r\nDTSTART:20261122T090000Z\r\nDTEND:20261122T100000Z\r\nSUMMARY:Timed exception\r\nEND:VEVENT');
 assert.equal(rows.length,2);assert.equal(rows[0].allDay,true);assert.equal(rows[1].allDay,false);
});
test('local create/edit/delete retains all-day flag and queues iCloud operations',()=>{
 let s=initialState();const b={id:'day',title:'Test',area:'Projects',allDay:true,start:zonedTime('2026-11-15','00:00'),end:zonedTime('2026-11-16','00:00'),repeat:'none',exceptions:{},calendarId:'cal',remoteId:'https://caldav.icloud.com/test.ics'};
 s=reduceCommand(s,{type:'block.save',block:b});assert.equal(s.blocks[0].allDay,true);assert.equal(s.outbox[0].action,'block.upsert');
 s=reduceCommand(s,{type:'block.save',block:{...s.blocks[0],allDay:false,start:'2026-11-15T09:00:00Z',end:'2026-11-15T10:00:00Z'}});assert.equal(s.blocks[0].allDay,false);
 s=reduceCommand(s,{type:'block.delete',id:'day'});assert.equal(s.blocks.length,0);assert.ok(s.outbox.some(o=>o.action==='block.delete'));
});
test('remote edits and deletion reconcile without reviving a pending local edit',()=>{
 const first=parse(base);const edited=parse(base.replace('SUMMARY:Holiday','SUMMARY:Edited in Apple'));
 assert.equal(mergeCalendarBlocks(first,edited,new Set())[0].title,'Edited in Apple');
 assert.equal(mergeCalendarBlocks(first,edited,new Set([first[0].id]))[0].title,'Holiday');
 assert.equal(mergeCalendarBlocks(first,[],new Set(),{from,to,verifiedResources:new Set(),deletedResources:new Set([first[0].remoteId!])}).length,0);
});
test('local recurring occurrence converts to all-day without converting whole series',()=>{
 let s=reduceCommand(initialState(),{type:'block.save',block:{id:'r',title:'Repeat',start:'2026-11-15T09:00:00Z',end:'2026-11-15T10:00:00Z',repeat:'weekly',exceptions:{}}});
 const row=occurrences(s.blocks[0],from,to)[1];s=reduceCommand(s,{type:'block.save',block:{...row,allDay:true,start:zonedTime('2026-11-22','00:00'),end:zonedTime('2026-11-23','00:00')}});
 const rows=occurrences(s.blocks[0],from,to);assert.equal(rows[0].allDay,undefined);assert.equal(rows[1].allDay,true);
});
