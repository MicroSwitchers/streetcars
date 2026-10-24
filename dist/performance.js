export const QUALITY_MODES=['auto','high','balanced','low'];
export const QUALITY={
 high:{label:'High',maxDpr:2,pixels:2100000,samples:4,shadow:2048,aoScale:2,aoSamples:12,volumeScale:3,volumeSteps:32,reflectionSteps:24},
 balanced:{label:'Balanced',maxDpr:1.25,pixels:1000000,samples:0,shadow:1024,aoScale:3,aoSamples:8,volumeScale:4,volumeSteps:20,reflectionSteps:14},
 low:{label:'Low',maxDpr:1,pixels:550000,samples:0,shadow:1024,aoScale:3,aoSamples:6,volumeScale:5,volumeSteps:12,reflectionSteps:8}
};
export function initialQuality(device={}){return device.memory&&device.memory<=2?'low':device.coarse||device.memory&&device.memory<=4?'balanced':'high';}
export function renderRatio(profile,width,height,dpr=1){return Math.max(.1,Math.min(dpr,profile.maxDpr,Math.sqrt(profile.pixels/Math.max(1,width*height))));}

// Resolution/effect budgets adapt only after sustained slow or fast frames.
// Startup, hidden tabs, pauses, camera fades and one-off shader stalls are ignored.
export class AdaptiveQuality{
 constructor(initial='high'){this.initial=initial;this.level=initial;this.mode='auto';this.elapsed=0;this.slow=0;this.fast=0;this.cooldown=8;}
 select(mode){this.mode=QUALITY_MODES.includes(mode)?mode:'auto';this.level=this.mode==='auto'?this.initial:this.mode;this.slow=0;this.fast=0;this.cooldown=8;return QUALITY[this.level];}
 sample(seconds,active=true){
   if(!active||!Number.isFinite(seconds)||seconds<=0||seconds>.25)return false;
   this.elapsed+=seconds;this.cooldown=Math.max(0,this.cooldown-seconds);if(this.mode!=='auto'||this.cooldown>0)return false;
   this.slow=seconds>1/30?this.slow+seconds:Math.max(0,this.slow-seconds*.6);
   this.fast=seconds<1/58?this.fast+seconds:0;
   const levels=['low','balanced','high'],index=levels.indexOf(this.level);
   const next=this.slow>=3&&index>0?levels[index-1]:this.fast>=18&&index<2?levels[index+1]:this.level;
   if(next===this.level)return false;
   this.level=next;this.slow=0;this.fast=0;this.cooldown=12;return true;
 }
}
