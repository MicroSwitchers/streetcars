// Simulation seconds: three minutes per weather phase, including a 75-second
// eased transition. This clock is independent of the shorter day/night clock.
export const WEATHER_PHASE_SECONDS=180;
export const WEATHER_TRANSITION_SECONDS=75;
export const WEATHER_SELECTION_SECONDS=8;
export const WEATHER_SEQUENCE=['overcast','mist','clear','sunset','sunbreak','rain','storm'];
export const WEATHER_CYCLE_SECONDS=WEATHER_PHASE_SECONDS*WEATHER_SEQUENCE.length;
export const WEATHER_MODES=['cycle','random','fixed','off'];
// Seeded shuffle keeps random weather stable across reloads and update restores.
export function randomWeatherSequence(seed){
 const sequence=Object.keys(WEATHER);let state=seed>>>0;
 for(let i=sequence.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[sequence[i],sequence[j]]=[sequence[j],sequence[i]];}
 return sequence;
}

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
export const WEATHER_OFF={label:'Off',cloud:.9,rain:0,wet:0,haze:0,gold:0,storm:0,volume:0,sun:[34,48,38],enabled:false,effectWeight:0};

export function weatherPhase(time,sequence=WEATHER_SEQUENCE){
 const duration=WEATHER_PHASE_SECONDS*sequence.length,t=((time%duration)+duration)%duration;
 const index=Math.floor(t/WEATHER_PHASE_SECONDS),local=t-index*WEATHER_PHASE_SECONDS;
 const progress=Math.max(0,(local-(WEATHER_PHASE_SECONDS-WEATHER_TRANSITION_SECONDS))/WEATHER_TRANSITION_SECONDS);
 return {from:sequence[index],to:sequence[(index+1)%sequence.length],blend:progress*progress*(3-2*progress)};
}

export function mixWeather(from,to,blend,result={sun:[0,0,0]}){
 for(const name of ['cloud','rain','wet','haze','gold','storm','volume'])result[name]=from[name]+(to[name]-from[name])*blend;
 // Normalize endpoints first: profile directions may have different lengths.
 const a=Math.hypot(...from.sun),b=Math.hypot(...to.sun);
 const dot=Math.max(-1,Math.min(1,from.sun.reduce((sum,n,i)=>sum+n/a*to.sun[i]/b,0))),angle=Math.acos(dot),sine=Math.sin(angle);
 const left=sine>.0001?Math.sin((1-blend)*angle)/sine:1-blend,right=sine>.0001?Math.sin(blend*angle)/sine:blend;
 for(let i=0;i<3;i++)result.sun[i]=from.sun[i]/a*left+to.sun[i]/b*right;
 result.effectWeight=(from.effectWeight??1)+((to.effectWeight??1)-(from.effectWeight??1))*blend;result.enabled=result.effectWeight>0;return result;
}
