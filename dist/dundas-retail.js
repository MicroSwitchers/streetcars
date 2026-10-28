import * as THREE from 'three';
import {retailMaterial,shopLighting} from './night-windows.js';

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

export function dundasShopType(district,index,side){
 const choices=shopTypes[district]||shopTypes.west;return choices[Math.abs(Math.floor(index*.61803398875)+(side>0?1:0))%choices.length];
}

// The same Blender-built merchandise and street furniture as Queen West.
// Every model part has one resident instance buffer. Changing route sections
// changes only its matrices, illumination and active count, never GPU resources.
export function createDundasRetail({group,mats,assets,foliageGeometry}){
 const dummy=new THREE.Object3D(),footprint=new THREE.Box3(),pools=new Map(),materials=new Map();
 const placements=[],rooms=[],fixtures=[],reserved=[],maxTriangles=190000,maxRooms=48,maxFurniture=32;
 const stats={objects:0,meshes:0,instances:0,triangles:0,capacityTriangles:0,overflow:0,budgetSkipped:0,rooms:0,furniture:0,plants:0,fixtureInstances:0,fixtureTriangles:0,fixtureRooms:0,windowGardens:0,roofDetails:0,shopfrontDetails:0,dressingTriangles:0,rebuilds:0,types:{},roomIndices:[]};
 let night=0,triangleLimit=maxTriangles;
 // The tiny matrix buffers accommodate even a section containing only one
 // merchandise type. The rendered count and triangle ceiling remain capped.
 const capacities={bookshelf:64,recordbin:40,bakerycase:64,grocerstand:64,floriststand:64,coffeecounter:64,hardware:40,bicycle:48,pendant:56,bench:32,bins:32,planter:32,timberplanter:32,stoneplanter:32,wallplanter:32,trellis:16,walllantern:32,parkedbike:16,hydrant:32,meter:32,table:4,chair:8,aboard:8,crate:8,hvac:6,aircon:8,utilitycabinet:8,newsbox:8,bikestand:16,treegrate:24,stormdrain:64};
 function makePool(name,geometry,material,capacity,shadow=true){
   const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='Dundas_Retail_'+name;mesh.count=0;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=shadow;mesh.receiveShadow=true;
   // Fixed resident bounds also avoid stale bounds after a later section has
   // different placements. Props exist only beside the occupied central blocks.
   mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-125,0,-235),new THREE.Vector3(125,85,385));
   mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,40,75),345);
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
     parts.push(makePool(kind+'_'+i,geometry,materials.get(part.material),capacity,['bench','bins','planter','hydrant','meter','table','chair','utilitycabinet','newsbox','bikestand'].includes(kind)));
   }
   pools.set(kind,{model,parts,count:0,capacity});
 }
 const leafGeometry=foliageGeometry,flowerGeometry=new THREE.IcosahedronGeometry(1,0);
 const leafPool=makePool('PlanterFoliage',leafGeometry,mats.leaf2||mats.leaf,180,false);
 const flowerPool=makePool('PlanterFlowers',flowerGeometry,mats.gardenFlower||mats.terracotta,144,false);
 // Small physical wall dressings use three shared primitive buffers. They are
 // independent of the original Blender counters and keep deep shop recesses
 // from reading as empty white rooms. Instance colours retain varied products.
 const fixtureMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.77,metalness:.035});
 fixtureMaterial.name='DundasRetail_BackFixtures';fixtureMaterial.emissive.setHex(0xffffff);fixtureMaterial.emissiveIntensity=0;
 retailMaterial(fixtureMaterial);mats.dundasRetailBackFixtures=fixtureMaterial;
 const fixturePools={};
 for(const [kind,geometry,capacity] of [
   ['shelf',new THREE.BoxGeometry(1,1,1),1800],
   ['vessel',new THREE.CylinderGeometry(1,1,1,10,1,false),420],
   ['loaf',new THREE.IcosahedronGeometry(1,0),380],
 ]){
   geometry.computeBoundingBox();
   const illumination=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);illumination.setUsage(THREE.DynamicDrawUsage);
   geometry.setAttribute('instanceIllumination',illumination);
   const p=makePool('BackFixture_'+kind,geometry,fixtureMaterial,capacity,false);
   p.mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);p.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
   fixturePools[kind]=p;
 }
 const fixtureColour=new THREE.Color(),fixtureGlow=new THREE.Color();
 function fixture(kind,room,x,y,z,sx,sy,sz,colour,rotation=0){
   const p=fixturePools[kind];
   if(p.count===p.capacity||(room.exterior?stats.dressingTriangles+p.triangles>5000:stats.fixtureTriangles+p.triangles>12000)||stats.triangles+p.triangles>triangleLimit)return false;
   dummy.position.set(x,y,z);dummy.rotation.set(0,0,rotation);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
   p.mesh.setMatrixAt(p.count,dummy.matrix);fixtureColour.setHex(colour);p.mesh.setColorAt(p.count,fixtureColour);
   fixtureGlow.setHex(room.lighting.color).multiply(fixtureColour).multiplyScalar(room.lighting.power);
   p.illumination.setXYZ(p.count,fixtureGlow.r,fixtureGlow.g,fixtureGlow.b);p.count++;
   footprint.copy(p.mesh.geometry.boundingBox).applyMatrix4(dummy.matrix);
   fixtures.push({kind,type:room.type,roomIndex:room.index,side:room.side,exterior:!!room.exterior,x,y,z,minX:footprint.min.x,maxX:footprint.max.x,minY:footprint.min.y,maxY:footprint.max.y,minZ:footprint.min.z,maxZ:footprint.max.z});
   stats.fixtureInstances++;if(room.exterior)stats.dressingTriangles+=p.triangles;else stats.fixtureTriangles+=p.triangles;stats.triangles+=p.triangles;return true;
 }
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
   placements.push({kind,x,y:anchorY,floorY:y,z,yaw,scale,interior,rack:kind==='parkedbike',minX:footprint.min.x,maxX:footprint.max.x,minZ:footprint.min.z,maxZ:footprint.max.z});
   return true;
 }
 const lightColour=new THREE.Color();
 function interior(frontage){
   const {side,index=0}=frontage,room=frontage.room,z=room.z??frontage.z,width=room.width??frontage.width;
   const district=typeof frontage.district==='string'?frontage.district:frontage.district?.id;
   const type=dundasShopType(district,index,side),lighting=frontage.lighting||room.lighting||shopLighting(Math.abs(index));
   const front=Math.abs(room.front??frontage.front),back=Math.abs(room.back??(front+2.3));
   const yaw=-side*Math.PI/2,depth=back-front;
   // The front is an actual open recess with thin glazing, so merchandise is
   // entirely behind the glass and remains separated from the rear wall.
   const x=side*(front+Math.min(.75,depth*.40)),offset=width>4.4?-.70:0;
   const firstPlacement=placements.length;
   const hero=prop(type,x,.39,z+offset,yaw,type==='bicycle'?.88:1,lighting,true);
   if(hero)prop('pendant',side*(front+depth*.47),2.35,z,yaw,1,lighting,true);
   for(let i=firstPlacement;i<placements.length;i++){placements[i].roomIndex=index;placements[i].district=district;}
   // Every real recess gets stocked shelves, even if its high-detail counter
   // cannot fit the budget. This avoids blank shop windows late in a section.
   rooms.push({side,z,width,front,back,index,district,type,lighting,hero});stats.rooms++;stats.roomIndices.push(index);
 }
 function rearDisplay(room){
   const {type,width,front,back,index,side,z,lighting,district}=room;
   if(room.backFixtures||width<=4.7||back-front<=1.75||Math.abs(index)%3===1)return;
   // Fill a few deeper recesses only after every primary window has its own
   // contents. This reserves a predictable budget for sidewalk furnishings.
   const complement=type;
   if(stats.triangles+(pools.get(complement)?.model.triangles||0)>triangleLimit)return;
   if(prop(complement,side*(back-.48),.39,z+Math.min(1.28,width*.27),-side*Math.PI/2,complement==='bicycle'?.77:.78,lighting,true)){
     const p=placements.at(-1);p.roomIndex=index;p.district=district;
   }
 }
 function backShelves(room){
   const {side,back,z,width}=room,span=Math.min(3.5,Math.max(1.25,width*.77)),x=side*(back-.25);
   room.fixtureSpan=span;
   // The two shelves and paired vertical brackets have real thickness and meet
   // the rear wall. Their contents remain above the counter, fully in view.
   const first=stats.fixtureInstances;
   for(const y of [1.40,2.08])fixture('shelf',room,x,y,z,.38,.055,span,0x816548);
   for(const end of [-1,1])fixture('shelf',room,side*(back-.085),1.83,z+end*span*.44,.055,1.12,.055,0x49534e);
   room.backFixtures=stats.fixtureInstances>first;
   if(room.backFixtures)stats.fixtureRooms++;
 }
 function backContents(room,rowOnly){
   if(!room.backFixtures)return;
   const {side,back,z,type,index}=room,span=room.fixtureSpan,x=side*(back-.29),tints=[0xc8b68c,0x648b8a,0xb77958,0xe2d7bb,0x7c5349,0x596b56];
   const box=(y,zz,w,h,d,colour)=>fixture('shelf',room,x,y,zz,d,h,w,colour);
   for(let row=0;row<2;row++){
     if(row!==rowOnly)continue;
     const floor=1.428+row*.68;
     if(type==='coffeecounter'){
       // Ceramic mugs and tall tea/coffee canisters fill the back-bar shelving.
       for(let j=0;j<2;j++){
         const zz=z+(j-.5)*span*.42,tint=tints[(j+row+Math.abs(index))%tints.length];
         fixture('vessel',room,x,floor+.115,zz,.080,.23,.080,tint);
         // A dark inset top reads as a mug opening without an expensive handle.
         fixture('loaf',room,x,floor+.234,zz,.062,.004,.062,0x594631);
       }
       for(const end of [-1,1])box(floor+.15,z+end*span*.45,.13,.30,.14,0xc5b489);
     }else if(type==='bakerycase'){
       for(let j=0;j<3;j++){
         const zz=z+(j-1)*span*.30;
         box(floor+.012,zz,.31,.024,.25,0xc0b89d);
         fixture('loaf',room,x,floor+.095,zz,.12,.080,.14,j%2?0xbb864d:0xd8ac67);
       }
     }else if(type==='bookshelf'||type==='recordbin'){
       const count=type==='bookshelf'?8:3;
       for(let j=0;j<count;j++){
         const zz=z+(j-(count-1)/2)*span/(count+.7),height=(type==='bookshelf'?.23:.29)+((j+row)%3)*.045;
         box(floor+height/2,zz,type==='bookshelf'?.065:.21,height,type==='bookshelf'?.20:.075,tints[(j+row+Math.abs(index))%tints.length]);
         if(type==='recordbin')fixture('vessel',room,side*(back-.338),floor+height*.55,zz,.075,.018,.075,0x252c29,Math.PI/2);
       }
     }else if(type==='grocerstand'){
       for(let j=0;j<3;j++){
         const zz=z+(j-1)*span*.30;box(floor+.045,zz,.35,.09,.26,0x8e7351);
         fixture('loaf',room,x,floor+.125,zz,.10,.07,.13,(j+row)%2?0x919d51:0xc78547);
       }
     }else if(type==='floriststand'){
       for(let j=0;j<2;j++){
         const zz=z+(j-.5)*span*.44;fixture('vessel',room,x,floor+.10,zz,.095,.20,.095,j%2?0xad8262:0x728c88);
         fixture('loaf',room,x,floor+.26,zz,.16,.18,.14,0x788c56);
         fixture('loaf',room,side*(back-.39),floor+.34,zz+.04,.075,.075,.07,j%2?0xc39980:0xb4ad8c);
       }
     }else{
       // Hardware and bicycle workshops have small parts boxes and hung tools,
       // rather than an unrelated bookshelf copied across every shop type.
       for(let j=0;j<5;j++){
         const zz=z+(j-2)*span*.18;
         if(row===0)box(floor+.085,zz,.25,.17,.24,tints[(j+Math.abs(index))%tints.length]);
         else{
           box(floor+.15,zz,.025,.30,.045,0x6e7974);
           box(floor+.285,zz,.12,.04,.065,j%2?0xaa7960:0x9ba39b);
         }
       }
     }
   }
 }
 function clear(route,z,radius){
   return route.crossings.every(c=>Math.abs(c.z-z)>16+radius)&&route.stops.every(s=>Math.abs(s.z-z)>8+radius);
 }
 function furniture(route,kind,side,z){
   const p=pools.get(kind);if(!p)return false;
   const planted=['planter','timberplanter','stoneplanter'].includes(kind),yaw=-side*Math.PI/2,x=side*(kind==='bench'?9.55:planted?9.65:kind==='parkedbike'?9.60:8.82);
   dummy.position.set(x,.18,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();footprint.copy(p.model.bounds).applyMatrix4(dummy.matrix);
   const radius=(footprint.max.z-footprint.min.z)/2+.12,minX=footprint.min.x-.10,maxX=footprint.max.x+.10,minZ=footprint.min.z-.18,maxZ=footprint.max.z+.18;
   if(!clear(route,z,radius)||Math.min(Math.abs(footprint.min.x),Math.abs(footprint.max.x))<8.35||Math.max(Math.abs(footprint.min.x),Math.abs(footprint.max.x))>10.25)return false;
   if(reserved.some(r=>minX<r.maxX&&maxX>r.minX&&minZ<r.maxZ&&maxZ>r.minZ))return false;
   if(!prop(kind,x,.18,z,yaw))return false;
   reserved.push({minX,maxX,minZ,maxZ});stats.furniture++;
   if(planted)plantContents(kind,x,.18,z,yaw);
   return true;
 }
 function plantContents(kind,x,y,z,yaw=0){
   const top=kind==='timberplanter'?.52:kind==='wallplanter'?.28:.75,span=kind==='stoneplanter'?.25:.43;
   for(const u of [-span,0,span]){const px=x+Math.cos(yaw)*u,pz=z-Math.sin(yaw)*u;plantInstance(leafPool,px,y+top+.16,pz,.25,.25,.26);plantInstance(flowerPool,px,y+top+.35,pz,.085,.07,.085);}
 }
 function sidePlanting(arms){
   for(const [i,arm] of arms.entries()){
     const b=arm.buildings[0];if(!b)continue;
     const x=b.x-arm.side*(b.width/2-.95),z=b.front-arm.end*.65,yaw=arm.end===1?Math.PI:0,kind=i%2?'stoneplanter':'timberplanter';
     if(prop(kind,x,.18,z,yaw)){placements.at(-1).sideStreet=true;plantContents(kind,x,.18,z,yaw);}
   }
   for(const [i,arm] of arms.entries()){
     const b=arm.buildings[0];if(!b)continue;const yaw=arm.end===1?Math.PI:0;
     const x=b.x-arm.side*(b.width/2-.95),z=b.front-arm.end*.15;
     if(i%2===0&&prop('trellis',x,.65,z,yaw)){placements.at(-1).sideStreet=true;for(const y of [1.25,1.85,2.25])plantInstance(leafPool,x,y,z-arm.end*.18,.22,.29,.24);}
     if(prop('walllantern',b.x+(b.shop?5.9:-4.8),2.85,z,yaw,1,{color:0xffcf98,power:.45}))placements.at(-1).sideStreet=true;
   }
 }
 function finishPool(p){p.mesh.count=p.count;p.mesh.instanceMatrix.needsUpdate=true;if(p.mesh.instanceColor)p.mesh.instanceColor.needsUpdate=true;if(p.illumination)p.illumination.needsUpdate=true;}
 function storefrontDressing(route,frontages){
   const ordered=frontages.filter(f=>['shop','house','loft','modern'].includes(f.kind)).sort((a,b)=>Math.abs(a.z+80)-Math.abs(b.z+80));
   const spent=stats.triangles,ground=(kind,f,z,x=Math.min(f.front-.65,10.35),yaw=-f.side*Math.PI/2)=>{
     const p=pools.get(kind);if(!p||stats.triangles+p.model.triangles>spent+22000)return false;
     dummy.position.set(f.side*x,.18,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(1);dummy.updateMatrix();footprint.copy(p.model.bounds).applyMatrix4(dummy.matrix);
     const b={minX:footprint.min.x-.10,maxX:footprint.max.x+.10,minZ:footprint.min.z-.12,maxZ:footprint.max.z+.12};
     const radius=(b.maxZ-b.minZ)/2,door=f.doorZ??f.z+f.width*(f.kind==='house'?-.27:f.kind==='modern'?.24:f.kind==='loft'?.36:.34);
     if(!clear(route,z,radius)||Math.abs(z-door)<radius+.65||Math.min(Math.abs(b.minX),Math.abs(b.maxX))<9.7||Math.max(Math.abs(b.minX),Math.abs(b.maxX))>f.front-.25)return false;
     if(reserved.some(r=>b.minX<r.maxX&&b.maxX>r.minX&&b.minZ<r.maxZ&&b.maxZ>r.minZ))return false;
     if(!prop(kind,f.side*x,.18,z,yaw))return false;Object.assign(placements.at(-1),{shopfront:true,frontageIndex:f.index,side:f.side});reserved.push(b);stats.shopfrontDetails++;return true;
   };
   for(const f of ordered){
     const ordinal=Math.abs(f.index||0),w=f.windows?.find(w=>w.y>4.2&&w.y<7.5&&!w.feature);
     if(w&&ordinal%2===0&&stats.windowGardens<24){
       const room={type:'windowGarden',index:f.index,side:f.side,exterior:true,lighting:{color:0,power:0}},x=f.side*(f.front-.20),y=w.y-w.height/2-.12,z=w.z,span=Math.min(1.32,w.width+.14);
       if(prop('wallplanter',x,y-.12,z,-f.side*Math.PI/2,Math.min(1,span/1.38))){
         Object.assign(placements.at(-1),{facade:true,frontageIndex:f.index,side:f.side});
         for(const dz of [-.30,.30]){plantInstance(leafPool,x,y+.25,z+dz,.23,.22,.27);plantInstance(flowerPool,x-f.side*.04,y+.43,z+dz,.10,.075,.10);}
         stats.windowGardens++;
       }
     }
     if(ordinal%9===0&&f.kind!=='house'&&(stats.types.walllantern||0)<24){if(prop('walllantern',f.side*(f.front-.16),3.24,f.z-f.width/2+.25,-f.side*Math.PI/2,1,{color:0xffcf98,power:.45}))placements.at(-1).facade=true;}
     if(f.kind==='house')continue;
     const type=dundasShopType(f.district,ordinal,f.side),displayZ=f.room?.z??f.z-f.width*.12;
     if(stats.shopfrontDetails<10&&ordinal%3===1){
       const crate=type==='grocerstand'||type==='floriststand';
       if(ground(crate?'crate':'aboard',f,displayZ)&&crate){
         const room={type,index:f.index,side:f.side,exterior:true,lighting:{color:0,power:0}},p=placements.at(-1);
         for(let j=0;j<5;j++)fixture('loaf',room,p.x+(j%2-.5)*.17,.53+(j%2)*.025,p.z+(j-2)*.095,.075,.075,.075,type==='floriststand'?0x9d8baf:j%2?0xa5a257:0xc88a51);
       }
     }
     if(type==='coffeecounter'&&(stats.types.table||0)<3){
       const z=displayZ-f.width*.12;
       if(ground('table',f,z,10.35,0)){
         for(const end of [-1,1])ground('chair',f,z+end*.90,10.35,end===1?Math.PI:0);
         const room={type,index:f.index,side:f.side,exterior:true,lighting:{color:0,power:0}};
         fixture('vessel',room,f.side*10.35,1.025,z,.055,.13,.055,0xd2c6a7);
       }
     }
     if(!f.authored&&ordinal%7===1&&ordinal%3!==0&&(stats.types.aircon||0)<4&&w&&stats.triangles+1052<spent+22000){
       if(prop('aircon',f.side*(f.front-.16),w.y-w.height/2-.70,w.z,-f.side*Math.PI/2)){Object.assign(placements.at(-1),{facade:true,frontageIndex:f.index,side:f.side});stats.roofDetails++;}
     }
     if(!f.authored&&ordinal%8===2&&(stats.types.hvac||0)<3&&stats.triangles+2768<spent+22000){
       if(prop('hvac',f.side*(f.front+f.depth*.45),f.height+.30,f.z)){Object.assign(placements.at(-1),{roof:true,frontageIndex:f.index,side:f.side});stats.roofDetails++;}
     }
   }
 }
 function setRoute(route,frontages=[],sideStreets=[],budget=maxTriangles){
   for(const p of pools.values()){p.count=0;for(const part of p.parts)part.count=0;}
   leafPool.count=flowerPool.count=0;for(const p of Object.values(fixturePools))p.count=0;placements.length=rooms.length=fixtures.length=reserved.length=0;
   for(const key of ['instances','triangles','overflow','budgetSkipped','rooms','furniture','plants','fixtureInstances','fixtureTriangles','fixtureRooms','windowGardens','roofDetails','shopfrontDetails','dressingTriangles'])stats[key]=0;stats.types={};stats.roomIndices.length=0;stats.rebuilds++;
   if(route.id==='dundas'){
     const active=frontages.filter(f=>f.z>=-230&&f.z<=380);
     for(const f of active.filter(f=>f.kind==='tree')){
       const x=f.side*Math.abs(f.front??9.3);
       reserved.push({minX:x-.7,maxX:x+.7,minZ:f.z-1,maxZ:f.z+1});
     }
     // Central shops receive the detailed original assets; far facade silhouettes
     // retain the cheaper pooled geometry. The cap is independent of route size.
     const eligible=active.filter(f=>f.room).sort((a,b)=>Math.abs(a.z+90)-Math.abs(b.z+90)).slice(0,maxRooms);
     triangleLimit=96000;
     for(const f of eligible)interior(f);
     triangleLimit=132000;
     for(const room of rooms)backShelves(room);
     // Fill one shelf in every room before spending the remaining budget on
     // upper shelves, so later stops retain dressed windows as well.
     for(let row=0;row<2;row++)for(const room of rooms)backContents(room,row);
     for(const room of rooms)rearDisplay(room);
     triangleLimit=Math.min(maxTriangles,Math.max(150000,budget));
     // Protect the side streets' essential furniture before optional window
     // gardens or rooftop equipment spend the rest of the dressing allowance.
     const sideBudget=stats.triangles+9000;
     for(const [i,arm] of sideStreets.entries()){
       const f=arm.furniture[i%arm.furniture.length],p=pools.get(f?.kind);
       if(!p||stats.triangles+p.model.triangles>sideBudget)continue;
       if(prop(f.kind,f.x,.18,f.z,f.yaw)){placements.at(-1).sideStreet=true;stats.furniture++;}
     }
     const plantedFronts=active.filter(f=>!['tree','valley'].includes(f.kind)),plantStride=Math.max(1,Math.ceil(plantedFronts.length/8));
     for(let j=0;j<plantedFronts.length;j+=plantStride){const f=plantedFronts[j],kind=['core','regent','culture'].includes(f.district)?'stoneplanter':j%2?'stoneplanter':'timberplanter',z=f.z+f.width*(f.kind==='house'?.24:-.22);for(const dz of [0,-3,3])if(furniture(route,kind,f.side,z+dz))break;}
     let supportedBikes=0;for(const f of [...plantedFronts].sort((a,b)=>Math.abs(a.z+100)-Math.abs(b.z+100))){if(supportedBikes>=2)break;for(const dz of [0,-3.2,3.2])if(furniture(route,'parkedbike',f.side,f.z+dz)){supportedBikes++;break;}}
     storefrontDressing(route,active);
     sidePlanting(sideStreets);
     for(const f of active.filter(f=>f.kind==='tree'))prop('treegrate',f.side*9.3,.18,f.z);
     for(let z=-224;z<380;z+=29)if(clear(route,z,.5))for(const side of [-1,1])prop('stormdrain',side*7.2,.008,z);
     const kinds=['bench','timberplanter','bins','hydrant','stoneplanter','newsbox','meter','bikestand','parkedbike','utilitycabinet','planter','timberplanter'];
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
   for(const p of pools.values())for(const part of p.parts)finishPool(part);finishPool(leafPool);finishPool(flowerPool);for(const p of Object.values(fixturePools))finishPool(p);
   setNight(night);
 }
 function setNight(value){
   night=THREE.MathUtils.clamp(value,0,1);
   for(const [source,material] of materials)material.emissiveIntensity=night*(source.name==='Prop_ShopLamp'?3.0:.22);
   fixtureMaterial.emissiveIntensity=night*.19;
 }
 return {setRoute,setNight,stats,placements,rooms,pools,fixtures,fixturePools};
}
