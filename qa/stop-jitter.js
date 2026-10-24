export function checkStopJitter(api,check,w){
 const reports=[];
 for(const mode of ['auto','follow','sidewalk']){
   api.updateSettings({mode:'one',camera:mode,reduceMotion:true,alwaysGreen:true});api.restart();
   api.setPaused(false);Object.assign(api.state,{z:api.route.stops[0].z-.35,speed:.4,phase:'travelling',nextStop:0});
   api.updateHUD();api.view.update(api.state.z,0);
   const frames=[];
   for(let i=0;i<180;i++){
     api.step(1/60);api.view.update(api.state.z,1/60);
     if(i%4===0)api.updateHUD();
     const dock=w.document.querySelector('.ride-dock').getBoundingClientRect();
     frames.push({z:api.state.z,speed:api.state.speed,doors:api.rig.doors.front,phase:api.state.phase,offset:api.camera.projectionMatrix.elements[9],top:dock.top});
   }
   const jumps=frames.slice(1).map((f,i)=>({frame:i+1,delta:Math.abs(f.offset-frames[i].offset),before:frames[i],after:f})).filter(f=>f.delta>.00001);
   check(mode+' keeps camera framing stable when the doors open',jumps.length===0);
   check(mode+' keeps the body stationary throughout opening',frames.slice(1).every((f,i)=>f.doors===0||f.z===frames[i].z));
   check(mode+' opens doors smoothly without reversing',frames.slice(1).every((f,i)=>f.doors>=frames[i].doors&&f.doors-frames[i].doors<=1/60/api.rig.doorSeconds+1e-8));
   reports.push({mode,jumps,arrival:frames.findIndex(f=>f.phase==='atStop'),final:frames.at(-1)});
 }
 w.__stopJitterReport=reports;
 check('Door opening completes at a stationary stop',reports.every(r=>r.final.phase==='atStop'&&r.final.speed===0&&r.final.doors===1));
 api.setPaused(true);
}
