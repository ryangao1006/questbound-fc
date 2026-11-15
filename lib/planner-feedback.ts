import {activeSeconds,type ActiveSession,type PlannerState} from './model.ts';
export function focusPresentation(active:ActiveSession,now:Date){
 const elapsed=activeSeconds(active,now),remaining=Math.max(0,active.target-elapsed);
 return {elapsed,remaining,clock:`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`,progress:Math.min(100,elapsed/active.target*100),status:remaining===0?'Ready to save':active.pausedAt?'Paused':'Training in progress',xpEligible:elapsed>=1200};
}
export function syncFeedback(state:PlannerState,saveStatus:string,unavailable=false){
 const pending=state.outbox.length;
 if(saveStatus==='Saving…')return {label:'Saving…',detail:'Saving this change to your planner.',tone:'saving',pending};
 if(saveStatus==='Conflict')return {label:'Conflict',detail:'Review the latest saved version before retrying your change.',tone:'error',pending};
 if(saveStatus==='Sync needs attention')return {label:'Sync needs attention',detail:'Saved on this device. Review the interrupted cloud upload in Settings.',tone:'error',pending};
 if(saveStatus==='Reward confirming')return {label:'Saved on this device',detail:'Reward confirming: XP and funds appear once the private site accepts the change.',tone:'pending',pending};
 if(saveStatus==='Not saved')return {label:'Not saved',detail:'This change is not saved yet. Retry it when the connection returns.',tone:'error',pending};
 if(saveStatus==='Local saved')return {label:'Local saved',detail:'Saved on this device. It reaches your private site when the connection returns.',tone:'pending',pending};
 if(saveStatus==='Pending sync')return {label:'Pending sync',detail:'Saved on this device. Waiting for OneDrive to finish syncing.',tone:'pending',pending};
 if(unavailable)return {label:'Connection lost',detail:'Showing your last loaded data. Reconnect before making changes.',tone:'error',pending};
 if(state.outbox.some(o=>o.conflict))return {label:'Sync needs attention',detail:'Your planner is saved. Review a connection conflict in Settings.',tone:'error',pending};
 if(state.outbox.some(o=>o.status==='error')||Object.values(state.connections).some(c=>c?.error))return {label:'Sync needs attention',detail:'Your planner is saved. A connected service needs attention in Settings.',tone:'error',pending};
 if(state.settings.integrationsPaused)return {label:'Connections paused',detail:'Your planner is saved. Resume connections in Settings when ready.',tone:'pending',pending};
 if(pending)return {label:'Pending sync',detail:'Saved in your planner. Connected apps are still catching up.',tone:'pending',pending};
 if(saveStatus==='Cloud synced')return {label:'Cloud synced',detail:'Saved to OneDrive. Other devices can retrieve this version.',tone:'saved',pending};
 return {label:'Saved',detail:'Your planner is saved. No connection changes are waiting.',tone:'saved',pending};
}
