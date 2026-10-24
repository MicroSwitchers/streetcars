import * as THREE from 'three';
import {GLTFLoader} from 'gltf-loader';

export async function loadArchitecture(){
 const loader=new GLTFLoader(),embedded=document.getElementById('embedded-architecture');
 const asset=embedded?await loader.parseAsync(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)).buffer,''):await loader.loadAsync(new URL('./architecture.glb',import.meta.url).href);
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
 return {models,materials,revision:'blender-queen-architecture-v1'};
}

// Anchors sit on the actual facade plane, with +Z facing the road. Reuse the
// occupied-window material so these windows share the existing night cycle.
export function createArchitecture({scene,route,mats},assets){
 const batches=new Map(),dummy=new THREE.Object3D();
 const stats={models:assets.models,buildings:[],placements:[],meshes:[],counts:{},cellLength:96,people:0};
 function place(kind,side,y,z,{x=11.4,sx=1,sy=1,sz=1,roof=false,index}={}){
   const model=assets.models.get(kind);if(!model)throw new Error('Missing architectural asset: '+kind);
   dummy.position.set(side*x,y,z);dummy.rotation.set(0,-side*Math.PI/2,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
   const bounds=model.bounds.clone().applyMatrix4(dummy.matrix);
   stats.placements.push({kind,side,y,z,index,roof,bounds});stats.counts[kind]=(stats.counts[kind]??0)+1;
   for(const part of model.parts){
     const key=Math.floor(z/stats.cellLength)+'/'+part.geometry.uuid;
     if(!batches.has(key))batches.set(key,{part,material:part.material.name==='Architecture_WindowGlass'?mats.glass:part.material,matrices:[],colors:[],kind});
     const batch=batches.get(key);batch.matrices.push(dummy.matrix.clone());
     const stone=/Limestone|CarvedStone/.test(part.material.name),sash=part.material.name==='Architecture_Sash';
     batch.colors.push(new THREE.Color(stone?[0xffffff,0xdeddd1,0xf3e7cd,0xd6d4ca][index%4]:sash?[0xffffff,0xc0c7b4,0xa7b3aa,0xdad5bd][index%4]:0xffffff));
   }
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
     mesh.castShadow=material!==mats.glass;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);stats.meshes.push(mesh);
   }
   stats.geometryBytes=[...geometrySet].reduce((n,g)=>n+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0),0);
   stats.sourceTriangles=[...stats.models.values()].reduce((n,m)=>n+m.triangles,0);
   stats.instances=stats.placements.length;return stats;
 }
 return {plan,window,building,finish,stats};
}
