import {localDay,zonedTime,clockInZone,type PlannerState,type Task} from './model.ts';

export const validDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;
export const shiftDay=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const skippedTaskDay=(task:Task,day:string)=>!!task.skipHistory?.some(entry=>!entry.undoneAt&&entry.fromDay===day);
export function reminderEligible(state:PlannerState,task:Task){return !task.done&&!task.deletedAt&&!task.needsReview&&task.reminders&&!state.settings.mutedAreas.includes(task.area)&&!state.lists.find(l=>l.id===task.listId)?.archived;}
/** A missed suggested day is a review item, never a confirmed overdue deadline. */
export function carryoverTasks(state:PlannerState,day=localDay(new Date(),state.settings.timezone)){
 return state.tasks.filter(task=>reminderEligible(state,task)&&task.carryoverReviewedOn!==day&&(
  !!task.plannedOn&&task.plannedOn<day||
  !!task.deadline&&task.deadlineConfirmed&&localDay(task.deadline,state.settings.timezone)<day||
  !task.plannedOn&&state.blocks.some(block=>block.taskId===task.id&&block.repeat==='none'&&localDay(block.end,state.settings.timezone)<day&&!skippedTaskDay(task,localDay(block.start,state.settings.timezone)))
 ));
}
export function carryoverReminderAt(state:PlannerState,day:string,now:Date){
 let at=zonedTime(day,state.settings.carryoverTime,state.settings.timezone),clock=clockInZone(at,state.settings.timezone);
 const a=state.settings.quietStart,b=state.settings.quietEnd;
 if(a!==b&&(a>b?clock>=a||clock<b:clock>=a&&clock<b))at=zonedTime(a>b&&clock>=a?shiftDay(day,1):day,b,state.settings.timezone);
 // Catch up once after a service outage; restoring must never replay an old morning.
 if(Date.parse(at)<Date.parse(state.lastRestoredAt||'1970-01-01'))return null;
 if(Date.parse(at)<now.getTime()-15*60000)at=now.toISOString();
 return at;
}
export const needsFreshTaskVerification=(kind:string)=>['follow','daily','carryover'].includes(kind);

/** Recognise unambiguous rules only. Complex provider rules require the user's next date. */
export function suggestedNextOccurrence(task:Task):string{
 if(!task.recurring||!validDay(task.plannedOn))return '';
 const raw=String(task.remoteDue?.string||'').toLowerCase().trim();
 const rule=raw.replace(/\s+(?:at|@)\s+.*$/,'').replace(/[!！]/g,'').replace(/\s+/g,' ').trim();
 let days=0;
 if(/^(?:every day|everyday|daily|每天|每日)$/.test(rule))days=1;
 else if(/^(?:every week|weekly|每周|每星期)$/.test(rule))days=7;
 else {const match=rule.match(/^every (\d+) (days?|weeks?)$/)||rule.match(/^每(\d+)(天|周|星期)$/);if(match)days=Number(match[1])*(/week|周|星期/.test(match[2])?7:1);}
 if(days>0&&days<=3660)return shiftDay(task.plannedOn,days);
 let weekdays:number[]=[];
 if(/^(?:every weekday|every weekdays|weekdays|每个工作日|每工作日|工作日)$/.test(rule))weekdays=[1,2,3,4,5];
 else if(/^(?:every weekend|every weekends|weekends|每个周末|每周末)$/.test(rule))weekdays=[0,6];
 else if(/^every (?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:(?:, | and | & )(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))*$/.test(rule)){
  const names=['sun','mon','tue','wed','thu','fri','sat'];weekdays=(rule.match(/sun|mon|tue|wed|thu|fri|sat/g)||[]).map(name=>names.indexOf(name));
 }else {const zh=rule.match(/^每(?:周|星期)([一二三四五六日天])$/);if(zh)weekdays=[{'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0}[zh[1]]!];}
 if(weekdays.length)for(let n=1;n<=7;n++){const day=shiftDay(task.plannedOn,n);if(weekdays.includes(new Date(day+'T12:00:00Z').getUTCDay()))return day;}
 // Preserve the original day for monthly/yearly intervals; don't silently clamp the 31st.
 const monthly=/^(?:every month|monthly|每月)$/.test(rule),yearly=/^(?:every year|yearly|annually|每年)$/.test(rule);
 if(monthly||yearly){const start=new Date(task.plannedOn+'T12:00:00Z'),wanted=start.getUTCDate();for(let n=1;n<=48;n++){const next=new Date(start);next.setUTCDate(1);next.setUTCMonth(start.getUTCMonth()+n*(yearly?12:1));next.setUTCDate(wanted);if(next.getUTCDate()===wanted&&next.getUTCMonth()===(start.getUTCMonth()+n*(yearly?12:1))%12)return next.toISOString().slice(0,10);}}
 return '';
}
