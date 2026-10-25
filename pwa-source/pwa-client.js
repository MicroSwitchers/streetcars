const release=document.querySelector('meta[name="queen-street-release"]')?.content;
const manifest=document.querySelector('link[rel="manifest"]');
const root=manifest&&new URL('./',manifest.href),status=document.getElementById('app-status'),section=document.getElementById('install-section'),button=document.getElementById('install-app');
const sessionKey=root&&'queen-street-update-session:'+root.href;
let registration,promptEvent,reloading=false,pendingReload=false,activationSent=false,starting=false,hadController=!!navigator.serviceWorker?.controller;
const text=value=>{if(status)status.textContent=value;};

if(release&&root&&isSecureContext&&'serviceWorker' in navigator){
 section.hidden=false;
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 const apple=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 document.getElementById('install-help').textContent=standalone?'Queen Street is installed. Updates download when you are online.':apple?'In Safari, tap Share, then Add to Home Screen. Once offline play is ready, you can play without a connection.':'Use Install Queen Street, or your browser’s Install app / Add to Home Screen menu.';
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;if(!standalone)button.hidden=false;});
 button.onclick=async()=>{if(!promptEvent)return;const prompt=promptEvent;promptEvent=null;button.hidden=true;await prompt.prompt();await prompt.userChoice;};
 window.addEventListener('appinstalled',()=>{button.hidden=true;document.getElementById('install-help').textContent='Queen Street is installed on your device.';});
 navigator.serviceWorker.addEventListener('message',event=>{
   if(event.data?.type==='REPORT_VERSION')event.source?.postMessage({type:'CLIENT_VERSION',release});
   if(event.data?.type==='OFFLINE_READY'&&event.data.release===release)text('Ready for offline play. Updates are checked automatically.');
 });
 function reportVersion(){navigator.serviceWorker.controller?.postMessage({type:'CLIENT_VERSION',release});}
 function safeToUpdate(){const api=window.queenStreet;return !document.hidden&&(window.queenStreetGraphicsLost||api?.ready&&!api.routeTransition&&!document.getElementById('settings-dialog')?.open&&(api.state.paused||!api.view.transition&&(api.state.phase==='ready'||api.state.phase==='finished'&&api.state.dwell>=1)));}
 function preserveRide(){if(!window.queenStreet?.ready)return !!window.queenStreetGraphicsLost;try{const snapshot=window.queenStreet.captureSession();sessionStorage.setItem(sessionKey,JSON.stringify(snapshot));return true;}catch{return false;}}
 function applyUpdate(){
   if(reloading||!safeToUpdate())return;
   if(pendingReload){if(!preserveRide())return;reloading=true;location.reload();return;}
   if(registration?.waiting&&!activationSent){if(!preserveRide())return;activationSent=true;registration.waiting.postMessage({type:'ACTIVATE'});}
 }
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
   // The first install claims this exact release and does not reload the game.
   if(!hadController){hadController=true;reportVersion();return;}
   pendingReload=true;applyUpdate();
 });
 async function checkUpdates(){
   if(!registration||!navigator.onLine||document.hidden)return;
   reportVersion();try{await registration.update();}catch{/* Keep the verified offline version when the network is unavailable. */}
 }
 async function start(){
   if(starting)return;starting=true;
   try{
     registration=await navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'});
     window.queenStreetPWA={registration,release,checkUpdates,get pending(){return !!registration.waiting||pendingReload;}};
     const watch=worker=>{if(!worker)return;text(hadController?'Checking for an update…':'Preparing offline play…');worker.addEventListener('statechange',()=>{
       if(worker.state==='installed'){text(registration.waiting?'Update downloaded. It will apply at the end of the ride.':'Ready for offline play. Updates are checked automatically.');applyUpdate();}
       if(worker.state==='redundant')text('Offline version retained. Updates will be checked again when online.');
     });};
     registration.addEventListener('updatefound',()=>watch(registration.installing));watch(registration.installing);
     if(registration.waiting){text('Update downloaded. It will apply at the end of the ride.');applyUpdate();}
     else if(registration.active)text('Ready for offline play. Updates are checked automatically.');
     reportVersion();checkUpdates();
     setInterval(applyUpdate,1000);setInterval(checkUpdates,5*60*1000);
     document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkUpdates();applyUpdate();}});
     window.addEventListener('online',()=>{text('Back online. Checking for updates…');checkUpdates();});
     window.addEventListener('offline',()=>text(registration.active?'Offline play is ready.':'Connect once to finish preparing offline play.'));
   }catch{text('Offline setup could not finish. The game still works online; try again next time.');}
 }
 // Register after the first playable frame so background caching does not
 // compete with initial model loading and shader compilation.
 if(window.queenStreet?.ready)setTimeout(start,1000);else window.addEventListener('queen-street-ready',()=>setTimeout(start,1000),{once:true});
 // A failed GPU startup must still be able to receive the release that fixes it.
 window.addEventListener('queen-street-graphics-lost',start);
}
