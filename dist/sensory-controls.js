// A deliberate continuous hold works with touch, mouse, pen and keyboard.
export function installSettingsHold(button,open,duration=3000){
 const meter=button.querySelector('[role="progressbar"]'),count=button.querySelector('.hold-count');
 let frame=0,started=0,source=null,pointerId=null;
 function cancel(){cancelAnimationFrame(frame);frame=0;source=null;button.classList.remove('is-holding');button.style.setProperty('--hold-progress',0);meter.hidden=true;count.hidden=true;meter.setAttribute('aria-valuenow','0');}
 function tick(now){
  if(!source)return;const progress=Math.min(1,(now-started)/duration);
  button.style.setProperty('--hold-progress',progress);meter.setAttribute('aria-valuenow',String(Math.round(progress*100)));count.textContent=String(Math.max(1,Math.ceil((duration-now+started)/1000)));
  if(progress>=1){cancel();open();return;}frame=requestAnimationFrame(tick);
 }
 function begin(kind){if(source)return;source=kind;started=performance.now();meter.hidden=false;count.hidden=false;button.classList.add('is-holding');tick(started);}
 button.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;event.preventDefault();pointerId=event.pointerId;button.focus({preventScroll:true});button.setPointerCapture(event.pointerId);begin('pointer');});
 button.addEventListener('pointermove',event=>{if(source!=='pointer'||event.pointerId!==pointerId)return;const r=button.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)cancel();});
 for(const event of ['pointerup','pointercancel','lostpointercapture','blur'])button.addEventListener(event,cancel);
 button.addEventListener('keydown',event=>{if(!['Space','Enter'].includes(event.code))return;event.preventDefault();event.stopPropagation();if(!event.repeat)begin(event.code);});
 button.addEventListener('keyup',event=>{if(!['Space','Enter'].includes(event.code))return;event.preventDefault();event.stopPropagation();if(source===event.code)cancel();});
 button.addEventListener('click',event=>event.preventDefault());button.addEventListener('contextmenu',event=>event.preventDefault());
 window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 return {cancel};
}

// Fullscreen the document, keeping the ride controls with the scene. Installed
// windows already have their own display mode; browser fullscreen stays toggleable.
export function installFullscreenButton(button,announce=()=>{}){
 const root=document.documentElement,modes=['standalone','minimal-ui','window-controls-overlay'].map(mode=>matchMedia('(display-mode: '+mode+')'));
 const active=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 const installed=()=>navigator.standalone===true||modes.some(mode=>mode.matches);
 const supported=()=>typeof root.requestFullscreen==='function'?document.fullscreenEnabled!==false:typeof root.webkitRequestFullscreen==='function'&&document.webkitFullscreenEnabled!==false;
 let pending=false;
 function update(){
  const on=active(),label=on?'Exit full screen':'Full screen';
  button.hidden=installed()||(!on&&!supported());button.dataset.fullscreen=on?'on':'off';
  button.querySelector('span').textContent=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(on));button.title=label;
 }
 button.addEventListener('click',async()=>{
  if(button.hidden||pending)return;pending=true;button.disabled=true;
  try{
   if(active())await (document.exitFullscreen??document.webkitExitFullscreen).call(document);
   else if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});
   else await root.webkitRequestFullscreen();
  }catch{announce('Full screen is not available in this browser right now.');}
  finally{pending=false;button.disabled=false;update();}
 });
 button.addEventListener('keydown',event=>{if(!['Space','Enter'].includes(event.code))return;event.preventDefault();event.stopPropagation();if(!event.repeat)button.click();});
 button.addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code))event.preventDefault();});
 for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,update);
 for(const mode of modes){if(mode.addEventListener)mode.addEventListener('change',update);else mode.addListener(update);}
 window.addEventListener('pageshow',update);update();
}

export const WEATHER_BUTTON_OPTIONS=['cycle','random','overcast','clear','mist','sunset','sunbreak','rain','storm','rainnight','off'];
export function nextWeatherChoice(mode,preset){
 const current=mode==='fixed'?preset:mode,index=WEATHER_BUTTON_OPTIONS.indexOf(current);
 const next=WEATHER_BUTTON_OPTIONS[(index+1)%WEATHER_BUTTON_OPTIONS.length];
 return ['cycle','random','off'].includes(next)?{weatherMode:next}:{weatherMode:'fixed',weather:next};
}
