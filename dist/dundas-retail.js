import * as THREE from 'three';
import {retailMaterial,shopLighting} from './night-windows.js';

// The same Blender-built merchandise and street furniture as Queen West.
// Every model part has one resident instance buffer. Changing route sections
// changes only its matrices, illumination and active count, never GPU resources.
export function createDundasRetail({group,mats,assets,foliageGeometry}){
 const dummy=new THREE.Object3D(),footprint=new THREE.Box3(),pools=new Map(),materials=new Map();
 const placements=[],rooms=[],reserved=[],maxTriangles=145000,maxRooms=32,maxFurniture=32;
 const stats={objects:0,meshes:0,instances:0,triangles:0,capacityTriangles:0,overflow:0,budgetSkipped:0,rooms:0,furniture:0,plants:0,rebuilds:0,types:{},roomIndices:[]};
 let night=0,triangleLimit=maxTriangles;
 // The tiny matrix buffers accommodate even a section containing only one
 // merchandise type. The rendered count and triangle ceiling remain capped.
 const capacities={bookshelf:64,recordbin:40,bakerycase:40,grocerstand:40,floriststand:40,coffeecounter:40,hardware:40,bicycle:48,pendant:36,bench:32,bins:32,planter:32,hydrant:32,meter:32,table:4,chair:8};
 function makePool(name,geometry,material,capacity,shadow=true){
   const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='Dundas_Retail_'+name;mesh.count=0;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=shadow;mesh.receiveShadow=true;
   // Fixed resident bounds also avoid stale bounds after a later section has
   // different placements. Props exist only beside the occupied central blocks.
   mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-25,0,-235),new THREE.Vector3(25,4,385));
   mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,2,75),313);
   group.add(mesh);stats.objects++;stats.meshes++;
   const triangles=geometry.index?geometry.index.count/3:geometry.attributes.position.count/3;
   stats.capacityTriangles+=triangles*capacity;
   return {mesh,capacity,triangles,count:0,illumination:geometry.getAttribute('instanceIllumination')};
 }
 for(const [kind,capacity] of Object.entries(capacities)){
   const model=assets.models.get(kind);if(!model)continue;
   const parts=[];
   for(let i=0;i<model.parts.length;i++){
     const part=model.parts[i];
     if(!materials.has(part.material)){
       const material=part.material.clone();material.name='DundasRetail_'+part.material.name;
       material.emissive.copy(part.material.name==='Prop_ShopLamp'?new THREE.Color(0xffffff):material.color);
       material.emissiveIntensity=0;material.envMapIntensity=.8;retailMaterial(material);
       mats['dundasRetail'+materials.size]=material;materials.set(part.material,material);
     }
     // Share immutable vertex/index arrays with the existing Queen prop asset;
     // only this small per-instance lighting attribute belongs to our pool.
     const geometry=new THREE.BufferGeometry();geometry.setIndex(part.geometry.index);
     for(const [name,attribute] of Object.entries(part.geometry.attributes))geometry.setAttribute(name,attribute);
     const illumination=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);illumination.setUsage(THREE.DynamicDrawUsage);
     geometry.setAttribute('instanceIllumination',illumination);
     parts.push(makePool(kind+'_'+i,geometry,materials.get(part.material),capacity,['bench','bins','planter','hydrant','meter','table','chair'].includes(kind)));
   }
   pools.set(kind,{model,parts,count:0,capacity});
 }
 const leafGeometry=foliageGeometry,flowerGeometry=new THREE.IcosahedronGeometry(1,0);
 const leafPool=makePool('PlanterFoliage',leafGeometry,mats.leaf2||mats.leaf,96,false);
 const flowerPool=makePool('PlanterFlowers',flowerGeometry,mats.gardenFlower||mats.terracotta,96,false);
 function plantInstance(pool,x,y,z,sx,sy,sz){
   if(pool.count===pool.capacity||stats.triangles+pool.triangles>maxTriangles)return;
   dummy.position.set(x,y,z);dummy.rotation.set(0,z*.37,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
   pool.mesh.setMatrixAt(pool.count++,dummy.matrix);stats.triangles+=pool.triangles;stats.plants++;
 }
 function prop(kind,x,y,z,yaw=0,scale=1,lighting=null,interior=false){
   const p=pools.get(kind);if(!p)return false;
   if(p.count>=p.capacity){stats.overflow++;return false;}
   if(stats.triangles+p.model.triangles>triangleLimit){stats.budgetSkipped++;return false;}
   // Bicycle exports can put the wheel contact below their local origin. Keep
   // the requested floor contact stable without shifting hanging lamp fixtures.
   const anchorY=kind==='bicycle'?y-p.model.bounds.min.y*scale:y;
   dummy.position.set(x,anchorY,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(scale);dummy.updateMatrix();
   footprint.copy(p.model.bounds).applyMatrix4(dummy.matrix);
   const colour=lighting?.color||0,power=lighting?.power||0;
   // sRGB colour is converted by Three before it reaches the linear shader.
   lightColour.setHex(colour).multiplyScalar(power);
   for(const part of p.parts){
     part.mesh.setMatrixAt(p.count,dummy.matrix);part.illumination.setXYZ(p.count,lightColour.r,lightColour.g,lightColour.b);part.count++;
   }
   p.count++;stats.instances++;stats.triangles+=p.model.triangles;stats.types[kind]=(stats.types[kind]||0)+1;
   placements.push({kind,x,y:anchorY,floorY:y,z,yaw,scale,interior,minX:footprint.min.x,maxX:footprint.max.x,minZ:footprint.min.z,maxZ:footprint.max.z});
   return true;
 }
 const lightColour=new THREE.Color();
 const shopTypes={
   west:['coffeecounter','bicycle','hardware','bookshelf','recordbin'],
   portugal:['bakerycase','coffeecounter','grocerstand','floriststand'],
   bellwoods:['floriststand','coffeecounter','bookshelf','bicycle'],
   chinatown:['grocerstand','bakerycase','grocerstand','coffeecounter'],
   culture:['bookshelf','recordbin','coffeecounter','bookshelf'],
   core:['recordbin','coffeecounter','hardware','bookshelf'],
   garden:['floriststand','bookshelf','grocerstand','coffeecounter'],
   regent:['coffeecounter','bookshelf','floriststand','grocerstand'],
   riverside:['grocerstand','bakerycase','coffeecounter','hardware'],
   riverdale:['bookshelf','floriststand','coffeecounter','bicycle'],
   terminal:['coffeecounter','bakerycase','grocerstand','hardware'],
 };
 function interior(frontage){
   const {side,index=0}=frontage,room=frontage.room,z=room.z??frontage.z,width=room.width??frontage.width;
   const district=typeof frontage.district==='string'?frontage.district:frontage.district?.id;
   const choices=shopTypes[district]||shopTypes.west,type=choices[Math.abs(Math.floor(index*.61803398875)+(side>0?1:0))%choices.length],lighting=frontage.lighting||room.lighting||shopLighting(Math.abs(index));
   const front=Math.abs(room.front??frontage.front),back=Math.abs(room.back??(front+2.3));
   const yaw=-side*Math.PI/2,depth=back-front;
   // The front is an actual open recess with thin glazing, so merchandise is
   // entirely behind the glass and remains separated from the rear wall.
   const x=side*(front+Math.min(.75,depth*.40)),offset=width>4.4?-.70:0;
   const firstPlacement=placements.length;
   if(!prop(type,x,.39,z+offset,yaw,type==='bicycle'?.88:1,lighting,true))return;
   prop('pendant',side*(front+depth*.47),2.35,z,yaw,1,lighting,true);
   for(let i=firstPlacement;i<placements.length;i++){placements[i].roomIndex=index;placements[i].district=district;}
   rooms.push({side,z,width,front,back,index,district,type,lighting});stats.rooms++;stats.roomIndices.push(index);
 }
 function rearDisplay(room){
   const {type,width,front,back,index,side,z,lighting,district}=room;
   if(width<=4.7||back-front<=1.75||Math.abs(index)%3===1)return;
   // Fill a few deeper recesses only after every primary window has its own
   // contents. This reserves a predictable budget for sidewalk furnishings.
   const complement={coffeecounter:'bookshelf',bakerycase:'coffeecounter',grocerstand:'grocerstand',floriststand:'floriststand',recordbin:'bookshelf',bookshelf:'bookshelf',hardware:'bicycle',bicycle:'hardware'}[type];
   if(stats.triangles+(pools.get(complement)?.model.triangles||0)>triangleLimit)return;
   if(prop(complement,side*(back-.48),.39,z+Math.min(1.28,width*.27),-side*Math.PI/2,complement==='bicycle'?.77:.78,lighting,true)){
     const p=placements.at(-1);p.roomIndex=index;p.district=district;
   }
 }
 function clear(route,z,radius){
   return route.crossings.every(c=>Math.abs(c.z-z)>16+radius)&&route.stops.every(s=>Math.abs(s.z-z)>8+radius);
 }
 function furniture(route,kind,side,z){
   const p=pools.get(kind);if(!p)return false;
   const yaw=-side*Math.PI/2,x=side*(kind==='bench'?9.55:kind==='planter'?9.65:kind==='bicycle'?9.60:8.82);
   dummy.position.set(x,.18,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();footprint.copy(p.model.bounds).applyMatrix4(dummy.matrix);
   const radius=(footprint.max.z-footprint.min.z)/2+.12,minX=footprint.min.x-.10,maxX=footprint.max.x+.10,minZ=footprint.min.z-.18,maxZ=footprint.max.z+.18;
   if(!clear(route,z,radius)||Math.min(Math.abs(footprint.min.x),Math.abs(footprint.max.x))<8.35||Math.max(Math.abs(footprint.min.x),Math.abs(footprint.max.x))>10.25)return false;
   if(reserved.some(r=>minX<r.maxX&&maxX>r.minX&&minZ<r.maxZ&&maxZ>r.minZ))return false;
   if(!prop(kind,x,.18,z,yaw))return false;
   reserved.push({minX,maxX,minZ,maxZ});stats.furniture++;
   if(kind==='planter'){
     for(const dz of [-.33,0,.33])plantInstance(leafPool,x,.88,z+dz,.29,.31,.26);
     for(const dz of [-.30,.05,.30])plantInstance(flowerPool,x-.08*side,1.11,z+dz,.11,.085,.095);
   }
   return true;
 }
 function finishPool(p){p.mesh.count=p.count;p.mesh.instanceMatrix.needsUpdate=true;if(p.illumination)p.illumination.needsUpdate=true;}
 function setRoute(route,frontages=[]){
   for(const p of pools.values()){p.count=0;for(const part of p.parts)part.count=0;}
   leafPool.count=flowerPool.count=0;placements.length=rooms.length=reserved.length=0;
   for(const key of ['instances','triangles','overflow','budgetSkipped','rooms','furniture','plants'])stats[key]=0;stats.types={};stats.roomIndices.length=0;stats.rebuilds++;
   if(route.id==='dundas'){
     const active=frontages.filter(f=>f.z>=-230&&f.z<=380);
     for(const f of active.filter(f=>f.kind==='tree')){
       const x=f.side*Math.abs(f.front??9.3);
       reserved.push({minX:x-.7,maxX:x+.7,minZ:f.z-1,maxZ:f.z+1});
     }
     // Central shops receive the detailed original assets; far facade silhouettes
     // retain the cheaper pooled geometry. The cap is independent of route size.
     const eligible=active.filter(f=>f.room).sort((a,b)=>Math.abs(a.z-60)-Math.abs(b.z-60)).slice(0,maxRooms);
     triangleLimit=105000;
     for(const f of eligible)interior(f);
     for(const room of rooms)rearDisplay(room);
     triangleLimit=maxTriangles;
     const kinds=['bench','planter','bins','hydrant','bench','meter','planter','bicycle'];
     const street=active.filter(f=>f.kind!=='tree').sort((a,b)=>a.z-b.z||a.side-b.side);
     const stride=Math.max(1,Math.ceil(street.length/maxFurniture));
     // Spread the fixed furniture allowance along the whole resident section,
     // including the later stops, before filling any gaps left by clearances.
     const distributed=[];for(let phase=0;phase<stride;phase++)for(let j=phase;j<street.length;j+=stride)distributed.push(street[j]);
     for(const f of distributed){
       if(stats.furniture>=maxFurniture)break;
       const i=Math.abs(f.index||0),kind=kinds[(Math.floor(i*.61803398875)+(f.side>0?3:0))%kinds.length];
       // Open the continuous pedestrian path between the curb fixtures and the
       // shopfront. Furniture never enters a crossing or a boarding zone.
       for(const dz of [0,-3.2,3.2])if(furniture(route,kind,f.side,f.z+dz))break;
     }
   }
   for(const p of pools.values())for(const part of p.parts)finishPool(part);finishPool(leafPool);finishPool(flowerPool);
   setNight(night);
 }
 function setNight(value){
   night=THREE.MathUtils.clamp(value,0,1);
   for(const [source,material] of materials)material.emissiveIntensity=night*(source.name==='Prop_ShopLamp'?3.0:.22);
 }
 return {setRoute,setNight,stats,placements,rooms,pools};
}
