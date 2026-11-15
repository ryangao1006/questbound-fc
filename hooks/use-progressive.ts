"use client";
import {useEffect,useState} from 'react';

/**
 * Render a first window of a long list and let the reader reveal the rest.
 * Growing on a timer made repeated view switches mount a larger list each time,
 * so the window only grows on an explicit action; a filter or view change resets it.
 */
export function useProgressiveWindow(total:number,initial:number,step:number,resetKey:string){
 const [limit,setLimit]=useState(initial);
 useEffect(()=>{setLimit(initial)},[resetKey,initial]);
 return {limit:Math.min(limit,total),showMore:()=>setLimit(current=>Math.min(total,current+step)),total};
}
