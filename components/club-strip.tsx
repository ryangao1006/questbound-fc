"use client";
import Link from 'next/link';
import {ArrowUpRight,Shield} from 'lucide-react';
import {clubFunds,clubRatings} from '@/lib/club-state';
import {levelForXp} from '@/lib/club-model';
import type {PlannerState} from '@/lib/model';
import {totalXP} from '@/lib/model';
import {useLocale} from './locale';

/** Compact club card on the planner hub: one line, always current, links to /club. */
export function ClubStrip({state}:{state:PlannerState}){
 const {t}=useLocale(),club=state.club;
 if(!club)return <Link className="club-strip club-strip-empty" href="/club"><Shield size={16}/><span>{t('Create your club')}</span><ArrowUpRight size={14}/></Link>;
 const ratings=clubRatings(club),funds=clubFunds(state.economy),level=levelForXp(totalXP(state)),trophies=club.trophies?.length??0;
 return <Link className="club-strip" href="/club" aria-label={t('Open {0}',club.name)}>
  <span className="club-strip-crest" style={{background:club.colours.primary,color:club.colours.secondary}}>{club.shortName.slice(0,3)}</span>
  <span className="club-strip-name"><b>{club.name}</b><small>{t('Level {0}',level)} · {funds.toLocaleString()} FC</small></span>
  <span className="club-strip-lines"><i>DEF {ratings.DEF.toFixed(1)}</i><i>MID {ratings.MID.toFixed(1)}</i><i>ATT {ratings.ATT.toFixed(1)}</i>{trophies>0&&<i className="club-strip-trophies">🏆 {trophies}</i>}</span>
  <ArrowUpRight size={15}/>
 </Link>;
}
