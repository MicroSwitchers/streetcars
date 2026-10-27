import * as THREE from 'three';
import {WET_PATCH_GLSL} from './weather.js';
import {QUALITY,COMPATIBILITY_QUALITY} from './performance.js';

// Record smooth geometry normals with the colour in the same draw. Inferring
// a normal from adjacent depth pixels amplifies depth steps into visible bands,
// particularly on long panels and paving viewed at eye height.
const preparedObjects=new WeakMap();
const preparedScenes=new WeakMap();
function prepareSurfaceNormals(scene){
 let record=preparedScenes.get(scene);
 if(!record){
   record={dirty:true,watched:new WeakSet()};preparedScenes.set(scene,record);
   const watch=object=>{if(record.watched.has(object))return;record.watched.add(object);object.addEventListener('childadded',event=>{record.dirty=true;event.child.traverse(watch);});};
   scene.traverse(watch);
 }
 if(!record.dirty)return;record.dirty=false;
 scene.traverse(object=>{
  if(!object.material||preparedObjects.get(object)===object.material)return;
  preparedObjects.set(object,object.material);
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(material.onBeforeCompile.surfaceNormals)continue;
   const hasNormal=object.isMesh&&object.geometry.attributes.normal&&
    (material.isMeshStandardMaterial||material.isMeshBasicMaterial||material.isMeshLambertMaterial||material.isMeshPhongMaterial);
   const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   const hook=function(shader,renderer){
    compile.call(this,shader,renderer);
    if(hasNormal){
     shader.vertexShader='varying vec3 vSurfaceNormal;\n'+shader.vertexShader;
     shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec3 surfaceNormal=normal;
      #ifdef USE_INSTANCING
       mat3 surfaceInstance=mat3(instanceMatrix);
       surfaceNormal/=vec3(dot(surfaceInstance[0],surfaceInstance[0]),dot(surfaceInstance[1],surfaceInstance[1]),dot(surfaceInstance[2],surfaceInstance[2]));
       surfaceNormal=surfaceInstance*surfaceNormal;
      #endif
      vSurfaceNormal=normalize(normalMatrix*surfaceNormal);
      #include <project_vertex>`);
    }
    const output=hasNormal&&this.depthWrite?'vec4(normalize(vSurfaceNormal)*(gl_FrontFacing?.5:-.5)+.5,1.)':'vec4(0.)';
    shader.fragmentShader='layout(location=1) out vec4 surfaceNormalOutput;\n'+
      (hasNormal?'varying vec3 vSurfaceNormal;\n':'')+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace(/}\s*$/,`surfaceNormalOutput=${output};\n}`);
   };
   hook.surfaceNormals=true;material.onBeforeCompile=hook;
   material.customProgramCacheKey=()=>`${key}-geometry-normals-v1-${hasNormal?1:0}`;
   material.needsUpdate=true;
  }
 });
}
// Three's internal background materials are outside the scene traversal. Like
// lines, they need an explicit empty second output when drawing into this MRT.
function prepareBackgroundNormals(){
 for(const name of ['background','backgroundCube']){
  const shader=THREE.ShaderLib[name];
  if(shader.fragmentShader.includes('surfaceNormalOutput'))continue;
  shader.fragmentShader='layout(location=1) out vec4 surfaceNormalOutput;\n'+
    shader.fragmentShader.replace(/}\s*$/,'surfaceNormalOutput=vec4(0.);\n}');
 }
}

// Half-resolution ambient occlusion with depth-aware filtering, followed by
// edge antialiasing and a gentle vignette. Sampling stays fixed as time passes.
export function createSceneRenderer(renderer,{compatibility=false}={}){
 if(compatibility)return createCompatibilityRenderer(renderer);
 prepareBackgroundNormals();
 let quality=QUALITY.high,qualityDirty=true;
 const stats={frames:0,drawCalls:0,triangles:0,quality:'high'};
 renderer.info.autoReset=false;
 const hdr=renderer.extensions.has('EXT_color_buffer_float');
 const target=new THREE.WebGLRenderTarget(1,1,{type:hdr?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,count:2,samples:Math.min(4,renderer.capabilities.maxSamples)});
 target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 target.textures[1].type=THREE.UnsignedByteType;target.textures[1].name='Surface geometry normals';
 target.textures[1].minFilter=target.textures[1].magFilter=THREE.NearestFilter;
 const outgoing=new THREE.WebGLRenderTarget(1,1,{type:target.texture.type,depthBuffer:false});
 const aoRaw=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
 const aoFiltered=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
 const glowA=new THREE.WebGLRenderTarget(1,1,{type:target.texture.type,depthBuffer:false}),glowB=glowA.clone();
 const blackGlow=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blackGlow.needsUpdate=true;
 const uniforms={image:{value:target.texture},previousImage:{value:outgoing.texture},viewBlend:{value:1},depth:{value:target.depthTexture},surfaceNormals:{value:target.textures[1]},resolution:{value:new THREE.Vector2()},aoResolution:{value:new THREE.Vector2()},inverseProjection:{value:new THREE.Matrix4()},projectionScale:{value:1},aoStrength:{value:.9},aoRadius:{value:1.15},aoTexture:{value:aoFiltered.texture}};
 const vertexShader='varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}';
 uniforms.bloom={value:blackGlow};uniforms.bloomStrength={value:0};
 uniforms.wetness={value:0};uniforms.rainAmount={value:0};uniforms.weatherTime={value:0};uniforms.weatherNight={value:0};
 uniforms.inverseView={value:new THREE.Matrix4()};uniforms.viewProjection={value:new THREE.Matrix4()};
 uniforms.golden={value:0};uniforms.storm={value:0};uniforms.sunDirection={value:new THREE.Vector3()};
 uniforms.aoSamples={value:12};uniforms.volumeSteps={value:32};uniforms.reflectionSteps={value:24};
 const volumeTarget=new THREE.WebGLRenderTarget(1,1,{type:target.texture.type,depthBuffer:false});
 uniforms.volumeTexture={value:volumeTarget.texture};uniforms.volumeResolution={value:new THREE.Vector2(1,1)};
 const viewDepth=`
 uniform sampler2D depth;uniform mat4 inverseProjection;
 vec3 viewPosition(vec2 uv){float d=texture2D(depth,uv).x;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
 `;
 const aoMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,vertexShader,fragmentShader:`
 ${viewDepth}
 uniform sampler2D surfaceNormals;
 uniform vec2 resolution;uniform float projectionScale;uniform float aoRadius;uniform float aoSamples;
 varying vec2 uvScreen;
 void main(){
   vec2 uv=uvScreen,pixel=1./resolution;
   if(texture2D(depth,uv).x>=.99999){gl_FragColor=vec4(1.);return;}
   vec3 p=viewPosition(uv);
   vec4 geometryNormal=texture2D(surfaceNormals,uv);
   if(geometryNormal.a<.5){gl_FragColor=vec4(1.);return;}
   vec3 normal=normalize(geometryNormal.rgb*2.-1.);
   float radius=clamp(aoRadius*projectionScale*resolution.y/max(.1,-p.z),2.,64.),occlusion=0.;
   for(int i=0;i<12;i++){
     if(float(i)>=aoSamples)break;
     float angle=float(i)*2.399963;
     float ring=(mod(float(i),2.)<.5)?.3:1.;
     vec2 sampleUv=uv+vec2(cos(angle),sin(angle))*radius*ring*pixel;
     if(sampleUv.x<=pixel.x||sampleUv.y<=pixel.y||sampleUv.x>=1.-pixel.x||sampleUv.y>=1.-pixel.y)continue;
     if(texture2D(depth,sampleUv).x>=.99999)continue;
     vec3 delta=viewPosition(sampleUv)-p;
     float distance=length(delta);
     float horizon=max(0.,dot(normal,delta/max(distance,.0001))-.12);
     occlusion+=horizon*smoothstep(.025,.10,distance)*(1.-smoothstep(aoRadius*.2,aoRadius*1.5,distance));
   }
   float fade=1.-smoothstep(70.,160.,-p.z);
   float visibility=1.-min(.42,occlusion*(2.4/aoSamples)*fade);
   gl_FragColor=vec4(vec3(visibility),1.);
 }`});
 const filterMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{...uniforms,aoTexture:{value:aoRaw.texture}},vertexShader,fragmentShader:`
 ${viewDepth}
 uniform sampler2D aoTexture;uniform vec2 aoResolution;varying vec2 uvScreen;
 void main(){
   float z=viewPosition(uvScreen).z,sum=0.,weight=0.;
   for(int i=-2;i<=2;i++){
     vec2 uv=clamp(uvScreen+vec2(float(i)/aoResolution.x,0.),vec2(0.),vec2(1.));
     float spatial=exp(-float(i*i)*.5);
     float w=spatial*exp(-abs(viewPosition(uv).z-z)*8./max(1.,-z*.025));
     sum+=texture2D(aoTexture,uv).r*w;weight+=w;
   }
   gl_FragColor=vec4(vec3(sum/max(weight,.0001)),1.);
 }`});
 const volumeUniforms={...uniforms,volumeDensity:{value:.003},shadowStrength:{value:1},sunPower:{value:0},sunColor:{value:new THREE.Color()},sunShadow:{value:blackGlow},shadowMatrix:{value:new THREE.Matrix4()},
   lamps:{value:Array.from({length:3},()=>new THREE.Vector4())},lampDirections:{value:Array.from({length:3},()=>new THREE.Vector4())},lampColors:{value:Array.from({length:3},()=>new THREE.Color())}};
 const volumeMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:volumeUniforms,vertexShader,
   fragmentShader:`#include <packing>
   ${viewDepth}
   uniform mat4 inverseView;uniform sampler2D sunShadow;uniform mat4 shadowMatrix;uniform vec3 sunDirection;uniform vec3 sunColor;uniform float sunPower;uniform float volumeDensity;uniform float shadowStrength;uniform float volumeSteps;
   uniform vec4 lamps[3];uniform vec4 lampDirections[3];uniform vec3 lampColors[3];uniform vec2 volumeResolution;varying vec2 uvScreen;
   float random(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){
     if(volumeDensity<=0.){gl_FragColor=vec4(0.);return;}
     vec3 eye=inverseView[3].xyz,ray=normalize(mat3(inverseView)*viewPosition(uvScreen));
     float distance=min(95.,length(viewPosition(uvScreen))),stepSize=distance/volumeSteps;
     float jitter=random(floor(uvScreen*volumeResolution));vec3 scatter=vec3(0.);
     float phase=.10+pow(max(0.,dot(ray,sunDirection)),8.)*.65;
     for(int i=0;i<32;i++){
       if(float(i)>=volumeSteps)break;
       float travel=(float(i)+.25+jitter*.5)*stepSize;vec3 p=eye+ray*travel;
       float density=volumeDensity*exp(-max(0.,p.y)*.085);
       vec4 shadow=shadowMatrix*vec4(p,1.);shadow.xyz/=shadow.w;
       float visibility=1.;
       if(all(greaterThan(shadow.xyz,vec3(0.)))&&all(lessThan(shadow.xyz,vec3(1.)))){
         float blocker=unpackRGBAToDepth(texture2D(sunShadow,shadow.xy));visibility=mix(1.,smoothstep(shadow.z-.0008,shadow.z+.0008,blocker),shadowStrength);
       }
       vec3 light=sunColor*sunPower*phase*visibility*.10;
       for(int j=0;j<3;j++){
         vec3 offset=p-lamps[j].xyz;float d=length(offset);float cone=smoothstep(lampDirections[j].w,lampDirections[j].w+.12,dot(normalize(offset),lampDirections[j].xyz));
         float falloff=pow(max(0.,1.-d/25.),2.)/(d*d+6.);
         light+=lampColors[j]*lamps[j].w*falloff*cone*1.8;
       }
       scatter+=light*density*stepSize*exp(-travel*volumeDensity*.5);
     }
     gl_FragColor=vec4(scatter,distance/95.);
   }`});
 const volumeScreen=new THREE.Scene();volumeScreen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),volumeMaterial));
 let atmosphere=null,nightAmount=0;
 const material=new THREE.ShaderMaterial({uniforms,defines:{BLEND_VIEWS:1,FINAL_OUTPUT:1},depthTest:false,depthWrite:false,
 vertexShader:`varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader:`
 uniform sampler2D image;uniform sampler2D depth;uniform vec2 resolution;uniform sampler2D bloom;uniform float bloomStrength;
 #ifdef BLEND_VIEWS
 uniform sampler2D previousImage;uniform float viewBlend;
 #endif
 uniform sampler2D aoTexture;uniform vec2 aoResolution;
 uniform mat4 inverseProjection;uniform float projectionScale;uniform float aoStrength;
 uniform mat4 inverseView;uniform mat4 viewProjection;uniform sampler2D surfaceNormals;
 uniform float wetness;uniform float rainAmount;uniform float weatherTime;uniform float weatherNight;
 uniform float golden;uniform float storm;uniform vec3 sunDirection;uniform sampler2D volumeTexture;uniform vec2 volumeResolution;uniform float reflectionSteps;
 varying vec2 uvScreen;
 ${WET_PATCH_GLSL}
 vec3 viewPosition(vec2 uv){float d=texture2D(depth,uv).x;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
 vec3 waterReflection(vec2 uv,vec3 color){
   if(wetness<.001)return color;
   vec4 encodedNormal=texture2D(surfaceNormals,uv);if(encodedNormal.a<.5)return color;
   vec3 p=viewPosition(uv),world=(inverseView*vec4(p,1.)).xyz;
   vec3 n=normalize(mat3(inverseView)*(encodedNormal.rgb*2.-1.));
   if(n.y<.96||world.y>.45||abs(world.x)>11.35||length(p)>110.)return color;
   float puddle=puddleCoverage(world,wetness),film=dampFilm(world,wetness)*(.10+.26*(1.-puddle))+puddle*.78;
   // Stable world-space grain breaks up the smooth normal used by SSR without
   // deriving normals from depth (which previously caused scan-line bands).
   vec2 grain=vec2(weatherNoise(world.xz*13.),weatherNoise(world.xz*13.+37.))-.5;
   float grainAA=1.-smoothstep(.25,1.2,length(fwidth(world.xz*13.)));
   n.xz+=grain*.12*(1.-puddle*.92)*grainAA+rainAmount*rainRipple(world.xz,weatherTime)*puddle;n=normalize(n);
   vec3 normalView=transpose(mat3(inverseView))*n,ray=reflect(normalize(p),normalView);
   vec3 worldRay=mat3(inverseView)*ray;
   vec3 skyReflection=mix(vec3(.34,.40,.45),vec3(.25,.31,.36),clamp(worldRay.y,0.,1.));
   skyReflection=mix(skyReflection,mix(vec3(.64,.39,.24),vec3(.11,.14,.31),clamp(worldRay.y*2.,0.,1.)),golden*(1.-weatherNight));
   vec3 reflection=mix(skyReflection,vec3(.025,.038,.061),weatherNight);
   float previous=0.,confidence=0.;
   for(int i=0;i<24;i++){
     if(float(i)>=reflectionSteps)break;
     float sampleIndex=float(i)*24./reflectionSteps;
     float t=.35+sampleIndex*.42+sampleIndex*sampleIndex*.055;
     vec3 q=p+normalView*.065+ray*t;vec4 projected=viewProjection*vec4(q,1.);vec2 at=projected.xy/projected.w*.5+.5;
     if(projected.w<=0.||any(lessThanEqual(at,vec2(.005)))||any(greaterThanEqual(at,vec2(.995))))break;
     float sceneDepth=texture2D(depth,at).x;float gap=viewPosition(at).z-q.z;
     if(i>1&&sceneDepth<.99999&&gap>0.&&gap<1.8+t*.035){
       float low=previous,high=t;
       for(int j=0;j<4;j++){float mid=(low+high)*.5;vec4 projectedMid=viewProjection*vec4(p+normalView*.065+ray*mid,1.);vec2 sampleUv=projectedMid.xy/projectedMid.w*.5+.5;
         if(viewPosition(sampleUv).z>(p+normalView*.065+ray*mid).z)high=mid;else low=mid;}
       vec4 hit=viewProjection*vec4(p+normalView*.065+ray*high,1.);vec2 hitUv=hit.xy/hit.w*.5+.5;
       float edge=min(min(hitUv.x,1.-hitUv.x),min(hitUv.y,1.-hitUv.y));
       confidence=smoothstep(.005,.13,edge)*(1.-smoothstep(28.,47.,high));
       vec2 blur=vec2(mix(5.,2.,puddle))/resolution;
       vec3 reflected=(texture2D(image,hitUv).rgb*2.+texture2D(image,hitUv+blur).rgb+texture2D(image,hitUv-blur).rgb)*.25;
       reflection=mix(reflection,reflected,confidence);break;
     }
     previous=t;
   }
   float fresnel=.025+.90*pow(1.-max(0.,dot(normalize(-p),normalView)),5.);
   return mix(color,reflection,film*min(.52,fresnel));
 }
 float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
 void main(){
   vec2 pixel=1./resolution,uv=uvScreen;
   vec3 center=texture2D(image,uv).rgb;
   vec3 nw=texture2D(image,uv+vec2(-1.,-1.)*pixel).rgb;
   vec3 ne=texture2D(image,uv+vec2(1.,-1.)*pixel).rgb;
   vec3 sw=texture2D(image,uv+vec2(-1.,1.)*pixel).rgb;
   vec3 se=texture2D(image,uv+vec2(1.,1.)*pixel).rgb;
   float lo=min(luma(center),min(min(luma(nw),luma(ne)),min(luma(sw),luma(se))));
   float hi=max(luma(center),max(max(luma(nw),luma(ne)),max(luma(sw),luma(se))));
   vec2 direction=vec2(-((luma(nw)+luma(ne))-(luma(sw)+luma(se))),((luma(nw)+luma(sw))-(luma(ne)+luma(se))));
   float reduce=max((luma(nw)+luma(ne)+luma(sw)+luma(se))*.03125,.0078125);
   direction=clamp(direction/(min(abs(direction.x),abs(direction.y))+reduce),vec2(-6.),vec2(6.))*pixel;
   vec3 a=.5*(texture2D(image,uv+direction*(1./3.-.5)).rgb+texture2D(image,uv+direction*(2./3.-.5)).rgb);
   vec3 b=a*.5+.25*(texture2D(image,uv+direction*-.5).rgb+texture2D(image,uv+direction*.5).rgb);
   vec3 color=(luma(b)<lo||luma(b)>hi)?a:b;
   // Vertical bilateral filtering also upsamples the half-size AO buffer.
   float z=viewPosition(uv).z,visibility=0.,weight=0.;
   for(int i=-2;i<=2;i++){
     vec2 sampleUv=clamp(uv+vec2(0.,float(i)/aoResolution.y),pixel,1.-pixel);
     float w=exp(-float(i*i)*.5)*exp(-abs(viewPosition(sampleUv).z-z)*8./max(1.,-z*.025));
     visibility+=texture2D(aoTexture,sampleUv).r*w;weight+=w;
   }
   color*=mix(1.,visibility/max(weight,.0001),aoStrength);
   color=waterReflection(uv,color);
   vec3 volume=vec3(0.);float vw=0.;float distance=min(95.,length(viewPosition(uv)))/95.;
   for(int i=-2;i<=2;i++){
     vec2 offset=i==0?vec2(0.):i==-2?vec2(-1.,0.):i==-1?vec2(1.,0.):i==1?vec2(0.,-1.):vec2(0.,1.);
     vec4 sampleVolume=texture2D(volumeTexture,uv+offset/volumeResolution);
     float w=exp(-abs(sampleVolume.a-distance)*90.);volume+=sampleVolume.rgb*w;vw+=w;
   }
   color+=volume/max(.001,vw);
   float shadows=1.-smoothstep(.03,.32,luma(color));
   color*=mix(vec3(1.),vec3(.88,.97,1.10),shadows*max(golden*.35,weatherNight*.35));
   float lens=dot((uv-.5)*vec2(1.,.8),(uv-.5)*vec2(1.,.8));
   color*=1.-lens*.16;
   color+=texture2D(bloom,uv).rgb*bloomStrength;
   #ifdef BLEND_VIEWS
   if(viewBlend<1.)color=mix(texture2D(previousImage,uv).rgb,color,viewBlend);
   #endif
   gl_FragColor=vec4(color,1.);
   #ifdef FINAL_OUTPUT
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #endif
 }`});
 const screen=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),camera=new THREE.Camera();screen.add(quad);
 const aoScreen=new THREE.Scene(),aoQuad=new THREE.Mesh(quad.geometry,aoMaterial);aoScreen.add(aoQuad);
 const glowMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
   uniforms:{source:{value:target.texture},texel:{value:new THREE.Vector2()},axis:{value:new THREE.Vector2()},extract:{value:1}},vertexShader,
   fragmentShader:`uniform sampler2D source;uniform vec2 texel;uniform vec2 axis;uniform float extract;varying vec2 uvScreen;
   void main(){
     vec3 color;
     if(extract>.5){
       color=(texture2D(source,uvScreen+texel*vec2(-.5,-.5)).rgb+texture2D(source,uvScreen+texel*vec2(.5,-.5)).rgb+texture2D(source,uvScreen+texel*vec2(-.5,.5)).rgb+texture2D(source,uvScreen+texel*vec2(.5,.5)).rgb)*.25;
       float peak=max(color.r,max(color.g,color.b));color*=max(0.,peak-.85)/max(peak,.0001);
     }else{
       vec2 step=texel*axis;
       color=texture2D(source,uvScreen).rgb*.227027;
       color+=(texture2D(source,uvScreen+step*1.384615).rgb+texture2D(source,uvScreen-step*1.384615).rgb)*.316216;
       color+=(texture2D(source,uvScreen+step*3.230769).rgb+texture2D(source,uvScreen-step*3.230769).rgb)*.070270;
     }
     gl_FragColor=vec4(color,1.);
   }`});
 const glowScreen=new THREE.Scene();glowScreen.add(new THREE.Mesh(quad.geometry,glowMaterial));
 // Finish the outgoing view in linear colour, then blend and tone-map once.
 // It uses the same AO/AA buffers in sequence, without another depth target.
 const outgoingMaterial=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
   vertexShader:material.vertexShader,fragmentShader:material.fragmentShader});
 function renderView(scene,view){
   uniforms.inverseProjection.value.copy(view.projectionMatrixInverse);uniforms.projectionScale.value=view.projectionMatrix.elements[5]*.5;
   view.updateMatrixWorld();uniforms.inverseView.value.copy(view.matrixWorld);uniforms.viewProjection.value.copy(view.projectionMatrix);
   if(atmosphere){
     const sun=atmosphere.sun,v=volumeUniforms;v.sunPower.value=sun.intensity;v.sunColor.value.copy(sun.color);
     uniforms.sunDirection.value.copy(sun.position).sub(sun.target.position).normalize();
     const visible=l=>{for(let o=l;o;o=o.parent)if(!o.visible)return false;return true;};
     const nearby=atmosphere.volumeLights.filter(l=>l.intensity>.001&&visible(l)).sort((a,b)=>a.getWorldPosition(new THREE.Vector3()).distanceToSquared(view.position)-b.getWorldPosition(new THREE.Vector3()).distanceToSquared(view.position)).slice(0,3);
     for(let i=0;i<3;i++){
       const light=nearby[i];if(!light){v.lamps.value[i].set(0,0,0,0);continue;}
       const position=light.getWorldPosition(new THREE.Vector3()),direction=light.target.getWorldPosition(new THREE.Vector3()).sub(position).normalize();
       v.lamps.value[i].set(position.x,position.y,position.z,light.intensity*(light.name==='Runtime_Headlight'?.6:1));v.lampDirections.value[i].set(direction.x,direction.y,direction.z,Math.cos(light.angle));v.lampColors.value[i].copy(light.color);
     }
   }
   renderer.setRenderTarget(target);renderer.render(scene,view);
   if(atmosphere){volumeUniforms.sunShadow.value=atmosphere.sun.shadow.map?.texture??blackGlow;volumeUniforms.shadowMatrix.value.copy(atmosphere.sun.shadow.matrix);}
   renderer.setRenderTarget(volumeTarget);renderer.render(volumeScreen,camera);
   aoQuad.material=aoMaterial;renderer.setRenderTarget(aoRaw);renderer.render(aoScreen,camera);
   aoQuad.material=filterMaterial;renderer.setRenderTarget(aoFiltered);renderer.render(aoScreen,camera);
   if(uniforms.bloomStrength.value>.001){
     const u=glowMaterial.uniforms;u.source.value=target.texture;u.extract.value=1;u.texel.value.set(1/target.width,1/target.height);
     renderer.setRenderTarget(glowA);renderer.render(glowScreen,camera);
     u.extract.value=0;u.texel.value.set(1/glowA.width,1/glowA.height);u.axis.value.set(1,0);u.source.value=glowA.texture;
     renderer.setRenderTarget(glowB);renderer.render(glowScreen,camera);
     u.axis.value.set(0,1);u.source.value=glowB.texture;renderer.setRenderTarget(glowA);renderer.render(glowScreen,camera);
     uniforms.bloom.value=glowA.texture;
   }else uniforms.bloom.value=blackGlow;
 }
 const size=new THREE.Vector2();
 return {target,uniforms,stats,prepare:prepareSurfaceNormals,invalidate(scene){const record=preparedScenes.get(scene);if(record)record.dirty=true;},
   setQuality(profile){quality=profile;qualityDirty=true;uniforms.aoSamples.value=profile.aoSamples;uniforms.volumeSteps.value=profile.volumeSteps;uniforms.reflectionSteps.value=profile.reflectionSteps;
     const samples=Math.min(profile.samples,renderer.capabilities.maxSamples);if(target.samples!==samples){target.dispose();target.samples=samples;}
     stats.quality=Object.keys(QUALITY).find(key=>QUALITY[key]===profile)??'custom';},
   ambientOcclusion:{raw:aoRaw,filtered:aoFiltered},nightGlow:{texture:glowA},atmosphere:{target:volumeTarget,uniforms:volumeUniforms},bindAtmosphere(lighting){atmosphere=lighting;},
   setNight(amount){nightAmount=THREE.MathUtils.clamp(amount,0,1);uniforms.bloomStrength.value=nightAmount*.18;},
   setWeather(wet,rain,time,night,profile={}){nightAmount=night;uniforms.wetness.value=wet;uniforms.rainAmount.value=rain;uniforms.weatherTime.value=time;uniforms.weatherNight.value=night;uniforms.golden.value=profile.gold??0;uniforms.storm.value=profile.storm??0;
     volumeUniforms.volumeDensity.value=profile.volume??.003;uniforms.bloomStrength.value=profile.enabled===false?0:nightAmount*.18;},
   render(scene,view,transition=null){
     renderer.info.reset();
     prepareSurfaceNormals(scene);
     renderer.getDrawingBufferSize(size);
     if(qualityDirty||target.width!==size.x||target.height!==size.y){
       qualityDirty=false;
       target.setSize(size.x,size.y);uniforms.resolution.value.copy(size);
       const width=Math.max(1,Math.ceil(size.x/quality.aoScale)),height=Math.max(1,Math.ceil(size.y/quality.aoScale));
       aoRaw.setSize(width,height);aoFiltered.setSize(width,height);uniforms.aoResolution.value.set(width,height);
       glowA.setSize(Math.max(1,Math.ceil(size.x/4)),Math.max(1,Math.ceil(size.y/4)));glowB.setSize(glowA.width,glowA.height);
       volumeTarget.setSize(Math.max(1,Math.ceil(size.x/quality.volumeScale)),Math.max(1,Math.ceil(size.y/quality.volumeScale)));uniforms.volumeResolution.value.set(volumeTarget.width,volumeTarget.height);
     }
     if(transition){
       outgoing.setSize(size.x,size.y);
       renderView(scene,transition.from);
       quad.material=outgoingMaterial;renderer.setRenderTarget(outgoing);renderer.render(screen,camera);
       // The world and lighting are identical for both views this frame.
       const autoUpdate=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
       try{renderView(scene,view);}finally{renderer.shadowMap.autoUpdate=autoUpdate;}
     }else renderView(scene,view);
     uniforms.viewBlend.value=transition?THREE.MathUtils.smoothstep(transition.progress,0,1):1;
     quad.material=material;renderer.setRenderTarget(null);renderer.render(screen,camera);
     stats.frames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;
   },
   dispose(){target.dispose();outgoing.dispose();aoRaw.dispose();aoFiltered.dispose();glowA.dispose();glowB.dispose();volumeTarget.dispose();volumeMaterial.dispose();volumeScreen.children[0].geometry.dispose();blackGlow.dispose();glowMaterial.dispose();aoMaterial.dispose();filterMaterial.dispose();material.dispose();outgoingMaterial.dispose();quad.geometry.dispose();}
 };
}

// One forward pass on constrained Apple GPUs: no MRT, float framebuffer,
// screen-space ray marching, multisampling or double-rendered camera fades.
// PBR materials, sun shadows, rain, emissive windows and real lamps remain.
function createCompatibilityRenderer(renderer){
 let quality=COMPATIBILITY_QUALITY;
 const stats={frames:0,drawCalls:0,triangles:0,quality:'compatibility',texturePixelsSaved:0},position=new THREE.Vector3(),textures=new WeakSet();
 const lamps=Array.from({length:3},()=>new THREE.Vector4()),directions=lamps.map(()=>new THREE.Vector4()),colors=lamps.map(()=>new THREE.Color());
 let preparedScene=null,spots=[],points=[];
 function prepare(scene,view){
  if(preparedScene!==scene){preparedScene=scene;spots=[];points=[];scene.traverse(o=>{
   if(o.isSpotLight)spots.push(o);else if(o.isPointLight)points.push(o);
   for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])for(const texture of Object.values(material)){
    if(!texture?.isTexture||textures.has(texture))continue;textures.add(texture);
    const image=texture.image,width=image?.width,height=image?.height;
    if(!width||!height||Math.max(width,height)<=2048)continue;
    const scale=2048/Math.max(width,height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);texture.image=canvas;texture.needsUpdate=true;
    stats.texturePixelsSaved+=width*height-canvas.width*canvas.height;
   }
  });}
  for(const [lights,limit] of [[spots,quality.spots],[points,quality.points]]){
   lights.sort((a,b)=>a.getWorldPosition(position).distanceToSquared(view?.position??scene.position)-b.getWorldPosition(position).distanceToSquared(view?.position??scene.position));
   lights.forEach((light,i)=>light.visible=i<limit);
  }
  // Rain already samples these uniforms; use the selected real lamps so drops
  // pick up nearby headlights and street lighting without another render pass.
  for(let i=0;i<3;i++){
   const light=spots[i];if(!light){lamps[i].set(0,0,0,0);continue;}
   const p=light.getWorldPosition(new THREE.Vector3()),d=light.target.getWorldPosition(new THREE.Vector3()).sub(p).normalize();
   lamps[i].set(p.x,p.y,p.z,light.intensity);directions[i].set(d.x,d.y,d.z,Math.cos(light.angle));colors[i].copy(light.color);
  }
 }
 return {compatibility:true,target:null,stats,get profile(){return quality;},prepare,invalidate(){preparedScene=null;},setQuality(profile){quality=profile;stats.quality=profile.label;},bindAtmosphere(){},setNight(){},setWeather(){},
  atmosphere:{uniforms:{lamps:{value:lamps},lampDirections:{value:directions},lampColors:{value:colors}}},
  render(scene,view,transition){
   prepare(scene,view);renderer.info.reset();renderer.setRenderTarget(null);
   const progress=transition?.progress??1;
   renderer.domElement.style.opacity=transition?String(Math.abs(progress*2-1)):'';
   renderer.render(scene,transition&&progress<.5?transition.from:view);
   stats.frames++;stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;
  },dispose(){renderer.domElement.style.opacity='';}
 };
}
