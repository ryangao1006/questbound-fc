import {assertAvatar} from './avatar.ts';
import type {Settings} from './model.ts';
export const APPEARANCE_DRAFT_KEY='qi-appearance-preview';
export const appearanceValues=(settings:Settings)=>({avatar:structuredClone(settings.avatar),name:settings.name,playerNumber:settings.playerNumber,position:settings.position});
export type AppearanceValues=ReturnType<typeof appearanceValues>;
export type AppearanceDraft={version:1;baseline:string;value:AppearanceValues};
export function readAppearanceDraft(raw:string|null):AppearanceDraft|null{
 if(!raw)return null;
 try{const record=JSON.parse(raw);if(record.version!==1||typeof record.baseline!=='string'||!record.value)return null;
  const valid=(value:AppearanceValues,saved=false)=>{if(typeof value.name!=='string'||value.name.length>60||!Number.isInteger(value.playerNumber)||value.playerNumber<(saved?1:0)||value.playerNumber>99||typeof value.position!=='string'||value.position.length>12)throw new Error('Invalid appearance draft');assertAvatar(value.avatar);return appearanceValues(value as Settings)};
  const baseline=valid(JSON.parse(record.baseline),true),value=valid(record.value);return {version:1,baseline:JSON.stringify(baseline),value};
 }catch{return null;}
}
