"use client";
import {useEffect,useMemo} from 'react';
import * as THREE from 'three';
import type {PlannerState} from '@/lib/model';
/** Original code-authored room props; no third-party textures or downloads. */
export function DormDetails({planner}:{planner:PlannerState}){
 const poster=useMemo(()=>{const c=document.createElement('canvas');c.width=256;c.height=384;const g=c.getContext('2d')!;g.fillStyle='#123344';g.fillRect(0,0,256,384);g.fillStyle=planner.settings.avatar.homeKit.primary;g.beginPath();g.moveTo(80,84);g.lineTo(36,115);g.lineTo(58,155);g.lineTo(82,142);g.lineTo(82,270);g.lineTo(176,270);g.lineTo(176,142);g.lineTo(202,155);g.lineTo(222,115);g.lineTo(176,84);g.closePath();g.fill();g.fillStyle=planner.settings.avatar.homeKit.trim;g.textAlign='center';g.font='bold 23px sans-serif';g.fillText(planner.settings.name.toUpperCase().slice(0,14),128,54);g.font='bold 73px sans-serif';g.fillText(String(planner.settings.playerNumber),129,210);g.font='bold 15px sans-serif';g.fillStyle='#f6e6b5';g.fillText('YOUR NEXT CHAPTER',128,336);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[planner.settings.name,planner.settings.playerNumber,planner.settings.avatar.homeKit]);
 useEffect(()=>()=>poster.dispose(),[poster]);
 return <>
 <mesh position={[-1,1.9,-2.74]}><planeGeometry args={[.89,1.01]}/><meshBasicMaterial map={poster}/></mesh>
 {/* Window frame and soft folded curtains. */}
 {[-1.46,.06].map(z=><mesh key={z} position={[-3.29,1.75,z]}><boxGeometry args={[.065,1.55,.055]}/><meshToonMaterial color="#ece5ce"/></mesh>)}
 <mesh position={[-3.28,1.75,-.7]}><boxGeometry args={[.065,1.25,.045]}/><meshToonMaterial color="#ece5ce"/></mesh>
 {[-1.7,.3].map(z=><group key={z} position={[-3.2,1.65,z]}>{[-.09,0,.09].map((v,i)=><mesh key={v} position={[i%2*.045,0,v]}><boxGeometry args={[.09,1.8,.12]}/><meshToonMaterial color={i%2?'#346078':'#416f83'}/></mesh>)}</group>)}
 {/* Chair tucked under the desk, leaving the navigation footprint unchanged. */}
 <group position={[.2,0,-2.45]}><mesh position={[0,.48,.05]}><boxGeometry args={[.58,.1,.5]}/><meshToonMaterial color="#2d586b"/></mesh><mesh position={[0,.79,.27]} rotation={[-.12,0,0]}><boxGeometry args={[.56,.6,.07]}/><meshToonMaterial color="#3f7281"/></mesh>{[-.22,.22].flatMap(x=>[-.14,.24].map(z=><mesh key={x+':'+z} position={[x,.23,z]}><cylinderGeometry args={[.025,.025,.46,6]}/><meshToonMaterial color="#344450"/></mesh>))}</group>
 {/* Match-day bag, folded towel and bottles stay on existing furniture. */}
 <group position={[-2.5,.92,1.1]}><mesh rotation={[0,0,Math.PI/2]}><capsuleGeometry args={[.14,.42,3,8]}/><meshToonMaterial color="#23485c"/></mesh><mesh position={[.3,0,0]}><cylinderGeometry args={[.07,.07,.31,8]}/><meshToonMaterial color="#59aeb4"/></mesh><mesh position={[.3,.17,0]}><cylinderGeometry args={[.05,.05,.04,8]}/><meshToonMaterial color="#e7dfc7"/></mesh></group>
 {/* A compact tactics board with clear pitch markings. */}
 <group position={[1.1,1.9,-2.88]}><mesh><boxGeometry args={[1.25,.85,.055]}/><meshToonMaterial color="#dad1b2"/></mesh><mesh position={[0,0,.035]}><planeGeometry args={[1.12,.73]}/><meshToonMaterial color="#285d60"/></mesh><mesh position={[0,0,.04]}><ringGeometry args={[.15,.16,24]}/><meshBasicMaterial color="#d7ddc1"/></mesh><mesh position={[0,0,.045]}><planeGeometry args={[.012,.68]}/><meshBasicMaterial color="#d7ddc1"/></mesh>{[[-.38,.2],[-.15,-.21],[.31,.23],[.39,-.17]].map(([x,y],i)=><mesh key={i} position={[x,y,.055]}><circleGeometry args={[.035,8]}/><meshBasicMaterial color={i<2?'#f1cf69':'#e9e7d3'}/></mesh>)}</group>
 </>;
}
