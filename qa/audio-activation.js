export function checkAudioActivation(api,check,w){
 const doc=w.document;
 check('No audio context is created on page load',api.sound.context===null&&!api.sound.unlocked);
 doc.body.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true}));
 doc.getElementById('camera').click();
 check('Camera and unrelated pointer presses do not enable sound',api.sound.context===null&&!api.sound.unlocked&&doc.getElementById('streetcar-pass').paused);
 api.updateSettings({mode:'watch'});api.state.speed=2;api.state.phase='travelling';api.step(.1);
 api.ride.setDoors(false);api.state.speed=0;api.ride.setDoors(true);
 check('Automatic travel and doors do not queue sound before a play action',api.sound.context===null&&Object.keys(api.sound.active).length===0);
 doc.getElementById('settings-open').click();doc.getElementById('settings-done').click();
 check('Opening and closing Settings does not trigger waiting audio',api.sound.context===null&&!api.sound.unlocked);
 api.updateSettings({mode:'one'});api.restart();api.setPaused(true);
 // The player has already heard this leg's recording; keep its natural silence.
 let starts=0;const sound=api.sound,originalStart=sound.startPass,originalUnlock=sound.unlockPass,originalPlay=sound.play;
 sound.unlockPass=()=>{sound.unlocked=true;};sound.play=()=>Promise.resolve(true);
 sound.startPass=()=>{starts++;sound.passActive=true;sound.passFinished=false;return Promise.resolve(true);};
 api.primary();api.state.phase='travelling';api.state.speed=2;api.step(.1);
 sound.passActive=false;sound.passFinished=true;
 for(let i=0;i<10;i++)api.step(.1);
 check('A naturally finished recording is not repeatedly restarted',starts===1);
 api.restart();api.setPaused(true);sound.startPass=originalStart;sound.unlockPass=originalUnlock;sound.play=originalPlay;
}
