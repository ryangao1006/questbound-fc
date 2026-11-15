"use client";
import {ArrowLeft,House,ArrowRight} from 'lucide-react';
import {useLocale} from './locale';
import {dormPageLabel,type DormJourney} from '@/lib/dorm-journey';
export function DormReturnBar({journey,onReturn}:{journey:DormJourney;onReturn:()=>void}){
 const {t}=useLocale(),returning=journey.phase==='returning';
 return <nav className="dorm-return-bar" aria-label={t('Return to dorm navigation')}><div><span><House size={15}/>{t('My dormitory')}<ArrowRight size={13}/>{t(dormPageLabel(journey.destination))}</span><small role="status">{t(returning?'Returning to your dorm…':'Opened from your dorm. Your room position and camera are kept.')}</small></div><button type="button" className="primary" onClick={onReturn} disabled={returning}><ArrowLeft size={17}/>{t(returning?'Returning to your dorm…':'Back to dorm')}</button></nav>;
}
