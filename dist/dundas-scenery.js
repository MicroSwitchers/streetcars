import * as THREE from 'three';
import {DUNDAS_DISTRICTS,dundasDistrictAt,dundasIndexAtZ} from './dundas-districts.js';

// A complete resident 505 streetscape, reusing the same GPU buffers at every
// section change. Districts change both massing and street-level objects.
export function createDundasScenery({scene,route,mats,foliage}){
 const group=new THREE.Group();group.name='505_Dundas_District_Streetscape';scene.add(group);
 const boxGeometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const pools=new Map(),displays=[],zones=[],landmarks=[],nightMaterials=[];let sourceSerial=0;
 const stats={meshes:0,instances:0,triangles:0,capacityTriangles:0,atlasPixels:1024*1024,overflow:0,frontages:0,trees:0,sources:0,rebuilds:0,windowFrames:0,facadeDetails:0,parkSlopes:0,skylineTowers:0,activeZones:[],landmarks:[]};
 const material=(name,colour,roughness=.85,metalness=0)=>{
   const m=new THREE.MeshStandardMaterial({color:colour,roughness,metalness});m.name='Dundas_'+name;mats['dundas'+name]=m;return m;
 };
 // Shared masonry receives the full bump/roughness/weathering treatment in
 // finishSurfaces(), including world-sized UVs for these instanced boxes.
 const sharedGlass=mats.glass||material('Glass',0x49616b,.27,.28);
 const materials={
   brick:mats.brick0||material('Brick',0x985f4a),buff:mats.brick2||material('BuffBrick',0xb49b75),
   plaster:material('Plaster',0xc8bda5),stone:material('Stone',0xaaa89b),
   timber:material('Timber',0x96734e),metal:material('Metal',0x3b4846,.7,.32),
   roof:material('Roof',0x4d504b),glass:material('CurtainGlass',0x49616b,.27,.28),
   window:sharedGlass,display:material('Display',0xc8b99b,.4,.1),
   red:material('Red',0x974c42),green:material('Green',0x4e6c58),
   grass:mats.parkGrass||material('Grass',0x71835a),blue:material('Blue',0x4d747d,.54,.14),
 };
 if(mats.display0?.map)materials.display.map=mats.display0.map;
 const leaf=material('Leaf',0x75905b);leaf.map=foliage.map;leaf.alphaTest=.45;leaf.side=THREE.DoubleSide;leaf.shadowSide=THREE.FrontSide;leaf.vertexColors=true;
 materials.display.emissive.setHex(0xffc48a);nightMaterials.push({material:materials.display,power:.32});
 // Large curtain walls reflect the night; small occupied windows provide glow.
 // Sharing their emission would turn an entire tower into a bright white panel.
 materials.glass.emissive.setHex(0x9ebbc9);nightMaterials.push({material:materials.glass,power:.018});
 function pool(name,geometry,mat,capacity,shadow=true){
   const mesh=new THREE.InstancedMesh(geometry,mat,capacity);mesh.name='Dundas_'+name;mesh.count=0;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=shadow;mesh.receiveShadow=true;
   // Bounds are fixed to the resident section, rather than allocating them on a
   // route change. Instance counts, matrices and sign regions are the only edits.
   mesh.boundingBox=new THREE.Box3(new THREE.Vector3(-145,-2,-465),new THREE.Vector3(145,85,645));
   mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,40,90),590);
   const p={mesh,count:0,capacity,triangles:geometry.index?geometry.index.count/3:geometry.attributes.position.count/3};
   pools.set(name,p);group.add(mesh);stats.capacityTriangles+=p.triangles*capacity;return p;
 }
 // Matrix capacities follow the maximum demand across all 37 resident route
 // offsets. Capacity does not increase draw cost: only mesh.count is rendered.
 const capacities={brick:220,buff:100,plaster:220,stone:1800,timber:210,metal:1500,roof:310,glass:460,window:1200,display:180,red:220,green:160,grass:170,blue:340};
 for(const [name,capacity] of Object.entries(capacities))pool(name,boxGeometry,materials[name],capacity,!['glass','window','display','grass'].includes(name));
 pool('leaf',foliage.geometry,leaf,82,false);
 const gableGeometry=new THREE.BufferGeometry();
 const roofVertices=[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,0],[.5,-.5,-.5],[.5,-.5,.5],[.5,.5,0]];
 const roofIndices=[0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3];
 gableGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices.flat(),3));gableGeometry.setIndex(roofIndices);gableGeometry.computeVertexNormals();pool('gable',gableGeometry,materials.roof,140);
 // A single reusable chamfered reveal is substantially cheaper than separate
 // jamb/lintel boxes. Its outer edge meets masonry; the inner edge projects
 // forward around the inset glazing, without invisible back/side polygons.
 const frameGeometry=new THREE.BufferGeometry(),framePositions=[];
 const quad=(a,b,c,d,wanted)=>{
   const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),cv=new THREE.Vector3(...c);
   const reverse=bv.sub(av).cross(cv.sub(av)).dot(new THREE.Vector3(...wanted))<0;
   for(const point of reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d])framePositions.push(...point);
 };
 const outer=[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]],inner=[[-.44,-.44],[-.44,.44],[.44,.44],[.44,-.44]];
 for(let i=0;i<4;i++){
   const next=(i+1)%4,a=outer[i],b=outer[next],c=inner[next],d=inner[i];
   quad([.16,...a],[.16,...b],[-.075,...c],[-.075,...d],[-1,0,0]);
   const inward=[0,-(c[0]+d[0]),-(c[1]+d[1])];
   quad([-.075,...d],[-.075,...c],[.16,...c],[.16,...d],inward);
 }
 frameGeometry.setAttribute('position',new THREE.Float32BufferAttribute(framePositions,3));frameGeometry.computeVertexNormals();pool('frame',frameGeometry,materials.stone,520);
 pool('hardware',boxGeometry,mats.steel||materials.metal,150,false);
 // A gently rising turf prism joins adjacent park cells exactly, replacing
 // visibly raised rectangular grass blocks. One geometry serves every slope.
 const parkProfile=[new THREE.Vector2(-.5,-.10),new THREE.Vector2(.5,-.10),new THREE.Vector2(.5,.9),new THREE.Vector2(.15,.9),new THREE.Vector2(-.38,0),new THREE.Vector2(-.5,0)];
 const parkShape=new THREE.Shape(parkProfile),slopeGeometry=new THREE.ExtrudeGeometry(parkShape,{depth:1,bevelEnabled:false,steps:1});slopeGeometry.translate(0,0,-.5);pool('parkSlope',slopeGeometry,materials.grass,36,false);
 pool('skyline',boxGeometry,mats.skyline||materials.stone,24,false);

 // One local atlas serves every shop and landmark; panels are static and mildly
 // emissive at night. No animation, photoreal people, or high-glare screen loops.
 const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const ctx=atlas.getContext('2d');
 const signTexture=new THREE.CanvasTexture(atlas);signTexture.colorSpace=THREE.SRGBColorSpace;signTexture.anisotropy=4;
 const signMaterial=material('Signs',0xffffff,.68);signMaterial.map=signTexture;signMaterial.emissive.setHex(0xffd4a1);
 signMaterial.emissiveMap=signTexture;nightMaterials.push({material:signMaterial,power:.26});
 const signGeometry=new THREE.PlaneGeometry(1,1),signRegions=new THREE.InstancedBufferAttribute(new Float32Array(160*4),4);signRegions.setUsage(THREE.DynamicDrawUsage);signGeometry.setAttribute('signRegion',signRegions);
 signMaterial.onBeforeCompile=shader=>{
   shader.vertexShader='attribute vec4 signRegion;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
     #ifdef USE_MAP
       vMapUv=signRegion.xy+uv*signRegion.zw;
     #endif
     #ifdef USE_EMISSIVEMAP
       vEmissiveMapUv=signRegion.xy+uv*signRegion.zw;
     #endif`);
 };signMaterial.customProgramCacheKey=()=> 'dundas-sign-regions-v1';
 pool('sign',signGeometry,signMaterial,160,false);
 const signEntries=[];
 const palette={west:['#e6ddc3','#364b44'],portugal:['#fff0d1','#555e76'],bellwoods:['#efe8cf','#3f614e'],chinatown:['#ffe8b9','#943c32'],culture:['#ede7d4','#54483c'],core:['#e0e8e3','#314b58'],garden:['#efe4cd','#546052'],regent:['#eef0df','#4c6573'],don:['#e6e7d0','#3e5e4a'],riverside:['#f1e2bf','#6e483b'],riverdale:['#ece9d1','#4f6952'],terminal:['#f4e8d3','#9b3e37']};
 for(const district of DUNDAS_DISTRICTS){
   // The first two signs are sufficient to distinguish this frontage; sharing
   // cells leaves room for legible landmark panels within a single small atlas.
   for(let j=0;j<2;j++)signEntries.push({district:district.id,text:district.shops[j],sub:j?'INDEPENDENT SHOPS · TORONTO':'DUNDAS / BROADVIEW',colors:palette[district.id]});
 }
 const landmarkSigns={ago:24,hospital:25,square:26,spectrum:27,library:28,station:29,regent:30,riverdale:31};
 [['ART GALLERY OF ONTARIO','ART · ARCHITECTURE · TORONTO'],['TORONTO WESTERN','HOSPITAL'],['SANKOFA SQUARE','YONGE & DUNDAS'],['DANIELS SPECTRUM','ARTS & CULTURE'],['RIVERDALE LIBRARY','TORONTO PUBLIC LIBRARY'],['TTC · BROADVIEW','SUBWAY · STREETCARS'],['REGENT PARK','GARDENS & COMMUNITY'],['RIVERDALE PARK','BROADVIEW AVENUE']].forEach(([text,sub])=>signEntries.push({text,sub,colors:['#eee8cf','#3a5352']}));
 signEntries.forEach(({text,sub,colors},i)=>{
   const x=(i%4)*256,y=Math.floor(i/4)*128;ctx.fillStyle=colors[1];ctx.fillRect(x,y,256,128);
   ctx.strokeStyle=colors[0]+'77';ctx.lineWidth=2;ctx.strokeRect(x+7,y+8,242,112);
   ctx.fillStyle=colors[0];ctx.textAlign='center';ctx.textBaseline='middle';let size=23;
   const font=n=>`600 ${n}px "Microsoft YaHei", "Noto Sans CJK SC", Arial, sans-serif`;ctx.font=font(size);
   while(size>11&&ctx.measureText(text).width>234)ctx.font=font(--size);
   ctx.fillText(text,x+128,y+55,234);ctx.font='11px Arial, sans-serif';ctx.fillText(sub,x+128,y+88,232);
 });
 // The Don Valley's second shop-sign cell is unused by its open landscape.
 // Reuse it for a blue-and-cream azulejo-inspired painted tile/mural panel.
 const muralCell=17,muralX=(muralCell%4)*256,muralY=Math.floor(muralCell/4)*128;
 ctx.fillStyle='#eee5ce';ctx.fillRect(muralX,muralY,256,128);
 for(let row=0;row<4;row++)for(let col=0;col<8;col++){
   const x=muralX+col*32,y=muralY+row*32;ctx.fillStyle='#4c6c8b';ctx.fillRect(x+3,y+3,26,26);
   ctx.fillStyle='#e9dfc6';ctx.fillRect(x+7,y+7,18,18);ctx.fillStyle=(row+col)%2?'#6d8b98':'#42617f';ctx.fillRect(x+11,y+11,10,10);
   ctx.fillStyle='#b3b5a6';ctx.fillRect(x,y,32,1);ctx.fillRect(x,y,1,32);
 }
 signTexture.needsUpdate=true;

 function put(name,x,y,z,sx,sy,sz,ry=0,rz=0){
   const p=pools.get(name);if(p.count>=p.capacity){stats.overflow++;return -1;}
   dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();p.mesh.setMatrixAt(p.count,dummy.matrix);return p.count++;
 }
 function box(name,side,front,y,z,depth,height,width,ry=0){return put(name,side*(front+depth/2),y,z,depth,height,width,ry);}
 function panel(side,z,y,width,height,cell,front=11.52,projecting=false){
   const i=put('sign',side*front,y,z,width,height,1,projecting?0:-side*Math.PI/2);if(i<0)return;
   const col=cell%4,row=Math.floor(cell/4);signRegions.setXYZW(i,(col*256+1)/1024,1-((row+1)*128-1)/1024,254/1024,126/1024);
 }
 function source(side,z,width,index,style=0,windowX=side*11.6){
   const colors=[0xffca8b,0xf8dec0,0xd8e7dd,0xffb988,0xaec9d3,0xffd697];
   displays.push({side,z,width,windowX,backX:windowX+side*2.5,index:sourceSerial++,lighting:{style,color:colors[style%6],power:.72+(index%4)*.12}});
 }
 const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
 const clear=(z,width=0)=>z-width/2>=-440&&z+width/2<=620&&!route.crossings.some(c=>Math.abs(z-c.z)<11+width/2);
 const localZ=index=>-124+(index-route.stopOffset)*200;
 const closeDetail=z=>z>-240&&z<380;
 function frame(side,front,y,z,width,height){put('frame',side*front,y,z,1,height,width,side===1?0:Math.PI);stats.windowFrames++;}
 function tree(side,z,front=15,size=1){
   if(!clear(z,6*size)||stats.trees>=40)return;
   const x=side*front;
   put('timber',x,1.75*size,z,.22*size,3.5*size,.22*size);
   put('leaf',x,4.5*size,z,2.2*size,2.9*size,2.2*size);
   put('leaf',x+side*.9*size,5.2*size,z+.6*size,1.8*size,2.3*size,1.9*size);
   stats.trees++;
 }
 function windows(side,z,width,height,kind='window',front=11.56,floors=2,columns=2){
   const pitch=(width-.9)/columns;
   for(let level=0;level<floors;level++){
     const y=4.7+level*3.0;if(y+1.15>height-.15)break;
     for(let col=0;col<columns;col++){
       const zz=z+(col-(columns-1)/2)*pitch;
       const paneWidth=Math.min(2.7,pitch-.6);box(kind,side,front,y,zz,.045,1.85,paneWidth);
       if(level===0)box('stone',side,front-.08,y+1.05,zz,.2,.16,Math.min(3.05,pitch-.3));
       if(closeDetail(z)&&level===0){
         frame(side,front+.02,y,zz,paneWidth+.2,2.03);
         if((col+level)%2===0)box('metal',side,front-.06,y,zz,.08,1.82,.055);
         if(level===0)box('stone',side,front-.16,y-1.02,zz,.38,.13,paneWidth+.28);
       }
     }
   }
 }
 function roof(side,z,width,height,depth,gabled=false){
   if(gabled)put('gable',side*(11.75+depth/2),height+.86,z,depth+1,1.8,width+.4);
   else box('roof',side,11.55,height+.14,z,depth+.35,.25,width+.22);
 }
 function shop(side,z,width,height,district,index,serial,front=11.75){
   const pick=hash(serial*7+index),brickName=district.id==='portugal'?(pick<.35?'plaster':pick<.7?'brick':'buff'):pick<.24?'buff':'brick';
   const depth=8+hash(serial)*4;box(brickName,side,front,height/2+.18,z,depth,height,width-.14);
   roof(side,z,width-.12,height,depth,['garden','riverdale','terminal'].includes(district.id)&&pick<.8);
   box('stone',side,front-.30,height-.04,z,.52,.19,width+.08);
   if(closeDetail(z)&&serial%2===0)box('stone',side,front-.16,height-.40,z,.30,.12,width-.15);
   const creamTrim=district.id==='portugal'||district.id==='garden';
   box('metal',side,front-.17,1.65,z,.18,2.82,width-.55);
   // Recessed visual display and narrow door are separate from masonry.
   box('display',side,front-.24,1.63,z-width*.12,.045,2.34,width*.57);
   box('glass',side,front-.27,1.54,z+width*.34,.045,2.52,width*.19);
   for(const edge of [-1,1])box(creamTrim?'stone':'metal',side,front-.33,1.6,z+edge*(width/2-.2),.18,2.9,.17);
   box(creamTrim?'stone':'metal',side,front-.28,3.08,z,.24,.22,width-.25);
   const mural=district.id==='portugal'&&serial%5===0;
   windows(side,z,width,height,pick<.55?'window':'glass',front-.17,3,mural?1:width>10.2?2:1);
   if(closeDetail(z)){
     const doorZ=z+width*.34;
     frame(side,front-.27,1.54,doorZ,width*.19+.18,2.70);
     box('stone',side,front-.43,.20,doorZ,.55,.14,width*.22);
     box('metal',side,front-.32,1.63,z-width*.12,.08,2.30,.065);
     put('hardware',side*(front-.38),1.42,doorZ-width*.055,.045,.28,.045);
     stats.facadeDetails+=4;
     if(serial%4===0){box('metal',side,front+depth*.55,height+.48,z,1.35,.62,1.2);box('roof',side,front+depth*.55-.08,height+.83,z,1.5,.10,1.35);stats.facadeDetails+=2;}
   }
   const districtNumber=DUNDAS_DISTRICTS.indexOf(district),signCell=districtNumber*2+serial%2;
   if(serial%2===0||district.id==='chinatown')panel(side,z,3.6,width-.55,.68,signCell,front-.35);
   const shade=district.id==='chinatown'?'red':district.id==='portugal'?(serial%2?'blue':'green'):serial%3?'green':'red';
   if(pick<.77){
     box(shade,side,10.78,2.95,z,.86,.18,width-.6);box(shade,side,10.74,2.79,z,.1,.25,width-.6);
     if(closeDetail(z)&&serial%2===0)for(const off of [-.38,.38]){put('metal',side*11.28,2.61,z+width*off,.07,.68,.055,0,-side*.55);stats.facadeDetails++;}
   }
   if(district.id==='portugal'){
     // Pale blue tile ribbons and terracotta roof accents distinguish the west.
     box('blue',side,front-.25,.52,z,.10,.30,width-.5);
     for(const off of [-.35,.35])box('stone',side,front-.30,.52,z+width*off,.06,.3,.12);
     if(mural&&closeDetail(z))panel(side,z-width*.28,5.15,2.25,2.5,muralCell,front-.22);
   }
   if(district.id==='chinatown'||district.id==='riverside'&&index>32){
     if(serial%3===0){
       put('timber',side*11.03,.42,z-width*.16,.7,.55,1.65);
       for(let j=0;j<3;j++)put(j===1?'red':'green',side*10.99,.78,z-width*.16+(j-1)*.45,.52,.20,.40);
       if(serial%2===0)panel(side,z+width*.40,5.4,1.12,1.65,signCell,11.55,true);
     }
   }
   source(side,z,width,serial,districtNumber%6,side*(front-.25));stats.frontages++;
 }
 function house(side,z,width,height,district,index,serial){
   const depth=9.5,front=14.0;box(serial%3?'brick':'buff',side,front,height/2+.16,z,depth,height,width-.3);
   put('gable',side*(front+depth/2),height+1.15,z,depth+1,2.3,width-.1);
   windows(side,z,width,height,'window',front-.07,2,2);
   box('stone',side,front-.6,.4,z,1.25,.55,width-.6);
   box('glass',side,front-.08,1.5,z-width*.27,.04,2.45,1.1);
   // Small bay windows and porches give the adapted houses a different depth.
   box('plaster',side,front-.75,1.6,z+width*.21,.85,2.25,width*.34);
   box('glass',side,front-.81,1.72,z+width*.21,.045,1.65,width*.27);
   box('roof',side,front-1.0,2.8,z+width*.21,1.15,.18,width*.39);
   if(closeDetail(z)){
     const doorZ=z-width*.27;frame(side,front-.08,1.5,doorZ,1.30,2.64);
     box('stone',side,front-.40,2.92,z,.52,.19,width-.2);
     for(const off of [-.11,.11])box('timber',side,front-.83,1.75,z+width*(.21+off),.10,1.95,.10);
     if(serial%4===0){box('brick',side,front+6,height+1.0,z-width*.25,.75,1.8,.7);box('stone',side,front+5.93,height+1.96,z-width*.25,.9,.14,.86);}
     stats.facadeDetails+=4;
   }
   box('grass',side,11.0,.22,z,2.3,.18,width-.4);
   if(serial%3===0)tree(side,z+width*.25,12.1,.72);
   source(side,z,width,serial,1,side*(front-.08));stats.frontages++;
 }
 function loft(side,z,width,district,index,serial){
   const h=11+Math.floor(hash(serial+index)*3)*3,depth=12;
   box(serial%3?'brick':'buff',side,11.75,h/2,z,depth,h,width-.2);roof(side,z,width,h,depth);
   for(let floor=0;floor<Math.min(4,(h-2)/3);floor++){
     const y=2+floor*3;box(floor%2?'glass':'window',side,11.62,y,z,.055,1.9,width-.95);
     for(const q of [-.34,0,.34])box('metal',side,11.56,y,z+width*q,.08,1.95,.10);
   }
   box('stone',side,11.49,h-.3,z,.40,.38,width+.1);
   if(serial%2===0){box('metal',side,15.0,h+1.0,z,2.1,1.6,2.5);panel(side,z,3.8,width-.8,.8,serial%2,11.51);}
   source(side,z,width,serial,serial%2?4:0);stats.frontages++;
 }
 function modern(side,z,width,district,index,serial){
   const regent=district.id==='regent',h=regent?23+hash(serial)*17:28+hash(serial)*26,depth=14;
   const front=regent?15:12;
   box('stone',side,front,4.7,z,depth,9.4,width-.35);
   box('glass',side,front-.09,2.3,z,.06,3.45,width-1.2);
   for(const off of [-.33,0,.33])box('plaster',side,front-.19,2.5,z+width*off,.22,4.7,.3);
   box(serial%2?'plaster':'stone',side,front+5,(h+9.4)/2,z+width*.06,12,h-9.4,width*.75);
   box('glass',side,front+4.91,(h+9.4)/2,z+width*.06,.06,h-10,width*.68);
   for(let floor=11;floor<h-1;floor+=3.3)box(regent?'stone':'metal',side,front+4.82,floor,z+width*.06,.25,.20,width*.75);
   for(const off of [-.22,0,.22])box('metal',side,front+4.80,(h+9.4)/2,z+width*(off+.06),.15,h-10,.15);
   for(let floor=12.2;floor<h-2;floor+=6.6)for(const off of [-.18,.18])
     box('window',side,front+4.70,floor,z+width*(off+.06),.035,1.8,2.1);
   if(regent){
     box('timber',side,front-.25,7.8,z,.24,.48,width-.2);
     tree(side,z+width*.28,12.6,.75);
     box('grass',side,11.0,.3,z,2.8,.3,width-.4);
   }else if(serial%3===0){
     panel(side,z,7.6,width*.70,3.0,10+serial%2,front-.22);
   }
   panel(side,z,4.65,width*.65,.72,DUNDAS_DISTRICTS.indexOf(district)*2+serial%2,front-.23);
   source(side,z,width,serial,regent?2:4,side*(front-.09));stats.frontages++;
 }
 function civic(side,z,width,index,serial){
   const h=18+hash(serial)*8;box('stone',side,12,h/2,z,19,h,width-.4);
   for(let y=4;y<h-1;y+=4)box('glass',side,11.90,y,z,.06,2.4,width-1.2);
   for(let q=-1;q<=1;q++)box('plaster',side,11.50,h/2,z+q*width*.31,.7,h,.65);
   box('plaster',side,11.35,h+.15,z,.95,.5,width+.1);
   source(side,z,width,serial,1);stats.frontages++;
 }
 function park(side,z,width,index,kind='park'){
   const river=kind==='riverdale',depth=river?70:42;
   if(river){
     // Adjacent 32 m cells meet without exposed vertical ends or concrete gaps.
     const joinedWidth=Math.min(width+1.2,2*(z+440),2*(620-z),...route.crossings.map(c=>2*(Math.abs(z-c.z)-11)));
     put('parkSlope',side*(10.95+depth/2),.21,z,depth,1.2,joinedWidth,side===1?0:Math.PI);stats.parkSlopes++;
     if(Math.round(z/32)%2===0){tree(side,z,20,1.3);tree(side,z+7,49,1.1);}
     box('stone',side,13,.25,z,1.15,.12,width-.3);
   }else{
     box('grass',side,10.95,.13,z,depth,.18,width-.15);
     tree(side,z-5,17.5,1.05);tree(side,z+6,31,1.2);
     box('stone',side,15,.25,z,1.25,.12,width-.5);
     box('timber',side,13.4,.65,z,1.15,.12,2.2);
     for(const zz of [z-.85,z+.85])box('metal',side,13.5,.4,zz,.12,.5,.12);
   }
   if(Math.round(z/32)%3===0)panel(side,z,1.7,2.5,.8,kind==='riverdale'?landmarkSigns.riverdale:landmarkSigns.regent,13.1);
   stats.frontages++;
 }
 function valley(side,z,width){
   box('grass',side,11.2,.11,z,105,.14,width-.1);
   box('blue',side,63,.20,z,11,.08,width-.2);
   box('metal',side,10.75,1.25,z,.14,.12,width-.2);
   box('metal',side,10.75,.65,z,.14,.09,width-.2);
   for(let k=-width/2+.6;k<width/2;k+=3.5)box('metal',side,10.77,.68,z+k,.13,1.36,.13);
   tree(side,z,35,.9);tree(side,z+7,88,1.25);stats.frontages++;
 }
 // +Z follows travel. Passenger right is -X: south along Dundas and east
 // along northbound Broadview. These placements use that travel-relative frame.
 const special=[
   {id:'ago',index:18.64,width:78,side:-1},
   {id:'hospital',index:15.55,width:64,side:1},
   {id:'square',index:23.58,width:88,side:-1},
   {id:'spectrum',index:28.875,width:74,side:-1},
   {id:'regent-park',index:29.55,width:106,side:1},
   {id:'library',index:33.28,width:25,side:1},
   {id:'station',index:38.30,width:35,side:-1},
 ];
 function buildSpecial(feature,z){
   const {id,side,width}=feature;landmarks.push({id,side,z,width,index:feature.index});
   if(id==='ago'){
     box('stone',side,13.3,1.15,z,20,2.3,width);
     box('timber',side,15.8,8,z,17,13.6,width-.4);
     for(let i=0;i<25;i++){
       const t=(i/24)*2-1,zz=z+t*width/2,front=11.8+2.1*t*t,ry=Math.atan(side*4.2*t/(width/2));
       box('glass',side,front,8.2,zz,.14,10.8,width/24+.04,ry);
       box('timber',side,front-.15,8.35,zz,.28,11.7,.19,ry);
       box('timber',side,front-.16,13.9,zz,1.3,.24,width/24+.08,ry);
     }
     panel(side,z,1.65,6.2,.85,landmarkSigns.ago,13.08);source(side,z,width,80,1,side*12.2);
   }else if(id==='hospital'){
     civic(side,z,width,feature.index,90);
     box('plaster',side,22,22,z,18,31,width*.65);
     box('glass',side,21.91,23,z,.08,23,width*.56);
     for(let y=13;y<37;y+=3.5)box('stone',side,21.7,y,z,.24,.21,width*.66);
     panel(side,z,5.0,8.0,1.35,landmarkSigns.hospital,11.3);
   }else if(id==='square'){
     box('stone',side,10.95,.24,z,42,.22,width);
     // Open southeast plaza, stepped terraces and a restrained screen wall.
     for(let j=0;j<3;j++)box('stone',side,28+j*3,.4+j*.26,z,3,.25,width*.68-j*6);
     box('metal',side,47,19,z,14,38,width-.3);
     box('glass',side,46.90,17,z,.08,30,width-3);
     panel(side,z,20,width*.72,12,landmarkSigns.square,46.65);
     for(const off of [-.35,.35]){box('metal',side,19,7.2,z+width*off,.45,14.4,.45);put('metal',side*20.5,14.2,z+width*off,3.8,.14,4.0);}
     for(const off of [-.30,0,.30]){box('timber',side,18,.68,z+width*off,1.2,.13,4);tree(side,z+width*off,37,.9);}
     panel(side,z,2.0,5.5,1,landmarkSigns.square,13.2);source(side,z,width,93,4,side*45);
   }else if(id==='spectrum'){
     box('stone',side,15,5.5,z,22,11,width);
     box('glass',side,14.9,4.7,z,.08,7.7,width-2);
     // Characteristic colourful, vertical fins on a contemporary arts podium.
     for(let j=0;j<16;j++)box(['red','blue','timber'][j%3],side,14.0,6.4,z-width/2+(j+.5)*width/16,1.2,9.5,.6);
     box('plaster',side,15,11.2,z,22,.4,width+.4);
     panel(side,z,2.1,8.2,1.1,landmarkSigns.spectrum,13.7);source(side,z,width,95,2,side*14.9);
   }else if(id==='regent-park'){
     for(let j=0;j<4;j++)park(side,z+(j-1.5)*width/4,width/4-.1,feature.index,'regent');
     panel(side,z,1.7,4.7,.9,landmarkSigns.regent,13.2);
   }else if(id==='library'){
     box('brick',side,13,5.8,z,15,11.6,width);
     put('gable',side*20.5,13.2,z,16,3.2,width+1);
     box('stone',side,12.65,5.7,z,.55,.6,width+.3);
     for(const zz of [z-8,z-4,z+4,z+8]){box('window',side,12.9,8.6,zz,.05,3.1,2);box('stone',side,12.7,10.25,zz,.4,.25,2.6);}
     box('glass',side,12.8,2.4,z,.06,4.4,3.4);
     for(const edge of [-1,1])box('stone',side,12.55,6,z+edge*(width/2-.5),.7,11.8,.65);
     panel(side,z,5.7,6.4,.8,landmarkSigns.library,12.32);source(side,z,width,97,1,side*12.8);
   }else if(id==='station'){
     box('brick',side,12.4,3.1,z,20,6.2,width);
     box('glass',side,12.3,2.4,z,.06,4.2,width-3);
     for(const off of [-.35,0,.35])box('metal',side,12.15,2.6,z+width*off,.3,5.2,.3);
     box('roof',side,10.8,5.9,z,23,.3,width+1.4);
     panel(side,z,5.3,9.5,.88,landmarkSigns.station,10.58);
     for(const off of [-.43,.43]){box('metal',side,10.9,2.6,z+width*off,.22,5.2,.22);box('red',side,10.75,4.85,z+width*off,.45,.48,.45);}
     source(side,z,width,99,0,side*12.3);
   }
 }
 function background(){
   for(const cross of route.crossings)for(const side of [-1,1])for(const end of [-1,1])for(let rank=0;rank<3;rank++){
     const z=cross.z+end*25,index=dundasIndexAtZ(route,z),district=dundasDistrictAt(index),x=side*(36+rank*30);
     if(district.id==='don'||district.id==='riverdale'&&side===1||district.id==='bellwoods'&&side===-1&&index<13.1)continue;
     const h=district.height*(.65+hash(index*13+rank+side)*.7),w=21;
     put(['core','regent','culture'].includes(district.id)?'stone':'brick',x,h/2,z,w,h,18);
     put('roof',x,h+.13,z,w+.4,.25,18.4);
     const facing=cross.z-z<0?-1:1;
     for(let y=3;y<h-.7;y+=4)put(rank%2?'window':'glass',x,y,z+facing*9.08,w-1.5,1.9,.04);
   }
   for(const side of [-1,1])for(let k=0;k<5;k++){
     const z=-360+k*205,index=dundasIndexAtZ(route,z),district=dundasDistrictAt(index);
     if(!clear(z,25))continue;
     const parkView=district.id==='riverdale'&&side===1;if(parkView)continue;
     const high=['core','regent'].includes(district.id)||parkView;
     const h=high?30+hash(index+k)*38:11+hash(k+side)*13;
     const x=side*(parkView?103:82+hash(k)*22);
     put('stone',x,h/2,z,18,h,24);put('glass',x-side*9.05,h/2,z,.06,h-2,21);
   }
   // One distant skyline grouping is aligned with the visible west-side park.
   // A single CN-like silhouette is sufficient; never repeat it per park cell.
   const parkZones=zones.filter(z=>z.id==='riverdale'&&z.side===1);
   if(parkZones.length){
     const anchor=parkZones[Math.floor(parkZones.length/2)].z;
     for(let j=0;j<6;j++){
       const z=anchor+(j-2.5)*19;if(!clear(z,14))continue;
       const h=27+hash(j+35)*26;put('skyline',88+j*5,h/2,z,11+hash(j)*6,h,14);
     }
     put('skyline',127,34,anchor,1.05,68,1.05);put('skyline',127,54,anchor,5.7,3.1,5.7);put('skyline',127,74,anchor,.32,22,.32);stats.skylineTowers=1;
   }
 }
 function setRoute(){
   group.visible=route.id==='dundas';stats.rebuilds++;
   if(!group.visible)return;
   for(const p of pools.values())p.count=0;
   displays.length=zones.length=landmarks.length=0;sourceSerial=0;
   stats.overflow=stats.frontages=stats.trees=stats.windowFrames=stats.facadeDetails=stats.parkSlopes=stats.skylineTowers=0;
   const activeFeatures=special.map(f=>({...f,z:localZ(f.index)})).filter(f=>clear(f.z,f.width));
   let serial=0;
   for(const side of [-1,1])for(let slot=0;slot<33;slot++){
     const z=-424+slot*32,width=30.8;if(!clear(z,width))continue;
     const index=dundasIndexAtZ(route,z),district=dundasDistrictAt(index);
     if(activeFeatures.some(f=>f.side===side&&Math.abs(z-f.z)<(width+f.width)/2+1))continue;
     zones.push({id:district.id,name:district.name,side,z,width,index});
     if(district.id==='don')valley(side,z,width);
     else if(district.id==='riverdale'&&side===1)park(side,z,width,index,'riverdale');
     else if(district.id==='bellwoods'&&side===-1&&index<13.1)park(side,z,width,index,'bellwoods');
     else if(['core','regent'].includes(district.id))modern(side,z,width,district,index,serial++);
     else if(district.id==='culture')civic(side,z,width,index,serial++);
     else{
       const pieces=district.id==='west'?2:3;
       for(let j=0;j<pieces;j++){
         const w=width/pieces,zz=z+(j-(pieces-1)/2)*w;
         const h=district.height-1+hash(serial+index)*3.2;
         if(district.id==='west')loft(side,zz,w,district,index,serial++);
         else if(['riverdale','terminal'].includes(district.id)||district.id==='garden'&&serial%3!==0)house(side,zz,w,h,district,index,serial++);
         else shop(side,zz,w,h,district,index,serial++);
       }
     }
   }
   for(const feature of activeFeatures)buildSpecial(feature,feature.z);
   background();
   stats.instances=stats.triangles=0;
   for(const p of pools.values()){
     p.mesh.count=p.count;p.mesh.instanceMatrix.needsUpdate=true;
     stats.instances+=p.count;stats.triangles+=p.count*p.triangles;
   }
   signRegions.needsUpdate=true;stats.meshes=pools.size;stats.sources=displays.length;
   stats.activeZones=[...new Set(zones.map(z=>z.id))];stats.landmarks=landmarks.map(f=>f.id);
 }
 function setNight(amount){const value=THREE.MathUtils.clamp(amount,0,1);for(const {material,power} of nightMaterials)material.emissiveIntensity=power*value;}
 setNight(0);setRoute();
 return {group,setRoute,setNight,stats,displays,get zones(){return zones;},get landmarks(){return landmarks;}};
}
