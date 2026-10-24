// Simulation seconds: four minutes per weather phase, including a 90-second
// eased transition. This clock is independent of the shorter day/night clock.
export const WEATHER_PHASE_SECONDS=240;
export const WEATHER_TRANSITION_SECONDS=90;
export const WEATHER_SEQUENCE=['overcast','mist','clear','sunset','sunbreak','rain','storm'];
export const WEATHER_CYCLE_SECONDS=WEATHER_PHASE_SECONDS*WEATHER_SEQUENCE.length;
export const WEATHER_MODES=['cycle','fixed','off'];

export const WEATHER={
 sunset:{label:'Clouded golden hour',cloud:.82,rain:0,wet:.26,haze:.08,gold:.7,storm:0,volume:.006,sun:[.015,.15,-.989]},
 sunbreak:{label:'After the storm',cloud:.88,rain:.22,wet:1,haze:.17,gold:.48,storm:.2,volume:.008,sun:[-.035,.20,-.979]},
 storm:{label:'Storm front',cloud:1,rain:1,wet:1,haze:.48,gold:.04,storm:1,volume:.011,sun:[-.3,.4,-.86]},
 rainnight:{label:'City rain',cloud:.85,rain:.8,wet:1,haze:.25,gold:0,storm:.45,volume:.016,sun:[34,48,38]},
 clear:{label:'Soft daylight',cloud:.42,rain:0,wet:0,haze:0,gold:0,storm:0,volume:.002,sun:[34,48,38]},
 overcast:{label:'Overcast',cloud:.9,rain:0,wet:0,haze:.24,gold:0,storm:.3,volume:.004,sun:[34,48,38]},
 rain:{label:'Rain & wet streets',cloud:1,rain:1,wet:1,haze:.4,gold:0,storm:.65,volume:.011,sun:[34,48,38]},
 mist:{label:'Gentle morning mist',cloud:.82,rain:0,wet:.26,haze:.75,gold:.28,storm:0,volume:.012,sun:[.03,.23,-.973]},
};
// Weather Off keeps neutral, static, diffused daylight; the independent night
// cycle and all normal vehicle, building and street lighting still work.
export const WEATHER_OFF={label:'Off',cloud:.9,rain:0,wet:0,haze:0,gold:0,storm:0,volume:0,sun:[34,48,38],enabled:false};

export function weatherPhase(time){
 const t=((time%WEATHER_CYCLE_SECONDS)+WEATHER_CYCLE_SECONDS)%WEATHER_CYCLE_SECONDS;
 const index=Math.floor(t/WEATHER_PHASE_SECONDS),local=t-index*WEATHER_PHASE_SECONDS;
 const progress=Math.max(0,(local-(WEATHER_PHASE_SECONDS-WEATHER_TRANSITION_SECONDS))/WEATHER_TRANSITION_SECONDS);
 return {from:WEATHER_SEQUENCE[index],to:WEATHER_SEQUENCE[(index+1)%WEATHER_SEQUENCE.length],blend:progress*progress*(3-2*progress)};
}

export function mixWeather(from,to,blend,result={sun:[0,0,0]}){
 for(const name of ['cloud','rain','wet','haze','gold','storm','volume'])result[name]=from[name]+(to[name]-from[name])*blend;
 // Normalize endpoints first: profile directions may have different lengths.
 const a=Math.hypot(...from.sun),b=Math.hypot(...to.sun);
 for(let i=0;i<3;i++)result.sun[i]=from.sun[i]/a+(to.sun[i]/b-from.sun[i]/a)*blend;
 result.enabled=true;return result;
}
