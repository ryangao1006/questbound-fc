/**
 * Broadcast camera settings for competitive matches. Device-local, like the
 * practice camera: nothing here is saved to the account or the match document.
 */
export type MatchCameraPreset='broadcast'|'close'|'wide';
export type MatchCameraSettings={preset:MatchCameraPreset;follow:number;zoom:number};

export const MATCH_CAMERA_KEY='qfc-match-camera';
export const DEFAULT_MATCH_CAMERA:MatchCameraSettings={preset:'broadcast',follow:.4,zoom:1};
export const MATCH_CAMERA_PRESETS:MatchCameraPreset[]=['broadcast','close','wide'];

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function parseMatchCamera(value:unknown):MatchCameraSettings{
 const raw=(value??{}) as Partial<MatchCameraSettings>;
 const preset=MATCH_CAMERA_PRESETS.includes(raw.preset as MatchCameraPreset)?raw.preset as MatchCameraPreset:DEFAULT_MATCH_CAMERA.preset;
 const follow=Number.isFinite(raw.follow)?clamp(raw.follow as number,0,1):DEFAULT_MATCH_CAMERA.follow;
 const zoom=Number.isFinite(raw.zoom)?clamp(raw.zoom as number,.7,1.4):DEFAULT_MATCH_CAMERA.zoom;
 return {preset,follow,zoom};
}

export function readMatchCamera(storage?:Pick<Storage,'getItem'>):MatchCameraSettings{
 try{const read=storage??(typeof localStorage==='undefined'?undefined:localStorage);if(!read)return {...DEFAULT_MATCH_CAMERA};return parseMatchCamera(JSON.parse(read.getItem(MATCH_CAMERA_KEY)||'null'))}catch{return {...DEFAULT_MATCH_CAMERA}}
}

export function writeMatchCamera(settings:MatchCameraSettings,storage?:Pick<Storage,'setItem'>){
 const clean=parseMatchCamera(settings);
 try{const write=storage??(typeof localStorage==='undefined'?undefined:localStorage);write?.setItem(MATCH_CAMERA_KEY,JSON.stringify(clean))}catch{/* a private-mode browser keeps the in-memory value */}
 return clean;
}

/**
 * Camera height, distance and follow weight. `follow` moves the look-at point
 * between the ball (0) and your player (1); zoom scales the framing only.
 */
export function cameraRig(settings:MatchCameraSettings,{mobile=false,reduced=false}:{mobile?:boolean;reduced?:boolean}={}){
 const clean=parseMatchCamera(settings);
 const scale=(clean.preset==='close'?.8:clean.preset==='wide'?1.35:1)*clean.zoom;
 const weight=reduced?.5:clamp(.25+clean.follow*.6,.25,.85);
 return {height:reduced?72:(mobile?28:32)*scale,back:reduced?58:(mobile?25:31)*scale,playerWeight:weight,ballWeight:1-weight,zoom:reduced?1:clean.zoom};
}
