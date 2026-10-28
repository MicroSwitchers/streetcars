// Exercise the parts that must survive rebuilding the Blender asset.
export async function checkStreetcarAsset(api,check){
 const THREE=await import('../dist/vendor/three.module.js');
 const {rig}=api,oldDistance=rig.distance;
 if(rig.root.userData.revision==='photo-refined-v2'){
   check('Photo-refined CLRV has 42 passenger seats including the rear nook',rig.root.userData.passenger_seats===42&&rig.root.userData.rear_lounge_seats===7);
   check('Central CLRV headlamp has one aligned runtime beam',rig.emitters.filter(light=>light.isSpotLight).length===1&&rig.emitters.find(light=>light.isSpotLight).position.x===0);
   api.car.updateMatrixWorld(true);
   for(const side of [-1,1]){
     const origin=rig.root.localToWorld(new THREE.Vector3(side*2,1.05,0));
     const direction=new THREE.Vector3(-side,0,0).transformDirection(rig.root.matrixWorld);
     const hit=new THREE.Raycaster(origin,direction).intersectObject(api.car,true)[0];
     check('Raised floor stays inside the side livery '+side,hit?.object.material.name==='TTC_Vermilion');
     const logoOrigin=rig.root.localToWorld(new THREE.Vector3(side*2,1.23,1.50));
     const logoHit=new THREE.Raycaster(logoOrigin,direction).intersectObject(api.car,true)[0];
     check('TTC crest is clear of crossing panel trim '+side,logoHit?.object.material.name==='Markings_Atlas');
   }
 }
 api.setPaused(true);
 const bumper=api.car.getObjectByName('Bumper_Chrome_Trim');
 check('Asset has satin bumper trim without tiny self-shadows',bumper&&
   bumper.material.name==='Bumper_Satin_Chrome'&&bumper.material.roughness>=.4&&
   !bumper.castShadow&&!bumper.receiveShadow);
 if(rig.root.userData.cab_revision==='rounded-v3'){
   const depths=[];
   for(const x of [0,.35,.70,.95]){
     const origin=rig.root.localToWorld(new THREE.Vector3(x,1.50,9));
     const direction=new THREE.Vector3(0,0,-1).transformDirection(rig.root.matrixWorld);
     const hit=new THREE.Raycaster(origin,direction).intersectObject(api.car,true)[0];
     check('Nose ray meets painted cab surface at '+x,hit?.object.material.name==='TTC_Vermilion');
     depths.push(rig.root.worldToLocal(hit.point.clone()).z);
   }
   check('Nose bows continuously across the front',depths.every((z,i)=>!i||depths[i-1]-z>.004)&&depths[0]-depths[3]>.12&&depths[0]-depths[3]<.35);
 }
 if(rig.root.userData.rear_revision==='rounded-lounge-v4'){
   const depths=[];
   // Above the rear ventilation panels, the original waist surface is exposed.
   for(const x of [.06,.35,.70,.95]){
     const origin=rig.root.localToWorld(new THREE.Vector3(x,1.60,-9));
     const direction=new THREE.Vector3(0,0,1).transformDirection(rig.root.matrixWorld);
     const hit=new THREE.Raycaster(origin,direction).intersectObject(api.car,true)[0];
     check('Rear ray meets painted curved body at '+x,hit?.object.material.name==='TTC_Vermilion');
     if(hit)depths.push(rig.root.worldToLocal(hit.point.clone()).z);
   }
   check('Rear bows continuously like the front',depths.length===4&&depths.every((z,i)=>!i||z-depths[i-1]>.004)&&depths[3]-depths[0]>.12);
   const origin=rig.root.localToWorld(new THREE.Vector3(0,1.5,-5.7));
   const direction=new THREE.Vector3(0,-1,0).transformDirection(rig.root.matrixWorld);
   const hit=new THREE.Raycaster(origin,direction).intersectObject(api.car,true)[0];
   check('Rear nook floor is level with the rest of the saloon',hit&&Math.abs(rig.root.worldToLocal(hit.point.clone()).y-1.10)<.01);
   const cushionHeight=(x,z)=>{
     const origin=rig.root.localToWorld(new THREE.Vector3(x,1.95,z));
     const hit=new THREE.Raycaster(origin,direction).intersectObject(api.car,true)[0];
     return hit?.object.material.name==='Burgundy_Seats'?rig.root.worldToLocal(hit.point.clone()).y:null;
   };
   const reference=cushionHeight(-.49,3.55);
   const sideCentre=rig.root.userData.rear_side_seat_centre_m??.925;
   const rearSeats=[[-.46,-7.055],[0,-7.055],[.46,-7.055],[-sideCentre,-5.68],[-sideCentre,-6.29],[sideCentre,-5.68],[sideCentre,-6.29]];
   for(const [x,z] of rearSeats){
     const height=cushionHeight(x,z);
     check('Rear seat is at normal passenger-seat height '+x+', '+z,reference!==null&&height!==null&&Math.abs(height-reference)<.02);
   }
   for(const name of ['Burgundy_Seats','Interior_Laminate']){
     const mat=rig.materials.get(name);
     check(name+' has embedded albedo, roughness and normal detail',mat?.map&&mat?.roughnessMap&&mat?.normalMap);
   }
   if(rig.root.userData.interior_revision==='clearance-and-fittings-v5'){
     for(const side of [-1,1])for(const z of [-5.68,-6.29]){
       const origin=rig.root.localToWorld(new THREE.Vector3(side*.60,1.76,z));
       const outward=new THREE.Vector3(side,0,0).transformDirection(rig.root.matrixWorld);
       const hits=new THREE.Raycaster(origin,outward,0,.8).intersectObject(api.car,true);
       const upholstery=hits.find(h=>h.object.material.name==='Burgundy_Seats');
       const wood=hits.find(h=>h.object.material.name==='Interior_Laminate');
       check('Rear side backrest clears the wood liner '+side+', '+z,upholstery&&wood&&wood.distance-upholstery.distance>.04);
     }
   }
 }
 if(rig.root.userData.door_interior_revision==='red-enamel-inner-seals-v1'){
   rig.setDoor('both',0,true);rig.model.updateMatrixWorld(true);
   for(const door of ['Front','Rear'])for(const [part,sign] of [['A',1],['B',-1]])for(const suffix of ['','_Fold']){
     const pivot=rig.nodes['Door_'+door+'_'+part+suffix],c=-sign*.18;
     for(const [label,y,z,material] of [['waist',1.36,c,'TTC_Vermilion'],['upper frame',2.15,c+.145,'TTC_Vermilion'],['window seal',2.15,c+.122,'Window_Rubber'],['glazing',2.15,c,'Tinted_Glass'],['kick plate',.39,c,'Brushed_Skirt']]){
       const origin=pivot.localToWorld(new THREE.Vector3(-.30,y,z)),direction=new THREE.Vector3(1,0,0).transformDirection(pivot.matrixWorld);
       const hit=new THREE.Raycaster(origin,direction,0,.5).intersectObject(api.car,true)[0];
       check(pivot.name+' cabin '+label+' has the proper material',hit?.object.material.name===material);
     }
   }
 }
 for(const which of ['front','rear']){
   const name=which==='front'?'Front':'Rear';
   rig.setDoor(which,0,true);
   const leaves=['A','B'].flatMap(part=>[rig.nodes[`Door_${name}_${part}`],rig.nodes[`Door_${name}_${part}_Fold`]]);
   const closed=leaves.map(o=>rig.root.worldToLocal(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())));
   rig.setDoor(which,1,true);rig.model.updateMatrixWorld(true);
   check(name+' door leaves fold inwards',leaves.every((o,i)=>{
     const opened=rig.root.worldToLocal(new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()));
     return opened.distanceTo(closed[i])>.1&&opened.x<closed[i].x-.08;
   }));
   const doorZ=rig.nodes['Door_'+name].position.z;
   for(const dz of [-.3,0,.3])for(const height of [.89,1.66]){
     const origin=rig.root.localToWorld(new THREE.Vector3(2,height,doorZ+dz));
     const direction=new THREE.Vector3(-1,0,0).transformDirection(rig.root.matrixWorld);
     const obstruction=new THREE.Raycaster(origin,direction,0,.85).intersectObject(api.car,true)[0];
     check(name+' open doorway has no crossing body trim at '+height+', '+dz,!obstruction);
   }
   rig.setDoor(which,0,true);
 }
 rig.setDistance(.42);
 check('All four axles turn at the preserved rolling radius',rig.axles.every(o=>Math.abs(o.rotation.x-.42/.335)<1e-6));
 rig.setDistance(oldDistance);
 const base=rig.yaw.getWorldPosition(new THREE.Vector3()),tip=rig.getWireContactWorld();
 check('Trolley pole keeps its rigid 5.2 metre reach',Math.abs(base.distanceTo(tip)-5.2)<1e-5);
 check('Trolley shoe still meets the overhead wire',api.state.wire&&api.state.wireError<.015);
 const lights={...rig.lights},night=rig.nightAmount,brake=rig.brakeAmount;
 rig.setBrake(0);rig.setNight(1);
 rig.setLights({headlights:false,tail:false,markers:false,interior:false,indicators:false});
 const names=['Headlamps','Tail_Lamps','Green_Markers','Interior_Lamps','Amber_Indicators'];
 check('Model lamps switch off',names.every(n=>rig.materials.get(n)?.emissiveIntensity===0));
 rig.setLights({headlights:true,tail:true,markers:true,interior:true,indicators:true});
 check('Model lamps switch on',names.every(n=>rig.materials.get(n)?.emissiveIntensity>0));
 rig.setLights(lights);rig.setNight(night);rig.setBrake(brake);
 check('Brushed metal keeps the exported roughness map',rig.materials.get('Brushed_Skirt').roughness===1);
}
