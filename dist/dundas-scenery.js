import * as THREE from 'three';
import {DUNDAS_DISTRICTS,dundasDistrictAt,dundasIndexAtZ} from './dundas-districts.js';
import {shopLighting} from './night-windows.js';
import {createDundasRetail,dundasShopType} from './dundas-retail.js';
import {createDundasFacades} from './dundas-facades.js';
import {facadeRectangles,windowGeometries,WINDOW_DEPTH} from './facade-windows.js';

// A complete resident 505 streetscape, reusing the same GPU buffers at every
// section change. Districts change both massing and street-level objects.
export function createDundasScenery({scene,route,mats,foliage,streetProps,architecturalAssets}){
 const group=new THREE.Group();group.name='505_Dundas_District_Streetscape';scene.add(group);
 const boxGeometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const pools=new Map(),displays=[],zones=[],landmarks=[],frontages=[],nightMaterials=[],facadeWindows=[];let sourceSerial=0,officeFinish=0;
 const officeColours=[new THREE.Color(0xd8e7f2),new THREE.Color(0xe1e6d5),new THREE.Color(0xd6c2a3)];
 const stats={meshes:0,instances:0,triangles:0,capacityTriangles:0,atlasPixels:1024*1024,overflow:0,frontages:0,trees:0,sources:0,rebuilds:0,windowFrames:0,facadeDetails:0,parkSlopes:0,skylineTowers:0,activeZones:[],landmarks:[]};
 const material=(name,colour,roughness=.85,metalness=0)=>{
   const m=new THREE.MeshStandardMaterial({color:colour,roughness,metalness});m.name='Dundas_'+name;mats['dundas'+name]=m;return m;
 };
 // Shared masonry receives the full bump/roughness/weathering treatment in
 // finishSurfaces(), including world-sized UVs for these instanced boxes.
 const sharedGlass=mats.glass||material('Glass',0x49616b,.27,.28);
 const materials={
   brick:mats.brick0||material('Brick',0x985f4a),buff:mats.brick2||material('BuffBrick',0xb49b75),
   warmBrick:mats.brick1,darkBrick:mats.brick3,greyBrick:mats.brick4,
   plaster:material('Plaster',0xc8bda5),stone:material('Stone',0xaaa89b),
   timber:material('Timber',0x96734e),metal:material('Metal',0x3b4846,.7,.32),
   roof:material('Roof',0x4d504b),glass:material('CurtainGlass',0x49616b,.27,.28),
   window:sharedGlass,display:material('Display',0xc8b99b,.4,.1),
   red:material('Red',0x974c42),green:material('Green',0x4e6c58),
   grass:mats.parkGrass||material('Grass',0x71835a),blue:material('Blue',0x4d747d,.54,.14),
 };
 if(mats.display0?.map){materials.display.map=mats.display0.map;materials.display.emissiveMap=mats.display0.map;}
 const leaf=material('Leaf',0x75905b);leaf.map=foliage.map;leaf.alphaTest=.45;leaf.side=THREE.DoubleSide;leaf.shadowSide=THREE.FrontSide;leaf.vertexColors=true;
 materials.display.emissive.setHex(0xffc48a);nightMaterials.push({material:materials.display,power:.18});
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
 const capacities={brick:600,buff:300,warmBrick:300,darkBrick:300,greyBrick:300,plaster:500,stone:3600,timber:480,metal:3200,roof:360,glass:1100,window:2100,display:220,red:1500,green:1500,grass:170,blue:1600};
 for(const [name,capacity] of Object.entries(capacities))pool(name,boxGeometry,materials[name],capacity,!['glass','window','display','grass'].includes(name));
 const wallGeometry=new THREE.PlaneGeometry(1,1);wallGeometry.rotateY(-Math.PI/2);
 for(const kind of ['brick','buff','warmBrick','darkBrick','greyBrick','plaster','stone'])pool('wall_'+kind,wallGeometry,materials[kind],kind==='stone'?4800:kind==='brick'?3400:2400);
 // More, smaller leaf clumps preserve Queen's leaf scale and branching crown.
 const crownGeometry=foliage.geometry.clone();crownGeometry.setIndex(Array.from(foliage.geometry.index.array).filter((_,i)=>Math.floor(i/6)%2===0));
 pool('leaf',crownGeometry,leaf,260,false);
 pool('branch',new THREE.CylinderGeometry(1,1,1,7),mats.bark||materials.timber,300);
 pool('office',boxGeometry,mats.officeFacade,660,false);
 pool('cream',boxGeometry,mats.paintedCream,1400);
 pool('charcoal',boxGeometry,material('Charcoal',0x293635,.64,.1),1200);
 pool('canvas',boxGeometry,material('Canvas',0xe2d5b8,.96),1300,false);
 for(let style=0;style<7;style++){
   pool('roomWall'+style,boxGeometry,style===0?mats.shopInteriorWall:mats['shopWall'+style],150,false);
   pool('roomCeiling'+style,boxGeometry,style===0?mats.shopInteriorCeiling:mats['shopCeiling'+style],70,false);
   pool('roomStrip'+style,boxGeometry,mats['shopStrip'+style],70,false);
 }
 const glazingGeometry=new THREE.PlaneGeometry(1,1),glazingMaterial=mats.storeGlass.clone();
 glazingMaterial.name='Dundas_Thin_Store_Glazing';mats.dundasStoreGlass=glazingMaterial;
 pool('glazing',glazingGeometry,glazingMaterial,100,false);pools.get('glazing').mesh.renderOrder=2;
 const gableGeometry=new THREE.BufferGeometry();
 const roofVertices=[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,0],[.5,-.5,-.5],[.5,-.5,.5],[.5,.5,0]];
 const roofIndices=[0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3];
 gableGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roofVertices.flat(),3));gableGeometry.setIndex(roofIndices);gableGeometry.computeVertexNormals();pool('gable',gableGeometry,materials.roof,140);
 // A single reusable chamfered reveal is substantially cheaper than separate
 // jamb/lintel boxes. The outer edge meets masonry; the jambs return inward
 // to glazing 24 cm behind the wall, without invisible back polygons.
 const windowKit=windowGeometries();pool('frame',windowKit.reveal,materials.stone,3200);
 pool('recessPane',windowKit.pane,sharedGlass,3200,false);
 pool('recessSash',windowKit.sash,materials.metal,3200);
 pool('hardware',boxGeometry,mats.steel||materials.metal,150,false);
 // A gently rising turf prism joins adjacent park cells exactly, replacing
 // visibly raised rectangular grass blocks. One geometry serves every slope.
 const parkProfile=[new THREE.Vector2(-.5,-.10),new THREE.Vector2(.5,-.10),new THREE.Vector2(.5,.9),new THREE.Vector2(.15,.9),new THREE.Vector2(-.38,0),new THREE.Vector2(-.5,0)];
 const parkShape=new THREE.Shape(parkProfile),slopeGeometry=new THREE.ExtrudeGeometry(parkShape,{depth:1,bevelEnabled:false,steps:1});slopeGeometry.translate(0,0,-.5);pool('parkSlope',slopeGeometry,materials.grass,36,false);
 pool('skyline',boxGeometry,mats.skyline||materials.stone,24,false);
 const retail=createDundasRetail({group,mats,assets:streetProps,foliageGeometry:crownGeometry}),facades=createDundasFacades({group,mats,assets:architecturalAssets});

 // One local atlas serves every shop and landmark; panels are static and mildly
 // emissive at night. No animation, photoreal people, or high-glare screen loops.
 const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const ctx=atlas.getContext('2d');
 const signTexture=new THREE.CanvasTexture(atlas);signTexture.colorSpace=THREE.SRGBColorSpace;signTexture.anisotropy=4;
 const signMaterial=material('Signs',0xffffff,.68);signMaterial.map=signTexture;signMaterial.emissive.setHex(0xffd4a1);
 signMaterial.emissiveMap=signTexture;nightMaterials.push({material:signMaterial,power:.26});
 const signGeometry=new THREE.PlaneGeometry(1,1),signRegions=new THREE.InstancedBufferAttribute(new Float32Array(240*4),4);signRegions.setUsage(THREE.DynamicDrawUsage);signGeometry.setAttribute('signRegion',signRegions);
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
 pool('sign',signGeometry,signMaterial,240,false);
 const signEntries=[],signPanels=[],signCache=new Map(),signColumns=[0,0];
 const palette={west:['#e6ddc3','#364b44'],portugal:['#fff0d1','#555e76'],bellwoods:['#efe8cf','#3f614e'],chinatown:['#ffe8b9','#943c32'],culture:['#ede7d4','#54483c'],core:['#e0e8e3','#314b58'],garden:['#efe4cd','#546052'],regent:['#eef0df','#4c6573'],don:['#e6e7d0','#3e5e4a'],riverside:['#f1e2bf','#6e483b'],riverdale:['#ece9d1','#4f6952'],terminal:['#f4e8d3','#9b3e37']};
 for(const district of DUNDAS_DISTRICTS)for(let j=0;j<2;j++)signEntries.push({text:district.shops[j],colors:palette[district.id],kind:'shop'});
 const landmarkSigns={ago:24,hospital:25,square:26,spectrum:27,library:28,station:29,regent:30,riverdale:31};
 [['ART GALLERY OF ONTARIO','GALLERIA ITALIA'],['TORONTO WESTERN','HOSPITAL'],['SANKOFA SQUARE','YONGE & DUNDAS'],['DANIELS SPECTRUM','ARTS & CULTURE'],['RIVERDALE LIBRARY','TORONTO PUBLIC LIBRARY'],['TTC BROADVIEW','SUBWAY / STREETCARS'],['REGENT PARK','GARDENS & COMMUNITY'],['RIVERDALE PARK','BROADVIEW AVENUE']].forEach(([text,sub])=>signEntries.push({text,sub,colors:['#eee8cf','#3a5352'],kind:'landmark'}));
 const muralCell=signEntries.length;signEntries.push({text:'',colors:['#eee5ce','#4c6c8b'],kind:'mural'});
 const shopLabels=new Map();
 function shopLabel(district,index,side){
   const type=dundasShopType(district.id,index,side),variant=index%2;
   const names={bookshelf:['PAPER & INK','DUNDAS BOOKS'],recordbin:['VINYL EXCHANGE','DUNDAS RECORDS'],coffeecounter:[district.id==='portugal'?'CAF\u00c9 PORTUGAL':'CORNER COFFEE','THE COFFEE ROOM'],bakerycase:[district.id==='portugal'?'PADARIA':'DUNDAS BAKERY','BREAD & BUTTER'],grocerstand:['NEIGHBOURHOOD MARKET',district.id==='chinatown'?'\u6c34\u679c\u852c\u83dc / PRODUCE':'FRESH MARKET'],floriststand:['CITY FLOWERS','FLORES & GARDEN'],bicycle:['DUNDAS CYCLE','CYCLE WORKSHOP'],hardware:['DUNDAS HARDWARE','THE WORKSHOP']};
   const text=names[type][variant],key=district.id+'|'+text;
   if(!shopLabels.has(key)){shopLabels.set(key,signEntries.length);signEntries.push({text,colors:palette[district.id],kind:'shop',serif:['bookshelf','bakerycase'].includes(type)});}
   return shopLabels.get(key);
 }
 // Rasterise each label at the aspect of its physical plaque. A shared canvas
 // and fixed instance buffers are repainted, never reallocated, between sections.
 function signArt(cell,width,height){
   const key=cell+'|'+(width/height).toFixed(5);if(signCache.has(key))return signCache.get(key);
   const entry=signEntries[cell],pixelWidth=508,pixelHeight=pixelWidth*height/width;
   const col=signColumns[0]<=signColumns[1]?0:1,allocation=Math.ceil(pixelHeight)+4;
   if(!entry||signColumns[col]+allocation>1024){stats.overflow++;stats.overflows.signAtlas=(stats.overflows.signAtlas||0)+1;return null;}
   const x=col*512+2,y=signColumns[col]+2;signColumns[col]+=allocation;
   ctx.save();ctx.translate(x,y);ctx.fillStyle=entry.colors[1];ctx.fillRect(-2,-2,pixelWidth+4,pixelHeight+4);ctx.beginPath();ctx.rect(0,0,pixelWidth,pixelHeight);ctx.clip();
   let fontSize=0,fontWidth=0,fontPixelHeight=0;
   if(entry.kind==='mural'){
     ctx.fillStyle='#eee5ce';ctx.fillRect(0,0,pixelWidth,pixelHeight);
     const tile=pixelWidth/7;for(let row=0;row<Math.ceil(pixelHeight/tile);row++)for(let c=0;c<7;c++){
       const xx=c*tile,yy=row*tile;ctx.fillStyle='#55778c';ctx.fillRect(xx+3,yy+3,tile-6,tile-6);
       ctx.fillStyle='#e7dfc8';ctx.fillRect(xx+tile*.2,yy+tile*.2,tile*.6,tile*.6);
       ctx.fillStyle=(row+c)%2?'#739198':'#47647a';ctx.fillRect(xx+tile*.35,yy+tile*.35,tile*.3,tile*.3);
     }
   }else{
     const inset=Math.max(3,pixelHeight*.12);ctx.strokeStyle=entry.colors[0]+'99';ctx.lineWidth=Math.max(.8,pixelHeight*.022);
     ctx.strokeRect(inset,inset,pixelWidth-inset*2,pixelHeight-inset*2);
     const subtitle=entry.sub&&pixelHeight>70;
     fontSize=pixelHeight*(subtitle ? .37 : .53);
     const font=n=>`600 ${n}px ${entry.serif?'Georgia,serif':'"Microsoft YaHei","Noto Sans CJK SC",Arial,sans-serif'}`;
     ctx.font=font(fontSize);
     while(ctx.measureText(entry.text).width>pixelWidth-inset*3){fontSize*=.96;ctx.font=font(fontSize);}
     const metrics=ctx.measureText(entry.text);fontWidth=metrics.width;fontPixelHeight=metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent;
     ctx.fillStyle=entry.colors[0];ctx.textAlign='center';ctx.textBaseline='alphabetic';
     const center=pixelHeight*(subtitle ? .40 : .5);ctx.fillText(entry.text,pixelWidth/2,center+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2);
     if(subtitle){ctx.font=`${pixelHeight*.13}px Arial,sans-serif`;ctx.textBaseline='middle';ctx.fillText(entry.sub,pixelWidth/2,pixelHeight*.76);}
   }
   ctx.restore();
   const art={entry,pixelWidth,pixelHeight,fontSize,fontWidth,fontPixelHeight,region:[x/1024,1-(y+pixelHeight)/1024,pixelWidth/1024,pixelHeight/1024]};
   signCache.set(key,art);return art;
 }

 function put(name,x,y,z,sx,sy,sz,ry=0,rz=0){
   const p=pools.get(name);if(p.count>=p.capacity){stats.overflow++;stats.overflows[name]=(stats.overflows[name]||0)+1;return -1;}
   dummy.position.set(x,y,z);dummy.rotation.set(0,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();p.mesh.setMatrixAt(p.count,dummy.matrix);if(name==='office')p.mesh.setColorAt(p.count,officeColours[officeFinish]);return p.count++;
 }
 function box(name,side,front,y,z,depth,height,width,ry=0){return put(name,side*(front+depth/2),y,z,depth,height,width,ry);}
 function panel(side,z,y,width,height,cell,front=11.52,projecting=false){
   const art=signArt(cell,width,height);if(!art)return;
   const i=put('sign',side*front,y,z,width,height,1,projecting?0:-side*Math.PI/2);if(i<0)return;
   signRegions.setXYZW(i,...art.region);
   signPanels.push({index:i,text:art.entry.text,width,height,region:art.region,pixelWidth:art.pixelWidth,pixelHeight:art.pixelHeight,fontSize:art.fontSize,fontWidth:art.fontWidth,fontPixelHeight:art.fontPixelHeight,kind:art.entry.kind});
 }
 function shopSign(side,z,y,width,cell,front,paint='charcoal'){
   box(paint,side,front+.02,y,z,.13,.72,width);
   box('cream',side,front-.015,y+.37,z,.18,.065,width+.06);
   box('charcoal',side,front-.015,y-.37,z,.18,.065,width+.06);
   panel(side,z,y,Math.min(5.8,width-.24),.54,cell,front-.04);
 }

 function source(side,z,width,index,style=0,windowX=side*11.6,lighting=null){
   const colors=[0xffca8b,0xf8dec0,0xd8e7dd,0xffb988,0xaec9d3,0xffd697];
   displays.push({side,z,width,windowX,backX:windowX+side*2.5,index:sourceSerial++,lighting:lighting||{style,color:colors[style%6],power:.72+(index%4)*.12}});
 }
 const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
 const clear=(z,width=0)=>z-width/2>=-440&&z+width/2<=620&&!route.crossings.some(c=>Math.abs(z-c.z)<11+width/2);
 const localZ=index=>-124+(index-route.stopOffset)*200;
 const closeDetail=z=>z>-240&&z<380;
 const branchAxis=new THREE.Vector3(0,1,0),branchVector=new THREE.Vector3(),branchMid=new THREE.Vector3();
 function twig(a,b,r){
   const p=pools.get('branch');if(p.count>=p.capacity){stats.overflow++;return;}
   branchVector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=branchVector.length();
   branchMid.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);dummy.position.copy(branchMid);
   dummy.quaternion.setFromUnitVectors(branchAxis,branchVector.normalize());dummy.scale.set(r,length,r);dummy.updateMatrix();p.mesh.setMatrixAt(p.count++,dummy.matrix);
 }
 function register(kind,side,z,width,height,front,depth,index,district,openings=[],room=null){
   const frontage={kind,side,z,width,height,front,depth,index,district:district.id,shopStyle:index%4,windowStyle:index%4,windows:openings,room,lighting:shopLighting(index)};
   frontages.push(frontage);return frontage;
 }
 function roomShell(side,z,width,front,lighting){
   const back=front+2.3,style=lighting.style;
   box('roomWall'+style,side,back-.09,1.74,z,.09,2.62,width+.10);
   box('stone',side,front,.34,z,2.3,.08,width+.08);
   box('roomCeiling'+style,side,front,3.12,z,2.3,.10,width+.08);
   for(const edge of [-1,1])box('roomWall'+style,side,front,1.74,z+edge*(width/2-.04),2.3,2.62,.08);
   box('roomStrip'+style,side,front+.03,3.02,z,.035,.025,width*.90);
   box('timber',side,back-.14,.51,z,.14,.25,width-.14);
   if(style===3)for(const offset of [-.26,.26]){
     box('timber',side,back-.15,2.08,z+offset*width,.055,.78,.64);
     box('canvas',side,back-.185,2.08,z+offset*width,.018,.66,.52);
     box('blue',side,back-.20,2.14,z+offset*width,.014,.23,.30);
   }
   put('glazing',side*(front-.085),1.72,z,width,2.45,1,-side*Math.PI/2);
   return {z,width,front,back,lighting};
 }
 function groundInfill(name,side,z,width,front,openings){
   // Cut only the actual display and entrance portals out of the front wall.
   // The remaining piers close the ground floor around each furnished bay.
   let edge=z-width/2+.07;const end=z+width/2-.07;
   for(const opening of [...openings].sort((a,b)=>a.z-b.z)){
     const left=Math.max(edge,opening.z-opening.width/2),right=Math.min(end,opening.z+opening.width/2);
     if(left-edge>.01)box(name,side,front,1.72,(edge+left)/2,2.3,3.06,left-edge);
     edge=Math.max(edge,right);
   }
   if(end-edge>.01)box(name,side,front,1.72,(edge+end)/2,2.3,3.06,end-edge);
 }
 function frame(side,front,y,z,width,height){put('frame',side*front,y,z,1,height,width,side===1?0:Math.PI);stats.windowFrames++;}
 function recessedWindow(side,front,y,z,width,height){
   insetPane(side*front,y,z,width,height,side===1?0:Math.PI);
   return {y,z,width,height};
 }
 function insetPane(x,y,z,width,height,rotation){
   for(const kind of ['frame','recessPane','recessSash'])put(kind,x,y,z,1,height,width,rotation);
   stats.windowFrames++;facadeWindows.push({x,y,z,width,height,rotation,depth:WINDOW_DEPTH});
 }
 function masonryFace(kind,side,front,z,width,bottom,top,openings){
   for(const r of facadeRectangles(width,bottom,top,openings.map(w=>({...w,u:w.z-z}))))put('wall_'+kind,side*front,(r.bottom+r.top)/2,z+(r.left+r.right)/2,1,r.top-r.bottom,r.right-r.left,side===1?0:Math.PI);
   for(const edge of [-1,1])box(kind,side,front+.001,(bottom+top)/2,z+edge*(width/2-.02),WINDOW_DEPTH,top-bottom,.04);
 }
 function masonryEnds(kind,side,front,z,width,depth,bottom,top,layout=null){
   const holes=layout||[];
   if(!layout)for(let y=5.2;y+1.1<top;y+=2.9)holes.push({u:0,y,width:1.35,height:1.95});
   for(const edge of [-1,1]){
     const endZ=z+edge*width/2,rotation=edge*Math.PI/2;
     for(const r of facadeRectangles(depth,bottom,top,holes))put('wall_'+kind,side*(front+depth/2+(r.left+r.right)/2),(r.bottom+r.top)/2,endZ,1,r.top-r.bottom,r.right-r.left,rotation);
     for(const w of holes)insetPane(side*(front+depth/2+w.u),w.y,endZ,w.width,w.height,rotation);
   }
 }
 function tree(side,z,front=15,size=1){
   if(!clear(z,6*size)||stats.trees>=40)return;
   const x=side*front;
   twig([x,.18,z],[x,3.5*size,z],.10*size);
   for(let j=0;j<6;j++){
     const a=j*2.4,dx=Math.sin(a)*1.02*size,dz=Math.cos(a)*1.02*size,y=(3.35+(j%3)*.36)*size;
     twig([x,2.15*size,z],[x+dx,y,z+dz],.034*size);
     const radius=(.80+hash(j+z)*.21)*size;
     put('leaf',x+dx,y+.62*size,z+dz,radius,radius*1.03,radius*1.08);
   }
   stats.trees++;
 }
 function windows(side,z,width,height,kind='window',front=11.56,floors=2,columns=2,style=0){
   const openings=[],count=Math.max(columns,Math.floor((width-.8)/2.65)),pitch=(width-.9)/count;
   const levels=Math.min(floors,Math.max(1,Math.round((height-3.7)/2.9))),rise=(height-3.7)/levels;
   const paneWidth=Math.min([1.22,1.42,1.58,1.30][style%4],pitch-.55),paneHeight=Math.min([1.90,1.78,2.02,1.88][style%4],rise-.40);
   for(let level=0;level<levels;level++){
     const y=3.7+rise*(level+.5);
     for(let col=0;col<count;col++){
       const zz=z+(col-(count-1)/2)*pitch;
       openings.push(recessedWindow(side,front,y,zz,paneWidth+.14,paneHeight+.14));
       if(closeDetail(z)){
         box(style===3?'timber':'stone',side,front-.15,y-paneHeight/2-.09,zz,.30,.12,paneWidth+.23);
         // Straight soldier-course/stone lintels vary by frontage; all follow
         // the actual aperture instead of floating decorative arch segments.
         if(style!==2)box(style===0?'buff':'stone',side,front-.09,y+paneHeight/2+.13,zz,.20,.14,paneWidth+.28);
       }
     }
     if(closeDetail(z)&&style===1)box('stone',side,front-.02,y-paneHeight/2-.23,z,.16,.08,width-.28);
   }
   return openings;
 }

 function roof(side,z,width,height,depth,gabled=false){
   if(gabled)put('gable',side*(11.75+depth/2),height+.86,z,depth+1,1.8,width+.4);
   else box('roof',side,11.55,height+.14,z,depth+.35,.25,width+.22);
 }
 function shop(side,z,width,height,district,index,serial,front=11.75){
   const pick=hash(serial*7+index),brickName=district.id==='portugal'?(pick<.25?'plaster':pick<.5?'warmBrick':pick<.75?'brick':'buff'):['brick','warmBrick','buff','darkBrick','greyBrick'][serial%5];
   const depth=8+hash(serial)*4,lighting=shopLighting(serial),detailed=closeDetail(z),hasRoom=detailed&&serial%2===0,shopStyle=serial%4,trim=['green','cream','charcoal','blue'][shopStyle];
   const displayZ=z-width*.12,displayWidth=Math.min(4.9,width*.57),doorZ=z+width*.34,doorWidth=1.08;
   let room=null;
   if(hasRoom){
     box(brickName,side,front+WINDOW_DEPTH,(height+3.25)/2,z,depth-WINDOW_DEPTH,height-3.25,width-.14-WINDOW_DEPTH*2);
     box(brickName,side,front+2.3,1.62,z,depth-2.3,3.25,width-.14-WINDOW_DEPTH*2);
     for(const edge of [-1,1])box(brickName,side,front,1.62,z+edge*(width/2-.18),2.3,3.25,.22);
     room=roomShell(side,displayZ,displayWidth,front,lighting);
     groundInfill(brickName,side,z,width,front,[{z:displayZ,width:displayWidth},{z:doorZ,width:doorWidth}]);
   }else{
     box(brickName,side,front+WINDOW_DEPTH,height/2+.18,z,depth-WINDOW_DEPTH,height,width-.14-WINDOW_DEPTH*2);
     recessedWindow(side,front,1.63,displayZ,displayWidth+.14,2.48);
   }
   roof(side,z,width-.12,height,depth,false);
   box('stone',side,front-.30,height-.04,z,.52,.19,width+.08);
   box('stone',side,front-.16,height-.40,z,.30,.12,width-.15);

   box('glass',side,front-.27,1.54,doorZ,.045,2.52,doorWidth);
   for(const edge of [-1,1])box(trim,side,front-.33,1.6,z+edge*(width/2-.2),.18,2.9,.17);
   box(trim,side,front-.28,3.08,z,.24,.22,width-.25);
   const mural=district.id==='portugal'&&serial%5===0;
   const openings=windows(side,z,width,height,serial%3?'window':'glass',front,3,2,serial%4);
   masonryFace(brickName,side,front,z,width-.14,hasRoom?3.25:.18,hasRoom?height:height+.18,[...openings,...(hasRoom?[]:[{z:displayZ,y:1.63,width:displayWidth+.14,height:2.48},{z:doorZ,y:1.54,width:doorWidth,height:2.52}])]);
   masonryEnds(brickName,side,front,z,width-.14,depth,.18,height);
   if(detailed){
     frame(side,front-.27,1.54,doorZ,doorWidth+.18,2.70);
     box('stone',side,front-.43,.20,doorZ,.55,.14,doorWidth+.24);
     box(trim,side,front-.13,1.72,displayZ,.10,2.48,.065);
     for(const edge of [-1,1])box(trim,side,front-.13,1.72,displayZ+edge*(displayWidth/2-.04),.10,2.48,.065);
     box('stone',side,front-.18,.43,displayZ,.28,.18,displayWidth+.16);
     box(trim,side,front-.13,2.57,displayZ,.11,.075,displayWidth);
     box(trim,side,front-.16,.57,displayZ,.13,.20,displayWidth-.08);
     box(trim,side,front-.13,2.96,displayZ,.12,.12,displayWidth+.10);
     put('hardware',side*(front-.38),1.42,doorZ-doorWidth*.30,.045,.28,.045);stats.facadeDetails+=8;
   }
   const signCell=shopLabel(district,serial,side);
   shopSign(side,z,3.50,width-.55,signCell,front-.35,trim);
   const shade=district.id==='chinatown'?'red':district.id==='portugal'?(serial%2?'blue':'green'):serial%3?'green':'red';
   if(shopStyle!==2&&pick<.88){
     const awningWidth=shopStyle===3?displayWidth+.28:width-.6,stripes=shopStyle===0?1:Math.ceil(awningWidth/.85);
     const awningCenter=shopStyle===3?displayZ:z;
     for(let stripe=0;stripe<stripes;stripe++){
       const zz=awningCenter-awningWidth/2+(stripe+.5)*awningWidth/stripes,cloth=stripe%2?'canvas':shade;
       put(cloth,side*(front-.66),3.15,zz,1.12,.09,awningWidth/stripes-.018,0,side*.24);
       box(cloth,side,front-1.20,2.99,zz,.08,.20,awningWidth/stripes-.018);
     }
     if(detailed)for(const off of [-.38,.38]){put('metal',side*(front-.62),2.85,z+width*off,.055,.64,.055,0,-side*.75);stats.facadeDetails++;}
   }
   if(district.id==='portugal'){
     box('blue',side,front-.25,.52,z,.10,.30,width-.5);
     if(mural&&detailed)panel(side,z-width*.29,5.15,2.25,2.5,muralCell,front-.22);
   }
   register('shop',side,z,width,height,front,depth,serial,district,openings,room);
   source(side,hasRoom?displayZ:z,hasRoom?displayWidth:width,serial,lighting.style,side*(hasRoom?front-.085:front-.25),hasRoom?lighting:{...lighting,style:6,power:.02});stats.frontages++;
 }
 function house(side,z,width,height,district,index,serial){
   const depth=9.5,front=14.0,wall=serial%3?'brick':'buff';box(wall,side,front+WINDOW_DEPTH,height/2+.16,z,depth-WINDOW_DEPTH,height,width-.3-WINDOW_DEPTH*2);
   put('gable',side*(front+depth/2),height+1.15,z,depth+1,2.3,width-.1);
   const openings=windows(side,z,width,height,'window',front,2,2,(serial+2)%4);
   masonryFace(wall,side,front,z,width-.3,.16,height+.16,[...openings,{y:1.5,z:z-width*.27,width:1.1,height:2.45}]);
   masonryEnds(wall,side,front,z,width-.3,depth,.16,height+.16);
   box('stone',side,front-.6,.4,z,1.25,.55,width-.6);
   box('glass',side,front-.08,1.5,z-width*.27,.04,2.45,1.1);
   // Small bay windows and porches give the adapted houses a different depth.
   box('plaster',side,front-.75+WINDOW_DEPTH,1.6,z+width*.21,.85-WINDOW_DEPTH,2.25,width*.34);
   const bay=recessedWindow(side,front-.75,1.72,z+width*.21,width*.27+.14,1.79);
   masonryFace('plaster',side,front-.75,z+width*.21,width*.34,.475,2.725,[bay]);
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
   register('house',side,z,width,height,front,depth,serial,district,openings);
   source(side,z,width,serial,1,side*(front-.08));stats.frontages++;
 }
 function loft(side,z,width,district,index,serial){
   const h=11+Math.floor(hash(serial+index)*3)*3,depth=12,front=11.75,lighting=shopLighting(serial);
   const hasRoom=closeDetail(z)&&serial%2===0,displayWidth=Math.min(5.4,width*.66),displayZ=z-width*.10;
   let room=null;const openings=[],wall=serial%3?'brick':hasRoom?'darkBrick':'buff';
   if(hasRoom){
     box(wall,side,front+WINDOW_DEPTH,(h+3.25)/2,z,depth-WINDOW_DEPTH,h-3.25,width-.2-WINDOW_DEPTH*2);
     box('brick',side,front+2.3,1.62,z,depth-2.3,3.25,width-.2-WINDOW_DEPTH*2);
     for(const off of [-.48,.48])box('brick',side,front,1.62,z+width*off,2.3,3.25,.26);
     room=roomShell(side,displayZ,displayWidth,front,lighting);
   }else box(wall,side,front+WINDOW_DEPTH,h/2,z,depth-WINDOW_DEPTH,h,width-.2-WINDOW_DEPTH*2);
   roof(side,z,width,h,depth);
   for(let floor=0;floor<5&&3+floor*3<h;floor++){
     const y=2+floor*3;
     if(floor===0&&hasRoom){
       const doorZ=z+width*.36;box('glass',side,front-.13,1.65,doorZ,.055,2.55,1.08);frame(side,front-.11,1.65,doorZ,1.22,2.69);
       for(const zz of [z-width*.39,z+width*.18]){
         openings.push(recessedWindow(side,front,1.75,zz,1.79,2.34));
       }
       continue;
     }
     const columns=Math.max(4,Math.round(width/2.6)),pitch=(width-1.2)/columns;
     for(let col=0;col<columns;col++){
       const zz=z+(col-(columns-1)/2)*pitch,pane=Math.min(1.65,pitch-.42);
       openings.push(recessedWindow(side,front,y,zz,pane+.14,2.04));
       if(closeDetail(z)){
         box('stone',side,front-.15,y-1.09,zz,.30,.12,pane+.28);
       }
     }
   }
   masonryFace(wall,side,front,z,width-.2,0,h,[...openings,...(hasRoom?[{y:1.72,z:displayZ,width:displayWidth,height:2.60},{y:1.65,z:z+width*.36,width:1.08,height:2.55}]:[])]);
   masonryEnds(wall,side,front,z,width-.2,depth,0,h);
   box('stone',side,11.49,h-.3,z,.40,.38,width+.1);
   shopSign(side,displayZ,3.60,Math.min(width-.8,7.4),shopLabel(district,serial,side),front-.24);
   register('loft',side,z,width,h,front,depth,serial,district,openings,room);
   source(side,z,width,serial,lighting.style,side*(front-.1),hasRoom?lighting:{...lighting,style:6,power:.02});stats.frontages++;
 }
 function officeTower(side,z,width,front,depth,bottom,height,style=0,detailed=true){
   // Four glazed faces and a solid roof replace a single giant front pane.
   box('stone',side,front+.06,bottom+height/2,z,depth-.12,height,width-.12);
   box('office',side,front-.035,bottom+height/2,z,.03,height,width);
   box('office',side,front+depth+.005,bottom+height/2,z,.03,height,width);
   for(const edge of [-1,1])put('office',side*(front+depth/2),bottom+height/2,z+edge*(width/2+.025),depth,height,.03);
   box('roof',side,front-.10,bottom+height+.10,z,depth+.20,.22,width+.20);
   if(!detailed)return;
   for(const edge of [-1,1])box(style===1?'stone':'metal',side,front-.15,bottom+height/2,z+edge*(width/2-.12),.22,height,.18);
   if(style===2)for(let zz=z-width/2+2.9;zz<z+width/2-.8;zz+=2.9)box('stone',side,front-.32,bottom+height/2,zz,.36,height,.13);
   // Screened plant and a small roof service room give a useful silhouette.
   if(style!==1||height<7){box('metal',side,front+depth*.32,bottom+height+.65,z,depth*.40,1.1,width*.50);box('roof',side,front+depth*.30,bottom+height+1.23,z,depth*.44,.12,width*.54);}
 }
 function modern(side,z,width,district,index,serial){
   const regent=district.id==='regent',style=serial%3,h=9.9+(regent?5+Math.floor(hash(serial)*4):7+Math.floor(hash(serial)*7))*3.3,depth=17,front=regent?15:12;
   officeFinish=style;
   const lighting=shopLighting(serial),hasRoom=closeDetail(z)&&serial%2===0,displayZ=z-width*.25,displayWidth=5.2;
   let room=null;
   box('stone',side,front+WINDOW_DEPTH,6.60,z,depth-WINDOW_DEPTH,6.70,width-.35-WINDOW_DEPTH*2);
   box('stone',side,front+2.3,1.62,z,depth-2.3,3.25,width-.35-WINDOW_DEPTH*2);
   if(hasRoom)room=roomShell(side,displayZ,displayWidth,front,lighting);
   const entryZ=z+width*.24,entryWidth=2.25;
   const podiumOpenings=[...(room?[{z:displayZ,y:1.72,width:displayWidth,height:2.60}]:[]),{z:entryZ,y:1.66,width:entryWidth,height:2.80}];
   // Separate ground-floor bays, recessed lobby doors, canopy and door hardware.
   for(const q of [-.39,-.12,.10,.39]){
     const zz=z+width*q;if(Math.abs(zz-entryZ)<2||room&&Math.abs(zz-displayZ)<displayWidth/2+1.4)continue;
     podiumOpenings.push(recessedWindow(side,front,1.72,zz,3.40,2.80));
   }
   masonryFace('stone',side,front,z,width-.35,0,3.25,podiumOpenings);
   box('glass',side,front+.12,1.66,entryZ,.04,2.80,entryWidth);
   for(const off of [-1,0,1])box('metal',side,front-.06,1.66,entryZ+off*entryWidth/2,.16,2.91,.06);
   for(const off of [-.16,.16])box('hardware',side,front-.10,1.42,entryZ+off,.09,.35,.035);
   box('metal',side,front-1.3,3.32,entryZ,1.55,.13,4.1);
   box('cream',side,front-1.28,3.24,entryZ,1.48,.025,3.85);
   box('stone',side,front-.55,.25,entryZ,.80,.14,2.65);
   const upperOpenings=[],bayCount=Math.max(3,Math.round((width-.95)/3.3)),bayPitch=(width-.95)/bayCount;
   for(const y of [5.25,8.55]){
     for(let i=0;i<bayCount;i++)upperOpenings.push(recessedWindow(side,front,y,z+(i-(bayCount-1)/2)*bayPitch,bayPitch-.18,2.74));
     box('stone',side,front-.20,y-1.40,z,.30,.18,width-.40);
   }
   masonryFace('stone',side,front,z,width-.35,3.25,9.95,upperOpenings);
   // Return the glazing and floor courses around exposed intersection walls.
   const sideOpenings=[];for(const y of [1.72,5.25,8.55])for(const u of [-depth*.28,0,depth*.28])sideOpenings.push({u,y,width:2.80,height:2.60});
   masonryEnds('stone',side,front,z,width-.35,depth,0,9.95,sideOpenings);
   for(const edge of [-1,1]){
     for(const y of [3.3,6.6,9.9])put('stone',side*(front+depth/2),y,z+edge*(width/2-.10),depth,.16,.22);
   }
   const towerW=width*(style===1?.60:.72),towerFront=front+(style===2?4:5.5),towerDepth=style===1?14:12;
   const crown=style===1?6.6:0;
   officeTower(side,z+width*.04,towerW,towerFront,towerDepth,9.9,h-9.9-crown,style,closeDetail(z));
   if(crown)officeTower(side,z+width*.10,towerW*.80,towerFront+1.5,towerDepth-3,h-crown,crown,style,closeDetail(z));
   if(regent){
     for(let y=13.2;y<h-1;y+=3.3)box('stone',side,towerFront-.65,y,z+width*.04,.8,.17,towerW+.25);
     tree(side,z+width*.34,12.6,.75);box('grass',side,11.0,.3,z,2.8,.3,width-.4);
   }else if(style===0&&closeDetail(z)){
     box('stone',side,front+.6,10.10,z+width*.31,3.4,.38,width*.20);
     box('grass',side,front+.72,10.31,z+width*.31,3.16,.045,width*.20-.24);
     box('metal',side,front+.25,10.85,z,.06,.055,width-.8);
     for(let zz=z-width/2+1;zz<z+width/2;zz+=3.2)box('metal',side,front+.25,10.43,zz,.055,.84,.055);
   }
   if(room)shopSign(side,displayZ,3.65,6.1,shopLabel(district,serial,side),front-.23);
   register('modern',side,z,width,h,front,depth,serial,district,[],room);
   source(side,room?displayZ:entryZ,room?displayWidth:entryWidth,serial,lighting.style,side*(front-.09),hasRoom?lighting:{...lighting,style:6,power:.02});stats.frontages++;
 }

 function civic(side,z,width,index,serial){
   officeFinish=1;
   const h=18+hash(serial)*8;box('stone',side,12+WINDOW_DEPTH,h/2,z,19-WINDOW_DEPTH,h,width-.4-WINDOW_DEPTH*2);
   const openings=[],sideOpenings=[],columns=Math.max(3,Math.round((width-1.2)/3.3)),pitch=(width-1.2)/columns;
   for(let y=4;y+1.35<h;y+=3.6){
     for(let i=0;i<columns;i++)openings.push(recessedWindow(side,12,y,z+(i-(columns-1)/2)*pitch,pitch-.18,2.60));
     for(const u of [-5.2,0,5.2])sideOpenings.push({u,y,width:3.0,height:2.60});
     box('stone',side,11.74,y-1.40,z,.22,.16,width-.65);
   }
   masonryFace('stone',side,12,z,width-.4,0,h,openings);masonryEnds('stone',side,12,z,width-.4,19,0,h,sideOpenings);
   for(const i of [0,Math.round(columns/2),columns])box('plaster',side,11.74,h/2,z+(i-columns/2)*pitch,.32,h,.14);
   box('plaster',side,11.35,h+.15,z,.95,.5,width+.1);
   register('civic',side,z,width,h,12,19,serial,dundasDistrictAt(index));
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
     if(!closeDetail(z)){box('timber',side,13.4,.65,z,1.15,.12,2.2);for(const zz of [z-.85,z+.85])box('metal',side,13.5,.4,zz,.12,.5,.12);}
   }
   if(Math.round(z/32)%3===0)panel(side,z,1.7,2.5,.8,kind==='riverdale'?landmarkSigns.riverdale:landmarkSigns.regent,13.1);
   register('park',side,z,width,0,11,depth,Math.round(z+500),dundasDistrictAt(index));stats.frontages++;
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
     box('office',side,21.91,23,z,.08,23,width*.56);
     for(const edge of [-1,1])put('office',side*31,22,z+edge*(width*.325+.025),18,30,.04);
     box('roof',side,22,37.65,z,18.3,.25,width*.65+.3);
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
     const office=['core','regent','culture'].includes(district.id);officeFinish=rank%3;
     put(office?'office':'brick',x,h/2,z,w,h,18);
     put('roof',x,h+.13,z,w+.4,.25,18.4);
     const facing=cross.z-z<0?-1:1;
     if(!office)for(let y=3;y<h-.7;y+=4)put(rank%2?'window':'glass',x,y,z+facing*9.08,w-1.5,1.9,.04);
   }
   for(const side of [-1,1])for(let k=0;k<5;k++){
     const z=-360+k*205,index=dundasIndexAtZ(route,z),district=dundasDistrictAt(index);
     if(!clear(z,25))continue;
     const parkView=district.id==='riverdale'&&side===1;if(parkView)continue;
     const high=['core','regent'].includes(district.id)||parkView;
     const h=high?30+hash(index+k)*38:11+hash(k+side)*13;
     const x=side*(parkView?103:82+hash(k)*22);
     officeFinish=k%3;put('office',x,h/2,z,18,h,24);put('roof',x,h+.12,z,18.2,.24,24.2);
   }
   // One distant skyline grouping is aligned with the visible west-side park.
   // A single CN-like silhouette is sufficient; never repeat it per park cell.
   const parkZones=zones.filter(z=>z.id==='riverdale'&&z.side===1);
   if(parkZones.length){
     const anchor=parkZones[Math.floor(parkZones.length/2)].z;
     for(let j=0;j<6;j++){
       const z=anchor+(j-2.5)*19;if(!clear(z,14))continue;
       const h=27+hash(j+35)*26;officeFinish=j%3;put('office',88+j*5,h/2,z,11+hash(j)*6,h,14);
     }
     put('skyline',127,34,anchor,1.05,68,1.05);put('skyline',127,54,anchor,5.7,3.1,5.7);put('skyline',127,74,anchor,.32,22,.32);stats.skylineTowers=1;
   }
 }
 function setRoute(){
   group.visible=route.id==='dundas';stats.rebuilds++;
   if(!group.visible){retail.setRoute(route,[]);facades.setRoute(route,[]);return;}
   for(const p of pools.values())p.count=0;
   displays.length=zones.length=landmarks.length=frontages.length=facadeWindows.length=0;sourceSerial=0;
   stats.overflow=stats.frontages=stats.trees=stats.windowFrames=stats.facadeDetails=stats.parkSlopes=stats.skylineTowers=0;
   stats.overflows={};signPanels.length=0;signCache.clear();signColumns.fill(0);ctx.clearRect(0,0,1024,1024);
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
         if(district.id==='west'){
           if(serial%5===1)house(side,zz,w,h,district,index,serial++);
           else if(serial%5===3)shop(side,zz,w,h,district,index,serial++);
           else loft(side,zz,w,district,index,serial++);
         }
         else if(['riverdale','terminal'].includes(district.id)||district.id==='garden'&&serial%3!==0)house(side,zz,w,h,district,index,serial++);
         else shop(side,zz,w,h,district,index,serial++);
       }
     }
   }
   for(const feature of activeFeatures)buildSpecial(feature,feature.z);
   background();
   for(let z=-210;z<370;z+=68){const district=dundasDistrictAt(dundasIndexAtZ(route,z));if(['core','culture','don'].includes(district.id))continue;for(const side of [-1,1])if(clear(z,5)){const before=stats.trees;tree(side,z,9.3,.92);if(stats.trees>before)frontages.push({kind:'tree',side,z,width:2,height:4,front:9.3,depth:1,index:Math.round(z+500),district:district.id});}}
   retail.setRoute(route,frontages);facades.setRoute(route,frontages);
   stats.instances=stats.triangles=0;
   for(const p of pools.values()){
     p.mesh.count=p.count;p.mesh.instanceMatrix.needsUpdate=true;if(p.mesh.instanceColor)p.mesh.instanceColor.needsUpdate=true;
     stats.instances+=p.count;stats.triangles+=p.count*p.triangles;
   }
   signRegions.needsUpdate=true;signTexture.needsUpdate=true;stats.meshes=pools.size;stats.sources=displays.length;
   stats.activeZones=[...new Set(zones.map(z=>z.id))];stats.landmarks=landmarks.map(f=>f.id);
 }
 function setNight(amount){const value=THREE.MathUtils.clamp(amount,0,1);for(const {material,power} of nightMaterials)material.emissiveIntensity=power*value;retail.setNight(value);facades.setNight(value);}
 setNight(0);setRoute();
 return {group,setRoute,setNight,stats,displays,retail,facades,facadeWindows,get signPanels(){return signPanels;},get frontages(){return frontages;},get zones(){return zones;},get landmarks(){return landmarks;}};
}
