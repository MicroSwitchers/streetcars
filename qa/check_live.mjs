// Read-only smoke check of the deployed game in an isolated Chrome profile.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const qa=dirname(fileURLToPath(import.meta.url)),url=process.argv[2]||'https://microswitchers.github.io/streetcars/';
const ipad=process.argv.includes('--ipad'),loss=process.argv.includes('--loss'),startupLoss=process.argv.includes('--startup-loss');
const iphone=process.argv.includes('--iphone');
const sensory=process.argv.includes('--sensory'),phone=process.argv.includes('--phone')||iphone;let sensoryExpected;
const auto=process.argv.includes('--auto');
const routes=process.argv.includes('--routes');
const authored=process.argv.includes('--authored');
const districts=process.argv.includes('--districts')||authored;
const sidewalk=process.argv.includes('--sidewalk');
const facadeDepth=process.argv.includes('--facades');
const pavement=process.argv.includes('--pavement');
const paint=process.argv.includes('--paint');
const streetlights=process.argv.includes('--streetlights');
const model=process.argv.includes('--model');
const greenery=process.argv.includes('--greenery');
const buildings=process.argv.includes('--buildings');
const intersections=process.argv.includes('--intersections');
const routeInput=routes||districts||sidewalk||facadeDepth||greenery||buildings||intersections||streetlights||process.argv.includes('--route-input');
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
 socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error'){const message=m.params.args.map(a=>a.value??a.description??'').join(' ');if(/WebGLProgram|shader error|VALIDATE_STATUS/i.test(message))errors.push(message);}if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
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
 if(iphone)await send('Page.addScriptToEvaluateOnNewDocument',{source:'Object.defineProperty(navigator,"userAgent",{get:()=>"Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1"});Object.defineProperty(navigator,"platform",{get:()=>"iPhone"});Object.defineProperty(navigator,"maxTouchPoints",{get:()=>5});Object.defineProperty(navigator,"deviceMemory",{get:()=>undefined});'});
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
 if(iphone){
  const budget=await evaluate('({simple:queenStreet.graphics.compatibility,appleMobile:queenStreet.renderer.userData.device.appleMobile,tablet:queenStreet.renderer.userData.device.appleTablet,pixels:queenStreet.renderer.domElement.width*queenStreet.renderer.domElement.height,shadow:queenStreet.lighting.sun.shadow.mapSize.x,initial:queenStreet.performance.initial,level:queenStreet.performance.level,mode:queenStreet.settings.quality})');
  if(!budget.simple||!budget.appleMobile||budget.tablet||budget.initial!=='balanced'||budget.level!=='balanced'||budget.mode!=='auto'||budget.shadow!==1536||budget.pixels<=400000||budget.pixels>1100000)throw Error('iPhone default budget: '+JSON.stringify(budget));
  console.log('PASS: Fresh iPhone launch starts at Balanced within Auto: '+JSON.stringify(budget));
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
 if(model){
  const source=(await readFile(join(qa,'asset-checks.js'),'utf8')).replace("'../dist/vendor/three.module.js'","'three'");
  const moduleURL='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
  const report=await evaluate(`(async()=>{const a=queenStreet,checks=[];a.updateSettings({volume:0,weatherMode:'fixed',weather:'overcast',night:false,dayNightCycle:false});a.restart();a.setPaused(true);if(a.rig.root.userData.interior_revision!=='clearance-and-fittings-v5')throw Error('Stale streetcar model');const {checkStreetcarAsset}=await import(${JSON.stringify(moduleURL)});await checkStreetcarAsset(a,(label,pass)=>{if(!pass)throw Error(label);checks.push(label);});return {revision:a.rig.root.userData.interior_revision,checks:checks.length,compatibility:a.graphics.compatibility};})()`);
  await evaluate(`(()=>{const a=queenStreet;a.view.transition=null;a.view.update=()=>{};a.camera.clearViewOffset();a.camera.fov=70;a.camera.updateProjectionMatrix();a.camera.position.set(a.route.trackX,2.35,a.state.z-4.35);a.camera.lookAt(a.route.trackX,2.1,a.state.z-7.1);a.graphics.render(a.scene,a.camera);})()`);
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'streetcar-rear-seats.png'),Buffer.from(shot.data,'base64'));
  console.log('PASS: Revised Blender streetcar geometry, level seats, clear wood liners and functional rig: '+JSON.stringify(report));
 }
 if(paint){
  await evaluate(`(()=>{const a=queenStreet;a.updateSettings({camera:'sidewalk',quality:'balanced',volume:0,dayNightCycle:true,night:false,weatherMode:'fixed',weather:'overcast'});a.restart();a.setPaused(true);a.view.transition=null;window.__paintView=a.view.update;a.view.update=()=>{};a.camera.clearViewOffset();a.camera.fov=48;a.camera.position.set(a.route.trackX-7,3.1,a.state.z+11);a.camera.lookAt(a.route.trackX,1.7,a.state.z-1);a.camera.updateProjectionMatrix();a.camera.updateMatrixWorld(true);
   const gl=a.renderer.getContext(),pixels=()=>{const p=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,p);return p;};
   const paints=['TTC_Vermilion','Warm_Ivory'].map(n=>a.rig.materials.get(n)),saved=paints.map(m=>({roughness:m.roughness,clearcoat:m.clearcoat,clearcoatRoughness:m.clearcoatRoughness,reflection:m.userData.streetcarPaint.reflection.value}));
   window.__paintFinish=after=>paints.forEach((m,i)=>{Object.assign(m,after?saved[i]:{roughness:.92,clearcoat:.9,clearcoatRoughness:.18});m.userData.streetcarPaint.reflection.value=after?saved[i].reflection:1;});
   window.__paintRead=()=>{a.graphics.render(a.scene,a.camera);return pixels();};
   window.__paintBefore=()=>{window.__paintFinish(false);window.__paintReference=window.__paintRead();};
   window.__paintMask=()=>{const hidden=[],replaced=[],bg=a.scene.background,fog=a.scene.fog,shadow=a.renderer.shadowMap.enabled,white=paints[0].clone();white.onBeforeCompile=()=>{};white.customProgramCacheKey=()=>'';white.color.setHex(0xffffff);white.metalness=0;white.roughness=1;white.clearcoat=0;white.map=white.roughnessMap=white.normalMap=null;white.emissive.setHex(0xffffff);white.emissiveIntensity=1;white.toneMapped=false;
    a.scene.traverse(o=>{if(!o.isMesh&&!o.isLine&&!o.isPoints)return;if(paints.includes(o.material)){replaced.push([o,o.material]);o.material=white;}else{hidden.push([o,o.visible]);o.visible=false;}});a.scene.background=new a.scene.fog.color.constructor(0);a.scene.fog=null;a.renderer.shadowMap.enabled=false;a.renderer.setRenderTarget(null);a.renderer.render(a.scene,a.camera);const mask=pixels();
    for(const [o,m] of replaced)o.material=m;for(const [o,v] of hidden)o.visible=v;a.scene.background=bg;a.scene.fog=fog;a.renderer.shadowMap.enabled=shadow;white.dispose();window.__paintPixels=[];for(let i=0;i<mask.length;i+=4)if(mask[i]>245&&mask[i+1]>245&&mask[i+2]>245)window.__paintPixels.push(i);
   };
   window.__paintAfter=()=>{window.__paintFinish(true);const after=window.__paintRead(),before=window.__paintReference;let difference=0,lift=0,changed=0;for(const i of window.__paintPixels){let d=0;for(let c=0;c<3;c++){d+=Math.abs(after[i+c]-before[i+c]);lift+=after[i+c]-before[i+c];}difference+=d;if(d>9)changed++;}const samples=window.__paintPixels.length;return {samples,meanDifference:difference/(samples*3),meanLift:lift/(samples*3),changedFraction:changed/samples,compatibility:!!a.graphics.compatibility};};
  })()`);
  const reports=[];
  for(const [name,weather,night] of [['day','overcast',false],['rain','rain',false],['night','rain',true]]){
   await evaluate(`(()=>{const a=queenStreet;a.updateSettings({weather:${JSON.stringify(weather)},night:${night}});for(let i=0;i<81;i++)a.weather.update(.1,a.state.z,a.nightAmount,a.renderer.getPixelRatio(),false);window.__paintMask();window.__paintBefore();})()`);
   let frame=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'paint-'+name+'-before.png'),Buffer.from(frame.data,'base64'));
   const result=await evaluate('window.__paintAfter()');reports.push({name,...result});
   frame=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'paint-'+name+'-after.png'),Buffer.from(frame.data,'base64'));
   if(result.samples<1000||result.meanDifference<(night?2:5)||result.changedFraction<(night?.25:.45))throw Error('Paint reflection change is not clearly visible: '+JSON.stringify(reports));
  }
  await writeFile(join(output,'paint.json'),JSON.stringify(reports,null,2));console.log('PASS: Clearly visible paint reflections in day, rain and night: '+JSON.stringify(reports));
  await evaluate('queenStreet.view.update=window.__paintView');
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
  if(facadeDepth){
   await evaluate(`(async()=>{const THREE=await import(new URL('./vendor/three.module.js',document.querySelector('script[src$="main.js"]').src).href);window.__probeWindows=()=>{
    const a=queenStreet,windows=a.route.id==='queen'?a.city.facadeWindows:a.city.districts.facadeWindows;
    const samples=[];for(const rotation of [0,Math.PI,Math.PI/2,-Math.PI/2])samples.push(...windows.filter(w=>w.y>4&&Math.abs(w.x)<45&&Math.abs(w.rotation-rotation)<.01).sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124)).slice(0,12));
    const walls=new Set(Object.entries(a.city.materials).filter(([name])=>/brick|plaster|painted|stone|trim|dundasStone|dundasPlaster/i.test(name)).map(([,m])=>m));walls.add(a.city.materials.glass);
    const meshes=[];a.scene.updateMatrixWorld(true);a.scene.traverseVisible(o=>{if(o.isMesh&&walls.has(o.material))meshes.push(o);});
    const ray=new THREE.Raycaster(),failures=[];
    for(const w of samples){const origin=new THREE.Vector3(-.08,.12*w.height,.22*w.width).applyAxisAngle(new THREE.Vector3(0,1,0),w.rotation).add(new THREE.Vector3(w.x,w.y,w.z)),direction=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),w.rotation);ray.set(origin,direction);ray.far=.4;const hit=ray.intersectObjects(meshes,false)[0];if(hit?.object.material!==a.city.materials.glass||Math.abs(hit.distance-.315)>.012)failures.push({w,hit:hit?{material:hit.object.material.name,distance:hit.distance}:null});}
    if((windows.length>0&&samples.length===0)||failures.length)throw Error('Window aperture/glazing depth: '+JSON.stringify({count:windows.length,samples:samples.length,failures:failures.slice(0,5)}));
    return {route:a.route.id,windows:windows.length,samples:samples.length,depth:.235};
   };})()`);
   for(const id of ['queen','dundas']){
    await checkRoute(id);await evaluate('queenStreet.updateSettings({night:false,weatherMode:"off",volume:0});queenStreet.restart();queenStreet.setPaused(true)');
    console.log('PASS: Physical window openings in the rendered facade: '+JSON.stringify(await evaluate('window.__probeWindows()')));
    await evaluate(`(()=>{const a=queenStreet,list=a.route.id==='queen'?a.city.facadeWindows:a.city.districts.facadeWindows,w=list.filter(w=>w.x<0&&Math.abs(w.rotation-Math.PI)<.01&&w.y>4&&w.y<8).sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124))[0];window.__facadeView=a.view.update;a.view.update=()=>{};a.view.transition=null;a.camera.clearViewOffset();a.camera.fov=58;a.camera.position.set(w.x+5,w.y+.7,w.z-6);a.camera.lookAt(w.x,w.y,w.z+.6);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);})()`);
    for(const night of [false,true]){await evaluate('queenStreet.updateSettings({night:'+night+'});queenStreet.graphics.render(queenStreet.scene,queenStreet.camera)');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'facade-depth-'+id+(night?'-night':'-day')+'.png'),Buffer.from(shot.data,'base64'));}
    await evaluate('queenStreet.view.update=window.__facadeView');
   }
   await checkRoute('dundas');
  }
  if(streetlights){
   for(const id of ['queen','dundas']){
    await checkRoute(id);
    const report=await evaluate(`(()=>{
     const a=queenStreet,s=a.lighting.streetLights;a.updateSettings({volume:0,weatherMode:'fixed',weather:'rain',night:true,quality:'balanced'});a.restart();a.setPaused(true);a.view.transition=null;window.__lampView=a.view.update;a.view.update=()=>{};for(let i=0;i<81;i++)a.weather.update(.1,a.state.z,1,a.renderer.getPixelRatio(),false);
     if(s.stats.fixtures>16||s.stats.trianglesPerHead>500||s.stats.heads<50||new Set(s.meshes.map(m=>m.geometry)).size!==4)throw Error('Street lights exceed their shared geometry or light budget');
     for(const h of s.heads){const pole=a.city.sidewalkObstacles().find(p=>p.maxY>7&&Math.abs((p.minX+p.maxX)/2-h.x)<.1&&Math.abs((p.minZ+p.maxZ)/2-h.z)<.1);if(!pole)throw Error('Streetlight arm has no supporting pole');}
     const f=s.fixtures.filter(f=>f.side===-1).sort((p,q)=>Math.abs(p.z-a.state.z)-Math.abs(q.z-a.state.z))[0];a.camera.clearViewOffset();a.camera.fov=52;a.camera.position.set(-8,3.2,f.z+8);a.camera.lookAt(-4.9,.2,f.z);a.camera.updateProjectionMatrix();a.camera.updateMatrixWorld(true);
     const point=a.camera.position.clone().set(-4.9,.02,f.z).project(a.camera),gl=a.renderer.getContext();
     const read=()=>{a.graphics.render(a.scene,a.camera);const pixels=new Uint8Array(9*9*4);gl.readPixels(Math.round((point.x*.5+.5)*gl.drawingBufferWidth)-4,Math.round((point.y*.5+.5)*gl.drawingBufferHeight)-4,9,9,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const rgb=[0,0,0];for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)rgb[c]+=pixels[i+c]/81;return rgb;};
     const lit=read();s.setNight(0);s.update(a.state.z);const dark=read();s.setNight(1);s.update(a.state.z);const delta=lit.map((n,i)=>n-dark[i]);
     if(delta[0]<1||delta[1]<.5||delta[1]<delta[2]*1.5)throw Error('Night streetlight spill is not measurably yellow: '+JSON.stringify(delta));
     a.camera.position.set(f.x+4.4,4.3,f.z+4.5);a.camera.lookAt(f.lampX,6.7,f.lampZ);a.camera.fov=46;a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);
     window.__lampFixture=f;return {route:a.route.id,stats:s.stats,pavementLightDelta:delta,geometryBuffers:new Set(s.meshes.map(m=>m.geometry.uuid)).size};
    })()`);
    let shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'toronto-streetlight-'+id+'-night.png'),Buffer.from(shot.data,'base64'));
    await evaluate('(()=>{const a=queenStreet;a.updateSettings({night:false});a.graphics.render(a.scene,a.camera);if(a.lighting.streetLights.fixtures.some(f=>f.light.intensity!==0)||a.lighting.streetLights.heads.some(h=>h.bulb.material.emissiveIntensity!==0))throw Error("Street lights remain lit in daytime");})()');
    shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'toronto-streetlight-'+id+'-day.png'),Buffer.from(shot.data,'base64'));
    await evaluate('(()=>{const a=queenStreet,s=a.city.signals[0];a.camera.position.set(s.group.position.x+1.3,6.5,s.group.position.z-3.2);a.camera.lookAt(s.group.position);a.camera.fov=38;a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);})()');
    shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'toronto-traffic-signal-'+id+'.png'),Buffer.from(shot.data,'base64'));
    await evaluate('(()=>{const a=queenStreet,f=window.__lampFixture;a.updateSettings({night:true});a.camera.position.set(-7.8,2.1,f.z+12);a.camera.lookAt(0,3.6,f.z-12);a.camera.fov=60;a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);})()');
    shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'toronto-streetlights-'+id+'-street.png'),Buffer.from(shot.data,'base64'));
    console.log('PASS: Mounted Toronto streetlights have yellow night spill and switch off in daylight: '+JSON.stringify(report));
    await evaluate('queenStreet.view.update=window.__lampView');
   }
  }
  if(sidewalk){
   for(const id of ['queen','dundas']){
    await checkRoute(id);
    const report=await evaluate(`(()=>{
     const a=queenStreet;a.updateSettings({mode:'one',camera:'sidewalk',quality:'balanced',weatherMode:'off',night:false,volume:0});a.restart();a.setPaused(true);
     a.view.hasPose=false;a.view.transition=null;a.view.sidewalkIndex=null;
     let minimumGap=Infinity,anchors=new Set(),samples=0,lastAnchor=null,panMin=Infinity,panMax=-Infinity,fullPans=0,maxCentreX=0;
     const parked=a.city.actors.actors.filter(c=>!c.moving&&c.x<0);
     for(let z=a.route.start;z<=a.route.end;z+=.5){
      a.view.update(z,1/30,false);a.camera.updateMatrixWorld(true);anchors.add(a.camera.position.z);
      if(lastAnchor!==a.camera.position.z){
       if(lastAnchor!==null){if(z-lastAnchor<17.5)throw Error('Sidewalk cuts away before completing the pass');if(panMax-panMin>110*Math.PI/180)fullPans++;}
       lastAnchor=a.camera.position.z;panMin=Infinity;panMax=-Infinity;
      }
      const pan=Math.atan2(a.view.target.z-a.camera.position.z,Math.abs(a.camera.position.x-a.route.trackX));panMin=Math.min(panMin,pan);panMax=Math.max(panMax,pan);
      const centre=a.camera.position.clone().set(a.route.trackX,1.72,z).project(a.camera);maxCentreX=Math.max(maxCentreX,Math.abs(centre.x));
      if(Math.abs(centre.x)>.9||Math.abs(centre.y)>.9)throw Error('Sidewalk loses the streetcar during its pan');
      for(const car of parked){
       const gap=Math.abs(a.camera.position.z-car.z)-car.length/2;minimumGap=Math.min(gap,minimumGap);
       if(gap<3.2-1e-6)throw Error('Sidewalk viewpoint intersects a parked car foreground');
       const bounds=a.city.actors.models.get(car.variant).levels[0].bounds.clone().applyMatrix4(new a.camera.matrixWorld.constructor().makeRotationY(car.yaw));
       bounds.translate(a.camera.position.clone().set(car.x,.006,car.z));
       for(const x of [-1,1])for(const y of [-1,1]){const p=a.camera.position.clone().set(x,y,-1).unproject(a.camera);if(bounds.containsPoint(p))throw Error('Near plane cuts through an actual Blender car');}
      }
      for(const o of a.city.sidewalkObstacles())if(o.maxY>.8&&o.minX<a.camera.position.x+.85&&o.maxX>a.camera.position.x-.85&&a.camera.position.z>o.minZ-.85&&a.camera.position.z<o.maxZ+.85)throw Error('Sidewalk observer clips a pole or street fitting');
      samples++;
     }
     if(fullPans<5)throw Error('Sidewalk does not complete broad approach-to-departure pans');
     a.state.z=-60;a.car.position.z=-60;a.city.actors.setFocus(-60);a.view.hasPose=false;a.view.lastZ=null;a.view.transition=null;a.view.sidewalkIndex=null;a.view.instant=true;a.view.update(-60,0,false);
     window.__sidewalkUpdate=a.view.update;a.view.update=()=>{};a.graphics.render(a.scene,a.camera);
     return {route:a.route.id,minimumGap,anchors:anchors.size,samples,fullPans,maxCentreX};
    })()`);
    console.log('PASS: Sidewalk observers and near planes avoid actual parked car bounds: '+JSON.stringify(report));
    const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'sidewalk-clear-'+id+'.png'),Buffer.from(shot.data,'base64'));
    if(phone){
     await evaluate(`(()=>{const a=queenStreet;a.view.update=window.__sidewalkUpdate;a.view.hasPose=false;a.view.lastZ=null;a.view.transition=null;a.view.sidewalkIndex=0;a.view.sidewalkAnchor=null;a.view.instant=true;window.__passObserver=a.view.chooseSidewalkAnchor(a.view.sidewalkStops[0]);window.__passZ=window.__passObserver.z-24;})()`);
     for(const [name,delta] of [['approach',-24],['alongside',0],['departure',17]]){
      await evaluate(`(()=>{const a=queenStreet,end=window.__passObserver.z+${delta};for(let z=window.__passZ;z<end;z+=20/3.6/30)a.view.update(z,1/30,false);a.state.z=end;a.car.position.z=end;a.city.actors.setFocus(end);a.view.update(end,1/30,false);window.__passZ=end;window.__sidewalkUpdate=a.view.update;a.view.update=()=>{};a.graphics.render(a.scene,a.camera);})()`);
      const frame=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'sidewalk-'+id+'-'+name+'.png'),Buffer.from(frame.data,'base64'));
      await evaluate('queenStreet.view.update=window.__sidewalkUpdate');
     }
     await evaluate('queenStreet.view.update=()=>{}');
    }
    if(id==='queen'){
     for(const kind of ['utilitycabinet','newsbox','bikestand','treegrate','stormdrain']){
      if(!await evaluate(`(()=>{const a=queenStreet,p=a.city.scenery.placements.filter(p=>p.kind===${JSON.stringify(kind)}&&p.x<0).sort((p,q)=>Math.abs(p.z+160)-Math.abs(q.z+160))[0];if(!p)return false;a.camera.clearViewOffset();a.camera.fov=46;a.camera.position.set(p.x+2.4,1.8,p.z+2.8);a.camera.lookAt(p.x,(p.kind==='treegrate'||p.kind==='stormdrain')?.2:.7,p.z);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);return true;})()`))throw Error('New Blender street fitting is absent: '+kind);
      const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'street-detail-'+kind+'.png'),Buffer.from(shot.data,'base64'));
     }
    }
    await evaluate('queenStreet.view.update=window.__sidewalkUpdate');
   }
   await checkRoute('dundas');
  }
  if(greenery){
   for(const id of ['queen','dundas']){
    await checkRoute(id);
    const report=await evaluate(`(async()=>{const a=queenStreet,THREE=await import(new URL('./vendor/three.module.js',document.querySelector('script[src$="main.js"]').src).href);a.updateSettings({mode:'one',night:false,weatherMode:'off',volume:0});a.restart();a.setPaused(true);
     const trees=a.route.id==='queen'?a.city.trees:a.city.districts.trees,props=a.route.id==='queen'?a.city.scenery.placements:a.city.districts.retail.placements,models=a.city.scenery.models;
     const variants=new Set(trees.map(t=>t.variant)),sideTrees=trees.filter(t=>t.clumps===3),kinds=['timberplanter','stoneplanter','wallplanter','trellis','walllantern','parkedbike'];
     if(variants.size<3||sideTrees.length<4||a.city.foliage.geometry.userData.foliage.leafletsPerCard<40||!a.city.materials.bark.bumpMap)throw Error('Trees lost fine foliage, branch variety or side-street coverage');
     if(props.some(p=>p.kind==='bicycle'&&!p.interior)||kinds.some(kind=>!props.some(p=>p.kind===kind)))throw Error('Missing new decorations or an unsupported sidewalk bicycle');
     const group=new THREE.Group(),testMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});for(const p of models.get('parkedbike').parts)group.add(new THREE.Mesh(p.geometry,testMaterial));group.updateMatrixWorld(true);
     const ray=new THREE.Raycaster();for(const [x,y] of [[0,.99],[.245,.82]]){ray.set(new THREE.Vector3(x,y,.6),new THREE.Vector3(0,0,-1));ray.far=1;if(!ray.intersectObject(group,true).length)throw Error('Paired bicycle has no physical locking ring/post');}testMaterial.dispose();
     const sidePlanters=props.filter(p=>p.sideStreet&&['timberplanter','stoneplanter'].includes(p.kind));if(sidePlanters.length<6)throw Error('Side streets lack planter coverage');
     for(const p of sidePlanters){const minZ=p.bounds?.min.z??p.minZ,maxZ=p.bounds?.max.z??p.maxZ,c=a.route.crossings.reduce((b,c)=>Math.abs(c.z-p.z)<Math.abs(b.z-p.z)?c:b),near=Math.min(Math.abs(minZ-c.z),Math.abs(maxZ-c.z));if(near<8.8)throw Error('Side planter blocks the curb-to-door walking line');}
     window.__greenView=a.view.update;a.view.update=()=>{};a.view.transition=null;window.__greenCapture=(kind)=>{const tree=kind==='tree',p=(tree?trees:props.filter(p=>p.kind===kind)).sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124))[0];if(!p)throw Error('Missing capture '+kind);const side=Math.sign(p.x),y=tree?2.8:kind==='wallplanter'?p.y+.2:kind==='walllantern'?p.y+.3:.7;a.camera.clearViewOffset();a.camera.fov=tree?58:48;a.camera.position.set(p.x-side*(tree?5:2.4),y+(tree?.4:1.0),p.z-(tree?5:2.8));a.camera.lookAt(p.x,y,p.z);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);};
     return {route:a.route.id,trees:trees.length,variants:variants.size,sideTrees:sideTrees.length,sidePlanters:sidePlanters.length,counts:Object.fromEntries(kinds.map(kind=>[kind,props.filter(p=>p.kind===kind).length]))};})()`);
    console.log('PASS: Both-route tree detail, planting coverage, physical bicycle racks and clear side-street footways: '+JSON.stringify(report));
    for(const kind of ['tree','timberplanter','stoneplanter','wallplanter','trellis','walllantern','parkedbike']){await evaluate('window.__greenCapture('+JSON.stringify(kind)+')');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'greenery-'+id+'-'+kind+'.png'),Buffer.from(shot.data,'base64'));}
    await evaluate('queenStreet.view.update=window.__greenView');
   }
   await checkRoute('dundas');
  }
  if(buildings){
   for(const id of ['queen','dundas']){
    await checkRoute(id);
    const report=await evaluate(`(()=>{const a=queenStreet;a.updateSettings({quality:'balanced',volume:0,night:false,dayNightCycle:true,weatherMode:'off'});a.restart();a.setPaused(true);const d=a.route.id==='queen'?a.city.architecture:a.city.districts.facades,kinds=['flathead','spandrel','frieze','wallvent','downpipe','pilaster','stringcourse'],counts=d.counts||d.stats.counts;
     if(a.city.architecture.models.size!==22||!kinds.every(k=>counts[k]>0))throw Error('Missing modeled facade reliefs on '+a.route.id+': '+JSON.stringify(counts));
     const coverage={};for(const s of d.surfaces)if(s.details)coverage[s.kind]=(coverage[s.kind]||0)+1;
     if(!coverage.shop||!coverage.corner||!coverage['side-street'])throw Error('Facade details do not cover every street orientation: '+JSON.stringify(coverage));
     const towers=a.route.id==='queen'?a.city.urbanBuildings:a.city.districts.urbanBuildings;
     if(!towers?.length||towers.some(t=>t.front<28||t.height<25||a.route.crossings.some(c=>Math.abs(t.z-c.z)<t.width/2+23)))throw Error('Built-up blocks are missing or enter a side-street corridor');
     if(a.route.id==='dundas'&&(!counts.brickheader||!counts.quoin||d.stats.corniceBuildings<12))throw Error('Dundas lacks broad modeled masonry and roofline treatment: '+JSON.stringify(d.stats));
     const old=a.view.update;a.view.update=()=>{};a.view.transition=null;a.camera.clearViewOffset();window.__buildingRestore=()=>{a.view.update=old;};window.__buildingCapture=kind=>{
      if(kind==='skyline'){const t=[...towers].sort((p,q)=>Math.abs(p.z+50)-Math.abs(q.z+50))[0];a.camera.fov=68;a.camera.position.set(-t.side*5,8,t.z-48);a.camera.lookAt(t.side*(t.front+t.depth/2),t.height*.36,t.z);}
      else{const f=d.surfaces.filter(s=>s.kind===kind&&s.details>0&&(s.bottom??3.4)<4).sort((p,q)=>Math.abs(p.origin[2]+124)-Math.abs(q.origin[2]+124))[0];if(!f)throw Error('No visible '+kind+' detail');const n=[Math.sin(f.rotation),Math.cos(f.rotation)],t=[Math.cos(f.rotation),-Math.sin(f.rotation)];a.camera.fov=62;a.camera.position.set(f.origin[0]+n[0]*7-t[0]*5,6.4,f.origin[2]+n[1]*7-t[1]*5);a.camera.lookAt(f.origin[0],Math.min(6,f.height-.8),f.origin[2]);}
      a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);
     };
     return {route:a.route.id,coverage,counts:Object.fromEntries(kinds.map(k=>[k,counts[k]])),urbanTowers:towers.length,sourceTriangles:a.city.architecture.sourceTriangles,geometryBytes:a.city.architecture.geometryBytes};})()`);
    console.log('PASS: Modeled masonry reliefs cover both routes, corners and side streets: '+JSON.stringify(report));
    for(const kind of ['shop','corner','side-street','skyline']){await evaluate('window.__buildingCapture('+JSON.stringify(kind)+')');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'building-'+id+'-'+kind+'.png'),Buffer.from(shot.data,'base64'));}
    await evaluate('window.__buildingRestore()');
   }
  }
  if(intersections){
   for(const id of ['queen','dundas']){
    await checkRoute(id);
    const report=await evaluate(`(async()=>{const a=queenStreet,THREE=await import(new URL('./vendor/three.module.js',document.querySelector('script[src$="main.js"]').src).href);a.updateSettings({volume:0,night:false,dayNightCycle:true,weatherMode:'off'});a.restart();a.setPaused(true);a.scene.updateMatrixWorld(true);
     const plots=a.route.id==='queen'?a.city.architecture.infill:a.city.districts.infill,kit=[],offices=[];a.scene.traverseVisible(o=>{if(!o.isMesh)return;if(/cornerblock/.test(o.name)&&!o.material.transparent&&o.material!==a.city.materials.glass)kit.push(o);if(o.material===a.city.materials.officeFacade)offices.push(o);});
     const ray=new THREE.Raycaster();for(const p of plots){if(a.route.crossings.some(c=>p.minZ<c.z+11.09&&p.maxZ>c.z-11.09))throw Error('Infill obstructs a crossing');ray.set(new THREE.Vector3(p.side*5,1.6,p.z),new THREE.Vector3(p.side,0,0));ray.far=35;if(!ray.intersectObjects(kit,false).length)throw Error('Corner shop has a see-through shell at '+p.z);}
     let closed=0;for(const c of a.route.crossings)for(const side of [-1,1]){if(a.route.id==='dundas'&&!a.city.districts.sideStreets.some(s=>s.z===c.z&&s.side===side))continue;ray.set(new THREE.Vector3(side*35,4,c.z),new THREE.Vector3(side,0,0));ray.far=160;if(!ray.intersectObjects(offices,false).length)throw Error('Side-street view ends in empty space at '+c.name);closed++;}
     const old=a.view.update;a.view.update=()=>{};a.view.transition=null;a.camera.clearViewOffset();window.__intersectionRestore=()=>{a.view.update=old;};window.__intersectionCapture=mode=>{const c=[...a.route.crossings].sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124))[0],p=[...plots].sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124))[0];a.camera.fov=66;if(mode==='side'){a.camera.position.set(18,4.8,c.z);a.camera.lookAt(140,5,c.z);}else{a.camera.position.set(p.side*5.5,4.2,p.z-8);a.camera.lookAt(p.side*14,3.2,p.z);}a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);};return {route:a.route.id,closedSideViews:closed,solidInfillShops:plots.length};})()`);
    console.log('PASS: Real geometry closes intersection lots and side-street sightlines: '+JSON.stringify(report));
    for(const mode of ['side','shop']){await evaluate('window.__intersectionCapture('+JSON.stringify(mode)+')');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'intersection-'+id+'-'+mode+'.png'),Buffer.from(shot.data,'base64'));}await evaluate('window.__intersectionRestore()');
   }
  }
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
     if(a.route.stopOffset!==lastOffset){if(a.route.id==='dundas'&&a.city.districts.stats.overflow)throw Error('A Dundas section exhausted its scenery pool: '+JSON.stringify({offset:a.route.stopOffset,stats:a.city.districts.stats}));sections++;if(a.route.stopOffset===0&&seen.size===total){looped=true;break;}lastOffset=a.route.stopOffset;}
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
 if(districts){
  await evaluate(`(()=>{const a=queenStreet;a.updateSettings({mode:'one',quality:'balanced',volume:0,weatherMode:'off',dayNightCycle:true,night:false});a.restart();a.setPaused(true);for(let i=0;i<81;i++)a.weather.update(.1,a.state.z,0,a.renderer.getPixelRatio(),false);window.__districtSnapshot=a.captureSession();window.__districtView=a.view.update;a.view.update=()=>{};window.__districtStage=(offset,night=false)=>{
   const s=JSON.parse(JSON.stringify(window.__districtSnapshot));s.itinerary.offset=offset;s.ride.state.z=-150;if(!a.restoreSession(s))throw Error('Cannot stage scenery section '+offset);
   const heroZ=offset===18?4:offset===23?-8:offset===29?-14:offset===30?-24:-124;
   a.updateSettings({night});a.camera.clearViewOffset();a.camera.fov=58;a.camera.position.set(offset>=34?-5:5,7,heroZ-48);a.camera.lookAt(offset>=34?40:-16,5,heroZ);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);
   const d=a.city.districts,m=a.city.materials;let objects=0,hash=0,resources=0;a.scene.traverse(()=>objects++);d.group.traverse(o=>{if(o.instanceMatrix)for(let i=0;i<o.count*16;i++)hash=(Math.imul(hash,31)+Math.round(o.instanceMatrix.array[i]*100))|0;if(o.isMesh)for(const ch of o.uuid+o.geometry.uuid+o.material.uuid)resources=(Math.imul(resources,31)+ch.charCodeAt(0))|0;});
   if(new Set(d.displays.map(w=>w.index)).size!==d.displays.length)throw Error('Shop lighting sources reuse storefront IDs');
   const rooms=d.frontages.filter(f=>f.room).map(f=>({kind:f.kind,index:f.index,side:f.side,front:f.room.front,back:f.room.back,width:f.room.width,z:f.room.z}));
   const glazing=d.group.getObjectByName('Dundas_glazing'),mappedGlazing=!!glazing&&glazing.material===m.dundasStoreGlass&&glazing.material.map===m.storeGlass.map&&!!glazing.material.map&&glazing.material.transparent&&glazing.material.opacity<=.25&&!glazing.material.depthWrite;
   const roomMaterials=Array.from({length:7},(_,i)=>d.group.getObjectByName('Dundas_roomWall'+i)?.material===(i?m['shopWall'+i]:m.shopInteriorWall)&&d.group.getObjectByName('Dundas_roomCeiling'+i)?.material===(i?m['shopCeiling'+i]:m.shopInteriorCeiling)&&d.group.getObjectByName('Dundas_roomStrip'+i)?.material===m['shopStrip'+i]).every(Boolean);
   const masonryMaterials=new Set(d.group.children.filter(o=>o.isMesh&&[m.brick0,m.brick1,m.brick2,m.brick3,m.brick4].includes(o.material)&&o.material.map&&o.material.bumpMap&&o.material.roughnessMap).map(o=>o.material)).size;
   const facadePlacementKinds=d.facades.placements.reduce((counts,p)=>(counts[p.kind]=(counts[p.kind]||0)+1,counts),{});
   const reliefCoverage=d.facades.surfaces.reduce((counts,s)=>{if(s.details)counts[s.kind]=(counts[s.kind]||0)+1;return counts;},{});
   const signAtlas=d.group.getObjectByName('Dundas_sign').material.map.image;
   const signPanels=d.signPanels.map(p=>({...p,region:[...p.region]})),frontageStyles=d.frontages.map(f=>({kind:f.kind,index:f.index,district:f.district,shopStyle:f.shopStyle,windowStyle:f.windowStyle}));
   const featured=d.frontages.flatMap(f=>(f.windows||[]).filter(w=>w.feature).map(w=>({f,w})));
   for(const {f,w} of featured){
    const placement=d.facades.placements.find(p=>p.kind===w.feature&&p.side===f.side&&Math.abs(p.z-w.z)<.002&&Math.abs(p.y-w.y)<.002);
    if(!placement)throw Error('Missing authored replacement window');
    if(placement.bounds.min[1]<3.91||placement.bounds.max[1]>f.height+.05)throw Error('A projecting window crosses the shop fascia or roofline');
    if(d.facadeWindows.some(p=>Math.abs(p.x-f.side*f.front)<.002&&Math.abs(p.z-w.z)<.002&&Math.abs(p.y-w.y)<.002))throw Error('Old glazing overlaps a bay or balcony');
   }
   if(d.retail.stats.rooms!==d.retail.stats.fixtureRooms)throw Error('An interior recess has no stocked rear shelving');
   const ground=d.retail.placements.filter(p=>p.shopfront);
   for(const p of ground){
    const b=d.frontages.find(f=>f.index===p.frontageIndex&&f.side===p.side),door=b.doorZ??b.z+b.width*(b.kind==='modern'?.24:b.kind==='loft'?.36:.34);
    if(Math.min(Math.abs(p.minX),Math.abs(p.maxX))<9.7||p.minZ<door+.6&&p.maxZ>door-.6||a.route.crossings.some(c=>p.minZ<c.z+16&&p.maxZ>c.z-16)||a.route.stops.some(s=>p.minZ<s.z+8&&p.maxZ>s.z-8))throw Error('New shopfront prop blocks a walking line, doorway or boarding zone');
   }
   for(let i=0;i<ground.length;i++)for(let j=i+1;j<ground.length;j++)if(ground[i].minX<ground[j].maxX-.025&&ground[i].maxX>ground[j].minX+.025&&ground[i].minZ<ground[j].maxZ-.025&&ground[i].maxZ>ground[j].minZ+.025)throw Error('Shopfront props overlap');
   if(d.urbanBuildings.some(t=>t.front<28||a.route.crossings.some(c=>Math.abs(t.z-c.z)<t.width/2+23)||t.district==='don'||t.district==='riverdale'))throw Error('A new tower enters a road or protected park sightline');
   if(d.authored.stats.overflow||d.contacts.stats.overflow||d.authored.stats.models!==5||d.authored.stats.contacts<1000)throw Error('Missing authored building designs or baked contact visibility');
   return {offset,hash,resources,objects,geometries:a.renderer.info.memory.geometries,textures:a.renderer.info.memory.textures,stats:JSON.parse(JSON.stringify(d.stats)),authored:JSON.parse(JSON.stringify(d.authored.stats)),authoredPlacements:d.authored.placements,contacts:JSON.parse(JSON.stringify(d.contacts.stats)),retail:JSON.parse(JSON.stringify(d.retail.stats)),facades:JSON.parse(JSON.stringify(d.facades.stats)),facadePlacementKinds,reliefCoverage,frontageStyles,signPanels,signAtlasSize:[signAtlas.width,signAtlas.height],rooms,mappedGlazing,roomMaterials,masonryMaterials,glazingCount:glazing.count+d.authored.stats.rooms,urbanBuildings:d.urbanBuildings,zones:d.zones,landmarks:d.landmarks,windowSources:a.city.scenery.windowLighting.windows.length};
  };window.__districtClose=(offset,night=false)=>{
   window.__districtStage(offset,night);
   const d=a.city.districts,candidates=d.frontages.filter(f=>f.room&&f.side===-1).sort((x,y)=>Math.abs(x.z+124)-Math.abs(y.z+124));
   const f=candidates[0];if(!f)throw Error('No detailed shop available for close facade capture at '+offset);
   a.camera.fov=62;a.camera.position.set(f.side*(f.front-6.2),2.3,f.z-7.5);a.camera.lookAt(f.side*f.front,3.2,f.z+.6);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);
   return {offset,night,kind:f.kind,district:f.district,index:f.index,z:f.z,width:f.width,front:f.front,camera:a.camera.position.toArray()};
  };})()`);
  // Diagnose every fixed-pool capacity in one run before the first staged
  // screenshot can stop at an early failure and conceal later sections.
  const poolDiagnostics=await evaluate(`(()=>{const result=[];for(let offset=0;offset<=36;offset++){const s=window.__districtStage(offset);result.push({offset,base:{overflow:s.stats.overflow,overflows:s.stats.overflows||{},triangles:s.stats.triangles},retail:{overflow:s.retail.overflow,overflows:s.retail.overflows||{},triangles:s.retail.triangles},facades:{overflow:s.facades.overflow,overflows:s.facades.overflows||{},triangles:s.facades.triangles,archedhood:s.facadePlacementKinds.archedhood||0}});}return result;})()`);
  await writeFile(join(output,'dundas-pool-diagnostics.json'),JSON.stringify(poolDiagnostics,null,2));
  const overflowingSections=poolDiagnostics.filter(s=>s.base.overflow||s.retail.overflow||s.facades.overflow);
  if(overflowingSections.length)throw Error('Dundas pool capacity failures across all 37 offsets: '+JSON.stringify(overflowingSections));
  const archedSections=poolDiagnostics.filter(s=>s.facades.archedhood);
  if(archedSections.length)throw Error('Generic arch overlays remain on Dundas facades: '+JSON.stringify(archedSections));
  const photo=async name=>{const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,name+'.png'),Buffer.from(shot.data,'base64'));};
  const changeComparisonRoute=async id=>{
   await evaluate('queenStreet.selectRoute('+JSON.stringify(id)+')');
   for(let i=0;i<150&&await evaluate('!!queenStreet.routeTransition');i++)await wait(100);
   if(!await evaluate('queenStreet.route.id==='+JSON.stringify(id)+'&&!queenStreet.routeTransition'))throw Error('Comparison route did not change');
  };
  await changeComparisonRoute('queen');
  await evaluate(`(()=>{const a=queenStreet,s=a.captureSession();s.ride.state.z=-150;a.restoreSession(s);a.updateSettings({quality:'balanced',weatherMode:'off',night:false});for(let i=0;i<81;i++)a.weather.update(.1,a.state.z,0,a.renderer.getPixelRatio(),false);a.camera.clearViewOffset();a.camera.fov=58;a.camera.position.set(5,7,-172);a.camera.lookAt(-16,5,-124);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);})()`);
  await photo('queen-comparison-day');
  await changeComparisonRoute('dundas');
  const assertBudget=sample=>{
   if(sample.stats.overflow||sample.stats.meshes>60||sample.stats.triangles>135000)throw Error('Dundas exceeds its fixed base scenery budget: '+JSON.stringify(sample.stats));
   for(const [name,limit] of [['retail',190000],['facades',145000]])if(!sample[name]||sample[name].overflow||sample[name].triangles>limit)throw Error('Dundas '+name+' exceeds its authored asset budget: '+JSON.stringify(sample[name]));
   if(sample.stats.triangles+sample.retail.triangles+sample.facades.triangles>380000)throw Error('Dundas combined scenery exceeds the shared asset budget: '+JSON.stringify({offset:sample.offset,base:sample.stats.triangles,retail:sample.retail.triangles,facades:sample.facades.triangles}));
   if(sample.facadePlacementKinds.archedhood||sample.facades.counts.archedhood)throw Error('Dundas restores generic arches over its district windows: '+JSON.stringify({offset:sample.offset,kinds:sample.facadePlacementKinds}));
   if(!sample.facades.counts.flathead||!sample.facades.counts.downpipe||!(sample.facades.counts.spandrel||sample.facades.counts.stringcourse))throw Error('Dundas lost its modeled window heads, wall panels or drainage detail at '+sample.offset);
   if(sample.facades.infillMissing)throw Error('Intersection building shells were omitted by the asset budget at '+sample.offset);
   if(!sample.signPanels.length)throw Error('Dundas sign layout metadata is empty at '+sample.offset);
   for(const p of sample.signPanels){
    const [u,v,uw,vh]=p.region,[atlasWidth,atlasHeight]=sample.signAtlasSize;
    const values=[p.width,p.height,p.pixelWidth,p.pixelHeight,uw,vh,atlasWidth,atlasHeight];
    const physicalAspect=p.width/p.height,sampledAspect=uw*atlasWidth/(vh*atlasHeight),nativeAspect=p.pixelWidth/p.pixelHeight;
    if(values.some(n=>!Number.isFinite(n)||n<=0)||!Number.isFinite(u)||!Number.isFinite(v)||u<0||v<0||u+uw>1.000001||v+vh>1.000001||Math.abs(sampledAspect/physicalAspect-1)>.03||Math.abs(nativeAspect/physicalAspect-1)>.03)throw Error('Dundas sign artwork stretches or samples outside its atlas: '+JSON.stringify({offset:sample.offset,p,physicalAspect,sampledAspect,nativeAspect}));
    if(p.kind!=='mural'&&(!(p.fontSize>0)||!Number.isFinite(p.fontWidth)||p.fontWidth<=0||p.fontWidth>p.pixelWidth+.5||!(p.fontPixelHeight>0)||p.fontPixelHeight>p.pixelHeight+.5))throw Error('Dundas sign lettering clips its native artwork: '+JSON.stringify({offset:sample.offset,p}));
   }
   if(!sample.mappedGlazing||!sample.roomMaterials||sample.masonryMaterials<3)throw Error('Dundas lost Queen glazing, interior lighting materials or mapped masonry: '+JSON.stringify({offset:sample.offset,mappedGlazing:sample.mappedGlazing,roomMaterials:sample.roomMaterials,masonryMaterials:sample.masonryMaterials}));
   if(sample.rooms.some(r=>Math.abs(r.back-r.front-2.3)>.00001||r.width<=0)||sample.glazingCount!==sample.rooms.length)throw Error('Shopfronts do not have matching glazed 2.3-metre room recesses: '+JSON.stringify({offset:sample.offset,rooms:sample.rooms,glazingCount:sample.glazingCount}));
  };
  const stages=[0,6,13,15,16,18,20,23,26,29,30,33,34,36];
  const samples=[],closeUps=[];
  for(const offset of stages){
   const sample=await evaluate(`window.__districtStage(${offset})`);samples.push(sample);
    assertBudget(sample);
    if(facadeDepth)sample.windowDepthProbe=await evaluate('window.__probeWindows()');
   if([0,6,13,15,16,26,33].includes(offset)&&(!sample.rooms.length||!sample.retail.rooms||!sample.retail.instances||!sample.facades.instances||!sample.facades.counts.cornice))throw Error('Commerce section lacks actual Blender shop contents or architectural detail: '+JSON.stringify({offset,retail:sample.retail,facades:sample.facades}));
   if(offset===36&&(!sample.retail.furniture||!sample.facades.counts.cornice))throw Error('Residential approach lacks furnished sidewalks and heritage house details');
   await photo('dundas-'+offset);
   if([0,6,16].includes(offset)){closeUps.push(await evaluate('window.__districtClose('+offset+')'));await photo('dundas-close-'+offset);}
  }
  if(authored){
   const reports=[];
   for(const name of ['victorian','cornercafe','factory','apartment','office']){
    const section=samples.find(s=>s.authoredPlacements.some(p=>p.name===name));if(!section)throw Error('No placed '+name+' building across the route');
    await evaluate(`(()=>{const a=queenStreet;window.__districtStage(${section.offset});const d=a.city.districts,p=d.authored.placements.filter(p=>p.name===${JSON.stringify(name)}).sort((a,b)=>Math.abs(a.z+124)-Math.abs(b.z+124))[0],distance=Math.max(10,p.width*.90,p.height*.80);a.camera.fov=62;a.camera.position.set(p.side*3,Math.max(4,p.height*.32),p.z-distance);a.camera.lookAt(p.side*(p.front+1),p.height*.43,p.z);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);})()`);
    await photo('authored-'+name);
    const probe=await evaluate(`(async()=>{const a=queenStreet,d=a.city.districts,THREE=await import(new URL('./vendor/three.module.js',document.querySelector('script[src$="main.js"]').src).href),model=d.authored.models.get(${JSON.stringify(name)}),meshes=model.parts.map(p=>{const m=new THREE.Mesh(p.geometry,p.material);m.updateMatrixWorld(true);return m;}),ray=new THREE.Raycaster();let rays=0;
     for(const w of model.layout.windows.filter(w=>w.point[1]>3.8)){const n=new THREE.Vector3(...w.normal),t=new THREE.Vector3(-n.z,0,n.x),origin=new THREE.Vector3(...w.point).addScaledVector(n,.08).addScaledVector(t,.22*w.width);origin.y+=.12*w.height;ray.set(origin,n.clone().negate());ray.far=.4;const hit=ray.intersectObjects(meshes,false)[0];if(!hit||hit.object.material.name!=='Architecture_WindowGlass'||Math.abs(hit.distance-.315)>.012)throw Error('Authored window opening is blocked: '+${JSON.stringify(name)}+' '+JSON.stringify(w)+' '+hit?.object.material.name);rays++;}
     return {name:${JSON.stringify(name)},triangles:model.triangles,windows:rays};})()`);reports.push(probe);
    const contact=await evaluate(`(()=>{const a=queenStreet,d=a.city.districts,copy=document.createElement('canvas');copy.width=a.renderer.domElement.width;copy.height=a.renderer.domElement.height;const c=copy.getContext('2d',{willReadFrequently:true}),read=()=>{a.graphics.render(a.scene,a.camera);c.drawImage(a.renderer.domElement,0,0);return c.getImageData(0,0,copy.width,copy.height).data;};d.contacts.shading.value=0;d.contacts.mesh.visible=false;const off=read(),calls=a.renderer.info.render.calls;d.contacts.shading.value=1;d.contacts.mesh.visible=true;const on=read();let drop=0,darker=0;for(let i=0;i<on.length;i+=4){const delta=(off[i]+off[i+1]+off[i+2]-on[i]-on[i+1]-on[i+2])/3;drop+=delta;if(delta>=1)darker++;}return {meanDrop:drop/(on.length/4),darkerFraction:darker/(on.length/4),extraDraws:a.renderer.info.render.calls-calls,compatibility:!!a.graphics.compatibility};})()`);
    if(contact.meanDrop<.03||contact.darkerFraction<.005||ipad&&(!contact.compatibility||contact.extraDraws>1))throw Error('Soft contacts are absent or add rendering passes: '+JSON.stringify({name,contact}));
    reports.at(-1).contact=contact;
   }
   console.log('PASS: Five complete buildings have open inset glazing and measurable contact shading without a tablet post-processing pass: '+JSON.stringify(reports));
   await writeFile(join(output,'authored-buildings.json'),JSON.stringify(reports,null,2));
  }
  const sideStreetReports=[];
  for(const offset of [0,6,16,23,26,29,34,36]){
   await evaluate('window.__districtStage('+offset+')');
   const report=await evaluate(`(()=>{const a=queenStreet,d=a.city.districts,arms=d.sideStreets;if(!arms?.length)throw Error('Missing detailed side streets');
    for(const arm of arms){if(arm.buildings.length!==6)throw Error('Incomplete side-street block');for(const b of arm.buildings){if(Math.abs(b.x)-b.width/2<24||Math.abs(b.front-arm.z)<10.2)throw Error('Side street enters main frontage or footway');}}
    const props=d.retail.placements.filter(p=>p.sideStreet);if(!props.length)throw Error('No Blender furnishings on side streets');
    for(const p of props){const arm=arms.reduce((b,c)=>Math.abs(c.z-p.z)<Math.abs(b.z-p.z)?c:b);if(Math.abs(p.z-arm.z)<6.9)throw Error('Side-street prop enters roadway');}
    const arm=arms.filter(arm=>arm.side===-1&&arm.end===1).sort((p,q)=>Math.abs(p.z+100)-Math.abs(q.z+100))[0]||arms[0];
    a.camera.fov=64;a.camera.position.set(arm.side*21,2.8,arm.z);a.camera.lookAt(arm.side*100,4,arm.z+arm.end*2);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);
    return {offset:${offset},arms:arms.length,buildings:arms.reduce((n,a)=>n+a.buildings.length,0),props:props.length,windows:d.facadeWindows.filter(w=>Math.abs(w.x)>25).length};})()`);
   sideStreetReports.push(report);await photo('dundas-side-street-'+offset);
   if(offset===6||offset===23){await evaluate('queenStreet.updateSettings({night:true});queenStreet.graphics.render(queenStreet.scene,queenStreet.camera)');await photo('dundas-side-street-'+offset+'-night');}
  }
  await writeFile(join(output,'dundas-side-streets.json'),JSON.stringify(sideStreetReports,null,2));
  console.log('PASS: District-specific side-street blocks, deep windows and Blender furnishings retain clear footways');
  if(new Set(samples.map(s=>s.hash)).size<10)throw Error('Neighbourhood geometry does not change along Dundas');
  const shopStyles=new Set(samples.flatMap(s=>s.frontageStyles.filter(f=>f.kind==='shop').map(f=>f.shopStyle)).filter(Number.isInteger));
  const windowStyles=new Set(samples.flatMap(s=>s.frontageStyles.map(f=>f.windowStyle)).filter(Number.isInteger));
  if(shopStyles.size<3||windowStyles.size<3)throw Error('Dundas facades lack distinct shopfront and window compositions: '+JSON.stringify({shopStyles:[...shopStyles],windowStyles:[...windowStyles]}));
  for(const offset of [0,6,13,16,26,33,36]){
   const sample=samples.find(s=>s.offset===offset);
   if(sample.retail.windowGardens<5||!(sample.facades.counts.baywindow>0))throw Error('Dundas lost its window gardens or authored bay windows at '+offset);
  }
  await evaluate('window.__districtStage(6)');
  for(const kind of ['baywindow','balcony','table','crate']){
   if(kind==='crate')await evaluate('window.__districtStage(30)');
   const visible=await evaluate(`(()=>{const a=queenStreet,d=a.city.districts,kind=${JSON.stringify(kind)},architectural=['baywindow','balcony'].includes(kind),p=(architectural?d.facades.placements:d.retail.placements).filter(p=>p.kind===kind).sort((p,q)=>Math.abs(p.z+124)-Math.abs(q.z+124))[0];if(!p)return false;const x=architectural?p.side*d.frontages.find(f=>f.index===p.index&&f.side===p.side).front:p.x,y=architectural?p.y:.7,side=architectural?p.side:Math.sign(p.x);a.camera.fov=56;a.camera.position.set(x-side*4,y+1.3,p.z-5);a.camera.lookAt(x,y,p.z);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);return true;})()`);
   if(!visible)throw Error('No new Dundas detail available for review: '+kind);
   await photo('dundas-detail-'+kind);
  }
  const landmarks=samples.flatMap(s=>s.landmarks);
  for(const [id,side] of [['ago',-1],['hospital',1],['square',-1],['spectrum',-1],['regent-park',1],['library',1],['station',-1]])if(!landmarks.some(f=>f.id===id&&f.side===side))throw Error('Missing or misplaced '+id);
  if(!landmarks.some(f=>f.id==='library'&&f.index>33.12)||!landmarks.some(f=>f.id==='spectrum'&&f.index<29.12))throw Error('Landmark occupies the wrong intersection corner');
  if(!await evaluate('queenStreet.city.districts.group.visible&&!queenStreet.city.queenScenery.visible'))throw Error('Queen scenery shows through Dundas');
  for(const offset of [20,23,29]){
   await evaluate('window.__districtStage('+offset+')');
   const office=await evaluate(`(()=>{const a=queenStreet,d=a.city.districts,f=d.frontages.filter(f=>f.kind==='modern'&&f.side===-1).sort((x,y)=>Math.abs(x.z+124)-Math.abs(y.z+124))[0];if(!f)throw Error('No office/podium frontage at this section');a.camera.fov=70;a.camera.position.set(f.side*4.5,6,f.z-40);a.camera.lookAt(f.side*(f.front+5),19,f.z);a.camera.updateProjectionMatrix();a.graphics.render(a.scene,a.camera);return {panels:d.group.getObjectByName('Dundas_office').count,roomWidth:f.room?.width};})()`);
   if(office.panels<4||office.roomWidth>6)throw Error('Office facade coverage or human-scale shop frontage is missing');
   await photo('office-'+offset);
   await evaluate('queenStreet.updateSettings({night:true});queenStreet.graphics.render(queenStreet.scene,queenStreet.camera)');
   if(!await evaluate('queenStreet.city.materials.officeFacade.emissiveIntensity>0'))throw Error('Office room lighting is missing');
   await photo('office-'+offset+'-night');
  }
  // Warm every possible resident offset, including the intermediate ones that
  // a two-stop section advance normally skips. Compare after all lazy uploads.
  for(let offset=0;offset<=36;offset++)assertBudget(await evaluate('window.__districtStage('+offset+')'));
  const baseline=await evaluate('window.__districtStage(0)');
  for(let offset=36;offset>=0;offset--){
   const s=await evaluate(`window.__districtStage(${offset})`);
   assertBudget(s);
   if(s.resources!==baseline.resources||s.objects!==baseline.objects||s.geometries!==baseline.geometries||s.textures!==baseline.textures)throw Error('Scenery resources grow or change identity between sections: '+JSON.stringify({baseline,s}));
  }
  await evaluate('window.__districtStage(6,true)');
  if(!await evaluate('queenStreet.city.districts.retail.stats.rooms>0&&new Set(queenStreet.city.districts.displays.map(w=>w.lighting.style)).size>=3&&queenStreet.city.materials.shopStrip0.emissiveIntensity>0'))throw Error('Dundas shops lost their varied interior night lighting');
  await photo('dundas-shops-night');
  closeUps.push(await evaluate('window.__districtClose(6,true)'));await photo('dundas-close-6-night');
  await evaluate('window.__districtStage(23,true)');
  if(!await evaluate('queenStreet.city.scenery.windowLighting.night.value===1&&queenStreet.city.scenery.windowLighting.windows.length>0'))throw Error('Dundas windows do not supply nighttime pavement light');
  const nightShot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'dundas-downtown-night.png'),Buffer.from(nightShot.data,'base64'));
  await evaluate('window.__districtStage(0);queenStreet.view.update=window.__districtView;queenStreet.restart()');
  if(routes)await evaluate('(()=>{const a=queenStreet;window.__districtStage(2);const s=a.captureSession(),manifest=document.querySelector("link[rel=manifest]");sessionStorage.setItem("queen-street-update-session:"+new URL("./",manifest.href).href,JSON.stringify(s));sessionStorage.setItem("route-checkpoint-expected",JSON.stringify({offset:a.route.stopOffset,z:a.state.z}));})()');
  console.log('PASS: Dundas signs retain native proportions; varied storefronts, recessed shops and all 37 offsets retain bounded resources and night lighting');
  await writeFile(join(output,'districts.json'),JSON.stringify(samples,null,2));
  await writeFile(join(output,'dundas-close-ups.json'),JSON.stringify(closeUps,null,2));
 }
 if(pavement){
  const report=await evaluate(`(async()=>{
   const a=queenStreet,THREE=await import(new URL('./vendor/three.module.js',document.querySelector('script[src$="main.js"]').src).href),m=a.city.materials.road;
   if(!m.userData.asphaltFinish?.independentRelief||m.map.image===m.bumpMap.image||m.bumpMap.image===m.roughnessMap.image||m.map.image.width!==512||m.metalness!==0)throw Error('Asphalt lost independent bounded PBR maps');
   a.setPaused(true);const update=a.view.update;a.view.update=()=>{};a.view.transition=null;
   a.camera.clearViewOffset();a.camera.fov=52;a.camera.position.set(0,21,-150);a.camera.lookAt(0,0,-149.99);a.camera.updateProjectionMatrix();
   const diagnostic=m.clone(),compile=m.onBeforeCompile,key=m.customProgramCacheKey();diagnostic.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace(/}\\s*$/,'gl_FragColor=vec4(vec3(roughnessFactor),1.);\\n}');};diagnostic.customProgramCacheKey=()=>key+'-roughness-readback';
   const surfaces=[];a.scene.traverse(o=>{if(o.material===m){surfaces.push(o);o.material=diagnostic;}});
   // Read the material directly: the desktop finishing pass applies an output
   // transfer function, so its displayed grey is not a linear roughness value.
   const sample=()=>{a.renderer.setRenderTarget(null);a.renderer.render(a.scene,a.camera);const gl=a.renderer.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,rgba=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);const values=[];
    for(let x=-7.3;x<=7.3;x+=.19)for(let z=-156;z<=-144;z+=.41){if([a.route.trackX,-a.route.trackX].some(t=>Math.abs(Math.abs(x-t)-a.route.gauge/2)<.18))continue;const p=new THREE.Vector3(x,.005,z).project(a.camera),px=Math.round((p.x*.5+.5)*(width-1)),py=Math.round((p.y*.5+.5)*(height-1));if(px<0||py<0||px>=width||py>=height)continue;values.push(rgba[(py*width+px)*4]/255);}return values;};
   const settle=(seconds=10)=>{for(let i=0;i<seconds*10;i++)a.weather.update(.1,a.state.z,a.nightAmount,a.renderer.getPixelRatio(),false);};
   a.updateSettings({weatherMode:'off',night:false});settle();const dry=sample();
   a.updateSettings({weatherMode:'fixed',weather:'rain'});settle(60);const wet=sample();
   a.updateSettings({night:true});a.weather.update(0,a.state.z,a.nightAmount,a.renderer.getPixelRatio(),false);const dark=sample();
   const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length,dryMean=mean(dry),wetMean=mean(wet),matte=wet.filter(n=>n>.55).length/wet.length,puddles=wet.filter(n=>n<.48).length/wet.length,nightDifference=mean(dark.map((n,i)=>Math.abs(n-wet[i])));
   const backgroundMean=mean(wet.filter(n=>n>.55)),puddleMean=mean(wet.filter(n=>n<.48)),contrast=backgroundMean-puddleMean;
   const {WEATHER}=await import(new URL('./weather-cycle.js',document.querySelector('script[src$="main.js"]').src).href),profiles=[];
   for(const [id,preset] of Object.entries(WEATHER)){
    a.updateSettings({weatherMode:'off',night:id==='rainnight'});settle();a.updateSettings({weatherMode:'fixed',weather:id});settle(60);
    const values=sample(),water=a.weather.uniforms.wetness.value,rain=a.weather.uniforms.rainAmount.value,roughness=mean(values),standing=values.filter(n=>n<.48).length/values.length,target=Math.max(preset.wet,preset.rain*.9);
    if(Math.abs(water-target)>.002||Math.abs(rain-preset.rain)>.0001||target===0&&Math.abs(roughness-dryMean)>.004||target<.36&&standing>.005||target>.9&&Math.abs(roughness-wetMean)>.004)throw Error('Pavement does not follow '+id+' wetness: '+JSON.stringify({water,rain,roughness,standing,target}));
    profiles.push({id,rain,wetness:water,roughness,puddles:standing});
   }
   for(const o of surfaces)o.material=m;diagnostic.dispose();a.updateSettings({weatherMode:'off',night:false});settle();a.view.update=update;a.restart();
   if(dry.length<1000||dryMean<.80||matte<.55||puddles<.01||puddles>.4||nightDifference>.01||contrast<.15||contrast>.44)throw Error('Road roughness readback failed: '+JSON.stringify({samples:dry.length,dryMean,wetMean,matte,puddles,nightDifference,backgroundMean,puddleMean,contrast}));
   return {samples:dry.length,dryMean,wetMean,matte,puddles,nightDifference,backgroundMean,puddleMean,contrast,profiles,maps:3,mapSize:512};
  })()`);
  await writeFile(join(output,'pavement.json'),JSON.stringify(report,null,2));console.log('PASS: Rendered asphalt stays matte between localized puddles; night does not change its physical roughness: '+JSON.stringify(report));
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
