export function checkCarAssets(api,check){
 const traffic=api.city.actors;
 check('Cars come from the editable Blender asset',traffic.revision==='blender-cars-v1'&&traffic.models.size===3);
 for(const [name,model] of traffic.models){
  const [near,far]=model.levels,size=near.bounds.getSize(near.bounds.min.clone());
  check(name+' has plausible exported dimensions and a clear roof',size.z>4&&size.z<4.9&&size.x>1.7&&size.x<2.3&&size.y>1.4&&size.y<1.6);
  check(name+' keeps a compact close-up mesh and a smaller distance mesh',near.triangles<26000&&far.triangles<near.triangles*.3&&far.triangles>3000);
  const wheelParts=near.parts.filter(p=>p.wheel),pivots=new Set(wheelParts.map(p=>p.pivot.toArray().map(v=>v.toFixed(3)).join('/')));
  check(name+' has four separate wheel pivots',pivots.size===4&&Math.abs(model.radius-.335)<1e-8);
  check(name+' shares linked wheel meshes across all axles',new Set(wheelParts.map(p=>p.geometry)).size<=3);
  check(name+' glass is curved geometry with a visible cabin behind it',near.parts.some(p=>p.material.name==='Car_Glass'&&p.geometry.attributes.position.count>300)&&near.parts.some(p=>p.material.name==='Car_Interior'));
 }
 const detailedBudget=traffic.actors.reduce((sum,a)=>sum+traffic.models.get(a.variant).levels[0].triangles,0);
 const submitted=()=>traffic.batches.reduce((sum,b)=>sum+b.mesh.count*(b.part.geometry.index?.count??b.part.geometry.attributes.position.count)/3,0);
 check('Distant parked cars reduce submitted triangles',submitted()<detailedBudget*.65);
 check('Each car draws exactly one distance level',traffic.actors.every(actor=>traffic.batches.reduce((sum,b)=>sum+b.active.filter(p=>p.actor===actor).length,0)===traffic.models.get(actor.variant).levels[actor.lod].parts.length));
 const actor=traffic.actors.find(a=>!a.moving);
 traffic.setFocus(actor.z+100);check('Far car selects the distance mesh',actor.lod===1);
 traffic.setFocus(actor.z+60);check('Distance threshold has hysteresis',actor.lod===1);
 traffic.setFocus(actor.z+53);check('Approaching car selects the detailed mesh',actor.lod===0);
 traffic.setFocus(actor.z+65);check('Detailed mesh stays stable near the boundary',actor.lod===0);
 traffic.setFocus(api.state.z);
 const head=traffic.materials.Car_Headlamp,tail=traffic.materials.Car_Tail_Lens;
 traffic.setNight(0);const day=[head.emissiveIntensity,traffic.nightTail.value];traffic.setNight(1);
 check('Car headlamps and tail lenses brighten at night',head.emissiveIntensity>day[0]&&traffic.nightTail.value>day[1]);traffic.setNight(api.nightAmount);
 const widest=Math.max(...[...traffic.models.values()].map(m=>m.levels[0].bounds.max.x));
 check('Cars in the shared track lane clear parked cars',6.6-Math.abs(api.route.trackX)>widest*2);
}
