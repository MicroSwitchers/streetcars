// Fill only unintended gaps. Roads, landmark plots, parks and river corridors
// are supplied as occupied intervals, so their open space remains intentional.
export function intersectionInfill(crossings,plots,{side,min=-440,max=620,reach=96,clearance=11.1}={}){
 const occupied=plots.filter(p=>p.side===side).map(p=>[p.minZ??p.z-p.width/2,p.maxZ??p.z+p.width/2]);
 const result=[];
 for(const cross of crossings)for(const end of [-1,1]){
   let spans=[[Math.max(min,end<0?cross.z-reach:cross.z+clearance),Math.min(max,end<0?cross.z-clearance:cross.z+reach)]];
   for(const [lo,hi] of [...occupied,...crossings.map(c=>[c.z-clearance,c.z+clearance])]){
     spans=spans.flatMap(([a,b])=>hi<=a||lo>=b?[[a,b]]:[[a,Math.min(b,lo)],[Math.max(a,hi),b]].filter(([x,y])=>y-x>.1));
   }
   for(const [a,b] of spans){
     if(b-a<3.4)continue;
     const count=Math.max(1,Math.ceil((b-a)/10.2)),pitch=(b-a)/count;
     for(let i=0;i<count;i++)result.push({side,z:a+(i+.5)*pitch,width:pitch-.06,minZ:a+i*pitch+.03,maxZ:a+(i+1)*pitch-.03,crossing:cross.name,end});
     occupied.push([a,b]);
   }
 }
 return result;
}
