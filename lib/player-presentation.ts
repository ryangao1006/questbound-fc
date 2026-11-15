import type {AnimationAction,AnimationMixer} from 'three';
import type {Theme} from './avatar.ts';

export type PlayerLighting = {key:string;fill:string;rim:string;exposure:number;ambient:number;environment:number;floor:string};
export const PLAYER_LIGHTING:Record<Theme,PlayerLighting> = {
 'night-stadium': {key:'#fff3e4',fill:'#dceaff',rim:'#92b8e4',exposure:1.08,ambient:.22,environment:.8,floor:'#142333'},
 'classic-career': {key:'#fff7ed',fill:'#dfedff',rim:'#c2d9f2',exposure:1.04,ambient:.32,environment:.72,floor:'#9fb3c5'},
};
export function playerFrame(portrait:boolean,height:number,aspect:number,fov=34){
 const scale=height/180,halfHeight=portrait?.34:.96,halfWidth=portrait?.35:.7;
 const tangent=Math.tan(fov*Math.PI/360),safeAspect=Math.max(.35,Math.min(3,aspect));
 const distance=Math.max(halfHeight/tangent,halfWidth/(tangent*safeAspect))*1.1*scale;
 return {targetY:(portrait?1.57:.94)*scale,distance,minDistance:(portrait?.64:1.55)*scale,maxDistance:Math.max(distance*1.65,(portrait?2.5:5.8)*scale)};
}
export function boundedPlayerZoom(distance:number,steps:number,min:number,max:number){return Math.max(min,Math.min(max,distance*Math.pow(.82,steps)));}
export function playerFrameLoop(visible:boolean,reduced:boolean,mobile:boolean){return !visible||reduced||mobile?'demand' as const:'always' as const;}

export function setIdlePresentation(idle:AnimationAction,mixer:AnimationMixer,paused:boolean,still:boolean){
 idle.play();if(paused)idle.setEffectiveWeight(1);idle.paused=paused;if(still)idle.time=.15;mixer.update(0);
}
