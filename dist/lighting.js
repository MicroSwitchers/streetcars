import * as THREE from 'three';
import {stabilizeSceneShadows} from './shadow-bias.js';

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

function createStreetLights(scene){
 const poleX=8.05,fixtureZ=[];
 for(let z=-238;z<=374;z+=34){
   if([-100,100,300].some(cross=>Math.abs(z-cross)<20))continue;
   const side=fixtureZ.length%2===0?1:-1,x=side*poleX;
   const arm=new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,1,8),new THREE.MeshStandardMaterial({color:0x39423d,metalness:.65,roughness:.5}));
   arm.position.set(x-side*.62,5.35,z);arm.rotation.z=side*Math.PI/2;arm.scale.set(1,2.0,1);scene.add(arm);
   const shade=new THREE.Mesh(new THREE.CylinderGeometry(.17,.24,.11,12),new THREE.MeshStandardMaterial({color:0x3c443c,metalness:.5,roughness:.55}));
   shade.position.set(x-side*1.58,5.24,z);scene.add(shade);
   const bulb=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),new THREE.MeshStandardMaterial({color:0xffdda0,emissive:0xffa943,emissiveIntensity:0,roughness:.35}));
   bulb.position.set(x-side*1.58,5.16,z);scene.add(bulb);
   const target=new THREE.Object3D();target.position.set(x-side*4.4,.04,z);scene.add(target);
   const light=new THREE.SpotLight(0xffc77a,0,30,.95,.85,1.5);light.position.set(x-side*1.58,5.12,z);light.target=target;scene.add(light);
   fixtureZ.push({z,light,bulb});
 }
 const poolCanvas=document.createElement('canvas');poolCanvas.width=128;poolCanvas.height=128;
 const ctx=poolCanvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,2,64,64,62);
 gradient.addColorStop(0,'rgba(255,190,105,.28)');gradient.addColorStop(.45,'rgba(255,177,91,.12)');gradient.addColorStop(1,'rgba(255,169,78,0)');
 ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
 const poolMap=new THREE.CanvasTexture(poolCanvas);
 const poolMaterial=new THREE.MeshBasicMaterial({map:poolMap,color:0xffc77a,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
 const poolGeometry=new THREE.PlaneGeometry(8,9);
 fixtureZ.forEach(({z},i)=>{
   const side=i%2===0?1:-1,pool=new THREE.Mesh(poolGeometry,poolMaterial);
   pool.rotation.x=-Math.PI/2;pool.position.set(side*5.6,.012,z);pool.renderOrder=1;scene.add(pool);
 });
 let amount=0;
 return {
   fixtures:fixtureZ,
   setNight(value){amount=THREE.MathUtils.clamp(value,0,1);poolMaterial.opacity=amount*.8;
     for(const {bulb} of fixtureZ)bulb.material.emissiveIntensity=amount*2.2;
   },
   update(z){
     const nearby=fixtureZ.map(fixture=>({fixture,distance:Math.abs(fixture.z-z)})).sort((a,b)=>a.distance-b.distance);
     for(const {fixture,distance} of nearby){
       const reach=THREE.MathUtils.clamp(1-distance/42,0,1);
       fixture.light.intensity=amount*32*(.38+.62*reach);
     }
   },
   dispose(){poolMap.dispose();poolGeometry.dispose();poolMaterial.dispose();}
 };
}

export function createDaylight(renderer,scene){
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
 const streetLights=createStreetLights(scene);
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
   // Keep the original paint textures and livery, with readable glass and metal.
   for(const name of ['TTC_Vermilion','Warm_Ivory']){
     const paint=rig.materials.get(name);if(paint){paint.envMapIntensity=1.2;paint.clearcoat=.8;paint.clearcoatRoughness=.21;}
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
