/**
 * Comic art direction helpers (qfc-comic-v2 presentation).
 * Pure specs so both the watch and the base scene share one look and so the
 * numbers can be tested without a browser. Texture creation stays in the UI.
 */
export type ComicPalette={ink:string;paper:string;accent:string;shadow:string;burst:string[]};
export const COMIC_INK='#10151f';
export const COMIC_PAPER='#f7f1e3';
export const COMIC_PALETTE:ComicPalette={
 ink:COMIC_INK,
 paper:COMIC_PAPER,
 accent:'#c8f56e',
 shadow:'#3a4356',
 burst:['#ffe066','#ffb3a7','#8fd7ff','#c8f56e'],
};
/** Halftone settings for a comic texture; scale is the dot spacing in texture pixels. */
export type HalftoneSpec={scale:number;radius:number;angleDegrees:number;opacity:number};
export function halftoneSpec(density:'light'|'medium'|'heavy'='medium'):HalftoneSpec{
 if(density==='light')return {scale:18,radius:3.2,angleDegrees:15,opacity:0.08};
 if(density==='heavy')return {scale:10,radius:2.6,angleDegrees:35,opacity:0.2};
 return {scale:14,radius:2.8,angleDegrees:25,opacity:0.14};
}
export function comicPaletteFor(primary:string,secondary:string):ComicPalette{
 return {...COMIC_PALETTE,accent:secondary||COMIC_PALETTE.accent,burst:[COMIC_PALETTE.burst[0],primary||COMIC_PALETTE.burst[1],...COMIC_PALETTE.burst.slice(2)]};
}
/** A deterministic burst spec for a goal so screenshots and QA agree. */
export type BurstSpec={headline:string;subline:string;rotation:number;scale:number;rays:number;colour:string};
export function goalBurst(seed:number,home:boolean,homeName:string,awayName:string,minute:number):BurstSpec{
 const rng=(value:number)=>{let state=(value>>>0)||1;state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296};
 const rotation=(rng(seed+minute)*24-12),scale=0.94+rng(seed+minute*3)*0.18,rays=10+Math.floor(rng(seed+minute*7)*5);
 const scorerTeam=home?homeName:awayName;
 return {headline:'GOAL!',subline:`${minute}' ${scorerTeam}`,rotation,scale,rays,colour:home?COMIC_PALETTE.accent:COMIC_PALETTE.burst[1]};
}
/** Comic speed lines around a sprinting token: angles in radians, lengths in scene units. */
export function sprintLines(seed:number,count=5):{angle:number;length:number;offset:number}[] {
 const rng=(value:number)=>{let state=(value>>>0)||1;state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;return state/4294967296};
 return Array.from({length:count},(_,index)=>({angle:(rng(seed+index*13)*Math.PI*2),length:0.8+rng(seed+index*29)*1.1,offset:rng(seed+index*7)*0.6}));
}
/** Outline shell parameters for ink strokes; scale is the shell inflation. */
export function inkOutline(baseScale:number){return {scale:baseScale*1.055,colour:COMIC_INK}}
export function comicFontClass(){return 'comic-ink'}
export const COMIC_PROFILE_ID='qfc-comic-v2';
