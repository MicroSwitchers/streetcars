import * as THREE from '../dist/vendor/three.module.js';

export function checkStreetscape(api,check,w){
 const s=api.city.scenery;
 check('Expanded Blender furniture and retail kit is loaded',s.models.size===27&&Object.keys(s.counts).length===27&&s.counts.bench>25&&s.counts.hydrant>10&&s.counts.chair>50);
 check('Small Blender street fittings are placed in the game',['utilitycabinet','newsbox','bikestand','treegrate','stormdrain'].every(kind=>s.counts[kind]>0));
 check('World contains cars and objects with no pedestrian actors',s.people===0&&api.city.actors.walkers===0&&api.city.actors.actors.every(a=>a.type==='car'));
 check('Fine prop buffers are shared between spatial instance batches',s.meshes.every(m=>m.isInstancedMesh)&&new Set(s.meshes.map(m=>m.geometry.attributes.position)).size<120&&s.geometryBytes<1500000);
 check('Every furniture instance has a finite, non-empty world footprint',s.placements.every(p=>!p.bounds.isEmpty()&&[...p.bounds.min,...p.bounds.max].every(Number.isFinite)));
 const ground=s.placements.filter(p=>p.y<.3&&p.kind!=='stormdrain'&&p.bounds.max.x>-11.3&&p.bounds.min.x<11.3);
 check('Furniture leaves the curb camera and rail corridor clear',ground.every(p=>p.bounds.min.x>8.4||p.bounds.max.x< -8.4));
 check('Furniture leaves all intersection ramps and crossings clear',ground.every(p=>api.route.crossings.every(c=>p.bounds.min.z>c.z+15||p.bounds.max.z<c.z-15)));
 check('Furniture leaves the three boarding areas clear',ground.every(p=>api.route.stops.every(stop=>p.bounds.min.z>stop.z+7||p.bounds.max.z<stop.z-7)));
 const seating=ground.filter(p=>p.kind==='bench'||p.kind==='table');
 check('Benches and cafe tables leave shop entrances open',seating.every(p=>s.entries.every(e=>Math.sign(p.x)!==e.side||Math.abs(p.z-e.z)>=1.89)));
 const overlaps=[];
 for(let i=0;i<ground.length;i++)for(let j=i+1;j<ground.length;j++){
   const a=ground[i].bounds,b=ground[j].bounds;
   if(['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>.025))overlaps.push([ground[i].kind,ground[i].z,ground[j].kind,ground[j].z]);
 }
 check('Separate ground props do not intersect each other: '+JSON.stringify(overlaps.slice(0,3)),overlaps.length===0);
 check('Window gardens and roof equipment add upper-level detail',s.windowGardens>50&&s.roofDetails>80);
 check('Pergola has over two metres of clear headroom',s.pergola.clearance>2.5&&s.counts.picnic===2);
 const concrete=api.city.materials.concrete,grass=api.city.materials.parkGrass,path=api.city.materials.path;
 const surfaces=[];api.scene.traverse(o=>{if(o.isMesh&&[concrete,grass,path].includes(o.material))surfaces.push(o);});
 api.scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster();
 for(const x of [-12,-17.7,-20.2,-24.6]){
   ray.set(new THREE.Vector3(x,1.5,-160.4),new THREE.Vector3(0,-1,0));
   const hits=ray.intersectObjects(surfaces).filter(h=>h.point.y>.1);
   check('Garden entrance path is exposed above the lawn at '+x,hits[0]?.object.material===path&&Math.abs(hits[0].point.y-.228)<.0001);
 }
 const night=api.settings.night,dayNightCycle=api.settings.dayNightCycle;
 api.updateSettings({dayNightCycle:true,night:false});check('Park fittings do not glow during the day',api.city.materials.gardenLight.emissiveIntensity===0);
 api.updateSettings({night:true});check('Park bollards have warm night lenses',api.city.materials.gardenLight.emissiveIntensity>1);
 api.updateSettings({dayNightCycle,night});
 const originalAutoReset=api.renderer.info.autoReset;
 api.renderer.info.autoReset=false;api.renderer.info.reset();api.graphics.render(api.scene,api.camera);
 const withProps={...api.renderer.info.render};
 s.meshes.forEach(m=>m.visible=false);api.renderer.info.reset();api.graphics.render(api.scene,api.camera);
 const withoutProps={...api.renderer.info.render};s.meshes.forEach(m=>m.visible=true);
 api.renderer.info.autoReset=originalAutoReset;
 check('Furniture adds no real-time light sources',s.meshes.every(m=>!m.isLight));
 w.__sceneryReport={instances:s.instances,counts:s.counts,displayBays:s.displays.length,windowGardens:s.windowGardens,roofDetails:s.roofDetails,sourceTriangles:s.sourceTriangles,geometryBytes:s.geometryBytes,batchCount:s.meshes.length,visibleAdditionalCalls:withProps.calls-withoutProps.calls,visibleAdditionalTriangles:withProps.triangles-withoutProps.triangles};
}
