"use client";
import {useSyncExternalStore} from 'react';
import {Shield} from 'lucide-react';
import {translate,type Language} from '@/lib/i18n';
function languageHint(){return document.documentElement.lang.startsWith('zh')?'zh' as const:'en' as const}
function subscribe(callback:()=>void){const observer=new MutationObserver(callback);observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>observer.disconnect()}
export function LoadingScreen({error,retry}:{error:string;retry:()=>void}){const language:Language=useSyncExternalStore(subscribe,languageHint,()=> 'en');const t=(key:string)=>translate(language,key);return <div className="app-loading"><span className="loading-crest"><Shield size={31}/></span><h1>Questbound FC</h1><p>{t(error||'Opening your football career…')}</p>{error?<button className="primary" onClick={retry}>{t('Try again')}</button>:<span className="loading-dots">•••</span>}</div>}
