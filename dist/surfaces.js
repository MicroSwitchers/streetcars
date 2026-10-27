import * as THREE from 'three';
import {mergeGeometries} from 'geometry-utils';
import {addWindowInterior,roomDepthGLSL} from './facade-windows.js';

// An antialiased curtain wall needs no per-window geometry or image atlas.
// Physical floor/bay modules work on every face of merged or instanced towers.
export function createOfficeMaterial(){
 const m=new THREE.MeshStandardMaterial({color:0x738d95,roughness:.25,metalness:.18,emissive:0xffffff,emissiveIntensity:0});
 m.name='Office_Curtain_Wall';m.envMapIntensity=1.05;
 m.onBeforeCompile=shader=>{
   const varying='varying vec2 vOfficeCoord;varying float vOfficeWall;varying vec3 vOfficeWorld;varying vec3 vOfficeNormal;\n';
   shader.vertexShader=varying+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 officeP=vec4(transformed,1.);vec3 officeN=normal;
     #ifdef USE_INSTANCING
       officeP=instanceMatrix*officeP;officeN=mat3(instanceMatrix)*officeN;
     #endif
     officeP=modelMatrix*officeP;officeN=normalize(mat3(modelMatrix)*officeN);
     vOfficeCoord=vec2(abs(officeN.x)>abs(officeN.z)?officeP.z:officeP.x,officeP.y);
     vOfficeWall=1.-step(.6,abs(officeN.y));
     vOfficeWorld=officeP.xyz;vOfficeNormal=officeN;
     #include <project_vertex>`);
   shader.fragmentShader=varying+roomDepthGLSL+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;',`
     vec2 officeGrid=vOfficeCoord/vec2(1.45,3.30),officeCell=floor(officeGrid),officeF=fract(officeGrid);
     vec2 officeAA=max(fwidth(officeGrid),vec2(.0001));
     float officePane=smoothstep(.025-officeAA.x,.025+officeAA.x,officeF.x)*(1.-smoothstep(.975-officeAA.x,.975+officeAA.x,officeF.x));
     officePane*=smoothstep(.23-officeAA.y,.23+officeAA.y,officeF.y)*(1.-smoothstep(.96-officeAA.y,.96+officeAA.y,officeF.y));
     // Fade subpixel glazing detail to its average coverage at a distance.
     officePane=mix(officePane,.66,smoothstep(.22,.65,max(officeAA.x,officeAA.y)))*vOfficeWall;
     vec2 officeRoom=floor(officeCell/vec2(3.,1.));
     float officeSeed=fract(sin(dot(officeRoom,vec2(37.719,78.233)))*43758.5453);
     float officeFar=smoothstep(.22,.65,max(officeAA.x,officeAA.y));
     vec3 officeView=normalize(cameraPosition-vOfficeWorld),officeN=normalize(vOfficeNormal);
     vec3 officeT=abs(officeN.y)>.8?vec3(1.,0.,0.):normalize(cross(vec3(0.,1.,0.),officeN));
     float officeForward=max(.18,abs(dot(officeView,officeN)));
     float officeShade=qsRoomShade((officeF-vec2(.025,.23))/vec2(.95,.73),vec3(-dot(officeView,officeT)*2.1/officeForward,-officeView.y*1.25/officeForward,-1.));
     officeShade=mix(officeShade,.8,officeFar);
     float officeOccupied=mix(smoothstep(.51,.56,officeSeed)*(.30+fract(officeSeed*19.)*.65),.27,officeFar);
     vec3 officeKelvin=mix(vec3(1.,.67,.36),vec3(.65,.81,1.),step(.85,officeSeed));
     vec3 totalEmissiveRadiance=emissive*officeKelvin*officeOccupied*officePane*officeShade;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     #include <map_fragment>
     float officeTint=.88+.12*fract(sin(dot(officeCell,vec2(12.9898,37.719)))*43758.5453);
     officeTint=mix(officeTint,.94,officeFar);
     diffuseColor.rgb*=mix(vec3(.42,.46,.47),vec3(officeTint*mix(.72,1.05,officeShade)),officePane);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.76,roughnessFactor,officePane);');
 };
 m.customProgramCacheKey=()=> 'office-curtain-wall-v2-depth';return m;
}

// All surface detail is generated locally, including the alpha-cutout foliage.
// A fixed seed keeps the same street on every visit and in the portable build.
function random(seed=501){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function texture(canvas){const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
function canvas(size=512){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function relief(source){const c=canvas(source.width),ctx=c.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){const v=pixels.data[i]*.3+pixels.data[i+1]*.59+pixels.data[i+2]*.11;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}ctx.putImageData(pixels,0,0);const t=texture(c);t.colorSpace=THREE.NoColorSpace;return t;}
function roughness(source,low,high){
 const c=canvas(source.width),ctx=c.getContext('2d');ctx.drawImage(source,0,0);
 const pixels=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<pixels.data.length;i+=4){
   const value=255*(low+(high-low)*pixels.data[i]/255);
   pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;
 }
 ctx.putImageData(pixels,0,0);const t=texture(c);t.colorSpace=THREE.NoColorSpace;return t;
}

// Five small seamless sets, with independent colour, physical relief and
// roughness. All work happens once at load; no additional per-frame sampling.
function brickFinish(index){
 const size=512,cols=8,rows=16,tileX=1.68,tileY=1.168;
 const palettes=[[151,91,70],[166,112,83],[177,151,112],[112,89,76],[137,123,101]];
 const mortar=[[119,111,95],[133,123,103],[151,140,118],[108,104,92],[133,128,111]][index];
 const hash=(x,y,salt=0)=>{let v=Math.imul(x+101,374761393)^Math.imul(y+197,668265263)^Math.imul(index+salt+1,1274126177);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;};
 const mod=(x,n)=>(x%n+n)%n,smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const noise=(x,y,period,salt)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(0,1,x-ix),fy=smooth(0,1,y-iy);const n=(a,b)=>hash(mod(a,period),mod(b,period),salt);return (n(ix,iy)*(1-fx)+n(ix+1,iy)*fx)*(1-fy)+(n(ix,iy+1)*(1-fx)+n(ix+1,iy+1)*fx)*fy;};
 const colour=canvas(size),height=canvas(size),rough=canvas(size);
 const contexts=[colour,height,rough].map(c=>c.getContext('2d')),images=contexts.map(c=>c.createImageData(size,size));
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const row=Math.floor(y/32);
   // Half-running bond for most walls. The older brown stock includes regular
   // header courses; the fifth finish uses alternating header/stretcher rows.
   const header=index===3?row%8===7:index===4&&row%2===1;
   const pitch=header?32:64,offset=(row%2)*pitch/2,col=Math.floor((x+offset)/pitch),id=mod(col,header?16:8);
   const lx=mod(x+offset,pitch),ly=y%32,seed=hash(id,row,3);
   const clay=noise(x/32,y/32,16,11)-.5,grain=hash(x,y,17)-.5;
   const edge=noise(x/8,y/8,64,23)-.5;
   const joint=.0085+(hash(id,row,29)-.5)*.002;
   const d=Math.min(Math.min(lx,pitch-lx)*tileX/size,Math.min(ly,32-ly)*tileY/size)-joint*.5+edge*.0015;
   const face=smooth(-.0009,.0012,d),bevel=smooth(0,.0035,d);
   const fired=(seed-.5)*.13,warm=(hash(id,row,37)-.5)*9;
   const body=1+fired+clay*.065+grain*.035;
   const patina=(noise(x/128,y/128,4,43)-.5)*.035;
   const i=(y*size+x)*4;
   for(let c=0;c<3;c++){
     const value=palettes[index][c]*body+(c===0?warm:c===2?-warm*.5:0);
     images[0].data[i+c]=Math.round((mortar[c]*(1+grain*.025)*(1-face)+value*face)*(1+patina));
   }
   // Darker clay is not lower geometry. All fired faces have the same nominal
   // height, with only shallow pores and softened/chipped mortar edges.
   const h=255*(.24*(1-face)+(.69+bevel*.13+clay*.018+grain*.009)*face);
   const r=255*(.96*(1-face)+(.84+(hash(id,row,47)-.5)*.065+grain*.035)*face);
   for(let c=0;c<3;c++){images[1].data[i+c]=h;images[2].data[i+c]=r;}
   for(const image of images)image.data[i+3]=255;
 }
 contexts.forEach((c,i)=>c.putImageData(images[i],0,0));
 const map=texture(colour),bumpMap=texture(height),roughnessMap=texture(rough);
 bumpMap.colorSpace=roughnessMap.colorSpace=THREE.NoColorSpace;
 return {map,bumpMap,roughnessMap};
}

// Large, low-contrast variation breaks up identical paving and brick repeats.
// The height term gives masonry a little weathering where it meets the street.
function weathering(material,strength,baseDirt=0){
 const compile=material.onBeforeCompile,cache=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
   compile(shader);
   shader.vertexShader='varying vec3 vWeatherPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 weatherWorld=vec4(transformed,1.);
     #ifdef USE_INSTANCING
       weatherWorld=instanceMatrix*weatherWorld;
     #endif
     vWeatherPosition=(modelMatrix*weatherWorld).xyz;
     #include <project_vertex>`);
   shader.fragmentShader=`
     varying vec3 vWeatherPosition;
     float surfaceHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
     float surfaceNoise(vec2 p){
       vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
       return mix(mix(surfaceHash(cell),surfaceHash(cell+vec2(1.,0.)),f.x),mix(surfaceHash(cell+vec2(0.,1.)),surfaceHash(cell+1.),f.x),f.y);
     }
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     #include <map_fragment>
     float mottling=surfaceNoise(vWeatherPosition.xz*.36+vWeatherPosition.y*.15)*.6+surfaceNoise(vWeatherPosition.xz*.075)*.4;
     float weatherTone=1.-${strength.toFixed(3)}*(1.-mottling);
     weatherTone*=1.-${baseDirt.toFixed(3)}*exp(-max(0.,vWeatherPosition.y)*1.6);
     diffuseColor.rgb*=weatherTone;
   `);
 };
 material.customProgramCacheKey=()=>`${cache}-weather-${strength}-${baseDirt}`;
 material.needsUpdate=true;
}

export function createFoliage(){
 const c=canvas(256),ctx=c.getContext('2d'),leafRandom=random(94);
 for(let j=0;j<40;j++){
   const a=j*2.39996,r=Math.sqrt((j+.5)/40)*94,x=128+Math.sin(a)*r,y=128+Math.cos(a)*r*1.04,length=42+leafRandom()*17,halfWidth=14+leafRandom()*5;
   ctx.save();ctx.translate(x,y);ctx.rotate(a+(leafRandom()-.5)*.7);
   const leafTone=ctx.createLinearGradient(-halfWidth,0,halfWidth,0);leafTone.addColorStop(0,'#879b5e');leafTone.addColorStop(.48,j%3?'#c9d59a':'#a9c17b');leafTone.addColorStop(1,'#a3b974');ctx.fillStyle=leafTone;
   ctx.beginPath();ctx.moveTo(0,length/2);ctx.bezierCurveTo(-halfWidth,length*.13,-halfWidth,-length*.20,0,-length/2);ctx.bezierCurveTo(halfWidth,-length*.20,halfWidth,length*.13,0,length/2);ctx.fill();
   ctx.strokeStyle='#dae2ac90';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,length*.35);ctx.lineTo(0,-length*.40);ctx.stroke();ctx.restore();
 }
 // A twig with small overlapping leaves replaces each former oversized leaf
 // card. The same 72 cards now describe thousands of fine canopy leaflets.
 ctx.strokeStyle='#727943';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(128,242);ctx.bezierCurveTo(120,180,140,80,128,18);ctx.stroke();
 for(let row=0;row<8;row++)for(const side of [-1,1]){
   const y=37+row*25,x=128+side*(24+leafRandom()*25),length=29+leafRandom()*13;
   ctx.strokeStyle='#869155';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(128,y+20);ctx.lineTo(x,y);ctx.stroke();
   ctx.save();ctx.translate(x,y);ctx.rotate(side*(.50+leafRandom()*.35));
   const gradient=ctx.createLinearGradient(-14,0,14,0);gradient.addColorStop(0,'#8d9e60');gradient.addColorStop(.48,'#d4dba6');gradient.addColorStop(1,'#acbc77');ctx.fillStyle=gradient;
   ctx.beginPath();ctx.moveTo(0,length*.53);ctx.bezierCurveTo(-19,length*.15,-16,-length*.26,0,-length*.56);ctx.bezierCurveTo(16,-length*.26,19,length*.15,0,length*.53);ctx.fill();
   ctx.strokeStyle='#e2e7b485';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,length*.40);ctx.lineTo(0,-length*.44);ctx.stroke();ctx.restore();
 }
 const map=texture(c),rnd=random(84),geometries=[];
 // Preserve cutout coverage in distant mip levels: fine leaves must not vanish
 // as their alpha values average with the transparent space around the twig.
 const base=ctx.getImageData(0,0,256,256),coverage=Array.from({length:256*256},(_,i)=>base.data[i*4+3]>=115?1:0).reduce((a,b)=>a+b,0)/(256*256);
 map.mipmaps=[c];map.generateMipmaps=false;
 for(let size=128;size>=1;size/=2){const mip=canvas(size),mc=mip.getContext('2d');mc.drawImage(c,0,0,size,size);const pixels=mc.getImageData(0,0,size,size);let lo=.25,hi=4;
   for(let pass=0;pass<10;pass++){const scale=(lo+hi)/2;let visible=0;for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]*scale>=115)visible++;if(visible/(size*size)<coverage)lo=scale;else hi=scale;}
   for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=Math.min(255,pixels.data[i]*(lo+hi)/2);mc.putImageData(pixels,0,0);map.mipmaps.push(mip);
 }
 for(let i=0;i<72;i++){
   const angle=i*2.39996,up=1-2*(i+.5)/72,ring=Math.sqrt(1-up*up),r=.55+rnd()*.5;
   const geo=new THREE.PlaneGeometry(.34+rnd()*.26,.42+rnd()*.26);
   geo.rotateX((rnd()-.5)*Math.PI);geo.rotateY(angle);geo.rotateZ(rnd()*Math.PI);
   geo.translate(Math.cos(angle)*ring*r,up*r,Math.sin(angle)*ring*r);
   const positions=geo.attributes.position,normals=geo.attributes.normal,softNormal=new THREE.Vector3(),radial=new THREE.Vector3();
   for(let v=0;v<4;v++){softNormal.fromBufferAttribute(normals,v);radial.fromBufferAttribute(positions,v).normalize();if(softNormal.dot(radial)<0)softNormal.negate();softNormal.lerp(radial,.68).normalize();normals.setXYZ(v,softNormal.x,softNormal.y,softNormal.z);}
   const shade=.65+Math.max(0,up)*.35+rnd()*.1,colors=[];
   for(let v=0;v<4;v++)colors.push(shade,shade,shade);
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometries.push(geo);
 }
 const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
 geometry.userData.foliage={cards:72,leafletsPerCard:56,textureSize:256};
 return {geometry,map};
}

// Shared deterministic tree silhouettes for both routes, parks and side roads.
// Seven to nine tapered, uncapped branch segments keep the former canopy budget.
export function treeShape(x,z,size=1,seed=z,clumps=6){
 const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);},variant=Math.floor(hash(seed+8)*3);
 const spread=[1.04,1.24,.83][variant],stretch=[1.,.88,1.18][variant],angle=hash(seed)*Math.PI*2;
 const ground=.18,leanX=Math.sin(angle)*.11*size,leanZ=Math.cos(angle)*.10*size;
 const fork=[x+leanX,ground+1.9*size,z+leanZ],top=[x+leanX*1.7,ground+4.03*size,z+leanZ*1.7];
 const branches=[{a:[x,ground,z],b:fork,r:.12*size},{a:fork,b:top,r:.078*size}],crowns=[];
 for(let i=0;i<clumps-1;i++){
   const a=angle+i*2.39996,d=(.84+hash(seed+i+19)*.31)*spread*size,y=ground+(3.05+(i%3)*.37)*size;
   const centre=[x+Math.sin(a)*d,y+.43*size,z+Math.cos(a)*d],tip=[centre[0],y,centre[2]],r=(.78+hash(seed+i+45)*.19)*size;
   branches.push({a:[fork[0],fork[1]+i*.09*size,fork[2]],b:tip,r:(.041-i*.002)*size});
   crowns.push({x:centre[0],y:centre[1],z:centre[2],sx:r*spread,sy:r*stretch,sz:r*(1.03+hash(i+seed)*.13),yaw:a,tint:(i+variant)%3});
   if(i<2)branches.push({a:[(fork[0]+tip[0])*.5,(fork[1]+tip[1])*.5,(fork[2]+tip[2])*.5],b:[tip[0]+Math.cos(a)*.28*size,tip[1]+.35*size,tip[2]-Math.sin(a)*.28*size],r:.017*size});
 }
 crowns.push({x:top[0],y:ground+4.40*size,z:top[2],sx:.83*spread*size,sy:.98*stretch*size,sz:.85*size,yaw:angle,tint:variant});
 return {x,z,size,variant,branches,crowns};
}

// World-scale UVs prevent tiny street details stretching over the entire route.
function worldSurface(material,metres){
 const compile=material.onBeforeCompile,cache=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 surfaceWorld = vec4(transformed, 1.0);
     #ifdef USE_INSTANCING
       surfaceWorld = instanceMatrix * surfaceWorld;
     #endif
     surfaceWorld = modelMatrix * surfaceWorld;
     #ifdef USE_MAP
       vMapUv = surfaceWorld.xz / ${metres.toFixed(2)};
     #endif
     #ifdef USE_BUMPMAP
       vBumpMapUv = surfaceWorld.xz / ${metres.toFixed(2)};
     #endif
     #ifdef USE_ROUGHNESSMAP
       vRoughnessMapUv = surfaceWorld.xz / ${metres.toFixed(2)};
     #endif
     #include <project_vertex>`);
 };
 material.customProgramCacheKey=()=>`${cache}-queen-surface-${metres}`;
 material.needsUpdate=true;
}

// Keep masonry courses at the same scale on both merged and pooled buildings.
function worldMasonry(material,scaleX=1.68,scaleY=1.168){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
     vec4 masonryPosition=vec4(transformed,1.);vec3 masonryNormal=normal;
     #ifdef USE_INSTANCING
       masonryPosition=instanceMatrix*masonryPosition;masonryNormal=mat3(instanceMatrix)*masonryNormal;
     #endif
     masonryPosition=modelMatrix*masonryPosition;masonryNormal=mat3(modelMatrix)*masonryNormal;
     vec2 masonryUv=vec2(abs(masonryNormal.x)>abs(masonryNormal.z)?masonryPosition.z:masonryPosition.x,
       abs(masonryNormal.y)>.5?masonryPosition.z:masonryPosition.y)/vec2(${scaleX.toFixed(2)},${scaleY.toFixed(2)});
     #ifdef USE_MAP
       vMapUv=masonryUv;
     #endif
     #ifdef USE_BUMPMAP
       vBumpMapUv=masonryUv;
     #endif
     #ifdef USE_ROUGHNESSMAP
       vRoughnessMapUv=masonryUv;
     #endif
     #include <project_vertex>`);
 };
 material.customProgramCacheKey=()=>key+`-world-masonry-v2-${scaleX}-${scaleY}`;material.needsUpdate=true;
}

// Embedded rail heads, grooves and paint share the pavement's depth surface.
// Integrating each strip over its pixel footprint prevents subpixel sparkle,
// without stacking near-coplanar geometry or widening the physical rail gauge.
function roadDetails(material,route){
 const surfaceCompile=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
   surfaceCompile(shader);
   Object.assign(shader.uniforms,{
     roadTrackX:{value:Math.abs(route.trackX)},roadHalfGauge:{value:route.gauge/2},
     roadCrossings:{value:new THREE.Vector3(...route.crossings.map(c=>c.z))},
     railColor:{value:new THREE.Color(0x9baba6)},grooveColor:{value:new THREE.Color(0x202925)},
     roadWhite:{value:new THREE.Color(0xe7dfbf)},roadYellow:{value:new THREE.Color(0xd3ad55)},
   });
   shader.vertexShader='varying vec2 vRoadPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('surfaceWorld = modelMatrix * surfaceWorld;','surfaceWorld = modelMatrix * surfaceWorld;\n vRoadPosition = surfaceWorld.xz;');
   shader.fragmentShader=`
     varying vec2 vRoadPosition;
     uniform float roadTrackX;uniform float roadHalfGauge;uniform vec3 roadCrossings;
     uniform vec3 railColor;uniform vec3 grooveColor;uniform vec3 roadWhite;uniform vec3 roadYellow;
     float roadBand(float distance,float width,float pixelWidth){
       float footprint=max(pixelWidth,.00001);
       return clamp((min(distance+footprint*.5,width*.5)-max(distance-footprint*.5,-width*.5))/footprint,0.,1.);
     }
   `+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     #include <map_fragment>
     vec2 roadPixel=max(fwidth(vRoadPosition),vec2(.00001));
     float trackDistance=abs(vRoadPosition.x)-roadTrackX;
     float roadTrack=roadBand(trackDistance,2.25,roadPixel.x);
     float railDistance=abs(trackDistance)-roadHalfGauge;
     float roadGroove=roadBand(railDistance,.12,roadPixel.x);
     float roadRail=roadBand(railDistance,.057,roadPixel.x);
     float crossingDistance=10000.,stopLine=0.;
     for(int crossing=0;crossing<3;crossing++){
       float dz=vRoadPosition.y-roadCrossings[crossing];
       crossingDistance=min(crossingDistance,abs(dz));
       // Zebra crossings are supplied once by the neighbourhood geometry.
       // A second shader stripe bank would show through its gaps and edges.
       stopLine=max(stopLine,roadBand(abs(dz)-11.,.25,roadPixel.y)*roadBand(abs(vRoadPosition.x)-3.8,7.,roadPixel.x));
     }
     float clearCrossing=smoothstep(12.-roadPixel.y*.5,12.+roadPixel.y*.5,crossingDistance);
     float dash=mod(vRoadPosition.y+490.+4.5,9.)-4.5;
     float yellowPaint=roadBand(abs(vRoadPosition.x)-.085,.065,roadPixel.x)*roadBand(dash,5.,roadPixel.y)*clearCrossing;
     float whitePaint=max(roadBand(abs(vRoadPosition.x)-4.1,.09,roadPixel.x)*roadBand(dash,3.,roadPixel.y)*clearCrossing,stopLine);
     diffuseColor.rgb*=mix(vec3(1.),vec3(.60,.63,.62),roadTrack);
     diffuseColor.rgb=mix(diffuseColor.rgb,roadYellow,yellowPaint);
     diffuseColor.rgb=mix(diffuseColor.rgb,roadWhite,whitePaint);
     diffuseColor.rgb=mix(diffuseColor.rgb,grooveColor,roadGroove);
     diffuseColor.rgb=mix(diffuseColor.rgb,railColor,roadRail);
   `);
   shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,.44,roadRail);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n metalnessFactor=mix(metalnessFactor,.82,roadRail);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n normal=normalize(mix(normal,nonPerturbedNormal,roadRail));');
 };
 material.customProgramCacheKey=()=> 'queen-road-integrated-v2';
 material.userData.integratedRails=true;
 material.needsUpdate=true;
}

export function finishSurfaces(mats,renderer,route){
 const rnd=random(127),asphalt=canvas(),height=canvas(),rough=canvas();
 const ctx=asphalt.getContext('2d'),hc=height.getContext('2d'),ar=rough.getContext('2d');
 ctx.fillStyle='#606361';ctx.fillRect(0,0,512,512);hc.fillStyle='#555555';hc.fillRect(0,0,512,512);ar.fillStyle='#efefef';ar.fillRect(0,0,512,512);
 // Independent aggregate height and roughness: a dark stone is not a hole.
 // Wrap stones over tile edges, so grazing views never expose a texture seam.
 for(let i=0;i<32000;i++){
   const x=rnd()*512,y=rnd()*512,r=.45+rnd()*1.40,tone=61+rnd()*77,relief=100+rnd()*88,matte=216+rnd()*35;
   const points=Array.from({length:5},(_,j)=>{const a=j*Math.PI*2/5,rr=r*(.70+rnd()*.30);return [Math.cos(a)*rr,Math.sin(a)*rr];});
   for(const dx of [0,...(x<3?[512]:x>509?[-512]:[])])for(const dy of [0,...(y<3?[512]:y>509?[-512]:[])])for(const [c,value] of [[ctx,`rgb(${tone},${tone+2},${tone-1})`],[hc,`rgb(${relief},${relief},${relief})`],[ar,`rgb(${matte},${matte},${matte})`]]){
     c.fillStyle=value;c.beginPath();points.forEach(([px,py],j)=>j?c.lineTo(x+dx+px,y+dy+py):c.moveTo(x+dx+px,y+dy+py));c.closePath();c.fill();
   }
 }
 for(let i=0;i<22000;i++){const x=rnd()*512,y=rnd()*512;ctx.fillStyle=i%2?'#c3c6bb25':'#141b2024';ctx.fillRect(x,y,.7,.7);}
 const roadMap=texture(asphalt),roadBump=texture(height),roadRoughness=texture(rough);roadBump.colorSpace=roadRoughness.colorSpace=THREE.NoColorSpace;
 for(const name of ['road','trackbed','patch']){const m=mats[name];m.map=roadMap;m.color.set(name==='trackbed'?0xb3b6b4:name==='patch'?0xc6cac3:0xe5e7e3);m.bumpMap=roadBump;m.bumpScale=.009;m.roughness=1;m.metalness=0;m.envMapIntensity=.55;m.roughnessMap=roadRoughness;worldSurface(m,1.8);weathering(m,.17);m.userData.asphaltFinish={tileMetres:1.8,mapSize:512,aggregateMillimetres:[3,13],independentRelief:true,dryRoughness:[.847,.984]};}
 roadDetails(mats.road,route);
 // Remaining surface decals are depth-biased, rather than relying on a few
 // millimetres of separation when viewed along hundreds of metres of street.
 for(const name of ['patch','white','yellow','groove','stone']){
   Object.assign(mats[name],{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
 }

 const concrete=canvas(),cc=concrete.getContext('2d');cc.fillStyle='#b5b2a6';cc.fillRect(0,0,512,512);
 for(let i=0;i<42000;i++){const v=90+rnd()*120;cc.fillStyle=`rgba(${v},${v-2},${v-9},.12)`;cc.fillRect(rnd()*512,rnd()*512,1+rnd()*2,1);}
 for(let i=0;i<180;i++){cc.fillStyle='#686c641b';cc.beginPath();cc.arc(rnd()*512,rnd()*512,rnd()*1.3+.3,0,Math.PI*2);cc.fill();}
 const concreteMap=texture(concrete),concreteBump=relief(concrete),concreteRoughness=roughness(concrete,.83,1.);
 for(const name of ['concrete','curb','stone','warmStone']){const m=mats[name];m.map=concreteMap;m.color.set(name==='curb'?0xd3cfc4:name==='warmStone'?0xd7c8ad:0xd2d0c8);m.bumpMap=concreteBump;m.bumpScale=.016;m.roughness=1;m.roughnessMap=concreteRoughness;worldSurface(m,2.6);weathering(m,.085);}
 // Vertical Dundas walls need wall-oriented UVs; pavement UVs would stretch
 // every aggregate fleck into a stripe up the facade.
 for(const name of ['dundasStone','dundasPlaster'])if(mats[name]){
   const m=mats[name];m.map=concreteMap;m.bumpMap=concreteBump;m.bumpScale=name==='dundasStone'?.014:.008;
   m.roughness=1;m.roughnessMap=concreteRoughness;worldMasonry(m,2.6,2.6);weathering(m,.10,.09);
 }

 // Shared 512px colour/height/roughness sets retain the old texture budget.
 // World-sized courses continue across separate facade meshes and instancing.
 for(let index=0;index<5;index++){
   const m=mats['brick'+index];Object.assign(m,brickFinish(index));
   m.color.setHex(0xffffff);m.metalness=0;m.bumpScale=.007;m.roughness=1;
   m.userData.brickFinish={tileMetres:[1.68,1.168],courseMetres:.073,stretcherMetres:.21,mapSize:512,bond:index===3?'common':index===4?'english':'running'};
   weathering(m,.10,.10);worldMasonry(m);
 }

 const windows=canvas(256),wc=windows.getContext('2d'),sky=wc.createLinearGradient(0,0,100,256);
 sky.addColorStop(0,'#879fa8');sky.addColorStop(.5,'#627c84');sky.addColorStop(1,'#51656b');wc.fillStyle=sky;wc.fillRect(0,0,256,256);
 mats.glass.map=texture(windows);mats.glass.color.setHex(0xb8cbd0);mats.glass.metalness=.18;mats.glass.roughness=.16;mats.glass.envMapIntensity=1.1;
 addWindowInterior(mats.glass);
 mats.storeGlass.map=mats.glass.map;mats.storeGlass.color.setHex(0xe1ecee);mats.storeGlass.metalness=.05;mats.storeGlass.roughness=.13;mats.storeGlass.envMapIntensity=.65;
 if(mats.dundasCurtainGlass){const m=mats.dundasCurtainGlass;m.map=mats.glass.map;m.color.setHex(0xadc2c6);m.metalness=.18;m.roughness=.19;m.envMapIntensity=1.1;addWindowInterior(m);}
 if(mats.dundasStoreGlass){const m=mats.dundasStoreGlass;m.map=mats.storeGlass.map;m.color.copy(mats.storeGlass.color);m.metalness=.05;m.roughness=.13;m.envMapIntensity=.65;}
 // Fine felt texture keeps the roofs from reading as perfectly flat plastic.
 const roofing=canvas(256),rc=roofing.getContext('2d');rc.fillStyle='#898b86';rc.fillRect(0,0,256,256);
 for(let i=0;i<12000;i++){rc.fillStyle=i%2?'#dddcd42a':'#171e252b';rc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1);}
 mats.roof.bumpMap=relief(roofing);mats.roof.bumpScale=.018;mats.roof.roughnessMap=roughness(roofing,.86,1.);mats.roof.roughness=1;worldSurface(mats.roof,1.8);weathering(mats.roof,.12);
 if(mats.dundasRoof){const m=mats.dundasRoof;m.bumpMap=mats.roof.bumpMap;m.bumpScale=.018;m.roughnessMap=mats.roof.roughnessMap;m.roughness=1;worldSurface(m,1.8);weathering(m,.12);}
 // Low-contrast, mipmapped timber grain gives the AGO ribs and porches a
 // material finish without repeating high-contrast lines in distant views.
 if(mats.dundasTimber){
   const wood=canvas(256),w=wood.getContext('2d');w.fillStyle='#c5b391';w.fillRect(0,0,256,256);
   for(let i=0;i<7000;i++){w.fillStyle=i%2?'#66523e12':'#f1debd17';w.fillRect(rnd()*256,rnd()*256,.5+rnd(),2+rnd()*12);}
   const m=mats.dundasTimber;m.map=texture(wood);m.bumpMap=relief(wood);m.bumpScale=.006;m.roughnessMap=roughness(wood,.78,.96);m.roughness=1;worldMasonry(m,1.4,2.8);weathering(m,.08,.08);
   for(const material of new Set(Object.values(mats)))if(/Prop_Cedar$/.test(material.name)){material.map=m.map;material.bumpMap=m.bumpMap;material.bumpScale=.004;material.roughnessMap=m.roughnessMap;material.roughness=1;worldMasonry(material,.9,1.4);}
 }
 // Mipmapped, irregular turf variation gives the garden floor scale without
 // parallel grass stripes or thousands of distant blade meshes.
 const turf=canvas(256),tc=turf.getContext('2d');tc.fillStyle='#82906a';tc.fillRect(0,0,256,256);
 for(let i=0;i<18000;i++){const v=rnd();tc.fillStyle=v<.5?'#35482b35':'#c9c28b2b';tc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1+rnd()*3);}
 for(let i=0;i<32;i++){const x=rnd()*256,y=rnd()*256,r=8+rnd()*28,g=tc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'#bfbd741b':'#344a2820');g.addColorStop(1,'#00000000');tc.fillStyle=g;tc.fillRect(x-r,y-r,r*2,r*2);}
 mats.parkGrass.map=texture(turf);mats.parkGrass.color.setHex(0xc0c5a0);mats.parkGrass.bumpMap=relief(turf);mats.parkGrass.bumpScale=.015;mats.parkGrass.roughness=1;worldSurface(mats.parkGrass,2.8);
 mats.steel.roughness=.24;mats.steel.metalness=.88;
 const bark=canvas(256),bc=bark.getContext('2d');bc.fillStyle='#857665';bc.fillRect(0,0,256,256);
 for(let i=0;i<430;i++){const x=rnd()*256,y=rnd()*256;bc.strokeStyle=i%3?'#302c253b':'#d6c9a336';bc.lineWidth=.5+rnd()*2;bc.beginPath();bc.moveTo(x,y);bc.bezierCurveTo(x-2,y+8,x+3,y+18,x+(rnd()-.5)*7,y+25+rnd()*50);bc.stroke();}
 mats.bark.map=texture(bark);mats.bark.color.setHex(0xd3c9b8);mats.bark.bumpMap=relief(bark);mats.bark.bumpScale=.005;mats.bark.roughness=.96;worldMasonry(mats.bark,.7,2.4);
 for(const m of Object.values(mats))for(const key of ['map','bumpMap','roughnessMap'])if(m[key])m[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
}
