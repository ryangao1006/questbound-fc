import type {PlannerState,Task} from './model.ts';
export type JournalView='cards'|'board'|'agenda'|'subjects';
export type JournalSort='priority'|'planned'|'deadline'|'estimate'|'newest';
export type JournalPrefs={view:JournalView;sort:JournalSort};
export const JOURNAL_DEFAULTS:JournalPrefs={view:'cards',sort:'priority'};
export function readJournalPrefs(raw:string|null):JournalPrefs{try{const p=JSON.parse(raw||'null');return {view:['cards','board','agenda','subjects'].includes(p?.view)?p.view:'cards',sort:['priority','planned','deadline','estimate','newest'].includes(p?.sort)?p.sort:'priority'}}catch{return {...JOURNAL_DEFAULTS}}}
export const subjectKey=(task:Pick<Task,'subjectId'|'area'|'listId'>)=>task.subjectId||(!task.area||task.area==='No subject'?'none':`legacy:${task.listId}:${task.area}`);
export function filterJournal(tasks:Task[],filter:{status:string;part:string;subject:string;query:string;scope:string;today:string}){const q=filter.query.trim().toLocaleLowerCase();return tasks.filter(t=>!t.deletedAt&&(filter.status==='done'?t.done:!t.done)&&(filter.status!=='review'||t.needsReview)&&(filter.part==='All'||t.listId===filter.part)&&(filter.subject==='All'||subjectKey(t)===filter.subject)&&(filter.scope==='all'||filter.scope==='today'&&t.plannedOn===filter.today||filter.scope==='main'&&t.main||filter.scope==='unplanned'&&!t.plannedOn)&&(!q||[t.title,t.notes,...t.subtasks.map(s=>s.title)].join(' ').toLocaleLowerCase().includes(q)))}
const dateOrder=(value:string)=>value||'9999';
export function sortJournal(tasks:Task[],sort:JournalSort){return [...tasks].sort((a,b)=>{
 const specific=sort==='planned'?dateOrder(a.plannedOn).localeCompare(dateOrder(b.plannedOn)):sort==='deadline'?dateOrder(a.deadlineConfirmed?a.deadline:'').localeCompare(dateOrder(b.deadlineConfirmed?b.deadline:'')):sort==='estimate'?a.estimate-b.estimate:sort==='newest'?b.createdAt.localeCompare(a.createdAt):Number(b.main)-Number(a.main)||b.priority-a.priority;
 return specific||dateOrder(a.plannedOn).localeCompare(dateOrder(b.plannedOn))||a.id.localeCompare(b.id);
})}
export function boardJournal(tasks:Task[]){return [{id:'main',title:'Starting XI',hint:'Your main priorities',tasks:tasks.filter(t=>t.main)},{id:'scheduled',title:'Match schedule',hint:'A work day is set',tasks:tasks.filter(t=>!t.main&&t.plannedOn)},{id:'bench',title:'On the bench',hint:'Ready when you are',tasks:tasks.filter(t=>!t.main&&!t.plannedOn)}]}
export function agendaJournal(tasks:Task[],timezone:string){const groups=new Map<string,{id:string;day:string;kind:'work'|'deadline'|'none';tasks:Task[]}>();for(const task of tasks){let day=task.plannedOn,kind:'work'|'deadline'|'none'='work';if(!day&&task.deadline&&task.deadlineConfirmed){day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(task.deadline));kind='deadline'}if(!day)kind='none';const id=`${day||'9999'}:${kind}`;if(!groups.has(id))groups.set(id,{id,day,kind,tasks:[]});groups.get(id)!.tasks.push(task)}return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id))}
export function journalSubjects(state:PlannerState,tasks:Task[],part='All'){
 const groups=new Map<string,{key:string;title:string;listId:string;tasks:Task[]}>();for(const s of state.subjects.filter(s=>!s.archived&&(part==='All'||s.listId===part)&&!state.lists.find(l=>l.id===s.listId)?.archived))groups.set(s.id,{key:s.id,title:s.title,listId:s.listId,tasks:[]});
 for(const task of tasks){const key=subjectKey(task),groupKey=key==='none'?`${task.listId}:none`:key;if(!groups.has(groupKey))groups.set(groupKey,{key,title:task.area||'No subject',listId:task.listId,tasks:[]});groups.get(groupKey)!.tasks.push(task)}return [...groups.values()];
}
export function dayAfter(day:string,amount:number){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10)}
export function nextMonday(day:string){const weekday=new Date(`${day}T12:00:00Z`).getUTCDay();return dayAfter(day,((8-weekday)%7)||7)}
export function subjectColour(key:string){let hash=0;for(const char of key)hash=(hash*31+char.charCodeAt(0))>>>0;return ['#8ec5ff','#d4b0ff','#7edbc0','#f4c878','#ffacb4','#a6d67d'][hash%6]}

export function calendarGrid(month:string){const first=month.slice(0,7)+"-01",weekday=new Date(first+"T12:00:00Z").getUTCDay(),start=dayAfter(first,-((weekday+6)%7));return Array.from({length:42},(_,index)=>dayAfter(start,index))}
