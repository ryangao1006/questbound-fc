"use client";
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {translate,localeFor,type Language} from '@/lib/i18n';
import type {Theme} from '@/lib/avatar';
type DisplayPreferences={language:Language;theme?:Theme;onDisplayChange?:(patch:{language?:Language;theme?:Theme})=>void};
const Locale=createContext<DisplayPreferences>({language:'en'});
export function LocaleProvider({language,theme,onDisplayChange,children}:DisplayPreferences&{children:ReactNode}){const value=useMemo(()=>({language,theme,onDisplayChange}),[language,theme,onDisplayChange]);return <Locale.Provider value={value}>{children}</Locale.Provider>}
export function useLocale(){const settings=useContext(Locale);return useMemo(()=>({...settings,locale:localeFor(settings.language),t:(key:string,...values:unknown[])=>translate(settings.language,key,...values)}),[settings]);}
