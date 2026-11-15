/** Pure budgeting helpers for long task lists: render a first window, then grow. */
export function takeWithin<T>(items:T[],budget:number){
 const take=Math.max(0,Math.min(items.length,budget));
 return {taken:items.slice(0,take),left:Math.max(0,budget-take),hidden:items.length-take};
}
/** Slice groups in display order while a single row budget lasts, keeping group identity. */
export function budgetGroups<T extends {tasks:unknown[]}>(groups:T[],budget:number){
 let remaining=Math.max(0,budget),hidden=0;
 const shown=groups.map(group=>{
  const {taken,left,hidden:hiddenHere}=takeWithin(group.tasks,remaining);
  remaining=left;hidden+=hiddenHere;
  return {...group,tasks:taken};
 });
 return {groups:shown as T[],hidden};
}
