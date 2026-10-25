import {WEATHER,mixWeather} from '../dist/weather-cycle.js';

export function checkWeatherModes(api,check,w,selected='cycle'){
 const fx=api.weather,g=api.graphics,doc=w.document;
 const settle=()=>{for(let i=0;i<81;i++)fx.update(.1,api.state.z,api.nightAmount,api.renderer.getPixelRatio(),false);};
 api.setPaused(true);api.updateSettings({weatherMode:'fixed',weather:'sunset',dayNightCycle:true,night:false});
 settle();
 check('Daylight has no bloom or exposure boost',g.uniforms.bloomStrength.value===0&&api.renderer.toneMappingExposure===1);
 check('Warm sun stays behind cloud and uses restrained haze',fx.uniforms.cloudCover.value>=.8&&g.atmosphere.uniforms.volumeDensity.value<=.008);
 const mode=doc.querySelector('#setting-weather-mode'),profile=doc.querySelector('#setting-weather');
 function choose(value){mode.value=value;mode.dispatchEvent(new w.Event('change',{bubbles:true}));settle();}
 choose('fixed');profile.value='rain';profile.dispatchEvent(new w.Event('change',{bubbles:true}));settle();
 check('One weather type exposes the selector and applies rain',!doc.querySelector('#weather-profile-setting').hidden&&!profile.disabled&&fx.rain.visible&&fx.mode==='fixed');
 const cycleTime=fx.cycleTime;
 for(const night of [0,.1,.3,.6,1,.7,.2,0])fx.update(.1,api.state.z,night);
 check('Fixed rain persists through day and night without advancing the weather cycle',fx.uniforms.rainAmount.value===1&&fx.uniforms.wetness.value>.4&&fx.cycleTime===cycleTime);
 api.updateSettings({night:true});const nightBefore=api.nightAmount;
 api.updateSettings({weather:'sunset'});
 settle();
 check('Choosing sunny weather does not switch off night or the day/night cycle',api.settings.dayNightCycle&&api.nightAmount===nightBefore);
 choose('off');
 check('Off removes rain, wet roads, fog, scattering and bloom',!fx.rain.visible&&g.uniforms.wetness.value===0&&g.uniforms.rainAmount.value===0&&api.scene.fog.density===0&&g.atmosphere.uniforms.volumeDensity.value===0&&g.uniforms.bloomStrength.value===0);
 check('Off hides the fixed-weather selector',doc.querySelector('#weather-profile-setting').hidden&&profile.disabled);
 const time=fx.time,clock=fx.cycleTime;
 fx.update(.1,api.state.z,1);api.graphics.render(api.scene,api.camera);
 check('Off leaves the sky static and the weather clock stopped',fx.time===time&&fx.cycleTime===clock&&fx.uniforms.weatherTime.value===time);
 check('Night and street lighting still work with weather off',api.nightAmount===1&&api.lighting.streetLights.fixtures.some(f=>f.light.intensity>0));
 api.toggleDayNight();const wasPausedAtToggle=api.state.paused;api.state.paused=false;api.step(8);api.state.paused=wasPausedAtToggle;check('Day/night button fades to day with weather off',api.nightAmount===0);
 check('Off is saved to local storage',JSON.parse(w.localStorage.getItem('queen-street-ride-settings-v1')).weatherMode==='off');
 choose('cycle');api.updateSettings({night:false});
 const z=api.state.z,buffer=fx.geometry.attributes.position.array;
 // Advance the real weather controller into its first crossfade, without
 // moving traffic or rendering thousands of redundant frames.
 while(fx.cycleTime<155)fx.update(.1,z,.4);
 api.graphics.render(api.scene,api.camera);
 const phase=fx.phase;
 check('Automatic weather eases gradually from overcast into mist',phase.from==='overcast'&&phase.to==='mist'&&phase.blend>.7&&phase.blend<.8);
 check('Sky, rain and HDR reflections share the same weather blend',fx.profileBlend.value===phase.blend&&fx.uniforms.rainAmount.value===0&&fx.uniforms.golden.value>0&&fx.uniforms.golden.value<.28&&fx.environments.has('mist'));
 const cache=fx.environments.size,blend=fx.profileBlend.value,cloud=fx.uniforms.cloudCover.value;
 fx.update(.05,z,.4);
 const direction=api.lighting.sun.position.clone().sub(api.lighting.sun.target.position).normalize();
 const expected=mixWeather(WEATHER[fx.phase.from],WEATHER[fx.phase.to],fx.phase.blend).sun;
 const length=Math.hypot(...expected);
 check('Interpolated sun direction also updates the actual light and shadow basis',direction.toArray().every((n,i)=>Math.abs(n-expected[i]/length)<1e-6));
 check('Weather progresses without rebaking probes or reallocating particles',fx.profileBlend.value>blend&&fx.profileBlend.value-blend<.002&&Math.abs(fx.uniforms.cloudCover.value-cloud)<.001&&fx.environments.size===cache&&fx.geometry.attributes.position.array===buffer);
 const paused=fx.cycleTime;api.step(.05);check('Pausing freezes both the weather cycle and its particles',fx.cycleTime===paused);
 const before=fx.uniforms.cloudCover.value;while(fx.cycleTime<180.1)fx.update(.1,z,.4);
 check('Cycle crosses into the next weather phase continuously',fx.phase.from==='mist'&&Math.abs(fx.uniforms.cloudCover.value-.82)<1e-6&&Math.abs(before-.82)<.03);
 const held=fx.cycleTime;choose('fixed');fx.update(.1,z,0);choose('off');fx.update(.1,z,0);choose('cycle');
 check('Fixed and Off suspend the automatic clock; Cycle resumes it',Math.abs(fx.cycleTime-held)<1e-6);
 api.updateSettings({weatherMode:selected,weather:'sunset',dayNightCycle:true,night:false});
 check('Weather mode and fixed type persist independently',JSON.parse(w.localStorage.getItem('queen-street-ride-settings-v1')).weatherMode===selected&&profile.value==='sunset');
 w.__weatherModesReport={mode:selected,cycleTime:fx.cycleTime,phase:fx.phase,cachedProbes:fx.environments.size};
}
