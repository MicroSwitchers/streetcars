import * as THREE from 'three';
import {loadStreetcar,yieldToBrowser} from './loading.js';
import {AdaptiveQuality,QUALITY,initialQuality,qualityProfile,renderRatio,QUALITY_MODES} from './performance.js';
import {StreetcarController} from 'streetcar-controller';
import {Ride} from './ride.js';
import {StreetcarCamera,CAMERA_MODES,CAMERA_NAMES} from './cameras.js';
import {DAY_NIGHT,nightLevel} from './day-night.js';
import {prepareRoadsideAsset} from './streetcar-asset.js';
import {createStreetcarTraffic} from './streetcar-traffic.js';
import {StreetcarSounds} from './sounds.js?timing-v11';
import {createWeather,WEATHER} from './weather.js';
import {installSettingsHold,nextWeatherChoice} from './sensory-controls.js';

const $=id=>document.getElementById(id),storageKey='queen-street-ride-settings-v1';
const defaults={mode:'one',doorStyle:'toggle',doorDwell:10,stopEvery:1,quality:'auto',cruise:20,alwaysGreen:false,stopAtLights:false,readyGlow:true,streetNames:true,lights:true,weatherSeed:Math.floor(Math.random()*4294967296),dayNightCycle:true,night:false,weather:'overcast',weatherMode:'cycle',atmosphereVersion:3,size:'large',spacious:false,camera:'auto',swipe:true,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,contrast:false,volume:.35,bell:true,horn:true};
function readSettings(){try{const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');if((saved.atmosphereVersion??0)<3)Object.assign(saved,{weather:'overcast',weatherMode:'cycle',night:false,dayNightCycle:true});return sanitize({...defaults,...saved});}catch{return {...defaults};}}
function sanitize(s){return {mode:['one','doors','manual','watch'].includes(s.mode)?s.mode:'one',doorStyle:s.doorStyle==='separate'?'separate':'toggle',doorDwell:[0,5,10,15,20,30].includes(+s.doorDwell)?+s.doorDwell:10,stopEvery:+s.stopEvery===2?2:1,quality:QUALITY_MODES.includes(s.quality)?s.quality:'auto',cruise:[12,20,30].includes(+s.cruise)?+s.cruise:20,alwaysGreen:!!s.alwaysGreen,stopAtLights:!!s.stopAtLights,readyGlow:s.readyGlow!==false,streetNames:s.streetNames!==false,lights:s.lights!==false,weatherSeed:Number.isInteger(s.weatherSeed)?s.weatherSeed>>>0:defaults.weatherSeed,dayNightCycle:!!s.dayNightCycle,night:!!s.night,weather:Object.hasOwn(WEATHER,s.weather)?s.weather:'overcast',weatherMode:['cycle','random','fixed','off'].includes(s.weatherMode)?s.weatherMode:'cycle',atmosphereVersion:3,size:['large','extra','jumbo'].includes(s.size)?s.size:'large',spacious:!!s.spacious,camera:CAMERA_MODES.includes(s.camera)?s.camera:'auto',swipe:!!s.swipe,reduceMotion:!!s.reduceMotion,contrast:!!s.contrast,volume:Math.max(0,Math.min(1,Number.isFinite(+s.volume)?+s.volume:.35)),bell:!!s.bell,horn:!!s.horn};}

export async function startGame({scene,renderer,graphics,camera,sky,sun,lighting,city,route,canvas,gltf}){
 const settings=readSettings(),sound=new StreetcarSounds(settings);
 try{gltf??=await loadStreetcar();}catch(error){$('load-message').textContent='The streetcar could not load. Refresh to try again.';throw error;}
 const car=prepareRoadsideAsset(gltf.scene),trafficTemplate=car.clone(true);scene.add(car);const rig=new StreetcarController(car),ride=new Ride(route,rig,settings.mode),state=ride.state,view=new StreetcarCamera(camera,canvas,settings,{state,route,rig});
 ride.onDoors=()=>{if(audioUnlocked&&!state.paused)sound.play('door');};
 ride.onDepart=()=>{if(audioUnlocked&&!state.paused)sound.play('bell');};
 state.lights=settings.lights;rig.setLights({headlights:state.lights,tail:state.lights,markers:state.lights,interior:state.lights});ride.cruise=settings.cruise/3.6;ride.setDwellSeconds(settings.doorDwell);ride.setStopEvery(settings.stopEvery);ride.setAlwaysGreen(settings.alwaysGreen);ride.setStopAtLights(settings.stopAtLights);city.updateSignals(state.time,settings.alwaysGreen);lighting?.addStreetcar(car,rig);
 const streetcars=createStreetcarTraffic(scene,trafficTemplate,route,lighting,city.actors);
 const weather=createWeather(scene,city.materials,lighting,graphics,renderer);
 const compatibility=!!graphics.compatibility;
 const performanceBudget=new AdaptiveQuality(initialQuality(renderer.userData?.device??{coarse:matchMedia('(pointer: coarse)').matches,memory:navigator.deviceMemory}),compatibility?'low':'high');
 performanceBudget.select(settings.quality);let needsRender=true,lastCityNight=-1;
 const roadStreetcars=[{id:'player',type:'streetcar',direction:1,length:15.6,active:true},{id:'oncoming',type:'streetcar',direction:-1,length:15.6}];
 city.actors.setStreetcars(()=>{
   const other=streetcars.vehicles[0];
   Object.assign(roadStreetcars[0],{z:state.z,speed:state.speed,doorsOpen:state.doors||rig.doors.front>.001||rig.doors.rear>.001});
   Object.assign(roadStreetcars[1],{z:other.z,speed:other.speed,active:other.active,doorsOpen:other.rig.doors.front>.001||other.rig.doors.rear>.001});
   return roadStreetcars;
 });
 ride.trafficAhead=()=>city.actors.leaderAhead(1,state.z,15.6,'player');city.actors.reset();
 let lastTrafficZ=route.start;
 const marker=new THREE.Mesh(new THREE.TorusGeometry(1.45,.025,6,48),new THREE.MeshBasicMaterial({color:0xd0b474,transparent:true,opacity:.55}));marker.rotation.x=Math.PI/2;scene.add(marker);
 const keys=new Set(),dialog=$('settings-dialog');let wasPaused=false,lastMessage='',lastPrimary=-Infinity,cycleTime=settings.night?DAY_NIGHT.nightStart:0,nightAmount=0,passLegActive=false,passLegStartZ=0,passLegEndZ=route.end,audioUnlocked=false;
 const doorPictures={"open":"<svg class=\"aac-symbol\" data-symbol=\"open\" viewBox=\"0 0 64 64\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M7 6h50v5H7zM9 14h15v30H9zM40 14h15v30H40z\"/><path fill=\"#fffdf3\" d=\"M13 19h7v13h-7zM44 19h7v13h-7z\"/><path fill=\"#157947\" d=\"m3 53 11-8v5h11v6H14v5zm58 0-11-8v5H39v6h11v5z\"/></svg>","close":"<svg class=\"aac-symbol\" data-symbol=\"close\" viewBox=\"0 0 64 64\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M7 6h50v5H7zM15 14h16v30H15zM33 14h16v30H33z\"/><path fill=\"#fffdf3\" d=\"M19 19h8v13h-8zM37 19h8v13h-8z\"/><path fill=\"#ad3c2a\" d=\"M3 50h14v-5l11 8-11 8v-5H3zm58 0H47v-5l-11 8 11 8v-5h14z\"/></svg>"};let lastDoorPicture='';
 const goPicture=$('go').querySelector('svg'),goArrow=goPicture.innerHTML;let lastGoPicture='go';
 const announcements=document.createElement('span');announcements.className='sr-only';announcements.setAttribute('role','status');document.body.append(announcements);
 const speak=text=>{announcements.textContent=text;};
 function save(){try{localStorage.setItem(storageKey,JSON.stringify(settings));}catch{}}
 function updateDayNight(dt=0){
   if(!settings.dayNightCycle){cycleTime=0;settings.night=false;nightAmount=0;}
   else{cycleTime=(cycleTime+dt)%DAY_NIGHT.duration;nightAmount=nightLevel(cycleTime);settings.night=nightAmount>=.5;}
   if(nightAmount!==lastCityNight){city.setNight(nightAmount);lastCityNight=nightAmount;}
   weather.configure(settings.weatherMode,settings.weather,settings.weatherSeed);weather.update(dt,state.z,nightAmount,renderer.getPixelRatio());
 }
 updateDayNight();
 function applyUI(){
   document.body.classList.toggle('ready-cues',settings.readyGlow);$('stop-line').hidden=!settings.streetNames;document.body.dataset.mode=settings.mode;document.body.dataset.doorStyle=settings.doorStyle;document.body.classList.toggle('extra-buttons',settings.size==='extra');document.body.classList.toggle('high-contrast',settings.contrast);document.body.classList.toggle('jumbo-buttons',settings.size==='jumbo');document.body.classList.toggle('spacious-buttons',settings.spacious);
   $('assisted-controls').hidden=settings.mode==='manual';$('manual-controls').hidden=settings.mode!=='manual';$('doors').hidden=['one','watch'].includes(settings.mode)||settings.doorStyle!=='toggle';$('separate-doors').hidden=['one','watch'].includes(settings.mode)||settings.doorStyle!=='separate';
   if(['doors','manual'].includes(settings.mode))$(settings.mode==='manual'?'manual-door-slot':'assisted-controls').append(settings.doorStyle==='toggle'?$('doors'):$('separate-doors'));
   $('bell').hidden=!settings.bell;$('horn').hidden=!settings.horn;$('door-style-setting').hidden=['one','watch'].includes(settings.mode);$('day-night-toggle').hidden=!settings.dayNightCycle;$('signal-status').hidden=!settings.stopAtLights;
   document.querySelectorAll('[name=control-mode]').forEach(input=>input.checked=input.value===settings.mode);
   for(const [id,value] of [['setting-doors',settings.doorStyle],['setting-door-dwell',settings.doorDwell],['setting-stop-every',settings.stopEvery],['setting-quality',settings.quality],['setting-speed',settings.cruise],['setting-size',settings.size],['setting-camera',settings.camera],['setting-volume',Math.round(settings.volume*100)]])$(id).value=value;
   for(const [id,value] of [['setting-ready-glow',settings.readyGlow],['setting-street-names',settings.streetNames],['setting-green',settings.alwaysGreen],['setting-stop-at-lights',settings.stopAtLights],['setting-day-night',settings.dayNightCycle],['setting-spacious',settings.spacious],['setting-swipe',settings.swipe],['setting-motion',settings.reduceMotion],['setting-contrast',settings.contrast],['setting-bell',settings.bell],['setting-horn',settings.horn]])$(id).checked=value;
   $('free-camera-help').hidden=settings.camera!=='free';
   $('lights').textContent=state.lights?'Night lights on':'Night lights off';$('lights').setAttribute('aria-pressed',state.lights);
   $('volume-value').textContent=settings.volume===0?'Off':Math.round(settings.volume*100)+'%';$('camera-name').textContent=CAMERA_NAMES[settings.camera];$('camera').setAttribute('aria-label','Change camera. Current view: '+CAMERA_NAMES[settings.camera]);
   $('setting-quality').disabled=compatibility;$('setting-quality').title=compatibility?'Lighter graphics are active to keep this device stable.':'';if(compatibility)$('setting-quality').previousElementSibling.querySelector('small').textContent='Lighter graphics are active to keep this device stable.';
   $('setting-weather').value=settings.weather;$('setting-weather-mode').value=settings.weatherMode;
   $('weather-profile-setting').hidden=settings.weatherMode!=='fixed';$('setting-weather').disabled=settings.weatherMode!=='fixed';
   const weatherLabel=settings.weatherMode==='random'?'Random':settings.weatherMode==='cycle'?'Changing skies':settings.weatherMode==='off'?'Weather off':WEATHER[settings.weather].label;
   $('weather-label').textContent=weatherLabel;$('weather-cycle').setAttribute('aria-label','Weather: '+weatherLabel+'. Change weather');$('weather-cycle').title='Weather: '+weatherLabel;
   $('weather-mode-help').textContent=settings.weatherMode==='off'?'Static, soft lighting without rain, haze, rays or wet-road effects. Day/night still works.':settings.weatherMode==='random'?'Weather changes gently in a shuffled order, through day and night.':settings.weatherMode==='fixed'?'Choose one weather type below. The day/night cycle works separately.':'Weather changes gently over several minutes, through day and night.';
   $('day-night-label').textContent=settings.night?'Day':'Night';$('day-night-toggle').setAttribute('aria-label','Switch to '+(settings.night?'day':'night'));$('day-night-toggle').title='Switch to '+(settings.night?'day':'night');
   updateHUD();
 }
 function updateSettings(changes){needsRender=true;const previousQuality=settings.quality,previousMode=settings.mode,previousCamera=settings.camera;Object.assign(settings,sanitize({...settings,...changes}));if(changes.camera==='free'&&previousCamera!=='free')settings.swipe=true;if(settings.mode!==previousMode){keys.clear();ride.setMode(settings.mode);$('power').value=0;}if(changes.dayNightCycle===false){cycleTime=0;settings.night=false;}else if(changes.night!==undefined)cycleTime=settings.night?DAY_NIGHT.nightStart:0;ride.cruise=settings.cruise/3.6;ride.setDwellSeconds(settings.doorDwell);ride.setStopEvery(settings.stopEvery);ride.setAlwaysGreen(settings.alwaysGreen);ride.setStopAtLights(settings.stopAtLights);city.updateSignals(state.time,settings.alwaysGreen);updateDayNight();if(settings.quality!==previousQuality){performanceBudget.select(settings.quality);applyQuality();}if(previousCamera!==settings.camera||changes.swipe!==undefined||changes.reduceMotion!==undefined)view.reset();if(settings.volume===0)sound.stop();save();applyUI();updateHUD();return settings;}
 function toggleDayNight(){if(!settings.dayNightCycle)return false;cycleTime=settings.night?0:DAY_NIGHT.nightStart;updateDayNight();save();applyUI();updateHUD();speak(settings.night?'Night scene selected.':'Day scene selected.');return true;}
 function tripSeconds(distance,speed,accelerating=.7,braking=1.05,initialSpeed=0){
   const top=Math.max(.1,speed),start=Math.min(top,Math.max(0,initialSpeed)),accelTime=(top-start)/accelerating;
   const accelDistance=(top*top-start*start)/(2*accelerating),brakeTime=top/braking,brakeDistance=top*top/(2*braking);
   return accelTime+brakeTime+Math.max(0,distance-accelDistance-brakeDistance)/top;
 }
 function startPassForLeg(distance,cruise,accelerating,braking,progress=0,initialSpeed=0){
   sound.startPass(tripSeconds(distance,cruise,accelerating,braking,initialSpeed),progress).catch(error=>console.error('Streetcar pass audio could not start:',error));
 }
 function syncStreetcarSound(){
   const moving=state.speed>.1&&(settings.mode==='manual'||state.phase==='travelling');
   if(!moving){
     if(passLegActive){
       if(['atStop','finished'].includes(state.phase)||state.complete||(settings.mode==='manual'&&state.currentStop>=0&&state.served[state.currentStop])){sound.stopPass();passLegActive=false;}
       else sound.pausePass();
     }
     return;
   }
   const destination=settings.mode==='manual'?(route.stops.find(stop=>stop.z>state.z+6)?.z??route.end):(route.stops[state.nextStop]?.z??route.end);
   const distance=Math.max(.25,destination-state.z),cruise=settings.mode==='manual'?40/3.6:ride.cruise;
   const accelerating=settings.mode==='manual'?.87:.70,braking=settings.mode==='manual'?1.85:1.05;
   if(!passLegActive){
     passLegActive=true;passLegStartZ=state.z;passLegEndZ=destination;
     if(audioUnlocked)startPassForLeg(distance,cruise,accelerating,braking,0,state.speed);
   }else if(audioUnlocked&&sound.passPaused)sound.resumePass().catch(error=>console.error('Streetcar pass audio could not resume:',error));
   else if(audioUnlocked&&!sound.passActive&&!sound.passStarting&&!sound.passFinished){
     const progress=(state.z-passLegStartZ)/Math.max(.01,passLegEndZ-passLegStartZ);
     startPassForLeg(distance,cruise,accelerating,braking,progress,state.speed);
   }
   sound.syncPass();
 }
 function unlockAudio(){
   audioUnlocked=true;sound.unlockPass();
 }
 function primary(){const now=performance.now();if(now-lastPrimary<400)return false;lastPrimary=now;unlockAudio();if(settings.mode==='watch'){setPaused(!state.paused);return true;}if(state.paused&&!dialog.open){state.paused=false;updateHUD();if(state.phase==='travelling')return true;}const accepted=ride.go();updateHUD();return accepted;}
 function doors(open){if(['one','watch'].includes(settings.mode))return false;if(state.speed<=.12)unlockAudio();const ok=open===undefined?ride.toggleDoors():ride.setDoors(open);if(!ok)speak(ride.remainingDwell>0?'Keep the doors open for '+Math.ceil(ride.remainingDwell)+' more seconds.':'The streetcar needs to stop before the doors can open.');updateHUD();return ok;}
 async function play(name){unlockAudio();const ok=await sound.play(name);speak(ok?(name==='bell'?'Bell.':'Horn.'):settings.volume===0?'Sound is off.':'Sound is not available.');}
 function setPaused(value){needsRender=true;if(!value)unlockAudio();state.paused=!!value;keys.clear();state.power=0;$('power').value=0;if(state.paused)sound.stop();updateHUD();}
 function restart(){needsRender=true;sound.stop();sound.stopPass();passLegActive=false;ride.restart();streetcars.reset(route.start);city.actors.reset();state.lights=state.lights??true;keys.clear();$('power').value=0;view.reset();updateWorld(0);updateHUD();}
 function setCamera(mode){const value=typeof mode==='number'?CAMERA_MODES[((mode%CAMERA_MODES.length)+CAMERA_MODES.length)%CAMERA_MODES.length]:mode;updateSettings({camera:value});}
 function cycleCamera(){setCamera(CAMERA_MODES[(CAMERA_MODES.indexOf(settings.camera)+1)%CAMERA_MODES.length]);}
 function openSettings(){if(dialog.open)return;wasPaused=state.paused;setPaused(true);dialog.returnValue='';dialog.showModal();$('settings-close').focus();}
 function closeSettings(play=false){dialog.close(play===true?'play':'');state.paused=wasPaused;keys.clear();updateHUD();$(play===true&&settings.mode!=='manual'?'go':'settings-open').focus();}
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
 dialog.addEventListener('close',()=>{state.paused=wasPaused;keys.clear();updateHUD();$(dialog.returnValue==='play'&&settings.mode!=='manual'?'go':'settings-open').focus();});
 installSettingsHold($('settings-open'),openSettings);$('settings-close').onclick=()=>closeSettings();$('settings-done').onclick=()=>closeSettings(true);
 $('go').onclick=primary;$('doors').onclick=()=>doors();$('door-open').onclick=()=>doors(true);$('door-close').onclick=()=>doors(false);
 for(const id of ['go','doors','door-open','door-close','bell','horn']){const button=$(id);button.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat)button.click();}});button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))e.preventDefault();});}
 $('bell').onclick=()=>play('bell');$('horn').onclick=()=>play('horn');$('test-bell').onclick=()=>play('bell');$('test-horn').onclick=()=>play('horn');
 $('pause').onclick=()=>setPaused(!state.paused);$('camera').onclick=cycleCamera;$('reset-view').onclick=()=>{view.reset();speak('Camera re-centred.');};
 $('day-night-toggle').onclick=toggleDayNight;
 $('weather-cycle').onclick=()=>updateSettings(nextWeatherChoice(settings.weatherMode,settings.weather));
 $('setting-weather').onchange=e=>updateSettings({weather:e.target.value});
 $('setting-weather-mode').onchange=e=>updateSettings({weatherMode:e.target.value});
 $('restart').onclick=()=>{restart();wasPaused=false;closeSettings();};
 $('lights').onclick=()=>{needsRender=true;state.lights=!state.lights;settings.lights=state.lights;save();rig.setLights({headlights:state.lights,tail:state.lights,markers:state.lights,interior:state.lights});$('lights').textContent=state.lights?'Night lights on':'Night lights off';$('lights').setAttribute('aria-pressed',state.lights);};
 $('power').oninput=e=>{state.power=Number(e.target.value);if(state.power>0)unlockAudio();};
 document.querySelectorAll('[name=control-mode]').forEach(input=>input.onchange=()=>{if(input.checked)updateSettings({mode:input.value});});
 for(const [id,key,kind] of [['setting-doors','doorStyle'],['setting-door-dwell','doorDwell','number'],['setting-stop-every','stopEvery','number'],['setting-quality','quality'],['setting-speed','cruise','number'],['setting-size','size'],['setting-camera','camera'],['setting-ready-glow','readyGlow','check'],['setting-street-names','streetNames','check'],['setting-green','alwaysGreen','check'],['setting-stop-at-lights','stopAtLights','check'],['setting-day-night','dayNightCycle','check'],['setting-spacious','spacious','check'],['setting-swipe','swipe','check'],['setting-motion','reduceMotion','check'],['setting-contrast','contrast','check'],['setting-bell','bell','check'],['setting-horn','horn','check']])$(id).onchange=e=>updateSettings({[key]:kind==='check'?e.target.checked:kind==='number'?+e.target.value:e.target.value});
 $('setting-volume').oninput=e=>updateSettings({volume:+e.target.value/100});
 window.addEventListener('keydown',e=>{
   if(dialog.open||(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)&&e.target.id!=='power'))return;const k=e.code;
   if(e.target.id==='power'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))return;
   if(settings.mode!=='manual'&&['Space','Enter'].includes(k)){if(e.target.closest('button'))return;e.preventDefault();if(!e.repeat)primary();return;}
   if(settings.mode==='manual'&&['KeyW','KeyS','ArrowUp','ArrowDown','Space'].includes(k)){if(k==='Space'&&e.target.closest('button'))return;e.preventDefault();unlockAudio();keys.add(k);}
   if(e.repeat)return;if(k==='KeyB'&&settings.bell)play('bell');if(k==='KeyH'&&settings.horn)play('horn');if(k==='KeyC')cycleCamera();if(k==='KeyP')setPaused(!state.paused);if(k==='KeyD'&&settings.mode!=='one')doors();
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();state.power=0;$('power').value=0;});document.addEventListener('visibilitychange',()=>{if(document.hidden&&!dialog.open)setPaused(true);});
 function step(dt,commandOverride){if(state.paused)return;let command=commandOverride??state.power;if(keys.has('KeyW')||keys.has('ArrowUp'))command=1;if(keys.has('KeyS')||keys.has('ArrowDown'))command=-1;if(keys.has('Space'))command=-2;updateDayNight(dt);ride.step(dt,command);syncStreetcarSound();city.updateSignals(state.time,settings.alwaysGreen);city.update(state.time,dt,settings.alwaysGreen);updateWorld(dt);}
 function updateWorld(dt){car.position.set(route.trackX,.026,state.z);city.actors.setFocus(state.z);streetcars.update(dt,state.z,state.time,settings.alwaysGreen);if(Math.abs(state.z-lastTrafficZ)>20)city.actors.reset();lastTrafficZ=state.z;const hit=rig.followWireSegment(new THREE.Vector3(route.trackX,route.wireY,state.z-18),new THREE.Vector3(route.trackX,route.wireY,state.z+18));state.wire=hit.reachable;state.wireError=hit.errorMetres;if(lighting)lighting.update(state.z);else{sky.position.z=state.z;sun.position.set(35,65,state.z-25);sun.target.position.set(0,0,state.z+15);}}
 function updateHUD(){
   $('signal-status').dataset.signal=state.signal;$('signal-label').textContent='Signal · '+state.signal[0].toUpperCase()+state.signal.slice(1);$('signal-status').setAttribute('aria-label','Traffic signal ahead: '+state.signal+(settings.stopAtLights?'; the streetcar will '+(state.signal==='green'?'continue':'stop')+'.':'.'));
   $('day-night-label').textContent=settings.night?'Day':'Night';$('day-night-toggle').setAttribute('aria-label','Switch to '+(settings.night?'day':'night'));
   const manual=settings.mode==='manual',travelling=['closing','travelling'].includes(state.phase),at=state.currentStop>=0&&!travelling;
   const next=manual?route.stops.find(stop=>stop.z>=state.z-6):route.stops[state.nextStop],current=route.stops[state.currentStop],display=at?current:next;
   document.querySelectorAll('.route-stop').forEach((dot,i)=>{dot.classList.toggle('is-visited',i<=state.currentStop);dot.classList.toggle('is-next',display===route.stops[i]);});
   const progress=THREE.MathUtils.clamp((state.z-route.stops[0].z)/(route.stops[2].z-route.stops[0].z),0,1);$('route-fill').style.height=(progress*100)+'%';
   $('stop-prefix').textContent=at?'AT THE STOP':'NEXT STOP';$('stop-name').textContent=display?.name??'Queen Street';$('distance').textContent=display&&!at?Math.max(0,Math.round(display.z-state.z))+' m':'';
   const message=state.paused?'Paused':state.speed>.1?'Moving':state.phase==='closing'?'Doors closing':state.doors?'Doors open':'Ready';
   if(message!==lastMessage){$('ride-message').textContent=message;lastMessage=message;}
   const watching=settings.mode==='watch',ready=watching||state.paused||ride.canGo;$('go').setAttribute('aria-disabled',!ready);
   $('go-label').textContent=state.paused?'RESUME':watching?'PAUSE':state.phase==='finished'?'AGAIN':'GO';
   const goAction=watching&&!state.paused?'pause':'go';if(goAction!==lastGoPicture){goPicture.innerHTML=goAction==='pause'?'<path fill="currentColor" d="M15 9h12v46H15zM37 9h12v46H37z"/>':goArrow;lastGoPicture=goAction;}
   $('go').setAttribute('aria-label',watching?(state.paused?'Resume watching streetcars':'Pause watching streetcars'):$('go-label').textContent);
   $('go').classList.toggle('long-label',$('go-label').textContent.length>5);

   const unavailable=state.speed>.12||state.phase==='closing',holding=state.doors&&!ride.dwellReady;$('doors').setAttribute('aria-disabled',unavailable||holding);$('door-open').setAttribute('aria-disabled',unavailable||state.doors);$('door-close').setAttribute('aria-disabled',unavailable||!state.doors||holding);$('doors').setAttribute('aria-pressed',state.doors);$('door-label').textContent=state.doors?'Close doors':'Open doors';$('doors').setAttribute('aria-label',state.doors?'Close doors':'Open doors');const picture=state.doors?'close':'open';if(picture!==lastDoorPicture){$('door-picture').innerHTML=doorPictures[picture];lastDoorPicture=picture;}
   for(const id of ['go','doors','door-open','door-close'])$(id).classList.toggle('is-ready',$(id).getAttribute('aria-disabled')!=='true');
   $('pause-label').textContent=state.paused?'Resume':'Pause';$('pause').setAttribute('aria-label',state.paused?'Resume ride':'Pause ride');$('pause-icon').innerHTML=state.paused?'<path d="M8 5l11 7-11 7z"/>':'<path d="M8 5v14M16 5v14"/>';
   $('speed').textContent=Math.round(state.speed*3.6);$('power-label').textContent=state.doors?'Doors open':state.assist?'Signal hold':state.command>0?'Power':state.command<0?'Brake':'Coast';
   marker.visible=manual&&!!next;marker.position.set(route.trackX,.055,next?.z??0);
 }
 function applyQuality(){const profile=qualityProfile(performanceBudget.level,compatibility);graphics.setQuality(profile);lighting?.setQuality(profile);resize();}
 function resize(){needsRender=true;const profile=qualityProfile(performanceBudget.level,compatibility);renderer.setPixelRatio(renderRatio(profile,innerWidth,innerHeight,devicePixelRatio));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();view.instant=true;}
 function captureSession(){return {version:1,ride:ride.snapshot(),cycleTime,weather:weather.snapshotClock()};}
 function restoreSession(snapshot){if(snapshot?.version!==1||!ride.restore(snapshot.ride))return false;if(typeof snapshot.ride.state.lights==='boolean'){state.lights=snapshot.ride.state.lights;settings.lights=state.lights;rig.setLights({headlights:state.lights,tail:state.lights,markers:state.lights,interior:state.lights});$('lights').textContent=state.lights?'Night lights on':'Night lights off';$('lights').setAttribute('aria-pressed',state.lights);}if(Number.isFinite(snapshot.cycleTime))cycleTime=((snapshot.cycleTime%DAY_NIGHT.duration)+DAY_NIGHT.duration)%DAY_NIGHT.duration;weather.restoreClock(snapshot.weather);updateDayNight();city.actors.reset();streetcars.reset(state.z);updateWorld(0);view.reset();needsRender=true;return true;}
 const manifest=document.querySelector('link[rel="manifest"]'),release=document.querySelector('meta[name="queen-street-release"]')?.content;
 const sessionKey=release&&manifest?'queen-street-update-session:'+new URL('./',manifest.href).href:null;
 if(sessionKey)try{const saved=sessionStorage.getItem(sessionKey);sessionStorage.removeItem(sessionKey);if(saved)restoreSession(JSON.parse(saved));}catch{}
 window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);applyQuality();applyUI();updateWorld(0);view.update(state.z,0);
 if(renderer.userData?.recovery?.lost)return null;
 graphics.prepare(scene,camera);await yieldToBrowser();
 if(renderer.compileAsync){renderer.setRenderTarget(graphics.target);try{await renderer.compileAsync(scene,camera);}finally{renderer.setRenderTarget(null);}}
 if(renderer.userData?.recovery?.lost)return null;
 graphics.render(scene,camera,view.transition);$('loading').hidden=true;save();
 const api={scene,car,rig,streetcars,renderer,graphics,camera,lighting,state,route,city,weather,ride,settings,sound,view,performance:performanceBudget,captureSession,restoreSession,step,setCamera,primary,toggleDoors:()=>doors(),toggleDayNight, get nightAmount(){return nightAmount;},restart,updateHUD,updateSettings,setPaused,openSettings,ready:true};window.queenStreet=api;window.dispatchEvent(new Event('queen-street-ready'));
 if(settings.mode!=='manual')$('go').focus({preventScroll:true});
 const clock=new THREE.Clock(),lastPosition=new THREE.Vector3(),lastRotation=new THREE.Quaternion();let frameCount=0,lastFov=0,pendingFrame=0;
 function frame(){requestAnimationFrame(frame);pendingFrame+=clock.getDelta();if(document.hidden||renderer.userData?.recovery?.lost){pendingFrame=0;return;}if(pendingFrame<(compatibility?1/30:1/60)-.001&&!needsRender)return;
   const elapsed=pendingFrame,dt=Math.min(elapsed,.06);pendingFrame=0;
   step(dt);view.stopped=['atStop','finished'].includes(state.phase);view.update(state.z,dt,state.paused);
   if(performanceBudget.sample(elapsed,!state.paused&&!view.transition)){applyQuality();}
   if(frameCount++%6===0)updateHUD();
   const cameraMoved=!camera.position.equals(lastPosition)||!camera.quaternion.equals(lastRotation)||camera.fov!==lastFov;
   if(!state.paused||needsRender||cameraMoved||view.transition){graphics.render(scene,camera,view.transition);needsRender=false;lastPosition.copy(camera.position);lastRotation.copy(camera.quaternion);lastFov=camera.fov;}
 }
 frame();return api;
}
