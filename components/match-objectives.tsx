"use client";
import {Check,X} from 'lucide-react';
import {evaluateObjectives,phaseRatings} from '@/lib/match-objectives';
import type {MatchState} from '@/lib/football-match';
import {useLocale} from './locale';

/** Pre-match brief and full-time debrief derived from the match itself. */
export function MatchObjectives({state,finished=false}:{state:MatchState;finished?:boolean}){
 const {t}=useLocale(),results=evaluateObjectives(state),ratings=phaseRatings(state);
 const label=(text:string,target:number)=>t(text,target);
 if(!finished)return <section className="match-objectives" aria-label={t('Match objectives')}>
  <span className="eyebrow">{t('Match objectives')}</span>
  <ul>{results.map(result=><li key={result.objective.id} data-main={result.objective.main}>
   <b>{label(result.objective.label,result.objective.target)}</b>
   <small>{result.objective.main?t('Main objective'):t('Also')} · {result.value}/{result.objective.target}</small>
  </li>)}</ul>
 </section>;
 return <section className="match-objectives match-debrief" aria-label={t('Match debrief')} data-met={results.filter(result=>result.met).length} data-total={results.length}>
  <span className="eyebrow">{t('Match debrief')}</span>
  <ul>{results.map(result=><li key={result.objective.id} data-met={result.met}>
   {result.met?<Check size={14} aria-hidden="true"/>:<X size={14} aria-hidden="true"/>}
   <b>{label(result.objective.label,result.objective.target)}</b>
   <small>{result.value}/{result.objective.target} · {result.met?t('Met'):t('Not met')}</small>
  </li>)}</ul>
  <dl className="match-phases">
   <div><dt>{t('Defending')}</dt><dd>{ratings.defending.toFixed(1)}</dd></div>
   <div><dt>{t('Organising')}</dt><dd>{ratings.organising.toFixed(1)}</dd></div>
   {ratings.goalkeeping!==null&&<div><dt>{t('Goalkeeping')}</dt><dd>{ratings.goalkeeping.toFixed(1)}</dd></div>}
  </dl>
  <small className="match-debrief-note">{t('Ratings are fictional game feedback from this match, not a measure of real ability.')}</small>
 </section>;
}
