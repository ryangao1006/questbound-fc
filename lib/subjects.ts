import type {PlannerState,Task,Subject,PlannerList,OutboxItem} from './model.ts';
export const subjectChoices=(s:PlannerState,listId?:string)=>s.subjects.filter(x=>!x.archived&&(!listId||x.listId===listId)&&!s.lists.find(l=>l.id===x.listId)?.archived);
export function areaNames(s:PlannerState){return [...new Set([...subjectChoices(s).map(x=>x.title),...s.tasks.filter(t=>!t.deletedAt).map(t=>t.area),...s.sessions.map(t=>t.area),...s.blocks.map(t=>t.area),...s.habits.map(t=>t.area)])];}
export function bindTaskSubject(s:PlannerState,task:Task,explicit=false){
 const list=s.lists.find(l=>l.id===task.listId&&!l.archived);if(!list)throw new Error('Choose an active part.');
 if(task.subjectId){const subject=s.subjects.find(x=>x.id===task.subjectId&&!x.archived&&x.listId===list.id);if(!subject)throw new Error('Choose a subject from the selected part.');task.area=subject.title;}
 else if(!explicit){const subject=subjectChoices(s,list.id).find(x=>x.title===task.area);if(subject)task.subjectId=subject.id;else if(list.mode==='sync')task.area='No subject';}
 if(explicit&&!task.subjectId&&list.mode==='sync')task.area='No subject';return task;
}
export function renameSubject(s:PlannerState,subject:Subject,title:string){const old=subject.title;subject.title=title;const taskIds=new Set(s.tasks.filter(t=>t.subjectId===subject.id).map(t=>{t.area=title;return t.id}));for(const b of s.blocks)if(b.subjectId===subject.id||b.taskId&&taskIds.has(b.taskId)){b.area=title;b.subjectId=subject.id}for(const r of s.sessions)if(r.subjectId===subject.id||r.taskId&&taskIds.has(r.taskId)){r.area=title;r.subjectId=subject.id}if(s.activeSession&&(s.activeSession.subjectId===subject.id||s.activeSession.taskId&&taskIds.has(s.activeSession.taskId))){s.activeSession.area=title;s.activeSession.subjectId=subject.id}for(const h of s.habits)if(h.subjectId===subject.id)h.area=title;if(s.settings.mutedAreas.includes(old)&&!s.settings.mutedAreas.includes(title))s.settings.mutedAreas.push(title);}
export function queueTodoist(s:PlannerState,action:string,entityId:string,payload:Record<string,unknown>,now:Date){
 const tail=[...s.outbox].reverse().find(o=>o.provider==='todoist'&&o.entityId===entityId);const previous=tail?.action===action&&!tail.attemptedAt&&tail.attempts===0?tail:undefined;
 if(previous){previous.payload={...previous.payload,...structuredClone(payload),...(Array.isArray(payload.fields)?{fields:[...new Set([...(previous.payload.fields as string[]||[]),...payload.fields])]}:{}),...(previous.payload.baseTitle!==undefined?{baseTitle:previous.payload.baseTitle}:{})};previous.nextAttempt=now.toISOString();return previous;}
 const job:OutboxItem={id:crypto.randomUUID(),provider:'todoist',entityId,action,payload:structuredClone(payload),attempts:0,nextAttempt:now.toISOString(),status:'pending'};s.outbox.push(job);return job;
}
export function taskSyncPayload(task:Task,before?:Task){const keys=['title','notes','priority','plannedOn','plannedTime','deadline','deadlineConfirmed','listId','subjectId'] as const;const fields=keys.filter(k=>!before||task[k]!==before[k]);return {task:structuredClone(task),fields};}
export function partForSubject(s:PlannerState,subject:Subject):PlannerList{const part=s.lists.find(l=>l.id===subject.listId);if(!part)throw new Error('Choose an active part.');return part;}
