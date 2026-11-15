export const THEMES = ["night-stadium", "classic-career"] as const;
export type Theme = typeof THEMES[number];
export type KitPattern = "solid" | "stripes" | "hoops" | "sash";
export type KitDesign = {pattern:KitPattern;primary:string;secondary:string;trim:string};
export type AvatarConfig = {
 version:1|2;assetVersion:"human-v1"|"human-v2";skinTone:number;skinAdjust:number;face:number;
 hair:number;hairColor:string;height:number;build:number;muscularity:number;
 homeKit:KitDesign;awayKit:KitDesign;
};
export const SKIN_TONES = ["#f3d8c5","#e9c7ad","#dab08d","#c99470","#bb825b","#a76c49","#955a3c","#805039","#6e422f","#593726","#482d22","#35231b"];
export const THEME_LABELS:Record<Theme,string>={"night-stadium":"Dark theme","classic-career":"Light theme"};
/** Keep saved identifiers stable; retire Training Day into the light appearance. */
export function migrateTheme(value:unknown):Theme {
 if(value===undefined||value===null)return "night-stadium";
 if(value==="training-day")return "classic-career";
 if(value==="night-stadium"||value==="classic-career")return value;
 throw new Error("Choose a valid theme.");
}
export function defaultAvatar():AvatarConfig{return {version:1,assetVersion:"human-v1",skinTone:4,skinAdjust:0,face:0,hair:0,hairColor:"#201c19",height:180,build:.45,muscularity:.45,homeKit:{pattern:"solid",primary:"#174d48",secondary:"#efe8d2",trim:"#c6fb52"},awayKit:{pattern:"stripes",primary:"#e8edf2",secondary:"#24486a",trim:"#e2b85a"}};}
export function migrateAvatar(value:unknown):AvatarConfig{
 if(value===undefined||value===null)return defaultAvatar();
 if(typeof value!=="object"||Array.isArray(value))throw new Error("Choose a valid player appearance.");
 const base=defaultAvatar(),v=value as Partial<AvatarConfig>;
 return {...base,...v,homeKit:{...base.homeKit,...v.homeKit},awayKit:{...base.awayKit,...v.awayKit}};
}
export function assertAvatar(value:AvatarConfig){
 const color=(v:unknown)=>typeof v==="string"&&/^#[\da-f]{6}$/i.test(v);
 if(!value||!((value.version===1&&value.assetVersion==="human-v1")||(value.version===2&&value.assetVersion==="human-v2")))throw new Error("This player appearance needs a newer app version.");
 if(!Number.isInteger(value.skinTone)||value.skinTone<0||value.skinTone>11||!Number.isInteger(value.face)||value.face<0||value.face>5||!Number.isInteger(value.hair)||value.hair<0||value.hair>5||!color(value.hairColor))throw new Error("Choose a valid player appearance.");
 if(!Number.isFinite(value.height)||value.height<150||value.height>205||!Number.isFinite(value.skinAdjust)||Math.abs(value.skinAdjust)>.12||![value.build,value.muscularity].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new Error("Choose valid body settings.");
 for(const kit of [value.homeKit,value.awayKit])if(!kit||!["solid","stripes","hoops","sash"].includes(kit.pattern)||![kit.primary,kit.secondary,kit.trim].every(color))throw new Error("Choose a valid shirt design.");
 return true;
}
