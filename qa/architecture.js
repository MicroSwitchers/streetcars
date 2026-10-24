import * as THREE from '../dist/vendor/three.module.js';

export function checkArchitecture(api,check,w){
 const a=api.city.architecture,models=['cornice','archedhood','baywindow','balcony','pediment','firelanding','escapeladder','rooflantern','chimneypots','cupola'];
 check('Ten original Blender architectural prototypes are loaded',a.models.size===10&&models.every(n=>a.models.has(n)&&a.counts[n]>0));
 check('Architecture stays within its shared geometry budget',a.sourceTriangles<11000&&a.geometryBytes<400000);
 check('Architectural detail covers both sides of the playable street',a.buildings.length>100&&[-1,1].every(side=>a.buildings.some(b=>b.side===side&&b.mid<api.route.start+25)&&a.buildings.some(b=>b.side===side&&b.mid>api.route.end-25)));
 check('New features leave the sidewalk camera and overhead rail corridor clear',a.placements.every(p=>p.bounds.min.y>3.4&&(p.side<0?-p.bounds.max.x:p.bounds.min.x)>10.2));
 check('Architecture introduces no people or additional real-time lights',a.people===0&&a.meshes.every(m=>m.isInstancedMesh&&!m.children.some(c=>c.isLight)));
 const geometries=new Set(a.meshes.map(m=>m.geometry));
 check('Architecture uses spatially culled instances with shared buffers',geometries.size<35&&a.meshes.length<300&&a.meshes.length>geometries.size&&a.meshes.every(m=>m.geometry.index&&m.geometry.boundingSphere));
 const roofs=a.placements.filter(p=>p.roof),badRoofs=[];
 for(const p of roofs){
   const b=a.buildings.find(b=>b.index===p.index),bounds=p.bounds;
   const inner=b.side<0?-bounds.max.x:bounds.min.x,outer=b.side<0?-bounds.min.x:bounds.max.x;
   if(b.index%8===3||Math.abs(bounds.min.y-(b.height+.30))>.012||inner<11.4||outer>11.4+b.depth||bounds.min.z<b.mid-b.width/2||bounds.max.z>b.mid+b.width/2)badRoofs.push(p.kind+'/'+p.index);
 }
 check('Roof equipment sits on flat roofs inside each building footprint: '+badRoofs.join(','),badRoofs.length===0&&roofs.length>45);
 const overlaps=[];
 function collides(p,q){return p.bounds.clone().expandByScalar(.03).intersectsBox(q.bounds);}
 for(let i=0;i<roofs.length;i++){
   const p=roofs[i],b=a.buildings.find(b=>b.index===p.index);
   for(const q of roofs.slice(i+1))if(p.index===q.index&&collides(p,q))overlaps.push(p.index+': '+p.kind+'/'+q.kind);
   for(const q of api.city.scenery.placements.filter(q=>q.kind==='hvac'))if(collides(p,q))overlaps.push(p.index+': '+p.kind+'/hvac');
   if(b.index%8===2){
     const c=new THREE.Vector3(b.side*(11.4+b.depth*.72),b.height+1.15,b.mid+b.width*.20),bounds=new THREE.Box3().setFromCenterAndSize(c,new THREE.Vector3(.87,1.80,.98));
     if(collides(p,{bounds}))overlaps.push(p.index+': '+p.kind+'/existing chimney');
   }
 }
 check('New roof assets leave existing equipment and each other clear: '+overlaps.join(','),overlaps.length===0);
 const facadeConflicts=[];
 for(const p of a.placements.filter(p=>['baywindow','balcony','firelanding'].includes(p.kind)))for(const q of api.city.scenery.placements.filter(p=>p.kind==='aircon'))if(collides(p,q))facadeConflicts.push(p.index+': '+p.kind+'/aircon');
 check('Projecting facade assets leave wall-mounted air conditioners clear: '+facadeConflicts.join(','),facadeConflicts.length===0);
 const crowded=[];
 for(const b of a.buildings){
   const corniceBottom=b.height+.20+a.models.get('cornice').bounds.min.y;
   for(let y=5.3;y<b.height-1.65;y+=2.7){
     if(y+1.08>corniceBottom)crowded.push(b.index+'/sash');
     if(!b.features.fire&&b.index%4===0&&b.height-y>2.35&&y+a.models.get('archedhood').bounds.max.y>corniceBottom)crowded.push(b.index+'/arch');
   }
   for(const p of a.placements.filter(p=>p.index===b.index&&['baywindow','balcony'].includes(p.kind)))if(p.bounds.max.y>corniceBottom)crowded.push(b.index+'/'+p.kind);
 }
 check('Window heads and bay roofs remain below the cornice: '+crowded.join(','),crowded.length===0);
 check('Bay windows, balconies and fire escapes occupy separate facades',a.buildings.every(b=>Object.values(b.features).filter(Boolean).length<=1));
 const panes=[],duplicates=[];api.scene.updateMatrixWorld(true);
 api.scene.traverse(m=>{if(m.isMesh&&m.material===api.city.materials.glass)panes.push(m);});
 for(const p of a.placements.filter(p=>['baywindow','balcony'].includes(p.kind))){
   const ray=new THREE.Raycaster(new THREE.Vector3(p.side*10.1,p.y+.3,p.z+.2),new THREE.Vector3(p.side,0,0),0,1.6);
   const layers=ray.intersectObjects(panes,false);
   if(layers.length!==1)duplicates.push(p.index+'/'+p.kind+'/'+layers.length);
 }
 check('Installed bays and French doors replace the old glazing without overlap: '+duplicates.join(','),duplicates.length===0);
 if(w.document.getElementById('embedded-car'))check('Portable game loads the embedded architecture without fetching its GLB',!!w.document.getElementById('embedded-architecture')&&!w.performance.getEntriesByType('resource').some(e=>e.name.endsWith('/architecture.glb')));
 // Check the exported face winding: roof panes must be visible from above,
 // and each new front opening must have exactly one layer of glazing.
 const ray=new THREE.Raycaster(),hits=[];
 for(const kind of ['baywindow','balcony','rooflantern']){
   const model=a.models.get(kind),part=model.parts.find(p=>p.material.name==='Architecture_WindowGlass');
   const mesh=new THREE.Mesh(part.geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));mesh.updateMatrixWorld(true);
   ray.set(new THREE.Vector3(kind==='rooflantern'?.23:.20,kind==='rooflantern'?3:.30,kind==='rooflantern'?.35:3),new THREE.Vector3(0,kind==='rooflantern'?-1:0,kind==='rooflantern'?0:-1));
   hits.length=0;mesh.raycast(ray,hits);
   check(kind+' has one correctly facing layer of glazing',hits.length===1);
 }
 const glazing=a.meshes.filter(m=>m.material===api.city.materials.glass);
 api.updateSettings({dayNightCycle:true,night:true});
 check('New bay, balcony and roof glazing shares the varied night-window material',glazing.length>5&&glazing.every(m=>m.material.emissiveIntensity>0));
 api.updateSettings({night:false});
 check('New window illumination switches off in daylight',glazing.every(m=>m.material.emissiveIntensity===0));
 const autoReset=api.renderer.info.autoReset;api.renderer.info.autoReset=false;api.renderer.info.reset();
 api.graphics.render(api.scene,api.camera);const withArchitecture={...api.renderer.info.render};
 a.meshes.forEach(m=>m.visible=false);api.renderer.info.reset();api.graphics.render(api.scene,api.camera);const withoutArchitecture={...api.renderer.info.render};a.meshes.forEach(m=>m.visible=true);api.renderer.info.autoReset=autoReset;
 w.__architectureReport={models:a.models.size,buildings:a.buildings.length,instances:a.instances,counts:a.counts,sourceTriangles:a.sourceTriangles,geometryBytes:a.geometryBytes,batches:a.meshes.length,visibleCalls:withArchitecture.calls-withoutArchitecture.calls,visibleTriangles:withArchitecture.triangles-withoutArchitecture.triangles};
}
