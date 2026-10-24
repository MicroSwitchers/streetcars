import * as THREE from 'three';
import {advanceTraffic,TRAFFIC_BOUNDS,STREETCAR_LENGTH,trafficLeader,separateFromStreetcars} from './traffic-flow.js';

// Far cars leave the detailed batches entirely; geometry and materials are shared.
export function buildStreetLife(scene,route,assets){
 const actors=[],batches=new Map(),matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),roll=new THREE.Matrix4(),transform=new THREE.Object3D();
 const palette=[0x345568,0xadb5b8,0x763e3b,0x34494a,0xc4c3b5,0x263444,0x9c9c94],white=new THREE.Color(0xffffff);
 const variants=[...assets.models.keys()];let focusZ=route.start,n=0,streetcarProvider=()=>[];
 const nightTail={value:0},tailMaterial=assets.materials.get('Car_Tail_Lens');
 tailMaterial.emissive.setHex(0xff1a0a);tailMaterial.emissiveIntensity=1;
 const compileTail=tailMaterial.onBeforeCompile,tailKey=tailMaterial.customProgramCacheKey();
 tailMaterial.onBeforeCompile=function(shader,renderer){
  compileTail.call(this,shader,renderer);shader.uniforms.carTailNight=nightTail;
  shader.vertexShader='attribute float instanceBrake; varying float vCarBrake;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCarBrake=instanceBrake;');
  shader.fragmentShader='uniform float carTailNight; varying float vCarBrake;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = emissive * (carTailNight + vCarBrake * 2.8);');
 };
 tailMaterial.customProgramCacheKey=()=>tailKey+'-car-brakes-v1';
 function vehicle(x,z,yaw,moving=false){
  const variant=variants[n%variants.length],color=new THREE.Color(palette[n++%palette.length]);
  const model=assets.models.get(variant);
  const actor={type:'car',x,z,yaw,moving,direction:yaw===0?1:-1,speed:moving?4.2+(n%5)*.25:0,cruise:5.2+(n%7)*.18,acceleration:.72+(n%4)*.06,length:model.levels[0].bounds.max.z-model.levels[0].bounds.min.z,distance:0,braking:0,respawns:0,variant,color,lod:Math.abs(z-focusZ)<62?0:1};actors.push(actor);
  model.levels.forEach((level,lod)=>level.parts.forEach(part=>{
   const key=variant+'/'+lod+'/'+part.geometry.uuid+'/'+part.material.uuid;
   if(!batches.has(key))batches.set(key,{lod,part,items:[],active:[],mesh:null});
   batches.get(key).items.push({actor,part,radius:model.radius});
  }));
  return actor;
 }
 for(const side of [-1,1])for(let z=-224;z<387;z+=29){
  if(Math.abs(z-route.start)<18||route.crossings.some(c=>Math.abs(z-c.z)<24)||route.stops.some(s=>Math.abs(z-s.z)<20))continue;
  vehicle(side*6.6,z,side===1?Math.PI:0);
 }
 for(const direction of [-1,1])for(let i=0;i<12;i++){
  const z=TRAFFIC_BOUNDS.min+22+i*(TRAFFIC_BOUNDS.max-TRAFFIC_BOUNDS.min)/12+(direction===1?25:0);
  vehicle(-direction*Math.abs(route.trackX),z,direction===1?0:Math.PI,true);
 }
 const initial=actors.map(a=>({z:a.z,speed:a.speed}));
 function write(batch,repack=false){
  if(repack){
   batch.active=batch.items.filter(item=>item.actor.lod===batch.lod);
   batch.dynamic=batch.active.some(item=>item.actor.moving);
   batch.mesh.count=batch.active.length;batch.mesh.visible=batch.active.length>0;
  }
  batch.active.forEach(({actor,part,radius},i)=>{
   transform.position.set(actor.x,.006,actor.z);transform.rotation.set(0,actor.yaw,0);transform.scale.set(1,1,1);transform.updateMatrix();matrix.copy(transform.matrix);
   local.makeTranslation(part.pivot.x,part.pivot.y,part.pivot.z);
   if(part.wheel)local.multiply(roll.makeRotationX(actor.distance/radius));
   matrix.multiply(local);batch.mesh.setMatrixAt(i,matrix);
   if(batch.brakes)batch.brakes.setX(i,actor.braking);
   if(repack)batch.mesh.setColorAt(i,part.paint?actor.color:white);
  });
  batch.mesh.instanceMatrix.needsUpdate=true;
  if(batch.brakes)batch.brakes.needsUpdate=true;
  if(repack){batch.mesh.instanceColor.needsUpdate=true;batch.mesh.frustumCulled=!batch.dynamic;batch.mesh.computeBoundingSphere();}
 }
 for(const [key,batch] of batches){
  const {material}=batch.part;
  const geometry=material===tailMaterial?batch.part.geometry.clone():batch.part.geometry;
  if(material===tailMaterial){batch.brakes=new THREE.InstancedBufferAttribute(new Float32Array(batch.items.length),1);geometry.setAttribute('instanceBrake',batch.brakes);}
  const mesh=batch.mesh=new THREE.InstancedMesh(geometry,material,batch.items.length);
  mesh.name='Traffic_Blender_'+key;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow=!material.transparent;mesh.receiveShadow=true;
  mesh.setColorAt(0,white);write(batch,true);scene.add(mesh);
 }
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.scale(.5,1);
 const shade=ctx.createRadialGradient(128,128,20,128,128,120);shade.addColorStop(0,'#00000070');shade.addColorStop(.65,'#00000040');shade.addColorStop(1,'#00000000');ctx.fillStyle=shade;ctx.fillRect(0,0,256,256);
 const shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,opacity:.4,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const shadow=new THREE.InstancedMesh(new THREE.PlaneGeometry(2.8,5.2).rotateX(-Math.PI/2),shadowMaterial,actors.length);shadow.name='Traffic_Soft_Contact_Shadows';shadow.receiveShadow=false;shadow.frustumCulled=false;scene.add(shadow);
 function updateShadows(){actors.forEach((actor,i)=>{transform.position.set(actor.x,.018,actor.z);transform.rotation.set(0,actor.yaw,0);transform.updateMatrix();shadow.setMatrixAt(i,transform.matrix);});shadow.instanceMatrix.needsUpdate=true;}
 function selectLevels(){
  let changed=false;
  for(const actor of actors){const distance=Math.abs(actor.z-focusZ),level=actor.lod===0?(distance>70?1:0):(distance<54?0:1);if(level!==actor.lod){actor.lod=level;changed=true;}}
  return changed;
 }
 function setFocus(z){focusZ=z;if(selectLevels())for(const batch of batches.values())write(batch,true);}
 function reset(){
  actors.forEach((a,i)=>{if(a.moving)Object.assign(a,initial[i],{distance:0,braking:0,respawns:0});});
  separateFromStreetcars(actors,streetcarProvider());selectLevels();
  for(const batch of batches.values())write(batch,true);updateShadows();
 }
 function leaderAhead(direction,z,length=STREETCAR_LENGTH,exclude){return trafficLeader(actors,streetcarProvider(),direction,z,length,exclude);}
 function clearForStreetcar(direction,z,length=STREETCAR_LENGTH){return actors.every(a=>!a.moving||a.direction!==direction||Math.abs(a.z-z)>(a.length+length)/2+5);}
 function update(time,dt=0,alwaysGreen=false){
  dt=THREE.MathUtils.clamp(dt,0,.1);
  advanceTraffic(actors,route.crossings,time,dt,alwaysGreen,streetcarProvider());
  const changed=selectLevels();for(const batch of batches.values())if(changed||batch.dynamic)write(batch,changed);
  updateShadows();
 }
 function setNight(amount){
  const night=THREE.MathUtils.smoothstep(amount,.1,.8);
  nightTail.value=night*.7;
  for(const [name,base,power] of [['Car_Headlamp',0,1.35],['Car_Amber',0,.25]]){
   const mat=assets.materials.get(name);if(mat){if(name==='Car_Amber')mat.emissive.copy(mat.color);mat.emissiveIntensity=base+night*power;}
  }
 }
 updateShadows();setNight(0);
 return {actors,update,setFocus,setNight,reset,leaderAhead,clearForStreetcar,setStreetcars(provider){streetcarProvider=provider;},nightTail,materials:Object.fromEntries(assets.materials),models:assets.models,batches:[...batches.values()],revision:assets.revision,variants,movingCars:actors.filter(a=>a.moving).length,walkers:0};
}
