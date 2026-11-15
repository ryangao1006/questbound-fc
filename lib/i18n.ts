import {zhMessages} from './messages.ts';
export type Language='en'|'zh';
export const localeFor=(language:Language)=>language==='zh'?'zh-CN':'en-GB';
export function translate(language:Language,key:string,...values:unknown[]):string {
  const normalized=key.replace(/\s+/g,' ').trim();
  const text=language==='zh'?(zhMessages[normalized]??normalized):normalized;
  return text.replace(/\{(\d+)\}/g,(_,i)=>String(values[Number(i)]??''));
}
const formatters=new Map<string,Intl.DateTimeFormat>();
function formatter(language:Language,options:Intl.DateTimeFormatOptions){
 const resolved={timeZone:'Asia/Shanghai',...options},key=localeFor(language)+'|'+JSON.stringify(resolved);
 let cached=formatters.get(key);
 if(!cached){cached=new Intl.DateTimeFormat(localeFor(language),resolved);if(formatters.size>64)formatters.clear();formatters.set(key,cached)}
 return cached;
}
export function dateTime(language:Language,value:string|Date,options:Intl.DateTimeFormatOptions={dateStyle:'medium',timeStyle:'short'}){
 return formatter(language,options).format(new Date(value));
}
