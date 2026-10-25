export const DAY_NIGHT={day:240,dusk:30,night:12,dawn:60,nightStart:270,duration:342};

export function nightLevel(time){
 const t=((time%DAY_NIGHT.duration)+DAY_NIGHT.duration)%DAY_NIGHT.duration;
 const smooth=x=>x*x*(3-2*x);
 if(t<DAY_NIGHT.day)return 0;
 if(t<DAY_NIGHT.nightStart)return smooth((t-DAY_NIGHT.day)/DAY_NIGHT.dusk);
 if(t<DAY_NIGHT.nightStart+DAY_NIGHT.night)return 1;
 return 1-smooth((t-DAY_NIGHT.nightStart-DAY_NIGHT.night)/DAY_NIGHT.dawn);
}
