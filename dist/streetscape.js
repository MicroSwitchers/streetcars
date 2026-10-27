import * as THREE from 'three';
import {GLTFLoader} from 'gltf-loader';
import {SHOP_LIGHTS,shopLighting,retailMaterial,createWindowLighting} from './night-windows.js';

export async function loadStreetProps(){
 const loader=new GLTFLoader(),embedded=document.getElementById('embedded-street-props');
 const asset=embedded?await loader.parseAsync(Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)).buffer,''):await loader.loadAsync(new URL('./street-props.glb',import.meta.url).href);
 asset.scene.updateMatrixWorld(true);
 const models=new Map(),materials=new Map();
 for(const root of asset.scene.children){
   if(!root.name.startsWith('Prop_'))continue;
   const parts=[],bounds=new THREE.Box3();
   root.traverse(mesh=>{
     if(!mesh.isMesh)return;
     const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();bounds.union(geometry.boundingBox);
     if(!materials.has(mesh.material.name)){const m=mesh.material.clone();m.envMapIntensity=.8;materials.set(m.name,m);}
     parts.push({geometry,material:materials.get(mesh.material.name)});
   });
   models.set(root.name.slice(5),{parts,bounds,triangles:parts.reduce((n,p)=>n+p.geometry.index.count/3,0)});
 }
 const geometries=new Set(),sourceMaterials=new Set();asset.scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);sourceMaterials.add(o.material);}});
 geometries.forEach(g=>g.dispose());sourceMaterials.forEach(m=>m.dispose());
 return {models,materials,revision:'blender-street-props-v3'};
}

// Static props are instanced in 96 m cells: small shared geometry, local frustum
// culling, no animation tick, and no additional real-time lights or shadow maps.
export function createStreetscape(c,assets){
 const {scene,route,mats,mat,box,cylinder,rod,add,sign,leafGeo}=c;
 const batches=new Map(),interiorMaterials=new Map(),placements=[],reserved=[],entries=[],dummy=new THREE.Object3D(),counts={};
 const stats={placements,entries,counts,models:assets.models,meshes:[],displays:[],windowGardens:0,roofDetails:0,people:0,cellLength:96};
 for(const [name,material] of assets.materials)mats['streetProp'+name]=material;
 let seed=8401;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 mat('gardenSoil',0x493d2a,1);mat('gardenFlower',0xc8a96b,.85);mat('gardenLavender',0x947b9e,.86);mat('gardenTimber',0x7a6248,.87);mat('gardenLight',0xe4dac1,.45,.15);
 mat('shopInteriorWall',0xaca28b,.92);mat('shopInteriorCeiling',0xd5c9ad,.91);
 for(let i=0;i<SHOP_LIGHTS.length;i++){
   if(i>0){mat('shopWall'+i,0xaca28b,.92);mat('shopCeiling'+i,0xd5c9ad,.91);}
   const wall=i===0?mats.shopInteriorWall:mats['shopWall'+i],ceiling=i===0?mats.shopInteriorCeiling:mats['shopCeiling'+i];
   wall.emissive.setHex(SHOP_LIGHTS[i].color);ceiling.emissive.copy(wall.emissive);
   mat('shopStrip'+i,0xc4bda9,.45,.18);mats['shopStrip'+i].emissive.copy(wall.emissive);
 }
 const bud=new THREE.IcosahedronGeometry(1,0);
 const displayDisc=new THREE.CylinderGeometry(1,1,1,20),spareTyre=new THREE.TorusGeometry(.24,.020,5,20);spareTyre.rotateY(Math.PI/2);
 const clear=(z,r=.7)=>route.crossings.every(c=>Math.abs(c.z-z)>15+r)&&route.stops.every(s=>Math.abs(s.z-z)>7+r);
 // Reserve the existing tree pits, poles, benches and bins before shop objects
 // are placed, so a later furniture pass cannot overlap a shop display.
 for(let z=-510;z<=665;z+=34){
   if(route.crossings.some(c=>Math.abs(z-c.z)<14))continue;
   for(const side of [-1,1]){
     reserved.push({x:side*9.2,z:z+6,w:1.5,d:1.5},{x:side*8.85,z:z+11,w:.7,d:1.15});
   }
 }
 function prop(kind,x,y,z,yaw=0,scale=1,interior=false,illumination=null){
   const model=assets.models.get(kind);if(!model)throw new Error('Missing street prop: '+kind);
   dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,0);dummy.scale.setScalar(scale);dummy.updateMatrix();
   const footprint=model.bounds.clone().applyMatrix4(dummy.matrix);
   const placed={kind,x,y,z,yaw,scale,interior,bounds:footprint,rack:kind==='parkedbike'};placements.push(placed);counts[kind]=(counts[kind]??0)+1;
   const cell=Math.floor(z/stats.cellLength);
   for(const part of model.parts){
     const key=cell+'/'+part.geometry.uuid+'/'+interior;
     if(interior&&!interiorMaterials.has(part.material)){
       const material=part.material.clone();
       material.emissive.copy(material.name==='Prop_ShopLamp'?new THREE.Color(0xffffff):material.color);retailMaterial(material);
       interiorMaterials.set(part.material,material);mats['queenRetail'+part.material.name]=material;
     }
     const material=interior?interiorMaterials.get(part.material):part.material;
     if(!batches.has(key))batches.set(key,{part,material,matrices:[],illumination:[],cell,kind,interior});
     batches.get(key).matrices.push(dummy.matrix.clone());
     if(interior)batches.get(key).illumination.push(new THREE.Color(illumination.color).multiplyScalar(illumination.power));
   }
   return placed;
 }
 function display({side,z,width,index}){
   const type=['bookshelf','recordbin','coffeecounter','bookshelf','bicycle','bookshelf','coffeecounter','bookshelf','floriststand','coffeecounter','recordbin','hardware','grocerstand','recordbin','grocerstand','bakerycase'][index%16];
   const yaw=-side*Math.PI/2,x=side*(type==='bookshelf'?11.52:11.65),lighting=shopLighting(index);
   const wall=lighting.style===0?'shopInteriorWall':'shopWall'+lighting.style,ceiling=lighting.style===0?'shopInteriorCeiling':'shopCeiling'+lighting.style;
   box(wall,side*13.10,1.74,z,.12,2.60,width+.10);
   box('warmStone',side*12.0,.35,z,2.20,.08,width+.08);
   box(ceiling,side*12.0,3.10,z,2.20,.10,width+.08);
   for(const end of [-1,1])box(wall,side*12.0,1.75,z+end*(width/2+.04),2.20,2.60,.08);
   const merchandise=prop(type,x,type==='bicycle'?.55:.39,z,yaw,type==='bicycle'?.88:1,true,lighting);
   prop('pendant',side*11.80,2.35,z,yaw,1,true,lighting);
   if(type==='coffeecounter'||type==='bakerycase'){
     for(const y of [1.55,2.17]){
       box('wood',side*12.83,y,z,.36,.055,width*.76);
       for(let j=-2;j<=2;j++){
         const zz=z+j*width*.13;
         if(type==='coffeecounter'){
           cylinder(j%2?'terracotta':'paintedCream',side*12.83,y+.12,zz,.063,.18);
           cylinder('wood',side*12.83,y+.22,zz,.069,.025);
         }else add(bud,mats.terracotta,side*12.83,y+.10,zz,.12,.08,.10);
       }
     }
   }
   if(type==='recordbin')for(const offset of [-.27,.27]){
     const zz=z+offset*width;
     box(offset<0?'maroon':'blue',side*13.015,2.12,zz,.03,.52,.52);
     add(displayDisc,mats.rubber,side*12.988,2.12,zz,.18,.008,.18,0,0,Math.PI/2);
     add(displayDisc,mats.trim,side*12.978,2.12,zz,.055,.010,.055,0,0,Math.PI/2);
   }
   if(type==='bicycle'){
     box('wood',side*11.65,.47,z,.72,.16,width*.84);
     for(const offset of [-.30,.30]){
       add(spareTyre,mats.rubber,side*12.90,2.08,z+offset*width,1,1,1);
       rod('steel',[side*13.0,2.38,z+offset*width],[side*12.75,2.38,z+offset*width],.014);
     }
   }
   stats.displays.push({side,z,width,index,type,merchandise,lighting,windowX:side*10.89,backX:side*13.04});
 }
 function ground(kind,x,z,yaw=0){
   if(!clear(z))return false;
   const b=assets.models.get(kind).bounds.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
   const w=b.max.x-b.min.x+.18,d=b.max.z-b.min.z+.18;
   if(reserved.some(r=>Math.abs(r.x-x)<(r.w+w)/2&&Math.abs(r.z-z)<(r.d+d)/2))return false;
   reserved.push({x,z,w,d});prop(kind,x,.18,z,yaw);return true;
 }
 function planting(x,y,z,length=1,yaw=0,flowers=true){
   for(let j=-1;j<=1;j++){
     const along=j*length*.30,dx=Math.sin(yaw)*along,dz=Math.cos(yaw)*along;
     add(leafGeo,mats[j===0?'leaf2':'leaf'],x+dx,y+.16,z+dz,.24,.27,.25);
     if(flowers)for(let k=0;k<3;k++){
       const a=k*2.4+j,px=x+dx+Math.sin(a)*.13,pz=z+dz+Math.cos(a)*.13;
       rod('leaf',[px,y+.07,pz],[px,y+.35+(k%2)*.08,pz],.009);
       add(bud,mats[j%2?'gardenFlower':'gardenLavender'],px,y+.36+(k%2)*.08,pz,.055,.065,.055);
     }
   }
 }
 function planter(x,z,yaw=0){prop('planter',x,.18,z,yaw);planting(x,.73,z,1,yaw+Math.PI/2);}
 function plantedBox(kind,x,y,z,yaw=0,scale=1){const p=prop(kind,x,y,z,yaw,scale),top=kind==='timberplanter'?.52:kind==='wallplanter'?.28:.75;planting(x,y+top*scale,z,kind==='stoneplanter'?.65:1.20*scale,yaw+Math.PI/2);return p;}
 function sideStreet(cross,side,end){
   const yaw=end===1?Math.PI:0;
   for(const [j,distance] of [32.3,75.5,118.7].entries()){
     const kind=j%2?'stoneplanter':'timberplanter',x=side*distance,z=cross.z+end*9.56;
     plantedBox(kind,x,.18,z,yaw).sideStreet=true;
     if(j===1){prop('trellis',x,.65,cross.z+end*10.04,yaw).sideStreet=true;for(const y of [1.15,1.75,2.25])add(leafGeo,mats.leaf2,x,y,cross.z+end*9.87,.22,.30,.24);}
     prop('walllantern',side*(37.1+j*43.2),2.05,cross.z+end*10.10,yaw).sideStreet=true;
   }
 }
 function cafe(side,mid){
   // The table clusters replace the former box-shaped stools in the same zone.
   for(const dz of [-1.3,1.3]){
     const z=mid+dz,x=side*9.75;
     if(!clear(z,1)||entries.some(e=>e.side===side&&Math.abs(e.z-z)<1.9)||reserved.some(r=>Math.abs(r.x-x)<(r.w+.95)/2&&Math.abs(r.z-z)<(r.d+2)/2))continue;
     prop('table',x,.18,z);
     for(const end of [-1,1])prop('chair',x,.18,z+end*.62,end===1?Math.PI:0);
     reserved.push({x,z,w:.95,d:2.0});
   }
 }
 function shop({side,mid,width,height,depth,entry,index,fireEscape=false}){
   entries.push({side,z:entry});
   box('shopStrip'+shopLighting(index).style,side*10.74,3.105,mid,.025,.028,width*.74);
   if(index%5===2)cafe(side,mid);
   if(index%4===2&&clear(mid-2)&&ground('planter',side*10.50,mid-2,-side*Math.PI/2))planting(side*10.50,.73,mid-2,1,0);
   if(index%10===4)ground('aboard',side*9.95,mid-width*.23,-side*Math.PI/2);
   if(index%16===8&&clear(mid,2.0)){
     // Low flower/produce stands stay against the shop, clear of its doorway.
     for(const dz of [-.7,0,.7]){
       prop('crate',side*10.60,.18,mid+dz,-side*Math.PI/2);
       for(let j=0;j<5;j++)add(bud,mats[j%2?'terracotta':'leaf3'],side*10.60+(rnd()-.5)*.25,.57,mid+dz+(rnd()-.5)*.40,.075,.065,.075);
     }
     reserved.push({x:side*10.60,z:mid,w:.70,d:2.2});
   }
   if(index%7===4&&!fireEscape){
     for(let z=mid-width/2+1.35;z<mid+width/2-.7;z+=2.35){
       prop('wallplanter',side*10.91,4.25,z,-side*Math.PI/2);
       planting(side*10.91,4.54,z,1.05,0);stats.windowGardens++;
     }
   }
   if(index%4===0){prop('hvac',side*(11.4+depth*.45),height+.30,mid);stats.roofDetails++;}
   if(index%6===3){
     prop('aircon',side*10.94,6.0,mid+width*.25,-side*Math.PI/2);stats.roofDetails++;
     rod('pole',[side*11.15,6.2,mid+width*.25+.42],[side*11.15,3.6,mid+width*.25+.42],.018);
   }
   if(index%8===2){
     const x=side*(11.4+depth*.72),z=mid+width*.20;
     box('brick3',x,height+.91,z,.68,1.25,.80);box('warmStone',x,height+1.60,z,.87,.15,.98);
     for(const dz of [-.20,.20]){cylinder('terracotta',x,height+1.84,z+dz,.13,.38);cylinder('dark',x,height+2.04,z+dz,.098,.012);}
     stats.roofDetails++;
   }
   if(index%14===3){
     const z=mid-width*.32;
     rod('dark',[side*11.1,4.84,z],[side*10.1,4.84,z],.028);
     box('dark',side*10.15,4.36,z,.63,.88,.10);
     sign(['BOOKS','VINYL','FLOWERS'][Math.floor(index/14)%3],side*10.15,4.36,z+.058,.55,.72,0,'#eee0b9','#30453c');
   }
   if(index%7===1&&clear(mid-width*.25,1.0)){
     const kind=index%2?'timberplanter':'stoneplanter',z=mid-width*.25;
     if(ground(kind,side*10.45,z,-side*Math.PI/2)){planting(side*10.45,kind==='timberplanter'?.72:.95,z,1.15,0);}
   }
   if(index%11===0)prop('walllantern',side*11.18,3.23,mid-width/2+.24,-side*Math.PI/2);
 }
 function streetFurniture(side,z){
   // Original low-detail bins and benches are replaced, rather than layered.
   if(clear(z+11))prop('bins',side*8.85,.18,z+11,-side*Math.PI/2);
   for(const offset of [17,20,14,23]){
     const zz=z+offset;
     if(entries.some(e=>e.side===side&&Math.abs(e.z-zz)<1.9))continue;
     if(ground('bench',side*9.75,zz,-side*Math.PI/2))break;
   }
   const n=Math.round((z+510)/34);
   if(n%2===0)ground('hydrant',side*8.75,z+25,-side*Math.PI/2);
   if(n%3===1)ground('meter',side*8.85,z-3,-side*Math.PI/2);
   if(n%6===2)ground('postbox',side*8.95,z+1,-side*Math.PI/2);
   if(z>-235&&z<385){
     if(n%3===0)ground(n%6===0?'parkedbike':'bikestand',side*8.95,z+28,-side*Math.PI/2);
     if(n%6===1)ground('newsbox',side*9.05,z+24,-side*Math.PI/2);
     if(n%7===3)ground('utilitycabinet',side*9.05,z-5,-side*Math.PI/2);
   }
 }
 function park(){
   for(const z of [-165,-155])prop('parkedbike',-10.65,.18,z,-Math.PI/2);
   for(const z of [-175.8,-145.2])plantedBox('timberplanter',-25.2,.20,z,0);
   prop('trellis',-27.68,.5,-172.0,Math.PI/2);for(const y of [1.,1.6,2.1])add(leafGeo,mats.leaf,-27.43,y,-172.0,.23,.34,.34);
   // Central walkway stays open underneath a cedar pergola; beds and picnic
   // furniture occupy the lawns, leaving the entrance and mural visible.
   for(const x of [-22.7,-17.7])for(const z of [-163.3,-157.5]){
     box('warmStone',x,.31,z,.43,.20,.43);box('gardenTimber',x,1.60,z,.16,2.62,.16);
     rod('gardenTimber',[x,2.25,z],[x+(x<-20?.45:-.45),2.82,z],.065);
   }
   for(const x of [-22.7,-17.7])box('gardenTimber',x,2.95,-160.4,.15,.25,6.7);
   for(let z=-163.5;z<-157.0;z+=.48)box('gardenTimber',-20.2,3.12,z,5.8,.16,.10);
   for(const x of [-22.65,-17.75])for(const z of [-163.2,-157.6]){
     for(let y=.7;y<2.8;y+=.48)add(leafGeo,mats.leaf,x,y,z,.25,.40,.27);
   }
   for(const z of [-167.0,-153.8])prop('picnic',-20.1,.20,z,Math.PI/2);
   // Walkway extensions terminate at the original path, with no stacked planes.
   for(const [a,b] of [[-173.7,-161.63],[-159.17,-147.3]])box('path',-24.6,.216,(a+b)/2,1.3,.024,b-a);
   for(const z of [-174.0,-146.9]){
     box('gardenSoil',-19.2,.31,z,9.4,.18,1.7);
     for(const end of [-1,1])box('warmStone',-19.2,.38,z+end*.91,9.7,.28,.16);
     for(const x of [-24,-14.4])box('warmStone',x,.38,z,.16,.28,1.7);
     for(let x=-23.5;x<-14.8;x+=.65){planting(x,.42,z,1,Math.PI/2);}
   }
   for(const z of [-169.0,-151.8]){
     prop('bench',-26.3,.20,z,Math.PI/2);
     planter(-12.4,z,Math.PI/2);
   }
   for(const [x,z] of [[-12.4,-162.9],[-23.5,-162.9],[-23.5,-157.7],[-12.4,-157.7]]){
     cylinder('dark',x,.58,z,.075,.75);cylinder('gardenLight',x,.995,z,.07,.10);cylinder('dark',x,1.07,z,.09,.035);
   }
   sign('QUEEN WEST GARDEN',-11.69,1.35,-156.4,1.8,.38,Math.PI/2,'#ede0ba','#354b40');
   for(const z of [-157.1,-155.7])cylinder('fence',-11.73,.91,z,.025,1.35);
   stats.pergola={minX:-23.2,maxX:-17.2,minZ:-163.8,maxZ:-157.0,clearance:2.82};
 }
 function finish(){
   park();
   for(const {part,material,matrices,illumination,cell,kind,interior} of batches.values()){
     let geometry=part.geometry;
     if(interior){
       geometry=new THREE.BufferGeometry();geometry.setIndex(part.geometry.index);
       for(const [name,attribute] of Object.entries(part.geometry.attributes))geometry.setAttribute(name,attribute);
       const glow=new THREE.InstancedBufferAttribute(new Float32Array(illumination.length*3),3);
       illumination.forEach((color,i)=>glow.setXYZ(i,color.r,color.g,color.b));geometry.setAttribute('instanceIllumination',glow);
     }
     const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
     matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
     mesh.name='StreetProps_'+kind+'_'+cell;mesh.castShadow=!interior&&!['treegrate','stormdrain'].includes(kind);mesh.receiveShadow=true;mesh.userData.shopInterior=interior;
     mesh.computeBoundingSphere();mesh.computeBoundingBox();scene.add(mesh);stats.meshes.push(mesh);
   }
   stats.instances=placements.length;stats.sourceTriangles=[...assets.models.values()].reduce((n,m)=>n+m.triangles,0);
   stats.instancedTriangles=placements.reduce((n,p)=>n+assets.models.get(p.kind).triangles,0);
   stats.geometryBytes=[...assets.models.values()].flatMap(m=>m.parts).reduce((n,p)=>n+p.geometry.index.array.byteLength+Object.values(p.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0),0);
   stats.windowLighting=createWindowLighting(scene,mats,stats.displays);
   return stats;
 }
 return {display,shop,sideStreet,streetFurniture,treeGrate(side,z){if(z>-235&&z<385&&clear(z,.7))prop('treegrate',side*9.2,.18,z);},drain(side,z){if(z>-235&&z<385&&clear(z,.5))prop('stormdrain',side*7.2,.008,z);},finish,setNight(night){
   const lantern=assets.materials.get('Prop_ShopLamp');lantern.emissive.setHex(0xffcf98);lantern.emissiveIntensity=night*.9;
   mats.gardenLight.emissive.setHex(0xffd2a0);mats.gardenLight.emissiveIntensity=night*1.8;
   for(const material of interiorMaterials.values()){
     material.emissiveIntensity=night*(material.name==='Prop_ShopLamp'?3.2:.25);
   }
   SHOP_LIGHTS.forEach((profile,i)=>{
     for(const material of [i===0?mats.shopInteriorWall:mats['shopWall'+i],i===0?mats.shopInteriorCeiling:mats['shopCeiling'+i]])material.emissiveIntensity=night*.13*profile.power;
     mats['shopStrip'+i].emissiveIntensity=night*2.2*profile.power;
   });
   stats.windowLighting.setNight(night);
 }};
}
