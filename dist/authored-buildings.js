import * as THREE from 'three';
import {contactShading} from './contact-shading.js';

// Whole-building replacements, not decoration layered on a procedural shell.
// All five designs and their fixed instance buffers remain resident.
export function createAuthoredBuildings(group,mats,assets){
 const pools=new Map(),dummy=new THREE.Object3D(),placements=[],white=new THREE.Color(0xffffff),sage=new THREE.Color(0xbecbb3);
 const stats={models:assets.size,meshes:0,instances:0,triangles:0,sourceTriangles:0,geometryBytes:0,rooms:0,overflow:0,contacts:0};
 const mapped=new Map();
 function material(source){
  const name=source.name;if(mapped.has(name))return mapped.get(name);
  const lookup={Architecture_BuildingBrick0:mats.brick0,Architecture_BuildingBrick1:mats.brick1,Architecture_BuildingBrick2:mats.brick2,Architecture_BuildingPlaster:mats.dundasPlaster,Architecture_WindowGlass:mats.glass,Architecture_ShopGlass:mats.storeGlass,Architecture_OfficeGlass:mats.officeFacade,Architecture_BlockInterior:mats.shopInteriorWall};
  const m=lookup[name]||source;m.envMapIntensity=name.includes('Glass')?m.envMapIntensity:.75;contactShading(m);mapped.set(name,m);mats['authored'+name]=m;return m;
 }
 for(const [name,model] of assets){
  const parts=[];stats.sourceTriangles+=model.triangles;
  for(const [i,part] of model.parts.entries()){
   const m=material(part.material),mesh=new THREE.InstancedMesh(part.geometry,m,12);mesh.name='Dundas_Building_'+name+'_'+i;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,white);mesh.castShadow=/BuildingBrick|BuildingPlaster|Slate/.test(part.material.name)||name==='office'&&/OfficeGlass|Limestone/.test(part.material.name);mesh.receiveShadow=!m.transparent;
   mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-55,0,-250),new THREE.Vector3(55,60,400));mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,25,75),335);group.add(mesh);parts.push({mesh,source:part.material.name});stats.meshes++;
   const g=part.geometry;stats.geometryBytes+=(g.index?.array.byteLength||0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0);stats.contacts+=g.attributes.contactOcclusion.array.filter(v=>v>.02).length;
  }
  pools.set(name,{model,parts,count:0});
 }
 return {stats,placements,models:assets,begin(){for(const p of pools.values())p.count=0;placements.length=0;stats.instances=stats.triangles=stats.rooms=stats.overflow=0;},
  place(name,side,front,z,width,index,district){
   const p=pools.get(name),scale=width/p.model.layout.width;
   if(p.count>=12){stats.overflow++;return null;}
   dummy.position.set(side*front,.18,z);dummy.rotation.set(0,-side*Math.PI/2,0);dummy.scale.set(scale,1,1);dummy.updateMatrix();
   for(const part of p.parts){part.mesh.setMatrixAt(p.count,dummy.matrix);part.mesh.setColorAt(p.count,part.source.includes('Plaster')?sage:white);}
   p.count++;stats.instances++;stats.rooms++;stats.triangles+=p.model.triangles;
   const layout=p.model.layout,placement={name,side,front,z,width,height:layout.height+.18,depth:layout.depth,index,district,scale,triangles:p.model.triangles};placements.push(placement);
   return {...placement,layout};
  },finish(){for(const p of pools.values())for(const {mesh} of p.parts){mesh.count=p.count;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}}};
}
