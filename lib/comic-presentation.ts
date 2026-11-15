import {useSyncExternalStore} from 'react';
export const COMIC_PROFILE={id:'comic-v2',version:2,shadingBands:4,shader:'qfc-comic-v2',sourceGeometry:['human-v1','human-v2'],originalGeometryPreserved:true} as const;
const listeners=new Set<()=>void>();
function read(){try{return localStorage.getItem('qfc-character-render')!=='legacy'}catch{return true}}
function subscribe(fn:()=>void){listeners.add(fn);window.addEventListener('storage',fn);return()=>{listeners.delete(fn);window.removeEventListener('storage',fn)}}
export function useComicPresentation(){return useSyncExternalStore(subscribe,read,()=>true)}
export function setComicPresentation(comic:boolean){try{localStorage.setItem('qfc-character-render',comic?'comic-v1':'legacy')}catch{}listeners.forEach(fn=>fn())}
