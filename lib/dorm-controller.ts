import {DORM_OBJECTS,walkRoom,type RoomPoint} from './dorm-room.ts';
export type DormRuntime={point:RoomPoint;yaw:number;pitch:number;distance:number;keys:Set<string>;stick:{x:number;y:number};moving:boolean;facing:number;speed:number;velocity:{x:number;z:number};accumulator:number};
export function newDormRuntime():DormRuntime{return {point:{x:0,z:.8},yaw:0,pitch:.25,distance:3,keys:new Set(),stick:{x:0,y:0},moving:false,facing:Math.PI,speed:0,velocity:{x:0,z:0},accumulator:0}}
// Fixed local step keeps map/3D movement consistent at different refresh rates.
export function advanceDorm(r:DormRuntime,dt:number){
 r.accumulator+=Math.min(.1,Math.max(0,Number.isFinite(dt)?dt:0));
 const tick=1/120;while(r.accumulator+1e-9>=tick){r.accumulator-=tick;
 const k=r.keys,stickLength=Math.hypot(r.stick.x,r.stick.y),stick=stickLength>.12?r.stick:{x:0,y:0};
 const right=Number(k.has('d')||k.has('arrowright'))-Number(k.has('a')||k.has('arrowleft'))+stick.x;
 const forward=Number(k.has('w')||k.has('arrowup'))-Number(k.has('s')||k.has('arrowdown'))-stick.y;
 const length=Math.max(1,Math.hypot(right,forward)),speed=k.has('shift')?3.6:2.1;
 const dx=(right*Math.cos(r.yaw)-forward*Math.sin(r.yaw))/length,dz=(-right*Math.sin(r.yaw)-forward*Math.cos(r.yaw))/length;
 const vx=dx*speed-r.velocity.x,vz=dz*speed-r.velocity.z,change=Math.hypot(vx,vz),gain=Math.min(1,(right||forward?16:24)*tick/Math.max(change,1e-9));
 r.velocity.x+=vx*gain;r.velocity.z+=vz*gain;
 const next=walkRoom(r.point,r.velocity.x/3.6,r.velocity.z/3.6,tick,3.6),mx=next.x-r.point.x,mz=next.z-r.point.z;
 r.speed=Math.hypot(mx,mz)/tick;r.moving=r.speed>.01;
 if(r.moving)r.facing=Math.atan2(mx,mz);
 if(Math.abs(mx)<1e-8)r.velocity.x=0;if(Math.abs(mz)<1e-8)r.velocity.z=0;r.point=next;
 }
}
export function clearDormInput(r:DormRuntime){r.keys.clear();r.stick={x:0,y:0};r.moving=false;r.speed=0;r.velocity={x:0,z:0};r.accumulator=0}
export function dormCamera(r:DormRuntime){
 const desired={x:Math.max(-3.32,Math.min(3.32,r.point.x+Math.sin(r.yaw)*r.distance)),y:1.45+Math.sin(r.pitch)*r.distance,z:Math.max(-2.82,Math.min(2.82,r.point.z+Math.cos(r.yaw)*r.distance))};
 let safe={x:r.point.x,y:1.3,z:r.point.z};
 for(let i=1;i<=30;i++){const t=i/30,p={x:r.point.x+(desired.x-r.point.x)*t,y:1.3+(desired.y-1.3)*t,z:r.point.z+(desired.z-r.point.z)*t};
  if(DORM_OBJECTS.some(o=>p.y<({wardrobe:2.3,mirror:2.3,trophies:1.9,desk:1.4,bed:.9}[o.id])&&Math.abs(p.x-o.x)<o.w/2+.13&&Math.abs(p.z-o.z)<o.d/2+.13))return safe;
  safe=p;
 }return desired;
}
