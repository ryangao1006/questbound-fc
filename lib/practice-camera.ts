export type PracticeCamera='broadcast'|'close'|'wide';
export function cameraPreset(value:unknown):PracticeCamera{return value==='close'||value==='wide'?value:'broadcast'}
export function cameraDimensions(preset:PracticeCamera,mobile:boolean,reduced:boolean){
 if(reduced)return {height:72,back:58};
 const scale=preset==='close'?.8:preset==='wide'?1.35:1;
 return {height:(mobile?28:32)*scale,back:(mobile?25:31)*scale};
}
