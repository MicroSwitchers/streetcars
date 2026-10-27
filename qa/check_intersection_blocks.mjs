import assert from 'node:assert/strict';
import {intersectionInfill} from '../dist/intersection-blocks.js';

const crossings=[{z:-100,name:'A'},{z:100,name:'B'}];
const plots=[{side:1,z:-145,width:25},{side:1,z:-54,width:20},{side:1,minZ:111,maxZ:137},{side:-1,minZ:-164,maxZ:-111}];
for(const side of [-1,1]){
 const blocks=intersectionInfill(crossings,plots,{side});
 assert.deepEqual(blocks,intersectionInfill(crossings,plots,{side}));
 assert.ok(blocks.length);
 for(const b of blocks){
  assert.ok(b.width>0&&b.width<=10.2&&b.maxZ>b.minZ);
  assert.ok(crossings.every(c=>b.minZ>=c.z+11.1-.001||b.maxZ<=c.z-11.1+.001),'Road and corner clearance must stay open');
  assert.ok(plots.filter(p=>p.side===side).every(p=>b.minZ>=(p.maxZ??p.z+p.width/2)||b.maxZ<=(p.minZ??p.z-p.width/2)),'Existing buildings and protected open plots must stay intact');
  assert.ok(blocks.every(a=>a===b||a.maxZ<=b.minZ||a.minZ>=b.maxZ),'Generated shells must not overlap');
 }
 for(const cross of crossings)for(const end of [-1,1]){
  let gap=0;
  for(let d=11.11;d<64;d+=.1){
   const z=cross.z+end*d;
   const covered=plots.filter(p=>p.side===side).some(p=>z>(p.minZ??p.z-p.width/2)-.04&&z<(p.maxZ??p.z+p.width/2)+.04)||blocks.some(b=>z>b.minZ-.04&&z<b.maxZ+.04);
   gap=covered?0:gap+.1;assert.ok(gap<3.5,'No oversized empty lot may remain next to a crossing');
  }
 }
}
console.log('PASS: Intersection shells close large gaps without overlapping roads, existing buildings, parks or each other.');
