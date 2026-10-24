// Read-only smoke check of the deployed game in an isolated Chrome profile.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const qa=dirname(fileURLToPath(import.meta.url)),url=process.argv[2]||'https://microswitchers.github.io/streetcars/';
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
 await send('Page.navigate',{url});
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
 await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await send('Page.reload',{ignoreCache:true});
 ready=false;for(let i=0;i<900;i++){ready=await evaluate('!!window.queenStreet?.ready');if(ready)break;await wait(100);}
 if(!ready||errors.length)throw Error('Installed live game did not reload offline: '+JSON.stringify(errors));
 const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'live.png'),Buffer.from(screenshot.data,'base64'));
 const report={pass:true,url,game,cache,offlineReload:true,errors};await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log(output);
}finally{
 socket?.close();browser.kill();await wait(500);
 if(!relative(qa,resolve(profile)).startsWith('..'))await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
