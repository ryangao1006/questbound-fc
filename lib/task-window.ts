import {zonedTime,localDay,clockInZone,type PlannerState,type Task} from './model.ts';

export function taskWindowMinutes(task:Pick<Task,'plannedOn'|'plannedTime'|'plannedEnd'>,timezone:string){
 if(!task.plannedEnd||!task.plannedOn||!task.plannedTime)return 0;
 return (Date.parse(task.plannedEnd)-Date.parse(zonedTime(task.plannedOn,task.plannedTime,timezone)))/60000;
}
export function validateTaskWindow(task:Pick<Task,'plannedOn'|'plannedTime'|'plannedEnd'>,timezone:string){
 if(!task.plannedEnd)return;
 const minutes=taskWindowMinutes(task,timezone);
 if(!Number.isFinite(Date.parse(task.plannedEnd))||!Number.isFinite(minutes)||minutes<5||minutes>1440)throw new Error('Choose a planned end 5 minutes to 24 hours after the start.');
}
/** A work-date move retains the explicitly planned window, separately from estimated effort. */
export function moveTaskWindow(before:Task,task:Task,timezone:string,explicitEnd=false){
 if(!task.plannedOn||!task.plannedTime){if(task.plannedEnd)task.plannedEnd='';return;}
 if(!explicitEnd&&before.plannedEnd&&(before.plannedOn!==task.plannedOn||before.plannedTime!==task.plannedTime)){
  const duration=taskWindowMinutes(before,timezone);
  if(duration>0)task.plannedEnd=new Date(Date.parse(zonedTime(task.plannedOn,task.plannedTime,timezone))+duration*60000).toISOString();
 }
 validateTaskWindow(task,timezone);
}
/** One private planner block per explicit task window; ordinary calendar blocks are independent. */
export function syncTaskWindow(state:PlannerState,task:Task){
 const id=`task-window:${task.id}`,existing=state.blocks.find(block=>block.id===id&&block.taskWindow);
 if(task.deletedAt||!task.plannedEnd||!task.plannedOn||!task.plannedTime){if(existing)state.blocks=state.blocks.filter(block=>block!==existing);return;}
 validateTaskWindow(task,state.settings.timezone);
 const block={id,taskWindow:true as const,title:task.title,area:task.area,subjectId:task.subjectId,taskId:task.id,start:zonedTime(task.plannedOn,task.plannedTime,state.settings.timezone),end:task.plannedEnd,repeat:'none' as const,exceptions:{}};
 if(existing)Object.assign(existing,block);else if(!state.blocks.some(b=>b.id===id))state.blocks.push(block);else throw new Error('This planning block changed. Refresh before saving.');
}
export function windowEndClock(task:Pick<Task,'plannedEnd'>,timezone:string){return task.plannedEnd?clockInZone(task.plannedEnd,timezone):'';}
export function windowEndsNextDay(task:Pick<Task,'plannedOn'|'plannedEnd'>,timezone:string){return !!task.plannedEnd&&localDay(task.plannedEnd,timezone)>task.plannedOn;}
