export type RoomPoint={x:number;z:number};
export const DORM_OBJECTS=[
 {id:'bed',x:-2.3,z:-1.7,w:1.5,d:2.3,colour:'#60849a'},
 {id:'wardrobe',x:2.45,z:-2.4,w:1.5,d:.7,colour:'#a78058'},
 {id:'mirror',x:3,z:.3,w:.3,d:1.3,colour:'#a8cad1'},
 {id:'trophies',x:-2.5,z:1.1,w:1.1,d:.6,colour:'#d7b86e'},
 {id:'desk',x:.2,z:-2.4,w:1.7,d:.8,colour:'#b9906b'},
] as const;
export const DORM_INTERACTIONS = [
 {id:'wardrobe',label:'Wardrobe',hint:'Change your kit and appearance',height:2.24,panel:'appearance'},
 {id:'mirror',label:'Mirror',hint:'Preview your player',height:2.2,panel:'appearance'},
 {id:'desk',label:'Task desk',hint:'Plan and edit your quests',height:1.4,panel:'tasks'},
 {id:'trophies',label:'Trophy cabinet',hint:'Explore your saved football story',height:1.9,panel:'trophies'},
] as const;
export type DormObjectId=typeof DORM_INTERACTIONS[number]['id'];
export type DormPanel='room'|typeof DORM_INTERACTIONS[number]['panel'];
export function dormInteraction(id:string){return DORM_INTERACTIONS.find(item=>item.id===id);}
export function walkRoom(p:RoomPoint,dx:number,dz:number,seconds:number,speed=2.1):RoomPoint{
 const length=Math.hypot(dx,dz);if(!length)return p;
 const step=Math.min(3.6,Math.max(0,speed))*Math.min(.05,Math.max(0,seconds))/Math.max(1,length),radius=.28;
 const clear=(x:number,z:number)=>Math.abs(x)<=3.5-radius&&Math.abs(z)<=3-radius&&!DORM_OBJECTS.some(o=>Math.abs(x-o.x)<o.w/2+radius&&Math.abs(z-o.z)<o.d/2+radius);
 const x=p.x+dx*step,z=p.z+dz*step;
 const nextX=clear(x,p.z)?x:p.x;return {x:nextX,z:clear(nextX,z)?z:p.z};
}
export function nearbyRoomObject(p:RoomPoint){return DORM_OBJECTS.find(o=>o.id!=='bed'&&Math.hypot(Math.max(0,Math.abs(p.x-o.x)-o.w/2),Math.max(0,Math.abs(p.z-o.z)-o.d/2))<.95)?.id;}
