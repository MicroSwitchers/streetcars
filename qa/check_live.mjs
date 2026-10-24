// Read-only smoke check of the deployed game in an isolated Chrome profile.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const qa=dirname(fileURLToPath(import.meta.url)),url=process.argv[2]||'https://microswitchers.github.io/streetcars/';
const ipad=process.argv.includes('--ipad'),loss=process.argv.includes('--loss'),startupLoss=process.argv.includes('--startup-loss');
const sensory=process.argv.includes('--sensory'),phone=process.argv.includes('--phone');let sensoryExpected;
const auto=process.argv.includes('--auto');
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
 if(auto){
  if(!await evaluate('queenStreet.settings.mode==="one"&&queenStreet.settings.volume===.2&&!document.getElementById("pause")'))throw Error('Legacy settings did not migrate to Single press without losing preferences');
  await evaluate('queenStreet.updateSettings({mode:"watch",doorDwell:0,alwaysGreen:true,stopAtLights:false});queenStreet.restart();queenStreet.ride.trafficAhead=()=>null');await wait(200);
  if(!await evaluate('queenStreet.state.speed>0&&!queenStreet.state.paused&&document.querySelector(".ride-dock").hidden&&document.getElementById("assisted-controls").hidden'))throw Error('Full auto did not start without a play/pause control');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'p',code:'KeyP'});
  if(!await evaluate('!queenStreet.state.paused&&queenStreet.primary()===false'))throw Error('A legacy pause action can stop Full auto');
  await evaluate('queenStreet.openSettings()');if(!await evaluate('document.getElementById("settings-dialog").open&&!queenStreet.state.paused'))throw Error('Settings interrupted Full auto');await evaluate('document.getElementById("settings-close").click()');
  if(!await evaluate('(()=>{Object.defineProperty(document,"hidden",{configurable:true,get:()=>window.__autoHidden});window.__autoHidden=true;document.dispatchEvent(new Event("visibilitychange"));const suspended=queenStreet.state.paused;window.__autoHidden=false;document.dispatchEvent(new Event("visibilitychange"));const resumed=!queenStreet.state.paused;delete document.hidden;return suspended&&resumed;})()'))throw Error('Full auto remains suspended after returning to the tab');
  const laps=await evaluate('(()=>{let laps=0,previous=queenStreet.state.z;for(let i=0;i<6000&&laps<2;i++){queenStreet.ride.step(.1);if(queenStreet.state.z<previous)laps++;previous=queenStreet.state.z;}return laps;})()');
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
  if(!budget.simple||budget.pixels>400000||budget.shadow>512||budget.level!=='low'||budget.savedPixels<6000000)throw Error('iPad budget: '+JSON.stringify(budget));
  await evaluate('queenStreet.updateSettings({quality:"high",weather:"rain",weatherMode:"fixed",night:true});queenStreet.setPaused(false);queenStreet.primary()');
  await wait(1500);
  if(await evaluate('queenStreet.performance.level')!=='low')throw Error('Saved High bypassed the iPad safety ceiling');
  console.log('PASS: iPad desktop-mode detection, bounded textures/pixels/shadows, night rain and High safety ceiling');
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
 if(sensory)sensoryExpected=await evaluate('JSON.stringify(queenStreet.settings)');
 await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await send('Page.reload',{ignoreCache:true});
 ready=false;for(let i=0;i<900;i++){ready=await evaluate('!!window.queenStreet?.ready');if(ready)break;await wait(100);}
 if(!ready||errors.length)throw Error('Installed live game did not reload offline: '+JSON.stringify(errors));
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
