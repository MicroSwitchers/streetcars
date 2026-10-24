export function checkSharedLanes(api,check,w){
 const traffic=api.city.actors,cars=traffic.actors.filter(a=>a.moving&&a.direction===1),z=api.route.stops[0].z;
 api.updateSettings({alwaysGreen:true,mode:'one'});api.restart();api.setPaused(false);
 Object.assign(api.state,{z,speed:0,phase:'atStop',currentStop:0,nextStop:1});api.step(0);api.setPaused(true);api.ride.setDoors(true);
 cars.forEach((a,i)=>Object.assign(a,{z:i<3?z-15-i*14:z+40+(i-3)*24,speed:i<3?2:4,distance:0}));
 traffic.setFocus(z);
 for(let i=0;i<220;i++){api.rig.update(.1,0);traffic.update(0,.1,true);}
 const rearGap=a=>z-a.z-(15.6+a.length)/2;
 check('All moving cars use their shared streetcar lane',traffic.actors.every(a=>!a.moving||a.x===-a.direction*Math.abs(api.route.trackX)));
 check('Both folding doors are physically open',api.rig.doors.front>.99&&api.rig.doors.rear>.99);
 check('Cars stop at least two metres behind an open streetcar',cars.slice(0,3).every(a=>a.speed===0&&rearGap(a)>=2&&a.braking>.99));
 const held=cars.slice(0,3).map(a=>a.z);api.ride.setDoors(false);api.rig.update(.1,0);
 check('Door command closes before the animated doors latch',!api.state.doors&&api.rig.doors.front>.01);
 for(let i=0;i<4;i++)traffic.update(0,.1,true);
 check('Traffic remains stopped during the closing animation',cars.slice(0,3).every((a,i)=>a.z===held[i]&&a.speed===0));
 for(let i=0;i<30;i++)api.rig.update(.1,0);
 for(let i=0;i<15;i++)traffic.update(0,.1,true);
 check('Cars cannot overtake the stationary streetcar after its doors close',cars.slice(0,3).every((a,i)=>a.z===held[i]));
 api.setPaused(false);api.ride.go();let minimum=Infinity;
 for(let i=0;i<220;i++){
   api.step(.05);
   for(const a of cars.slice(0,3)){const gap=api.state.z-a.z-(15.6+a.length)/2;minimum=Math.min(minimum,gap);}
 }
 check('The queue follows a departing streetcar with clear rear spacing',minimum>=2.49&&cars.slice(0,3).every(a=>a.distance>3));
 check('No moving car ever enters the curb-side parking lane',cars.every(a=>a.x===api.route.trackX));
 w.__sharedLaneReport={queuedCars:3,minimumRearClearance:minimum,doorClosingProtected:true,curbPassing:false};
 api.restart();api.setPaused(false);Object.assign(api.state,{z,speed:0,phase:'atStop',currentStop:0,nextStop:1});api.step(0);api.setPaused(true);api.ride.setDoors(true);
 cars.forEach((a,i)=>Object.assign(a,{z:i<3?z-15-i*14:z+40+(i-3)*24,speed:i<3?2:4,distance:0}));
 for(let i=0;i<220;i++){api.rig.update(.1,0);traffic.update(0,.1,true);}traffic.setFocus(z);
}
