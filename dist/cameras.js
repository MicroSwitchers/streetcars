import * as THREE from 'three';

export const CAMERA_MODES=['auto','follow','front','sidewalk','free'];
export const CAMERA_NAMES={auto:'Calm view',follow:'Following view',front:'Front view',sidewalk:'Sidewalk view',free:'Explore view'};

// Watching views have a level horizon. Sidewalk changes use a dissolve instead
// of moving the observer rapidly through the street. Explore keeps its controls.
export class StreetcarCamera {
 constructor(camera,canvas,settings,rideContext=null){
   Object.assign(this,{camera,canvas,settings,rideContext,yaw:0,pitch:0,
     userView:false,elapsed:0,lastZ:null,pointer:null,instant:true,
     distanceScale:1,viewport:''});
   this.goal=new THREE.Vector3();this.target=new THREE.Vector3();this.lookGoal=new THREE.Vector3();
   this.hasPose=false;this.transition=null;this.transitionId=0;this.sidewalkIndex=null;
   this.sidewalkStops=this.makeSidewalkStops();
   this.pointers=new Map();this.pinchDistance=0;this.resetOrbit();
   canvas.addEventListener('pointerdown',e=>{
     if(!settings.swipe)return;
     const point={id:e.pointerId,x:e.clientX,y:e.clientY};
     this.pointers.set(e.pointerId,point);this.pointer=point;
     this.pinchDistance=0;canvas.setPointerCapture(e.pointerId);
   });
   canvas.addEventListener('pointermove',e=>{
     const point=this.pointers.get(e.pointerId);
     if(!settings.swipe||!point)return;
     const dx=e.clientX-point.x,dy=e.clientY-point.y;
     point.x=e.clientX;point.y=e.clientY;
     this.userView=true;
     if(settings.camera==='free'){
       if(this.pointers.size>1){
         const [a,b]=[...this.pointers.values()];
         const distance=Math.hypot(a.x-b.x,a.y-b.y);
         if(this.pinchDistance>0&&distance>0)this.zoomOrbit(this.pinchDistance/distance);
         this.pinchDistance=distance;
       }else{
         this.orbitYaw-=dx*.006;
         this.orbitHeight=THREE.MathUtils.clamp(this.orbitHeight+dy*.018,.9,7.5);
       }
     }else{
       this.yaw=THREE.MathUtils.clamp(this.yaw-dx*.003,-1,1);
       this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.002,-.3,.3);
     }
   });
   for(const event of ['pointerup','pointercancel','lostpointercapture'])
     canvas.addEventListener(event,e=>{
       this.pointers.delete(e.pointerId);this.pinchDistance=0;
       this.pointer=this.pointers.values().next().value??null;
     });
   canvas.addEventListener('wheel',e=>{
     if(!settings.swipe)return;
     e.preventDefault();
     if(settings.camera==='free'){this.zoomOrbit(Math.exp(e.deltaY*.001));this.userView=true;}
     else this.distanceScale=THREE.MathUtils.clamp(this.distanceScale+e.deltaY*.0003,.88,1.15);
   },{passive:false});
   window.addEventListener('keydown',e=>{
     if(settings.camera!=='free'||!settings.swipe||e.ctrlKey||e.metaKey||e.altKey||
       document.querySelector('#settings-dialog')?.open||
       e.target.closest('input,select,textarea'))return;
     const key=e.code;
     if(!['KeyJ','KeyL','KeyI','KeyK','Equal','Minus','NumpadAdd','NumpadSubtract'].includes(key))return;
     e.preventDefault();this.userView=true;
     if(key==='KeyJ')this.orbitYaw+=.12;
     if(key==='KeyL')this.orbitYaw-=.12;
     if(key==='KeyI')this.orbitHeight=THREE.MathUtils.clamp(this.orbitHeight+.25,.9,7.5);
     if(key==='KeyK')this.orbitHeight=THREE.MathUtils.clamp(this.orbitHeight-.25,.9,7.5);
     if(key==='Equal'||key==='NumpadAdd')this.zoomOrbit(.9);
     if(key==='Minus'||key==='NumpadSubtract')this.zoomOrbit(1/.9);
   });

 }
 makeSidewalkStops(){
   const route=this.rideContext?.route;
   if(!route)return [0];
   const points=[route.start+24];
   for(const stop of [...route.stops,{z:route.end+32}]){
     while(stop.z-points[points.length-1]>64)points.push(points[points.length-1]+48);
     if(stop.z>points[points.length-1])points.push(stop.z);
   }
   return points;
 }
 beginTransition(){
   if(this.hasPose)this.transition={id:++this.transitionId,from:this.camera.clone(),
     target:this.target.clone(),z:this.lastZ,mode:this.poseMode,
     progress:0,duration:this.settings.reduceMotion?4:2.8};
 }
 updateTransition(z,dt,paused){
   const transition=this.transition;
   if(!transition||paused)return;
   const travel=transition.z===null?0:z-transition.z;
   // Both cameras see the current simulation throughout a dissolve. A sidewalk
   // observer keeps panning from the same spot; travelling views keep following.
   if(transition.mode!=='sidewalk'||travel<-20)transition.from.position.z+=travel;
   transition.target.z+=travel;transition.z=z;
   transition.from.lookAt(transition.target);
   transition.progress=Math.min(1,transition.progress+dt/transition.duration);
   if(transition.progress>=1)this.transition=null;
 }
 reset(){
   this.beginTransition();this.sidewalkIndex=null;
   this.userView=false;this.yaw=0;this.pitch=0;this.distanceScale=1;
   this.pointer=null;this.instant=true;this.pointers.clear();this.pinchDistance=0;this.resetOrbit();
 }
 resetOrbit(){
   const portrait=this.camera.aspect<.8;
   this.orbitYaw=Math.sign(this.rideContext?.route.trackX??-1.8)*(portrait?.22:.4);this.orbitHeight=3.15;this.orbitDistance=portrait?17:14;
   this.currentYaw=this.orbitYaw;this.currentHeight=this.orbitHeight;
   this.currentDistance=this.orbitDistance;this.orbitReady=false;
 }
 zoomOrbit(factor){this.orbitDistance=THREE.MathUtils.clamp(this.orbitDistance*factor,11,36);}
 updateOrbit(z,dt){
   if(!this.orbitReady){this.resetOrbit();this.orbitReady=true;}
   if(this.instant){this.currentYaw=this.orbitYaw;this.currentHeight=this.orbitHeight;this.currentDistance=this.orbitDistance;}
   else{
     this.currentYaw+=THREE.MathUtils.clamp((this.orbitYaw-this.currentYaw)*10,-2.5,2.5)*dt;
     this.currentHeight=THREE.MathUtils.damp(this.currentHeight,this.orbitHeight,10,dt);
     this.currentDistance=THREE.MathUtils.damp(this.currentDistance,this.orbitDistance,10,dt);
   }
   const trackX=this.rideContext?.route.trackX??-1.8;
   const sine=Math.sin(this.currentYaw),cosine=Math.cos(this.currentYaw);
   const room=sine>=0?7.35-trackX:trackX+7.35;
   // Keep the orbit in the street. Clearance can shorten its radius, never raise it.
   const radius=Math.min(this.currentDistance,Math.abs(sine)>.0001?room/Math.abs(sine):Infinity);
   this.goal.set(trackX+sine*radius,this.currentHeight,z+cosine*radius);
   const portrait=this.camera.aspect<.8;
   this.target.set(trackX-Math.sign(trackX)*(portrait?.45:0)*cosine,1.55,z+(portrait?3:1.8)*cosine);
   this.camera.position.copy(this.goal);
   const w=innerWidth,h=innerHeight,dock=document.querySelector('.ride-dock').getBoundingClientRect();
   const sideControls=w>700&&h<540&&['one','watch'].includes(document.body.dataset.mode);
   const offset=sideControls?0:Math.round(Math.min(h*.2,Math.max(0,(h-dock.top)*.45)));
   const offsetX=sideControls?Math.max(0,Math.round((w-dock.left+12)/2)-32):0;
   const base=portrait?52:h<540?(sideControls?68:92):48;
   const fov=THREE.MathUtils.clamp(base+Math.log(this.currentDistance/(portrait?17:14))*40,34,92);
   const key=`free/${w}/${h}/${offset}/${offsetX}/${fov}`;
   if(key!==this.viewport){
     this.camera.fov=fov;this.camera.setViewOffset(w,h,offsetX,offset,w,h);this.viewport=key;
   }
   this.camera.lookAt(this.target);this.lastZ=z;this.instant=false;
 }
 // Frame the subject above the controls without tilting or rolling the horizon.
 frameWatching(fov){
   const w=innerWidth,h=innerHeight,dock=document.querySelector('.ride-dock').getBoundingClientRect();
   const sideControls=w>700&&h<540&&['one','watch'].includes(document.body.dataset.mode);
   const offset=sideControls?0:Math.round(Math.min(h*.17,Math.max(0,(h-dock.top)*.42)));
   const offsetX=sideControls?Math.max(0,Math.round((w-dock.left+12)/2)-30):0;
   const key=`watch/${w}/${h}/${offset}/${offsetX}/${fov}`;
   if(key!==this.viewport){this.camera.fov=fov;this.camera.setViewOffset(w,h,offsetX,offset,w,h);this.viewport=key;}
 }
 chooseSidewalkAnchor(anchor){
   const route=this.rideContext?.route,side=Math.sign(route?.trackX??-1.8);
   const x=side*Math.max(8.10,Math.abs(route?.sidewalkX??7.85));
   // A near plane can cut through a parked roof before the eye enters its mesh.
   // Pick a gap once per pass, with room for both the observer and foreground.
   const parked=(this.rideContext?.traffic?.actors??[]).filter(a=>!a.moving&&Math.sign(a.x)===side);
   const fixtures=(this.rideContext?.obstacles?.()??[]).filter(o=>o.maxY>.8&&o.minX<x+.85&&o.maxX>x-.85);
   let best=anchor,bestRoom=-Infinity;
   for(const offset of [0,1,-1,2,-2,3,-3,4,-4,5,-5,6,-6,7,-7,8,-8,9,-9,10,-10,11,-11,12,-12]){
     const z=anchor+offset;
     let room=parked.reduce((gap,a)=>Math.min(gap,Math.abs(z-a.z)-a.length/2-3.2),Infinity);
     for(const o of fixtures)room=Math.min(room,Math.max(o.minZ-z,z-o.maxZ)-.85);
     if(room>bestRoom){best=z;bestRoom=room;}
     if(room>=0)return {x,z};
   }
   return {x,z:best};
 }
 updateSidewalk(z,dt,paused){
   const portrait=this.camera.aspect<.8,passEnd=18;
   if(this.sidewalkIndex===null){
     this.sidewalkAnchor=null;
     this.sidewalkIndex=this.sidewalkStops.findIndex(point=>z<=point+passEnd);
     if(this.sidewalkIndex<0)this.sidewalkIndex=this.sidewalkStops.length-1;
   }
   let anchor=this.sidewalkStops[this.sidewalkIndex];
   if(!this.sidewalkAnchor||this.sidewalkAnchor.index!==this.sidewalkIndex){
     this.sidewalkAnchor={...this.chooseSidewalkAnchor(anchor),index:this.sidewalkIndex};
   }
   if(!paused&&z>this.sidewalkAnchor.z+passEnd&&this.sidewalkIndex<this.sidewalkStops.length-1){
     this.beginTransition();
     do{
       anchor=this.sidewalkStops[++this.sidewalkIndex];
       this.sidewalkAnchor={...this.chooseSidewalkAnchor(anchor),index:this.sidewalkIndex};
     }while(z>this.sidewalkAnchor.z+passEnd&&this.sidewalkIndex<this.sidewalkStops.length-1);
     this.instant=true;
   }
   const observer=this.sidewalkAnchor;
   const trackX=this.rideContext?.route.trackX??-1.8;
   // Stay at standing eye height and watch the car pass before changing spots.
   // Portrait naturally shows a closer section of the body as it passes the
   // observer; do not cut its pan short or stretch the lens to fit every end.
   // Stand on the curb side of the path, ahead of trees and pole furniture.
   this.goal.set(observer.x,1.65,observer.z);
   if(!paused||this.instant){
     const side=Math.sign(this.goal.x-trackX),gap=Math.abs(this.goal.x-trackX);
     let low=Infinity,high=-Infinity;
     for(const x of [-1.3,1.3])for(const end of [-8.1,8.1]){
       const angle=Math.atan2(z+end-observer.z,gap-side*x);
       low=Math.min(low,angle);high=Math.max(high,angle);
     }
     // Landscape centres the full silhouette. Portrait follows the body centre
     // through its close pass instead of biasing toward the nearer end.
     // Essential subject tracking also stays enabled with reduced motion.
     const pan=portrait?Math.atan2(z-observer.z,gap):(low+high)*.5;
     const swipe=this.userView?this.yaw*.07:0;
     this.target.set(trackX,1.72,observer.z+Math.tan(pan+swipe)*gap);
   }
   this.camera.position.copy(this.goal);this.camera.lookAt(this.target);
   this.camera.updateMatrixWorld(true);
   // Fit the body in the usable part of the screen, including the
   // view offset that leaves room for the controls. Widen immediately when
   // required; ease back in as the car moves away from this observer. Retain
   // the lens limit during the close portrait pass, keeping the subject centred.
   this.frameWatching(66);
   const projection=this.camera.projectionMatrix.elements;
   const centreX=-projection[8],centreY=-projection[9];
   const dock=document.querySelector('.ride-dock').getBoundingClientRect();
   const bottom=1-2*Math.min(innerHeight*.92,dock.top-12)/innerHeight;
   const safeX=Math.max(.25,.90-Math.abs(centreX));
   let tangent=Math.tan(THREE.MathUtils.degToRad(portrait?62:56)*.5);
   const point=new THREE.Vector3();
   for(const x of [-1.3,1.3])for(const y of [.08,3.65])for(const end of [-8.1,8.1]){
     point.set(trackX+x,y,z+end).applyMatrix4(this.camera.matrixWorldInverse);
     const depth=Math.max(.5,-point.z);
     tangent=Math.max(tangent,Math.abs(point.x)/(depth*this.camera.aspect*safeX));
     const room=point.y>=0?.88-centreY:centreY-bottom;
     tangent=Math.max(tangent,Math.abs(point.y)/(depth*Math.max(.2,room)));
   }
   const required=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(tangent)),56,105);
   if(!paused||this.instant){
     this.sidewalkFov=this.instant||!this.sidewalkFov?required:
       Math.max(required,THREE.MathUtils.damp(this.sidewalkFov,required,1.5,dt));
   }
   this.frameWatching(this.sidewalkFov??required);
 }
 update(z,dt=0,paused=false){
   dt=THREE.MathUtils.clamp(dt,0,.1);
   // A repeated ride returns to the beginning under the same soft dissolve.
   if(this.lastZ!==null&&z<this.lastZ-20){this.beginTransition();this.sidewalkIndex=null;this.instant=true;}
   this.updateTransition(z,dt,paused);
   if(this.settings.camera==='free'){
     this.updateOrbit(z,dt);this.hasPose=true;this.poseMode='free';return;
   }
   if(!paused)this.elapsed+=dt;
   if(this.settings.camera==='sidewalk')this.updateSidewalk(z,dt,paused);
   else{
     const trackX=this.rideContext?.route.trackX??-1.8,portrait=this.camera.aspect<.8,side=Math.sign(trackX);
     const calm=this.settings.camera==='auto';
     // One slow 100-second drift, with no automatic orbit, bobbing or zoom cuts.
     const drift=calm&&!this.settings.reduceMotion?Math.sin(this.elapsed*Math.PI*2/100):0;
     const swipe=this.userView?this.yaw:0;
     let fov=portrait?47:38;
     if(this.settings.camera==='follow'){
       this.goal.set(trackX+side*(5.2+swipe*.6),3.65,z-(portrait?25:21)*this.distanceScale);
       this.lookGoal.set(trackX,1.65+this.pitch,z-1.5);
     }else if(this.settings.camera==='front'){
       this.goal.set(trackX+side*(2.8+swipe*.5),2.35,z+(portrait?27:24)*this.distanceScale);
       this.lookGoal.set(trackX,1.65+this.pitch,z+2);
       fov=portrait?46:35;
     }else{
       this.goal.set(trackX-side*(7.0-drift*.65-swipe*.6),4.1,z+(portrait?27:23)*this.distanceScale+drift*.8);
       this.lookGoal.set(trackX,1.65+this.pitch,z+.5);
       fov=portrait?48:39;
     }
     if(this.instant){this.camera.position.copy(this.goal);this.target.copy(this.lookGoal);}
     else if(!paused){
       // Follow the car's displacement exactly; damp only the small view adjustment.
       const travel=this.lastZ===null?0:z-this.lastZ;
       this.camera.position.z+=travel;this.target.z+=travel;
       const smooth=1-Math.exp(-dt*1.1);
       this.camera.position.lerp(this.goal,smooth);this.target.lerp(this.lookGoal,smooth);
     }
     this.frameWatching(fov);this.camera.lookAt(this.target);
   }
   this.lastZ=z;this.instant=false;this.hasPose=true;this.poseMode=this.settings.camera;
 }
}
