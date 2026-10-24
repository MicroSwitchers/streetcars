import assert from 'node:assert/strict';
import {StreetcarSounds} from '../dist/sounds.js';
let clock=0,serial=0;const timers=new Map();
globalThis.performance={now:()=>clock*1000};
globalThis.setTimeout=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms/1000});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
const advance=seconds=>{clock+=seconds;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Param{constructor(){this.value=0;this.events=[];}setValueAtTime(v,t){this.events.push(['set',v,t]);if(t<=clock)this.value=v;}linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}cancelScheduledValues(t){this.events.push(['cancel',t]);}cancelAndHoldAtTime(t){this.events.push(['hold',t]);}}
class Node{connect(node){return node;}disconnect(){}}
class Context{
 constructor(){this.state='running';this.destination={};this.sources=[];}
 get currentTime(){return clock;}
 async resume(){this.state='running';}
 createGain(){const n=new Node();n.gain=new Param();return n;}
 createMediaElementSource(){return new Node();}
 createBufferSource(){const n=new Node();n.stops=[];n.start=()=>n.started=true;n.stop=t=>n.stops.push(t);this.sources.push(n);return n;}
 async decodeAudioData(){return {duration:3.2};}
}
class Media{
 constructor(){this.readyState=1;this.duration=17.434;this.currentTime=0;this.playbackRate=1;this.paused=true;this.plays=0;this.pauses=0;}
 play(){this.plays++;this.paused=false;return this.nextPlay??Promise.resolve();}
 pause(){this.pauses++;this.paused=true;}
 load(){}
}
let media;
globalThis.window={AudioContext:Context};globalThis.HTMLMediaElement={NETWORK_LOADING:2};
globalThis.document={getElementById:id=>id==='streetcar-pass'?media:null};
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});
function fresh(){media=new Media();const s=new StreetcarSounds({volume:.35});s.context=new Context();s.unlocked=true;return s;}
let checks=0;const check=(label,value)=>{assert.ok(value,label);checks++;};
{
 const s=new StreetcarSounds({volume:.35});
 check('Automatic sounds do not create a locked AudioContext',await s.play('door')===false&&s.context===null);
}
{
 const s=fresh(),gate=deferred();s.load=()=>gate.promise;
 const request=s.play('door');s.stop();gate.resolve({duration:3});
 check('Pause cancels a sound still loading',await request===false&&s.context.sources.length===0);
}
{
 const s=fresh(),gate=deferred();s.load=()=>gate.promise;
 const request=s.play('bell');advance(.81);gate.resolve({duration:3});
 check('An old button request cannot play much later',await request===false&&s.context.sources.length===0);
}
for(const action of ['pausePass','stopPass']){
 const s=fresh(),gate=deferred();s.preparePass=()=>gate.promise;
 const request=s.startPass(20);s[action]();gate.resolve(media);
 check(action+' cancels startup before metadata is ready',await request===false&&media.plays===0);
}
{
 const s=fresh();await s.startPass(20);
 const gain=s.passGain.gain,count=gain.events.length;
 for(let i=0;i<200;i++)s.syncPass();
 check('Per-frame sync leaves the startup and end fades alone',gain.events.length===count);
 const token=s.passFade,pauses=media.pauses;s.pausePass();const pausedToken=s.passFade;
 for(let i=0;i<100;i++)s.pausePass();
 check('A held stop schedules one pause',pausedToken===token+1&&s.passFade===pausedToken);
 advance(.38);check('The scheduled pause actually completes',media.paused&&media.pauses===pauses+1);
 const gate=deferred();media.nextPlay=gate.promise;const plays=media.plays;
 const requests=Array.from({length:50},()=>s.resumePass());gate.resolve();await Promise.all(requests);
 check('Repeated simulation updates issue one resume request',media.plays===plays+1&&!s.passPaused&&!s.passResuming);
 media.nextPlay=null;media.onended();
 check('Natural completion is remembered instead of restarting the recording',s.passFinished&&!s.passActive);
 await s.startPass(15);check('A new travel leg can play normally',s.passActive&&!s.passFinished);
 s.stopPass();advance(.38);
}
{
 const s=fresh();await s.startPass(20);s.pausePass();advance(.38);
 const gate=deferred();media.nextPlay=gate.promise;const request=s.resumePass();s.stopPass();gate.resolve();
 check('A late resume cannot undo Stop',await request===false&&!s.passActive);
 advance(.38);check('Stopped media remains paused',media.paused);
}
{
 const s=fresh();s.buffers.door={duration:3};await s.play('door');const first=s.active.door;
 advance(.2);await s.play('door');
 check('A fresh door action replaces the previous door voice',Object.keys(s.active).length===1&&s.active.door!==first&&first.source.stops[0]>clock);
 s.stop();check('Pause releases voices with a fade',Object.keys(s.active).length===0);
}
{
 const s=fresh(),error=new Error('Browser playback permission');error.name='NotAllowedError';
 media.nextPlay=Promise.reject(error);
 check('Blocked playback waits for a new play action rather than retrying every frame',await s.startPass(20)===false&&s.passFinished&&s.passFailed);
 media.nextPlay=null;s.unlockPass();
 check('A deliberate play control can retry blocked audio',!s.passFinished&&!s.passFailed);
}
console.log('PASS: '+checks+' audio timing checks: stale requests, permission gating, pause/resume races, single playback and natural completion.');
