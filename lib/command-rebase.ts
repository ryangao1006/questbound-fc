import type {Command,PlannerState} from './model.ts';
type Fields=Record<string,unknown>;
export type CommandPrecondition={type:string;id?:string;fields?:Fields};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const additions=['task.add','part.add','subject.add'];
function target(command:Command,state:PlannerState):Fields|undefined{
 if(command.type.startsWith('task.'))return state.tasks.find(x=>x.id===command.id&&!x.deletedAt) as unknown as Fields|undefined;
 if(command.type==='part.rename')return state.lists.find(x=>x.id===command.id&&!x.archived) as unknown as Fields|undefined;
 if(command.type==='subject.rename')return state.subjects.find(x=>x.id===command.id&&!x.archived) as unknown as Fields|undefined;
 if(command.type==='settings.update')return state.settings as unknown as Fields;
}
function desired(command:Command):Fields|undefined{
 if(command.type==='task.edit'||command.type==='settings.update')return command.patch as Fields;
 if(command.type==='task.toggle')return {done:command.done};
 if(command.type==='task.skip')return {plannedOn:command.nextDay,plannedTime:command.nextTime,occurrence:command.occurrence||undefined,done:false};
 if(command.type==='task.review.keep')return {carryoverReviewedOn:command.day};
 if(command.type==='part.rename'||command.type==='subject.rename')return {title:command.title};
}
/** Field preconditions allow unrelated background work without discarding real edits. */
export function commandPrecondition(command:Command,state:PlannerState):CommandPrecondition|null{
 if(additions.includes(command.type)){const entity=command[command.type.split('.')[0]] as {id?:string}|undefined;return entity?.id?{type:command.type,id:entity.id}:null;}
 const fields=desired(command),record=target(command,state);if(!fields||!record)return null;
 if(command.type==='task.edit'&&!command.base)return null;
 const base=(command.type==='task.edit'?command.base:record) as Fields;
 return {type:command.type,id:String(command.id||''),fields:Object.fromEntries(Object.keys(fields).map(k=>[k,base[k]]))};
}
export function matchesPrecondition(command:Command,condition:CommandPrecondition|null|undefined,state:PlannerState){
 if(!condition||condition.type!==command.type)return false;
 if(additions.includes(command.type)){const entity=command[command.type.split('.')[0]] as {id?:string}|undefined;return !!entity?.id&&condition.id===entity.id;}
 if(condition.id!==String(command.id||'')||!condition.fields||typeof condition.fields!=='object')return false;
 const fields=desired(command),record=target(command,state);return !!fields&&!!record&&Object.keys(fields).every(k=>same(record[k],condition.fields![k])||same(record[k],fields[k]));
}
export function canRebaseCommand(command:Command,before:PlannerState,after:PlannerState){return matchesPrecondition(command,commandPrecondition(command,before),after);}
