import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {COMIC_HUMAN_V1,COMIC_SAMPLE_VIEWS,characterLod,characterSurfaces} from '../lib/comic-character.ts';
import {HUMAN_V2_ASSETS,HUMAN_V2_HASHES} from '../lib/player-v2-manifest.ts';
import {COMIC_BANDS,COMIC_SHADER_ID,applyComicMaterial} from '../lib/comic-material.ts';
import {COMIC_PROFILE} from '../lib/comic-presentation.ts';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url));
const digest=(path:string)=>createHash('sha256').update(read(path)).digest('hex');

test('comic-human-v1 reuses the published human-v2 geometry without touching its files',()=>{
 assert.equal(COMIC_HUMAN_V1.id,'comic-human-v1');
 assert.equal(COMIC_HUMAN_V1.version,1);
 assert.equal(COMIC_HUMAN_V1.geometrySource,'human-v2');
 assert.deepEqual(COMIC_HUMAN_V1.geometryHashes,HUMAN_V2_HASHES);
 assert.equal(COMIC_HUMAN_V1.immutableAfterPublication,true);
 assert.equal(COMIC_HUMAN_V1.license,'CC0-1.0');
});

test('every surface resolves to a real published LOD with its own kit budget',()=>{
 const surfaces=characterSurfaces();
 assert.deepEqual(surfaces,['presentation','dorm','match','phone']);
 assert.equal(characterLod('presentation').glb,HUMAN_V2_ASSETS.presentation);
 assert.equal(characterLod('presentation').kitResolution,1024);
 assert.equal(characterLod('phone').glb,HUMAN_V2_ASSETS.phone);
 assert.equal(characterLod('phone').kitResolution,512);
 assert.equal(characterLod('match').glb,HUMAN_V2_ASSETS.match);
 assert.equal(characterLod('dorm').glb,HUMAN_V2_ASSETS.phone);
 assert.equal(characterLod('match').shadows,false);
 assert.equal(characterLod('presentation').shadows,true);
 for(const surface of surfaces){const lod=characterLod(surface);assert(lod.kitResolution>=256&&lod.kitResolution<=1024);assert(lod.comicMaterial);assert(COMIC_SAMPLE_VIEWS.includes(lod.pose))}
 // Callers may not mutate the shared table.
 characterLod('phone').dpr[0]=9;
 assert.deepEqual(characterLod('phone').dpr,[1,1.25]);
});

test('the profile points at frozen sample files whose hashes match the asset contract',()=>{
 const manifest=JSON.parse(read('public/assets/comic-human-v1/manifest.json').toString());
 assert.equal(manifest.assetVersion,COMIC_HUMAN_V1.id);
 assert.equal(manifest.geometrySource,COMIC_HUMAN_V1.geometrySource);
 assert.equal(manifest.license,COMIC_HUMAN_V1.license);
 assert.equal(manifest.shading.shader,COMIC_SHADER_ID);
 assert.equal(manifest.shading.bands,COMIC_BANDS);
 for(const lod of Object.values(manifest.surfaces) as {glb:string;kitResolution:number}[]){assert(lod.glb.endsWith('.glb'));assert(lod.kitResolution>=256)}
 assert.equal(manifest.surfaces.phone.glb,characterLod('phone').glb);
 assert.equal(manifest.surfaces.presentation.kitResolution,characterLod('presentation').kitResolution);
 const file=manifest.files['sample-sheet.svg'];
 assert.equal(file.bytes,read('public/assets/comic-human-v1/sample-sheet.svg').length);
 assert.equal(file.sha256,digest('public/assets/comic-human-v1/sample-sheet.svg'));
 assert.equal(COMIC_HUMAN_V1.sheet,'/assets/comic-human-v1/sample-sheet.svg');
 assert.equal(COMIC_HUMAN_V1.manifest,'/assets/comic-human-v1/manifest.json');
 const contract=JSON.parse(read('.openai/asset-contract.json').toString());
 const frozen=contract.versions['comic-human-v1'];
 assert.equal(frozen.directory,'public/assets/comic-human-v1');
 for(const [name,expected]of Object.entries(frozen.files as Record<string,{bytes:number;sha256:string}>)){
  const path=`public/assets/comic-human-v1/${name}`;
  assert.equal(read(path).length,expected.bytes,name);
  assert.equal(digest(path),expected.sha256,name);
 }
});

test('the cel profile is a rendering change only, not a geometry change',()=>{
 assert.equal(COMIC_PROFILE.id,'comic-v2');
 assert.equal(COMIC_PROFILE.shadingBands,COMIC_BANDS);
 assert.equal(COMIC_PROFILE.shader,COMIC_SHADER_ID);
 assert.equal(COMIC_PROFILE.originalGeometryPreserved,true);
 assert.deepEqual([...COMIC_PROFILE.sourceGeometry],['human-v1','human-v2']);
 const material={roughness:.5,metalness:.2,normalMap:{},roughnessMap:{}} as unknown as Parameters<typeof applyComicMaterial>[0];
 applyComicMaterial(material);
 assert.equal(material.roughness,1);assert.equal(material.metalness,0);
 assert.equal(material.normalMap,null);assert.equal(material.roughnessMap,null);
 assert.equal(material.customProgramCacheKey?.(),'qfc-comic-v2');
});

test('the sample sheet keeps its four deterministic views in order',()=>{
 assert.deepEqual([...COMIC_SAMPLE_VIEWS],['bust','run','kick','phone']);
 assert.deepEqual(characterSurfaces().map(surface=>characterLod(surface).pose),['bust','run','kick','phone']);
});
