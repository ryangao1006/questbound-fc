import {newDormRuntime,type DormRuntime} from './dorm-controller.ts';
import type {DormObjectId,RoomPoint} from './dorm-room.ts';
export type DormSnapshot={point:RoomPoint;yaw:number;pitch:number;distance:number;facing:number;map:boolean;labels:boolean;focusObject?:DormObjectId};
export type DormDestination='quests'|'appearance'|'history';
export type DormJourney={id:string;scope:string;object:DormObjectId;destination:DormDestination;snapshot:DormSnapshot;phase:'away'|'returning'};
export function dormDestination(id:DormObjectId):DormDestination{return id==='desk'?'quests':id==='trophies'?'history':'appearance'}
export function captureDorm(runtime:DormRuntime,map:boolean,labels:boolean,focusObject?:DormObjectId):DormSnapshot{
 return {point:{...runtime.point},yaw:runtime.yaw,pitch:runtime.pitch,distance:runtime.distance,facing:runtime.facing,map,labels,focusObject};
}
export function resumeDorm(snapshot?:DormSnapshot):DormRuntime{
 const runtime=newDormRuntime();if(!snapshot)return runtime;
 const bounded=(value:number,min:number,max:number,fallback:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
 runtime.point={x:bounded(snapshot.point.x,-3.22,3.22,0),z:bounded(snapshot.point.z,-2.72,2.72,.8)};
 runtime.yaw=Number.isFinite(snapshot.yaw)?snapshot.yaw:0;runtime.pitch=bounded(snapshot.pitch,.05,.65,.25);runtime.distance=bounded(snapshot.distance,1.5,4,3);runtime.facing=Number.isFinite(snapshot.facing)?snapshot.facing:Math.PI;
 return runtime;
}
export function dormTransitionDuration(savedReducedMotion:boolean,deviceReducedMotion:boolean){return savedReducedMotion||deviceReducedMotion?0:180}
export function dormPageLabel(destination:DormDestination){return destination==='quests'?'Quests':destination==='appearance'?'Appearance':'History'}
