export function checkCinematic(api,check,w){
 const fx=api.weather,g=api.graphics,v=g.atmosphere.uniforms,original={weather:api.settings.weather,weatherMode:api.settings.weatherMode,dayNightCycle:api.settings.dayNightCycle,night:api.settings.night};
 const lights=[];api.scene.traverse(o=>{if(o.isLight)lights.push(o);});
 api.updateSettings({weatherMode:'fixed',weather:'sunset',night:false,dayNightCycle:false});api.setPaused(true);
 const sun=api.lighting.sun.position.clone().sub(api.lighting.sun.target.position).normalize();
 check('Clouded golden hour has a low warm sun aligned down the street',sun.y>.10&&sun.y<.22&&sun.z<-.95&&api.lighting.sun.color.r>api.lighting.sun.color.b*1.8);
 check('Golden-hour skylight is baked into two matching HDR environment probes',fx.environments.get('sunset')?.length===2&&api.scene.environment===fx.environments.get('sunset')[0].texture);
 const cacheSize=fx.environments.size;
 for(const night of [.1,.3,.5,.7,.9]){api.lighting.setNight(night);api.city.setNight(night);g.setNight(night);fx.update(0,api.state.z,night);}
 check('Dusk blends existing day/night probes without rebaking or switching maps',fx.environments.size===cacheSize&&api.scene.environment===fx.environments.get('sunset')[0].texture);
 api.updateSettings({night:false});
 const gl=api.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
 function pixels(){g.render(api.scene,api.camera);const p=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;}
 function delta(a,b){let total=0,changed=0;for(let i=0;i<a.length;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);total+=d;if(d>1)changed++;}return {mean:total/(width*height*3),changed};}
 const withFog=pixels(),density=v.volumeDensity.value;v.volumeDensity.value=0;const noFog=pixels();v.volumeDensity.value=density;
 const shafts=delta(withFog,noFog);check('Atmospheric sunlight contributes subtle rendered shafts',shafts.mean>.005&&shafts.mean<3&&shafts.changed>5);
 v.shadowStrength.value=0;const noShadow=pixels();v.shadowStrength.value=1;
 const occlusion=delta(withFog,noShadow);check('Buildings actually occlude the atmospheric sunlight',occlusion.mean>.001&&occlusion.changed>0);
 check('Atmospheric scattering uses a shared third-resolution HDR target',g.atmosphere.target.width===Math.ceil(g.target.width/3)&&g.atmosphere.target.height===Math.ceil(g.target.height/3));
 api.updateSettings({weather:'rainnight',dayNightCycle:true,night:true});check('City rain works with the separate night setting',api.settings.night&&api.settings.dayNightCycle&&api.nightAmount===1&&fx.rain.visible);
 pixels();check('Existing night lamps supply the volumetric cones',v.lamps.value.some(l=>l.w>0));
 const after=[];api.scene.traverse(o=>{if(o.isLight)after.push(o);});check('Cinematic looks add no lights or shadow maps',after.length===lights.length&&after.every((l,i)=>l===lights[i]));
 api.updateSettings(original);w.__cinematicReport={shafts,occlusion,cachedEnvironments:fx.environments.size,addedLights:0};
}
