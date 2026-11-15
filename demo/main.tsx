import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import ClubPreview from '@/components/club-preview';
import ClubBase from '@/components/club-base';
import '@/app/club.css';
import './demo.css';
import {resetDemo} from '@/lib/club-demo-store';

declare global{interface Window{__QFC_DEMO__?:boolean}}
window.__QFC_DEMO__=true;

function Demo(){
 const [page,setPage]=useState(()=>location.hash==='#base'?'base':'club');
 useEffect(()=>{const sync=()=>setPage(location.hash==='#base'?'base':'club');addEventListener('hashchange',sync);return()=>removeEventListener('hashchange',sync)},[]);
 return <>
  <div className="qfc-demo-bar">
   <strong>Questbound FC · live demo</strong>
   <span>Runs entirely in your browser — your changes stay on this device. No account, no server.</span>
   <nav>
    <a href="#top" onClick={()=>setPage('club')}>Club</a>
    <a href="#base" onClick={()=>setPage('base')}>Base</a>
    <button type="button" onClick={()=>{resetDemo();location.hash='';location.reload()}}>Reset demo</button>
   </nav>
  </div>
  <div id="top">{page==='base'?<ClubBase/>:<ClubPreview/>}</div>
 </>;
}
createRoot(document.getElementById('root')!).render(<Demo/>);
