"use client";
import type {ReactNode} from 'react';
import {SKIN_TONES,type AvatarConfig} from '@/lib/avatar';
import {COMIC_HUMAN_V1,COMIC_SAMPLE_VIEWS,characterLod} from '@/lib/comic-character';
import {useLocale} from './locale';

const hex=(value:string)=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
const rgb=(c:number[])=>`#${c.map(n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0')).join('')}`;
const mix=(value:string,target:string,amount:number)=>{const a=hex(value),b=hex(target);return rgb(a.map((n,i)=>n+(b[i]-n)*amount))};
const dark=(value:string,amount:number)=>mix(value,'#0a1424',amount);
const light=(value:string,amount:number)=>mix(value,'#ffffff',amount);

type Palette={skin:string;skinShade:string;hair:string;hairShade:string;shirt:string;shirtShade:string;secondary:string;trim:string;boot:string;ink:string};

function palette(avatar:AvatarConfig):Palette{
 const skin=SKIN_TONES[avatar.skinTone]??SKIN_TONES[0],kit=avatar.homeKit;
 return {skin,skinShade:dark(skin,.18),hair:avatar.hairColor,hairShade:dark(avatar.hairColor,.22),
  shirt:kit.primary,shirtShade:dark(kit.primary,.2),secondary:kit.secondary,trim:kit.trim,boot:dark('#1a2432',.1),ink:'#0d1520'};
}

function Hair({style,color,shade}:{style:number;color:string;shade:string}){
 const stroke={stroke:shade,strokeWidth:2,strokeLinejoin:'round' as const};
 if(style===0)return <path d="M-31 -6C-33-30-16-42 0-42C17-42 33-29 31-6C24-22 12-27 0-27C-12-27-24-22-31-6Z" fill={color} {...stroke}/>;
 if(style===1)return <g><path d="M-32-4C-34-32-16-44 1-44C19-44 34-31 32-4C28-20 20-31 6-33C-4-35-14-31-19-24C-24-17-28-10-32-4Z" fill={color} {...stroke}/><path d="M6-33C-4-35-14-31-19-24C-12-27-2-29 6-33Z" fill={shade}/></g>;
 if(style===2)return <g fill={color} {...stroke}><path d="M-31-2L-33-16L-24-12L-26-30L-14-22L-12-40L-2-28L4-44L12-28L22-38L24-22L34-28L31-8C22-24 10-28-2-28C-14-28-24-22-31-2Z"/></g>;
 if(style===3)return <g><path d="M-31-6C-35-34-14-46 4-45C24-44 35-30 31-8C26-24 16-33 2-35C-10-37-22-28-31-6Z" fill={color} {...stroke}/><path d="M-24-30C-10-44 14-44 26-32C16-38 0-40-12-36C-19-33-22-31-24-30Z" fill={shade}/></g>;
 if(style===4)return <g fill={color} {...stroke}>{[[-20,-34],[0,-42],[20,-34],[-28,-18],[28,-18],[-12,-44],[12,-44]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={13}/>)}</g>;
 return <g><path d="M-31-4C-34-31-16-43 1-43C18-43 33-30 31-4C25-22 14-30 0-30C-14-30-25-22-31-4Z" fill={color} {...stroke}/><circle cx="30" cy="-30" r="10" fill={color} {...stroke}/><path d="M30-30C40-22 44-8 40 6" fill="none" stroke={shade} strokeWidth="9" strokeLinecap="round"/></g>;
}

function Face({avatar,p,scale=1}:{avatar:AvatarConfig;p:Palette;scale?:number}){
 const lid=p.hairShade;
 return <g transform={`scale(${scale})`}>
  <path data-part="face" d="M-34 4C-34 34-18 46 0 46C19 46 34 33 34 4C34-22 19-34 0-34C-19-34-34-22-34 4Z" fill={p.skin} stroke={p.ink} strokeWidth="2.4"/>
  <path d="M-34 6C-34 30-18 46 0 46C6 46 12 45 17 43C4 41-10 30-14 8C-20 2-28 2-34 6Z" fill={p.skinShade} opacity=".55"/>
  <ellipse cx="-35" cy="8" rx="6" ry="9" fill={p.skin} stroke={p.ink} strokeWidth="2.2"/>
  <ellipse cx="35" cy="8" rx="6" ry="9" fill={p.skin} stroke={p.ink} strokeWidth="2.2"/>
  <g>
   <ellipse cx="-13" cy="4" rx="10" ry="11" fill="#fdfdfd" stroke={p.ink} strokeWidth="2"/>
   <ellipse cx="13" cy="4" rx="10" ry="11" fill="#fdfdfd" stroke={p.ink} strokeWidth="2"/>
   <circle cx="-11.5" cy="5" r="5.6" fill={dark(p.hair,.35)}/>
   <circle cx="14.5" cy="5" r="5.6" fill={dark(p.hair,.35)}/>
   <circle cx="-11.5" cy="5" r="2.6" fill={p.ink}/>
   <circle cx="14.5" cy="5" r="2.6" fill={p.ink}/>
   <circle cx="-13.4" cy="2.6" r="1.8" fill="#ffffff"/>
   <circle cx="12.6" cy="2.6" r="1.8" fill="#ffffff"/>
   <path d="M-23-4C-19-9-8-9-4-4" fill="none" stroke={p.ink} strokeWidth="2.6" strokeLinecap="round"/>
   <path d="M4-4C8-9 19-9 23-4" fill="none" stroke={p.ink} strokeWidth="2.6" strokeLinecap="round"/>
   <path d="M-21-11C-17-14-8-14-4-11" fill="none" stroke={lid} strokeWidth="3" strokeLinecap="round"/>
   <path d="M4-11C8-14 17-14 21-11" fill="none" stroke={lid} strokeWidth="3" strokeLinecap="round"/>
  </g>
  <path d="M0 6C-2 12-2 16 1 18" fill="none" stroke={p.skinShade} strokeWidth="2.4" strokeLinecap="round"/>
  <path d="M-9 28C-3 33 5 33 10 27" fill="none" stroke={p.ink} strokeWidth="2.6" strokeLinecap="round"/>
 </g>;
}

function Bust({avatar,p}:{avatar:AvatarConfig;p:Palette}){
 return <g>
  <rect x="0" y="0" width="240" height="300" fill="#101a2b"/>
  <circle cx="120" cy="120" r="96" fill="#182741"/>
  <path d="M46 300C50 236 78 210 120 206C162 210 190 236 194 300Z" fill={p.shirt} stroke={p.ink} strokeWidth="3"/>
  <path d="M46 300C50 236 78 210 120 206C162 210 190 236 194 300Z" fill={p.shirtShade} opacity=".35" transform="translate(0 26)"/>
  <path d="M104 176H136L140 214H100Z" fill={p.skin} stroke={p.ink} strokeWidth="2.6"/>
  <path d="M101 208C108 224 132 224 139 208" fill={p.trim} stroke={p.ink} strokeWidth="2.4"/>
  <g transform="translate(120 152) scale(1.15)">
   <Face avatar={avatar} p={p}/>
   <Hair style={avatar.hair} color={p.hair} shade={p.hairShade}/>
  </g>
 </g>;
}

function Figure({avatar,p,pose}:{avatar:AvatarConfig;p:Palette;pose:'run'|'kick'}){
 const kick=pose==='kick';
 const legFront=kick?'M118 196L150 236L168 226':'M118 196L152 244L144 276';
 const legBack=kick?'M118 196L88 236L74 262':'M118 196L84 238L62 268';
 const armFront=kick?'M140 140L176 168L190 150':'M140 140L168 172L160 196';
 const armBack=kick?'M100 140L70 158L52 148':'M100 140L74 176L48 168';
 return <g>
  <rect x="0" y="0" width="240" height="300" fill="#101a2b"/>
  <ellipse cx="120" cy="280" rx="86" ry="12" fill="#0b1424"/>
  {kick&&<circle cx="186" cy="262" r="13" fill="#f7f7f2" stroke={p.ink} strokeWidth="2.5"/>}
  <path d="M72 286L96 286L102 252L78 248Z" fill={p.boot} stroke={p.ink} strokeWidth="2.4"/>
  <path d="M132 286L156 286L158 252L134 248Z" fill={p.boot} stroke={p.ink} strokeWidth="2.4"/>
  <path d={legBack} fill="none" stroke={p.skin} strokeWidth="17" strokeLinecap="round"/>
  <path d={legBack} fill="none" stroke={p.ink} strokeWidth="2" strokeLinecap="round" opacity=".25"/>
  <path d={legFront} fill="none" stroke={p.skin} strokeWidth="17" strokeLinecap="round"/>
  <path d={legFront} fill="none" stroke={p.ink} strokeWidth="2" strokeLinecap="round" opacity=".25"/>
  <path d={kick?'M110 150L104 214':'M110 150L106 208'} stroke={p.secondary} strokeWidth="20" strokeLinecap="round"/>
  <path d={armBack} fill="none" stroke={p.skin} strokeWidth="13" strokeLinecap="round"/>
  <path d={armFront} fill="none" stroke={p.skin} strokeWidth="13" strokeLinecap="round"/>
  <path d="M118 118C96 118 82 134 82 158C82 186 96 204 118 204C140 204 154 186 154 158C154 134 140 118 118 118Z" fill={p.shirt} stroke={p.ink} strokeWidth="3"/>
  <path d="M96 122C92 138 92 176 100 200" fill="none" stroke={p.trim} strokeWidth="4" opacity=".8"/>
  <g transform="translate(118 92) scale(.86)">
   <Face avatar={avatar} p={p}/>
   <Hair style={avatar.hair} color={p.hair} shade={p.hairShade}/>
  </g>
 </g>;
}

function Phone({avatar,p}:{avatar:AvatarConfig;p:Palette}){
 return <g>
  <rect x="0" y="0" width="240" height="300" fill="#0c1523"/>
  <rect x="66" y="16" width="108" height="268" rx="16" fill="#060c16" stroke="#2b3d57" strokeWidth="3"/>
  <rect x="72" y="24" width="96" height="252" rx="11" fill="#132136"/>
  <rect x="104" y="26" width="32" height="6" rx="3" fill="#2b3d57"/>
  <g transform="translate(120 150) scale(.6)">
   <path d="M-54 98C-50 52-26 30 0 26C26 30 50 52 54 98Z" fill={p.shirt} stroke={p.ink} strokeWidth="4"/>
   <path d="M-16 8H16L19 38H-19Z" fill={p.skin} stroke={p.ink} strokeWidth="3"/>
   <path d="M-17 32C-10 46 10 46 17 32" fill={p.trim} stroke={p.ink} strokeWidth="3"/>
   <Face avatar={avatar} p={p}/>
   <Hair style={avatar.hair} color={p.hair} shade={p.hairShade}/>
  </g>
 </g>;
}

function Frame({view,label,children}:{view:string;label:string;children:ReactNode}){
 return <figure className="comic-sample-frame" data-view={view}>
  <svg viewBox="0 0 240 300" role="img" aria-label={label}>{children}</svg>
  <figcaption>{label}</figcaption>
 </figure>;
}

export function ComicSample({avatar,name,number,position}:{avatar:AvatarConfig;name:string;number:number;position:string}){
 const {t}=useLocale(),p=palette(avatar),lods=COMIC_HUMAN_V1;
 return <section className="comic-sample" aria-labelledby="comic-sample-title"
  data-character-profile={lods.id} data-geometry={lods.geometrySource} data-views={COMIC_SAMPLE_VIEWS.join(',')}
  data-lod-presentation={characterLod('presentation').glb} data-lod-phone={characterLod('phone').glb}>
  <div className="comic-sample-heading">
   <div><span className="eyebrow">{lods.id}</span><h3 id="comic-sample-title">{t('Comic character sample')}</h3></div>
   <p>{t('Original artwork over unmodified CC0 geometry. Shading, kit detailing and the sample sheet are project work; the rig and body proportions are unchanged.')}</p>
  </div>
  <div className="comic-sample-grid">
   <Frame view="bust" label={t('Close-up')}><Bust avatar={avatar} p={p}/></Frame>
   <Frame view="run" label={t('Running')}><Figure avatar={avatar} p={p} pose="run"/></Frame>
   <Frame view="kick" label={t('Kicking')}><Figure avatar={avatar} p={p} pose="kick"/></Frame>
   <Frame view="phone" label={t('Phone precision')}><Phone avatar={avatar} p={p}/></Frame>
  </div>
  <p className="comic-sample-note">{t('{0} · #{1} · {2} · presentation {3} px kit · phone {4} px kit',name,number,position,characterLod('presentation').kitResolution,characterLod('phone').kitResolution)}</p>
 </section>;
}
