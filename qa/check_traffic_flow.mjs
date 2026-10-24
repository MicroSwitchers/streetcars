import assert from 'node:assert/strict';
import {advanceTraffic,TRAFFIC_BOUNDS} from '../dist/traffic-flow.js';
const crossings=[{z:-100},{z:100},{z:300}];
const car=(direction,z,speed=5)=>({moving:true,direction,z,speed,cruise:5.8,acceleration:.8,length:4.6,braking:0,distance:0,respawns:0});
const fleet=[];
for(const d of [-1,1])for(let i=0;i<12;i++)fleet.push(car(d,TRAFFIC_BOUNDS.min+22+i*(TRAFFIC_BOUNDS.max-TRAFFIC_BOUNDS.min)/12+(d===1?25:0)));
let minGap=Infinity,crossed=0;
for(let tick=0;tick<12000;tick++){
 const time=tick*.05,before=fleet.map(a=>a.z);advanceTraffic(fleet,crossings,time,.05);
 for(const d of [-1,1]){
   const lane=fleet.filter(a=>a.direction===d).sort((a,b)=>d*(b.z-a.z));
   for(let i=1;i<lane.length;i++){
     const gap=d*(lane[i-1].z-lane[i].z)-(lane[i-1].length+lane[i].length)/2;
     minGap=Math.min(minGap,gap);assert.ok(gap>=2.4999,'Cars overlap in a signal queue');
   }
 }
 fleet.forEach((a,i)=>{
   assert.ok(Number.isFinite(a.z+a.speed+a.distance)&&a.speed>=0&&a.braking>=0&&a.braking<=1);
   if(Math.abs(a.z-before[i])>100)return;
   for(const crossing of crossings){
     const line=crossing.z-a.direction*13;
     if(a.direction*(line-before[i])>=0&&a.direction*(a.z-line)>.00001){assert.ok(time%42<23,'Car crossed a red signal');crossed++;}
   }
 });
}
assert.ok(fleet.every(a=>a.respawns>=1),'Every car should circulate beyond the route');assert.ok(crossed>100);
for(const d of [-1,1]){
 const line=100-d*13,queue=[car(d,line-d*1,1),car(d,line-d*9,2),car(d,line-d*18,3)];
 for(let i=0;i<200;i++)advanceTraffic(queue,crossings,30,.05);
 assert.ok(queue.every(a=>a.speed===0&&a.braking>.99),'Queued cars must brake and stop');
 assert.ok(queue.every(a=>d*(a.z-line)<=.00001),'Queue must remain before the red line');
 const stopped=queue.map(a=>a.z);for(let i=0;i<300;i++)advanceTraffic(queue,crossings,0,.05,true);
 assert.ok(queue.every((a,i)=>d*(a.z-stopped[i])>8&&a.speed>2),'Entire queue must depart on green');
}
const saved=JSON.stringify(fleet);advanceTraffic(fleet,crossings,0,0);assert.equal(JSON.stringify(fleet),saved,'Zero time must not advance traffic');
console.log(`PASS: 24 cars, both directions, ten minutes of signals and circulation; minimum bumper gap ${minGap.toFixed(3)} m; ${crossed} legal crossing entries; queues, brakes and zero-time updates.`);
