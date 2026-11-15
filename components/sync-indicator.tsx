"use client";
import {CloudCheck,CloudOff,RefreshCw,LoaderCircle} from 'lucide-react';
import {syncFeedback} from '@/lib/planner-feedback';
import type {PlannerState} from '@/lib/model';
import {useLocale} from './locale';
export function SyncIndicator({state,saveStatus,unavailable,busy,className,onRefresh,onConnections,onRetry}:{state:PlannerState;saveStatus:string;unavailable:boolean;busy:boolean;className:string;onRefresh:()=>void;onConnections:()=>void;onRetry?:()=>void}){
 const {t}=useLocale(),status=syncFeedback(state,saveStatus,unavailable),Icon=status.tone==='saving'?LoaderCircle:status.tone==='error'?CloudOff:status.tone==='pending'?RefreshCw:CloudCheck;
 return <details className={`sync-indicator ${className}`} data-status={status.tone}><summary aria-label={`${t(status.label)}. ${t(status.detail)}`} title={t(status.detail)}><Icon size={15} className={status.tone==='saving'?'spin':undefined}/><span role="status">{t(status.label)}</span>{status.pending>0&&<b>{status.pending}</b>}</summary><div className="sync-popover"><strong><Icon size={17}/>{t(status.label)}</strong><p>{t(status.detail)}</p>{status.pending>0&&<p>{t('{0} changes queued',status.pending)}</p>}<div className="button-row">{status.tone==='error'&&onRetry&&<button className="primary" disabled={busy} onClick={onRetry}><RefreshCw size={14}/>{t('Retry this change')}</button>}<button className="secondary" disabled={busy} onClick={onRefresh}><RefreshCw size={14}/>{t('Refresh')}</button><button className="text-button" onClick={onConnections}>{t('Check connections')}</button></div></div></details>;
}
