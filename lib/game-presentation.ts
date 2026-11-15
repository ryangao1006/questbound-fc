let viewers=0;
const listeners=new Set<()=>void>();
export const gamePresentationActive=()=>viewers>0;
export const subscribeGamePresentation=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
/** Suspend decorative player canvases while a game owns the screen. */
export function acquireGamePresentation(){viewers++;listeners.forEach(f=>f());let released=false;return()=>{if(released)return;released=true;viewers=Math.max(0,viewers-1);listeners.forEach(f=>f())}}
