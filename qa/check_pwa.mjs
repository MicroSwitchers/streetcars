// Real service-worker lifecycle, offline reload, media ranges and safe updates.
// The private test server stages a new release without modifying the built PWA.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join,relative,extname} from 'node:path';
const root=resolve('pwa'),qa=resolve('qa'),output=join(qa,'pwa-'+Date.now());await mkdir(output);
const version=JSON.parse(await readFile(join(root,'version.json'),'utf8')),original=version.release;
const html=await readFile(join(root,'index.html'),'utf8'),worker=await readFile(join(root,'sw.js'),'utf8');
let stage=original,missing=0;
const server=createServer(async(req,res)=>{
 try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(relative(root,path).startsWith('..')){res.writeHead(403).end();return;}
   let bytes=await readFile(path);
   if(pathname==='/manifest.webmanifest'&&stage.endsWith('-corrupt'))bytes=Buffer.concat([bytes,Buffer.from('\n ')]);
   const stagedHtml=html.replace(`content="${original}"`,`content="${stage}"`);
   if(pathname==='/'||pathname==='/index.html')bytes=Buffer.from(stage.endsWith('-shell')?stagedHtml.slice(0,stagedHtml.indexOf('<body')):stagedHtml);
   if(pathname==='/sw.js'){
     let source=worker.replace('const RELEASE='+JSON.stringify(original)+';','const RELEASE='+JSON.stringify(stage)+';');
     source=source.replace(/const SHELL_SHA="[a-f0-9]+";/,'const SHELL_SHA='+JSON.stringify(createHash('sha256').update(stagedHtml).digest('hex'))+';');
     if(stage.endsWith('-bad'))source=source.replace(/const ASSETS=(\[.*?\]);/,(_,json)=>'const ASSETS='+JSON.stringify([...JSON.parse(json),{url:'missing-release-asset.glb',sha256:'0'.repeat(64)}])+';');
     bytes=Buffer.from(source);
   }
   const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webmanifest':'application/manifest+json','.glb':'model/gltf-binary','.wav':'audio/wav','.png':'image/png'};
   res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':pathname.includes('/releases/')?'public, max-age=31536000, immutable':'no-store'});res.end(bytes);
 }catch{if(req.url.includes('missing-release-asset'))missing++;res.writeHead(404).end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
const profile=await mkdtemp(join(qa,'headless-pwa-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let socket;
const checks=[];function check(label,value){checks.push({label,pass:!!value});assert.ok(value,label);console.log('PASS: '+label);}
try{
 let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}assert.ok(port);
 const page=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 socket.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 const wait=async(expression,label,seconds=90)=>{for(let i=0;i<seconds*5;i++){try{if(await run(expression))return;}catch{}await delay(200);}throw Error('Timed out: '+label);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1024,height:1366,deviceScaleFactor:2,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Page.navigate',{url});await wait('window.queenStreet?.ready && window.queenStreetPWA?.registration.active && navigator.serviceWorker.controller && document.querySelector("#app-status").textContent.includes("Ready for offline")','first playable and fully cached PWA');
 const first=await run('({quality:queenStreet.performance.level,pixels:queenStreet.graphics.target.width*queenStreet.graphics.target.height,release:queenStreetPWA.release,manifest:document.querySelector("link[rel=manifest]").href})');
 check('Touch tablet starts with a bounded Auto graphics budget',first.quality==='balanced'&&first.pixels<=1002500);
 const manifest=await send('Page.getAppManifest');check('Browser accepts the install manifest',!!manifest.url&&!manifest.errors?.some(e=>e.critical));
 const cache=await run('(async()=>{const names=await caches.keys(),c=await caches.open(names.find(n=>n.endsWith("'+original+'")));return {names,entries:(await c.keys()).length};})()');
 check('Complete versioned shell, models, modules, icons and audio are cached',cache.entries===version.assets+2);
 const protectedCaches=await run('(async()=>{const names=await caches.keys(),current=names.find(n=>n.endsWith("'+original+'")),meta=new URL("./?cache-metadata",location.href).href,c=await caches.open(current),generation=(await (await c.match(meta)).json()).generation,keys=[current+":installing",current+":waiting"];await (await caches.open(keys[0])).put(new URL("./candidate",location.href),new Response("incomplete"));await (await caches.open(keys[1])).put(meta,new Response(JSON.stringify({generation:generation+1})));navigator.serviceWorker.controller.postMessage({type:"CLIENT_VERSION",release:"'+original+'"});await new Promise(r=>setTimeout(r,500));const after=await caches.keys(),protectedBoth=keys.every(k=>after.includes(k));await Promise.all(keys.map(k=>caches.delete(k)));return protectedBoth;})()');
 check('Cleanup protects incomplete and newer waiting caches',protectedCaches);
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await send('Page.reload',{ignoreCache:true});
 await wait('window.queenStreet?.ready && window.queenStreetPWA?.registration.active','fully offline relaunch');
 check('Installed game relaunches with the network disabled',await run('queenStreetPWA.release==='+JSON.stringify(original)));
 const range=await run('(async()=>{const audio=document.querySelector("#streetcar-pass").src,r=await fetch(audio,{headers:{Range:"bytes=100-1123"}});return {status:r.status,length:(await r.arrayBuffer()).byteLength,range:r.headers.get("content-range")};})()');
 check('Offline media supports byte-range requests',range.status===206&&range.length===1024&&range.range.startsWith('bytes 100-1123/'));
 const suffix=await run('(async()=>{const r=await fetch(document.querySelector("#streetcar-pass").src,{headers:{Range:"bytes=-512"}});return [r.status,(await r.arrayBuffer()).byteLength];})()');check('Offline audio also supports suffix ranges',suffix[0]===206&&suffix[1]===512);
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await run('queenStreet.updateSettings({mode:"one",doorDwell:5,stopEvery:2,quality:"low",volume:0,dayNightCycle:false});Object.assign(queenStreet.state,{z:-195,speed:3,phase:"travelling",nextStop:0,doors:false});queenStreet.view.transition=null;queenStreet.setPaused(false);true');
 stage=original+'-update';await run('queenStreetPWA.checkUpdates().then(()=>true)');await wait('!!queenStreetPWA.registration.waiting','downloaded update waiting for a safe point');
 check('New release downloads without reloading a moving streetcar',await run('queenStreetPWA.release==='+JSON.stringify(original)+' && !queenStreet.state.paused && queenStreet.state.phase!=="finished"'));
 const saved=await run('document.querySelector("#lights").click();queenStreet.setPaused(true);({z:queenStreet.state.z,metres:queenStreet.state.metres,clock:queenStreet.weather.cycleTime})');
 await wait('window.queenStreet?.ready && window.queenStreetPWA?.release==='+JSON.stringify(stage),'automatic safe update and restored game');
 const restored=await run('({z:queenStreet.state.z,paused:queenStreet.state.paused,dwell:queenStreet.settings.doorDwell,stops:queenStreet.settings.stopEvery,quality:queenStreet.settings.quality,clock:queenStreet.weather.cycleTime})');
 check('Pausing automatically applies the update and preserves the ride',restored.paused&&Math.abs(restored.z-saved.z)<1e-8&&Math.abs(restored.clock-saved.clock)<.11);
 check('Ride and graphics preferences survive an application update',restored.dwell===5&&restored.stops===2&&restored.quality==='low');
 check('Night-light controls also survive the update',await run('!queenStreet.state.lights && !queenStreet.rig.lights.headlights'));
 await delay(1500);check('Unused old caches are cleaned after all clients use the new version',(await run('caches.keys()')).filter(n=>n.startsWith('queen-street:')).length===1);
 const working=stage;stage=original+'-bad';await run('queenStreetPWA.checkUpdates().then(()=>true)');await wait('document.querySelector("#app-status").textContent.includes("Offline version retained")','incomplete release rejected',30);
 check('An incomplete server release cannot replace the working game',await run('queenStreetPWA.release==='+JSON.stringify(working)+' && !queenStreetPWA.registration.waiting')&&missing>0);
 stage=original+'-corrupt';await run('document.querySelector("#app-status").textContent="Checking test release";queenStreetPWA.checkUpdates().then(()=>true)');await wait('document.querySelector("#app-status").textContent.includes("Offline version retained")','hash mismatch rejected',30);
 check('A corrupt asset fails verification without replacing the app',await run('queenStreetPWA.release==='+JSON.stringify(working)+' && !queenStreetPWA.registration.waiting'));
 stage=original+'-shell';await run('document.querySelector("#app-status").textContent="Checking test release";queenStreetPWA.checkUpdates().then(()=>true)');await wait('document.querySelector("#app-status").textContent.includes("Offline version retained")','partial HTML shell rejected',30);
 check('A partially uploaded HTML shell cannot replace the playable version',await run('queenStreetPWA.release==='+JSON.stringify(working)+' && !queenStreetPWA.registration.waiting'));
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await send('Page.reload',{ignoreCache:true});await wait('window.queenStreet?.ready && window.queenStreetPWA?.release==='+JSON.stringify(working),'offline fallback after failed update');
 check('Failed update retains a fully playable offline release',await run('queenStreet.ready && queenStreet.settings.stopEvery===2'));
 check('No page runtime errors during offline loading and updates',errors.length===0);
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'tablet-offline.png'),Buffer.from(shot.data,'base64'));
 await writeFile(join(output,'report.json'),JSON.stringify({pass:true,checks,first,cache,range,restored,errors},null,2));console.log('PWA report: '+output);
}catch(error){await writeFile(join(output,'report.json'),JSON.stringify({pass:false,error:String(error),checks},null,2));throw error;}
finally{socket?.close();browser.kill();server.close();await delay(500);if(!relative(qa,resolve(profile)).startsWith('..'))await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
