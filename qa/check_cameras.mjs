import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const threeUrl=new URL('../dist/vendor/three.module.js',import.meta.url);
const THREE=await import(threeUrl);
const source=(await readFile(new URL('../dist/cameras.js',import.meta.url),'utf8')).replace("'three'",JSON.stringify(threeUrl.href));
const {StreetcarCamera,CAMERA_MODES}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {Ride}=await import('../dist/ride.js');
globalThis.innerWidth=1440;globalThis.innerHeight=960;
globalThis.window={addEventListener(){}};
let dock={top:770,left:550};
globalThis.document={body:{dataset:{mode:'one'}},querySelector(selector){return selector==='.ride-dock'?{getBoundingClientRect:()=>dock}:{open:false};}};
const route={start:-205,end:360,trackX:-1.8,sidewalkX:-7.85,stops:[{z:-124},{z:76},{z:276}],crossings:[{z:-100},{z:100},{z:300}]};
const canvas={addEventListener(){},setPointerCapture(){}};
const settings={camera:'auto',swipe:true,reduceMotion:false};
const camera=new THREE.PerspectiveCamera(48,1.5,.5,1000);
const view=new StreetcarCamera(camera,canvas,settings,{route});
const settle=z=>{for(let i=0;i<180;i++)view.update(z,1/60);};
for(const mode of CAMERA_MODES){
 settings.camera=mode;view.reset();settle(-205);
 assert.ok(Number.isFinite(camera.position.length()),mode+' finite pose');
 if(mode==='auto'){
   const start=camera.position.clone();for(let i=0;i<600;i++)view.update(-205,1/60);
   const distance=camera.position.distanceTo(start);assert.ok(distance>.05&&distance<.8,'Calm view drifts slowly');
 }
 if(['auto','follow','front'].includes(mode)){
   const start=camera.position.clone();view.update(-204,1/60);
   assert.ok(Math.abs(camera.position.z-start.z-1)<.02,mode+' follows without a speed lurch');
   assert.ok(Math.abs(camera.position.y-start.y)<.001,mode+' keeps level height');
 }
 const before=camera.position.clone(),orientation=camera.quaternion.clone();view.update(view.lastZ,1/60,true);
 assert.ok(camera.position.distanceTo(before)<1e-8&&camera.quaternion.angleTo(orientation)<1e-7,mode+' pause freezes automatic camera movement');
}
settings.camera='sidewalk';view.reset();settle(-205);
const anchored=camera.position.clone();
for(let z=-205;z<-164;z+=.1)view.update(z,1/60);
assert.ok(camera.position.distanceTo(anchored)<1e-6,'Sidewalk observer stays still throughout a pass');
assert.equal(camera.position.y,1.65,'Sidewalk is at standing eye height');
view.update(-162,1/60);
assert.ok(view.transition&&view.transition.progress===0,'Next viewpoint begins under a dissolve');
assert.ok(camera.position.z>anchored.z+40,'Next pass is farther along the street');
const fading=view.transition,oldObserver=fading.from.position.clone(),oldAim=fading.target.z,oldZ=fading.z,oldPan=fading.from.quaternion.clone();
view.update(-161,.1);
assert.ok(fading.from.position.distanceTo(oldObserver)<1e-8,'Outgoing sidewalk observer stays on its original spot');
assert.ok(Math.abs(fading.target.z-oldAim-(-161-oldZ))<1e-8,'Outgoing sidewalk view keeps tracking the moving car');
assert.ok(fading.from.quaternion.angleTo(oldPan)>.001,'Outgoing sidewalk camera keeps panning during its fade');
const fadeProgress=fading.progress,pausedAim=fading.target.clone(),pausedPan=fading.from.quaternion.clone();
view.update(-161,.1,true);
assert.equal(fading.progress,fadeProgress,'Explicit pause freezes the dissolve');
assert.ok(fading.target.equals(pausedAim)&&fading.from.quaternion.angleTo(pausedPan)<1e-7,'Explicit pause freezes outgoing tracking');
settle(-161);assert.equal(view.transition,null,'Dissolve completes');
view.update(-205,1/60);assert.ok(view.transition,'Repeat ride dissolves instead of flying backwards');
settings.camera='follow';view.reset();settle(-205);
settings.camera='sidewalk';view.reset();
const movingFade=view.transition,movingStart=movingFade.from.position.z;
assert.equal(movingFade.mode,'follow','Fade retains the outgoing mode when the selected camera changes');
view.update(-204,.1);
assert.ok(Math.abs(movingFade.from.position.z-movingStart-1)<1e-8,'Outgoing following camera continues travelling with the streetcar');
let framingChecks=0;
const parked=Array.from({length:25},(_,i)=>({x:-6.6,z:-240+i*29,length:4.7,moving:false}));
view.rideContext.traffic={actors:[...parked,{x:6.6,z:-181,length:4.7,moving:false},{x:-1.8,z:-181,length:4.7,moving:true}]};
const fixtures=Array.from({length:18},(_,i)=>({minX:-8.18,maxX:-8.02,minZ:-230+i*34-.08,maxZ:-230+i*34+.08,maxY:7}));
view.rideContext.obstacles=()=>fixtures;
for(const [width,height] of [[1440,960],[390,844],[844,390],[320,568],[430,932],[768,1024]])for(const reduceMotion of [false,true])for(const speed of [10/3.6,20/3.6,30/3.6]){
 globalThis.innerWidth=width;globalThis.innerHeight=height;
 dock=height<540?{top:height*.18,left:width-220}:{top:height*.78,left:width*.3};
 camera.aspect=width/height;settings.reduceMotion=reduceMotion;view.reset();
 let lastAnchor=null,changes=0,passMin=Infinity,passMax=-Infinity,fullPans=0;
 for(let z=route.start;z<=route.end;z+=speed/30){
   view.update(z,1/30);camera.updateMatrixWorld(true);
   if(camera.position.z!==lastAnchor){
     if(lastAnchor!==null){
       assert.ok(z-lastAnchor>=17.5,'The observer follows until the car has passed, including portrait');
       if(passMax-passMin>THREE.MathUtils.degToRad(110))fullPans++;
     }
     changes++;lastAnchor=camera.position.z;passMin=Infinity;passMax=-Infinity;
   }
   const pan=Math.atan2(view.target.z-camera.position.z,Math.abs(camera.position.x-route.trackX));
   passMin=Math.min(passMin,pan);passMax=Math.max(passMax,pan);
   assert.equal(camera.position.x,-8.1,'Observer stays behind the curb and parked mirrors');
   assert.equal(camera.position.y,1.65,'Observer stays at eye height');
   for(const car of parked)assert.ok(Math.abs(camera.position.z-car.z)-car.length/2>=3.2-1e-8,'Observer uses a clear parking gap, including near-plane clearance');
   for(const o of fixtures)assert.ok(camera.position.z<=o.minZ-.85||camera.position.z>=o.maxZ+.85,'Observer also avoids sidewalk poles');
   for(const x of [-1.3,1.3])for(const y of [.08,3.65])for(const end of [-8.1,8.1]){
     const point=new THREE.Vector3(route.trackX+x,y,z+end).project(camera);
     const closePortrait=width/height<.8&&Math.abs(z-camera.position.z)<14;
     assert.ok((closePortrait||Math.abs(point.x)<.98)&&Math.abs(point.y)<.98,
       `Entire streetcar stays in frame ${width}x${height}, reduced motion ${reduceMotion}, z ${z.toFixed(2)}, projection ${point.toArray()}, fov ${camera.fov}`);
     if(height>=540)assert.ok((1-point.y)*height/2<dock.top-7,'Streetcar stays above the bottom controls');
     framingChecks++;
   }
   const centre=new THREE.Vector3(route.trackX,1.72,z).project(camera);
   assert.ok(Math.abs(centre.x)<(width/height<.8?.55:.98)&&Math.abs(centre.y)<.9,`Streetcar remains visible through the pass: ${width}x${height}, z ${z}, observer ${camera.position.z}, centre ${centre.toArray()}`);
 }
 assert.ok(changes>=8,'Sidewalk viewpoints cover the full route');
 assert.ok(fullPans>=5,'Sidewalk follows through broad approach-to-departure pans on every screen shape');
 const beforePosition=camera.position.clone(),beforeOrientation=camera.quaternion.clone(),beforeFov=camera.fov;
 for(let i=0;i<60;i++)view.update(view.lastZ,1/30,true);
 assert.ok(camera.position.distanceTo(beforePosition)<1e-8&&camera.quaternion.angleTo(beforeOrientation)<1e-7&&camera.fov===beforeFov,'Pause freezes sidewalk framing');
}
globalThis.innerWidth=1440;globalThis.innerHeight=960;dock={top:770,left:550};camera.aspect=1.5;
settings.camera='auto';settings.reduceMotion=true;view.reset();settle(-205);
const still=camera.position.clone();for(let i=0;i<600;i++)view.update(-205,1/60);
assert.ok(camera.position.distanceTo(still)<1e-8,'Calmer camera removes automatic drift');
const rig={doors:{front:0,rear:0},setDoor(which,value){this.doors.front=this.doors.rear=value;},setDistance(){},update(){}};
const ride=new Ride(route,rig,'watch');ride.setAlwaysGreen(true);ride.setDwellSeconds(10);
for(let i=0;i<3000&&ride.state.phase!=='atStop';i++)ride.step(.1);
assert.equal(ride.state.phase,'atStop');for(let i=0;i<90;i++)ride.step(.1);
assert.equal(ride.state.phase,'atStop','Just watch gives a full pause with the doors open');
for(let i=0;i<20;i++)ride.step(.1);assert.ok(['closing','travelling'].includes(ride.state.phase),'Just watch departs on its own after the pause');
ride.restart();
let loops=0,arrivals=0,lastPhase=ride.state.phase,previousZ=ride.state.z;
for(let i=0;i<10000&&loops<2;i++){
 ride.step(.1);
 if(['atStop','finished'].includes(ride.state.phase)&&ride.state.phase!==lastPhase){arrivals++;assert.ok(ride.state.doors,'Watch mode opens doors');}
 if(ride.state.z<previousZ-20)loops++;
 previousZ=ride.state.z;lastPhase=ride.state.phase;
}
assert.equal(loops,2,'Just watch repeats without input');assert.equal(arrivals,6,'Just watch serves every stop on both rides');
ride.state.paused=true;const z=ride.state.z,time=ride.state.time;for(let i=0;i<20;i++)ride.step(.1);
assert.equal(ride.state.z,z);assert.equal(ride.state.time,time,'Pause freezes watch timer');
ride.setMode('one');ride.restart();for(let i=0;i<200;i++)ride.step(.1);assert.equal(ride.state.phase,'ready','One button still waits for Go');
console.log(`PASS: ${framingChecks} sidewalk framing projections and complete approach-to-departure pans across screen sizes, speeds and reduced motion.`);
console.log('PASS: five views, calm drift, fixed sidewalk passes, live outgoing tracking, dissolves, pause, reduced motion and two complete automatic watch rides.');
