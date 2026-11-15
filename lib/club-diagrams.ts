import type {LineRatings} from './club-model.ts';
import {formationSlots,type FormationName} from './club-lineup.ts';

/**
 * Pure geometry for the club's diagrams. Kept out of the components so the shapes
 * can be tested and so the interface can show numbers visually instead of prose.
 */
export type Point={x:number;y:number};
export function polar(center:Point,radius:number,angleDegrees:number):Point{
 const radians=(angleDegrees-90)*Math.PI/180;
 return {x:Math.round((center.x+radius*Math.cos(radians))*100)/100,y:Math.round((center.y+radius*Math.sin(radians))*100)/100};
}
export function radarPolygon(values:{label:string;value:number}[],center:Point,radius:number,max=100):{points:string;axes:{label:string;outer:Point;tip:Point;value:number}[]}{
 const axes=values.map((entry,index)=>{
  const angle=index*360/values.length,ratio=Math.max(0,Math.min(1,entry.value/max));
  return {label:entry.label,outer:polar(center,radius,angle),tip:polar(center,radius*ratio,angle),value:entry.value};
 });
 return {points:axes.map(axis=>`${axis.tip.x},${axis.tip.y}`).join(' '),axes};
}
/** Two-sided bar: returns percentage widths for ours and theirs against a 0..max scale. */
export function compareBars(ours:number,theirs:number,max=100):{oursPct:number;theirsPct:number;diff:number}{
 const clamp=(value:number)=>Math.max(0,Math.min(100,value/max*100));
 return {oursPct:Math.round(clamp(ours)*10)/10,theirsPct:Math.round(clamp(theirs)*10)/10,diff:Math.round((ours-theirs)*10)/10};
}
export function progressRing(done:number,total:number,circumference=100):{fraction:number;dashOffset:number}{
 const fraction=total>0?Math.max(0,Math.min(1,done/total)):0;
 return {fraction:Math.round(fraction*1000)/1000,dashOffset:Math.round(circumference*(1-fraction)*100)/100};
}
/** Formation dots in a 0..width × 0..height viewBox (home attacking right). */
export function formationDots(formation:FormationName,width=105,height=68,lineup?:{name:string;position:string}[]):{slots:{x:number;y:number;role:string;label:string}[]}{
 const slots=formationSlots(formation);
 return {slots:slots.map((slot,index)=>({x:Math.round(slot.x/105*width*100)/100,y:Math.round(slot.y/68*height*100)/100,role:slot.role,label:lineup?.[index]?.name??slot.role}))};
}
export function trophyPips(count:number,max=5):{filled:number;total:number}{return {filled:Math.max(0,Math.min(max,count)),total:max}}
export function levelPips(level:number,max=5):{filled:number;total:number}{return {filled:Math.max(0,Math.min(max,level)),total:max}}
export function ratingsRadar(ratings:Pick<LineRatings,'DEF'|'MID'|'ATT'|'GK'>,center:Point,radius:number){
 return radarPolygon([{label:'DEF',value:ratings.DEF},{label:'MID',value:ratings.MID},{label:'ATT',value:ratings.ATT},{label:'GK',value:ratings.GK}],center,radius);
}
export function budgetSplit(funds:number,prices:number[]):{affordable:boolean;remaining:number;pct:number}{
 const cheapest=prices.length?Math.min(...prices):0,affordable=funds>=cheapest;
 return {affordable,remaining:Math.max(0,funds-cheapest),pct:cheapest?Math.min(100,Math.round(funds/cheapest*100)):100};
}
