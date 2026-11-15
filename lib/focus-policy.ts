import type {Session} from './model.ts';

/**
 * Focus reward rule from PLAN 2.2: every 20 effective minutes earns 5 XP and
 * 10 funds, and the remainder carries across sessions ("两个 25 分钟场次获得两份
 * 奖励，并保留 10 分钟进度").
 *
 * This is applied forward-only: sessions that ended before the recorded
 * `economy.focus.from` keep the old per-session rule (5 XP / 10 funds once a
 * session reached 20 minutes), so no existing balance is rewritten.
 */
export const FOCUS_BUCKET_SECONDS=1200;
export const FOCUS_XP_PER_BUCKET=5;
export const FOCUS_FUNDS_PER_BUCKET=10;
export type FocusPlan={chunks:number;carrySeconds:number;xp:number;funds:number};
export function planFocus(seconds:number,carrySeconds=0):FocusPlan{
 const total=Math.max(0,Math.floor(carrySeconds||0))+Math.max(0,Math.floor(seconds||0));
 const chunks=Math.floor(total/FOCUS_BUCKET_SECONDS);
 return {chunks,carrySeconds:total%FOCUS_BUCKET_SECONDS,xp:chunks*FOCUS_XP_PER_BUCKET,funds:chunks*FOCUS_FUNDS_PER_BUCKET};
}
/** Carry state after replaying the sessions that ended at or after the cutoff. */
export function focusCarryAfter(sessions:Pick<Session,'id'|'startedAt'|'endedAt'|'seconds'>[],from:string):number{
 let carry=0;
 for(const session of orderedFocusSessions(sessions))if(Date.parse(session.endedAt)>=Date.parse(from))carry=planFocus(session.seconds,carry).carrySeconds;
 return carry;
}
export function orderedFocusSessions<T extends Pick<Session,'id'|'startedAt'|'endedAt'|'seconds'>>(sessions:T[]):T[]{
 return [...sessions].sort((a,b)=>Date.parse(a.endedAt)-Date.parse(b.endedAt)||a.id.localeCompare(b.id));
}
export type FocusBucketAssignment={sessionId:string;chunks:number;xp:number;funds:number;carryBefore:number;carryAfter:number;scope:string};
/** Deterministically split a set of focus sessions into 20-minute reward buckets. */
export function focusAssignments(sessions:Pick<Session,'id'|'startedAt'|'endedAt'|'seconds'|'workScope'|'taskId'>[],from:string):{assignments:FocusBucketAssignment[];carrySeconds:number}{
 const assignments:FocusBucketAssignment[]=[];let carry=0;
 for(const session of orderedFocusSessions(sessions)){
  if(Date.parse(session.endedAt)<Date.parse(from))continue;
  const plan=planFocus(session.seconds,carry);
  assignments.push({sessionId:session.id,chunks:plan.chunks,xp:plan.xp,funds:plan.funds,carryBefore:carry,carryAfter:plan.carrySeconds,scope:session.workScope||(session.taskId?'task:'+session.taskId:'session:'+session.id)});
  carry=plan.carrySeconds;
 }
 return {assignments,carrySeconds:carry};
}
