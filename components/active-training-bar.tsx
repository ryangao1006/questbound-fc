"use client";
import {useEffect,useState} from 'react';
import {Play,Pause,Square} from 'lucide-react';
import {focusPresentation} from '@/lib/planner-feedback';
import type {ActiveSession,PlannerState} from '@/lib/model';
import {useLocale} from './locale';

/**
 * Owns its own one-second clock so a running focus session cannot re-render the
 * whole planner (and the task board) every second.
 */
export function ActiveTrainingBar({state,session,busy,onFocus,onOpen}:{state:PlannerState;session:ActiveSession;busy:boolean;onFocus:(action:'pause'|'resume'|'finish')=>void;onOpen:()=>void}){
 const {t}=useLocale(),[now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(timer)},[]);
 const focus=focusPresentation(session,now);
 return <div className="active-training-bar" data-paused={!!session.pausedAt}>
  <div className="active-training-progress" role="progressbar" aria-label={t('Focus progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(focus.progress)} aria-valuetext={t('{0} of {1} active minutes',Math.floor(focus.elapsed/60),session.target/60)}><i style={{width:`${focus.progress}%`}}/></div>
  <button className="active-training-summary" onClick={onOpen} aria-label={t('Open training controls')}><b>{focus.clock}</b><span><strong>{state.tasks.find(task=>task.id===session.taskId)?.title||t('Free training')}</strong><small role="status">{t(focus.status)}</small></span></button>
  <button aria-label={session.pausedAt?t('Resume'):t('Pause')} title={session.pausedAt?t('Resume'):t('Pause')} onClick={()=>onFocus(session.pausedAt?'resume':'pause')} disabled={busy}>{session.pausedAt?<Play size={17}/>:<Pause size={17}/>}<span>{session.pausedAt?t('Resume'):t('Pause')}</span></button>
  <button aria-label={t('Save session')} title={t('Save session')} onClick={()=>onFocus('finish')} disabled={busy}><Square size={16}/><span>{t('Save')}</span></button>
 </div>;
}
