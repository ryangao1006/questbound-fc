"use client";
import {Component,lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {Shirt,ScanFace,Trophy,NotebookPen,Eye,RotateCcw,Footprints} from 'lucide-react';
import {Modal} from './planner-dialog';
import {useLocale} from './locale';
import {supportsWebGL} from '@/lib/webgl-support';
import {acquireGamePresentation} from '@/lib/game-presentation';
import {advanceDorm,clearDormInput} from '@/lib/dorm-controller';
import {captureDorm,resumeDorm,dormTransitionDuration,type DormSnapshot} from '@/lib/dorm-journey';
import {DORM_OBJECTS,DORM_INTERACTIONS,dormInteraction,nearbyRoomObject,type RoomPoint,type DormObjectId} from '@/lib/dorm-room';
import type {PlannerState} from '@/lib/model';
import type {CareerState} from '@/lib/football-model';
const Scene=lazy(()=>import('./dorm-scene'));
const icons={wardrobe:Shirt,mirror:ScanFace,trophies:Trophy,desk:NotebookPen};
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode;onFailure:()=>void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(){this.props.onFailure()}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}
type Props={planner:PlannerState;career:CareerState;busy:boolean;onClose:()=>void;initial?:DormSnapshot;onReady:()=>void;onNavigate:(id:DormObjectId,snapshot:DormSnapshot)=>void};
export default function PlayerDorm({planner,career,busy,onClose,initial,onReady,onNavigate}:Props){
 const {t}=useLocale(),runtime=useRef(resumeDorm(initial));
 const [point,setPoint]=useState<RoomPoint>(()=>({...runtime.current.point})),[walking,setWalking]=useState(false),[pulse,setPulse]=useState(0),[map,setMap]=useState(!!initial?.map),[webglReady,setWebglReady]=useState<boolean|null>(null),[fallback,setFallback]=useState(false);
 const [leaving,setLeaving]=useState(false),[hovered,setHovered]=useState<DormObjectId|null>(null),[labels,setLabels]=useState(!!initial?.labels),[jog,setJog]=useState(false);
 const markers=useRef<Partial<Record<DormObjectId,HTMLButtonElement|null>>>({});
 const drag=useRef<{id:number;x:number;y:number}|null>(null),stickOrigin=useRef<{id:number;x:number;y:number}|null>(null),action=useRef(()=>{}),roomRoot=useRef<HTMLDivElement>(null),transitionTimer=useRef<ReturnType<typeof setTimeout>|null>(null),arrival=useRef({onReady,focusObject:initial?.focusObject});
 const near=nearbyRoomObject(point);
 const clear=()=>{clearDormInput(runtime.current);drag.current=null;stickOrigin.current=null;setJog(false);setWalking(false);setHovered(null);setPulse(p=>p+1)};
 const inspect=(id:DormObjectId)=>{if(leaving||transitionTimer.current||!dormInteraction(id))return;const snapshot=captureDorm(runtime.current,map,labels,id);clear();setLeaving(true);const delay=dormTransitionDuration(planner.settings.reduceMotion,matchMedia('(prefers-reduced-motion: reduce)').matches);if(!delay){onNavigate(id,snapshot);return}transitionTimer.current=setTimeout(()=>onNavigate(id,snapshot),delay)};
 action.current=()=>{const item=near&&dormInteraction(near);if(item)inspect(item.id)};
 const exit=()=>{if(!busy&&!leaving)onClose()};
 useEffect(()=>acquireGamePresentation(),[]);
 useEffect(()=>{arrival.current.onReady();if(arrival.current.focusObject)requestAnimationFrame(()=>roomRoot.current?.querySelector<HTMLButtonElement>(`[data-object-id="${arrival.current.focusObject}"]`)?.focus({preventScroll:true}));return()=>{if(transitionTimer.current)clearTimeout(transitionTimer.current)}},[]);
 useEffect(()=>{const ready=supportsWebGL();setWebglReady(ready);if(!ready){setFallback(true);setMap(true)}},[]);
 useEffect(()=>{if(leaving)return;
  const reset=()=>clear();
  const down=(e:KeyboardEvent)=>{if(e.metaKey||e.ctrlKey||e.altKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;
   const key=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();runtime.current.keys.add(key);setPulse(p=>p+1)}
   if(key==='e'&&!e.repeat){e.preventDefault();action.current()}
  };
  const up=(e:KeyboardEvent)=>{runtime.current.keys.delete(e.key.toLowerCase());if(e.key.toLowerCase()==='shift')setJog(false);setPulse(p=>p+1)};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  let last=performance.now();const timer=setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;if(document.hidden){clearDormInput(runtime.current);return;}if(map)advanceDorm(runtime.current,dt);const r=runtime.current;setPoint(p=>Math.hypot(p.x-r.point.x,p.z-r.point.z)>.001?{...r.point}:p);setWalking(r.moving)},100);
  return()=>{clearInterval(timer);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);clear()};
 },[map,leaving]);
 const doorway=()=>{clear();runtime.current.point={x:0,z:.8};setPoint({x:0,z:.8});setPulse(p=>p+1)};
 const plan=<div className="dorm-map" role="group" aria-label={t('Dormitory floor plan')}>{DORM_OBJECTS.map(object=>{const item=dormInteraction(object.id);const style={left:`${(object.x+3.5)/7*100}%`,top:`${(object.z+3)/6*100}%`,width:`${object.w/7*100}%`,height:`${object.d/6*100}%`,background:object.colour};return item?<button key={object.id} style={style} title={t(item.hint)} aria-label={`${t(item.label)} · ${t(item.hint)}`} onClick={()=>inspect(item.id)}>{t(item.label)}</button>:<span key={object.id} style={style}>{t('Bed')}</span>})}<b style={{left:`${(point.x+3.5)/7*100}%`,top:`${(point.z+3)/6*100}%`}}>#{planner.settings.playerNumber}</b><small>{t('Exit')}</small></div>;
 return <Modal wide className={`dorm-modal dorm-arriving ${leaving?'dorm-leaving':''}`} title={t('Your team dormitory')} onClose={onClose} canClose={()=>!busy&&!leaving}>
  <div className="dorm-room-root" ref={roomRoot} inert={leaving}>
   <div className="dorm-toolbar"><span>{t('Free home · no upkeep · no stat bonuses')}</span><button className="secondary" aria-pressed={labels} onClick={()=>setLabels(!labels)}><Eye size={15}/>{t('Object labels')}</button><button className="secondary" aria-pressed={map} onClick={()=>{if(map&&webglReady!==true){const ready=supportsWebGL(true);setWebglReady(ready);if(ready)setMap(false)}else setMap(!map)}}>{t(map?'3D room':'Low-power map')}</button><button className="secondary" onClick={exit} disabled={busy}>{t('Exit room')}</button></div>
   {fallback&&map&&<p className="muted" role="status">{t('3D could not load. You can still use the map and room shortcuts.')}</p>}
   <div className="dorm-view" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if((e.target as HTMLElement).closest('button')||drag.current)return;if(e.pointerType==='touch'||e.button===2){e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:e.pointerId,x:e.clientX,y:e.clientY}}}} onPointerMove={e=>{if(!drag.current||drag.current.id!==e.pointerId)return;runtime.current.yaw-=(e.clientX-drag.current.x)*.006;runtime.current.pitch=Math.max(.05,Math.min(.65,runtime.current.pitch+(e.clientY-drag.current.y)*.004));drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};setPulse(p=>p+1)}} onPointerUp={e=>{if(drag.current?.id===e.pointerId)drag.current=null}} onPointerCancel={e=>{if(drag.current?.id===e.pointerId)drag.current=null}} onLostPointerCapture={e=>{if(drag.current?.id===e.pointerId)drag.current=null}} onWheel={e=>{runtime.current.distance=Math.max(1.5,Math.min(4,runtime.current.distance+e.deltaY*.002));setPulse(p=>p+1)}}>
    {map||webglReady!==true?plan:<SceneBoundary fallback={plan} onFailure={()=>{setFallback(true);setMap(true)}}><Suspense fallback={plan}><Scene active={!leaving} hasAward={career.history.some(h=>h.kind==='award')} walking={walking} runtime={runtime} pulse={pulse} planner={planner} nearby={near} hovered={hovered} onHover={setHovered} markers={markers} onInspect={inspect}/></Suspense></SceneBoundary>}
    {!map&&webglReady===true&&<div className="dorm-marker-layer">{DORM_INTERACTIONS.map(item=>{const Icon=icons[item.id];return <button key={item.id} ref={element=>{markers.current[item.id]=element}} type="button" className="dorm-hotspot" data-labels={labels} data-highlighted={hovered===item.id||near===item.id} aria-label={`${t(item.label)} · ${t(item.hint)}`} onPointerDown={e=>e.stopPropagation()} onPointerEnter={()=>setHovered(item.id)} onPointerLeave={()=>setHovered(null)} onFocus={()=>setHovered(item.id)} onBlur={()=>setHovered(null)} onClick={()=>inspect(item.id)}><span className="dorm-hotspot-icon"><Icon size={18}/></span><span className="dorm-hotspot-copy"><strong>{t(item.label)}</strong><small>{t(item.hint)}</small></span></button>})}</div>}
   </div>
   <nav className="dorm-object-shortcuts" aria-label={t('Room interactions')}>{DORM_INTERACTIONS.map(item=>{const Icon=icons[item.id];return <button key={item.id} data-object-id={item.id} onClick={()=>inspect(item.id)} title={t(item.hint)}><Icon size={17}/><span>{t(item.label)}</span></button>})}</nav>
   <p className="muted dorm-help">{t('Hover or tap the room markers. You can always return to your spot.')}</p>
   <div className="dorm-controls"><div className="dorm-stick" role="group" aria-label={t('Movement joystick')} onPointerDown={e=>{if(stickOrigin.current)return;e.currentTarget.setPointerCapture(e.pointerId);const bounds=e.currentTarget.getBoundingClientRect();stickOrigin.current={id:e.pointerId,x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};runtime.current.stick={x:Math.max(-1,Math.min(1,(e.clientX-stickOrigin.current.x)/30)),y:Math.max(-1,Math.min(1,(e.clientY-stickOrigin.current.y)/30))};setPulse(p=>p+1)}} onPointerMove={e=>{if(stickOrigin.current?.id===e.pointerId){runtime.current.stick={x:Math.max(-1,Math.min(1,(e.clientX-stickOrigin.current.x)/30)),y:Math.max(-1,Math.min(1,(e.clientY-stickOrigin.current.y)/30))};setPulse(p=>p+1)}}} onPointerUp={e=>{if(stickOrigin.current?.id===e.pointerId){runtime.current.stick={x:0,y:0};stickOrigin.current=null}}} onPointerCancel={e=>{if(stickOrigin.current?.id===e.pointerId){runtime.current.stick={x:0,y:0};stickOrigin.current=null}}} onLostPointerCapture={e=>{if(stickOrigin.current?.id===e.pointerId){runtime.current.stick={x:0,y:0};stickOrigin.current=null}}}><span>＋</span></div>
    <div className="dorm-pad">{[['w','↑','Move forward'],['a','←','Move left'],['s','↓','Move backward'],['d','→','Move right']].map(([key,label,name])=><button key={key} aria-label={t(name)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();runtime.current.keys.add(key);setPulse(p=>p+1)}}} onKeyUp={()=>runtime.current.keys.delete(key)} onBlur={()=>runtime.current.keys.delete(key)} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);runtime.current.keys.add(key);setPulse(p=>p+1)}} onPointerUp={()=>runtime.current.keys.delete(key)} onPointerCancel={()=>runtime.current.keys.delete(key)} onLostPointerCapture={()=>runtime.current.keys.delete(key)}>{label}</button>)}</div>
    <button className="primary" disabled={!near} onClick={()=>action.current()}>{near?t(dormInteraction(near)?.label||'Interact'):t('Move closer to an object')}</button>
    <button className="secondary dorm-jog" aria-pressed={jog} onClick={()=>{if(jog)runtime.current.keys.delete('shift');else runtime.current.keys.add('shift');setJog(!jog);setPulse(p=>p+1)}}><Footprints size={16}/>{t('Jog')}</button>
    <button className="text-button" onClick={()=>{runtime.current.yaw=0;runtime.current.pitch=.25;runtime.current.distance=3;setPulse(p=>p+1)}}><RotateCcw size={15}/>{t('Reset camera')}</button><button className="text-button" onClick={doorway}>{t('Return to doorway')}</button>
   </div><p className="small muted">{t('WASD to move · Shift to jog · E to interact · Right-drag to look · Scroll to zoom.')}</p>
  </div>
 </Modal>;
}
