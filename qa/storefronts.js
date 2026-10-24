import * as THREE from '../dist/vendor/three.module.js';
export function checkStorefronts(api,check,w){
 const s=api.city.scenery,bays=s.displays,kinds=new Set(bays.map(b=>b.type));
 check('The playable street has over two hundred recessed 3D display windows',bays.length>200&&kinds.size===8);
 check('Merchandise fits entirely behind the glazing and inside the display rooms',bays.every(b=>{
   const box=b.merchandise.bounds;
   return Math.min(Math.abs(box.min.x),Math.abs(box.max.x))>11.0&&Math.max(Math.abs(box.min.x),Math.abs(box.max.x))<13.04&&box.min.y>.30&&box.max.y<3.0&&box.min.z>b.z-b.width/2&&box.max.z<b.z+b.width/2;
 }));
 const opaque=[];api.scene.updateMatrixWorld(true);api.scene.traverse(o=>{if(o.isMesh&&!o.material.transparent)opaque.push(o);});
 const ray=new THREE.Raycaster();ray.far=3.0;
 for(const side of [-1,1])for(const b of bays.filter(b=>b.side===side).filter((b,i)=>i%17===0)){
   ray.set(new THREE.Vector3(side*11.0,2.63,b.z+.20),new THREE.Vector3(side,0,0));
   const hit=ray.intersectObjects(opaque,false)[0];
   check('A real display opening replaces the solid wall at '+side+', '+b.z.toFixed(1),hit&&Math.abs(hit.point.x)>12.5);
 }
 const interiors=s.meshes.filter(m=>m.userData.shopInterior);
 check('Interior merchandise shares instanced geometry without extra shadow passes',interiors.length>0&&interiors.every(m=>m.isInstancedMesh&&!m.castShadow));
 for(const type of kinds){
   const b=bays.find(b=>b.type===type),bounds=b.merchandise.bounds,size=bounds.getSize(new THREE.Vector3());let visible=0;
   for(const y of [.25,.5,.75])for(const z of [-.4,-.2,0,.2,.4]){
     ray.set(new THREE.Vector3(b.side*10.8,bounds.min.y+size.y*y,b.z+size.z*z),new THREE.Vector3(b.side,0,0));
     visible+=ray.intersectObjects(interiors,false).length;
   }
   check(type+' has actual visible merchandise geometry through its window',visible>0);
 }
 const previous={night:api.settings.night,dayNightCycle:api.settings.dayNightCycle};
 const lamp=interiors.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]).find(m=>m.name==='Prop_ShopLamp');
 api.updateSettings({dayNightCycle:true,night:true});check('Retail pendant diffusers glow at night',lamp.emissiveIntensity>1);
 api.updateSettings({night:false});check('Retail pendant glow switches off during daylight',lamp.emissiveIntensity===0);api.updateSettings(previous);
 const traffic=api.city.actors,moving=traffic.actors.filter(a=>a.moving),saved=traffic.actors.map(a=>({...a}));
 api.setPaused(true);
 check('Twenty-four moving cars share the streetcar tracks in both directions',moving.length===24&&[-1,1].every(d=>moving.filter(a=>a.direction===d).length===12)&&moving.every(a=>a.x===-a.direction*Math.abs(api.route.trackX)&&a.yaw===(a.direction===1?0:Math.PI)));
 const before=moving.map(a=>a.z);
 for(let i=0;i<140;i++)traffic.update(i*.1,.1,true);
 check('Both streams advance where the shared lane is clear',[-1,1].every(d=>moving.some((a,i)=>a.direction===d&&(d*(a.z-before[i])>20||a.respawns>saved[traffic.actors.indexOf(a)].respawns))));
 check('Travelling wheels render through the shared batches',moving.some(a=>a.distance>20)&&traffic.batches.some(b=>b.active.some(item=>item.actor.moving&&item.part.wheel)));
 traffic.actors.forEach((a,i)=>Object.assign(a,saved[i]));traffic.update(0,0,true);traffic.setFocus(api.state.z);
 w.__retailReport={displayWindows:bays.length,merchandiseTypes:[...kinds],movingCars:moving.length,geometryBytes:s.geometryBytes,sourceTriangles:s.sourceTriangles};
}
