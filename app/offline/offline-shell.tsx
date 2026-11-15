"use client";
import {useEffect,useState} from 'react';
import {readQueue,readSnapshot,clearSiteCache} from '@/lib/site-cache';
import {translate} from '@/lib/i18n';
import type {QueuedCommand,SiteSnapshot} from '@/lib/site-queue';

export default function OfflineShell(){
 const [snapshot,setSnapshot]=useState<SiteSnapshot|null>(null),[queue,setQueue]=useState<QueuedCommand[]>([]),[ready,setReady]=useState(false),[online,setOnline]=useState(true);
 useEffect(()=>{
  let live=true;
  const load=async()=>{const [cached,pending]=await Promise.all([readSnapshot(),readQueue()]);if(!live)return;setSnapshot(cached);setQueue(pending);setReady(true)};
  void load();setOnline(navigator.onLine);
  const back=()=>{setOnline(true);location.assign('/')};
  window.addEventListener('online',back);
  return()=>{live=false;window.removeEventListener('online',back)};
 },[]);
 const language=snapshot?.state.settings.language==='zh'?'zh':'en';
 const t=(key:string,...values:unknown[])=>translate(language,key,...values);
 const open=(snapshot?.state.tasks||[]).filter(task=>!task.deletedAt&&!task.done).slice(0,8);
 const done=(snapshot?.state.tasks||[]).filter(task=>!task.deletedAt&&task.done).slice(0,3);
 return <main className="offline-copy">
  <header>
   <span className="eyebrow">QUESTBOUND FC</span>
   <h1>{t('Offline copy of your planner')}</h1>
   <p className="muted">{t('This page is served by this device only. It reads the private snapshot kept in IndexedDB and never uploads or exposes it.')}</p>
  </header>
  {!ready?<p role="status">{t('Reading this device’s copy…')}</p>:!snapshot?<section className="card"><h2>{t('No device copy yet')}</h2><p>{t('Reconnect once so this device can keep a private copy for outages.')}</p><button className="primary" onClick={()=>location.assign('/')}>{t('Reconnect')}</button></section>:<>
   <section className="card offline-status" data-revision={snapshot.revision} data-pending={queue.length}>
    <h2>{online?t('Connection is back'):t('Working offline')}</h2>
    <p>{t('Last saved from the site: {0} · revision {1} · copied {2}',new Date(snapshot.updatedAt).toLocaleString(),snapshot.revision,new Date(snapshot.cachedAt).toLocaleString())}</p>
    <p>{queue.length?t('{0} changes saved on this device and waiting to reach the site.',queue.length):t('No changes are waiting.')}</p>
    <div className="button-row">
     <button className="primary" onClick={()=>location.assign('/')}>{online?t('Open the planner'):t('Try the planner again')}</button>
     <button className="secondary" onClick={async()=>{if(confirm(t('Delete the offline copy and any queued changes on this device?'))){await clearSiteCache();setSnapshot(null);setQueue([])}}}>{t('Delete this device copy')}</button>
    </div>
   </section>
   <section className="card"><h2>{t('Next up')}</h2>{open.length?<ul className="offline-tasks">{open.map(task=><li key={task.id}><span>{task.title}</span>{task.subjectId&&<small>{snapshot.state.subjects.find(subject=>subject.id===task.subjectId)?.title||''}</small>}</li>)}</ul>:<p className="muted">{t('No open tasks in the saved copy.')}</p>}{done.length>0&&<p className="muted">{t('{0} recently completed tasks also stored.',done.length)}</p>}</section>
   <small className="offline-note">{t('Queued changes replay with their original operation ids when the site is reachable, so a retry cannot apply twice. XP and credits remain server-confirmed.')}</small>
  </>}
 </main>;
}
