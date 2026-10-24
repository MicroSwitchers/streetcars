import {buildNeighbourhood} from './neighbourhood.js';
import {buildStreetLife} from './street-life.js';
import * as THREE from 'three';
import {mergeGeometries} from 'geometry-utils';
import {createFoliage} from './surfaces.js';
import {createStreetscape} from './streetscape.js';
import {createArchitecture} from './architecture.js';

// Distances are deliberately compressed. All geometry is in metres; east is +Z.
 export const ROUTE={start:-205,end:360,trackX:-1.8,sidewalkX:-7.85,gauge:1.495,wireY:5.8,
  crossings:[{z:-100,name:'BATHURST ST'},{z:100,name:'PORTLAND ST'},{z:300,name:'SPADINA AVE'}],
  stops:[{z:-124,name:'Bathurst Street'},{z:76,name:'Portland Street'},{z:276,name:'Spadina Avenue'}]};

export function buildEnvironment(scene,trafficCars,streetProps,architecturalAssets){
 let seed=501;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const mats={},batches=new Map(),dummy=new THREE.Object3D();
 const foliage=createFoliage();
 const boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,12),leafGeo=foliage.geometry,linePoints=[];
 const mat=(name,color,roughness=.85,metalness=0)=>mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness});
 mat('road',0x515550);mat('trackbed',0x484c48);mat('concrete',0xaaa69a);mat('curb',0xb9b8aa);mat('roof',0x454940);mat('trim',0xafa28a);mat('dark',0x273d38);mat('glass',0x304c4f,.25,.3);mat('warmglass',0x8d8870,.4,.1);mat('white',0xe7dfbf);mat('yellow',0xd3ad55);mat('steel',0x9baba6,.25,.8);mat('groove',0x202925);mat('pole',0x4e5b50,.6,.4);mat('red',0xa92e30);mat('wood',0x77563a);mat('leaf',0x526d42);mat('leaf2',0x78884c);mat('bark',0x665843);mat('stone',0x9d9885);mat('blue',0x43646c);mat('maroon',0x5f3131);mat('creamcar',0xb2ac91);mat('rubber',0x252b28);mat('signalCase',0x31342b);mat('signalRed',0xb24e3c);mat('signalGreen',0x789466);mat('signalAmber',0xd9ad54);mat('skyline',0x9aa6a0);mat('skin',0xa77a56);mat('coat',0x435c65);mat('trousers',0x3b403e);
 mat('awningRed',0x9e4a3d);mat('awningGreen',0x536b58);mat('awningBlue',0x4e6970);mat('awningOchre',0xb38a50);mat('awningCream',0xe7d7b6);
 mats.storeGlass=new THREE.MeshStandardMaterial({color:0xd7e4e6,roughness:.16,metalness:.12,transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide});
 const storeGlazingGeometries=[];let storeGlazingCount=0;
 function add(geometry,material,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0){const cell=Math.floor(z/96),key=cell+geometry.uuid+material.uuid;if(!batches.has(key))batches.set(key,{geometry,material,cell,matrices:[]});dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();batches.get(key).matrices.push(dummy.matrix.clone());}
 const box=(m,x,y,z,sx,sy,sz,ry=0)=>add(boxGeo,mats[m],x,y,z,sx,sy,sz,ry);
 const cylinder=(m,x,y,z,r,h)=>add(cylGeo,mats[m],x,y,z,r,h,r);
 function rod(m,a,b,r){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);dummy.position.copy(av.add(bv).multiplyScalar(.5));dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());dummy.scale.set(r,delta.length(),r);dummy.updateMatrix();const cell=Math.floor(dummy.position.z/96),key=cell+cylGeo.uuid+mats[m].uuid;if(!batches.has(key))batches.set(key,{geometry:cylGeo,material:mats[m],cell,matrices:[]});batches.get(key).matrices.push(dummy.matrix.clone());}
 const wire=(a,b)=>linePoints.push(...a,...b);
 // Small generated surface maps avoid external image requests and repeat seamlessly.
 function brickTexture(base){const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#776e61';ctx.fillRect(0,0,256,256);for(let row=0;row<16;row++)for(let col=-1;col<5;col++){const n=.82+rnd()*.26;ctx.fillStyle=`rgb(${base.map(v=>Math.round(v*n)).join(',')})`;ctx.fillRect(col*64+(row%2)*32+1,row*16+1,62,14);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,5);t.anisotropy=4;return t;}
 [[133,67,47],[155,94,64],[163,133,88],[104,76,64],[116,104,84]].forEach((base,i)=>{mats['brick'+i]=new THREE.MeshStandardMaterial({map:brickTexture(base),roughness:.93});});
 // Shared, muted surface maps add scale without loading external photographs.
 function canvasMap(draw){const c=document.createElement('canvas');c.width=c.height=256;draw(c.getContext('2d'));const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
 const asphalt=canvasMap(ctx=>{ctx.fillStyle='#646761';ctx.fillRect(0,0,256,256);for(let i=0;i<19000;i++){const v=65+Math.floor(rnd()*75);ctx.fillStyle=`rgba(${v},${v+2},${v},.24)`;ctx.fillRect(rnd()*256,rnd()*256,1,1);}});asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(6,160);mats.road.map=asphalt;mats.road.color.setHex(0xc2c5c0);
 mat('patch',0xb8bdb7);mats.patch.map=asphalt.clone();mats.patch.map.repeat.set(1,1);mat('terracotta',0x865d45);mat('paintedGreen',0x617064);mat('paintedCream',0xb2a88d);mat('paintedGrey',0x7f8880);mat('leaf3',0x89944e);
 for(let style=0;style<4;style++){
   const texture=canvasMap(ctx=>{ctx.fillStyle=['#283c3b','#3f4540','#3a3934','#344443'][style];ctx.fillRect(0,0,256,256);
     const glow=ctx.createLinearGradient(0,0,256,230);glow.addColorStop(0,'#ffffff0a');glow.addColorStop(.45,'#eac48c0d');glow.addColorStop(1,'#00000044');ctx.fillStyle=glow;ctx.fillRect(0,0,256,256);
     ctx.fillStyle='#d2af7044';ctx.fillRect(20,24,216,7);
     for(let y=110;y<245;y+=48){
       ctx.fillStyle='#8b745a';ctx.fillRect(12,y,232,4);
       for(let x=20;x<238;x+=style===0?19:43){ctx.fillStyle=['#697364','#9d8867','#526b70','#815f50'][(Math.floor(x/19)+style)%4];
         if(style===0)ctx.fillRect(x,y-22-rnd()*12,10+rnd()*4,22+rnd()*10);
         else if(style===1){ctx.fillStyle='#af956f';ctx.beginPath();ctx.ellipse(x+10,y-9,14,7,0,0,Math.PI*2);ctx.fill();}
         else if(style===2){ctx.fillStyle='#788658';ctx.beginPath();ctx.ellipse(x+10,y-19,11,19,.3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9e7458';ctx.fillRect(x+3,y-11,15,11);}
         else{ctx.fillStyle='#96856c';ctx.fillRect(x,y-25,26,23);ctx.fillStyle='#536b68';ctx.fillRect(x+3,y-22,20,17);}
       }
     }
     ctx.fillStyle='#d5c39260';ctx.beginPath();ctx.moveTo(160,32);ctx.lineTo(145,58);ctx.lineTo(181,58);ctx.closePath();ctx.fill();ctx.strokeStyle='#d7e2d518';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(180,256);ctx.stroke();});
   mats['display'+style]=new THREE.MeshStandardMaterial({map:texture,roughness:.34,metalness:.12});
 }
 for(const name of ['leaf','leaf2','leaf3']){const m=mats[name];m.map=foliage.map;m.alphaTest=.45;m.side=THREE.DoubleSide;m.vertexColors=true;m.roughness=.85;m.shadowSide=THREE.FrontSide;}
 const windowGlow=new THREE.Color(0xffc581);
 const plaster=['paintedGreen','paintedCream','paintedGrey'];
 const atlas=document.createElement('canvas');atlas.width=2048;atlas.height=3072;const ac=atlas.getContext('2d'),at=new THREE.CanvasTexture(atlas);at.colorSpace=THREE.SRGBColorSpace;at.anisotropy=4;
 const signMat=new THREE.MeshStandardMaterial({map:at,roughness:.67,metalness:.08,side:THREE.DoubleSide}),signGeos=[];let signIndex=0;const signCache=new Map();
 function sign(text,x,y,z,width,height,rotation,colour='#e7dbb9',bg='#2c4b41',sub='',style='street'){
   const aspect=style==='shop'?Math.round(width/height/3)*3:0;
   const key=[text,colour,bg,sub,style,aspect].join('|');if(!signCache.has(key))signCache.set(key,signIndex++);const index=signCache.get(key),col=index%8,row=Math.floor(index/8);if(row>=atlas.height/128)return;
   const px=col*256,py=row*128;
   let cropTop=0,cropHeight=128;
   if(style==='shop'){
     cropHeight=Math.max(16,Math.min(48,256*height/width));cropTop=(128-cropHeight)/2;
     const inset=Math.max(1,cropHeight*.08),center=cropTop+cropHeight/2,radius=cropHeight*.32;
     ac.fillStyle=bg;ac.fillRect(px,py+cropTop,256,cropHeight);
     ac.strokeStyle='#d5bb7b';ac.lineWidth=Math.max(1,cropHeight*.045);ac.strokeRect(px+2,py+cropTop+inset,252,cropHeight-2*inset);
     ac.strokeStyle='#f2e0ad88';ac.lineWidth=Math.max(.6,cropHeight*.018);ac.strokeRect(px+5,py+cropTop+inset*2,246,cropHeight-4*inset);
     ac.fillStyle='#d5bb7b';ac.beginPath();ac.arc(px+center,py+center,radius,0,Math.PI*2);ac.fill();
     ac.fillStyle=bg;ac.beginPath();ac.arc(px+center,py+center,radius*.78,0,Math.PI*2);ac.fill();
     ac.fillStyle=colour;ac.textAlign='center';ac.textBaseline='middle';ac.font=`bold ${Math.max(8,cropHeight*.38)}px Georgia,serif`;ac.fillText(text.trim()[0]||'Q',px+center,py+center);
     const textX=px+cropHeight*.88,textWidth=256-cropHeight*1.02;
     ac.fillStyle='#d5bb7b';ac.textAlign='left';ac.textBaseline='middle';ac.font=`bold ${Math.max(5,cropHeight*.15)}px Arial,sans-serif`;ac.fillText('QUEEN STREET WEST',textX,py+cropTop+cropHeight*.22);
     ac.strokeStyle='#d5bb7b99';ac.lineWidth=Math.max(.5,cropHeight*.012);ac.beginPath();ac.moveTo(textX,py+cropTop+cropHeight*.37);ac.lineTo(px+250,py+cropTop+cropHeight*.37);ac.stroke();
     let size=Math.max(7,cropHeight*.37);ac.font=`bold ${size}px Georgia,serif`;
     while(size>6&&ac.measureText(text).width>textWidth){size--;ac.font=`bold ${size}px Georgia,serif`;}
     ac.fillStyle=colour;ac.textAlign='left';ac.textBaseline='middle';ac.fillText(text,textX,py+cropTop+cropHeight*.61,textWidth);
     if(sub){ac.fillStyle='#e2d2a8';ac.font=`${Math.max(5,cropHeight*.16)}px Arial,sans-serif`;ac.fillText(sub,textX,py+cropTop+cropHeight*.85,textWidth);}
   }else{
     ac.fillStyle=colour;ac.textAlign='center';ac.textBaseline='middle';ac.font='bold '+Math.min(32,360/text.length)+'px Arial';ac.fillText(text,px+128,py+(sub?50:64),238);if(sub){ac.font='12px Arial';ac.fillText(sub,px+128,py+86,236);}
   }
   const geo=new THREE.PlaneGeometry(width,height),uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(px+uv.getX(i)*256)/atlas.width,1-(py+cropTop+(1-uv.getY(i))*cropHeight)/atlas.height);geo.rotateY(rotation);geo.translate(x,y,z);signGeos.push(geo);
 }
 // One depth surface carries the road, embedded rails and painted markings.
 // Their world-space material details remain continuous through intersections.
 box('concrete',0,-.25,75,280,.3,1500);box('road',0,-.08,75,15,.16,1200);
 // Cross streets, walk markings and overhead street signs.
 const signals=[];
 for(const cross of ROUTE.crossings){
   // Side-street arms meet the main road at its edges; no coplanar overlap.
   for(const side of [-1,1])box('road',side*73.75,-.08,cross.z,132,.16,13.5);
   for(const side of [-1,1]){
     const z=cross.z+side*12.5;cylinder('pole',side*8,3.8,z,.085,7.6);rod('pole',[side*8,7.2,z],[side*Math.abs(ROUTE.trackX),7.2,z],.065);
     box('signalCase',side*Math.abs(ROUTE.trackX),6.65,z,.36,.95,.27);const group=new THREE.Group();group.position.set(side*Math.abs(ROUTE.trackX),6.65,z);if(side===-1)group.rotation.y=Math.PI;
     for(let i=0;i<3;i++){const m=new THREE.MeshBasicMaterial({color:0x242f27});const lamp=new THREE.Mesh(new THREE.CircleGeometry(.115,12),m);lamp.position.set(0,.28-i*.28,.144);group.add(lamp);}scene.add(group);signals.push({group,z:cross.z-12,cross});
     sign('QUEEN ST W',side*8,4.0,cross.z+side*12.5,2.0,.38,0,'#f0ead8','#244c3c');
     sign(cross.name,side*8,4.45,cross.z+side*12.5,2.0,.38,Math.PI/2,'#f0ead8','#244c3c');

   }
 }
 const neighbourhood=buildNeighbourhood({scene,route:ROUTE,mats,mat,box,cylinder,rod,add,sign,rnd,leafGeo,canvasMap});
 const streetscape=createStreetscape({scene,route:ROUTE,mats,mat,box,cylinder,rod,add,sign,leafGeo},streetProps);
 const architecture=createArchitecture({scene,route:ROUTE,mats},architecturalAssets);
 const shopNames=['PAPER & INK','QUEEN RECORDS','THE CORNER CAFE','WEST END BOOKS','BELLWOODS CYCLE','STUDIO 501','GOLDEN PHO','THREAD & NEEDLE','CITY FLOWERS','NIGHT OWL','VINYL EXCHANGE','QUEEN HARDWARE','PARKDALE MARKET','SILVER SCREEN','GOOD NEIGHBOUR','THE LITTLE BAKERY'];
 const signColours=['#283e37','#883e31','#303f52','#d1bc83','#344548','#6c513d'];
 let shop=0,awningCount=0,upperWindowCount=0,facadeDetailCount=0,rooflineDetailCount=0,shopfrontCount=0,shopfrontFeatureCount=0;
 for(const side of [-1,1]){
   for(let z=-518;z<675;){const width=7.5+rnd()*4.4,mid=z+width/2;z+=width+.12;if(ROUTE.crossings.some(c=>Math.abs(mid-c.z)<width/2+11)||(side===-1&&mid+width/2>-179&&mid-width/2<-142))continue;
     const height=7.0+rnd()*7.0,material=shop%7===0?plaster[shop%3]:'brick'+Math.floor(rnd()*5),depth=8+rnd()*3;
     const entry=mid+(width-.9)/3,paneWidth=(width-.9)/3-.13;
     const detailed=mid>ROUTE.start-45&&mid<ROUTE.end+60;
     const building={side,mid,width,height,depth,index:shop,detailed},architecturePlan=architecture.plan(building);
     if(detailed){
       // A real 2.2 m display recess replaces the solid ground-floor facade.
       box(material,side*(11.4+depth/2),(height+.15+3.25)/2,mid,depth,height+.15-3.25,width);
       box(material,side*(13.22+(depth-1.82)/2),1.70,mid,depth-1.82,3.10,width);
       for(const edge of [-1,1])box(material,side*12.0,1.70,mid+edge*(width/2-.10),2.20,3.10,.20);
     }else box(material,side*(11.4+depth/2),height/2+.15,mid,depth,height,width);
     box('roof',side*(11.4+depth/2),height+.18,mid,depth+.25,.22,width+.2);
     if(!detailed)box('trim',side*11.22,height-.1,mid,.34,.28,width+.2);
     box('trim',side*11.25,4.15,mid,.24,.16,width);
     if(detailed){
       box('dark',side*11.24,.35,mid,.25,.40,width-.28);
       box('dark',side*11.24,3.24,mid,.25,.62,width-.28);
     }else box('dark',side*11.24,1.85,mid,.25,3.4,width-.28);
     for(let q=0;q<3;q++){
       const zz=mid+(q-1)*(width-.9)/3;
       if(Math.abs(zz-entry)<.1)continue;
       if(detailed)streetscape.display({side,z:zz,width:paneWidth-.17,index:shop});
       else{
         box('display'+(shop+q)%4,side*11.07,1.73,zz,.025,2.5,paneWidth);
         box('dark',side*11.015,1.73,zz,.06,2.55,paneWidth+.10);
         box('display'+(shop+q)%4,side*10.98,1.73,zz,.025,2.42,paneWidth-.17);
       }
       const glazing=new THREE.PlaneGeometry(paneWidth-.17,2.42);
       glazing.rotateY(-side*Math.PI/2);glazing.translate(side*10.89,1.73,zz);storeGlazingGeometries.push(glazing);storeGlazingCount++;
       box('trim',side*10.94,1.73,zz,.045,2.52,.055);
       for(const offset of [-1,1])box('trim',side*10.94,1.73,zz+offset*(paneWidth-.15)/2,.045,2.52,.055);
       box('warmStone',side*10.92,3.02,zz,.18,.16,paneWidth+.24);
       box('warmStone',side*10.92,.43,zz,.22,.18,paneWidth+.28);
       box('dark',side*10.93,.60,zz,.06,.18,paneWidth-.16);
       box('trim',side*10.92,2.48,zz,.05,.055,paneWidth-.14);
       for(const offset of [-.48,.48])box('trim',side*10.92,2.73,zz+offset*(paneWidth-.14)/2,.05,.48,.045);
       shopfrontFeatureCount+=9;
     }
     if(shop%3!==1){
       const awning=['awningRed','awningGreen','awningBlue','awningOchre'][shop%4],stripeWidth=1.15,awningWidth=width-.55,stripeCount=Math.ceil(awningWidth/stripeWidth);
       for(let stripe=0;stripe<stripeCount;stripe++){
         const stripeZ=mid-awningWidth/2+(stripe+.5)*awningWidth/stripeCount,stripeSize=awningWidth/stripeCount-.025;
         const fabric=stripe%2?'awningCream':awning;
         add(boxGeo,mats[fabric],side*10.68,3.20,stripeZ,.84,.12,stripeSize,0,0,side*.24);
         box(fabric,side*10.28,3.04,stripeZ,.08,.20,stripeSize);
       }
       for(const edge of [-1,1]){
         const bracketZ=mid+edge*(awningWidth/2-.14);
         rod('dark',[side*11.04,3.37,bracketZ],[side*10.27,3.04,bracketZ],.025);
         cylinder('steel',side*11.025,3.36,bracketZ,.045,.025);
       }
       awningCount++;
     }
     box('wood',side*11.01,.37,mid,.14,.5,width-.4);box('trim',side*10.99,1.4,mid+(width-.9)/3,.04,.065,.44);
     const name=shopNames[shop%shopNames.length],bg=signColours[shop%signColours.length];
     box('dark',side*11.08,3.76,mid,.19,.92,width-.32);
     box(shop%3===0?'maroon':'warmStone',side*11.015,3.76,mid,.06,.80,width-.46);
     box('trim',side*11.005,4.13,mid,.045,.08,width-.40);
     box('trim',side*11.005,3.39,mid,.045,.08,width-.40);
     sign(name,side*10.97,3.76,mid,width-.72,.66,-side*Math.PI/2,bg==='#d1bc83'?'#343e33':'#f2e3c2',bg,shop%3===0?'EST. 19'+(60+shop%40):'SHOP / '+String(100+shop%24),'shop');
     if(shop%3===0){box('maroon',side*10.78,3.06,mid,1.1,.12,width-.4);box('maroon',side*10.23,2.92,mid,.06,.28,width-.4);}
     box('warmStone',side*10.92,1.77,entry,.20,3.10,1.28);
     box('dark',side*10.79,1.78,entry,.055,2.72,.94);
     box('glass',side*10.75,1.96,entry,.025,2.18,.72);
     box('trim',side*10.72,1.96,entry,.035,.07,.72);
     box('warmStone',side*10.72,2.84,entry,.10,.18,1.02);
     for(const offset of [-.31,0,.31])box('trim',side*10.71,2.84,entry+offset,.04,.18,.035);
     box('dark',side*10.72,.55,entry,.06,.30,.76);
     rod('steel',[side*10.68,1.48,entry+.25],[side*10.68,1.88,entry+.25],.025);
     cylinder('yellow',side*10.66,1.42,entry+.25,.055,.035);
     box('warmStone',side*10.86,3.03,entry,.22,.16,1.38);
     sign(String(100+shop%24),side*10.72,2.99,entry-.47,.32,.14,-side*Math.PI/2,'#f0e6d0','#34443c');
     box('stone',side*10.60,.235,entry,.66,.12,1.34);
     box('warmStone',side*10.49,.31,entry,.74,.045,1.48);
     shopfrontFeatureCount+=12;shopfrontCount++;
     for(let y=5.3;y<height-(detailed?1.65:1.0);y+=2.7){
       box('warmStone',side*11.245,y-1.12,mid,.16,.11,width-.34);facadeDetailCount++;
       for(let zz=mid-width/2+1.35;zz<mid+width/2-.7;zz+=2.35){
         upperWindowCount++;
         if(architecture.window({side,y,z:zz,index:shop,height,detailed,plan:architecturePlan}))continue;
         box('trim',side*11.22,y,zz,.24,1.97,1.25);box('glass',side*11.08,y,zz,.035,1.70,1.05);
         box('trim',side*11.045,y,zz,.035,.06,1.05);box('trim',side*11.045,y,zz,.035,1.7,.05);
         box('warmStone',side*11.015,y+.88,zz,.27,.14,1.38);
         box('warmStone',side*11.025,y-.93,zz,.30,.12,1.42);
         box('trim',side*11.025,y,zz,.035,1.62,.045);
         for(const offset of [-.48,.48])box('warmStone',side*11.015,y+.99,zz+offset,.22,.18,.18);
         facadeDetailCount+=6;
       }
     }
     for(const zz of [mid-width/2+.32,mid+width/2-.32]){
       box('warmStone',side*11.24,(height+4.2)/2,zz,.18,Math.max(1,height-4.2),.22);
       for(let y=4.2;y<height-.6;y+=2.7)box('trim',side*11.31,y,zz,.25,.20,.30);
       facadeDetailCount++;
     }
     // Roof forms and projecting bays break up the long repeated facade silhouette.
     if(shop%8===3){add(neighbourhood.pitchedRoof,mats.roofTile,side*(11.4+depth/2),height+.29,mid,depth+.30,1.45,width+.2);box('warmStone',side*11.19,height+.68,mid,.14,.82,.8);box('glass',side*11.10,height+.70,mid,.025,.56,.50);}
     if(shop%9===0)for(let zz=mid-width/2+.2;zz<mid+width/2;zz+=.42){box('warmStone',side*10.78,3.127,zz,1.10,.012,.10);box('warmStone',side*10.195,2.92,zz,.012,.28,.10);}
     // Cornice courses, masonry quoins, downpipes and a recessed shop entry.
     if(!detailed){box('trim',side*11.13,height-.43,mid,.20,.10,width+.13);box('roof',side*11.21,height-.25,mid,.23,.09,width+.10);}
     if(shop%4===1){
       box('warmStone',side*11.17,height+.46,mid,.28,.62,width+.14);
       box('trim',side*11.18,height+.80,mid,.34,.12,width+.36);
       for(let zz=mid-width/2+.45;zz<mid+width/2;zz+=1.8){
         box('trim',side*11.30,height+.43,zz,.18,.58,.20);
         box('warmStone',side*11.31,height+.75,zz,.30,.12,.34);
         rooflineDetailCount++;
       }
       rooflineDetailCount++;
     }else if(shop%4===2){
       for(const edge of [-1,1]){
         box('warmStone',side*11.18,height+.36,mid+edge*(width/2-.12),.28,.42,.22);
         box('trim',side*11.18,height+.60,mid+edge*(width/2-.12),.36,.10,.32);
       }
       rooflineDetailCount+=2;
     }
     for(const zz of [mid-width/2+.14,mid+width/2-.14]){
       box('trim',side*11.27,2.05,zz,.30,3.8,.20);
       for(let y=4.5;y<height-.7;y+=.58)box('trim',side*11.30,y,zz,.18,.22,.30);
     }
     rod('pole',[side*11.13,.35,mid-width/2+.42],[side*11.13,height-.55,mid-width/2+.42],.032);
     if(!detailed&&shop%6===1){
       // A small steel fire escape adds a different silhouette to selected facades.
       for(const y of [5.0,7.7]){box('dark',side*10.89,y,mid,.68,.08,2.5);rod('dark',[side*10.56,y+.06,mid-1.2],[side*10.56,y+.85,mid-1.2],.018);rod('dark',[side*10.56,y+.85,mid-1.2],[side*10.56,y+.85,mid+1.2],.018);for(let zz=mid-1;zz<mid+1.3;zz+=.35)rod('dark',[side*10.56,y+.05,zz],[side*10.56,y+.85,zz],.012);}
       for(const zz of [mid-.30,mid+.30])rod('dark',[side*10.65,3.8,zz],[side*10.65,7.7,zz],.022);
       for(let y=3.9;y<7.7;y+=.28)rod('dark',[side*10.65,y,mid-.30],[side*10.65,y,mid+.30],.015);
     }
     streetscape.shop({side,mid,width,height,depth,entry,index:shop,fireEscape:architecturePlan.fire});
     architecture.building(building,architecturePlan);
     // Retain the layout seed sequence when replacing the old rooftop box.
     if(shop%4===0)rnd();
     shop++;
   }
 }
 // Street furniture, catenary supports and planted pockets along both sidewalks.
 for(let z=-510;z<=665;z+=34){
   if(ROUTE.crossings.some(c=>Math.abs(z-c.z)<14))continue;
   for(const side of [-1,1]){
     cylinder('pole',side*8.05,3.55,z,.078,7.1);rod('pole',[side*8.05,6.85,z],[side*6.3,6.85,z],.05);box('dark',side*6.25,6.80,z,.65,.12,.28);
     wire([side*8.05,6.35,z],[0,5.8,z]);
     if(Math.round(z)%3!==0){
       cylinder('bark',side*9.2,1.70,z+6,.11,3.1);box('dark',side*9.2,.19,z+6,1.25,.018,1.25);
       for(let j=0;j<6;j++){const a=j*2.40,dx=Math.sin(a)*.85,dz=Math.cos(a)*.85,y=3.3+rnd()*1.3;rod('bark',[side*9.2,2.15,z+6],[side*9.2+dx,y,z+6+dz],.038);const radius=.65+rnd()*.48;add(leafGeo,mats[['leaf','leaf2','leaf3'][j%3]],side*9.2+dx,y+.43,z+6+dz,radius,radius*.95,radius*1.10);}
     }
     streetscape.streetFurniture(side,z);
   }
 }
 for(const x of [ROUTE.trackX,-ROUTE.trackX])wire([x,ROUTE.wireY,-525],[x,ROUTE.wireY,675]);
 // TTC-style stop poles and shelters. The front door aligns with the marked stop.
 const curb=Math.sign(ROUTE.trackX);
 ROUTE.stops.forEach((stop,i)=>{
   cylinder('pole',curb*7.95,1.85,stop.z+5.9,.045,3.5);sign('TTC ? 501',curb*7.95,3.36,stop.z+5.9,.55,.72,-curb*Math.PI/2,'#fff2d8','#b33132','QUEEN EAST');
   box('dark',curb*9.55,2.65,stop.z+1,2.15,.15,4.3);for(const z of [stop.z-.95,stop.z+2.95])for(const x of [8.65,10.45])box('pole',curb*x,1.48,z,.06,2.35,.06);
   box('glass',curb*10.5,1.5,stop.z+1,.035,2.22,4.0);box('wood',curb*10.05,.66,stop.z+1,.5,.10,2.7);
   sign('501 QUEEN',curb*10.46,1.75,stop.z+1,1.1,1.45,-curb*Math.PI/2,'#eedeb7','#364a3e','EASTBOUND');
   box('red',curb*7.73,.202,stop.z+5.9,.26,.025,2.4);
 });
 const actors=buildStreetLife(scene,ROUTE,trafficCars);const bikeRing=new THREE.TorusGeometry(.20,.018,5,16);bikeRing.rotateY(Math.PI/2);
 // Repaired pavement, curbside drains and bicycle rings add close-range street scale.
 for(let z=-510;z<660;z+=23){
   if(ROUTE.crossings.some(c=>Math.abs(c.z-z)<15))continue;
   for(const side of [-1,1]){
     const patch=new THREE.CircleGeometry(1,32);patch.rotateX(-Math.PI/2);const positions=patch.attributes.position;for(let i=1;i<positions.count;i++){positions.setX(i,positions.getX(i)*(.82+rnd()*.3));positions.setZ(i,positions.getZ(i)*(.82+rnd()*.3));}patch.computeVertexNormals();add(patch,mats.patch,side*5.65,.007,z,.65,1,1.25+rnd());
     box('dark',side*7.20,.014,z+6,.37,.012,.70);
     for(let k=0;k<6;k++)box('steel',side*7.20,.022,z+5.72+k*.11,.31,.005,.016);
     if(Math.abs(z%46)<10){cylinder('pole',side*8.2,.64,z+13,.027,.95);add(bikeRing,mats.pole,side*8.2,.91,z+13,1,1,1);}
   }
   cylinder('dark',-3.2,.015,z+10,.24,.009);cylinder('steel',-3.2,.021,z+10,.21,.006);
 }
 // Distant skyline and a restrained CN Tower silhouette south-east of the corridor.
 for(const side of [-1,1])for(let z=-510;z<730;z+=34){const h=16+rnd()*35;const x=side*(65+rnd()*50),w=12+rnd()*14;box('skyline',x,h/2,z,w,h,15+rnd()*16);for(let y=5;y<h-2;y+=3.8)box('glass',x-side*(w/2+.015),y,z,.025,.85,11); }
 cylinder('skyline',78,48,190,1.4,96);cylinder('skyline',78,78,190,5.8,4);cylinder('dark',78,80,190,4.5,1.5);cylinder('skyline',78,96,190,.38,31);cylinder('skyline',78,112,190,.12,9);
 const scenery=streetscape.finish();
 const architecturalDetails=architecture.finish();
 const groundDetails=new Set(['road','trackbed','patch','groove','steel','white','yellow','stone'].map(name=>mats[name]));
 const singleGeometryGroups=new Map();
 for(const {geometry,material,matrices,cell} of batches.values()){
   if(geometry===boxGeo&&[mats.brick0,mats.brick1,mats.brick2,mats.brick3,mats.brick4].includes(material)){
     material.map.repeat.set(1,1);
     const geometries=matrices.map(matrix=>{const g=geometry.clone().applyMatrix4(matrix),position=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),z=position.getZ(i);uv.setXY(i,(Math.abs(normal.getX(i))>.5?z:x)/.88,(Math.abs(normal.getY(i))>.5?z:y)/1.08);}return g;});
     const merged=mergeGeometries(geometries);const mesh=new THREE.Mesh(merged,material);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());continue;
   }
   if(matrices.length===1){const key=cell+material.uuid;if(!singleGeometryGroups.has(key))singleGeometryGroups.set(key,{material,geometries:[]});singleGeometryGroups.get(key).geometries.push(geometry.clone().applyMatrix4(matrices[0]));continue;}
   const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=!groundDetails.has(material);mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
 }
 for(const {material,geometries} of singleGeometryGroups.values()){const merged=mergeGeometries(geometries);const mesh=new THREE.Mesh(merged,material);mesh.castShadow=!groundDetails.has(material);mesh.receiveShadow=true;scene.add(mesh);geometries.forEach(g=>g.dispose());}
 at.needsUpdate=true;const labels=new THREE.Mesh(mergeGeometries(signGeos),signMat);scene.add(labels);
 const storeGlazing=new THREE.Mesh(mergeGeometries(storeGlazingGeometries),mats.storeGlass);storeGlazing.name='Recessed_Storefront_Glazing';storeGlazing.renderOrder=2;storeGlazing.castShadow=false;storeGlazing.receiveShadow=false;scene.add(storeGlazing);storeGlazingGeometries.forEach(geometry=>geometry.dispose());
 const wires=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(linePoints,3)),new THREE.LineBasicMaterial({color:0x34463e}));scene.add(wires);
 return {signals,materials:mats,actors,neighbourhood,scenery,architecture:architecturalDetails,buildingCount:shop,awningCount,upperWindowCount,facadeDetailCount,rooflineDetailCount,shopfrontCount,shopfrontFeatureCount,storeGlazingCount,storeGlazing,signCount:signIndex,update(time,dt,alwaysGreen=false){actors.update(time,dt,alwaysGreen);},setNight(amount){const night=THREE.MathUtils.clamp(amount,0,1);actors.setNight(night);streetscape.setNight(night);mats.glass.emissive.setHex(0xffffff);mats.glass.emissiveIntensity=.42*night;signMat.emissive.copy(windowGlow);signMat.emissiveIntensity=.10*night;for(let i=0;i<4;i++){mats['display'+i].emissive.copy(windowGlow);mats['display'+i].emissiveIntensity=.18*night;}},updateSignals(time,alwaysGreen=false){const phase=time%42,state=alwaysGreen||phase<23?'green':phase<27?'amber':'red';signals.forEach(({group})=>group.children.forEach((lamp,i)=>lamp.material.color.setHex(i===(state==='red'?0:state==='amber'?1:2)?[0xff6c46,0xffc76c,0x9edb89][i]:0x29352c)));return state;}};
}
