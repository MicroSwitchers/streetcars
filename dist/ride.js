// Engine-neutral ride logic. Just watch alone departs and repeats automatically.
export class Ride {
 constructor(route,rig,mode='one'){this.route=route;this.rig=rig;this.state={};this.mode=mode;this.cruise=20/3.6;this.alwaysGreen=true;this.stopAtLights=false;this.dwellSeconds=5;this.stopEvery=1;this.restart();}
 scheduled(index){return index===this.route.stops.length-1||index%this.stopEvery===0;}
 nextScheduledStop(index){while(index<this.route.stops.length&&!this.scheduled(index))index++;return index;}
 setStopEvery(value){this.stopEvery=+value===2?2:1;const s=this.state;let index=this.route.stops.findIndex(stop=>stop.z>s.z+.02);if(index<0)index=this.route.stops.length;s.nextStop=this.nextScheduledStop(index);}
 setDwellSeconds(value){this.dwellSeconds=[0,5,10,15,20,30].includes(+value)?+value:5;}
 get remainingDwell(){return this.state.doors&&this.state.currentStop>=0?Math.max(0,this.dwellSeconds-this.state.dwell):0;}
 get dwellReady(){return this.dwellSeconds===0||this.remainingDwell<=1e-7;}
 setAlwaysGreen(value){this.alwaysGreen=!!value;this.syncSignal();}
 setStopAtLights(value){this.stopAtLights=!!value;if(!this.stopAtLights)this.state.assist=false;}
 syncSignal(){const s=this.state;s.signal=this.alwaysGreen||s.time%42<23?'green':s.time%42<27?'amber':'red';if(s.signal==='green')s.assist=false;}
 restart(){Object.assign(this.state,{z:this.route.start,speed:0,metres:0,power:0,time:0,paused:false,doors:false,served:this.route.stops.map(()=>false),dwell:0,nextStop:this.nextScheduledStop(0),currentStop:-1,phase:this.mode==='manual'?'manual':'ready',complete:false,signal:'green',assist:false,command:0,openedHere:false,braking:true});this.rig.setDoor('both',0,true);this.rig.setDistance(0);this.rig.setBrake?.(1);}
 setMode(mode){if(!['one','doors','manual','watch'].includes(mode))return;this.mode=mode;const s=this.state;s.power=0;if(mode==='manual'){s.phase='manual';return;}s.nextStop=this.route.stops.findIndex(stop=>stop.z>s.z+6);if(s.nextStop<0)s.nextStop=this.route.stops.length;s.nextStop=this.nextScheduledStop(s.nextStop);if(s.speed>.12){s.phase='travelling';this.setDoors(false);return;}const at=this.route.stops.findIndex(stop=>Math.abs(stop.z-s.z)<6);s.currentStop=at;s.phase=at===this.route.stops.length-1?'finished':at>=0?'atStop':'ready';s.complete=s.phase==='finished';if(['one','watch'].includes(mode)&&at>=0)this.setDoors(true);}
 setDoors(open){const s=this.state;if(s.speed>.12)return false;const opening=!!open;if(s.doors===opening)return true;if(!opening&&!this.dwellReady)return false;s.doors=opening;s.dwell=0;this.rig.setDoor('both',s.doors?1:0);this.onDoors?.(opening);if(s.doors){s.power=0;if(s.currentStop>=0){s.openedHere=true;s.served[s.currentStop]=true;}}return true;}
 toggleDoors(){return this.setDoors(!this.state.doors);}
 go(){const s=this.state;if(s.paused||!this.dwellReady||this.mode==='manual'||!['ready','atStop','finished'].includes(s.phase))return false;if(this.mode==='doors'&&(s.doors||this.rig.doors.front>.001||this.rig.doors.rear>.001))return false;if(this.mode==='doors'&&s.currentStop>=0&&!s.openedHere)return false;if(s.phase==='finished'){this.restart();return this.go();}this.setDoors(false);s.dwell=0;s.phase='closing';return true;}
 get canGo(){const s=this.state;return !s.paused&&this.dwellReady&&['ready','atStop','finished'].includes(s.phase)&&(['one','watch'].includes(this.mode)||(!s.doors&&this.rig.doors.front<.001&&this.rig.doors.rear<.001&&(s.currentStop<0||s.openedHere)));}
 step(dt,manualCommand=0){
   if(this.state.paused)return;
   dt=Math.min(.1,Math.max(0,dt));const previous=this.state.speed,previousZ=this.state.z;
   this.advance(dt,manualCommand);
   // A departure is the first real forward travel from rest, including manual
   // driving and signal stops. Closing doors, Go and Pause alone never ring.
   if(previous===0&&this.state.speed>0&&this.state.z>previousZ)this.onDepart?.();
   const braking=this.state.speed<.05||(dt>0&&(previous-this.state.speed)/dt>.08)||(this.mode==='manual'&&this.state.command<-.05);
   this.state.braking=braking;this.rig.setBrake?.(braking?1:0,dt);
 }
 advance(dt,manualCommand=0){
   const s=this.state;if(s.paused)return;dt=Math.min(.1,Math.max(0,dt));s.time+=dt;this.syncSignal();s.assist=false;s.trafficHeld=false;this.rig.update(dt,0);
   if(s.doors&&s.currentStop>=0&&this.rig.doors.front>=.98&&this.rig.doors.rear>=.98)s.dwell+=dt;
   if(this.mode==='manual'){this.manualStep(dt,manualCommand);return;}
   if(this.mode==='watch'){
     if(s.phase==='ready')this.go();
     else if(['atStop','finished'].includes(s.phase)){
       if(this.dwellReady)this.go();
     }
   }
   if(s.phase==='closing'&&this.rig.doors.front<.001&&this.rig.doors.rear<.001)s.phase='travelling';
   if(s.phase!=='travelling'){s.speed=0;return;}
   const stop=this.route.stops[s.nextStop],destination=stop?stop.z:this.route.end;
   let target=destination;
   const crossing=this.stopAtLights&&this.route.crossings.find(c=>c.z-20>=s.z-.02);
   if(s.signal!=='green'&&crossing&&crossing.z-20<target){target=crossing.z-20;s.assist=true;}
   const traffic=this.trafficAhead?.();
   if(traffic&&traffic.z<target){target=Math.max(s.z,traffic.z);s.trafficHeld=true;s.assist=true;}
   const distance=Math.max(0,target-s.z),desired=Math.min(this.cruise,Math.sqrt(2*.9*distance)),previous=s.speed;
   s.speed=Math.max(0,s.speed+Math.max(-1.05*dt,Math.min(.70*dt,desired-s.speed)));
   let move=Math.min(distance,(previous+s.speed)*.5*dt);
   // Finish the remaining braking travel without snapping the last centimetres.
   // Commit the final pose before a door-opening callback can observe arrival.
   const arrived=move>=distance;
   if(arrived){move=distance;s.speed=0;}
   s.z+=move;s.metres+=move;this.rig.setDistance(s.metres);
   if(arrived&&target===destination)this.arrive();
   s.command=s.assist?-1:s.speed<desired?1:0;
 }
 arrive(){const s=this.state;s.dwell=0;if(s.nextStop<this.route.stops.length){s.currentStop=s.nextStop;s.nextStop=this.nextScheduledStop(s.nextStop+1);s.openedHere=false;s.phase=s.nextStop===this.route.stops.length?'finished':'atStop';s.complete=s.phase==='finished';if(['one','watch'].includes(this.mode))this.setDoors(true);}else{s.phase='finished';s.complete=true;this.setDoors(['one','watch'].includes(this.mode));}}
 snapshot(){return {version:1,mode:this.mode,state:{...this.state,served:[...this.state.served]}};}
 restore(snapshot){
   const s=snapshot?.state;if(snapshot?.version!==1||snapshot.mode!==this.mode||!s||!['ready','closing','travelling','atStop','finished','manual'].includes(s.phase))return false;
   if(!Number.isFinite(s.z)||s.z<this.route.start||s.z>this.route.end||!Number.isFinite(s.speed)||s.speed<0||s.speed>40/3.6||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.metres)||s.metres<0||!Number.isFinite(s.dwell)||s.dwell<0)return false;
   if(!Number.isInteger(s.currentStop)||s.currentStop< -1||s.currentStop>=this.route.stops.length||!Number.isInteger(s.nextStop)||s.nextStop<0||s.nextStop>this.route.stops.length||!Array.isArray(s.served)||s.served.length!==this.route.stops.length||s.doors&&s.speed>.12)return false;
   for(const key of ['z','speed','metres','time','dwell','currentStop','nextStop','phase'])this.state[key]=s[key];
   for(const key of ['paused','doors','openedHere','complete','braking'])this.state[key]=!!s[key];
   this.state.served=s.served.map(Boolean);this.state.power=0;this.rig.setDistance(s.metres);this.rig.setDoor('both',s.doors?1:0,true);this.rig.setBrake?.(s.braking?1:0);this.syncSignal();return true;
 }
 manualStep(dt,command){
   const s=this.state;if(s.doors||this.rig.doors.front>.001||this.rig.doors.rear>.001)command=-2;
   const crossing=this.route.crossings.find(c=>c.z-20>=s.z-.02),line=crossing?crossing.z-20:Infinity;
   if(this.stopAtLights&&s.signal!=='green'&&line-s.z<s.speed*s.speed/3.6+6){command=Math.min(command,-1);s.assist=true;}
   const traffic=this.trafficAhead?.(),trafficLine=traffic?Math.max(s.z,traffic.z):Infinity;
   if(trafficLine-s.z<s.speed*s.speed/3.6+4){command=Math.min(command,-1);s.assist=true;s.trafficHeld=true;}
   s.speed=Math.max(0,Math.min(40/3.6,s.speed+((command>0?command*.87:command*1.85)-(s.speed>0?.035:0))*dt));let move=s.speed*dt;
   if(this.stopAtLights&&s.signal!=='green'&&s.z<=line&&s.z+move>=line){move=Math.max(0,line-s.z);s.speed=0;}
   if(s.z+move>=trafficLine){move=Math.max(0,trafficLine-s.z);s.speed=0;}
   if(s.z+move>=this.route.end){move=Math.max(0,this.route.end-s.z);s.speed=0;s.complete=true;s.power=0;}
   s.z+=move;s.metres+=move;this.rig.setDistance(s.metres);s.command=command;
   const at=this.route.stops.findIndex(stop=>Math.abs(stop.z-s.z)<6);s.currentStop=at;
   if(at>=0&&s.speed<.12&&this.rig.doors.front>.98&&this.rig.doors.rear>.98){if(s.dwell>=2)s.served[at]=true;}else s.dwell=0;
 }
}
