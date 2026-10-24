import assert from 'node:assert/strict';
import {Ride} from '../dist/ride.js';
const route={start:-205,end:360,stops:[{z:-124},{z:76},{z:276}],crossings:[]};
let arrivals=0;
for(const mode of ['one','doors','watch'])for(const hz of [20,30,60,120,144])for(const cruise of [12,20,30]){
 const rig={doors:{front:0,rear:0},setDoor(){},setDistance(m){this.distance=m;},update(){},setBrake(){}};
 const ride=new Ride(route,rig,mode);ride.cruise=cruise/3.6;
 ride.onDoors=open=>{if(open){assert.equal(ride.state.speed,0);assert.equal(ride.state.z,route.stops[ride.state.currentStop].z,'door callback sees the final stopping point');}};
 ride.go();
 for(let tick=0;tick<100000;tick++){
   const before={...ride.state},dt=(tick%11===0?.7:1)/hz;ride.step(dt);
   const travel=ride.state.z-before.z;
   assert.ok(travel>=0&&travel<=before.speed*dt+.5*.70*dt*dt+1e-9,'arrival must not add a position snap');
   if(['atStop','finished'].includes(ride.state.phase)){
     const stopped=ride.state.z,wheels=rig.distance;
     if(mode==='doors')ride.setDoors(true);
     for(let i=0;i<Math.ceil(hz*1.5);i++){ride.step(1/hz);assert.equal(ride.state.z,stopped);assert.equal(rig.distance,wheels);}
     arrivals++;
     if(ride.state.phase==='finished')break;
     ride.setDwellSeconds(0);
     if(mode==='doors')ride.setDoors(false);
     assert.ok(ride.go());
     ride.setDwellSeconds(10);
   }
   assert.ok(tick<99999,'ride must finish');
 }
}
assert.equal(arrivals,135);
console.log('PASS: 135 arrivals across three modes, three speeds and five frame rates; bounded braking travel, final-pose door callbacks, stationary body and wheels throughout opening.');
