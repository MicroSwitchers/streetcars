import * as THREE from 'three';

// Static additions share the main street's material batches and do not enter the rail corridor.
export function buildNeighbourhood(c){
 const {scene,route,mats,mat,box,cylinder,rod,add,sign,rnd,leafGeo,canvasMap,setSceneryLayer=()=>{}}=c;
 mat('parkGrass',0x6c7c50);mat('fence',0x3d4b40,.68,.3);mat('roofTile',0x73564a);mat('path',0xb7ad94);mat('warmStone',0xb6a58a);mat('rust',0x8c5e46);
 const pitchedRoof=new THREE.BufferGeometry();pitchedRoof.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,-.5,0,.5,.5,0,.5,-.5,1,0,.5,1,0],3));pitchedRoof.setIndex([0,2,4,1,5,3,0,4,5,0,5,1,2,3,5,2,5,4,0,1,3,0,3,2]);pitchedRoof.computeVertexNormals();
 // Side streets continue beyond the crossing instead of ending at empty asphalt.
 let sideStreetBuildings=0,sideStreetWindows=0,finishedEndWalls=0,sideElevationDetails=0,sideStreetAwnings=0,crosswalkStripes=0;
 const mainCrosswalkStripeCount=10,sideCrosswalkStripeCount=9,mainCrosswalkCenterOffset=8.75,sideCrosswalkCenterOffset=8.5;
 const sideStreetSidewalkInnerEdge=11.3,sideStreetSidewalkLength=129;
 // Build the sidewalk and ramp footprints together. Each corner ramp replaces
 // a section of the slab, with its low end at the cross street's asphalt edge.
 const roadEdge=6.75,curbWidth=.16,walkEdge=7.65,walkOuter=sideStreetSidewalkInnerEdge;
 const rampCenter=8.75,rampWidth=2.2,rampLength=1.6,rampOuter=rampCenter+rampWidth/2;
 const walkHeight=.18,rampToe=.015,rampBack=roadEdge+rampLength;
 const crossings=[...route.crossings].sort((a,b)=>a.z-b.z);
 const boundaries=[-525,...crossings.flatMap(cross=>[cross.z-roadEdge,cross.z+roadEdge]),675];
 for(const side of [-1,1])for(let i=0;i<boundaries.length;i+=2){
   const a=boundaries[i],b=boundaries[i+1],start=a+(i===0?0:rampLength),end=b-(i===boundaries.length-2?0:rampLength);
   box('concrete',side*(walkEdge+walkOuter)/2,walkHeight/2,(start+end)/2,walkOuter-walkEdge,walkHeight,end-start);
   box('curb',side*7.575,.115,(a+b)/2,.15,.23,b-a);
   for(let z=start+2;z<end;z+=3)box('stone',side*(walkEdge+walkOuter)/2,.184,z,walkOuter-walkEdge,.004,.018);
 }
 const cornerRamp=new THREE.BoxGeometry(rampWidth,walkHeight,rampLength),positions=cornerRamp.attributes.position;
 for(let i=0;i<positions.count;i++)positions.setY(i,positions.getY(i)>0?rampToe+(positions.getZ(i)/rampLength+.5)*(walkHeight-rampToe):0);
 cornerRamp.computeVertexNormals();
 for(const cross of route.crossings){
   for(const end of [-1,1]){
     for(const side of [-1,1]){
       const sidewalkCenter=side*(sideStreetSidewalkInnerEdge+sideStreetSidewalkLength/2),slabEdge=roadEdge+curbWidth,slabBack=10.1;
       box('concrete',sidewalkCenter,walkHeight/2,cross.z+end*(slabEdge+slabBack)/2,sideStreetSidewalkLength,walkHeight,slabBack-slabEdge);
       box('curb',sidewalkCenter,.115,cross.z+end*(roadEdge+curbWidth/2),sideStreetSidewalkLength,.23,curbWidth);
       // The remaining corner slab and returned curb stop at the ramp opening.
       const cornerWidth=walkOuter-rampOuter,cornerX=side*(rampOuter+walkOuter)/2;
       box('concrete',cornerX,walkHeight/2,cross.z+end*(slabEdge+rampBack)/2,cornerWidth,walkHeight,rampBack-slabEdge);
       box('curb',cornerX,.115,cross.z+end*(roadEdge+curbWidth/2),cornerWidth,.23,curbWidth);
       add(cornerRamp,mats.concrete,side*rampCenter,0,cross.z+end*(roadEdge+rampLength/2),1,1,1,end===1?0:Math.PI);
       // The warning pad follows the incline instead of floating above it.
       const padZ=8.0,padY=rampToe+(padZ-roadEdge)/rampLength*(walkHeight-rampToe),slope=(walkHeight-rampToe)/rampLength;
       add(new THREE.BoxGeometry(1.8,.012,.45),mats.warmStone,side*rampCenter,padY+.006,cross.z+end*padZ,1,1,1,0,-end*Math.atan(slope));
       for(let i=0;i<7;i++)for(let j=0;j<2;j++){
         const dz=-.13+j*.26;
         cylinder('stone',side*rampCenter-.72+i*.24,padY+.017+end*dz*slope,cross.z+end*padZ+dz,.026,.009);
       }
     }
     for(const side of [-1,1]){
       // Keep the centre intersection open; sidewalk strips meet the main sidewalk beyond it.
       for(let x=sideStreetSidewalkInnerEdge+3;x<137;x+=3)box('stone',side*x,.184,cross.z+end*8.5,.018,.004,3.05);
       setSceneryLayer(true);
       for(let j=0;j<11;j++){
         const x=side*(15.5+j*10.8),width=10.65,depth=10.1;
         const variation=(j*2+Math.abs(cross.z/100)+end+4)%4;
         const height=8.2+variation*1.55,front=cross.z+end*10.25,centerZ=front+end*depth/2;
         const brickIndex=(j+Math.abs(cross.z/100)+end+8)%5;
         box('brick'+brickIndex,x,height/2,centerZ,width,height,depth);
         box('roof',x,height+.16,centerZ,width+.2,.24,depth+.24);
         box('warmStone',x,3.62,front-end*.14,width,.23,.30);
         box('warmStone',x,.42,front-end*.14,width,.32,.30);
         box('trim',x,height-.34,front-end*.12,width+.16,.18,.34);
         box('roof',x,height-.16,front-end*.16,width+.32,.12,.40);
         for(const edge of [-1,1]){
           const pierX=x+edge*width*.48;
           box('warmStone',pierX,(height+.4)/2,front-end*.2,.30,height-.8,.30);
           for(let y=.8;y<height-1;y+=.88)box('trim',pierX,y,front-end*.36,.36,.13,.10);
         }
         // Individual two-storey shops replace the short, broken row of blank end walls.
         for(const offset of [-2.45,2.45]){
           const windowX=x+offset;
           box('dark',windowX,1.72,front-end*.22,3.55,2.55,.16);
           box('display'+((j+variation)%4),windowX,1.72,front-end*.32,3.20,2.30,.04);
           for(const mullion of [-1.05,0,1.05])box('warmStone',windowX+mullion,1.72,front-end*.37,.10,2.38,.12);
           box('warmStone',windowX,.42,front-end*.37,3.70,.22,.25);
           box('warmStone',windowX,3.02,front-end*.37,3.70,.16,.25);
           box('trim',windowX,2.54,front-end*.40,3.24,.07,.14);
           for(let y=5.35;y<height-1.05;y+=2.65){
             box('warmStone',windowX,y,front-end*.22,1.55,1.95,.24);
             box('glass',windowX,y,front-end*.38,1.25,1.64,.05);
             box('trim',windowX,y,front-end*.43,.07,1.58,.07);
             for(const edge of [-1,1])box('trim',windowX+edge*.60,y,front-end*.43,.07,1.58,.07);
             box('warmStone',windowX,y+.87,front-end*.44,1.63,.15,.14);
             box('warmStone',windowX,y-.88,front-end*.45,1.75,.15,.18);
             box('trim',windowX,y,front-end*.45,.06,1.54,.06);
             sideStreetWindows++;
           }
         }
         box('dark',x,.95,front-end*.24,1.25,1.90,.18);
         box('display'+((j+variation)%4),x,.98,front-end*.35,1.00,1.64,.05);
         box('trim',x,.98,front-end*.40,.06,1.54,.06);
         box('warmStone',x,1.95,front-end*.42,1.42,.15,.20);
         cylinder('steel',x+.38,1.02,front-end*.44,.035,.025);
         const names=['CORNER GROCER','WEST END STUDIO','NEIGHBOURHOOD CAFE'];
         box('dark',x,4.0,front-end*.23,width-.65,.80,.20);
         box('warmStone',x,4.0,front-end*.35,width-.82,.68,.07);
         sign(names[(j+variation)%names.length],x,4.0,front-end*.40,width-1.05,.52,end===1?Math.PI:0,'#e2d8b8',['#33493d','#304452','#724439'][variation%3],'SHOP LOCAL','shop');
         const awningColours=['awningRed','awningGreen','awningBlue','awningOchre'];
         for(let stripe=0;stripe<5;stripe++){
           const stripeX=x-width*.42+stripe*(width*.84/4);
           box(awningColours[(stripe+variation)%awningColours.length],stripeX,3.22,front-end*.68,width*.84/5-.035,.13,.88);
         }
         box(awningColours[variation%awningColours.length],x,3.04,front-end*1.10,width*.84,.22,.10);
         for(const edge of [-1,1])rod('dark',[x+edge*width*.39,3.48,front-end*.43],[x+edge*width*.39,3.03,front-end*1.08],.025);
         sideStreetAwnings++;
         // Project the end-unit wall toward the main street as a finished corner,
         // with returned stone trim and windows rather than exposed brick.
         if(j===0||j===10){
           const faceX=x+side*(width/2+.18);
           box('warmStone',faceX,(height+.35)/2,centerZ,.28,height-.7,depth+.16);
           box('brick'+brickIndex,faceX+side*.17,height/2,centerZ,.12,height-.8,depth-.75);
           box('trim',faceX+side*.22,height-.36,centerZ,.20,.18,depth+.1);
           box('warmStone',faceX+side*.22,.43,centerZ,.24,.30,depth+.1);
           for(const zOffset of [-2.5,2.5]){
             for(let y of [2.0,5.45,8.1]){
               if(y>height-1)continue;
               box('warmStone',faceX+side*.24,y,centerZ+zOffset, .22,2.12,1.72);
               box('glass',faceX+side*.37,y,centerZ+zOffset,.05,1.76,1.36);
               box('trim',faceX+side*.42,y,centerZ+zOffset,.06,1.68,.06);
               box('trim',faceX+side*.42,y,centerZ+zOffset,.06,.06,1.24);
               box('warmStone',faceX+side*.44,y+.94,centerZ+zOffset,.12,.16,1.92);
               box('warmStone',faceX+side*.44,y-.96,centerZ+zOffset,.14,.18,1.98);
               box('trim',faceX+side*.43,y-.28,centerZ+zOffset,.08,.07,1.28);
               sideStreetWindows++;
             }
           }
           for(const level of [4.45,7.25]){
             if(level<height-.35){
               box('warmStone',faceX+side*.28,level,centerZ,.18,.16,depth+.12);
               box('trim',faceX+side*.34,level+.14,centerZ,.12,.10,depth+.18);
               sideElevationDetails+=2;
             }
           }
           for(const zEdge of [-1,1]){
             const quoinZ=centerZ+zEdge*(depth/2-.34);
             box('warmStone',faceX+side*.28,height/2,quoinZ,.22,height-.45,.38);
             for(let y=.8;y<height-.45;y+=.72)box('trim',faceX+side*.39,y,quoinZ,.12,.12,.43);
             sideElevationDetails++;
           }
           if((j+variation)%2===0){
             const escapeZ=centerZ+end*4.15,escapeX=faceX+side*.62;
             for(const level of [3.25,6.15]){
               box('rust',faceX+side*.50,level,escapeZ,.95,.11,1.46);
               for(const zRail of [-.66,.66]){
                 rod('rust',[escapeX,level+.08,escapeZ+zRail],[escapeX,level+.88,escapeZ+zRail],.035);
                 rod('rust',[escapeX,level+.88,escapeZ+zRail],[escapeX,level+.88,escapeZ-zRail],.035);
               }
               for(let rung=0;rung<5;rung++)rod('rust',[escapeX,level+.18+rung*.13,escapeZ-.34],[escapeX,level+.18+rung*.13,escapeZ+.34],.022);
             }
             rod('rust',[escapeX,3.15,escapeZ-.34],[escapeX,6.20,escapeZ-.34],.035);
             rod('rust',[escapeX,3.15,escapeZ+.34],[escapeX,6.20,escapeZ+.34],.035);
             sideElevationDetails+=10;
           }
           finishedEndWalls++;
         }
         sideStreetBuildings++;
       }
       setSceneryLayer(false);
       for(let x=24;x<137;x+=23){cylinder('pole',side*x,3.3,cross.z+end*8.1,.065,6.2);rod('pole',[side*x,6.3,cross.z+end*8.1],[side*x,6.3,cross.z+end*6.5],.045);box('dark',side*x,6.26,cross.z+end*6.4,.24,.10,.48);}
     }
   }
   // Double-yellow centre lines continue through the side-street junction.
   for(const side of [-1,1])for(let x=13;x<133;x+=8){box('yellow',side*x,.025,cross.z-.045,4,.009,.055);box('yellow',side*x,.025,cross.z+.045,4,.009,.055);}
   // Zebra bars run along Queen Street, distributed across the roadway width.
   for(const end of [-1,1])for(let stripe=0;stripe<mainCrosswalkStripeCount;stripe++){
     const x=(stripe-(mainCrosswalkStripeCount-1)/2)*1.30,z=cross.z+end*mainCrosswalkCenterOffset;
     box('white',x,.014,z,.46,.024,3.2);crosswalkStripes++;
   }
   // Side-street bars run along the cross street, distributed across its roadway width.
   for(const side of [-1,1])for(let stripe=0;stripe<sideCrosswalkStripeCount;stripe++){
     const x=side*sideCrosswalkCenterOffset,z=cross.z+(stripe-(sideCrosswalkStripeCount-1)/2)*1.38;
     box('white',x,.014,z,3.2,.024,.46);crosswalkStripes++;
   }
 }
 // A small green setback interrupts the north-side row near the start of the drive.
 setSceneryLayer(true);
 const park={minZ:-178,maxZ:-143,frontX:-11.45,backX:-28};
 box('parkGrass',-19.5,.12,-160.5,16.2,.16,34.7);box('path',-18.9,.216,-160.4,15.0,.024,2.45);
 for(const z of [park.minZ,park.maxZ]){box('warmStone',-19.6,.38,z,16.8,.40,.36);rod('fence',[-27.7,1.05,z],[-11.5,1.05,z],.025);for(let x=-27.5;x<-11.5;x+=.48)rod('fence',[x,.56,z],[x,1.06,z],.015);}
 for(const [a,b] of [[park.minZ,-163],[-157.7,park.maxZ]]){
   rod('fence',[park.frontX,1.03,a],[park.frontX,1.03,b],.025);for(let z=a;z<b;z+=.48)rod('fence',[park.frontX,.25,z],[park.frontX,1.03,z],.015);
 }
 box('brick2',park.backX-.2,3.2,-160.5,.4,6.05,35.6);box('warmStone',park.backX-.15,6.27,-160.5,.56,.18,35.8);
 const mural=canvasMap(ctx=>{
   ctx.canvas.width=1024;ctx.fillStyle='#bdab86';ctx.fillRect(0,0,1024,256);const palette=['#977756','#657f75','#42636b','#d0ba8b'];
   for(let i=0;i<14;i++){ctx.fillStyle=palette[i%4];ctx.beginPath();ctx.ellipse(20+i*87,186+(i%3)*12,87,54,0,Math.PI,Math.PI*2);ctx.fill();}
   ctx.fillStyle='#ead4a2';ctx.beginPath();ctx.arc(776,63,30,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3c5a5b';
   for(let i=0;i<31;i++){const h=18+(i*17%53);ctx.fillRect(i*36,224-h,25,h);}
   ctx.fillRect(640,93,3,131);ctx.fillRect(628,124,27,7);ctx.fillStyle='#f0ddac';ctx.textAlign='center';ctx.font='bold 33px Arial';ctx.fillText('QUEEN WEST',315,60);ctx.font='12px Arial';ctx.fillText('A LITTLE ROOM TO BREATHE',315,81);
 });
 const muralMat=new THREE.MeshStandardMaterial({map:mural,roughness:.94});const muralMesh=new THREE.Mesh(new THREE.PlaneGeometry(30,5.1),muralMat);muralMesh.rotation.y=Math.PI/2;muralMesh.position.set(park.backX+.025,3.28,-160.5);scene.add(muralMesh);
 for(const [x,z] of [[-16,-171],[-24,-169],[-22,-150],[-15,-148]]){
   cylinder('bark',x,2.0,z,.14,3.55);for(let j=0;j<7;j++){const a=j*2.4,r=1.0+((j*7)%4)*.16;rod('bark',[x,2.5,z],[x+Math.sin(a),4,z+Math.cos(a)],.045);add(leafGeo,mats[['leaf','leaf2','leaf3'][j%3]],x+Math.sin(a),4.5+(j%3)*.3,z+Math.cos(a),r,r*.85,r);}
 }
 // Two parked bicycles lean beside the park entrance, away from the sidewalk walking line.
 const wheel=new THREE.TorusGeometry(.33,.025,5,20);wheel.rotateY(Math.PI/2);
 for(const z of [-165,-155]){
   for(const dz of [-.58,.58]){add(wheel,mats.rubber,-12.0,.57,z+dz,1,1,1);rod('steel',[-12,.57,z+dz],[-12,.86,z],.009);}
   for(const [a,b] of [[[.57,-.58],[.92,-.1]],[[.92,-.1],[.57,.58]],[[.57,.58],[.57,0]],[[.57,0],[.92,-.1]],[[.57,0],[.94,.35]],[[.94,.35],[.57,.58]],[[.92,-.1],[.94,.35]]])rod('rust',[-12,a[0],z+a[1]],[-12,b[0],z+b[1]],.018);
   box('rubber',-12,.98,z-.12,.14,.055,.24);rod('steel',[-12,.96,z+.35],[-12,1.14,z+.43],.018);rod('rubber',[-12.2,1.14,z+.43],[-11.8,1.14,z+.43],.022);
 }
 setSceneryLayer(false);
 return {pitchedRoof,park,sideStreetBuildings,sideStreetWindows,finishedEndWalls,sideElevationDetails,sideStreetAwnings,crosswalkStripes,mainCrosswalkStripeCount,sideCrosswalkStripeCount,mainCrosswalkCenterOffset,sideCrosswalkCenterOffset,mainCrosswalkSpacing:1.30,sideCrosswalkSpacing:1.38,mainCrosswalkOrientation:'along-Queen-Street',sideCrosswalkOrientation:'along-side-street',mainCrosswalkStripeSize:[.46,3.2],sideCrosswalkStripeSize:[3.2,.46],sideStreetSidewalkInnerEdge};
}
