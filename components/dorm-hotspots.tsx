"use client";
import {useEffect,useRef,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Vector3} from 'three';
import {DORM_OBJECTS,DORM_INTERACTIONS,type DormObjectId} from '@/lib/dorm-room';
export type DormMarkerRefs=RefObject<Partial<Record<DormObjectId,HTMLButtonElement|null>>>;
/** Render hit areas in 3D, but keep accessible labels in the owning modal's DOM. */
export function DormHotspots({nearby,hovered,onHover,onInspect,markers}:{nearby?:string;hovered:DormObjectId|null;onHover:(id:DormObjectId|null)=>void;onInspect:(id:DormObjectId)=>void;markers:DormMarkerRefs}){
 const {camera,size,invalidate}=useThree(),point=useRef(new Vector3());
 useEffect(()=>{invalidate()},[hovered,nearby,invalidate]);
 useFrame(()=>{for(const item of DORM_INTERACTIONS){const button=markers.current[item.id];if(!button)continue;const object=DORM_OBJECTS.find(o=>o.id===item.id)!;point.current.set(object.x,item.height*.75,object.z).project(camera);const visible=point.current.z>=-1&&point.current.z<=1&&Math.abs(point.current.x)<1.05&&Math.abs(point.current.y)<1.05;
  const x=Math.max(24,Math.min(size.width-24,(point.current.x+1)*size.width/2)),y=Math.max(24,Math.min(size.height-24,(1-point.current.y)*size.height/2));
  button.dataset.edge=x<120?'left':x>size.width-120?'right':'center';button.dataset.placement=y<90?'below':'above';
  button.style.visibility=visible?'visible':'hidden';button.style.transform=`translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
 }});
 return <>{DORM_INTERACTIONS.map(item=>{const object=DORM_OBJECTS.find(o=>o.id===item.id)!,highlighted=hovered===item.id||nearby===item.id;return <group key={item.id}>
 <mesh position={[object.x,item.height/2,object.z]} onPointerOver={e=>{e.stopPropagation();onHover(item.id)}} onPointerOut={()=>onHover(null)} onClick={e=>{e.stopPropagation();onInspect(item.id)}}><boxGeometry args={[object.w,item.height,object.d]}/><meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false}/></mesh>
 {highlighted&&<mesh rotation={[-Math.PI/2,0,0]} position={[object.x,.045,object.z]}><ringGeometry args={[.7,.75,32]}/><meshBasicMaterial color="#ffe44c" side={2}/></mesh>}
 </group>})}</>;
}
