export async function checkDepartureBell(api,check,w){
 const doc=w.document,sound=api.sound,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 check('Sound remains locked before a deliberate sound control',sound.context===null&&!sound.unlocked);
 api.updateSettings({volume:.35,bell:true,horn:true,mode:'one',doorDwell:0,alwaysGreen:true});
 // The headless driver supplies a real trusted click, preserving Chrome's
 // normal autoplay policy instead of disabling browser sound restrictions.
 w.__soundGestureRequired=true;
 await new Promise(resolve=>doc.getElementById('bell').addEventListener('click',resolve,{once:true}));
 w.__soundGestureRequired=false;
 for(let i=0;i<100&&!sound.active.bell;i++)await wait(20);
 check('Bell button plays the supplied recording after a trusted click',sound.active.bell?.source.buffer===sound.buffers.bell&&sound.context.state==='running');
 const bell=sound.buffers.bell,horn=await sound.load('horn');
 check('New bell and horn recordings decode at their prepared durations',Math.abs(bell.duration-6.217)<.01&&Math.abs(horn.duration-2.226)<.01&&bell.numberOfChannels===1&&horn.numberOfChannels===2);
 for(const [name,buffer] of [['bell',bell],['horn',horn]]){
  const samples=buffer.getChannelData(0);
  check(name+' has an audible onset within 30ms',samples.slice(0,Math.round(buffer.sampleRate*.03)).some(value=>Math.abs(value)>.05));
 }
 doc.getElementById('horn').click();for(let i=0;i<100&&!sound.active.horn;i++)await wait(20);
 check('Horn button plays the supplied industrial air horn',sound.active.horn?.source.buffer===horn);
 check('Both supplied attributions are available in settings',doc.querySelector('.sound-credits').textContent.includes('craigsmith')&&doc.querySelector('.sound-credits').textContent.includes('mcpable')&&doc.querySelector('.sound-credits a[href="https://freesound.org/s/479980/"]')&&doc.querySelector('.sound-credits a[href="https://freesound.org/s/131930/"]'));
 api.restart();api.setPaused(true);await wait(700);api.state.paused=false;
 const original=sound.play.bind(sound),events=[];
 const originalTraffic=api.ride.trafficAhead;api.ride.trafficAhead=()=>null;
 sound.play=name=>{events.push({name,z:api.state.z,speed:api.state.speed,doors:api.rig.doors.front});return original(name);};
 api.ride.go();check('Go itself does not ring the bell',events.length===0);
 const before=api.state.z;api.ride.step(1/60);
 await wait(30);
 check('First forward frame rings the prepared bell recording',events.length===1&&events[0].name==='bell'&&events[0].z>before&&events[0].speed>0&&sound.active.bell?.source.buffer===bell);
 sound.play=name=>{events.push({name,z:api.state.z,speed:api.state.speed,doors:api.rig.doors.front});return Promise.resolve(true);};
 api.setPaused(true);api.ride.step(.1);api.setPaused(false);api.ride.step(.1);
 check('Pause and resume of a moving streetcar do not ring again',events.filter(e=>e.name==='bell').length===1);
 for(let i=0;i<5000&&api.state.phase!=='atStop';i++)api.ride.step(.1);
 for(let i=0;i<15;i++)api.ride.step(.1);
 check('Arrival and door opening do not ring the departure bell',api.state.phase==='atStop'&&events.filter(e=>e.name==='bell').length===1);
 api.ride.go();let closing=true;
 for(let i=0;i<40;i++){
  const previous=api.state.z;api.ride.step(.1);
  if(api.state.z>previous){closing=false;break;}
  check('Door closing waits silently for actual travel',events.filter(e=>e.name==='bell').length===1);
 }
 check('Leaving the stop rings once after the doors latch',!closing&&events.filter(e=>e.name==='bell').length===2&&events.filter(e=>e.name==='bell').at(-1).doors<.001);
 sound.play=original;api.ride.trafficAhead=originalTraffic;api.setPaused(true);api.restart();api.setPaused(true);
}
