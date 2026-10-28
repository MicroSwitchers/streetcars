import * as THREE from 'three';
import {mergeGeometries} from 'geometry-utils';
import {stabilizeSceneShadows} from './shadow-bias.js';

function finishStreetcarPaint(paint){
 if(paint.userData.streetcarPaint)return;
 paint.roughness=.58;paint.clearcoat=1;paint.clearcoatRoughness=.13;
 paint.envMapIntensity=2.2;
 const boost={value:paint.envMapIntensity},compile=paint.onBeforeCompile,key=paint.customProgramCacheKey();
 // Three uses scene.environmentIntensity in place of the material's setting
 // when the environment comes from the scene. Boost only reflected radiance,
 // after weather-map blending, rather than brightening the whole neighbourhood.
 paint.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);shader.uniforms.streetcarPaintReflection=boost;
  shader.fragmentShader='uniform float streetcarPaintReflection;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
   radiance*=streetcarPaintReflection;
   #ifdef USE_CLEARCOAT
    clearcoatRadiance*=streetcarPaintReflection;
   #endif`);
 };
 paint.customProgramCacheKey=()=>key+'-streetcar-paint-reflections-v1';
 paint.userData.streetcarPaint={reflection:boost};paint.needsUpdate=true;
}

function contactShadow(){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=1024;
 const ctx=canvas.getContext('2d');ctx.filter='blur(16px)';
 ctx.fillStyle='rgba(0,0,0,.34)';ctx.beginPath();ctx.roundRect(47,55,162,914,40);ctx.fill();
 ctx.filter='blur(10px)';ctx.fillStyle='rgba(0,0,0,.25)';
 for(const y of [255,770]){ctx.beginPath();ctx.ellipse(128,y,85,76,0,0,Math.PI*2);ctx.fill();}
 const map=new THREE.CanvasTexture(canvas);
 const material=new THREE.MeshBasicMaterial({map,transparent:true,opacity:.58,
   depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.1,16.6),material);
 shadow.name='Soft_Contact_Shadow';shadow.rotation.x=-Math.PI/2;
 shadow.position.y=.018;shadow.renderOrder=1;return shadow;
}

function stabilizeBumperTrim(car,rig){
 const baked=car.getObjectByName('Bumper_Chrome_Trim');
 if(baked){
   baked.castShadow=false;baked.receiveShadow=false;
   baked.material.envMapIntensity=.95;
   return;
 }
 const source=car.getObjectByName('Body_Static__Polished_Trim');
 if(!source)return;
 rig.root.updateWorldMatrix(true,true);
 const toRoot=new THREE.Matrix4().copy(rig.root.matrixWorld).invert().multiply(source.matrixWorld);
 const geometry=source.geometry,position=geometry.attributes.position,point=new THREE.Vector3();
 const isBumper=new Uint8Array(position.count);
 for(let i=0;i<position.count;i++){
   point.fromBufferAttribute(position,i).applyMatrix4(toRoot);
   // The four narrow chrome strips at the front and rear lower bumper. Other
   // polished parts in this merged GLB mesh keep their original material.
   isBumper[i]=point.y>.24&&point.y<.70&&Math.abs(point.z)>6.5?1:0;
 }
 const bumperIndices=[],bodyIndices=[],index=geometry.index;
 for(let i=0;i<(index?index.count:position.count);i+=3){
   const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j);
   (triangle.every(vertex=>isBumper[vertex])?bumperIndices:bodyIndices).push(...triangle);
 }
 if(!bumperIndices.length)return;
 function subset(indices){
   const result=new THREE.BufferGeometry(),remap=new Map(),vertices=[],triangles=[];
   for(const vertex of indices){if(!remap.has(vertex)){remap.set(vertex,vertices.length);vertices.push(vertex);}triangles.push(remap.get(vertex));}
   for(const [name,attribute] of Object.entries(geometry.attributes)){
     const values=new Float32Array(vertices.length*attribute.itemSize),getters=['getX','getY','getZ','getW'];
     vertices.forEach((vertex,i)=>{for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=attribute[getters[j]](vertex);});
     result.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
   }
   result.setIndex(triangles);result.computeBoundingBox();result.computeBoundingSphere();return result;
 }
 source.geometry=subset(bodyIndices);
 const material=source.material.clone();material.name='Bumper_Satin_Chrome';
 Object.assign(material,{roughness:.42,metalness:.9,envMapIntensity:.95});
 const bumper=new THREE.Mesh(subset(bumperIndices),material);bumper.name='Bumper_Chrome_Trim';
 bumper.position.copy(source.position);bumper.quaternion.copy(source.quaternion);bumper.scale.copy(source.scale);
 // These 24 mm strips are smaller than one sun-shadow texel. The full skirt
 // still casts/receives shadows; tiny chrome self-shadows caused the flashing.
 bumper.castShadow=false;bumper.receiveShadow=false;source.parent.add(bumper);
}

// Rounded die-cast cobra heads on Toronto Hydro's curved six-foot brackets.
// Profiles share one small mesh per material; the existing poles carry the arm.
function cobraHeadParts(){
 function profile(rings,sides=10){
  const positions=[],uv=[],indices=[];
  for(const [i,[x,y,ry,rz]] of rings.entries())for(let j=0;j<sides;j++){const a=j*Math.PI*2/sides;positions.push(x,y+Math.cos(a)*ry,.15+Math.sin(a)*rz);uv.push(i/(rings.length-1),j/sides);}
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,d,a,d,c);}
  for(const end of [0,rings.length-1]){const centre=positions.length/3,[x,y]=rings[end];positions.push(x,y,.15);uv.push(.5,.5);for(let j=0;j<sides;j++){const a=end*sides+j,b=end*sides+(j+1)%sides;indices.push(centre,...(end?[a,b]:[b,a]));}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 const curve=new THREE.CatmullRomCurve3([[.015,0,0],[.35,.25,.05],[.85,.65,.12],[1.5,.88,.15],[1.83,.9,.15]].map(p=>new THREE.Vector3(...p)));
 const arm=new THREE.TubeGeometry(curve,9,.034,6,false),plate=new THREE.BoxGeometry(.06,.31,.18);plate.translate(.025,0,0);
 const shell=profile([[1.68,.89,.05,.065],[1.82,.94,.11,.18],[2.06,.95,.13,.235],[2.35,.925,.105,.20],[2.50,.90,.07,.14],[2.58,.88,.012,.012]]);
 const lens=profile([[1.85,.79,.015,.035],[1.98,.79,.075,.175],[2.17,.79,.095,.195],[2.38,.79,.07,.15],[2.46,.79,.012,.025]]);
 const rim=profile([[1.84,.81,.015,.035],[1.98,.81,.018,.185],[2.17,.81,.018,.205],[2.38,.81,.018,.16],[2.47,.81,.012,.025]]);
 const cell=new THREE.CylinderGeometry(.036,.036,.035,6);cell.translate(1.98,1.095,.15);
 const straps=[-.10,.10].map(y=>new THREE.BoxGeometry(.17,.035,.19).translate(0,y,0));
 const housing=mergeGeometries([arm,plate,shell]),hardware=mergeGeometries([rim,cell,...straps]);
 for(const g of [arm,plate,shell,rim,cell,...straps])g.dispose();return {housing,hardware,lens};
}

function createStreetLights(scene,route){
 const fixtureZ=[],heads=[],meshes=[],parts=cobraHeadParts(),dummy=new THREE.Object3D();
 const sodium=0xffc34a,metal=new THREE.MeshStandardMaterial({color:0x9b9d95,metalness:.65,roughness:.47});
 const hardware=new THREE.MeshStandardMaterial({color:0x4d5554,metalness:.7,roughness:.52});
 const glass=new THREE.MeshStandardMaterial({color:0xc8c4b4,emissive:0xffbf42,emissiveIntensity:0,metalness:.06,roughness:.27,flatShading:true});
 // These positions are shared with the catenary poles in buildEnvironment.
 for(let z=-510;z<=665;z+=34){
  if((route?.crossings??[{z:-100},{z:100},{z:300}]).some(c=>Math.abs(z-c.z)<14))continue;
  for(const side of [-1,1])heads.push({side,z,x:side*8.05,y:6,lampX:side*(8.05-2.16),lampY:6.69,lampZ:z-side*.15});
  if(z<-238||z>374)continue;
  const side=fixtureZ.length%2===0?1:-1,head=heads.find(h=>h.z===z&&h.side===side);
  const target=new THREE.Object3D();target.position.set(side*3.65,.04,head.lampZ);
  const light=new THREE.SpotLight(sodium,0,30,.95,.85,1.5);light.name='Toronto_Sodium_Streetlight';light.position.set(head.lampX,head.lampY,head.lampZ);light.target=target;light.userData.volumetricScale=.3;scene.add(light,target);
  fixtureZ.push({...head,light,target});
 }
 const poolCanvas=document.createElement('canvas');poolCanvas.width=128;poolCanvas.height=128;
 const ctx=poolCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,2,64,64,62);
 gradient.addColorStop(0,'rgba(255,255,255,.28)');gradient.addColorStop(.45,'rgba(255,255,255,.12)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const poolMap=new THREE.CanvasTexture(poolCanvas);
 const poolMaterial=new THREE.MeshBasicMaterial({map:poolMap,color:sodium,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
 const poolGeometry=new THREE.PlaneGeometry(8,9);
 const cells=new Map();for(const h of heads){const key=Math.floor(h.z/96);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(h);}
 for(const cell of cells.values()){
  for(const [name,geometry,material] of [['Housing',parts.housing,metal],['Hardware',parts.hardware,hardware],['Refractor',parts.lens,glass],['Pavement',poolGeometry,poolMaterial]]){
   const mesh=new THREE.InstancedMesh(geometry,material,cell.length);mesh.name='Toronto_Cobra_Head_'+name;mesh.castShadow=false;mesh.receiveShadow=name==='Housing';
   for(const [i,h] of cell.entries()){
    if(name==='Pavement'){dummy.position.set(h.side*5.6,.012,h.lampZ);dummy.rotation.set(-Math.PI/2,0,0);}else{dummy.position.set(h.x,h.y,h.z);dummy.rotation.set(0,h.side===1?Math.PI:0,0);}
    dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(name==='Refractor')h.bulb=mesh;
   }
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();if(name==='Pavement')mesh.renderOrder=1;scene.add(mesh);meshes.push(mesh);
  }
 }
 for(const f of fixtureZ)f.bulb=heads.find(h=>h.z===f.z&&h.side===f.side).bulb;
 const dayLens=new THREE.Color(0xc8c4b4),nightLens=new THREE.Color(0xffd878);
 const stats={heads:heads.length,fixtures:fixtureZ.length,meshes:meshes.length,trianglesPerHead:Object.values(parts).reduce((sum,g)=>sum+g.index.count/3,0),texturePixels:128*128,colour:sodium};
 let amount=0;
 return {
   fixtures:fixtureZ,heads,meshes,stats,
   setNight(value){amount=THREE.MathUtils.clamp(value,0,1);poolMaterial.opacity=amount*.66;
     glass.color.copy(dayLens).lerp(nightLens,amount);glass.emissiveIntensity=amount*1.8;
   },
   update(z){
     const nearby=fixtureZ.map(fixture=>({fixture,distance:Math.abs(fixture.z-z)})).sort((a,b)=>a.distance-b.distance);
     for(const {fixture,distance} of nearby){
       const reach=THREE.MathUtils.clamp(1-distance/42,0,1);
       fixture.light.intensity=amount*42*(.38+.62*reach);
     }
   },
   dispose(){poolMap.dispose();poolGeometry.dispose();poolMaterial.dispose();for(const g of Object.values(parts))g.dispose();for(const m of [metal,hardware,glass])m.dispose();for(const mesh of meshes)mesh.removeFromParent();for(const f of fixtureZ){f.light.removeFromParent();f.target.removeFromParent();}}
 };
}

export function createDaylight(renderer,scene,route){
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const keyOffset=new THREE.Vector3(34,48,38),direction=keyOffset.clone().normalize();
 // The weather system supplies the actual HDR sky and cached reflection probes.
 // Avoid generating a second 1024x512 sky and PMREM that would be replaced
 // before the first playable frame (especially expensive on mobile CPUs).
 const environment={get texture(){return scene.environment;},dispose(){}};
 scene.environment=null;scene.environmentIntensity=.72;
 scene.background=new THREE.Color(0x9aabb7);scene.backgroundIntensity=1;
 scene.fog=new THREE.FogExp2(0xc1cdd6,.0032);

 const hemi=new THREE.HemisphereLight(0xc3ddf4,0x80735d,.65);
 hemi.name='Sky_And_Pavement_Bounce';scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xffebd1,3.2);
 const daySunColor=sun.color.clone(),nightSunColor=new THREE.Color(0x8095bd);
 sun.name='Warm_Daylight';sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:4,far:150});
 sun.shadow.radius=2;
 sun.shadow.bias=-.00015;sun.shadow.normalBias=.035;
 scene.add(sun,sun.target);
 const fill=new THREE.DirectionalLight(0xc8def6,.30);
 const dayFillColor=fill.color.clone(),nightFillColor=new THREE.Color(0x526b9a);
 fill.name='Soft_Street_Fill';fill.castShadow=false;scene.add(fill,fill.target);
 const dayHemiSky=hemi.color.clone(),nightHemiSky=new THREE.Color(0x52698e);
 const dayHemiGround=hemi.groundColor.clone(),nightHemiGround=new THREE.Color(0x242d41);
 const dayFog=scene.fog.color.clone(),nightFog=new THREE.Color(0x182536);
 const duskFog=new THREE.Color(0xd99b7f);
 const sunsetSun=new THREE.Color(0xf5b77e),weatherFog=new THREE.Color(),weatherDayFog=new THREE.Color(0x9aabb5),weatherNightFog=new THREE.Color(0x263646);
 const goldenSun=new THREE.Color(0xffae61),goldenSky=new THREE.Color(0x7897c7),goldenGround=new THREE.Color(0x9f704c),goldenFog=new THREE.Color(0xe8a783);

 // Snap only the shadow projection to its texel grid, avoiding crawling edges.
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const centre=new THREE.Vector3(),snapped=new THREE.Vector3();let texel=60/2048;
 const sky=new THREE.Group();sky.name='Daylight_Anchor';
 const streetLights=createStreetLights(scene,route);
 const volumeLights=streetLights.fixtures.map(f=>f.light);
 const streetcarRigs=new Set();let nightAmount=0,weather={cloud:.18,haze:0};
 function update(z){
   centre.set(0,0,z);
   snapped.copy(centre)
     .addScaledVector(right,Math.round(centre.dot(right)/texel)*texel-centre.dot(right))
     .addScaledVector(up,Math.round(centre.dot(up)/texel)*texel-centre.dot(up));
   sun.position.copy(snapped).add(keyOffset);sun.target.position.copy(snapped);
   fill.position.set(-28,22,z+18);fill.target.position.set(0,1.5,z);
   sky.position.z=z;
   streetLights.update(z);
 }
 function setNight(amount){
   const night=THREE.MathUtils.clamp(amount,0,1);
   nightAmount=night;for(const rig of streetcarRigs)rig.setNight(night);
   const twilight=THREE.MathUtils.smoothstep(night,.08,.52)*(1-THREE.MathUtils.smoothstep(night,.52,.96));
   sun.intensity=THREE.MathUtils.lerp(3.2,.14,night);sun.color.copy(daySunColor).lerp(nightSunColor,night);
   hemi.intensity=THREE.MathUtils.lerp(.65,.44,night);hemi.color.copy(dayHemiSky).lerp(nightHemiSky,night);
   hemi.groundColor.copy(dayHemiGround).lerp(nightHemiGround,night);
   fill.intensity=THREE.MathUtils.lerp(.30,.20,night);fill.color.copy(dayFillColor).lerp(nightFillColor,night);
   scene.environmentIntensity=THREE.MathUtils.lerp(.72,.80,night);
   scene.backgroundIntensity=THREE.MathUtils.lerp(1,.13,night);
   scene.fog.color.copy(dayFog).lerp(nightFog,night).lerp(duskFog,twilight*.72);
   scene.fog.density=THREE.MathUtils.lerp(.0032,.006,night)+twilight*.0008;
   streetLights.setNight(night);
   const overcast=THREE.MathUtils.smoothstep(weather.cloud,.2,1.);
   sun.intensity*=(1-overcast*.87)*(1-overcast*.65);
   sun.color.lerp(sunsetSun,twilight*(1-overcast)*.60);
   hemi.intensity*=1+overcast*.25;fill.intensity*=1-overcast*.25;
   scene.environmentIntensity*=1-overcast*.18;
   scene.fog.density=weather.enabled===false?0:(THREE.MathUtils.lerp(.0019,.0044,night)+weather.haze*.009)*(weather.effectWeight??1);
   scene.fog.color.lerp(weatherFog.copy(weatherDayFog).lerp(weatherNightFog,night),overcast*.30+weather.haze*.30);
   const gold=(weather.gold??0)*(1-night);
   sun.color.lerp(goldenSun,gold);sun.intensity*=1+gold*.15;
   hemi.color.lerp(goldenSky,gold*.45);hemi.groundColor.lerp(goldenGround,gold*.45);hemi.intensity*=1-gold*.10;
   fill.intensity*=1-gold*.2;scene.environmentIntensity*=1-gold*.05;
   scene.fog.color.lerp(goldenFog,gold*.35);renderer.toneMappingExposure=1;
   // The tablet's short far plane clips the full sky dome. Its inexpensive
   // background must follow the same atmosphere instead of staying daytime grey.
   if(renderer.userData.compatibility)scene.background.copy(scene.fog.color);
 }
 function addStreetcar(car,rig){
   streetcarRigs.add(rig);rig.setNight(nightAmount);
   car.add(contactShadow());
   stabilizeBumperTrim(car,rig);
   // Gloss enamel keeps its surface texture and gains a visible clear top coat.
   for(const name of ['TTC_Vermilion','Warm_Ivory']){
     const paint=rig.materials.get(name);if(paint)finishStreetcarPaint(paint);
   }
   const glass=rig.materials.get('Tinted_Glass');
   if(glass){glass.color.setHex(0x79949b);glass.opacity=.23;glass.roughness=.12;glass.envMapIntensity=1.3;glass.depthWrite=false;}
   const decals=rig.materials.get('Markings_Atlas');
   if(decals)Object.assign(decals,{depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
   const skirt=rig.materials.get('Brushed_Skirt');
   if(skirt){skirt.envMapIntensity=1.1;skirt.roughness=skirt.roughnessMap?1:.42;}
   for(const light of rig.emitters){
     if(light.isSpotLight){light.userData.nightIntensity=45;light.distance=25;light.penumbra=.7;volumeLights.push(light);}
     else{light.userData.nightIntensity=3.2;light.distance=4.8;}
   }
   rig.setLights({});
   stabilizeSceneShadows(scene);
 }
 update(0);
 return {sun,sky,fill,hemi,update,setNight,volumeLights,setWeather(value,amount=nightAmount){
   // Automatic weather reuses a mutable interpolated profile. Recompute the
   // basis from its current direction, not from object identity.
   direction.set(...value.sun).normalize();keyOffset.copy(direction).multiplyScalar(68);
   right.set(0,1,0).cross(direction).normalize();up.crossVectors(direction,right).normalize();
   weather=value;setNight(amount);update(sky.position.z);
 },setQuality(profile){if(sun.shadow.mapSize.x!==profile.shadow){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(profile.shadow,profile.shadow);sun.shadow.needsUpdate=true;texel=60/profile.shadow;}},addStreetcar,environment,streetLights,
   dispose(){streetLights.dispose();environment.dispose();}};
}
