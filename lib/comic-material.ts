import type {MeshStandardMaterial} from 'three';

/** Version of the cel profile; bump only when the shading result changes. */
export const COMIC_SHADER_ID='qfc-comic-v2';
export const COMIC_BANDS=4;

/**
 * Original material profile shared by presentation, room and football renderers.
 * Geometry, UVs and textures stay untouched: this only rewrites the final colour
 * into four cel bands with cooler shadows and warmer highlights.
 */
export function applyComicMaterial(material:MeshStandardMaterial){
 material.roughness=1;material.metalness=0;material.normalMap=null;material.roughnessMap=null;
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
 float comicLuma=max(dot(gl_FragColor.rgb,vec3(0.2126,0.7152,0.0722)),0.001);
 float comicBand=(floor(clamp(comicLuma,0.0,1.5)*${COMIC_BANDS}.0)+0.5)/${COMIC_BANDS}.0;
 vec3 comicCell=gl_FragColor.rgb*(comicBand/comicLuma);
 vec3 comicShadow=comicCell*vec3(0.86,0.90,1.07);
 vec3 comicKey=comicCell*vec3(1.06,1.01,0.94);
 vec3 comicTint=mix(comicShadow,comicKey,smoothstep(0.32,0.78,comicBand));
 gl_FragColor.rgb=mix(gl_FragColor.rgb,comicTint,0.62);`)};
 material.customProgramCacheKey=()=>COMIC_SHADER_ID;return material;
}
