import {clockInZone,type Settings} from './model.ts';
export type SoundKind='selection'|'complete'|'focus'|'level';
export type ClickStyle='soft'|'crisp'|'minimal';
export type DeviceSound={muted:boolean;volume:number;clickStyle?:ClickStyle};
export const DEFAULT_DEVICE_SOUND:DeviceSound={muted:false,volume:.3};
export function readDeviceSound(raw:string|null):DeviceSound{try{const value=JSON.parse(raw||'null');return value&&typeof value.muted==='boolean'&&typeof value.volume==='number'&&Number.isFinite(value.volume)?{muted:value.muted,volume:Math.max(0,Math.min(1,value.volume)),...(['soft','crisp','minimal'].includes(value.clickStyle)?{clickStyle:value.clickStyle}:{})}:{...DEFAULT_DEVICE_SOUND}}catch{return {...DEFAULT_DEVICE_SOUND}}}
export function soundQuiet(settings:Pick<Settings,'timezone'|'quietStart'|'quietEnd'>,now=new Date()){
 const t=clockInZone(now,settings.timezone),a=settings.quietStart,b=settings.quietEnd;return a===b?false:a>b?t>=a||t<b:t>=a&&t<b;
}
export function soundAllowed(settings:Pick<Settings,'sound'|'timezone'|'quietStart'|'quietEnd'>,device:DeviceSound,visible:boolean,now=new Date()){return settings.sound&&!device.muted&&device.volume>0&&visible&&!soundQuiet(settings,now)}
// Original short synthesised cues. No samples, external downloads or autoplay.
export const SOUND_NOTES:Record<SoundKind,readonly number[]>={selection:[392],complete:[523.25,659.25,783.99],focus:[440,554.37],level:[523.25,659.25,783.99,1046.5]};
export class GameAudio {
 private context:AudioContext|null=null;private voices=new Set<OscillatorNode>();private seen=new Set<string>();private lastSelection=-Infinity;private cueUntil=0;
 private createContext:()=>AudioContext;
 constructor(createContext:()=>AudioContext=()=>new AudioContext()){this.createContext=createContext}
 async arm(){try{this.context??=this.createContext();if(this.context.state==='suspended')await this.context.resume();return this.context.state==='running'}catch{return false}}
 play(kind:SoundKind,volume:number,allowed:boolean,eventId?:string,clickStyle:ClickStyle='soft'){
  const c=this.context;if(!allowed||!c||c.state!=='running'||!Number.isFinite(volume)||volume<=0||eventId&&this.seen.has(eventId))return false;
  if(kind==='selection'&&(c.currentTime-this.lastSelection<.07||c.currentTime<this.cueUntil))return false;
  if(kind==='selection')this.lastSelection=c.currentTime;
  if(eventId){this.seen.add(eventId);if(this.seen.size>300)this.seen.delete(this.seen.values().next().value!)}
  if(kind==='selection')return this.click(c,Math.min(1,volume),clickStyle);
  this.stop();this.cueUntil=c.currentTime+.18+(SOUND_NOTES[kind].length-1)*.085;const notes=SOUND_NOTES[kind],spacing=.085,duration=.18;
  try{for(const [index,frequency]of notes.entries()){
   const o=c.createOscillator(),gain=c.createGain(),start=c.currentTime+index*spacing;
   o.type='triangle';o.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(Math.min(1,volume)*.085,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
   o.connect(gain);gain.connect(c.destination);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();gain.disconnect()};o.start(start);o.stop(start+duration+.02);
  }return true;}catch{this.stop();return false;}
 }
 private click(c:AudioContext,volume:number,style:ClickStyle){
  // A rounded transient and a short low body: original synthesised switch clicks.
  const config=style==='crisp'?{high:1450,low:260,length:.042,type:'triangle' as OscillatorType}:style==='minimal'?{high:620,low:300,length:.026,type:'sine' as OscillatorType}:{high:920,low:180,length:.052,type:'sine' as OscillatorType};
  try{for(const layer of [0,1]){const o=c.createOscillator(),gain=c.createGain(),start=c.currentTime,duration=config.length*(layer?.8:1);o.type=layer?'sine':config.type;o.frequency.setValueAtTime(layer?config.low:config.high,start);o.frequency.exponentialRampToValueAtTime(layer?config.low*.7:config.low,start+duration*.7);gain.gain.setValueAtTime(.0001,start);gain.gain.linearRampToValueAtTime(volume*(layer?.045:.075),start+.002);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(gain);gain.connect(c.destination);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();gain.disconnect()};o.start(start);o.stop(start+duration+.01)}return true}catch{this.stop();return false}
 }
 stop(){for(const voice of this.voices){try{voice.stop()}catch{}}this.voices.clear()}
 close(){this.stop();void this.context?.close().catch(()=>{});this.context=null;}
}
