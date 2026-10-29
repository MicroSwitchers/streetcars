const STREETCAR_GAIN=.9;
// Deliberate controls and current ride events may play; preparation never queues playback.
export class StreetcarSounds {
 constructor(settings){
  this.settings=settings;this.context=null;this.buffers={};this.loading={};this.active={};this.lastPlay={};this.voiceRequests={};this.voiceEpoch=0;this.unlocked=false;
  this.passElement=null;this.passNode=null;this.passGain=null;this.passReady=null;this.passActive=false;this.passPaused=false;this.passStarting=false;this.passResuming=false;this.passStopping=false;this.passFinished=false;this.passFailed=false;this.passFade=0;this.passTimer=null;this.passObjectUrl=null;this.passVolume=-1;
  const media=document.getElementById('streetcar-pass');if(media){media.preload='none';}
 }
 async contextReady(){if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')await this.context.resume();return this.context;}
 hold(param,now){if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}}
 async load(name){
  if(this.buffers[name])return this.buffers[name];if(this.loading[name])return this.loading[name];
  this.loading[name]=(async()=>{const audio=await this.contextReady(),embedded=document.getElementById('audio-'+name);let bytes;
   if(embedded)bytes=Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0)).buffer;
   else{const response=await fetch(new URL('./audio/streetcar-'+name+'.wav',import.meta.url));if(!response.ok)throw Error('Audio file unavailable');bytes=await response.arrayBuffer();}
   return this.buffers[name]=await audio.decodeAudioData(bytes);
  })();
  try{return await this.loading[name];}finally{delete this.loading[name];}
 }
 setPassSource(audio){
  if(this.passObjectUrl)return;const embedded=document.getElementById('audio-streetcar-pass');
  if(embedded){const bytes=Uint8Array.from(atob(embedded.textContent.trim()),c=>c.charCodeAt(0));this.passObjectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));audio.src=this.passObjectUrl;}
 }
 unlockPass(){
  this.unlocked=true;
  if(this.passFailed){this.passFailed=false;this.passFinished=false;}
  this.contextReady().catch(error=>console.error('Audio could not be enabled:',error));
  // Called directly by Go, driving or sound controls, never by camera/settings.
  this.preparePass().catch(error=>console.error('Streetcar pass audio could not be prepared:',error));
  this.load('door').catch(()=>{});
  // Decode ahead of departure so the first forward frame can ring promptly.
  this.load('bell').catch(()=>{});
 }
 async preparePass(){
  if(this.passReady)return this.passReady;
  this.passReady=(async()=>{
   const context=await this.contextReady(),audio=this.passElement=document.getElementById('streetcar-pass');if(!audio)throw new Error('Streetcar pass audio element is missing');
   audio.preservesPitch=false;audio.webkitPreservesPitch=false;audio.volume=1;this.setPassSource(audio);
   if(!this.passNode){this.passNode=context.createMediaElementSource(audio);this.passGain=context.createGain();this.passGain.gain.value=0;this.passNode.connect(this.passGain).connect(context.destination);}
   if(audio.readyState<1)await new Promise((resolve,reject)=>{audio.addEventListener('loadedmetadata',resolve,{once:true});audio.addEventListener('error',()=>reject(new Error('Streetcar pass audio could not be loaded')),{once:true});if(audio.networkState!==HTMLMediaElement.NETWORK_LOADING)audio.load();});
   if(!Number.isFinite(audio.duration)||audio.duration<=0)throw new Error('Streetcar pass audio has no usable duration');return audio;
  })();
  try{return await this.passReady;}catch(error){this.passReady=null;throw error;}
 }
 fadePassIn(seconds=.5){
  const now=this.context.currentTime,gain=this.passGain.gain,audio=this.passElement;
  const remaining=Math.max(.02,(audio.duration-audio.currentTime)/audio.playbackRate),attack=Math.min(seconds,remaining*.3);
  this.passVolume=this.settings.volume*STREETCAR_GAIN;this.hold(gain,now);gain.linearRampToValueAtTime(this.passVolume,now+attack);
  // Fade the recording's end once; per-frame sync must not overwrite this ramp.
  gain.setValueAtTime(this.passVolume,now+Math.max(attack,remaining-.2));gain.linearRampToValueAtTime(0,now+remaining);
 }
 endedHandler(token){
  this.passElement.onended=()=>{if(token!==this.passFade)return;this.passActive=false;this.passPaused=false;this.passFinished=true;this.passGain.gain.cancelScheduledValues(this.context.currentTime);this.passGain.gain.setValueAtTime(0,this.context.currentTime);};
 }
 async startPass(duration,progress=0){
  if(!this.unlocked||this.settings.volume<=0||this.passStarting||this.passResuming)return false;
  const token=++this.passFade;this.startToken=token;this.passStarting=true;this.passStopping=false;this.passFinished=false;this.passFailed=false;clearTimeout(this.passTimer);
  try{
   const audio=await this.preparePass();if(token!==this.passFade)return false;
   if(!audio.paused&&this.passGain.gain.value>.001){const now=this.context.currentTime;this.hold(this.passGain.gain,now);this.passGain.gain.linearRampToValueAtTime(0,now+.04);await new Promise(r=>setTimeout(r,50));if(token!==this.passFade)return false;}
   audio.pause();audio.currentTime=audio.duration*Math.max(0,Math.min(.98,progress));audio.playbackRate=Math.max(.4,Math.min(1.6,(audio.duration-audio.currentTime)/Math.max(1,duration)));
   const now=this.context.currentTime;this.passGain.gain.cancelScheduledValues(now);this.passGain.gain.setValueAtTime(0,now);
   await audio.play();if(token!==this.passFade){if(!this.passStarting&&!this.passResuming&&!this.passActive)audio.pause();return false;}
   this.passActive=true;this.passPaused=false;this.endedHandler(token);this.fadePassIn();return true;
  }catch(error){
   if(token===this.passFade){this.passActive=false;this.passPaused=false;this.passFinished=true;this.passFailed=true;}
   if(!['NotAllowedError','AbortError'].includes(error.name))throw error;return false;
  }finally{if(this.startToken===token)this.passStarting=false;}
 }
 syncPass(){if(this.passActive&&!this.passPaused&&this.passGain&&this.passVolume!==this.settings.volume*STREETCAR_GAIN)this.fadePassIn(.12);}
 pausePass(){
  if(this.passPaused||(!this.passActive&&!this.passStarting&&!this.passResuming))return;
  const token=++this.passFade;clearTimeout(this.passTimer);this.passStarting=false;this.passResuming=false;
  if(!this.passActive){this.passElement?.pause();return;}
  this.passPaused=true;const now=this.context.currentTime;this.hold(this.passGain.gain,now);this.passGain.gain.linearRampToValueAtTime(0,now+.35);
  this.passTimer=setTimeout(()=>{if(token===this.passFade&&this.passPaused)this.passElement.pause();},370);
 }
 async resumePass(){
  if(!this.passPaused||this.passResuming||!this.passElement||!this.passGain||this.settings.volume<=0)return false;
  const token=++this.passFade;this.resumeToken=token;this.passResuming=true;clearTimeout(this.passTimer);
  try{
   if(this.passElement.paused)await this.passElement.play();
   if(token!==this.passFade){if(!this.passActive&&!this.passStarting&&!this.passResuming)this.passElement.pause();return false;}
   this.passPaused=false;this.passActive=true;this.endedHandler(token);this.fadePassIn();return true;
  }catch(error){
   if(token===this.passFade){this.passActive=false;this.passPaused=false;this.passFinished=true;this.passFailed=true;}
   if(!['NotAllowedError','AbortError'].includes(error.name))throw error;return false;
  }finally{if(this.resumeToken===token)this.passResuming=false;}
 }
 stopPass(){
  if(this.passStopping)return;
  const token=++this.passFade;clearTimeout(this.passTimer);this.passStarting=false;this.passResuming=false;this.passPaused=false;this.passFinished=false;
  const playing=this.passActive;this.passActive=false;
  if(!playing||!this.passElement||!this.passGain){this.passElement?.pause();return;}
  this.passStopping=true;const now=this.context.currentTime;this.hold(this.passGain.gain,now);this.passGain.gain.linearRampToValueAtTime(0,now+.35);
  this.passTimer=setTimeout(()=>{if(token===this.passFade){this.passElement.pause();this.passElement.currentTime=0;this.passStopping=false;}},370);
 }
 release(voice,seconds=.05){
  const now=this.context.currentTime;this.hold(voice.gain.gain,now);voice.gain.gain.linearRampToValueAtTime(0,now+seconds);try{voice.source.stop(now+seconds+.005);}catch{}
 }
 remainingCooldown(name,now=performance.now()){
  if(!['bell','horn'].includes(name))return 0;
  const seconds=Number(this.settings[name+'Cooldown']),duration=Number.isFinite(seconds)?Math.max(0,Math.min(60,seconds))*1000:0;
  return Math.max(0,duration-(now-(this.lastPlay[name]??-Infinity)));
 }
 async play(name){
  if(!this.unlocked||this.settings.volume<=0)return false;
  const requested=performance.now();
  if(this.remainingCooldown(name,requested)>0)return false;
  if(name==='door'){if(requested-(this.lastPlay[name]??-Infinity)<120)return false;this.lastPlay[name]=requested;}
  const epoch=this.voiceEpoch,ticket=(this.voiceRequests[name]??0)+1;this.voiceRequests[name]=ticket;
  try{
   const context=await this.contextReady(),buffer=await this.load(name);
   if(epoch!==this.voiceEpoch||ticket!==this.voiceRequests[name]||this.settings.volume<=0||performance.now()-requested>800||context.state!=='running'||this.remainingCooldown(name)>0)return false;
   if(this.active[name])this.release(this.active[name]);
   const source=context.createBufferSource(),gain=context.createGain(),now=context.currentTime,level=this.settings.volume*(name==='door'?.4:.7);
   source.buffer=buffer;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+.015);gain.gain.setValueAtTime(level,now+Math.max(.016,buffer.duration-.09));gain.gain.linearRampToValueAtTime(0,now+buffer.duration);
   source.connect(gain).connect(context.destination);const voice={source,gain};this.active[name]=voice;
   source.onended=()=>{if(this.active[name]===voice)delete this.active[name];source.disconnect();gain.disconnect();};source.start();this.lastPlay[name]=performance.now();return true;
  }catch(error){console.error(`Streetcar ${name} audio could not be played:`,error);return false;}
 }
 stop(){this.voiceEpoch++;for(const voice of Object.values(this.active))this.release(voice);this.active={};this.pausePass();}
}
