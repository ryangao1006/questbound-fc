import type {ClubState} from './club-state.ts';

/**
 * Stadium decorations (PLAN 3.7 collection: 看台、草皮、灯光). Decorations are
 * unlocked by facilities and honours — there is no separate shop and nothing is
 * charged; the choice only changes how the 3D watch looks.
 */
export type DecorKind='pitch'|'stands'|'lights';
export type DecorUnlock={facility?:'trainingCentre'|'stadium';level?:number;trophies?:number};
export type DecorOption={
 id:string;kind:DecorKind;name:string;nameZh:string;description:string;descriptionZh:string;
 unlock:DecorUnlock;unlocked:boolean;selected:boolean;
};
export type DecorChoice={pitch:string;stands:string;lights:string};
export type ResolvedDecor={choice:DecorChoice;colours:{stands:[string,string];lights:string;pitchAccent:string}};
const CATALOG:Omit<DecorOption,'unlocked'|'selected'>[]=[
 {id:'pitch.stripes',kind:'pitch',name:'Classic stripes',nameZh:'经典条纹',description:'Mown stripes.',descriptionZh:'草坪条纹。',unlock:{}},
 {id:'pitch.checker',kind:'pitch',name:'Checkerboard',nameZh:'棋盘草皮',description:'Alternating light and dark squares.',descriptionZh:'深浅交错的方格。',unlock:{facility:'trainingCentre',level:2}},
 {id:'pitch.diagonal',kind:'pitch',name:'Diagonal cut',nameZh:'斜向剪裁',description:'Diagonal mowing lines.',descriptionZh:'斜向剪草纹。',unlock:{facility:'stadium',level:2}},
 {id:'pitch.halftone',kind:'pitch',name:'Comic halftone',nameZh:'漫画网点',description:'Halftone dots straight from the comic.',descriptionZh:'漫画网点草地。',unlock:{facility:'stadium',level:3}},
 {id:'stands.classic',kind:'stands',name:'Classic crowd',nameZh:'经典看台',description:'Neutral crowd blocks.',descriptionZh:'中性人群。',unlock:{}},
 {id:'stands.home',kind:'stands',name:'Home colours',nameZh:'主场配色看台',description:'A sea of club colours.',descriptionZh:'一片俱乐部主色。',unlock:{facility:'stadium',level:1}},
 {id:'stands.gold',kind:'stands',name:'Golden honours',nameZh:'金色荣誉看台',description:'Gold confetti stands for trophy days.',descriptionZh:'为夺冠准备的金色看台。',unlock:{trophies:3}},
 {id:'lights.white',kind:'lights',name:'White floodlights',nameZh:'白色泛光',description:'Neutral stadium light.',descriptionZh:'中性球场灯光。',unlock:{}},
 {id:'lights.warm',kind:'lights',name:'Warm floodlights',nameZh:'暖色泛光',description:'Golden matchday light.',descriptionZh:'金色比赛日灯光。',unlock:{facility:'stadium',level:2}},
 {id:'lights.cool',kind:'lights',name:'Cool floodlights',nameZh:'冷色泛光',description:'Cold cinematic light.',descriptionZh:'冷色电影感灯光。',unlock:{facility:'stadium',level:4}},
];
const DEFAULTS:DecorChoice={pitch:'pitch.stripes',stands:'stands.classic',lights:'lights.white'};
function unlocked(club:ClubState,unlock:DecorUnlock):boolean{
 if(unlock.facility&&unlock.level!==undefined){if((club.facilities[unlock.facility]??1)<unlock.level)return false}
 if(unlock.trophies!==undefined&&(club.trophies?.length??0)<unlock.trophies)return false;
 return true;
}
export function decorOptions(club:ClubState):DecorOption[]{
 const choice=club.decor??DEFAULTS;
 return CATALOG.map(option=>({...option,unlocked:unlocked(club,option.unlock),selected:(choice[option.kind]??DEFAULTS[option.kind])===option.id}));
}
export function decorChoice(club:ClubState):DecorChoice{return {...DEFAULTS,...(club.decor??{})}}
export function canSelectDecor(club:ClubState,kind:DecorKind,id:string):{ok:boolean;reason?:string}{
 if(id===''||id==='none'||id===DEFAULTS[kind])return {ok:true};
 const option=CATALOG.find(entry=>entry.id===id&&entry.kind===kind);
 if(!option)return {ok:false,reason:'Choose a known decoration.'};
 if(!unlocked(club,option.unlock))return {ok:false,reason:'This decoration is not unlocked yet.'};
 return {ok:true};
}
export function resolveDecor(club:ClubState):ResolvedDecor{
 const choice=decorChoice(club),primary=club.colours?.primary??'#2f6f4e',secondary=club.colours?.secondary??'#c8f56e';
 const stands:( [string,string] )=choice.stands==='stands.gold'?['#f4c445','#8a5a1f']:choice.stands==='stands.home'?[primary,secondary]:['#5b6b80','#8fa0b5'];
 const lights=choice.lights==='lights.warm'?'#ffd7a1':choice.lights==='lights.cool'?'#cfe6ff':'#ffffff';
 return {choice,colours:{stands,lights,pitchAccent:secondary}};
}
export function decorSummary(club:ClubState){const options=decorOptions(club);return {unlocked:options.filter(option=>option.unlocked).length,total:options.length,choice:decorChoice(club)}}
