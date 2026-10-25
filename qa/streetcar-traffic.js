export async function checkStreetcarTraffic(api,check,gameWindow){
 const THREE=await gameWindow.eval('import("three")');
 const {streetcars,rig,route}=api,actor=streetcars.vehicles[0],car=actor.car;
 api.setPaused(true);api.restart();api.setPaused(true);
 check('One pooled oncoming streetcar',streetcars.vehicles.length===1&&actor.active);
 check('Player uses the right-hand track for forward travel',route.trackX<0&&api.car.position.x===route.trackX);
 check('Opposing streetcar uses the other track',car.position.x===-route.trackX&&Math.abs(car.rotation.y-Math.PI)<1e-8);
 for(const [name,vehicle,controller,direction] of [['Player',api.car,rig,1],['Oncoming',car,actor.rig,-1]]){
  vehicle.updateMatrixWorld(true);
  const door=controller.root.localToWorld(new THREE.Vector3(1.3,1,5.9));
  check(name+' doors face the curb on its right',Math.sign(door.x-vehicle.position.x)===-direction);
 }
 check('Sidewalk camera is on the passenger-door side',route.sidewalkX<route.trackX);
 const mainMesh=api.car.getObjectByName('Body_Static__Markings_Atlas'),oppositeMesh=car.getObjectByName('Body_Static__Markings_Atlas');
 check('Streetcars share geometry and embedded textures',mainMesh&&oppositeMesh&&mainMesh.geometry===oppositeMesh.geometry&&mainMesh.material.map===oppositeMesh.material.map);
 check('Oncoming car has one headlamp and no duplicated cabin or marker lights',actor.rig.emitters.length===1&&actor.rig.exteriorEmitters.length===0);
 const lamp=rig.exteriorEmitters.find(l=>l.userData.lightRole==='markers'&&l.position.x>0&&l.position.z>4);
 check('Door-side forward marker sits on the fixed body panel',lamp&&Math.abs(lamp.position.z-4.95)<1e-6);
 const amberPoints=[];
 api.car.traverse(mesh=>{
  if(!mesh.isMesh||mesh.material.name!=='Amber_Indicators')return;
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
   const point=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);
   rig.root.worldToLocal(point);if(point.x>1.2&&point.z>4)amberPoints.push(point);
  }
 });
 check('No amber lens geometry remains over the opening front door',amberPoints.length>0&&amberPoints.every(p=>p.z>4.8&&p.z<5.1));
 const before=actor.z,angle=actor.rig.axles[0].rotation.x;
 streetcars.update(.1,api.state.z,0,true);
 check('Oncoming car moves toward the player and rolls its wheels',actor.z<before&&actor.rig.axles[0].rotation.x!==angle);
 const contact=actor.rig.getWireContactWorld();
 check('Oncoming trolley shoe follows its own overhead wire',Math.abs(contact.x+route.trackX)<.015&&Math.abs(contact.y-route.wireY)<.015);
 const head=actor.rig.emitters[0],expected=actor.rig.root.localToWorld(new THREE.Vector3(0,1.29,7.81));
 check('Headlamp follows the rotated oncoming cab',head.getWorldPosition(new THREE.Vector3()).distanceTo(expected)<1e-5);
 const cross=route.crossings[0];
 Object.assign(actor,{active:true,z:cross.z+35,speed:4,distance:0});
 for(let i=0;i<160;i++)streetcars.update(.1,route.start,30,false);
 check('Oncoming car stops before a red signal',actor.speed===0&&Math.abs(actor.z-cross.z-21)<.01);
 streetcars.update(.1,route.start,0,false);
 check('Oncoming car departs when the signal turns green',actor.speed>0&&actor.z<cross.z+21);
 streetcars.reset(route.start);
 for(let i=0;i<1800;i++){api.city.actors.update(i*.1,.1,true);streetcars.update(.1,route.start,i*.1,true);}
 check('Opposite-direction arrivals repeat without adding vehicles',actor.passes>=2&&streetcars.vehicles.length===1&&streetcars.vehicles[0].car===car);
 streetcars.reset(api.state.z);Object.assign(actor,{z:api.state.z,speed:6.8});streetcars.update(0,api.state.z,0,true);
 // Merged Blender meshes can have rotated local boxes; compare actual vertices.
 const a=new THREE.Box3().setFromObject(rig.root,true),b=new THREE.Box3().setFromObject(actor.rig.root,true);
 check('Passing bodies and mirrors clear each other on separate rails ('+[a.min.x,a.max.x,b.min.x,b.max.x].map(v=>v.toFixed(3)).join(', ')+')',a.max.x<b.min.x);
 const pausedZ=actor.z;api.step(.1);
 check('Pausing holds opposing traffic as well',actor.z===pausedZ);
 api.setPaused(false);api.updateSettings({dayNightCycle:true,night:false});
 api.step(240);check('Daylight lasts 240 seconds',api.nightAmount===0);
 api.step(30);check('Dusk reaches its midpoint in thirty seconds',Math.abs(api.nightAmount-.5)<1e-8);
 api.step(30);check('Full night begins after a sixty-second dusk',api.nightAmount===1);
 api.step(11.9);check('Full night remains for twelve seconds',api.nightAmount===1);
 api.step(.1);api.step(30);check('Dawn follows the short night',Math.abs(api.nightAmount-.5)<1e-8);
 api.step(30);check('Day returns after the sixty-second dawn',api.nightAmount===0);
 api.toggleDayNight();api.step(8);check('Night button also lights the approaching car after its fade',api.nightAmount===1&&actor.rig.materials.get('Amber_Indicators').emissiveIntensity>3);
 api.step(64);check('Manually selected night also ends after its gradual dawn',api.nightAmount===0);
 api.updateSettings({dayNightCycle:false});api.restart();api.setPaused(true);
 api.view.transition=null;api.view.instant=true;api.view.update(api.state.z,0);
}
