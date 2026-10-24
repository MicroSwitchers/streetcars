import * as THREE from 'three';

export const SHOP_LIGHTS=[
 {color:0xffc887,power:1.30},{color:0xffe2b1,power:1.05},
 {color:0xd9eaff,power:.85},{color:0xc5e6e4,power:.90},
 {color:0xffd5bd,power:1.18},{color:0xffdca2,power:.72},
 {color:0x8fa4ba,power:.035},
];
export function shopLighting(index){
 const choices=[1,2,0,1,3,2,0,5,4,0,3,1,4,2,5,0];
 const style=(index*7+3)%13===0?6:choices[index%choices.length];
 const profile=SHOP_LIGHTS[style],power=profile.power*(.80+((index*17)%11)*.045);
 return {style,color:profile.color,power};
}

export function retailMaterial(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.vertexShader='attribute vec3 instanceIllumination;varying vec3 vShopIllumination;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvShopIllumination=instanceIllumination;');
   shader.fragmentShader='varying vec3 vShopIllumination;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = emissive * vShopIllumination;');
 };
 material.customProgramCacheKey=()=>key+'-retail-instance-lighting-v3';
}

function variedWindows(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.vertexShader='varying vec3 vOccupiedWindow;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     vec4 windowCentre=vec4(0.,0.,0.,1.);
     #ifdef USE_INSTANCING
     windowCentre=instanceMatrix*windowCentre;
     #endif
     vec3 windowWorld=(modelMatrix*windowCentre).xyz;
     float windowSeed=fract(sin(dot(floor(windowWorld*vec3(3.,4.,3.)+.013),vec3(12.9898,78.233,37.719)))*43758.5453);
     vec3 windowKelvin=mix(vec3(1.,.57,.23),vec3(1.,.82,.56),smoothstep(.30,.70,windowSeed));
     if(windowSeed>.78)windowKelvin=vec3(.50,.72,1.);
     float occupancy=windowSeed<.24?.025:.65+fract(windowSeed*17.)*2.45;
     if(windowWorld.y<4.)occupancy*=.06;
     vOccupiedWindow=windowKelvin*occupancy;`);
   shader.fragmentShader='varying vec3 vOccupiedWindow;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance=emissive*vOccupiedWindow;');
 };
 material.customProgramCacheKey=()=>key+'-occupied-windows-v2';
}

// Projected irradiance is evaluated on the existing PBR paving, not on stacked
// transparent decals. Soft mullion shadows widen away from each shop window.
export function createWindowLighting(scene,mats,displays){
 const count=24,night={value:0},positions={value:Array.from({length:count},()=>new THREE.Vector4())},colors={value:Array.from({length:count},()=>new THREE.Vector4())};
 const windows=displays.filter(b=>b.lighting.style!==6).map(b=>({...b,lightColor:new THREE.Color(b.lighting.color).multiplyScalar(b.lighting.power)}));
 const shopSources=windows.filter((w,i)=>i===windows.findIndex(b=>b.index===w.index));
 let lastFocus=Infinity,amount=0;
 const irradiance=`
   vec3 shopIrradiance=vec3(0.);
   if(windowNight>.001&&vPavingNormal.y>.65){
     for(int i=0;i<24;i++){
       vec4 lamp=windowPositions[i],radiance=windowColors[i];
       float outward=lamp.w*(lamp.x-vPavingPosition.x);
       float along=vPavingPosition.z-lamp.y-outward*radiance.w;
       float reach=smoothstep(-.15,.2,outward)*(1.-smoothstep(3.1,7.,outward));
       float spread=lamp.z+outward*.065,edge=.12+max(0.,outward)*.09;
       float shape=1.-smoothstep(spread-edge,spread+edge,abs(along));
       float mullion=.30+.70*smoothstep(.035,.065+max(0.,outward)*.075,abs(along));
       float falloff=1./(1.+max(0.,outward)*.23);
       shopIrradiance+=radiance.rgb*reach*shape*mullion*falloff*windowNight*.50;
     }
   }
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*shopIrradiance;
   reflectedLight.indirectSpecular+=shopIrradiance*.12*(1.-roughnessFactor)*(.3+metalnessFactor);
 `;
 for(const material of [mats.concrete,mats.curb,mats.road]){
   const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){
     compile.call(this,shader,renderer);Object.assign(shader.uniforms,{windowNight:night,windowPositions:positions,windowColors:colors});
     shader.vertexShader='varying vec3 vPavingPosition;varying vec3 vPavingNormal;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       vec4 pavingPosition=vec4(transformed,1.);vec3 pavingNormal=normal;
       #ifdef USE_INSTANCING
       pavingPosition=instanceMatrix*pavingPosition;pavingNormal=mat3(instanceMatrix)*pavingNormal;
       #endif
       vPavingPosition=(modelMatrix*pavingPosition).xyz;vPavingNormal=normalize(mat3(modelMatrix)*pavingNormal);`);
     shader.fragmentShader='uniform float windowNight;uniform vec4 windowPositions[24];uniform vec4 windowColors[24];varying vec3 vPavingPosition;varying vec3 vPavingNormal;\n'+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\n'+irradiance);
   };
   material.customProgramCacheKey=()=>key+'-window-paving-v3';
 }
 variedWindows(mats.glass);
 const fixtures=[];
 for(const side of [-1,1])for(let group=0;group<2;group++){
   const light=new THREE.PointLight(0xffffff,0,11,2);light.name='Pooled_Shop_Light_'+side+'_'+group;light.castShadow=false;scene.add(light);
   fixtures.push({side,group,light,window:null});
 }
 function update(z){
   if(Math.abs(z-lastFocus)<.25)return;lastFocus=z;
   const nearby=windows.slice().sort((a,b)=>Math.abs(a.z-z)-Math.abs(b.z-z)).slice(0,count);
   for(let i=0;i<count;i++){
     const w=nearby[i];if(!w){colors.value[i].set(0,0,0,0);continue;}
     const fade=1-THREE.MathUtils.smoothstep(Math.abs(w.z-z),32,48);
     positions.value[i].set(w.windowX,w.z,w.width/2,w.side);
     colors.value[i].set(w.lightColor.r*fade,w.lightColor.g*fade,w.lightColor.b*fade,(w.index%2===0?1:-1)*.20);
   }
   for(const f of fixtures){
     const w=shopSources.filter(b=>b.side===f.side&&b.index%2===f.group).sort((a,b)=>Math.abs(a.z-z)-Math.abs(b.z-z))[0];
     f.window=w;if(!w){f.light.intensity=0;continue;}
     const fade=1-THREE.MathUtils.smoothstep(Math.abs(w.z-z),4,8.5);
     f.light.color.setHex(w.lighting.color);f.light.position.set(w.side*11.80,2.40,w.z);
     f.light.intensity=amount*11*w.lighting.power*fade;
   }
 }
 const before=scene.onBeforeRender;
 scene.onBeforeRender=function(renderer,world,camera,target){before.call(this,renderer,world,camera,target);update(camera.position.z);};
 return {fixtures,windows,positions,colors,night,update,setNight(value){
   const next=THREE.MathUtils.clamp(value,0,1);if(next===amount)return;
   amount=next;night.value=amount;const z=lastFocus;lastFocus=Infinity;if(Number.isFinite(z))update(z);
 },dispose(){fixtures.forEach(f=>f.light.removeFromParent());scene.onBeforeRender=before;}};
}
