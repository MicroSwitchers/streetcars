import * as THREE from 'three';
import {StreetcarController} from 'streetcar-controller';

// One reusable vehicle shares the player's geometry and textures. It approaches
// on the other track, clears the scene behind the player, then returns later.
export function createStreetcarTraffic(scene,template,route,lighting,traffic){
 const car=template.clone(true);car.name='Oncoming_CLRV';car.rotation.y=Math.PI;scene.add(car);
 const rig=new StreetcarController(car,{cabinLights:false,exteriorLights:false});
 rig.setLights({headlights:true,tail:true,markers:true,interior:true});lighting?.addStreetcar(car,rig);
 const beams=rig.emitters.map(light=>({light,position:light.position.clone(),target:light.target.position.clone()}));
 // Keep one headlamp in the renderer's light list, even between arrivals.
 for(const {light} of beams)scene.add(light,light.target);
 const actor={car,rig,active:true,z:0,speed:0,distance:0,wait:0,passes:0};
 let lastPlayer=route.start;
 function pose(){
  car.position.set(-route.trackX,.026,actor.z);car.visible=actor.active;car.updateMatrixWorld(true);
  if(actor.active){
   rig.setDistance(actor.distance);
   rig.followWireSegment(new THREE.Vector3(-route.trackX,route.wireY,actor.z-18),new THREE.Vector3(-route.trackX,route.wireY,actor.z+18));
  }
  for(const {light,position,target} of beams){
   light.position.copy(position).applyMatrix4(rig.root.matrixWorld);
   light.target.position.copy(target).applyMatrix4(rig.root.matrixWorld);
   light.intensity=actor.active?rig.emitterIntensity(light):0;light.visible=true;
  }
 }
 function reset(playerZ=route.start){
  const z=spawnPoint(playerZ+155);
  Object.assign(actor,{active:z!==null,z:z??playerZ+155,speed:6.8,distance:0,wait:0,passes:0});rig.setBrake(0);lastPlayer=playerZ;pose();
 }
 function spawnPoint(z){for(const offset of [0,22,44,66])if(!traffic||traffic.clearForStreetcar(-1,z+offset))return z+offset;return null;}
 function update(dt,playerZ,time,alwaysGreen=false){
  dt=THREE.MathUtils.clamp(dt,0,.1);
  if(playerZ<lastPlayer-20)reset(playerZ);
  lastPlayer=playerZ;
  if(!actor.active){
   actor.wait-=dt;
   if(actor.wait<=0){const z=spawnPoint(playerZ+170);if(z!==null)Object.assign(actor,{active:true,z,speed:6.8,distance:0});}
  }
  if(actor.active){
   const red=!alwaysGreen&&time%42>=23;
   const crossing=[...route.crossings].reverse().find(c=>actor.z>=c.z+21-.01);
   const ahead=traffic?.leaderAhead(-1,actor.z,15.6,'oncoming');
   const distance=Math.min(red&&crossing?Math.max(0,actor.z-(crossing.z+21)):Infinity,ahead?Math.max(0,actor.z-ahead.z):Infinity);
   const desired=Math.min(6.8,Math.sqrt(2*.9*distance)),previous=actor.speed;
   actor.speed=Math.max(0,actor.speed+THREE.MathUtils.clamp(desired-actor.speed,-1.05*dt,.65*dt));
   const travel=Math.min(distance,(previous+actor.speed)*.5*dt);
   actor.z-=travel;actor.distance+=travel;
   if(distance<=travel)actor.speed=0;
   rig.setBrake(actor.speed<.05||(dt>0&&(previous-actor.speed)/dt>.08)?1:0,dt);
   if(actor.z<playerZ-85){actor.active=false;actor.passes++;actor.wait=22+(actor.passes%3)*4;}
  }
  pose();
 }
 reset();
 return {vehicles:[actor],update,reset,dispose(){rig.dispose();car.removeFromParent();}};
}
