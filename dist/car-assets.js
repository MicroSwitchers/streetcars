import * as THREE from 'three';
import {GLTFLoader} from 'gltf-loader';

// Bake the authoring transforms once, then share each Blender mesh between
// parked and moving instances. Wheel pivots remain independent of the body.
export async function loadTrafficCars(){
 const loader=new GLTFLoader(),embedded=document.getElementById('embedded-traffic-cars');
 const asset=embedded?await loader.parseAsync(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)).buffer,''):
  await loader.loadAsync(new URL('./traffic-cars.glb',import.meta.url).href);
 asset.scene.updateMatrixWorld(true);
 const models=new Map(),materials=new Map(),geometryCache=new Map();
 function prepareMaterial(source){
  const name=source.name.startsWith('Car_Paint_')?'Car_Paint':source.name;
  if(materials.has(name))return materials.get(name);
  const mat=source.clone();mat.name=name;
  if(name==='Car_Paint'){mat.color.setHex(0xffffff);mat.envMapIntensity=1.15;}
  if(name==='Car_Glass'){mat.opacity=.42;mat.transparent=true;mat.depthWrite=false;mat.side=THREE.DoubleSide;mat.envMapIntensity=1.3;}
  if(name==='Car_Alloy'){mat.roughness=.34;mat.envMapIntensity=1.1;}
  materials.set(name,mat);return mat;
 }
 for(const kind of ['sedan','hatchback','wagon']){
  const levels=[];
  for(let lod=0;lod<2;lod++){
   const root=asset.scene.getObjectByName(`Car_${kind}_LOD${lod}`);
   if(!root)throw new Error('Missing Blender traffic model: '+kind+' LOD'+lod);
   const origin=root.getWorldPosition(new THREE.Vector3()),parts=[];
   root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    let parent=mesh.parent,pivot=null;
    while(parent&&parent!==root){if(parent.userData.wheel){pivot=parent;break;}parent=parent.parent;}
    const centre=pivot?pivot.getWorldPosition(new THREE.Vector3()).sub(origin):new THREE.Vector3();
    const transform=new THREE.Matrix4().makeTranslation(-origin.x-centre.x,-origin.y-centre.y,-origin.z-centre.z).multiply(mesh.matrixWorld);
    // Linked wheels have the same local geometry and orientation at all axles.
    const key=mesh.geometry.uuid+'/'+(pivot?'wheel':'body');
    let geometry=geometryCache.get(key);
    if(!geometry){geometry=mesh.geometry.clone().applyMatrix4(transform);geometry.computeBoundingSphere();geometryCache.set(key,geometry);}
    const material=prepareMaterial(mesh.material);
    parts.push({geometry,material,pivot:centre,wheel:!!pivot,paint:material.name==='Car_Paint'});
   });
   const box=new THREE.Box3();
   for(const part of parts){const b=part.geometry.boundingBox??(part.geometry.computeBoundingBox(),part.geometry.boundingBox);box.union(b.clone().translate(part.pivot));}
   levels.push({parts,bounds:box,triangles:parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)});
  }
  models.set(kind,{levels,radius:.335});
 }
 const sourceGeometries=new Set(),sourceMaterials=new Set();
 asset.scene.traverse(o=>{if(o.isMesh){sourceGeometries.add(o.geometry);sourceMaterials.add(o.material);}});
 for(const geometry of sourceGeometries)geometry.dispose();for(const material of sourceMaterials)material.dispose();
 return {models,materials,revision:'blender-cars-v1'};
}
