import ICAL from "ical.js";
import {localDay,zonedTime} from "./model.ts";
import type {TimeBlock} from "./model.ts";
function registerZones(root:ICAL.Component){for(const zone of root.getAllSubcomponents("vtimezone")){const id=zone.getFirstPropertyValue("tzid");if(typeof id==="string")ICAL.TimezoneService.register(new ICAL.Timezone(zone),id);}}
export function parseICS(data:string,calendarId:string,url:string,etag:string|undefined,readOnly:boolean,from:Date,to:Date){const root=new ICAL.Component(ICAL.parse(data));registerZones(root);const components=root.getAllSubcomponents("vevent");const blocks:TimeBlock[]=[];for(const component of components.filter(c=>!c.hasProperty("recurrence-id"))){const event=new ICAL.Event(component,{strictExceptions:true});for(const exception of components.filter(c=>c.hasProperty("recurrence-id")&&c.getFirstPropertyValue("uid")===event.uid))event.relateException(new ICAL.Event(exception));const convert=(start:ICAL.Time,end:ICAL.Time,occurrenceKey?:string,summary=event.summary)=>{const a=new Date(calendarInstant(start)),b=new Date(calendarInstant(end));if(b<from||a>=to)return;blocks.push({id:`ical:${encodeURIComponent(calendarId+"|"+url)}:${event.uid}:${occurrenceKey||"single"}`,title:summary||"Calendar event",area:"Projects",start:a.toISOString(),end:b.toISOString(),repeat:"none",exceptions:{},calendarId,remoteId:url,etag,readOnly,icalUid:event.uid,occurrenceKey,allDay:start.isDate});};if(event.isRecurring()){const iter=event.iterator();let next:ICAL.Time|null;let count=0;while((next=iter.next())&&count++<10000){if(next.toJSDate()>=to)break;const detail=event.getOccurrenceDetails(next);convert(detail.startDate,detail.endDate,next.toString(),detail.item.summary);}}else convert(event.startDate,event.endDate);}return blocks;}

export function mergeCalendarBlocks(existing:TimeBlock[],incoming:TimeBlock[],pendingIds:Set<string>,refresh?:{from:Date;to:Date;verifiedResources:Set<string>;deletedResources:Set<string>}){
 const byId=new Map(existing.map(b=>[b.id,b]));const convertedResources=new Set(incoming.map(b=>b.remoteId));const incomingIds=new Set(incoming.map(b=>b.id));const merged:TimeBlock[]=[];
 for(const b of existing){
  if(pendingIds.has(b.id)){merged.push(b);continue;}
  if(b.remoteId&&refresh?.deletedResources.has(b.remoteId))continue;
  if(b.calendarId&&!b.id.startsWith("ical:")&&convertedResources.has(b.remoteId)){
   if(refresh&&b.repeat!=="none"&&Date.parse(b.start)<refresh.from.getTime())merged.push({...b,id:`history:${b.id}`,until:new Date(refresh.from.getTime()-1).toISOString(),calendarId:undefined,remoteId:undefined,readOnly:true});
   continue;
  }
  if(b.id.startsWith("ical:")&&b.remoteId&&refresh?.verifiedResources.has(b.remoteId)&&Date.parse(b.start)<refresh.to.getTime()&&Date.parse(b.end)>refresh.from.getTime()&&!incomingIds.has(b.id))continue;
  merged.push(b);
 }
 const map=new Map(merged.map(b=>[b.id,b]));for(const b of incoming){const old=byId.get(b.id)||existing.find(x=>x.remoteId===b.remoteId&&x.icalUid===b.icalUid);if(pendingIds.has(b.id)||old&&pendingIds.has(old.id))continue;map.set(b.id,{...b,taskId:old?.taskId,area:old?.taskId?old.area:b.area});}return [...map.values()];
}

// DATE values are civil dates, never host-timezone instants.
export function calendarInstant(value:ICAL.Time){return value.isDate?zonedTime(value.toString(),"00:00"):value.toJSDate().toISOString();}
export function writeEventTimes(component:ICAL.Component,start:string,end:string,allDay=false){
 // Recreate properties so switching DATE/DATE-TIME cannot retain TZID or VALUE.
 component.removeAllProperties("dtstart");component.removeAllProperties("dtend");component.removeAllProperties("duration");
 component.addPropertyWithValue("dtstart",allDay?ICAL.Time.fromDateString(localDay(start)):ICAL.Time.fromJSDate(new Date(start),true));
 component.addPropertyWithValue("dtend",allDay?ICAL.Time.fromDateString(localDay(end)):ICAL.Time.fromJSDate(new Date(end),true));
}
