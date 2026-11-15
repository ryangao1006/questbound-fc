import {HUMAN_V2_ASSETS,HUMAN_V2_HASHES} from './player-v2-manifest.ts';

/**
 * comic-human-v1 is a versioned rendering profile, not a new sculpt.
 * It keeps the published human-v2 geometry untouched and adds the project's own
 * cel shading, kit detailing and an original sample character sheet.
 */
export const COMIC_HUMAN_V1={
 id:'comic-human-v1',version:1,
 geometrySource:'human-v2',
 geometryHashes:HUMAN_V2_HASHES,
 shading:{bands:4,profile:'qfc-comic-v2',shadowTint:'#3d5a86',keyTint:'#fff0d2'},
 sheet:'/assets/comic-human-v1/sample-sheet.svg',
 manifest:'/assets/comic-human-v1/manifest.json',
 license:'CC0-1.0',
 provenance:'Original project artwork and shader over unmodified CC0 human-v2 geometry',
 immutableAfterPublication:true,
} as const;

export type CharacterSurface='presentation'|'dorm'|'match'|'phone';
export type CharacterLod={surface:CharacterSurface;glb:string;kitResolution:number;comicMaterial:boolean;kitDetail:boolean;shadows:boolean;dpr:[number,number];pose:'bust'|'run'|'kick'|'phone'};

const LODS:Record<CharacterSurface,CharacterLod>={
 // Large customiser and onboarding preview: full body, sharpest kit texture.
 presentation:{surface:'presentation',glb:HUMAN_V2_ASSETS.presentation,kitResolution:1024,comicMaterial:true,kitDetail:true,shadows:true,dpr:[1,1.75],pose:'bust'},
 // Room view: phone geometry, medium kit, no shadow pass on handhelds.
 dorm:{surface:'dorm',glb:HUMAN_V2_ASSETS.phone,kitResolution:512,comicMaterial:true,kitDetail:true,shadows:false,dpr:[1,1.35],pose:'run'},
 // Match and practice: the trimmed 7.5k-vertex model, cheapest kit, cel shading kept.
 match:{surface:'match',glb:HUMAN_V2_ASSETS.match,kitResolution:512,comicMaterial:true,kitDetail:false,shadows:false,dpr:[1,1],pose:'kick'},
 // Handheld presentation: mobile geometry, smaller kit atlas, no shadow pass.
 phone:{surface:'phone',glb:HUMAN_V2_ASSETS.phone,kitResolution:512,comicMaterial:true,kitDetail:true,shadows:false,dpr:[1,1.25],pose:'phone'},
};

export function characterLod(surface:CharacterSurface):CharacterLod{return {...LODS[surface],dpr:[...LODS[surface].dpr] as [number,number]}}
export function characterSurfaces():CharacterSurface[]{return Object.keys(LODS) as CharacterSurface[]}
/** Deterministic sample order used by the appearance sheet and its tests. */
export const COMIC_SAMPLE_VIEWS=['bust','run','kick','phone'] as const;
export type ComicSampleView=typeof COMIC_SAMPLE_VIEWS[number];
