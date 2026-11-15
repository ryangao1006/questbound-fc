import {createRoot} from 'react-dom/client';
import {Suspense,lazy,useEffect,useState} from 'react';
import ClubPreview from '@/components/club-preview';
const ClubBase=lazy(()=>import('@/components/club-base'));
import '@/app/club.css';
import './demo.css';

declare global{interface Window{__QFC_DEMO__?:boolean}}
window.__QFC_DEMO__=true;

function Demo(){
 const [page,setPage]=useState(()=>location.hash==='#base'?'base':'club');
 useEffect(()=>{const sync=()=>setPage(location.hash==='#base'?'base':'club');addEventListener('hashchange',sync);return()=>removeEventListener('hashchange',sync)},[]);
 return <>
  <div className="qfc-demo-bar">
   <strong>Questbound FC · live demo</strong>
   <span>Demo build: 5,000 demo funds to try every system. Everything stays in this browser — no account, no server.</span>
   <nav>
    <a href="#top" onClick={()=>setPage('club')}>Club</a>
    <a href="#base" onClick={()=>setPage('base')}>Base</a>
    <button type="button" onClick={async()=>{const {demoTopUp}=await import('@/lib/club-demo-store');demoTopUp();location.href=location.pathname+location.search}}>Top up +5,000</button>
    <button type="button" onClick={async()=>{const {resetDemo}=await import('@/lib/club-demo-store');resetDemo();location.hash='';location.reload()}}>Reset demo</button>
   </nav>
  </div>
  <div id="top">{page==='base'?<Suspense fallback={<p role="status" style={{padding:'24px',color:'#9fb0c6'}}>Loading the base…</p>}><ClubBase/></Suspense>:<ClubPreview/>}</div>
 </>;
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{});
createRoot(document.getElementById('root')!).render(<Demo/>);
