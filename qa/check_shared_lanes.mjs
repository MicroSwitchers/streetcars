import assert from 'node:assert/strict';
import {Ride} from '../dist/ride.js';
import {advanceTraffic,trafficLeader,separateFromStreetcars} from '../dist/traffic-flow.js';
const car=(d,z,speed=5)=>({type:'car',moving:true,direction:d,z,speed,cruise:5.8,acceleration:.8,length:4.6,braking:0,distance:0,respawns:0});
const gap=(tram,a)=>tram.direction*(tram.z-a.z)-(tram.length+a.length)/2;
for(const d of [-1,1]){
 const tram={id:'tram',type:'streetcar',active:true,direction:d,length:15.6,z:0,speed:0,doorsOpen:true};
 const fleet=[car(d,-d*35),car(d,-d*52),car(d,-d*70),car(-d,d*50)];
 for(let i=0;i<500;i++)advanceTraffic(fleet,[],0,.05,true,[tram]);
 assert.ok(fleet.slice(0,3).every(a=>gap(tram,a)>=2.5&&a.speed===0&&a.braking>.99),'Cars must queue behind open streetcar doors');
 assert.ok(fleet[3].distance>60,'The opposite direction must continue');
 tram.doorsOpen=true;for(let i=0;i<50;i++)advanceTraffic(fleet,[],0,.05,true,[tram]);
 assert.ok(fleet.slice(0,3).every(a=>a.speed===0),'Closing doors remain protected until fully latched');
 tram.doorsOpen=false;for(let i=0;i<50;i++)advanceTraffic(fleet,[],0,.05,true,[tram]);
 assert.ok(fleet.slice(0,3).every(a=>a.speed===0),'Closed doors are not permission to overtake a stationary streetcar');
 for(let i=0;i<400;i++){
   tram.speed=i<200?4.5:Math.max(0,tram.speed-.075);tram.z+=d*tram.speed*.05;
   advanceTraffic(fleet,[],0,.05,true,[tram]);
   assert.ok(fleet.slice(0,3).every(a=>gap(tram,a)>=2.499),'No car may pass or overlap the streetcar');
 }
 assert.ok(fleet.slice(0,3).every(a=>a.distance>25),'Queue must follow a departing streetcar');
 const overlap=[car(d,tram.z),car(d,tram.z-d*4)];separateFromStreetcars(overlap,[tram]);
 assert.ok(overlap.every(a=>gap(tram,a)>=2.5),'Restart must repair streetcar spawn conflicts');
}
const route={start:-205,end:360,stops:[{z:-124},{z:76},{z:276}],crossings:[{z:-100},{z:100},{z:300}]};
const rig={doors:{front:0,rear:0},setDoor(which,v){this.doors.front=this.doors.rear=v;},setDistance(){},setBrake(){},update(){}};
const ride=new Ride(route,rig),tram={id:'player',type:'streetcar',active:true,direction:1,length:15.6,z:route.start,speed:0,doorsOpen:false};
const fleet=[car(1,-180),car(1,-242),car(1,-280),car(-1,-45)];
ride.trafficAhead=()=>trafficLeader(fleet,[tram],1,ride.state.z,15.6,'player');
let dwell=0,minimum=Infinity;
ride.go();
for(let i=0;i<10000&&!ride.state.complete;i++){
 ride.step(.05);Object.assign(tram,{z:ride.state.z,speed:ride.state.speed,doorsOpen:ride.state.doors});
 advanceTraffic(fleet,route.crossings,ride.state.time,.05,false,[tram]);
 for(const a of fleet.filter(a=>a.direction===1)){
   const clearance=Math.abs(a.z-tram.z)-(a.length+tram.length)/2;minimum=Math.min(minimum,clearance);assert.ok(clearance>=2.499,'Streetcar and cars cannot overlap');
 }
 if(ride.state.phase==='atStop'){dwell+=.05;if(dwell>4){ride.go();dwell=0;}}
}
assert.ok(ride.state.complete&&ride.state.served.every(Boolean),'Automatic ride must still serve all stops in mixed traffic');
// Manual power is also bounded by the physical queue, independently of signal assistance.
ride.setMode('manual');Object.assign(ride.state,{z:-205,speed:6,doors:false});rig.setDoor('both',0);
fleet[0].z=-180;fleet[0].speed=0;
for(let i=0;i<200;i++)ride.step(.05,1);
assert.ok(ride.state.z<=fleet[0].z-(15.6+fleet[0].length)/2-2.5+.001&&ride.state.speed===0);
console.log(`PASS: shared lanes in both directions; open/closing doors, 2.5 m rear clearance, no overtaking, restart separation, manual collision prevention, and all automatic stops. Minimum mixed-traffic clearance ${minimum.toFixed(3)} m.`);
