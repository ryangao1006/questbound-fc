let available:boolean|undefined;
/** Probe before mounting a Canvas so unsupported devices get a usable fallback. */
export function supportsWebGL(refresh=false){
 if(typeof document==='undefined')return false;
 if(refresh)available=undefined;if(available!==undefined)return available;
 try{const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2');available=!!context;context?.getExtension('WEBGL_lose_context')?.loseContext()}catch{available=false}
 return available;
}
