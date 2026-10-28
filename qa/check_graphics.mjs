// Dependency-free browser checks and screenshots using an isolated headless Chrome.
// Serve Queen-Street on localhost:8124, then run: node qa/check_graphics.mjs
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const qa=dirname(fileURLToPath(import.meta.url));
const output=join(qa,'renders-'+Date.now());await mkdir(output);
const profile=await mkdtemp(join(qa,'headless-'));
const browser=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--no-first-run','--no-default-browser-check',
 '--hide-scrollbars','--remote-debugging-port=0',`--user-data-dir=${profile}`,
],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let socket;
try{
 let port;
 for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await delay(100);}}
 if(!port)throw new Error('Headless Chrome did not start');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const page=targets.find(t=>t.type==='page');if(!page)throw new Error('No headless page');
 socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let id=0;const pending=new Map(),gpuLogs=[];
 socket.onmessage=event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(m.method==='Log.entryAdded')gpuLogs.push(m.params.entry);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result?.value;
 await send('Page.enable');await send('Log.enable');
 const cases={desktop:[1440,960,'verify'],phone:[390,844,''],landscape:[844,390,''],doors:[390,844,'mode=doors'],park:[1440,960,'scene=park'],settings:[390,844,'settings'],offline:[1440,960,'offline&verify'],follow:[1440,960,'camera=follow'],front:[1440,960,'camera=front'],sidewalk:[1440,960,'camera=sidewalk&at=-181'],sidewalkPhone:[390,844,'camera=sidewalk&at=-181'],watch:[1440,960,'mode=watch&camera=sidewalk'],watchPhone:[390,844,'mode=watch&camera=sidewalk']};
 Object.assign(cases,{architecture:[1440,960,'architecture&streetscape&scene=architecture-street'],architectureBay:[1440,960,'architecture&scene=architecture-baywindow'],architectureBalcony:[1440,960,'architecture&scene=architecture-balcony'],architectureArch:[1440,960,'architecture&scene=architecture-archedhood'],architectureRoof:[1440,960,'architecture&scene=architecture-roof'],architectureFire:[1440,960,'architecture&scene=architecture-firelanding'],architecturePhone:[390,844,'architecture&scene=architecture-baywindow'],architectureNight:[1440,960,'architecture&city-night&scene=architecture-night'],offlineArchitecture:[1440,960,'offline&architecture&streetscape&scene=architecture-street']});
 Object.assign(cases,{stopJitter:[1440,960,'stop-jitter'],stopJitterPhone:[390,844,'stop-jitter'],offlineStopJitter:[390,844,'offline&stop-jitter']});
 Object.assign(cases,{weatherClear:[1440,960,'weather=clear'],weatherCloud:[1440,960,'weather=overcast'],weatherRain:[1440,960,'weather=rain'],weatherMist:[1440,960,'weather=mist'],weatherNight:[1440,960,'weather=rain&night-lamps'],weatherPhone:[390,844,'weather=rain&night-lamps'],offlineWeather:[1440,960,'offline&weather=rain&night-lamps']});
 Object.assign(cases,{goldenHour:[1440,960,'cinematic=sunset&cinematic-check'],sunbreak:[1440,960,'cinematic=sunbreak'],stormFront:[1440,960,'cinematic=storm'],cinematicNight:[1440,960,'cinematic=rainnight'],goldenPhone:[390,844,'cinematic=sunset&cinematic-check'],cinematicPhone:[390,844,'cinematic=rainnight'],offlineCinematic:[1440,960,'offline&cinematic=sunset&cinematic-check']});
 Object.assign(cases,{firstLook:[1440,960,'first-look'],firstLookPhone:[390,844,'first-look']});
 Object.assign(cases,{rideMenuPhone:[390,844,'ride-settings&settings',2,true]});
 Object.assign(cases,{rideSettings:[1440,960,'ride-settings'],rideSettingsPhone:[390,844,'ride-settings',2,true],rideSettingsTablet:[1024,1366,'ride-settings',2,true],offlineRideSettings:[390,844,'offline&ride-settings']});
 Object.assign(cases,{restoreWeatherOff:[390,844,'restore-weather=off'],restoreWeatherFixed:[390,844,'restore-weather=fixed'],migrateWeather:[390,844,'migrate-weather']});
 Object.assign(cases,{weatherModes:[1440,960,'weather-modes=cycle'],weatherOff:[1440,960,'weather-modes=off'],weatherFixed:[1440,960,'weather-modes=fixed'],weatherModesPhone:[390,844,'weather-modes=fixed'],weatherSettingsPhone:[390,844,'weather-modes=fixed&settings'],offlineWeatherModes:[1440,960,'offline&weather-modes=cycle']});
 Object.assign(cases,{streetscape:[1440,960,'streetscape&scene=street-furniture'],garden:[1440,960,'streetscape&scene=garden'],gardenPhone:[390,844,'streetscape&scene=garden'],rooftops:[1440,960,'streetscape&scene=rooftops'],offlineScenery:[1440,960,'offline&streetscape&scene=street-furniture']});
 Object.assign(cases,{retail:[1440,960,'retail&streetscape&scene=retail-bookshelf'],retailPhone:[390,844,'retail&scene=retail-bakerycase'],retailRecords:[1440,960,'retail&scene=retail-recordbin'],retailCycle:[1440,960,'retail&scene=retail-bicycle'],offlineRetail:[1440,960,'offline&retail&streetscape&scene=retail-floriststand'],trafficFlow:[1440,960,'retail&car-assets&traffic&camera=follow'],trafficFlowPhone:[390,844,'retail&car-assets&camera=sidewalk&at=-181'],retailNight:[1440,960,'retail&night-lamps&scene=retail-coffeecounter']});
 Object.assign(cases,{sharedLanes:[1440,960,'shared-lanes&scene=boarding-traffic'],sharedLanesPhone:[390,844,'shared-lanes&scene=boarding-traffic'],offlineSharedLanes:[1440,960,'offline&shared-lanes&scene=boarding-traffic'],cityNight:[1440,960,'city-night&night-lamps&scene=city-night'],cityNightPhone:[390,844,'city-night&night-lamps&scene=city-night'],offlineCityNight:[1440,960,'offline&city-night&night-lamps&scene=city-night'],cityNightFade:[390,844,'city-night&night-lamps&live-transitions']});
 Object.assign(cases,{cars:[1440,960,'scene=car-sedan&traffic'],hatchback:[1440,960,'scene=car-hatchback'],wagon:[1440,960,'scene=car-wagon']});
 Object.assign(cases,{carAssets:[1440,960,'scene=car-sedan&car-assets&traffic&car-front'],carAssetsPhone:[390,844,'scene=car-hatchback&car-assets&car-front'],carAssetsNight:[1440,960,'scene=car-wagon&car-assets&car-front&night-lamps'],offlineCarAssets:[1440,960,'offline&scene=car-sedan&car-assets&traffic&car-front']});
 Object.assign(cases,{road:[1440,960,'road&camera=front&at=-76'],roadPhone:[390,844,'road&camera=front&at=-76'],roadSidewalk:[1440,960,'road&camera=sidewalk&at=-124']});
 Object.assign(cases,{signals:[1440,960,'signals'],night:[1440,960,'scene=night'],nightPhone:[390,844,'scene=night'],streetcarAudio:[1440,960,'streetcar-audio'],offlineStreetcarAudio:[1440,960,'offline&streetcar-audio']});
 Object.assign(cases,{bumper:[1440,960,'bumper&camera=front']});
 Object.assign(cases,{intersection:[1440,960,'scene=intersection']});
 Object.assign(cases,{crosswalk:[1440,960,'scene=crosswalk&crosswalk-paint'],crosswalkClose:[1440,960,'scene=crosswalk-close&crosswalk-paint'],crosswalkPhone:[390,844,'scene=crosswalk-close&crosswalk-paint'],offlineCrosswalk:[1440,960,'offline&scene=crosswalk-close&crosswalk-paint']});
 Object.assign(cases,{sidewalks:[1440,960,'scene=sidewalks'],sidewalksPhone:[390,844,'scene=sidewalks'],offlineSidewalks:[1440,960,'offline&scene=sidewalks']});
 Object.assign(cases,{doorAudio:[1440,960,'door-audio']});
 Object.assign(cases,{departureBell:[1440,960,'departure-bell'],offlineDepartureBell:[390,844,'offline&departure-bell',2,true]});
 Object.assign(cases,{audioActivation:[1440,960,'audio-activation'],offlineAudioActivation:[1440,960,'offline&audio-activation'],daytimeBrakes:[1440,960,'daytime-brakes&scene=model-rear'],daytimeBrakesPhone:[390,844,'daytime-brakes'],offlineDaytimeBrakes:[1440,960,'offline&daytime-brakes&scene=model-rear']});
 Object.assign(cases,{offlineDoorAudio:[1440,960,'offline&door-audio']});
 Object.assign(cases,{asset:[1440,960,'asset&scene=streetcar'],assetDoors:[1440,960,'scene=stop&camera=sidewalk&asset']});
 Object.assign(cases,{ambientOcclusion:[1440,960,'ambient-occlusion'],ambientOcclusionPhone:[391,845,'ambient-occlusion']});
 Object.assign(cases,{modelInterior:[1440,960,'scene=model-interior'],modelRear:[1440,960,'scene=model-rear'],offlineModel:[1440,960,'offline&asset&scene=streetcar']});
 Object.assign(cases,{modelLounge:[1440,960,'scene=model-lounge'],modelRoof:[1440,960,'scene=model-roof']});
 Object.assign(cases,{doorInside:[1440,960,'scene=model-door-inside'],doorOpen:[1440,960,'scene=model-door-open'],doorFront:[1440,960,'scene=model-door-front'],doorThroughGlass:[1440,960,'scene=model-door-through-glass']});
 Object.assign(cases,{oncoming:[1440,960,'streetcar-traffic&scene=passing-streetcar'],oncomingPhone:[390,844,'streetcar-traffic&camera=sidewalk&at=-181'],offlineOncoming:[1440,960,'offline&streetcar-traffic&scene=passing-streetcar']});
 Object.assign(cases,{
   surfaceLines:[1600,1000,'scene=surface-lines'],
   linesNoAO:[1600,1000,'scene=surface-lines&no-ao'],
   linesNoShadows:[1600,1000,'scene=surface-lines&no-shadows'],
   linesNoRelief:[1600,1000,'scene=surface-lines&no-relief'],
   linesPlain:[1600,1000,'scene=surface-lines&no-ao&no-shadows&no-relief']
 });
 Object.assign(cases,{
   linesClose:[1940,1040,'scene=surface-lines-close'],
   linesAt0:[1940,1040,'scene=surface-lines-close&at=0'],
   linesAt100:[1940,1040,'scene=surface-lines-close&at=100'],
   linesAt210:[1940,1040,'scene=surface-lines-close&at=210'],
   linesAcne:[1940,1040,'scene=surface-lines-close&shadow-acne']
 });
 Object.assign(cases,{surfaceArtifacts:[1940,1040,'surface-artifacts&scene=surface-lines-close'],linesAOBuffer:[1940,1040,'scene=surface-lines-close&ao-buffer']});
 Object.assign(cases,{shadowSurfaces:[1440,960,'shadow-surfaces'],shadowSurfacesPhone:[390,844,'shadow-surfaces']});
 Object.assign(cases,{linesHiDPI:[1941,1041,'scene=surface-lines-close',1.25],linesRetina:[1440,960,'scene=surface-lines-close',2]});
 Object.assign(cases,{
   nightMarkers:[1440,960,'night-lamps&night-lamp-check&scene=surface-lines-close'],
   offlineNightMarkers:[1440,960,'offline&night-lamps&night-lamp-check&scene=model-rear'],
   nightLiveFade:[390,844,'night-lamps&live-transitions'],
   nightRear:[1440,960,'night-lamps&scene=model-rear'],
   nightMarkerPhone:[390,844,'night-lamps&camera=sidewalk&at=-175'],
   liveTransitions:[1440,960,'live-transitions'],
   liveTransitionsPhone:[390,844,'live-transitions'],
   liveTransitionsCalmer:[390,844,'live-transitions&calmer-fade'],
   offlineLiveTransitions:[1440,960,'offline&live-transitions'],
   sidewalkPass:[1940,1040,'camera=sidewalk&at=-175'],
   sidewalkLeave:[1940,1040,'camera=sidewalk&at=-164'],
   sidewalkEnd:[1440,960,'camera=sidewalk&at=360'],
   sidewalkEndPhone:[390,844,'camera=sidewalk&at=360'],
   sidewalkScan:[1940,1040,'camera=sidewalk&at=-175&no-shadows'],
   mrtColour:[1940,1040,'scene=surface-lines-close&mrt-colour'],
   mrtColourPhone:[390,844,'camera=sidewalk&at=-175&mrt-colour'],
   offlineSidewalk:[1440,960,'offline&camera=sidewalk&at=360&mrt-colour'],
   normalsHDR:[1940,1040,'scene=surface-lines-close&all-hdr'],
   depthNormals:[1440,960,'depth-normals'],
   depth12:[1940,1040,'scene=surface-lines-close&depth-bits=12'],
   depth12AO:[1940,1040,'scene=surface-lines-close&depth-bits=12&ao-buffer'],
   depth16:[1940,1040,'scene=surface-lines-close&depth-bits=16'],
   depth18:[1940,1040,'scene=surface-lines-close&depth-bits=18'],
   depth16NoAO:[1940,1040,'scene=surface-lines-close&depth-bits=16&no-ao'],
 });
 for(const name of process.argv.slice(2).length?process.argv.slice(2):Object.keys(cases)){
   const [width,height,query,deviceScaleFactor=1,mobile=false]=cases[name];
   gpuLogs.length=0;
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor,mobile});
   await send('Emulation.setTouchEmulationEnabled',{enabled:mobile,maxTouchPoints:mobile?5:1});
   await send('Page.navigate',{url:`http://127.0.0.1:8124/qa/preview.html?${query}&width=${width}&height=${height}`});
   let result,gestureSent=false;
   for(let i=0;i<900;i++){
     if(query.includes('departure-bell')&&!gestureSent){
       const point=await evaluate('(()=>{const f=document.querySelector("#game"),w=f?.contentWindow;if(!w?.__soundGestureRequired)return null;const a=f.getBoundingClientRect(),b=w.document.querySelector("#bell").getBoundingClientRect();return {x:a.x+b.x+b.width/2,y:a.y+b.y+b.height/2};})()');
       if(point){await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});gestureSent=true;}
     }
     const value=await evaluate('document.querySelector("#results")?.textContent');
     try{result=JSON.parse(value);}catch{}
     if(result)break;await delay(100);
   }
   if(!result)throw new Error(name+': browser checks did not finish');
   result.gpuLogs=gpuLogs.filter(entry=>/GL_|WebGL|draw buffer|framebuffer/i.test(entry.text));
   await delay(250);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   await writeFile(join(output,name+'.png'),Buffer.from(shot.data,'base64'));
   await writeFile(join(output,name+'.json'),JSON.stringify(result,null,2));
   console.log(name+': '+JSON.stringify(result));
   if(!result.pass)throw new Error(name+' failed');
 }
 console.log('Screenshots: '+output);
}finally{
 if(socket)socket.close();browser.kill();await delay(500);
 // The disposable profile is always a verified child of this QA directory.
 if(!relative(qa,resolve(profile)).startsWith('..'))await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
