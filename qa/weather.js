export function checkWeather(api,check,w){
 const fx=api.weather,graphics=api.graphics,u=graphics.uniforms,previous={weather:api.settings.weather,night:api.settings.night,dayNightCycle:api.settings.dayNightCycle};
 api.setPaused(true);
 const lights=[];api.scene.traverse(o=>{if(o.isLight)lights.push(o);});
 api.updateSettings({weather:'clear',night:false,dayNightCycle:true});const sunlight=api.lighting.sun.intensity,fog=api.scene.fog.density;
 check('Clear weather keeps the road dry and rain hidden',fx.uniforms.wetness.value===0&&!fx.rain.visible&&u.wetness.value===0);
 api.updateSettings({weather:'overcast'});
 check('Overcast changes cloud cover and softens direct daylight',api.lighting.sun.intensity<sunlight*.4&&fx.uniforms.cloudCover.value>.8&&!fx.rain.visible);
 api.updateSettings({weather:'mist'});
 check('Mist adds distance haze without falling rain',api.scene.fog.density>fog*3&&!fx.rain.visible);
 api.updateSettings({weather:'rain',night:true});
 check('Rain coordinates clouds, wet materials, ripples and reflections',fx.rain.visible&&fx.uniforms.rainAmount.value===1&&fx.uniforms.wetness.value===1&&u.wetness.value===1&&u.weatherNight.value===1);
 check('Rain uses one bounded batch without extra shadow maps',fx.rain.isPoints&&fx.geometry.attributes.position.count===4500&&!fx.rain.castShadow);
 const gl=api.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
 function pixels(){graphics.render(api.scene,api.camera);const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;}
 function difference(a,b){let total=0,changed=0;for(let i=0;i<width*Math.floor(height*.50)*4;i+=4){let d=0;for(let c=0;c<3;c++)d+=Math.abs(a[i+c]-b[i+c]);total+=d;if(d>12)changed++;}return {mean:total/(width*Math.floor(height*.50)*3),changed};}
 const wet=pixels();u.wetness.value=0;const noReflection=pixels();u.wetness.value=1;
 const reflection=difference(wet,noReflection);
 check('Wet pavement reflects measurable rendered street and lamp detail',reflection.mean>.3&&reflection.changed>200);
 fx.uniforms.wetness.value=0;u.wetness.value=0;const dry=pixels();
 const material=difference(noReflection,dry);fx.uniforms.wetness.value=1;u.wetness.value=1;
 check('Water film changes the actual PBR pavement shading',material.mean>.1&&material.changed>100);
 const time=fx.time;api.step(.05);check('Pausing freezes weather animation',fx.time===time);
 const buffer=fx.geometry.attributes.position.array;
 api.setPaused(false);api.step(.05);api.setPaused(true);
 check('Weather resumes using the same particle buffer',fx.time>time&&fx.geometry.attributes.position.array===buffer);
 const after=[];api.scene.traverse(o=>{if(o.isLight)after.push(o);});
 check('Weather preserves the existing light pool',lights.length===after.length&&lights.every((l,i)=>l===after[i]));
 check('Weather selector matches the saved setting',w.document.querySelector('#setting-weather').value==='rain'&&JSON.parse(w.localStorage.getItem('queen-street-ride-settings-v1')).weather==='rain');
 if(w.document.querySelector('#embedded-car'))check('Offline weather needs no external textures',!w.performance.getEntriesByType('resource').some(r=>/\/weather.js|rain\.(png|jpg)|sky\.(hdr|jpg)/.test(r.name)));
 w.__weatherReport={reflection,material,particles:4500,addedLights:after.length-lights.length};api.updateSettings(previous);
}
