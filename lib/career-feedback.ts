import {totalXP,level,localDay,type PlannerState,type Command} from './model.ts';
export const CAREER_REWARDS=[
 {id:'boots',name:'First-team boots',level:2},
 {id:'kit',name:'The away kit',level:3},
 {id:'armband',name:"Captain's armband",level:4},
 {id:'celebration',name:'Signature celebration',level:5},
 {id:'goldboots',name:'Golden boots',level:6},
 {id:'banner',name:'Club legend banner',level:7},
] as const;
export function careerProgress(state:PlannerState){
 const xp=totalXP(state),rank=level(state),milestones=CAREER_REWARDS.map(item=>({...item,available:rank>=item.level||state.settings.unlocked.includes(item.id),claimed:state.settings.unlocked.includes(item.id),equipped:state.settings.equipped.includes(item.id),remaining:Math.max(0,(item.level-1)*100-xp)}));
 return {xp,rank,progress:xp%100,toNextLevel:100-xp%100,phase:rank>=7?'Complete kit collection':rank>=4?'Signature collection':rank>=2?'First equipment unlocks':'Academy kit collection',next:milestones.find(item=>!item.available),ready:milestones.filter(item=>item.available&&!item.claimed),milestones};
}
export function confirmedCareerFeedback(before:PlannerState,after:PlannerState,command:Command){
 let id='';if(command.type==='task.toggle'&&command.done){const task=after.tasks.find(t=>t.id===command.id);if(task)id=`task:${task.id}${task.recurring?':'+task.occurrence:''}`;}
 if(command.type==='habit.toggle'&&command.done)id=`habit:${command.id}:${command.day}`;
 if(command.type==='focus.finish'&&before.activeSession)id=`session:${before.activeSession.id}`;
 const reward=after.rewards.find(r=>r.id===id&&r.active);if(!reward||before.rewards.some(r=>r.id===id&&r.active))return null;
 return {id,points:reward.points,levelUp:level(after)>level(before),level:level(after),kind:command.type==='focus.finish'?'focus' as const:'complete' as const};
}
export function hasSavedFocusSession(before:PlannerState,after:PlannerState){return !!before.activeSession&&after.sessions.some(session=>session.id===before.activeSession!.id&&session.seconds>0)}
export function coachFeedback(state:PlannerState,now=new Date()):{key:string;values:unknown[]}{
 if(state.activeSession)return {key:state.activeSession.pausedAt?'Your session is paused. Take the time you need.':'One session at a time. Keep your attention on one quest.',values:[]};
 const today=localDay(now,state.settings.timezone),done=state.tasks.filter(t=>t.done&&!t.deletedAt&&t.completedAt&&localDay(t.completedAt,state.settings.timezone)===today).length;
 return done?{key:'{0} quests recorded today. Take a breath before your next goal.',values:[done]}:{key:'Choose one manageable quest. Rest days keep your progress safe.',values:[]};
}
