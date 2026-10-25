import * as THREE from 'three';
import {mergeGeometries} from 'geometry-utils';

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
 const c=canvas(128),ctx=c.getContext('2d'),gradient=ctx.createLinearGradient(25,120,95,5);
 gradient.addColorStop(0,'#748645');gradient.addColorStop(.45,'#c8d19b');gradient.addColorStop(1,'#e1e7bf');
 ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(64,124);ctx.bezierCurveTo(7,88,13,35,64,4);ctx.bezierCurveTo(113,31,119,91,64,124);ctx.fill();
 ctx.strokeStyle='#edf0c178';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,119);ctx.lineTo(64,15);ctx.stroke();
 ctx.lineWidth=1;for(let y=35;y<100;y+=15)for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(64,y+15);ctx.lineTo(64+side*26,y-7);ctx.stroke();}
 const map=texture(c),rnd=random(84),geometries=[];
 for(let i=0;i<72;i++){
   const angle=i*2.39996,up=1-2*(i+.5)/72,ring=Math.sqrt(1-up*up),r=.55+rnd()*.5;
   const geo=new THREE.PlaneGeometry(.34+rnd()*.26,.42+rnd()*.26);
   geo.rotateX((rnd()-.5)*Math.PI);geo.rotateY(angle);geo.rotateZ(rnd()*Math.PI);
   geo.translate(Math.cos(angle)*ring*r,up*r,Math.sin(angle)*ring*r);
   const shade=.65+Math.max(0,up)*.35+rnd()*.1,colors=[];
   for(let v=0;v<4;v++)colors.push(shade,shade,shade);
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometries.push(geo);
 }
 const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
 return {geometry,map};
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
function worldMasonry(material,scaleX=.88,scaleY=1.08){
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
 const rnd=random(127),asphalt=canvas(),ctx=asphalt.getContext('2d');
 ctx.fillStyle='#555958';ctx.fillRect(0,0,512,512);
 for(let i=0;i<65000;i++){const v=45+rnd()*88;ctx.fillStyle=`rgba(${v},${v+2},${v+1},${.15+rnd()*.3})`;const s=rnd()<.93?1:2;ctx.fillRect(rnd()*512,rnd()*512,s,s);}
 // Faint aggregate patches and sealed hairline cracks, with no huge repeating decals.
 for(let i=0;i<24;i++){const x=rnd()*512,y=rnd()*512,r=8+rnd()*44,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'#b5b9af0a':'#101d2110');g.addColorStop(1,'#00000000');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
 ctx.strokeStyle='#222a2b55';ctx.lineWidth=1;
 for(let i=0;i<5;i++){let x=rnd()*512,y=rnd()*512;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<6;j++){x+=rnd()*22-11;y+=rnd()*17;ctx.lineTo(x,y);}ctx.stroke();}
 const roadMap=texture(asphalt),roadBump=relief(asphalt);
 const roadRoughness=roughness(asphalt,.72,1.);
 for(const name of ['road','trackbed','patch']){const m=mats[name];m.map=roadMap;m.color.set(name==='trackbed'?0xb3b6b4:name==='patch'?0xd2d6cf:0xe5e7e3);m.bumpMap=roadBump;m.bumpScale=.027;m.roughness=1;m.roughnessMap=roadRoughness;worldSurface(m,4);weathering(m,.12);}
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

 const bases=[[139,76,56],[158,99,72],[171,140,96],[112,85,75],[127,116,96]];
 bases.forEach((base,index)=>{
   const c=canvas(),b=c.getContext('2d');b.fillStyle='#8d897c';b.fillRect(0,0,512,512);
   for(let row=0;row<16;row++)for(let col=-1;col<5;col++){
     const x=col*128+(row%2)*64,y=row*32,f=.81+rnd()*.34;
     b.fillStyle=`rgb(${base.map(v=>Math.round(v*f)).join(',')})`;b.fillRect(x+2,y+2,124,28);
     b.fillStyle='#fff2d51c';b.fillRect(x+3,y+2,122,2);b.fillStyle='#281e1b33';b.fillRect(x+3,y+28,122,2);
     for(let n=0;n<50;n++){b.fillStyle=n%2?'#211c1520':'#ffe8c01d';b.fillRect(x+3+rnd()*120,y+4+rnd()*22,1+rnd()*5,1+rnd()*2);}
   }
   const m=mats['brick'+index];m.map=texture(c);m.bumpMap=relief(c);m.bumpScale=.045;m.roughness=1;m.roughnessMap=roughness(c,.82,1.);weathering(m,.13,.14);worldMasonry(m);
 });

 const windows=canvas(256),wc=windows.getContext('2d'),sky=wc.createLinearGradient(0,0,100,256);
 sky.addColorStop(0,'#88a7b7');sky.addColorStop(.4,'#597a89');sky.addColorStop(.48,'#83969b');sky.addColorStop(.51,'#33464a');sky.addColorStop(1,'#1c2e32');wc.fillStyle=sky;wc.fillRect(0,0,256,256);
 wc.fillStyle='#dfeaf51c';wc.beginPath();wc.moveTo(35,0);wc.lineTo(98,0);wc.lineTo(222,256);wc.lineTo(195,256);wc.fill();
 wc.fillStyle='#151e2538';for(let x=0;x<256;x+=40)wc.fillRect(x,132,24,124);
 mats.glass.map=texture(windows);mats.glass.color.setHex(0xb8cbd0);mats.glass.metalness=.18;mats.glass.roughness=.16;mats.glass.envMapIntensity=1.1;
 mats.storeGlass.map=mats.glass.map;mats.storeGlass.color.setHex(0xe1ecee);mats.storeGlass.metalness=.05;mats.storeGlass.roughness=.13;mats.storeGlass.envMapIntensity=.65;
 if(mats.dundasCurtainGlass){const m=mats.dundasCurtainGlass;m.map=mats.glass.map;m.color.setHex(0xadc2c6);m.metalness=.18;m.roughness=.19;m.envMapIntensity=1.1;}
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
 }
 // Mipmapped, irregular turf variation gives the garden floor scale without
 // parallel grass stripes or thousands of distant blade meshes.
 const turf=canvas(256),tc=turf.getContext('2d');tc.fillStyle='#82906a';tc.fillRect(0,0,256,256);
 for(let i=0;i<18000;i++){const v=rnd();tc.fillStyle=v<.5?'#35482b35':'#c9c28b2b';tc.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1+rnd()*3);}
 for(let i=0;i<32;i++){const x=rnd()*256,y=rnd()*256,r=8+rnd()*28,g=tc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%2?'#bfbd741b':'#344a2820');g.addColorStop(1,'#00000000');tc.fillStyle=g;tc.fillRect(x-r,y-r,r*2,r*2);}
 mats.parkGrass.map=texture(turf);mats.parkGrass.color.setHex(0xc0c5a0);mats.parkGrass.bumpMap=relief(turf);mats.parkGrass.bumpScale=.015;mats.parkGrass.roughness=1;worldSurface(mats.parkGrass,2.8);
 mats.steel.roughness=.24;mats.steel.metalness=.88;
 for(const m of Object.values(mats))for(const key of ['map','bumpMap','roughnessMap'])if(m[key])m[key].anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
}
