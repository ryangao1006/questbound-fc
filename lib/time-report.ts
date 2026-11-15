import {zonedTime,type Session,type TimeBlock} from "./model.ts";

export function overlapMinutes(start:string,end:string,from:Date,to:Date){
 return Math.max(0,Math.min(Date.parse(end),to.getTime())-Math.max(Date.parse(start),from.getTime()))/60000;
}
export function plannedMinutes(blocks:TimeBlock[],from:Date,to:Date,area?:string){
 return blocks.filter(b=>!b.allDay&&(!area||b.area===area)).reduce((n,b)=>n+overlapMinutes(b.start,b.end,from,to),0);
}
export function actualMinutes(sessions:Session[],from:Date,to:Date,area?:string){
 return sessions.filter(s=>!area||s.area===area).reduce((n,s)=>{
  const elapsed=(Date.parse(s.endedAt)-Date.parse(s.startedAt))/60000;
  return n+(elapsed>0?overlapMinutes(s.startedAt,s.endedAt,from,to)/elapsed*s.seconds/60:0);
 },0);
}
export function dayBounds(day:string,timezone="Asia/Shanghai"){
 const next=new Date(day+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+1);
 return [new Date(zonedTime(day,"00:00",timezone)),new Date(zonedTime(next.toISOString().slice(0,10),"00:00",timezone))] as const;
}
