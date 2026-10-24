import * as THREE from 'three';

// A PCF lookup covers neighbouring shadow texels. On an angled receiver they
// have different depths even when they belong to that very same flat surface.
// Compensate for that slope instead of relying on a large constant world offset.
// This avoids striped self-shadows on broad panels and shallow road views.
const receiverChunk=THREE.ShaderChunk.shadowmap_pars_fragment.replace(
 'shadowCoord.z += shadowBias;',`
 vec3 shadowDx=dFdx(shadowCoord.xyz),shadowDy=dFdy(shadowCoord.xyz);
 float shadowDet=shadowDx.x*shadowDy.y-shadowDx.y*shadowDy.x;
 vec2 receiverSlope=vec2(0.);
 if(abs(shadowDet)>1.e-12){
   receiverSlope=vec2(
     shadowDx.z*shadowDy.y-shadowDy.z*shadowDx.y,
     shadowDy.z*shadowDx.x-shadowDx.z*shadowDy.x
   )/shadowDet;
 }
 // PCFSoft can reach two texels past the receiver; include the half-texel
 // centre offset as well. The cap handles nearly edge-on projections.
 float receiverBias=min(.004,dot(abs(receiverSlope),1./shadowMapSize)*2.5);
 shadowCoord.z += shadowBias-receiverBias;
 `);

export function stabilizeSurfaceShadows(material){
 if(!material.isMeshStandardMaterial||material.userData.receiverPlaneShadowBias)return;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',receiverChunk);
 };
 material.customProgramCacheKey=()=>`${key}-receiver-plane-bias-v1`;
 material.userData.receiverPlaneShadowBias=true;material.needsUpdate=true;
}

export function stabilizeSceneShadows(scene){
 scene.traverse(object=>{
   if(!object.isMesh)return;
   for(const material of Array.isArray(object.material)?object.material:[object.material])stabilizeSurfaceShadows(material);
 });
}
