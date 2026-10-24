import * as THREE from 'three';
import {WEATHER,WEATHER_OFF,WEATHER_MODES,WEATHER_SEQUENCE,randomWeatherSequence,weatherPhase,mixWeather} from './weather-cycle.js';
export {WEATHER} from './weather-cycle.js';
export const WET_PATCH_GLSL=`
 float weatherHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float weatherNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(weatherHash(i),weatherHash(i+vec2(1,0)),f.x),mix(weatherHash(i+vec2(0,1)),weatherHash(i+1.),f.x),f.y);}
 float wetPatch(vec3 p){float n=weatherNoise(p.xz*.27)*.7+weatherNoise(p.xz*.71)*.3;float gutter=(1.-smoothstep(.12,.65,abs(abs(p.x)-7.03)))*.85;return max(smoothstep(.35,.72,n),gutter);}
 vec2 rainRipple(vec2 world,float time){vec2 p=world*1.8,cell=floor(p),centre=vec2(weatherHash(cell),weatherHash(cell+19.))*.66+.17;
   vec2 delta=fract(p)-centre;float distance=length(delta),age=fract(time*.85+weatherHash(cell+4.));float phase=distance-age*.68;
   float ring=exp(-phase*phase*700.)*sin(phase*48.)*(1.-age)*smoothstep(0.,.08,age);
   float antialias=1.-smoothstep(.18,.65,length(fwidth(p)));
   return delta/max(.001,distance)*ring*.012*antialias;}
`;

export function createWeather(scene,mats,lighting,graphics,renderer){
 const uniforms={weatherTime:{value:0},cloudCover:{value:.18},rainAmount:{value:0},wetness:{value:0},night:{value:0},golden:{value:0},storm:{value:0}};
 let preset='overcast',mode='fixed',time=0,cycleTime=0,night=0,focus=0;
 let phase=weatherPhase(0);
 let randomSeed=0,randomSequence=randomWeatherSequence(0);
 const blended={sun:[0,0,0]};
 // Compose with road markings, world UVs, window spill and stable shadow hooks.
 for(const name of ['road','trackbed','patch','concrete','curb','stone']){
   const material=mats[name],compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){
     compile.call(this,shader,renderer);shader.uniforms.wetness=uniforms.wetness;shader.uniforms.rainAmount=uniforms.rainAmount;shader.uniforms.weatherTime=uniforms.weatherTime;shader.uniforms.weatherNight=uniforms.night;
     shader.vertexShader='varying vec3 vWaterFilmPosition;varying vec3 vWaterFilmNormal;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
       vec4 weatherPosition=vec4(transformed,1.);vec3 weatherNormal=normal;
       #ifdef USE_INSTANCING
       weatherPosition=instanceMatrix*weatherPosition;weatherNormal=mat3(instanceMatrix)*weatherNormal;
       #endif
       vWaterFilmPosition=(modelMatrix*weatherPosition).xyz;vWaterFilmNormal=normalize(mat3(modelMatrix)*weatherNormal);`);
     shader.fragmentShader='uniform float wetness;uniform float rainAmount;uniform float weatherTime;uniform float weatherNight;varying vec3 vWaterFilmPosition;varying vec3 vWaterFilmNormal;\n'+WET_PATCH_GLSL+shader.fragmentShader;
     shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
       float waterFilm=0.;if(wetness>.001)waterFilm=wetness*(.28+.72*wetPatch(vWaterFilmPosition))*smoothstep(.85,.99,vWaterFilmNormal.y);
       roughnessFactor=mix(roughnessFactor,mix(.34,.20,weatherNight),waterFilm);
       diffuseColor.rgb*=mix(1.,.63,waterFilm);`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
       if(rainAmount>.001&&vWaterFilmNormal.y>.95){vec2 ripple=rainRipple(vWaterFilmPosition.xz,weatherTime)*rainAmount*wetPatch(vWaterFilmPosition);
         normal=normalize(normal+mat3(viewMatrix)*vec3(ripple.x,0.,ripple.y));}`);
   };material.customProgramCacheKey=()=>key+'-rain-water-film-v1';material.needsUpdate=true;
 }
 const sunDirection=new THREE.Vector3(34,48,38).normalize();
 const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,toneMapped:false,
   uniforms:{...uniforms,sunDirection:{value:sunDirection}},vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`uniform float weatherTime;uniform float cloudCover;uniform float night;uniform float golden;uniform float storm;uniform vec3 sunDirection;varying vec3 skyDirection;
   ${WET_PATCH_GLSL}
   float cloud(vec2 p){return weatherNoise(p)*.48+weatherNoise(p*2.03)*.26+weatherNoise(p*4.13)*.14+weatherNoise(p*8.07)*.08+weatherNoise(p*16.03)*.04;}
   float density(vec2 p){vec2 warp=vec2(cloud(p*.53+12.),cloud(p*.57-9.));return cloud(p+warp*1.5);}
   void main(){
     vec3 d=normalize(skyDirection);float h=max(0.,d.y),gold=golden*(1.-night),twilight=max(sin(night*3.141593),gold*.86);
     float sunFacing=pow(max(0.,dot(d,sunDirection)),4.);
     vec3 day=mix(vec3(.58,.73,.88),vec3(.055,.18,.42),pow(h,.46));
     vec3 dusk=mix(mix(vec3(.88,.49,.29),vec3(.55,.34,.43),1.-sunFacing),vec3(.075,.14,.29),pow(h,.40));
     day=mix(day,dusk,gold);
     vec3 dark=mix(vec3(.048,.075,.135),vec3(.004,.011,.033),pow(h,.4));
     vec3 color=mix(day,dark,night);
     color=mix(color,mix(vec3(.14,.18,.26),vec3(.035,.048,.082),night),storm*.57);
     vec2 uv=d.xz/(h+.13)*2.8+vec2(weatherTime*.004,weatherTime*.0015)+12.;
     float base=density(uv),threshold=.66-cloudCover*.22;
     float cover=smoothstep(threshold-.045,threshold+.085,base)*smoothstep(-.025,.12,d.y);
     // A broad cloud veil always covers the solar disc, even as other clouds
     // drift. No exposed white disc, flashes through gaps, or intense corona.
     float dotSun=max(0.,dot(d,sunDirection));
     float sunVeil=smoothstep(.945,.993,dotSun);
     cover=max(cover,sunVeil*.985);
     float lightDepth=0.;vec2 lightStep=normalize(sunDirection.xz)*.23;
     for(int i=1;i<=4;i++)lightDepth+=max(0.,density(uv+lightStep*float(i))-threshold+.025);
     float transmission=exp(-lightDepth*8.5),edge=pow(max(0.,1.-abs(base-threshold)*14.),3.);
     vec3 shadow=mix(vec3(.19,.27,.41),vec3(.16,.115,.22),gold);
     shadow=mix(shadow,vec3(.055,.077,.13),storm*.75);
     vec3 lit=mix(vec3(.88,.94,1.02),vec3(1.16,.79,.53),gold);
     float body=smoothstep(threshold+.015,threshold+.20,base);
     float facing=smoothstep(-.025,.04,base-density(uv+lightStep*.45));
     vec3 cloudColor=mix(shadow,lit,transmission*(.80-body*.38));
     cloudColor+=lit*edge*sunFacing*facing*(.10+gold*.10)*(1.-storm*.75);
     cloudColor=mix(cloudColor,vec3(.025,.040,.073)+transmission*vec3(.035,.05,.085),night);
     color=mix(color,cloudColor,cover);
     // A high, delicate cirrus layer remains distinct from the lower cloud banks.
     float cirrus=pow(cloud(uv*.55+vec2(cloud(uv*.23)*4.,0.)),6.)*1.4*(1.-cover)*(1.-storm);
     color+=mix(vec3(.45,.55,.68),vec3(.78,.48,.31),gold)*cirrus*(1.-night);
     color+=mix(vec3(.64,.66,.68),vec3(.88,.60,.38),gold)*pow(dotSun,32.)*.16*(1.-night)*(1.-cover*.97)*(1.-storm*.90);
     vec3 moonDirection=normalize(vec3(-.50,.55,.25));float moon=dot(d,moonDirection);
     color+=vec3(.64,.75,.95)*(smoothstep(.99991,.99996,moon)*1.5+pow(max(0.,moon),300.)*.05)*night*(1.-cover)*(1.-cloudCover*.96);
     vec2 starCell=floor(d.xz/max(.12,h)*650.);float star=step(.9988,weatherHash(starCell))*pow(max(0.,1.-length(fract(d.xz/max(.12,h)*650.)-.5)*2.),3.);
     color+=vec3(.12,.15,.20)*star*night*night*(1.-cover)*pow(1.-cloudCover,2.)*smoothstep(.05,.35,h);
     float horizon=exp(-h*20.)*.38;
     color=mix(color,mix(mix(vec3(.57,.65,.72),vec3(.78,.46,.29),gold*sunFacing),vec3(.045,.063,.105),night),horizon);
     if(d.y<-.02)color=mix(vec3(.12,.105,.085),vec3(.025,.035,.055),night);
     gl_FragColor=vec4(color,1.);
   }`});
 const sky=new THREE.Mesh(new THREE.SphereGeometry(650,32,16),skyMaterial);sky.name='Atmospheric_Sky';sky.frustumCulled=false;sky.renderOrder=-1000;
 sky.onBeforeRender=(renderer,scene,camera)=>{sky.position.copy(camera.position);sky.updateMatrixWorld();};scene.add(sky);
 // Cache day/night HDR probes once per look. Blend both weather and night in
 // the material, so neither transition triggers per-frame cubemap captures.
 const environments=new Map(),pmrem=new THREE.PMREMGenerator(renderer),probeScene=new THREE.Scene();
 const probeMaterial=skyMaterial.clone(),probe=new THREE.Mesh(sky.geometry,probeMaterial);probeScene.add(probe);
 const nightEnvironment={value:scene.environment},environmentBlend={value:0},nextEnvironment={value:scene.environment},nextNightEnvironment={value:scene.environment},profileBlend={value:0};
 const environmentMaterials=new Set();scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.isMeshStandardMaterial&&!m.envMap)environmentMaterials.add(m);});
 for(const material of graphics.compatibility?[]:environmentMaterials){const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);Object.assign(shader.uniforms,{weatherNightEnvironment:nightEnvironment,weatherEnvironmentBlend:environmentBlend,weatherNextEnvironment:nextEnvironment,weatherNextNightEnvironment:nextNightEnvironment,weatherProfileBlend:profileBlend});
     shader.fragmentShader='uniform sampler2D weatherNightEnvironment;uniform sampler2D weatherNextEnvironment;uniform sampler2D weatherNextNightEnvironment;uniform float weatherEnvironmentBlend;uniform float weatherProfileBlend;\n'+shader.fragmentShader;
     const chunk=THREE.ShaderChunk.envmap_physical_pars_fragment.replace(/vec4 envMapColor = textureCubeUV\( envMap, (.*?) \);/g,`vec4 envMapColor = mix(textureCubeUV(envMap, $1),textureCubeUV(weatherNightEnvironment, $1),weatherEnvironmentBlend);
       if(weatherProfileBlend>0.)envMapColor=mix(envMapColor,mix(textureCubeUV(weatherNextEnvironment, $1),textureCubeUV(weatherNextNightEnvironment, $1),weatherEnvironmentBlend),weatherProfileBlend);`);
     shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',chunk);
   };material.customProgramCacheKey=()=>key+'-weather-hdr-probes-v3';material.needsUpdate=true;
 }
 function probePair(key){
   if(!environments.has(key)){
     const p=key==='off'?WEATHER_OFF:WEATHER[key];
     const pair=[];
     for(const n of [0,1]){
       for(const [name,value] of Object.entries({cloudCover:p.cloud,night:n,golden:p.gold,storm:p.storm,weatherTime:0}))probeMaterial.uniforms[name].value=value;
       probeMaterial.uniforms.sunDirection.value.set(...p.sun).normalize();
       const cube=new THREE.WebGLCubeRenderTarget(graphics.compatibility?64:128,{type:THREE.HalfFloatType});new THREE.CubeCamera(.5,1000,cube).update(renderer,probeScene);
       pair.push(pmrem.fromCubemap(cube.texture));cube.dispose();
     }environments.set(key,pair);
   }
   return environments.get(key);
 }
 function environment(){
   const cycling=mode==='cycle'||mode==='random',from=mode==='off'?'off':cycling?phase.from:preset;
   const to=cycling?phase.to:from,blend=cycling?phase.blend:0;
   const pair=probePair(from),next=blend>0?probePair(to):pair;
   scene.environment=pair[graphics.compatibility&&night>=.5?1:0].texture;nightEnvironment.value=pair[1].texture;environmentBlend.value=night;
   nextEnvironment.value=next[0].texture;nextNightEnvironment.value=next[1].texture;profileBlend.value=blend;
   if(graphics.compatibility)for(const [key,unused] of environments)if(key!==from&&key!==to){unused.forEach(target=>target.dispose());environments.delete(key);}
 }
 // One seeded particle batch. Drops fall only outdoors, above the vehicles.
 const count=4500,positions=new Float32Array(count*3),seeds=new Float32Array(count);
 let seed=563;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<count;i++){positions.set([(random()-.5)*14.3,random()*22,(random()-.5)*140],i*3);seeds[i]=random();}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('dropSeed',new THREE.BufferAttribute(seeds,1));
 const rainMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
   uniforms:{...uniforms,sunDirection:{value:sunDirection},rainLamps:graphics.atmosphere.uniforms.lamps,rainLampDirections:graphics.atmosphere.uniforms.lampDirections,rainLampColors:graphics.atmosphere.uniforms.lampColors,focus:{value:0},pixelRatio:{value:1}},
   vertexShader:`uniform float weatherTime;uniform float focus;uniform float pixelRatio;uniform float rainAmount;uniform float golden;uniform float night;uniform vec3 sunDirection;uniform vec4 rainLamps[3];uniform vec4 rainLampDirections[3];uniform vec3 rainLampColors[3];attribute float dropSeed;varying float dropFade;varying vec3 dropColor;
   void main(){vec3 p=position;p.z=mod(p.z-focus+70.,140.)-70.+focus;p.y=mod(position.y-weatherTime*(12.+dropSeed*5.),22.);p.x+=sin(weatherTime*.3+dropSeed*6.)*.18;
     float roof=(abs(p.x)<3.25&&abs(p.z-focus)<8.4)?3.85:0.;
     dropFade=step(dropSeed,rainAmount)*step(roof,p.y)*(1.-smoothstep(40.,68.,abs(p.z-focus)));
     float dropGlow=golden*(1.-night)*pow(max(0.,dot(normalize(p-cameraPosition),sunDirection)),4.);
     dropColor=mix(vec3(.50,.65,.82),vec3(.055,.10,.18),night)+vec3(2.,1.1,.3)*dropGlow;
     for(int i=0;i<3;i++){vec3 offset=p-rainLamps[i].xyz;float distance=length(offset);float cone=smoothstep(rainLampDirections[i].w,rainLampDirections[i].w+.12,dot(normalize(offset),rainLampDirections[i].xyz));
       dropColor+=rainLampColors[i]*rainLamps[i].w*cone*pow(max(0.,1.-distance/25.),2.)/(distance*distance+2.)*3.;}
     vec4 v=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp(110./max(1.,-v.z),2.,24.)*pixelRatio;gl_Position=projectionMatrix*v;}`,
   fragmentShader:`uniform float rainAmount;uniform float night;varying float dropFade;varying vec3 dropColor;
   void main(){vec2 p=gl_PointCoord-.5;float streak=exp(-pow((p.x+p.y*.12)*20.,2.))*smoothstep(.5,.15,abs(p.y));float a=streak*dropFade*rainAmount*.26;
     gl_FragColor=vec4(dropColor,a);}`});
 const rain=new THREE.Points(geometry,rainMaterial);rain.name='Windblown_Rain';rain.frustumCulled=false;rain.renderOrder=3;scene.add(rain);
 graphics.bindAtmosphere(lighting);
 function apply(){phase=weatherPhase(cycleTime,mode==='random'?randomSequence:WEATHER_SEQUENCE);const p=mode==='off'?WEATHER_OFF:mode==='cycle'||mode==='random'?mixWeather(WEATHER[phase.from],WEATHER[phase.to],phase.blend,blended):WEATHER[preset];
   uniforms.cloudCover.value=p.cloud;uniforms.rainAmount.value=p.rain;uniforms.wetness.value=p.wet;uniforms.night.value=night;uniforms.golden.value=p.gold;uniforms.storm.value=p.storm;rain.visible=p.rain>.001;
   uniforms.weatherTime.value=mode==='off'?0:time;
   sunDirection.set(...p.sun).normalize();environment();lighting.setWeather(p,night);graphics.setWeather(p.wet,p.rain,uniforms.weatherTime.value,night,p);}
 return {uniforms,sky,rain,geometry,presets:WEATHER,get preset(){return preset;},get time(){return time;},get mode(){return mode;},get cycleTime(){return cycleTime;},get phase(){return {...phase};},environmentBlend,profileBlend,
   snapshotClock(){return {time,cycleTime};},restoreClock(saved){if(saved&&Number.isFinite(saved.time)&&saved.time>=0&&Number.isFinite(saved.cycleTime)&&saved.cycleTime>=0){time=saved.time;cycleTime=saved.cycleTime;}},
   configure(nextMode,value,seed=0){mode=WEATHER_MODES.includes(nextMode)?nextMode:'cycle';preset=Object.hasOwn(WEATHER,value)?value:'overcast';if(randomSeed!==(seed>>>0)){randomSeed=seed>>>0;randomSequence=randomWeatherSequence(randomSeed);}},
   setPreset(value){preset=Object.hasOwn(WEATHER,value)?value:'overcast';apply();},
   update(dt,z,nightAmount,ratio=1){const elapsed=Math.min(.1,Math.max(0,dt));if(mode!=='off')time+=elapsed;if(mode==='cycle'||mode==='random')cycleTime+=elapsed;focus=z;night=nightAmount;rainMaterial.uniforms.focus.value=focus;rainMaterial.uniforms.pixelRatio.value=Math.min(2,ratio);apply();},
   rebuildEnvironments(){for(const pair of environments.values())pair.forEach(p=>p.dispose());environments.clear();apply();},
   environments,dispose(){sky.removeFromParent();rain.removeFromParent();sky.geometry.dispose();skyMaterial.dispose();probeMaterial.dispose();pmrem.dispose();for(const pair of environments.values())pair.forEach(p=>p.dispose());geometry.dispose();rainMaterial.dispose();}};
}
