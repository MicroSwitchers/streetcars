import * as THREE from 'three';
import {facadeReliefs,reliefFacade,FACADE_RELIEFS} from './facade-details.js';
import {architectureMaterial} from './architecture.js';

// The same authored architectural kit used on Queen, with a bounded resident
// pool. Section changes only replace instance matrices; they never make new
// meshes, geometries, materials, textures, lights, or shader programs.
const CAPACITIES=Object.freeze({cornice:168,firelanding:12,escapeladder:8,rooflantern:12,chimneypots:16,baywindow:8,balcony:6,pediment:4,flathead:480,spandrel:160,frieze:240,wallvent:120,downpipe:160,pilaster:100,stringcourse:100,cornerblock:100,roundel:100,shutters:100});
const HERITAGE=new Set(['west','portugal','bellwoods','chinatown','garden','riverside','riverdale','terminal']);
const MAX_TRIANGLES=145000;
const round=n=>Math.round(n*1000)/1000;

export function createDundasFacades({group,mats,assets}){
 const pools=new Map(),models=new Map(),dummy=new THREE.Object3D(),worldBounds=new THREE.Box3();
 const stoneColors=[0xffffff,0xe3dfcf,0xf4e6cf,0xd4d5cd].map(c=>new THREE.Color(c));
 const sashColors=[0xffffff,0xc5cabb,0xaabbb1,0xe4d6bc].map(c=>new THREE.Color(c));
 const white=new THREE.Color(0xffffff),placements=[],surfaces=[];
 const stats={meshes:0,instances:0,triangles:0,capacityTriangles:0,geometryBytes:0,frontages:0,overflow:0,budgetOmissions:0,triangleLimit:MAX_TRIANGLES,rebuilds:0,counts:{},night:0};
 const usedGeometry=new Set();let triangleLimit=MAX_TRIANGLES;
 for(const [kind,capacity] of Object.entries(CAPACITIES)){
   const model=assets.models.get(kind);if(!model)throw new Error('Missing Dundas architectural asset: '+kind);
   const parts=[];
   for(const [index,part] of model.parts.entries()){
     const material=architectureMaterial(part,mats);
     // Register the original materials before the environment's surface and
     // weather preparation. Queen and Dundas share the same finish treatment.
     if(material!==mats.glass)mats['dundasArchitecture'+part.material.name]=material;
     const mesh=new THREE.InstancedMesh(part.geometry,material,capacity);
     mesh.name='Dundas_Architecture_'+kind+'_'+index;mesh.count=0;
     mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.setColorAt(0,white);
     mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
     mesh.castShadow=kind==='cornerblock'?/BlockBrick|Slate/.test(part.material.name):material!==mats.glass&&!material.transparent&&!FACADE_RELIEFS.includes(kind);
     mesh.receiveShadow=!material.transparent&&(kind!=='cornerblock'||!/Limestone|Sash/.test(part.material.name));
     mesh.userData.architecture=true;mesh.userData.dundasFacade=true;
     mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-90,-1,-250),new THREE.Vector3(90,85,400));
     mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,35,75),380);
     group.add(mesh);parts.push({mesh,material,source:part.material.name});usedGeometry.add(part.geometry);
   }
   const entry={model,parts,count:0,capacity};pools.set(kind,entry);models.set(kind,model);
   stats.meshes+=parts.length;stats.capacityTriangles+=model.triangles*capacity;
 }
 stats.geometryBytes=[...usedGeometry].reduce((sum,g)=>sum+(g.index?.array.byteLength??0)+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0),0);

 function place(kind,b,y,z,{x=b.front,sx=1,sy=1,sz=1,roof=false,origin,rotation,relief=false}={}){
   const p=pools.get(kind),model=models.get(kind);
   if(p.count>=p.capacity||stats.triangles+model.triangles>triangleLimit){stats.budgetOmissions++;return false;}
   dummy.position.set(origin?.[0]??b.side*x,y,origin?.[2]??z);dummy.rotation.set(0,rotation??-b.side*Math.PI/2,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();
   const shade=Math.abs(Math.floor(b.index??0))%stoneColors.length;
   for(const part of p.parts){
     part.mesh.setMatrixAt(p.count,dummy.matrix);
     const color=/Limestone|CarvedStone/.test(part.source)?stoneColors[shade]:part.source==='Architecture_Sash'?sashColors[shade]:white;
     part.mesh.setColorAt(p.count,color);
   }
   worldBounds.copy(model.bounds).applyMatrix4(dummy.matrix);
   placements.push({kind,side:b.side,z:round(z),y:round(y),index:b.index,district:b.district,roof,relief,bounds:{min:worldBounds.min.toArray().map(round),max:worldBounds.max.toArray().map(round)}});
   p.count++;stats.instances++;stats.triangles+=model.triangles;stats.counts[kind]=(stats.counts[kind]??0)+1;return true;
 }
 function surface(b){
   const f=b.origin?b:reliefFacade({...b,height:b.reliefHeight??b.height}),layout=facadeReliefs(f),cos=Math.cos(f.rotation),sin=Math.sin(f.rotation);
   const record={...f,style:layout.style,details:0};surfaces.push(record);
   for(const d of layout.details){const origin=[f.origin[0]+cos*d.u,0,f.origin[2]-sin*d.u];if(place(d.kind,b,d.y,origin[2],{origin,rotation:f.rotation,sx:d.sx,sy:d.sy,relief:true}))record.details++;}
 }

 function upperWindows(b){
   if(Array.isArray(b.windows))return b.windows.filter(w=>w.y>3.8&&w.y+1.75<b.height+.7);
   // Lofts keep their industrial ribbons unless their builder supplies actual
   // window positions. Placing little arches across those ribbons is incorrect.
   if(b.kind==='loft')return [];
   const columns=b.kind==='house'?2:b.width>10.2?2:1,pitch=(b.width-.9)/columns,windows=[];
   for(let level=0;level<3;level++){
     const y=4.7+level*3;if(y+1.75>b.height+.35)break;
     for(let col=0;col<columns;col++)windows.push({y,z:b.z+(col-(columns-1)/2)*pitch,width:Math.min(2.7,pitch-.6),height:1.85});
   }
   return windows;
 }

 function setRoute(route,frontages=[],budget=MAX_TRIANGLES,returns=[],infill=[]){
   triangleLimit=Math.min(MAX_TRIANGLES,Math.max(0,budget));stats.triangleLimit=triangleLimit;
   for(const p of pools.values())p.count=0;
   placements.length=surfaces.length=0;stats.instances=stats.triangles=stats.frontages=stats.overflow=stats.budgetOmissions=0;stats.counts={};stats.rebuilds++;
   if(route.id==='dundas'){
     // The builder cuts these apertures and omits its original pane/sash.
     // Place the authored replacements first, before optional roof decoration.
     for(const b of frontages)for(const w of b.windows||[])if(w.feature)place(w.feature,b,w.y,w.z);
     stats.infill=infill.length;stats.infillMissing=0;
     for(const b of infill)if(!place('cornerblock',b,.18,b.z,{sx:b.width/6}))stats.infillMissing++;
     // Reliefs get a bounded share before expensive ornamental cornices. This
     // spreads useful wall detail across buildings and street orientations.
     const savedLimit=triangleLimit,reliefBudget=Math.min(29000,Math.max(0,triangleLimit-stats.triangles-6000));
     const near=(a,b)=>Math.abs(a.z+65)-Math.abs(b.z+65);
     const reliefBuildings=frontages.filter(b=>['shop','house','loft','modern'].includes(b.kind)&&b.z>-230&&b.z<380).sort(near).slice(0,28);
     const corners=returns.filter(b=>b.kind==='corner').sort(near),sides=returns.filter(b=>b.kind!=='corner').sort(near);
     // Separate shares prevent a long industrial frontage, or dozens of party
     // walls, from using up all the relief before side streets are reached.
     for(const [list,share] of [[reliefBuildings,.50],[sides,.28],[corners,.22]]){
       triangleLimit=Math.min(savedLimit,stats.triangles+Math.floor(reliefBudget*share));
       for(const b of list)surface(b);
     }
     triangleLimit=savedLimit;
     const eligible=frontages.filter(b=>HERITAGE.has(b.district)&&['shop','house','loft'].includes(b.kind)&&b.z>-230&&b.z<380&&b.width>3&&b.height>5)
       .sort((a,b)=>Math.abs(a.z+45)-Math.abs(b.z+45)||a.side-b.side);
     // Keep most modelling detail around the useful sidewalk/ride view. Distal
     // blocks retain the district builder's cheaper roof and window profiles.
     const detailed=eligible.slice(0,30),corniceFrontages=new Set();let corniceModules=0;
     for(const b of detailed.filter(b=>b.kind!=='loft'&&Math.abs(b.index)%3===0).slice(0,8)){
       const modules=Math.ceil(b.width);
       if(corniceModules+modules<=CAPACITIES.cornice){corniceFrontages.add(b);corniceModules+=modules;}
     }
     for(const [order,b] of detailed.entries()){
       stats.frontages++;
       if(corniceFrontages.has(b)){
         const modules=Math.ceil(b.width),span=(b.width-.05)/modules;
         for(let i=0;i<modules;i++)place('cornice',b,b.height+.22,b.z-b.width/2+(i+.5)*b.width/modules,{sx:span});
       }
       const ordinal=Math.abs(Math.floor(b.index??order)),windows=upperWindows(b);
       if(order<20&&b.kind==='shop'&&ordinal%9===2)place('pediment',b,b.height+.28,b.z);
       // Rectangular street windows use the builder's straight lintels and
       // sills. Decorative arches belong to specific buildings, never a kit
       // detail repeated across unrelated shops, houses and factory windows.
       const fire=b.kind==='loft'&&ordinal%11===2&&order<22;
       if(fire){
         const featureZ=windows.length?windows[Math.floor((windows.length-1)/2)].z:b.z;
         const floors=[];
         for(let y=b.kind==='loft'?3.9:3.58;y+2.0<b.height&&floors.length<3;y+=2.7)floors.push(y);
         for(const y of floors)place('firelanding',b,y,featureZ,{x:b.front-.035});
         for(let j=0;j<floors.length-1;j++)place('escapeladder',b,floors[j],featureZ,{x:b.front-.035});
       }
       // Most main-street roofs have plain coping; selected frontages keep
       // a finely modelled cornice rather than identical classical pediments.
       // Features sit within the roof footprint, clear of shop entrances,
       // sidewalks, catenary, the track and the district's awnings.
       if(order<24&&(b.kind==='house'||ordinal%3===0))place('chimneypots',b,b.height+.28,b.z-b.width*.30,{x:b.front+b.depth*.70,roof:true});
       if(b.kind==='loft'&&order<22&&ordinal%7===1)place('rooflantern',b,b.height+.29,b.z+b.width*.23,{x:b.front+b.depth*.65,roof:true});

     }
   }
   for(const p of pools.values())for(const part of p.parts){
     part.mesh.count=p.count;part.mesh.instanceMatrix.needsUpdate=true;part.mesh.instanceColor.needsUpdate=true;
   }
 }
 function setNight(n){stats.night=round(THREE.MathUtils.clamp(n,0,1));}
 return {setRoute,setNight,stats,placements,surfaces};
}
