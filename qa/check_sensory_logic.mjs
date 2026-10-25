import assert from 'node:assert/strict';
import {WEATHER,WEATHER_PHASE_SECONDS,randomWeatherSequence,weatherPhase,mixWeather} from '../dist/weather-cycle.js';
import {WEATHER_BUTTON_OPTIONS,nextWeatherChoice} from '../dist/sensory-controls.js';
let selection={weatherMode:'cycle',weather:'overcast'};const seen=[];
for(let i=0;i<WEATHER_BUTTON_OPTIONS.length;i++){selection={...selection,...nextWeatherChoice(selection.weatherMode,selection.weather)};seen.push(selection.weatherMode==='fixed'?selection.weather:selection.weatherMode);}
assert.equal(new Set(seen).size,WEATHER_BUTTON_OPTIONS.length);assert.ok(seen.includes('random')&&seen.includes('off'));assert.equal(selection.weatherMode,'cycle');
for(const seed of [0,1,42,999,4294967295]){
 const sequence=randomWeatherSequence(seed);assert.deepEqual(sequence,randomWeatherSequence(seed));assert.equal(new Set(sequence).size,Object.keys(WEATHER).length);
 for(let i=0;i<sequence.length;i++){
  assert.notEqual(sequence[i],sequence[(i+1)%sequence.length]);
  const before=weatherPhase(i*WEATHER_PHASE_SECONDS-1e-6,sequence),after=weatherPhase(i*WEATHER_PHASE_SECONDS+1e-6,sequence);
  const a=mixWeather(WEATHER[before.from],WEATHER[before.to],before.blend),b=mixWeather(WEATHER[after.from],WEATHER[after.to],after.blend);
  for(const key of ['cloud','rain','wet','haze','gold','storm','volume'])assert.ok(Math.abs(a[key]-b[key])<1e-9);
 }
}
assert.notDeepEqual(randomWeatherSequence(42),randomWeatherSequence(999));
console.log('PASS: all weather button options, stable shuffled sequences, no adjacent repeats and smooth random weather boundaries.');
