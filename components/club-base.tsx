"use client";
import Link from 'next/link';
import {Suspense,lazy,useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,Shield,Trophy,Users,ClipboardList,Target,Landmark,Handshake} from 'lucide-react';
import {clubFunds,clubRatings} from '@/lib/club-state';
import {levelForXp} from '@/lib/club-model';
import {scoutCap} from '@/lib/club-transfers';
import {totalXP,type PlannerState} from '@/lib/model';
import {baseVisuals} from '@/lib/club-base';


type BaseEntry={id:string;title:string;subtitle:string;stat:string;hint:string;href:string;icon:typeof Shield};
const T=(language:'en'|'zh',en:string,zh:string)=>language==='zh'?zh:en;
const fmt=(text:string,...values:unknown[])=>text.replace(/\{(\d+)\}/g,(_,index)=>String(values[Number(index)]??''));
const LazyClubBase3D=lazy(()=>import('./club-base-3d'));

export default function ClubBase(){
 const [state,setState]=useState<PlannerState|null>(null),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[webgl,setWebgl]=useState<boolean|null>(null);
 useEffect(()=>{let live=true;void (async()=>{try{const response=await fetch('/api/state',{cache:'no-store'});if(!response.ok)throw new Error('no session');const body=await response.json() as {state:PlannerState};if(live)setState(body.state)}catch{if(live){setFailed(true)}}finally{if(live)setLoading(false)}})();return()=>{live=false}},[]);
 useEffect(()=>{
  try{
   const canvas=document.createElement('canvas');
   const context=canvas.getContext('webgl2')??canvas.getContext('webgl');
   // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot WebGL capability probe.
   setWebgl(Boolean(context));
  }catch{setWebgl(false)}
 },[]);
 const language=(state?.settings.language==='zh'?'zh':'en') as 'en'|'zh';
 const clubForVisuals=state?.club;
 const visuals=useMemo(()=>clubForVisuals?baseVisuals(clubForVisuals):null,[clubForVisuals]);
 const L=(en:string,zh:string,...values:unknown[])=>fmt(T(language,en,zh),...values);
 const tacticName=(tactic:string)=>T(language,{balanced:'Balanced',possession:'Possession',counter:'Counter',wide:'Wide',press:'Press'}[tactic]??tactic,{balanced:'均衡',possession:'控球',counter:'快速反击',wide:'边路',press:'高位压迫'}[tactic]??tactic);
 const club=state?.club;
 if(loading)return <main className="base-page"><p role="status">{T(language,'Reading your club…','正在读取俱乐部…')}</p></main>;
 if(!club)return <main className="base-page"><header className="base-top"><span className="base-eyebrow">QUESTBOUND FC</span><h1>{T(language,'The base','基地')}</h1></header><section className="base-empty"><Shield size={28}/><h2>{failed?T(language,'Sign in to see your base','登录后查看你的基地'):T(language,'Create your club first','先创建你的俱乐部')}</h2><p>{T(language,'The base overview reads your saved club and links to every room.','基地总览会读取你已保存的俱乐部，并链接到各个房间。')}</p><Link className="base-cta" href="/club">{T(language,'Open the club workspace','打开俱乐部工作区')}</Link></section></main>;
 const ratings=clubRatings(club),funds=clubFunds(state!.economy),level=levelForXp(totalXP(state!)),trophies=club.trophies?.length??0,season=club.season,cup=club.cup;
 const entries:BaseEntry[]=[
  {id:'training',title:T(language,'Training ground','训练场'),subtitle:T(language,'Raise one attribute at a time','一次提升一项属性'),stat:L('Level {0} · cap {1}','等级 {0} · 上限 {1}',club.facilities.trainingCentre,[69,74,79,89,99][Math.min(4,Math.max(0,club.facilities.trainingCentre-1))]),hint:T(language,'Train and facilities','培养与设施'),href:'/club#club-training',icon:Target},
  {id:'tactics',title:T(language,'Tactics room','战术室'),subtitle:T(language,'Shape the team between matches','在两场比赛之间塑造球队'),stat:L('{0} · trained L{1}','{0} · 已训练 L{1}',tacticName(club.tactics.active),club.tactics.levels[club.tactics.active]??0),hint:T(language,'Tactics','战术'),href:'/club#club-tactics',icon:ClipboardList},
  {id:'dressing',title:T(language,'Dressing room','更衣室'),subtitle:T(language,'Squad, line-up and ratings','阵容、首发与评分'),stat:L('{0} players · OVR {1}','{0} 名球员 · 总评 {1}',club.players.length,ratings.overall.toFixed(1)),hint:T(language,'Squad and line-up','阵容与首发'),href:'/club#club-squad',icon:Users},
  {id:'stadium',title:T(language,'Stadium','球场'),subtitle:T(language,'Matchday, league and cup','比赛日、联赛与杯赛'),stat:season?L('Round {0}/14 · tier {1}','第 {0}/14 轮 · 级别 {1}',season.round,season.tier+1):L('Level {0} · no season yet','等级 {0} · 还没有赛季',club.facilities.stadium),hint:T(language,'Matches and league','比赛与联赛'),href:'/club#club-match',icon:Landmark},
  {id:'honours',title:T(language,'Trophy room','荣誉室'),subtitle:T(language,'Every season you finished','你打完的每个赛季'),stat:L('{0} trophies · {1} seasons','{0} 座奖杯 · {1} 个赛季',trophies,club.history?.length??0),hint:T(language,'Honours and history','荣誉与历史'),href:'/club#club-honours',icon:Trophy},
  {id:'transfers',title:T(language,'Transfer office','转会办公室'),subtitle:T(language,'Scout, sign and sell','考察、签入与出售'),stat:L('{0} FC · scout to {1} OVR','{0} FC · 球探上限 {1} OVR',funds.toLocaleString(),scoutCap(club.facilities.scoutCentre)),hint:T(language,'Transfers','引援'),href:'/club#club-transfers',icon:Handshake},
  {id:'league',title:T(language,'League office','联赛办公室'),subtitle:T(language,'Promotion and relegation','升级与降级'),stat:season?L('Tier {0} · round {1}/14','级别 {0} · 第 {1}/14 轮',season.tier+1,season.round):T(language,'Start a season','开始一个赛季'),hint:T(language,'League table','积分榜'),href:'/club#club-league',icon:ClipboardList},
  {id:'cup',title:T(language,'Cup room','杯赛室'),subtitle:T(language,'Four clubs, two rounds','四支球队，两轮'),stat:cup?L('Tier {0} · {1}','级别 {0} · {1}',cup.tier+1,cup.finished?T(language,'finished','已结束'):T(language,'in progress','进行中')):T(language,'No cup yet','还没有杯赛'),hint:T(language,'Challenge cup','挑战杯'),href:'/club#club-cup',icon:Trophy},
 ];
 return <main className="base-page">
  <header className="base-top">
   <div><span className="base-eyebrow">QUESTBOUND FC · {club.shortName}</span><h1>{T(language,'The base','基地')}</h1><p>{L('{0} · level {1} · {2} FC · one place for every room.','{0} · 等级 {1} · {2} FC · 所有房间的入口。',club.name,level,funds.toLocaleString())}</p></div>
   <Link className="base-cta" href="/club">{T(language,'Back to club workspace','返回俱乐部工作区')}<ArrowUpRight size={15}/></Link>
  </header>
  <section className="base-3d-panel" aria-label={T(language,'3D base overview','3D 基地总览')}>
   {webgl===false?<p className="base-3d-fallback" role="status">{T(language,'WebGL is unavailable in this browser, so the room list below is shown instead.','此浏览器无法使用 WebGL，已改用下方的房间列表。')}</p>:null}
   {webgl===true&&visuals?(
    <Suspense fallback={<p className="base-3d-loading" role="status">{T(language,'Loading the 3D base…','正在加载 3D 基地…')}</p>}>
     <LazyClubBase3D visuals={visuals} language={language} onUnavailable={()=>setWebgl(false)}/>
    </Suspense>
   ):webgl===null?<p className="base-3d-loading" role="status">{T(language,'Checking 3D support…','正在检查 3D 支持…')}</p>:null}
  </section>
  <h2 className="base-room-list-title">{T(language,'Rooms list','房间列表')}</h2>
  <div className="base-grid">
   {entries.map(entry=>{const Icon=entry.icon;return <Link key={entry.id} className="base-card" href={entry.href}>
    <span className="base-card-icon"><Icon size={22}/></span>
    <div className="base-card-copy"><h2>{entry.title}</h2><p>{entry.subtitle}</p></div>
    <span className="base-card-stat">{entry.stat}</span>
    <span className="base-card-hint">{entry.hint}<ArrowUpRight size={13}/></span>
   </Link>})}
  </div>
  <p className="base-note">{T(language,'The comic 3D base is a data-driven overview; if WebGL is unavailable the room cards below still work. Nothing on this page changes your club.','漫画风 3D 基地是数据驱动的总览；如果 WebGL 不可用，下方的房间卡片仍然可用。本页不会改动你的俱乐部。')}</p>
 </main>;
}
