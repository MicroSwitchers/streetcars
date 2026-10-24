import * as THREE from '../dist/vendor/three.module.js';
export function checkNightCity(api,check,w){
 const s=api.city.scenery,fx=s.windowLighting,previous={night:api.settings.night,dayNightCycle:api.settings.dayNightCycle};
 api.setPaused(true);api.updateSettings({dayNightCycle:true,night:true});
 check('Shopfronts have multiple warm and cool lighting styles, with some dark shops',new Set(s.displays.map(b=>b.lighting.color)).size>=6&&s.displays.some(b=>b.lighting.style===6));
 const colors=new Set();
 for(const mesh of s.meshes){const a=mesh.geometry.attributes.instanceIllumination;if(a)for(let i=0;i<a.count;i++)colors.add([a.getX(i),a.getY(i),a.getZ(i)].map(v=>v.toFixed(2)).join('/'));}
 check('Individual shop instances carry varied light colors and intensities',colors.size>25);
 check('Window spill uses a fixed four-light pool without extra shadow maps',fx.fixtures.length===4&&fx.fixtures.every(f=>f.light.isPointLight&&!f.light.castShadow));
 const camera=new THREE.PerspectiveCamera(48,api.camera.aspect,.5,250),reports=[];
 function sample(point){
   const p=point.clone().project(camera),target=api.graphics.target,hdr=target.texture.type===THREE.HalfFloatType;
   const x=Math.max(1,Math.min(target.width-2,Math.round((p.x*.5+.5)*target.width))),y=Math.max(1,Math.min(target.height-2,Math.round((p.y*.5+.5)*target.height)));
   const pixels=hdr?new Uint16Array(36):new Uint8Array(36),rgb=[0,0,0];api.renderer.readRenderTargetPixels(target,x-1,y-1,3,3,pixels);
   for(let i=0;i<36;i+=4)for(let c=0;c<3;c++)rgb[c]+=(hdr?THREE.DataUtils.fromHalfFloat(pixels[i+c]):pixels[i+c]/255)/9;
   return rgb;
 }
 for(const style of [0,2]){
   const bay=s.displays.filter(b=>b.lighting.style===style).sort((a,b)=>Math.abs(a.z-api.state.z)-Math.abs(b.z-api.state.z))[0];
   camera.position.set(bay.side*5.7,5.2,bay.z+7);camera.lookAt(bay.side*9.3,.18,bay.z);camera.updateMatrixWorld(true);
   const outward=10.89-8.35,point=new THREE.Vector3(bay.side*8.35,.185,bay.z+(bay.index%2===0?1:-1)*outward*.20+bay.width*.22);
   api.graphics.render(api.scene,camera);const lit=sample(point),intensities=fx.fixtures.map(f=>f.light.intensity);
   fx.night.value=0;fx.fixtures.forEach(f=>f.light.intensity=0);api.graphics.render(api.scene,camera);const dark=sample(point);
   fx.night.value=1;fx.fixtures.forEach((f,i)=>f.light.intensity=intensities[i]);
   const delta=lit.map((v,i)=>v-dark[i]);reports.push({style,delta});
   check((style===0?'Warm':'Cool')+' shop windows cast measurable light on the actual sidewalk',delta.reduce((a,b)=>a+b,0)>.012);
 }
 check('Warm and cool windows cast different pavement colors',reports[0].delta[0]/Math.max(.0001,reports[0].delta[2])>reports[1].delta[0]/Math.max(.0001,reports[1].delta[2])*1.3);
 api.graphics.render(api.scene,api.camera);
 check('Night highlights use a quarter-resolution soft glow pass',api.graphics.uniforms.bloomStrength.value>0&&api.graphics.nightGlow.texture.width===Math.max(1,Math.ceil(api.graphics.target.width/4)));
 const target=api.graphics.nightGlow.texture,hdr=target.texture.type===THREE.HalfFloatType,pixels=hdr?new Uint16Array(target.width*target.height*4):new Uint8Array(target.width*target.height*4);api.renderer.readRenderTargetPixels(target,0,0,target.width,target.height,pixels);
 let peak=0;for(let i=0;i<pixels.length;i+=4)peak=Math.max(peak,hdr?THREE.DataUtils.fromHalfFloat(pixels[i]):pixels[i]/255);
 check('The glow buffer contains rendered window and lamp highlights',peak>.01);
 api.updateSettings({night:false});api.graphics.render(api.scene,api.camera);
 check('Daylight disables window spill, shop lamps and bloom',fx.night.value===0&&fx.fixtures.every(f=>f.light.intensity===0)&&api.graphics.uniforms.bloomStrength.value===0);
 api.updateSettings(previous);w.__cityNightReport={lightingStyles:new Set(s.displays.map(b=>b.lighting.style)).size,instanceLightVariants:colors.size,pavement:reports,bloomPeak:peak,realTimeShopLights:fx.fixtures.length};
}
