"use client";
import type {DormRuntime} from '@/lib/dorm-controller';
import {applyComicMaterial} from '@/lib/comic-material';
import {useComicPresentation} from '@/lib/comic-presentation';
import {useEffect,useMemo,useRef,useSyncExternalStore,type ComponentRef,type RefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,useGLTF,useAnimations,ContactShadows,Environment,Lightformer} from '@react-three/drei';
import * as THREE from 'three';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {SKIN_TONES,type KitDesign,type Theme} from '@/lib/avatar';
import {PLAYER_LIGHTING,playerFrame,boundedPlayerZoom,playerFrameLoop,setIdlePresentation} from '@/lib/player-presentation';
import type {PlayerProps} from './player-stage';

type Props=PlayerProps&{motion?:RefObject<DormRuntime>;walking?:boolean;locomotion?:'walk'|'run';visible:boolean;mobile:boolean;portrait:boolean;reset:number;zoom:number;attempt:number;theme:Theme};
export function makeKitTexture(kit:KitDesign,name:string,number:number,resolution=1024,detail=false){
 const canvas=document.createElement('canvas');canvas.width=resolution;canvas.height=resolution;const c=canvas.getContext('2d')!;c.scale(resolution/1024,resolution/1024);
 c.fillStyle=kit.primary;c.fillRect(0,0,1024,1024);c.fillStyle=kit.secondary;
 for(const start of [41,553]){c.save();c.beginPath();c.rect(start,0,430,1024);c.clip();
  if(kit.pattern==='stripes')for(let x=start+35;x<start+430;x+=115)c.fillRect(x,0,52,1024);
  if(kit.pattern==='hoops')for(let y=140;y<1024;y+=170)c.fillRect(start,y,430,70);
  if(kit.pattern==='sash'){c.beginPath();c.moveTo(start,0);c.lineTo(start+90,0);c.lineTo(start+430,750);c.lineTo(start+430,970);c.closePath();c.fill()}c.restore();
 }
 if(detail){c.strokeStyle='#00000038';c.lineWidth=3;for(const start of [41,553]){c.save();c.beginPath();c.rect(start,0,430,1024);c.clip();c.beginPath();c.moveTo(start+96,120);c.lineTo(start+214,300);c.stroke();c.beginPath();c.moveTo(start+430-96,120);c.lineTo(start+430-214,300);c.stroke();c.beginPath();c.moveTo(start+72,430);c.lineTo(start+72,1010);c.stroke();c.beginPath();c.moveTo(start+358,430);c.lineTo(start+358,1010);c.stroke();c.lineWidth=14;c.strokeStyle=kit.trim+'aa';c.beginPath();c.moveTo(start,905);c.lineTo(start+430,905);c.stroke();c.lineWidth=3;c.strokeStyle='#00000038';c.restore()}}
 c.fillStyle=kit.trim;c.textAlign='center';c.font='bold 54px Arial';c.fillText(name.toUpperCase().slice(0,15),768,260,380);
 c.font='bold 310px Arial';c.fillText(String(number),768,650,300);c.font='bold 45px Arial';c.fillText('QFC',285,260);
 c.font='bold 21px Arial';c.fillText('QUESTBOUND',256,500);c.fillText('FOOTBALL CLUB',256,533);
 const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function usePlayerScene(source:THREE.Group){
 const comic=useComicPresentation();
 const result=useMemo(()=>{
  const scene=clone(source),materials:{mesh:THREE.Mesh;material:THREE.MeshStandardMaterial;normal:THREE.Vector2}[]=[];
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
   const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   const copies=originals.map(original=>{const material=original.clone() as THREE.MeshStandardMaterial;
    if(comic)applyComicMaterial(material);
    materials.push({mesh,material,normal:material.normalScale?.clone()||new THREE.Vector2(1,1)});return material;});
   mesh.material=Array.isArray(mesh.material)?copies:copies[0];
  });return {scene,materials};
 },[source,comic]);
 useEffect(()=>()=>result.materials.forEach(({material})=>material.dispose()),[result]);return result;
}
function Player({motion,walking=false,locomotion='walk',avatar,name,number,position,equipped,kit='home',reduceMotion,celebration=0,mobile,visible,large}:Props){
 const path=`/assets/${avatar.assetVersion==='human-v2'?'player-v2':'player-v1'}/${mobile||!large?'player-mobile':'player'}.glb`,gltf=useGLTF(path);
 const {scene,materials}=usePlayerScene(gltf.scene),{actions,mixer}=useAnimations(gltf.animations,scene),{invalidate}=useThree();
 const lastCelebration=useRef(celebration),kitDesign=kit==='away'&&equipped.includes('kit')?avatar.awayKit:avatar.homeKit;
 const comic=useComicPresentation();const kitTexture=useMemo(()=>makeKitTexture(kitDesign,name,number,1024,comic),[kitDesign,name,number,comic]);useEffect(()=>()=>kitTexture.dispose(),[kitTexture]);
 useEffect(()=>{
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;const n=mesh.name.toLowerCase();
   mesh.castShadow=!mobile;mesh.receiveShadow=true;
   if(n==='feet')mesh.visible=false;
   if(n.startsWith('hair_'))mesh.visible=n===`hair_${avatar.hair}`;
   if(n.includes('armband'))mesh.visible=equipped.includes('armband');
   if(n.includes('glove'))mesh.visible=position==='GK';
   if(mesh.morphTargetDictionary&&mesh.morphTargetInfluences)for(const [key,ix]of Object.entries(mesh.morphTargetDictionary))mesh.morphTargetInfluences[ix]=key==='Muscle'?avatar.muscularity:key==='Build'?avatar.build:key.startsWith('Face_')?(key===`Face_${avatar.face}`?1:0):0;
  });
  for(const {mesh,material:m,normal}of materials){const n=mesh.name.toLowerCase();m.normalScale?.copy(normal);
   if(n.includes('jersey')||n.includes('shirt')){m.roughness=.84;m.envMapIntensity=.6;m.normalScale?.multiplyScalar(mobile?.22:.35);
    if(n.includes('trim'))m.color.set(kitDesign.trim);else{m.color.set('#ffffff');m.map=kitTexture;}
   }else{
    if(n==='body'||n.includes('skin')){m.color.set(SKIN_TONES[avatar.skinTone]).offsetHSL(0,0,avatar.skinAdjust);m.roughness=avatar.assetVersion==='human-v2'&&m.roughnessMap?1:.58;m.envMapIntensity=.92;m.normalScale?.multiplyScalar(.55);}
    if(n.includes('hair')||n.includes('eyebrow')){m.color.set(avatar.hairColor);m.roughness=.76;m.envMapIntensity=.5;m.alphaToCoverage=!!m.alphaTest;}
    if(n.includes('shorts')){m.color.set(kitDesign.secondary);m.roughness=.88;m.normalScale?.multiplyScalar(.3);}
    if(n.includes('socks')||n.includes('armband')){m.color.set(kitDesign.trim);m.roughness=.9;m.normalScale?.multiplyScalar(.3);}
    if(n.includes('boot')){m.color.set(equipped.includes('goldboots')?'#c59a30':equipped.includes('boots')?'#d2fb4a':'#181e27');m.roughness=.48;m.envMapIntensity=1.1;}
    if(n.includes('eye')&&!n.includes('brow'))m.envMapIntensity=.8;
   }
  }
  invalidate();
 },[scene,materials,avatar,kitDesign,kitTexture,equipped,position,mobile,invalidate]);
 useEffect(()=>{
  if(motion)return;
  const idle=(walking?actions[locomotion]:actions.idle)||actions.idle||Object.values(actions)[0];if(!idle)return;
  idle.reset().fadeIn(.16).play();idle.time=.15;idle.timeScale=walking&&locomotion==='run'?1.05:1;mixer.update(0);invalidate();return()=>{idle.fadeOut(.16)};
 },[actions,mixer,invalidate,walking,locomotion,motion]);
 useEffect(()=>{
  if(motion)return;
  const idle=(walking?actions[locomotion]:actions.idle)||actions.idle||Object.values(actions)[0];if(!idle)return;
  if(reduceMotion||!visible){for(const action of Object.values(actions))if(action&&action!==idle)action.stop();idle.play();idle.setEffectiveWeight(1);}
  // Keep a comfortable rigged stance when movement is disabled, rather than the bind pose.
  setIdlePresentation(idle,mixer,reduceMotion||!visible,reduceMotion);invalidate();
 },[actions,mixer,reduceMotion,visible,invalidate,walking,locomotion,motion]);
 // The room animator reads simulation speed directly instead of the sampled HUD.
 const roomWeights=useRef({idle:1,walk:0,run:0});
 useEffect(()=>{if(!motion)return;roomWeights.current={idle:1,walk:0,run:0};for(const key of ['idle','walk','run'] as const){const a=actions[key];if(a){a.reset().setLoop(THREE.LoopRepeat,Infinity).play();a.time=.15;a.setEffectiveWeight(key==='idle'?1:0)}}mixer.update(0);invalidate()},[motion,actions,mixer,invalidate]);
 useFrame((_,dt)=>{if(!motion||document.hidden)return;const speed=motion.current.speed;
  const run=Math.max(0,Math.min(1,(speed-1.8)/1.3)),moving=Math.min(1,speed/.2);
  const targets={idle:1-moving,walk:moving*(1-run),run:moving*run};
  for(const key of ['idle','walk','run'] as const){const action=actions[key];if(!action)continue;
   roomWeights.current[key]+=(targets[key]-roomWeights.current[key])*(1-Math.exp(-Math.min(dt,.05)*18));
   action.play();action.paused=reduceMotion&&speed<.01;action.setEffectiveWeight(roomWeights.current[key]);
   action.setEffectiveTimeScale(key==='idle'?1:Math.max(.55,Math.min(2.2,speed/(key==='run'?3.09:1.15))));
  }
 });
 useEffect(()=>{
  if(celebration===lastCelebration.current)return;lastCelebration.current=celebration;
  if(!celebration||reduceMotion||!visible)return;
  const clip=equipped.includes('celebration')?actions.celebrate:actions.nod,idle=actions.idle;if(!clip)return;
  idle?.fadeOut(.2);clip.reset().setLoop(THREE.LoopOnce,1);clip.clampWhenFinished=true;clip.fadeIn(.2).play();
  const onFinish=(event:{action:THREE.AnimationAction})=>{if(event.action!==clip)return;clip.fadeOut(.25);idle?.reset().fadeIn(.25).play()};
  mixer.addEventListener('finished',onFinish);return()=>{mixer.removeEventListener('finished',onFinish);clip.stop()};
 },[celebration,actions,mixer,reduceMotion,visible,equipped]);
 return <group scale={avatar.height/180} rotation={[0,-.08,0]}><primitive object={scene} dispose={null}/></group>;
}
function CameraRig({portrait,reset,zoom,height,reduced,visible,mobile}:{portrait:boolean;reset:number;zoom:number;height:number;reduced:boolean;visible:boolean;mobile:boolean}){
 const controls=useRef<ComponentRef<typeof OrbitControls>>(null),{camera,invalidate,size,gl}=useThree();
 const previous=useRef<{portrait:boolean;reset:number;zoom:number;height:number;aspect:number}|null>(null);
 const movement=useRef<{from:THREE.Vector3;to:THREE.Vector3;fromTarget:THREE.Vector3;target:THREE.Vector3;elapsed:number}|null>(null);
 const aspect=size.width/Math.max(1,size.height),frame=playerFrame(portrait,height,aspect);
 useEffect(()=>{const canvas=gl.domElement,previousTouch=canvas.style.touchAction;canvas.style.touchAction=mobile?'pan-y':'none';return()=>{canvas.style.touchAction=previousTouch}},[gl,mobile]);
 useEffect(()=>{
  const orbit=controls.current;if(!orbit)return;
  const before=previous.current,framing=!before||before.portrait!==portrait||before.reset!==reset||before.height!==height||before.aspect!==aspect;
  previous.current={portrait,reset,zoom,height,aspect};
  if(!framing&&before?.zoom===zoom){if((reduced||!visible)&&movement.current){camera.position.copy(movement.current.to);orbit.target.copy(movement.current.target);movement.current=null;orbit.update();invalidate()}return;}
  const target=framing?new THREE.Vector3(0,frame.targetY,0):orbit.target.clone();
  const direction=framing?new THREE.Vector3(.1,.025,1).normalize():camera.position.clone().sub(orbit.target).normalize();
  const distance=framing?frame.distance:boundedPlayerZoom(camera.position.distanceTo(orbit.target),zoom-(before?.zoom||0),frame.minDistance,frame.maxDistance);
  const to=direction.multiplyScalar(distance).add(target);
  if(!before||reduced||!visible){camera.position.copy(to);orbit.target.copy(target);camera.lookAt(target);orbit.update();movement.current=null;}
  else movement.current={from:camera.position.clone(),to,fromTarget:orbit.target.clone(),target,elapsed:0};
  invalidate();
 },[camera,invalidate,portrait,reset,zoom,height,aspect,reduced,visible,frame.distance,frame.targetY,frame.minDistance,frame.maxDistance]);
 useFrame((_,delta)=>{const motion=movement.current,orbit=controls.current;if(!motion||!orbit)return;motion.elapsed+=Math.min(delta,.05);const progress=Math.min(1,motion.elapsed/.22),ease=1-Math.pow(1-progress,3);
  camera.position.lerpVectors(motion.from,motion.to,ease);orbit.target.lerpVectors(motion.fromTarget,motion.target,ease);camera.lookAt(orbit.target);orbit.update();if(progress===1)movement.current=null;else invalidate();
 });
 return <OrbitControls ref={controls} makeDefault enabled={visible} enablePan={false} enableZoom={!mobile} minDistance={frame.minDistance} maxDistance={frame.maxDistance} minPolarAngle={.5} maxPolarAngle={1.72} enableDamping={!reduced} dampingFactor={.1}/>;
}
function StudioLighting({theme,mobile}:{theme:Theme;mobile:boolean}){
 const style=PLAYER_LIGHTING[theme],{gl,invalidate}=useThree();
 useEffect(()=>{gl.toneMappingExposure=style.exposure;invalidate()},[gl,style.exposure,invalidate]);
 return <><ambientLight intensity={style.ambient}/><hemisphereLight args={[style.fill,'#343e36',.55]}/>
  <directionalLight position={[-2.5,3.5,4]} color={style.key} intensity={2.3} castShadow={!mobile} shadow-mapSize={[1024,1024]} shadow-camera-left={-1.4} shadow-camera-right={1.4} shadow-camera-top={2.3} shadow-camera-bottom={-.2} shadow-normalBias={.025}/>
  <directionalLight position={[3,2,2]} color={style.fill} intensity={.85}/><directionalLight position={[1.8,2.6,-2.5]} color={style.rim} intensity={1.8}/>
  <Environment key={theme} resolution={mobile?128:256} frames={1} environmentIntensity={style.environment}>
   <Lightformer form="rect" intensity={3} color={style.key} position={[-3,3,4]} scale={[3,4,1]} target={[0,1,0]}/>
   <Lightformer form="rect" intensity={1.8} color={style.fill} position={[4,2,2]} scale={[3,3,1]} target={[0,1,0]}/>
   <Lightformer form="rect" intensity={2.5} color={style.rim} position={[1,3,-4]} scale={[2,4,1]} target={[0,1,0]}/>
   <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[0,5,0]} rotation={[Math.PI/2,0,0]} scale={[4,4,1]}/>
  </Environment></>;
}
function Ground({mobile,theme,appearance}:{mobile:boolean;theme:Theme;appearance:string}){
 const style=PLAYER_LIGHTING[theme];
 return <group><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.012,0]} receiveShadow><circleGeometry args={[.64,64]}/><meshStandardMaterial color={style.floor} roughness={.95} transparent opacity={.35}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.009,0]}><ringGeometry args={[.64,.648,80]}/><meshBasicMaterial color={style.rim} transparent opacity={.45} toneMapped={false}/></mesh>
  {!mobile&&<ContactShadows key={appearance} position={[0,-.005,0]} opacity={.35} scale={3.5} blur={2.6} far={2.5} frames={1} resolution={256}/>}
 </group>;
}
function subscribeMotion(callback:()=>void){const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',callback);return()=>media.removeEventListener('change',callback)}
function readMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}
function PhoneRenderClock({active}:{active:boolean}){const {invalidate}=useThree();useEffect(()=>{if(!active)return;const timer=setInterval(()=>invalidate(),1000/30);return()=>clearInterval(timer)},[active,invalidate]);return null}
export default function PlayerCanvas(props:Props){
 const systemReduced=useSyncExternalStore(subscribeMotion,readMotion,()=>false),reduced=props.reduceMotion||systemReduced;
 const shadowKey=[props.avatar.height,props.avatar.build,props.avatar.muscularity,props.theme].join(':');
 return <Canvas shadows={props.mobile?false:{type:THREE.PCFShadowMap}} dpr={props.mobile?[1,1.25]:[1,1.75]} frameloop={playerFrameLoop(props.visible,reduced,props.mobile)} camera={{position:[.2,1,3.5],fov:34,near:.05,far:30}} gl={{antialias:true,alpha:true,powerPreference:props.mobile?'low-power':'high-performance'}} onCreated={({gl})=>{gl.setClearColor('#000000',0);gl.toneMapping=THREE.ACESFilmicToneMapping;gl.outputColorSpace=THREE.SRGBColorSpace}}>
  <StudioLighting theme={props.theme} mobile={props.mobile}/><Player {...props} reduceMotion={reduced}/><Ground mobile={props.mobile} theme={props.theme} appearance={shadowKey}/>
  <CameraRig portrait={props.portrait} reset={props.reset} zoom={props.zoom} height={props.avatar.height} reduced={reduced} visible={props.visible} mobile={props.mobile}/><PhoneRenderClock active={props.visible&&!reduced&&props.mobile}/>
 </Canvas>;
}
export function clearPlayerAssetCache(){useGLTF.clear('/assets/player-v1/player.glb');useGLTF.clear('/assets/player-v1/player-mobile.glb');useGLTF.clear('/assets/player-v2/player.glb');useGLTF.clear('/assets/player-v2/player-mobile.glb')}

// Share the versioned appearance renderer; room loading remains lazy.
export {Player as RoomPlayer};
