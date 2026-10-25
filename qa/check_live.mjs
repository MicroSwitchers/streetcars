// Read-only smoke check of the deployed game in an isolated Chrome profile.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const qa=dirname(fileURLToPath(import.meta.url)),url=process.argv[2]||'https://microswitchers.github.io/streetcars/';
const ipad=process.argv.includes('--ipad'),loss=process.argv.includes('--loss'),startupLoss=process.argv.includes('--startup-loss');
const sensory=process.argv.includes('--sensory'),phone=process.argv.includes('--phone');let sensoryExpected;
const auto=process.argv.includes('--auto');
const routes=process.argv.includes('--routes');
const routeInput=routes||process.argv.includes('--route-input');
const morning=process.argv.includes('--morning'),dawn=process.argv.includes('--dawn'),atmosphere=process.argv.includes('--atmosphere');
const output=join(qa,'renders-live-'+Date.now());await mkdir(output);
const profile=await mkdtemp(join(qa,'headless-live-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`],{windowsHide:true,stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await wait(100);}}
 if(!port)throw Error('Chrome did not start');
 const page=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(p=>p.type==='page');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 if(ipad){
  await send('Emulation.setDeviceMetricsOverride',{width:1024,height:1366,deviceScaleFactor:2,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  // iPad Safari's desktop website mode reports MacIntel, not an iPad UA.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"platform",{get:()=>"MacIntel"});Object.defineProperty(navigator,"maxTouchPoints",{get:()=>5});Object.defineProperty(navigator,"deviceMemory",{get:()=>undefined});'});
 }
 if(phone){await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});}
 if(auto)await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{if(!sessionStorage.getItem("auto-test-seeded")){localStorage.setItem("queen-street-ride-settings-v1",JSON.stringify({mode:"watch",volume:.2,atmosphereVersion:3}));sessionStorage.setItem("auto-test-seeded","1");}}catch{}'});
 if(morning)await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{if(!sessionStorage.getItem("morning-test-seeded")){localStorage.setItem("queen-street-ride-settings-v1",JSON.stringify({mode:"one",playModeVersion:1,night:true,dayNightCycle:true,doorDwell:10,alwaysGreen:false,volume:.2,atmosphereVersion:3}));sessionStorage.setItem("morning-test-seeded","1");}}catch{}'});
 if(startupLoss)await send('Page.addScriptToEvaluateOnNewDocument',{source:'try{if(localStorage.getItem("queen-street-safe-graphics-v1")!=="1"){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){const gl=original.call(this,type,...args);if(type==="webgl2"&&gl)setTimeout(()=>gl.getExtension("WEBGL_lose_context").loseContext(),0);return gl;};}}catch{}'});
 await send('Page.navigate',{url});
 if(startupLoss){
  let handled=false;for(let i=0;i<200;i++){handled=await evaluate('!!window.queenStreetGraphicsLost&&!document.getElementById("reload-game").hidden');if(handled)break;await wait(100);}
  if(!handled)throw Error('Startup loss did not expose the safe reload control');
  await send('Page.reload',{ignoreCache:true});
  console.log('PASS: GPU failure before game readiness is caught; reload uses persisted safe graphics');
 }
 let ready=false;for(let i=0;i<900;i++){ready=await evaluate('!!window.queenStreet?.ready');if(ready)break;await wait(100);}
 if(!ready)throw Error('Live game did not become playable: '+JSON.stringify(errors));
 let cache;
 for(let i=0;i<600;i++){
  cache=await evaluate('(async()=>{const keys=await caches.keys();for(const key of keys){const c=await caches.open(key),urls=(await c.keys()).map(r=>r.url);if(urls.some(url=>url.includes("cache-metadata")))return {name:key,entries:urls.length};}return null;})()');
  if(cache)break;await wait(100);
 }
 if(!cache)throw Error('Live offline cache did not complete');
 const game=await evaluate('({release:document.querySelector("meta[name=queen-street-release]").content,loadingHidden:document.querySelector("#loading").hidden,triangles:queenStreet.renderer.info.render.triangles,serviceWorker:!!navigator.serviceWorker.controller,manifest:document.querySelector("link[rel=manifest]").href,credits:document.querySelector(".sound-credits").textContent.includes("craigsmith")&&document.querySelector(".sound-credits").textContent.includes("mcpable")})');
 if(!game.loadingHidden||game.triangles<=0||!game.serviceWorker||!game.credits||errors.length)throw Error(JSON.stringify({game,errors}));
 if(morning&&!await evaluate('queenStreet.nightAmount===0&&!queenStreet.settings.night&&queenStreet.settings.volume===.2'))throw Error('A saved night preference prevented a morning launch');
 if(morning){
  if(!await evaluate('queenStreet.settings.alwaysGreen&&queenStreet.ride.alwaysGreen&&queenStreet.settings.doorDwell===5&&queenStreet.ride.dwellSeconds===5&&document.getElementById("setting-green").checked&&document.getElementById("setting-door-dwell").value==="5"'))throw Error('Existing installations did not receive green signals and the five-second door default');
  if(!await evaluate('(()=>{const a=queenStreet;for(let i=0;i<300;i++)a.step(1);return a.nightAmount===0&&!a.settings.night&&a.state.phase==="ready"&&a.state.signal==="green";})()'))throw Error('Waiting for the first press left morning or changed the signals');
  console.log('PASS: Previous defaults migrate to green signals and five-second doors; waiting for the first press stays in daylight');
 }
 if(auto){
  if(!await evaluate('queenStreet.settings.mode==="one"&&queenStreet.settings.volume===.2&&!document.getElementById("pause")'))throw Error('Legacy settings did not migrate to Single press without losing preferences');
  await evaluate('queenStreet.updateSettings({mode:"watch",doorDwell:0,alwaysGreen:true,stopAtLights:false});queenStreet.restart();queenStreet.ride.trafficAhead=()=>null');await wait(200);
  if(!await evaluate('queenStreet.state.speed>0&&!queenStreet.state.paused&&document.querySelector(".ride-dock").hidden&&document.getElementById("assisted-controls").hidden'))throw Error('Full auto did not start without a play/pause control');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'p',code:'KeyP'});
  if(!await evaluate('!queenStreet.state.paused&&queenStreet.primary()===false'))throw Error('A legacy pause action can stop Full auto');
  await evaluate('queenStreet.openSettings()');if(!await evaluate('document.getElementById("settings-dialog").open&&!queenStreet.state.paused'))throw Error('Settings interrupted Full auto');await evaluate('document.getElementById("settings-close").click()');
  if(!await evaluate('(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>window.__autoHidden});window.__autoHidden=true;document.dispatchEvent(new Event("visibilitychange"));const suspended=queenStreet.state.paused;window.__autoHidden=false;document.dispatchEvent(new Event("visibilitychange"));const resumed=!queenStreet.state.paused;delete document.hidden;return suspended&&resumed;})()'))throw Error('Full auto remains suspended after returning to the tab');
  const laps=await evaluate('(()=>{let laps=0,previous=queenStreet.route.stopOffset;for(let i=0;i<100000&&laps<2;i++){queenStreet.step(.1);if(queenStreet.route.stopOffset===0&&previous>0)laps++;previous=queenStreet.route.stopOffset;}return laps;})()');
  if(laps!==2)throw Error('Full auto did not repeat continuously');
  console.log('PASS: Legacy preferences migrate to Single press; no pause button or pause key; Full auto starts and repeats two laps unaided');
 }
 if(sensory){
  const check=async(label,expression)=>{if(!await evaluate(expression))throw Error(label);console.log('PASS: '+label);};
  const screenshot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(r.data,'base64'));};
  await check('Fresh sensory defaults: single press, bright cues and optional signal stops off','queenStreet.settings.mode==="one"&&queenStreet.settings.readyGlow&&!queenStreet.settings.stopAtLights&&queenStreet.settings.streetNames');
  await check('Ready Go is visibly cued; route is narrow and vertical','document.getElementById("go").classList.contains("is-ready")&&document.body.classList.contains("ready-cues")&&document.getElementById("stop-line").getBoundingClientRect().width<=100&&document.querySelector(".route-strip").getBoundingClientRect().height>100&&!document.getElementById("go-detail")&&getComputedStyle(document.getElementById("ride-message")).clipPath!=="none"');
  await screenshot('sensory-ready');
  await evaluate('queenStreet.setPaused(true);document.getElementById("settings-open").click()');
  await check('A normal Settings click does not open it','!document.getElementById("settings-dialog").open');
  const point=await evaluate('(()=>{const r=document.getElementById("settings-open").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  const down=()=>ipad||phone?send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]}):send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  const up=()=>ipad||phone?send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await down();await wait(1100);
  await check('Hold shows progress without opening early','!document.getElementById("settings-dialog").open&&Number(document.querySelector("#settings-open [role=progressbar]").getAttribute("aria-valuenow"))>15&&Number(document.querySelector("#settings-open [role=progressbar]").getAttribute("aria-valuenow"))<65');
  await screenshot('sensory-hold');await up();await wait(2100);
  await check('Releasing early cancels the hold','!document.getElementById("settings-dialog").open&&document.querySelector("#settings-open [role=progressbar]").hidden');
  await down();await wait(3200);await up();
  await check('A full three-second hold opens Settings','document.getElementById("settings-dialog").open&&queenStreet.state.paused');
  await screenshot('sensory-settings');
  await evaluate('document.getElementById("settings-close").click();document.getElementById("settings-open").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await wait(3200);await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  await check('Keyboard hold opens Settings without starting the streetcar','document.getElementById("settings-dialog").open&&queenStreet.state.phase==="ready"');
  await evaluate('document.getElementById("settings-close").click();queenStreet.state.paused=false;queenStreet.state.phase="travelling";queenStreet.state.speed=2;queenStreet.updateHUD()');
  await check('Moving Go loses its ready cue','!document.getElementById("go").classList.contains("is-ready")&&document.getElementById("go").getAttribute("aria-disabled")==="true"');
  await screenshot('sensory-moving');
  await evaluate('queenStreet.restart();queenStreet.setPaused(true);document.getElementById("weather-cycle").click()');
  await check('Weather button selects Random','queenStreet.settings.weatherMode==="random"&&queenStreet.weather.mode==="random"&&document.getElementById("weather-label").textContent==="Random"');
  await evaluate('window.firstRandom=queenStreet.weather.phase.from;for(let i=0;i<2500;i++)queenStreet.weather.update(.1,queenStreet.state.z,0)');
  await check('Random weather slowly advances to a different type','queenStreet.weather.phase.from!==window.firstRandom');
  await evaluate('for(let i=0;i<11;i++)document.getElementById("weather-cycle").click()');
  await check('Weather cycle wraps through all types and returns to Random','queenStreet.settings.weatherMode==="random"');
  await evaluate('(()=>{const set=(id,value)=>{const e=document.getElementById(id);e.checked=value;e.dispatchEvent(new Event("change",{bubbles:true}));};set("setting-ready-glow",false);set("setting-street-names",false);set("setting-stop-at-lights",true);const v=document.getElementById("setting-volume");v.value=20;v.dispatchEvent(new Event("input",{bubbles:true}));document.getElementById("lights").click();queenStreet.updateSettings({mode:"doors",doorDwell:5,stopEvery:2});})()');
  await check('Glow and street names are optional; preferences save immediately','!document.body.classList.contains("ready-cues")&&document.getElementById("stop-line").hidden&&JSON.parse(localStorage.getItem("queen-street-ride-settings-v1")).stopAtLights===true');
  sensoryExpected=await evaluate('JSON.stringify(queenStreet.settings)');
 }
 if(ipad){
  const budget=await evaluate('({simple:queenStreet.graphics.compatibility,pixels:queenStreet.renderer.domElement.width*queenStreet.renderer.domElement.height,shadow:queenStreet.lighting.sun.shadow.mapSize.x,level:queenStreet.performance.level,savedPixels:queenStreet.graphics.stats.texturePixelsSaved})');
  if(!budget.simple||budget.pixels>1100000||budget.pixels<=1000000||budget.shadow!==1536||budget.level!=='balanced'||budget.savedPixels<3000000)throw Error('iPad budget: '+JSON.stringify(budget));
  await evaluate('queenStreet.updateSettings({quality:"low"})');
  if(!await evaluate('queenStreet.renderer.domElement.width*queenStreet.renderer.domElement.height<=400000&&queenStreet.lighting.sun.shadow.mapSize.x===512'))throw Error('Low fallback is not available');
  await evaluate('queenStreet.updateSettings({quality:"high",weather:"rain",weatherMode:"fixed",night:true});queenStreet.setPaused(false);queenStreet.primary()');
  await wait(1500);
  if(await evaluate('queenStreet.performance.level')!=='balanced')throw Error('Saved High bypassed the iPad safety ceiling');
  console.log('PASS: iPad desktop-mode detection, bounded textures/pixels/shadows, night rain and High safety ceiling');
 }
 if(routeInput){
  const checkRoute=async(id,selector='.route-switch-glyph')=>{
   for(let i=0;i<100&&await evaluate('!!queenStreet.routeTransition');i++)await wait(100);
   const current=await evaluate('queenStreet.route.id');
   if(current!==id){
    const point=await evaluate(`(()=>{const button=document.getElementById('route-select'),r=button.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,hit:document.elementFromPoint(x,y)?.closest('#route-select')===button};})()`);
    if(!point.hit)throw Error('Route button cannot receive a tap at '+selector);
    const {x,y}=point;
    if(ipad||phone){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    else{await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x,y});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x,y});}
    for(let i=0;i<100&&await evaluate('!!queenStreet.routeTransition');i++)await wait(100);
   }
   if(!await evaluate('queenStreet.route.id==='+JSON.stringify(id)+'&&!queenStreet.routeTransition'))throw Error('Route button did not select '+id);
  };
  for(const selector of ['.route-badge','#route-title','.route-switch-glyph']){
   if(await evaluate(`(()=>{const r=document.querySelector('#route-select '+${JSON.stringify(selector)}).getBoundingClientRect();return r.width>0&&r.height>0;})()`))await checkRoute(await evaluate('queenStreet.route.id==="queen"?"dundas":"queen"'),selector);
  }
  await checkRoute('dundas');
  console.log('PASS: Real '+(ipad||phone?'touch':'mouse')+' input selects both routes from every visible part of the route button');
  if(!await evaluate('document.querySelector(".route-badge").textContent==="505"&&document.getElementById("route-title").textContent==="Dundas Street"&&queenStreet.route.stops[0].label==="Dundas West Station"&&queenStreet.rig.materials.get("Markings_Atlas").map.image instanceof HTMLCanvasElement&&queenStreet.streetcars.vehicles[0].rig.materials.get("Markings_Atlas").map.image instanceof HTMLCanvasElement'))throw Error('Route identity, stop labels or destination-board textures are stale');
  if(!await evaluate('queenStreet.rig.materials.get("Markings_Atlas").map.source!==queenStreet.streetcars.vehicles[0].rig.materials.get("Markings_Atlas").map.source'))throw Error('Opposite destination boards share a texture source');
  const signs=await evaluate('(()=>{const cells=new Map();for(const s of queenStreet.city.routeSigns)cells.set(s.binding.type+":"+s.binding.slot,s.px+","+s.py);return {roles:cells.size,unique:new Set(cells.values()).size,signCount:queenStreet.city.signCount,stops:document.querySelectorAll("#route-stop-list li").length};})()');
  if(signs.roles!==12||signs.unique!==12||signs.stops!==39)throw Error('Roadside sign roles share an atlas cell or full itinerary is missing: '+JSON.stringify(signs));
  if(routes){
  for(const id of ['dundas','queen']){
   await checkRoute(id);
   const report=await evaluate(`(async()=>{
    const a=queenStreet;a.updateSettings({mode:'watch',quality:'low',volume:0,doorDwell:0,stopEvery:1,alwaysGreen:true});a.restart();a.ride.trafficAhead=()=>null;
    const seen=new Set(),total=a.route.totalStops;let sections=0,lastOffset=0,movingFadeFrames=0,looped=false,objects=0;
    a.scene.traverse(()=>objects++);
    for(let i=0;i<75000;i++){
     const before=a.state.z,pending=a.routeTransition,elapsed=pending?.elapsed,switched=pending?.switched,speed=a.state.speed;
     a.step(.1);a.servedStops.forEach((served,index)=>{if(served)seen.add(index);});
     if(pending&&elapsed>0&&!switched&&a.routeTransition&&!a.routeTransition.switched&&speed>.1){if(a.state.z<=before)throw Error('Streetcar froze during a section fade');movingFadeFrames++;}
     if(a.route.stopOffset!==lastOffset){sections++;if(a.route.stopOffset===0&&seen.size===total){looped=true;break;}lastOffset=a.route.stopOffset;}
     if(i%500===0)await new Promise(r=>setTimeout(r,0));
    }
    let after=0;a.scene.traverse(()=>after++);
    if(!looped||seen.size!==total||movingFadeFrames<10||objects!==after)throw Error('Full itinerary did not loop with bounded scenery: '+JSON.stringify({looped,visited:seen.size,total,movingFadeFrames,objects,after}));
    return {route:a.route.id,total,sections,movingFadeFrames,boundedObjects:objects};
   })()`);
   console.log('PASS: Full route, every stop, continuous section fades and bounded scenery: '+JSON.stringify(report));
   if(!await evaluate('queenStreet.city.signals.every((s,i)=>s.cross===queenStreet.route.crossings[Math.floor(i/2)])'))throw Error('Signals retain a previous section street name');
  }
  await checkRoute('dundas');await evaluate('queenStreet.updateSettings({mode:"one",quality:"balanced"});queenStreet.restart()');
  await checkRoute('dundas');
  const checkpoint=await evaluate('(()=>{const a=queenStreet;a.updateSettings({mode:"watch",doorDwell:0,volume:0});a.ride.trafficAhead=()=>null;for(let i=0;i<10000&&(a.route.stopOffset<2||a.routeTransition);i++)a.step(.1);a.setPaused(true);const s=a.captureSession(),manifest=document.querySelector("link[rel=manifest]");sessionStorage.setItem("queen-street-update-session:"+new URL("./",manifest.href).href,JSON.stringify(s));sessionStorage.setItem("route-checkpoint-expected",JSON.stringify({offset:a.route.stopOffset,z:a.state.z}));return {offset:a.route.stopOffset,z:a.state.z};})()');
  if(checkpoint.offset<2)throw Error('No later-section checkpoint was reached');
  }
 }
 if(atmosphere){
  const report=await evaluate(`(async()=>{
   const a=queenStreet,f=a.weather,ratio=a.renderer.getPixelRatio(),z=a.state.z;
   a.setPaused(true);a.view.transition=null;a.updateSettings({dayNightCycle:false,weatherMode:'fixed',weather:'clear'});
   const settle=()=>{for(let i=0;i<81;i++)f.update(.1,z,a.nightAmount,ratio,false);};settle();
   const read=()=>{a.graphics.render(a.scene,a.camera);const gl=a.renderer.getContext(),pixels=new Uint8Array(32*32*4);gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
   const before=read(),clock=f.cycleTime;a.updateSettings({weather:'storm'});const after=read();
   let change=0;for(let i=0;i<before.length;i++)change+=Math.abs(before[i]-after[i]);change/=before.length;
   if(change>.2||f.uniforms.rainAmount.value!==0||!f.transitioning)throw Error('Weather selection jumps instead of blending: '+change);
   await new Promise(r=>setTimeout(r,700));
   if(f.uniforms.rainAmount.value<=0||f.cycleTime!==clock||a.nightAmount!==0)throw Error('Paused settings cannot preview weather independently of the clock');
   const partial=f.uniforms.rainAmount.value;a.updateSettings({quality:'low'});
   if(!f.transitioning||Math.abs(f.uniforms.rainAmount.value-partial)>1e-10)throw Error('Adaptive graphics rebuilding cancels the weather fade');
   a.updateSettings({quality:'balanced'});a.updateSettings({weather:'clear'});
   if(Math.abs(f.uniforms.rainAmount.value-partial)>1e-10)throw Error('Interrupting a weather blend jumps');settle();
   a.updateSettings({weather:'rain'});settle();const rainyWet=f.uniforms.wetness.value;
   a.updateSettings({weather:'clear'});settle();const lingeringWet=f.uniforms.wetness.value;
   if(rainyWet<=.4||lingeringWet<=.2)throw Error('Rain has no wet film or it dries immediately');
   for(let i=0;i<900;i++)f.update(.1,z,0,ratio,false);
   if(f.uniforms.wetness.value>=lingeringWet)throw Error('Pavement never dries');
   const baseline=a.renderer.info.memory.textures;
   for(let i=0;i<12;i++){a.updateSettings({weather:i%2?'clear':'storm'});for(let j=0;j<4;j++)f.update(.1,z,0,ratio,false);}
   settle();a.updateSettings({weather:'clear'});settle();read();
   if(a.renderer.info.memory.textures>baseline+4)throw Error('Interrupted weather selections leak reflection maps');
   a.updateSettings({weatherMode:'off'});settle();const frozen=f.time;f.update(.1,z,0,ratio);
   if(f.time!==frozen||f.rain.visible||f.uniforms.wetness.value!==0||a.scene.fog.density!==0||f.uniforms.weatherTime.value!==frozen)throw Error('Weather Off does not become static and dry');
   f.restoreClock({time:0,cycleTime:120});if(Math.abs(f.cycleTime-90)>1e-10)throw Error('Old weather checkpoint changes phase progress');
   f.restoreClock({time:0,cycleTime:0,phaseSeconds:180});a.updateSettings({weatherMode:'cycle'});settle();
   while(f.cycleTime<150)f.update(.1,z,0,ratio);const blend=f.phase.blend;
   if(f.phase.from!=='overcast'||f.phase.to!=='mist'||blend<.64||blend>.66)throw Error('Three-minute weather timing or gentle crossfade is incorrect');
   a.updateSettings({dayNightCycle:true,night:false});return {selectionPixelStep:change,rainyWet,lingeringWet,blend,reflectionTextures:a.renderer.info.memory.textures,pausedPreview:true,weatherOff:true};
  })()`);
  console.log('PASS: Natural weather selections, interrupted fades, lingering wet roads, paused previews, bounded reflections and faster cycle: '+JSON.stringify(report));
 }
 if(dawn){
  if(!await evaluate('(()=>{const a=queenStreet;a.updateSettings({dayNightCycle:true});const legacy=a.captureSession();delete legacy.dayNightDuration;delete legacy.manualFade;legacy.cycleTime=300;return a.restoreSession(legacy)&&Math.abs(a.nightAmount-.352)<1e-8;})()'))throw Error('Updating during an older dawn changes brightness');
  const report=await evaluate('(async()=>{const a=queenStreet;a.setPaused(true);a.updateSettings({weatherMode:"fixed",weather:"overcast",night:false,dayNightCycle:true});a.view.transition=null;const gl=a.renderer.getContext(),pixels=new Uint8Array(32*32*4);let previous=null,peak=0,env;for(let i=0;i<=60;i++){const t=282+i,n=i===60?0:1-(i/60)**2*(3-2*i/60);a.weather.update(0,a.state.z,n);a.graphics.render(a.scene,a.camera);if(!env)env=a.scene.environment;else if(env!==a.scene.environment)throw Error("Reflection map switches during dawn");gl.readPixels(Math.floor(gl.drawingBufferWidth/2),Math.floor(gl.drawingBufferHeight/2),32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(previous){let change=0;for(let j=0;j<pixels.length;j++)change+=Math.abs(pixels[j]-previous[j]);peak=Math.max(peak,change/pixels.length);}previous=new Uint8Array(pixels);}a.updateSettings({night:false});a.toggleDayNight();if(a.nightAmount!==0)throw Error("Night button jumps immediately");a.setPaused(false);for(let i=0;i<40;i++)a.step(.1);const midpoint=a.nightAmount;if(midpoint<.4||midpoint>.6)throw Error("Night button does not ease gradually");for(let i=0;i<41;i++)a.step(.1);a.toggleDayNight();if(a.nightAmount<.99)throw Error("Day button jumps immediately");return {peakMeanPixelStep:peak,manualMidpoint:midpoint,stableAtlas:!!a.weather.reflectionAtlas};})()');
  if(report.peakMeanPixelStep>8)throw Error('Abrupt rendered dawn: '+JSON.stringify(report));
  console.log('PASS: Smooth 60-second rendered dawn and gradual Day/Night controls: '+JSON.stringify(report));
 }
 if(loss){
  await evaluate('queenStreet.renderer.forceContextLoss()');await wait(250);
  if(!await evaluate('queenStreet.renderer.userData.recovery.lost&&queenStreet.state.paused&&!document.getElementById("loading").hidden&&localStorage.getItem("queen-street-safe-graphics-v1")==="1"'))throw Error('Context loss was not safely handled');
  const before=await evaluate('queenStreet.state.z');
  await evaluate('queenStreet.renderer.forceContextRestore()');
  let restored=false;for(let i=0;i<200;i++){restored=await evaluate('queenStreet.renderer.userData.recovery.restores>0');if(restored)break;await wait(100);}
  if(!restored||await evaluate('queenStreet.state.z')!==before||!await evaluate('document.getElementById("loading").hidden&&queenStreet.state.paused'))throw Error('Recovery lost the ride or did not clear the error');
  console.log('PASS: Forced GPU loss restores the scene in place and keeps the ride paused');
 }
 if(morning){
  await evaluate('(()=>{const a=queenStreet;a.setPaused(true);a.updateSettings({alwaysGreen:false,doorDwell:15});const snapshot=a.captureSession();snapshot.cycleTime=270;snapshot.manualFade={from:1,elapsed:4,night:true};const manifest=document.querySelector("link[rel=manifest]");sessionStorage.setItem("queen-street-update-session:"+new URL("./",manifest.href).href,JSON.stringify(snapshot));})()');
 }
 if(sensory)sensoryExpected=await evaluate('JSON.stringify(queenStreet.settings)');
 await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await send('Page.reload',{ignoreCache:true});
 ready=false;for(let i=0;i<900;i++){ready=await evaluate('!!window.queenStreet?.ready');if(ready)break;await wait(100);}
 if(!ready||errors.length)throw Error('Installed live game did not reload offline: '+JSON.stringify(errors));
 if(morning&&!await evaluate('queenStreet.nightAmount===0&&!queenStreet.settings.night&&queenStreet.settings.volume===.2'))throw Error('Offline relaunch did not reset to morning');
 if(routeInput&&!await evaluate('queenStreet.route.id==="dundas"&&queenStreet.settings.routeId==="dundas"&&queenStreet.nightAmount===0&&document.querySelector(".route-badge").textContent==="505"'))throw Error('Offline reload lost the selected route or morning start');
 if(routes&&!await evaluate('(()=>{const expected=JSON.parse(sessionStorage.getItem("route-checkpoint-expected"));return queenStreet.route.stopOffset===expected.offset&&Math.abs(queenStreet.state.z-expected.z)<1e-8;})()'))throw Error('Offline update/recovery checkpoint lost its itinerary section');
 if(morning&&!await evaluate('queenStreet.settings.alwaysGreen===false&&queenStreet.settings.doorDwell===15&&queenStreet.captureSession().manualFade===null&&queenStreet.captureSession().cycleTime===0&&queenStreet.state.time>=29.9'))throw Error('Nighttime checkpoint did not restore in morning with later preferences retained');
 if(morning)console.log('PASS: Offline update/recovery checkpoint starts in daylight, clears its night fade and preserves the ride and later settings');
 if(sensory&&await evaluate('JSON.stringify(queenStreet.settings)')!==sensoryExpected)throw Error('Saved sensory preferences did not survive offline reload');
 if(auto&&!await evaluate('queenStreet.settings.mode==="watch"&&!queenStreet.state.paused&&document.querySelector(".ride-dock").hidden'))throw Error('Explicit Full auto preference did not restore and run');
 if(sensory)console.log('PASS: all last-used preferences survive a full offline browser reload');
 if((loss||startupLoss)&&!await evaluate('!!queenStreet.graphics.compatibility&&queenStreet.performance.level==="low"'))throw Error('Reload retried the failed heavy renderer');
 const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'live.png'),Buffer.from(screenshot.data,'base64'));
 const report={pass:true,url,game,cache,offlineReload:true,errors};await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log(output);
}finally{
 socket?.close();browser.kill();await wait(500);
 if(!relative(qa,resolve(profile)).startsWith('..'))await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
