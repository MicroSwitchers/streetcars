import assert from 'node:assert/strict';
import {Ride} from '../dist/ride.js';
import {AdaptiveQuality,QUALITY,initialQuality,renderRatio} from '../dist/performance.js';
const route={start:0,end:205,stops:[20,60,100,140,180].map(z=>({z})),crossings:[]};
function rig(){return {doors:{front:0,rear:0},target:0,setDoor(which,v,instant){this.target=v;if(instant)this.doors.front=this.doors.rear=v;},setDistance(v){this.distance=v;},setBrake(){},update(dt){const change=Math.sign(this.target-this.doors.front)*Math.min(Math.abs(this.target-this.doors.front),dt);this.doors.front+=change;this.doors.rear=this.doors.front;}};}
const defaults=new Ride(route,rig());assert.equal(defaults.alwaysGreen,true);assert.equal(defaults.stopAtLights,false);assert.equal(defaults.dwellSeconds,5);defaults.state.time=30;defaults.syncSignal();assert.equal(defaults.state.signal,'green');defaults.setDwellSeconds('invalid');assert.equal(defaults.dwellSeconds,5);
let trips=0,timedHolds=0;
for(const mode of ['one','doors','watch'])for(const stopEvery of [1,2])for(const dwell of [0,5,10,30])for(const hz of [20,60]){
 const model=rig(),ride=new Ride(route,model,mode);ride.setStopEvery(stopEvery);ride.setDwellSeconds(dwell);ride.setAlwaysGreen(true);
 const visits=[],openedAt=new Map();let fullyOpenAt=-1,firstVisit=-1;
 ride.onDoors=open=>{if(open){assert.equal(ride.state.speed,0);openedAt.set(ride.state.currentStop,ride.state.time);fullyOpenAt=-1;}else if(ride.state.currentStop>=0&&dwell){assert.ok(fullyOpenAt>=0&&ride.state.time-fullyOpenAt>=dwell-2/hz,'hold starts when both doors are fully open');timedHolds++;}};
 if(mode!=='watch')ride.go();
 for(let tick=0;tick<100000;tick++){
   ride.step(1/hz);const s=ride.state;
   if(s.doors&&model.doors.front>=.98&&fullyOpenAt<0)fullyOpenAt=s.time;
   if(['atStop','finished'].includes(s.phase)){
     if(s.phase==='finished'&&ride.mode==='watch')ride.setMode('one');
     if(visits.at(-1)!==s.currentStop){visits.push(s.currentStop);firstVisit=tick;}
     if(mode==='doors'&&!s.openedHere)ride.setDoors(true);
     if(s.doors&&ride.remainingDwell>1e-6){assert.equal(ride.canGo,false);assert.equal(ride.go(),false);assert.equal(ride.setDoors(false),false);}
     if(s.phase==='finished'&&ride.dwellReady&&(!dwell||model.doors.front>=.98))break;
     if(mode!=='watch'&&tick>firstVisit+1&&ride.dwellReady){if(mode==='doors')ride.setDoors(false);ride.go();}
   }
   assert.ok(tick<99999,'every selected stop remains reachable');
 }
 assert.deepEqual(visits,stopEvery===1?[0,1,2,3,4]:[0,2,4]);
 assert.deepEqual(ride.state.served,stopEvery===1?[true,true,true,true,true]:[true,false,true,false,true]);trips++;
}
// Even-length routes also retain their terminal stop.
const extra=new Ride({...route,stops:route.stops.slice(0,4)},rig());extra.setStopEvery(2);assert.equal(extra.nextScheduledStop(3),3);
const r=new Ride(route,rig());r.setDwellSeconds(5);r.state.currentStop=0;r.state.z=20;r.state.phase='atStop';r.setDoors(true);r.step(.1);r.state.paused=true;
for(let i=0;i<100;i++)r.step(.1);assert.equal(r.state.dwell,0,'pause must not use up door time');
r.state.paused=false;for(let i=0;i<70;i++)r.step(.1);assert.ok(r.dwellReady);assert.equal(r.state.phase,'atStop','One button never departs automatically');
r.setDwellSeconds(30);assert.equal(r.canGo,false);r.setDwellSeconds(0);assert.equal(r.canGo,true);
r.state.paused=true;const snapshot=r.snapshot(),restored=new Ride(route,rig());assert.ok(restored.restore(snapshot));assert.equal(restored.state.z,20);assert.equal(restored.state.doors,true);assert.equal(restored.state.paused,true);assert.deepEqual(restored.state.served,r.state.served);
assert.equal(restored.restore({...snapshot,state:{...snapshot.state,z:99999}}),false);assert.equal(restored.restore({...snapshot,state:{...snapshot.state,speed:Infinity}}),false);
for(const [device,expected] of [[{},'high'],[{coarse:true},'balanced'],[{memory:2},'low'],[{memory:4},'balanced']])assert.equal(initialQuality(device),expected);
for(const profile of Object.values(QUALITY))for(const [w,h,dpr] of [[390,844,3],[1024,1366,2],[3840,2160,2],[7680,4320,2]])assert.ok(w*h*renderRatio(profile,w,h,dpr)**2<=profile.pixels+1);
const auto=new AdaptiveQuality('high');for(let i=0;i<400;i++)auto.sample(.05);assert.equal(auto.level,'balanced');
for(let i=0;i<450;i++)auto.sample(.05);assert.equal(auto.level,'low');
for(let i=0;i<2200;i++)auto.sample(1/60);assert.equal(auto.level,'balanced');
auto.select('high');for(let i=0;i<2000;i++)auto.sample(.05);assert.equal(auto.level,'high','manual graphics choice stays fixed');
auto.select('auto');for(let i=0;i<2000;i++)auto.sample(.2,false);assert.equal(auto.level,'high','paused/background time never reduces quality');
console.log(JSON.stringify({pass:true,trips,timedHolds,doorSeconds:[0,5,10,30],stopIntervals:[1,2],snapshotRestore:true,adaptiveQuality:true,pixelBudgets:true}));
