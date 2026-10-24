import assert from 'node:assert/strict';
import {Ride} from '../dist/ride.js';
const route={start:0,end:160,stops:[{z:30},{z:90},{z:150}],crossings:[]};
function setup(mode='one'){
 const rig={doors:{front:0,rear:0},setDoor(_,value,instant){this.target=value;if(instant)this.doors.front=this.doors.rear=value;},setDistance(){},setBrake(){},update(dt){for(const side of ['front','rear'])this.doors[side]+=Math.sign(this.target-this.doors[side])*Math.min(Math.abs(this.target-this.doors[side]),dt);}};
 const ride=new Ride(route,rig,mode);ride.setDwellSeconds(0);ride.setAlwaysGreen(true);
 const events=[];let before;
 ride.onDepart=()=>{assert.equal(before.speed,0);assert.ok(ride.state.speed>0&&ride.state.z>before.z,'bell sees actual forward travel');events.push(ride.state.z);};
 return {ride,rig,events,step(dt=1/60,power=0){before={...ride.state};ride.step(dt,power);}};
}
let trips=0;
for(const mode of ['one','doors','watch'])for(const hz of [20,60,144]){
 const {ride,rig,events,step}=setup(mode);
 assert.equal(events.length,0);ride.go();assert.equal(events.length,0,'Go alone is silent');
 for(let stop=0;stop<3;stop++){
  for(let i=0;i<20000&&!['atStop','finished'].includes(ride.state.phase);i++)step(1/hz);
  assert.equal(ride.state.currentStop,stop);assert.equal(events.length,stop+1,'one bell per departure, never on arrival');
  if(stop===2)break;
  if(mode==='doors')ride.setDoors(true);
  // Prevent Watch's automatic departure while inspecting the full door cycle.
  ride.setDwellSeconds(10);
  for(let i=0;i<hz*2;i++)step(1/hz);
  assert.equal(events.length,stop+1,'holding open doors is silent');
  ride.setDwellSeconds(0);ride.setDoors(false);
  if(mode==='one')assert.ok(ride.go());
  assert.ok(rig.doors.front>.98);
  while(rig.doors.front>.001){step(1/hz);if(rig.doors.front>.001)assert.equal(events.length,stop+1,'closing doors are silent');}
  if(mode==='doors')assert.ok(ride.go());
 }
 trips++;
}
{
 const {ride,events,step}=setup();ride.go();step();assert.equal(events.length,1);
 ride.state.paused=true;for(let i=0;i<20;i++)step();ride.state.paused=false;step();
 assert.equal(events.length,1,'resuming a moving ride does not ring');
 const snapshot=ride.snapshot();assert.ok(ride.restore(snapshot));step();
 assert.equal(events.length,1,'restoring a moving ride does not ring');
 ride.trafficAhead=()=>({z:ride.state.z});for(let i=0;i<20;i++)step();
 assert.equal(ride.state.speed,0);assert.equal(events.length,1,'waiting for traffic is silent');
 ride.trafficAhead=()=>null;step();assert.equal(events.length,2,'first travel after a traffic stop rings');
 ride.restart();step(0);assert.equal(events.length,2,'restart and zero-time frames are silent');
 ride.go();step();assert.equal(events.length,3);
}
{
 const {ride,events,step}=setup('manual');ride.setDoors(true);
 for(let i=0;i<90;i++)step(1/60,1);assert.equal(events.length,0,'door interlock blocks bell and motion');
 ride.setDoors(false);while(ride.rig.doors.front>.001)step(1/60,1);
 for(let i=0;i<60;i++)step(1/60,1);assert.equal(events.length,1);
 while(ride.state.speed>0)step(1/60,-2);
 for(let i=0;i<60;i++)step(1/60,0);assert.equal(events.length,1);
 step(1/60,1);assert.equal(events.length,2,'manual stop then power rings once');
}
{
 const {ride,events,step}=setup();ride.setAlwaysGreen(false);ride.route={...route,crossings:[{z:21}]};
 ride.state.time=28;ride.go();for(let i=0;i<200;i++){step();if(ride.state.z===1)break;}
 assert.equal(ride.state.z,1);assert.equal(ride.state.speed,0);assert.equal(events.length,1);
 for(let i=0;i<60;i++)step();assert.equal(events.length,1);
 ride.setAlwaysGreen(true);step();assert.equal(events.length,2,'green signal departure rings on first forward frame');
}
console.log(`PASS: ${trips} full trips at three frame rates; initial, station, manual, signal and traffic departures; door interlocks, pause, restore and restart timing.`);
