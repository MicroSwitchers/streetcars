export const QUALITY_MODES=['auto','high','balanced','low'];
export const GRAPHICS_RECOVERY_KEY='queen-street-safe-graphics-v1';
export function deviceGraphics(nav={},coarse=false,storage){
 let recovering=false;try{recovering=storage?.getItem(GRAPHICS_RECOVERY_KEY)==='1';}catch{}
 const appleMobile=/iPad|iPhone|iPod/i.test(nav.userAgent??'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1;
 const appleTablet=/iPad/i.test(nav.userAgent??'')||nav.platform==='MacIntel'&&nav.maxTouchPoints>1;
 return {coarse,memory:nav.deviceMemory,compatibility:appleMobile||recovering,appleMobile,appleTablet,recovering};
}
export const QUALITY={
 high:{label:'High',maxDpr:2,pixels:2100000,samples:4,shadow:2048,aoScale:2,aoSamples:12,volumeScale:3,volumeSteps:32,reflectionSteps:24},
 balanced:{label:'Balanced',maxDpr:1.25,pixels:1000000,samples:0,shadow:1024,aoScale:3,aoSamples:8,volumeScale:4,volumeSteps:20,reflectionSteps:14},
 low:{label:'Low',maxDpr:1,pixels:550000,samples:0,shadow:1024,aoScale:3,aoSamples:6,volumeScale:5,volumeSteps:12,reflectionSteps:8}
};
export const COMPATIBILITY_QUALITY={...QUALITY.low,label:'Safe graphics',pixels:400000,shadow:512,spots:4,points:2,probe:64};
export const TABLET_QUALITY={...COMPATIBILITY_QUALITY,label:'Sharper tablet graphics',maxDpr:1.25,pixels:1100000,shadow:1536,spots:6,points:3,probe:128};
export function qualityProfile(level,compatibility=false){return compatibility?(level==='low'?COMPATIBILITY_QUALITY:TABLET_QUALITY):QUALITY[level];}
export function initialQuality(device={}){return device.recovering||device.memory&&device.memory<=2?'low':device.compatibility?(device.appleTablet?'balanced':'low'):device.coarse||device.memory&&device.memory<=4?'balanced':'high';}
export function renderRatio(profile,width,height,dpr=1){return Math.max(.1,Math.min(dpr,profile.maxDpr,Math.sqrt(profile.pixels/Math.max(1,width*height))));}

// Register before renderer creation, including failures during shader startup.
export function installGraphicsRecovery(canvas){
 const recovery={lost:false,restores:0,api:null};
 const loading=document.getElementById('loading'),message=document.getElementById('load-message'),reload=document.getElementById('reload-game');
 reload.onclick=()=>location.reload();
 canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();recovery.lost=true;window.queenStreetGraphicsLost=true;
  try{localStorage.setItem(GRAPHICS_RECOVERY_KEY,'1');}catch{}
  recovery.api?.setPaused(true);
  const manifest=document.querySelector('link[rel="manifest"]');
  if(manifest&&recovery.api)try{sessionStorage.setItem('queen-street-update-session:'+new URL('./',manifest.href).href,JSON.stringify(recovery.api.captureSession()));}catch{}
  loading.hidden=false;message.textContent='Graphics paused. Waiting to reconnect. Reload will use lighter graphics.';reload.hidden=false;
  window.dispatchEvent(new Event('queen-street-graphics-lost'));
 });
 canvas.addEventListener('webglcontextrestored',()=>setTimeout(()=>{
  if(!recovery.api)return; // A failed startup needs the lighter reload path.
  try{
   recovery.api.weather.rebuildEnvironments();recovery.api.updateSettings({});
   recovery.lost=false;window.queenStreetGraphicsLost=false;recovery.restores++;
   loading.hidden=true;reload.hidden=true;recovery.api.setPaused(true);
   if(['watch','manual'].includes(recovery.api.settings.mode)&&!document.getElementById('settings-dialog')?.open){recovery.api.state.paused=false;recovery.api.updateHUD();}
  }catch{message.textContent='Please reload to continue with lighter graphics.';}
 },0));
 return recovery;
}

// Resolution/effect budgets adapt only after sustained slow or fast frames.
// Startup, hidden tabs, pauses, camera fades and one-off shader stalls are ignored.
export class AdaptiveQuality{
 constructor(initial='high',ceiling='high',targetFps=60){this.initial=initial;this.ceiling=ceiling;this.targetFps=targetFps;this.level=initial;this.mode='auto';this.elapsed=0;this.slow=0;this.fast=0;this.cooldown=8;}
 select(mode){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.level=this.mode==='auto'?this.initial:this.mode;const levels=['low','balanced','high'];if(levels.indexOf(this.level)>levels.indexOf(this.ceiling))this.level=this.ceiling;this.slow=0;this.fast=0;this.cooldown=8;return QUALITY[this.level];}
 sample(seconds,active=true){
   if(!active||!Number.isFinite(seconds)||seconds<=0||seconds>.25)return false;
   this.elapsed+=seconds;this.cooldown=Math.max(0,this.cooldown-seconds);if(this.mode!=='auto'||this.cooldown>0)return false;
   this.slow=seconds>1/(this.targetFps===30?24:30)?this.slow+seconds:Math.max(0,this.slow-seconds*.6);
   this.fast=seconds<1/(this.targetFps===30?28:58)?this.fast+seconds:0;
   const levels=['low','balanced','high'],index=levels.indexOf(this.level);
   const next=this.slow>=3&&index>0?levels[index-1]:this.fast>=18&&index<levels.indexOf(this.ceiling)?levels[index+1]:this.level;
   if(next===this.level)return false;
   this.level=next;this.slow=0;this.fast=0;this.cooldown=12;return true;
 }
}
