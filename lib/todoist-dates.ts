import {clockInZone,localDay,zonedTime} from './model.ts';

type Due=Record<string,unknown>;
const fixedTime=(date:string)=>/T/.test(date)&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(date);

/** Floating Todoist times belong to their written day; fixed times are instants. */
export function todoistWorkDay(due:Due|null|undefined,timezone:string):string {
 const date=typeof due?.date==='string'?due.date:'';
 if(!date)return '';
 return fixedTime(date)?localDay(date,timezone):date.slice(0,10);
}

export function todoistWorkTime(due:Due|null|undefined,timezone:string):string {
 const date=typeof due?.date==='string'?due.date:'';
 if(!date.includes('T'))return '';
 return fixedTime(date)?clockInZone(date,timezone):date.slice(11,16);
}

/** Move the planner's day without discarding the provider's time or recurrence. */
export function rescheduleTodoistDue(due:Due|undefined,day:string,timezone:string,time?:string):Due|null {
 if(!day)return null;
 if(time!==undefined){
  const next:Due={...(due||{}),date:time?zonedTime(day,time,timezone):day};
  // Use an instant for a chosen clock time; retain the recurring rule separately.
  if(time)next.timezone=timezone;else if(due?.timezone!==undefined)next.timezone=null;
  return next;
 }
 let date=day;
 if(typeof due?.date==='string'&&due.date.includes('T')){
  if(fixedTime(due.date)){
   const original=new Date(due.date);
   date=new Date(Date.parse(zonedTime(day,clockInZone(original,timezone),timezone))+original.getUTCSeconds()*1000+original.getUTCMilliseconds()).toISOString();
  }else date=day+due.date.slice(10);
 }
 return {...(due||{}),date};
}

/** Todoist deadlines carry only a day; preserve the locally chosen clock even when that day moves. */
export function todoistDeadline(day:string|undefined,previous:string|undefined,timezone:string):string {
 if(!day)return '';
 if(previous&&Number.isFinite(Date.parse(previous))){if(localDay(previous,timezone)===day)return previous;const prior=new Date(previous);return new Date(Date.parse(zonedTime(day,clockInZone(prior,timezone),timezone))+prior.getUTCSeconds()*1000+prior.getUTCMilliseconds()).toISOString();}
 return zonedTime(day,'23:59',timezone);
}
