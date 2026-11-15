import type {PlannerState,Task} from './model.ts';

export const TASK_COLUMNS=['subject','part','planned','deadline','duration','priority','notes'] as const;
export type TaskColumn=typeof TASK_COLUMNS[number];
export type TaskDisplay={version:1|2;view:'board'|'list'|'details';columns:TaskColumn[];sort:'planned'|'deadline'|'priority'|'subject'|'part'|'duration'|'created';direction:'asc'|'desc';group:'none'|'subject'|'part'|'day';boardOrderMode?:'auto'|'manual';subjectOrder?:string[]};
export const defaultTaskDisplay=():TaskDisplay=>({version:2,view:'board',columns:['subject','planned','priority','notes'],sort:'planned',direction:'asc',group:'subject'});
export function migrateTaskDisplay(value?:Partial<TaskDisplay>):TaskDisplay{const next={...defaultTaskDisplay(),...value};return value?.version===1?{...next,version:2,view:'board',columns:JSON.stringify(value.columns)===JSON.stringify(['subject','planned','priority'])?[...(value.columns||[]),'notes']:next.columns,group:next.group==='none'?'subject':next.group}:next;}
export function validTaskDisplay(p:unknown):p is TaskDisplay{if(!p||typeof p!=='object')return false;const v=p as TaskDisplay;return [1,2].includes(v.version)&&['board','list','details'].includes(v.view)&&Array.isArray(v.columns)&&new Set(v.columns).size===v.columns.length&&v.columns.every(x=>TASK_COLUMNS.includes(x))&&['planned','deadline','priority','subject','part','duration','created'].includes(v.sort)&&['asc','desc'].includes(v.direction)&&['none','subject','part','day'].includes(v.group)&&(v.boardOrderMode===undefined||['auto','manual'].includes(v.boardOrderMode))&&(v.subjectOrder===undefined||Array.isArray(v.subjectOrder)&&v.subjectOrder.length<=2000&&new Set(v.subjectOrder).size===v.subjectOrder.length&&v.subjectOrder.every(k=>typeof k==='string'&&k.length>0&&k.length<=500))}
export function workspaceTasks(state:PlannerState,p:TaskDisplay,filter:{status:string;today:string;query:string;part:string;subject:string}){
 const query=filter.query.trim().toLocaleLowerCase();
 const tasks=state.tasks.filter(t=>!t.deletedAt&&(filter.status==='completed'||!state.lists.find(l=>l.id===t.listId)?.archived)&&(filter.status==='completed'?t.done:!t.done)&&(filter.status!=='today'||t.plannedOn===filter.today)&&(filter.status!=='upcoming'||t.plannedOn>filter.today)&&(filter.status!=='unscheduled'||!t.plannedOn)&&(filter.status!=='review'||t.needsReview)&&(filter.part==='All'||t.listId===filter.part)&&(filter.subject==='All'||(t.subjectId||'none')===filter.subject)&&(!query||[t.title,t.notes,...t.subtasks.map(s=>s.title)].join(' ').toLocaleLowerCase().includes(query)));
 const value=(t:Task):string|number|undefined=>{switch(p.sort){case'planned':return t.plannedOn?`${t.plannedOn}T${t.plannedTime||'24:00'}`:undefined;case'deadline':return t.deadlineConfirmed&&t.deadline?t.deadline:undefined;case'priority':return t.priority;case'subject':return t.subjectId?state.subjects.find(s=>s.id===t.subjectId)?.title:undefined;case'part':return state.lists.find(l=>l.id===t.listId)?.title;case'duration':return t.estimate||undefined;case'created':return t.createdAt||undefined}};
 return tasks.sort((a,b)=>{const x=value(a),y=value(b);if(x===undefined||y===undefined)return x===y?a.id.localeCompare(b.id):x===undefined?1:-1;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),state.settings.language==='zh'?'zh-CN':'en');return (p.direction==='desc'?-cmp:cmp)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)});
}
export function workspaceGroups(state:PlannerState,tasks:Task[],group:TaskDisplay['group']){const groups=new Map<string,{key:string;title:string;tasks:Task[]}>();for(const task of tasks){const key=group==='subject'?task.subjectId||'none':group==='part'?task.listId:group==='day'?task.plannedOn||'none':'all';const title=group==='subject'?state.subjects.find(s=>s.id===key)?.title||'No subject':group==='part'?state.lists.find(l=>l.id===key)?.title||'Part':group==='day'?task.plannedOn||'Unscheduled':'Tasks';if(!groups.has(key))groups.set(key,{key,title,tasks:[]});groups.get(key)!.tasks.push(task)}return [...groups.values()]}

export type WorkspaceColumn={key:string;title:string;listId?:string;subjectId?:string;day?:string;tasks:Task[]};
export function workspaceBoard(state:PlannerState,tasks:Task[],part:string,subject:string,group:TaskDisplay['group'],today:string):WorkspaceColumn[]{
 const columns=new Map<string,WorkspaceColumn>(),mode=group==='none'?'subject':group;
 if(mode==='subject'){
  for(const s of state.subjects.filter(s=>!s.archived&&(part==='All'||s.listId===part)&&(subject==='All'||s.id===subject)&&!state.lists.find(l=>l.id===s.listId)?.archived))columns.set(s.id,{key:s.id,title:s.title,listId:s.listId,subjectId:s.id,tasks:[]});
  for(const list of state.lists.filter(l=>!l.archived&&(part==='All'||l.id===part)))if(subject==='All'||subject==='none')columns.set(`none:${list.id}`,{key:`none:${list.id}`,title:'No subject',listId:list.id,tasks:[]});
 }else if(mode==='part')for(const list of state.lists.filter(l=>!l.archived&&(part==='All'||l.id===part)))columns.set(list.id,{key:list.id,title:list.title,listId:list.id,tasks:[]});
 else for(const day of [today,new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10),''])columns.set(day,{key:day,title:day||'Unscheduled',day,tasks:[]});
 for(const task of tasks){const key=mode==='subject'?task.subjectId||`none:${task.listId}`:mode==='part'?task.listId:task.plannedOn||'';if(!columns.has(key))columns.set(key,{key,title:mode==='subject'?task.area:mode==='part'?state.lists.find(l=>l.id===key)?.title||'Part':key||'Unscheduled',listId:mode==='day'?undefined:task.listId,subjectId:mode==='subject'?task.subjectId:undefined,...(mode==='day'?{day:key}:{}),tasks:[]});columns.get(key)!.tasks.push(task);}
 return [...columns.values()];
}
export function columnTaskPatch(column:WorkspaceColumn,group:TaskDisplay['group']):Partial<Task>{
 if(group==='day')return {plannedOn:column.day||'',...(!column.day?{plannedTime:'',plannedEnd:''}:{})};
 return {listId:column.listId,subjectId:column.subjectId||'',area:column.subjectId?column.title:'No subject'};
}

/** Only rearranges presentation; columns and records are never mutated. */
export function orderSubjectColumns(columns:WorkspaceColumn[],prefs:Pick<TaskDisplay,'boardOrderMode'|'subjectOrder'>):WorkspaceColumn[]{
 if(prefs.boardOrderMode!=='manual')return [...columns.filter(c=>c.tasks.length>0),...columns.filter(c=>!c.tasks.length)];
 const rank=new Map((prefs.subjectOrder||[]).map((key,i)=>[key,i]));
 return [...columns].sort((a,b)=>(rank.get(a.key)??Infinity)-(rank.get(b.key)??Infinity));
}
/** Hidden subjects keep their place; new subjects append, and IDs never derive from names. */
export function moveSubjectColumn(saved:string[],keys:string[],id:string,target:string,after=false):string[]{
 const order=[...new Set([...saved,...keys])];
 if(id===target||!keys.includes(id)||!keys.includes(target))return order;
 const next=order.filter(key=>key!==id),at=next.indexOf(target);
 next.splice(at+(after?1:0),0,id);return next;
}
