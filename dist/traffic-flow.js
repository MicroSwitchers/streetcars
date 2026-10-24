// Straight urban lanes, in metres. Process leaders first so each follower sees
// the space its leader has actually cleared, including while a queue releases.
export const TRAFFIC_BOUNDS={min:-318,max:478};
export const STREETCAR_LENGTH=15.6,MINIMUM_GAP=2.5;
export function trafficLeader(actors,blockers,direction,z,length,exclude){
 let leader=null,nearest=Infinity;
 for(const other of [...actors,...blockers]){
   if((exclude!==undefined&&other.id===exclude)||other.active===false||(!other.moving&&other.type!=='streetcar')||other.direction!==direction)continue;
   const distance=direction*(other.z-z);
   if(distance<=0||distance>=nearest)continue;
   nearest=distance;leader=other;
 }
 if(!leader)return null;
 return {z:leader.z-direction*((length+leader.length)/2+MINIMUM_GAP),speed:leader.doorsOpen?0:leader.speed,leader};
}
export function separateFromStreetcars(actors,blockers){
 for(const direction of [-1,1]){
   const occupied=blockers.filter(b=>b.active!==false&&b.direction===direction).map(b=>({z:b.z,length:b.length}));
   for(const car of actors.filter(a=>a.moving&&a.direction===direction).sort((a,b)=>direction*(b.z-a.z))){
     let moved=false;
     for(let attempt=0;attempt<actors.length+blockers.length;attempt++){
       const hit=occupied.find(b=>Math.abs(car.z-b.z)<(car.length+b.length)/2+MINIMUM_GAP);
       if(!hit)break;
       car.z=hit.z-direction*((car.length+hit.length)/2+MINIMUM_GAP+.05);moved=true;
     }
     if(moved){car.speed=0;car.braking=1;}
     occupied.push(car);
   }
 }
}
export function advanceTraffic(actors,crossings,time,dt,alwaysGreen=false,blockers=[]){
 dt=Math.max(0,Math.min(.1,dt));if(!dt)return;
 const moving=actors.filter(a=>a.moving),red=!alwaysGreen&&time%42>=23;
 for(const direction of [-1,1]){
   const lane=[...moving.filter(a=>a.direction===direction),...blockers.filter(a=>a.active!==false&&a.direction===direction)].sort((a,b)=>direction*(b.z-a.z));
   let leader=null;
   for(const actor of lane){
     if(actor.type==='streetcar'){leader={...actor,speed:actor.doorsOpen?0:actor.speed};continue;}
     const previous=actor.speed;
     let room=Infinity,signalRoom=Infinity,desired=actor.cruise;
     if(red){
       for(const crossing of crossings){
         const distance=direction*(crossing.z-direction*13-actor.z);
         if(distance>=-.01)signalRoom=Math.min(signalRoom,Math.max(0,distance));
       }
       room=signalRoom;desired=Math.min(desired,Math.sqrt(2*1.8*room));
     }
     if(leader){
       const gap=direction*(leader.z-actor.z)-(actor.length+leader.length)/2;
       room=Math.min(room,Math.max(0,gap-2.5));
       const followingGap=2.5+actor.speed*1.1;
       desired=Math.min(desired,Math.max(0,leader.speed+(gap-followingGap)*.65),Math.sqrt(leader.speed**2+2*1.8*Math.max(0,gap-2.5)));
       if(leader.speed<.02&&gap<2.65)desired=0;
     }
     actor.speed=Math.max(0,previous+Math.max(-2*dt,Math.min(actor.acceleration*dt,desired-previous)));
     let travel=Math.min(room,(previous+actor.speed)*.5*dt);
     if(room<.025||travel>=room){travel=room;actor.speed=signalRoom<=room?0:leader?Math.min(actor.speed,leader.speed):0;}
     if(actor.speed<.05&&desired<.015)actor.speed=0;
     actor.z+=direction*travel;actor.distance+=travel;
     const brake=actor.speed<.05||(previous-actor.speed)/dt>.08?1:0;
     actor.braking+=(brake-actor.braking)*(1-Math.exp(-16*dt));
     if(Math.abs(brake-actor.braking)<.001)actor.braking=brake;
     leader=actor;
   }
 }
 // Recycle beyond both ends of the playable route, only into a clear entry gap.
 // Wheel distance excludes the relocation, and no geometry is recreated.
 for(const actor of moving){
   const d=actor.direction;
   if(d*actor.z<=(d===1?TRAFFIC_BOUNDS.max:-TRAFFIC_BOUNDS.min))continue;
   const entry=d===1?TRAFFIC_BOUNDS.min:TRAFFIC_BOUNDS.max;
   const clear=[...moving,...blockers.filter(b=>b.active!==false)].every(other=>other===actor||other.direction!==d||d*(other.z-entry)>(actor.length+other.length)/2+12);
   if(clear){actor.z=entry;actor.speed=Math.min(actor.cruise,4.5);actor.braking=0;actor.respawns=(actor.respawns??0)+1;}
 }
}
