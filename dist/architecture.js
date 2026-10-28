import * as THREE from 'three';
import {GLTFLoader} from 'gltf-loader';
import {facadeReliefs,reliefFacade,FACADE_RELIEFS} from './facade-details.js';

export async function loadArchitecture(){
 const loader=new GLTFLoader();
 const load=async(id,file)=>{const e=document.getElementById(id);return e?loader.parseAsync(Uint8Array.from(atob(e.textContent.trim()),c=>c.charCodeAt(0)).buffer,''):loader.loadAsync(new URL(file,import.meta.url).href);};
 const [asset,buildingAsset]=await Promise.all([load('embedded-architecture','./architecture.glb'),load('embedded-dundas-buildings','./dundas-buildings.glb')]);
 asset.scene.updateMatrixWorld(true);
 const models=new Map(),materials=new Map();
 for(const root of asset.scene.children){
   if(!root.name.startsWith('Architecture_'))continue;
   const parts=[],bounds=new THREE.Box3();
   root.traverse(mesh=>{
     if(!mesh.isMesh)return;
     const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
     geometry.computeBoundingBox();geometry.computeBoundingSphere();bounds.union(geometry.boundingBox);
     if(!materials.has(mesh.material.name)){
       const material=mesh.material.clone();material.envMapIntensity=.75;material.side=THREE.FrontSide;materials.set(material.name,material);
     }
     parts.push({geometry,material:materials.get(mesh.material.name)});
   });
   models.set(root.name.slice(13),{parts,bounds,triangles:parts.reduce((n,p)=>n+p.geometry.index.count/3,0)});
 }
 const geometries=new Set(),sourceMaterials=new Set();asset.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);sourceMaterials.add(o.material);}});
 geometries.forEach(g=>g.dispose());sourceMaterials.forEach(m=>m.dispose());
 buildingAsset.scene.updateMatrixWorld(true);const buildings=new Map();
 for(const root of buildingAsset.scene.children){
  if(!root.name.startsWith('Building_'))continue;
  const parts=[],bounds=new THREE.Box3(),layout=JSON.parse(root.userData.layout);
  root.traverse(mesh=>{
   if(!mesh.isMesh)return;
   const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),colour=geometry.attributes.color,values=new Float32Array(geometry.attributes.position.count);
   if(colour)for(let i=0;i<values.length;i++)values[i]=Math.min(1,Math.max(0,(1-colour.getX(i))/.35));
   geometry.setAttribute('contactOcclusion',new THREE.BufferAttribute(values,1));geometry.deleteAttribute('color');
   if(!geometry.attributes.uv)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(values.length*2),2));
   geometry.computeBoundingBox();geometry.computeBoundingSphere();bounds.union(geometry.boundingBox);
   const material=mesh.material.clone();material.vertexColors=false;
   parts.push({geometry,material});
  });
  buildings.set(root.name.slice(9),{parts,bounds,layout,triangles:parts.reduce((n,p)=>n+p.geometry.index.count/3,0)});
 }
 const buildingGeometries=new Set(),buildingMaterials=new Set();buildingAsset.scene.traverse(o=>{if(o.isMesh){buildingGeometries.add(o.geometry);buildingMaterials.add(o.material);}});buildingGeometries.forEach(g=>g.dispose());buildingMaterials.forEach(m=>m.dispose());
 return {models,materials,buildings,revision:'blender-queen-architecture-v1'};
}

export function architectureMaterial(part,mats){
 if(part.material.name==='Architecture_WindowGlass')return mats.glass;
 if(part.material.name==='Architecture_ShopGlass')return mats.storeGlass;
 if(part.material.name==='Architecture_BlockBrick'){
   if(!part.geometry.attributes.uv)part.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(part.geometry.attributes.position.count*2),2));
   return mats.brick1;
 }
 return part.material;
}

// Anchors sit on the actual facade plane, with +Z facing the road. Reuse the
// occupied-window material so these windows share the existing night cycle.
export function createArchitecture({scene,route,mats},assets){
 const batches=new Map(),dummy=new THREE.Object3D();
 const stats={models:assets.models,buildings:[],surfaces:[],infill:[],placements:[],meshes:[],counts:{},cellLength:96,people:0};
 function place(kind,side,y,z,{x=11.4,sx=1,sy=1,sz=1,roof=false,index,origin,rotation,relief=false,shell=false}={}){
   const model=assets.models.get(kind);if(!model)throw new Error('Missing architectural asset: '+kind);
   dummy.position.set(origin?.[0]??side*x,y,origin?.[2]??z);dummy.rotation.set(0,rotation??-side*Math.PI/2,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
   const bounds=model.bounds.clone().applyMatrix4(dummy.matrix);
   stats.placements.push({kind,side,y,z,index,roof,relief,shell,bounds});stats.counts[kind]=(stats.counts[kind]??0)+1;
   for(const part of model.parts){
     const key=Math.floor(z/stats.cellLength)+'/'+part.geometry.uuid;
     if(!batches.has(key))batches.set(key,{part,material:architectureMaterial(part,mats),matrices:[],colors:[],kind});
     const batch=batches.get(key);batch.matrices.push(dummy.matrix.clone());
     const stone=/Limestone|CarvedStone/.test(part.material.name),sash=part.material.name==='Architecture_Sash';
     batch.colors.push(new THREE.Color(stone?[0xffffff,0xdeddd1,0xf3e7cd,0xd6d4ca][index%4]:sash?[0xffffff,0xc0c7b4,0xa7b3aa,0xdad5bd][index%4]:0xffffff));
   }
 }
 function surface(b){
   const f=b.origin?b:reliefFacade(b),layout=facadeReliefs(f),cos=Math.cos(f.rotation),sin=Math.sin(f.rotation);
   stats.surfaces.push({...f,style:layout.style,details:layout.details.length});
   for(const d of layout.details){const origin=[f.origin[0]+cos*d.u,0,f.origin[2]-sin*d.u];place(d.kind,b.side,d.y,origin[2],{origin,rotation:f.rotation,sx:d.sx,sy:d.sy,index:b.index,relief:true});}
 }
 function plan({index,mid,width,height,detailed}){
   const windows=[];for(let z=mid-width/2+1.35;z<mid+width/2-.7;z+=2.35)windows.push(z);
   const featureZ=windows[Math.floor((windows.length-1)/2)];
   const fire=detailed&&index%6===1;
   const bay=detailed&&!fire&&index%5===1&&index%7!==4&&height>7.3;
   const balcony=detailed&&!fire&&!bay&&index%9===2&&index%7!==4;
   return {fire,bay,balcony,featureZ,windows,replaces:(y,z)=>(bay||balcony)&&y===5.3&&Math.abs(z-featureZ)<.01};
 }
 function window({side,y,z,index,height,detailed,plan:p}){
   if(p.replaces(y,z)){
     place(p.bay?'baywindow':'balcony',side,y,z,{index});return true;
   }
   if(detailed&&!p.fire&&index%4===0&&height-y>2.35)place('archedhood',side,y,z,{index});
   return false;
 }
 function building(b,p){
   const {side,mid,width,height,depth,index,detailed}=b;if(!detailed)return;
   stats.buildings.push({...b,featureZ:p.featureZ,features:{bay:p.bay,balcony:p.balcony,fire:p.fire}});
   const windows=[];for(let y=5.3;y<height-1.65;y+=2.7)for(const z of p.windows)windows.push({y,z,width:1.25,height:1.97,feature:p.replaces(y,z)?(p.bay?'baywindow':'balcony'):!p.fire&&index%4===0&&height-y>2.35?'archedhood':null});
   surface({side,front:11.4,z:mid,width,height,index,kind:'shop',windows});
   // One-metre cornice modules keep the dentils at a believable physical scale.
   const count=Math.ceil(width),span=width/count;
   for(let j=0;j<count;j++)place('cornice',side,height+.20,mid-width/2+(j+.5)*span,{sx:span,index});
   if(index%8===0&&height>9)place('pediment',side,height+.27,mid,{index});
   if(p.fire){
     const floors=[];for(let y=5.3;y<height-1.65;y+=2.7)floors.push(y-1.13);
     for(const y of floors)place('firelanding',side,y,p.featureZ,{index});
     for(let j=0;j<floors.length-1;j++)place('escapeladder',side,floors[j],p.featureZ,{index});
   }
   // Leave pitched roofs intact; avoid the existing HVAC units on flat roofs.
   if(index%8!==3){
     if(index%3===0)place('rooflantern',side,height+.30,mid+width*(index%8===2?-.18:.24),{x:11.4+depth*.65,roof:true,index});
     if(index%5===2&&index%8!==2)place('chimneypots',side,height+.30,mid-width*.32,{x:11.4+depth*.75,roof:true,index});
     if(index%13===4)place('cupola',side,height+.30,mid-width*.22,{x:11.4+depth*.42,roof:true,index});
   }
 }
 function finish(){
   const geometrySet=new Set();
   for(const {part,material,matrices,colors,kind} of batches.values()){
     geometrySet.add(part.geometry);
     const mesh=new THREE.InstancedMesh(part.geometry,material,matrices.length);
     mesh.name='Architecture_'+kind;mesh.userData.architecture=true;
     matrices.forEach((m,i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,colors[i]);});mesh.instanceMatrix.needsUpdate=true;
     // Tiny wall reliefs use surface lighting and AO. Keeping them out of the
     // shadow pass avoids thin-edge self-shadow stripes and extra tablet cost.
     mesh.castShadow=kind==='cornerblock'?/BlockBrick|Slate/.test(part.material.name):material!==mats.glass&&!material.transparent&&!FACADE_RELIEFS.includes(kind);
     mesh.receiveShadow=!material.transparent&&(kind!=='cornerblock'||!/Limestone|Sash/.test(part.material.name));mesh.computeBoundingSphere();scene.add(mesh);stats.meshes.push(mesh);
   }
   stats.geometryBytes=[...geometrySet].reduce((n,g)=>n+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0),0);
   stats.sourceTriangles=[...stats.models.values()].reduce((n,m)=>n+m.triangles,0);
   stats.instances=stats.placements.length;return stats;
 }
 return {plan,window,building,surface,infill(plot){stats.infill.push(plot);place('cornerblock',plot.side,.18,plot.z,{x:11.4,sx:plot.width/6,index:Math.abs(Math.round(plot.z)),shell:true});},finish,stats};
}
