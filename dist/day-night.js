export const DAY_NIGHT={day:240,dusk:60,night:12,dawn:60,nightStart:300,duration:372};

export function nightLevel(time){
 const t=((time%DAY_NIGHT.duration)+DAY_NIGHT.duration)%DAY_NIGHT.duration;
 const smooth=x=>x*x*(3-2*x);
 if(t<DAY_NIGHT.day)return 0;
 if(t<DAY_NIGHT.nightStart)return smooth((t-DAY_NIGHT.day)/DAY_NIGHT.dusk);
 if(t<DAY_NIGHT.nightStart+DAY_NIGHT.night)return 1;
 return 1-smooth((t-DAY_NIGHT.nightStart-DAY_NIGHT.night)/DAY_NIGHT.dawn);
}

// Preserve the brightness of in-place checkpoints from either older clock.
// Page loads separately reset to morning, including update/recovery reloads.
export function restoreDayNightTime(time,duration=DAY_NIGHT.duration){
 const legacy=duration===312?{dusk:30,dawn:30}:duration===342?{dusk:30,dawn:60}:null;
 const period=legacy?duration:DAY_NIGHT.duration,t=((time%period)+period)%period;
 if(!legacy||t<DAY_NIGHT.day)return t;
 const oldNight=DAY_NIGHT.day+legacy.dusk,oldDawn=oldNight+DAY_NIGHT.night;
 if(t<oldNight)return DAY_NIGHT.day+(t-DAY_NIGHT.day)*DAY_NIGHT.dusk/legacy.dusk;
 if(t<oldDawn)return DAY_NIGHT.nightStart+t-oldNight;
 return DAY_NIGHT.nightStart+DAY_NIGHT.night+(t-oldDawn)*DAY_NIGHT.dawn/legacy.dawn;
}
