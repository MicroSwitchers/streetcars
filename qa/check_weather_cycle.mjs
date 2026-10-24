import assert from 'node:assert/strict';
import {WEATHER,WEATHER_OFF,WEATHER_SEQUENCE,WEATHER_PHASE_SECONDS,WEATHER_TRANSITION_SECONDS,WEATHER_CYCLE_SECONDS,weatherPhase,mixWeather} from '../dist/weather-cycle.js';
import {DAY_NIGHT,nightLevel} from '../dist/day-night.js';
assert.equal(weatherPhase(0).from,'overcast');
assert.ok(WEATHER_TRANSITION_SECONDS>=60&&WEATHER_PHASE_SECONDS>=240);
assert.equal(DAY_NIGHT.night,12);
assert.ok(DAY_NIGHT.dusk>=30&&DAY_NIGHT.dawn>=30&&DAY_NIGHT.day>=240);
for(const [name,p] of Object.entries(WEATHER)){
 assert.ok(p.cloud>=.4&&p.volume<=.016,name+' remains subdued');
 assert.ok(Math.hypot(...p.sun)>0);
}
assert.equal(WEATHER_OFF.enabled,false);
for(const name of ['wet','rain','haze','gold','volume'])assert.equal(WEATHER_OFF[name],0);
let previous,largestStep=0,nightTransitions=0,samples=0;
const seen=new Set();
for(let tick=0;tick<=WEATHER_CYCLE_SECONDS*60;tick++){
 const time=tick/60,phase=weatherPhase(time),profile=mixWeather(WEATHER[phase.from],WEATHER[phase.to],phase.blend);
 seen.add(phase.from);
 for(const key of ['cloud','rain','wet','haze','gold','storm','volume']){
  assert.ok(Number.isFinite(profile[key])&&profile[key]>=0&&profile[key]<=1);
  if(previous){const delta=Math.abs(profile[key]-previous[key]);largestStep=Math.max(largestStep,delta);assert.ok(delta<.0003,'no weather jumps at '+time);}
 }
 const direction=profile.sun.map(x=>x/Math.hypot(...profile.sun));
 if(previous)assert.ok(Math.hypot(...direction.map((x,i)=>x-previous.direction[i]))<.001,'smooth sun movement');
 if(tick&&nightLevel(time)===1&&nightLevel(time-1/60)<1)nightTransitions++;
 previous={...profile,direction};samples++;
}
assert.equal(seen.size,WEATHER_SEQUENCE.length);
assert.ok(nightTransitions>=5,'weather continues across multiple days and nights');
for(let i=0;i<WEATHER_SEQUENCE.length;i++){
 const boundary=i*WEATHER_PHASE_SECONDS;
 const left=weatherPhase(boundary-1e-6),right=weatherPhase(boundary+1e-6);
 const a=mixWeather(WEATHER[left.from],WEATHER[left.to],left.blend),b=mixWeather(WEATHER[right.from],WEATHER[right.to],right.blend);
 for(const key of ['cloud','rain','wet','haze','gold','storm','volume'])assert.ok(Math.abs(a[key]-b[key])<1e-10,'continuous loop boundary');
}
console.log(JSON.stringify({pass:true,samples,cycleMinutes:WEATHER_CYCLE_SECONDS/60,phaseMinutes:WEATHER_PHASE_SECONDS/60,transitionSeconds:WEATHER_TRANSITION_SECONDS,largestStep,nightTransitions,dayNight:DAY_NIGHT}));
